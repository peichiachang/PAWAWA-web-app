import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { ActiveModal, FeedingOwnershipLog, HydrationOwnershipLog } from '../types/app';
import { EliminationOwnershipLog } from '../hooks/useElimination';
import { CatIdentity, MedicationLog, SymptomLog } from '../types/domain';
import { DetailRecord } from './modals/RecordDetailModal';
import { styles } from '../styles/common';
import { AppIcon } from './AppIcon';
import { RecordLogItem } from './RecordLogItem';
import { extractCatSeries, getCatNameBySeries, getScopedCats, matchesCatSeries } from '../utils/catScope';

type RecordScope = 'household' | string;
type RecordTypeFilter = 'all' | 'feeding' | 'hydration' | 'elimination' | 'medication' | 'symptom';
type DateFilter = 'all' | '7d' | '30d';

interface Props {
  onOpenModal: (modal: ActiveModal) => void;
  feedingHistory: FeedingOwnershipLog[];
  hydrationHistory: HydrationOwnershipLog[];
  eliminationHistory: EliminationOwnershipLog[];
  medicationHistory: MedicationLog[];
  symptomHistory: SymptomLog[];
  cats: CatIdentity[];
  onRecordPress?: (record: DetailRecord) => void;
  /** 有 T0 尚未填 T1 的筆數（待補填）；若 > 0 顯示提示與入口 */
  pendingT1Count?: number;
  /** 點擊「去填寫」時呼叫，由 App 開啟食物記錄並聚焦該食碗的 T1 步驟 */
  onOpenPendingT1?: () => void;
}

