import React from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { tapTarget, useTheme } from '@/theme';

import { FocusRing, noNativeOutline } from './FocusRing';
import { Icon, type IconName } from './icons/Icon';
import { useFocusRing } from './useFocusRing';
import { usePressDepth } from './usePressDepth';

export type IconButtonVariant = 'ghost' | 'filled' | 'accent';

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  icon: IconName;
  /** Required: icon-only controls need a spoken name. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round icon-only button with a scale-down press and a focus ring. Never smaller than the tap target. */
export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'ghost',
  size = tapTarget,
  disabled = false,
  style,
  onPress,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  ...rest
}: IconButtonProps) {
  const { colors, atmosphere } = useTheme();
  const focus = useFocusRing();
  const focused = focus.focused;
  const press = usePressDepth();
  const diameter = Math.max(size, tapTarget);

  const background: Record<IconButtonVariant, string> = {
    ghost: 'transparent',
    filled: colors.surface,
    accent: colors.accent,
  };
  const iconColor: Record<IconButtonVariant, string> = {
    ghost: colors.textPrimary,
    filled: colors.textPrimary,
    accent: colors.textOnAccent,
  };
  const bg = disabled && variant !== 'ghost' ? colors.surfaceSunken : background[variant];
  const fg = disabled ? colors.textMuted : iconColor[variant];

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.pressed.value * 0.1 }],
    opacity: 1 - press.pressed.value * (variant === 'ghost' ? 0.3 : 0),
  }));

  return (
    <Pressable
      {...rest}
      onPress={disabled ? undefined : onPress}
      onPressIn={(e) => {
        if (!disabled) press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) press.onPressOut();
        onPressOut?.(e);
      }}
      onFocus={(e) => {
        focus.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focus.onBlur();
        onBlur?.(e);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[noNativeOutline, style]}
    >
      <Animated.View
        style={[
          styles.circle,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: bg,
            borderWidth: variant === 'filled' ? 1 : 0,
            borderColor: colors.border,
          },
          variant === 'filled' && atmosphere === 'daylight' && !disabled && styles.filledShadow,
          animated,
        ]}
      >
        {focused && <FocusRing radius={diameter / 2} />}
        <Icon name={icon} size={Math.round(diameter * 0.5)} color={fg} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  filledShadow: {
    shadowColor: '#0E2E24',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
