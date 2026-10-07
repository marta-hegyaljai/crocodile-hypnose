import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { palette } from '@/theme';

/** The habitat's decorations (ids as in the shared rules' catalogue). */
export type DecorationId =
  | 'lilyPads'
  | 'reeds'
  | 'stones'
  | 'driftwood'
  | 'dragonflies'
  | 'lotus'
  | 'fireflies'
  | 'mangrove'
  | 'heron'
  | 'waterfall'
  | 'glowLotus'
  | 'turtle';

export interface DecorationProps {
  id: string;
  size: number;
  /** Drawn greyed out (a locked item in the catalogue). */
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const C = {
  pad: '#4E8F3E',
  padDark: '#2F6A2C',
  padVein: '#8CC46B',
  lily: palette.waterLily,
  lilyLight: palette.lilyLight,
  amber: palette.amber,
  amberLight: palette.amberLight,
  reed: palette.leaf,
  reedDark: '#3B6B30',
  cattail: palette.riverbankMud,
  stone: '#8E9A8F',
  stoneLight: '#B9C3B6',
  stoneDark: '#66736A',
  wood: palette.riverbankMud,
  woodDark: palette.mudDark,
  wing: '#BFE7E0',
  teal: palette.riverTeal,
  leaf: palette.crocGreen,
  leafLight: '#7FB65E',
  trunk: '#6B4E2E',
  heron: '#E9EFEA',
  heronShade: '#AEBBB3',
  water: palette.shallows,
  waterLight: '#D9F1EC',
  rock: '#5F6B5E',
  shell: '#6E8B4A',
  shellLight: '#A6C46E',
  skin: '#7FA65A',
  glow: '#FFF3C4',
};

function Art({ id }: { id: string }) {
  switch (id as DecorationId) {
    case 'lilyPads':
      return (
        <G>
          <Ellipse cx={34} cy={66} rx={26} ry={13} fill={C.padDark} />
          <Path d="M34 66 L60 62 A26 13 0 1 1 52 57 Z" fill={C.pad} />
          <Path
            d="M34 66 L18 60 M34 66 L24 74 M34 66 L44 76"
            stroke={C.padVein}
            strokeWidth={1.5}
          />
          <Ellipse cx={72} cy={50} rx={18} ry={9} fill={C.padDark} />
          <Path d="M72 50 L90 47 A18 9 0 1 1 85 43 Z" fill={C.pad} />
          <Circle cx={70} cy={45} r={5} fill={C.lily} />
          <Circle cx={70} cy={45} r={2} fill={C.amberLight} />
        </G>
      );
    case 'reeds':
      return (
        <G>
          {[22, 36, 50, 64, 78].map((x, i) => (
            <G key={x}>
              <Path
                d={`M${x} 96 Q ${x + (i % 2 ? 6 : -6)} 60 ${x + (i % 2 ? 2 : -2)} ${24 + (i % 3) * 8}`}
                stroke={i % 2 ? C.reedDark : C.reed}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
              />
              {i % 2 === 0 && (
                <Rect
                  x={x - 4 + (i % 2 ? 2 : -2)}
                  y={30 + (i % 3) * 8}
                  width={8}
                  height={18}
                  rx={4}
                  fill={C.cattail}
                />
              )}
            </G>
          ))}
        </G>
      );
    case 'stones':
      return (
        <G>
          <Ellipse cx={50} cy={86} rx={42} ry={8} fill={C.stoneDark} opacity={0.35} />
          <Path d="M14 84 Q 16 58 38 56 Q 58 56 60 84 Z" fill={C.stone} />
          <Path
            d="M22 66 Q 32 58 44 60"
            stroke={C.stoneLight}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M52 86 Q 54 66 70 64 Q 88 66 88 86 Z" fill={C.stoneDark} />
          <Path
            d="M60 72 Q 68 66 78 68"
            stroke={C.stone}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M40 88 Q 42 76 52 76 Q 62 78 62 88 Z" fill={C.stoneLight} />
        </G>
      );
    case 'driftwood':
      return (
        <G>
          <Ellipse cx={50} cy={70} rx={44} ry={7} fill={C.water} opacity={0.6} />
          <Path d="M8 64 Q 50 52 92 62 Q 94 70 88 72 Q 50 66 12 74 Q 4 70 8 64 Z" fill={C.wood} />
          <Path d="M20 64 Q 50 58 82 63" stroke={C.woodDark} strokeWidth={2} fill="none" />
          <Path d="M62 58 L72 40 L76 42 L68 59 Z" fill={C.wood} />
          <Circle cx={74} cy={39} r={5} fill={C.leafLight} />
        </G>
      );
    case 'dragonflies':
      return (
        <G>
          {[
            { x: 34, y: 40, r: -15 },
            { x: 70, y: 60, r: 20 },
          ].map((d) => (
            <G key={d.x} rotation={d.r} origin={`${d.x}, ${d.y}`}>
              <Ellipse cx={d.x - 9} cy={d.y - 4} rx={10} ry={4} fill={C.wing} opacity={0.85} />
              <Ellipse cx={d.x + 9} cy={d.y - 4} rx={10} ry={4} fill={C.wing} opacity={0.85} />
              <Ellipse cx={d.x - 8} cy={d.y + 3} rx={8} ry={3} fill={C.wing} opacity={0.7} />
              <Ellipse cx={d.x + 8} cy={d.y + 3} rx={8} ry={3} fill={C.wing} opacity={0.7} />
              <Rect x={d.x - 2} y={d.y - 8} width={4} height={24} rx={2} fill={C.teal} />
              <Circle cx={d.x} cy={d.y - 9} r={3.5} fill={C.teal} />
            </G>
          ))}
        </G>
      );
    case 'lotus':
    case 'glowLotus': {
      const glow = id === 'glowLotus';
      return (
        <G>
          {glow && <Circle cx={50} cy={52} r={40} fill={C.glow} opacity={0.55} />}
          <Ellipse cx={50} cy={78} rx={34} ry={10} fill={C.padDark} />
          <Ellipse cx={50} cy={76} rx={30} ry={8} fill={C.pad} />
          <Path d="M50 30 Q 62 50 50 72 Q 38 50 50 30 Z" fill={glow ? C.amberLight : C.lily} />
          <Path
            d="M50 72 Q 26 66 24 44 Q 42 48 50 72 Z"
            fill={glow ? C.amber : C.lily}
            opacity={0.9}
          />
          <Path
            d="M50 72 Q 74 66 76 44 Q 58 48 50 72 Z"
            fill={glow ? C.amber : C.lily}
            opacity={0.9}
          />
          <Path d="M50 72 Q 34 56 38 38 Q 50 52 50 72 Z" fill={glow ? C.glow : C.lilyLight} />
          <Path d="M50 72 Q 66 56 62 38 Q 50 52 50 72 Z" fill={glow ? C.glow : C.lilyLight} />
        </G>
      );
    }
    case 'fireflies':
      return (
        <G>
          {[
            [24, 30],
            [52, 20],
            [78, 36],
            [36, 60],
            [66, 66],
          ].map(([x, y]) => (
            <G key={`${x}-${y}`}>
              <Circle cx={x} cy={y} r={11} fill={C.amberLight} opacity={0.35} />
              <Circle cx={x} cy={y} r={4} fill={C.amber} />
            </G>
          ))}
        </G>
      );
    case 'mangrove':
      return (
        <G>
          <Path d="M50 92 L46 52 L54 52 Z" fill={C.trunk} />
          <Path
            d="M48 70 Q 30 76 22 94 M52 70 Q 70 76 78 94 M48 80 Q 38 84 36 96 M52 80 Q 62 84 64 96"
            stroke={C.trunk}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={34} cy={40} r={20} fill={C.leaf} />
          <Circle cx={66} cy={40} r={20} fill={C.leaf} />
          <Circle cx={50} cy={26} r={22} fill={C.leafLight} />
          <Circle cx={42} cy={22} r={6} fill="#A9D48A" opacity={0.8} />
        </G>
      );
    case 'heron':
      return (
        <G>
          <Path d="M44 94 L46 66 M54 94 L52 66" stroke={C.heronShade} strokeWidth={2.5} />
          <Ellipse cx={50} cy={60} rx={18} ry={11} fill={C.heron} />
          <Path d="M66 58 Q 80 64 84 72 Q 74 66 64 64 Z" fill={C.heronShade} />
          <Path
            d="M38 56 Q 30 40 38 26"
            stroke={C.heron}
            strokeWidth={7}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={39} cy={23} r={6} fill={C.heron} />
          <Path d="M34 22 L18 26 L34 25 Z" fill={C.amber} />
          <Circle cx={40} cy={22} r={1.4} fill={palette.jungleInk} />
          <Path d="M42 18 Q 50 16 54 20" stroke={palette.jungleInk} strokeWidth={1.5} fill="none" />
        </G>
      );
    case 'waterfall':
      return (
        <G>
          <Path d="M8 20 Q 20 8 36 14 L64 14 Q 80 8 92 20 L92 96 L8 96 Z" fill={C.rock} />
          <Rect x={34} y={14} width={32} height={74} fill={C.water} />
          <Path
            d="M40 16 V84 M50 16 V86 M60 16 V84"
            stroke={C.waterLight}
            strokeWidth={3}
            opacity={0.9}
          />
          <Ellipse cx={50} cy={88} rx={30} ry={8} fill={C.waterLight} />
          <Circle cx={24} cy={30} r={8} fill={C.leaf} />
          <Circle cx={78} cy={34} r={9} fill={C.leafLight} />
        </G>
      );
    case 'turtle':
      return (
        <G>
          <Ellipse cx={50} cy={76} rx={38} ry={8} fill={C.water} opacity={0.6} />
          <Ellipse cx={78} cy={64} rx={9} ry={7} fill={C.skin} />
          <Circle cx={81} cy={62} r={1.6} fill={palette.jungleInk} />
          <Ellipse cx={30} cy={74} rx={8} ry={4} fill={C.skin} />
          <Ellipse cx={66} cy={76} rx={8} ry={4} fill={C.skin} />
          <Path d="M20 72 Q 24 44 50 42 Q 74 44 76 72 Z" fill={C.shell} />
          <Path
            d="M36 50 L50 58 L64 50 M50 58 V70 M30 64 L40 60 M70 64 L60 60"
            stroke={C.shellLight}
            strokeWidth={2.5}
            fill="none"
          />
        </G>
      );
    default:
      return <Circle cx={50} cy={50} r={20} fill={C.stone} />;
  }
}

/** A habitat decoration, drawn in a 100x100 box. Decorative: the caller labels it. */
export function Decoration({ id, size, muted = false, style, testID }: DecorationProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      opacity={muted ? 0.38 : 1}
      testID={testID}
      aria-hidden
    >
      <Art id={id} />
    </Svg>
  );
}
