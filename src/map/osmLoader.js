import { getKwangwoonFallbackMap } from '../data/kwangwoonFallback.js';

const METERS_PER_LAT = 111320;

// Real-world architectural profiles for Kwangwoon University buildings
const KWANGWOON_PROFILES = {
  화도관: { facadeType: 'brick_clean', wallColor: '#a84a3c', roofColor: '#c4bfb7', height: 22, roofStyle: 'clocktower' },
  비마관: { facadeType: 'ribbon', wallColor: '#d2ccc0', roofColor: '#c9ccd0', height: 32 },
  새빛관: { facadeType: 'saebit_modern', wallColor: '#e6ebf0', roofColor: '#c7cfd6', height: 33 },
  참빛관: { facadeType: 'curtainwall', wallColor: '#487696', roofColor: '#a2abb3', height: 36 },
  연구관: { facadeType: 'curtainwall', wallColor: '#567c94', roofColor: '#adb5bd', height: 34 },
  '80주년 기념관': { facadeType: 'memorial_80', wallColor: '#ece9e1', roofColor: '#76a65b', height: 15, roofStyle: 'terrace_green' },
  복지관: { facadeType: 'brick_clean', wallColor: '#a35144', roofColor: '#aeb3b8', height: 18 },
  옥의관: { facadeType: 'ribbon', wallColor: '#cbc4b8', roofColor: '#b5b9be', height: 30 },
  한울관: { facadeType: 'stone_modern', wallColor: '#dcd6ca', roofColor: '#bfc4c9', height: 25 },
  다산재: { facadeType: 'brick_clean', wallColor: '#94483c', roofColor: '#9da3a8', height: 16 },
  한천재: { facadeType: 'brick_clean', wallColor: '#9e5144', roofColor: '#a8adb2', height: 19 },
  연촌재: { facadeType: 'brick_clean', wallColor: '#a35b4c', roofColor: '#b0b4b9', height: 12 },
  승리관: { facadeType: 'stone_modern', wallColor: '#d6d0c5', roofColor: '#5c859e', height: 15 },
  '광운대학교 동해문화예술관 대극장': { facadeType: 'stone_modern', wallColor: '#ded8cc', roofColor: '#56687a', height: 22 },
  '광운대학교 아이스링크장': { facadeType: 'arena', wallColor: '#cfd6de', roofColor: '#4a7aa8', height: 16 },
  '빛솔재 A동': { facadeType: 'apartment', wallColor: '#e2dcd2', roofColor: '#b8bec4', height: 24 },
  '빛솔재 B동': { facadeType: 'apartment', wallColor: '#e2dcd2', roofColor: '#b8bec4', height: 24 },
  '인터내셔널 하우스': { facadeType: 'brick_clean', wallColor: '#a85a4a', roofColor: '#b5b9be', height: 14 },
};

function estimateHeight(tags = {}, profile = null) {
  if (tags.height) {
    const parsed = parseFloat(tags.height);
    if (!Number.isNaN(parsed) && parsed > 2) return parsed;
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (!Number.isNaN(levels) && levels > 0) return levels * 3.5;
  }
  if (profile?.height) return profile.height;
  if (tags.building === 'university' || tags.amenity === 'university') return 20;
  if (tags.building === 'dormitory') return 16;
  if (tags.building === 'apartments') return 36;
  return 11;
}

const ROOF_PALETTE = ['#cfd4da', '#4a855e', '#4c80a6', '#a85143', '#b8bec4'];
const WALL_PALETTE = ['#dcd5c9', '#d2cabd', '#c7bfb2', '#e0d9ce', '#b56e5c'];

function computeGeoJsonOrigin(features) {
  let sumLat = 0;
  let sumLon = 0;
  let count = 0;

  for (const f of features) {
    if (f.properties?.building !== 'university') continue;
    const coords =
      f.geometry?.type === 'Polygon'
        ? f.geometry.coordinates[0]
        : f.geometry?.type === 'MultiPolygon'
        ? f.geometry.coordinates[0]?.[0]
        : null;
    if (!coords) continue;
    for (const [lon, lat] of coords) {
      sumLat += lat;
      sumLon += lon;
      count++;
    }
  }

  if (count === 0) {
    return { lat: 37.6195, lon: 127.0598 };
  }
  return { lat: sumLat / count, lon: sumLon / count };
}

