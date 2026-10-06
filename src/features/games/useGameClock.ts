import { useEffect, useRef, useState } from 'react';
import {
  runOnJS,
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';

import { timeScale } from './clock';

export interface GameClock {
  /** Milliseconds of play so far, advancing on the UI thread while running (paused time excluded). */
  timeMs: SharedValue<number>;
}

/**
 * The game's clock: a shared value that advances every frame while `running`, so the scene can
 * draw straight from it at 60 fps, and `onTick` on the JS thread a few times a second for the
 * game's phase logic. Honours the dev time scale (e2e fast-forward).
 */
export function useGameClock(running: boolean, onTick?: (timeMs: number) => void): GameClock {
  const timeMs = useSharedValue(0);
  const tick = useRef(onTick);
  useEffect(() => {
    tick.current = onTick;
  });

  // One callback for the component's whole life: Reanimated re-registers the frame callback
  // whenever its identity changes, and a re-registration restarts its clock.
  const [onFrame] = useState(() => {
    const scale = timeScale();
    return (info: FrameInfo) => {
      // Runs on the UI thread on iOS/Android: without this directive the callback is a plain JS
      // function, and Reanimated never calls it (useGameClock.test.tsx guards this).
      'worklet';
      if (info.timeSincePreviousFrame === null) return;
      // A long gap (tab in the background) is not play time: cap a frame at a quarter second.
      const dt = Math.min(info.timeSincePreviousFrame, 250);
      timeMs.value += dt * scale;
    };
  });
  const frame = useFrameCallback(onFrame, false);

  useEffect(() => {
    frame.setActive(running);
  }, [running, frame]);

  // The phase logic needs the time on the JS thread, but not every frame.
  const [report] = useState(() => (t: number) => tick.current?.(t));
  useAnimatedReaction(
    () => Math.floor(timeMs.value / 100),
    (slot, previous) => {
      if (slot !== previous) runOnJS(report)(timeMs.value);
    },
    [],
  );

  return { timeMs };
}
