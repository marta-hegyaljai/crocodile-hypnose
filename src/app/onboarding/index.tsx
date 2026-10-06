import { Redirect } from 'expo-router';
import React from 'react';

import { resumeStep, stepHref } from '@/features/onboarding/flow';
import { useOnboardingDoc } from '@/features/onboarding/useOnboardingFlow';

/** `/onboarding` resumes at the step the user was on. */
export default function OnboardingIndex() {
  const doc = useOnboardingDoc();
  if (doc.completed) return <Redirect href="/home" />;
  return <Redirect href={stepHref(resumeStep(doc))} />;
}
