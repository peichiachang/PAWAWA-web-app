import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { CatIdentity } from '../../types/domain';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { getDevDataMode, type DevDataMode } from '../../config/devDataMode';

interface Props {
  visible: boolean;
  cats: CatIdentity[];
  onClose: () => void;
  onSwitchDevDataMode?: (mode: DevDataMode) => Promise<void>;
}

export function SettingsModal({ visible, cats, onClose, onSwitchDevDataMode }: Props) {
  const [currentMode, setCurrentMode] = useState<DevDataMode>('empty');

  useEffect(() => {
    if (visible) {
      getDevDataMode().then(setCurrentMode);
    }
  }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>系統設定</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
            <View style={styles.cardBlock}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0f0f0', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <AppIcon name="pets" size={32} color="#000" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 4 }}>專業貓奴</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>家庭成員：{cats.length} 隻貓咪</Text>
              </View>

            </View>

            {onSwitchDevDataMode && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>開發測試</Text>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: '#666' }}>目前：{currentMode === 'mock' ? '假資料' : '空狀態'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable
                    style={[
                      styles.recordItem,
                      { flex: 1, alignItems: 'center', backgroundColor: currentMode === 'mock' ? '#e8f5e9' : '#f5f5f5' },
                    ]}
                    onPress={async () => {
                      if (currentMode === 'mock') return;
                      Alert.alert(
                        '切換至假資料',
                        '將寫入約 90+ 筆飲食、60+ 筆飲水、50 筆排泄、40 筆投藥紀錄，以及 3 隻貓咪與體重紀錄。現有資料會被覆蓋。',
                        [
                          { text: '取消', style: 'cancel' },
                          {
                            text: '確定',
                            onPress: async () => {
                              try {
                                await onSwitchDevDataMode('mock');
                                setCurrentMode('mock');
                                onClose();
                                Alert.alert('完成', '已切換至假資料，請查看首頁與紀錄。');
                              } catch (e) {
                                Alert.alert('失敗', (e as Error).message);
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <AppIcon name="science" size={20} color="#000" style={{ marginBottom: 4 }} />
                    <Text style={styles.recordTitle}>假資料</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.recordItem,
                      { flex: 1, alignItems: 'center', backgroundColor: currentMode === 'empty' ? '#e8f5e9' : '#f5f5f5' },
                    ]}
                    onPress={async () => {
                      if (currentMode === 'empty') return;
                      Alert.alert(
                        '切換至空狀態',
                        '將清除所有飲食、飲水、排泄、投藥、貓咪與體重紀錄。此操作無法復原。',
                        [
                          { text: '取消', style: 'cancel' },
                          {
                            text: '確定',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await onSwitchDevDataMode('empty');
                                setCurrentMode('empty');
                                onClose();
                                Alert.alert('完成', '已切換至空狀態。');
                              } catch (e) {
                                Alert.alert('失敗', (e as Error).message);
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <AppIcon name="delete-outline" size={20} color="#000" style={{ marginBottom: 4 }} />
                    <Text style={styles.recordTitle}>空狀態</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 11, color: '#666', marginTop: 8 }}>可隨時切換假資料與空狀態，用於測試介面呈現</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>報告與資料</Text>
              <Pressable style={[styles.recordItem, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => Alert.alert('匯出', '已匯出家庭背景報告。')}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="description" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.recordTitle}>匯出家庭背景報告</Text></View>
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>包含基本資訊與共同紀錄</Text>
                </View>
                <Text style={{ fontSize: 16 }}>→</Text>
              </Pressable>
              <Pressable style={[styles.recordItem, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => Alert.alert('匯出', '已匯出個體摘要報告。')}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="bar-chart" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.recordTitle}>匯出個體摘要報告</Text></View>
                  <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>14天健康趨勢與預警分析</Text>
                </View>
                <Text style={{ fontSize: 16 }}>→</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
