import React from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/copy';
import { Croc } from '@/illustration';
import { useProfile } from '@/services/profile';
import { palette, space } from '@/theme';
import { Chip, Text } from '@/ui';

import { WEEKLY_GOAL_DAYS, daysActiveThisWeek, placeholderPoints } from './stats';

/** The croc's avatar and name, the points chip and the weekly-goal chip. */
export function HomeHeader({ crocName }: { crocName: string }) {
  const points = useProfile((s) => placeholderPoints(s.onboarding, s.sessions));
  const days = useProfile((s) => daysActiveThisWeek(s.progress, Date.now()));
  return (
    <View style={styles.row}>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Croc
            stage="hatchling"
            pose="peek"
            water="inline"
            width={52}
            expression="happy"
            name={crocName}
            animated={false}
            relativeSize={false}
          />
        </View>
        <Text variant="subheading" numberOfLines={1} style={styles.name} testID="home-croc-name">
          {crocName}
        </Text>
      </View>
      <View style={styles.chips}>
        <Chip
          label={t('points.amount', { n: points })}
          tone="points"
          accessibilityLabel={t('a11y.points', { n: points })}
          testID="home-points"
        />
        <Chip
          label={t('goal.progress', { done: days, total: WEEKLY_GOAL_DAYS })}
          tone="goal"
          accessibilityLabel={t('a11y.weeklyGoal', { done: days, total: WEEKLY_GOAL_DAYS })}
          testID="home-weekly"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: palette.shallows,
    borderWidth: 2,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flexShrink: 1 },
  chips: { flexDirection: 'row', gap: space.xs, flexShrink: 0 },
});
