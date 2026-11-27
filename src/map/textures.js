import * as THREE from 'three';

function drawLitWindow(ctx, x, y, w, h, seed, darkColor = '#1f3042') {
  const isLit = seed % 5 === 0 || seed % 7 === 0;
  ctx.fillStyle = isLit ? (seed % 2 === 0 ? '#ffd875' : '#ffbe58') : darkColor;
  ctx.fillRect(x, y, w, h);
  if (isLit) {
    // subtle interior ceiling/curtain band
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x, y, w, Math.max(2, h * 0.22));
  } else {
    // subtle sky/glass reflection gradient band
    ctx.fillStyle = 'rgba(180, 215, 245, 0.14)';
    ctx.fillRect(x + 1, y + 1, w - 2, Math.max(3, h * 0.32));
  }
}

function drawStoneJoints(ctx, W, H, stepX, stepY, alpha = 0.09) {
  ctx.fillStyle = `rgba(40, 42, 48, ${alpha})`;
  for (let y = 0; y < H; y += stepY) ctx.fillRect(0, y, W, 1);
  for (let x = 0; x < W; x += stepX) ctx.fillRect(x, 0, 1, H);
}

/**
 * Generates realistic 256x256 procedural facade textures for Kwangwoon University campus buildings,
 * matched to real Roadview / Street View materials with warm winter-evening window lighting.
 */
