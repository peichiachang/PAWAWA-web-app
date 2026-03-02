# Carecat AI 辨識功能（MVP）

## 已實作（App 端）

- M1 飲食辨識（T0/T1）：
- 介面：`analyzeFeedingImages({ t0, t1 })`
- 輸出：碗數、個體歸屬、每碗攝取克數、家庭總攝取克數

- M1 營養 OCR：
- 介面：`extractNutritionLabel(image)`
- 輸出：`kcal/g`、`Protein %`、`Phosphorus %`

- M2 飲水辨識 + 蒸發修正：
- 介面：`analyzeHydrationImages({ t0, t1 })`
- 輸出：T0/T1 水量、溫濕度、蒸發修正量、實際飲水量

- 排泄影像判讀：
- 介面：`analyzeEliminationImage(image)`
- 輸出：顏色、型態、異常與信心度

圖片輸入支援：
- `imageBase64` + `mimeType`（實拍）
- `imageRef`（兼容舊流程）

## 程式位置

- AI 型別：`/Users/pagechang/Documents/New project/Project Cat/app/src/types/ai.ts`
- Mock AI：`/Users/pagechang/Documents/New project/Project Cat/app/src/services/ai/mockAiService.ts`
- Provider 入口：`/Users/pagechang/Documents/New project/Project Cat/app/src/services/ai/index.ts`

## 切換真實後端

在 `app/src/services/ai/index.ts`：

- 將 `AI_SERVICE_MODE` 由 `mock` 改為 `http`
- 設定 `EXPO_PUBLIC_API_BASE_URL` 或讓系統自動抓 Expo LAN host

後端需要提供 4 個 POST endpoint：

- `/ai/feeding`
- `/ai/nutrition-ocr`
- `/ai/hydration`
- `/ai/elimination`

回傳 JSON 格式需對應 `app/src/types/ai.ts` 的型別。

## 安裝相機套件

```bash
cd "/Users/pagechang/Documents/New project/Project Cat/app"
npx expo install expo-image-picker
```
