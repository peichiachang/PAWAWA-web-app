import React, { useMemo, useState, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveModal, Level, FeedingOwnershipLog, HydrationOwnershipLog, VesselCalibration } from '../types/app';
import { EliminationOwnershipLog } from '../hooks/useElimination';
import { CatIdentity, ClinicalSummary, MedicationLog, SymptomLog } from '../types/domain';
import { styles } from '../styles/common';
import { calculateAdaptiveDailyWaterGoal, calculateDailyKcalGoal, calculateDailyWaterGoalRange } from '../utils/health';
import { TrendChart } from './TrendChart';
import { DetailRecord } from './modals/RecordDetailModal';
import { AppIcon } from './AppIcon';
import { VESSEL_PROFILES_KEY } from '../constants';
import { recalculateVesselVolume } from '../utils/vesselVolume';

interface Props {
  level: Level;
  onLevelChange: (level: Level) => void;
  onOpenModal: (modal: ActiveModal) => void;
  cats: CatIdentity[];
  summaryByCatId: Record<string, ClinicalSummary>;
  todayKcal: number;
  todayWater: number;
  currentCat: CatIdentity | null;
  currentSummary: ClinicalSummary | null;
  feedingHistory: FeedingOwnershipLog[];
  hydrationHistory: HydrationOwnershipLog[];
  eliminationHistory: EliminationOwnershipLog[];
  medicationHistory: MedicationLog[];
  symptomHistory: SymptomLog[];
  /** 若由父層傳入，以父層為準（與食碗管理編輯即時同步）；未傳則自行從 AsyncStorage 載入 */
  vesselProfiles?: VesselCalibration[];
  onEditCat?: () => void;
  onRecordPress?: (record: DetailRecord) => void;
}

