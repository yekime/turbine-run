import * as THREE from '../vendor/three.module.js';
import {batchStatic} from './scene-utils.js';
import {jumpHeight as normalizedJumpHeight,JUMP_DURATION,COLLISION_OFFSET,LENGTH} from './engine.js';
import {createCar,createCow,createSheep,createTractor,createPint,createTurbine,createPub,createTree} from './models.js';

// A small, self-contained toy world. Simulation distances are decimetres;
// the renderer translates them to metres, keeping the collision line at z=0.
const LANE=3.2,VIEW=145;
const clamp=THREE.MathUtils.clamp;
const damp=(a,b,k,dt)=>THREE.MathUtils.lerp(a,b,1-Math.exp(-k*dt));
const noise=i=>{const n=Math.sin(i*127.1+63.9)*43758.5453;return n-Math.floor(n)};
export function createRenderer(canvas){
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#f8c69e');scene.fog=new THREE.Fog('#f6cead',65,150);
  const camera=new THREE.PerspectiveCamera(56,1,.1,220);
  scene.add(new THREE.HemisphereLight('#fff4d5','#55a6b0',2.7));
  const sun=new THREE.DirectionalLight('#fff1c8',3.2);sun.position.set(-24,38,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.near=.5;sun.shadow.camera.far=100;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.target.position.set(0,0,-15);scene.add(sun,sun.target);
  const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true,...extra});
  const grass=mat('#86ca50'),roadMat=mat('#566b70'),cream=mat('#fff3c7');
  function box(w,h,d,material,x=0,y=0,z=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;return mesh;}
  scene.add(box(240,.8,240,grass,0,-.45,-65));
  scene.add(box(10.6,.14,185,roadMat,0,-.035,-75));
  scene.add(box(.16,.035,185,cream,-5.03,.05,-75),box(.16,.035,185,cream,5.03,.05,-75));
  const shoulder=mat('#d4b77d');scene.add(box(.75,.08,185,shoulder,-5.7,-.02,-75),box(.75,.08,185,shoulder,5.7,-.02,-75));
  // Warm, low-poly hills create a readable silhouette without hiding hazards.
  const hillMat=[mat('#69b774'),mat('#80c371'),mat('#98cc7f')];
  for(let i=0;i<18;i++){const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),hillMat[i%3]);const side=i%2?1:-1;hill.position.set(side*(26+noise(i)*55),-4,-28-noise(i+7)*110);hill.scale.set(16+noise(i+11)*22,8+noise(i+13)*12,16+noise(i+21)*15);scene.add(hill);}
  const disk=new THREE.Mesh(new THREE.SphereGeometry(11,32,16),new THREE.MeshBasicMaterial({color:'#ffebae'}));disk.position.set(-37,31,-138);scene.add(disk);
  const cloudMat=mat('#fff3d9');for(let i=0;i<9;i++){const cloud=new THREE.Group();for(let j=0;j<3;j++){const p=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),cloudMat);p.scale.set(3.5+j,1.1+noise(j+i),2.2);p.position.set((j-1)*3.8,noise(j+i)*.7,0);cloud.add(p)}cloud.position.set((i%2?1:-1)*(18+noise(i)*50),22+noise(i+1)*14,-40-i*11);scene.add(cloud);}
  // Instanced stone walls and hedge rows keep the mobile draw budget low.
  const wallMaterial=mat('#b1b6a0');const wall=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.55,1.5),wallMaterial,220);wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);
  const hedge=new THREE.InstancedMesh(new THREE.BoxGeometry(1.15,1.3,2.8),mat('#419c59'),92);hedge.castShadow=true;hedge.receiveShadow=true;scene.add(hedge);
  const marks=new THREE.InstancedMesh(new THREE.BoxGeometry(.09,.026,2.6),cream,50);marks.receiveShadow=true;scene.add(marks);
  const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.12,0),mat('#ffe7a0'),100);scene.add(flowers);
  const dummy=new THREE.Object3D();
  const scenery=[];for(let i=0;i<18;i++){const tree=batchStatic(THREE,createTree(THREE));tree.position.x=(i%2?1:-1)*(10+noise(i)*9);const size=.8+noise(i+2)*.75;tree.scale.setScalar(size);scene.add(tree);scenery.push({object:tree,base:-i*8.3,kind:'tree',phase:i});}
  for(let i=0;i<10;i++){const turbine=createTurbine(THREE);batchStatic(THREE,turbine,[turbine.userData.rotor]);batchStatic(THREE,turbine.userData.rotor);turbine.position.x=(i%2?1:-1)*(13.5+noise(i)*5);turbine.scale.setScalar(1.1+noise(i+6)*.35);scene.add(turbine);scenery.push({object:turbine,base:-i*15-10,kind:'turbine',phase:i});}
  for(let i=0;i<5;i++){const animal=batchStatic(THREE,(i%2?createSheep:createCow)(THREE));animal.position.x=(i%2?1:-1)*(10+noise(i)*5);animal.rotation.y=.7+i;scene.add(animal);scenery.push({object:animal,base:-i*27-24,kind:'animal',phase:i});}
  const car=createCar(THREE);
  const animatedCar=[...car.userData.wheels,...car.userData.doors,car.userData.jet];
  batchStatic(THREE,car,animatedCar);
  for(const part of [...car.userData.wheels,...car.userData.doors])batchStatic(THREE,part);
  batchStatic(THREE,car.userData.jet,[car.userData.flame]);batchStatic(THREE,car.userData.flame);
  scene.add(car);
  // Contact shadow remains grounded while the jet lifts the car.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const ctx=shadowCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,4,32,32,32);gradient.addColorStop(0,'rgba(18,47,46,.45)');gradient.addColorStop(1,'rgba(18,47,46,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);const shadowTexture=new THREE.CanvasTexture(shadowCanvas);const contact=new THREE.Mesh(new THREE.PlaneGeometry(3.3,5),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.075;scene.add(contact);
  const pub=batchStatic(THREE,createPub(THREE));pub.rotation.y=Math.PI;pub.scale.setScalar(1.35);scene.add(pub);pub.visible=false;
  const builders={cow:createCow,sheep:createSheep,tractor:createTractor,pint:createPint};const events=new Map();let eventSource=null;
  let elapsed=0,titleTravel=0,previousJump=false,landing=0,previousPints=0,ringAge=1,cameraX=0;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.8,.055,6,32),new THREE.MeshBasicMaterial({color:'#ffdd69',transparent:true,depthWrite:false}));ring.rotation.x=Math.PI/2;scene.add(ring);ring.visible=false;
  const boostLight=new THREE.PointLight('#5fe9ff',0,8,2);boostLight.position.set(0,.7,2.5);car.add(boostLight);
  let width=1,height=1;
  function resize(){width=canvas.clientWidth||innerWidth;height=canvas.clientHeight||innerHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}resize();
  function release(object){object.traverse(child=>{child.geometry?.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(material=>{if(material){material.map?.dispose();material.dispose();}})});scene.remove(object);}
  function render(g,dt){
    dt=clamp(dt||.016,0,.05);const moving=g.mode==='playing'||(g.mode==='ready'&&!reducedMotion);if(moving)elapsed+=dt;const ready=g.mode==='ready';if(ready&&!reducedMotion)titleTravel+=dt*4.2;const travel=ready?titleTravel:g.distance*.1;const boostActive=g.boost>0;const won=g.mode==='won';
    if(eventSource!==g.events){for(const object of events.values())release(object);events.clear();eventSource=g.events;previousPints=g.pints;landing=0;previousJump=false;}
    const wrap=(z,span=VIEW)=>((z+travel+span*100)%span)-span+12;
    for(let i=0;i<220;i++){const side=i%2?1:-1;const row=Math.floor(i/2);dummy.position.set(side*(6.4+noise(row)*.08),.3+(row%2)*.015,wrap(-row*1.36));dummy.rotation.set(0,noise(i)*.12-.06,0);dummy.scale.set(1, .85+noise(i)*.25,1);dummy.updateMatrix();wall.setMatrixAt(i,dummy.matrix);}wall.instanceMatrix.needsUpdate=true;
    for(let i=0;i<92;i++){const side=i%2?1:-1;dummy.position.set(side*7.7,.6,wrap(-Math.floor(i/2)*3.3));dummy.rotation.set(0,0,0);dummy.scale.set(1, .9+noise(i)*.25,1);dummy.updateMatrix();hedge.setMatrixAt(i,dummy.matrix);}hedge.instanceMatrix.needsUpdate=true;
    for(let i=0;i<50;i++){dummy.position.set(i%2?-1.6:1.6,.055,wrap(-Math.floor(i/2)*6.1));dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();marks.setMatrixAt(i,dummy.matrix);}marks.instanceMatrix.needsUpdate=true;
    for(let i=0;i<100;i++){dummy.position.set((i%2?1:-1)*(8.8+noise(i)*3.2),.18,wrap(-i*1.8));dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);}flowers.instanceMatrix.needsUpdate=true;
    for(const item of scenery){item.object.position.z=wrap(item.base);if(item.kind==='turbine'&&item.object.userData.rotor&&moving){const proximity=1-clamp(Math.abs(item.object.position.z)/28,0,1);item.object.userData.rotor.rotation.z+=dt*(.55+proximity*4)*(boostActive?1.6:1);}}
    const needed=new Set();if(!ready)for(const e of g.events){const distance=(e.z-g.distance-COLLISION_OFFSET)*.1;if(e.done||distance< -4||distance>110)continue;needed.add(e);let object=events.get(e);if(!object){object=batchStatic(THREE,(builders[e.type]||createSheep)(THREE));scene.add(object);events.set(e,object);}object.position.set(e.lane*LANE,0,-distance);if(e.type==='pint'){object.rotation.y=elapsed*1.6;object.position.y=.45+Math.sin(elapsed*3+e.z)*.12;}}
    for(const [e,object]of events)if(!needed.has(e)){release(object);events.delete(e);}
    const jumping=g.jump>0;const jumpProgress=jumping?clamp((JUMP_DURATION-g.jump)/JUMP_DURATION,0,1):0;const jumpHeight=normalizedJumpHeight(g)*2.65;if(previousJump&&!jumping)landing=1;previousJump=jumping;landing=Math.max(0,landing-dt*4);
    const desiredX=ready?1.0:g.x*LANE;car.position.x=damp(car.position.x,desiredX,18,dt);car.position.y=jumpHeight+(moving?Math.sin(elapsed*23)*.015:0);const steering=ready?Math.sin(elapsed*.5)*.035:clamp((g.lane-g.x)*.7,-.42,.42);car.rotation.y=damp(car.rotation.y,-steering,10,dt);car.rotation.z=damp(car.rotation.z,-steering*.33,9,dt);car.rotation.x=damp(car.rotation.x,jumping?Math.cos(jumpProgress*Math.PI)*-.16:landing*.08,12,dt);car.scale.y=1-landing*.09;car.scale.x=1+landing*.035;
    if(car.userData.wheels&&moving)for(const wheel of car.userData.wheels)wheel.rotation.x-=dt*(boostActive?30:20)*(ready?.35:1);
    if(car.userData.flame){car.userData.flame.visible=jumping||boostActive;car.userData.flame.scale.set(1+Math.sin(elapsed*63)*.08,1+Math.sin(elapsed*53)*.08,(boostActive?1.7:1.15)+Math.sin(elapsed*80)*.2);}
    if(car.userData.jetRotor&&moving)car.userData.jetRotor.rotation.z+=dt*(boostActive?40:12);
    boostLight.intensity=boostActive||jumping?12:0;
    if(car.userData.doors)for(let i=0;i<car.userData.doors.length;i++){const door=car.userData.doors[i];door.rotation.z=damp(door.rotation.z,won?(i===0?1:-1)*1.22:0,3,dt);}
    if(g.invincible>0&&g.mode==='playing'){car.visible=Math.floor(elapsed*14)%4!==0;}else car.visible=true;
    contact.position.x=car.position.x;contact.scale.setScalar(1-jumpHeight*.10);contact.material.opacity=1-jumpHeight*.16;
    if(g.pints>previousPints)ringAge=0;previousPints=g.pints;ringAge+=dt;ring.visible=ringAge<.5;ring.position.set(car.position.x,.2+ringAge*2,0);ring.scale.setScalar(.7+ringAge*2);ring.material.opacity=Math.max(0,1-ringAge*2);
    const pubDistance=(LENGTH-g.distance)*.1;pub.visible=!ready&&pubDistance<100;pub.position.set(0,0,-Math.max(14,pubDistance));
    const portrait=width/height<.85;const targetFov=(portrait?63:55)+(boostActive&&!reducedMotion?7:0);camera.fov=damp(camera.fov,targetFov,3,dt);camera.updateProjectionMatrix();cameraX=damp(cameraX,ready?3.5:g.x*.43,3,dt);camera.position.set(cameraX,portrait?8.4:5.7,portrait?15.5:10.5);camera.lookAt(ready?-.8:g.x*.3,portrait?.55:.65,portrait?-11:-16);renderer.render(scene,camera);
  }
  function dispose(){scene.traverse(object=>{object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])material?.dispose();});shadowTexture.dispose();renderer.dispose();}
  return{resize,render,dispose};
}
