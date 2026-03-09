import { HydrationOwnershipLog } from '../types/app';
import { matchesCatSeries } from './catScope';
import { toDateKey } from './date';

/**
 * 計算指定貓咪最近 7 天每日飲水量（ml），用於自適應飲水目標計算。
 * 日期以本地時間分組，結果按時間升冪排列。
 */
export function getRecentDailyWaterIntakesForCat(
  logs: HydrationOwnershipLog[],
  catId: string,
): number[] {
  const byDay = new Map<string, number>();
  logs
    .filter((log) => matchesCatSeries(log.selectedTagId, catId))
    .forEach((log) => {
      const key = toDateKey(log.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + (log.actualWaterMl ?? log.totalMl ?? 0));
    });
  return Array.from(byDay.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([, total]) => total)
    .slice(-7);
}
