# Dicele: The Infinite Casino Tower

A retro pixel dice game in plain HTML, CSS and JavaScript. No build step, no dependencies.

**Play:** https://dicele.shoep.ch/ &middot; one game every 8 hours (rumor has it the logo hides a secret door)

## How to play

1. **Wheel of Wealth.** Tap STOP. The number is your multiplier; 100 spins again and adds up.
2. **Tap your dice.** 5 red dice to start. Every 6 = one floor up and another round. No 6 at all = game over.
3. **Every 5 floors** the elevator hands you another red die.
4. **Yazzy:** most of your dice showing the same number (5 of 5 &hellip; 5 of 10, then 6 of 11, 7 of 12, &hellip;).
   One short? The odd die gets a slow-motion chance: 1/6 + wheel luck.
   - 1s unlock rerolling 1s, 2s the green 1&ndash;5 die for 2s, 3s the end-game sacrifice, 4s the d4 shelf
   - 5s: **Silver Jackpot**, the multiplier doubles
   - 6s: **Gold Jackpot**, a golden d10 joins the table and adds its roll to the multiplier every round
   - Perfect yazzy (every die the same): one more red die
5. **Last chance:** no 6? The last die is rerolled in slow motion: 1/6 + (100 &minus; wheel) &divide; 10 %.
6. **Casino Manager:** from 10 dice a bad d20 (it rolls itself), one more per 5 dice. A 1 destroys a die (from floor 25 one more losing face every 18 floors); a 20 confiscates a bonus.
7. **Score = chips &times; multiplier**, plus an end die d(total sixes) on the multiplier. Beat 1/2 of it (rounded up) and you play one more round; each later end die needs 2/3, 3/4, 4/5, &hellip; The end screen ranks you against 12 million simulated games.

Buttons: 🏆 leaderboard (this device), ? rules, ⚡ flashy animations (off by default), ♪ sound, ⏩ insta-autoroll.

## Balance

With the Casino Manager arriving at 10 dice, about 1 hand-rolled game in 53 breaks past it and snowballs practically forever (auto-rolled games about 1 in 2,300). That rate is tuned with `BAD_FROM_DICE`, `LOSE_FACES_FROM_FLOOR` and `LOSE_FACE_STEP` in `script.js`.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | Pixel casino look and all animations |
| `script.js` | Game rules, sound (Web Audio), effects |
| `tools/simulate.py` | Parallel Monte Carlo of the rules; writes `tools/sim_results.json` |
| `tools/sim_results.json` | Source of the tiers, percentiles and end-screen curve in `script.js` |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

## Run locally

```bash
python -m http.server 8123
```

## Rebalancing

After changing a rule (in `script.js` and `tools/simulate.py`), rerun the simulation and copy its tables into `script.js`:

```bash
python tools/simulate.py 12000000
```
