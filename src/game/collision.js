/**
 * Shared world collision: building footprints, tactical cover boxes and fence segments.
 * Used by the player controller, AI bots, snowmen and loot placement.
 */
export const PLAYER_RADIUS = 0.7;

function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], zi = polygon[i][1];
    const xj = polygon[j][0], zj = polygon[j][1];
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distToSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

export function createCollisionWorld({ buildings = [], covers = [], fences = [] }) {
  // Pre-compute fence bounds for cheap rejection
  const fenceList = fences.map((f) => ({
    ...f,
    minX: Math.min(f.a[0], f.b[0]),
    maxX: Math.max(f.a[0], f.b[0]),
    minZ: Math.min(f.a[1], f.b[1]),
    maxZ: Math.max(f.a[1], f.b[1]),
  }));

  function buildingAt(x, z, r = PLAYER_RADIUS) {
    for (const b of buildings) {
      if (b.destroyed) continue;
      const { minX, maxX, minZ, maxZ } = b.bounds;
      if (x < minX - r || x > maxX + r || z < minZ - r || z > maxZ + r) continue;
      if (
        pointInPolygon(x, z, b.polygon) ||
        pointInPolygon(x + r, z, b.polygon) ||
        pointInPolygon(x - r, z, b.polygon) ||
        pointInPolygon(x, z + r, b.polygon) ||
        pointInPolygon(x, z - r, b.polygon)
      ) {
        return b;
      }
    }
    return null;
  }

  function isBlocked(x, z, r = PLAYER_RADIUS) {
    for (const c of covers) {
      if (x >= c.minX - r && x <= c.maxX + r && z >= c.minZ - r && z <= c.maxZ + r) return true;
    }
    for (const f of fenceList) {
      if (x < f.minX - r - 0.3 || x > f.maxX + r + 0.3 || z < f.minZ - r - 0.3 || z > f.maxZ + r + 0.3) continue;
      if (distToSegment(x, z, f.a, f.b) < r + 0.18) return true;
    }
    return !!buildingAt(x, z, r);
  }

  /** Is a projectile at (x, y, z) inside solid cover / fence base? */
  function projectileHit(x, y, z, groundY) {
    for (const c of covers) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ && y <= c.topY) return true;
    }
    for (const f of fenceList) {
      if (x < f.minX - 0.4 || x > f.maxX + 0.4 || z < f.minZ - 0.4 || z > f.maxZ + 0.4) continue;
      // Stone plinth + iron bars: low shots are stopped, high shots pass through the railing gaps
      if (y - groundY < 0.75 && distToSegment(x, z, f.a, f.b) < 0.3) return true;
    }
    return false;
  }

  /** Find the nearest walkable point around (x, z). */
  function findFreeSpot(x, z, r = PLAYER_RADIUS, maxSearch = 60) {
    if (!isBlocked(x, z, r)) return [x, z];
    for (let rad = 2; rad <= maxSearch; rad += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const cx = x + Math.cos(a) * rad;
        const cz = z + Math.sin(a) * rad;
        if (!isBlocked(cx, cz, r)) return [cx, cz];
      }
    }
    return [x, z];
  }

  return { isBlocked, buildingAt, projectileHit, findFreeSpot };
}
