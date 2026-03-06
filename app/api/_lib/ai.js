/* eslint-disable no-console */
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_FALLBACK_TO_MOCK = String(process.env.GEMINI_FALLBACK_TO_MOCK || 'true') === 'true';

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function hashSeed(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  return hash;
}

function seededRange(seed, min, max) {
  const normalized = (seed % 1000) / 1000;
  return min + normalized * (max - min);
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function buildInlineImagePart(base64, mimeType) {
  const payload = String(base64 || '').trim();
  if (!payload) return null;
  return {
    inline_data: {
      mime_type: String(mimeType || 'image/jpeg'),
      data: payload,
    },
  };
}

function extractJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Gemini returned empty response');
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini response is not valid JSON');
    return JSON.parse(match[0]);
  }
}

async function callGeminiForJson(prompt, imageParts = []) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
  }
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  return extractJsonObject(text);
}

function handleFeedingMock(body) {
  const seed = hashSeed(`${body.t0ImageRef || ''}:${body.t1ImageRef || ''}`);
  const householdTotalGram = Math.round(seededRange(seed + 1, 35, 95));
  return {
    bowlsDetected: 1,
    assignments: [{ bowlId: 'A', tag: 'Household', estimatedIntakeGram: householdTotalGram }],
    householdTotalGram,
    consumedRatio: Number(seededRange(seed + 2, 0.15, 0.85).toFixed(2)),
    isBowlMatch: true,
    mismatchReason: '',
    confidence: Number(seededRange(seed + 3, 0.72, 0.93).toFixed(2)),
  };
}

