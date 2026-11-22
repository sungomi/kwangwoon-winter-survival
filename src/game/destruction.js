import * as THREE from 'three';
import { getTerrainHeight } from '../map/terrain.js';

const WEAPONS = {
  bomb: { radius: 20, damage: 70, color: '#ff6d00', count: 1, speed: 55 },
  airstrike: { radius: 16, damage: 50, color: '#ff3d00', count: 5, speed: 65 },
  bigbomb: { radius: 30, damage: 110, color: '#ffab00', count: 1, speed: 46 },
  ironball: { radius: 22, damage: 130, color: '#455a64', count: 1, speed: 70 },
  meteor: { radius: 24, damage: 90, color: '#ff5252', count: 4, speed: 78 },
  lightning: { radius: 20, damage: 120, color: '#00e5ff', count: 1, instant: true },
  nuke: { radius: 68, damage: 300, color: '#76ff03', count: 1, speed: 34 },
};

export function createDestructionSystem(scene, world, onStatsChange) {
  const projectiles = [];
  const effects = [];
  const debris = [];

  let activeWeapon = 'bomb';
  let started = false;
  let elapsed = 0;
  let combo = 0;
  let comboTimer = 0;
  let shakeTime = 0;
  let shakeIntensity = 0;

  const projGeo = new THREE.SphereGeometry(1.4, 10, 10);
  const debrisGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);

  function setWeapon(weaponKey) {
    if (WEAPONS[weaponKey]) activeWeapon = weaponKey;
  }

  function getWeapon() {
    return activeWeapon;
  }

  function triggerShake(amount, duration = 0.28) {
    shakeIntensity = Math.max(shakeIntensity, amount);
    shakeTime = Math.max(shakeTime, duration);
  }

  function spawnExplosion(x, y, z, radius, damage, color) {
    // Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.5, 1.6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, Math.max(y, getTerrainHeight(x, z)) + 0.25, z);
    scene.add(ring);
    effects.push({ mesh: ring, type: 'ring', age: 0, maxAge: 0.45, targetScale: radius * 0.85 });

    // Fireball sphere
    const ballGeo = new THREE.SphereGeometry(1, 12, 12);
    const ballMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(x, Math.max(1, y), z);
    scene.add(ball);
    effects.push({ mesh: ball, type: 'ball', age: 0, maxAge: 0.38, targetScale: radius * 0.45 });

    // Debris chunks
    const chunkCount = radius > 40 ? 28 : 12;
    for (let i = 0; i < chunkCount; i++) {
      const mat = new THREE.MeshLambertMaterial({
        color: i % 3 === 0 ? '#3a3f47' : i % 3 === 1 ? '#b8b0a4' : color,
      });
      const chunk = new THREE.Mesh(debrisGeo, mat);
      chunk.position.set(x + (Math.random() - 0.5) * 4, Math.max(1.5, y), z + (Math.random() - 0.5) * 4);
      const angle = Math.random() * Math.PI * 2;
      const spd = 8 + Math.random() * 18;
      scene.add(chunk);
      debris.push({
        mesh: chunk,
        vx: Math.cos(angle) * spd,
        vy: 10 + Math.random() * 18,
        vz: Math.sin(angle) * spd,
        age: 0,
        maxAge: 1.6 + Math.random() * 0.8,
      });
    }

    // Apply damage to buildings within radius
    let hitAny = false;
    for (const b of world.buildings) {
      if (b.destroyed) continue;
      const dist = Math.hypot(b.bounds.cx - x, b.bounds.cz - z);
      const approxRadius = Math.max(b.bounds.maxX - b.bounds.minX, b.bounds.maxZ - b.bounds.minZ) * 0.5;
      if (dist <= radius + approxRadius) {
        const falloff = Math.max(0.35, 1 - dist / (radius + approxRadius + 10));
        b.hp -= damage * falloff;
        hitAny = true;
        if (b.hp <= 0) {
          b.hp = 0;
          b.destroyed = true;
        }
      }
    }

    if (hitAny) {
      combo++;
      comboTimer = 2.4;
      triggerShake(radius > 40 ? 1.8 : 0.65, radius > 40 ? 0.55 : 0.25);
    } else {
      triggerShake(0.25, 0.15);
    }
    notifyStats();
  }

  function fireAt(targetPoint, originPoint = null) {
    if (!started) started = true;
    const spec = WEAPONS[activeWeapon];

    if (spec.instant) {
      // Lightning bolt from sky
      const boltGeo = new THREE.CylinderGeometry(0.4, 0.9, 120, 6);
      const boltMat = new THREE.MeshBasicMaterial({ color: spec.color, transparent: true, opacity: 0.95 });
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(targetPoint.x, 60, targetPoint.z);
      scene.add(bolt);
      effects.push({ mesh: bolt, type: 'bolt', age: 0, maxAge: 0.25, targetScale: 1 });
      spawnExplosion(targetPoint.x, targetPoint.y, targetPoint.z, spec.radius, spec.damage, spec.color);
      return;
    }

    for (let i = 0; i < spec.count; i++) {
      const spreadX = spec.count > 1 ? (Math.random() - 0.5) * 32 : 0;
      const spreadZ = spec.count > 1 ? (Math.random() - 0.5) * 32 : 0;
      const tx = targetPoint.x + spreadX;
      const tz = targetPoint.z + spreadZ;

      const mat = new THREE.MeshLambertMaterial({ color: activeWeapon === 'ironball' ? '#263238' : '#1e242b' });
      const mesh = new THREE.Mesh(projGeo, mat);
      const scale = activeWeapon === 'nuke' ? 2.4 : activeWeapon === 'bigbomb' ? 1.7 : 1.0;
      mesh.scale.setScalar(scale);

      if (originPoint) {
        mesh.position.copy(originPoint);
      } else {
        mesh.position.set(tx + (Math.random() - 0.5) * 10, 75 + i * 14, tz + (Math.random() - 0.5) * 10);
      }

      const dir = new THREE.Vector3(tx - mesh.position.x, targetPoint.y - mesh.position.y, tz - mesh.position.z).normalize();
      scene.add(mesh);
      projectiles.push({
        mesh,
        vel: dir.multiplyScalar(spec.speed),
        targetY: Math.max(0.2, targetPoint.y),
        spec,
      });
    }
  }

  function getCampusDestructionRatio() {
    const campus = world.buildings.filter((b) => b.isCampus);
    if (campus.length === 0) return 0;
    const destroyedCount = campus.filter((b) => b.destroyed).length;
    return Math.round((destroyedCount / campus.length) * 100);
  }

  function notifyStats() {
    onStatsChange({
      elapsed,
      destructionPct: getCampusDestructionRatio(),
      combo,
    });
  }

  function reset() {
    started = false;
    elapsed = 0;
    combo = 0;
    comboTimer = 0;
    world.resetAll();
    notifyStats();
  }

  function update(dt, camera) {
    if (started && getCampusDestructionRatio() < 100) {
      elapsed += dt;
      notifyStats();
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        notifyStats();
      }
    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.vel.y -= 28 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y <= p.targetY) {
        const pos = p.mesh.position.clone();
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
        spawnExplosion(pos.x, pos.y, pos.z, p.spec.radius, p.spec.damage, p.spec.color);
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
      if (e.type === 'ring' || e.type === 'ball') {
        const s = 1 + t * e.targetScale;
        e.mesh.scale.setScalar(s);
        e.mesh.material.opacity = (1 - t) * 0.85;
      } else if (e.type === 'bolt') {
        e.mesh.material.opacity = 1 - t;
      }
    }

    // Update debris
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.age += dt;
      if (d.age >= d.maxAge) {
        scene.remove(d.mesh);
        debris.splice(i, 1);
        continue;
      }
      d.vy -= 36 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += 5 * dt;
      d.mesh.rotation.z += 4 * dt;
      const groundFloor = getTerrainHeight(d.mesh.position.x, d.mesh.position.z) + 0.8;
      if (d.mesh.position.y < groundFloor) {
        d.mesh.position.y = groundFloor;
        d.vy *= -0.35;
        d.vx *= 0.7;
        d.vz *= 0.7;
      }
    }

    // Animate collapsing buildings
    for (const b of world.buildings) {
      if (b.destroyed && b.collapseProgress < 1) {
        b.collapseProgress = Math.min(1, b.collapseProgress + dt * 2.2);
        const sy = Math.max(0.06, 1 - b.collapseProgress * 0.94);
        b.mesh.scale.set(1 + b.collapseProgress * 0.08, sy, 1 + b.collapseProgress * 0.08);
        b.mesh.rotation.z = Math.sin(b.collapseProgress * 10) * 0.03 * (1 - b.collapseProgress);
      }
    }

    // Camera shake
    if (shakeTime > 0 && camera) {
      shakeTime -= dt;
      camera.position.x += (Math.random() - 0.5) * shakeIntensity;
      camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.6;
    } else {
      shakeIntensity = 0;
    }
  }

  return {
    setWeapon,
    getWeapon,
    fireAt,
    update,
    reset,
  };
}
