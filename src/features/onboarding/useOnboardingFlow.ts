import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { useTapShield } from '@/features/layout/TapShield';
import { useProfile } from '@/services/profile/ProfileProvider';
import type { OnboardingDoc, OnboardingStep } from '@/services/profile/types';

import { deriveSettings, isReachable, nextStep, previousStep, resumeStep, stepHref } from './flow';

export function useOnboardingDoc(): OnboardingDoc {
  return useProfile((s) => s.onboarding);
}

/** Actions every onboarding screen shares. Each change is persisted and synced by the store. */
export function useOnboardingActions() {
  const updateOnboarding = useProfile((s) => s.updateOnboarding);
  const updateSettings = useProfile((s) => s.updateSettings);
  const shield = useTapShield();

  /** Applies a change to the onboarding document and keeps the derived settings in step. */
  const update = useCallback(
    async (change: (doc: OnboardingDoc) => OnboardingDoc) => {
      let next: OnboardingDoc | null = null;
      await updateOnboarding((doc) => {
        next = change(doc);
        return next;
      });
      if (next) {
        const settled = next;
        await updateSettings((settings) => deriveSettings(settled, settings));
      }
    },
    [updateOnboarding, updateSettings],
  );

  /** Moves on from `step`: records the next step as the resume point and navigates to it. */
  const advance = useCallback(
    (step: OnboardingStep) => {
      const next = nextStep(step);
      if (!next) return;
      // The next screen's primary button arrives where Continue was: swallow a double tap.
      shield();
      void update((doc) => ({ ...doc, step: next }));
      router.push(stepHref(next));
    },
    [update, shield],
  );

  /** Goes back to the previous step without losing anything (the screen there resets the resume point). */
  const back = useCallback((step: OnboardingStep) => {
    const previous = previousStep(step);
    if (router.canGoBack()) router.back();
    else if (previous) router.replace(stepHref(previous));
  }, []);

  /** Marks onboarding complete: the route guard then shows home. */
  const finish = useCallback(() => {
    // Home arrives under the finger: a double tap must not hit anything there.
    shield();
    void update((doc) => ({
      ...doc,
      step: 'done',
      completed: true,
      completedAt: Date.now(),
      rewardGranted: true,
    }));
  }, [update, shield]);

  return useMemo(
    () => ({ update, advance, back, finish, shield }),
    [update, advance, back, finish, shield],
  );
}

/**
 * For a step screen: the document, whether the step may be shown (else where to go instead), and
 * the bookkeeping that makes this step the resume point while it is the focused screen (screens
 * left behind in the stack must not claim it back).
 */
export function useStepScreen(step: OnboardingStep): {
  doc: OnboardingDoc;
  redirect: string | null;
} {
  const doc = useOnboardingDoc();
  const updateOnboarding = useProfile((s) => s.updateOnboarding);
  const reachable = isReachable(step, doc);
  const redirect = reachable ? null : doc.completed ? '/home' : stepHref(resumeStep(doc));
  const savedStep = doc.step;

  useFocusEffect(
    useCallback(() => {
      if (!reachable || savedStep === step) return;
      void updateOnboarding((d) => (d.step === step ? d : { ...d, step }));
    }, [reachable, savedStep, step, updateOnboarding]),
  );

  return { doc, redirect };
}
