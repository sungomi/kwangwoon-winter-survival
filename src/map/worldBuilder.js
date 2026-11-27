import * as THREE from 'three';
import { createBuildingFacadeTexture, createPitchTexture } from './textures.js';
import { getTerrainHeight, getFootprintMinHeight, registerBuildingPads } from './terrain.js';
import { createStaticBatcher } from '../utils/mergeByMaterial.js';
import { buildCampusFeatures } from './campusFeatures3d.js';
import { PLAZA } from '../data/campusFeatures.js';
import { STAIR_FLIGHTS } from './terrain.js';

function onBuiltLandscape(x, z, pad = 0) {
  if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + PLAZA.blend + pad) return true;
  for (const f of STAIR_FLIGHTS) {
    const rx = x - f.ax;
    const rz = z - f.az;
    const along = rx * f.ux + rz * f.uz;
    const across = -rx * f.uz + rz * f.ux;
    if (along > -pad && along < f.len + pad && Math.abs(across) < f.width / 2 + pad) return true;
  }
  return false;
}

function pointInPoly(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], zi = polygon[i][1];
    const xj = polygon[j][0], zj = polygon[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

function nearAnyBuilding(x, z, buildings, pad = 2.5) {
  for (const b of buildings) {
    if (!b.polygon || b.polygon.length < 3) continue;
    if (
      pointInPoly(x, z, b.polygon) ||
      pointInPoly(x + pad, z, b.polygon) ||
      pointInPoly(x - pad, z, b.polygon) ||
      pointInPoly(x, z + pad, b.polygon) ||
      pointInPoly(x, z - pad, b.polygon)
    ) {
      return true;
    }
  }
  return false;
}

/** Deterministic pseudo-random so the forest/props layout is the same every load. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createShapeFromPolygon(polygon) {
  const shape = new THREE.Shape();
  polygon.forEach(([x, z], idx) => {
    // In XZ plane after rotateX(-PI/2), shape's +Y maps to -Z
    if (idx === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
}

function computePolygonBounds(polygon) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let sumX = 0, sumZ = 0;
  for (const [x, z] of polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    sumX += x;
    sumZ += z;
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx: sumX / polygon.length,
    cz: sumZ / polygon.length,
  };
}

export function buildCampusWorld(scene, mapData, labelsLayer) {
  // Grade level building pads into the terrain heightfield BEFORE building any geometry
  registerBuildingPads(mapData.buildings);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);
  // Everything static is queued here and merged into one mesh per material at the end
  const batch = createStaticBatcher();
  const ORIGIN = new THREE.Vector3();

  // Snowy winter hilly terrain plane (3m grid spacing < 4.2m building pad apron -> zero wall slicing)
  const groundGeo = new THREE.PlaneGeometry(1200, 1200, 400, 400);
  groundGeo.rotateX(-Math.PI / 2);
  const gPos = groundGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const vx = gPos.getX(i);
    const vz = gPos.getZ(i);
    gPos.setY(i, getTerrainHeight(vx, vz));
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ color: '#d8e4f0', roughness: 0.92, metalness: 0.02 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  worldGroup.add(ground);

  // Snowy grass & plazas (grid-tessellated so terrain hills never poke through)
  const grassMat = new THREE.MeshLambertMaterial({ color: '#9ec2ad', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const g of mapData.grasses || []) {
    if (g.polygon.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of g.polygon) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const cell = 4;
    const verts = [];
    for (let x = minX; x < maxX; x += cell) {
      for (let z = minZ; z < maxZ; z += cell) {
        if (!pointInPoly(x + cell * 0.5, z + cell * 0.5, g.polygon)) continue;
        const q = [
          [x, z], [x + cell, z], [x + cell, z + cell], [x, z + cell],
        ].map(([px, pz]) => [px, getTerrainHeight(px, pz) + 0.09, pz]);
        verts.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
      }
    }
    if (!verts.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    batch.add(geo, grassMat, ORIGIN);
  }

  // Winter roads hugging the hill terrain (3m subdivision + joint caps to eliminate V-notches)
  const roadMat = new THREE.MeshLambertMaterial({ color: '#394350', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const road of mapData.roads || []) {
    const pts = road.points;
    const halfW = road.width * 0.5;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) continue;

      const subSteps = Math.max(1, Math.ceil(len / 3));
      const nx = (-dz / len) * halfW;
      const nz = (dx / len) * halfW;
      const verts = [];
      const indices = [];

      for (let s = 0; s <= subSteps; s++) {
        const t = s / subSteps;
        const cx = x1 + dx * t;
        const cz = z1 + dz * t;
        const lx = cx + nx;
        const lz = cz + nz;
        const rx = cx - nx;
        const rz = cz - nz;
        const cy = getTerrainHeight(cx, cz);
        verts.push(lx, Math.max(getTerrainHeight(lx, lz), cy - 0.12) + 0.19, lz);
        verts.push(rx, Math.max(getTerrainHeight(rx, rz), cy - 0.12) + 0.19, rz);
        if (s < subSteps) {
          const base = s * 2;
          indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      batch.add(geo, roadMat, ORIGIN);

      // Circular joint cap at polyline bends so road turns have zero V-notches
      if (i > 0) {
        const cap = new THREE.CircleGeometry(halfW, 10);
        cap.rotateX(-Math.PI / 2);
        batch.add(cap, roadMat, new THREE.Vector3(x1, getTerrainHeight(x1, z1) + 0.19, z1));
      }
    }
  }

  // Athletic pitches & varied non-building tactical cover
  const edgeMat = new THREE.LineBasicMaterial({ color: '#111418', linewidth: 1 });
  const covers = [];
  const crateMat = new THREE.MeshLambertMaterial({ color: '#9c6b3f' });
  const sandbagMat = new THREE.MeshLambertMaterial({ color: '#c4b89b' });
  const snowCoverMat = new THREE.MeshLambertMaterial({ color: '#eef4fa' });
  const drumRedMat = new THREE.MeshLambertMaterial({ color: '#dc2626' });
  const drumBlueMat = new THREE.MeshLambertMaterial({ color: '#2563eb' });
  const benchWoodMat = new THREE.MeshLambertMaterial({ color: '#7c4a27' });

  const coverSpecs = [
    // Central Plaza around Christmas Tree & 비마관 / 80주년 기념관
    { type: 'barricade', x: 8, z: -18, w: 3.8, h: 1.25, d: 1.1, rot: 0.3 },
    { type: 'crate_stack', x: 36, z: -22, w: 2.2, h: 1.9, d: 2.2, rot: 0.1 },
    { type: 'drum', x: 38, z: 4, w: 2.0, h: 1.35, d: 1.2, rot: -0.6 },
    { type: 'snowmound', x: 14, z: 8, w: 3.4, h: 1.35, d: 2.8, rot: 0.4 },
    { type: 'crate_stack', x: -6, z: 2, w: 2.2, h: 1.9, d: 2.2, rot: 0.5 },
    { type: 'bench', x: -22, z: -8, w: 3.4, h: 1.1, d: 1.2, rot: 0.0 },
    // Uphill toward 화도관 & 80주년 기념관
    { type: 'barricade', x: 15, z: -48, w: 4.0, h: 1.25, d: 1.1, rot: 0.15 },
    { type: 'drum', x: 38, z: -55, w: 2.0, h: 1.35, d: 1.2, rot: -0.2 },
    { type: 'snowmound', x: -16, z: -22, w: 3.2, h: 1.35, d: 2.6, rot: -0.3 },
    { type: 'bench', x: -34, z: -38, w: 3.4, h: 1.1, d: 1.2, rot: 0.2 },
    // Uphill West (한천재 / 연구관 / 동해문화예술관 / 한울관)
    { type: 'barricade', x: -75, z: -12, w: 3.8, h: 1.25, d: 1.1, rot: 0.8 },
    { type: 'crate_stack', x: -82, z: -38, w: 2.2, h: 1.9, d: 2.2, rot: 0.25 },
    { type: 'snowmound', x: -95, z: -55, w: 3.6, h: 1.4, d: 2.8, rot: -0.4 },
    { type: 'drum', x: -125, z: -85, w: 2.0, h: 1.35, d: 1.2, rot: 0.5 },
    // South / East Plaza (복지관 / 옥의관 / 새빛관 / 참빛관 / 다산재)
    { type: 'barricade', x: -12, z: 42, w: 3.8, h: 1.25, d: 1.1, rot: -0.2 },
    { type: 'crate_stack', x: 24, z: 46, w: 2.2, h: 1.9, d: 2.2, rot: 0.35 },
    { type: 'bench', x: 52, z: 38, w: 3.4, h: 1.1, d: 1.2, rot: -0.4 },
    { type: 'barricade', x: 128, z: 18, w: 3.8, h: 1.25, d: 1.1, rot: 0.7 },
    { type: 'drum', x: 122, z: -15, w: 2.0, h: 1.35, d: 1.2, rot: 0.1 },
    { type: 'snowmound', x: 138, z: 42, w: 3.4, h: 1.35, d: 2.8, rot: -0.25 },
  ];

  for (const c of coverSpecs) {
    // Cover is never fused into a building: skip any spot that overlaps a real footprint
    if (nearAnyBuilding(c.x, c.z, mapData.buildings, Math.max(c.w, c.d) * 0.5 + 1.5)) continue;
    if (onBuiltLandscape(c.x, c.z, Math.max(c.w, c.d) * 0.5 + 1)) continue;
    const baseY = getTerrainHeight(c.x, c.z) - 0.3;
    const grp = new THREE.Group();
    grp.position.set(c.x, baseY, c.z);
    grp.rotation.y = c.rot;

    if (c.type === 'snowmound') {
      const moundGeo = new THREE.SphereGeometry(c.w * 0.5, 14, 10);
      moundGeo.scale(1, 0.55, 0.85);
      const mound = new THREE.Mesh(moundGeo, snowCoverMat);
      mound.position.y = c.h * 0.35;
      mound.castShadow = true;
      mound.receiveShadow = true;
      grp.add(mound);
    } else if (c.type === 'drum') {
      const dGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 12);
      const d1 = new THREE.Mesh(dGeo, drumRedMat);
      d1.position.set(-0.5, 0.75, 0);
      d1.castShadow = true;
      const d2 = new THREE.Mesh(dGeo, drumBlueMat);
      d2.position.set(0.5, 0.75, 0.15);
      d2.castShadow = true;
      grp.add(d1, d2);
    } else if (c.type === 'crate_stack') {
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.5), crateMat);
      b1.position.y = 0.7;
      b1.castShadow = true;
      b1.add(new THREE.LineSegments(new THREE.EdgesGeometry(b1.geometry), edgeMat));
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.0), crateMat);
      b2.position.set(0.15, 1.75, -0.1);
      b2.rotation.y = 0.35;
      b2.castShadow = true;
      b2.add(new THREE.LineSegments(new THREE.EdgesGeometry(b2.geometry), edgeMat));
      grp.add(b1, b2);
    } else if (c.type === 'bench') {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.8), benchWoodMat);
      seat.position.y = 0.65;
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 0.15), benchWoodMat);
      back.position.set(0, 1.0, -0.35);
      const snow = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.72), snowCoverMat);
      snow.position.y = 0.8;
      grp.add(seat, back, snow);
    } else {
      // Sandbag barricade
      const wall = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), sandbagMat);
      wall.position.y = c.h * 0.5 + 0.15;
      wall.castShadow = true;
      wall.add(new THREE.LineSegments(new THREE.EdgesGeometry(wall.geometry), edgeMat));
      const snowTop = new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.96, 0.18, c.d * 0.96), snowCoverMat);
      snowTop.position.y = c.h + 0.24;
      grp.add(wall, snowTop);
    }

    grp.updateMatrixWorld(true);
    grp.traverse((o) => {
      if (o.isMesh) batch.addMesh(o);
    });

    const halfSpan = Math.max(c.w, c.d) * 0.5;
    covers.push({
      x: c.x,
      z: c.z,
      topY: baseY + c.h + 0.4,
      minX: c.x - halfSpan,
      maxX: c.x + halfSpan,
      minZ: c.z - halfSpan,
      maxZ: c.z + halfSpan,
    });
  }

  // Warm Christmas Streetlamps around the Main Plaza
  const lampPostMat = new THREE.MeshLambertMaterial({ color: '#1e293b' });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
  // lamps ring the round plaza rim (skipping where staircases arrive)
  const lampCoords = [];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.2;
    const lx = PLAZA.x + Math.cos(a) * (PLAZA.radius - 1.2);
    const lz = PLAZA.z + Math.sin(a) * (PLAZA.radius - 1.2);
    const nearStair = STAIR_FLIGHTS.some((f) => Math.hypot(f.bx - lx, f.bz - lz) < f.width / 2 + 2.5);
    if (!nearStair) lampCoords.push([lx, lz]);
  }
  for (const [lx, lz] of lampCoords) {
    if (nearAnyBuilding(lx, lz, mapData.buildings, 0.8)) continue;
    const ly = getTerrainHeight(lx, lz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 5.2, 8), lampPostMat);
    pole.position.set(lx, ly + 2.6, lz);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), lampGlowMat);
    bulb.position.set(lx, ly + 5.3, lz);
    batch.addMesh(pole);
    batch.addMesh(bulb);
  }
  // Sports pitches clipped to their actual OSM polygon and never overlapping buildings
  const soccerMat = new THREE.MeshLambertMaterial({ color: '#5d9370', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const basketMat = new THREE.MeshLambertMaterial({ color: '#376ba2', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  for (const p of mapData.pitches || []) {
    if (p.polygon && p.polygon.length >= 3) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of p.polygon) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      const cell = 3;
      const verts = [];
      for (let x = minX; x < maxX; x += cell) {
        for (let z = minZ; z < maxZ; z += cell) {
          const cx = x + cell * 0.5;
          const cz = z + cell * 0.5;
          if (!pointInPoly(cx, cz, p.polygon)) continue;
          if (nearAnyBuilding(cx, cz, mapData.buildings, 1.0)) continue;
          const q = [
            [x, z], [x + cell, z], [x + cell, z + cell], [x, z + cell],
          ].map(([px, pz]) => [px, getTerrainHeight(px, pz) + 0.18, pz]);
          verts.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
        }
      }
      if (!verts.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.computeVertexNormals();
      batch.add(geo, p.type === 'basketball' ? basketMat : soccerMat, ORIGIN);
    } else {
      if (nearAnyBuilding(p.center[0], p.center[1], mapData.buildings, 1.0)) continue;
      const tex = createPitchTexture(p.type);
      const segX = Math.max(4, Math.ceil(p.width / 4));
      const segZ = Math.max(4, Math.ceil(p.depth / 4));
      const geo = new THREE.PlaneGeometry(p.width, p.depth, segX, segZ);
      geo.rotateX(-Math.PI / 2);
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const wx = p.center[0] + posAttr.getX(i);
        const wz = p.center[1] + posAttr.getZ(i);
        posAttr.setXYZ(i, wx, getTerrainHeight(wx, wz) + 0.18, wz);
      }
      geo.computeVertexNormals();
      const mat = new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      worldGroup.add(mesh);
    }
  }

  // Snowy pine trees with warm holiday lights
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#5c402c' });
  const pineMat = new THREE.MeshLambertMaterial({ color: '#276342' });
  const snowCapMat = new THREE.MeshLambertMaterial({ color: '#f2f7fc' });
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.65, 2.8, 6);
  const coneGeo = new THREE.ConeGeometry(2.3, 4.4, 7);
  const capGeo = new THREE.ConeGeometry(1.5, 1.8, 7);
  for (const [tx, tz] of mapData.trees || []) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.4;
    trunk.castShadow = true;
    const crown = new THREE.Mesh(coneGeo, pineMat);
    crown.position.y = 4.2;
    crown.castShadow = true;
    const cap = new THREE.Mesh(capGeo, snowCapMat);
    cap.position.y = 5.6;
    treeGroup.add(trunk, crown, cap);
    treeGroup.position.set(tx, getTerrainHeight(tx, tz), tz);
    worldGroup.add(treeGroup);
  }

  // Real 영축산 forest on the northern hill + small mapped woods: snowy pines scattered inside the OSM polygons
  {
    const rand = mulberry32(1971);
    const pinePositions = [];
    for (const poly of mapData.woods || []) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of poly) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      // Only populate what is within view distance of the battleground
      minX = Math.max(minX, -520); maxX = Math.min(maxX, 520);
      minZ = Math.max(minZ, -520); maxZ = Math.min(maxZ, 520);
      if (minX >= maxX || minZ >= maxZ) continue;
      const area = (maxX - minX) * (maxZ - minZ);
      const tries = Math.min(900, Math.floor(area / 90));
      for (let i = 0; i < tries; i++) {
        const x = minX + rand() * (maxX - minX);
        const z = minZ + rand() * (maxZ - minZ);
        if (!pointInPoly(x, z, poly)) continue;
        if (nearAnyBuilding(x, z, mapData.buildings, 3)) continue;
        pinePositions.push([x, z, 0.75 + rand() * 0.7, rand() * Math.PI * 2]);
      }
    }
    if (pinePositions.length) {
      const count = pinePositions.length;
      const trunkI = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
      const crownI = new THREE.InstancedMesh(coneGeo, pineMat, count);
      const capI = new THREE.InstancedMesh(capGeo, snowCapMat, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      pinePositions.forEach(([x, z, sc, rot], i) => {
        const y = getTerrainHeight(x, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        s.set(sc, sc, sc);
        m.compose(p.set(x, y + 1.4 * sc, z), q, s);
        trunkI.setMatrixAt(i, m);
        m.compose(p.set(x, y + 4.2 * sc, z), q, s);
        crownI.setMatrixAt(i, m);
        m.compose(p.set(x, y + 5.6 * sc, z), q, s);
        capI.setMatrixAt(i, m);
      });
      crownI.castShadow = true;
      worldGroup.add(trunkI, crownI, capI);
    }
  }

  // Campus perimeter fences (실제 캠퍼스 외곽선 기준 담장 + 철제 펜스, 출입구는 개방)
  const fences = mapData.barriers || [];
  {
    const plinthMat = new THREE.MeshLambertMaterial({ color: '#8b8f96' });
    const railMat = new THREE.MeshLambertMaterial({ color: '#1f2933' });
    const fenceSnowMat = new THREE.MeshLambertMaterial({ color: '#f1f6fb' });
    const wallMat = new THREE.MeshLambertMaterial({ color: '#a7a29a' });
    const postGeo = new THREE.BoxGeometry(0.09, 1.0, 0.09);
    const postSpots = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (const f of fences) {
      const [ax, az] = f.a;
      const [bx, bz] = f.b;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.5) continue;
      const ang = Math.atan2(bz - az, bx - ax);
      const isWall = f.type === 'wall';
      const plinthH = isWall ? 2.1 : 0.65;
      // Smoothly sloped pieces following exact endpoint heights (zero staircase gaps or floating rails)
      const pieces = Math.max(1, Math.ceil(len / 3.5));
      for (let k = 0; k < pieces; k++) {
        const t0 = k / pieces;
        const t1 = (k + 1) / pieces;
        const x0 = ax + (bx - ax) * t0;
        const z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1;
        const z1 = az + (bz - az) * t1;
        const y0 = getTerrainHeight(x0, z0);
        const y1 = getTerrainHeight(x1, z1);
        const mx = (x0 + x1) * 0.5;
        const mz = (z0 + z1) * 0.5;
        const my = (y0 + y1) * 0.5;
        const segHoriz = len / pieces;
        const dy = y1 - y0;
        const slopeLen = Math.hypot(segHoriz, dy) + 0.08;
        const slopePitch = Math.atan2(dy, segHoriz);
        const rot = new THREE.Euler(0, -ang, slopePitch, 'YXZ');
        const v = new THREE.Vector3();
        // Solid plinth extending 1.6m below terrain so downhill side never floats
        const totalPlinthH = plinthH + 1.6;
        batch.add(new THREE.BoxGeometry(slopeLen, totalPlinthH, 0.34), isWall ? wallMat : plinthMat, v.set(mx, my + plinthH - totalPlinthH * 0.5, mz), 0, null, rot);
        batch.add(new THREE.BoxGeometry(slopeLen, 0.08, 0.38), fenceSnowMat, v.set(mx, my + plinthH + 0.04, mz), 0, null, rot);
        if (!isWall) {
          batch.add(new THREE.BoxGeometry(slopeLen, 0.07, 0.07), railMat, v.set(mx, my + plinthH + 0.98, mz), 0, null, rot);
          batch.add(new THREE.BoxGeometry(slopeLen, 0.05, 0.05), railMat, v.set(mx, my + plinthH + 0.45, mz), 0, null, rot);
        }
      }
      if (!isWall) {
        const posts = Math.max(1, Math.floor(len / 0.55));
        for (let k = 0; k <= posts; k++) {
          const t = k / posts;
          postSpots.push([ax + (bx - ax) * t, az + (bz - az) * t, ang]);
        }
      }
    }
    if (postSpots.length) {
      const postsI = new THREE.InstancedMesh(postGeo, railMat, postSpots.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const one = new THREE.Vector3(1, 1, 1);
      const p = new THREE.Vector3();
      postSpots.forEach(([x, z, ang], i) => {
        q.setFromAxisAngle(up, -ang);
        m.compose(p.set(x, getTerrainHeight(x, z) + 1.1, z), q, one);
        postsI.setMatrixAt(i, m);
      });
      worldGroup.add(postsI);
    }
  }

  // Giant Christmas Tree in Kwangwoon Central Plaza
  const twinkleLights = [];
  const garlandBase = ['#ff3b30', '#34c759', '#ffd60a'].map((c) => new THREE.Color(c));
  const garlandMats = garlandBase.map((c) => new THREE.MeshBasicMaterial({ color: c.clone() }));
  const garlandBulbGeo = new THREE.SphereGeometry(0.45, 6, 5);
  const xmasTree = new THREE.Group();
  // sits in the middle of the sunken round plaza
  xmasTree.position.set(PLAZA.x, getTerrainHeight(PLAZA.x, PLAZA.z), PLAZA.z);

  const treeTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.8, 4, 8),
    new THREE.MeshLambertMaterial({ color: '#5b3a24' })
  );
  treeTrunk.position.y = 2;
  xmasTree.add(treeTrunk);

  const tiers = [
    { r: 8.5, h: 10, y: 8 },
    { r: 6.4, h: 8.5, y: 14 },
    { r: 4.2, h: 7, y: 19.5 },
  ];
  tiers.forEach((t) => {
    const tierMesh = new THREE.Mesh(
      new THREE.ConeGeometry(t.r, t.h, 12),
      new THREE.MeshStandardMaterial({ color: '#1f6e3f', emissive: '#0c2b18', roughness: 0.88 })
    );
    tierMesh.position.y = t.y;
    tierMesh.castShadow = true;
    xmasTree.add(tierMesh);
  });

  // Glowing golden star on top
  const starMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.1, 0),
    new THREE.MeshBasicMaterial({ color: '#ffd94a' })
  );
  starMesh.position.y = 24.4;
  xmasTree.add(starMesh);

  // Ornaments & warm plaza light
  const ornamentColors = ['#ff3b30', '#ffd60a', '#34c759', '#ff9f0a', '#ffffff'];
  const ornGeo = new THREE.SphereGeometry(0.55, 8, 8);
  for (let i = 0; i < 28; i++) {
    const tier = tiers[i % 3];
    const angle = (i * 2.39996) % (Math.PI * 2);
    const heightFrac = 0.25 + ((i * 7) % 10) * 0.06;
    const radiusAtY = tier.r * (1 - heightFrac) * 0.92;
    const ornMat = new THREE.MeshBasicMaterial({ color: ornamentColors[i % ornamentColors.length] });
    const orn = new THREE.Mesh(ornGeo, ornMat);
    orn.position.set(
      Math.cos(angle) * radiusAtY,
      tier.y - tier.h / 2 + tier.h * heightFrac,
      Math.sin(angle) * radiusAtY
    );
    xmasTree.add(orn);
    twinkleLights.push({ mesh: orn, phase: i * 0.7 });
  }

  const treeLight = new THREE.PointLight('#ffcf6e', 2.2, 75, 1.5);
  treeLight.position.set(0, 14, 0);
  xmasTree.add(treeLight);
  worldGroup.add(xmasTree);

  // Helper: find an interior point inside a (possibly concave L/U-shaped) polygon with maximum edge clearance
  function distToPolyEdge(x, z, poly) {
    let minD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l2 = dx * dx + dz * dz;
      let t = l2 > 1e-9 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
      if (d < minD) minD = d;
    }
    return minD;
  }

  function findInteriorRoofAnchor(poly, bounds) {
    let bestX = bounds.cx;
    let bestZ = bounds.cz;
    let bestClearance = pointInPoly(bounds.cx, bounds.cz, poly) ? distToPolyEdge(bounds.cx, bounds.cz, poly) : -1;
    const gridN = 7;
    const w = bounds.maxX - bounds.minX;
    const d = bounds.maxZ - bounds.minZ;
    for (let ix = 1; ix < gridN; ix++) {
      const x = bounds.minX + (w * ix) / gridN;
      for (let iz = 1; iz < gridN; iz++) {
        const z = bounds.minZ + (d * iz) / gridN;
        if (!pointInPoly(x, z, poly)) continue;
        const c = distToPolyEdge(x, z, poly);
        if (c > bestClearance) {
          bestClearance = c;
          bestX = x;
          bestZ = z;
        }
      }
    }
    return { x: bestX, z: bestZ, clearance: bestClearance };
  }

  // Buildings (graded pad + visible stone foundation plinth + Roadview-accurate above-ground body)
  labelsLayer.innerHTML = '';
  const facadeCache = new Map();
  const wallMatCache = new Map();
  const roofMatCache = new Map();
  const plinthMatCache = new Map();
  const buildings = [];

  for (const b of mapData.buildings) {
    if (!b.polygon || b.polygon.length < 3) continue;
    const bounds = computePolygonBounds(b.polygon);
    // Leveled pad height (guaranteed by registerBuildingPads so no floor is buried on slopes)
    const padY = b.padY !== undefined ? b.padY : getTerrainHeight(bounds.cx, bounds.cz);
    const minFootY = getFootprintMinHeight(b.polygon);
    // Visible 0.85m stone foundation plinth above padY keeps all 1st-floor windows cleanly above snow
    const VISIBLE_PLINTH = 0.85;
    const plinthBottom = Math.min(minFootY, padY) - 2.6;
    const plinthHeight = Math.max(1.2, padY + VISIBLE_PLINTH - plinthBottom + 0.06);
    const bodyBaseY = padY + VISIBLE_PLINTH;
    const bodyHeight = Math.max(4.0, b.height - VISIBLE_PLINTH);

    const shape = createShapeFromPolygon(b.polygon);

    // 1) Above-ground building body (starts cleanly at padY + 0.85m, zero buried windows)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: bodyHeight,
      bevelEnabled: false,
      UVGenerator: THREE.ExtrudeGeometry.WorldUVGenerator,
    });
    geo.rotateX(-Math.PI / 2);

    // Scale UVs on side walls so 4 texture floors align with ~14m real building height (~3.5m/floor)
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * 0.072, uv.getY(i) * 0.072);
    }

    const texKey = `${b.facadeType || 'ribbon'}_${b.wallColor}`;
    if (!facadeCache.has(texKey)) {
      facadeCache.set(texKey, createBuildingFacadeTexture(b.facadeType || 'ribbon', b.wallColor));
    }

    // Preserve real-world roof colors (Roadview/Skyview + Korean residential waterproof roofs) with subtle winter frost tint
    const roofKey = `${b.roofStyle || ''}_${b.roofColor || '#c8cdd2'}`;
    if (!roofMatCache.has(roofKey)) {
      const baseRoofCol = new THREE.Color(b.roofColor || '#c8cdd2');
      if (b.roofStyle !== 'hwado_pediment' && b.roofStyle !== 'memorial_80' && b.roofStyle !== 'rooftop_turf') {
        baseRoofCol.lerp(new THREE.Color('#eef4fa'), 0.28);
      }
      roofMatCache.set(roofKey, new THREE.MeshStandardMaterial({ color: baseRoofCol, roughness: 0.88, metalness: 0.04 }));
    }
    if (!wallMatCache.has(texKey)) {
      wallMatCache.set(
        texKey,
        new THREE.MeshStandardMaterial({
          map: facadeCache.get(texKey),
          roughness: b.facadeType === 'curtainwall' || b.facadeType === 'saebit_modern' || b.facadeType === 'memorial_80' ? 0.52 : 0.84,
          metalness: b.facadeType === 'curtainwall' || b.facadeType === 'saebit_modern' ? 0.16 : 0.04,
        })
      );
    }
    const roofMat = roofMatCache.get(roofKey);
    const wallMat = wallMatCache.get(texKey);

    const mesh = new THREE.Mesh(geo, [roofMat, wallMat]);
    mesh.position.y = bodyBaseY;
    mesh.castShadow = b.isCampus || bodyHeight >= 16;
    mesh.receiveShadow = true;

    // 2) Foundation plinth / retaining base (기단부) extending solidly below downhill terrain
    const plinthColor = b.plinthColor || '#84888e';
    if (!plinthMatCache.has(plinthColor)) {
      plinthMatCache.set(plinthColor, new THREE.MeshStandardMaterial({ color: plinthColor, roughness: 0.92, metalness: 0.02 }));
    }
    const plinthGeo = new THREE.ExtrudeGeometry(shape, {
      depth: plinthHeight,
      bevelEnabled: false,
    });
    plinthGeo.rotateX(-Math.PI / 2);
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMatCache.get(plinthColor));
    plinthMesh.position.y = -plinthHeight + 0.06;
    plinthMesh.castShadow = b.isCampus;
    plinthMesh.receiveShadow = true;
    mesh.add(plinthMesh);

    if (b.isCampus || bodyHeight >= 22) {
      const edgesGeo = new THREE.EdgesGeometry(geo, 24);
      const edges = new THREE.LineSegments(edgesGeo, edgeMat);
      mesh.add(edges);
    }

    // Add realistic Roadview/Skyview rooftop details strictly anchored INSIDE the polygon (never overhanging!)
    const anchor = findInteriorRoofAnchor(b.polygon, bounds);
    const safeSpan = Math.max(0, anchor.clearance * 1.45);
    if (b.roofStyle === 'hwado_pediment') {
      // 화도관: polygon-fitted terracotta-brown roof parapet cap + compact grey penthouse strictly inside footprint
      const capGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.85, bevelEnabled: false });
      capGeo.rotateX(-Math.PI / 2);
      const capMat = new THREE.MeshStandardMaterial({ color: '#723c31', roughness: 0.84 });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.y = bodyHeight;
      capMesh.castShadow = true;
      mesh.add(capMesh);

      if (safeSpan >= 5) {
        const pSize = Math.min(7.0, safeSpan * 0.75);
        const pentGeo = new THREE.BoxGeometry(pSize, 2.4, pSize * 0.85);
        const pentMat = new THREE.MeshStandardMaterial({ color: '#a5aab0', roughness: 0.85 });
        const pent = new THREE.Mesh(pentGeo, pentMat);
        pent.position.set(anchor.x, bodyHeight + 2.0, anchor.z);
        pent.castShadow = true;
        mesh.add(pent);
      }
    } else if (b.roofStyle === 'memorial_80') {
      // 80주년 기념관: compact glass skylight strictly inside the charcoal roof
      if (safeSpan >= 5) {
        const sSize = Math.min(10, safeSpan * 0.75);
        const skyGeo = new THREE.BoxGeometry(sSize, 1.3, sSize * 0.8);
        const skyMat = new THREE.MeshStandardMaterial({ color: '#587d9c', roughness: 0.35, metalness: 0.2 });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        sky.position.set(anchor.x, bodyHeight + 0.65, anchor.z);
        sky.castShadow = true;
        mesh.add(sky);
      }
    } else if (b.roofStyle === 'solar_roof') {
      // 새빛관: angled rooftop solar arrays placed strictly inside roof polygon
      const solarMat = new THREE.MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.3, metalness: 0.35 });
      const pW = 3.2;
      const pD = 2.1;
      for (let px = bounds.minX + 3; px < bounds.maxX - 3; px += 3.8) {
        for (let pz = bounds.minZ + 3; pz < bounds.maxZ - 3; pz += 3.0) {
          if (!pointInPoly(px, pz, b.polygon) || distToPolyEdge(px, pz, b.polygon) < 2.2) continue;
          const panel = new THREE.Mesh(new THREE.BoxGeometry(pW, 0.1, pD), solarMat);
          panel.position.set(px, bodyHeight + 0.75, pz);
          panel.rotation.x = -0.32;
          mesh.add(panel);
        }
      }
    } else if (b.roofStyle === 'green_terrace') {
      // 참빛관: planted green rooftop terrace strictly inside roof polygon
      if (safeSpan >= 5) {
        const tSize = Math.min(12, safeSpan * 0.85);
        const terrace = new THREE.Mesh(
          new THREE.BoxGeometry(tSize, 0.32, tSize * 0.75),
          new THREE.MeshStandardMaterial({ color: '#5f8f6b', roughness: 0.9 })
        );
        terrace.position.set(anchor.x, bodyHeight + 0.16, anchor.z);
        mesh.add(terrace);
      }
    } else if (b.roofStyle === 'rooftop_turf') {
      // 동해문화예술관: bright green rooftop sports turf strictly inside roof polygon
      if (safeSpan >= 8) {
        const courtTex = createPitchTexture('soccer');
        const cSize = Math.min(18, safeSpan * 0.92);
        const court = new THREE.Mesh(
          new THREE.PlaneGeometry(cSize, cSize * 0.68),
          new THREE.MeshLambertMaterial({ map: courtTex })
        );
        court.rotation.x = -Math.PI / 2;
        court.position.set(anchor.x, bodyHeight + 0.12, anchor.z);
        mesh.add(court);
      }
    } else if (safeSpan >= 6.5) {
      const pentW = Math.min(7.5, safeSpan * 0.62);
      const pentD = Math.min(6.5, safeSpan * 0.55);
      const pentH = b.isCampus ? 2.2 : 1.7;
      const pentGeo = new THREE.BoxGeometry(pentW, pentH, pentD);
      const pentMat = new THREE.MeshStandardMaterial({ color: '#8e959c', roughness: 0.85 });
      const pentMesh = new THREE.Mesh(pentGeo, pentMat);
      pentMesh.position.set(anchor.x, bodyHeight + pentH / 2, anchor.z);
      pentMesh.castShadow = true;
      pentMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(pentGeo), edgeMat));
      mesh.add(pentMesh);
    }

    // Subtle Christmas roof-edge light garlands on key campus buildings (resting cleanly on parapet)
    if (b.isCampus && b.polygon.length >= 3) {
      for (let i = 0; i < b.polygon.length - 1; i++) {
        const [x1, z1] = b.polygon[i];
        const [x2, z2] = b.polygon[i + 1];
        const segLen = Math.hypot(x2 - x1, z2 - z1);
        const steps = Math.max(1, Math.floor(segLen / 10));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const bx = x1 + (x2 - x1) * t;
          const bz = z1 + (z2 - z1) * t;
          batch.add(garlandBulbGeo, garlandMats[(i + s) % garlandMats.length], new THREE.Vector3(bx, bodyBaseY + bodyHeight + 0.3, bz));
        }
      }
    }

    worldGroup.add(mesh);
    let labelEl = null;
    if (b.name) {
      labelEl = document.createElement('div');
      labelEl.className = 'building-label';
      labelEl.textContent = b.name;
      labelsLayer.appendChild(labelEl);
    }

    const maxHp = b.isCampus ? Math.round(b.height * 4.5) : Math.round(b.height * 2.5);
    const record = {
      id: b.id,
      name: b.name,
      isCampus: b.isCampus,
      height: bodyHeight + VISIBLE_PLINTH,
      baseY: padY,
      bodyBaseY,
      plinthBottom,
      polygon: b.polygon,
      bounds,
      mesh,
      maxHp,
      hp: maxHp,
      destroyed: false,
      collapseProgress: 0,
      labelEl,
    };
    mesh.userData.building = record;
    buildings.push(record);
  }

  const projVec = new THREE.Vector3();

  function updateLabels(camera, width, height, isFirstPerson) {
    for (const b of buildings) {
      if (!b.labelEl) continue;
      projVec.set(b.bounds.cx, b.baseY + b.height + 6.0, b.bounds.cz);
      const dist = camera.position.distanceTo(projVec);
      projVec.project(camera);

      const isBehind = projVec.z > 1;
      const tooFar = isFirstPerson && dist > 160;
      if (isBehind || tooFar) {
        b.labelEl.style.display = 'none';
        continue;
      }

      const x = (projVec.x * 0.5 + 0.5) * width;
      const y = (-projVec.y * 0.5 + 0.5) * height;
      b.labelEl.style.display = 'block';
      b.labelEl.style.left = `${x}px`;
      b.labelEl.style.top = `${y}px`;
      b.labelEl.classList.toggle('destroyed', b.destroyed);
    }
  }

  function resetAll() {
    for (const b of buildings) {
      b.hp = b.maxHp;
      b.destroyed = false;
      b.collapseProgress = 0;
      b.mesh.scale.set(1, 1, 1);
      b.mesh.position.set(0, b.baseY, 0);
      b.mesh.rotation.set(0, 0, 0);
      b.mesh.visible = true;
    }
  }

  const landscape = buildCampusFeatures(worldGroup, batch, buildings, mapData.campusOutlines);
  covers.push(...landscape.extraCovers);

  batch.flush(worldGroup);

  function animateFestive(time) {
    starMesh.rotation.y = time * 1.1;
    for (const item of twinkleLights) {
      const s = 0.75 + 0.45 * Math.sin(time * 3.5 + item.phase);
      item.mesh.scale.setScalar(s);
    }
    garlandMats.forEach((m, i) => {
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(time * 3.2 + i * 2.1));
      m.color.copy(garlandBase[i]).multiplyScalar(k);
    });
  }

  return {
    worldGroup,
    ground,
    buildings,
    covers,
    fences: fences.concat(landscape.extraWalls),
    updateLabels,
    resetAll,
    animateFestive,
  };
}
