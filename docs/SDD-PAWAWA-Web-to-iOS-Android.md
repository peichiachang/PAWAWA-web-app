# PAWAWA Web App 轉化 iOS/Android — SDD（規格驅動開發）

> **Spec-Driven Development (SDD)**：本文件為「Web 版 PAWAWA 產出 iOS/Android 原生安裝版」之規格與實作驅動文件，供開發、測試與上架依循。  
> Version: 1.0  
> Last updated: 2026-03-06  
> 對應 PRD：[PRD.md](./PRD.md) | 專案說明：[PROJECT.md](./PROJECT.md)

---

## 目錄

1. [文件與範圍](#1-文件與範圍)
2. [目標與非目標](#2-目標與非目標)
3. [技術規格總覽](#3-技術規格總覽)
4. [建置與發佈規格](#4-建置與發佈規格)
5. [環境與 API 規格](#5-環境與-api-規格)
6. [平台專屬規格（iOS / Android）](#6-平台專屬規格ios--android)
7. [功能對等性規格](#7-功能對等性規格)
8. [非功能規格](#8-非功能規格)
9. [測試規格](#9-測試規格)
10. [上架與合規規格](#10-上架與合規規格)
11. [階段與交付物（規格驅動里程碑）](#11-階段與交付物規格驅動里程碑)

---

## 1. 文件與範圍

### 1.1 適用範圍

- **起點**：現有 PAWAWA 程式庫（Expo + React Native），目前以 **Web** 形式部署於 Vercel。
- **終點**：同一程式庫產出可安裝於 **iOS** 與 **Android** 裝置的應用程式（.ipa / .apk 或 App Store / Google Play 分發），功能與 Web 版對等（見 §7）。

### 1.2 前提假設

- 程式庫已具備 Expo 專案結構、`app.json` / `eas.json` 設定、以及可於本機執行 `expo start --ios` / `--android`。
- 不變更既有產品功能範圍；僅規範「在原生平台正確建置、執行、上架」所需之規格與實作要項。

### 1.3 用語

| 用語 | 定義 |
|------|------|
| Web 版 | 以 `expo start --web` 或 Vercel 部署之 PAWAWA 網頁應用。 |
| 原生版 / Native | 以 EAS Build 或同等流程產出之 iOS / Android 安裝包。 |
| 功能對等 | 在原生版上，PRD 所列功能行為與 Web 版一致（含離線、相機、儲存）。 |

---

## 2. 目標與非目標

### 2.1 目標（In Scope）

- 以 **單一 codebase**（現有 Expo 專案）產出 iOS 與 Android 安裝版。
- 建置流程可重複、可自動化（EAS Build 或等同）。
- 原生版與 Web 版 **功能對等**（首頁、紀錄、知識、個人、所有 Modal、AI 辨識、本機儲存）。
- 相機、相簿、AsyncStorage、推播（若啟用）在 iOS/Android 上正常運作。
- 產出符合 **App Store** 與 **Google Play** 上架所需之設定與說明（隱私、權限、出口合規）。

### 2.2 非目標（Out of Scope）

- 不重寫為其他框架（如 Flutter、Swift/Kotlin 原生）。
- 不在此 SDD 定義新產品功能；新功能依 PRD 與既有變更流程。
- 不規範後端 API 之實作細節；僅規範 App 端如何設定與呼叫（§5）。

---

## 3. 技術規格總覽

### 3.1 技術棧（維持現狀）

| 層級 | 技術 | 備註 |
|------|------|------|
| 框架 | Expo SDK（與現有版本一致，如 ~54） | 不降版、不無故升版導致 breaking。 |
| UI | React Native + React | 現有元件與 hooks 直接沿用。 |
| 語言 | TypeScript | 建置前需通過 `npm run typecheck`。 |
| 本機儲存 | @react-native-async-storage/async-storage | 鍵值與現有 KEY 一致（見 PRD §12）。 |
| 相機 / 相簿 | expo-camera、expo-image-picker | 權限與用途見 §6。 |
| 推播 | expo-notifications | 選用；若啟用需符合商店政策。 |
| 建置 / 發版 | EAS Build（Expo Application Services） | 建議使用既有 EAS projectId。 |

### 3.2 識別資訊（必須與 app.json 一致）

| 項目 | iOS | Android |
|------|-----|---------|
| 應用名稱 | PAWAWA | PAWAWA |
| Bundle ID / Package | com.pagechang.projectcat | com.pagechang.projectcat |
| 對外顯示名稱 | 依 app.json `expo.name` | 同上 |

---

## 4. 建置與發佈規格

### 4.1 建置管道

- **Preview（內部測試）**  
  - 指令：`npm run build:ios:preview`、`npm run build:android:preview`（或等價 EAS 指令）。  
  - 產物：可安裝於實機之 .ipa / .apk（或透過 EAS 連結安裝）。  
- **Production（商店用）**  
  - 依 `eas.json` 之 `production` profile 建置；版本號建議與 app.json `version` 一致或由 EAS 自動遞增。

### 4.2 建置環境需求

- Node 與 npm 版本需符合 Expo 官方建議。  
- EAS CLI 已安裝並登入（`eas build` 可執行）。  
- iOS：Apple Developer 帳號、憑證與 Provisioning Profile（EAS 可代管）。  
- Android：Keystore（EAS 可代管或自備）。

### 4.3 交付物（依規格產出）

| 階段 | 交付物 | 規格符合 |
|------|--------|----------|
| Preview | iOS/Android 安裝檔或安裝連結 | §4.1、§6 |
| Production | 可提交審核之建置產物 | §4.1、§6、§10 |

---

## 5. 環境與 API 規格

### 5.1 環境變數（原生版必須）

Web 版在 production 使用 same-origin `/api`；**原生版無 same-origin**，必須透過環境變數提供 API 基底網址。

| 變數 | 必填（原生） | 說明 |
|------|--------------|------|
| `EXPO_PUBLIC_API_BASE_URL` | 是（當 AI mode 為 `http`） | 後端 API 基底 URL（例如 `https://your-api.example.com`），結尾不帶 `/api` 時由服務端路徑約定補齊。 |
| `EXPO_PUBLIC_AI_SERVICE_MODE` | 建議 | `mock` / `http` / `gemini`；production 原生建議 `http`（金鑰不進 App）。 |
| `EXPO_PUBLIC_GEMINI_API_KEY` | 僅當 mode=gemini | 若堅持 client 直連 Gemini，需在 EAS 建置時注入；不建議 production 使用。 |

### 5.2 API 行為規格

- **resolveApiBaseUrl()**（或等同邏輯）：  
  - 當 `EXPO_PUBLIC_API_BASE_URL` 有值時，原生版一律使用該值。  
  - 未設定時，可 fallback 至明確預設或建置時錯誤提示（避免隱性連到錯誤端點）。
- **逾時與錯誤**：與現有 Web 行為一致（如 45s 逾時、413 圖片過大、錯誤訊息在地化）。

### 5.3 合規要求

- 所有生產環境網路請求須使用 **HTTPS**（除明確允許的 localhost 開發）。

---

## 6. 平台專屬規格（iOS / Android）

### 6.1 iOS

| 項目 | 規格 | 對應設定 |
|------|------|----------|
| 最低版本 | 依 Expo SDK 要求（如 iOS 13+） | app.json / Expo 文件 |
| 相機權限 | NSCameraUsageDescription 必填，文案需說明用途 | app.json `expo.ios.infoPlist` |
| 相簿 / 照片（若使用） | NSPhotoLibraryUsageDescription | 若使用 image-picker 讀取相簿則需填寫 |
| 加密出口 | ITSAppUsesNonExemptEncryption: false（若未使用自訂加密） | 已於 app.json 設定 |
| 方向 | 直向 portrait | app.json `orientation` |
| 裝置 | iPhone、iPad（supportsTablet: true） | app.json |

### 6.2 Android

| 項目 | 規格 | 對應設定 |
|------|------|----------|
| 最低 SDK | 依 Expo SDK 要求 | app.json / Expo 文件 |
| 相機 | CAMERA 權限（由 expo-camera / image-picker 宣告） | plugins |
| 錄音 | 若使用 RECORD_AUDIO，需說明用途 | 目前 app.json 已列，若有語音功能需對應說明 |
| 儲存（若需） | 依 Android 版本使用 Scoped Storage | Expo 預設處理 |
| 邊到邊 | edgeToEdgeEnabled 依設計需求 | app.json 已設 |

### 6.3 權限文案原則

- 所有權限說明須以 **使用者可理解之繁體中文** 撰寫，並與實際使用情境一致（例如：拍攝貓咪飲食／飲水／排泄影像以進行 AI 分析）。

---

## 7. 功能對等性規格

以下模組在原生版上須與 Web 版行為一致（同一 PRD 與同一 codebase）。

### 7.1 導航與狀態

- 層級切換（household / cat_xxx）、底部頁籤（home / records / knowledge / profile）、Modal 開關與參數傳遞。

### 7.2 畫面模組

- **HomeContent**：家庭／個體數據、趨勢、待填寫收碗、新增紀錄入口。  
- **RecordsContent**：紀錄列表、篩選、新增紀錄入口。  
- **KnowledgeContent**：知識篩選與分頁。  
- **ProfileContent**：個人、家庭成員、罐頭庫／飼料設定入口、快捷功能。

### 7.3 Modal 與功能

- 食物記錄（FeedingModal）、飲水（HydrationModal）、排泄（EliminationModal）、血檢（BloodReportModal）、用藥（MedicationModal）、症狀（SymptomModal）、設定（SettingsModal）、新增/編輯貓（AddCatModal）、食碗校準（VesselCalibrationModal）、飼料設定（FeedLibraryModal）、罐頭庫（CanLibraryModal）、紀錄詳情、血檢歷史／詳情、體重、Kcal/Water 建議、備份、IAP 等，依 PRD 與現有實作。

### 7.4 資料與 AI

- **本機儲存**：AsyncStorage 鍵名與結構與 Web 版一致；無需平台分支。  
- **AI 辨識**：在設定正確 `EXPO_PUBLIC_AI_SERVICE_MODE` 與 `EXPO_PUBLIC_API_BASE_URL`（或 Gemini 金鑰）下，飲食／飲水／排泄／血檢 OCR 等流程與 Web 版一致。  
- **相機與相簿**：拍照、選圖、上傳至 AI 服務之流程與錯誤處理一致。

### 7.5 接受標準（Acceptance）

- 在指定 iOS/Android 版本與裝置上：  
  - 可完成安裝、啟動、登入（若無登入則略過）。  
  - 可切換家庭/個體、四個 Tab、開關上述 Modal 並完成主要流程（至少各一筆：食物、飲水、排泄、血檢、用藥、症狀）。  
  - 相機拍照與相簿選圖可用；AI 為 `http` 時可成功呼叫後端並顯示結果。  
  - 重啟 App 後本機資料仍存在（AsyncStorage）。

---

## 8. 非功能規格

### 8.1 效能

- 冷啟動至首屏可互動：建議 < 5s（中階裝置）。  
- 相機開啟、拍照、送出 AI 請求：與 Web 版體感相當；逾時與錯誤訊息一致。

### 8.2 安全

- API 金鑰不寫死於程式碼；production 原生建議經後端 proxy（`http` mode）。  
- 本機資料僅存於裝置（AsyncStorage）；若有備份/還原需求依現有 Backup 設計。

### 8.3 離線

- 與 Web 版相同：本機優先、離線可瀏覽與新增紀錄；AI 需網路時明確提示。

---

## 9. 測試規格

### 9.1 建置前

- `npm run typecheck` 通過。  
- 無會阻擋 EAS 建置的依賴或設定錯誤（可先執行 `eas build --platform ios --profile preview` 做煙霧驗證）。

### 9.2 實機測試（Preview）

- 至少一臺 iOS、一臺 Android 實機。  
- 執行 §7.5 之接受標準；紀錄通過/失敗與裝置/OS 版本。

### 9.3 回歸

- 任一影響到導航、Modal、儲存或 API 的變更，需在 Web 與至少一個原生平台回歸核心流程（可依現有手動 checklist 或未來自動化）。

---

## 10. 上架與合規規格

### 10.1 App Store（iOS）

- 隱私政策 URL（若蒐集資料）；App 內或審核說明中可取得。  
- 權限說明與 Info.plist 一致（相機、相簿等）。  
- 若未使用自訂加密：ITSAppUsesNonExemptEncryption: false 已設定。  
- 審核指南遵守（無違規內容、說明與功能一致）。

### 10.2 Google Play（Android）

- 隱私政策（若適用）；權限與功能說明一致。  
- 若使用付款或訂閱：依 Google Play 政策與技術（如 Play Billing）。

### 10.3 共通

- 應用名稱、圖示、截圖與商店文案與實際功能一致。  
- 版本號與建置號管理：建議依 EAS 或既有流程（如 app.json version + build number）。

---

## 11. 階段與交付物（規格驅動里程碑）

以下依 **規格驅動** 拆成階段；每階段以「規格符合」為完成條件。

| 階段 | 名稱 | 規格參照 | 交付物 | 完成條件 |
|------|------|----------|--------|----------|
| **1** | 環境與建置就緒 | §4、§5 | 文件化之建置步驟、EAS preview 成功 | 可重複產出 iOS/Android preview 安裝檔；API 基底 URL 在原生版可設定並生效 |
| **2** | 平台行為與權限 | §6、§7.5 | 權限文案更新（若需）、實機檢查清單 | 相機/相簿在雙平台正常；權限說明符合商店要求 |
| **3** | 功能對等驗證 | §7、§9 | 測試報告（含 §7.5 通過清單） | 所有 §7.5 項目在至少一臺 iOS、一臺 Android 通過 |
| **4** | 上架準備 | §10 | 隱私政策、商店文案、Production 建置 | 產出可提交審核之建置；合規項目已就緒 |
| **5** | 審核與上架 | §10 | 已上架或 TestFlight/內部測試連結 | 依團隊目標完成 App Store / Google Play 提交或內部測試分發 |

---

## 附錄 A：與 PRD 對照

- 功能範圍與模組：以 [PRD.md](./PRD.md) 為準。  
- 本 SDD 僅補充「Web → iOS/Android 產出」所需之 **建置、環境、平台、測試、上架** 規格，不取代 PRD 之功能描述。

---

## 附錄 B：文件修訂

| 版本 | 日期 | 變更摘要 |
|------|------|----------|
| 1.0 | 2026-03-06 | 初版：建置、環境、雙平台、功能對等、測試、上架、階段里程碑 |
