import { Text, View } from 'react-native';
import { BottomTab } from '../types/app';
import { BOTTOM_ITEMS } from '../constants';
import { palette, styles } from '../styles/common';
import { AppIcon } from './AppIcon';
import { AnimatedPressable } from './AnimatedPressable';

interface Props {
  activeTab: BottomTab;
  onTabPress: (tab: BottomTab) => void;
}

export function BottomNav({ activeTab, onTabPress }: Props) {
  return (
    <View style={styles.bottomNav}>
      {BOTTOM_ITEMS.map((item) => {
        const active = item.key === activeTab;
        return (
          <AnimatedPressable key={item.key} style={styles.navItem} onPress={() => onTabPress(item.key)}>
            <AppIcon
              name={item.icon as any}
              size={24}
              color={active ? palette.primaryStrong : palette.muted}
              style={{ marginBottom: 4 }}
            />
            <Text style={[styles.navLabel, active && styles.navActive]}>{item.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
