import { GATES } from '../data/campusFeatures.js';

/**
 * Snap each real gate (OSM entrance=gate) onto the nearest campus-outline edge so the gate
 * stands in the fence line, and report where the fence must be opened.
 */
export function placeGates(outlines) {
  return GATES.map((g) => {
    let best = null;
    (outlines || []).forEach((ring, ri) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, z1] = ring[i];
        const [x2, z2] = ring[i + 1];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const L = dx * dx + dz * dz;
        if (L < 1) continue;
        const t = Math.max(0, Math.min(1, ((g.x - x1) * dx + (g.z - z1) * dz) / L));
        const px = x1 + dx * t;
        const pz = z1 + dz * t;
        const d = Math.hypot(g.x - px, g.z - pz);
        if (!best || d < best.d) best = { d, ring: ri, edge: i, t, len: Math.sqrt(L), x: px, z: pz, ang: Math.atan2(dz, dx) };
      }
    });
    if (!best || best.d > 30) return { ...g, ang: 0, ring: -1 };
    return { ...g, x: best.x, z: best.z, ang: best.ang, ring: best.ring, edge: best.edge, t: best.t, edgeLen: best.len };
  });
}
