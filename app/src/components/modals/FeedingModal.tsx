import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useFeeding } from '../../hooks/useFeeding';
import { FeedingPrecisionMode, FoodType, VesselCalibration, FoodSourceType, IntakeLevel, INTAKE_LEVEL_LABEL, INTAKE_LEVEL_RATIO, HOMEMADE_INGREDIENTS, CapturedImage, getCannedDisplayName, getFeedDisplayName } from '../../types/app';
import { CatIdentity } from '../../types/domain';
import { styles, palette } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { useState, useEffect, useMemo } from 'react';
import { recalculateVesselVolume } from '../../utils/vesselVolume';
import { CustomCamera } from '../CustomCamera';
import { calculateDailyKcalIntake } from '../../utils/health';
import type { ConsumptionLevel } from '../../types/ai';

const CONSUMPTION_LEVEL_LABEL: Record<ConsumptionLevel, string> = {
  almost_all_eaten: '幾乎全吃完',
  more_than_half: '吃了大部分',
  about_half: '吃了一半',
  a_little: '只吃了一點',
  almost_none: '幾乎沒有動過',
};

const FOOD_SOURCE_LABEL: Record<FoodSourceType, string> = {
  auto_feeder: '自動餵食器',
  dry_once: '乾糧（一次給一天）',
  canned: '罐頭',
  homemade: '自煮',
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
}

