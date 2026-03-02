# Backlog

## 飲食辨識

### 實測驗證（待執行）

**目標**：驗證「雙圖同送、相對比較」能否將誤差從 ±52g 降到 ±10~15g。

**方式**：
1. 使用 `scripts/test-feeding-relative.mjs` 腳本
2. 將 T0、T1 照片放入 `scripts/fixtures/`（t0.jpg、t1.jpg）
3. 執行 `npm run test:feeding` 或 `cd app && node ../scripts/test-feeding-relative.mjs 20`

**建議測試情境**：
- **情境 A**：T0 = T1（同張圖或同場景同食物量）→ 理論值 0g，看是否還會出現 50g 級誤差
- **情境 B**：明顯有吃（剩約一半）→ 若有電子秤可測實際克數比對

**判斷標準**：
- 情境 A：mean 接近 0、std < 15g、無 >25g 的 outlier → 相對比較有明顯改善
- 情境 B：mean 與實際克數差 < 20g、std < 15g → 可接受

---
