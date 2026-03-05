import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { FeedingOwnershipLog, HydrationOwnershipLog } from '../../types/app';
import { EliminationOwnershipLog } from '../../hooks/useElimination';
import { CatIdentity, MedicationLog, SymptomLog } from '../../types/domain';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';

export type DetailRecord =
  | (FeedingOwnershipLog & { _type: 'feeding' })
  | (HydrationOwnershipLog & { _type: 'hydration' })
  | (EliminationOwnershipLog & { _type: 'elimination' })
  | (MedicationLog & { _type: 'medication' })
  | (SymptomLog & { _type: 'symptom' });

interface Props {
  visible: boolean;
  record: DetailRecord | null;
  cats: CatIdentity[];
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
      <Text style={{ fontSize: 12, color: '#666', flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export function RecordDetailModal({ visible, record, cats, onClose }: Props) {
  if (!record) return null;

  const getCatName = (id: string | null | undefined) => {
    if (!id) return '所有貓';
    if (id === 'household') return '家庭';
    if (id === 'A' || id === 'B' || id === 'C') return `Tag ${id}`;
    const cat = cats.find(c => c.id === id);
    return cat ? cat.name : id;
  };

  const date = new Date(record.createdAt);
  const dateStr = date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

  const renderContent = () => {
    if (record._type === 'feeding') {
      const l = record as FeedingOwnershipLog & { _type: 'feeding' };
      return (
        <>
          <Row label="日期" value={dateStr} />
          <Row label="時間" value={timeStr} />
          <Row label="貓咪" value={getCatName(l.selectedTagId)} />
          <Row label="提供克數" value={`${l.totalGram} g`} />
          <Row label="熱量" value={`${Math.round(l.kcal ?? l.totalGram * 3.5)} kcal`} />
          <Row label="記錄模式" value={l.mode === 'precise' ? '精確模式' : '標準模式'} />
          {l.note && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <Text style={{ fontSize: 12, color: '#666', flex: 1 }}>備註</Text>
              <Text style={{ fontSize: 13, flex: 2, textAlign: 'right' }}>{l.note}</Text>
            </View>
          )}
        </>
      );
    }
    if (record._type === 'hydration') {
      const l = record as HydrationOwnershipLog & { _type: 'hydration' };
      const displayMl = Math.round(l.actualWaterMl ?? l.totalMl);
      return (
        <>
          <Row label="日期" value={dateStr} />
          <Row label="時間" value={timeStr} />
          <Row label="歸屬" value={getCatName(l.selectedTagId)} />
          <Row label="飲水量" value={`${displayMl} ml`} />
        </>
      );
    }
    if (record._type === 'elimination') {
      const l = record as EliminationOwnershipLog & { _type: 'elimination' };
      const bristolDesc = ['', '硬塊狀', '香腸狀有裂縫', '香腸狀有裂縫', '香腸狀或蛇形', '軟塊有清晰邊緣', '糊狀', '水狀'];
      return (
        <>
          <Row label="日期" value={dateStr} />
          <Row label="時間" value={timeStr} />
          <Row label="貓咪" value={getCatName(l.selectedTagId)} />
          <Row label="Bristol 類型" value={`Type ${l.bristolType}${bristolDesc[l.bristolType] ? ` — ${bristolDesc[l.bristolType]}` : ''}`} />
          <Row label="形狀" value={l.shapeType || '—'} />
          <Row label="顏色" value={l.color || '—'} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
              <Text style={{ fontSize: 12, color: '#666', flex: 1 }}>狀態</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 2, justifyContent: 'flex-end' }}>
                <AppIcon name={l.abnormal ? 'warning' : 'check-circle'} size={14} color={l.abnormal ? '#d32f2f' : '#166534'} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', textAlign: 'right' }}>{l.abnormal ? '疑似異常' : '正常'}</Text>
              </View>
            </View>
        </>
      );
    }
    if (record._type === 'medication') {
      const l = record as MedicationLog & { _type: 'medication' };
      return (
        <>
          <Row label="日期" value={dateStr} />
          <Row label="時間" value={timeStr} />
          <Row label="貓咪" value={getCatName(l.catId)} />
          <Row label="藥品名稱" value={l.medicationName} />
          <Row label="劑量 / 用法" value={l.dosage} />
          {l.reminderTime ? <Row label="預定時間" value={l.reminderTime} /> : null}
          {l.notes ? <Row label="備註" value={l.notes} /> : null}
        </>
      );
    }
    if (record._type === 'symptom') {
      const l = record as SymptomLog & { _type: 'symptom' };
      const severity = l.severity === 'severe' ? '嚴重' : l.severity === 'moderate' ? '中等' : '輕微';
      return (
        <>
          <Row label="日期" value={dateStr} />
          <Row label="時間" value={timeStr} />
          <Row label="貓咪" value={getCatName(l.catId)} />
          <Row label="症狀" value={l.symptom} />
          <Row label="嚴重程度" value={severity} />
          {l.observedAt ? <Row label="觀察時間" value={l.observedAt} /> : null}
          {l.notes ? <Row label="備註" value={l.notes} /> : null}
        </>
      );
    }
    return null;
  };

  const iconNames: Record<string, string> = { feeding: 'restaurant', hydration: 'opacity', elimination: 'sanitizer', medication: 'medication', symptom: 'healing' };
  const titles: Record<string, string> = { feeding: '飲食記錄', hydration: '飲水記錄', elimination: '排泄記錄', medication: '投藥記錄', symptom: '異常症狀記錄' };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={[styles.modalHeader, { flexDirection: 'row', alignItems: 'center' }]}>
            <AppIcon name={iconNames[record._type] as any} size={22} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.modalTitle}>{titles[record._type]}</Text>
            <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <ScrollView style={styles.modalBody}>
            {renderContent()}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
