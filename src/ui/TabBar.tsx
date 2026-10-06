import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { radius, space, tapTarget, useTheme } from '@/theme';

import { FocusRing, noNativeOutline } from './FocusRing';
import { Icon, type IconName } from './icons/Icon';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';
import { usePressDepth } from './usePressDepth';
import { spaceActivates } from './webKeys';

export interface TabItem<K extends string = string> {
  key: K;
  label: string;
  icon: IconName;
}

export interface TabBarProps<K extends string = string> {
  items: readonly TabItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  /** Add bottom safe-area inset (on by default; turn off inside the gallery). */
  safeArea?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function Tab({
  item,
  active,
  onSelect,
  testID,
}: {
  item: TabItem;
  active: boolean;
  onSelect: () => void;
  testID?: string;
}) {
  const { colors, atmosphere } = useTheme();
  const focus = useFocusRing();
  const press = usePressDepth();
  const pebble = atmosphere === 'night' ? colors.accentSoft : colors.primarySoft;
  const color = active ? colors.tabBarActive : colors.tabBarInactive;

  const pebbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.pressed.value * 0.1 }],
  }));

  const webKeys = spaceActivates(onSelect);

  return (
    <Pressable
      onPress={onSelect}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      testID={testID}
      style={[styles.tab, noNativeOutline]}
      {...webKeys}
    >
      <Animated.View
        style={[
          styles.pebble,
          active && { backgroundColor: pebble },
          active && atmosphere === 'daylight' && styles.pebbleLift,
          pebbleStyle,
        ]}
      >
        {active && (
          <View
            pointerEvents="none"
            style={[
              styles.pebbleGloss,
              {
                backgroundColor:
                  atmosphere === 'night' ? 'rgba(255,227,163,0.12)' : 'rgba(255,255,255,0.55)',
              },
            ]}
          />
        )}
        {focus.focused && <FocusRing radius={radius.pill} offset={2} />}
        <Icon name={item.icon} size={24} color={color} strokeWidth={active ? 2.6 : 2.1} />
      </Animated.View>
      <Text variant="caption" color={color} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/** Bottom tab bar look: the active tab sits on a pebble. Each tab is a full-height tap target. */
export function TabBar<K extends string>({
  items,
  activeKey,
  onChange,
  safeArea = true,
  style,
  testID,
}: TabBarProps<K>) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('a11y.tabBar')}
      testID={testID}
      style={[
        styles.bar,
        shadow.raised,
        {
          backgroundColor: colors.tabBar,
          paddingBottom: safeArea ? Math.max(insets.bottom, space.sm) : space.sm,
          borderTopColor: colors.border,
        },
        style,
      ]}
    >
      {items.map((item) => (
        <Tab
          key={item.key}
          item={item}
          active={item.key === activeKey}
          onSelect={() => onChange(item.key)}
          testID={testID ? `${testID}-${item.key}` : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  tab: {
    flex: 1,
    minHeight: tapTarget + 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pebble: {
    width: 60,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pebbleLift: {
    shadowColor: '#0E2E24',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pebbleGloss: {
    position: 'absolute',
    top: 2,
    left: 12,
    right: 12,
    height: 3,
    borderRadius: 2,
  },
});
