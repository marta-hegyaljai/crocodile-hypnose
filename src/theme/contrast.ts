/** WCAG 2.x relative luminance and contrast ratio for #RRGGBB colours. */

function channel(hex: string): number {
  const v = parseInt(hex, 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const hex = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`relativeLuminance expects #RRGGBB, got "${color}"`);
  }
  const r = channel(hex.slice(0, 2));
  const g = channel(hex.slice(2, 4));
  const b = channel(hex.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_LARGE = 3;

/** `#RRGGBB` with an alpha channel, as `rgba()`: for halos and tints derived from theme colours. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`withAlpha expects #RRGGBB, got "${color}"`);
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
