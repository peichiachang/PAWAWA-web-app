import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { CannedItem, CapturedImage, CanLabelScanResult } from '../../types/app';
import { styles, palette } from '../../styles/common';
import { AppIcon } from '../AppIcon';

interface Props {
  visible: boolean;
  canLibrary: CannedItem[];
  onAdd: (item: Omit<CannedItem, 'id'>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  /** 拍攝罐頭標籤（後端 API 串接後由掃描服務帶入） */
  launchCamera?: (title: string) => Promise<CapturedImage | null>;
  /** 罐頭標籤掃描 API（目前為 stub，後端串接後回傳 name / defaultGrams / kcalPer100） */
  scanCanLabel?: (image: CapturedImage) => Promise<CanLabelScanResult>;
}

export function CanLibraryModal({ visible, canLibrary, onAdd, onRemove, onClose, launchCamera, scanCanLabel }: Props) {
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [kcalPer100, setKcalPer100] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  function handleAdd() {
    const g = parseFloat(grams);
    if (!name.trim()) {
      Alert.alert('請輸入罐頭名稱');
      return;
    }
    if (!g || g <= 0) {
      Alert.alert('請輸入克數', '克數必須大於 0。');
      return;
    }
    onAdd({
      name: name.trim(),
      defaultGrams: g,
      kcalPer100: kcalPer100 ? parseFloat(kcalPer100) : undefined,
    });
    setName('');
    setGrams('');
    setKcalPer100('');
  }

  function handleRemove(item: CannedItem) {
    Alert.alert('刪除罐頭', `確定要刪除「${item.name}」嗎？`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => onRemove(item.id) },
    ]);
  }

  async function handleScanLabel() {
    if (!launchCamera || !scanCanLabel) {
      Alert.alert('尚未開放', '罐頭標籤掃描 API 尚未串接，請改用手動輸入。');
      return;
    }
    setIsScanning(true);
    try {
      const image = await launchCamera('拍攝罐頭標籤');
      if (!image) return;
      const result = await scanCanLabel(image);
      if (result.name != null) setName(result.name);
      if (result.defaultGrams != null) setGrams(String(result.defaultGrams));
      if (result.kcalPer100 != null) setKcalPer100(String(result.kcalPer100));
      if (result.name == null && result.defaultGrams == null && result.kcalPer100 == null) {
        Alert.alert('掃描完成', '目前 API 尚未回傳資料，請手動填寫後加入罐頭庫。');
      }
    } catch (e) {
      Alert.alert('掃描失敗', (e as Error).message);
    } finally {
      setIsScanning(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>罐頭庫</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 16 }}>
              新增的罐頭會出現在「食物記錄」→ 罐頭流程的選擇清單中，不需重複輸入。
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>新增罐頭</Text>
              {launchCamera && scanCanLabel ? (
                <Pressable style={[styles.cameraUpload, { marginBottom: 12 }]} onPress={handleScanLabel} disabled={isScanning}>
                  {isScanning ? <ActivityIndicator size="small" color="#000" /> : <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />}
                  <Text style={styles.cameraText}>{isScanning ? '掃描中…' : '掃描罐頭標籤'}</Text>
                </Pressable>
              ) : null}
              <TextInput style={styles.input} placeholder="罐頭名稱（例：主食罐 A）" value={name} onChangeText={setName} />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="預設克數（例：80）"
                keyboardType="numeric"
                value={grams}
                onChangeText={setGrams}
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="每 100g 熱量（選填，例：120）"
                keyboardType="numeric"
                value={kcalPer100}
                onChangeText={setKcalPer100}
              />
              <Pressable style={[styles.primaryBtn, { marginTop: 12 }]} onPress={handleAdd}>
                <Text style={styles.primaryBtnText}>加入罐頭庫</Text>
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>已儲存的罐頭（{canLibrary.length}）</Text>
              {canLibrary.length === 0 ? (
                <Text style={{ fontSize: 13, color: palette.muted }}>尚無罐頭，請上方新增</Text>
              ) : (
                canLibrary.map((can) => (
                  <View
                    key={can.id}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600' }}>{can.name}</Text>
                      <Text style={{ fontSize: 12, color: palette.muted }}>
                        {can.defaultGrams}g{can.kcalPer100 != null ? ` · ${can.kcalPer100} kcal/100g` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRemove(can)} style={{ padding: 8 }}>
                      <AppIcon name="delete-outline" size={22} color="#dc2626" />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
