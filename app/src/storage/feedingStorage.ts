/**
 * 食物記錄持久化：T0 快取與歷史紀錄
 * 封裝 key、TTL 與 AsyncStorage，Hooks 只呼叫此層
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FEEDING_T0_STORAGE_KEY,
  FEEDING_T0_TTL_MS,
  FEEDING_HISTORY_KEY,
} from '../constants';
import type { StoredFeedingT0, FeedingOwnershipLog } from '../types/app';

export async function getT0Map(): Promise<Record<string, StoredFeedingT0>> {
  try {
    const raw = await AsyncStorage.getItem(FEEDING_T0_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredFeedingT0>;
    const now = Date.now();
    const valid: Record<string, StoredFeedingT0> = {};
    let changed = false;
    for (const [id, img] of Object.entries(parsed)) {
      if (now - img.capturedAt <= FEEDING_T0_TTL_MS) {
        valid[id] = img;
      } else {
        changed = true;
      }
    }
    if (changed) await AsyncStorage.setItem(FEEDING_T0_STORAGE_KEY, JSON.stringify(valid));
    return valid;
  } catch {
    await AsyncStorage.removeItem(FEEDING_T0_STORAGE_KEY);
    return {};
  }
}

export async function setT0Map(map: Record<string, StoredFeedingT0>): Promise<void> {
  await AsyncStorage.setItem(FEEDING_T0_STORAGE_KEY, JSON.stringify(map));
}

export async function removeT0Storage(): Promise<void> {
  await AsyncStorage.removeItem(FEEDING_T0_STORAGE_KEY);
}

export async function getFeedingHistory(): Promise<FeedingOwnershipLog[]> {
  try {
    const raw = await AsyncStorage.getItem(FEEDING_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FeedingOwnershipLog[];
  } catch {
    return [];
  }
}

export async function saveFeedingHistory(logs: FeedingOwnershipLog[]): Promise<void> {
  await AsyncStorage.setItem(FEEDING_HISTORY_KEY, JSON.stringify(logs));
}

export { FEEDING_T0_TTL_MS };
