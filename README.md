# Dicele: The Infinite Casino Tower

A retro pixel dice game in plain HTML, CSS and JavaScript. No build step, no dependencies.

**Play:** https://play.dicele.io/ &middot; one game every 8 hours (rumor has it the logo hides a secret door)

## How to play

1. **Wheel of Wealth.** Tap STOP. The number is your multiplier; 100 spins again and adds up.
2. **Tap your dice.** 5 red dice to start. Every 6 = one floor up and another round. No 6 at all = game over.
3. **Every 5 floors** the elevator hands you another red die.
4. **Yazzy:** most of your dice showing the same number (5 of 5 &hellip; 5 of 10, then 6 of 11, 7 of 12, &hellip;).
   One short? The odd die gets a slow-motion chance: 1/6 + wheel luck. Every yazzy also counts as a 6.
   - 1s unlock rerolling 1s, 2s the green die for 2s (1, 3, 4, 5, 6), 3s the end-game sacrifice, 4s the d4 shelf
   - 5s: **Silver Jackpot**, the multiplier doubles
   - 6s: **Gold Jackpot**, a golden d10 joins the table and adds its roll to the multiplier every round
   - Perfect yazzy (every die the same): one more red die
5. **Last chance:** no 6? The last die is rerolled in slow motion: 1/6 + (100 &minus; wheel) &divide; 10 %.
6. **Casino Manager:** from 10 dice a bad d20 (it rolls itself and never leaves), one more per 5 dice. A 1 destroys a die (one more losing face every 100 floors); a 20 confiscates a bonus.
7. **Score = chips &times; multiplier**, plus an end die d(total sixes) on the multiplier (one more end die per 10 floors). Beat 1/2 of it (rounded up) and you play one more round; each later end die needs 2/3, 3/4, 4/5, &hellip; The end screen ranks you against 12 million simulated games.

Buttons: 🏆 leaderboard (this device), ? rules, ⚡ flashy animations (off by default), ♪ sound, ⏩ insta-autoroll.

## Balance

With the Casino Manager arriving at 10 dice, about 1 hand-rolled game in 4 breaks past it and snowballs practically forever (auto-rolled games about 1 in 21). That rate is tuned with `BAD_FROM_DICE`, `BAD_EVERY_DICE` and `LOSE_FACE_STEP` in `script.js`.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | Pixel casino look and all animations |
| `script.js` | Game rules, sound (Web Audio), effects |
| `tools/simulate.py` | Monte Carlo of the rules: every rule number in one `RULES` table, compares rule changes with the live game |
| `tools/baseline.json` | What players play right now: the live rules and their measured odds |
| `tools/sim_results.json` | Source of the tiers, percentiles and end-screen curve in `script.js` |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

## Run locally

```bash
python -m http.server 8123
```

## Rebalancing

Every rule number lives in `RULES` at the top of `tools/simulate.py`, named like the constant in `script.js`; new mechanics go in its `play_game()`. Before shipping a change, see what it does to the game players are playing now:

```bash
python tools/simulate.py compare --set LOSE_FACE_STEP=50
```

That plays a million games per mode (about 20 seconds) and lists, against `tools/baseline.json`, how many games never end, how scores and floors move, and how many games reach each of today's ranks. Anything within noise says so. `--set` tries a number without editing; edit `RULES` or `play_game()` for anything bigger.

When the change goes live, make it in `script.js` too, bump `VERSION`, then:

```bash
python tools/simulate.py ship
```

It refuses if `RULES` and `script.js` disagree, writes the new stats tables into `script.js`, and makes the new rules the baseline.
