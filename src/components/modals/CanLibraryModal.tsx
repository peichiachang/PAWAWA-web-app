import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { CannedItem, CapturedImage, CanLabelScanResult, getCannedDisplayName } from '../../types/app';
import { styles, palette } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { WET_CAN_SEED } from '../../constants/canLibrarySeed';

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

function matchCanSeed(query: string, item: CannedItem | (Omit<CannedItem, 'id'> & { id?: string })): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const hay = [
    (item as CannedItem).search_keywords ?? '',
    item.display_name ?? '',
    item.brand ?? '',
    item.product_name ?? '',
    item.flavor ?? '',
  ].join(' ').toLowerCase();
  return hay.includes(q) || hay.split(/[\s,，、]+/).some(part => part.includes(q) || q.includes(part));
}

export function CanLibraryModal({ visible, canLibrary, onAdd, onRemove, onClose, launchCamera, scanCanLabel }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [flavor, setFlavor] = useState('');
  const [grams, setGrams] = useState('');
  const [kcalPer100, setKcalPer100] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const seedMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || WET_CAN_SEED.length === 0) return [];
    const existingNames = new Set(canLibrary.map(c => (getCannedDisplayName(c)).toLowerCase()));
    return WET_CAN_SEED.filter(item => {
      const name = (item.display_name ?? [item.brand, item.product_name, item.flavor].filter(Boolean).join(' ')).toLowerCase();
      if (existingNames.has(name)) return false;
      return matchCanSeed(searchQuery, item);
    }).slice(0, 20);
  }, [searchQuery, canLibrary]);

  function handleSelectSeed(item: Omit<CannedItem, 'id'> & { id?: string }) {
    onAdd({
      brand: item.brand,
      product_name: item.product_name,
      flavor: item.flavor,
      food_form: 'wet',
      is_prescription: item.is_prescription ?? 'no',
      display_name: item.display_name ?? [item.brand, item.product_name, item.flavor].filter(Boolean).join(' '),
      defaultGrams: item.defaultGrams ?? 80,
      kcalPer100: item.kcalPer100,
      fromSeed: false,
    });
    setSearchQuery('');
  }

  function handleAdd() {
    const g = parseFloat(grams);
    const display_name = [brand.trim(), productName.trim(), flavor.trim()].filter(Boolean).join(' ') || undefined;
    if (!display_name) {
      Alert.alert('請至少填寫品牌、品名或口味其一');
      return;
    }
    if (!g || g <= 0) {
      Alert.alert('請輸入克數', '克數必須大於 0。');
      return;
    }
    onAdd({
      brand: brand.trim() || undefined,
      product_name: productName.trim() || undefined,
      flavor: flavor.trim() || undefined,
      food_form: 'wet',
      is_prescription: 'no',
      display_name,
      defaultGrams: g,
      kcalPer100: kcalPer100 ? parseFloat(kcalPer100) : undefined,
      fromSeed: false,
    });
    setBrand('');
    setProductName('');
    setFlavor('');
    setGrams('');
    setKcalPer100('');
  }

  function handleRemove(item: CannedItem) {
    Alert.alert('刪除罐頭', `確定要刪除「${getCannedDisplayName(item)}」嗎？`, [
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
      if (result.name != null) setProductName(result.name);
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
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 16 }}>
              內建罐頭庫（擴充後可搜尋），輸入關鍵字搜尋後點擊項目即加入「我常用的罐頭」；記錄時會優先顯示我常用的罐頭。
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>從罐頭庫搜尋並加入我常用的罐頭</Text>
              <TextInput
                style={styles.input}
                placeholder="輸入品牌、品名或關鍵字（罐頭種子庫擴充後可用）"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {seedMatches.length > 0 && (
                <View style={{ marginTop: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 8, maxHeight: 220 }}>
                  <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {seedMatches.map((item, idx) => (
                      <Pressable
                        key={item.display_name ?? idx}
                        style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}
                        onPress={() => handleSelectSeed(item)}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600' }}>{item.display_name ?? [item.brand, item.product_name, item.flavor].filter(Boolean).join(' ')}</Text>
                        <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>{(item.defaultGrams ?? 80)}g · 點擊加入「我常用的罐頭」</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>或手動新增至我常用的罐頭</Text>
              {launchCamera && scanCanLabel ? (
                <Pressable style={[styles.cameraUpload, { marginBottom: 12 }]} onPress={handleScanLabel} disabled={isScanning}>
                  {isScanning ? <ActivityIndicator size="small" color="#000" /> : <AppIcon name="camera-alt" size={28} color="#000" style={styles.cameraIcon} />}
                  <Text style={styles.cameraText}>{isScanning ? '掃描中…' : '掃描罐頭標籤'}</Text>
                </Pressable>
              ) : null}
              <TextInput style={styles.input} placeholder="品牌（選填）" value={brand} onChangeText={setBrand} />
              <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="品名（例：主食罐／副食罐／幼貓）" value={productName} onChangeText={setProductName} />
              <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="口味（選填）" value={flavor} onChangeText={setFlavor} />
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
                <Text style={styles.primaryBtnText}>加入我常用的罐頭</Text>
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>我常用的罐頭（{canLibrary.length}）</Text>
              {canLibrary.length === 0 ? (
                <Text style={{ fontSize: 13, color: palette.muted }}>尚無項目。請在上方從罐頭庫搜尋並點擊加入，或手動新增／掃描標籤；記錄時可快速選取</Text>
              ) : (
                canLibrary.map((can) => (
                  <View
                    key={can.id}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600' }}>{getCannedDisplayName(can)}</Text>
                      <Text style={{ fontSize: 12, color: palette.muted }}>
                        {can.defaultGrams != null ? `${can.defaultGrams}g` : ''}{can.kcalPer100 != null ? ` · ${can.kcalPer100} kcal/100g` : ''}
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
