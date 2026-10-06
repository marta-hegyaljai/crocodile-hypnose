import { ONBOARDING_STEPS, type OnboardingDoc } from './types';

const stepIndex = (step: OnboardingDoc['step']) => ONBOARDING_STEPS.indexOf(step);

/**
 * Merges two copies of the onboarding document (this device's and another's). Completion is one
 * way: a finished onboarding always wins, whatever the timestamps, so a stale tab or device can
 * never undo it. Otherwise the newer copy is the base and the one-way facts of the older one
 * (hatched, named, first session done, reward granted, the furthest step) are kept.
 */
export function mergeOnboarding(a: OnboardingDoc, b: OnboardingDoc): OnboardingDoc {
  if (a.completed !== b.completed) return a.completed ? a : b;
  const [newer, older] = b.updatedAt > a.updatedAt ? [b, a] : [a, b];
  if (newer.completed) return newer;
  return {
    ...newer,
    step: stepIndex(older.step) > stepIndex(newer.step) ? older.step : newer.step,
    crocHatched: newer.crocHatched || older.crocHatched,
    crocName: newer.crocName ?? older.crocName,
    firstSession: {
      ...newer.firstSession,
      completed: newer.firstSession.completed || older.firstSession.completed,
    },
    rewardGranted: newer.rewardGranted || older.rewardGranted,
  };
}
