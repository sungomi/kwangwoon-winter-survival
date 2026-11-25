import * as THREE from 'three';
import { mergeByMaterial } from '../utils/mergeByMaterial.js';

/**
 * Shared 3D models for every weapon & item (1인칭 뷰모델 · 바닥 파밍 아이템 · 봇 손에 든 총).
 * All guns are built barrel-forward along -Z with the grip near the origin, at roughly real-world scale
 * (an AR is ~0.8m long). The viewmodel scales them down; loot uses them as-is.
 */

const matCache = new Map();
function mat(color, { metal = 0, rough = 0.65, emissive = null, opacity = 1 } = {}) {
  const key = `${color}|${metal}|${rough}|${emissive}|${opacity}`;
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = 0.85;
    }
    if (opacity < 1) {
      m.transparent = true;
      m.opacity = opacity;
    }
    matCache.set(key, m);
  }
  return matCache.get(key);
}

const M = {
  gunmetal: () => mat('#2b3038', { metal: 0.7, rough: 0.38 }),
  black: () => mat('#16191e', { metal: 0.4, rough: 0.5 }),
  steel: () => mat('#9aa4af', { metal: 0.85, rough: 0.28 }),
  wood: () => mat('#7a4a28', { rough: 0.75 }),
  darkWood: () => mat('#4b2c17', { rough: 0.8 }),
  ice: () => mat('#bfe6ff', { metal: 0.1, rough: 0.12, emissive: '#2a6f96', opacity: 0.92 }),
  iceDeep: () => mat('#7cc6f2', { metal: 0.1, rough: 0.15, emissive: '#1d5277' }),
  snow: () => mat('#f6fafd', { rough: 0.9 }),
  glow: (c) => mat(c, { emissive: c, rough: 0.3 }),
  paint: (c, metal = 0.25) => mat(c, { metal, rough: 0.5 }),
  rubber: () => mat('#222428', { rough: 0.95 }),
  glass: () => mat('#7dd3fc', { metal: 0.2, rough: 0.05, emissive: '#0e4a6e', opacity: 0.85 }),
};

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function cylZ(rTop, rBottom, len, material, x = 0, y = 0, z = 0, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, len, seg), material);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function cylY(r, len, material, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function rail(len, z, y) {
  const g = new THREE.Group();
  g.add(box(0.032, 0.012, len, M.black(), 0, y, z));
  const teeth = Math.floor(len / 0.03);
  for (let i = 0; i < teeth; i++) g.add(box(0.036, 0.008, 0.012, M.black(), 0, y + 0.01, z - len / 2 + i * 0.03 + 0.015));
  return g;
}

function redDot(z, y) {
  const g = new THREE.Group();
  g.add(box(0.04, 0.035, 0.06, M.black(), 0, y, z));
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 14), M.black());
  hood.position.set(0, y + 0.04, z);
  g.add(hood);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 14), M.glass());
  lens.position.set(0, y + 0.04, z + 0.002);
  g.add(lens);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), M.glow('#ff3344'));
  dot.position.set(0, y + 0.04, z - 0.004);
  g.add(dot);
  return g;
}

function scope(len, r, z, y, tint = '#0e4a6e') {
  const g = new THREE.Group();
  g.add(cylZ(r, r, len, M.black(), 0, y, z));
  g.add(cylZ(r * 1.35, r, len * 0.18, M.black(), 0, y, z - len * 0.5));
  g.add(cylZ(r * 1.2, r, len * 0.16, M.black(), 0, y, z + len * 0.5));
  g.add(cylY(r * 0.5, r * 1.1, M.black(), 0, y + r * 1.1, z));
  const front = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 16), mat('#7dd3fc', { emissive: tint, rough: 0.05 }));
  front.position.set(0, y, z - len * 0.59);
  front.rotation.y = Math.PI;
  g.add(front);
  const back = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 16), M.glass());
  back.position.set(0, y, z + len * 0.59);
  g.add(back);
  g.add(box(0.03, 0.03, 0.025, M.black(), 0, y - r - 0.01, z - len * 0.25));
  g.add(box(0.03, 0.03, 0.025, M.black(), 0, y - r - 0.01, z + len * 0.25));
  return g;
}

