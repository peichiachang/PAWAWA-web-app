import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATS_STORAGE_KEY } from '../constants';
import type { CatIdentity } from '../types/domain';

export function useCats() {
  const [cats, setCats] = useState<CatIdentity[]>([]);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CATS_STORAGE_KEY);
      setCats(raw ? JSON.parse(raw) : []);
    } catch (e) {
      console.error('[useCats] 讀取失敗', e);
      setCats([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveCats = useCallback(async (next: CatIdentity[]) => {
    setCats(next);
    try {
      await AsyncStorage.setItem(CATS_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('[useCats] 儲存失敗', e);
      throw e;
    }
  }, []);

  return { cats, setCats, saveCats, reload };
}
