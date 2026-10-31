# Dicele: The Infinite Casino Tower

A retro pixel dice game in plain HTML, CSS and JavaScript. No build step, no dependencies.

**Play:** https://rompascalegger.github.io/Dicele/

## How to play

1. **Spin the d100 wheel.** The result is your multiplier. Landing on 100 spins again and adds up.
2. **Roll 6 red dice.** Every 6 climbs one floor of the tower and you roll again.
3. **Every 5 floors** the elevator hands you another red die (up to 10).
4. **No sixes?** The game ends, unless the superbonus die shows up. Its chance is (100 − wheel) ÷ 10 %, and a 6 keeps you climbing.
5. **End die:** roll a d(total sixes) and add it to the multiplier.
6. **Score = chips × multiplier.** The game-over card ranks it against 200,000 simulated games.

Extras: combos (three/four/five/six of a kind, a 1–6 straight), random casino events, tappable falling dice (gold ones add +5 multi), and six-of-a-kind mayhem.

Buttons: ♪ sound, ⚡ flashy animations (off by default: no screen flashes or strobing), ⏩ insta-autoroll.

## Files

| File | What it is |
|---|---|
| `index.html` | Page structure |
| `style.css` | Pixel casino look and all animations |
| `script.js` | Game rules, sound (Web Audio), effects |
| `tools/simulate.py` | Monte Carlo of the rules; the tier colors and score ranking in `script.js` come from it |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is |

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8123
```

## Publish on GitHub Pages

The repository must be **public** (on a free GitHub plan). Then go to **Settings → Pages → Build and deployment**, set **Source** to **Deploy from a branch**, choose `main` and `/ (root)`, and click **Save**. The site appears at `https://<user>.github.io/Dicele/` about a minute later.

## Rebalancing

After changing any rule, rerun the simulation and paste its numbers into `SCORE_TIERS`, `FLOOR_TIERS` and `SCORE_PERCENTILES` in `script.js`:

```bash
python tools/simulate.py 200000 10
```
