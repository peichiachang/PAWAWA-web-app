#!/usr/bin/env node
/**
 * Feeding 準確率評估（走 app 現行邏輯）
 *
 * 與 app/src/services/ai/geminiService.ts 對齊：
 * - 相同 Gemini 參數（responseMimeType=json, temperature=0.1）
 * - 相同 feeding prompt 策略（雙圖模式）
 * - 相同 post-process（consumedRatio -> level）
 * - 相同 hysteresis（邊界緩衝）
 * - 相同 quality gate（base64 最小長度）
 *
 * 用法：
 *   cd app && node scripts/evaluate-feeding-accuracy.mjs
 *
 * 環境變數：
 *   EXPO_PUBLIC_GEMINI_API_KEY   必填
 *   GEMINI_AB_MODEL              預設 gemini-2.5-flash
 *   GT_CSV_PATH                  預設 ../scripts/fixtures/feeding_ground_truth.csv
 *   RUNS_PER_SAMPLE              每筆樣本推論次數（預設 20）
 *   PRINT_RUNS                   1=列出每次 run 結果
 *
 * CSV 欄位：
 *   id,empty_image,t0_image,t1_image,true_level,true_grams,t0_ref_grams,vessel_height_cm,notes
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');
const ROOT_DIR = join(APP_DIR, '..');

const LEVELS = ['almost_none', 'a_little', 'about_half', 'more_than_half', 'almost_all_eaten'];
const LEVEL_INDEX = Object.fromEntries(LEVELS.map((lv, idx) => [lv, idx]));
const MIN_BASE64_LENGTH = 8000;
const FEEDING_THRESHOLDS = [0.125, 0.375, 0.625, 0.825];
const FEEDING_HYSTERESIS_BUFFER = 0.05;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const out = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    out[k] = v;
  }
  return out;
}

const ENV = {
  ...loadEnvFile(join(APP_DIR, '.env')),
  ...loadEnvFile(join(APP_DIR, '.env.local')),
  ...process.env,
};

function parseCsv(content) {
  const lines = content
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function readImageBase64(filepath) {
  if (!existsSync(filepath)) throw new Error(`找不到圖片: ${filepath}`);
  return readFileSync(filepath).toString('base64');
}

function mimeFromPath(path) {
  const p = path.toLowerCase();
  if (p.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

function safeJsonParse(text) {
  const cleaned = String(text || '').replace(/```(json)?\n?/gi, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function validateImageQuality(base64) {
  return Boolean(base64 && base64.length >= MIN_BASE64_LENGTH);
}

function gramsByLevel(level, t0RefGrams) {
  const map = {
    almost_all_eaten: Math.round(0.9 * t0RefGrams),
    more_than_half: Math.round(0.75 * t0RefGrams),
    about_half: Math.round(0.5 * t0RefGrams),
    a_little: Math.round(0.25 * t0RefGrams),
    almost_none: 0,
  };
  return map[level] ?? map.about_half;
}

function inferConsumedRatio(parsed, t0RefGrams) {
  const direct = Number(parsed?.consumedRatio);
  if (Number.isFinite(direct)) return clamp(direct, 0, 1);

  const grams = Number(parsed?.totalGram);
  if (Number.isFinite(grams) && t0RefGrams > 0) return clamp(grams / t0RefGrams, 0, 1);

  const level = String(parsed?.consumptionLevel || '');
  const levelAnchor = {
    almost_none: 0,
    a_little: 0.25,
    about_half: 0.5,
    more_than_half: 0.75,
    almost_all_eaten: 0.9,
  };
  if (Object.prototype.hasOwnProperty.call(levelAnchor, level)) return levelAnchor[level];

  return 0.5;
}

function ratioToBaseLevel(ratio) {
  if (ratio < FEEDING_THRESHOLDS[0]) return 'almost_none';
  if (ratio < FEEDING_THRESHOLDS[1]) return 'a_little';
  if (ratio < FEEDING_THRESHOLDS[2]) return 'about_half';
  if (ratio < FEEDING_THRESHOLDS[3]) return 'more_than_half';
  return 'almost_all_eaten';
}

function applyFeedingHysteresis(stateMap, key, ratio, baseLevel) {
  const prev = stateMap.get(key);
  if (!prev) {
    stateMap.set(key, baseLevel);
    return baseLevel;
  }

  const nearBoundary = FEEDING_THRESHOLDS.some((threshold) => Math.abs(ratio - threshold) <= FEEDING_HYSTERESIS_BUFFER);
  if (!nearBoundary) {
    stateMap.set(key, baseLevel);
    return baseLevel;
  }

  const prevIdx = LEVEL_INDEX[prev] ?? 2;
  const baseIdx = LEVEL_INDEX[baseLevel] ?? 2;
  const chosen = Math.abs(prevIdx - baseIdx) <= 1 ? prev : baseLevel;
  stateMap.set(key, chosen);
  return chosen;
}

function buildFeedingHysteresisKey(t0Base64, t1Base64, t0RefGrams) {
  return `${t0Base64.slice(0, 64)}|${t1Base64.slice(0, 64)}|${Math.round(t0RefGrams)}`;
}

function buildPrompt(t0RefGrams, hasEmptyBowl, isShallowBowl) {
  const imageRolesSection = hasEmptyBowl
    ? `
## IMAGE ROLES（三張圖的定義）
You receive THREE images in order:
- [1] Empty bowl（空碗） = 0% food
- [2] T0 = 100% anchor for THIS meal
- [3] T1 = later state
Core question: relative to T0, how much is consumed?
`
    : `
## IMAGE ROLES（雙圖模式）
You receive TWO images in order:
- [1] T0 = 100% anchor for THIS meal
- [2] T1 = later state
Core question: relative to T0, how much is consumed?
`;

  const shallowBowlSection = isShallowBowl
    ? `
## SHALLOW BOWL RULE
For shallow bowls, focus on coverage, grain density, exposed bottom area.
`
    : '';

  return `
You are a production vision model for cat feeding analysis.
Return valid JSON only (no markdown, no extra text).
Task: compare T0 vs T1, estimate consumed ratio (continuous), then provide auxiliary classification.
${imageRolesSection}

## INPUT NORMALIZATION (MUST)
1. Detect bowl ROI and compare only ROI.
2. Normalize brightness/contrast between T0 and T1.
3. Ignore background/tilt differences outside ROI.

## PRE-CHECK
Q1: Is the bowl rim MORE visible in T1 than in T0?
Q2: Is the food coverage area SMALLER in T1 than in T0?
Q3: Is the food further from the bowl rim in T1 than in T0?
Q4: Is the grain density LOWER in T1 than in T0?
If ANY answer is YES, almost_none is forbidden.

## LEVELS
- almost_all_eaten => consumed ~90%
- more_than_half => consumed ~75%
- about_half => consumed ~50%
- a_little => consumed ~25%
- almost_none => consumed ~0% (only if all preCheck=false)

## GRAM CONVERSION（T0 reference = ${t0RefGrams}g）
- almost_all_eaten => round(0.90 * ${t0RefGrams})
- more_than_half => round(0.75 * ${t0RefGrams})
- about_half => round(0.50 * ${t0RefGrams})
- a_little => round(0.25 * ${t0RefGrams})
- almost_none => 0

## NEAR-ZERO RULE
If visible coverage change >= 5%, do NOT output almost_none.
${shallowBowlSection}

Return JSON:
{
  "preCheck": {"Q1": boolean, "Q2": boolean, "Q3": boolean, "Q4": boolean},
  "bowlsDetected": 1,
  "assignments": [{"bowlId": "bowl1", "tag": "Tag A", "estimatedIntakeGram": number}],
  "consumedRatio": number,
  "totalGram": number,
  "consumptionLevel": "almost_all_eaten" | "more_than_half" | "about_half" | "a_little" | "almost_none",
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "confidence": number,
  "estimatedErrorMargin": number
}
`;
}

function normalizeResult(parsed, t0RefGrams, stateMap, hysteresisKey) {
  const pre = parsed?.preCheck || {};
  const consumedRatio = inferConsumedRatio(parsed, t0RefGrams);
  const baseLevel = ratioToBaseLevel(consumedRatio);
  let level = applyFeedingHysteresis(stateMap, hysteresisKey, consumedRatio, baseLevel);

  const forbidAlmostNone = Boolean(pre.Q1 || pre.Q2 || pre.Q3 || pre.Q4);
  if (forbidAlmostNone && level === 'almost_none') level = 'a_little';

  return {
    level,
    grams: gramsByLevel(level, t0RefGrams),
    confidence: clamp(parsed?.confidence ?? 0.5, 0, 1),
    consumedRatio,
  };
}

function majority(list) {
  const m = {};
  list.forEach((v) => {
    m[v] = (m[v] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function median(values) {
  if (!values.length) return 0.5;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values) {
  if (!values.length) return 0.5;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calcMetrics(rows) {
  const valid = rows.filter((r) => r.trueLevel && r.pred?.level);
  const exact = valid.filter((r) => r.pred.level === r.trueLevel).length;
  const adjacent = valid.filter((r) => Math.abs((LEVEL_INDEX[r.pred.level] ?? 99) - (LEVEL_INDEX[r.trueLevel] ?? -99)) <= 1).length;
  const withGrams = valid.filter((r) => Number.isFinite(r.trueGrams));
  const mae = withGrams.length
    ? withGrams.reduce((sum, r) => sum + Math.abs(r.pred.grams - r.trueGrams), 0) / withGrams.length
    : null;

  return {
    samples: valid.length,
    exactAccuracy: valid.length ? exact / valid.length : 0,
    adjacentAccuracy: valid.length ? adjacent / valid.length : 0,
    mae,
  };
}

async function inferOnce(
  model,
  prompt,
  emptyBase64,
  emptyMime,
  t0Base64,
  t1Base64,
  t0Mime,
  t1Mime,
  t0RefGrams,
  stateMap,
  hysteresisKey
) {
  const parts = [];
  if (emptyBase64) {
    parts.push({ inlineData: { data: emptyBase64, mimeType: emptyMime || 'image/jpeg' } });
  }
  parts.push(
    { inlineData: { data: t0Base64, mimeType: t0Mime } },
    { inlineData: { data: t1Base64, mimeType: t1Mime } }
  );
  const resp = await model.generateContent([prompt, ...parts]);
  const parsed = safeJsonParse(resp.response.text());
  return normalizeResult(parsed, t0RefGrams, stateMap, hysteresisKey);
}

async function inferWithMedianRatio(
  model,
  prompt,
  emptyBase64,
  emptyMime,
  t0Base64,
  t1Base64,
  t0Mime,
  t1Mime,
  t0RefGrams,
  stateMap,
  hysteresisKey
) {
  const [r1, r2, r3] = await Promise.all([
    inferOnce(model, prompt, emptyBase64, emptyMime, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams, stateMap, hysteresisKey),
    inferOnce(model, prompt, emptyBase64, emptyMime, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams, stateMap, hysteresisKey),
    inferOnce(model, prompt, emptyBase64, emptyMime, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams, stateMap, hysteresisKey),
  ]);

  const ratios = [r1.consumedRatio, r2.consumedRatio, r3.consumedRatio];
  const spread = Math.max(...ratios) - Math.min(...ratios);
  const robustRatio = spread >= 0.35 ? mean(ratios) : median(ratios);
  const medianRatio = clamp(robustRatio, 0, 1);
  const baseLevel = ratioToBaseLevel(medianRatio);
  let level = applyFeedingHysteresis(stateMap, hysteresisKey, medianRatio, baseLevel);

  // 任何單次推論判定 forbid almost_none 都套用保護
  const anySuggestEat = [r1, r2, r3].some((x) => x.level !== 'almost_none');
  if (anySuggestEat && level === 'almost_none') level = 'a_little';

  return {
    level,
    grams: gramsByLevel(level, t0RefGrams),
    confidence: clamp((r1.confidence + r2.confidence + r3.confidence) / 3, 0, 1),
    consumedRatio: medianRatio,
  };
}

async function main() {
  const apiKey = ENV.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('缺少 EXPO_PUBLIC_GEMINI_API_KEY');

  const modelName = ENV.GEMINI_AB_MODEL || 'gemini-2.5-flash';
  const csvPath = ENV.GT_CSV_PATH || join(ROOT_DIR, 'scripts', 'fixtures', 'feeding_ground_truth.csv');
  const runsPerSample = Number.parseInt(ENV.RUNS_PER_SAMPLE || '20', 10);
  const printRuns = String(ENV.PRINT_RUNS || '') === '1';

  if (!existsSync(csvPath)) throw new Error(`找不到 ground-truth CSV: ${csvPath}`);
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'));

  const samples = rows
    .map((r) => {
      const trueLevel = String(r.true_level || '').trim();
      if (!Object.prototype.hasOwnProperty.call(LEVEL_INDEX, trueLevel)) return null;
      return {
        id: String(r.id || ''),
        emptyImage: String(r.empty_image || ENV.EMPTY_IMAGE || 'empty.JPG'),
        t0Image: String(r.t0_image || ''),
        t1Image: String(r.t1_image || ''),
        trueLevel,
        trueGrams: r.true_grams ? Number(r.true_grams) : NaN,
        t0RefGrams: r.t0_ref_grams ? Number(r.t0_ref_grams) : Number(ENV.T0_REF_GRAMS || 90),
        vesselHeightCm: r.vessel_height_cm ? Number(r.vessel_height_cm) : null,
      };
    })
    .filter(Boolean);

  if (samples.length === 0) throw new Error('CSV 沒有有效樣本（true_level 必須是 5 分位之一）');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  console.log('=== Feeding Accuracy Evaluation (App Logic) ===');
  console.log(`model=${modelName}`);
  console.log(`csv=${csvPath}`);
  console.log(`samples=${samples.length}, runsPerSample=${runsPerSample}`);

  const evalRows = [];

  for (const s of samples) {
    const t0Path = join(ROOT_DIR, 'scripts', 'fixtures', s.t0Image);
    const t1Path = join(ROOT_DIR, 'scripts', 'fixtures', s.t1Image);
    const emptyPath = s.emptyImage ? join(ROOT_DIR, 'scripts', 'fixtures', s.emptyImage) : '';
    const t0Base64 = readImageBase64(t0Path);
    const t1Base64 = readImageBase64(t1Path);
    const emptyBase64 = emptyPath && existsSync(emptyPath) ? readImageBase64(emptyPath) : null;

    if (!validateImageQuality(t0Base64) || !validateImageQuality(t1Base64)) {
      throw new Error(`樣本 ${s.id} 圖片品質未通過（base64 太小）`);
    }
    if (emptyBase64 && !validateImageQuality(emptyBase64)) {
      throw new Error(`樣本 ${s.id} empty 圖片品質未通過（base64 太小）`);
    }

    const hasEmptyBowl = Boolean(emptyBase64);
    const isShallowBowl = Number.isFinite(s.vesselHeightCm) && s.vesselHeightCm < 5;
    const prompt = buildPrompt(s.t0RefGrams, hasEmptyBowl, isShallowBowl);
    const emptyMime = emptyBase64 ? mimeFromPath(emptyPath) : 'image/jpeg';
    const t0Mime = mimeFromPath(t0Path);
    const t1Mime = mimeFromPath(t1Path);
    const hysteresisKey = buildFeedingHysteresisKey(t0Base64, t1Base64, s.t0RefGrams);
    const localHysteresisState = new Map();

    const perRuns = [];
    for (let i = 0; i < runsPerSample; i += 1) {
      const pred = await inferWithMedianRatio(
        model,
        prompt,
        emptyBase64,
        emptyMime,
        t0Base64,
        t1Base64,
        t0Mime,
        t1Mime,
        s.t0RefGrams,
        localHysteresisState,
        hysteresisKey
      );
      perRuns.push(pred);
      if (printRuns) {
        console.log(`  run ${String(i + 1).padStart(2, '0')} | level=${pred.level}(${pred.grams}g,c=${pred.confidence.toFixed(2)},r=${pred.consumedRatio.toFixed(3)})`);
      }
    }

    const majorityLevel = majority(perRuns.map((x) => x.level));
    const picked = perRuns.find((x) => x.level === majorityLevel) || perRuns[0];

    evalRows.push({
      id: s.id,
      trueLevel: s.trueLevel,
      trueGrams: s.trueGrams,
      pred: picked,
    });

    console.log(`sample=${s.id} true=${s.trueLevel} | pred=${picked.level}(${picked.grams}g)`);
  }

  const m = calcMetrics(evalRows);
  console.log('\n--- Metrics ---');
  console.log(`exactAccuracy=${m.exactAccuracy.toFixed(3)}, adjacentAccuracy=${m.adjacentAccuracy.toFixed(3)}${m.mae != null ? `, MAE=${m.mae.toFixed(2)}g` : ''}`);
}

main().catch((err) => {
  console.error('[evaluate-feeding-accuracy] failed:', err.message || err);
  process.exit(1);
});
