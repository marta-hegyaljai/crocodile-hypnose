import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/** The most one tick of a wall-clock timer may add: a timer that slept (background, throttling) must not jump. */
export const MAX_TICK_SEC = 1;

/** Seconds a tick adds: the wall time since the last tick, never negative, never more than `MAX_TICK_SEC`. */
export function tickSeconds(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(MAX_TICK_SEC, elapsedMs / 1000);
}

function visible(): boolean {
  if (Platform.OS === 'web' && typeof document !== 'undefined') return !document.hidden;
  return AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
}

/** False while the app is in the background (or the browser tab is hidden). */
export function useForeground(): boolean {
  const [foreground, setForeground] = useState(visible);
  useEffect(() => {
    const update = () => setForeground(visible());
    const sub = AppState.addEventListener('change', update);
    const web = Platform.OS === 'web' && typeof document !== 'undefined';
    if (web) document.addEventListener('visibilitychange', update);
    update();
    return () => {
      sub.remove();
      if (web) document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return foreground;
}
