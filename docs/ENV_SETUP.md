# Carecat 環境建置（macOS）

## 1) 必裝工具

- `Node.js`：建議 `20.x` 或 `22.x` LTS
- `npm`：隨 Node 安裝
- `Watchman`：`brew install watchman`
- `Xcode`（iOS 編譯與上架）
- `Android Studio`（Android SDK + Emulator）
- `EAS CLI`：`npm i -g eas-cli`

## 2) iOS 環境

- 安裝 Xcode 後，打開一次並同意 License。
- 安裝 iOS Simulator（Xcode > Settings > Platforms）。
- 登入 Apple Developer 帳號（上架需要付費帳號）。

## 3) Android 環境

- Android Studio 安裝以下項目：
- Android SDK Platform (最新穩定版)
- Android SDK Build-Tools
- Android Emulator
- 建立至少一台虛擬機（Pixel 系列建議）。

建議在 shell 設定 Android 環境變數：

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH
```

## 4) 專案初始化

在 `carecat` 根目錄執行：

```bash
./scripts/bootstrap.sh
```

初始化完成後：

```bash
cd app
npm run start
npm run ios
npm run android
```

## 5) 上架流程概要

- 建立 Expo/EAS 專案：`eas init`
- iOS 打包：`eas build -p ios`
- Android 打包：`eas build -p android`
- iOS 上傳：`eas submit -p ios`
- Android 上傳：`eas submit -p android`

## 6) 建議的程式碼規範

- 全專案使用 TypeScript（禁止新增 JS 檔，除工具設定檔）。
- 網路層、狀態層、畫面層分層。
- 加上 `ESLint + Prettier` 與 pre-commit 檢查。
