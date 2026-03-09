import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VITALS_HISTORY_KEY } from '../constants';
import type { VitalsLog } from '../types/domain';

export function useVitals() {
  const [vitalsLogs, setVitalsLogs] = useState<VitalsLog[]>([]);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(VITALS_HISTORY_KEY);
      setVitalsLogs(raw ? JSON.parse(raw) : []);
    } catch (e) {
      console.error('[useVitals] 讀取失敗', e);
      setVitalsLogs([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveVitals = useCallback(async (next: VitalsLog[]) => {
    setVitalsLogs(next);
    try {
      await AsyncStorage.setItem(VITALS_HISTORY_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[useVitals] 儲存失敗', e);
      throw e;
    }
  }, []);

  return { vitalsLogs, setVitalsLogs, saveVitals, reload };
}
