import { getKwangwoonFallbackMap } from '../data/kwangwoonFallback.js';
import { CAMPUS_OUTLINES, MAPPED_BARRIERS, WOODS } from '../data/campusBoundary.js';

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

  const removed = [];
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
        const { area, minWidth } = measureFootprint(pts);
        // OSM artifacts: unnamed slivers / sheds squeezed against real buildings are not on the real map
        if (!rawName && (area < 90 || minWidth < 5.5)) {
          removed.push({ id: f.id || props['@id'] || bIdx, area: Math.round(area), minWidth: +minWidth.toFixed(1) });
          bIdx++;
          continue;
        }
        let height = estimateHeight(props, profile);
        // Mis-mapped narrow footprints would otherwise render as needle towers
        if (minWidth < 12) height = Math.min(height, Math.max(7, minWidth * 1.6));
        buildings.push({
          id: `geo_${f.id || bIdx}_${bIdx}`,
          name,
          isCampus,
          facadeType,
          roofStyle: profile?.roofStyle || null,
          height,
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

  if (removed.length) console.info('[map] removed OSM sliver buildings:', removed);

  if (buildings.length < 5) return getKwangwoonFallbackMap();
  return {
    buildings,
    roads,
    pitches,
    grasses,
    trees,
    campusOutlines: CAMPUS_OUTLINES,
    barriers: buildFences(CAMPUS_OUTLINES, MAPPED_BARRIERS, roads),
    woods: WOODS,
  };
}

function measureFootprint(pts) {
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  }
  area = Math.abs(area / 2);
  let minWidth = Infinity;
  for (let deg = 0; deg < 180; deg += 3) {
    const th = (deg * Math.PI) / 180;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [x, z] of pts) {
      const v = x * cs + z * sn;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    minWidth = Math.min(minWidth, hi - lo);
  }
  return { area, minWidth };
}

function segIntersect(a, b, c, d) {
  const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/**
 * Campus perimeter fences (교내 담장/펜스) following the real OSM campus outline.
 * Gates are cut wherever a road or footpath crosses the outline, so every real entrance stays open.
 */
function buildFences(outlines, mapped, roads) {
  const fences = [];
  const GATE_HALF = 5.5;
  for (const ring of outlines) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      // collect gate cuts along this edge (as [t0, t1] in 0..1)
      const cuts = [];
      for (const r of roads) {
        for (let k = 0; k < r.points.length - 1; k++) {
          const t = segIntersect(a, b, r.points[k], r.points[k + 1]);
          if (t === null) continue;
          const halfT = (Math.max(GATE_HALF, (r.width || 6) * 0.5 + 2) / len);
          cuts.push([t - halfT, t + halfT]);
        }
      }
      cuts.sort((p, q) => p[0] - q[0]);
      let start = 0;
      for (const [t0, t1] of cuts) {
        if (t0 > start) pushPiece(start, Math.min(1, t0));
        start = Math.max(start, t1);
      }
      if (start < 1) pushPiece(start, 1);

      function pushPiece(t0, t1) {
        if ((t1 - t0) * len < 1.2) return;
        fences.push({
          type: 'campus',
          a: [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
          b: [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1],
        });
      }
    }
  }
  for (const m of mapped) {
    for (let i = 0; i < m.points.length - 1; i++) {
      fences.push({ type: m.type, a: m.points[i], b: m.points[i + 1] });
    }
  }
  return fences;
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
