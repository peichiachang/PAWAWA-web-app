import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ActiveModal, FeedingOwnershipLog, HydrationOwnershipLog, INTAKE_LEVEL_LABEL } from '../types/app';
import { EliminationOwnershipLog } from '../hooks/useElimination';
import { CatIdentity, MedicationLog, SymptomLog } from '../types/domain';
import { styles } from '../styles/common';
import { DetailRecord } from './modals/RecordDetailModal';
import { AppIcon } from './AppIcon';
import { extractCatSeries, getCatNameBySeries, getScopedCats, matchesCatSeries } from '../utils/catScope';
import { checkLowAppetiteAlert } from '../utils/health';

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

function getCatName(cats: CatIdentity[], id: string | null): string {
  return getCatNameBySeries(cats, id);
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
  const [addRecordDropdownOpen, setAddRecordDropdownOpen] = useState(false);

  const showLowAppetiteBanner = useMemo(() => {
    const filtered = scope === 'household'
      ? feedingHistory.filter(f => f.ownershipType === 'household_only')
      : feedingHistory.filter(f => matchesCatSeries(f.selectedTagId, scope));
    return checkLowAppetiteAlert(filtered);
  }, [feedingHistory, scope]);

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
      title = `食物記錄${l.selectedTagId ? ` · ${getCatName(cats, l.selectedTagId)}` : ''}${l.isLateEntry ? ' · 補填' : ''}`;
      dataStr = l.intakeLevel != null ? `${INTAKE_LEVEL_LABEL[l.intakeLevel]} · ${l.totalGram}g` : `${l.note || '飼料'} · ${l.totalGram}g`;
      descStr = `${Math.round(l.kcal ?? l.totalGram * 3.5)} kcal` + (l.intakeLevel != null ? ` · ${INTAKE_LEVEL_LABEL[l.intakeLevel]}` : '') + (l.isLateEntry ? ' · 補填' : '') + (l.note ? ` • ${l.note}` : '');
    } else if (record._type === 'hydration') {
      const l = record as HydrationOwnershipLog & { _type: 'hydration' };
      const ml = Math.round(l.actualWaterMl ?? l.totalMl);
      title = `飲水記錄${l.selectedTagId ? ` · ${getCatName(cats, l.selectedTagId)}` : ' · 家庭'}`;
      dataStr = `${ml} ml`;
      descStr = '飲水攝取';
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
      <View key={record.id} style={[styles.recordItem, { padding: 12, flexDirection: 'row', alignItems: 'center' }]}>
        <Pressable
          style={{ flex: 1 }}
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
        <Pressable
          onPress={() => onRecordPress?.(record as DetailRecord)}
          style={{ padding: 8, marginLeft: 8 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppIcon name="edit" size={20} color="#666" />
        </Pressable>
      </View>
    );
  };

  const scopeLabel = scope === 'household' ? '家庭' : getCatName(cats, scope);
  const typeLabels: Record<RecordTypeFilter, string> = { all: '全部', feeding: '食物記錄', hydration: '飲水紀錄', elimination: '排泄紀錄', medication: '用藥紀錄', symptom: '異常症狀' };
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
          {getScopedCats(cats).map(c => {
            const series = extractCatSeries(c.id) || c.id;
            return (
            <Pressable key={c.id} style={sheetOptionStyle} onPress={() => { setScope(series); setFilterSheet(null); }}>
              <Text style={{ fontSize: 15 }}>{c.name}</Text>
              {extractCatSeries(scope) === extractCatSeries(series) && <AppIcon name="check-circle" size={20} color="#000" />}
            </Pressable>
          )})}
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

  const filterCell = (label: string, value: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 6, borderWidth: 1, borderColor: '#000', marginRight: 6, marginBottom: 8 }}
    >
      <Text style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '600', marginRight: 2 }} numberOfLines={1}>{value}</Text>
        <AppIcon name="expand-more" size={14} color="#000" />
      </View>
    </Pressable>
  );

  return (
    <View>
      {showLowAppetiteBanner && (
        <View style={{ marginBottom: 16, padding: 14, backgroundColor: '#fef3c7', borderWidth: 2, borderColor: '#f59e0b', borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
          <AppIcon name="warning" size={22} color="#92400e" style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#92400e' }}>貓咪最近胃口偏低，建議觀察或就醫</Text>
        </View>
      )}
      {pendingT1Count > 0 && onOpenPendingT1 && (
        <View style={{ marginBottom: 16, padding: 14, backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#3b82f6', borderRadius: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e40af', marginBottom: 6 }}>您有 {pendingT1Count} 筆放飯記錄尚未填寫收碗（待補填）</Text>
          <Text style={{ fontSize: 12, color: '#1e3a8a', marginBottom: 10 }}>填寫收碗狀態與攝取程度後，該筆記錄才會納入胃口趨勢</Text>
          <Pressable onPress={onOpenPendingT1} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#3b82f6', borderRadius: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>去填寫</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: 12 }]}>新增記錄</Text>
        <View style={{ position: 'relative', zIndex: 20 }}>
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#000', borderRadius: 8, backgroundColor: '#fff' }}
            onPress={() => setAddRecordDropdownOpen((v) => !v)}
          >
            <Text style={{ fontSize: 14, color: '#333' }}>請選擇要新增的記錄類型</Text>
            <AppIcon name={addRecordDropdownOpen ? 'expand-less' : 'expand-more'} size={22} color="#000" />
          </Pressable>
          {addRecordDropdownOpen && (
            <>
              <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -260, zIndex: 1 }} onPress={() => setAddRecordDropdownOpen(false)} />
              <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 260, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', borderRadius: 8, zIndex: 2, overflow: 'hidden' }}>
                <ScrollView style={{ maxHeight: 256 }} keyboardShouldPersistTaps="handled">
                  {[
                    { modal: 'feeding' as ActiveModal, label: '食物記錄', icon: 'restaurant' },
                    { modal: 'water' as ActiveModal, label: '飲水記錄', icon: 'opacity' },
                    { modal: 'elimination' as ActiveModal, label: '排泄記錄', icon: 'sanitizer' },
                    { modal: 'weightRecord' as ActiveModal, label: '體重記錄', icon: 'monitor-weight' },
                    { modal: 'medication' as ActiveModal, label: '用藥記錄', icon: 'medication' },
                    { modal: 'symptom' as ActiveModal, label: '異常症狀', icon: 'healing' },
                    { modal: 'blood' as ActiveModal, label: '報告掃描', icon: 'biotech' },
                  ].map(({ modal, label, icon }) => (
                    <Pressable
                      key={modal}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                      onPress={() => { onOpenModal(modal); setAddRecordDropdownOpen(false); }}
                    >
                      <AppIcon name={icon as any} size={20} color="#000" style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 14, fontWeight: '500' }}>{label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </View>

      <View style={{ marginTop: 32, borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppIcon name="history" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>完整紀錄</Text>
          </View>
          <Pressable style={{ paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8 }} onPress={() => onOpenModal('feedingLateEntry')}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e40af' }}>＋ 補填記錄</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row' }}>
          {filterCell('範圍', scopeLabel, () => setFilterSheet('scope'))}
          {filterCell('類型', typeLabels[typeFilter], () => setFilterSheet('type'))}
          {filterCell('日期', dateLabels[dateFilter], () => setFilterSheet('date'))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#ddd' }}>
          <Text style={{ fontSize: 12, color: '#666' }}>共 {filteredRecords.length} 筆</Text>
        </View>

        {filteredRecords.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#666' }}>尚無符合條件的紀錄</Text>
        ) : (
          <View style={{ paddingBottom: 40, width: '100%' }}>
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
