# 側面輪廓重建校準方案設計

## 方案概述

使用 AI 從側面照片重建碗的實際截面形狀，取代手動測量尺寸，將誤差從 10-15% 降至 3-5%。

## 核心優勢

| 方式 | 誤差來源 | 預估誤差 |
|------|---------|---------|
| 使用者輸入尺寸 + 圓柱公式 | 碗型假設錯誤 | ±10~15% |
| 側面照輪廓重建 + 截面積分 | 相機角度、光線 | ±3~5% |

## 實作流程

### 階段 1：側面校準（一次性）

1. **拍攝側面照**
   - 使用者從正側面拍攝空碗照片
   - 確保碗口清晰可見
   - 建議：碗放在白色背景上，光線充足

2. **AI 輪廓識別**
   - 輸入：側面照片 + 碗口直徑（使用者輸入）
   - AI 輸出：
     - 左右輪廓線座標（相對於碗口）
     - 碗的實際截面形狀
     - 輪廓曲線函數（或離散點陣列）

3. **存儲輪廓數據**
   - 將輪廓數據存儲在 `VesselCalibration` 中
   - 後續計算直接使用，無需重新識別

### 階段 2：日常使用（W0/W1）

1. **俯視拍照 + 畫水位線**
   - T0：拍攝裝滿的碗（俯視）
   - T1：拍攝剩餘的碗（俯視）
   - 使用者標記水位線位置

2. **AI 計算體積**
   - 使用存儲的輪廓數據
   - 計算兩條水位線之間的截面積積分
   - 得出實際飲水量

## 資料結構設計

```typescript
export interface VesselCalibration {
  id: string;
  name: string;
  shape: VesselShape;
  
  // 傳統方式（向後相容）
  dimensions: { ... };
  volumeMl?: number;
  
  // 側面輪廓方式（新增）
  calibrationMethod?: 'dimensions' | 'side_profile';
  sideProfileImage?: string; // base64 側面照
  rimDiameterCm?: number; // 碗口直徑（唯一需要輸入的數值）
  profileContour?: ProfileContour; // 輪廓數據
}

export interface ProfileContour {
  // 輪廓點陣列（相對於碗口中心，單位：cm）
  // 從碗口（y=0）到底部（y=height）
  points: Array<{ y: number; leftRadius: number; rightRadius: number }>;
  // 或使用函數參數（如果 AI 能擬合出函數）
  functionParams?: {
    type: 'polynomial' | 'spline';
    coefficients: number[];
  };
  confidence: number; // AI 識別信心度
}
```

## AI 服務擴展

### 新增方法：`analyzeSideProfile`

```typescript
interface SideProfileAnalysisInput {
  imageBase64: string;
  rimDiameterCm: number; // 使用者輸入的碗口直徑
}

interface SideProfileAnalysisResult {
  contour: ProfileContour;
  confidence: number;
  estimatedHeightCm: number; // AI 估算的碗高度
  estimatedVolumeMl: number; // AI 估算的總容量（參考）
}
```

## 體積計算邏輯

### 使用輪廓計算體積

```typescript
function calculateVolumeFromContour(
  contour: ProfileContour,
  waterLevelTopCm: number, // T0 水位（從碗口往下）
  waterLevelBottomCm: number // T1 水位（從碗口往下）
): number {
  // 使用數值積分計算兩條水位線之間的體積
  // V = ∫[bottom to top] π × r(y)² dy
  // 其中 r(y) 是從輪廓數據插值得到的半徑
  
  let volume = 0;
  const step = 0.1; // 0.1cm 精度
  
  for (let y = waterLevelBottomCm; y <= waterLevelTopCm; y += step) {
    const radius = interpolateRadius(contour, y);
    volume += Math.PI * radius * radius * step;
  }
  
  return volume;
}
```

## 實作優先順序

### Phase 1：基礎架構（1-2 天）
1. 擴展資料結構（`VesselCalibration`）
2. 新增 AI 服務介面（`analyzeSideProfile`）
3. 修改 UI，加入側面拍攝選項

### Phase 2：AI 實作（2-3 天）
1. 實作 Gemini 側面輪廓識別 Prompt
2. 實作輪廓數據解析和存儲
3. 實作輪廓積分計算函數

### Phase 3：整合測試（1 天）
1. 整合到現有流程
2. 測試準確度
3. 優化 UI/UX

## 可行性評估

### ✅ 技術可行性：高
- Gemini Vision API 支援輪廓識別
- 數值積分計算成熟
- 資料結構擴展簡單

### ✅ 使用者體驗：良好
- 只需輸入一個數值（碗口直徑）
- 側面照只需拍一次
- 後續使用更簡單

### ⚠️ 注意事項
1. **相機角度**：需要引導使用者從正側面拍攝
2. **光線條件**：需要足夠光線以確保輪廓清晰
3. **背景**：建議白色背景，提高識別準確度
4. **向後相容**：保留傳統尺寸輸入方式

## 建議

這個方案**非常可行**，建議採用**漸進式實作**：
1. 先保留現有尺寸輸入方式
2. 新增側面輪廓方式作為**進階選項**
3. 讓使用者選擇使用哪種方式
4. 逐步優化 AI 識別準確度
