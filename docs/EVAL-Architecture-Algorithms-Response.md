# PAWAWA 架構與算法評估報告 — 對照與建議

本文件針對《PAWAWA 架構與算法深度評估報告》所述項目，對照現有程式碼後給出評估與實作建議。

---

## 一、算式與演算法

### 1. 貓草、罐頭的「堆疊效應」與密度落差

**報告描述**：重量 = 體積 × 密度 (0.95/0.45)；濕食「疊成小山」或「鋪平」時，2D 俯視/側面算出的 consumedRatio 誤差大。

**程式對照**：
- `geminiService.ts` 已依 `foodType === 'wet'` 使用密度 0.95，乾飼料 0.45；版本 A 使用 `t0FillRatio * vesselVolumeMl * density`，確實假設均勻填充。
- 濕食形狀（堆高 vs 鋪平）會導致同一 fillRatio 對應不同實際質量，報告指出的問題成立。

**評估**：✅ 同意。濕食幾何誤差是實務上的限制。

**建議**（不更動現有算式與辨識演算法前提下）：
- **短期**：在 UI 對 `foodType === 'wet'` 時加一句說明：「濕食建議從斜上方約 45° 拍攝，可減少體積誤差。」不改算式與 prompt。
- **中期**：若產品要強化濕食準度，可新增「濕食模式」：在 payload 中傳遞 `preferAreaRatio: true` 等旗標，由**另一套** prompt 要求 AI 輸出「留存面積比」而非 3D 填充比，再在**新分支**用面積比對應克數（新公式、新欄位），原有乾飼料/現有算式完全不動。
- **heightProfile**：若未來要實作「斜 45° + 高度輪廓」，應列為新需求與新 API 欄位，不覆寫既有 volume/density 流程。

---

### 2. 環境蒸發係數（evaporation factor）

**報告描述**：`envFactorMl = (waterW0Ml - waterW1Ml) * 0.02`（固定 2% 水量差當蒸發）。

**程式對照**：
- `app/src/utils/hydrationMath.ts` 實作為：
  ```ts
  calculateEvaporationMl(w0Timestamp, w1Timestamp, rateMlPerHour = 0.5)
  → hoursElapsed = (w1 - w0) / (1000*60*60)
  → return hoursElapsed * rateMlPerHour
  ```
- 亦即：**蒸發量 = 時間間隔（小時）× 0.5 ml/hr**，並**不是**「水量差的 2%」。報告對現有公式的描述與程式不符。

**評估**：現有設計已是「依時間」的蒸發修正；報告建議的「依水面積與時間」是更合理的**進階**優化。

**建議**：
- **釐清**：對外說明文件可註明「目前蒸發量為依時間之常數率（預設 0.5 ml/hr），非依水量差」。
- **改進（可選）**：在不改動既有呼叫介面前提下，擴充 `calculateEvaporationMl` 的**可選參數**，例如 `surfaceAreaCm2?: number`；若傳入則使用 `envMl = surfaceAreaCm2 * elapsedHours * ratePerCm2Hr`，未傳入則維持現有 `elapsedHours * 0.5`。需在 `VesselCalibration` 或輪廓計算處提供「水面暴露面積」（碗口面積或由輪廓推得），避免改動既有辨識與儲存格式。

---

## 二、AI 視覺辨識（Prompt）

### 1. 雙圖比對的反光與陰影干擾（Hydration Vision）

**報告建議**：在 Prompt 中加強 OPTICAL CUES FOR WATER：meniscus、折射、勿將碗底花紋當水面。

**程式對照**：
- `geminiService.ts` 中 Hydration 的 prompt 已包含：
  - "Do NOT confuse the bottom pattern/logo of the bowl with the water surface."
  - "Focus heavily on the **meniscus** (the sharp light reflection ring where water meets the bowl wall)."
  - "Look for refraction distortion of the text/patterns under the surface to determine the true depth."

**評估**：✅ 建議內容已在程式內實作；若實測仍常有幻覺，可再強化同一段落的用字或順序，無需新增大段演算法。

---

### 2. 空碗特徵記憶（Empty Bowl Baseline）與 ROI

**報告描述**：空碗照可能殘留飼料/殘渣，被 AI 當成 100% 空；建議允許使用者劃定 ROI 遮罩。

**程式對照**：
- `VesselCalibration.topViewImageBase64` 已存在；feeding prompt 有 "Compare only bowl interior ROI" 文字，但**沒有**使用者可繪製的 ROI 遮罩資料結構或傳遞至 API。
- 目前 ROI 僅為 prompt 敘述，非可選的幾何/遮罩欄位。

