# Carecat App

跨平台 App 專案（iOS + Android）建議採用 `React Native + Expo + TypeScript`。

## 建議技術選型

- Frontend/App: `React Native` + `Expo`
- 語言: `TypeScript`
- 狀態管理: `Zustand`（輕量）或 `Redux Toolkit`（大型專案）
- 後端（擇一）:
- `Supabase`（快速上線）
- `Firebase`（整合通知與分析方便）
- `NestJS + PostgreSQL`（高度客製）
- 發版: `EAS Build` + `App Store Connect` + `Google Play Console`

## 為什麼這樣選

- 一套程式碼同時上架 iOS/Android，開發效率高。
- Expo 對簽章、打包、OTA 更新與 CI/CD 友善。
- TypeScript 對中大型 App 的可維護性最好。

## 快速開始

1. 先完成環境需求（見 `docs/ENV_SETUP.md`）。
2. 執行：

```bash
./scripts/bootstrap.sh
```

3. 建立專案後進入 app 資料夾啟動：

```bash
cd app
npm run start
```

## 目錄說明

- `docs/ENV_SETUP.md`: macOS / iOS / Android / 上架前置
- `scripts/bootstrap.sh`: 建立 Expo(TypeScript) 專案與基本發版工具
