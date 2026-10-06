import { Redirect } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { devMode } from '@/config/env';
import { t } from '@/copy';
import { MoodPicker } from '@/features/onboarding/MoodPicker';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { BreathingVisual } from '@/features/session/BreathingVisual';
import {
  formatClock,
  useTrack,
  useTrackStatus,
  type Track,
} from '@/features/session/useTrackPlayer';
import { EYE_STOPS, Lagoon, crocColors, useBreath } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { useFeedback } from '@/services/feedback';
import type { MoodValue } from '@/services/profile/types';
import { palette, radius, space, useTheme, withAlpha } from '@/theme';
import { Button, IconButton, ProgressBar, Reveal, Screen, Text } from '@/ui';

const TRACK = require('../../../assets/audio/first-session.mp3');
/** The placeholder track is 75 s; also the length of the silent fallback. */
const TRACK_SECONDS = 75;

/**
 * Timings of the signature transition (ms). Sink: the day fades into the night river, where the
 * hatchling floats eyes closed, then it dives under and the player settles in. Surface: the player
 * fades, the croc rises, and the day comes back over the river.
 */
export const SINK = { fade: 750, diveDelay: 450, croc: 1500, reveal: 700, total: 2050 } as const;
export const SURFACE = { ui: 300, croc: 1300, fade: 900, total: 2100 } as const;
const REDUCED_FADE = 320;

type Phase = 'intro' | 'sinking' | 'playing' | 'surfacing' | 'after';
type Outcome = 'finished' | 'ended';

/**
 * Step 6: the first short session. The whole screen fades into Night River, where the croc dives
 * under the water; a placeholder track plays with a breathing guide where it went under, then the
 * croc surfaces and the day comes back. The session counts as done the moment the track ends (a
 * reload never asks for a replay); the session can be ended early from inside the player. Mood
 * checks before and after only with consent. Step 5 replaces the player; the transition and the
 * shape of the flow stay.
 */
