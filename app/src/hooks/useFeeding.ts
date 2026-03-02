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
  VesselCalibration
} from '../types/app';
import {
  FEEDING_T0_STORAGE_KEY,
  FEEDING_T0_TTL_MS,
  FEEDING_HISTORY_KEY,
  VESSEL_PROFILES_KEY,
  FOOD_NUTRITION_KEY
} from '../constants';
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

  // SDD 2.2 Calibration & Settings
  const [precisionMode, setPrecisionMode] = useState<FeedingPrecisionMode>('standard');

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

  /** 由 Modal 內嵌相機拍完 T0 後呼叫，不經過全域 launchCamera */
  async function submitT0Image(image: CapturedImage, manualWeight?: number) {
    if (!vessels.selectedVesselId) return;
    const stored: StoredFeedingT0 = {
      ...image,
      capturedAt: Date.now(),
      manualWeight,
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
            vessel: vessels.currentVessel || undefined
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

  function saveOwnershipLog(onClose: () => void, note?: string, overrideTotalGram?: number) {
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

    const totalGram = overrideTotalGram && overrideTotalGram > 0
      ? overrideTotalGram
      : result.householdTotalGram;

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
      Alert.alert('儲存完成', '已記錄於家庭看板（Tag A&B&C 範圍），不隸屬單一 tag。');
    } else {
      Alert.alert('儲存完成', `已記錄於家庭看板，並歸屬至 ${catName}。`);
    }
  }

  function saveManualLog(grams: number, tagId: string | null, onClose: () => void, note?: string) {
    if (!grams || grams <= 0) {
      Alert.alert('請輸入克數', '克數必須大於 0。');
      return;
    }
    const newLog: FeedingOwnershipLog = {
      id: `feeding_${Date.now()}`,
      createdAt: Date.now(),
      totalGram: grams,
      kcal: calculateDailyKcalIntake(grams, nutritionResult?.kcalPerGram || 3.5),
      ownershipType: tagId ? 'household_and_tag' : 'household_only',
      selectedTagId: tagId,
      mode: 'standard',
      note: note?.trim() || undefined,
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
    reloadOwnershipLogs,
  };
}
