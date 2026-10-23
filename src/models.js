/** Chunky, shadow-casting roadside models. All objects are grounded at y=0.
 * Vehicles face -Z. Geometry is deliberately low-poly; no remote assets.
 */
function kit(T) {
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .7, flatShading: true, ...extra });
  const mesh = (geometry, material, x=0, y=0, z=0) => {
    const object = new T.Mesh(geometry, material); object.position.set(x,y,z);
    object.castShadow = true; object.receiveShadow = true; return object;
  };
  const box = (parent, material, size, pos, rot) => {
    const object = mesh(new T.BoxGeometry(...size),material,...pos);
    if(rot) object.rotation.set(...rot); parent.add(object); return object;
  };
  const sphere = (parent, material, size, pos, detail=1) => {
    const object=mesh(new T.IcosahedronGeometry(1,detail),material,...pos);
    object.scale.set(...size);parent.add(object);return object;
  };
  const cylinder=(parent,material,rt,rb,height,pos,rot=[0,0,0],segments=10)=>{
    const object=mesh(new T.CylinderGeometry(rt,rb,height,segments),material,...pos);
    object.rotation.set(...rot);parent.add(object);return object;
  };
  const pipe=(parent, material, from, to, radius=.055)=>{
    const a=new T.Vector3(...from),b=new T.Vector3(...to),delta=b.clone().sub(a);
    const object=cylinder(parent,material,radius,radius,delta.length(),a.clone().add(b).multiplyScalar(.5).toArray(),[0,0,0],8);
    object.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return object;
  };
  const prism=(parent,material,width,profile)=>{
    const positions=[],indices=[],n=profile.length;
    for(const x of [-width/2,width/2]) for(const [z,y] of profile)positions.push(x,y,z);
    // Each face receives its own normal via non-indexed conversion.
    for(let i=1;i<n-1;i++){indices.push(0,i+1,i);indices.push(n,n+i,n+i+1);}
    for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+j,i,n+j,n+i);}
    let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);
    geo=geo.toNonIndexed();geo.computeVertexNormals();const object=mesh(geo,material);parent.add(object);return object;
  };
  const wheel=(parent,x,y,z,radius,width,metal,tire)=>{
    const group=new T.Group();group.position.set(x,y,z);parent.add(group);
    cylinder(group,tire,radius,radius,width,[0,0,0],[0,0,Math.PI/2],12);
    for(const side of [-1,1]){
      cylinder(group,metal,radius*.60,radius*.60,.035,[side*(width/2+.018),0,0],[0,0,Math.PI/2],10);
      cylinder(group,tire,radius*.17,radius*.17,.045,[side*(width/2+.04),0,0],[0,0,Math.PI/2],8);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;box(group,metal,[.045,radius*.11,radius*.38],[side*(width/2+.045),Math.sin(a)*radius*.33,Math.cos(a)*radius*.33],[a,0,0]);}
    }
    return group;
  };
  return {mat,mesh,box,sphere,cylinder,pipe,prism,wheel};
}

/** Private DMC-12 helpers: closed lofts between convex rings, auto-oriented outward. */
function carKit(T, mesh) {
  const loft = (parent, material, rings, origin = [0, 0, 0]) => {
    const tris = [], n = rings[0].length, f = rings[0], l = rings[rings.length - 1];
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      for (let j = 0; j < n; j++) { const k = (j + 1) % n; tris.push(a[j], b[j], b[k], a[j], b[k], a[k]); }
    }
    for (let j = 1; j < n - 1; j++) tris.push(f[0], f[j + 1], f[j], l[0], l[j], l[j + 1]);
    let volume = 0;
    for (let t = 0; t < tris.length; t += 3) {
      const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
      volume += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    const order = volume < 0 ? [0, 2, 1] : [0, 1, 2], positions = [];
    for (let t = 0; t < tris.length; t += 3) for (const o of order) { const p = tris[t + o]; positions.push(p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]); }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    const object = mesh(geometry, material); parent.add(object); return object;
  };
  const slab = (parent, material, points, offset, origin) => loft(parent, material, [points, points.map(p => [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]])], origin);
  const table = (rows, z) => {
    if (z <= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i++) if (z <= rows[i][0]) { const [z0, v0] = rows[i - 1], [z1, v1] = rows[i]; return v0 + (v1 - v0) * (z - z0) / (z1 - z0); }
    return rows[rows.length - 1][1];
  };
  return { loft, slab, table };
}

