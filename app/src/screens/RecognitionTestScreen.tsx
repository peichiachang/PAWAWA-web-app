import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAiRecognitionService } from '../services/ai';
import { pickFromCamera, pickFromLibrary } from '../utils/camera';
import { interpretBloodReport } from '../services/bloodReport';
import { CapturedImage, VesselCalibration } from '../types/app';
import { useVesselsContext } from '../contexts/VesselsContext';
import type {
  FeedingVisionResult,
  HydrationVisionResult,
  EliminationVisionResult,
  BloodReportOCRResult,
} from '../types/ai';
import type { BloodMarkerInterpretation } from '../types/bloodReport';
import { palette } from '../styles/common';

type TestTab = 'feeding' | 'hydration' | 'elimination' | 'blood';

const TABS: { key: TestTab; label: string }[] = [
  { key: 'feeding', label: '食物紀錄' },
  { key: 'hydration', label: '飲水紀錄' },
  { key: 'elimination', label: '排泄紀錄' },
  { key: 'blood', label: '血液報告' },
];

const DEFAULT_KCAL_PER_GRAM = 3.5;

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const decimal = value.toFixed(2);
  const isHigh = value >= 0.8;
  const isMid = value >= 0.6 && value < 0.8;
  return (
    <View style={[styles.confidenceBadge, isHigh && styles.confidenceHigh, isMid && styles.confidenceMid]}>
      <Text style={styles.confidenceLabel}>信心度</Text>
      <Text style={styles.confidenceNumber}>{pct}%</Text>
      <Text style={styles.confidenceDecimal}>({decimal})</Text>
    </View>
  );
}

