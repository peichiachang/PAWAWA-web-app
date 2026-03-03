import { AlertSeverity, AlertType, CatIdentity, ClinicalSummary, MedicationLog, VitalsLog } from '../types/domain';
import { FeedingOwnershipLog, HydrationOwnershipLog } from '../types/app';
import { checkIntakeAlert, checkTemperatureAlert, checkWeeklyWeightAlert } from '../utils/alerts';
import {
  calculateAdaptiveDailyWaterGoal,
  calculateDailyKcalGoal,
  calculateWeeklyWeightChangeRatePct,
} from '../utils/health';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function buildClinicalSummary(
  cat: CatIdentity,
  vitals: VitalsLog[],
  feedingRecords: FeedingOwnershipLog[],
  hydrationRecords: HydrationOwnershipLog[],
  medicationLogs: MedicationLog[],
  householdCatCount: number = 1
): ClinicalSummary {
  const relevantVitals = vitals.filter((item) => item.catId === cat.id);
  const divisor = Math.max(1, householdCatCount);

  // 歸屬此貓 + household_only 平均分配
  const directFeedings = feedingRecords.filter((item) => item.selectedTagId === cat.id);
  const sharedFeedings = feedingRecords
    .filter((item) => item.ownershipType === 'household_only')
    .map((item) => ({
      ...item,
      totalGram: item.totalGram / divisor,
      kcal: item.kcal == null ? undefined : item.kcal / divisor,
      selectedTagId: cat.id,
      ownershipType: 'household_and_tag' as const,
    }));
  const catFeedings = [...directFeedings, ...sharedFeedings];

  const directHydrations = hydrationRecords.filter((item) => item.selectedTagId === cat.id);
  const sharedHydrations = hydrationRecords
    .filter((item) => item.ownershipType === 'household_only')
    .map((item) => ({
      ...item,
      totalMl: item.totalMl / divisor,
      actualWaterMl: item.actualWaterMl == null ? undefined : item.actualWaterMl / divisor,
      selectedTagId: cat.id,
      ownershipType: 'household_and_tag' as const,
    }));
  const catHydrations = [...directHydrations, ...sharedHydrations];

  const now = new Date();
  const isToday = (ts: number) => {
    const d = new Date(ts);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const avgTemperatureC = average(relevantVitals.map((item) => item.temperatureC));
  const totalKcalIntake = catFeedings.reduce((sum, item) => sum + (item.kcal || 0), 0);
  const totalActualWaterMl = catHydrations.reduce((sum, item) => sum + (item.actualWaterMl || item.totalMl || 0), 0);

  const todayKcalIntake = catFeedings.filter((item) => isToday(item.createdAt)).reduce((sum, item) => sum + (item.kcal || 0), 0);
  const todayWaterMl = catHydrations.filter((item) => isToday(item.createdAt)).reduce((sum, item) => sum + (item.actualWaterMl || item.totalMl || 0), 0);

  // Goal trend should come from direct tag records only; do not let household_only affect target.
  const waterByDay = new Map<string, number>();
  directHydrations.forEach((item) => {
    const d = new Date(item.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    waterByDay.set(key, (waterByDay.get(key) || 0) + (item.actualWaterMl || item.totalMl || 0));
  });
  const recentDailyWater = Array.from(waterByDay.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([, total]) => total)
    .slice(-7);

  const sortedByTime = [...relevantVitals].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const weekAgoWeight = sortedByTime.length >= 2 ? sortedByTime[0].weightKg : cat.baselineWeightKg;
  const latestWeight = sortedByTime.length > 0 ? sortedByTime[sortedByTime.length - 1].weightKg : cat.currentWeightKg;

  const weeklyWeightChangeRatePct = calculateWeeklyWeightChangeRatePct(latestWeight, weekAgoWeight);
  const bmrKcal = calculateDailyKcalGoal(cat);

  const alerts = [];
  for (const vitals of relevantVitals) {
    const temperatureAlert = checkTemperatureAlert(cat.id, vitals.temperatureC, vitals.timestamp);
    if (temperatureAlert) {
      alerts.push(temperatureAlert);
    }
  }

  const intakeAlert = checkIntakeAlert(cat.id, todayKcalIntake, bmrKcal, new Date().toISOString());
  if (intakeAlert) {
    alerts.push(intakeAlert);
  }

  const weightAlert = checkWeeklyWeightAlert(cat.id, weeklyWeightChangeRatePct, new Date().toISOString());
  if (weightAlert) {
    alerts.push(weightAlert);
  }

  // Hydration Alert
  const waterGoal = calculateAdaptiveDailyWaterGoal(cat, recentDailyWater);
  if (todayWaterMl < waterGoal * 0.7) {
    alerts.push({
      alertId: `water_${Date.now()}`,
      catId: cat.id,
      type: 'hydration' as AlertType,
      severity: (cat.chronicConditions.includes('ckd') ? 'high' : 'medium') as AlertSeverity,
      message: `${cat.name} 的攝水量 (${Math.round(todayWaterMl)}ml) 低於建議目標 (${Math.round(waterGoal)}ml)。${cat.chronicConditions.includes('ckd') ? '對腎病貓來說充足水分極其重要！' : ''}`,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    catId: cat.id,
    periodDays: 0,
    avgTemperatureC: relevantVitals.length > 0
      ? relevantVitals.reduce((sum, v) => sum + v.temperatureC, 0) / relevantVitals.length
      : 38.5,
    totalKcalIntake,
    totalActualWaterMl,
    todayKcalIntake,
    todayWaterMl,
    weeklyWeightChangeRatePct: 0,
    medicationLogs: medicationLogs.filter(m => m.catId === cat.id),
    alerts,
  } as ClinicalSummary;
}
