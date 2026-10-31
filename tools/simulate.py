"""Monte Carlo of Dicele's rules (mirrors script.js) to get the real score distribution.

The SCORE_TIERS, FLOOR_TIERS and SCORE_PERCENTILES tables in script.js come from this.
Rerun it after changing any rule and paste the new numbers in.

    python tools/simulate.py [games=200000] [max_dice=10]

Golden falling dice are left out: tapping them is skill, not chance.
"""
import random
import statistics
import sys

BASE_DICE = 6
FLOORS_PER_DIE = 5
MAX_DICE = int(sys.argv[2]) if len(sys.argv) > 2 else 10
# Safety stop so an uncapped (max_dice=999) run can't loop forever
ROUND_CAP = 400
BONUS_STEP = 10
EVENT_CHANCE = 0.2
# (chips, multiplier) for each random event in script.js
EVENTS = [(15, 0), (-5, 0), (0, 3), (25, 0), (10, 0), (0, 1), (0, 0), (7, 0), (1, 0), (0, 2)]

capped = 0


def d(n):
    return random.randint(1, n)


def combos(values):
    counts = [0] * 7
    for v in values:
        counts[v] += 1
    bonus = 0
    if all(c >= 1 for c in counts[1:]):
        bonus += 100
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


def game():
    global capped
    # d100 wheel, spinning again on every 100
    mult = 0
    while True:
        v = d(100)
        mult += v
        if v != 100:
            break
    wheel = mult

    pips = 0
    floor = 0
    rnd = 0
    dice = BASE_DICE
    total_sixes = 0
    super_used = False

    def climb():
        nonlocal floor, dice
        floor += 1
        if floor % FLOORS_PER_DIE == 0 and dice < MAX_DICE:
            dice += 1

    while True:
        rnd += 1
        if rnd > ROUND_CAP:
            capped += 1
            break
        values = [d(6) for _ in range(dice)]
        pips += sum(values) + BONUS_STEP * (rnd - 1) + combos(values)
        if random.random() < EVENT_CHANCE:
            dp, dm = random.choice(EVENTS)
            pips = max(0, pips + dp)
            mult += dm
        sixes = values.count(6)
        if sixes:
            total_sixes += sixes
            if sixes >= 6:
                pips += 666
            for _ in range(sixes):
                climb()
            continue
        # Superbonus die: (100 - wheel) / 10 percent, once per game
        p = 0 if super_used else max(0, 100 - wheel) / 1000
        if p > 0 and random.random() < p:
            super_used = True
            if d(6) == 6:
                total_sixes += 1
                climb()
                continue
        break

    # End die: d(total sixes) added to the multiplier
    if total_sixes:
        mult += d(total_sixes)
    return pips * mult, floor, rnd


def main(n):
    random.seed(1)
    results = [game() for _ in range(n)]
    scores = sorted(r[0] for r in results)
    floors = sorted(r[1] for r in results)
    rounds = [r[2] for r in results]

    def q(arr, p):
        return arr[min(len(arr) - 1, int(p / 100 * len(arr)))]

    print(f"games {n}, max dice {MAX_DICE}, games stopped at {ROUND_CAP} rounds: {capped}")
    print(f"score mean {statistics.mean(scores):.0f}, median {q(scores, 50)}, max {scores[-1]}")
    print(f"rounds mean {statistics.mean(rounds):.2f}, max {max(rounds)}")
    print(f"floors mean {statistics.mean(floors):.2f}, median {q(floors, 50)}, max {max(floors)}")
    for p in [10, 25, 50, 75, 90, 95, 99, 99.9, 99.99]:
        print(f"  floor p{p}: {q(floors, p)}")
    pcts = [0, 1, 5, 10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 93, 95, 97, 98, 99, 99.5, 99.8, 99.9, 99.95, 99.99]
    print("score percentiles:")
    for p in pcts:
        print(f"  p{p}: {q(scores, p)}")
    print("SCORE_PERCENTILES", [[p, q(scores, p)] for p in pcts] + [[100, scores[-1]]])


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 200000)
