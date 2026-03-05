import { CatIdentity } from '../types/domain';

export const NORMAL_TEMP_MIN_C = 37.5;
export const NORMAL_TEMP_MAX_C = 39.5;

export function calculateRER(weightKg: number): number {
  return 70 * Math.pow(weightKg, 0.75);
}

function getCatAgeYears(cat: CatIdentity): number {
  const d = new Date(cat.birthDate);
  if (Number.isNaN(d.getTime())) return 3;
  const now = new Date();
  const years = (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, years);
}

function getAgeKcalFactor(cat: CatIdentity): number {
  const age = getCatAgeYears(cat);
  if (age < 1) return 1.8; // kitten growth period
  if (age >= 11) return 0.9; // senior cats usually need slightly less kcal
  return 1.0;
}

function getAgeWaterMultiplier(cat: CatIdentity): number {
  const age = getCatAgeYears(cat);
  if (age < 1) return 55;
  if (age >= 11) return 45;
  return 50;
}

export function calculateDailyKcalGoal(cat: CatIdentity): number {
  const rer = calculateRER(cat.currentWeightKg);
  const ageKcalFactor = getAgeKcalFactor(cat);

  // Disease multipliers
  if (cat.chronicConditions.includes('hyperthyroidism')) return rer * 1.6 * ageKcalFactor;
  if (cat.chronicConditions.includes('obesity')) return rer * 0.8;

  const neuteredFactor = cat.spayedNeutered ? 1.2 : 1.4;
  return rer * neuteredFactor * ageKcalFactor;
}

export function calculateDailyWaterGoal(cat: CatIdentity): number {
  let multiplier = getAgeWaterMultiplier(cat); // Age-adjusted baseline

  if (cat.chronicConditions.includes('ckd')) {
    // CKD cats: use a conservative default target and show range guidance in UI.
    multiplier = 50;
  }

  return cat.currentWeightKg * multiplier;
}

export function calculateDailyWaterGoalRange(cat: CatIdentity): { min: number; max: number } {
  if (cat.chronicConditions.includes('ckd')) {
    return {
      min: cat.currentWeightKg * 40,
      max: cat.currentWeightKg * 60,
    };
  }

  if (cat.chronicConditions.includes('diabetes')) {
    return {
      min: cat.currentWeightKg * 50,
      max: cat.currentWeightKg * 70,
    };
  }

  if (cat.chronicConditions.includes('flutd')) {
    return {
      min: cat.currentWeightKg * 50,
      max: cat.currentWeightKg * 65,
    };
  }

  const goal = calculateDailyWaterGoal(cat);
  return { min: goal, max: goal };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateAdaptiveDailyWaterGoal(cat: CatIdentity, recentDailyIntakesMl: number[]): number {
  const range = calculateDailyWaterGoalRange(cat);
  const baseline = calculateDailyWaterGoal(cat);

  const cleaned = recentDailyIntakesMl
    .filter((v) => Number.isFinite(v) && v > 0)
    .slice(-7);

  // No enough trend data -> use baseline.
  if (cleaned.length < 3) return baseline;

  // Blend baseline with observed central tendency.
  const observed = median(cleaned);
  const blended = baseline * 0.6 + observed * 0.4;
  return Math.round(clamp(blended, range.min, range.max));
}

export function calculateDailyKcalIntake(intakeGram: number, kcalPerGram: number): number {
  return intakeGram * kcalPerGram;
}

export function calculateWeeklyWeightChangeRatePct(currentWeightKg: number, weekAgoWeightKg: number): number {
  if (weekAgoWeightKg <= 0) {
    return 0;
  }
  return ((currentWeightKg - weekAgoWeightKg) / weekAgoWeightKg) * 100;
}

export function calculateActualWaterIntakeMl(waterT0Ml: number, waterT1Ml: number, envFactorMl: number): number {
  const value = waterT0Ml - waterT1Ml - envFactorMl;
  return Math.max(0, value);
}

export function calculateTotalWaterIntakeMl(
  pureWaterMl: number,
  wetFoodAddedWaterMl: number,
  bowlFoodRatio: number
): number {
  return pureWaterMl + wetFoodAddedWaterMl * bowlFoodRatio;
}

/** 低胃口提醒：連續 2 天都有「幾乎沒吃」或「吃了一些」的記錄時回傳 true */
export function checkLowAppetiteAlert(logs: Array<{ createdAt: number; intakeLevel?: string | null }>): boolean {
  const lowLevels = ['almost_none', 'some'];
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const yesterday = new Date(now.getTime() - dayMs);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
  const daysWithLow = new Set<string>();
  logs.forEach(log => {
    if (!log.intakeLevel || !lowLevels.includes(log.intakeLevel)) return;
    const d = new Date(log.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key === todayKey || key === yesterdayKey) daysWithLow.add(key);
  });
  return daysWithLow.has(todayKey) && daysWithLow.has(yesterdayKey);
}
