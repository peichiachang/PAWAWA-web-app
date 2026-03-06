import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { AiRecognitionService, HydrationVisionResult } from '../types/ai';
import type { WaterLevelMarkResult } from '../components/WaterLevelMarker';
import { calculateActualWaterIntakeMl } from '../utils/health';
import { CapturedImage, StoredHydrationW0, HydrationOwnershipLog } from '../types/app';
import {
  HYDRATION_W0_STORAGE_KEY,
  HYDRATION_W0_TTL_MS,
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
  const [w1Done, setW1Done] = useState(false);
  const [result, setResult] = useState<HydrationVisionResult | null>(null);
  const [w0Map, setW0Map] = useState<Record<string, StoredHydrationW0>>({});
  const [w1Image, setW1Image] = useState<CapturedImage | null>(null);
  const [canIdentifyTags, setCanIdentifyTags] = useState<boolean | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [ownershipLogs, setOwnershipLogs] = useState<HydrationOwnershipLog[]>([]);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [markingImage, setMarkingImage] = useState<{ phase: 'w0' | 'w1', image: CapturedImage } | null>(null);

  const reloadOwnershipLogs = useCallback(async () => {
    try {
      const hist = await AsyncStorage.getItem(HYDRATION_HISTORY_KEY);
      if (hist) setOwnershipLogs(JSON.parse(hist));
    } catch (_e) { }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        // 先嘗試讀取新的 W0 key，如果沒有則讀取舊的 T0 key（向後相容）
        let raw = await AsyncStorage.getItem(HYDRATION_W0_STORAGE_KEY);
        if (!raw) {
          raw = await AsyncStorage.getItem('carecat:hydration:t0'); // 舊 key
        }
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, StoredHydrationW0>;
          const now = Date.now();
          const validMap: Record<string, StoredHydrationW0> = {};
          let changed = false;

          Object.entries(parsed).forEach(([id, img]) => {
            if (now - img.capturedAt <= HYDRATION_W0_TTL_MS) {
              validMap[id] = img;
            } else {
              changed = true;
            }
          });

          if (changed) {
            await AsyncStorage.setItem(HYDRATION_W0_STORAGE_KEY, JSON.stringify(validMap));
          }
          setW0Map(validMap);
        }
        await reloadOwnershipLogs();
      } catch (_e) { }
    }
    void init();
  }, [reloadOwnershipLogs]);

  async function persistW0Map(map: Record<string, StoredHydrationW0>) {
    await AsyncStorage.setItem(HYDRATION_W0_STORAGE_KEY, JSON.stringify(map));
  }

  const currentW0 = vessels.selectedVesselId ? w0Map[vessels.selectedVesselId] : null;
  const w0Done = Boolean(currentW0 && (Date.now() - currentW0.capturedAt <= HYDRATION_W0_TTL_MS));

  useEffect(() => {
    // Reset W1 state when vessel changes
    setW1Done(false);
    setW1Image(null);
    setResult(null);
    setMismatchError(null);
    setMarkingImage(null);
  }, [vessels.selectedVesselId]);

  function getRemainingMinutes(): number {
    if (!currentW0) return 0;
    const remaining = HYDRATION_W0_TTL_MS - (Date.now() - currentW0.capturedAt);
    return Math.max(0, Math.floor(remaining / 60000));
  }

  function resetW0() {
    if (vessels.selectedVesselId) {
      const nextMap = { ...w0Map };
      delete nextMap[vessels.selectedVesselId];
      setW0Map(nextMap);
      void persistW0Map(nextMap);
    }
    setW1Done(false);
    setResult(null);
    setMismatchError(null);
  }

  function openReset() {
    setW1Done(false);
    setResult(null);
    setW1Image(null);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
    setMarkingImage(null);
  }

  /** 清除 W1 照片與分析結果（可再重拍） */
  function clearW1() {
    setW1Image(null);
    setW1Done(false);
    setResult(null);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
  }

  // 由 HydrationModal 內嵌相機拍照後呼叫，這裡只負責進入「標記水位」階段
  function startMarking(phase: 'w0' | 'w1', image: CapturedImage) {
    if (phase === 'w1' && (!currentW0 || Date.now() - currentW0.capturedAt > HYDRATION_W0_TTL_MS)) {
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

    if (phase === 'w0') {
      const stored: StoredHydrationW0 = {
        ...image,
        capturedAt: Date.now(),
        waterLevelPct,
        vesselId: vessels.selectedVesselId || undefined,
        bowl_top_y: result.bowl_top_y,
        bowl_bottom_y: result.bowl_bottom_y,
        water_y: result.water_y,
        image_height: result.image_height,
      };
      const nextMap = { ...w0Map, [vessels.selectedVesselId!]: stored };
      setW0Map(nextMap);
      await persistW0Map(nextMap);
      setW1Done(false);
      setResult(null);
      setMismatchError(null);
      setIsAnalyzing(false);
      return;
    }

    // Phase W1：再次確認 W0 尚未過期（防止使用者在標記介面停留過久）
    if (!currentW0 || Date.now() - currentW0.capturedAt > HYDRATION_W0_TTL_MS) {
      Alert.alert('W0 已過期', 'W0 記錄已超過 24 小時，請重新拍攝 W0。');
      setIsAnalyzing(false);
      return;
    }

    // Phase W1
    const storedW1 = {
      ...image,
      capturedAt: Date.now(),
      waterLevelPct,
      bowl_top_y: result.bowl_top_y,
      bowl_bottom_y: result.bowl_bottom_y,
      water_y: result.water_y,
      image_height: result.image_height,
    };
    setW1Image(storedW1);

    try {
      setIsAnalyzing(true);
      const w0 = currentW0!;
      const vessel = vessels.currentVessel;
      const volumeMl = vessel?.volumeMl;
      if (!volumeMl || volumeMl <= 0) {
        throw new Error('此水碗尚未設定容量，請先到「食碗管理」完成水碗容量校準。');
      }

      // 飲水記錄需先完成水位基準設定（spec v4 邊緣案例：兩種模式共用）
      if (vessel?.vesselType === 'hydration' && !vessel?.fullWaterCalibration) {
        Alert.alert(
          '請先完成滿量基準設定',
          '請至「個人」→ 食碗管理 → 選擇此水碗／飲水機 → 完成「滿量基準」設定後再記錄飲水。',
          [{ text: '確定', style: 'cancel' }]
        );
        setIsAnalyzing(false);
        return;
      }

      // 純數學計算：兩張都有像素座標時，不呼叫 AI
      const hasPixelData =
        w0.bowl_top_y != null &&
        w0.bowl_bottom_y != null &&
        w0.water_y != null &&
        storedW1.bowl_top_y != null &&
        storedW1.bowl_bottom_y != null &&
        storedW1.water_y != null;

      let analysisResult: HydrationVisionResult | null = null;

      if (hasPixelData) {
        const w0WaterLevelPct = w0.waterLevelPct ?? 0;
        const w1WaterLevelPct = storedW1.waterLevelPct ?? 0;

        // Debug log：追蹤所有相關變數
        console.log('[calibrationMethod]', vessel?.calibrationMethod);
        console.log('[profileContour]', vessel?.profileContour);
        console.log('[profileContour is null?]', vessel?.profileContour === null);
        console.log('[profileContour is undefined?]', vessel?.profileContour === undefined);
        console.log('[profileContour type]', vessel?.profileContour === null ? 'null' : vessel?.profileContour === undefined ? 'undefined' : typeof vessel?.profileContour);
        console.log('[volumeMl]', volumeMl);
        console.log('[w0WaterLevelPct]', w0WaterLevelPct);
        console.log('[fullWaterCalibration]', vessel?.fullWaterCalibration);

        const { calculateEvaporationMl, calculateHydrationVolume } = require('../utils/hydrationMath');

        let waterW0Ml: number;
        let waterW1Ml: number;

        // 【重構】改用抽出至 `hydrationMath.ts` 的純函數運算大腦
        waterW0Ml = calculateHydrationVolume({
          waterLevelPct: w0WaterLevelPct,
          vesselVolumeMl: volumeMl,
          vessel: vessel ?? undefined,
        });

        waterW1Ml = calculateHydrationVolume({
          waterLevelPct: w1WaterLevelPct,
          vesselVolumeMl: volumeMl,
          vessel: vessel ?? undefined,
        });

        // 邊緣案例：計算結果超過容器容量 → 強制重拍（spec v4）
        if (waterW0Ml > volumeMl || waterW1Ml > volumeMl) {
          setResult(null);
          setW1Done(false);
          setW1Image(null);
          setCanIdentifyTags(null);
          setSelectedTagId(null);
          setMismatchError(null);
          const msg = '計算結果超過容器容量，請重新標記水位線。';
          Alert.alert('請重新標記', `⚠️ ${msg}`);
          setIsAnalyzing(false);
          return;
        }

        console.log('[waterW0Ml]', waterW0Ml);
        console.log('[waterW1Ml]', waterW1Ml);

        // 【重構】改用時間差計算真實蒸發率 (預設 0.5ml / hr)
        const envFactorMl = calculateEvaporationMl(w0.capturedAt, storedW1.capturedAt, 0.5);

        // W1 水位高於 W0：偵測到補水，無法計算攝水量
        if (waterW1Ml > waterW0Ml) {
          Alert.alert(
            '偵測到補水',
            `W1 水量（${Math.round(waterW1Ml)}ml）高於 W0（${Math.round(waterW0Ml)}ml），可能在測量期間補過水。\n\n本次紀錄無法計算攝水量，請重新從 W0 開始記錄。`,
            [{ text: '確定', style: 'cancel' }]
          );
          setIsAnalyzing(false);
          return;
        }

        // W1 水位高於 W0 時 actualIntakeMl = 0，不顯示負值（spec 七）
        const actualIntakeMl = Math.max(0, waterW0Ml - waterW1Ml - envFactorMl);

        analysisResult = {
          waterT0Ml: Math.round(waterW0Ml),
          waterT1Ml: Math.round(waterW1Ml),
          tempC: 25,
          humidityPct: 60,
          envFactorMl: Math.round(envFactorMl),
          actualIntakeMl: Math.round(actualIntakeMl),
          isBowlMatch: true,
          mismatchReason: '',
          confidence: vessel?.calibrationMethod === 'side_profile' ? 0.95 : 1,
        };
      } else {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            analysisResult = await ai.analyzeHydrationImages({
              t0: currentW0!, // AI 介面仍使用 t0/t1 命名（向後相容）
              t1: storedW1,
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
        setW1Done(false);
        setCanIdentifyTags(null);
        setSelectedTagId(null);
        setMismatchError(analysisResult.mismatchReason || 'W0 與 W1 的碗位辨識不一致，請重拍 W1。');
        Alert.alert('碗位不一致', analysisResult.mismatchReason || '請重拍 W1 或重新拍攝 W0。');
        return;
      }
      setResult(analysisResult);
      setW1Done(true);
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


  /** onSaved(addAnother): addAnother true = 留在畫面並可再記一筆，false = 關閉 modal */
  function saveOwnershipLog(onSaved: (addAnother: boolean) => void) {
    if (!result) {
      Alert.alert('無法儲存', '請先完成 W1 分析再儲存。');
      return;
    }
    if (mismatchError) {
      Alert.alert('無法儲存', 'W0/W1 碗位不一致，請先重拍 W1。');
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
    setW1Image(null);
    setW1Done(false);
    setCanIdentifyTags(null);
    setSelectedTagId(null);
    setMismatchError(null);
    setMarkingImage(null);
    if (vessels.selectedVesselId) {
      const nextMap = { ...w0Map };
      delete nextMap[vessels.selectedVesselId];
      setW0Map(nextMap);
      void persistW0Map(nextMap);
    }

    const catName = cats?.find((c) => c.id === newLog.selectedTagId)?.name ?? newLog.selectedTagId;
    const message = newLog.ownershipType === 'household_only'
      ? '飲水紀錄已寫入家庭看板（全家共用範圍），不隸屬單一貓咪。'
      : `飲水紀錄已寫入家庭看板，並歸屬至 ${catName}。`;
    Alert.alert('儲存完成', message, [
      { text: '再記一筆', onPress: () => onSaved(true) },
      { text: '完成', onPress: () => onSaved(false) },
    ]);
  }

  /** onSaved(addAnother): addAnother true = 留在畫面並可再記一筆，false = 關閉 modal */
  function saveManualLog(ml: number, tagId: string | null, onSaved: (addAnother: boolean) => void) {
    if (!ml || ml <= 0) {
      return; // 驗證由 Modal 處理，此處僅防呆
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
    Alert.alert('儲存完成', '飲水紀錄已寫入。', [
      { text: '再記一筆', onPress: () => onSaved(true) },
      { text: '完成', onPress: () => onSaved(false) },
    ]);
  }

  return {
    ai, // AI 服務（用於側面輪廓識別等）
    w0Done, // 向後相容：保留 t0Done 別名
    t0Done: w0Done,
    w1Done, // 向後相容：保留 t1Done 別名
    t1Done: w1Done,
    result,
    w0Image: currentW0, // 向後相容：保留 t0Image 別名
    t0Image: currentW0,
    w1Image, // 向後相容：保留 t1Image 別名
    t1Image: w1Image,
    canIdentifyTags,
    setCanIdentifyTags,
    selectedTagId,
    setSelectedTagId,
    ownershipLogs,
    mismatchError,
    markingImage,
    isAnalyzing,
    getRemainingMinutes,
    resetW0, // 向後相容：保留 resetT0 別名
    resetT0: resetW0,
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
