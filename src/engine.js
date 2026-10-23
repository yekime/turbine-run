// Deterministic run simulation. Distance is in course units (0.3 m each in the renderer);
// height (y) is in metres. Fixed 240 Hz substeps make every frame rate play identically.
export const LENGTH = 6200;
export const COLLISION_OFFSET = 110;
export const GRAVITY = 34;
export const JUMP_VELOCITY = 13.2;
export const SLAM_VELOCITY = -36;
export const JUMP_DURATION = 2 * JUMP_VELOCITY / GRAVITY;
export const JUMP_APEX = JUMP_VELOCITY * JUMP_VELOCITY / (2 * GRAVITY);
export const RAMP = 15;
export const DECK = { blade: 2.6, tanker: 1.85 };
export const CLEARANCE = { cow: 1.7, sheep: .95, goat: 1.0, bale: 1.6, kegs: 1.45, tractor: 2.7, caravan: 3.2 };
// Low obstacles you can jump; tall ones you must dodge or ram with boost.
const LOW = ['cow', 'cow', 'sheep', 'goat', 'bale', 'kegs'], TALL = ['tractor', 'caravan'];
export const BOOST_TIME = 2.4;
// Neon gates: every one you drive through adds speed for the rest of the run.
export const GATE_SPACING = 300, GATE_BOOST = 3.2, FIRST_GATE = 420;
const LANE_RESPONSE = 14;
const ACCELERATION = 36 / LENGTH;
const H = 1 / 240;

export function course(seed = 1981) {
  let s = seed >>> 0;
  const random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rows = [];
  for (let z = 370; z < LENGTH - 350; z += 195 - 75 * (z / LENGTH)) {
    const safe = Math.floor(random() * 3) - 1;
    const others = [-1, 0, 1].filter(x => x !== safe);
    const row = { z, safe, items: [{ z, lane: safe, type: 'pint' }] };
    const pick = () => random() > .4 ? LOW[Math.floor(random() * LOW.length)] : TALL[Math.floor(random() * TALL.length)];
    row.items.push({ z, lane: others[0], type: pick() });
    if (random() > (.65 - .48 * (z / LENGTH))) row.items.push({ z, lane: others[1], type: pick() });
    rows.push(row);
  }
  // Trucks: a blade transporter with a ramp you can drive up, or a tanker you must jump onto.
  const platforms = [];
  for (let i = 2; i < rows.length - 4; i++) {
    if (rows[i].z < 650 || rows[i].z > LENGTH - 700 || random() > .34) continue;
    const span = 1 + Math.floor(random() * 2);
    const tanker = random() < .35;
    const type = tanker ? 'tanker' : 'blade';
    const z0 = rows[i].z - (tanker ? 55 : 70), z1 = tanker ? z0 + 125 : rows[i + span - 1].z + 40;
    const nearby = rows.filter(r => r.z > z0 - 90 && r.z < z1 + 70);
    const safes = new Set(nearby.map(r => r.safe));
    // Never park a truck in a safe lane, and never make the safe path cross the middle lane's truck.
    const options = [-1, 0, 1].filter(l => !safes.has(l) && (l !== 0 || safes.size === 1));
    if (!options.length) continue;
    const lane = options[Math.floor(random() * options.length)];
    if (platforms.some(p => p.z1 > z0 - 140)) continue;
    platforms.push({ z0, z1, lane, type, ramp: !tanker, height: DECK[type] });
    for (const r of nearby) r.items = r.items.filter(item => item.lane !== lane);
    for (let z = z0 + RAMP + 12; z < z1 - 8; z += 24) rows[i].items.push({ z, lane, type: 'pint', y: DECK[type] + .55, bonus: true });
    i += span + 1;
  }
  const events = rows.flatMap(r => r.items).map(e => ({ ...e, done: false })).sort((a, b) => a.z - b.z);
  const gates = []; for (let z = FIRST_GATE; z < LENGTH - 150; z += GATE_SPACING) gates.push(z);
  return { events, platforms, gates };
}

export function speed(g) { return 72 + (g.gatesPassed || 0) * GATE_BOOST + (g.boost > 0 ? 40 : 0); }

export function createGame(seed = 1981) {
  const { events, platforms, gates } = course(seed);
  return { mode: 'ready', distance: 0, lane: 0, x: 0, y: 0, vy: 0, grounded: true, slamming: false,
    lives: 3, pints: 0, boost: 0, fuel: 0, invincible: 0, time: 0, hits: 0, smashed: 0,
    flips: 0, flipDir: 0, bumps: 0, landings: 0, lastImpact: 0, acc: 0, events, platforms, gates, gatesPassed: 0 };
}

