import * as THREE from 'three';
import { getTerrainHeight } from '../map/terrain.js';

const SNOW_WEAPONS = {
  snowball: { speed: 46, gravity: 14, radius: 0.45, splash: 1.5, damage: 35, count: 1, cooldown: 0.22 },
  bigsnow: { speed: 34, gravity: 18, radius: 0.95, splash: 5.5, damage: 70, count: 1, cooldown: 0.55 },
  triple: { speed: 44, gravity: 14, radius: 0.4, splash: 1.5, damage: 28, count: 3, cooldown: 0.45 },
  snowbomb: { speed: 32, gravity: 20, radius: 0.85, splash: 11, damage: 100, count: 1, cooldown: 0.9 },
};

function createSnowmanNPC(isSanta = false) {
  const group = new THREE.Group();

  const snowMat = new THREE.MeshLambertMaterial({ color: '#f4f8fc' });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#1f2937' });
  const accentMat = new THREE.MeshLambertMaterial({ color: isSanta ? '#d92d20' : '#2563eb' });
  const carrotMat = new THREE.MeshLambertMaterial({ color: '#f97316' });

  // Lower body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), snowMat);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Upper torso / scarf
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.54, 12, 10), snowMat);
  torso.position.y = 1.65;
  torso.castShadow = true;
  group.add(torso);

  const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.2, 10), accentMat);
  scarf.position.y = 2.02;
  group.add(scarf);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), snowMat);
  head.position.y = 2.38;
  head.castShadow = true;
  group.add(head);

  // Eyes & carrot nose
  const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
  const leftEye = new THREE.Mesh(eyeGeo, darkMat);
  leftEye.position.set(-0.12, 2.44, 0.33);
  const rightEye = new THREE.Mesh(eyeGeo, darkMat);
  rightEye.position.set(0.12, 2.44, 0.33);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), carrotMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.36, 0.44);
  group.add(leftEye, rightEye, nose);

  // Hat
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.65, 10), accentMat);
  hat.position.y = 2.95;
  group.add(hat);

  return group;
}

