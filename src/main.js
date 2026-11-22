import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadKwangwoonMapData } from './map/osmLoader.js';
import { buildCampusWorld } from './map/worldBuilder.js';
import { createSurvivalCombatSystem } from './game/survivalCombat.js';
import { createFirstPersonController } from './game/firstPerson.js';
import { createMinimap } from './game/minimap.js';
import kwangwoonGeoJsonRaw from './data/kwangwoon.geojson?raw';

const osmJson = JSON.parse(kwangwoonGeoJsonRaw);

const canvas = document.getElementById('game-canvas');
const labelsLayer = document.getElementById('labels-layer');
const hitVignette = document.getElementById('hit-vignette');
const flashOverlay = document.getElementById('flash-overlay');
const killFeed = document.getElementById('kill-feed');
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const resetBtn = document.getElementById('reset-btn');
const invToggleBtn = document.getElementById('inv-toggle-btn');
const invCloseBtn = document.getElementById('inv-close-btn');
const inventoryModal = document.getElementById('inventory-modal');

const hpText = document.getElementById('hp-text');
const hpFill = document.getElementById('hp-fill');
const gearHelmet = document.getElementById('gear-helmet');
const gearVest = document.getElementById('gear-vest');
const pouchSnowballs = document.getElementById('pouch-snowballs');

const killsText = document.getElementById('kills-text');
const survivorsText = document.getElementById('survivors-text');
const zoneText = document.getElementById('zone-text');

const slot1Icon = document.getElementById('slot1-icon');
const slot1Name = document.getElementById('slot1-name');
const slot1Ammo = document.getElementById('slot1-ammo');
const slot2Icon = document.getElementById('slot2-icon');
const slot2Name = document.getElementById('slot2-name');
const slot2Ammo = document.getElementById('slot2-ammo');
const slot3Ammo = document.getElementById('slot3-ammo');
const slot4Ammo = document.getElementById('slot4-ammo');

const invHelmet = document.getElementById('inv-helmet');
const invVest = document.getElementById('inv-vest');
const invSlot1 = document.getElementById('inv-slot1');
const invSlot2 = document.getElementById('inv-slot2');
const invSnowballs = document.getElementById('inv-snowballs');
const invFlashbangs = document.getElementById('inv-flashbangs');
const invMedkits = document.getElementById('inv-medkits');
const invDrinks = document.getElementById('inv-drinks');
const useMedkitBtn = document.getElementById('use-medkit-btn');
const useDrinkBtn = document.getElementById('use-drink-btn');

const crosshair = document.getElementById('crosshair');
const fpHint = document.getElementById('fp-hint');
const fpStartBtn = document.getElementById('fp-start-btn');
const fpExitBtn = document.getElementById('fp-exit-btn');
const orbitHint = document.getElementById('orbit-hint');
const subtitleText = document.getElementById('subtitle-text');
const weaponSlots = document.querySelectorAll('.weapon-slot');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Scene & Winter Evening Sky
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d2f4a');
scene.fog = new THREE.Fog('#1d2f4a', 320, 920);

// Camera
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1400);
const ORBIT_DEFAULT_POS = new THREE.Vector3(-120, 160, 180);
camera.position.copy(ORBIT_DEFAULT_POS);
scene.add(camera);

// Cozy Winter Lights
const hemiLight = new THREE.HemisphereLight('#c4dcff', '#4b5a6e', 0.95);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight('#e3eeff', 1.1);
dirLight.position.set(110, 170, 95);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 20;
dirLight.shadow.camera.far = 480;
const d = 200;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// Build Kwangwoon World
const mapData = loadKwangwoonMapData(osmJson);
const world = buildCampusWorld(scene, mapData, labelsLayer);
const minimap = createMinimap(document.getElementById('minimap-canvas'), mapData);

// Falling 3D Snow Particles
const SNOW_COUNT = 1200;
const snowPositions = new Float32Array(SNOW_COUNT * 3);
for (let i = 0; i < SNOW_COUNT; i++) {
  snowPositions[i * 3] = (Math.random() - 0.5) * 650;
  snowPositions[i * 3 + 1] = Math.random() * 180;
  snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 650;
}
const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
const snowMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, transparent: true, opacity: 0.85 });
const snowPoints = new THREE.Points(snowGeo, snowMat);
scene.add(snowPoints);

// Orbit Controls
const orbitControls = new OrbitControls(camera, canvas);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.maxPolarAngle = Math.PI * 0.46;
orbitControls.minDistance = 12;
orbitControls.maxDistance = 320;
orbitControls.target.set(0, 0, 0);

