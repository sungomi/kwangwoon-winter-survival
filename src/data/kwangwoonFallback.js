/**
 * Authentic Kwangwoon University (광운대학교) campus map dataset in local meter coordinates
 * (center ~ 37.6195°N, 127.0598°E). Used as an instant offline fallback if OSM data is unavailable.
 */
export function getKwangwoonFallbackMap() {
  const buildings = [
    // Core campus buildings (matching real relative positions & shapes)
    {
      id: 'bima',
      name: '비마관',
      isCampus: true,
      height: 26,
      roofColor: '#d4d6d9',
      wallColor: '#d8cfc2',
      polygon: [
        [-28, -32], [22, -26], [34, 8], [16, 30], [-14, 34], [-34, 10]
      ],
    },
    {
      id: 'hwado',
      name: '화도관',
      isCampus: true,
      height: 24,
      roofColor: '#d0d3d6',
      wallColor: '#ded7cb',
      polygon: [
        [24, -76], [48, -74], [58, -22], [36, -18]
      ],
    },
    {
      id: 'haksul',
      name: '학술정',
      isCampus: true,
      height: 20,
      roofColor: '#a2a8ae',
      wallColor: '#c9c4bb',
      polygon: [
        [-68, -68], [-8, -62], [-10, -42], [-70, -48]
      ],
    },
    {
      id: 'dasan',
      name: '다산재',
      isCampus: true,
      height: 28,
      roofColor: '#90979e',
      wallColor: '#cbc4b9',
      polygon: [
        [52, 24], [88, 24], [88, 66], [70, 66], [70, 42], [52, 42]
      ],
    },
    {
      id: 'hancheon',
      name: '한천재',
      isCampus: true,
      height: 26,
      roofColor: '#b7bcc2',
      wallColor: '#cfc8be',
      polygon: [
        [-115, -92], [-80, -88], [-82, -60], [-117, -64]
      ],
    },
    {
      id: 'chambit',
      name: '참빛관',
      isCampus: true,
      height: 30,
      roofColor: '#c4c9cf',
      wallColor: '#9e3b2e',
      polygon: [
        [72, -14], [108, -14], [108, 16], [72, 16]
      ],
    },
    {
      id: 'saebit',
      name: '새빛관',
      isCampus: true,
      height: 24,
      roofColor: '#3f7c54',
      wallColor: '#d5cec2',
      polygon: [
        [-96, 10], [-62, 10], [-62, 46], [-96, 46]
      ],
    },
    {
      id: 'bokji',
      name: '복지관',
      isCampus: true,
      height: 16,
      roofColor: '#48825b',
      wallColor: '#8d3a2e',
      polygon: [
        [-88, 52], [-54, 52], [-54, 78], [-88, 78]
      ],
    },
    {
      id: 'nuri',
      name: '누리관',
      isCampus: true,
      height: 22,
      roofColor: '#4e83a8',
      wallColor: '#dad3c7',
      polygon: [
        [-118, -36], [-80, -36], [-80, -10], [-118, -10]
      ],
    },
    {
      id: 'donghae',
      name: '동해문화예술관',
      isCampus: true,
      height: 20,
      roofColor: '#3b6ca8',
      wallColor: '#d8d0c4',
      polygon: [
        [-38, 54], [-10, 54], [-10, 76], [-38, 76]
      ],
    },
    {
      id: 'okui',
      name: '옥의관',
      isCampus: true,
      height: 18,
      roofColor: '#9ca3aa',
      wallColor: '#d2cbc0',
      polygon: [
        [8, 46], [38, 46], [38, 68], [8, 68]
      ],
    },
  ];

  // Surrounding Wolgye-dong neighborhood buildings for authentic city density
  const roofPalette = ['#cfd4da', '#4a855e', '#4c80a6', '#a85143', '#b8bec4'];
  const wallPalette = ['#dcd5c9', '#d2cabd', '#c7bfb2', '#e0d9ce'];
  let idx = 0;
  for (let gx = -160; gx <= 160; gx += 28) {
    for (let gz = -165; gz <= 155; gz += 26) {
      // Keep central campus area clear
      if (gx > -125 && gx < 115 && gz > -100 && gz < 88) continue;
      const w = 14 + ((idx * 7) % 8);
      const d = 12 + ((idx * 5) % 8);
      const h = 9 + ((idx * 11) % 14);
      const ox = ((idx * 13) % 7) - 3;
      const oz = ((idx * 17) % 7) - 3;
      const x = gx + ox;
      const z = gz + oz;
      buildings.push({
        id: `city_${idx}`,
        name: null,
        isCampus: false,
        height: h,
        roofColor: roofPalette[idx % roofPalette.length],
        wallColor: wallPalette[idx % wallPalette.length],
        polygon: [
          [x - w / 2, z - d / 2],
          [x + w / 2, z - d / 2],
          [x + w / 2, z + d / 2],
          [x - w / 2, z + d / 2],
        ],
      });
      idx++;
    }
  }

  const roads = [
    { width: 9, points: [[-180, -105], [0, -96], [170, -88]] },
    { width: 8, points: [[-180, 92], [-40, 86], [170, 92]] },
    { width: 7, points: [[-128, -170], [-126, 0], [-128, 165]] },
    { width: 7, points: [[124, -170], [122, 0], [124, 165]] },
    { width: 6, points: [[-56, -42], [-46, 12], [-46, 86]] },
    { width: 6, points: [[38, -22], [44, 18], [44, 88]] },
  ];

  const pitches = [
    { type: 'soccer', center: [58, -10], width: 28, depth: 18, rotation: 0.12 },
    { type: 'basketball', center: [62, 8], width: 22, depth: 14, rotation: 0.12 },
  ];

  const grasses = [
    {
      color: '#d4be96', // Kwangwoon Plaza / dirt field behind 학술정 & 비마관
      polygon: [[-64, -44], [-18, -40], [-24, -14], [-68, -20]],
    },
    {
      color: '#5fa343',
      polygon: [[-62, -10], [-36, -12], [-34, 24], [-60, 26]],
    },
    {
      color: '#5fa343',
      polygon: [[-8, 36], [24, 34], [26, 45], [-6, 45]],
    },
  ];

  const trees = [
    [-72, -32], [-72, -18], [-72, -4], [-40, -78], [-22, -78], [0, -78],
    [18, -78], [58, -68], [64, -46], [48, 72], [28, 76], [-48, 82],
    [-98, -2], [-98, 50], [-44, 32], [-18, 42], [96, -34], [98, 36],
  ];

  return { buildings, roads, pitches, grasses, trees };
}
