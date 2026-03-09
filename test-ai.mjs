/**
 * AI 四大功能測試腳本
 * 測試: 進食分析, 飲水分析, 排泄分析, 血液報告 OCR
 *
 * 執行方式:
 *   cd app && node test-ai.mjs          # Mock 模式（預設）
 *   LIVE=1 cd app && node test-ai.mjs   # 真實 Gemini API 模式
 */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

// ── 環境變數讀取 ──────────────────────────────────────────────
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
  ...loadEnvFile(join(__dirname, '.env')),
  ...loadEnvFile(join(__dirname, '.env.local')),
};

const GEMINI_API_KEY = envVars.EXPO_PUBLIC_GEMINI_API_KEY || '';
const USE_LIVE = process.env.LIVE === '1';
const MOCK_PORT = 18999;

console.log(`\n🔑 API Key: ${GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 6) + '...' : '(none)'}`);
console.log(`🤖 Mode: ${USE_LIVE ? 'LIVE Gemini API' : 'Mock Server'}\n`);

// ── 代理設定（此環境 Node.js DNS 需透過 proxy 解析）──────────
// 注意：mock server 是本地呼叫，不需要代理
if (USE_LIVE) {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
  if (httpsProxy) {
    const { ProxyAgent, setGlobalDispatcher } = _require('undici');
    setGlobalDispatcher(new ProxyAgent(httpsProxy));
  }
}

// ── Mock Server 管理 ──────────────────────────────────────────
let mockServerProcess = null;