export function RecognitionTestScreen({ onClose }: { onClose: () => void }) {
  const ai = useMemo(() => getAiRecognitionService(), []);
  const { vesselProfiles } = useVesselsContext();
  const [activeTab, setActiveTab] = useState<TestTab>('feeding');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 測試用食碗、水碗：各自只能選一個，來自 食碗管理 的設定 */
  const [testFeedingVesselId, setTestFeedingVesselId] = useState<string | null>(null);
  const [testHydrationVesselId, setTestHydrationVesselId] = useState<string | null>(null);

  const feedingVessels = useMemo(
    () => vesselProfiles.filter((v) => v.vesselType !== 'hydration'),
    [vesselProfiles]
  );
  const hydrationVessels = useMemo(
    () => vesselProfiles.filter((v) => v.vesselType === 'hydration'),
    [vesselProfiles]
  );
  const selectedFeedingVessel = testFeedingVesselId
    ? vesselProfiles.find((v) => v.id === testFeedingVesselId)
    : null;
  const selectedHydrationVessel = testHydrationVesselId
    ? vesselProfiles.find((v) => v.id === testHydrationVesselId)
    : null;

  // 食物：T0, T1
  const [feedingT0, setFeedingT0] = useState<CapturedImage | null>(null);
  const [feedingT1, setFeedingT1] = useState<CapturedImage | null>(null);
  const [feedingResult, setFeedingResult] = useState<FeedingVisionResult | null>(null);

  // 飲水：T0, T1
  const [hydrationT0, setHydrationT0] = useState<CapturedImage | null>(null);
  const [hydrationT1, setHydrationT1] = useState<CapturedImage | null>(null);
  const [hydrationResult, setHydrationResult] = useState<HydrationVisionResult | null>(null);

  // 排泄：單張
  const [eliminationImage, setEliminationImage] = useState<CapturedImage | null>(null);
  const [eliminationResult, setEliminationResult] = useState<EliminationVisionResult | null>(null);

  // 血液：單張 → OCR + 名詞解釋
  const [bloodImage, setBloodImage] = useState<CapturedImage | null>(null);
  const [bloodOcrResult, setBloodOcrResult] = useState<BloodReportOCRResult | null>(null);
  const [bloodInterpretations, setBloodInterpretations] = useState<BloodMarkerInterpretation[] | null>(null);

  const { width } = useWindowDimensions();
  const thumbSize = (width - 16 * 3) / 2;

  async function pickImage(source: 'camera' | 'library') {
    const fn = source === 'camera' ? pickFromCamera : pickFromLibrary;
    return fn();
  }

  function imageToInput(img: CapturedImage) {
    return {
      imageRef: img.uri,
      imageBase64: img.imageBase64,
      mimeType: img.mimeType || 'image/jpeg',
      capturedAt: Date.now(),
    };
  }

  // ---------- 食物 ----------
  async function runFeedingAnalysis() {
    if (!feedingT0?.imageBase64 || !feedingT1?.imageBase64) {
      Alert.alert('請先拍攝或上傳', '食物紀錄需要 T0（給飯前）與 T1（吃完後）兩張照片。');
      return;
    }
    setError(null);
    setFeedingResult(null);
    setAnalyzing(true);
    try {
      const vessel = selectedFeedingVessel ?? undefined;
      const result = await ai.analyzeFeedingImages({
        t0: imageToInput(feedingT0),
        t1: imageToInput(feedingT1),
        vessel,
        isShallow: vessel?.isShallow,
        isDeep: vessel?.isDeep,
      });
      setFeedingResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  // ---------- 飲水 ----------
  async function runHydrationAnalysis() {
    if (!hydrationT0?.imageBase64 || !hydrationT1?.imageBase64) {
      Alert.alert('請先拍攝或上傳', '飲水紀錄需要 W0（初始）與 W1（之後）兩張照片。');
      return;
    }
    setError(null);
    setHydrationResult(null);
    setAnalyzing(true);
    try {
      const vessel = selectedHydrationVessel ?? undefined;
      const result = await ai.analyzeHydrationImages({
        t0: imageToInput(hydrationT0),
        t1: imageToInput(hydrationT1),
        vessel,
      });
      setHydrationResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  // ---------- 排泄 ----------
  async function runEliminationAnalysis() {
    if (!eliminationImage?.imageBase64) {
      Alert.alert('請先拍攝或上傳', '請上傳一張排泄物照片。');
      return;
    }
    setError(null);
    setEliminationResult(null);
    setAnalyzing(true);
    try {
      const result = await ai.analyzeEliminationImage(imageToInput(eliminationImage));
      setEliminationResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  // ---------- 血液報告 ----------
  async function runBloodAnalysis() {
    if (!bloodImage?.imageBase64) {
      Alert.alert('請先拍攝或上傳', '請上傳一張血液報告照片。');
      return;
    }
    setError(null);
    setBloodOcrResult(null);
    setBloodInterpretations(null);
    setAnalyzing(true);
    try {
      const ocrResult = await ai.extractBloodReport(imageToInput(bloodImage));
      setBloodOcrResult(ocrResult);
      const interps = interpretBloodReport(ocrResult.markers);
      setBloodInterpretations(interps);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  function renderImageSlot(
    image: CapturedImage | null,
    label: string,
    onPick: () => void,
    onClear: () => void
  ) {
    return (
      <View style={styles.imageSlot}>
        <Text style={styles.slotLabel}>{label}</Text>
        {image ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: image.uri }} style={[styles.thumb, { width: thumbSize, height: thumbSize }]} />
            <Pressable style={styles.clearBtn} onPress={onClear}>
              <Text style={styles.clearBtnText}>清除</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.placeholder, { width: thumbSize, height: thumbSize }]}>
            <Pressable style={styles.uploadBtn} onPress={onPick}>
              <Text style={styles.uploadBtnText}>拍照 / 上傳</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  function renderVesselSelector(
    label: string,
    vessels: VesselCalibration[],
    selectedId: string | null,
    onSelect: (id: string | null) => void
  ) {
    return (
      <View style={styles.vesselSection}>
        <Text style={styles.vesselLabel}>{label}</Text>
        <View style={styles.vesselChipRow}>
          <Pressable
            style={[styles.vesselChip, selectedId === null && styles.vesselChipActive]}
            onPress={() => onSelect(null)}
          >
            <Text style={[styles.vesselChipText, selectedId === null && styles.vesselChipTextActive]}>未設定</Text>
          </Pressable>
          {vessels.map((v) => (
            <Pressable
              key={v.id}
              style={[styles.vesselChip, selectedId === v.id && styles.vesselChipActive]}
              onPress={() => onSelect(v.id)}
            >
              <Text style={[styles.vesselChipText, selectedId === v.id && styles.vesselChipTextActive]}>
                {v.name}{v.volumeMl != null ? ` ${v.volumeMl}ml` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        {vessels.length === 0 && (
          <Text style={styles.vesselHint}>請至 個人檔案 → 食碗管理 新增食碗／水碗</Text>
        )}
      </View>
    );
  }

  function renderFeedingTab() {
    const canAnalyze = feedingT0 && feedingT1 && !analyzing;
    return (
      <ScrollView style={styles.tabContent}>
        {renderVesselSelector('測試用食碗', feedingVessels, testFeedingVesselId, setTestFeedingVesselId)}
        <View style={styles.twoRow}>
          {renderImageSlot(
            feedingT0,
            'T0（給飯前）',
            async () => {
              const img = await pickImage('library');
              if (img) setFeedingT0(img);
            },
            () => {
              setFeedingT0(null);
              setFeedingResult(null);
            }
          )}
          {renderImageSlot(
            feedingT1,
            'T1（吃完後）',
            async () => {
              const img = await pickImage('library');
              if (img) setFeedingT1(img);
            },
            () => {
              setFeedingT1(null);
              setFeedingResult(null);
            }
          )}
        </View>
        <View style={styles.cameraRow}>
          <Pressable style={styles.secondaryBtn} onPress={async () => { const img = await pickImage('camera'); if (img) setFeedingT0(img); }}>
            <Text style={styles.secondaryBtnText}>T0 拍照</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={async () => { const img = await pickImage('camera'); if (img) setFeedingT1(img); }}>
            <Text style={styles.secondaryBtnText}>T1 拍照</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.analyzeBtn, !canAnalyze && styles.analyzeBtnDisabled]} onPress={runFeedingAnalysis} disabled={!canAnalyze}>
          <Text style={styles.analyzeBtnText}>開始分析</Text>
        </Pressable>
        {feedingResult && (() => {
          const consumed = feedingResult.totalGram ?? 0;
          let t0Gram: number | null = feedingResult.t0EstimatedGram ?? null;
          if (t0Gram == null) {
            const ratio = feedingResult.consumedRatio;
            if (ratio != null && ratio > 0) {
              t0Gram = Math.round(consumed / ratio);
            } else if (selectedFeedingVessel) {
              const vol = selectedFeedingVessel.volumeMl;
              const maxG = selectedFeedingVessel.maxGramsWhenFull;
              if (maxG != null && maxG > 0) {
                t0Gram = Math.round(maxG);
              } else if (vol != null && vol > 0) {
                t0Gram = Math.round(vol * 0.8 * 0.45);
              }
            }
            if (t0Gram == null && consumed > 0) {
              t0Gram = Math.round(consumed / 0.7);
            }
          }
          const t0Kcal = t0Gram != null ? Math.round(t0Gram * DEFAULT_KCAL_PER_GRAM) : null;
          return (
          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <ConfidenceBadge value={feedingResult.confidence ?? 0} />
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>總克數（T0 估算）</Text>
              <Text style={styles.resultValue}>{t0Gram != null ? t0Gram : '—'} g</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>總熱量（估算）</Text>
              <Text style={styles.resultValue}>{t0Kcal != null ? t0Kcal : '—'} kcal</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>消耗克數</Text>
              <Text style={styles.resultValue}>{feedingResult.totalGram ?? '—'} g</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>消耗熱量</Text>
              <Text style={styles.resultValue}>
                {feedingResult.totalGram != null ? Math.round(feedingResult.totalGram * DEFAULT_KCAL_PER_GRAM) : '—'} kcal
              </Text>
            </View>
            {!feedingResult.isBowlMatch && (
              <Text style={styles.warningText}>碗不一致：{feedingResult.mismatchReason ?? '請確認 T0/T1 為同一容器'}</Text>
            )}
          </View>
          );
        })()}
      </ScrollView>
    );
  }

  function renderHydrationTab() {
    const canAnalyze = hydrationT0 && hydrationT1 && !analyzing;
    return (
      <ScrollView style={styles.tabContent}>
        {renderVesselSelector('測試用水碗', hydrationVessels, testHydrationVesselId, setTestHydrationVesselId)}
        <View style={styles.twoRow}>
          {renderImageSlot(
            hydrationT0,
            'W0（初始水量）',
            async () => {
              const img = await pickImage('library');
              if (img) setHydrationT0(img);
            },
            () => {
              setHydrationT0(null);
              setHydrationResult(null);
            }
          )}
          {renderImageSlot(
            hydrationT1,
            'W1（之後）',
            async () => {
              const img = await pickImage('library');
              if (img) setHydrationT1(img);
            },
            () => {
              setHydrationT1(null);
              setHydrationResult(null);
            }
          )}
        </View>
        <View style={styles.cameraRow}>
          <Pressable style={styles.secondaryBtn} onPress={async () => { const img = await pickImage('camera'); if (img) setHydrationT0(img); }}>
            <Text style={styles.secondaryBtnText}>W0 拍照</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={async () => { const img = await pickImage('camera'); if (img) setHydrationT1(img); }}>
            <Text style={styles.secondaryBtnText}>W1 拍照</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.analyzeBtn, !canAnalyze && styles.analyzeBtnDisabled]} onPress={runHydrationAnalysis} disabled={!canAnalyze}>
          <Text style={styles.analyzeBtnText}>開始分析</Text>
        </Pressable>
        {hydrationResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <ConfidenceBadge value={hydrationResult.confidence ?? 0} />
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>總水量</Text>
              <Text style={styles.resultValue}>{hydrationResult.waterT0Ml} ml</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>剩餘水量</Text>
              <Text style={styles.resultValue}>{hydrationResult.waterT1Ml} ml</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>消耗水量</Text>
              <Text style={styles.resultValue}>{hydrationResult.actualIntakeMl} ml</Text>
            </View>
            {!hydrationResult.isBowlMatch && (
              <Text style={styles.warningText}>碗不一致：{hydrationResult.mismatchReason ?? '請確認為同一容器'}</Text>
            )}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderEliminationTab() {
    const canAnalyze = eliminationImage && !analyzing;
    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.singleImageRow}>
          {renderImageSlot(
            eliminationImage,
            '排泄物照片',
            async () => {
              const img = await pickImage('library');
              if (img) setEliminationImage(img);
            },
            () => {
              setEliminationImage(null);
              setEliminationResult(null);
            }
          )}
        </View>
        <Pressable style={styles.secondaryBtn} onPress={async () => { const img = await pickImage('camera'); if (img) setEliminationImage(img); }}>
          <Text style={styles.secondaryBtnText}>拍照</Text>
        </Pressable>
        <Pressable style={[styles.analyzeBtn, !canAnalyze && styles.analyzeBtnDisabled]} onPress={runEliminationAnalysis} disabled={!canAnalyze}>
          <Text style={styles.analyzeBtnText}>開始分析</Text>
        </Pressable>
        {eliminationResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <ConfidenceBadge value={eliminationResult.confidence} />
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>顏色</Text>
              <Text style={styles.resultValue}>{eliminationResult.color}</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>Bristol 類型</Text>
              <Text style={styles.resultValue}>Type {eliminationResult.bristolType}</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>形狀／類型</Text>
              <Text style={styles.resultValue}>{eliminationResult.shapeType}</Text>
            </View>
            <View style={styles.resultGrid}>
              <Text style={styles.resultLabel}>是否異常</Text>
              <Text style={styles.resultValue}>{eliminationResult.abnormal ? '是' : '否'}</Text>
            </View>
            {eliminationResult.note ? (
              <View style={styles.noteBlock}>
                <Text style={styles.resultLabel}>說明</Text>
                <Text style={styles.noteText}>{eliminationResult.note}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    );
  }

  function renderBloodTab() {
    const canAnalyze = bloodImage && !analyzing;
    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.singleImageRow}>
          {renderImageSlot(
            bloodImage,
            '血液報告照片',
            async () => {
              const img = await pickImage('library');
              if (img) setBloodImage(img);
            },
            () => {
              setBloodImage(null);
              setBloodOcrResult(null);
              setBloodInterpretations(null);
            }
          )}
        </View>
        <Pressable style={styles.secondaryBtn} onPress={async () => { const img = await pickImage('camera'); if (img) setBloodImage(img); }}>
          <Text style={styles.secondaryBtnText}>拍照</Text>
        </Pressable>
        <Pressable style={[styles.analyzeBtn, !canAnalyze && styles.analyzeBtnDisabled]} onPress={runBloodAnalysis} disabled={!canAnalyze}>
          <Text style={styles.analyzeBtnText}>開始分析</Text>
        </Pressable>
        {(bloodOcrResult || bloodInterpretations) && (
          <View style={styles.resultCard}>
            {bloodOcrResult && (
              <View style={styles.resultRow}>
                <ConfidenceBadge value={bloodOcrResult.confidence ?? 0} />
              </View>
            )}
            {bloodInterpretations && bloodInterpretations.length > 0 ? (
              <>
                <Text style={styles.resultSectionTitle}>名詞解釋</Text>
                {bloodInterpretations.map((item, i) => (
                  <View key={item.code + i} style={styles.bloodItem}>
                    <Text style={styles.bloodCode}>{item.code}</Text>
                    <Text style={styles.bloodName}>{item.nameZh} {item.nameEn ? `(${item.nameEn})` : ''}</Text>
                    <Text style={styles.bloodDesc}>{item.description}</Text>
                    {item.refRange ? <Text style={styles.bloodRef}>參考區間：{item.refRange}</Text> : null}
                    {item.context ? <Text style={styles.bloodContext}>{item.context}</Text> : null}
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.mutedText}>未辨識到可解讀的血液指標，或無對應名詞解釋。</Text>
            )}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>辨識測試</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>關閉</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {analyzing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>AI 分析中…</Text>
        </View>
      ) : (
        <>
          {activeTab === 'feeding' && renderFeedingTab()}
          {activeTab === 'hydration' && renderHydrationTab()}
          {activeTab === 'elimination' && renderEliminationTab()}
          {activeTab === 'blood' && renderBloodTab()}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.chrome,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  closeBtnText: {
    fontSize: 15,
    color: palette.primary,
    fontWeight: '600',
  },
  tabBar: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: palette.primary,
  },
  tabLabel: {
    fontSize: 14,
    color: palette.text,
  },
  tabLabelActive: {
    color: palette.onPrimary,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  vesselSection: {
    marginBottom: 16,
  },
  vesselLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 8,
  },
  vesselChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vesselChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    backgroundColor: palette.surface,
  },
  vesselChipActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  vesselChipText: {
    fontSize: 13,
    color: palette.text,
  },
  vesselChipTextActive: {
    color: palette.onPrimary,
    fontWeight: '600',
  },
  vesselHint: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 6,
  },
  twoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  singleImageRow: {
    marginBottom: 12,
  },
  imageSlot: {
    marginBottom: 8,
  },
  slotLabel: {
    fontSize: 12,
    color: palette.muted,
    marginBottom: 4,
  },
  previewWrap: {
    position: 'relative',
  },
  thumb: {
    borderRadius: 8,
    backgroundColor: palette.border,
  },
  clearBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  clearBtnText: {
    color: '#fff',
    fontSize: 12,
  },
  placeholder: {
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  uploadBtnText: {
    fontSize: 14,
    color: palette.primary,
    fontWeight: '600',
  },
  cameraRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  secondaryBtnText: {
    fontSize: 14,
    color: palette.text,
  },
  analyzeBtn: {
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  analyzeBtnDisabled: {
    opacity: 0.5,
  },
  analyzeBtnText: {
    color: palette.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 16,
  },
  resultRow: {
    marginBottom: 12,
  },
  resultGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  resultLabel: {
    fontSize: 13,
    color: palette.muted,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
  },
  resultSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 12,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: palette.surfaceSoft,
  },
  confidenceHigh: {
    backgroundColor: palette.successBg,
  },
  confidenceMid: {
    backgroundColor: palette.warningBg,
  },
  confidenceLabel: {
    fontSize: 13,
    color: palette.muted,
  },
  confidenceNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  confidenceDecimal: {
    fontSize: 12,
    color: palette.muted,
  },
  warningText: {
    fontSize: 12,
    color: palette.warningText,
    marginTop: 8,
  },
  noteBlock: {
    marginTop: 12,
  },
  noteText: {
    fontSize: 14,
    color: palette.text,
    marginTop: 4,
  },
  bloodItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  bloodCode: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  bloodName: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  bloodDesc: {
    fontSize: 14,
    color: palette.text,
    marginTop: 6,
  },
  bloodRef: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 4,
  },
  bloodContext: {
    fontSize: 13,
    color: palette.infoText,
    marginTop: 4,
  },
  mutedText: {
    fontSize: 13,
    color: palette.muted,
  },
  errorBanner: {
    backgroundColor: palette.dangerBg,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: palette.dangerText,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: palette.muted,
  },
});
