# PAWAWA — Software Design Document (SDD)

> Version: 1.1
> Last updated: 2026-03-05
> Platform: React Native (Expo)
> Language: TypeScript

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

PAWAWA 是一款貓咪健康管理 App，核心功能為：

- 家庭 / 個體兩層看板（household / cat）
- AI 影像辨識：飲食、飲水、排泄、血液報告 OCR
- 臨床摘要自動生成與健康預警
- 食碗校準、藥物紀錄、貓咪照護知識庫
- 本地優先（AsyncStorage），全機離線可用

---

## 2. 技術架構

```
App.tsx (GlobalCameraProvider)
├── 導航層：TopNav (Level Switcher) + BottomNav
├── 畫面層：HomeContent / RecordsContent / KnowledgeContent / ProfileContent
├── Modal 層：17 個 Modal 元件
├── Hooks 層：useFeeding / useHydration / useElimination / useBloodReport / useMedication / useSymptoms / useVessels / useRecordReminders
├── AI 服務層：geminiService / mockAiService (透過 getAiRecognitionService() 統一切換)
└── 資料層：AsyncStorage (本地) + types/domain + types/app
```

### 相依套件

| 套件 | 用途 |
|---|---|
| `expo` | RN 開發框架 |
| `expo-camera` | 相機拍攝 |
| `expo-image-picker` | 從相簿選圖 |
| `@react-native-async-storage/async-storage` | 本地資料持久化 |
| `@google/generative-ai` | Gemini API SDK |

### AI 服務設定

| 環境變數 | 說明 |
|---|---|
| `EXPO_PUBLIC_AI_SERVICE_MODE` | `gemini` / `mock` / `http` |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Gemini API 金鑰 |
| `EXPO_PUBLIC_API_BASE_URL` | 自建後端 URL（mode=http 時使用） |

**目前設定（`.env.local`）：** `gemini-2.5-flash`

---

## 3. 導航與狀態管理

### 3.1 層級切換（Level）

```typescript
type Level = 'household' | 'cat_001' | 'cat_002'
```

- `household`：家庭總覽，顯示所有貓的聚合數據
- `cat_001` / `cat_002`：個體看板，顯示單隻貓咪數據

### 3.2 底部頁籤（BottomTab）

```typescript
type BottomTab = 'home' | 'records' | 'knowledge' | 'profile'
```

| Tab | 圖示 | 說明 |
|---|---|---|
| home | 🏠 | 首頁（健康看板） |
| records | 📝 | 紀錄（新增各類紀錄） |
| knowledge | 📚 | 知識（照護知識庫） |
| profile | 👤 | 個人（設定、報告） |

### 3.3 Modal 路由

```typescript
type ActiveModal =
  | 'feeding'       // 飲食記錄
  | 'water'         // 飲水記錄
  | 'elimination'   // 排泄記錄
  | 'medication'    // 用藥記錄
  | 'symptom'       // 異常症狀記錄
  | 'settings'      // 系統設定
  | 'blood'         // 血液報告掃描
  | 'bloodHistory'  // 血液報告歷史
  | 'bloodDetail'   // 血液報告詳情
  | 'kcalAdvice'    // 熱量建議
  | 'waterAdvice'   // 飲水建議
  | 'backup'        // 備份
  | 'iap'           // 訂閱方案
  | 'addCat'        // 新增貓咪
  | 'editCat'       // 編輯貓咪
  | 'recordDetail'  // 紀錄詳情
  | 'weightRecord'  // 體重記錄
  | null
```

### 3.4 App 層核心狀態

```typescript
level: Level
bottomTab: BottomTab
activeModal: ActiveModal
cats: CatIdentity[]
vitalsLogs: VitalsLog[]
selectedBloodReport: BloodReportRecord | null
```

### 3.5 衍生數據計算（useMemo）

- `currentCat`：根據 level 取得當前貓咪
- `summaryByCatId`：對每隻貓呼叫 `buildClinicalSummary()`
- `todayKcal`：當天所有 FeedingOwnershipLog 的 kcal 加總
- `todayWater`：當天所有 HydrationOwnershipLog 的 totalMl 加總

---

## 4. 畫面模組

### 4.1 HomeContent

**路徑：** `src/components/HomeContent.tsx`

**家庭層顯示：**
- 每日總熱量 vs. 目標（進度條）
- 每日總飲水 vs. 目標（進度條）
- 過去 7 天熱量 / 飲水趨勢圖
- 家庭成員貓咪列表
- 健康預警（所有貓）

**個體層顯示：**
- 當前體重、基準體重、目標體重
- 個體每日熱量目標（RER × 乘數）
- 個體每日飲水目標（50–80 ml/kg，依病況調整）
- 今日用藥
- 慢性病史、飲食限制

**Props 介面：**
```typescript
interface Props {
  level: Level;
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
  onEditCat: () => void;
}
```

### 4.2 RecordsContent

