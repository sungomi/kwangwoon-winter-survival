import * as THREE from 'three';
import { getTerrainHeight, MAX_STEP_UP } from '../map/terrain.js';
import { createPlayerAvatar } from './playerAvatar.js';
import { buildLootVisual, buildAirdropModel, buildPlaneModel } from './itemModels.js';
import { mergeByMaterial } from '../utils/mergeByMaterial.js';

/* ============================== Weapon catalog ============================== */
// mag = magazine size, reload = seconds, auto = hold to fire. All guns fire packed snow (공용 눈덩이 탄약).
export const WEAPON_CATALOG = {
  hands: { slot: 4, name: '맨손 (눈덩이)', short: '맨손', icon: '🧤', speed: 34, gravity: 15, damage: 24, cooldown: 0.4, radius: 0.3, color: '#ffffff', range: 30 },

  rifle: { slot: 1, rarity: 'common', name: '아이스 AR', short: 'AR', icon: '🔫', speed: 120, gravity: 4.5, damage: 19, cooldown: 0.105, mag: 30, reload: 2.1, auto: true, spread: 0.012, radius: 0.16, color: '#e0f2fe', recoil: 0.035, range: 70 },
  smg: { slot: 1, rarity: 'common', name: '눈송이 SMG', short: 'SMG', icon: '❄️', speed: 105, gravity: 5.5, damage: 14, cooldown: 0.075, mag: 35, reload: 1.7, auto: true, spread: 0.022, radius: 0.14, color: '#f0f9ff', recoil: 0.025, range: 45 },
  shotgun: { slot: 1, rarity: 'common', name: '눈대포 샷건', short: 'SG', icon: '💥', speed: 92, gravity: 7.0, damage: 13, pellets: 8, spread: 0.13, cooldown: 0.85, mag: 5, reload: 2.6, radius: 0.15, color: '#ffffff', recoil: 0.11, range: 22 },
  lmg: { slot: 1, rarity: 'rare', name: '제설기 LMG', short: 'LMG', icon: '🌨️', speed: 118, gravity: 4.8, damage: 18, cooldown: 0.09, mag: 60, reload: 3.6, auto: true, spread: 0.02, radius: 0.16, color: '#dbeafe', recoil: 0.03, range: 75 },
  dmr: { slot: 1, rarity: 'rare', name: '고드름 DMR', short: 'DMR', icon: '🎯', speed: 150, gravity: 2.6, damage: 41, cooldown: 0.3, mag: 10, reload: 2.4, radius: 0.16, color: '#bae6fd', recoil: 0.07, range: 120, zoom: 34 },
  crossbow: { slot: 1, rarity: 'rare', name: '고드름 석궁', short: 'XBOW', icon: '🏹', speed: 95, gravity: 6.0, damage: 92, cooldown: 0.4, mag: 1, reload: 2.8, radius: 0.18, color: '#a5f3fc', recoil: 0.05, range: 90, zoom: 40, bolt: true },
  sr: { slot: 1, rarity: 'legendary', name: '빙하 저격총', short: 'SR', icon: '🔭', speed: 210, gravity: 1.0, damage: 96, cooldown: 1.3, mag: 5, reload: 3.4, radius: 0.18, color: '#7dd3fc', recoil: 0.14, range: 220, zoom: 18 },
  concept: { slot: 1, rarity: 'legendary', name: '제설 바주카', short: 'RPG', icon: '🚀', speed: 60, gravity: 8.0, damage: 75, splash: 8, cooldown: 1.2, mag: 2, reload: 3.8, radius: 0.4, color: '#fde68a', recoil: 0.18, range: 70 },

  pistol: { slot: 2, rarity: 'common', name: '손난로 권총', short: 'P', icon: '🔥', speed: 100, gravity: 5.0, damage: 20, cooldown: 0.2, mag: 15, reload: 1.5, radius: 0.13, color: '#fed7aa', recoil: 0.04, range: 40 },
  watergun: { slot: 2, rarity: 'common', name: '네온 물총', short: 'WATER', icon: '💦', speed: 88, gravity: 6.5, damage: 11, cooldown: 0.09, mag: 40, reload: 1.8, auto: true, spread: 0.03, radius: 0.13, color: '#38bdf8', recoil: 0.012, range: 32 },
  revolver: { slot: 2, rarity: 'rare', name: '황금 리볼버', short: 'REV', icon: '🤠', speed: 120, gravity: 4.0, damage: 44, cooldown: 0.5, mag: 6, reload: 2.6, radius: 0.15, color: '#fef9c3', recoil: 0.09, range: 55 },
  slingshot: { slot: 2, rarity: 'common', name: '새총', short: 'SLING', icon: '🪃', speed: 74, gravity: 11.0, damage: 32, bounce: true, cooldown: 0.5, mag: 8, reload: 1.4, radius: 0.2, color: '#f8fafc', recoil: 0.03, range: 35 },

  flashbang: { slot: 3, name: '눈광탄', short: 'FLASH', icon: '⚡', speed: 28, gravity: 18, damage: 0, splash: 14, fuse: 1.6, cooldown: 0.8, radius: 0.2, color: '#e2e8f0' },
  snowballThrow: { slot: 4, name: '눈덩이', speed: 34, gravity: 15, damage: 8, cooldown: 0.4, radius: 0.3, color: '#ffffff' },
};

export const RARITY_COLORS = { common: '#e2e8f0', rare: '#38bdf8', epic: '#a855f7', legendary: '#f59e0b' };

const GROUND_PRIMARY = ['rifle', 'rifle', 'smg', 'smg', 'shotgun', 'shotgun', 'lmg', 'dmr', 'crossbow'];
const GROUND_SIDEARM = ['pistol', 'pistol', 'watergun', 'revolver', 'slingshot'];
const AIRDROP_PRIMARY = ['sr', 'concept'];

const BOT_NAMES = [
  '비마관지박령', '화도관유령', '참빛관야간조', '새빛관새내기', '복학생김씨', '조교님',
  '도서관붙박이', '한울관고인물', '빛솔재통금', '동아리회장', '80주년산책러',
];
const BOT_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#10b981', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#84cc16', '#6366f1', '#f43f5e'];

// Zone phases (PUBG 자기장): wait → shrink, radius ratio vs previous, damage/sec outside
const ZONE_PHASES = [
  { wait: 75, shrink: 45, ratio: 0.58, dps: 0.6 },
  { wait: 55, shrink: 40, ratio: 0.55, dps: 1.2 },
  { wait: 45, shrink: 35, ratio: 0.5, dps: 2.5 },
  { wait: 35, shrink: 30, ratio: 0.45, dps: 4.5 },
  { wait: 30, shrink: 25, ratio: 0.4, dps: 7 },
  { wait: 25, shrink: 25, ratio: 0.0, dps: 10 },
];

function rand(a, b) {
  return a + Math.random() * (b - a);
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createSnowmanNPC(variant = 0) {
  const group = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f4f8fc', roughness: 0.95 });
  const accents = ['#d92d20', '#2563eb', '#16a34a', '#9333ea'];
  const accentMat = new THREE.MeshStandardMaterial({ color: accents[variant % accents.length], roughness: 0.8 });
  const carrotMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.6 });
  const coalMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.8 });
  const twigMat = new THREE.MeshStandardMaterial({ color: '#5b3a24', roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12), snowMat);
  body.position.y = 0.7;
  body.castShadow = true;
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.54, 16, 12), snowMat);
  torso.position.y = 1.65;
  torso.castShadow = true;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 8, 16), accentMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 2.02;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.05), accentMat);
  tail.position.set(0.22, 1.85, 0.36);
  tail.rotation.z = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), snowMat);
  head.position.y = 2.38;
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8), carrotMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.36, 0.48);
  group.add(body, torso, scarf, tail, head, nose);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), coalMat);
    eye.position.set(s * 0.13, 2.47, 0.33);
    group.add(eye);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.9, 5), twigMat);
    arm.position.set(s * 0.75, 1.75, 0);
    arm.rotation.z = s * -1.0;
    group.add(arm);
  }
  for (let i = 0; i < 3; i++) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), coalMat);
    button.position.set(0, 1.45 + i * 0.17, 0.52 - Math.abs(i - 1) * 0.03);
    group.add(button);
  }
  if (variant % 2 === 0) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), coalMat);
    brim.position.y = 2.68;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.42, 16), coalMat);
    top.position.y = 2.9;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.08, 16), accentMat);
    band.position.y = 2.75;
    group.add(brim, top, band);
  } else {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 14), accentMat);
    hat.position.y = 3.0;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), snowMat);
    pom.position.y = 3.38;
    group.add(hat, pom);
  }
  return mergeByMaterial(group);
}

