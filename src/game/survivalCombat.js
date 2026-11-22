import * as THREE from 'three';
import { getTerrainHeight } from '../map/terrain.js';
import { createPlayerAvatar } from './playerAvatar.js';

export const WEAPON_CATALOG = {
  // 4. 맨손
  hands: { slot: 4, name: '맨손', icon: '🧤', speed: 34, gravity: 15, damage: 30, cooldown: 0.35, ammoCost: 0, radius: 0.3, color: '#ffffff' },
  // 1. 주총 5종 (각 100발 탄창, 탄약은 눈덩이)
  rifle: { slot: 1, name: '아이스 AR (라이플)', icon: '🔫', speed: 112, gravity: 4.5, damage: 22, cooldown: 0.11, ammoCost: 1, radius: 0.22, color: '#e0f2fe' },
  shotgun: { slot: 1, name: '눈대포 (샷건)', icon: '💥', speed: 90, gravity: 7.0, damage: 16, pellets: 6, spread: 0.14, cooldown: 0.68, ammoCost: 3, radius: 0.2, color: '#ffffff' },
  dmr: { slot: 1, name: '고드름 SKS (DMR)', icon: '🎯', speed: 135, gravity: 2.8, damage: 42, cooldown: 0.28, ammoCost: 1, radius: 0.22, color: '#bae6fd' },
  sr: { slot: 1, name: '얼음 AWM (SR)', icon: '🔭', speed: 175, gravity: 1.2, damage: 85, cooldown: 1.05, ammoCost: 1, radius: 0.25, color: '#7dd3fc' },
  concept: { slot: 1, name: '제설 바주카 (컨셉총)', icon: '🚀', speed: 58, gravity: 9.0, damage: 65, splash: 9, cooldown: 0.85, ammoCost: 1, radius: 0.55, color: '#fef08a' },
  // 2. 보조무기 3종
  watergun: { slot: 2, name: '네온 물총', icon: '💦', speed: 88, gravity: 6.5, damage: 18, cooldown: 0.16, ammoCost: 1, radius: 0.2, color: '#38bdf8' },
  revolver: { slot: 2, name: '황금 리볼버', icon: '🤠', speed: 108, gravity: 4.0, damage: 40, cooldown: 0.42, ammoCost: 1, radius: 0.24, color: '#fef9c3' },
  slingshot: { slot: 2, name: '새총 슈터', icon: '🏹', speed: 72, gravity: 11.0, damage: 34, bounce: true, cooldown: 0.36, ammoCost: 1, radius: 0.28, color: '#f8fafc' },
  // 3. 눈광탄
  flashbang: { slot: 3, name: '눈광탄', icon: '⚡', speed: 30, gravity: 18, damage: 12, splash: 16, fuse: 1.1, cooldown: 0.65, ammoCost: 1, radius: 0.32, color: '#e2e8f0' },
};

const PRIMARY_KEYS = ['rifle', 'shotgun', 'dmr', 'sr', 'concept'];
const SIDEARM_KEYS = ['watergun', 'revolver', 'slingshot'];

