import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { StopType } from '@/content/types';

/** A small pictogram for a stop's type (24pt grid, stroked like the app's icons). */
export function StopGlyph({
  type,
  size = 24,
  color,
}: {
  type: StopType;
  size?: number;
  color: string;
}) {
  const stroke = {
    stroke: color,
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {type === 'video' && (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={3.5} {...stroke} />
          <Path
            d="M10.5 9.2 L15 12 L10.5 14.8 Z"
            fill={color}
            stroke={color}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </>
      )}
      {type === 'audio' && (
        <>
          <Path d="M4.5 15 V12 a7.5 7.5 0 0 1 15 0 V15" {...stroke} />
          <Rect x={3.5} y={13.5} width={4} height={6} rx={1.6} fill={color} />
          <Rect x={16.5} y={13.5} width={4} height={6} rx={1.6} fill={color} />
        </>
      )}
      {type === 'visual' && (
        <>
          <Path d="M2.5 12 C5.5 6.5 18.5 6.5 21.5 12 C18.5 17.5 5.5 17.5 2.5 12 Z" {...stroke} />
          <Circle cx={12} cy={12} r={3} fill={color} />
        </>
      )}
      {type === 'game' && (
        <>
          <Path
            d="M7 8 H17 a4.5 4.5 0 0 1 4.3 5.8 l-0.9 3 a2.3 2.3 0 0 1 -3.9 0.9 L15 16 H9 l-1.5 1.7 a2.3 2.3 0 0 1 -3.9 -0.9 l-0.9 -3 A4.5 4.5 0 0 1 7 8 Z"
            {...stroke}
          />
          <Path d="M8 11 V14 M6.5 12.5 H9.5" {...stroke} />
          <Circle cx={15.5} cy={12} r={1.2} fill={color} />
        </>
      )}
      {type === 'longTrance' && (
        <>
          <Path d="M15.5 3.5 A8.5 8.5 0 1 0 20.5 15 A7 7 0 0 1 15.5 3.5 Z" fill={color} />
          <Path
            d="M18.5 4.5 l0.6 1.4 1.4 0.6 -1.4 0.6 -0.6 1.4 -0.6 -1.4 -1.4 -0.6 1.4 -0.6 Z"
            fill={color}
          />
        </>
      )}
    </Svg>
  );
}
