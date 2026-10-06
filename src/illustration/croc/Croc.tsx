import React, { useEffect, useId, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { t } from '@/copy';
import { useReducedMotion } from '@/motion/MotionProvider';
import { useTheme } from '@/theme';

import { crocColors, EYE_STOPS } from './colors';
import { buildCroc, peekWaterlineRatio } from './geometry';
import { FACE_SPECS } from './specs';
import { resolveFill } from './toSvgString';
import { type CrocExpression, type CrocPose, type CrocStage, type Shape } from './types';
import { useIdleBlink } from './useIdleBlink';

export interface CrocProps {
  stage: CrocStage;
  expression?: CrocExpression;
  pose?: CrocPose;
  /** Rendered width; the height follows the drawing's aspect ratio. */
  width: number;
  /** Idle life: a slow bob and occasional blink. Off automatically with reduced motion. */
  animated?: boolean;
  /** Full pose: draw stages at their relative size (hatchling small, grand big). */
  relativeSize?: boolean;
  groundShadow?: boolean;
  /** Peek pose: draw the water inside the component (for avatars and the gallery). */
  water?: 'none' | 'inline';
  /** The croc's name for the accessibility label. */
  name?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function renderShape(shape: Shape, key: string, gradientId: string): React.ReactElement {
  const fill = (f?: string) => resolveFill(f, gradientId) ?? 'none';
  switch (shape.kind) {
    case 'path':
      return (
        <Path
          key={key}
          d={shape.d}
          fill={fill(shape.fill)}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          strokeLinecap={shape.stroke ? 'round' : undefined}
          strokeLinejoin={shape.stroke ? 'round' : undefined}
          strokeDasharray={shape.dash}
          opacity={shape.opacity}
        />
      );
    case 'ellipse':
      return (
        <Ellipse
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={fill(shape.fill)}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          opacity={shape.opacity}
        />
      );
    case 'group':
      return (
        <G key={key} transform={shape.transform} opacity={shape.opacity}>
          {shape.children.map((child, i) => renderShape(child, `${key}-${i}`, gradientId))}
        </G>
      );
  }
}

/**
 * The croc mascot. Five growth stages, six expressions, full-body or peeking-above-water pose.
 * Pure geometry lives in geometry.ts; this component only renders and animates it.
 */
export function Croc({
  stage,
  expression = 'calm',
  pose = 'full',
  width,
  animated = true,
  relativeSize = true,
  groundShadow = true,
  water = 'none',
  name,
  accessibilityLabel,
  testID,
  style,
}: CrocProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const gradientId = `croc-eye-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const live = animated && !reducedMotion;
  const canBlink = live && stage !== 'egg' && FACE_SPECS[expression].eyeOpen > 0;
  const blink = useIdleBlink({ enabled: canBlink, interval: theme.motion.idle });

  const colors = useMemo(() => crocColors(theme.atmosphere), [theme.atmosphere]);
  const drawing = useMemo(
    () => buildCroc({ stage, expression, pose, colors, blink, relativeSize, groundShadow }),
    [stage, expression, pose, colors, blink, relativeSize, groundShadow],
  );

  // Idle bob (translate) or, for the egg, a tiny wobble. UI-thread animation via Reanimated.
  const idle = useSharedValue(0);
  const idleDuration = theme.motion.idle;
  useEffect(() => {
    if (!live) {
      cancelAnimation(idle);
      idle.value = 0;
      return;
    }
    idle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: idleDuration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: idleDuration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(idle);
  }, [live, idle, idleDuration]);

  // A change of expression gets a small bob (a dip and a springy rise), so a reaction reads as a
  // reaction and not as a swapped picture. Not on first render, not with reduced motion.
  const react = useSharedValue(0);
  const previousExpression = useRef(expression);
  const reactSpring = theme.motion.spring;
  useEffect(() => {
    if (previousExpression.current === expression) return;
    previousExpression.current = expression;
    if (!live) return;
    react.value = 0;
    if (stage === 'egg') {
      // The egg answers with a wobble: something inside noticed.
      react.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(-0.8, { duration: 110 }),
        withTiming(0.5, { duration: 100 }),
        withSpring(0, reactSpring),
      );
      return;
    }
    react.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withSpring(0, reactSpring),
    );
  }, [expression, live, stage, react, reactSpring]);

  const amplitude = pose === 'peek' ? 2.5 : 3;
  const idleStyle = useAnimatedStyle(() => {
    if (stage === 'egg') {
      return { transform: [{ rotate: `${(idle.value - 0.5) * 3 + react.value * 7}deg` }] };
    }
    return {
      transform: [
        { translateY: (idle.value - 0.5) * amplitude + react.value * 5 },
        { scale: 1 + react.value * 0.025 },
      ],
    };
  });

  const { viewBox, shapes, eye, gradients } = drawing;
  const height = (width * viewBox.h) / viewBox.w;
  const waterline =
    pose === 'peek' && stage !== 'egg'
      ? viewBox.y + peekWaterlineRatio(drawing) * viewBox.h
      : undefined;

  const label =
    accessibilityLabel ??
    (stage === 'egg'
      ? t('a11y.egg')
      : t('a11y.crocStage', {
          name: name ?? t('croc.defaultName'),
          stage: t(`croc.stages.${stage}`),
        }));

  return (
    <View
      style={[{ width, height }, styles.clip, style]}
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
    >
      <Animated.View style={[styles.fill, idleStyle]}>
        <Svg
          width={width}
          height={height}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        >
          <Defs>
            {eye && (
              <RadialGradient
                id={gradientId}
                cx={eye.cx}
                cy={eye.cy - eye.r * 0.15}
                r={eye.r * 1.1}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={EYE_STOPS[0]} />
                <Stop offset="0.65" stopColor={EYE_STOPS[1]} />
                <Stop offset="1" stopColor={EYE_STOPS[2]} />
              </RadialGradient>
            )}
            {gradients?.map((g) => (
              <LinearGradient
                key={g.id}
                id={`${gradientId}-${g.id}`}
                x1={g.x1}
                y1={g.y1}
                x2={g.x2}
                y2={g.y2}
                gradientUnits="userSpaceOnUse"
              >
                {g.stops.map((s, i) => (
                  <Stop key={i} offset={s.offset} stopColor={s.color} />
                ))}
              </LinearGradient>
            ))}
          </Defs>
          {shapes.map((shape, i) => renderShape(shape, `s${i}`, gradientId))}
          {water === 'inline' && waterline !== undefined && (
            <>
              <Rect
                x={viewBox.x}
                y={waterline}
                width={viewBox.w}
                height={viewBox.y + viewBox.h - waterline}
                fill={theme.colors.water}
                opacity={0.9}
              />
              <Path
                d={`M ${viewBox.x} ${waterline + 1.5} q ${viewBox.w * 0.08} -2.5 ${viewBox.w * 0.16} 0 t ${viewBox.w * 0.16} 0 t ${viewBox.w * 0.16} 0 t ${viewBox.w * 0.16} 0 t ${viewBox.w * 0.16} 0 t ${viewBox.w * 0.16} 0 t ${viewBox.w * 0.16} 0`}
                stroke={theme.colors.waterLight}
                strokeWidth={1.4}
                fill="none"
                opacity={0.7}
              />
            </>
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fill: { flex: 1 },
});