**路徑：** `src/components/RecordsContent.tsx`

**功能：**
- 6 格動作按鈕：飲食 / 飲水 / 排泄 / 體重 / 用藥 / 報告掃描
- 最近 5 筆紀錄（跨類別統一列表）

### 4.3 KnowledgeContent

**路徑：** `src/components/KnowledgeContent.tsx`

- 疾病篩選：`kidney` / `fiv` / `liver` / `general`
- 照護等級分頁：`basic` / `advanced` / `palliative`（general 無 advanced）
- 可展開的 Section → Points → Sub-points

### 4.4 ProfileContent

**路徑：** `src/components/ProfileContent.tsx`

- 使用者資料卡
- 家庭成員格（最多 5 隻貓）
- 快捷功能：訂閱 / 血液報告歷史 / 匯出報告 / 備份 / 通知 / 關於
- App 版本 v1.6

---

## 5. Modal 模組

### 5.1 FeedingModal — 飲食記錄

**路徑：** `src/components/modals/FeedingModal.tsx`
**Hook：** `useFeeding()`

**流程：**

**食物來源與對應流程：**
- **自動餵食器**：不需相機；單一表單合併「今日總克數（可手動修改）」「選擇已存飼料（選填）」「攝取程度」「屬於哪隻貓」「儲存記錄」。不進行 T0/T1 拍照。
- **乾糧一次給一天**、**罐頭**、**自煮**：見下方 ①～⑦（含 T0/T1 或對應表單）。

```
① 選擇食物來源（自動餵食器 / 乾糧一次給一天 / 罐頭 / 自煮）
   └─ 自動餵食器：僅表單輸入，無相機

② 選擇模式（一般 / 精確）— 僅乾糧一次給一天
   └─ 一般：影像估算，誤差 ±20%
   └─ 精確：T0 手動輸入秤重 + T1 影像，誤差 ±8%

③ 選擇食碗（vesselProfiles，需先校準）— 僅乾糧一次給一天 / 罐頭 / 自煮
   └─ 可選擇食物類型（乾飼料 / 罐頭濕食）
   └─ 乾飼料可設定預設份量

④ T₀ 拍攝（裝滿的碗）— 僅乾糧一次給一天
   └─ 精確模式：輸入電子秤克數
   └─ 可選：拍攝空碗俯視照（供 T0/T1 碗位比對）
   └─ 儲存至 t0Map[vesselId]（24hr TTL）

⑤ T₁ 拍攝（剩餘的碗）— 僅乾糧一次給一天
   └─ AI 分析 FeedingVisionResult
   └─ 版本 A（有空碗照片）：估算絕對填充比例（t0FillRatio, t1FillRatio）
   └─ 版本 B（無空碗照片）：估算相對消耗比例（consumedRatio）
   └─ 合理性檢查（> maxPossibleGrams × 1.1 → 警告）
   └─ 碗位一致性檢查（isBowlMatch）

⑥ 歸屬設定
   └─ 家庭（共用）或可辨識貓咪（Tag A/B/C）

⑦ 營養 OCR（選填）
   └─ 掃描飼料標籤 → kcalPerGram / proteinPct / phosphorusPct
   └─ 30s timeout

⑧ 儲存 FeedingOwnershipLog
```

**克數計算邏輯：**

**版本 A（有空碗照片）：**
```typescript
const density = foodType === 'wet' ? 0.95 : 0.45;  // 乾飼料 0.45，罐頭 0.95
const t0Grams = t0FillRatio * vesselVolumeMl * density;
const consumedGrams = consumedRatio * t0Grams;
```

**版本 B（無空碗照片）：**
- 使用離散等級轉換（almost_none / a_little / about_half / more_than_half / almost_all_eaten）
- 根據等級對應的百分比計算克數

### 5.2 HydrationModal — 飲水記錄

**路徑：** `src/components/modals/HydrationModal.tsx`
**Hook：** `useHydration()`

**流程（同 Feeding，附加水位標記）：**

```
① 選擇容器
② T₀ 拍攝 → 顯示 WaterLevelMarker，使用者手動標記三條線（碗口、水位、碗底）
③ T₁ 拍攝 → 顯示 WaterLevelMarker
④ 計算 waterLevelPct = (waterY - rimY) / (bottomY - rimY)
   └─ waterLevelPct = 0 表示滿（水位在碗口）
   └─ waterLevelPct = 1 表示空（水位在碗底）
⑤ 計算水量：
   └─ 有側面輪廓校準：使用輪廓積分計算
   └─ 無側面輪廓：水量 = (1 - waterLevelPct) * volumeMl
⑥ 歸屬設定
⑦ 儲存 HydrationOwnershipLog
```

**計算邏輯：**
- 優先使用使用者標記的 `waterLevelPct`（像素座標轉換）
- 有側面輪廓校準時，使用精確的輪廓積分計算體積
- 無側面輪廓時，使用線性計算（假設圓柱形）
- 蒸發修正：`envFactorMl = (waterT0Ml - waterT1Ml) * 0.02`（2% 蒸發）
- `actualIntakeMl = max(0, waterT0Ml - waterT1Ml - envFactorMl)`

