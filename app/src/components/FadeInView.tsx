/**
 * 掛載時淡入（使用 React Native 內建 Animated）
 */
import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
  delay?: number;
}

export function FadeInView({ children, style, duration = 220, delay = 0 }: FadeInViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }).start();
    const id = delay > 0 ? setTimeout(run, delay) : undefined;
    if (delay === 0) run();
    return () => { if (id != null) clearTimeout(id); };
  }, [opacity, duration, delay]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
