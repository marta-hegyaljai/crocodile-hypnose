import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

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
  caution: { face: palette.mistLight, edge: '#B9C7BD', ink: palette.mistTextMuted },
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
}: StopNodeProps) {
  const focus = useFocusRing();
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
              borderWidth: look.ring ? (current ? 4 : 3) : 0,
              borderStyle: status === 'caution' ? 'dashed' : 'solid',
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
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { position: 'absolute', alignItems: 'center' },
  pulse: { position: 'absolute', top: 0, left: 0 },
  edge: { position: 'absolute', top: 5, left: 0 },
  face: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  gloss: {
    position: 'absolute',
    top: 4,
    left: '22%',
    width: '56%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
