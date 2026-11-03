"""Dicele's rules as a fast Monte Carlo, built to be changed.

Every number the game uses lives in RULES (named like the constants in script.js); the round
itself is play_game(). Changing a rule:

  1. Change RULES (or try it first without editing: --set NAME=value), or play_game() for a
     new mechanic.
  2. python tools/simulate.py compare [--set NAME=value ...]
     Plays the new rules and shows what changes for players against tools/baseline.json, the
     rules live right now: never-ending games, scores, floors, and how many games reach
     each of the game's current ranks.
  3. When it goes live, change script.js the same way, bump VERSION, then
     python tools/simulate.py ship
     It refuses if RULES and script.js disagree, writes the stats tables into script.js and
     tools/sim_results.json, and makes the new rules the baseline.

Other commands: `run` prints the numbers only; `baseline` re-measures the live rules
without touching script.js. Options: --games N per mode (default 1,000,000; ship and
baseline 6,000,000), --mode hand|auto, --workers N, --seed N.

"hand" plays like a hand-roller (clutch tap, last-chance bonus, one retry), "auto" like
insta-autoroll. Both make the insta-autoroll's choices (silver holds, sacrifices). The game's
stats tables come from "hand".

Speed: dice are rolled as counts (one multinomial draw for a whole table instead of one
random number per die), so a big table costs about as much as a small one.
"""
import ast
import json
import math
import os
import random
import re
import sys
import time
from bisect import bisect_right
from multiprocessing import Pool
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SCRIPT = HERE.parent / "script.js"
BASELINE = HERE / "baseline.json"
RESULTS = HERE / "sim_results.json"

