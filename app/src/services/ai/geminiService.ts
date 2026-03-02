import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import {
  AiRecognitionService,
  BloodReportOCRResult,
  ConsumptionLevel,
  EliminationVisionResult,
  FeedingMajorityVoteResult,
  FeedingVisionResult,
  HydrationVisionResult,
  NutritionOCRResult,
  AiImageInput,
  SideProfileAnalysisResult
} from '../../types/ai';
import { validateImageQuality } from '../../utils/imageQuality';

// Note: In a real app, the API key should be handled securely.
// For Expo, we recommend using EXPO_PUBLIC_ prefix for environment variables.
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

console.log('[GeminiService] Initializing with:', {
  hasKey: !!API_KEY,
  keyPrefix: API_KEY.substring(0, 6) + '...',
  model: 'gemini-2.5-flash'
});

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.1, // 略降隨機性，但避免過度保守導致誤判為 almost_none
  }
});

async function fileToGenerativePart(base64: string, mimeType: string): Promise<Part> {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}

function safeJsonParse<T>(text: string): T {
  try {
    const cleaned = text.replace(/```(json)?\n?/gi, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error('[GeminiService] JSON Parse Error. Raw text:', text);
    throw new Error('AI 返回了無法解析的格式');
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

const FEEDING_LEVEL_ORDER: ConsumptionLevel[] = [
  'almost_none',
  'a_little',
  'about_half',
  'more_than_half',
  'almost_all_eaten',
];

const FEEDING_LEVEL_ANCHOR: Record<ConsumptionLevel, number> = {
  almost_none: 0,
  a_little: 0.25,
  about_half: 0.5,
  more_than_half: 0.75,
  almost_all_eaten: 0.9,
};

const FEEDING_THRESHOLDS = [0.125, 0.375, 0.625, 0.825];
const FEEDING_HYSTERESIS_BUFFER = 0.05;
const feedingHysteresisState = new Map<string, ConsumptionLevel>();

function inferConsumedRatio(parsed: Partial<FeedingVisionResult>, t0RefGrams: number): number {
  const direct = Number((parsed as { consumedRatio?: number }).consumedRatio);
  if (Number.isFinite(direct)) return clamp(direct, 0, 1);

  const grams = Number(parsed.householdTotalGram);
  if (Number.isFinite(grams) && t0RefGrams > 0) return clamp(grams / t0RefGrams, 0, 1);

  const level = parsed.consumptionLevel;
  if (level && FEEDING_LEVEL_ANCHOR[level] !== undefined) return FEEDING_LEVEL_ANCHOR[level];

  return 0.5;
}

function ratioToBaseLevel(ratio: number): ConsumptionLevel {
  if (ratio < FEEDING_THRESHOLDS[0]) return 'almost_none';
  if (ratio < FEEDING_THRESHOLDS[1]) return 'a_little';
  if (ratio < FEEDING_THRESHOLDS[2]) return 'about_half';
  if (ratio < FEEDING_THRESHOLDS[3]) return 'more_than_half';
  return 'almost_all_eaten';
}

function applyFeedingHysteresis(
  key: string,
  ratio: number,
  baseLevel: ConsumptionLevel
): ConsumptionLevel {
  const prev = feedingHysteresisState.get(key);
  if (!prev) {
    feedingHysteresisState.set(key, baseLevel);
    return baseLevel;
  }

  const nearBoundary = FEEDING_THRESHOLDS.some(
    (threshold) => Math.abs(ratio - threshold) <= FEEDING_HYSTERESIS_BUFFER
  );

  if (!nearBoundary) {
    feedingHysteresisState.set(key, baseLevel);
    return baseLevel;
  }

  const prevIdx = FEEDING_LEVEL_ORDER.indexOf(prev);
  const baseIdx = FEEDING_LEVEL_ORDER.indexOf(baseLevel);

  const chosen = Math.abs(prevIdx - baseIdx) <= 1 ? prev : baseLevel;
  feedingHysteresisState.set(key, chosen);
  return chosen;
}

function buildFeedingHysteresisKey(t0Base64: string, t1Base64: string, t0RefGrams: number): string {
  const t0Sig = t0Base64.slice(0, 64);
  const t1Sig = t1Base64.slice(0, 64);
  return `${t0Sig}|${t1Sig}|${Math.round(t0RefGrams)}`;
}

function median(values: number[]): number {
  if (!values.length) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number {
  if (!values.length) return 0.5;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export const geminiService: AiRecognitionService = {
  async analyzeFeedingImages(input): Promise<FeedingVisionResult> {
    if (!input.t0.imageBase64 || !input.t1.imageBase64) {
      throw new Error('Image Base64 data missing for feeding analysis');
    }

    const q0 = validateImageQuality(input.t0.imageBase64);
    if (!q0.valid) throw new Error(q0.reason || 'T0 image quality is insufficient');
    const q1 = validateImageQuality(input.t1.imageBase64);
    if (!q1.valid) throw new Error(q1.reason || 'T1 image quality is insufficient');

    const emptyBowlBase64 = input.vessel?.topViewImageBase64;
    const hasEmptyBowl = !!emptyBowlBase64;

    // 計算容器體積（如果有的話）
    const vesselVolumeMl = input.vessel?.volumeMl;
    const hasManualWeight = input.t0.manualWeight !== undefined && input.t0.manualWeight > 0;

    // T0 參考克數：用於將剩餘比例換算成 consumed 克數
    const t0RefGrams = hasManualWeight
      ? input.t0.manualWeight!
      : (vesselVolumeMl ? vesselVolumeMl * 0.8 * 0.45 : 500); // 無校準時假設 500g 參考

    const vesselHeightCm = input.vessel?.dimensions?.height;
    const isShallowBowl = vesselHeightCm !== undefined && vesselHeightCm < 5;

    const imageRolesSection = hasEmptyBowl
      ? `
## IMAGE ROLES（三張圖的定義）

You receive THREE images in order:
- [1] Empty bowl（空碗） = 0% food — used as contour/texture reference only. Does NOT define what a "full bowl" looks like.
- [2] T0 = The state immediately after feeding this meal. This is the 100% anchor for THIS meal. T0 may be 70%, 80%, or any fill level — it does not need to be a full bowl.
- [3] T1 = The state after some time has passed.

Core question: "Relative to T0 (this meal's starting point), how much food remains in T1?"

The empty bowl image is used ONLY to:
1. Identify the bowl's shape, color, and texture (to separate bowl from food)
2. Provide the 0% food anchor

Do NOT use the empty bowl to infer how much food T0 "should" contain.
`
      : `
## IMAGE ROLES（雙圖模式）

You receive TWO images in order:
- [1] T0 = The state immediately after feeding this meal. This is the 100% anchor for THIS meal.
- [2] T1 = The state after some time has passed.

Core question: "Relative to T0 (this meal's starting point), how much food remains in T1?"
`;

    const shallowBowlSection = isShallowBowl
      ? `
## SHALLOW BOWL RULE（淺碗 — 高度 < 5cm）

For shallow bowls, food height difference is minimal. Focus on:
- Surface area coverage change
- Grain density and shadow depth
- Exposed bowl bottom area
`
      : '';

    const prompt = `
You are a production vision model for cat feeding analysis.
Return valid JSON only (no markdown, no extra text).

${imageRolesSection}

Task:
Estimate consumedRatio in [0,1] where:
- 0.0 = almost none eaten
- 1.0 = almost all eaten

Hard rules:
1. Compare only bowl interior ROI.
2. Normalize brightness/contrast between T0 and T1 before judging.
3. Ignore background, camera tilt, and non-bowl regions.
4. ${hasEmptyBowl
    ? 'Use Empty bowl only for bowl-material reference; do NOT use Empty as fullness baseline.'
    : 'Use T0 as the only meal baseline.'}
5. If bowl mismatch between T0 and T1, set isBowlMatch=false.
6. If uncertain near boundaries, set uncertain=true and explain briefly in reason.

${shallowBowlSection}

Return JSON:
{
  "consumedRatio": number (0.0-1.0),
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "uncertain": boolean,
  "reason": string,
  "confidence": number (0.0-1.0)
}
`;

    const imageParts: Part[] = [];
    if (hasEmptyBowl) {
      imageParts.push(await fileToGenerativePart(emptyBowlBase64!, 'image/jpeg'));
    }
    imageParts.push(
      await fileToGenerativePart(input.t0.imageBase64, input.t0.mimeType || 'image/jpeg'),
      await fileToGenerativePart(input.t1.imageBase64, input.t1.mimeType || 'image/jpeg')
    );

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const parsed = safeJsonParse<FeedingVisionResult & {
      preCheck?: { Q1?: boolean; Q2?: boolean; Q3?: boolean; Q4?: boolean };
      uncertain?: boolean;
      reason?: string;
    }>(response.text());

    const levelToGram: Record<ConsumptionLevel, number> = {
      almost_all_eaten: Math.round(0.9 * t0RefGrams),
      more_than_half: Math.round(0.75 * t0RefGrams),
      about_half: Math.round(0.5 * t0RefGrams),
      a_little: Math.round(0.25 * t0RefGrams),
      almost_none: 0,
    };

    const consumedRatio = inferConsumedRatio(parsed, t0RefGrams);
    const baseLevel = ratioToBaseLevel(consumedRatio);
    const hysteresisKey = buildFeedingHysteresisKey(input.t0.imageBase64, input.t1.imageBase64, t0RefGrams);
    let normalizedLevel = applyFeedingHysteresis(hysteresisKey, consumedRatio, baseLevel);

    // 安全網：若 PRE-CHECK 任一為 true（Q1||Q2||Q3||Q4），almost_none 不可用；若 AI/規則仍落到 almost_none，強制改為 a_little
    const almostNoneForbidden = parsed.preCheck && (parsed.preCheck.Q1 || parsed.preCheck.Q2 || parsed.preCheck.Q3 || parsed.preCheck.Q4);
    if (almostNoneForbidden && normalizedLevel === 'almost_none') {
      normalizedLevel = 'a_little';
    }

    parsed.confidence = clamp(Number(parsed.confidence ?? 0.5), 0, 1);
    parsed.estimatedErrorMargin = clamp(Number(parsed.estimatedErrorMargin ?? 0.2), 0.08, 0.2);
    parsed.isBowlMatch = Boolean(parsed.isBowlMatch);
    parsed.mismatchReason = parsed.isBowlMatch ? undefined : (parsed.mismatchReason || 'Bowl mismatch');
    parsed.consumedRatio = consumedRatio;
    parsed.consumptionLevel = normalizedLevel;
    parsed.householdTotalGram = levelToGram[normalizedLevel];
    if (!Array.isArray(parsed.assignments)) parsed.assignments = [];
    if (parsed.assignments[0]) {
      parsed.assignments[0].estimatedIntakeGram = parsed.householdTotalGram;
    }

    return parsed as FeedingVisionResult;
  },

  async analyzeWithMajorityVote(input: {
    t0: AiImageInput;
    t1: AiImageInput;
    vessel?: import('../../types/app').VesselCalibration;
  }): Promise<FeedingMajorityVoteResult> {
    const [run1, run2, run3] = await Promise.all([
      this.analyzeFeedingImages(input),
      this.analyzeFeedingImages(input),
      this.analyzeFeedingImages(input),
    ]);

    const t0RefGrams =
      (input.t0.manualWeight !== undefined && input.t0.manualWeight > 0)
        ? input.t0.manualWeight
        : (input.vessel?.volumeMl ? input.vessel.volumeMl * 0.8 * 0.45 : 500);

    const ratioValues = [run1, run2, run3].map((r) => inferConsumedRatio(r, t0RefGrams));
    const ratioSpread = Math.max(...ratioValues) - Math.min(...ratioValues);
    const robustRatio = ratioSpread >= 0.35 ? mean(ratioValues) : median(ratioValues);
    const medianRatio = clamp(robustRatio, 0, 1);
    let levelFromRatio = ratioToBaseLevel(medianRatio);

    const anyPrecheckForbidAlmostNone = [run1, run2, run3].some((r) => Boolean(r.preCheck && (r.preCheck.Q1 || r.preCheck.Q2 || r.preCheck.Q3 || r.preCheck.Q4)));
    if (anyPrecheckForbidAlmostNone && levelFromRatio === 'almost_none') {
      levelFromRatio = 'a_little';
    }

    const levels = [run1, run2, run3].map((r) => r.consumptionLevel ?? levelFromRatio);
    const counts = levels.reduce<Partial<Record<ConsumptionLevel, number>>>((acc, level) => {
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

    const levelToGram: Record<ConsumptionLevel, number> = {
      almost_all_eaten: Math.round(0.9 * t0RefGrams),
      more_than_half: Math.round(0.75 * t0RefGrams),
      about_half: Math.round(0.5 * t0RefGrams),
      a_little: Math.round(0.25 * t0RefGrams),
      almost_none: 0,
    };

    const base = run1;
    return {
      ...base,
      consumedRatio: medianRatio,
      consumptionLevel: levelFromRatio,
      householdTotalGram: levelToGram[levelFromRatio],
      distribution: counts,
      confidence: clamp((counts[levelFromRatio] ?? 0) / 3, 0, 1),
    };
  },

  async extractNutritionLabel(input): Promise<NutritionOCRResult> {
    if (!input.imageBase64) {
      throw new Error('Image Base64 data missing for nutrition extraction');
    }

    const prompt = `
Extract nutrition information from this pet food label.
Return valid JSON only (no markdown, no extra text).

Rules:
- Parse numbers only; if not found, return null for that field.
- kcalPerGram must be in kcal/g.
- proteinPct and phosphorusPct are percentages (% as-fed if unspecified).

JSON schema:
{
  "kcalPerGram": number | null,
  "proteinPct": number | null,
  "phosphorusPct": number | null,
  "rawText": string
}
`;

    console.log('[GeminiService] extractNutritionLabel: Base64 length:', input.imageBase64.length);
    try {
      const imagePart = await fileToGenerativePart(input.imageBase64, input.mimeType || 'image/jpeg');
      console.log('[GeminiService] Sending request to Gemini...');
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      console.log('[GeminiService] Raw text response:', text);
      const parsed = safeJsonParse<NutritionOCRResult>(text);
      return {
        kcalPerGram: clamp(Number(parsed.kcalPerGram ?? 0), 0, 10),
        proteinPct: clamp(Number(parsed.proteinPct ?? 0), 0, 100),
        phosphorusPct: clamp(Number(parsed.phosphorusPct ?? 0), 0, 100),
        rawText: String(parsed.rawText || ''),
      };
    } catch (error) {
      console.error('[GeminiService] Error in extractNutritionLabel:', error);
      throw error;
    }
  },

  async analyzeHydrationImages(input): Promise<HydrationVisionResult> {
    if (!input.t0.imageBase64 || !input.t1.imageBase64) {
      throw new Error('Image Base64 data missing for hydration analysis');
    }

    // 如果使用側面輪廓校準且提供了水位百分比，使用精確計算
    if (input.vessel?.calibrationMethod === 'side_profile' && 
        input.vessel.profileContour &&
        input.t0.waterLevelPct !== undefined && 
        input.t1.waterLevelPct !== undefined) {
      const { calculateVolumeToWaterLevel } = require('../../utils/profileVolume');
      const waterT0Ml = calculateVolumeToWaterLevel(input.vessel.profileContour, input.t0.waterLevelPct);
      const waterT1Ml = calculateVolumeToWaterLevel(input.vessel.profileContour, input.t1.waterLevelPct);
      
      // 估算環境因素（蒸發等）
      const tempC = 25; // 預設溫度
      const humidityPct = 60; // 預設濕度
      const envFactorMl = Math.max(0, (waterT0Ml - waterT1Ml) * 0.02); // 簡單估算：2% 蒸發
      const actualIntakeMl = Math.max(0, waterT0Ml - waterT1Ml - envFactorMl);
      
      return {
        waterT0Ml: Math.round(waterT0Ml),
        waterT1Ml: Math.round(waterT1Ml),
        tempC,
        humidityPct,
        envFactorMl: Math.round(envFactorMl),
        actualIntakeMl: Math.round(actualIntakeMl),
        isBowlMatch: true,
        mismatchReason: '',
        confidence: 0.95, // 側面輪廓計算的準確度較高
      };
    }

    // 若有側面輪廓校準：請 AI 輸出水位百分比，再由輪廓計算體積（避免直接估算 ml 的誤差）
    const contour = input.vessel?.profileContour;
    const hasProfileContour = input.vessel?.calibrationMethod === 'side_profile' && contour?.points?.length;
    const estimatedHeightCm = contour?.estimatedHeightCm ?? (contour?.points?.length ? contour.points[contour.points.length - 1].y : undefined);

    if (hasProfileContour && contour) {
      const t0Level = input.t0.waterLevelPct;
      const t1Level = input.t1.waterLevelPct;

      // 若使用者已手動標記兩張，直接計算（不呼叫 AI）
      if (t0Level !== undefined && t1Level !== undefined) {
        const { calculateVolumeToWaterLevel } = require('../../utils/profileVolume');
        const waterT0Ml = calculateVolumeToWaterLevel(contour, t0Level);
        const waterT1Ml = calculateVolumeToWaterLevel(contour, t1Level);
        const envFactorMl = Math.max(0, (waterT0Ml - waterT1Ml) * 0.02);
        const actualIntakeMl = Math.max(0, waterT0Ml - waterT1Ml - envFactorMl);
        return {
          waterT0Ml: Math.round(waterT0Ml),
          waterT1Ml: Math.round(waterT1Ml),
          tempC: 25,
          humidityPct: 60,
          envFactorMl: Math.round(envFactorMl),
          actualIntakeMl: Math.round(actualIntakeMl),
          isBowlMatch: true,
          mismatchReason: '',
          confidence: 0.95,
        };
      }

      // 有輪廓但未標記：請 AI 輸出水位百分比，再由輪廓計算體積
      const contourSummary = contour.points.length <= 20
        ? JSON.stringify(contour.points)
        : `[${contour.points.slice(0, 5).map(p => `{y:${p.y}, r:${p.radius}}`).join(', ')} ... ${contour.points.length} points, height≈${estimatedHeightCm}cm]`;

      const prompt = `
You are analyzing water bowl images for a vessel with a known cross-section profile.
Return valid JSON only (no markdown, no extra text).
The vessel profile has been pre-calibrated. Your task is to estimate the WATER LEVEL as a fraction, NOT the volume.

## TASK
For each image (T0 and T1), estimate where the water surface is relative to the bowl:
- waterLevelPct: 0.0 = water at rim (top), 1.0 = water at bottom. Values in between = fractional fill.
- Use the visible waterline, meniscus, reflections, and bowl geometry to estimate this fraction.
- The bowl is the same in both images. Compare T0 vs T1 to ensure consistency.

## VESSEL PROFILE (for reference)
${contourSummary}
${estimatedHeightCm ? `Estimated height: ${estimatedHeightCm}cm` : ''}

## OUTPUT
Return JSON:
{
  "waterLevelPctT0": number (0.0-1.0),
  "waterLevelPctT1": number (0.0-1.0),
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "confidence": number (0.0-1.0)
}

Volume (ml) will be calculated from these percentages using the profile. Do NOT estimate ml directly.
`;

      const imageParts = [
        await fileToGenerativePart(input.t0.imageBase64, input.t0.mimeType || 'image/jpeg'),
        await fileToGenerativePart(input.t1.imageBase64, input.t1.mimeType || 'image/jpeg'),
      ];

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const raw = safeJsonParse<{ waterLevelPctT0: number; waterLevelPctT1: number; isBowlMatch: boolean; mismatchReason: string | null; confidence: number }>(response.text());

      const { calculateVolumeToWaterLevel } = require('../../utils/profileVolume');
      const waterT0Ml = calculateVolumeToWaterLevel(contour, Math.max(0, Math.min(1, raw.waterLevelPctT0)));
      const waterT1Ml = calculateVolumeToWaterLevel(contour, Math.max(0, Math.min(1, raw.waterLevelPctT1)));
      const envFactorMl = Math.max(0, (waterT0Ml - waterT1Ml) * 0.02);
      const actualIntakeMl = Math.max(0, waterT0Ml - waterT1Ml - envFactorMl);

      return {
        waterT0Ml: Math.round(waterT0Ml),
        waterT1Ml: Math.round(waterT1Ml),
        tempC: 25,
        humidityPct: 60,
        envFactorMl: Math.round(envFactorMl),
        actualIntakeMl: Math.round(actualIntakeMl),
        isBowlMatch: raw.isBowlMatch,
        mismatchReason: raw.mismatchReason ?? '',
        confidence: raw.confidence,
      };
    }

    // 無輪廓：傳統 AI 直接估算體積（準確率較低）
    const t0Level = input.t0.waterLevelPct !== undefined ? `\n- The user explicitly marked the T0 water level exactly at ${Math.round(input.t0.waterLevelPct * 100)}% from the top of the image.` : '';
    const t1Level = input.t1.waterLevelPct !== undefined ? `\n- The user explicitly marked the T1 water level exactly at ${Math.round(input.t1.waterLevelPct * 100)}% from the top of the image.` : '';

    const prompt = `
Analyze two water-bowl images: T0 (initial) and T1 (later).
Return valid JSON only (no markdown, no extra text).

CRITICAL INSTRUCTION FOR TRANSPARENT WATER: ${t0Level} ${t1Level}
If explicit user water-level marks are provided, use them as primary signal.

Hard constraints:
- waterT0Ml >= 0
- waterT1Ml >= 0
- waterT1Ml <= waterT0Ml unless clear refill evidence
- confidence between 0 and 1

JSON schema:
{
  "waterT0Ml": number,
  "waterT1Ml": number,
  "tempC": number,
  "humidityPct": number,
  "envFactorMl": number,
  "actualIntakeMl": number,
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "confidence": number
}

${input.vessel ? `
Reference vessel:
- name: ${input.vessel.name}
- shape: ${input.vessel.shape}
- dimensions: ${JSON.stringify(input.vessel.dimensions)}
${input.vessel.volumeMl ? `- calibratedVolumeMl: ${input.vessel.volumeMl}` : ''}
If vessel appears different between T0 and T1, set isBowlMatch=false and explain mismatchReason.
` : ''}
`;

    const imageParts = [
      await fileToGenerativePart(input.t0.imageBase64, input.t0.mimeType || 'image/jpeg'),
      await fileToGenerativePart(input.t1.imageBase64, input.t1.mimeType || 'image/jpeg'),
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const parsed = safeJsonParse<HydrationVisionResult>(response.text());
    const waterT0Ml = Math.max(0, Math.round(Number(parsed.waterT0Ml ?? 0)));
    const waterT1Ml = Math.max(0, Math.round(Number(parsed.waterT1Ml ?? 0)));
    return {
      ...parsed,
      waterT0Ml,
      waterT1Ml: Math.min(waterT0Ml, waterT1Ml),
      tempC: Number(parsed.tempC ?? 25),
      humidityPct: clamp(Number(parsed.humidityPct ?? 60), 0, 100),
      envFactorMl: Math.max(0, Math.round(Number(parsed.envFactorMl ?? 0))),
      actualIntakeMl: Math.max(0, Math.round(Number(parsed.actualIntakeMl ?? waterT0Ml - waterT1Ml))),
      isBowlMatch: Boolean(parsed.isBowlMatch),
      mismatchReason: parsed.isBowlMatch ? '' : (parsed.mismatchReason ?? 'Bowl mismatch'),
      confidence: clamp(Number(parsed.confidence ?? 0.5), 0, 1),
    };
  },

  async analyzeEliminationImage(input): Promise<EliminationVisionResult> {
    if (!input.imageBase64) {
      throw new Error('Image Base64 data missing for elimination analysis');
    }

    const prompt = `
Analyze this cat feces image on a litter scoop.
Return valid JSON only (no markdown, no extra text).
Use Bristol Stool Scale (1-7).
IMPORTANT: all string fields MUST be Traditional Chinese (zh-TW).

JSON schema:
{
  "color": string,
  "bristolType": number,
  "shapeType": string,
  "abnormal": boolean,
  "confidence": number,
  "note": string
}
`;

    const imagePart = await fileToGenerativePart(input.imageBase64, input.mimeType || 'image/jpeg');
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const parsed = safeJsonParse<EliminationVisionResult>(response.text());
    const bristolType = Math.max(1, Math.min(7, Math.round(Number(parsed.bristolType ?? 4)))) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    return {
      color: String(parsed.color || '未知'),
      bristolType,
      shapeType: String(parsed.shapeType || `Bristol Type ${bristolType}`),
      abnormal: Boolean(parsed.abnormal),
      confidence: clamp(Number(parsed.confidence ?? 0.5), 0, 1),
      note: String(parsed.note || ''),
    };
  },

  async extractBloodReport(input): Promise<BloodReportOCRResult> {
    if (!input.imageBase64) {
      throw new Error('Image Base64 data missing for blood report extraction');
    }

    const prompt = `
Extract blood test markers from this veterinary report.
Return valid JSON only (no markdown, no extra text).
If a reference bound is missing, return null for that bound.
Marker code must be uppercase.

JSON schema:
{
  "reportDate": string,
  "labName": string,
  "markers": [
    { "code": string, "value": number, "unit": string, "refLow": number | null, "refHigh": number | null }
  ],
  "confidence": number
}
`;

    const imagePart = await fileToGenerativePart(input.imageBase64, input.mimeType || 'image/jpeg');
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const parsed = safeJsonParse<BloodReportOCRResult>(response.text());
    return {
      reportDate: String(parsed.reportDate || new Date().toISOString().slice(0, 10)),
      labName: String(parsed.labName || ''),
      markers: Array.isArray(parsed.markers)
        ? parsed.markers
            .map((m) => ({
              code: String(m.code || '').toUpperCase(),
              value: Number(m.value ?? 0),
              unit: String(m.unit || ''),
              refLow: m.refLow == null ? null : Number(m.refLow),
              refHigh: m.refHigh == null ? null : Number(m.refHigh),
            }))
            .filter((m) => m.code.length > 0)
        : [],
      confidence: clamp(Number(parsed.confidence ?? 0.5), 0, 1),
    } as BloodReportOCRResult;
  },

  async analyzeSideProfile(input): Promise<SideProfileAnalysisResult> {
    if (!input.imageBase64) {
      throw new Error('Image Base64 data missing for side profile analysis');
    }

    const prompt = `
You are an expert computer vision assistant specialized in vessel profile reconstruction for precise volume calculation.
Return valid JSON only (no markdown, no extra text).

TASK: Analyze a side-view photo of an empty cat bowl/water fountain and extract its cross-sectional profile.

CRITICAL REQUIREMENTS:
1. Identify the INNER edges of the vessel (the actual water-holding contour, not outer decorative edges)
2. The vessel is assumed to be rotationally symmetric (circular cross-section)
3. Extract the profile from the rim (top) to the bottom
4. Use the rim diameter (${input.rimDiameterCm}cm) as the scale reference for pixel-to-cm conversion

INPUT:
- Side-view image of empty vessel (must be empty, no water/food)
- Rim diameter: ${input.rimDiameterCm}cm (user-provided, use this for pixel-to-cm conversion)

SCALE CALCULATION:
- Measure the rim width in pixels from the image
- Calculate pixels-per-cm: rimWidthPixels / ${input.rimDiameterCm}cm
- Use this scale factor to convert all measurements from pixels to cm

OUTPUT FORMAT (JSON):
{
  "contour": {
    "points": [
      {"y": 0.0, "radius": ${(input.rimDiameterCm / 2).toFixed(1)}},    // y: distance from rim downward (cm), radius: radius at that height (cm)
      {"y": 0.2, "radius": 5.8},
      {"y": 0.4, "radius": 5.6},
      {"y": 0.6, "radius": 5.4},
      ...
      {"y": estimatedHeightCm, "radius": bottomRadius}
    ],
    "confidence": 0.95,
    "estimatedHeightCm": 3.0
  },
  "confidence": 0.95,
  "estimatedVolumeMl": 300
}

CALCULATION METHOD:
1. Detect the rim (top inner edge) - this is your y=0 reference point
2. Measure rim width in pixels, calculate scale: pixelsPerCm = rimWidthPixels / ${input.rimDiameterCm}
3. Extract the INNER profile curve from rim to bottom (ignore decorative outer edges)
4. For each height y (in cm from rim), calculate the radius:
   - Measure the half-width at that height in pixels
   - Convert to cm: radius = (halfWidthPixels / pixelsPerCm)
5. The profile should accurately capture:
   - Rounded bottom corners (radius decreases smoothly near bottom)
   - Any tapering (radius decreases downward) or flaring (radius increases downward)
   - Real shape, NOT assuming perfect cylinder
   - Account for any curvature or irregularity

IMPORTANT NOTES:
- y=0 is the rim (top inner edge of vessel)
- y increases downward (positive y means deeper into vessel)
- radius is the half-width at each height (for circular cross-section)
- Points should be evenly spaced (every 0.1-0.2cm recommended for smooth interpolation)
- Include at least 20-30 points for accurate volume calculation
- The last point should be at the bottom (y = estimatedHeightCm)
- Focus on INNER contour (where water actually sits), not outer decorative edges
- If the vessel has a flat bottom, the last few points should have similar radius values

VOLUME ESTIMATION (for reference):
- Use numerical integration: V = ∫[0 to height] π × r(y)² dy
- This will be calculated separately, but you can provide an estimate

Return JSON only. Ensure all numeric values are numbers, not strings.
`;

    const imagePart = await fileToGenerativePart(input.imageBase64, 'image/jpeg');
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return safeJsonParse<SideProfileAnalysisResult>(response.text());
  },
};
