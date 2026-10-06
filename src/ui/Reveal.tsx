import React, { useEffect } from 'react';
import { type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/motion/MotionProvider';
import { useTheme } from '@/theme';

export interface RevealProps {
  children: React.ReactNode;
  /** Pixels the content rises while fading in. */
  offset?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  onLayout?: ViewProps['onLayout'];
  testID?: string;
}

/**
 * Fades and lifts its content in when it mounts: messages, notices and blocks that appear in
 * response to something the user did, so they are noticed without a jump cut. Instant under
 * reduced motion.
 */
export function Reveal({ children, offset = 8, delay = 0, style, onLayout, testID }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const { motion } = useTheme();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.base, easing: Easing.out(Easing.cubic) }),
    );
  }, [reducedMotion, delay, motion.base, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offset }],
  }));

  return (
    <Animated.View style={[style, animated]} onLayout={onLayout} testID={testID}>
      {children}
    </Animated.View>
  );
}
