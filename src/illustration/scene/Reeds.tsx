import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '@/motion/MotionProvider';
import { palette, useTheme } from '@/theme';

import { decorative } from './decorative';
import { useBreath } from './useLoop';

export interface ReedsProps {
  width?: number;
  height?: number;
  /** Number of stalks (2..7). */
  count?: number;
  /** Mirror the cluster. */
  flip?: boolean;
  /** Slow sway in the breeze (off with reduced motion). */
  animated?: boolean;
  tone?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Margin inside the canvas so leaning stalks and cattail heads are never clipped by the bounds. */
const INSET = 12;
const HEAD_H = 18;

/** A clump of reeds with cattail heads and a few grass blades, rooted at the bottom centre. */
export function Reeds({
  width = 90,
  height = 120,
  count = 5,
  flip = false,
  animated = true,
  tone = 'dark',
  style,
  testID,
}: ReedsProps) {
  const { atmosphere, motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const live = animated && !reducedMotion;
  const sway = useBreath(live, motion.idle * 1.4, 0, 0.5);

  const night = atmosphere === 'night';
  const stalk =
    tone === 'dark'
      ? night
        ? '#1E4B33'
        : palette.crocGreenDark
      : night
        ? '#2E6A44'
        : palette.leaf;
  const blade =
    tone === 'dark' ? (night ? '#265A3C' : palette.jungleMid) : night ? '#3A7A4E' : '#7FB063';
  const head = night ? '#4A3620' : palette.riverbankMud;
  const headLight = night ? '#5C4529' : palette.mudDark;

  const swayStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(sway.value - 0.5) * 3}deg` }],
  }));

  const n = Math.max(2, Math.min(7, count));
  const usable = width - INSET * 2;
  const stalks = Array.from({ length: n }, (_, i) => {
    const f = n === 1 ? 0.5 : i / (n - 1);
    const lean = (f - 0.5) * Math.min(18, usable * 0.3);
    // Keep the top of every stalk (plus its head) inside the canvas, whichever way it leans.
    const x = INSET + f * usable - lean * 0.5;
    const maxH = height - HEAD_H - 4;
    const h = maxH * (0.56 + 0.44 * Math.abs(Math.sin(i * 1.7 + 0.6)));
    const hasHead = i % 2 === 0;
    return { x, h, lean, hasHead, i };
  });

  return (
    <Animated.View
      style={[
        { width, height, transformOrigin: 'bottom center' },
        flip && { transform: [{ scaleX: -1 }] },
        swayStyle,
        style,
      ]}
      testID={testID}
      pointerEvents="none"
      {...decorative}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Grass blades at the base, behind the stalks. */}
        {stalks.slice(0, Math.min(3, n)).map(({ x, lean, i }) => {
          const bx = x + (i % 2 ? 6 : -6);
          const bh = height * 0.42;
          const dir = lean >= 0 ? 1 : -1;
          return (
            <Path
              key={`blade-${i}`}
              d={`M ${bx} ${height} Q ${bx + dir * 2} ${height - bh * 0.6} ${bx + dir * 14} ${height - bh} Q ${bx + dir * 6} ${height - bh * 0.55} ${bx + 3} ${height} Z`}
              fill={blade}
              opacity={0.9}
            />
          );
        })}
        {stalks.map(({ x, h, lean, hasHead, i }) => {
          const topX = x + lean;
          const topY = height - h;
          return (
            <React.Fragment key={i}>
              <Path
                d={`M ${x} ${height} Q ${x + lean * 0.35} ${height - h * 0.55} ${topX} ${topY}`}
                stroke={stalk}
                strokeWidth={2.6}
                strokeLinecap="round"
                fill="none"
              />
              {hasHead ? (
                <>
                  {/* Cattail: a soft brown capsule with a thin spike on top. */}
                  <Path
                    d={`M ${topX} ${topY - 2} L ${topX + lean * 0.08} ${topY - HEAD_H + 2}`}
                    stroke={stalk}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    fill="none"
                  />
                  <Path
                    d={`M ${topX - 3.4} ${topY + 2} a 3.4 3.4 0 0 1 6.8 0 v ${HEAD_H * 0.55} a 3.4 3.4 0 0 1 -6.8 0 Z`}
                    fill={head}
                    transform={`translate(0 ${-HEAD_H * 0.3})`}
                  />
                  <Path
                    d={`M ${topX - 1.4} ${topY + 2} v ${HEAD_H * 0.5}`}
                    stroke={headLight}
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    opacity={0.5}
                    transform={`translate(0 ${-HEAD_H * 0.3})`}
                  />
                </>
              ) : (
                <Path
                  d={`M ${topX} ${topY} q ${lean > 0 ? 7 : -7} -5 ${lean > 0 ? 13 : -13} -2`}
                  stroke={stalk}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  fill="none"
                />
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </Animated.View>
  );
}
