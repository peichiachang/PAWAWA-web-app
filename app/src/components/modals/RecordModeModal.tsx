import React, { useState, useEffect } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActiveModal } from '../../types/app';
import { CatIdentity } from '../../types/domain';
import { styles, palette } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { FeedingModal } from './FeedingModal';
import { HydrationModal } from './HydrationModal';
import type { useFeeding } from '../../hooks/useFeeding';
import type { useHydration } from '../../hooks/useHydration';

export type RecordModeTab = 'feeding' | 'water' | 'elimination' | 'weightRecord' | 'medication' | 'symptom' | 'blood';

const TABS: { key: RecordModeTab; label: string; icon: string }[] = [
  { key: 'feeding', label: '食物紀錄', icon: 'restaurant' },
  { key: 'water', label: '飲水紀錄', icon: 'opacity' },
  { key: 'elimination', label: '排泄紀錄', icon: 'sanitizer' },
  { key: 'weightRecord', label: '體重記錄', icon: 'monitor-weight' },
  { key: 'medication', label: '用藥記錄', icon: 'medication' },
  { key: 'symptom', label: '異常症狀', icon: 'healing' },
  { key: 'blood', label: '報告掃描', icon: 'biotech' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 切換到其他紀錄類型時關閉紀錄模式並開啟對應 Modal */
  onSwitchToModal: (modal: ActiveModal) => void;
  feeding: ReturnType<typeof useFeeding>;
  hydration: ReturnType<typeof useHydration>;
  cats: CatIdentity[];
  /** 初始 tab，例如從首頁「去填寫」進來可帶 'feeding' */
  initialTab?: RecordModeTab;
}

export function RecordModeModal({
  visible,
  onClose,
  onSwitchToModal,
  feeding,
  hydration,
  cats,
  initialTab = 'feeding',
}: Props) {
  const [activeTab, setActiveTab] = useState<RecordModeTab>(initialTab);

  useEffect(() => {
    if (visible) setActiveTab(initialTab);
  }, [visible, initialTab]);

  const switchOnlyTabs: RecordModeTab[] = ['elimination', 'weightRecord', 'medication', 'symptom', 'blood'];

  const modalMap: Record<RecordModeTab, ActiveModal> = {
    feeding: 'feeding',
    water: 'water',
    elimination: 'elimination',
    weightRecord: 'weightRecord',
    medication: 'medication',
    symptom: 'symptom',
    blood: 'blood',
  };

  function handleSwitchTo(tab: RecordModeTab) {
    const modal = modalMap[tab];
    onClose();
    onSwitchToModal(modal);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        <View style={[styles.topNav, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={styles.appTitle}>新增紀錄</Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 8 }}>
            <Text style={{ fontSize: 24, color: palette.text, fontWeight: '300' }}>×</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.key}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  backgroundColor: activeTab === tab.key ? palette.primary : 'transparent',
                }}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === tab.key ? palette.onPrimary : palette.text }}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={{ flex: 1 }}>
          {activeTab === 'feeding' && (
            <FeedingModal visible={true} feeding={feeding} cats={cats} onClose={onClose} embedded />
          )}
          {activeTab === 'water' && (
            <HydrationModal visible={true} hydration={hydration} cats={cats} onClose={onClose} embedded />
          )}
          {switchOnlyTabs.includes(activeTab) && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <AppIcon name={(TABS.find(t => t.key === activeTab)?.icon ?? 'edit') as any} size={48} color={palette.muted} style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 16, color: palette.text, marginBottom: 8 }}>{TABS.find(t => t.key === activeTab)?.label}</Text>
              <Text style={{ fontSize: 13, color: palette.muted, marginBottom: 24, textAlign: 'center' }}>點擊下方按鈕開啟紀錄</Text>
              <Pressable
                style={{ backgroundColor: palette.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10 }}
                onPress={() => handleSwitchTo(activeTab)}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: palette.onPrimary }}>開始記錄</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
