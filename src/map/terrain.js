import { HEIGHTMAP } from '../data/campusHeightmap.js';

/**
 * Real Kwangwoon University terrain (광운대 실제 지형).
 * Samples a smoothed SRTM elevation grid (40m spacing) with Catmull-Rom bicubic
 * interpolation so slopes stay continuous underfoot (no terraces or creases).
 * Heights are meters relative to the central plaza.
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

export function getTerrainHeight(x, z) {
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

/** Lowest terrain height under a polygon footprint (used to sink building foundations). */
export function getFootprintMinHeight(polygon) {
  let min = Infinity;
  for (const [x, z] of polygon) min = Math.min(min, getTerrainHeight(x, z));
  return min;
}
