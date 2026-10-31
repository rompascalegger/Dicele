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

// Ten color escalations, from boring to jackpot
const TIERS = [
  { name: "PAPER", color: "#9a8fa8" },
  { name: "BRONZE", color: "#c98a4b" },
  { name: "SILVER", color: "#dfe6f0" },
  { name: "JADE", color: "#3ddc84" },
  { name: "AQUA", color: "#44f0ff" },
  { name: "SAPPHIRE", color: "#5b84ff" },
  { name: "AMETHYST", color: "#b45cff" },
  { name: "NEON", color: "#ff3d9a" },
  { name: "INFERNO", color: "#ff7a1a" },
  { name: "JACKPOT", color: "#ffcf4a" },
];
// Final scores at or above these reach the matching tier
// Tier thresholds come from simulating 200,000 games with these rules:
// bottom 20% Paper, then 40/60/75/85/93/97/99/99.9th percentiles, top 0.1% Jackpot
const SCORE_TIERS = [0, 1250, 3000, 6500, 12000, 20000, 40000, 85000, 200000, 750000];
// Same idea for floors: median game reaches floor 2, top 1% floor 30
const FLOOR_TIERS = [1, 2, 3, 4, 6, 9, 14, 20, 30, 57];
// Simulated score percentiles [percent of games, score], used to rank each result
const SCORE_PERCENTILES = [
  [0, 10], [1, 96], [5, 360], [10, 663], [20, 1260], [30, 1978], [40, 3168], [50, 4445],
  [60, 6480], [70, 9483], [75, 11832], [80, 15200], [85, 20451], [90, 30094], [93, 41475],
  [95, 55752], [97, 86686], [98, 123123], [99, 209000], [99.5, 334044], [99.8, 549300],
  [99.9, 754728], [99.95, 997662], [99.99, 1491105], [100, 3936800],
];

const multTier = (m) => Math.min(9, Math.floor((m - 1) / 10));
// Highest tier whose threshold is reached (no findLastIndex: it crashes older iPhones)
const tierFor = (thresholds, value) => thresholds.reduce((tier, t, i) => (value >= t ? i : tier), 0);
const floorTier = (f) => tierFor(FLOOR_TIERS, f);
const scoreTier = (s) => tierFor(SCORE_TIERS, s);

function paintTier(el, tier) {
  el.style.setProperty("--tc", TIERS[tier].color);
  el.classList.toggle("jackpot", tier === 9);
}

const BASE_DICE = 6;
// Every this many floors the elevator hands you one more red die
const FLOORS_PER_DIE = 5;
// Without a cap more dice mean more sixes mean more dice: about 1 game in 330 never ends
const MAX_DICE = 10;
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
// even if the browser paused it (background tab, hidden pane), so the game never stalls
Object.defineProperty(Animation.prototype, "settled", {
  get() {
    const ms = Number(this.effect?.getTiming().duration) || 0;
    return Promise.race([this.finished.catch(() => {}), wait(ms + 150)]);
  },
});
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

