import { AppState, Platform } from 'react-native';

/** Runs `fn` at most once per `minMs` (the first call goes through). */
export function throttle(fn: () => void, minMs: number, now: () => number = Date.now): () => void {
  let last = -Infinity;
  return () => {
    const at = now();
    if (at - last < minMs) return;
    last = at;
    fn();
  };
}

/**
 * Calls `onForeground` whenever the user comes back to the app: the native app becomes active, a
 * browser tab becomes visible again, or its window regains focus. Returns the unsubscribe function.
 * Several of these can fire for one return, so pass a throttled function.
 */
export function subscribeForeground(onForeground: () => void): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') onForeground();
  });
  const cleanups: (() => void)[] = [() => sub.remove()];
  if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined') {
    const onVisible = () => {
      if (document.visibilityState === 'visible') onForeground();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onForeground);
    cleanups.push(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onForeground);
    });
  }
  return () => cleanups.forEach((fn) => fn());
}

/** How often coming back to the app may ask the server for newer copies. */
export const REFETCH_MIN_MS = 60_000;