export function FeedingModal({ visible, feeding, cats, onClose, initialMode = 'normal', initialVesselIdForT1 }: Props) {
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
    precisionMode,
    setPrecisionMode,
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

  /** 飼料／罐頭列表：已儲存（fromSeed 為 false 或未設）的排前面 */
  const sortedFeedLibrary = useMemo(
    () => [...feedLibrary].sort((a, b) => (a.fromSeed ? 1 : 0) - (b.fromSeed ? 1 : 0)),
    [feedLibrary]
  );
  const sortedCanLibrary = useMemo(
    () => [...canLibrary].sort((a, b) => (a.fromSeed ? 1 : 0) - (b.fromSeed ? 1 : 0)),
    [canLibrary]
  );

  /** 自動餵食器流程：不需相機，單一表單合併今日克數、飼料、攝取程度、貓、儲存 */
  const renderAutoFeederFlow = () => {
    const autoFeederVessels = feedingVessels.filter(v => v.feedingContainerMode === 'auto_feeder');
    const autoVessel = currentVessel?.feedingContainerMode === 'auto_feeder' ? currentVessel : autoFeederVessels[0] ?? null;
    const dailyTotal = autoFeederDailyGram && parseFloat(autoFeederDailyGram) > 0
      ? parseFloat(autoFeederDailyGram)
      : (autoVessel ? (autoVessel.defaultPortionGrams ?? 0) * (autoVessel.dailyPortionCount ?? 1) : 0);
    const dailyCount = autoVessel?.dailyPortionCount ?? 1;
    const estimatedKcal = Math.round(dailyTotal * (nutritionResult?.kcalPerGram || 3.5));

    return (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: palette.muted }}>已選：{FOOD_SOURCE_LABEL.auto_feeder}</Text>
          <Pressable onPress={() => { setSessionFoodSource(null); setAutoFeederT0Confirmed(false); }} style={{ marginLeft: 8 }}><Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>變更</Text></Pressable>
        </View>
        <View style={[styles.infoBox, { marginBottom: 16 }]}>
          <Text style={[styles.formLabel, { marginBottom: 8 }]}>今日設定（自動帶入，可修改）</Text>
          <Text style={{ fontSize: 13, color: palette.text, marginBottom: 4 }}>飼料：{autoVessel?.name ?? '未命名自動餵食器'}</Text>
          <Text style={{ fontSize: 13, color: palette.text, marginBottom: 4 }}>每日總克數：{dailyTotal > 0 ? `${dailyTotal}g／${dailyCount}次` : '—'}</Text>
          <Text style={{ fontSize: 13, color: palette.muted }}>預估熱量：{dailyTotal > 0 ? `約 ${estimatedKcal} kcal` : '—'}</Text>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>今日總克數 (g)</Text>
          <TextInput
            style={styles.input}
            placeholder={dailyTotal > 0 ? String(dailyTotal) : '例：40'}
            keyboardType="numeric"
            value={autoFeederDailyGram}
            onChangeText={setAutoFeederDailyGram}
          />
          <Text style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>可沿用上方自動帶入值或手動輸入</Text>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>選擇已存飼料（選填，用於熱量估算）</Text>
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
                {sortedFeedLibrary.length === 0 ? (
                  <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
                    <Text style={{ fontSize: 12, color: palette.muted }}>尚無飼料，可至個人 → 飼料設定新增</Text>
                  </View>
                ) : (
                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                    {sortedFeedLibrary.map((feed) => (
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
          <Text style={styles.formLabel}>成分表 OCR（選填）</Text>
          <Pressable style={styles.cameraUpload} onPress={() => setCapturePhase('nutrition')}>
            <AppIcon name="receipt" size={28} color="#000" style={styles.cameraIcon} />
            <Text style={styles.cameraText}>掃描成分表／飼料標籤</Text>
          </Pressable>
          {nutritionResult != null && (
            <View style={[styles.aiResult, { marginTop: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <AppIcon name="receipt" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.aiResultTitle}>OCR 結果</Text>
              </View>
              <View style={styles.aiTags}>
                <Text style={[styles.aiTag, styles.aiTagHighlight]}>熱量：{nutritionResult.kcalPerGram} kcal/g</Text>
                <Text style={styles.aiTag}>蛋白：{nutritionResult.proteinPct}%</Text>
                <Text style={styles.aiTag}>磷：{nutritionResult.phosphorusPct}%</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable onPress={() => setCapturePhase('nutrition')} style={{ padding: 6, borderWidth: 1, borderRadius: 4, borderColor: '#166534' }}>
                  <Text style={{ fontSize: 11, color: '#166534' }}>重新拍攝</Text>
                </Pressable>
                <Pressable onPress={clearNutrition} style={{ padding: 6, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}>
                  <Text style={{ fontSize: 11, color: '#dc2626' }}>清除</Text>
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
                  style={{ padding: 6, borderWidth: 1, borderRadius: 4, borderColor: '#2563eb' }}
                >
                  <Text style={{ fontSize: 11, color: '#2563eb' }}>存進飼料庫</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>攝取程度</Text>
          {(['almost_none', 'some', 'half', 'most', 'all'] as IntakeLevel[]).map((lv) => (
            <Pressable key={lv} style={[styles.choiceBtn, selectedIntakeLevel === lv && styles.choiceBtnActive, { marginBottom: 8 }]} onPress={() => setSelectedIntakeLevel(lv)}>
              <Text style={[styles.choiceBtnText, selectedIntakeLevel === lv && styles.choiceBtnTextActive]}>{INTAKE_LEVEL_LABEL[lv]}</Text>
            </Pressable>
          ))}
        </View>
        {selectedIntakeLevel != null && dailyTotal > 0 && (
          <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 12 }}>
            預估攝取：約 {Math.round(dailyTotal * INTAKE_LEVEL_RATIO[selectedIntakeLevel])}g／約 {Math.round(dailyTotal * INTAKE_LEVEL_RATIO[selectedIntakeLevel] * (nutritionResult?.kcalPerGram || 3.5))} kcal（僅供參考）
          </Text>
        )}
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
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            const g = dailyTotal || parseFloat(autoFeederDailyGram);
            if (!g || g <= 0) { Alert.alert('請輸入今日總克數', '請輸入或確認今日總克數（g）。'); return; }
            if (!selectedIntakeLevel) { Alert.alert('請選擇攝取程度', '請選擇貓咪的進食程度。'); return; }
            saveIntakeOnlyLog(g, selectedIntakeLevel, 'auto_feeder', intakeOnlyTagId, resetToBlankRecordScreen);
          }}
        >
          <Text style={styles.primaryBtnText}>儲存記錄</Text>
        </Pressable>
      </>
    );
  };

  const [manualWeight, setManualWeight] = useState('');
  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('camera');
  const [manualGrams, setManualGrams] = useState('');
  const [manualTagId, setManualTagId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sessionFoodType, setSessionFoodType] = useState<FoodType>('dry');
  const [capturePhase, setCapturePhase] = useState<'t0' | 't1' | 'nutrition' | null>(null);
  const [manualBoundaryLevel, setManualBoundaryLevel] = useState<ConsumptionLevel | null>(null);
  const [sessionFoodSource, setSessionFoodSource] = useState<FoodSourceType | null>(null);
  /** 待補填進入時直接視為已選乾糧一次給一天，避免先顯示食物類型選擇 */
  const effectiveSessionFoodSource = (initialMode === 'complete_t1' && initialVesselIdForT1) ? 'dry_once' as const : sessionFoodSource;
  const [selectedIntakeLevel, setSelectedIntakeLevel] = useState<IntakeLevel | null>(null);
  const [autoFeederDailyGram, setAutoFeederDailyGram] = useState('');
  const [intakeOnlyTagId, setIntakeOnlyTagId] = useState<string | null>(null);
  /** Spec v3：自動餵食器 T0 確認後才顯示 T1（收碗記錄） */
  const [autoFeederT0Confirmed, setAutoFeederT0Confirmed] = useState(false);
  /** Spec v3：罐頭 T0 儲存後才顯示 T1 */
  const [cannedT0Saved, setCannedT0Saved] = useState(false);
  const [cannedSelectedCanId, setCannedSelectedCanId] = useState<string | null>(null);
  const [cannedGrams, setCannedGrams] = useState('');
  /** Spec v3：自煮已選食材 id 列表 */
  const [homemadeSelectedIds, setHomemadeSelectedIds] = useState<string[]>([]);
  const [homemadeT0Saved, setHomemadeT0Saved] = useState(false);
  const [addCanMode, setAddCanMode] = useState(false);
  const [newCanName, setNewCanName] = useState('');
  const [newCanGrams, setNewCanGrams] = useState('');
  /** 罐頭 T1 收碗照（選填，目前僅供記錄不跑 AI） */
  const [cannedT1Image, setCannedT1Image] = useState<CapturedImage | null>(null);
  /** 補填記錄：參考克數、記錄日期（今天/昨天/前天） */
  const [lateEntryGrams, setLateEntryGrams] = useState('');
  const [lateEntryDateOption, setLateEntryDateOption] = useState<'today' | 'yesterday' | '2days'>('today');
  /** 自動餵食器流程：選擇已存飼料列表是否展開 */
  const [autoFeederFeedSelectOpen, setAutoFeederFeedSelectOpen] = useState(false);
  /** 罐頭流程：選擇罐頭列表是否展開 */
  const [cannedCanSelectOpen, setCannedCanSelectOpen] = useState(false);

  function resetToBlankRecordScreen() {
    feeding.openReset();
    setCapturePhase(null);
    setInputMode('camera');
    setManualWeight('');
    setManualGrams('');
    setManualTagId(null);
    setManualBoundaryLevel(null);
    setNote('');
    setSessionFoodSource(null);
    setSelectedIntakeLevel(null);
    setAutoFeederDailyGram('');
    setIntakeOnlyTagId(null);
    setAutoFeederT0Confirmed(false);
    setCannedT0Saved(false);
    setCannedSelectedCanId(null);
    setCannedGrams('');
    setHomemadeSelectedIds([]);
    setHomemadeT0Saved(false);
    setAddCanMode(false);
    setNewCanName('');
    setNewCanGrams('');
    setCannedT1Image(null);
    setLateEntryGrams('');
    setLateEntryDateOption('today');
    setAutoFeederFeedSelectOpen(false);
    setCannedCanSelectOpen(false);
  }

  const t0RefGramsForBoundary = t0Image?.manualWeight || (currentVessel?.volumeMl ? currentVessel.volumeMl * 0.8 * 0.45 : 500);

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
  }, [result?.consumedRatio, result?.householdTotalGram, t1Image?.uri, visible]);

  // 切換食碗時，同步食物類型（沿用食碗設定或預設乾飼料）
  useEffect(() => {
    setSessionFoodType((currentVessel?.foodType as FoodType) || 'dry');
  }, [currentVessel?.id, currentVessel?.foodType]);

  // Spec v3：選擇自動餵食器時，若目前選中的不是自動餵食器則自動選第一個
  useEffect(() => {
    if (sessionFoodSource !== 'auto_feeder') return;
    const autoFeederVessels = feedingVessels.filter(v => v.feedingContainerMode === 'auto_feeder');
    if (autoFeederVessels.length === 0) return;
    const isCurrentAuto = currentVessel?.feedingContainerMode === 'auto_feeder';
    if (!isCurrentAuto) selectVessel(autoFeederVessels[0].id);
  }, [sessionFoodSource, feedingVessels, currentVessel?.feedingContainerMode]);

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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {capturePhase ? (
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
              const hasDefault = sessionFoodType === 'dry' && (currentVessel?.defaultPortionGrams ?? 0) > 0;
              const t0Grams = hasDefault ? currentVessel!.defaultPortionGrams : (parseFloat(manualWeight) || undefined);
              void submitT0Image(image, t0Grams);
            } else if (capturePhase === 't1' && sessionFoodSource === 'canned') {
              setCannedT1Image(image);
            } else if (capturePhase === 't1') void submitT1Image(image);
            else void submitNutritionImage(image);
            setCapturePhase(null);
          }}
          onCancel={() => setCapturePhase(null)}
        />
      ) : (
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initialMode === 'late_entry' ? '補填記錄' : '食物記錄'}</Text>
            <Pressable onPress={() => { resetToBlankRecordScreen(); onClose(); }}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
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
            {/* Mode toggle */}
            <View style={[styles.choiceRow, { marginBottom: 16 }]}>
              <Pressable
                style={[styles.choiceBtn, inputMode === 'camera' && styles.choiceBtnActive]}
                onPress={() => setInputMode('camera')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="camera-alt" size={16} color={inputMode === 'camera' ? '#fff' : '#000'} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, inputMode === 'camera' && styles.choiceBtnTextActive]}>相機記錄</Text></View>
              </Pressable>
              <Pressable
                style={[styles.choiceBtn, inputMode === 'manual' && styles.choiceBtnActive]}
                onPress={() => setInputMode('manual')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="edit" size={16} color={inputMode === 'manual' ? '#fff' : '#000'} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, inputMode === 'manual' && styles.choiceBtnTextActive]}>手動輸入</Text></View>
              </Pressable>
            </View>

            {inputMode === 'manual' ? (
              <View>
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
                    saveManualLog(g, manualTagId, resetToBlankRecordScreen, note);
                  }}
                >
                  <Text style={styles.primaryBtnText}>儲存記錄</Text>
                </Pressable>
              </View>
            ) : effectiveSessionFoodSource === null ? (
              <>
                <Text style={[styles.formLabel, { marginBottom: 8 }]}>食物類型</Text>
                <View style={{ gap: 8 }}>
                  {(['auto_feeder', 'dry_once', 'canned', 'homemade'] as FoodSourceType[]).map((src) => (
                    <Pressable
                      key={src}
                      style={{ paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface }}
                      onPress={() => setSessionFoodSource(src)}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{FOOD_SOURCE_LABEL[src]}</Text>
                      <Text style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>
                        {src === 'auto_feeder' && '不需拍照，手動輸入克數與攝取程度'}
                        {src === 'dry_once' && '放飯拍照 + 收碗拍照 + 攝取程度'}
                        {src === 'canned' && '選罐頭 + 克數 + 收碗攝取程度'}
                        {src === 'homemade' && '選食材 + 攝取程度'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : effectiveSessionFoodSource === 'auto_feeder' ? (
              renderAutoFeederFlow()
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: palette.muted }}>已選：{effectiveSessionFoodSource ? FOOD_SOURCE_LABEL[effectiveSessionFoodSource] : ''}</Text>
                  <Pressable
                    onPress={() => {
                      setSessionFoodSource(null);
                      setSelectedIntakeLevel(null);
                      setAddCanMode(false);
                      setCannedT0Saved(false);
                      setCannedSelectedCanId(null);
                      setCannedGrams('');
                      setCannedCanSelectOpen(false);
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    <Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>變更</Text>
                  </Pressable>
                </View>

                {effectiveSessionFoodSource === 'canned' && !cannedT0Saved && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>放飯記錄</Text>
                      <Text style={styles.formLabel}>選擇罐頭</Text>
                      {addCanMode ? (
                        <View style={{ marginTop: 8, padding: 12, backgroundColor: palette.surfaceSoft, borderRadius: 8 }}>
                          <TextInput style={styles.input} placeholder="罐頭名稱" value={newCanName} onChangeText={setNewCanName} />
                          <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="克數（例：80）" keyboardType="numeric" value={newCanGrams} onChangeText={setNewCanGrams} />
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={() => {
                              const g = parseFloat(newCanGrams);
                              if (!newCanName.trim()) { Alert.alert('請輸入罐頭名稱'); return; }
                              if (!g || g <= 0) { Alert.alert('請輸入克數', '克數必須大於 0。'); return; }
                              const id = addCanLibraryItem({ product_name: newCanName.trim(), display_name: newCanName.trim(), food_form: 'wet', is_prescription: 'no', defaultGrams: g });
                              setCannedSelectedCanId(id);
                              setCannedGrams(String(g));
                              setAddCanMode(false);
                              setCannedCanSelectOpen(false);
                              setNewCanName('');
                              setNewCanGrams('');
                            }}>
                              <Text style={styles.primaryBtnText}>加入並選取</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.choiceBtn, { flex: 1 }]}
                              onPress={() => {
                                setAddCanMode(false);
                                setNewCanName('');
                                setNewCanGrams('');
                                if (canLibrary.length === 0) {
                                  setSessionFoodSource(null);
                                  setCannedSelectedCanId(null);
                                  setCannedGrams('');
                                }
                              }}
                            >
                              <Text style={styles.choiceBtnText}>取消</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <>
                          <Pressable
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface, marginTop: 8 }}
                            onPress={() => setCannedCanSelectOpen((v) => !v)}
                          >
                            <Text style={{ fontSize: 14, color: cannedSelectedCanId ? palette.text : palette.muted }} numberOfLines={1}>
                              {cannedSelectedCanId
                                ? (() => {
                                    const can = canLibrary.find(c => c.id === cannedSelectedCanId);
                                    return can ? `${getCannedDisplayName(can)}（${cannedGrams || (can.defaultGrams ?? 80)}g）` : '請選擇一項';
                                  })()
                                : '請選擇一項'}
                            </Text>
                            <Text style={{ fontSize: 14, color: palette.muted }}>{cannedCanSelectOpen ? '▲' : '▼'}</Text>
                          </Pressable>
                          {cannedCanSelectOpen && (
                            <>
                              <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -320, zIndex: 1 }} onPress={() => setCannedCanSelectOpen(false)} />
                              <View style={{ minHeight: 48, maxHeight: 220, marginTop: 6, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 8, zIndex: 2, overflow: 'hidden' }}>
                                {sortedCanLibrary.length === 0 ? (
                                  <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
                                    <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 8 }}>尚無罐頭，可至個人 → 罐頭庫新增，或下方＋ 新增罐頭</Text>
                                    <Pressable style={[styles.choiceBtn, { borderStyle: 'dashed', alignSelf: 'flex-start' }]} onPress={() => { setAddCanMode(true); setCannedCanSelectOpen(false); }}>
                                      <Text style={styles.choiceBtnText}>＋ 新增罐頭</Text>
                                    </Pressable>
                                  </View>
                                ) : (
                                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                                    {sortedCanLibrary.map((can) => (
                                      <Pressable
                                        key={can.id}
                                        style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}
                                        onPress={() => { setCannedSelectedCanId(can.id); setCannedGrams(String(can.defaultGrams ?? 80)); setCannedCanSelectOpen(false); }}
                                      >
                                        <Text style={{ fontSize: 14, fontWeight: cannedSelectedCanId === can.id ? '600' : '400', color: palette.text }} numberOfLines={2}>
                                          {getCannedDisplayName(can)}（{can.defaultGrams ?? 80}g）
                                        </Text>
                                      </Pressable>
                                    ))}
                                    <Pressable
                                      style={{ paddingVertical: 12, paddingHorizontal: 14, borderStyle: 'dashed', borderTopWidth: 1, borderColor: palette.border }}
                                      onPress={() => { setAddCanMode(true); setCannedCanSelectOpen(false); }}
                                    >
                                      <Text style={[styles.choiceBtnText, { color: palette.primary }]}>＋ 新增罐頭</Text>
                                    </Pressable>
                                  </ScrollView>
                                )}
                              </View>
                            </>
                          )}
                          <View style={[styles.formGroup, { marginTop: 16 }]}>
                            <Text style={styles.formLabel}>克數（自動帶入，可修改）</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={cannedGrams} onChangeText={setCannedGrams} placeholder="例：80" />
                          </View>
                          <Pressable style={styles.primaryBtn} onPress={() => {
                            const g = parseFloat(cannedGrams);
                            if (!cannedSelectedCanId) { Alert.alert('請選擇罐頭', '請從清單選擇或新增一筆罐頭。'); return; }
                            if (!g || g <= 0) { Alert.alert('請輸入克數', '克數必須大於 0。'); return; }
                            setCannedT0Saved(true);
                          }}>
                            <Text style={styles.primaryBtnText}>儲存 T0</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </>
                )}

                {effectiveSessionFoodSource === 'canned' && cannedT0Saved && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, color: palette.muted }}>收碗記錄（T1）</Text>
                      <Pressable onPress={() => { setCannedT0Saved(false); setSelectedIntakeLevel(null); setCannedT1Image(null); }} style={{ marginLeft: 8 }}><Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>重設 T0</Text></Pressable>
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>收碗照（選填）</Text>
                      {cannedT1Image ? (
                        <View style={{ padding: 12, backgroundColor: palette.surfaceSoft, borderWidth: 1, borderColor: palette.primary, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppIcon name="check-circle" size={18} color={palette.primary} style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: palette.text }}>已拍攝收碗照</Text>
                          </View>
                          <Pressable onPress={() => setCapturePhase('t1')} style={{ padding: 6, backgroundColor: palette.primary, borderRadius: 6 }}>
                            <Text style={{ fontSize: 11, color: palette.onPrimary, fontWeight: '600' }}>重新拍攝</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable style={[styles.cameraUpload, { marginTop: 4 }]} onPress={() => setCapturePhase('t1')}>
                          <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                          <Text style={styles.cameraText}>拍攝剩餘狀態（選填）</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>攝取程度</Text>
                      {(['almost_none', 'some', 'half', 'most', 'all'] as IntakeLevel[]).map((lv) => (
                        <Pressable key={lv} style={[styles.choiceBtn, selectedIntakeLevel === lv && styles.choiceBtnActive, { marginBottom: 8 }]} onPress={() => setSelectedIntakeLevel(lv)}>
                          <Text style={[styles.choiceBtnText, selectedIntakeLevel === lv && styles.choiceBtnTextActive]}>{INTAKE_LEVEL_LABEL[lv]}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {selectedIntakeLevel != null && cannedGrams && parseFloat(cannedGrams) > 0 && (() => {
                      const grams = parseFloat(cannedGrams);
                      const selectedCan = canLibrary.find(c => c.id === cannedSelectedCanId);
                      const kcalPer100 = selectedCan?.kcalPer100 ?? 120;
                      const estGram = Math.round(grams * INTAKE_LEVEL_RATIO[selectedIntakeLevel]);
                      const estKcal = Math.round((estGram * kcalPer100) / 100);
                      return (
                        <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 12 }}>
                          預估攝取：約 {estKcal} kcal（僅供參考）
                        </Text>
                      );
                    })()}
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
                      if (!cannedSelectedCanId) return;
                      const g = parseFloat(cannedGrams);
                      if (!g || g <= 0) { Alert.alert('請輸入克數'); return; }
                      if (!selectedIntakeLevel) { Alert.alert('請選擇攝取程度'); return; }
                      const selectedCan = canLibrary.find(c => c.id === cannedSelectedCanId);
                      saveCannedLog(cannedSelectedCanId, g, selectedIntakeLevel, intakeOnlyTagId, resetToBlankRecordScreen, selectedCan?.kcalPer100);
                    }}>
                      <Text style={styles.primaryBtnText}>儲存記錄</Text>
                    </Pressable>
                  </>
                )}

                {effectiveSessionFoodSource === 'homemade' && !homemadeT0Saved && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>放飯記錄</Text>
                      <Text style={styles.formLabel}>選擇食材</Text>
                      <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {HOMEMADE_INGREDIENTS.map((ing) => {
                          const active = homemadeSelectedIds.includes(ing.id);
                          return (
                            <Pressable
                              key={ing.id}
                              style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                              onPress={() => setHomemadeSelectedIds(prev => active ? prev.filter(x => x !== ing.id) : [...prev, ing.id])}
                            >
                              <Text style={[styles.choiceBtnText, active && styles.choiceBtnTextActive]}>{ing.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {homemadeSelectedIds.length > 0 && (() => {
                        const selected = HOMEMADE_INGREDIENTS.filter(i => homemadeSelectedIds.includes(i.id));
                        const minK = selected.reduce((s, i) => s + i.minKcal, 0);
                        const maxK = selected.reduce((s, i) => s + i.maxKcal, 0);
                        return (
                          <Text style={{ fontSize: 11, color: palette.muted, marginTop: 12 }}>
                            熱量參考：約 {minK}～{maxK} kcal（僅供參考）
                          </Text>
                        );
                      })()}
                      <Pressable style={[styles.primaryBtn, { marginTop: 16 }]} onPress={() => {
                        if (homemadeSelectedIds.length === 0) { Alert.alert('請至少選擇一項食材'); return; }
                        setHomemadeT0Saved(true);
                      }}>
                        <Text style={styles.primaryBtnText}>儲存 T0</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {effectiveSessionFoodSource === 'homemade' && homemadeT0Saved && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, color: palette.muted }}>收碗記錄（T1）</Text>
                      <Pressable onPress={() => { setHomemadeT0Saved(false); setSelectedIntakeLevel(null); }} style={{ marginLeft: 8 }}><Text style={{ fontSize: 12, color: palette.primary, fontWeight: '600' }}>重設 T0</Text></Pressable>
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
                      if (!selectedIntakeLevel) { Alert.alert('請選擇攝取程度'); return; }
                      const ingredientLabels = HOMEMADE_INGREDIENTS.filter(i => homemadeSelectedIds.includes(i.id)).map(i => i.label);
                      saveIntakeOnlyLog(100, selectedIntakeLevel, 'homemade', intakeOnlyTagId, resetToBlankRecordScreen, undefined, ingredientLabels);
                    }}>
                      <Text style={styles.primaryBtnText}>儲存記錄</Text>
                    </Pressable>
                  </>
                )}

                {effectiveSessionFoodSource === 'dry_once' && (() => {
                  /** 乾糧一次給一天流程（T0/T1 拍照 + 營養選填 + 儲存），從主 JSX 抽出 */
                  const renderDryOnceFlow = () => (
                <>
                <View style={styles.infoBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="home" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.infoTitle}>N-Bowl 拍照記錄</Text></View>
                  <Text style={{ fontSize: 12 }}>拍攝食碗前後對比，AI 將計算消耗量</Text>
                </View>

                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.formLabel}>模式選擇</Text>
                  </View>
                  <View style={styles.choiceRow}>
                    {(['standard', 'precise'] as FeedingPrecisionMode[]).map((m) => (
                      <Pressable
                        key={m}
                        style={[styles.choiceBtn, precisionMode === m && styles.choiceBtnActive]}
                        onPress={() => setPrecisionMode(m)}
                      >
                        <Text style={[styles.choiceBtnText, precisionMode === m && styles.choiceBtnTextActive]}>
                          {m === 'standard' ? '一般' : '精確'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    {precisionMode === 'standard' && '影像估算 (誤差±20%)'}
                    {precisionMode === 'precise' && 'T0 測重 + T1 影像 (誤差±8%)'}
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.formLabel}>① 選擇食碗</Text>
                    {feedingVessels.length === 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <AppIcon name="warning" size={14} color="#f59e0b" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, color: '#f59e0b', fontWeight: '700' }}>請至個人 tab「食碗管理」新增食碗</Text>
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
                              <Text style={{ color: '#ef4444', fontWeight: '700' }}> ({Math.round(displayVolume)}ml ⚠️異常)</Text>
                            ) : (
                              ` (${Math.round(displayVolume)}ml)`
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
                          <AppIcon name="warning" size={14} color="#856404" style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#856404' }}>尚未建立食碗</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#856404', lineHeight: 16, marginBottom: 8 }}>
                          完成校準後，AI 辨識誤差可從 ±20% 降至 ±12-15%
                        </Text>
                        <Text style={{ fontSize: 12, color: '#666' }}>請至「個人」→ 食碗管理 新增食碗</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>食物類型</Text>
                  <View style={styles.choiceRow}>
                    <Pressable
                      style={[styles.choiceBtn, sessionFoodType === 'dry' && styles.choiceBtnActive]}
                      onPress={() => setSessionFoodType('dry')}
                    >
                      <Text style={[styles.choiceBtnText, sessionFoodType === 'dry' && styles.choiceBtnTextActive]}>乾飼料</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.choiceBtn, sessionFoodType === 'wet' && styles.choiceBtnActive]}
                      onPress={() => setSessionFoodType('wet')}
                    >
                      <Text style={[styles.choiceBtnText, sessionFoodType === 'wet' && styles.choiceBtnTextActive]}>罐頭濕食</Text>
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    {sessionFoodType === 'dry' ? '份量通常固定，可設預設值沿用' : '每次給量可能不同（半罐、1/4 罐等），可選填克數'}
                  </Text>
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
                    const isWetFood = sessionFoodType === 'wet';
                    const hasDefaultPortion = sessionFoodType === 'dry' && (currentVessel?.defaultPortionGrams ?? 0) > 0;
                    return (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>輸入克數（選填，可提高準確度）</Text>
                        {hasDefaultPortion && (
                          <Text style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>預設：{currentVessel?.defaultPortionGrams}g</Text>
                        )}
                        <TextInput
                          style={[styles.input, { height: 36 }]}
                          placeholder={isWetFood ? '例：85（半罐）' : '例：50'}
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
                      <Text style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 8 }}>僅供參考（此容器為測量尺寸／側面輪廓推估，非滿量基準校準）</Text>
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
                      <Text style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 8 }}>僅供參考（此容器為測量尺寸／側面輪廓推估，非滿量基準校準）</Text>
                    )}
                  </View>
                )}

                {t1Done && result && (
                  <View style={styles.aiResult}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="smart-toy" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.aiResultTitle}>AI 分析結果</Text></View>
                    {(() => {
                      const kcalPerGram = nutritionResult?.kcalPerGram || 3.5;
                      const kcal = calculateDailyKcalIntake(result.householdTotalGram, kcalPerGram);
                      const maxPossibleGrams =
                        t0Image?.manualWeight ||
                        (currentVessel?.volumeMl ? currentVessel.volumeMl * 0.8 : 1000);
                      const confidence = result.confidence ?? 1;
                      const shouldWarn =
                        confidence < 0.7 ||
                        result.householdTotalGram > maxPossibleGrams * 0.9;

                      return (
                        <>
                          {result.consumptionLevel && (
                            <View style={{ marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderLeftWidth: 4, borderLeftColor: '#166534' }}>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534' }}>
                                {CONSUMPTION_LEVEL_LABEL[result.consumptionLevel]}
                              </Text>
                            </View>
                          )}
                          <View style={styles.aiTags}>
                            {result.assignments.map((item) => (
                              <Text key={item.bowlId} style={styles.aiTag}>
                                {item.tag}：{item.estimatedIntakeGram}g
                              </Text>
                            ))}
                            <Text style={[styles.aiTag, styles.aiTagHighlight]}>
                              總計：{result.householdTotalGram}g
                            </Text>
                            <Text style={styles.aiTag}>
                              kcal/g：{kcalPerGram}
                              {!nutritionResult ? '（預設）' : ''}
                            </Text>
                            <Text style={[styles.aiTag, styles.aiTagHighlight]}>
                              熱量：{kcal} kcal
                            </Text>
                          </View>

                          {shouldWarn && (
                            <View style={{ marginTop: 10, padding: 10, borderWidth: 2, borderColor: '#92400e', backgroundColor: '#fffbeb', borderRadius: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <AppIcon name="warning" size={16} color="#92400e" style={{ marginRight: 6 }} />
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400e' }}>克數可能偏差</Text>
                              </View>
                              <Text style={{ fontSize: 12, color: '#92400e', lineHeight: 18 }}>
                                可能受碗色／曝光／反光影響導致克數估計不穩定。建議重拍（光線均勻、避免反光）或改用手動輸入。
                                {'\n'}參考：信心度 {Math.round(confidence * 100)}%，上限估計 {Math.round(maxPossibleGrams)}g
                              </Text>
                            </View>
                          )}
                        </>
                      );
                    })()}
                    {(currentVessel?.calibrationMethod === 'dimensions' || currentVessel?.calibrationMethod === 'side_profile') && currentVessel?.feedingContainerMode !== 'auto_feeder' && (
                      <Text style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 8 }}>僅供參考（此容器為測量尺寸／側面輪廓推估，非滿量基準校準）</Text>
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
                        <View style={{ marginBottom: 12, padding: 12, borderWidth: 2, borderColor: '#92400e', backgroundColor: '#fffbeb', borderRadius: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <AppIcon name="warning" size={16} color="#92400e" style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400e' }}>邊界區需人工確認</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#92400e', lineHeight: 18, marginBottom: 8 }}>
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
                            <Text style={{ fontSize: 12, color: '#666' }}>尚無貓咪檔案，請先至個人新增</Text>
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
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626' }}>碗型或碗的顏色不一致</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#991b1b', lineHeight: 20 }}>
                      {mismatchError}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#991b1b', marginTop: 6 }}>
                      請確認 T0、T1 拍攝同一只碗後重拍。
                    </Text>
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
                        {sortedFeedLibrary.length === 0 ? (
                          <View style={{ paddingVertical: 16, paddingHorizontal: 14 }}>
                            <Text style={{ fontSize: 12, color: palette.muted }}>尚無飼料，可至個人 → 飼料設定新增，或下方掃描標籤</Text>
                          </View>
                        ) : (
                          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                            {sortedFeedLibrary.map((feed) => (
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
                  <Pressable style={styles.cameraUpload} onPress={() => setCapturePhase('nutrition')}>
                    <AppIcon name="receipt" size={28} color="#000" style={styles.cameraIcon} />
                    <Text style={styles.cameraText}>掃描成分表／飼料標籤</Text>
                  </Pressable>
                </View>

                {nutritionResult && (
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
                  return renderDryOnceFlow();
                })()}
              </>
            )}
            </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
      )}
    </Modal>
  );
}
