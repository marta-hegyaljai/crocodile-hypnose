import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * A 0..1 value that loops forever on the UI thread (linear, restarting at 0), or stays at `restValue`
 * when `enabled` is false (reduced motion). `delay` staggers instances.
 */
export function useLoop(
  enabled: boolean,
  duration: number,
  delay = 0,
  restValue = 0,
): SharedValue<number> {
  const value = useSharedValue(restValue);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value);
      value.value = restValue;
      return;
    }
    value.value = 0;
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(value);
  }, [enabled, duration, delay, restValue, value]);
  return value;
}

/** A 0..1..0 breathing value (sine ease), or `restValue` when disabled. */
export function useBreath(
  enabled: boolean,
  duration: number,
  delay = 0,
  restValue = 0.5,
): SharedValue<number> {
  const value = useSharedValue(restValue);
  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value);
      value.value = restValue;
      return;
    }
    value.value = 0;
    value.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(value);
  }, [enabled, duration, delay, restValue, value]);
  return value;
}
