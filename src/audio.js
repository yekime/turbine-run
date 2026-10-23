// All sound is synthesised live in Web Audio: no recordings to license.
// Music: "The Irish Washerwoman", a traditional jig (public domain), played as a synthwave jig.
// Transcription: thesession.org/tunes/92, setting by Aaron Bergen (chords).
const TUNE = `
|:"G" BGG DGG|BGB dcB|"C" cAA EAA|cAc edc|"G" BGG DGG|BGB dcB|"C" c>Bc "D" Adc|"G" BGG G3:|
|:"G" BGG DGG|BGB BAG|"D" AFF DFF|AFA AGF|"Em" EGG DGG|"G" CGG B,GG|"C" c>Bc "D" Adc|"G" BGG G3:|
`;
const EIGHTH = .135;
const KEY_G = { C: 0, D: 2, E: 4, F: 6, G: 7, A: 9, B: 11 };
const ROOT = { G: 43, C: 48, D: 50, Em: 40 };
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);

function parse(src) {
  const notes = [], chords = []; let t = 0, i = 0, halve = false;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') { const end = src.indexOf('"', i + 1); chords.push({ t, name: src.slice(i + 1, end) }); i = end + 1; }
    else if (/[A-Ga-g]/.test(ch)) {
      let midi = (ch === ch.toUpperCase() ? 60 : 72) + KEY_G[ch.toUpperCase()]; i++;
      while (src[i] === ',' || src[i] === "'") { midi += src[i] === ',' ? -12 : 12; i++; }
      let len = 1; if (/[0-9]/.test(src[i] || '')) { len = +src[i]; i++; }
      if (halve) { len *= .5; halve = false; }
      notes.push({ t, len, midi }); t += len;
    } else if (ch === '>') { const p = notes[notes.length - 1]; t += p.len * .5; p.len *= 1.5; halve = true; i++; }
    else i++;
  }
  return { notes, chords, len: t };
}
function build() {
  const sections = [...TUNE.matchAll(/\|:([\s\S]*?):\|/g)].map(m => parse(m[1]));
  const events = []; let t0 = 0, chord = 'G';
  for (const s of sections) for (let rep = 0; rep < 2; rep++) {
    for (const n of s.notes) events.push({ t: t0 + n.t, kind: 'lead', midi: n.midi, len: n.len });
    for (let e = 0; e < s.len; e++) {
      for (const c of s.chords) if (c.t <= e) chord = c.name;
      events.push({ t: t0 + e, kind: 'bass', midi: ROOT[chord] + (e % 3 === 2 ? 12 : 0) });
      if (e % 3 === 0) events.push({ t: t0 + e, kind: 'kick' });
      if (e % 6 === 3) events.push({ t: t0 + e, kind: 'snare' });
      events.push({ t: t0 + e, kind: 'hat', open: e % 3 === 1 });
    }
    t0 += s.len;
  }
  events.sort((a, b) => a.t - b.t);
  return { events, len: t0 };
}
const SONG = build();