**評估**：✅ 同意「空碗殘渣干擾」風險；「劃定 ROI」是合理的進階功能。

**建議**：
- **短期**：在建立/編輯校準的流程中，加一句說明：「空碗照請盡量清空碗內，避免殘留飼料或水漬，以利 AI 辨識基準。」不更動演算法。
- **中期**：若要做 ROI，建議列為**新欄位**（例如 `topViewRoiBase64` 或一組多邊形座標），僅在「有提供 ROI」時於 prompt 或後處理中使用，不影響既有的 `topViewImageBase64` 與現有辨識流程。

---

## 三、系統架構與狀態管理

### 1. 邏輯耦合過深（Hooks 責任過多）

**報告描述**：useFeeding / useHydration 同時處理 AsyncStorage、呼叫 AI、邊緣案例、Modal 狀態，難以單元測試純演算。

**程式對照**：
- `useFeeding.ts`、`useHydration.ts` 皆超過 400 行，內含儲存 key、TTL、舊 key 相容、AI 呼叫、錯誤處理與 state 更新。
- `hydrationMath.ts` 已存在並被使用（如 `calculateEvaporationMl`、`calculateHydrationVolume`），部分數學已抽離。

**評估**：✅ 同意；抽離「純數學／邊界檢查」與「儲存/API」有助測試與維護。

**建議**（不更動現有算式與 AI 辨識演算法）：
- **演算層**：將「防爆框、合理範圍檢查、克數/熱量換算」等**純函數**集中到例如 `app/src/utils/` 或 `app/src/algorithms/`（如 `feedingBounds.ts`、`volumeCalculus.ts`），由 Hook 呼叫，方便 Jest 單測。
- **儲存層**：將 AsyncStorage 的讀寫封裝成小模組（例如 `feedingStorage.ts`、`hydrationStorage.ts`），key、TTL、舊 key 遷移集中在一處，Hooks 只呼叫「load / save / clear」。
- **Hooks**：保留「狀態、呼叫 AI、呼叫儲存/演算、設定 Modal/錯誤狀態」的協調角色，但不再內聯複雜算式或多層 key 判斷。可採漸進重構，先抽「最常改動」的算式與邊界檢查。

---

### 2. 向後相容與 Legacy 程式碼

**報告描述**：W0/T0 key 混用、舊 key fallback 導致分支過多，建議用 Migration Script 一次轉成新結構。

**程式對照**：
- `useHydration.ts` 確實在 init 時先讀 `HYDRATION_W0_STORAGE_KEY`，若無則讀 `'carecat:hydration:t0'`，並有相容邏輯。
- 其他處亦有舊 key 或舊格式的 fallback。

**評估**：✅ 同意；集中遷移可讓主流程只面對單一資料型別與 key。

**建議**：
- **遷移腳本**：在 App 啟動（例如 Splash 或首次進入主畫面）時執行一次「v3 → v4」遷移：讀取所有舊 key、轉成新結構、寫入新 key、可選刪除舊 key 或標記已遷移。之後 Hooks 與元件只讀寫新 key 與新型別。
- **文件**：在 `docs/` 記錄舊 key 與新 key 對照表及遷移規則，方便日後排查與再遷移（例如 React Native 升級或換儲存引擎時）。

---

## 四、優先順序建議（小結）

| 優先級 | 項目 | 說明 |
|--------|------|------|
| **高** | 抽離純數學／邊界邏輯並加單測 | 不改算式與 AI，只重構位置與可測性；立即提升可維護性。 |
| **高** | 資料遷移層 + 單一 key/型別 | 減少 Hooks 內分支，長期降低錯誤率。 |
| **中** | 蒸發公式擴充（可選 surfaceArea） | 保持現有呼叫介面，僅擴充參數與內部實作。 |
| **中** | 濕食 UI 說明 + 可選「濕食模式」設計 | 先文案與設計，再決定是否實作面積比或 heightProfile。 |
| **低** | 空碗 ROI 遮罩 | 新欄位、新流程，不影響既有辨識。 |
| **已具備** | Hydration 光學提示詞 | 已實作 meniscus/折射；若實測不足再微調文案。 |

上述建議均以「不更動現有算式與 AI 辨識演算法」為前提，僅透過抽離、擴充參數、新分支或新欄位來優化穩定性與擴展性。
