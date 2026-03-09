import React from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export type AppIconName =
  | 'home'
  | 'pets'
  | 'create'
  | 'menu-book'
  | 'person'
  | 'check-circle'
  | 'cancel'
  | 'warning'
  | 'opacity'
  | 'restaurant'
  | 'medication'
  | 'assignment'
  | 'camera-alt'
  | 'edit'
  | 'receipt'
  | 'description'
  | 'bar-chart'
  | 'save'
  | 'notifications'
  | 'diamond'
  | 'history'
  | 'smart-toy'
  | 'image'
  | 'settings'
  | 'water-drop'
  | 'healing'
  | 'vaccines'
  | 'bloodtype'
  | 'coronavirus'
  | 'paw'
  | 'lightbulb'
  | 'straighten'
  | 'analytics'
  | 'backup'
  | 'sync'
  | 'smartphone'
  | 'expand-more'
  | 'expand-less'
  | string;

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle | TextStyle>;
}

export function AppIcon({ name, size = 20, color = '#000000', style }: AppIconProps) {
  return <MaterialIcons name={name as any} size={size} color={color} style={style} />;
}

interface IconTextProps {
  icon: AppIconName;
  text: string;
  iconSize?: number;
  iconColor?: string;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export function IconText({
  icon,
  text,
  iconSize = 16,
  iconColor = '#000000',
  textStyle,
  containerStyle,
}: IconTextProps) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, containerStyle]}>
      <AppIcon name={icon} size={iconSize} color={iconColor} />
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}