export function RecordsContent({
  onOpenModal,
  feedingHistory,
  hydrationHistory,
  eliminationHistory,
  medicationHistory,
  symptomHistory,
  cats,
  onRecordPress,
  pendingT1Count = 0,
  onOpenPendingT1,
}: Props) {
  const [scope, setScope] = useState<RecordScope>('household');
  const [typeFilter, setTypeFilter] = useState<RecordTypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [filterSheet, setFilterSheet] = useState<'scope' | 'type' | 'date' | null>(null);

  const filteredRecords = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const cutoff7d = now - 7 * day;
    const cutoff30d = now - 30 * day;

    const filterByDate = (ts: number) => {
      if (dateFilter === 'all') return true;
      if (dateFilter === '7d') return ts >= cutoff7d;
      return ts >= cutoff30d;
    };

    // 家庭：僅顯示 household_only（未歸屬個體貓咪的紀錄）；個體：顯示該貓的紀錄
    let feedings = feedingHistory
      .filter(f => {
        if (scope === 'household') return f.ownershipType === 'household_only';
        return matchesCatSeries(f.selectedTagId, scope);
      })
      .filter(f => filterByDate(f.createdAt))
      .map(l => ({ ...l, _type: 'feeding' as const }));

    let hydrations = hydrationHistory
      .filter(h => {
        if (scope === 'household') return h.ownershipType === 'household_only';
        return matchesCatSeries(h.selectedTagId, scope);
      })
      .filter(h => filterByDate(h.createdAt))
      .map(l => ({ ...l, _type: 'hydration' as const }));

    let eliminations = eliminationHistory
      .filter(e => {
        if (scope === 'household') return e.selectedTagId === null;
        return matchesCatSeries(e.selectedTagId, scope);
      })
      .filter(e => filterByDate(e.createdAt))
      .map(l => ({ ...l, _type: 'elimination' as const }));

    // 用藥紀錄僅有貓咪個體，家庭範圍不顯示
    let medications = medicationHistory
      .filter(m => {
        if (scope === 'household') return false;
        return matchesCatSeries(m.catId, scope);
      })
      .filter(m => filterByDate(m.createdAt))
      .map(l => ({ ...l, _type: 'medication' as const }));

    let symptoms = symptomHistory
      .filter(s => {
        if (scope === 'household') return false;
        return matchesCatSeries(s.catId, scope);
      })
      .filter(s => filterByDate(s.createdAt))
      .map(l => ({ ...l, _type: 'symptom' as const }));

    let unified: DetailRecord[] = [];
    if (typeFilter === 'all') {
      unified = [...feedings, ...hydrations, ...eliminations, ...medications, ...symptoms];
    } else if (typeFilter === 'feeding') {
      unified = feedings;
    } else if (typeFilter === 'hydration') {
      unified = hydrations;
    } else if (typeFilter === 'elimination') {
      unified = eliminations;
    } else if (typeFilter === 'medication') {
      unified = medications;
    } else {
      unified = symptoms;
    }

    return unified.sort((a, b) => b.createdAt - a.createdAt);
  }, [feedingHistory, hydrationHistory, eliminationHistory, medicationHistory, symptomHistory, scope, typeFilter, dateFilter]);

  const scopeLabel = scope === 'household' ? '家庭' : getCatNameBySeries(cats, scope);
  const typeLabels: Record<RecordTypeFilter, string> = { all: '全部', feeding: '食物記錄', hydration: '飲水紀錄', elimination: '排泄紀錄', medication: '用藥紀錄', symptom: '異常症狀' };
  const dateLabels: Record<DateFilter, string> = { all: '全部', '7d': '最近 7 天', '30d': '最近 30 天' };

  const renderFilterSheetContent = () => {
    if (filterSheet === 'scope') {
      return (
        <>
          <Text style={styles.recordsSheetTitle}>篩選範圍</Text>
          <Pressable style={styles.recordsSheetOption} onPress={() => { setScope('household'); setFilterSheet(null); }}>
            <Text style={styles.recordsSheetOptionText}>家庭</Text>
            {scope === 'household' && <AppIcon name="check-circle" size={20} color="#000" />}
          </Pressable>
          {getScopedCats(cats).map(c => {
            const series = extractCatSeries(c.id) || c.id;
            return (
              <Pressable key={c.id} style={styles.recordsSheetOption} onPress={() => { setScope(series); setFilterSheet(null); }}>
                <Text style={styles.recordsSheetOptionText}>{c.name}</Text>
                {extractCatSeries(scope) === extractCatSeries(series) && <AppIcon name="check-circle" size={20} color="#000" />}
              </Pressable>
            );
          })}
        </>
      );
    }
    if (filterSheet === 'type') {
      const opts: { value: RecordTypeFilter; label: string }[] = [
        { value: 'all', label: '全部' },
        { value: 'feeding', label: '食物記錄' },
        { value: 'hydration', label: '飲水紀錄' },
        { value: 'elimination', label: '排泄紀錄' },
        { value: 'medication', label: '用藥紀錄' },
        { value: 'symptom', label: '異常症狀' },
      ];
      return (
        <>
          <Text style={styles.recordsSheetTitle}>篩選類型</Text>
          {opts.map(({ value, label }) => (
            <Pressable key={value} style={styles.recordsSheetOption} onPress={() => { setTypeFilter(value); setFilterSheet(null); }}>
              <Text style={styles.recordsSheetOptionText}>{label}</Text>
              {typeFilter === value && <AppIcon name="check-circle" size={20} color="#000" />}
            </Pressable>
          ))}
        </>
      );
    }
    if (filterSheet === 'date') {
      const opts: { value: DateFilter; label: string }[] = [
        { value: 'all', label: '全部' },
        { value: '7d', label: '最近 7 天' },
        { value: '30d', label: '最近 30 天' },
      ];
      return (
        <>
          <Text style={styles.recordsSheetTitle}>篩選日期</Text>
          {opts.map(({ value, label }) => (
            <Pressable key={value} style={styles.recordsSheetOption} onPress={() => { setDateFilter(value); setFilterSheet(null); }}>
              <Text style={styles.recordsSheetOptionText}>{label}</Text>
              {dateFilter === value && <AppIcon name="check-circle" size={20} color="#000" />}
            </Pressable>
          ))}
        </>
      );
    }
    return null;
  };

  const filterCell = (label: string, value: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={styles.recordsFilterCell}
    >
      <Text style={styles.recordsFilterCellLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.recordsFilterCellValueRow}>
        <Text style={styles.recordsFilterCellValue} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
        <AppIcon name="expand-more" size={12} color="#000" />
      </View>
    </Pressable>
  );

  const listHeaderComponent = (
    <View style={styles.recordsListHeader}>
      {pendingT1Count > 0 && onOpenPendingT1 && (
        <View style={styles.recordsPendingT1Box}>
          <Text style={styles.recordsPendingT1Title}>您有 {pendingT1Count} 筆放飯記錄尚未填寫收碗（待補填）</Text>
          <Text style={styles.recordsPendingT1Desc}>填寫收碗狀態與攝取程度後，該筆記錄才會納入胃口趨勢</Text>
          <Pressable onPress={onOpenPendingT1} style={styles.recordsPendingT1Button}>
            <Text style={styles.recordsPendingT1ButtonText}>去填寫</Text>
          </Pressable>
        </View>
      )}
      <Pressable style={styles.section} onPress={() => onOpenModal('recordMode')}>
        <Text style={[styles.sectionTitle, styles.recordsAddRecordTitle]}>新增記錄</Text>
        <View style={styles.recordsAddRecordRow}>
          <Text style={styles.recordsAddRecordLabel}>以紀錄模式開啟（可切換類型）</Text>
          <AppIcon name="expand-more" size={22} color="#000" />
        </View>
      </Pressable>

      <View style={styles.recordsSection}>
        <View style={styles.recordsSectionTop}>
          <View style={styles.recordsSectionTitleRow}>
            <AppIcon name="history" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, styles.recordsSectionTitle]}>完整紀錄</Text>
          </View>
          <Pressable style={styles.recordsLateEntryButton} onPress={() => onOpenModal('feedingLateEntry')}>
            <Text style={styles.recordsLateEntryButtonText}>＋ 補填記錄</Text>
          </Pressable>
        </View>

        <View style={styles.recordsFilterRow}>
          {filterCell('範圍', scopeLabel, () => setFilterSheet('scope'))}
          {filterCell('類型', typeLabels[typeFilter], () => setFilterSheet('type'))}
          {filterCell('日期', dateLabels[dateFilter], () => setFilterSheet('date'))}
        </View>

        <View style={styles.recordsCountRow}>
          <Text style={styles.recordsCountText}>共 {filteredRecords.length} 筆</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.recordsContainer}>
      <FlatList
        style={styles.recordsFlatList}
        data={filteredRecords}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RecordLogItem record={item} cats={cats} onRecordPress={onRecordPress} />}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={<Text style={styles.recordsEmptyText}>尚無符合條件的紀錄</Text>}
        contentContainerStyle={styles.recordsListContent}
        showsVerticalScrollIndicator
      />
      <Modal
        visible={filterSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheet(null)}
      >
        <Pressable style={styles.recordsFilterModalBackdrop} onPress={() => setFilterSheet(null)}>
          <Pressable style={styles.recordsFilterModalSheet} onPress={e => e.stopPropagation()}>
            {renderFilterSheetContent()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
