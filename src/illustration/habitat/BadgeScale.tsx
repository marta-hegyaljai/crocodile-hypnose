import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { palette } from '@/theme';

/** One "scale" of the badge collection: amber and shining once earned, a quiet outline before. */
export function BadgeScale({
  earned,
  size,
  mark,
}: {
  earned: boolean;
  size: number;
  /** Which inner mark (0..3) so the scales differ at a glance. */
  mark: number;
}) {
  const id = `scale-${earned ? 'on' : 'off'}`;
  const inner = earned ? palette.amberInk : palette.mistTextMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={earned ? palette.amberLight : palette.mistLight} />
          <Stop offset="1" stopColor={earned ? palette.amber : palette.mistDeep} />
        </LinearGradient>
      </Defs>
      <Path
        d="M32 4 C48 4 58 14 58 28 C58 44 44 56 32 61 C20 56 6 44 6 28 C6 14 16 4 32 4 Z"
        fill={`url(#${id})`}
        stroke={earned ? palette.amberDeep : palette.mistDeep}
        strokeWidth={2.5}
      />
      <Path
        d="M16 22 C22 14 42 14 48 22"
        stroke={earned ? palette.white : palette.white}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={earned ? 0.7 : 0.5}
      />
      {mark % 4 === 0 && (
        <Path
          d="M32 22 L35 30 L43 31 L37 36 L39 44 L32 40 L25 44 L27 36 L21 31 L29 30 Z"
          fill={inner}
          opacity={0.85}
        />
      )}
      {mark % 4 === 1 && (
        <Path
          d="M18 36 Q 25 30 32 36 T 46 36"
          stroke={inner}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />
      )}
      {mark % 4 === 2 && <Circle cx={32} cy={35} r={7} fill={inner} opacity={0.85} />}
      {mark % 4 === 3 && (
        <Path d="M32 26 C38 30 40 36 32 44 C24 36 26 30 32 26 Z" fill={inner} opacity={0.85} />
      )}
    </Svg>
  );
}
