import { markDone, markStarted, mergeProgress } from './mergeProgress';
import { defaultProgress, isProgressDoc, type ProgressDoc } from './types';

const doc = (stops: ProgressDoc['stops'], updatedAt = 1): ProgressDoc => ({
  version: 1,
  updatedAt,
  stops,
});
const done = (t: number, completedAt = t) => ({
  status: 'done' as const,
  updatedAt: t,
  completedAt,
});
const started = (t: number) => ({ status: 'inProgress' as const, updatedAt: t, completedAt: null });

describe('progress', () => {
  it('a finished stop never goes back, whatever the timestamps', () => {
    const local = doc({ a: done(10) }, 10);
    const stale = doc({ a: started(99) }, 99);
    expect(mergeProgress(local, stale).stops.a).toEqual(done(10));
    expect(mergeProgress(stale, local).stops.a).toEqual(done(10));
  });

  it('takes the union of stops, keeps the first completion, newer unfinished wins', () => {
    const a = doc({ x: done(5, 5), y: started(1) }, 5);
    const b = doc({ x: done(9, 3), y: started(2), z: started(4) }, 9);
    expect(mergeProgress(a, b)).toEqual(doc({ x: done(9, 3), y: started(2), z: started(4) }, 9));
  });

  it('is commutative and idempotent, with a stable key order', () => {
    const a = doc({ b: done(3), a: started(1) }, 3);
    const b = doc({ c: started(2), a: done(4) }, 4);
    const ab = mergeProgress(a, b);
    expect(JSON.stringify(ab)).toBe(JSON.stringify(mergeProgress(b, a)));
    expect(JSON.stringify(mergeProgress(ab, ab))).toBe(JSON.stringify(ab));
    expect(Object.keys(ab.stops)).toEqual(['a', 'b', 'c']);
  });

  it('markStarted / markDone: no change returns the same document', () => {
    const d0 = defaultProgress();
    const d1 = markStarted(d0, 'intro-1', 5);
    expect(d1.stops['intro-1']).toEqual(started(5));
    expect(markStarted(d1, 'intro-1', 6)).toBe(d1);
    const d2 = markDone(d1, 'intro-1', 7);
    expect(d2.stops['intro-1']).toEqual(done(7));
    expect(markDone(d2, 'intro-1', 8)).toBe(d2);
    expect(markStarted(d2, 'intro-1', 9)).toBe(d2);
  });

  it('validates documents', () => {
    expect(isProgressDoc(doc({ 'intro-1': done(1), 'sleep-2': started(2) }))).toBe(true);
    expect(isProgressDoc(doc({ 'Bad Id': done(1) }))).toBe(false);
    expect(isProgressDoc(doc({ a: { status: 'done', updatedAt: 1, completedAt: null } }))).toBe(
      false,
    );
    expect(isProgressDoc(doc({ a: { status: 'inProgress', updatedAt: 1, completedAt: 3 } }))).toBe(
      false,
    );
    expect(isProgressDoc({ version: 2, updatedAt: 1, stops: {} })).toBe(false);
    expect(isProgressDoc({ version: 1, updatedAt: 1, stops: [] })).toBe(false);
  });
});
