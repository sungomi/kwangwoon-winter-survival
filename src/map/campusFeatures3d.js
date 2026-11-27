import * as THREE from 'three';
import { getTerrainHeight, getNaturalHeight, PLAZA_LEVEL, STAIR_FLIGHTS } from './terrain.js';
import { placeGates } from './gates.js';
import { PLAZA, TERRACES, LIBRARY_LAWN, LIBRARY, ENTRANCES } from '../data/campusFeatures.js';

/**
 * Builds the hand-traced campus landscape: round stepped plaza, staircases, terraced planters,
 * the 80주년기념관(중앙도서관) details, real gates and building entrances.
 * Static meshes go through the shared batcher; returns extra collision (walls + cover).
 */

const M = {
  granite: new THREE.MeshLambertMaterial({ color: '#b9b7b2' }),
  graniteDark: new THREE.MeshLambertMaterial({ color: '#8f8c86' }),
  paving: new THREE.MeshLambertMaterial({ color: '#cfd2d6', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  pavingWarm: new THREE.MeshLambertMaterial({ color: '#c7b8a6', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  snow: new THREE.MeshLambertMaterial({ color: '#eef3f8' }),
  rail: new THREE.MeshLambertMaterial({ color: '#2a3138' }),
  soil: new THREE.MeshLambertMaterial({ color: '#e4ebf1' }),
  shrub: new THREE.MeshLambertMaterial({ color: '#3f6b4c' }),
  glass: new THREE.MeshLambertMaterial({ color: '#5f96b8', transparent: true, opacity: 0.78 }),
  atriumBack: new THREE.MeshLambertMaterial({ color: '#1b2836' }),
  frame: new THREE.MeshLambertMaterial({ color: '#3b434c' }),
  solar: new THREE.MeshLambertMaterial({ color: '#1e3a5f' }),
  solarFrame: new THREE.MeshLambertMaterial({ color: '#9aa3ad' }),
  lawn: new THREE.MeshLambertMaterial({ color: '#9fc0ab', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  path: new THREE.MeshLambertMaterial({ color: '#d9d4cb', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  gateStone: new THREE.MeshLambertMaterial({ color: '#9c968d' }),
  booth: new THREE.MeshLambertMaterial({ color: '#e5e1da' }),
};

/** Clean flat-faced extruded triangular pediment (no pinched cone creases). */
function createPedimentGeometry(width, height, depth) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(0, height);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function signTexture(title, sub, { bg = '#14213d', fg = '#ffffff', subFg = null, accent = '#fbbf24', w = 1024, h = 256 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(0, h - 14, w, 14);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  // Auto-scale title font so long English/Korean titles NEVER clip at the edges
  let titleSize = Math.round(h * 0.40);
  ctx.font = `900 ${titleSize}px "Noto Sans KR", sans-serif`;
  while (titleSize > 28 && ctx.measureText(title).width > w * 0.88) {
    titleSize -= 4;
    ctx.font = `900 ${titleSize}px "Noto Sans KR", sans-serif`;
  }
  ctx.fillText(title, w / 2, h * 0.50);
  if (sub) {
    let subSize = Math.round(h * 0.16);
    ctx.font = `700 ${subSize}px "Noto Sans KR", sans-serif`;
    while (subSize > 16 && ctx.measureText(sub).width > w * 0.88) {
      subSize -= 2;
      ctx.font = `700 ${subSize}px "Noto Sans KR", sans-serif`;
    }
    ctx.fillStyle = subFg || (fg === '#ffffff' ? '#cbd5e1' : '#334155');
    ctx.fillText(sub, w / 2, h * 0.78);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signMesh(width, height, tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex }));
  return m;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildCampusFeatures(worldGroup, batch, buildings, outlines) {
  const extraWalls = []; // collision segments {a,b,type}
  const extraCovers = []; // AABB covers

  /* ------------------------------ round plaza ------------------------------ */
  {
    const { x, z, radius, rings, ringStep } = PLAZA;
    const top = PLAZA_LEVEL;
    // outer paving annulus (lifted cleanly above terrain mesh triangles)
    const outer = new THREE.RingGeometry(rings[rings.length - 1], radius + 0.2, 64, 1);
    outer.rotateX(-Math.PI / 2);
    batch.add(outer, M.paving, V(x, top + 0.08, z));
    // decorative granite bands on the outer paving
    for (const r of [17.5, radius - 0.35]) {
      const band = new THREE.RingGeometry(r - 0.35, r, 64, 1);
      band.rotateX(-Math.PI / 2);
      batch.add(band, M.graniteDark, V(x, top + 0.09, z));
    }
    // sunken ring steps (each ring: tread annulus + vertical riser)
    for (let i = rings.length - 1; i >= 0; i--) {
      const level = top - (rings.length - i) * ringStep;
      const inner = i > 0 ? rings[i - 1] : 0;
      const tread = inner > 0 ? new THREE.RingGeometry(inner, rings[i], 64, 1) : new THREE.CircleGeometry(rings[i], 64);
      tread.rotateX(-Math.PI / 2);
      batch.add(tread, i % 2 === 0 ? M.pavingWarm : M.paving, V(x, level + 0.08, z));
      const riser = new THREE.CylinderGeometry(rings[i], rings[i], ringStep + 0.04, 64, 1, true);
      batch.add(riser, M.granite, V(x, level + ringStep / 2 + 0.06, z));
      // snow line on each step nosing
      const nose = new THREE.RingGeometry(rings[i] - 0.12, rings[i], 64, 1);
      nose.rotateX(-Math.PI / 2);
      batch.add(nose, M.snow, V(x, level + ringStep + 0.09, z));
    }

    // Continuous perimeter granite curb + retaining wall (deeply rooted) + parapet railing
    const stairAngles = STAIR_FLIGHTS.filter((f) => f.toPlaza).map((f) => ({
      ang: Math.atan2(f.bz - z, f.bx - x),
      half: Math.atan2(f.width / 2 + 0.8, radius),
    }));
    const segs = 96;
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2;
      const a1 = ((k + 1) / segs) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const ex = x + Math.cos(am) * (radius + 0.25);
      const ez = z + Math.sin(am) * (radius + 0.25);
      const ground = getNaturalHeight(ex, ez);
      const drop = top - ground;
      const inStair = stairAngles.some((s) => Math.abs(Math.atan2(Math.sin(am - s.ang), Math.cos(am - s.ang))) < s.half);
      const p0 = [x + Math.cos(a0) * (radius + 0.25), z + Math.sin(a0) * (radius + 0.25)];
      const p1 = [x + Math.cos(a1) * (radius + 0.25), z + Math.sin(a1) * (radius + 0.25)];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.08;
      // Solid retaining skirt all around the plaza extending 2.4m underground
      const skirtH = Math.max(0.6, drop) + 2.4;
      batch.add(new THREE.BoxGeometry(len, skirtH, 0.55), M.granite, V(ex, top + 0.08 - skirtH / 2, ez), -am + Math.PI / 2);
      if (!inStair) {
        // Continuous granite curb all around the plaza rim
        batch.add(new THREE.BoxGeometry(len, 0.36, 0.46), M.graniteDark, V(ex, top + 0.24, ez), -am + Math.PI / 2);
        if (drop > 0.45) {
          batch.add(new THREE.BoxGeometry(len, 0.06, 0.08), M.rail, V(ex, top + 1.05, ez), -am + Math.PI / 2);
          batch.add(new THREE.BoxGeometry(len, 0.04, 0.06), M.rail, V(ex, top + 0.72, ez), -am + Math.PI / 2);
          if (k % 2 === 0) batch.add(new THREE.BoxGeometry(0.06, 0.68, 0.06), M.rail, V(ex, top + 0.74, ez));
          extraWalls.push({ type: 'invisible', a: p0, b: p1 });
        }
      }
    }
  }

  /* ------------------------------ staircases ------------------------------ */
  for (const f of STAIR_FLIGHTS) {
    const ang = Math.atan2(f.uz, f.ux);
    const run = f.len / f.steps;
    const low = Math.min(f.hA, f.hB);
    const goingUp = f.hB >= f.hA;
    const slopePitch = Math.atan2(f.hB - f.hA, f.len);
    const slopeLen = Math.hypot(f.len, f.hB - f.hA);
    const railRot = new THREE.Euler(0, -ang, slopePitch, 'YXZ');

    for (let k = 0; k <= f.steps; k++) {
      const t = k / f.steps;
      const h = f.hA + (f.hB - f.hA) * t + 0.08;
      const cx = f.ax + f.ux * f.len * t;
      const cz = f.az + f.uz * f.len * t;
      // Solid monolithic riser rooted 2.2m below low end so treads NEVER float or clip
      const bottomY = low - 2.2;
      const height = Math.max(0.4, h - bottomY);
      const depth = run * 1.18;
      batch.add(new THREE.BoxGeometry(depth, height, f.width), M.granite, V(cx, bottomY + height / 2, cz), -ang);
      batch.add(new THREE.BoxGeometry(depth * 0.92, 0.04, f.width - 0.14), M.snow, V(cx, h + 0.02, cz), -ang);
      batch.add(
        new THREE.BoxGeometry(0.09, 0.03, f.width - 0.12),
        M.graniteDark,
        V(cx + f.ux * depth * 0.42 * (goingUp ? -1 : 1), h + 0.045, cz + f.uz * depth * 0.42 * (goingUp ? -1 : 1)),
        -ang
      );
    }
    // Continuous sloped cheek walls + handrails on both sides
    const midX = (f.ax + f.bx) * 0.5;
    const midZ = (f.az + f.bz) * 0.5;
    const midH = (f.hA + f.hB) * 0.5 + 0.08;
    for (const side of [-1, 1]) {
      const ox = -f.uz * side * (f.width / 2 + 0.24);
      const oz = f.ux * side * (f.width / 2 + 0.24);
      // Continuous sloped granite stringer/cheek wall
      batch.add(new THREE.BoxGeometry(slopeLen + 0.4, 2.8, 0.45), M.graniteDark, V(midX + ox, midH - 0.85, midZ + oz), 0, null, railRot);
      // Continuous sloped handrail
      batch.add(new THREE.BoxGeometry(slopeLen + 0.3, 0.07, 0.08), M.rail, V(midX + ox, midH + 1.05, midZ + oz), 0, null, railRot);
      const postCount = Math.max(2, Math.ceil(f.len / 2.2));
      for (let k = 0; k <= postCount; k++) {
        const t = k / postCount;
        const h = f.hA + (f.hB - f.hA) * t + 0.08;
        batch.add(new THREE.BoxGeometry(0.06, 0.55, 0.06), M.rail, V(f.ax + f.ux * f.len * t + ox, h + 0.78, f.az + f.uz * f.len * t + oz));
      }
      extraWalls.push({ type: 'invisible', a: [f.ax + ox, f.az + oz], b: [f.bx + ox, f.bz + oz] });
    }
    // Continuous sloped middle handrail for wide flights
    if (f.width > 7.5) {
      batch.add(new THREE.BoxGeometry(slopeLen + 0.2, 0.06, 0.08), M.rail, V(midX, midH + 1.0, midZ), 0, null, railRot);
      const postCount = Math.max(2, Math.ceil(f.len / 2.5));
      for (let k = 0; k <= postCount; k++) {
        const t = k / postCount;
        const h = f.hA + (f.hB - f.hA) * t + 0.08;
        batch.add(new THREE.BoxGeometry(0.06, 1.0, 0.06), M.rail, V(f.ax + f.ux * f.len * t, h + 0.5, f.az + f.uz * f.len * t));
      }
    }
  }

  /* ------------------------------ terraced planters ------------------------------ */
  for (const t of TERRACES) {
    const cs = Math.cos(t.rot);
    const sn = Math.sin(t.rot);
    // Find lowest terrain among all 4 rotated corners so downhill corners NEVER float
    let minCornerY = getTerrainHeight(t.x, t.z);
    let maxCornerY = minCornerY;
    for (const sx of [-0.5, 0.5]) {
      for (const sz of [-0.5, 0.5]) {
        const wx = t.x + sx * t.w * cs - sz * t.d * sn;
        const wz = t.z + sx * t.w * sn + sz * t.d * cs;
        const ch = getTerrainHeight(wx, wz);
        if (ch < minCornerY) minCornerY = ch;
        if (ch > maxCornerY) maxCornerY = ch;
      }
    }
    const topY = maxCornerY + t.h;
    const baseBottom = minCornerY - 1.6;
    const fullH = topY - baseBottom;
    const grp = new THREE.Group();
    grp.position.set(t.x, baseBottom, t.z);
    grp.rotation.y = t.rot;
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(t.w, fullH, t.d), M.granite).translateY(fullH / 2));
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(t.w - 0.5, 0.1, t.d - 0.5), M.soil).translateY(fullH + 0.02));
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.12, 0.08, t.d + 0.12), M.snow).translateY(fullH - 0.03));
    for (let i = 0; i < Math.floor(t.w / 2.2); i++) {
      const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), M.shrub);
      shrub.position.set(-t.w / 2 + 1.2 + i * 2.2, fullH + 0.35, (i % 2 ? 0.8 : -0.8));
      shrub.scale.y = 0.75;
      grp.add(shrub);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), M.snow);
      cap.position.copy(shrub.position).add(V(0, 0.28, 0));
      cap.scale.y = 0.4;
      grp.add(cap);
    }
    grp.updateMatrixWorld(true);
    grp.traverse((o) => o.isMesh && batch.addMesh(o));
    const half = Math.max(t.w, t.d) * 0.5;
    const acs = Math.abs(cs);
    const asn = Math.abs(sn);
    const hx = (t.w / 2) * acs + (t.d / 2) * asn;
    const hz = (t.w / 2) * asn + (t.d / 2) * acs;
    extraCovers.push({ x: t.x, z: t.z, topY, minX: t.x - hx, maxX: t.x + hx, minZ: t.z - hz, maxZ: t.z + hz, half });
  }

  /* ------------------------------ 80주년기념관 · 중앙도서관 ------------------------------ */
  const library = buildings.find((b) => b.name === LIBRARY.name);
  if (library) {
    const roofY = library.baseY + library.height;
    const poly = library.polygon;
    const { minX, maxX, minZ, maxZ } = library.bounds;
    const inside = (px, pz) => {
      let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i];
        const [xj, zj] = poly[j];
        if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-9) + xi) ins = !ins;
      }
      return ins;
    };
    // Solar array along the west half of the charcoal roof (matching Skyview)
    const panelGeo = new THREE.BoxGeometry(1.9, 0.08, 1.1);
    const tilt = new THREE.Euler(-0.32, 0, 0);
    const westSplit = minX + (maxX - minX) * 0.52;
    for (let px = minX + 2.5; px < westSplit; px += 2.4) {
      for (let pz = minZ + 2.5; pz < maxZ - 2.5; pz += 2.1) {
        if (!inside(px - 1.2, pz - 1) || !inside(px + 1.2, pz + 1) || !inside(px - 1.2, pz + 1) || !inside(px + 1.2, pz - 1)) continue;
        batch.add(panelGeo, M.solar, V(px, roofY + 0.55, pz), 0, null, tilt);
        batch.add(new THREE.BoxGeometry(0.08, 0.5, 0.08), M.solarFrame, V(px, roofY + 0.25, pz + 0.3));
      }
    }
    // Entrance pavilion on the facade facing 광운스퀘어 (solid plinth + forecourt + gridded glass + white column)
    const edge = nearestEdge(poly, PLAZA.x, PLAZA.z);
    if (edge) {
      const { mx, mz, nx, nz, ang } = edge;
      const gy = Math.max(library.baseY, getTerrainHeight(mx + nx * 2.5, mz + nz * 2.5));
      const ex = mx + nx * 2.2;
      const ez = mz + nz * 2.2;
      const tx = Math.cos(ang);
      const tz = Math.sin(ang);
      // Solid granite foundation plinth & paved forecourt apron extending 2.5m underground
      batch.add(new THREE.BoxGeometry(19.0, 2.6, 8.0), M.granite, V(ex + nx * 1.0, gy - 1.25, ez + nz * 1.0), -ang);
      // Dark interior backing behind glass so building facade doesn't clash awkwardly
      batch.add(new THREE.BoxGeometry(15.6, 5.1, 3.8), M.atriumBack, V(ex - nx * 0.2, gy + 2.55, ez - nz * 0.2), -ang);
      batch.add(new THREE.BoxGeometry(16, 5.2, 4.4), M.glass, V(ex, gy + 2.6, ez), -ang);
      for (let i = -4; i <= 4; i++) {
        batch.add(new THREE.BoxGeometry(0.14, 5.2, 0.14), M.frame, V(ex + tx * i * 2 + nx * 2.2, gy + 2.6, ez + tz * i * 2 + nz * 2.2));
      }
      // Signature white cylindrical support column & cantilevered fascia
      batch.add(new THREE.CylinderGeometry(0.45, 0.45, 5.4, 14), M.booth, V(ex + tx * 8.4 + nx * 2.6, gy + 2.7, ez + tz * 8.4 + nz * 2.6));
      batch.add(new THREE.BoxGeometry(18.5, 0.75, 6.6), M.granite, V(ex + nx * 1.1, gy + 5.6, ez + nz * 1.1), -ang);
      batch.add(new THREE.BoxGeometry(18.5, 0.08, 6.6), M.snow, V(ex + nx * 1.1, gy + 6.02, ez + nz * 1.1), -ang);
      const sign = signMesh(13.5, 1.9, signTexture('KWANGWOON UNIVERSITY', '80주년기념관 · 중앙도서관 CENTRAL LIBRARY', { bg: '#27313d', accent: '#cbd5e1' }));
      sign.position.set(ex + nx * 4.45, gy + 6.9, ez + nz * 4.45);
      sign.rotation.y = Math.atan2(nx, nz);
      worldGroup.add(sign);
      // Wide granite steps down from the forecourt
      for (let s = 0; s < 3; s++) {
        batch.add(
          new THREE.BoxGeometry(14.0, 0.2 * (3 - s) + 1.0, 0.7),
          M.graniteDark,
          V(ex + nx * (4.9 + s * 0.7), gy - 0.5 + 0.1 * (3 - s), ez + nz * (4.9 + s * 0.7)),
          -ang
        );
      }
      // Full 3-sided collision for the entrance pavilion so players cannot walk through its sides
      const fl = [ex - tx * 8.1 + nx * 2.3, ez - tz * 8.1 + nz * 2.3];
      const fr = [ex + tx * 8.1 + nx * 2.3, ez + tz * 8.1 + nz * 2.3];
      const bl = [ex - tx * 8.1 - nx * 2.1, ez - tz * 8.1 - nz * 2.1];
      const br = [ex + tx * 8.1 - nx * 2.1, ez + tz * 8.1 - nz * 2.1];
      extraWalls.push({ type: 'invisible', a: fl, b: fr });
      extraWalls.push({ type: 'invisible', a: bl, b: fl });
      extraWalls.push({ type: 'invisible', a: br, b: fr });
    }
  }

  /* ------------------------------ 화도관 (South Facade Pediment & Atrium) ------------------------------ */
  const hwado = buildings.find((b) => b.name === '화도관');
  if (hwado) {
    // South-facing facade toward the central plaza/lawn
    const edge = nearestEdge(hwado.polygon, PLAZA.x, PLAZA.z);
    if (edge) {
      const { mx, mz, nx, nz, ang } = edge;
      const gy = hwado.baseY;
      const tx = Math.cos(ang);
      const tz = Math.sin(ang);
      const ax = mx + nx * 1.2;
      const az = mz + nz * 1.2;
      const atriumH = Math.min(16, hwado.height * 0.76);
      // Solid granite podium plinth rooted 2.5m underground so columns & glass NEVER sink into snow
      batch.add(new THREE.BoxGeometry(16.0, 3.2, 4.2), M.granite, V(ax + nx * 0.6, gy - 0.8, az + nz * 0.6), -ang);
      // Wide granite front entrance steps
      for (let s = 0; s < 4; s++) {
        batch.add(
          new THREE.BoxGeometry(12.5, 0.2 * (4 - s) + 1.2, 0.65),
          M.graniteDark,
          V(ax + nx * (2.6 + s * 0.65), gy - 0.6 + 0.1 * (4 - s), az + nz * (2.6 + s * 0.65)),
          -ang
        );
      }
      // Solid dark-slate backing behind glass so rear wall windows never bleed through
      batch.add(new THREE.BoxGeometry(11.6, atriumH, 1.0), M.atriumBack, V(ax - nx * 0.3, gy + 0.8 + atriumH / 2, az - nz * 0.3), -ang);
      // 4-story recessed gridded glass curtain-wall atrium
      batch.add(new THREE.BoxGeometry(11.4, atriumH, 0.8), M.glass, V(ax + nx * 0.15, gy + 0.8 + atriumH / 2, az + nz * 0.15), -ang);
      // Tall square granite piers flanking the atrium
      for (const s of [-6.4, -2.8, 2.8, 6.4]) {
        batch.add(new THREE.BoxGeometry(1.15, atriumH + 1.2, 2.0), M.booth, V(ax + tx * s + nx * 0.45, gy + 0.8 + (atriumH + 1.2) / 2, az + tz * s + nz * 0.45), -ang);
      }
      // Classical granite cornice + clean flat-faced extruded triangular pediment (zero cone crease)
      batch.add(new THREE.BoxGeometry(15.4, 1.1, 2.5), M.booth, V(ax + nx * 0.45, gy + 0.8 + atriumH + 1.4, az + nz * 0.45), -ang);
      const pedGeo = createPedimentGeometry(15.2, 3.2, 2.2);
      batch.add(pedGeo, M.booth, V(ax + nx * 0.45, gy + 0.8 + atriumH + 1.95, az + nz * 0.45), -ang);
    }
  }

  // Library lawn garden with crossing paths (fine 1.5m grid + polygonOffset to eliminate z-fighting)
  {
    const lawn = tessellateOnTerrain(LIBRARY_LAWN.polygon, 1.5, 0.14);
    if (lawn) batch.add(lawn, M.lawn, V(0, 0, 0));
    for (const [[x1, z1], [x2, z2]] of LIBRARY_LAWN.paths) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const ang = Math.atan2(z2 - z1, x2 - x1);
      const pieces = Math.ceil(len / 3);
      for (let k = 0; k < pieces; k++) {
        const t = (k + 0.5) / pieces;
        const px = x1 + (x2 - x1) * t;
        const pz = z1 + (z2 - z1) * t;
        batch.add(new THREE.BoxGeometry(len / pieces + 0.05, 0.06, 2.4), M.path, V(px, getTerrainHeight(px, pz) + 0.09, pz), -ang);
      }
    }
    // low hedge border
    const poly = LIBRARY_LAWN.polygon;
    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % poly.length];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const ang = Math.atan2(z2 - z1, x2 - x1);
      const pieces = Math.ceil(len / 3);
      for (let k = 0; k < pieces; k++) {
        const t = (k + 0.5) / pieces;
        if (Math.abs(t - 0.5) < 0.08) continue; // gap for paths
        const px = x1 + (x2 - x1) * t;
        const pz = z1 + (z2 - z1) * t;
        batch.add(new THREE.BoxGeometry(len / pieces, 0.6, 0.7), M.shrub, V(px, getTerrainHeight(px, pz) + 0.3, pz), -ang);
        batch.add(new THREE.BoxGeometry(len / pieces, 0.1, 0.75), M.snow, V(px, getTerrainHeight(px, pz) + 0.62, pz), -ang);
      }
    }
  }

  /* ------------------------------ gates (Roadview-accurate classical granite portal) ------------------------------ */
  const gateCreamStone = new THREE.MeshLambertMaterial({ color: '#d4cfc4' });
  for (const g of placeGates(outlines)) {
    const ang = g.ang;
    const ux = Math.cos(ang);
    const uz = Math.sin(ang);
    const gy = getTerrainHeight(g.x, g.z);
    const isMain = g.id === 'main';

    // Paved granite threshold pad underneath the gate portal
    batch.add(new THREE.BoxGeometry(g.width + 6.0, 0.25, 5.4), M.paving, V(g.x, gy + 0.04, g.z), -ang);

    for (const side of [-1, 1]) {
      const px = g.x + ux * side * (g.width / 2 + 1.0);
      const pz = g.z + uz * side * (g.width / 2 + 1.0);
      const py = getTerrainHeight(px, pz);
      if (isMain) {
        // Paired cylindrical light-grey granite columns on a deeply rooted stone plinth (Kakao Roadview 정문)
        batch.add(new THREE.BoxGeometry(2.5, 2.2, 2.3), M.graniteDark, V(px, py - 0.15, pz), -ang);
        for (const colOff of [-0.55, 0.55]) {
          batch.add(
            new THREE.CylinderGeometry(0.42, 0.48, 5.2, 14),
            gateCreamStone,
            V(px + ux * colOff, py + 3.55, pz + uz * colOff)
          );
        }
        batch.add(new THREE.BoxGeometry(2.6, 0.48, 2.3), M.granite, V(px, py + 6.25, pz), -ang);
      } else {
        batch.add(new THREE.BoxGeometry(1.7, 7.0, 1.7), M.gateStone, V(px, py + 2.1, pz), -ang);
        batch.add(new THREE.BoxGeometry(1.9, 0.3, 1.9), M.graniteDark, V(px, py + 5.75, pz), -ang);
        batch.add(new THREE.BoxGeometry(1.8, 0.12, 1.8), M.snow, V(px, py + 5.96, pz), -ang);
      }
      extraCovers.push({ x: px, z: pz, topY: py + 6.0, minX: px - 1.2, maxX: px + 1.2, minZ: pz - 1.2, maxZ: pz + 1.2 });
    }

    // Overhead classical granite entablature + clean flat-faced triangular pediment for 정문
    const beamH = isMain ? 1.55 : 1.1;
    const beamY = isMain ? gy + 7.1 : gy + 6.4;
    batch.add(new THREE.BoxGeometry(g.width + 4.8, beamH, 1.6), isMain ? gateCreamStone : M.frame, V(g.x, beamY, g.z), -ang);
    if (isMain) {
      const pedGeo = createPedimentGeometry(g.width + 4.8, 2.4, 1.5);
      batch.add(pedGeo, gateCreamStone, V(g.x, beamY + beamH * 0.5, g.z), -ang);
    }

    const tex = signTexture(
      g.label,
      g.sub,
      isMain
        ? { bg: '#ded9ce', fg: '#1e293b', subFg: '#475569', accent: '#7a1f2b' }
        : { bg: '#7a1f2b', fg: '#ffffff', subFg: '#fde68a', accent: '#fbbf24' }
    );
    for (const s of [1, -1]) {
      const sign = signMesh(g.width + 2.8, isMain ? 1.35 : 1.0, tex);
      sign.position.set(g.x - uz * 0.84 * s, beamY, g.z + ux * 0.84 * s);
      sign.rotation.y = -ang + (s > 0 ? 0 : Math.PI);
      worldGroup.add(sign);
    }

    // Security booth positioned cleanly outside the right gate column (zero overlap)
    const bx = g.x + ux * (g.width / 2 + 4.6);
    const bz = g.z + uz * (g.width / 2 + 4.6);
    const by = getTerrainHeight(bx, bz);
    batch.add(new THREE.BoxGeometry(2.6, 3.6, 2.6), M.granite, V(bx, by + 0.8, bz), -ang);
    batch.add(new THREE.BoxGeometry(2.4, 0.9, 2.7), M.glass, V(bx, by + 1.75, bz), -ang);
    batch.add(new THREE.BoxGeometry(3.0, 0.25, 3.0), M.frame, V(bx, by + 2.75, bz), -ang);
    extraCovers.push({ x: bx, z: bz, topY: by + 2.7, minX: bx - 1.4, maxX: bx + 1.4, minZ: bz - 1.4, maxZ: bz + 1.4 });
  }

  /* ------------------------------ building entrances (OSM) ------------------------------ */
  for (const [ex, ez] of ENTRANCES) {
    let best = null;
    for (const b of buildings) {
      const e = nearestEdge(b.polygon, ex, ez);
      if (e && (!best || e.dist < best.dist)) best = { ...e, b };
    }
    if (!best || best.dist > 8) continue;
    const { mx, mz, nx, nz, ang } = projectOnEdge(best, ex, ez);
    // Align entrance cleanly with the building's graded pad level (never buried in slopes)
    const gy = Math.max(best.b.baseY, getTerrainHeight(mx + nx * 1.5, mz + nz * 1.5));
    // glass doors on the facade
    batch.add(new THREE.BoxGeometry(4.2, 3.0, 0.25), M.glass, V(mx + nx * 0.15, gy + 1.5, mz + nz * 0.15), -ang);
    batch.add(new THREE.BoxGeometry(0.12, 3.0, 0.3), M.frame, V(mx + nx * 0.17, gy + 1.5, mz + nz * 0.17), -ang);
    // canopy
    batch.add(new THREE.BoxGeometry(5.5, 0.28, 2.8), M.frame, V(mx + nx * 1.4, gy + 3.5, mz + nz * 1.4), -ang);
    batch.add(new THREE.BoxGeometry(5.5, 0.08, 2.8), M.snow, V(mx + nx * 1.4, gy + 3.68, mz + nz * 1.4), -ang);
    // three low steps up to the door
    for (let s = 0; s < 3; s++) {
      batch.add(new THREE.BoxGeometry(5.0, 0.16 * (3 - s), 0.45), M.granite, V(mx + nx * (0.5 + s * 0.45), gy + 0.08 * (3 - s), mz + nz * (0.5 + s * 0.45)), -ang);
    }
  }

  return { extraWalls, extraCovers };
}