/** DMC-12 wheel: tyre with sidewall bulge, turbine-slot rim, hub. Spins on rotation.x. */
function dmcWheel(T, k, parent, x, z, radius, width, rim, rubber) {
  const { mesh, box, cylinder } = k, side = Math.sign(x), face = width / 2, half = Math.PI / 2;
  const group = new T.Group(); group.position.set(x, radius, z); parent.add(group);
  const tread = radius / Math.cos(Math.PI / 18);
  cylinder(group, rubber, tread, tread, width, [0, 0, 0], [0, 0, half], 18);
  const [inner, outer] = [radius * .98, radius * .84];
  cylinder(group, rubber, side > 0 ? inner : outer, side > 0 ? outer : inner, .035, [side * (face + .017), 0, 0], [0, 0, half], 18);
  cylinder(group, rim, radius * .64, radius * .64, .03, [side * (face + .02), 0, 0], [0, 0, half], 18);
  const lip = mesh(new T.TorusGeometry(radius * .64, .017, 4, 18), rim, side * (face + .036), 0, 0); lip.rotation.y = half; group.add(lip);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI * 2 / 8;
    box(group, rubber, [.012, radius * .13, radius * .22], [side * (face + .037), Math.sin(a) * radius * .41, Math.cos(a) * radius * .41], [-a + .4 * side, 0, 0]);
  }
  cylinder(group, rim, radius * .2, radius * .23, .05, [side * (face + .055), 0, 0], [0, 0, half], 10);
  cylinder(group, rubber, radius * .08, radius * .08, .02, [side * (face + .085), 0, 0], [0, 0, half], 8);
  return group;
}

