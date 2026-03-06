#!/usr/bin/env node
/**
 * consumptionLevel 一致性驗證測試
 *
 * 用同一組 T0、T1 照片跑 N 次，檢查 consumptionLevel 是否每次都落在同一個分位。
 *
 * 用法：
 *   1. 將 T0、T1 照片放入 scripts/fixtures/ 並命名為 t0.jpg、t1.jpg（或 t0.png、t1.png）
 *   2. 設定環境變數 EXPO_PUBLIC_GEMINI_API_KEY（或從 app/.env 載入）
 *   3. 執行：cd app && node scripts/test-consumption-level-consistency.mjs [次數]
 *
 * 環境變數：
 *   T0_REF_GRAMS   - 直接指定 T0 參考克數（優先，用於手動測重）
 *   VESSEL_VOLUME_ML - 容器體積 ml，未設 T0_REF_GRAMS 時用於推算（預設 250）
 *
 * 範例：
 *   node scripts/test-consumption-level-consistency.mjs 10
 *   T0_REF_GRAMS=63 node scripts/test-consumption-level-consistency.mjs 10
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');
const FIXTURES = join(APP_DIR, '..', 'scripts', 'fixtures');

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
};

function loadImageBase64(filepath) {
  if (!existsSync(filepath)) {
    throw new Error(`找不到圖片：${filepath}\n請將 T0、T1 照片放入 scripts/fixtures/ 並命名為 t0.jpg、t1.jpg（或 t0.png、t1.png）`);
  }
  const buf = readFileSync(filepath);
  return buf.toString('base64');
}

function findImage(base) {
  const jpg = join(FIXTURES, `${base}.jpg`);
  const png = join(FIXTURES, `${base}.png`);
  if (existsSync(jpg)) return jpg;
  if (existsSync(png)) return png;
  return jpg;
}

function getMimeType(filepath) {
  return filepath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

function safeJsonParse(text) {
  const cleaned = text.replace(/```(json)?\n?/gi, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * 使用與 geminiService.ts 相同的 prompt（雙圖模式、含 PRE-CHECK）
 */
function buildFeedingPrompt(t0RefGrams) {
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

## MATERIAL / TEXTURE SEGMENTATION（材質分離）

Before judging remaining amount, mentally separate bowl from food:
- Bowl（碗）: Smooth, uniform surface, consistent color, geometric edges
- Food（飼料）: Granular texture, grain pattern, irregular surface

Use T0 to identify bowl material. Ignore bowl texture when judging food coverage.

## NEAR-ZERO RULE

"almost_none" means T1 looks virtually identical to T0 — the cat has not eaten at all.
If the visible food coverage difference between T0 and T1 is less than 5% AND PRE-CHECK is all NO → output "almost_none", totalGram = 0.
This is the ONLY condition under which "almost_none" is allowed.

## BOWL MATCHING

Compare bowl shape and color across all images. If shape OR color differs significantly → set isBowlMatch = false.

Return JSON:
{
  "preCheck": {
    "Q1": boolean,
    "Q2": boolean,
    "Q3": boolean,
    "Q4": boolean
  },
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

async function runFeedingAnalysis(genAI, prompt, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });

  const imageParts = [
    { inlineData: { data: t0Base64, mimeType: t0Mime } },
    { inlineData: { data: t1Base64, mimeType: t1Mime } },
  ];

  const result = await model.generateContent([prompt, ...imageParts]);
  const text = result.response.text();
  const parsed = safeJsonParse(text);

  // 安全網：若 PRE-CHECK 任一為 true（Q1||Q2||Q3||Q4），almost_none 不可用；若 AI 仍輸出 almost_none，強制改為 a_little
  const almostNoneForbidden = parsed.preCheck && (parsed.preCheck.Q1 || parsed.preCheck.Q2 || parsed.preCheck.Q3 || parsed.preCheck.Q4);
  if (almostNoneForbidden && parsed.consumptionLevel === 'almost_none') {
    parsed.consumptionLevel = 'a_little';
    parsed.totalGram = Math.round(0.25 * t0RefGrams);
    if (Array.isArray(parsed.assignments) && parsed.assignments[0]) {
      parsed.assignments[0].estimatedIntakeGram = parsed.totalGram;
    }
  }
  return parsed;
}

async function main() {
  const runs = parseInt(process.argv[2] || '10', 10);
  const apiKey = envVars.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('請設定環境變數 EXPO_PUBLIC_GEMINI_API_KEY');
    console.error('例如：EXPO_PUBLIC_GEMINI_API_KEY=xxx node scripts/test-consumption-level-consistency.mjs 10');
    process.exit(1);
  }

  const t0Path = findImage('t0');
  const t1Path = findImage('t1');
  const t0Base64 = loadImageBase64(t0Path);
  const t1Base64 = loadImageBase64(t1Path);
  const t0Mime = getMimeType(t0Path);
  const t1Mime = getMimeType(t1Path);

  const t0RefGrams = process.env.T0_REF_GRAMS
    ? parseFloat(process.env.T0_REF_GRAMS)
    : parseInt(process.env.VESSEL_VOLUME_ML || '250', 10) * 0.8 * 0.45;
  const prompt = buildFeedingPrompt(t0RefGrams);

  const genAI = new GoogleGenerativeAI(apiKey);

  console.log('=== consumptionLevel 一致性驗證測試 ===\n');
  console.log(`圖片：T0=${t0Path}, T1=${t1Path}`);
  console.log(`執行次數：${runs}`);
  console.log(`T0 參考克數：${t0RefGrams}g${process.env.T0_REF_GRAMS ? ' (T0_REF_GRAMS)' : ''}\n`);

  const levels = [];
  const results = [];

  for (let i = 0; i < runs; i++) {
    try {
      const r = await runFeedingAnalysis(genAI, prompt, t0Base64, t1Base64, t0Mime, t1Mime, t0RefGrams);
      const level = r.consumptionLevel || '(missing)';
      levels.push(level);
      results.push(r);
      const valid = VALID_LEVELS.includes(level) ? '' : ' ⚠️ 非預期值';
      console.log(`  Run ${String(i + 1).padStart(2)}: consumptionLevel = "${level}" (${r.totalGram}g, conf ${(r.confidence ?? 0).toFixed(2)})${valid}`);
    } catch (err) {
      console.error(`  Run ${i + 1}: 失敗 -`, err.message);
      levels.push('(error)');
    }
  }

  const validLevels = levels.filter(l => VALID_LEVELS.includes(l));
  const uniqueLevels = [...new Set(validLevels)];

  console.log('\n--- 結果摘要 ---');
  console.log(`  有效結果：${validLevels.length}/${runs}`);
  console.log(`  出現的分位：${uniqueLevels.join(', ') || '(無)'}`);

  if (uniqueLevels.length === 1 && validLevels.length === runs) {
    console.log(`\n✅ PASS：${runs} 次皆輸出相同 consumptionLevel = "${uniqueLevels[0]}"`);
    process.exit(0);
  } else if (uniqueLevels.length > 1) {
    const dist = {};
    validLevels.forEach(l => { dist[l] = (dist[l] || 0) + 1; });
    console.log('\n❌ FAIL：consumptionLevel 不一致');
    console.log('  分布：', dist);
    process.exit(1);
  } else {
    console.log('\n⚠️ 無法判定（有失敗或非預期輸出）');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
