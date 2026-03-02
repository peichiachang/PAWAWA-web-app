import { CatIdentity } from '../../types/domain';
import { calculateDailyKcalGoal, calculateDailyWaterGoal, calculateDailyWaterGoalRange } from '../health';

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

        it('should calculate 70ml/kg for a cat with diabetes', () => {
            const diabeticCat = { ...baseCat, chronicConditions: ['diabetes' as any] };
            const goal = calculateDailyWaterGoal(diabeticCat);
            expect(goal).toBe(280); // 4kg * 70
        });

        it('should calculate 65ml/kg for a cat with FLUTD', () => {
            const flutdCat = { ...baseCat, chronicConditions: ['flutd' as any] };
            const goal = calculateDailyWaterGoal(flutdCat);
            expect(goal).toBe(260); // 4kg * 65
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
    });
});
