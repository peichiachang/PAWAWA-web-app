# PAWAWA 食物記錄 Spec v1 — 實作步驟與欄位

依 [食物記錄 UI Spec v1] 整理：已完成項目、待實作項目、資料欄位與實作步驟。

---

## 一、核心目標（已對齊）

- 追蹤貓咪**胃口趨勢**（攝取程度為主）
- 每餐記錄**攝取程度**（幾乎沒吃～吃完了）
- 熱量為**附帶參考**，不作為警示依據
- 胃口下降 → 提醒觀察／就醫

---

## 二、已實作項目摘要

| 項目 | 狀態 | 說明 |
|------|------|------|
| 用語 飲食→食物 | ✅ | 全 app 已改為「食物記錄／食物紀錄」 |
| 型別 FoodSourceType / IntakeLevel | ✅ | app.ts、INTAKE_LEVEL_LABEL / RATIO |
| FeedingOwnershipLog 擴充 | ✅ | foodSourceType, intakeLevel, isLateEntry, canId, ingredients |
| 食物類型選擇（四選一） | ✅ | 自動餵食器 / 乾糧一次給一天 / 罐頭 / 自煮 |
| 自動餵食器流程 | ✅ | 今日飼料 g、攝取程度、歸屬、saveIntakeOnlyLog |
| 乾糧（一次給一天） | ✅ | T0/T1 + 攝取程度五選一、refGramForIntake × ratio |
| 攝取程度換算 | ✅ | totalGram = 參考克數 × INTAKE_LEVEL_RATIO[intakeLevel] |
| 罐頭／自煮入口 | ✅ | 僅佔位文案，引導先用乾糧或手動 |
| 紀錄列表／詳情 | ✅ | 顯示攝取程度、預估攝取、熱量 |

---

## 三、待實作：罐頭庫（成份表掃描 + 清單選取）

### 3.1 資料欄位

**罐頭庫單筆（CanLibraryItem）**

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | string | 唯一 ID，如 `can_${Date.now()}` |
| name | string | 使用者命名或 OCR 辨識名稱，例：「主食罐 A」 |
| grams | number | 罐頭標示克數，例：80 |
| kcalPer100g | number | 每 100g 熱量（來自成份表 OCR，可選） |
| imageBase64?: string | string | 成份表照片（選填，供重掃比對） |
| createdAt | number | 建立時間 |

**儲存**

- Key: `CAN_LIBRARY_KEY`（已於 constants 定義 `carecat:can_library_v1`）
- 格式: `CanLibraryItem[]`，依建立時間或名稱排序

**FeedingOwnershipLog 既有欄位**

- `canId?: string` — 本次記錄選用的罐頭庫 id
- `foodSourceType: 'canned'` 時必填（或由前端保證選了罐頭才儲存）

### 3.2 成份表設定（食碗／設定頁或獨立入口）

- **飼料**：掃描一次，長期儲存 → 算出每 100g 熱量（沿用現有 `FOOD_NUTRITION_KEY` / Nutrition OCR）。
- **罐頭**：掃描後儲存為「罐頭庫」一筆；下次同款從清單選，不需重掃；換新品牌／口味再掃一次。

### 3.3 每餐記錄流程（罐頭）

**T0（放飯，不拍照）**

- 選擇罐頭：從罐頭庫列表選一筆（單選），或「新增罐頭」→ 進入掃描／手動輸入名稱+克數。
- 克數：自動帶入該罐頭 `grams`，可允許覆寫（例：半罐 40g）。

**T1（收碗）**

- 拍攝剩餘狀態（同現有 T1 拍照）。
- 選擇攝取程度：幾乎沒吃～吃完了（五選一）。
- 預估攝取：以「該罐克數 × 攝取比例」顯示克數／熱量（附帶參考）。
- 儲存：寫入 `foodSourceType: 'canned'`, `canId`, `intakeLevel`, `totalGram`, `kcal`。

### 3.4 實作步驟（罐頭庫）

