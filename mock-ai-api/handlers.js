function createHandlers(config) {
  const {
    AI_PROVIDER,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GEMINI_FALLBACK_TO_MOCK,
    WEATHER_LAT,
    WEATHER_LON,
    WATER_SURFACE_CM2,
    DEFAULT_TEMP_C,
    DEFAULT_HUMIDITY_PCT,
  } = config;

  let lastGeminiError = null;
  let healthCache = { ts: 0, payload: null };

  function hashSeed(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) % 100000;
    }
    return hash;
  }

  function seededRange(seed, min, max) {
    const normalized = (seed % 1000) / 1000;
    return min + normalized * (max - min);
  }

  async function fetchCurrentWeather() {
    if (!Number.isFinite(WEATHER_LAT) || !Number.isFinite(WEATHER_LON)) {
      return {
        tempC: DEFAULT_TEMP_C,
        humidityPct: DEFAULT_HUMIDITY_PCT,
        source: 'default',
      };
    }

    const endpoint =
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
      '&current=temperature_2m,relative_humidity_2m&timezone=auto';
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Weather API failed: ${response.status}`);
    }
    const payload = await response.json();
    const tempC = Number(payload?.current?.temperature_2m);
    const humidityPct = Number(payload?.current?.relative_humidity_2m);

    if (!Number.isFinite(tempC) || !Number.isFinite(humidityPct)) {
      throw new Error('Weather API missing required fields');
    }

    return {
      tempC,
      humidityPct,
      source: 'open-meteo',
    };
  }

  function resolveElapsedHours(body) {
    const t0 = Number(body?.t0CapturedAt);
    const t1 = Number(body?.t1CapturedAt);
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) {
      return 8;
    }
    const hours = (t1 - t0) / 3_600_000;
    return Math.max(0.25, Math.min(24, hours));
  }

  function calculateEvaporationMl(tempC, humidityPct, elapsedHours) {
    const safeHumidity = Math.max(0, Math.min(100, humidityPct));
    const safeTemp = Math.max(-10, Math.min(50, tempC));
    const tempMultiplier = 1 + 0.035 * (safeTemp - 25);
    const humidityMultiplier = 1 - 0.008 * (safeHumidity - 60);
    const baseMlPerHour = (WATER_SURFACE_CM2 / 100) * 2.2;
    const mlPerHour = Math.max(0.1, baseMlPerHour * tempMultiplier * humidityMultiplier);
    return Math.max(0, Math.round(mlPerHour * elapsedHours));
  }

  async function applyWeatherCorrection(waterT0Ml, waterT1Ml, body) {
    const elapsedHours = resolveElapsedHours(body);
    try {
      const weather = await fetchCurrentWeather();
      const envFactorMl = calculateEvaporationMl(weather.tempC, weather.humidityPct, elapsedHours);
      return {
        tempC: Number(weather.tempC.toFixed(1)),
        humidityPct: Number(weather.humidityPct.toFixed(1)),
        envFactorMl,
        actualIntakeMl: Math.max(0, Math.round(waterT0Ml - waterT1Ml - envFactorMl)),
        weatherSource: weather.source,
      };
    } catch (error) {
      const envFactorMl = calculateEvaporationMl(DEFAULT_TEMP_C, DEFAULT_HUMIDITY_PCT, elapsedHours);
      return {
        tempC: DEFAULT_TEMP_C,
        humidityPct: DEFAULT_HUMIDITY_PCT,
        envFactorMl,
        actualIntakeMl: Math.max(0, Math.round(waterT0Ml - waterT1Ml - envFactorMl)),
        weatherSource: `fallback (${error.message || 'unknown'})`,
      };
    }
  }

  function extractJsonObject(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      throw new Error('Gemini returned empty response');
    }

    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      // Continue to regex extraction for fenced blocks or prefixed text.
    }

    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Gemini response is not valid JSON');
    }
    return JSON.parse(match[0]);
  }

  function buildInlineImagePart(base64, mimeType) {
    const payload = String(base64 || '').trim();
    if (!payload) {
      return null;
    }
    return {
      inline_data: {
        mime_type: String(mimeType || 'image/jpeg'),
        data: payload,
      },
    };
  }

  async function callGeminiForJson(prompt, imageParts = []) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      const message = body?.error?.message || `Gemini HTTP ${response.status}`;
      lastGeminiError = message;
      throw new Error(message);
    }

    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    lastGeminiError = null;
    return extractJsonObject(text);
  }

  async function checkAiHealth() {
    if (AI_PROVIDER !== 'gemini') {
      return {
        provider: AI_PROVIDER,
        ready: true,
        fallbackToMock: GEMINI_FALLBACK_TO_MOCK,
        geminiConfigured: Boolean(GEMINI_API_KEY),
        geminiModel: GEMINI_MODEL,
        lastError: null,
      };
    }

    const now = Date.now();
    if (healthCache.payload && now - healthCache.ts < 60_000) {
      return healthCache.payload;
    }

    if (!GEMINI_API_KEY) {
      const payload = {
        provider: AI_PROVIDER,
        ready: false,
        fallbackToMock: GEMINI_FALLBACK_TO_MOCK,
        geminiConfigured: false,
        geminiModel: GEMINI_MODEL,
        lastError: 'GEMINI_API_KEY is not set',
      };
      healthCache = { ts: now, payload };
      return payload;
    }

    try {
      await callGeminiForJson('Return exactly {"ok":true}.');
      const payload = {
        provider: AI_PROVIDER,
        ready: true,
        fallbackToMock: GEMINI_FALLBACK_TO_MOCK,
        geminiConfigured: true,
        geminiModel: GEMINI_MODEL,
        lastError: null,
      };
      healthCache = { ts: now, payload };
      return payload;
    } catch (error) {
      const payload = {
        provider: AI_PROVIDER,
        ready: false,
        fallbackToMock: GEMINI_FALLBACK_TO_MOCK,
        geminiConfigured: true,
        geminiModel: GEMINI_MODEL,
        lastError: String(error.message || error),
      };
      healthCache = { ts: now, payload };
      return payload;
    }
  }

  function handleFeeding(body) {
    const t0 = String(body.t0ImageRef || '');
    const t1 = String(body.t1ImageRef || '');
    const seed = hashSeed(`${t0}:${t1}`);
    const miloGram = Math.round(seededRange(seed + 1, 35, 50));
    const lunaGram = Math.round(seededRange(seed + 7, 28, 46));

    return {
      bowlsDetected: 2,
      assignments: [
        { bowlId: 'A', tag: 'Milo', estimatedIntakeGram: miloGram },
        { bowlId: 'B', tag: 'Luna', estimatedIntakeGram: lunaGram },
      ],
      householdTotalGram: miloGram + lunaGram,
      isBowlMatch: true,
      mismatchReason: '',
    };
  }

  function handleNutritionOcr(body) {
    const imageRef = String(body.imageRef || '');
    const seed = hashSeed(imageRef);
    const kcalPerGram = Number(seededRange(seed + 3, 3.1, 3.8).toFixed(2));
    const proteinPct = Number(seededRange(seed + 5, 30, 44).toFixed(1));
    const phosphorusPct = Number(seededRange(seed + 8, 0.4, 1.1).toFixed(2));

    return {
      kcalPerGram,
      proteinPct,
      phosphorusPct,
      rawText: `Energy ${kcalPerGram} kcal/g, Protein ${proteinPct}%, Phosphorus ${phosphorusPct}%`,
    };
  }

  async function handleHydration(body) {
    const t0 = String(body.t0ImageRef || '');
    const t1 = String(body.t1ImageRef || '');
    const seed = hashSeed(`${t0}:${t1}:hydration`);
    const waterT0Ml = Math.round(seededRange(seed + 2, 900, 1300));
    const dropMl = Math.round(seededRange(seed + 4, 240, 480));
    const waterT1Ml = Math.max(0, waterT0Ml - dropMl);
    const corrected = await applyWeatherCorrection(waterT0Ml, waterT1Ml, body);

    return {
      waterT0Ml,
      waterT1Ml,
      tempC: corrected.tempC,
      humidityPct: corrected.humidityPct,
      envFactorMl: corrected.envFactorMl,
      actualIntakeMl: corrected.actualIntakeMl,
      isBowlMatch: true,
      mismatchReason: '',
      weatherSource: corrected.weatherSource,
      confidence: Number(seededRange(seed + 15, 0.65, 0.99).toFixed(2)),
    };
  }

  function handleElimination(body) {
    const imageRef = String(body.imageRef || '');
    const seed = hashSeed(imageRef);
    const bristolType = Math.max(1, Math.min(7, Math.floor(seededRange(seed + 11, 1, 8))));
    const confidence = Number(seededRange(seed + 13, 0.88, 0.99).toFixed(2));
    const abnormal = bristolType <= 2 || bristolType >= 6;

    return {
      color: abnormal ? '偏深棕色' : '正常棕色',
      bristolType,
      shapeType: `Bristol Type ${bristolType}`,
      abnormal,
      confidence,
      note: abnormal ? '偏離理想 Bristol 3-4，建議持續觀察與補水。' : '接近理想 Bristol 3-4。',
    };
  }

  function handleBloodOcr(body) {
    const imageRef = String(body.imageRef || body.imageBase64?.slice(0, 16) || '');
    const seed = hashSeed(imageRef || String(Date.now()));
    const s = (offset, min, max, decimals = 1) =>
      Number(seededRange(seed + offset, min, max).toFixed(decimals));

    return {
      reportDate: new Date().toISOString().slice(0, 10),
      labName: 'IDEXX',
      markers: [
        { code: 'RBC', value: s(1, 5.0, 11.0), unit: '10⁶/μL', refLow: 5.0, refHigh: 10.0 },
        { code: 'HCT', value: Math.round(s(2, 25, 52)), unit: '%', refLow: 30, refHigh: 45 },
        { code: 'HGB', value: s(3, 7.5, 16.5), unit: 'g/dL', refLow: 9.0, refHigh: 15.1 },
        { code: 'MCV', value: Math.round(s(4, 35, 58)), unit: 'fL', refLow: 39, refHigh: 55 },
        { code: 'MCHC', value: s(5, 27, 38), unit: 'g/dL', refLow: 30, refHigh: 36 },
        { code: 'WBC', value: s(6, 3.0, 22.0), unit: '10³/μL', refLow: 5.5, refHigh: 19.5 },
        { code: 'NEU', value: s(7, 1.5, 16.0), unit: '10³/μL', refLow: 2.5, refHigh: 14.0 },
        { code: 'LYM', value: s(8, 0.4, 8.5), unit: '10³/μL', refLow: 1.5, refHigh: 7.0 },
        { code: 'PLT', value: Math.round(s(9, 80, 720)), unit: '10³/μL', refLow: 151, refHigh: 600 },
        { code: 'BUN', value: Math.round(s(10, 10, 50)), unit: 'mg/dL', refLow: 16, refHigh: 36 },
        { code: 'CREA', value: s(11, 0.4, 3.5), unit: 'mg/dL', refLow: 0.6, refHigh: 2.4 },
        { code: 'ALT', value: Math.round(s(12, 8, 220)), unit: 'U/L', refLow: 12, refHigh: 130 },
        { code: 'AST', value: Math.round(s(13, 12, 90)), unit: 'U/L', refLow: 0, refHigh: 48 },
        { code: 'ALKP', value: Math.round(s(14, 8, 110)), unit: 'U/L', refLow: 0, refHigh: 62 },
        { code: 'GLU', value: Math.round(s(15, 60, 220)), unit: 'mg/dL', refLow: 70, refHigh: 150 },
        { code: 'TP', value: s(16, 4.8, 10.0), unit: 'g/dL', refLow: 5.7, refHigh: 8.9 },
        { code: 'ALB', value: s(17, 1.8, 4.8), unit: 'g/dL', refLow: 2.3, refHigh: 3.9 },
        { code: 'K', value: s(18, 2.8, 7.0), unit: 'mEq/L', refLow: 3.5, refHigh: 5.8 },
        { code: 'PHOS', value: s(19, 1.8, 8.5), unit: 'mg/dL', refLow: 2.6, refHigh: 6.0 },
        { code: 'T4', value: s(20, 0.5, 6.0), unit: 'μg/dL', refLow: 0.8, refHigh: 4.0 },
      ],
      confidence: s(21, 0.65, 0.99, 2),
    };
  }

  async function handleBloodOcrGemini(body) {
    const imagePart = buildInlineImagePart(body.imageBase64, body.mimeType);
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `
You are a veterinary blood report OCR parser. Extract all blood marker values from the image. Return JSON only.
Input image reference: ${String(body.imageRef || '')}
- imageProvided: ${imagePart ? 'true' : 'false'}

Return exactly this shape. Include all markers you can find:
{
  "reportDate": "${today}",
  "labName": string,
  "confidence": number, // Overall confidence score of the OCR extraction between 0.0 and 1.0 (e.g. 0.95)
  "markers": [
    { "code": string, "value": number, "unit": string, "refLow": number|null, "refHigh": number|null }
  ]
}
Common cat blood markers: RBC, HCT, HGB, MCV, MCH, MCHC, WBC, NEU, LYM, MONO, EOS, BASO, PLT,
BUN, CREA, SDMA, ALT, AST, ALKP, GGT, TBIL, GLU, CHOL, TP, ALB, GLOB, NA, K, CL, CA, PHOS, MG, AMYL, LIPA, T4
`;
    const raw = await callGeminiForJson(prompt, imagePart ? [imagePart] : []);
    const markers = Array.isArray(raw.markers) ? raw.markers : [];
    return {
      reportDate: String(raw.reportDate || today),
      labName: String(raw.labName || ''),
      confidence: normalizeNumber(raw.confidence, 0.8),
      markers: markers
        .map((m) => ({
          code: String(m.code || ''),
          value: normalizeNumber(m.value, 0),
          unit: String(m.unit || ''),
          refLow: m.refLow != null ? normalizeNumber(m.refLow) : undefined,
          refHigh: m.refHigh != null ? normalizeNumber(m.refHigh) : undefined,
        }))
        .filter((m) => m.code),
    };
  }

  function normalizeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return fallback;
  }

  async function handleFeedingGemini(body) {
    const t0Part = buildInlineImagePart(body.t0ImageBase64, body.t0MimeType);
    const t1Part = buildInlineImagePart(body.t1ImageBase64, body.t1MimeType);
    const imageParts = [];
    if (t0Part) imageParts.push(t0Part);
    if (t1Part) imageParts.push(t1Part);

    const prompt = `
You are an AI for cat-care app. Return JSON only.
Task: estimate food intake from two feeding images.
Input:
- t0ImageRef: ${String(body.t0ImageRef || '')}
- t1ImageRef: ${String(body.t1ImageRef || '')}
- imageCount: ${imageParts.length}

Return exactly this shape:
{
  "bowlsDetected": number,
  "assignments": [{"bowlId":"A","tag":"Milo","estimatedIntakeGram":number}],
  "householdTotalGram": number,
  "isBowlMatch": boolean,
  "mismatchReason": string,
  "confidence": number // Overall confidence score of the assessment between 0.0 and 1.0
}
`;
    const raw = await callGeminiForJson(prompt, imageParts);
    const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
    return {
      bowlsDetected: Math.max(0, Math.round(normalizeNumber(raw.bowlsDetected, assignments.length))),
      assignments: assignments.map((item, index) => ({
        bowlId: String(item.bowlId || String.fromCharCode(65 + index)),
        tag: String(item.tag || `Cat-${index + 1}`),
        estimatedIntakeGram: Math.max(0, Math.round(normalizeNumber(item.estimatedIntakeGram, 0))),
      })),
      householdTotalGram: Math.max(0, Math.round(normalizeNumber(raw.householdTotalGram, 0))),
      isBowlMatch: normalizeBoolean(raw.isBowlMatch, true),
      mismatchReason: String(raw.mismatchReason || ''),
      confidence: normalizeNumber(raw.confidence, 0.8),
    };
  }

  async function handleNutritionGemini(body) {
    const imagePart = buildInlineImagePart(body.imageBase64, body.mimeType);
    const prompt = `
You are an OCR parser for pet food labels. Return JSON only.
Input image reference: ${String(body.imageRef || '')}
- imageProvided: ${imagePart ? 'true' : 'false'}

Return exactly:
{
  "kcalPerGram": number,
  "proteinPct": number,
  "phosphorusPct": number,
  "rawText": string
}
`;
    const raw = await callGeminiForJson(prompt, imagePart ? [imagePart] : []);
    return {
      kcalPerGram: Number(normalizeNumber(raw.kcalPerGram, 0).toFixed(2)),
      proteinPct: Number(normalizeNumber(raw.proteinPct, 0).toFixed(1)),
      phosphorusPct: Number(normalizeNumber(raw.phosphorusPct, 0).toFixed(2)),
      rawText: String(raw.rawText || ''),
    };
  }

  async function handleHydrationGemini(body) {
    const t0Part = buildInlineImagePart(body.t0ImageBase64, body.t0MimeType);
    const t1Part = buildInlineImagePart(body.t1ImageBase64, body.t1MimeType);
    const imageParts = [];
    if (t0Part) imageParts.push(t0Part);
    if (t1Part) imageParts.push(t1Part);

    const prompt = `
You are a hydration analyzer for cat-care app. Return JSON only.
Input:
- t0ImageRef: ${String(body.t0ImageRef || '')}
- t1ImageRef: ${String(body.t1ImageRef || '')}
- imageCount: ${imageParts.length}

Return exactly:
{
  "waterT0Ml": number,
  "waterT1Ml": number,
  "tempC": number,
  "humidityPct": number,
  "envFactorMl": number,
  "actualIntakeMl": number,
  "isBowlMatch": boolean,
  "mismatchReason": string,
  "confidence": number // Overall confidence score of the assessment between 0.0 and 1.0
}
`;
    const raw = await callGeminiForJson(prompt, imageParts);
    const waterT0Ml = Math.max(0, Math.round(normalizeNumber(raw.waterT0Ml, 0)));
    const waterT1Ml = Math.max(0, Math.round(normalizeNumber(raw.waterT1Ml, 0)));
    const corrected = await applyWeatherCorrection(waterT0Ml, waterT1Ml, body);
    return {
      waterT0Ml,
      waterT1Ml,
      tempC: corrected.tempC,
      humidityPct: corrected.humidityPct,
      envFactorMl: corrected.envFactorMl,
      actualIntakeMl: corrected.actualIntakeMl,
      isBowlMatch: normalizeBoolean(raw.isBowlMatch, true),
      mismatchReason: String(raw.mismatchReason || ''),
      weatherSource: corrected.weatherSource,
      confidence: normalizeNumber(raw.confidence, 0.8),
    };
  }

  async function handleEliminationGemini(body) {
    const imagePart = buildInlineImagePart(body.imageBase64, body.mimeType);
    const prompt = `
You are a stool-image classifier for cat-care app. Return JSON only.
Input image reference: ${String(body.imageRef || '')}
- imageProvided: ${imagePart ? 'true' : 'false'}

Return exactly:
{
  "color": string,
  "bristolType": number,
  "shapeType": string,
  "abnormal": boolean,
  "confidence": number,
  "note": string
}
`;
    const raw = await callGeminiForJson(prompt, imagePart ? [imagePart] : []);
    const btRaw = Math.round(normalizeNumber(raw.bristolType, 4));
    const bristolType = Math.max(1, Math.min(7, btRaw));
    return {
      color: String(raw.color || 'unknown'),
      bristolType,
      shapeType: String(raw.shapeType || `Bristol Type ${bristolType}`),
      abnormal: normalizeBoolean(raw.abnormal, false),
      confidence: Number(normalizeNumber(raw.confidence, 0.5).toFixed(2)),
      note: String(raw.note || ''),
    };
  }

  async function runWithProvider(handlerName, body) {
    const mockHandlers = {
      feeding: () => handleFeeding(body),
      nutrition: () => handleNutritionOcr(body),
      hydration: () => handleHydration(body),
      elimination: () => handleElimination(body),
      bloodOcr: () => handleBloodOcr(body),
    };

    const geminiHandlers = {
      feeding: () => handleFeedingGemini(body),
      nutrition: () => handleNutritionGemini(body),
      hydration: () => handleHydrationGemini(body),
      elimination: () => handleEliminationGemini(body),
      bloodOcr: () => handleBloodOcrGemini(body),
    };

    if (AI_PROVIDER !== 'gemini') {
      return mockHandlers[handlerName]();
    }

    try {
      return await geminiHandlers[handlerName]();
    } catch (error) {
      if (!GEMINI_FALLBACK_TO_MOCK) {
        throw error;
      }
      console.warn(`[gemini] ${handlerName} failed, fallback to mock: ${error.message}`);
      return mockHandlers[handlerName]();
    }
  }

  return {
    checkAiHealth,
    runWithProvider,
    getLastGeminiError: () => lastGeminiError,
  };
}

module.exports = { createHandlers };
