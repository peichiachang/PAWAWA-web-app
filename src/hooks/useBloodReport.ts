import { useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AiRecognitionService } from '../types/ai';
import { BloodReportRecord, BloodMarkerInterpretation } from '../types/bloodReport';
import { CapturedImage } from '../types/app';
import { interpretBloodReport } from '../services/bloodReport';
import { pickFromLibrary } from '../utils/camera';

const BLOOD_REPORTS_STORAGE_KEY = 'carecat:blood-reports';
const MAX_SAVED_REPORTS = 30;

export function useBloodReport(
  ai: AiRecognitionService,
  launchCamera: (title: string) => Promise<CapturedImage | null>
) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [photo, setPhoto] = useState<CapturedImage | null>(null);
  const [interpretations, setInterpretations] = useState<BloodMarkerInterpretation[] | null>(null);
  const [reportDate, setReportDate] = useState<string>('');
  const [savedReports, setSavedReports] = useState<BloodReportRecord[]>([]);

  function reset() {
    setPhoto(null);
    setInterpretations(null);
    setReportDate('');
  }

  async function loadSavedReports() {
    try {
      const raw = await AsyncStorage.getItem(BLOOD_REPORTS_STORAGE_KEY);
      if (!raw) return;
      setSavedReports(JSON.parse(raw) as BloodReportRecord[]);
    } catch (_error) {
      // Ignore storage errors
    }
  }

  /** 從相簿選取後跑 OCR */
  async function runOcr(_source: 'library') {
    try {
      const captured = await pickFromLibrary();
      if (!captured) return;
      await runOcrFromImage(captured);
    } catch (error) {
      Alert.alert('OCR 失敗', (error as Error).message);
    }
  }

  /** 由 Modal 內嵌相機拍完後呼叫，接著跑 OCR */
  async function runOcrFromImage(captured: CapturedImage) {
    try {
      setIsAnalyzing(true);
      setPhoto(captured);
      setInterpretations(null);

      let ocrResult = null;
      let lastError = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          ocrResult = await ai.extractBloodReport(captured);
          if (ocrResult) break;
        } catch (err) {
          lastError = err;
          if (attempt === 3) throw err;
        }
      }

      if (!ocrResult) {
        throw lastError || new Error('分析失敗');
      }

      const confidence = ocrResult.confidence ?? 1.0;
      if (confidence < 0.6) {
        Alert.alert(
          '辨識模糊',
          `信心分數過低 (${Math.round(confidence * 100)}%)，請確保照片清晰並重新拍攝。`
        );
        setPhoto(null);
        return;
      }

      const interps = interpretBloodReport(ocrResult.markers);
      setInterpretations(interps);
      setReportDate(ocrResult.reportDate ?? new Date().toISOString().slice(0, 10));
    } catch (error) {
      Alert.alert('OCR 失敗', (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function saveReport(catId: string, onClose: () => void) {
    if (!photo || !interpretations) {
      Alert.alert('無法儲存', '請先上傳並分析血液報告。');
      return;
    }

    const newRecord: BloodReportRecord = {
      id: `blood_${Date.now()}`,
      catId,
      reportDate,
      photoUri: photo.uri,
      interpretations,
      createdAt: Date.now(),
    };

    try {
      const raw = await AsyncStorage.getItem(BLOOD_REPORTS_STORAGE_KEY);
      const existing: BloodReportRecord[] = raw ? JSON.parse(raw) : [];
      const updated = [newRecord, ...existing].slice(0, MAX_SAVED_REPORTS);
      await AsyncStorage.setItem(BLOOD_REPORTS_STORAGE_KEY, JSON.stringify(updated));
      setSavedReports(updated);
      // 儲存後清空照片與分析結果，下次開啟可重新拍攝
      reset();
      onClose();
      Alert.alert('儲存完成', '血液報告已儲存，照片將永久保留以供核對。');
    } catch (_error) {
      Alert.alert('儲存失敗', '請重試。');
    }
  }

  return {
    isAnalyzing,
    photo,
    interpretations,
    reportDate,
    savedReports,
    reset,
    loadSavedReports,
    runOcr,
    runOcrFromImage,
    saveReport,
  };
}
