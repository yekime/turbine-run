import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import * as models from '../src/models.js';
import { batchStatic } from '../src/scene-utils.js';

function meshCount(object){let n=0;object.traverse(child=>{if(child.isMesh)n++;});return n;}
for(const [name,create] of Object.entries(models)){
  test(`${name}: finite ground-based geometry`,()=>{
    const model=create(THREE);model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model);
    for(const value of [...box.min.toArray(),...box.max.toArray()])assert(Number.isFinite(value));
    assert(box.min.y>-.2);assert(box.max.y>0);assert(meshCount(model)>0);
    model.traverse(child=>{if(child.isMesh){const a=child.geometry.getAttribute('position');for(const value of a.array)assert(Number.isFinite(value));}});
  });
}
test('static batching preserves exact bounds and dramatically reduces tractor draws',()=>{
  const model=models.createTractor(THREE);model.updateMatrixWorld(true);
  const before=new THREE.Box3().setFromObject(model);const count=meshCount(model);
  batchStatic(THREE,model);model.updateMatrixWorld(true);
  const after=new THREE.Box3().setFromObject(model);
  assert(before.min.distanceTo(after.min)<.00001);assert(before.max.distanceTo(after.max)<.00001);
  assert(meshCount(model)<count/3);
});
test('car batching keeps wheel and gullwing animation references attached',()=>{
  const car=models.createCar(THREE),data=car.userData;
  const dynamic=[...data.wheels,...data.doors,data.jet];
  batchStatic(THREE,car,dynamic);
  for(const part of dynamic){assert(part.parent);let ancestor=part;while(ancestor.parent)ancestor=ancestor.parent;assert.equal(ancestor,car);}
  for(const wheel of data.wheels)batchStatic(THREE,wheel);
  for(const door of data.doors)batchStatic(THREE,door);
  batchStatic(THREE,data.jet,[data.flame]);batchStatic(THREE,data.flame);
  assert(meshCount(car)<40);
});

test('pub canvas sign texture survives batching (minimal canvas stub)',()=>{
  const previous=globalThis.document;const calls=[];
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},strokeRect(){},fillText(...args){calls.push(args);}})})};
  try {
    const pub=models.createPub(THREE);assert.equal(calls[0][0],'THE TURBINE ARMS');
    batchStatic(THREE,pub);let signs=0;pub.traverse(mesh=>{if(mesh.material?.map?.isCanvasTexture)signs++;});assert.equal(signs,1);
  } finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
