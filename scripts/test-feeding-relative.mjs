#!/usr/bin/env node
/**
 * 飲食辨識相對比較實測腳本
 *
 * 用法：
 *   1. 將 T0、T1 照片放入 scripts/fixtures/ 並命名為 t0.jpg、t1.jpg
 *   2. 設定環境變數 EXPO_PUBLIC_GEMINI_API_KEY（或從 app/.env 載入）
 *   3. 執行：cd app && node ../scripts/test-feeding-relative.mjs [次數]
 *
 * 範例：node ../scripts/test-feeding-relative.mjs 20
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIXTURES = join(ROOT, 'scripts', 'fixtures');

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
  return jpg; // 用於錯誤訊息
}

function getMimeType(filepath) {
  return filepath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

function safeJsonParse(text) {
  const cleaned = text.replace(/```(json)?\n?/gi, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function analyzeFeeding(genAI, t0Base64, t1Base64, t0Mime, t1Mime, vesselVolumeMl = 500, vesselName = 'Test Bowl') {
  const t0RefGrams = vesselVolumeMl * 0.8 * 0.45;
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `
You are an expert feline nutrition assistant. Your task is RELATIVE COMPARISON only — do NOT output precise numbers.

## CORE TASK (DISCRETE LEVELS ONLY — 五分位)
Compare the two images side by side and classify into ONE of five levels:
**「T1 相對於 T0，食物剩餘程度屬於哪一級？」**

Output "consumptionLevel" — exactly one of:
- "almost_all_eaten"  → 幾乎全吃完（T1 剩約 0–20%）
- "more_than_half"    → 吃了一大半（T1 剩約 20–40%）
- "about_half"        → 吃了一半（T1 剩約 40–60%）
- "a_little"          → 吃了一點（T1 剩約 60–80%）
- "almost_none"       → 幾乎沒吃（T1 剩約 80–100%，與 T0 幾乎相同）

Do NOT output 0.73, 0.45, etc. — only the discrete level.

## PROCEDURE (NO ABSOLUTE ESTIMATION)
1. Visually align the same bowl in both images (same rim, same inner wall reference).
2. Compare food surface in T1 vs T0.
3. Choose the single level that best fits the relative difference.
4. When uncertain between two levels, prefer the more conservative (closer to "almost_none").

## NEAR-ZERO RULE
- If T0 and T1 look essentially the same (same shot, re-shot, or no eating), use "almost_none" and householdTotalGram = 0.
- If the visible difference could be lighting/angle/reflection, use "almost_none" and lower confidence.

## GRAM CONVERSION (use level midpoint, T0 reference = ${t0RefGrams}g)
- "almost_all_eaten" → householdTotalGram = round(0.90 × ${t0RefGrams})
- "more_than_half"   → householdTotalGram = round(0.70 × ${t0RefGrams})
- "about_half"       → householdTotalGram = round(0.50 × ${t0RefGrams})
- "a_little"         → householdTotalGram = round(0.30 × ${t0RefGrams})
- "almost_none"      → householdTotalGram = 0
- assignments[0].estimatedIntakeGram = householdTotalGram (single bowl)

## BOWL MATCHING
- Verify bowl in T1 matches T0 (${vesselName}). If different, isBowlMatch=false.

Return JSON:
{
  "bowlsDetected": 1,
  "assignments": [{"bowlId": "bowl1", "tag": "Tag A", "estimatedIntakeGram": number}],
  "householdTotalGram": number,
  "consumptionLevel": "almost_all_eaten" | "more_than_half" | "about_half" | "a_little" | "almost_none",
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "confidence": number (0.0-1.0),
  "estimatedErrorMargin": number (0.08-0.20)
}
`;

  const imageParts = [
    { inlineData: { data: t0Base64, mimeType: t0Mime } },
    { inlineData: { data: t1Base64, mimeType: t1Mime } },
  ];

  const result = await model.generateContent([prompt, ...imageParts]);
  const text = result.response.text();
  return safeJsonParse(text);
}

function stats(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return { mean, std, min: Math.min(...arr), max: Math.max(...arr), n };
}

async function main() {
  const runs = parseInt(process.argv[2] || '20', 10);
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('請設定環境變數 EXPO_PUBLIC_GEMINI_API_KEY');
    console.error('例如：EXPO_PUBLIC_GEMINI_API_KEY=xxx node ../scripts/test-feeding-relative.mjs 20');
    process.exit(1);
  }

  const t0Path = findImage('t0');
  const t1Path = findImage('t1');
  const t0Base64 = loadImageBase64(t0Path);
  const t1Base64 = loadImageBase64(t1Path);

  const genAI = new GoogleGenerativeAI(apiKey);
  const vesselVolumeMl = parseInt(process.env.VESSEL_VOLUME_ML || '500', 10);

  console.log('=== 飲食辨識相對比較實測 ===\n');
  console.log(`情境：T0=${t0Path}, T1=${t1Path}`);
  console.log(`碗體積：${vesselVolumeMl} ml`);
  console.log(`執行次數：${runs}\n`);

  const results = [];
  const confidences = [];

  const t0Mime = getMimeType(t0Path);
  const t1Mime = getMimeType(t1Path);

  for (let i = 0; i < runs; i++) {
    try {
      const r = await analyzeFeeding(genAI, t0Base64, t1Base64, t0Mime, t1Mime, vesselVolumeMl);
      results.push(r.householdTotalGram);
      confidences.push(r.confidence ?? 0);
      const level = r.consumptionLevel || '—';
      console.log(`  Run ${String(i + 1).padStart(2)}: ${r.householdTotalGram}g (${level}), confidence ${(r.confidence ?? 0).toFixed(2)}`);
    } catch (err) {
      console.error(`  Run ${i + 1}: 失敗 -`, err.message);
    }
  }

  if (results.length === 0) {
    console.error('\n無有效結果');
    process.exit(1);
  }

  const s = stats(results);
  const cConf = stats(confidences);

  console.log('\n--- 克數統計 ---');
  console.log(`  平均：${s.mean.toFixed(1)} g`);
  console.log(`  標準差：${s.std.toFixed(1)} g`);
  console.log(`  最小：${s.min} g`);
  console.log(`  最大：${s.max} g`);
  console.log(`  有效次數：${s.n}/${runs}`);
  console.log('\n--- 信心度統計 ---');
  console.log(`  平均：${(cConf.mean * 100).toFixed(1)}%`);
  console.log(`  標準差：${(cConf.std * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
