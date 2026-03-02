# Mock AI API（本地）

## 啟動

```bash
cd "/Users/pagechang/Documents/New project/Project Cat"
npm run mock-api
```

預設位址：`http://localhost:8080`

會自動讀取根目錄 `.env`（若存在）。

開發模式（改後端檔案自動重啟）：

```bash
cd "/Users/pagechang/Documents/New project/Project Cat"
npm run mock-api:dev
```

## 健康檢查

```bash
curl http://localhost:8080/health
```

AI 狀態檢查（Gemini 可用性）：

```bash
curl http://localhost:8080/health/ai | jq .
```

- `ready: true` 代表目前可正常使用 provider
- `ready: false` 代表目前不可用（例如 quota / key 問題）
- `lastError` 會顯示最近一次 Gemini 錯誤摘要

## 飲水蒸發修正（Weather API）

飲水模組會用 Open-Meteo 目前天氣（溫度、濕度）與 T0→T1 經過時間計算蒸發修正量：

`actualIntakeMl = (waterT0Ml - waterT1Ml) - envFactorMl`

可在根目錄 `.env` 設定：

- `WEATHER_LAT`
- `WEATHER_LON`
- `WATER_SURFACE_CM2`（容器水面面積）
- `DEFAULT_TEMP_C`
- `DEFAULT_HUMIDITY_PCT`

## 支援端點

- `POST /ai/feeding`
- `POST /ai/nutrition-ocr`
- `POST /ai/hydration`
- `POST /ai/elimination`

## 快速實測

開新終端機執行：

```bash
cd "/Users/pagechang/Documents/New project/Project Cat"
./scripts/test-ai-endpoints.sh "http://localhost:8080"
```

## 讓 App 直接吃本地 mock API

編輯：`/Users/pagechang/Documents/New project/Project Cat/app/src/services/ai/index.ts`

1. 把 `AI_SERVICE_MODE` 改成 `http`
2. API base URL 改成：
- iOS 模擬器：`http://localhost:8080`
- Android 模擬器：`http://10.0.2.2:8080`
- 真機（同 Wi-Fi）：`http://你的電腦區網IP:8080`
