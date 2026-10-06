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
import Svg, { Circle, Path } from 'react-native-svg';

import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, useTheme } from '@/theme';

import { decorative } from './decorative';

export interface CelebrationBurstProps {
  /** Starts the burst when it becomes true; a later `true` after `false` plays it again. */
  active: boolean;
  /** Centre of the burst inside the parent. */
  x: number;
  y: number;
  /** Overall reach of the particles in points. */
  radius?: number;
  duration?: number;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

type Kind = 'petal' | 'sparkle' | 'bubble';

interface Particle {
  kind: Kind;
  angle: number;
  reach: number;
  size: number;
  spin: number;
  delay: number;
}

/** Deterministic pseudo-random in 0..1 from an index (stable layout between renders). */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const COUNT = 24;
const PARTICLES: Particle[] = Array.from({ length: COUNT }, (_, i) => {
  const kind: Kind =
    i % 3 === 0 ? 'sparkle' : i % 3 === 1 ? 'petal' : i % 6 === 2 ? 'bubble' : 'petal';
  // Spread over the upper two thirds of the circle: the burst rises out of the water.
  const angle = -Math.PI * 0.95 + (i / COUNT) * Math.PI * 1.9 + (hash(i, 1) - 0.5) * 0.4;
  return {
    kind,
    angle,
    reach: 0.55 + hash(i, 2) * 0.45,
    size:
      kind === 'sparkle'
        ? 12 + hash(i, 3) * 10
        : kind === 'bubble'
          ? 8 + hash(i, 3) * 6
          : 14 + hash(i, 3) * 9,
    spin: (hash(i, 4) - 0.5) * 540,
    delay: hash(i, 5) * 0.18,
  };
});

function Glyph({ kind, size }: { kind: Kind; size: number }) {
  const { atmosphere } = useTheme();
  const night = atmosphere === 'night';
  switch (kind) {
    case 'sparkle':
      return (
        <Svg width={size} height={size} viewBox="0 0 10 10">
          <Path
            d="M5 0 C5.4 3.2 6.8 4.6 10 5 C6.8 5.4 5.4 6.8 5 10 C4.6 6.8 3.2 5.4 0 5 C3.2 4.6 4.6 3.2 5 0 Z"
            fill={night ? palette.amberLight : palette.amber}
          />
        </Svg>
      );
    case 'petal':
      return (
        <Svg width={size} height={size} viewBox="0 0 10 10">
          <Path d="M5 0.5 C8 2.5 9.5 5.5 5 9.5 C0.5 5.5 2 2.5 5 0.5 Z" fill={palette.waterLily} />
          <Path d="M5 2.5 L5 8" stroke={palette.lilyLight} strokeWidth={0.9} opacity={0.9} />
        </Svg>
      );
    case 'bubble':
      return (
        <Svg width={size} height={size} viewBox="0 0 10 10">
          <Circle cx={5} cy={5} r={4.2} fill="none" stroke={palette.shallows} strokeWidth={1.2} />
          <Circle cx={3.6} cy={3.6} r={1} fill={palette.white} opacity={0.9} />
        </Svg>
      );
  }
}

function Piece({
  particle,
  progress,
  x,
  y,
  radius,
}: {
  particle: Particle;
  progress: SharedValue<number>;
  x: number;
  y: number;
  radius: number;
}) {
  const { kind, angle, reach, size, spin, delay } = particle;
  const dx = Math.cos(angle) * reach * radius;
  const dy = Math.sin(angle) * reach * radius;
  const style = useAnimatedStyle(() => {
    // Each piece runs on its own slice of the shared progress, so the burst is staggered.
    const p = Math.max(0, Math.min(1, (progress.value - delay) / (1 - delay)));
    const out = 1 - (1 - p) * (1 - p) * (1 - p);
    // Petals and bubbles drift: petals fall a little once they slow down, bubbles keep rising.
    const drift =
      kind === 'petal' ? p * p * radius * 0.35 : kind === 'bubble' ? -p * radius * 0.3 : 0;
    const fadeIn = Math.min(1, p / 0.12);
    const fadeOut = 1 - Math.max(0, (p - 0.65) / 0.35);
    return {
      opacity: fadeIn * fadeOut,
      transform: [
        { translateX: dx * out },
        { translateY: dy * out + drift },
        { rotate: `${spin * out}deg` },
        { scale: 0.5 + out * 0.6 },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { left: x - size / 2, top: y - size / 2, width: size, height: size },
        style,
      ]}
    >
      <Glyph kind={kind} size={size} />
    </Animated.View>
  );
}

/**
 * A burst of water-lily petals, amber sparkles and bubbles rising from a point: the croc's
 * celebration (a new account, later a finished session). Plays once each time `active` turns on.
 * With reduced motion the pieces fade in spread out and fade away without flying.
 */
export function CelebrationBurst({
  active,
  x,
  y,
  radius = 120,
  duration = 2200,
  animated = true,
  style,
  testID,
}: CelebrationBurstProps) {
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
      // Static spread: shown already open, then gone.
      progress.value = 0.5;
      progress.value = withTiming(1, { duration: duration * 0.6, easing: Easing.linear });
    }
    return () => cancelAnimation(progress);
  }, [active, live, duration, progress]);

  if (!active) return null;
  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      testID={testID}
      {...decorative}
    >
      {PARTICLES.map((p, i) => (
        <Piece key={i} particle={p} progress={progress} x={x} y={y} radius={radius} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
