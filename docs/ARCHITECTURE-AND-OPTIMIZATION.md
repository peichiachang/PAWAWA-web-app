# PAWAWA 程式架構與程式碼優化總覽

> 本文件整理**現行程式架構**與**已完成的程式碼優化**，供開發與維護參考。  
> 最後更新：2026-03-07

---

## 一、程式架構

### 1.1 專案結構（單一 codebase，Web + iOS/Android）

```
PAWAWA/
├── package.json              # 根：腳本委派給 app（start/ios/android/web/build:*/typecheck）、mock-api、測試腳本
├── app.json                  # Expo 設定（與 app/app.json 同步：名稱、bundle、權限）
├── eas.json                  # EAS Build 設定（development / preview / production）
├── App.tsx                   # 根層（可與 app/App.tsx 同源或符號連結，實際執行以 app 為準）
│
├── app/                      # ★ Expo 應用主體（執行與建置皆由此目錄）
│   ├── index.ts              # 進入點：registerRootComponent(App)
│   ├── App.tsx               # 根元件：state、導航、所有 Content / Modal、資料載入
│   ├── app.json              # Expo 設定（iOS/Android/Web、plugins、權限文案）
│   ├── eas.json              # EAS 建置設定
│   ├── package.json          # 依賴：expo、react-native、reanimated、worklets、async-storage、camera、image-picker…
│   ├── src/
│   │   ├── types/            # app.ts, domain.ts, ai.ts, bloodReport.ts, auth.ts
│   │   ├── constants/        # 儲存 key、LEVEL_ITEMS、BOTTOM_ITEMS、飼料/罐頭種子
│   │   ├── config/           # api.ts（getApiBaseUrl）、skipAuthForTesting、devDataMode
│   │   ├── storage/          # feedingStorage, hydrationStorage, migration
│   │   ├── hooks/             # useFeeding, useHydration, useElimination, useMedication, useSymptoms, useBloodReport, useVessels, useCats, useVitals, useAppSummaries, useRecordReminders
│   │   ├── services/         # ai（index, geminiService, mockAiService）, bloodReport, authApi, clinicalSummary, canLabelScanApi, mockData
│   │   ├── utils/            # health, date, vesselVolume, profileVolume, catScope, hydrationUtils, layoutAnimation, camera, alerts, imageQuality…
│   │   ├── algorithms/       # feedingBounds（含單測）
│   │   ├── data/             # careKnowledge, bloodReportKnowledge
│   │   ├── contexts/         # AuthContext, VesselsContext
│   │   ├── styles/           # common.ts（palette + StyleSheet）
│   │   ├── components/       # TopNav, BottomNav, HomeContent, RecordsContent, ProfileContent, KnowledgeContent, *Modal, CustomCamera, TrendChart, AnimatedPressable, FadeInView…
│   │   └── screens/          # AuthGateScreen, LoginScreen, RegisterScreen, *Screen（薄層）
│   └── api/                  # Vercel serverless：auth/*, _lib/ai.js（Web 同源 /api 用）
│
├── api/                      # 根層 Vercel serverless（若部署根目錄時使用）
├── mock-ai-api/              # 本機 mock AI 後端（npm run mock-api）
├── scripts/                  # 測試與評估腳本（feeding、hydration、prompt-ab…）
└── docs/                     # PRD、SDD、架構、優化、平台說明
```

- **實際執行**：`npm run start` / `ios` / `android` / `web` 皆在 **app** 目錄跑 Expo；根目錄主要做腳本委派與 mock-api。
- **建置**：`npm run build:ios:preview` / `build:android:preview` 在 app 內執行 EAS Build；識別為 `com.pagechang.projectcat`，名稱 PAWAWA。

### 1.2 進入點與根元件

