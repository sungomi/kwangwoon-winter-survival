import * as THREE from 'three';
import { getTerrainHeight } from '../map/terrain.js';
import { createPlayerAvatar } from './playerAvatar.js';

const WEAPONS = {
  pistol: { name: '눈덩이 권총', speed: 88, gravity: 7.5, damage: 26, cooldown: 0.24, color: '#ffffff', radius: 0.26 },
  rifle: { name: '눈덩이 소총', speed: 112, gravity: 4.5, damage: 20, cooldown: 0.11, color: '#e0f2fe', radius: 0.22 },
  grenade: { name: '수류탄', speed: 28, gravity: 18, damage: 85, splash: 13, fuse: 1.4, cooldown: 0.65, color: '#166534', radius: 0.35 },
  flashbang: { name: '섬광탄', speed: 30, gravity: 18, damage: 10, splash: 16, fuse: 1.1, cooldown: 0.65, color: '#e2e8f0', radius: 0.32 },
};

const DROP_META = {
  rifle: { label: '🔥 돌격소총 +30발', color: '#f97316' },
  grenade: { label: '💣 수류탄 +2', color: '#22c55e' },
  flashbang: { label: '⚡ 섬광탄 +2', color: '#38bdf8' },
  medkit: { label: '☕ 핫초코 HP +40', color: '#ef4444' },
};

function createSnowmanNPC(isSanta = false) {
  const group = new THREE.Group();
  const snowMat = new THREE.MeshLambertMaterial({ color: '#f4f8fc' });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#1f2937' });
  const accentMat = new THREE.MeshLambertMaterial({ color: isSanta ? '#d92d20' : '#2563eb' });
  const carrotMat = new THREE.MeshLambertMaterial({ color: '#f97316' });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), snowMat);
  body.position.y = 0.7;
  body.castShadow = true;
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.54, 12, 10), snowMat);
  torso.position.y = 1.65;
  torso.castShadow = true;
  const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.2, 10), accentMat);
  scarf.position.y = 2.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), snowMat);
  head.position.y = 2.38;
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), carrotMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.36, 0.44);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.65, 10), accentMat);
  hat.position.y = 2.95;

  group.add(body, torso, scarf, head, nose, hat);
  return group;
}