function icicle(len, r, material) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, len, 7), material);
  m.castShadow = true;
  return m;
}

function frost(g, spots) {
  // little snow clumps sitting on top surfaces
  for (const [x, y, z, s] of spots) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 6), M.snow());
    c.scale.y = 0.55;
    c.position.set(x, y, z);
    g.add(c);
  }
}

/* ---------------------------------- Guns ---------------------------------- */

const GUN_BUILDERS = {
  // 아이스 AR: AR-style rifle with frosted blue furniture
  rifle() {
    const g = new THREE.Group();
    const blue = M.paint('#1d6fa5', 0.35);
    g.add(box(0.06, 0.09, 0.36, M.gunmetal(), 0, 0.02, -0.06)); // receiver
    g.add(box(0.058, 0.05, 0.3, M.black(), 0, 0.085, -0.08)); // upper
    g.add(rail(0.26, -0.1, 0.115));
    g.add(box(0.07, 0.075, 0.26, blue, 0, 0.03, -0.37)); // handguard
    for (let i = 0; i < 5; i++) g.add(box(0.074, 0.02, 0.03, M.black(), 0, 0.03, -0.27 - i * 0.05));
    g.add(cylZ(0.012, 0.012, 0.22, M.steel(), 0, 0.04, -0.6));
    g.add(cylZ(0.02, 0.018, 0.06, M.black(), 0, 0.04, -0.72)); // flash hider
    g.add(box(0.012, 0.05, 0.012, M.black(), 0, 0.09, -0.47)); // front post
    const magz = box(0.045, 0.16, 0.075, M.ice(), 0, -0.1, -0.12);
    magz.rotation.x = 0.22;
    g.add(magz);
    const grip = box(0.045, 0.12, 0.05, M.rubber(), 0, -0.07, 0.07);
    grip.rotation.x = -0.35;
    g.add(grip);
    g.add(box(0.012, 0.03, 0.04, M.steel(), 0, -0.035, 0.01)); // trigger guard
    g.add(cylZ(0.016, 0.016, 0.14, M.steel(), 0, 0.04, 0.18)); // buffer tube
    g.add(box(0.05, 0.1, 0.16, blue, 0, 0.0, 0.3)); // stock
    g.add(box(0.052, 0.12, 0.02, M.rubber(), 0, -0.005, 0.385));
    g.add(redDot(-0.08, 0.13));
    frost(g, [[0, 0.075, -0.4, 0.025], [0.01, 0.06, 0.28, 0.022]]);
    return g;
  },

  // 눈송이 SMG: compact bullpup-ish SMG with snowflake drum
  smg() {
    const g = new THREE.Group();
    const white = M.paint('#e8eef5', 0.1);
    g.add(box(0.06, 0.1, 0.3, white, 0, 0.02, -0.08));
    g.add(box(0.064, 0.03, 0.3, M.black(), 0, 0.085, -0.08));
    g.add(cylZ(0.022, 0.022, 0.12, M.black(), 0, 0.035, -0.29)); // suppressor stub
    for (let i = 0; i < 4; i++) g.add(cylZ(0.025, 0.025, 0.008, M.steel(), 0, 0.035, -0.25 - i * 0.025));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 6), M.iceDeep());
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, -0.08, -0.12);
    g.add(drum);
    const flake = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 4, 6), M.glow('#e0f7ff'));
    flake.rotation.y = Math.PI / 2;
    flake.position.set(0.026, -0.08, -0.12);
    g.add(flake);
    const grip = box(0.04, 0.11, 0.045, M.rubber(), 0, -0.065, 0.04);
    grip.rotation.x = -0.25;
    g.add(grip);
    g.add(box(0.035, 0.07, 0.04, M.rubber(), 0, -0.04, -0.21)); // vertical foregrip
    g.add(box(0.02, 0.02, 0.18, M.black(), 0, 0.03, 0.16)); // folding stock wire
    g.add(box(0.04, 0.08, 0.02, M.black(), 0, 0.0, 0.25));
    g.add(redDot(-0.06, 0.12));
    return g;
  },

  // 눈대포 샷건: pump shotgun with wood furniture and fat ice-ringed muzzle
  shotgun() {
    const g = new THREE.Group();
    g.add(box(0.06, 0.09, 0.24, M.gunmetal(), 0, 0.02, -0.04));
    g.add(cylZ(0.02, 0.02, 0.56, M.steel(), 0, 0.05, -0.43));
    g.add(cylZ(0.016, 0.016, 0.48, M.black(), 0, 0.012, -0.39)); // tube mag
    const pump = cylZ(0.034, 0.034, 0.16, M.wood(), 0, 0.02, -0.34);
    g.add(pump);
    for (let i = 0; i < 4; i++) g.add(cylZ(0.036, 0.036, 0.01, M.darkWood(), 0, 0.02, -0.28 - i * 0.04));
    g.add(cylZ(0.032, 0.028, 0.05, M.ice(), 0, 0.05, -0.72)); // ice choke
    g.add(box(0.01, 0.02, 0.01, M.glow('#ffd54a'), 0, 0.075, -0.69)); // bead sight
    const grip = box(0.045, 0.1, 0.06, M.wood(), 0, -0.05, 0.1);
    grip.rotation.x = -0.4;
    g.add(grip);
    const stock = box(0.05, 0.1, 0.26, M.wood(), 0, -0.02, 0.26);
    stock.rotation.x = 0.12;
    g.add(stock);
    g.add(box(0.052, 0.11, 0.02, M.rubber(), 0, -0.04, 0.39));
    g.add(box(0.06, 0.012, 0.05, M.glow('#ef4444'), 0, 0.068, -0.04)); // shell carrier stripe
    for (let i = 0; i < 4; i++) g.add(cylY(0.009, 0.03, M.glow('#ef4444'), 0.034, 0.03, -0.09 + i * 0.025));
    frost(g, [[0, 0.075, -0.5, 0.02]]);
    return g;
  },

  // 고드름 DMR: long semi-auto marksman rifle with icicle barrel shroud and mid scope
  dmr() {
    const g = new THREE.Group();
    const green = M.paint('#3f5b3a', 0.2);
    g.add(box(0.06, 0.09, 0.4, green, 0, 0.02, -0.08));
    g.add(box(0.07, 0.08, 0.3, green, 0, 0.025, -0.42));
    g.add(cylZ(0.012, 0.012, 0.3, M.steel(), 0, 0.04, -0.72));
    const ic = icicle(0.16, 0.025, M.ice());
    ic.rotation.x = -Math.PI / 2;
    ic.position.set(0, 0.04, -0.9);
    g.add(ic);
    const magz = box(0.045, 0.1, 0.07, M.black(), 0, -0.06, -0.1);
    magz.rotation.x = 0.1;
    g.add(magz);
    const grip = box(0.045, 0.12, 0.05, M.rubber(), 0, -0.07, 0.08);
    grip.rotation.x = -0.35;
    g.add(grip);
    g.add(box(0.05, 0.11, 0.24, green, 0, 0.0, 0.3));
    g.add(box(0.03, 0.03, 0.12, M.black(), 0, 0.07, 0.3)); // cheek riser
    g.add(scope(0.22, 0.022, -0.1, 0.14));
    // bipod folded
    g.add(box(0.008, 0.008, 0.16, M.black(), 0.025, -0.02, -0.55));
    g.add(box(0.008, 0.008, 0.16, M.black(), -0.025, -0.02, -0.55));
    return g;
  },

  // 빙하 저격총 (SR): bolt-action with big glacier-blue scope and ice-crystal muzzle brake
  sr() {
    const g = new THREE.Group();
    const navy = M.paint('#1e3a6a', 0.3);
    g.add(box(0.06, 0.08, 0.36, M.gunmetal(), 0, 0.02, -0.05));
    g.add(box(0.075, 0.09, 0.42, navy, 0, -0.005, -0.3)); // chassis forend
    g.add(cylZ(0.014, 0.016, 0.62, M.steel(), 0, 0.04, -0.75));
    g.add(box(0.06, 0.04, 0.08, M.ice(), 0, 0.04, -1.07)); // muzzle brake
    for (const s of [-1, 1]) g.add(box(0.03, 0.012, 0.012, M.ice(), s * 0.035, 0.04, -1.06));
    const bolt = cylY(0.008, 0.06, M.steel(), 0.05, 0.05, 0.02);
    bolt.rotation.z = Math.PI / 2;
    g.add(bolt);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), M.black());
    knob.position.set(0.085, 0.05, 0.02);
    g.add(knob);
    const grip = box(0.045, 0.12, 0.05, M.rubber(), 0, -0.07, 0.1);
    grip.rotation.x = -0.3;
    g.add(grip);
    g.add(box(0.05, 0.12, 0.3, navy, 0, -0.01, 0.33));
    g.add(box(0.035, 0.035, 0.16, M.black(), 0, 0.07, 0.3));
    g.add(box(0.06, 0.15, 0.025, M.rubber(), 0, -0.02, 0.49));
    g.add(scope(0.36, 0.03, -0.06, 0.15, '#1e6fb8'));
    g.add(box(0.045, 0.05, 0.05, M.black(), 0, -0.06, -0.08)); // mag
    frost(g, [[0, 0.19, -0.1, 0.025], [0, 0.05, -0.38, 0.022]]);
    return g;
  },

  // 제설기 LMG: chunky belt-fed with snow hopper box & carry handle
  lmg() {
    const g = new THREE.Group();
    const olive = M.paint('#5a5f3a', 0.25);
    g.add(box(0.09, 0.12, 0.46, olive, 0, 0.02, -0.12));
    g.add(box(0.095, 0.04, 0.3, M.black(), 0, 0.1, -0.12)); // feed cover
    g.add(cylZ(0.024, 0.024, 0.46, M.steel(), 0, 0.04, -0.58));
    for (let i = 0; i < 8; i++) g.add(cylZ(0.03, 0.03, 0.012, M.black(), 0, 0.04, -0.4 - i * 0.04)); // cooling fins
    g.add(box(0.05, 0.05, 0.06, M.black(), 0, 0.04, -0.84));
    // snow ammo hopper
    g.add(box(0.12, 0.14, 0.14, M.paint('#d8e6f0', 0.05), -0.02, -0.11, -0.12));
    g.add(box(0.125, 0.02, 0.145, M.glow('#38bdf8'), -0.02, -0.04, -0.12));
    const belt = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), M.snow());
      b.position.set(0.05, 0.0 - i * 0.02, -0.12 + i * 0.006);
      belt.add(b);
    }
    g.add(belt);
    // carry handle
    g.add(box(0.015, 0.06, 0.015, M.black(), 0, 0.15, -0.2));
    g.add(box(0.015, 0.06, 0.015, M.black(), 0, 0.15, -0.05));
    g.add(box(0.015, 0.015, 0.17, M.black(), 0, 0.18, -0.125));
    const grip = box(0.05, 0.12, 0.055, M.rubber(), 0, -0.08, 0.1);
    grip.rotation.x = -0.35;
    g.add(grip);
    g.add(box(0.06, 0.12, 0.22, olive, 0, 0.0, 0.3));
    // bipod deployed
    for (const s of [-1, 1]) {
      const leg = box(0.01, 0.2, 0.01, M.black(), s * 0.04, -0.08, -0.66);
      leg.rotation.z = s * 0.25;
      g.add(leg);
    }
    return g;
  },

  // 고드름 석궁: crossbow firing icicle bolts
  crossbow() {
    const g = new THREE.Group();
    g.add(box(0.05, 0.06, 0.5, M.darkWood(), 0, 0.0, -0.15));
    g.add(box(0.04, 0.012, 0.42, M.steel(), 0, 0.035, -0.18)); // rail
    const limbL = box(0.32, 0.025, 0.04, M.paint('#26323d', 0.4), -0.16, 0.02, -0.38);
    limbL.rotation.y = -0.35;
    const limbR = box(0.32, 0.025, 0.04, M.paint('#26323d', 0.4), 0.16, 0.02, -0.38);
    limbR.rotation.y = 0.35;
    g.add(limbL, limbR);
    for (const s of [-1, 1]) {
      const tip = icicle(0.06, 0.012, M.ice());
      tip.rotation.z = s * Math.PI / 2;
      tip.position.set(s * 0.31, 0.02, -0.33);
      g.add(tip);
    }
    const str = box(0.6, 0.004, 0.004, M.glow('#e0f2fe'), 0, 0.045, -0.24);
    g.add(str);
    const bolt = icicle(0.32, 0.012, M.ice());
    bolt.rotation.x = -Math.PI / 2;
    bolt.position.set(0, 0.05, -0.36);
    g.add(bolt);
    const grip = box(0.04, 0.12, 0.05, M.wood(), 0, -0.07, 0.06);
    grip.rotation.x = -0.4;
    g.add(grip);
    g.add(box(0.05, 0.1, 0.2, M.wood(), 0, -0.02, 0.2));
    g.add(scope(0.12, 0.016, -0.05, 0.08));
    return g;
  },

  // 제설 바주카: legendary airdrop launcher, orange tube with snow-cannon funnel
  concept() {
    const g = new THREE.Group();
    const orange = M.paint('#ea580c', 0.2);
    g.add(cylZ(0.07, 0.07, 0.9, orange, 0, 0.06, -0.25, 16));
    g.add(cylZ(0.1, 0.075, 0.16, M.paint('#facc15', 0.3), 0, 0.06, -0.76, 16));
    g.add(cylZ(0.082, 0.082, 0.06, M.black(), 0, 0.06, 0.22, 16));
    for (let i = 0; i < 3; i++) g.add(cylZ(0.073, 0.073, 0.03, M.paint('#fef3c7'), 0, 0.06, -0.5 + i * 0.25, 16));
    const warhead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), M.snow());
    warhead.position.set(0, 0.06, -0.86);
    g.add(warhead);
    g.add(box(0.04, 0.12, 0.05, M.rubber(), 0, -0.06, 0.0));
    g.add(box(0.04, 0.1, 0.05, M.rubber(), 0, -0.05, -0.3));
    g.add(box(0.03, 0.05, 0.08, M.black(), 0.08, 0.12, -0.1)); // side sight
    g.add(box(0.01, 0.01, 0.01, M.glow('#22c55e'), 0.08, 0.15, -0.14));
    return g;
  },

  // 손난로 권총: compact pistol with glowing hand-warmer grip
  pistol() {
    const g = new THREE.Group();
    g.add(box(0.035, 0.045, 0.19, M.gunmetal(), 0, 0.04, -0.06)); // slide
    for (let i = 0; i < 6; i++) g.add(box(0.037, 0.03, 0.006, M.black(), 0, 0.045, 0.01 + i * 0.008));
    g.add(box(0.032, 0.03, 0.15, M.black(), 0, 0.008, -0.05));
    const grip = box(0.032, 0.1, 0.045, M.glow('#f97316'), 0, -0.04, 0.01);
    grip.rotation.x = -0.25;
    g.add(grip);
    g.add(box(0.034, 0.02, 0.05, M.black(), 0, -0.09, 0.02));
    g.add(box(0.006, 0.012, 0.006, M.glow('#a3e635'), 0, 0.068, -0.145));
    g.add(box(0.012, 0.02, 0.03, M.steel(), 0, -0.01, -0.04));
    return g;
  },

  // 네온 물총
  watergun() {
    const g = new THREE.Group();
    g.add(box(0.05, 0.07, 0.24, M.paint('#ec4899', 0.05), 0, 0.03, -0.06));
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), mat('#22d3ee', { emissive: '#0e7490', opacity: 0.75, rough: 0.1 }));
    tank.position.set(0, 0.1, -0.02);
    g.add(tank);
    g.add(cylY(0.015, 0.04, M.paint('#facc15'), 0, 0.17, -0.02));
    g.add(cylZ(0.012, 0.018, 0.12, M.paint('#facc15'), 0, 0.03, -0.23));
    const grip = box(0.04, 0.1, 0.05, M.paint('#a855f7'), 0, -0.04, 0.03);
    grip.rotation.x = -0.25;
    g.add(grip);
    g.add(box(0.012, 0.03, 0.03, M.paint('#facc15'), 0, -0.01, -0.03));
    return g;
  },

  // 황금 리볼버
  revolver() {
    const g = new THREE.Group();
    const gold = mat('#e2b33c', { metal: 0.9, rough: 0.25 });
    g.add(box(0.03, 0.05, 0.12, gold, 0, 0.03, -0.02));
    g.add(cylZ(0.012, 0.014, 0.16, gold, 0, 0.045, -0.16));
    g.add(box(0.012, 0.012, 0.16, gold, 0, 0.065, -0.16)); // top strap
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6), M.steel());
    cylinder.rotation.x = Math.PI / 2;
    cylinder.position.set(0, 0.035, -0.03);
    g.add(cylinder);
    const grip = box(0.032, 0.09, 0.045, M.darkWood(), 0, -0.03, 0.05);
    grip.rotation.x = -0.4;
    g.add(grip);
    g.add(box(0.01, 0.015, 0.015, gold, 0, 0.07, 0.04)); // hammer
    return g;
  },

  // 새총
  slingshot() {
    const g = new THREE.Group();
    const wood = M.wood();
    g.add(cylY(0.014, 0.13, wood, 0, -0.05, 0));
    for (const s of [-1, 1]) {
      const arm = cylY(0.011, 0.1, wood, s * 0.03, 0.04, 0);
      arm.rotation.z = -s * 0.5;
      g.add(arm);
    }
    const band = box(0.11, 0.006, 0.006, M.glow('#ef4444'), 0, 0.085, 0.03);
    g.add(band);
    const pouch = box(0.025, 0.02, 0.02, mat('#7c2d12'), 0, 0.085, 0.07);
    g.add(pouch);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), M.snow());
    ball.position.set(0, 0.085, 0.07);
    g.add(ball);
    return g;
  },
};