export function createCar(T) {
  const k = kit(T), { mat, mesh, box, cylinder, pipe } = k, { loft, slab, table } = carKit(T, mesh);
  const car = new T.Group(), body = new T.Group(); car.add(body);
  const PI = Math.PI;
  // Brushed stainless, black polyurethane trim, glass the seated leprechaun shows through.
  const steel = mat('#c3d0d8', { metalness: .42, roughness: .36 }), lightSteel = mat('#e8eff3', { metalness: .38, roughness: .28 });
  const dark = mat('#161c23', { roughness: .62 }), tire = mat('#14181d', { roughness: .9 });
  const glass = mat('#3fd6e8', { metalness: .3, roughness: .12, transparent: true, opacity: .42, depthWrite: false });
  const red = mat('#ff3d4c', { emissive: '#ff1a3c', emissiveIntensity: 3.2 }), amber = mat('#ffb74c', { emissive: '#ff8a24', emissiveIntensity: .35 });
  const cyan = mat('#7af5ff', { emissive: '#20d6ff', emissiveIntensity: 2 }), white = mat('#ffffdc', { emissive: '#fff4bd', emissiveIntensity: 2.4 });
  const titanium = mat('#8d7f8f', { metalness: .82, roughness: .3 });

  // --- Stainless shell: one loft of chamfered sections, wheel arches cut as tunnels.
  const FRONT = { z: -1.25, y: .34, R: .42 }, REAR = { z: 1.17, y: .38, R: .45 }, SILL = .30;
  const TOP = [[-2.07, .70], [-.80, .91], [-.60, .95], [.62, .965], [1.85, .98], [2.05, .98], [2.07, .965]];
  const BOTTOM = [[-2.07, .60], [-2.03, SILL], [2.05, SILL], [2.07, .34]];
  const HALF = [[-2.07, .82], [-1.95, .90], [2.0, .90], [2.07, .86]];
  const archY = (a, z) => { const d = z - a.z; return Math.abs(d) < a.R ? a.y + Math.sqrt(a.R * a.R - d * d) : 0; };
  const stations = [-2.07, -2.03, -1.95, -1.85, -.80, -.60, 0, .62, 1.70, 1.85, 2.0, 2.05, 2.07];
  for (const a of [FRONT, REAR]) {
    const a0 = Math.asin((SILL - a.y) / a.R);
    for (let i = 0; i <= 8; i++) stations.push(a.z + a.R * Math.cos(a0 + (PI - 2 * a0) * i / 8));
  }
  stations.sort((p, q) => p - q);
  const section = z => {
    const t = table(TOP, z), b = Math.max(table(BOTTOM, z), archY(FRONT, z), archY(REAR, z)), h = table(HALF, z);
    const lo = Math.min(b + .02, (b + t) / 2), hi = Math.max(t - .06, (b + t) / 2);
    return [[h, lo, z], [h, hi, z], [h - .09, t, z], [-h + .09, t, z], [-h, hi, z], [-h, lo, z], [-h + .02, b, z], [h - .02, b, z]];
  };
  loft(body, steel, stations.map(section));
  // Dark wheel tubs stop the arch tunnels reading as see-through holes.
  box(body, dark, [1.36, .44, .86], [0, .535, FRONT.z]);
  box(body, dark, [1.26, .5, .92], [0, .56, REAR.z]);
  // Flared arch lips proud of the flanks.
  for (const a of [FRONT, REAR]) for (const s of [-1, 1]) {
    const a0 = Math.asin((SILL - a.y) / a.R), rings = [];
    for (let i = 0; i <= 10; i++) {
      const ang = a0 + (PI - 2 * a0) * i / 10, c = Math.cos(ang), sn = Math.sin(ang);
      rings.push([[a.R, .893], [a.R, .925], [a.R + .045, .925], [a.R + .045, .893]].map(([r, x]) => [s * x, a.y + r * sn, a.z + r * c]));
    }
    loft(body, lightSteel, rings);
  }

  // --- Flanks: black sill, rub strip at bumper height, door aperture, side intake, markers.
  for (const s of [-1, 1]) {
    box(body, dark, [.03, .10, 1.55], [s * .913, .335, -.05]);
    box(body, dark, [.014, .065, .28], [s * .906, .5325, -1.80]);
    box(body, dark, [.014, .065, .38], [s * .906, .5325, 1.80]);
    box(body, dark, [.008, .55, 1.38], [s * .902, .675, -.06]);
    box(body, dark, [.008, .10, .22], [s * .902, .85, .79]);
    for (const y of [.83, .865]) box(body, steel, [.012, .012, .20], [s * .908, y, .79]);
    box(body, amber, [.012, .04, .10], [s * .905, .60, -1.86]);
    box(body, red, [.012, .04, .10], [s * .905, .62, 1.92]);
    // Hood shut lines.
    box(body, dark, [.012, .006, 1.15], [s * .62, .809, -1.43], [-.164, 0, 0]);
  }

  // --- Nose: wraparound bumper, black grille band, quad rectangular headlamps.
  const bumper = (zf, dir, top) => {
    const prof = [[.25, .12], [.255, .015], [.33, 0], [top - .06, .005], [top, .05], [top, .16]];
    return [-.92, -.84, .84, .92].map(x => { const recede = Math.abs(x) > .9 ? .09 : 0; return prof.map(([y, dz]) => [x, y, zf + dir * (dz + recede)]); });
  };
  loft(body, dark, bumper(-2.13, 1, .50));
  loft(body, dark, bumper(2.13, -1, .555));
  for (const s of [-1, 1]) {
    box(body, dark, [.025, .17, .22], [s * .912, .36, -1.86]);
    box(body, dark, [.025, .22, .26], [s * .912, .385, 1.85]);
    box(body, amber, [.16, .05, .02], [s * .62, .40, -2.134]);
    for (const x of [.385, .62]) box(body, white, [.20, .10, .02], [s * x, .585, -2.095]);
  }
  box(body, dark, [1.62, .17, .03], [0, .575, -2.075]);
  for (const y of [.55, .585, .62]) box(body, steel, [.36, .012, .012], [0, y, -2.096]);

  // --- Tail: full-width black panel, ribbed lamps, plate.
  box(body, dark, [1.72, .40, .02], [0, .755, 2.08]);
  for (const s of [-1, 1]) {
    box(body, red, [.52, .22, .016], [s * .57, .765, 2.097]);
    box(body, amber, [.14, .05, .016], [s * .76, .62, 2.097]);
    box(body, lightSteel, [.14, .05, .016], [s * .38, .62, 2.097]);
  }
  for (const y of [.70, .745, .79, .835]) box(body, dark, [1.70, .012, .012], [0, y, 2.109]);
  box(body, lightSteel, [.46, .12, .012], [0, .40, 2.136]);
  box(body, lightSteel, [.34, .025, .006], [0, .79, 2.093]);

  // --- Greenhouse: raked screen, slim pillars, central roof spine the gullwings hinge from.
  slab(body, glass, [[-.80, .91, -.85], [.80, .91, -.85], [.62, 1.45, -.15], [-.62, 1.45, -.15]], [0, -.012, .009]);
  for (const s of [-1, 1]) {
    pipe(body, steel, [s * .82, .91, -.86], [s * .64, 1.435, -.17], .035);
    box(body, dark, [.5, .012, .03], [s * .26 - .04, .955, -.78], [0, 0, s * .06]);
  }
  box(body, steel, [1.28, .05, .13], [0, 1.445, -.125]);
  box(body, steel, [.38, .05, .62], [0, 1.445, .25]);
  box(body, steel, [1.30, .05, .11], [0, 1.445, .615]);
  // Fastback sails, the engine-cover deck and its black louvre bank.
  const slope = z => 1.45 - .383 * (z - .66);
  for (const s of [-1, 1]) {
    const outer = [[.875, .955, .60], [.665, 1.45, .59], [.80, .99, 1.86], [.885, .955, 1.86]].map(([x, y, z]) => [s * x, y, z]);
    slab(body, steel, outer, [-s * .13, 0, 0]);
  }
  loft(body, steel, [
    [[-.56, .96, .64], [.56, .96, .64], [.56, 1.43, .64], [-.56, 1.43, .64]],
    [[-.72, .96, 1.86], [.72, .96, 1.86], [.72, .975, 1.86], [-.72, .975, 1.86]],
  ]);
  for (let i = 0; i < 8; i++) {
    const z = .74 + i * .145, w = 2 * (.56 + .16 * (z - .64) / 1.22);
    box(body, dark, [w, .02, .09], [0, slope(z) + .012, z], [.62, 0, 0]);
  }
  // Cabin: dash, wheel, buckets and console behind the glass.
  box(body, dark, [1.5, .09, .24], [0, .985, -.56]);
  box(body, dark, [.16, .10, .6], [0, 1.0, -.15]);
  const steer = mesh(new T.TorusGeometry(.11, .015, 4, 12), dark, -.36, 1.10, -.40); steer.rotation.x = -.45; body.add(steer);
  for (const s of [-1, 1]) {
    box(body, dark, [.40, .08, .40], [s * .36, .98, .02]);
    box(body, dark, [.40, .42, .09], [s * .36, 1.15, .25], [.2, 0, 0]);
  }

  // --- Gullwings: hinge on the roof spine, roof half, tumblehome glass, skin, mirror, handle slot.
  const doors = [];
  for (const s of [1, -1]) {
    const P = [s * .19, 1.47, 0], L = p => [p[0] - P[0], p[1] - P[1], p[2] - P[2]];
    const door = new T.Group(); door.position.set(...P); body.add(door); doors.push(door);
    const roof = z => [[s * .195, 1.47, z], [s * .60, 1.47, z], [s * .665, 1.425, z], [s * .195, 1.425, z]];
    loft(door, steel, [roof(-.05), roof(.555)], P);
    slab(door, glass, [[s * .66, 1.425, -.11], [s * .66, 1.425, .55], [s * .852, .985, .58], [s * .852, .985, -.70]], [-s * .013, -.006, 0], P);
    box(door, steel, [.027, .59, 1.40], L([s * .9215, .68, -.06]));
    box(door, steel, [.105, .02, 1.32], L([s * .8825, .985, -.065]));
    box(door, dark, [.012, .065, 1.38], L([s * .941, .5325, -.06]));
    box(door, dark, [.008, .03, .18], L([s * .938, .875, .47]));
    box(door, dark, [.07, .025, .04], L([s * .965, 1.005, -.60]));
    box(door, steel, [.07, .09, .17], L([s * 1.0, 1.045, -.60]), [0, s * .12, 0]);
    box(door, glass, [.055, .07, .01], L([s * 1.0, 1.045, -.513]), [0, s * .12, 0]);
  }

  // --- Wheels: bigger rears, each touching y=0.
  const wheels = [];
  for (const x of [-.80, .80]) wheels.push(dmcWheel(T, k, car, x, FRONT.z, .34, .22, lightSteel, tire));
  for (const x of [-.79, .79]) wheels.push(dmcWheel(T, k, car, x, REAR.z, .38, .27, lightSteel, tire));

  // --- Turbine strapped over the louvres: fan in the intake, banded case, petal nozzle.
  const jet = new T.Group(); jet.position.set(0, 1.68, 1.46); body.add(jet);
  const along = [PI / 2, 0, 0];
  const lipRing = mesh(new T.TorusGeometry(.29, .045, 6, 18), lightSteel, 0, 0, -.50); jet.add(lipRing);
  cylinder(jet, dark, .26, .26, .01, [0, 0, -.455], along, 16);
  cylinder(jet, lightSteel, .085, .005, .15, [0, 0, -.52], along, 10);
  for (let i = 0; i < 12; i++) {
    const a = i * PI * 2 / 12;
    box(jet, lightSteel, [.07, .17, .012], [Math.cos(a) * .155, Math.sin(a) * .155, -.48], [0, .6, a - PI / 2, 'ZYX']);
  }
  cylinder(jet, steel, .31, .31, .32, [0, 0, -.29], along, 16);
  cylinder(jet, dark, .32, .32, .38, [0, 0, .06], along, 16);
  for (const z of [-.40, -.20, -.05, .10, .23]) cylinder(jet, lightSteel, .335, .335, .035, [0, 0, z], along, 16);
  for (const z of [-.10, .38]) cylinder(jet, lightSteel, .345, .345, .05, [0, 0, z], along, 16);
  cylinder(jet, titanium, .29, .31, .23, [0, 0, .365], along, 16);
  cylinder(jet, titanium, .26, .29, .10, [0, 0, .53], along, 16);
  for (let i = 0; i < 10; i++) {
    const a = i * PI * 2 / 10, d = .15, P = (r, aa, z) => [Math.cos(aa) * r, Math.sin(aa) * r, z];
    const petal = [P(.262, a - d, .56), P(.262, a + d, .56), P(.228, a + d * .8, .70), P(.228, a - d * .8, .70)];
    slab(jet, titanium, petal, [Math.cos(a) * .014, Math.sin(a) * .014, 0]);
  }
  cylinder(jet, dark, .25, .25, .01, [0, 0, .585], along, 16);
  cylinder(jet, cyan, .20, .20, .01, [0, 0, .60], along, 16);
  const flame = new T.Group(); flame.position.set(0, 0, .72); jet.add(flame);
  // Struts to the sail tops and orange fuel lines dropping into the side intakes.
  for (const s of [-1, 1]) {
    pipe(body, lightSteel, [s * .24, 1.43, 1.36], [s * .70, 1.19, 1.36], .03);
    pipe(body, lightSteel, [s * .24, 1.43, 1.84], [s * .76, 1.0, 1.84], .03);
    pipe(body, amber, [s * .30, 1.56, 1.12], [s * .50, 1.42, 1.06], .02);
    pipe(body, amber, [s * .50, 1.42, 1.06], [s * .62, 1.30, 1.0], .02);
  }
  for (const z of [1.36, 1.84]) pipe(body, lightSteel, [0, 1.36, z], [0, slope(z) - .02, z], .03);

  // Flag mount: a short stub only; the renderer adds the whip and cloth.
  const flag = new T.Group(); flag.position.set(-.82, 0, 1.55); body.add(flag);
  cylinder(flag, lightSteel, .03, .03, .18, [0, 1.07, 0], [0, 0, 0], 6);
  box(flag, dark, [.08, .04, .08], [0, .99, 0]);

  car.userData = { wheels, jet, flame, body, flag, doors, dimensions: { width: 1.86, height: 2.03, length: 4.26 } };
  return car;
}

