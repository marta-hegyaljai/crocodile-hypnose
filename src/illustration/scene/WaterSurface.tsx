import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/motion/MotionProvider';
import { useTheme } from '@/theme';

import { decorative } from './decorative';
import { useLoop } from './useLoop';

export interface RippleProps {
  /** Centre as fractions (0..1) of the parent. */
  x: number;
  y: number;
  /** Final ring width in points. */
  size?: number;
  color?: string;
  duration?: number;
  delay?: number;
  animated?: boolean;
}

/** One expanding, fading ring on the water. Static at mid-size with reduced motion. */
export function Ripple({
  x,
  y,
  size = 120,
  color,
  duration,
  delay = 0,
  animated = true,
}: RippleProps) {
  const { colors, motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const live = animated && !reducedMotion;
  const progress = useLoop(live, duration ?? motion.ripple, delay, 0.55);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.25 + progress.value * 0.95 }],
    opacity: live ? (1 - progress.value) * 0.75 : 0.35,
  }));

  const h = size * 0.32;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: size,
          height: h,
          marginLeft: -size / 2,
          marginTop: -h / 2,
        },
        style,
      ]}
    >
      <Svg width={size} height={h} viewBox={`0 0 ${size} ${h}`}>
        <Ellipse
          cx={size / 2}
          cy={h / 2}
          rx={size / 2 - 1.5}
          ry={h / 2 - 1.5}
          stroke={color ?? colors.waterLight}
          strokeWidth={2}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

export interface WaterSurfaceProps {
  /** Ripple centres as fractions of the water area. */
  ripples?: { x: number; y: number; size?: number }[];
  animated?: boolean;
  color?: string;
  /** Opacity at the surface; the water turns opaque a little further down, so a submerged croc fades out. */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A band of river water with a gently waved top edge, surface highlights and expanding ripples.
 * Fills its parent; position it absolutely where the water starts.
 */
export function WaterSurface({
  ripples = [{ x: 0.5, y: 0.25 }],
  animated = true,
  color,
  opacity = 0.9,
  style,
  testID,
}: WaterSurfaceProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const live = animated && !reducedMotion;
  const fill = color ?? colors.water;
  const depthId = `water-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View style={[styles.water, style]} testID={testID} {...decorative}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id={depthId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fill} stopOpacity={opacity} />
            <Stop offset="0.45" stopColor={fill} stopOpacity={1} />
            <Stop offset="1" stopColor={fill} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Path
          d="M0 10 Q 25 4 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 T 350 10 T 400 10 V200 H0 Z"
          fill={`url(#${depthId})`}
        />
        <Path
          d="M0 10 Q 25 4 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 T 350 10 T 400 10"
          stroke={colors.waterLight}
          strokeWidth={2}
          fill="none"
          opacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d="M30 60 q 20 -6 40 0"
          stroke={colors.waterLight}
          strokeWidth={2}
          fill="none"
          opacity={0.45}
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d="M300 95 q 24 -6 48 0"
          stroke={colors.waterLight}
          strokeWidth={2}
          fill="none"
          opacity={0.35}
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d="M120 150 q 18 -5 36 0"
          stroke={colors.waterLight}
          strokeWidth={2}
          fill="none"
          opacity={0.3}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      <View
        style={StyleSheet.absoluteFill}
        testID={testID ? `${testID}-ripples-${live ? 'animated' : 'static'}` : undefined}
      >
        {ripples.map((r, i) => (
          <React.Fragment key={i}>
            <Ripple x={r.x} y={r.y} size={r.size} animated={animated} delay={i * 700} />
            <Ripple x={r.x} y={r.y} size={r.size} animated={animated} delay={i * 700 + 1600} />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  water: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  ripple: { position: 'absolute' },
});
