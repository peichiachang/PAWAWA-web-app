import { NativeModules } from 'react-native';
import { AiImageInput, AiRecognitionService } from '../../types/ai';
import { mockAiService } from './mockAiService';
import { geminiService } from './geminiService';

type ServiceMode = 'mock' | 'http' | 'gemini';

// Prioritize environment variable, default to 'mock' for safety
const AI_SERVICE_MODE: ServiceMode = (process.env.EXPO_PUBLIC_AI_SERVICE_MODE as ServiceMode) || 'mock';

function detectDevHost(): string | null {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) {
    return null;
  }

  const normalized = scriptURL
    .replace(/^exp:\/\//i, 'http://')
    .replace(/^exps:\/\//i, 'https://');

  try {
    const parsed = new URL(normalized);
    return parsed.hostname || null;
  } catch (_error) {
    const match = normalized.match(/^[a-z]+:\/\/([^/:]+)(?::\d+)?/i);
    return match?.[1] || null;
  }
}

function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  const devHost = detectDevHost();
  if (devHost) {
    return `http://${devHost}:8080`;
  }

  return 'http://localhost:8080';
}

function createHttpAiService(baseUrl: string): AiRecognitionService {
  async function post<T>(path: string, body: object): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload?.error ? ` - ${payload.error}` : '';
      } catch (_error) {
        // Ignore JSON parse failure and keep status-only message.
      }
      throw new Error(`AI service failed: ${response.status}${detail}`);
    }
    return (await response.json()) as T;
  }

  function mapImage(input: AiImageInput) {
    return {
      imageRef: input.imageRef || input.uri || '',
      imageBase64: input.imageBase64 || null,
      mimeType: input.mimeType || 'image/jpeg',
    };
  }

  return {
    analyzeFeedingImages: (input) =>
      post('/ai/feeding', {
        t0ImageRef: input.t0.imageRef || input.t0.uri || '',
        t0ImageBase64: input.t0.imageBase64 || null,
        t0MimeType: input.t0.mimeType || 'image/jpeg',
        t1ImageRef: input.t1.imageRef || input.t1.uri || '',
        t1ImageBase64: input.t1.imageBase64 || null,
        t1MimeType: input.t1.mimeType || 'image/jpeg',
      }),
    extractNutritionLabel: (input) =>
      post('/ai/nutrition-ocr', mapImage(input)),
    analyzeHydrationImages: (input) =>
      post('/ai/hydration', {
        t0ImageRef: input.t0.imageRef || input.t0.uri || '',
        t0ImageBase64: input.t0.imageBase64 || null,
        t0MimeType: input.t0.mimeType || 'image/jpeg',
        t0CapturedAt: input.t0.capturedAt || null,
        t0LevelYPct: input.t0.waterLevelPct ?? null,
        t1ImageRef: input.t1.imageRef || input.t1.uri || '',
        t1ImageBase64: input.t1.imageBase64 || null,
        t1MimeType: input.t1.mimeType || 'image/jpeg',
        t1CapturedAt: input.t1.capturedAt || null,
        t1LevelYPct: input.t1.waterLevelPct ?? null,
      }),
    analyzeEliminationImage: (input) =>
      post('/ai/elimination', mapImage(input)),
    extractBloodReport: (input) =>
      post('/ai/blood-ocr', mapImage(input)),
  };
}

export function getAiRecognitionService(): AiRecognitionService {
  if (AI_SERVICE_MODE === 'gemini') {
    if (!__DEV__) {
      throw new Error('Client-side Gemini mode is disabled in production. Please use EXPO_PUBLIC_AI_SERVICE_MODE=http.');
    }
    return geminiService;
  }
  if (AI_SERVICE_MODE === 'http') {
    return createHttpAiService(resolveApiBaseUrl());
  }
  return mockAiService;
}
