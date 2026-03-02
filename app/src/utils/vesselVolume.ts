/**
 * 食碗體積計算工具函數
 * 
 * 所有輸入尺寸單位為公分 (cm)
 * 輸出體積單位為毫升 (ml)，因為 1 cm³ = 1 ml
 */

import { VesselShape, VesselCalibration } from '../types/app';
import { calculateTotalVolumeFromContour } from './profileVolume';

/**
 * 計算圓柱體體積
 * @param diameterCm 直徑（公分）
 * @param heightCm 高度（公分）
 * @returns 體積（毫升）
 */
export function calculateCylinderVolume(diameterCm: number, heightCm: number): number {
  const radiusCm = diameterCm / 2;
  return Math.PI * Math.pow(radiusCm, 2) * heightCm;
}

/**
 * 計算長方體/梯形體積
 * @param lengthCm 長度（公分）
 * @param widthCm 寬度（公分）
 * @param heightCm 高度（公分）
 * @returns 體積（毫升）
 */
export function calculateTrapezoidVolume(lengthCm: number, widthCm: number, heightCm: number): number {
  return lengthCm * widthCm * heightCm;
}

/**
 * 計算圓台（截頭圓錐）體積
 * 適用於上寬下窄或上窄下寬的碗形
 * @param topDiameterCm 頂部直徑（公分）
 * @param bottomDiameterCm 底部直徑（公分）
 * @param heightCm 高度（公分）
 * @returns 體積（毫升）
 */
export function calculateFrustumVolume(topDiameterCm: number, bottomDiameterCm: number, heightCm: number): number {
  const topRadiusCm = topDiameterCm / 2;
  const bottomRadiusCm = bottomDiameterCm / 2;
  
  // 圓台體積公式：V = (π × h / 3) × (R² + R×r + r²)
  // 其中 R 是頂半徑，r 是底半徑，h 是高度
  return (Math.PI * heightCm / 3) * (
    Math.pow(topRadiusCm, 2) + 
    topRadiusCm * bottomRadiusCm + 
    Math.pow(bottomRadiusCm, 2)
  );
}

/**
 * 根據容器校準資料計算體積
 * @param vessel 容器校準資料
 * @returns 體積（毫升），如果無法計算則返回 undefined
 */
export function calculateVesselVolume(vessel: VesselCalibration): number | undefined {
  const { shape, dimensions, calibrationFactor, measuredVolumeMl, calibrationMethod, profileContour } = vessel;
  const { height, radius, length, width, topRadius, bottomRadius } = dimensions;

  // 如果是「已知容量」模式，永遠以已儲存的 volumeMl 為準，覆蓋其他幾何/AI 計算
  if (calibrationMethod === 'known_volume' && vessel.volumeMl && vessel.volumeMl > 0) {
    return vessel.volumeMl;
  }

  // 優先使用側面輪廓方式（如果有的話）
  if (calibrationMethod === 'side_profile' && profileContour) {
    // 對於側面輪廓模式，優先信任已儲存的 volumeMl（可以在建立/編輯時套用高度校正與實測校正）
    if (vessel.volumeMl && vessel.volumeMl > 0) {
      return vessel.volumeMl;
    }

    const contourVolume = calculateTotalVolumeFromContour(profileContour);
    if (contourVolume > 0) {
      // 如果有實際測量值與校準係數，則在原始等比例體積上再套用一次校準
      if (measuredVolumeMl && measuredVolumeMl > 0 && calibrationFactor) {
        return contourVolume * calibrationFactor;
      }
      return contourVolume;
    }
  }

  // 傳統尺寸計算方式
  if (!height || height <= 0) {
    return undefined;
  }

  let geometricVolume: number | undefined;

  switch (shape) {
    case 'cylinder':
      // radius 欄位實際存儲的是使用者輸入的「直徑」
      if (!radius || radius <= 0) {
        return undefined;
      }
      geometricVolume = calculateCylinderVolume(radius, height);
      break;

    case 'trapezoid':
      if (!length || !width || length <= 0 || width <= 0) {
        return undefined;
      }
      geometricVolume = calculateTrapezoidVolume(length, width, height);
      break;

    case 'sphere':
      // sphere 實際上是圓台（frustum）
      // topRadius 和 bottomRadius 欄位實際存儲的是「直徑」
      const topD = topRadius || 0;
      const bottomD = bottomRadius || 0;
      
      if (topD <= 0 && bottomD <= 0) {
        return undefined;
      }
      
      // 如果只有一個直徑，假設為圓柱體
      if (topD <= 0) {
        geometricVolume = calculateCylinderVolume(bottomD, height);
      } else if (bottomD <= 0) {
        geometricVolume = calculateCylinderVolume(topD, height);
      } else {
        geometricVolume = calculateFrustumVolume(topD, bottomD, height);
      }
      break;

    default:
      return undefined;
  }

  if (geometricVolume === undefined) {
    return undefined;
  }

  // 如果有校準係數，應用修正（以 AI 辨識為主，實際測量為輔）
  if (calibrationFactor && calibrationFactor > 0 && calibrationFactor <= 1.5) {
    return geometricVolume * calibrationFactor;
  }

  // 如果有實際測量容量但沒有校準係數，計算並應用（向後相容）
  if (measuredVolumeMl && measuredVolumeMl > 0) {
    const factor = calculateCalibrationFactor(geometricVolume, measuredVolumeMl);
    return geometricVolume * factor;
  }

  // 否則返回幾何計算結果（AI 辨識的主要輸出）
  return geometricVolume;
}