export default function FirstSessionScreen() {
  const { doc, redirect } = useStepScreen('firstSession');
  const { update, advance, back } = useOnboardingActions();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const feedback = useFeedback();
  const consent = doc.moodConsent === true;

  const [phase, setPhase] = useState<Phase>('intro');
  const [outcome, setOutcome] = useState<Outcome>('finished');
  const [endedEarly, setEndedEarly] = useState(false);
  const [moodBefore, setMoodBefore] = useState<MoodValue | null>(
    consent ? doc.firstSession.moodBefore : null,
  );
  const [moodAfter, setMoodAfter] = useState<MoodValue | null>(
    consent ? doc.firstSession.moodAfter : null,
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const phaseRef = useRef<Phase>('intro');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /** The day screen's opacity over the night river. */
  const day = useSharedValue(1);
  /** How far the night croc is under the water. */
  const sink = useSharedValue(0);
  /** The player's controls. */
  const ui = useSharedValue(0);
  // Deep enough for the whole hatchling to pass under the water.
  const depth = Math.round(Math.min(width, 440) * 0.5) + 40;

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const track = useTrack(TRACK, TRACK_SECONDS);

  /** The croc comes back up and the river brightens into day again. */
  const surface = (how: Outcome) => {
    if (phaseRef.current !== 'playing') return;
    track.pause();
    if (how === 'finished') {
      // Done the moment the track ends: closing the app on the next screen never asks for a replay.
      void update((d) => ({
        ...d,
        firstSession: {
          ...d.firstSession,
          completed: true,
          moodBefore: consent ? moodBefore : null,
        },
      }));
    }
    setOutcome(how);
    setPhase('surfacing');
    const settle = () => {
      setEndedEarly(how === 'ended');
      setPhase(how === 'finished' ? 'after' : 'intro');
      if (how === 'finished') feedback.haptic('success');
    };
    if (reducedMotion) {
      ui.value = withTiming(0, { duration: REDUCED_FADE });
      later(REDUCED_FADE + 20, () => {
        sink.value = 0;
        day.value = withTiming(1, { duration: REDUCED_FADE });
        later(REDUCED_FADE + 40, settle);
      });
      return;
    }
    ui.value = withTiming(0, { duration: SURFACE.ui });
    sink.value = withTiming(0, { duration: SURFACE.croc, easing: Easing.out(Easing.cubic) });
    day.value = withDelay(
      SURFACE.total - SURFACE.fade,
      withTiming(1, { duration: SURFACE.fade, easing: Easing.inOut(Easing.quad) }),
    );
    later(SURFACE.total + 40, settle);
  };

  const start = () => {
    if (phase !== 'intro') return;
    setEndedEarly(false);
    // Started from the tap itself, so browsers allow the audio.
    track.play();
    feedback.haptic('select');
    setPhase('sinking');
    sink.value = 0;
    ui.value = 0;
    if (reducedMotion) {
      day.value = withTiming(0, { duration: REDUCED_FADE });
      later(REDUCED_FADE + 40, () => {
        sink.value = depth;
        ui.value = withTiming(1, { duration: REDUCED_FADE });
        setPhase('playing');
      });
      return;
    }
    day.value = withTiming(0, { duration: SINK.fade, easing: Easing.inOut(Easing.quad) });
    sink.value = withDelay(
      SINK.diveDelay,
      withTiming(depth, { duration: SINK.croc, easing: Easing.in(Easing.cubic) }),
    );
    ui.value = withDelay(
      SINK.total - SINK.reveal,
      withTiming(1, { duration: SINK.reveal, easing: Easing.out(Easing.quad) }),
    );
    later(SINK.total, () => setPhase('playing'));
  };

  const complete = () => {
    feedback.haptic('select');
    void update((d) => ({
      ...d,
      firstSession: {
        completed: true,
        // Health data: only kept with consent, otherwise it never leaves this screen.
        moodBefore: consent ? moodBefore : null,
        moodAfter: consent ? moodAfter : null,
      },
    }));
    advance('firstSession');
  };

  const dayStyle = useAnimatedStyle(() => ({ opacity: day.value }));

  if (redirect) return <Redirect href={redirect} />;

  const busy = phase === 'sinking' || phase === 'surfacing';
  const nightMounted = phase !== 'intro' && phase !== 'after';
  const dayMounted = phase !== 'playing';
  const showAfter = phase === 'after' || (phase === 'surfacing' && outcome === 'finished');
  const name = doc.crocName ?? undefined;

  let dayContent: React.ReactNode = null;
  if (!dayMounted) {
    dayContent = null;
  } else if (showAfter) {
    dayContent = (
      <OnboardingScaffold
        step="firstSession"
        title={t('onboarding.firstSession.completeTitle')}
        subtitle={t('onboarding.firstSession.completeBody')}
        hero="hatchling"
        expression="happy"
        crocName={name}
        onBack={() => setPhase('intro')}
        backDisabled={busy}
        testID="onboarding-first-session-after"
        footer={
          <Button
            label={t('common.continue')}
            size="lg"
            fullWidth
            disabled={busy}
            onPress={complete}
            testID="onboarding-continue"
          />
        }
      >
        {consent ? (
          <View style={styles.mood}>
            <Text variant="label" tone="secondary">
              {t('mood.question')}
            </Text>
            <MoodPicker value={moodAfter} onChange={setMoodAfter} testID="mood-after" />
          </View>
        ) : null}
      </OnboardingScaffold>
    );
  } else {
    const alreadyDone = doc.firstSession.completed;
    const ended = endedEarly || (phase === 'surfacing' && outcome === 'ended');
    dayContent = (
      <OnboardingScaffold
        step="firstSession"
        title={ended ? t('onboarding.firstSession.endedTitle') : t('onboarding.firstSession.title')}
        subtitle={
          ended ? t('onboarding.firstSession.endedBody') : t('onboarding.firstSession.body')
        }
        hero="hatchling"
        expression={busy ? 'eyesClosed' : 'happy'}
        crocName={name}
        onBack={() => back('firstSession')}
        backDisabled={busy}
        testID="onboarding-first-session"
        footer={
          <View style={styles.buttons}>
            {alreadyDone ? (
              <Button
                label={t('common.continue')}
                size="lg"
                fullWidth
                disabled={busy}
                onPress={() => advance('firstSession')}
                testID="onboarding-continue"
              />
            ) : null}
            <Button
              label={
                alreadyDone || ended
                  ? t('onboarding.firstSession.playAgain')
                  : t('onboarding.firstSession.start')
              }
              variant={alreadyDone ? 'ghost' : 'primary'}
              size="lg"
              fullWidth
              loading={busy}
              onPress={start}
              testID="first-session-start"
            />
          </View>
        }
      >
        {consent ? (
          <View style={styles.mood}>
            <Text variant="label" tone="secondary">
              {t('mood.question')}
            </Text>
            <MoodPicker value={moodBefore} onChange={setMoodBefore} testID="mood-before" />
          </View>
        ) : null}
      </OnboardingScaffold>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Night River underneath: the croc dives here, and the player lives here. */}
      {nightMounted ? (
        <View style={StyleSheet.absoluteFill}>
          <NightPlayer
            track={track}
            sink={sink}
            depth={depth}
            ui={ui}
            crocName={name}
            onFinish={() => surface('finished')}
            onEnd={() => surface('ended')}
            onSkip={devMode ? () => surface('finished') : undefined}
            disabled={phase !== 'playing'}
          />
        </View>
      ) : null}
      {/* The day over it, fading out as the session starts and back in as it ends. */}
      {dayMounted ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, dayStyle]}
          pointerEvents={busy ? 'none' : 'auto'}
          testID="first-session-veil"
        >
          {dayContent}
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Night River: the dark river with the hatchling floating in it (and diving under), the breathing
 * guide rippling where it went under with its eyes glowing in the middle, and the controls in a
 * dock on the water. The playback status lives in its own small component, so its updates never
 * redraw the scene.
 */
function NightPlayer({
  track,
  sink,
  depth,
  ui,
  crocName,
  onFinish,
  onEnd,
  onSkip,
  disabled,
}: {
  track: Track;
  sink: SharedValue<number>;
  depth: number;
  ui: SharedValue<number>;
  crocName?: string;
  onFinish: () => void;
  onEnd: () => void;
  onSkip?: () => void;
  disabled: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  // The breathing guide restarts with each resume, so the cue and the ring agree.
  const [cycle, setCycle] = useState(0);
  const landscape = width > height;
  const short = !landscape && height < 700;
  // More water on short screens, so the ring, its cue and the dock all fit on it.
  const waterTop = landscape ? 0.5 : short ? 0.36 : 0.44;
  const waterY = Math.round(height * waterTop);
  const crocX = landscape ? 0.3 : 0.5;
  const centreX = Math.round(width * crocX);
  const visual = Math.round(Math.min(width * 0.52, height * (short ? 0.22 : 0.27), 210));
  // The ring sits on the water, just under the surface where the croc went under, its eyes at the
  // centre.
  const ringY = waterY + Math.round(visual * 0.52);
  const playing = track.wanted;

  const toggle = () => {
    if (playing) {
      track.pause();
    } else {
      setCycle((c) => c + 1);
      track.play();
    }
  };

  const uiStyle = useAnimatedStyle(() => ({ opacity: ui.value }));

  return (
    <Screen
      atmosphere="night"
      scroll={false}
      padded={false}
      edges={[]}
      // The scene is on screen during the dive and the rise; the player, once it can be used.
      testID={disabled ? 'first-session-night' : 'first-session-player'}
      background={
        <>
          <Lagoon
            width={width}
            height={height}
            stage="hatchling"
            expression="eyesClosed"
            showCroc
            crocOffsetY={sink}
            crocName={crocName}
            waterTop={waterTop}
            crocX={crocX}
            crocWidth={Math.min(Math.round(width * 0.72), 380)}
            leafSize={Math.min(Math.round(width * 0.2), Math.round(height * 0.14))}
            farReeds={false}
          />
          <SubmergedEyes x={centreX} y={ringY} sink={sink} depth={depth} />
        </>
      }
    >
      <Animated.View
        style={[styles.player, { paddingTop: insets.top + space.md }, uiStyle]}
        accessibilityLabel={t('onboarding.firstSession.a11yPlayer')}
        pointerEvents={disabled ? 'none' : 'box-none'}
      >
        <Text variant="label" tone="secondary" align="center">
          {t('onboarding.firstSession.title')}
        </Text>
        <View
          style={[styles.visual, { left: centreX - visual / 2, top: ringY - visual / 2 }]}
          pointerEvents="none"
        >
          <BreathingVisual key={cycle} size={visual} paused={!playing} testID="breathing" />
        </View>
        <View
          style={[
            styles.dock,
            landscape
              ? { right: insets.right + space.lg, bottom: insets.bottom + space.lg, width: 320 }
              : {
                  left: insets.left + space.lg,
                  right: insets.right + space.lg,
                  bottom: insets.bottom + space.xl,
                },
          ]}
        >
          <View style={styles.dockCard}>
            <PlaybackStatus track={track} onFinish={onFinish} />
            <View style={styles.controlRow}>
              <IconButton
                icon={playing ? 'pause' : 'play'}
                variant="accent"
                size={64}
                accessibilityLabel={playing ? t('common.pause') : t('common.play')}
                onPress={toggle}
                disabled={disabled || confirming}
                testID="first-session-toggle"
              />
            </View>
            {onSkip ? (
              <Button
                label={t('dev.skipSession')}
                variant="ghost"
                size="sm"
                disabled={disabled || confirming}
                onPress={onSkip}
                testID="first-session-dev-skip"
                style={styles.devSkip}
              />
            ) : null}
          </View>
        </View>
      </Animated.View>
      {/* A calm way out, top-left; it asks once before ending the session early. */}
      <Animated.View
        style={[styles.exit, { top: insets.top + space.sm, left: insets.left + space.md }, uiStyle]}
      >
        <IconButton
          icon="close"
          variant="filled"
          accessibilityLabel={t('onboarding.firstSession.end')}
          onPress={() => setConfirming(true)}
          disabled={disabled || confirming}
          testID="first-session-end"
        />
      </Animated.View>
      {confirming ? (
        <EndSessionDialog
          onKeepGoing={() => setConfirming(false)}
          onEnd={() => {
            setConfirming(false);
            onEnd();
          }}
        />
      ) : null}
    </Screen>
  );
}

/** "End the session?": a calm card in Night River tones (it lives inside the night screen). */
function EndSessionDialog({ onKeepGoing, onEnd }: { onKeepGoing: () => void; onEnd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.confirmBackdrop} testID="first-session-end-dialog">
      <Reveal style={styles.confirmWrap}>
        <View
          style={[
            styles.confirm,
            theme.shadow.raised,
            { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
          ]}
        >
          <Text variant="heading" heading>
            {t('onboarding.firstSession.endTitle')}
          </Text>
          <Text variant="body" tone="secondary">
            {t('onboarding.firstSession.endBody')}
          </Text>
          <Button
            label={t('onboarding.firstSession.endCancel')}
            variant="secondary"
            size="lg"
            fullWidth
            onPress={onKeepGoing}
            testID="first-session-end-cancel"
          />
          <Button
            label={t('onboarding.firstSession.endConfirm')}
            variant="ghost"
            fullWidth
            onPress={onEnd}
            testID="first-session-end-confirm"
          />
        </View>
      </Reveal>
    </View>
  );
}

/** Progress and time left: the only part that follows the track several times a second. */
function PlaybackStatus({ track, onFinish }: { track: Track; onFinish: () => void }) {
  const status = useTrackStatus(track, { onFinish });
  const remaining = Math.max(0, status.duration - status.position);
  return (
    <>
      {track.silent ? (
        <Text variant="caption" tone="muted" align="center" testID="first-session-silent">
          {t('onboarding.firstSession.audioUnavailable')}
        </Text>
      ) : null}
      <ProgressBar
        progress={status.duration > 0 ? status.position / status.duration : 0}
        tone="water"
        height={8}
        testID="first-session-progress"
      />
      <Text variant="caption" tone="secondary" align="right" testID="first-session-remaining">
        {t('onboarding.firstSession.remaining', { time: formatClock(remaining) })}
      </Text>
    </>
  );
}

/**
 * The croc watching from just under the surface: two eye bumps with amber eyes and slit pupils,
 * breathing with you. They appear as the croc goes under and go with it as it rises.
 */
function SubmergedEyes({
  x,
  y,
  sink,
  depth,
}: {
  x: number;
  y: number;
  sink: SharedValue<number>;
  depth: number;
}) {
  const reducedMotion = useReducedMotion();
  const { motion, atmosphere } = useTheme();
  const colors = useMemo(() => crocColors(atmosphere), [atmosphere]);
  const breath = useBreath(!reducedMotion, motion.idle, 0, 0.5);
  const style = useAnimatedStyle(() => {
    const under = Math.max(0, Math.min(1, (sink.value / depth - 0.6) / 0.4));
    return { opacity: under * (0.72 + breath.value * 0.28) };
  });
  const W = 92;
  const H = 40;
  const eye = (cx: number) => (
    <React.Fragment key={cx}>
      <Path
        d={`M ${cx - 17} ${H} C ${cx - 17} 14 ${cx - 9} 6 ${cx} 6 C ${cx + 9} 6 ${cx + 17} 14 ${cx + 17} ${H} Z`}
        fill={colors.skinDark}
      />
      <Ellipse cx={cx} cy={21} rx={9} ry={9} fill={colors.pupil} opacity={0.6} />
      <Ellipse cx={cx} cy={21} rx={8} ry={8} fill="url(#night-eye)" />
      <Ellipse cx={cx + 0.4} cy={21} rx={1.5} ry={6} fill={colors.pupil} />
      <Ellipse cx={cx + 3} cy={17.5} rx={1.8} ry={1.8} fill={colors.highlight} opacity={0.9} />
    </React.Fragment>
  );
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.eyes, { left: x - W / 2, top: y - 24, width: W, height: H }, style]}
    >
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <RadialGradient id="night-eye" cx="50%" cy="45%" r="55%">
            <Stop offset="0" stopColor={EYE_STOPS[0]} />
            <Stop offset="0.65" stopColor={EYE_STOPS[1]} />
            <Stop offset="1" stopColor={EYE_STOPS[2]} />
          </RadialGradient>
        </Defs>
        {[24, 68].map(eye)}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  buttons: { gap: space.sm },
  mood: { gap: space.sm },
  player: { flex: 1, paddingHorizontal: space.xl },
  visual: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  dock: { position: 'absolute', alignItems: 'center' },
  dockCard: {
    width: '100%',
    maxWidth: 480,
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(palette.shallows, 0.22),
    backgroundColor: withAlpha(palette.nightRiver, 0.78),
  },
  controlRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: space.xs },
  devSkip: { alignSelf: 'center' },
  exit: { position: 'absolute' },
  confirmBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: 'rgba(8, 23, 26, 0.6)',
  },
  confirmWrap: { width: '100%', maxWidth: 400 },
  confirm: { borderRadius: radius.lg, borderWidth: 1, padding: space.xl, gap: space.md },
  eyes: { position: 'absolute' },
});
