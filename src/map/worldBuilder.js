import * as THREE from 'three';
import { createBuildingFacadeTexture, createPitchTexture } from './textures.js';
import { getTerrainHeight } from './terrain.js';

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
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Snowy winter hilly terrain plane
  const groundGeo = new THREE.PlaneGeometry(1600, 1600, 110, 110);
  groundGeo.rotateX(-Math.PI / 2);
  const gPos = groundGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) {
    const vx = gPos.getX(i);
    const vz = gPos.getZ(i);
    gPos.setY(i, getTerrainHeight(vx, vz));
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({ color: '#d8e4f0' });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  worldGroup.add(ground);

  // Snowy grass & plazas (placed on terrain)
  for (const g of mapData.grasses || []) {
    if (g.polygon.length < 3) continue;
    const shape = createShapeFromPolygon(g.polygon);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const gp = geo.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      gp.setY(i, getTerrainHeight(gp.getX(i), gp.getZ(i)) + 0.08);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: '#a8cab8' });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
  }

  // Winter roads hugging the hill terrain
  const roadMat = new THREE.MeshLambertMaterial({ color: '#353e4a', side: THREE.DoubleSide });
  for (const road of mapData.roads || []) {
    const pts = road.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) continue;

      const subSteps = Math.max(1, Math.ceil(len / 8));
      const nx = (-dz / len) * (road.width * 0.5);
      const nz = (dx / len) * (road.width * 0.5);
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
        verts.push(lx, getTerrainHeight(lx, lz) + 0.14, lz);
        verts.push(rx, getTerrainHeight(rx, rz) + 0.14, rz);
        if (s < subSteps) {
          const base = s * 2;
          indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const seg = new THREE.Mesh(geo, roadMat);
      seg.receiveShadow = true;
      worldGroup.add(seg);
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

    worldGroup.add(grp);

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
  const lampCoords = [[2, -26], [36, -26], [4, 24], [38, 22], [-18, 4]];
  for (const [lx, lz] of lampCoords) {
    const ly = getTerrainHeight(lx, lz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 5.2, 8), lampPostMat);
    pole.position.set(lx, ly + 2.6, lz);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), lampGlowMat);
    bulb.position.set(lx, ly + 5.3, lz);
    worldGroup.add(pole, bulb);
  }
  for (const p of mapData.pitches || []) {
    const tex = createPitchTexture(p.type);
    const geo = new THREE.PlaneGeometry(p.width, p.depth);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = p.rotation || 0;
    mesh.position.set(p.center[0], getTerrainHeight(p.center[0], p.center[1]) + 0.16, p.center[1]);
    mesh.receiveShadow = true;
    worldGroup.add(mesh);
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

  // Giant Christmas Tree in Kwangwoon Central Plaza
  const twinkleLights = [];
  const xmasTree = new THREE.Group();
  xmasTree.position.set(24, getTerrainHeight(24, -10), -10);

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
      new THREE.ConeGeometry(t.r, t.h, 10),
      new THREE.MeshLambertMaterial({ color: '#1f6e3f' })
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

  // Buildings
  labelsLayer.innerHTML = '';
  const facadeCache = new Map();
  const buildings = [];

  for (const b of mapData.buildings) {
    if (!b.polygon || b.polygon.length < 3) continue;
    const bounds = computePolygonBounds(b.polygon);
    const baseY = getTerrainHeight(bounds.cx, bounds.cz) - 2.5;
    const totalHeight = b.height + 2.5;

    const shape = createShapeFromPolygon(b.polygon);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: totalHeight,
      bevelEnabled: false,
      UVGenerator: THREE.ExtrudeGeometry.WorldUVGenerator,
    });
    geo.rotateX(-Math.PI / 2);

    // Scale UVs on side walls for crisp repeating windows
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * 0.08, uv.getY(i) * 0.08);
    }

    const texKey = `${b.facadeType || 'ribbon'}_${b.wallColor}`;
    if (!facadeCache.has(texKey)) {
      facadeCache.set(texKey, createBuildingFacadeTexture(b.facadeType || 'ribbon', b.wallColor));
    }
    // Snowy winter roofs on buildings
    const winterRoofColor = b.roofStyle === 'terrace_green' ? '#b8dec2' : '#edf3f9';
    const roofMat = new THREE.MeshLambertMaterial({ color: winterRoofColor });
    const wallMat = new THREE.MeshLambertMaterial({ map: facadeCache.get(texKey) });

    const mesh = new THREE.Mesh(geo, [roofMat, wallMat]);
    mesh.position.y = baseY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edgesGeo = new THREE.EdgesGeometry(geo, 22);
    const edges = new THREE.LineSegments(edgesGeo, edgeMat);
    mesh.add(edges);

    // Add realistic rooftop details by building style
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    if (b.roofStyle === 'clocktower') {
      // 화도관 central clocktower / pediment accent
      const towerGeo = new THREE.BoxGeometry(8, 5.5, 8);
      const towerMat = new THREE.MeshLambertMaterial({ color: '#dfd7ca' });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(bounds.cx, totalHeight + 2.75, bounds.cz);
      tower.castShadow = true;
      tower.add(new THREE.LineSegments(new THREE.EdgesGeometry(towerGeo), edgeMat));
      mesh.add(tower);

      const capGeo = new THREE.BoxGeometry(9, 1.2, 9);
      const capMat = new THREE.MeshLambertMaterial({ color: '#7a352b' });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(bounds.cx, totalHeight + 6.1, bounds.cz);
      cap.add(new THREE.LineSegments(new THREE.EdgesGeometry(capGeo), edgeMat));
      mesh.add(cap);
    } else if (b.roofStyle === 'terrace_green') {
      // 80주년 기념관 compact centered glass skylight pavilion on its green roof (never overhangs diagonal footprint)
      const skyW = Math.min(14, spanX * 0.28);
      const skyD = Math.min(14, spanZ * 0.28);
      const skyGeo = new THREE.BoxGeometry(skyW, 2.2, skyD);
      const skyMat = new THREE.MeshLambertMaterial({ color: '#5f94b8' });
      const sky = new THREE.Mesh(skyGeo, skyMat);
      sky.position.set(bounds.cx, totalHeight + 1.1, bounds.cz);
      sky.castShadow = true;
      sky.add(new THREE.LineSegments(new THREE.EdgesGeometry(skyGeo), edgeMat));
      mesh.add(sky);
    } else if (spanX > 10 && spanZ > 10) {
      const pentW = Math.min(8, spanX * 0.25);
      const pentD = Math.min(7, spanZ * 0.25);
      const pentH = b.isCampus ? 2.6 : 2.0;
      const pentGeo = new THREE.BoxGeometry(pentW, pentH, pentD);
      const pentMat = new THREE.MeshLambertMaterial({ color: '#8e959c' });
      const pentMesh = new THREE.Mesh(pentGeo, pentMat);
      pentMesh.position.set(bounds.cx, totalHeight + pentH / 2, bounds.cz);
      pentMesh.castShadow = true;
      pentMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(pentGeo), edgeMat));
      mesh.add(pentMesh);
    }

    // Add Christmas roof light garlands & glowing plaza wreaths on key campus buildings
    if (b.isCampus && b.polygon.length >= 3) {
      const garlandColors = ['#ff3b30', '#34c759', '#ffd60a'];
      const bulbGeo = new THREE.SphereGeometry(0.45, 6, 6);
      for (let i = 0; i < b.polygon.length - 1; i++) {
        const [x1, z1] = b.polygon[i];
        const [x2, z2] = b.polygon[i + 1];
        const segLen = Math.hypot(x2 - x1, z2 - z1);
        const steps = Math.max(1, Math.floor(segLen / 10));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const bx = x1 + (x2 - x1) * t;
          const bz = z1 + (z2 - z1) * t;
          const bulb = new THREE.Mesh(
            bulbGeo,
            new THREE.MeshBasicMaterial({ color: garlandColors[(i + s) % garlandColors.length] })
          );
          bulb.position.set(bx, totalHeight + 0.45, bz);
          mesh.add(bulb);
          twinkleLights.push({ mesh: bulb, phase: (i + s) * 0.9 });
        }
      }

      // Main plaza buildings get a large glowing Christmas wreath + star above!
      if (['비마관', '화도관', '80주년 기념관', '복지관', '다산재'].includes(b.name)) {
        const wreath = new THREE.Mesh(
          new THREE.TorusGeometry(2.6, 0.55, 8, 18),
          new THREE.MeshLambertMaterial({ color: '#15803d' })
        );
        wreath.position.set(bounds.cx, totalHeight + 3.2, bounds.cz);
        const ribbon = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.4, 1.4),
          new THREE.MeshBasicMaterial({ color: '#ef4444' })
        );
        ribbon.position.set(bounds.cx, totalHeight + 0.8, bounds.cz);
        mesh.add(wreath, ribbon);
        twinkleLights.push({ mesh: ribbon, phase: 0.5 });
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
      height: b.height,
      baseY,
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

  function animateFestive(time) {
    starMesh.rotation.y = time * 1.1;
    for (const item of twinkleLights) {
      const s = 0.75 + 0.45 * Math.sin(time * 3.5 + item.phase);
      item.mesh.scale.setScalar(s);
    }
  }

  return {
    worldGroup,
    ground,
    buildings,
    covers,
    updateLabels,
    resetAll,
    animateFestive,
  };
}
