import { t, type CopyKey } from '@/copy';
import { defaultProgress, type ProgressDoc } from '@/services/progress/types';
import { markDone, markStarted } from '@/services/progress/mergeProgress';

import { dayPartOf, deriveJourney, pickTodaysSession } from './journey';
import packJson from './pack.json';
import { createLocalContentRepository, localContent, parseContentPack } from './repository';
import type { ContentPack, Stop } from './types';

const NOON = 13;
const MORNING = 9;
const EVENING = 21;

function done(ids: string[], doc: ProgressDoc = defaultProgress()): ProgressDoc {
  return ids.reduce((d, id, i) => markDone(d, id, 1000 + i), doc);
}

function journey(progress = defaultProgress(), cautionMode = false, content = localContent) {
  return deriveJourney(content, progress, { cautionMode });
}

const ids = (zone: 'intro' | 'sleep', n: number) =>
  Array.from({ length: n }, (_, i) => `${zone}-${i + 1}`);

describe('content pack', () => {
  it('has six zones; Intro and Sleep with 8 to 10 stops of every type, ending in a long trance', () => {
    const zones = localContent.zones();
    expect(zones.map((z) => z.id)).toEqual([
      'intro',
      'sleep',
      'stress',
      'confidence',
      'focus',
      'habits',
    ]);
    for (const id of ['intro', 'sleep'] as const) {
      const stops = localContent.stopsOf(id);
      expect(stops.length).toBeGreaterThanOrEqual(8);
      expect(stops.length).toBeLessThanOrEqual(10);
      expect(new Set(stops.map((s) => s.type))).toEqual(
        new Set(['video', 'audio', 'visual', 'game', 'longTrance']),
      );
      expect(stops[stops.length - 1]!.type).toBe('longTrance');
      expect(stops.map((s) => s.order)).toEqual(stops.map((_, i) => i + 1));
    }
    for (const id of ['stress', 'confidence', 'focus', 'habits'] as const) {
      expect(localContent.zone(id)?.entry.kind).toBe('comingSoon');
      expect(localContent.stopsOf(id)).toEqual([]);
    }
  });

  it('every title is placeholder copy', () => {
    for (const zone of localContent.zones()) {
      for (const stop of localContent.stopsOf(zone.id)) {
        expect(t(stop.titleKey)).not.toBe(stop.titleKey);
      }
      expect(t(zone.titleKey)).not.toBe(zone.titleKey);
    }
    expect(t('stops.intro.s1' as CopyKey)).toBe('Intro · Stop 1');
  });

  it('refuses malformed packs', () => {
    const base = packJson as unknown as ContentPack;
    const bad = (change: (p: ContentPack) => unknown) =>
      expect(() => parseContentPack(change(structuredClone(base)))).toThrow();
    bad((p) => ({ ...p, version: 2 }));
    bad((p) => ({ ...p, stops: [...p.stops, p.stops[0]] }));
    bad((p) => ({ ...p, stops: [{ ...p.stops[0]!, zoneId: 'nowhere' }] }));
    bad((p) => ({ ...p, stops: [{ ...p.stops[0]!, type: 'podcast' }] }));
    bad((p) => ({ ...p, stops: [{ ...p.stops[0]!, titleKey: 'stops.nope' }] }));
    bad((p) => ({ ...p, stops: [{ ...p.stops[0]!, id: 'Has Spaces' }] }));
    bad((p) => ({ ...p, zones: [{ ...p.zones[0]!, entry: { kind: 'afterZone', zoneId: 'x' } }] }));
  });
});

