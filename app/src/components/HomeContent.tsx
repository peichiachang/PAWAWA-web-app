import React, { useMemo, useState, useEffect } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveModal, Level, FeedingOwnershipLog, HydrationOwnershipLog, VesselCalibration, INTAKE_LEVEL_RATIO } from '../types/app';
import { EliminationOwnershipLog } from '../hooks/useElimination';
import { CatIdentity, ClinicalSummary, MedicationLog, SymptomLog } from '../types/domain';
import { styles, palette } from '../styles/common';
import { calculateAdaptiveDailyWaterGoal, calculateDailyKcalGoal, calculateDailyWaterGoalRange } from '../utils/health';
import { TrendChart } from './TrendChart';
import { DetailRecord } from './modals/RecordDetailModal';
import { AppIcon } from './AppIcon';
import { RecordLogItem } from './RecordLogItem';
import { AnimatedPressable } from './AnimatedPressable';
import { FadeInView } from './FadeInView';
import { ease as layoutEase } from '../utils/layoutAnimation';
import { extractCatSeries, getCatNameBySeries, matchesCatSeries, getScopedCats } from '../utils/catScope';
import { getBristolLabel } from '../constants/bristol';
import { toDateKey, isToday } from '../utils/date';
import { getRecentDailyWaterIntakesForCat } from '../utils/hydrationUtils';

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
  vesselProfiles: VesselCalibration[];
  onEditCat?: () => void;
  onRecordPress?: (record: DetailRecord) => void;
  pendingT1Count?: number;
  onOpenPendingT1?: () => void;
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
  vesselProfiles,
  onEditCat,
  onRecordPress,
  pendingT1Count = 0,
  onOpenPendingT1,
}: Props) {
  const [dataTrendTab, setDataTrendTab] = useState<'today' | 'kcal' | 'water'>('today');
  const [dataTrendDropdownOpen, setDataTrendDropdownOpen] = useState(false);

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
    // Generate last 7 days: key for grouping (YYYY-M-D) + label for display (M/D)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        key: toDateKey(d.getTime()),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      };
    });

    // Filter by level
    // household_only 記錄只歸屬家庭層級，個體層級只顯示明確指定該貓的記錄
    const filteredFeedings = level === 'household'
      ? feedingHistory
      : feedingHistory.filter(l => matchesCatSeries(l.selectedTagId, level));

    const filteredHydrations = level === 'household'
      ? hydrationHistory
      : hydrationHistory.filter(l => matchesCatSeries(l.selectedTagId, level));

    // Group feeding (kcal) by date with error margin and record tracking
    const kcalData = days.map(({ key: day, label }) => {
      const dayLogs = filteredFeedings.filter(log => toDateKey(log.createdAt) === day);
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
      
      const roundedKcal = Math.round(totalKcal);
      return {
        label,
        value: roundedKcal,
        errorMargin: weightedErrorMargin > 0 ? weightedErrorMargin : undefined,
        hasRecord: dayLogs.length > 0,
        lowConfidence: hasLowConfidence,
        hasAlmostNone: roundedKcal === 0 && dayLogs.some(l => l.intakeLevel === 'almost_none'),
      };
    });

    // Group hydration by date with error margin and record tracking
    const waterData = days.map(({ key: day, label }) => {
      const dayLogs = filteredHydrations.filter(log => toDateKey(log.createdAt) === day
      );
      const totalMl = dayLogs.reduce((sum, log) => sum + (log.actualWaterMl || log.totalMl), 0);
      
      // 飲水記錄誤差約 ±15%（視覺估算 + 蒸發修正）
      const errorMargin = dayLogs.length > 0 ? 0.15 : undefined;
      
      return {
        label,
        value: Math.round(totalMl),
        errorMargin,
        hasRecord: dayLogs.length > 0,
        lowConfidence: false,
      };
    });

    // 胃口趨勢：僅納入有 intakeLevel 的記錄（有 T1／攝取程度），每日平均攝取程度 0–100%
    const appetiteData = days.map(({ key: day, label }) => {
      const dayLogs = filteredFeedings.filter(
        log => log.intakeLevel != null && toDateKey(log.createdAt) === day
      );
      const avgRatio = dayLogs.length > 0
        ? dayLogs.reduce((sum, log) => sum + INTAKE_LEVEL_RATIO[log.intakeLevel!], 0) / dayLogs.length
        : 0;
      const roundedPct = Math.round(avgRatio * 100);
      return {
        label,
        value: roundedPct,
        hasRecord: dayLogs.length > 0,
        hasAlmostNone: roundedPct === 0 && dayLogs.some(l => l.intakeLevel === 'almost_none'),
      };
    });
    const kcalRecordsComplete = kcalData.filter(d => d.hasRecord).length;
    const waterRecordsComplete = waterData.filter(d => d.hasRecord).length;
    const appetiteRecordsComplete = appetiteData.filter(d => d.hasRecord).length;

    return { kcalData, waterData, appetiteData, kcalRecordsComplete, waterRecordsComplete, appetiteRecordsComplete };
  }, [feedingHistory, hydrationHistory, level, vesselProfiles]);

  const recentRecords = useMemo(() => {
    const allFeedings = feedingHistory.filter(f => level === 'household' ? (f.ownershipType === 'household_only' || f.selectedTagId === 'household') : matchesCatSeries(f.selectedTagId, level));
    const allHydrations = hydrationHistory.filter(h => level === 'household' ? (h.ownershipType === 'household_only' || h.selectedTagId === 'household') : matchesCatSeries(h.selectedTagId, level));
    const allEliminations = eliminationHistory.filter(h => level === 'household' || matchesCatSeries(h.selectedTagId, level));
    const allMedications = medicationHistory.filter(m => level === 'household' || matchesCatSeries(m.catId, level));
    const allSymptoms = symptomHistory.filter(s => level === 'household' || matchesCatSeries(s.catId, level));

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
    const feedings = feedingHistory.filter(f => matchesCatSeries(f.selectedTagId, level)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const hydrations = hydrationHistory.filter(h => matchesCatSeries(h.selectedTagId, level)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const eliminations = eliminationHistory.filter(e => matchesCatSeries(e.selectedTagId, level)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const medications = medicationHistory.filter(m => matchesCatSeries(m.catId, level)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    const symptoms = symptomHistory.filter(s => matchesCatSeries(s.catId, level)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    return { feedings, hydrations, eliminations, medications, symptoms };
  }, [feedingHistory, hydrationHistory, eliminationHistory, medicationHistory, symptomHistory, level]);

  // 今日攝取（僅當日紀錄，非累積）- 必須在 early return 之前，避免違反 React Rules of Hooks
  const currentKcal = useMemo(
    () => feedingHistory
      .filter((log) => matchesCatSeries(log.selectedTagId, level) && isToday(log.createdAt))
      .reduce((sum, log) => sum + (log.kcal ?? log.totalGram * 3), 0),
    [feedingHistory, level]
  );
  const currentWater = useMemo(
    () => hydrationHistory
      .filter((log) => matchesCatSeries(log.selectedTagId, level) && isToday(log.createdAt))
      .reduce((sum, log) => sum + (log.actualWaterMl ?? log.totalMl ?? 0), 0),
    [hydrationHistory, level]
  );

  const renderRecentRecords = () => (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <AppIcon name="history" size={18} color="#000" style={{ marginRight: 6 }} />
        <Text style={styles.sectionTitle}>最近記錄</Text>
      </View>
      {recentRecords.length === 0 ? (
        <Text style={{ fontSize: 13, color: palette.muted }}>尚無最近紀錄</Text>
      ) : (
        recentRecords.map(record => (
          <RecordLogItem
            key={record.id}
            record={record}
            cats={cats}
            onRecordPress={onRecordPress}
          />
        ))
      )}
    </View>
  );

  if (level === 'household') {
    const indexedCats = cats.filter((cat) => /^cat_\d+_/.test(cat.id));
    const goalCats = indexedCats.length > 0 ? indexedCats : cats;
    const householdKcalGoal = goalCats.reduce((sum, cat) => sum + calculateDailyKcalGoal(cat), 0) || 625;
    const householdWaterGoal = goalCats.reduce((sum, cat) => {
      const recent = getRecentDailyWaterIntakesForCat(hydrationHistory, cat.id);
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
            <AnimatedPressable
              style={{ padding: 10, backgroundColor: palette.primary, borderRadius: 4 }}
              onPress={() => onOpenModal('addCat')}
            >
              <Text style={{ color: palette.onPrimary, textAlign: 'center', fontWeight: '700', fontSize: 12 }}>立即建立第一隻貓咪</Text>
            </AnimatedPressable>
          </View>
        )}
        <FadeInView duration={300} delay={50}>
        <AnimatedPressable
          style={[styles.cardBlock, { marginBottom: 16 }]}
          onPress={() => onOpenModal('recordMode')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <AppIcon name="add-circle" size={20} color={palette.text} style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>新增紀錄</Text>
          </View>
          <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 12 }}>記錄食物、飲水、排泄等，掌握貓咪健康</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 2, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>以紀錄模式開啟（可切換類型）</Text>
            <AppIcon name="expand-more" size={22} color={palette.text} />
          </View>
        </AnimatedPressable>
        </FadeInView>
        {pendingT1Count != null && pendingT1Count > 0 && onOpenPendingT1 && (
          <View style={{ marginBottom: 16, padding: 14, backgroundColor: palette.infoBg, borderWidth: 2, borderColor: palette.infoBorder, borderRadius: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.infoText, marginBottom: 6 }}>您有 {pendingT1Count} 筆放飯記錄尚未填寫收碗</Text>
            <AnimatedPressable onPress={onOpenPendingT1} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, backgroundColor: palette.infoBorder, borderRadius: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.onPrimary }}>去填寫</Text>
            </AnimatedPressable>
          </View>
        )}
        <View style={styles.cardBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <AppIcon name="dashboard" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>數據與趨勢</Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 16, borderWidth: 1, borderColor: '#000', borderRadius: 4, overflow: 'hidden' }}>
            {([
              { key: 'today' as const, label: '今日數據' },
              { key: 'kcal' as const, label: '熱量趨勢' },
              { key: 'water' as const, label: '飲水趨勢' },
            ] as const).map(({ key, label }, i, arr) => (
              <Pressable
                key={key}
                style={{ flex: 1, paddingVertical: 8, backgroundColor: dataTrendTab === key ? '#000' : '#fff', borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#000' }}
                onPress={() => setDataTrendTab(key)}
              >
                <Text style={{ fontSize: 12, textAlign: 'center', fontWeight: dataTrendTab === key ? '700' : '400', color: dataTrendTab === key ? '#fff' : '#000' }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {dataTrendTab === 'today' && (
            <>
              <View style={{ borderWidth: 2, borderColor: '#000000', padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 11, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', opacity: 0.6 }}>總攝取熱量</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 4 }}>每日目標</Text>
                    <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 48 }}>{Math.round(householdKcalGoal)}</Text>
                    <Text style={{ fontSize: 14, marginTop: 4 }}>kcal</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 4 }}>目前攝取</Text>
                    <Text style={{ fontSize: 32, fontWeight: '700', lineHeight: 32 }}>{Math.round(todayKcal)}</Text>
                    <Text style={{ fontSize: 12, marginTop: 2 }}>kcal</Text>
                  </View>
                </View>
                <View style={{ height: 8, borderWidth: 1, borderColor: '#000', backgroundColor: '#fff', marginBottom: 4 }}>
                  <View style={{ width: `${Math.min(100, Math.round((todayKcal / householdKcalGoal) * 100))}%`, height: '100%', backgroundColor: '#000' }} />
                </View>
                <Text style={{ fontSize: 11, color: palette.muted, textAlign: 'right' }}>{Math.round((todayKcal / householdKcalGoal) * 100)}% 達成</Text>
                <Pressable style={{ borderTopWidth: 1, borderTopColor: '#dddddd', marginTop: 8, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }} onPress={() => onOpenModal('kcalAdvice')}>
                  <AppIcon name="lightbulb" size={14} color={palette.muted} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11, color: palette.muted }}>點擊查看建議</Text>
                </Pressable>
              </View>
              <View style={{ borderWidth: 2, borderColor: '#000000', padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 11, textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', opacity: 0.6 }}>總飲水量</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 4 }}>每日目標</Text>
                    <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 48 }}>{Math.round(householdWaterGoal)}</Text>
                    <Text style={{ fontSize: 14, marginTop: 4 }}>ml</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: palette.muted, marginBottom: 4 }}>目前攝取</Text>
                    <Text style={{ fontSize: 32, fontWeight: '700', lineHeight: 32 }}>{Math.round(todayWater)}</Text>
                    <Text style={{ fontSize: 12, marginTop: 2 }}>ml</Text>
                  </View>
                </View>
                <View style={{ height: 8, borderWidth: 1, borderColor: '#000', backgroundColor: '#fff', marginBottom: 4 }}>
                  <View style={{ width: `${Math.min(100, Math.round((todayWater / householdWaterGoal) * 100))}%`, height: '100%', backgroundColor: '#000' }} />
                </View>
                <Text style={{ fontSize: 11, color: palette.muted, textAlign: 'right' }}>{Math.round((todayWater / householdWaterGoal) * 100)}% 達成</Text>
                <Pressable style={{ borderTopWidth: 1, borderTopColor: '#dddddd', marginTop: 8, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }} onPress={() => onOpenModal('waterAdvice')}>
                  <AppIcon name="lightbulb" size={14} color={palette.muted} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11, color: palette.muted }}>點擊查看建議</Text>
                </Pressable>
              </View>
            </>
          )}
          {dataTrendTab === 'kcal' && (
            <TrendChart
              title="熱量攝取趨勢 (kcal)"
              data={chartData.kcalData}
              goal={householdKcalGoal}
              unit="kcal"
              color="#000"
              recordsComplete={chartData.kcalRecordsComplete}
            />
          )}
          {dataTrendTab === 'water' && (
            <TrendChart
              title="飲水量趨勢 (ml)"
              data={chartData.waterData}
              goal={householdWaterGoal}
              unit="ml"
              color="#3b82f6"
              recordsComplete={chartData.waterRecordsComplete}
            />
          )}
        </View>

        {renderRecentRecords()}

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="people" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>家庭成員</Text>
        </View>
          {getScopedCats(cats).map((cat) => (
            <Pressable
              key={cat.id}
              style={styles.recordItem}
              onPress={() => onLevelChange((extractCatSeries(cat.id) || cat.id) as Level)}
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

  if (!currentCat) {
    return (
      <View style={[styles.cardBlock, { padding: 24 }]}>
        <Text style={{ fontSize: 14, color: palette.muted, textAlign: 'center' }}>找不到此貓咪資料，請從上方切換回家庭或選擇其他貓咪。</Text>
      </View>
    );
  }

  const recentWaterIntakes = getRecentDailyWaterIntakesForCat(hydrationHistory, currentCat.id);
  const isWaterGoalPersonalized = recentWaterIntakes.filter((v) => v > 0).length >= 3;
  const individualKcalGoal = Math.round(calculateDailyKcalGoal(currentCat));
  const individualWaterGoal = Math.round(calculateAdaptiveDailyWaterGoal(currentCat, recentWaterIntakes));

  const conditions = currentCat.chronicConditions ?? [];
  const kcalMultiplierHint = conditions.includes('hyperthyroidism') ? 'RER × 1.6 (甲亢)' :
    conditions.includes('obesity') ? 'RER × 0.8 (減重期)' :
      currentCat.spayedNeutered ? 'RER × 1.2 (已結紮)' : 'RER × 1.4 (未結紮)';

  const waterRange = calculateDailyWaterGoalRange(currentCat);
  const hasCkd = Boolean(conditions.includes('ckd'));
  const hasDiabetes = Boolean(conditions.includes('diabetes'));
  const hasFlutd = Boolean(conditions.includes('flutd'));
  const isWaterObservationMode = hasDiabetes || hasFlutd;
  const waterMultiplierHint = conditions.includes('ckd') ? '40–60ml / kg (腎病建議區間)' :
    conditions.includes('diabetes') ? '50–70ml / kg（觀察區間）' :
      conditions.includes('flutd') ? '50–65ml / kg（觀察區間）' :
        '50ml / kg (標準)';
  const waterProgressBase = isWaterObservationMode ? Math.max(waterRange.max, 1) : Math.max(individualWaterGoal, 1);
  const waterProgressPct = Math.round((currentWater / waterProgressBase) * 100);

  return (
    <>
      <Pressable style={[styles.cardBlock, { marginBottom: 16 }]} onPress={() => onOpenModal('recordMode')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <AppIcon name="add-circle" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.cardTitle}>新增紀錄</Text>
        </View>
        <Text style={{ fontSize: 12, color: palette.muted, marginBottom: 12 }}>記錄食物、飲水、排泄等，掌握貓咪健康</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 2, borderColor: '#000', borderRadius: 8, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 14, fontWeight: '600' }}>以紀錄模式開啟（可切換類型）</Text>
          <AppIcon name="expand-more" size={22} color="#000" />
        </View>
      </Pressable>
      {pendingT1Count != null && pendingT1Count > 0 && onOpenPendingT1 && (
        <View style={{ marginBottom: 16, padding: 14, backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#3b82f6', borderRadius: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.infoText, marginBottom: 6 }}>您有 {pendingT1Count} 筆放飯記錄尚未填寫收碗</Text>
          <Pressable onPress={onOpenPendingT1} style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#3b82f6', borderRadius: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>去填寫</Text>
          </Pressable>
        </View>
      )}
      <View style={{ borderWidth: 2, borderColor: '#000', padding: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <AppIcon name="pets" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>{currentCat.name} - 個體數據</Text>
        </View>

        <View style={[styles.weightSection, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <View>
            <Text style={styles.dataLabel}>目前體重</Text>
            <Text style={[styles.weightCurrent, { fontSize: 32 }]}>{(currentCat.currentWeightKg ?? 0).toFixed(1)} kg</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dataLabel}>起始</Text>
            <Text style={[styles.weightCurrent, { fontSize: 24 }]}>{(currentCat.baselineWeightKg ?? 0).toFixed(1)} kg</Text>
          </View>
        </View>
        <Text style={[styles.weightRange, { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }]}>
          目標：{(currentCat.targetWeightKg ?? 0).toFixed(1)} kg
        </Text>

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <AppIcon name="medical-services" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>醫療背景</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={styles.recordTitle}>慢性病紀錄</Text>
            <Text style={styles.recordDesc}>{(currentCat.chronicConditions ?? []).join(' • ') || '無'}</Text>
          </View>
          <View style={styles.recordItem}>
            <Text style={styles.recordTitle}>飲食限制/過敏</Text>
            <Text style={styles.recordDesc}>{(currentCat.allergyBlacklist ?? []).join(' • ') || '無'}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <AppIcon name="dashboard" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>數據與趨勢</Text>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 12, borderWidth: 1, borderColor: '#000', borderRadius: 4, overflow: 'hidden' }}>
            {([
              { key: 'today' as const, label: '今日數據' },
              { key: 'kcal' as const, label: '熱量趨勢' },
              { key: 'water' as const, label: '飲水趨勢' },
            ] as const).map(({ key, label }, i, arr) => (
              <Pressable
                key={key}
                style={{ flex: 1, paddingVertical: 8, backgroundColor: dataTrendTab === key ? '#000' : '#fff', borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#000' }}
                onPress={() => setDataTrendTab(key)}
              >
                <Text style={{ fontSize: 12, textAlign: 'center', fontWeight: dataTrendTab === key ? '700' : '400', color: dataTrendTab === key ? '#fff' : '#000' }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {dataTrendTab === 'today' && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
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
                  <Text style={{ fontSize: 10, color: palette.muted, textAlign: 'right' }}>{Math.round((currentKcal / individualKcalGoal) * 100)}% 達成</Text>
                </View>
              </View>
              <View style={{ flex: 1, borderWidth: 2, borderColor: '#000', padding: 12 }}>
                <Text style={{ fontSize: 10, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', opacity: 0.6 }}>今日飲水量</Text>
                <Text style={{ fontSize: 24, fontWeight: '700', textAlign: 'center' }}>{Math.round(currentWater)}</Text>
                <Text style={{ fontSize: 11, textAlign: 'center' }}>ml</Text>
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#000' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 10 }}>{isWaterObservationMode ? '觀察區間' : '目標'}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700' }}>
                      {(hasCkd || hasDiabetes || hasFlutd)
                        ? `${Math.round(waterRange.min)}–${Math.round(waterRange.max)} ml`
                        : `${individualWaterGoal} ml`}
                    </Text>
                  </View>
                  <View style={{ height: 6, borderWidth: 1, borderColor: '#000', backgroundColor: '#fff', marginBottom: 2 }}>
                    <View style={{ width: `${Math.min(100, waterProgressPct)}%`, height: '100%', backgroundColor: '#000' }} />
                  </View>
                  {isWaterObservationMode ? (
                    <Text style={{ fontSize: 10, color: palette.muted, textAlign: 'right' }}>
                      觀察：若連續多日 {'>'} {Math.round(waterRange.max)} ml，建議回診檢查控制狀態
                    </Text>
                  ) : (
                    <>
                      <Text style={{ fontSize: 10, color: palette.muted, textAlign: 'right' }}>{waterProgressPct}% 達成</Text>
                      {isWaterGoalPersonalized && (
                        <Text style={{ fontSize: 9, color: '#888', textAlign: 'right', marginTop: 2 }}>目標已根據近期紀錄調整</Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>
          )}
          {dataTrendTab === 'kcal' && (
            <TrendChart
              title="熱量攝取趨勢 (kcal)"
              data={chartData.kcalData}
              goal={individualKcalGoal}
              unit="kcal"
              color="#000"
              recordsComplete={chartData.kcalRecordsComplete}
            />
          )}
          {dataTrendTab === 'water' && (
            <TrendChart
              title="飲水量趨勢 (ml)"
              data={chartData.waterData}
              goal={individualWaterGoal}
              unit="ml"
              color="#3b82f6"
              recordsComplete={chartData.waterRecordsComplete}
            />
          )}
        </View>
        <View style={{ borderWidth: 1, borderColor: '#000', backgroundColor: '#f8fafc', padding: 10 }}>
          <Text style={{ fontSize: 11, lineHeight: 18, color: '#334155' }}>
            熱量與水分係數為起始建議，需依體況與獸醫評估調整。疾患係數僅供示意；甲亢請依體重/肌肉回升動態調整。
            {hasCkd ? ' CKD 目標請依主治獸醫調整，濕食與皮下輸液也應計入總水分。' : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="restaurant" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>食物記錄</Text>
        </View>
        <FlatList
          data={recordLists.feedings}
          keyExtractor={(l) => l.id}
          scrollEnabled={false}
          renderItem={({ item: l }) => (
            <Pressable style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'feeding' })}>
              <View style={styles.recordHeader}>
                <View style={styles.recordHeaderIcon}>
                  <AppIcon name="restaurant" size={16} color="#000" />
                </View>
                <Text style={[styles.recordTitle, { flex: 1 }]}>食物記錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{l.note || '飼料'} - {l.totalGram}g</Text>
              <Text style={styles.recordDesc}>{Math.round(l.kcal ?? l.totalGram * 3)} kcal{l.note ? ` • ${l.note}` : ''}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ fontSize: 13, color: palette.muted }}>尚無食物紀錄</Text>}
        />
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="opacity" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>飲水紀錄</Text>
        </View>
        <FlatList
          data={recordLists.hydrations}
          keyExtractor={(l) => l.id}
          scrollEnabled={false}
          renderItem={({ item: l }) => (
            <Pressable style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'hydration' })}>
              <View style={styles.recordHeader}>
                <View style={styles.recordHeaderIcon}>
                  <AppIcon name="opacity" size={16} color="#000" />
                </View>
                <Text style={[styles.recordTitle, { flex: 1 }]}>飲水紀錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>總計：{Math.round(l.actualWaterMl ?? l.totalMl)} ml</Text>
              <Text style={styles.recordDesc}>估算攝取</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ fontSize: 13, color: palette.muted }}>尚無飲水紀錄</Text>}
        />
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="sanitizer" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>排泄紀錄</Text>
        </View>
        <FlatList
          data={recordLists.eliminations}
          keyExtractor={(l) => l.id}
          scrollEnabled={false}
          renderItem={({ item: l }) => (
            <Pressable style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'elimination' })}>
              <View style={styles.recordHeader}>
                <View style={styles.recordHeaderIcon}>
                  <AppIcon name="sanitizer" size={16} color="#000" />
                </View>
                <Text style={[styles.recordTitle, { flex: 1 }]}>排泄紀錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{l.shapeType || getBristolLabel(l.bristolType)}</Text>
              <Text style={styles.recordDesc}>{l.color} • {l.abnormal ? '異常' : '正常'}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ fontSize: 13, color: palette.muted }}>尚無排泄紀錄</Text>}
        />
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="medication" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>用藥紀錄</Text>
        </View>
        <FlatList
          data={recordLists.medications}
          keyExtractor={(l) => l.id}
          scrollEnabled={false}
          renderItem={({ item: l }) => (
            <Pressable style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'medication' })}>
              <View style={styles.recordHeader}>
                <View style={styles.recordHeaderIcon}>
                  <AppIcon name="medication" size={16} color="#000" />
                </View>
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
          )}
          ListEmptyComponent={<Text style={{ fontSize: 13, color: palette.muted }}>尚無用藥紀錄</Text>}
        />
      </View>

      <View style={[styles.section, { maxWidth: 320, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <AppIcon name="healing" size={18} color="#000" style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>異常症狀紀錄</Text>
        </View>
        <FlatList
          data={recordLists.symptoms}
          keyExtractor={(l) => l.id}
          scrollEnabled={false}
          renderItem={({ item: l }) => (
            <Pressable style={[styles.recordItem, { borderLeftWidth: 3, borderLeftColor: '#000', padding: 12 }]} onPress={() => onRecordPress?.({ ...l, _type: 'symptom' })}>
              <View style={styles.recordHeader}>
                <View style={styles.recordHeaderIcon}>
                  <AppIcon name="healing" size={16} color="#000" />
                </View>
                <Text style={[styles.recordTitle, { flex: 1 }]}>異常症狀記錄</Text>
                <Text style={styles.recordTime}>{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.recordData}>{l.symptom}</Text>
              <Text style={styles.recordDesc}>
                {l.severity === 'severe' ? '嚴重' : l.severity === 'moderate' ? '中等' : '輕微'}
                {l.notes ? ` • ${l.notes}` : ''}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={{ fontSize: 13, color: palette.muted }}>尚無症狀紀錄</Text>}
        />
      </View>
    </>
  );
}