function pushFeed(text) {
  const el = document.createElement('div');
  el.className = 'feed-item';
  el.textContent = text;
  killFeed.prepend(el);
  while (killFeed.children.length > 4) killFeed.lastChild.remove();
  setTimeout(() => el.remove(), 4500);
}

// First-Person Controller
const firstPerson = createFirstPersonController(camera, canvas, world.buildings, world.covers);
firstPerson.bindEvents((locked) => {
  if (!firstPerson.isEnabled()) return;
  const invOpen = !inventoryModal.classList.contains('hidden');
  fpHint.classList.toggle('hidden', locked || invOpen);
  crosshair.classList.toggle('hidden', !locked || invOpen);
});

let hitFlashTimeout = null;
let flashbangTimeout = null;
const combat = createSurvivalCombatSystem(scene, world, {
  onStatsChange: ({ playerHp, kills, activeSlot, slots, inventory, survivors, zoneRadius }) => {
    const hpRounded = Math.round(playerHp);
    hpText.textContent = `${hpRounded}`;
    hpFill.style.width = `${Math.max(0, Math.min(100, hpRounded))}%`;
    hpFill.classList.toggle('low', hpRounded <= 35);

    gearHelmet.textContent = `🪖 ${inventory.helmet}뚝`;
    gearHelmet.classList.toggle('active', inventory.helmet > 0);
    gearVest.textContent = `🦺 ${inventory.vest}갑`;
    gearVest.classList.toggle('active', inventory.vest > 0);
    pouchSnowballs.textContent = `❄️ 눈덩이 ${inventory.snowballs}`;

    killsText.textContent = `${kills}`;
    survivorsText.textContent = `${survivors}`;
    zoneText.textContent = `${zoneRadius}m`;

    // Bottom 4 slots
    if (slots[1]) {
      slot1Icon.textContent = slots[1].meta.icon;
      slot1Name.textContent = slots[1].meta.name;
      slot1Ammo.textContent = `${slots[1].mag} / 100`;
    } else {
      slot1Icon.textContent = '➖';
      slot1Name.textContent = '주총 없음';
      slot1Ammo.textContent = '0 / 100';
    }

    if (slots[2]) {
      slot2Icon.textContent = slots[2].meta.icon;
      slot2Name.textContent = slots[2].meta.name;
      slot2Ammo.textContent = `${slots[2].mag} / 100`;
    } else {
      slot2Icon.textContent = '➖';
      slot2Name.textContent = '보조무기 없음';
      slot2Ammo.textContent = '0 / 100';
    }

    slot3Ammo.textContent = `${inventory.flashbangs}`;
    slot4Ammo.textContent = `${inventory.snowballs}`;

    weaponSlots.forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.slot) === activeSlot);
    });

    // Inventory modal sync
    invHelmet.textContent = `🪖 뚝배기 : ${inventory.helmet > 0 ? `Lv.${inventory.helmet} (${inventory.helmet}뚝)` : '없음'}`;
    invVest.textContent = `🦺 갑옷 : ${inventory.vest > 0 ? `Lv.${inventory.vest} (${inventory.vest}갑)` : '없음'}`;
    invSlot1.textContent = `1. 주총 : ${slots[1] ? `${slots[1].meta.name} (${slots[1].mag}/100)` : '없음'}`;
    invSlot2.textContent = `2. 보조무기 : ${slots[2] ? `${slots[2].meta.name} (${slots[2].mag}/100)` : '없음'}`;
    invSnowballs.textContent = `❄️ 공용 눈덩이 탄약 : ${inventory.snowballs}발`;
    invFlashbangs.textContent = `⚡ 눈광탄 : ${inventory.flashbangs}개`;
    invMedkits.textContent = `${inventory.medkits}`;
    invDrinks.textContent = `${inventory.drinks}`;
  },
  onPlayerHit: () => {
    hitVignette.classList.add('active');
    clearTimeout(hitFlashTimeout);
    hitFlashTimeout = setTimeout(() => hitVignette.classList.remove('active'), 220);
  },
  onFlashbang: () => {
    flashOverlay.classList.add('active');
    clearTimeout(flashbangTimeout);
    flashbangTimeout = setTimeout(() => flashOverlay.classList.remove('active'), 1800);
  },
  onFeed: pushFeed,
  onWeaponModelChange: (key) => {
    firstPerson.setWeaponModel(key);
  },
  onSpeedBoost: (secs) => {
    firstPerson.grantSpeedBoost(secs);
  },
});

function toggleInventory(forceState = null) {
  const willOpen = forceState !== null ? forceState : inventoryModal.classList.contains('hidden');
  inventoryModal.classList.toggle('hidden', !willOpen);
  if (willOpen) {
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    fpHint.classList.add('hidden');
    crosshair.classList.add('hidden');
  } else if (firstPerson.isEnabled()) {
    firstPerson.requestLock();
  }
}

