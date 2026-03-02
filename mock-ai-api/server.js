#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { createHandlers } = require('./handlers');
const { createRequestListener } = require('./routes');

function loadDotEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    const unquoted = rawValue.replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) {
      process.env[key] = unquoted;
    }
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 25_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', (error) => reject(error));
  });
}

loadDotEnv();

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const AI_PROVIDER = (process.env.AI_PROVIDER || 'mock').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_FALLBACK_TO_MOCK = String(process.env.GEMINI_FALLBACK_TO_MOCK || 'true') === 'true';
const WEATHER_LAT = process.env.WEATHER_LAT ? Number(process.env.WEATHER_LAT) : null;
const WEATHER_LON = process.env.WEATHER_LON ? Number(process.env.WEATHER_LON) : null;
const WATER_SURFACE_CM2 = Number(process.env.WATER_SURFACE_CM2 || 120);
const DEFAULT_TEMP_C = Number(process.env.DEFAULT_TEMP_C || 25);
const DEFAULT_HUMIDITY_PCT = Number(process.env.DEFAULT_HUMIDITY_PCT || 60);

const { checkAiHealth, runWithProvider } = createHandlers({
  AI_PROVIDER,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_FALLBACK_TO_MOCK,
  WEATHER_LAT,
  WEATHER_LON,
  WATER_SURFACE_CM2,
  DEFAULT_TEMP_C,
  DEFAULT_HUMIDITY_PCT,
});

const server = http.createServer(
  createRequestListener({
    parseJsonBody,
    sendJson,
    checkAiHealth,
    runWithProvider,
  })
);

server.listen(PORT, HOST, () => {
  console.log(`Mock AI API running at http://${HOST}:${PORT}`);
  console.log(`Provider: ${AI_PROVIDER}`);
  if (AI_PROVIDER === 'gemini') {
    console.log(`Gemini model: ${GEMINI_MODEL}`);
    console.log(`Gemini fallback to mock: ${GEMINI_FALLBACK_TO_MOCK}`);
  }
  console.log('Endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /health/ai');
  console.log('  POST /ai/feeding');
  console.log('  POST /ai/nutrition-ocr');
  console.log('  POST /ai/hydration');
  console.log('  POST /ai/elimination');
  console.log('  POST /ai/blood-ocr');
});
