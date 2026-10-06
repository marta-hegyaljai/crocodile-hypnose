import { defaultOnboarding, defaultSettings, type OnboardingDoc } from '@/services/profile/types';

import {
  checkCrocName,
  deriveSettings,
  furthestStep,
  isReachable,
  nextStep,
  previousStep,
  recommendedZone,
  resumeStep,
  stepComplete,
  stepHref,
  stepPosition,
  toggleGoal,
} from './flow';

function answered(overrides: Partial<OnboardingDoc> = {}): OnboardingDoc {
  return {
    ...defaultOnboarding(1),
    goals: ['sleep'],
    experience: 'new',
    timeOfDay: 'evening',
    sessionLength: 'short',
    safety: { answers: [false, false, false], acknowledged: false },
    moodConsent: true,
    crocHatched: true,
    crocName: 'Croc',
    firstSession: { completed: true, moodBefore: null, moodAfter: null },
    reminder: 'skipped',
    ...overrides,
  };
}

describe('onboarding flow', () => {
  it('orders the steps', () => {
    expect(nextStep('goals')).toBe('experience');
    expect(nextStep('reminder')).toBe('done');
    expect(nextStep('done')).toBeNull();
    expect(previousStep('goals')).toBeNull();
    expect(previousStep('hatch')).toBe('consent');
    expect(stepHref('firstSession')).toBe('/onboarding/first-session');
    expect(stepPosition('goals')).toEqual({ index: 1, total: 7 });
    expect(stepPosition('reminder')).toEqual({ index: 7, total: 7 });
    expect(stepPosition('done')).toEqual({ index: 7, total: 7 });
  });

  it('allows one or two goals and refuses a third', () => {
    const one = toggleGoal([], 'sleep');
    expect(one).toEqual({ goals: ['sleep'], refused: false });
    const two = toggleGoal(one.goals, 'focus');
    expect(two.goals).toEqual(['sleep', 'focus']);
    const three = toggleGoal(two.goals, 'habits');
    expect(three).toEqual({ goals: ['sleep', 'focus'], refused: true });
    expect(toggleGoal(two.goals, 'sleep').goals).toEqual(['focus']);
  });

  it('knows when each step is complete', () => {
    const empty = defaultOnboarding(1);
    expect(stepComplete('goals', empty)).toBe(false);
    expect(stepComplete('goals', { ...empty, goals: ['stress'] })).toBe(true);
    expect(stepComplete('experience', { ...empty, experience: 'new' })).toBe(false);
    expect(
      stepComplete('experience', {
        ...empty,
        experience: 'new',
        timeOfDay: 'morning',
        sessionLength: 'long',
      }),
    ).toBe(true);
    // A "yes" needs the calm info screen acknowledged first.
    const yes = { ...empty, safety: { answers: [false, true, false], acknowledged: false } };
    expect(stepComplete('safety', yes)).toBe(false);
    expect(stepComplete('safety', { ...yes, safety: { ...yes.safety, acknowledged: true } })).toBe(
      true,
    );
    expect(
      stepComplete('safety', {
        ...empty,
        safety: { answers: [false, false, null], acknowledged: false },
      }),
    ).toBe(false);
    expect(stepComplete('consent', { ...empty, moodConsent: false })).toBe(true);
    expect(stepComplete('hatch', { ...empty, crocHatched: true })).toBe(false);
    expect(stepComplete('hatch', { ...empty, crocHatched: true, crocName: 'Zed' })).toBe(true);
    expect(stepComplete('reminder', { ...empty, reminder: 'unavailable' })).toBe(true);
  });

  it('derives the furthest reachable step from the answers, and resumes there or earlier', () => {
    const empty = defaultOnboarding(1);
    expect(furthestStep(empty)).toBe('goals');
    expect(isReachable('experience', empty)).toBe(false);
    const partial = answered({ moodConsent: null, crocHatched: false, crocName: null });
    expect(furthestStep(partial)).toBe('consent');
    expect(isReachable('goals', partial)).toBe(true);
    expect(isReachable('hatch', partial)).toBe(false);
    // The saved step wins when it is reachable (Back moves the resume point too).
    expect(resumeStep({ ...partial, step: 'experience' })).toBe('experience');
    // A saved step the answers do not support (an older device) falls back.
    expect(resumeStep({ ...partial, step: 'reminder' })).toBe('consent');
    const all = answered();
    expect(furthestStep(all)).toBe('done');
    expect(isReachable('done', all)).toBe(true);
    expect(isReachable('goals', { ...all, completed: true })).toBe(false);
  });

  it('validates the croc name', () => {
    expect(checkCrocName('  Zé  🐊 ')).toEqual({ ok: true, name: 'Zé 🐊' });
    expect(checkCrocName('🐊'.repeat(20))).toEqual({ ok: true, name: '🐊'.repeat(20) });
    expect(checkCrocName('')).toEqual({ ok: false, problem: 'blank' });
    expect(checkCrocName('   ')).toEqual({ ok: false, problem: 'blank' });
    expect(checkCrocName('x'.repeat(21))).toEqual({ ok: false, problem: 'long' });
    expect(checkCrocName('bad\u0007name')).toEqual({ ok: false, problem: 'long' });
  });

  it('derives settings from the answers and keeps the rest', () => {
    const current = { ...defaultSettings(1), sound: false, haptics: true };
    const doc = answered({
      goals: ['stress', 'habits'],
      safety: { answers: [false, true, false], acknowledged: true },
      reminder: 'enabled',
      timeOfDay: 'morning',
      sessionLength: 'long',
    });
    const settings = deriveSettings(doc, current);
    expect(settings).toMatchObject({
      crocName: 'Croc',
      goals: ['stress', 'habits'],
      experience: 'new',
      sessionLength: 'long',
      reminder: { enabled: true, time: '08:00', timeOfDay: 'morning' },
      moodConsent: true,
      safety: { answers: [false, true, false], cautionMode: true },
      sound: false,
      haptics: true,
    });
    // Skipping the reminder keeps the time as a suggestion for settings, turned off.
    const skipped = deriveSettings(answered({ reminder: 'skipped' }), current);
    expect(skipped.reminder).toEqual({ enabled: false, time: '20:30', timeOfDay: 'evening' });
    // Before the answers are in, defaults stay.
    const early = deriveSettings(defaultOnboarding(1), current);
    expect(early.sessionLength).toBe('medium');
    expect(early.moodConsent).toBe(false);
    expect(early.safety.cautionMode).toBe(false);
  });

  it('recommends the first goal as the starting zone', () => {
    expect(recommendedZone(['focus', 'sleep'])).toBe('focus');
    expect(recommendedZone([])).toBe('intro');
  });
});
