import React, { useId, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { palette, useTheme } from '@/theme';

import { Croc } from '../croc/Croc';
import { crocColors } from '../croc/colors';
import { buildCroc, peekFocusRatio, peekWaterlineRatio } from '../croc/geometry';
import type { CrocExpression, CrocStage } from '../croc/types';
import { CelebrationBurst } from './CelebrationBurst';
import { decorative } from './decorative';
import { FarJungle } from './FarJungle';
import { Fireflies } from './Fireflies';
import { JungleLeaves } from './JungleLeaves';
import { LilyPad } from './LilyPad';
import { Reeds } from './Reeds';
import { SkyGlow } from './SkyGlow';
import { WaterSplash } from './WaterSplash';
import { WaterSurface } from './WaterSurface';

export interface LagoonProps {
  width: number;
  height: number;
  stage?: CrocStage;
  expression?: CrocExpression;
  /** Fraction of the height where the water starts. */
  waterTop?: number;
  /** Fraction of the height where the near riverbank starts (the water ends there). Omit for open water to the bottom. */
  bankTop?: number;
  /** Horizontal centre of the croc's head as a fraction of the width. */
  crocX?: number;
  /** Width of the whole croc drawing (head, back and tail tip) in points. Defaults to 84% of the width, at most 520. */
  crocWidth?: number;
  /** Size of the corner foliage (defaults to a third of the width, capped by the height). */
  leafSize?: number;
  /** Reeds on the far bank, left (turn off when something else occupies the top-left, e.g. a title in landscape). */
  farReeds?: boolean;
  /** Petals, sparkles and bubbles burst from the croc while true (a celebration). */
  celebrate?: boolean;
  /** How far the celebration reaches (1 is the everyday burst; the reward uses more). */
  celebrationScale?: number;
  /** A splash on the water where the croc lands while true (plays once each time it turns on). */
  splash?: boolean;
  /** Draw the croc at all (off for a scene whose hero sits elsewhere, e.g. an egg on the bank). */
  showCroc?: boolean;
  /**
   * Vertical offset of the croc in points, animated on the UI thread: positive sinks it under the
   * water (the water is drawn in front, so it fades out as it goes down).
   */
  crocOffsetY?: SharedValue<number>;
  /** The croc's name for its accessibility label. */
  crocName?: string;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A full scene: the sun or moon in the sky, a misty far jungle on the horizon, the river with the croc
 * peeking out of it, lily pads and reeds, jungle leaves framing the corners and optionally the near bank
 * in the foreground. The croc's waterline is aligned with the water surface.
 * Pieces that need room (lily pads, near reeds) drop out when the water band is short.
 */
export function Lagoon({
  width,
  height,
  stage = 'juvenile',
  expression = 'calm',
  waterTop = 0.58,
  bankTop,
  crocX = 0.5,
  crocWidth,
  leafSize,
  farReeds = true,
  celebrate = false,
  celebrationScale = 1,
  splash = false,
  showCroc = true,
  crocOffsetY,
  crocName,
  animated = true,
  style,
  testID,
}: LagoonProps) {
  const { colors, atmosphere } = useTheme();
  const night = atmosphere === 'night';
  const ids = useId().replace(/[^a-zA-Z0-9]/g, '');

  const cw = crocWidth ?? Math.min(Math.round(width * 0.84), 520);
  const waterY = Math.round(height * waterTop);
  const bankY = bankTop === undefined ? undefined : Math.round(height * bankTop);
  const waterBottom = bankY ?? height;
  const leaves = leafSize ?? Math.min(Math.round(width * 0.32), Math.round(height * 0.3));

  const ratio = useMemo(() => {
    const d = buildCroc({ stage, expression, pose: 'peek', colors: crocColors(atmosphere) });
    return {
      r: peekWaterlineRatio(d),
      focus: peekFocusRatio(d),
      aspect: d.viewBox.h / d.viewBox.w,
    };
  }, [stage, expression, atmosphere]);
  const crocHeight = cw * ratio.aspect;
  const crocTop = waterY - ratio.r * crocHeight + 2;
  const crocLeft = Math.round(width * crocX - cw * ratio.focus);

  const bankFill = night ? '#0C2A22' : '#DDEBD2';
  const bankEdge = night ? palette.jungleNight : palette.leaf;
  const mud = night ? '#3A2A18' : palette.riverbankMud;
  const waterHeight = waterBottom - waterY;
  const roomy = waterHeight >= 150;
  const horizonH = Math.round(Math.min(150, Math.max(64, height * 0.14)));
  const glowSize = Math.round(Math.min(width * 1.1, 480));
  const crocOffsetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: crocOffsetY ? crocOffsetY.value : 0 }],
  }));

  return (
    <View style={[{ width, height }, styles.clip, style]} testID={testID} pointerEvents="none">
      <View style={StyleSheet.absoluteFill} {...decorative}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`sky-${ids}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} />
              <Stop offset="1" stopColor={night ? colors.backgroundDeep : colors.surfaceSunken} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#sky-${ids})`} />
        </Svg>
        {/* The light in the sky: sun haze behind the croc by day, a moon up and away at night. */}
        <SkyGlow
          size={glowSize}
          style={{
            position: 'absolute',
            left: Math.round(width * (night ? Math.min(0.82, crocX + 0.3) : crocX) - glowSize / 2),
            top: Math.round(waterY - glowSize * (night ? 0.72 : 0.58)),
          }}
        />
        {/* Ambient life in the air: fireflies at night, drifting seeds and pollen by day. */}
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, height: waterY }}>
          {night ? (
            <Fireflies count={6} intensity={0.9} animated={animated} />
          ) : (
            <Fireflies
              count={5}
              intensity={0.55}
              color={palette.mistLight}
              scale={0.75}
              animated={animated}
            />
          )}
        </View>
        {/* Far jungle on the horizon, fading into mist where it meets the water. */}
        <FarJungle
          width={width + 40}
          height={horizonH}
          style={{ position: 'absolute', left: -20, top: waterY - horizonH + 8 }}
        />
        <View
          style={[
            styles.farBank,
            {
              top: waterY - 12,
              backgroundColor: night ? '#0F3328' : colors.primarySoft,
              opacity: night ? 0.7 : 0.55,
            },
          ]}
        />
        {farReeds && waterHeight >= 100 && (
          <Reeds
            count={5}
            width={110}
            height={130}
            style={{ position: 'absolute', left: -8, top: waterY - 118 }}
            animated={animated}
          />
        )}
        <Reeds
          count={4}
          width={90}
          height={100}
          flip
          style={{ position: 'absolute', right: 10, top: waterY - 88 }}
          animated={animated}
          tone="light"
        />
      </View>

      {showCroc && (
        <Animated.View
          style={[{ position: 'absolute', left: crocLeft, top: crocTop }, crocOffsetStyle]}
        >
          <Croc
            stage={stage}
            expression={expression}
            pose="peek"
            width={cw}
            animated={animated}
            name={crocName}
          />
        </Animated.View>
      )}

      <View style={StyleSheet.absoluteFill} {...decorative}>
        {/* Water in front of the croc so the submerged part fades out under the surface. */}
        <WaterSurface
          style={{ top: waterY, height: waterHeight }}
          ripples={[
            {
              x: crocX,
              y: Math.min(0.3, 60 / Math.max(1, waterHeight)),
              size: Math.round(cw * 0.7),
            },
            { x: 0.2, y: 0.72, size: 70 },
            { x: 0.84, y: 0.5, size: 90 },
          ]}
          animated={animated}
          testID={testID ? `${testID}-water` : undefined}
        />
        {waterHeight >= 110 && (
          <>
            <LilyPad
              size={88}
              flower
              style={{ position: 'absolute', left: width * 0.05, top: waterY + waterHeight * 0.4 }}
              rotation={-20}
            />
            <LilyPad
              size={64}
              style={{ position: 'absolute', right: width * 0.1, top: waterY + waterHeight * 0.16 }}
              rotation={30}
            />
            <LilyPad
              size={52}
              style={{
                position: 'absolute',
                right: width * 0.26,
                top: waterY + waterHeight * 0.62,
              }}
              rotation={160}
            />
          </>
        )}

        {bankY !== undefined && (
          <>
            <Svg
              width={width}
              height={height - bankY + 20}
              viewBox={`0 0 ${width} ${height - bankY + 20}`}
              style={{ position: 'absolute', left: 0, top: bankY - 20 }}
            >
              {/* Mud under the grass edge, then the bank itself with a gently waved edge. */}
              <Path
                d={`M0 20 Q ${width * 0.25} 8 ${width * 0.5} 16 T ${width} 14 V ${height - bankY + 20} H0 Z`}
                fill={mud}
                opacity={night ? 0.8 : 0.55}
              />
              <Path
                d={`M0 26 Q ${width * 0.25} 14 ${width * 0.5} 22 T ${width} 20 V ${height - bankY + 20} H0 Z`}
                fill={bankFill}
              />
              <Path
                d={`M0 26 Q ${width * 0.25} 14 ${width * 0.5} 22 T ${width} 20`}
                stroke={bankEdge}
                strokeWidth={2.5}
                fill="none"
                opacity={night ? 0.6 : 0.7}
              />
            </Svg>
            {roomy && (
              <>
                <Reeds
                  count={3}
                  width={70}
                  height={80}
                  style={{ position: 'absolute', right: width * 0.08, top: bankY - 66 }}
                  animated={animated}
                  tone="light"
                />
                <Reeds
                  count={3}
                  width={60}
                  height={64}
                  flip
                  style={{ position: 'absolute', left: width * 0.12, top: bankY - 52 }}
                  animated={animated}
                />
              </>
            )}
          </>
        )}

        <JungleLeaves corner="top-left" size={leaves} style={styles.topLeft} />
        <JungleLeaves corner="top-right" size={Math.round(leaves * 0.9)} style={styles.topRight} />
        {/* The celebration rises from the croc's head, in front of everything. */}
        <CelebrationBurst
          active={celebrate}
          x={Math.round(width * crocX)}
          y={Math.round(crocTop + crocHeight * ratio.r * 0.45)}
          radius={Math.round(Math.min(Math.max(cw * 0.55, 110), 200) * celebrationScale)}
          animated={animated}
          testID={testID ? `${testID}-celebration` : undefined}
        />
        {/* The splash where the croc lands on the water. */}
        <WaterSplash
          active={splash}
          x={Math.round(width * crocX)}
          y={waterY + 6}
          width={Math.round(Math.min(cw * 0.9, 320))}
          animated={animated}
          testID={testID ? `${testID}-splash` : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  farBank: { position: 'absolute', left: -40, right: -40, height: 24, borderRadius: 999 },
  topLeft: { position: 'absolute', left: 0, top: 0 },
  topRight: { position: 'absolute', right: 0, top: 0 },
});