1. **型別**：在 `app/src/types/app.ts` 新增 `CanLibraryItem` interface。
2. **常數**：已存在 `CAN_LIBRARY_KEY`。
3. **Hook 或 Store**：`useCanLibrary()` — 讀寫 AsyncStorage，`list`, `add(item)`, `update(id, item)`, `remove(id)`。
4. **罐頭庫管理 UI**（可放在個人或設定）：
   - 列表顯示 name、grams、kcalPer100g（若有）；
   - 新增：掃描成份表（OCR）或手動輸入 name + grams；
   - 編輯／刪除。
5. **FeedingModal — 罐頭流程**：
   - `sessionFoodSource === 'canned'` 時：
     - T0 區：罐頭選擇（下拉或列表）+ 克數（預填可改）；
     - 不需 T0 拍照；
     - T1 區：拍照 + 攝取程度五選一 + 預估攝取顯示；
     - 儲存時帶入 `canId`, `intakeLevel`, `totalGram = canGrams * INTAKE_LEVEL_RATIO[intakeLevel]`, `kcal`。
6. **useFeeding**：新增 `saveCannedLog(canId, canGrams, intakeLevel, tagId, onClose, t1Image?)` 或沿用 `saveOwnershipLog` 並傳 `opts: { foodSourceType: 'canned', canId, refGramForIntake: canGrams, intakeLevel }`（若 T1 僅拍照不跑 AI，需決定是否仍寫入一張 T1 圖或只存數字）。

---

## 四、待實作：自煮（食材選擇 + 熱量範圍）

### 4.1 資料欄位

**系統食材（固定選單，可放 constants 或 JSON）**

| 欄位 | 說明 |
|------|------|
| id | 例：chicken, fish, beef, other |
| label | 顯示名稱：雞肉、魚肉、牛肉、其他 |
| kcalPer100gMin | 每 100g 熱量下限（約略） |
| kcalPer100gMax | 每 100g 熱量上限（約略） |

**FeedingOwnershipLog 既有欄位**

- `ingredients?: string[]` — 選中的食材 id 陣列，例：`['chicken','fish']`
- `foodSourceType: 'homemade'`

### 4.2 每餐記錄流程（自煮）

- 選擇食材：多選（checkbox）雞肉、魚肉、牛肉、其他。
- 熱量參考：系統依所選食材給「約 XXX～XXX kcal」範圍（不強制精確）。
- 攝取程度：五選一。
- 儲存：`foodSourceType: 'homemade'`, `ingredients`, `intakeLevel`；`totalGram` 可設 0 或省略，`kcal` 可為範圍中值或略過。

### 4.3 實作步驟（自煮）

1. **常數**：新增 `HOMEMADE_INGREDIENTS`（id, label, kcalPer100gMin, kcalPer100gMax）。
2. **FeedingModal — 自煮流程**：
   - `sessionFoodSource === 'homemade'` 時：
     - 多選食材；
     - 顯示「熱量參考：約 XXX～XXX kcal」；
     - 攝取程度五選一；
     - 歸屬；
     - 儲存 → `saveIntakeOnlyLog(0, intakeLevel, 'homemade', tagId, onClose, undefined, selectedIngredientIds)` 或專用 `saveHomemadeLog(ingredients, intakeLevel, tagId, onClose)`。
3. **useFeeding**：若用 `saveIntakeOnlyLog`，已支援 `ingredients`；否則新增 `saveHomemadeLog` 寫入 `foodSourceType: 'homemade'`, `ingredients`, `intakeLevel`。

---

## 五、待實作：胃口趨勢圖與提醒

### 5.1 資料來源

- 以 **FeedingOwnershipLog** 的 `intakeLevel` 為主軸（若無則該筆不納入趨勢或視為「未知」）。
- 可選：僅納入 `foodSourceType` 為 `auto_feeder` / `dry_once` / `canned` / `homemade` 的紀錄。

### 5.2 趨勢圖規格

- **主軸**：攝取程度（幾乎沒吃 0 ～ 吃完了 100），可映射為數字 0～100 或 1～5。
- **時間**：近 7 天／30 天（與現有 dateFilter 一致）。
- **呈現**：折線或長條「每日平均攝取程度」或「每筆攝取程度」分布；熱量為次要資訊。

