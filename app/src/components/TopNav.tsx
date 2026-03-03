import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Level } from '../types/app';
import { CatIdentity } from '../types/domain';
import { palette, styles } from '../styles/common';
import { extractCatSeries, getScopedCats } from '../utils/catScope';

interface Props {
  level: Level;
  onLevelChange: (level: Level) => void;
  cats: CatIdentity[];
  activeTab: string;
}

export function TopNav({ level, onLevelChange, cats, activeTab }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);

  const levelItems = useMemo(() => {
    const household = { key: 'household' as Level, name: '家庭' };
    const catItems = getScopedCats(cats).map((cat) => ({
      key: (extractCatSeries(cat.id) || cat.id) as Level,
      name: cat.name,
    }));
    return [household, ...catItems];
  }, [cats]);

  const currentItem = useMemo(
    () => levelItems.find(item => extractCatSeries(item.key) === extractCatSeries(level)) ?? levelItems[0],
    [levelItems, level]
  );

  function openMenu() {
    setMenuVisible(true);
  }

  function selectLevel(key: Level) {
    onLevelChange(key);
    setMenuVisible(false);
  }

  return (
    <View style={styles.topNav}>
      <Text style={styles.appTitle}>PAWAWA</Text>
      {activeTab === 'home' && (
        <View style={styles.levelDropdownWrap}>
          <Pressable
            onPress={openMenu}
            style={[styles.levelTab, styles.levelTabSingle]}
          >
            <MaterialIcons
              name={currentItem.key === 'household' ? 'home' : 'pets'}
              size={16}
              color={palette.text}
              style={styles.levelIcon}
            />
            <Text style={styles.levelName}>{currentItem.name}</Text>
            <MaterialIcons
              name={menuVisible ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={18}
              color={palette.text}
              style={styles.levelArrow}
            />
          </Pressable>
          {menuVisible && (
            <>
              <Pressable
                style={styles.levelDropdownBackdrop}
                onPress={() => setMenuVisible(false)}
              />
              <View style={styles.levelDropdownMenu}>
                {levelItems.map((item, index) => {
                  const active = extractCatSeries(item.key) === extractCatSeries(level);
                  const isLast = index === levelItems.length - 1;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => selectLevel(item.key)}
                      style={[
                        styles.levelDropdownItem,
                        active && styles.levelDropdownItemActive,
                        isLast && styles.levelDropdownItemLast,
                      ]}
                    >
                      <MaterialIcons
                        name={item.key === 'household' ? 'home' : 'pets'}
                        size={16}
                        color={active ? palette.onPrimary : palette.text}
                        style={styles.levelIcon}
                      />
                      <Text style={[styles.levelName, active && styles.levelTextActive]}>{item.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}
