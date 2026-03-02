# 測試素材

## 飲食辨識

將 T0、T1 照片放入此資料夾：

- **t0.jpg**：給飯前（裝滿食物）的照片
- **t1.jpg**：剩食後的照片

### 測試情境建議

1. **情境 A（理論值 0g）**：T0 與 T1 為同一張圖或同場景同食物量，驗證是否會誤判
2. **情境 B（有吃）**：明顯有進食，若有電子秤可記錄實際克數比對

### 執行方式

```bash
cd app && node scripts/test-consumption-level-consistency.mjs 10
T0_REF_GRAMS=63 node scripts/test-consumption-level-consistency.mjs 10
```

---

## 飲水辨識

**純手動計算，無 AI**。依像素 Y 座標計算飲用量。

### 公式

```
bowl_px = bowl_bottom_y - bowl_top_y
w0_ratio = (bowl_bottom_y - w0_water_y) / bowl_px   // 滿水比例
w1_ratio = (bowl_bottom_y - w1_water_y) / bowl_px
intake_ml = (w0_ratio - w1_ratio) * bowl_volume_ml
```

### 執行方式

```bash
cd app
BOWL_TOP_Y=280 BOWL_BOTTOM_Y=820 W0_WATER_Y=423 W1_WATER_Y=612 BOWL_VOLUME_ML=1800 node scripts/test-hydration-accuracy.mjs
```

### 準確度驗證（可選）

```bash
BOWL_TOP_Y=280 BOWL_BOTTOM_Y=820 W0_WATER_Y=423 W1_WATER_Y=612 BOWL_VOLUME_ML=1800 EXPECTED_INTAKE_ML=630 node scripts/test-hydration-accuracy.mjs
```

---

飲食辨識腳本需設定 `EXPO_PUBLIC_GEMINI_API_KEY`。
