import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import {
  Croc,
  FIGURE_H,
  FIGURE_TOP,
  FIGURE_W,
  GROUND_Y,
  Lagoon,
  fitPeekCroc,
  type CrocExpression,
} from '@/illustration';
import type { OnboardingStep } from '@/services/profile/types';
import { isSyncProblem, useProfile } from '@/services/profile';
import { radius, space, tapTarget, useTheme } from '@/theme';
import { Chip, IconButton, Notice, Reveal, Screen, Text } from '@/ui';

import { stepPosition } from './flow';
import { OnboardingMenu } from './OnboardingMenu';
import { RiverProgress } from './RiverProgress';

export type OnboardingHero = 'egg' | 'hatchling' | 'none';

export interface OnboardingScaffoldProps {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  subtitlePlaceholder?: boolean;
  /** Who sits in the scene: the egg on the bank (before hatching) or the hatchling in the river. */
  hero: OnboardingHero;
  expression: CrocExpression;
  crocName?: string;
  celebrating?: boolean;
  /** Animated vertical offset of the hatchling (positive sinks it under the water). */
  crocOffsetY?: SharedValue<number>;
  /** Back goes to the previous step; omit on the first step. */
  onBack?: () => void;
  backDisabled?: boolean;
  children: React.ReactNode;
  /** Pinned under the scrolling content: the step's buttons. */
  footer?: React.ReactNode;
  testID?: string;
}

/** Height of the back button row at the top of the scene (button plus its margins). */
const BACK_ROW = space.sm + tapTarget + space.sm;
/** The egg drawing's nest centre and ground, as fractions of its height. */
const EGG_ASPECT = (FIGURE_H - FIGURE_TOP) / FIGURE_W;
const NEST_CENTRE = (GROUND_Y + 2 - FIGURE_TOP) / (FIGURE_H - FIGURE_TOP);

/**
 * Layout for the onboarding steps: a band of riverbank on top with the croc (an egg in its nest
 * on the near bank until it hatches, then the hatchling in the water) reacting to the answers,
 * the stepping-stone progress on the edge of the sheet, and the step's content on the sheet with
 * its buttons pinned below. In landscape the sheet is a card on the left and the scene fills the
 * screen.
 */