async function handleFeedingGemini(body) {
  const emptyBowlPart = buildInlineImagePart(body.emptyBowlBase64, body.emptyBowlMimeType || 'image/jpeg');
  const t0Part = buildInlineImagePart(body.t0ImageBase64, body.t0MimeType);
  const t1Part = buildInlineImagePart(body.t1ImageBase64, body.t1MimeType);
  const hasEmptyBowl = !!emptyBowlPart;

  const vesselVolumeMl = normalizeNumber(body.vesselVolumeMl, 0);
  const foodType = body.foodType === 'wet' ? 'wet' : 'dry';
  const density = foodType === 'wet' ? 0.95 : 0.45;
  const manualWeight = normalizeNumber(body.manualWeight, 0);
  const t0RefGrams = manualWeight > 0 ? manualWeight : (vesselVolumeMl > 0 ? Math.round(vesselVolumeMl * 0.8 * density) : 0);

  const calibrationNote = t0RefGrams > 0
    ? `Bowl: ${vesselVolumeMl > 0 ? vesselVolumeMl + 'ml' : 'unknown volume'}, food: ${foodType} (~${density}g/ml). T0 reference weight: ~${t0RefGrams}g.`
    : 'Bowl capacity unknown — estimate consumedRatio visually.';

  const wetFoodSection = foodType === 'wet' ? `
WET FOOD 3D RECOGNITION RULE:
- Wet food forms a 3D mound, not a flat layer. Focus on highlights, shadows, and texture depth to estimate Y-axis thickness.
- Do NOT rely purely on 2D horizontal surface area coverage — a thin smear can cover the whole bowl but contain almost no volume.
- If T1 shows a widespread but extremely THIN film or smear of residue, treat remaining volume as extremely low (consumedRatio > 0.9).
- For angled (≈45°) views, estimate mound thickness directly from the visible side profile of the food pile.
- If food has been licked flat into a thin layer, treat remaining volume as ≤ 5% even if surface coverage appears large.` : '';

  const imageRolesSection = hasEmptyBowl
    ? `You receive THREE images in order:
- [1] Empty bowl (0% food) — use as contour/texture reference and absolute fill baseline.
  NOTE: Residual crumbs, food dust, dry smears, or small traces on the empty bowl are irrelevant — treat the empty bowl as 0% fill regardless of minor residues.
- [2] T0 = bowl immediately after food was placed (full).
- [3] T1 = bowl after the cat has eaten.
Return "t0FillRatio" and "t1FillRatio" as absolute fill levels relative to the empty bowl, then consumedRatio = t0FillRatio - t1FillRatio.`
    : `You receive TWO images in order:
- [1] T0 = bowl immediately after food was placed (this is the 100% baseline for this meal).
- [2] T1 = bowl after the cat has eaten.
Return "consumedRatio" = fraction of T0 that was eaten.`;

  const prompt = `
You are a cat feeding vision analyzer. Return JSON only.
${calibrationNote}

IMAGE ROLES:
${imageRolesSection}
${wetFoodSection}

IMPORTANT RULES:
- Bowl bottom decorations, patterns, or colored ornaments becoming visible in T1 simply indicate food level has dropped — they do NOT mean the bowl is empty. Estimate remaining food volume carefully.
- Compare only the food volume, ignoring bowl color and decorative elements.

Return:
${hasEmptyBowl ? `{
  "t0FillRatio": number (0.0-1.0, T0 fill relative to empty bowl),
  "t1FillRatio": number (0.0-1.0, T1 fill relative to empty bowl),
  "consumedRatio": number (= t0FillRatio - t1FillRatio),
  "isBowlMatch": boolean,
  "mismatchReason": string,
  "confidence": number
}` : `{
  "consumedRatio": number (0.0-1.0, fraction of T0 eaten),
  "isBowlMatch": boolean,
  "mismatchReason": string,
  "confidence": number
}`}
`;

  const imageParts = [emptyBowlPart, t0Part, t1Part].filter(Boolean);
  const raw = await callGeminiForJson(prompt, imageParts);

  let consumedRatio;
  if (hasEmptyBowl && raw.t0FillRatio != null && raw.t1FillRatio != null) {
    const t0Fill = Math.max(0, Math.min(1, normalizeNumber(raw.t0FillRatio, 0.8)));
    const t1Fill = Math.max(0, Math.min(1, normalizeNumber(raw.t1FillRatio, 0)));
    consumedRatio = Math.max(0, Math.min(1, t0Fill - t1Fill));
  } else {
    consumedRatio = Math.max(0, Math.min(1, normalizeNumber(raw.consumedRatio, 0.5)));
  }

  // Compute grams using physics-based calibration when available
  const grams = t0RefGrams > 0
    ? Math.max(0, Math.round(consumedRatio * t0RefGrams))
    : Math.max(0, Math.round(normalizeNumber(raw.consumedGram ?? raw.householdTotalGram, 0)));
  return {
    bowlsDetected: 1,
    assignments: [{ bowlId: 'A', tag: 'Household', estimatedIntakeGram: grams }],
    householdTotalGram: grams,
    consumedRatio: Number(consumedRatio.toFixed(2)),
    isBowlMatch: normalizeBoolean(raw.isBowlMatch, true),
    mismatchReason: String(raw.mismatchReason || ''),
    confidence: Number(normalizeNumber(raw.confidence, 0.8).toFixed(2)),
  };
}

function handleNutritionMock(body) {
  const seed = hashSeed(String(body.imageRef || body.imageBase64?.slice(0, 32) || 'nutrition'));
  return {
    kcalPerGram: Number(seededRange(seed + 1, 3.1, 3.9).toFixed(2)),
    proteinPct: Number(seededRange(seed + 2, 30, 44).toFixed(1)),
    phosphorusPct: Number(seededRange(seed + 3, 0.4, 1.2).toFixed(2)),
    rawText: 'mock nutrition',
  };
}

async function handleNutritionGemini(body) {
  const imagePart = buildInlineImagePart(body.imageBase64, body.mimeType);
  const raw = await callGeminiForJson(
    `Extract pet-food nutrition numbers. Return JSON with kcalPerGram, proteinPct, phosphorusPct, rawText.`,
    imagePart ? [imagePart] : []
  );
  return {
    kcalPerGram: Number(normalizeNumber(raw.kcalPerGram, 0).toFixed(2)),
    proteinPct: Number(normalizeNumber(raw.proteinPct, 0).toFixed(1)),
    phosphorusPct: Number(normalizeNumber(raw.phosphorusPct, 0).toFixed(2)),
    rawText: String(raw.rawText || ''),
  };
}