export function buildGunModel(key) {
  const builder = GUN_BUILDERS[key];
  return builder ? mergeByMaterial(builder()) : null;
}

export function hasGunModel(key) {
  return !!GUN_BUILDERS[key];
}

/* ------------------------------ Items / gear ------------------------------ */

const LEVEL_COLORS = ['#9ca3af', '#6b8e5a', '#3b6fb6', '#7c3aed'];

function buildHelmetModelRaw(level = 1) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    M.paint(LEVEL_COLORS[level] || LEVEL_COLORS[1], 0.3)
  );
  shell.castShadow = true;
  g.add(shell);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.014, 6, 24), M.black());
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.02;
  g.add(brim);
  if (level >= 2) g.add(box(0.06, 0.04, 0.04, M.black(), 0, 0.1, -0.15)); // NVG mount
  if (level >= 3) {
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 16, 8, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.25),
      M.glass()
    );
    visor.rotation.y = Math.PI;
    g.add(visor);
  }
  frost(g, [[0.03, 0.15, 0.02, 0.05]]);
  return g;
}

function buildVestModelRaw(level = 1) {
  const g = new THREE.Group();
  const c = M.paint(LEVEL_COLORS[level] || LEVEL_COLORS[1], 0.1);
  g.add(box(0.36, 0.42, 0.12, c, 0, 0, 0));
  g.add(box(0.08, 0.1, 0.13, c, -0.12, 0.25, 0));
  g.add(box(0.08, 0.1, 0.13, c, 0.12, 0.25, 0));
  for (let i = 0; i < 3; i++) g.add(box(0.09, 0.1, 0.05, M.black(), -0.11 + i * 0.11, -0.08, 0.08)); // pouches
  g.add(box(0.37, 0.03, 0.125, M.black(), 0, 0.08, 0));
  if (level >= 3) g.add(box(0.2, 0.14, 0.02, M.steel(), 0, 0.08, 0.07));
  return g;
}