export function createBuildingFacadeTexture(facadeType = 'ribbon', wallColor = '#d9d2c5') {
  const W = 256;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (facadeType === 'hwado_granite') {
    // 화도관: warm pale-beige granite panels, classical cornice bands, regular dark-framed rectangular windows
    ctx.fillStyle = wallColor || '#dcd7cd';
    ctx.fillRect(0, 0, W, H);
    drawStoneJoints(ctx, W, H, 32, 16, 0.08);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      // stone floor cornice band
      ctx.fillStyle = '#c8c2b6';
      ctx.fillRect(0, y, W, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y + 6, W, 2);
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + 12;
        const wy = y + 16;
        // recessed shadow + dark bronze/charcoal window frame
        ctx.fillStyle = '#5a564f';
        ctx.fillRect(x - 2, wy - 2, 44, 38);
        drawLitWindow(ctx, x, wy, 40, 34, r * 11 + c * 7 + 2, '#243444');
        // vertical mullion
        ctx.fillStyle = '#3b424b';
        ctx.fillRect(x + 19, wy, 2, 34);
        ctx.fillRect(x, wy + 12, 40, 2);
        // granite sill
        ctx.fillStyle = '#e8e4dc';
        ctx.fillRect(x - 3, wy + 34, 46, 4);
      }
    }
  } else if (facadeType === 'memorial_80') {
    // 80주년기념관: light-grey vertical ribbed stone/concrete louver panels + large dark-framed gridded glass bays
    ctx.fillStyle = wallColor || '#d8dce2';
    ctx.fillRect(0, 0, W, H);
    // vertical stone louvers across the panel bands
    for (let x = 0; x < W; x += 6) {
      ctx.fillStyle = x % 12 === 0 ? 'rgba(60, 70, 82, 0.14)' : 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(x, 0, 2, H);
    }
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      ctx.fillStyle = '#9aa3ad';
      ctx.fillRect(0, y, W, 5);
      // wide recessed dark-framed gridded curtain wall bay
      for (let c = 0; c < 2; c++) {
        const x = c * 128 + 10;
        ctx.fillStyle = '#252e38';
        ctx.fillRect(x - 3, y + 10, 114, 46);
        for (let m = 0; m < 4; m++) {
          drawLitWindow(ctx, x + m * 27 + 2, y + 13, 24, 40, r * 13 + c * 7 + m * 3, '#2b4d68');
        }
        // horizontal transom
        ctx.fillStyle = '#2c3742';
        ctx.fillRect(x, y + 32, 108, 3);
      }
    }
  } else if (facadeType === 'bokji_brick') {
    // 복지관: red-brown brick with rhythmic vertical brick pilasters & dark-green-tinted windows
    ctx.fillStyle = wallColor || '#964438';
    ctx.fillRect(0, 0, W, H);
    // subtle brick courses
    ctx.fillStyle = 'rgba(240, 225, 210, 0.10)';
    for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 1);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      // light-grey stone spandrel band
      ctx.fillStyle = '#cfc8be';
      ctx.fillRect(0, y, W, 8);
      for (let c = 0; c < 4; c++) {
        const px = c * 64;
        // half-round vertical red-brick pilaster shading
        ctx.fillStyle = '#ad5244';
        ctx.fillRect(px, y + 8, 8, 56);
        ctx.fillStyle = '#733128';
        ctx.fillRect(px + 8, y + 8, 4, 56);
        // recessed dark-green-tinted window
        const wx = px + 14;
        const wy = y + 16;
        ctx.fillStyle = '#363b3f';
        ctx.fillRect(wx - 2, wy - 2, 44, 36);
        drawLitWindow(ctx, wx, wy, 40, 32, r * 9 + c * 5, '#1e3a3c');
        ctx.fillStyle = '#485258';
        ctx.fillRect(wx + 19, wy, 2, 32);
      }
    }
  } else if (facadeType === 'bima_ribbon') {
    // 비마관: pale-grey concrete/stone with continuous horizontal 3-pane ribbon window bands
    ctx.fillStyle = wallColor || '#d9d6cf';
    ctx.fillRect(0, 0, W, H);
    drawStoneJoints(ctx, W, H, 64, 32, 0.06);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      // crisp concrete spandrel band
      ctx.fillStyle = '#e4e1da';
      ctx.fillRect(0, y, W, 22);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(0, y + 21, W, 2);
      // continuous ribbon window strip divided into 3-pane bays
      ctx.fillStyle = '#2d3740';
      ctx.fillRect(0, y + 23, W, 34);
      for (let c = 0; c < 6; c++) {
        drawLitWindow(ctx, c * 42 + 4, y + 26, 36, 28, r * 17 + c * 5, '#25394a');
      }
      // thin bottom sill
      ctx.fillStyle = '#c5c1b8';
      ctx.fillRect(0, y + 57, W, 4);
    }
  } else if (facadeType === 'saebit_modern') {
    // 새빛관: bright off-white/pale-grey panels with wide horizontal dark-tinted ribbon windows
    ctx.fillStyle = wallColor || '#e7ebf0';
    ctx.fillRect(0, 0, W, H);
    drawStoneJoints(ctx, W, H, 64, 64, 0.08);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      // crisp white spandrel panel
      ctx.fillStyle = '#eef2f6';
      ctx.fillRect(0, y, W, 20);
      ctx.fillStyle = 'rgba(30, 45, 60, 0.16)';
      ctx.fillRect(0, y + 19, W, 2);
      // continuous modern dark-tinted ribbon glass
      ctx.fillStyle = '#1f2d3a';
      ctx.fillRect(0, y + 21, W, 38);
      for (let c = 0; c < 8; c++) {
        drawLitWindow(ctx, c * 32 + 2, y + 24, 28, 32, r * 11 + c * 5, '#284a69');
      }
      ctx.fillStyle = '#cfd7e0';
      ctx.fillRect(0, y + 59, W, 3);
    }
  } else if (facadeType === 'chambit_stone') {
    // 참빛관: warm pinkish-beige / pale-taupe granite pier grid framing deeply recessed punched windows
    ctx.fillStyle = wallColor || '#d6c4b8';
    ctx.fillRect(0, 0, W, H);
    drawStoneJoints(ctx, W, H, 32, 16, 0.08);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      // horizontal granite spandrel band
      ctx.fillStyle = '#c9b6aa';
      ctx.fillRect(0, y, W, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y + 16, W, 2);
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + 10;
        const wy = y + 20;
        // deep recessed window shadow
        ctx.fillStyle = '#3c3836';
        ctx.fillRect(x - 3, wy - 2, 48, 38);
        drawLitWindow(ctx, x, wy, 42, 34, r * 13 + c * 9 + 1, '#233647');
        ctx.fillStyle = '#3a4550';
        ctx.fillRect(x + 20, wy, 2, 34);
      }
    }
  } else if (facadeType === 'ogeui_concrete') {
    // 옥의관: off-white/light-grey painted concrete with regular rectangular punched windows
    ctx.fillStyle = wallColor || '#d9d8d3';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, W, 3);
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + 10;
        const wy = y + 16;
        ctx.fillStyle = '#484f56';
        ctx.fillRect(x - 2, wy - 2, 48, 36);
        drawLitWindow(ctx, x, wy, 44, 32, r * 7 + c * 11, '#243546');
        ctx.fillStyle = '#5c6670';
        ctx.fillRect(x + 21, wy, 2, 32);
      }
    }
  } else if (facadeType === 'yeongu_mixed') {
    // 연구관: beige stone cladding with teal-green reflective curtain-wall bays
    ctx.fillStyle = wallColor || '#d2c2b0';
    ctx.fillRect(0, 0, W, H);
    drawStoneJoints(ctx, W, H, 32, 16, 0.07);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      ctx.fillStyle = '#bca995';
      ctx.fillRect(0, y, W, 8);
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + 6;
        const isGlassBay = c === 1 || c === 2;
        ctx.fillStyle = '#243e44';
        ctx.fillRect(x - 2, y + 12, 54, 44);
        drawLitWindow(ctx, x, y + 14, 50, 40, r * 11 + c * 7, isGlassBay ? '#23585c' : '#284552');
        ctx.fillStyle = '#3c5c63';
        ctx.fillRect(x + 24, y + 14, 2, 40);
      }
    }
  } else if (facadeType === 'donghae_brick') {
    // 동해문화예술관: reddish-terracotta brick/panel facade with horizontal window strips & teal accents
    ctx.fillStyle = wallColor || '#a65040';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 240, 230, 0.08)';
    for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 1);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      ctx.fillStyle = '#c9c2b8';
      ctx.fillRect(0, y, W, 6);
      ctx.fillStyle = '#24464c';
      ctx.fillRect(0, y + 22, W, 28);
      for (let c = 0; c < 6; c++) {
        drawLitWindow(ctx, c * 42 + 4, y + 25, 36, 22, r * 13 + c * 7, '#275960');
      }
    }
  } else if (facadeType === 'curtainwall') {
    ctx.fillStyle = '#2d4c66';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        drawLitWindow(ctx, c * 32 + 4, r * 64 + 12, 24, 42, r * 17 + c * 3, '#385d7c');
      }
      ctx.fillStyle = '#1e3040';
      ctx.fillRect(0, r * 64, W, 8);
    }
  } else if (facadeType === 'brick_clean' || facadeType === 'brick') {
    ctx.fillStyle = wallColor || '#9e4738';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(245, 235, 225, 0.1)';
    for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = '#dfd7ca';
    for (let y = 0; y < H; y += 64) ctx.fillRect(0, y, W, 7);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + 14;
        const y = r * 64 + 16;
        ctx.fillStyle = '#edeae4';
        ctx.fillRect(x - 3, y - 3, 42, 40);
        drawLitWindow(ctx, x, y, 36, 34, r * 9 + c * 7, '#223344');
        ctx.fillStyle = '#4c5660';
        ctx.fillRect(x + 17, y, 2, 34);
      }
    }
  } else if (facadeType === 'stone_modern') {
    ctx.fillStyle = wallColor || '#e2ddd3';
    ctx.fillRect(0, 0, W, H);
    drawStoneJoints(ctx, W, H, 32, 16, 0.07);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 2; c++) {
        const x = c * 128 + 16;
        const y = r * 64 + 14;
        ctx.fillStyle = '#3b4550';
        ctx.fillRect(x - 2, y - 2, 100, 42);
        drawLitWindow(ctx, x, y, 96, 38, r * 7 + c * 11, '#263c4f');
        ctx.fillStyle = '#4a5662';
        ctx.fillRect(x + 47, y, 2, 38);
      }
    }
  } else if (facadeType === 'arena') {
    ctx.fillStyle = wallColor || '#cfd6de';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 3, H);
    ctx.fillStyle = '#38556e';
    ctx.fillRect(0, 40, W, 44);
    ctx.fillRect(0, 168, W, 44);
  } else if (facadeType === 'apartment') {
    ctx.fillStyle = wallColor || '#e3dfd7';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(70, 95, 120, 0.22)';
    ctx.fillRect(116, 0, 24, H);
    for (let r = 0; r < 4; r++) {
      const y = r * 64 + 12;
      drawLitWindow(ctx, 16, y, 84, 24, r * 7 + 1, '#233140');
      ctx.fillStyle = '#c4beb3';
      ctx.fillRect(16, y + 24, 84, 12);
      drawLitWindow(ctx, 156, y, 84, 24, r * 11 + 3, '#233140');
      ctx.fillStyle = '#c4beb3';
      ctx.fillRect(156, y + 24, 84, 12);
    }
  } else {
    ctx.fillStyle = wallColor || '#d5cfc4';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, W, 8);
      for (let c = 0; c < 4; c++) {
        drawLitWindow(ctx, 10 + c * 64, y + 16, 44, 34, r * 13 + c * 5, '#202e3b');
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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
    ctx.beginPath();
    ctx.moveTo(128, 10);
    ctx.lineTo(128, 150);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 80, 24, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#5c9370' : '#669d7a';
      ctx.fillRect(i * 32, 0, 32, 160);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 236, 140);
    ctx.beginPath();
    ctx.moveTo(128, 10);
    ctx.lineTo(128, 150);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 80, 22, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
