import { Redirect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import {
  CROC_NAME_MAX,
  checkCrocName,
  crocNameProblemText,
  stepPosition,
} from '@/features/onboarding/flow';
import { HATCH_DURATION_MS, HATCH_TAPS, HatchingEgg } from '@/features/onboarding/HatchingEgg';
import { OnboardingMenu } from '@/features/onboarding/OnboardingMenu';
import { RiverProgress } from '@/features/onboarding/RiverProgress';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { Lagoon, type CrocExpression } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { useFeedback } from '@/services/feedback';
import { radius, space, tapTarget, useTheme } from '@/theme';
import { Button, Chip, IconButton, Reveal, Screen, Text, TextField } from '@/ui';

/** Two taps closer together than this count as one (a bounce, not a second tap). */
const TAP_GAP_MS = 120;
const BACK_ROW = space.sm + tapTarget + space.sm;

/**
 * Step 5: the hatching moment. Tap the egg three times; it cracks, bursts and the hatchling pops
 * out and looks around. Then the croc is named. Revisited after hatching, the hatchling is simply
 * there with its name.
 */
export default function HatchScreen() {
  const { doc, redirect } = useStepScreen('hatch');
  const { update, advance, back } = useOnboardingActions();
  const feedback = useFeedback();
  const theme = useTheme();
  const { colors } = theme;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const landscape = width > height && width >= 600;

  const alreadyHatched = doc.crocHatched;
  const [taps, setTaps] = useState(alreadyHatched ? HATCH_TAPS : 0);
  const [animateHatch, setAnimateHatch] = useState(false);
  const [settled, setSettled] = useState(alreadyHatched);
  const [expression, setExpression] = useState<CrocExpression>(
    alreadyHatched ? 'happy' : 'excited',
  );
  const [name, setName] = useState(doc.crocName ?? t('croc.defaultName'));
  const [nameError, setNameError] = useState<string | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const lastTap = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hatched = taps >= HATCH_TAPS || alreadyHatched;

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  // Scene: the camera is close to the bank and the nest sits just under the centre of the frame,
  // the title in the sky right above it, so the hatchling is the hero the moment it is out. When
  // the name sheet rises, the whole scene slides up so the hatchling stays in view above it
  // (portrait).
  const heroWidth = landscape ? Math.min(Math.round(width * 0.46), 460) : Math.min(width, 480);
  const heroHeight = Math.round(heroWidth * 0.74);
  const groundY = Math.round(height * (landscape ? 0.78 : 0.64));
  const heroTop = groundY - Math.round(heroHeight * 0.84);
  const heroLeft = Math.round(width * (landscape ? 0.72 : 0.5) - heroWidth / 2);
  // The scene is drawn taller than the screen so the slide never shows its bottom edge.
  const sceneHeight = height + Math.round(height * 0.4);
  const bankY = groundY - Math.round(heroHeight * 0.2);
  const bankTop = Math.min(0.85, Math.max(0.2, bankY / sceneHeight));
  const waterTop = Math.max(0.12, (bankY - Math.round(height * 0.2)) / sceneHeight);
  const leafSize = Math.min(Math.round(width * 0.22), Math.round(height * 0.16));
  // The title floats in the sky between the top row and the horizon.
  const skyTop = insets.top + BACK_ROW;
  const skyHeight = Math.max(0, Math.round(waterTop * sceneHeight) - skyTop - space.sm);
  const shiftTarget =
    !landscape && settled && sheetHeight > 0
      ? Math.max(0, groundY + 8 - (height - sheetHeight))
      : 0;

  const shift = useSharedValue(0);
  useEffect(() => {
    shift.value = reducedMotion
      ? shiftTarget
      : withTiming(shiftTarget, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [shiftTarget, reducedMotion, shift]);
  const cameraStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -shift.value }] }));

  if (redirect) return <Redirect href={redirect} />;

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const onTap = () => {
    if (hatched) return;
    const now = Date.now();
    if (now - lastTap.current < TAP_GAP_MS) return;
    lastTap.current = now;
    const next = taps + 1;
    setTaps(next);
    if (next < HATCH_TAPS) {
      feedback.haptic('tap');
      feedback.sound('tap');
      return;
    }
    // The hatch.
    setAnimateHatch(true);
    feedback.haptic('success');
    feedback.sound('hatch');
    void update((d) => ({ ...d, crocHatched: true }));
    // The hatchling's first look around: excited, then pleased, then a calm blink, then happy.
    later(900, () => setExpression('happy'));
    later(1500, () => setExpression('calm'));
    later(2200, () => setExpression('happy'));
    later(HATCH_DURATION_MS, () => setSettled(true));
  };

  const onContinue = () => {
    const result = checkCrocName(name);
    if (!result.ok) {
      setNameError(crocNameProblemText(result.problem));
      return;
    }
    setNameError(null);
    feedback.haptic('select');
    void update((d) => ({ ...d, crocHatched: true, crocName: result.name }));
    advance('hatch');
  };

  const { index, total } = stepPosition('hatch');
  const remaining = HATCH_TAPS - taps;
  const hint =
    taps === 0
      ? t('onboarding.hatch.tapHint', { n: HATCH_TAPS })
      : remaining === 1
        ? t('onboarding.hatch.tapHintOne')
        : t('onboarding.hatch.tapHintMore', { n: remaining });

  const sheet = (
    <Reveal
      offset={24}
      style={landscape ? styles.sheetFloatingWrap : undefined}
      testID="hatch-name-sheet"
    >
      <View
        style={[
          styles.sheet,
          theme.shadow.raised,
          { backgroundColor: colors.surface },
          landscape
            ? [styles.sheetFloating, { marginBottom: insets.bottom + space.md }]
            : [styles.sheetResting, { paddingBottom: insets.bottom + space.lg }],
        ]}
      >
        <View style={styles.column}>
          <RiverProgress step="hatch" hatched testID="onboarding-progress" />
          <View style={styles.header}>
            <Text variant="title" heading testID="onboarding-title">
              {t('onboarding.hatch.nameTitle')}
            </Text>
          </View>
          <TextField
            label={t('onboarding.hatch.nameLabel')}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setNameError(null);
            }}
            error={nameError}
            hint={t('onboarding.hatch.nameHint', { n: CROC_NAME_MAX })}
            maxLength={CROC_NAME_MAX * 2}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onContinue}
            testID="croc-name"
          />
          <Button
            label={t('common.continue')}
            size="lg"
            fullWidth
            onPress={onContinue}
            testID="onboarding-continue"
          />
        </View>
      </View>
    </Reveal>
  );

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={[]}
      testID="onboarding-hatch"
      background={
        <Animated.View style={[styles.camera, cameraStyle]}>
          <Lagoon
            width={width}
            height={sceneHeight}
            showCroc={false}
            waterTop={waterTop}
            bankTop={bankTop}
            crocX={landscape ? 0.72 : 0.5}
            leafSize={leafSize}
            farReeds={!landscape}
          />
        </Animated.View>
      }
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* The egg in its nest on the bank, moving with the scene. */}
        <Animated.View
          style={[styles.hero, { left: heroLeft, top: heroTop }, cameraStyle]}
          pointerEvents="box-none"
        >
          <HatchingEgg
            taps={taps}
            hatched={hatched}
            animateHatch={animateHatch}
            expression={expression}
            name={doc.crocName ?? undefined}
            onTap={onTap}
            width={heroWidth}
            testID="hatch"
          />
        </Animated.View>

        {/* Title and tap hint, centred in the sky above the nest. */}
        <View
          style={[
            styles.sky,
            {
              top: skyTop,
              height: landscape ? undefined : skyHeight,
              paddingLeft: insets.left + space.xl,
              paddingRight: insets.right + space.xl,
            },
            landscape && styles.skyLandscape,
          ]}
          pointerEvents="none"
        >
          {!hatched && (
            <Text
              variant="title"
              heading
              align={landscape ? 'left' : 'center'}
              testID="onboarding-title"
            >
              {t('onboarding.hatch.title')}
            </Text>
          )}
          {!hatched ? (
            <Text
              variant="subheading"
              tone="secondary"
              align={landscape ? 'left' : 'center'}
              accessibilityLiveRegion="polite"
              testID="hatch-hint"
            >
              {hint}
            </Text>
          ) : (
            <Reveal offset={-8}>
              <Chip
                label={t('onboarding.hatch.hatched')}
                tone="celebrate"
                style={styles.hatchedChip}
                testID="hatch-done"
              />
            </Reveal>
          )}
        </View>

        {settled ? (
          landscape ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={[
                styles.landscapeScroll,
                {
                  width: Math.min(480, Math.round(width * 0.52)),
                  paddingLeft: insets.left + space.md,
                  paddingTop: insets.top + BACK_ROW,
                },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {sheet}
            </ScrollView>
          ) : (
            <View
              style={styles.bottom}
              onLayout={(e) => setSheetHeight(Math.round(e.nativeEvent.layout.height))}
            >
              {sheet}
            </View>
          )
        ) : null}
        {/* Last, so the menu panel stacks above the name sheet. */}
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
          <IconButton
            icon="back"
            variant="filled"
            accessibilityLabel={t('a11y.back')}
            onPress={() => back('hatch')}
            testID="onboarding-back"
          />
          <View style={styles.topRight}>
            <Chip
              label={t('onboarding.stepLabel', { index, total })}
              tone="neutral"
              style={[styles.stepChip, { backgroundColor: colors.surface }]}
              testID="onboarding-step-label"
            />
            <OnboardingMenu />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { position: 'absolute' },
  sky: {
    position: 'absolute',
    left: 0,
    right: 0,
    gap: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skyLandscape: { alignItems: 'flex-start', width: '50%' },
  hatchedChip: { alignSelf: 'center' },
  topRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
    elevation: 30,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  camera: { position: 'absolute', left: 0, top: 0, right: 0 },
  stepChip: { alignSelf: 'center' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  landscapeScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheetFloatingWrap: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: { paddingTop: space.md, paddingHorizontal: space.xl },
  sheetResting: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetFloating: { borderRadius: radius.xl, paddingBottom: space.xl },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: space.lg },
  header: { gap: space.xs },
});
