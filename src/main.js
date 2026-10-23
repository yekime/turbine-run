import { createGame, step, steer, jump, slam, boost, LENGTH, FUEL_PER_BOOST } from './engine.js';
import { createRenderer } from './renderer.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('stage');
let game = createGame();
let scene, noticeTimer, last = 0, soundWanted = true, seed = 1981;
const audio = createAudio();
try { scene = createRenderer(canvas); }
catch (error) { $('error').hidden = false; $('start').disabled = true; $('lc-load').hidden = true; console.error('Unable to start renderer', error); }

function setSound(on, quiet = false) {
  soundWanted = on;
  if (!quiet) { if (on) audio.enable(); else audio.disable(); }
  $('sound').setAttribute('aria-pressed', String(on));
  $('sound').setAttribute('aria-label', on ? 'Mute sound' : 'Enable sound');
  $('sound').classList.toggle('off', !on);
}
// Browsers only start audio after a gesture; the first press anywhere starts it.
const wake = () => { if (soundWanted) audio.enable(); };
addEventListener('pointerdown', wake, { capture: true });
addEventListener('keydown', wake, { capture: true });

function sfx(kind) { audio.sfx(kind); }
function flash(kind) { const fx = $('fx'); fx.className = ''; void fx.offsetWidth; fx.className = kind; }
function notice(message, kind = '') {
  const n = $('notice'); n.textContent = message; n.className = kind;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { n.textContent = ''; n.className = ''; }, 1200);
}
function start() {
  if (!scene) return;
  game = createGame(seed++); game.mode = 'intro'; game.introTime = 0;
  $('intro').hidden = true; $('result').hidden = true; $('hud').hidden = true; $('pause').hidden = true;
  document.activeElement?.blur(); clearTimeout(noticeTimer); $('notice').textContent = '';
}
function showResult(title, button, kind = '') {
  $('result-title').textContent = title; $('again').textContent = button; $('result').className = kind;
  $('result-stats').innerHTML = game.mode === 'paused' ? '' : `<span><b>${game.pints}</b>PINTS</span><span><b>${game.smashed}</b>SMASHED</span><span><b>${Math.round(game.time)}</b>SECONDS</span>`;
  $('result').hidden = false; $('again').focus({ preventScroll: true });
}
function pause() {
  if (game.mode === 'playing') { game.mode = 'paused'; showResult('PAUSED', 'GO'); }
  else if (game.mode === 'paused') { game.mode = 'playing'; $('result').hidden = true; document.activeElement?.blur(); }
}
function finish() {
  $('pause').hidden = true; $('hud').hidden = true;
  if (game.mode === 'won') setTimeout(() => showResult('SLÁINTE!', 'AGAIN', 'won'), 1600);
  else showResult('BANJAXED.', 'AGAIN', 'lost');
}
const act = {
  left: () => steer(game, -1), right: () => steer(game, 1),
  up: () => { if (jump(game)) sfx('jump'); },
  down: () => { if (slam(game)) sfx('dive'); },
  boost: () => { if (boost(game)) { sfx('boost'); flash('boost'); } else if (game.mode === 'playing' && game.boost <= 0) { notice(`${FUEL_PER_BOOST - game.fuel} MORE PINTS`); $('jet').classList.remove('empty'); void $('jet').offsetWidth; $('jet').classList.add('empty'); } }
};
$('start').onclick = start;
// The button waits behind the loading bar until the first frame has drawn (shaders compiled).
let loaded = false;
function ready() {
  if (loaded) return; loaded = true;
  $('lc-load').classList.add('done');
  setTimeout(() => { $('lc-load').hidden = true; $('lc-go').hidden = false; }, 260);
}
$('lc-go').onclick = () => { $('lastcall').hidden = true; sfx('slamdoor'); start(); };
$('again').onclick = () => game.mode === 'paused' ? pause() : start();
$('pause').onclick = pause;
$('sound').onclick = () => setSound(!soundWanted);
$('jet').addEventListener('pointerdown', event => { event.stopPropagation(); act.boost(); });

