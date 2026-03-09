/**
 * 按壓時帶有縮放 + 透明度的動畫（使用 react-native-reanimated，在 UI thread 執行）
 */
import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const PRESS_SCALE = 0.97;
const PRESS_OPACITY = 0.85;
const PRESS_DURATION = 80;
const RELEASE_DURATION = 120;

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** 是否停用按壓動畫（仍可傳遞其他 Pressable 行為） */
  disableAnimation?: boolean;
}

export function AnimatedPressable({ style, children, disableAnimation, onPressIn, onPressOut, ...rest }: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(
    (event: import('react-native').GestureResponderEvent) => {
      if (!disableAnimation) {
        scale.value = withTiming(PRESS_SCALE, { duration: PRESS_DURATION });
        opacity.value = withTiming(PRESS_OPACITY, { duration: PRESS_DURATION });
      }
      onPressIn?.(event);
    },
    [disableAnimation, scale, opacity, onPressIn],
  );

  const handlePressOut = useCallback(
    (event: import('react-native').GestureResponderEvent) => {
      if (!disableAnimation) {
        scale.value = withTiming(1, { duration: RELEASE_DURATION });
        opacity.value = withTiming(1, { duration: RELEASE_DURATION });
      }
      onPressOut?.(event);
    },
    [disableAnimation, scale, opacity, onPressOut],
  );

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
