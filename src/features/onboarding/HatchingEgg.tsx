import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { t } from '@/copy';
import {
  CelebrationBurst,
  Croc,
  EYE_STOPS,
  FIGURE_H,
  FIGURE_TOP,
  FIGURE_W,
  GROUND_Y,
  crocColors,
  type CrocExpression,
} from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { useTheme } from '@/theme';
import { FocusRing, noNativeOutline } from '@/ui/FocusRing';
import { useFocusRing } from '@/ui/useFocusRing';

export const HATCH_TAPS = 3;
/** How long the hatch animation runs before the hatchling is "settled" (name form may show). */
export const HATCH_DURATION_MS = 1900;

export interface HatchingEggProps {
  /** Taps so far (0 to HATCH_TAPS). The egg cracks a little more with each one. */
  taps: number;
  /** The croc is out. With `animateHatch`, the shell bursts first; otherwise it is simply there. */
  hatched: boolean;
  animateHatch?: boolean;
  /** The hatchling's face once out. */
  expression?: CrocExpression;
  name?: string;
  onTap: () => void;
  width: number;
  testID?: string;
}

/** Egg canvas: 100 wide, 124 tall; the egg fills it with a little room for the wobble. */
const EGG_VB = { w: 100, h: 124 };
const EGG_PATH =
  'M50 4 C 76 4 90 34 90 68 C 90 98 72 118 50 118 C 28 118 10 98 10 68 C 10 34 24 4 50 4 Z';
const SPECKLES: [number, number, number][] = [
  [30, 36, 3.2],
  [66, 28, 2.6],
  [74, 60, 3.4],
  [26, 70, 3],
  [52, 84, 3.6],
  [36, 100, 2.6],
  [68, 96, 3],
];
/** The first crack (after one tap) and how it grows (after two). */
const CRACK_1 = 'M58 30 l 6 -7 l 5 7 l 6 -8';
const CRACK_2 = 'M30 54 l 7 -7 l 6 7 l 7 -9 l 6 6 l 7 -6 l 6 5';
/** The opening the eye looks out of (after two taps). */
const HOLE = 'M38 60 L 46 50 L 54 56 L 63 48 L 71 58 L 67 70 L 55 76 L 42 72 Z';
const EYE = { cx: 55, cy: 62, r: 7 };

/** Shell pieces that fly apart on the hatch: a curved shard each, its direction and spin. */
const FRAGMENTS: { d: string; angle: number; spin: number; reach: number; size: number }[] = [
  // Cap: the top of the shell flips up and away.
  {
    d: 'M2 26 C 6 10 16 2 30 2 C 36 2 38 6 38 12 C 30 14 22 20 14 28 Z',
    angle: -96,
    spin: -160,
    reach: 1.3,
    size: 0.46,
  },
  {
    d: 'M2 18 C 4 8 12 2 24 2 C 28 8 26 18 20 26 C 12 28 6 26 2 18 Z',
    angle: -140,
    spin: -260,
    reach: 1,
    size: 0.34,
  },
  {
    d: 'M2 6 C 12 0 22 2 30 10 C 30 18 24 26 14 28 C 6 24 2 16 2 6 Z',
    angle: -48,
    spin: 240,
    reach: 1,
    size: 0.34,
  },
  {
    d: 'M2 12 C 8 4 18 2 26 6 C 24 14 20 22 10 26 C 4 22 2 18 2 12 Z',
    angle: -170,
    spin: -320,
    reach: 0.8,
    size: 0.28,
  },
  {
    d: 'M2 8 C 10 2 20 2 28 8 C 26 16 22 22 12 26 C 6 22 2 16 2 8 Z',
    angle: -12,
    spin: 300,
    reach: 0.8,
    size: 0.28,
  },
  {
    d: 'M2 10 C 6 4 14 2 20 6 C 20 12 16 18 8 20 C 4 18 2 14 2 10 Z',
    angle: -75,
    spin: 180,
    reach: 1.5,
    size: 0.22,
  },
];

