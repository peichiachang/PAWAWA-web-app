import { CatIdentity } from '../../types/domain';
import { calculateAdaptiveDailyWaterGoal, calculateDailyKcalGoal, calculateDailyWaterGoal, calculateDailyWaterGoalRange } from '../health';

describe('Health Calculations', () => {
    const baseCat: CatIdentity = {
        id: 'test-cat',
        name: 'Milo',
        birthDate: '2020-01-01',
        gender: 'male',
        spayedNeutered: true,
        baselineWeightKg: 4,
        currentWeightKg: 4,
        targetWeightKg: 4,
        bcsScore: 5,
        chronicConditions: [],
        allergyWhitelist: [],
        allergyBlacklist: [],
    };

    describe('calculateDailyWaterGoal', () => {
        it('should calculate 50ml/kg for a healthy cat', () => {
            const goal = calculateDailyWaterGoal(baseCat);
            expect(goal).toBe(200); // 4kg * 50
        });

        it('should calculate 50ml/kg as default target for a cat with CKD', () => {
            const ckdCat = { ...baseCat, chronicConditions: ['ckd' as any] };
            const goal = calculateDailyWaterGoal(ckdCat);
            expect(goal).toBe(200); // 4kg * 50
        });

        it('should provide 40-60ml/kg range guidance for a cat with CKD', () => {
            const ckdCat = { ...baseCat, chronicConditions: ['ckd' as any] };
            const range = calculateDailyWaterGoalRange(ckdCat);
            expect(range).toEqual({ min: 160, max: 240 }); // 4kg * (40-60)
        });

        it('should calculate 50ml/kg default target for a cat with diabetes', () => {
            const diabeticCat = { ...baseCat, chronicConditions: ['diabetes' as any] };
            const goal = calculateDailyWaterGoal(diabeticCat);
            expect(goal).toBe(200); // 4kg * 50
        });

        it('should calculate 50ml/kg default target for a cat with FLUTD', () => {
            const flutdCat = { ...baseCat, chronicConditions: ['flutd' as any] };
            const goal = calculateDailyWaterGoal(flutdCat);
            expect(goal).toBe(200); // 4kg * 50
        });

        it('should provide 50-70ml/kg range for diabetes', () => {
            const diabeticCat = { ...baseCat, chronicConditions: ['diabetes' as any] };
            const range = calculateDailyWaterGoalRange(diabeticCat);
            expect(range).toEqual({ min: 200, max: 280 }); // 4kg * (50-70)
        });

        it('should provide 50-65ml/kg range for FLUTD', () => {
            const flutdCat = { ...baseCat, chronicConditions: ['flutd' as any] };
            const range = calculateDailyWaterGoalRange(flutdCat);
            expect(range).toEqual({ min: 200, max: 260 }); // 4kg * (50-65)
        });

        it('should adapt diabetes goal by recent intake but keep within range', () => {
            const diabeticCat = { ...baseCat, chronicConditions: ['diabetes' as any] };
            const goal = calculateAdaptiveDailyWaterGoal(diabeticCat, [240, 250, 260, 255, 245]);
            expect(goal).toBeGreaterThanOrEqual(200);
            expect(goal).toBeLessThanOrEqual(280);
            expect(goal).toBeGreaterThan(200);
        });

        it('should fallback to baseline when trend samples are insufficient', () => {
            const diabeticCat = { ...baseCat, chronicConditions: ['diabetes' as any] };
            const goal = calculateAdaptiveDailyWaterGoal(diabeticCat, [260, 250]);
            expect(goal).toBe(200);
        });

        it('should apply higher water baseline for kittens', () => {
            const kitten = { ...baseCat, birthDate: '2025-10-01' };
            const goal = calculateDailyWaterGoal(kitten);
            expect(goal).toBe(220); // 4kg * 55
        });
    });

    describe('calculateDailyKcalGoal', () => {
        it('should calculate normal kcal for a neutered cat', () => {
            const goal = calculateDailyKcalGoal(baseCat);
            // RER = 70 * (4^0.75) ≈ 197.98
            // Goal = RER * 1.2 ≈ 237.58
            expect(goal).toBeCloseTo(237.58, 1);
        });

        it('should calculate higher kcal for hyperthyroidism', () => {
            const hyperCat = { ...baseCat, chronicConditions: ['hyperthyroidism' as any] };
            const goal = calculateDailyKcalGoal(hyperCat);
            // Goal = RER * 1.6 ≈ 316.78
            expect(goal).toBeCloseTo(316.78, 1);
        });

        it('should calculate lower kcal for obesity', () => {
            const obeseCat = { ...baseCat, chronicConditions: ['obesity' as any] };
            const goal = calculateDailyKcalGoal(obeseCat);
            // Goal = RER * 0.8 ≈ 158.39
            expect(goal).toBeCloseTo(158.39, 1);
        });

        it('should apply senior age factor for healthy cat', () => {
            const seniorCat = { ...baseCat, birthDate: '2010-01-01' };
            const goal = calculateDailyKcalGoal(seniorCat);
            // Base neutered goal ≈ 237.58, with senior factor 0.9 => ≈ 213.82
            expect(goal).toBeCloseTo(213.82, 1);
        });
    });
});
