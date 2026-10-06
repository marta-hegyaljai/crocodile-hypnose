import type { Theme } from './themes';

/** Text tones offered by the design system. Each must meet WCAG AA on the surfaces it is meant for. */
export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'accent'
  | 'onAccent'
  | 'onPrimary'
  | 'water'
  | 'danger';

/** Tones for text on the atmosphere's ordinary surfaces (background, surface, surfaceRaised). */
export const SURFACE_TONES: readonly TextTone[] = [
  'primary',
  'secondary',
  'muted',
  'accent',
  'water',
  'danger',
];

export function textToneColor(theme: Theme, tone: TextTone): string {
  const c = theme.colors;
  switch (tone) {
    case 'primary':
      return c.textPrimary;
    case 'secondary':
      return c.textSecondary;
    case 'muted':
      return c.textMuted;
    case 'inverse':
      return c.textInverse;
    case 'accent':
      return c.textAccent;
    case 'onAccent':
      return c.textOnAccent;
    case 'onPrimary':
      return c.textOnPrimary;
    case 'water':
      return c.textWater;
    case 'danger':
      return c.textDanger;
  }
}