function buildMedkitModelRaw() {
  const g = new THREE.Group();
  g.add(box(0.34, 0.2, 0.22, M.paint('#f8fafc', 0.05), 0, 0, 0));
  g.add(box(0.2, 0.05, 0.03, M.paint('#dc2626'), 0, 0.02, 0.115));
  g.add(box(0.05, 0.14, 0.03, M.paint('#dc2626'), 0, 0.02, 0.115));
  g.add(box(0.14, 0.03, 0.04, M.black(), 0, 0.115, 0));
  return g;
}

function buildDrinkModelRaw() {
  const g = new THREE.Group();
  g.add(cylY(0.06, 0.2, M.paint('#16a34a', 0.6), 0, 0, 0, 16));
  g.add(cylY(0.061, 0.05, M.glow('#a3e635'), 0, 0.02, 0, 16));
  g.add(cylY(0.05, 0.015, M.steel(), 0, 0.105, 0, 16));
  return g;
}

function buildFlashbangModelRaw() {
  const g = new THREE.Group();
  g.add(cylY(0.045, 0.14, M.paint('#cbd5e1', 0.5), 0, 0, 0, 14));
  g.add(cylY(0.047, 0.02, M.glow('#38bdf8'), 0, 0.03, 0, 14));
  g.add(cylY(0.047, 0.02, M.glow('#38bdf8'), 0, -0.03, 0, 14));
  g.add(box(0.03, 0.04, 0.03, M.black(), 0, 0.09, 0));
  const lever = box(0.012, 0.12, 0.02, M.steel(), 0.05, 0.03, 0);
  lever.rotation.z = -0.12;
  g.add(lever);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 14), M.steel());
  ring.position.set(-0.03, 0.11, 0);
  g.add(ring);
  return g;
}

