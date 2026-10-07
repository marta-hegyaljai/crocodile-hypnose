import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { LagoonSheetScreen } from '@/features/layout/LagoonSheetScreen';
import { useRewardHop } from '@/features/session/SessionDay';
import type { CrocStage } from '@/illustration';
import { CelebrationBurst } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { useFeedback } from '@/services/feedback';
import {
  currentWeek,
  deviceTimeZone,
  growthToShow,
  useGamification,
  useGrowthStage,
  useNow,
  useWeeklyGoal,
} from '@/services/gamification';
import { palette, radius, space } from '@/theme';
import { Button, Chip, IconButton, Text } from '@/ui';

/** How long the croc stays at its old size before it grows (ms). */
const GROW_AFTER = 700;

/**
 * The full-screen growth moment: the croc at its old stage, then it grows with a burst and a
 * splash. With reduced motion it is shown grown at once, without the burst flying.
 */
export function GrowthMoment({
  from,
  to,
  crocName,
  onDone,
}: {
  from: CrocStage;
  to: CrocStage;
  crocName: string;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const feedback = useFeedback();
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setGrown(true);
        feedback.sound('hatch');
        feedback.haptic('success');
      },
      reduced ? 0 : GROW_AFTER,
    );
    return () => clearTimeout(timer);
  }, [reduced, feedback]);
  const hop = useRewardHop(grown);
  const stageName = t(`croc.stages.${to}`);
  return (
    <Modal
      visible
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onDone}
      statusBarTranslucent
    >
      <LagoonSheetScreen
        stage={grown ? to : from}
        expression={grown ? 'proud' : 'calm'}
        crocName={crocName}
        celebrating={grown}
        celebrationScale={1.6}
        crocOffsetY={hop.offset}
        splash={hop.splash}
        header={null}
        sheet={
          <View style={styles.sheet}>
            <Chip label={stageName} tone="celebrate" placeholder testID="growth-stage" />
            <Text variant="title" heading align="center" placeholder>
              {t('gamification.growth.title')}
            </Text>
            <Text variant="body" tone="secondary" align="center" placeholder>
              {t('gamification.growth.message', { name: crocName, stage: stageName })}
            </Text>
            <Button
              label={t('gamification.growth.continue')}
              onPress={onDone}
              fullWidth
              testID="growth-continue"
            />
          </View>
        }
        testID="growth-moment"
      />
    </Modal>
  );
}

/** A small, friendly card when this week's goal is reached (never anything when it is not). */
function WeeklyReached({
  done,
  total,
  onClose,
}: {
  done: number;
  total: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setBurst(true), 50);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View style={[styles.toastWrap, { bottom: insets.bottom + space.lg }]} pointerEvents="box-none">
      <View style={styles.toast} accessibilityRole="alert" testID="weekly-reached">
        <CelebrationBurst active={burst} x={44} y={30} radius={70} />
        <Chip label={t('goal.progress', { done, total })} tone="celebrate" />
        <View style={styles.toastText}>
          <Text variant="subheading" placeholder>
            {t('gamification.weekly.reachedTitle')}
          </Text>
          <Text variant="caption" tone="secondary" placeholder>
            {t('gamification.weekly.reachedMessage', { done, total })}
          </Text>
        </View>
        <IconButton
          icon="close"
          accessibilityLabel={t('gamification.weekly.dismiss')}
          onPress={onClose}
          testID="weekly-reached-close"
        />
      </View>
    </View>
  );
}

/**
 * Home's reward moments, decided from the server-confirmed numbers: the croc's growth (once per
 * stage, also when it was earned elsewhere or offline) and the weekly goal (once per week).
 * Only while home is the visible tab.
 */
export function HomeCelebrations({ crocName, active }: { crocName: string; active: boolean }) {
  const store = useGamification((s) => s);
  const stage = useGrowthStage();
  const now = useNow();
  const { days, target, reached } = useWeeklyGoal();
  const settled = store.summaryKnown && store.goalSettled;
  const growTo = settled ? growthToShow(stage, store.goal.seenStage) : null;
  const week = currentWeek(now, store.goal.timeZone ?? deviceTimeZone());
  const weekDue =
    settled && reached && (store.goal.celebratedWeek === null || store.goal.celebratedWeek < week);

  if (!active) return null;
  if (growTo) {
    return (
      <GrowthMoment
        key={growTo}
        from={store.goal.seenStage}
        to={growTo}
        crocName={crocName}
        onDone={() => {
          void store.markStageSeen(growTo);
        }}
      />
    );
  }
  if (weekDue) {
    return (
      <WeeklyReached
        done={Math.min(days, target)}
        total={target}
        onClose={() => void store.markWeekCelebrated(week)}
      />
    );
  }
  return null;
}

const styles = StyleSheet.create({
  sheet: { gap: space.md, alignItems: 'center' },
  toastWrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    alignItems: 'center',
    zIndex: 5,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
    maxWidth: 520,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: palette.amberGlow,
    borderWidth: 2,
    borderColor: palette.amber,
  },
  toastText: { flex: 1, gap: space.xxs },
});
