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

export function createCar(T) {
  const {mat,box,cylinder,pipe,prism,wheel}=kit(T);
  const car=new T.Group(),body=new T.Group();car.add(body);
  const steel=mat('#b8d2dd',{metalness:.72,roughness:.32}),lightSteel=mat('#e0edf0',{metalness:.62,roughness:.3});
  const dark=mat('#192630'),tire=mat('#16202a'),glass=mat('#3fd6e8',{metalness:.3,roughness:.12,transparent:true,opacity:.42,depthWrite:false});
  const red=mat('#ff3d4c',{emissive:'#ff1a3c',emissiveIntensity:3.2}),amber=mat('#ffb74c',{emissive:'#ff8a24',emissiveIntensity:.35});
  const cyan=mat('#7af5ff',{emissive:'#20d6ff',emissiveIntensity:2}),white=mat('#ffffdc',{emissive:'#fff4bd',emissiveIntensity:2.4});
  // Stainless wedge: low nose, upright clipped tail, angular glass cabin.
  prism(body,steel,1.82,[[-1.96,.43],[-1.96,.68],[-.65,.92],[1.78,.87],[1.89,.57],[1.72,.4]]);
  box(body,dark,[1.79,.14,3.54],[0,.39,-.04]);
  prism(body,glass,1.50,[[-.91,.88],[-.34,1.49],[.58,1.49],[1.29,.89]]);
  box(body,lightSteel,[1.53,.09,.92],[0,1.51,.14]);
  // Rear louvre bank slopes with the back window, black stripes unmistakably DeLorean.
  for(let i=0;i<6;i++)box(body,dark,[1.52,.065,.11],[0,1.42-i*.085,.68+i*.105],[.68,0,0]);
  box(body,steel,[1.54,.10,.12],[0,.94,-.92],[.75,0,0]);
  const doors=[];
  for(const side of [-1,1]){
    const door=new T.Group();door.position.set(side*.71,1.48,.1);body.add(door);doors.push(door);
    box(door,steel,[.07,.59,1.22],[side*.15,-.38,0]);
    box(door,lightSteel,[.08,.045,1.13],[side*.13,-.11,0]);
    box(door,dark,[.08,.045,.19],[side*.20,-.30,.30]);
    box(body,steel,[.24,.10,.20],[side*.93,1.01,-.64]);
    // Window pillars, lower sill and body side moulding.
    pipe(body,lightSteel,[side*.75,.89,-.89],[side*.68,1.49,-.34],.04);
    pipe(body,lightSteel,[side*.72,1.49,.59],[side*.79,.91,1.22],.04);
    box(body,dark,[.035,.07,3.5],[side*.922,.60,-.03]);
    box(body,lightSteel,[.06,.11,1.48],[side*.93,.46,0]);
  }
  box(body,dark,[1.79,.19,.08],[0,.62,-1.97]);
  for(const side of [-1,1])for(const offset of [-.14,.14])box(body,white,[.23,.115,.035],[side*.59+offset,.69,-2.02]);
  box(body,steel,[1.88,.10,.16],[0,.43,-1.94]);
  box(body,dark,[1.80,.23,.08],[0,.66,1.88]);
  for(const side of [-1,1]){
    box(body,red,[.44,.15,.04],[side*.60,.68,1.94]);
    box(body,amber,[.12,.15,.045],[side*.87,.68,1.94]);
  }
  box(body,lightSteel,[.42,.13,.05],[0,.56,1.94]);
  const wheels=[];
  for(const x of [-.91,.91])for(const z of [-1.17,1.17])wheels.push(wheel(car,x,.36,z,.36,.24,lightSteel,tire));
  // A large, deliberately over-the-top turbine strapped over the rear deck.
  const jet=new T.Group();jet.position.set(0,1.12,1.23);body.add(jet);
  cylinder(jet,dark,.35,.35,1.17,[0,0,0],[Math.PI/2,0,0],12);
  for(const z of [-.40,.22,.53])cylinder(jet,steel,.39,.39,.11,[0,0,z],[Math.PI/2,0,0],12);
  cylinder(jet,dark,.29,.32,.15,[0,0,.62],[Math.PI/2,0,0],12);
  cylinder(jet,cyan,.23,.23,.018,[0,0,.705],[Math.PI/2,0,0],12);
  const flame=new T.Group();flame.position.set(0,0,.72);jet.add(flame);
  cylinder(flame,cyan,.025,.22,.85,[0,0,.41],[Math.PI/2,0,0],7);
  const flameCore=mat('#e5ffff',{emissive:'#a5faff',emissiveIntensity:2.5});
  cylinder(flame,flameCore,.01,.12,.65,[0,0,.30],[Math.PI/2,0,0],6);
  for(const side of [-1,1]){
    pipe(body,steel,[side*.30,1.1,.76],[side*.57,1.05,.76],.075);
    pipe(body,steel,[side*.57,1.05,.76],[side*.68,.91,1.61],.075);
    pipe(body,steel,[side*.68,.91,1.61],[side*.68,.71,1.90],.075);
    box(body,amber,[.12,.08,.39],[side*.6,.99,1.09]);
  }
  // Small Irish tricolour on the rear-left quarter; green sits at the hoist.
  const flag=new T.Group();flag.position.set(-.94,0,1.63);body.add(flag);
  cylinder(flag,lightSteel,.03,.03,.16,[0,.98,0],[0,0,0],6);
  car.userData={wheels,jet,flame,body,flag,doors:doors.reverse(),dimensions:{width:2.20,height:1.56,length:4.1}};
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
