# 為什麼會發生 404（後端 API 找不到）

## 原因說明

- 前端在 **production web** 會打 **same-origin**：`POST /api/ai/feeding`（以及 `/api/ai/nutrition-ocr`、`/api/ai/hydration` 等）。
- 實際請求的完整網址為：`https://你的網域/api/ai/feeding`。
- **Vercel 只會把「專案根目錄底下的 `api/`」當成 Serverless Functions 部署**；程式碼若只放在 `app/api/`，Vercel 不會為這些檔案建立對應的 API 路由。
- 因此部署後沒有「根目錄的 `api/`」時，`/api/ai/feeding` 等路徑就會回傳 **404**。

## 本專案已做的修正

- 已在**專案根目錄**建立 `api/ai/*.js`，並在內層轉呼叫 `app/api/_lib/ai.js` 的邏輯。
- 這樣 Vercel 會：
  - 部署根目錄的 `api/ai/feeding.js` → 對應 **POST /api/ai/feeding**
  - 同理部署 `nutrition-ocr`、`hydration`、`elimination`、`blood-ocr`、`side-profile`。
- 重新部署後，上述路徑應可正常回應，不再 404。

## 部署後請確認

1. **重新部署**：推送後讓 Vercel 再 build/deploy 一次。
2. **環境變數**（若使用 Gemini）：在 Vercel 專案設定中設定 `GEMINI_API_KEY`、必要時 `AI_PROVIDER=gemini`。
3. **測試**：開啟「食物記錄」→ 拍 T0、T1，若仍 404，可對 `https://你的網域/api/ai/feeding` 直接發 POST 測試（或看 Vercel Functions 的 log）。

## 若仍 404

- 到 Vercel Dashboard → 該專案 → **Settings** → **Functions**，確認根目錄 `api/` 有被辨識。
- 查看 **Deployments** → 該次部署的 **Functions** 清單，是否有 `api/ai/feeding` 等。
- 確認 `vercel.json` 沒有把 `api` 排除或改寫到錯誤路徑。
