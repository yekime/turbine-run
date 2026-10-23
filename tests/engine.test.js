import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, course, step, steer, jump, slam, boost, speed, surface, carZ, LENGTH, GATE_BOOST, JUMP_APEX, CLEARANCE, DECK, RAMP } from '../src/engine.js';

const playing = seed => { const g = createGame(seed); g.mode = 'playing'; return g; };
const clear = g => { g.events = []; g.platforms = []; g.gates = []; return g; };
function runFor(g, seconds, hz) { const n = Math.round(seconds * hz); for (let i = 0; i < n; i++) step(g, 1 / hz); }

test('pint fuels a manually activated boost', () => {
  const g = clear(playing()); g.events = [{ z: carZ(g) + 1, lane: 0, type: 'pint' }]; step(g, .05);
  assert.equal(g.pints, 1); assert.equal(g.fuel, 1); assert.equal(g.boost, 0);
  assert(boost(g)); assert.equal(g.fuel, 0); assert(!boost(g));
});
test('jump clears a cow and a sheep but never a tractor', () => {
  assert(JUMP_APEX > CLEARANCE.cow && JUMP_APEX < CLEARANCE.tractor);
  for (const type of ['cow', 'sheep', 'tractor']) {
    const g = clear(playing()); jump(g); runFor(g, .35, 240);
    g.events = [{ z: carZ(g) + 1, lane: 0, type }]; step(g, .02);
    assert.equal(g.lives, type === 'tractor' ? 2 : 3, type);
  }
});
test('jump is a parabola: apex near JUMP_APEX, lands, cannot retrigger in flight', () => {
  const g = clear(playing()); assert(jump(g)); assert(!jump(g)); let top = 0;
  for (let i = 0; i < 400 && (!g.grounded || i < 2); i++) { step(g, 1 / 240); top = Math.max(top, g.y); }
  assert(Math.abs(top - JUMP_APEX) < .05); assert(g.grounded); assert.equal(g.y, 0); assert(jump(g));
});
test('swipe down slams to the ground much faster than falling', () => {
  const fall = clear(playing()); jump(fall); runFor(fall, .25, 240); const slammed = structuredClone(fall);
  assert(slam(slammed)); assert(!slam(clear(playing())), 'no slam on the ground');
  let a = 0, b = 0; while (!fall.grounded) { step(fall, 1 / 240); a++; } while (!slammed.grounded) { step(slammed, 1 / 240); b++; }
  assert(b < a / 2); assert(slammed.lastImpact > 25);
});
test('switching lanes in the air counts a flip; on the ground it does not', () => {
  const g = clear(playing()); steer(g, 1); assert.equal(g.flips, 0); jump(g); step(g, .05); steer(g, -1);
  assert.equal(g.flips, 1); assert.equal(g.flipDir, -1);
});
test('blade ramp lifts the car onto the deck and it drops off the end', () => {
  const g = clear(playing()); const z0 = carZ(g) + 5; g.platforms = [{ z0, z1: z0 + 120, lane: 0, type: 'blade', ramp: true, height: DECK.blade }];
  let maxY = 0; for (let i = 0; i < 400; i++) { step(g, 1 / 120); maxY = Math.max(maxY, g.y); }
  assert.equal(g.lives, 3); assert(Math.abs(maxY - DECK.blade) < .01); assert(g.grounded); assert.equal(g.y, 0);
});
test('tanker has no ramp: driving into it hurts, jumping onto it does not', () => {
  const hit = clear(playing()); const z0 = carZ(hit) + 20; hit.platforms = [{ z0, z1: z0 + 125, lane: 0, type: 'tanker', ramp: false, height: DECK.tanker }];
  runFor(hit, .6, 240); assert.equal(hit.lives, 2);
  const hop = clear(playing()); hop.platforms = [{ z0: carZ(hop) + 40, z1: carZ(hop) + 165, lane: 0, type: 'tanker', ramp: false, height: DECK.tanker }];
  jump(hop); runFor(hop, .9, 240); assert.equal(hop.lives, 3); assert(hop.y > DECK.tanker - .01);
});
test('the side of a truck blocks a lane change on the ground', () => {
  const g = clear(playing()); g.platforms = [{ z0: carZ(g) - 50, z1: carZ(g) + 100, lane: 1, type: 'blade', ramp: true, height: DECK.blade }];
  assert(!steer(g, 1)); assert.equal(g.lane, 0); assert.equal(g.bumps, 1);
  assert.equal(surface(g, 1), DECK.blade); assert.equal(surface(g, 0), 0);
});
test('boost rams through livestock and tractors without damage', () => {
  const g = clear(playing()); g.fuel = 1; boost(g);
  g.events = ['cow', 'tractor', 'sheep'].map((type, i) => ({ z: carZ(g) + 2 + i * 5, lane: 0, type })); runFor(g, .5, 240);
  assert.equal(g.lives, 3); assert.equal(g.smashed, 3); assert(g.events.every(e => e.smashed));
});
test('invulnerability protects consecutive impacts; three separate hits end the run', () => {
  const g = clear(playing()); g.events = [{ z: carZ(g) + 1, lane: 0, type: 'cow' }, { z: carZ(g) + 3, lane: 0, type: 'tractor' }]; runFor(g, .1, 240);
  assert.equal(g.lives, 2);
  const h = clear(playing()); for (let i = 0; i < 3; i++) { h.invincible = 0; h.events = [{ z: carZ(h) + 1, lane: 0, type: 'tractor' }]; step(h, .05); }
  assert.equal(h.mode, 'lost');
});
test('course finishes and freezes', () => { const g = clear(playing()); g.distance = LENGTH - 1; step(g, .05); assert.equal(g.mode, 'won'); step(g, .05); assert.equal(g.distance, LENGTH); });
test('each neon gate adds speed for the rest of the run; rows tighten', () => {
  const g = clear(playing()); g.gates = [carZ(g) + 2, carZ(g) + 30]; const initial = speed(g);
  const sounds = step(g, .05); assert(sounds.includes('gate')); assert.equal(g.gatesPassed, 1); assert.equal(speed(g), initial + GATE_BOOST);
  runFor(g, 1, 60); assert.equal(g.gatesPassed, 2); assert.equal(speed(g), initial + 2 * GATE_BOOST);
  const full = createGame(); assert(full.gates.length * GATE_BOOST > 30, 'gates add at least 30 mph over the run');
  const zs = [...new Set(course().events.filter(e => !e.bonus).map(e => e.z))]; assert(zs.at(-1) - zs.at(-2) < zs[1] - zs[0]);
});
test('identical results at 30, 60 and 120 Hz', () => {
  const results = [30, 60, 120].map(hz => { const g = clear(playing()); g.fuel = 1; boost(g); steer(g, 1); jump(g); runFor(g, 3, hz); return g; });
  for (const g of results) { assert(Math.abs(g.x - results[0].x) < 1e-9); assert(Math.abs(g.distance - results[0].distance) < 1e-6); assert(Math.abs(g.y - results[0].y) < 1e-9); }
});
test('trucks never sit in a safe lane and never split the safe path', () => {
  for (let seed = 0; seed < 200; seed++) {
    const { events, platforms } = course(seed);
    for (const p of platforms) {
      assert(!events.some(e => e.type !== 'pint' && e.lane === p.lane && e.z >= p.z0 && e.z <= p.z1), `seed ${seed}: obstacle inside a truck`);
      const safes = new Set(events.filter(e => e.type === 'pint' && !e.bonus && e.z > p.z0 - 90 && e.z < p.z1 + 70).map(e => e.lane));
      assert(!safes.has(p.lane), `seed ${seed}: truck in a safe lane`);
      if (p.lane === 0) assert(safes.size <= 1, `seed ${seed}: middle truck splits the path`);
    }
  }
});
test('safe-lane autopilot finishes seeded courses without damage', () => {
  for (const seed of [1, 42, 1981, 2026, 4294967295]) {
    const g = playing(seed);
    while (g.mode === 'playing' && g.time < 140) {
      const t = g.events.find(e => !e.done && e.type === 'pint' && !e.bonus);
      if (t) while (g.lane !== t.lane && steer(g, Math.sign(t.lane - g.lane)));
      if (g.fuel) boost(g); step(g, 1 / 60);
    }
    assert.equal(g.mode, 'won', `seed ${seed}`); assert.equal(g.lives, 3, `seed ${seed}`);
  }
});
test('pause freezes the run; invalid deltas cannot corrupt it', () => {
  const g = clear(playing()); jump(g); g.fuel = 2; boost(g); g.mode = 'paused'; const snap = JSON.stringify(g);
  steer(g, 1); assert(!jump(g)); assert(!slam(g)); assert(!boost(g)); step(g, .05); assert.equal(JSON.stringify(g), snap);
  g.mode = 'playing'; const active = JSON.stringify(g); for (const dt of [-1, 0, NaN, Infinity]) step(g, dt); assert.equal(JSON.stringify(g), active);
});
test('bonus pints sit on truck decks at deck height', () => {
  const { events, platforms } = course(1981);
  const bonus = events.filter(e => e.bonus); assert(bonus.length > 0);
  for (const e of bonus) { const p = platforms.find(p => p.lane === e.lane && e.z > p.z0 + RAMP && e.z < p.z1); assert(p); assert(Math.abs(e.y - p.height - .55) < 1e-9); }
});
