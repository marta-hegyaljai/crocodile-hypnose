/** The device motion sensor on iOS and Android through expo-sensors. */
import { DeviceMotion } from 'expo-sensors';

import type { MotionSource } from './motionSourceTypes';

export type { MotionSource } from './motionSourceTypes';

export function subscribeMotion(onDelta: (deltaG: number) => void): MotionSource {
  let last: { x: number; y: number; z: number } | null = null;
  let sub: { remove(): void } | null = null;
  let stopped = false;

  const available = DeviceMotion.isAvailableAsync()
    .then(async (ok) => {
      if (!ok || stopped) return false;
      const perm = await DeviceMotion.requestPermissionsAsync().catch(() => ({ granted: true }));
      if (!perm.granted || stopped) return false;
      DeviceMotion.setUpdateInterval(100);
      sub = DeviceMotion.addListener((m) => {
        const a = m.accelerationIncludingGravity;
        if (!a) return;
        if (last) onDelta(Math.hypot(a.x - last.x, a.y - last.y, a.z - last.z) / 9.81);
        last = { x: a.x, y: a.y, z: a.z };
      });
      return true;
    })
    .catch(() => false);

  return {
    available,
    stop() {
      stopped = true;
      sub?.remove();
      sub = null;
    },
  };
}
