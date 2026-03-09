import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CATS_STORAGE_KEY,
  VITALS_HISTORY_KEY,
  FEEDING_HISTORY_KEY,
  HYDRATION_HISTORY_KEY,
  MEDICATION_HISTORY_KEY,
} from '../constants';
import { ELIMINATION_HISTORY_KEY } from '../hooks/useElimination';
import type { FeedingOwnershipLog, HydrationOwnershipLog } from '../types/app';
import type { CatIdentity, MedicationLog, VitalsLog } from '../types/domain';
import type { EliminationOwnershipLog } from '../hooks/useElimination';

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

function genFeedingLogs(): FeedingOwnershipLog[] {
  const logs: FeedingOwnershipLog[] = [];
  const tags = ['cat_001', 'cat_002', 'cat_003', null] as const;
  let id = 0;
  const notes = ['加了一點水混飼料', '混罐頭', '早飯', '午飯', '晚餐', '小點心', '宵夜'];

  // 今日紀錄（家庭 + 個體，用於今日家庭數據與最近紀錄）
  const todayFeeding: FeedingOwnershipLog[] = [
    { id: `feeding_mock_today_0`, createdAt: now - 2 * 60 * 60 * 1000, totalGram: 45, kcal: 155, ownershipType: 'household_only', selectedTagId: null, mode: 'standard', confidence: 0.85, note: '早飯' },
    { id: `feeding_mock_today_1`, createdAt: now - 6 * 60 * 60 * 1000, totalGram: 38, kcal: 130, ownershipType: 'household_and_tag', selectedTagId: 'cat_001', mode: 'precise', confidence: 0.92, note: 'Milo 午飯' },
    { id: `feeding_mock_today_2`, createdAt: now - 7 * 60 * 60 * 1000, totalGram: 42, kcal: 145, ownershipType: 'household_and_tag', selectedTagId: 'cat_002', mode: 'standard', confidence: 0.78 },
    { id: `feeding_mock_today_3`, createdAt: now - 30 * 60 * 1000, totalGram: 52, kcal: 180, ownershipType: 'household_only', selectedTagId: null, mode: 'standard', confidence: 0.88, note: '晚餐' },
  ];
  logs.push(...todayFeeding);
  id = todayFeeding.length;

  for (let d = 1; d < 45; d++) {
    const recordsPerDay = d < 30 ? 2 + (d % 3) : 1 + (d % 2);
    for (let r = 0; r < recordsPerDay; r++) {
      const tag = tags[(d + r) % 4];
      const hourOffset = r * 6 + (d % 4) * 2;
      logs.push({
        id: `feeding_mock_${id}`,
        createdAt: now - d * day - hourOffset * 60 * 60 * 1000,
        totalGram: 25 + Math.floor(Math.random() * 55),
        kcal: 80 + Math.floor(Math.random() * 180),
        ownershipType: tag ? 'household_and_tag' : 'household_only',
        selectedTagId: tag,
        mode: r % 4 === 0 ? 'precise' : 'standard',
        confidence: 0.72 + Math.random() * 0.25,
        note: recordsPerDay > 1 && r % 3 === 0 ? notes[d % notes.length] : undefined,
      });
      id++;
    }
  }
  return logs.sort((a, b) => b.createdAt - a.createdAt);
}

function genHydrationLogs(): HydrationOwnershipLog[] {
  const logs: HydrationOwnershipLog[] = [];
  const tags = ['cat_001', 'cat_002', 'cat_003', null] as const;
  let id = 0;

  // 今日紀錄（家庭 + 個體）
  const todayHydration: HydrationOwnershipLog[] = [
    { id: `hydration_mock_today_0`, createdAt: now - 3 * 60 * 60 * 1000, totalMl: 120, ownershipType: 'household_only', selectedTagId: null },
    { id: `hydration_mock_today_1`, createdAt: now - 1 * 60 * 60 * 1000, totalMl: 95, ownershipType: 'household_and_tag', selectedTagId: 'cat_001' },
    { id: `hydration_mock_today_2`, createdAt: now - 45 * 60 * 1000, totalMl: 85, ownershipType: 'household_only', selectedTagId: null },
  ];
  logs.push(...todayHydration);
  id = todayHydration.length;

  for (let d = 1; d < 45; d++) {
    const recordsPerDay = d < 35 ? 1 + (d % 2) : 1;
    for (let r = 0; r < recordsPerDay; r++) {
      const tag = tags[(d + r) % 4];
      const hourOffset = r * 8 + (d % 3) * 4;
      logs.push({
        id: `hydration_mock_${id}`,
        createdAt: now - d * day - hourOffset * 60 * 60 * 1000,
        totalMl: 60 + Math.floor(Math.random() * 140),
        ownershipType: tag ? 'household_and_tag' : 'household_only',
        selectedTagId: tag,
      });
      id++;
    }
  }
  return logs.sort((a, b) => b.createdAt - a.createdAt);
}

