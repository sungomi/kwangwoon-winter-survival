import { HEIGHTMAP } from '../data/campusHeightmap.js';
import { PLAZA, STAIRS } from '../data/campusFeatures.js';

/**
 * Real Kwangwoon University terrain (광운대 실제 지형).
 * 1) Natural ground: smoothed SRTM elevation grid (40m spacing), Catmull-Rom bicubic.
 * 2) Built landscape on top: the raised round plaza with its sunken ring steps, and real
 *    staircases. Everything that walks, lands or rolls uses getTerrainHeight, so stairs are walkable.
 * Heights are meters relative to the central plaza area.
 */
const { step, half, n, data } = HEIGHTMAP;

function cell(r, c) {
  r = r < 0 ? 0 : r > n - 1 ? n - 1 : r;
  c = c < 0 ? 0 : c > n - 1 ? n - 1 : c;
  return data[r * n + c];
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function getNaturalHeight(x, z) {
  const fx = Math.min(n - 1, Math.max(0, (x + half) / step));
  const fz = Math.min(n - 1, Math.max(0, (z + half) / step));
  const c = Math.min(n - 2, Math.floor(fx));
  const r = Math.min(n - 2, Math.floor(fz));
  const tx = fx - c;
  const tz = fz - r;
  const rows = [];
  for (let k = -1; k <= 2; k++) {
    rows.push(catmull(cell(r + k, c - 1), cell(r + k, c), cell(r + k, c + 1), cell(r + k, c + 2), tx));
  }
  return catmull(rows[0], rows[1], rows[2], rows[3], tz);
}

/* ---------------------------- built landscape ---------------------------- */

export const PLAZA_LEVEL = getNaturalHeight(PLAZA.x, PLAZA.z) + PLAZA.lift;

function smooth01(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function plazaHeight(x, z, natural) {
  const d = Math.hypot(x - PLAZA.x, z - PLAZA.z);
  if (d > PLAZA.radius + PLAZA.blend) return null;
  let h = PLAZA_LEVEL;
  // sunken centre: ring steps going down toward the middle
  const rings = PLAZA.rings;
  for (let i = rings.length - 1; i >= 0; i--) {
    if (d < rings[i]) h = PLAZA_LEVEL - (rings.length - i) * PLAZA.ringStep;
  }
  if (d <= PLAZA.radius) return h;
  // outer band: blend to natural ground, but if the ground falls away a lot keep a hard retaining edge
  const t = smooth01((d - PLAZA.radius) / PLAZA.blend);
  if (PLAZA_LEVEL - natural > 1.2) return t < 0.15 ? PLAZA_LEVEL : natural;
  return PLAZA_LEVEL + (natural - PLAZA_LEVEL) * t;
}

// Pre-compute stair geometry (bottom/top heights from natural ground or the plaza)
export const STAIR_FLIGHTS = STAIRS.map((s) => {
  const [ax, az] = s.a;
  const [bx, bz] = s.b;
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len;
  const uz = (bz - az) / len;
  const hA = getNaturalHeight(ax, az);
  const hB = s.toPlaza ? PLAZA_LEVEL : getNaturalHeight(bx, bz);
  const rise = Math.abs(hB - hA);
  const steps = Math.max(2, Math.round(rise / 0.17));
  return { ...s, ax, az, bx, bz, len, ux, uz, hA, hB, steps };
});

function stairHeight(x, z) {
  for (const f of STAIR_FLIGHTS) {
    const rx = x - f.ax;
    const rz = z - f.az;
    const along = rx * f.ux + rz * f.uz;
    const across = -rx * f.uz + rz * f.ux;
    if (along < -0.3 || along > f.len + 0.3 || Math.abs(across) > f.width / 2) continue;
    const t = Math.max(0, Math.min(1, along / f.len));
    const k = Math.min(f.steps, Math.floor(t * f.steps + 0.5));
    return f.hA + ((f.hB - f.hA) * k) / f.steps;
  }
  return null;
}

/* ---------------------------- building pad grading ---------------------------- */
const PAD_APRON = 1.6;
const PAD_BLEND = 6.5;
const PAD_MARGIN = PAD_APRON + PAD_BLEND;
const PAD_GRID_CELL = 24;
let padGrid = new Map();

function pointInPoly2D(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

function distToPolyEdges(x, z, poly) {
  let minD = Infinity;
  const len = poly.length;
  for (let i = 0; i < len; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % len];
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

/**
 * Registers leveled building pads (대지 평탄화) into the terrain heightfield so no building is
 * sliced diagonally or buried by raw SRTM slopes. Must be called before building the terrain mesh.
 */
export function registerBuildingPads(buildings) {
  padGrid = new Map();
  for (const b of buildings || []) {
    const poly = b.polygon;
    if (!poly || poly.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let minH = Infinity, maxH = -Infinity, sumH = 0, sumX = 0, sumZ = 0;
    for (const [x, z] of poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      const h = getNaturalHeight(x, z);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      sumH += h;
      sumX += x;
      sumZ += z;
    }
    const cx = sumX / poly.length;
    const cz = sumZ / poly.length;
    const ch = getNaturalHeight(cx, cz);
    if (ch < minH) minH = ch;
    if (ch > maxH) maxH = ch;

    // Level pad biased toward the upper-middle of the slope so the uphill side is never buried
    // and the downhill side gets a clean granite retaining plinth.
    const diff = maxH - minH;
    const padY = diff < 0.8 ? (sumH + ch) / (poly.length + 1) : minH + diff * 0.68;

    b.padY = padY;
    b.minNaturalY = minH;
    b.maxNaturalY = maxH;

    const pad = {
      poly,
      padY,
      minX: minX - PAD_MARGIN,
      maxX: maxX + PAD_MARGIN,
      minZ: minZ - PAD_MARGIN,
      maxZ: maxZ + PAD_MARGIN,
    };

    const gx0 = Math.floor(pad.minX / PAD_GRID_CELL);
    const gx1 = Math.floor(pad.maxX / PAD_GRID_CELL);
    const gz0 = Math.floor(pad.minZ / PAD_GRID_CELL);
    const gz1 = Math.floor(pad.maxZ / PAD_GRID_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const key = `${gx},${gz}`;
        let list = padGrid.get(key);
        if (!list) {
          list = [];
          padGrid.set(key, list);
        }
        list.push(pad);
      }
    }
  }
}

function buildingPadHeight(x, z, natural) {
  if (padGrid.size === 0) return natural;
  const key = `${Math.floor(x / PAD_GRID_CELL)},${Math.floor(z / PAD_GRID_CELL)}`;
  const list = padGrid.get(key);
  if (!list) return natural;

  let weightSum = 0;
  let heightSum = 0;
  let maxWeight = 0;
  let exactPadY = null;

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) continue;
    let w = 0;
    if (pointInPoly2D(x, z, p.poly)) {
      // Strictly own pad inside footprint (if overlapping pads exist, prefer lowest to avoid burying neighbors)
      exactPadY = exactPadY === null ? p.padY : Math.min(exactPadY, p.padY);
      continue;
    } else {
      const d = distToPolyEdges(x, z, p.poly);
      if (d <= 0.35) {
        exactPadY = exactPadY === null ? p.padY : Math.min(exactPadY, p.padY);
        continue;
      }
      if (d <= PAD_APRON) w = 1;
      else if (d < PAD_MARGIN) w = 1 - smooth01((d - PAD_APRON) / PAD_BLEND);
    }
    if (w > 0) {
      weightSum += w;
      heightSum += w * p.padY;
      if (w > maxWeight) maxWeight = w;
    }
  }

  if (exactPadY !== null) return exactPadY;
  if (weightSum === 0) return natural;
  const target = heightSum / weightSum;
  return natural + (target - natural) * maxWeight;
}

export function getTerrainHeight(x, z) {
  const natural = getNaturalHeight(x, z);
  const s = stairHeight(x, z);
  if (s !== null) return s;
  const p = plazaHeight(x, z, natural);
  if (p !== null) return p;
  return buildingPadHeight(x, z, natural);
}

/** Lowest terrain height under a polygon footprint (used to sink building foundations). */
export function getFootprintMinHeight(polygon) {
  let min = Infinity;
  const len = polygon.length;
  for (let i = 0; i < len; i++) {
    const [x1, z1] = polygon[i];
    const [x2, z2] = polygon[(i + 1) % len];
    min = Math.min(min, getNaturalHeight(x1, z1), getTerrainHeight(x1, z1));
    // Also check edge midpoint for long walls over curved terrain
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    min = Math.min(min, getNaturalHeight(mx, mz), getTerrainHeight(mx, mz));
  }
  return min;
}

/** Max step a walker can climb without jumping (curbs & stairs yes, retaining walls no). */
export const MAX_STEP_UP = 0.6;
