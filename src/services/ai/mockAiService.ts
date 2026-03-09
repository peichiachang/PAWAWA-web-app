import { AiRecognitionService, BloodReportOCRResult, EliminationVisionResult, FeedingVisionResult, HydrationVisionResult, NutritionOCRResult } from '../../types/ai';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return hash;
}

function seededRange(seed: number, min: number, max: number): number {
  const normalized = (seed % 1000) / 1000;
  return min + normalized * (max - min);
}

export const mockAiService: AiRecognitionService = {
  async analyzeFeedingImages(input): Promise<FeedingVisionResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log('[MockAI] Analyzing feeding with vessel:', input.vessel?.name);
    const seed = hashSeed(`${input.t0.imageRef || input.t0.uri || ''}:${input.t1.imageRef || input.t1.uri || ''}`);
    const miloGram = Math.round(seededRange(seed + 1, 35, 50));
    const lunaGram = Math.round(seededRange(seed + 7, 28, 46));
    return {
      bowlsDetected: 2,
      assignments: [
        { bowlId: 'A', tag: 'Milo', estimatedIntakeGram: miloGram },
        { bowlId: 'B', tag: 'Luna', estimatedIntakeGram: lunaGram },
      ],
      totalGram: miloGram + lunaGram,
      isBowlMatch: true,
      confidence: Number(seededRange(seed + 15, 0.65, 0.99).toFixed(2)),
    };
  },

  async extractNutritionLabel(input): Promise<NutritionOCRResult> {
    await delay(500);
    const seed = hashSeed(input.imageRef || input.uri || '');
    const kcalPerGram = Number(seededRange(seed + 3, 3.1, 3.8).toFixed(2));
    const proteinPct = Number(seededRange(seed + 5, 30, 44).toFixed(1));
    const phosphorusPct = Number(seededRange(seed + 8, 0.4, 1.1).toFixed(2));
    return {
      kcalPerGram,
      proteinPct,
      phosphorusPct,
      rawText: `Energy ${kcalPerGram} kcal/g, Protein ${proteinPct}%, Phosphorus ${phosphorusPct}%`,
    };
  },

  async analyzeHydrationImages(input): Promise<HydrationVisionResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log('[MockAI] Analyzing hydration with vessel:', input.vessel?.name);
    const seed = hashSeed(`${input.t0.imageRef || input.t0.uri || ''}:${input.t1.imageRef || input.t1.uri || ''}:hydration`);
    const tempC = Number(seededRange(seed + 6, 21, 30).toFixed(1));
    const humidityPct = Number(seededRange(seed + 9, 45, 75).toFixed(1));
    const envFactorMl = Math.round(seededRange(seed + 10, 8, 22));

    // If user marks are provided, use them as primary source for fill fraction estimation
    const BOWL_CAPACITY_ML = 1200;
    let waterT0Ml: number;
    let waterT1Ml: number;
    if (input.t0.waterLevelPct !== undefined && input.t1.waterLevelPct !== undefined) {
      waterT0Ml = Math.round(BOWL_CAPACITY_ML * (1 - input.t0.waterLevelPct));
      waterT1Ml = Math.round(BOWL_CAPACITY_ML * (1 - input.t1.waterLevelPct));
    } else {
      waterT0Ml = Math.round(seededRange(seed + 2, 900, 1300));
      const dropMl = Math.round(seededRange(seed + 4, 240, 480));
      waterT1Ml = Math.max(0, waterT0Ml - dropMl);
    }

    const actualIntakeMl = Math.max(0, waterT0Ml - waterT1Ml - envFactorMl);
    return {
      waterT0Ml,
      waterT1Ml,
      tempC,
      humidityPct,
      envFactorMl,
      actualIntakeMl,
      isBowlMatch: true,
      mismatchReason: '',
      confidence: Number(seededRange(seed + 15, 0.65, 0.99).toFixed(2)),
    };
  },

  async analyzeEliminationImage(input): Promise<EliminationVisionResult> {
    await delay(450);
    const seed = hashSeed(input.imageRef || input.uri || '');
    const bristolType = (Math.floor(seededRange(seed + 11, 1, 8)) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
    const confidence = Number(seededRange(seed + 13, 0.88, 0.99).toFixed(2));
    const abnormal = bristolType <= 2 || bristolType >= 6;
    return {
      color: abnormal ? '偏深棕色' : '正常棕色',
      bristolType,
      shapeType: `Bristol Type ${bristolType}`,
      abnormal,
      confidence,
      note: abnormal ? '偏離理想 Bristol 3-4，建議持續觀察與補水。' : '接近理想 Bristol 3-4。',
    };
  },

  async extractBloodReport(input): Promise<BloodReportOCRResult> {
    await delay(900);
    const seed = hashSeed(input.imageRef || input.uri || '');
    const s = (offset: number, min: number, max: number) =>
      Number(seededRange(seed + offset, min, max).toFixed(1));

    return {
      reportDate: new Date().toISOString().slice(0, 10),
      labName: 'IDEXX',
      markers: [
        { code: 'RBC', value: Number(s(1, 5.5, 10.5).toFixed(1)), unit: '10⁶/μL', refLow: 5.0, refHigh: 10.0 },
        { code: 'HCT', value: Math.round(s(2, 25, 50)), unit: '%', refLow: 30, refHigh: 45 },
        { code: 'HGB', value: Number(s(3, 8, 16).toFixed(1)), unit: 'g/dL', refLow: 9.0, refHigh: 15.1 },
        { code: 'MCV', value: Math.round(s(4, 36, 55)), unit: 'fL', refLow: 39, refHigh: 55 },
        { code: 'MCHC', value: Number(s(5, 28, 38).toFixed(1)), unit: 'g/dL', refLow: 30, refHigh: 36 },
        { code: 'WBC', value: Number(s(6, 3, 22).toFixed(1)), unit: '10³/μL', refLow: 5.5, refHigh: 19.5 },
        { code: 'NEU', value: Number(s(7, 2, 15).toFixed(1)), unit: '10³/μL', refLow: 2.5, refHigh: 14.0 },
        { code: 'LYM', value: Number(s(8, 0.5, 8).toFixed(1)), unit: '10³/μL', refLow: 1.5, refHigh: 7.0 },
        { code: 'PLT', value: Math.round(s(9, 100, 700)), unit: '10³/μL', refLow: 151, refHigh: 600 },
        { code: 'BUN', value: Math.round(s(10, 12, 45)), unit: 'mg/dL', refLow: 16, refHigh: 36 },
        { code: 'CREA', value: Number(s(11, 0.5, 3.2).toFixed(1)), unit: 'mg/dL', refLow: 0.6, refHigh: 2.4 },
        { code: 'ALT', value: Math.round(s(12, 10, 200)), unit: 'U/L', refLow: 12, refHigh: 130 },
        { code: 'AST', value: Math.round(s(13, 15, 80)), unit: 'U/L', refLow: 0, refHigh: 48 },
        { code: 'ALKP', value: Math.round(s(14, 10, 100)), unit: 'U/L', refLow: 0, refHigh: 62 },
        { code: 'GLU', value: Math.round(s(15, 65, 200)), unit: 'mg/dL', refLow: 70, refHigh: 150 },
        { code: 'TP', value: Number(s(16, 5, 9.5).toFixed(1)), unit: 'g/dL', refLow: 5.7, refHigh: 8.9 },
        { code: 'ALB', value: Number(s(17, 2.0, 4.5).toFixed(1)), unit: 'g/dL', refLow: 2.3, refHigh: 3.9 },
        { code: 'K', value: Number(s(18, 3.0, 6.5).toFixed(1)), unit: 'mEq/L', refLow: 3.5, refHigh: 5.8 },
        { code: 'PHOS', value: Number(s(19, 2.0, 8.0).toFixed(1)), unit: 'mg/dL', refLow: 2.6, refHigh: 6.0 },
        { code: 'T4', value: Number(s(20, 0.6, 5.5).toFixed(1)), unit: 'μg/dL', refLow: 0.8, refHigh: 4.0 },
      ],
      confidence: Number(s(21, 0.65, 0.99).toFixed(2)),
    };
  },
};