function Fragment({
  piece,
  progress,
  eggW,
  eggH,
  originX,
  originY,
  fill,
  shade,
  stroke,
}: {
  piece: (typeof FRAGMENTS)[number];
  progress: SharedValue<number>;
  eggW: number;
  eggH: number;
  originX: number;
  originY: number;
  fill: string;
  shade: string;
  stroke: string;
}) {
  const rad = (piece.angle * Math.PI) / 180;
  // Each shard starts on the shell where it broke off and flies outwards from there.
  const startX = Math.cos(rad) * eggW * 0.3;
  const startY = Math.sin(rad) * eggH * 0.3;
  const dx = Math.cos(rad) * eggH * 0.8 * piece.reach;
  const dy = Math.sin(rad) * eggH * 0.8 * piece.reach;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const out = 1 - (1 - p) * (1 - p);
    // Pieces fly out, then gravity takes over.
    const fall = p * p * eggH * 1.1;
    return {
      opacity: p === 0 ? 0 : 1 - Math.max(0, (p - 0.55) / 0.45),
      transform: [
        { translateX: startX + dx * out },
        { translateY: startY + dy * out + fall },
        { rotate: `${piece.spin * out}deg` },
      ],
    };
  });
  const w = Math.round(eggH * piece.size);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.fragment,
        { left: originX - w / 2, top: originY - w / 2, width: w, height: w },
        style,
      ]}
    >
      <Svg width={w} height={w} viewBox="0 0 40 30">
        <Path d={piece.d} fill={fill} stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
        <Path d={piece.d} fill={shade} opacity={0.35} transform="translate(0 6) scale(1 0.5)" />
        <Ellipse cx={16} cy={13} rx={2.4} ry={1.9} fill={stroke} opacity={0.5} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The hatching moment. The egg waits in its nest with a small wobble and an occasional nudge from
 * inside; each tap rocks it and cracks the shell further (after the second, an amber eye looks
 * out); the third bursts the shell into flying pieces and the hatchling pops up, looks around, and
 * petals and sparkles rise. Reduced motion: the cracks simply appear and the shell fades into the
 * hatchling.
 */
