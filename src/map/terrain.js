/**
 * Kwangwoon University hill topography (월계동 언덕 지형).
 * South-East (정문 / 승리관 / 옥의관 / 참빛관) is low flatland (~0m),
 * rising smoothly toward North-West (화도관 / 80주년 기념관 / 연구관 / 한울관 / 빛솔재, up to ~22m).
 */
export function getTerrainHeight(x, z) {
  // Normalized uphill direction toward North-West (-x, -z)
  const uphill = (-x * 0.62 - z * 0.78) / 220;
  // Smooth ramp starting near central plaza (uphill > -0.25)
  const t = Math.max(0, uphill + 0.35);
  const baseSlope = Math.min(24, Math.pow(t, 1.35) * 11.5);

  // Gentle natural ridge around 한천재 / 연구관 / 한울관
  const westRidge = Math.max(0, (-x - 70) / 140) * 3.5;

  // Subtle organic undulation
  const ripple = Math.sin(x * 0.018) * Math.cos(z * 0.018) * 0.6;

  return Math.max(0, baseSlope + westRidge + ripple);
}
