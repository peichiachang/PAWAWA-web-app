import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { AiRecognitionService, HydrationVisionResult } from '../types/ai';
import type { WaterLevelMarkResult } from '../components/WaterLevelMarker';
import { calculateActualWaterIntakeMl } from '../utils/health';
import { CapturedImage, StoredHydrationT0, HydrationOwnershipLog } from '../types/app';
import {
  HYDRATION_T0_STORAGE_KEY,
  HYDRATION_T0_TTL_MS,
  HYDRATION_HISTORY_KEY
} from '../constants';
import { useVessels } from './useVessels';
import type { CatIdentity } from '../types/domain';

export type VesselsFromParent = ReturnType<typeof useVessels>;

export function useHydration(
  ai: AiRecognitionService,
  // launchCamera 目前僅為向後相容，實際拍攝改由 HydrationModal 內嵌相機處理
  _launchCamera: (title: string) => Promise<CapturedImage | null>,
  vesselsFromParent?: ReturnType<typeof useVessels>,
  cats?: CatIdentity[]
) {
  const vesselsInternal = useVessels();
  const vessels = vesselsFromParent ?? vesselsInternal;
  const [t1Done, setT1Done] = useState(false);
  const [result, setResult] = useState<HydrationVisionResult | null>(null);
  const [t0Map, setT0Map] = useState<Record<string, StoredHydrationT0>>({});
  const [t1Image, setT1Image] = useState<CapturedImage | null>(null);
  const [canIdentifyTags, setCanIdentifyTags] = useState<boolean | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [ownershipLogs, setOwnershipLogs] = useState<HydrationOwnershipLog[]>([]);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [markingImage, setMarkingImage] = useState<{ phase: 't0' | 't1', image: CapturedImage } | null>(null);

  const reloadOwnershipLogs = useCallback(async () => {
    try {
      const hist = await AsyncStorage.getItem(HYDRATION_HISTORY_KEY);
      if (hist) setOwnershipLogs(JSON.parse(hist));
    } catch (_e) { }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const raw = await AsyncStorage.getItem(HYDRATION_T0_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, StoredHydrationT0>;
          const now = Date.now();
          const validMap: Record<string, StoredHydrationT0> = {};
          let changed = false;

          Object.entries(parsed).forEach(([id, img]) => {
            if (now - img.capturedAt <= HYDRATION_T0_TTL_MS) {
              validMap[id] = img;
            } else {
              changed = true;
            }
          });

          if (changed) {
            await AsyncStorage.setItem(HYDRATION_T0_STORAGE_KEY, JSON.stringify(validMap));
          }
          setT0Map(validMap);
        }
        await reloadOwnershipLogs();
      } catch (_e) { }
    }
    void init();
  }, [reloadOwnershipLogs]);

  async function persistT0Map(map: Record<string, StoredHydrationT0>) {
    await AsyncStorage.setItem(HYDRATION_T0_STORAGE_KEY, JSON.stringify(map));
  }

  const currentT0 = vessels.selectedVesselId ? t0Map[vessels.selectedVesselId] : null;
  const t0Done = Boolean(currentT0 && (Date.now() - currentT0.capturedAt <= HYDRATION_T0_TTL_MS));

  useEffect(() => {
    // Reset T1 state when vessel changes
    setT1Done(false);
    setT1Image(null);
    setResult(null);
    setMismatchError(null);
    setMarkingImage(null);
  }, [vessels.selectedVesselId]);

  function getRemainingMinutes(): number {
    if (!currentT0) return 0;
    const remaining = HYDRATION_T0_TTL_MS - (Date.now() - currentT0.capturedAt);
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
    setT1Image(null);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
    setMarkingImage(null);
  }

  /** 清除 W1 照片與分析結果（可再重拍） */
  function clearW1() {
    setT1Image(null);
    setT1Done(false);
    setResult(null);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
  }

  // 由 HydrationModal 內嵌相機拍照後呼叫，這裡只負責進入「標記水位」階段
  function startMarking(phase: 't0' | 't1', image: CapturedImage) {
    if (phase === 't1' && (!currentT0 || Date.now() - currentT0.capturedAt > HYDRATION_T0_TTL_MS)) {
      Alert.alert('缺少有效 W0', '請先拍攝並標記給水期 (W0) 的水位，W0 會保留 24 小時。');
      return;
    }
    setMarkingImage({ phase, image });
  }

  async function confirmMarking(result: WaterLevelMarkResult) {
    const { waterLevelPct } = result;
    console.log('[useHydration] confirmMarking called:', waterLevelPct, result);
    if (!markingImage) return;
    const { phase, image } = markingImage;
    setMarkingImage(null);

    if (phase === 't0') {
      const stored: StoredHydrationT0 = {
        ...image,
        capturedAt: Date.now(),
        waterLevelPct,
        vesselId: vessels.selectedVesselId || undefined,
        bowl_top_y: result.bowl_top_y,
        bowl_bottom_y: result.bowl_bottom_y,
        water_y: result.water_y,
        image_height: result.image_height,
      };
      const nextMap = { ...t0Map, [vessels.selectedVesselId!]: stored };
      setT0Map(nextMap);
      await persistT0Map(nextMap);
      setT1Done(false);
      setResult(null);
      setMismatchError(null);
      setIsAnalyzing(false);
      return;
    }

    // Phase T1
    const storedT1 = {
      ...image,
      capturedAt: Date.now(),
      waterLevelPct,
      bowl_top_y: result.bowl_top_y,
      bowl_bottom_y: result.bowl_bottom_y,
      water_y: result.water_y,
      image_height: result.image_height,
    };
    setT1Image(storedT1);

    try {
      setIsAnalyzing(true);
      const t0 = currentT0!;
      const vessel = vessels.currentVessel;
      const volumeMl = vessel?.volumeMl;
      if (!volumeMl || volumeMl <= 0) {
        throw new Error('此水碗尚未設定容量，請先到「食碗管理」完成水碗容量校準。');
      }

      // 純數學計算：兩張都有像素座標時，不呼叫 AI
      const hasPixelData =
        t0.bowl_top_y != null &&
        t0.bowl_bottom_y != null &&
        t0.water_y != null &&
        storedT1.bowl_top_y != null &&
        storedT1.bowl_bottom_y != null &&
        storedT1.water_y != null;

      let analysisResult: HydrationVisionResult | null = null;

      if (hasPixelData) {
        // 使用已標記的 waterLevelPct 計算水量
        // waterLevelPct 定義：0 = 滿（碗口），1 = 空（碗底）
        // 所以水量 = (1 - waterLevelPct) * volumeMl
        const t0WaterLevelPct = t0.waterLevelPct ?? 0;
        const t1WaterLevelPct = storedT1.waterLevelPct ?? 0;
        
        // 如果有側面輪廓校準，使用精確的輪廓計算
        if (vessel?.calibrationMethod === 'side_profile' && vessel.profileContour) {
          const { calculateVolumeToWaterLevel } = require('../utils/profileVolume');
          const waterT0Ml = calculateVolumeToWaterLevel(vessel.profileContour, t0WaterLevelPct);
          const waterT1Ml = calculateVolumeToWaterLevel(vessel.profileContour, t1WaterLevelPct);
          const envFactorMl = Math.max(0, (waterT0Ml - waterT1Ml) * 0.02); // 簡單估算：2% 蒸發
          const actualIntakeMl = Math.max(0, waterT0Ml - waterT1Ml - envFactorMl);
          analysisResult = {
            waterT0Ml: Math.round(waterT0Ml),
            waterT1Ml: Math.round(waterT1Ml),
            tempC: 25,
            humidityPct: 60,
            envFactorMl: Math.round(envFactorMl),
            actualIntakeMl: Math.round(actualIntakeMl),
            isBowlMatch: true,
            mismatchReason: '',
            confidence: 0.95, // 側面輪廓計算的準確度較高
          };
        } else {
          // 使用簡單的線性計算（假設容器是圓柱形）
          // waterLevelPct = 0 時（滿），水量 = volumeMl
          // waterLevelPct = 1 時（空），水量 = 0
          const waterT0Ml = Math.round((1 - Math.max(0, Math.min(1, t0WaterLevelPct))) * volumeMl);
          const waterT1Ml = Math.round((1 - Math.max(0, Math.min(1, t1WaterLevelPct))) * volumeMl);
          const envFactorMl = Math.max(0, (waterT0Ml - waterT1Ml) * 0.02); // 簡單估算：2% 蒸發
          const actualIntakeMl = Math.max(0, waterT0Ml - waterT1Ml - envFactorMl);
          analysisResult = {
            waterT0Ml,
            waterT1Ml,
            tempC: 25,
            humidityPct: 60,
            envFactorMl: Math.round(envFactorMl),
            actualIntakeMl: Math.round(actualIntakeMl),
            isBowlMatch: true,
            mismatchReason: '',
            confidence: 1,
          };
        }
      } else {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            analysisResult = await ai.analyzeHydrationImages({
              t0: currentT0!,
              t1: storedT1,
              vessel: vessels.currentVessel || undefined
            });

            if (!analysisResult) throw new Error('AI 回傳空值');

            if (!analysisResult.isBowlMatch) break;
            if ((analysisResult.confidence ?? 1) >= 0.6) break;
            throw new Error(`AI 辨識信心度過低 (${analysisResult.confidence})`);
          } catch (err) {
            lastError = err as Error;
            if (attempt === 3) throw err;
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          }
        }
        if (!analysisResult) throw lastError || new Error('分析失敗');
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
      setCanIdentifyTags(true);
      setSelectedTagId(null); // 預設由 Modal 依 cats 設定
    } catch (error) {
      Alert.alert('AI 分析失敗', (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function cancelMarking() {
    setMarkingImage(null);
    setIsAnalyzing(false);
  }


  function saveOwnershipLog(onClose: () => void) {
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

    const newLog: HydrationOwnershipLog = {
      id: `hydration_${Date.now()}`,
      createdAt: Date.now(),
      totalMl: result.actualIntakeMl,
      actualWaterMl: result.actualIntakeMl, // Supporting both for now
      ownershipType: canIdentifyTags ? 'household_and_tag' : 'household_only',
      selectedTagId: canIdentifyTags ? selectedTagId : null,
    };

    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      void AsyncStorage.setItem(HYDRATION_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    // 儲存後清空 W0/W1 照片與分析結果，下次開啟可重新拍攝
    setResult(null);
    setT1Image(null);
    setT1Done(false);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
    setMarkingImage(null);
    if (vessels.selectedVesselId) {
      const nextMap = { ...t0Map };
      delete nextMap[vessels.selectedVesselId];
      setT0Map(nextMap);
      void persistT0Map(nextMap);
    }

    onClose();

    const catName = cats?.find((c) => c.id === newLog.selectedTagId)?.name ?? newLog.selectedTagId;
    if (newLog.ownershipType === 'household_only') {
      Alert.alert('儲存完成', '飲水紀錄已寫入家庭看板（全家共用範圍），不隸屬單一貓咪。');
    } else {
      Alert.alert('儲存完成', `飲水紀錄已寫入家庭看板，並歸屬至 ${catName}。`);
    }
  }

  function saveManualLog(ml: number, tagId: string | null, onClose: () => void) {
    if (!ml || ml <= 0) {
      Alert.alert('請輸入飲水量', '飲水量必須大於 0。');
      return;
    }
    const newLog: HydrationOwnershipLog = {
      id: `hydration_${Date.now()}`,
      createdAt: Date.now(),
      totalMl: ml,
      actualWaterMl: ml,
      ownershipType: tagId ? 'household_and_tag' : 'household_only',
      selectedTagId: tagId,
    };
    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      void AsyncStorage.setItem(HYDRATION_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    onClose();
  }

  return {
    ai, // AI 服務（用於側面輪廓識別等）
    t0Done,
    t1Done,
    result,
    t0Image: currentT0,
    t1Image,
    canIdentifyTags,
    setCanIdentifyTags,
    selectedTagId,
    setSelectedTagId,
    ownershipLogs,
    mismatchError,
    markingImage,
    isAnalyzing,
    getRemainingMinutes,
    resetT0,
    clearW1,
    openReset,
    startMarking,
    confirmMarking,
    cancelMarking,
    saveOwnershipLog,
    saveManualLog,
    vessels,
    reloadOwnershipLogs,
  };
}