export function HomeContent({
  level,
  onLevelChange,
  onOpenModal,
  cats,
  summaryByCatId,
  todayKcal,
  todayWater,
  currentCat,
  currentSummary,
  feedingHistory,
  hydrationHistory,
  eliminationHistory,
  medicationHistory,
  symptomHistory,
  vesselProfiles: vesselProfilesFromParent,
  onEditCat,
  onRecordPress,
}: Props) {
  // 若父層未傳入 vesselProfiles，則自行從 AsyncStorage 載入（向後相容）
  const [localVesselProfiles, setLocalVesselProfiles] = useState<VesselCalibration[]>([]);
  useEffect(() => {
    if (vesselProfilesFromParent != null) return;
    async function loadVessels() {
      try {
        const raw = await AsyncStorage.getItem(VESSEL_PROFILES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as VesselCalibration[];
          const corrected = parsed.map(v => recalculateVesselVolume(v));
          setLocalVesselProfiles(corrected);
          const needsSave = corrected.some((v, i) => v.volumeMl !== parsed[i]?.volumeMl);
          if (needsSave) {
            await AsyncStorage.setItem(VESSEL_PROFILES_KEY, JSON.stringify(corrected));
          }
        }
      } catch (_e) {}
    }
    void loadVessels();
  }, [vesselProfilesFromParent]);

  const vesselProfiles = vesselProfilesFromParent ?? localVesselProfiles;

  const getRecentDailyWaterIntakesForCat = (catId: string): number[] => {
    const byDay = new Map<string, number>();
    hydrationHistory
      .filter((log) => log.selectedTagId === catId)
      .forEach((log) => {
        const d = new Date(log.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        byDay.set(key, (byDay.get(key) || 0) + (log.actualWaterMl || log.totalMl || 0));
      });
    return Array.from(byDay.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([, total]) => total)
      .slice(-7);
  };

  // 計算動態誤差範圍的 helper function
  const calculateErrorMargin = (
    mode: 'standard' | 'precise',
    vesselId?: string,
    confidence?: number
  ): number => {
    // 精確模式固定 ±8%
    if (mode === 'precise') return 0.08;
    
    // 一般模式：基礎誤差 ±20%
    let errorMargin = 0.20;
    
    // 有容器校準：-5% (降至 ±15%)
    if (vesselId) {
      const vessel = vesselProfiles.find(v => v.id === vesselId);
      if (vessel && vessel.volumeMl) {
        errorMargin -= 0.05;
      }
    }
    
    // 根據 confidence 調整：高信心度（>0.8）-3%，低信心度（<0.7）+5%
    if (confidence !== undefined) {
      if (confidence > 0.8) {
        errorMargin -= 0.03;
      } else if (confidence < 0.7) {
        errorMargin += 0.05;
      }
    }
    
    // 限制誤差範圍在 8%-25% 之間
    return Math.max(0.08, Math.min(0.25, errorMargin));
  };

  const chartData = useMemo(() => {
    // Generate last 7 days labels
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }); // "MM/DD" format varies by locale but better than UTC
    });

    // Filter by level
    const filteredFeedings = level === 'household'
      ? feedingHistory
      : feedingHistory.filter(l => l.selectedTagId === level);

    const filteredHydrations = level === 'household'
      ? hydrationHistory
      : hydrationHistory.filter(l => l.selectedTagId === level);

    // Group feeding (kcal) by date with error margin and record tracking
    const kcalData = days.map(day => {
      const dayLogs = filteredFeedings.filter(log =>
        new Date(log.createdAt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) === day
      );
      const totalKcal = dayLogs.reduce((sum, log) => sum + (log.kcal || log.totalGram * 3), 0);
      
      // 計算誤差範圍：根據記錄的模式、容器校準、confidence 動態調整
      // 如果一天有多筆記錄，取加權平均誤差
      let weightedErrorMargin = 0;
      let hasLowConfidence = false;
      if (dayLogs.length > 0) {
        const totalWeight = dayLogs.reduce((sum, log) => {
          const logKcal = log.kcal || log.totalGram * 3;
          return sum + logKcal;
        }, 0);
        weightedErrorMargin = dayLogs.reduce((sum, log) => {
          const logKcal = log.kcal || log.totalGram * 3;
          const errorMargin = calculateErrorMargin(log.mode, log.vesselId, log.confidence);
          return sum + (errorMargin * logKcal / totalWeight);
        }, 0);
        // 檢查是否有低信心度記錄
        hasLowConfidence = dayLogs.some(log => log.confidence !== undefined && log.confidence < 0.7);
      }
      
      return {
        label: day,
        value: Math.round(totalKcal),
        errorMargin: weightedErrorMargin > 0 ? weightedErrorMargin : undefined,
        hasRecord: dayLogs.length > 0,
        lowConfidence: hasLowConfidence,
      };
    });

    // Group hydration by date with error margin and record tracking
    const waterData = days.map(day => {
      const dayLogs = filteredHydrations.filter(log =>
        new Date(log.createdAt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) === day
      );
      const totalMl = dayLogs.reduce((sum, log) => sum + (log.actualWaterMl || log.totalMl), 0);
      
      // 飲水記錄誤差約 ±15%（視覺估算 + 蒸發修正）
      const errorMargin = dayLogs.length > 0 ? 0.15 : undefined;
      
      return {
        label: day,
        value: Math.round(totalMl),
        errorMargin,
        hasRecord: dayLogs.length > 0,
        lowConfidence: false,
      };
    });

    // 計算記錄完整性
    const kcalRecordsComplete = kcalData.filter(d => d.hasRecord).length;
    const waterRecordsComplete = waterData.filter(d => d.hasRecord).length;

    return { kcalData, waterData, kcalRecordsComplete, waterRecordsComplete };
  }, [feedingHistory, hydrationHistory, level, vesselProfiles]);

  const recentRecords = useMemo(() => {
    const allFeedings = feedingHistory.filter(f => level === 'household' ? (f.ownershipType === 'household_only' || f.selectedTagId === 'household') : f.selectedTagId === level);
    const allHydrations = hydrationHistory.filter(h => level === 'household' ? (h.ownershipType === 'household_only' || h.selectedTagId === 'household') : h.selectedTagId === level);
    const allEliminations = eliminationHistory.filter(h => level === 'household' || h.selectedTagId === level);
    const allMedications = medicationHistory.filter(m => level === 'household' || m.catId === level);
    const allSymptoms = symptomHistory.filter(s => level === 'household' || s.catId === level);

    const logs = [
      ...allFeedings.map(f => ({ ...f, _type: 'feeding' as const })),
      ...allHydrations.map(h => ({ ...h, _type: 'hydration' as const })),
      ...allEliminations.map(e => ({ ...e, _type: 'elimination' as const })),
      ...allMedications.map(m => ({ ...m, _type: 'medication' as const })),
      ...allSymptoms.map(s => ({ ...s, _type: 'symptom' as const })),
    ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
    return logs;
  }, [feedingHistory, hydrationHistory, eliminationHistory, medicationHistory, symptomHistory, level]);

  const recordLists = useMemo(() => {
    const feedings = feedingHistory.filter(f => f.selectedTagId === level).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const hydrations = hydrationHistory.filter(h => h.selectedTagId === level).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const eliminations = eliminationHistory.filter(e => e.selectedTagId === level).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const medications = medicationHistory.filter(m => m.catId === level).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const symptoms = symptomHistory.filter(s => s.catId === level).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    return { feedings, hydrations, eliminations, medications, symptoms };
  }, [feedingHistory, hydrationHistory, eliminationHistory, medicationHistory, symptomHistory, level]);

  const renderAlerts = (alerts: any[]) => {
    if (alerts.length === 0) return null;
    const alertIcon = (type: string) => type === 'intake' ? 'restaurant' : type === 'hydration' ? 'opacity' : type === 'weight' ? 'monitor-weight' : 'thermostat';
    const alertLabel = (type: string) => type === 'intake' ? '攝食異常' : type === 'hydration' ? '飲水不足' : type === 'weight' ? '體重變動' : '體溫異常';
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="warning" size={18} color="#ef4444" style={{ marginRight: 6 }} />
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>健康注意項目</Text>
        </View>
        {alerts.map((alert, idx) => (
          <View key={idx} style={{ padding: 12, backgroundColor: '#fef2f2', borderLeftWidth: 4, borderLeftColor: alert.severity === 'high' ? '#ef4444' : '#f59e0b', marginBottom: 8, borderWidth: 1, borderColor: '#fee2e2' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <AppIcon name={alertIcon(alert.type) as any} size={14} color="#991b1b" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#991b1b' }}>{alertLabel(alert.type)}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#991b1b', lineHeight: 18 }}>{alert.message}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderRecentRecords = () => (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AppIcon name="history" size={18} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>最近記錄</Text>
            </View>
      {recentRecords.length === 0 ? (
        <Text style={{ fontSize: 13, color: '#666' }}>尚無最近紀錄</Text>
      ) : (
        recentRecords.map(record => {
          let title = '';
          let dataStr = '';
          let descStr = '';

          const date = new Date(record.createdAt);
          const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

          const getCatName = (id: string | null) => {
            if (id === 'household') return '家庭';
            const cat = cats.find(c => c.id === id);
            return cat ? cat.name : id;
          };

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
            const l = record as FeedingOwnershipLog;
            title = `飲食記錄${l.selectedTagId ? ` - ${getCatName(l.selectedTagId)}` : ''}`;
            dataStr = `提供熱量：${Math.round(l.totalGram * 3)} kcal (${l.totalGram}g)`;
            descStr = l.note ? `${l.mode === 'precise' ? '進階' : '標準'} • ${l.note.length > 20 ? l.note.slice(0, 20) + '…' : l.note}` : `使用模式：${l.mode === 'precise' ? '進階' : '標準'}`;
          } else if (record._type === 'hydration') {
            const l = record as HydrationOwnershipLog;
            title = `飲水記錄${l.selectedTagId ? ` - ${getCatName(l.selectedTagId)}` : ''}`;
            dataStr = `總計：${Math.round(l.totalMl)} ml`;
            descStr = `估算攝取`;
          } else if (record._type === 'elimination') {
            const l = record as EliminationOwnershipLog;
            title = `排泄記錄${l.selectedTagId ? ` - ${getCatName(l.selectedTagId)}` : ''}`;
            dataStr = `Bristol Type ${l.bristolType}`;
            descStr = `${l.color} • ${l.abnormal ? '異常' : '正常'}`;
          } else if (record._type === 'medication') {
            const l = record as MedicationLog;
            title = `投藥記錄${l.catId ? ` - ${getCatName(l.catId)}` : ''}`;
            dataStr = `${l.medicationName} ${l.dosage}`;
            descStr = `${l.reminderTime ? `預定：${l.reminderTime} • ` : ''}${l.notes || '無備註'}`;
          } else if (record._type === 'symptom') {
            const l = record as SymptomLog;
            const severity = l.severity === 'severe' ? '嚴重' : l.severity === 'moderate' ? '中等' : '輕微';
            title = `異常症狀${l.catId ? ` - ${getCatName(l.catId)}` : ''}`;
            dataStr = l.symptom;
            descStr = `${severity}${l.observedAt ? ` • 觀察時間：${l.observedAt}` : ''}`;
          }

          return (
            <Pressable
              key={record.id}
              style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000' }]}
              onPress={() => onRecordPress?.(record as DetailRecord)}
            >
              <View style={styles.recordHeader}>
                <AppIcon name={recordIcon as any} size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={[styles.recordTitle, { flex: 1 }]}>{title}</Text>
                <Text style={styles.recordTime}>{new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{dataStr}</Text>
              <Text style={styles.recordDesc}>{descStr}</Text>
            </Pressable>
          );
        })
      )}
    </View>
  );

  if (level === 'household') {
    const householdKcalGoal = cats.reduce((sum, cat) => sum + calculateDailyKcalGoal(cat), 0) || 625;
    const householdWaterGoal = cats.reduce((sum, cat) => {
      const recent = getRecentDailyWaterIntakesForCat(cat.id);
      return sum + calculateAdaptiveDailyWaterGoal(cat, recent);
    }, 0) || 569;

    return (
      <>
        {cats.length === 0 && (
          <View style={{ padding: 20, backgroundColor: '#fffbeb', borderWidth: 2, borderColor: '#fcd34d', marginBottom: 16, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AppIcon name="celebration" size={18} color="#92400e" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e' }}>歡迎使用 PAWAWA!</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#92400e', lineHeight: 18, marginBottom: 12 }}>
              您目前還沒有建立貓咪檔案。建立檔案後，AI 才能為您的貓咪精準計算熱量與水分攝取目標。
            </Text>
            <Pressable
              style={{ padding: 10, backgroundColor: '#000', borderRadius: 4 }}
              onPress={() => onOpenModal('addCat')}
            >
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 12 }}>立即建立第一隻貓咪</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.cardBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <AppIcon name="dashboard" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>今日家庭數據</Text>
          </View>

          <View style={{ borderWidth: 2, borderColor: '#000000', padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 11, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', opacity: 0.6 }}>總攝取熱量</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>每日目標</Text>
                <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 48 }}>{Math.round(householdKcalGoal)}</Text>
                <Text style={{ fontSize: 14, marginTop: 4 }}>kcal</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>目前攝取</Text>
                <Text style={{ fontSize: 32, fontWeight: '700', lineHeight: 32 }}>{Math.round(todayKcal)}</Text>
                <Text style={{ fontSize: 12, marginTop: 2 }}>kcal</Text>
              </View>
            </View>
            <View style={{ height: 8, borderWidth: 1, borderColor: '#000', backgroundColor: '#fff', marginBottom: 4 }}>
              <View style={{ width: `${Math.min(100, Math.round((todayKcal / householdKcalGoal) * 100))}%`, height: '100%', backgroundColor: '#000' }} />
            </View>
            <Text style={{ fontSize: 11, color: '#666', textAlign: 'right' }}>{Math.round((todayKcal / householdKcalGoal) * 100)}% 達成</Text>
            <Pressable style={{ borderTopWidth: 1, borderTopColor: '#dddddd', marginTop: 8, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }} onPress={() => onOpenModal('kcalAdvice')}>
              <AppIcon name="lightbulb" size={14} color="#666" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, color: '#666' }}>點擊查看建議</Text>
            </Pressable>
          </View>

          <View style={{ borderWidth: 2, borderColor: '#000000', padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 11, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', opacity: 0.6 }}>總飲水量</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>每日目標</Text>
                <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 48 }}>{Math.round(householdWaterGoal)}</Text>
                <Text style={{ fontSize: 14, marginTop: 4 }}>ml</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>目前攝取</Text>
                <Text style={{ fontSize: 32, fontWeight: '700', lineHeight: 32 }}>{Math.round(todayWater)}</Text>
                <Text style={{ fontSize: 12, marginTop: 2 }}>ml</Text>
              </View>
            </View>
            <View style={{ height: 8, borderWidth: 1, borderColor: '#000', backgroundColor: '#fff', marginBottom: 4 }}>
              <View style={{ width: `${Math.min(100, Math.round((todayWater / householdWaterGoal) * 100))}%`, height: '100%', backgroundColor: '#000' }} />
            </View>
            <Text style={{ fontSize: 11, color: '#666', textAlign: 'right' }}>{Math.round((todayWater / householdWaterGoal) * 100)}% 達成</Text>
            <Pressable style={{ borderTopWidth: 1, borderTopColor: '#dddddd', marginTop: 8, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }} onPress={() => onOpenModal('waterAdvice')}>
              <AppIcon name="lightbulb" size={14} color="#666" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, color: '#666' }}>點擊查看建議</Text>
            </Pressable>
          </View>
        </View>

        {renderAlerts(Object.values(summaryByCatId).flatMap(s => s.alerts))}

        <View style={styles.section}>
<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="show-chart" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>近 7 日趨勢</Text>
        </View>
        <TrendChart
          title="熱量攝取趨勢 (kcal)"
          data={chartData.kcalData}
          goal={householdKcalGoal}
          unit="kcal"
          color="#000"
          recordsComplete={chartData.kcalRecordsComplete}
        />
        <TrendChart
          title="飲水量趨勢 (ml)"
          data={chartData.waterData}
          goal={householdWaterGoal}
          unit="ml"
          color="#3b82f6"
          recordsComplete={chartData.waterRecordsComplete}
        />
        </View>

        {renderRecentRecords()}

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="people" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>家庭成員</Text>
        </View>
          {cats.map((cat) => (
            <Pressable
              key={cat.id}
              style={styles.recordItem}
              onPress={() => onLevelChange(cat.id as Level)}
            >
              <View style={styles.recordHeader}>
                <Text style={styles.recordTitle}>{cat.name}</Text>
                <Text style={styles.recordTime}>BCS {cat.bcsScore}/9</Text>
              </View>
              <Text style={styles.recordData}>{cat.currentWeightKg.toFixed(1)} kg</Text>
              <Text style={styles.recordDesc}>
                {cat.chronicConditions.length > 0 ? cat.chronicConditions.join(' • ') : '健康狀況良好'}
              </Text>
            </Pressable>
          ))}
        </View>
      </>
    );
  }

  const individualKcalGoal = currentCat ? Math.round(calculateDailyKcalGoal(currentCat)) : 250;
  const individualWaterGoal = currentCat
    ? Math.round(calculateAdaptiveDailyWaterGoal(currentCat, getRecentDailyWaterIntakesForCat(currentCat.id)))
    : 210;

  const kcalMultiplierHint = currentCat?.chronicConditions.includes('hyperthyroidism') ? 'RER × 1.6 (甲亢)' :
    currentCat?.chronicConditions.includes('obesity') ? 'RER × 0.8 (肥胖管理)' :
      currentCat?.spayedNeutered ? 'RER × 1.2 (已結紮)' : 'RER × 1.4 (未結紮)';

  const waterRange = currentCat ? calculateDailyWaterGoalRange(currentCat) : { min: 0, max: 0 };
  const waterMultiplierHint = currentCat?.chronicConditions.includes('ckd') ? '40–60ml / kg (腎病建議區間)' :
    currentCat?.chronicConditions.includes('diabetes') ? '50–70ml / kg（基線+趨勢）' :
      currentCat?.chronicConditions.includes('flutd') ? '50–65ml / kg（基線+趨勢）' :
        '50ml / kg (標準)';
  // 今日攝取（僅當日紀錄，非累積）
  const currentKcal = currentSummary?.todayKcalIntake ?? currentSummary?.totalKcalIntake ?? 0;
  const currentWater = currentSummary?.todayWaterMl ?? currentSummary?.totalActualWaterMl ?? 0;

  return (
    <>
      <View style={{ borderWidth: 2, borderColor: '#000', padding: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <AppIcon name="pets" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>{currentCat?.name} - 個體數據</Text>
        </View>

        <View style={[styles.weightSection, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <View>
            <Text style={styles.dataLabel}>目前體重</Text>
            <Text style={[styles.weightCurrent, { fontSize: 32 }]}>{currentCat?.currentWeightKg.toFixed(1)} kg</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dataLabel}>起始</Text>
            <Text style={[styles.weightCurrent, { fontSize: 24 }]}>{currentCat?.baselineWeightKg.toFixed(1)} kg</Text>
          </View>
        </View>
        <Text style={[styles.weightRange, { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }]}>
          目標：{currentCat?.targetWeightKg.toFixed(1)} kg
        </Text>

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <AppIcon name="medical-services" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>醫療背景</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={styles.recordTitle}>慢性病紀錄</Text>
            <Text style={styles.recordDesc}>{currentCat?.chronicConditions.join(' • ') || '無'}</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={styles.recordTitle}>飲食限制/過敏</Text>
            <Text style={styles.recordDesc}>{currentCat?.allergyBlacklist.join(' • ') || '無'}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, borderWidth: 2, borderColor: '#000', padding: 12 }}>
            <Text style={{ fontSize: 10, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', opacity: 0.6 }}>今日攝取熱量</Text>
            <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center' }}>{Math.round(currentKcal)}</Text>
            <Text style={{ fontSize: 11, textAlign: 'center' }}>kcal</Text>
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#000' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 10 }}>目標</Text>
                <Text style={{ fontSize: 10, fontWeight: '700' }}>{individualKcalGoal} kcal</Text>
              </View>
              <View style={{ height: 6, borderWidth: 1, borderColor: '#000', backgroundColor: '#fff', marginBottom: 2 }}>
                <View style={{ width: `${Math.min(100, Math.round((currentKcal / individualKcalGoal) * 100))}%`, height: '100%', backgroundColor: '#000' }} />
              </View>
              <Text style={{ fontSize: 10, color: '#666', textAlign: 'right' }}>{Math.round((currentKcal / individualKcalGoal) * 100)}% 達成</Text>
            </View>
          </View>
          <View style={{ flex: 1, borderWidth: 2, borderColor: '#000', padding: 12 }}>
            <Text style={{ fontSize: 10, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', opacity: 0.6 }}>今日飲水量</Text>
            <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center' }}>{Math.round(currentWater)}</Text>
            <Text style={{ fontSize: 11, textAlign: 'center' }}>ml</Text>
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#000' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 10 }}>目標</Text>
                <Text style={{ fontSize: 10, fontWeight: '700' }}>
                  {(currentCat?.chronicConditions.includes('ckd') ||
                    currentCat?.chronicConditions.includes('diabetes') ||
                    currentCat?.chronicConditions.includes('flutd'))
                    ? `${Math.round(waterRange.min)}–${Math.round(waterRange.max)} ml`
                    : `${individualWaterGoal} ml`}
                </Text>
              </View>
              <View style={{ height: 6, borderWidth: 1, borderColor: '#000', backgroundColor: '#fff', marginBottom: 2 }}>
                <View style={{ width: `${Math.min(100, Math.round((currentWater / individualWaterGoal) * 100))}%`, height: '100%', backgroundColor: '#000' }} />
              </View>
              <Text style={{ fontSize: 10, color: '#666', textAlign: 'right' }}>{Math.round((currentWater / individualWaterGoal) * 100)}% 達成</Text>
            </View>
          </View>
        </View>
      </View>

      {currentSummary?.alerts && renderAlerts(currentSummary.alerts)}

      <View style={styles.section}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="show-chart" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>近 7 日趨勢</Text>
        </View>
        <TrendChart
          title="熱量攝取趨勢 (kcal)"
          data={chartData.kcalData}
          goal={individualKcalGoal}
          unit="kcal"
          color="#000"
          recordsComplete={chartData.kcalRecordsComplete}
        />
        <TrendChart
          title="飲水量趨勢 (ml)"
          data={chartData.waterData}
          goal={individualWaterGoal}
          unit="ml"
          color="#3b82f6"
          recordsComplete={chartData.waterRecordsComplete}
        />
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="restaurant" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>飲食記錄</Text>
        </View>
        {recordLists.feedings.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#666' }}>尚無飲食紀錄</Text>
        ) : (
          recordLists.feedings.map((l) => (
            <Pressable key={l.id} style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'feeding' })}>
              <View style={styles.recordHeader}>
                <AppIcon name="restaurant" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={[styles.recordTitle, { flex: 1 }]}>飲食記錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{l.note || '飼料'} - {l.totalGram}g</Text>
              <Text style={styles.recordDesc}>{Math.round(l.kcal ?? l.totalGram * 3)} kcal{l.note ? ` • ${l.note}` : ''}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="opacity" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>飲水紀錄</Text>
        </View>
        {recordLists.hydrations.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#666' }}>尚無飲水紀錄</Text>
        ) : (
          recordLists.hydrations.map((l) => (
            <Pressable key={l.id} style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'hydration' })}>
              <View style={styles.recordHeader}>
                <AppIcon name="opacity" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={[styles.recordTitle, { flex: 1 }]}>飲水紀錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>總計：{Math.round(l.actualWaterMl ?? l.totalMl)} ml</Text>
              <Text style={styles.recordDesc}>估算攝取</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="sanitizer" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>排泄紀錄</Text>
        </View>
        {recordLists.eliminations.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#666' }}>尚無排泄紀錄</Text>
        ) : (
          recordLists.eliminations.map((l) => (
            <Pressable key={l.id} style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'elimination' })}>
              <View style={styles.recordHeader}>
                <AppIcon name="sanitizer" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={[styles.recordTitle, { flex: 1 }]}>排泄紀錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{l.shapeType || ['', '硬塊狀', '香腸狀有裂縫', '香腸狀有裂縫', '香腸狀或蛇形', '軟塊有清晰邊緣', '糊狀', '水狀'][l.bristolType] || `Type ${l.bristolType}`}</Text>
              <Text style={styles.recordDesc}>{l.color} • {l.abnormal ? '異常' : '正常'}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="medication" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>用藥紀錄</Text>
        </View>
        {recordLists.medications.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#666' }}>尚無用藥紀錄</Text>
        ) : (
          recordLists.medications.map((l) => (
            <Pressable key={l.id} style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'medication' })}>
              <View style={styles.recordHeader}>
                <AppIcon name="medication" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={[styles.recordTitle, { flex: 1 }]}>{l.medicationName}</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{l.dosage}</Text>
              {(l.reminderTime || l.notes) && (
                <Text style={styles.recordDesc}>
                  {l.reminderTime ? `預定：${l.reminderTime}${l.notes ? ' • ' : ''}` : ''}
                  {l.notes || ''}
                </Text>
              )}
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="healing" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>異常症狀紀錄</Text>
        </View>
        {recordLists.symptoms.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#666' }}>尚無症狀紀錄</Text>
        ) : (
          recordLists.symptoms.map((l) => (
            <Pressable key={l.id} style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'symptom' })}>
              <View style={styles.recordHeader}>
                <AppIcon name="healing" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={[styles.recordTitle, { flex: 1 }]}>異常症狀記錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{l.symptom}</Text>
              <Text style={styles.recordDesc}>
                {l.severity === 'severe' ? '嚴重' : l.severity === 'moderate' ? '中等' : '輕微'}
                {l.notes ? ` • ${l.notes}` : ''}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </>
  );
}
