import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { Lagoon } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { useFeedback } from '@/services/feedback';
import { palette, space, withAlpha } from '@/theme';
import { Chip, Text } from '@/ui';

import type { GameProps } from '../GameShell';
import { BREATH_PERIOD_MS, BreathCounter, guidePhase } from '../scoring';
import { useGameClock } from '../useGameClock';

export const BREATHING_DURATION_MS = 80_000;
const HALF = BREATH_PERIOD_MS / 2;

/**
 * Breathing (Daylight water): press and hold the river to breathe in, let go to breathe out. A
 * guide ring on the water swells and settles at six breaths a minute; your own breath fills it and
 * sends ripples across the water, and the croc rises a little with every in-breath. Ends with the
 * breath count and a calm croc.
 */
export function BreathingGame({ running, ended, onFinish, crocName }: GameProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const feedback = useFeedback();
  const counter = useRef(new BreathCounter());
  const finished = useRef(false);
  const [inhale, setInhale] = useState(true);
  const inhaleRef = useRef(true);
  const [breaths, setBreaths] = useState(0);
  const [ripples, setRipples] = useState<number[]>([]);
  const time = useRef(0);

  /** 0 exhaled .. 1 inhaled, following the finger. */
  const fill = useSharedValue(0.2);
  /** The guide ring, following the clock. */
  const guide = useSharedValue(0);
  const crocLift = useSharedValue(0);

  // Called a few times a second from the clock (the clock keeps the latest callback itself).
  const onTick = (now: number) => {
    time.current = now;
    if (finished.current) return;
    const g = guidePhase(now);
    guide.value = g.inhale ? g.progress : 1 - g.progress;
    if (inhaleRef.current !== g.inhale) {
      // The turn of the breath: a soft tick on devices with haptics.
      inhaleRef.current = g.inhale;
      setInhale(g.inhale);
      feedback.haptic('tap');
    }
    if (now >= BREATHING_DURATION_MS) {
      finished.current = true;
      if (counter.current.holding()) counter.current.release(now);
      onFinish({ gameId: 'breathing', breaths: counter.current.breaths() });
    }
  };
  useGameClock(running, onTick);

  const press = () => {
    if (!running || finished.current) return;
    counter.current.press(time.current);
    const d = reducedMotion ? 0 : HALF;
    fill.value = withTiming(1, { duration: d, easing: Easing.inOut(Easing.sin) });
    crocLift.value = withTiming(-14, { duration: d, easing: Easing.inOut(Easing.sin) });
  };
  const release = () => {
    if (finished.current) return;
    const complete = counter.current.release(time.current);
    const d = reducedMotion ? 0 : HALF;
    fill.value = withTiming(0.2, { duration: d, easing: Easing.inOut(Easing.sin) });
    crocLift.value = withTiming(0, { duration: d, easing: Easing.inOut(Easing.sin) });
    if (complete) {
      setBreaths(counter.current.breaths());
      feedback.haptic('select');
      setRipples((r) => [...r.slice(-3), Date.now() + Math.random()]);
    }
  };
  // The finger is still down when the game pauses or ends: breathe out.
  useEffect(() => {
    if (!running && counter.current.holding()) release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const waterTop = height < 700 ? 0.4 : 0.44;
  const waterY = Math.round(height * waterTop);
  const ring = Math.round(Math.min(width * 0.56, (height - waterY) * 0.42, 230));
  const ringY = waterY + Math.round((height - insets.bottom - waterY) * 0.4);

  const guideStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.72 + guide.value * 0.28 }],
    opacity: 0.5 + guide.value * 0.3,
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.3 + fill.value * 0.66 }],
    opacity: 0.45 + fill.value * 0.45,
  }));

  return (
    <View style={styles.root} testID="breathing-game">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Lagoon
          width={width}
          height={height}
          stage="hatchling"
          expression={ended ? 'happy' : 'calm'}
          waterTop={waterTop}
          crocX={0.5}
          crocWidth={Math.min(Math.round(width * 0.66), 340)}
          crocOffsetY={crocLift}
          crocName={crocName}
          leafSize={Math.min(Math.round(width * 0.22), Math.round(height * 0.15))}
          farReeds={false}
        />
      </View>
      {running || ended ? (
        <>
          {/* The guide ring and your breath inside it, on the water. */}
          <View
            style={[
              styles.ringWrap,
              { left: width / 2 - ring / 2, top: ringY - ring / 2, width: ring, height: ring },
            ]}
            pointerEvents="none"
          >
            {ripples.map((id) => (
              <BreathRipple key={id} size={ring * 2.6} />
            ))}
            <Animated.View
              style={[
                styles.circle,
                {
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  borderWidth: 3,
                  borderColor: withAlpha(palette.white, 0.85),
                  backgroundColor: withAlpha(palette.shallows, 0.25),
                },
                guideStyle,
              ]}
              testID="breathing-guide"
            />
            <Animated.View
              style={[
                styles.circle,
                {
                  width: ring,
                  height: ring,
                  borderRadius: ring / 2,
                  backgroundColor: withAlpha(palette.amberGlow, 0.75),
                },
                fillStyle,
              ]}
            />
          </View>
          <View
            style={[styles.cue, { top: insets.top + space.xxxl + space.lg }]}
            pointerEvents="none"
          >
            <Text variant="subheading" tone="secondary" align="center" testID="breathing-cue">
              {inhale ? t('games.breathing.holdIn') : t('games.breathing.releaseOut')}
            </Text>
            <Chip
              label={t('games.result.breathing', { n: breaths })}
              tone="points"
              testID="breathing-count"
            />
          </View>
        </>
      ) : null}
      {running ? (
        <Pressable
          style={[styles.water, { top: waterY, bottom: 0 }]}
          onPressIn={press}
          onPressOut={release}
          accessibilityRole="button"
          accessibilityLabel={t('games.breathing.a11yWater')}
          testID="breathing-water"
        />
      ) : null}
    </View>
  );
}

/** One ring spreading across the water after a breath, then gone. */
function BreathRipple({ size }: { size: number }) {
  const reducedMotion = useReducedMotion();
  const p = useSharedValue(reducedMotion ? 0.5 : 0);
  useEffect(() => {
    p.value = withTiming(1, {
      duration: reducedMotion ? 1200 : 3200,
      easing: Easing.out(Easing.quad),
    });
    return () => cancelAnimation(p);
  }, [p, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.7,
    transform: [{ scale: 0.2 + p.value * 0.8 }, { scaleY: 0.45 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: palette.white,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ringWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute' },
  cue: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  water: { position: 'absolute', left: 0, right: 0 },
});
