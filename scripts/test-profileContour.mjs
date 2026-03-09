#!/usr/bin/env node
/**
 * 測試 profileContour 在已知容量模式下的值
 * 模擬 VesselCalibrationModal 的儲存邏輯
 */

console.log('=== 測試 profileContour 在已知容量模式下的值 ===\n');

// 模擬一個之前是側面輪廓模式的容器（有 profileContour）
const oldProfile = {
  id: 'vessel_123',
  name: '測試水碗',
  vesselType: 'hydration',
  shape: 'cylinder',
  dimensions: { height: 10, radius: 8 },
  calibrationMethod: 'side_profile',
  profileContour: {
    points: [
      { y: 0, radius: 4 },
      { y: 5, radius: 4 },
      { y: 10, radius: 3 }
    ],
    confidence: 0.9
  },
  sideProfileImageBase64: 'base64data...',
  volumeMl: 1000
};

console.log('1. 舊的容器資料（側面輪廓模式）：');
console.log('   calibrationMethod:', oldProfile.calibrationMethod);
console.log('   profileContour:', oldProfile.profileContour ? '存在' : 'null/undefined');
console.log('   profileContour === null:', oldProfile.profileContour === null);
console.log('   profileContour === undefined:', oldProfile.profileContour === undefined);
console.log('');

// 模擬 VesselCalibrationModal.handleSaveProfile 的邏輯
// 當用戶切換到已知容量模式時
const newCal = {
  id: oldProfile.id,
  name: oldProfile.name,
  vesselType: oldProfile.vesselType,
  shape: oldProfile.shape,
  dimensions: oldProfile.dimensions,
  // 已知容量模式：明確標記為 known_volume
  calibrationMethod: 'known_volume',
  calibrationFactor: undefined,
  measuredVolumeMl: undefined,
  profileContour: undefined, // 清除側面輪廓數據
  sideProfileImageBase64: undefined, // 清除側面照
  volumeMl: 2000
};

console.log('2. 切換到已知容量模式後的容器資料：');
console.log('   calibrationMethod:', newCal.calibrationMethod);
console.log('   profileContour:', newCal.profileContour);
console.log('   profileContour === null:', newCal.profileContour === null);
console.log('   profileContour === undefined:', newCal.profileContour === undefined);
console.log('   volumeMl:', newCal.volumeMl);
console.log('');

// 模擬 useHydration 的檢查邏輯
console.log('3. useHydration 中的判斷邏輯：');
const vessel = newCal;
const volumeMl = vessel?.volumeMl;

console.log('   vessel?.calibrationMethod:', vessel?.calibrationMethod);
console.log('   vessel?.profileContour:', vessel?.profileContour);
console.log('   vessel?.profileContour === null:', vessel?.profileContour === null);
console.log('   vessel?.profileContour === undefined:', vessel?.profileContour === undefined);

// 檢查會走哪個分支
if (vessel?.calibrationMethod === 'known_volume') {
  console.log('   ✅ 會走 Mode B（已知容量模式，線性計算）');
} else if (vessel?.calibrationMethod === 'side_profile' && vessel.profileContour) {
  console.log('   ❌ 會走 Mode A（側面輪廓模式，輪廓積分）');
} else {
  console.log('   ⚠️  會走 Mode B（預設線性計算）');
}

console.log('\n=== 測試結果 ===');
console.log('profileContour 的值:', vessel?.profileContour);
console.log('profileContour === null:', vessel?.profileContour === null);
console.log('profileContour === undefined:', vessel?.profileContour === undefined);
console.log('\n結論：在已知容量模式下，profileContour 應該是 undefined（不是 null）');
