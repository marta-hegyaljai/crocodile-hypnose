/** Spacing scale (4pt grid). */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Pebble-round corner radii. */
export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

/** Minimum tap target (WCAG / platform guidance). */
export const tapTarget = 44;

export const fontFamily = {
  display: 'Baloo2_700Bold',
  displayHeavy: 'Baloo2_800ExtraBold',
  displayMedium: 'Baloo2_600SemiBold',
  body: 'NunitoSans_400Regular',
  bodySemi: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
} as const;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'caption'
  | 'label'
  | 'number';

export const typeScale: Record<
  TextVariant,
  { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }
> = {
  display: { fontFamily: fontFamily.displayHeavy, fontSize: 36, lineHeight: 42 },
  title: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28 },
  subheading: { fontFamily: fontFamily.displayMedium, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: fontFamily.bodySemi, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamily.display, fontSize: 14, lineHeight: 18, letterSpacing: 0.2 },
  number: { fontFamily: fontFamily.displayHeavy, fontSize: 32, lineHeight: 36 },
};

/** Largest font scale we honour before layout breaks; text still scales up to this. */
export const maxFontSizeMultiplier = 1.6;

/** Motion durations (ms) and springs. Daylight is springy; Night follows breathing pace. */
export const motion = {
  daylight: {
    fast: 120,
    base: 220,
    slow: 420,
    idle: 3200,
    ripple: 3600,
    spring: { damping: 14, stiffness: 240, mass: 0.8 },
    pressSpring: { damping: 18, stiffness: 420, mass: 0.6 },
  },
  night: {
    fast: 240,
    base: 600,
    slow: 2000,
    idle: 6000,
    ripple: 5500,
    spring: { damping: 26, stiffness: 90, mass: 1.2 },
    pressSpring: { damping: 24, stiffness: 180, mass: 1 },
  },
} as const;

export type MotionTokens = (typeof motion)[keyof typeof motion];
