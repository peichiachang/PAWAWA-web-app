import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { ActiveModal, FeedingOwnershipLog, HydrationOwnershipLog } from '../types/app';
import { EliminationOwnershipLog } from '../hooks/useElimination';
import { CatIdentity, MedicationLog, SymptomLog } from '../types/domain';
import { styles } from '../styles/common';
import { DetailRecord } from './modals/RecordDetailModal';
import { AppIcon } from './AppIcon';

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
}

function getCatName(cats: CatIdentity[], id: string | null): string {
  if (!id || id === 'household') return '家庭';
  const cat = cats.find(c => c.id === id);
  return cat ? cat.name : id;
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
        return f.selectedTagId === scope;
      })
      .filter(f => filterByDate(f.createdAt))
      .map(l => ({ ...l, _type: 'feeding' as const }));

    let hydrations = hydrationHistory
      .filter(h => {
        if (scope === 'household') return h.ownershipType === 'household_only';
        return h.selectedTagId === scope;
      })
      .filter(h => filterByDate(h.createdAt))
      .map(l => ({ ...l, _type: 'hydration' as const }));

    let eliminations = eliminationHistory
      .filter(e => {
        if (scope === 'household') return e.selectedTagId === null;
        return e.selectedTagId === scope;
      })
      .filter(e => filterByDate(e.createdAt))
      .map(l => ({ ...l, _type: 'elimination' as const }));

    // 用藥紀錄僅有貓咪個體，家庭範圍不顯示
    let medications = medicationHistory
      .filter(m => {
        if (scope === 'household') return false;
        return m.catId === scope;
      })
      .filter(m => filterByDate(m.createdAt))
      .map(l => ({ ...l, _type: 'medication' as const }));

    let symptoms = symptomHistory
      .filter(s => {
        if (scope === 'household') return false;
        return s.catId === scope;
      })
      .filter(s => filterByDate(s.createdAt))
      .map(l => ({ ...l, _type: 'symptom' as const }));

    let unified: Array<{ id: string; createdAt: number; _type: 'feeding' | 'hydration' | 'elimination' | 'medication' | 'symptom' }> = [];
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

  const renderRecordItem = (record: typeof filteredRecords[0]) => {
    let title = '';
    let dataStr = '';
    let descStr = '';

    const date = new Date(record.createdAt);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });

    const recordIcon = record._type === 'feeding'
      ? 'restaurant'
      : record._type === 'hydration'
        ? 'opacity'
        : record._type === 'elimination'
          ? 'sanitizer'
          : record._type === 'medication'
            ? 'medication'
            : 'healing';

    if (record._type === 'feeding') {
      const l = record as FeedingOwnershipLog & { _type: 'feeding' };
      title = `飲食記錄${l.selectedTagId ? ` - ${getCatName(cats, l.selectedTagId)}` : ''}`;
      dataStr = `${l.note || '飼料'} - ${l.totalGram}g`;
      descStr = `${Math.round(l.kcal ?? l.totalGram * 3)} kcal` + (l.note ? ` • ${l.note}` : '');
    } else if (record._type === 'hydration') {
      const l = record as HydrationOwnershipLog & { _type: 'hydration' };
      title = `飲水記錄${l.selectedTagId ? ` - ${getCatName(cats, l.selectedTagId)}` : ''}`;
      dataStr = `總計：${Math.round(l.totalMl)} ml`;
      descStr = '估算攝取';
    } else if (record._type === 'elimination') {
      const l = record as EliminationOwnershipLog & { _type: 'elimination' };
      const bristolDesc: Record<number, string> = { 1: '硬塊狀', 2: '香腸狀有裂縫', 3: '香腸狀有裂縫', 4: '香腸狀或蛇形', 5: '軟塊有清晰邊緣', 6: '糊狀', 7: '水狀' };
      title = `排泄記錄${l.selectedTagId ? ` - ${getCatName(cats, l.selectedTagId)}` : ''}`;
      dataStr = l.shapeType || bristolDesc[l.bristolType] || `Type ${l.bristolType}`;
      descStr = `${l.color} • ${l.abnormal ? '異常' : '正常'}`;
    } else if (record._type === 'medication') {
      const l = record as MedicationLog & { _type: 'medication' };
      title = `投藥記錄 - ${getCatName(cats, l.catId)}`;
      dataStr = `${l.medicationName} ${l.dosage}`;
      descStr = l.notes || '';
    } else {
      const l = record as SymptomLog & { _type: 'symptom' };
      const severity = l.severity === 'severe' ? '嚴重' : l.severity === 'moderate' ? '中等' : '輕微';
      title = `異常症狀記錄 - ${getCatName(cats, l.catId)}`;
      dataStr = l.symptom;
      descStr = `${severity}${l.notes ? ` • ${l.notes}` : ''}`;
    }

    return (
      <Pressable
        key={record.id}
        style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]}
        onPress={() => onRecordPress?.(record as DetailRecord)}
      >
        <View style={styles.recordHeader}>
          <AppIcon name={recordIcon as any} size={16} color="#000" style={{ marginRight: 6 }} />
          <Text style={[styles.recordTitle, { flex: 1 }]}>{title}</Text>
          <Text style={styles.recordTime}>{dateStr} {timeStr}</Text>
        </View>
        <Text style={styles.recordData}>{dataStr}</Text>
        {descStr ? <Text style={styles.recordDesc}>{descStr}</Text> : null}
      </Pressable>
    );
  };

  const scopeLabel = scope === 'household' ? '家庭' : cats.find(c => c.id === scope)?.name ?? scope;
  const typeLabels: Record<RecordTypeFilter, string> = { all: '全部', feeding: '飲食記錄', hydration: '飲水紀錄', elimination: '排泄紀錄', medication: '用藥紀錄', symptom: '異常症狀' };
  const dateLabels: Record<DateFilter, string> = { all: '全部', '7d': '最近 7 天', '30d': '最近 30 天' };

  const sheetOptionStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#eee' };

  const renderFilterSheetContent = () => {
    if (filterSheet === 'scope') {
      return (
        <>
          <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 16 }}>篩選範圍</Text>
          <Pressable style={sheetOptionStyle} onPress={() => { setScope('household'); setFilterSheet(null); }}>
            <Text style={{ fontSize: 15 }}>家庭</Text>
            {scope === 'household' && <AppIcon name="check-circle" size={20} color="#000" />}
          </Pressable>
          {cats.map(c => (
            <Pressable key={c.id} style={sheetOptionStyle} onPress={() => { setScope(c.id); setFilterSheet(null); }}>
              <Text style={{ fontSize: 15 }}>{c.name}</Text>
              {scope === c.id && <AppIcon name="check-circle" size={20} color="#000" />}
            </Pressable>
          ))}
        </>
      );
    }
    if (filterSheet === 'type') {
      const opts: { value: RecordTypeFilter; label: string }[] = [
        { value: 'all', label: '全部' },
        { value: 'feeding', label: '飲食記錄' },
        { value: 'hydration', label: '飲水紀錄' },
        { value: 'elimination', label: '排泄紀錄' },
        { value: 'medication', label: '用藥紀錄' },
        { value: 'symptom', label: '異常症狀' },
      ];
      return (
        <>
          <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 16 }}>篩選類型</Text>
          {opts.map(({ value, label }) => (
            <Pressable key={value} style={sheetOptionStyle} onPress={() => { setTypeFilter(value); setFilterSheet(null); }}>
              <Text style={{ fontSize: 15 }}>{label}</Text>
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
          <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 16 }}>篩選日期</Text>
          {opts.map(({ value, label }) => (
            <Pressable key={value} style={sheetOptionStyle} onPress={() => { setDateFilter(value); setFilterSheet(null); }}>
              <Text style={{ fontSize: 15 }}>{label}</Text>
              {dateFilter === value && <AppIcon name="check-circle" size={20} color="#000" />}
            </Pressable>
          ))}
        </>
      );
    }
    return null;
  };

  const filterRow = (label: string, value: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#000', marginBottom: 8 }}
    >
      <Text style={{ fontSize: 12, color: '#666' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginRight: 4 }}>{value}</Text>
        <AppIcon name="expand-more" size={18} color="#000" />
      </View>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 20 }]}>新增記錄</Text>
        <View style={styles.actionGrid}>
          <Pressable style={styles.actionBtn} onPress={() => onOpenModal('feeding')}>
            <AppIcon name="restaurant" size={24} color="#000" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>飲食記錄</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onOpenModal('water')}>
            <AppIcon name="opacity" size={24} color="#000" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>飲水記錄</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onOpenModal('elimination')}>
            <AppIcon name="sanitizer" size={24} color="#000" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>排泄記錄</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onOpenModal('weightRecord')}>
            <AppIcon name="monitor-weight" size={24} color="#000" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>體重記錄</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onOpenModal('medication')}>
            <AppIcon name="medication" size={24} color="#000" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>用藥記錄</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onOpenModal('symptom')}>
            <AppIcon name="healing" size={24} color="#000" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>異常症狀</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => onOpenModal('blood')}>
            <AppIcon name="biotech" size={24} color="#000" style={styles.actionIcon} />
            <Text style={styles.actionLabel}>報告掃描</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: 32, borderWidth: 2, borderColor: '#000', padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <AppIcon name="history" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>完整紀錄</Text>
        </View>

        {filterRow('範圍', scopeLabel, () => setFilterSheet('scope'))}
        {filterRow('類型', typeLabels[typeFilter], () => setFilterSheet('type'))}
        {filterRow('日期', dateLabels[dateFilter], () => setFilterSheet('date'))}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ddd' }}>
          <Text style={{ fontSize: 12, color: '#666' }}>共 {filteredRecords.length} 筆</Text>
        </View>

        {filteredRecords.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#666' }}>尚無符合條件的紀錄</Text>
        ) : (
          <View style={{ paddingBottom: 40, maxWidth: 320, alignSelf: 'center', width: '100%' }}>
            {filteredRecords.map(record => renderRecordItem(record))}
          </View>
        )}
      </View>

      <Modal
        visible={filterSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheet(null)}
      >
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setFilterSheet(null)}>
          <Pressable style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 }} onPress={e => e.stopPropagation()}>
            {renderFilterSheetContent()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