function animal(T,kind){
  const {mat,box,sphere,cylinder,pipe}=kit(T);const group=new T.Group(),cow=kind==='cow';
  const cream=mat(cow?'#fffaf0':'#fff6e6'),black=mat('#2a2238'),pink=mat('#ed9b9f'),horn=mat('#e7c59c');
  const body=new T.Group();group.add(body);
  const legY=cow?.30:.22;
  for(const x of [-.30,.30])for(const z of [-.43,.43]){
    box(body,cream,[.19,legY*2,.21],[x,legY,z]);box(body,black,[.21,.13,.23],[x,.065,z]);
  }
  if(cow){
    sphere(body,cream,[.60,.53,.84],[0,.88,.05]);
    for(const [x,y,z,s] of [[-.49,1,.2,.29],[.47,.92,-.2,.24],[.16,1.34,.27,.22],[-.3,1.26,-.44,.24],[.45,.78,.52,.23]])sphere(body,black,[s,s*.75,s],[x,y,z]);
  }else{
    sphere(body,cream,[.61,.48,.72],[0,.70,.03]);
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9;sphere(body,cream,[.27,.27,.3],[Math.sin(a)*.43,.81+Math.cos(a)*.22,Math.cos(a*2)*.42]);}
  }
  const head=new T.Group();head.position.set(0,cow?1.08:.79,-.73);body.add(head);
  sphere(head,cow?cream:black,[.35,.37,.39],[0,0,0]);
  sphere(head,cow?pink:black,[.37,.22,.23],[0,-.18,-.30]);
  for(const side of [-1,1]){
    sphere(head,cow?cream:black,[.23,.095,.13],[side*.4,.10,.01]);
    sphere(head,pink,[.13,.048,.07],[side*.4,.13,-.015]);
    sphere(head,cream,[.105,.12,.065],[side*.21,.08,-.31]);
    sphere(head,black,[.054,.068,.035],[side*.21,.08,-.363]);
    sphere(head,cream,[.018,.024,.015],[side*.19,.105,-.392]);
    if(cow){cylinder(head,horn,.015,.075,.27,[side*.24,.37,.03],[0,0,-side*.35],7);sphere(head,black,[.038,.026,.015],[side*.13,-.18,-.52]);}
  }
  if(cow){const bell=mat('#ffd23f',{metalness:.6,roughness:.25,emissive:'#ffb000',emissiveIntensity:.5});sphere(body,bell,[.11,.12,.11],[0,.62,-.62]);box(body,mat('#e83a5c'),[.5,.07,.08],[0,.78,-.6]);}
  if(!cow)for(const x of [-.2,0,.2])sphere(head,cream,[.17,.16,.16],[x,.30,.02]);
  pipe(body,cream,[0,cow?1.08:.83,.73],[.13,cow?.63:.63,cow?1.02:.89],.045);
  sphere(body,cow?black:cream,[.09,.13,.08],[.13,cow?.61:.64,cow?1.04:.89]);
  group.userData={body,head,dimensions:{width:1.25,height:cow?1.65:1.25,length:2.0}};return group;
}
export function createCow(T){return animal(T,'cow');}
export function createSheep(T){return animal(T,'sheep');}

