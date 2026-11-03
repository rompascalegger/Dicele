# Dicele: The Infinite Casino Tower

A retro pixel dice game in plain HTML, CSS and JavaScript. No build step, no dependencies.

**Play:** https://play.dicele.io/ &middot; one game every 8 hours (rumor has it the logo hides a secret door)

## How to play

1. **Wheel of Wealth.** Tap STOP. The number is your multiplier; 100 spins again and adds up.
2. **Tap your dice.** 5 red dice to start. Every 6 = one floor up and another round. No 6 at all = game over.
3. **Every 5 floors** the elevator hands you another red die.
4. **Yazzy:** most of your dice showing the same number (5 of 5 &hellip; 5 of 10, then 6 of 11, 7 of 12, &hellip;; at least 4 of a kind, so no yazzy with 3 dice or fewer).
   One short? The odd die gets a slow-motion chance: 1/6 + wheel luck. Every yazzy also counts as a 6.
   - 1s unlock rerolling 1s, 2s the green die for 2s (1, 3, 4, 5, 6), 3s the end-game sacrifice, 4s the d4 shelf
   - 5s: **Silver Jackpot**, the multiplier doubles
   - 6s: **Gold Jackpot**, a golden d10 joins the table and adds its roll to the multiplier every round
   - Perfect yazzy (every die the same): one more red die
5. **Last chance:** no 6? The last die is rerolled in slow motion: 1/6 + (100 &minus; wheel) &divide; 10 %.
6. **Casino Manager:** bad d20s at floor 10 and 25, then one more every 15 floors, 8 at most (they roll themselves and never leave). A 1 destroys a red die (1&ndash;2 from floor 50); a 20 confiscates a bonus. The Casino CEO comes at floor 75 and 125 and leaves a bad d100 each time: a 1 destroys a fifth of your red dice. At floor 500 the President brings the Nuke die, a d500 that ends the game on a 1 and loses a face for every floor climbed and gains one for every red die lost. No red dice left is game over.
7. **Score = chips &times; multiplier.** Every round pays +10 chips per floor. At the end, end dice d(total sixes) go on the multiplier: 1 from floor 1, 2 from floor 10, one more at floor 25, 50, 100, 150, 200, 250, 300 and 350 (10 at most); end die k counts k times. Every end die can buy one more round: die 1 beats 1/2 of its sides, die 2 beats 2/3, &hellip;, and every visit raises all bars one step. The end screen ranks you against 6 million simulated games.

Buttons: 🏆 leaderboard (this device), ? rules, ⚡ flashy animations (off by default), ♪ sound, ⏩ insta-autoroll.

## Balance

Every game ends, but there is no wall: the danger stops growing at floor 125, so the deep runs spread out into a long tail instead of all dying at the same floor, and the President's Nuke die ends almost anything that reaches floor 500 before floor 1000. Tuned with `BAD_MAX_DICE`, `LOSE_FACES_MAX`, `CEO_MAX_DICE` and `PRESIDENT_FLOOR` in `script.js`.

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
