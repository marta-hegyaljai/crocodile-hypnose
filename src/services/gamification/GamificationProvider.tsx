import React, { createContext, useContext, useEffect, useState } from 'react';
import { useStore } from 'zustand';

import { useProfile } from '@/services/profile';

import { appContentMeta, deviceTimeZone, pendingGains, weeklyDays } from './derive';
import type { GamificationState, GamificationStore } from './store';
import { stageForSeconds, type GrowthStage } from './shared/rules';

const GamificationContext = createContext<GamificationStore | null>(null);

/** Makes the gamification store available to screens. The app passes the singleton; tests theirs. */
export function GamificationProvider({
  store,
  children,
}: {
  store: GamificationStore;
  children: React.ReactNode;
}) {
  return <GamificationContext.Provider value={store}>{children}</GamificationContext.Provider>;
}

export function useGamificationStore(): GamificationStore {
  const store = useContext(GamificationContext);
  if (!store) throw new Error('useGamification must be used inside a GamificationProvider');
  return store;
}

export function useGamification<T>(selector: (state: GamificationState) => T): T {
  return useStore(useGamificationStore(), selector);
}

/** Points to show: the server's balance plus what offline events will probably add. */
export function usePoints(): { balance: number; pending: number; known: boolean } {
  const balance = useGamification((s) => s.summary.balance);
  const known = useGamification((s) => s.summaryKnown);
  const pending = useProfile((s) => pendingGains(s.sessions, appContentMeta).points);
  return { balance, pending, known };
}

/** The croc's growth stage now (calm time on the server plus what is on its way). */
export function useGrowthStage(): GrowthStage {
  const seconds = useGamification((s) => s.summary.calmSeconds);
  const pending = useProfile((s) => pendingGains(s.sessions, appContentMeta).seconds);
  return stageForSeconds(seconds + pending);
}

/** The time, updated every minute (week boundaries move while the app stays open). */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** Days this week with an activity, and the target. */
export function useWeeklyGoal(): {
  days: number;
  target: number;
  reached: boolean;
} {
  const now = useNow();
  const target = useGamification((s) => s.goal.weeklyTarget);
  const zone = useGamification((s) => s.goal.timeZone) ?? deviceTimeZone();
  const days = useProfile((s) => weeklyDays(s.sessions, now, zone));
  return { days, target, reached: days >= target };
}
