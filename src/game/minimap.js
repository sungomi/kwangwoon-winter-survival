/**
 * Renders a real-time tactical 2D minimap on a <canvas> in the bottom-right corner.
 */
export function createMinimap(canvas, mapData) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  // Playable campus bounds: x in [-155, 185], z in [-135, 135]
  const RANGE = 190;
  const CENTER_X = 15;
  const CENTER_Z = 0;

  function toMini(wx, wz) {
    const nx = (wx - CENTER_X) / RANGE;
    const nz = (wz - CENTER_Z) / RANGE;
    return [W * 0.5 + nx * (W * 0.46), H * 0.5 + nz * (H * 0.46)];
  }

  function render({ playerPos, playerYaw, zoneRadius, snowmen, rivals, drops }) {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(10, 18, 32, 0.9)';
    ctx.fillRect(0, 0, W, H);

    // Roads
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 2;
    for (const r of mapData.roads || []) {
      if (r.points.length < 2) continue;
      ctx.beginPath();
      r.points.forEach(([px, pz], idx) => {
        const [mx, my] = toMini(px, pz);
        if (idx === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      });
      ctx.stroke();
    }

    // Buildings
    for (const b of mapData.buildings) {
      if (!b.polygon || b.polygon.length < 3) continue;
      ctx.fillStyle = b.isCampus ? 'rgba(148, 163, 184, 0.58)' : 'rgba(71, 85, 105, 0.42)';
      ctx.beginPath();
      b.polygon.forEach(([px, pz], idx) => {
        const [mx, my] = toMini(px, pz);
        if (idx === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      });
      ctx.closePath();
      ctx.fill();
    }

    // Safe Zone Ring (centered at 20, -10)
    const [zx, zy] = toMini(20, -10);
    const zr = (zoneRadius / RANGE) * (W * 0.46);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(zx, zy, zr, 0, Math.PI * 2);
    ctx.stroke();

    // Loot Drops (gold dots)
    ctx.fillStyle = '#facc15';
    for (const d of drops || []) {
      const [dx, dy] = toMini(d.x, d.z);
      ctx.fillRect(dx - 1.5, dy - 1.5, 3, 3);
    }

    // Snowmen (white dots)
    ctx.fillStyle = '#ffffff';
    for (const s of snowmen || []) {
      if (!s.alive) continue;
      const [sx, sy] = toMini(s.x, s.z);
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rival players & bots (red dots)
    ctx.fillStyle = '#ef4444';
    for (const r of rivals || []) {
      if (!r.alive) continue;
      const [rx, ry] = toMini(r.x, r.z);
      ctx.beginPath();
      ctx.arc(rx, ry, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Local Player Arrow
    if (playerPos) {
      const [px, py] = toMini(playerPos.x, playerPos.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-playerYaw);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(4, 4);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  return { render };
}
