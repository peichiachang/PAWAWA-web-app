import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useEffect } from 'react';
import { Alert, SafeAreaView, ScrollView, View, Platform } from 'react-native';
import { getAiRecognitionService } from './src/services/ai';
import { buildClinicalSummary } from './src/services/clinicalSummary';
import { calculateAdaptiveDailyWaterGoal, calculateDailyKcalIntake, calculateDailyKcalGoal } from './src/utils/health';
import { ActiveModal, BottomTab, Level } from './src/types/app';
import { useFeeding } from './src/hooks/useFeeding';
import { useHydration } from './src/hooks/useHydration';
import { useElimination } from './src/hooks/useElimination';
import { useBloodReport } from './src/hooks/useBloodReport';
import { useMedication } from './src/hooks/useMedication';
import { useSymptoms } from './src/hooks/useSymptoms';
import { TopNav } from './src/components/TopNav';
import { BottomNav } from './src/components/BottomNav';
import { HomeContent } from './src/components/HomeContent';
import { RecordsContent } from './src/components/RecordsContent';
import { ProfileContent } from './src/components/ProfileContent';
import { KnowledgeContent } from './src/components/KnowledgeContent';
import { BloodReportModal } from './src/components/modals/BloodReportModal';
import { BloodHistoryModal } from './src/components/modals/BloodHistoryModal';
import { BloodReportDetailModal } from './src/components/modals/BloodReportDetailModal';
import { BloodReportRecord } from './src/types/bloodReport';
import { FeedingModal } from './src/components/modals/FeedingModal';
import { HydrationModal } from './src/components/modals/HydrationModal';
import { EliminationModal } from './src/components/modals/EliminationModal';
import { SettingsModal } from './src/components/modals/SettingsModal';
import { KcalAdviceModal } from './src/components/modals/KcalAdviceModal';
import { WaterAdviceModal } from './src/components/modals/WaterAdviceModal';
import { BackupModal } from './src/components/modals/BackupModal';
import { IAPModal } from './src/components/modals/IAPModal';
import { AddCatModal } from './src/components/modals/AddCatModal';
import { MedicationModal } from './src/components/modals/MedicationModal';
import { SymptomModal } from './src/components/modals/SymptomModal';
import { RecordDetailModal, DetailRecord } from './src/components/modals/RecordDetailModal';
import { GlobalCameraProvider, useGlobalCamera } from './src/components/GlobalCameraProvider';
import { styles } from './src/styles/common';
import { VesselCalibrationModal } from './src/components/modals/VesselCalibrationModal';
import { WeightRecordModal } from './src/components/modals/WeightRecordModal';
import { CanLibraryModal } from './src/components/modals/CanLibraryModal';
import { FeedLibraryModal } from './src/components/modals/FeedLibraryModal';
import { scanCanLabel } from './src/services/canLabelScanApi';
import { useVessels } from './src/hooks/useVessels';
import { useRecordReminders } from './src/hooks/useRecordReminders';

import { CATS_STORAGE_KEY, VITALS_HISTORY_KEY } from './src/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CatIdentity, ClinicalSummary, FeedingLog, VitalsLog } from './src/types/domain';
import { applyDevDataMode } from './src/config/devDataMode';
import { getScopedCats, matchesCatSeries } from './src/utils/catScope';

