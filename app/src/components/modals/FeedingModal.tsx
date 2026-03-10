import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeeding } from '../../hooks/useFeeding';
import { VesselCalibration, IntakeLevel, INTAKE_LEVEL_LABEL, INTAKE_LEVEL_RATIO, CapturedImage, getFeedDisplayName } from '../../types/app';
import { CatIdentity } from '../../types/domain';
import { styles, palette } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { useState, useEffect, useMemo } from 'react';
import { recalculateVesselVolume } from '../../utils/vesselVolume';
import { CustomCamera } from '../CustomCamera';
import { calculateDailyKcalIntake } from '../../utils/health';
import { getMaxPossibleGrams, shouldWarnHighIntake } from '../../algorithms/feedingBounds';
import type { ConsumptionLevel } from '../../types/ai';

const CONSUMPTION_LEVEL_LABEL: Record<ConsumptionLevel, string> = {
  almost_all_eaten: '幾乎全吃完',
  more_than_half: '吃了大部分',
  about_half: '吃了一半',
  a_little: '只吃了一點',
  almost_none: '幾乎沒有動過',
};

/** 食物紀錄僅兩種模式：乾糧（飼料）、濕食（罐頭） */
const FEEDING_MODE_LABEL: Record<'dry_once' | 'canned', string> = {
  dry_once: '乾糧（飼料）',
  canned: '濕食（罐頭）',
};

interface Props {
  visible: boolean;
  feeding: ReturnType<typeof useFeeding>;
  cats: CatIdentity[];
  onClose: () => void;
  /** 補填記錄模式：僅顯示攝取程度 + 參考克數，儲存為 isLateEntry；complete_t1 = 有 T0 待填 T1，直接進入收碗步驟 */
  initialMode?: 'normal' | 'late_entry' | 'complete_t1';
  /** 待補填時要完成 T1 的食碗 ID（initialMode === 'complete_t1' 時使用） */
  initialVesselIdForT1?: string;
  /** 內嵌於紀錄模式：不包 Modal，只渲染內容，由外層控制顯示 */
  embedded?: boolean;
}

