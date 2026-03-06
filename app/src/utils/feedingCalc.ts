/**
 * Pure algorithm functions for feeding intake calculation.
 * Extracted for testability and reuse across geminiService and HTTP service.
 */

/** Density (g/ml) by food type */
export const FOOD_DENSITY: Record<'dry' | 'wet', number> = {
  dry: 0.45,
  wet: 0.95,
};

/**
 * Compute the T0 reference weight (grams of food placed in the bowl before eating).
 * Priority: manualWeight → vesselVolumeMl × 0.8 × density → 0 (unknown)
 */
export function computeT0RefGrams(
  manualWeight: number | undefined,
  vesselVolumeMl: number | undefined,
  density: number
): number {
  if (manualWeight !== undefined && manualWeight > 0) return manualWeight;
  if (vesselVolumeMl !== undefined && vesselVolumeMl > 0) {
    return Math.round(vesselVolumeMl * 0.8 * density);
  }
  return 0;
}

/**
 * Compute consumed grams from a consumedRatio and calibration data.
 *
 * Version A (hasEmptyBowl = true):
 *   consumedRatio = t0FillRatio − t1FillRatio (absolute fraction of bowl capacity)
 *   → consumed = consumedRatio × vesselVolumeMl × density
 *   → if no volumeMl: consumed = (consumedRatio / t0FillRatio) × manualWeight
 *
 * Version B (hasEmptyBowl = false):
 *   consumedRatio = fraction of T0 eaten
 *   → consumed = consumedRatio × t0RefGrams
 */
export function computeConsumedGrams(params: {
  consumedRatio: number;
  vesselVolumeMl?: number;
  density: number;
  /** Only provided for Version A */
  t0FillRatio?: number;
  manualWeight?: number;
  hasEmptyBowl: boolean;
}): number {
  const { consumedRatio, vesselVolumeMl, density, t0FillRatio, manualWeight, hasEmptyBowl } = params;

  if (hasEmptyBowl) {
    if (vesselVolumeMl && vesselVolumeMl > 0) {
      return Math.max(0, Math.round(consumedRatio * vesselVolumeMl * density));
    }
    if (manualWeight && manualWeight > 0 && t0FillRatio && t0FillRatio > 0) {
      const fractionOfT0 = Math.max(0, Math.min(1, consumedRatio / t0FillRatio));
      return Math.round(fractionOfT0 * manualWeight);
    }
    // Fallback when no volume or manual weight
    return Math.max(0, Math.round(consumedRatio * 500));
  }

  // Version B: consumedRatio is relative to T0
  const t0Ref = computeT0RefGrams(manualWeight, vesselVolumeMl, density);
  if (t0Ref > 0) return Math.max(0, Math.round(consumedRatio * t0Ref));
  return Math.max(0, Math.round(consumedRatio * 500));
}
