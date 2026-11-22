import * as THREE from 'three';
import { getTerrainHeight } from '../map/terrain.js';
import { createViewModels } from './gunModels.js';

const STAND_EYE_HEIGHT = 1.75;
const CROUCH_EYE_HEIGHT = 1.05;
const PLAYER_RADIUS = 0.7;

function pointInPolygon(x, z, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], zi = polygon[i][1];
    const xj = polygon[j][0], zj = polygon[j][1];
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isBlocked(x, z, buildings, covers = []) {
  for (const c of covers) {
    if (
      x >= c.minX - PLAYER_RADIUS &&
      x <= c.maxX + PLAYER_RADIUS &&
      z >= c.minZ - PLAYER_RADIUS &&
      z <= c.maxZ + PLAYER_RADIUS
    ) {
      return true;
    }
  }
  for (const b of buildings) {
    if (b.destroyed) continue;
    const { minX, maxX, minZ, maxZ } = b.bounds;
    if (x < minX - PLAYER_RADIUS || x > maxX + PLAYER_RADIUS || z < minZ - PLAYER_RADIUS || z > maxZ + PLAYER_RADIUS) {
      continue;
    }
    if (
      pointInPolygon(x, z, b.polygon) ||
      pointInPolygon(x + PLAYER_RADIUS, z, b.polygon) ||
      pointInPolygon(x - PLAYER_RADIUS, z, b.polygon) ||
      pointInPolygon(x, z + PLAYER_RADIUS, b.polygon) ||
      pointInPolygon(x, z - PLAYER_RADIUS, b.polygon)
    ) {
      return true;
    }
  }
  return false;
}

export function createFirstPersonController(camera, domElement, buildings, covers = []) {
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

  const keys = new Set();
  const pos = new THREE.Vector3(6, STAND_EYE_HEIGHT, 16);

  const viewModels = createViewModels(camera);
  viewModels.setRecoil(0, false);

  function findSafeSpawn() {
    const candidates = [
      [6 + (Math.random() - 0.5) * 28, 16 + (Math.random() - 0.5) * 24],
      [14 + (Math.random() - 0.5) * 24, -22 + (Math.random() - 0.5) * 18],
      [42 + (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 24],
      [(Math.random() - 0.5) * 24, 42 + (Math.random() - 0.5) * 16],
    ];
    for (const [cx, cz] of candidates) {
      if (!isBlocked(cx, cz, buildings, covers)) {
        pos.set(cx, getTerrainHeight(cx, cz) + STAND_EYE_HEIGHT, cz);
        return;
      }
    }
    for (let r = 10; r < 150; r += 10) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const cx = Math.cos(a) * r;
        const cz = Math.sin(a) * r;
        if (!isBlocked(cx, cz, buildings, covers)) {
          pos.set(cx, getTerrainHeight(cx, cz) + STAND_EYE_HEIGHT, cz);
          return;
        }
      }
    }
  }

  function applyCameraOrientation() {
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    camera.position.copy(pos);
  }

  function enter() {
    enabled = true;
    viewModels.setRecoil(0, true);
    findSafeSpawn();
    velY = 0;
    grounded = true;
    // Look toward campus center
    const dx = 15 - pos.x;
    const dz = -10 - pos.z;
    yaw = Math.atan2(-dx, -dz);
    pitch = 0.02;
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

  function requestLock() {
    if (!enabled) return;
    try {
      const res = domElement.requestPointerLock?.();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          // Fallback to drag-to-look when Pointer Lock is unavailable (e.g. embedded webview)
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

  function onMouseMove(e) {
    if (!enabled) return;
    const sensitivity = 0.0022;
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
    if (!enabled) return;
    keys.add(e.code);
    if (e.code === 'Space' && grounded) {
      velY = 8.2;
      grounded = false;
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onPointerLockChange(onLockChangeCb) {
    locked = document.pointerLockElement === domElement;
    onLockChangeCb?.(locked);
  }

  function update(dt) {
    if (!enabled) return;

    const isCrouching = keys.has('KeyC') || keys.has('ControlLeft');
    const targetEye = isCrouching ? CROUCH_EYE_HEIGHT : STAND_EYE_HEIGHT;
    currentEyeHeight += (targetEye - currentEyeHeight) * Math.min(1, dt * 14);

    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const move = new THREE.Vector3();
    if (keys.has('KeyW')) move.add(forward);
    if (keys.has('KeyS')) move.sub(forward);
    if (keys.has('KeyD')) move.add(right);
    if (keys.has('KeyA')) move.sub(right);

    if (speedBoostTimer > 0) speedBoostTimer -= dt;

    if (move.lengthSq() > 0) {
      move.normalize();
      const boostMul = speedBoostTimer > 0 ? 1.35 : 1.0;
      const baseSpd = (isCrouching ? 4.2 : 7.8) * boostMul;
      const speed = !isCrouching && (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 13.5 * boostMul : baseSpd;
      const stepX = move.x * speed * dt;
      const stepZ = move.z * speed * dt;

      if (!isBlocked(pos.x + stepX, pos.z, buildings, covers)) {
        pos.x += stepX;
      }
      if (!isBlocked(pos.x, pos.z + stepZ, buildings, covers)) {
        pos.z += stepZ;
      }
    }

    // Gravity & jump following hill terrain
    const floorY = getTerrainHeight(pos.x, pos.z) + currentEyeHeight;
    velY -= 22 * dt;
    pos.y += velY * dt;
    if (pos.y <= floorY) {
      pos.y = floorY;
      velY = 0;
      grounded = true;
    }

    // Gun recoil recovery
    recoilOffset = Math.max(0, recoilOffset - dt * 0.45);
    viewModels.setRecoil(recoilOffset, enabled);

    // Keep within map bounds
    pos.x = Math.max(-280, Math.min(280, pos.x));
    pos.z = Math.max(-280, Math.min(280, pos.z));

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
    return () => {
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', lockHandler);
    };
  }

  return {
    enter,
    exit,
    requestLock,
    update,
    bindEvents,
    isEnabled: () => enabled,
    isLocked: () => locked || activeFallback,
    getPosition: () => pos.clone(),
    getYaw: () => yaw,
    triggerRecoil: () => {
      recoilOffset = 0.09;
    },
    setWeaponModel: (key) => {
      viewModels.setModel(key);
    },
    grantSpeedBoost: (secs = 15) => {
      speedBoostTimer = Math.max(speedBoostTimer, secs);
    },
  };
}