export function createSnowballFightSystem(scene, world, onStatsChange, onPlayerHit) {
  const projectiles = [];
  const splashes = [];
  const enemies = [];

  let activeWeapon = 'snowball';
  let score = 0;
  let hits = 0;
  let combo = 0;
  let comboTimer = 0;
  let playerHp = 100;
  let regenDelay = 0;
  let lastFireTime = 0;

  const snowGeo = new THREE.SphereGeometry(1, 10, 10);
  const playerSnowMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const enemySnowMat = new THREE.MeshLambertMaterial({ color: '#bae6fd' });
  const puffMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });

  const spawnPoints = [
    [15, -18], [34, -5], [-10, -15], [52, -32], [-28, 12],
    [18, 35], [45, 25], [-40, -45], [65, -45], [0, -65],
    [-65, 15], [-90, -25], [115, -10], [110, 35],
  ];

  function spawnEnemy(idx) {
    const [sx, sz] = spawnPoints[idx % spawnPoints.length];
    const mesh = createSnowmanNPC(idx % 2 === 0);
    const y = getTerrainHeight(sx, sz);
    mesh.position.set(sx, y, sz);
    scene.add(mesh);

    enemies.push({
      mesh,
      x: sx,
      z: sz,
      vx: (Math.random() - 0.5) * 4,
      vz: (Math.random() - 0.5) * 4,
      hp: 100,
      alive: true,
      respawnTimer: 0,
      throwCooldown: 1.5 + Math.random() * 2.5,
      wanderTimer: 1 + Math.random() * 2,
    });
  }

  for (let i = 0; i < spawnPoints.length; i++) {
    spawnEnemy(i);
  }

  function setWeapon(w) {
    if (SNOW_WEAPONS[w]) activeWeapon = w;
  }

  function spawnSplash(x, y, z, scale = 1.6, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(snowGeo, puffMat.clone());
      p.scale.setScalar(0.25 + Math.random() * 0.35);
      p.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const spd = 3 + Math.random() * 6 * (scale * 0.4);
      scene.add(p);
      splashes.push({
        mesh: p,
        vx: Math.cos(a) * spd,
        vy: 4 + Math.random() * 7,
        vz: Math.sin(a) * spd,
        age: 0,
        maxAge: 0.45 + Math.random() * 0.25,
      });
    }
  }

  function notify() {
    onStatsChange({ score, hits, combo, playerHp });
  }

  function firePlayerSnowball(origin, direction) {
    const now = performance.now() / 1000;
    const spec = SNOW_WEAPONS[activeWeapon];
    if (now - lastFireTime < spec.cooldown) return;
    lastFireTime = now;

    for (let i = 0; i < spec.count; i++) {
      const dir = direction.clone().normalize();
      if (spec.count > 1) {
        const spread = (i - 1) * 0.08;
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      }
      dir.y += 0.12;
      dir.normalize();

      const mesh = new THREE.Mesh(snowGeo, playerSnowMat);
      mesh.scale.setScalar(spec.radius);
      mesh.position.copy(origin).addScaledVector(dir, 1.2);
      scene.add(mesh);

      projectiles.push({
        mesh,
        vel: dir.multiplyScalar(spec.speed),
        gravity: spec.gravity,
        radius: spec.radius,
        splash: spec.splash,
        damage: spec.damage,
        fromPlayer: true,
        age: 0,
      });
    }
  }

  function fireEnemySnowball(enemy, playerPos) {
    const origin = new THREE.Vector3(enemy.x, getTerrainHeight(enemy.x, enemy.z) + 2.1, enemy.z);
    const target = playerPos.clone();
    const dist = origin.distanceTo(target);
    const dir = target.sub(origin).normalize();
    dir.y += Math.min(0.28, dist * 0.006);
    dir.normalize();

    const mesh = new THREE.Mesh(snowGeo, enemySnowMat);
    mesh.scale.setScalar(0.4);
    mesh.position.copy(origin).addScaledVector(dir, 1.0);
    scene.add(mesh);

    projectiles.push({
      mesh,
      vel: dir.multiplyScalar(32),
      gravity: 12,
      radius: 0.4,
      splash: 1.5,
      damage: 12,
      fromPlayer: false,
      age: 0,
    });
  }

  function reset() {
    score = 0;
    hits = 0;
    combo = 0;
    comboTimer = 0;
    playerHp = 100;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const [sx, sz] = spawnPoints[i % spawnPoints.length];
      e.x = sx;
      e.z = sz;
      e.hp = 100;
      e.alive = true;
      e.mesh.visible = true;
      e.mesh.position.set(sx, getTerrainHeight(sx, sz), sz);
    }
    notify();
  }

  function update(dt, playerPos, isFirstPerson) {
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        notify();
      }
    }

    if (regenDelay > 0) {
      regenDelay -= dt;
    } else if (playerHp < 100) {
      playerHp = Math.min(100, playerHp + 8 * dt);
      notify();
    }

    // Update AI snowmen
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.alive) {
        e.respawnTimer -= dt;
        if (e.respawnTimer <= 0) {
          const [sx, sz] = spawnPoints[(i + Math.floor(Math.random() * 5)) % spawnPoints.length];
          e.x = sx + (Math.random() - 0.5) * 10;
          e.z = sz + (Math.random() - 0.5) * 10;
          e.hp = 100;
          e.alive = true;
          e.mesh.visible = true;
        }
        continue;
      }

      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 2.5;
        e.vx = Math.cos(angle) * spd;
        e.vz = Math.sin(angle) * spd;
        e.wanderTimer = 2 + Math.random() * 2.5;
      }

      e.x = Math.max(-180, Math.min(180, e.x + e.vx * dt));
      e.z = Math.max(-160, Math.min(160, e.z + e.vz * dt));
      const ey = getTerrainHeight(e.x, e.z);
      e.mesh.position.set(e.x, ey, e.z);

      if (isFirstPerson && playerPos) {
        const dx = playerPos.x - e.x;
        const dz = playerPos.z - e.z;
        const dist = Math.hypot(dx, dz);
        e.mesh.rotation.y = Math.atan2(dx, dz);

        if (dist < 48 && dist > 3) {
          e.throwCooldown -= dt;
          if (e.throwCooldown <= 0) {
            fireEnemySnowball(e, playerPos);
            e.throwCooldown = 2.2 + Math.random() * 2.2;
          }
        }
      } else {
        e.mesh.rotation.y = Math.atan2(e.vx, e.vz);
      }
    }

    // Update snowballs
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.age += dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      let hit = false;

      if (p.fromPlayer) {
        for (const e of enemies) {
          if (!e.alive) continue;
          const ey = getTerrainHeight(e.x, e.z) + 1.5;
          const d = Math.hypot(p.mesh.position.x - e.x, p.mesh.position.y - ey, p.mesh.position.z - e.z);
          if (d < 1.5 + p.radius) {
            hit = true;
            // Apply splash/direct damage
            for (const target of enemies) {
              if (!target.alive) continue;
              const td = Math.hypot(target.x - p.mesh.position.x, target.z - p.mesh.position.z);
              if (td <= Math.max(2.2, p.splash)) {
                target.hp -= p.damage;
                if (target.hp <= 0) {
                  target.alive = false;
                  target.mesh.visible = false;
                  target.respawnTimer = 5.0;
                  hits++;
                  combo++;
                  comboTimer = 4.0;
                  score += 100 * combo;
                } else {
                  score += 25;
                }
              }
            }
            notify();
            break;
          }
        }
      } else if (isFirstPerson && playerPos) {
        const d = p.mesh.position.distanceTo(playerPos);
        if (d < 1.35) {
          hit = true;
          playerHp = Math.max(0, playerHp - p.damage);
          regenDelay = 3.5;
          onPlayerHit?.();
          if (playerHp <= 0) {
            playerHp = 100;
            combo = 0;
            score = Math.max(0, score - 100);
          }
          notify();
        }
      }

      const groundY = getTerrainHeight(p.mesh.position.x, p.mesh.position.z);
      if (hit || p.mesh.position.y <= groundY || p.age > 5) {
        if (p.fromPlayer && !hit && p.splash > 3) {
          // Splash damage on snowbomb/bigsnow ground impact
          let hitSplash = false;
          for (const target of enemies) {
            if (!target.alive) continue;
            const td = Math.hypot(target.x - p.mesh.position.x, target.z - p.mesh.position.z);
            if (td <= p.splash) {
              target.hp -= p.damage * 0.8;
              hitSplash = true;
              if (target.hp <= 0) {
                target.alive = false;
                target.mesh.visible = false;
                target.respawnTimer = 5.0;
                hits++;
                combo++;
                comboTimer = 4.0;
                score += 100 * combo;
              }
            }
          }
          if (hitSplash) notify();
        }
        spawnSplash(p.mesh.position.x, Math.max(groundY + 0.3, p.mesh.position.y), p.mesh.position.z, p.splash, p.splash > 4 ? 14 : 6);
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }

    // Update snow splashes
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.age += dt;
      if (s.age >= s.maxAge) {
        scene.remove(s.mesh);
        splashes.splice(i, 1);
        continue;
      }
      s.vy -= 18 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.material.opacity = 1 - s.age / s.maxAge;
    }
  }

  return {
    setWeapon,
    firePlayerSnowball,
    update,
    reset,
  };
}