function createSnowmanNPC(isSanta = false) {
  const group = new THREE.Group();
  const snowMat = new THREE.MeshLambertMaterial({ color: '#f4f8fc' });
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
  const { onStatsChange, onPlayerHit, onFlashbang, onFeed, onWeaponModelChange, onSpeedBoost } = callbacks;

  const projectiles = [];
  const effects = [];
  const drops = [];
  const snowmen = [];
  const bots = [];
  const remotePlayers = new Map();

  // Start UNARMED (4번 맨손) with 0 guns! Must scoop snow & defeat snowmen for PUBG loot!
  let activeSlot = 4;
  const slots = {
    1: null, // { key, mag: 100 }
    2: null, // { key, mag: 100 }
    3: { key: 'flashbang' },
    4: { key: 'hands' },
  };

  const inventory = {
    snowballs: 0, // Shared snowball ammo pouch (also thrown in hands mode)
    flashbangs: 0,
    medkits: 0,
    drinks: 0,
    helmet: 0, // 0..3뚝
    vest: 0,   // 0..3갑
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
        for (const rp of msg.roster || []) addRemotePlayer(rp);
        onFeed?.(`🌐 ${msg.name}님 접속 완료`);
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
      } else if (msg.type === 'throw') {
        spawnProjectile(
          new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z),
          new THREE.Vector3(msg.dir.x, msg.dir.y, msg.dir.z),
          msg.weapon,
          false,
          msg.id
        );
      } else if (msg.type === 'damaged') {
        applyIncomingDamage(msg.damage || 18);
      } else if (msg.type === 'eliminated') {
        onFeed?.(`💀 ${msg.killerName} → ${msg.victimName} 처치!`);
        if (msg.victimId === myId) {
          handlePlayerDeath('라이벌에게 쓰러졌습니다!');
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
    remotePlayers.set(rp.id, { ...rp, tx: rp.x, ty: rp.y, tz: rp.z, avatar });
  }

  function removeRemotePlayer(id) {
    const rp = remotePlayers.get(id);
    if (rp) {
      scene.remove(rp.avatar.group);
      remotePlayers.delete(id);
    }
  }

  function getDamageReduction() {
    const helmRed = [0, 0.15, 0.25, 0.35][inventory.helmet] || 0;
    const vestRed = [0, 0.15, 0.25, 0.35][inventory.vest] || 0;
    return Math.min(0.65, helmRed + vestRed);
  }

  function applyIncomingDamage(rawDmg) {
    if (!alive) return;
    const dmg = Math.max(2, rawDmg * (1 - getDamageReduction()));
    playerHp = Math.max(0, playerHp - dmg);
    onPlayerHit?.();
    if (playerHp <= 0) {
      handlePlayerDeath('체력이 소진되었습니다!');
    }
    notify();
  }

  function handlePlayerDeath(reason) {
    alive = false;
    onFeed?.(`💀 ${reason} 3초 후 부활합니다...`);
    setTimeout(() => {
      playerHp = 100;
      alive = true;
      ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'respawn' }));
      notify();
    }, 3000);
  }

  // Spawn 14 Snowmen NPCs across campus
  const snowmanSpots = [
    [16, -18], [34, -5], [-10, -15], [52, -32], [-28, 12], [18, 35],
    [45, 25], [-40, -45], [65, -45], [0, -65], [-65, 15], [115, -10],
    [2, 5], [-18, 22],
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
      hp: 50,
      alive: true,
      respawnTimer: 0,
      stunTimer: 0,
      wanderTimer: 0,
    });
  });

  // Spawn 3 AI Rival Bots
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
      fireCooldown: 1.8,
      wanderTimer: 0,
      walkPhase: 0,
    });
  });

  function spawnPubgDrop(x, z) {
    const roll = Math.random();
    let drop;
    if (roll < 0.34) {
      const key = PRIMARY_KEYS[Math.floor(Math.random() * PRIMARY_KEYS.length)];
      drop = { category: 'primary', key, label: `${WEAPON_CATALOG[key].icon} ${WEAPON_CATALOG[key].name} (100발)`, color: '#f97316' };
    } else if (roll < 0.56) {
      const key = SIDEARM_KEYS[Math.floor(Math.random() * SIDEARM_KEYS.length)];
      drop = { category: 'sidearm', key, label: `${WEAPON_CATALOG[key].icon} ${WEAPON_CATALOG[key].name} (100발)`, color: '#06b6d4' };
    } else if (roll < 0.70) {
      const lv = Math.random() < 0.5 ? 1 : Math.random() < 0.75 ? 2 : 3;
      drop = { category: 'helmet', level: lv, label: `🪖 ${lv}뚝배기`, color: '#a855f7' };
    } else if (roll < 0.82) {
      const lv = Math.random() < 0.5 ? 1 : Math.random() < 0.75 ? 2 : 3;
      drop = { category: 'vest', level: lv, label: `🦺 ${lv}갑옷`, color: '#8b5cf6' };
    } else if (roll < 0.90) {
      drop = { category: 'flashbang', label: '⚡ 눈광탄 +2', color: '#38bdf8' };
    } else if (roll < 0.95) {
      drop = { category: 'medkit', label: '💊 구급물약 +1', color: '#ef4444' };
    } else {
      drop = { category: 'drink', label: '🥤 에너지 드링크 +1', color: '#22c55e' };
    }

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.6, 0.95),
      new THREE.MeshBasicMaterial({ color: drop.color })
    );
    const y = getTerrainHeight(x, z) + 0.65;
    box.position.set(x, y, z);
    scene.add(box);
    drops.push({ mesh: box, drop, x, z, baseY: y, age: 0 });
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
    const spec = WEAPON_CATALOG[weaponKey] || WEAPON_CATALOG.hands;
    const count = spec.pellets || 1;
    for (let i = 0; i < count; i++) {
      const d = dir.clone().normalize();
      if (spec.spread) {
        d.x += (Math.random() - 0.5) * spec.spread;
        d.y += (Math.random() - 0.5) * spec.spread * 0.6;
        d.z += (Math.random() - 0.5) * spec.spread;
        d.normalize();
      }
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(spec.radius, 8, 8),
        new THREE.MeshBasicMaterial({ color: spec.color })
      );
      mesh.position.copy(origin).addScaledVector(d, 0.9);
      scene.add(mesh);

      const vel = d.multiplyScalar(spec.speed);
      if (weaponKey === 'flashbang' || weaponKey === 'hands' || weaponKey === 'slingshot') {
        vel.y += weaponKey === 'flashbang' ? 6.5 : 2.5;
      }

      projectiles.push({ mesh, vel, weaponKey, spec, fromPlayer, ownerId, age: 0 });
    }
  }

  function scoopSnow() {
    inventory.snowballs += 1;
    onFeed?.(`❄️ 눈덩이 뭉침! (보유: ${inventory.snowballs}개)`);
    notify();
  }

  function reloadActiveGun() {
    const slotObj = slots[activeSlot];
    if (!slotObj || (activeSlot !== 1 && activeSlot !== 2)) return;
    if (inventory.snowballs <= 0) {
      onFeed?.('⚠️ 눈덩이가 없습니다! 4번 맨손으로 바닥 눈을 뭉치세요.');
      return;
    }
    const needed = 100 - slotObj.mag;
    if (needed <= 0) return;
    const transfer = Math.min(needed, inventory.snowballs);
    slotObj.mag += transfer;
    inventory.snowballs -= transfer;
    onFeed?.(`🔄 ${WEAPON_CATALOG[slotObj.key].name} 재장전 (+${transfer}발)`);
    notify();
  }

  function useItem(itemType) {
    if (itemType === 'medkit') {
      if (inventory.medkits <= 0 || playerHp >= 100) return;
      inventory.medkits--;
      playerHp = Math.min(100, playerHp + 60);
      onFeed?.('💊 구급물약 사용! (HP +60)');
    } else if (itemType === 'drink') {
      if (inventory.drinks <= 0) return;
      inventory.drinks--;
      playerHp = Math.min(100, playerHp + 35);
      onSpeedBoost?.(15);
      onFeed?.('🥤 에너지 드링크 사용! (HP +35 & 이속 증가 15초)');
    }
    notify();
  }

  function selectSlot(slotNum) {
    if (slotNum === 1 && !slots[1]) {
      onFeed?.('⚠️ 주총이 없습니다! 눈사람을 잡아 파밍하세요.');
      return;
    }
    if (slotNum === 2 && !slots[2]) {
      onFeed?.('⚠️ 보조무기가 없습니다! 눈사람을 잡아 파밍하세요.');
      return;
    }
    activeSlot = slotNum;
    const key = slots[slotNum]?.key || 'hands';
    onWeaponModelChange?.(key);
    notify();
  }

  function fireActiveSlot(origin, dir, aimingDownAtSnow = false) {
    if (!alive) return false;
    const now = performance.now() / 1000;

    // 4번 맨손: 바닥을 조준하면 눈 뭉치기, 정면 조준 시 모은 눈덩이 던지기!
    if (activeSlot === 4) {
      if (aimingDownAtSnow || inventory.snowballs <= 0) {
        if (now - lastFireTime < 0.28) return false;
        lastFireTime = now;
        scoopSnow();
        return true;
      }
      if (now - lastFireTime < WEAPON_CATALOG.hands.cooldown) return false;
      lastFireTime = now;
      inventory.snowballs--;
      spawnProjectile(origin, dir, 'hands', true, myId);
      notify();
      return true;
    }

    // 3번 눈광탄
    if (activeSlot === 3) {
      if (inventory.flashbangs <= 0) {
        onFeed?.('⚠️ 눈광탄이 없습니다! 눈사람을 잡아 획득하세요.');
        return false;
      }
      if (now - lastFireTime < WEAPON_CATALOG.flashbang.cooldown) return false;
      lastFireTime = now;
      inventory.flashbangs--;
      spawnProjectile(origin, dir, 'flashbang', true, myId);
      notify();
      return true;
    }

    // 1번 주총 / 2번 보조무기
    const slotObj = slots[activeSlot];
    if (!slotObj) return false;
    const spec = WEAPON_CATALOG[slotObj.key];
    if (now - lastFireTime < spec.cooldown) return false;

    if (slotObj.mag < spec.ammoCost) {
      onFeed?.('⚠️ 탄창 부족! [R]키로 눈덩이를 재장전하거나 4번으로 눈을 뭉치세요.');
      return false;
    }

    lastFireTime = now;
    slotObj.mag -= spec.ammoCost;
    spawnProjectile(origin, dir, slotObj.key, true, myId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'throw',
        weapon: slotObj.key,
        origin: { x: origin.x, y: origin.y, z: origin.z },
        dir: { x: dir.x, y: dir.y, z: dir.z },
      }));
    }
    notify();
    return true;
  }

  function explodeOrFlash(p, playerPos) {
    const pos = p.mesh.position;
    const isFlash = p.weaponKey === 'flashbang';
    spawnEffect(pos.x, pos.y, pos.z, isFlash ? '#ffffff' : '#f97316', isFlash ? 9 : 7, isFlash ? 0.3 : 0.42);

    if (isFlash && playerPos && pos.distanceTo(playerPos) <= p.spec.splash) {
      onFlashbang?.();
    }

    for (const s of snowmen) {
      if (!s.alive) continue;
      if (Math.hypot(s.x - pos.x, s.z - pos.z) <= p.spec.splash) {
        if (isFlash) s.stunTimer = 4.0;
        else {
          s.hp -= p.spec.damage;
          if (s.hp <= 0) {
            s.alive = false;
            s.mesh.visible = false;
            s.respawnTimer = 7;
            spawnPubgDrop(s.x, s.z);
            if (p.fromPlayer) kills++;
          }
        }
      }
    }

    for (const b of bots) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - pos.x, b.z - pos.z) <= p.spec.splash) {
        if (isFlash) b.stunTimer = 4.0;
        else {
          b.hp -= p.spec.damage;
          b.avatar.updateLabel(b.name, b.hp);
          if (b.hp <= 0) {
            b.alive = false;
            b.avatar.group.visible = false;
            b.respawnTimer = 6;
            spawnPubgDrop(b.x, b.z);
            if (p.fromPlayer) kills++;
          }
        }
      }
    }

    if (p.fromPlayer && !isFlash && ws && ws.readyState === 1) {
      for (const [id, rp] of remotePlayers.entries()) {
        if (!rp.alive) continue;
        if (Math.hypot(rp.tx - pos.x, rp.tz - pos.z) <= p.spec.splash) {
          ws.send(JSON.stringify({ type: 'hit', targetId: id, damage: p.spec.damage }));
        }
      }
    }
    notify();
  }

  function notify() {
    onStatsChange({
      playerHp,
      kills,
      activeSlot,
      slots: {
        1: slots[1] ? { ...slots[1], meta: WEAPON_CATALOG[slots[1].key] } : null,
        2: slots[2] ? { ...slots[2], meta: WEAPON_CATALOG[slots[2].key] } : null,
        3: { key: 'flashbang', meta: WEAPON_CATALOG.flashbang, count: inventory.flashbangs },
        4: { key: 'hands', meta: WEAPON_CATALOG.hands, count: inventory.snowballs },
      },
      inventory: { ...inventory },
      survivors: 1 + bots.filter((b) => b.alive).length + Array.from(remotePlayers.values()).filter((r) => r.alive).length,
      zoneRadius: Math.round(zoneRadius),
    });
  }

  function reset() {
    playerHp = 100;
    alive = true;
    kills = 0;
    slots[1] = null;
    slots[2] = null;
    activeSlot = 4;
    inventory.snowballs = 0;
    inventory.flashbangs = 0;
    inventory.medkits = 0;
    inventory.drinks = 0;
    inventory.helmet = 0;
    inventory.vest = 0;
    zoneRadius = 220;
    onWeaponModelChange?.('hands');
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'respawn' }));
      ws.send(JSON.stringify({ type: 'resetZone' }));
    }
    notify();
  }

  function update(dt, playerPos, playerYaw, isFirstPerson) {
    if (!ws || ws.readyState !== 1) {
      if (zoneRadius > 28) zoneRadius = Math.max(28, zoneRadius - 1.2 * dt);
    }
    zoneMesh.scale.set(zoneRadius, 1, zoneRadius);

    if (isFirstPerson && alive && playerPos) {
      const distFromCenter = Math.hypot(playerPos.x - 20, playerPos.z + 10);
      if (distFromCenter > zoneRadius) {
        applyIncomingDamage(7 * dt);
      }
    }

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

    // Loot pickups
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += dt;
      d.mesh.rotation.y += 2.2 * dt;
      d.mesh.position.y = d.baseY + Math.sin(d.age * 3.5) * 0.18;

      if (isFirstPerson && alive && playerPos && Math.hypot(playerPos.x - d.x, playerPos.z - d.z) < 2.8) {
        const item = d.drop;
        if (item.category === 'primary') {
          slots[1] = { key: item.key, mag: 100 };
          selectSlot(1);
        } else if (item.category === 'sidearm') {
          slots[2] = { key: item.key, mag: 100 };
          selectSlot(2);
        } else if (item.category === 'helmet') {
          inventory.helmet = Math.max(inventory.helmet, item.level);
        } else if (item.category === 'vest') {
          inventory.vest = Math.max(inventory.vest, item.level);
        } else if (item.category === 'flashbang') {
          inventory.flashbangs += 2;
        } else if (item.category === 'medkit') {
          inventory.medkits += 1;
        } else if (item.category === 'drink') {
          inventory.drinks += 1;
        }
        onFeed?.(`🎁 ${item.label} 획득!`);
        scene.remove(d.mesh);
        drops.splice(i, 1);
        notify();
      }
    }

    // Snowmen
    for (const s of snowmen) {
      if (!s.alive) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0) {
          s.hp = 50;
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
        s.vx = Math.cos(a) * 2.4;
        s.vz = Math.sin(a) * 2.4;
        s.wanderTimer = 2 + Math.random() * 2;
      }
      s.x = Math.max(-160, Math.min(160, s.x + s.vx * dt));
      s.z = Math.max(-140, Math.min(140, s.z + s.vz * dt));
      s.mesh.position.set(s.x, getTerrainHeight(s.x, s.z), s.z);
      s.mesh.rotation.y = Math.atan2(s.vx, s.vz);
    }

    // AI Bots
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
        b.vx = Math.cos(a) * 4.2;
        b.vz = Math.sin(a) * 4.2;
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
        if (dist < 44) {
          b.avatar.group.rotation.y = Math.atan2(dx, dz);
          b.fireCooldown -= dt;
          if (b.fireCooldown <= 0) {
            b.fireCooldown = 1.4 + Math.random() * 1.2;
            const origin = new THREE.Vector3(b.x, by + 1.5, b.z);
            const dir = playerPos.clone().sub(origin).normalize();
            dir.x += (Math.random() - 0.5) * 0.1;
            dir.z += (Math.random() - 0.5) * 0.1;
            spawnProjectile(origin, dir, 'watergun', false, b.id);
          }
        } else {
          b.avatar.group.rotation.y = Math.atan2(b.vx, b.vz);
        }
      } else {
        b.avatar.group.rotation.y = Math.atan2(b.vx, b.vz);
      }
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.age += dt;
      p.vel.y -= p.spec.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      const groundY = getTerrainHeight(p.mesh.position.x, p.mesh.position.z);

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

      if (p.spec.bounce && p.mesh.position.y <= groundY + 0.3 && p.vel.y < 0) {
        p.mesh.position.y = groundY + 0.3;
        p.vel.y = Math.abs(p.vel.y) * 0.65;
      }

      let hit = false;

      for (const c of world.covers || []) {
        if (
          p.mesh.position.x >= c.minX &&
          p.mesh.position.x <= c.maxX &&
          p.mesh.position.z >= c.minZ &&
          p.mesh.position.z <= c.maxZ &&
          p.mesh.position.y <= c.topY
        ) {
          hit = true;
          spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#ffffff', 1.0, 0.16);
          break;
        }
      }

      if (!hit && p.fromPlayer) {
        for (const s of snowmen) {
          if (!s.alive) continue;
          const sy = getTerrainHeight(s.x, s.z) + 1.4;
          if (Math.hypot(p.mesh.position.x - s.x, p.mesh.position.y - sy, p.mesh.position.z - s.z) < 1.35) {
            hit = true;
            if (p.spec.splash) {
              explodeOrFlash(p, playerPos);
            } else {
              s.hp -= p.spec.damage;
              spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#ffffff', 1.4, 0.2);
              if (s.hp <= 0) {
                s.alive = false;
                s.mesh.visible = false;
                s.respawnTimer = 7;
                spawnPubgDrop(s.x, s.z);
                kills++;
                onFeed?.('☃️ 눈사람 처치! 배그 파밍 아이템 드랍!');
              }
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
              if (p.spec.splash) {
                explodeOrFlash(p, playerPos);
              } else {
                b.hp -= p.spec.damage;
                b.avatar.updateLabel(b.name, b.hp);
                spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#ffffff', 1.4, 0.2);
                if (b.hp <= 0) {
                  b.alive = false;
                  b.avatar.group.visible = false;
                  b.respawnTimer = 6;
                  spawnPubgDrop(b.x, b.z);
                  kills++;
                  onFeed?.(`💀 ${b.name} 처치!`);
                }
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
              spawnEffect(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, '#ffffff', 1.4, 0.2);
              break;
            }
          }
        }
      } else if (!hit && isFirstPerson && alive && playerPos) {
        if (p.mesh.position.distanceTo(playerPos) < 1.15) {
          hit = true;
          applyIncomingDamage(12);
        }
      }

      if (hit || (!p.spec.bounce && p.mesh.position.y <= groundY) || p.age > 3.5) {
        if (!hit && p.spec.splash) {
          explodeOrFlash(p, playerPos);
        } else if (!hit && p.mesh.position.y <= groundY) {
          spawnEffect(p.mesh.position.x, groundY + 0.2, p.mesh.position.z, '#ffffff', 1.0, 0.16);
        }
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }

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

  // Initial sync
  notify();

  return {
    selectSlot,
    fireActiveSlot,
    reloadActiveGun,
    useItem,
    scoopSnow,
    update,
    reset,
    getActiveSlot: () => activeSlot,
    getActiveWeaponKey: () => slots[activeSlot]?.key || 'hands',
    getRadarData: () => ({
      zoneRadius,
      snowmen,
      drops,
      rivals: [
        ...bots.map((b) => ({ x: b.x, z: b.z, alive: b.alive })),
        ...Array.from(remotePlayers.values()).map((r) => ({ x: r.tx, z: r.tz, alive: r.alive })),
      ],
    }),
  };
}
