import { memoryStorage } from '@/test/fakeAuth';

import { canResume, createResumeStore, RESUME_MAX_AGE_MS, type ResumePoint } from './resume';

const point = (over: Partial<ResumePoint> = {}): ResumePoint => ({
  stopId: 'intro-2',
  position: 30,
  coverage: [[0, 30]],
  runId: 'run-00000001',
  updatedAt: 1000,
  ...over,
});

describe('resume points', () => {
  it('offers to resume only in the middle of a recent session', () => {
    expect(canResume(point(), 90, 2000)).toBe(true);
    expect(canResume(null, 90, 2000)).toBe(false);
    expect(canResume(point({ position: 2 }), 90, 2000)).toBe(false);
    expect(canResume(point({ position: 88 }), 90, 2000)).toBe(false);
    expect(canResume(point(), 90, 1000 + RESUME_MAX_AGE_MS)).toBe(false);
  });

  it('stores per user and stop, ignores broken data, clears', async () => {
    const storage = memoryStorage();
    const store = createResumeStore(storage);
    await store.save('u1', point());
    await store.save('u1', point({ stopId: 'sleep-1' }));
    expect(await store.get('u1', 'intro-2')).toEqual(point());
    expect(await store.get('u2', 'intro-2')).toBeNull();
    await store.clear('u1', 'intro-2');
    expect(await store.get('u1', 'intro-2')).toBeNull();
    expect(await store.get('u1', 'sleep-1')).not.toBeNull();
    await storage.setItem('mhp.hypnose.playback.v1.u3', '{"a":{"stopId":1}}');
    expect(await store.get('u3', 'a')).toBeNull();
    await storage.setItem('mhp.hypnose.playback.v1.u4', 'not json');
    expect(await store.get('u4', 'a')).toBeNull();
  });
});
