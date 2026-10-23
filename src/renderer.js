import * as THREE from '../vendor/three.module.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { batchStatic } from './scene-utils.js';
import { COLLISION_OFFSET, LENGTH, RAMP, speed as engineSpeed, surface as engineSurface, carZ } from './engine.js';
import { createCar, createCow, createSheep, createTractor, createPint, createTurbine, createPub, createTree, createLeprechaun } from './models.js';
import { createGantry, createCottage, createShamrock, createRoundTower, createBladeTruck, createTanker, createBale, createKegs, createCaravan, createGoat, NEON } from './props.js';

// Simulation units are scaled to metres here. 0.3 m per unit puts the base speed at
// about 22 m/s and boost past 44 m/s, so the road actually rushes past.
const SCALE = .3, LANE = 3.2;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, smooth = THREE.MathUtils.smoothstep;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const noise = i => { const n = Math.sin(i * 127.1 + 63.9) * 43758.5453; return n - Math.floor(n); };
const wave = (t, s = 0) => Math.sin(t * 1.7 + s) * .5 + Math.sin(t * 3.1 + s * 2.3) * .3 + Math.sin(t * 5.3 + s * 4.1) * .2;

// Curved world: every standard material bends down (and slightly sideways) with distance
// ahead of the car, so the horizon drops away and things rise over the brow at speed.
const BEND = { value: new THREE.Vector3(.0018, 0, 3) };
let bendInstalled = false;
function installBend() {
  if (bendInstalled) return; bendInstalled = true;
  const C = THREE.ShaderChunk;
  C.common = C.common + '\nuniform vec3 uBend;\nvec4 bendWorld(vec4 w){ float d = min(0.0, w.z - uBend.z); w.y -= uBend.x * d * d; w.x += uBend.y * d * d; return w; }\n';
  C.project_vertex = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = viewMatrix * bendWorld( modelMatrix * mvPosition );
gl_Position = projectionMatrix * mvPosition;`;
  C.worldpos_vertex = `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  vec4 worldPosition = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    worldPosition = batchingMatrix * worldPosition;
  #endif
  #ifdef USE_INSTANCING
    worldPosition = instanceMatrix * worldPosition;
  #endif
  worldPosition = bendWorld( modelMatrix * worldPosition );
#endif`;
  const base = THREE.Material.prototype.onBeforeCompile;
  THREE.Material.prototype.onBeforeCompile = function (shader, r) { shader.uniforms.uBend = BEND; if (base) base.call(this, shader, r); };
}

