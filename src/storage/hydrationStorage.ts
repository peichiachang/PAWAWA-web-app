/**
 * 飲水記錄持久化：W0 快取與歷史紀錄
 * 封裝 key、TTL 與 AsyncStorage，僅使用新 key（舊 key 由 migration 一次性遷移）
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  HYDRATION_W0_STORAGE_KEY,
  HYDRATION_W0_TTL_MS,
  HYDRATION_HISTORY_KEY,
} from '../constants';
import type { StoredHydrationW0, HydrationOwnershipLog } from '../types/app';

export async function getW0Map(): Promise<Record<string, StoredHydrationW0>> {
  try {
    const raw = await AsyncStorage.getItem(HYDRATION_W0_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredHydrationW0>;
    const now = Date.now();
    const valid: Record<string, StoredHydrationW0> = {};
    let changed = false;
    for (const [id, img] of Object.entries(parsed)) {
      if (now - img.capturedAt <= HYDRATION_W0_TTL_MS) {
        valid[id] = img;
      } else {
        changed = true;
      }
    }
    if (changed) await AsyncStorage.setItem(HYDRATION_W0_STORAGE_KEY, JSON.stringify(valid));
    return valid;
  } catch {
    await AsyncStorage.removeItem(HYDRATION_W0_STORAGE_KEY);
    return {};
  }
}

export async function setW0Map(map: Record<string, StoredHydrationW0>): Promise<void> {
  await AsyncStorage.setItem(HYDRATION_W0_STORAGE_KEY, JSON.stringify(map));
}

export async function getHydrationHistory(): Promise<HydrationOwnershipLog[]> {
  try {
    const raw = await AsyncStorage.getItem(HYDRATION_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HydrationOwnershipLog[];
  } catch {
    return [];
  }
}

export async function saveHydrationHistory(logs: HydrationOwnershipLog[]): Promise<void> {
  await AsyncStorage.setItem(HYDRATION_HISTORY_KEY, JSON.stringify(logs));
}

export { HYDRATION_W0_TTL_MS };
