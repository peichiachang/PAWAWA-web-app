#!/usr/bin/env node
/**
 * Prompt A/B 測試（Feeding）
 *
 * 比較同一組 T0/T1 圖片在 Prompt v1 與 Prompt v2 下的穩定性與輸出差異。
 *
 * 用法：
 *   cd app && node scripts/test-prompt-ab.mjs [runs]
 *
 * 環境變數：
 *   EXPO_PUBLIC_GEMINI_API_KEY  Gemini API Key（必要）
 *   GEMINI_AB_MODEL             測試模型（預設 gemini-2.5-flash）
 *   T0_REF_GRAMS                直接指定 T0 參考克數（優先）
 *   VESSEL_VOLUME_ML            若未指定 T0_REF_GRAMS，以此推估克數（預設 250ml）
 *   AB_T0_IMAGE                 fixtures 內檔名（預設 t0）
 *   AB_T1_IMAGE                 fixtures 內檔名（預設 t1）
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');
const FIXTURES_DIR = join(APP_DIR, '..', 'scripts', 'fixtures');

const VALID_LEVELS = ['almost_all_eaten', 'more_than_half', 'about_half', 'a_little', 'almost_none'];

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
  }
  return vars;
}

const envVars = {
  ...loadEnvFile(join(APP_DIR, '.env')),
  ...loadEnvFile(join(APP_DIR, '.env.local')),
  ...process.env,
};

function findFixtureBase(baseName) {
  const candidates = ['.jpg', '.jpeg', '.png'].map((ext) => join(FIXTURES_DIR, `${baseName}${ext}`));
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(`找不到圖片 ${baseName}（支援 .jpg/.jpeg/.png）：${FIXTURES_DIR}`);
  }
  return hit;
}

function mimeFromPath(filepath) {
  const p = filepath.toLowerCase();
  if (p.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

function fileToBase64(filepath) {
  return readFileSync(filepath).toString('base64');
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

function normalizeFeeding(parsed, t0RefGrams) {
  const pre = parsed?.preCheck || {};
  const almostNoneForbidden = Boolean(pre.Q1 || pre.Q2 || pre.Q3 || pre.Q4);

  let level = VALID_LEVELS.includes(parsed?.consumptionLevel)
    ? parsed.consumptionLevel
    : 'about_half';

  if (almostNoneForbidden && level === 'almost_none') {
    level = 'a_little';
  }

  const totalGram = gramsByLevel(level, t0RefGrams);
  const confidence = clamp(parsed?.confidence ?? 0.5, 0, 1);

  return {
    consumptionLevel: level,
    totalGram,
    confidence,
    isBowlMatch: Boolean(parsed?.isBowlMatch ?? true),
    mismatchReason: parsed?.isBowlMatch === false ? String(parsed?.mismatchReason || 'Bowl mismatch') : '',
    preCheck: {
      Q1: Boolean(pre.Q1),
      Q2: Boolean(pre.Q2),
      Q3: Boolean(pre.Q3),
      Q4: Boolean(pre.Q4),
    },
  };
}

function buildPromptV1(t0RefGrams) {
  return `
You are an expert feline nutrition assistant. Your task is RELATIVE COMPARISON only — do NOT output precise numbers.

## IMAGE ROLES（雙圖模式）

You receive TWO images in order:
- [1] T0 = The state immediately after feeding this meal. This is the 100% anchor for THIS meal.
- [2] T1 = The state after some time has passed.

Core question: "Relative to T0 (this meal's starting point), how much food remains in T1?"

## STEP 1 — PRE-CHECK（必須最先執行，不可跳過）

Before any judgment, answer the following YES or NO by comparing T1 against T0:

Q1: Is the white bowl rim MORE visible in T1 than in T0?
Q2: Is the food coverage area SMALLER in T1 than in T0?
Q3: Is the food further from the bowl rim in T1 than in T0?
Q4: Is the grain density LOWER in T1 than in T0?

If ANY answer is YES → "almost_none" is FORBIDDEN for this entire session.
You must choose from: a_little / about_half / more_than_half / almost_all_eaten only.

If ALL answers are NO → proceed normally, "almost_none" remains available.

Include PRE-CHECK answers in your output as "preCheck": { "Q1": boolean, "Q2": boolean, "Q3": boolean, "Q4": boolean }.

## STEP 2 — PROCEDURE

1. Identify the bowl's material, color, and texture from T0.
2. Use T0 as the 100% anchor for this meal — regardless of how full it looks relative to the bowl's capacity.
3. Judge T1's remaining food relative to T0 (not relative to bowl capacity).
4. Pick the single consumptionLevel that best describes T1. Do not round up or down — choose the level that most accurately reflects what you see.

## STEP 3 — OUTPUT: consumptionLevel（5 分位）

- "almost_all_eaten"  → 剩約 0~10%，消耗約 90%，幾乎全吃完
- "more_than_half"    → 剩約 25%，消耗約 75%，吃了大部分
- "about_half"        → 剩約 50%，消耗約 50%，吃了一半
- "a_little"          → 剩約 75%，消耗約 25%，只吃了一點
- "almost_none"       → 剩約 100%，消耗約 0%，幾乎沒有動過（僅當 PRE-CHECK 全為 NO 時可用）

## GRAM CONVERSION（T0 reference = ${t0RefGrams}g）

- "almost_all_eaten" → round(0.90 × ${t0RefGrams})
- "more_than_half"   → round(0.75 × ${t0RefGrams})
- "about_half"       → round(0.50 × ${t0RefGrams})
- "a_little"         → round(0.25 × ${t0RefGrams})
- "almost_none"      → 0

Return JSON:
{
  "preCheck": { "Q1": boolean, "Q2": boolean, "Q3": boolean, "Q4": boolean },
  "bowlsDetected": 1,
  "assignments": [{"bowlId": "bowl1", "tag": "Tag A", "estimatedIntakeGram": number}],
  "totalGram": number,
  "consumptionLevel": "almost_all_eaten" | "more_than_half" | "about_half" | "a_little" | "almost_none",
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "confidence": number (0.0-1.0),
  "estimatedErrorMargin": number (0.08-0.20)
}
`;
}

function buildPromptV2(t0RefGrams) {
  return `
You are a production vision model for cat feeding analysis.
Return valid JSON only (no markdown, no extra text).
Task: compare T0 vs T1 and classify intake level, then map to grams using fixed mapping.

## IMAGE ROLES（雙圖模式）
You receive TWO images in order:
- [1] T0 = The state immediately after feeding this meal. This is the 100% anchor for THIS meal.
- [2] T1 = The state after some time has passed.

## STEP 1 — PRE-CHECK（必須最先執行）
Q1: Is the bowl rim MORE visible in T1 than in T0?
Q2: Is the food coverage area SMALLER in T1 than in T0?
Q3: Is the food further from the bowl rim in T1 than in T0?
Q4: Is the grain density LOWER in T1 than in T0?

If ANY answer is YES, almost_none is forbidden.

## STEP 2 — PROCEDURE
1. Use T0 as 100% anchor.
2. Judge T1 remaining relative to T0.
3. Pick one and only one consumptionLevel.

## STEP 3 — consumptionLevel
- almost_all_eaten => consumed ~90%
- more_than_half   => consumed ~75%
- about_half       => consumed ~50%
- a_little         => consumed ~25%
- almost_none      => consumed ~0% (only when all preCheck=false)

## GRAM CONVERSION（T0 reference = ${t0RefGrams}g）
- almost_all_eaten => round(0.90 * ${t0RefGrams})
- more_than_half   => round(0.75 * ${t0RefGrams})
- about_half       => round(0.50 * ${t0RefGrams})
- a_little         => round(0.25 * ${t0RefGrams})
- almost_none      => 0

## NEAR-ZERO RULE
If visible coverage change >= 5%, do NOT output almost_none.

Return JSON:
{
  "preCheck": { "Q1": boolean, "Q2": boolean, "Q3": boolean, "Q4": boolean },
  "bowlsDetected": 1,
  "assignments": [{"bowlId": "bowl1", "tag": "Tag A", "estimatedIntakeGram": number}],
  "totalGram": number,
  "consumptionLevel": "almost_all_eaten" | "more_than_half" | "about_half" | "a_little" | "almost_none",
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "confidence": number,
  "estimatedErrorMargin": number
}
`;
}

async function runOne(model, prompt, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams) {
  const parts = [
    { inlineData: { data: t0Base64, mimeType: t0Mime } },
    { inlineData: { data: t1Base64, mimeType: t1Mime } },
  ];
  const result = await model.generateContent([prompt, ...parts]);
  const text = result.response.text();
  const parsed = safeJsonParse(text);
  return normalizeFeeding(parsed, t0RefGrams);
}

function summarize(label, rows) {
  const dist = {};
  let confSum = 0;
  let gramSum = 0;
  rows.forEach((r) => {
    dist[r.consumptionLevel] = (dist[r.consumptionLevel] || 0) + 1;
    confSum += r.confidence;
    gramSum += r.totalGram;
  });
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const top = entries[0] || ['(none)', 0];
  const consistency = rows.length ? Number((top[1] / rows.length).toFixed(3)) : 0;
  return {
    label,
    runs: rows.length,
    distribution: dist,
    majorityLevel: top[0],
    consistency,
    avgConfidence: rows.length ? Number((confSum / rows.length).toFixed(3)) : 0,
    avgGrams: rows.length ? Number((gramSum / rows.length).toFixed(1)) : 0,
  };
}

function printSummary(summary) {
  console.log(`\n[${summary.label}]`);
  console.log(`runs=${summary.runs}, majority=${summary.majorityLevel}, consistency=${summary.consistency}`);
  console.log(`avgConfidence=${summary.avgConfidence}, avgGrams=${summary.avgGrams}`);
  console.log('distribution=', summary.distribution);
}

async function main() {
  const runs = Number.parseInt(process.argv[2] || '10', 10);
  if (!Number.isFinite(runs) || runs <= 0) {
    throw new Error('runs 必須是正整數');
  }

  const apiKey = envVars.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 EXPO_PUBLIC_GEMINI_API_KEY');
  }

  const modelName = envVars.GEMINI_AB_MODEL || 'gemini-2.5-flash';
  const t0BaseName = envVars.AB_T0_IMAGE || 't0';
  const t1BaseName = envVars.AB_T1_IMAGE || 't1';

  const t0Path = findFixtureBase(t0BaseName);
  const t1Path = findFixtureBase(t1BaseName);
  const t0Mime = mimeFromPath(t0Path);
  const t1Mime = mimeFromPath(t1Path);
  const t0Base64 = fileToBase64(t0Path);
  const t1Base64 = fileToBase64(t1Path);

  const t0RefGrams = envVars.T0_REF_GRAMS
    ? Number(envVars.T0_REF_GRAMS)
    : Number(envVars.VESSEL_VOLUME_ML || 250) * 0.8 * 0.45;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const v1Prompt = buildPromptV1(t0RefGrams);
  const v2Prompt = buildPromptV2(t0RefGrams);

  console.log('=== Prompt A/B Test (Feeding) ===');
  console.log(`model=${modelName}`);
  console.log(`runs=${runs}`);
  console.log(`t0=${t0Path}`);
  console.log(`t1=${t1Path}`);
  console.log(`t0RefGrams=${t0RefGrams}`);

  const v1Rows = [];
  const v2Rows = [];
  let disagreeCount = 0;

  for (let i = 0; i < runs; i += 1) {
    const [a, b] = await Promise.all([
      runOne(model, v1Prompt, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams),
      runOne(model, v2Prompt, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams),
    ]);

    v1Rows.push(a);
    v2Rows.push(b);
    const disagree = a.consumptionLevel !== b.consumptionLevel;
    if (disagree) disagreeCount += 1;

    console.log(
      `run ${String(i + 1).padStart(2, '0')} | v1=${a.consumptionLevel.padEnd(16)}(${String(a.totalGram).padStart(4)}g, c=${a.confidence.toFixed(2)})` +
      ` | v2=${b.consumptionLevel.padEnd(16)}(${String(b.totalGram).padStart(4)}g, c=${b.confidence.toFixed(2)})` +
      `${disagree ? ' | DIFF' : ''}`
    );
  }

  const s1 = summarize('Prompt v1', v1Rows);
  const s2 = summarize('Prompt v2', v2Rows);
  printSummary(s1);
  printSummary(s2);

  const disagreementRate = Number((disagreeCount / runs).toFixed(3));
  console.log(`\nCross-prompt disagreement rate=${disagreementRate} (${disagreeCount}/${runs})`);

  const better = s2.consistency > s1.consistency
    ? 'v2'
    : s2.consistency < s1.consistency
      ? 'v1'
      : 'tie';
  console.log(`stability_winner=${better}`);
}

main().catch((error) => {
  console.error('[prompt-ab] failed:', error.message || error);
  process.exit(1);
});
