/**
 * Brand palette from the product concept (docs/product-concept.html, "Look & feel").
 * Supporting shades are derived from these and are used for depth, highlights and illustration.
 * Semantic colours (text, surfaces, buttons) live in themes.ts; prefer those in UI code.
 */
export const palette = {
  // Concept palette
  deepJungle: '#0E2E24',
  crocGreen: '#3F6B35',
  crocGreenDark: '#24452A',
  riverTeal: '#1D6E6A',
  shallows: '#7CC4B5',
  amber: '#F2A93B',
  waterLily: '#EE8FA6',
  riverbankMud: '#8A6A43',
  riverMist: '#E7F0E6',
  nightRiver: '#08171A',

  // Supporting shades
  white: '#FFFFFF',
  mistLight: '#F6FAF4',
  mistDeep: '#CFE0D2',
  jungleInk: '#0E1A12',
  jungleMid: '#2E5A33',
  leaf: '#5E9A4A',
  leafLight: '#B6D98B',
  crocSkin: '#4F8040',
  crocScute: '#2E5229',
  crocBelly: '#D7E6B8',
  tealDeep: '#17524F',
  tealLight: '#2C8580',
  tealNight: '#0E2328',
  tealNightRaised: '#12303A',
  amberLight: '#FFD57A',
  amberGlow: '#FFE3A3',
  amberDeep: '#B8701A',
  amberInk: '#3A2205',
  amberText: '#8F5207',
  lilyLight: '#F7C3D0',
  /** Deep water-lily rose: the error colour (never a harsh red). */
  lilyDeep: '#9C2B45',
  lilyInk: '#6E1C30',
  lilyMist: '#FBE1E8',
  mudDark: '#5A3F22',
  mistText: '#3A5248',
  mistTextMuted: '#4F665B',
  /** Foliage lit by moonlight (Night River leaves, bank edges). */
  jungleNight: '#17493A',
  nightText: '#9DB7B1',
  nightTextMuted: '#7F9A95',
  /** Form field outlines: at least 3:1 against the surfaces they sit on (WCAG 1.4.11). */
  mistOutline: '#71877D',
  nightOutline: '#5C7F78',
  blush: '#E9A0A8',
} as const;

export type PaletteKey = keyof typeof palette;
