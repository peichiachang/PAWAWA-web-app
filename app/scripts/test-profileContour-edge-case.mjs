#!/usr/bin/env node
/**
 * 測試邊界情況：如果舊數據沒有被清除（修正前的代碼）
 */

console.log('=== 測試邊界情況：修正前的代碼行為 ===\n');

// 模擬修正前的代碼：沒有清除 profileContour
const oldCalWithoutClearing = {
  id: 'vessel_123',
  name: '測試水碗',
  vesselType: 'hydration',
  shape: 'cylinder',
  dimensions: { height: 10, radius: 8 },
  calibrationMethod: 'known_volume',
  volumeMl: 2000,
  // ⚠️ 修正前的代碼沒有清除這個
  profileContour: {
    points: [
      { y: 0, radius: 4 },
      { y: 5, radius: 4 },
      { y: 10, radius: 3 }
    ],
    confidence: 0.9
  }
};

console.log('修正前的代碼（沒有清除 profileContour）：');
console.log('   calibrationMethod:', oldCalWithoutClearing.calibrationMethod);
console.log('   profileContour:', oldCalWithoutClearing.profileContour ? '存在' : 'null/undefined');
console.log('   profileContour === null:', oldCalWithoutClearing.profileContour === null);
console.log('   profileContour === undefined:', oldCalWithoutClearing.profileContour === undefined);
console.log('');

// 模擬 useHydration 的判斷邏輯
const vessel = oldCalWithoutClearing;
const volumeMl = vessel?.volumeMl;

console.log('useHydration 判斷：');
console.log('   vessel?.calibrationMethod:', vessel?.calibrationMethod);
console.log('   vessel?.profileContour:', vessel?.profileContour ? '存在' : 'null/undefined');

// 檢查會走哪個分支
if (vessel?.calibrationMethod === 'known_volume') {
  console.log('   ✅ 會走 Mode B（已知容量模式，線性計算）');
  console.log('   ⚠️  即使 profileContour 存在，也會優先使用 known_volume 模式');
} else if (vessel?.calibrationMethod === 'side_profile' && vessel.profileContour) {
  console.log('   ❌ 會走 Mode A（側面輪廓模式，輪廓積分）');
} else {
  console.log('   ⚠️  會走 Mode B（預設線性計算）');
}

console.log('\n=== 結論 ===');
console.log('1. 修正後的代碼：profileContour = undefined');
console.log('2. 修正前的舊數據：profileContour 可能存在，但不影響計算（因為優先檢查 calibrationMethod）');
console.log('3. profileContour 不是 null，而是 undefined（修正後）或對象（修正前的舊數據）');