function loadGeoJson(geojson) {
  const features = geojson.features || [];
  if (features.length < 5) return getKwangwoonFallbackMap();

  const origin = computeGeoJsonOrigin(features);
  const metersPerLon = METERS_PER_LAT * Math.cos((origin.lat * Math.PI) / 180);

  const project = ([lon, lat]) => [
    (lon - origin.lon) * metersPerLon,
    -(lat - origin.lat) * METERS_PER_LAT,
  ];

  const buildings = [];
  const roads = [];
  const pitches = [];
  const grasses = [];
  const trees = [];

  let bIdx = 0;

  for (const f of features) {
    const props = f.properties || {};
    const geom = f.geometry;
    if (!geom) continue;

    if (geom.type === 'Point' && props.natural === 'tree') {
      trees.push(project(geom.coordinates));
      continue;
    }

    if (props.building && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
      const rings =
        geom.type === 'Polygon'
          ? [geom.coordinates[0]]
          : geom.coordinates.map((poly) => poly[0]).filter(Boolean);

      const isCampus = props.building === 'university' || props.building === 'dormitory';
      const rawName = props['name:ko'] || props.name || null;
      const name = isCampus ? rawName : null;
      const profile = rawName ? KWANGWOON_PROFILES[rawName] : null;

      let facadeType = profile?.facadeType;
      if (!facadeType) {
        if (props.building === 'apartments') facadeType = 'apartment';
        else if (props.building === 'school') facadeType = 'brick';
        else facadeType = bIdx % 3 === 0 ? 'brick' : bIdx % 3 === 1 ? 'ribbon' : 'stone_modern';
      }

      const wallColor = profile?.wallColor || WALL_PALETTE[bIdx % WALL_PALETTE.length];
      const roofColor = profile?.roofColor || (isCampus ? '#c8cdd2' : ROOF_PALETTE[bIdx % ROOF_PALETTE.length]);

      for (const ring of rings) {
        if (!ring || ring.length < 3) continue;
        const pts = ring.map(project);
        buildings.push({
          id: `geo_${f.id || bIdx}_${bIdx}`,
          name,
          isCampus,
          facadeType,
          roofStyle: profile?.roofStyle || null,
          height: estimateHeight(props, profile),
          roofColor,
          wallColor,
          polygon: pts,
        });
        bIdx++;
      }
      continue;
    }

    if (props.highway && geom.type === 'LineString' && geom.coordinates.length >= 2) {
      const width =
        props.highway === 'primary' || props.highway === 'secondary'
          ? 11
          : props.highway === 'footway' || props.highway === 'path' || props.highway === 'steps'
          ? 3.2
          : 6.5;
      roads.push({
        width,
        points: geom.coordinates.map(project),
      });
      continue;
    }

    if (props.leisure === 'pitch' && geom.type === 'Polygon') {
      const pts = geom.coordinates[0].map(project);
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of pts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      pitches.push({
        type: props.sport === 'basketball' ? 'basketball' : 'soccer',
        center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
        width: Math.max(10, maxX - minX),
        depth: Math.max(8, maxZ - minZ),
        rotation: 0,
      });
      continue;
    }

    if (
      (props.leisure === 'park' || props.leisure === 'garden' || props.landuse === 'grass') &&
      geom.type === 'Polygon'
    ) {
      grasses.push({
        color: '#5fa343',
        polygon: geom.coordinates[0].map(project),
      });
    }
  }

  // Fill empty residential blocks across the road from 80주년 기념관 / 복지관 / 연구관
  populateResidentialNeighborhood(buildings, roads, pitches);

  return buildings.length >= 5 ? { buildings, roads, pitches, grasses, trees } : getKwangwoonFallbackMap();
}

function distPointToSegment(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - x1, pz - z1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

function getBounds(poly) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

function populateResidentialNeighborhood(buildings, roads, pitches) {
  const existingBounds = buildings.map((b) => getBounds(b.polygon));
  const villaRoofs = ['#4e8c5e', '#a95848', '#8c949c', '#547aa5', '#b8824c'];
  const villaWalls = ['#e4ddd1', '#d9d0c1', '#c9937e', '#d6d4cf', '#e8e2d5'];

  let vIdx = 0;
  // Cover residential areas west/southwest/northwest of 80주년 기념관 & 복지관
  for (let gx = -260; gx <= -45; gx += 15) {
    for (let gz = -180; gz <= 190; gz += 15) {
      // Skip central campus quad around 비마관/화도관/80주년 기념관
      if (gx > -65 && gz > -115 && gz < 120) continue;

      const w = 9 + ((vIdx * 3) % 4);
      const d = 8 + ((vIdx * 5) % 4);
      const cx = gx + (((vIdx * 7) % 3) - 1);
      const cz = gz + (((vIdx * 11) % 3) - 1);

      const minX = cx - w / 2;
      const maxX = cx + w / 2;
      const minZ = cz - d / 2;
      const maxZ = cz + d / 2;

      // Check overlap with existing buildings (with 4m buffer)
      let blocked = false;
      for (const eb of existingBounds) {
        if (maxX + 4 > eb.minX && minX - 4 < eb.maxX && maxZ + 4 > eb.minZ && minZ - 4 < eb.maxZ) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        vIdx++;
        continue;
      }

      // Check overlap with roads (with road half-width + 1.5m buffer)
      for (const r of roads) {
        const clearance = (r.width || 6) * 0.5 + Math.max(w, d) * 0.45 + 1.2;
        for (let i = 0; i < r.points.length - 1; i++) {
          const [x1, z1] = r.points[i];
          const [x2, z2] = r.points[i + 1];
          if (distPointToSegment(cx, cz, x1, z1, x2, z2) < clearance) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }
      if (blocked) {
        vIdx++;
        continue;
      }

      // Check overlap with pitches
      for (const p of pitches) {
        if (Math.abs(cx - p.center[0]) < p.width * 0.6 + 6 && Math.abs(cz - p.center[1]) < p.depth * 0.6 + 6) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        vIdx++;
        continue;
      }

      const h = 7.5 + ((vIdx * 3) % 7); // 2~4 story Korean villas
      buildings.push({
        id: `villa_${vIdx}`,
        name: null,
        isCampus: false,
        facadeType: 'villa',
        roofStyle: null,
        height: h,
        roofColor: villaRoofs[vIdx % villaRoofs.length],
        wallColor: villaWalls[vIdx % villaWalls.length],
        polygon: [
          [minX, minZ],
          [maxX, minZ],
          [maxX, maxZ],
          [minX, maxZ],
        ],
      });
      existingBounds.push({ minX, maxX, minZ, maxZ });
      vIdx++;
    }
  }
}

/**
 * Parses either a GeoJSON FeatureCollection or Overpass API JSON response into local meter coordinates,
 * or falls back to the built-in Kwangwoon University map if data is empty/invalid.
 */
export function loadKwangwoonMapData(data) {
  if (!data) return getKwangwoonFallbackMap();
  if (data.type === 'FeatureCollection') {
    return loadGeoJson(data);
  }
  return getKwangwoonFallbackMap();
}
