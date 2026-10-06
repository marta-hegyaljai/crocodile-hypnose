import { useEffect, useSyncExternalStore } from 'react';

import type { Journey } from '@/content/journey';

/** Stops that a completion opened: locked before, playable after. */
export function newlyUnlocked(before: Journey, after: Journey): string[] {
  const opened: string[] = [];
  for (const [id, view] of after.byStopId) {
    const was = before.byStopId.get(id)?.status;
    if (was === 'locked' && (view.status === 'available' || view.status === 'inProgress')) {
      opened.push(id);
    }
  }
  return opened;
}

/**
 * The stops a session just unlocked, announced to the map so it plays the unlock animation when
 * the user returns. In memory only: a reload shows the map as it is.
 */
let announced: readonly string[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function announceUnlocked(stopIds: readonly string[]) {
  announced = stopIds;
  emit();
}

export function clearUnlocked() {
  if (announced.length === 0) return;
  announced = [];
  emit();
}

/** How long the map shows the unlock before it is forgotten. */
export const UNLOCK_SHOW_MS = 2600;

/** The announced stops; cleared after they have been shown once. */
export function useUnlocked(): readonly string[] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => announced,
    () => announced,
  );
  useEffect(() => {
    if (value.length === 0) return;
    const timer = setTimeout(clearUnlocked, UNLOCK_SHOW_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return value;
}
