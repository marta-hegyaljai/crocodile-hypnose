import { palette } from '../../theme/palette';
import type { Atmosphere } from '../../theme/themes';

import type { CrocColors } from './types';

/** Mixes two hex colours: 0 = a, 1 = b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(ch(16))}${hex(ch(8))}${hex(ch(0))}`;
}

/** The croc's own palette. Night River tones it down slightly so it sits quietly in the dark. */
export function crocColors(atmosphere: Atmosphere = 'daylight'): CrocColors {
  const night = atmosphere === 'night';
  const skin = night ? '#38603A' : palette.crocGreen;
  const skinLight = night ? '#44733F' : palette.crocSkin;
  const skinDark = night ? '#20391F' : palette.crocScute;
  const shell = '#F3EBD3';
  return {
    skin,
    skinLight,
    skinDark,
    skinTop: mixHex(skin, skinLight, 0.6),
    skinShade: mixHex(skin, skinDark, 0.45),
    belly: night ? '#B7C79A' : palette.crocBelly,
    scute: night ? '#1C3320' : palette.crocScute,
    pupil: palette.jungleInk,
    highlight: palette.white,
    mouth: '#8E3B4A',
    tongue: '#E07A8A',
    teeth: '#FFF8E7',
    blush: '#F59CA4',
    shell,
    shellShade: mixHex(shell, '#C9BE9C', 0.5),
    shellSpeckle: '#9EB08A',
    moss: palette.leaf,
    lily: palette.waterLily,
    lilyCenter: palette.amber,
    sparkle: night ? palette.amber : palette.amberLight,
    bubble: night ? palette.riverTeal : palette.shallows,
    shadow: palette.deepJungle,
    nest: night ? '#4E7A3C' : palette.leaf,
    mud: night ? '#4A3620' : palette.riverbankMud,
  };
}

export const EYE_STOPS: [string, string, string] = [
  palette.amberLight,
  palette.amber,
  palette.amberDeep,
];
