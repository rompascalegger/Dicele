const $ = (id) => document.getElementById(id);

const tray = $("tray");
const rollBtn = $("roll");
const pipsEl = $("pips");
const roundEl = $("round");
const scoreEl = $("score");
const bestEl = $("best");
const messageEl = $("message");
const toastEl = $("toast");
const jokeEl = $("joke");
const floorLabelEl = $("floor-label");
const topFloorEl = $("top-floor");
const multEl = $("mult");
const multValueEl = $("mult-value");
const logEl = $("log");
const driftEl = $("drift");
const muteBtn = $("mute");
const wheelOverlay = $("wheel-overlay");
const wheelCanvas = $("wheel");
const wheelResultEl = $("wheel-result");
const wheelTitleEl = $("wheel-title");
const pointerEl = $("pointer");

const VERSION = "2.0.8";

// Ten tiers, from boring to legendary: label, player title, end-screen verdict, color
const TIERS = [
  // Colors match the names: plain grey, metals, gems, then VIP purple, elite crimson and a
  // legendary blaze (which also gets the rainbow shimmer)
  { name: "STANDARD", title: "Lifesavings Better", verdict: "Rent Is Due", color: "#9a8fa8" },
  { name: "BRONZE", title: "Casual Gambler", verdict: "Professional Button Masher", color: "#a9744a" },
  { name: "SILVER", title: "Weekend High Roller", verdict: "The Occasional Bad Decision", color: "#d4dae3" },
  { name: "GOLD", title: "The Risk Addict", verdict: "The ATM's Biggest Fan", color: "#ffcf4a" },
  { name: "EMERALD", title: "Silver Stake Player", verdict: "Financially Unsupervised", color: "#2ee87a" },
  { name: "PLATINUM", title: "Gold Table Regular", verdict: "The House's Favorite Charity", color: "#a9d6ff" },
  { name: "DIAMOND", title: "Diamond High Roller", verdict: "Certified Bad Decision Maker", color: "#5ff4ff" },
  { name: "VIP", title: "Millionaire Maverick", verdict: "Tax Bracket Speedrunner", color: "#b45cff" },
  { name: "ELITE", title: "Billionaire Elite", verdict: "Bankruptcy? Never Heard of Her", color: "#ff2f5b" },
  { name: "LEGENDARY", title: "Trillion Connoisseur", verdict: "Just an Ordinary Trillionaire", color: "#ff8a1f" },
];
// Final scores at or above these reach the matching tier. From 12,000,000 simulated
// hand-rolled games (tools/simulate.py, MANUAL=1): bottom 20% Standard, then the
// 40/60/75/85/93/97/99/99.9th percentiles
const SCORE_TIERS = [0, 12000, 36000, 110000, 460000, 3000000, 15000000, 35000000, 70000000, 290000000];
// Same idea for floors
const FLOOR_TIERS = [1, 10, 19, 37, 90, 183, 229, 263, 294, 299];
// Score percentiles [percent of games, score], used to rank each result
const SCORE_PERCENTILES = [[0, 0], [0.1, 72], [1, 483], [5, 2259], [10, 5256], [20, 12084], [30, 21535], [40, 35820], [50, 60318], [60, 109917], [70, 250396], [75, 461646], [80, 1047378], [85, 3001608], [90, 8363490], [93, 14751600], [95, 21979026], [97, 34575483], [98, 45880320], [99, 69723464], [99.5, 104654736], [99.8, 184290786], [99.9, 292293376], [99.95, 472662456], [99.99, 1572284412], [99.999, 10232316848], [100, 225971289020]];
// [percent of games, floors reached], for the end screen
const FLOOR_PERCENTILES = [[20, 6], [40, 10], [50, 14], [60, 19], [75, 37], [85, 90], [90, 150], [93, 183], [95, 204], [97, 229], [99, 263], [99.9, 294], [99.99, 299]];
// End-screen curve: [log10(score), share of games relative to the peak]
const SCORE_CURVE = [[1.0, 0.0006], [1.071, 0.001], [1.142, 0.0012], [1.213, 0.0014], [1.284, 0.0015], [1.355, 0.0018], [1.426, 0.0021], [1.497, 0.0027], [1.568, 0.0033], [1.639, 0.0038], [1.709, 0.0046], [1.78, 0.0054], [1.851, 0.0063], [1.922, 0.0077], [1.993, 0.0092], [2.064, 0.0111], [2.135, 0.0138], [2.206, 0.0168], [2.277, 0.0205], [2.348, 0.0253], [2.419, 0.0308], [2.49, 0.038], [2.561, 0.0467], [2.632, 0.0569], [2.703, 0.0695], [2.774, 0.0843], [2.845, 0.1016], [2.916, 0.1199], [2.986, 0.1364], [3.057, 0.1489], [3.128, 0.1576], [3.199, 0.1652], [3.27, 0.1775], [3.341, 0.1991], [3.412, 0.2305], [3.483, 0.2701], [3.554, 0.3156], [3.625, 0.3664], [3.696, 0.4227], [3.767, 0.4856], [3.838, 0.5537], [3.909, 0.6226], [3.98, 0.6898], [4.051, 0.7544], [4.122, 0.8139], [4.193, 0.8684], [4.263, 0.917], [4.334, 0.9559], [4.405, 0.9838], [4.476, 0.9991], [4.547, 1.0], [4.618, 0.9882], [4.689, 0.9654], [4.76, 0.9341], [4.831, 0.8969], [4.902, 0.8548], [4.973, 0.8085], [5.044, 0.7578], [5.115, 0.704], [5.186, 0.6485], [5.257, 0.5936], [5.328, 0.5421], [5.399, 0.495], [5.47, 0.4535], [5.54, 0.4178], [5.611, 0.387], [5.682, 0.3607], [5.753, 0.3377], [5.824, 0.3175], [5.895, 0.2995], [5.966, 0.2837], [6.037, 0.2698], [6.108, 0.2582], [6.179, 0.2488], [6.25, 0.2419], [6.321, 0.2374], [6.392, 0.2353], [6.463, 0.2355], [6.534, 0.2378], [6.605, 0.2421], [6.676, 0.2475], [6.747, 0.2536], [6.817, 0.2594], [6.888, 0.2642], [6.959, 0.2674], [7.03, 0.2683], [7.101, 0.2668], [7.172, 0.2626], [7.243, 0.2558], [7.314, 0.2463], [7.385, 0.234], [7.456, 0.2187], [7.527, 0.1998], [7.598, 0.1779], [7.669, 0.1535], [7.74, 0.1282], [7.811, 0.1036], [7.882, 0.0812], [7.953, 0.0622], [8.024, 0.0469], [8.094, 0.0352], [8.165, 0.0264], [8.236, 0.0199], [8.307, 0.0151], [8.378, 0.0115], [8.449, 0.0088], [8.52, 0.0068], [8.591, 0.0053], [8.662, 0.0041], [8.733, 0.0032], [8.804, 0.0025], [8.875, 0.002], [8.946, 0.0016], [9.017, 0.0012], [9.088, 0.001], [9.159, 0.0008], [9.23, 0.0006], [9.301, 0.0005], [9.371, 0.0004], [9.442, 0.0003], [9.513, 0.0003], [9.584, 0.0002], [9.655, 0.0002], [9.726, 0.0001], [9.797, 0.0001], [9.868, 0.0001], [9.939, 0.0001], [10.01, 0.0]];

const multTier = (m) => Math.min(9, Math.floor((m - 1) / 10));
// Highest tier whose threshold is reached (no findLastIndex: it crashes older iPhones)
const tierFor = (thresholds, value) => thresholds.reduce((tier, t, i) => (value >= t ? i : tier), 0);
const floorTier = (f) => tierFor(FLOOR_TIERS, f);
const scoreTier = (s) => tierFor(SCORE_TIERS, s);

function paintTier(el, tier) {
  el.style.setProperty("--tc", TIERS[tier].color);
  el.classList.toggle("jackpot", tier === 9);
}

const BASE_DICE = 5;
// Every this many floors the elevator hands you one more red die (no upper limit)
const FLOORS_PER_DIE = 5;
// From 10 dice the Casino Manager adds a bad d20, plus one more per 5 extra dice (15, 20, ...).
// A bad d20 costs you a die for good on a 1. From floor 25 one more face loses every 18
// floors: 1-2 from 25, 1-3 from 43, 1-4 from 61, ...
const BAD_FROM_DICE = 10;
const BAD_EVERY_DICE = 5;
const LOSE_FACES_FROM_FLOOR = 25;
const LOSE_FACE_STEP = 18;
const badDiceFor = (n) => (n < BAD_FROM_DICE ? 0 : 1 + Math.floor((n - BAD_FROM_DICE) / BAD_EVERY_DICE));
const badLosesOn = () =>
  floor < LOSE_FACES_FROM_FLOOR ? 1 : Math.min(19, 2 + Math.floor((floor - LOSE_FACES_FROM_FLOOR) / LOSE_FACE_STEP));
// Each extra round is worth this much more than the last: +10, +20, +30...
const BONUS_STEP = 10;
// Golden drifting dice add this to the multiplier
const GOLDEN_MULT = 5;
// Pixel height of one tower floor in the background (matches style.css)
const FLOOR_HEIGHT = 120;

// Cube rotation (x, y) that brings each face to the front
const FACE_ROTATION = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
};

const SIX_LINES = [
  "> six! the pit boss is sweating",
  "> going up! the elevator guy salutes you",
  "> a six! a slot machine fainted",
  "> the high rollers are watching",
  "> six detected. climb, legend",
  "> security is 'just checking' on you",
  "> a cocktail waitress started a fan club",
  "> the penthouse smells your luck",
];
const MISS_LINES = [
  "> no sixes. the house always wins",
  "> the croupier yawned at you",
  "> a slot machine laughed. out loud.",
  "> no six. grandma at table 3 saw everything",
  "> the elevator music got sadder",
  "> the dealer offers you a free mint",
  "> a pigeon on the roof stole your luck",
  "> skill issue (casino-certified)",
];
const JOKES = [
  "the house always wins. the house is also on fire.",
  "our ATMs accept tears",
  "free buffet* (*the buffet is one grape)",
  "the elevator has a minimum bet",
  "floor 13 is a slot machine that judges you",
  "dress code: lucky socks only",
  "the dealer is three raccoons in a vest",
  "no clocks. no windows. no exits. enjoy!",
  "tipping the dice is encouraged",
  "the penthouse is just a rumor",
  "comp drinks: tap water with a tiny umbrella",
  "the roulette wheel is just vibing",
  "our pit boss is a literal pit",
  "strict no-math policy on all floors",
  "loyalty program: we forget you instantly",
  "lost & found: mostly hope",
  "the valet parked your car on floor 40",
  "card counting is fine. we can't count either.",
];
const LOW_MULT_LINES = ["> x1... even the doorman pities you", "> a tiny multiplier for a tiny bet"];
const HIGH_MULT_LINES = ["> THE HOUSE IS IN DANGER", "> multiplier go brrrr", "> the d100 has chosen you"];
const DROP_LINES = ["> elevator plummets to the lobby...", "> back to the lobby. mind the doors", "> *elevator music intensifies*"];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rollTime = reducedMotion ? 400 : 1300;

// idle: waiting for a new turn, again: a 6 was rolled, busy: animating
let phase = "idle";
let mult = 1;
let round = 0;
let pips = 0;
// Every six this game; the end die is a d(totalSixes)
let totalSixes = 0;
// Red dice per round: 6, plus one for every 5 floors climbed
let diceCount = BASE_DICE;
let best = load("dicele-best");
// Floors climbed this turn: one per six rolled
let floor = 0;
// What the d100 wheel rolled, before bonus dice or events add to it
let wheelMult = 0;
// The superbonus die can show up at most once per turn
let superUsed = false;
// Sound is on by default; new key so earlier mutes don't carry over
let muted = load("dicele-sound-off") === 1;
let topFloor = load("dicele-top-floor");
bestEl.textContent = best;
topFloorEl.textContent = topFloor;
paintTier(bestEl, scoreTier(best));

// Rotating casino jokes in the footer
let jokeIndex = Math.floor(Math.random() * JOKES.length);
function nextJoke() {
  jokeEl.textContent = "♠ " + JOKES[jokeIndex++ % JOKES.length] + " ♠";
  jokeEl.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], {
    duration: 400,
    easing: "steps(4)",
  });
}
nextJoke();
setInterval(nextJoke, 7000);

muteBtn.classList.toggle("off", muted);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// animation.settled: like .finished, but also resolves after the animation's duration
// even if the browser paused it (background tab, hidden pane), so the game never stalls.
// Guarded: on browsers without the Animation interface this must not crash the page
if (window.Animation && !("settled" in Animation.prototype)) {
  Object.defineProperty(Animation.prototype, "settled", {
    get() {
      let ms = 0;
      try {
        ms = Number(this.effect.getTiming().duration) || 0;
      } catch {
        ms = 1000;
      }
      return Promise.race([this.finished ? this.finished.catch(() => {}) : wait(ms), wait(ms + 150)]);
    },
  });
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const d = (sides) => 1 + Math.floor(Math.random() * sides);

function load(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable; values just won't persist
  }
}

/* ---------- 8-bit sound ---------- */

let audioCtx = null;
let master = null;
let reverb = null;

// Lazily creates the audio graph: everything -> compressor (keeps stacked fanfares from
// clipping), with a send into a generated concert-hall reverb for the epic stuff
function audio() {
  if (muted) return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
    master = audioCtx.createDynamicsCompressor();
    master.threshold.value = -18;
    master.ratio.value = 6;
    master.connect(audioCtx.destination);

    // Impulse response: 3s of stereo noise with an exponential tail
    const len = Math.floor(audioCtx.sampleRate * 3);
    const ir = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverb = audioCtx.createConvolver();
    reverb.buffer = ir;
    reverb.connect(master);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function send(node, wet) {
  if (!wet) return;
  const g = audioCtx.createGain();
  g.gain.value = wet;
  node.connect(g).connect(reverb);
}

// Browsers only allow audio after a user gesture, so unlock it on the first one
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => audio(), { once: true });
}

