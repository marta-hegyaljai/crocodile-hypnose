import { Redirect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
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
import { Lagoon, useBreath } from '@/illustration';
import { useReducedMotion } from '@/motion/MotionProvider';
import { useFeedback } from '@/services/feedback';
import type { MoodValue } from '@/services/profile/types';
import { palette, radius, space, useTheme } from '@/theme';
import { Button, IconButton, ProgressBar, Reveal, Screen, Text } from '@/ui';

const TRACK = require('../../../assets/audio/first-session.mp3');
/** The placeholder track is 75 s; also the length of the silent fallback. */
const TRACK_SECONDS = 75;

/** Timings of the signature transition (ms). */
export const SINK = { croc: 1500, veilDelay: 450, veil: 1300, reveal: 800, total: 1900 } as const;
export const SURFACE = { veil: 1000, croc: 1300, reveal: 900 } as const;
const REDUCED_FADE = 320;

type Phase = 'intro' | 'sinking' | 'playing' | 'surfacing' | 'after';

/**
 * Step 6: the first short session. The croc sinks under the water while the screen darkens into
 * Night River, a placeholder track plays with a breathing guide, then the river brightens again
 * and the croc surfaces. The session counts as done the moment the track ends (a reload never
 * asks for a replay); the session can be ended early from inside the player. Mood checks before
 * and after only with consent. Step 5 replaces the player; the transition and the shape of the
 * flow stay.
 */
export default function FirstSessionScreen() {
  const { doc, redirect } = useStepScreen('firstSession');
  const { update, advance, back } = useOnboardingActions();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const feedback = useFeedback();
  const consent = doc.moodConsent === true;

  const [phase, setPhase] = useState<Phase>('intro');
  const [night, setNight] = useState(false);
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

  const veil = useSharedValue(0);
  const sink = useSharedValue(0);
  // Deep enough for the whole hatchling to pass under the water on any band.
  const depth = Math.round(Math.min(width, 440) * 0.42) + 24;

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

  /** The river brightens again and the croc comes back up. */
  const surface = (outcome: 'finished' | 'ended') => {
    if (phaseRef.current !== 'playing') return;
    track.pause();
    if (outcome === 'finished') {
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
    setPhase('surfacing');
    const fade = reducedMotion ? REDUCED_FADE : SURFACE.veil;
    veil.value = withTiming(1, { duration: fade, easing: Easing.inOut(Easing.quad) });
    later(fade + 40, () => {
      setNight(false);
      setEndedEarly(outcome === 'ended');
      setPhase(outcome === 'finished' ? 'after' : 'intro');
      if (outcome === 'finished') feedback.haptic('success');
      if (reducedMotion) {
        sink.value = 0;
        veil.value = withTiming(0, { duration: REDUCED_FADE });
        return;
      }
      sink.value = depth;
      sink.value = withTiming(0, { duration: SURFACE.croc, easing: Easing.out(Easing.cubic) });
      veil.value = withTiming(0, { duration: SURFACE.reveal, easing: Easing.out(Easing.quad) });
    });
  };

  const start = () => {
    if (phase !== 'intro') return;
    setEndedEarly(false);
    // Started from the tap itself, so browsers allow the audio.
    track.play();
    feedback.haptic('select');
    setPhase('sinking');
    if (reducedMotion) {
      veil.value = withTiming(1, { duration: REDUCED_FADE });
      later(REDUCED_FADE + 40, () => {
        setNight(true);
        setPhase('playing');
        veil.value = withTiming(0, { duration: REDUCED_FADE });
      });
      return;
    }
    sink.value = withTiming(depth, { duration: SINK.croc, easing: Easing.in(Easing.cubic) });
    veil.value = withDelay(
      SINK.veilDelay,
      withTiming(1, { duration: SINK.veil, easing: Easing.inOut(Easing.quad) }),
    );
    later(SINK.total, () => {
      setNight(true);
      setPhase('playing');
      veil.value = withTiming(0, { duration: SINK.reveal, easing: Easing.out(Easing.quad) });
    });
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

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  if (redirect) return <Redirect href={redirect} />;

  const busy = phase === 'sinking' || phase === 'surfacing';
  const name = doc.crocName ?? undefined;

  let content: React.ReactNode;
  if (night) {
    content = (
      <NightPlayer
        track={track}
        onFinish={() => surface('finished')}
        onEnd={() => surface('ended')}
        onSkip={devMode ? () => surface('finished') : undefined}
        disabled={phase !== 'playing'}
      />
    );
  } else if (phase === 'after') {
    content = (
      <OnboardingScaffold
        step="firstSession"
        title={t('onboarding.firstSession.completeTitle')}
        subtitle={t('onboarding.firstSession.completeBody')}
        hero="hatchling"
        expression="happy"
        crocName={name}
        crocOffsetY={sink}
        onBack={() => setPhase('intro')}
        testID="onboarding-first-session-after"
        footer={
          <Button
            label={t('common.continue')}
            size="lg"
            fullWidth
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
    content = (
      <OnboardingScaffold
        step="firstSession"
        title={
          endedEarly ? t('onboarding.firstSession.endedTitle') : t('onboarding.firstSession.title')
        }
        subtitle={
          endedEarly ? t('onboarding.firstSession.endedBody') : t('onboarding.firstSession.body')
        }
        hero="hatchling"
        expression={busy ? 'eyesClosed' : 'happy'}
        crocName={name}
        crocOffsetY={sink}
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
                alreadyDone || endedEarly
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
      {content}
      {/* The river darkening into night, and brightening again: one veil over everything. */}
      <Animated.View
        pointerEvents={busy ? 'auto' : 'none'}
        style={[styles.veil, veilStyle]}
        testID="first-session-veil"
      />
    </View>
  );
}

/**
 * Night River: the dark river, the breathing guide, the track's progress and one calm way out.
 * The playback status lives in its own small component, so its updates never redraw the scene.
 */
function NightPlayer({
  track,
  onFinish,
  onEnd,
  onSkip,
  disabled,
}: {
  track: Track;
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
  const waterTop = landscape ? 0.5 : 0.56;
  const visual = Math.round(Math.min(width * 0.58, height * 0.3, 260));
  const playing = track.wanted;

  const toggle = () => {
    if (playing) {
      track.pause();
    } else {
      setCycle((c) => c + 1);
      track.play();
    }
  };

  return (
    <Screen
      atmosphere="night"
      scroll={false}
      padded={false}
      edges={[]}
      testID="first-session-player"
      background={
        <>
          <Lagoon
            width={width}
            height={height}
            showCroc={false}
            waterTop={waterTop}
            crocX={0.5}
            leafSize={Math.min(Math.round(width * 0.2), Math.round(height * 0.14))}
            farReeds={false}
          />
          <SubmergedEyes x={width * 0.5} y={height * waterTop + 36} />
        </>
      }
    >
      <View
        style={[
          styles.player,
          { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl },
        ]}
        accessibilityLabel={t('onboarding.firstSession.a11yPlayer')}
      >
        <Text variant="label" tone="secondary" align="center">
          {t('onboarding.firstSession.title')}
        </Text>
        <View style={styles.visual}>
          <BreathingVisual key={cycle} size={visual} paused={!playing} testID="breathing" />
        </View>
        <View style={styles.controls}>
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
      {/* A calm way out, top-left; it asks once before ending the session early. */}
      <View style={[styles.exit, { top: insets.top + space.sm, left: insets.left + space.md }]}>
        <IconButton
          icon="close"
          variant="filled"
          accessibilityLabel={t('onboarding.firstSession.end')}
          onPress={() => setConfirming(true)}
          disabled={disabled || confirming}
          testID="first-session-end"
        />
      </View>
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

/** Two amber glows just under the surface: the croc, watching, breathing with you. */
function SubmergedEyes({ x, y }: { x: number; y: number }) {
  const reducedMotion = useReducedMotion();
  const { motion } = useTheme();
  const breath = useBreath(!reducedMotion, motion.idle, 0, 0.5);
  const style = useAnimatedStyle(() => ({ opacity: 0.22 + breath.value * 0.3 }));
  return (
    <Animated.View pointerEvents="none" style={[styles.eyes, { left: x - 26, top: y }, style]}>
      <View style={styles.eye} />
      <View style={styles.eye} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  veil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.nightRiver,
  },
  buttons: { gap: space.sm },
  mood: { gap: space.sm },
  player: { flex: 1, paddingHorizontal: space.xl, justifyContent: 'space-between' },
  visual: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  controls: { gap: space.sm, width: '100%', maxWidth: 480, alignSelf: 'center' },
  controlRow: { flexDirection: 'row', justifyContent: 'center', paddingTop: space.sm },
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
  eyes: { position: 'absolute', flexDirection: 'row', gap: 22 },
  eye: {
    width: 15,
    height: 9,
    borderRadius: 8,
    backgroundColor: palette.amber,
    shadowColor: palette.amber,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
