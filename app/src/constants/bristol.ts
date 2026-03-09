/**
 * Bristol 便便類型對照表（1–7），供排泄紀錄顯示用。
 * 集中管理，避免 RecordLogItem / RecordDetailModal / HomeContent 重複定義。
 */
const BRISTOL_LABELS = ['', '硬塊狀', '香腸狀有裂縫', '香腸狀有裂縫', '香腸狀或蛇形', '軟塊有清晰邊緣', '糊狀', '水狀'] as const;

export function getBristolLabel(type: number): string {
  return BRISTOL_LABELS[type] ?? `Type ${type}`;
}

/** 1–7 對應中文，供需要 Record<number, string> 的元件使用 */
export const BRISTOL_DESC: Record<number, string> = {
  1: '硬塊狀',
  2: '香腸狀有裂縫',
  3: '香腸狀有裂縫',
  4: '香腸狀或蛇形',
  5: '軟塊有清晰邊緣',
  6: '糊狀',
  7: '水狀',
};