export function createSurvivalCombatSystem(scene, world, collision, playArea, callbacks) {
  const { onStatsChange, onPlayerHit, onFlashbang, onFeed, onWeaponModelChange, onSpeedBoost, onMatchOver, onBanner } = callbacks;

  const projectiles = [];
  const effects = [];
  const drops = [];
  const snowmen = [];
  const bots = [];
  const airdrops = [];
  const remotePlayers = new Map();

  const projGeoCache = new Map();
  const projMatCache = new Map();
  const effectGeo = new THREE.SphereGeometry(1, 10, 10);

  /* ------------------------------ Player state ------------------------------ */
  let activeSlot = 4;
  const slots = { 1: null, 2: null };
  const inventory = { snowballs: 0, flashbangs: 0, medkits: 0, drinks: 0, helmet: 0, vest: 0 };
  let playerHp = 100;
  let kills = 0;
  let alive = true;
  let lastFireTime = 0;
  let reloading = null; // { slot, t, dur }
  let healing = null; // { type, t, dur }
  let myId = null;
  let myName = '나';
  let lastPlayerPos = null;

  /* ------------------------------ Match state ------------------------------ */
  let matchPhase = 'lobby'; // lobby | plane | live | over
  let matchTime = 0;
  const TOTAL_PLAYERS = BOT_NAMES.length + 1;

  // Plane
  const plane = buildPlaneModel();
  plane.visible = false;
  scene.add(plane);
  const planeState = { start: new THREE.Vector3(), end: new THREE.Vector3(), dir: new THREE.Vector3(), t: 0, len: 1, speed: 48, alt: 170 };

  function planePos(t) {
    return planeState.start.clone().lerp(planeState.end, t);
  }

  // Zone
  const zone = {
    phaseIdx: -1,
    state: 'wait', // wait | shrink | done
    timer: 0,
    cur: { x: 0, z: 0, r: 1 },
    from: { x: 0, z: 0, r: 1 },
    next: { x: 0, z: 0, r: 1 },
    dps: 0.4,
  };
  const blueMat = new THREE.MeshBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const blueWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 240, 96, 1, true), blueMat);
  blueWall.visible = false;
  scene.add(blueWall);
  const whiteRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 3, 96, 1, true),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  whiteRing.visible = false;
  scene.add(whiteRing);

  function pickNextCircle(cur, ratio) {
    const r = ratio > 0 ? cur.r * ratio : 4;
    const maxOff = Math.max(0, cur.r - r) * 0.85;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * maxOff;
      const x = cur.x + Math.cos(a) * d;
      const z = cur.z + Math.sin(a) * d;
      // keep the circle centred on walkable campus, not inside a building
      if (x < playArea.minX + 20 || x > playArea.maxX - 20 || z < playArea.minZ + 20 || z > playArea.maxZ - 20) continue;
      if (collision.buildingAt(x, z, 1)) continue;
      return { x, z, r };
    }
    return { x: cur.x, z: cur.z, r };
  }

  function startZone() {
    const cx = (playArea.minX + playArea.maxX) / 2;
    const cz = (playArea.minZ + playArea.maxZ) / 2;
    const r = Math.hypot(playArea.maxX - playArea.minX, playArea.maxZ - playArea.minZ) * 0.55;
    zone.cur = { x: cx, z: cz, r };
    zone.from = { ...zone.cur };
    zone.phaseIdx = 0;
    zone.state = 'wait';
    zone.timer = ZONE_PHASES[0].wait;
    zone.dps = ZONE_PHASES[0].dps;
    zone.next = pickNextCircle(zone.cur, ZONE_PHASES[0].ratio);
  }

  function updateZone(dt) {
    if (zone.phaseIdx < 0 || zone.state === 'done') return;
    zone.timer -= dt;
    const ph = ZONE_PHASES[zone.phaseIdx];
    if (zone.state === 'wait') {
      if (zone.timer <= 0) {
        zone.state = 'shrink';
        zone.timer = ph.shrink;
        zone.from = { ...zone.cur };
        onBanner?.('⚠️ 자기장이 줄어듭니다!', 'warn');
        if (zone.phaseIdx === 1 || zone.phaseIdx === 3) spawnAirdrop();
      }
    } else if (zone.state === 'shrink') {
      const t = 1 - Math.max(0, zone.timer) / ph.shrink;
      zone.cur.x = zone.from.x + (zone.next.x - zone.from.x) * t;
      zone.cur.z = zone.from.z + (zone.next.z - zone.from.z) * t;
      zone.cur.r = zone.from.r + (zone.next.r - zone.from.r) * t;
      if (zone.timer <= 0) {
        zone.cur = { ...zone.next };
        zone.phaseIdx++;
        if (zone.phaseIdx >= ZONE_PHASES.length) {
          zone.state = 'done';
          zone.dps = 12;
          return;
        }
        const nph = ZONE_PHASES[zone.phaseIdx];
        zone.state = 'wait';
        zone.timer = nph.wait;
        zone.dps = nph.dps;
        zone.next = pickNextCircle(zone.cur, nph.ratio);
        onBanner?.(`🔵 ${zone.phaseIdx + 1}단계 자기장 · 흰 원 안으로 이동하세요`, 'info');
      }
    }
  }

  function outsideZone(x, z) {
    return zone.phaseIdx >= 0 && Math.hypot(x - zone.cur.x, z - zone.cur.z) > zone.cur.r;
  }

  /* ------------------------------ Networking ------------------------------ */
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
        myName = msg.name || myName;
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
            if (s.weapon !== undefined) rp.avatar.setWeapon(s.weapon);
          }
        }
      } else if (msg.type === 'throw') {
        spawnProjectile(
          new THREE.Vector3(msg.origin.x, msg.origin.y, msg.origin.z),
          new THREE.Vector3(msg.dir.x, msg.dir.y, msg.dir.z),
          msg.weapon,
          { kind: 'remote', id: msg.id }
        );
      } else if (msg.type === 'damaged') {
        applyPlayerDamage(msg.damage || 18, msg.by || '라이벌');
      } else if (msg.type === 'eliminated') {
        onFeed?.(`💀 ${msg.killerName} ▸ ${msg.victimName}`);
        if (msg.victimId === myId) handlePlayerDeath(msg.killerName);
        notify();
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

  /* ------------------------------ Damage ------------------------------ */
  function armorReduction(helmet, vest) {
    const h = [0, 0.15, 0.25, 0.35][helmet] || 0;
    const v = [0, 0.2, 0.3, 0.4][vest] || 0;
    return Math.min(0.6, h * 0.5 + v * 0.8);
  }

  function applyPlayerDamage(rawDmg, byName = null, weaponKey = null) {
    if (!alive || matchPhase !== 'live') return;
    const dmg = byName === '자기장' ? rawDmg : Math.max(1, rawDmg * (1 - armorReduction(inventory.helmet, inventory.vest)));
    playerHp = Math.max(0, playerHp - dmg);
    if (healing) {
      healing = null;
      onFeed?.('⛔ 피격으로 치료가 취소됐습니다');
    }
    onPlayerHit?.();
    if (playerHp <= 0) handlePlayerDeath(byName, weaponKey);
    notify();
  }

  function handlePlayerDeath(byName, weaponKey) {
    if (!alive) return;
    alive = false;
    const w = weaponKey ? WEAPON_CATALOG[weaponKey]?.icon || '' : '';
    onFeed?.(`💀 ${byName || '???'} ${w} ▸ ${myName}`);
    dropDeathCrate(lastPlayerPos?.x ?? 0, lastPlayerPos?.z ?? 0, {
      weapons: [slots[1]?.key, slots[2]?.key].filter(Boolean),
      helmet: inventory.helmet,
      vest: inventory.vest,
      medkits: inventory.medkits,
      snowballs: inventory.snowballs,
    });
    ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'move', alive: false, hp: 0, x: lastPlayerPos?.x, y: lastPlayerPos?.y, z: lastPlayerPos?.z }));
    endMatch(false, byName);
  }

  function aliveCount() {
    return (alive ? 1 : 0) + bots.filter((b) => b.alive).length + Array.from(remotePlayers.values()).filter((r) => r.alive).length;
  }

  function endMatch(won, killer = null) {
    if (matchPhase === 'over') return;
    const rank = won ? 1 : aliveCount() + 1;
    matchPhase = 'over';
    onMatchOver?.({ won, rank, total: TOTAL_PLAYERS + remotePlayers.size, kills, killer, time: matchTime });
    notify();
  }

  /* ------------------------------ Snowmen ------------------------------ */
  function randomCampusSpot(margin = 15) {
    for (let i = 0; i < 60; i++) {
      const x = rand(playArea.minX + margin, playArea.maxX - margin);
      const z = rand(playArea.minZ + margin, playArea.maxZ - margin);
      if (!collision.isBlocked(x, z, 1.2)) return [x, z];
    }
    return collision.findFreeSpot(0, 0, 1.2);
  }

  function spawnSnowman(i) {
    const mesh = createSnowmanNPC(i);
    scene.add(mesh);
    const s = { mesh, x: 0, z: 0, vx: 0, vz: 0, hp: 60, alive: true, respawnTimer: 0, stunTimer: 0, wanderTimer: 0, aggro: null, throwCd: 0, i };
    placeSnowman(s);
    snowmen.push(s);
  }

  function placeSnowman(s) {
    const [x, z] = randomCampusSpot();
    s.x = x;
    s.z = z;
    s.hp = 60;
    s.alive = true;
    s.aggro = null;
    s.mesh.visible = true;
    s.mesh.position.set(x, getTerrainHeight(x, z), z);
  }

  for (let i = 0; i < 34; i++) spawnSnowman(i);

  function killSnowman(s, killer) {
    s.alive = false;
    s.mesh.visible = false;
    s.respawnTimer = 30;
    spawnSnowmanLoot(s.x, s.z);
    spawnEffect(s.x, getTerrainHeight(s.x, s.z) + 1.4, s.z, '#ffffff', 2.4, 0.5);
    if (killer?.kind === 'player') {
      onFeed?.('☃️ 눈사람 처치! 전리품 드랍');
    }
  }

  /* ------------------------------ Loot ------------------------------ */
  function makeDrop(category, extra = {}) {
    if (category === 'primary' || category === 'sidearm') {
      const spec = WEAPON_CATALOG[extra.key];
      return { category, key: extra.key, label: `${spec.icon} ${spec.name}`, color: RARITY_COLORS[spec.rarity] || '#e2e8f0' };
    }
    if (category === 'helmet') return { category, level: extra.level, label: `🪖 ${extra.level}레벨 뚝배기`, color: ['#fff', '#94a3b8', '#38bdf8', '#a855f7'][extra.level] };
    if (category === 'vest') return { category, level: extra.level, label: `🦺 ${extra.level}레벨 조끼`, color: ['#fff', '#94a3b8', '#38bdf8', '#a855f7'][extra.level] };
    if (category === 'flashbang') return { category, count: extra.count || 1, label: `⚡ 눈광탄 ×${extra.count || 1}`, color: '#7dd3fc' };
    if (category === 'medkit') return { category, count: extra.count || 1, label: `💊 구급상자 ×${extra.count || 1}`, color: '#f87171' };
    if (category === 'drink') return { category, count: extra.count || 1, label: `🥤 에너지 드링크 ×${extra.count || 1}`, color: '#4ade80' };
    return { category: 'ammo', count: extra.count || 30, label: `❄️ 눈덩이 탄약 +${extra.count || 30}`, color: '#e0f2fe' };
  }

  function placeDrop(drop, x, z) {
    const [fx, fz] = collision.findFreeSpot(x, z, 0.4, 10);
    const { group, model } = buildLootVisual(drop);
    const y = getTerrainHeight(fx, fz) + 0.75;
    group.position.set(fx, y, fz);
    scene.add(group);
    drops.push({ mesh: group, model, drop, x: fx, z: fz, baseY: y, age: Math.random() * 6 });
  }

  // 무기는 눈사람만 떨군다: snowmen are the only source of guns on the ground
  function spawnSnowmanLoot(x, z) {
    const roll = Math.random();
    const items = [];
    if (roll < 0.5) items.push(makeDrop('primary', { key: pick(GROUND_PRIMARY) }));
    else if (roll < 0.72) items.push(makeDrop('sidearm', { key: pick(GROUND_SIDEARM) }));
    else if (roll < 0.84) items.push(makeDrop('helmet', { level: Math.random() < 0.65 ? 1 : 2 }));
    else items.push(makeDrop('vest', { level: Math.random() < 0.65 ? 1 : 2 }));
    items.push(makeDrop('ammo', { count: 20 + Math.floor(Math.random() * 3) * 10 }));
    const extra = Math.random();
    if (extra < 0.25) items.push(makeDrop('medkit'));
    else if (extra < 0.45) items.push(makeDrop('drink'));
    else if (extra < 0.6) items.push(makeDrop('flashbang', { count: 2 }));
    items.forEach((d, i) => {
      const a = (i / items.length) * Math.PI * 2;
      placeDrop(d, x + Math.cos(a) * 1.6, z + Math.sin(a) * 1.6);
    });
  }

  function dropDeathCrate(x, z, loot) {
    const items = [];
    for (const k of loot.weapons || []) items.push(makeDrop(WEAPON_CATALOG[k].slot === 1 ? 'primary' : 'sidearm', { key: k }));
    if (loot.helmet) items.push(makeDrop('helmet', { level: loot.helmet }));
    if (loot.vest) items.push(makeDrop('vest', { level: loot.vest }));
    if (loot.medkits) items.push(makeDrop('medkit', { count: loot.medkits }));
    if (loot.snowballs > 0) items.push(makeDrop('ammo', { count: Math.min(90, loot.snowballs) }));
    items.forEach((d, i) => {
      const a = (i / Math.max(1, items.length)) * Math.PI * 2;
      placeDrop(d, x + Math.cos(a) * 1.8, z + Math.sin(a) * 1.8);
    });
  }

  /* ------------------------------ Airdrops ------------------------------ */
  function spawnAirdrop() {
    const ang = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * zone.next.r * 0.8;
    let [x, z] = collision.findFreeSpot(zone.next.x + Math.cos(ang) * d, zone.next.z + Math.sin(ang) * d, 2, 40);
    const visual = buildAirdropModel();
    const y = getTerrainHeight(x, z) + 160;
    visual.group.position.set(x, y, z);
    scene.add(visual.group);
    const smoke = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 3.5, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide })
    );
    smoke.position.set(x, getTerrainHeight(x, z) + 30, z);
    scene.add(smoke);
    airdrops.push({ ...visual, smoke, x, z, landed: false, opened: false, age: 0 });
    onBanner?.('📦 보급 상자가 투하됩니다! (빨간 연기)', 'gold');
  }

  function openAirdrop(a) {
    a.opened = true;
    const items = [
      makeDrop('primary', { key: pick(AIRDROP_PRIMARY) }),
      makeDrop('helmet', { level: 3 }),
      makeDrop('vest', { level: 3 }),
      makeDrop('medkit', { count: 2 }),
      makeDrop('ammo', { count: 60 }),
    ];
    items.forEach((d, i) => {
      const ang = (i / items.length) * Math.PI * 2;
      placeDrop(d, a.x + Math.cos(ang) * 2.4, a.z + Math.sin(ang) * 2.4);
    });
    a.beacon.visible = false;
  }

  /* ------------------------------ Bots ------------------------------ */
  BOT_NAMES.forEach((name, i) => {
    const avatar = createPlayerAvatar(BOT_COLORS[i % BOT_COLORS.length], name);
    avatar.group.visible = false;
    scene.add(avatar.group);
    bots.push({
      id: `bot${i}`,
      name,
      avatar,
      x: 0, y: 0, z: 0,
      vx: 0, vz: 0,
      hp: 100,
      alive: true,
      state: 'plane', // plane | air | ground
      jumpT: 0,
      landX: 0, landZ: 0,
      weapon: null, mag: 0, reloadT: 0,
      helmet: 0, vest: 0, medkits: 0,
      ammo: 0,
      stunTimer: 0, fireCooldown: 0, wanderTimer: 0, walkPhase: 0,
      target: null, goal: null, skill: rand(0.55, 1.0), healT: 0, lastHitBy: null,
    });
  });

  function resetBots() {
    for (const b of bots) {
      b.hp = 100;
      b.alive = true;
      b.state = 'plane';
      b.jumpT = rand(0.18, 0.85);
      b.weapon = null;
      b.mag = 0;
      b.ammo = 0;
      b.helmet = 0;
      b.vest = 0;
      b.medkits = 0;
      b.target = null;
      b.goal = null;
      b.avatar.group.visible = false;
      b.avatar.setWeapon(null);
      b.avatar.setGear(0, 0);
      b.avatar.updateLabel(b.name, 100);
    }
  }

  function terrainLOS(ax, ay, az, bx, by, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(2, Math.floor(dist / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = ay + (by - ay) * t;
      if (getTerrainHeight(x, z) > y - 0.2) return false;
    }
    return true;
  }

  function damageBot(b, dmg, attacker, weaponKey) {
    if (!b.alive) return;
    const real = Math.max(1, dmg * (1 - armorReduction(b.helmet, b.vest)));
    b.hp -= real;
    b.lastHitBy = attacker;
    b.avatar.updateLabel(b.name, Math.max(0, b.hp));
    if (attacker && attacker.kind !== 'zone') b.target = attacker;
    if (b.hp <= 0) killBot(b, attacker, weaponKey);
  }

  function attackerName(att) {
    if (!att) return '???';
    if (att.kind === 'player') return myName;
    if (att.kind === 'bot') return att.ref.name;
    if (att.kind === 'snowman') return '눈사람';
    if (att.kind === 'zone') return '자기장';
    if (att.kind === 'remote') return remotePlayers.get(att.id)?.name || '라이벌';
    return '???';
  }

  function killBot(b, attacker, weaponKey) {
    b.alive = false;
    b.avatar.group.visible = false;
    const w = weaponKey ? WEAPON_CATALOG[weaponKey]?.icon || '' : '';
    onFeed?.(`💀 ${attackerName(attacker)} ${w} ▸ ${b.name}`);
    if (attacker?.kind === 'player') kills++;
    if (attacker?.kind === 'bot') attacker.ref.kills = (attacker.ref.kills || 0) + 1;
    dropDeathCrate(b.x, b.z, {
      weapons: b.weapon ? [b.weapon] : [],
      helmet: b.helmet,
      vest: b.vest,
      medkits: b.medkits,
      snowballs: b.ammo,
    });
    notify();
  }

  function botPickup(b) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (Math.hypot(d.x - b.x, d.z - b.z) > 2.4) continue;
      const it = d.drop;
      let take = false;
      if (it.category === 'primary' && (!b.weapon || WEAPON_CATALOG[b.weapon].slot === 2 || Math.random() < 0.3)) {
        b.weapon = it.key;
        b.mag = WEAPON_CATALOG[it.key].mag;
        take = true;
      } else if (it.category === 'sidearm' && !b.weapon) {
        b.weapon = it.key;
        b.mag = WEAPON_CATALOG[it.key].mag;
        take = true;
      } else if (it.category === 'helmet' && it.level > b.helmet) {
        b.helmet = it.level;
        take = true;
      } else if (it.category === 'vest' && it.level > b.vest) {
        b.vest = it.level;
        take = true;
      } else if (it.category === 'ammo') {
        b.ammo += it.count;
        take = true;
      } else if (it.category === 'medkit') {
        b.medkits += it.count;
        take = true;
      }
      if (take) {
        scene.remove(d.mesh);
        drops.splice(i, 1);
        b.avatar.setWeapon(b.weapon);
        b.avatar.setGear(b.helmet, b.vest);
      }
    }
  }

  function nearestLoot(b, maxD = 60) {
    let best = null;
    let bd = maxD;
    for (const d of drops) {
      const want =
        (d.drop.category === 'primary' && (!b.weapon || WEAPON_CATALOG[b.weapon].slot === 2)) ||
        (d.drop.category === 'sidearm' && !b.weapon) ||
        (d.drop.category === 'helmet' && d.drop.level > b.helmet) ||
        (d.drop.category === 'vest' && d.drop.level > b.vest) ||
        (d.drop.category === 'ammo' && b.ammo < 60);
      if (!want) continue;
      const dist = Math.hypot(d.x - b.x, d.z - b.z);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  function targetPos(t) {
    if (!t) return null;
    if (t.kind === 'player') return alive && lastPlayerPos ? { x: lastPlayerPos.x, y: lastPlayerPos.y - 0.4, z: lastPlayerPos.z } : null;
    if (t.kind === 'bot') return t.ref.alive && t.ref.state === 'ground' ? { x: t.ref.x, y: t.ref.y + 1.3, z: t.ref.z } : null;
    if (t.kind === 'snowman') return t.ref.alive ? { x: t.ref.x, y: getTerrainHeight(t.ref.x, t.ref.z) + 1.5, z: t.ref.z } : null;
    return null;
  }

  function botSense(b, playerGround) {
    // Prefer enemies (player/bots) within weapon range, else nearby snowmen for loot
    const range = b.weapon ? Math.min(85, WEAPON_CATALOG[b.weapon].range * 1.1) : 26;
    let best = null;
    let bd = range;
    const eyeY = b.y + 1.5;
    if (playerGround && alive && lastPlayerPos) {
      const d = Math.hypot(lastPlayerPos.x - b.x, lastPlayerPos.z - b.z);
      if (d < bd && terrainLOS(b.x, eyeY, b.z, lastPlayerPos.x, lastPlayerPos.y, lastPlayerPos.z)) {
        bd = d;
        best = { kind: 'player' };
      }
    }
    for (const o of bots) {
      if (o === b || !o.alive || o.state !== 'ground') continue;
      const d = Math.hypot(o.x - b.x, o.z - b.z);
      if (d < bd * 0.9 && terrainLOS(b.x, eyeY, b.z, o.x, o.y + 1.5, o.z)) {
        bd = d;
        best = { kind: 'bot', ref: o };
      }
    }
    if (best) return best;
    let sb = null;
    let sd = b.weapon ? 45 : 30;
    for (const s of snowmen) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - b.x, s.z - b.z);
      if (d < sd) {
        sd = d;
        sb = { kind: 'snowman', ref: s };
      }
    }
    return sb;
  }

  function moveAgent(agent, dx, dz, speed, dt, radius = 0.7) {
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return false;
    const ux = dx / len;
    const uz = dz / len;
    const step = speed * dt;
    const tryDirs = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9];
    for (const off of tryDirs) {
      const c = Math.cos(off);
      const s = Math.sin(off);
      const mx = ux * c - uz * s;
      const mz = ux * s + uz * c;
      const nx = agent.x + mx * step;
      const nz = agent.z + mz * step;
      const climb = getTerrainHeight(nx, nz) - getTerrainHeight(agent.x, agent.z);
      if (climb <= MAX_STEP_UP && !collision.isBlocked(nx, nz, radius)) {
        agent.x = Math.max(playArea.minX, Math.min(playArea.maxX, nx));
        agent.z = Math.max(playArea.minZ, Math.min(playArea.maxZ, nz));
        agent.vx = mx;
        agent.vz = mz;
        return true;
      }
    }
    return false;
  }

  function botFire(b, tp, dist) {
    const key = b.weapon || 'hands';
    const spec = WEAPON_CATALOG[key];
    const origin = new THREE.Vector3(b.x, b.y + 1.45, b.z);
    // lead + inaccuracy scaled by skill & distance
    const aim = new THREE.Vector3(tp.x, tp.y, tp.z);
    const flight = dist / spec.speed;
    aim.y += 0.5 * spec.gravity * flight * flight;
    const inacc = (1.25 - b.skill) * (0.04 + dist * 0.0012);
    aim.x += (Math.random() - 0.5) * dist * inacc;
    aim.y += (Math.random() - 0.5) * dist * inacc * 0.6;
    aim.z += (Math.random() - 0.5) * dist * inacc;
    const dir = aim.sub(origin).normalize();
    spawnProjectile(origin, dir, key, { kind: 'bot', ref: b });
    if (b.weapon) {
      b.mag--;
      if (b.mag <= 0) b.reloadT = spec.reload * 1.2;
    }
    b.fireCooldown = spec.auto ? spec.cooldown * rand(2.2, 4.5) : spec.cooldown * rand(1.4, 2.6) + 0.15;
    if (spec.auto && Math.random() < 0.18) b.fireCooldown += rand(0.4, 1.0); // burst pause
  }

  function updateBots(dt) {
    const pPhase = callbacks.getPlayerPhase?.() || 'ground';
    const playerGround = pPhase === 'ground';
    for (const b of bots) {
      if (!b.alive) continue;
      if (b.state === 'plane') {
        if (matchPhase === 'plane' && planeState.t >= b.jumpT) {
          b.state = 'air';
          const p = planePos(planeState.t);
          b.x = p.x;
          b.z = p.z;
          b.y = p.y - 5;
          // glide toward a landing spot near the path (hot drops near named buildings are common)
          const named = world.buildings.filter((bb) => bb.name);
          let lx, lz;
          if (named.length && Math.random() < 0.6) {
            const tb = pick(named);
            lx = tb.bounds.cx + rand(-30, 30);
            lz = tb.bounds.cz + rand(-30, 30);
          } else {
            lx = p.x + rand(-90, 90);
            lz = p.z + rand(-90, 90);
          }
          lx = Math.max(playArea.minX + 10, Math.min(playArea.maxX - 10, lx));
          lz = Math.max(playArea.minZ + 10, Math.min(playArea.maxZ - 10, lz));
          [b.landX, b.landZ] = collision.findFreeSpot(lx, lz);
          b.avatar.group.visible = true;
          b.avatar.setParachute(true);
        }
        continue;
      }
      if (b.state === 'air') {
        const gy = getTerrainHeight(b.x, b.z);
        const dx = b.landX - b.x;
        const dz = b.landZ - b.z;
        const d = Math.hypot(dx, dz);
        const hs = Math.min(14, d);
        if (d > 0.5) {
          b.x += (dx / d) * hs * dt;
          b.z += (dz / d) * hs * dt;
        }
        const timeToArrive = d / 14;
        const vy = Math.max(5, Math.min(30, (b.y - gy) / Math.max(1, timeToArrive)));
        b.y -= vy * dt;
        b.avatar.group.position.set(b.x, b.y, b.z);
        b.avatar.group.rotation.y = Math.atan2(dx, dz);
        if (b.y <= gy + 0.05) {
          b.y = gy;
          b.state = 'ground';
          b.avatar.setParachute(false);
          b.wanderTimer = 0;
        }
        continue;
      }

      // ---- ground ----
      if (outsideZone(b.x, b.z)) damageBot(b, zone.dps * dt, { kind: 'zone' }, null);
      if (!b.alive) continue;
      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        continue;
      }
      if (b.reloadT > 0) {
        b.reloadT -= dt;
        if (b.reloadT <= 0 && b.weapon) {
          const need = WEAPON_CATALOG[b.weapon].mag;
          const take = Math.min(need, b.ammo + 10); // bots carry a little spare
          b.mag = take;
          b.ammo = Math.max(0, b.ammo - take);
        }
      }
      if (b.hp < 55 && b.medkits > 0 && !b.target) {
        b.healT += dt;
        if (b.healT > 5) {
          b.medkits--;
          b.hp = Math.min(100, b.hp + 60);
          b.healT = 0;
          b.avatar.updateLabel(b.name, b.hp);
        }
      }

      botPickup(b);

      // Re-evaluate target periodically
      b.wanderTimer -= dt;
      if (b.wanderTimer <= 0) {
        b.wanderTimer = rand(0.6, 1.2);
        const sensed = botSense(b, playerGround);
        if (sensed && (!b.target || sensed.kind !== 'snowman' || b.target.kind === 'snowman')) b.target = sensed;
        if (b.target && !targetPos(b.target)) b.target = null;
        // goal: zone first, then loot, then random roam
        const nz = zone.phaseIdx >= 0 ? zone.next : null;
        const hunt =
          playerGround && alive && lastPlayerPos && zone.phaseIdx >= 1 &&
          Math.hypot(lastPlayerPos.x - b.x, lastPlayerPos.z - b.z) < 60 + zone.phaseIdx * 30 &&
          Math.random() < 0.25 + zone.phaseIdx * 0.1;
        if (hunt && b.weapon) {
          // armed bots push toward the player's last known area
          b.goal = { x: lastPlayerPos.x + rand(-12, 12), z: lastPlayerPos.z + rand(-12, 12) };
        } else if (nz && Math.hypot(b.x - nz.x, b.z - nz.z) > nz.r * 0.8) {
          b.goal = { x: nz.x + rand(-nz.r, nz.r) * 0.4, z: nz.z + rand(-nz.r, nz.r) * 0.4 };
        } else {
          const loot = nearestLoot(b);
          if (loot) b.goal = { x: loot.x, z: loot.z };
          else if (!b.goal || Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 4) {
            const [rx, rz] = randomCampusSpot();
            b.goal = { x: rx, z: rz };
          }
        }
      }

      const tp = targetPos(b.target);
      let moving = false;
      if (tp) {
        const dx = tp.x - b.x;
        const dz = tp.z - b.z;
        const dist = Math.hypot(dx, dz);
        b.avatar.group.rotation.y = Math.atan2(dx, dz);
        const spec = WEAPON_CATALOG[b.weapon || 'hands'];
        const pref = Math.min(spec.range * 0.6, 28);
        // strafe while engaging
        const strafe = Math.sin(performance.now() * 0.0013 + b.skill * 10) > 0 ? 1 : -1;
        if (dist > pref) moving = moveAgent(b, dx, dz, 4.8, dt);
        else moving = moveAgent(b, -dz * strafe, dx * strafe, 3.2, dt);
        b.fireCooldown -= dt;
        if (b.fireCooldown <= 0 && b.reloadT <= 0 && dist < spec.range) {
          if (b.weapon && b.mag <= 0) b.reloadT = spec.reload;
          else botFire(b, tp, dist);
        }
      } else if (b.goal) {
        const dx = b.goal.x - b.x;
        const dz = b.goal.z - b.z;
        if (Math.hypot(dx, dz) > 1.5) {
          const run = outsideZone(b.x, b.z) ? 8.5 : 5.6;
          moving = moveAgent(b, dx, dz, run, dt);
          if (moving) b.avatar.group.rotation.y = Math.atan2(b.vx, b.vz);
        }
      }
      b.y = getTerrainHeight(b.x, b.z);
      b.avatar.group.position.set(b.x, b.y, b.z);
      if (moving) {
        b.walkPhase += dt * 9;
        b.avatar.leftLeg.rotation.x = Math.sin(b.walkPhase) * 0.55;
        b.avatar.rightLeg.rotation.x = -Math.sin(b.walkPhase) * 0.55;
      } else {
        b.avatar.leftLeg.rotation.x *= 0.8;
        b.avatar.rightLeg.rotation.x *= 0.8;
      }
    }
  }

  /* ------------------------------ Projectiles & effects ------------------------------ */
  function spawnEffect(x, y, z, color, targetScale, duration = 0.35) {
    const sphere = new THREE.Mesh(effectGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    sphere.position.set(x, y, z);
    sphere.scale.setScalar(0.3);
    scene.add(sphere);
    effects.push({ mesh: sphere, age: 0, maxAge: duration, targetScale });
  }

  function projGeometry(spec, key) {
    const k = spec.bolt ? 'bolt' : spec.radius;
    if (!projGeoCache.has(k)) {
      if (spec.bolt) {
        const g = new THREE.ConeGeometry(0.06, 0.9, 6);
        g.rotateX(-Math.PI / 2);
        projGeoCache.set(k, g);
      } else projGeoCache.set(k, new THREE.SphereGeometry(spec.radius, 8, 6));
    }
    return projGeoCache.get(k);
  }
  function projMaterial(color) {
    if (!projMatCache.has(color)) projMatCache.set(color, new THREE.MeshBasicMaterial({ color }));
    return projMatCache.get(color);
  }

  function spawnProjectile(origin, dir, weaponKey, owner) {
    const spec = WEAPON_CATALOG[weaponKey] || WEAPON_CATALOG.hands;
    const count = spec.pellets || 1;
    for (let i = 0; i < count; i++) {
      const d = dir.clone().normalize();
      const sp = spec.spread || 0;
      if (sp) {
        d.x += (Math.random() - 0.5) * sp;
        d.y += (Math.random() - 0.5) * sp * 0.6;
        d.z += (Math.random() - 0.5) * sp;
        d.normalize();
      }
      const mesh = new THREE.Mesh(projGeometry(spec, weaponKey), projMaterial(spec.color));
      mesh.position.copy(origin).addScaledVector(d, 0.9);
      if (spec.bolt) mesh.lookAt(mesh.position.clone().add(d));
      scene.add(mesh);
      const vel = d.multiplyScalar(spec.speed);
      if (weaponKey === 'flashbang' || weaponKey === 'hands' || weaponKey === 'slingshot') vel.y += weaponKey === 'flashbang' ? 6 : 2.5;
      projectiles.push({ mesh, vel, weaponKey, spec, owner, age: 0, bounces: 0 });
    }
  }

  function explode(p) {
    const pos = p.mesh.position;
    const isFlash = p.weaponKey === 'flashbang';
    spawnEffect(pos.x, pos.y, pos.z, isFlash ? '#ffffff' : '#fb923c', isFlash ? 9 : 7, isFlash ? 0.35 : 0.5);
    if (isFlash) {
      if (alive && lastPlayerPos && pos.distanceTo(lastPlayerPos) <= p.spec.splash && p.owner?.kind !== 'player') onFlashbang?.();
      if (alive && lastPlayerPos && p.owner?.kind === 'player' && pos.distanceTo(lastPlayerPos) <= p.spec.splash * 0.5) onFlashbang?.();
    }
    for (const s of snowmen) {
      if (!s.alive) continue;
      if (Math.hypot(s.x - pos.x, s.z - pos.z) <= p.spec.splash) {
        if (isFlash) s.stunTimer = 4;
        else {
          s.hp -= p.spec.damage;
          if (s.hp <= 0) killSnowman(s, p.owner);
        }
      }
    }
    for (const b of bots) {
      if (!b.alive || b.state !== 'ground') continue;
      const d = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (d <= p.spec.splash) {
        if (isFlash) b.stunTimer = 4;
        else damageBot(b, p.spec.damage * (1 - d / p.spec.splash * 0.5), p.owner, p.weaponKey);
      }
    }
    if (!isFlash && alive && lastPlayerPos && p.owner?.kind !== 'player') {
      const d = Math.hypot(lastPlayerPos.x - pos.x, lastPlayerPos.z - pos.z);
      if (d <= p.spec.splash) applyPlayerDamage(p.spec.damage * (1 - d / p.spec.splash * 0.5), attackerName(p.owner), p.weaponKey);
    }
    if (p.owner?.kind === 'player' && !isFlash && ws && ws.readyState === 1) {
      for (const [id, rp] of remotePlayers.entries()) {
        if (rp.alive && Math.hypot(rp.tx - pos.x, rp.tz - pos.z) <= p.spec.splash) {
          ws.send(JSON.stringify({ type: 'hit', targetId: id, damage: p.spec.damage }));
        }
      }
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.age += dt;
      const prevX = p.mesh.position.x;
      const prevY = p.mesh.position.y;
      const prevZ = p.mesh.position.z;
      p.vel.y -= p.spec.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.spec.bolt) p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
      const pos = p.mesh.position;
      const groundY = getTerrainHeight(pos.x, pos.z);

      if (p.spec.fuse) {
        if (collision.buildingAt3D(pos.x, pos.y, pos.z, 0.25)) {
          pos.set(prevX, prevY, prevZ);
          p.vel.x *= -0.4;
          p.vel.z *= -0.4;
        }
        if (pos.y <= groundY + 0.2) {
          pos.y = groundY + 0.2;
          p.vel.y *= -0.35;
          p.vel.x *= 0.6;
          p.vel.z *= 0.6;
        }
        if (p.age >= p.spec.fuse) {
          explode(p);
          scene.remove(p.mesh);
          projectiles.splice(i, 1);
        }
        continue;
      }
      if (p.spec.bounce && pos.y <= groundY + 0.2 && p.vel.y < 0 && p.bounces < 2) {
        pos.y = groundY + 0.2;
        p.vel.y = Math.abs(p.vel.y) * 0.55;
        p.bounces++;
      }

      let hit = collision.projectileHit(pos.x, pos.y, pos.z, groundY, prevX, prevY, prevZ);
      if (hit) spawnEffect(pos.x, pos.y, pos.z, '#ffffff', 1.0, 0.18);
      const owner = p.owner || {};
      const dmg = p.spec.damage;

      // snowmen (anyone can hit them)
      if (!hit) {
        for (const s of snowmen) {
          if (!s.alive || owner.kind === 'snowman') continue;
          const sy = getTerrainHeight(s.x, s.z) + 1.4;
          if (Math.hypot(pos.x - s.x, pos.y - sy, pos.z - s.z) < 1.25) {
            hit = true;
            if (p.spec.splash) explode(p);
            else {
              s.hp -= dmg;
              spawnEffect(pos.x, pos.y, pos.z, '#ffffff', 1.4, 0.2);
              if (owner.kind === 'player' || owner.kind === 'bot') s.aggro = owner;
              if (owner.kind === 'player') callbacks.onHitMarker?.(s.hp <= 0);
              if (s.hp <= 0) killSnowman(s, owner);
            }
            break;
          }
        }
      }
      // bots
      if (!hit) {
        for (const b of bots) {
          if (!b.alive || b.state !== 'ground') continue;
          if (owner.kind === 'bot' && owner.ref === b) continue;
          const head = Math.hypot(pos.x - b.x, pos.y - (b.y + 1.85), pos.z - b.z) < 0.32;
          if (head || Math.hypot(pos.x - b.x, pos.y - (b.y + 1.1), pos.z - b.z) < 0.85) {
            hit = true;
            if (p.spec.splash) explode(p);
            else {
              const headMul = head ? (b.helmet ? 1.6 - b.helmet * 0.15 : 2) : 1;
              damageBot(b, dmg * headMul, owner, p.weaponKey);
              spawnEffect(pos.x, pos.y, pos.z, head ? '#fde047' : '#ffffff', 1.2, 0.18);
              if (owner.kind === 'player') callbacks.onHitMarker?.(!b.alive, head);
            }
            break;
          }
        }
      }
      // remote players (only our own shots are authoritative)
      if (!hit && owner.kind === 'player' && ws && ws.readyState === 1) {
        for (const [id, rp] of remotePlayers.entries()) {
          if (!rp.alive) continue;
          if (Math.hypot(pos.x - rp.tx, pos.y - (rp.ty - 0.6), pos.z - rp.tz) < 1.0) {
            hit = true;
            ws.send(JSON.stringify({ type: 'hit', targetId: id, damage: dmg }));
            spawnEffect(pos.x, pos.y, pos.z, '#ffffff', 1.2, 0.18);
            callbacks.onHitMarker?.(false);
            break;
          }
        }
      }
      // local player
      if (!hit && owner.kind !== 'player' && alive && lastPlayerPos && matchPhase === 'live') {
        const head = pos.distanceTo(lastPlayerPos) < 0.35;
        if (head || Math.hypot(pos.x - lastPlayerPos.x, pos.y - (lastPlayerPos.y - 0.7), pos.z - lastPlayerPos.z) < 0.85) {
          hit = true;
          if (p.spec.splash) explode(p);
          else applyPlayerDamage(dmg * (head ? (inventory.helmet ? 1.6 - inventory.helmet * 0.15 : 2) : 1), attackerName(owner), p.weaponKey);
        }
      }

      if (hit || pos.y <= groundY || p.age > 4) {
        if (!hit && p.spec.splash) explode(p);
        else if (!hit && pos.y <= groundY) spawnEffect(pos.x, groundY + 0.2, pos.z, '#ffffff', 0.9, 0.16);
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
        e.mesh.material.dispose();
        effects.splice(i, 1);
        continue;
      }
      e.mesh.scale.setScalar(0.3 + t * e.targetScale);
      e.mesh.material.opacity = (1 - t) * 0.9;
    }
  }

  /* ------------------------------ Snowmen AI ------------------------------ */
  function updateSnowmen(dt) {
    for (const s of snowmen) {
      if (!s.alive) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0 && matchPhase === 'live') placeSnowman(s);
        continue;
      }
      if (outsideZone(s.x, s.z) && zone.phaseIdx >= 2) {
        s.hp -= zone.dps * dt;
        if (s.hp <= 0) {
          killSnowman(s, { kind: 'zone' });
          continue;
        }
      }
      if (s.stunTimer > 0) {
        s.stunTimer -= dt;
        continue;
      }
      const tp = s.aggro ? targetPos(s.aggro) : null;
      if (tp && Math.hypot(tp.x - s.x, tp.z - s.z) < 40) {
        // angry snowman: waddle toward attacker and lob snowballs
        const dx = tp.x - s.x;
        const dz = tp.z - s.z;
        const dist = Math.hypot(dx, dz);
        s.mesh.rotation.y = Math.atan2(dx, dz);
        if (dist > 10) moveAgent(s, dx, dz, 3.4, dt, 0.8);
        s.throwCd -= dt;
        if (s.throwCd <= 0 && dist < 26) {
          s.throwCd = rand(1.4, 2.4);
          const origin = new THREE.Vector3(s.x, getTerrainHeight(s.x, s.z) + 2.0, s.z);
          const aim = new THREE.Vector3(tp.x + rand(-1, 1), tp.y + dist * 0.06, tp.z + rand(-1, 1));
          spawnProjectile(origin, aim.sub(origin).normalize(), 'snowballThrow', { kind: 'snowman', ref: s });
        }
      } else {
        s.aggro = null;
        s.wanderTimer -= dt;
        if (s.wanderTimer <= 0) {
          const a = Math.random() * Math.PI * 2;
          s.vx = Math.cos(a);
          s.vz = Math.sin(a);
          s.wanderTimer = rand(2, 5);
        }
        if (moveAgent(s, s.vx, s.vz, 1.6, dt, 0.8)) s.mesh.rotation.y = Math.atan2(s.vx, s.vz);
        else s.wanderTimer = 0;
      }
      s.mesh.position.set(s.x, getTerrainHeight(s.x, s.z) + Math.abs(Math.sin(performance.now() * 0.006 + s.i)) * 0.08, s.z);
    }
  }

  /* ------------------------------ Player actions ------------------------------ */
  function scoopSnow() {
    inventory.snowballs += 2;
    onFeed?.(`❄️ 눈을 뭉쳤다 (+2 · 보유 ${inventory.snowballs})`);
    notify();
  }

  function reloadActiveGun() {
    if (!alive || reloading) return;
    const slotObj = slots[activeSlot];
    if (!slotObj || (activeSlot !== 1 && activeSlot !== 2)) return;
    const spec = WEAPON_CATALOG[slotObj.key];
    if (slotObj.mag >= spec.mag) return;
    if (inventory.snowballs <= 0) {
      onFeed?.('⚠️ 눈덩이 탄약이 없습니다! 4번 맨손으로 바닥 눈을 뭉치세요.');
      return;
    }
    reloading = { slot: activeSlot, t: 0, dur: spec.reload };
    notify();
  }

  function finishReload() {
    const slotObj = slots[reloading.slot];
    reloading = null;
    if (!slotObj) return;
    const spec = WEAPON_CATALOG[slotObj.key];
    const transfer = Math.min(spec.mag - slotObj.mag, inventory.snowballs);
    slotObj.mag += transfer;
    inventory.snowballs -= transfer;
    notify();
  }

  function useItem(itemType) {
    if (!alive || healing) return;
    if (itemType === 'medkit') {
      if (inventory.medkits <= 0 || playerHp >= 100) return;
      healing = { type: 'medkit', t: 0, dur: 5 };
      onFeed?.('💊 구급상자 사용 중... (5초)');
    } else if (itemType === 'drink') {
      if (inventory.drinks <= 0) return;
      healing = { type: 'drink', t: 0, dur: 3 };
      onFeed?.('🥤 에너지 드링크 마시는 중... (3초)');
    }
    notify();
  }

  function finishHeal() {
    if (healing.type === 'medkit') {
      inventory.medkits--;
      playerHp = Math.min(100, playerHp + 75);
      onFeed?.('💊 HP +75');
    } else {
      inventory.drinks--;
      playerHp = Math.min(100, playerHp + 30);
      onSpeedBoost?.(20);
      onFeed?.('🥤 HP +30 · 20초간 이동속도 증가');
    }
    healing = null;
    notify();
  }

  function selectSlot(slotNum) {
    if (slotNum === 1 && !slots[1]) return onFeed?.('⚠️ 주무기가 없습니다! 눈사람을 잡아 총을 얻으세요.');
    if (slotNum === 2 && !slots[2]) return onFeed?.('⚠️ 보조무기가 없습니다! 눈사람을 잡아 얻으세요.');
    if (slotNum === 3 && inventory.flashbangs <= 0) return onFeed?.('⚠️ 눈광탄이 없습니다.');
    activeSlot = slotNum;
    reloading = null;
    const key = slotNum === 3 ? 'flashbang' : slots[slotNum]?.key || 'hands';
    onWeaponModelChange?.(key);
    notify();
  }

  function cycleSlot(dir) {
    const order = [1, 2, 3, 4].filter((s) => (s === 1 ? slots[1] : s === 2 ? slots[2] : s === 3 ? inventory.flashbangs > 0 : true));
    const idx = order.indexOf(activeSlot);
    const next = order[(idx + dir + order.length) % order.length];
    if (next && next !== activeSlot) selectSlot(next);
  }

  function getActiveSpec() {
    if (activeSlot === 3) return WEAPON_CATALOG.flashbang;
    if (activeSlot === 4) return WEAPON_CATALOG.hands;
    return slots[activeSlot] ? WEAPON_CATALOG[slots[activeSlot].key] : null;
  }

  function fireActiveSlot(origin, dir, aimingDownAtSnow = false, ads = false) {
    if (!alive || matchPhase !== 'live' || healing) return 0;
    const now = performance.now() / 1000;

    if (activeSlot === 4) {
      if (aimingDownAtSnow || inventory.snowballs <= 0) {
        if (now - lastFireTime < 0.45) return 0;
        lastFireTime = now;
        scoopSnow();
        return 0.01;
      }
      if (now - lastFireTime < WEAPON_CATALOG.hands.cooldown) return 0;
      lastFireTime = now;
      inventory.snowballs--;
      spawnProjectile(origin, dir, 'hands', { kind: 'player' });
      notify();
      return 0.03;
    }

    if (activeSlot === 3) {
      if (inventory.flashbangs <= 0) return 0;
      if (now - lastFireTime < WEAPON_CATALOG.flashbang.cooldown) return 0;
      lastFireTime = now;
      inventory.flashbangs--;
      spawnProjectile(origin, dir, 'flashbang', { kind: 'player' });
      if (inventory.flashbangs <= 0) selectSlot(slots[1] ? 1 : slots[2] ? 2 : 4);
      notify();
      return 0.02;
    }

    const slotObj = slots[activeSlot];
    if (!slotObj || reloading) return 0;
    const spec = WEAPON_CATALOG[slotObj.key];
    if (now - lastFireTime < spec.cooldown) return 0;
    if (slotObj.mag <= 0) {
      lastFireTime = now;
      reloadActiveGun();
      return 0;
    }
    lastFireTime = now;
    slotObj.mag--;
    // hip fire is less accurate than ADS
    const d = dir.clone();
    if (!ads) {
      const hip = (spec.spread || 0.01) * 1.6 + 0.012;
      d.x += (Math.random() - 0.5) * hip;
      d.y += (Math.random() - 0.5) * hip;
      d.z += (Math.random() - 0.5) * hip;
      d.normalize();
    }
    spawnProjectile(origin, d, slotObj.key, { kind: 'player' });
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'throw', weapon: slotObj.key, origin: { x: origin.x, y: origin.y, z: origin.z }, dir: { x: d.x, y: d.y, z: d.z } }));
    }
    if (slotObj.mag <= 0 && inventory.snowballs > 0) reloadActiveGun();
    notify();
    return spec.recoil || 0.05;
  }

  /* ------------------------------ Pickup (F) ------------------------------ */
  function nearestPlayerDrop() {
    if (!lastPlayerPos) return null;
    let best = null;
    let bd = 2.6;
    for (const d of drops) {
      const dist = Math.hypot(lastPlayerPos.x - d.x, lastPlayerPos.z - d.z);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  function pickUp() {
    if (!alive || matchPhase !== 'live') return false;
    const d = nearestPlayerDrop();
    if (!d) return false;
    const it = d.drop;
    const replaceInto = (slotNum) => {
      const old = slots[slotNum];
      slots[slotNum] = { key: it.key, mag: 0 };
      if (old) {
        // drop the old weapon (and unload its snow back into the pouch)
        inventory.snowballs += old.mag;
        placeDrop(makeDrop(slotNum === 1 ? 'primary' : 'sidearm', { key: old.key }), lastPlayerPos.x + 1.2, lastPlayerPos.z);
      }
      // auto-load from pouch
      const spec = WEAPON_CATALOG[it.key];
      const load = Math.min(spec.mag, inventory.snowballs);
      slots[slotNum].mag = load;
      inventory.snowballs -= load;
      selectSlot(slotNum);
    };
    if (it.category === 'primary') replaceInto(1);
    else if (it.category === 'sidearm') replaceInto(2);
    else if (it.category === 'helmet') {
      if (it.level <= inventory.helmet) return feedNo('더 좋은 뚝배기를 쓰고 있습니다');
      if (inventory.helmet) placeDrop(makeDrop('helmet', { level: inventory.helmet }), lastPlayerPos.x + 1.2, lastPlayerPos.z);
      inventory.helmet = it.level;
    } else if (it.category === 'vest') {
      if (it.level <= inventory.vest) return feedNo('더 좋은 조끼를 입고 있습니다');
      if (inventory.vest) placeDrop(makeDrop('vest', { level: inventory.vest }), lastPlayerPos.x + 1.2, lastPlayerPos.z);
      inventory.vest = it.level;
    } else if (it.category === 'flashbang') inventory.flashbangs += it.count;
    else if (it.category === 'medkit') inventory.medkits += it.count;
    else if (it.category === 'drink') inventory.drinks += it.count;
    else if (it.category === 'ammo') inventory.snowballs += it.count;
    onFeed?.(`🎒 ${it.label} 획득`);
    scene.remove(d.mesh);
    drops.splice(drops.indexOf(d), 1);
    notify();
    return true;

    function feedNo(msg) {
      onFeed?.(`⚠️ ${msg}`);
      return false;
    }
  }

  /* ------------------------------ Match flow ------------------------------ */
  function clearWorldEntities() {
    for (const d of drops) scene.remove(d.mesh);
    drops.length = 0;
    for (const p of projectiles) scene.remove(p.mesh);
    projectiles.length = 0;
    for (const a of airdrops) {
      scene.remove(a.group);
      scene.remove(a.smoke);
    }
    airdrops.length = 0;
  }

  function startMatch() {
    clearWorldEntities();
    playerHp = 100;
    alive = true;
    kills = 0;
    slots[1] = null;
    slots[2] = null;
    activeSlot = 4;
    reloading = null;
    healing = null;
    Object.assign(inventory, { snowballs: 0, flashbangs: 0, medkits: 0, drinks: 0, helmet: 0, vest: 0 });
    onWeaponModelChange?.('hands');
    for (const s of snowmen) placeSnowman(s);
    resetBots();
    matchTime = 0;

    // Random flight path crossing the campus
    const cx = (playArea.minX + playArea.maxX) / 2 + rand(-60, 60);
    const cz = (playArea.minZ + playArea.maxZ) / 2 + rand(-60, 60);
    const ang = Math.random() * Math.PI * 2;
    const half = 430;
    planeState.dir.set(Math.cos(ang), 0, Math.sin(ang));
    planeState.start.set(cx - planeState.dir.x * half, 0, cz - planeState.dir.z * half);
    planeState.end.set(cx + planeState.dir.x * half, 0, cz + planeState.dir.z * half);
    const alt = Math.max(getTerrainHeight(cx, cz), 20) + planeState.alt;
    planeState.start.y = alt;
    planeState.end.y = alt;
    planeState.len = half * 2;
    planeState.t = 0;
    plane.visible = true;
    plane.position.copy(planeState.start);
    plane.lookAt(planeState.end);
    plane.rotateY(Math.PI);

    startZone();
    matchPhase = 'plane';
    ws?.readyState === 1 && ws.send(JSON.stringify({ type: 'respawn' }));
    notify();
  }

  function planeAnchor() {
    const p = planePos(planeState.t);
    return { pos: p.add(new THREE.Vector3(0, -3.2, 0)), vel: planeState.dir.clone().multiplyScalar(planeState.speed) };
  }

  function getPlaneInfo() {
    return { start: planeState.start, end: planeState.end, t: planeState.t, active: plane.visible };
  }

  /* ------------------------------ Main update ------------------------------ */
  function update(dt, playerPos, playerYaw, isFirstPerson) {
    lastPlayerPos = playerPos ? playerPos.clone() : lastPlayerPos;
    if (matchPhase === 'lobby') return;
    matchTime += dt;

    // Plane flight
    if (plane.visible) {
      planeState.t += (planeState.speed * dt) / planeState.len;
      plane.position.copy(planePos(Math.min(1.08, planeState.t)));
      plane.traverse((o) => {
        if (o.userData.spin) o.rotation.z += dt * 40;
      });
      if (planeState.t >= 1) {
        callbacks.onPlaneEnd?.();
        for (const b of bots) if (b.state === 'plane') b.jumpT = 0;
      }
      if (planeState.t >= 1.08) plane.visible = false;
    }

    const pPhase = callbacks.getPlayerPhase?.() || 'ground';
    if (matchPhase === 'plane' && pPhase === 'ground') {
      matchPhase = 'live';
      onBanner?.('🪂 착지! 눈사람을 잡아 무기를 파밍하세요', 'info');
    }

    updateZone(dt);
    blueWall.visible = zone.phaseIdx >= 0;
    blueWall.position.set(zone.cur.x, 60, zone.cur.z);
    blueWall.scale.set(zone.cur.r, 1, zone.cur.r);
    whiteRing.visible = zone.phaseIdx >= 0 && zone.state === 'wait';
    whiteRing.position.set(zone.next.x, getTerrainHeight(zone.next.x, zone.next.z) + 1.5, zone.next.z);
    whiteRing.scale.set(zone.next.r, 1, zone.next.r);

    if (matchPhase === 'live' && alive && playerPos && outsideZone(playerPos.x, playerPos.z)) {
      applyPlayerDamage(zone.dps * dt, '자기장');
    }

    // reload / heal timers
    if (reloading) {
      reloading.t += dt;
      if (reloading.t >= reloading.dur) finishReload();
    }
    if (healing) {
      healing.t += dt;
      if (healing.t >= healing.dur) finishHeal();
    }

    // Networking
    netSyncTimer += dt;
    if (ws && ws.readyState === 1 && playerPos && netSyncTimer >= 0.06) {
      netSyncTimer = 0;
      ws.send(JSON.stringify({ type: 'move', x: playerPos.x, y: playerPos.y, z: playerPos.z, yaw: playerYaw || 0, hp: playerHp, alive, weapon: slots[activeSlot]?.key || null }));
    }
    for (const rp of remotePlayers.values()) {
      rp.avatar.group.position.x += (rp.tx - rp.avatar.group.position.x) * 0.25;
      rp.avatar.group.position.y += (rp.ty - 1.75 - rp.avatar.group.position.y) * 0.25;
      rp.avatar.group.position.z += (rp.tz - rp.avatar.group.position.z) * 0.25;
      rp.avatar.group.rotation.y = rp.yaw + Math.PI;
    }

    // Loot animation
    for (const d of drops) {
      d.age += dt;
      d.model.rotation.y += 1.4 * dt;
      d.mesh.position.y = d.baseY + Math.sin(d.age * 2.4) * 0.12;
    }

    // Airdrops
    for (const a of airdrops) {
      a.age += dt;
      const gy = getTerrainHeight(a.x, a.z);
      if (!a.landed) {
        a.group.position.y -= 9 * dt;
        a.group.rotation.y += dt * 0.3;
        if (a.group.position.y <= gy) {
          a.group.position.y = gy;
          a.landed = true;
          a.chute.visible = false;
        }
      } else {
        a.smoke.material.opacity = 0.18 + Math.sin(a.age * 3) * 0.05;
        if (!a.opened) {
          if (alive && playerPos && Math.hypot(playerPos.x - a.x, playerPos.z - a.z) < 3.2) openAirdrop(a);
          for (const b of bots) if (b.alive && b.state === 'ground' && Math.hypot(b.x - a.x, b.z - a.z) < 3) openAirdrop(a);
        }
      }
      a.beacon.material.emissiveIntensity = 0.6 + Math.sin(a.age * 6) * 0.4;
    }

    updateSnowmen(dt);
    updateBots(dt);
    updateProjectiles(dt);

    if (matchPhase === 'live' && alive && aliveCount() === 1) {
      endMatch(true);
    }

    if (Math.floor(matchTime * 4) !== Math.floor((matchTime - dt) * 4)) notify();
  }

  function notify() {
    const near = matchPhase === 'live' && alive ? nearestPlayerDrop() : null;
    onStatsChange({
      playerHp,
      kills,
      activeSlot,
      alive,
      matchPhase,
      slots: {
        1: slots[1] ? { ...slots[1], meta: WEAPON_CATALOG[slots[1].key] } : null,
        2: slots[2] ? { ...slots[2], meta: WEAPON_CATALOG[slots[2].key] } : null,
      },
      inventory: { ...inventory },
      survivors: aliveCount(),
      total: TOTAL_PLAYERS + remotePlayers.size,
      zone: {
        phase: Math.max(1, zone.phaseIdx + 1),
        state: zone.state,
        timer: Math.max(0, zone.timer),
        outside: !!(lastPlayerPos && outsideZone(lastPlayerPos.x, lastPlayerPos.z)),
        distToSafe: lastPlayerPos ? Math.max(0, Math.hypot(lastPlayerPos.x - zone.next.x, lastPlayerPos.z - zone.next.z) - zone.next.r) : 0,
      },
      reloading: reloading ? { p: reloading.t / reloading.dur } : null,
      healing: healing ? { p: healing.t / healing.dur, type: healing.type } : null,
      pickup: near ? near.drop.label : null,
    });
  }

  function getRadarData() {
    return {
      zone: { cur: zone.cur, next: zone.next, showNext: zone.state === 'wait' },
      snowmen: snowmen.filter((s) => s.alive).map((s) => ({ x: s.x, z: s.z, alive: true })),
      rivals: [], // PUBG: enemies are not shown on the minimap
      drops: drops.map((d) => ({ x: d.x, z: d.z, color: d.drop.color })),
      airdrops: airdrops.map((a) => ({ x: a.x, z: a.z })),
      plane: plane.visible ? getPlaneInfo() : null,
    };
  }

  notify();

  return {
    update,
    fireActiveSlot,
    reloadActiveGun,
    useItem,
    selectSlot,
    cycleSlot,
    pickUp,
    startMatch,
    planeAnchor,
    getRadarData,
    getActiveWeaponKey: () => (activeSlot === 1 || activeSlot === 2 ? slots[activeSlot]?.key || null : null),
    getActiveSpec,
    isAlive: () => alive,
    getMatchPhase: () => matchPhase,
    getSpectateTarget: () => {
      const b = bots.find((x) => x.alive && x.state === 'ground');
      return b ? new THREE.Vector3(b.x, b.y, b.z) : null;
    },
    reset: startMatch,
  };
}
