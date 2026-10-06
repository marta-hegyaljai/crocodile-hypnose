import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { StopStatus } from '@/content/journey';
import type { StopType } from '@/content/types';
import { useLoop } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { palette } from '@/theme';
import { FocusRing, noNativeOutline } from '@/ui/FocusRing';
import { Icon } from '@/ui/icons/Icon';
import { useFocusRing } from '@/ui/useFocusRing';
import { usePressDepth } from '@/ui/usePressDepth';

import { StopGlyph } from './StopGlyph';

export interface StopNodeProps {
  stopId: string;
  type: StopType;
  status: StopStatus;
  current: boolean;
  /** Centre in the map's coordinates. */
  x: number;
  y: number;
  size: number;
  accessibilityLabel: string;
  onPress: (stopId: string) => void;
  /** Just unlocked by a session: plays the unlock once. */
  unlocking?: boolean;
}

const LOOK: Record<StopStatus, { face: string; edge: string; ink: string; ring?: string }> = {
  done: { face: palette.amber, edge: palette.amberDeep, ink: palette.amberInk },
  available: {
    face: palette.white,
    edge: '#8DB9AC',
    ink: palette.crocGreen,
    ring: palette.crocGreen,
  },
  inProgress: { face: palette.white, edge: '#8DB9AC', ink: palette.crocGreen, ring: palette.amber },
  locked: { face: palette.mistDeep, edge: '#A3B5A8', ink: palette.mistTextMuted },
  // Not suggested (caution mode): a pale rose pebble with a dashed outline and a "skip" badge.
  caution: { face: palette.lilyMist, edge: '#C9A3AE', ink: '#8C6F77', ring: '#C98FA0' },
};

/** The pulse around the current stop: a soft ring that swells and fades (static with reduced motion). */
function Pulse({ size }: { size: number }) {
  const reduced = useReducedMotion();
  const loop = useLoop(!reduced, 1800);
  const style = useAnimatedStyle(() =>
    reduced
      ? { opacity: 0.45, transform: [{ scale: 1.22 }] }
      : { opacity: 0.55 * (1 - loop.value), transform: [{ scale: 1 + loop.value * 0.55 }] },
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.amber },
        style,
      ]}
    />
  );
}

/**
 * The unlock: the pebble pops up from small with a springy bounce and an amber ring spreads out
 * from it. Reduced motion: the ring shows still for a moment instead.
 */
function useUnlock(unlocking: boolean) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(unlocking ? 0 : 1);
  const ring = useSharedValue(unlocking ? 0 : 1);
  useEffect(() => {
    if (!unlocking) return;
    if (reduced) {
      pop.value = 1;
      ring.value = withSequence(
        withTiming(0.4, { duration: 0 }),
        withDelay(1800, withTiming(1, { duration: 0 })),
      );
      return;
    }
    pop.value = withDelay(450, withSpring(1, { damping: 7, stiffness: 160 }));
    ring.value = withDelay(
      500,
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
    );
  }, [unlocking, reduced, pop, ring]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.55 + pop.value * 0.45 }] }));
  const ringStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: ring.value < 1 ? 0.7 : 0, transform: [{ scale: 1.3 }] }
      : { opacity: (1 - ring.value) * 0.8, transform: [{ scale: 1 + ring.value * 1.2 }] },
  );
  return { popStyle, ringStyle };
}

/**
 * One stop on the river: a chunky round pebble that shows its state (done in amber with a
 * check, locked in mist with a lock, the long trance bigger and deep teal). Memoised: only a
 * node whose own props change re-renders.
 */
export const StopNode = memo(function StopNode({
  stopId,
  type,
  status,
  current,
  x,
  y,
  size,
  accessibilityLabel,
  onPress,
  unlocking = false,
}: StopNodeProps) {
  const focus = useFocusRing();
  const unlock = useUnlock(unlocking);
  const press = usePressDepth();
  const long = type === 'longTrance';
  const base = LOOK[status];
  const look =
    long && (status === 'available' || status === 'inProgress')
      ? { face: palette.tealDeep, edge: '#0D3A37', ink: palette.amberGlow, ring: palette.amber }
      : base;
  const edgeDepth = 5;
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.pressed.value * (edgeDepth - 1) }],
  }));
  const handlePress = () => onPress(stopId);

  const glyphSize = Math.round(size * (long ? 0.42 : 0.4));
  return (
    <View
      style={[
        styles.slot,
        { left: x - size / 2, top: y - size / 2, width: size, height: size + edgeDepth },
      ]}
    >
      {current ? <Pulse size={size} /> : null}
      {unlocking ? (
        <Animated.View
          pointerEvents="none"
          testID={`stop-${stopId}-unlocking`}
          style={[
            styles.pulse,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 4,
              borderColor: palette.amber,
            },
            unlock.ringStyle,
          ]}
        />
      ) : null}
      <Animated.View style={unlock.popStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={`stop-${stopId}`}
          style={[noNativeOutline, { width: size, height: size + edgeDepth }]}
        >
          <View
            style={[
              styles.edge,
              { width: size, height: size, borderRadius: size / 2, backgroundColor: look.edge },
            ]}
          />
          <Animated.View
            style={[
              styles.face,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: look.face,
                borderColor: look.ring ?? 'transparent',
                borderWidth: look.ring ? (current ? 4 : status === 'caution' ? 2 : 3) : 0,
                borderStyle: status === 'caution' ? 'dashed' : 'solid',
                opacity: status === 'caution' ? 0.92 : 1,
              },
              faceStyle,
            ]}
          >
            <View pointerEvents="none" style={[styles.gloss, { borderRadius: size / 2 }]} />
            {status === 'done' ? (
              <Icon name="check" size={Math.round(size * 0.46)} color={look.ink} strokeWidth={3} />
            ) : status === 'locked' ? (
              <Icon name="lock" size={Math.round(size * 0.38)} color={look.ink} />
            ) : (
              <StopGlyph type={type} size={glyphSize} color={look.ink} />
            )}
            {focus.focused ? <FocusRing radius={size / 2} /> : null}
          </Animated.View>
          {status === 'caution' ? (
            <View pointerEvents="none" style={styles.cautionBadge}>
              <Icon name="alert" size={13} color={palette.lilyInk} strokeWidth={2.4} />
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { position: 'absolute', alignItems: 'center' },
  pulse: { position: 'absolute', top: 0, left: 0 },
  edge: { position: 'absolute', top: 5, left: 0 },
  face: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  cautionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.white,
    borderWidth: 1.5,
    borderColor: '#C98FA0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gloss: {
    position: 'absolute',
    top: 4,
    left: '22%',
    width: '56%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
