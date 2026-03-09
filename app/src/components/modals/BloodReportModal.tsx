import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../AppIcon';
import { useBloodReport } from '../../hooks/useBloodReport';
import { CatIdentity } from '../../types/domain';
import { BloodMarkerInterpretation, BLOOD_CATEGORY_LABEL } from '../../types/bloodReport';
import { BLOOD_REPORT_DISCLAIMER } from '../../services/bloodReport';
import { styles } from '../../styles/common';
import { CustomCamera } from '../CustomCamera';
import { useState } from 'react';

interface Props {
  visible: boolean;
  bloodReport: ReturnType<typeof useBloodReport>;
  currentCat: CatIdentity | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  high: '↑ 偏高',
  low: '↓ 偏低',
  normal: '正常',
  unknown: '—',
};

function MarkerCard({ item }: { item: BloodMarkerInterpretation }) {
  const isOutOfRange = item.status === 'high' || item.status === 'low';
  return (
    <View style={[markerStyles.card, isOutOfRange && markerStyles.cardAlert]}>
      <View style={markerStyles.header}>
        <View>
          <Text style={markerStyles.code}>{item.code}</Text>
          <Text style={markerStyles.name}>{item.nameZh}</Text>
        </View>
        <View style={markerStyles.valueBlock}>
          <Text style={[markerStyles.value, isOutOfRange && markerStyles.valueAlert]}>
            {item.value} {item.unit}
          </Text>
          <Text style={markerStyles.refRange}>參考：{item.refRange}</Text>
          <Text style={[markerStyles.status, isOutOfRange && markerStyles.statusAlert]}>
            {STATUS_LABEL[item.status] ?? '—'}
          </Text>
        </View>
      </View>
      <Text style={markerStyles.description}>{item.description}</Text>
      {item.context && (
        <View style={markerStyles.contextBox}>
          <Text style={markerStyles.contextText}>{item.context}</Text>
        </View>
      )}
    </View>
  );
}

export function BloodReportModal({ visible, bloodReport, currentCat, onClose }: Props) {
  const { isAnalyzing, photo, interpretations, reportDate, runOcr, runOcrFromImage, reset, saveReport } = bloodReport;
  const [showCamera, setShowCamera] = useState(false);

  function resetToBlankRecordScreen() {
    reset();
    setShowCamera(false);
  }

  const grouped = interpretations
    ? interpretations.reduce<Record<string, BloodMarkerInterpretation[]>>((acc, item) => {
      const key = BLOOD_CATEGORY_LABEL[item.category] ?? '其他';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {})
    : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {showCamera ? (
        <CustomCamera
          title="血液報告拍攝"
          customOptions={{ showGuide: false }}
          onCapture={(image) => {
            void runOcrFromImage(image);
            setShowCamera(false);
          }}
          onCancel={() => setShowCamera(false)}
        />
      ) : (
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>血液報告解讀</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>🩸 血液報告掃描</Text>
              <Text style={{ fontSize: 12 }}>
                {BLOOD_REPORT_DISCLAIMER}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>上傳報告</Text>
              <View style={markerStyles.uploadRow}>
                <Pressable style={[styles.cameraUpload, markerStyles.uploadBtn]} onPress={() => setShowCamera(true)}>
                  <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />
                  <Text style={markerStyles.uploadBtnText}>拍照</Text>
                </Pressable>
                <Pressable style={[styles.cameraUpload, markerStyles.uploadBtn]} onPress={() => runOcr('library')}>
                  <AppIcon name="image" size={28} color="#000" style={styles.cameraIcon} />
                  <Text style={markerStyles.uploadBtnText}>從相簿選取</Text>
                </Pressable>
              </View>
            </View>

            {photo && !interpretations && (
              <View style={[styles.aiResult, { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="check-circle" size={18} color="#166534" style={{ marginRight: 6 }} /><Text style={[styles.aiResultTitle, { color: '#166534' }]}>{isAnalyzing ? '拍攝完成，分析中...' : '拍攝完成'}</Text></View>
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

            {isAnalyzing && (
              <ActivityIndicator size="small" color="#000000" style={styles.loadingSpinner} />
            )}

            {interpretations && grouped && (
              <View style={styles.aiResult}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="smart-toy" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.aiResultTitle}>OCR 解讀結果</Text></View>
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
                {reportDate ? (
                  <Text style={markerStyles.reportMeta}>掃描日期：{reportDate}</Text>
                ) : null}

                {Object.entries(grouped).map(([category, items]) => (
                  <View key={category}>
                    <Text style={markerStyles.categoryTitle}>{category}</Text>
                    {items.map((item) => (
                      <MarkerCard key={item.code} item={item} />
                    ))}
                  </View>
                ))}
              </View>
            )}

            {interpretations && grouped && (
              <View>
                {/* Data Attribution */}
                <View style={{ marginTop: 24, marginBottom: 16 }}>
                  <Text style={styles.formLabel}>這筆報告屬於誰？</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    {(['household', 'cat_001', 'cat_002'] as const).map((l) => (
                      <Pressable
                        key={l}
                        style={[styles.choiceBtn, (l === 'cat_001') && styles.choiceBtnActive, { flex: 1 }]}
                        onPress={() => { }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <AppIcon name={l === 'household' ? 'home' : 'pets'} size={16} color={(l === 'cat_001') ? '#fff' : '#000'} style={{ marginRight: 4 }} />
                          <Text style={[styles.choiceBtnText, (l === 'cat_001') && styles.choiceBtnTextActive]}>
                            {l === 'household' ? '家庭' : l === 'cat_001' ? '小白' : '小黑'}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => saveReport(currentCat?.id ?? 'household', resetToBlankRecordScreen)}
                >
                  <Text style={styles.primaryBtnText}>
                    儲存報告
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
      )}
    </Modal>
  );
}

import { StyleSheet } from 'react-native';

const markerStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    color: '#525252',
  },
  uploadRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  uploadBtn: {
    flex: 1,
    marginBottom: 0,
  },
  uploadBtnText: {
    fontSize: 12,
  },
  reportMeta: {
    fontSize: 12,
    color: '#525252',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
    marginBottom: 8,
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    padding: 10,
    marginBottom: 8,
    gap: 6,
  },
  cardAlert: {
    borderColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  code: {
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    fontSize: 11,
    color: '#525252',
  },
  valueBlock: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
  },
  valueAlert: {
    color: '#7f1d1d',
  },
  refRange: {
    fontSize: 10,
    color: '#737373',
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
    color: '#525252',
  },
  statusAlert: {
    color: '#7f1d1d',
  },
  description: {
    fontSize: 11,
    color: '#404040',
    lineHeight: 16,
  },
  contextBox: {
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
    paddingLeft: 8,
    marginTop: 4,
  },
  contextText: {
    fontSize: 11,
    color: '#262626',
    lineHeight: 16,
  },
});
