import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { palette, useTheme } from '@/theme';

import { decorative } from './decorative';

export interface SkyGlowProps {
  size: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The light in the sky: a warm sun haze by day, a crescent moon with a soft halo at night.
 * Place it behind the horizon so the croc and the far jungle sit in front of it.
 */
export function SkyGlow({ size, style, testID }: SkyGlowProps) {
  const { atmosphere } = useTheme();
  const night = atmosphere === 'night';
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]} testID={testID} {...decorative}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.amberGlow} stopOpacity={night ? 0.35 : 0.75} />
            <Stop
              offset={night ? 0.35 : 0.4}
              stopColor={night ? palette.amber : palette.amberGlow}
              stopOpacity={night ? 0.1 : 0.3}
            />
            <Stop
              offset="1"
              stopColor={night ? palette.amber : palette.amberGlow}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill={`url(#glow-${id})`} />
        {night ? (
          // Crescent moon: a disc with a second disc of sky cut away.
          <Path
            d={`M ${c - size * 0.07} ${c - size * 0.12} A ${size * 0.13} ${size * 0.13} 0 1 0 ${c + size * 0.06} ${c + size * 0.1} A ${size * 0.11} ${size * 0.11} 0 1 1 ${c - size * 0.07} ${c - size * 0.12} Z`}
            fill={palette.amberGlow}
            opacity={0.9}
          />
        ) : (
          <Circle cx={c} cy={c} r={size * 0.13} fill={palette.amberGlow} opacity={0.85} />
        )}
      </Svg>
    </View>
  );
}
