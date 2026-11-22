import * as THREE from 'three';

/**
 * Creates a stylized 3D Winter Survival character (parka, scarf, beanie, goggles, gun).
 */
export function createPlayerAvatar(color = '#ef4444', name = '학우') {
  const group = new THREE.Group();

  const parkaMat = new THREE.MeshLambertMaterial({ color });
  const pantsMat = new THREE.MeshLambertMaterial({ color: '#1f2937' });
  const skinMat = new THREE.MeshLambertMaterial({ color: '#f3cfb6' });
  const scarfMat = new THREE.MeshLambertMaterial({ color: '#f8fafc' });
  const gunMat = new THREE.MeshLambertMaterial({ color: '#111827' });

  // Legs
  const legGeo = new THREE.BoxGeometry(0.26, 0.72, 0.26);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.18, 0.36, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.18, 0.36, 0);
  rightLeg.castShadow = true;
  group.add(leftLeg, rightLeg);

  // Winter Parka Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.82, 0.42), parkaMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  // Scarf
  const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 10), scarfMat);
  scarf.position.y = 1.56;
  group.add(scarf);

  // Head + Beanie + Tactical Goggles
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skinMat);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);

  const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.48), parkaMat);
  beanie.position.y = 2.02;
  group.add(beanie);

  const goggles = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.13, 0.12),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  goggles.position.set(0, 1.86, 0.22);
  group.add(goggles);

  // Arms + Rifle
  const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.2);
  const leftArm = new THREE.Mesh(armGeo, parkaMat);
  leftArm.position.set(-0.46, 1.16, 0.12);
  leftArm.rotation.x = -0.5;
  const rightArm = new THREE.Mesh(armGeo, parkaMat);
  rightArm.position.set(0.46, 1.16, 0.18);
  rightArm.rotation.x = -1.1;

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.72), gunMat);
  gun.position.set(0.44, 1.24, 0.56);
  group.add(leftArm, rightArm, gun);

  // Floating Name & HP Sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const labelSprite = new THREE.Sprite(spriteMat);
  labelSprite.position.set(0, 2.55, 0);
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

    // HP bar
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
    updateLabel,
  };
}
