import { getKwangwoonFallbackMap } from '../data/kwangwoonFallback.js';
import { placeGates } from './gates.js';
import { CAMPUS_OUTLINES, MAPPED_BARRIERS, WOODS } from '../data/campusBoundary.js';

const METERS_PER_LAT = 111320;

// Real-world architectural profiles for Kwangwoon University buildings (verified via Roadview / Street View)
const KWANGWOON_PROFILES = {
  화도관: { facadeType: 'hwado_granite', wallColor: '#dcd7cd', roofColor: '#723c31', plinthColor: '#84888e', height: 22, roofStyle: 'hwado_pediment' },
  비마관: { facadeType: 'bima_ribbon', wallColor: '#d9d6cf', roofColor: '#c4c9ce', plinthColor: '#73443c', height: 26 },
  새빛관: { facadeType: 'saebit_modern', wallColor: '#e7ebf0', roofColor: '#c9cfd6', plinthColor: '#8d9298', height: 33, roofStyle: 'solar_roof' },
  참빛관: { facadeType: 'chambit_stone', wallColor: '#d6c4b8', roofColor: '#bfc3c8', plinthColor: '#989088', height: 35, roofStyle: 'green_terrace' },
  연구관: { facadeType: 'yeongu_mixed', wallColor: '#d2c2b0', roofColor: '#adb5bc', plinthColor: '#7e3f35', height: 34 },
  '80주년 기념관': { facadeType: 'memorial_80', wallColor: '#d8dce2', roofColor: '#434a54', plinthColor: '#565e68', height: 15, roofStyle: 'memorial_80' },
  복지관: { facadeType: 'bokji_brick', wallColor: '#964438', roofColor: '#5c4b46', plinthColor: '#d0c6b5', height: 18 },
  옥의관: { facadeType: 'ogeui_concrete', wallColor: '#d9d8d3', roofColor: '#b8bdc2', plinthColor: '#7c7e80', height: 30 },
  한울관: { facadeType: 'stone_modern', wallColor: '#dcd6ca', roofColor: '#bfc4c9', plinthColor: '#8a8c90', height: 25 },
  다산재: { facadeType: 'brick_clean', wallColor: '#94483c', roofColor: '#9da3a8', plinthColor: '#82858a', height: 16 },
  한천재: { facadeType: 'brick_clean', wallColor: '#9e5144', roofColor: '#a8adb2', plinthColor: '#82858a', height: 19 },
  연촌재: { facadeType: 'brick_clean', wallColor: '#a35b4c', roofColor: '#b0b4b9', plinthColor: '#82858a', height: 12 },
  승리관: { facadeType: 'stone_modern', wallColor: '#d6d0c5', roofColor: '#5c859e', plinthColor: '#85898e', height: 15 },
  '광운대학교 동해문화예술관 대극장': { facadeType: 'donghae_brick', wallColor: '#a65040', roofColor: '#3d8b55', plinthColor: '#7f8388', height: 22, roofStyle: 'rooftop_turf' },
  '광운대학교 아이스링크장': { facadeType: 'arena', wallColor: '#cfd6de', roofColor: '#4a7aa8', plinthColor: '#7f858d', height: 16 },
  '빛솔재 A동': { facadeType: 'apartment', wallColor: '#e2dcd2', roofColor: '#b8bec4', plinthColor: '#8b8e93', height: 24 },
  '빛솔재 B동': { facadeType: 'apartment', wallColor: '#e2dcd2', roofColor: '#b8bec4', plinthColor: '#8b8e93', height: 24 },
  '인터내셔널 하우스': { facadeType: 'brick_clean', wallColor: '#a85a4a', roofColor: '#b5b9be', plinthColor: '#84888d', height: 14 },
};

function estimateHeight(tags = {}, profile = null, area = 200, idx = 0) {
  if (tags.height) {
    const parsed = parseFloat(tags.height);
    if (!Number.isNaN(parsed) && parsed > 2) return parsed;
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (!Number.isNaN(levels) && levels > 0) return levels * 3.4;
  }
  if (profile?.height) return profile.height;
  if (tags.building === 'university' || tags.amenity === 'university') return 20;
  if (tags.building === 'dormitory') return 16;
  if (tags.building === 'apartments') return 32 + (idx % 3) * 4;
  if (tags.building === 'commercial' || tags.building === 'retail') return 13 + (idx % 3) * 3.2;
  if (tags.building === 'train_station') return 11;
  if (tags.building === 'school') return 15;
  if (tags.building === 'house') return 7.5 + (idx % 3) * 1.8;
  // Korean multi-family villas (다세대/연립주택): 3~5 stories based on footprint area
  if (area < 140) return 9.5 + (idx % 3) * 1.8;
  if (area < 300) return 12.0 + (idx % 3) * 2.2;
  return 15.0 + (idx % 3) * 2.5;
}

