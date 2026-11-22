function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Realistic Kwangwoon University stepped campus terraces (자연스러운 캠퍼스 단차 언덕):
 * - Lower Plaza (비마관 · 복지관 · 옥의관 · 다산재 · 참빛관): ~0m flat plaza
 * - Mid Terrace (80주년 기념관 · 화도관): ~4.5m gentle rise
 * - Upper Hill (한천재 · 연구관 · 동해문화예술관 · 한울관 · 빛솔재): ~9.5m–13m
 */
export function getTerrainHeight(x, z) {
  // Distance uphill toward North-West (-x, -z)
  const nw = -x * 0.65 - z * 0.76;

  // Terrace 1: Central plaza -> 80주년 기념관 / 화도관 (smoothly rises 0 -> 4.5m)
  const midTerrace = smoothstep(22, 62, nw) * 4.5;

  // Terrace 2: 80주년 기념관 -> 한천재 / 연구관 / 한울관 (smoothly rises +5.0m)
  const upperTerrace = smoothstep(78, 135, nw) * 5.0;

  // Subtle hill crest toward 빛솔재 / 연촌재
  const crest = smoothstep(145, 220, nw) * 3.5;

  return midTerrace + upperTerrace + crest;
}
