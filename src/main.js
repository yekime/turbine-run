import { createGame, step, steer, jump, boost, speed, LENGTH } from './engine.js';
import { createRenderer } from './renderer.js';

const $ = id => document.getElementById(id);
const canvas = $('stage');
let game = createGame();
let scene;
let muted = true;
let audio;
let noticeTimer;
let last = 0;
try { scene = createRenderer(canvas); }
catch (error) { $('error').hidden = false; $('start').disabled = true; console.error('Unable to start renderer', error); }

function sound(kind) {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.type = kind === 'hit' ? 'sawtooth' : 'triangle';
    const frequency = { pint: 740, hit: 90, jump: 210, boost: 110, won: 520, start: 330 }[kind] || 180;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'hit' ? 35 : frequency * 1.8, audio.currentTime + .22);
    gain.gain.setValueAtTime(.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .32);
    oscillator.start(); oscillator.stop(audio.currentTime + .34);
  } catch { /* Sound is optional. */ }
}
function notice(message) {
  $('notice').textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 1500);
}
function start() {
  if (!scene) return;
  game = createGame(); game.mode = 'playing';
  $('intro').hidden = true; $('result').hidden = true;
  $('hud').hidden = false; $('controls').hidden = false; $('pause').hidden = false;
  $('pause').textContent = 'Ⅱ';
  document.activeElement?.blur();
  sound('start'); notice('NEXT STOP: THE TURBINE ARMS');
}
function showResult(label, title, copy, button) {
  $('result-label').textContent = label;
  $('result-title').textContent = title;
  $('result-copy').textContent = copy;
  $('again').textContent = button;
  $('result-stats').textContent = game.mode === 'paused' ? '' : `${game.pints} PINTS · ${Math.round(game.time)} SECONDS · ${game.hits} SCRAPES`;
  $('result').hidden = false;
  $('controls').hidden = true;
  $('again').focus({ preventScroll: true });
}
function pause() {
  if (game.mode === 'playing') {
    game.mode = 'paused';
    showResult('PIT STOP', 'BACK IN A SEC.', 'Your jet can wait.', 'KEEP GOING ➜');
    $('pause').textContent = '▶';
  } else if (game.mode === 'paused') {
    game.mode = 'playing'; $('result').hidden = true; $('controls').hidden = false;
    $('pause').textContent = 'Ⅱ'; document.activeElement?.blur();
  }
}
function finish() {
  $('pause').hidden = true;
  if (game.mode === 'won') {
    showResult('LAST ORDERS', 'MADE IT.', 'Park the DeLorean. The next pint’s yours.', 'ONE MORE RUN ➜');
  } else {
    showResult('MIND THE BODYWORK', 'THAT’LL BUFF OUT.', 'Jump the livestock. Dodge the tractors.', 'TRY AGAIN ➜');
  }
}
function doJump() { if (jump(game)) sound('jump'); }
function doBoost() {
  if (boost(game)) sound('boost');
  else if (game.mode === 'playing' && game.fuel === 0) notice('PINTS FUEL THE JET');
}
$('start').onclick = start;
$('again').onclick = () => game.mode === 'paused' ? pause() : start();
$('pause').onclick = pause;
$('sound').onclick = () => {
  muted = !muted; $('sound').textContent = muted ? '♪' : '♫';
  $('sound').setAttribute('aria-pressed', String(!muted));
  $('sound').setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
  sound('start');
};
$('left').onclick = () => steer(game, -1);
$('right').onclick = () => steer(game, 1);
$('jump').onclick = doJump;
$('jet').onclick = doBoost;

addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (!['arrowleft', 'arrowright', 'arrowup', ' ', 'shift', 'escape', 'p', 'a', 'd'].includes(key)) return;
  if (event.target instanceof HTMLButtonElement && key === ' ') return;
  event.preventDefault();
  if (event.repeat) return;
  if (key === 'escape' || key === 'p') pause();
  else if (key === ' ' && ['ready', 'lost', 'won'].includes(game.mode)) start();
  else if (key === ' ' || key === 'arrowup') doJump();
  else if (key === 'shift') doBoost();
  else if (key === 'arrowleft' || key === 'a') steer(game, -1);
  else if (key === 'arrowright' || key === 'd') steer(game, 1);
});
let pointer = null;
canvas.addEventListener('pointerdown', event => { pointer = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointerup', event => {
  if (!pointer) return;
  const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
  if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) steer(game, Math.sign(dx));
  else if (dy < -24) doJump();
  pointer = null;
});
canvas.addEventListener('pointercancel', () => { pointer = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.mode === 'playing') pause(); });
addEventListener('resize', () => scene?.resize());

function frame(milliseconds) {
  const dt = last ? Math.min(.05, (milliseconds - last) / 1000) : 1 / 60;
  last = milliseconds;
  const before = game.mode;
  for (const event of step(game, dt)) { sound(event); if (event === 'hit') notice('MIND THE BODYWORK!'); }
  if (before === 'playing' && game.mode !== before) finish();
  scene?.render(game, dt);
  $('route-fill').style.width = `${game.distance / LENGTH * 100}%`;
  $('distance').textContent = `${((LENGTH - game.distance) / 1000).toFixed(1)} KM`;
  $('speed').textContent = Math.round(speed(game));
  $('hearts').textContent = '♥ '.repeat(game.lives) + '♡ '.repeat(3 - game.lives);
  $('hearts').setAttribute('aria-label', `${game.lives} bodywork points`);
  $('pints').textContent = game.pints;
  $('fuel').textContent = game.fuel;
  $('jet').disabled = game.fuel === 0 || game.boost > 0;
  $('boost').hidden = game.boost <= 0;
  requestAnimationFrame(frame);
}
if (scene) requestAnimationFrame(frame);
