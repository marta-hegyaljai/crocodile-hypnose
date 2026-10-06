import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { t } from '@/copy';
import { useReducedMotion } from '@/motion/MotionProvider';
import { radius, useTheme } from '@/theme';

import { ScaleTexture } from './ScaleTexture';

export type ProgressTone = 'primary' | 'water' | 'accent';

export interface ProgressBarProps {
  /** 0..1, clamped. */
  progress: number;
  tone?: ProgressTone;
  height?: number;
  /** Croc-scale texture on the fill. */
  textured?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Rounded progress bar whose fill animates to the new value (instantly with reduced motion). */
export function ProgressBar({
  progress,
  tone = 'primary',
  height = 12,
  textured = false,
  accessibilityLabel,
  testID,
  style,
}: ProgressBarProps) {
  const theme = useTheme();
  const { colors } = theme;
  const reducedMotion = useReducedMotion();
  const value = clampProgress(progress);
  const width = useSharedValue(value);

  useEffect(() => {
    width.value = withTiming(value, {
      duration: reducedMotion ? 0 : theme.motion.slow,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, reducedMotion, theme.motion.slow, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  const night = theme.atmosphere === 'night';

  const fill: Record<ProgressTone, string> = {
    primary: colors.progressFill,
    water: colors.water,
    accent: colors.accent,
  };
  const percent = Math.round(value * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? t('a11y.progress', { percent })}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      testID={testID}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: colors.progressTrack },
        style,
      ]}
    >
      {/* Inset shadow along the top of the track, so the fill reads as sitting inside a groove. */}
      <View
        pointerEvents="none"
        style={[
          styles.inset,
          {
            borderRadius: height / 2,
            borderColor: night ? 'rgba(0,0,0,0.35)' : 'rgba(14, 46, 36, 0.12)',
          },
        ]}
      />
      <Animated.View
        style={[
          styles.fill,
          {
            borderRadius: height / 2,
            backgroundColor: fill[tone],
            minWidth: value > 0 ? height : 0,
          },
          fillStyle,
        ]}
      >
        {textured && <ScaleTexture color={colors.textInverse} opacity={0.35} scale={height} />}
        {/* Gloss on the upper half of the fill. */}
        <View
          pointerEvents="none"
          style={[
            styles.gloss,
            { height: Math.max(2, Math.round(height * 0.38)), borderRadius: height / 2 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  inset: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  fill: { height: '100%', overflow: 'hidden', minWidth: 0, borderRadius: radius.pill },
  gloss: {
    position: 'absolute',
    top: 1,
    left: 3,
    right: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
