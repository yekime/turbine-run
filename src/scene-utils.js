/** Batch static meshes by material, preserving animated subgroups and their refs. */
export function batchStatic(THREE, root, animated = []) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  const old = [];
  root.traverse(object => {
    if (!object.isMesh || Array.isArray(object.material)) return;
    for (let ancestor = object; ancestor && ancestor !== root; ancestor = ancestor.parent) {
      if (animated.includes(ancestor)) return;
    }
    const source = object.geometry;
    if (!source?.getAttribute('position')) return;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    const key = object.material;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(geometry);
    old.push(object);
  });
  for (const [material, geometries] of groups) {
    const vertices = geometries.reduce((n, geometry) => n + geometry.getAttribute('position').count, 0);
    const combined = new THREE.BufferGeometry();
    for (const [name, size] of [['position',3],['normal',3],['uv',2]]) {
      const array = new Float32Array(vertices * size);let cursor = 0;
      for (const geometry of geometries) {
        const attribute = geometry.getAttribute(name);
        const count = geometry.getAttribute('position').count;
        if (attribute) array.set(attribute.array, cursor);
        cursor += count * size;
      }
      combined.setAttribute(name,new THREE.BufferAttribute(array,size));
    }
    combined.computeBoundingSphere();combined.computeBoundingBox();
    const mesh = new THREE.Mesh(combined,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    geometries.forEach(geometry=>geometry.dispose());
  }
  old.forEach(object=>{object.removeFromParent();object.geometry.dispose();});
  return root;
}
