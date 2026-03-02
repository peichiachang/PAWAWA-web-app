#!/usr/bin/env node
/**
 * 飲水體積計算（純數學，不需圖片、不需 AI）
 *
 * 直接給定 Y 座標（模擬使用者畫線），每次結果完全相同：
 *
 *   const w0_marking = { top: 280, bottom: 820, water: 423 }
 *   const w1_marking = { top: 280, bottom: 820, water: 612 }
 *   const intake_ml = calculate(w0_marking, w1_marking, 1800)
 *
 * 環境變數：
 *   BOWL_TOP_Y, BOWL_BOTTOM_Y, W0_WATER_Y, W1_WATER_Y, BOWL_VOLUME_ML
 *
 * 範例：
 *   BOWL_TOP_Y=280 BOWL_BOTTOM_Y=820 W0_WATER_Y=423 W1_WATER_Y=612 BOWL_VOLUME_ML=1800 node scripts/test-hydration-accuracy.mjs
 */

/**
 * 依標記 Y 座標計算飲用量（不需圖片、不需 AI，每次結果完全相同）
 * @param w0_marking { top, bottom, water }
 * @param w1_marking { top, bottom, water }
 * @param bowlVolumeMl 容器容量
 */
function calculate(w0_marking, w1_marking, bowlVolumeMl) {
  const bowlPx = w0_marking.bottom - w0_marking.top;
  if (bowlPx <= 0) throw new Error('bottom 必須大於 top');
  const w0Ratio = (w0_marking.bottom - w0_marking.water) / bowlPx;
  const w1Ratio = (w1_marking.bottom - w1_marking.water) / bowlPx;
  return Math.round(Math.max(0, (w0Ratio - w1Ratio) * bowlVolumeMl));
}

function calcFromPixels(bowlTopY, bowlBottomY, w0WaterY, w1WaterY, bowlVolumeMl) {
  const bowlPx = bowlBottomY - bowlTopY;
  if (bowlPx <= 0) throw new Error('BOWL_BOTTOM_Y 必須大於 BOWL_TOP_Y');
  const w0Ratio = (bowlBottomY - w0WaterY) / bowlPx;
  const w1Ratio = (bowlBottomY - w1WaterY) / bowlPx;
  const waterT0Ml = Math.round(Math.max(0, Math.min(1, w0Ratio)) * bowlVolumeMl);
  const waterT1Ml = Math.round(Math.max(0, Math.min(1, w1Ratio)) * bowlVolumeMl);
  const intakeMl = (w0Ratio - w1Ratio) * bowlVolumeMl;
  const actualIntakeMl = Math.round(Math.max(0, intakeMl));
  return {
    waterT0Ml,
    waterT1Ml,
    actualIntakeMl,
    w0Ratio: Math.max(0, Math.min(1, w0Ratio)),
    w1Ratio: Math.max(0, Math.min(1, w1Ratio)),
  };
}

function main() {
  const bowlTopY = process.env.BOWL_TOP_Y != null ? parseFloat(process.env.BOWL_TOP_Y) : null;
  const bowlBottomY = process.env.BOWL_BOTTOM_Y != null ? parseFloat(process.env.BOWL_BOTTOM_Y) : null;
  const w0WaterY = process.env.W0_WATER_Y != null ? parseFloat(process.env.W0_WATER_Y) : null;
  const w1WaterY = process.env.W1_WATER_Y != null ? parseFloat(process.env.W1_WATER_Y) : null;
  const bowlVolumeMl = parseInt(process.env.BOWL_VOLUME_ML || process.env.VESSEL_VOLUME_ML || '1800', 10);
  const expectedMl = process.env.EXPECTED_INTAKE_ML ? parseFloat(process.env.EXPECTED_INTAKE_ML) : null;

  if (bowlTopY == null || bowlBottomY == null || w0WaterY == null || w1WaterY == null) {
    console.error('請設定 BOWL_TOP_Y、BOWL_BOTTOM_Y、W0_WATER_Y、W1_WATER_Y');
    console.error('範例：BOWL_TOP_Y=280 BOWL_BOTTOM_Y=820 W0_WATER_Y=423 W1_WATER_Y=612 BOWL_VOLUME_ML=1800 node scripts/test-hydration-accuracy.mjs');
    process.exit(1);
  }

  const r = calcFromPixels(bowlTopY, bowlBottomY, w0WaterY, w1WaterY, bowlVolumeMl);

  console.log('=== 飲水體積計算（像素座標）===\n');
  console.log(`輸入：碗口=${bowlTopY}px 碗底=${bowlBottomY}px 碗高=${bowlBottomY - bowlTopY}px`);
  console.log(`      W0水面=${w0WaterY}px W1水面=${w1WaterY}px 容量=${bowlVolumeMl}ml`);
  if (expectedMl != null) console.log(`預期飲用量：${expectedMl}ml`);
  console.log('');
  console.log(`  W0 滿水比：${(r.w0Ratio * 100).toFixed(1)}% → ${r.waterT0Ml}ml`);
  console.log(`  W1 滿水比：${(r.w1Ratio * 100).toFixed(1)}% → ${r.waterT1Ml}ml`);
  console.log(`  飲用量：${r.actualIntakeMl}ml`);

  if (expectedMl != null) {
    const errPct = ((Math.abs(r.actualIntakeMl - expectedMl) / expectedMl) * 100).toFixed(1);
    console.log(`  與預期誤差：${errPct}%`);
    process.exit(parseFloat(errPct) > 30 ? 1 : 0);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