export function OnboardingScaffold({
  step,
  title,
  subtitle,
  subtitlePlaceholder,
  hero,
  expression,
  crocName,
  celebrating = false,
  crocOffsetY,
  onBack,
  backDisabled = false,
  children,
  footer,
  testID,
}: OnboardingScaffoldProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const landscape = width > height && width >= 600;
  const short = height < 560;
  const { index, total } = stepPosition(step);
  const syncError = useProfile((s) => s.syncError);
  const syncProblem = isSyncProblem(syncError);

  // Portrait: the band is about 30% of the screen, smaller on short (keyboard) viewports.
  const bandHeight = landscape
    ? height
    : Math.round(Math.min(300, Math.max(short ? 150 : 196, height * 0.3))) + insets.top;
  const sceneWidth = width;

  let waterTop: number;
  let bankTop: number | undefined;
  let crocWidth: number;
  let crocX: number;
  if (hero === 'egg') {
    // Water in the middle distance; the egg sits on the near bank in front of it.
    waterTop = landscape ? 0.5 : 0.46;
    bankTop = landscape ? 0.8 : 0.74;
    crocWidth = 0;
    crocX = landscape ? 0.74 : 0.6;
  } else if (landscape) {
    waterTop = 0.52;
    crocWidth = Math.min(Math.round(width * 0.38), 400);
    crocX = 0.76;
  } else {
    const fit = fitPeekCroc({
      stage: 'hatchling',
      expression: 'calm',
      top: insets.top + (short ? space.sm : BACK_ROW),
      bottom: bandHeight - radius.xl - 6,
      maxWidth: Math.min(Math.round(width * 0.7), 380),
      minWidth: Math.min(Math.round(width * 0.45), short ? 120 : 160),
      margin: short ? 6 : 10,
      minWater: short ? 20 : 44,
    });
    crocWidth = fit.crocWidth;
    waterTop = fit.waterY / bandHeight;
    crocX = 0.56;
  }
  const leafSize = landscape
    ? Math.min(Math.round(width * 0.16), Math.round(height * 0.24))
    : Math.min(Math.round(width * 0.24), Math.round(bandHeight * 0.46));

  // The egg: the full egg drawing is mostly empty canvas, sized so the egg itself reads at
  // about 60 to 80 points; its nest is set on the bank.
  const eggWidth = landscape
    ? Math.min(560, Math.round(width * 0.6))
    : Math.min(480, Math.round(width * 1.15));
  const eggHeight = Math.round(eggWidth * EGG_ASPECT);
  const bankY = bankTop === undefined ? 0 : Math.round(bandHeight * bankTop);
  const eggLeft = Math.round(sceneWidth * crocX - eggWidth / 2);
  const eggTop = Math.round(bankY + (landscape ? 22 : 16) - eggHeight * NEST_CENTRE);

  const scene = (
    <View style={[styles.band, { width: sceneWidth, height: bandHeight }]} pointerEvents="none">
      <Lagoon
        width={sceneWidth}
        height={bandHeight}
        stage="hatchling"
        expression={expression}
        waterTop={waterTop}
        bankTop={bankTop}
        crocX={crocX}
        crocWidth={crocWidth || undefined}
        showCroc={hero === 'hatchling'}
        crocOffsetY={crocOffsetY}
        crocName={crocName}
        leafSize={leafSize}
        farReeds={!landscape}
        celebrate={celebrating}
        testID={testID ? `${testID}-scene` : undefined}
      />
      {hero === 'egg' && (
        <View style={[styles.egg, { left: eggLeft, top: eggTop }]}>
          <Croc
            stage="egg"
            expression={expression}
            width={eggWidth}
            relativeSize={false}
            groundShadow={false}
            testID={testID ? `${testID}-egg` : undefined}
          />
        </View>
      )}
    </View>
  );

  const topRow = (
    <View
      style={[
        styles.topRow,
        {
          top: insets.top + space.sm,
          left: insets.left + space.md,
          right: insets.right + space.md,
        },
      ]}
      pointerEvents="box-none"
    >
      {onBack ? (
        <IconButton
          icon="back"
          variant="filled"
          accessibilityLabel={t('a11y.back')}
          onPress={onBack}
          disabled={backDisabled}
          testID="onboarding-back"
        />
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.topRight}>
        <Chip
          label={t('onboarding.stepLabel', { index, total })}
          tone="neutral"
          style={[styles.stepChip, { backgroundColor: colors.surface }]}
          testID="onboarding-step-label"
        />
        <OnboardingMenu disabled={backDisabled} />
      </View>
    </View>
  );

  const Arrive = Platform.OS === 'web' ? Reveal : View;
  const sheet = (
    <Arrive style={styles.flex} offset={18}>
      <View
        style={[
          styles.sheet,
          theme.shadow.raised,
          { backgroundColor: colors.surface },
          landscape
            ? [styles.sheetFloating, { marginBottom: insets.bottom + space.md }]
            : styles.sheetResting,
        ]}
      >
        <View style={styles.progress}>
          <RiverProgress step={step} hatched={hero !== 'egg'} testID="onboarding-progress" />
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <View style={styles.header}>
              <Text variant="title" heading testID="onboarding-title">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="body" tone="secondary" placeholder={subtitlePlaceholder}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {syncProblem ? (
              <Notice
                tone="info"
                message={t('onboarding.syncProblem')}
                testID="onboarding-sync-problem"
              />
            ) : null}
            {children}
          </View>
        </ScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.border,
                paddingBottom: landscape ? space.lg : insets.bottom + space.lg,
              },
            ]}
          >
            <View style={styles.column}>{footer}</View>
          </View>
        ) : null}
      </View>
    </Arrive>
  );

  if (landscape) {
    return (
      <Screen scroll={false} padded={false} edges={[]} testID={testID} background={scene}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.landscapeColumn,
              {
                width: Math.min(480, Math.round(width * 0.52)),
                paddingLeft: insets.left + space.md,
                paddingTop: insets.top + BACK_ROW,
              },
            ]}
          >
            {sheet}
          </View>
        </KeyboardAvoidingView>
        {topRow}
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} edges={[]} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ height: bandHeight }}>{scene}</View>
        {sheet}
        {/* Last, so the menu panel stacks above the sheet. */}
        {topRow}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  band: { overflow: 'hidden' },
  egg: { position: 'absolute' },
  topRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
    elevation: 30,
  },
  backSpacer: { width: tapTarget, height: tapTarget },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepChip: { alignSelf: 'center' },
  sheet: { flex: 1, overflow: 'hidden' },
  sheetResting: {
    marginTop: -radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetFloating: { borderRadius: radius.xl },
  progress: { paddingHorizontal: space.xl, paddingTop: space.md },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: space.lg },
  header: { gap: space.xs },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  landscapeColumn: { flex: 1, paddingBottom: 0 },
});
