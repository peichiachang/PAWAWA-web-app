import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { AppIcon } from '../AppIcon';
import { useElimination } from '../../hooks/useElimination';
import { CatIdentity } from '../../types/domain';
import { styles } from '../../styles/common';
import { CustomCamera } from '../CustomCamera';

interface Props {
  visible: boolean;
  elimination: ReturnType<typeof useElimination>;
  currentCat: CatIdentity | null;
  cats: CatIdentity[];
  onClose: () => void;
}

const BRISTOL_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const COLOR_OPTIONS = ['棕色', '黑色', '黃色', '紅色', '白色', '綠色', '其他'];

export function EliminationModal({ visible, elimination, currentCat, cats, onClose }: Props) {
  const { done, result, image, isAnalyzing, submitImage, reset, selectedTagId, setSelectedTagId, saveOwnershipLog, saveManualLog } = elimination;

  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('camera');
  const [manualBristol, setManualBristol] = useState(4);
  const [manualColor, setManualColor] = useState('棕色');
  const [manualAbnormal, setManualAbnormal] = useState(false);
  const [manualTagId, setManualTagId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  function resetToBlankRecordScreen() {
    reset();
    setShowCamera(false);
    setInputMode('camera');
    setManualBristol(4);
    setManualColor('棕色');
    setManualAbnormal(false);
    setManualTagId(null);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {showCamera ? (
        <CustomCamera
          title="P1 — 排泄紀錄（糞便）"
          customOptions={{ showGuide: false }}
          onCapture={(image) => {
            void submitImage(image);
            setShowCamera(false);
          }}
          onCancel={() => setShowCamera(false)}
        />
      ) : (
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>排泄記錄</Text>
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
                  <Text style={styles.formLabel}>Bristol 類型 (1–7)</Text>
                  <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 6 }]}>
                    {BRISTOL_OPTIONS.map(n => (
                      <Pressable
                        key={n}
                        style={[styles.choiceBtn, manualBristol === n && styles.choiceBtnActive, { minWidth: 40 }]}
                        onPress={() => setManualBristol(n)}
                      >
                        <Text style={[styles.choiceBtnText, manualBristol === n && styles.choiceBtnTextActive]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                    {manualBristol <= 2 ? '過硬（便秘）' : manualBristol <= 4 ? '正常' : manualBristol <= 5 ? '偏軟' : '腹瀉'}
                  </Text>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>顏色</Text>
                  <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 6 }]}>
                    {COLOR_OPTIONS.map(c => (
                      <Pressable
                        key={c}
                        style={[styles.choiceBtn, manualColor === c && styles.choiceBtnActive]}
                        onPress={() => setManualColor(c)}
                      >
                        <Text style={[styles.choiceBtnText, manualColor === c && styles.choiceBtnTextActive]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>狀態</Text>
                  <View style={styles.choiceRow}>
                    <Pressable
                      style={[styles.choiceBtn, !manualAbnormal && styles.choiceBtnActive]}
                      onPress={() => setManualAbnormal(false)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="check-circle" size={16} color={!manualAbnormal ? '#fff' : '#000'} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, !manualAbnormal && styles.choiceBtnTextActive]}>正常</Text></View>
                    </Pressable>
                    <Pressable
                      style={[styles.choiceBtn, manualAbnormal && styles.choiceBtnActive]}
                      onPress={() => setManualAbnormal(true)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="warning" size={16} color={manualAbnormal ? '#fff' : '#000'} style={{ marginRight: 4 }} /><Text style={[styles.choiceBtnText, manualAbnormal && styles.choiceBtnTextActive]}>異常</Text></View>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>屬於哪隻貓？</Text>
                  <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 8 }]}>
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
                    saveManualLog(manualBristol, '手動輸入', manualColor, manualAbnormal, manualTagId, resetToBlankRecordScreen);
                  }}
                >
                  <Text style={styles.primaryBtnText}>儲存記錄</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.infoBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="sanitizer" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.infoTitle}>貓砂盆記錄</Text></View>
                  <Text style={{ fontSize: 12 }}>AI 將自動參考布里斯托大便分類法提供分級建議</Text>
                </View>

                <View style={{ backgroundColor: '#fef3c7', borderColor: '#fcd34d', borderWidth: 2, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="lightbulb" size={14} color="#92400e" style={{ marginRight: 4 }} /><Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>拍攝小建議</Text></View>
                  <Text style={{ fontSize: 12, color: '#92400e', lineHeight: 18 }}>
                    請將便便撈到貓砂鏟上後拍攝，避開貓砂干擾。
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>P1 — 排泄（糞便）</Text>
                  <Pressable style={styles.cameraUpload} onPress={() => setShowCamera(true)}>
                    <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                    <Text style={styles.cameraText}>拍攝以進行 AI 分析</Text>
                  </Pressable>
                </View>

                {image && !done && (
                  <View style={[styles.aiResult, { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="check-circle" size={18} color="#166534" style={{ marginRight: 6 }} /><Text style={[styles.aiResultTitle, { color: '#166534' }]}>拍攝完成，分析中...</Text></View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => { reset(); setShowCamera(true); }}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#166534' }}
                        >
                          <Text style={{ fontSize: 10, color: '#166534' }}>重新拍攝</Text>
                        </Pressable>
                        <Pressable
                          onPress={reset}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                        >
                          <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除照片</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}

                {done && result && (
                  <View style={styles.aiResult}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="smart-toy" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.aiResultTitle}>AI 分析結果</Text></View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => { reset(); setShowCamera(true); }}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#166534' }}
                        >
                          <Text style={{ fontSize: 10, color: '#166534' }}>重新拍攝</Text>
                        </Pressable>
                        <Pressable
                          onPress={reset}
                          style={{ padding: 4, borderWidth: 1, borderRadius: 4, borderColor: '#dc2626' }}
                        >
                          <Text style={{ fontSize: 10, color: '#dc2626' }}>刪除照片</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.aiTags}>
                      <Text style={[styles.aiTag, styles.aiTagHighlight]}>Bristol Type {result.bristolType}</Text>
                      <Text style={styles.aiTag}>形狀：{result.shapeType}</Text>
                      <Text style={styles.aiTag}>顏色：{result.color}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name={result.abnormal ? 'warning' : 'check-circle'} size={14} color={result.abnormal ? '#d32f2f' : '#166534'} style={{ marginRight: 4 }} /><Text style={styles.aiTagHighlight}>{result.abnormal ? '疑似異常' : '正常'}</Text></View>
                      <Text style={styles.aiTag}>信心度：{Math.round(result.confidence * 100)}%</Text>
                    </View>
                    {result.note && (
                      <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', marginBottom: 4 }}>備註：</Text>
                        <Text style={{ fontSize: 12, lineHeight: 18 }}>{result.note}</Text>
                      </View>
                    )}

                    <View style={{ marginTop: 24, marginBottom: 16 }}>
                      <Text style={styles.formLabel}>這筆記錄屬於誰？</Text>
                      <View style={[styles.choiceRow, { flexWrap: 'wrap', gap: 8, marginTop: 8 }]}>
                        {cats.map(cat => (
                          <Pressable
                            key={cat.id}
                            style={[styles.choiceBtn, selectedTagId === cat.id && styles.choiceBtnActive]}
                            onPress={() => setSelectedTagId(cat.id)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <AppIcon name="pets" size={16} color={selectedTagId === cat.id ? '#fff' : '#000'} style={{ marginRight: 4 }} />
                              <Text style={[styles.choiceBtnText, selectedTagId === cat.id && styles.choiceBtnTextActive]}>{cat.name}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {isAnalyzing && <ActivityIndicator size="small" color="#000000" style={styles.loadingSpinner} />}

                <Pressable
                  style={[styles.primaryBtn, (!result || !selectedTagId) && { opacity: 0.5 }]}
                  onPress={() => saveOwnershipLog(resetToBlankRecordScreen)}
                  disabled={!result || !selectedTagId}
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