| 項目 | 說明 |
|------|------|
| **進入點** | `app/index.ts` → `registerRootComponent(App)`，載入 `app/App.tsx`。 |
| **App.tsx** | 集中管理：`level` / `bottomTab` / `activeModal`、各紀錄 hook（feeding, hydration, elimination, medication, symptoms, bloodReport）、`useVessels`、`cats` / `vitalsLogs` 載入、遷移、所有 Tab Content 與 Modal 的顯示/關閉。 |
| **認證** | `AuthProvider` 包住 `AppMain`；可選 `AuthGateScreen` 或略過（SKIP_AUTH_FOR_TESTING）。 |

### 1.3 資料流概觀

- **導航／UI 狀態**：`level`（家庭／個體）、`bottomTab`（home / records / knowledge / profile）、`activeModal`、各 Modal 的 visible 與選中項目，均在 App 以 `useState` 管理。
- **領域資料**：`cats`、`vitalsLogs` 在 App 內用 AsyncStorage 載入／儲存；`feeding`、`hydration`、`elimination`、`medication`、`symptoms`、`bloodReport` 由各自 **hook** 管理 state 並寫入 storage。
- **食碗**：App 呼叫一次 `useVessels()` 得到 `sharedVessels`，傳入 `useFeeding`、`useHydration` 與 `VesselCalibrationModal`。
- **AI**：`getAiRecognitionService()` 依 `EXPO_PUBLIC_AI_SERVICE_MODE` 與 `EXPO_PUBLIC_API_BASE_URL` 回傳 mock / http / gemini；原生正式環境未設 API 基底 URL 時會拋錯（§5.2）。

### 1.4 技術棧（與 SDD 一致）

| 層級 | 技術 |
|------|------|
| 框架 | Expo SDK ~54 |
| UI | React Native + React 19 |
| 語言 | TypeScript |
| 本機儲存 | @react-native-async-storage/async-storage |
| 相機／相簿 | expo-camera、expo-image-picker |
| 推播 | expo-notifications（選用） |
| 動畫 | react-native-reanimated、react-native-worklets；LayoutAnimation（版面） |
| 建置 | EAS Build（preview / production） |

---

## 二、已完成的程式碼優化

以下為本專案**已實施**的優化，依類別整理。

### 2.1 規格對齊（SDD／平台）

| 項目 | 說明 |
|------|------|
| **原生 API 基底 URL** | `app/src/config/api.ts`、`app/src/services/ai/index.ts`：原生且非 __DEV__ 時，若未設定 `EXPO_PUBLIC_API_BASE_URL` 會拋錯，避免隱性連錯端點。 |
| **iOS/Android 權限** | `app.json` / `app/app.json`：補齊 NSCameraUsageDescription、NSPhotoLibraryUsageDescription、expo-image-picker 的 cameraPermission / photosPermission（繁體中文）；移除未使用的 **RECORD_AUDIO**。 |
| **測距儀移除** | 食碗校準不再提供「開啟測距儀」功能與文案；`VesselCalibrationModal` 移除 `handleOpenMeasure`、Linking、測距儀按鈕與說明。 |
| **單一 codebase 命名** | 根 `package.json` 名稱改為 `pawawa`；.env.example 補上 `EXPO_PUBLIC_API_BASE_URL` 與 AI 模式說明。 |

### 2.2 列表與捲動（原生效能）

| 項目 | 說明 |
|------|------|
| **紀錄列表虛擬化** | `RecordsContent.tsx`「完整紀錄」改為 **FlatList**（keyExtractor、renderItem、ListEmptyComponent、removeClippedSubviews、maxToRenderPerBatch、windowSize），大量筆數時僅渲染可見區。 |
| **首頁紀錄區塊** | `HomeContent.tsx` 五個區塊（食物／飲水／排泄／用藥／症狀）改為 **FlatList**，`scrollEnabled={false}` 由外層 ScrollView 捲動，結構可支援未來「顯示更多」。 |

### 2.3 鍵盤與輸入體驗

