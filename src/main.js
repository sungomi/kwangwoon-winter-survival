import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadKwangwoonMapData } from './map/osmLoader.js';
import { buildCampusWorld } from './map/worldBuilder.js';
import { getTerrainHeight } from './map/terrain.js';
import { createSurvivalCombatSystem, WEAPON_CATALOG, RARITY_COLORS } from './game/survivalCombat.js';
import { createFirstPersonController } from './game/firstPerson.js';
import { createCollisionWorld } from './game/collision.js';
import { createMinimap } from './game/minimap.js';
import kwangwoonGeoJsonRaw from './data/kwangwoon.geojson?raw';

const osmJson = JSON.parse(kwangwoonGeoJsonRaw);
const $ = (id) => document.getElementById(id);

const canvas = $('game-canvas');
const labelsLayer = $('labels-layer');

/* ------------------------------ Renderer / scene ------------------------------ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d2f4a');
scene.fog = new THREE.Fog('#26395a', 260, 900);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1600);
const ORBIT_DEFAULT_POS = new THREE.Vector3(-260, 210, 260);
camera.position.copy(ORBIT_DEFAULT_POS);
scene.add(camera);

const hemiLight = new THREE.HemisphereLight('#cfe3ff', '#4b5a6e', 1.15);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight('#eef4ff', 1.45);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.bias = -0.0004;
dirLight.shadow.normalBias = 0.05;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 420;
const SHADOW_HALF = 110;
dirLight.shadow.camera.left = -SHADOW_HALF;
dirLight.shadow.camera.right = SHADOW_HALF;
dirLight.shadow.camera.top = SHADOW_HALF;
dirLight.shadow.camera.bottom = -SHADOW_HALF;
scene.add(dirLight);
scene.add(dirLight.target);

/* ------------------------------ World ------------------------------ */
const mapData = loadKwangwoonMapData(osmJson);
const world = buildCampusWorld(scene, mapData, labelsLayer);
const collision = createCollisionWorld({ buildings: world.buildings, covers: world.covers, fences: world.fences });

// Battleground = the real campus outline (+ a margin into the surrounding streets / forest)
const playArea = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const ring of mapData.campusOutlines || []) {
    for (const [x, z] of ring) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
  }
  if (!Number.isFinite(minX)) return { minX: -200, maxX: 200, minZ: -200, maxZ: 200 };
  return { minX: minX - 30, maxX: maxX + 30, minZ: minZ - 30, maxZ: maxZ + 30 };
})();

const minimap = createMinimap($('minimap-canvas'), mapData, playArea);

// Falling snow follows the camera
const SNOW_COUNT = 1600;
const snowPositions = new Float32Array(SNOW_COUNT * 3);
for (let i = 0; i < SNOW_COUNT; i++) {
  snowPositions[i * 3] = (Math.random() - 0.5) * 220;
  snowPositions[i * 3 + 1] = Math.random() * 90;
  snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
}
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
const snowPoints = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.45, transparent: true, opacity: 0.85 }));
scene.add(snowPoints);

const orbitControls = new OrbitControls(camera, canvas);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.maxPolarAngle = Math.PI * 0.46;
orbitControls.minDistance = 12;
orbitControls.maxDistance = 520;
orbitControls.target.set((playArea.minX + playArea.maxX) / 2, 0, (playArea.minZ + playArea.maxZ) / 2);

/* ------------------------------ HUD helpers ------------------------------ */
const hud = $('hud');
const killFeed = $('kill-feed');
function pushFeed(text) {
  const el = document.createElement('div');
  el.className = 'feed-item';
  if (text.startsWith('💀')) el.classList.add('kill');
  el.textContent = text;
  killFeed.prepend(el);
  while (killFeed.children.length > 6) killFeed.lastChild.remove();
  setTimeout(() => el.remove(), 6000);
}

let bannerTimeout = null;
function showBanner(text, tone = 'info') {
  const el = $('banner');
  el.textContent = text;
  el.className = `banner ${tone}`;
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => el.classList.add('hidden'), 3800);
}

