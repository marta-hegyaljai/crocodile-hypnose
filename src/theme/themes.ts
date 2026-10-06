import type { ViewStyle } from 'react-native';

import { palette } from './palette';
import { motion, type MotionTokens } from './tokens';

export type Atmosphere = 'daylight' | 'night';

export interface ThemeColors {
  /** Screen background. */
  background: string;
  /** Second colour for background washes (bottom of the screen / water). */
  backgroundDeep: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  /** Outline of form fields (3:1 against surfaces). */
  inputBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnAccent: string;
  textOnPrimary: string;
  /** Amber-toned text that still meets AA on the atmosphere's surfaces. */
  textAccent: string;
  /** Water-toned text that still meets AA on the atmosphere's surfaces. */
  textWater: string;
  /** Amber: the single "hot" colour. */
  accent: string;
  accentDeep: string;
  accentSoft: string;
  /** Croc green. */
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  water: string;
  waterDeep: string;
  waterLight: string;
  celebrate: string;
  /** Errors and destructive actions: deep water-lily rose. */
  danger: string;
  dangerDeep: string;
  dangerSoft: string;
  /** Error text that meets AA on the atmosphere's surfaces and on `dangerSoft`. */
  textDanger: string;
  focusRing: string;
  overlay: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
  progressTrack: string;
  progressFill: string;
}

export interface Theme {
  atmosphere: Atmosphere;
  colors: ThemeColors;
  motion: MotionTokens;
  /** Height of the 3D edge under pressable buttons. */
  buttonDepth: number;
  shadow: { card: ViewStyle; raised: ViewStyle };
  /** Night River mutes sound and haptics. */
  feedbackEnabled: boolean;
}

const daylightShadow: Theme['shadow'] = {
  card: {
    shadowColor: palette.deepJungle,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  raised: {
    shadowColor: palette.deepJungle,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

const nightShadow: Theme['shadow'] = {
  card: {
    shadowColor: palette.nightRiver,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: palette.nightRiver,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

export const daylightTheme: Theme = {
  atmosphere: 'daylight',
  colors: {
    background: palette.riverMist,
    backgroundDeep: palette.shallows,
    surface: palette.white,
    surfaceRaised: palette.mistLight,
    surfaceSunken: palette.mistDeep,
    border: palette.mistDeep,
    inputBorder: palette.mistOutline,
    textPrimary: palette.deepJungle,
    textSecondary: palette.mistText,
    textMuted: palette.mistTextMuted,
    textInverse: palette.riverMist,
    textOnAccent: palette.amberInk,
    textOnPrimary: palette.mistLight,
    textAccent: palette.amberText,
    textWater: palette.riverTeal,
    accent: palette.amber,
    accentDeep: palette.amberDeep,
    accentSoft: palette.amberGlow,
    primary: palette.crocGreen,
    primaryDeep: palette.crocGreenDark,
    primarySoft: palette.leafLight,
    water: palette.riverTeal,
    waterDeep: palette.tealDeep,
    waterLight: palette.shallows,
    celebrate: palette.waterLily,
    danger: palette.lilyDeep,
    dangerDeep: palette.lilyInk,
    dangerSoft: palette.lilyMist,
    textDanger: palette.lilyDeep,
    focusRing: palette.riverTeal,
    overlay: 'rgba(14, 46, 36, 0.5)',
    tabBar: palette.white,
    tabBarActive: palette.deepJungle,
    tabBarInactive: palette.mistTextMuted,
    progressTrack: palette.mistDeep,
    progressFill: palette.crocGreen,
  },
  motion: motion.daylight,
  buttonDepth: 5,
  shadow: daylightShadow,
  feedbackEnabled: true,
};

export const nightTheme: Theme = {
  atmosphere: 'night',
  colors: {
    background: palette.nightRiver,
    backgroundDeep: palette.tealNight,
    surface: palette.tealNight,
    surfaceRaised: palette.tealNightRaised,
    surfaceSunken: palette.nightRiver,
    border: palette.tealNightRaised,
    inputBorder: palette.nightOutline,
    textPrimary: palette.riverMist,
    textSecondary: palette.nightText,
    textMuted: palette.nightTextMuted,
    textInverse: palette.riverMist,
    textOnAccent: palette.amberInk,
    textOnPrimary: palette.mistLight,
    textAccent: palette.amber,
    textWater: palette.shallows,
    accent: palette.amber,
    accentDeep: palette.amberDeep,
    accentSoft: 'rgba(242, 169, 59, 0.18)',
    primary: palette.crocGreenDark,
    primaryDeep: palette.deepJungle,
    primarySoft: palette.jungleMid,
    water: palette.tealDeep,
    waterDeep: palette.nightRiver,
    waterLight: palette.riverTeal,
    celebrate: palette.waterLily,
    danger: palette.lilyDeep,
    dangerDeep: palette.lilyInk,
    dangerSoft: palette.tealNightRaised,
    textDanger: palette.lilyLight,
    focusRing: palette.amber,
    overlay: 'rgba(8, 23, 26, 0.7)',
    tabBar: palette.tealNight,
    tabBarActive: palette.amber,
    tabBarInactive: palette.nightTextMuted,
    progressTrack: palette.tealNightRaised,
    progressFill: palette.riverTeal,
  },
  motion: motion.night,
  buttonDepth: 3,
  shadow: nightShadow,
  feedbackEnabled: false,
};

export const themes: Record<Atmosphere, Theme> = {
  daylight: daylightTheme,
  night: nightTheme,
};
