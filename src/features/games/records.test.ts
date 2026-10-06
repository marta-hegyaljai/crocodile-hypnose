import type { KeyValueStorage } from '@/services/auth/storage';

import {
  createGameRecordsStore,
  emptyRecords,
  mergeRecords,
  parseRecords,
  recordPlay,
} from './records';

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
    subscribe: () => () => undefined,
  };
}

describe('game records', () => {
  it('counts plays and keeps the best result', () => {
    let r = recordPlay(emptyRecords(), { gameId: 'stillness', score: 60 });
    r = recordPlay(r, { gameId: 'stillness', score: 40 });
    expect(r.stillness).toEqual({ plays: 2, best: { gameId: 'stillness', score: 60 } });
    r = recordPlay(r, { gameId: 'stillness', score: 90 });
    expect(r.stillness.best).toEqual({ gameId: 'stillness', score: 90 });
    expect(r.firefly).toEqual({ plays: 0, best: null });
  });

  it('merges two copies without losing plays or a better result', () => {
    const a = recordPlay(emptyRecords(), { gameId: 'breathing', breaths: 5 });
    const b = recordPlay(recordPlay(emptyRecords(), { gameId: 'breathing', breaths: 3 }), {
      gameId: 'firefly',
      rounds: 3,
      total: 3,
    });
    const m = mergeRecords(a, b);
    // Copies are merged by the larger count (a stale tab is a copy, not an extra play) and the best.
    expect(m.breathing).toEqual({ plays: 1, best: { gameId: 'breathing', breaths: 5 } });
    expect(m.firefly.plays).toBe(1);
    expect(mergeRecords(a, b)).toEqual(mergeRecords(b, a));
  });

  it('parses damaged or foreign data into empty records', () => {
    expect(parseRecords(null)).toEqual(emptyRecords());
    expect(parseRecords('{not json')).toEqual(emptyRecords());
    expect(parseRecords('{"stillness":{"plays":-1,"best":null}}')).toEqual(emptyRecords());
    expect(
      parseRecords('{"stillness":{"plays":2,"best":{"gameId":"firefly","rounds":1,"total":3}}}')
        .stillness,
    ).toEqual({ plays: 0, best: null });
    expect(
      parseRecords(JSON.stringify(recordPlay(emptyRecords(), { gameId: 'breathing', breaths: 4 })))
        .breathing.plays,
    ).toBe(1);
  });

  it('persists per user and merges with what another tab wrote', async () => {
    const storage = memoryStorage();
    const store = createGameRecordsStore(storage);
    await store.getState().load('u1');
    await store.getState().record({ gameId: 'stillness', score: 50 });
    expect(store.getState().records.stillness.plays).toBe(1);
    // Another tab played too.
    const other = recordPlay(JSON.parse(storage.map.get('mhp.hypnose.games.v1.u1')!), {
      gameId: 'stillness',
      score: 99,
    });
    storage.map.set('mhp.hypnose.games.v1.u1', JSON.stringify(other));
    await store.getState().record({ gameId: 'stillness', score: 10 });
    expect(store.getState().records.stillness).toEqual({
      plays: 3,
      best: { gameId: 'stillness', score: 99 },
    });
    // A different user sees nothing of it.
    await store.getState().load('u2');
    expect(store.getState().records).toEqual(emptyRecords());
    await store.getState().load('u1');
    expect(store.getState().records.stillness.plays).toBe(3);
  });
});
