/**
 * 食物記錄邊界與合理性檢查（純函數，不依賴 React 或 AsyncStorage）
 * 供 useFeeding / FeedingModal 呼叫，方便單元測試
 */

/** 依手動克數或碗容量估算「單次放飯可能的最大克數」 */
export function getMaxPossibleGrams(manualWeight?: number, volumeMl?: number): number {
  if (manualWeight != null && manualWeight > 0) return manualWeight;
  if (volumeMl != null && volumeMl > 0) return volumeMl * 0.8;
  return 1000;
}

/** 攝取量是否超過預估上限（防爆框：超過 toleranceRatio 倍視為異常） */
export function isIntakeOverLimit(
  totalGram: number,
  maxPossibleGrams: number,
  toleranceRatio: number = 1.1
): boolean {
  return maxPossibleGrams > 0 && totalGram > maxPossibleGrams * toleranceRatio;
}

/** 取得「進食量超過預估限制」的錯誤訊息 */
export function getIntakeOverLimitMessage(totalGram: number, maxPossibleGrams: number): string {
  return `進食量 (${totalGram}g) 不合理地大於預估限制 (${Math.round(maxPossibleGrams)}g)，請確認圖片是否正確。`;
}

/** 是否應顯示「克數可能偏差」警告（攝取接近上限時） */
export function shouldWarnHighIntake(
  totalGram: number,
  maxPossibleGrams: number,
  warnRatio: number = 0.9
): boolean {
  return maxPossibleGrams > 0 && totalGram > maxPossibleGrams * warnRatio;
}
