import { isCopyKeyPath } from './copyKeys';
import packJson from './pack.json';
import {
  STOP_TYPES,
  ZONE_IDS,
  type ContentPack,
  type Stop,
  type StopType,
  type Zone,
  type ZoneId,
} from './types';

/**
 * Where the app reads its content from. A local JSON pack for now; a CMS-backed repository can
 * replace it later (it would prefetch and cache, then serve the same snapshot synchronously).
 */
export interface ContentRepository {
  /** Every zone in map order. */
  zones(): readonly Zone[];
  /** The stops of a zone in order (empty for a coming-soon zone). */
  stopsOf(zoneId: ZoneId): readonly Stop[];
  stop(id: string): Stop | undefined;
  zone(id: ZoneId): Zone | undefined;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** Checks a pack's structure and its cross-references. Throws with the first problem found. */
export function parseContentPack(raw: unknown): ContentPack {
  if (!isRecord(raw) || raw.version !== 1) throw new Error('content: unknown pack version');
  const zones = raw.zones;
  const stops = raw.stops;
  if (!Array.isArray(zones) || !Array.isArray(stops)) throw new Error('content: malformed pack');
  const zoneIds = new Set<string>();
  for (const z of zones as unknown[]) {
    if (!isRecord(z) || !(ZONE_IDS as readonly string[]).includes(z.id as string)) {
      throw new Error(`content: bad zone ${JSON.stringify(z)}`);
    }
    if (zoneIds.has(z.id as string)) throw new Error(`content: duplicate zone ${String(z.id)}`);
    zoneIds.add(z.id as string);
    const entry = z.entry;
    if (!isRecord(entry) || !['open', 'afterZone', 'comingSoon'].includes(entry.kind as string)) {
      throw new Error(`content: bad entry rule for zone ${String(z.id)}`);
    }
    if (typeof z.titleKey !== 'string' || !isCopyKeyPath(z.titleKey)) {
      throw new Error(`content: zone ${String(z.id)} title is not a copy key`);
    }
  }
  for (const z of zones as Zone[]) {
    if (z.entry.kind === 'afterZone' && !zoneIds.has(z.entry.zoneId)) {
      throw new Error(`content: zone ${z.id} opens after an unknown zone`);
    }
  }
  const stopIds = new Set<string>();
  for (const s of stops as unknown[]) {
    if (!isRecord(s) || typeof s.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(s.id)) {
      throw new Error(`content: bad stop ${JSON.stringify(s)}`);
    }
    if (stopIds.has(s.id)) throw new Error(`content: duplicate stop ${s.id}`);
    stopIds.add(s.id);
    if (!zoneIds.has(s.zoneId as string)) throw new Error(`content: stop ${s.id} has no zone`);
    if (!(STOP_TYPES as readonly string[]).includes(s.type as StopType)) {
      throw new Error(`content: stop ${s.id} has an unknown type`);
    }
    if (typeof s.order !== 'number' || typeof s.durationSec !== 'number' || s.durationSec <= 0) {
      throw new Error(`content: stop ${s.id} needs an order and a duration`);
    }
    if (typeof s.titleKey !== 'string' || !isCopyKeyPath(s.titleKey)) {
      throw new Error(`content: stop ${s.id} title is not a copy key`);
    }
    if (s.unlock !== 'previous' && s.unlock !== 'open') {
      throw new Error(`content: stop ${s.id} has an unknown unlock rule`);
    }
  }
  return raw as unknown as ContentPack;
}

/** A repository over an in-memory pack (the bundled JSON, or a test's own). */
export function createLocalContentRepository(pack: ContentPack): ContentRepository {
  const zones = [...pack.zones].sort((a, b) => a.order - b.order);
  const byZone = new Map<ZoneId, Stop[]>();
  for (const zone of zones) byZone.set(zone.id, []);
  for (const stop of pack.stops) byZone.get(stop.zoneId)?.push(stop);
  for (const list of byZone.values()) list.sort((a, b) => a.order - b.order);
  const stops = new Map(pack.stops.map((s) => [s.id, s]));
  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  return {
    zones: () => zones,
    stopsOf: (zoneId) => byZone.get(zoneId) ?? [],
    stop: (id) => stops.get(id),
    zone: (id) => zoneMap.get(id),
  };
}

/** The bundled content pack. */
export const localContent: ContentRepository = createLocalContentRepository(
  parseContentPack(packJson),
);
