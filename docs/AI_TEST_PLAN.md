# AI 實測計畫（Carecat）

## 目標

- 驗證 AI API 是否可被 App 正常呼叫
- 驗證回傳 JSON 是否符合前端型別
- 建立第一版「可行性」結果（非最終醫療級驗證）

## 測試前準備

1. 確認 AI 後端可存取（本機或雲端）
2. 取得 API Base URL（例：`http://localhost:8080`）
3. 確認四個端點已實作：
- `POST /ai/feeding`
- `POST /ai/nutrition-ocr`
- `POST /ai/hydration`
- `POST /ai/elimination`

## 一鍵 API 測試

在專案根目錄執行：

```bash
cd "/Users/pagechang/Documents/New project/carecat"
./scripts/test-ai-endpoints.sh "http://localhost:8080"
```

若端點正常，會印出每個 endpoint 的 HTTP 狀態與 JSON 回應。

## 驗收標準（第一版）

- HTTP 狀態皆為 `200`
- 回應 JSON 欄位完整且型別正確
- App 端可顯示分析結果，不出現錯誤 alert
- 分析中有 loading，完成後有結果區塊

## App 端切換到真實 API

編輯：
`/Users/pagechang/Documents/New project/carecat/app/src/services/ai/index.ts`

1. 把 `AI_SERVICE_MODE` 改成 `http`
2. 把 `https://your-api.example.com` 改成你的 API Base URL

## 第二階段（模型準確率）

- 餵食/飲水：對照真值（秤重/量杯）算 MAPE
- OCR：欄位正確率（kcal/g、Protein%、Phosphorus%）
- 排泄辨識：Precision/Recall/F1
- 場景測試：低光、反光、遮擋、不同手機鏡頭