// Authentic Korean residential roof & wall palettes (월계동 주택가: 녹색 우레탄 방수 옥상, 적벽돌/베이지 빌라, 아파트)
const ROOF_PALETTE = ['#4e8a64', '#528c68', '#c8cdd3', '#8c5347', '#6c757d', '#4c80a6'];
const WALL_PALETTE = ['#dfd5c6', '#a35142', '#d6cfc2', '#e4ddd2', '#944a3d', '#cfc9be', '#d8d2c8'];

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
        else if (props.building === 'commercial' || props.building === 'retail') facadeType = bIdx % 2 === 0 ? 'stone_modern' : 'curtainwall';
        else if (props.building === 'house' || props.building === 'residential') facadeType = bIdx % 3 === 0 ? 'brick' : 'villa';
        else facadeType = bIdx % 3 === 0 ? 'brick' : bIdx % 3 === 1 ? 'villa' : 'stone_modern';
      }

      const wallColor = profile?.wallColor || WALL_PALETTE[bIdx % WALL_PALETTE.length];
      const roofColor =
        profile?.roofColor ||
        (isCampus
          ? '#c8cdd2'
          : props.building === 'apartments'
          ? '#c6ccd2'
          : ROOF_PALETTE[bIdx % ROOF_PALETTE.length]);

      for (const ring of rings) {
        if (!ring || ring.length < 3) continue;
        const pts = ring.map(project);
        const { area, minWidth } = measureFootprint(pts);
        // Keep real small Wolgye-dong residential houses while still removing tiny OSM slivers
        const minArea = props.building === 'house' || props.building === 'residential' || props.building === 'yes' ? 42 : 75;
        const minW = props.building === 'house' || props.building === 'residential' || props.building === 'yes' ? 4.2 : 5.2;
        if (!rawName && (area < minArea || minWidth < minW)) {
          removed.push({ id: f.id || props['@id'] || bIdx, area: Math.round(area), minWidth: +minWidth.toFixed(1) });
          bIdx++;
          continue;
        }
        let height = estimateHeight(props, profile, area, bIdx);
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
          plinthColor: profile?.plinthColor || (isCampus ? '#84888e' : '#7b7f85'),
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
        polygon: pts,
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
    barriers: buildFences(CAMPUS_OUTLINES, MAPPED_BARRIERS, roads, buildings),
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

function pointInPoly2D(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

function pointNearAnyBuilding(x, z, buildingMeta, pad = 2.0) {
  for (let i = 0; i < buildingMeta.length; i++) {
    const b = buildingMeta[i];
    if (x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) continue;
    if (pointInPoly2D(x, z, b.polygon)) return true;
    const poly = b.polygon;
    for (let k = 0; k < poly.length; k++) {
      const p1 = poly[k];
      const p2 = poly[(k + 1) % poly.length];
      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const l2 = dx * dx + dz * dz;
      let t = l2 > 1e-9 ? ((x - p1[0]) * dx + (z - p1[1]) * dz) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      if (Math.hypot(x - (p1[0] + dx * t), z - (p1[1] + dz * t)) < pad) return true;
    }
  }
  return false;
}

/**
 * Campus perimeter fences (교내 담장/펜스) following the real OSM campus outline.
 * Gates are cut wherever a road or footpath crosses the outline, and segments overlapping
 * buildings are cleanly trimmed so fences never stab into building walls.
 */
function buildFences(outlines, mapped, roads, buildings = []) {
  const fences = [];
  const GATE_HALF = 5.5;
  const gates = placeGates(outlines);
  const buildingMeta = buildings
    .filter((b) => b.polygon && b.polygon.length >= 3)
    .map((b) => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of b.polygon) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
      return { polygon: b.polygon, minX, maxX, minZ, maxZ };
    });

  function emitClippedSegment(type, a, b) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1.0) return;
    // Sample every 1.5m along the segment and only emit sub-spans clear of buildings
    const samples = Math.max(2, Math.ceil(len / 1.5));
    let spanStart = null;
    for (let s = 0; s <= samples; s++) {
      const t = s / samples;
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      const blocked = pointNearAnyBuilding(px, pz, buildingMeta, 1.8);
      if (!blocked && spanStart === null) {
        spanStart = t;
      } else if ((blocked || s === samples) && spanStart !== null) {
        const spanEnd = blocked ? (s - 1) / samples : 1;
        if ((spanEnd - spanStart) * len >= 1.2) {
          fences.push({
            type,
            a: [a[0] + (b[0] - a[0]) * spanStart, a[1] + (b[1] - a[1]) * spanStart],
            b: [a[0] + (b[0] - a[0]) * spanEnd, a[1] + (b[1] - a[1]) * spanEnd],
          });
        }
        spanStart = null;
      }
    }
  }

  outlines.forEach((ring, ringIdx) => {
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
          const halfT = Math.max(GATE_HALF, (r.width || 6) * 0.5 + 2) / len;
          cuts.push([t - halfT, t + halfT]);
        }
      }
      // real gates (정문/후문) open the fence for their full width
      for (const g of gates) {
        if (g.ring !== ringIdx || g.edge !== i) continue;
        const halfT = (g.width / 2 + 2.2) / len;
        cuts.push([g.t - halfT, g.t + halfT]);
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
        emitClippedSegment(
          'campus',
          [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
          [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]
        );
      }
    }
  });
  for (const m of mapped) {
    for (let i = 0; i < m.points.length - 1; i++) {
      emitClippedSegment(m.type, m.points[i], m.points[i + 1]);
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
