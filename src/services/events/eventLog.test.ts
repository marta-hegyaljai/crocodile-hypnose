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
