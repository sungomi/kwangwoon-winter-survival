import * as THREE from 'three';

/**
 * Builds playful, stylized 3D 1st-person viewmodels for:
 * - hands (맨손 + 눈덩이)
 * - 5 Primary guns: rifle, shotgun, dmr, sr, concept (제설 바주카)
 * - 3 Sidearms: watergun, revolver, slingshot
 * - flashbang (눈광탄)
 */
export function createViewModels(camera) {
  const root = new THREE.Group();
  root.position.set(0.3, -0.26, -0.52);
  camera.add(root);

  const models = {};

  function reg(key, group) {
    group.visible = false;
    root.add(group);
    models[key] = group;
  }

  // 4. 맨손 (Cozy mittens holding a snowball)
  {
    const g = new THREE.Group();
    const mittenMat = new THREE.MeshLambertMaterial({ color: '#ef4444' });
    const cuffMat = new THREE.MeshLambertMaterial({ color: '#f8fafc' });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), mittenMat);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.08), cuffMat);
    cuff.position.z = 0.13;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 10),
      new THREE.MeshLambertMaterial({ color: '#ffffff' })
    );
    ball.position.set(-0.04, 0.08, -0.1);
    g.add(hand, cuff, ball);
    reg('hands', g);
  }

  // 1-A. 라이플 (아이스 블래스터 AR)
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.14, 0.48),
      new THREE.MeshLambertMaterial({ color: '#0ea5e9' })
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.038, 0.36, 8),
      new THREE.MeshLambertMaterial({ color: '#e2e8f0' })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.35);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.18, 0.1),
      new THREE.MeshLambertMaterial({ color: '#f8fafc' })
    );
    mag.position.set(0, -0.14, -0.05);
    mag.rotation.x = 0.2;
    g.add(body, barrel, mag);
    reg('rifle', g);
  }

  // 1-B. 샷건 (더블배럴 눈대포)
  {
    const g = new THREE.Group();
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.13, 0.36),
      new THREE.MeshLambertMaterial({ color: '#92400e' })
    );
    const pipeMat = new THREE.MeshLambertMaterial({ color: '#cbd5e1' });
    const leftPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.44, 8), pipeMat);
    leftPipe.rotation.x = Math.PI / 2;
    leftPipe.position.set(-0.045, 0.04, -0.32);
    const rightPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.44, 8), pipeMat);
    rightPipe.rotation.x = Math.PI / 2;
    rightPipe.position.set(0.045, 0.04, -0.32);
    const muzzleRing = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.1, 0.06),
      new THREE.MeshLambertMaterial({ color: '#ef4444' })
    );
    muzzleRing.position.set(0, 0.04, -0.52);
    g.add(stock, leftPipe, rightPipe, muzzleRing);
    reg('shotgun', g);
  }

  // 1-C. DMR (고드름 SKS)
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.44),
      new THREE.MeshLambertMaterial({ color: '#15803d' })
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.032, 0.52, 8),
      new THREE.MeshLambertMaterial({ color: '#7dd3fc' })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.44);
    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.16),
      new THREE.MeshLambertMaterial({ color: '#1e293b' })
    );
    sight.position.set(0, 0.09, -0.05);
    g.add(body, barrel, sight);
    reg('dmr', g);
  }

  // 1-D. SR (설산 얼음 AWM)
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.13, 0.5),
      new THREE.MeshLambertMaterial({ color: '#1e3a8a' })
    );
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.65, 8),
      new THREE.MeshLambertMaterial({ color: '#e2e8f0' })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.54);
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10),
      new THREE.MeshLambertMaterial({ color: '#0f172a' })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.11, -0.08);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.034, 10),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    lens.position.set(0, 0.11, 0.062);
    g.add(body, barrel, scope, lens);
    reg('sr', g);
  }

  // 1-E. 컨셉총 (무지개 제설 바주카 캐논!)
  {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.68, 12),
      new THREE.MeshLambertMaterial({ color: '#f97316' })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.04, -0.2);
    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.11, 0.18, 12),
      new THREE.MeshLambertMaterial({ color: '#facc15' })
    );
    funnel.rotation.x = Math.PI / 2;
    funnel.position.set(0, 0.04, -0.58);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.16, 0.1),
      new THREE.MeshLambertMaterial({ color: '#1e293b' })
    );
    handle.position.set(0, -0.11, -0.05);
    g.add(tube, funnel, handle);
    reg('concept', g);
  }

  // 2-A. 보조무기: 네온 물총 (Watergun)
  {
    const g = new THREE.Group();
    const tank = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshLambertMaterial({ color: '#06b6d4' })
    );
    tank.position.set(0, 0.1, -0.05);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.32),
      new THREE.MeshLambertMaterial({ color: '#ec4899' })
    );
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.16, 8),
      new THREE.MeshLambertMaterial({ color: '#facc15' })
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.01, -0.22);
    g.add(tank, body, nozzle);
    reg('watergun', g);
  }

  // 2-B. 보조무기: 황금 리볼버 (Revolver)
  {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.09, 0.32),
      new THREE.MeshLambertMaterial({ color: '#eab308' })
    );
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8),
      new THREE.MeshLambertMaterial({ color: '#94a3b8' })
    );
    cyl.rotation.x = Math.PI / 2;
    cyl.position.set(0, 0.01, -0.04);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.08),
      new THREE.MeshLambertMaterial({ color: '#78350f' })
    );
    grip.position.set(0, -0.1, 0.1);
    grip.rotation.x = 0.25;
    g.add(frame, cyl, grip);
    reg('revolver', g);
  }

  // 2-C. 보조무기: 유쾌한 새총 슈터 (Slingshot)
  {
    const g = new THREE.Group();
    const forkMat = new THREE.MeshLambertMaterial({ color: '#a16207' });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), forkMat);
    stem.position.set(0, -0.08, 0);
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.16, 6), forkMat);
    leftArm.position.set(-0.07, 0.06, 0);
    leftArm.rotation.z = 0.45;
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.16, 6), forkMat);
    rightArm.position.set(0.07, 0.06, 0);
    rightArm.rotation.z = -0.45;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.02, 0.02),
      new THREE.MeshBasicMaterial({ color: '#ef4444' })
    );
    band.position.set(0, 0.12, 0.02);
    g.add(stem, leftArm, rightArm, band);
    reg('slingshot', g);
  }

  // 3. 눈광탄 (Sparkling Snow Flashbang)
  {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.09, 0),
      new THREE.MeshLambertMaterial({ color: '#e0f2fe' })
    );
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.045, 0),
      new THREE.MeshBasicMaterial({ color: '#facc15' })
    );
    star.position.y = 0.11;
    g.add(orb, star);
    reg('flashbang', g);
  }

  let currentKey = null;

  function setModel(key) {
    const resolved = models[key] ? key : 'hands';
    if (currentKey === resolved) return;
    Object.entries(models).forEach(([k, grp]) => {
      grp.visible = k === resolved;
    });
    currentKey = resolved;
  }

  function setRecoil(recoilOffset, visible) {
    root.visible = visible;
    root.position.z = -0.52 + recoilOffset;
    root.rotation.x = recoilOffset * 1.4;
  }

  setModel('hands');

  return {
    setModel,
    setRecoil,
  };
}