function handleHydrationMock(body) {
  const seed = hashSeed(`${body.t0ImageRef || ''}:${body.t1ImageRef || ''}:hydration`);
  const waterT0Ml = Math.round(seededRange(seed + 1, 500, 1200));
  const waterT1Ml = Math.max(0, waterT0Ml - Math.round(seededRange(seed + 2, 80, 420)));
  const envFactorMl = Math.round(seededRange(seed + 3, 5, 30));
  return {
    waterT0Ml,
    waterT1Ml,
    tempC: 26,
    humidityPct: 60,
    envFactorMl,
    actualIntakeMl: Math.max(0, waterT0Ml - waterT1Ml - envFactorMl),
    isBowlMatch: true,
    mismatchReason: '',
    confidence: Number(seededRange(seed + 4, 0.7, 0.95).toFixed(2)),
  };
}

/** ml evaporated per cm² of water surface per hour (~25°C indoors) */
const EVAP_RATE_ML_PER_CM2_PER_HOUR = 0.008;
const EVAP_RATE_FLAT_ML_PER_HOUR = 0.5;

function computeEvaporationMl(t0CapturedAt, t1CapturedAt, rimDiameterCm) {
  const t0 = normalizeNumber(t0CapturedAt, 0);
  const t1 = normalizeNumber(t1CapturedAt, 0);
  if (t1 <= t0) return 0;
  const hoursElapsed = (t1 - t0) / (1000 * 60 * 60);
  const rim = normalizeNumber(rimDiameterCm, 0);
  if (rim > 0) {
    const surfaceAreaCm2 = Math.PI * (rim / 2) * (rim / 2);
    return hoursElapsed * surfaceAreaCm2 * EVAP_RATE_ML_PER_CM2_PER_HOUR;
  }
  return hoursElapsed * EVAP_RATE_FLAT_ML_PER_HOUR;
}

async function handleHydrationGemini(body) {
  const t0Part = buildInlineImagePart(body.t0ImageBase64, body.t0MimeType);
  const t1Part = buildInlineImagePart(body.t1ImageBase64, body.t1MimeType);

  const t0LevelNote = body.t0LevelYPct != null ? `\n- The user marked T0 water level at ${Math.round(normalizeNumber(body.t0LevelYPct, 0.5) * 100)}% from the top.` : '';
  const t1LevelNote = body.t1LevelYPct != null ? `\n- The user marked T1 water level at ${Math.round(normalizeNumber(body.t1LevelYPct, 0.5) * 100)}% from the top.` : '';
  const vesselNote = body.vesselVolumeMl ? `\nKnown vessel volume: ${normalizeNumber(body.vesselVolumeMl, 0)}ml.` : '';

  const prompt = `
Analyze two water-bowl images: T0 (initial) and T1 (later).
Return valid JSON only (no markdown, no extra text).
${t0LevelNote}${t1LevelNote}${vesselNote}
If explicit user water-level marks are provided, use them as primary signal.

## OPTICAL CUES FOR WATER (CRITICAL)
- Do NOT confuse the bottom pattern/logo of the bowl with the water surface.
- Focus heavily on the MENISCUS (the sharp light reflection ring where water meets the bowl wall).
- Look for REFRACTION DISTORTION of text/patterns under the water surface to determine true depth.
- Water causes visible CAUSTIC PATTERNS (bright rippling lines) on the bowl bottom — use these to confirm water presence.
- Bowl bottom logos/decorations visible through water do NOT mean the bowl is empty; assess actual water depth.

Hard constraints:
- waterT0Ml >= 0
- waterT1Ml >= 0
- waterT1Ml <= waterT0Ml unless clear refill evidence
- confidence between 0 and 1

JSON schema:
{
  "waterT0Ml": number,
  "waterT1Ml": number,
  "isBowlMatch": boolean,
  "mismatchReason": string | null,
  "confidence": number
}
`;
  const raw = await callGeminiForJson(prompt, [t0Part, t1Part].filter(Boolean));
  const waterT0Ml = Math.max(0, Math.round(normalizeNumber(raw.waterT0Ml, 0)));
  const waterT1Ml = Math.max(0, Math.min(waterT0Ml, Math.round(normalizeNumber(raw.waterT1Ml, 0))));
  const envFactorMl = Math.round(computeEvaporationMl(body.t0CapturedAt, body.t1CapturedAt, body.rimDiameterCm));
  return {
    waterT0Ml,
    waterT1Ml,
    tempC: 26,
    humidityPct: 60,
    envFactorMl,
    actualIntakeMl: Math.max(0, waterT0Ml - waterT1Ml - envFactorMl),
    isBowlMatch: normalizeBoolean(raw.isBowlMatch, true),
    mismatchReason: String(raw.mismatchReason || ''),
    confidence: Number(normalizeNumber(raw.confidence, 0.8).toFixed(2)),
  };
}

