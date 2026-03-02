# Gemini API 串接說明（Carecat）

## 1) 取得 API Key

先在 Google AI Studio 建立 `GEMINI_API_KEY`。

## 2) 建立 `.env`

在專案根目錄建立 `.env`（可從 `.env.example` 複製）：

```bash
cd "/Users/pagechang/Documents/New project/carecat"
cp .env.example .env
```

修改 `.env`：

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=你的新金鑰
GEMINI_MODEL=gemini-2.0-flash
GEMINI_FALLBACK_TO_MOCK=true
PORT=8080
```

## 3) 啟動本地 API（Gemini 模式）

```bash
cd "/Users/pagechang/Documents/New project/carecat"
npm run mock-api
```

## 4) 測試端點

開另一個終端機：

```bash
cd "/Users/pagechang/Documents/New project/carecat"
./scripts/test-ai-endpoints.sh "http://localhost:8080"
```

## 5) App 端切到 http provider

修改：
`/Users/pagechang/Documents/New project/carecat/app/src/services/ai/index.ts`

- `AI_SERVICE_MODE` 改為 `http`
- API base URL 依執行環境選擇：
- iOS Simulator: `http://localhost:8080`
- Android Emulator: `http://10.0.2.2:8080`
- 真機（同 Wi-Fi）：`http://你的電腦區網IP:8080`

## 6) 注意事項（目前版本）

- 目前傳給 API 的是 `imageRef` 字串（示意），不是實際影像檔。
- 若要真實辨識，你下一步需要：
- App 端改成上傳 base64 或檔案
- 後端把影像內容送進 Gemini multimodal 請求
