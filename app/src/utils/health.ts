import { CatIdentity } from '../types/domain';

export const NORMAL_TEMP_MIN_C = 37.5;
export const NORMAL_TEMP_MAX_C = 39.5;

export function calculateRER(weightKg: number): number {
  return 70 * Math.pow(weightKg, 0.75);
}

export function calculateDailyKcalGoal(cat: CatIdentity): number {
  const rer = calculateRER(cat.currentWeightKg);

  // Disease multipliers
  if (cat.chronicConditions.includes('hyperthyroidism')) return rer * 1.6;
  if (cat.chronicConditions.includes('obesity')) return rer * 0.8;

  const neuteredFactor = cat.spayedNeutered ? 1.2 : 1.4;
  return rer * neuteredFactor;
}

export function calculateDailyWaterGoal(cat: CatIdentity): number {
  let multiplier = 50; // Standard 50ml/kg

  if (cat.chronicConditions.includes('ckd')) {
    // CKD cats: use a conservative default target and show range guidance in UI.
    multiplier = 50;
  } else if (cat.chronicConditions.includes('diabetes')) {
    multiplier = 70;
  } else if (cat.chronicConditions.includes('flutd')) {
    multiplier = 65;
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

  const goal = calculateDailyWaterGoal(cat);
  return { min: goal, max: goal };
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