export function createSurvivalCombatSystem(scene, world, callbacks) {
  const { onStatsChange, onPlayerHit, onFlashbang, onFeed } = callbacks;

  const projectiles = [];
  const effects = [];
  const drops = [];
  const snowmen = [];
  const bots = [];
  const remotePlayers = new Map();

  let activeWeapon = 'pistol';
  const ammo = {
    pistol: Infinity,
    rifle: 0,
    grenade: 1,
    flashbang: 1,
  };

  let playerHp = 100;
  let kills = 0;
  let alive = true;
  let zoneRadius = 220;
  let lastFireTime = 0;
  let myId = null;

  // Blizzard Zone Cylinder Ring
  const zoneGeo = new THREE.CylinderGeometry(1, 1, 90, 48, 1, true);
  const zoneMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
  zoneMesh.position.set(20, 45, -10);
  zoneMesh.scale.set(zoneRadius, 1, zoneRadius);
  scene.add(zoneMesh);

  // WebSocket Multiplayer Client
  let ws = null;
  let netSyncTimer = 0;
  try {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}/ws`);
    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        myId = msg.id;
        zoneRadius = msg.zoneRadius ?? 220;
        for (const rp of msg.roster || []) {
          addRemotePlayer(rp);
        }
        onFeed?.(`🌐 ${msg.name}님 접속 완료 (온라인)`);
        notify();
      } else if (msg.type === 'join') {
        addRemotePlayer(msg.player);
        onFeed?.(`👤 ${msg.player.name}님 참전!`);
        notify();
      } else if (msg.type === 'leave') {
        removeRemotePlayer(msg.id);
        notify();
      } else if (msg.type === 'snapshot') {
        if (typeof msg.zoneRadius === 'number') zoneRadius = msg.zoneRadius;
        for (const s of msg.states || []) {
          if (s.id === myId) continue;
          const rp = remotePlayers.get(s.id);
          if (rp) {
            rp.tx = s.x;
            rp.ty = s.y;
            rp.tz = s.z;
            rp.yaw = s.yaw;
            rp.hp = s.hp;
            rp.alive = s.alive;
            rp.avatar.group.visible = s.alive;
          }
        }
      } else if (msg.type === 'state') {
        const rp = remotePlayers.get(msg.id);
        if (rp) {
          rp.tx = msg.x;
          rp.ty = msg.y;
          rp.tz = msg.z;
          rp.yaw = msg.yaw;
          rp.hp = msg.hp;
          rp.alive = msg.alive;
          rp.avatar.group.visible = msg.alive;
        }
      } else if (msg.type === 'throw') {
        spawnProjectile(
          new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z),
          new THREE.Vector3(msg.dir.x, msg.dir.y, msg.dir.z),
          msg.weapon,
          false,
          msg.id
        );
      } else if (msg.type === 'damaged') {
        playerHp = msg.hp;
        onPlayerHit?.();
        notify();
      } else if (msg.type === 'eliminated') {
        onFeed?.(`💀 ${msg.killerName} → ${msg.victimName} 처치!`);
        if (msg.victimId === myId) {
          playerHp = 0;
          alive = false;
          onFeed?.('❄️ 쓰러졌습니다! 3초 후 부활합니다...');
          setTimeout(() => {
            playerHp = 100;
            alive = true;
            ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'respawn' }));
            notify();
          }, 3000);
        }
        notify();
      } else if (msg.type === 'zone') {
        zoneRadius = msg.radius;
      }
    });
  } catch {
    ws = null;
  }

  function addRemotePlayer(rp) {
    if (remotePlayers.has(rp.id)) return;
    const avatar = createPlayerAvatar(rp.color, rp.name);
    avatar.group.position.set(rp.x, rp.y - 1.75, rp.z);
    scene.add(avatar.group);
    remotePlayers.set(rp.id, {
      ...rp,
      tx: rp.x,
      ty: rp.y,
      tz: rp.z,
      avatar,
    });
  }

  function removeRemotePlayer(id) {
    const rp = remotePlayers.get(id);
    if (rp) {
      scene.remove(rp.avatar.group);
      remotePlayers.delete(id);
    }
  }

  // Spawn 12 Snowmen NPCs (drop weapons & grenades!)
  const snowmanSpots = [
    [16, -18], [34, -5], [-10, -15], [52, -32], [-28, 12], [18, 35],
    [45, 25], [-40, -45], [65, -45], [0, -65], [-65, 15], [115, -10],
  ];
  snowmanSpots.forEach(([sx, sz], i) => {
    const mesh = createSnowmanNPC(i % 2 === 0);
    mesh.position.set(sx, getTerrainHeight(sx, sz), sz);
    scene.add(mesh);
    snowmen.push({
      mesh,
      x: sx,
      z: sz,
      vx: 0,
      vz: 0,
      hp: 60,
      alive: true,
      respawnTimer: 0,
      stunTimer: 0,
      wanderTimer: 0,
    });
  });

  // Spawn 3 AI Survival Rival Players (so solo play also feels like survival PvP!)
  const botConfigs = [
    { name: '라이벌-A', color: '#ef4444', x: 55, z: -20 },
    { name: '라이벌-B', color: '#3b82f6', x: -35, z: 25 },
    { name: '라이벌-C', color: '#eab308', x: 25, z: 48 },
  ];
  botConfigs.forEach((cfg) => {
    const avatar = createPlayerAvatar(cfg.color, cfg.name);
    avatar.group.position.set(cfg.x, getTerrainHeight(cfg.x, cfg.z), cfg.z);
    scene.add(avatar.group);
    bots.push({
      id: cfg.name,
      name: cfg.name,
      avatar,
      x: cfg.x,
      z: cfg.z,
      vx: 0,
      vz: 0,
      hp: 100,
      alive: true,
      respawnTimer: 0,
      stunTimer: 0,
      fireCooldown: 1.5,
      wanderTimer: 0,
      walkPhase: 0,
    });
  });

  function spawnDrop(x, z) {
    const types = ['rifle', 'grenade', 'flashbang', 'medkit'];
    const type = types[Math.floor(Math.random() * types.length)];
    const meta = DROP_META[type];

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.55, 0.85),
      new THREE.MeshBasicMaterial({ color: meta.color })
    );
    const y = getTerrainHeight(x, z) + 0.65;
    box.position.set(x, y, z);
    scene.add(box);

    drops.push({ mesh: box, type, x, z, baseY: y, age: 0 });
  }

  function spawnEffect(x, y, z, color, targetScale, duration = 0.35) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    sphere.position.set(x, y, z);
    scene.add(sphere);
    effects.push({ mesh: sphere, age: 0, maxAge: duration, targetScale });
  }

  function spawnProjectile(origin, dir, weaponKey, fromPlayer, ownerId = null) {
    const spec = WEAPONS[weaponKey] || WEAPONS.pistol;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(spec.radius, 8, 8),
      new THREE.MeshBasicMaterial({ color: spec.color })
    );
    mesh.position.copy(origin).addScaledVector(dir, 0.9);
    scene.add(mesh);

    const vel = dir.clone().normalize().multiplyScalar(spec.speed);
    if (weaponKey === 'grenade' || weaponKey === 'flashbang') {
      vel.y += 6.5;
    }

    projectiles.push({
      mesh,
      vel,
      weaponKey,
      spec,
      fromPlayer,
      ownerId,
      age: 0,
    });
  }

  function firePlayerWeapon(origin, dir) {
    if (!alive) return;
    const now = performance.now() / 1000;
    const spec = WEAPONS[activeWeapon];
    if (now - lastFireTime < spec.cooldown) return;

    if (ammo[activeWeapon] <= 0) {
      onFeed?.(`⚠️ ${spec.name} 탄약이 부족합니다! 눈사람을 잡아 보급받으세요.`);
      activeWeapon = 'pistol';
      notify();
      return;
    }

    lastFireTime = now;
    if (ammo[activeWeapon] !== Infinity) {
      ammo[activeWeapon]--;
      if (ammo[activeWeapon] === 0 && activeWeapon !== 'pistol') {
        activeWeapon = 'pistol';
      }
      notify();
    }

    spawnProjectile(origin, dir, activeWeapon, true, myId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'throw',
        weapon: activeWeapon,
        origin: { x: origin.x, y: origin.y, z: origin.z },
        dir: { x: dir.x, y: dir.y, z: dir.z },
      }));
    }
  }

  function explodeOrFlash(p, playerPos) {
    const pos = p.mesh.position;
    const isFlash = p.weaponKey === 'flashbang';
    spawnEffect(
      pos.x,
      pos.y,
      pos.z,
      isFlash ? '#ffffff' : '#ff6b00',
      isFlash ? 9 : 7,
      isFlash ? 0.3 : 0.45
    );

    if (isFlash && playerPos && pos.distanceTo(playerPos) <= p.spec.splash) {
      onFlashbang?.();
    }

    // Affect snowmen
    for (const s of snowmen) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - pos.x, s.z - pos.z);
      if (d <= p.spec.splash) {
        if (isFlash) {
          s.stunTimer = 4.0;
        } else {
          s.hp -= p.spec.damage;
          if (s.hp <= 0) {
            s.alive = false;
            s.mesh.visible = false;
            s.respawnTimer = 7;
            spawnDrop(s.x, s.z);
            if (p.fromPlayer) {
              kills++;
              onFeed?.('☃️ 눈사람 처치! 보급 아이템이 드랍되었습니다.');
            }
          }
        }
      }
    }

    // Affect AI bots
    for (const b of bots) {
      if (!b.alive) continue;
      const d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d <= p.spec.splash) {
        if (isFlash) {
          b.stunTimer = 4.0;
        } else {
          b.hp -= p.spec.damage;
          b.avatar.updateLabel(b.name, b.hp);
          if (b.hp <= 0) {
            b.alive = false;
            b.avatar.group.visible = false;
            b.respawnTimer = 6;
            spawnDrop(b.x, b.z);
            if (p.fromPlayer) {
              kills++;
              onFeed?.(`💀 ${b.name} 처치!`);
            }
          }
        }
      }
    }

    // Affect remote multiplayer players (if fired by local player)
    if (p.fromPlayer && !isFlash && ws && ws.readyState === 1) {
      for (const [id, rp] of remotePlayers.entries()) {
        if (!rp.alive) continue;
        const d = Math.hypot(rp.tx - pos.x, rp.tz - pos.z);
        if (d <= p.spec.splash) {
          ws.send(JSON.stringify({ type: 'hit', targetId: id, damage: p.spec.damage }));
        }
      }
    }
    notify();
  }

  function setWeapon(w) {
    if (!WEAPONS[w]) return;
    if (ammo[w] <= 0) {
      onFeed?.(`⚠️ ${WEAPONS[w].name} 없음! 눈사람을 처치해 획득하세요.`);
      return;
    }
    activeWeapon = w;
    notify();
  }

  function notify() {
    onStatsChange({
      playerHp,
      kills,
      activeWeapon,
      ammo: { ...ammo },
      survivors: 1 + bots.filter((b) => b.alive).length + Array.from(remotePlayers.values()).filter((r) => r.alive).length,
      zoneRadius: Math.round(zoneRadius),
    });
  }

  function reset() {
    playerHp = 100;
    alive = true;
    kills = 0;
    ammo.rifle = 0;
    ammo.grenade = 1;
    ammo.flashbang = 1;
    activeWeapon = 'pistol';
    zoneRadius = 220;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'respawn' }));
      ws.send(JSON.stringify({ type: 'resetZone' }));
    }
    notify();
  }

  function update(dt, playerPos, playerYaw, isFirstPerson) {
    // Update Blizzard Zone ring
    if (!ws || ws.readyState !== 1) {
      if (zoneRadius > 28) zoneRadius = Math.max(28, zoneRadius - 1.2 * dt);
    }
    zoneMesh.scale.set(zoneRadius, 1, zoneRadius);

    // Blizzard outside damage
    if (isFirstPerson && alive && playerPos) {
      const distFromCenter = Math.hypot(playerPos.x - 20, playerPos.z + 10);
      if (distFromCenter > zoneRadius) {
        playerHp = Math.max(0, playerHp - 7 * dt);
        onPlayerHit?.();
        if (playerHp <= 0) {
          alive = false;
          onFeed?.('🥶 눈보라에 쓰러졌습니다! 3초 후 부활...');
          setTimeout(() => {
            playerHp = 100;
            alive = true;
            notify();
          }, 3000);
        }
        notify();
      }
    }

    // Sync local player state over WebSocket
    netSyncTimer += dt;
    if (ws && ws.readyState === 1 && playerPos && netSyncTimer >= 0.06) {
      netSyncTimer = 0;
      ws.send(JSON.stringify({
        type: 'move',
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        yaw: playerYaw || 0,
        hp: playerHp,
        alive,
      }));
    }

    // Interpolate remote players (hide if overlapping local camera to prevent near-plane clipping)
    for (const rp of remotePlayers.values()) {
      rp.avatar.group.position.x += (rp.tx - rp.avatar.group.position.x) * 0.25;
      rp.avatar.group.position.y += (rp.ty - 1.75 - rp.avatar.group.position.y) * 0.25;
      rp.avatar.group.position.z += (rp.tz - rp.avatar.group.position.z) * 0.25;
      rp.avatar.group.rotation.y = rp.yaw + Math.PI;
      if (rp.alive && isFirstPerson && playerPos) {
        const d = Math.hypot(rp.avatar.group.position.x - playerPos.x, rp.avatar.group.position.z - playerPos.z);
        rp.avatar.group.visible = d > 0.9;
      }
    }

    // Update loot drops & pickup
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += dt;
      d.mesh.rotation.y += 2.2 * dt;
      d.mesh.position.y = d.baseY + Math.sin(d.age * 3.5) * 0.18;

      if (isFirstPerson && alive && playerPos) {
        const dist = Math.hypot(playerPos.x - d.x, playerPos.z - d.z);
        if (dist < 2.8) {
          if (d.type === 'rifle') ammo.rifle += 30;
          else if (d.type === 'grenade') ammo.grenade += 2;
          else if (d.type === 'flashbang') ammo.flashbang += 2;
          else if (d.type === 'medkit') playerHp = Math.min(100, playerHp + 40);

          onFeed?.(`🎁 ${DROP_META[d.type].label} 획득!`);
          scene.remove(d.mesh);
          drops.splice(i, 1);
          notify();
        }
      }
    }

    // Update Snowmen NPCs
    for (const s of snowmen) {
      if (!s.alive) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0) {
          s.hp = 60;
          s.alive = true;
          s.mesh.visible = true;
        }
        continue;
      }
      if (s.stunTimer > 0) {
        s.stunTimer -= dt;
        continue;
      }
      s.wanderTimer -= dt;
      if (s.wanderTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        s.vx = Math.cos(a) * 2.5;
        s.vz = Math.sin(a) * 2.5;
        s.wanderTimer = 2 + Math.random() * 2;
      }
      s.x = Math.max(-160, Math.min(160, s.x + s.vx * dt));
      s.z = Math.max(-140, Math.min(140, s.z + s.vz * dt));
      s.mesh.position.set(s.x, getTerrainHeight(s.x, s.z), s.z);
      s.mesh.rotation.y = Math.atan2(s.vx, s.vz);
    }

    // Update AI Rival Bots
    for (const b of bots) {
      if (!b.alive) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) {
          b.hp = 100;
          b.alive = true;
          b.avatar.group.visible = true;
          b.avatar.updateLabel(b.name, 100);
        }
        continue;
      }
      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        continue;
      }
      b.wanderTimer -= dt;
      if (b.wanderTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        b.vx = Math.cos(a) * 4.5;
        b.vz = Math.sin(a) * 4.5;
        b.wanderTimer = 1.8 + Math.random() * 2;
      }
      b.x = Math.max(-140, Math.min(140, b.x + b.vx * dt));
      b.z = Math.max(-120, Math.min(120, b.z + b.vz * dt));
      const by = getTerrainHeight(b.x, b.z);
      b.avatar.group.position.set(b.x, by, b.z);
      b.walkPhase += dt * 8;
      b.avatar.leftLeg.rotation.x = Math.sin(b.walkPhase) * 0.45;
      b.avatar.rightLeg.rotation.x = -Math.sin(b.walkPhase) * 0.45;

      if (isFirstPerson && alive && playerPos) {
        const dx = playerPos.x - b.x;
        const dz = playerPos.z - b.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 46) {
          b.avatar.group.rotation.y = Math.atan2(dx, dz);
          b.fireCooldown -= dt;
          if (b.fireCooldown <= 0) {
            b.fireCooldown = 1.2 + Math.random() * 1.2;
            const origin = new THREE.Vector3(b.x, by + 1.5, b.z);
            const dir = playerPos.clone().sub(origin).normalize();
            dir.x += (Math.random() - 0.5) * 0.08;
            dir.z += (Math.random() - 0.5) * 0.08;
            spawnProjectile(origin, dir, 'pistol', false, b.id);
          }
        } else {
          b.avatar.group.rotation.y = Math.atan2(b.vx, b.vz);
        }
      } else {
        b.avatar.group.rotation.y = Math.atan2(b.vx, b.vz);
      }
    }

    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.age += dt;
      p.vel.y -= p.spec.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      const groundY = getTerrainHeight(p.mesh.position.x, p.mesh.position.z);

      // Fuse weapons (Grenade / Flashbang)
      if (p.spec.fuse) {
        if (p.mesh.position.y <= groundY + 0.3) {
          p.mesh.position.y = groundY + 0.3;
          p.vel.y *= -0.4;
          p.vel.x *= 0.6;
          p.vel.z *= 0.6;
        }
        if (p.age >= p.spec.fuse) {
          explodeOrFlash(p, playerPos);
          scene.remove(p.mesh);
          projectiles.splice(i, 1);
        }
        continue;
      }

      // Direct bullets (Pistol / Rifle)
      let hit = false;

      // Check cover obstacle collision (bullets stop on barricades, crates, snowmounds, planters)
      for (const c of world.covers || []) {
        if (
          p.mesh.position.x >= c.minX &&
          p.mesh.position.x <= c.maxX &&
          p.mesh.position.z >= c.minZ &&
          p.mesh.position.z <= c.maxZ &&
          p.mesh.position.y <= c.topY
        ) {
          hit = true;
          spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#e2e8f0', 0.9, 0.15);
          break;
        }
      }

      if (!hit && p.fromPlayer) {
        for (const s of snowmen) {
          if (!s.alive) continue;
          const sy = getTerrainHeight(s.x, s.z) + 1.4;
          if (Math.hypot(p.mesh.position.x - s.x, p.mesh.position.y - sy, p.mesh.position.z - s.z) < 1.35) {
            hit = true;
            s.hp -= p.spec.damage;
            spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#ffffff', 1.5, 0.2);
            if (s.hp <= 0) {
              s.alive = false;
              s.mesh.visible = false;
              s.respawnTimer = 7;
              spawnDrop(s.x, s.z);
              kills++;
              onFeed?.('☃️ 눈사람 처치! 무기/수류탄 드랍!');
            }
            notify();
            break;
          }
        }
        if (!hit) {
          for (const b of bots) {
            if (!b.alive) continue;
            const by = getTerrainHeight(b.x, b.z) + 1.1;
            if (Math.hypot(p.mesh.position.x - b.x, p.mesh.position.y - by, p.mesh.position.z - b.z) < 1.1) {
              hit = true;
              b.hp -= p.spec.damage;
              b.avatar.updateLabel(b.name, b.hp);
              spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#ef4444', 1.4, 0.2);
              if (b.hp <= 0) {
                b.alive = false;
                b.avatar.group.visible = false;
                b.respawnTimer = 6;
                spawnDrop(b.x, b.z);
                kills++;
                onFeed?.(`💀 ${b.name} 처치!`);
              }
              notify();
              break;
            }
          }
        }
        if (!hit && ws && ws.readyState === 1) {
          for (const [id, rp] of remotePlayers.entries()) {
            if (!rp.alive) continue;
            if (Math.hypot(p.mesh.position.x - rp.tx, p.mesh.position.y - (rp.ty - 0.5), p.mesh.position.z - rp.tz) < 1.1) {
              hit = true;
              ws.send(JSON.stringify({ type: 'hit', targetId: id, damage: p.spec.damage }));
              spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#ef4444', 1.4, 0.2);
              break;
            }
          }
        }
      } else if (!hit && isFirstPerson && alive && playerPos) {
        if (p.mesh.position.distanceTo(playerPos) < 1.15) {
          hit = true;
          playerHp = Math.max(0, playerHp - 12);
          onPlayerHit?.();
          if (playerHp <= 0) {
            alive = false;
            onFeed?.('💀 라이벌에게 쓰러졌습니다! 3초 후 부활...');
            setTimeout(() => {
              playerHp = 100;
              alive = true;
              notify();
            }, 3000);
          }
          notify();
        }
      }

      if (hit || p.mesh.position.y <= groundY || p.age > 3.5) {
        if (!hit && p.mesh.position.y <= groundY) {
          spawnEffect(p.mesh.position.x, groundY + 0.2, p.mesh.position.z, '#ffffff', 1.1, 0.18);
        }
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }

    // Update effects
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.age += dt;
      const t = e.age / e.maxAge;
      if (t >= 1) {
        scene.remove(e.mesh);
        effects.splice(i, 1);
        continue;
      }
      e.mesh.scale.setScalar(1 + t * e.targetScale);
      e.mesh.material.opacity = (1 - t) * 0.9;
    }
  }

  return {
    setWeapon,
    firePlayerWeapon,
    update,
    reset,
    getActiveWeapon: () => activeWeapon,
  };
}
