import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3001;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath === '/' ? 'index.html' : safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
  };
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws' });

const COLORS = ['#ef4444', '#3b82f6', '#eab308', '#10b981', '#a855f7', '#f97316', '#ec4899'];
const players = new Map();
let nextId = 1;

// Shared Blizzard Survival Zone + Batched 15Hz Player Snapshot (scales cleanly to 20-40+ players)
let zoneRadius = 220;
const zoneShrinkSpeed = 1.4;
let zoneTick = 0;

setInterval(() => {
  zoneTick++;
  if (players.size > 0 && zoneRadius > 28) {
    zoneRadius = Math.max(28, zoneRadius - zoneShrinkSpeed * 0.066);
  } else if (players.size === 0) {
    zoneRadius = 220;
  }

  if (players.size > 0) {
    const states = [];
    for (const p of players.values()) {
      states.push({ id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, hp: p.hp, alive: p.alive, weapon: p.weapon ?? null });
    }
    broadcast({ type: 'snapshot', states, zoneRadius: zoneTick % 8 === 0 ? zoneRadius : undefined });
  }
}, 66);

function broadcast(msg, excludeId = null) {
  const raw = JSON.stringify(msg);
  for (const [id, client] of players.entries()) {
    if (id !== excludeId && client.ws.readyState === 1) {
      client.ws.send(raw);
    }
  }
}

wss.on('connection', (ws) => {
  const id = `p${nextId++}`;
  const color = COLORS[(nextId - 2) % COLORS.length];
  const player = {
    id,
    ws,
    name: `학우${nextId - 1}`,
    color,
    x: (Math.random() - 0.5) * 40,
    y: 2,
    z: (Math.random() - 0.5) * 40,
    yaw: 0,
    hp: 100,
    alive: true,
    kills: 0,
  };
  players.set(id, player);

  const roster = [];
  for (const [pid, p] of players.entries()) {
    if (pid !== id) {
      roster.push({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        hp: p.hp,
        alive: p.alive,
      });
    }
  }
  ws.send(JSON.stringify({ type: 'welcome', id, name: player.name, color, zoneRadius, roster }));
  broadcast(
    {
      type: 'join',
      player: { id, name: player.name, color, x: player.x, y: player.y, z: player.z, yaw: player.yaw, hp: 100, alive: true },
    },
    id
  );

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'move') {
      player.x = msg.x;
      player.y = msg.y;
      player.z = msg.z;
      player.yaw = msg.yaw;
      player.hp = msg.hp ?? player.hp;
      player.alive = msg.alive ?? player.alive;
      if (msg.weapon === null || typeof msg.weapon === 'string') player.weapon = msg.weapon ? msg.weapon.slice(0, 16) : null;
    } else if (msg.type === 'rename' && typeof msg.name === 'string') {
      player.name = msg.name.slice(0, 14) || player.name;
      broadcast({ type: 'rename', id, name: player.name });
    } else if (msg.type === 'throw') {
      broadcast({ type: 'throw', id, origin: msg.origin, dir: msg.dir, weapon: msg.weapon }, id);
    } else if (msg.type === 'hit' && players.has(msg.targetId)) {
      const target = players.get(msg.targetId);
      if (!target.alive) return;
      target.hp = Math.max(0, target.hp - (msg.damage || 25));
      if (target.hp <= 0) {
        target.alive = false;
        player.kills++;
        broadcast({ type: 'eliminated', victimId: target.id, victimName: target.name, killerId: id, killerName: player.name });
      } else {
        target.ws.send(JSON.stringify({ type: 'damaged', hp: target.hp, by: player.name }));
      }
      broadcast({ type: 'hp', id: target.id, hp: target.hp, alive: target.alive });
    } else if (msg.type === 'respawn') {
      player.hp = 100;
      player.alive = true;
      broadcast({ type: 'hp', id, hp: 100, alive: true });
    } else if (msg.type === 'resetZone') {
      zoneRadius = 220;
      broadcast({ type: 'zone', radius: zoneRadius });
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ type: 'leave', id });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kwangwoon Winter Survival Server running on http://0.0.0.0:${PORT}`);
});
