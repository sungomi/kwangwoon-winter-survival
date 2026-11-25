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

export function getTerrainHeight(x, z) {
  const natural = getNaturalHeight(x, z);
  const s = stairHeight(x, z);
  if (s !== null) return s;
  const p = plazaHeight(x, z, natural);
  if (p !== null) return p;
  return natural;
}

/** Lowest terrain height under a polygon footprint (used to sink building foundations). */
export function getFootprintMinHeight(polygon) {
  let min = Infinity;
  for (const [x, z] of polygon) min = Math.min(min, getNaturalHeight(x, z));
  return min;
}

/** Max step a walker can climb without jumping (curbs & stairs yes, retaining walls no). */
export const MAX_STEP_UP = 0.6;