function radial(inner, outer, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Camera-facing particle pool. Positions are world space; worldZ drift carries them with the road. */
function particles(max, blending) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, uBend: BEND }, transparent: true, depthWrite: false, blending,
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vColor; varying float vAlpha; uniform float uScale; uniform vec3 uBend;
      void main(){ vColor = color; vec4 w = modelMatrix * vec4(position, 1.0); float d = min(0.0, w.z - uBend.z); w.y -= uBend.x * d * d; w.x += uBend.y * d * d; vec4 mv = viewMatrix * w; vAlpha = alpha * smoothstep(2.5, 6.5, -mv.z); gl_PointSize = size * uScale / max(.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vColor; varying float vAlpha; void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); if (d > .5) discard; float a = smoothstep(.5, .0, d); gl_FragColor = vec4(vColor, a * a * vAlpha * .5); }`
  });
  const points = new THREE.Points(geo, material); points.frustumCulled = false;
  const P = Array.from({ length: max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, c0: new THREE.Color(), c1: new THREE.Color(), drag: 0, rise: 0, ground: false }));
  let cursor = 0; const tmp = new THREE.Color();
  return {
    points, material,
    emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag = 1, rise = 0, ground = false) {
      const p = P[cursor]; cursor = (cursor + 1) % max;
      Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, s0, s1, drag, rise, ground }); p.c0.set(c0); p.c1.set(c1);
    },
    update(dt, roadSpeed) {
      for (let i = 0; i < max; i++) {
        const p = P[i];
        if (p.life <= 0) { alpha[i] = 0; size[i] = 0; continue; }
        p.life -= dt; const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy = p.vy * k + p.rise * dt; p.vz *= k;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + roadSpeed * (p.ground ? 1 : .92)) * dt;
        const t = 1 - Math.max(0, p.life) / p.max;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        tmp.copy(p.c0).lerp(p.c1, t); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
        size[i] = lerp(p.s0, p.s1, t); alpha[i] = Math.min(1, (1 - t) * 1.6) * Math.min(1, t * 12 + .2);
      }
      for (const name of ['position', 'color', 'size', 'alpha']) geo.getAttribute(name).needsUpdate = true;
    }
  };
}

function roadTextures() {
  // One 8 m tile of a 12.6 m wide road: tricolour kerbs, neon edges, dashed lane lines.
  const W = 512, H = 328, mpx = W / 12.6, X = m => W / 2 + m * mpx;
  const base = document.createElement('canvas'), glow = document.createElement('canvas');
  base.width = glow.width = W; base.height = glow.height = H;
  const b = base.getContext('2d'), g = glow.getContext('2d');
  b.fillStyle = '#2b2546'; b.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { b.fillStyle = `rgba(${170 + noise(i) * 80},${150 + noise(i + 3) * 70},255,${.05 + noise(i + 9) * .07})`; b.fillRect(noise(i + 1) * W, noise(i + 2) * H, 2, 2); }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const kerb = ['#16c05a', '#fff6ee', '#ff8a1f', '#fff6ee'];
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    b.fillStyle = kerb[k]; b.fillRect(side < 0 ? 0 : X(5.3), k * H / 4, X(-5.3), H / 4);
  }
  for (const [ctx, alpha] of [[b, 1], [g, 1]]) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = NEON.green; for (const s of [-1, 1]) ctx.fillRect(X(s * 5.1) - 4, 0, 8, H);
    ctx.fillStyle = '#ffd9a8'; for (const s of [-1, 1]) ctx.fillRect(X(s * 1.6) - 4, 0, 8, H * .42);
    ctx.fillStyle = 'rgba(63,243,255,.35)'; ctx.fillRect(X(-5), H - 5, X(5) - X(-5), 3);
  }
  const make = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  return { map: make(base), emissive: make(glow) };
}

function grassTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#2fe070'; x.fillRect(0, 0, 64, 128); x.fillStyle = '#1cc65b'; x.fillRect(0, 128, 64, 128);
  for (let i = 0; i < 260; i++) { x.fillStyle = noise(i) > .5 ? 'rgba(255,255,190,.18)' : 'rgba(10,90,60,.16)'; x.fillRect(noise(i + 1) * 64, noise(i + 2) * 256, 2, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function sky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(.42, .1, -1).normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vDir; uniform float uTime; uniform vec3 uSun;
      vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir); float e = d.y;
        vec3 hor = lin(vec3(1.0, .74, .42)), mid = lin(vec3(1.0, .36, .60)), zen = lin(vec3(.36, .17, .78));
        vec3 col = mix(hor, mid, smoothstep(.0, .2, e)); col = mix(col, zen, smoothstep(.2, .75, e));
        // Synthwave sun with retro scanline gaps on its lower half.
        float a = acos(clamp(dot(d, uSun), -1.0, 1.0)); float r = .2;
        float sy = (e - uSun.y) / r;
        if (a < r) {
          vec3 s = mix(lin(vec3(1.0, .25, .55)), lin(vec3(1.0, .93, .45)), smoothstep(-1.0, .9, sy));
          float gap = sy < .15 ? step(.62 + sy * .35, fract(sy * 7.0 - uTime * .25)) : 0.0;
          col = mix(s * 1.25, col, gap);
        }
        col += lin(vec3(1.0, .55, .45)) * exp(-a * 7.0) * .35;
        // Distant hills with a neon rim.
        float az = atan(d.x, -d.z);
        float hill = .028 + .022 * sin(az * 4.0 + 1.3) + .014 * sin(az * 11.0) + .008 * sin(az * 27.0 + 2.0);
        if (e < hill) col = mix(lin(vec3(.30, .12, .52)), lin(vec3(.52, .20, .62)), clamp(e / hill, 0.0, 1.0));
        col += lin(vec3(.1, 1.0, .55)) * 2.0 * smoothstep(.0035, .0, abs(e - hill)) * step(-.05, e);
        // Stars in the violet.
        vec2 g = floor(vec2(az * 140.0, e * 140.0)); float st = step(.993, h(g)) * smoothstep(.3, .7, e);
        col += vec3(st) * (.6 + .4 * sin(uTime * 3.0 + h(g + 4.0) * 30.0));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), material); mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}

export function createRenderer(canvas) {
  installBend();
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const horizon = new THREE.Color('#ff9f7a');
  scene.background = horizon.clone(); scene.fog = new THREE.Fog(horizon, 55, 150);
  const camera = new THREE.PerspectiveCamera(62, 1, .1, 900);
  const skyMesh = sky(); scene.add(skyMesh);

  scene.add(new THREE.HemisphereLight('#ffd9f4', '#3fae6a', 1.25));
  const sun = new THREE.DirectionalLight('#fff0dc', 2.5); sun.position.set(-14, 30, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 24, bottom: -18, near: 1, far: 90 });
  sun.shadow.normalBias = .04; sun.shadow.bias = -.0002; sun.target.position.set(0, 0, -8); scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#ff6fb5', 1.4); rim.position.set(10, 6, -30); scene.add(rim);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, flatShading: true, ...extra });
  const glowMat = (color, i = 3) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });

  // Ground: bright mown-stripe fields and a neon road, both scrolling with travel.
  const grassTex = grassTexture(); grassTex.repeat.set(60, 160 / 16);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, 330, 1, 160), mat('#ffffff', { map: grassTex, flatShading: false }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -.05, -140); grass.receiveShadow = true; grass.frustumCulled = false; scene.add(grass);
  const roadTex = roadTextures(); const ROAD_LEN = 330, TILE = 8;
  roadTex.map.repeat.set(1, ROAD_LEN / TILE); roadTex.emissive.repeat.set(1, ROAD_LEN / TILE);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12.6, ROAD_LEN, 1, 200), new THREE.MeshStandardMaterial({ map: roadTex.map, emissiveMap: roadTex.emissive, emissive: '#ffffff', emissiveIntensity: 2.2, roughness: .55, metalness: .1 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, .01, -ROAD_LEN / 2 + 25); road.receiveShadow = true; road.frustumCulled = false; scene.add(road);

  // Close roadside rhythm: stone walls, neon lamp posts and hedges whip past at the edge of frame.
  const dummy = new THREE.Object3D(); const color = new THREE.Color();
  const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .7, 1.9), mat('#d7cfee'), 260); wall.castShadow = wall.receiveShadow = true; wall.frustumCulled = false; scene.add(wall);
  const moss = new THREE.InstancedMesh(new THREE.BoxGeometry(1.06, .14, 1.95), mat('#36e27a'), 260); moss.frustumCulled = false; scene.add(moss);
  const POSTS = 64, POST_GAP = 10;
  const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(.18, 4.6, .18), mat('#2a1d4a', { metalness: .1, roughness: .9 }), POSTS); pole.castShadow = true; pole.frustumCulled = false; scene.add(pole);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, .14, .18), mat('#2a1d4a', { metalness: .1, roughness: .9 }), POSTS); arm.frustumCulled = false; scene.add(arm);
  const lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(.9, .14, .34), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.7, roughness: 1, metalness: 0 }), POSTS); lamp.frustumCulled = false; scene.add(lamp);
  for (let i = 0; i < POSTS; i++) lamp.setColorAt(i, color.set(i % 4 < 2 ? NEON.green : NEON.orange));
  lamp.instanceColor.needsUpdate = true;
  const hedge = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1.5, 3.4), mat('#13b85a'), 110); hedge.castShadow = hedge.receiveShadow = true; hedge.frustumCulled = false; scene.add(hedge);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.16, 0), glowMat('#ffffff', 1.4), 160); flowers.frustumCulled = false; scene.add(flowers);
  const petals = ['#ffd23f', '#ff5fa8', '#ffffff', '#ff8a1f']; for (let i = 0; i < 160; i++) flowers.setColorAt(i, color.set(petals[i % 4])); flowers.instanceColor.needsUpdate = true;
  // Speed streaks: thin light lines near the camera, brighter with speed.
  const STREAKS = 70; const streakMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 2.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(.035, .035, 1), streakMat, STREAKS); streaks.frustumCulled = false; scene.add(streaks);
  const streakData = Array.from({ length: STREAKS }, (_, i) => { const a = noise(i) * Math.PI * 2, r = 3.5 + noise(i + 5) * 7; return { x: Math.cos(a) * r, y: Math.max(.25, 2.4 + Math.sin(a) * r * .6), z: -noise(i + 9) * 60 }; });

  const scenery = []; const add = (object, base, kind, x, extra = {}) => { object.position.x = x; scene.add(object); scenery.push({ object, base, kind, ...extra }); return object; };
  for (let i = 0; i < 22; i++) { const t = batchStatic(THREE, createTree(THREE)); t.scale.setScalar(.9 + noise(i + 2) * .8); add(t, -i * 9.4, 'tree', (i % 2 ? 1 : -1) * (10.5 + noise(i) * 7)); }
  for (let i = 0; i < 12; i++) { const t = createTurbine(THREE); batchStatic(THREE, t, [t.userData.rotor]); batchStatic(THREE, t.userData.rotor); t.scale.setScalar(1.5 + noise(i + 6) * .5); add(t, -i * 19 - 12, 'turbine', (i % 2 ? 1 : -1) * (17 + noise(i) * 16), { phase: i }); }
  const doors = ['#e8243c', '#ffd23f', '#1e7bff', '#19c95a', '#ff5fa8', '#ff8a1f'];
  for (let i = 0; i < 8; i++) { const c = batchStatic(THREE, createCottage(THREE, doors[i % 6])); c.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2; c.scale.setScalar(1.1); add(c, -i * 29 - 20, 'cottage', (i % 2 ? 1 : -1) * (14 + noise(i + 3) * 5)); }
  const shamrocks = []; for (let i = 0; i < 6; i++) { const s = createShamrock(THREE); s.scale.setScalar(1.15); shamrocks.push(add(s, -i * 37 - 30, 'shamrock', (i % 2 ? -1 : 1) * 8.6)); }
  for (let i = 0; i < 2; i++) add(batchStatic(THREE, createRoundTower(THREE)), -i * 130 - 90, 'tower', (i ? 1 : -1) * 34);
  const grazers = []; for (let i = 0; i < 8; i++) { const a = batchStatic(THREE, (i % 2 ? createSheep : createCow)(THREE), []); a.rotation.y = noise(i) * 6; grazers.push(add(a, -i * 23 - 14, 'grazer', (i % 2 ? 1 : -1) * (10 + noise(i + 4) * 6), { phase: i })); }
  // Speed gates come from the engine. The pool cycles signs; colour heats up as the run gets faster.
  const GATE_SIGNS = ['SLAINTE', 'CRAIC AHEAD', 'MIND THE SHEEP', 'FASTER', '88 MPH', 'LAST ORDERS'];
  const GATE_COLOURS = [NEON.green, NEON.green, NEON.cyan, NEON.orange, NEON.pink];
  const gateCache = new Map(); const gatePool = new Map(); let gateFlash = 0, previousGates = 0;
  const gateObject = i => { const tier = Math.min(GATE_COLOURS.length - 1, Math.floor(i / 4)), key = (i % GATE_SIGNS.length) + ':' + tier;
    if (!gateCache.has(key)) { const o = createGantry(THREE, GATE_SIGNS[i % GATE_SIGNS.length], GATE_COLOURS[tier]); o.visible = false; scene.add(o); gateCache.set(key, []); gateCache.get(key).push(o); }
    const free = gateCache.get(key).find(o => !o.userData.inUse); if (free) { free.userData.inUse = true; return free; }
    const o = createGantry(THREE, GATE_SIGNS[i % GATE_SIGNS.length], GATE_COLOURS[tier]); scene.add(o); o.userData.inUse = true; gateCache.get(key).push(o); return o; };
  const SPAN = 300;

  // --- The car --------------------------------------------------------------
  const car = createCar(THREE); const D = car.userData; const body = D.body;
  // Batch bodywork inside body so the suspension bounce moves the whole shell.
  batchStatic(THREE, body, [...D.doors, D.jet, D.flag]);
  for (const part of [...D.wheels, ...D.doors]) batchStatic(THREE, part);
  D.flame.visible = false; batchStatic(THREE, D.jet, [D.flame]);
  scene.add(car);
  // Tall whip pole and a cloth tricolour that streams back harder with speed.
  const FLAG_W = .95, FLAG_H = .52, FX = 18, FY = 8;
  D.flag.position.set(-.82, 0, 1.55);
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(.018, .03, 2.4, 6), mat('#e6f0ff', { metalness: .7, roughness: .3 })); whip.position.y = 1.6; whip.scale.y = .6; D.flag.add(whip);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), glowMat(NEON.gold, 3)); tip.position.y = 2.33; D.flag.add(tip);
  const clothGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, FX, FY);
  const clothColors = new Float32Array(clothGeo.getAttribute('position').count * 3);
  const uvs = clothGeo.getAttribute('uv');
  for (let i = 0; i < uvs.count; i++) { const u = uvs.getX(i); color.set(u < 1 / 3 ? '#169b62' : u < 2 / 3 ? '#ffffff' : '#ff883e'); clothColors.set([color.r, color.g, color.b], i * 3); }
  clothGeo.setAttribute('color', new THREE.BufferAttribute(clothColors, 3));
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .6 }));
  cloth.castShadow = true; cloth.frustumCulled = false; D.flag.add(cloth);
  const clothPos = clothGeo.getAttribute('position');
  const clothRest = Array.from({ length: clothPos.count }, (_, i) => ({ u: uvs.getX(i), v: uvs.getY(i) }));

  // Afterburner: layered additive cones, shock diamonds, a nozzle glow and a road light.
  const add2 = THREE.AdditiveBlending;
  const burner = new THREE.Group(); burner.position.set(0, 0, .74); D.jet.add(burner);
  const cone = (r, l, c, o) => { const g = new THREE.ConeGeometry(r, l, 18, 1, true); g.translate(0, -l / 2, 0); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: add2, depthWrite: false, side: THREE.DoubleSide, fog: false })); burner.add(m); return m; };
  const outer = cone(.42, 1, new THREE.Color(2.6, .9, .25), .55), middle = cone(.3, 1, new THREE.Color(3, 1.9, .7), .7), core = cone(.17, 1, new THREE.Color(3.2, 3.6, 4.2), .95);
  const diamonds = []; for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.3, 4), transparent: true, blending: add2, depthWrite: false, fog: false })); d.scale.set(1, 1, .55); burner.add(d); diamonds.push(d); }
  const nozzleGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial('rgba(255,255,255,1)', 'rgba(255,120,40,0)'), color: new THREE.Color(3, 1.8, 1), blending: add2, depthWrite: false, transparent: true, fog: false })); nozzleGlow.scale.setScalar(1.6); burner.add(nozzleGlow);
  const intake = new THREE.Mesh(new THREE.RingGeometry(.12, .3, 18), glowMat('#ff8a1f', 0)); intake.position.z = .71; D.jet.add(intake);
  const jetLight = new THREE.PointLight('#ff9a4a', 0, 16, 1.6); jetLight.position.set(0, .8, 3); car.add(jetLight);
  // Underglow: emerald neon pooled under the car.
  const under = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5.6), new THREE.MeshBasicMaterial({ map: radial('rgba(60,255,150,.95)', 'rgba(60,255,150,0)'), transparent: true, depthWrite: false, blending: add2, fog: false }));
  under.rotation.x = -Math.PI / 2; under.position.y = .03; scene.add(under);
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 4.8), new THREE.MeshBasicMaterial({ map: radial('rgba(20,10,40,.55)', 'rgba(20,10,40,0)'), transparent: true, depthWrite: false }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = .025; scene.add(shadowBlob);
  // Seated leprechaun visible through the glass once he is in.
  const seated = createLeprechaun(THREE); batchStatic(THREE, seated, [...seated.userData.arms]); seated.scale.setScalar(.5); seated.position.set(-.36, .48, -.05); seated.visible = false; body.add(seated);

  // The running leprechaun for the intro: a pivot lets him lean into the sprint.
  const driver = createLeprechaun(THREE);
  batchStatic(THREE, driver, [...driver.userData.legs, ...driver.userData.arms]);
  for (const limb of [...driver.userData.legs, ...driver.userData.arms]) batchStatic(THREE, limb);
  const runner = new THREE.Group(); runner.add(driver); scene.add(runner);
  const handPint = batchStatic(THREE, createPint(THREE)); handPint.scale.setScalar(.42); handPint.position.set(.04, -.5, -.1); handPint.visible = false; driver.userData.arms[1].add(handPint);
  let winTime = 0, chugs = 0, lastChug = -1;

  const pub = batchStatic(THREE, createPub(THREE)); pub.rotation.y = Math.PI; pub.scale.setScalar(1.6); scene.add(pub); pub.visible = false;

  const fx = particles(700, THREE.AdditiveBlending); scene.add(fx.points);
  const smoke = particles(260, THREE.NormalBlending); scene.add(smoke.points);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, .07, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, .8), transparent: true, depthWrite: false, blending: add2, fog: false })); ring.visible = false; scene.add(ring);
  const shock = new THREE.Mesh(new THREE.TorusGeometry(1, .025, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(.6, 2.2, 2.6), transparent: true, depthWrite: false, blending: add2, fog: false })); shock.visible = false; scene.add(shock);

  const builders = { cow: createCow, sheep: createSheep, tractor: createTractor, pint: createPint, bale: createBale, kegs: createKegs, caravan: createCaravan, goat: createGoat };
  const SIZE = { cow: 1.55, sheep: 1.15, goat: 1.1, pint: 1.25 };
  const events = new Map(); let eventSource = null; const trucks = new Map();
  const pintHalo = radial('rgba(255,220,120,1)', 'rgba(255,160,40,0)');
  const haloGeo = new THREE.PlaneGeometry(2.4, 2.4), haloMat = new THREE.MeshBasicMaterial({ map: pintHalo, color: new THREE.Color(2, 1.5, .6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });

  // Composer: bloom makes the neon actually glow.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .22, 2.6); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let width = 1, height = 1;
  function resize() {
    width = canvas.clientWidth || innerWidth; height = canvas.clientHeight || innerHeight;
    renderer.setSize(width, height, false); composer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    bloom.resolution.set(width * ratio * .5, height * ratio * .5);
    fx.material.uniforms.uScale.value = smoke.material.uniforms.uScale.value = height * ratio * .55;
  }
  resize();
  function release(object) { object.traverse(child => { if (child.geometry !== haloGeo) child.geometry?.dispose(); }); scene.remove(object); }

  // State that lives across frames.
  let elapsed = 0, previousJump = false, landing = 0, previousPints = 0, previousHits = 0, ringAge = 9, shockAge = 9, trauma = 0;
  let previousLandings = 0, previousFlips = 0, previousBumps = 0, flipAge = 9, flipDir = 1, airTime = 0;
  let previousBoost = false, previousMode = 'ready', introTravel = 0, introVelocity = 0, eightyEight = false;
  let camY = 0, camX = 0, camRoll = 0, fovKick = 0, slamDone = false, leapDone = false, launchDone = false;
  const spring = { y: 0, vy: 0, p: 0, vp: 0, r: 0, vr: 0 };
  const kick = (y = 0, p = 0, r = 0) => { spring.vy += y; spring.vp += p; spring.vr += r; };
  const shake = n => { trauma = Math.min(1, trauma + n); };
  const nozzle = new THREE.Vector3(), tmpV = new THREE.Vector3();

  function render(g, dt) {
    const cues = [];
    dt = clamp(dt || .016, 0, .05);
    const playing = g.mode === 'playing', ready = g.mode === 'ready', intro = g.mode === 'intro', paused = g.mode === 'paused', won = g.mode === 'won';
    const parked = ready || intro;
    if (!paused) elapsed += dt;
    const t = clamp(g.introTime || 0, 0, 3);
    if (g.mode !== previousMode) { if (g.mode === 'intro') { slamDone = leapDone = launchDone = false; introTravel = 0; introVelocity = 0; } previousMode = g.mode; }
    if (eventSource !== g.events) { eightyEight = false; for (const o of events.values()) release(o.object); events.clear(); for (const o of trucks.values()) release(o); trucks.clear(); for (const o of gatePool.values()) { o.visible = false; o.userData.inUse = false; } gatePool.clear(); previousGates = g.gatesPassed; eventSource = g.events; previousPints = g.pints; previousHits = g.hits; previousLandings = g.landings; previousFlips = g.flips; previousBumps = g.bumps; landing = 0; previousJump = false; flipAge = 9; }

    const boosting = g.boost > 0;
    const unitSpeed = parked ? 0 : engineSpeed(g);
    // During the launch the scenery starts rolling before the race clock does.
    if (intro && t > 2.35) introVelocity = damp(introVelocity, 72 * SCALE, 4, dt); else if (!intro) introVelocity = 0;
    if (intro) introTravel += introVelocity * dt;
    const roadSpeed = paused || won && g.distance >= LENGTH ? 0 : (playing ? unitSpeed * SCALE : introVelocity);
    const travel = introTravel + g.distance * SCALE;
    const speedFactor = clamp((unitSpeed - 72) / 76, 0, 1) + (intro ? introVelocity / 60 : 0);

    // World bend drifts left and right like a winding back road.
    const bendX = reducedMotion ? 0 : (Math.sin(travel * .006) * .0011 + Math.sin(travel * .0021 + 1) * .0007);
    BEND.value.y = damp(BEND.value.y, playing || intro ? bendX : 0, 2, dt);
    skyMesh.material.uniforms.uTime.value = elapsed;

    // Scrolling ground.
    roadTex.map.offset.y = roadTex.emissive.offset.y = travel / TILE;
    grassTex.offset.y = travel / 16;
    const wrap = (z, span = SPAN) => ((z + travel) % span + span) % span - span + 30;
    for (let i = 0; i < 260; i++) { const s = i % 2 ? 1 : -1, row = Math.floor(i / 2); dummy.position.set(s * 7.35, .35, wrap(-row * 2.0, 260)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, .9 + noise(row) * .25, 1); dummy.updateMatrix(); wall.setMatrixAt(i, dummy.matrix); dummy.position.y = .72 + (dummy.scale.y - 1) * .35; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); moss.setMatrixAt(i, dummy.matrix); }
    wall.instanceMatrix.needsUpdate = moss.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < POSTS; i++) { const s = i % 2 ? 1 : -1, z = wrap(-Math.floor(i / 2) * POST_GAP - (s > 0 ? POST_GAP / 2 : 0), POSTS / 2 * POST_GAP);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(s * 6.35, 2.3, z); dummy.updateMatrix(); pole.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s * 5.65, 4.55, z); dummy.updateMatrix(); arm.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s * 5.0, 4.45, z); dummy.updateMatrix(); lamp.setMatrixAt(i, dummy.matrix); }
    pole.instanceMatrix.needsUpdate = arm.instanceMatrix.needsUpdate = lamp.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 110; i++) { const s = i % 2 ? 1 : -1; dummy.position.set(s * (8.6 + noise(i) * .4), .72, wrap(-Math.floor(i / 2) * 4.8, 264)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, .8 + noise(i) * .45, 1); dummy.updateMatrix(); hedge.setMatrixAt(i, dummy.matrix); }
    hedge.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 160; i++) { dummy.position.set((i % 2 ? 1 : -1) * (9.6 + noise(i) * 4), .2, wrap(-i * 1.65, 264)); dummy.rotation.set(0, i, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix); }
    flowers.instanceMatrix.needsUpdate = true;
    for (const item of scenery) {
      item.object.position.z = wrap(item.base);
      if (item.kind === 'turbine') item.object.userData.rotor.rotation.z += dt * (.8 + speedFactor * 2.5);
      if (item.kind === 'shamrock') item.object.userData.spin.rotation.y += dt * 2.2;
      if (item.kind === 'grazer') { item.object.position.y = Math.abs(Math.sin(elapsed * 2.4 + item.phase)) * .12; item.object.rotation.y += Math.sin(elapsed * .7 + item.phase) * dt * .5; }
    }

    // Speed streaks.
    const streakStrength = playing ? clamp((unitSpeed - 60) / 80, 0, 1) * (boosting ? 1.6 : .7) : 0;
    streakMat.opacity = damp(streakMat.opacity, reducedMotion ? 0 : streakStrength * .55, 6, dt);
    const streakLen = 2 + roadSpeed * (boosting ? .22 : .1);
    for (let i = 0; i < STREAKS; i++) { const s = streakData[i]; s.z += roadSpeed * 1.4 * dt; if (s.z > 10) { s.z -= 70; s.x = (noise(i + elapsed) - .5) * 26; s.y = .3 + noise(i * 3 + elapsed) * 5.5; if (Math.abs(s.x) < 2.6 && s.y < 2.2) s.x += Math.sign(s.x || 1) * 3; }
      dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, streakLen); dummy.updateMatrix(); streaks.setMatrixAt(i, dummy.matrix); }
    streaks.instanceMatrix.needsUpdate = true;

    // Speed gates at their real course positions; the one you just passed flares.
    const liveGates = new Set();
    g.gates.forEach((z, i) => {
      const ahead = (z - carZ(g)) * SCALE; if (ahead > 190 || ahead < -25) return;
      liveGates.add(i); let o = gatePool.get(i); if (!o) { o = gateObject(i); gatePool.set(i, o); }
      o.visible = true; o.position.set(0, 0, -ahead);
      const hot = i === g.gatesPassed - 1 ? gateFlash : 0;
      o.userData.tube.emissiveIntensity = o.userData.base.tube * (1 + hot * 3); o.userData.warm.emissiveIntensity = o.userData.base.warm * (1 + hot * 2);
    });
    for (const [i, o] of gatePool) if (!liveGates.has(i)) { o.visible = false; o.userData.inUse = false; gatePool.delete(i); }
    if (g.gatesPassed > previousGates && !parked) { gateFlash = 1; fovKick = Math.max(fovKick, .75); shake(.28); kick(.3, -1.4); cues.push('gate'); for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2; fx.emit(Math.cos(a) * 6.4, 3.3 + Math.sin(a) * 3, -.5, Math.cos(a) * -4, Math.sin(a) * -3, 2, .45, .5, .05, '#d9fff0', '#19ff8c', 1); } }
    previousGates = g.gatesPassed; gateFlash = Math.max(0, gateFlash - dt * 2.5);
    if (gateFlash > 0) streakMat.opacity = Math.max(streakMat.opacity, gateFlash * .7);
    // Trucks: blade transporters and tankers, placed from their tail.
    const liveTrucks = new Set();
    if (!parked) for (const p of g.platforms) {
      const tail = p.ramp ? p.z0 + RAMP : p.z0, ahead = (tail - carZ(g)) * SCALE, len = (p.z1 - tail) * SCALE;
      if (ahead > 170 || ahead + len < -35) continue;
      liveTrucks.add(p);
      let o = trucks.get(p);
      if (!o) { o = batchStatic(THREE, p.type === 'blade' ? createBladeTruck(THREE, len, p.height, RAMP * SCALE) : createTanker(THREE, len, p.height)); scene.add(o); trucks.set(p, o); }
      o.position.set(p.lane * LANE, 0, -ahead);
    }
    for (const [p, o] of trucks) if (!liveTrucks.has(p)) { release(o); trucks.delete(p); }
    // Obstacles and pints.
    const needed = new Set();
    if (!parked) for (const e of g.events) {
      const ahead = (e.z - g.distance - COLLISION_OFFSET) * SCALE;
      let entry = events.get(e);
      if ((e.collected && !entry) || (ahead < -3.5 && !(entry && (entry.fly || entry.tip))) || ahead < -40 || ahead > 160) continue;
      needed.add(e);
      if (!entry) {
        const object = batchStatic(THREE, (builders[e.type] || createSheep)(THREE)); scene.add(object);
        entry = { object, phase: noise(e.z) * 6, fly: null, tip: null }; object.scale.setScalar(SIZE[e.type] || 1); if (e.type === 'cow' || e.type === 'goat') object.rotation.y = (noise(e.z + 3) - .5) * .8;
        if (e.type === 'pint') { const halo = new THREE.Mesh(haloGeo, haloMat); halo.position.y = .55; object.add(halo); entry.halo = halo; }
        events.set(e, entry);
      }
      const o = entry.object;
      if (e.smashed && !entry.fly) { entry.fly = { x: o.position.x, y: o.position.y, z: o.position.z, vx: (Math.sign(o.position.x - car.position.x) || (Math.random() < .5 ? -1 : 1)) * (7 + Math.random() * 6), vy: 15 + Math.random() * 7, vz: -roadSpeed * 1.25, sx: 9 + Math.random() * 9, sz: (Math.random() - .5) * 16 }; shake(.35); kick(-.6, 1.2, (Math.random() - .5) * 4); for (let i = 0; i < 26; i++) fx.emit(o.position.x, 1, o.position.z, (Math.random() - .5) * 12, Math.random() * 10, -Math.random() * 8, .5, .4, .05, '#bff8ff', '#3ff3ff', 1.5); }
      if (entry.tip) {
        // Crashed into: it topples onto its side (or a tall vehicle rocks) and slides with the road.
        const k = entry.tip; k.t += dt; if (k.t < dt * 1.5) k.z = Math.min(k.z, -7); k.z += roadSpeed * dt * (k.t < .35 ? 0 : 1);
        o.visible = k.z < 2.2;
        o.position.set(k.x + k.dir * smooth(k.t, 0, .35) * 2.6, k.rock ? 0 : Math.sin(clamp(k.t / .35, 0, 1) * Math.PI) * .4, k.z);
        if (k.rock) o.rotation.z = Math.sin(k.t * 18) * Math.exp(-k.t * 4) * .18; else { o.rotation.z = -k.dir * smooth(k.t, 0, .4) * Math.PI / 2; o.rotation.x = Math.sin(k.t * 30) * Math.exp(-k.t * 6) * .1; }
        if (k.t < .05 && !k.dust) { k.dust = true; for (let i = 0; i < 22; i++) smoke.emit(k.x, .3, k.z, (Math.random() - .5) * 7, Math.random() * 3, (Math.random() - .5) * 4, .9, .6, 2, '#f2e9ff', '#9f8ccc', 2, .4, true); }
        continue;
      }
      if (entry.fly) {
        const f = entry.fly; f.vy -= 22 * dt; f.x += f.vx * dt; f.y = Math.max(0, f.y + f.vy * dt); if (f.y === 0 && f.vy < 0) { f.vy = Math.abs(f.vy) > 6 ? -f.vy * .35 : 0; f.vz *= .7; f.vx *= .7; f.sx *= .6; f.sz *= .6; } f.z += (f.vz + roadSpeed) * dt;
        o.position.set(f.x, f.y, f.z); o.rotation.x += f.sx * dt; o.rotation.z += f.sz * dt; continue;
      }
      o.position.set(e.lane * LANE, 0, -ahead);
      if (e.type === 'pint') { if (e.collected) { o.visible = false; continue; } o.rotation.y = elapsed * 2.4; if (entry.halo) entry.halo.rotation.y = -o.rotation.y; o.position.y = (e.y || .5) + Math.sin(elapsed * 4 + e.z) * .18; }
      else if (e.type === 'tractor') { o.position.y = Math.abs(Math.sin(elapsed * 9 + entry.phase)) * .06; o.rotation.z = Math.sin(elapsed * 7 + entry.phase) * .025; if (Math.random() < dt * 6) smoke.emit(o.position.x + .38, 2.3, o.position.z - .7, 0, 1.2, 0, 1.2, .5, 1.6, '#cfc3e8', '#7b6aa8', .6, .8); }
      else { o.position.y = Math.abs(Math.sin(elapsed * (e.type === 'sheep' ? 7 : 4.5) + entry.phase)) * (e.type === 'sheep' ? .22 : .08); o.rotation.y = Math.sin(elapsed * 1.6 + entry.phase) * .25; }
    }
    for (const [e, entry] of events) if (!needed.has(e)) { release(entry.object); events.delete(e); }

    // Collisions read from the engine's counters.
    if (g.hits > previousHits) {
      let best = null, bestE = null;
      for (const [e, entry] of events) if (e.hit && !entry.fly && !entry.tip) { best = entry; bestE = e; }
      if (best && bestE.type !== 'tractor' && bestE.type !== 'caravan') best.tip = { t: 0, dir: Math.sign(best.object.position.x - car.position.x) || (Math.random() < .5 ? -1 : 1), z: best.object.position.z, x: best.object.position.x };
      else if (best) best.tip = { t: 0, dir: 0, rock: true, z: best.object.position.z, x: best.object.position.x };
      if (false) best.fly = { x: best.object.position.x, y: 0, z: best.object.position.z, vx: (best.object.position.x - car.position.x || (Math.random() - .5)) * 3 + (Math.random() - .5) * 6, vy: 11, vz: -roadSpeed * .55, sx: 8 + Math.random() * 6, sz: (Math.random() - .5) * 10 };
      shake(.9); kick(-2.2, 2.5, (Math.random() - .5) * 5);
      for (let i = 0; i < 40; i++) fx.emit(car.position.x, 1, car.position.z - 2, (Math.random() - .5) * 14, Math.random() * 9, -Math.random() * 6, .6, .35, .05, '#fff6a0', '#ff3a5a', 1.5);
    }
    previousHits = g.hits;
    if (g.pints > previousPints) {
      ringAge = 0;
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; fx.emit(car.position.x, 1.4, car.position.z - 1, Math.cos(a) * 6, 3 + Math.sin(a) * 5, -2, .55, .4, .08, '#fff2b0', '#ffaa22', 2); }
    }
    previousPints = g.pints;

    // Jump, landing and suspension.
    const jumping = !parked && !g.grounded;
    const ground = parked ? 0 : engineSurface(g, Math.max(-1, Math.min(1, Math.round(g.x))));
    const jumpHeight = parked ? 0 : g.y; const lift = Math.max(0, jumpHeight - ground);
    airTime = jumping ? airTime + dt : 0;
    if (jumping && !previousJump && g.vy > 6) { kick(1.4, -2.2); shake(.18); for (let i = 0; i < 10; i++) fx.emit(car.position.x, ground + .2, 1.4, (Math.random() - .5) * 4, 1, 3, .35, .4, .05, '#ffd07a', '#ff3a5a', 2); }
    if (g.landings > previousLandings) {
      const impact = clamp(g.lastImpact / 20, .2, 1.6); const slammed = g.lastImpact > 25;
      landing = Math.min(1.4, impact); kick(-3.4 * impact, 1.8 * impact, (Math.random() - .5) * 6 * impact); shake(.25 + impact * .35);
      const n = slammed ? 46 : 18;
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (slammed ? 9 : 4) * (.4 + Math.random()); smoke.emit(car.position.x + Math.cos(a) * 1.2, jumpHeight + .15, car.position.z + Math.sin(a) * 2, Math.cos(a) * v, Math.random() * (slammed ? 3 : 1.4), Math.sin(a) * v, .8, .5, slammed ? 2.4 : 1.6, '#f2e9ff', '#9f8ccc', 2.5, .4, true); }
      if (slammed) { shockAge = .12; for (let i = 0; i < 30; i++) fx.emit(car.position.x, jumpHeight + .2, car.position.z, (Math.random() - .5) * 16, Math.random() * 5, (Math.random() - .5) * 16, .4, .35, .05, '#c9fff0', '#19ff8c', 2.5); }
    }
    previousLandings = g.landings;
    if (g.flips > previousFlips) { cues.push('flip'); flipAge = 0; flipDir = g.flipDir || 1; shake(.15); }
    previousFlips = g.flips; flipAge += dt;
    if (g.bumps > previousBumps) { cues.push('bump'); shake(.3); kick(-.4, 0, -(g.lane - g.x || 1) * 8); for (let i = 0; i < 14; i++) fx.emit(car.position.x + Math.sign(g.lane - g.x || 1) * 1.1, ground + .6, car.position.z - .5, (Math.random() - .5) * 6, Math.random() * 5, (Math.random() - .5) * 4, .35, .25, .04, '#fff6a0', '#ff8a1f', 2); }
    previousBumps = g.bumps;
    previousJump = jumping; landing = Math.max(0, landing - dt * 4);
    if (boosting && !previousBoost) { shockAge = 0; shake(.7); kick(.4, -3.5); fovKick = 1; for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2; fx.emit(car.position.x, 1.1, car.position.z + 2.4, Math.cos(a) * 9, Math.sin(a) * 9, 4, .45, .5, .1, '#bff8ff', '#3ff3ff', 2.5); } }
    previousBoost = boosting;
    const steerDelta = parked ? 0 : clamp((g.lane - g.x), -1, 1);
    spring.vr += -steerDelta * 22 * dt;
    for (const [k, v, stiff, dampK] of [['y', 'vy', 120, 11], ['p', 'vp', 110, 9], ['r', 'vr', 100, 9]]) { spring[v] += (-spring[k] * stiff - spring[v] * dampK) * dt; spring[k] += spring[v] * dt; }
    const rumble = playing ? (Math.sin(elapsed * 53) * .006 + Math.sin(elapsed * 31) * .005) * (1 + speedFactor * 2 + (boosting ? 3 : 0)) : 0;
    body.position.y = spring.y * .08 + rumble;
    body.rotation.x = spring.p * .05 + (boosting ? -.025 : 0); body.rotation.z = spring.r * .045;

    const desiredX = parked ? 0 : g.x * LANE;
    car.position.x = parked ? 0 : damp(car.position.x, desiredX, 20, dt);
    car.position.z = 0;
    car.position.y = jumpHeight;
    const steering = parked ? 0 : clamp(steerDelta * .95, -.62, .62);
    car.rotation.y = damp(car.rotation.y, -steering, 16, dt);
    if (Math.abs(steerDelta) > .35 && !jumping && Math.random() < dt * 50) for (const s of [-1, 1]) smoke.emit(car.position.x + s * .9, .15 + ground, 1.4, -steerDelta * 3, .6, 1, .5, .3, 1.1, '#ffffff', '#b9a8de', 3, .3, true);
    car.rotation.x = damp(car.rotation.x, jumping ? clamp(-g.vy * .016, -.3, .35) : 0, 12, dt);
    // Barrel roll when switching lanes in the air.
    const barrel = flipAge < .5 ? smooth(flipAge, 0, .5) * Math.PI * 2 * flipDir : 0;
    car.rotation.z = barrel; if (barrel) { car.position.y += (1 - Math.cos(barrel)) * .75; car.position.x += Math.sin(barrel) * .45; }
    car.scale.set(1 + landing * .05, 1 - landing * .12, 1 + landing * .04);
    for (const w of D.wheels) w.rotation.x -= dt * (roadSpeed / .36) * (intro && t > 1.6 && t < 2.4 ? 0 : 1) + (intro && t > 1.6 && t < 2.4 ? dt * 60 : 0);
    car.visible = !(g.invincible > 0 && playing && Math.floor(elapsed * 16) % 3 === 0);

    // Doors: gullwing pops for the dive, slams with an overshoot.
    const door = D.doors[1];
    if (intro) {
      const open = smooth(t, .35, .55), shut = t < 1.22 ? 0 : 1 - Math.exp(-(t - 1.22) * 16) * Math.cos((t - 1.22) * 30);
      door.rotation.z = -1.3 * open * (1 - clamp(shut, 0, 1.15));
      D.doors[0].rotation.z = damp(D.doors[0].rotation.z, 0, 8, dt);
    } else for (let i = 0; i < D.doors.length; i++) D.doors[i].rotation.z = damp(D.doors[i].rotation.z, won ? (i === 0 ? 1 : -1) * 1.22 : 0, 7, dt);

    // Intro choreography: sprint, dive, slam, spool, launch.
    runner.visible = ready || (intro && t < 1.2) || won;
    seated.visible = !ready && !won && !(intro && t < 1.15);
    handPint.visible = won;
    winTime = won ? winTime + dt : 0;
    if (won) {
      // Out of the car and chugging pint after pint outside the Turbine Arms.
      const cyc = 1.7, ph = (winTime % cyc) / cyc, n = Math.floor(winTime / cyc);
      const raise = smooth(ph, .05, .28) * (1 - smooth(ph, .78, .95));
      runner.position.set(-2.6, Math.abs(Math.sin(winTime * 9)) * .04 * (1 - raise), -9.5);
      runner.rotation.set(0, Math.PI - .95 + Math.sin(winTime * .8) * .1, 0);
      driver.scale.setScalar(1); driver.position.y = 0;
      driver.rotation.set(raise * .32, 0, Math.sin(winTime * 5) * .04 * raise);
      driver.userData.arms[1].rotation.x = 2.45 * raise; driver.userData.arms[1].rotation.z = -.35 * raise;
      driver.userData.arms[0].rotation.x = Math.sin(winTime * 3) * .25 - raise * .4;
      driver.userData.arms[0].rotation.z = raise * .5;
      driver.userData.legs.forEach((l, i) => l.rotation.x = i ? Math.max(0, Math.sin(winTime * 9)) * .3 * (1 - raise) : 0);
      handPint.rotation.x = -raise * .35;
      if (n !== lastChug && winTime > .4) { lastChug = n; chugs++; const hp = new THREE.Vector3(); handPint.getWorldPosition(hp); for (let i = 0; i < 18; i++) fx.emit(hp.x, hp.y + .3, hp.z, (Math.random() - .5) * 3, 2 + Math.random() * 3, (Math.random() - .5) * 3, .6, .35, .05, '#fff6dc', '#ffcc4a', 2); }
      if (Math.random() < dt * 14) { const c = ['#19ff8c', '#ffffff', '#ff8a1f'][Math.floor(Math.random() * 3)]; fx.emit(-4 + Math.random() * 8, 6 + Math.random() * 2, -14 + Math.random() * 6, (Math.random() - .5) * 2, -1.5, 0, 2.4, .35, .25, c, c, .3, -.6); }
    } else { lastChug = -1; chugs = 0; }
    if (ready) {
      runner.position.set(-4.2, 0, 1.6); runner.rotation.set(0, -Math.PI / 2 + Math.sin(elapsed * .8) * .3, 0);
      driver.rotation.set(0, 0, Math.sin(elapsed * 2.2) * .06); driver.position.y = Math.abs(Math.sin(elapsed * 4.4)) * .05;
      driver.userData.arms.forEach((a, i) => a.rotation.x = i ? -2.6 + Math.sin(elapsed * 3) * .15 : Math.sin(elapsed * 2.2) * .2);
      driver.userData.legs.forEach((l, i) => l.rotation.x = i ? Math.max(0, Math.sin(elapsed * 4.4)) * .35 : 0);
    } else if (intro && t < 1.2) {
      const sprint = clamp(t / .78, 0, 1), dive = smooth(t, .78, 1.15);
      const fromX = -7.5, doorX = -1.35;
      const x = t < .78 ? lerp(fromX, doorX, 1 - Math.pow(1 - sprint, 1.6)) : lerp(doorX, -.35, dive);
      runner.position.set(x, t < .78 ? Math.abs(Math.sin(t * 26)) * .18 : Math.sin(dive * Math.PI) * .95 + dive * .3, .05);
      runner.rotation.set(0, -Math.PI / 2, 0);
      driver.rotation.set(t < .78 ? -.42 : lerp(-.42, -1.45, dive), 0, 0);
      driver.scale.setScalar(1 - dive * .55);
      const swing = Math.sin(t * 26);
      driver.userData.legs.forEach((l, i) => l.rotation.x = t < .78 ? swing * (i ? 1 : -1) * 1.1 : -1.2 * dive);
      driver.userData.arms.forEach((a, i) => a.rotation.x = t < .78 ? swing * (i ? -1 : 1) * 1.4 : -2.9 * dive);
      if (t < .78 && Math.random() < dt * 30) smoke.emit(x - .3, .1, .05 + (Math.random() - .5) * .3, -2, .6, 0, .45, .25, .7, '#f4ecff', '#b9a8de', 3, .2, true);
      if (t > 1.1 && !leapDone) { leapDone = true; kick(-4.5, .5, 6); shake(.22); }
    } else driver.scale.setScalar(1);
    if (intro && t > 1.34 && !slamDone) { slamDone = true; cues.push('slamdoor'); kick(-2.2, 0, -7); shake(.4); for (let i = 0; i < 12; i++) smoke.emit(-1.1, .3 + Math.random(), (Math.random() - .5) * 3, -3, .5, 0, .5, .3, 1, '#ffffff', '#c9bdf0', 3, .3); }
    const spool = intro ? smooth(t, 1.45, 2.35) : 0;
    if (intro && t > 1.45 && t < 2.4) { shake(dt * .5 * spool); spring.vp += (Math.random() - .5) * 12 * dt * spool; spring.vy += (Math.random() - .5) * 10 * dt * spool;
      for (const s of [-1, 1]) if (Math.random() < dt * 40 * spool) smoke.emit(s * .91, .25, 1.3, s * 1.5, 1.2, 2.5, 1.1, .6, 2.4, '#ffffff', '#a493d6', 1.2, .9, true); }
    if (intro && t > 2.35 && !launchDone) { launchDone = true; cues.push('boost'); shockAge = 0; shake(.85); kick(.8, -5); fovKick = 1.2; }

    // Jet output: pilot at cruise, burst on jump, full afterburner on boost and launch.
    let thrust = playing ? .2 + speedFactor * .18 : 0;
    if (intro) thrust = spool * .45 + (t > 2.35 ? .7 * (1 - smooth(t, 2.5, 3)) + .2 : 0);
    if (jumping && g.vy > 0) thrust = Math.max(thrust, .45 + g.vy * .03);
    if (boosting) thrust = 1.25;
    if (won || paused) thrust = paused ? thrust : 0;
    const flick = 1 + wave(elapsed * 22) * .14;
    const L = (.6 + thrust * 4.4) * flick;
    burner.visible = thrust > .02;
    outer.scale.set(1 + thrust * .2, 1 + thrust * .2, L); middle.scale.set(1, 1, L * .78); core.scale.set(1, 1, L * .52);
    outer.material.opacity = .12 + thrust * .35; middle.material.opacity = .18 + thrust * .4; core.material.opacity = .35 + thrust * .5; core.material.color.setRGB(1.2 + thrust * 2, 1.4 + thrust * 2.2, 1.8 + thrust * 2.4); middle.material.color.setRGB(1.4 + thrust * 1.6, .9 + thrust, .35 + thrust * .4);
    diamonds.forEach((d, i) => { d.visible = thrust > .55; d.position.z = (i + .6) * L * .15; d.scale.setScalar((1 - i * .14) * (.8 + thrust * .4) * (1 + wave(elapsed * 30, i) * .2)); d.scale.z *= .55; });
    nozzleGlow.scale.setScalar(.45 + thrust * 1.2 * flick); nozzleGlow.material.opacity = clamp(thrust * .55, 0, .7);
    intake.material.emissiveIntensity = (intro ? spool * 4 : 0) + thrust * 3;
    jetLight.intensity = thrust * 22 * flick;
    D.jet.position.x = (Math.random() - .5) * .012 * thrust;
    D.jet.getWorldPosition(nozzle); nozzle.z += .9;
    if (!paused && thrust > .05) {
      const n = Math.floor(thrust * 1.6 + Math.random());
      for (let i = 0; i < n; i++) fx.emit(nozzle.x + (Math.random() - .5) * .3, nozzle.y + (Math.random() - .5) * .3, nozzle.z + L * .3, (Math.random() - .5) * 2, (Math.random() - .5) * 1.5, 6 + thrust * 14, .3 + thrust * .2, .2 + thrust * .16, .03, boosting ? '#7ff3ff' : '#ff9a3a', boosting ? '#3a4dff' : '#ff2a6a', .8);
      if (thrust > .6 && Math.random() < dt * 30) smoke.emit(nozzle.x, nozzle.y, nozzle.z + L * .7, (Math.random() - .5), .8, 4, 1, .8, 2.6, '#cdb8ff', '#6a4fa8', 1.5, .5);
    }
    // 88 mph: fire trails off the rear tyres.
    const mph = Math.round(unitSpeed);
    if (playing && mph >= 88 && !eightyEight) { eightyEight = true; shake(.3); cues.push('eighty'); }
    if (playing && mph >= 88) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) fx.emit(car.position.x + s * .9 + (Math.random() - .5) * .15, .12 + car.position.y, car.position.z + 1.3, 0, .4, 0, .55, .55, .2, '#fff1a0', '#ff4a1a', 0, 0, true);

    // Flag cloth: hangs at rest, streams and whips at speed.
    const wind = clamp((roadSpeed / 40) + (boosting ? .35 : 0) + (intro ? .1 : .12), 0, 1.4);
    const freq = 5 + wind * 22, amp = .05 + wind * .16;
    for (let i = 0; i < clothPos.count; i++) {
      const { u, v } = clothRest[i]; const along = u * FLAG_W;
      const hang = 1 - clamp(wind * 1.5, 0, 1);
      const ph = along * (3.2 + wind * 3) - elapsed * freq + v * .9;
      const flap = Math.sin(ph) * amp * u * (1 + u) + Math.sin(ph * 2.3 + v * 3) * amp * .35 * u;
      // Streaming direction is +Z (behind the car); hanging droops along -Y.
      const zStream = along * (1 - hang * .7), yDroop = -along * hang * .55;
      clothPos.setXYZ(i, flap - along * .55 + steerDelta * along * .35, 2.28 - (1 - v) * FLAG_H + yDroop + Math.sin(ph * .7) * amp * .4 * u, zStream);
    }
    clothPos.needsUpdate = true; clothGeo.computeVertexNormals();
    whip.rotation.x = clamp(wind * .18 + spring.p * .02, 0, .3); cloth.rotation.x = whip.rotation.x * .5; tip.position.z = Math.sin(whip.rotation.x) * 1.2;

    // Ground FX.
    under.position.set(car.position.x, ground + .03, car.position.z); under.material.opacity = (playing || intro ? .75 : .45) * clamp(1 - lift * .2, .15, 1) * (.9 + Math.sin(elapsed * 9) * .1);
    shadowBlob.position.set(car.position.x, ground + .025, car.position.z); shadowBlob.scale.setScalar(clamp(1 - lift * .1, .5, 1));
    ringAge += dt; ring.visible = ringAge < .45; ring.position.set(car.position.x, 1.2 + ringAge * 2.5, car.position.z - .5); ring.scale.setScalar(.6 + ringAge * 4); ring.material.opacity = Math.max(0, 1 - ringAge * 2.3);
    shockAge += dt; shock.visible = shockAge < .5; shock.position.set(car.position.x, 1.1 + car.position.y, 2.6); shock.scale.setScalar(.6 + shockAge * 9); shock.material.opacity = Math.max(0, .8 - shockAge * 2.2);

    const pubDistance = (LENGTH - g.distance) * SCALE;
    pub.visible = !parked && pubDistance < 150; pub.position.set(0, 0, -Math.max(16, pubDistance));

    fx.update(paused ? 0 : dt, paused ? 0 : roadSpeed); smoke.update(paused ? 0 : dt, paused ? 0 : roadSpeed);

    // Camera: low and close behind, leaning into the corners; shakes and FOV punches sell the speed.
    trauma = Math.max(0, trauma - dt * 1.4); fovKick = Math.max(0, fovKick - dt * 1.6);
    if (playing && boosting) trauma = Math.max(trauma, .32);
    const portrait = width / height < .85;
    const sh = reducedMotion ? 0 : trauma * trauma;
    const n1 = wave(elapsed * 23, 1), n2 = wave(elapsed * 19, 2), n3 = wave(elapsed * 17, 3);
    let pos, look, fov, roll;
    if (won) {
      const a = .15 + Math.sin(winTime * .25) * .45;
      pos = tmpV.set(-2.6 + Math.sin(a) * 4.6, 1.6, -9.5 + Math.cos(a) * 4.6);
      look = [-2.6, portrait ? .15 : .8, -9.5]; fov = portrait ? 58 : 44; roll = 0;
    } else if (ready) {
      const a = elapsed * .22;
      pos = tmpV.set(Math.sin(a) * 7.5 - 1.5, 2.1 + Math.sin(elapsed * .4) * .3, Math.cos(a) * 7.5 + 1);
      look = [ -1, 1, 0 ]; fov = portrait ? 66 : 50; roll = 0;
    } else {
      camX = damp(camX, car.position.x * .82, 7, dt);
      const chase = { y: portrait ? 4.7 : 3.9, z: portrait ? 7.8 : 7.0, lookY: portrait ? .6 : .8, lookZ: portrait ? -14 : -16 };
      const boostDrop = boosting ? 1 : 0;
      camY = damp(camY, jumpHeight, jumping ? 3.5 : 6, dt);
      let cx = camX, cy = chase.y - boostDrop * .45 - speedFactor * .25 + camY * .7, cz = chase.z - boostDrop * .9;
      let lx = car.position.x * .55, ly = chase.lookY + camY * .6, lz = chase.lookZ;
      if (intro) {
        // Side shot on the dive and slam, swinging to the chase position for the launch.
        const swing = smooth(t, 1.45, 2.55);
        cx = lerp(-6.2, cx, swing); cy = lerp(1.55, cy, swing); cz = lerp(3.4, cz, swing);
        lx = lerp(-.8, lx, swing); ly = lerp(1.05, ly, swing); lz = lerp(-.4, lz, swing);
      }
      pos = tmpV.set(cx, cy, cz); look = [lx, ly, lz];
      fov = (portrait ? 70 : 60) + speedFactor * 8 + (boosting ? 13 : 0) + fovKick * 9;
      camRoll = damp(camRoll, -(car.position.x - camX) * .035 - steerDelta * .05, 6, dt); roll = camRoll;
    }
    camera.fov = damp(camera.fov, fov, ready ? 2 : 5, dt); camera.updateProjectionMatrix();
    camera.position.set(pos.x + n1 * sh * .5, pos.y + n2 * sh * .35, pos.z + n3 * sh * .2);
    camera.lookAt(look[0] + n2 * sh * .25, look[1] + n1 * sh * .2, look[2]);
    camera.rotateZ(roll + n3 * sh * .04);
    skyMesh.position.copy(camera.position);
    composer.render(dt);
    return { cues, thrust, mph, boosting };
  }
  if (globalThis.location?.search.includes('debug')) globalThis.__tr = { scene, burner, bloom, fx, smoke, under, streaks, cloth, renderer, camera };
  function dispose() { renderer.dispose(); }
  return { resize, render, dispose };
}