function buildAmmoCrateModelRaw() {
  const g = new THREE.Group();
  g.add(box(0.36, 0.2, 0.24, M.paint('#3f6b4e', 0.2), 0, 0, 0));
  g.add(box(0.37, 0.03, 0.25, M.black(), 0, 0.09, 0));
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), M.snow());
    b.position.set(-0.11 + (i % 3) * 0.11, 0.14, i < 3 ? -0.05 : 0.05);
    g.add(b);
  }
  return g;
}

/* ------------------------------ World props ------------------------------ */

/** Supply airdrop crate with parachute (보급상자). */
export function buildAirdropModel() {
  const g = new THREE.Group();
  let crate = new THREE.Group();
  crate.add(box(1.6, 1.2, 1.6, M.paint('#b91c1c', 0.2), 0, 0.6, 0));
  for (const y of [0.1, 1.1]) crate.add(box(1.65, 0.12, 1.65, M.black(), 0, y, 0));
  crate.add(box(0.12, 1.25, 1.65, M.black(), 0, 0.6, 0));
  crate.add(box(1.65, 1.25, 0.12, M.black(), 0, 0.6, 0));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), M.glow('#22d3ee'));
  beacon.position.y = 1.35;
  beacon.material = beacon.material.clone(); // animated per crate
  beacon.userData.keep = true;
  crate.add(beacon);
  crate = mergeByMaterial(crate);
  g.add(crate);
  let chute = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
    mat('#f8fafc', { rough: 0.8 })
  );
  canopy.material.side = THREE.DoubleSide;
  canopy.position.y = 6.5;
  chute.add(canopy);
  const stripe = new THREE.Mesh(
    new THREE.SphereGeometry(3.22, 16, 2, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.12),
    mat('#ef4444', { rough: 0.8 })
  );
  stripe.material.side = THREE.DoubleSide;
  stripe.position.y = 6.5;
  chute.add(stripe);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 6.2, 4), M.black());
    const tx = Math.cos(a) * 2.6;
    const tz = Math.sin(a) * 2.6;
    line.position.set(tx / 2, 4.0, tz / 2);
    line.lookAt(new THREE.Vector3(tx, 7.6, tz));
    line.rotateX(Math.PI / 2);
    chute.add(line);
  }
  chute = mergeByMaterial(chute, { castShadow: false });
  g.add(chute);
  return { group: g, crate, chute, beacon };
}

