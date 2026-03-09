import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { CatIdentity, SymptomSeverity } from '../../types/domain';

interface Props {
  visible: boolean;
  onClose: () => void;
  cats: CatIdentity[];
  onSave: (data: {
    catId: string;
    symptom: string;
    severity: SymptomSeverity;
    observedAt?: string;
    notes?: string;
  }) => void;
}

const severityOptions: Array<{ key: SymptomSeverity; label: string }> = [
  { key: 'mild', label: '輕微' },
  { key: 'moderate', label: '中等' },
  { key: 'severe', label: '嚴重' },
];

export function SymptomModal({ visible, onClose, cats, onSave }: Props) {
  const defaultCatId = useMemo(() => cats[0]?.id || '', [cats]);
  const [selectedCatId, setSelectedCatId] = useState(defaultCatId);
  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [observedAt, setObservedAt] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    if (!selectedCatId && defaultCatId) setSelectedCatId(defaultCatId);
  }, [visible, defaultCatId, selectedCatId]);

  const handleSave = () => {
    if (!selectedCatId || !symptom.trim()) {
      Alert.alert('錯誤', '請填寫必填欄位（貓咪、症狀描述）');
      return;
    }
    onSave({
      catId: selectedCatId,
      symptom: symptom.trim(),
      severity,
      observedAt: observedAt.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSymptom('');
    setSeverity('mild');
    setObservedAt('');
    setNotes('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>異常症狀記錄</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.infoBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <AppIcon name="healing" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.infoTitle}>記錄異常症狀，追蹤變化</Text>
              </View>
              <Text style={{ fontSize: 12 }}>建議可填寫症狀出現時間、持續狀況與補充說明</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>選擇貓咪 *</Text>
              <View style={styles.choiceRow}>
                {cats.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[styles.choiceBtn, selectedCatId === cat.id && styles.choiceBtnActive]}
                    onPress={() => setSelectedCatId(cat.id)}
                  >
                    <Text style={[styles.choiceBtnText, selectedCatId === cat.id && styles.choiceBtnTextActive]}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>症狀描述 *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="例如：食慾下降、嘔吐、活動力差"
                value={symptom}
                onChangeText={setSymptom}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>嚴重程度</Text>
              <View style={styles.choiceRow}>
                {severityOptions.map((item) => (
                  <Pressable
                    key={item.key}
                    style={[styles.choiceBtn, severity === item.key && styles.choiceBtnActive]}
                    onPress={() => setSeverity(item.key)}
                  >
                    <Text style={[styles.choiceBtnText, severity === item.key && styles.choiceBtnTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>觀察時間 (選填)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="例如：2026-03-02 11:00"
                value={observedAt}
                onChangeText={setObservedAt}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>補充說明</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="例如：持續 2 小時、已先暫停餵食"
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <Pressable style={styles.primaryBtn} onPress={handleSave}>
              <Text style={styles.primaryBtnText}>儲存症狀紀錄</Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
