import { en } from '@/copy';

/** True when `path` names a string in the copy module (content titles are copy keys). */
export function isCopyKeyPath(path: string): boolean {
  let node: unknown = en;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}