/** Personal parachute shown above the player/bots while gliding. */
function buildParachuteModelRaw(color = '#0ea5e9') {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.32),
    mat(color, { rough: 0.8 })
  );
  canopy.material.side = THREE.DoubleSide;
  canopy.scale.set(1.2, 0.7, 0.8);
  canopy.position.y = 4.2;
  g.add(canopy);
  for (let i = 0; i < 5; i++) {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 1.9), mat('#f8fafc', { rough: 0.8 }));
    cell.position.set(-2 + i, 4.7, 0);
    g.add(cell);
  }
  for (const s of [-1, 1]) {
    for (const zz of [-0.6, 0.6]) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.4, 4), M.black());
      line.position.set(s * 1.1, 2.6, zz * 0.6);
      line.rotation.z = s * 0.55;
      g.add(line);
    }
  }
  return g;
}

/** Transport plane flying over the campus at match start. */
function buildPlaneModelRaw() {
  const g = new THREE.Group();
  const body = M.paint('#cbd5e1', 0.5);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.8, 26, 16), body);
  fus.rotation.x = Math.PI / 2;
  g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10), body);
  nose.scale.z = 1.6;
  nose.position.z = -13;
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.8, 8, 14), body);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.8, 16.5);
  g.add(tail);
  g.add(box(36, 0.5, 5, M.paint('#94a3b8', 0.5), 0, 0.3, -2));
  g.add(box(12, 0.35, 3, M.paint('#94a3b8', 0.5), 0, 1.4, 18));
  g.add(box(0.4, 6, 4, M.paint('#2563eb', 0.4), 0, 4, 18));
  for (const s of [-1, 1]) {
    for (const off of [6, 12]) {
      const eng = cylZ(0.9, 0.9, 3.2, M.gunmetal(), s * off, -0.8, -3);
      g.add(eng);
      const prop = box(0.2, 4.2, 0.15, M.black(), s * off, -0.8, -4.7);
      prop.userData.spin = true;
      prop.userData.keep = true;
      g.add(prop);
    }
  }
  for (let i = 0; i < 8; i++) g.add(box(0.05, 0.6, 0.8, M.glass(), 2.2, 0.6, -9 + i * 2.4));
  g.add(box(4.4, 0.25, 26, M.paint('#2563eb', 0.3), 0, -0.4, 0)); // belly stripe
  return g;
}

