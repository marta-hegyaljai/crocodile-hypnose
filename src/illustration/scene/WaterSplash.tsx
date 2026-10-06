import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';

import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, withAlpha } from '@/theme';

import { decorative } from './decorative';

export interface WaterSplashProps {
  /** Plays once each time it turns true. */
  active: boolean;
  /** Where the croc lands on the water, inside the parent. */
  x: number;
  y: number;
  /** How wide the splash spreads, in points. */
  width?: number;
  duration?: number;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface Drop {
  /** -1..1 across the splash. */
  dx: number;
  /** How high it flies, as a fraction of the width. */
  rise: number;
  size: number;
  delay: number;
  light: boolean;
}

function hash(i: number, salt: number): number {
  const x = Math.sin(i * 91.7 + salt * 173.3) * 43758.5453;
  return x - Math.floor(x);
}

const COUNT = 14;
const DROPS: Drop[] = Array.from({ length: COUNT }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const spread = 0.2 + (i / COUNT) * 0.8;
  return {
    dx: side * spread,
    rise: 0.22 + hash(i, 1) * 0.3 - spread * 0.12,
    size: 6 + hash(i, 2) * 8,
    delay: hash(i, 3) * 0.12,
    light: i % 3 === 0,
  };
});

function Droplet({
  drop,
  progress,
  x,
  y,
  width,
}: {
  drop: Drop;
  progress: SharedValue<number>;
  x: number;
  y: number;
  width: number;
}) {
  const { dx, rise, size, delay, light } = drop;
  const style = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(1, (progress.value - delay) / (1 - delay)));
    // Out and up, then gravity brings it back to the water.
    const tx = dx * width * 0.5 * (0.3 + 0.7 * p);
    const ty = -rise * width * 4 * p * (1 - p);
    const fade = p < 0.1 ? p / 0.1 : 1 - Math.max(0, (p - 0.75) / 0.25);
    return {
      opacity: fade,
      transform: [{ translateX: tx }, { translateY: ty }, { scale: 0.6 + 0.6 * (1 - p) }],
    };
  });
  return (
    <Animated.View
      style={[styles.piece, { left: x - size / 2, top: y - size / 2, width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Ellipse
          cx={5}
          cy={5}
          rx={3.6}
          ry={4.4}
          fill={light ? palette.white : palette.shallows}
          opacity={light ? 0.95 : 0.9}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * A splash on the water where the croc lands: droplets fly out and fall back while a bright ring
 * spreads over the surface. With reduced motion the ring and a few droplets simply fade in and out.
 */
export function WaterSplash({
  active,
  x,
  y,
  width = 220,
  duration = 900,
  animated = true,
  style,
  testID,
}: WaterSplashProps) {
  const reducedMotion = useReducedMotion();
  const live = animated && !reducedMotion;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    if (live) {
      progress.value = 0;
      progress.value = withTiming(1, { duration, easing: Easing.linear });
    } else {
      progress.value = 0.4;
      progress.value = withTiming(1, { duration: duration * 0.7, easing: Easing.linear });
    }
    return () => cancelAnimation(progress);
  }, [active, live, duration, progress]);

  const ring = useAnimatedStyle(() => {
    const p = progress.value;
    const out = 1 - (1 - p) * (1 - p);
    return {
      opacity: p === 0 ? 0 : (1 - p) * 0.9,
      transform: [{ scaleX: 0.3 + out * 1.1 }, { scaleY: 0.3 + out * 1.1 }],
    };
  });
  const ringW = width * 0.9;
  const ringH = width * 0.26;

  if (!active) return null;
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" testID={testID} {...decorative}>
      <Animated.View
        style={[
          styles.piece,
          { left: x - ringW / 2, top: y - ringH / 2, width: ringW, height: ringH },
          ring,
        ]}
      >
        <Svg width={ringW} height={ringH} viewBox="0 0 100 30">
          <Ellipse
            cx={50}
            cy={15}
            rx={46}
            ry={12}
            fill="none"
            stroke={palette.white}
            strokeWidth={2.4}
          />
          <Ellipse
            cx={50}
            cy={15}
            rx={34}
            ry={8}
            fill={withAlpha(palette.shallows, 0.35)}
            stroke={withAlpha(palette.white, 0.6)}
            strokeWidth={1.2}
          />
        </Svg>
      </Animated.View>
      {DROPS.map((d, i) => (
        <Droplet key={i} drop={d} progress={progress} x={x} y={y} width={width} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
