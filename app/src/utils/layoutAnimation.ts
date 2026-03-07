/**
 * 在 setState 前呼叫，可使下一帧的版面變更帶有系統預設動畫（展開/收合、列表增刪等）
 * 使用 React Native 內建 LayoutAnimation，無額外依賴
 */
import { LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const preset = {
  ease: LayoutAnimation.Presets.easeInEaseOut,
  linear: LayoutAnimation.Presets.linear,
  spring: LayoutAnimation.Presets.spring,
};

/**
 * 在要觸發版面變更的 setState 之前呼叫，例如：
 *   layoutAnimation.ease();
 *   setExpanded(!expanded);
 */
export function ease(): void {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export function spring(): void {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
}
