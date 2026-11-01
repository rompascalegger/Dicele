"""Monte Carlo of Dicele's rules (mirrors script.js, with the insta-autoroll choices).

Plays games in parallel on every CPU core and writes tools/sim_results.json: score
percentiles, the end-screen curve, floor percentiles and how many games run practically
forever. script.js's SCORE_PERCENTILES, SCORE_CURVE, FLOOR_PERCENTILES and tier
thresholds come from it.

    python tools/simulate.py [games=1500000] [workers=cpu count]
"""
import json
import math
import os
import random
import sys
import time
from multiprocessing import Pool
from pathlib import Path

BASE_DICE = 5
FLOORS_PER_DIE = 5
# Balance knobs can be overridden from the environment to try variants
BAD_FROM_DICE = int(os.environ.get("BAD_FROM_DICE", 10))
BAD_EVERY_DICE = int(os.environ.get("BAD_EVERY_DICE", 5))
LOSE_FACES_FROM_FLOOR = int(os.environ.get("LOSE_FACES_FROM_FLOOR", 25))
LOSE_FACE_STEP = int(os.environ.get("LOSE_FACE_STEP", 18))
# MANUAL=1 plays like a hand-roller: every tapped d6 has a secret extra 10% to be a 6, and
# one second chance per game when a round would end it. Default: insta-autoroll
MANUAL = os.environ.get("MANUAL") == "1"
HAND_SIX_BONUS = float(os.environ.get("HAND_SIX_BONUS", 0.1))
# Games past this floor are counted as practically endless
TRACK_TOP = 300
BONUS_STEP = 10
EVENT_CHANCE = 0.2
# (chips, multiplier) for each random event in script.js
EVENTS = [(15, 0), (-5, 0), (0, 3), (25, 0), (10, 0), (0, 1), (0, 0), (7, 0), (1, 0), (0, 2)]


def d(n):
    return random.randint(1, n)


def combos(values):
    counts = [0] * 7
    for v in values:
        counts[v] += 1
    bonus = 100 if all(c >= 1 for c in counts[1:]) else 0
    for n in range(1, 7):
        c = counts[n]
        if c >= 6:
            bonus += 500 + (c - 6) * 250
        elif c == 5:
            bonus += 200
        elif c == 4:
            bonus += 80
        elif c == 3:
            bonus += 30
    return bonus


def bad_dice_for(n):
    return 0 if n < BAD_FROM_DICE else 1 + (n - BAD_FROM_DICE) // BAD_EVERY_DICE


