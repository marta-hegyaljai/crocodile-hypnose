import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

export interface ScaleTextureProps {
  color: string;
  opacity?: number;
  /** Size of one scale in points. */
  scale?: number;
}

/**
 * Subtle croc-scale pattern (overlapping arcs) to lay over cards and progress bars.
 * Renders absolutely to fill its parent; pass `pointerEvents="none"` parents as needed.
 */
export function ScaleTexture({ color, opacity = 0.08, scale = 14 }: ScaleTextureProps) {
  const id = `scales-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const w = scale;
  const h = scale * 0.85;
  const r = scale * 0.5;
  // Two rows of arcs offset by half a scale: the classic fish/croc scale lattice.
  const d = [
    `M0 ${h} A ${r} ${r} 0 0 1 ${w} ${h}`,
    `M${-w / 2} ${h / 2} A ${r} ${r} 0 0 1 ${w / 2} ${h / 2}`,
    `M${w / 2} ${h / 2} A ${r} ${r} 0 0 1 ${w * 1.5} ${h / 2}`,
  ].join(' ');

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      pointerEvents="none"
      aria-hidden
    >
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={w} height={h}>
          <Path d={d} fill="none" stroke={color} strokeWidth={1} strokeOpacity={opacity} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
