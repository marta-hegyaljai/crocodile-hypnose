import type { CopyKey } from '@/copy';
import {
  ONBOARDING_STEPS,
  SAFETY_QUESTION_COUNT,
  type Goal,
  type OnboardingDoc,
  type OnboardingStep,
  type SettingsDoc,
  type TimeOfDay,
} from '@/services/profile/types';

/** Pure rules of the onboarding flow: order, where the user may go, what each step needs. */

/** At most this many goals. */
export const GOALS_MAX = 2;
/** The croc's name: 1 to 20 characters once trimmed, counted in code points (emoji count once). */
export const CROC_NAME_MAX = 20;
/** Granted once when onboarding is done (the server ledger pays it; see the shared rules). */
export { ONBOARDING_POINTS } from '@/services/gamification/shared/rules';
/** Default reminder times for the two kinds of people. */
export const REMINDER_TIMES: Record<TimeOfDay, string> = { morning: '08:00', evening: '20:30' };

/** The steps a user walks through (everything but the terminal `done`). */
export const WALK_STEPS: readonly OnboardingStep[] = ONBOARDING_STEPS.filter((s) => s !== 'done');

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepIndex(step) + 1] ?? null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepIndex(step) - 1] ?? null;
}

export function stepHref(step: OnboardingStep): string {
  const slug: Record<OnboardingStep, string> = {
    goals: 'goals',
    experience: 'experience',
    safety: 'safety',
    consent: 'consent',
    hatch: 'hatch',
    firstSession: 'first-session',
    reminder: 'reminder',
    done: 'done',
  };
  return `/onboarding/${slug[step]}`;
}

export const CROC_NAME_PROBLEM_COPY: Record<'blank' | 'long', CopyKey> = {
  blank: 'onboarding.hatch.nameBlank',
  long: 'onboarding.hatch.nameLong',
};

/** Trims and checks the croc's name. */
export function checkCrocName(
  raw: string,
): { ok: true; name: string } | { ok: false; problem: 'blank' | 'long' } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return { ok: false, problem: 'blank' };
  if ([...name].length > CROC_NAME_MAX || /[\u0000-\u001f\u007f]/.test(name)) {
    return { ok: false, problem: 'long' };
  }
  return { ok: true, name };
}

/** Toggles a goal; a third pick is refused (the caller shows why). */
export function toggleGoal(goals: Goal[], goal: Goal): { goals: Goal[]; refused: boolean } {
  if (goals.includes(goal)) return { goals: goals.filter((g) => g !== goal), refused: false };
  if (goals.length >= GOALS_MAX) return { goals, refused: true };
  return { goals: [...goals, goal], refused: false };
}

export function safetyAnswered(doc: OnboardingDoc): boolean {
  return (
    doc.safety.answers.length === SAFETY_QUESTION_COUNT &&
    doc.safety.answers.every((a) => a !== null)
  );
}

/** Any "yes" puts the app in caution mode (content is limited; nothing alarming is shown). */
export function cautionMode(answers: (boolean | null)[]): boolean {
  return answers.some((a) => a === true);
}

/** Whether the step's own requirements are met, so Continue is enabled. */
export function stepComplete(step: OnboardingStep, doc: OnboardingDoc): boolean {
  switch (step) {
    case 'goals':
      return doc.goals.length >= 1 && doc.goals.length <= GOALS_MAX;
    case 'experience':
      return doc.experience !== null && doc.timeOfDay !== null && doc.sessionLength !== null;
    case 'safety':
      return safetyAnswered(doc) && (!cautionMode(doc.safety.answers) || doc.safety.acknowledged);
    case 'consent':
      return doc.moodConsent !== null;
    case 'hatch':
      return doc.crocHatched && doc.crocName !== null;
    case 'firstSession':
      return doc.firstSession.completed;
    case 'reminder':
      return doc.reminder !== null;
    case 'done':
      return doc.completed;
  }
}

/** The furthest step the answers allow: the first one whose predecessors are not all complete. */
export function furthestStep(doc: OnboardingDoc): OnboardingStep {
  for (const step of ONBOARDING_STEPS) {
    if (!stepComplete(step, doc)) return step;
  }
  return 'done';
}

/** A step can be shown when every step before it is complete (Back to earlier steps is always fine). */
export function isReachable(step: OnboardingStep, doc: OnboardingDoc): boolean {
  if (doc.completed) return false;
  return stepIndex(step) <= stepIndex(furthestStep(doc));
}

/** Where to resume: the saved step when still reachable, else the furthest allowed one. */
export function resumeStep(doc: OnboardingDoc): OnboardingStep {
  return isReachable(doc.step, doc) ? doc.step : furthestStep(doc);
}

/** 1-based position of a step among the walked steps, for the progress indicator. */
export function stepPosition(step: OnboardingStep): { index: number; total: number } {
  const index = step === 'done' ? WALK_STEPS.length : WALK_STEPS.indexOf(step) + 1;
  return { index, total: WALK_STEPS.length };
}

/** The first zone to recommend: the first goal, else the intro. */
export function recommendedZone(goals: Goal[]): Goal | 'intro' {
  return goals[0] ?? 'intro';
}

/** Settings that follow from the onboarding answers. Keeps what onboarding does not decide. */
export function deriveSettings(doc: OnboardingDoc, current: SettingsDoc): SettingsDoc {
  const timeOfDay = doc.timeOfDay;
  const reminderTime = timeOfDay ? REMINDER_TIMES[timeOfDay] : null;
  return {
    ...current,
    crocName: doc.crocName ?? current.crocName,
    goals: doc.goals,
    experience: doc.experience,
    sessionLength: doc.sessionLength ?? current.sessionLength,
    reminder: {
      enabled: doc.reminder === 'enabled',
      time: doc.reminder === 'enabled' ? reminderTime : (current.reminder.time ?? reminderTime),
      timeOfDay,
    },
    moodConsent: doc.moodConsent ?? false,
    safety: { answers: [...doc.safety.answers], cautionMode: cautionMode(doc.safety.answers) },
  };
}
