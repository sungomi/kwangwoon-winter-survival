/**
 * Hand-placed campus landscape features (local meters, x = east, z = south), traced from the
 * Kakao Map skyview over the OSM building outlines.
 *
 *  - The central round plaza (원형 광장) sits ~4m above 광운로; its concentric rings are steps
 *    down into a shallow sunken circle.
 *  - A wide staircase climbs from 광운로 to the plaza on its north-west side.
 *  - Terraced flower beds step down south of the plaza toward 옥의관.
 *  - 80주년기념관 (중앙도서관) faces the plaza with its entrance, has a solar-panel roof and a lawn
 *    garden with crossing paths on its east side.
 *  - 정문 / 후문 and building entrances come from OSM entrance nodes.
 */

export const PLAZA = {
  x: -5,
  z: 22,
  radius: 21, // flat paved top
  blend: 2.5, // edge transition; where natural ground is far lower this becomes a retaining wall
  lift: 0.35, // above natural ground at the centre
  rings: [6, 10, 14], // sunken circle: inside 6m is lowest, each ring one step up
  ringStep: 0.3,
};

// Grand staircases: positioned cleanly in open corridors with zero building overlap
export const STAIRS = [
  // West approach from 광운로 corridor between 80주년기념관 and 복지관 up to the plaza rim
  { id: 'plaza-west', a: [-33, -1], b: [-21, 10], width: 8.5, toPlaza: true },
  // Library entrance steps (80주년기념관 forecourt up to the north rim of the plaza)
  { id: 'library-front', a: [-9, -11], b: [-7, 2], width: 8.5, toPlaza: true, down: true },
];

// Raised planter terraces (cover + walls), stepping down to the south-east of the plaza
export const TERRACES = [
  { x: 14, z: 42, w: 16, d: 5, h: 0.9, rot: -0.35 },
  { x: 18, z: 49, w: 15, d: 5, h: 0.75, rot: -0.35 },
  { x: 22, z: 56, w: 13, d: 5, h: 0.6, rot: -0.35 },
];

// 80주년기념관 east lawn garden with two crossing paths
export const LIBRARY_LAWN = {
  polygon: [
    [8, -66],
    [52, -60],
    [56, -22],
    [12, -26],
  ],
  paths: [
    [[8, -66], [56, -22]],
    [[52, -60], [12, -26]],
  ],
};

export const LIBRARY = {
  name: '80주년 기념관',
  sign: '중앙도서관 · CENTRAL LIBRARY',
  entranceFacing: 'plaza',
};

// Real gates from OSM (entrance=gate), cleared of adjacent building corners
export const GATES = [
  { id: 'main', label: '광운대학교', sub: 'KWANGWOON UNIVERSITY · 정문', x: -76, z: 58, width: 10.5 },
  { id: 'back', label: '광운대학교 후문', sub: 'BACK GATE', x: 188, z: -61, width: 9 },
];

// OSM entrance=yes nodes (building doors)
export const ENTRANCES = [
  [-163, -11],
  [54, 19],
  [42, -73],
  [-110, 18],
  [-157, -61],
  [-156, -124],
];
