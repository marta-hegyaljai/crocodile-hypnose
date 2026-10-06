import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { t, type CopyKey } from '@/copy';
import { MoodPicker, wavePath } from '@/features/onboarding/MoodPicker';
import { useLoop } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import type { MoodValue } from '@/services/profile/types';
import type { PointsBreakdown } from '@/services/points/points';
import { palette, radius, space, useTheme, withAlpha } from '@/theme';
import { Button, Icon, Reveal, Text } from '@/ui';

/** The mood check before or after a session: five water states, skippable. */
export function MoodStep({
  title,
  value,
  onChange,
  onContinue,
  onSkip,
  before,
  testID,
}: {
  value: MoodValue | null;
  onChange: (value: MoodValue) => void;
  onContinue: () => void;
  onSkip: () => void;
  /** After the session: the mood before it, to show the change. */
  before?: MoodValue | null;
  title: string;
  testID: string;
}) {
  return (
    <View style={styles.gap} testID={testID}>
      <Text variant="heading" heading>
        {title}
      </Text>
      <Text variant="label" tone="secondary">
        {t('mood.question')}
      </Text>
      <MoodPicker value={value} onChange={onChange} testID={`${testID}-picker`} />
      {before && value ? <MoodChange from={before} to={value} /> : null}
      <Button
        label={t('session.moodContinue')}
        size="lg"
        fullWidth
        disabled={value === null}
        onPress={onContinue}
        testID={`${testID}-continue`}
      />
      <Button
        label={t('session.moodSkip')}
        variant="ghost"
        fullWidth
        onPress={onSkip}
        testID={`${testID}-skip`}
      />
    </View>
  );
}

/** Before → after as two little waters; the after one sways gently (still with reduced motion). */
function MoodChange({ from, to }: { from: MoodValue; to: MoodValue }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const sway = useLoop(!reduced, 2600, 0, 0.5);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (sway.value - 0.5) * 6 }],
  }));
  const label = t('session.moodChange', {
    from: t(`mood.labels.${from}` as CopyKey),
    to: t(`mood.labels.${to}` as CopyKey),
  });
  const water = (mood: MoodValue) => (
    <Svg width={60} height={40} viewBox="0 0 60 40" aria-hidden>
      <Path d={`${wavePath(mood)} L 58 38 L 2 38 Z`} fill={colors.water} opacity={0.35} />
      <Path
        d={wavePath(mood)}
        stroke={colors.water}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
  return (
    <View
      style={[styles.change, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
      accessible
      accessibilityLabel={label}
      testID="mood-change"
    >
      <View style={styles.changeRow}>
        {water(from)}
        <View style={styles.arrow}>
          <Icon name="back" size={20} color={colors.textSecondary} />
        </View>
        <Animated.View style={style}>{water(to)}</Animated.View>
      </View>
      <Text variant="caption" tone="secondary" align="center">
        {label}
      </Text>
    </View>
  );
}

/** Counts from 0 up to `target` (at once with reduced motion); `onDone` once it lands. */
export function useCountUp(target: number, durationMs = 1200, delayMs = 0): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(timer);
    }
    const start = Date.now() + delayMs;
    const timer = setInterval(() => {
      const k = Math.min(1, Math.max(0, (Date.now() - start) / durationMs));
      // Ease out: fast at first, settling on the number.
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [target, durationMs, delayMs, reduced]);
  return value;
}

/** The reward's beats (ms): the croc hops, lands with a splash, then the points pour in. */
export const REWARD = { hopUp: 380, hopDown: 300, settle: 220, count: 1500 } as const;
const REWARD_LAND = REWARD.hopUp + REWARD.hopDown;

/**
 * The croc's hop of joy on the reward screen: up out of the water and back down with a splash on
 * the UI thread. `offset` goes to the scene's `crocOffsetY`, `splash` to its `splash`. With reduced
 * motion there is no hop and the splash is the static ring.
 */
export function useRewardHop(active: boolean) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!active) {
      offset.value = 0;
      const reset = setTimeout(() => setLanded(false), 0);
      return () => clearTimeout(reset);
    }
    if (reduced) {
      const now = setTimeout(() => setLanded(true), 0);
      return () => clearTimeout(now);
    }
    offset.value = withSequence(
      withTiming(-48, { duration: REWARD.hopUp, easing: Easing.out(Easing.cubic) }),
      withTiming(8, { duration: REWARD.hopDown, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: REWARD.settle, easing: Easing.out(Easing.quad) }),
    );
    const timer = setTimeout(() => setLanded(true), REWARD_LAND - 40);
    return () => clearTimeout(timer);
  }, [active, reduced, offset]);
  return { offset, splash: active && landed };
}

/**
 * The reward: the loudest moment in the app. The points pour in big and amber once the croc has
 * landed, pop when they settle, then the first-time bonus and the way back to the river follow.
 */
export function RewardSheet({
  points,
  onContinue,
}: {
  points: PointsBreakdown;
  onContinue: () => void;
}) {
  const { colors, shadow } = useTheme();
  const reduced = useReducedMotion();
  const shown = useCountUp(points.total, REWARD.count, REWARD_LAND);
  const landed = shown >= points.total;
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!landed || reduced) return;
    pop.value = withSequence(
      withTiming(1.16, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 180 }),
    );
  }, [landed, reduced, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const stagger = reduced ? 0 : REWARD_LAND;
  return (
    <View style={styles.gap} testID="session-reward">
      <Reveal offset={12}>
        <Text variant="title" heading align="center">
          {t('session.rewardTitle')}
        </Text>
      </Reveal>
      <Reveal offset={16} delay={stagger * 0.5}>
        <Animated.View
          style={[
            styles.points,
            shadow.raised,
            { backgroundColor: colors.accentSoft, borderColor: withAlpha(palette.amber, 0.7) },
            popStyle,
          ]}
          accessible
          accessibilityLabel={t('a11y.points', { n: points.total })}
          testID="session-reward-points"
        >
          <Icon name="sparkle" size={22} color={palette.amber} />
          <View style={styles.pointsRow}>
            <Icon name="drop" size={34} color={palette.amberDeep} />
            <Text variant="display" style={styles.pointsText}>
              {t('points.gain', { n: shown })}
            </Text>
          </View>
          <Icon name="sparkle" size={22} color={palette.amber} />
        </Animated.View>
      </Reveal>
      {points.bonus > 0 ? (
        <Reveal offset={10} delay={stagger + REWARD.count * 0.6}>
          <View style={styles.bonusRow}>
            <View style={[styles.bonus, { backgroundColor: withAlpha(palette.amber, 0.18) }]}>
              <Icon name="sparkle" size={16} color={palette.amberText} />
              <Text
                variant="bodyStrong"
                color={palette.amberText}
                align="center"
                testID="session-reward-first"
              >
                {t('session.rewardFirstTime', { n: points.bonus })}
              </Text>
            </View>
          </View>
        </Reveal>
      ) : null}
      <Reveal offset={10} delay={stagger + REWARD.count * 0.6}>
        <Button
          label={t('session.rewardContinue')}
          size="lg"
          fullWidth
          onPress={onContinue}
          testID="session-reward-continue"
        />
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  change: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
    gap: space.xs,
    alignItems: 'center',
  },
  arrow: { transform: [{ scaleX: -1 }] },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  points: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pointsText: { fontSize: 44, lineHeight: 50 },
  bonusRow: { alignItems: 'center' },
  bonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: 999,
  },
});