export function FeedingModal({ visible, feeding, cats, onClose, initialMode = 'normal', initialVesselIdForT1, embedded = false }: Props) {
  const {
    t0Done,
    t0Image,
    t1Done,
    t1Image,
    result,
    nutritionResult,
    nutritionImage,
    canIdentifyTags,
    setCanIdentifyTags,
    selectedTagId,
    setSelectedTagId,
    ownershipLogs,
    mismatchError,
    isAnalyzing,
    analyzingPhase,
    getRemainingMinutes,
    resetT0,
    clearT1,
    clearNutrition,
    submitT0Image,
    submitT1Image,
    submitNutritionImage,
    saveOwnershipLog,
    saveManualLog,
    saveIntakeOnlyLog,
    saveCannedLog,
    saveLateEntryLog,
    canLibrary,
    addCanLibraryItem,
    feedLibrary,
    addFeedLibraryItem,
    setNutritionFromFeedLibraryItem,
    vessels,
  } = feeding;

  const {
    vesselProfiles,
    selectedVesselId,
    currentVessel,
    saveVesselProfiles,
    selectVessel,
  } = vessels;

  // 食物記錄只顯示「食碗」
  const feedingVessels = vesselProfiles.filter(p => (p.vesselType || 'feeding') === 'feeding');

  /** 僅使用者已選擇儲存的飼料（不顯示種子庫項目） */
  const savedFeedLibrary = useMemo(
    () => feedLibrary.filter(f => !f.fromSeed),
    [feedLibrary]
  );
  const [manualWeight, setManualWeight] = useState('');
  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('camera');
  const [manualGrams, setManualGrams] = useState('');
  const [manualTagId, setManualTagId] = useState<string | null>(null);
  const [manualFoodType, setManualFoodType] = useState('');
  const [note, setNote] = useState('');
  const [capturePhase, setCapturePhase] = useState<'t0' | 't1' | 'nutrition' | null>(null);
  const [manualBoundaryLevel, setManualBoundaryLevel] = useState<ConsumptionLevel | null>(null);
  /** 乾糧（飼料）／濕食（罐頭），預設乾糧；一切換到食物紀錄即顯示紀錄表，不需再選類型 */
  const [sessionFoodSource, setSessionFoodSource] = useState<'dry_once' | 'canned'>('dry_once');
  const effectiveSessionFoodSource = (initialMode === 'complete_t1' && initialVesselIdForT1) ? 'dry_once' as const : sessionFoodSource;
  const [selectedIntakeLevel, setSelectedIntakeLevel] = useState<IntakeLevel | null>(null);
  const [intakeOnlyTagId, setIntakeOnlyTagId] = useState<string | null>(null);
  /** 補填記錄：參考克數、記錄日期（今天/昨天/前天） */
  const [lateEntryGrams, setLateEntryGrams] = useState('');
  const [lateEntryDateOption, setLateEntryDateOption] = useState<'today' | 'yesterday' | '2days'>('today');
  const [autoFeederFeedSelectOpen, setAutoFeederFeedSelectOpen] = useState(false);

  function resetToBlankRecordScreen() {
    feeding.openReset();
    setCapturePhase(null);
    setInputMode('camera');
    setManualWeight('');
    setManualGrams('');
    setManualTagId(null);
    setManualFoodType('');
    setManualBoundaryLevel(null);
    setNote('');
    setSessionFoodSource('dry_once');
    setSelectedIntakeLevel(null);
    setIntakeOnlyTagId(null);
    setLateEntryGrams('');
    setLateEntryDateOption('today');
    setAutoFeederFeedSelectOpen(false);
  }

  const wetDensity = sessionFoodSource === 'canned' ? 0.95 : 0.45;
  const t0RefGramsForBoundary = t0Image?.manualWeight ?? currentVessel?.maxGramsWhenFull ?? (currentVessel?.volumeMl ? currentVessel.volumeMl * 0.8 * wetDensity : 500);

  const gramsByLevel = (level: ConsumptionLevel): number => {
    const map: Record<ConsumptionLevel, number> = {
      almost_all_eaten: Math.round(0.9 * t0RefGramsForBoundary),
      more_than_half: Math.round(0.75 * t0RefGramsForBoundary),
      about_half: Math.round(0.5 * t0RefGramsForBoundary),
      a_little: Math.round(0.25 * t0RefGramsForBoundary),
      almost_none: 0,
    };
    return map[level];
  };

  const consumedRatio = result?.consumedRatio ?? null;
  const isBoundaryRatio = consumedRatio !== null &&
    (Math.abs(consumedRatio - 0.375) <= 0.07 || Math.abs(consumedRatio - 0.625) <= 0.07);
  const isShallowBowl = (currentVessel?.dimensions?.height ?? 999) < 5;
  const needsBoundaryConfirm = Boolean(result && t1Done && isBoundaryRatio && (isShallowBowl || (result.confidence ?? 1) < 0.9));

  useEffect(() => {
    setManualBoundaryLevel(null);
  }, [result?.consumedRatio, result?.totalGram, t1Image?.uri, visible]);

  // 可分辨貓咪時，若尚未選擇且有多隻貓，預設選第一隻
  useEffect(() => {
    if (canIdentifyTags && !selectedTagId && cats.length > 0) {
      setSelectedTagId(cats[0].id);
    }
  }, [canIdentifyTags, selectedTagId, cats]);

  // 待補填：進入時選定該食碗並顯示乾糧一次給一天流程（T0 已有，直接到 T1）
  useEffect(() => {
    if (!visible || initialMode !== 'complete_t1' || !initialVesselIdForT1) return;
    selectVessel(initialVesselIdForT1);
    setSessionFoodSource('dry_once');
  }, [visible, initialMode, initialVesselIdForT1]);

  const content = capturePhase ? (
        <CustomCamera
          title={
            capturePhase === 't0'
              ? '放飯記錄（T0）— 請拍攝目前碗內狀態'
              : capturePhase === 't1'
                ? '收碗記錄（T1）— 請拍攝剩餘狀態'
                : '營養標籤 OCR — 請拍攝飼料標籤'
          }
          customOptions={
            capturePhase === 't0'
              ? { showGuide: true, guideShape: 'circle', guideText: '請將裝滿食物的碗置於框內' }
              : capturePhase === 't1'
                ? { showGuide: true, guideShape: 'circle', guideText: '請將剩餘食物的碗置於框內' }
                : { showGuide: false, quality: 0.5 }
          }
          onCapture={(image) => {
            if (capturePhase === 't0') {
              const hasDefault = (currentVessel?.defaultPortionGrams ?? 0) > 0;
              const t0Grams = hasDefault ? currentVessel!.defaultPortionGrams : (parseFloat(manualWeight) || undefined);
              const foodType = sessionFoodSource === 'canned' ? 'wet' : 'dry';
              void submitT0Image(image, t0Grams, foodType);
            } else if (capturePhase === 't1') void submitT1Image(image);
            else void submitNutritionImage(image);
            setCapturePhase(null);
          }}
          onCancel={() => setCapturePhase(null)}
        />
      ) : (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {!embedded && (
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{initialMode === 'late_entry' ? '補填記錄' : '食物記錄'}</Text>
              <Pressable onPress={() => { resetToBlankRecordScreen(); onClose(); }}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
          )}
          <ScrollView style={styles.modalBody}>
            {initialMode === 'late_entry' ? (
              <>
                <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 16 }}>忘記記錄收碗時的攝取程度？可在此補登當時的進食狀況，不影響胃口趨勢計算。</Text>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>記錄日期</Text>
                  <View style={styles.choiceRow}>
                    {(['today', 'yesterday', '2days'] as const).map((opt) => (
                      <Pressable key={opt} style={[styles.choiceBtn, lateEntryDateOption === opt && styles.choiceBtnActive]} onPress={() => setLateEntryDateOption(opt)}>
                        <Text style={[styles.choiceBtnText, lateEntryDateOption === opt && styles.choiceBtnTextActive]}>
                          {opt === 'today' ? '今天' : opt === 'yesterday' ? '昨天' : '前天'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>參考克數 (g)</Text>
                  <TextInput style={styles.input} placeholder="例：50（當時約放多少克）" keyboardType="numeric" value={lateEntryGrams} onChangeText={setLateEntryGrams} />
                  <Text style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>用於換算預估攝取，可依當時放飯量估算</Text>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>攝取程度</Text>
                  {(['almost_none', 'some', 'half', 'most', 'all'] as IntakeLevel[]).map((lv) => (
                    <Pressable key={lv} style={[styles.choiceBtn, selectedIntakeLevel === lv && styles.choiceBtnActive, { marginBottom: 8 }]} onPress={() => setSelectedIntakeLevel(lv)}>
                      <Text style={[styles.choiceBtnText, selectedIntakeLevel === lv && styles.choiceBtnTextActive]}>{INTAKE_LEVEL_LABEL[lv]}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>屬於哪隻貓？</Text>
                  <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 8 }]}>
                    <Pressable style={[styles.choiceBtn, intakeOnlyTagId === null && styles.choiceBtnActive]} onPress={() => setIntakeOnlyTagId(null)}>
                      <Text style={[styles.choiceBtnText, intakeOnlyTagId === null && styles.choiceBtnTextActive]}>家庭（共用）</Text>
                    </Pressable>
                    {cats.map(cat => (
                      <Pressable key={cat.id} style={[styles.choiceBtn, intakeOnlyTagId === cat.id && styles.choiceBtnActive]} onPress={() => setIntakeOnlyTagId(cat.id)}>
                        <Text style={[styles.choiceBtnText, intakeOnlyTagId === cat.id && styles.choiceBtnTextActive]}>{cat.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable style={styles.primaryBtn} onPress={() => {
                  const g = parseFloat(lateEntryGrams);
                  if (!g || g <= 0) { Alert.alert('請輸入參考克數', '用於換算預估攝取。'); return; }
                  if (!selectedIntakeLevel) { Alert.alert('請選擇攝取程度', '請選擇當時的進食程度。'); return; }
                  const now = Date.now();
                  const dayMs = 24 * 60 * 60 * 1000;
                  const createdAt = lateEntryDateOption === 'today' ? now : lateEntryDateOption === 'yesterday' ? now - dayMs : now - 2 * dayMs;
                  saveLateEntryLog(g, selectedIntakeLevel, intakeOnlyTagId, () => { resetToBlankRecordScreen(); onClose(); }, createdAt);
                }}>
                  <Text style={styles.primaryBtnText}>儲存補填記錄</Text>
                </Pressable>
              </>
            ) : (
            <>
            {inputMode === 'manual' ? (
              <View>
                <Pressable onPress={() => setInputMode('camera')} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: palette.primary, fontWeight: '600' }}>← 返回選擇食物類型</Text>
                </Pressable>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>食物類型（可自由填寫）</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="例：混飼料、罐頭+乾糧、鮮食"
                    value={manualFoodType}
                    onChangeText={setManualFoodType}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>提供克數 (g)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="例：50"
                    keyboardType="numeric"
                    value={manualGrams}
                    onChangeText={setManualGrams}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>屬於哪隻貓？</Text>
                  <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 8 }]}>
                    <Pressable
                      style={[styles.choiceBtn, manualTagId === null && styles.choiceBtnActive]}
                      onPress={() => setManualTagId(null)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="home" size={16} color={manualTagId === null ? '#fff' : '#000'} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, manualTagId === null && styles.choiceBtnTextActive]}>所有貓</Text></View>
                    </Pressable>
                    {cats.map(cat => (
                      <Pressable
                        key={cat.id}
                        style={[styles.choiceBtn, manualTagId === cat.id && styles.choiceBtnActive]}
                        onPress={() => setManualTagId(cat.id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="pets" size={16} color={manualTagId === cat.id ? '#fff' : '#000'} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, manualTagId === cat.id && styles.choiceBtnTextActive]}>{cat.name}</Text></View>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>備註（選填）</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="例：加了一點水、混了兩種飼料..."
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />
                </View>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => {
                    const g = parseFloat(manualGrams);
                    if (!g || g <= 0) { Alert.alert('請輸入克數', '克數必須大於 0。'); return; }
                    saveManualLog(g, manualTagId, resetToBlankRecordScreen, note, { manualFoodType: manualFoodType || undefined });
                  }}
                >
                  <Text style={styles.primaryBtnText}>儲存記錄</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {(['dry_once', 'canned'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.choiceBtn, effectiveSessionFoodSource === mode && styles.choiceBtnActive, { flex: 1 }]}
                      onPress={() => {
                        if (mode !== effectiveSessionFoodSource) {
                          feeding.openReset();
                          setCapturePhase(null);
                        }
                        setSessionFoodSource(mode);
                      }}
                    >
                      <Text style={[styles.choiceBtnText, effectiveSessionFoodSource === mode && styles.choiceBtnTextActive]}>
                        {FEEDING_MODE_LABEL[mode]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {(effectiveSessionFoodSource === 'dry_once' || effectiveSessionFoodSource === 'canned') && (() => {
                  const isWetFlow = effectiveSessionFoodSource === 'canned';
                  /** 乾糧／濕食共用：T0/T1 拍照 + 營養選填（乾糧）+ 儲存 */
                  const renderT0T1Flow = () => (
                <>
                <View style={styles.infoBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="home" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.infoTitle}>N-Bowl 拍照記錄</Text></View>
                  <Text style={{ fontSize: 12 }}>① 拍 T0（裝滿）→ ② 拍 T1（收碗）→ AI 會自動計算消耗量</Text>
                  {!isWetFlow && <Text style={{ fontSize: 12, marginTop: 4 }}>③ 可再拍成分表，帶入標籤熱量（下方熱量會自動更新）</Text>}
                  {isWetFlow && <Text style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>濕食建議從斜上方約 45° 拍攝，可減少體積誤差</Text>}
                </View>
                {analyzingPhase === 't1' && (
                  <View style={{ padding: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: palette.infoText }}>AI 分析中… 正在計算消耗量</Text>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.formLabel}>① 選擇食碗</Text>
                    {feedingVessels.length === 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <AppIcon name="warning" size={14} color={palette.warningBorder} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, color: palette.warningBorder, fontWeight: '700' }}>請至個人 tab「食碗管理」新增食碗</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.choiceRow, { flexWrap: 'wrap' }]}>
                    {feedingVessels.map((v) => {
                      // 確保顯示的是正確計算的體積
                      const correctedVessel = recalculateVesselVolume(v);
                      const displayVolume = correctedVessel.volumeMl || 0;
                      return (
                      <Pressable
                        key={v.id}
                        style={[styles.choiceBtn, selectedVesselId === v.id && styles.choiceBtnActive, { marginBottom: 8 }]}
                        onPress={() => selectVessel(v.id)}
                      >
                        <Text style={[styles.choiceBtnText, selectedVesselId === v.id && styles.choiceBtnTextActive]}>
                          {v.name}
                          {v.foodType === 'wet' && <Text style={{ fontSize: 10, opacity: 0.8 }}> 罐頭</Text>}
                          {v.foodType === 'dry' && (v.defaultPortionGrams ?? 0) > 0 && (
                            <Text style={{ fontSize: 10, opacity: 0.8 }}> {v.defaultPortionGrams}g</Text>
                          )}
                          {displayVolume > 0 ? (
                            displayVolume > 5000 ? (
                              <Text style={{ color: palette.dangerText, fontWeight: '700' }}> (容量 {Math.round(displayVolume)}ml ⚠️異常)</Text>
                            ) : (
                              (v.foodType === 'dry' || v.foodType == null)
                                ? ` (容量 ${Math.round(displayVolume)}ml，放飯參考約 ${Math.round(displayVolume * 0.8 * 0.45)}g)`
                                : ` (容量 ${Math.round(displayVolume)}ml)`
                            )
                          ) : (
                            ' (未校準)'
                          )}
                        </Text>
                      </Pressable>
                      );
                    })}
                    {feedingVessels.length === 0 && (
                      <View style={{ width: '100%', padding: 12, backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <AppIcon name="warning" size={14} color={palette.warningText} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: palette.warningText }}>尚未建立食碗</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: palette.warningText, lineHeight: 16, marginBottom: 8 }}>
                          完成校準後，AI 辨識誤差可從 ±20% 降至 ±12-15%
                        </Text>
                        <Text style={{ fontSize: 12, color: palette.muted }}>請至「個人」→ 食碗管理 新增食碗</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>① 放飯記錄（T0）</Text>
                  <Pressable
                    style={[styles.cameraUpload, !selectedVesselId && { opacity: 0.5 }]}
                    onPress={() => {
                      if (!selectedVesselId) {
                        Alert.alert(
                          '請先校準食碗',
                          '為了提高 AI 辨識準確度，請先完成食碗校準設定。\n\n請至「個人」tab → 食碗管理 新增食碗。',
                          [{ text: '確定', style: 'cancel' }]
                        );
                        return;
                      }
                      if (!currentVessel?.volumeMl) {
                        Alert.alert(
                          '食碗校準不完整',
                          '此食碗的體積計算不完整，請至「個人」→ 食碗管理 重新校準。',
                          [{ text: '確定', style: 'cancel' }]
                        );
                        return;
                      }
                      setCapturePhase('t0');
                    }}
                  >
                    <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                    <Text style={styles.cameraText}>拍攝裝滿食物的碗</Text>
                    <Text style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>拍攝後即儲存 T0</Text>
                  </Pressable>
                  {(() => {
                    const hasDefaultPortion = (currentVessel?.defaultPortionGrams ?? 0) > 0;
                    return (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 4 }}>輸入克數（選填，可提高準確度）</Text>
                        {hasDefaultPortion && !isWetFlow && (
                          <Text style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>預設：{currentVessel?.defaultPortionGrams}g</Text>
                        )}
                        <TextInput
                          style={[styles.input, { height: 36 }]}
                          placeholder={isWetFlow ? '例：85（半罐）' : '例：50'}
                          keyboardType="numeric"
                          value={manualWeight}
                          onChangeText={setManualWeight}
                        />
                      </View>
                    );
                  })()}
                </View>

                {t0Done && t0Image && (
                  <View style={[styles.aiResult, { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="check-circle" size={18} color="#166534" style={{ marginRight: 6 }} /><Text style={[styles.aiResultTitle, { color: '#166534' }]}>T0 拍攝完成 ({currentVessel?.name})</Text></View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => { resetT0(); setCapturePhase('t0'); }}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#166534' }}
                        >
                          <Text style={{ fontSize: 10, color: '#166534' }}>重新拍攝</Text>
                        </Pressable>
                        <Pressable
                          onPress={resetT0}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                        >
                          <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除照片</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.aiTags}>
                      <Text style={[styles.aiTag, { color: '#166534', borderColor: '#166534' }]}>
                        拍攝於: {new Date(t0Image.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={[styles.aiTag, { color: '#166534', borderColor: '#166534' }]}>
                        有效期剩餘: {getRemainingMinutes()} 分鐘
                      </Text>
                    </View>
                    {(currentVessel?.calibrationMethod === 'dimensions' || currentVessel?.calibrationMethod === 'side_profile') && currentVessel?.feedingContainerMode !== 'auto_feeder' && (
                      <Text style={{ fontSize: 11, color: palette.muted, fontStyle: 'italic', marginTop: 8 }}>僅供參考（此容器為測量尺寸／側面輪廓推估，非滿量基準校準）</Text>
                    )}
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>② 收碗記錄（T1）</Text>
                  <Pressable
                    style={[styles.cameraUpload, !t0Done && { opacity: 0.5 }]}
                    onPress={() => setCapturePhase('t1')}
                  >
                    <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                    <Text style={styles.cameraText}>拍攝剩餘食物的碗</Text>
                  </Pressable>
                </View>

                {t1Image && (
                  <View style={[styles.aiResult, { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <AppIcon name="check-circle" size={18} color="#166534" style={{ marginRight: 6 }} />
                        <Text style={[styles.aiResultTitle, { color: '#166534' }]}>T1 拍攝完成 ({currentVessel?.name})</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => { clearT1(); setCapturePhase('t1'); }}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#166534' }}
                        >
                          <Text style={{ fontSize: 10, color: '#166534' }}>重新拍攝</Text>
                        </Pressable>
                        <Pressable
                          onPress={clearT1}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                        >
                          <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除照片</Text>
                        </Pressable>
                      </View>
                    </View>
                    {(currentVessel?.calibrationMethod === 'dimensions' || currentVessel?.calibrationMethod === 'side_profile') && currentVessel?.feedingContainerMode !== 'auto_feeder' && (
                      <Text style={{ fontSize: 11, color: palette.muted, fontStyle: 'italic', marginTop: 8 }}>僅供參考（此容器為測量尺寸／側面輪廓推估，非滿量基準校準）</Text>
                    )}
                  </View>
                )}

                {t1Done && result && (
                  <View style={styles.aiResult}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="smart-toy" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.aiResultTitle}>AI 分析結果</Text></View>
                    {(() => {
                      const kcalPerGram = nutritionResult?.kcalPerGram || 3.5;
                      const kcal = calculateDailyKcalIntake(result.householdTotalGram, kcalPerGram);
                      const _density = isWetFlow ? 0.95 : 0.45;
                      const maxPossibleGrams =
                        t0Image?.manualWeight ||
                        (currentVessel?.volumeMl ? currentVessel.volumeMl * 0.8 * _density : 1000);
                      const confidence = result.confidence ?? 1;
                      const shouldWarn = confidence < 0.7 || shouldWarnHighIntake(result.householdTotalGram, maxPossibleGrams);

                      return (
                        <>
                          <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 6 }}>AI 依 T0／T1 影像估算本次「吃了多少」與對應熱量：</Text>
                          {result.consumptionLevel && (
                            <View style={{ marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderLeftWidth: 4, borderLeftColor: '#166534' }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534' }}>
                                {CONSUMPTION_LEVEL_LABEL[result.consumptionLevel]}
                              </Text>
                            </View>
                          )}
                          <View style={styles.aiTags}>
                            {t0RefGramsForBoundary > 0 && (
                              <Text style={styles.aiTag}>放飯量（參考）：約 {Math.round(t0RefGramsForBoundary)}g</Text>
                            )}
                            {result.assignments.length > 1 ? result.assignments.map((item) => (
                              <Text key={item.bowlId} style={styles.aiTag}>
                                {item.tag}：{item.estimatedIntakeGram}g
                              </Text>
                            )) : null}
                            <Text style={[styles.aiTag, styles.aiTagHighlight]}>
                              AI 估算攝取：{result.householdTotalGram ?? result.totalGram}g
                            </Text>
                            <Text style={styles.aiTag}>
                              kcal/g：{kcalPerGram}
                              {!nutritionResult ? '（預設）' : nutritionImage ? '（來自成分表 OCR）' : '（來自已選飼料）'}
                            </Text>
                            <Text style={[styles.aiTag, styles.aiTagHighlight]}>
                              AI 估算熱量：{kcal} kcal
                            </Text>
                          </View>

                          {shouldWarn && (
                            <View style={{ marginTop: 10, padding: 10, borderWidth: 2, borderColor: palette.warningBorder, backgroundColor: palette.warningBg, borderRadius: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <AppIcon name="warning" size={16} color={palette.warningText} style={{ marginRight: 6 }} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.warningText }}>克數可能偏差</Text>
                              </View>
                              <Text style={{ fontSize: 12, color: palette.warningText, lineHeight: 18 }}>
                                可能受碗色／曝光／反光影響導致克數估計不穩定。建議重拍（光線均勻、避免反光）或改用手動輸入。
                                {'\n'}參考：信心度 {Math.round(confidence * 100)}%，上限估計 {Math.round(maxPossibleGrams)}g
                              </Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                    {(currentVessel?.calibrationMethod === 'dimensions' || currentVessel?.calibrationMethod === 'side_profile') && currentVessel?.feedingContainerMode !== 'auto_feeder' && (
                      <Text style={{ fontSize: 11, color: palette.muted, fontStyle: 'italic', marginTop: 8 }}>僅供參考（此容器為測量尺寸／側面輪廓推估，非滿量基準校準）</Text>
                    )}

                    {/* Spec v1：攝取程度（乾糧一次給一天） */}
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.formLabel}>攝取程度</Text>
                      <View style={{ gap: 8 }}>
                        {(['almost_none', 'some', 'half', 'most', 'all'] as IntakeLevel[]).map((lv) => {
                          const active = selectedIntakeLevel === lv;
                          const estGram = Math.round(t0RefGramsForBoundary * INTAKE_LEVEL_RATIO[lv]);
                          return (
                            <Pressable
                              key={lv}
                              style={[styles.choiceBtn, active && styles.choiceBtnActive, { marginBottom: 0 }]}
                              onPress={() => setSelectedIntakeLevel(lv)}
                            >
                              <Text style={[styles.choiceBtnText, active && styles.choiceBtnTextActive]}>
                                {INTAKE_LEVEL_LABEL[lv]}
                                {t0RefGramsForBoundary > 0 && `（約 ${estGram}g）`}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {selectedIntakeLevel != null && t0RefGramsForBoundary > 0 && (
                        <Text style={{ fontSize: 11, color: palette.muted, marginTop: 8 }}>
                          預估攝取：{Math.round(t0RefGramsForBoundary * INTAKE_LEVEL_RATIO[selectedIntakeLevel])}g／約 {Math.round(calculateDailyKcalIntake(t0RefGramsForBoundary * INTAKE_LEVEL_RATIO[selectedIntakeLevel], nutritionResult?.kcalPerGram || 3.5))} kcal（僅供參考）
                        </Text>
                      )}
                    </View>

                    {/* Data Attribution */}
                    <View style={{ marginTop: 20 }}>
                      {needsBoundaryConfirm && (
                        <View style={{ marginBottom: 12, padding: 12, borderWidth: 2, borderColor: palette.warningBorder, backgroundColor: palette.warningBg, borderRadius: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <AppIcon name="warning" size={16} color={palette.warningText} style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.warningText }}>邊界區需人工確認</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: palette.warningText, lineHeight: 18, marginBottom: 8 }}>
                            此次辨識落在淺碗邊界區（ratio={consumedRatio?.toFixed(3)}），請選擇較符合實際的進食程度。
                          </Text>
                          <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 8 }]}>
                            {(['a_little', 'about_half', 'more_than_half'] as ConsumptionLevel[]).map((lv) => {
                              const active = manualBoundaryLevel === lv;
                              return (
                                <Pressable
                                  key={lv}
                                  style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                                  onPress={() => setManualBoundaryLevel(lv)}
                                >
                                  <Text style={[styles.choiceBtnText, active && styles.choiceBtnTextActive]}>
                                    {CONSUMPTION_LEVEL_LABEL[lv]}（{gramsByLevel(lv)}g）
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}

                      <Text style={styles.formLabel}>這筆記錄屬於誰？</Text>

                      <View style={styles.choiceRow}>
                        <Pressable
                          style={[styles.choiceBtn, canIdentifyTags === false && styles.choiceBtnActive]}
                          onPress={() => { setCanIdentifyTags(false); setSelectedTagId(null); }}
                        >
                          <Text style={[styles.choiceBtnText, canIdentifyTags === false && styles.choiceBtnTextActive]}>
                            家庭（共用）
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.choiceBtn, canIdentifyTags === true && styles.choiceBtnActive]}
                          onPress={() => {
                            setCanIdentifyTags(true);
                            if (!selectedTagId && cats.length > 0) setSelectedTagId(cats[0].id);
                          }}
                        >
                          <Text style={[styles.choiceBtnText, canIdentifyTags === true && styles.choiceBtnTextActive]}>
                            可分辨貓咪
                          </Text>
                        </Pressable>
                      </View>

                      {canIdentifyTags && (
                        <View style={[styles.tagChoiceRow, { marginTop: 8, flexWrap: 'wrap', gap: 8 }]}>
                          {cats.length === 0 ? (
                            <Text style={{ fontSize: 12, color: palette.muted }}>尚無貓咪檔案，請先至個人新增</Text>
                          ) : (
                            cats.map((cat) => {
                              const active = selectedTagId === cat.id;
                              return (
                                <Pressable
                                  key={cat.id}
                                  style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                                  onPress={() => setSelectedTagId(cat.id)}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <AppIcon name="pets" size={16} color={active ? '#fff' : '#000'} style={{ marginRight: 4 }} />
                                    <Text style={[styles.choiceBtnText, active && styles.choiceBtnTextActive]}>{cat.name}</Text>
                                  </View>
                                </Pressable>
                              );
                            })
                          )}
                        </View>
                      )}

                      <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f5f5', borderWidth: 2, borderColor: '#000' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700' }}>說明：</Text>
                        <Text style={{ fontSize: 12, lineHeight: 18 }}>
                          • 選擇「家庭」→ 僅記錄到家庭看板{'\n'}
                          • 選擇「可分辨貓咪」→ 同時記錄到個體檔案和家庭看板
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                {mismatchError && (
                  <View style={[styles.resultErrorBox, { backgroundColor: '#fef2f2', borderColor: '#dc2626' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <AppIcon name="warning" size={18} color="#dc2626" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626' }}>
                        {mismatchError.includes('404') || mismatchError.includes('500') || mismatchError.includes('502') || mismatchError.includes('503') ? '後端服務錯誤' : mismatchError.includes('碗') || mismatchError.includes('不一致') ? '碗位辨識不一致' : '分析未完成'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#991b1b', lineHeight: 20 }}>
                      {mismatchError}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#991b1b', marginTop: 6 }}>
                      {mismatchError.includes('404') || mismatchError.includes('500') || mismatchError.includes('502') || mismatchError.includes('503')
                        ? '後端 AI 服務暫時無法使用（404/5xx），請稍後再試或確認 API 已正確部署。'
                        : mismatchError.includes('timeout') || mismatchError.includes('超時')
                          ? '連線逾時，請檢查網路後重試。'
                          : mismatchError.includes('碗') || mismatchError.includes('不一致')
                            ? '請確認 T0、T1 為同一只碗、光線與角度相近後重拍 T1。'
                            : '請確認 T0、T1 為同一只碗、光線充足後重拍 T1，或檢查網路連線。'}
                    </Text>
                  </View>
                )}

                {t1Image && !t1Done && !isAnalyzing && !mismatchError && (
                  <View style={{ padding: 12, backgroundColor: palette.warningBg, borderWidth: 1, borderColor: palette.warningBorder, borderRadius: 8, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: palette.warningText }}>T1 已拍攝，但尚未取得分析結果。請檢查上方是否有錯誤訊息，或重拍 T1。</Text>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>③ 選擇已存飼料（選填）</Text>
                  <Pressable
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface }}
                    onPress={() => setAutoFeederFeedSelectOpen((v) => !v)}
                  >
                    <Text style={{ fontSize: 14, color: nutritionResult ? palette.text : palette.muted }} numberOfLines={1}>
                      {nutritionResult ? `${nutritionResult.rawText}（${nutritionResult.kcalPerGram} kcal/g）` : '請選擇一項'}
                    </Text>
                    <Text style={{ fontSize: 14, color: palette.muted }}>{autoFeederFeedSelectOpen ? '▲' : '▼'}</Text>
                  </Pressable>
                  {autoFeederFeedSelectOpen && (
                    <>
                      <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -280, zIndex: 1 }} onPress={() => setAutoFeederFeedSelectOpen(false)} />
                      <View style={{ minHeight: 48, maxHeight: 220, marginTop: 6, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 8, zIndex: 2, overflow: 'hidden' }}>
                        {savedFeedLibrary.length === 0 ? (
                          <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
                            <Text style={{ fontSize: 12, color: palette.muted }}>尚無已儲存的飼料，請前往個人 → 飼料設定選擇平時餵的飼料</Text>
                          </View>
                        ) : (
                          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                            {savedFeedLibrary.map((feed) => (
                              <Pressable
                                key={feed.id}
                                style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}
                                onPress={() => { setNutritionFromFeedLibraryItem(feed); setAutoFeederFeedSelectOpen(false); }}
                              >
                                <Text style={{ fontSize: 14, fontWeight: nutritionResult?.rawText === getFeedDisplayName(feed) ? '600' : '400', color: palette.text }} numberOfLines={2}>
                                  {getFeedDisplayName(feed)}（{feed.kcalPerGram} kcal/g）
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    </>
                  )}
                  {nutritionResult != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <Pressable onPress={clearNutrition} style={{ padding: 6, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}>
                        <Text style={{ fontSize: 11, color: '#dc2626' }}>清除已選飼料</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>④ 成分表／營養標籤 OCR（選填）</Text>
                  <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 8 }}>拍攝標籤後會自動辨識熱量／蛋白／磷，並更新下方「AI 分析結果」的熱量。</Text>
                  {analyzingPhase === 'nutrition' && (
                    <View style={{ padding: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.infoText }}>成分表 OCR 辨識中…</Text>
                    </View>
                  )}
                  <Pressable style={[styles.cameraUpload, analyzingPhase === 'nutrition' && { opacity: 0.7 }]} onPress={() => setCapturePhase('nutrition')} disabled={analyzingPhase === 'nutrition'}>
                    <AppIcon name="receipt" size={28} color="#000" style={styles.cameraIcon} />
                    <Text style={styles.cameraText}>掃描成分表／飼料標籤</Text>
                  </Pressable>
                </View>

                {nutritionResult != null && nutritionImage != null && (
                  <View style={styles.aiResult}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="receipt" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.aiResultTitle}>成分表 OCR 結果</Text></View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => { clearNutrition(); setCapturePhase('nutrition'); }}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#166534' }}
                        >
                          <Text style={{ fontSize: 10, color: '#166534' }}>重新拍攝</Text>
                        </Pressable>
                        <Pressable
                          onPress={clearNutrition}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                        >
                          <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除照片</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            addFeedLibraryItem({
                              product_name: (nutritionResult.rawText?.trim()) || `營養標籤 ${new Date().toISOString().slice(0, 10)}`,
                              display_name: (nutritionResult.rawText?.trim()) || `營養標籤 ${new Date().toISOString().slice(0, 10)}`,
                              food_form: 'dry',
                              is_prescription: 'no',
                              kcalPerGram: nutritionResult.kcalPerGram,
                            });
                            Alert.alert('已加入飼料庫', '之後可在「選擇已存飼料」或個人 → 飼料設定中選用。');
                          }}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#2563eb' }}
                        >
                          <Text style={{ fontSize: 10, color: '#2563eb' }}>存進飼料庫</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.aiTags}>
                      <Text style={[styles.aiTag, styles.aiTagHighlight]}>熱量：{nutritionResult.kcalPerGram} kcal/g</Text>
                      <Text style={styles.aiTag}>蛋白：{nutritionResult.proteinPct}%</Text>
                      <Text style={styles.aiTag}>磷：{nutritionResult.phosphorusPct}%</Text>
                    </View>
                  </View>
                )}
                {nutritionResult != null && nutritionImage == null && (
                  <View style={[styles.aiResult, { opacity: 0.9 }]}>
                    <Text style={styles.aiResultTitle}>目前熱量來源：已選飼料</Text>
                    <Text style={[styles.aiTag, styles.aiTagHighlight]}>熱量：{nutritionResult.kcalPerGram} kcal/g</Text>
                    <Text style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>蛋白／磷未辨識（僅來自已選飼料）。若要由 AI 辨識標籤，請點上方「掃描成分表／飼料標籤」並拍照。</Text>
                    <Pressable onPress={clearNutrition} style={{ alignSelf: 'flex-start', padding: 6, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626', marginTop: 6 }}>
                      <Text style={{ fontSize: 11, color: '#dc2626' }}>清除已選飼料</Text>
                    </Pressable>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>備註（選填）</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="例：加了一點水、混了兩種飼料..."
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />
                </View>

                {isAnalyzing && <ActivityIndicator size="small" color="#000000" style={styles.loadingSpinner} />}

                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => {
                    if (!selectedIntakeLevel) {
                      Alert.alert('請選擇攝取程度', '請選擇貓咪的進食程度（幾乎沒吃～吃完了）後再儲存。');
                      return;
                    }
                    if (needsBoundaryConfirm && !manualBoundaryLevel) {
                      Alert.alert('需人工確認', '請先在邊界確認區塊選擇進食程度，再儲存。');
                      return;
                    }
                    const overrideGram = needsBoundaryConfirm && manualBoundaryLevel
                      ? gramsByLevel(manualBoundaryLevel)
                      : undefined;
                    const refGram = t0RefGramsForBoundary;
                    saveOwnershipLog(
                      resetToBlankRecordScreen,
                      note,
                      overrideGram,
                      refGram > 0
                        ? { foodSourceType: 'dry_once', intakeLevel: selectedIntakeLevel, refGramForIntake: refGram }
                        : { foodSourceType: 'dry_once' }
                    );
                  }}
                >
                  <Text style={styles.primaryBtnText}>儲存記錄</Text>
                </Pressable>
                </>
                  );
                  return renderT0T1Flow();
                })()}
              </>
            )}
            </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
      </KeyboardAvoidingView>
      );

  if (embedded) return <View style={{ flex: 1 }}>{content}</View>;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {content}
    </Modal>
  );
}
