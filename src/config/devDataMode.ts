import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CATS_STORAGE_KEY,
  VITALS_HISTORY_KEY,
  FEEDING_HISTORY_KEY,
  FEEDING_T0_STORAGE_KEY,
  HYDRATION_HISTORY_KEY,
  HYDRATION_T0_STORAGE_KEY,
  MEDICATION_HISTORY_KEY,
  VESSEL_PROFILES_KEY,
} from '../constants';
import { ELIMINATION_HISTORY_KEY } from '../hooks/useElimination';
import { seedMockData } from '../utils/seedMockData';

export type DevDataMode = 'mock' | 'empty';

const DEV_DATA_MODE_KEY = 'carecat:dev_data_mode';

export async function getDevDataMode(): Promise<DevDataMode> {
  try {
    const v = await AsyncStorage.getItem(DEV_DATA_MODE_KEY);
    return (v === 'mock' || v === 'empty' ? v : 'empty') as DevDataMode;
  } catch {
    return 'empty';
  }
}

export async function setDevDataMode(mode: DevDataMode): Promise<void> {
  await AsyncStorage.setItem(DEV_DATA_MODE_KEY, mode);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    CATS_STORAGE_KEY,
    VITALS_HISTORY_KEY,
    FEEDING_HISTORY_KEY,
    FEEDING_T0_STORAGE_KEY,
    HYDRATION_HISTORY_KEY,
    HYDRATION_T0_STORAGE_KEY,
    ELIMINATION_HISTORY_KEY,
    MEDICATION_HISTORY_KEY,
    VESSEL_PROFILES_KEY,
  ]);
}

export async function applyDevDataMode(mode: DevDataMode): Promise<void> {
  await setDevDataMode(mode);
  if (mode === 'mock') {
    await seedMockData();
  } else {
    await clearAllData();
  }
}
