import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { useTapShield } from '@/features/layout/TapShield';
import type { CrocStage } from '@/illustration';
import { CelebrationBurst, Croc, Lagoon } from '@/illustration';
import { FIGURE_H, FIGURE_W, GROUND_Y } from '@/illustration/croc/geometry';
import { STAGE_SPECS } from '@/illustration/croc/specs';
import { decorative } from '@/illustration/scene/decorative';
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
import { palette, radius, space, useTheme, withAlpha } from '@/theme';
import { Button, Chip, Icon, IconButton, Reveal, Screen, Text } from '@/ui';

/** How long the croc stays at its old size before it grows (ms). */
const GROW_AFTER = 900;
/** How long the weekly goal card stays before it goes by itself (ms). */
export const WEEKLY_TOAST_MS = 8000;
/** The sheet's rough height, to leave the croc room above it before layout settles (pt). */
const SHEET_GUESS = 300;
const STAGES: readonly CrocStage[] = ['hatchling', 'juvenile', 'adult', 'grand'];
const figureScale = (stage: CrocStage) =>
  stage === 'egg' ? STAGE_SPECS.hatchling.figureScale : STAGE_SPECS[stage].figureScale;

/** The four stages as a track: done ones filled, the new one big and amber. */
function StageTrack({ from, to }: { from: CrocStage; to: CrocStage }) {
  const reached = STAGES.indexOf(to);
  return (
    <View style={styles.track} {...decorative}>
      {STAGES.map((stage, i) => {
        const done = i <= reached;
        const isNew = stage === to;
        const was = stage === from;
        return (
          <React.Fragment key={stage}>
            {i > 0 ? (
              <View
                style={[
                  styles.trackLine,
                  { backgroundColor: done ? palette.amber : withAlpha(palette.crocGreen, 0.25) },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.trackDot,
                isNew && styles.trackDotNew,
                {
                  backgroundColor: done ? palette.amber : palette.white,
                  borderColor: done ? palette.amberDeep : withAlpha(palette.crocGreen, 0.35),
                },
              ]}
            >
              {isNew ? (
                <Icon name="sparkle" size={14} color={palette.amberText} />
              ) : done ? (
                <Icon name="check" size={12} color={palette.amberText} />
              ) : null}
              {was && !isNew ? <View style={styles.trackWas} /> : null}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/**
 * The full-screen growth moment: the croc, full body on the near bank, at its old size for a
 * beat, then it grows into its new stage with a pop, a burst and a splash of petals, while the
 * stage track above fills to the new stage. With reduced motion it is shown grown at once.
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { shadow, colors } = useTheme();
  const [grown, setGrown] = useState(reduced);
  const [sheetTop, setSheetTop] = useState<number | null>(null);
  const grow = useSharedValue(reduced ? 1 : 0);
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
  useEffect(() => {
    if (!grown) return;
    grow.value = reduced
      ? 1
      : withSequence(
          withTiming(1.12, { duration: 420, easing: Easing.out(Easing.cubic) }),
          withSpring(1, { damping: 8, stiffness: 160 }),
        );
  }, [grown, reduced, grow]);

  const landscape = width > height;
  const sheetY = sheetTop ?? height - SHEET_GUESS - insets.bottom;
  // The croc, big, stands on the near bank in the middle of the free band above the sheet; the
  // water and the far jungle sit behind it.
  const crocWidth = Math.min(Math.round(width * (landscape ? 0.6 : 1.25)), 640);
  const crocHeight = Math.round((crocWidth * FIGURE_H) / FIGURE_W);
  const bankTop = landscape
    ? 0.62
    : Math.min(0.7, Math.max(0.4, (sheetY - crocHeight * 0.95) / height));
  const groundY = Math.round(height * bankTop) + Math.round(crocHeight * 0.6);
  const crocLeft = landscape ? Math.round(width * 0.72 - crocWidth / 2) : (width - crocWidth) / 2;
  const crocTop = groundY - Math.round((crocHeight * GROUND_Y) / FIGURE_H);
  const ratio = figureScale(from) / figureScale(to);

  const fromStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, grow.value * 3),
  }));
  const toStyle = useAnimatedStyle(() => {
    const s = ratio + (1 - ratio) * Math.min(1.12, grow.value);
    const pivot = (crocHeight * GROUND_Y) / FIGURE_H - crocHeight / 2;
    return {
      opacity: Math.min(1, grow.value * 3),
      transform: [{ translateY: pivot }, { scale: s }, { translateY: -pivot }],
    };
  });
  const stageName = t(`croc.stages.${to}`);
  const burstX = crocLeft + crocWidth / 2;
  const burstY = crocTop + crocHeight * 0.45;
  const burstR = Math.round(Math.min(width, 520) * 0.42);
  return (
    <Modal
      visible
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onDone}
      statusBarTranslucent
    >
      <Screen
        scroll={false}
        padded={false}
        edges={[]}
        testID="growth-moment"
        background={
          <Lagoon
            width={width}
            height={height}
            stage={to}
            waterTop={Math.max(0.26, bankTop - 0.24)}
            bankTop={bankTop}
            showCroc={false}
            farReeds={!landscape}
            leafSize={Math.min(Math.round(width * 0.24), Math.round(height * 0.16))}
          />
        }
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none" {...decorative}>
          <Animated.View style={[styles.croc, { left: crocLeft, top: crocTop }, fromStyle]}>
            <Croc stage={from} pose="full" expression="calm" width={crocWidth} animated={false} />
          </Animated.View>
          <Animated.View style={[styles.croc, { left: crocLeft, top: crocTop }, toStyle]}>
            <Croc
              stage={to}
              pose="full"
              expression="proud"
              width={crocWidth}
              animated={grown}
              name={crocName}
            />
          </Animated.View>
          <CelebrationBurst active={grown} x={burstX} y={burstY} radius={burstR} />
        </View>
        <View style={styles.flex} pointerEvents="box-none">
          <View style={styles.flex} />
          <Reveal offset={18} onLayout={(e) => setSheetTop(e.nativeEvent.layout.y)}>
            <View
              style={[
                styles.sheet,
                shadow.raised,
                {
                  backgroundColor: colors.surface,
                  paddingBottom: insets.bottom + space.xl,
                },
                landscape && { maxWidth: 480, marginLeft: insets.left + space.md },
              ]}
            >
              <StageTrack from={from} to={to} />
              <View style={styles.stageRow}>
                <Chip label={t(`croc.stages.${from}`)} tone="neutral" placeholder />
                <Icon name="play" size={14} color={colors.textSecondary} />
                <Chip label={stageName} tone="celebrate" placeholder testID="growth-stage" />
              </View>
              <Text variant="title" heading align="center" placeholder>
                {t('gamification.growth.title')}
              </Text>
              <Text variant="body" tone="secondary" align="center" placeholder>
                {t('gamification.growth.message', { name: crocName, stage: stageName })}
              </Text>
              <Button
                label={t('gamification.growth.continue')}
                size="lg"
                onPress={onDone}
                fullWidth
                testID="growth-continue"
              />
            </View>
          </Reveal>
        </View>
      </Screen>
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
  // A small celebration, not a notice to dismiss: it leaves by itself.
  useEffect(() => {
    const timer = setTimeout(onClose, WEEKLY_TOAST_MS);
    return () => clearTimeout(timer);
  }, [onClose]);
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
  const shield = useTapShield();
  const stage = useGrowthStage();
  const now = useNow();
  const { days, target, reached } = useWeeklyGoal();
  const settled = store.summaryKnown && store.goalSettled;
  const growTo = settled ? growthToShow(stage, store.goal.seenStage) : null;
  const week = currentWeek(now, store.goal.timeZone ?? deviceTimeZone());
  const weekDue =
    settled && reached && (store.goal.celebratedWeek === null || store.goal.celebratedWeek < week);
  // The week is marked celebrated the moment the card appears (so a reload does not bring it
  // back); the card itself is held here until it is dismissed or times out.
  const [toastWeek, setToastWeek] = useState<number | null>(null);
  const markWeek = store.markWeekCelebrated;
  useEffect(() => {
    // Leaving the tab drops the card; arriving with the goal newly reached shows it.
    if (!active) {
      const drop = setTimeout(() => setToastWeek(null), 0);
      return () => clearTimeout(drop);
    }
    if (growTo || !weekDue) return;
    const show = setTimeout(() => {
      setToastWeek(week);
      void markWeek(week);
    }, 0);
    return () => clearTimeout(show);
  }, [active, growTo, weekDue, week, markWeek]);
  const closeToast = useCallback(() => setToastWeek(null), []);

  if (!active) return null;
  if (growTo) {
    return (
      <GrowthMoment
        key={growTo}
        from={store.goal.seenStage}
        to={growTo}
        crocName={crocName}
        onDone={() => {
          // The tab bar sits under this moment's button: swallow the rest of a double tap.
          shield();
          void store.markStageSeen(growTo);
        }}
      />
    );
  }
  if (toastWeek === week) {
    return <WeeklyReached done={Math.min(days, target)} total={target} onClose={closeToast} />;
  }
  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  croc: { position: 'absolute' },
  sheet: {
    gap: space.md,
    alignItems: 'center',
    marginTop: space.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.lg,
    paddingHorizontal: space.xl,
    width: '100%',
  },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  track: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.xxs },
  trackLine: { width: 28, height: 4, borderRadius: 2 },
  trackDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackDotNew: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  trackWas: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.amberText,
  },
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
