/**
 * Shared world collision: exact circle-vs-polygon building footprints, tactical cover boxes,
 * and fence segments. Used by the player controller, AI bots, snowmen, projectiles and loot.
 */
export const PLAYER_RADIUS = 0.72;

export function pointInPolygon(x, z, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
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
  let t = lenSq > 1e-9 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

function closestPointOnPolygonEdge(px, pz, polygon) {
  let bestDist = Infinity;
  let bestX = px;
  let bestZ = pz;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-9) continue;
    let t = ((px - a[0]) * dx + (pz - a[1]) * dz) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = a[0] + dx * t;
    const cz = a[1] + dz * t;
    const d = Math.hypot(px - cx, pz - cz);
    if (d < bestDist) {
      bestDist = d;
      bestX = cx;
      bestZ = cz;
    }
  }
  return { dist: bestDist, cx: bestX, cz: bestZ };
}

function circleIntersectsPolygon(x, z, r, polygon) {
  if (pointInPolygon(x, z, polygon)) return true;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    if (distToSegment(x, z, a, b) < r) return true;
  }
  return false;
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
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (b.destroyed) continue;
      const { minX, maxX, minZ, maxZ } = b.bounds;
      if (x < minX - r || x > maxX + r || z < minZ - r || z > maxZ + r) continue;
      if (circleIntersectsPolygon(x, z, r, b.polygon)) return b;
    }
    return null;
  }

  /** Checks if a 3D point (e.g. airborne player or projectile) is inside a building volume. */
  function buildingAt3D(x, y, z, r = PLAYER_RADIUS) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (b.destroyed) continue;
      const topY = b.baseY + b.height;
      if (y > topY) continue;
      const { minX, maxX, minZ, maxZ } = b.bounds;
      if (x < minX - r || x > maxX + r || z < minZ - r || z > maxZ + r) continue;
      if (circleIntersectsPolygon(x, z, r, b.polygon)) return b;
    }
    return null;
  }

  function isBlocked(x, z, r = PLAYER_RADIUS) {
    for (let i = 0; i < covers.length; i++) {
      const c = covers[i];
      if (x >= c.minX - r && x <= c.maxX + r && z >= c.minZ - r && z <= c.maxZ + r) return true;
    }
    for (let i = 0; i < fenceList.length; i++) {
      const f = fenceList[i];
      if (x < f.minX - r - 0.3 || x > f.maxX + r + 0.3 || z < f.minZ - r - 0.3 || z > f.maxZ + r + 0.3) continue;
      if (distToSegment(x, z, f.a, f.b) < r + 0.18) return true;
    }
    return !!buildingAt(x, z, r);
  }

  /** Push (x, z) out of any overlapping building/cover/fence so entities never stay stuck inside. */
  function resolvePosition(x, z, r = PLAYER_RADIUS) {
    let px = x;
    let pz = z;
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (b.destroyed) continue;
        const { minX, maxX, minZ, maxZ } = b.bounds;
        if (px < minX - r || px > maxX + r || pz < minZ - r || pz > maxZ + r) continue;
        const inside = pointInPolygon(px, pz, b.polygon);
        const edge = closestPointOnPolygonEdge(px, pz, b.polygon);
        if (inside || edge.dist < r) {
          let nx = px - edge.cx;
          let nz = pz - edge.cz;
          let d = Math.hypot(nx, nz);
          if (d < 1e-6) {
            nx = px - b.bounds.cx;
            nz = pz - b.bounds.cz;
            d = Math.hypot(nx, nz) || 1;
          }
          nx /= d;
          nz /= d;
          if (inside) {
            // Point is inside polygon: push across the nearest edge to outside + radius
            px = edge.cx - nx * (r + 0.04);
            pz = edge.cz - nz * (r + 0.04);
            // If that didn't escape (e.g. concave corner), flip sign
            if (pointInPolygon(px, pz, b.polygon)) {
              px = edge.cx + nx * (r + 0.04);
              pz = edge.cz + nz * (r + 0.04);
            }
          } else {
            px = edge.cx + nx * (r + 0.02);
            pz = edge.cz + nz * (r + 0.02);
          }
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    if (isBlocked(px, pz, r * 0.9)) {
      return findFreeSpot(px, pz, r, 30);
    }
    return [px, pz];
  }

  /**
   * Sub-stepped circle movement with smooth wall sliding along angled building edges.
   * Eliminates corner clipping and high-speed tunneling.
   */
  function moveCircle(x, z, dx, dz, r = PLAYER_RADIUS, canStepFn = null) {
    const totalDist = Math.hypot(dx, dz);
    if (totalDist < 1e-6) return [x, z];
    const maxStep = 0.25;
    const steps = Math.max(1, Math.ceil(totalDist / maxStep));
    const sx = dx / steps;
    const sz = dz / steps;

    let cx = x;
    let cz = z;
    const ok = (nx, nz) => !isBlocked(nx, nz, r) && (!canStepFn || canStepFn(nx, nz));

    for (let s = 0; s < steps; s++) {
      const nx = cx + sx;
      const nz = cz + sz;
      if (ok(nx, nz)) {
        cx = nx;
        cz = nz;
        continue;
      }
      // Try sliding along the nearest building wall tangent first (smooth on rotated buildings)
      const hitB = buildingAt(nx, nz, r);
      let slid = false;
      if (hitB) {
        const edge = closestPointOnPolygonEdge(nx, nz, hitB.polygon);
        let enx = nx - edge.cx;
        let enz = nz - edge.cz;
        const ed = Math.hypot(enx, enz);
        if (ed > 1e-5) {
          enx /= ed;
          enz /= ed;
          // Tangent vector perpendicular to normal
          const tx = -enz;
          const tz = enx;
          const dot = sx * tx + sz * tz;
          const slx = cx + tx * dot;
          const slz = cz + tz * dot;
          if (ok(slx, slz)) {
            cx = slx;
            cz = slz;
            slid = true;
          }
        }
      }
      if (!slid) {
        if (ok(cx + sx, cz)) cx += sx;
        else if (ok(cx, cz + sz)) cz += sz;
      }
    }
    return [cx, cz];
  }

  function pointHitsSolid(x, y, z, groundY) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (b.destroyed) continue;
      if (y > b.baseY + b.height) continue;
      const { minX, maxX, minZ, maxZ } = b.bounds;
      if (x < minX - 0.12 || x > maxX + 0.12 || z < minZ - 0.12 || z > maxZ + 0.12) continue;
      if (circleIntersectsPolygon(x, z, 0.12, b.polygon)) return true;
    }
    for (let i = 0; i < covers.length; i++) {
      const c = covers[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ && y <= c.topY) return true;
    }
    for (let i = 0; i < fenceList.length; i++) {
      const f = fenceList[i];
      if (x < f.minX - 0.4 || x > f.maxX + 0.4 || z < f.minZ - 0.4 || z > f.maxZ + 0.4) continue;
      // Stone plinth + iron bars: low shots are stopped, high shots pass through the railing gaps
      if (y - groundY < 0.75 && distToSegment(x, z, f.a, f.b) < 0.3) return true;
    }
    return false;
  }

  /** Is a projectile segment (prev -> cur) or point inside a building, cover, or fence base? */
  function projectileHit(x, y, z, groundY, prevX, prevY, prevZ) {
    if (prevX !== undefined) {
      const dist = Math.hypot(x - prevX, y - prevY, z - prevZ);
      const steps = Math.min(12, Math.max(1, Math.ceil(dist / 0.7)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const sx = prevX + (x - prevX) * t;
        const sy = prevY + (y - prevY) * t;
        const sz = prevZ + (z - prevZ) * t;
        if (pointHitsSolid(sx, sy, sz, groundY)) return true;
      }
      return false;
    }
    return pointHitsSolid(x, y, z, groundY);
  }

  /** Find the nearest walkable point around (x, z). */
  function findFreeSpot(x, z, r = PLAYER_RADIUS, maxSearch = 60) {
    if (!isBlocked(x, z, r)) return [x, z];
    for (let rad = 1.5; rad <= maxSearch; rad += 1.5) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const cx = x + Math.cos(a) * rad;
        const cz = z + Math.sin(a) * rad;
        if (!isBlocked(cx, cz, r)) return [cx, cz];
      }
    }
    return [x, z];
  }

  return { isBlocked, buildingAt, buildingAt3D, moveCircle, resolvePosition, projectileHit, findFreeSpot };
}