export function createTractor(T){
  const {mat,box,cylinder,pipe,wheel}=kit(T);const group=new T.Group();
  const green=mat('#19c95a'),light=mat('#7dff9e'),dark=mat('#263c3a'),tire=mat('#20252a'),rim=mat('#f2d378'),glass=mat('#9edbd8',{metalness:.25,roughness:.22});
  box(group,dark,[1.20,.29,2.35],[0,.48,0]);box(group,green,[1.03,.68,1.47],[0,1,-.53]);
  box(group,light,[1.08,.08,1.45],[0,1.37,-.53]);box(group,dark,[.89,.46,.05],[0,1.04,-1.29]);
  for(let i=0;i<7;i++)box(group,rim,[.045,.38,.04],[-.36+i*.12,1.04,-1.33]);
  for(const side of [-1,1]){box(group,rim,[.21,.18,.08],[side*.46,1.29,-1.30]);box(group,green,[.38,.12,1.04],[side*.68,1.32,.73]);}
  box(group,glass,[1.02,.78,.86],[0,1.71,.53]);
  for(const x of [-.54,.54])for(const z of [.05,1.01])box(group,dark,[.07,.9,.07],[x,1.75,z]);
  box(group,light,[1.28,.15,1.15],[0,2.24,.53]);
  cylinder(group,dark,.07,.07,.91,[.38,1.81,-.70]);cylinder(group,dark,.1,.1,.07,[.38,2.28,-.70]);
  const wheels=[];
  for(const side of [-1,1]){wheels.push(wheel(group,side*.78,.57,.73,.57,.35,rim,tire));wheels.push(wheel(group,side*.65,.35,-.93,.35,.25,rim,tire));
    box(group,dark,[.28,.09,.40],[side*.67,.70,.07]);
    pipe(group,rim,[side*.57,1.21,.0],[side*.57,1.76,.0],.025);
  }
  const neon=mat('#ff9a2e',{emissive:'#ff7a00',emissiveIntensity:3});box(group,neon,[1.2,.09,.12],[0,2.35,.0]);for(const side of [-1,1])box(group,neon,[.2,.14,.06],[side*.38,1.1,-1.36]);
  group.userData={wheels,dimensions:{width:1.94,height:2.32,length:2.7}};return group;
}

