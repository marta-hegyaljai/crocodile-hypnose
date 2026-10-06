import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { decorative } from './decorative';

export interface RiverPathProps {
  /** Points the river flows through, in the component's own coordinate space. */
  points: { x: number; y: number }[];
  width: number;
  height: number;
  /** Stroke width of the river. */
  thickness?: number;
  /** Draw the dotted "trail" down the middle. */
  trail?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Smooth cubic path through points (Catmull-Rom to Bezier). */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const first = points[0]!;
  if (points.length === 1) return `M ${first.x} ${first.y}`;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** A winding river segment for the map: a wide soft stroke with a dotted trail along it. */
export function RiverPath({
  points,
  width,
  height,
  thickness = 34,
  trail = true,
  style,
  testID,
}: RiverPathProps) {
  const { colors, atmosphere } = useTheme();
  const d = smoothPath(points);
  const night = atmosphere === 'night';
  return (
    <View style={[{ width, height }, style]} testID={testID} pointerEvents="none" {...decorative}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={d}
          stroke={night ? colors.water : colors.waterLight}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={night ? 0.8 : 0.85}
        />
        <Path
          d={d}
          stroke={night ? colors.waterLight : colors.water}
          strokeWidth={thickness * 0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={night ? 0.5 : 0.35}
        />
        {trail && (
          <Path
            d={d}
            stroke={night ? colors.textPrimary : colors.surface}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="1 9"
            fill="none"
            opacity={0.8}
          />
        )}
      </Svg>
    </View>
  );
}
