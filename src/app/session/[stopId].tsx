import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { devMode } from '@/config/env';
import { t } from '@/copy';
import { localContent } from '@/content/repository';
import type { StopStatus } from '@/content/journey';
import type { Stop } from '@/content/types';
import { effectiveCautionMode, useJourney } from '@/features/home/useJourney';
import { LagoonSheetScreen } from '@/features/layout/LagoonSheetScreen';
import { durationLabel, typeLabel } from '@/features/map/stopLabels';
import { AudioPlayer } from '@/features/session/AudioPlayer';
import { completeSession, type Completion } from '@/features/session/completion';
import { isComplete, type Coverage } from '@/features/session/listening';
import { mediaFor, type SessionMedia } from '@/features/session/media';
import {
  useDive,
  useNightLayout,
  type Dive,
  type NightLayout,
} from '@/features/session/NightRiver';
import { canResume, createResumeStore, type ResumePoint } from '@/features/session/resume';
import { MoodStep, RewardSheet } from '@/features/session/SessionDay';
import { announceUnlocked } from '@/features/session/unlock';
import { useListening } from '@/features/session/useListening';
import { formatClock, useTrack, type Track } from '@/features/session/useTrackPlayer';
import { VideoLesson } from '@/features/session/VideoLesson';
import { VisualExercise } from '@/features/session/VisualExercise';
import { newEventId } from '@/services/events/types';
import { useFeedback } from '@/services/feedback';
import { useProfile, useProfileStore } from '@/services/profile';
import { appStorage } from '@/services/profile/asyncStorage';
import type { MoodValue } from '@/services/profile/types';
import { markDone, markStarted } from '@/services/progress/mergeProgress';
import { space } from '@/theme';
import { Button, IconButton, Notice, Text } from '@/ui';

const resumeStore = createResumeStore(appStorage);
const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));
/** How often the place to resume is saved while a session plays. */
const SAVE_EVERY_MS = 3000;

type Phase = 'intro' | 'moodBefore' | 'sinking' | 'playing' | 'surfacing' | 'moodAfter' | 'reward';

/** How a run ended: finished (counts as done), or stopped before enough was listened to. */
type Outcome = 'finished' | 'stopped';

interface Run {
  id: string;
  startAt: number;
  coverage: Coverage;
}

/**
 * A session, from today's card or a map stop: an optional mood check (with consent), the dive
 * into Night River, the player for the stop's type, the rise back to the day, a second mood
 * check, and the reward; then back to the map, where the next stop unlocks. A session counts as
 * done once most of it was really listened to (see `listening.ts`); an interrupted one can be
 * resumed where it stopped.
 */