export function createPint(T){
  const {mat,box,cylinder,sphere}=kit(T);const group=new T.Group();
  const stout=mat('#402521'),gold=mat('#ffc85a',{metalness:.45,roughness:.3,emissive:'#ffaa22',emissiveIntensity:1.2}),foam=mat('#fff8d9',{emissive:'#fff1c0',emissiveIntensity:.35});
  cylinder(group,gold,.265,.265,.08,[0,.04,0],[0,0,0],12);
  cylinder(group,gold,.335,.335,.045,[0,.86,0],[0,0,0],12);
  cylinder(group,stout,.315,.245,.72,[0,.50,0],[0,0,0],12);
  cylinder(group,foam,.35,.32,.17,[0,.94,0],[0,0,0],12);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sphere(group,foam,[.14,.08,.14],[Math.sin(a)*.21,1.025,Math.cos(a)*.21]);}
  // Gold harp-like badge, readable from front and behind while it rotates.
  for(const side of [-1,1]){
    box(group,gold,[.15,.29,.022],[0,.53,side*.291],[0,0,-.16]);
    for(let i=0;i<3;i++)box(group,foam,[.014,.20,.024],[-.045+i*.04,.54,side*.305]);
  }
  group.userData.dimensions={width:.72,height:1.12,length:.72};return group;
}