const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', ' ': 'up', arrowdown: 'down', s: 'down', shift: 'boost', b: 'boost', e: 'boost' };
addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (event.target instanceof HTMLButtonElement && (key === ' ' || key === 'enter')) return;
  if (key === 'm') { setSound(!soundWanted); return; }
  if (key === 'escape' || key === 'p') { event.preventDefault(); pause(); return; }
  if (!(key in KEYS)) return;
  event.preventDefault(); if (event.repeat) return;
  if (key === ' ' && ['ready', 'lost', 'won'].includes(game.mode)) { if (!$('lastcall').hidden) { if (loaded) $('lc-go').click(); } else start(); return; }
  act[KEYS[key]]();
});

// Swipes fire as soon as the finger travels far enough, like a runner should. Double tap boosts.
let touch = null, lastTap = 0;
canvas.addEventListener('pointerdown', event => { touch = { x: event.clientX, y: event.clientY, t: performance.now(), used: false }; canvas.setPointerCapture?.(event.pointerId); });
canvas.addEventListener('pointermove', event => {
  if (!touch || touch.used) return;
  const dx = event.clientX - touch.x, dy = event.clientY - touch.y, far = Math.max(24, Math.min(innerWidth, innerHeight) * .06);
  if (Math.hypot(dx, dy) < far) return;
  touch.used = true;
  if (Math.abs(dx) > Math.abs(dy)) act[dx < 0 ? 'left' : 'right'](); else act[dy < 0 ? 'up' : 'down']();
});
canvas.addEventListener('pointerup', () => {
  if (!touch) return;
  const now = performance.now();
  if (!touch.used && now - touch.t < 260) { if (now - lastTap < 320) { act.boost(); lastTap = 0; } else lastTap = now; }
  touch = null;
});
canvas.addEventListener('pointercancel', () => { touch = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.mode === 'playing') pause(); });
addEventListener('resize', () => scene?.resize());

const cells = [...document.querySelectorAll('#jet .cells i')], hearts = [...document.querySelectorAll('#hearts i')];
let gestureShown = false;
function frame(milliseconds) {
  const dt = last ? Math.min(.05, (milliseconds - last) / 1000) : 1 / 60;
  last = milliseconds;
  if (game.mode === 'intro' && !document.hidden) {
    game.introTime = Math.min(3, game.introTime + dt);
    if (game.introTime >= 3) {
      game.mode = 'playing'; $('hud').hidden = false; $('pause').hidden = false;
      if (!gestureShown) { gestureShown = true; $('gesture').hidden = false; setTimeout(() => { $('gesture').hidden = true; }, 2600); }
    }
  }
  if (location.search.includes('debug')) globalThis.__game = game;
  const before = game.mode;
  for (const event of step(game, dt)) {
    sfx(event);
    if (event === 'hit') { flash('hit'); notice('MIND THE BODYWORK!', 'bad'); }
    if (event === 'smash') notice(['SMASHED!', 'MOOOVE!', 'BAAAD LUCK!', 'NO BOTHER!'][game.smashed % 4], 'good');
    if (event === 'slam') flash('slam');
  }
  if (before === 'playing' && game.mode !== before) finish();
  const out = scene?.render(game, dt);
  if (out) {
    ready();
    for (const cue of out.cues) { sfx(cue); if (cue === 'gate') { const sp = $('speedo'); sp.classList.remove('gate'); void sp.offsetWidth; sp.classList.add('gate'); } if (cue === 'eighty') { notice('88 MPH', 'eighty'); flash('eighty'); } }
    audio.engine(game.mode === 'playing' ? out.mph : 0, out.thrust, out.boosting);
  }
  if (game.mode === 'playing' || game.mode === 'paused') {
    $('route-fill').style.width = `${game.distance / LENGTH * 100}%`;
    const mph = out?.mph ?? 72; $('speed').textContent = mph;
    $('speedo').classList.toggle('hot', mph >= 88);
    hearts.forEach((h, i) => h.classList.toggle('lost', i >= game.lives));
    $('hearts').setAttribute('aria-label', `${game.lives} bodywork points`);
    $('pints').textContent = game.pints;
    cells.forEach((c, i) => c.classList.toggle('full', game.boost > 0 ? i < Math.ceil(game.boost / 3 * cells.length) : i < game.fuel));
    $('jet').classList.toggle('ready', game.fuel >= FUEL_PER_BOOST && game.boost <= 0);
    $('jet').classList.toggle('firing', game.boost > 0);
    document.body.classList.toggle('boosting', game.boost > 0);
  } else document.body.classList.remove('boosting');
  requestAnimationFrame(frame);
}
setSound(true, true);
if (scene) requestAnimationFrame(frame);
