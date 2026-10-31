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
const SCORE_TIERS = [0, 100, 300, 750, 1500, 3000, 6000, 12000, 25000, 50000];

const multTier = (m) => Math.min(9, Math.floor((m - 1) / 10));
const floorTier = (f) => Math.min(9, Math.max(0, f - 1));
const scoreTier = (s) => SCORE_TIERS.findLastIndex((t) => s >= t);

function paintTier(el, tier) {
  el.style.setProperty("--tc", TIERS[tier].color);
  el.classList.toggle("jackpot", tier === 9);
}

const BASE_DICE = 6;
// Every this many floors the elevator hands you one more red die
const FLOORS_PER_DIE = 5;
// Each extra round is worth this much more than the last: +10, +20, +30...
const BONUS_STEP = 10;
// Golden drifting dice add this to the multiplier
const GOLDEN_MULT = 5;
// Pixel height of one tower floor in the background (matches style.css)
const FLOOR_HEIGHT = 120;

// Which 3x3 grid cells hold a pip for each face (1 = top-left, 9 = bottom-right)
const PIPS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

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

// Lazily creates the audio graph; a compressor keeps stacked fanfares from clipping
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
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Browsers only allow audio after a user gesture, so unlock it on the first one
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => audio(), { once: true });
}

function sfx(freq, dur, { type = "square", vol = 0.04, to = null, delay = 0, attack = 0 } = {}) {
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
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// White noise through a high-pass filter: kicks, snares and cymbals
function noise(dur, { vol = 0.1, delay = 0, hp = 1000 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hp;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
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

function fillFace(face, n) {
  face.innerHTML = "";
  for (const cell of PIPS[n]) {
    const pip = document.createElement("span");
    pip.className = "pip";
    pip.style.gridRow = Math.ceil(cell / 3);
    pip.style.gridColumn = ((cell - 1) % 3) + 1;
    face.appendChild(pip);
  }
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

/* ---------- Odds of this exact game ---------- */

let odds = 1;
const choose = (n, k) => (k === 0 || k === n ? 1 : choose(n - 1, k - 1) + choose(n - 1, k));
// Chance that exactly k of the rolled dice show a 6
const sixesChance = (k) => choose(diceCount, k) * Math.pow(1 / 6, k) * Math.pow(5 / 6, diceCount - k);

function formatOdds(p) {
  const pct = p * 100;
  const text = pct >= 0.01 ? pct.toFixed(2) : pct.toPrecision(2);
  return `${text}% · 1 in ${Math.round(1 / p).toLocaleString("en-US")}`;
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
  await wait(reducedMotion ? 100 : 500);

  let total = 0;
  for (let spin = 1; ; spin++) {
    const value = d(100);
    odds *= 1 / 100;
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
  wheelOverlay.classList.add("leave");
  await wait(reducedMotion ? 100 : 500);
  wheelOverlay.classList.remove("show", "leave");
  setMult(mult);
}

function setMult(value) {
  paintTier(multEl, multTier(value));
  multValueEl.textContent = "x" + value;
  bump(multValueEl);
}

/* ---------- The end die: a d(total sixes) ---------- */

async function rollEndDie() {
  const sides = totalSixes;
  tray.innerHTML = "";
  setMessage(sides === 1 ? "> a d1?! it's a 1. it's always a 1." : `> ${sides} sixes forged a d${sides}!`, true);

  const el = document.createElement("div");
  el.className = "end-die";
  el.innerHTML = '<span class="bd-value">?</span><span class="bd-label">d1</span>';
  tray.appendChild(el);
  const valueEl = el.querySelector(".bd-value");
  const labelEl = el.querySelector(".bd-label");
  paintTier(el, 0);

  // Drop in spinning and slam onto the felt
  await el.animate(
    [
      { transform: "translateY(-260px) rotate(-540deg) scale(.2)", opacity: 0 },
      { transform: "translateY(0) rotate(0) scale(1.15)", opacity: 1, offset: 0.8 },
      { transform: "scale(1)" },
    ],
    { duration: reducedMotion ? 200 : 700, easing: "cubic-bezier(.3, .7, .4, 1)" }
  ).finished;
  kick(0);
  shakeTray();

  // Forge it: the die grows one side per six, climbing the tier colors
  const step = reducedMotion ? 30 : Math.max(60, 600 / sides);
  for (let n = 1; n <= sides; n++) {
    labelEl.textContent = `d${n}`;
    paintTier(el, Math.min(9, n - 1));
    el.style.setProperty("--grow", 1 + Math.min(n, 12) * 0.04);
    sfx(400 * Math.pow(2, Math.min(n, 24) / 12), 0.08, { vol: 0.05 });
    await wait(step);
  }

  // Spin and scramble like a slot reel, then slam down on the result
  const grow = 1 + Math.min(sides, 12) * 0.04;
  const spin = el.animate([{ transform: `rotateY(0) scale(${grow})` }, { transform: `rotateY(360deg) scale(${grow})` }], {
    duration: 300,
    iterations: Infinity,
  });
  tension(reducedMotion ? 0.5 : 1.6);
  let delay = 40;
  for (let elapsed = 0; elapsed < (reducedMotion ? 400 : 1600); elapsed += delay, delay *= 1.12) {
    valueEl.textContent = d(sides);
    SOUND.tick();
    await wait(delay);
  }
  spin.cancel();

  const value = d(sides);
  odds *= 1 / sides;
  valueEl.textContent = value;
  reveal(Math.min(9, sides - 1));
  el.animate([{ transform: "scale(1.6)" }, { transform: `scale(${grow})` }], { duration: 300, easing: "ease-out" });
  shakeTray();
  const { x, y } = centerOf(el);
  burst(x, y, 30 + sides * 8);
  sparkles(x, y, 20);

  mult += value;
  setMult(mult);
  showToast(`END DIE d${sides}\n+${value} MULTI`, multTier(mult));
  await wait(reducedMotion ? 400 : 1500);
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
  odds = 1;
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
  odds *= sixesChance(sixes.length);
  logRound(sum, extra, sixes.length);

  if (Math.random() < EVENT_CHANCE) await randomEvent();
  else odds *= 1 - EVENT_CHANCE;

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
    odds *= superP * (superValue === 6 ? 1 / 6 : 5 / 6);
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
  } else {
    odds *= 1 - superP;
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
  diceCount++;
  const doors = document.createElement("div");
  doors.className = "doors";
  doors.innerHTML = `
    <div class="door left"></div><div class="door right"></div>
    <div class="door-sign">
      <span class="door-floor">FLOOR ${floor}</span>
      <div class="mini door-die"></div>
      <span class="door-gift">+1 RED DIE · NOW ${diceCount}</span>
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
  await right.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], close).finished;
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
  setMessage(`> floor ${floor}! the elevator gifts you die #${diceCount}`, true);
  await wait(1800 * t);

  // Doors fly open and dice pour out
  const open = { duration: 450 * t, easing: "cubic-bezier(.2, .8, .3, 1)", fill: "forwards" };
  sign.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(1.6)" }], open);
  left.animate([{ transform: "translateX(0)" }, { transform: "translateX(-105%)" }], open);
  await right.animate([{ transform: "translateX(0)" }, { transform: "translateX(105%)" }], open).finished;
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
  odds *= EVENT_CHANCE / EVENTS.length;
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

  // Drumroll suspense before the multiplier hits
  const suspense = reducedMotion ? 0.8 : 2.6;
  tension(suspense);
  setMessage(`> ${pips} chips x${mult} = ???`, true);
  scoreEl.textContent = "???";
  const shake = [{ transform: "none" }, { transform: "translate(-3px, 2px)" }, { transform: "translate(3px, -2px)" }, { transform: "none" }];
  const shakes = [multEl, scoreEl.parentElement].map((el) =>
    el.animate(shake, { duration: 160, iterations: Infinity, easing: "steps(4)" })
  );
  const dim = document.createElement("div");
  dim.className = "flash";
  dim.style.background = "#000";
  document.body.appendChild(dim);
  dim.animate([{ opacity: 0 }, { opacity: 0.45 }], { duration: suspense * 1000, fill: "forwards" });
  showToast(`${pips} CHIPS\nx${mult}`, multTier(mult));
  await wait(suspense * 1000);
  shakes.forEach((a) => a.cancel());
  dim.remove();

  reveal(tier);
  flashScreen(TIERS[tier].color);
  paintTier(scoreEl, tier);
  showToast(`${final}\n${TIERS[tier].name}`, tier);
  const { x, y } = centerOf(scoreEl);
  burst(x, y, 40 + tier * 12);
  await countUp(scoreEl, pips, final, reducedMotion ? 300 : 700);
  bump(scoreEl);
  await wait(300);
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

  const duration = reducedMotion ? 400 : 2200;
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

  reveal(shownTier);
  goCard.animate([{ transform: "scale(1.08)" }, { transform: "none" }], { duration: 350, easing: "ease-out" });
  const { x, y } = centerOf(goScoreEl);
  burst(x, y, 30 + shownTier * 10);

  // Type out the odds of this exact game
  const text = formatOdds(odds);
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

const MAX_DRIFTERS = reducedMotion ? 4 : 14;

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
  face.classList.toggle("one", value === 1);
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
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
