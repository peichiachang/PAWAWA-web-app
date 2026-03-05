import { Level, BottomTab } from '../types/app';

export const CATS_STORAGE_KEY = 'carecat:cats';
export const VITALS_HISTORY_KEY = 'carecat:vitals:history';

export const FEEDING_T0_STORAGE_KEY = 'carecat:feeding:t0';
export const FEEDING_T0_TTL_MS = 24 * 60 * 60 * 1000;
export const FEEDING_HISTORY_KEY = 'carecat:feeding:history';
export const HYDRATION_W0_STORAGE_KEY = 'carecat:hydration:w0'; // W0/W1 用於飲水記錄
export const HYDRATION_W0_TTL_MS = 24 * 60 * 60 * 1000;
export const HYDRATION_HISTORY_KEY = 'carecat:hydration_v3';
// 向後相容：保留舊的 T0 key
export const HYDRATION_T0_STORAGE_KEY = HYDRATION_W0_STORAGE_KEY;
export const HYDRATION_T0_TTL_MS = HYDRATION_W0_TTL_MS;
export const ELIMINATION_HISTORY_KEY = 'carecat:elimination_v1';
export const MEDICATION_HISTORY_KEY = 'carecat:medication_v1';
export const SYMPTOM_HISTORY_KEY = 'carecat:symptom_v1';
export const VESSEL_PROFILES_KEY = 'carecat:vessel_profiles_v1';
export const FOOD_NUTRITION_KEY = 'carecat:food:nutrition';

export const FEEDING_TAG_OPTIONS = [
  { id: 'A', label: 'Tag A' },
  { id: 'B', label: 'Tag B' },
  { id: 'C', label: 'Tag C' },
];

export const LEVEL_ITEMS: Array<{ key: Level; icon: string; name: string; desc: string }> = [
  { key: 'household', icon: 'home', name: '家庭', desc: '主要看板' },
  { key: 'cat_001', icon: 'pets', name: 'Milo', desc: '個體監控' },
  { key: 'cat_002', icon: 'pets', name: 'Luna', desc: '個體監控' },
];

export const BOTTOM_ITEMS: Array<{ key: BottomTab; icon: string; label: string }> = [
  { key: 'home', icon: 'home', label: '首頁' },
  { key: 'records', icon: 'create', label: '紀錄' },
  { key: 'knowledge', icon: 'menu-book', label: '知識' },
  { key: 'profile', icon: 'person', label: '個人' },
];