function sfx(freq, dur, { type = "square", vol = 0.04, to = null, delay = 0, attack = 0, wet = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  // Every six this game nudges all sound up half a semitone (max one octave)
  const pitch = Math.pow(2, Math.min(totalSixes * 0.5, 12) / 12);
  osc.type = type;
  osc.frequency.setValueAtTime(freq * pitch, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to * pitch, t + dur);
  if (attack) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
  } else {
    gain.gain.setValueAtTime(vol, t);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  send(gain, wet);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// White noise through a filter: snares, cymbals (high-pass) or thumps (lp set: low-pass).
// attack > 0 swells in, which makes a reverse cymbal
function noise(dur, { vol = 0.1, delay = 0, hp = 1000, lp = 0, attack = 0, wet = 0 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = lp ? "lowpass" : "highpass";
  filter.frequency.value = lp || hp;
  const gain = ac.createGain();
  if (attack) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.05));
  } else {
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  src.connect(filter).connect(gain).connect(master);
  send(gain, wet);
  src.start(t);
}

/* ---------- Epic orchestra (all synthesized) ---------- */

const semis = (root, s) => root * Math.pow(2, s / 12);

// Brass: two detuned saws through a low-pass that opens up like a horn blat
function brass(freq, dur, { vol = 0.05, delay = 0, wet = 0.3 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const pitch = Math.pow(2, Math.min(totalSixes * 0.5, 12) / 12);
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(3200, t + 0.08);
  filter.frequency.exponentialRampToValueAtTime(1100, t + Math.min(dur, 0.6));
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.04);
  gain.gain.setValueAtTime(vol, t + dur * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  filter.connect(gain).connect(master);
  send(gain, wet);
  for (const cents of [-8, 8]) {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq * pitch;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

const brassChord = (root, chord, dur, delay, vol = 0.035) =>
  chord.forEach((s) => brass(semis(root, s), dur, { vol, delay }));

// Timpani: a sine that drops onto its pitch, plus a felt-mallet thump, drenched in hall
function timpani(freq, { vol = 0.35, delay = 0 } = {}) {
  sfx(freq * 1.5, 1.4, { type: "sine", vol, to: freq, delay, wet: 0.5 });
  sfx(freq * 2.01, 0.6, { type: "sine", vol: vol * 0.25, to: freq * 2, delay, wet: 0.4 });
  noise(0.12, { vol: vol * 0.5, delay, lp: 600, wet: 0.3 });
}

// Sub boom: a huge low drop you feel more than hear
function boom(delay = 0) {
  sfx(70, 1.8, { type: "sine", vol: 0.6, to: 28, delay, wet: 0.2 });
  noise(0.6, { vol: 0.3, delay, lp: 200, wet: 0.4 });
}

// Choir: soft detuned triangles fading in, mostly reverb
function choir(root, chord, dur, delay = 0) {
  for (const s of chord) {
    for (const d of [0.996, 1, 1.004]) {
      sfx(semis(root, s) * d, dur, { type: "triangle", vol: 0.018, delay, attack: dur * 0.35, wet: 0.7 });
    }
  }
}

// Reverse cymbal: noise swelling into the downbeat
const swell = (dur, delay = 0) => noise(dur, { vol: 0.2, delay, hp: 3000, attack: dur * 0.95, wet: 0.3 });

// Victory fanfare: longer and fuller the higher the tier (0-9)
function victory(tier) {
  const root = semis(196, Math.min(tier, 9)); // G3, rising a semitone per tier
  boom(0);
  timpani(semis(root, -12), { delay: 0 });
  // I - IV - V - I, brass stabs on each, timpani under
  const progression = [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [12, 16, 19, 24]];
  const chords = tier < 3 ? 2 : 4;
  for (let i = 0; i < chords; i++) {
    const at = 0.15 + i * 0.42;
    const last = i === chords - 1;
    brassChord(root, progression[last ? 3 : i], last ? 2.4 : 0.38, at);
    timpani(semis(root, progression[i][0] - 12), { delay: at, vol: 0.25 });
  }
  if (tier >= 3) choir(root, [12, 16, 19, 24], 3.2, 0.5);
  if (tier >= 6) {
    noise(2.6, { vol: 0.16, delay: 0.15 + (chords - 1) * 0.42, hp: 5000, wet: 0.5 });
    // Trumpet flourish up top
    [24, 28, 31, 36].forEach((s, i) => brass(semis(root, s), 0.18, { vol: 0.03, delay: 0.1 + i * 0.07 }));
  }
  if (tier >= 9) {
    // Key change and one more enormous chord
    const up = semis(root, 2);
    brassChord(up, [0, 4, 7, 12, 16], 3, 2.2, 0.04);
    timpani(semis(up, -12), { delay: 2.2, vol: 0.4 });
    boom(2.2);
    choir(up, [12, 16, 19, 24, 28], 3, 2.2);
  }
}

const arp = (notes, step, opts) => notes.forEach((f, i) => sfx(f, 0.14, { ...opts, delay: i * step }));
const kick = (delay) => sfx(150, 0.35, { type: "sine", vol: 0.5, to: 40, delay });
const snare = (delay, vol = 0.12) => noise(0.15, { vol, delay, hp: 1800 });

// A fanfare that gets bigger with every six: more layers, higher key, longer
function fanfare(sixes) {
  const n = Math.min(6, sixes);
  const root = 261.63 * Math.pow(2, ((n - 1) * 2) / 12);
  const note = (semi) => root * Math.pow(2, semi / 12);

  // 1+: brass arpeggio
  arp([note(0), note(4), note(7), note(12)], 0.07, { vol: 0.07 });
  sfx(note(12), 0.6, { vol: 0.05, delay: 0.28 });

  if (n >= 2) {
    // Bass drop and a kick
    sfx(note(-12), 0.9, { type: "sawtooth", vol: 0.09, to: note(-24) });
    kick(0);
    kick(0.28);
  }
  if (n >= 3) {
    // Snare roll into a held power chord
    for (let i = 0; i < 8; i++) snare(i * 0.035, 0.05 + i * 0.012);
    for (const s of [0, 7, 12]) sfx(note(s), 1.3, { type: "sawtooth", vol: 0.03, delay: 0.3, attack: 0.05 });
  }
  if (n >= 4) {
    // Sparkle run up two octaves and a crash cymbal
    const run = [0, 4, 7, 12, 16, 19, 24, 28];
    run.forEach((s, i) => sfx(note(s + 12), 0.1, { type: "triangle", vol: 0.04, delay: 0.3 + i * 0.04 }));
    noise(1.4, { vol: 0.12, delay: 0.3, hp: 6000 });
  }
  if (n >= 5) {
    // Choir: detuned sine stack walking IV -> V -> I
    [[5, 9, 12], [7, 11, 14], [12, 16, 19]].forEach((chord, ci) => {
      for (const s of chord) {
        for (const detune of [0.997, 1.003]) {
          sfx(note(s) * detune, 0.7, { type: "sine", vol: 0.04, delay: 0.6 + ci * 0.4, attack: 0.08 });
        }
      }
      kick(0.6 + ci * 0.4);
      snare(0.8 + ci * 0.4);
    });
  }
  if (n >= 6) {
    // Riser, drum fill and one enormous final chord
    sfx(110, 1.8, { type: "sawtooth", vol: 0.05, to: 1760, delay: 0.2 });
    for (let i = 0; i < 16; i++) snare(1.8 + i * 0.05, 0.06 + i * 0.008);
    for (const s of [-12, 0, 4, 7, 12, 16, 19, 24]) {
      sfx(note(s), 2.4, { type: "sawtooth", vol: 0.035, delay: 2.6, attack: 0.02 });
    }
    kick(2.6);
    noise(2.4, { vol: 0.18, delay: 2.6, hp: 4000 });
  }
}

// Suspense before the final multiplier: rising drone, quickening heartbeat, snare roll
function tension(dur) {
  sfx(55, dur, { type: "sawtooth", vol: 0.07, to: 110, attack: 0.4 });
  sfx(82.4, dur, { type: "sawtooth", vol: 0.04, to: 165, attack: 0.4 });
  sfx(1760, dur, { type: "sine", vol: 0.015, to: 2200, attack: dur * 0.8 });
  let gap = 0.55;
  for (let t = 0; t < dur - 0.1; t += gap, gap = Math.max(0.18, gap * 0.82)) {
    kick(t);
    kick(t + 0.11);
  }
  const rollStart = dur * 0.3;
  const hits = Math.floor((dur - rollStart) / 0.04);
  for (let i = 0; i < hits; i++) snare(rollStart + i * 0.04, 0.03 + (i / hits) * 0.14);
}

// The payoff: crash, kick and a big major chord
function reveal(tier) {
  kick(0);
  noise(2.2, { vol: 0.22, hp: 3500 });
  const root = 220 * Math.pow(2, tier / 12);
  for (const s of [0, 4, 7, 12, 16, 19]) {
    sfx(root * Math.pow(2, s / 12), 1.6, { type: "sawtooth", vol: 0.03, attack: 0.01 });
  }
  arp([root * 4, root * 5, root * 6, root * 8], 0.06, { type: "triangle", vol: 0.05 });
}

const SOUND = {
  tick: () => sfx(900 + Math.random() * 500, 0.03, { vol: 0.025 }),
  clack: () => sfx(180 + Math.random() * 140, 0.06, { type: "triangle", vol: 0.07 }),
  land: () => sfx(150, 0.12, { type: "triangle", vol: 0.1, to: 60 }),
  floorDing: (i) => sfx(1046 + i * 120, 0.25, { type: "triangle", vol: 0.06, delay: i * 0.12 }),
  combo: () => arp([523, 659, 784, 1047, 1319], 0.06),
  mult: () => arp([392, 523, 659, 784], 0.05, { vol: 0.05 }),
  pop: () => sfx(400, 0.12, { to: 1200, vol: 0.05 }),
  blub: () => sfx(700, 0.15, { type: "sine", to: 180, vol: 0.07 }),
  score: () => sfx(200, 0.7, { to: 1800, vol: 0.035 }),
  sad: () => arp([392, 330, 262], 0.15, { type: "triangle", vol: 0.06 }),
};

muteBtn.addEventListener("click", () => {
  muted = !muted;
  save("dicele-sound-off", muted ? 1 : 0);
  muteBtn.classList.toggle("off", muted);
  SOUND.pop();
});

/* ---------- Dice ---------- */

// Pips are drawn by a CSS mask (.v1-.v6 in style.css), so a face is a single element
function fillFace(face, n) {
  face.classList.remove("v1", "v2", "v3", "v4", "v5", "v6");
  face.classList.add(`v${n}`);
}

// Every die on the table this round (red dice and bad d20s)
let roundDice = [];

// Per-game statistics for the end screen
let stats = {};
function resetStats() {
  stats = {
    rolls: 0, sixes: 0, expectedSixes: 0, lastChances: 0, lucky: 0, sacrificed: 0, struck: 0, d4: 0,
    bonusDice: 0, maxDice: BASE_DICE, combos: 0, silver: 0,
    // Hand-roller perks: lost once any die was rolled automatically this game
    autoUsed: false, handRetryUsed: false,
    // The end die's bonus round, once per game
    extraRoundUsed: false,
  };
}

// Hand-rollers' second chance: the losing round is laid out again, once per game
async function handRetry() {
  silverUsed = false;
  silverLeft = 0;
  showToast("HAND-ROLLER'S\nSECOND CHANCE", 4);
  setMessage("> you rolled it all by hand. the house respects that: roll the round again", true);
  arp([392, 523, 659, 784, 1047], 0.08, { type: "triangle", vol: 0.06, wet: 0.4 });
  await wait(reducedMotion ? 400 : 1400);
  for (const o of roundDice) {
    if (o.gone) continue;
    o.value = null;
    o.held = false;
    if (o.kind === "red") {
      o.rerolled = false;
      o.slot.classList.remove("landed", "six", "silver", "one", "two", "green", "rolling", "lucky", "sacrificable");
      delete o.slot.dataset.value;
      o.slot.classList.add("waiting");
      o.slot.querySelector(".die-badge").textContent = "";
    } else {
      o.slot.classList.remove("safe", "struck", "done");
      o.slot.classList.add("waiting");
      o.slot.querySelector(".bd-value").textContent = "?";
    }
  }
  phase = "rolling";
  setButton("rolling");
  rollBtn.disabled = false;
  updateHint();
  autoRollBad();
}
resetStats();

function createDie() {
  const slot = document.createElement("div");
  slot.className = "slot waiting";
  slot.innerHTML = '<div class="shadow"></div><div class="toss"><div class="die"></div></div><span class="die-badge"></span>';
  const die = slot.querySelector(".die");
  for (let n = 1; n <= 6; n++) {
    const face = document.createElement("div");
    face.className = `face f${n}`;
    fillFace(face, n);
    die.appendChild(face);
  }
  // Random resting orientation so every die tumbles differently
  const obj = { kind: "red", slot, die, value: null, rerolled: false, rolling: false, rx: Math.random() * 360, ry: Math.random() * 360 };
  die.style.transform = `rotateX(${obj.rx}deg) rotateY(${obj.ry}deg)`;
  slot.addEventListener("click", () => tapDie(obj, true));
  tray.appendChild(slot);
  return obj;
}

// The Casino Manager's bad d20: a 1 costs you a die for good
function createBadDie() {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "bad-die waiting";
  slot.innerHTML = '<span class="bd-value">?</span><span class="bd-label">BAD d20</span>';
  const obj = { kind: "bad", slot, value: null, rolling: false };
  slot.addEventListener("click", () => tapDie(obj, true));
  tray.appendChild(slot);
  return obj;
}

// Smallest angle >= from that shows the same face as target
const nearestAbove = (from, target) => target + 360 * Math.ceil((from - target) / 360);
/* ---------- Yazzy: most of your dice showing the same number ---------- */

// Number bonuses are locked until you roll a yazzy of that number. The Casino Manager can
// confiscate them again (a bad d20 showing 20)
const unlocked = { 1: false, 2: false, 3: false, 4: false };
const BONUS_NAMES = { 1: "REROLL 1s", 2: "GREEN DIE FOR 2s", 3: "SACRIFICE 3s", 4: "d4 SHELF" };
const canRerollOnes = () => unlocked[1];
const canRerollTwos = () => unlocked[2];
const canSacrifice = () => unlocked[3];
// The golden d10 from a Gold Jackpot: stays on the table, its roll adds to the multiplier
let goldD10 = false;
// Permanent little d4s: each rolls every round and adds to the chips
let shelfD4 = 0;

// Dice needed for a yazzy: 5 of 5 up to 5 of 10, then 6 of 11, 7 of 12, ...
const yazzyNeed = (n) => Math.min(n, Math.max(5, n - 5));

function renderBonusBar() {
  const bar = $("bonus-bar");
  const items = [1, 2, 3, 4].map(
    (v) => `<span class="bonus-chip v${v} ${unlocked[v] ? "on" : ""}" title="${BONUS_NAMES[v]}">${v}<small>${unlocked[v] ? "✓" : "\u{1F512}"}</small></span>`
  );
  items.push(`<span class="bonus-chip gold ${goldD10 ? "on" : ""}" title="Golden d10">d10<small>${goldD10 ? "✓" : "\u{1F512}"}</small></span>`);
  items.push(`<span class="bonus-chip shelf ${shelfD4 ? "on" : ""}" title="d4 shelf">d4<small>×${shelfD4}</small></span>`);
  bar.innerHTML = items.join("");
}

// Slow motion: a die lifts, spins, teeters on the target face and either lands on it
// (chance in %) or not. missValue: the face it falls on otherwise (null = keeps its value)
async function slowMoChance(obj, target, chance, missValue) {
  const tipped = Math.random() < chance / 100;
  const { slot, die } = obj;
  tray.classList.add("spotlight");
  slot.classList.add("last");
  const slow = rollTime * 1.8;
  slot.style.setProperty("--roll-time", `${slow}ms`);
  die.style.transition = `transform ${slow}ms cubic-bezier(.1, .6, .2, 1)`;
  const [tx, ty] = FACE_ROTATION[target];
  const aimX = nearestAbove(obj.rx, tx) + 720;
  const aimY = nearestAbove(obj.ry, ty) + 720;
  slot.classList.remove("rolling", "landed", "one", "two", "silver", "six");
  void slot.offsetWidth;
  slot.classList.add("rolling");
  die.style.transform = `rotateX(${aimX - 38}deg) rotateY(${aimY}deg)`;
  SOUND.clack();
  tension(slow / 1000 + 1);
  await wait(slow);
  const teeter = reducedMotion ? 300 : 1200;
  slot.querySelector(".toss").animate(
    [{ transform: "rotate(0)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(0)" }],
    { duration: teeter / 2, iterations: 2, easing: "ease-in-out" }
  );
  await wait(teeter);
  die.style.transition = "transform 380ms cubic-bezier(.5, 0, .8, .4)";
  if (tipped) {
    obj.value = target;
    obj.rx = aimX;
    obj.ry = aimY;
  } else {
    if (missValue !== null) obj.value = missValue;
    const [fx, fy] = FACE_ROTATION[obj.value];
    obj.rx = nearestAbove(aimX - 38, fx);
    obj.ry = nearestAbove(aimY, fy);
  }
  die.style.transform = `rotateX(${obj.rx}deg) rotateY(${obj.ry}deg)`;
  await wait(400);
  SOUND.land();
  shakeTray();
  die.style.transition = "";
  slot.style.removeProperty("--roll-time");
  tray.classList.remove("spotlight");
  slot.classList.remove("last");
  markDie(obj);
  if (tipped) {
    slot.classList.add("lucky");
    const { x, y } = centerOf(slot);
    burst(x, y, 80);
  } else {
    sfx(330, 0.5, { type: "triangle", vol: 0.06, to: 160 });
  }
  await wait(reducedMotion ? 200 : 500);
  return tipped;
}

// Most common number on the table (ties go to the higher number) and how many show it
function bestCount(red) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const o of red) counts[o.value]++;
  let best = 1;
  for (let v = 1; v <= 6; v++) if (counts[v] >= counts[best]) best = v;
  return [best, counts[best]];
}

// Before scoring: a yazzy pays out; one short of it, an odd die gets a slow-motion chance
async function checkYazzy() {
  const red = roundDice.filter(live);
  const need = yazzyNeed(red.length);
  let [value, count] = bestCount(red);
  if (count === need - 1) {
    // Near miss: the odd die (not a 6 if there's a choice) gets 1/6 + wheel luck
    const odd = red.filter((o) => o.value !== value);
    const die = odd.filter((o) => o.value !== 6).pop() || null;
    if (die) {
      const chance = 100 / 6 + luckChance();
      setMessage(`> ${count} × ${value}... one more for a YAZZY! (${chance.toFixed(1)}%)`, true);
      setHint(`Near yazzy: the odd die gets one slow-motion chance to become a ${value}: 1/6 + your wheel luck.`);
      showToast(`NEAR YAZZY!\n${chance.toFixed(1)}% FOR A ${value}`, 4);
      if (await slowMoChance(die, value, chance, null)) count++;
    }
  }
  if (count >= need) await yazzy(value, count === red.length);
}

async function yazzy(value, perfect) {
  stats.yazzys = (stats.yazzys || 0) + 1;
  const tier = [0, 1, 4, 6, 3, 2, 9][value];
  showToast(`YAZZY!\n${perfect ? "PERFECT " : ""}${value}s`, tier);
  fanfare(4);
  hype(5);
  celebrate();
  setMessage(`> YAZZY of ${value}s!`, true);
  await wait(reducedMotion ? 400 : 1300);

  if (value <= 4) {
    if (!unlocked[value]) {
      unlocked[value] = true;
      showToast(`UNLOCKED\n${BONUS_NAMES[value]}`, tier);
      setMessage(`> ${BONUS_NAMES[value].toLowerCase()} unlocked for the rest of the game`, true);
      arp([523, 659, 784, 1047, 1319, 1568], 0.06, { type: "triangle", vol: 0.06, wet: 0.4 });
    } else {
      const bonus = 100 * value;
      showToast(`ALREADY UNLOCKED\n+${bonus} CHIPS`, tier);
      addPips(bonus);
    }
    renderBonusBar();
    for (const o of roundDice) if (live(o) && o.value !== null) markDie(o);
  } else if (value === 5) {
    mult *= 2;
    setMult(mult);
    await jackpotScene("SILVER JACKPOT", `MULTIPLIER DOUBLED · x${mult}`, "silver");
  } else {
    if (!goldD10) {
      goldD10 = true;
      renderBonusBar();
      await jackpotScene("GOLD JACKPOT", "A GOLDEN d10 JOINS YOUR TABLE FOR GOOD", "gold");
    } else {
      mult += 10;
      setMult(mult);
      await jackpotScene("GOLD JACKPOT", `+10 MULTIPLIER · x${mult}`, "gold");
    }
  }
  await wait(reducedMotion ? 300 : 900);

  if (perfect) {
    // Every single die the same: one more red die, rolled right away and kept
    diceCount++;
    setDiceCount();
    stats.bonusDice++;
    const obj = createDie();
    const firstOther = roundDice.find((o) => o.kind !== "red");
    if (firstOther) tray.insertBefore(obj.slot, firstOther.slot);
    roundDice.splice(roundDice.filter((o) => o.kind === "red").length, 0, obj);
    sizeTray(roundDice.length);
    showToast(`PERFECT YAZZY!\n+1 DIE · NOW ${diceCount}`, 9);
    obj.slot.animate([{ transform: "translateY(-120px) scale(2)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 500,
      easing: "cubic-bezier(.3, 1.4, .5, 1)",
    });
    await rollRed(obj);
  }
}

// Full-screen jackpot: the screen always escalates
async function jackpotScene(title, line, kind) {
  const scene = document.createElement("div");
  scene.className = `jackpot-scene ${kind}`;
  scene.innerHTML = `<div class="jp-rays"></div><p class="jp-title">${title}</p><p class="jp-line">${line}</p>`;
  document.body.appendChild(scene);
  victory(kind === "gold" ? 9 : 6);
  boom(0);
  diceRain(60);
  for (let i = 0; i < 4; i++) setTimeout(celebrate, i * 400);
  document.documentElement.classList.add("mayhem");
  scene.querySelector(".jp-title").animate(
    [{ transform: "scale(4) rotate(-10deg)", opacity: 0 }, { transform: "scale(1)", opacity: 1, offset: 0.4 }, { transform: "scale(1.06)" }, { transform: "scale(1)" }],
    { duration: 1200, easing: "ease-out" }
  );
  await wait(reducedMotion ? 1200 : 3400);
  document.documentElement.classList.remove("mayhem");
  scene.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" });
  await wait(420);
  scene.remove();
}

/* ---------- Golden d10 and the d4 shelf ---------- */

function createGoldDie() {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "gold-die waiting";
  slot.innerHTML = '<span class="bd-value">?</span><span class="bd-label">GOLD d10</span>';
  const obj = { kind: "gold", slot, value: null, rolling: false };
  slot.addEventListener("click", () => tapDie(obj, true));
  tray.appendChild(slot);
  return obj;
}

async function rollGold(obj) {
  obj.rolling = true;
  const { slot } = obj;
  const valueEl = slot.querySelector(".bd-value");
  slot.classList.remove("waiting");
  slot.classList.add("rolling");
  const time = reducedMotion ? 250 : 1000;
  slot.animate(
    [
      { transform: "translateY(0) rotateY(0)" },
      { transform: "translateY(-46px) rotateY(540deg) scale(1.2)", offset: 0.45 },
      { transform: "translateY(0) rotateY(900deg) scale(1.1, .9)", offset: 0.75 },
      { transform: "translateY(0) rotateY(1080deg)" },
    ],
    { duration: time, easing: "cubic-bezier(.3, .7, .4, 1)" }
  );
  let delay = 40;
  for (let t = 0; t < time; t += delay, delay *= 1.15) {
    valueEl.textContent = d(10);
    SOUND.tick();
    await wait(delay);
  }
  const value = d(10);
  valueEl.textContent = value;
  slot.classList.remove("rolling");
  slot.classList.add("done");
  sfx(1046 + value * 50, 0.2, { type: "triangle", vol: 0.06, wet: 0.3 });
  obj.value = value;
  obj.rolling = false;
  return value;
}

// Every d4 on the shelf rolls; returns the total
async function rollShelf() {
  const shelf = $("d4-shelf");
  const items = [...shelf.children];
  let total = 0;
  const time = reducedMotion ? 200 : 750;
  items.forEach((el, i) => {
    const v = d(4);
    total += v;
    const delay = Math.random() * 180;
    // A little hop and tumble, flicking through faces, landing on its roll
    el.animate(
      [
        { transform: "translateY(0) rotate(0)" },
        { transform: "translateY(-16px) rotate(200deg) scale(1.15)", offset: 0.4 },
        { transform: "translateY(0) rotate(330deg) scale(1.1, .9)", offset: 0.75 },
        { transform: "translateY(-4px) rotate(352deg)", offset: 0.88 },
        { transform: "translateY(0) rotate(360deg)" },
      ],
      { duration: time, delay, easing: "cubic-bezier(.3, .7, .4, 1)" }
    );
    let flicks = 0;
    setTimeout(() => {
      const timer = setInterval(() => {
        fillFace(el, ++flicks < 6 ? d(4) : v);
        if (flicks >= 6) {
          clearInterval(timer);
          el.classList.add("landed");
        }
      }, time / 7);
    }, delay);
    el.classList.remove("landed");
    if (i < 6) sfx(900 + Math.random() * 400, 0.05, { type: "triangle", vol: 0.035, delay: (delay + time * 0.75) / 1000 });
  });
  await wait(time + 200);
  return total;
}

function addShelfD4(count) {
  const shelf = $("d4-shelf");
  for (let i = 0; i < count; i++) {
    // A small orange die showing 1-4 pips (same pip masks as the red dice)
    const el = document.createElement("span");
    el.className = "mini shelf-d4";
    fillFace(el, d(4));
    shelf.appendChild(el);
    el.animate([{ transform: "translateY(-60px) rotate(-300deg) scale(.3)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 500,
      delay: i * 80,
      easing: "cubic-bezier(.3, 1.4, .5, 1)",
      fill: "backwards",
    });
  }
  shelfD4 += count;
  renderBonusBar();
}

// A bad d20 showing 20: the manager confiscates one unlocked bonus at random
async function confiscate(count) {
  for (let i = 0; i < count; i++) {
    const owned = [1, 2, 3, 4].filter((v) => unlocked[v]);
    if (!owned.length) {
      showToast("MANAGER FROWNS\nNOTHING TO TAKE", 7);
      await wait(reducedMotion ? 300 : 900);
      return;
    }
    const v = pick(owned);
    unlocked[v] = false;
    stats.confiscated = (stats.confiscated || 0) + 1;
    renderBonusBar();
    showToast(`CONFISCATED!\n${BONUS_NAMES[v]}`, 7);
    setMessage(`> the Casino Manager pockets your ${BONUS_NAMES[v].toLowerCase()}`);
    arp([392, 311, 262], 0.14, { type: "sawtooth", vol: 0.05, wet: 0.3 });
    await wait(reducedMotion ? 400 : 1200);
  }
}

const live = (o) => o.kind === "red" && !o.gone;

// sides 6: a normal roll; sides 5: the green die (1-5 only) used on a 2
// Clutch tap: the last die you tap by hand each round has a secret extra 10% to land on 6
// (1/6 + 10% = 26.7%). A hand-roller's last chance gets 10% on top too
const CLUTCH_SIX_BONUS = 0.1;
const HAND_LAST_CHANCE_BONUS = 10;
async function rollRed(obj, sides = 6, clutch = false) {
  obj.rolling = true;
  obj.slot.classList.remove("clutch");
  const value = clutch && sides === 6 ? (Math.random() < 1 / 6 + CLUTCH_SIX_BONUS ? 6 : d(5)) : d(sides);
  const [fx, fy] = FACE_ROTATION[value];
  obj.rx = nearestAbove(obj.rx, fx) + 360 * (2 + d(2));
  obj.ry = nearestAbove(obj.ry, fy) + 360 * (2 + d(2));
  const { slot, die } = obj;
  slot.classList.remove("waiting", "landed", "six", "silver", "one", "two", "lucky");
  slot.classList.toggle("green", sides === 5);
  delete slot.dataset.value;
  // Restart the toss animation for rerolls
  slot.classList.remove("rolling");
  void slot.offsetWidth;
  slot.classList.add("rolling");
  die.style.transform = `rotateX(${obj.rx}deg) rotateY(${obj.ry}deg)`;
  SOUND.clack();
  await wait(rollTime * 0.45);
  SOUND.land();
  shakeTray();
  await wait(rollTime * 0.55);
  obj.value = value;
  obj.rolling = false;
  stats.rolls++;
  if (sides === 6) stats.expectedSixes += 1 / 6;
  if (value === 6) stats.sixes++;
  markDie(obj);
  return value;
}

// Every number has its own glow; actionable ones get a badge:
// 1 = reroll (cyan), 2 = green d5 (green), 3 = sacrifice (purple, end only), 4 = d4 (orange),
// 5 = silver, 6 = gold
function markDie(obj) {
  const { slot, value } = obj;
  slot.classList.add("landed");
  slot.dataset.value = value;
  slot.classList.toggle("six", value === 6);
  slot.classList.toggle("silver", value === 5);
  const one = value === 1 && !obj.rerolled && canRerollOnes();
  const two = value === 2 && !obj.rerolled && canRerollTwos();
  slot.classList.toggle("one", one);
  slot.classList.toggle("two", two);
  slot.querySelector(".die-badge").textContent = one ? "↻" : two ? "d5" : "";
}

/* ---------- The Casino Manager's bad d20 ---------- */

async function rollBad(obj) {
  obj.rolling = true;
  const { slot } = obj;
  const valueEl = slot.querySelector(".bd-value");
  slot.classList.remove("waiting", "safe", "struck");
  slot.classList.add("rolling");
  // A proper tumble: hops, spins in 3D, numbers flicker past, then it lands
  const time = reducedMotion ? 250 : 1000;
  slot.animate(
    [
      { transform: "translateY(0) rotateX(0) rotateZ(0)" },
      { transform: "translateY(-40px) rotateX(240deg) rotateZ(-90deg)", offset: 0.35 },
      { transform: "translateY(0) rotateX(480deg) rotateZ(-160deg) scale(1.1, .9)", offset: 0.6 },
      { transform: "translateY(-14px) rotateX(620deg) rotateZ(-200deg)", offset: 0.8 },
      { transform: "translateY(0) rotateX(720deg) rotateZ(-180deg)" },
    ],
    { duration: time, easing: "cubic-bezier(.3, .7, .4, 1)" }
  );
  let delay = 40;
  for (let t = 0; t < time; t += delay, delay *= 1.15) {
    valueEl.textContent = d(20);
    SOUND.tick();
    await wait(delay);
  }
  const value = d(20);
  valueEl.textContent = value;
  slot.classList.remove("rolling");
  const struck = value <= badLosesOn();
  slot.classList.add(struck ? "struck" : "safe");
  if (struck) {
    sfx(220, 0.6, { type: "sawtooth", vol: 0.06, to: 90, wet: 0.3 });
    const { x, y } = centerOf(slot);
    floatText(x, y - 30, "-1 DIE!", "oof");
  } else {
    sfx(660, 0.08, { vol: 0.04 });
  }
  obj.value = value;
  obj.rolling = false;
  return value;
}

// A tap on a die: roll it; reroll a 1 (normal die, up to 10 dice) or a 2 (green 1-5 die,
// up to 15 dice), once per die; or, at the very end, sacrifice the 3s
async function tapDie(obj, byHand = false) {
  if (phase === "hold") {
    if (live(obj)) toggleHold(obj);
    return;
  }
  if (phase === "sacrifice" && obj.kind === "red" && obj.value === 3 && !obj.gone) {
    sacrificeThrees();
    return;
  }
  if ((phase !== "rolling" && phase !== "choice") || obj.rolling || obj.gone) return;
  // The Casino Manager rolls his own dice
  if (obj.kind === "bad") return;
  if (obj.value === null) {
    if (!byHand) stats.autoUsed = true;
    // Clutch tap: the last red die of the round, tapped by hand
    const clutch = byHand && obj.kind === "red" && !roundDice.some((o) => live(o) && o !== obj && o.value === null);
    await (obj.kind === "red" ? rollRed(obj, 6, clutch) : rollGold(obj));
  } else if (obj.kind === "red" && !obj.rerolled && ((obj.value === 1 && canRerollOnes()) || (obj.value === 2 && canRerollTwos()))) {
    obj.rerolled = true;
    phase = "rolling";
    setButton("rolling");
    silverBtn.hidden = true;
    if (!byHand) stats.autoUsed = true;
    await rollRed(obj, obj.value === 2 ? 5 : 6);
  } else {
    return;
  }
  afterRoll();
}

function afterRoll() {
  markClutch();
  if (roundDice.some((o) => o.value === null || o.rolling)) {
    updateHint();
    return;
  }
  roundReady();
}

// The last unrolled red die glows gold: that's the clutch tap
function markClutch() {
  const waiting = roundDice.filter((o) => live(o) && o.value === null && !o.rolling);
  for (const o of roundDice) if (o.kind === "red") o.slot.classList.toggle("clutch", !insta && waiting.length === 1 && waiting[0] === o);
}

const rerollable = (o) => live(o) && !o.rerolled && ((o.value === 1 && canRerollOnes()) || (o.value === 2 && canRerollTwos()));

// All dice are down: offer rerolls if any, otherwise score the round
function roundReady() {
  if (phase !== "rolling" && phase !== "choice") return;
  const red = roundDice.filter(live);
  const sixes = red.filter((o) => o.value === 6).length;
  const rerolls = red.filter(rerollable);
  // Silver: at least 40% of the red dice show 5 (2 of 5, 3 of 6, 4 of 10)
  // or rerolls are still left from it this round
  const silver = silverUsed ? silverLeft > 0 : 5 * red.filter((o) => o.value === 5).length >= 2 * red.length;

  if (insta) {
    // Autopilot: reroll every 1 and 2, take the silver reroll only when there's no 6
    if (rerolls.length) {
      rerolls.forEach((o, i) => setTimeout(() => tapDie(o), i * 90));
    } else if (silver && !sixes) {
      autoSilver();
    } else {
      resolveRound();
    }
    return;
  }
  if (!rerolls.length && !silver) {
    resolveRound();
    return;
  }
  phase = "choice";
  setButton("choice");
  silverBtn.hidden = !silver;
  if (silver && silverUsed) silverBtn.innerHTML = `&#9733; SILVER REROLL (${silverLeft} LEFT) &#9733;`;
  if (silver) silverBtn.animate([{ transform: "scale(0)" }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(.3, 1.6, .5, 1)" });
  updateHint();
}

// Enough silver 5s (40%, rounded up): Yahtzee-style rerolls. Tap the dice you want to
// keep (HOLD; sixes are kept automatically), then every unheld red die goes back to "?" and
// is rolled again. Two rerolls a round, so three rolls in all to chase a yazzy
const SILVER_REROLLS = 2;
let silverUsed = false;
let silverLeft = 0;

function enterSilverHold() {
  if (!silverUsed) {
    silverUsed = true;
    silverLeft = SILVER_REROLLS;
    stats.silver++;
    showToast(`SILVER REROLL!
${SILVER_REROLLS} REROLLS · TAP TO KEEP`, 2);
    arp([1318, 1568, 2093, 2637], 0.05, { type: "triangle", vol: 0.05, wet: 0.3 });
  }
  phase = "hold";
  for (const o of roundDice) {
    if (!live(o)) continue;
    // Sixes are saved for you
    if (o.value === 6) o.held = true;
    o.slot.classList.add("holdable");
    o.slot.classList.toggle("held", !!o.held);
    o.slot.querySelector(".die-badge").textContent = o.held ? "HOLD" : "";
  }
  setMessage(`> keep what you like, reroll the rest (${silverLeft} left)`, true);
  updateSilverButtons();
}

function toggleHold(obj) {
  if (obj.value === 6) return;
  obj.held = !obj.held;
  obj.slot.classList.toggle("held", obj.held);
  obj.slot.querySelector(".die-badge").textContent = obj.held ? "HOLD" : "";
  sfx(obj.held ? 880 : 520, 0.06, { type: "triangle", vol: 0.05 });
  updateSilverButtons();
}

function updateSilverButtons() {
  const unheld = roundDice.filter((o) => live(o) && !o.held).length;
  silverBtn.hidden = false;
  silverBtn.innerHTML = `&#8635; REROLL ${unheld} UNHELD (${silverLeft} LEFT) &#8635;`;
  silverBtn.disabled = unheld === 0;
  rollBtn.disabled = false;
  rollBtn.classList.add("again");
  rollBtn.innerHTML = '&#10004; KEEP ALL &amp; CONTINUE &#10004;<span class="auto">tap dice to hold them</span>';
  setHint(`Silver reroll: tap the dice you want to KEEP (they show HOLD, sixes are kept for you), then reroll the ${unheld} others. ${silverLeft} reroll${silverLeft > 1 ? "s" : ""} left this round.`);
}

function leaveSilverHold() {
  for (const o of roundDice) {
    o.slot.classList.remove("holdable", "held");
    if (o.held) o.slot.querySelector(".die-badge").textContent = "";
  }
  silverBtn.hidden = true;
  silverBtn.disabled = false;
  silverBtn.innerHTML = "&#9733; SILVER REROLL &#9733;";
}

// Unheld red dice go back to "?" for a fresh roll (by hand, or insta-autoroll). Holds stay
// for the next reroll
function silverReroll() {
  const unheld = roundDice.filter((o) => live(o) && !o.held);
  silverLeft--;
  leaveSilverHold();
  for (const o of unheld) {
    o.value = null;
    o.rerolled = false;
    o.slot.classList.remove("landed", "six", "silver", "one", "two", "green", "rolling", "lucky");
    delete o.slot.dataset.value;
    o.slot.classList.add("waiting");
    o.slot.querySelector(".die-badge").textContent = "";
  }
  phase = "rolling";
  setButton("rolling");
  updateHint();
  if (insta) autoRollAll();
}

// Insta-autoroll's choice: keep its sixes and its biggest matching group (3+), reroll the rest
function autoSilver() {
  enterSilverHold();
  const red = roundDice.filter(live);
  const [value, count] = bestCount(red);
  for (const o of red) {
    if (!o.held && count >= 3 && o.value === value) toggleHold(o);
  }
  setTimeout(silverReroll, reducedMotion ? 100 : 700);
}

/* ---------- The end: sacrifice every 3 to reroll everything else ---------- */

// Only when the round has no 6 and the last chance failed. Destroys ALL 3s for good and
// rerolls every other red die. Resolves true if that finds a 6 (possibly after repeats)
let sacrificeDone = null;
function offerSacrifice() {
  const red = roundDice.filter(live);
  const threes = red.filter((o) => o.value === 3);
  const others = red.length - threes.length;
  if (!canSacrifice() || !threes.length || !others) return Promise.resolve(false);
  phase = "sacrifice";
  for (const o of threes) {
    o.slot.classList.add("sacrificable");
    o.slot.querySelector(".die-badge").textContent = "☠";
  }
  rollBtn.disabled = false;
  rollBtn.classList.remove("again");
  rollBtn.innerHTML = `&#10007; CASH OUT &#10007;<span class="auto">or tap a 3: sacrifice ${threes.length === 1 ? "it" : "all " + threes.length} to reroll the other ${others}</span>`;
  setMessage(`> game over... unless you sacrifice your 3${threes.length > 1 ? "s" : ""}`, true);
  setHint(`Tap a glowing 3: ALL your 3s are destroyed for good (-${threes.length} ${threes.length > 1 ? "dice" : "die"}) and your other ${others} dice are rerolled. A 6 saves you.`);
  showToast(`SACRIFICE?\n${threes.length} × 3 → REROLL ${others}`, 6);
  arp([196, 185, 175], 0.25, { type: "sawtooth", vol: 0.04, wet: 0.5 });
  return new Promise((resolve) => {
    sacrificeDone = resolve;
    if (insta) setTimeout(sacrificeThrees, 700);
  });
}

function cashOut() {
  for (const o of roundDice) o.slot.classList.remove("sacrificable");
  const done = sacrificeDone;
  sacrificeDone = null;
  phase = "busy";
  rollBtn.disabled = true;
  if (done) done(false);
}

async function sacrificeThrees() {
  if (phase !== "sacrifice") return;
  phase = "busy";
  rollBtn.disabled = true;
  const red = roundDice.filter(live);
  const threes = red.filter((o) => o.value === 3);
  const others = red.filter((o) => o.value !== 3);
  showToast(`SACRIFICE!\n-${threes.length} ${threes.length > 1 ? "DICE" : "DIE"}`, 6);
  // Destroy every 3 for good
  await Promise.all(threes.map((o, i) => wait(i * 200).then(() => destroyDie(o))));
  for (const o of threes) o.gone = true;
  diceCount = Math.max(1, diceCount - threes.length);
  stats.sacrificed += threes.length;
  setDiceCount();
  await wait(reducedMotion ? 100 : 400);
  // Reroll everything else with plain dice
  setMessage("> the others roll again...", true);
  for (const o of others) {
    o.rerolled = true;
    o.slot.classList.remove("sacrificable");
  }
  await Promise.all(others.map((o, i) => wait(i * 110).then(() => rollRed(o))));
  for (const o of others) o.slot.classList.remove("green");
  const done = sacrificeDone;
  sacrificeDone = null;
  if (others.some((o) => o.value === 6)) {
    showToast("SAVED BY SACRIFICE!\nA SIX!", 9);
    victory(4);
    celebrate();
    if (done) done(true);
    return;
  }
  // No 6: new 3s can be sacrificed again
  const again = await offerSacrifice();
  if (done) done(again);
}

// You roll by tapping the dice themselves; the big button only points at the waiting ones
function nudgeDice() {
  const waiting = roundDice.filter((o) => o.value === null && !o.rolling && !o.gone);
  waiting.forEach((o, i) =>
    o.slot.animate([{ transform: "none" }, { transform: "translateY(-14px) scale(1.12)" }, { transform: "none" }], {
      duration: 380,
      delay: i * 60,
      easing: "ease-out",
    })
  );
  setHint("Tap the dice themselves to roll them!");
  sfx(660, 0.06, { vol: 0.04 });
}

function autoRollAll() {
  roundDice
    .filter((o) => o.kind !== "bad" && o.value === null && !o.rolling)
    .forEach((o, i) => setTimeout(() => tapDie(o), (reducedMotion ? 30 : 110) * i));
}

// The bad d20s always roll themselves, shortly after the dice hit the table
function autoRollBad() {
  roundDice
    .filter((o) => o.kind === "bad" && o.value === null && !o.rolling)
    .forEach((o, i) =>
      setTimeout(async () => {
        if (o.value !== null || o.rolling || phase !== "rolling") return;
        await rollBad(o);
        afterRoll();
      }, (reducedMotion ? 100 : 500) + i * 250)
    );
}

// Dice shrink when the table gets crowded
function sizeTray(count) {
  const base = window.innerWidth < 600 ? 50 : 70;
  const size = count <= 7 ? base : Math.max(28, Math.round(base * Math.sqrt(7 / count)));
  tray.style.setProperty("--s", `${size}px`);
}

// Last chance: no 6 this round, so the last die is rerolled in slow motion and teeters on
// the 6. It's a fair 1/6 plus the wheel's luck: (100 - wheel) / 10 %. A miss lands on 1-5
async function lastChance(obj) {
  const luck = luckChance();
  // Hand-rollers get an extra 10% on the last chance
  const chance = 100 / 6 + luck + (stats.autoUsed ? 0 : HAND_LAST_CHANCE_BONUS);
  const tipped = Math.random() < chance / 100;
  stats.lastChances++;
  stats.expectedSixes += chance / 100;
  if (tipped) {
    stats.lucky++;
    stats.sixes++;
  }
  const { slot, die } = obj;
  tray.classList.add("spotlight");
  slot.classList.add("last");
  setMessage(`> no six... LAST CHANCE: ${chance.toFixed(1)}% for a 6`, true);
  setHint(`Last chance: the last die is rerolled. A fair 1/6 (16.7%)${luck ? ` + ${luck.toFixed(1)}% from your Wheel of Wealth` : ""}.`);
  showToast(`LAST CHANCE\n${chance.toFixed(1)}% FOR A 6`, 0);

  // Lift and spin in slow motion, aiming for the 6 face tipped onto an edge
  const slow = rollTime * 1.8;
  slot.style.setProperty("--roll-time", `${slow}ms`);
  die.style.transition = `transform ${slow}ms cubic-bezier(.1, .6, .2, 1)`;
  const sixX = nearestAbove(obj.rx, 0) + 720;
  const sixY = nearestAbove(obj.ry, 180) + 720;
  slot.classList.remove("rolling", "landed", "one", "silver");
  void slot.offsetWidth;
  slot.classList.add("rolling");
  die.style.transform = `rotateX(${sixX - 38}deg) rotateY(${sixY}deg)`;
  SOUND.clack();
  tension(slow / 1000 + 1);
  await wait(slow);

  // Teeter on the edge with a heartbeat
  setMessage("> it's... teetering... on a 6...", true);
  const teeter = reducedMotion ? 300 : 1200;
  slot.querySelector(".toss").animate(
    [{ transform: "rotate(0)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(0)" }],
    { duration: teeter / 2, iterations: 2, easing: "ease-in-out" }
  );
  await wait(teeter);

  // Fall: onto the 6 if luck holds, otherwise onto a fresh 1-5
  die.style.transition = "transform 380ms cubic-bezier(.5, 0, .8, .4)";
  if (tipped) {
    obj.rx = sixX;
    obj.ry = sixY;
    obj.value = 6;
  } else {
    obj.value = d(5);
    const [fx, fy] = FACE_ROTATION[obj.value];
    obj.rx = nearestAbove(sixX - 38, fx);
    obj.ry = nearestAbove(sixY, fy);
  }
  die.style.transform = `rotateX(${obj.rx}deg) rotateY(${obj.ry}deg)`;
  await wait(400);
  SOUND.land();
  shakeTray();
  die.style.transition = "";
  slot.style.removeProperty("--roll-time");
  tray.classList.remove("spotlight");
  slot.classList.remove("last");
  markDie(obj);
  if (tipped) {
    slot.classList.add("lucky");
    showToast("LUCKY TIP!\nIT'S A SIX!", 9);
    victory(5);
    celebrate();
    const { x, y } = centerOf(slot);
    burst(x, y, 80);
  } else {
    sfx(330, 0.5, { type: "triangle", vol: 0.06, to: 160 });
  }
  await wait(reducedMotion ? 200 : 700);
  return tipped;
}

// (100 - Wheel of Wealth) / 10 percent, e.g. 99 -> 0.1%, 1 -> 9.9%; 100+ gives none
function luckChance() {
  return Math.max(0, 100 - wheelMult) / 10;
}

/* ---------- How rare is this score? ---------- */

// Percent of simulated games scoring below `score`, interpolated on a log scale
function scorePercentile(score) {
  const table = SCORE_PERCENTILES;
  if (score <= table[0][1]) return 0;
  if (score >= table[table.length - 1][1]) return 100;
  const i = table.findIndex(([, s]) => s > score);
  const [p0, s0] = table[i - 1];
  const [p1, s1] = table[i];
  const t = Math.log(score / s0) / Math.log(s1 / s0);
  return p0 + (p1 - p0) * t;
}

function formatRank(score) {
  const pct = scorePercentile(score);
  const top = 100 - pct;
  const beats = pct >= 99.99 ? pct.toFixed(4) : pct >= 99.9 ? pct.toFixed(2) : pct.toFixed(1);
  // "1 in N" only means something for scores in the top half
  if (top <= 0) return `beats ${beats}% · off the charts`;
  if (top > 50) return `beats ${beats}% of games`;
  return `beats ${beats}% · only 1 in ${Math.round(100 / top).toLocaleString("en-US")} games score this high`;
}

function scoreCombos(values) {
  const counts = Array(7).fill(0);
  for (const v of values) counts[v]++;
  const combos = [];
  if (counts.slice(1).every((c) => c >= 1)) combos.push({ name: "STRAIGHT TO VEGAS", bonus: 100 });
  for (let n = 1; n <= 6; n++) {
    if (counts[n] >= 6) combos.push({ name: `${counts[n]} OF A KIND?!`, bonus: 500 + (counts[n] - 6) * 250 });
    else if (counts[n] === 5) combos.push({ name: "FIVE OF A KIND", bonus: 200 });
    else if (counts[n] === 4) combos.push({ name: "FOUR OF A KIND", bonus: 80 });
    else if (counts[n] === 3) combos.push({ name: "TRIPLE " + n + "s", bonus: 30 });
  }
  return combos;
}

/* ---------- d100 wheel of fortune ---------- */

const SEG = 360 / 100;
const spinTime = reducedMotion ? 800 : 4800;
const mod = (a, n) => ((a % n) + n) % n;
let wheelRot = 0;

// Draws 100 numbered slots around an inner ring of the 10 tiers
function drawWheel() {
  // Fall back to a computed size if layout hasn't given the canvas a width yet
  const size = wheelCanvas.clientWidth > 50 ? wheelCanvas.clientWidth : Math.min(innerWidth * 0.84, 620);
  const dpr = window.devicePixelRatio || 1;
  wheelCanvas.width = size * dpr;
  wheelCanvas.height = size * dpr;
  const c = wheelCanvas.getContext("2d");
  // The translate part of setTransform is in device pixels, so the centre is size * dpr / 2
  // (using size / 2 put the wheel off-centre on phones, where dpr is 2-3)
  c.setTransform(dpr, 0, 0, dpr, (size * dpr) / 2, (size * dpr) / 2);
  const r = size / 2;
  const rad = (deg) => (deg * Math.PI) / 180;

  for (let v = 1; v <= 100; v++) {
    const tier = multTier(v);
    const start = rad(-90 + (v - 1) * SEG - SEG / 2);
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, r, start, start + rad(SEG));
    c.closePath();
    c.fillStyle = TIERS[tier].color;
    c.fill();
    if (v % 2) {
      c.fillStyle = "rgba(0, 0, 0, .28)";
      c.fill();
    }
  }

  // Inner ring: one band per tier with its name
  for (let t = 0; t < 10; t++) {
    const start = rad(-90 + t * 36 - SEG / 2);
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, r * 0.6, start, start + rad(36));
    c.closePath();
    c.fillStyle = TIERS[t].color;
    c.fill();
    c.fillStyle = "rgba(10, 4, 20, .55)";
    c.fill();
    c.strokeStyle = "#160828";
    c.lineWidth = 2;
    c.stroke();
  }

  c.textAlign = "center";
  c.textBaseline = "middle";
  const numFont = Math.max(9, Math.round(size * 0.03));
  for (let v = 1; v <= 100; v++) {
    c.save();
    c.rotate(rad((v - 1) * SEG));
    c.translate(0, -r * 0.84);
    c.rotate(-Math.PI / 2);
    c.font = `${numFont}px VT323, monospace`;
    c.fillStyle = v === 100 ? "#fff" : "#160828";
    c.fillText(String(v), 0, 0);
    c.restore();
  }
  for (let t = 0; t < 10; t++) {
    c.save();
    c.rotate(rad(t * 36 + 18 - SEG / 2));
    c.translate(0, -r * 0.42);
    c.rotate(-Math.PI / 2);
    c.font = `${Math.max(10, Math.round(size * 0.034))}px VT323, monospace`;
    c.fillStyle = TIERS[t].color;
    c.fillText(TIERS[t].name, 0, 0);
    c.restore();
  }

  c.beginPath();
  c.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  c.strokeStyle = "#ffcf4a";
  c.lineWidth = 3;
  c.stroke();
}

// Spins clockwise so slot `value` stops under the top pointer
// The Wheel of Wealth spins until you press STOP, then coasts to a halt. Slow enough to
// time your press; a little randomness in the coast keeps it from being a sure thing
const WHEEL_SPEED = reducedMotion ? 120 : 200; // degrees per second, about 55 slots/s
const STOP_TIME = reducedMotion ? 0.6 : 1.8; // seconds of coasting after STOP
const WHEEL_JOKES = [
  "the Wheel of Wealth accepts tips",
  "spun by a certified wheel technician (he's 9)",
  "warning: wheel may contain traces of luck",
  "the wheel has never paid taxes",
  "studies show 100% of spins end somewhere",
  "low number? the dice will pity you later",
  "this wheel was won in a poker game",
  "do not feed the wheel after midnight",
  "the house wheel. the house always wins. hm.",
  "every spin is a new bad decision",
  "the wheel is rigged (to be a circle)",
  "press STOP like you mean it",
  "100 spins again. the wheel loves drama",
  "a high roll = big multi. a low roll = more luck",
];

let stopRequest = null;
function requestStop() {
  if (stopRequest) stopRequest();
}

async function spinWheel() {
  phase = "wheel";
  const stopBtn = $("wheel-stop");
  stopBtn.hidden = false;
  stopBtn.disabled = false;
  setHint("Tap STOP (or the wheel) to stop the Wheel of Wealth. A high number = big multiplier.");
  let angle = wheelRot;
  let lastSeg = null;
  const show = (a) => {
    wheelCanvas.style.transform = `rotate(${a}deg)`;
    // Click the pointer every time a slot passes under it
    const seg = Math.floor(mod(-a + SEG / 2, 360) / SEG);
    if (seg !== lastSeg) {
      if (lastSeg !== null) {
        SOUND.tick();
        pointerEl.classList.remove("tick");
        void pointerEl.offsetWidth;
        pointerEl.classList.add("tick");
      }
      lastSeg = seg;
      wheelResultEl.textContent = seg + 1;
      paintTier(wheelResultEl, multTier(seg + 1));
    }
    return seg + 1;
  };

  // Spin freely until STOP (insta-autoroll presses it for you)
  let stopped = false;
  const stop = new Promise((resolve) => {
    stopRequest = () => {
      if (stopped) return;
      stopped = true;
      resolve();
    };
  });
  const autoStop = setTimeout(requestStop, insta ? 700 + Math.random() * 1600 : 30000);
  let last = performance.now();
  let raf = 0;
  const spin = (now) => {
    angle += (WHEEL_SPEED * Math.min(100, now - last)) / 1000;
    last = now;
    show(angle);
    if (!stopped) raf = requestAnimationFrame(spin);
  };
  raf = requestAnimationFrame(spin);
  await stop;
  cancelAnimationFrame(raf);
  clearTimeout(autoStop);
  stopRequest = null;
  stopBtn.disabled = true;
  SOUND.clack();

  // Coast: constant deceleration over STOP_TIME, plus up to +-2.5 slots of slip
  const from = angle;
  const dist = (WHEEL_SPEED * STOP_TIME) / 2 + (Math.random() - 0.5) * SEG * 5;
  const start = performance.now();
  let value = show(from);
  await Promise.race([
    wait(STOP_TIME * 1000 + 300),
    new Promise((resolve) => {
      const frame = (now) => {
        const t = Math.min(1, (now - start) / (STOP_TIME * 1000));
        value = show(from + dist * (1 - (1 - t) * (1 - t)));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    }),
  ]);
  wheelRot = from + dist;
  value = show(wheelRot);
  stopBtn.hidden = true;
  bump(wheelResultEl);
  return value;
}

async function rollMultiplier() {
  wheelTitleEl.textContent = "WHEEL OF WEALTH";
  wheelResultEl.textContent = "?";
  wheelOverlay.classList.add("show");
  drawWheel();
  // Entrance via Web Animations: mobile Safari can skip a CSS transition that starts
  // in the same frame the overlay becomes visible
  const wrap = wheelOverlay.querySelector(".wheel-wrap");
  const entrance = wrap.animate(
    [
      { transform: "scale(.2) rotate(-200deg)", opacity: 0 },
      { transform: "scale(1.06) rotate(8deg)", opacity: 1, offset: 0.75 },
      { transform: "none", opacity: 1 },
    ],
    { duration: reducedMotion ? 150 : 700, easing: "cubic-bezier(.3, .8, .4, 1)" }
  );
  await entrance.settled;
  // If the browser stalled the entrance, drop it so the wheel is never stuck tiny
  entrance.cancel();

  // Rotating wheel jokes while it spins
  const jokeLine = $("wheel-joke");
  let jokeAt = Math.floor(Math.random() * WHEEL_JOKES.length);
  const showJoke = () => {
    jokeLine.textContent = WHEEL_JOKES[jokeAt++ % WHEEL_JOKES.length];
    jokeLine.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  };
  showJoke();
  const jokeTimer = setInterval(showJoke, 2600);

  let total = 0;
  for (;;) {
    const value = await spinWheel();
    total += value;
    SOUND.mult();
    if (value !== 100) break;
    showToast(`100!!!\nSPIN AGAIN`, 9);
    wheelTitleEl.textContent = `x${total} SO FAR... SPIN AGAIN!`;
    celebrate();
    diceRain(25);
    await wait(reducedMotion ? 400 : 1400);
  }
  clearInterval(jokeTimer);
  phase = "busy";
  mult = total;
  wheelMult = total;
  $("luck-chance").textContent = `last chance ${(100 / 6 + luckChance()).toFixed(1)}%`;

  const tier = multTier(mult);
  wheelTitleEl.textContent = `x${mult} · ${TIERS[tier].name}`;
  jokeLine.textContent =
    mult >= 90 ? "big multiplier, tiny luck: last chances stay at a fair 1/6" : mult <= 20 ? `tiny multiplier, but last chances hit ${(100 / 6 + luckChance()).toFixed(1)}% instead of 16.7%` : `last chances hit ${(100 / 6 + luckChance()).toFixed(1)}% instead of 16.7%`;
  if (mult >= 90) {
    setMessage(pick(HIGH_MULT_LINES), true);
    const { x, y } = centerOf(wheelResultEl);
    burst(x, y, 90);
  } else if (mult <= 5) {
    setMessage(pick(LOW_MULT_LINES));
    SOUND.sad();
  }
  // The result stays up a good while before the wheel flies off
  await wait(reducedMotion ? 900 : 3500);

  // Shrink the wheel away toward the multiplier badge
  const exit = wrap.animate(
    [{ transform: "none", opacity: 1 }, { transform: "translate(-42vw, -42vh) scale(.05)", opacity: 0 }],
    { duration: reducedMotion ? 100 : 500, easing: "ease-in" }
  );
  await exit.settled;
  wheelOverlay.classList.remove("show");
  exit.cancel();
  setMult(mult);
}

function setMult(value) {
  paintTier(multEl, multTier(value));
  multValueEl.textContent = "x" + value;
  bump(multValueEl);
}

/* ---------- The end die: a big 3D d20 rolling a d(total sixes) ---------- */

// Icosahedron geometry: 12 vertices, 20 faces found as triples of mutually adjacent vertices
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_VERTS = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnorm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const ICO_FACES = (() => {
  const faces = [];
  const adjacent = (i, j) => Math.abs(vdot(vsub(ICO_VERTS[i], ICO_VERTS[j]), vsub(ICO_VERTS[i], ICO_VERTS[j])) - 4) < 1e-6;
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++) {
        if (!adjacent(i, j) || !adjacent(j, k) || !adjacent(i, k)) continue;
        const [a, b, c] = [ICO_VERTS[i], ICO_VERTS[j], ICO_VERTS[k]];
        const n = vcross(vsub(b, a), vsub(c, a));
        // Wind every face outward
        faces.push(vdot(n, a) > 0 ? [i, j, k] : [i, k, j]);
      }
  return faces;
})();

// Quaternions [w, x, y, z]
const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qaxis = (axis, angle) => {
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), axis[0] * s, axis[1] * s, axis[2] * s];
};
const qrot = (q, v) => {
  const p = qmul(qmul(q, [0, v[0], v[1], v[2]]), [q[0], -q[1], -q[2], -q[3]]);
  return [p[1], p[2], p[3]];
};

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Renders the d20 at low resolution (scaled up pixelated) for a chunky retro look
function drawD20(ctx, size, q, color, labels, highlight) {
  ctx.clearRect(0, 0, size, size);
  const scale = size * 0.27;
  const light = vnorm([-0.4, -0.7, 0.8]);
  const [r, g, b] = hexRgb(color);
  const verts = ICO_VERTS.map((v) => qrot(q, v));
  const project = (v) => {
    const f = 7 / (7 - v[2]);
    return [size / 2 + v[0] * scale * f, size / 2 + v[1] * scale * f];
  };
  ICO_FACES.forEach((face, i) => {
    const [a, bb, c] = face.map((k) => verts[k]);
    const n = vnorm(vcross(vsub(bb, a), vsub(c, a)));
    if (n[2] <= 0) return; // back face
    const shade = 0.35 + 0.65 * Math.max(0, vdot(n, light));
    const pts = face.map((k) => project(verts[k]));
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.closePath();
    ctx.fillStyle = `rgb(${r * shade | 0},${g * shade | 0},${b * shade | 0})`;
    ctx.fill();
    const px = size / 160;
    ctx.lineJoin = "round";
    ctx.strokeStyle = i === 0 && highlight ? "#fff" : "rgba(22, 8, 40, .8)";
    ctx.lineWidth = (i === 0 && highlight ? 2.5 : 1.2) * px;
    ctx.stroke();
    // Numbers fade in smoothly as a face turns toward the viewer (no popping), at a
    // steady size so the text doesn't jitter frame to frame
    const alpha = Math.min(1, Math.max(0, (n[2] - 0.3) / 0.3));
    if (alpha > 0) {
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
      const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      const label = String(labels[i]);
      const fs = Math.round(size * (label.length > 2 ? 0.05 : 0.065));
      ctx.globalAlpha = alpha;
      ctx.font = `${fs}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = i === 0 && highlight ? "#fff" : "#160828";
      ctx.fillText(label, cx, cy + px);
      ctx.globalAlpha = 1;
    }
  });
}

async function rollEndDie() {
  const sides = totalSixes;
  const value = d(sides);
  setMessage(sides === 1 ? "> a d1?! it's a 1. it's always a 1." : `> ${sides} sixes forged a d${sides}!`, true);

  const stage = document.createElement("div");
  stage.className = "d20-stage";
  stage.innerHTML = `
    <p class="d20-title">THE END DIE</p>
    <div class="d20-roll"><canvas class="d20" width="360" height="360"></canvas><div class="d20-shadow"></div></div>
    <p class="d20-label">d1</p>
    <p class="d20-goal">${stats.extraRoundUsed ? "" : `roll ${extraRoundFrom(sides)}+ for ONE MORE ROUND`}</p>`;
  document.body.appendChild(stage);
  const canvasEl = stage.querySelector(".d20");
  const c = canvasEl.getContext("2d");
  const rollEl = stage.querySelector(".d20-roll");
  const labelEl = stage.querySelector(".d20-label");

  // Final orientation: face 0 pointing straight at the viewer
  const n0 = vnorm(ICO_FACES[0].map((k) => ICO_VERTS[k]).reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]));
  const axis0 = vcross(n0, [0, 0, 1]);
  const qFinal = Math.hypot(...axis0) < 1e-6 ? [1, 0, 0, 0] : qaxis(vnorm(axis0), Math.acos(vdot(n0, [0, 0, 1])));
  const labels = ICO_FACES.map(() => d(sides));
  labels[0] = value;
  let color = TIERS[0].color;
  let q = qmul(qaxis(vnorm([1, 1, 0.3]), 0.6), qFinal);
  let raf = 0;
  let render = () => drawD20(c, 360, q, color, labels, false);

  // Idle spin while the die is being forged
  let idleAngle = 0;
  const idle = () => {
    idleAngle += 0.02;
    q = qmul(qaxis(vnorm([0.3, 1, 0.2]), idleAngle), qFinal);
    render();
    raf = requestAnimationFrame(idle);
  };
  idle();
  stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
  rollEl.animate([{ transform: "scale(0) rotate(-180deg)" }, { transform: "none" }], { duration: reducedMotion ? 150 : 600, easing: "cubic-bezier(.3, 1.5, .5, 1)" });
  boom(0);
  await wait(reducedMotion ? 150 : 600);

  // Forge: one side per six, climbing the tier colors
  const step = reducedMotion ? 20 : Math.max(50, 700 / sides);
  for (let n = 1; n <= sides; n++) {
    labelEl.textContent = `d${n}`;
    color = TIERS[Math.min(9, n - 1)].color;
    paintTier(labelEl, Math.min(9, n - 1));
    sfx(330 * Math.pow(2, Math.min(n, 24) / 12), 0.1, { vol: 0.05, wet: 0.2 });
    await wait(step);
  }
  brassChord(semis(196, Math.min(sides, 12)), [0, 7, 12], 0.5, 0, 0.03);
  await wait(reducedMotion ? 100 : 500);
  cancelAnimationFrame(raf);

  // The roll: flung off-screen left, tumbling across the floor, bouncing, settling on face 0
  const time = reducedMotion ? 700 : 3200;
  const tumbleAxis = vnorm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
  const turns = Math.PI * 2 * (5 + Math.random() * 2);
  const start = performance.now();
  swell(time / 1000 + 0.1);
  tension(time / 1000);
  rollEl.animate(
    [
      { transform: "translate(-80vw, -30vh) scale(.6)" },
      { transform: "translate(-30vw, 0) scale(1)", offset: 0.3 },
      { transform: "translate(-12vw, -14vh) scale(1)", offset: 0.48 },
      { transform: "translate(4vw, 0) scale(1.05, .95)", offset: 0.66 },
      { transform: "translate(8vw, -5vh) scale(1)", offset: 0.78 },
      { transform: "translate(1vw, 0) scale(1.02, .98)", offset: 0.9 },
      { transform: "none" },
    ],
    { duration: time, easing: "cubic-bezier(.2, .6, .35, 1)" }
  );
  let lastFace = 0;
  // Frame loop, with a timeout fallback in case frames are paused (background tab)
  await Promise.race([wait(time + 200), new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / time);
      const ease = 1 - Math.pow(1 - t, 3);
      q = qmul(qaxis(tumbleAxis, turns * (1 - ease)), qFinal);
      // Click as faces roll past, slowing down with the die
      const face = Math.floor(turns * (1 - ease) / 0.6);
      if (face !== lastFace) {
        lastFace = face;
        SOUND.tick();
      }
      render();
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  })]);

  // Land: the top face lights up with the result
  q = qFinal;
  render = () => drawD20(c, 360, q, color, labels, true);
  render();
  stage.classList.add("landed");
  labelEl.textContent = `d${sides} → ${value}`;
  boom(0);
  timpani(98, { vol: 0.4 });
  brassChord(semis(196, Math.min(sides, 12)), [0, 4, 7, 12], 1.6, 0.05, 0.04);
  rollEl.animate([{ transform: "scale(1.25)" }, { transform: "none" }], { duration: 400, easing: "cubic-bezier(.3, 1.6, .5, 1)" });
  const { x, y } = centerOf(canvasEl);
  burst(x, y, 40 + sides * 8);
  sparkles(x, y, 24);

  mult += value;
  setMult(mult);
  showToast(`END DIE d${sides}\n+${value} MULTI`, multTier(mult));
  if (!stats.extraRoundUsed && value >= extraRoundFrom(sides)) {
    stage.querySelector(".d20-goal").textContent = "★ ONE MORE ROUND ★";
    stage.classList.add("extra");
  }
  await wait(reducedMotion ? 600 : 2000);
  await stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).settled;
  stage.remove();
  return value;
}

// The end die earns one more round (once per game) when it rolls more than 2/3 of its sides
const extraRoundFrom = (sides) => Math.floor((2 * sides) / 3) + 1;

/* ---------- UI helpers ---------- */

// Slides the tower facade and elevator shaft down so it feels like climbing
function setFloor(floor) {
  const root = document.documentElement;
  root.style.setProperty("--climb", `${floor * FLOOR_HEIGHT}px`);
  root.style.setProperty("--floor-color", floor ? TIERS[floorTier(floor)].color : "#ff3d9a");
  floorLabelEl.textContent = floor;
  paintTier(roundEl, floorTier(floor));
  if (floor > topFloor) {
    topFloor = floor;
    save("dicele-top-floor", topFloor);
    topFloorEl.textContent = topFloor;
    bump(topFloorEl);
  }
}

// Web Animations instead of class toggling: no forced reflow per die landing
let lastShake = 0;
function shakeTray() {
  const now = performance.now();
  if (reducedMotion || now - lastShake < 120) return;
  lastShake = now;
  tray.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: "translate(-4px, 3px)" },
      { transform: "translate(3px, -3px)" },
      { transform: "translate(0, 0)" },
    ],
    { duration: 220, easing: "steps(4)" }
  );
}

function bump(el) {
  el.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], {
    duration: 350,
    easing: "steps(3)",
  });
}

function countUp(el, from, to, duration = 450) {
  const start = performance.now();
  return new Promise((resolve) => {
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

function addPips(amount) {
  const prev = pips;
  pips += amount;
  countUp(pipsEl, prev, pips);
  bump(pipsEl);
}

function showToast(text, tier = 9) {
  toastEl.textContent = text;
  paintTier(toastEl, tier);
  toastEl.classList.remove("show");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
}

function setMessage(text, win = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle("win", win);
}

function floatText(x, y, text, cls = "") {
  const el = document.createElement("div");
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function logRound(sum, bonus, sixes) {
  const chip = document.createElement("span");
  chip.className = "chip";
  paintTier(chip, floorTier(floor + sixes));
  chip.innerHTML = `R${round} <b>${sum}</b>` + (bonus ? ` <i>+${bonus}</i>` : "") + (sixes ? ` <u>&#9650;${sixes}</u>` : "");
  logEl.appendChild(chip);
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// The big button does whatever is next: new game, roll the next die, or continue
function setButton(mode) {
  const labels = {
    idle: "&#9650; NEW GAME &#9650;",
    rolling: '&#9759; TAP YOUR DICE &#9759;<span class="auto">every die rolls with its own tap</span>',
    choice: '&#10004; CONTINUE &#10004;<span class="auto">or tap a glowing 1 to reroll it</span>',
  };
  rollBtn.classList.toggle("again", mode === "rolling" || mode === "choice");
  rollBtn.classList.remove("locked");
  if (labels[mode]) rollBtn.innerHTML = labels[mode];
  if (mode === "idle") refreshIdleButton();
}

/* ---------- Help hints ---------- */

const hintEl = $("hint");
function setHint(text) {
  if (hintEl.textContent === text) return;
  hintEl.textContent = text;
  hintEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
}

// Tells new players what to do right now
function updateHint() {
  if (phase === "idle") {
    setHint("Tap NEW GAME to play. New here? The ? button explains everything.");
  } else if (phase === "rolling") {
    const left = roundDice.filter((o) => o.value === null && !o.gone).length;
    const bad = roundDice.some((o) => o.kind === "bad" && o.value === null);
    const lose = badLosesOn() === 1 ? "a 1" : `1-${badLosesOn()}`;
    const clutch = !insta && roundDice.filter((o) => live(o) && o.value === null).length === 1;
    setHint(
      clutch
        ? "The golden one is your CLUTCH TAP: hand-rollers' last die feels luckier..."
        : `Tap each die to roll it (${left} left). Every 6 = one floor up. No 6 at all = game over.` +
            (bad ? ` Bad d20: ${lose} costs you a die!` : "")
    );
  } else if (phase === "choice") {
    const ones = roundDice.some((o) => rerollable(o) && o.value === 1);
    const twos = roundDice.some((o) => rerollable(o) && o.value === 2);
    const silver = !silverBtn.hidden;
    const parts = [];
    if (ones) parts.push("Glowing 1s: tap to reroll once.");
    if (twos) parts.push("Glowing 2s: tap to reroll with the green die (1-5, no 6).");
    if (silver) parts.push(silverUsed ? `SILVER REROLL: ${silverLeft} more reroll left, your holds are kept.` : "Enough silver 5s (2 of 5, 3 of 6...): SILVER REROLL gives you 2 rerolls, Yahtzee style.");
    parts.push("Happy? Tap CONTINUE.");
    setHint(parts.join(" "));
  }
}

/* ---------- Turn flow ---------- */

const silverBtn = $("silver");
silverBtn.addEventListener("click", () => {
  if (phase === "choice") enterSilverHold();
  else if (phase === "hold") silverReroll();
});

// Bad d20s already announced this game, so the alarm only fires for new ones
let badAnnounced = 0;

async function startTurn() {
  phase = "busy";
  rollBtn.disabled = true;
  round = 0;
  floor = 0;
  pips = 0;
  totalSixes = 0;
  diceCount = BASE_DICE;
  resetStats();
  badAnnounced = 0;
  for (const v of [1, 2, 3, 4]) unlocked[v] = false;
  goldD10 = false;
  shelfD4 = 0;
  $("d4-shelf").innerHTML = "";
  renderBonusBar();
  $("luck-chance").textContent = "";
  pipsEl.textContent = "0";
  roundEl.textContent = "0";
  scoreEl.textContent = "0";
  paintTier(scoreEl, 0);
  logEl.innerHTML = "";
  tray.innerHTML = "";
  setDiceCount();
  if (floorLabelEl.textContent !== "0") {
    setMessage(pick(DROP_LINES));
    sfx(900, 0.8, { to: 80, vol: 0.04 });
    setFloor(0);
    await wait(reducedMotion ? 200 : 1000);
  }
  setMessage("> step right up to the Wheel of Wealth...");
  await rollMultiplier();
  await startRound();
}

// Lay out this round's dice unrolled; the player rolls them one tap at a time
async function startRound() {
  round++;
  const bad = badDiceFor(diceCount);
  if (bad > badAnnounced) {
    await managerAlarm(bad);
  }
  badAnnounced = bad;
  roundDice = [];
  silverUsed = false;
  silverLeft = 0;
  tray.innerHTML = "";
  sizeTray(diceCount + bad + (goldD10 ? 1 : 0));
  for (let i = 0; i < diceCount; i++) roundDice.push(createDie());
  if (goldD10) roundDice.push(createGoldDie());
  for (let i = 0; i < bad; i++) roundDice.push(createBadDie());
  // Dice drop onto the felt
  roundDice.forEach((o, i) =>
    o.slot.animate([{ transform: "translateY(-60px)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 300,
      delay: i * 40,
      easing: "cubic-bezier(.3, 1.4, .5, 1)",
      fill: "backwards",
    })
  );
  silverBtn.hidden = true;
  phase = "rolling";
  setButton("rolling");
  rollBtn.disabled = false;
  setMessage(round === 1 ? `> your ${diceCount} dice are on the table` : `> round ${round} · floor ${floor} · ${diceCount} dice`);
  updateHint();
  autoRollBad();
  if (insta) autoRollAll();
}

// Every die is settled and the player is done: score it
async function resolveRound() {
  phase = "busy";
  rollBtn.disabled = true;
  silverBtn.hidden = true;
  setHint("");
  await checkYazzy();
  phase = "busy";
  const hasSix = () => roundDice.some((o) => live(o) && o.value === 6);
  if (!hasSix()) {
    const table = roundDice.filter(live);
    await lastChance(table[table.length - 1]);
    // Still no 6: the very last way out is sacrificing every 3
    if (!hasSix()) await offerSacrifice();
    // Rolled everything by hand this game? One more go at the round instead of game over
    if (!hasSix() && !stats.autoUsed && !stats.handRetryUsed) {
      stats.handRetryUsed = true;
      await handRetry();
      return;
    }
    phase = "busy";
    rollBtn.disabled = true;
  }

  const red = roundDice.filter(live);
  const values = red.map((o) => o.value);
  const sum = values.reduce((a, b) => a + b, 0);
  addPips(sum);

  // d4 shelf: once 4s are unlocked, every 4 adds a permanent little d4; the whole shelf rolls
  if (unlocked[4]) {
    const fours = values.filter((v) => v === 4).length;
    if (fours) addShelfD4(fours);
  }
  const d4Total = shelfD4 ? await rollShelf() : 0;
  stats.d4 += d4Total;
  if (d4Total) {
    showToast(`d4 SHELF ×${shelfD4}\n+${d4Total} CHIPS`, 3);
    arp([659, 784, 988], 0.06, { type: "triangle", vol: 0.05 });
    addPips(d4Total);
    await wait(reducedMotion ? 200 : 700);
  }

  // Every 1 left on the table gets a little "oof"
  for (const o of red) {
    if (o.value !== 1) continue;
    const { x, y } = centerOf(o.slot);
    floatText(x, y - 30, pick(["oof", "yikes", "lol", "1?!", "rip"]), "oof");
  }

  // Roll bonus for every extra round
  const roundBonus = BONUS_STEP * (round - 1);
  let extra = 0;
  if (roundBonus) {
    showToast(`ROUND ${round} BONUS\n+${roundBonus}`, floorTier(floor));
    SOUND.combo();
    addPips(roundBonus);
    extra += roundBonus;
    await wait(reducedMotion ? 300 : 900);
  }

  for (const combo of scoreCombos(values)) {
    stats.combos++;
    showToast(`${combo.name} +${combo.bonus}`);
    SOUND.combo();
    const { x, y } = centerOf(tray);
    burst(x, y, 60);
    addPips(combo.bonus);
    extra += combo.bonus;
    await wait(reducedMotion ? 300 : 1000);
  }
  const sixes = red.filter((o) => o.value === 6);
  logRound(sum, extra + d4Total, sixes.length);

  if (Math.random() < EVENT_CHANCE) await randomEvent();

  // The golden d10 adds its roll to the multiplier
  const gold = roundDice.find((o) => o.kind === "gold");
  if (gold && gold.value) {
    mult += gold.value;
    setMult(mult);
    stats.goldMulti = (stats.goldMulti || 0) + gold.value;
    showToast(`GOLDEN d10\n+${gold.value} MULTI · x${mult}`, 9);
    arp([784, 988, 1175, 1568], 0.06, { type: "triangle", vol: 0.06, wet: 0.3 });
    await wait(reducedMotion ? 300 : 900);
  }

  // A bad d20 showing 20: the manager confiscates a bonus
  const twenties = roundDice.filter((o) => o.kind === "bad" && o.value === 20).length;
  if (twenties) await confiscate(twenties);

  // Bad d20s that showed a 1 take a die away for good
  const struck = roundDice.filter((o) => o.kind === "bad" && o.value <= badLosesOn()).length;
  if (struck) {
    stats.struck += struck;
    await loseDice(struck);
  }

  if (sixes.length) {
    // Every six grows the end die: X sixes in total earn a dX
    totalSixes += sixes.length;
    for (const { slot } of sixes) {
      const { x, y } = centerOf(slot);
      burst(x, y, 20 + sixes.length * 10);
      sparkles(x, y, 6 + sixes.length * 2);
    }
    fanfare(sixes.length);
    hype(sixes.length);
    if (sixes.length >= 6) await mayhem();

    // One floor per six
    const label = sixes.length === 1 ? "SIX!" : `${sixes.length} SIXES!`;
    showToast(`${label}\nUP ${sixes.length} FLOOR${sixes.length > 1 ? "S" : ""} · END DIE d${totalSixes}`, floorTier(floor + sixes.length));
    await climb(sixes.length);
    setMessage(pick(SIX_LINES), true);
    await wait(reducedMotion ? 200 : 600);
    await startRound();
    return;
  }

  setMessage(pick(MISS_LINES));
  SOUND.blub();
  await wait(reducedMotion ? 300 : 900);
  await endTurn();
}

// A struck die shakes, cracks and bursts into shards; a pile of dust stays where it stood
async function destroyDie(obj) {
  const { slot } = obj;
  slot.classList.add("doomed");
  noise(0.25, { vol: 0.2, lp: 900, wet: 0.2 });
  await wait(reducedMotion ? 100 : 600);
  const { x, y } = centerOf(slot);
  // Shards in the die's own red, plus grey grit
  const before = particles.length;
  burst(x, y, 36);
  for (let i = before; i < particles.length; i++) {
    particles[i].color = ["#d61f35", "#7a0d1c", "#ff5d6e", "#8a8396", "#5a5466"][i % 5];
    particles[i].vy -= 2;
  }
  noise(0.6, { vol: 0.25, lp: 2500, wet: 0.35 });
  sfx(140, 0.5, { type: "sawtooth", vol: 0.08, to: 40, wet: 0.3 });
  for (let i = 0; i < 6; i++) noise(0.05, { vol: 0.06, delay: 0.15 + i * 0.07 + Math.random() * 0.05, hp: 3000 });
  slot.classList.remove("doomed", "six", "silver", "one", "landed", "rolling", "lucky");
  slot.classList.add("dust-pile");
  obj.gone = true;
  slot.innerHTML = '<div class="dust"></div>';
  floatText(x, y - 20, pick(["poof", "*crunch*", "rip die", "gone"]), "oof");
}

async function loseDice(count) {
  // The last red dice on the table are the ones that crumble
  const victims = roundDice.filter(live).slice(-count);
  await Promise.all(victims.map((o, i) => wait(i * 250).then(() => destroyDie(o))));
  diceCount = Math.max(1, diceCount - count);
  setDiceCount();
  showToast(`BAD d20 STRUCK!\n-${count} DIE${count > 1 ? "S" : ""} · NOW ${diceCount}`, 7);
  setMessage(`> the Casino Manager pockets ${count === 1 ? "a die" : count + " dice"} with a smile`);
  arp([392, 330, 262, 196], 0.14, { type: "sawtooth", vol: 0.05, wet: 0.3 });
  await wait(reducedMotion ? 400 : 1400);
}

function setDiceCount() {
  $("dice-count").textContent = diceCount;
  stats.maxDice = Math.max(stats.maxDice || 0, diceCount);
}

// Red alarm: the Casino Manager adds a bad d20. Slow pulse by default, real strobe in flashy mode
async function managerAlarm(badTotal) {
  const alarm = document.createElement("div");
  alarm.className = "alarm";
  alarm.innerHTML = `
    <div class="alarm-box">
      <p class="alarm-title">&#128680; ALARM &#128680;</p>
      <p class="alarm-text">Casino Manager notices your winstreak, he is adding a bad dice on the table, don't roll a ${badLosesOn() === 1 ? "1" : "1-" + badLosesOn()}!</p>
      <p class="alarm-sub">bad d20s on the table: ${badTotal}</p>
    </div>`;
  document.body.appendChild(alarm);
  // Siren: two tones sweeping up and down
  for (let i = 0; i < 4; i++) {
    sfx(620, 0.35, { type: "sawtooth", vol: 0.05, to: 920, delay: i * 0.7, wet: 0.2 });
    sfx(920, 0.35, { type: "sawtooth", vol: 0.05, to: 620, delay: i * 0.7 + 0.35, wet: 0.2 });
  }
  boom(0);
  setMessage("> uh oh. management is watching", true);
  alarm.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "forwards" });
  await wait(reducedMotion ? 1200 : 3000);
  alarm.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
  await wait(320);
  alarm.remove();
}

// Every floor has a name; every 5th floor is a milestone with its own scene
const FLOOR_NAMES = [
  "The Lobby Bar", "Penny Slot Swamp", "The Buffet of Regret", "Chip Laundromat", null,
  "Craps Canyon", "Lucky Seven Alley", "The Mint Room", "Poker Face Gym", null,
  "Tip Jar Tower", "The Dice Spa", "Floor 13 (Don't Ask)", "Roulette Roundabout", null,
  "Jackpot Junction", "The Velvet Rope", "Comp Drinks Club", "The Cashier Cage", null,
];
const MILESTONES = [
  { name: "The Neon Lounge", icon: "\u{1F378}" },
  { name: "The High Roller Suite", icon: "\u{1F4BC}" },
  { name: "The Sky Bar", icon: "\u{1F307}" },
  { name: "The Golden Vault", icon: "\u{1F3E6}" },
  { name: "The Penthouse", icon: "\u{1F6CE}️" },
  { name: "The Helipad", icon: "\u{1F681}" },
  { name: "Cloud Nine Casino", icon: "☁️" },
  { name: "Low Orbit Lounge", icon: "\u{1F6F0}️" },
  { name: "Space Station Slots", icon: "\u{1F680}" },
  { name: "Moon Base Blackjack", icon: "\u{1F315}" },
  { name: "Mars Poker Room", icon: "\u{1F534}" },
  { name: "Asteroid Belt Bingo", icon: "☄️" },
  { name: "Jupiter's Jackpot", icon: "\u{1FA90}" },
  { name: "The Comet Club", icon: "\u{1F320}" },
  { name: "Neutron Star Nightclub", icon: "⭐" },
  { name: "Black Hole Baccarat", icon: "\u{1F573}️" },
  { name: "The Edge of the Universe", icon: "\u{1F30C}" },
  { name: "The Multiverse Lobby", icon: "\u{1F300}" },
  { name: "The House Itself", icon: "\u{1F3E0}" },
];
const floorName = (f) =>
  f % FLOORS_PER_DIE === 0
    ? (MILESTONES[f / FLOORS_PER_DIE - 1] || { name: `Beyond Reason ${f}` }).name
    : FLOOR_NAMES[(f - 1) % FLOOR_NAMES.length] || `Floor ${f}`;

// A banner zips across the table for every floor passed
function floorBanner(f) {
  const banner = document.createElement("div");
  banner.className = "floor-banner";
  paintTier(banner, floorTier(f));
  banner.innerHTML = `<b>FLOOR ${f}</b> ${floorName(f)}`;
  document.body.appendChild(banner);
  banner
    .animate(
      [
        { transform: "translate(-120vw, -50%) skewX(-12deg)", opacity: 1 },
        { transform: "translate(-50%, -50%) skewX(0)", opacity: 1, offset: 0.3 },
        { transform: "translate(-50%, -50%) skewX(0)", opacity: 1, offset: 0.7 },
        { transform: "translate(120vw, -50%) skewX(12deg)", opacity: 1 },
      ],
      { duration: reducedMotion ? 500 : 1100, easing: "cubic-bezier(.3, .8, .4, 1)" }
    )
    .settled.then(() => banner.remove());
}

// Ride the elevator up one floor at a time with a ding each
async function climb(floors) {
  for (let i = 0; i < floors; i++) {
    floor++;
    setFloor(floor);
    roundEl.textContent = floor;
    bump(roundEl);
    SOUND.floorDing(i);
    if (floor % FLOORS_PER_DIE === 0) {
      await milestone();
    } else {
      floorBanner(floor);
      await wait(reducedMotion ? 120 : 420);
    }
  }
  const tier = floorTier(floor);
  setMessage(`> *ding* floor ${floor} · ${floorName(floor)} · ${TIERS[tier].name}`, true);
}

// Every 5th floor: a scene of its own. The elevator doors slam, the new place is revealed
// with its icon and color, a fresh red die is handed over, and the doors burst open
async function milestone() {
  diceCount++;
  setDiceCount();
  const index = floor / FLOORS_PER_DIE - 1;
  const place = MILESTONES[index] || { name: `Beyond Reason ${floor}`, icon: "✨" };
  const tier = Math.min(9, index);
  const doors = document.createElement("div");
  doors.className = "doors";
  paintTier(doors, tier);
  doors.innerHTML = `
    <div class="door left"></div><div class="door right"></div>
    <div class="door-lights"></div>
    <div class="door-sign">
      <span class="door-floor">FLOOR ${floor}</span>
      <span class="door-icon">${place.icon}</span>
      <span class="door-name">${place.name}</span>
      <div class="mini door-die"></div>
      <span class="door-gift">+1 RED DIE · NOW ${diceCount}</span>
    </div>`;
  fillFace(doors.querySelector(".door-die"), 6);
  document.body.appendChild(doors);
  const left = doors.querySelector(".left");
  const right = doors.querySelector(".right");
  const sign = doors.querySelector(".door-sign");
  const t = reducedMotion ? 0.3 : 1;

  // Slam shut, the floor counter rolls up
  const close = { duration: 320 * t, easing: "cubic-bezier(.6, 0, 1, .6)", fill: "forwards" };
  left.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], close);
  await right.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], close).settled;
  boom(0);
  noise(0.4, { vol: 0.15, hp: 400 });
  shakeTray();

  // Reveal: sign spins in, the icon bounces, the die drops, the place's own fanfare
  sign.animate(
    [{ transform: "scale(0) rotate(-20deg)", opacity: 0 }, { transform: "scale(1.15) rotate(4deg)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }],
    { duration: 500 * t, easing: "ease-out", fill: "forwards" }
  );
  doors.querySelector(".door-icon").animate(
    [{ transform: "scale(0) translateY(40px)" }, { transform: "scale(1.5) translateY(-10px)", offset: 0.6 }, { transform: "none" }],
    { duration: 700 * t, delay: 200 * t, easing: "ease-out", fill: "backwards" }
  );
  doors.querySelector(".door-die").animate(
    [{ transform: "translateY(-200px) rotate(-720deg)" }, { transform: "translateY(0) rotate(0)" }],
    { duration: 900 * t, delay: 400 * t, easing: "cubic-bezier(.3, 1.4, .5, 1)", fill: "backwards" }
  );
  const root = semis(196, index * 2);
  brassChord(root, [0, 4, 7, 12], 0.5, 0.1);
  brassChord(root, [5, 9, 12, 17], 0.5, 0.55);
  brassChord(root, [7, 11, 14, 19], 1.4, 1.0);
  timpani(semis(root, -12), { delay: 0.1 });
  timpani(semis(root, -7), { delay: 1.0 });
  if (index >= 2) choir(root, [12, 16, 19], 2, 0.5);
  setMessage(`> floor ${floor}: ${place.name}! the elevator gifts you die #${diceCount}`, true);
  const { x, y } = centerOf(sign);
  for (let i = 0; i < 4; i++) setTimeout(() => burst(x + (Math.random() - 0.5) * 300, y + (Math.random() - 0.5) * 200, 40), i * 300 * t);
  await wait(2100 * t);

  // Doors burst open and dice pour out
  const open = { duration: 450 * t, easing: "cubic-bezier(.2, .8, .3, 1)", fill: "forwards" };
  sign.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(1.6)" }], open);
  left.animate([{ transform: "translateX(0)" }, { transform: "translateX(-105%) rotate(-8deg)" }], open);
  await right.animate([{ transform: "translateX(0)" }, { transform: "translateX(105%) rotate(8deg)" }], open).settled;
  diceRain(30 + index * 5);
  celebrate();
  doors.remove();
}

// Bigger reactions for every extra six
function hype(sixes) {
  const title = document.querySelector("h1");
  if (sixes >= 2) title.animate([{ transform: "scale(1)" }, { transform: `scale(${1 + sixes * 0.06}) rotate(${sixes}deg)` }, { transform: "scale(1)" }], { duration: 500, easing: "steps(5)" });
  if (sixes >= 3) flashScreen(TIERS[floorTier(floor + sixes)].color);
  if (sixes >= 4 && flashy) {
    document.body.animate(
      [{ transform: "none" }, { transform: "translate(-8px, 6px) rotate(-1deg)" }, { transform: "translate(8px, -6px) rotate(1deg)" }, { transform: "none" }],
      { duration: 400, easing: "steps(6)", iterations: 2 }
    );
  }
  if (sixes >= 4) diceRain(sixes * 8);
  if (sixes >= 5) celebrate();
}

function flashScreen(color) {
  // Screen flashes only in flashy mode
  if (!flashy) return;
  const flash = document.createElement("div");
  flash.className = "flash";
  flash.style.background = color;
  document.body.appendChild(flash);
  flash.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 500, easing: "steps(5)" }).onfinish = () => flash.remove();
}

// 6x6: the whole page loses its mind for a few seconds
async function mayhem() {
  const root = document.documentElement;
  root.classList.add("mayhem");
  showToast("6 x 6 !!!\nTHE TOWER IS SHAKING", 9);
  setMessage("> SECURITY! SECURITY!! (they're dancing too)", true);
  const oldTitle = document.title;
  let flip = false;
  const titleTimer = setInterval(() => {
    document.title = (flip = !flip) ? "!!! 6 x 6 !!!" : "JACKPOT JACKPOT";
  }, flashy ? 300 : 1200);
  if (flashy) navigator.vibrate?.([200, 100, 200, 100, 600]);
  diceRain(120);
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      celebrate();
      flashScreen(TIERS[9 - i].color);
    }, i * 600);
  }
  addPips(666);
  await wait(reducedMotion ? 800 : 4200);
  clearInterval(titleTimer);
  document.title = oldTitle;
  root.classList.remove("mayhem");
}

