import {
  getMaxPossibleGrams,
  isIntakeOverLimit,
  getIntakeOverLimitMessage,
  shouldWarnHighIntake,
} from '../feedingBounds';

describe('feedingBounds', () => {
  describe('getMaxPossibleGrams', () => {
    it('returns manualWeight when provided and positive', () => {
      expect(getMaxPossibleGrams(220, 500)).toBe(220);
      expect(getMaxPossibleGrams(100, undefined)).toBe(100);
    });
    it('uses volumeMl * 0.8 when no manualWeight', () => {
      expect(getMaxPossibleGrams(undefined, 500)).toBe(400);
      expect(getMaxPossibleGrams(0, 500)).toBe(400);
    });
    it('returns 1000 when neither provided', () => {
      expect(getMaxPossibleGrams(undefined, undefined)).toBe(1000);
      expect(getMaxPossibleGrams(undefined, 0)).toBe(1000);
    });
  });

  describe('isIntakeOverLimit', () => {
    it('returns true when totalGram exceeds maxPossible * 1.1', () => {
      expect(isIntakeOverLimit(250, 220)).toBe(true);
      expect(isIntakeOverLimit(243, 220)).toBe(true);  // 220*1.1=242
      expect(isIntakeOverLimit(242, 220)).toBe(false);
      expect(isIntakeOverLimit(200, 220)).toBe(false);
    });
    it('returns false when maxPossibleGrams is 0', () => {
      expect(isIntakeOverLimit(100, 0)).toBe(false);
    });
    it('accepts custom toleranceRatio', () => {
      expect(isIntakeOverLimit(200, 200, 1.0)).toBe(false);
      expect(isIntakeOverLimit(201, 200, 1.0)).toBe(true);
    });
  });

  describe('getIntakeOverLimitMessage', () => {
    it('returns message with totalGram and rounded maxPossibleGrams', () => {
      const msg = getIntakeOverLimitMessage(250, 220.7);
      expect(msg).toContain('250g');
      expect(msg).toContain('221g');
      expect(msg).toContain('預估限制');
    });
  });

  describe('shouldWarnHighIntake', () => {
    it('returns true when totalGram > maxPossible * 0.9', () => {
      expect(shouldWarnHighIntake(200, 220)).toBe(true);   // 200 > 198
      expect(shouldWarnHighIntake(198, 220)).toBe(false);
      expect(shouldWarnHighIntake(150, 220)).toBe(false);
    });
    it('returns false when maxPossibleGrams is 0', () => {
      expect(shouldWarnHighIntake(100, 0)).toBe(false);
    });
    it('accepts custom warnRatio', () => {
      expect(shouldWarnHighIntake(101, 200, 0.5)).toBe(true);  // 101 > 100
      expect(shouldWarnHighIntake(99, 200, 0.5)).toBe(false);
    });
  });
});