def lose_faces(floor):
    if floor < LOSE_FACES_FROM_FLOOR:
        return 1
    return min(19, 2 + (floor - LOSE_FACES_FROM_FLOOR) // LOSE_FACE_STEP)


def yazzy_need(n):
    return min(n, max(5, n - 5))


def best_count(values):
    best, count = 1, 0
    for v in range(1, 7):
        c = values.count(v)
        if c >= count:
            best, count = v, c
    return best, count


def tap_d6():
    if MANUAL:
        return 6 if random.random() < 1 / 6 + HAND_SIX_BONUS else d(5)
    return d(6)


def game():
    wheel = 0
    while True:
        v = d(100)
        wheel += v
        if v != 100:
            break
    luck = max(0, 100 - wheel) / 1000
    mult = wheel
    unlocked = {1: False, 2: False, 3: False, 4: False}
    gold = False
    shelf = 0
    pips = 0
    floor = 0
    rnd = 0
    dice = BASE_DICE
    retry_used = False
    while True:
        rnd += 1
        # Roll, then the free rerolls of unlocked 1s (d6) and 2s (green d5); silver 5s (40%)
        # reroll the whole table when there is no 6
        while True:
            values = []
            for _ in range(dice):
                x = tap_d6()
                if x == 1 and unlocked[1]:
                    x = tap_d6()
                elif x == 2 and unlocked[2]:
                    x = d(5)
                values.append(x)
            if 6 in values or 5 * values.count(5) < 2 * len(values):
                break
        gold_roll = d(10) if gold else 0
        bad = [d(20) for _ in range(bad_dice_for(dice))]

        # Yazzy (with the near-miss chance on one odd non-6 die)
        n = len(values)
        need = yazzy_need(n)
        value, count = best_count(values)
        if count == need - 1:
            odd = [i for i, x in enumerate(values) if x != value and x != 6]
            if odd and random.random() < 1 / 6 + luck:
                values[odd[-1]] = value
                count += 1
        if count >= need:
            if value <= 4:
                if unlocked[value]:
                    pips += 100 * value
                unlocked[value] = True
            elif value == 5:
                mult *= 2
            else:
                if gold:
                    mult += 10
                gold = True
            if count == n:
                values.append(d(6))  # perfect yazzy: one more die, kept
                dice += 1

        # Last chance, then the 3-sacrifice
        if 6 not in values:
            values[-1] = 6 if random.random() < 1 / 6 + luck else d(5)
        while unlocked[3] and 6 not in values and 3 in values and len(values) > values.count(3):
            lost = values.count(3)
            dice -= lost
            values = [d(6) for _ in range(len(values) - lost)]

        if 6 not in values and MANUAL and not retry_used:
            retry_used = True  # hand-roller's second chance: the round is played again
            rnd -= 1
            continue
        sixes = values.count(6)
        pips += sum(values) + BONUS_STEP * (rnd - 1) + combos(values) + (666 if sixes >= 6 else 0)
        if unlocked[4]:
            shelf += values.count(4)
        pips += sum(d(4) for _ in range(shelf))
        if random.random() < EVENT_CHANCE:
            dp, dm = random.choice(EVENTS)
            pips = max(0, pips + dp)
            mult += dm
        mult += gold_roll
        # Bad d20s: a 20 confiscates a bonus, low faces destroy dice
        for b in bad:
            if b == 20:
                owned = [k for k in unlocked if unlocked[k]]
                if owned:
                    unlocked[random.choice(owned)] = False
        lost = sum(1 for b in bad if b <= lose_faces(floor))
        if not sixes:
            break
        gained = (floor + sixes) // FLOORS_PER_DIE - floor // FLOORS_PER_DIE
        floor += sixes
        dice = max(1, dice + gained - lost)
        if floor >= TRACK_TOP:
            return None
    if floor:
        mult += d(floor)
    return pips * mult, floor, rnd


def worker(args):
    games, seed = args
    random.seed(seed)
    out = []
    endless = 0
    for _ in range(games):
        r = game()
        if r is None:
            endless += 1
        else:
            out.append(r)
    return out, endless


def main():
    total = int(sys.argv[1]) if len(sys.argv) > 1 else 1_500_000
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else (os.cpu_count() or 4)
    per = math.ceil(total / workers)
    t0 = time.time()
    with Pool(workers) as pool:
        parts = pool.map(worker, [(per, 1000 + i) for i in range(workers)])
    results = [r for part, _ in parts for r in part]
    endless = sum(e for _, e in parts)
    played = len(results) + endless
    scores = sorted(r[0] for r in results)
    floors = sorted(r[1] for r in results)

    def q(arr, p):
        return arr[min(len(arr) - 1, int(p / 100 * len(arr)))]

    pct_points = [0, 0.1, 1, 5, 10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 93, 95, 97, 98, 99, 99.5, 99.8, 99.9, 99.95, 99.99, 99.999]
    percentiles = [[p, q(scores, p)] for p in pct_points] + [[100, scores[-1]]]

    # End-screen curve: density over log10(score), 128 points, smoothed
    lo, hi = 1.0, math.log10(max(q(scores, 99.999), 100))
    bins = 128
    hist = [0] * bins
    for s in scores:
        x = math.log10(max(s, 1))
        i = int((x - lo) / (hi - lo) * (bins - 1) + 0.5)
        if 0 <= i < bins:
            hist[i] += 1
    smooth = [sum(hist[max(0, i - 3):i + 4][j] * w for j, w in enumerate([1, 2, 3, 4, 3, 2, 1][3 - min(3, i):][: len(hist[max(0, i - 3):i + 4])])) for i in range(bins)]
    peak = max(smooth)
    curve = [[round(lo + (hi - lo) * i / (bins - 1), 3), round(v / peak, 4)] for i, v in enumerate(smooth)]

    floor_pct = [[p, q(floors, p)] for p in [20, 40, 50, 60, 75, 85, 90, 93, 95, 97, 99, 99.9, 99.99]]
    res = {
        "method": f"Monte Carlo, {played:,} games on {workers} cores",
        "games": played,
        "practically_endless": endless,
        "practically_endless_share": endless / played,
        "mean_score": round(sum(scores) / len(scores)),
        "median_score": q(scores, 50),
        "score_percentiles": percentiles,
        "floor_percentiles": floor_pct,
        "no_six_at_all": floors.count(0) / len(floors),
        "curve_log10": curve,
        "seconds": round(time.time() - t0),
    }
    Path(__file__).with_name(os.environ.get("SIM_OUT", "sim_results.json")).write_text(json.dumps(res, indent=1))
    print(json.dumps({k: v for k, v in res.items() if k != "curve_log10"}, indent=1))


if __name__ == "__main__":
    main()
