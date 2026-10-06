import { devMode } from '@/config/env';

/**
 * Test hook for the games' clocks: in dev builds, `globalThis.__mhpTimeScale` (e.g. 30) makes
 * every game run that many times faster, so e2e can play a two-minute game in seconds. Release
 * builds always run at 1.
 */
export function timeScale(): number {
  if (!devMode) return 1;
  const value = (globalThis as { __mhpTimeScale?: unknown }).__mhpTimeScale;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
}
