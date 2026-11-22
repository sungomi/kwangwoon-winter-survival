import * as THREE from 'three';

function drawLitWindow(ctx, x, y, w, h, seed, darkColor = '#1e2c3a') {
  const isLit = seed % 5 === 0 || seed % 7 === 0;
  ctx.fillStyle = isLit ? (seed % 2 === 0 ? '#ffd670' : '#ffbe55') : darkColor;
  ctx.fillRect(x, y, w, h);
  if (!isLit) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x + 1, y + 1, w - 2, Math.max(2, h * 0.28));
  }
}

/**
 * Generates varied, realistic stylized facade textures with warm Christmas evening window lighting.
 */
export function createBuildingFacadeTexture(facadeType = 'ribbon', wallColor = '#d9d2c5') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (facadeType === 'saebit_modern') {
    ctx.fillStyle = '#dce3eb';
    ctx.fillRect(0, 0, 128, 128);

    for (let r = 0; r < 4; r++) {
      const y = r * 32;
      for (let c = 0; c < 4; c++) {
        const x = c * 32 + 3;
        drawLitWindow(ctx, x, y + 6, 26, 20, r * 11 + c * 5, '#3b6a94');
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(0, y, 128, 2);
    }
  } else if (facadeType === 'memorial_80') {
    ctx.fillStyle = '#e6e3db';
    ctx.fillRect(0, 0, 128, 128);

    for (let r = 0; r < 4; r++) {
      const y = r * 32;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, y, 128, 2);

      for (let c = 0; c < 2; c++) {
        const x = c * 64 + 6;
        drawLitWindow(ctx, x, y + 6, 52, 20, r * 13 + c * 7 + 1, '#2f5673');
        ctx.fillStyle = '#cfd5db';
        ctx.fillRect(x + 25, y + 6, 2, 20);
      }
    }
  } else if (facadeType === 'curtainwall') {
    ctx.fillStyle = '#2d4c66';
    ctx.fillRect(0, 0, 128, 128);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        drawLitWindow(ctx, c * 16 + 2, r * 32 + 6, 12, 21, r * 17 + c * 3, '#385d7c');
      }
      ctx.fillStyle = '#1e3040';
      ctx.fillRect(0, r * 32, 128, 4);
    }
  } else if (facadeType === 'brick_clean') {
    ctx.fillStyle = wallColor || '#a84a3c';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = '#dfd7ca';
    for (let y = 0; y < 128; y += 32) {
      ctx.fillRect(0, y, 128, 4);
    }

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * 32 + 7;
        const y = r * 32 + 8;
        ctx.fillStyle = '#edeae4';
        ctx.fillRect(x - 1.5, y - 1.5, 21, 20);
        drawLitWindow(ctx, x, y, 18, 17, r * 9 + c * 7, '#223344');
      }
    }
  } else if (facadeType === 'brick') {
    ctx.fillStyle = wallColor || '#9e4738';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = '#cfc7bc';
    for (let y = 0; y < 128; y += 32) {
      ctx.fillRect(0, y, 128, 3);
    }
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * 32 + 6;
        const y = r * 32 + 8;
        ctx.fillStyle = '#e8e4dc';
        ctx.fillRect(x - 1, y - 1, 22, 20);
        drawLitWindow(ctx, x, y, 20, 18, r * 13 + c * 5, '#253443');
      }
    }
  } else if (facadeType === 'stone_modern') {
    ctx.fillStyle = wallColor || '#e2ddd3';
    ctx.fillRect(0, 0, 128, 128);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        const x = c * 64 + 8;
        const y = r * 32 + 7;
        drawLitWindow(ctx, x, y, 48, 19, r * 7 + c * 11, '#263c4f');
      }
    }
  } else if (facadeType === 'arena') {
    ctx.fillStyle = wallColor || '#cfd6de';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = 0; x < 128; x += 8) {
      ctx.fillRect(x, 0, 2, 128);
    }
    ctx.fillStyle = '#38556e';
    ctx.fillRect(0, 20, 128, 22);
    ctx.fillRect(0, 84, 128, 22);
  } else if (facadeType === 'villa') {
    ctx.fillStyle = wallColor || '#dfd5c6';
    ctx.fillRect(0, 0, 128, 128);

    for (let r = 0; r < 4; r++) {
      const y = r * 32;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, y, 128, 2);
      for (let c = 0; c < 3; c++) {
        const x = c * 42 + 7;
        drawLitWindow(ctx, x, y + 8, 28, 17, r * 11 + c * 13, '#253240');
        ctx.fillStyle = '#ece8e0';
        ctx.fillRect(x + 13, y + 8, 2, 17);
      }
    }
  } else if (facadeType === 'apartment') {
    ctx.fillStyle = wallColor || '#e3dfd7';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = 'rgba(70, 95, 120, 0.22)';
    ctx.fillRect(58, 0, 12, 128);

    for (let r = 0; r < 4; r++) {
      const y = r * 32 + 6;
      drawLitWindow(ctx, 8, y, 42, 12, r * 7 + 1, '#233140');
      ctx.fillStyle = '#c4beb3';
      ctx.fillRect(8, y + 12, 42, 6);
      drawLitWindow(ctx, 78, y, 42, 12, r * 11 + 3, '#233140');
      ctx.fillStyle = '#c4beb3';
      ctx.fillRect(78, y + 12, 42, 6);
    }
  } else {
    ctx.fillStyle = wallColor || '#d5cfc4';
    ctx.fillRect(0, 0, 128, 128);

    for (let r = 0; r < 4; r++) {
      const y = r * 32;
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, 128, 4);
      for (let c = 0; c < 5; c++) {
        drawLitWindow(ctx, 4 + c * 24, y + 8, 21, 16, r * 13 + c * 5, '#202e3b');
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Creates a stylized soccer/athletic field texture.
 */
export function createPitchTexture(type = 'soccer') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  if (type === 'basketball') {
    ctx.fillStyle = '#33679e';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#eef4fa';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 236, 140);
  } else {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#69997b' : '#73a385';
      ctx.fillRect(i * 32, 0, 32, 160);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 236, 140);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