/**
 * 驗證輸入尺寸的合理性
 * @param shape 容器形狀
 * @param dimensions 尺寸資料
 * @returns 驗證結果和錯誤訊息
 */
export function validateVesselDimensions(
  shape: VesselShape,
  dimensions: VesselCalibration['dimensions']
): { isValid: boolean; errorMessage?: string } {
  const { height, radius, length, width, topRadius, bottomRadius } = dimensions;

  // 基本高度檢查
  if (!height || height <= 0) {
    return { isValid: false, errorMessage: '高度必須大於 0' };
  }
  if (height > 15) {
    return { isValid: false, errorMessage: `高度 ${height}cm 過大，一般食碗高度約 3-8cm` };
  }

  switch (shape) {
    case 'cylinder':
      if (!radius || radius <= 0) {
        return { isValid: false, errorMessage: '直徑必須大於 0' };
      }
      if (radius > 50) {
        return { isValid: false, errorMessage: `直徑 ${radius}cm 過大，一般食碗直徑約 10-24cm` };
      }
      break;

    case 'trapezoid':
      if (!length || !width || length <= 0 || width <= 0) {
        return { isValid: false, errorMessage: '長度和寬度必須大於 0' };
      }
      if (length > 50 || width > 50) {
        return { isValid: false, errorMessage: `長度或寬度過大，一般食碗長寬約 10-30cm` };
      }
      break;

    case 'sphere':
      const topD = topRadius || 0;
      const bottomD = bottomRadius || 0;
      if (topD <= 0 && bottomD <= 0) {
        return { isValid: false, errorMessage: '至少需要輸入頂部或底部直徑' };
      }
      if (topD > 50 || bottomD > 50) {
        return { isValid: false, errorMessage: `直徑過大，一般食碗直徑約 10-24cm` };
      }
      break;
  }

  return { isValid: true };
}

/**
 * 檢查計算出的體積是否合理
 * @param volumeMl 體積（毫升）
 * @returns 是否合理
 */
export function isVolumeReasonable(volumeMl: number): boolean {
  // 一般食碗體積範圍：200ml - 5000ml
  return volumeMl >= 200 && volumeMl <= 5000;
}

/**
 * 修正並重新計算容器的體積
 * 用於修正舊資料中可能存在的錯誤計算
 * @param vessel 容器校準資料
 * @returns 修正後的容器資料（volumeMl 已重新計算）
 */
export function recalculateVesselVolume(vessel: VesselCalibration): VesselCalibration {
  const recalculatedVolume = calculateVesselVolume(vessel);
  return {
    ...vessel,
    volumeMl: recalculatedVolume,
  };
}

/**
 * 計算校準係數
 * 基於實際測量容量和幾何計算容量的比值
 * @param geometricVolume 幾何計算的體積
 * @param measuredVolume 實際測量的體積
 * @returns 校準係數（0.7-1.0 為合理範圍）
 */
export function calculateCalibrationFactor(geometricVolume: number, measuredVolume: number): number {
  if (geometricVolume <= 0 || measuredVolume <= 0) {
    return 1.0;
  }
  const factor = measuredVolume / geometricVolume;
  // 限制在合理範圍內（0.7-1.0）
  return Math.max(0.7, Math.min(1.0, factor));
}