function createDie() {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.innerHTML = '<div class="shadow"></div><div class="toss"><div class="die"></div></div>';
  const die = slot.querySelector(".die");

  for (let n = 1; n <= 6; n++) {
    const face = document.createElement("div");
    face.className = `face f${n}`;
    fillFace(face, n);
    die.appendChild(face);
  }

  // Random starting orientation so every die tumbles differently
  die.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`;
  tray.appendChild(slot);
  return { slot, die };
}

async function rollDie(value) {
  const { slot, die } = createDie();
  const [fx, fy] = FACE_ROTATION[value];
  const spinsX = 2 + Math.floor(Math.random() * 3);
  const spinsY = 2 + Math.floor(Math.random() * 3);

  // Wait a frame so the starting transform is applied before transitioning
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  die.style.transform = `rotateX(${fx + 360 * spinsX}deg) rotateY(${fy + 360 * spinsY}deg)`;
  SOUND.clack();

  await wait(rollTime * 0.45);
  SOUND.land();
  shakeTray();
  await wait(rollTime * 0.55);

  slot.classList.add("landed");
  return { slot, value };
}

// Nearest angle to `from` that is equivalent to `target` (mod 360)
const nearest = (from, target) => target + 360 * Math.round((from - target) / 360);

// The deciding last die: spotlight, slow motion, teeters on the 6 edge, then falls
async function rollDramatic(value) {
  const { slot, die } = createDie();
  slot.classList.add("last");
  tray.classList.add("spotlight");
  const slow = rollTime * 1.8;
  slot.style.setProperty("--roll-time", `${slow}ms`);
  die.style.transition = `transform ${slow}ms cubic-bezier(.1, .6, .2, 1)`;

  // Aim for the 6 face, but tipped onto an edge
  const sixX = 360 * 3;
  const sixY = 180 + 360 * 3;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  die.style.transform = `rotateX(${sixX - 38}deg) rotateY(${sixY}deg)`;
  SOUND.clack();
  setMessage("> the last die...");
  await wait(slow * 0.45);
  SOUND.land();
  shakeTray();
  await wait(slow * 0.55);

  // Teeter on the edge with a heartbeat
  setMessage("> it's... teetering... on a 6...", true);
  const teeter = reducedMotion ? 300 : 1100;
  slot.querySelector(".toss").animate(
    [{ transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0)" }],
    { duration: teeter / 2, iterations: 2, easing: "ease-in-out" }
  );
  kick(0);
  kick(0.14);
  kick(teeter / 2000);
  kick(teeter / 2000 + 0.14);
  await wait(teeter);

  // Fall: either settle onto the 6 or flop onto the real face
  die.style.transition = "transform 380ms cubic-bezier(.5, 0, .8, .4)";
  if (value === 6) {
    die.style.transform = `rotateX(${sixX}deg) rotateY(${sixY}deg)`;
  } else {
    const [fx, fy] = FACE_ROTATION[value];
    die.style.transform = `rotateX(${nearest(sixX - 38, fx) - 360}deg) rotateY(${nearest(sixY, fy)}deg)`;
  }
  await wait(400);
  SOUND.land();
  shakeTray();
  if (value !== 6) sfx(330, 0.5, { type: "triangle", vol: 0.06, to: 160 });
  await wait(reducedMotion ? 100 : 350);
  tray.classList.remove("spotlight");
  slot.classList.remove("last");
  slot.classList.add("landed");
  return { slot, value };
}

async function rollRound() {
  tray.innerHTML = "";
  const stagger = reducedMotion ? 0 : 110;
  const values = Array.from({ length: diceCount }, () => d(6));
  // If the first five have no 6, the last die decides everything
  const dramatic = !values.slice(0, -1).includes(6);
  const rolls = values.map((value, i) => {
    const isLast = i === values.length - 1;
    return wait(i * stagger).then(() => (isLast && dramatic ? rollDramatic(value) : rollDie(value)));
  });
  return Promise.all(rolls);
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
  const oneIn = top > 0 ? Math.max(1, Math.round(100 / top)) : null;
  const beats = pct >= 99.9 ? pct.toFixed(2) : pct.toFixed(1);
  return `beats ${beats}% · ` + (oneIn ? `1 in ${oneIn.toLocaleString("en-US")} games` : "off the charts");
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
  const size = wheelCanvas.clientWidth;
  const dpr = window.devicePixelRatio || 1;
  wheelCanvas.width = size * dpr;
  wheelCanvas.height = size * dpr;
  const c = wheelCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, size / 2, size / 2);
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
async function spinWheel(value) {
  const theta = (value - 1) * SEG;
  const jitter = (Math.random() - 0.5) * SEG * 0.7;
  const base = wheelRot + 360 * (5 + Math.floor(Math.random() * 3));
  wheelRot = base + mod(-theta - base, 360) + jitter;
  wheelCanvas.style.transform = `rotate(${wheelRot}deg)`;

  // Click the pointer every time a slot passes under it
  let spinning = true;
  let lastSeg = null;
  (function track() {
    const m = new DOMMatrix(getComputedStyle(wheelCanvas).transform);
    const angle = (Math.atan2(m.b, m.a) * 180) / Math.PI;
    const seg = Math.floor(mod(-angle + SEG / 2, 360) / SEG);
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
    if (spinning) requestAnimationFrame(track);
  })();

  await wait(spinTime + 150);
  spinning = false;
  wheelResultEl.textContent = value;
  paintTier(wheelResultEl, multTier(value));
  bump(wheelResultEl);
}

async function rollMultiplier() {
  wheelTitleEl.textContent = "SPIN THE D100";
  wheelResultEl.textContent = "?";
  wheelOverlay.classList.remove("leave");
  wheelOverlay.classList.add("show");
  drawWheel();
  // Entrance via Web Animations: mobile Safari can skip a CSS transition that starts
  // in the same frame the overlay becomes visible
  const wrap = wheelOverlay.querySelector(".wheel-wrap");
  await wrap.animate(
    [
      { transform: "scale(.2) rotate(-200deg)", opacity: 0 },
      { transform: "scale(1.06) rotate(8deg)", opacity: 1, offset: 0.75 },
      { transform: "none", opacity: 1 },
    ],
    { duration: reducedMotion ? 150 : 700, easing: "cubic-bezier(.3, .8, .4, 1)" }
  ).settled;

  let total = 0;
  for (let spin = 1; ; spin++) {
    const value = d(100);
    await spinWheel(value);
    total += value;
    SOUND.mult();

    if (value !== 100) break;
    showToast(`100!!!\nSPIN AGAIN`, 9);
    wheelTitleEl.textContent = `x${total} SO FAR... SPIN AGAIN!`;
    celebrate();
    diceRain(25);
    await wait(reducedMotion ? 400 : 1600);
  }
  mult = total;
  wheelMult = total;
  $("super-chance").textContent = `super ${superChance().toFixed(1)}%`;

  const tier = multTier(mult);
  wheelTitleEl.textContent = `x${mult} · ${TIERS[tier].name}`;
  if (mult >= 90) {
    setMessage(pick(HIGH_MULT_LINES), true);
    const { x, y } = centerOf(wheelResultEl);
    burst(x, y, 90);
  } else if (mult <= 5) {
    setMessage(pick(LOW_MULT_LINES));
    SOUND.sad();
  }
  await wait(reducedMotion ? 400 : 1300);

  // Shrink the wheel away toward the multiplier badge
  await wrap.animate(
    [{ transform: "none", opacity: 1 }, { transform: "translate(-42vw, -42vh) scale(.05)", opacity: 0 }],
    { duration: reducedMotion ? 100 : 500, easing: "ease-in" }
  ).settled;
  wheelOverlay.classList.remove("show", "leave");
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
    ctx.strokeStyle = i === 0 && highlight ? "#fff" : "rgba(22, 8, 40, .8)";
    ctx.lineWidth = i === 0 && highlight ? 2 : 1;
    ctx.stroke();
    // Number on faces turned toward the viewer
    if (n[2] > 0.45) {
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
      const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      const label = String(labels[i]);
      const fs = Math.round(size * (label.length > 2 ? 0.06 : 0.075) * n[2]);
      ctx.font = `${fs}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = i === 0 && highlight ? "#fff" : "#160828";
      ctx.fillText(label, cx, cy + 1);
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
    <div class="d20-roll"><canvas class="d20" width="160" height="160"></canvas><div class="d20-shadow"></div></div>
    <p class="d20-label">d1</p>`;
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
  let render = () => drawD20(c, 160, q, color, labels, false);

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
  render = () => drawD20(c, 160, q, color, labels, true);
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
  await wait(reducedMotion ? 600 : 2000);
  await stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).settled;
  stage.remove();
}

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

function setButton(mode, countdown = 0) {
  rollBtn.classList.toggle("again", mode === "again");
  rollBtn.innerHTML =
    mode === "again"
      ? `&#9650; CLIMB &amp; ROLL &#9650;<span class="auto">auto in ${countdown}</span>`
      : "&#9650; NEW GAME &#9650;";
}