### 5.3 EliminationModal — 排泄記錄

**路徑：** `src/components/modals/EliminationModal.tsx`
**Hook：** `useElimination()`

```
① 拍攝排泄物（貓砂鏟上）
② AI 分析 → Bristol Type 1–7、顏色、形狀、異常旗標
③ 歸屬設定
④ 儲存 EliminationOwnershipLog
```

### 5.4 BloodReportModal — 血液報告掃描

**路徑：** `src/components/modals/BloodReportModal.tsx`
**Hook：** `useBloodReport()`

```
① 拍攝或從相簿選擇報告圖片
② AI OCR → BloodReportOCRResult（markers[]）
③ interpretBloodReport() 對應知識庫
   └─ 分組顯示（CBC / 腎臟 / 肝臟 / 血糖等）
   └─ 每個指標：數值、單位、參考範圍、高/低/正常狀態
④ 儲存至 BloodReportRecord（最多 30 筆）
```

### 5.5 MedicationModal — 用藥記錄

**路徑：** `src/components/modals/MedicationModal.tsx`
**Hook：** `useMedication()`

**欄位：** 貓咪選擇（必填）/ 藥物名稱 / 劑量用法 / 提醒時間 / 備註

### 5.6 SettingsModal — 系統設定

**路徑：** `src/components/modals/SettingsModal.tsx`

- 家庭成員數量顯示
- 匯出家庭背景報告
- 匯出個體摘要報告（14 天趨勢）

### 5.7 AddCatModal — 新增 / 編輯貓咪

**路徑：** `src/components/modals/AddCatModal.tsx`

**欄位：**

| 欄位 | 類型 | 必填 |
|---|---|---|
| 名稱 | string | ✅ |
| 性別 | male / female | ✅ |
| 體重 (kg) | number | ✅ |
| 年齡 | number | ➖ |
| 絕育 | boolean | ➖ |
| 活動量 | low / normal / high | ➖ |
| 體態 | underweight / ideal / overweight | ➖ |
| 慢性病 | multi-select | ➖ |

**慢性病選項：** CKD / 糖尿病 / 甲狀腺亢進 / 肥胖 / FIP / 心臟病 / IBD / 氣喘 / FLUTD

### 5.8 VesselCalibrationModal — 食碗校準

**路徑：** `src/components/modals/VesselCalibrationModal.tsx`
**Hook：** `useVessels()`

**三種輸入方式：**

#### 方式 1：測量尺寸（幾何計算）
| 形狀 | 欄位 | 公式 |
|---|---|---|
| cylinder（圓柱） | radius（直徑）, height | `V = π × (直徑/2)² × 高度` |
| trapezoid（梯形/長方體） | length, width, height | `V = 長 × 寬 × 高` |
| sphere（圓台） | topRadius（頂直徑）, bottomRadius（底直徑）, height | `V = (π × h / 3) × (R² + R×r + r²)` |

#### 方式 2：側面輪廓（AI 識別，最準確）
- 拍攝側面照（從正側面拍攝空碗）
- 輸入碗口直徑和碗高度
- AI 識別輪廓並計算體積（誤差 ±3-5%）
- 支援高度校正和實測校準係數

#### 方式 3：已知容量（直接輸入）
- 直接輸入容器標示的容量（毫升）
- 適合飲水機等大型容器

**其他設定：**
- 容器用途：食碗（`feeding`）或水碗（`hydration`）
- 食物類型：乾飼料（`dry`）或罐頭濕食（`wet`）
- 乾飼料可設定預設份量（`defaultPortionGrams`）
- 空碗俯視照（供 T0/T1 碗位比對使用）
- iOS：提供「使用量尺 App 測量」捷徑

**食碗容器類型與滿量基準：**
- 食碗可選「食碗模式」（一般碗）或「自動餵食器模式」。
- **自動餵食器模式**：僅需設定每份克數（`defaultPortionGrams`）、每日出糧次數（`dailyPortionCount`），**不需滿量基準校準**；記錄流程依出糧次數與每份克數計算。
- **滿量基準**（`fullWaterCalibration`）：用於水碗／飲水機；食碗模式（一般碗）若需 T0/T1 視覺換算可選用。自動餵食器模式不使用滿量基準。

**自動重新計算：**
- 側面輪廓模式：當使用者改變數值或重新拍攝時，自動清除 AI 計算結果並提示重新計算

### 5.9 其他 Modals

