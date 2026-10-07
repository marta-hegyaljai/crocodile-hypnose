/**
 * The content metadata the server decides with: every stop's id, zone, type and length, read
 * from the app's content pack (the same JSON the app ships), so a stop's type, whether it exists
 * and how long it is never come from the client.
 */
import { readFileSync } from 'node:fs';

import {
  contentMetaOf,
  type ContentMeta,
  type StopMeta,
} from '../../src/services/gamification/shared/rules.ts';

const PACK_URL = new URL('../../src/content/pack.json', import.meta.url);

let cached: ContentMeta | null = null;

export function serverContent(): ContentMeta {
  if (!cached) {
    const pack = JSON.parse(readFileSync(PACK_URL, 'utf8')) as { stops: StopMeta[] };
    cached = contentMetaOf(pack.stops);
  }
  return cached;
}
