/**
 * 側面輪廓體積計算工具
 * 
 * 使用輪廓數據計算水位之間的體積
 */

import { ProfileContour, ProfileContourPoint } from '../types/app';

/**
 * 從輪廓點陣列插值得到指定高度處的半徑
 * @param contour 輪廓數據
 * @param y 從碗口往下的高度（cm）
 * @returns 該高度處的半徑（cm）
 */
function interpolateRadius(contour: ProfileContour, y: number): number {
  const { points } = contour;
  
  if (points.length === 0) {
    return 0;
  }
  
  // 如果 y 超出範圍，使用邊界值
  if (y <= points[0].y) {
    return points[0].radius;
  }
  if (y >= points[points.length - 1].y) {
    return points[points.length - 1].radius;
  }
  
  // 線性插值
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    if (y >= p1.y && y <= p2.y) {
      const t = (y - p1.y) / (p2.y - p1.y);
      return p1.radius + (p2.radius - p1.radius) * t;
    }
  }
  
  return points[points.length - 1].radius;
}

/**
 * 使用輪廓數據計算兩條水位線之間的體積
 * @param contour 輪廓數據
 * @param waterLevelTopCm T0 水位（從碗口往下，cm）
 * @param waterLevelBottomCm T1 水位（從碗口往下，cm）
 * @returns 體積（毫升）
 */
export function calculateVolumeFromContour(
  contour: ProfileContour,
  waterLevelTopCm: number,
  waterLevelBottomCm: number
): number {
  if (!contour.points || contour.points.length === 0) {
    return 0;
  }
  
  // 確保 top > bottom（從上往下）
  const top = Math.max(waterLevelTopCm, waterLevelBottomCm);
  const bottom = Math.min(waterLevelTopCm, waterLevelBottomCm);
  
  // 使用數值積分：V = ∫[bottom to top] π × r(y)² dy
  const step = 0.1; // 0.1cm 精度
  let volume = 0;
  
  for (let y = bottom; y < top; y += step) {
    const radius = interpolateRadius(contour, y);
    volume += Math.PI * Math.pow(radius, 2) * step;
  }
  
  return volume;
}

/**
 * 計算輪廓的總容量（從碗口到底部）
 * @param contour 輪廓數據
 * @returns 總容量（毫升）
 */
export function calculateTotalVolumeFromContour(contour: ProfileContour): number {
  if (!contour.points || contour.points.length === 0) {
    return 0;
  }
  
  const bottomY = contour.points[contour.points.length - 1].y;
  return calculateVolumeFromContour(contour, 0, bottomY);
}

/**
 * 將水位百分比轉換為從碗口往下的高度（cm）
 * @param contour 輪廓數據
 * @param waterLevelPct 水位百分比（0.0-1.0，0 表示碗口，1 表示底部）
 * @returns 從碗口往下的高度（cm）
 */
export function waterLevelPctToCm(contour: ProfileContour, waterLevelPct: number): number {
  if (!contour.points || contour.points.length === 0) {
    return 0;
  }
  
  const bottomY = contour.points[contour.points.length - 1].y;
  // waterLevelPct: 0 = 碗口 (y=0), 1 = 底部 (y=bottomY)
  return bottomY * waterLevelPct;
}

/**
 * 使用側面輪廓數據計算水位體積
 * @param contour 輪廓數據
 * @param waterLevelPct 水位百分比（0.0-1.0，0 表示碗口，1 表示底部）
 * @returns 從碗口到該水位線的體積（毫升）
 */
export function calculateVolumeToWaterLevel(contour: ProfileContour, waterLevelPct: number): number {
  const waterLevelCm = waterLevelPctToCm(contour, waterLevelPct);
  return calculateVolumeFromContour(contour, 0, waterLevelCm);
}