| Modal | 用途 |
|---|---|
| SymptomModal | 異常症狀記錄（嚴重度：mild / moderate / severe） |
| WeightRecordModal | 體重記錄（更新貓咪體重並建立 VitalsLog） |
| RecordDetailModal | 紀錄詳情檢視（統一檢視各類紀錄） |
| BloodHistoryModal | 血液報告歷史列表 |
| BloodReportDetailModal | 血液報告詳細解讀 |
| KcalAdviceModal | 熱量不足建議 |
| WaterAdviceModal | 飲水不足建議 |
| BackupModal | 資料備份說明（免費版限制） |
| IAPModal | 訂閱方案介紹（功能開發中） |

---

## 6. Hooks 層

### 6.1 useFeeding

**路徑：** `src/hooks/useFeeding.ts`

| 狀態 | 類型 | 說明 |
|---|---|---|
| `t0Done` | boolean | T₀ 是否有效（24hr 內） |
| `t1Done` | boolean | T₁ 分析完成 |
| `result` | FeedingVisionResult \| null | AI 分析結果 |
| `nutritionResult` | NutritionOCRResult \| null | 營養標籤 OCR 結果 |
| `t0Map` | Record\<vesselId, StoredFeedingT0\> | 各容器的 T₀ 快照 |
| `precisionMode` | 'standard' \| 'precise' | 精度模式 |
| `mismatchError` | string \| null | 碗位不一致錯誤訊息 |
| `isAnalyzing` | boolean | AI 分析中 |

**重試邏輯：** 最多 3 次，間隔 `800ms × attempt`，`confidence < 0.6` 繼續重試

**合理性檢查（SDD 2.5）：**
`householdTotalGram > maxPossibleGrams × 1.1` → 顯示警告，要求重拍

### 6.2 useHydration

**路徑：** `src/hooks/useHydration.ts`

| 額外狀態 | 說明 |
|---|---|
| `markingImage` | 等待使用者標記水位的圖片 |
| `confirmMarking(yPct)` | 使用者確認水位後送 AI |
| `cancelMarking()` | 取消標記 |

### 6.3 useElimination

**路徑：** `src/hooks/useElimination.ts`
單張影像流程，保留最新 50 筆。

### 6.4 useBloodReport

**路徑：** `src/hooks/useBloodReport.ts`
支援相機 / 相簿兩種輸入源，OCR 重試 3 次，最多儲存 30 筆報告。

### 6.5 useMedication

**路徑：** `src/hooks/useMedication.ts`
CRUD 操作，對應 `carecat:medication_v1`。

### 6.6 useVessels

**路徑：** `src/hooks/useVessels.ts`
管理 VesselCalibration 陣列，提供選取與儲存功能。
- 載入時自動重新計算所有容器體積（修正可能存在的錯誤計算）
- 選取容器時確保體積正確計算

### 6.7 useSymptoms

**路徑：** `src/hooks/useSymptoms.ts`
管理異常症狀記錄（SymptomLog），支援嚴重度分級（mild / moderate / severe）。

### 6.8 useRecordReminders

**路徑：** `src/hooks/useRecordReminders.ts`
飲食/飲水紀錄提醒（上午 8:00、傍晚 18:00），使用 `expo-notifications`。

---

## 7. AI 服務層

### 7.1 服務介面

**路徑：** `src/types/ai.ts`

```typescript
interface AiRecognitionService {
  analyzeFeedingImages(input: { t0, t1, vessel? }): Promise<FeedingVisionResult>
  analyzeWithMajorityVote?(input: { t0, t1, vessel? }): Promise<FeedingMajorityVoteResult>
  extractNutritionLabel(input: AiImageInput): Promise<NutritionOCRResult>
  analyzeHydrationImages(input: { t0, t1, vessel?, t0LevelYPct?, t1LevelYPct? }): Promise<HydrationVisionResult>
  analyzeEliminationImage(input: AiImageInput): Promise<EliminationVisionResult>
  extractBloodReport(input: AiImageInput): Promise<BloodReportOCRResult>
  analyzeSideProfile?(input: { imageBase64: string; rimDiameterCm: number }): Promise<SideProfileAnalysisResult>
}
```

### 7.2 Gemini Service

**路徑：** `src/services/ai/geminiService.ts`
**模型：** `gemini-2.5-flash`
**格式：** `responseMimeType: 'application/json'`
**圖片輸入：** base64 inline data

| 功能 | Prompt 重點 | 計算邏輯 |
|---|---|---|
| `analyzeFeedingImages` | **版本 A（有空碗）**：估算絕對填充比例（t0FillRatio, t1FillRatio），計算 consumedRatio = t0FillRatio - t1FillRatio<br>**版本 B（無空碗）**：T0/T1 相對對比，估算消耗比例 | **版本 A**：`t0Grams = t0FillRatio × volumeMl × density`，`consumedGrams = consumedRatio × t0Grams`<br>**版本 B**：使用離散等級轉換（almost_none / a_little / about_half / more_than_half / almost_all_eaten） |
| `extractNutritionLabel` | 從飼料標籤萃取 kcal/g、蛋白質%、磷% | - |
| `analyzeHydrationImages` | 若有 waterLevelPct 則優先使用人工標記，否則視覺估算；計算蒸發修正 | 有側面輪廓：使用輪廓積分計算<br>無側面輪廓：`水量 = (1 - waterLevelPct) × volumeMl` |
| `analyzeEliminationImage` | Bristol Scale 1–7，回傳繁體中文（zh-TW） | - |
| `extractBloodReport` | OCR 血液報告，萃取指標代碼、數值、單位、參考範圍 | - |
| `analyzeSideProfile` | 側面輪廓識別，重建碗的實際截面形狀 | 使用數值積分計算體積 |

