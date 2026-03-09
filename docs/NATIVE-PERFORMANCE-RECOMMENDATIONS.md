# 原生效能優化建議

以下為可透過「更貼近原生效能」改善體驗的項目，依效益與實作成本排序，供排程參考。

---

## 1. 紀錄列表虛擬化（建議優先）

**位置**：`app/src/components/RecordsContent.tsx`  
**現狀**：完整紀錄區塊使用 `filteredRecords.map()` 一次渲染所有項目，無虛擬化。  
**問題**：紀錄筆數多（例如數百筆）時，會一次建立大量節點，造成捲動卡頓、記憶體上升，在低階機上尤其明顯。  
**建議**：改用 **FlatList**（React Native 內建，無需加依賴）或 **FlashList**（@shopify/flash-list，原生回收更積極）。

```tsx
// 現狀
{filteredRecords.map(record => (
  <RecordLogItem key={record.id} record={record} cats={cats} onRecordPress={onRecordPress} />
))}

// 建議：改為 FlatList
<FlatList
  data={filteredRecords}
  keyExtractor={(r) => r.id}
  renderItem={({ item }) => <RecordLogItem record={item} cats={cats} onRecordPress={onRecordPress} />}
  ListEmptyComponent={<Text style={{ fontSize: 13, color: '#666' }}>尚無符合條件的紀錄</Text>}
  contentContainerStyle={{ paddingBottom: 40 }}
  removeClippedSubviews={true}
  maxToRenderPerBatch={15}
  windowSize={8}
/>
```

- **FlatList**：內建虛擬化、原生捲動，僅渲染可見區＋少量緩衝，符合 SDD §8.1 體感流暢。
- **FlashList**：若之後列表項結構更複雜或筆數常破百，可評估引入，回收與重用量更接近原生 ListView。

**效益**：高（列表為常用畫面、資料量會隨時間成長）。  
**依賴**：無（FlatList）或新增 @shopify/flash-list（FlashList）。

---

## 2. 鍵盤與輸入框（Modal 內表單）

**位置**：各 Modal（VesselCalibrationModal、FeedingModal、HydrationModal、AddCatModal、FeedLibraryModal 等）內含多個 `TextInput`。  
**現狀**：多為 `ScrollView` 包表單，未使用 `KeyboardAvoidingView`。  
**問題**：在 iOS/Android 上鍵盤彈起時，輸入框可能被遮住，使用者需手動捲動才能看到輸入內容，體感不如原生表單。  
**建議**：在「以表單為主的 Modal」最外層，用 **KeyboardAvoidingView** 包住內容（或包住 ScrollView），並依平台設定 `behavior`（iOS 常用 `padding`，Android 可用 `height` 或 `padding`）。

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

// 在 Modal 內容最外層
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    {/* 表單內容 */}
  </ScrollView>
</KeyboardAvoidingView>
```

可先套用在「輸入欄位多、使用者常連續填寫」的畫面（例如 VesselCalibrationModal、FeedingModal）。  
**效益**：中高（明顯提升輸入體驗，符合原生預期）。  
**依賴**：無，React Native 內建。

---

## 3. 首頁／其他短列表

**位置**：`app/src/components/HomeContent.tsx` 的「食物記錄／飲水／排泄…」等區塊。  
**現狀**：已用 `.slice(0, 5)` 限制筆數，再以 `.map()` 渲染。  
**建議**：目前筆數少，維持現狀即可。若日後改為「顯示更多」或不再限制筆數，可改為 **FlatList** 或 **FlashList**，理由同 §1。  
**效益**：目前低；若放寬筆數則與 §1 同。

---

## 4. 圖片記憶體與快取（可選）

**位置**：使用 `Image.getSize`、`<Image source={{ uri }} />` 的元件（例如 WaterLevelMarker、各 Modal 內顯示拍照結果）。  
**現狀**：使用 React Native 內建 `Image`，無額外快取策略。  
**建議**：若之後有「大量圖片列表」（例如紀錄列表每筆帶縮圖、或罐頭庫／飼料庫多圖），可評估 **expo-image**（Expo 官方，具記憶體與磁碟快取、優先級載入），減少重複解碼與 OOM 風險。目前以單張／少量圖片為主，可列為後續優化。  
**效益**：目前中低；圖片一多則變高。  
**依賴**：expo-image（與現有 Expo 生態一致）。

---

## 5. 動畫（已實作）

**位置**：`AnimatedPressable`、`FadeInView`、`layoutAnimation`。  
**現狀**：已引入 **react-native-reanimated**（與 react-native-worklets），按壓與淡入動畫改為 Reanimated，在 UI thread 執行；LayoutAnimation 維持不變（版面展開/收合）。  
**已做**：`npx expo install react-native-reanimated react-native-worklets`；`AnimatedPressable`、`FadeInView` 改為 `useSharedValue` + `useAnimatedStyle` + `withTiming` / `withDelay`，使用 Reanimated 的 `Animated.View`。Babel 由 babel-preset-expo 自動設定，無需額外 config。  
**效益**：按壓、淡入動畫不佔 JS thread，有利後續手勢或高頻動畫擴充。  
**依賴**：react-native-reanimated ~4.x、react-native-worklets（已列入 app/package.json）。

---

## 總結

| 項目           | 效益   | 實作成本 | 狀態     |
|----------------|--------|----------|----------|
| 紀錄列表虛擬化 | 高     | 低       | 已實作   |
| 鍵盤避免遮擋   | 中高   | 低       | 已實作   |
| 首頁列表       | 目前低 | 低       | 已實作   |
| 圖片快取       | 視用量 | 中       | 可選     |
| 進階動畫       | 低～中 | 中       | 已實作   |

已實作：§1 紀錄列表 FlatList、§2 Modal KeyboardAvoidingView、§3 首頁 FlatList、§5 Reanimated（AnimatedPressable、FadeInView）。未做：§4 圖片快取（視需求）。
