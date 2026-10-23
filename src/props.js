/** Roadside set dressing for the neon Irish dusk. All grounded at y=0, road runs along -Z. */
const NEON = { green: '#19ff8c', orange: '#ff8a1f', pink: '#ff3fa4', cyan: '#3ff3ff', gold: '#ffd23f', white: '#fff6e0' };

function kit(T) {
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .75, flatShading: true, ...extra });
  const glow = (color, intensity = 3) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .4 });
  const box = (parent, material, size, pos, rot) => {
    const m = new T.Mesh(new T.BoxGeometry(...size), material); m.position.set(...pos);
    if (rot) m.rotation.set(...rot); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const cyl = (parent, material, rt, rb, h, pos, seg = 10) => {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), material); m.position.set(...pos);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  return { mat, glow, box, cyl };
}

function signTexture(T, text, color) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
  const x = c.getContext('2d'); if (!x) return null;
  x.fillStyle = '#140a26'; x.fillRect(0, 0, 1024, 192);
  x.strokeStyle = color; x.lineWidth = 10; x.shadowColor = color; x.shadowBlur = 24; x.strokeRect(18, 18, 988, 156);
  x.font = 'italic 900 108px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#ffffff'; x.shadowBlur = 30; x.fillText(text, 512, 100);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** A neon arch over the road. Pillars sit outside the kerbs at x = +-6.6. */
export function createGantry(T, text = 'SLAINTE', color = NEON.green) {
  const { mat, glow, box } = kit(T); const g = new T.Group();
  const steel = mat('#2a1d4a', { metalness: .5, roughness: .4 }); const tube = glow(color, 4); const warm = glow(NEON.orange, 3.5);
  for (const s of [-1, 1]) {
    box(g, steel, [.5, 6.4, .5], [s * 6.6, 3.2, 0]);
    box(g, tube, [.08, 6.2, .08], [s * 6.33, 3.2, -.27]);
    box(g, warm, [.08, 6.2, .08], [s * 6.87, 3.2, -.27]);
  }
  box(g, steel, [13.8, .7, .6], [0, 6.55, 0]);
  box(g, tube, [13.6, .08, .08], [0, 6.18, -.32]); box(g, tube, [13.6, .08, .08], [0, 6.92, -.32]);
  // Celtic knot nodes along the beam.
  for (let i = -3; i <= 3; i++) { const k = new T.Mesh(new T.TorusGeometry(.24, .05, 6, 14), i % 2 ? warm : tube); k.position.set(i * 1.9, 6.55, -.34); g.add(k); }
  const tex = signTexture(T, text, color);
  if (tex) {
    const sign = new T.Mesh(new T.PlaneGeometry(6.4, 1.2), new T.MeshBasicMaterial({ map: tex, color: new T.Color(2.4, 2.4, 2.4), toneMapped: true }));
    sign.position.set(0, 5.45, -.32); sign.rotation.y = 0; g.add(sign);
    box(g, steel, [6.6, 1.35, .2], [0, 5.45, -.18]);
  }
  return g;
}

/** Whitewashed cottage with a coloured door and lit windows. */
export function createCottage(T, door = '#e8243c') {
  const { mat, glow, box } = kit(T); const g = new T.Group();
  const wall = mat('#fff7ef'), thatch = mat('#e8b04a'), frame = mat(door), lit = glow('#ffcf6a', 2.6);
  box(g, wall, [5, 2.4, 3], [0, 1.2, 0]);
  const roof = new T.Mesh(new T.CylinderGeometry(.01, 2.3, 1.9, 4, 1), thatch); roof.rotation.y = Math.PI / 4; roof.scale.set(1.55, 1, .95); roof.position.set(0, 3.3, 0); roof.castShadow = true; g.add(roof);
  box(g, frame, [.95, 1.7, .12], [0, .85, 1.52]);
  for (const s of [-1, 1]) { box(g, frame, [1.05, .95, .1], [s * 1.6, 1.35, 1.52]); box(g, lit, [.85, .75, .1], [s * 1.6, 1.35, 1.56]); }
  box(g, mat('#c9c2d8'), [.5, .9, .5], [1.7, 4.1, 0]);
  return g;
}