describe('deriveJourney', () => {
  it('a new user: the first stop of each open zone is available, the rest locked', () => {
    const j = journey();
    const intro = j.zones[0]!;
    expect(intro.stops.map((s) => s.status)).toEqual([
      'available',
      ...Array(intro.total - 1).fill('locked'),
    ]);
    expect(intro.stops[1]!.lockReason).toEqual({ kind: 'previous', stop: intro.stops[0]!.stop });
    expect(j.zones[1]!.stops[0]!.status).toBe('available');
    expect(j.zones[2]!).toMatchObject({ state: 'comingSoon', total: 0, finished: false });
  });

  it('finishing a stop unlocks the next; a started stop is in progress', () => {
    const progress = markStarted(done(['intro-1']), 'intro-2', 2000);
    const stops = journey(progress).zones[0]!.stops;
    expect(stops.slice(0, 3).map((s) => s.status)).toEqual(['done', 'inProgress', 'locked']);
  });

  it('a finished stop stays finished even when an earlier one is not (synced or reordered)', () => {
    const stops = journey(done(['intro-3'])).zones[0]!.stops;
    expect(stops.slice(0, 4).map((s) => s.status)).toEqual([
      'available',
      'locked',
      'done',
      'available',
    ]);
  });

  it('caution mode: unsuitable stops are marked and never block the way', () => {
    const progress = done(ids('intro', 5));
    const stops = journey(progress, true).zones[0]!.stops;
    expect(stops[5]!.status).toBe('caution'); // intro-6 is not caution-safe
    expect(stops[6]!.status).toBe('available');
    // Finished before caution mode was turned on: still finished.
    expect(journey(done(ids('intro', 6)), true).zones[0]!.stops[5]!.status).toBe('done');
  });

  it('a zone that opens after another stays locked until that one is finished', () => {
    const pack: ContentPack = {
      version: 1,
      zones: [
        { id: 'intro', order: 1, titleKey: 'zones.intro', entry: { kind: 'open' } },
        {
          id: 'sleep',
          order: 2,
          titleKey: 'zones.sleep',
          entry: { kind: 'afterZone', zoneId: 'intro' },
        },
      ],
      stops: (packJson as unknown as ContentPack).stops.filter((s) =>
        ['intro-1', 'intro-2', 'sleep-1'].includes(s.id),
      ),
    };
    const content = createLocalContentRepository(pack);
    const locked = journey(done(['intro-1']), false, content);
    expect(locked.zones[1]).toMatchObject({ state: 'locked' });
    expect(locked.zones[1]!.stops[0]!.lockReason).toMatchObject({ kind: 'zone' });
    const open = journey(done(['intro-1', 'intro-2']), false, content);
    expect(open.zones[1]!.stops[0]!.status).toBe('available');
  });
});

describe('pickTodaysSession', () => {
  const pick = (
    progress = defaultProgress(),
    opts: Partial<{
      goals: ('sleep' | 'stress' | 'focus')[];
      hour: number;
      cautionMode: boolean;
    }> = {},
  ) =>
    pickTodaysSession(journey(progress, opts.cautionMode ?? false), {
      goals: opts.goals ?? ['sleep'],
      hour: opts.hour ?? EVENING,
      cautionMode: opts.cautionMode ?? false,
    });

  it('the next stop in the goal zone', () => {
    expect(pick()).toMatchObject({ kind: 'next', stop: { id: 'sleep-1' } });
    expect(pick(done(['sleep-1']))).toMatchObject({ kind: 'next', stop: { id: 'sleep-2' } });
  });

  it('resumes a started stop first', () => {
    expect(pick(markStarted(defaultProgress(), 'sleep-1', 5))).toMatchObject({
      kind: 'resume',
      stop: { id: 'sleep-1' },
    });
  });

  it('a goal without content yet falls back to Intro, then the other open zones', () => {
    expect(pick(undefined, { goals: ['stress'] })).toMatchObject({ stop: { id: 'intro-1' } });
    expect(pick(undefined, { goals: [] })).toMatchObject({ stop: { id: 'intro-1' } });
    expect(pick(done(ids('intro', 9)), { goals: ['focus'] })).toMatchObject({
      stop: { id: 'sleep-1' },
    });
  });

  it('evening content gives way in the morning, but is still offered if nothing else fits', () => {
    // sleep-2 is evening content.
    expect(pick(done(['sleep-1']), { hour: MORNING })).toMatchObject({ stop: { id: 'intro-1' } });
    expect(pick(done(['sleep-1']), { hour: EVENING })).toMatchObject({ stop: { id: 'sleep-2' } });
    const allIntro = done([...ids('intro', 9), 'sleep-1']);
    expect(pick(allIntro, { hour: NOON })).toMatchObject({ stop: { id: 'sleep-2' } });
  });

  it('caution mode skips unsuitable stops', () => {
    const progress = done(ids('sleep', 4));
    expect(pick(progress, { cautionMode: true })).toMatchObject({ stop: { id: 'sleep-6' } });
    expect(pick(progress, { cautionMode: false })).toMatchObject({ stop: { id: 'sleep-5' } });
  });

  it('suggests a replay when everything is done (the long trance first), never null', () => {
    const all = done([...ids('intro', 9), ...ids('sleep', 10)]);
    expect(pick(all)).toMatchObject({ kind: 'replay', stop: { id: 'sleep-10' } });
    // In the morning, the evening finale gives way to a stop that fits.
    expect(pick(all, { hour: MORNING })).toMatchObject({ kind: 'replay', stop: { id: 'sleep-6' } });
    // Caution mode never suggests the (unsuitable) long trance again.
    const r = pick(all, { cautionMode: true });
    expect(r?.kind).toBe('replay');
    expect((localContent.stop(r!.stop.id) as Stop).cautionSafe).toBe(true);
  });

  it('day parts', () => {
    expect([4, 5, 11, 12, 16, 17, 23].map(dayPartOf)).toEqual([
      'evening',
      'morning',
      'morning',
      'day',
      'day',
      'evening',
      'evening',
    ]);
  });
});
