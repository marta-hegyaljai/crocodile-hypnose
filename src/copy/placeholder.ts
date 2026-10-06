/**
 * Placeholder registry. Copy that MHP still has to provide (names, tagline, mood labels, stage names...)
 * is wrapped in `ph()` inside `en.ts`. The UI can then mark it visually in dev mode.
 */
const placeholders = new Set<string>();

export function ph(text: string): string {
  placeholders.add(text);
  return text;
}

export function isPlaceholderText(text: unknown): boolean {
  return typeof text === 'string' && placeholders.has(text);
}