function handleEliminationMock(body) {
  const seed = hashSeed(String(body.imageRef || body.imageBase64?.slice(0, 32) || 'elim'));
  const bristolType = Math.max(1, Math.min(7, Math.round(seededRange(seed + 1, 2, 6))));
  return {
    color: '正常棕色',
    bristolType,
    shapeType: `Bristol Type ${bristolType}`,
    abnormal: bristolType <= 2 || bristolType >= 6,
    confidence: Number(seededRange(seed + 2, 0.75, 0.95).toFixed(2)),
    note: '',
  };
}

async function handleEliminationGemini(body) {
  const imagePart = buildInlineImagePart(body.imageBase64, body.mimeType);
  const raw = await callGeminiForJson(
    `Classify stool image. Return JSON: color, bristolType(1-7), shapeType, abnormal(boolean), confidence, note.`,
    imagePart ? [imagePart] : []
  );
  const bt = Math.max(1, Math.min(7, Math.round(normalizeNumber(raw.bristolType, 4))));
  return {
    color: String(raw.color || 'unknown'),
    bristolType: bt,
    shapeType: String(raw.shapeType || `Bristol Type ${bt}`),
    abnormal: normalizeBoolean(raw.abnormal, bt <= 2 || bt >= 6),
    confidence: Number(normalizeNumber(raw.confidence, 0.8).toFixed(2)),
    note: String(raw.note || ''),
  };
}

function handleBloodOcrMock() {
  return {
    reportDate: new Date().toISOString().slice(0, 10),
    labName: 'Mock Lab',
    confidence: 0.82,
    markers: [],
  };
}

async function handleBloodOcrGemini(body) {
  const imagePart = buildInlineImagePart(body.imageBase64, body.mimeType);
  const raw = await callGeminiForJson(
    `Extract veterinary blood markers from image. Return JSON: reportDate, labName, confidence, markers[{code,value,unit,refLow,refHigh}].`,
    imagePart ? [imagePart] : []
  );
  const markers = Array.isArray(raw.markers) ? raw.markers : [];
  return {
    reportDate: String(raw.reportDate || new Date().toISOString().slice(0, 10)),
    labName: String(raw.labName || ''),
    confidence: Number(normalizeNumber(raw.confidence, 0.8).toFixed(2)),
    markers: markers.map((m) => ({
      code: String(m.code || ''),
      value: normalizeNumber(m.value, 0),
      unit: String(m.unit || ''),
      refLow: m.refLow != null ? normalizeNumber(m.refLow) : undefined,
      refHigh: m.refHigh != null ? normalizeNumber(m.refHigh) : undefined,
    })).filter((m) => m.code),
  };
}

function buildSimpleContour(rimDiameterCm) {
  const r = rimDiameterCm / 2;
  const points = [];
  for (let i = 0; i <= 20; i += 1) {
    const y = Number((i / 20 * 5).toFixed(2));
    const radius = Number((r * (1 - i * 0.02)).toFixed(3));
    points.push({ y, radius: Math.max(0.2, radius) });
  }
  return points;
}

