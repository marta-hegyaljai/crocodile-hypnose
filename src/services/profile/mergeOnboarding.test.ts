import { mergeOnboarding } from './mergeOnboarding';
import { defaultOnboarding, type OnboardingDoc } from './types';

const doc = (updatedAt: number, overrides: Partial<OnboardingDoc> = {}): OnboardingDoc => ({
  ...defaultOnboarding(updatedAt),
  ...overrides,
});

describe('mergeOnboarding', () => {
  it('a finished onboarding wins whatever the timestamps say', () => {
    const done = doc(1, { completed: true, step: 'done', crocName: 'Zed' });
    const stale = doc(99, { step: 'experience', goals: ['focus'] });
    expect(mergeOnboarding(stale, done)).toBe(done);
    expect(mergeOnboarding(done, stale)).toBe(done);
  });

  it('two finished copies: the newer one', () => {
    const a = doc(1, { completed: true, crocName: 'A' });
    const b = doc(2, { completed: true, crocName: 'B' });
    expect(mergeOnboarding(a, b)).toBe(b);
    expect(mergeOnboarding(b, a)).toBe(b);
  });

  it('unfinished copies: the newer one, keeping the one-way facts of the older one', () => {
    const older = doc(1, {
      step: 'firstSession',
      crocHatched: true,
      crocName: 'Zed',
      firstSession: { completed: true, moodBefore: null, moodAfter: null },
      rewardGranted: true,
    });
    const newer = doc(2, { step: 'safety', goals: ['stress'] });
    const merged = mergeOnboarding(older, newer);
    expect(merged).toMatchObject({
      updatedAt: 2,
      goals: ['stress'],
      step: 'firstSession',
      crocHatched: true,
      crocName: 'Zed',
      firstSession: { completed: true },
      rewardGranted: true,
    });
    // The newer copy's own facts stay when it has them.
    const named = doc(3, { step: 'reminder', crocHatched: true, crocName: 'New' });
    expect(mergeOnboarding(older, named).crocName).toBe('New');
    expect(mergeOnboarding(older, named).step).toBe('reminder');
  });

  it('keeps the local copy on a tie', () => {
    const a = doc(5, { goals: ['sleep'] });
    const b = doc(5, { goals: ['focus'] });
    expect(mergeOnboarding(a, b).goals).toEqual(['sleep']);
  });
});
