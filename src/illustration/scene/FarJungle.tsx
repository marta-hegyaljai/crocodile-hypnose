import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { palette, useTheme } from '@/theme';

import { decorative } from './decorative';

export interface FarJungleProps {
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Deterministic pseudo-random in 0..1 from an index (stable between renders). */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 91.7 + salt * 47.3) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The far side of the river: two layers of soft jungle canopy fading into mist, with a few tall
 * palm fronds breaking the skyline. Sits on the horizon; the bottom edge meets the water.
 */
export function FarJungle({ width, height, style, testID }: FarJungleProps) {
  const { atmosphere, colors } = useTheme();
  const night = atmosphere === 'night';
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  // Far layer is paler (atmospheric perspective); near layer a touch deeper.
  const far = night ? '#0F3A32' : '#BFD9BC';
  const near = night ? '#0C2F2A' : '#A6CBA4';
  const frond = night ? '#0A2622' : '#8FBC8B';
  const mist = night ? colors.background : palette.riverMist;

  const mounds = (layer: 0 | 1, color: string, baseY: number, scale: number) => {
    const step = 54 * scale;
    const count = Math.ceil(width / step) + 2;
    return Array.from({ length: count }, (_, i) => {
      const cx = -20 + i * step + hash(i, layer) * step * 0.4;
      const rx = step * (0.6 + hash(i, layer + 2) * 0.35);
      const ry = height * (layer === 0 ? 0.42 : 0.3) * (0.7 + hash(i, layer + 4) * 0.5);
      return <Ellipse key={`${layer}-${i}`} cx={cx} cy={baseY} rx={rx} ry={ry} fill={color} />;
    });
  };

  // A few palms rising from the far canopy: a thin trunk and a crown of filled, drooping fronds.
  const fronds = [0.12, 0.3, 0.58, 0.82].map((f, i) => {
    const x = width * f + hash(i, 9) * 30;
    const base = height * 0.7;
    const h = height * (0.5 + hash(i, 10) * 0.3);
    const lean = (hash(i, 11) - 0.5) * 24;
    const trunk = `M ${x} ${base} Q ${x + lean * 0.4} ${base - h * 0.55} ${x + lean} ${base - h}`;
    const tipX = x + lean;
    const tipY = base - h;
    const leaves = [-2.6, -1.9, -1.2, -0.5, 0.2].map((a, j) => {
      const len = 18 + hash(i + j, 12) * 10;
      const ex = tipX + Math.cos(a) * len;
      const ey = tipY + Math.sin(a) * len * 0.55 + len * 0.35;
      const mx = (tipX + ex) / 2;
      const my = (tipY + ey) / 2 - 5;
      const w = 4;
      return (
        <Path
          key={j}
          d={`M ${tipX} ${tipY} Q ${mx} ${my - w} ${ex} ${ey} Q ${mx} ${my + w} ${tipX} ${tipY} Z`}
          fill={frond}
        />
      );
    });
    return (
      <React.Fragment key={i}>
        <Path d={trunk} stroke={frond} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        {leaves}
      </React.Fragment>
    );
  });

  return (
    <View style={[{ width, height }, styles.clip, style]} testID={testID} {...decorative}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={`mist-${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={mist} stopOpacity={0} />
            <Stop offset="1" stopColor={mist} stopOpacity={night ? 0.55 : 0.75} />
          </LinearGradient>
        </Defs>
        {fronds}
        {mounds(0, far, height * 0.78, 1.15)}
        {mounds(1, near, height * 0.98, 0.85)}
        <Rect
          x={0}
          y={height * 0.45}
          width={width}
          height={height * 0.55}
          fill={`url(#mist-${id})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