export function HatchingEgg({
  taps,
  hatched,
  animateHatch = false,
  expression = 'excited',
  name,
  onTap,
  width,
  testID,
}: HatchingEggProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const live = !reducedMotion;
  const colors = useMemo(() => crocColors(theme.atmosphere), [theme.atmosphere]);
  const focus = useFocusRing();

  const height = Math.round(width * 0.74);
  const groundY = Math.round(height * 0.84);
  const eggH = Math.round(Math.min(height * 0.62, width * 0.4));
  const eggW = Math.round(eggH * (EGG_VB.w / EGG_VB.h));
  const eggLeft = Math.round(width / 2 - eggW / 2);
  const eggTop = groundY - eggH + Math.round(eggH * 0.06);
  // The hatchling stands where the egg stood. Its canvas is mostly air, so it is drawn wider than
  // the nest: the croc itself then reads at about half the nest's width, the hero of the frame.
  const crocW = Math.min(Math.round(width * 1.4), 680);
  const crocH = Math.round((crocW * (FIGURE_H - FIGURE_TOP)) / FIGURE_W);
  const crocTop = groundY - Math.round((crocH * (GROUND_Y - FIGURE_TOP)) / (FIGURE_H - FIGURE_TOP));
  const crocLeft = Math.round(width / 2 - crocW / 2);

  // Idle: a slow rock, and every few seconds a quick nudge from inside (an invitation to tap).
  const rock = useSharedValue(0);
  const nudge = useSharedValue(0);
  const waiting = live && !hatched;
  useEffect(() => {
    if (!waiting) {
      cancelAnimation(rock);
      cancelAnimation(nudge);
      rock.value = 0;
      nudge.value = 0;
      return;
    }
    rock.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    nudge.value = withRepeat(
      withSequence(
        withDelay(2600, withTiming(1, { duration: 70 })),
        withTiming(-1, { duration: 90 }),
        withTiming(0.6, { duration: 80 }),
        withTiming(0, { duration: 140 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(rock);
      cancelAnimation(nudge);
    };
  }, [waiting, rock, nudge]);

  // Each tap: a hard rock and a squash, and the next crack layer shows.
  const kick = useSharedValue(0);
  const squash = useSharedValue(0);
  const crack1 = useSharedValue(taps >= 1 ? 1 : 0);
  const crack2 = useSharedValue(taps >= 2 ? 1 : 0);
  useEffect(() => {
    if (taps >= 1) crack1.value = live ? withTiming(1, { duration: 160 }) : 1;
    if (taps >= 2) crack2.value = live ? withTiming(1, { duration: 200 }) : 1;
    if (taps === 0 || hatched || !live) return;
    kick.value = 0;
    kick.value = withSequence(
      withTiming(-1, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(0.8, { duration: 110 }),
      withTiming(-0.45, { duration: 100 }),
      withSpring(0, theme.motion.spring),
    );
    squash.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(0, { ...theme.motion.spring, damping: 10 }),
    );
  }, [taps, hatched, live, kick, squash, crack1, crack2, theme.motion.spring]);

  // The hatch: shell out, croc up, then a look around.
  const burst = useSharedValue(hatched && !animateHatch ? 1 : 0);
  const shell = useSharedValue(hatched && !animateHatch ? 0 : 1);
  const pop = useSharedValue(hatched && !animateHatch ? 1 : 0);
  const sway = useSharedValue(0);
  useEffect(() => {
    if (!hatched) return;
    if (!animateHatch) {
      burst.value = 1;
      shell.value = 0;
      pop.value = 1;
      return;
    }
    if (!live) {
      shell.value = withTiming(0, { duration: 320 });
      pop.value = withTiming(1, { duration: 320 });
      burst.value = 1;
      return;
    }
    shell.value = withTiming(0, { duration: 140 });
    burst.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });
    pop.value = withDelay(100, withSpring(1, { damping: 11, stiffness: 150, mass: 0.9 }));
    sway.value = withDelay(
      900,
      withSequence(
        withTiming(-1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 420, easing: Easing.inOut(Easing.sin) }),
      ),
    );
  }, [hatched, animateHatch, live, burst, shell, pop, sway]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: shell.value,
    transform: [
      { translateY: eggH * 0.47 },
      { rotate: `${rock.value * 2 + nudge.value * 4 + kick.value * 11}deg` },
      { scaleX: 1 + squash.value * 0.06 },
      { scaleY: 1 - squash.value * 0.08 },
      { translateY: -eggH * 0.47 },
    ],
  }));
  const crack1Style = useAnimatedStyle(() => ({ opacity: crack1.value }));
  const crack2Style = useAnimatedStyle(() => ({ opacity: crack2.value }));
  // A warm light swells behind the hatchling as the shell bursts and stays as a soft halo.
  const glowStyle = useAnimatedStyle(() => {
    const p = burst.value;
    return {
      opacity: Math.min(1, p * 3) * (1 - p * 0.5),
      transform: [{ scale: 0.5 + Math.min(1, p * 1.6) * 0.5 }],
    };
  });
  const crocStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [
      { translateY: (1 - pop.value) * eggH * 0.5 },
      { rotate: `${sway.value * 4}deg` },
      { scale: 0.35 + pop.value * 0.65 },
    ],
  }));

  const remaining = Math.max(0, HATCH_TAPS - taps);
  const glowR = Math.round(crocW * 0.42);
  const eggCentreX = eggLeft + eggW / 2;
  const eggCentreY = eggTop + eggH * 0.5;

  return (
    <View style={[styles.root, { width, height }]} testID={testID}>
      {/* Nest: a mud mound with a few reeds, on the bank. */}
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        aria-hidden
      >
        <Ellipse
          cx={width / 2}
          cy={groundY + eggH * 0.06}
          rx={eggW * 1.15}
          ry={eggH * 0.14}
          fill={colors.mud}
          opacity={0.9}
        />
        <Ellipse
          cx={width / 2}
          cy={groundY}
          rx={eggW}
          ry={eggH * 0.1}
          fill={colors.nest}
          opacity={0.95}
        />
        {[
          [-1.05, 0.5, -0.2],
          [-0.8, 0.68, -0.1],
          [0.9, 0.6, 0.18],
          [1.15, 0.42, 0.26],
        ].map(([dx, h, lean], i) => (
          <Path
            key={i}
            d={`M ${width / 2 + eggW * dx!} ${groundY} Q ${width / 2 + eggW * (dx! + lean! * 0.4)} ${groundY - eggH * h! * 0.6} ${width / 2 + eggW * (dx! + lean!)} ${groundY - eggH * h!}`}
            stroke={colors.nest}
            strokeWidth={Math.max(3, eggW * 0.05)}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>

      {/* The light of the moment, behind the hatchling. */}
      {hatched && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              left: width / 2 - glowR,
              top: groundY - glowR * 1.1,
              width: glowR * 2,
              height: glowR * 2,
            },
            glowStyle,
          ]}
        >
          <Svg width={glowR * 2} height={glowR * 2} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="hatch-glow" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={colors.sparkle} stopOpacity={0.55} />
                <Stop offset="0.45" stopColor={colors.sparkle} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.sparkle} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={50} cy={50} rx={50} ry={50} fill="url(#hatch-glow)" />
          </Svg>
        </Animated.View>
      )}

      {/* The hatchling, hidden inside the egg until it hatches. */}
      {hatched && (
        <Animated.View
          style={[
            styles.croc,
            { left: crocLeft, top: crocTop, width: crocW, height: crocH },
            crocStyle,
          ]}
          testID={testID ? `${testID}-hatchling` : undefined}
        >
          <Croc
            stage="hatchling"
            expression={expression}
            width={crocW}
            relativeSize={false}
            groundShadow={false}
            name={name}
            accessibilityLabel={t('onboarding.hatch.a11yHatched')}
          />
        </Animated.View>
      )}

      {/* The egg. One Pressable; the taps count on the screen. */}
      <Pressable
        onPress={hatched ? undefined : onTap}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        disabled={hatched}
        accessibilityRole="button"
        accessibilityLabel={
          remaining === 1
            ? t('onboarding.hatch.a11yEggOne')
            : t('onboarding.hatch.a11yEgg', { n: remaining })
        }
        accessibilityState={{ disabled: hatched }}
        testID={testID ? `${testID}-egg` : undefined}
        style={[
          styles.egg,
          noNativeOutline,
          { left: eggLeft - 16, top: eggTop - 16, width: eggW + 32, height: eggH + 32 },
        ]}
        hitSlop={12}
      >
        {focus.focused && !hatched && (
          <>
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  margin: -2,
                  borderRadius: eggW / 2 + 18,
                  borderWidth: 7,
                  borderColor: colors.highlight,
                },
              ]}
            />
            <FocusRing radius={eggW / 2 + 16} offset={0} />
          </>
        )}
        <Animated.View style={[styles.eggInner, { width: eggW, height: eggH }, eggStyle]}>
          <Svg width={eggW} height={eggH} viewBox={`0 0 ${EGG_VB.w} ${EGG_VB.h}`}>
            <Defs>
              <LinearGradient id="hatch-shell" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.shell} />
                <Stop offset="0.6" stopColor={colors.shell} />
                <Stop offset="1" stopColor={colors.shellShade} />
              </LinearGradient>
              <RadialGradient
                id="hatch-eye"
                cx={EYE.cx}
                cy={EYE.cy - 1}
                r={EYE.r * 1.1}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={EYE_STOPS[0]} />
                <Stop offset="0.65" stopColor={EYE_STOPS[1]} />
                <Stop offset="1" stopColor={EYE_STOPS[2]} />
              </RadialGradient>
            </Defs>
            <Path
              d={EGG_PATH}
              fill="url(#hatch-shell)"
              stroke={colors.shellSpeckle}
              strokeWidth={1.2}
            />
            {SPECKLES.map(([cx, cy, r], i) => (
              <Ellipse
                key={i}
                cx={cx}
                cy={cy}
                rx={r}
                ry={r * 0.8}
                fill={colors.shellSpeckle}
                opacity={0.5}
              />
            ))}
            <Ellipse cx={34} cy={34} rx={8} ry={15} fill={colors.highlight} opacity={0.4} />
          </Svg>
          {/* Crack layers fade in on top of the shell. */}
          <Animated.View style={[StyleSheet.absoluteFill, crack1Style]} pointerEvents="none">
            <Svg width={eggW} height={eggH} viewBox={`0 0 ${EGG_VB.w} ${EGG_VB.h}`}>
              <Path
                d={CRACK_1}
                stroke={colors.shellSpeckle}
                strokeWidth={2.4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, crack2Style]} pointerEvents="none">
            <Svg width={eggW} height={eggH} viewBox={`0 0 ${EGG_VB.w} ${EGG_VB.h}`}>
              <Path
                d={CRACK_2}
                stroke={colors.shellSpeckle}
                strokeWidth={2.4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path d={HOLE} fill={colors.pupil} />
              <Ellipse cx={EYE.cx} cy={EYE.cy} rx={EYE.r} ry={EYE.r} fill="url(#hatch-eye)" />
              <Ellipse
                cx={EYE.cx + 0.6}
                cy={EYE.cy}
                rx={EYE.r * 0.22}
                ry={EYE.r * 0.74}
                fill={colors.pupil}
              />
              <Ellipse
                cx={EYE.cx + 2.4}
                cy={EYE.cy - 2.8}
                rx={1.5}
                ry={1.5}
                fill={colors.highlight}
                opacity={0.9}
              />
              <Path d={HOLE} fill="none" stroke={colors.shellSpeckle} strokeWidth={1.2} />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Pressable>

      {/* Shell pieces and the celebration, in front of everything. */}
      {hatched && animateHatch && live && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {FRAGMENTS.map((piece, i) => (
            <Fragment
              key={i}
              piece={piece}
              progress={burst}
              eggW={eggW}
              eggH={eggH}
              originX={eggCentreX}
              originY={eggCentreY}
              fill={colors.shell}
              shade={colors.shellShade}
              stroke={colors.shellSpeckle}
            />
          ))}
        </View>
      )}
      <CelebrationBurst
        active={hatched && animateHatch}
        x={eggCentreX}
        y={eggCentreY - eggH * 0.1}
        radius={Math.round(Math.min(Math.max(width * 0.6, 150), 320))}
        testID={testID ? `${testID}-celebration` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', overflow: 'visible' },
  croc: { position: 'absolute' },
  glow: { position: 'absolute' },
  egg: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  eggInner: { position: 'relative' },
  fragment: { position: 'absolute' },
});
