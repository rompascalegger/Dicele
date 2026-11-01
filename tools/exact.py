"""Exact score distribution of Dicele (the equivalent of infinitely many games).

No simulated games: the game is solved as a Markov chain over (floor, red dice, chips),
round by round, until less than 1e-14 of the probability is still playing. The tables in
script.js (SCORE_PERCENTILES, tiers, the end-screen curve) come from this.

    python tools/exact.py            # writes tools/exact_results.json

Rules modelled (must match script.js), with the insta-autoroll choices:
  * Wheel of Wealth: d100, 100 spins again and adds. Assumed uniform (no timing skill).
  * 5 red dice at the start, +1 every 5 floors. One six = one floor.
  * A 1 is rerolled once (up to 10 dice); a 2 is rerolled once with a green 1-5 die (up to
    15 dice); a 4 adds a bonus d4 to the chips (up to 25 dice).
  * Five or more of the same number: one more red die at once (rolled this round, kept).
  * At least 40% fives ("silver") rerolls the whole table, taken only when there is no 6.
  * No 6: last chance, the last die is rerolled: a 6 with 1/6 + (100 - wheel) / 10 %,
    otherwise 1-5.
  * Still no 6: every 3 is sacrificed (destroyed for good) and the other dice are rerolled;
    repeats while new 3s show up and other dice remain.
  * From 10 red dice one bad d20, +1 per 5 more dice. A bad d20 destroys a red die on a 1;
    from floor 50 one more losing face every 25 floors.
  * Score = chips x multiplier. Chips: pips + combos + d4s + round bonus 10(R-1) + events
    + 666 for six or more sixes. Multiplier: wheel + event multis + d(total sixes).

Where it is not exact (none of it moves a percentile visibly):
  * Chips live in log-spaced bins 3% wide, split between neighbours; gains are rounded to
    0.4% and bonus d4s count their average (2.5).
  * Wheel results are grouped in tens for the luck chance only (exact for the multi).
  * Event multipliers are treated as independent of event chips in the same round.
  * A silver reroll is treated as a fresh round of the same table (ignoring a five-of-a-kind
    die already handed out in it); rounds above 25 dice use 400,000 sampled rounds.
  * Games still running at floor TRACK_TOP are reported as "practically endless".
  * Falling golden dice are skill, not chance, and are left out.
"""
import json
import math
import os
import time
from functools import lru_cache
from itertools import combinations_with_replacement
from math import comb, factorial
from pathlib import Path

import numpy as np

BASE_DICE = 5
FLOORS_PER_DIE = 5
REROLL_ONES_MAX_DICE = 10
GREEN_TWOS_MAX_DICE = 15
D4_FOURS_MAX_DICE = 25
# Balance knobs can be overridden from the environment to try variants
FIVE_KIND_MAX_DICE = int(os.environ.get("FIVE_KIND_MAX_DICE", 10**6))
BAD_FROM_DICE = 10
BAD_EVERY_DICE = int(os.environ.get("BAD_EVERY_DICE", 5))
LOSE_FACES_FROM_FLOOR = int(os.environ.get("LOSE_FACES_FROM_FLOOR", 25))
LOSE_FACE_STEP = int(os.environ.get("LOSE_FACE_STEP", 18))
TRACK_TOP = 300
BONUS_STEP = 10
EVENT_CHANCE = 0.2
# Chips part of the ten random events (the other three add multiplier instead)
EVENT_CHIPS = [15, -5, 0, 25, 10, 0, 0, 7, 1, 0]
EVENT_MULTI = [0, 0, 3, 0, 0, 1, 0, 0, 0, 2]
EXACT_UP_TO_DICE = 25

RATIO = 1.03
DELTA = math.log(RATIO)
B = int(math.ceil(math.log(1e9) / DELTA)) + 2  # chip bins from 1 to a billion
CENTERS = np.exp(np.arange(B) * DELTA)
S = TRACK_TOP + 1
RNG = np.random.default_rng(1)


def bad_dice_for(n):
    return 0 if n < BAD_FROM_DICE else 1 + (n - BAD_FROM_DICE) // BAD_EVERY_DICE


