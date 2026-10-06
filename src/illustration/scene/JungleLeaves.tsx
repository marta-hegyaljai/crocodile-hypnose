import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { palette, useTheme } from '@/theme';

import { decorative } from './decorative';

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface JungleLeavesProps {
  /** Which corner of the screen the foliage grows from. */
  corner?: Corner;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Big mangrove / jungle leaves framing a corner. Draw it absolutely positioned in the corner it names. */
export function JungleLeaves({
  corner = 'top-left',
  size = 180,
  style,
  testID,
}: JungleLeavesProps) {
  const { atmosphere } = useTheme();
  const night = atmosphere === 'night';
  const deep = night ? '#0B2A20' : palette.crocGreenDark;
  const mid = night ? '#113A2C' : palette.jungleMid;
  const light = night ? '#17493A' : palette.crocGreen;
  const rib = night ? '#0A1F18' : '#1C3A24';

  const flipX = corner.endsWith('right');
  const flipY = corner.startsWith('bottom');
  const transform = `translate(${flipX ? 200 : 0} ${flipY ? 200 : 0}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1})`;

  // Leaves drawn growing from the top-left corner of a 200x200 box.
  const leaf = (d: string, fill: string, ribD?: string) => (
    <>
      <Path d={d} fill={fill} />
      {ribD && (
        <Path
          d={ribD}
          stroke={rib}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          opacity={0.35}
        />
      )}
    </>
  );

  return (
    <View
      style={[{ width: size, height: size }, style]}
      testID={testID}
      pointerEvents="none"
      {...decorative}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <G transform={transform}>
          {leaf(
            'M -10 -10 C 60 -5, 120 20, 150 90 C 100 95, 40 70, -10 30 Z',
            deep,
            'M -5 -5 C 50 15, 100 45, 140 85',
          )}
          {leaf(
            'M -10 40 C 30 60, 70 90, 85 150 C 40 140, 5 110, -10 80 Z',
            mid,
            'M -5 45 C 30 75, 60 110, 80 145',
          )}
          {leaf(
            'M 20 -10 C 70 0, 120 10, 170 -10 C 150 30, 110 50, 60 40 C 40 30, 25 10, 20 -10 Z',
            light,
            'M 25 -8 C 70 20, 110 30, 165 -8',
          )}
          {/* Monstera-like split leaf */}
          {leaf(
            'M -10 110 C 20 100, 50 110, 70 140 C 60 150, 50 150, 44 158 C 52 168, 56 180, 50 195 C 20 190, 0 170, -10 150 Z',
            light,
            'M -5 115 C 20 130, 40 160, 48 190',
          )}
        </G>
      </Svg>
    </View>
  );
}