function genEliminationLogs(): EliminationOwnershipLog[] {
  const logs: EliminationOwnershipLog[] = [];
  const bristolTypes = [2, 3, 4, 5] as const;
  const colors = ['棕色', '深棕', '淺棕'];
  const tags = ['cat_001', 'cat_002', 'cat_003'] as const;

  // 今日紀錄
  const todayElimination: EliminationOwnershipLog[] = [
    { id: `elimination_mock_today_0`, createdAt: now - 4 * 60 * 60 * 1000, bristolType: 3, shapeType: '香腸狀', color: '棕色', abnormal: false, selectedTagId: 'cat_001' },
    { id: `elimination_mock_today_1`, createdAt: now - 2 * 60 * 60 * 1000, bristolType: 4, shapeType: '香腸狀', color: '深棕', abnormal: false, selectedTagId: 'cat_002' },
  ];
  logs.push(...todayElimination);

  for (let i = 0; i < 50; i++) {
    logs.push({
      id: `elimination_mock_${i}`,
      createdAt: now - (i + 1) * day - (i % 5) * 4 * 60 * 60 * 1000,
      bristolType: bristolTypes[i % 4],
      shapeType: '香腸狀',
      color: colors[i % 3],
      abnormal: i % 11 === 0,
      selectedTagId: tags[i % 3],
    });
  }
  return logs.sort((a, b) => b.createdAt - a.createdAt);
}

function genMedicationLogs(): MedicationLog[] {
  const logs: MedicationLog[] = [];
  const meds = [
    { name: '腎臟處方飼料', dosage: '每日 50g', catId: 'cat_001' },
    { name: '磷結合劑', dosage: '每餐 1 顆', catId: 'cat_001' },
    { name: '維他命 B', dosage: '每週 2 次', catId: 'cat_002' },
    { name: '化毛膏', dosage: '每週 1 次', catId: 'cat_002' },
    { name: '減重處方飼料', dosage: '每日 60g', catId: 'cat_003' },
    { name: '關節保健', dosage: '每週 3 次', catId: 'cat_003' },
  ];
  // 今日紀錄
  const todayMedication: MedicationLog[] = [
    { id: `medication_mock_today_0`, catId: 'cat_001', medicationName: '腎臟處方飼料', dosage: '每日 50g', reminderTime: '08:00', createdAt: now - 5 * 60 * 60 * 1000, notes: '飯後服用' },
    { id: `medication_mock_today_1`, catId: 'cat_001', medicationName: '磷結合劑', dosage: '每餐 1 顆', createdAt: now - 4 * 60 * 60 * 1000 },
    { id: `medication_mock_today_2`, catId: 'cat_002', medicationName: '化毛膏', dosage: '每週 1 次', createdAt: now - 2 * 60 * 60 * 1000 },
  ];
  logs.push(...todayMedication);

  for (let i = 0; i < 40; i++) {
    const m = meds[i % meds.length];
    logs.push({
      id: `medication_mock_${i}`,
      catId: m.catId,
      medicationName: m.name,
      dosage: m.dosage,
      reminderTime: i % 2 === 0 ? '08:00' : undefined,
      createdAt: now - (i + 1) * day - (i % 3) * 2 * 60 * 60 * 1000,
      notes: i % 5 === 0 ? '飯後服用' : undefined,
    });
  }
  return logs.sort((a, b) => b.createdAt - a.createdAt);
}

const mockCats: CatIdentity[] = [
  {
    id: 'cat_001',
    name: 'Milo',
    birthDate: '2022-06-12',
    gender: 'male',
    spayedNeutered: true,
    baselineWeightKg: 5.5,
    currentWeightKg: 5.1,
    targetWeightKg: 4.8,
    bcsScore: 7,
    chronicConditions: ['ckd'],
    allergyWhitelist: ['Chicken', 'Turkey'],
    allergyBlacklist: ['Seafood Mix'],
  },
  {
    id: 'cat_002',
    name: 'Luna',
    birthDate: '2021-03-09',
    gender: 'female',
    spayedNeutered: true,
    baselineWeightKg: 4.2,
    currentWeightKg: 4.1,
    targetWeightKg: 4.0,
    bcsScore: 5,
    chronicConditions: [],
    allergyWhitelist: ['Salmon'],
    allergyBlacklist: ['Beef'],
  },
  {
    id: 'cat_003',
    name: '橘子',
    birthDate: '2023-01-15',
    gender: 'male',
    spayedNeutered: false,
    baselineWeightKg: 3.8,
    currentWeightKg: 4.0,
    targetWeightKg: 4.2,
    bcsScore: 4,
    chronicConditions: ['obesity'],
    allergyWhitelist: ['Fish'],
    allergyBlacklist: [],
  },
];

function genVitalsLogs(): VitalsLog[] {
  const logs: VitalsLog[] = [];
  const baseWeights = { cat_001: 5.1, cat_002: 4.1, cat_003: 4.0 };
  for (let i = 0; i < 35; i++) {
    const catId = i % 3 === 0 ? 'cat_001' : i % 3 === 1 ? 'cat_002' : 'cat_003';
    logs.push({
      id: `v_mock_${i}`,
      catId,
      weightKg: baseWeights[catId] - i * 0.01 + (Math.random() - 0.5) * 0.08,
      temperatureC: 38.5 + Math.random() * 0.5,
      medicineFlag: i % 4 === 0,
      timestamp: new Date(now - i * 5 * day).toISOString(),
    });
  }
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function seedMockData(): Promise<void> {
  await AsyncStorage.setItem(CATS_STORAGE_KEY, JSON.stringify(mockCats));
  await AsyncStorage.setItem(VITALS_HISTORY_KEY, JSON.stringify(genVitalsLogs()));
  await AsyncStorage.setItem(FEEDING_HISTORY_KEY, JSON.stringify(genFeedingLogs()));
  await AsyncStorage.setItem(HYDRATION_HISTORY_KEY, JSON.stringify(genHydrationLogs()));
  await AsyncStorage.setItem(ELIMINATION_HISTORY_KEY, JSON.stringify(genEliminationLogs()));
  await AsyncStorage.setItem(MEDICATION_HISTORY_KEY, JSON.stringify(genMedicationLogs()));
}
