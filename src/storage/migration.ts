/**
 * 一次性儲存遷移：舊 key → 新 key
 * 在 App 啟動時執行，之後 Hooks 只讀寫新 key
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HYDRATION_W0_STORAGE_KEY } from '../constants';
import type { StoredHydrationW0 } from '../types/app';

const HYDRATION_LEGACY_KEY = 'carecat:hydration:t0';
const MIGRATION_DONE_KEY = 'carecat:migration:hydration_v1';

export async function runStorageMigration(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
    if (done === 'done') return;

    const existing = await AsyncStorage.getItem(HYDRATION_W0_STORAGE_KEY);
    if (existing && existing !== '{}') {
      await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'done');
      return;
    }

    const legacyRaw = await AsyncStorage.getItem(HYDRATION_LEGACY_KEY);
    if (!legacyRaw) {
      await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'done');
      return;
    }

    const parsed = JSON.parse(legacyRaw) as Record<string, StoredHydrationW0>;
    await AsyncStorage.setItem(HYDRATION_W0_STORAGE_KEY, JSON.stringify(parsed));
    await AsyncStorage.removeItem(HYDRATION_LEGACY_KEY);
    await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'done');
  } catch (_e) {
    // 遷移失敗不阻擋 App，僅標記完成避免重試
    await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'done').catch(() => {});
  }
}