/** Car position along the course in event coordinates. */
export function carZ(g) { return g.distance + COLLISION_OFFSET; }

export function surface(g, lane, z = carZ(g)) {
  let top = 0;
  for (const p of g.platforms) {
    if (p.lane !== lane || z < p.z0 || z > p.z1) continue;
    top = Math.max(top, p.ramp && z < p.z0 + RAMP ? p.height * (z - p.z0) / RAMP : p.height);
  }
  return top;
}
const laneUnder = g => Math.max(-1, Math.min(1, Math.round(g.x)));

export function steer(g, dir) {
  if (g.mode !== 'playing' || !Number.isFinite(dir) || !dir) return false;
  const target = Math.max(-1, Math.min(1, g.lane + Math.sign(dir)));
  if (target === g.lane) return false;
  if (surface(g, target) > g.y + .6) { g.bumps++; return false; }
  if (!g.grounded) { g.flips++; g.flipDir = Math.sign(dir); }
  g.lane = target; return true;
}
export function jump(g) {
  if (g.mode !== 'playing' || !g.grounded) return false;
  g.vy = JUMP_VELOCITY; g.grounded = false; g.slamming = false; return true;
}
export function slam(g) {
  if (g.mode !== 'playing' || g.grounded) return false;
  g.vy = Math.min(g.vy, SLAM_VELOCITY); g.slamming = true; return true;
}
/** Kept for the renderer and tests: current height in metres. */
export function jumpHeight(g) { return g.y; }
export function boost(g) {
  if (g.mode === 'playing' && g.fuel > 0 && g.boost <= 0) { g.fuel--; g.boost = BOOST_TIME; return true; }
  return false;
}

function hurt(g, sounds) {
  g.lives--; g.hits++; g.boost = 0; g.invincible = 2; sounds.push('hit');
  if (g.lives <= 0) { g.mode = 'lost'; sounds.push('lost'); }
}

function substep(g, sounds) {
  const before = carZ(g);
  g.distance = Math.min(LENGTH, g.distance + speed(g) * H);
  g.time += H;
  g.x += (g.lane - g.x) * -Math.expm1(-LANE_RESPONSE * H);
  g.invincible = Math.max(0, g.invincible - H);
  g.boost = Math.max(0, g.boost - H);
  const c = carZ(g), top = surface(g, laneUnder(g), c);
  if (g.grounded) {
    if (top < g.y - .05) g.grounded = false;
    else if (top > g.y + .5) {
      // Ran into the back of a tanker. Boost lifts you over it; otherwise it costs bodywork.
      if (g.boost <= 0 && g.invincible <= 0) hurt(g, sounds);
      g.y = top; g.vy = 5; g.grounded = false;
    } else g.y = top;
  }
  if (!g.grounded) {
    g.vy -= GRAVITY * H; g.y += g.vy * H;
    if (top > g.y + .5) {
      if (g.boost <= 0 && g.invincible <= 0) hurt(g, sounds);
      g.y = top; g.vy = 4;
    }
    if (g.y <= top) {
      g.lastImpact = -g.vy; g.y = top; g.vy = 0; g.grounded = true; g.landings++;
      sounds.push(g.slamming ? 'slam' : 'land'); g.slamming = false;
    }
  }
  while (g.gatesPassed < g.gates.length && g.gates[g.gatesPassed] <= c) { g.gatesPassed++; sounds.push('gate'); }
  for (const e of g.events) {
    if (e.done) continue;
    if (e.z > c) break;
    if (e.z <= before - 1) { e.done = true; continue; }
    e.done = true;
    if (Math.abs(e.lane - g.x) >= .57) continue;
    if (e.type === 'pint') {
      if (Math.abs(g.y - (e.y || 0)) > 1.7) continue;
      e.collected = true; g.pints++; g.fuel = Math.min(5, g.fuel + 1); sounds.push('pint'); continue;
    }
    if (g.y >= CLEARANCE[e.type]) continue;
    if (g.boost > 0) { e.smashed = true; g.smashed++; sounds.push('smash'); continue; }
    if (g.invincible > 0) continue;
    e.hit = true; hurt(g, sounds);
    if (g.mode !== 'playing') return;
  }
  if (g.distance >= LENGTH) { g.distance = LENGTH; g.mode = 'won'; sounds.push('won'); }
}

export function step(g, dt) {
  if (g.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return [];
  g.acc += Math.min(.05, dt);
  const sounds = [];
  let n = Math.floor(g.acc / H + 1e-6);
  g.acc = Math.max(0, g.acc - n * H);
  while (n-- > 0 && g.mode === 'playing') substep(g, sounds);
  return sounds;
}