### 7.3 Mock Service

**路徑：** `src/services/ai/mockAiService.ts`
- 根據圖片 URI hash 產生一致性假資料
- 模擬 500–1500ms 延遲
- 用於開發 / 測試階段（`AI_SERVICE_MODE=mock`）

### 7.4 HTTP Service（自建後端）

**路徑：** `src/services/ai/index.ts`
- `AI_SERVICE_MODE=http` 時啟用
- 自動偵測 Expo LAN host 作為 baseUrl
- 端點：`POST /ai/feeding` / `/ai/nutrition-ocr` / `/ai/hydration` / `/ai/elimination` / `/ai/blood-ocr`

### 7.5 服務選擇邏輯

```typescript
// src/services/ai/index.ts
const AI_SERVICE_MODE = process.env.EXPO_PUBLIC_AI_SERVICE_MODE || 'mock'

getAiRecognitionService():
  'gemini' → geminiService       ← 目前使用
  'http'   → createHttpAiService(baseUrl)
  default  → mockAiService
```

---

## 8. 資料型別

### 8.1 Domain Types（`src/types/domain.ts`）

```typescript
type Gender = 'male' | 'female' | 'unknown'

type ChronicCondition =
  'ckd' | 'diabetes' | 'hyperthyroidism' | 'obesity' |
  'fip' | 'heart_disease' | 'ibd' | 'asthma' | 'flutd' | 'other'

interface CatIdentity {
  id: string
  name: string
  birthDate: string
  gender: Gender
  spayedNeutered: boolean
  baselineWeightKg: number
  currentWeightKg: number
  targetWeightKg: number
  bcsScore: number           // 1–9 體態分數
  chronicConditions: ChronicCondition[]
  allergyWhitelist: string[]
  allergyBlacklist: string[]
}

interface VitalsLog {
  id: string
  catId: string
  weightKg: number
  temperatureC: number
  medicineFlag: boolean
  timestamp: string          // ISO 8601
}

interface MedicationLog {
  id: string
  catId: string
  medicationName: string
  dosage: string
  reminderTime?: string
  completedAt?: string
  notes?: string
  createdAt: number          // Unix ms
}

type AlertType = 'allergy' | 'weight' | 'fever' | 'intake' | 'hydration'
type AlertSeverity = 'low' | 'medium' | 'high'

interface MedicalAlert {
  alertId: string
  catId: string
  type: AlertType
  severity: AlertSeverity
  message: string
  timestamp: string
}

interface ClinicalSummary {
  catId: string
  periodDays: number
  avgTemperatureC: number
  totalKcalIntake: number
  totalActualWaterMl: number
  todayKcalIntake: number  // 今日攝取熱量（僅當日紀錄）
  todayWaterMl: number  // 今日飲水量（僅當日紀錄）
  weeklyWeightChangeRatePct: number
  medicationLogs: MedicationLog[]
  alerts: MedicalAlert[]
}
```

### 8.2 App Types（`src/types/app.ts`）

```typescript
type FeedingPrecisionMode = 'standard' | 'precise'
type VesselShape = 'cylinder' | 'trapezoid' | 'sphere'
type FeedingOwnershipType = 'household_only' | 'household_and_tag'

interface CapturedImage {
  uri: string
  imageBase64: string
  mimeType: string
}

interface VesselCalibration {
  id: string
  name: string
  vesselType?: 'feeding' | 'hydration'  // 容器用途
  shape: VesselShape
  dimensions: {
    length?: number; width?: number; height: number
    radius?: number; topRadius?: number; bottomRadius?: number
  }
  volumeMl?: number
  calibrationFactor?: number  // 校準係數
  measuredVolumeMl?: number  // 實際測量容量
  calibrationMethod?: 'dimensions' | 'side_profile' | 'known_volume'
  sideProfileImageBase64?: string  // 側面照
  rimDiameterCm?: number  // 碗口直徑
  profileContour?: ProfileContour  // 輪廓數據
  topViewImageBase64?: string  // 空碗俯視照
  foodType?: 'dry' | 'wet'  // 食物類型
  defaultPortionGrams?: number  // 乾飼料預設份量
}

interface StoredFeedingT0 extends CapturedImage {
  capturedAt: number
  manualWeight?: number
  vesselId?: string
}

interface FeedingOwnershipLog {
  id: string
  createdAt: number
  totalGram: number
  kcal?: number
  ownershipType: FeedingOwnershipType
  selectedTagId: string | null
  mode: FeedingPrecisionMode
  confidence?: number  // AI 辨識信心度
  vesselId?: string  // 使用的容器 ID
  note?: string  // 使用者備註
}

interface HydrationOwnershipLog {
  id: string
  createdAt: number
  totalMl: number
  actualWaterMl?: number
  ownershipType: FeedingOwnershipType
  selectedTagId: string | null
}

interface EliminationOwnershipLog {
  id: string
  createdAt: number
  bristolType: number
  color: string
  abnormal: boolean
  selectedTagId: string | null
}

interface SymptomLog {
  id: string
  catId: string
  symptom: string
  severity: 'mild' | 'moderate' | 'severe'
  observedAt?: string
  notes?: string
  createdAt: number
}
```

