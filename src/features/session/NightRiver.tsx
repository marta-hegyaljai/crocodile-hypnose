import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { EYE_STOPS, Lagoon, crocColors, useBreath } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, radius, space, useTheme, withAlpha } from '@/theme';
import { Button, Reveal, Screen, Text } from '@/ui';

/**
 * The Night River composition every session shares (designed for the onboarding first session,
 * S03): the day fades into the night river where the croc dives under, its glowing eyes watch
 * from just under the surface, the session's visual sits where it went under, and the controls
 * live in a dock on the water. Coming back, the croc rises and the day returns.
 */

/**
 * Timings of the signature transition (ms). Sink: the day fades into the night river, where the
 * croc floats eyes closed, then it dives under and the player settles in. Surface: the player
 * fades, the croc rises, and the day comes back over the river.
 */
export const SINK = { fade: 750, diveDelay: 450, croc: 1500, reveal: 700, total: 2050 } as const;
export const SURFACE = { ui: 300, croc: 1300, fade: 900, total: 2100 } as const;
export const REDUCED_FADE = 320;

/** Geometry of the night scene for the current window (portrait, short phones, landscape). */
export function useNightLayout() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const short = !landscape && height < 700;
  // More water on short screens, so the ring, its cue and the dock all fit on it.
  const waterTop = landscape ? 0.5 : short ? 0.36 : 0.44;
  const waterY = Math.round(height * waterTop);
  const crocX = landscape ? 0.3 : 0.5;
  const centreX = Math.round(width * crocX);
  const visual = Math.round(Math.min(width * 0.52, height * (short ? 0.22 : 0.27), 210));
  // The ring sits on the water, just under the surface where the croc went under.
  const ringY = waterY + Math.round(visual * 0.52);
  // Deep enough for the whole croc to pass under the water.
  const depth = Math.round(Math.min(width, 440) * 0.5) + 40;
  return {
    width,
    height,
    landscape,
    short,
    waterTop,
    waterY,
    crocX,
    centreX,
    visual,
    ringY,
    depth,
  };
}

export type NightLayout = ReturnType<typeof useNightLayout>;

/**
 * The dive and the rise. `day` is the day screen's opacity over the river, `sink` how far the
 * croc is under the water, `ui` the player's controls. Reduced motion swaps the dive for fades.
 */
export function useDive(depth: number) {
  const reducedMotion = useReducedMotion();
  const day = useSharedValue(1);
  const sink = useSharedValue(0);
  const ui = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  /** Into the night river; `onPlaying` once the player can be used. */
  const dive = (onPlaying: () => void) => {
    sink.value = 0;
    ui.value = 0;
    if (reducedMotion) {
      day.value = withTiming(0, { duration: REDUCED_FADE });
      later(REDUCED_FADE + 40, () => {
        sink.value = depth;
        ui.value = withTiming(1, { duration: REDUCED_FADE });
        onPlaying();
      });
      return;
    }
    day.value = withTiming(0, { duration: SINK.fade, easing: Easing.inOut(Easing.quad) });
    sink.value = withDelay(
      SINK.diveDelay,
      withTiming(depth, { duration: SINK.croc, easing: Easing.in(Easing.cubic) }),
    );
    ui.value = withDelay(
      SINK.total - SINK.reveal,
      withTiming(1, { duration: SINK.reveal, easing: Easing.out(Easing.quad) }),
    );
    later(SINK.total, onPlaying);
  };

  /** Back up to the day; `onSettled` once the day screen is fully back. */
  const rise = (onSettled: () => void) => {
    if (reducedMotion) {
      ui.value = withTiming(0, { duration: REDUCED_FADE });
      later(REDUCED_FADE + 20, () => {
        sink.value = 0;
        day.value = withTiming(1, { duration: REDUCED_FADE });
        later(REDUCED_FADE + 40, onSettled);
      });
      return;
    }
    ui.value = withTiming(0, { duration: SURFACE.ui });
    sink.value = withTiming(0, { duration: SURFACE.croc, easing: Easing.out(Easing.cubic) });
    day.value = withDelay(
      SURFACE.total - SURFACE.fade,
      withTiming(1, { duration: SURFACE.fade, easing: Easing.inOut(Easing.quad) }),
    );
    later(SURFACE.total + 40, onSettled);
  };

  const dayStyle = useAnimatedStyle(() => ({ opacity: day.value }));
  const uiStyle = useAnimatedStyle(() => ({ opacity: ui.value }));
  return { day, sink, ui, depth, dive, rise, dayStyle, uiStyle };
}

