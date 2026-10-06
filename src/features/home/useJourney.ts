import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import {
  deriveJourney,
  pickTodaysSession,
  type Journey,
  type TodaysSession,
} from '@/content/journey';
import { cautionMode as cautionFromAnswers } from '@/features/onboarding/flow';
import { localContent, type ContentRepository } from '@/content/repository';
import { useProfile, type ProfileState } from '@/services/profile';

/** The local hour, refreshed every few minutes and when the app comes back to the front. */
export function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    const timer = setInterval(update, 5 * 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') update();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return hour;
}

/**
 * Caution mode as the settings say, once they are known. Until then (a new device whose settings
 * have not arrived) it follows the onboarding answers, so the safety gate never fails open.
 */
export function effectiveCautionMode(
  s: Pick<ProfileState, 'settingsKnown' | 'settings' | 'onboarding'>,
): boolean {
  return s.settingsKnown
    ? s.settings.safety.cautionMode
    : cautionFromAnswers(s.onboarding.safety.answers);
}

/**
 * The user's journey along the river and today's session, derived from the content, the synced
 * progress, the goals and caution mode from onboarding, and the time of day.
 */
export function useJourney(content: ContentRepository = localContent): {
  journey: Journey;
  today: TodaysSession | null;
} {
  const progress = useProfile((s) => s.progress);
  const cautionMode = useProfile(effectiveCautionMode);
  const goals = useProfile((s) => s.settings.goals);
  const hour = useHour();
  const journey = useMemo(
    () => deriveJourney(content, progress, { cautionMode }),
    [content, progress, cautionMode],
  );
  const today = useMemo(
    () => pickTodaysSession(journey, { goals, hour, cautionMode }),
    [journey, goals, hour, cautionMode],
  );
  return { journey, today };
}