// After a six the next climb rolls itself after a slow countdown (or press to go now)
const AUTO_ROLL_SECONDS = 4;
let autoTimer = null;

function startAutoRoll() {
  // Insta-autoroll: climb straight on after a short beat instead of counting down
  if (insta) {
    setButton("again", 0);
    rollBtn.querySelector(".auto").textContent = "insta!";
    autoTimer = setTimeout(play, reducedMotion ? 100 : 500);
    return;
  }
  let left = AUTO_ROLL_SECONDS;
  setButton("again", left);
  autoTimer = setInterval(() => {
    left--;
    if (left > 0) {
      setButton("again", left);
      sfx(660, 0.05, { vol: 0.03 });
    } else {
      play();
    }
  }, 1000);
}

function stopAutoRoll() {
  clearInterval(autoTimer);
  clearTimeout(autoTimer);
  autoTimer = null;
}

/* ---------- Turn flow ---------- */

async function startTurn() {
  phase = "busy";
  rollBtn.disabled = true;
  round = 0;
  floor = 0;
  pips = 0;
  totalSixes = 0;
  diceCount = BASE_DICE;
  superUsed = false;
  $("super-chance").textContent = "";
  pipsEl.textContent = "0";
  roundEl.textContent = "0";
  scoreEl.textContent = "0";
  paintTier(scoreEl, 0);
  logEl.innerHTML = "";
  tray.innerHTML = "";
  if (floorLabelEl.textContent !== "0") {
    setMessage(pick(DROP_LINES));
    sfx(900, 0.8, { to: 80, vol: 0.04 });
    setFloor(0);
    await wait(reducedMotion ? 200 : 1000);
  }
  setMessage("> spinning the d100...");

  await rollMultiplier();
  await nextRound();
}

