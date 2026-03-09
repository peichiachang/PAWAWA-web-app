import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiRecognitionService, EliminationVisionResult } from '../types/ai';
import { CapturedImage } from '../types/app';

export const ELIMINATION_HISTORY_KEY = 'carecat:elimination:history';

export type EliminationOwnershipLog = {
  id: string;
  createdAt: number;
  bristolType: number;
  shapeType: string;
  color: string;
  abnormal: boolean;
  selectedTagId: string | null;
};

export function useElimination(
  ai: AiRecognitionService,
  launchCamera: (title: string) => Promise<CapturedImage | null>
) {
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<EliminationVisionResult | null>(null);
  const [image, setImage] = useState<CapturedImage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [ownershipLogs, setOwnershipLogs] = useState<EliminationOwnershipLog[]>([]);

  const reloadOwnershipLogs = useCallback(async () => {
    try {
      const hist = await AsyncStorage.getItem(ELIMINATION_HISTORY_KEY);
      if (hist) setOwnershipLogs(JSON.parse(hist));
    } catch (_e) { }
  }, []);

  useEffect(() => {
    void reloadOwnershipLogs();
  }, [reloadOwnershipLogs]);

  function reset() {
    setDone(false);
    setResult(null);
    setImage(null);
    setSelectedTagId(null);
  }

  /** 由 Modal 內嵌相機拍完後呼叫，接著跑 AI 分析 */
  async function submitImage(photo: CapturedImage) {
    try {
      setIsAnalyzing(true);
      setImage(photo);
      setResult(null);
      setDone(false);

      let analysisResult = null;
      let lastError = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          analysisResult = await ai.analyzeEliminationImage({
            imageBase64: photo.imageBase64,
            mimeType: photo.mimeType,
          });
          if (analysisResult) break;
        } catch (err) {
          lastError = err;
          if (attempt === 3) throw err;
        }
      }

      if (!analysisResult) {
        throw lastError || new Error('分析失敗');
      }

      if (analysisResult.confidence < 0.6) {
        Alert.alert(
          '辨識模糊',
          `信心分數過低 (${Math.round(analysisResult.confidence * 100)}%)，請將便便撈到貓砂鏟上並在光線充足處重新拍攝。`
        );
        setImage(null);
        return;
      }

      setResult(analysisResult);
      setDone(true);
    } catch (error) {
      Alert.alert('AI 分析失敗', (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function saveOwnershipLog(onClose: () => void) {
    if (!result) {
      Alert.alert('無法儲存', '請先完成分析再儲存。');
      return;
    }
    if (!selectedTagId) {
      Alert.alert('無法儲存', '請選擇這筆紀錄屬於誰。');
      return;
    }

    const newLog: EliminationOwnershipLog = {
      id: `elimination_${Date.now()}`,
      createdAt: Date.now(),
      bristolType: result.bristolType,
      shapeType: result.shapeType,
      color: result.color,
      abnormal: result.abnormal,
      selectedTagId: selectedTagId,
    };

    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50); // Keep 50 records
      void AsyncStorage.setItem(ELIMINATION_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    // 儲存後清空照片與分析結果，下次開啟可重新拍攝
    setResult(null);
    setImage(null);
    setDone(false);
    setSelectedTagId(null);

    onClose();

    Alert.alert('儲存完成', '排泄紀錄已儲存。');
  }

  function saveManualLog(
    bristolType: number,
    shapeType: string,
    color: string,
    abnormal: boolean,
    tagId: string | null,
    onClose: () => void
  ) {
    if (!tagId) {
      Alert.alert('請選擇貓咪', '請選擇這筆紀錄屬於誰。');
      return;
    }
    const newLog: EliminationOwnershipLog = {
      id: `elimination_${Date.now()}`,
      createdAt: Date.now(),
      bristolType,
      shapeType,
      color,
      abnormal,
      selectedTagId: tagId,
    };
    setOwnershipLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50);
      void AsyncStorage.setItem(ELIMINATION_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    onClose();
  }

  return {
    done,
    result,
    image,
    isAnalyzing,
    selectedTagId,
    setSelectedTagId,
    ownershipLogs,
    reset,
    submitImage,
    saveOwnershipLog,
    saveManualLog,
    reloadOwnershipLogs,
  };
}