/** Spinning neon shamrock on a pole. userData.spin rotates. */
export function createShamrock(T) {
  const { mat, glow, box } = kit(T); const g = new T.Group();
  box(g, mat('#2a1d4a', { metalness: .5 }), [.16, 3.6, .16], [0, 1.8, 0]);
  const spin = new T.Group(); spin.position.y = 4.3; g.add(spin);
  const leaf = glow(NEON.green, 3.4);
  const shape = new T.Shape(); // heart leaf
  shape.moveTo(0, 0); shape.bezierCurveTo(-.55, .35, -.5, .95, 0, .7); shape.bezierCurveTo(.5, .95, .55, .35, 0, 0);
  const geo = new T.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: false }); geo.translate(0, 0, -.06);
  for (let i = 0; i < 3; i++) { const m = new T.Mesh(geo, leaf); m.rotation.z = i * Math.PI * 2 / 3; spin.add(m); }
  box(spin, glow(NEON.orange, 3), [.1, .7, .1], [0, -.55, 0], [0, 0, .25]);
  g.userData.spin = spin; return g;
}

/** Irish round tower, landmark scale. */
export function createRoundTower(T) {
  const { mat, glow, cyl } = kit(T); const g = new T.Group();
  cyl(g, mat('#d8cfe8'), 1.3, 1.6, 16, [0, 8, 0], 14);
  const cap = new T.Mesh(new T.ConeGeometry(1.45, 3.2, 14), mat('#4a3a78')); cap.position.y = 17.6; cap.castShadow = true; g.add(cap);
  cyl(g, glow(NEON.green, 3), 1.34, 1.34, .14, [0, 15.9, 0], 14);
  cyl(g, glow(NEON.orange, 3), 1.48, 1.48, .14, [0, 4, 0], 14);
  return g;
}

export { NEON };

/** Turbine blade transporter: a ramp at the tail, a flat blade on top you can drive along, a low cab ahead.
 *  Built from the tail (z=0) forward to z=-length. Deck top sits at `deck`. */