/* ------------------------------ helpers ------------------------------ */

function nearestEdge(poly, px, pz) {
  let best = null;
  for (let i = 0; i < poly.length - 1; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 4) continue;
    let t = ((px - x1) * dx + (pz - z1) * dz) / (len * len);
    t = Math.max(0.1, Math.min(0.9, t));
    const cx = x1 + dx * t;
    const cz = z1 + dz * t;
    const dist = Math.hypot(px - cx, pz - cz);
    if (!best || dist < best.dist) best = { dist, x1, z1, x2, z2, len, t };
  }
  if (!best) return null;
  return projectOnEdge(best, px, pz, poly);
}

function projectOnEdge(e, px, pz, poly = null) {
  const dx = e.x2 - e.x1;
  const dz = e.z2 - e.z1;
  const len = Math.hypot(dx, dz);
  let t = ((px - e.x1) * dx + (pz - e.z1) * dz) / (len * len);
  t = Math.max(0.15, Math.min(0.85, t));
  const mx = e.x1 + dx * t;
  const mz = e.z1 + dz * t;
  // outward normal: points toward the query point side
  let nx = -dz / len;
  let nz = dx / len;
  if ((px - mx) * nx + (pz - mz) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { ...e, mx, mz, nx, nz, ang: Math.atan2(dz, dx) };
}

function nearestRoadDir(roads, px, pz) {
  let best = null;
  for (const r of roads || []) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const [x1, z1] = r.points[i];
      const [x2, z2] = r.points[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const L = dx * dx + dz * dz;
      if (L < 1) continue;
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / L));
      const d = Math.hypot(px - x1 - dx * t, pz - z1 - dz * t);
      if (!best || d < best.d) best = { d, ang: Math.atan2(dz, dx) };
    }
  }
  return best && best.d < 25 ? best : null;
}

/** Grid-tessellated polygon whose vertices sit on the terrain (+offset). */
function tessellateOnTerrain(polygon, cell, offset) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of polygon) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const inside = (px, pz) => {
    let ins = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, zi] = polygon[i];
      const [xj, zj] = polygon[j];
      if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-9) + xi) ins = !ins;
    }
    return ins;
  };
  const pos = [];
  for (let x = minX; x < maxX; x += cell) {
    for (let z = minZ; z < maxZ; z += cell) {
      if (!inside(x + cell / 2, z + cell / 2)) continue;
      const q = [
        [x, z], [x + cell, z], [x + cell, z + cell], [x, z + cell],
      ].map(([px, pz]) => [px, getTerrainHeight(px, pz) + offset, pz]);
      pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
