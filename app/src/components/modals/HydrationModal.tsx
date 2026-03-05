import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { AppIcon } from '../AppIcon';
import { useHydration } from '../../hooks/useHydration';
import { HYDRATION_W0_TTL_MS } from '../../constants';
// @ts-ignore
import { WaterLevelMarker } from '../WaterLevelMarker';
import { CustomCamera } from '../CustomCamera';
import { CatIdentity } from '../../types/domain';
import { styles, palette } from '../../styles/common';
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
    w0Done,
    w0Image,
    w1Done,
    w1Image,
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
    resetW0,
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
  const [capturePhase, setCapturePhase] = useState<'w0' | 'w1' | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  function resetToBlankRecordScreen() {
    openReset();
    setCapturePhase(null);
    setInputMode('camera');
    setManualMl('');
    setManualTagId(null);
    setManualError(null);
  }

  function resetManualFormOnly() {
    setManualMl('');
    setManualTagId(null);
    setManualError(null);
  }

  // 可分辨貓咪時，若尚未選擇且有多隻貓，預設選第一隻
  useEffect(() => {
    if (canIdentifyTags && !selectedTagId && cats.length > 0) {
      setSelectedTagId(cats[0].id);
    }
  }, [canIdentifyTags, selectedTagId, cats]);

  // 僅有一個水碗時自動選取
  useEffect(() => {
    if (visible && inputMode === 'camera' && hydrationVessels.length === 1 && !vessels.selectedVesselId) {
      vessels.selectVessel(hydrationVessels[0].id);
    }
  }, [visible, inputMode, hydrationVessels, vessels.selectedVesselId]);

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        {markingImage ? (
          <WaterLevelMarker
            imageUri={markingImage.image.uri}
            onConfirm={confirmMarking}
            onCancel={cancelMarking}
            title={markingImage.phase === 'w0' ? '標記目前水量' : '標記剩餘水量'}
            subtitle={markingImage.phase === 'w0' 
              ? '請拖曳三條線分別對齊：\n• 頂線：水位觀察窗的上緣\n• 底線：水位觀察窗的下緣\n• 水位線：目前的水面位置\n（開始記錄前的水位）'
              : '請拖曳三條線分別對齊：\n• 頂線：水位觀察窗的上緣\n• 底線：水位觀察窗的下緣\n• 水位線：目前的水面位置\n（記錄結束時的水位）'}
          />
        ) : capturePhase ? (
          <CustomCamera
            title={capturePhase === 'w0' ? '記錄目前水位（W0）' : '記錄剩餘水位（W1）'}
            onCapture={(image) => {
              startMarking(capturePhase, image);
              setCapturePhase(null);
            }}
            onCancel={() => setCapturePhase(null)}
            customOptions={{
              showGuide: true,
              guideShape: 'square',
              guideText: capturePhase === 'w0'
                ? '請用和設定時相同的方式標記三條線'
                : '請標記貓咪喝水後的水位',
            }}
          />
        ) : (
          <SafeAreaView style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>飲水記錄</Text>
                <Pressable onPress={onClose} hitSlop={12}><Text style={styles.closeText}>×</Text></Pressable>
              </View>
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Mode toggle */}
                <View style={[styles.choiceRow, { marginBottom: 20 }]}>
                  <Pressable
                    style={[styles.choiceBtn, inputMode === 'camera' && styles.choiceBtnActive]}
                    onPress={() => { setInputMode('camera'); setManualError(null); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="camera-alt" size={16} color={inputMode === 'camera' ? palette.onPrimary : palette.text} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, inputMode === 'camera' && styles.choiceBtnTextActive]}>相機記錄</Text></View>
                  </Pressable>
                  <Pressable
                    style={[styles.choiceBtn, inputMode === 'manual' && styles.choiceBtnActive]}
                    onPress={() => setInputMode('manual')}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="edit" size={16} color={inputMode === 'manual' ? palette.onPrimary : palette.text} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, inputMode === 'manual' && styles.choiceBtnTextActive]}>手動輸入</Text></View>
                  </Pressable>
                </View>

                {inputMode === 'manual' ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>飲水量</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          style={[styles.input, { flex: 1 }, manualError ? { borderColor: palette.dangerText } : undefined]}
                          placeholder="例如：80"
                          placeholderTextColor={palette.muted}
                          keyboardType="numeric"
                          value={manualMl}
                          onChangeText={(t) => { setManualMl(t); setManualError(null); }}
                        />
                        <Text style={{ fontSize: 14, color: palette.muted, fontWeight: '600' }}>ml</Text>
                      </View>
                      {manualError ? <Text style={{ fontSize: 12, color: palette.dangerText, marginTop: 6 }}>{manualError}</Text> : null}
                      <Text style={[styles.hintText, { marginTop: 6 }]}>建議範圍 1～2000 ml</Text>
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>屬於哪隻貓？</Text>
                      <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 8 }]}>
                        <Pressable
                          style={[styles.choiceBtn, manualTagId === null && styles.choiceBtnActive]}
                          onPress={() => setManualTagId(null)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="home" size={16} color={manualTagId === null ? palette.onPrimary : palette.text} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, manualTagId === null && styles.choiceBtnTextActive]}>家庭（共用）</Text></View>
                        </Pressable>
                        {cats.map(cat => (
                          <Pressable
                            key={cat.id}
                            style={[styles.choiceBtn, manualTagId === cat.id && styles.choiceBtnActive]}
                            onPress={() => setManualTagId(cat.id)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="pets" size={16} color={manualTagId === cat.id ? palette.onPrimary : palette.text} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, manualTagId === cat.id && styles.choiceBtnTextActive]}>{cat.name}</Text></View>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <Pressable
                      style={[styles.primaryBtn, { marginTop: 8 }]}
                      onPress={() => {
                        const parsed = manualMl.trim() ? parseFloat(manualMl.replace(/,/g, '')) : NaN;
                        if (Number.isNaN(parsed) || parsed <= 0) {
                          setManualError('請輸入大於 0 的數字');
                          return;
                        }
                        if (parsed > 2000) setManualError('已超過建議值 2000 ml，仍可儲存');
                        else setManualError(null);
                        const ml = Math.round(parsed);
                        saveManualLog(ml, manualTagId, (addAnother) => {
                          if (addAnother) {
                            resetManualFormOnly();
                          } else {
                            resetToBlankRecordScreen();
                            onClose();
                          }
                        });
                      }}
                    >
                      <Text style={styles.primaryBtnText}>儲存記錄</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={[styles.infoBox, { borderColor: palette.primary, backgroundColor: palette.surfaceSoft }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <AppIcon name="opacity" size={18} color={palette.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.infoTitle, { color: palette.text }]}>水碗記錄</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: palette.muted, lineHeight: 18 }}>拍攝水碗前後對比，系統將計算消耗量並做蒸發修正。水碗請至「個人」→ 食碗管理 設定。</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 }}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: vessels.selectedVesselId ? palette.primary : palette.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: vessels.selectedVesselId ? palette.onPrimary : palette.muted }}>1</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: palette.muted }}>選擇水碗 → 拍 W0 → 拍 W1</Text>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>選擇水碗</Text>
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
                      <Text style={styles.formLabel}>記錄目前水位（W0）</Text>
                      <Pressable
                        style={[styles.cameraUpload, !vessels.selectedVesselId && { opacity: 0.5 }]}
                        onPress={() => {
                          if (!vessels.selectedVesselId) {
                            Alert.alert('請選擇水碗', '請先選擇一個水碗設定，再進行拍攝。');
                            return;
                          }
                          setCapturePhase('w0');
                        }}
                      >
                        <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                        <Text style={styles.cameraText}>請用和設定時相同的方式標記三條線</Text>
                      </Pressable>
                    </View>

                    {w0Done && w0Image && (
                      <View style={[styles.aiResult, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="check-circle" size={18} color="#1e40af" style={{ marginRight: 6 }} /><Text style={[styles.aiResultTitle, { color: '#1e40af' }]}>W0 拍攝完成 ({vessels.currentVessel?.name})</Text></View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => { hydration.resetW0(); setCapturePhase('w0'); }}
                              style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#1e40af' }}
                            >
                              <Text style={{ fontSize: 10, color: '#1e40af' }}>重新拍攝</Text>
                            </Pressable>
                            <Pressable
                              onPress={hydration.resetW0}
                              style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                            >
                              <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除照片</Text>
                            </Pressable>
                          </View>
                        </View>
                        <View style={styles.aiTags}>
                          <Text style={[styles.aiTag, { color: '#1e40af', borderColor: '#1e40af' }]}>
                            拍攝於: {new Date(w0Image.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={[styles.aiTag, { color: '#1e40af', borderColor: '#1e40af' }]}>
                            有效期剩餘: {getRemainingMinutes()} 分鐘
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>記錄剩餘水位（W1）</Text>
                      <Pressable
                        style={[styles.cameraUpload, !w0Done && { opacity: 0.5 }]}
                        onPress={() => {
                          if (!w0Done) {
                            Alert.alert('請先完成 W0', '請先拍攝並標記 W0（目前水量）的水位，再進行 W1。');
                            return;
                          }
                          setCapturePhase('w1');
                        }}
                      >
                        <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                        <Text style={styles.cameraText}>請標記貓咪喝水後的水位</Text>
                      </Pressable>
                    </View>

                    {w1Image && (
                      <View style={[styles.aiResult, { borderColor: '#3b82f6', backgroundColor: '#eff6ff' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppIcon name="check-circle" size={18} color="#1e40af" style={{ marginRight: 6 }} />
                            <Text style={[styles.aiResultTitle, { color: '#1e40af' }]}>W1 拍攝完成 ({vessels.currentVessel?.name})</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => { hydration.clearW1(); setCapturePhase('w1'); }}
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

                    {w1Done && result && (
                      <View style={[styles.aiResult, { borderColor: palette.primary, backgroundColor: palette.surfaceSoft }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="check-circle" size={18} color={palette.primary} style={{ marginRight: 6 }} /><Text style={[styles.aiResultTitle, { color: palette.text }]}>AI 飲水分析結果</Text></View>
                        <View style={styles.aiTags}>
                          <Text style={styles.aiTag}>W0：{result.waterT0Ml} ml</Text>
                          <Text style={styles.aiTag}>W1：{result.waterT1Ml} ml</Text>
                          <Text style={styles.aiTag}>蒸發修正：{result.envFactorMl} ml</Text>
                          <Text style={[styles.aiTag, styles.aiTagHighlight]}>
                            實際飲水量：{result.actualIntakeMl} ml
                          </Text>
                        </View>
                        {(vessels.currentVessel?.calibrationMethod === 'dimensions' || vessels.currentVessel?.calibrationMethod === 'side_profile') && (
                          <Text style={{ fontSize: 11, color: palette.muted, fontStyle: 'italic', marginTop: 8 }}>僅供參考（此容器為測量尺寸／側面輪廓推估，非滿量基準校準）</Text>
                        )}

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

                          <View style={{ marginTop: 12, padding: 12, backgroundColor: palette.surfaceSoft, borderWidth: 1, borderColor: palette.border, borderRadius: 10 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.text }}>說明</Text>
                            <Text style={{ fontSize: 12, lineHeight: 18, color: palette.muted, marginTop: 4 }}>
                              • 家庭（共用）→ 僅記錄到家庭看板{'\n'}
                              • 可分辨貓咪 → 同時記錄到個體檔案與家庭看板
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {mismatchError && (
                      <Text style={styles.resultErrorBox}>
                        碗位辨識不一致：{mismatchError}
                        {'\n'}請重拍 W1（必要時重拍 W0）。
                      </Text>
                    )}

                    {isAnalyzing && <ActivityIndicator size="small" color="#000000" style={styles.loadingSpinner} />}

                    <Pressable style={styles.primaryBtn} onPress={() => saveOwnershipLog((addAnother) => {
                      if (addAnother) {
                        openReset();
                        setCapturePhase(null);
                      } else {
                        resetToBlankRecordScreen();
                        onClose();
                      }
                    })}>
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
