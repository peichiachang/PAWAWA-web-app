#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const ROOT_DIR = path.join(APP_DIR, '..');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = {
  ...loadEnv(path.join(APP_DIR, '.env')),
  ...loadEnv(path.join(APP_DIR, '.env.local')),
  ...process.env,
};

const key = env.EXPO_PUBLIC_GEMINI_API_KEY || env.GEMINI_API_KEY;
if (!key) {
  console.error('Missing EXPO_PUBLIC_GEMINI_API_KEY/GEMINI_API_KEY');
  process.exit(1);
}

const imageName = env.VISION_TEST_IMAGE || 'empty.JPG';
const imagePath = path.join(ROOT_DIR, 'scripts', 'fixtures', imageName);
if (!fs.existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}

const imageBase64 = fs.readFileSync(imagePath).toString('base64');
const model = env.VISION_TEST_MODEL || 'gemini-2.5-flash';
const prompt = '請只回答：色調=...; 容器=...; 空碗=...';

async function call(withImage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const body = {
    contents: [
      {
        parts: withImage
          ? [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }]
          : [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'text/plain',
      temperature: 0,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    }
  );
  clearTimeout(timeout);
  const json = await res.json();
  return {
    status: res.status,
    text: json?.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokens: json?.usageMetadata?.promptTokenCount ?? null,
    error: json?.error?.message || null,
  };
}

try {
  console.log(`Testing model=${model}, image=${imageName}`);
  const withoutImage = await call(false);
  const withImage = await call(true);
  console.log('WITHOUT_IMAGE', withoutImage);
  console.log('WITH_IMAGE', withImage);
} catch (err) {
  console.error('VISION_TEST_ERROR', err?.name || 'Error', err?.message || String(err));
  process.exit(1);
}