const EVENT_CHANCE = 0.2;
const EVENTS = [
  { text: "LUCKY CAT WAVES\n+15 CHIPS", pips: 15 },
  { text: "A PIGEON STOLE\n5 CHIPS", pips: -5 },
  { text: "FREE COCKTAIL\n+3 MULTI", mult: 3 },
  { text: "SLOT MACHINE\nEXPLODED +25", pips: 25, rain: true },
  { text: "GRANDMA TIPPED YOU\n+10 CHIPS", pips: 10 },
  { text: "THE DEALER SNEEZED\n+1 MULTI", mult: 1 },
  { text: "ELEVATOR MUSIC SOLO\n+0 (but nice)", pips: 0 },
  { text: "RACCOON IN A VEST\nBOWS. +7", pips: 7 },
  { text: "YOU FOUND A COIN\nIN THE CARPET +1", pips: 1 },
  { text: "MAGICIAN PULLS\n+2 MULTI FROM YOUR EAR", mult: 2 },
];

async function randomEvent() {
  const ev = pick(EVENTS);
  flashScreen("#ffcf4a");
  showToast(ev.text, 7);
  sfx(1200, 0.08, { vol: 0.05 });
  sfx(1600, 0.08, { vol: 0.05, delay: 0.1 });
  const { x, y } = centerOf(tray);
  if (ev.pips) {
    addPips(Math.max(-pips, ev.pips));
    floatText(x, y, ev.pips > 0 ? `+${ev.pips}` : `${ev.pips}`, ev.pips > 0 ? "gold" : "oof");
  }
  if (ev.mult) {
    mult += ev.mult;
    setMult(mult);
  }
  if (ev.rain) diceRain(30);
  await wait(reducedMotion ? 400 : 1300);
}