export function createTurbine(T){
  const {mat,cylinder,box,sphere}=kit(T);const group=new T.Group();
  const white=mat('#f6f3ff'),shade=mat('#d9d2f0'),red=mat('#ff3a5a',{emissive:'#ff1d48',emissiveIntensity:3});
  cylinder(group,shade,.15,.32,6.9,[0,3.45,0],[0,0,0],10);
  cylinder(group,white,.40,.46,.18,[0,.09,0],[0,0,0],10);
  box(group,white,[.51,.49,.88],[0,6.95,.12]);box(group,mat('#22ff8f',{emissive:'#11ff88',emissiveIntensity:3}),[.53,.06,.9],[0,6.78,.12]);box(group,red,[.1,.1,.1],[0,7.25,.4]);
  const rotor=new T.Group();rotor.position.set(0,6.95,-.42);group.add(rotor);
  sphere(rotor,white,[.28,.28,.30],[0,0,-.05]);
  for(let i=0;i<3;i++){
    const blade=new T.Group();blade.rotation.z=i*Math.PI*2/3;rotor.add(blade);
    const shape=new T.Shape();shape.moveTo(-.11,.17);shape.lineTo(-.17,.7);shape.lineTo(-.06,2.65);shape.lineTo(.08,2.65);shape.lineTo(.24,.66);shape.lineTo(.13,.17);shape.closePath();
    const geom=new T.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});const mesh=new T.Mesh(geom,white);mesh.castShadow=true;mesh.receiveShadow=true;blade.add(mesh);
    box(blade,red,[.16,.17,.075],[.01,2.49,.03]);
  }
  group.userData={rotor,dimensions:{width:5.4,height:9.65,length:1.4}};return group;
}

