import * as THREE from 'three';
import { buildGunModel, buildFlashbangModel, hasGunModel } from './itemModels.js';

/**
 * 1인칭 뷰모델: detailed guns from itemModels.js held by gloved parka arms,
 * with walk bob, recoil kick and a reload dip animation.
 */
const VIEW_SCALE = {
  rifle: 0.55, smg: 0.62, shotgun: 0.55, dmr: 0.5, sr: 0.47, lmg: 0.5, crossbow: 0.55, concept: 0.5,
  pistol: 0.85, watergun: 0.8, revolver: 0.85, slingshot: 0.7,
};

// where the left (support) hand sits on each gun, in model space
const SUPPORT_HAND = {
  rifle: [0, -0.01, -0.36], smg: [0, -0.06, -0.21], shotgun: [0, -0.01, -0.34], dmr: [0, -0.01, -0.42],
  sr: [0, -0.04, -0.3], lmg: [0, -0.03, -0.3], crossbow: [0, -0.03, -0.25], concept: [0, -0.05, -0.3],
  pistol: [-0.02, -0.06, 0.02], watergun: [-0.02, -0.05, 0.03], revolver: [-0.02, -0.05, 0.05], slingshot: null,
};

export function createViewModels(camera) {
  const root = new THREE.Group();
  const BASE = new THREE.Vector3(0.17, -0.17, -0.42);
  root.position.copy(BASE);
  camera.add(root);

  const sleeveMat = new THREE.MeshStandardMaterial({ color: '#c2410c', roughness: 0.85 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.9 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.95 });

  function makeArm() {
    const g = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.2, 10), sleeveMat);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = 0.13;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 10), cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.04;
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.09), gloveMat);
    g.add(sleeve, cuff, glove);
    return g;
  }

  const models = {};
  function reg(key, group) {
    group.visible = false;
    root.add(group);
    models[key] = group;
  }

  // 맨손: two mittens, right one holding a snowball
  {
    const g = new THREE.Group();
    const mitten = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.9 });
    for (const side of [1, -1]) {
      const arm = makeArm();
      arm.children[2].material = mitten;
      arm.position.set(side > 0 ? 0 : -0.3, side > 0 ? -0.02 : -0.05, side > 0 ? -0.04 : -0.08);
      arm.rotation.y = side > 0 ? 0.15 : -0.2;
      g.add(arm);
    }
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 14, 12),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 })
    );
    ball.position.set(-0.01, 0.07, -0.05);
    ball.name = 'snowball';
    g.add(ball);
    reg('hands', g);
  }

  // Guns
  for (const key of Object.keys(VIEW_SCALE)) {
    if (!hasGunModel(key)) continue;
    const g = new THREE.Group();
    const gun = buildGunModel(key);
    const sc = VIEW_SCALE[key];
    gun.scale.setScalar(sc);
    g.add(gun);
    // right hand on grip
    const right = makeArm();
    right.position.set(0, -0.055 * sc * 1.8, 0.07 * sc);
    right.rotation.x = -0.25;
    g.add(right);
    // left hand on support
    const sup = SUPPORT_HAND[key];
    if (sup) {
      const left = makeArm();
      left.scale.set(0.8, 0.8, 0.9);
      left.position.set(sup[0] * sc - 0.01, sup[1] * sc - 0.025, sup[2] * sc);
      left.rotation.set(0.1, -0.42, 0);
      g.add(left);
    }
    reg(key, g);
  }

  // 눈광탄
  {
    const g = new THREE.Group();
    const fb = buildFlashbangModel();
    fb.scale.setScalar(0.9);
    fb.position.set(0, 0.03, -0.04);
    g.add(fb);
    g.add(makeArm());
    reg('flashbang', g);
  }

  let currentKey = null;
  let bobPhase = 0;
  let reloadT = 0; // 0..1 progress, 0 = idle

  function setModel(key) {
    const resolved = models[key] ? key : 'hands';
    if (currentKey === resolved) return;
    Object.entries(models).forEach(([k, grp]) => {
      grp.visible = k === resolved;
    });
    currentKey = resolved;
  }

  function setHandsSnowball(visible) {
    const ball = models.hands?.getObjectByName('snowball');
    if (ball) ball.visible = visible;
  }

  function setRecoil(recoilOffset, visible, moveSpeed = 0, dt = 0) {
    root.visible = visible;
    bobPhase += dt * (moveSpeed > 0.1 ? 6 + moveSpeed * 0.6 : 1.4);
    const bobAmp = moveSpeed > 0.1 ? Math.min(0.018, moveSpeed * 0.0016) : 0.003;
    const reloadDip = reloadT > 0 ? Math.sin(reloadT * Math.PI) : 0;
    root.position.set(
      BASE.x + Math.cos(bobPhase) * bobAmp,
      BASE.y + Math.abs(Math.sin(bobPhase)) * bobAmp - reloadDip * 0.14,
      BASE.z + recoilOffset
    );
    root.rotation.set(recoilOffset * 1.4 - reloadDip * 0.5, 0, reloadDip * 0.6);
  }

  function setReload(progress) {
    reloadT = progress;
  }

  setModel('hands');

  return {
    setModel,
    setRecoil,
    setReload,
    setHandsSnowball,
  };
}