function setMode(isFP) {
  if (isFP) {
    orbitControls.enabled = false;
    firstPerson.enter();
    modeToggleBtn.textContent = '🗺️ 전체 맵';
    modeToggleBtn.classList.add('active-fp');
    subtitleText.textContent = '4번 맨손으로 바닥 눈을 뭉쳐 눈사람을 잡으세요!';
    orbitHint.classList.add('hidden');
    fpHint.classList.remove('hidden');
    crosshair.classList.add('hidden');
  } else {
    firstPerson.exit();
    orbitControls.enabled = true;
    camera.fov = 58;
    camera.updateProjectionMatrix();
    camera.position.copy(ORBIT_DEFAULT_POS);
    orbitControls.target.set(0, 0, 0);
    orbitControls.update();
    modeToggleBtn.textContent = '🎯 1인칭 복귀';
    modeToggleBtn.classList.remove('active-fp');
    subtitleText.textContent = '관전 모드 · 1인칭 복귀 버튼으로 재참전';
    fpHint.classList.add('hidden');
    crosshair.classList.add('hidden');
    orbitHint.classList.remove('hidden');
  }
}

modeToggleBtn.addEventListener('click', () => setMode(!firstPerson.isEnabled()));
fpStartBtn.addEventListener('click', () => firstPerson.requestLock());
fpExitBtn.addEventListener('click', () => setMode(false));
resetBtn.addEventListener('click', () => combat.reset());
invToggleBtn.addEventListener('click', () => toggleInventory());
invCloseBtn.addEventListener('click', () => toggleInventory(false));
useMedkitBtn.addEventListener('click', () => combat.useItem('medkit'));
useDrinkBtn.addEventListener('click', () => combat.useItem('drink'));

weaponSlots.forEach((btn) => {
  btn.addEventListener('click', () => combat.selectSlot(Number(btn.dataset.slot)));
});

// Keyboard shortcuts: 1-4 weapons, R reload, Tab inventory
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    toggleInventory();
    return;
  }
  if (e.key === '1') combat.selectSlot(1);
  else if (e.key === '2') combat.selectSlot(2);
  else if (e.key === '3') combat.selectSlot(3);
  else if (e.key === '4') combat.selectSlot(4);
  else if (e.code === 'KeyR') combat.reloadActiveGun();
});

// Right-click ADS zoom for SR & DMR
window.addEventListener('contextmenu', (e) => {
  if (firstPerson.isEnabled()) e.preventDefault();
});

canvas.addEventListener('pointerdown', (e) => {
  if (!firstPerson.isEnabled() || !inventoryModal.classList.contains('hidden')) return;

  if (e.button === 2) {
    const k = combat.getActiveWeaponKey();
    camera.fov = k === 'sr' ? 24 : k === 'dmr' ? 36 : 58;
    camera.updateProjectionMatrix();
    return;
  }

  if (e.button !== 0) return;
  if (firstPerson.isLocked()) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const origin = camera.position.clone().add(new THREE.Vector3(0, -0.22, 0));
    const aimingDownAtSnow = dir.y < -0.22;
    if (combat.fireActiveSlot(origin, dir, aimingDownAtSnow)) {
      firstPerson.triggerRecoil();
    }
  } else {
    firstPerson.requestLock();
  }
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 2 && camera.fov !== 58) {
    camera.fov = 58;
    camera.updateProjectionMatrix();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main Loop
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (firstPerson.isEnabled()) {
    firstPerson.update(dt);
  } else {
    orbitControls.update();
  }

  combat.update(
    dt,
    firstPerson.isEnabled() ? firstPerson.getPosition() : null,
    firstPerson.getYaw(),
    firstPerson.isEnabled()
  );
  world.animateFestive(now * 0.001);

  const posAttr = snowGeo.attributes.position;
  for (let i = 0; i < SNOW_COUNT; i++) {
    let y = posAttr.getY(i) - 14 * dt;
    let x = posAttr.getX(i) + Math.sin(now * 0.001 + i) * 1.2 * dt;
    if (y < 0) y = 180;
    posAttr.setXY(i, x, y);
  }
  posAttr.needsUpdate = true;

  world.updateLabels(camera, window.innerWidth, window.innerHeight, firstPerson.isEnabled());
  minimap.render({
    playerPos: firstPerson.isEnabled() ? firstPerson.getPosition() : null,
    playerYaw: firstPerson.getYaw(),
    ...combat.getRadarData(),
  });
  renderer.render(scene, camera);
}

// Start in 1st-person unarmed mode
setMode(true);
requestAnimationFrame(animate);
