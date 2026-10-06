import { useCallback } from 'react';
import { useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/motion/MotionProvider';
import { useTheme } from '@/theme';

/**
 * Shared press animation state for pressable controls: a 0..1 "pressed" value that
 * springs in the Daylight atmosphere and eases slowly in Night River. Reduced motion snaps.
 */
export function usePressDepth() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const spring = theme.motion.pressSpring;
  const fast = theme.motion.fast;

  const animateTo = useCallback(
    (value: number) => {
      pressed.set(
        reducedMotion
          ? withTiming(value, { duration: 0 })
          : value === 1
            ? withTiming(1, { duration: Math.min(fast, 90) })
            : withSpring(0, spring),
      );
    },
    [pressed, reducedMotion, spring, fast],
  );

  const onPressIn = useCallback(() => animateTo(1), [animateTo]);
  const onPressOut = useCallback(() => animateTo(0), [animateTo]);

  return { pressed, onPressIn, onPressOut };
}
