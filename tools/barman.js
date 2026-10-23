// Bakes the LAST CALL art: the barman behind the bar, lit and bloomed like the game.
// Three layers so the card can animate them: the bar (with his body), his head, his bell arm.
// window.__bake resolves to { bar, head, arm } as WebP data URLs plus the two pivots in percent.
import * as THREE from '../vendor/three.module.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { createBarman, createPint } from '../src/models.js';

const W = 960, H = 800, SS = 2;                 // output size; rendered at 2x and scaled down for clean edges
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W * SS, H * SS);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1c0a36');
const camera = new THREE.PerspectiveCamera(33, W / H, .1, 60);
camera.position.set(0, 1.9, -5.1); camera.lookAt(0, 1.96, 0);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, flatShading: true, ...extra });
const glow = (color, i = 3) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, flatShading: true });
const add = (geo, material, pos, rot, parent = scene) => { const m = new THREE.Mesh(geo, material); m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
const box = (size, material, pos, rot, parent) => add(new THREE.BoxGeometry(...size), material, pos, rot, parent);
const cyl = (rt, rb, h, material, pos, rot, seg = 10, parent) => add(new THREE.CylinderGeometry(rt, rb, h, seg), material, pos, rot, parent);

/* ---------- the back bar ---------- */
const wall = mat('#2b1250'), panel = mat('#3a1a68'), trim = mat('#5a2c95'), shelfWood = mat('#4a2414', { roughness: .5 });
box([8, 5, .1], wall, [0, 2.2, 1.4]);
box([3.9, 1.5, .06], mat('#160a2c', { metalness: .9, roughness: .15 }), [0, 2.02, 1.32]);   // mirror
for (const [x, y, w, h] of [[0, 2.79, 4.05, .08], [0, 1.25, 4.05, .08], [-2.0, 2.02, .08, 1.6], [2.0, 2.02, .08, 1.6]]) box([w, h, .1], trim, [x, y, 1.3]);
const NEON = ['#ff8a1f', '#3ff3ff', '#ffd23f', '#ff3fa4', '#19ff8c', '#7a2cff'];
for (const [y, n] of [[1.62, 15], [2.26, 15]]) {
  box([3.7, .05, .32], shelfWood, [0, y, 1.16]);
  box([3.7, .03, .02], glow('#ffcc6a', 2.2), [0, y - .03, 1.0]);                             // under-shelf strip
  for (let i = 0; i < n; i++) {
    const x = -1.7 + i * (3.4 / (n - 1)) + (i % 3 - 1) * .02, hgt = .26 + ((i * 7) % 5) * .035, c = NEON[(i * 5 + (y > 2 ? 2 : 0)) % NEON.length];
    const bottle = mat(c, { emissive: c, emissiveIntensity: .9, roughness: .25, transparent: true, opacity: .92 });
    cyl(.045, .055, hgt, bottle, [x, y + .025 + hgt / 2, 1.16], null, 8);
    cyl(.016, .03, .09, bottle, [x, y + .025 + hgt + .045, 1.16], null, 6);
  }
}
// Neon shamrock and a neon pint on the wall above the mirror.
const shamrock = new THREE.Group(); shamrock.position.set(1.45, 3.25, 1.3); scene.add(shamrock);
const tube = glow('#19ff8c', 5);
for (const a of [0, 2.2, 4.1]) { const leaf = add(new THREE.TorusGeometry(.16, .022, 6, 24), tube, [Math.sin(a) * .17, Math.cos(a) * .17, 0], null, shamrock); leaf.scale.y = .9; }
add(new THREE.TorusGeometry(.32, .02, 6, 30, 1.2), tube, [.2, -.28, 0], [0, 0, 2.6], shamrock);
const sign = new THREE.Group(); sign.position.set(-1.5, 3.2, 1.3); scene.add(sign);
const amber = glow('#ffb43a', 4.5), cream = glow('#fff1c8', 4.5);
for (const [x0, y0, x1, y1, m] of [[-.15, .22, .15, .22, cream], [-.16, .2, -.12, -.24, amber], [.16, .2, .12, -.24, amber], [-.12, -.24, .12, -.24, amber], [-.15, .13, .15, .13, amber]]) {
  const len = Math.hypot(x1 - x0, y1 - y0); add(new THREE.CylinderGeometry(.018, .018, len, 6), m, [(x0 + x1) / 2, (y0 + y1) / 2, 0], [0, 0, Math.atan2(x0 - x1, y1 - y0)], sign);
}

/* ---------- the barman ---------- */
const man = createBarman(THREE); man.position.y = .16; scene.add(man);
const { head, bellArm } = man.userData;

/* ---------- the bar counter, taps and pints ---------- */
const wood = mat('#7a3e20', { roughness: .45 }), woodDark = mat('#4a2010', { roughness: .55 }), top = mat('#5a2a14', { roughness: .22, metalness: .1 });
const brass = mat('#ffc24a', { metalness: .35, roughness: .3, emissive: '#7a4a08', emissiveIntensity: .35 });
box([4.6, 1.02, .55], wood, [0, .51, -.62]);
box([4.8, .09, .82], top, [0, 1.06, -.58]);
box([4.8, .04, .04], brass, [0, 1.0, -1.0]);
for (let i = 0; i < 6; i++) box([.62, .6, .04], woodDark, [-1.9 + i * .76, .55, -.9]);
cyl(.03, .03, 4.8, brass, [0, .22, -1.06], [0, 0, Math.PI / 2], 8);
// Taps beside his left hand (screen left).
for (const [x, c] of [[.62, '#fff1c8'], [.86, '#19c95a']]) {
  cyl(.045, .055, .38, brass, [x, 1.29, -.48], null, 10);
  box([.07, .05, .14], brass, [x, 1.45, -.56]);
  box([.06, .2, .06], mat('#120d18'), [x, 1.6, -.5]);
  box([.075, .07, .075], mat(c, { emissive: c, emissiveIntensity: .4 }), [x, 1.73, -.5]);
}
cyl(.2, .2, .03, brass, [.74, 1.12, -.5], null, 14);
// Pints lined along the bar.
for (const [x, z] of [[1.5, -.72], [1.18, -.84], [-1.12, -.82], [-1.46, -.7]]) { const p = createPint(THREE); p.scale.setScalar(.2); p.position.set(x, 1.105, z); p.rotation.y = x; scene.add(p); }

/* ---------- light ---------- */
scene.add(new THREE.HemisphereLight('#ffc9ec', '#2a0f5c', .9));
const key = new THREE.SpotLight('#ffd9a8', 16, 14, .55, .55, 1.4); key.position.set(1.4, 3.6, -2.8); key.target.position.set(0, 1.5, 0);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .02; scene.add(key, key.target);
const pink = new THREE.DirectionalLight('#ff4fb0', 2.4); pink.position.set(-3, 2.6, 2.2); scene.add(pink);
const cyan = new THREE.DirectionalLight('#3ff3ff', 1.3); cyan.position.set(3, 2.2, 2.4); scene.add(cyan);
const lamp = new THREE.PointLight('#ffb35a', 6, 5, 1.6); lamp.position.set(0, 2.95, -.4); scene.add(lamp);
// Pendant lamp: shade and glowing bulb over his head.
add(new THREE.ConeGeometry(.32, .26, 12, 1, true), mat('#1e5a3c', { side: THREE.DoubleSide }), [0, 3.12, -.45]);
add(new THREE.SphereGeometry(.08, 10, 8), glow('#ffe2a8', 6), [0, 3.0, -.45]);
cyl(.008, .008, 1.2, mat('#111'), [0, 3.8, -.45], null, 4);

/* ---------- bake ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), .55, .35, 1.6));
composer.addPass(new OutputPass());

function grab() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(renderer.domElement, 0, 0, W, H);
  return c;
}
// One layer alone on a transparent background, lit by the same lights.
function layer(object) {
  const solo = new THREE.Scene(), parent = object.parent;
  scene.traverse(o => { if (o.isLight) { const l = o.clone(); if (l.target) { l.target = o.target.clone(); solo.add(l.target); } l.castShadow = false; solo.add(l); } });
  solo.attach(object);
  renderer.setClearColor(0x000000, 0); renderer.render(solo, camera);
  const out = grab(); parent.attach(object); return out;
}
function pivot(object) {
  const v = object.getWorldPosition(new THREE.Vector3()).project(camera);
  return { x: +((v.x + 1) / 2 * 100).toFixed(2), y: +((1 - v.y) / 2 * 100).toFixed(2) };
}
const webp = c => c.toDataURL('image/webp', .86);

head.visible = bellArm.visible = true;
composer.render(); const full = grab();
head.visible = bellArm.visible = false;
composer.render(); const bar = grab();
head.visible = bellArm.visible = true;
const headLayer = layer(head), armLayer = layer(bellArm);
scene.updateMatrixWorld(true);
const result = { bar: webp(bar), head: webp(headLayer), arm: webp(armLayer), full: full.toDataURL('image/png'), pivots: { head: pivot(head), arm: pivot(bellArm) } };
window.__bake = result;
document.body.replaceChildren(full);