async function endTurn() {
  phase = "busy";
  if (totalSixes) {
    const sides = totalSixes;
    const value = await rollEndDie();
    if (!stats.extraRoundUsed && value >= extraRoundFrom(sides)) {
      stats.extraRoundUsed = true;
      showToast(`END DIE ${value} OF ${sides}\nONE MORE ROUND!`, 8);
      setMessage(`> more than 2/3 of the end die: the house lets you roll one more round`, true);
      arp([523, 659, 784, 1047, 1319], 0.08, { type: "triangle", vol: 0.06, wet: 0.4 });
      await wait(reducedMotion ? 400 : 1400);
      await startRound();
      return;
    }
  }

  const final = pips * mult;
  const tier = scoreTier(final);

  setMessage(`> ${pips} chips x${mult} = ???`, true);
  scoreEl.textContent = "???";
  await cinematic(final, tier);
  paintTier(scoreEl, tier);
  scoreEl.textContent = final;
  bump(scoreEl);
  setMessage(`> ${pips} chips x${mult} = ${final}`, true);

  if (final > best) {
    best = final;
    save("dicele-best", best);
    bestEl.textContent = best;
    paintTier(bestEl, tier);
    bump(bestEl);
    await wait(1100);
    showToast("NEW BEST!");
    setMessage(`> new best: ${final}`, true);
    celebrate();
    diceRain(40);
  } else if (final >= 2000) {
    diceRain(20);
  }

  await wait(reducedMotion ? 300 : 900);
  await showGameOver(final);

  // A fresh game only starts on a click
  phase = "idle";
  setButton("idle");
  rollBtn.disabled = false;
}