# ---------- The rules (keep in step with script.js) ----------
RULES = {
    "BASE_DICE": 5,
    "FLOORS_PER_DIE": 5,  # one more red die every 5 floors
    # Casino Manager: bad d20s at floor 10 and 25, then one more every 15 floors (40, 55, ...);
    # they never leave
    "BAD_FIRST_FLOOR": 10,
    "BAD_FROM_FLOOR": 25,
    "BAD_EVERY_FLOORS": 15,
    # A bad d20 destroys a red die on 1 below floor 50, on 1-2 from 50, 1-3 from 100, ...
    "LOSE_FACE_STEP": 50,
    # The Casino CEO arrives at floor 75, 125, 175, ... and each time puts one more bad d100 on
    # the table for good: a 1 destroys a fifth of the red dice (CEO_LOSS_SHARE, rounded up)
    "CEO_FIRST_FLOOR": 75,
    "CEO_EVERY_FLOORS": 50,
    "CEO_DIE_SIDES": 100,
    "CEO_LOSS_SHARE": 0.2,
    # The President arrives at floor 500 with the Nuke die, a d500: a 1 is game over. It loses
    # a face for every floor climbed and gains one for every red die the house destroys.
    # 0 = no President
    "PRESIDENT_FLOOR": 500,
    "PRESIDENT_DIE_SIDES": 500,
    "PRESIDENT_SHRINKS_PER_FLOOR": 1,
    "PRESIDENT_GROWS_PER_LOST_DIE": 1,
    # Caps (0 = none): the most bad d20s / CEO d100s on a table, the most losing faces. The
    # danger stops growing there, so deep runs spread out instead of hitting one wall
    "BAD_MAX_DICE": 8,
    "CEO_MAX_DICE": 2,
    "LOSE_FACES_MAX": 2,
    # Every floor climbed multiplies the multiplier by this (1 = off)
    "MULT_PER_FLOOR": 1,
    # 0: a losing bad d20 destroys one red die. Above 0: that share of the red dice on the
    # table (rounded, at least one), so big tables stay at risk
    "BAD_LOSS_SHARE": 0,
    # A 20 on a bad d20 takes away one unlocked bonus
    "BAD_CONFISCATES": True,
    # Yazzy: all but 5 dice the same (at least 5, at most all of them), and never fewer than
    # YAZZY_MIN_DICE of a kind: with 3 dice or fewer there is no yazzy. YAZZY_LIKE = [5, 10]
    # instead asks, on every table size, for the number of a kind whose chance comes closest
    # to 5 of 10 (not live)
    "YAZZY_MIN": 5,
    "YAZZY_SLACK": 5,
    "YAZZY_MIN_DICE": 4,
    "YAZZY_LIKE": None,
    # Street d8s: a round showing 1-2-3-4-5 or 2-3-4-5-6 (with more than STREET_SMALL_MAX_DICE
    # red dice: only 1-2-3-4-5-6) earns one more ultraviolet d8 for good. They roll themselves
    # every round: 1 chips x2 this round, 2 multiplier x2 this round (the round's chips count
    # double), 3 both (x4), 4 a random red die rolls again (a 6 on it is banked), 5 a random
    # d8 rolls again, 6 a temporary red die joins this round, 7 a ghost bad d20 joins this
    # round, 8 blocks one bad d20 that would hurt. At most STREET_MAX_DICE of them (0 = no cap)
    "STREET_SMALL_MAX_DICE": 8,
    "STREET_DIE_SIDES": 8,
    "STREET_MAX_DICE": 1,
    "STREET_MULT_PERMANENT": False,  # True: a 2 doubles the real multiplier for good
    "UNLOCK_REPEAT_CHIPS": 100,  # an unlock you already own pays 100 x its number
    "GOLD_REPEAT_MULT": 10,
    "GOLD_DIE_SIDES": 10,  # the golden die adds d10 to the multiplier every round
    "GREEN_FACES": (1, 3, 4, 5, 6),  # unlocked 2s reroll with the green die
    # Silver: at least 40% fives and no 6 gives 2 rerolls; rerolled sixes are banked
    "SILVER_FIVES": 0.4,
    "SILVER_REROLLS": 2,
    "SILVER_KEEP_MIN": 3,  # insta-autoroll holds its biggest group of 3 or more
    # Hand-rollers: the last die tapped each round has +10% for a 6, last chances +10 (in %),
    # and one retry per game when a round would end it
    "CLUTCH_SIX_BONUS": 0.10,
    "HAND_LAST_CHANCE_BONUS": 10,
    "HAND_RETRY": True,
    "BONUS_STEP": 10,  # each round is worth 10 chips more than the last
    "FLOOR_CHIPS": 10,  # every round pays this many chips per floor you are on
    "SIX_SIXES_CHIPS": 666,
    "EVENT_CHANCE": 0.2,
    # (chips, multiplier) of each random event
    "EVENTS": ((15, 0), (-5, 0), (0, 3), (25, 0), (10, 0), (0, 1), (0, 0), (7, 0), (1, 0), (0, 2)),
    # End dice: all d(floor), one more at each of these floors, all add to the multiplier
    "END_DICE_AT": (1, 10, 25, 50, 100, 150, 200, 250, 300, 350),
    # "each": end die i buys one more round by beating i/(i+1) of its sides (1/2, 2/3, ...);
    # "first": only the first one can, with k/(k+1)
    "END_BAR": "each",
    # The bars also rise by one step every time you reach the end dice
    "END_BAR_ESCALATES": True,
    # End die k counts k times on the multiplier (scores only: whether it buys a round goes
    # by its plain roll). "flat": every end die counts once
    "END_DIE_WEIGHT": "index",
}
# The end dice before 2.4, for comparisons: --set END_DICE_AT=OLD_END_DICE_AT ...
OLD_END_DICE = {"END_DICE_AT": (1,) + tuple(range(10, 1001, 10)), "END_BAR": "first", "END_BAR_ESCALATES": True, "END_DIE_WEIGHT": "flat"}

# How the simulation runs (not rules)
SIM = {
    "TRACK_TOP": 5000,  # a game reaching this floor is practically endless (since 2.4 none do)
}
PCT_POINTS = [0, 0.1, 1, 5, 10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 93, 95, 97, 98, 99, 99.5, 99.8, 99.9, 99.95, 99.99, 99.999]
FLOOR_PCT_POINTS = [20, 40, 50, 60, 75, 85, 90, 93, 95, 97, 99, 99.9, 99.99]
# The game's rank tiers sit at these percentiles of the hand-rolled games
SCORE_TIER_PCTS = [20, 40, 60, 75, 85, 93, 97, 99, 99.9]
FLOOR_TIER_PCTS = [40, 60, 75, 85, 93, 97, 99, 99.9, 99.99]

R = dict(RULES)
NP = None  # numpy generator, one per worker


# ---------- Dice ----------
_rnd = random.random


def d(n):
    return int(_rnd() * n) + 1


def counts_of(values):
    c = [0] * 7
    for v in values:
        c[v] += 1
    return c


