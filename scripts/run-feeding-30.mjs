#!/usr/bin/env node
/**
 * 使用指定 T0 / T1 圖片對 feeding 邏輯連續執行 30 次，輸出每次結果（與 production 相同 prompt + t0RefGrams）
 *
 * 使用方式:
 *   從專案根目錄（PAWAWA-web-app）:
 *     npm run test:feeding-30
 *   或進入 app 後執行:
 *     cd <專案根目錄>/app && node scripts/run-feeding-30.mjs [T0路徑] [T1路徑]
 *   若不帶參數則使用 app/scripts/fixtures/T0.png、T1.png
 *
 * 環境變數:
 *   RUNS=30  執行次數（預設 30）
 *   T0_REF_GRAMS  滿碗參考克數（預設 90）；若碗實際約 250g 可設 T0_REF_GRAMS=250
 *   需設定 GEMINI_API_KEY（可放在 app/.env 或 app/.env.local）
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 載入 app/.env 與 app/.env.local（供 GEMINI_API_KEY）
for (const name of ['.env', '.env.local']) {
  const p = join(ROOT, name);
  if (existsSync(p)) {
    const content = readFileSync(p, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq > 0) {
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!(key in process.env)) process.env[key] = val;
      }
    }
  }
}
const DEFAULT_T0 = join(ROOT, 'scripts', 'fixtures', 'T0.png');
const DEFAULT_T1 = join(ROOT, 'scripts', 'fixtures', 'T1.png');

const RUNS = Math.max(1, parseInt(process.env.RUNS || '30', 10));

function toBase64(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  const buf = readFileSync(path);
  return buf.toString('base64');
}

function getMime(path) {
  const lower = (path || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

const T0_REF_GRAMS_ENV = process.env.T0_REF_GRAMS != null && process.env.T0_REF_GRAMS !== '' ? parseInt(process.env.T0_REF_GRAMS, 10) : null;
const T0_REF_GRAMS = (T0_REF_GRAMS_ENV != null && T0_REF_GRAMS_ENV > 0) ? T0_REF_GRAMS_ENV : 90;

/** 直接呼叫 app/api/_lib/ai 的 feeding 邏輯（與 production 一致） */
async function runFeedingDirect(t0Path, t1Path) {
  const body = {
    t0ImageRef: t0Path,
    t0ImageBase64: toBase64(t0Path),
    t0MimeType: getMime(t0Path),
    t1ImageRef: t1Path,
    t1ImageBase64: toBase64(t1Path),
    t1MimeType: getMime(t1Path),
    volumeMl: 250,
    t0RefGrams: T0_REF_GRAMS,
  };
  const { createAiRouteHandler } = require(join(ROOT, 'api', '_lib', 'ai.js'));
  const handler = createAiRouteHandler('feeding');
  let result = null;
  const res = {
    setHeader: () => {},
    writeHead: () => {},
    end: (data) => { result = JSON.parse(data); },
  };
  const req = { method: 'POST', body };
  await handler(req, res);
  return result;
}

function main() {
  const t0Path = process.argv[2] || DEFAULT_T0;
  const t1Path = process.argv[3] || DEFAULT_T1;

  if (!existsSync(t0Path)) {
    console.error('T0 圖片不存在:', t0Path);
    console.error('用法: node scripts/run-feeding-30.mjs <T0路徑> <T1路徑>');
    console.error('或將 T0.png、T1.png 放到 app/scripts/fixtures/ 後不帶參數執行');
    process.exit(1);
  }
  if (!existsSync(t1Path)) {
    console.error('T1 圖片不存在:', t1Path);
    process.exit(1);
  }

  console.log('T0:', t0Path);
  console.log('T1:', t1Path);
  console.log('次數:', RUNS, `(t0RefGrams=${T0_REF_GRAMS}, volumeMl=250)`);
  console.log('---\n');

  (async () => {
    const results = [];
    for (let i = 0; i < RUNS; i++) {
      try {
        const r = await runFeedingDirect(t0Path, t1Path);
        results.push({ run: i + 1, ok: true, ...r });
        console.log(`\n--- Run ${i + 1} ---`);
        console.log(JSON.stringify({ totalGram: r.totalGram, consumedRatio: r.consumedRatio, confidence: r.confidence, isBowlMatch: r.isBowlMatch, bowlsDetected: r.bowlsDetected, mismatchReason: r.mismatchReason ?? null, assignments: r.assignments }, null, 2));
      } catch (err) {
        results.push({ run: i + 1, ok: false, error: err.message });
        console.log(`Run ${String(i + 1).padStart(2)} | ERROR: ${err.message}`);
      }
    }

    console.log('\n--- 彙總 ---');
    const ok = results.filter((r) => r.ok);
    const grams = ok.map((r) => r.totalGram).filter((v) => typeof v === 'number');
    const ratios = ok.map((r) => r.consumedRatio).filter((v) => typeof v === 'number');
    if (grams.length) {
      const minG = Math.min(...grams);
      const maxG = Math.max(...grams);
      const avgG = grams.reduce((a, b) => a + b, 0) / grams.length;
      console.log(`totalGram: 成功 ${ok.length}/${RUNS} 次, min=${minG}g, max=${maxG}g, avg=${avgG.toFixed(1)}g`);
    }
    if (ratios.length) {
      const minR = Math.min(...ratios);
      const maxR = Math.max(...ratios);
      const avgR = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      console.log(`consumedRatio: min=${minR}, max=${maxR}, avg=${avgR.toFixed(3)}`);
    }
    if (results.some((r) => !r.ok)) {
      console.log('失敗:', results.filter((r) => !r.ok).length, '次');
    }
  })();
}

main();
