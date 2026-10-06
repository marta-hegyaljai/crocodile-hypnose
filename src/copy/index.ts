import { en, type Copy } from './en';
import { isPlaceholderText } from './placeholder';

export { isPlaceholderText } from './placeholder';
export { en };

/** Dotted key paths to every string leaf in the copy object, e.g. "app.name" or "mood.labels.3". */
type Leaves<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : {
      [K in keyof T & (string | number)]: Leaves<
        T[K],
        Prefix extends '' ? `${K}` : `${Prefix}.${K}`
      >;
    }[keyof T & (string | number)];

export type CopyKey = Leaves<Copy>;

export type CopyParams = Record<string, string | number>;

const warned = new Set<string>();

function lookup(key: string): string | undefined {
  let node: unknown = en;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: CopyParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Returns the copy for `key`, interpolating `{param}` tokens.
 * A missing key never throws: it returns the key itself (visible in the UI) and warns once in dev.
 */
export function t(key: CopyKey, params?: CopyParams): string {
  const raw = lookup(key);
  if (raw === undefined) {
    if (__DEV__ && !warned.has(key)) {
      warned.add(key);
      console.warn(`[copy] missing key "${key}"`);
    }
    return key;
  }
  return interpolate(raw, params);
}

/** True when the copy under `key` is still a placeholder for MHP's text. */
export function isPlaceholderKey(key: CopyKey): boolean {
  return isPlaceholderText(lookup(key));
}
