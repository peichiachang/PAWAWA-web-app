import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useFeeding } from '../../hooks/useFeeding';
import { FeedingPrecisionMode, FoodType, VesselCalibration } from '../../types/app';
import { CatIdentity } from '../../types/domain';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { useState, useEffect } from 'react';
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

interface Props {
  visible: boolean;
  feeding: ReturnType<typeof useFeeding>;
  cats: CatIdentity[];
  onClose: () => void;
}

export function FeedingModal({ visible, feeding, cats, onClose }: Props) {
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

  // 飲食記錄只顯示「食碗」
  const feedingVessels = vesselProfiles.filter(p => (p.vesselType || 'feeding') === 'feeding');

  const [manualWeight, setManualWeight] = useState('');
  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('camera');
  const [manualGrams, setManualGrams] = useState('');
  const [manualTagId, setManualTagId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sessionFoodType, setSessionFoodType] = useState<FoodType>('dry');
  const [capturePhase, setCapturePhase] = useState<'t0' | 't1' | 'nutrition' | null>(null);
  const [manualBoundaryLevel, setManualBoundaryLevel] = useState<ConsumptionLevel | null>(null);

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

  // 可分辨貓咪時，若尚未選擇且有多隻貓，預設選第一隻
  useEffect(() => {
    if (canIdentifyTags && !selectedTagId && cats.length > 0) {
      setSelectedTagId(cats[0].id);
    }
  }, [canIdentifyTags, selectedTagId, cats]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {capturePhase ? (
        <CustomCamera
          title={
            capturePhase === 't0'
              ? 'T0 — 飲食紀錄（給飯前，請拍攝裝滿食物的碗）'
              : capturePhase === 't1'
                ? 'T1 — 飲食紀錄（剩食後，請拍攝剩餘食物的碗）'
                : '營養標籤 OCR — 請拍攝飼料標籤'
          }
          customOptions={
            capturePhase === 't0'
              ? { guideText: '請將裝滿食物的碗置於框內' }
              : capturePhase === 't1'
                ? { guideText: '請將剩餘食物的碗置於框內' }
                : { guideText: '請將飼料標籤置於框內', quality: 0.5 }
          }
          onCapture={(image) => {
            if (capturePhase === 't0') {
              const hasDefault = sessionFoodType === 'dry' && (currentVessel?.defaultPortionGrams ?? 0) > 0;
              const t0Grams = hasDefault ? currentVessel!.defaultPortionGrams : (parseFloat(manualWeight) || undefined);
              void submitT0Image(image, t0Grams);
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
            <Text style={styles.modalTitle}>飲食記錄</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
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
                    saveManualLog(g, manualTagId, () => { setManualGrams(''); setManualTagId(null); setNote(''); onClose(); }, note);
                  }}
                >
                  <Text style={styles.primaryBtnText}>儲存記錄</Text>
                </Pressable>
              </View>
            ) : (
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
                  <Text style={styles.formLabel}>② T0 — 給飯期</Text>
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
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>③ T1 — 剩食期</Text>
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
                  <Text style={styles.formLabel}>④ 營養換算 (選項)</Text>
                  <Pressable style={styles.cameraUpload} onPress={() => setCapturePhase('nutrition')}>
                    <AppIcon name="receipt" size={28} color="#000" style={styles.cameraIcon} />
                    <Text style={styles.cameraText}>掃描飼料標籤（Nutrition OCR）</Text>
                  </Pressable>
                </View>

                {nutritionResult && (
                  <View style={styles.aiResult}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="receipt" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.aiResultTitle}>OCR 營養標籤</Text></View>
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
                    if (needsBoundaryConfirm && !manualBoundaryLevel) {
                      Alert.alert('需人工確認', '請先在邊界確認區塊選擇進食程度，再儲存。');
                      return;
                    }
                    const overrideGram = needsBoundaryConfirm && manualBoundaryLevel
                      ? gramsByLevel(manualBoundaryLevel)
                      : undefined;
                    saveOwnershipLog(() => { setNote(''); onClose(); }, note, overrideGram);
                  }}
                >
                  <Text style={styles.primaryBtnText}>儲存記錄</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
      )}
    </Modal>
  );
}