export default function SessionScreen() {
  const { stopId } = useLocalSearchParams<{ stopId: string }>();
  const { journey } = useJourney();
  const profile = useProfileStore();
  const userId = useProfile((s) => s.userId);
  const crocName = useProfile((s) => s.settings.crocName) ?? t('croc.defaultName');
  const consent = useProfile((s) =>
    s.settingsKnown ? s.settings.moodConsent : s.onboarding.moodConsent === true,
  );
  const feedback = useFeedback();
  const layout = useNightLayout();
  const dive = useDive(layout.depth);

  const view = stopId ? journey.byStopId.get(stopId) : undefined;
  const stop = view?.stop;
  const playable =
    !!view &&
    (view.status === 'available' || view.status === 'inProgress' || view.status === 'done');
  const media = useMemo(() => (stop ? mediaFor(stop) : null), [stop]);
  const title = stop ? t(stop.titleKey) : '';

  const track = useTrack(
    media?.kind === 'audio' ? media.source : null,
    media?.kind === 'audio' ? media.fallbackSec : 1,
    { title },
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [resume, setResume] = useState<ResumePoint | null>(null);
  /** When the saved place was read (0: not yet). */
  const [resumeCheckedAt, setResumeCheckedAt] = useState(0);
  const [pendingResume, setPendingResume] = useState<ResumePoint | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [moodBefore, setMoodBefore] = useState<MoodValue | null>(null);
  const [moodAfter, setMoodAfter] = useState<MoodValue | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const phaseRef = useRef<Phase>('intro');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Where an earlier run stopped, to offer resuming it.
  useEffect(() => {
    if (!userId || !stopId) return;
    let live = true;
    void resumeStore.get(userId, stopId).then((point) => {
      if (!live) return;
      setResume(point);
      setResumeCheckedAt(Date.now());
    });
    return () => {
      live = false;
    };
  }, [userId, stopId]);

  const length = !media
    ? 0
    : media.kind === 'visual'
      ? media.durationSec
      : media.kind === 'game'
        ? 0
        : media.fallbackSec;
  const resumeAt =
    resumeCheckedAt > 0 &&
    media?.kind !== 'game' &&
    resume &&
    canResume(resume, length, resumeCheckedAt)
      ? resume
      : null;

  /** Into the river. The audio starts from the tap itself (browsers allow it then). */
  const startRun = (from: ResumePoint | null): Run | null => {
    if (!stop || phaseRef.current === 'sinking' || phaseRef.current === 'playing') return null;
    const next: Run = from
      ? { id: from.runId, startAt: from.position, coverage: from.coverage }
      : { id: newEventId(), startAt: 0, coverage: [] };
    phaseRef.current = 'sinking';
    setRun(next);
    setOutcome(null);
    void profile.getState().updateProgress((d) => markStarted(d, stop.id, Date.now()));
    if (media?.kind === 'audio') {
      track.seekTo(next.startAt);
      track.play();
    }
    feedback.haptic('select');
    setPhase('sinking');
    dive.dive(() => setPhase('playing'));
    return next;
  };

  const begin = (from: ResumePoint | null) => {
    if (phaseRef.current !== 'intro') return;
    if (consent) {
      setPendingResume(from);
      setMoodBefore(null);
      setPhase('moodBefore');
      return;
    }
    startRun(from);
  };

  const recordMood = (which: 'before' | 'after', value: MoodValue | null, runId: string) => {
    // Health data: only with consent, and only what the user picked.
    if (!consent || value === null || !stop) return;
    void profile.getState().recordMood({
      id: `${runId}-${which === 'before' ? 'b' : 'a'}`,
      at: Date.now(),
      phase: which,
      value,
      stopId: stop.id,
    });
  };

  /** Finishing counts once per run, whatever calls it (the track's end, ending at 95 %, dev). */
  const completedRun = useRef<string | null>(null);
  const complete = (runId: string): Completion | null => {
    if (!stop || !userId || completedRun.current === runId) return null;
    completedRun.current = runId;
    const state = profile.getState();
    const now = Date.now();
    const done = completeSession(
      localContent,
      state.progress,
      stop,
      runId,
      now,
      effectiveCautionMode(state),
    );
    void state.updateProgress((d) => markDone(d, stop.id, now));
    void state.recordSession(done.event);
    void resumeStore.clear(userId, stop.id);
    setResume(null);
    setCompletion(done);
    return done;
  };

  const showReward = () => {
    setPhase('reward');
    feedback.sound('hatch');
    feedback.haptic('success');
  };

  /** The croc comes back up; then the mood check, the reward, or the intro again. */
  const surface = (how: Outcome) => {
    if (phaseRef.current !== 'playing' || !run) return;
    phaseRef.current = 'surfacing';
    track.pause();
    if (how === 'finished') complete(run.id);
    setOutcome(how);
    setPhase('surfacing');
    dive.rise(() => {
      if (how !== 'finished') {
        setPhase('intro');
        if (userId && stopId) {
          void resumeStore.get(userId, stopId).then((point) => {
            setResume(point);
            setResumeCheckedAt(Date.now());
          });
        }
        return;
      }
      if (consent) {
        setMoodAfter(null);
        setPhase('moodAfter');
      } else {
        showReward();
      }
    });
  };

  const leave = () => {
    if (completion) announceUnlocked(completion.unlocked);
    back();
  };

  /** Dev builds (e2e, QA): finish the stop from the intro without playing it. */
  const devComplete = () => {
    if (phaseRef.current !== 'intro') return;
    if (complete(newEventId())) showReward();
  };

  if (!view || !stop || !media) return <Unavailable />;

  const busy = phase === 'sinking' || phase === 'surfacing';
  const nightMounted = phase === 'sinking' || phase === 'playing' || phase === 'surfacing';
  const finishedRise = phase === 'surfacing' && outcome === 'finished';

  let day: React.ReactNode;
  if (phase === 'reward' || (finishedRise && !consent)) {
    day = completion ? (
      <LagoonSheetScreen
        stage="hatchling"
        expression="excited"
        crocName={crocName}
        celebrating={phase === 'reward'}
        header={null}
        sheet={<RewardSheet points={completion.points} onContinue={leave} />}
        testID="session-reward-screen"
      />
    ) : null;
  } else if (phase === 'moodAfter' || finishedRise) {
    day = (
      <LagoonSheetScreen
        stage="hatchling"
        expression="happy"
        crocName={crocName}
        header={null}
        sheet={
          <MoodStep
            title={t('session.moodAfterTitle')}
            value={moodAfter}
            onChange={setMoodAfter}
            before={moodBefore}
            onContinue={() => {
              if (run) recordMood('after', moodAfter, run.id);
              showReward();
            }}
            onSkip={showReward}
            testID="mood-after"
          />
        }
        testID="session-mood-after"
      />
    );
  } else if (phase === 'moodBefore') {
    day = (
      <LagoonSheetScreen
        stage="hatchling"
        expression="calm"
        crocName={crocName}
        header={<Header onBack={() => setPhase('intro')} />}
        sheet={
          <MoodStep
            title={t('session.moodTitle')}
            value={moodBefore}
            onChange={setMoodBefore}
            onContinue={() => {
              const started = startRun(pendingResume);
              if (started) recordMood('before', moodBefore, started.id);
            }}
            onSkip={() => {
              setMoodBefore(null);
              startRun(pendingResume);
            }}
            testID="mood-before"
          />
        }
        testID="session-mood-before"
      />
    );
  } else {
    day = (
      <LagoonSheetScreen
        stage="hatchling"
        expression={busy ? 'eyesClosed' : stop.type === 'longTrance' ? 'sleepy' : 'happy'}
        crocName={crocName}
        header={<Header onBack={back} disabled={busy} />}
        sheet={
          <IntroSheet
            stop={stop}
            status={view.status}
            playable={playable}
            stopped={outcome === 'stopped' && phase === 'intro'}
            resumeAt={resumeAt ? resumeAt.position : null}
            busy={busy}
            onStart={() => begin(null)}
            onResume={() => begin(resumeAt)}
            onDevComplete={devMode && playable ? devComplete : undefined}
          />
        }
        testID="session-screen"
      />
    );
  }

  return (
    <View style={styles.flex}>
      {/* Night River underneath: the croc dives here, and the player lives here. */}
      {nightMounted && run ? (
        <View style={StyleSheet.absoluteFill}>
          <SessionPlayer
            key={run.id}
            stop={stop}
            media={media}
            track={track}
            dive={dive}
            layout={layout}
            run={run}
            title={title}
            crocName={crocName}
            userId={userId}
            disabled={phase !== 'playing'}
            onFinish={(done) => surface(done ? 'finished' : 'stopped')}
          />
        </View>
      ) : null}
      {/* The day over it, fading out as the session starts and back in as it ends. */}
      {phase !== 'playing' ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, dive.dayStyle]}
          pointerEvents={busy ? 'none' : 'auto'}
        >
          {day}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A way back, on the sky. */
function Header({ onBack, disabled }: { onBack?: () => void; disabled?: boolean }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton
          icon="back"
          variant="filled"
          accessibilityLabel={t('session.back')}
          onPress={onBack}
          disabled={disabled}
          testID="session-back"
        />
      ) : null}
    </View>
  );
}