let hitmarkerTimeout = null;
function showHitmarker(kill, head) {
  const el = $('hitmarker');
  el.className = `hitmarker show${kill ? ' kill' : ''}${head ? ' head' : ''}`;
  clearTimeout(hitmarkerTimeout);
  hitmarkerTimeout = setTimeout(() => (el.className = 'hitmarker'), kill ? 380 : 140);
}

// Compass strip (PUBG style): ticks every 15°, letters at cardinals
(function buildCompass() {
  const strip = $('compass-strip');
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  let html = '';
  for (let rep = 0; rep < 3; rep++) {
    for (let d = 0; d < 360; d += 15) {
      const lab = labels[d];
      html += `<span class="ct${lab ? ' major' : ''}${lab && lab.length === 1 ? ' card' : ''}">${lab || (d % 45 === 0 ? '' : d)}</span>`;
    }
  }
  strip.innerHTML = html;
})();
const COMPASS_STEP_PX = 40; // width of each 15° tick span (matches CSS)
function updateCompass(yaw) {
  // yaw 0 faces -Z (north on our map since z = -lat)
  let heading = ((-yaw * 180) / Math.PI) % 360;
  if (heading < 0) heading += 360;
  const px = (heading / 15) * COMPASS_STEP_PX + 24 * COMPASS_STEP_PX; // middle repetition
  $('compass-strip').style.transform = `translateX(${-px}px)`;
  $('compass-deg').textContent = Math.round(heading);
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------------ Controllers ------------------------------ */
const firstPerson = createFirstPersonController(camera, canvas, collision, scene, playArea);
const inventoryModal = $('inventory-modal');
const mapModal = $('map-modal');
let uiMode = 'lobby'; // lobby | play | spectate

firstPerson.bindEvents((locked) => {
  if (uiMode !== 'play') return;
  const overlayOpen = !inventoryModal.classList.contains('hidden') || !mapModal.classList.contains('hidden');
  $('pause').classList.toggle('hidden', locked || overlayOpen || combat.getMatchPhase() === 'over');
  if (!locked) firing = false;
});

let lastStats = null;
let flashbangTimeout = null;
let hitFlashTimeout = null;

const combat = createSurvivalCombatSystem(scene, world, collision, playArea, {
  onStatsChange: (s) => {
    lastStats = s;
    renderStats(s);
  },
  onPlayerHit: () => {
    $('hit-vignette').classList.add('active');
    clearTimeout(hitFlashTimeout);
    hitFlashTimeout = setTimeout(() => $('hit-vignette').classList.remove('active'), 220);
  },
  onFlashbang: () => {
    $('flash-overlay').classList.add('active');
    clearTimeout(flashbangTimeout);
    flashbangTimeout = setTimeout(() => $('flash-overlay').classList.remove('active'), 2000);
  },
  onFeed: pushFeed,
  onBanner: showBanner,
  onHitMarker: showHitmarker,
  onWeaponModelChange: (key) => firstPerson.setWeaponModel(key),
  onSpeedBoost: (secs) => firstPerson.grantSpeedBoost(secs),
  getPlayerPhase: () => firstPerson.getPhase(),
  onPlaneEnd: () => {
    if (firstPerson.getPhase() === 'plane') {
      firstPerson.jump();
      showBanner('🪂 수송기가 항로 끝에 도달해 강제 낙하!', 'warn');
    }
  },
  onMatchOver: (r) => showResults(r),
});

firstPerson.onPhase((p) => {
  if (p === 'freefall') showBanner('🪂 낙하 중 · W로 급강하, F로 낙하산', 'info');
  if (p === 'parachute') showBanner('🪂 낙하산 전개 · 착지 지점을 조종하세요', 'info');
});

/* ------------------------------ Stats → DOM ------------------------------ */
function setChip(id, value, active, lvl = 0) {
  const el = $(id);
  el.querySelector('b').textContent = value;
  el.classList.toggle('active', !!active);
  el.dataset.lvl = lvl;
}

function renderStats(s) {
  const hp = Math.round(s.playerHp);
  $('hp-text').textContent = hp;
  $('hp-fill').style.width = `${Math.max(0, Math.min(100, s.playerHp))}%`;
  $('hp-fill').classList.toggle('low', hp <= 35);
  $('alive-text').textContent = s.survivors;
  $('kills-text').textContent = s.kills;

  const inv = s.inventory;
  setChip('gear-helmet', inv.helmet ? `Lv.${inv.helmet}` : '-', inv.helmet, inv.helmet);
  setChip('gear-vest', inv.vest ? `Lv.${inv.vest}` : '-', inv.vest, inv.vest);
  setChip('gear-ammo', inv.snowballs, inv.snowballs > 0);
  setChip('gear-heal', inv.medkits, inv.medkits > 0);
  setChip('gear-drink', inv.drinks, inv.drinks > 0);
  setChip('gear-flash', inv.flashbangs, inv.flashbangs > 0);

  for (const n of [1, 2]) {
    const slot = s.slots[n];
    const btn = document.querySelector(`.weapon-slot[data-slot="${n}"]`);
    if (slot) {
      $(`slot${n}-icon`).textContent = slot.meta.icon;
      $(`slot${n}-name`).textContent = slot.meta.name;
      $(`slot${n}-ammo`).innerHTML = `${slot.mag}<small> / ${inv.snowballs}</small>`;
      btn.style.setProperty('--rarity', RARITY_COLORS[slot.meta.rarity] || '#e2e8f0');
      btn.classList.add('filled');
      btn.classList.toggle('empty-mag', slot.mag === 0);
    } else {
      $(`slot${n}-icon`).textContent = '—';
      $(`slot${n}-name`).textContent = n === 1 ? '주무기 없음' : '보조무기 없음';
      $(`slot${n}-ammo`).textContent = '-';
      btn.classList.remove('filled', 'empty-mag');
    }
  }
  $('slot3-ammo').textContent = inv.flashbangs;
  $('slot4-ammo').textContent = inv.snowballs;
  document.querySelectorAll('.weapon-slot').forEach((b) => b.classList.toggle('active', Number(b.dataset.slot) === s.activeSlot));

  // zone
  const z = s.zone;
  if (z.state === 'done') {
    $('zone-label').textContent = '최종 자기장';
    $('zone-timer').textContent = '';
  } else {
    $('zone-label').textContent = `${z.phase}단계 · ${z.state === 'wait' ? '수축까지' : '수축 중'}`;
    $('zone-timer').textContent = fmtTime(z.timer);
  }
  $('zone-icon').textContent = z.state === 'shrink' ? '⚠️' : '⏱';
  document.querySelector('.zone-panel').classList.toggle('shrinking', z.state === 'shrink');
  $('zone-dist').textContent = z.outside ? `🔵 자기장 밖! 안전구역까지 ${Math.round(z.distToSafe)}m` : z.distToSafe > 0 ? `🏃 다음 안전구역까지 ${Math.round(z.distToSafe)}m` : '✅ 다음 안전구역 안';
  if (s.matchPhase === 'plane') $('zone-dist').textContent = '✈️ 착지 후 흰 원(다음 안전구역)으로 이동하세요';
  $('zone-dist').classList.toggle('danger', z.outside && s.matchPhase === 'live');
  $('zone-vignette').classList.toggle('active', z.outside && s.alive && s.matchPhase === 'live');

  // inventory modal
  $('inv-helmet').textContent = `🪖 뚝배기 : ${inv.helmet ? `${inv.helmet}레벨` : '없음'}`;
  $('inv-vest').textContent = `🦺 조끼 : ${inv.vest ? `${inv.vest}레벨` : '없음'}`;
  $('inv-slot1').textContent = `1 · 주무기 : ${s.slots[1] ? `${s.slots[1].meta.icon} ${s.slots[1].meta.name} (${s.slots[1].mag}/${s.slots[1].meta.mag})` : '없음'}`;
  $('inv-slot2').textContent = `2 · 보조무기 : ${s.slots[2] ? `${s.slots[2].meta.icon} ${s.slots[2].meta.name} (${s.slots[2].mag}/${s.slots[2].meta.mag})` : '없음'}`;
  $('inv-snowballs').textContent = `❄️ 눈덩이 탄약 : ${inv.snowballs}`;
  $('inv-flashbangs').textContent = `⚡ 눈광탄 : ${inv.flashbangs}`;
  $('inv-medkits').textContent = inv.medkits;
  $('inv-drinks').textContent = inv.drinks;
}

/* ------------------------------ Overlays ------------------------------ */
function toggleInventory(force = null) {
  const open = force !== null ? force : inventoryModal.classList.contains('hidden');
  inventoryModal.classList.toggle('hidden', !open);
  if (open) {
    mapModal.classList.add('hidden');
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    $('pause').classList.add('hidden');
  } else if (uiMode === 'play') firstPerson.requestLock();
}

function toggleMap(force = null) {
  const open = force !== null ? force : mapModal.classList.contains('hidden');
  mapModal.classList.toggle('hidden', !open);
  if (open) {
    inventoryModal.classList.add('hidden');
    $('pause').classList.add('hidden');
  }
}

function startMatch() {
  uiMode = 'play';
  $('lobby').classList.add('hidden');
  $('results').classList.add('hidden');
  $('spectate-hint').classList.add('hidden');
  $('again-corner-btn').classList.add('hidden');
  hud.classList.remove('hidden');
  killFeed.innerHTML = '';
  orbitControls.enabled = false;
  combat.startMatch();
  firstPerson.enter();
  firstPerson.boardPlane(() => combat.planeAnchor());
  firstPerson.setFrozen(false);
  firstPerson.requestLock();
  showBanner('✈️ 수송기 탑승 · 원하는 곳에서 F로 뛰어내리세요', 'info');
}

function showResults(r) {
  firing = false;
  firstPerson.setFrozen(true);
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  $('pause').classList.add('hidden');
  const won = r.won;
  $('res-rank').textContent = `#${r.rank}`;
  $('res-rank').classList.toggle('gold', won);
  $('res-title').textContent = won ? '이겼닭! 오늘 저녁은 치킨이닭! 🍗' : r.rank <= 5 ? '아깝다! 다음엔 치킨을...' : '그럴 수 있어. 이런 날도 있는 거지 뭐.';
  $('res-place').textContent = `${r.rank} / ${r.total}`;
  $('res-kills').textContent = r.kills;
  $('res-time').textContent = fmtTime(r.time);
  $('res-killer').textContent = won ? '' : r.killer ? `☠️ ${r.killer}에게 쓰러졌습니다` : '';
  setTimeout(() => $('results').classList.remove('hidden'), won ? 300 : 1200);
}

function enterSpectate() {
  uiMode = 'spectate';
  $('results').classList.add('hidden');
  $('spectate-hint').classList.remove('hidden');
  $('again-corner-btn').classList.remove('hidden');
  $('crosshair').classList.add('hidden');
  firstPerson.exit();
  orbitControls.enabled = true;
  camera.fov = 60;
  camera.updateProjectionMatrix();
  const t = combat.getSpectateTarget() || new THREE.Vector3(orbitControls.target.x, 0, orbitControls.target.z);
  orbitControls.target.copy(t);
  camera.position.copy(t).add(new THREE.Vector3(-40, 45, 40));
}

$('start-btn').addEventListener('click', startMatch);
$('again-btn').addEventListener('click', startMatch);
$('again-corner-btn').addEventListener('click', startMatch);
$('spectate-btn').addEventListener('click', enterSpectate);
$('resume-btn').addEventListener('click', () => firstPerson.requestLock());
$('inv-toggle-btn').addEventListener('click', () => toggleInventory());
$('inv-close-btn').addEventListener('click', () => toggleInventory(false));
$('map-toggle-btn').addEventListener('click', () => toggleMap());
$('map-close-btn').addEventListener('click', () => toggleMap(false));
$('use-medkit-btn').addEventListener('click', () => combat.useItem('medkit'));
$('use-drink-btn').addEventListener('click', () => combat.useItem('drink'));
document.querySelectorAll('.weapon-slot').forEach((btn) => btn.addEventListener('click', () => combat.selectSlot(Number(btn.dataset.slot))));

window.addEventListener('keydown', (e) => {
  if (uiMode !== 'play') return;
  if (e.code === 'Tab') {
    e.preventDefault();
    toggleInventory();
    return;
  }
  if (e.code === 'KeyM') return toggleMap();
  if (e.code === 'Escape') {
    toggleMap(false);
    if (!inventoryModal.classList.contains('hidden')) toggleInventory(false);
    return;
  }
  if (firstPerson.getPhase() !== 'ground') return;
  if (e.key === '1') combat.selectSlot(1);
  else if (e.key === '2') combat.selectSlot(2);
  else if (e.key === '3') combat.selectSlot(3);
  else if (e.key === '4') combat.selectSlot(4);
  else if (e.key === '7') combat.useItem('medkit');
  else if (e.key === '8') combat.useItem('drink');
  else if (e.code === 'KeyR') combat.reloadActiveGun();
  else if (e.code === 'KeyF') combat.pickUp();
});

window.addEventListener('wheel', (e) => {
  if (uiMode === 'play' && firstPerson.isLocked() && firstPerson.getPhase() === 'ground') combat.cycleSlot(e.deltaY > 0 ? 1 : -1);
});
window.addEventListener('contextmenu', (e) => {
  if (uiMode === 'play') e.preventDefault();
});

/* ------------------------------ Firing / ADS ------------------------------ */
let firing = false;
let ads = false;
const BASE_FOV = 70;

function fireOnce() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const origin = camera.position.clone().add(new THREE.Vector3(0, -0.15, 0));
  const aimingDownAtSnow = dir.y < -0.45;
  const kick = combat.fireActiveSlot(origin, dir, aimingDownAtSnow, ads);
  if (kick > 0.015) firstPerson.triggerRecoil(ads ? kick * 0.6 : kick);
}

