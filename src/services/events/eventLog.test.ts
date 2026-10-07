import { PartialPush } from '@/services/profile/documentStore';

import {
  addToLog,
  confirmedLog,
  emptyLog,
  eventsOf,
  isEventLogDoc,
  mergeLogs,
  pendingOf,
  pushLog,
} from './eventLog';
import {
  isMoodEntry,
  isSessionCompletedEvent,
  newEventId,
  type SessionCompletedEvent,
} from './types';

const event = (id: string, over: Partial<SessionCompletedEvent> = {}): SessionCompletedEvent => ({
  id,
  type: 'sessionCompleted',
  stopId: 'intro-2',
  stopType: 'audio',
  at: 100,
  firstTime: true,
  ...over,
});

describe('event log', () => {
  it('adding an event twice is a no-op', () => {
    const d1 = addToLog(emptyLog<SessionCompletedEvent>(), event('evt-00000001'));
    expect(addToLog(d1, event('evt-00000001', { at: 999 }))).toBe(d1);
    expect(pendingOf(d1)).toEqual([event('evt-00000001')]);
  });

  it('merges as a union by id; the server version wins; commutative and idempotent', () => {
    const local = addToLog(
      addToLog(emptyLog<SessionCompletedEvent>(1), event('evt-00000001')),
      event('evt-00000002', { at: 50 }),
    );
    const server = confirmedLog([event('evt-00000001', { firstTime: false })]);
    const ab = mergeLogs(local, server);
    expect(JSON.stringify(ab)).toBe(JSON.stringify(mergeLogs(server, local)));
    expect(JSON.stringify(mergeLogs(ab, ab))).toBe(JSON.stringify(ab));
    expect(ab.items['evt-00000001']).toEqual({
      ...event('evt-00000001', { firstTime: false }),
      confirmed: true,
    });
    expect(pendingOf(ab).map((e) => e.id)).toEqual(['evt-00000002']);
    expect(eventsOf(ab).map((e) => e.id)).toEqual(['evt-00000002', 'evt-00000001']);
  });

  it('pushes pending events in batches and confirms what the server stored', async () => {
    let doc = emptyLog<SessionCompletedEvent>();
    for (let i = 0; i < 120; i++) doc = addToLog(doc, event(`evt-${String(i).padStart(8, '0')}`));
    const sizes: number[] = [];
    const pushed = await pushLog(doc, async (items) => {
      sizes.push(items.length);
      return items.map((e) => ({ ...e, firstTime: false }));
    });
    expect(sizes).toEqual([50, 50, 20]);
    expect(pendingOf(pushed)).toEqual([]);
    expect(
      await pushLog(pushed, async () => {
        throw new Error('not called');
      }),
    ).toBe(pushed);
  });

  it('one refused event does not stop the rest of a batch (it is settled, never resent)', async () => {
    let doc = emptyLog<SessionCompletedEvent>();
    for (let i = 1; i <= 3; i++) doc = addToLog(doc, event(`evt-0000000${i}`));
    const refused = new Error('refused');
    const stored: string[] = [];
    const send = async (items: SessionCompletedEvent[]) => {
      if (items.some((e) => e.id === 'evt-00000002')) throw refused;
      stored.push(...items.map((e) => e.id));
      return items;
    };
    const pushed = await pushLog(doc, send, (err) => err === refused);
    expect(stored).toEqual(['evt-00000001', 'evt-00000003']);
    expect(pendingOf(pushed)).toEqual([]);
    expect(Object.keys(pushed.items)).toHaveLength(3);
    // A connection problem is not a refusal: it still fails the push (to be retried).
    await expect(
      pushLog(
        doc,
        async () => {
          throw new Error('offline');
        },
        (err) => err === refused,
      ),
    ).rejects.toThrow('offline');
  });

  it('a rate limit in the middle of the fallback keeps what was learned (PartialPush)', async () => {
    let doc = emptyLog<SessionCompletedEvent>();
    for (let i = 1; i <= 6; i++) doc = addToLog(doc, event(`evt-0000000${i}`));
    const refused = new Error('refused');
    const limited = new Error('rate_limited');
    const calls: string[][] = [];
    const send = async (items: SessionCompletedEvent[]) => {
      calls.push(items.map((e) => e.id));
      if (items.length > 1) throw refused;
      if (items[0]!.id === 'evt-00000002') throw refused;
      if (items[0]!.id === 'evt-00000004') throw limited;
      return items;
    };
    const error = await pushLog(doc, send, (err) => err === refused).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PartialPush);
    const partial = (error as PartialPush<typeof doc>).partial;
    expect((error as PartialPush<typeof doc>).reason).toBe(limited);
    // 1 was stored, 2 was refused for good (settled); 3.. are still to send, nothing restarts.
    expect(pendingOf(partial).map((e) => e.id)).toEqual([
      'evt-00000004',
      'evt-00000005',
      'evt-00000006',
    ]);
    expect(Object.keys(partial.items)).toHaveLength(6);
    calls.length = 0;
    const done = await pushLog(partial, async (items) => {
      calls.push(items.map((e) => e.id));
      return items;
    });
    expect(calls).toEqual([['evt-00000004', 'evt-00000005', 'evt-00000006']]);
    expect(pendingOf(done)).toEqual([]);
  });

  it('a failure before anything was learned is thrown as it is', async () => {
    const doc = addToLog(emptyLog<SessionCompletedEvent>(), event('evt-00000001'));
    const limited = new Error('rate_limited');
    await expect(
      pushLog(doc, async () => {
        throw limited;
      }),
    ).rejects.toBe(limited);
  });

  it('keeps earlier batches when a later batch fails', async () => {
    let doc = emptyLog<SessionCompletedEvent>();
    for (let i = 0; i < 60; i++) doc = addToLog(doc, event(`evt-${String(i).padStart(8, '0')}`));
    let n = 0;
    const error = await pushLog(doc, async (items) => {
      if (++n === 2) throw new Error('rate_limited');
      return items;
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PartialPush);
    expect(pendingOf((error as PartialPush<typeof doc>).partial)).toHaveLength(10);
  });

  it('validates stored logs and events', () => {
    const valid = isEventLogDoc(isSessionCompletedEvent);
    expect(valid(confirmedLog([event('evt-00000001')]))).toBe(true);
    expect(valid({ version: 1, updatedAt: 0, items: { other: event('evt-00000001') } })).toBe(
      false,
    );
    expect(isSessionCompletedEvent(event('x'))).toBe(false);
    expect(isSessionCompletedEvent({ ...event('evt-00000001'), points: 5 })).toBe(false);
    expect(isMoodEntry({ id: 'mood-0001', at: 1, phase: 'after', value: 5, stopId: null })).toBe(
      true,
    );
    expect(isMoodEntry({ id: 'mood-0001', at: 1, phase: 'after', value: 6, stopId: null })).toBe(
      false,
    );
    expect(newEventId(() => 0.5, 1)).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newEventId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
