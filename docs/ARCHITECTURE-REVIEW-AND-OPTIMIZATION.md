# PAWAWA 程式碼架構檢視與優化建議

> 檢視範圍：app 目錄下之架構、狀態、儲存、服務與元件組織。  
> 目的：在維持功能對等前提下，提出可維護性、一致性與擴充性之改進建議。

---

## 一、目前架構概覽

### 1.1 目錄結構（精簡）

```
app/
├── api/                    # 後端 API（Vercel serverless，.js）
│   ├── _lib/ai.js
│   └── ai/*.js             # feeding, hydration, elimination, side-profile, blood-ocr, nutrition-ocr
├── src/
│   ├── types/              # app.ts, domain.ts, ai.ts, bloodReport.ts
│   ├── constants/          # storage keys, LEVEL_ITEMS, BOTTOM_ITEMS, seeds
│   ├── storage/            # feedingStorage, hydrationStorage, migration
│   ├── hooks/              # useFeeding, useHydration, useVessels, useElimination, useMedication, useSymptoms, useBloodReport, useRecordReminders
│   ├── services/           # ai (index, gemini, mock), bloodReport, canLabelScanApi, clinicalSummary, mockData
│   ├── utils/              # health, date, vesselVolume, profileVolume, camera, catScope, hydrationUtils, alerts, ...
│   ├── algorithms/         # feedingBounds（含單測）
│   ├── data/               # careKnowledge, bloodReportKnowledge
│   ├── config/             # devDataMode
│   ├── styles/             # common.ts（palette + StyleSheet）
│   ├── components/         # TopNav, BottomNav, *Content, modals/*, CustomCamera, TrendChart, ...
│   └── screens/            # *Screen 薄層，主要邏輯在 Content + App
└── App.tsx                 # 根：state、modal 控制、資料載入、所有 Content 與 Modal 渲染
```

### 1.2 資料流概觀

- **全域／導航**：`level`、`bottomTab`、`activeModal` 在 `App.tsx` 以 `useState` 管理。
- **領域資料**：`cats`、`vitalsLogs` 在 App 手動 `AsyncStorage` 讀寫；`feeding`、`hydration`、`elimination`、`medication`、`symptoms`、`bloodReport` 由各自 hook 內建 state + 儲存。
- **食碗**：`useVessels()` 在 App 呼叫一次，將 `sharedVessels` 傳給 `useFeeding`、`useHydration` 與 `VesselCalibrationModal`；`useFeeding` 內部另有 fallback 的 `useVessels()`（vesselsFromParent ?? vesselsInternal）。

---

## 二、優化建議（依優先度與影響範圍）

### 2.1 高優先：狀態與資料層一致化

| 項目 | 現況 | 建議 |
|------|------|------|
| **cats / vitals 儲存** | App 內直接 `AsyncStorage.getItem/setItem` + `setCats` / `setVitalsLogs`，遷移在 `useEffect` 裡動態 import migration | 抽成 **`useCats`**、**`useVitals`**（或 `useVitalsHistory`）hook：內部負責 load/save/error，App 只消費 `{ cats, setCats, saveCat, ... }`。遷移仍在 App 啟動時跑一次，但資料讀寫與 hook 一致。 |
| **Vessels 單一來源** | App 呼叫 `useVessels()` 並注入 `vesselsFromParent` 給 useFeeding/useHydration；useFeeding 內還有 `vesselsInternal = useVessels()` | 改為 **單一來源**：僅在 App（或一層 `AppDataProvider`）呼叫 `useVessels()`，透過 **Context** 提供給 FeedingModal、HydrationModal、VesselCalibrationModal。useFeeding/useHydration 只從 context 取 vessels，不再接受 `vesselsFromParent` 也不內部 useVessels。可避免雙實例與 key 重複寫入。 |

### 2.2 高優先：減輕 App.tsx 職責

| 項目 | 現況 | 建議 |
|------|------|------|
| **App 體積** | 約 500 行：state、useMemo、所有 Modal、openModal/closeModal、handleSaveCat、handleSaveWeightRecord、Web 縮放鎖定、遷移與載入 | 1) **Modal 註冊表**：用一個 `activeModal` + `modalProps` 的 map 或 switch 渲染單一 `<ModalRouter />`，減少 App 內重複的 `<XModal visible={...} onClose={...} />`。 2) **貓咪／體重儲存**：遷移到 useCats / useVitals 後，App 不再直接握有 `setCats`/AsyncStorage。 3) **計算與衍生資料**：`summaries`、`summaryByCatId`、`todayHouseholdKcal`、`todayHouseholdWater`、`currentCat` 可遷到自訂 hook（如 `useAppSummaries(cats, vitalsLogs, feeding, hydration, medication)`）或 Context，讓 App 只做組合與導航。 |

### 2.3 中優先：儲存層與錯誤處理一致

| 項目 | 現況 | 建議 |
|------|------|------|
| **AsyncStorage 使用處** | 分散在 App、各 hook、storage/feedingStorage、storage/hydrationStorage、migration、devDataMode | **原則**：業務邏輯只呼叫 `storage/*` 或單一 **storage adapter**；hook 不直接 `AsyncStorage.getItem/setItem`（除 migration 與明確的「一次寫入」）。adapter 可統一 try/catch、log、可選的 user-facing 錯誤（Toast/Alert）。 |
| **錯誤處理** | 有的僅 `console.error`，有的 `Alert.alert`，儲存失敗多數只 log | 訂一個簡單約定：**儲存失敗**一律至少 log；若為「使用者主動寫入」則可選 Toast 或 Alert。在 storage adapter 或各 `save*` 函式內統一實作。 |

