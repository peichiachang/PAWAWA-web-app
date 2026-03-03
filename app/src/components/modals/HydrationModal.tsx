import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import { useHydration } from '../../hooks/useHydration';
import { HYDRATION_T0_TTL_MS } from '../../constants';
// @ts-ignore
import { WaterLevelMarker } from '../WaterLevelMarker';
import { CustomCamera } from '../CustomCamera';
import { CatIdentity } from '../../types/domain';
import { styles } from '../../styles/common';
import { Alert } from 'react-native';
import { useState, useEffect } from 'react';

interface Props {
  visible: boolean;
  hydration: ReturnType<typeof useHydration>;
  cats: CatIdentity[];
  onClose: () => void;
}

export function HydrationModal({ visible, hydration, cats, onClose }: Props) {
  const {
    t0Done,
    t0Image,
    t1Done,
    t1Image,
    result,
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
  } = hydration;

  // 飲水記錄只顯示「水碗」
  const hydrationVessels = vessels.vesselProfiles.filter(p => p.vesselType === 'hydration');

  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('camera');
  const [manualMl, setManualMl] = useState('');
  const [manualTagId, setManualTagId] = useState<string | null>(null);
  const [capturePhase, setCapturePhase] = useState<'t0' | 't1' | null>(null);

  function resetToBlankRecordScreen() {
    openReset();
    setCapturePhase(null);
    setInputMode('camera');
    setManualMl('');
    setManualTagId(null);
  }

  // 可分辨貓咪時，若尚未選擇且有多隻貓，預設選第一隻
  useEffect(() => {
    if (canIdentifyTags && !selectedTagId && cats.length > 0) {
      setSelectedTagId(cats[0].id);
    }
  }, [canIdentifyTags, selectedTagId, cats]);

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        {markingImage ? (
          <WaterLevelMarker
            imageUri={markingImage.image.uri}
            onConfirm={confirmMarking}
            onCancel={cancelMarking}
          />
        ) : capturePhase ? (
          <CustomCamera
            title={capturePhase === 't0' ? 'W0 — 給水期（請拍攝裝滿水的水碗）' : 'W1 — 剩水期（請拍攝剩餘水的水碗）'}
            onCapture={(image) => {
              startMarking(capturePhase, image);
              setCapturePhase(null);
            }}
            onCancel={() => setCapturePhase(null)}
            customOptions={{
              showGuide: true,
              guideShape: 'square',
              guideText: capturePhase === 't0' ? '請將水碗完整置於方框內' : '請將同一個水碗完整置於方框內',
            }}
          />
        ) : (
          <SafeAreaView style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>飲水記錄</Text>
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
                      <Text style={styles.formLabel}>飲水量 (ml)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="例：120"
                        keyboardType="numeric"
                        value={manualMl}
                        onChangeText={setManualMl}
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
                    <Pressable
                      style={styles.primaryBtn}
                      onPress={() => {
                        const ml = parseFloat(manualMl);
                        if (!ml || ml <= 0) { Alert.alert('請輸入飲水量', '飲水量必須大於 0。'); return; }
                        saveManualLog(ml, manualTagId, resetToBlankRecordScreen);
                      }}
                    >
                      <Text style={styles.primaryBtnText}>儲存記錄</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.infoBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <AppIcon name="opacity" size={18} color="#000" style={{ marginRight: 6 }} />
                        <Text style={styles.infoTitle}>N-Bowl 水碗記錄</Text>
                      </View>
                      <Text style={{ fontSize: 12 }}>拍攝水碗前後對比，AI 將計算消耗量，並進行環境蒸發修正。水碗請至「個人」→ 食碗管理 設定。</Text>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>① 選擇水碗</Text>
                      <View style={[styles.choiceRow, { flexWrap: 'wrap' }]}>
                        {hydrationVessels.map((v) => (
                          <Pressable
                            key={v.id}
                            style={[styles.choiceBtn, vessels.selectedVesselId === v.id && styles.choiceBtnActive, { marginBottom: 8 }]}
                            onPress={() => vessels.selectVessel(v.id)}
                          >
                            <Text style={[styles.choiceBtnText, vessels.selectedVesselId === v.id && styles.choiceBtnTextActive]}>
                              {v.name}
                            </Text>
                          </Pressable>
                        ))}
                        {hydrationVessels.length === 0 && (
                          <Text style={{ fontSize: 12, color: '#666' }}>尚未建立水碗，請至「個人」→ 食碗管理 新增水碗。</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>② W0 — 給水期</Text>
                      <Pressable
                        style={[styles.cameraUpload, !vessels.selectedVesselId && { opacity: 0.5 }]}
                        onPress={() => {
                          if (!vessels.selectedVesselId) {
                            Alert.alert('請選擇水碗', '請先選擇一個水碗設定，再進行拍攝。');
                            return;
                          }
                          setCapturePhase('t0');
                        }}
                      >
                        <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                        <Text style={styles.cameraText}>拍攝裝滿水的水碗</Text>
                      </Pressable>
                    </View>

                    {t0Done && t0Image && (
                      <View style={[styles.aiResult, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="check-circle" size={18} color="#1e40af" style={{ marginRight: 6 }} /><Text style={[styles.aiResultTitle, { color: '#1e40af' }]}>W0 拍攝完成 ({vessels.currentVessel?.name})</Text></View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => { hydration.resetT0(); setCapturePhase('t0'); }}
                              style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#1e40af' }}
                            >
                              <Text style={{ fontSize: 10, color: '#1e40af' }}>重新拍攝</Text>
                            </Pressable>
                            <Pressable
                              onPress={hydration.resetT0}
                              style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                            >
                              <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除照片</Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={styles.aiTags}>
                          <Text style={[styles.aiTag, { color: '#1e40af', borderColor: '#1e40af' }]}>
                            拍攝於: {new Date(t0Image.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={[styles.aiTag, { color: '#1e40af', borderColor: '#1e40af' }]}>
                            有效期剩餘: {getRemainingMinutes()} 分鐘
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>③ W1 — 剩水期</Text>
                      <Pressable
                        style={[styles.cameraUpload, !t0Done && { opacity: 0.5 }]}
                        onPress={() => {
                          if (!t0Done) {
                            Alert.alert('請先完成 W0', '請先拍攝並標記 W0（給水期）的水位，再進行 W1。');
                            return;
                          }
                          setCapturePhase('t1');
                        }}
                      >
                        <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                        <Text style={styles.cameraText}>拍攝剩餘水的水碗</Text>
                      </Pressable>
                    </View>

                    {t1Image && (
                      <View style={[styles.aiResult, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppIcon name="check-circle" size={18} color="#1e40af" style={{ marginRight: 6 }} />
                            <Text style={[styles.aiResultTitle, { color: '#1e40af' }]}>W1 拍攝完成 ({vessels.currentVessel?.name})</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => { hydration.clearW1(); setCapturePhase('t1'); }}
                              style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#1e40af' }}
                            >
                              <Text style={{ fontSize: 10, color: '#1e40af' }}>重新拍攝</Text>
                            </Pressable>
                            <Pressable
                              onPress={hydration.clearW1}
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="smart-toy" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.aiResultTitle}>AI 飲水分析結果</Text></View>
                        <View style={styles.aiTags}>
                          <Text style={styles.aiTag}>初始：{result.waterT0Ml} ml</Text>
                          <Text style={styles.aiTag}>剩餘：{result.waterT1Ml} ml</Text>
                          <Text style={styles.aiTag}>環境：{result.tempC}°C / {result.humidityPct}%</Text>
                          <Text style={styles.aiTag}>蒸發修正：{result.envFactorMl}ml</Text>
                          <Text style={[styles.aiTag, styles.aiTagHighlight]}>
                            實際飲水量：{result.actualIntakeMl} ml
                          </Text>
                        </View>

                        {/* Data Attribution */}
                        <View style={{ marginTop: 20 }}>
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
                      <Text style={styles.resultErrorBox}>
                        碗位辨識不一致：{mismatchError}
                        {'\n'}請重拍 T1（必要時重拍 T0）。
                      </Text>
                    )}

                    {isAnalyzing && <ActivityIndicator size="small" color="#000000" style={styles.loadingSpinner} />}

                    <Pressable style={styles.primaryBtn} onPress={() => saveOwnershipLog(resetToBlankRecordScreen)}>
                      <Text style={styles.primaryBtnText}>儲存記錄</Text>
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </>
  );
}
