# PAWAWA 專案（Project Cat）

本專案為 **Project Cat** 底下的 **PAWAWA** 應用程式專案。

## 專案識別

| 項目 | 內容 |
|------|------|
| **專案名稱** | PAWAWA |
| **所屬** | Project Cat（貓咪照護產品線） |
| **本 repo** | PAWAWA-web-app |
| **App 顯示名稱** | PAWAWA |
| **Expo slug** | project-cat |
| **Bundle ID (iOS)** | com.pagechang.projectcat |
| **Package (Android)** | com.pagechang.projectcat |

## 專案範圍

- **產品**：貓咪照護 App（食物、飲水、排泄、用藥、症狀、血檢紀錄與 AI 辨識）
- **平台**：Web（Vercel）、iOS、Android（Expo / React Native）
- **主要技術**：Expo SDK 54、React Native、TypeScript、AsyncStorage（本機）、可選後端 API / Gemini

## 專案結構（本 repo）

```
PAWAWA-web-app/
├── app/                 # Expo 應用（入口）
│   ├── App.tsx
│   ├── app.json
│   ├── src/
│   │   ├── components/   # UI 元件與 modals
│   │   ├── hooks/        # 各功能 hook（feeding, hydration, vessels...）
│   │   ├── services/     # AI、API、臨床摘要
│   │   ├── utils/        # 健康計算、日期、容器體積
│   │   ├── types/
│   │   └── constants/
│   └── assets/
├── docs/                 # 專案文件（本檔、PRD、設定）
├── mock-ai-api/          # 本機 AI API mock（選用）
└── scripts/              # 測試與工具腳本
```

## 快速指令

- 開發：`npm run start`（Expo）、`npm run web`（Web）
- 原生預覽：`npm run ios` / `npm run android`
- EAS 建置：`npm run build:ios:preview` / `build:android:preview`
- 型別檢查：`npm run typecheck`

## 相關文件

- [PRD 大綱](PRD-Outline.md)
- [PRD](PRD.md)
- [SDD：Web 轉 iOS/Android](SDD-PAWAWA-Web-to-iOS-Android.md)（規格驅動開發）
- [環境與建置](ENV_SETUP.md)
- [Gemini 設定](GEMINI_SETUP.md)