canvas.addEventListener('pointerdown', (e) => {
  if (uiMode !== 'play') return;
  if (!inventoryModal.classList.contains('hidden') || !mapModal.classList.contains('hidden')) return;
  if (!firstPerson.isLocked()) {
    firstPerson.requestLock();
    return;
  }
  if (firstPerson.getPhase() !== 'ground') {
    if (e.button === 0 && firstPerson.getPhase() === 'plane') firstPerson.jump();
    return;
  }
  if (e.button === 2) {
    ads = true;
    return;
  }
  if (e.button === 0) {
    firing = true;
    fireOnce();
  }
});
window.addEventListener('pointerup', (e) => {
  if (e.button === 0) firing = false;
  if (e.button === 2) ads = false;
});

/* ------------------------------ Resize ------------------------------ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------ Main loop ------------------------------ */
let lastTime = performance.now();
let lobbyAngle = 0;
let mapRedraw = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const phase = firstPerson.getPhase();
  if (uiMode === 'lobby') {
    lobbyAngle += dt * 0.06;
    const c = orbitControls.target;
    camera.position.set(c.x + Math.cos(lobbyAngle) * 330, 190, c.z + Math.sin(lobbyAngle) * 330);
    camera.lookAt(c.x, 0, c.z);
  } else if (uiMode === 'play' && firstPerson.isEnabled()) {
    firstPerson.update(dt);
  } else {
    orbitControls.update();
  }

  // auto fire
  if (uiMode === 'play' && firing && phase === 'ground') {
    const spec = combat.getActiveSpec();
    if (spec?.auto) fireOnce();
  }

  // ADS zoom (scoped guns zoom more)
  const spec = combat.getActiveSpec();
  const wantFov = uiMode === 'play' && ads && phase === 'ground' ? spec?.zoom || 52 : BASE_FOV;
  if (uiMode === 'play' && Math.abs(camera.fov - wantFov) > 0.1) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();
  }
  firstPerson.setSensitivity(camera.fov / BASE_FOV);
  const scoped = uiMode === 'play' && ads && phase === 'ground' && spec?.zoom && spec.zoom <= 34;
  $('scope-overlay').classList.toggle('hidden', !scoped);

  const playerPos = uiMode === 'play' ? firstPerson.getPosition() : null;
  combat.update(dt, playerPos, firstPerson.getYaw(), uiMode === 'play');
  world.animateFestive(now * 0.001);

  // HUD per-frame bits
  if (uiMode === 'play') {
    updateCompass(firstPerson.getYaw());
    const s = lastStats;
    const groundPlay = phase === 'ground' && combat.isAlive() && combat.getMatchPhase() === 'live';
    $('crosshair').classList.toggle('hidden', !groundPlay || scoped || !firstPerson.isLocked());
    $('crosshair').classList.toggle('ads', ads);

    let promptText = null;
    if (phase === 'plane') promptText = '<kbd>F</kbd> 뛰어내리기';
    else if (phase === 'freefall') promptText = '<kbd>F</kbd> 낙하산 펼치기 · <kbd>W</kbd> 급강하';
    else if (groundPlay && s?.pickup) promptText = `<kbd>F</kbd> ${s.pickup} 줍기`;
    $('prompt').innerHTML = promptText || '';
    $('prompt').classList.toggle('hidden', !promptText);

    const prog = s?.reloading ? { p: s.reloading.p, label: '재장전' } : s?.healing ? { p: s.healing.p, label: s.healing.type === 'medkit' ? '치료 중' : '마시는 중' } : null;
    $('progress').classList.toggle('hidden', !prog);
    if (prog) {
      $('progress-ring').style.strokeDashoffset = `${113 * (1 - prog.p)}`;
      $('progress-label').textContent = prog.label;
    }
    firstPerson.setReload(s?.reloading ? s.reloading.p : 0);

    const airborne = phase === 'freefall' || phase === 'parachute' || phase === 'plane';
    $('altimeter').classList.toggle('hidden', !airborne);
    if (airborne) {
      const alt = Math.max(0, firstPerson.getAltitude());
      $('alt-value').textContent = `${Math.round(alt)}m`;
      $('alt-fill').style.height = `${Math.min(100, (alt / 200) * 100)}%`;
    }
    if (s) firstPerson.setHandsSnowball(s.activeSlot === 4 && s.inventory.snowballs > 0);
  }

  // Snow & shadows follow the camera
  const posAttr = snowGeo.attributes.position;
  for (let i = 0; i < SNOW_COUNT; i++) {
    let y = posAttr.getY(i) - 7 * dt;
    const x = posAttr.getX(i) + Math.sin(now * 0.001 + i) * 0.8 * dt;
    if (y < 0) y = 90;
    posAttr.setXY(i, x, y);
  }
  posAttr.needsUpdate = true;
  const camGround = getTerrainHeight(camera.position.x, camera.position.z);
  snowPoints.position.set(camera.position.x, uiMode === 'play' && phase === 'ground' ? camGround - 5 : camera.position.y - 50, camera.position.z);
  const focus = uiMode === 'play' && phase === 'ground' ? camera.position : orbitControls.target;
  dirLight.position.set(focus.x + 110, focus.y + 170, focus.z + 95);
  dirLight.target.position.set(focus.x, focus.y, focus.z);

  const showLabels = (uiMode === 'play' && phase === 'ground') || uiMode === 'spectate';
  labelsLayer.style.display = showLabels ? '' : 'none';
  if (showLabels) world.updateLabels(camera, window.innerWidth, window.innerHeight, uiMode === 'play');

  const radar = combat.getRadarData();
  const mapState = {
    playerPos: playerPos ? { x: playerPos.x, z: playerPos.z } : null,
    playerYaw: firstPerson.getYaw(),
    ...radar,
  };
  if (uiMode === 'play') minimap.renderRadar(mapState);
  mapRedraw -= dt;
  if (!mapModal.classList.contains('hidden') && mapRedraw <= 0) {
    mapRedraw = 0.15;
    minimap.renderFull($('fullmap-canvas'), mapState);
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