async function nextRound() {
  phase = "busy";
  rollBtn.disabled = true;
  round++;
  setMessage(round === 1 ? `> rolling ${diceCount} dice` : `> round ${round} on floor ${floor} · ${diceCount} dice`);

  const results = await rollRound();
  const values = results.map((r) => r.value);
  const sum = values.reduce((a, b) => a + b, 0);
  addPips(sum);

  // Every 1 gets a little "oof"
  for (const { slot, value } of results) {
    if (value !== 1) continue;
    const { x, y } = centerOf(slot);
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
    showToast(`${combo.name} +${combo.bonus}`);
    SOUND.combo();
    const { x, y } = centerOf(tray);
    burst(x, y, 60);
    addPips(combo.bonus);
    extra += combo.bonus;
    await wait(reducedMotion ? 300 : 1000);
  }
  const sixes = results.filter((r) => r.value === 6);
  logRound(sum, extra, sixes.length);

  if (Math.random() < EVENT_CHANCE) await randomEvent();

  if (sixes.length) {
    // Every six grows the end die: X sixes in total earn a dX
    totalSixes += sixes.length;
    for (const { slot } of sixes) {
      slot.classList.add("six");
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
    phase = "again";
    rollBtn.disabled = false;
    rollBtn.focus();
    startAutoRoll();
    return;
  }

  setMessage(pick(MISS_LINES));
  SOUND.blub();
  await wait(reducedMotion ? 300 : 900);

  // Last chance: the lower the wheel, the likelier the superbonus die
  const superP = superUsed ? 0 : superChance() / 100;
  if (superP > 0 && Math.random() < superP) {
    superUsed = true;
    const superValue = await superBonus();
    if (superValue === 6) {
      totalSixes += 1;
      await climb(1);
      setMessage("> THE SUPERBONUS DIE SAYS: KEEP CLIMBING", true);
      phase = "again";
      rollBtn.disabled = false;
      rollBtn.focus();
      startAutoRoll();
      return;
    }
  }
  await endTurn();
}

// Chance in % = (100 - d100 wheel) / 10, so x1 gives 9.9% and x100 gives 0%
function superChance() {
  return Math.max(0, 100 - wheelMult) / 10;
}

// A giant golden die rolls in from the side for one last shot at a 6
async function superBonus() {
  showToast(`SUPERBONUS DIE!\n${superChance().toFixed(1)}% CHANCE`, 9);
  setMessage("> wait... what's that rolling in?!", true);
  flashScreen("#ffcf4a");
  SOUND.combo();
  await wait(reducedMotion ? 300 : 900);

  const stage = document.createElement("div");
  stage.className = "super-stage";
  stage.innerHTML = '<div class="super-roll"><div class="die super-die"></div></div><p class="super-label">LAST CHANCE FOR A 6</p>';
  const die = stage.querySelector(".super-die");
  for (let n = 1; n <= 6; n++) {
    const face = document.createElement("div");
    face.className = `face f${n}`;
    fillFace(face, n);
    die.appendChild(face);
  }
  document.body.appendChild(stage);

  const value = d(6);
  const [fx, fy] = FACE_ROTATION[value];
  const time = reducedMotion ? 600 : 2600;
  die.style.transition = `transform ${time}ms cubic-bezier(.2, .7, .25, 1)`;
  die.style.transform = "rotateX(-30deg) rotateY(40deg)";

  // Roll across the floor from off-screen left, bouncing to a stop
  stage.querySelector(".super-roll").animate(
    [
      { transform: "translateX(-75vw) translateY(0) rotate(-1080deg)" },
      { transform: "translateX(-10vw) translateY(-60px) rotate(-200deg)", offset: 0.55 },
      { transform: "translateX(4vw) translateY(0) rotate(20deg)", offset: 0.75 },
      { transform: "translateX(-1vw) translateY(-14px) rotate(-6deg)", offset: 0.88 },
      { transform: "translateX(0) translateY(0) rotate(0)" },
    ],
    { duration: time, easing: "cubic-bezier(.25, .8, .3, 1)", fill: "forwards" }
  );
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  die.style.transform = `rotateX(${fx + 360 * 4}deg) rotateY(${fy + 360 * 3}deg)`;
  tension(time / 1000);
  await wait(time + 100);

  const { x, y } = centerOf(die);
  if (value === 6) {
    stage.classList.add("won");
    reveal(9);
    fanfare(3);
    celebrate();
    diceRain(40);
    showToast("SUPER SIX!!!\nKEEP CLIMBING", 9);
    burst(x, y, 120);
  } else {
    stage.classList.add("lost");
    SOUND.sad();
    showToast(`${value}...\nSO CLOSE`, 0);
    floatText(x, y - 100, pick(["noooo", "the house wins", "rigged!!", "next time"]), "oof");
  }
  await wait(reducedMotion ? 600 : 1800);
  stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).onfinish = () => stage.remove();
  return value;
}