export function createPub(T){
  const {mat,box,prism,cylinder}=kit(T);const group=new T.Group();
  const wall=mat('#e8cda0'),roof=mat('#334a49'),trim=mat('#2e654e'),wood=mat('#754b32'),gold=mat('#f7cb72'),glass=mat('#ffd482',{emissive:'#ffb952',emissiveIntensity:2.2});
  box(group,wall,[6,2.65,3.4],[0,1.325,0]);
  // Roof ridge runs along X; an extrusion of the house's end gable.
  prism(group,roof,6.45,[[-1.95,2.62],[0,3.8],[1.95,2.62]]);
  box(group,wood,[1.1,1.95,.12],[0,.98,-1.76]);box(group,trim,[1.3,.16,.18],[0,2.02,-1.79]);
  cylinder(group,gold,.04,.04,.045,[.34,.91,-1.86],[Math.PI/2,0,0],8);
  for(const x of [-2,-.0,2]){
    if(x===0)continue;
    box(group,trim,[1.3,1.4,.13],[x,1.30,-1.75]);box(group,glass,[1.12,1.17,.04],[x,1.30,-1.83]);
    box(group,trim,[.07,1.24,.05],[x,1.30,-1.87]);box(group,trim,[1.2,.07,.05],[x,1.30,-1.87]);
    box(group,wall,[1.4,.13,.32],[x,.59,-1.85]);
  }
  box(group,trim,[6.1,.18,.13],[0,.22,-1.76]);
  box(group,trim,[4.2,.62,.16],[0,2.32,-1.83]);box(group,gold,[4.3,.055,.18],[0,2.64,-1.84]);box(group,gold,[4.3,.055,.18],[0,2.0,-1.84]);
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160;const ctx=canvas.getContext('2d');
    if(ctx){ctx.fillStyle='#28513e';ctx.fillRect(0,0,1024,160);ctx.strokeStyle='#f8d99c';ctx.lineWidth=3;ctx.strokeRect(14,12,996,136);ctx.fillStyle='#fff0bb';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 62px Georgia, serif';ctx.fillText('THE TURBINE ARMS',512,82);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const sign=new T.Mesh(new T.PlaneGeometry(4.02,.55),new T.MeshBasicMaterial({map:texture,color:new T.Color(2.2,2.2,2.2)}));sign.castShadow=true;sign.receiveShadow=true;sign.position.set(0,2.32,-1.93);sign.rotation.y=Math.PI;group.add(sign);group.userData.sign=sign;
    }
  }
  box(group,wall,[.55,1.08,.62],[1.9,3.48,.45]);box(group,roof,[.69,.15,.74],[1.9,4.03,.45]);
  for(const x of [-2.8,2.8]){box(group,wood,[.08,.34,.12],[x,2.04,-1.86]);box(group,glass,[.20,.25,.20],[x,1.89,-1.89]);}
  group.userData.dimensions={width:6.45,height:4.11,length:3.9};return group;
}

export function createTree(T){
  const {mat,cylinder,sphere}=kit(T);const group=new T.Group();
  const bark=mat('#7a4b34'),leaf=mat('#1fcf62'),sun=mat('#8cff6e');
  cylinder(group,bark,.14,.23,1.7,[0,.86,0],[0,0,.05],7);
  sphere(group,leaf,[.94,.96,.82],[0,2.1,0]);sphere(group,sun,[.69,.76,.66],[-.48,2.48,-.12]);sphere(group,leaf,[.66,.72,.64],[.59,2.23,.07]);
  group.userData.dimensions={width:2.5,height:3.25,length:1.8};return group;
}


export function createLeprechaun(T){
  const {mat,box,sphere,cylinder}=kit(T);const character=new T.Group();
  const green=mat('#17834a'),darkGreen=mat('#115c3c'),skin=mat('#ffd3a2'),ginger=mat('#d86d27'),black=mat('#26312d'),gold=mat('#ffd15a'),white=mat('#fff9db');
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.13,.57,0);character.add(leg);legs.push(leg);
    box(leg,darkGreen,[.20,.40,.23],[0,-.19,0]);box(leg,black,[.23,.14,.37],[0,-.48,-.06]);
    const arm=new T.Group();arm.position.set(side*.30,1.04,0);character.add(arm);arms.push(arm);
    box(arm,green,[.17,.33,.20],[side*.035,-.15,0]);sphere(arm,skin,[.115,.12,.11],[side*.04,-.36,0]);
  }
  box(character,green,[.53,.51,.34],[0,.83,0]);box(character,white,[.15,.30,.02],[0,.93,-.181]);
  box(character,black,[.55,.08,.36],[0,.66,0]);box(character,gold,[.12,.10,.035],[0,.66,-.2]);
  sphere(character,skin,[.25,.26,.23],[0,1.29,0]);
  sphere(character,ginger,[.27,.24,.16],[0,1.12,-.14]);
  for(const side of[-1,1]){sphere(character,ginger,[.09,.17,.15],[side*.21,1.24,-.06]);box(character,black,[.044,.052,.03],[side*.087,1.34,-.224]);}
  sphere(character,skin,[.075,.065,.08],[0,1.25,-.27]);
  cylinder(character,darkGreen,.36,.36,.08,[0,1.52,0],[0,0,0],10);
  cylinder(character,green,.24,.28,.32,[0,1.72,0],[0,0,0],10);
  cylinder(character,black,.272,.278,.07,[0,1.59,0],[0,0,0],10);
  box(character,gold,[.12,.105,.035],[0,1.59,-.276]);
  character.userData={legs,arms,dimensions:{width:.85,height:1.88,length:.52}};return character;
}
