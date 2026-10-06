import { Redirect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { devMode } from '@/config/env';
import { t } from '@/copy';
import { MoodPicker } from '@/features/onboarding/MoodPicker';
import { OnboardingScaffold } from '@/features/onboarding/OnboardingScaffold';
import { useOnboardingActions, useStepScreen } from '@/features/onboarding/useOnboardingFlow';
import { AudioPlayer } from '@/features/session/AudioPlayer';
import { useDive, useNightLayout } from '@/features/session/NightRiver';
import { useListening } from '@/features/session/useListening';
import { useTrack } from '@/features/session/useTrackPlayer';
import { useFeedback } from '@/services/feedback';
import type { MoodValue } from '@/services/profile/types';
import { space } from '@/theme';
import { Button, Text } from '@/ui';

export { SINK, SURFACE } from '@/features/session/NightRiver';

const TRACK = require('../../../assets/audio/first-session.mp3');
/** The placeholder track is 75 s; also the length of the silent fallback. */
const TRACK_SECONDS = 75;

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
/**
 * Step 6: the first short session, on the shared Night River player (`features/session`). The
 * whole screen fades into Night River, where the croc dives under the water; a placeholder track
 * plays with a breathing guide where it went under, then the croc surfaces and the day comes
 * back. The session counts as done the moment the track ends (a reload never asks for a replay);
 * it can be ended early from inside the player. Mood checks before and after only with consent.
 */
export default function FirstSessionScreen() {
  const { doc, redirect } = useStepScreen('firstSession');
  const { update, advance, back } = useOnboardingActions();
  const feedback = useFeedback();
  const consent = doc.moodConsent === true;
  const layout = useNightLayout();
  const dive = useDive(layout.depth);

  const [phase, setPhase] = useState<Phase>('intro');
  const [outcome, setOutcome] = useState<Outcome>('finished');
  const [endedEarly, setEndedEarly] = useState(false);
  const [run, setRun] = useState(0);
  const [moodBefore, setMoodBefore] = useState<MoodValue | null>(
    consent ? doc.firstSession.moodBefore : null,
  );
  const [moodAfter, setMoodAfter] = useState<MoodValue | null>(
    consent ? doc.firstSession.moodAfter : null,
  );
  const phaseRef = useRef<Phase>('intro');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const track = useTrack(TRACK, TRACK_SECONDS, { title: t('onboarding.firstSession.title') });

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
    dive.rise(() => {
      setEndedEarly(how === 'ended');
      setPhase(how === 'finished' ? 'after' : 'intro');
      if (how === 'finished') feedback.haptic('success');
    });
  };

  const start = () => {
    if (phase !== 'intro') return;
    setEndedEarly(false);
    // A fresh run starts from the beginning.
    setRun((r) => r + 1);
    track.seekTo(0);
    // Started from the tap itself, so browsers allow the audio.
    track.play();
    feedback.haptic('select');
    setPhase('sinking');
    dive.dive(() => setPhase('playing'));
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
          <FirstSessionPlayer
            key={run}
            track={track}
            dive={dive}
            layout={layout}
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
          style={[StyleSheet.absoluteFill, dive.dayStyle]}
          pointerEvents={busy ? 'none' : 'auto'}
          testID="first-session-veil"
        >
          {dayContent}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The shared audio player, with what was listened to kept per run. */
function FirstSessionPlayer(
  props: Omit<React.ComponentProps<typeof AudioPlayer>, 'listening' | 'title' | 'testIDPrefix'>,
) {
  const listening = useListening();
  return (
    <AudioPlayer
      {...props}
      listening={listening}
      title={t('onboarding.firstSession.title')}
      testIDPrefix="first-session"
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  buttons: { gap: space.sm },
  mood: { gap: space.sm },
});
