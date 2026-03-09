import React, { memo } from 'react';
import { Text, View } from 'react-native';
import { FeedingOwnershipLog, HydrationOwnershipLog, INTAKE_LEVEL_LABEL } from '../types/app';
import { EliminationOwnershipLog } from '../hooks/useElimination';
import { CatIdentity, MedicationLog, SymptomLog } from '../types/domain';
import { styles } from '../styles/common';
import { DetailRecord } from './modals/RecordDetailModal';
import { AppIcon } from './AppIcon';
import { getCatNameBySeries } from '../utils/catScope';
import { AnimatedPressable } from './AnimatedPressable';
import { getBristolLabel } from '../constants/bristol';
import type { AppIconName } from './AppIcon';

export interface RecordLogItemProps {
  record: DetailRecord;
  cats: CatIdentity[];
  onRecordPress?: (record: DetailRecord) => void;
}

function RecordLogItemInner({ record, cats, onRecordPress }: RecordLogItemProps) {
  let title = '';
  let dataStr = '';
  let descStr = '';

  const date = new Date(record.createdAt);
  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const dateStr = date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });

  const recordIcon: AppIconName = record._type === 'feeding'
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
    title = `食物記錄${l.selectedTagId ? ` · ${getCatNameBySeries(cats, l.selectedTagId)}` : ''}${l.isLateEntry ? ' · 補填' : ''}`;
    dataStr = l.intakeLevel != null ? `${INTAKE_LEVEL_LABEL[l.intakeLevel]} · ${l.totalGram}g` : `${l.note || '飼料'} · ${l.totalGram}g`;
    descStr = `${Math.round(l.kcal ?? l.totalGram * 3.5)} kcal` + (l.intakeLevel != null ? ` · ${INTAKE_LEVEL_LABEL[l.intakeLevel]}` : '') + (l.isLateEntry ? ' · 補填' : '') + (l.note ? ` • ${l.note}` : '');
  } else if (record._type === 'hydration') {
    const l = record as HydrationOwnershipLog & { _type: 'hydration' };
    const ml = Math.round(l.actualWaterMl ?? l.totalMl);
    title = `飲水記錄${l.selectedTagId ? ` · ${getCatNameBySeries(cats, l.selectedTagId)}` : ' · 家庭'}`;
    dataStr = `${ml} ml`;
    descStr = '飲水攝取';
  } else if (record._type === 'elimination') {
    const l = record as EliminationOwnershipLog & { _type: 'elimination' };
    title = `排泄記錄${l.selectedTagId ? ` - ${getCatNameBySeries(cats, l.selectedTagId)}` : ''}`;
    dataStr = l.shapeType || getBristolLabel(l.bristolType);
    descStr = `${l.color} • ${l.abnormal ? '異常' : '正常'}`;
  } else if (record._type === 'medication') {
    const l = record as MedicationLog & { _type: 'medication' };
    title = `投藥記錄 - ${getCatNameBySeries(cats, l.catId)}`;
    dataStr = `${l.medicationName} ${l.dosage}`;
    descStr = l.notes || '';
  } else {
    const l = record as SymptomLog & { _type: 'symptom' };
    const severity = l.severity === 'severe' ? '嚴重' : l.severity === 'moderate' ? '中等' : '輕微';
    title = `異常症狀記錄 - ${getCatNameBySeries(cats, l.catId)}`;
    dataStr = l.symptom;
    descStr = `${severity}${l.notes ? ` • ${l.notes}` : ''}`;
  }

  return (
    <View style={[styles.recordItem, styles.recordItemCard]}>
      <AnimatedPressable
        style={{ flex: 1 }}
        onPress={() => onRecordPress?.(record)}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderIcon}>
            <AppIcon name={recordIcon} size={16} color="#000" />
          </View>
          <Text style={styles.recordTitle} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
        </View>
        <View style={styles.recordDataRow}>
          <Text style={styles.recordData}>{dataStr}</Text>
          <Text style={[styles.recordTime, styles.recordTimeRight]}>{dateStr} {timeStr}</Text>
        </View>
        {descStr ? <Text style={styles.recordDesc}>{descStr}</Text> : null}
      </AnimatedPressable>
      <AnimatedPressable
        onPress={() => onRecordPress?.(record)}
        style={styles.recordEditButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <AppIcon name="edit" size={20} color="#666" />
      </AnimatedPressable>
    </View>
  );
}

export const RecordLogItem = memo(RecordLogItemInner);
