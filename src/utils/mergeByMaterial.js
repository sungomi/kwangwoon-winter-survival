import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function normalizeGeometry(geo, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(matrix);
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  return g;
}

/**
 * Collapse every static mesh under `root` into one mesh per material (huge draw-call savings).
 * Objects flagged with `userData.keep = true` (and their subtree), sprites and lines are left as-is.
 */
export function mergeByMaterial(root, { castShadow = true, receiveShadow = false } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const kept = [];

  function visit(obj) {
    for (const child of [...obj.children]) {
      if (child.userData.keep || child.isSprite || child.isLine || child.isLineSegments || child.isInstancedMesh || child.isLight) {
        kept.push(child);
        continue;
      }
      if (child.isMesh && !Array.isArray(child.material)) {
        const rel = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);
        const key = child.material.uuid;
        if (!buckets.has(key)) buckets.set(key, { material: child.material, geos: [] });
        buckets.get(key).geos.push(normalizeGeometry(child.geometry, rel));
      }
      visit(child);
    }
  }
  visit(root);

  const out = new THREE.Group();
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);
  out.userData = { ...root.userData };
  for (const { material, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    out.add(mesh);
  }
  for (const k of kept) {
    // re-parent kept objects with their transform relative to root preserved
    const rel = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld);
    k.removeFromParent();
    rel.decompose(k.position, k.quaternion, k.scale);
    out.add(k);
  }
  return out;
}

/**
 * Static batcher for world building: queue geometry + transform per material, flush into few meshes.
 */
export function createStaticBatcher() {
  const buckets = new Map();
  const tmp = new THREE.Object3D();
  return {
    add(geometry, material, position, rotationY = 0, scale = null, rotation = null) {
      tmp.position.copy(position);
      if (rotation) tmp.rotation.copy(rotation);
      else tmp.rotation.set(0, rotationY, 0);
      if (scale) tmp.scale.copy(scale);
      else tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      const key = material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material, geos: [] });
      buckets.get(key).geos.push(normalizeGeometry(geometry, tmp.matrix));
    },
    addMesh(mesh) {
      mesh.updateMatrixWorld(true);
      const key = mesh.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material: mesh.material, geos: [] });
      buckets.get(key).geos.push(normalizeGeometry(mesh.geometry, mesh.matrixWorld));
    },
    flush(parent, { castShadow = true, receiveShadow = true } = {}) {
      for (const { material, geos } of buckets.values()) {
        // chunk to keep individual buffers reasonable
        for (let i = 0; i < geos.length; i += 4000) {
          const merged = mergeGeometries(geos.slice(i, i + 4000), false);
          if (!merged) continue;
          const mesh = new THREE.Mesh(merged, material);
          mesh.castShadow = castShadow;
          mesh.receiveShadow = receiveShadow;
          parent.add(mesh);
        }
      }
      buckets.clear();
    },
  };
}