function handleSideProfileMock(body) {
  const rimDiameterCm = normalizeNumber(body.rimDiameterCm, 12);
  return {
    contour: {
      points: buildSimpleContour(rimDiameterCm),
      confidence: 0.78,
      estimatedHeightCm: 5,
    },
    confidence: 0.78,
    estimatedVolumeMl: Math.round(Math.PI * Math.pow(rimDiameterCm / 2, 2) * 5),
  };
}

async function handleSideProfileGemini(body) {
  const rimDiameterCm = normalizeNumber(body.rimDiameterCm, 0);
  const imagePart = buildInlineImagePart(body.imageBase64, body.mimeType);
  const raw = await callGeminiForJson(
    `You analyze bowl side-profile image and return normalized contour for volume estimation.
Return JSON:
{
  "contour": {
    "points": [{"y": number, "radius": number}],
    "confidence": number,
    "estimatedHeightCm": number
  },
  "confidence": number,
  "estimatedVolumeMl": number
}
Use rimDiameterCm=${rimDiameterCm} as scale reference.`,
    imagePart ? [imagePart] : []
  );
  const points = Array.isArray(raw?.contour?.points) ? raw.contour.points : [];
  return {
    contour: {
      points: points.map((p) => ({ y: normalizeNumber(p.y, 0), radius: Math.max(0, normalizeNumber(p.radius, 0)) })).slice(0, 200),
      confidence: Number(normalizeNumber(raw?.contour?.confidence, 0.8).toFixed(2)),
      estimatedHeightCm: Number(normalizeNumber(raw?.contour?.estimatedHeightCm, 5).toFixed(2)),
    },
    confidence: Number(normalizeNumber(raw?.confidence, 0.8).toFixed(2)),
    estimatedVolumeMl: Math.max(0, Math.round(normalizeNumber(raw?.estimatedVolumeMl, 0))),
  };
}

function selectProvider() {
  if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) return 'gemini';
  return 'mock';
}

async function runWithProvider(routeName, body) {
  const provider = selectProvider();
  const mockMap = {
    feeding: () => handleFeedingMock(body),
    nutrition: () => handleNutritionMock(body),
    hydration: () => handleHydrationMock(body),
    elimination: () => handleEliminationMock(body),
    bloodOcr: () => handleBloodOcrMock(body),
    sideProfile: () => handleSideProfileMock(body),
  };
  const geminiMap = {
    feeding: () => handleFeedingGemini(body),
    nutrition: () => handleNutritionGemini(body),
    hydration: () => handleHydrationGemini(body),
    elimination: () => handleEliminationGemini(body),
    bloodOcr: () => handleBloodOcrGemini(body),
    sideProfile: () => handleSideProfileGemini(body),
  };

  if (provider !== 'gemini') return mockMap[routeName]();
  try {
    return await geminiMap[routeName]();
  } catch (error) {
    if (!GEMINI_FALLBACK_TO_MOCK) throw error;
    console.warn(`[api] gemini ${routeName} failed, fallback to mock: ${error.message || error}`);
    return mockMap[routeName]();
  }
}

function createAiRouteHandler(routeName) {
  return async function handler(req, res) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const result = await runWithProvider(routeName, body || {});
      sendJson(res, 200, result);
    } catch (error) {
      console.error(`[api/${routeName}]`, error);
      sendJson(res, 400, { error: error.message || 'Request failed' });
    }
  };
}

function createAiHealthHandler() {
  return async function handler(req, res) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    sendJson(res, 200, {
      provider: selectProvider(),
      aiProviderConfigured: AI_PROVIDER,
      geminiConfigured: Boolean(GEMINI_API_KEY),
      model: GEMINI_MODEL,
      fallbackToMock: GEMINI_FALLBACK_TO_MOCK,
    });
  };
}

module.exports = {
  createAiRouteHandler,
  createAiHealthHandler,
};
