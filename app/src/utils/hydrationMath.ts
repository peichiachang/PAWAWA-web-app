import { ProfileContour, VesselCalibration } from '../types/app';
import { calculateVolumeToWaterLevel } from './profileVolume';

export interface HydrationMathParams {
    waterLevelPct: number;
    vesselVolumeMl: number;
    vessel?: VesselCalibration;
}

/**
 * 計算環境自然蒸發量
 * 基於時間差，預設蒸發率為 0.5ml / 小時。
 * @param w0Timestamp 初始拍攝時間(ms)
 * @param w1Timestamp 結束拍攝時間(ms)
 * @param rateMlPerHour 每小時蒸發率 (預設 0.5)
 * @returns 蒸發量 (ml)
 */
export function calculateEvaporationMl(
    w0Timestamp: number,
    w1Timestamp: number,
    rateMlPerHour: number = 0.5
): number {
    if (w1Timestamp <= w0Timestamp) return 0;
    const hoursElapsed = (w1Timestamp - w0Timestamp) / (1000 * 60 * 60);
    return hoursElapsed * rateMlPerHour;
}

/**
 * 將給定特徵點轉換成該容器目前的水量 (ml)
 */
export function calculateHydrationVolume({
    waterLevelPct,
    vesselVolumeMl,
    vessel
}: HydrationMathParams): number {
    let volumeMl = 0;

    // 確保 waterLevelPct 在 0~1 之間
    const clampedWLevelPct = Math.max(0, Math.min(1, waterLevelPct));

    // 模式 A：若有滿水校準，使用歸一化比例運算
    if (vessel?.calibrationMethod === 'known_volume' && vessel.fullWaterCalibration) {
        const cal = vessel.fullWaterCalibration;
        let normalizedPct = 0;

        // 若有 topY 且 bottomY > topY，進行比例縮放 (消除距離與角度影響)
        if (cal.topY !== undefined && cal.bottomY > cal.topY) {
            const calFullFrac = (cal.fullY - cal.topY) / (cal.bottomY - cal.topY);
            const calSpan = 1 - calFullFrac;
            normalizedPct = calSpan > 0 ? Math.max(0, Math.min(1, (clampedWLevelPct - calFullFrac) / calSpan)) : 0;
        } else {
            // 舊版兼容退回：絕對像素 (不推薦，會有誤差)
            console.warn('[hydrationMath] Legacy fullWaterCalibration detected without topY. Precision may drop.');
            // 若沒有 raw_y 的概念就無法直接算，這裡只能將原 Level 作為 Normalized
            // 由於提取為純函數不吃 Y，若是 AI Mode 其實也沒有 Y，所以如果是舊版我們直接用 clampedWLevelPct
            normalizedPct = clampedWLevelPct;
        }

        volumeMl = (1 - normalizedPct) * vesselVolumeMl;
    }
    // 模式 B：若有側面輪廓，使用微積分
    else if (vessel?.calibrationMethod === 'side_profile' && vessel.profileContour) {
        volumeMl = calculateVolumeToWaterLevel(vessel.profileContour, clampedWLevelPct);
    }
    // 模式 C：直筒預設線性
    else {
        volumeMl = (1 - clampedWLevelPct) * vesselVolumeMl;
    }

    // 強制上界保護
    return Math.min(volumeMl, vesselVolumeMl);
}
