# PAWAWA 平台專屬邏輯說明

依 SDD §6、§7 整理：目前程式碼中與 **iOS / Android / Web** 相關的分支與建議。

---

## 已正確處理、無需修改

| 位置 | 行為 | 說明 |
|------|------|------|
| **config/api.ts** | 原生正式環境未設 `EXPO_PUBLIC_API_BASE_URL` 時拋錯 | 符合 SDD §5.2，避免隱性連錯端點。 |
| **services/ai/index.ts** | 同上 | 與 config 一致。 |
| **config/api.ts** | Web 用 `window.location.hostname` 偵測 dev host | 僅 Web 有 `window`，合理。 |
| **useRecordReminders.ts** | `Platform.OS !== 'web'` 才設定 NotificationHandler | 推播僅 iOS/Android 支援，Web 略過。 |
| **useRecordReminders.ts** | `Platform.OS === 'android'` 時建立 notification channel | Android 8+ 必要，iOS 不需。 |
| **layoutAnimation.ts** | Android 才呼叫 `setLayoutAnimationEnabledExperimental` | 僅 Android 需此開關，已正確。 |
| **CustomCamera.tsx** | Web 不訂閱光感測器 | 光感為原生 API，Web 無。 |
| **CustomCamera.tsx** | `optimizeWebImage` 僅在 Web 執行 | 使用 DOM/Blob/Image，僅 Web 有。 |
| **App.tsx** | 鎖定 viewport、防止雙擊縮放僅在 Web | 僅 Web 有 `document`/viewport，合理。 |

---

## 依產品決策決定是否調整

### 1. Android 權限 — RECORD_AUDIO（app.json）

- **現狀**：已從 `app.json` 移除 `RECORD_AUDIO`（本 App 無錄音／語音功能）。若未來新增語音功能需補上並說明用途。

---

## 可選優化（非必須）

### 1. 推播權限說明（iOS）

- **現狀**：expo-notifications 會向使用者要通知權限，目前無自訂權限說明文案。
- **可選**：若要在系統權限對話前給說明，可在首次進入「紀錄提醒」相關流程時先顯示一段自訂說明（例如「用於每日飲食／飲水紀錄提醒」），再呼叫 `requestPermissionsAsync()`。不影響現有功能，僅 UX 優化。

### 2. SafeAreaView / 狀態列

- **現狀**：使用 React Native 的 `SafeAreaView`，在 iOS 有缺口機型會自動避開。
- **可選**：若 Android 希望與 iOS 一致的頂部留白，可考慮 `react-native-safe-area-context` 的 `SafeAreaView`，雙平台行為更一致；目前非必要。

### 3. 相機圖示（CustomCamera）

- **現狀**：翻轉相機按鈕使用 `flip-camera-ios` 圖示名稱。
- **可選**：在 Android 上可改為 `Platform.select({ ios: 'flip-camera-ios', android: 'flip-camera-android', default: 'flip-camera-ios' })` 以符合平台慣例；不影響功能。

---

## 總結

- **必須改的**：無。現有平台分支與 SDD §5、§6、§7 一致。
- **已處理**：Android 不宣告 RECORD_AUDIO；測距儀相關功能與說明已移除。
- **其餘**：屬可選 UX／一致性優化，不影響建置與上架。