function AppMain() {
  const ai = useMemo(() => getAiRecognitionService(), []);
  const { launchCamera, isCameraVisible } = useGlobalCamera();

  const [level, setLevel] = useState<Level>('household');
  const [bottomTab, setBottomTab] = useState<BottomTab>('home');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedBloodReport, setSelectedBloodReport] = useState<BloodReportRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DetailRecord | null>(null);
  const [vesselCalibrationVisible, setVesselCalibrationVisible] = useState(false);
  /** 待補填：從紀錄頁點「去填寫」時帶入要完成 T1 的食碗 ID */
  const [completeT1VesselId, setCompleteT1VesselId] = useState<string | null>(null);
  /** 要編輯的貓咪（個人 tab 點擊家庭成員時帶入；未設時編輯 modal 用 currentCat） */
  const [selectedCatForEdit, setSelectedCatForEdit] = useState<CatIdentity | null>(null);

  // 共享的 vessels hook（用於 VesselCalibrationModal）
  const sharedVessels = useVessels();
  
  const handleOpenVesselCalibration = () => {
    console.log('[App] handleOpenVesselCalibration called');
    setVesselCalibrationVisible(true);
  };

  // Dynamic Data States
  const [cats, setCats] = useState<CatIdentity[]>([]);
  const [vitalsLogs, setVitalsLogs] = useState<VitalsLog[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<FeedingLog[]>([]);

  const feeding = useFeeding(ai, launchCamera, sharedVessels, cats);
  const pendingT1VesselIds = useMemo(() => feeding.getPendingT1VesselIds(), [feeding]);
  const hydration = useHydration(ai, launchCamera, sharedVessels, cats);
  const elimination = useElimination(ai, launchCamera);
  const medication = useMedication();
  const symptoms = useSymptoms();
  const bloodReport = useBloodReport(ai, launchCamera);
  useRecordReminders(); // 飲食/飲水紀錄提醒（上午 8:00、傍晚 18:00）

  // Web: lock zoom level (disable pinch / double-tap zoom)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const viewport = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    if (!viewport.parentNode) document.head.appendChild(viewport);

    const preventGesture = (event: Event) => event.preventDefault();
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    let lastTouchEnd = 0;
    const preventDoubleTap = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) event.preventDefault();
      lastTouchEnd = now;
    };

    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });
    document.addEventListener('touchmove', preventMultiTouch, { passive: false });
    document.addEventListener('touchend', preventDoubleTap, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchmove', preventMultiTouch);
      document.removeEventListener('touchend', preventDoubleTap);
    };
  }, []);

  // Load persistence data
  useEffect(() => {
    async function loadData() {
      try {
        const storedCats = await AsyncStorage.getItem(CATS_STORAGE_KEY);
        if (storedCats) setCats(JSON.parse(storedCats));

        const storedVitals = await AsyncStorage.getItem(VITALS_HISTORY_KEY);
        if (storedVitals) setVitalsLogs(JSON.parse(storedVitals));

        // Note: feeding.ownershipLogs and hydration.ownershipLogs are already loaded in hooks.
        // But for ClinicalSummary, we might need a more unified way if we want full history.
        // For now, let's keep it simple.
        bloodReport.loadSavedReports();
      } catch (e) {
        console.error('Failed to load data', e);
      }
    }
    loadData();
  }, []);

  const indexedCats = useMemo(() => {
    const scoped = getScopedCats(cats);
    const matched = scoped.filter((cat) => /^cat_\d+_/.test(cat.id));
    return matched.length > 0 ? matched : scoped;
  }, [cats]);

  const summaries = useMemo(
    () => indexedCats.map((cat) => buildClinicalSummary(cat, vitalsLogs, feeding.ownershipLogs, hydration.ownershipLogs, medication.logs, indexedCats.length)),
    [indexedCats, vitalsLogs, feeding.ownershipLogs, hydration.ownershipLogs, medication.logs]
  );
  const summaryByCatId = useMemo(
    () => Object.fromEntries(summaries.map((item) => [item.catId, item])),
    [summaries]
  );

  const todayHouseholdKcal = useMemo(() => {
    const now = new Date();
    const isToday = (ts: number) => {
      const d = new Date(ts);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    return feeding.ownershipLogs
      // Household daily total should include shared logs and cat-tagged logs.
      .filter(item => isToday(item.createdAt))
      .reduce((sum, item) => sum + (item.kcal ?? calculateDailyKcalIntake(item.totalGram, 3.5)), 0);
  }, [feeding.ownershipLogs]);

  const todayHouseholdWater = useMemo(() => {
    const now = new Date();
    const isToday = (ts: number) => {
      const d = new Date(ts);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    };
    return hydration.ownershipLogs
      // Household daily total should include shared logs and cat-tagged logs.
      .filter(item => isToday(item.createdAt))
      .reduce((sum, item) => sum + (item.actualWaterMl || item.totalMl || 0), 0);
  }, [hydration.ownershipLogs]);

  const currentCat = useMemo(() => {
    if (level === 'household') return null;
    const scopedCats = getScopedCats(cats);
    const selected = scopedCats.find((cat) => matchesCatSeries(cat.id, level));
    return selected || null;
  }, [cats, level]);
  const currentSummary = currentCat ? summaryByCatId[currentCat.id] : null;
  const getRecentDailyWaterIntakesForCat = (catId: string): number[] => {
    const byDay = new Map<string, number>();
    hydration.ownershipLogs
      .filter((log) => matchesCatSeries(log.selectedTagId, catId))
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

  function openModal(modal: ActiveModal) {
    if (modal === 'feeding') feeding.openReset();
    if (modal === 'water') hydration.openReset();
    if (modal === 'elimination') elimination.reset();
    if (modal === 'blood') bloodReport.reset();
    setActiveModal(modal);
  }

  /** 開啟編輯貓咪檔案：可傳入要編輯的貓（個人 tab 點擊時）；不傳則編輯目前看板貓 currentCat */
  function openEditCat(cat?: CatIdentity) {
    setSelectedCatForEdit(cat ?? currentCat ?? null);
    setActiveModal('editCat');
  }

  function closeModal() {
    if (activeModal === 'feeding' || activeModal === 'feedingLateEntry') setCompleteT1VesselId(null);
    if (activeModal === 'addCat' || activeModal === 'editCat') setSelectedCatForEdit(null);
    setActiveModal(null);
  }

  function onBottomTabPress(tab: BottomTab) {
    setBottomTab(tab);
  }

  function birthDateFromAge(age: number | undefined, fallbackBirthDate?: string): string {
    if (!Number.isFinite(age) || age == null || age < 0) {
      return fallbackBirthDate || '2020-01-01';
    }
    const now = new Date();
    const birth = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
    return birth.toISOString().slice(0, 10);
  }

  async function handleSaveCat(data: any) {
    try {
      if (data.id) {
        // Edit existing cat
        const updated = cats.map(c => c.id === data.id ? {
          ...c,
          name: data.name,
          gender: data.gender,
          birthDate: birthDateFromAge(data.age, c.birthDate),
          currentWeightKg: data.weight,
          spayedNeutered: data.spayedNeutered,
          chronicConditions: data.chronicConditions || [],
        } : c);
        setCats(updated);
        await AsyncStorage.setItem(CATS_STORAGE_KEY, JSON.stringify(updated));
        Alert.alert('更新成功', `已更新 ${data.name} 的檔案。`);
        return;
      }

      // New cat id format: cat_<index>_<timestamp>
      const nextCatIndex = cats.reduce((max, c) => {
        const m = String(c.id).match(/^cat_(\d+)(?:_|$)/);
        const n = m ? Number(m[1]) : 0;
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0) + 1;
      const generatedCatId = `cat_${nextCatIndex}_${Date.now()}`;

      // New cat logic
      const newCat: CatIdentity = {
        id: generatedCatId,
        name: data.name,
        birthDate: birthDateFromAge(data.age),
        gender: data.gender,
        spayedNeutered: data.spayedNeutered,
        baselineWeightKg: data.weight,
        currentWeightKg: data.weight,
        targetWeightKg: data.weight,
        bcsScore: 5,
        chronicConditions: data.chronicConditions || [],
        allergyWhitelist: [],
        allergyBlacklist: [],
      };

      const updated = [...cats, newCat];
      setCats(updated);
      await AsyncStorage.setItem(CATS_STORAGE_KEY, JSON.stringify(updated));

      // Create initial vitals log
      const initialVitals: VitalsLog = {
        id: `v_${Date.now()}`,
        catId: newCat.id,
        weightKg: newCat.currentWeightKg,
        temperatureC: 38.5,
        medicineFlag: false,
        timestamp: new Date().toISOString(),
      };
      const updatedVitals = [initialVitals, ...vitalsLogs];
      setVitalsLogs(updatedVitals);
      await AsyncStorage.setItem(VITALS_HISTORY_KEY, JSON.stringify(updatedVitals));

      Alert.alert('新增成功', `已建立 ${newCat.name} 的檔案。`);
    } catch (error) {
      console.error('[App] handleSaveCat failed:', error);
      const message = error instanceof Error ? error.message : '無法儲存資料，請稍後再試';
      Alert.alert('建立失敗', message);
      throw error;
    }
  }

  async function handleSaveWeightRecord(catId: string, weightKg: number) {
    const cat = cats.find((c) => c.id === catId);
    if (!cat) return;
    const newLog: VitalsLog = {
      id: `v_${Date.now()}`,
      catId,
      weightKg,
      temperatureC: 38.5,
      medicineFlag: false,
      timestamp: new Date().toISOString(),
    };
    const updatedVitals = [newLog, ...vitalsLogs];
    setVitalsLogs(updatedVitals);
    await AsyncStorage.setItem(VITALS_HISTORY_KEY, JSON.stringify(updatedVitals));
    const updatedCats = cats.map((c) => (c.id === catId ? { ...c, currentWeightKg: weightKg } : c));
    setCats(updatedCats);
    await AsyncStorage.setItem(CATS_STORAGE_KEY, JSON.stringify(updatedCats));
    Alert.alert('已儲存', `${cat.name} 本次體重 ${weightKg.toFixed(1)} kg 已記錄。`);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        <TopNav level={level} onLevelChange={setLevel} cats={indexedCats} activeTab={bottomTab} />
        <ScrollView contentContainerStyle={styles.mainContent}>
          {bottomTab === 'home' && (
            <HomeContent
              level={level}
              onLevelChange={setLevel}
              onOpenModal={openModal}
              cats={indexedCats}
              summaryByCatId={summaryByCatId}
              todayKcal={todayHouseholdKcal}
              todayWater={todayHouseholdWater}
              currentCat={currentCat}
              currentSummary={currentSummary}
              feedingHistory={feeding.ownershipLogs}
              hydrationHistory={hydration.ownershipLogs}
              eliminationHistory={elimination.ownershipLogs}
              medicationHistory={medication.logs}
              symptomHistory={symptoms.logs}
              vesselProfiles={sharedVessels.vesselProfiles}
              onEditCat={() => openEditCat()}
              onRecordPress={(record) => { setSelectedRecord(record); openModal('recordDetail'); }}
            />
          )}
          {bottomTab === 'records' && (
            <RecordsContent
              onOpenModal={openModal}
              feedingHistory={feeding.ownershipLogs}
              hydrationHistory={hydration.ownershipLogs}
              eliminationHistory={elimination.ownershipLogs}
              medicationHistory={medication.logs}
              symptomHistory={symptoms.logs}
              cats={indexedCats}
              onRecordPress={(record) => { setSelectedRecord(record); openModal('recordDetail'); }}
              pendingT1Count={pendingT1VesselIds.length}
              onOpenPendingT1={pendingT1VesselIds.length > 0 ? () => { setCompleteT1VesselId(pendingT1VesselIds[0]); openModal('feeding'); } : undefined}
            />
          )}
          {bottomTab === 'knowledge' && <KnowledgeContent />}
          {bottomTab === 'profile' && (
            <ProfileContent
              cats={indexedCats}
              onOpenModal={openModal}
              onEditCat={openEditCat}
              onOpenVesselCalibration={handleOpenVesselCalibration}
            />
          )}
        </ScrollView>
        <BottomNav activeTab={bottomTab} onTabPress={onBottomTabPress} />
      </View>
      <StatusBar style="dark" />

      {/* 調整：即使相機開啟也保留這些 Modal 在背景，由 GlobalCameraProvider 的相機視圖疊在最上層 */}
      <FeedingModal
        visible={activeModal === 'feeding' || activeModal === 'feedingLateEntry'}
        feeding={feeding}
        cats={indexedCats}
        onClose={closeModal}
        initialMode={completeT1VesselId ? 'complete_t1' : activeModal === 'feedingLateEntry' ? 'late_entry' : 'normal'}
        initialVesselIdForT1={completeT1VesselId ?? undefined}
      />
      <HydrationModal 
        visible={activeModal === 'water'} 
        hydration={hydration} 
              cats={indexedCats}
        onClose={closeModal}
      />
      <EliminationModal
        visible={activeModal === 'elimination'}
        elimination={elimination}
        currentCat={currentCat}
        cats={cats}
        onClose={closeModal}
      />
      <SettingsModal
        visible={activeModal === 'settings'}
        cats={cats}
        onClose={closeModal}
        onSwitchDevDataMode={async (mode) => {
          await applyDevDataMode(mode);
          const storedCats = await AsyncStorage.getItem(CATS_STORAGE_KEY);
          setCats(storedCats ? JSON.parse(storedCats) : []);
          const storedVitals = await AsyncStorage.getItem(VITALS_HISTORY_KEY);
          setVitalsLogs(storedVitals ? JSON.parse(storedVitals) : []);
          await feeding.reloadOwnershipLogs();
          await hydration.reloadOwnershipLogs();
          await elimination.reloadOwnershipLogs();
          await medication.refresh();
          await symptoms.refresh();
        }}
      />
      <BloodReportModal
        visible={activeModal === 'blood'}
        bloodReport={bloodReport}
        currentCat={currentCat}
        onClose={closeModal}
      />
      <BloodHistoryModal
        visible={activeModal === 'bloodHistory'}
        onClose={closeModal}
        reports={bloodReport.savedReports}
        onSelectReport={(report) => {
          setSelectedBloodReport(report);
          openModal('bloodDetail');
        }}
      />
      <BloodReportDetailModal
        visible={activeModal === 'bloodDetail'}
        report={selectedBloodReport}
        onClose={() => openModal('bloodHistory')}
      />
      <KcalAdviceModal
        visible={activeModal === 'kcalAdvice'}
        onClose={closeModal}
        currentKcal={todayHouseholdKcal}
        goalKcal={indexedCats.reduce((sum, c) => sum + calculateDailyKcalGoal(c), 0) || 625}
      />
      <WaterAdviceModal
        visible={activeModal === 'waterAdvice'}
        onClose={closeModal}
        currentWater={todayHouseholdWater}
        goalWater={indexedCats.reduce((sum, c) => sum + calculateAdaptiveDailyWaterGoal(c, getRecentDailyWaterIntakesForCat(c.id)), 0) || 569}
      />
      <BackupModal
        visible={activeModal === 'backup'}
        onClose={closeModal}
        isPro={false}
        onUpgrade={() => openModal('iap')}
      />
      <IAPModal
        visible={activeModal === 'iap'}
        onClose={closeModal}
      />
      <AddCatModal
        visible={activeModal === 'addCat' || activeModal === 'editCat'}
        onClose={closeModal}
        onSave={handleSaveCat}
        initialData={activeModal === 'editCat' ? (selectedCatForEdit ?? currentCat) : null}
        mode={activeModal === 'editCat' ? 'edit' : 'add'}
      />
      <MedicationModal
        visible={activeModal === 'medication'}
        onClose={closeModal}
        cats={cats}
        onSave={(data) => medication.addLog(data)}
      />
      <SymptomModal
        visible={activeModal === 'symptom'}
        onClose={closeModal}
        cats={cats}
        onSave={(data) => symptoms.addLog(data)}
      />
      <RecordDetailModal
        visible={activeModal === 'recordDetail'}
        record={selectedRecord}
        cats={cats}
        onClose={closeModal}
      />
      <WeightRecordModal
        visible={activeModal === 'weightRecord'}
        cats={cats}
        vitalsLogs={vitalsLogs}
        onClose={closeModal}
        onSave={handleSaveWeightRecord}
      />
      <CanLibraryModal
        visible={activeModal === 'canLibrary'}
        canLibrary={feeding.canLibrary}
        onAdd={(item) => { feeding.addCanLibraryItem(item); }}
        onRemove={feeding.removeCanLibraryItem}
        onClose={closeModal}
        launchCamera={launchCamera}
        scanCanLabel={scanCanLabel}
      />
      <FeedLibraryModal
        visible={activeModal === 'feedLibrary'}
        feedLibrary={feeding.feedLibrary}
        onAdd={(item) => { feeding.addFeedLibraryItem(item); }}
        onRemove={feeding.removeFeedLibraryItem}
        onClose={closeModal}
      />
      <VesselCalibrationModal
        visible={vesselCalibrationVisible}
        profiles={sharedVessels.vesselProfiles}
        onClose={() => setVesselCalibrationVisible(false)}
        onSave={sharedVessels.saveVesselProfiles}
        ai={ai}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GlobalCameraProvider>
      <AppMain />
    </GlobalCameraProvider>
  );
}