async function startMockServer() {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, '..', 'mock-ai-api', 'server.js');
    mockServerProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: String(MOCK_PORT), AI_PROVIDER: 'mock' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => reject(new Error('Mock server startup timeout')), 8000);

    mockServerProcess.stdout.on('data', (data) => {
      if (data.toString().includes('running at')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    mockServerProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function stopMockServer() {
  if (mockServerProcess) {
    mockServerProcess.kill('SIGTERM');
    mockServerProcess = null;
  }
}

// ── 最小測試圖片（1x1 白色 PNG，base64）─────────────────────
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_IMAGE_MIME = 'image/png';

// ── HTTP 工具 ────────────────────────────────────────────────
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Gemini 直接測試（LIVE 模式）──────────────────────────────
async function liveTestWithGemini(name, prompt, imageParts, validateFn) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  if (!GEMINI_API_KEY) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const parts = imageParts.map(p => ({ inlineData: { data: p.base64, mimeType: p.mimeType } }));
  const result = await model.generateContent([prompt, ...parts]);
  const parsed = JSON.parse(result.response.text());
  validateFn(parsed);
  return parsed;
}

// ── 測試定義 ────────────────────────────────────────────────
const TESTS = [
  {
    name: '進食分析 (analyzeFeedingImages)',
    mockFn: async () => {
      return postJson(`http://127.0.0.1:${MOCK_PORT}/ai/feeding`, {
        t0ImageRef: 'test-before.jpg',
        t1ImageRef: 'test-after.jpg',
      });
    },
    liveFn: async () => liveTestWithGemini(
      '進食分析',
      `You are an expert feline nutrition assistant.
      Analyze these two images of cat food bowls: T0 (before) and T1 (after).
      Return JSON: { "bowlsDetected": number, "isBowlMatch": boolean, "assignments": [{ "bowlId": string, "tag": string, "estimatedIntakeGram": number }], "totalGram": number, "confidence": number }`,
      [{ base64: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }, { base64: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }],
      (r) => {
        if (typeof r.bowlsDetected !== 'number') throw new Error('Missing bowlsDetected');
        if (!Array.isArray(r.assignments)) throw new Error('Missing assignments');
      }
    ),
    validateFn: (r) => {
      if (typeof r.bowlsDetected !== 'number') throw new Error('Missing bowlsDetected (number)');
      if (typeof r.totalGram !== 'number') throw new Error('Missing totalGram (number)');
      if (!Array.isArray(r.assignments)) throw new Error('Missing assignments (array)');
      if (typeof r.isBowlMatch !== 'boolean') throw new Error('Missing isBowlMatch (boolean)');
    },
  },
  {
    name: '飲水分析 (analyzeHydrationImages)',
    mockFn: async () => {
      return postJson(`http://127.0.0.1:${MOCK_PORT}/ai/hydration`, {
        t0ImageRef: 'water-before.jpg',
        t1ImageRef: 'water-after.jpg',
      });
    },
    liveFn: async () => liveTestWithGemini(
      '飲水分析',
      `Analyze two water bowl images (T0 initial, T1 later). Estimate water volume.
      Return JSON: { "waterT0Ml": number, "waterT1Ml": number, "tempC": number, "humidityPct": number, "envFactorMl": number, "actualIntakeMl": number, "isBowlMatch": boolean, "mismatchReason": string, "confidence": number }`,
      [{ base64: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }, { base64: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }],
      (r) => {
        if (typeof r.waterT0Ml !== 'number') throw new Error('Missing waterT0Ml');
        if (typeof r.actualIntakeMl !== 'number') throw new Error('Missing actualIntakeMl');
      }
    ),
    validateFn: (r) => {
      if (typeof r.waterT0Ml !== 'number') throw new Error('Missing waterT0Ml (number)');
      if (typeof r.waterT1Ml !== 'number') throw new Error('Missing waterT1Ml (number)');
      if (typeof r.actualIntakeMl !== 'number') throw new Error('Missing actualIntakeMl (number)');
      if (typeof r.confidence !== 'number') throw new Error('Missing confidence (number)');
    },
  },
  {
    name: '排泄分析 (analyzeEliminationImage)',
    mockFn: async () => {
      return postJson(`http://127.0.0.1:${MOCK_PORT}/ai/elimination`, {
        imageRef: 'litter-scoop.jpg',
      });
    },
    liveFn: async () => liveTestWithGemini(
      '排泄分析',
      `Analyze cat feces on a litter scoop using Bristol Stool Scale (1-7).
      IMPORTANT: All string values (color, shapeType, note) MUST be in Traditional Chinese (zh-TW).
      Return JSON: { "color": string, "bristolType": number(1-7), "shapeType": string, "abnormal": boolean, "confidence": number, "note": string }`,
      [{ base64: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }],
      (r) => {
        if (typeof r.color !== 'string') throw new Error('Missing color');
        if (typeof r.bristolType !== 'number') throw new Error('Missing bristolType');
      }
    ),
    validateFn: (r) => {
      if (typeof r.color !== 'string') throw new Error('Missing color (string)');
      if (typeof r.bristolType !== 'number' || r.bristolType < 1 || r.bristolType > 7) {
        throw new Error('bristolType must be number 1-7');
      }
      if (typeof r.abnormal !== 'boolean') throw new Error('Missing abnormal (boolean)');
      if (typeof r.confidence !== 'number') throw new Error('Missing confidence (number)');
      if (typeof r.note !== 'string') throw new Error('Missing note (string)');
    },
  },
  {
    name: '血液報告 OCR (extractBloodReport)',
    mockFn: async () => {
      return postJson(`http://127.0.0.1:${MOCK_PORT}/ai/blood-ocr`, {
        imageRef: 'blood-report.jpg',
      });
    },
    liveFn: async () => liveTestWithGemini(
      '血液報告 OCR',
      `Extract all blood test markers from this veterinary report.
      Return JSON: { "reportDate": string, "labName": string, "markers": [{ "code": string, "value": number, "unit": string, "refLow": number, "refHigh": number }], "confidence": number }`,
      [{ base64: TEST_IMAGE_BASE64, mimeType: TEST_IMAGE_MIME }],
      (r) => {
        if (!Array.isArray(r.markers)) throw new Error('Missing markers array');
      }
    ),
    validateFn: (r) => {
      if (!Array.isArray(r.markers)) throw new Error('Missing markers (array)');
      if (typeof r.confidence !== 'number') throw new Error('Missing confidence (number)');
    },
  },
];

// ── 測試執行器 ───────────────────────────────────────────────
async function runTest(test) {
  process.stdout.write(`🧪 ${test.name}\n   `);
  try {
    const fn = USE_LIVE ? test.liveFn : test.mockFn;
    const result = await fn();
    test.validateFn(result);
    console.log('✅ PASS');
    const lines = JSON.stringify(result, null, 2).split('\n');
    const preview = lines.slice(0, 8).join('\n   ');
    console.log(`   ${preview}${lines.length > 8 ? '\n   ...' : ''}`);
    return true;
  } catch (err) {
    console.log('❌ FAIL');
    console.log(`   Error: ${err.message}`);
    return false;
  }
}

// ── 主流程 ────────────────────────────────────────────────────
console.log('═'.repeat(60));
console.log('  PAWAWA AI 四大功能測試');
console.log('═'.repeat(60));

if (!USE_LIVE) {
  process.stdout.write('⏳ 啟動 Mock Server... ');
  try {
    await startMockServer();
    console.log(`✅ 已啟動 (port ${MOCK_PORT})\n`);
  } catch (err) {
    console.log(`❌ 失敗: ${err.message}`);
    process.exit(1);
  }
}

let passed = 0;
for (const test of TESTS) {
  const ok = await runTest(test);
  if (ok) passed++;
  console.log();
}

if (!USE_LIVE) stopMockServer();

console.log('═'.repeat(60));
console.log(`結果: ${passed}/${TESTS.length} 通過`);
if (!USE_LIVE) {
  console.log('\n💡 提示: 使用 LIVE=1 node test-ai.mjs 可測試真實 Gemini API');
}
console.log('═'.repeat(60));

if (passed < TESTS.length) process.exit(1);
