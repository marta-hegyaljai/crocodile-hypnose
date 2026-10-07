import { memoryStorage } from '@/test/fakeAuth';

import {
  PENDING_REWARD_MAX_AGE_MS,
  createPendingRewardStore,
  PENDING_REWARD_KEY,
  type PendingReward,
} from './pendingReward';

const reward = (over: Partial<PendingReward> = {}): PendingReward => ({
  stopId: 'intro-2',
  savedAt: 1000,
  phase: 'moodAfter',
  completion: {
    event: {
      id: 'run-00000001',
      type: 'sessionCompleted',
      stopId: 'intro-2',
      stopType: 'audio',
      at: 1000,
      firstTime: true,
    },
    points: { base: 10, bonus: 5, total: 15 },
    unlocked: ['intro-3'],
  },
  ...over,
});

describe('pending reward', () => {
  it('returns the reward for the same stop and user, recent only', async () => {
    const store = createPendingRewardStore(memoryStorage());
    await store.save('u1', reward());
    expect(await store.get('u1', 'intro-2', 2000)).toEqual(reward());
    expect(await store.get('u1', 'sleep-1', 2000)).toBeNull();
    expect(await store.get('u2', 'intro-2', 2000)).toBeNull();
    expect(await store.get('u1', 'intro-2', 1000 + PENDING_REWARD_MAX_AGE_MS)).toBeNull();
  });

  it('clears, and ignores broken data', async () => {
    const storage = memoryStorage();
    const store = createPendingRewardStore(storage);
    await store.save('u1', reward());
    await store.clear('u1');
    expect(await store.get('u1', 'intro-2', 2000)).toBeNull();
    await storage.setItem(`${PENDING_REWARD_KEY}.u1`, '{"stopId":"intro-2"');
    expect(await store.get('u1', 'intro-2', 2000)).toBeNull();
    await storage.setItem(`${PENDING_REWARD_KEY}.u1`, JSON.stringify({ stopId: 'intro-2' }));
    expect(await store.get('u1', 'intro-2', 2000)).toBeNull();
  });
});