export function createAudio() {
  let ctx = null, master, musicBus, sfxBus, hitBus, drive, echo, noise, engine, timer = null, start = 0, idx = 0, loops = 0;
  function init() {
    if (ctx) return ctx;
    const A = globalThis.AudioContext || globalThis.webkitAudioContext; if (!A) return null;
    ctx = new A();
    master = ctx.createDynamicsCompressor(); master.threshold.value = -14; master.ratio.value = 4; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = .32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = .7; sfxBus.connect(master);
    // Big impacts skip the master compressor, which flattens them, and go through a fast limiter of their own.
    const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = .001; limit.release.value = .12; limit.connect(ctx.destination);
    hitBus = ctx.createGain(); hitBus.gain.value = .9; hitBus.connect(limit);
    drive = new Float32Array(1024); for (let i = 0; i < drive.length; i++) { const x = i / 511.5 - 1; drive[i] = Math.tanh(x * 6); }
    // Dotted-eighth echo on the lead.
    echo = ctx.createDelay(1); echo.delayTime.value = EIGHTH * 3; const fb = ctx.createGain(); fb.gain.value = .32; const wet = ctx.createGain(); wet.gain.value = .3;
    echo.connect(fb).connect(echo); echo.connect(wet).connect(musicBus);
    const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    // Turbine engine: two detuned saws and a noise roar through a lowpass that opens with speed.
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), whine = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; whine.type = 'sine';
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 3;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .8;
    const gEng = ctx.createGain(), gN = ctx.createGain(), gW = ctx.createGain(), out = ctx.createGain();
    gEng.gain.value = .12; gN.gain.value = 0; gW.gain.value = .015; out.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(gEng).connect(out); n.connect(bp).connect(gN).connect(out); whine.connect(gW).connect(out); out.connect(sfxBus);
    for (const x of [o1, o2, whine, n]) x.start();
    engine = { o1, o2, whine, lp, bp, gN, gW, out };
    return ctx;
  }
  const env = (g, at, peak, a, d) => { g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(.0001, at + a + d); };
  function tone(type, f0, f1, dur, peak, at = ctx.currentTime, dest = sfxBus) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    env(g, at, peak, .005, dur); o.connect(g).connect(dest); o.start(at); o.stop(at + dur + .05);
  }
  function hiss(dur, peak, f0, f1, type = 'bandpass', at = ctx.currentTime, dest = sfxBus) {
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, at); if (f1) f.frequency.exponentialRampToValueAtTime(f1, at + dur); f.Q.value = 1.2;
    const g = ctx.createGain(); env(g, at, peak, .004, dur); s.connect(f).connect(g).connect(dest); s.start(at, Math.random()); s.stop(at + dur + .05);
  }
  // A clipped square through a lowpass: the body of a heavy thud.
  function crunch(f0, f1, dur, peak, at, dest) {
    const o = ctx.createOscillator(), shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    shaper.curve = drive; lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, at); lp.frequency.exponentialRampToValueAtTime(200, at + dur);
    env(g, at, peak, .002, dur); o.connect(shaper).connect(lp).connect(g).connect(dest); o.start(at); o.stop(at + dur + .05);
  }
  // Pull the music down under an impact and let it swell back.
  function duck(at, depth, hold) {
    const v = musicBus.gain.value; musicBus.gain.cancelScheduledValues(at);
    musicBus.gain.setValueAtTime(v, at); musicBus.gain.linearRampToValueAtTime(v * depth, at + .01);
    musicBus.gain.setValueAtTime(v * depth, at + hold); musicBus.gain.linearRampToValueAtTime(.32, at + hold + .6);
  }
  function lead(at, midi, dur) {
    const f = NOTE(midi + 12);
    for (const [type, det, gain] of [['sawtooth', -6, .05], ['square', 7, .035]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = type; o.frequency.value = f; o.detune.value = det; lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, at); lp.frequency.exponentialRampToValueAtTime(1400, at + dur);
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + .008); g.gain.setValueAtTime(gain * .8, at + dur * .8); g.gain.exponentialRampToValueAtTime(.0001, at + dur + .03);
      o.connect(lp).connect(g); g.connect(musicBus); g.connect(echo); o.start(at); o.stop(at + dur + .06);
    }
  }
  function schedule() {
    const until = ctx.currentTime + .4, past = ctx.currentTime - .02;
    for (;;) {
      const ev = SONG.events[idx]; const at = start + (loops * SONG.len + ev.t) * EIGHTH;
      if (at > until) break;
      if (at > past) {
        if (ev.kind === 'lead') lead(at, ev.midi, ev.len * EIGHTH);
        else if (ev.kind === 'bass') { const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = NOTE(ev.midi - 12); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, at); lp.frequency.exponentialRampToValueAtTime(180, at + EIGHTH); env(g, at, .16, .004, EIGHTH * .9); o.connect(lp).connect(g).connect(musicBus); o.start(at); o.stop(at + EIGHTH + .05); }
        else if (ev.kind === 'kick') tone('sine', 150, 42, .22, .5, at, musicBus);
        else if (ev.kind === 'snare') { hiss(.16, .22, 1800, 900, 'bandpass', at, musicBus); tone('triangle', 220, 140, .08, .12, at, musicBus); }
        else hiss(ev.open ? .12 : .03, ev.open ? .05 : .035, 9000, null, 'highpass', at, musicBus);
      }
      idx++; if (idx >= SONG.events.length) { idx = 0; loops++; }
    }
  }
  return {
    enable() {
      if (!init()) return false; ctx.resume();
      engine.out.gain.setTargetAtTime(1, ctx.currentTime, .2);
      if (!timer) { start = ctx.currentTime + .1; idx = 0; loops = 0; schedule(); timer = setInterval(schedule, 60); }
      return true;
    },
    disable() {
      if (!ctx) return; clearInterval(timer); timer = null; engine.out.gain.setTargetAtTime(0, ctx.currentTime, .05); ctx.suspend?.();
    },
    get on() { return !!timer; },
    /** Per frame: speed in game mph, thrust 0..1.3. */
    engine(mph, thrust, boosting) {
      if (!timer) return; const t = ctx.currentTime;
      const f = 38 + mph * .55 + thrust * 30;
      engine.o1.frequency.setTargetAtTime(f, t, .08); engine.o2.frequency.setTargetAtTime(f * 1.007 + 1, t, .08);
      engine.whine.frequency.setTargetAtTime(600 + mph * 14 + thrust * 900, t, .1);
      engine.lp.frequency.setTargetAtTime(250 + mph * 6 + thrust * 2200, t, .06);
      engine.bp.frequency.setTargetAtTime(500 + thrust * 1800, t, .08);
      engine.gN.gain.setTargetAtTime(thrust * (boosting ? .55 : .2), t, .05);
      engine.gW.gain.setTargetAtTime(.01 + thrust * .03, t, .1);
    },
    sfx(kind) {
      if (!timer) return; const t = ctx.currentTime;
      if (kind === 'pint') { tone('square', NOTE(84), 0, .09, .12, t); tone('square', NOTE(91), 0, .14, .1, t + .07); }
      else if (kind === 'hit') { tone('sawtooth', 120, 30, .45, .5, t); hiss(.4, .4, 800, 120, 'lowpass', t); }
      else if (kind === 'jump') hiss(.25, .18, 400, 2600, 'bandpass', t);
      else if (kind === 'land') tone('sine', 90, 40, .18, .35, t);
      else if (kind === 'dive') { hiss(.22, .3, 3200, 260, 'bandpass', t); tone('sawtooth', 420, 90, .2, .12, t); }
      else if (kind === 'slam') {
        duck(t, .12, .18);
        tone('sine', 190, 30, .9, 1, t, hitBus);                    // sub boom
        crunch(150, 38, .4, .55, t, hitBus);                         // body thud
        hiss(.035, .9, 6000, 2500, 'bandpass', t, hitBus);           // crack on contact
        [410, 587, 833].forEach((f, i) => tone('square', f, f * .7, .16 + i * .05, .07, t + .006, hitBus)); // chassis clank
        hiss(1.1, .55, 1800, 50, 'lowpass', t + .02, hitBus);       // rumble and debris
        hiss(.5, .14, 4000, 900, 'bandpass', t + .09, hitBus);       // gravel patter
      }
      else if (kind === 'smash') { tone('square', 300, 60, .25, .25, t); hiss(.3, .35, 3000, 400, 'bandpass', t); tone('sine', NOTE(79), NOTE(91), .15, .08, t + .05); }
      else if (kind === 'boost') { hiss(1.2, .6, 200, 4000, 'bandpass', t); tone('sawtooth', 60, 220, 1, .3, t); }
      else if (kind === 'gate') { hiss(.5, .35, 500, 5000, 'bandpass', t); [76, 83, 88].forEach((m, i) => tone('square', NOTE(m), 0, .12, .08, t + i * .05)); }
      else if (kind === 'flip') hiss(.35, .2, 3000, 500, 'bandpass', t);
      else if (kind === 'bump') tone('square', 200, 90, .12, .2, t);
      else if (kind === 'slamdoor') { tone('square', 140, 60, .12, .35, t); hiss(.1, .3, 2000, 500, 'bandpass', t); }
      else if (kind === 'won') [72, 76, 79, 84].forEach((m, i) => tone('square', NOTE(m), 0, .3, .12, t + i * .12));
      else if (kind === 'eighty') { tone('sawtooth', NOTE(55), NOTE(67), .5, .25, t); hiss(.6, .3, 600, 6000, 'bandpass', t); }
    }
  };
}
