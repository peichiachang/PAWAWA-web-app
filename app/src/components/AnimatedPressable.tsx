/**
 * 按壓時帶有縮放 + 透明度的小動畫（使用 React Native 內建 Animated，無額外依賴）
 */
import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

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
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (!disableAnimation) {
      Animated.parallel([
        Animated.timing(scale, { toValue: PRESS_SCALE, duration: PRESS_DURATION, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: PRESS_OPACITY, duration: PRESS_DURATION, useNativeDriver: true }),
      ]).start();
    }
    onPressIn?.();
  }, [disableAnimation, scale, opacity, onPressIn]);

  const handlePressOut = useCallback(() => {
    if (!disableAnimation) {
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: RELEASE_DURATION, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: RELEASE_DURATION, useNativeDriver: true }),
      ]).start();
    }
    onPressOut?.();
  }, [disableAnimation, scale, opacity, onPressOut]);

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
