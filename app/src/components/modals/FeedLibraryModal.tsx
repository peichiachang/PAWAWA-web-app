import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { FeedLibraryItem, getFeedDisplayName } from '../../types/app';
import { styles, palette } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { DRY_FEED_SEED } from '../../constants/feedLibrarySeed';

interface Props {
  visible: boolean;
  feedLibrary: FeedLibraryItem[];
  onAdd: (item: Omit<FeedLibraryItem, 'id'>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

function matchFeedSeed(query: string, item: FeedLibraryItem): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const hay = [
    item.search_keywords ?? '',
    item.display_name ?? '',
    item.brand ?? '',
    item.product_name ?? '',
    item.flavor ?? '',
  ].join(' ').toLowerCase();
  return hay.includes(q) || hay.split(/[\s,，、]+/).some(part => part.includes(q) || q.includes(part));
}

export function FeedLibraryModal({ visible, feedLibrary, onAdd, onRemove, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [flavor, setFlavor] = useState('');
  const [kcalPerGram, setKcalPerGram] = useState('');

  const seedMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const existingNames = new Set(feedLibrary.map(f => (f.display_name ?? f.name ?? '').toLowerCase()));
    return DRY_FEED_SEED.filter(item => {
      if (existingNames.has((item.display_name ?? '').toLowerCase())) return false;
      return matchFeedSeed(searchQuery, item);
    }).slice(0, 20);
  }, [searchQuery, feedLibrary]);

  function handleAdd() {
    const kcal = parseFloat(kcalPerGram);
    const display_name = [brand.trim(), productName.trim(), flavor.trim()].filter(Boolean).join(' ') || undefined;
    if (!display_name) {
      Alert.alert('請至少填寫品牌、品名或口味其一');
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      Alert.alert('請輸入每克熱量', '例：3.5 表示 1g 約 3.5 kcal。');
      return;
    }
    onAdd({
      brand: brand.trim() || undefined,
      product_name: productName.trim() || undefined,
      flavor: flavor.trim() || undefined,
      food_form: 'dry',
      is_prescription: 'no',
      display_name,
      kcalPerGram: kcal,
      fromSeed: false,
    });
    setBrand('');
    setProductName('');
    setFlavor('');
    setKcalPerGram('');
  }

  function handleSelectSeed(item: FeedLibraryItem) {
    onAdd({
      brand: item.brand,
      product_name: item.product_name,
      flavor: item.flavor,
      food_form: 'dry',
      complete_or_complement: item.complete_or_complement,
      is_prescription: item.is_prescription ?? 'no',
      search_keywords: item.search_keywords,
      display_name: item.display_name,
      kcalPerGram: item.kcalPerGram,
      fromSeed: false,
    });
    setSearchQuery('');
  }

  function handleRemove(item: FeedLibraryItem) {
    Alert.alert('刪除飼料', `確定要刪除「${getFeedDisplayName(item)}」嗎？`, [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => onRemove(item.id) },
    ]);
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>飼料設定</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 16 }}>
              輸入關鍵字從乾糧庫搜尋並加入，或手動新增。記錄時會優先顯示您已加入的飼料。
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>從乾糧庫搜尋並加入</Text>
              <TextInput
                style={styles.input}
                placeholder="輸入品牌、品名或關鍵字（例：皇家、泌尿、幼貓）"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {seedMatches.length > 0 && (
                <View style={{ marginTop: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 8, maxHeight: 220 }}>
                  <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {seedMatches.map((item) => (
                      <Pressable
                        key={item.id}
                        style={{ paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}
                        onPress={() => handleSelectSeed(item)}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600' }}>{getFeedDisplayName(item)}</Text>
                        <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>{item.kcalPerGram} kcal/g · 點擊加入飼料庫</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>或手動新增飼料</Text>
              <TextInput style={styles.input} placeholder="品牌（選填）" value={brand} onChangeText={setBrand} />
              <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="品名（例：成貓／室內／泌尿保健）" value={productName} onChangeText={setProductName} />
              <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="口味（選填）" value={flavor} onChangeText={setFlavor} />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="每克熱量 kcal/g（例：3.5）"
                keyboardType="decimal-pad"
                value={kcalPerGram}
                onChangeText={setKcalPerGram}
              />
              <Text style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>可從成份表「每 100g 熱量」÷ 100 得到</Text>
              <Pressable style={[styles.primaryBtn, { marginTop: 12 }]} onPress={handleAdd}>
                <Text style={styles.primaryBtnText}>加入飼料庫</Text>
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>已儲存的飼料（{feedLibrary.length}）</Text>
              {feedLibrary.length === 0 ? (
                <Text style={{ fontSize: 13, color: palette.muted }}>尚無飼料，請上方新增或從食物記錄掃描標籤後儲存</Text>
              ) : (
                feedLibrary.map((feed) => (
                  <View
                    key={feed.id}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600' }}>{getFeedDisplayName(feed)}</Text>
                      <Text style={{ fontSize: 12, color: palette.muted }}>{feed.kcalPerGram} kcal/g</Text>
                    </View>
                    <Pressable onPress={() => handleRemove(feed)} style={{ padding: 8 }}>
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