class Faces:
    """Final face distribution of one red die: the roll, then the free reroll of an
    unlocked 1 (plain d6) or 2 (green die). Rolls whole tables as counts."""

    def __init__(self, six):
        p = [0.0] + [(1 - six) / 5] * 5 + [six]
        self.plain = p
        self.cache = {}

    def get(self, u1, u2):
        key = (u1, u2)
        if key not in self.cache:
            p, q = self.plain, list(self.plain)
            if u1:
                q[1] -= p[1]
                for f in range(1, 7):
                    q[f] += p[1] / 6
            if u2:
                q[2] -= p[2]
                for f in R["GREEN_FACES"]:
                    q[f] += p[2] / len(R["GREEN_FACES"])
            cum = list(np.cumsum(q[1:]))
            cum[-1] = 2.0
            arr = np.array(q[1:])
            self.cache[key] = (cum, arr / arr.sum())
        return self.cache[key]


def roll(n, faces, u1=False, u2=False):
    """Counts [_, ones, twos, ..., sixes] of n dice."""
    cum, p = faces.get(u1, u2)
    if n > 12:
        c = NP.multinomial(n, p).tolist()
        return [0] + c
    c = [0] * 7
    rnd = random.random
    for _ in range(n):
        c[bisect_right(cum, rnd()) + 1] += 1
    return c


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def best_count(c):
    best = 1
    for v in range(1, 7):
        if c[v] >= c[best]:
            best = v
    return best, c[best]


def take_one(c, faces_allowed):
    """Remove one die, picked uniformly among the dice showing faces_allowed; returns its face."""
    total = sum(c[f] for f in faces_allowed)
    k = int(_rnd() * total)
    for f in faces_allowed:
        if k < c[f]:
            c[f] -= 1
            return f
        k -= c[f]


def combos(c):
    bonus = 100 if all(c[f] >= 1 for f in range(1, 7)) else 0
    for f in range(1, 7):
        n = c[f]
        if n >= 6:
            bonus += 500 + (n - 6) * 250
        elif n == 5:
            bonus += 200
        elif n == 4:
            bonus += 80
        elif n == 3:
            bonus += 30
    return bonus


def capped(n, cap):
    return min(n, cap) if cap else n