export type Dive = ReturnType<typeof useDive>;

/**
 * Controls fade almost away after a few seconds without a touch while the session plays (sleep
 * friendly), and come back on any touch. The first touch on a dimmed control only brings the
 * controls back (a sleepy tap to wake the screen must never pause the trance): wrap a control's
 * action in `wake` for that. Keyboard focus on a control brings them back too (`onFocus: poke`).
 */
export const AUTO_DIM_MS = 5000;
export const DIMMED_OPACITY = 0.12;
const REVEAL_GRACE_MS = 400;

export function useAutoDim(active: boolean) {
  const reducedMotion = useReducedMotion();
  const [idle, setIdle] = useState(false);
  const [touch, setTouch] = useState(0);
  const level = useSharedValue(1);
  const dimmed = active && idle;
  const dimmedRef = useRef(dimmed);
  useEffect(() => {
    dimmedRef.current = dimmed;
  }, [dimmed]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setIdle(true), AUTO_DIM_MS);
    return () => clearTimeout(timer);
  }, [active, touch]);
  useEffect(() => {
    const to = dimmed ? DIMMED_OPACITY : 1;
    level.value = reducedMotion ? to : withTiming(to, { duration: dimmed ? 1200 : 250 });
  }, [dimmed, reducedMotion, level]);
  // When the controls last came back from dimmed: a press in the moment they are still fading in
  // (focus on a mouse-down reveals before the click lands) is still the waking touch.
  const revealedAt = useRef(0);
  const poke = useCallback(() => {
    if (dimmedRef.current) revealedAt.current = Date.now();
    setIdle(false);
    setTouch((n) => n + 1);
  }, []);
  /** In a control's press handler: reveals the controls; true when the press may also act. */
  const guard = useCallback(() => {
    const waking = dimmedRef.current || Date.now() - revealedAt.current < REVEAL_GRACE_MS;
    poke();
    return !waking;
  }, [poke]);
  /** A control's press: reveals the controls, and does the action only if they were visible. */
  const wake = useCallback(
    (action: () => void) => () => {
      if (guard()) action();
    },
    [guard],
  );
  const style = useAnimatedStyle(() => ({ opacity: level.value }));
  return { dimmed, poke, guard, wake, style };
}

export interface NightSceneProps {
  layout: NightLayout;
  sink: SharedValue<number>;
  depth: number;
  crocName?: string;
  /** Show the croc's eyes under the water (the audio player's focus point). */
  eyes?: boolean;
  /** Any touch on the scene (to show dimmed controls again). */
  onTouch?: () => void;
  testID?: string;
  children?: React.ReactNode;
}

/** The night river with the croc in it (and diving under), and its eyes once it is under. */
export function NightScene({
  layout,
  sink,
  depth,
  crocName,
  eyes = true,
  onTouch,
  testID,
  children,
}: NightSceneProps) {
  const { width, height, waterTop, crocX, centreX, ringY } = layout;
  return (
    <Screen
      atmosphere="night"
      scroll={false}
      padded={false}
      edges={[]}
      testID={testID}
      background={
        <>
          <Lagoon
            width={width}
            height={height}
            stage="hatchling"
            expression="eyesClosed"
            showCroc
            crocOffsetY={sink}
            crocName={crocName}
            waterTop={waterTop}
            crocX={crocX}
            crocWidth={Math.min(Math.round(width * 0.72), 380)}
            leafSize={Math.min(Math.round(width * 0.2), Math.round(height * 0.14))}
            farReeds={false}
          />
          {eyes ? <SubmergedEyes x={centreX} y={ringY} sink={sink} depth={depth} /> : null}
        </>
      }
    >
      {onTouch ? (
        // Tap anywhere to bring the controls back (it sits under them).
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onTouch}
          accessibilityLabel={t('player.revealHint')}
          accessible={false}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
      ) : null}
      {children}
    </Screen>
  );
}

/** Where the dock sits: bottom across in portrait, bottom right in landscape. */
export function dockPosition(
  layout: NightLayout,
  insets: { left: number; right: number; bottom: number },
): ViewStyle {
  return layout.landscape
    ? { right: insets.right + space.lg, bottom: insets.bottom + space.lg, width: 340 }
    : {
        left: insets.left + space.lg,
        right: insets.right + space.lg,
        bottom: insets.bottom + space.xl,
      };
}

