import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

import { palette, useTheme } from '@/theme';

import { decorative } from './decorative';

export interface LilyPadProps {
  size?: number;
  /** Show a lotus flower on the pad. */
  flower?: boolean;
  /** Rotation of the pad's notch, degrees. */
  rotation?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A lily pad seen from slightly above, with an optional lotus (Water Lily pink, amber heart). */
export function LilyPad({ size = 72, flower = false, rotation = 0, style, testID }: LilyPadProps) {
  const { atmosphere } = useTheme();
  const night = atmosphere === 'night';
  const pad = night ? '#3F7A3A' : palette.leaf;
  const padDark = night ? palette.jungleMid : '#4F8A3E';
  const vein = night ? palette.jungleMid : '#4F8A3E';
  const petal = night ? '#D97E95' : palette.waterLily;
  const petalLight = night ? '#E9A3B5' : palette.lilyLight;

  // Square canvas so a rotated pad is never clipped by its own bounds.
  const cx = 50;
  const cy = 52;
  const rx = 46;
  const ry = 24;
  const fy = cy - 10; // flower centre

  // Pad: an ellipse with a wedge notch cut towards the centre.
  const padPath = `M ${cx} ${cy} L ${cx + rx * 0.95} ${cy - ry * 0.35} A ${rx} ${ry} 0 1 0 ${cx + rx * 0.98} ${cy + ry * 0.22} Z`;

  const petals = Array.from({ length: 6 }, (_, i) => (
    <G key={i} transform={`rotate(${i * 60 - 90} ${cx} ${fy})`}>
      <Ellipse cx={cx} cy={fy - 9} rx={4.2} ry={9.5} fill={i % 2 === 0 ? petal : petalLight} />
    </G>
  ));

  return (
    <View
      style={[{ width: size, height: size }, style]}
      testID={testID}
      pointerEvents="none"
      {...decorative}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <G transform={`rotate(${rotation} ${cx} ${cy})`}>
          <Path d={padPath} fill={pad} />
          <Ellipse cx={cx - 10} cy={cy - 6} rx={18} ry={9} fill={padDark} opacity={0.22} />
          <Path
            d={`M ${cx} ${cy} l -22 -12`}
            stroke={vein}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.6}
          />
          <Path
            d={`M ${cx} ${cy} l -28 4`}
            stroke={vein}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.6}
          />
          <Path
            d={`M ${cx} ${cy} l -14 16`}
            stroke={vein}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.6}
          />
        </G>
        {flower && (
          <G>
            {petals}
            <Ellipse cx={cx} cy={fy} rx={5} ry={4} fill={palette.amber} />
            <Ellipse cx={cx - 1.5} cy={fy - 1.5} rx={1.6} ry={1.2} fill={palette.amberGlow} />
          </G>
        )}
      </Svg>
    </View>
  );
}
