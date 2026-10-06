import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { radius, space, useTheme } from '@/theme';

import { FocusRing, noNativeOutline } from './FocusRing';
import { ScaleTexture } from './ScaleTexture';
import { useFocusRing } from './useFocusRing';
import { usePressDepth } from './usePressDepth';

export type CardTone = 'surface' | 'raised' | 'jungle' | 'water';

export interface CardProps {
  children: React.ReactNode;
  tone?: CardTone;
  /** Subtle croc-scale texture overlay. */
  textured?: boolean;
  padding?: keyof typeof space | 0;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Pebble-round surface. With `onPress` it becomes a pressable that gently sinks. */
export function Card({
  children,
  tone = 'surface',
  textured = false,
  padding = 'lg',
  onPress,
  accessibilityLabel,
  testID,
  style,
}: CardProps) {
  const theme = useTheme();
  const { colors } = theme;
  const focus = useFocusRing();
  const focused = focus.focused;
  const { pressed, onPressIn, onPressOut } = usePressDepth();

  const background: Record<CardTone, string> = {
    surface: colors.surface,
    raised: colors.surfaceRaised,
    jungle: colors.primaryDeep,
    water: colors.water,
  };
  const textureColor: Record<CardTone, string> = {
    surface: colors.textPrimary,
    raised: colors.textPrimary,
    jungle: colors.textInverse,
    water: colors.waterLight,
  };

  const edgeColor: Record<CardTone, string> = {
    surface: colors.border,
    raised: colors.border,
    jungle: theme.atmosphere === 'night' ? '#061A14' : colors.textPrimary,
    water: colors.waterDeep,
  };
  const night = theme.atmosphere === 'night';
  // Pressable cards sit on a short edge, like the buttons, and sink onto it when pressed.
  const edgeDepth = onPress ? 3 : 0;

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * edgeDepth }],
  }));

  const inner = (
    <Animated.View
      style={[
        styles.card,
        theme.shadow.card,
        {
          backgroundColor: background[tone],
          padding: padding === 0 ? 0 : space[padding],
          borderWidth: tone === 'surface' || (night && tone === 'raised') ? 1 : 0,
          borderColor: colors.border,
        },
        onPress ? animated : undefined,
        style,
      ]}
      testID={testID}
    >
      {/* A faint light along the top edge gives the pebble its rounded, lit feel. */}
      <View
        pointerEvents="none"
        style={[
          styles.topLight,
          {
            backgroundColor:
              tone === 'jungle' || tone === 'water'
                ? 'rgba(255,255,255,0.14)'
                : night
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,255,255,0.9)',
          },
        ]}
      />
      {textured && (
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
          <ScaleTexture
            color={textureColor[tone]}
            opacity={tone === 'surface' || tone === 'raised' ? 0.06 : 0.14}
          />
        </View>
      )}
      {focused && <FocusRing radius={radius.lg} />}
      {children}
    </Animated.View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[noNativeOutline, { paddingBottom: edgeDepth }]}
    >
      <View
        pointerEvents="none"
        style={[styles.edge, { top: edgeDepth, backgroundColor: edgeColor[tone] }]}
      />
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'visible' },
  clip: { borderRadius: radius.lg, overflow: 'hidden' },
  topLight: {
    position: 'absolute',
    top: 1,
    left: radius.lg,
    right: radius.lg,
    height: 2,
    borderRadius: 2,
  },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: radius.lg },
});
