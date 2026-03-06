/** 將 timestamp 轉為 "YYYY-M-D" 字串，用於日期分組比較（不受 locale / timezone 影響）。 */
export function toDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 判斷 timestamp 是否為今天（依本地時間）。 */
export function isToday(ts: number): boolean {
  return toDateKey(ts) === toDateKey(Date.now());
}
