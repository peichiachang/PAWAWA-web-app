import React, { useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { FeedLibraryItem } from '../../types/app';
import { styles, palette } from '../../styles/common';
import { AppIcon } from '../AppIcon';

interface Props {
  visible: boolean;
  feedLibrary: FeedLibraryItem[];
  onAdd: (item: Omit<FeedLibraryItem, 'id'>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export function FeedLibraryModal({ visible, feedLibrary, onAdd, onRemove, onClose }: Props) {
  const [name, setName] = useState('');
  const [kcalPerGram, setKcalPerGram] = useState('');

  function handleAdd() {
    const kcal = parseFloat(kcalPerGram);
    if (!name.trim()) {
      Alert.alert('請輸入飼料名稱');
      return;
    }
    if (!Number.isFinite(kcal) || kcal <= 0) {
      Alert.alert('請輸入每克熱量', '例：3.5 表示 1g 約 3.5 kcal。');
      return;
    }
    onAdd({ name: name.trim(), kcalPerGram: kcal });
    setName('');
    setKcalPerGram('');
  }

  function handleRemove(item: FeedLibraryItem) {
    Alert.alert('刪除飼料', `確定要刪除「${item.name}」嗎？`, [
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
          <ScrollView style={styles.modalBody}>
            <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 16 }}>
              掃描一次飼料成份表後可在此儲存，記錄時可選「使用已存飼料」帶入熱量。也可手動新增名稱與每克熱量。
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>新增飼料</Text>
              <TextInput style={styles.input} placeholder="飼料名稱（例：XX 成貓飼料）" value={name} onChangeText={setName} />
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
                      <Text style={{ fontSize: 14, fontWeight: '600' }}>{feed.name}</Text>
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