### 8.3 AI Types（`src/types/ai.ts`）

```typescript
interface AiImageInput {
  imageRef?: string
  imageBase64?: string
  mimeType?: string
  uri?: string
  capturedAt?: number
  waterLevelPct?: number
}

interface FeedingVisionResult {
  bowlsDetected: number
  assignments: { bowlId: string; tag: string; estimatedIntakeGram: number }[]
  householdTotalGram: number
  consumedRatio?: number  // 0~1，消耗比例
  consumptionLevel?: ConsumptionLevel  // 離散分級（版本 B 使用）
  isBowlMatch: boolean
  mismatchReason?: string
  confidence?: number  // 0.0–1.0
  estimatedErrorMargin?: number  // AI 估算誤差範圍（0.08-0.20）
  preCheck?: FeedingPreCheck
}

interface NutritionOCRResult {
  kcalPerGram: number
  proteinPct: number
  phosphorusPct: number
  rawText: string
}

interface HydrationVisionResult {
  waterT0Ml: number
  waterT1Ml: number
  tempC: number
  humidityPct: number
  envFactorMl: number
  actualIntakeMl: number
  isBowlMatch: boolean
  mismatchReason?: string
  confidence?: number
}

interface EliminationVisionResult {
  color: string
  bristolType: 1 | 2 | 3 | 4 | 5 | 6 | 7
  shapeType: string
  abnormal: boolean
  confidence: number
  note: string
}

interface BloodMarkerRaw {
  code: string
  value: number
  unit: string
  refLow?: number
  refHigh?: number
}

interface BloodReportOCRResult {
  markers: BloodMarkerRaw[]
  reportDate?: string
  labName?: string
  confidence?: number
}

interface SideProfileAnalysisResult {
  contour: ProfileContour
  confidence: number
  estimatedHeightCm?: number
  estimatedVolumeMl?: number
}
```

### 8.4 Blood Report Types（`src/types/bloodReport.ts`）

```typescript
type BloodCategory =
  'cbc_rbc' | 'cbc_wbc' | 'cbc_plt' | 'kidney' | 'liver' |
  'glucose' | 'protein' | 'electrolyte' | 'pancreas' |
  'endocrine' | 'infectious' | 'urine' | 'coagulation' | 'other'

type BloodMarkerStatus = 'high' | 'low' | 'normal' | 'unknown'

interface BloodMarkerInterpretation {
  code: string
  nameZh: string; nameEn: string
  category: BloodCategory
  value: number; unit: string; refRange: string
  status: BloodMarkerStatus
  description: string
  context?: string
}

interface BloodReportRecord {
  id: string
  catId: string
  reportDate: string
  photoUri: string
  interpretations: BloodMarkerInterpretation[]
  createdAt: number
}
```

---

## 9. 常數與設定

**路徑：** `src/constants/index.ts`

### AsyncStorage Keys

| Key | 說明 |
|---|---|
| `carecat:cats` | 貓咪檔案陣列 |
| `carecat:vitals:history` | VitalsLog 陣列 |
| `carecat:feeding:t0` | T₀ 快照（24hr TTL） |
| `carecat:feeding:history` | FeedingOwnershipLog 陣列 |
| `carecat:food:nutrition` | 最後一次 OCR 營養結果 |
| `carecat:hydration:t0` | T₀ 快照（24hr TTL） |
| `carecat:hydration_v3` | HydrationOwnershipLog 陣列 |
| `carecat:elimination_v1` | EliminationOwnershipLog 陣列（最多 50 筆） |
| `carecat:medication_v1` | MedicationLog 陣列 |
| `carecat:symptom_v1` | SymptomLog 陣列 |
| `carecat:blood-reports` | BloodReportRecord 陣列（最多 30 筆） |
| `carecat:vessel_profiles_v1` | VesselCalibration 陣列 |
| `carecat:initial_clear` | 初始化旗標 |

### TTL

```typescript
FEEDING_T0_TTL_MS  = 24 * 60 * 60 * 1000   // 24 小時
HYDRATION_T0_TTL_MS = 24 * 60 * 60 * 1000  // 24 小時
```

