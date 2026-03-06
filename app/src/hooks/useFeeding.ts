import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  calculateActualWaterIntakeMl,
  calculateDailyKcalIntake
} from '../utils/health';
import {
  AiRecognitionService,
  FeedingVisionResult,
  NutritionOCRResult
} from '../types/ai';
import {
  CapturedImage,
  StoredFeedingT0,
  FeedingOwnershipLog,
  FeedingPrecisionMode,
  VesselCalibration,
  FoodSourceType,
  IntakeLevel,
  INTAKE_LEVEL_RATIO,
  CannedItem,
  FeedLibraryItem,
  getFeedDisplayName,
} from '../types/app';
import {
  FEEDING_T0_STORAGE_KEY,
  FEEDING_T0_TTL_MS,
  FEEDING_HISTORY_KEY,
  FOOD_NUTRITION_KEY,
  CAN_LIBRARY_KEY,
  FEEDING_FOOD_LIBRARY_KEY,
} from '../constants';
import { DRY_FEED_SEED } from '../constants/feedLibrarySeed';
import type { CatIdentity } from '../types/domain';

import { useVessels } from './useVessels';

export type VesselsFromParent = ReturnType<typeof useVessels>;

export function useFeeding(
  ai: AiRecognitionService,
  launchCamera: (title: string) => Promise<CapturedImage | null>,
  vesselsFromParent?: VesselsFromParent,
  cats?: CatIdentity[]
) {
  const vesselsInternal = useVessels();
  const vessels = vesselsFromParent ?? vesselsInternal;
  const [t1Done, setT1Done] = useState(false);
  const [result, setResult] = useState<FeedingVisionResult | null>(null);
  const [nutritionResult, setNutritionResult] = useState<NutritionOCRResult | null>(null);
  const [t0Map, setT0Map] = useState<Record<string, StoredFeedingT0>>({});
  const [t1Image, setT1Image] = useState<CapturedImage | null>(null);
  const [nutritionImage, setNutritionImage] = useState<CapturedImage | null>(null);
  const [canIdentifyTags, setCanIdentifyTags] = useState<boolean | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [ownershipLogs, setOwnershipLogs] = useState<FeedingOwnershipLog[]>([]);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [canLibrary, setCanLibrary] = useState<CannedItem[]>([]);
  const [feedLibrary, setFeedLibrary] = useState<FeedLibraryItem[]>([]);

  // SDD 2.2 Calibration & Settings
  const [precisionMode, setPrecisionMode] = useState<FeedingPrecisionMode>('standard');

  useEffect(() => {
    async function loadCanLibrary() {
      try {
        const raw = await AsyncStorage.getItem(CAN_LIBRARY_KEY);
        if (raw) {
          const list = (JSON.parse(raw) as CannedItem[]) ?? [];
          setCanLibrary(list);
        } else {
          setCanLibrary([]);
        }
      } catch (_e) {
        setCanLibrary([]);
      }
    }
    void loadCanLibrary();
  }, []);

  useEffect(() => {
    async function loadFeedLibrary() {
      try {
        const raw = await AsyncStorage.getItem(FEEDING_FOOD_LIBRARY_KEY);
        if (raw) {
          const list = (JSON.parse(raw) as FeedLibraryItem[]) ?? [];
          const seedIds = new Set(DRY_FEED_SEED.map((s) => s.id));
          const isOldPrefilled =
            list.length === DRY_FEED_SEED.length &&
            list.every((item) => seedIds.has(item.id));
          if (isOldPrefilled) {
            setFeedLibrary([]);
            await AsyncStorage.setItem(FEEDING_FOOD_LIBRARY_KEY, JSON.stringify([]));
          } else {
            setFeedLibrary(list);
          }
        } else {
          setFeedLibrary([]);
        }
      } catch (_e) {
        setFeedLibrary([]);
      }
    }
    void loadFeedLibrary();
  }, []);

  async function persistCanLibrary(list: CannedItem[]) {
    await AsyncStorage.setItem(CAN_LIBRARY_KEY, JSON.stringify(list));
    setCanLibrary(list);
  }

  function addCanLibraryItem(item: Omit<CannedItem, 'id'>) {
    const newItem: CannedItem = { ...item, id: `can_${Date.now()}` };
    const next = [newItem, ...canLibrary];
    void persistCanLibrary(next);
    return newItem.id;
  }

  function removeCanLibraryItem(id: string) {
    const next = canLibrary.filter(c => c.id !== id);
    void persistCanLibrary(next);
  }

  async function persistFeedLibrary(list: FeedLibraryItem[]) {
    await AsyncStorage.setItem(FEEDING_FOOD_LIBRARY_KEY, JSON.stringify(list));
    setFeedLibrary(list);
  }

  function addFeedLibraryItem(item: Omit<FeedLibraryItem, 'id'>) {
    const newItem: FeedLibraryItem = { ...item, id: `feed_${Date.now()}` };
    const next = [newItem, ...feedLibrary];
    void persistFeedLibrary(next);
    return newItem.id;
  }

  function removeFeedLibraryItem(id: string) {
    const next = feedLibrary.filter(f => f.id !== id);
    void persistFeedLibrary(next);
  }

  const reloadOwnershipLogs = useCallback(async () => {
    try {
      const hist = await AsyncStorage.getItem(FEEDING_HISTORY_KEY);
      if (hist) setOwnershipLogs(JSON.parse(hist));
    } catch (_e) { }
  }, []);

  useEffect(() => {
    async function initSettings() {
      try {
        const nut = await AsyncStorage.getItem(FOOD_NUTRITION_KEY);
        if (nut) setNutritionResult(JSON.parse(nut));
        await reloadOwnershipLogs();
      } catch (_e) { }
    }
    void initSettings();
  }, [reloadOwnershipLogs]);

  useEffect(() => {
    async function loadSavedT0() {
      try {
        const raw = await AsyncStorage.getItem(FEEDING_T0_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, StoredFeedingT0>;

        // Filter out expired T0s
        const now = Date.now();
        const validMap: Record<string, StoredFeedingT0> = {};
        let changed = false;

        Object.entries(parsed).forEach(([id, img]) => {
          if (now - img.capturedAt <= FEEDING_T0_TTL_MS) {
            validMap[id] = img;
          } else {
            changed = true;
          }
        });

        if (changed) {
          await AsyncStorage.setItem(FEEDING_T0_STORAGE_KEY, JSON.stringify(validMap));
        }
        setT0Map(validMap);
      } catch (_error) {
        await AsyncStorage.removeItem(FEEDING_T0_STORAGE_KEY);
      }
    }
    void loadSavedT0();
  }, []);

  async function persistT0Map(map: Record<string, StoredFeedingT0>) {
    await AsyncStorage.setItem(FEEDING_T0_STORAGE_KEY, JSON.stringify(map));
  }

  const currentT0 = vessels.selectedVesselId ? t0Map[vessels.selectedVesselId] : null;
  const t0Done = Boolean(currentT0 && (Date.now() - currentT0.capturedAt <= FEEDING_T0_TTL_MS));

  /** 有有效 T0 但尚未填 T1 的食碗 ID 列表（用於待補填提示與入口） */
  function getPendingT1VesselIds(): string[] {
    const now = Date.now();
    return Object.entries(t0Map)
      .filter(([, v]) => now - v.capturedAt <= FEEDING_T0_TTL_MS)
      .map(([id]) => id);
  }

  useEffect(() => {
    // Reset T1 state when vessel changes
    setT1Done(false);
    setT1Image(null);
    setResult(null);
    setMismatchError(null);
  }, [vessels.selectedVesselId]);
  function getRemainingMinutes(): number {
    if (!currentT0) return 0;
    const remaining = FEEDING_T0_TTL_MS - (Date.now() - currentT0.capturedAt);
    return Math.max(0, Math.floor(remaining / 60000));
  }

  function resetT0() {
    if (vessels.selectedVesselId) {
      const nextMap = { ...t0Map };
      delete nextMap[vessels.selectedVesselId];
      setT0Map(nextMap);
      void persistT0Map(nextMap);
    }
    setT1Done(false);
    setResult(null);
    setMismatchError(null);
  }

  function openReset() {
    setT1Done(false);
    setResult(null);
    setNutritionResult(null);
    setT1Image(null);
    setNutritionImage(null);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
  }

  /** 清除 T1 照片與分析結果（可再重拍） */
  function clearT1() {
    setT1Image(null);
    setT1Done(false);
    setResult(null);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
  }

  /** 清除營養標籤照片與 OCR 結果 */
  function clearNutrition() {
    setNutritionImage(null);
    setNutritionResult(null);
  }

  /** 從飼料庫選一筆帶入本次記錄的熱量（乾糧／自動餵食器流程用） */
  function setNutritionFromFeedLibraryItem(item: FeedLibraryItem) {
    setNutritionResult({
      kcalPerGram: item.kcalPerGram,
      proteinPct: 0,
      phosphorusPct: 0,
      rawText: getFeedDisplayName(item),
    });
  }

  /** 由 Modal 內嵌相機拍完 T0 後呼叫，不經過全域 launchCamera */
  async function submitT0Image(image: CapturedImage, manualWeight?: number, foodType?: 'dry' | 'wet' | 'mixed') {
    if (!vessels.selectedVesselId) return;
    const stored: StoredFeedingT0 = {
      ...image,
      capturedAt: Date.now(),
      manualWeight,
      foodType,
      vesselId: vessels.selectedVesselId,
    };
    const nextMap = { ...t0Map, [vessels.selectedVesselId]: stored };
    setT0Map(nextMap);
    await persistT0Map(nextMap);
    setT1Done(false);
    setResult(null);
    setMismatchError(null);
  }

  /** 由 Modal 內嵌相機拍完 T1 後呼叫，接著跑 AI 分析 */
  async function submitT1Image(t1: CapturedImage) {
    if (!currentT0 || Date.now() - currentT0.capturedAt > FEEDING_T0_TTL_MS) {
      Alert.alert('缺少有效 T0', '請先拍攝給飯期 (T0) 照片，T0 會保留 24 小時。');
      return;
    }
    setT1Image(t1);
    try {
      setIsAnalyzing(true);
      let analysisResult = null;
      let lastError = null;

      const analyzeFn = ai.analyzeWithMajorityVote ?? ai.analyzeFeedingImages;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          analysisResult = await analyzeFn.call(ai, {
            t0: currentT0!,
            t1,
            vessel: vessels.currentVessel || undefined,
            isShallow: vessels.currentVessel?.isShallow || undefined,
            isDeep: vessels.currentVessel?.isDeep || undefined,
          });
          if (!analysisResult) throw new Error('AI 回傳空值');

          if (!analysisResult.isBowlMatch) {
            break;
          }

          if ((analysisResult.confidence ?? 1) >= 0.6) {
            break;
          } else {
            throw new Error(`AI 辨識信心度過低 (${analysisResult.confidence})`);
          }
        } catch (err) {
          lastError = err;
          if (attempt === 3) throw err;
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        }
      }

      if (!analysisResult) throw lastError || new Error('分析失敗');

      // SDD 2.5 Reasonableness Check
      const maxPossibleGrams = currentT0!.manualWeight || (vessels.currentVessel?.volumeMl ? vessels.currentVessel.volumeMl * 0.8 : 1000);
      if (analysisResult.householdTotalGram > maxPossibleGrams * 1.1) {
        setMismatchError(`進食量 (${analysisResult.householdTotalGram}g) 不合理地大於預估限制 (${Math.round(maxPossibleGrams)}g)，請確認圖片是否正確。`);
        Alert.alert('異常提示', '辨識出的進食量大於碗內可能容量，請重拍。');
        setT1Done(false);
        setResult(null);
        return;
      }

      if (!analysisResult.isBowlMatch) {
        setResult(null);
        setT1Done(false);
        setCanIdentifyTags(null);
        setSelectedTagId(null);
        setMismatchError(analysisResult.mismatchReason || 'T0 與 T1 的碗位辨識不一致，請重拍 T1。');
        Alert.alert('碗位不一致', analysisResult.mismatchReason || '請重拍 T1 或重新拍攝 T0。');
        return;
      }
      setResult(analysisResult);
      setT1Done(true);
      setMismatchError(null);
      const canIdentify = analysisResult.assignments.length > 0;
      setCanIdentifyTags(canIdentify);
      setSelectedTagId(null); // 預設由 Modal 依 cats 設定
    } catch (error) {
      Alert.alert('AI 分析失敗', (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  /** 由 Modal 內嵌相機拍完營養標籤後呼叫，接著跑 OCR */
  async function submitNutritionImage(image: CapturedImage) {
    try {
      setIsAnalyzing(true);
      setNutritionImage(image);
      const ocrTask = ai.extractNutritionLabel(image);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI 回應超時，請檢查網路連線')), 30000)
      );
      const ocrResult = await Promise.race([ocrTask, timeoutPromise]) as NutritionOCRResult;
      setNutritionResult(ocrResult);
    } catch (error) {
      Alert.alert('OCR 失敗', (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function saveOwnershipLog(
    onClose: () => void,
    note?: string,
    overrideTotalGram?: number,
    opts?: { foodSourceType?: FoodSourceType; intakeLevel?: IntakeLevel; isLateEntry?: boolean; refGramForIntake?: number }
  ) {
    if (!result) {
      Alert.alert('無法儲存', '請先完成 T1 分析再儲存。');
      return;
    }
    if (mismatchError) {
      Alert.alert('無法儲存', 'T0/T1 碗位不一致，請先重拍 T1。');
      return;
    }
    if (canIdentifyTags === null) {
      Alert.alert('無法儲存', '請先選擇是否可辨識 tag。');
      return;
    }
    if (canIdentifyTags && !selectedTagId) {
      Alert.alert('無法儲存', '可辨識時請選擇一個 tag 歸屬。');
      return;
    }

    const intakeLevel = opts?.intakeLevel;
    const refGram = opts?.refGramForIntake ?? overrideTotalGram ?? result.householdTotalGram;
    const totalGram =
      intakeLevel != null && refGram > 0
        ? Math.round(refGram * INTAKE_LEVEL_RATIO[intakeLevel])
        : (overrideTotalGram && overrideTotalGram > 0 ? overrideTotalGram : result.householdTotalGram);

    const newLog: FeedingOwnershipLog = {
      id: `feeding_${Date.now()}`,
      createdAt: Date.now(),
      totalGram,
      kcal: calculateDailyKcalIntake(totalGram, nutritionResult?.kcalPerGram || 3.5),
      ownershipType: canIdentifyTags ? 'household_and_tag' : 'household_only',
      selectedTagId: canIdentifyTags ? selectedTagId : null,
      mode: precisionMode,
      confidence: result.confidence,
      vesselId: vessels.selectedVesselId || undefined,
      note: note?.trim() || undefined,
      foodSourceType: opts?.foodSourceType ?? 'dry_once',
      intakeLevel,
      isLateEntry: opts?.isLateEntry,
    };

    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50); // Keep 50 records
      void AsyncStorage.setItem(FEEDING_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    // 儲存後清空 T0/T1 照片與分析結果，下次開啟可重新拍攝
    setResult(null);
    setT1Image(null);
    setT1Done(false);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
    if (vessels.selectedVesselId) {
      const nextMap = { ...t0Map };
      delete nextMap[vessels.selectedVesselId];
      setT0Map(nextMap);
      void persistT0Map(nextMap);
    }

    onClose();

    const catName = cats?.find((c) => c.id === newLog.selectedTagId)?.name ?? newLog.selectedTagId;
    if (newLog.ownershipType === 'household_only') {
      Alert.alert('儲存完成', '已記錄於家庭看板（全家共用範圍），不隸屬單一貓咪。');
    } else {
      Alert.alert('儲存完成', `已記錄於家庭看板，並歸屬至 ${catName}。`);
    }
  }

  function saveManualLog(
    grams: number,
    tagId: string | null,
    onClose: () => void,
    note?: string,
    opts?: { foodSourceType?: FoodSourceType; intakeLevel?: IntakeLevel; canId?: string; ingredients?: string[]; manualFoodType?: string }
  ) {
    if (!grams || grams <= 0) {
      Alert.alert('請輸入克數', '克數必須大於 0。');
      return;
    }
    const intakeLevel = opts?.intakeLevel;
    const totalGram = intakeLevel != null ? Math.round(grams * INTAKE_LEVEL_RATIO[intakeLevel]) : grams;
    const newLog: FeedingOwnershipLog = {
      id: `feeding_${Date.now()}`,
      createdAt: Date.now(),
      totalGram,
      kcal: calculateDailyKcalIntake(totalGram, nutritionResult?.kcalPerGram || 3.5),
      ownershipType: tagId ? 'household_and_tag' : 'household_only',
      selectedTagId: tagId,
      mode: 'standard',
      note: note?.trim() || undefined,
      foodSourceType: opts?.foodSourceType,
      intakeLevel,
      canId: opts?.canId,
      ingredients: opts?.ingredients,
      manualFoodType: opts?.manualFoodType?.trim() || undefined,
    };
    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      void AsyncStorage.setItem(FEEDING_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    onClose();
  }

  /** Spec v1：僅選攝取程度（自動餵食器／自煮等無 T0/T1） */
  function saveIntakeOnlyLog(
    dailyGram: number,
    intakeLevel: IntakeLevel,
    foodSourceType: 'auto_feeder' | 'homemade',
    tagId: string | null,
    onClose: () => void,
    note?: string,
    ingredients?: string[]
  ) {
    if (!dailyGram || dailyGram <= 0) {
      Alert.alert('請輸入今日份量', '克數必須大於 0。');
      return;
    }
    const totalGram = Math.round(dailyGram * INTAKE_LEVEL_RATIO[intakeLevel]);
    const newLog: FeedingOwnershipLog = {
      id: `feeding_${Date.now()}`,
      createdAt: Date.now(),
      totalGram,
      kcal: calculateDailyKcalIntake(totalGram, nutritionResult?.kcalPerGram || 3.5),
      ownershipType: tagId ? 'household_and_tag' : 'household_only',
      selectedTagId: tagId,
      mode: 'standard',
      foodSourceType,
      intakeLevel,
      ingredients,
    };
    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      void AsyncStorage.setItem(FEEDING_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    onClose();
  }

  /** Spec v3：罐頭記錄（T0 選罐頭+克數，T1 依攝取程度換算） */
  function saveCannedLog(
    canId: string,
    grams: number,
    intakeLevel: IntakeLevel,
    tagId: string | null,
    onClose: () => void,
    kcalPer100?: number
  ) {
    if (!grams || grams <= 0) {
      Alert.alert('請輸入克數', '克數必須大於 0。');
      return;
    }
    const totalGram = Math.round(grams * INTAKE_LEVEL_RATIO[intakeLevel]);
    const kcal = kcalPer100 != null ? (totalGram * kcalPer100) / 100 : calculateDailyKcalIntake(totalGram, nutritionResult?.kcalPerGram || 1.2);
    const newLog: FeedingOwnershipLog = {
      id: `feeding_${Date.now()}`,
      createdAt: Date.now(),
      totalGram,
      kcal,
      ownershipType: tagId ? 'household_and_tag' : 'household_only',
      selectedTagId: tagId,
      mode: 'standard',
      foodSourceType: 'canned',
      intakeLevel,
      canId,
    };
    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      void AsyncStorage.setItem(FEEDING_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    onClose();
  }

  /** 補填記錄：事後補登攝取程度，儲存為 isLateEntry: true（不納入 T0/T1 流程） */
  function saveLateEntryLog(
    gramsRef: number,
    intakeLevel: IntakeLevel,
    tagId: string | null,
    onClose: () => void,
    createdAt?: number
  ) {
    if (!gramsRef || gramsRef <= 0) {
      Alert.alert('請輸入參考克數', '用於換算預估攝取，克數必須大於 0。');
      return;
    }
    const totalGram = Math.round(gramsRef * INTAKE_LEVEL_RATIO[intakeLevel]);
    const ts = createdAt ?? Date.now();
    const newLog: FeedingOwnershipLog = {
      id: `feeding_${ts}`,
      createdAt: ts,
      totalGram,
      kcal: calculateDailyKcalIntake(totalGram, nutritionResult?.kcalPerGram || 3.5),
      ownershipType: tagId ? 'household_and_tag' : 'household_only',
      selectedTagId: tagId,
      mode: 'standard',
      foodSourceType: 'dry_once',
      intakeLevel,
      isLateEntry: true,
    };
    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      void AsyncStorage.setItem(FEEDING_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    onClose();
  }

  return {
    ai, // AI 服務（用於側面輪廓識別等）
    t0Done,
    t1Done,
    result,
    nutritionResult,
    t0Image: currentT0,
    t1Image,
    nutritionImage,
    canIdentifyTags,
    setCanIdentifyTags,
    selectedTagId,
    setSelectedTagId,
    ownershipLogs,
    mismatchError,
    isAnalyzing,
    precisionMode,
    setPrecisionMode,
    vessels,
    getRemainingMinutes,
    resetT0,
    clearT1,
    clearNutrition,
    openReset,
    submitT0Image,
    submitT1Image,
    submitNutritionImage,
    saveOwnershipLog,
    saveManualLog,
    saveIntakeOnlyLog,
    saveCannedLog,
    saveLateEntryLog,
    reloadOwnershipLogs,
    canLibrary,
    addCanLibraryItem,
    removeCanLibraryItem,
    persistCanLibrary,
    feedLibrary,
    addFeedLibraryItem,
    removeFeedLibraryItem,
    setNutritionFromFeedLibraryItem,
    getPendingT1VesselIds,
  };
}