| 項目 | 說明 |
|------|------|
| **Modal 表單鍵盤** | 下列 Modal 在內容最外層包 **KeyboardAvoidingView**（behavior 依 Platform、keyboardVerticalOffset 僅 iOS）：VesselCalibrationModal（表單＋食碗管理）、FeedingModal、HydrationModal、AddCatModal、FeedLibraryModal、CanLibraryModal。鍵盤彈起時輸入框不易被遮擋。 |

### 2.4 動畫（UI thread）

| 項目 | 說明 |
|------|------|
| **Reanimated** | 安裝 `react-native-reanimated`、`react-native-worklets`；**AnimatedPressable**、**FadeInView** 改為 Reanimated（useSharedValue、useAnimatedStyle、withTiming、withDelay），動畫在 UI thread 執行，不佔 JS thread；LayoutAnimation 維持不變。 |

### 2.5 文件與修訂

- **SDD**：版本 1.2；§6.2 明訂不宣告 RECORD_AUDIO、§7.3 註明食碗校準不包含測距儀；附錄 B 修訂紀錄已更新。
- **docs/PLATFORM-SPECIFIC.md**：平台分支說明、已處理項目（RECORD_AUDIO、測距儀移除）。
- **docs/NATIVE-PERFORMANCE-RECOMMENDATIONS.md**：§1～§3、§5 標為已實作；§4 圖片快取為可選。

---

## 三、相關文件索引

| 文件 | 用途 |
|------|------|
| [PRD.md](./PRD.md) | 產品需求、功能範圍、模組說明。 |
| [SDD.md](../SDD.md) | Web → iOS/Android 建置、環境、平台、測試、上架規格與階段里程碑。 |
| [PROJECT.md](./PROJECT.md) | 專案說明與使用方式。 |
| [ARCHITECTURE-REVIEW-AND-OPTIMIZATION.md](./ARCHITECTURE-REVIEW-AND-OPTIMIZATION.md) | 架構檢視與**建議**優化（狀態一致化、App 減負、儲存層、巨型 Modal 拆分、測試等）；多數為尚未實施的改進方向。 |
| [NATIVE-PERFORMANCE-RECOMMENDATIONS.md](./NATIVE-PERFORMANCE-RECOMMENDATIONS.md) | 原生效能優化項目與**已實作**狀態（FlatList、KeyboardAvoidingView、Reanimated）。 |
| [PLATFORM-SPECIFIC.md](./PLATFORM-SPECIFIC.md) | iOS/Android/Web 平台分支說明與權限／已處理項目。 |

---

## 四、建議的優化優先度（尚未實施項目）

以下為**尚未實施**的改進，依建議優先度排序；實作時請維持儲存 key 與 migration 不變。

