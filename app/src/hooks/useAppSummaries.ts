import { useMemo } from 'react';
import { buildClinicalSummary } from '../services/clinicalSummary';
import { calculateAdaptiveDailyWaterGoal, calculateDailyKcalIntake, calculateDailyKcalGoal } from '../utils/health';
import { getScopedCats, matchesCatSeries } from '../utils/catScope';
import { isToday } from '../utils/date';
import { getRecentDailyWaterIntakesForCat } from '../utils/hydrationUtils';
import type { CatIdentity, ClinicalSummary, MedicationLog, VitalsLog } from '../types/domain';
import type { FeedingOwnershipLog, HydrationOwnershipLog, Level } from '../types/app';

interface UseAppSummariesArgs {
  cats: CatIdentity[];
  vitalsLogs: VitalsLog[];
  level: Level;
  feedingOwnershipLogs: FeedingOwnershipLog[];
  hydrationOwnershipLogs: HydrationOwnershipLog[];
  medicationLogs: MedicationLog[];
}

export function useAppSummaries({
  cats,
  vitalsLogs,
  level,
  feedingOwnershipLogs,
  hydrationOwnershipLogs,
  medicationLogs,
}: UseAppSummariesArgs) {
  const indexedCats = useMemo(() => {
    const scoped = getScopedCats(cats);
    const matched = scoped.filter((cat) => /^cat_\d+_/.test(cat.id));
    return matched.length > 0 ? matched : scoped;
  }, [cats]);

  const summaries = useMemo(
    () =>
      indexedCats.map((cat) =>
        buildClinicalSummary(
          cat,
          vitalsLogs,
          feedingOwnershipLogs,
          hydrationOwnershipLogs,
          medicationLogs,
          indexedCats.length
        )
      ),
    [indexedCats, vitalsLogs, feedingOwnershipLogs, hydrationOwnershipLogs, medicationLogs]
  );

  const summaryByCatId = useMemo(
    () => Object.fromEntries(summaries.map((item) => [item.catId, item])),
    [summaries]
  );

  const todayHouseholdKcal = useMemo(() => {
    return feedingOwnershipLogs
      .filter((item) => isToday(item.createdAt))
      .reduce((sum, item) => sum + (item.kcal ?? calculateDailyKcalIntake(item.totalGram, 3.5)), 0);
  }, [feedingOwnershipLogs]);

  const todayHouseholdWater = useMemo(() => {
    return hydrationOwnershipLogs
      .filter((item) => isToday(item.createdAt))
      .reduce((sum, item) => sum + (item.actualWaterMl || item.totalMl || 0), 0);
  }, [hydrationOwnershipLogs]);

  const currentCat = useMemo(() => {
    if (level === 'household') return null;
    const scopedCats = getScopedCats(cats);
    const selected = scopedCats.find((cat) => matchesCatSeries(cat.id, level));
    return selected || null;
  }, [cats, level]);

  const currentSummary: ClinicalSummary | null = currentCat ? summaryByCatId[currentCat.id] ?? null : null;

  return {
    indexedCats,
    summaries,
    summaryByCatId,
    todayHouseholdKcal,
    todayHouseholdWater,
    currentCat,
    currentSummary,
  };
}
