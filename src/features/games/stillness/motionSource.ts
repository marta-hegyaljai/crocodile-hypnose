/**
 * The device motion sensor on the web: `devicemotion` events where the browser fires them (phones;
 * iOS asks for permission first). Desktop browsers have the API but never fire, so a source that
 * stays silent for a moment reports itself unavailable and the game falls back to touch.
 */
import type { MotionSource } from './motionSourceTypes';

export type { MotionSource } from './motionSourceTypes';

const SILENCE_MS = 1200;

export function subscribeMotion(onDelta: (deltaG: number) => void): MotionSource {
  let stopped = false;
  let heard = false;
  let last: { x: number; y: number; z: number } | null = null;
  const w = typeof window !== 'undefined' ? window : undefined;
  const Motion = w?.DeviceMotionEvent as
    | (typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> })
    | undefined;

  const listener = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    heard = true;
    if (last) {
      // Change of the acceleration vector since the last reading, in g.
      const d = Math.hypot(a.x - last.x, a.y - last.y, a.z - last.z) / 9.81;
      onDelta(d);
    }
    last = { x: a.x, y: a.y, z: a.z };
  };

  const available = new Promise<boolean>((resolve) => {
    if (!w || !Motion) {
      resolve(false);
      return;
    }
    const listen = () => {
      if (stopped) return resolve(false);
      w.addEventListener('devicemotion', listener);
      setTimeout(() => resolve(heard), SILENCE_MS);
    };
    if (typeof Motion.requestPermission === 'function') {
      Motion.requestPermission()
        .then((state) => (state === 'granted' ? listen() : resolve(false)))
        .catch(() => resolve(false));
    } else {
      listen();
    }
  });

  return {
    available,
    stop() {
      stopped = true;
      w?.removeEventListener('devicemotion', listener);
    },
  };
}
