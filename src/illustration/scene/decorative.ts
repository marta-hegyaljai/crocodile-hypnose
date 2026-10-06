/**
 * Props that hide purely decorative illustration from assistive technology on every platform.
 * Spread onto the root View of a scene piece. The croc itself stays accessible (it has a name).
 */
export const decorative = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  'aria-hidden': true,
} as const;
