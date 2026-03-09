import { NativeModules, Platform } from 'react-native';
import { AiImageInput, AiRecognitionService } from '../../types/ai';
import { mockAiService } from './mockAiService';
import { geminiService } from './geminiService';

type ServiceMode = 'mock' | 'http' | 'gemini';

// In production, default to server-side proxy (`http`) for key safety.
const configuredMode = process.env.EXPO_PUBLIC_AI_SERVICE_MODE as ServiceMode | undefined;
const AI_SERVICE_MODE: ServiceMode = __DEV__
  ? (configuredMode || 'mock')
  : (configuredMode === 'mock' || configuredMode === 'http' ? configuredMode : 'http');

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
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  // 原生版正式環境必須設定 API 基底 URL（SDD §5.2）
  if (Platform.OS !== 'web' && !__DEV__) {
    throw new Error('原生版正式環境必須設定 EXPO_PUBLIC_API_BASE_URL');
  }

  // Production web defaults to same-origin serverless API.
  if (!__DEV__) {
    return '/api';
  }

  const devHost = detectDevHost();
  if (devHost) {
    return `http://${devHost}:8080`;
  }

  return 'http://localhost:8080';
}

function createHttpAiService(baseUrl: string): AiRecognitionService {
  async function post<T>(path: string, body: object): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('AI service timeout: 請重試（建議重拍或上傳較小圖片）');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload?.error ? ` - ${payload.error}` : '';
      } catch (_error) {
        // Ignore JSON parse failure and keep status-only message.
      }
      if (response.status === 413) {
        throw new Error('AI service failed: 413 - 圖片太大，請重拍或改用較小圖片');
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
    analyzeFeedingImages: (input) => {
      const vessel = input.vessel;
      const volumeMl = vessel?.volumeMl ?? null;
      const t0RefGrams =
        input.t0.manualWeight != null && input.t0.manualWeight > 0
          ? input.t0.manualWeight
          : vessel?.maxGramsWhenFull != null && vessel.maxGramsWhenFull > 0
            ? Math.round(vessel.maxGramsWhenFull)
            : volumeMl != null && volumeMl > 0
              ? Math.round(volumeMl * 0.8 * 0.45)
              : null;
      return post('/ai/feeding', {
        t0ImageRef: input.t0.imageRef || input.t0.uri || '',
        t0ImageBase64: input.t0.imageBase64 || null,
        t0MimeType: input.t0.mimeType || 'image/jpeg',
        t1ImageRef: input.t1.imageRef || input.t1.uri || '',
        t1ImageBase64: input.t1.imageBase64 || null,
        t1MimeType: input.t1.mimeType || 'image/jpeg',
        vesselVolumeMl: input.vessel?.volumeMl ?? null,
        foodType: input.t0.foodType || input.vessel?.foodType || 'dry',
        manualWeight: input.t0.manualWeight ?? null,
        emptyBowlBase64: input.vessel?.topViewImageBase64 ?? null,
        emptyBowlMimeType: 'image/jpeg',
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
        vesselVolumeMl: input.vessel?.volumeMl ?? null,
        rimDiameterCm: input.vessel?.rimDiameterCm ?? null,
      }),
    analyzeEliminationImage: (input) =>
      post('/ai/elimination', mapImage(input)),
    extractBloodReport: (input) =>
      post('/ai/blood-ocr', mapImage(input)),
    analyzeSideProfile: (input) =>
      post('/ai/side-profile', {
        imageBase64: input.imageBase64,
        mimeType: 'image/jpeg',
        rimDiameterCm: input.rimDiameterCm,
      }),
  };
}

export function getAiRecognitionService(): AiRecognitionService {
  if (AI_SERVICE_MODE === 'gemini') return geminiService;
  if (AI_SERVICE_MODE === 'http') {
    return createHttpAiService(resolveApiBaseUrl());
  }
  return mockAiService;
}