def bad_dice_for(floor):
    n = (floor >= R["BAD_FIRST_FLOOR"]) + (floor >= R["BAD_FROM_FLOOR"] and 1 + (floor - R["BAD_FROM_FLOOR"]) // R["BAD_EVERY_FLOORS"])
    return capped(int(n), R["BAD_MAX_DICE"])


def lose_faces(floor):
    return min(R["LOSE_FACES_MAX"], 1 + floor // R["LOSE_FACE_STEP"])


def ceo_dice_for(floor):
    n = floor >= R["CEO_FIRST_FLOOR"] and 1 + (floor - R["CEO_FIRST_FLOOR"]) // R["CEO_EVERY_FLOORS"]
    return capped(int(n), R["CEO_MAX_DICE"])


def chance_of_kind(n, k):
    """Chance that some face shows at least k times on n fair d6 (same float math as script.js)."""
    # below[m]: chance that m dice spread over t faces leave every face under k
    below = [1.0 if m < k else 0.0 for m in range(n + 1)]
    for t in range(2, 7):
        nxt = []
        for m in range(n + 1):
            p = 0.0
            for j in range(min(k - 1, m) + 1):
                p += math.exp(math.lgamma(m + 1) - math.lgamma(j + 1) - math.lgamma(m - j + 1) + j * math.log(1 / t) + (m - j) * math.log((t - 1) / t)) * below[m - j]
            nxt.append(p)
        below = nxt
    return 1 - below[n]


_need_cache = {}


def yazzy_need(n):
    if not R["YAZZY_LIKE"]:
        return max(R["YAZZY_MIN_DICE"], min(n, max(R["YAZZY_MIN"], n - R["YAZZY_SLACK"])))
    key = (n, tuple(R["YAZZY_LIKE"]), R["YAZZY_MIN_DICE"])
    if key not in _need_cache:
        lo = R["YAZZY_MIN_DICE"]
        if n <= lo:
            _need_cache[key] = lo
        else:
            target = math.log(chance_of_kind(R["YAZZY_LIKE"][1], R["YAZZY_LIKE"][0]))
            k = max(lo, -(-n // 6))
            while k < n and chance_of_kind(n, k + 1) > 0 and abs(math.log(chance_of_kind(n, k + 1)) - target) < abs(math.log(chance_of_kind(n, k)) - target):
                k += 1
            _need_cache[key] = k
    return _need_cache[key]


def end_mult(ends):
    w = R["END_DIE_WEIGHT"]
    return sum(v * (1 if w == "flat" else (i + 1) if w == "index" else (i + 1) ** 2) for i, v in enumerate(ends))


def end_dice(floor):
    return [d(floor) for f in R["END_DICE_AT"] if floor >= f]


def end_buys_round(ends, floor, visits):
    """visits: end dice rolled before this time. Does any end die beat its bar?"""
    dice = ends[:1] if R["END_BAR"] == "first" else ends
    for i, v in enumerate(dice):
        k = (visits + 1 if R["END_BAR"] == "first" else i + 1 + (visits if R["END_BAR_ESCALATES"] else 0))
        if v > -(-floor * k // (k + 1)):
            return True
    return False


# ---------- One game ----------
def play_game(hand):
    """Returns (score, floor, rounds), or None for a practically endless game."""
    plain = PLAIN
    clutch = CLUTCH if hand else PLAIN

    def table(n, u):
        # A hand-roller's last tapped die is the clutch die
        if n == 0:
            return [0] * 7
        if clutch is plain:
            return roll(n, plain, u[1], u[2])
        return add(roll(n - 1, plain, u[1], u[2]), roll(1, clutch, u[1], u[2]))

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
    shelf = 0  # unlocked 4s: one bonus d4 each, every round, for good
    pips = 0
    floor = 0
    rnd = 0
    dice = R["BASE_DICE"]
    retry_used = False
    end_rolls = 0
    bad_count = 0  # bad d20s never leave the table
    president = 0  # sides of the President's die once he is here
    street = 0  # street d8s on the table
    while True:
        rnd += 1
        c = table(dice, unlocked)
        n = dice
        banked = 0

        # Silver: two rerolls; holds stay, the biggest group (3+) is added to them each time,
        # sixes rerolled away are banked
        if c[6] == 0 and c[5] >= R["SILVER_FIVES"] * n - 1e-9:
            held = [0] * 7
            for _ in range(R["SILVER_REROLLS"]):
                v, k = best_count(c)
                if k >= R["SILVER_KEEP_MIN"]:
                    held[v] = c[v]
                free = [c[f] - held[f] for f in range(7)]
                banked += free[6]
                c = add(held, table(sum(free), unlocked))

        # Street d8s act after the player's rolls
        chip_x = 1
        temp = ghosts = blocks = 0
        if street:
            r = [d(R["STREET_DIE_SIDES"]) for _ in range(street)]
            pending = [i for i, v in enumerate(r) if v == 5]
            guard = 0
            while pending and guard < 200:
                guard += 1
                i = pending.pop()
                if r[i] != 5:
                    continue
                j = random.randrange(street)
                r[j] = d(R["STREET_DIE_SIDES"])
                if j in pending:
                    pending.remove(j)
                if r[j] == 5:
                    pending.append(j)
                if j != i:
                    r[i] = 0  # this 5 is spent
            for v in r:
                if v == 1:
                    chip_x *= 2
                elif v == 2:
                    if R["STREET_MULT_PERMANENT"]:
                        mult *= 2
                    else:
                        chip_x *= 2
                elif v == 3:
                    chip_x *= 2
                    if R["STREET_MULT_PERMANENT"]:
                        mult *= 2
                    else:
                        chip_x *= 2
                elif v == 4 and sum(c):
                    k = random.randrange(sum(c))
                    face = next(f for f in range(1, 7) if (k := k - c[f]) < 0)
                    if face == 6:
                        banked += 1
                    c[face] -= 1
                    c[d(6)] += 1
                elif v == 6:
                    c[d(6)] += 1
                    temp += 1
                elif v == 7:
                    ghosts += 1
                elif v == 8:
                    blocks += 1
            n += temp

        gold_roll = d(R["GOLD_DIE_SIDES"]) if gold else 0
        bad_count = max(bad_count, bad_dice_for(floor))
        lf = lose_faces(floor)
        bad_twenties = bad_lost = 0
        if R["PRESIDENT_FLOOR"] and floor >= R["PRESIDENT_FLOOR"] and not president:
            president = R["PRESIDENT_DIE_SIDES"]
        president_hit = president and d(president) == 1
        for _ in range(bad_count + ghosts):
            b = d(20)
            if b == 20:
                bad_twenties += 1
            elif b <= lf:
                bad_lost += 1
        # A street 8 blocks one bad d20 that would hurt: a strike first, else a confiscation
        for _ in range(blocks):
            if bad_lost:
                bad_lost -= 1
            elif bad_twenties:
                bad_twenties -= 1

        # Yazzy, with the near-miss chance on one odd non-6 die
        need = yazzy_need(n)
        value, count = best_count(c)
        if count == need - 1:
            odd = [f for f in range(1, 6) if f != value]
            if sum(c[f] for f in odd) and random.random() < 1 / 6 + luck:
                take_one(c, odd)
                c[value] += 1
                count += 1
        if count >= need:
            banked += 1  # a yazzy is always worth a 6
            if value <= 4:
                if unlocked[value]:
                    pips += R["UNLOCK_REPEAT_CHIPS"] * value
                unlocked[value] = True
            elif value == 5:
                mult *= 2
            else:
                if gold:
                    mult += R["GOLD_REPEAT_MULT"]
                gold = True
            if count == n and not temp:
                c[d(6)] += 1  # perfect yazzy: one more die, kept
                dice += 1

        # Last chance on one die, then the 3-sacrifice
        if c[6] == 0 and not banked:
            hit = 1 / 6 + luck + (R["HAND_LAST_CHANCE_BONUS"] / 100 if hand else 0)
            take_one(c, range(1, 6))
            c[6 if random.random() < hit else d(5)] += 1
        while unlocked[3] and not banked and c[6] == 0 and c[3] and sum(c) > c[3]:
            lost = c[3]
            dice -= lost
            c = roll(sum(c) - lost, plain)

        if c[6] == 0 and not banked and hand and R["HAND_RETRY"] and not retry_used:
            retry_used = True  # hand-roller's second chance: the round is played again
            rnd -= 1
            continue
        sixes = c[6] + banked
        gain = sum(f * c[f] for f in range(1, 7)) + R["BONUS_STEP"] * (rnd - 1) + combos(c) + R["FLOOR_CHIPS"] * floor
        if unlocked[4]:
            shelf += c[4]
        if shelf:
            gain += shelf + (int(NP.integers(0, 4, shelf).sum()) if shelf > 8 else sum(int(_rnd() * 4) for _ in range(shelf)))
        pips += gain * chip_x
        if sixes >= 6:
            pips += R["SIX_SIXES_CHIPS"]
        # A street on the table earns one more d8 for the next rounds
        small = dice <= R["STREET_SMALL_MAX_DICE"]
        if (all(c[1:7]) or small and (all(c[1:6]) or all(c[2:7]))) and (not R["STREET_MAX_DICE"] or street < R["STREET_MAX_DICE"]):
            street += 1
        if random.random() < R["EVENT_CHANCE"]:
            dp, dm = random.choice(R["EVENTS"])
            pips = max(0, pips + dp)
            mult += dm
        mult += gold_roll
        if R["BAD_CONFISCATES"]:
            for _ in range(bad_twenties):
                owned = [k for k in unlocked if unlocked[k]]
                if owned:
                    unlocked[random.choice(owned)] = False
        # Destroyed dice go before anything else; no red dice left is game over (the end dice
        # still add to the multiplier, this round's sixes don't climb)
        before = dice
        share = R["BAD_LOSS_SHARE"]
        for _ in range(bad_lost):
            dice -= max(1, round(share * dice)) if share else 1
        for _ in range(ceo_dice_for(floor)):
            if d(R["CEO_DIE_SIDES"]) == 1:
                dice -= math.ceil(R["CEO_LOSS_SHARE"] * dice - 1e-9)
        if president:
            president += (before - max(dice, 0)) * R["PRESIDENT_GROWS_PER_LOST_DIE"]
        if dice <= 0 or president_hit:
            mult += end_mult(end_dice(floor))
            break
        if not sixes:
            ends = end_dice(floor)
            mult += end_mult(ends)
            earned = floor and end_buys_round(ends, floor, end_rolls)
            end_rolls += 1
            if earned:
                continue
            break
        fpd = R["FLOORS_PER_DIE"]
        gained = (floor + sixes) // fpd - floor // fpd
        floor += sixes
        dice += gained
        if president and R["PRESIDENT_SHRINKS_PER_FLOOR"]:
            president = max(1, president - sixes * R["PRESIDENT_SHRINKS_PER_FLOOR"])
        if R["MULT_PER_FLOOR"] != 1:
            mult *= R["MULT_PER_FLOOR"] ** sixes
        if floor >= SIM["TRACK_TOP"]:
            return None
    return pips * mult, floor, rnd


# ---------- Running many games ----------
def init_worker(rules, sim):
    global PLAIN, CLUTCH
    R.clear()
    R.update(rules)
    SIM.update(sim)
    PLAIN = Faces(1 / 6)
    CLUTCH = Faces(1 / 6 + R["CLUTCH_SIX_BONUS"])


def worker(args):
    global NP
    games, seed, hand = args
    random.seed(seed)
    NP = np.random.default_rng(seed)
    scores, floors = [], []
    endless = 0
    for _ in range(games):
        r = play_game(hand)
        if r is None:
            endless += 1
        else:
            scores.append(r[0])
            floors.append(r[1])
    return scores, floors, endless


def simulate(rules, mode, games, workers, seed):
    per = math.ceil(games / workers)
    hand = mode == "hand"
    t0 = time.time()
    with Pool(workers, initializer=init_worker, initargs=(rules, SIM)) as pool:
        parts = pool.map(worker, [(per, seed + i + (0 if hand else 500_000), hand) for i in range(workers)])
    scores = np.sort(np.concatenate([np.array(p[0], dtype=np.float64) for p in parts]))
    floors = np.sort(np.concatenate([np.array(p[1], dtype=np.int64) for p in parts]))
    endless = sum(p[2] for p in parts)
    return summarize(scores, floors, endless, time.time() - t0)


def q(arr, p):
    return arr[min(len(arr) - 1, int(p / 100 * len(arr)))]


def summarize(scores, floors, endless, seconds):
    played = len(scores) + endless
    res = {
        "games": played,
        "practically_endless": endless,
        "practically_endless_share": endless / played,
        "mean_score": round(float(scores.mean())),
        "median_score": int(q(scores, 50)),
        "score_percentiles": [[p, int(q(scores, p))] for p in PCT_POINTS] + [[100, int(scores[-1])]],
        "floor_percentiles": [[p, int(q(floors, p))] for p in FLOOR_PCT_POINTS],
        "no_six_at_all": float(np.count_nonzero(floors == 0) / len(floors)),
        "curve_log10": curve(scores),
        "seconds": round(seconds),
    }
    res["_scores"], res["_floors"] = scores, floors
    return res


def curve(scores):
    """End-screen curve: density over log10(score), 128 points, smoothed."""
    lo, hi, bins = 1.0, math.log10(max(q(scores, 99.999), 100)), 128
    x = np.log10(np.maximum(scores, 1))
    i = np.floor((x - lo) / (hi - lo) * (bins - 1) + 0.5).astype(np.int64)
    hist = np.bincount(i[(i >= 0) & (i < bins)], minlength=bins)
    smooth = np.convolve(hist, [1, 2, 3, 4, 3, 2, 1], mode="same")
    peak = smooth.max()
    return [[round(lo + (hi - lo) * k / (bins - 1), 3), round(float(v / peak), 4)] for k, v in enumerate(smooth)]


def reach(res, score_tiers, floor_tiers):
    """Share of ALL games (endless ones reach everything) reaching each tier threshold."""
    n, e = res["games"], res["practically_endless"]
    s, f = res["_scores"], res["_floors"]
    return {
        "score": [(len(s) - int(np.searchsorted(s, t, "left")) + e) / n for t in score_tiers],
        "floor": [(len(f) - int(np.searchsorted(f, t, "left")) + e) / n for t in floor_tiers],
    }


# ---------- script.js ----------
def read_script():
    return SCRIPT.read_text(encoding="utf-8")


def js_const(src, name):
    m = re.search(rf"^const {name} = (.*);$", src, re.M)
    return json.loads(m.group(1)) if m else None


def js_mismatches(rules):
    """Rules whose number differs from the same-named const in script.js."""
    src = read_script()
    out = []
    for name, value in rules.items():
        m = re.search(rf"^const {name} = ([^;]*);", src, re.M)
        if not m:
            continue
        try:
            js = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        if json.dumps(js) != json.dumps(value):
            out.append(f"{name}: script.js {m.group(1)}, simulate.py {json.dumps(value)}")
    return out


def tier_names(src):
    block = re.search(r"^const TIERS = \[(.*?)^\];", src, re.M | re.S).group(1)
    return re.findall(r'name: "([^"]+)"', block)


def sig2(x):
    if x <= 0:
        return 0
    k = math.floor(math.log10(x)) - 1
    return int(round(x / 10**k) * 10**k)


def ship_tables(hand_res):
    src = read_script()
    sp = dict((p, v) for p, v in hand_res["score_percentiles"])
    fp = dict((p, v) for p, v in hand_res["floor_percentiles"])
    tables = {
        "SCORE_TIERS": [0] + [sig2(sp[p]) for p in SCORE_TIER_PCTS],
        "FLOOR_TIERS": [1] + [fp[p] for p in FLOOR_TIER_PCTS],
        "SCORE_PERCENTILES": hand_res["score_percentiles"],
        "FLOOR_PERCENTILES": hand_res["floor_percentiles"],
        "SCORE_CURVE": hand_res["curve_log10"],
    }
    for name, val in tables.items():
        line = f"const {name} = {json.dumps(val, separators=(', ', ': '))};"
        src, n = re.subn(rf"^const {name} = .*;$", lambda _: line, src, flags=re.M)
        if n != 1:
            sys.exit(f"script.js: could not find const {name}")
    src = re.sub(r"From [\d,]+ simulated", f"From {hand_res['games']:,} simulated", src)
    SCRIPT.write_text(src, encoding="utf-8")
    return tables


# ---------- Reports ----------
def fmt_int(x):
    return f"{int(x):,}"


def same_share(old, new, n, n_base):
    """Is the change in a share within 3 standard errors of both runs' noise?"""
    p = max(old * (1 - old), 1e-12)
    return abs(new - old) <= 3 * math.sqrt(p / n + p / n_base)


def compare_line(label, old, new, kind, noisy):
    if kind == "share":
        a, b = f"{old:.2%}", f"{new:.2%}"
    else:
        a, b = fmt_int(old), fmt_int(new)
    if noisy:
        change = "~ same (within noise)"
    elif kind == "share":
        change = f"{(new - old) * 100:+.2f} points"
    elif old:
        change = f"{(new / old - 1):+.0%}"
    else:
        change = "new"
    return f"  {label:<30}{a:>15} -> {b:<15}{change}"


def range_has(arr, p, old, n_base):
    """Is old inside the range (3 standard errors, both runs' noise) this run could give
    for percentile p?"""
    n = len(arr)
    k = p / 100 * n
    w = 3 * math.sqrt(n * p / 100 * (1 - p / 100) * (1 + n / n_base)) + 1
    return arr[max(0, int(k - w))] <= old <= arr[min(n - 1, int(k + w))]


def report(base, new_runs, rules):
    src = read_script()
    names = tier_names(src)
    out = [f"New rules vs baseline {base['version']} (what players play now, {base['games_per_mode']:,} games per mode)"]
    changed = [k for k in rules if json.dumps(rules[k]) != json.dumps(base["rules"].get(k))]
    if changed:
        out.append("Changed rules: " + ", ".join(f"{k} {json.dumps(base['rules'].get(k))} -> {json.dumps(rules[k])}" for k in changed))
    else:
        out.append("Rule numbers unchanged (any difference comes from code changes in play_game, or is noise)")
    for mode, new in new_runs.items():
        old = base["modes"][mode]
        n, nb = new["games"], old["games"]
        out.append("")
        out.append(f"{'HAND-ROLLED' if mode == 'hand' else 'AUTO-ROLLED'} ({n:,} new games)")
        for key, label in (("practically_endless_share", "Games that never end"), ("no_six_at_all", "No six at all")):
            o, v = old[key], new[key]
            out.append(compare_line(label, o, v, "share", same_share(o, v, n, nb)))
        out.append("  Games that end (the game's percentile tables come from these):")
        sp_old = dict((p, v) for p, v in old["score_percentiles"])
        for p, label in ((50, "Median score"), (90, "Top 10% score"), (99, "Top 1% score"), (99.9, "Top 0.1% score")):
            out.append(compare_line(label, sp_old[p], q(new["_scores"], p), "int", range_has(new["_scores"], p, sp_old[p], nb)))
        fp_old = dict((p, v) for p, v in old["floor_percentiles"])
        for p, label in ((50, "Median floor"), (90, "Top 10% floor"), (99, "Top 1% floor")):
            out.append(compare_line(label, fp_old[p], q(new["_floors"], p), "int", range_has(new["_floors"], p, fp_old[p], nb)))
        r = reach(new, base["score_tiers"], base["floor_tiers"])
        out.append("  All games reaching each live rank (endless games reach all of them):")
        for kind, tiers in (("score", base["score_tiers"]), ("floor", base["floor_tiers"])):
            for i, t in enumerate(tiers):
                if i == 0:
                    continue
                o, v = old["reach"][kind][i], r[kind][i]
                label = f"{names[i] if i < len(names) else i} {kind} >= {fmt_int(t)}"
                out.append(compare_line(label, o, v, "share", same_share(o, v, n, nb)))
    return "\n".join(out)


def brief(res):
    return {k: v for k, v in res.items() if not k.startswith("_") and k != "curve_log10"}


# ---------- Command line ----------
def parse_args(argv):
    cmd = argv[0] if argv and not argv[0].startswith("--") else "run"
    opts = {"games": None, "mode": None, "workers": os.cpu_count() or 4, "seed": 1000, "set": []}
    i = 1 if argv and argv[0] == cmd else 0
    while i < len(argv):
        a = argv[i]
        if a == "--set":
            opts["set"].append(argv[i + 1])
            i += 2
        elif a.startswith("--") and a[2:] in opts:
            opts[a[2:]] = argv[i + 1] if a[2:] == "mode" else int(argv[i + 1])
            i += 2
        else:
            sys.exit(f"unknown argument {a}\n\n{__doc__}")
    return cmd, opts


def apply_sets(sets):
    rules = dict(RULES)
    for s in sets:
        name, _, value = s.partition("=")
        if name in rules:
            rules[name] = ast.literal_eval(value)
        elif name in SIM:
            SIM[name] = ast.literal_eval(value)
        else:
            sys.exit(f"--set {name}: no such rule. Rules: {', '.join(rules)}")
    return rules


def save_baseline(runs, rules, games, score_tiers, floor_tiers):
    version = re.search(r'^const VERSION = "([^"]+)"', read_script(), re.M).group(1)
    base = {
        "version": version,
        "games_per_mode": games,
        "rules": rules,
        "sim": SIM,
        "score_tiers": score_tiers,
        "floor_tiers": floor_tiers,
        "modes": {m: brief(r) | {"reach": reach(r, score_tiers, floor_tiers)} for m, r in runs.items()},
    }
    BASELINE.write_text(json.dumps(base, indent=1))
    return version


def main():
    cmd, opts = parse_args(sys.argv[1:])
    if cmd not in ("run", "compare", "ship", "baseline"):
        sys.exit(__doc__)
    rules = apply_sets(opts["set"])
    mismatches = js_mismatches(rules)
    if mismatches and cmd in ("ship", "baseline"):
        sys.exit("simulate.py and script.js disagree, fix that first:\n  " + "\n  ".join(mismatches))
    if mismatches:
        print("Not in script.js yet:\n  " + "\n  ".join(mismatches), file=sys.stderr)
    big = cmd in ("ship", "baseline")
    games = opts["games"] or (6_000_000 if big else 1_000_000)
    modes = [opts["mode"]] if opts["mode"] and not big else ["hand", "auto"]
    runs = {}
    for mode in modes:
        runs[mode] = simulate(rules, mode, games, opts["workers"], opts["seed"])
        print(f"{mode}: {runs[mode]['games']:,} games in {runs[mode]['seconds']}s", file=sys.stderr)

    if cmd == "run":
        print(json.dumps({m: brief(r) for m, r in runs.items()}, indent=1))
    elif cmd == "compare":
        if not BASELINE.exists():
            sys.exit("No tools/baseline.json yet: run `python tools/simulate.py baseline` on the live rules first")
        print(report(json.loads(BASELINE.read_text()), runs, rules))
    elif cmd == "baseline":
        src = read_script()
        version = save_baseline(runs, rules, games, js_const(src, "SCORE_TIERS"), js_const(src, "FLOOR_TIERS"))
        print(json.dumps({m: brief(r) for m, r in runs.items()}, indent=1))
        print(f"\ntools/baseline.json is now {version} (script.js untouched)", file=sys.stderr)
    elif cmd == "ship":
        hand = runs["hand"]
        out = {"method": f"Monte Carlo, {hand['games']:,} hand-rolled games"} | brief(hand) | {"curve_log10": hand["curve_log10"]}
        out["auto"] = brief(runs["auto"])
        RESULTS.write_text(json.dumps(out, indent=1))
        tables = ship_tables(hand)
        version = save_baseline(runs, rules, games, tables["SCORE_TIERS"], tables["FLOOR_TIERS"])
        print(json.dumps({m: brief(r) for m, r in runs.items()}, indent=1))
        print(f"\nscript.js tables updated, tools/baseline.json is now {version}", file=sys.stderr)


if __name__ == "__main__":
    main()
