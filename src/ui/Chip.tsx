import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Icon, type IconName } from './icons/Icon';
import { Text } from './Text';

export type ChipTone = 'points' | 'goal' | 'neutral' | 'celebrate';

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  placeholder?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const defaultIcon: Record<ChipTone, IconName | undefined> = {
  points: 'drop',
  goal: 'check',
  neutral: undefined,
  celebrate: 'sparkle',
};

/** Small pill for counters and status: points, weekly goal, zone state. Not interactive. */
export function Chip({
  label,
  tone = 'neutral',
  icon,
  placeholder,
  accessibilityLabel,
  testID,
  style,
}: ChipProps) {
  const { colors, atmosphere } = useTheme();
  const night = atmosphere === 'night';

  const palette: Record<ChipTone, { bg: string; fg: string; icon: string; edge: string }> = {
    points: {
      bg: night ? colors.accentSoft : colors.accentSoft,
      fg: night ? colors.accent : colors.textOnAccent,
      icon: night ? colors.accent : colors.accentDeep,
      edge: night ? 'rgba(242, 169, 59, 0.35)' : 'rgba(184, 112, 26, 0.35)',
    },
    goal: {
      bg: night ? colors.surfaceRaised : colors.primarySoft,
      fg: night ? colors.textPrimary : colors.primaryDeep,
      icon: night ? colors.waterLight : colors.primary,
      edge: night ? 'rgba(124, 196, 181, 0.3)' : 'rgba(63, 107, 53, 0.3)',
    },
    neutral: {
      bg: colors.surfaceSunken,
      fg: colors.textSecondary,
      icon: colors.textSecondary,
      edge: night ? 'rgba(157, 183, 177, 0.25)' : 'rgba(14, 46, 36, 0.14)',
    },
    celebrate: {
      bg: night ? colors.surfaceRaised : '#FBE1E8',
      fg: night ? colors.celebrate : '#7A2B3E',
      icon: colors.celebrate,
      edge: night ? 'rgba(238, 143, 166, 0.35)' : 'rgba(122, 43, 62, 0.25)',
    },
  };
  const c = palette[tone];
  const iconName = icon ?? defaultIcon[tone];

  return (
    <View
      style={[styles.chip, { backgroundColor: c.bg, borderColor: c.edge }, style]}
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
      testID={testID}
    >
      {/* Pebble gloss: a faint light along the top of the pill. */}
      <View
        pointerEvents="none"
        style={[
          styles.gloss,
          { backgroundColor: night ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)' },
        ]}
      />
      {iconName && <Icon name={iconName} size={16} color={c.icon} />}
      <Text variant="label" color={c.fg} placeholder={placeholder} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    minHeight: 32,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderBottomWidth: 2,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  gloss: { position: 'absolute', top: 1, left: 10, right: 10, height: 2, borderRadius: 2 },
});
