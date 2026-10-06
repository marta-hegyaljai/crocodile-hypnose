import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { Goal } from '@/services/profile/types';
import { palette, useTheme } from '@/theme';

export interface GoalIconProps {
  goal: Goal;
  size?: number;
  selected?: boolean;
}

/**
 * Illustrated icons for the five goals, in the river vocabulary: a moon on still water (sleep),
 * a leaf settling on ripples (stress), the croc's head held high in the sun (confidence), one
 * firefly in the dark (focus) and stepping stones in a row (habits). Decorative: the card label
 * carries the meaning.
 */
export function GoalIcon({ goal, size = 48, selected = false }: GoalIconProps) {
  const { colors } = useTheme();
  const disc = selected ? colors.surface : colors.primarySoft;
  const ink = colors.primaryDeep;
  const water = colors.water;
  const light = colors.waterLight;
  const amber = palette.amber;
  const stroke = { stroke: ink, strokeWidth: 2, strokeLinecap: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <Circle cx={24} cy={24} r={23} fill={disc} />
      {goal === 'sleep' && (
        <G>
          <Path
            d="M27 11 A 9 9 0 1 0 35 23 A 7 7 0 1 1 27 11 Z"
            fill={palette.amberGlow}
            stroke={palette.amberDeep}
            strokeWidth={1.5}
          />
          <Path d="M9 32 q 5 -3 10 0 t 10 0 t 10 0" {...stroke} stroke={water} />
          <Path d="M13 37.5 q 4 -2.5 8 0 t 8 0 t 8 0" {...stroke} stroke={light} />
        </G>
      )}
      {goal === 'stress' && (
        <G>
          <Ellipse cx={24} cy={30} rx={13} ry={4} fill="none" stroke={light} strokeWidth={2} />
          <Ellipse cx={24} cy={30} rx={7} ry={2.2} fill="none" stroke={water} strokeWidth={2} />
          <Path
            d="M16 24 C 16 15, 23 10, 32 10 C 32 19, 26 25, 16 24 Z"
            fill={palette.leaf}
            stroke={ink}
            strokeWidth={1.5}
          />
          <Path
            d="M17.5 23 C 21 18.5, 25 15, 30 12"
            stroke={colors.surface}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )}
      {goal === 'confidence' && (
        <G>
          <Circle
            cx={30}
            cy={16}
            r={7}
            fill={palette.amberGlow}
            stroke={palette.amberDeep}
            strokeWidth={1.5}
          />
          <Path
            d="M8 31 C 8 25, 11 20, 18 19.5 C 22.5 19.2, 25 23, 28.5 24 L 39 25.6 C 41 26, 42 27.5, 42 29.5 Z"
            fill={palette.crocGreen}
          />
          <Path
            d="M8.5 31 H 41.5 C 41.5 34, 39.5 35.5, 37 35.5 H 12 C 10 35.5, 8.5 33.5, 8.5 31 Z"
            fill={palette.crocGreenDark}
          />
          <Circle cx={18.5} cy={24} r={2.4} fill={amber} />
          <Path d="M18.5 22.4 V25.6" stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
          <Path d="M6 40 q 6 -3 12 0 t 12 0 t 12 0" {...stroke} stroke={light} />
        </G>
      )}
      {goal === 'focus' && (
        <G>
          <Circle cx={24} cy={22} r={13} fill={palette.amberGlow} opacity={0.35} />
          <Circle cx={24} cy={22} r={7} fill={palette.amberGlow} opacity={0.6} />
          <Circle cx={24} cy={22} r={3} fill={amber} />
          <Path d="M24 34 V 38" {...stroke} />
          <Path d="M17 29.5 L 14 32.5" {...stroke} />
          <Path d="M31 29.5 L 34 32.5" {...stroke} />
        </G>
      )}
      {goal === 'habits' && (
        <G>
          <Path d="M6 30 q 6 -4 12 0 t 12 0 t 12 0" {...stroke} stroke={light} strokeWidth={3} />
          <Ellipse
            cx={12}
            cy={30}
            rx={5}
            ry={3}
            fill={palette.mistDeep}
            stroke={ink}
            strokeWidth={1.2}
          />
          <Ellipse
            cx={24}
            cy={27}
            rx={5}
            ry={3}
            fill={palette.crocGreen}
            stroke={ink}
            strokeWidth={1.2}
          />
          <Ellipse
            cx={36}
            cy={24}
            rx={5}
            ry={3}
            fill={palette.crocGreen}
            stroke={ink}
            strokeWidth={1.2}
          />
          <Path
            d="M22 27 l 1.6 1.6 l 3 -3.2"
            stroke={colors.surface}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M34 24 l 1.6 1.6 l 3 -3.2"
            stroke={colors.surface}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )}
    </Svg>
  );
}