| 優先 | 項目 | 效益 | 成本 | 說明 |
|------|------|------|------|------|
| **P0** | **Vessels 單一來源 + Context** | 高 | 中 | 僅在 App（或一層 Provider）呼叫 `useVessels()`，用 Context 提供給 FeedingModal、HydrationModal、VesselCalibrationModal；useFeeding/useHydration 只從 context 取 vessels，移除 `vesselsFromParent` 與內部 useVessels。可避免雙實例與 key 重複寫入，釐清資料流。 |
| **P0** | **useCats / useVitals（或 useVitalsHistory）** | 高 | 中 | 將 cats、vitalsLogs 的 load/save 抽成 hook，App 只消費 `{ cats, setCats, saveCat, ... }`；遷移仍在啟動時跑一次。與其他 hook 模式一致，為後續「App 減負」打基礎。 |
| **P1** | **App 減負：Modal 路由化 + 衍生資料遷出** | 中高 | 中 | 用 `activeModal` + `modalProps` 渲染單一 `<ModalRouter />`；`summaries`、`summaryByCatId`、`todayHouseholdKcal`、`currentCat` 等遷到 `useAppSummaries` 或 Context。建議在 useCats/useVessels 之後做，依賴較清晰。 |
| **P1** | **Storage 層統一與錯誤處理** | 中 | 中 | 業務只透過 storage/* 或單一 adapter 寫入；儲存失敗統一 log，使用者主動寫入可選 Toast/Alert。可與 useCats/useVitals 一併收斂讀寫路徑。 |
| **P2** | **VesselCalibrationModal / FeedingModal 拆子元件** | 中 | 高 | 依 step 或區塊拆成子元件（同一檔內先抽，再視需要拆檔），單檔變短、易 review；可排在有時間做重構時。 |
| **P2** | **常數／型別整理** | 低～中 | 低 | LEVEL_ITEMS 移除靜態貓咪項；types/app.ts 分檔或分區、re-export。風險低，隨時可做。 |
| **P2** | **小項：loadErrorToast 用 palette、useStorageState** | 低 | 低 | UI 一致化與重複載入邏輯抽共用，即時可做。 |
| **P3** | **單元測試補齊** | 中（長期） | 中 | storage、vesselVolume、hydrationMath 等純函式與儲存層單測；useFeeding/useHydration 關鍵路徑可選整合測試。 |
| **P3** | **app/api 型別或 JSDoc** | 低 | 低 | 後端 .js 加 JSDoc 或改 TS，與前端型別對齊；非急迫。 |

**建議實作順序（不強制）**  
1. P0：Vessels Context → useCats/useVitals（兩者可先後或並行）。  
2. P1：App 減負（Modal 路由 + 衍生資料）+ Storage 統一。  
3. P2：巨型 Modal 拆子元件、常數型別、小項。  
4. P3：測試與 API 文件。

**風險與注意**（與 ARCHITECTURE-REVIEW 一致）  
- 儲存 key 與既有 migration 不變。  
- Context 僅用於真正單一來源、跨多層的資料，避免過度全局化。  
- Modal 拆分先同一檔案內抽子元件，再視需要拆檔。

---

## 五、建置與檢查指令（摘要）

| 指令 | 說明 |
|------|------|
| `npm run typecheck` | 在 app 目錄執行 `tsc --noEmit`（SDD §9.1）。 |
| `npm run start` / `ios` / `android` / `web` | 從 app 啟動 Expo。 |
| `npm run build:ios:preview` / `build:android:preview` | EAS 產出 preview 安裝檔。 |
| 原生正式環境 | 建置時需設定 `EXPO_PUBLIC_API_BASE_URL`（及必要時 `EXPO_PUBLIC_AI_SERVICE_MODE`）。 |

---

## 六、依建議順序已實作項目（2026-03-07）

| 優先 | 項目 | 狀態 |
|------|------|------|
| **P0** | Vessels 單一來源 + Context | ✅ `contexts/VesselsContext.tsx`（VesselsProvider、useVesselsContext）；useFeeding/useHydration 改為從 context 取 vessels；App 包 VesselsProvider。 |
| **P0** | useCats / useVitals | ✅ `hooks/useCats.ts`、`hooks/useVitals.ts`（saveCats/saveVitals、reload）；App 改用兩 hook，migration 後呼叫 reload。 |
| **P1** | App 減負（衍生資料） | ✅ `hooks/useAppSummaries.ts`：indexedCats、summaries、summaryByCatId、todayHouseholdKcal、todayHouseholdWater、currentCat、currentSummary 移出 App。Modal 路由化未做。 |
| **P1** | Storage 層統一與錯誤處理 | ⏸ 未做 |
| **P2** | loadErrorToast 用 palette | ✅ App 內 loadErrorToast 區塊改為 palette.dangerBg、palette.dangerText。 |
| **P2** | LEVEL_ITEMS 清理 | ✅ constants：僅保留 household，註解說明個體由 TopNav 動態產生。 |
| **P2** | useStorageState 抽共用 | ⏸ 未做 |

---

以上為目前**程式架構**與**已完成的程式碼優化**整理；後續若實施 ARCHITECTURE-REVIEW 中的建議（如 Storage 層統一、Modal 路由化、Modal 拆分），可再更新本文件與該檢視文件。
