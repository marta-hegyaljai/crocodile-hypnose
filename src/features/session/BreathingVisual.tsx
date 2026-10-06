import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { t } from '@/copy';
import { useBreath } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, useTheme, withAlpha } from '@/theme';
import { Text } from '@/ui';

export interface BreathingVisualProps {
  size: number;
  /** Seconds for one in-breath (and one out-breath). */
  half?: number;
  /** Pause everything (the session is paused). */
  paused?: boolean;
  testID?: string;
}

/**
 * A soft ring of shallows that swells on the in-breath and settles on the out-breath, with the
 * cue underneath. Night River pace, no counters. Reduced motion keeps the ring still and only
 * swaps the cue.
 */
export function BreathingVisual({ size, half = 4, paused = false, testID }: BreathingVisualProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const live = !reducedMotion && !paused;
  const breath = useBreath(live, half * 1000, 0, 0.5);
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  // The cue follows the same clock as the ring.
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setPhase((p) => (p === 'in' ? 'out' : 'in')), half * 1000);
    return () => clearInterval(timer);
  }, [half, paused]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 0.72 + breath.value * 0.28 }],
    opacity: 0.55 + breath.value * 0.35,
  }));
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + breath.value * 0.45 }],
    opacity: 0.12 + breath.value * 0.18,
  }));

  return (
    <View style={[styles.root, { width: size, height: size + 40 }]} testID={testID}>
      <View
        style={[styles.stage, { width: size, height: size }]}
        accessibilityLabel={t('onboarding.firstSession.a11yBreathing')}
        accessibilityRole="image"
      >
        <Animated.View
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: palette.shallows,
            },
            halo,
          ]}
        />
        <Animated.View
          style={[
            styles.circle,
            {
              width: size * 0.8,
              height: size * 0.8,
              borderRadius: size * 0.4,
              borderWidth: 3,
              borderColor: withAlpha(palette.shallows, 0.9),
              backgroundColor: withAlpha(colors.water, 0.55),
            },
            ring,
          ]}
        />
      </View>
      <Text
        variant="subheading"
        tone="secondary"
        align="center"
        accessibilityLiveRegion="polite"
        testID={testID ? `${testID}-cue` : undefined}
      >
        {phase === 'in'
          ? t('onboarding.firstSession.breatheIn')
          : t('onboarding.firstSession.breatheOut')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  stage: { alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute' },
});
