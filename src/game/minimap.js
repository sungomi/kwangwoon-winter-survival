/**
 * Tactical 2D map renderer (PUBG-style): a player-centred radar in the corner and a
 * full campus map (M). North-up, shows blue zone, next safe circle, plane route,
 * airdrops, loot glints, campus outline and fences.
 */
export function createMinimap(canvas, mapData, playArea) {
  const ctx = canvas.getContext('2d');

  // Pre-render static layers once into an offscreen canvas at 1px = 1m scale
  const pad = 40;
  const ox = playArea.minX - pad;
  const oz = playArea.minZ - pad;
  const worldW = playArea.maxX - playArea.minX + pad * 2;
  const worldH = playArea.maxZ - playArea.minZ + pad * 2;
  const SCALE = 2;
  const base = document.createElement('canvas');
  base.width = Math.ceil(worldW * SCALE);
  base.height = Math.ceil(worldH * SCALE);
  const b = base.getContext('2d');
  const bx = (x) => (x - ox) * SCALE;
  const bz = (z) => (z - oz) * SCALE;

  b.fillStyle = '#c9d6e3';
  b.fillRect(0, 0, base.width, base.height);
  // forest
  b.fillStyle = 'rgba(74, 122, 92, 0.45)';
  for (const poly of mapData.woods || []) {
    b.beginPath();
    poly.forEach(([x, z], i) => (i ? b.lineTo(bx(x), bz(z)) : b.moveTo(bx(x), bz(z))));
    b.closePath();
    b.fill();
  }
  // campus grounds
  b.fillStyle = 'rgba(226, 236, 245, 0.95)';
  for (const ring of mapData.campusOutlines || []) {
    b.beginPath();
    ring.forEach(([x, z], i) => (i ? b.lineTo(bx(x), bz(z)) : b.moveTo(bx(x), bz(z))));
    b.closePath();
    b.fill();
  }
  for (const g of mapData.grasses || []) {
    b.fillStyle = 'rgba(134, 179, 140, 0.55)';
    b.beginPath();
    g.polygon.forEach(([x, z], i) => (i ? b.lineTo(bx(x), bz(z)) : b.moveTo(bx(x), bz(z))));
    b.closePath();
    b.fill();
  }
  // roads
  b.strokeStyle = '#7c8794';
  b.lineCap = 'round';
  b.lineJoin = 'round';
  for (const r of mapData.roads || []) {
    b.lineWidth = Math.max(1.5, r.width * SCALE * 0.8);
    b.beginPath();
    r.points.forEach(([x, z], i) => (i ? b.lineTo(bx(x), bz(z)) : b.moveTo(bx(x), bz(z))));
    b.stroke();
  }
  // pitches
  for (const p of mapData.pitches || []) {
    b.fillStyle = 'rgba(80, 140, 90, 0.75)';
    b.fillRect(bx(p.center[0] - p.width / 2), bz(p.center[1] - p.depth / 2), p.width * SCALE, p.depth * SCALE);
  }
  // buildings
  for (const bd of mapData.buildings) {
    b.fillStyle = bd.isCampus ? '#5b6b7d' : '#8794a3';
    b.beginPath();
    bd.polygon.forEach(([x, z], i) => (i ? b.lineTo(bx(x), bz(z)) : b.moveTo(bx(x), bz(z))));
    b.closePath();
    b.fill();
  }
  // fences
  b.strokeStyle = '#1f2933';
  b.lineWidth = 1.4;
  for (const f of mapData.barriers || []) {
    b.beginPath();
    b.moveTo(bx(f.a[0]), bz(f.a[1]));
    b.lineTo(bx(f.b[0]), bz(f.b[1]));
    b.stroke();
  }
  // building names
  b.font = `bold ${7 * SCALE}px sans-serif`;
  b.textAlign = 'center';
  for (const bd of mapData.buildings) {
    if (!bd.name || !bd.isCampus) continue;
    let cx = 0, cz = 0;
    for (const [x, z] of bd.polygon) {
      cx += x;
      cz += z;
    }
    cx /= bd.polygon.length;
    cz /= bd.polygon.length;
    const label = bd.name.replace('광운대학교 ', '').replace(' 대극장', '');
    b.lineWidth = 3;
    b.strokeStyle = 'rgba(255,255,255,0.85)';
    b.strokeText(label, bx(cx), bz(cz));
    b.fillStyle = '#0f172a';
    b.fillText(label, bx(cx), bz(cz));
  }

  function render(targetCanvas, { center, range, playerPos, playerYaw, zone, drops, airdrops, plane, full = false }) {
    const c = targetCanvas.getContext('2d');
    const W = targetCanvas.width;
    const H = targetCanvas.height;
    const scale = Math.min(W, H) / (range * 2); // px per meter
    const toX = (x) => W / 2 + (x - center.x) * scale;
    const toY = (z) => H / 2 + (z - center.z) * scale;

    c.save();
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#9fb0c2';
    c.fillRect(0, 0, W, H);
    // static base
    const sx = (center.x - range - ox) * SCALE;
    const sy = (center.z - range - oz) * SCALE;
    c.drawImage(base, sx, sy, range * 2 * SCALE, range * 2 * SCALE, (W - range * 2 * scale) / 2, (H - range * 2 * scale) / 2, range * 2 * scale, range * 2 * scale);

    // grid (100m squares like PUBG map)
    if (full) {
      c.strokeStyle = 'rgba(15, 23, 42, 0.12)';
      c.lineWidth = 1;
      for (let gx = Math.ceil((center.x - range) / 100) * 100; gx < center.x + range; gx += 100) {
        c.beginPath();
        c.moveTo(toX(gx), 0);
        c.lineTo(toX(gx), H);
        c.stroke();
      }
      for (let gz = Math.ceil((center.z - range) / 100) * 100; gz < center.z + range; gz += 100) {
        c.beginPath();
        c.moveTo(0, toY(gz));
        c.lineTo(W, toY(gz));
        c.stroke();
      }
    }

    // Blue zone: shade outside the current circle
    if (zone) {
      c.save();
      c.fillStyle = 'rgba(37, 99, 235, 0.38)';
      c.beginPath();
      c.rect(0, 0, W, H);
      c.arc(toX(zone.cur.x), toY(zone.cur.z), zone.cur.r * scale, 0, Math.PI * 2, true);
      c.fill('evenodd');
      c.restore();
      c.strokeStyle = '#3b82f6';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(toX(zone.cur.x), toY(zone.cur.z), zone.cur.r * scale, 0, Math.PI * 2);
      c.stroke();
      if (zone.showNext || full) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(toX(zone.next.x), toY(zone.next.z), zone.next.r * scale, 0, Math.PI * 2);
        c.stroke();
        if (playerPos && full) {
          // dashed route to the safe circle
          c.setLineDash([6, 6]);
          c.strokeStyle = 'rgba(255,255,255,0.8)';
          c.beginPath();
          c.moveTo(toX(playerPos.x), toY(playerPos.z));
          c.lineTo(toX(zone.next.x), toY(zone.next.z));
          c.stroke();
          c.setLineDash([]);
        }
      }
    }

    // Plane route
    if (plane) {
      c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      c.setLineDash([8, 6]);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(toX(plane.start.x), toY(plane.start.z));
      c.lineTo(toX(plane.end.x), toY(plane.end.z));
      c.stroke();
      c.setLineDash([]);
      const px = plane.start.x + (plane.end.x - plane.start.x) * plane.t;
      const pz = plane.start.z + (plane.end.z - plane.start.z) * plane.t;
      c.save();
      c.translate(toX(px), toY(pz));
      c.rotate(Math.atan2(plane.end.z - plane.start.z, plane.end.x - plane.start.x));
      c.fillStyle = '#facc15';
      c.beginPath();
      c.moveTo(9, 0);
      c.lineTo(-6, -7);
      c.lineTo(-3, 0);
      c.lineTo(-6, 7);
      c.closePath();
      c.fill();
      c.restore();
    }

    // Loot glints (only nearby on the radar)
    for (const d of drops || []) {
      if (!full && playerPos && Math.hypot(d.x - playerPos.x, d.z - playerPos.z) > 45) continue;
      c.fillStyle = d.color || '#facc15';
      c.fillRect(toX(d.x) - 1.5, toY(d.z) - 1.5, 3, 3);
    }
    // Airdrops
    for (const a of airdrops || []) {
      c.fillStyle = '#ef4444';
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.5;
      c.fillRect(toX(a.x) - 4, toY(a.z) - 4, 8, 8);
      c.strokeRect(toX(a.x) - 4, toY(a.z) - 4, 8, 8);
    }

    // Player arrow
    if (playerPos) {
      c.save();
      c.translate(toX(playerPos.x), toY(playerPos.z));
      c.rotate(-playerYaw);
      if (!full) {
        // view cone
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, 38, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
        c.closePath();
        c.fill();
      }
      c.fillStyle = '#facc15';
      c.strokeStyle = '#111827';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, -7);
      c.lineTo(5, 5);
      c.lineTo(0, 2.5);
      c.lineTo(-5, 5);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }

    if (full) {
      // grid labels A-Z / 1-9
      c.fillStyle = 'rgba(15,23,42,0.55)';
      c.font = 'bold 11px sans-serif';
      c.textAlign = 'left';
      c.fillText('N ↑', 8, 16);
    }
    c.restore();
  }

  return {
    renderRadar(state) {
      const center = state.playerPos || { x: (playArea.minX + playArea.maxX) / 2, z: (playArea.minZ + playArea.maxZ) / 2 };
      render(canvas, { ...state, center, range: 110 });
    },
    renderFull(targetCanvas, state) {
      const center = { x: (playArea.minX + playArea.maxX) / 2, z: (playArea.minZ + playArea.maxZ) / 2 };
      const range = Math.max(playArea.maxX - playArea.minX, playArea.maxZ - playArea.minZ) / 2 + 20;
      render(targetCanvas, { ...state, center, range, full: true });
    },
  };
}
