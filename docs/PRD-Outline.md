# PAWAWA PRD — 章節大綱（自 PRD.md 擷取）

> 對應完整內容請見 [PRD.md](./PRD.md)  
> Version: 1.2 | Last updated: 2026-03-06

---

## 目錄

1. [系統概覽](#1-系統概覽)
2. [技術架構](#2-技術架構)
3. [導航與狀態管理](#3-導航與狀態管理)
4. [畫面模組](#4-畫面模組)
5. [Modal 模組](#5-modal-模組)
6. [Hooks 層](#6-hooks-層)
7. [AI 服務層](#7-ai-服務層)
8. [資料型別](#8-資料型別)
9. [常數與設定](#9-常數與設定)
10. [工具函式](#10-工具函式)
11. [相機模組](#11-相機模組)
12. [資料持久化](#12-資料持久化)
13. [設計系統](#13-設計系統)
14. [錯誤處理](#14-錯誤處理)

---

## 1. 系統概覽

- 家庭 / 個體兩層看板、AI 影像辨識、臨床摘要、食碗校準、本地優先

---

## 2. 技術架構

- 架構樹：導航 / 畫面 / Modal / Hooks / AI / 資料層
- **相依套件**：expo、expo-camera、expo-image-picker、AsyncStorage、@google/generative-ai
- **AI 服務設定**：EXPO_PUBLIC_AI_SERVICE_MODE、GEMINI_API_KEY、API_BASE_URL

---

## 3. 導航與狀態管理

- **3.1** 層級切換（Level）：household / cat_001 / cat_002
- **3.2** 底部頁籤（BottomTab）：home / records / knowledge / profile
- **3.3** Modal 路由（ActiveModal 列舉）
- **3.4** App 層核心狀態（level、bottomTab、activeModal、cats、vitalsLogs…）
- **3.5** 衍生數據計算（currentCat、summaryByCatId、todayKcal、todayWater）

---

## 4. 畫面模組

- **4.1** HomeContent — 家庭/個體數據與趨勢、家庭成員列表
- **4.2** RecordsContent — 新增記錄下拉、完整紀錄篩選、RecordLogItem
- **4.3** KnowledgeContent — 疾病篩選、照護等級分頁
- **4.4** ProfileContent — 使用者卡、家庭成員、食碗/罐頭/飼料、快捷功能

---

## 5. Modal 模組

- **5.1** FeedingModal — 飲食記錄（食物來源按鈕、T0/T1、自動餵食器/乾糧/罐頭/自煮）
- **5.2** HydrationModal — 飲水記錄（水位標記、輪廓積分）
- **5.3** EliminationModal — 排泄記錄
- **5.4** BloodReportModal — 血液報告掃描與 OCR
- **5.5** MedicationModal — 用藥記錄
- **5.6** SettingsModal — 系統設定
- **5.7** AddCatModal — 新增/編輯貓咪
- **5.8** VesselCalibrationModal — 食碗校準（幾何/側面輪廓/已知容量）
- **5.9** FeedLibraryModal — 飼料設定
- **5.10** CanLibraryModal — 罐頭庫
- **5.11** 其他 Modals（Symptom、WeightRecord、RecordDetail、BloodHistory/Detail、Kcal/WaterAdvice、Backup、IAP）

---

## 6. Hooks 層

- **6.1** useFeeding — T0/T1、result、t0Map、feedLibrary、canLibrary
- **6.2** useHydration — markingImage、confirmMarking、cancelMarking
- **6.3** useElimination
- **6.4** useBloodReport
- **6.5** useMedication
- **6.6** useVessels
- **6.7** useSymptoms
- **6.8** useRecordReminders

---

## 7. AI 服務層

- **7.1** 服務介面（AiRecognitionService）
- **7.2** Gemini Service — feeding、nutrition OCR、hydration、elimination、blood、sideProfile
- **7.3** Mock Service
- **7.4** HTTP Service（自建後端）
- **7.5** 服務選擇邏輯（gemini / http / mock）

---

## 8. 資料型別

- **8.1** Domain Types — CatIdentity、VitalsLog、MedicationLog、ClinicalSummary…
- **8.2** App Types — VesselCalibration、FeedingOwnershipLog、HydrationOwnershipLog、CannedItem、FeedLibraryItem…
- **8.3** AI Types — FeedingVisionResult、NutritionOCRResult、HydrationVisionResult、SideProfileAnalysisResult…
- **8.4** Blood Report Types — BloodMarkerInterpretation、BloodReportRecord

---

## 9. 常數與設定

- AsyncStorage Keys（carecat:cats、feeding:history、vessel_profiles_v1…）
- TTL（FEEDING_T0、HYDRATION_T0）
- Tag 選項、種子庫（DRY_FEED_SEED、WET_CAN_SEED）

---

## 10. 工具函式

- **10.1** 健康計算（health.ts）— RER、每日熱量/飲水目標、體重變化率
- **10.2** 預警生成（alerts.ts）
- **10.3** 臨床摘要（clinicalSummary.ts）
- **10.4** 血液報告解讀（bloodReport.ts）
- **10.5** 容器體積計算（vesselVolume.ts）
- **10.6** 側面輪廓體積計算（profileVolume.ts）

---

## 11. 相機模組

- **11.1** GlobalCameraProvider — launchCamera、isCameraVisible
- **11.2** CustomCamera — 品質、低光、權限
- **11.3** WaterLevelMarker — 碗口/碗底/水面三線標記
- **11.4** 相簿選取（camera.ts）

---

## 12. 資料持久化

- AsyncStorage 鍵值、容量限制（50/30 筆等）、初始化旗標

---

## 13. 設計系統

- 色彩、邊框、間距、核心樣式類（modalBackdrop、modalCard、primaryBtn…）

---

## 14. 錯誤處理

- AI 服務（重試、confidence、逾時、碗位不一致、進食量合理性）
- 相機（權限、取消）
- AsyncStorage（讀寫失敗、T0 損毀）
- 商業邏輯驗證（未選碗、T0 過期、未完成 T1、canIdentifyTags）
