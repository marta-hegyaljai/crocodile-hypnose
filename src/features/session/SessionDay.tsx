import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { t, type CopyKey } from '@/copy';
import { MoodPicker, wavePath } from '@/features/onboarding/MoodPicker';
import { useLoop } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import type { MoodValue } from '@/services/profile/types';
import type { PointsBreakdown } from '@/services/points/points';
import { palette, radius, space, useTheme } from '@/theme';
import { Button, Icon, Text } from '@/ui';

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

/** Counts from 0 up to `target` (at once with reduced motion). */
export function useCountUp(target: number, durationMs = 1200): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(timer);
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / durationMs);
      // Ease out: fast at first, settling on the number.
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [target, durationMs, reduced]);
  return value;
}

/** The reward: the points counting up, the first-time bonus, and the way back to the river. */
export function RewardSheet({
  points,
  onContinue,
}: {
  points: PointsBreakdown;
  onContinue: () => void;
}) {
  const { colors } = useTheme();
  const shown = useCountUp(points.total);
  return (
    <View style={styles.gap} testID="session-reward">
      <Text variant="title" heading align="center">
        {t('session.rewardTitle')}
      </Text>
      <View
        style={[styles.points, { backgroundColor: colors.accentSoft }]}
        accessible
        accessibilityLabel={t('a11y.points', { n: points.total })}
        testID="session-reward-points"
      >
        <Icon name="drop" size={32} color={palette.amberDeep} />
        <Text variant="display">{t('points.gain', { n: shown })}</Text>
      </View>
      {points.bonus > 0 ? (
        <Text variant="bodyStrong" tone="secondary" align="center" testID="session-reward-first">
          {t('session.rewardFirstTime', { n: points.bonus })}
        </Text>
      ) : null}
      <Button
        label={t('session.rewardContinue')}
        size="lg"
        fullWidth
        onPress={onContinue}
        testID="session-reward-continue"
      />
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
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
  },
});
