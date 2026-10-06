import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/copy';
import { Lagoon, fitPeekCroc, type CrocExpression } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { radius, space, tapTarget, useTheme } from '@/theme';
import { IconButton, Reveal, Screen, Text } from '@/ui';

export interface AuthScaffoldProps {
  title: string;
  subtitle?: string;
  subtitlePlaceholder?: boolean;
  expression: CrocExpression;
  children: React.ReactNode;
  /** Where Back goes when there is no history (deep link, reload). */
  fallbackHref?: '/welcome' | '/sign-in' | '/';
  /** A request is running: Back is disabled so the answer can't land on another screen. */
  busy?: boolean;
  testID?: string;
}

/** Height of the back button row at the top of the scene (button plus its margins). */
const BACK_ROW = space.sm + tapTarget + space.sm;

/**
 * Layout for the account forms: a band of river at the top with the croc peeking out (it reacts
 * to the form), and the form on a sheet that rests on the water like a riverbank.
 *
 * The river takes whatever the form leaves free (within limits), so a short form (forgot
 * password, a confirmation) gets a big scene instead of an empty sheet, and a long form gets a
 * compact band and scrolls. The croc is sized to the band. In landscape the form is a floating
 * card on the left and the croc swims on the right.
 */
export function AuthScaffold({
  title,
  subtitle,
  subtitlePlaceholder,
  expression,
  children,
  fallbackHref = '/welcome',
  busy = false,
  testID,
}: AuthScaffoldProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const landscape = width > height && width >= 600;

  // The sheet's natural height is measured once per window height (the form as it first shows),
  // so a message appearing later pushes the sheet, never the scene.
  const [sheetNatural, setSheetNatural] = useState<number | null>(null);
  const measuredFor = useRef<number | null>(null);
  const onColumnLayout = (columnHeight: number) => {
    if (measuredFor.current === height) return;
    measuredFor.current = height;
    setSheetNatural(columnHeight + space.xl + insets.bottom + space.xxl);
  };

  // Portrait: the band is at least a third of the screen (less when the viewport is keyboard-short)
  // and grows into what the sheet leaves free, up to 60% of the screen.
  const short = height < 560;
  const baseBand =
    Math.round(Math.min(300, Math.max(short ? 132 : 176, height * 0.3))) + insets.top;
  const maxBand = Math.round(height * 0.6);
  const freeBand = sheetNatural === null ? baseBand : height - sheetNatural + radius.xl;
  const bandHeight = Math.max(baseBand, Math.min(maxBand, freeBand));

  let crocWidth: number;
  let waterTop: number;
  let leafSize: number;
  let sceneHeight: number;
  if (landscape) {
    sceneHeight = height;
    crocWidth = Math.min(Math.round(width * 0.38), 400);
    waterTop = 0.52;
    leafSize = Math.min(Math.round(width * 0.16), Math.round(height * 0.24));
  } else {
    sceneHeight = bandHeight;
    // Sized with a fixed expression, so a change of mood never resizes the croc.
    // Keyboard-short viewports: the croc sits beside the back button (its head is right of it) and
    // keeps less water, so its eye still shows above the sheet.
    const fit = fitPeekCroc({
      stage: 'juvenile',
      expression: 'calm',
      top: insets.top + (short ? space.sm : BACK_ROW),
      bottom: bandHeight - radius.xl,
      maxWidth: Math.min(Math.round(width * 0.8), 440),
      minWidth: Math.min(Math.round(width * 0.5), short ? 120 : 176),
      margin: short ? 6 : 10,
      minWater: short ? 20 : 48,
    });
    crocWidth = fit.crocWidth;
    waterTop = fit.waterY / bandHeight;
    leafSize = Math.min(Math.round(width * 0.26), Math.round(bandHeight * 0.5));
  }

  const columnWidth = landscape ? Math.min(480, Math.round(width * 0.52)) : undefined;

  // The scene fades in once the band is composed (or straight away if layout never reports), so
  // the one-frame resize after the first measurement is never seen.
  const composed = landscape || sheetNatural !== null;
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 400);
    return () => clearTimeout(timer);
  }, []);
  const reducedMotion = useReducedMotion();
  const sceneOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const ready = composed || timedOut;
  useEffect(() => {
    if (!ready) return;
    sceneOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: theme.motion.base });
  }, [ready, reducedMotion, sceneOpacity, theme.motion.base]);
  const sceneStyle = useAnimatedStyle(() => ({ opacity: sceneOpacity.value }));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };

  const scene = (
    <Animated.View style={[styles.flex, sceneStyle]}>
      <Lagoon
        width={width}
        height={sceneHeight}
        stage="juvenile"
        expression={expression}
        waterTop={waterTop}
        crocX={landscape ? 0.76 : 0.56}
        crocWidth={crocWidth}
        leafSize={leafSize}
        farReeds={!landscape}
        testID="auth-scene"
      />
    </Animated.View>
  );

  const back = (
    <View style={[styles.back, { top: insets.top + space.sm, left: insets.left + space.md }]}>
      <IconButton
        icon="back"
        variant="filled"
        accessibilityLabel={t('a11y.back')}
        onPress={goBack}
        disabled={busy}
        testID="auth-back"
      />
    </View>
  );

  // Web has no screen transition: the sheet arrives on its own (native stacks animate the screen).
  const Arrive = Platform.OS === 'web' ? Reveal : View;
  const sheet = (
    <Arrive style={landscape ? undefined : styles.grow} offset={18}>
      <View
        style={[
          styles.sheet,
          theme.shadow.raised,
          { backgroundColor: colors.surface },
          landscape
            ? [styles.sheetFloating, { marginBottom: insets.bottom + space.md }]
            : [styles.sheetResting, { paddingBottom: insets.bottom + space.xxl }],
        ]}
      >
        <View style={styles.column} onLayout={(e) => onColumnLayout(e.nativeEvent.layout.height)}>
          <View style={styles.header}>
            <Text variant="title" heading testID="auth-title">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" tone="secondary" placeholder={subtitlePlaceholder}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {children}
        </View>
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
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scroll,
              styles.scrollLandscape,
              {
                width: columnWidth,
                paddingLeft: insets.left + space.md,
                paddingTop: insets.top + BACK_ROW,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {sheet}
          </ScrollView>
        </KeyboardAvoidingView>
        {back}
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} edges={[]} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height: bandHeight }}>
            {scene}
            {back}
          </View>
          {sheet}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  grow: { flexGrow: 1 },
  scrollLandscape: { justifyContent: 'flex-end' },
  back: { position: 'absolute' },
  sheet: {
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
  },
  // Portrait: the sheet rests on the water and runs to the bottom of the screen.
  sheetResting: {
    flexGrow: 1,
    marginTop: -radius.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  // Landscape: a card floating on the river, beside the croc.
  sheetFloating: {
    borderRadius: radius.xl,
    paddingBottom: space.xl,
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: space.lg },
  header: { gap: space.xs },
});