/* ---------- Cinematic final score ---------- */

// Letterbox, light rays, the equation assembling, a drumroll, then the score's
// digits lock in one by one like slot reels and the tier stamps down
async function cinematic(final, tier) {
  const m = reducedMotion ? 0.3 : 1;
  const color = TIERS[tier].color;
  const cine = document.createElement("div");
  cine.className = "cine";
  cine.innerHTML = `
    <div class="cine-bar top"></div><div class="cine-bar bottom"></div>
    <div class="cine-rays"></div>
    <div class="cine-eq"><span class="c">${pips.toLocaleString("en-US")}</span><span class="x">×</span><span class="m">${mult}</span></div>
    <div class="cine-score"></div>
    <div class="cine-tier">${TIERS[tier].name}<small>${TIERS[tier].title}</small></div>
    <div class="cine-rank">${formatRank(final)}</div>`;
  document.body.appendChild(cine);
  paintTier(cine, multTier(mult));
  const [barTop, barBottom] = cine.querySelectorAll(".cine-bar");
  const rays = cine.querySelector(".cine-rays");
  const eq = cine.querySelector(".cine-eq");
  const [chipsEl, xEl, multElC] = eq.children;
  const scoreBox = cine.querySelector(".cine-score");
  const tierEl = cine.querySelector(".cine-tier");
  const rankEl = cine.querySelector(".cine-rank");
  const fwd = { fill: "forwards" };

  // 1. Lights down, letterbox in
  cine.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 * m, ...fwd });
  barTop.animate([{ transform: "translateY(-100%)" }, { transform: "none" }], { duration: 600 * m, easing: "ease-out", ...fwd });
  barBottom.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 600 * m, easing: "ease-out", ...fwd });
  boom(0);
  await wait(600 * m);

  // 2. The equation assembles: chips, then x, then multiplier, each with a brass hit
  const root = semis(196, tier);
  chipsEl.animate([{ transform: "translateX(-60vw)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 450 * m, easing: "cubic-bezier(.2, .9, .3, 1.2)", ...fwd });
  brassChord(root, [0, 7], 0.35, 0, 0.04);
  timpani(semis(root, -12));
  await wait(500 * m);
  xEl.animate([{ transform: "scale(0) rotate(-360deg)" }, { transform: "none" }], { duration: 400 * m, easing: "cubic-bezier(.3, 1.6, .5, 1)", ...fwd });
  brassChord(root, [5, 12], 0.35, 0, 0.04);
  timpani(semis(root, -7));
  await wait(450 * m);
  multElC.animate([{ transform: "translateX(60vw)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 450 * m, easing: "cubic-bezier(.2, .9, .3, 1.2)", ...fwd });
  brassChord(root, [7, 14], 0.35, 0, 0.04);
  timpani(semis(root, -5));
  await wait(550 * m);

  // 3. Drumroll: rays fade in, the equation trembles, a reverse cymbal swells
  const suspense = reducedMotion ? 0.6 : 2.4;
  tension(suspense);
  swell(suspense);
  choir(root, [0, 7, 12], suspense + 0.3);
  paintTier(rays, tier);
  rays.animate([{ opacity: 0 }, { opacity: 0.35 }], { duration: suspense * 1000, ...fwd });
  const tremble = eq.animate(
    [{ transform: "none" }, { transform: "translate(-2px, 1px)" }, { transform: "translate(2px, -1px)" }, { transform: "none" }],
    { duration: 120, iterations: Infinity }
  );
  await wait(suspense * 1000);
  tremble.cancel();

  // 4. Slam: the equation collapses into the score, digits spin and lock left to right
  eq.animate([{ transform: "none", opacity: 1 }, { transform: "scale(.2)", opacity: 0 }], { duration: 250, easing: "ease-in", ...fwd });
  paintTier(scoreBox, tier);
  const text = final.toLocaleString("en-US");
  const spans = [...text].map((ch) => {
    const s = document.createElement("span");
    s.textContent = /\d/.test(ch) ? String(d(10) - 1) : ch;
    if (!/\d/.test(ch)) s.className = "comma";
    scoreBox.appendChild(s);
    return s;
  });
  boom(0);
  noise(1.6, { vol: 0.2, hp: 3500, wet: 0.5 });
  scoreBox.animate([{ transform: "scale(3)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: "ease-out", ...fwd });
  const digits = spans.filter((s) => !s.classList.contains("comma"));
  const spinTimer = setInterval(() => {
    for (const s of digits) if (!s.classList.contains("locked")) s.textContent = String(d(10) - 1);
  }, 50);
  const lockGap = Math.max(90, Math.min(260, 1600 / digits.length)) * m;
  let di = 0;
  for (let i = 0; i < text.length; i++) {
    if (!/\d/.test(text[i])) continue;
    await wait(lockGap);
    const s = digits[di++];
    s.textContent = text[i];
    s.classList.add("locked");
    // Each locked digit climbs the scale
    brass(semis(root, [0, 4, 7, 12, 16, 19, 24, 28, 31][Math.min(di - 1, 8)]), 0.25, { vol: 0.035 });
    snare(0, 0.12);
  }
  clearInterval(spinTimer);

  // 5. The tier stamps down with the full victory fanfare
  victory(tier);
  tierEl.animate([{ transform: "scale(4) rotate(-8deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 350, easing: "cubic-bezier(.5, 0, .7, 1.4)", ...fwd });
  rays.animate([{ opacity: 0.35 }, { opacity: 0.6 }], { duration: 600, ...fwd });
  cine.animate(
    [{ transform: "none" }, { transform: "translate(-6px, 4px)" }, { transform: "translate(5px, -3px)" }, { transform: "none" }],
    { duration: 300, easing: "steps(4)" }
  );
  flashScreen(color);
  const { x, y } = centerOf(scoreBox);
  burst(x, y, 50 + tier * 15);
  // Coin fountain: gold confetti keeps erupting for higher tiers
  for (let i = 1; i <= Math.min(tier, 6); i++) setTimeout(() => burst(x, y, 30), i * 250);
  if (tier >= 6) diceRain(tier * 6);
  await wait(500 * m);
  rankEl.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 500, ...fwd });

  await wait((tier >= 9 ? 3600 : 2400) * m);
  await cine.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500 * m, ...fwd }).settled;
  cine.remove();
}

/* ---------- Game over card ---------- */

const gameoverEl = $("gameover");
const goCard = $("go-card");
const goScoreEl = $("go-score");
const goTierEl = $("go-tier");
const goLadder = $("go-ladder");

for (const t of TIERS) {
  const pip = document.createElement("span");
  pip.style.setProperty("--c", t.color);
  goLadder.appendChild(pip);
}

// Score climbs from 0; each tier threshold it passes lights a ladder pip with a ding
async function showGameOver(final) {
  const ladder = [...goLadder.children];
  ladder.forEach((p) => p.classList.remove("on"));
  goScoreEl.textContent = "0";
  goTierEl.textContent = TIERS[0].name;
  $("go-title").textContent = "";
  $("go-verdict").textContent = "";
  paintTier(goCard, 0);
  paintTier(goScoreEl, 0);
  paintTier(goTierEl, 0);
  $("go-chips").textContent = pips.toLocaleString("en-US");
  $("go-mult").textContent = "x" + mult;
  $("go-floors").textContent = floor;
  $("go-rounds").textContent = round;
  $("go-odds").textContent = "...";
  $("go-curve").innerHTML = "";
  $("go-statgrid").innerHTML = "";
  $("go-entry").hidden = true;
  $("go-comp").hidden = true;
  gameoverEl.classList.add("show");
  setHint("Tap NEW GAME to play again. The trophy at the top shows your leaderboard.");
  await wait(reducedMotion ? 100 : 600);

  // Quick recap: the cinematic already did the big reveal
  const duration = reducedMotion ? 300 : 1100;
  const start = performance.now();
  let shownTier = -1;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    // Ease in hard so the big tiers arrive with a rush at the end
    const value = Math.round(final * Math.pow(t, 2.2));
    goScoreEl.textContent = value.toLocaleString("en-US");
    const tier = scoreTier(value);
    while (shownTier < tier) {
      shownTier++;
      ladder[shownTier].classList.add("on");
      paintTier(goCard, shownTier);
      paintTier(goScoreEl, shownTier);
      paintTier(goTierEl, shownTier);
      goTierEl.textContent = TIERS[shownTier].name;
      sfx(440 * Math.pow(2, (shownTier * 2) / 12), 0.15, { type: "triangle", vol: 0.06 });
      bump(goTierEl);
    }
    return t < 1;
  };
  await Promise.race([
    wait(duration + 300),
    new Promise((resolve) => {
      const frame = (now) => (step(now) ? requestAnimationFrame(frame) : resolve());
      requestAnimationFrame(frame);
    }),
  ]);
  step(start + duration);
  goScoreEl.textContent = final.toLocaleString("en-US");

  const tier = scoreTier(final);
  $("go-title").textContent = TIERS[tier].title;
  $("go-verdict").textContent = `“${TIERS[tier].verdict}”`;
  SOUND.combo();
  goCard.animate([{ transform: "scale(1.08)" }, { transform: "none" }], { duration: 350, easing: "ease-out" });
  const { x, y } = centerOf(goScoreEl);
  burst(x, y, 30 + shownTier * 10);

  drawCurve(final, tier);
  drawStatGrid(final);

  // Type out how this score ranks against 12 million simulated games
  const text = formatRank(final);
  const oddsEl = $("go-odds");
  for (let i = 1; i <= text.length; i++) {
    oddsEl.textContent = text.slice(0, i);
    if (i % 2) SOUND.tick();
    await wait(reducedMotion ? 0 : 20);
  }

  offerLeaderboard(final, tier);
  offerBeginnersLuck(final);
}

// Score at a given percentile, interpolated on a log scale (inverse of scorePercentile)
function scoreAtPercentile(pct) {
  const t = SCORE_PERCENTILES;
  if (pct <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (pct <= t[i][0]) {
      const [p0, s0] = t[i - 1];
      const [p1, s1] = t[i];
      const f = (pct - p0) / (p1 - p0 || 1);
      return Math.exp(Math.log(Math.max(s0, 1)) + f * (Math.log(Math.max(s1, 1)) - Math.log(Math.max(s0, 1))));
    }
  }
  return t[t.length - 1][1];
}

// Percent of games ending below `f` floors
function floorPercentile(f) {
  const t = FLOOR_PERCENTILES;
  let pct = 0;
  for (const [p, fl] of t) if (f > fl) pct = p;
  return pct;
}

const shortNum = (v) =>
  v >= 1e9 ? `${+(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : `${Math.round(v)}`;

// Catmull-Rom spline through the points, as a smooth SVG path
function smoothPath(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// The big statistics curve: 12 million simulated games, tier bands behind it,
// percentile markers, and you on it
function drawCurve(final, tier) {
  const W = 340;
  const H = 168;
  const L = 6;
  const R = W - 6;
  const TOP = 30;
  const BASE = 128;
  const x0 = SCORE_CURVE[0][0];
  const x1 = SCORE_CURVE[SCORE_CURVE.length - 1][0];
  const px = (lx) => L + ((Math.min(Math.max(lx, x0), x1) - x0) / (x1 - x0)) * (R - L);
  const py = (dens) => BASE - dens * (BASE - TOP);
  const pts = SCORE_CURVE.map(([lx, dens]) => [px(lx), py(dens)]);
  const line = smoothPath(pts);
  const area = `${line} L${R},${BASE} L${L},${BASE} Z`;
  const youLx = Math.log10(Math.max(final, 1));
  const you = px(youLx);
  // Height of the curve at your score
  let youY = BASE;
  for (let i = 0; i < SCORE_CURVE.length - 1; i++) {
    const [a, da] = SCORE_CURVE[i];
    const [b, db] = SCORE_CURVE[i + 1];
    if (youLx >= a && youLx <= b) youY = py(da + ((youLx - a) / (b - a)) * (db - da));
  }
  const color = TIERS[tier].color;

  // Tier bands behind the curve
  const bands = TIERS.map((t, i) => {
    const a = px(Math.log10(Math.max(SCORE_TIERS[i], 10)));
    const b = i < 9 ? px(Math.log10(SCORE_TIERS[i + 1])) : R;
    return b > a ? `<rect x="${a.toFixed(1)}" y="${TOP - 6}" width="${(b - a).toFixed(1)}" height="${BASE - TOP + 6}" fill="${t.color}" opacity=".13"/>` : "";
  }).join("");

  // Percentile markers
  const marks = [
    [50, "MEDIAN"],
    [90, "TOP 10%"],
    [99, "TOP 1%"],
    [99.9, "0.1%"],
  ]
    .map(([p, label], i) => {
      const x = px(Math.log10(scoreAtPercentile(p)));
      return `<line x1="${x.toFixed(1)}" y1="${TOP - 4}" x2="${x.toFixed(1)}" y2="${BASE}" class="curve-mark"/>
        <text x="${x.toFixed(1)}" y="${TOP - 10 - (i % 2) * 9}" text-anchor="middle" class="curve-mark-label">${label}</text>`;
    })
    .join("");

  // Log-scale axis
  const ticks = [10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9]
    .filter((v) => Math.log10(v) >= x0 && Math.log10(v) <= x1)
    .map((v) => {
      const x = px(Math.log10(v)).toFixed(1);
      return `<line x1="${x}" y1="${BASE}" x2="${x}" y2="${BASE + 4}" class="curve-axis"/><text x="${x}" y="${BASE + 14}" text-anchor="middle" class="curve-tick">${shortNum(v)}</text>`;
    })
    .join("");

  const flagX = Math.min(R - 46, Math.max(L + 46, you));
  $("go-curve").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Where your score sits among 12 million simulated games">
      <defs>
        <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c7a8e8" stop-opacity=".35"/>
          <stop offset="1" stop-color="#c7a8e8" stop-opacity=".02"/>
        </linearGradient>
        <linearGradient id="you-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity=".85"/>
          <stop offset="1" stop-color="${color}" stop-opacity=".15"/>
        </linearGradient>
        <clipPath id="you-clip"><rect x="0" y="0" width="${you.toFixed(1)}" height="${H}" class="you-clip-rect"/></clipPath>
      </defs>
      ${bands}
      <path d="${area}" fill="url(#curve-fill)"/>
      <path d="${area}" fill="url(#you-fill)" clip-path="url(#you-clip)" class="you-area"/>
      <path d="${line}" class="curve-line" pathLength="1"/>
      ${marks}
      <line x1="${L}" y1="${BASE}" x2="${R}" y2="${BASE}" class="curve-axis"/>
      ${ticks}
      <line x1="${you.toFixed(1)}" y1="${youY.toFixed(1)}" x2="${you.toFixed(1)}" y2="${BASE}" stroke="${color}" stroke-width="2"/>
      <circle cx="${you.toFixed(1)}" cy="${youY.toFixed(1)}" r="4" fill="${color}" class="you-dot"/>
      <circle cx="${you.toFixed(1)}" cy="${youY.toFixed(1)}" r="4" fill="none" stroke="${color}" class="you-ping"/>
      <g class="you-flag">
        <rect x="${(flagX - 44).toFixed(1)}" y="${BASE + 20}" width="88" height="16" rx="2" fill="${color}"/>
        <text x="${flagX.toFixed(1)}" y="${BASE + 31}" text-anchor="middle" class="curve-you">YOU ${shortNum(final)}</text>
      </g>
    </svg>`;
}

// The statistics grid: how lucky you were and where you stand
function drawStatGrid(final) {
  const pct = scorePercentile(final);
  const top = 100 - pct;
  const luckRatio = stats.expectedSixes > 0 ? stats.sixes / stats.expectedSixes : 1;
  const luckText = luckRatio >= 1.15 ? "lucky!" : luckRatio <= 0.85 ? "unlucky" : "about average";
  const tiles = [
    ["Rank", `beats ${pct >= 99.9 ? pct.toFixed(3) : pct.toFixed(1)}%`, top <= 50 ? `only 1 in ${Math.round(100 / Math.max(top, 1e-9)).toLocaleString("en-US")} games score this` : "of all games"],
    ["Sixes", `${stats.sixes}`, `expected ${stats.expectedSixes.toFixed(1)}: ${luckText}`],
    ["Floors", `${floor}`, `beats ${floorPercentile(floor)}% of games`],
    ["Biggest table", `${stats.maxDice} dice`, stats.bonusDice ? `${stats.bonusDice} from five of a kind` : `${stats.rolls} rolls in total`],
    ["Wheel", `${wheelMult}`, `last chance ${(100 / 6 + luckChance()).toFixed(1)}%${stats.lastChances ? `, ${stats.lucky}/${stats.lastChances} hit` : ""}`],
    ["Losses", `${stats.sacrificed + stats.struck} dice`, `${stats.sacrificed} sacrificed, ${stats.struck} to bad d20s`],
    ["Bonus chips", `+${stats.d4}`, `from d4s · ${stats.combos} combo${stats.combos === 1 ? "" : "s"}`],
    ["Expected game", shortNum(scoreAtPercentile(50)), `median score · you got ${(final / Math.max(1, scoreAtPercentile(50))).toFixed(1)}x`],
  ];
  $("go-statgrid").innerHTML = tiles
    .map(([label, value, sub]) => `<div class="stat-tile"><span class="st-label">${label}</span><b class="st-value">${value}</b><span class="st-sub">${sub}</span></div>`)
    .join("");
}

$("new-game").addEventListener("click", () => {
  gameoverEl.classList.remove("show");
  play();
});

/* ---------- Leaderboard (this device) ---------- */

const LB_KEY = "dicele-leaderboard";
const LB_SIZE = 10;

function loadBoard() {
  try {
    const list = JSON.parse(localStorage.getItem(LB_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveBoard(list) {
  try {
    localStorage.setItem(LB_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable; the board just won't persist
  }
}

/* ---------- Beginner's Luck: a free retry for very unlucky new players ---------- */

// In their first few games, a bottom-tier result (about 1 game in 5) gets one free game on
// the house that doesn't count against the daily limit. A handful per player, ever
const GAMES_KEY = "dicele-games-played";
const COMPS_KEY = "dicele-comps-used";
const BEGINNER_GAMES = 3;
const MAX_COMPS = 3;

function offerBeginnersLuck(final) {
  const box = $("go-comp");
  box.hidden = true;
  const isNew = load(GAMES_KEY) <= BEGINNER_GAMES;
  const unlucky = final < SCORE_TIERS[1];
  if (!isNew || !unlucky || load(COMPS_KEY) >= MAX_COMPS) return;
  box.hidden = false;
  box.animate([{ transform: "scale(.6) rotate(-3deg)", opacity: 0 }, { transform: "none", opacity: 1 }], {
    duration: 450,
    easing: "cubic-bezier(.3, 1.6, .5, 1)",
  });
  arp([523, 659, 784, 1047], 0.09, { type: "triangle", vol: 0.06, wet: 0.4 });
  setHint("Rough start? The house is buying you another game.");
}

$("go-comp-btn").addEventListener("click", () => {
  save(COMPS_KEY, load(COMPS_KEY) + 1);
  $("go-comp").hidden = true;
  // Same door as the secret one: this game doesn't use up the 8-hour game
  secretGame = true;
  gameoverEl.classList.remove("show");
  showToast("BEGINNER'S LUCK\nON THE HOUSE", 4);
  play();
});

// Top-10 score? Ask for 3-letter initials right on the game-over card
function offerLeaderboard(final, tier) {
  const board = loadBoard();
  const rank = board.filter((e) => e.score >= final).length + 1;
  if (rank > LB_SIZE || final <= 0) return;
  const entry = $("go-entry");
  const input = $("go-initials");
  $("go-entry-title").textContent = rank === 1 ? "NEW #1 HIGH SCORE!" : `HIGH SCORE #${rank}!`;
  entry.hidden = false;
  entry.dataset.score = final;
  entry.dataset.tier = tier;
  try {
    input.value = localStorage.getItem("dicele-initials") || "";
  } catch {
    input.value = "";
  }
  input.focus();
  input.select();
  entry.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: "cubic-bezier(.3, 1.6, .5, 1)" });
  arp([523, 659, 784, 1047], 0.08, { type: "triangle", vol: 0.05 });
}

$("go-initials").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
});

function submitInitials() {
  const entry = $("go-entry");
  const name = ($("go-initials").value || "???").padEnd(3, "?");
  try {
    localStorage.setItem("dicele-initials", name);
  } catch {
    // ignore
  }
  const board = loadBoard();
  const record = {
    name,
    score: Number(entry.dataset.score),
    tier: Number(entry.dataset.tier),
    floor,
    mult,
    date: new Date().toISOString().slice(0, 10),
  };
  board.push(record);
  board.sort((a, b) => b.score - a.score);
  saveBoard(board.slice(0, LB_SIZE));
  entry.hidden = true;
  SOUND.combo();
  showLeaderboard(record);
}

$("go-save").addEventListener("click", submitInitials);
$("go-initials").addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitInitials();
});

function showLeaderboard(highlight) {
  const board = loadBoard();
  const rows = board.length
    ? board
        .map((e, i) => {
          const t = TIERS[Math.min(9, Math.max(0, e.tier || 0))];
          const mine = highlight && e.name === highlight.name && e.score === highlight.score && e.date === highlight.date;
          return `<tr class="${mine ? "mine" : ""}" style="--tc:${t.color}">
            <td>${i + 1}</td><td class="lb-name">${e.name}</td>
            <td class="lb-score">${Number(e.score).toLocaleString("en-US")}</td>
            <td class="lb-tier">${t.name}</td><td>FL ${e.floor ?? "-"}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="lb-empty">No scores yet. Go make some bad decisions!</td></tr>`;
  $("lb-rows").innerHTML = rows;
  openModal("leaderboard");
}

/* ---------- Modals: help and leaderboard ---------- */

function openModal(id) {
  const m = $(id);
  m.hidden = false;
  // Only the box pops in; the backdrop is never faded, so it can't get stuck see-through
  m.querySelector(".modal-box").animate([{ transform: "scale(.9)" }, { transform: "none" }], { duration: 200 });
  m.querySelector(".modal-close").focus();
}

function closeModal(id) {
  $(id).hidden = true;
}

for (const m of document.querySelectorAll(".modal")) {
  m.querySelector(".modal-close").addEventListener("click", () => closeModal(m.id));
  m.addEventListener("click", (e) => {
    if (e.target === m) closeModal(m.id);
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
});

$("lb-btn").addEventListener("click", () => showLeaderboard());
$("help-btn").addEventListener("click", () => openModal("help"));
$("lb-clear").addEventListener("click", () => {
  if (confirm("Clear this device's leaderboard?")) {
    saveBoard([]);
    showLeaderboard();
  }
});

// The tier table in the help screen, with how often each one happens
(function fillTierTable() {
  const rows = TIERS.map((t, i) => {
    const from = SCORE_TIERS[i];
    const share = i < 9 ? scorePercentile(SCORE_TIERS[i + 1]) - scorePercentile(from) : 100 - scorePercentile(from);
    return `<tr style="--tc:${t.color}"><td class="lb-tier">${t.name}</td><td>${t.title}<br><i>“${t.verdict}”</i></td>
      <td class="lb-score">${from.toLocaleString("en-US")}+</td><td>${share < 1 ? share.toFixed(2) : share.toFixed(0)}%</td></tr>`;
  });
  $("tier-rows").innerHTML = rows.join("");
})();

// "How the table grows": built from the rule constants, so it always matches the game
(function fillProgression() {
  // What a yazzy needs and how many bad d20s sit on the table, by table size
  const sizes = [5, 6, 8, 10, 11, 12, 15, 20, 25, 30];
  const rows = sizes.map((n) => {
    const notes = [];
    if (n === BASE_DICE) notes.push("start: every bonus locked");
    if (n === BAD_FROM_DICE) notes.push("\u{1F6A8} the Casino Manager arrives");
    else if (n > BAD_FROM_DICE && (n - BAD_FROM_DICE) % BAD_EVERY_DICE === 0) notes.push("\u{1F6A8} another bad d20");
    if (n === 11) notes.push("yazzy now needs dice − 5");
    return [`${n} dice`, `${yazzyNeed(n)} of ${n}`, notes.join(" · "), String(badDiceFor(n))];
  });
  $("prog-rows").innerHTML =
    `<tr><td><b>table</b></td><td><b>yazzy</b></td><td><b>what changes</b></td><td><b>bad d20s</b></td></tr>` +
    rows.map((r) => `<tr><td class="lb-score">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("");

  const faces = [`<tr><td class="lb-score">floor 0–${LOSE_FACES_FROM_FLOOR - 1}</td><td>a 1 destroys a red die</td><td>5% each</td></tr>`];
  for (let f = 2; f <= 4; f++) {
    const from = LOSE_FACES_FROM_FLOOR + (f - 2) * LOSE_FACE_STEP;
    faces.push(`<tr><td class="lb-score">floor ${from}–${from + LOSE_FACE_STEP - 1}</td><td>1–${f} destroys a red die</td><td>${f * 5}% each</td></tr>`);
  }
  faces.push(`<tr><td class="lb-score">always</td><td>a 20 confiscates one unlocked bonus</td><td>5% each</td></tr>`);
  $("face-rows").innerHTML = faces.join("");
})();

$("version").textContent = "v" + VERSION;
renderBonusBar();

/* ---------- One game every 8 hours (plus a secret door) ---------- */

const PLAYED_AT_KEY = "dicele-played-at";
const COOLDOWN_MS = 8 * 60 * 60 * 1000;
function lastPlayedAt() {
  try {
    return Number(localStorage.getItem(PLAYED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}
// Still waiting for the next game?
function onCooldown() {
  return Date.now() - lastPlayedAt() < COOLDOWN_MS;
}
function markPlayed() {
  try {
    localStorage.setItem(PLAYED_AT_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: no limit then
  }
}
// The secret door: tap the DICELE logo 3 times quickly for one more game right now
let secretGame = false;

function untilNextGame() {
  const s = Math.max(0, Math.ceil((lastPlayedAt() + COOLDOWN_MS - Date.now()) / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

// While idle and waiting, the button counts down to the next game
function refreshIdleButton() {
  if (phase !== "idle") return;
  const locked = onCooldown() && !secretGame;
  rollBtn.classList.toggle("locked", locked);
  rollBtn.innerHTML = locked
    ? `NEXT GAME IN ${untilNextGame()}<span class="auto">one game every 8 hours</span>`
    : "&#9650; NEW GAME &#9650;";
  $("new-game").innerHTML = locked ? `SEE YOU IN ${untilNextGame()}` : "&#9650; NEW GAME &#9650;";
}
setInterval(refreshIdleButton, 1000);

let logoTaps = [];
document.querySelector("header h1").addEventListener("click", () => {
  const now = performance.now();
  logoTaps = logoTaps.filter((t) => now - t < 1500).concat(now);
  sfx(300 + logoTaps.length * 200, 0.08, { vol: 0.04 });
  if (logoTaps.length < 3 || phase !== "idle" || secretGame || !onCooldown()) return;
  logoTaps = [];
  secretGame = true;
  showToast("SECRET DOOR!\nONE MORE GAME", 9);
  setMessage("> psst. the bouncer looks the other way...", true);
  arp([392, 523, 659, 784, 1047], 0.07, { type: "triangle", vol: 0.06, wet: 0.4 });
  celebrate();
  refreshIdleButton();
});

// The big button / space bar: whatever comes next
function play() {
  if (phase === "idle") {
    if (onCooldown() && !secretGame) {
      setMessage(`> the casino is closed for you. come back in ${untilNextGame()}`);
      setHint("One game every 8 hours. Rumor says the logo hides a secret door...");
      rollBtn.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "none" }], { duration: 250 });
      SOUND.sad();
      return;
    }
    secretGame = false;
    markPlayed();
    save(GAMES_KEY, load(GAMES_KEY) + 1);
    gameoverEl.classList.remove("show");
    startTurn();
  } else if (phase === "wheel") {
    requestStop();
  } else if (phase === "rolling") {
    nudgeDice();
  } else if (phase === "choice") {
    resolveRound();
  } else if (phase === "sacrifice") {
    cashOut();
  } else if (phase === "hold") {
    // Keep every die: no reroll after all
    leaveSilverHold();
    for (const o of roundDice) o.held = false;
    phase = "choice";
    resolveRound();
  }
}

/* ---------- Flashy toggle & splash ---------- */

let flashy = load("dicele-flashy") === 1;
const flashyBtn = $("flashy");
function applyFlashy() {
  document.documentElement.classList.toggle("flashy", flashy);
  flashyBtn.setAttribute("aria-pressed", String(flashy));
}
applyFlashy();
flashyBtn.addEventListener("click", () => {
  flashy = !flashy;
  save("dicele-flashy", flashy ? 1 : 0);
  applyFlashy();
  SOUND.pop();
});

let insta = load("dicele-insta") === 1;
const instaBtn = $("insta");
function applyInsta() {
  instaBtn.classList.toggle("on", insta);
  instaBtn.setAttribute("aria-pressed", String(insta));
  instaBtn.innerHTML = `&#9193; INSTA-AUTOROLL: ${insta ? "ON" : "OFF"}`;
}
applyInsta();
instaBtn.addEventListener("click", () => {
  insta = !insta;
  save("dicele-insta", insta ? 1 : 0);
  applyInsta();
  SOUND.pop();
  // Switching on mid-game takes over right away
  if (!insta) return;
  if (phase === "wheel") requestStop();
  else if (phase === "rolling") autoRollAll();
  else if (phase === "choice") roundReady();
});

$("wheel-stop").addEventListener("click", requestStop);
wheelCanvas.addEventListener("click", requestStop);

/* ---------- Keep the screen awake ---------- */

// Screen Wake Lock: the phone doesn't dim or sleep while the casino is open. Browsers
// release it when the tab is hidden, so it's requested again on every return
let wakeLock = null;
async function keepAwake() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible" || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => (wakeLock = null));
  } catch {
    // Not allowed right now (battery saver, no gesture yet): try again on the next tap
    wakeLock = null;
  }
}
document.addEventListener("visibilitychange", keepAwake);
window.addEventListener("pointerdown", keepAwake);
keepAwake();

/* ---------- Fit the whole game into 90% of the screen, no scrolling ---------- */

const stageEl = $("stage");
function fitStage() {
  const natural = stageEl.offsetHeight; // layout size, not affected by the transform
  // 90% of the screen, minus whatever sits above the game (the phone top bar)
  const avail = window.innerHeight * 0.9 - stageEl.offsetTop;
  const scale = Math.min(1, avail / Math.max(natural, 1));
  stageEl.style.transform = scale < 1 ? `scale(${scale.toFixed(4)})` : "";
}
window.addEventListener("resize", fitStage);
window.addEventListener("orientationchange", () => setTimeout(fitStage, 200));
// The table grows and shrinks with dice, hints and buttons: refit whenever it does
if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stageEl);
fitStage();
// Fonts arriving late change sizes too
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitStage);

const splashEl = $("splash");
// The rules, before entering; the splash stays until ENTER
$("splash-help").addEventListener("click", (e) => {
  e.stopPropagation();
  audio();
  SOUND.pop();
  openModal("help");
});
splashEl.addEventListener("click", () => {
  audio();
  keepAwake();
  SOUND.combo();
  splashEl.style.pointerEvents = "none";
  splashEl.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(1.1)" }], { duration: 400, fill: "forwards" });
  // Removed on a timer, not on animation end, so it can't get stuck covering the game
  setTimeout(() => splashEl.remove(), 450);
  rollBtn.focus();
});

rollBtn.addEventListener("click", play);
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" && e.code !== "Enter") return;
  // Typing initials or using another button: leave the key alone
  const el = document.activeElement;
  if (el && (el.tagName === "INPUT" || (el.tagName === "BUTTON" && el !== rollBtn))) return;
  if (phase === "wheel" || !rollBtn.disabled) {
    e.preventDefault();
    if (document.activeElement !== rollBtn || phase === "wheel") play();
  }
});

/* ---------- Drifting dice you can tap ---------- */

// Rare on purpose: a die drifts by every ~7 seconds, a golden one about every 8 minutes
const MAX_DRIFTERS = reducedMotion ? 2 : 3;
const DRIFT_EVERY_MS = 7000;
const GOLDEN_CHANCE = 0.015;

function spawnDrifter(fast = false) {
  if (!fast && driftEl.childElementCount >= MAX_DRIFTERS) return;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "drifter";
  el.setAttribute("aria-label", "Drifting die");
  // Celebration rains are never golden
  if (!fast && Math.random() < GOLDEN_CHANCE) el.classList.add("golden");

  const size = 26 + Math.floor(Math.random() * 4) * 6;
  el.style.left = `${Math.random() * 94}vw`;
  el.style.setProperty("--ds", `${size}px`);
  el.style.setProperty("--dur", `${fast ? 2.5 + Math.random() * 2 : 12 + Math.random() * 12}s`);
  el.style.setProperty("--sway", `${(Math.random() - 0.5) * 120}px`);
  el.style.setProperty("--spin", `${3 + Math.random() * 6}s`);

  const face = document.createElement("div");
  face.className = "mini";
  fillFace(face, d(6));
  el.appendChild(face);

  el.addEventListener("pointerdown", () => popDrifter(el, face));
  el.addEventListener("animationend", (e) => {
    if (e.target === el || e.animationName === "popspin") el.remove();
  });
  driftEl.appendChild(el);
}

function popDrifter(el, face) {
  if (el.classList.contains("popped")) return;
  const value = d(6);
  fillFace(face, value);
  el.classList.add("popped");

  const { x, y } = centerOf(el);
  const turnActive = phase !== "idle";
  burst(x, y, 16);
  SOUND.pop();

  if (el.classList.contains("golden")) {
    if (turnActive) {
      mult += GOLDEN_MULT;
      setMult(mult);
      floatText(x, y, `+${GOLDEN_MULT} MULTI`, "gold");
      showToast(`GOLDEN DIE! +${GOLDEN_MULT} MULTI`);
      SOUND.combo();
    } else {
      floatText(x, y, "shiny!", "gold");
    }
  } else if (turnActive) {
    addPips(value);
    floatText(x, y, `+${value}`);
  } else {
    floatText(x, y, value === 6 ? "6!" : String(value));
  }
}

function diceRain(count) {
  if (reducedMotion) count = Math.round(count / 4);
  for (let i = 0; i < count; i++) setTimeout(() => spawnDrifter(true), i * 50);
}

setInterval(() => {
  if (!document.hidden) spawnDrifter();
}, DRIFT_EVERY_MS);
setTimeout(spawnDrifter, 1500);

/* ---------- Confetti particles ---------- */

const canvas = $("fx");
const ctx = canvas.getContext("2d");
const COLORS = ["#ffcf4a", "#ff3d9a", "#44f0ff", "#d61f35", "#fff2dc", "#1f8a45"];
let particles = [];
let animating = false;

function resize() {
  // 1:1 pixels on purpose: the confetti is pixel art, and a 2-3x retina canvas
  // made every particle frame clear and redraw up to 9x the pixels
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
window.addEventListener("resize", resize);

function burst(x, y, count) {
  if (reducedMotion) count = Math.round(count / 4);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
      decay: 0.008 + Math.random() * 0.01,
      gravity: 0.25,
      bubble: false,
    });
  }
  start();
}

// Gold sparkles that float up and wobble
function sparkles(x, y, count) {
  if (reducedMotion) count = Math.round(count / 4);
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 60,
      y: y + Math.random() * 20,
      vx: 0,
      vy: -1 - Math.random() * 2,
      size: 4 + Math.floor(Math.random() * 3) * 4,
      rot: 0,
      vr: 0,
      phase: Math.random() * Math.PI * 2,
      color: "#ffcf4a",
      life: 1,
      decay: 0.006 + Math.random() * 0.006,
      gravity: -0.02,
      bubble: true,
    });
  }
  start();
}