/** The stop before it starts: what it is, the long-trance note, start / resume / restart. */
function IntroSheet({
  stop,
  status,
  playable,
  stopped,
  resumeAt,
  busy,
  onStart,
  onResume,
  onDevComplete,
}: {
  stop: Stop;
  status: StopStatus;
  playable: boolean;
  stopped: boolean;
  resumeAt: number | null;
  busy: boolean;
  onStart: () => void;
  onResume: () => void;
  onDevComplete?: () => void;
}) {
  const long = stop.type === 'longTrance';
  const game = stop.type === 'game';
  let body = t('session.intro');
  if (stopped) body = t('session.notFinished');
  else if (long) body = t('session.longTranceIntro');
  return (
    <View style={styles.sheet} testID={long ? 'session-intro-long' : 'session-intro'}>
      <Text variant="caption" tone="secondary">
        {t('session.meta', {
          type: typeLabel(stop.type),
          duration: durationLabel(stop.durationSec),
        })}
      </Text>
      <Text variant="title" heading testID="session-title">
        {t(stop.titleKey)}
      </Text>
      <Text variant="body" tone="secondary" testID="session-intro-body">
        {body}
      </Text>
      {long ? <Notice message={t('session.drivingNote')} testID="session-driving" /> : null}
      {status === 'caution' ? (
        <Notice message={t('session.cautionNote')} testID="session-caution" />
      ) : null}
      {game ? <Notice message={t('session.gameSoon')} placeholder /> : null}
      {!playable && status !== 'caution' ? (
        <Text variant="body" testID="session-unavailable">
          {t('session.notFound')}
        </Text>
      ) : null}
      {playable && !game && resumeAt !== null ? (
        <>
          <Button
            label={t('session.resume', { time: formatClock(resumeAt) })}
            size="lg"
            fullWidth
            loading={busy}
            onPress={onResume}
            testID="session-resume"
          />
          <Button
            label={t('session.restart')}
            variant="ghost"
            fullWidth
            disabled={busy}
            onPress={onStart}
            testID="session-restart"
          />
        </>
      ) : null}
      {playable && !game && resumeAt === null ? (
        <Button
          label={status === 'done' ? t('session.playAgain') : t('session.start')}
          size="lg"
          fullWidth
          loading={busy}
          onPress={onStart}
          testID="session-start"
        />
      ) : null}
      {onDevComplete ? (
        <Button
          label={t('session.completeDev')}
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={onDevComplete}
          testID="session-complete-dev"
        />
      ) : null}
    </View>
  );
}