### 5.3 提醒邏輯（Spec 五）

- 條件：**連續 2 天** 出現「幾乎沒吃」或「吃了一些」。
- 文案：`貓咪最近胃口偏低，建議觀察或就醫`。
- 觸發時機：進入首頁或紀錄頁時檢查最近 2 天；可搭配現有提醒元件或 Toast。

### 5.4 實作步驟（胃口趨勢 + 提醒）

1. **資料**：由現有 `feedingHistory`（或重新命名為 `foodHistory`）篩選日期與 `intakeLevel`。
2. **首頁／圖表區**：
   - 新增「胃口趨勢」區塊（或取代／並存現有熱量圖）；
   - 依 7d/30d 彙整每日「平均攝取程度」或最後一筆攝取程度；
   - 圖表元件可用現有 chart 或簡單 View + 數值。
3. **提醒**：
   - 函式 `checkLowAppetiteAlert(logs: FeedingOwnershipLog[])`：取最近 2 天，若每天都存在一筆 `intakeLevel === 'almost_none' | 'some'` 則回傳 true；
   - 在 HomeContent 或 Records 載入時呼叫，若 true 則顯示 Alert 或小型 Banner。

---

## 六、待實作：補填記錄（忘記記 T1）

### 6.1 欄位（已存在）

- `FeedingOwnershipLog.isLateEntry?: boolean` — 標記為補填。

### 6.2 行為（Spec 六）

- 允許補填 T1：使用者事後補登一筆「當時的攝取程度」或補拍 T1（若仍保留照片）。
- UI：在「乾糧（一次給一天）」或紀錄列表提供「補填」入口；儲存時設 `isLateEntry: true`。
- 列表／詳情可顯示「補填」標籤，不影響趨勢計算（仍依 `intakeLevel` 納入）。

### 6.3 實作步驟（補填）

1. **useFeeding**：`saveOwnershipLog` 已支援 `opts.isLateEntry`；或新增 `saveLateEntryLog(...)` 強制寫入 `isLateEntry: true`。
2. **FeedingModal**：在乾糧流程或獨立入口（例如從紀錄列表點「補填」）開啟表單，流程簡化為：選擇日期／選擇或跳過 T0（若無 T0 則僅選攝取程度 + 參考克數）→ 攝取程度 → 儲存，並傳 `isLateEntry: true`。
3. **RecordsContent / RecordDetailModal**：若 `l.isLateEntry` 則顯示「補填」標籤或小字說明。

---

## 七、欄位總覽（FeedingOwnershipLog）

| 欄位 | 型別 | 使用時機 |
|------|------|----------|
| id | string | 必填 |
| createdAt | number | 必填 |
| totalGram | number | 必填；有 intakeLevel 時為「預估攝取」克數 |
| kcal | number | 選填，附帶參考 |
| ownershipType | enum | 必填 |
| selectedTagId | string \| null | 必填 |
| mode | FeedingPrecisionMode | 選填 |
| confidence | number | AI 時選填 |
| vesselId | string | 乾糧一次給一天時選填 |
| note | string | 選填 |
| **foodSourceType** | FoodSourceType | 建議必填（自動餵食器／乾糧一次／罐頭／自煮） |
| **intakeLevel** | IntakeLevel | 有選攝取程度時必填 |
| **isLateEntry** | boolean | 補填時 true |
| **canId** | string | 罐頭時選填（對應罐頭庫 id） |
| **ingredients** | string[] | 自煮時選填（食材 id 陣列） |

---

## 八、建議實作順序

1. **罐頭庫**：型別 → useCanLibrary → 罐頭庫管理 UI → FeedingModal 罐頭流程 → 儲存串接。
2. **自煮**：常數食材表 → FeedingModal 自煮流程 → 儲存（含 ingredients）。
3. **胃口趨勢圖**：篩選邏輯 → 圖表 UI（7d/30d）→ 低胃口提醒（連續 2 天）。
4. **補填記錄**：乾糧流程「補填」入口 + isLateEntry 儲存與顯示。

以上為依 Spec v1 的細部實作步驟與欄位說明，可直接依序開發或分任務進行。
