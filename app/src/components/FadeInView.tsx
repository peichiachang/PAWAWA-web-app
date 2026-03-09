/**
 * 掛載時淡入（使用 react-native-reanimated，在 UI thread 執行）
 */
import React, { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';

interface FadeInViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
  delay?: number;
}

export function FadeInView({ children, style, duration = 220, delay = 0 }: FadeInViewProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = delay > 0
      ? withDelay(delay, withTiming(1, { duration }))
      : withTiming(1, { duration });
  }, [opacity, duration, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
