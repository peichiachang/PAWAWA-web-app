import type { CapturedImage } from '../types/app';
import type { CanLabelScanResult } from '../types/app';

/**
 * 罐頭標籤掃描 API（後端串接後在此實作，目前回傳空結果）
 * @param image 拍攝的罐頭標籤照片
 * @returns 解析出的名稱、克數、kcal/100g（若有）
 */
export async function scanCanLabel(image: CapturedImage): Promise<CanLabelScanResult> {
  // TODO: 串接後端 OCR / 罐頭辨識 API，回傳 { name?, defaultGrams?, kcalPer100? }
  await Promise.resolve(image);
  return {};
}