export function createBladeTruck(T, length, deck, ramp) {
  const { mat, glow, box } = kit(T); const g = new T.Group();
  const bladeMat = mat('#f8f6ff', { roughness: .45 }), steel = mat('#2a1d4a', { metalness: .5, roughness: .4 }), tyre = mat('#15121f');
  const yellow = mat('#ffd23f'), cab = mat('#19c95a');
  // Trailer bed and wheels.
  box(g, steel, [2.4, .35, length - 3], [0, 1.05, -length / 2 - .5]);
  for (const z of [-2.2, -3.6, -5, -length + 5.2, -length + 3.8]) for (const s of [-1, 1]) { const w = new T.Mesh(new T.CylinderGeometry(.55, .55, .45, 12), tyre); w.rotation.z = Math.PI / 2; w.position.set(s * 1.05, .55, z); w.castShadow = true; g.add(w); }
  // The blade: tapering aerofoil, broad face up, root end round.
  const shape = new T.Shape(); shape.moveTo(-.65, 0); shape.lineTo(.65, 0); shape.lineTo(1.45, -length * .3); shape.lineTo(1.4, -length * .8); shape.lineTo(-1.4, -length * .8); shape.lineTo(-1.45, -length * .3); shape.closePath();
  const bladeGeo = new T.ExtrudeGeometry(shape, { depth: .32, bevelEnabled: false }); bladeGeo.rotateX(Math.PI / 2); bladeGeo.translate(0, deck, 0);
  const blade = new T.Mesh(bladeGeo, bladeMat); blade.castShadow = blade.receiveShadow = true; g.add(blade);
  const root = new T.Mesh(new T.CylinderGeometry(1.3, 1.3, length * .2, 16), bladeMat); root.rotation.x = Math.PI / 2; root.position.set(0, deck - 1.1, -length * .9); root.castShadow = true; g.add(root);
  box(g, bladeMat, [2.8, .32, length * .2], [0, deck - .16, -length * .9]);
  // Neon edges along the blade and a hazard tip.
  for (const s of [-1, 1]) box(g, glow('#19ff8c', 3), [.08, .08, length * .78], [s * 1.38, deck + .02, -length * .42]);
  box(g, glow('#ff3a5a', 3.5), [1.3, .1, .2], [0, deck + .02, -.12]);
  // Supports under the blade.
  for (const z of [-length * .35, -length * .7]) box(g, yellow, [2, deck - 1.2, .3], [0, 1.2 + (deck - 1.2) / 2, z]);
  if (ramp) {
    const len = Math.hypot(ramp, deck), a = Math.atan2(deck, ramp);
    const r = box(g, mat('#ff8a1f'), [2.6, .18, len], [0, deck / 2, ramp / 2], [a, 0, 0]);
    for (let i = 0; i < 4; i++) box(g, glow('#ffd23f', 2.5), [2.62, .03, .18], [0, (i + .5) / 4 * deck + .1, ramp - (i + .5) / 4 * ramp], [a, 0, 0]);
    void r;
  }
  // Cab, below the blade root, facing -Z.
  box(g, cab, [2.4, 2.1, 2.4], [0, 1.4, -length + 1.2]); box(g, mat('#3fd6e8', { metalness: .3, roughness: .1 }), [2.2, .8, .1], [0, 1.9, -length - .02]);
  for (const s of [-1, 1]) box(g, glow('#ff8a1f', 3.5), [.25, .2, .1], [s * .9, 2.55, -length - .02]);
  return g;
}

/** Guinness-style tanker: black barrel, cream band, flat catwalk on top at `deck`. No ramp: jump on. */
export function createTanker(T, length, deck) {
  const { mat, glow, box } = kit(T); const g = new T.Group();
  const black = mat('#120d18', { roughness: .3, metalness: .4 }), cream = mat('#fff1c8'), gold = glow('#ffcc4a', 1.6), tyre = mat('#15121f');
  const tank = new T.Mesh(new T.CylinderGeometry(1.25, 1.25, length - 2.8, 20), black); tank.rotation.x = Math.PI / 2; tank.position.set(0, deck - 1.25, -(length - 2.8) / 2); tank.castShadow = tank.receiveShadow = true; g.add(tank);
  const band = new T.Mesh(new T.CylinderGeometry(1.27, 1.27, 2.2, 20), cream); band.rotation.x = Math.PI / 2; band.position.set(0, deck - 1.25, -(length - 2.8) / 2); g.add(band);
  for (const s of [-1, 1]) { const harp = box(g, gold, [.05, .9, .7], [s * 1.28, deck - 1.2, -(length - 2.8) / 2]); void harp; }
  box(g, mat('#3a2f4f', { metalness: .6 }), [1.2, .08, length - 3], [0, deck, -(length - 2.8) / 2]);
  for (const s of [-1, 1]) box(g, glow('#19ff8c', 3), [.05, .05, length - 3], [s * .6, deck + .05, -(length - 2.8) / 2]);
  box(g, glow('#ff3a5a', 3.5), [2.4, .12, .08], [0, .6, .02]);
  for (const z of [-1, -2.2, -length + 4]) for (const s of [-1, 1]) { const w = new T.Mesh(new T.CylinderGeometry(.5, .5, .4, 12), tyre); w.rotation.z = Math.PI / 2; w.position.set(s * 1.05, .5, z); g.add(w); }
  box(g, mat('#ff8a1f'), [2.4, 2.3, 2.4], [0, 1.5, -length + 1.2]); box(g, mat('#3fd6e8', { metalness: .3, roughness: .1 }), [2.2, .8, .1], [0, 2, -length - .02]);
  return g;
}