### Tag 選項

```typescript
FEEDING_TAG_OPTIONS = [
  { id: 'A', label: 'Tag A' },
  { id: 'B', label: 'Tag B' },
  { id: 'C', label: 'Tag C' },
]
```

---

## 10. 工具函式

### 10.1 健康計算（`src/utils/health.ts`）

```typescript
// 靜止能量需求
calculateRER(weightKg): number
  → 70 × weightKg^0.75

// 每日熱量目標（考量疾病 / 絕育 / 活動量）
calculateDailyKcalGoal(cat: CatIdentity): number
  → 甲狀腺亢進：RER × 1.6
  → 肥胖：RER × 0.8
  → 絕育：RER × 1.2，未絕育：RER × 1.4

// 每日飲水目標
calculateDailyWaterGoal(cat: CatIdentity): number
  → 標準：50 ml/kg（依年齡調整：幼貓 55 ml/kg，老貓 45 ml/kg）
  → CKD：50 ml/kg（顯示範圍 40-60 ml/kg）
  → 糖尿病：顯示範圍 50-70 ml/kg
  → FLUTD：顯示範圍 50-65 ml/kg

// 適應性每日飲水目標（根據最近飲水量調整）
calculateAdaptiveDailyWaterGoal(cat: CatIdentity, recentDailyIntakesMl: number[]): number
  → 根據最近 7 天的飲水量趨勢，動態調整目標值
  → 如果最近飲水量持續低於目標，適度降低目標值
  → 如果最近飲水量持續高於目標，適度提高目標值

// 實際飲水量
calculateActualWaterIntakeMl(t0, t1, envFactor): number
  → max(0, T0 - T1 - envFactor)

// 每週體重變化率
calculateWeeklyWeightChangeRatePct(current, weekAgo): number
```

### 10.2 預警生成（`src/utils/alerts.ts`）

| 函式 | 觸發條件 | 嚴重度 |
|---|---|---|
| `checkTemperatureAlert` | 體溫 < 37.5°C 或 > 39.5°C | high |
| `checkIntakeAlert` | 攝入 < BMR × 70% | medium |
| `checkWeeklyWeightAlert` | 週體重變化 < -2% | high |
| checkHydrationAlert | 飲水 < 目標 × 70% | medium |

### 10.3 臨床摘要（`src/services/clinicalSummary.ts`）

```typescript
buildClinicalSummary(cat, vitals, feedings, hydrations, meds): ClinicalSummary
```

- 過濾各 log 陣列的 catId
- 計算平均體溫、累積熱量、累積飲水
- 計算週體重變化率
- 呼叫各 check 函式生成 MedicalAlert[]

### 10.4 血液報告解讀（`src/services/bloodReport.ts`）

```typescript
interpretBloodReport(markers: BloodMarkerRaw[]): BloodMarkerInterpretation[]
```

- 對應 `KNOWLEDGE_MAP`（`src/data/bloodReportKnowledge.ts`）
- 100+ 指標知識庫，涵蓋中英文名稱、類別、描述、高低值說明
- 根據 refLow / refHigh 判斷 high / low / normal / unknown

### 10.5 容器體積計算（`src/utils/vesselVolume.ts`）

```typescript
calculateVesselVolume(vessel: VesselCalibration): number | undefined
```

**計算優先順序：**
1. 已知容量模式：直接返回 `volumeMl`
2. 側面輪廓模式：使用輪廓積分計算（`calculateTotalVolumeFromContour`）
3. 幾何尺寸模式：根據形狀使用標準幾何公式

**支援的容器形狀：**
- `cylinder`：圓柱體 `V = π × r² × h`
- `trapezoid`：長方體 `V = l × w × h`
- `sphere`：圓台（截頭圓錐）`V = (π × h / 3) × (R² + R×r + r²)`

### 10.6 側面輪廓體積計算（`src/utils/profileVolume.ts`）

```typescript
calculateVolumeFromContour(contour, waterLevelTopCm, waterLevelBottomCm): number
calculateTotalVolumeFromContour(contour): number
calculateVolumeToWaterLevel(contour, waterLevelPct): number
```

- 使用數值積分：`V = ∫[bottom to top] π × r(y)² dy`
- 步長：0.1cm
- 支援線性插值從輪廓點陣列取得各高度的半徑

---

## 11. 相機模組

### 11.1 GlobalCameraProvider

**路徑：** `src/components/GlobalCameraProvider.tsx`

- 全域 Context，包裹整個 App
- 提供 `launchCamera(title): Promise<CapturedImage | null>`
- 統一管理相機 Modal 可見性
- 所有 hook 透過 `useGlobalCamera()` 呼叫

```typescript
interface CameraContextProps {
  launchCamera: (title: string) => Promise<CapturedImage | null>
  isCameraVisible: boolean
}
```

### 11.2 CustomCamera

**路徑：** `src/components/CustomCamera.tsx`