### 2.4 中優先：巨型元件拆分

| 檔案 | 行數 | 建議 |
|------|------|------|
| **VesselCalibrationModal.tsx** | ~1667 | 依「用途＋容器類型」拆成子元件或 steps：例如 `VesselFormBasic`（名稱、用途、容器類型）、`VesselFormFeedingBowl`、`VesselFormHydrationBowl`、`VesselFormSideProfile`、`VesselFormDimensions`、`VesselList`。Modal 本體只負責 visible/onClose/onSave 與 step 切換。 |
| **FeedingModal.tsx** | ~1478 | 依流程拆：`FeedingStepVessel`、`FeedingStepFoodType`、`FeedingStepT0`、`FeedingStepT1`、`FeedingStepResult`、`FeedingLateEntryView` 等，由一層 `FeedingModal` 管理 step 與共用 state（或沿用現有 useFeeding 的 state）。 |

好處：單檔變短、易做 code review、子元件有機會單獨測試或重用。

### 2.5 中優先：型別與常數整理

| 項目 | 現況 | 建議 |
|------|------|------|
| **types/app.ts** | 體積大，含 UI 用型別、領域型別、常數（INTAKE_LEVEL_LABEL 等） | 可拆成 `app/types/feeding.ts`、`app/types/vessel.ts`、`app/types/ui.ts` 等，`app.ts` 只 re-export；或維持單檔但用區塊註解分區。 |
| **constants/index.ts** | `LEVEL_ITEMS` 含硬編碼 `cat_001`/`cat_002`，但 TopNav 已用 `getScopedCats(cats)` 動態生成 | 移除 `LEVEL_ITEMS` 中靜態貓咪項，或改為「僅 household + 說明由 TopNav 動態生成」；避免誤用靜態 key。 |
| **domain vs app** | 領域實體（CatIdentity, MedicationLog…）在 domain；UI/流程（ActiveModal, CapturedImage, StoredFeedingT0…）在 app | 維持分離；若未來有共用 DTO（例如 API 請求/回應），可考慮 `types/api.ts` 或放在對應 service 旁。 |

### 2.6 較低優先：測試與 API

| 項目 | 現況 | 建議 |
|------|------|------|
| **單元測試** | 僅 `algorithms/feedingBounds`、`utils/health` 有測試 | 為 **storage/feedingStorage**、**storage/hydrationStorage** 加單測（mock AsyncStorage）；為 **vesselVolume**、**hydrationMath** 等純函式加單測；可選為 **useFeeding**/useHydration 關鍵路徑寫整合測試（mock ai + storage）。 |
| **app/api** | 為 .js，邏輯與 `services/ai` 前端呼應 | 若時間允許可改 TypeScript 或至少為關鍵函式加 JSDoc + @param/@returns，方便與前端型別對齊。 |

### 2.7 小改動：即時可做

| 項目 | 位置 | 建議 |
|------|------|------|
| **loadErrorToast 樣式** | App.tsx 內 `sharedVessels.loadErrorToast` 的 View/Text 使用 `#fee2e2`、`#fca5a5`、`#991b1b` | 改為 `palette.dangerBg`、`palette.dangerText`（或 palette.border）與 `styles.messageBoxDanger*`，與 UI 一致化一致。 |
| **重複的「從 AsyncStorage 載入 → setState」** | 多個 hook 內類似 `getItem → parse → setXxx` | 可抽成共用 **`useStorageState<T>(key, defaultVal, serialize/deserialize)`**，減少重複並統一錯誤處理。 |

---

## 三、建議實作順序（不強制）

1. **Vessels 單一來源 + Context**：避免雙 useVessels、釐清資料流。  
2. **useCats / useVitals**：把 cats、vitalsLogs 的 load/save 移出 App，與其他 hook 模式一致。  
3. **App 精簡**：Modal 路由化或抽成 `<ModalRouter />`，衍生資料移至 hook/context。  
4. **Storage 層統一**：業務只透過 storage/* 或 adapter 寫入，錯誤處理一致。  
5. **VesselCalibrationModal / FeedingModal 拆子元件**：依 step 或區塊拆檔。  
6. **常數／型別**：LEVEL_ITEMS 清理、types 分檔或分區。  
7. **測試**：storage、utils、algorithms 補單測。  
8. **小項**：loadErrorToast 用 palette、useStorageState 抽共用。

---

## 四、風險與注意

- **向後相容**：儲存 key 與既有 migration 不變；新 hook 僅封裝既有讀寫，不改變 key 或資料格式。  
- **Context 使用**：僅對「真正跨多層且單一來源」的資料（如 vessels）用 Context，避免過早全局 Context 導致重渲染或除錯困難。  
- **拆分 Modal**：先以「同一檔案內抽子元件」為主，再視需要拆檔，以減少 merge 衝突。

若你希望某一段落先落實成具體 diff（例如「只做 Vessels Context + 移除 useFeeding 內 useVessels」），可指定優先項，我再依該項產出步驟與範例程式碼。
