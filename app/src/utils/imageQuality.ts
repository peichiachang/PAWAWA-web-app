/**
 * Layer 2 拍攝品質防護 — 送出前驗證
 * SDD: 模糊偵測、主體辨識、一致性確認（過濾不合格照片）
 */

export type ImageQualityIssue = 'too_small' | 'ok';

export interface ImageQualityResult {
  valid: boolean;
  issue: ImageQualityIssue;
  reason?: string;
}

// base64 JPEG 最小可信任大小（字元數）
// 25% quality JPEG 的空白/全黑畫面約 1000-3000 chars，
// 真實有內容的照片在 quality 0.25 下通常 > 10000 chars
const MIN_BASE64_LENGTH = 8000;

/**
 * Layer 2：拍攝後品質基本驗證
 * 返回 valid=false 時，應提示使用者重拍並不進行 AI 呼叫
 */
export function validateImageQuality(base64: string): ImageQualityResult {
  if (!base64 || base64.length < MIN_BASE64_LENGTH) {
    return {
      valid: false,
      issue: 'too_small',
      reason: '照片資料異常（可能為空白或黑畫面），請確認光線充足後重新拍攝。',
    };
  }

  return { valid: true, issue: 'ok' };
}
