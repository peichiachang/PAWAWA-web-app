# PAWAWA Web 版

此為 PAWAWA 的 Web App 版本，功能與行動版相同。

## 啟動方式

```bash
# 安裝依賴
npm install
cd app && npm install && cd ..

# 啟動 Web 版
npm run web
```

瀏覽器會自動開啟 http://localhost:8081

## 與行動版的差異

- 使用 Expo Web 渲染
- 相機功能改為檔案上傳（Web 無原生相機 API）
- 部分原生功能（推播、感測器）在 Web 上可能有限制

## 資料儲存

Web 版使用 `localStorage` 儲存資料，與行動版的 AsyncStorage 相容。
