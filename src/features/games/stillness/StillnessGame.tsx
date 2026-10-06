import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { Lagoon, LilyPad } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, space, withAlpha } from '@/theme';
import { Text } from '@/ui';

import type { GameProps } from '../GameShell';
import { StillnessTracker } from '../scoring';
import { useGameClock } from '../useGameClock';
import { subscribeMotion, type MotionSource } from './motionSource';

export const STILLNESS_DURATION_MS = 90_000;
/** Finger slide per tick that counts as full motion (pt); acceleration change in g for the sensor. */
const TOUCH_FULL_MOTION = 18;
const SENSOR_FULL_MOTION = 0.35;
/** How fast the croc sinks while perfectly still: the full depth in about 40 s of stillness. */
const SINK_PER_MS = 1 / 40_000;
const RISE_PER_MS = 1 / 6_000;
const PAD = 132;

type Source = 'probing' | 'sensor' | 'touch';

/**
 * Stillness (Daylight into dusk): the croc floats in the river and sinks lower the stiller you
 * are; a wobble lifts it again. The device's motion sensor measures stillness where it works,
 * otherwise a finger resting on the lily pad does. The sky dims towards dusk as the game goes on.
 * The score (0–100) is only told at the end.
 */
export function StillnessGame({ running, ended, onFinish, crocName }: GameProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [source, setSource] = useState<Source>('probing');
  const tracker = useRef(new StillnessTracker({ fullMotion: TOUCH_FULL_MOTION }));
  const finished = useRef(false);

  // Movement gathered since the last tick, and whether a finger rests on the pad.
  const moved = useRef(0);
  const touching = useRef(false);
  // Touch mode: nothing counts until the finger first rests (reading the cue is not fidgeting).
  const rested = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const motion = useRef<MotionSource | null>(null);

  /** 0 at the surface, 1 fully sunk. */
  const sunk = useSharedValue(0);
  const lastTick = useRef(0);

  // One alive flag for the component's life: pausing (or the app going to the background) must not
  // drop the probe's result, or the game would sit in 'probing' for good.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      motion.current?.stop();
      motion.current = null;
    };
  }, []);

  // Probe the sensor once the game starts; fall back to the lily pad when it stays silent.
  useEffect(() => {
    if (!running || motion.current) return;
    const src = subscribeMotion((d) => {
      moved.current += d;
    });
    motion.current = src;
    void src.available.then((ok) => {
      if (!alive.current) return;
      if (ok) {
        tracker.current = new StillnessTracker({ fullMotion: SENSOR_FULL_MOTION });
        setSource('sensor');
      } else {
        src.stop();
        setSource('touch');
      }
    });
  }, [running]);

  const depth = Math.round(Math.min(width, 440) * 0.42);

  // The lily pad's glow: a slow invitation pulse until a finger rests on it, then a warm, steady
  // ring under a slightly pressed pad (presentation only; the pad still measures the same).
  const pressed = useSharedValue(0);
  const invite = useSharedValue(0);
  const touchMode = source === 'touch' && running;
  useEffect(() => {
    if (!touchMode || reducedMotion) {
      cancelAnimation(invite);
      invite.value = 0;
      return;
    }
    invite.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(invite);
  }, [touchMode, reducedMotion, invite]);
  const setPressed = (down: boolean) => {
    pressed.value = reducedMotion
      ? down
        ? 1
        : 0
      : withTiming(down ? 1 : 0, { duration: 180, easing: Easing.out(Easing.quad) });
  };
  const glowStyle = useAnimatedStyle(() => {
    const idle = 0.34 + invite.value * 0.22;
    return {
      opacity: idle + (0.85 - idle) * pressed.value,
      transform: [
        { scale: 1 + invite.value * 0.05 * (1 - pressed.value) + pressed.value * 0.14 },
        { scaleY: 0.78 },
      ],
    };
  });
  const padStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.05 }],
  }));
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  // Called a few times a second from the clock (the clock keeps the latest callback itself).
  const onTick = (time: number) => {
    const dt = Math.max(0, time - lastTick.current);
    lastTick.current = time;
    if (finished.current) return;
    // The game always ends at its duration, even if the sensor is still being probed or the
    // finger never rested (then no samples were taken and the score is the gentle default).
    if (time >= STILLNESS_DURATION_MS) {
      finished.current = true;
      onFinish({ gameId: 'stillness', score: tracker.current.score() });
      return;
    }
    if (sourceRef.current === 'probing') return;
    if (sourceRef.current === 'touch' && !rested.current) return;
    // A finger lifted off the pad is not stillness; the sensor is always "on".
    const movement =
      sourceRef.current === 'touch' && !touching.current ? TOUCH_FULL_MOTION : moved.current;
    moved.current = 0;
    tracker.current.addSample(movement);
    const still = tracker.current.level();
    // Stillness sinks the croc slowly; movement brings it up faster.
    const rate = still > 0.6 ? (still - 0.6) * 2.5 * SINK_PER_MS : -(0.6 - still) * RISE_PER_MS;
    const next = Math.max(0, Math.min(1, sunk.value + rate * dt));
    sunk.value = reducedMotion ? next : withTiming(next, { duration: 140, easing: Easing.linear });
  };
  const { timeMs } = useGameClock(running, onTick);

  const crocOffset = useDerivedValue(() => sunk.value * depth);

  // Daylight slides into dusk over the game.
  const dusk = useAnimatedStyle(() => ({
    opacity: interpolate(timeMs.value, [0, STILLNESS_DURATION_MS], [0, 0.55], 'clamp'),
  }));

  const onMove = (x: number, y: number) => {
    const p = lastPoint.current;
    if (p) moved.current += Math.hypot(x - p.x, y - p.y);
    lastPoint.current = { x, y };
  };
  const moveHandlers =
    Platform.OS === 'web'
      ? {
          onPointerMove: (e: {
            nativeEvent: { offsetX?: number; offsetY?: number; clientX?: number; clientY?: number };
          }) => {
            if (!touching.current) return;
            const n = e.nativeEvent;
            onMove(n.clientX ?? n.offsetX ?? 0, n.clientY ?? n.offsetY ?? 0);
          },
        }
      : {
          onTouchMove: (e: { nativeEvent: { pageX: number; pageY: number } }) => {
            if (!touching.current) return;
            onMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
          },
        };

  const waterTop = height < 700 ? 0.42 : 0.46;
  const waterY = Math.round(height * waterTop);
  const padTop = Math.min(
    height - insets.bottom - PAD - space.lg,
    waterY + (height - waterY) * 0.42,
  );
  const cue =
    source === 'sensor'
      ? t('games.stillness.holdPhone')
      : source === 'touch'
        ? t('games.stillness.restFinger')
        : '';

  return (
    <View style={styles.root} testID="stillness-game">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Lagoon
          width={width}
          height={height}
          stage="hatchling"
          expression={ended ? 'happy' : running ? 'calm' : 'happy'}
          waterTop={waterTop}
          crocX={0.5}
          crocWidth={Math.min(Math.round(width * 0.7), 360)}
          crocOffsetY={crocOffset}
          crocName={crocName}
          leafSize={Math.min(Math.round(width * 0.22), Math.round(height * 0.15))}
          farReeds={false}
          celebrate={ended}
        />
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.nightRiver }, dusk]}
          testID="stillness-dusk"
        />
      </View>
      {running ? (
        <View
          style={[styles.cue, { top: insets.top + space.xxxl + space.lg }]}
          pointerEvents="none"
        >
          <Text variant="subheading" align="center" tone="secondary" testID="stillness-cue">
            {cue}
          </Text>
        </View>
      ) : null}
      {source === 'touch' && running ? (
        <Pressable
          style={[styles.pad, { top: padTop, left: width / 2 - PAD / 2 }]}
          onPressIn={() => {
            touching.current = true;
            rested.current = true;
            lastPoint.current = null;
            setPressed(true);
          }}
          onPressOut={() => {
            touching.current = false;
            lastPoint.current = null;
            setPressed(false);
          }}
          {...moveHandlers}
          accessibilityRole="button"
          accessibilityLabel={t('games.stillness.a11yPad')}
          testID="stillness-pad"
        >
          <Animated.View style={[styles.padGlow, glowStyle]} />
          <Animated.View style={[styles.padRing, glowStyle]} />
          <Animated.View style={padStyle}>
            <LilyPad size={PAD} flower rotation={-12} />
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cue: { position: 'absolute', left: space.xl, right: space.xl, alignItems: 'center' },
  pad: {
    position: 'absolute',
    width: PAD,
    height: PAD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padGlow: {
    position: 'absolute',
    width: PAD + 36,
    height: PAD + 36,
    borderRadius: (PAD + 36) / 2,
    backgroundColor: withAlpha(palette.amberGlow, 0.7),
  },
  padRing: {
    position: 'absolute',
    width: PAD + 56,
    height: PAD + 56,
    borderRadius: (PAD + 56) / 2,
    borderWidth: 2,
    borderColor: withAlpha(palette.white, 0.7),
  },
});
