import { useEffect, useState } from 'react';

/** Eye-opening multiplier frames of one blink, with how long each is held (ms). */
const BLINK_FRAMES: readonly [number, number][] = [
  [0.5, 40],
  [0, 90],
  [0.5, 40],
  [1, 0],
];

export interface IdleBlinkOptions {
  enabled: boolean;
  /** Average pause between blinks in ms. */
  interval?: number;
  /** Deterministic jitter source (0..1) for tests; defaults to Math.random. */
  random?: () => number;
}

/**
 * Returns a 0..1 eye-opening multiplier that occasionally dips to 0 (a blink).
 * Nothing is scheduled while `enabled` is false (reduced motion, closed eyes, egg).
 */
export function useIdleBlink({
  enabled,
  interval = 3600,
  random = Math.random,
}: IdleBlinkOptions): number {
  const [blink, setBlink] = useState(1);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const playFrames = (index: number) => {
      if (cancelled) return;
      const frame = BLINK_FRAMES[index];
      if (!frame) {
        schedule();
        return;
      }
      setBlink(frame[0]);
      timer = setTimeout(() => playFrames(index + 1), frame[1]);
    };

    const schedule = () => {
      const wait = interval * (0.6 + random() * 0.8);
      timer = setTimeout(() => playFrames(0), wait);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // A blink interrupted mid-way (unmount, reduced motion switched on) must not leave the eye half shut.
      setBlink(1);
    };
  }, [enabled, interval, random]);

  return enabled ? blink : 1;
}