// Ride the elevator up one floor at a time with a ding each
async function climb(floors) {
  for (let i = 0; i < floors; i++) {
    floor++;
    setFloor(floor);
    roundEl.textContent = floor;
    bump(roundEl);
    SOUND.floorDing(i);
    await wait(reducedMotion ? 60 : 260);
    if (floor % FLOORS_PER_DIE === 0) await milestone();
  }
  const tier = floorTier(floor);
  setMessage(`> *ding* floor ${floor} · ${TIERS[tier].name}`, true);
}

// Every 5th floor: elevator doors slam shut, a new red die is handed over, doors fly open
async function milestone() {
  const gift = diceCount < MAX_DICE;
  if (gift) diceCount++;
  const doors = document.createElement("div");
  doors.className = "doors";
  doors.innerHTML = `
    <div class="door left"></div><div class="door right"></div>
    <div class="door-sign">
      <span class="door-floor">FLOOR ${floor}</span>
      <div class="mini door-die"></div>
      <span class="door-gift">${gift ? `+1 RED DIE · NOW ${diceCount}` : `TABLE FULL · ${MAX_DICE} DICE MAX`}</span>
    </div>`;
  fillFace(doors.querySelector(".door-die"), 6);
  document.body.appendChild(doors);
  const left = doors.querySelector(".left");
  const right = doors.querySelector(".right");
  const sign = doors.querySelector(".door-sign");
  const t = reducedMotion ? 0.3 : 1;

  // Slam shut
  const close = { duration: 320 * t, easing: "cubic-bezier(.6, 0, 1, .6)", fill: "forwards" };
  left.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }], close);
  await right.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], close).settled;
  kick(0);
  noise(0.4, { vol: 0.15, hp: 400 });
  shakeTray();

  // The gift: sign pops, the die spins in, big fanfare
  sign.animate(
    [{ transform: "scale(0) rotate(-20deg)", opacity: 0 }, { transform: "scale(1.15) rotate(4deg)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }],
    { duration: 500 * t, easing: "ease-out", fill: "forwards" }
  );
  doors.querySelector(".door-die").animate(
    [{ transform: "translateY(-200px) rotate(-720deg)" }, { transform: "translateY(0) rotate(0)" }],
    { duration: 900 * t, easing: "cubic-bezier(.3, 1.4, .5, 1)" }
  );
  fanfare(4);
  arp([1046, 1318, 1568, 2093], 0.12, { type: "triangle", vol: 0.06, delay: 0.2 });
  setMessage(gift ? `> floor ${floor}! the elevator gifts you die #${diceCount}` : `> floor ${floor}! the table can't fit more dice`, true);
  await wait(1800 * t);

  // Doors fly open and dice pour out
  const open = { duration: 450 * t, easing: "cubic-bezier(.2, .8, .3, 1)", fill: "forwards" };
  sign.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(1.6)" }], open);
  left.animate([{ transform: "translateX(0)" }, { transform: "translateX(-105%)" }], open);
  await right.animate([{ transform: "translateX(0)" }, { transform: "translateX(105%)" }], open).settled;
  diceRain(30);
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
  if (totalSixes) await rollEndDie();

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
    <div class="cine-tier">${TIERS[tier].name}</div>
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
  paintTier(goCard, 0);
  paintTier(goScoreEl, 0);
  paintTier(goTierEl, 0);
  $("go-chips").textContent = pips;
  $("go-mult").textContent = "x" + mult;
  $("go-floors").textContent = floor;
  $("go-rounds").textContent = round;
  $("go-odds").textContent = "...";
  gameoverEl.classList.add("show");
  await wait(reducedMotion ? 100 : 600);

  // Quick recap: the cinematic already did the big reveal
  const duration = reducedMotion ? 300 : 1100;
  const start = performance.now();
  let shownTier = -1;
  await new Promise((resolve) => {
    function step(now) {
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
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });

  SOUND.combo();
  goCard.animate([{ transform: "scale(1.08)" }, { transform: "none" }], { duration: 350, easing: "ease-out" });
  const { x, y } = centerOf(goScoreEl);
  burst(x, y, 30 + shownTier * 10);

  // Type out how this score ranks against 200,000 simulated games
  const text = formatRank(final);
  const oddsEl = $("go-odds");
  for (let i = 1; i <= text.length; i++) {
    oddsEl.textContent = text.slice(0, i);
    if (i % 2) SOUND.tick();
    await wait(reducedMotion ? 0 : 25);
  }
  $("new-game").focus();
}

$("new-game").addEventListener("click", () => {
  gameoverEl.classList.remove("show");
  play();
});

function play() {
  stopAutoRoll();
  if (phase === "idle") {
    gameoverEl.classList.remove("show");
    startTurn();
  } else if (phase === "again") {
    setButton("idle");
    nextRound();
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
  // Switching on mid-countdown skips the rest of the wait
  if (insta && phase === "again") play();
});

const splashEl = $("splash");
splashEl.addEventListener("click", () => {
  audio();
  SOUND.combo();
  splashEl.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(1.1)" }], { duration: 400, fill: "forwards" }).onfinish = () =>
    splashEl.remove();
  rollBtn.focus();
});

rollBtn.addEventListener("click", play);
document.addEventListener("keydown", (e) => {
  if ((e.code === "Space" || e.code === "Enter") && !rollBtn.disabled && document.activeElement !== rollBtn) {
    e.preventDefault();
    play();
  }
});

/* ---------- Drifting dice you can tap ---------- */

const MAX_DRIFTERS = reducedMotion ? 4 : 10;

function spawnDrifter(fast = false) {
  if (!fast && driftEl.childElementCount >= MAX_DRIFTERS) return;
  const el = document.createElement("button");
  el.type = "button";
  el.className = "drifter";
  el.setAttribute("aria-label", "Drifting die");
  if (Math.random() < 0.06) el.classList.add("golden");

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
}, 1300);
for (let i = 0; i < 4; i++) setTimeout(spawnDrifter, i * 300);

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
