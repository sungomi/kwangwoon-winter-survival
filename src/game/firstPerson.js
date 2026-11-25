import * as THREE from 'three';
import { getTerrainHeight } from '../map/terrain.js';
import { createViewModels } from './gunModels.js';
import { buildParachuteModel } from './itemModels.js';

const STAND_EYE_HEIGHT = 1.75;
const CROUCH_EYE_HEIGHT = 1.05;
const PRONE_EYE_HEIGHT = 0.45;
const AUTO_CHUTE_HEIGHT = 55;

/**
 * 1인칭 컨트롤러 with PUBG-style drop phases:
 *   'plane'     – riding the transport plane (F to jump)
 *   'freefall'  – fast dive, WASD steers (F or low altitude opens the chute)
 *   'parachute' – slow glide, W pushes forward
 *   'ground'    – normal walking/running/crouch/prone on the real terrain
 */
export function createFirstPersonController(camera, domElement, collision, scene, bounds) {
  let enabled = false;
  let locked = false;
  let activeFallback = false;
  let isDragging = false;
  let lastDragX = 0;
  let lastDragY = 0;
  let yaw = -0.7;
  let pitch = 0.08;
  let velY = 0;
  let grounded = true;
  let currentEyeHeight = STAND_EYE_HEIGHT;
  let recoilOffset = 0;
  let onLockChangeCallback = null;
  let speedBoostTimer = 0;
  let phase = 'ground';
  let planeAnchor = null; // () => { pos: Vector3, vel: Vector3 }
  let onPhaseChange = null;
  let prone = false;
  let moveSpeedNow = 0;
  let frozen = false;

  const keys = new Set();
  const pos = new THREE.Vector3(6, STAND_EYE_HEIGHT, 16);
  const airVel = new THREE.Vector3();

  const viewModels = createViewModels(camera);
  viewModels.setRecoil(0, false);

  const chute = buildParachuteModel('#f97316');
  chute.visible = false;
  scene.add(chute);

  function setPhase(p) {
    if (phase === p) return;
    phase = p;
    chute.visible = p === 'parachute';
    onPhaseChange?.(p);
  }

  function applyCameraOrientation() {
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    camera.position.copy(pos);
  }

  function placeOnGround(x, z) {
    const [fx, fz] = collision.findFreeSpot(x, z);
    pos.set(fx, getTerrainHeight(fx, fz) + STAND_EYE_HEIGHT, fz);
    velY = 0;
    grounded = true;
    setPhase('ground');
  }

  function enter() {
    enabled = true;
    viewModels.setRecoil(0, phase === 'ground');
    applyCameraOrientation();
  }

  function exit() {
    enabled = false;
    viewModels.setRecoil(0, false);
    activeFallback = false;
    isDragging = false;
    keys.clear();
    if (document.pointerLockElement === domElement) {
      document.exitPointerLock?.();
    }
  }

  function boardPlane(anchorFn) {
    planeAnchor = anchorFn;
    prone = false;
    setPhase('plane');
    const a = planeAnchor();
    pos.copy(a.pos);
    yaw = Math.atan2(-a.vel.x, -a.vel.z);
    pitch = -0.35;
  }

  function jump() {
    if (phase !== 'plane') return;
    const a = planeAnchor();
    pos.copy(a.pos).add(new THREE.Vector3(0, -6, 0));
    airVel.set(a.vel.x * 0.25, 0, a.vel.z * 0.25);
    velY = 0;
    pitch = -0.6;
    setPhase('freefall');
  }

  function openChute() {
    if (phase !== 'freefall') return;
    velY = -6;
    pitch = -0.15;
    setPhase('parachute');
  }

  function requestLock() {
    if (!enabled) return;
    try {
      const res = domElement.requestPointerLock?.();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          activeFallback = true;
          onLockChangeCallback?.(true);
        });
      }
    } catch {
      activeFallback = true;
      onLockChangeCallback?.(true);
    }
  }

  function onMouseDown(e) {
    if (!enabled || locked || !activeFallback) return;
    isDragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
  }

  function onMouseUp() {
    isDragging = false;
  }

  let sensitivityMul = 1;
  function onMouseMove(e) {
    if (!enabled) return;
    const sensitivity = 0.0022 * sensitivityMul;
    if (locked) {
      yaw -= e.movementX * sensitivity;
      pitch -= e.movementY * sensitivity;
    } else if (activeFallback && isDragging) {
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      yaw -= dx * sensitivity * 1.4;
      pitch -= dy * sensitivity * 1.4;
    } else {
      return;
    }
    const maxPitch = Math.PI * 0.47;
    pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
  }

  function onKeyDown(e) {
    if (!enabled || frozen) return;
    keys.add(e.code);
    if (e.code === 'KeyF') {
      if (phase === 'plane') jump();
      else if (phase === 'freefall') openChute();
    }
    if (phase !== 'ground') return;
    if (e.code === 'Space' && grounded) {
      if (prone) prone = false;
      else {
        velY = 7.6;
        grounded = false;
      }
    }
    if (e.code === 'KeyZ') prone = !prone;
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onPointerLockChange(onLockChangeCb) {
    locked = document.pointerLockElement === domElement;
    onLockChangeCb?.(locked);
  }

  function clampToBounds() {
    pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
    pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));
  }

  function steerVector() {
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = new THREE.Vector3();
    if (keys.has('KeyW')) move.add(forward);
    if (keys.has('KeyS')) move.sub(forward);
    if (keys.has('KeyD')) move.add(right);
    if (keys.has('KeyA')) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();
    return move;
  }

  function update(dt) {
    if (!enabled) return;

    if (phase === 'plane') {
      const a = planeAnchor();
      pos.copy(a.pos);
      viewModels.setRecoil(0, false);
      // third-person chase camera orbiting the plane (mouse looks around)
      const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);
      const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
      camera.position.copy(pos).addScaledVector(back, 46).add(new THREE.Vector3(0, 8, 0));
      return;
    }

    if (phase === 'freefall' || phase === 'parachute') {
      const move = frozen ? new THREE.Vector3() : steerVector();
      const groundY = getTerrainHeight(pos.x, pos.z);
      if (phase === 'freefall') {
        // Diving (W + looking down) falls faster, like PUBG's 234 km/h dive
        const dive = keys.has('KeyW') ? 1 : 0;
        const targetVy = -(42 + dive * 18);
        velY += (targetVy - velY) * Math.min(1, dt * 1.6);
        const hs = 16 + dive * 6;
        airVel.x += (move.x * hs - airVel.x) * Math.min(1, dt * 1.2);
        airVel.z += (move.z * hs - airVel.z) * Math.min(1, dt * 1.2);
        if (pos.y - groundY < AUTO_CHUTE_HEIGHT) openChute();
      } else {
        const push = keys.has('KeyW') ? 1 : 0;
        const targetVy = -(5.5 + push * 2.5);
        velY += (targetVy - velY) * Math.min(1, dt * 2.5);
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const glide = forward.multiplyScalar(5 + push * 6).add(move.multiplyScalar(3));
        airVel.x += (glide.x - airVel.x) * Math.min(1, dt * 1.5);
        airVel.z += (glide.z - airVel.z) * Math.min(1, dt * 1.5);
        chute.position.set(pos.x, pos.y - 1.2, pos.z);
        chute.rotation.y = yaw;
      }
      pos.x += airVel.x * dt;
      pos.z += airVel.z * dt;
      pos.y += velY * dt;
      clampToBounds();
      // Land on roofs too
      const building = collision.buildingAt(pos.x, pos.z, 0.2);
      const roofY = building ? building.baseY + building.height : -Infinity;
      const floor = Math.max(groundY, roofY) + STAND_EYE_HEIGHT;
      if (pos.y <= floor) {
        if (building) placeOnGround(pos.x, pos.z);
        else {
          pos.y = floor;
          velY = 0;
          grounded = true;
          setPhase('ground');
        }
      }
      viewModels.setRecoil(0, false);
      applyCameraOrientation();
      return;
    }

    // ---- ground ----
    const isCrouching = !prone && (keys.has('KeyC') || keys.has('ControlLeft'));
    const targetEye = prone ? PRONE_EYE_HEIGHT : isCrouching ? CROUCH_EYE_HEIGHT : STAND_EYE_HEIGHT;
    currentEyeHeight += (targetEye - currentEyeHeight) * Math.min(1, dt * 12);

    const move = frozen ? new THREE.Vector3() : steerVector();
    if (speedBoostTimer > 0) speedBoostTimer -= dt;

    moveSpeedNow = 0;
    if (move.lengthSq() > 0) {
      const boostMul = speedBoostTimer > 0 ? 1.25 : 1.0;
      const sprint = !isCrouching && !prone && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
      // uphill is slower, downhill a little faster
      const ahead = getTerrainHeight(pos.x + move.x * 1.5, pos.z + move.z * 1.5) - getTerrainHeight(pos.x, pos.z);
      const slopeMul = Math.max(0.6, Math.min(1.15, 1 - ahead * 0.18));
      const speed = (prone ? 1.6 : isCrouching ? 3.8 : sprint ? 11.5 : 6.8) * boostMul * slopeMul;
      moveSpeedNow = speed;
      const stepX = move.x * speed * dt;
      const stepZ = move.z * speed * dt;
      if (!collision.isBlocked(pos.x + stepX, pos.z)) pos.x += stepX;
      if (!collision.isBlocked(pos.x, pos.z + stepZ)) pos.z += stepZ;
    }

    const floorY = getTerrainHeight(pos.x, pos.z) + currentEyeHeight;
    velY -= 22 * dt;
    pos.y += velY * dt;
    if (pos.y <= floorY) {
      pos.y = floorY;
      velY = 0;
      grounded = true;
    }

    recoilOffset = Math.max(0, recoilOffset - dt * 0.45);
    viewModels.setRecoil(recoilOffset, enabled, moveSpeedNow, dt);
    clampToBounds();
    applyCameraOrientation();
  }

  function bindEvents(onLockChangeCb) {
    onLockChangeCallback = onLockChangeCb;
    const lockHandler = () => onPointerLockChange(onLockChangeCb);
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerlockchange', lockHandler);
  }

  return {
    enter,
    exit,
    requestLock,
    update,
    bindEvents,
    boardPlane,
    jump,
    openChute,
    placeOnGround,
    isEnabled: () => enabled,
    isLocked: () => locked || activeFallback,
    getPosition: () => pos.clone(),
    getYaw: () => yaw,
    getPitch: () => pitch,
    getPhase: () => phase,
    getAltitude: () => pos.y - getTerrainHeight(pos.x, pos.z) - STAND_EYE_HEIGHT,
    isProne: () => prone,
    isCrouching: () => currentEyeHeight < STAND_EYE_HEIGHT - 0.2,
    setFrozen: (v) => {
      frozen = v;
      if (v) keys.clear();
    },
    setSensitivity: (m) => {
      sensitivityMul = m;
    },
    onPhase: (cb) => {
      onPhaseChange = cb;
    },
    triggerRecoil: (amount = 0.09) => {
      recoilOffset = Math.min(0.16, recoilOffset + amount);
      pitch = Math.min(Math.PI * 0.47, pitch + amount * 0.18);
    },
    setWeaponModel: (key) => viewModels.setModel(key),
    setReload: (p) => viewModels.setReload(p),
    setHandsSnowball: (v) => viewModels.setHandsSnowball(v),
    grantSpeedBoost: (secs = 15) => {
      speedBoostTimer = Math.max(speedBoostTimer, secs);
    },
  };
}
