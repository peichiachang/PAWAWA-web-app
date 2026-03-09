/**
 * 檢查容器資料中的 profileContour 值
 * 用於確認已知容量模式下 profileContour 是否為 null
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// 模擬 AsyncStorage 的儲存位置（實際位置取決於平台）
// 這裡我們檢查是否有模擬數據或實際數據文件

console.log('檢查容器資料中的 profileContour 值...\n');

// 嘗試讀取可能的數據文件位置
const possiblePaths = [
  join(process.cwd(), 'app', 'data', 'vessel_profiles.json'),
  join(process.cwd(), 'mock-data', 'vessel_profiles.json'),
];

let foundData = false;

for (const path of possiblePaths) {
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    console.log(`找到數據文件: ${path}\n`);
    foundData = true;
    
    if (Array.isArray(data)) {
      data.forEach((vessel, index) => {
        console.log(`容器 ${index + 1}: ${vessel.name || '未命名'}`);
        console.log(`  calibrationMethod: ${vessel.calibrationMethod || 'undefined'}`);
        console.log(`  volumeMl: ${vessel.volumeMl || 'undefined'}`);
        console.log(`  profileContour: ${vessel.profileContour === null ? 'null' : vessel.profileContour === undefined ? 'undefined' : '存在'}`);
        if (vessel.profileContour) {
          console.log(`    points 數量: ${vessel.profileContour.points?.length || 0}`);
        }
        console.log('');
      });
    } else {
      console.log('數據格式不是陣列:', typeof data);
    }
    break;
  } catch (e) {
    // 文件不存在，繼續嘗試下一個
  }
}

if (!foundData) {
  console.log('未找到數據文件。');
  console.log('請在應用程序中執行以下代碼來檢查：');
  console.log(`
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VESSEL_PROFILES_KEY } from './src/constants';

async function checkProfileContour() {
  const raw = await AsyncStorage.getItem(VESSEL_PROFILES_KEY);
  if (raw) {
    const profiles = JSON.parse(raw);
    profiles.forEach((vessel, i) => {
      console.log(\`容器 \${i + 1}: \${vessel.name}\`);
      console.log(\`  calibrationMethod: \${vessel.calibrationMethod}\`);
      console.log(\`  volumeMl: \${vessel.volumeMl}\`);
      console.log(\`  profileContour: \${vessel.profileContour === null ? 'null' : vessel.profileContour === undefined ? 'undefined' : '存在'}\`);
    });
  }
}
checkProfileContour();
  `);
}
