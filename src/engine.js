export const LENGTH = 6200;
export const COLLISION_OFFSET = 110;
export const JUMP_DURATION = 1.05;
export const JUMP_CLEARANCE = 0.5;
const LANE_RESPONSE = 14;
const ACCELERATION = 36 / LENGTH;
const EPSILON = 1e-7;

export function course(seed = 1981) {
  let s = seed;
  const random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rows = [];
  for (let z = 370; z < LENGTH - 350; z += 195 - 75 * (z / LENGTH)) {
    const safe = Math.floor(random() * 3) - 1;
    rows.push({ z, lane: safe, type: 'pint', done: false });
    const choices = [-1, 0, 1].filter(x => x !== safe);
    rows.push({ z, lane: choices[0], type: random() > .43 ? 'cow' : 'tractor', done: false });
    if (random() > (.65 - .48 * (z / LENGTH))) {
      rows.push({ z, lane: choices[1], type: random() > .65 ? 'tractor' : 'sheep', done: false });
    }
  }
  return rows;
}

export function speed(g) { return 72 + Math.min(1, g.distance / LENGTH) * 36 + (g.boost > 0 ? 40 : 0); }
export function createGame(seed = 1981) {
  return { mode: 'ready', distance: 0, lane: 0, x: 0, lives: 3, pints: 0, boost: 0,
    fuel: 0, jump: 0, invincible: 0, time: 0, events: course(seed), hits: 0 };
}
export function steer(g, dir) {
  if (g.mode === 'playing' && Number.isFinite(dir)) g.lane = Math.max(-1, Math.min(1, g.lane + Math.sign(dir)));
}
export function jump(g) {
  if (g.mode === 'playing' && g.jump <= 0) { g.jump = JUMP_DURATION; return true; }
  return false;
}
export function jumpHeight(g) {
  if (g.jump <= 0) return 0;
  const progress = Math.max(0, Math.min(1, 1 - g.jump / JUMP_DURATION));
  return 4 * progress * (1 - progress);
}
export function boost(g) {
  if (g.mode === 'playing' && g.fuel > 0 && g.boost <= 0) { g.fuel--; g.boost = 2.4; return true; }
  return false;
}

// Exact integration of the gradual speed ramp. Split at collisions and boost expiry
// so the same input timing produces the same result at different frame rates.
function travelTime(g, target) {
  return Math.log1p(Math.max(0, target - g.distance) * ACCELERATION / speed(g)) / ACCELERATION;
}
function advance(g, dt) {
  g.distance += speed(g) * Math.expm1(ACCELERATION * dt) / ACCELERATION;
  g.x += (g.lane - g.x) * -Math.expm1(-LANE_RESPONSE * dt);
  g.time += dt;
  g.jump = Math.max(0, g.jump - dt);
  g.invincible = Math.max(0, g.invincible - dt);
  g.boost = Math.max(0, g.boost - dt);
}
export function step(g, dt) {
  if (g.mode !== 'playing' || !Number.isFinite(dt) || dt <= 0) return [];
  let remaining = Math.min(.05, dt);
  const sounds = [];
  while (remaining > EPSILON && g.mode === 'playing') {
    let next = LENGTH;
    for (const e of g.events) if (!e.done) next = Math.min(next, Math.max(g.distance, e.z - COLLISION_OFFSET));
    const duration = Math.min(remaining, travelTime(g, next), g.boost > 0 ? g.boost : Infinity);
    advance(g, duration);
    remaining -= duration;
    if (g.boost < EPSILON) g.boost = 0;
    for (const e of g.events) {
      if (e.done || e.z > g.distance + COLLISION_OFFSET + EPSILON) continue;
      e.done = true;
      if (Math.abs(e.lane - g.x) >= .57) continue;
      if (e.type === 'pint') {
        e.collected = true;
        g.pints++; g.fuel = Math.min(5, g.fuel + 1); sounds.push('pint');
      } else if (g.invincible <= EPSILON && !(e.type !== 'tractor' && jumpHeight(g) >= JUMP_CLEARANCE)) {
        g.lives--; g.hits++; g.boost = 0; g.invincible = 2; sounds.push('hit');
        if (g.lives === 0) { g.mode = 'lost'; sounds.push('lost'); break; }
      }
    }
    if (g.mode === 'playing' && g.distance >= LENGTH - EPSILON) {
      g.distance = LENGTH; g.mode = 'won'; sounds.push('won');
    }
  }
  return sounds;
}