function start() {
  if (!animating) {
    animating = true;
    requestAnimationFrame(tick);
  }
}

function celebrate() {
  const w = innerWidth;
  burst(w * 0.2, innerHeight * 0.3, 70);
  setTimeout(() => burst(w * 0.8, innerHeight * 0.3, 70), 200);
  setTimeout(() => burst(w * 0.5, innerHeight * 0.2, 90), 400);
}

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < innerHeight + 40 && p.y > -40);

  for (const p of particles) {
    p.vy += p.gravity;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= p.decay;

    // Snap to a 4px grid so everything reads as pixel art
    const size = Math.round(p.size / 4) * 4;
    let px = Math.round(p.x / 4) * 4;
    const py = Math.round(p.y / 4) * 4;
    ctx.globalAlpha = Math.max(0, p.life);

    if (p.bubble) {
      p.phase += 0.08;
      px += Math.round(Math.sin(p.phase) * 2) * 4;
      // Pixel plus-shaped twinkle
      ctx.fillStyle = p.color;
      ctx.fillRect(px - size / 2, py - 2, size, 4);
      ctx.fillRect(px - 2, py - size / 2, 4, size);
    } else {
      // Tumbling confetti: flips between full and thin to fake rotation
      const w = Math.abs(Math.cos(p.rot)) > 0.5 ? size : Math.max(4, size / 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(px - w / 2, py - size / 2, w, size);
    }
  }
  ctx.globalAlpha = 1;

  if (particles.length) requestAnimationFrame(tick);
  else animating = false;
}