/** The controls' card on the water. */
export function NightDock({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  const layout = useNightLayout();
  return (
    <View style={[styles.dock, dockPosition(layout, insets), style]} pointerEvents="box-none">
      <View style={styles.dockCard}>{children}</View>
    </View>
  );
}

/** "End the session?": a calm card in Night River tones (it lives inside the night screen). */
export function EndSessionDialog({
  onKeepGoing,
  onEnd,
  testIDPrefix,
}: {
  onKeepGoing: () => void;
  onEnd: () => void;
  testIDPrefix: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.confirmBackdrop} testID={`${testIDPrefix}-end-dialog`}>
      <Reveal style={styles.confirmWrap}>
        <View
          style={[
            styles.confirm,
            theme.shadow.raised,
            { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
          ]}
        >
          <Text variant="heading" heading>
            {t('player.endTitle')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('player.endBody')}
          </Text>
          <Button
            label={t('player.endCancel')}
            variant="secondary"
            size="lg"
            fullWidth
            onPress={onKeepGoing}
            testID={`${testIDPrefix}-end-cancel`}
          />
          <Button
            label={t('player.endConfirm')}
            variant="ghost"
            fullWidth
            onPress={onEnd}
            testID={`${testIDPrefix}-end-confirm`}
          />
        </View>
      </Reveal>
    </View>
  );
}

/**
 * The croc watching from just under the surface: two eye bumps with amber eyes and slit pupils,
 * breathing with you. They appear as the croc goes under and go with it as it rises.
 */
export function SubmergedEyes({
  x,
  y,
  sink,
  depth,
  scale = 1,
}: {
  x: number;
  y: number;
  sink: SharedValue<number>;
  depth: number;
  scale?: number;
}) {
  const reducedMotion = useReducedMotion();
  const { motion, atmosphere } = useTheme();
  const colors = useMemo(() => crocColors(atmosphere), [atmosphere]);
  const breath = useBreath(!reducedMotion, motion.idle, 0, 0.5);
  const style = useAnimatedStyle(() => {
    const under = Math.max(0, Math.min(1, (sink.value / depth - 0.6) / 0.4));
    return { opacity: under * (0.72 + breath.value * 0.28) };
  });
  const W = 92;
  const H = 40;
  const eye = (cx: number) => (
    <React.Fragment key={cx}>
      <Path
        d={`M ${cx - 17} ${H} C ${cx - 17} 14 ${cx - 9} 6 ${cx} 6 C ${cx + 9} 6 ${cx + 17} 14 ${cx + 17} ${H} Z`}
        fill={colors.skinDark}
      />
      <Ellipse cx={cx} cy={21} rx={9} ry={9} fill={colors.pupil} opacity={0.6} />
      <Ellipse cx={cx} cy={21} rx={8} ry={8} fill="url(#night-eye)" />
      <Ellipse cx={cx + 0.4} cy={21} rx={1.5} ry={6} fill={colors.pupil} />
      <Ellipse cx={cx + 3} cy={17.5} rx={1.8} ry={1.8} fill={colors.highlight} opacity={0.9} />
    </React.Fragment>
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.eyes,
        {
          left: x - (W * scale) / 2,
          top: y - 24 * scale,
          width: W * scale,
          height: H * scale,
        },
        style,
      ]}
    >
      <Svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <RadialGradient id="night-eye" cx="50%" cy="45%" r="55%">
            <Stop offset="0" stopColor={EYE_STOPS[0]} />
            <Stop offset="0.65" stopColor={EYE_STOPS[1]} />
            <Stop offset="1" stopColor={EYE_STOPS[2]} />
          </RadialGradient>
        </Defs>
        {[24, 68].map(eye)}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', alignItems: 'center' },
  dockCard: {
    width: '100%',
    maxWidth: 480,
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(palette.shallows, 0.22),
    backgroundColor: withAlpha(palette.nightRiver, 0.78),
  },
  confirmBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: 'rgba(8, 23, 26, 0.6)',
  },
  confirmWrap: { width: '100%', maxWidth: 400 },
  confirm: { borderRadius: radius.lg, borderWidth: 1, padding: space.xl, gap: space.md },
  eyes: { position: 'absolute' },
});
