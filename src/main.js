import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadKwangwoonMapData } from './map/osmLoader.js';
import { buildCampusWorld } from './map/worldBuilder.js';
import { createSurvivalCombatSystem } from './game/survivalCombat.js';
import { createFirstPersonController } from './game/firstPerson.js';
import kwangwoonGeoJsonRaw from './data/kwangwoon.geojson?raw';

const osmJson = JSON.parse(kwangwoonGeoJsonRaw);

const canvas = document.getElementById('game-canvas');
const labelsLayer = document.getElementById('labels-layer');
const hitVignette = document.getElementById('hit-vignette');
const flashOverlay = document.getElementById('flash-overlay');
const killFeed = document.getElementById('kill-feed');
const modeToggleBtn = document.getElementById('mode-toggle-btn');
const resetBtn = document.getElementById('reset-btn');
const hpText = document.getElementById('hp-text');
const hpFill = document.getElementById('hp-fill');
const killsText = document.getElementById('kills-text');
const survivorsText = document.getElementById('survivors-text');
const zoneText = document.getElementById('zone-text');
const ammoRifle = document.getElementById('ammo-rifle');
const ammoGrenade = document.getElementById('ammo-grenade');
const ammoFlashbang = document.getElementById('ammo-flashbang');
const crosshair = document.getElementById('crosshair');
const fpHint = document.getElementById('fp-hint');
const fpStartBtn = document.getElementById('fp-start-btn');
const fpExitBtn = document.getElementById('fp-exit-btn');
const orbitHint = document.getElementById('orbit-hint');
const subtitleText = document.getElementById('subtitle-text');
const weaponBtns = document.querySelectorAll('.weapon-slot');

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
const snowMat = new THREE.PointsMaterial({
  color: '#ffffff',
  size: 1.6,
  transparent: true,
  opacity: 0.85,
});
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
  while (killFeed.children.length > 4) {
    killFeed.lastChild.remove();
  }
  setTimeout(() => el.remove(), 4500);
}

// Survival Combat System (Guns, Grenades, Flashbangs, Snowmen Drops, Blizzard Zone, Multiplayer)
let hitFlashTimeout = null;
let flashbangTimeout = null;
const combat = createSurvivalCombatSystem(scene, world, {
  onStatsChange: ({ playerHp, kills, activeWeapon, ammo, survivors, zoneRadius }) => {
    const hpRounded = Math.round(playerHp);
    hpText.textContent = `${hpRounded}`;
    hpFill.style.width = `${Math.max(0, Math.min(100, hpRounded))}%`;
    hpFill.classList.toggle('low', hpRounded <= 35);
    killsText.textContent = `${kills}`;
    survivorsText.textContent = `${survivors}`;
    zoneText.textContent = `${zoneRadius}m`;

    ammoRifle.textContent = `${ammo.rifle}`;
    ammoGrenade.textContent = `${ammo.grenade}`;
    ammoFlashbang.textContent = `${ammo.flashbang}`;

    weaponBtns.forEach((b) => {
      b.classList.toggle('active', b.dataset.weapon === activeWeapon);
    });
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
});

// First-Person Controller
const firstPerson = createFirstPersonController(camera, canvas, world.buildings, world.covers);
firstPerson.bindEvents((locked) => {
  if (!firstPerson.isEnabled()) return;
  fpHint.classList.toggle('hidden', locked);
  crosshair.classList.toggle('hidden', !locked);
});

function setMode(isFP) {
  if (isFP) {
    orbitControls.enabled = false;
    firstPerson.enter();
    modeToggleBtn.textContent = '🗺️ 전체 맵';
    modeToggleBtn.classList.add('active-fp');
    subtitleText.textContent = '교전 중 · 눈사람 처치 시 무기/수류탄 보급';
    orbitHint.classList.add('hidden');
    fpHint.classList.remove('hidden');
    crosshair.classList.add('hidden');
  } else {
    firstPerson.exit();
    orbitControls.enabled = true;
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

modeToggleBtn.addEventListener('click', () => {
  setMode(!firstPerson.isEnabled());
});

fpStartBtn.addEventListener('click', () => {
  firstPerson.requestLock();
});

fpExitBtn.addEventListener('click', () => {
  setMode(false);
});

resetBtn.addEventListener('click', () => {
  combat.reset();
});

weaponBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    combat.setWeapon(btn.dataset.weapon);
  });
});

// Number keys 1-4 to switch weapons
window.addEventListener('keydown', (e) => {
  if (e.key === '1') combat.setWeapon('pistol');
  else if (e.key === '2') combat.setWeapon('rifle');
  else if (e.key === '3') combat.setWeapon('grenade');
  else if (e.key === '4') combat.setWeapon('flashbang');
});

// Shooting & throwing in First-Person
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !firstPerson.isEnabled()) return;
  if (firstPerson.isLocked()) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const origin = camera.position.clone().add(new THREE.Vector3(0, -0.22, 0));
    combat.firePlayerWeapon(origin, dir);
    firstPerson.triggerRecoil();
  } else {
    firstPerson.requestLock();
  }
});

// Start immediately in 1st-person FPS mode
setMode(true);

// Resize
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
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
