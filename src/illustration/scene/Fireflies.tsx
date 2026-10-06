import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, useTheme } from '@/theme';

import { decorative } from './decorative';
import { useBreath } from './useLoop';

export interface FirefliesProps {
  count?: number;
  /** Overall glow strength 0..1. */
  intensity?: number;
  /** Glow colour (amber fireflies by default; pale for daylight pollen and seeds). */
  color?: string;
  /** Body size multiplier. */
  scale?: number;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Deterministic pseudo-random in 0..1 from an index (so layouts are stable between renders). */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function Firefly({
  index,
  intensity,
  color,
  scale,
  animated,
}: {
  index: number;
  intensity: number;
  color: string;
  scale: number;
  animated: boolean;
}) {
  const { motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const live = animated && !reducedMotion;
  const glowId = `firefly-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pulse = useBreath(
    live,
    motion.idle * (0.7 + hash(index, 3) * 0.6),
    hash(index, 4) * 2000,
    0.5,
  );
  const drift = useBreath(live, motion.idle * (1.6 + hash(index, 5)), hash(index, 6) * 3000, 0.5);

  const x = 6 + hash(index, 1) * 88;
  const y = 6 + hash(index, 2) * 88;
  // Small bodies with a wide, soft halo.
  const body = (2.2 + hash(index, 7) * 1.6) * scale;
  const halo = body * 7;

  const style = useAnimatedStyle(() => ({
    opacity: (0.3 + pulse.value * 0.7) * intensity,
    transform: [
      { translateX: (drift.value - 0.5) * 14 },
      { translateY: (pulse.value - 0.5) * 8 },
      { scale: 0.85 + pulse.value * 0.3 },
    ],
  }));

  const box = halo * 2;
  return (
    <Animated.View
      style={[
        styles.fly,
        {
          left: `${x}%`,
          top: `${y}%`,
          width: box,
          height: box,
          marginLeft: -halo,
          marginTop: -halo,
        },
        style,
      ]}
    >
      <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.9} />
            <Stop offset="0.25" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={halo} cy={halo} r={halo} fill={`url(#${glowId})`} />
        <Circle cx={halo} cy={halo} r={body} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/** Drifting, pulsing fireflies. Fills its parent. Still and dim with reduced motion. */
export function Fireflies({
  count = 7,
  intensity = 1,
  color = palette.amberGlow,
  scale = 1,
  animated = true,
  style,
  testID,
}: FirefliesProps) {
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.clip, style]}
      pointerEvents="none"
      testID={testID}
      {...decorative}
    >
      {Array.from({ length: count }, (_, i) => (
        <Firefly
          key={i}
          index={i}
          intensity={intensity}
          color={color}
          scale={scale}
          animated={animated}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fly: { position: 'absolute' },
});
