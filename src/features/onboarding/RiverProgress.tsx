import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { t } from '@/copy';
import { useReducedMotion } from '@/motion/MotionProvider';
import type { OnboardingStep } from '@/services/profile/types';
import { palette, useTheme } from '@/theme';
import { Icon } from '@/ui';

import { stepPosition } from './flow';

export interface RiverProgressProps {
  step: OnboardingStep;
  /** The marker is an egg until the croc has hatched. */
  hatched: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHT = 44;
const MARKER = 26;
const PAD = 18;

/**
 * Stepping stones across a little river: one stone per onboarding step, the ones behind in croc
 * green, the current one carrying the egg (or the hatchling, once hatched), which hops along.
 */
export function RiverProgress({ step, hatched, style, testID }: RiverProgressProps) {
  const { colors, motion } = useTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const { index, total } = stepPosition(step);
  const current = index - 1;

  const gap = width > 0 ? (width - PAD * 2) / Math.max(1, total - 1) : 0;
  const stoneX = (i: number) => PAD + gap * i;
  const stoneY = HEIGHT * 0.62;

  const markerX = useSharedValue(stoneX(current) - MARKER / 2);
  useEffect(() => {
    const target = stoneX(current) - MARKER / 2;
    markerX.value =
      reducedMotion || width === 0 ? target : withSpring(target, { ...motion.spring, mass: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, width, reducedMotion, markerX, motion.spring]);
  const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: markerX.value }] }));

  // A gently waved river under the stones.
  const river =
    width > 0
      ? `M 0 ${stoneY} Q ${width * 0.12} ${stoneY - 9} ${width * 0.25} ${stoneY} T ${width * 0.5} ${stoneY} T ${width * 0.75} ${stoneY} T ${width} ${stoneY}`
      : '';

  return (
    <View
      style={[styles.root, style]}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      accessibilityRole="progressbar"
      accessibilityLabel={t('a11y.onboardingProgress', { index, total })}
      accessibilityValue={{ min: 1, max: total, now: index }}
      testID={testID}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
            <Path
              d={river}
              stroke={colors.waterLight}
              strokeWidth={18}
              strokeLinecap="round"
              fill="none"
              opacity={0.55}
            />
            <Path
              d={river}
              stroke={colors.water}
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
              opacity={0.3}
            />
            {Array.from({ length: total }, (_, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <React.Fragment key={i}>
                  <Ellipse
                    cx={stoneX(i)}
                    cy={stoneY + 2.5}
                    rx={active ? 13 : 10}
                    ry={active ? 7.5 : 5.5}
                    fill={done || active ? colors.primaryDeep : palette.mudDark}
                    opacity={done || active ? 0.45 : 0.25}
                  />
                  <Ellipse
                    cx={stoneX(i)}
                    cy={stoneY}
                    rx={active ? 13 : 10}
                    ry={active ? 7.5 : 5.5}
                    fill={done || active ? colors.primary : colors.surfaceSunken}
                    stroke={done || active ? colors.primaryDeep : colors.border}
                    strokeWidth={1}
                  />
                  {done && (
                    <Path
                      d={`M ${stoneX(i) - 4} ${stoneY} l 3 3 l 5.5 -6`}
                      stroke={colors.textOnPrimary}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </Svg>
          <Animated.View
            pointerEvents="none"
            style={[styles.marker, { top: stoneY - MARKER + 1 }, markerStyle]}
          >
            {hatched ? (
              <Icon name="croc" size={MARKER} color={colors.primaryDeep} />
            ) : (
              <Svg width={MARKER} height={MARKER} viewBox="0 0 26 26">
                <Path
                  d="M13 2.5 C18.5 2.5 21.5 9 21.5 15 C21.5 20.5 17.5 24 13 24 C8.5 24 4.5 20.5 4.5 15 C4.5 9 7.5 2.5 13 2.5 Z"
                  fill={palette.mistLight}
                  stroke={palette.mistOutline}
                  strokeWidth={1.2}
                />
                <Ellipse
                  cx={10}
                  cy={9}
                  rx={1.6}
                  ry={1.3}
                  fill={palette.mistOutline}
                  opacity={0.5}
                />
                <Ellipse
                  cx={16}
                  cy={14}
                  rx={1.4}
                  ry={1.1}
                  fill={palette.mistOutline}
                  opacity={0.5}
                />
                <Ellipse cx={11} cy={18} rx={1.3} ry={1} fill={palette.mistOutline} opacity={0.5} />
              </Svg>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: HEIGHT, width: '100%' },
  marker: { position: 'absolute', left: 0, width: MARKER, height: MARKER },
});
