/**
 * API 基底 URL（與 services/ai 解析邏輯一致）
 * 正式環境同源 /api；開發環境可用 EXPO_PUBLIC_API_BASE_URL 或自動偵測
 */
import { NativeModules, Platform } from 'react-native';

function detectDevHost(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname)
    return window.location.hostname;
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) return null;
  try {
    const parsed = new URL(scriptURL);
    return parsed.hostname || null;
  } catch {
    const match = String(scriptURL).match(/^[a-z]+:\/\/([^/:]+)(?::\d+)?/i);
    return match?.[1] || null;
  }
}

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (!__DEV__) return '/api';

  const devHost = detectDevHost();
  if (devHost) return `http://${devHost}:3000/api`;
  return 'http://localhost:3000/api';
}