/** Floating world-loot visual: model + soft rarity glow ring. */
export function buildLootVisual(drop) {
  const g = new THREE.Group();
  let model = null;
  if (drop.category === 'primary' || drop.category === 'sidearm') {
    model = buildGunModel(drop.key);
    model.rotation.y = Math.PI / 2;
    model.scale.setScalar(drop.category === 'sidearm' ? 2.4 : 1.6);
  } else if (drop.category === 'helmet') model = buildHelmetModel(drop.level);
  else if (drop.category === 'vest') model = buildVestModel(drop.level);
  else if (drop.category === 'medkit') model = buildMedkitModel();
  else if (drop.category === 'drink') model = buildDrinkModel();
  else if (drop.category === 'flashbang') model = buildFlashbangModel();
  else model = buildAmmoCrateModel();
  if (drop.category !== 'primary' && drop.category !== 'sidearm') model.scale.setScalar(2.2);
  g.add(model);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.85, 28),
    new THREE.MeshBasicMaterial({ color: drop.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.55;
  g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.25, 3.2, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: drop.color, transparent: true, opacity: 0.22, depthWrite: false })
  );
  beam.position.y = 1.0;
  g.add(beam);
  return { group: g, model };
}

export function buildHelmetModel(...args) {
  return mergeByMaterial(buildHelmetModelRaw(...args));
}

export function buildVestModel(...args) {
  return mergeByMaterial(buildVestModelRaw(...args));
}

export function buildMedkitModel(...args) {
  return mergeByMaterial(buildMedkitModelRaw(...args));
}

export function buildDrinkModel(...args) {
  return mergeByMaterial(buildDrinkModelRaw(...args));
}

export function buildFlashbangModel(...args) {
  return mergeByMaterial(buildFlashbangModelRaw(...args));
}

export function buildAmmoCrateModel(...args) {
  return mergeByMaterial(buildAmmoCrateModelRaw(...args));
}

export function buildParachuteModel(...args) {
  return mergeByMaterial(buildParachuteModelRaw(...args));
}

export function buildPlaneModel() {
  return mergeByMaterial(buildPlaneModelRaw());
}