| 設定 | 值 |
|---|---|
| 影像品質 | 0.3（30%，節省傳輸量） |
| base64 | 啟用 |
| 低光閾值 | MIN_LUX = 50 lux |
| 前後鏡頭 | 可切換 |
| 縮放 | 可調整 |

- 低光時顯示警告文字
- 使用 `useCameraPermissions()` 管理權限
- 支援內嵌模式（在 Modal 內顯示，不透過全域 Context）

### 11.3 WaterLevelMarker — 水位標記工具

**路徑：** `src/components/WaterLevelMarker.tsx`

- 使用者手動拖動三條線：碗口（綠色）、碗底（橙色）、水面（藍色）
- 計算 `waterLevelPct = (waterY - rimY) / (bottomY - rimY)`
  - `waterLevelPct = 0`：滿（水位在碗口）
  - `waterLevelPct = 1`：空（水位在碗底）
- 回傳像素座標（`bowl_top_y`, `bowl_bottom_y`, `water_y`）供純數學計算

### 11.4 相簿選取（`src/utils/camera.ts`）

```typescript
pickFromLibrary(): Promise<CapturedImage | null>
```

- 請求媒體庫權限
- 回傳 base64 編碼圖片
- 取消或權限拒絕時回傳 null

---

## 12. 資料持久化

**所有資料儲存於 AsyncStorage（本地，離線可用）**

```
App 啟動
  ↓
讀取 carecat:cats → cats[]
讀取 carecat:vitals:history → vitalsLogs[]
讀取 carecat:feeding:history → feedingLogs[]（各 hook 自行讀取）
...
  ↓
初始化旗標 carecat:initial_clear
  └─ 首次啟動：清空舊資料
```

**容量限制：**
- 排泄紀錄：最多 50 筆
- 血液報告：最多 30 筆
- 飲食紀錄：最多 50 筆（FeedingOwnershipLog）
- 飲水紀錄：最多 50 筆（HydrationOwnershipLog）
- 用藥紀錄：無限制
- 症狀紀錄：無限制

---

## 13. 設計系統

**路徑：** `src/styles/common.ts`

### 色彩

| 用途 | 色碼 |
|---|---|
| 主色（文字、邊框、按鈕） | `#000000` |
| 背景 | `#ffffff` |
| 次要文字 | `#666666` |
| 成功（T₀ 完成） | `#22c55e` / `#f0fdf4` |
| 危險（預警） | `#d32f2f` |
| 資訊 | `#1976d2` / `#e3f2fd` |
| 警告 | `#856404` / `#fff3cd` |

### 邊框規範

- 主要卡片：`borderWidth: 2, borderColor: '#000'`
- 輸入框：`borderWidth: 1`
- 激活狀態：`backgroundColor: '#000', color: '#fff'`

### 間距

- 標準 padding：16
- 元素間距：8
- Section margin bottom：16–24

### 核心樣式類

| 類別 | 用途 |
|---|---|
| `modalBackdrop` | 半透明遮罩 |
| `modalCard` | 90% 寬 Modal 容器 |
| `cardBlock` | 主要內容卡片 |
| `actionGrid` | 6 格動作按鈕 |
| `choiceRow` | 選項按鈕列 |
| `primaryBtn` | 主要操作按鈕 |
| `aiResult` | AI 分析結果區塊 |
| `infoBox` | 資訊提示區塊 |
| `cameraUpload` | 相機觸發按鈕 |

---

## 14. 錯誤處理

### AI 服務

| 情境 | 處理 |
|---|---|
| API 呼叫失敗 | 重試 3 次，間隔 800ms × attempt |
| confidence < 0.6 | 繼續重試，最終拋出錯誤 |
| 30s 逾時（OCR） | Promise.race 超時 reject |
| JSON 解析失敗 | `safeJsonParse` 清除 markdown 後重試，失敗時拋出 |
| 碗位不一致 | 顯示 mismatchReason，要求重拍 |
| 進食量不合理 | > maxPossibleGrams × 1.1 → 警告 Alert |

### 相機

| 情境 | 處理 |
|---|---|
| 權限拒絕 | 顯示說明畫面 |
| 相機不可用 | Alert 通知 |
| 使用者取消 | 回傳 null，不影響流程 |

### AsyncStorage

| 情境 | 處理 |
|---|---|
| 讀取失敗 | catch 後回傳空陣列 / null |
| T₀ 資料損毀 | `removeItem` 清空後繼續 |
| 寫入失敗 | 靜默記錄，不中斷 UI |

### 商業邏輯驗證

| 情境 | 處理 |
|---|---|
| 未選食碗就拍照 | Alert 要求先選碗 |
| T₀ 過期（> 24hr） | Alert 要求重新拍攝 T₀ |
| 未完成 T₁ 就儲存 | Alert 阻止儲存 |
| canIdentifyTags 未設定 | Alert 阻止儲存 |
