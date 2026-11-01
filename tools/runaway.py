"""How long Dicele games last, computed exactly (no simulated games).

A Markov chain over (floor, red dice) using the exact round outcomes from exact.py
(chips left out, so it runs in minutes). Reports how many games are still going at each
floor milestone; games still going at TOP are "practically endless".

    python tools/runaway.py [luck=0.05] [TOP=300]
"""
import sys
from math import comb
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import exact  # noqa: E402

LUCK = float(sys.argv[1]) if len(sys.argv) > 1 else 0.05
TOP = int(sys.argv[2]) if len(sys.argv) > 2 else 300
MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300]

marg = {}


def k_dd(n):
    """{(sixes, dice change): prob} for a table of n, from the exact round model."""
    if n not in marg:
        out = {}
        for (k, _g, dd), p in exact.round_outcomes(n, LUCK).items():
            out[(k, dd)] = out.get((k, dd), 0) + p
        marg[n] = out
    return marg[n]


def loss(n, floor):
    b = exact.bad_dice_for(n)
    h = exact.lose_faces(floor) / 20
    return [comb(b, j) * h**j * (1 - h) ** (b - j) for j in range(b + 1)]


alive = {(0, exact.BASE_DICE): 1.0}
reached = {m: 0.0 for m in MILESTONES}
ended = 0.0
endless = 0.0
for rnd in range(20000):
    nxt = {}
    for (f, n), pr in alive.items():
        for (k, dd), pk in k_dd(n).items():
            w = pr * pk
            if w < 1e-21:
                continue
            if k == 0:
                ended += w
                continue
            f2 = f + k
            for m in MILESTONES:
                if f < m <= f2:
                    reached[m] += w
            if f2 >= TOP:
                endless += w
                continue
            gained = f2 // 5 - f // 5
            for j, pj in enumerate(loss(n + dd, f)):
                if pj < 1e-21:
                    continue
                key = (f2, max(1, n + dd + gained - j))
                nxt[key] = nxt.get(key, 0) + w * pj
    alive = {k: v for k, v in nxt.items() if v > 1e-19}
    if not alive:
        break
print(f"luck {LUCK}: ended {ended:.6f}, still going at floor {TOP}: {endless + sum(alive.values()):.3e}")
for m in MILESTONES:
    r = reached[m]
    print(f"  reach floor {m:>3}: {r:.3e}" + (f"  (1 in {1 / r:,.0f})" if r > 0 else ""))
