import * as THREE from 'three';
import { mergeByMaterial } from '../utils/mergeByMaterial.js';
import { buildGunModel, buildHelmetModel, buildVestModel, buildParachuteModel } from './itemModels.js';

/**
 * Stylized winter survivor (parka, scarf, beanie, goggles, backpack) that shows the
 * weapon it actually carries plus equipped helmet/vest levels.
 */
export function createPlayerAvatar(color = '#ef4444', name = '학우') {
  const group = new THREE.Group();
  const body = new THREE.Group();

  const parkaMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.9 });
  const bootMat = new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f3cfb6', roughness: 0.8 });
  const scarfMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.95 });
  const packMat = new THREE.MeshStandardMaterial({ color: '#4b5320', roughness: 0.9 });

  // Legs (pivot at hip so they swing)
  function leg(x) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.74, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.28), pantsMat);
    thigh.position.y = -0.31;
    thigh.castShadow = true;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.36), bootMat);
    boot.position.set(0, -0.66, 0.04);
    pivot.add(thigh, boot);
    group.add(pivot);
    return pivot;
  }
  const leftLeg = leg(-0.17);
  const rightLeg = leg(0.17);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.84, 0.44), parkaMat);
  torso.position.y = 1.14;
  torso.castShadow = true;
  body.add(torso);
  // parka zipper + pockets
  const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.78, 0.01), new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.3 }));
  zipper.position.set(0, 1.14, 0.225);
  body.add(zipper);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 6, 14), new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 1 }));
  hood.rotation.x = Math.PI / 2;
  hood.position.set(0, 1.58, -0.05);
  body.add(hood);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.24), packMat);
  pack.position.set(0, 1.18, -0.33);
  pack.castShadow = true;
  body.add(pack);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.56, 10), new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.9 }));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 1.55, -0.33);
  body.add(roll);

  const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 10), scarfMat);
  scarf.position.y = 1.58;
  body.add(scarf);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skinMat);
  head.position.y = 1.84;
  head.castShadow = true;
  body.add(head);

  const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.48), parkaMat);
  beanie.position.y = 2.04;
  group.add(beanie);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), scarfMat);
  pom.position.y = 2.2;
  group.add(pom);

  const goggles = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.13, 0.12),
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0c4a6e', metalness: 0.4, roughness: 0.1 })
  );
  goggles.position.set(0, 1.88, 0.22);
  body.add(goggles);

  // Arms holding the weapon forward
  const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.2);
  const leftArm = new THREE.Mesh(armGeo, parkaMat);
  leftArm.position.set(-0.4, 1.2, 0.2);
  leftArm.rotation.set(-1.15, 0, 0.35);
  const rightArm = new THREE.Mesh(armGeo, parkaMat);
  rightArm.position.set(0.44, 1.18, 0.16);
  rightArm.rotation.set(-1.25, 0, -0.1);
  body.add(leftArm, rightArm);
  group.add(mergeByMaterial(body));

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.2, 1.3, 0.42);
  weaponMount.rotation.y = Math.PI; // models point -Z, avatar faces +Z
  group.add(weaponMount);

  const helmetMount = new THREE.Group();
  helmetMount.position.y = 1.98;
  group.add(helmetMount);
  const vestMount = new THREE.Group();
  vestMount.position.set(0, 1.18, 0.0);
  group.add(vestMount);

  const chute = buildParachuteModel(color);
  chute.visible = false;
  chute.position.y = 0.6;
  group.add(chute);

  let weaponKey = null;
  function setWeapon(key) {
    if (key === weaponKey) return;
    weaponKey = key;
    weaponMount.clear();
    const model = key ? buildGunModel(key) : null;
    if (model) weaponMount.add(model);
  }

  let gear = '';
  function setGear(helmet, vest) {
    const k = `${helmet}|${vest}`;
    if (k === gear) return;
    gear = k;
    helmetMount.clear();
    vestMount.clear();
    beanie.visible = helmet <= 0;
    pom.visible = helmet <= 0;
    if (helmet > 0) {
      const h = buildHelmetModel(helmet);
      h.scale.setScalar(1.5);
      helmetMount.add(h);
    }
    if (vest > 0) {
      const v = buildVestModel(vest);
      v.scale.set(2.2, 1.9, 2.0);
      v.position.z = 0.04;
      vestMount.add(v);
    }
  }

  function setParachute(v) {
    chute.visible = v;
  }

  // Floating Name & HP Sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const labelSprite = new THREE.Sprite(spriteMat);
  labelSprite.position.set(0, 2.65, 0);
  labelSprite.scale.set(2.8, 0.7, 1);
  group.add(labelSprite);

  function updateLabel(newName, hp) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.roundRect(16, 4, 224, 52, 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(newName, 128, 30);
    ctx.fillStyle = '#334155';
    ctx.fillRect(36, 38, 184, 10);
    ctx.fillStyle = hp > 40 ? '#22c55e' : '#ef4444';
    ctx.fillRect(36, 38, Math.max(0, (hp / 100) * 184), 10);
    tex.needsUpdate = true;
  }

  updateLabel(name, 100);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    updateLabel,
    setWeapon,
    setGear,
    setParachute,
    label: labelSprite,
  };
}
