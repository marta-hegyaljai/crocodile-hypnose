import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { t } from '@/copy';
import { radius, space, tapTarget, useTheme } from '@/theme';

import { FocusRing, noNativeOutline } from './FocusRing';
import { Icon, type IconName } from './icons/Icon';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';
import { usePressDepth } from './usePressDepth';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the parent's width. Without it the button hugs its label and follows the parent's alignment. */
  fullWidth?: boolean;
  /** Marks the label as placeholder copy (auto-detected for copy-module strings). */
  placeholder?: boolean;
  style?: StyleProp<ViewStyle>;
  /** The pressable host view, e.g. to move focus back to the button. */
  ref?: React.Ref<View>;
}

const heights: Record<ButtonSize, number> = { sm: tapTarget, md: 52, lg: 60 };
const paddings: Record<ButtonSize, number> = { sm: space.lg, md: space.xl, lg: space.xxl };

/**
 * Chunky 3D button: a coloured face sitting on a darker edge. Pressing pushes the face down
 * onto the edge (spring in Daylight, slow ease in Night River; instant with reduced motion).
 * Every variant has the same outer height, so swapping variants never shifts the layout.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  placeholder,
  style,
  onPress,
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  accessibilityLabel,
  testID,
  ref,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;
  const focus = useFocusRing();
  const press = usePressDepth();
  const focused = focus.focused;

  const edgeDepth = theme.buttonDepth;
  const travel = variant === 'ghost' ? 0 : edgeDepth;
  const inactive = disabled || loading;

  const face: Record<ButtonVariant, string> = {
    primary: colors.accent,
    secondary: colors.primary,
    ghost: 'transparent',
    danger: colors.danger,
  };
  const edge: Record<ButtonVariant, string> = {
    primary: colors.accentDeep,
    secondary: colors.primaryDeep,
    ghost: 'transparent',
    danger: colors.dangerDeep,
  };
  const labelColor: Record<ButtonVariant, string> = {
    primary: colors.textOnAccent,
    secondary: colors.textOnPrimary,
    ghost: theme.atmosphere === 'night' ? colors.textPrimary : colors.primary,
    danger: colors.textOnPrimary,
  };

  // Disabled: a quiet sunken surface rather than a transparent face (readable in both atmospheres).
  // At night the sunken surface is the background colour, so the face keeps a hairline to hold its shape.
  const night = theme.atmosphere === 'night';
  const inactiveFace = disabled && variant !== 'ghost';
  const faceColor = inactiveFace
    ? night
      ? colors.surfaceRaised
      : colors.surfaceSunken
    : face[variant];
  const edgeColor = inactiveFace ? colors.border : edge[variant];
  const textColor = disabled ? colors.textMuted : labelColor[variant];
  // A soft light along the top of the face makes the button read as a rounded, lit object.
  const gloss =
    variant === 'ghost' || inactiveFace ? undefined : variant === 'primary' ? 0.4 : 0.22;

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.pressed.value * travel }],
  }));
  const ghostPressStyle = useAnimatedStyle(() => ({
    opacity: press.pressed.value * (variant === 'ghost' ? 1 : 0),
  }));

  const height = heights[size];
  const r = radius.md + (size === 'lg' ? 4 : 0);

  return (
    <Pressable
      {...rest}
      ref={ref}
      testID={testID}
      onPress={inactive ? undefined : onPress}
      onPressIn={(e) => {
        if (!inactive) press.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!inactive) press.onPressOut();
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
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      aria-busy={loading}
      style={[
        styles.root,
        fullWidth && styles.fullWidth,
        { paddingBottom: edgeDepth },
        noNativeOutline,
        style,
      ]}
    >
      {travel > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.edge,
            { top: edgeDepth, borderRadius: r, backgroundColor: edgeColor },
            !inactiveFace && !night && theme.shadow.card,
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.face,
          {
            height,
            minWidth: height,
            paddingHorizontal: paddings[size],
            borderRadius: r,
            backgroundColor: faceColor,
            borderWidth: inactiveFace && night ? 1 : 0,
            borderColor: colors.border,
          },
          faceStyle,
        ]}
      >
        {gloss !== undefined && (
          <View
            pointerEvents="none"
            style={[
              styles.gloss,
              { borderRadius: r, backgroundColor: `rgba(255,255,255,${gloss})` },
            ]}
          />
        )}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: r, backgroundColor: colors.surfaceSunken },
            ghostPressStyle,
          ]}
        />
        {focused && <FocusRing radius={r} />}
        <View style={[styles.content, loading && styles.hidden]}>
          {icon && (
            <View style={styles.icon}>
              <Icon name={icon} size={size === 'sm' ? 18 : 22} color={textColor} />
            </View>
          )}
          <Text
            variant={size === 'sm' ? 'label' : 'heading'}
            color={textColor}
            placeholder={placeholder}
            numberOfLines={1}
            style={[styles.label, size !== 'sm' && styles.labelLarge]}
          >
            {label}
          </Text>
        </View>
        {loading && (
          <View style={styles.spinner} accessibilityLabel={t('a11y.loading')}>
            <ActivityIndicator color={textColor} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // No alignSelf: a hug-width button follows its parent's alignment (centre, start, stretch).
  root: { maxWidth: '100%' },
  fullWidth: { alignSelf: 'stretch' },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  gloss: { position: 'absolute', top: 2, left: 12, right: 12, height: 2 },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    maxWidth: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    maxWidth: '100%',
    flexShrink: 1,
  },
  label: { flexShrink: 1 },
  hidden: { opacity: 0 },
  icon: { marginLeft: -space.xs },
  labelLarge: { fontSize: 19, lineHeight: 24 },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