function Unavailable() {
  return (
    <LagoonSheetScreen
      stage="hatchling"
      expression="calm"
      header={<Header onBack={back} />}
      sheet={
        <View style={styles.sheet}>
          <Text variant="heading" heading testID="session-unavailable">
            {t('session.notFound')}
          </Text>
          <Button label={t('session.back')} variant="ghost" fullWidth onPress={back} />
        </View>
      }
      testID="session-screen"
    />
  );
}

/**
 * The player for the stop's type, for one run: keeps what was listened to, saves the place to
 * resume every few seconds (and when the app goes to the background or the player closes), and
 * reports the end with whether enough was listened to for it to count.
 */
function SessionPlayer({
  stop,
  media,
  track,
  dive,
  layout,
  run,
  title,
  crocName,
  userId,
  disabled,
  onFinish,
}: {
  stop: Stop;
  media: SessionMedia;
  track: Track;
  dive: Dive;
  layout: NightLayout;
  run: Run;
  title: string;
  crocName: string;
  userId: string | null;
  disabled: boolean;
  onFinish: (complete: boolean) => void;
}) {
  const listening = useListening(run.coverage);
  const position = useRef(run.startAt);
  const lastSave = useRef(0);
  const closed = useRef(false);
  const { durationRef } = track;
  const length = useCallback(() => {
    if (media.kind === 'visual') return media.durationSec;
    if (media.kind === 'audio') return durationRef.current || media.fallbackSec;
    if (media.kind === 'video') return media.fallbackSec;
    return 0;
  }, [media, durationRef]);

  const save = useCallback(() => {
    if (!userId || closed.current) return;
    lastSave.current = Date.now();
    void resumeStore.save(userId, {
      stopId: stop.id,
      position: position.current,
      coverage: listening.coverage(),
      runId: run.id,
      updatedAt: Date.now(),
    });
  }, [userId, stop.id, listening, run.id]);

  const onTick = useCallback(
    (p: number) => {
      position.current = p;
      if (Date.now() - lastSave.current > SAVE_EVERY_MS) save();
    },
    [save],
  );

  // Interrupted (app to the background, a call, leaving the screen): keep the place.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') save();
    });
    return () => {
      sub.remove();
      save();
    };
  }, [save]);

  const finish = useCallback(() => {
    // Reaching the end counts only if most of it was listened to (jumping there does not).
    const complete = isComplete(listening.coverage(), length());
    if (complete) closed.current = true;
    else save();
    onFinish(complete);
  }, [listening, length, onFinish, save]);

  const skip = devMode
    ? () => {
        // Dev: as if the rest had been listened to.
        listening.add(0, length());
        finish();
      }
    : undefined;

  const common = {
    dive,
    layout,
    listening,
    title,
    crocName,
    disabled,
    onTick,
    onFinish: finish,
    onEnd: finish,
    onSkip: skip,
  };
  switch (media.kind) {
    case 'audio':
      return <AudioPlayer {...common} track={track} testIDPrefix="session" soundscapes />;
    case 'video':
      return (
        <VideoLesson
          {...common}
          source={media.source}
          poster={media.poster}
          captions={media.captions}
          fallbackSec={media.fallbackSec}
          startAt={run.startAt}
        />
      );
    case 'visual':
      return <VisualExercise {...common} durationSec={media.durationSec} startAt={run.startAt} />;
    case 'game':
      return null;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheet: { gap: space.md },
});