def lose_faces(floor):
    if floor < LOSE_FACES_FROM_FLOOR:
        return 1
    return min(19, 2 + (floor - LOSE_FACES_FROM_FLOOR) // LOSE_FACE_STEP)


def die_odds(n):
    """Final value distribution of one red die on a table of n, after its free reroll."""
    if n <= REROLL_ONES_MAX_DICE:  # 1 -> d6 again, 2 -> green d5
        a, b = 1 / 36, 1 / 30
        return [0, a + b, a + b, 1 / 6 + a + b, 1 / 6 + a + b, 1 / 6 + a + b, 1 / 6 + a]
    if n <= GREEN_TWOS_MAX_DICE:  # only the green die for 2s
        b = 1 / 30
        return [0, 1 / 6 + b, b, 1 / 6 + b, 1 / 6 + b, 1 / 6 + b, 1 / 6]
    return [0] + [1 / 6] * 6


def gains_vec(counts, n):
    """Chips gained for an (N, 7) array of value counts on a table of n."""
    c = counts[:, 1:]
    g = (c * np.arange(1, 7)).sum(axis=1).astype(float)
    g += np.where(c >= 6, 500 + (c - 6) * 250, np.where(c == 5, 200, np.where(c == 4, 80, np.where(c == 3, 30, 0)))).sum(axis=1)
    g += np.where((c >= 1).all(axis=1), 100, 0) + np.where(counts[:, 6] >= 6, 666, 0)
    if n <= D4_FOURS_MAX_DICE:
        g += 2.5 * counts[:, 4]
    return g


def collect(ks, gs, ds, ws, out=None):
    """Sum weights per (sixes, gain, dice change). Gains rounded to 0.4% (bins are 3%)."""
    out = {} if out is None else out
    step = np.maximum(1, np.round(np.abs(gs) * 0.004))
    gs = np.round(gs / step) * step
    for k, g, d, w in zip(ks.tolist(), gs.tolist(), ds.tolist(), ws.tolist()):
        key = (k, g, d)
        out[key] = out.get(key, 0) + w
    return out


def multisets(n, odds):
    """All value-count rows for n dice with their probabilities (sampled above 25 dice)."""
    if n <= EXACT_UP_TO_DICE:
        rows, probs = [], []
        for combo in combinations_with_replacement(range(1, 7), n):
            counts = [0] * 7
            for v in combo:
                counts[v] += 1
            prob = factorial(n)
            for v in range(1, 7):
                prob = prob / factorial(counts[v]) * odds[v] ** counts[v]
            rows.append(counts)
            probs.append(prob)
        return np.array(rows), np.array(probs)
    counts = RNG.multinomial(n, odds[1:], size=400_000)
    counts = np.concatenate([np.zeros((len(counts), 1), dtype=int), counts], axis=1)
    return counts, np.full(len(counts), 1 / len(counts))


@lru_cache(maxsize=None)
def sacrifice_chain(m):
    """m plain dice rerolled after a sacrifice: {(sixes, gain, -lost): prob}. If no six,
    any new 3s are sacrificed again while other dice remain."""
    counts, probs = multisets(m, [0] + [1 / 6] * 6)
    out = {}
    has6 = counts[:, 6] > 0
    collect(counts[has6, 6], gains_vec(counts[has6], m), np.zeros(has6.sum(), dtype=int), probs[has6], out)
    c3 = counts[:, 3]
    again = ~has6 & (c3 >= 1) & (m - c3 >= 1)
    end = ~has6 & ~again
    collect(np.zeros(end.sum(), dtype=int), gains_vec(counts[end], m), np.zeros(end.sum(), dtype=int), probs[end], out)
    for lost in np.unique(c3[again]):
        w = probs[again & (c3 == lost)].sum()
        for (k, g, d), pr in sacrifice_chain(int(m - lost)).items():
            key = (k, g, d - int(lost))
            out[key] = out.get(key, 0) + w * pr
    return out


def after_last_chance_miss(counts, probs, n, out):
    """Rounds still without a 6 after the last chance: sacrifice the 3s, or the game ends."""
    c3 = counts[:, 3]
    size = counts[:, 1:].sum(axis=1)
    again = (c3 >= 1) & (size - c3 >= 1)
    end = ~again
    collect(np.zeros(end.sum(), dtype=int), gains_vec(counts[end], n), counts[end, 0], probs[end], out)
    # Group identical (size, threes, bonus die) so each chain is folded in once
    groups = {}
    for i in np.nonzero(again)[0]:
        key = (int(size[i]), int(c3[i]), int(counts[i, 0]))
        groups[key] = groups.get(key, 0) + probs[i]
    for (sz, lost, dd0), w in groups.items():
        for (k, g, d), pr in sacrifice_chain(sz - lost).items():
            key = (k, g, dd0 + d - lost)
            out[key] = out.get(key, 0) + w * pr
    return out


_parts = {}


def round_parts(n):
    """Luck-independent pieces of a round on a table of n red dice: (rounds with a six,
    no-six rounds whose last-chance die hit a 6, no-six rounds whose last-chance die missed,
    already through the 3-sacrifice and averaged over the five misses). Keys are
    (sixes, gain, dice change). Column 0 of the count rows carries the dice change
    (+1 for a five-of-a-kind bonus die)."""
    if n in _parts:
        return _parts[n]
    counts, probs = multisets(n, die_odds(n))
    counts = counts.copy()
    # Five of a kind: one more die, rolled right away and kept
    five = (counts[:, 1:].max(axis=1) >= 5) & (n <= FIVE_KIND_MAX_DICE)
    extra_odds = die_odds(n + 1)
    rows, ws = [counts[~five]], [probs[~five]]
    for w in range(1, 7):
        t = counts[five].copy()
        t[:, w] += 1
        t[:, 0] = 1
        rows.append(t)
        ws.append(probs[five] * extra_odds[w])
    counts = np.concatenate(rows)
    probs = np.concatenate(ws)
    size = counts[:, 1:].sum(axis=1)
    # Silver reroll when there is no 6: a fresh round with the same distribution
    silver = (counts[:, 6] == 0) & (5 * counts[:, 5] >= 2 * size)
    probs = np.where(silver, 0, probs) / (1 - probs[silver].sum())
    keep = ~silver
    has6 = keep & (counts[:, 6] > 0)
    rest = collect(counts[has6, 6], gains_vec(counts[has6], n), counts[has6, 0], probs[has6])
    zero = keep & (counts[:, 6] == 0)
    # Last chance: the last die (any of them, all alike) showing v is rerolled
    hit_rows, hit_w, miss_rows, miss_w = [], [], [], []
    zc, zp, zs = counts[zero], probs[zero], size[zero]
    for v in range(1, 6):
        sel = zc[:, v] > 0
        base = zp[sel] * zc[sel, v] / zs[sel]
        t = zc[sel].copy()
        t[:, v] -= 1
        h = t.copy()
        h[:, 6] += 1
        hit_rows.append(h)
        hit_w.append(base)
        for w in range(1, 6):
            mrow = t.copy()
            mrow[:, w] += 1
            miss_rows.append(mrow)
            miss_w.append(base / 5)
    hits = np.concatenate(hit_rows)
    tipped = collect(hits[:, 6], gains_vec(hits, n), hits[:, 0], np.concatenate(hit_w))
    missed = after_last_chance_miss(np.concatenate(miss_rows), np.concatenate(miss_w), n, {})
    _parts[n] = (rest, tipped, missed)
    return _parts[n]


def round_outcomes(n, p):
    """(sixes, chips gained incl. events, dice change) -> probability, for luck p."""
    rest, tipped, missed = round_parts(n)
    hit = 1 / 6 + p
    out = dict(rest)
    for key, w in tipped.items():
        out[key] = out.get(key, 0) + w * hit
    for key, w in missed.items():
        out[key] = out.get(key, 0) + w * (1 - hit)
    event = {0: 1 - EVENT_CHANCE}
    for chips in EVENT_CHIPS:
        event[chips] = event.get(chips, 0) + EVENT_CHANCE / len(EVENT_CHIPS)
    final = {}
    for (k, g, dd), prob in out.items():
        for dg, pe in event.items():
            key = (k, g + dg, dd)
            final[key] = final.get(key, 0) + prob * pe
    return final


def interp_index(values):
    """Split mass at `values` between the two neighbouring log bins."""
    x = np.log(np.maximum(values, 1.0)) / DELTA
    lo = np.clip(np.floor(x).astype(int), 0, B - 2)
    frac = np.clip(x - lo, 0, 1)
    return lo, frac


def transfer_matrices(n, p):
    """{(k, dice change): T} mapping a chip histogram through one round, plus the same
    as plain histograms for the first round (which starts at zero chips)."""
    by = {}
    for (k, g, dd), prob in round_outcomes(n, p).items():
        by.setdefault((k, dd), []).append((g, prob))
    rows = np.arange(B)
    T, first = {}, {}
    for key, items in by.items():
        if sum(pr for _, pr in items) < 1e-17:
            continue
        gs = np.array([g for g, _ in items])
        ps = np.array([pr for _, pr in items])
        M = np.zeros((B, B))
        lo, frac = interp_index(CENTERS[:, None] + gs[None, :])
        np.add.at(M, (np.repeat(rows, len(gs)), lo.ravel()), (ps[None, :] * (1 - frac)).ravel())
        np.add.at(M, (np.repeat(rows, len(gs)), (lo + 1).ravel()), (ps[None, :] * frac).ravel())
        f = np.zeros(B)
        l0, f0 = interp_index(np.maximum(gs, 1.0))
        np.add.at(f, l0, ps * (1 - f0))
        np.add.at(f, l0 + 1, ps * f0)
        T[key] = M
        first[key] = f
    return T, first


def shift_matrix(amount):
    lo, frac = interp_index(CENTERS + amount)
    M = np.zeros((B, B))
    rows = np.arange(B)
    M[rows, lo] += 1 - frac
    M[rows, lo + 1] += frac
    return M


# Rounds are grouped for the event-multiplier part of the final multiplier
R_GROUPS = [(1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 8), (9, 12), (13, 20), (21, 35), (36, 60), (61, 120), (121, 10**9)]


def r_group(r):
    for i, (a, b) in enumerate(R_GROUPS):
        if a <= r <= b:
            return i
    return len(R_GROUPS) - 1


def solve_bucket(p):
    """Chip histograms of finished games by (round group, floor), for luck p."""
    ends = np.zeros((len(R_GROUPS), S, B))
    endless = [0.0]
    cache = {}

    def mats(n):
        if n not in cache:
            cache[n] = transfer_matrices(n, p)
        return cache[n]

    def loss_dist(n, s):
        b = bad_dice_for(n)
        hit = lose_faces(s) / 20
        return [comb(b, j) * hit**j * (1 - hit) ** (b - j) for j in range(b + 1)]

    def advance(s, n, k, dd, hist, rnd):
        if k == 0:
            ends[r_group(rnd), s] += hist
            return
        s2 = s + k
        if s2 >= TRACK_TOP:
            endless[0] += hist.sum()
            return
        gained = s2 // FLOORS_PER_DIE - s // FLOORS_PER_DIE
        for j, pj in enumerate(loss_dist(n + dd, s)):
            if pj < 1e-18:
                continue
            key = (s2, max(1, n + dd + gained - j))
            nxt[key] = nxt[key] + hist * pj if key in nxt else hist * pj

    nxt = {}
    _, first = mats(BASE_DICE)
    for (k, dd), f in first.items():
        advance(0, BASE_DICE, k, dd, f, 1)
    alive = nxt

    rnd = 1
    while alive and sum(h.sum() for h in alive.values()) > 1e-14:
        rnd += 1
        shift = shift_matrix(BONUS_STEP * (rnd - 1))
        nxt = {}
        by_n = {}
        for (s, n), h in alive.items():
            if h.sum() > 1e-19:
                by_n.setdefault(n, []).append((s, h))
        for n, items in by_n.items():
            T, _ = mats(n)
            H = np.stack([h for _, h in items]) @ shift
            for (k, dd), Tk in T.items():
                R = H @ Tk
                for (s, _), row in zip(items, R):
                    advance(s, n, k, dd, row, rnd)
        alive = nxt
        if rnd > 5000:
            endless[0] += sum(h.sum() for h in alive.values())
            break
    return ends, rnd, endless[0]


def event_multi_dist(rounds):
    one = np.zeros(4)
    one[0] = 1 - EVENT_CHANCE
    for m in EVENT_MULTI:
        one[m] += EVENT_CHANCE / len(EVENT_MULTI)
    dist = np.array([1.0])
    for _ in range(rounds):
        dist = np.convolve(dist, one)
    return dist


def wheel_buckets():
    """(luck p, {wheel value: prob}). 100 spins again, so W >= 100 has no extra luck."""
    buckets = []
    for start in range(1, 100, 10):
        ws = range(start, min(start + 10, 100))
        mean_w = sum(ws) / len(ws)
        buckets.append(((100 - mean_w) / 1000, {w: 0.01 for w in ws}))
    high = {}
    for w in range(1, 100):
        high[100 + w] = 0.01 * 0.01
        high[200 + w] = 0.01**3
    high[300] = 0.01**3
    buckets.append((0.0, high))
    return buckets


def to_log_hist(values, probs, size):
    hist = np.zeros(size)
    lo, frac = interp_index(np.asarray(values, dtype=float))
    np.add.at(hist, lo, np.asarray(probs) * (1 - frac))
    np.add.at(hist, lo + 1, np.asarray(probs) * frac)
    return hist


def main():
    t0 = time.time()
    score_hist = np.zeros(2 * B - 1)
    floor_dist = np.zeros(S)
    rounds_used = 0
    endless_total = 0.0
    em_by_group = []
    for a, b in R_GROUPS:
        rep = a if b - a < 3 else int(round((a + min(b, 200)) / 2))
        em_by_group.append(event_multi_dist(rep))

    for p, wheel in wheel_buckets():
        bucket_mass = sum(wheel.values())
        ends, rounds, endless = solve_bucket(p)
        rounds_used = max(rounds_used, rounds)
        endless_total += endless * bucket_mass
        floor_dist += ends.sum(axis=(0, 2)) * bucket_mass
        w_arr = np.zeros(max(wheel) + 1)
        for w, prob in wheel.items():
            w_arr[w] = prob / bucket_mass
        for g in range(len(R_GROUPS)):
            we = np.convolve(w_arr, em_by_group[g])
            for s in range(S):
                chips = ends[g, s]
                if chips.sum() < 1e-22:
                    continue
                d_arr = np.concatenate([[0.0], np.full(s, 1 / s)]) if s else np.array([1.0])
                mult = np.convolve(we, d_arr)
                vals = np.nonzero(mult > 1e-20)[0]
                m_hist = to_log_hist(vals, mult[vals], B)
                score_hist += np.convolve(chips * bucket_mass, m_hist)
        print(f"luck {p:.4f} done, {rounds} rounds, endless {endless:.2e}, {time.time() - t0:.0f}s", flush=True)

    total = score_hist.sum()
    print(f"finished games {total:.12f} + practically endless {endless_total:.3e} (should add to 1)")
    score_hist /= total
    centers = np.exp(np.arange(2 * B - 1) * DELTA)
    cdf = np.cumsum(score_hist)

    def quantile(q):
        i = int(np.searchsorted(cdf, q))
        return float(centers[min(i, len(centers) - 1)])

    pct_points = [0, 0.1, 1, 5, 10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 93, 95, 97, 98, 99,
                  99.5, 99.8, 99.9, 99.95, 99.99, 99.999, 99.9999, 99.99999, 99.999999, 99.9999999]
    percentiles = [[pc, round(quantile(pc / 100))] for pc in pct_points]
    mean = float((score_hist * centers).sum())

    floor_dist /= floor_dist.sum()
    floor_cdf = np.cumsum(floor_dist)
    floor_pct = {pc: int(np.searchsorted(floor_cdf, pc / 100)) for pc in [20, 40, 50, 60, 75, 85, 90, 93, 95, 97, 99, 99.9, 99.99, 99.9999]}

    # Density over log10(score) for the end-screen curve: 128 points, lightly smoothed
    log10c = np.log10(centers)
    lo10, hi10 = 1.0, math.log10(quantile(1 - 1e-6))
    grid = np.linspace(lo10, hi10, 128)
    width = (hi10 - lo10) / 127
    density = np.array([score_hist[(log10c >= x - width / 2) & (log10c < x + width / 2)].sum() for x in grid])
    density = np.convolve(density, np.array([1, 2, 3, 2, 1]) / 9, mode="same")
    density /= density.max()
    curve = [[round(float(x), 3), round(float(d), 4)] for x, d in zip(grid, density)]

    results = {
        "method": "exact Markov chain over the dice probabilities (no simulated games)",
        "rounds_solved": rounds_used,
        "mean_score": round(mean),
        "median_score": round(quantile(0.5)),
        "score_percentiles": percentiles,
        "one_in_a_billion_score": round(quantile(1 - 1e-9)),
        "floor_percentiles": floor_pct,
        "floor_mean": float((floor_dist * np.arange(S)).sum()),
        "share_no_six_at_all": float(floor_dist[0]),
        "practically_endless": endless_total,
        "practically_endless_one_in": round(1 / endless_total) if endless_total > 0 else None,
        "curve_log10": curve,
        "seconds": round(time.time() - t0),
    }
    out = Path(__file__).with_name("exact_results.json")
    out.write_text(json.dumps(results, indent=1))
    print(json.dumps({k: v for k, v in results.items() if k != "curve_log10"}, indent=1))


if __name__ == "__main__":
    main()
