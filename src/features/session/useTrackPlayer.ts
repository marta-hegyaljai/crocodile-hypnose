import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
  type AudioSource,
} from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Platform } from 'react-native';

/**
 * One track for a session, in two parts so that playback status updates (several a second) only
 * re-render the small piece of UI that shows them:
 * - `useTrack` owns the player and the intent (play / pause) at the screen level; it never
 *   subscribes to the status, so the screen stays still while the track plays.
 * - `useTrackStatus`, in the component that shows progress, subscribes to the status and runs
 *   the safety nets: when the audio never loads or never moves after `play()` (a missing codec,
 *   a browser that blocked playback), the session carries on as a silent timer of the same
 *   length, so it always reaches its end.
 * Both the onboarding first session and the session player (step 5) use them.
 */

export interface Track {
  player: AudioPlayer;
  /** The user wants it playing (what the toggle shows). */
  wanted: boolean;
  /** The audio could not be used; a silent timer runs instead. */
  silent: boolean;
  /** Seconds to assume while the file has not reported a length, and for the silent fallback. */
  fallbackDurationSec: number;
  play(): void;
  pause(): void;
  /** Gives up on the audio: the track continues silently (set by the status watch). */
  goSilent(): void;
  /** Jumps to a position (seconds); applied as soon as the audio (or the silent timer) can. */
  seekTo(seconds: number): void;
  /** The latest known position and length (seconds), for controls that act on them. */
  positionRef: MutableRefObject<number>;
  durationRef: MutableRefObject<number>;
  /** A pending jump, for the status watch. */
  seekRequest: { to: number; n: number } | null;
}

export interface TrackOptions {
  /** Shown on the lock screen and in the system's media controls (native). */
  title?: string;
}

const TICK_MS = 250;

export function useTrack(
  source: AudioSource,
  fallbackDurationSec: number,
  options: TrackOptions = {},
): Track {
  const player = useAudioPlayer(source, { updateInterval: TICK_MS });
  const [wanted, setWanted] = useState(false);
  const [silent, setSilent] = useState(false);
  const [seekRequest, setSeekRequest] = useState<{ to: number; n: number } | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(fallbackDurationSec);
  const modeSet = useRef(false);
  const title = options.title;

  const goSilent = useCallback(() => {
    setSilent(true);
    try {
      player.pause();
    } catch {
      // Nothing to pause.
    }
  }, [player]);

  const play = useCallback(() => {
    setWanted(true);
    if (silent) return;
    if (!modeSet.current) {
      modeSet.current = true;
      // iOS: play even with the ringer switch on silent (a session is deliberate listening), and
      // keep playing with the screen locked or the app in the background.
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }).catch(() => undefined);
      if (Platform.OS !== 'web') {
        try {
          // Lock-screen and notification controls (play/pause) for the session.
          player.setActiveForLockScreen(true, { title });
        } catch {
          // Not available on this platform.
        }
      }
    }
    try {
      player.play();
    } catch {
      goSilent();
    }
  }, [player, silent, goSilent, title]);

  const seekTo = useCallback((to: number) => {
    setSeekRequest((r) => ({ to: Math.max(0, to), n: (r?.n ?? 0) + 1 }));
  }, []);

  const pause = useCallback(() => {
    setWanted(false);
    try {
      player.pause();
    } catch {
      // Nothing to pause.
    }
  }, [player]);

  useEffect(
    () => () => {
      if (Platform.OS === 'web') return;
      try {
        player.setActiveForLockScreen(false);
      } catch {
        // Already released.
      }
    },
    [player],
  );

  return useMemo(
    () => ({
      player,
      wanted,
      silent,
      fallbackDurationSec,
      play,
      pause,
      goSilent,
      seekTo,
      positionRef,
      durationRef,
      seekRequest,
    }),
    [player, wanted, silent, fallbackDurationSec, play, pause, goSilent, seekTo, seekRequest],
  );
}

export interface TrackStatus {
  /** Seconds. */
  position: number;
  duration: number;
  playing: boolean;
  finished: boolean;
}

export interface TrackStatusOptions {
  /** Called once when the track (or the silent timer) reaches its end. */
  onFinish?: () => void;
  /** How long to wait for the audio to load or to start moving before falling back to a timer. */
  stallMs?: number;
  now?: () => number;
}

export function useTrackStatus(track: Track, options: TrackStatusOptions = {}): TrackStatus {
  const { stallMs = 5000 } = options;
  const now = options.now ?? Date.now;
  const { player, wanted, silent, fallbackDurationSec, goSilent, seekRequest } = track;
  const status = useAudioPlayerStatus(player);
  const [timerPosition, setTimerPosition] = useState(0);
  const timerFinished = silent && timerPosition >= fallbackDurationSec;
  const latest = useRef(status);
  const onFinish = useRef(options.onFinish);
  const finishedBefore = useRef(false);
  useEffect(() => {
    latest.current = status;
    onFinish.current = options.onFinish;
  });

  // Stall watch: asked to play, but nothing happens for a while.
  useEffect(() => {
    if (!wanted || silent) return;
    const start = now();
    let lastMove = { at: start, position: latest.current.currentTime };
    const timer = setInterval(() => {
      const s = latest.current;
      // Any movement counts (a jump back too): only a clock that stands still is a stall.
      if (s.isLoaded && s.playing && s.currentTime !== lastMove.position) {
        lastMove = { at: now(), position: s.currentTime };
        return;
      }
      if (now() - lastMove.at > stallMs) {
        setTimerPosition(s.currentTime || 0);
        goSilent();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [wanted, silent, stallMs, now, goSilent]);

  // Silent fallback: a plain clock.
  useEffect(() => {
    if (!silent || !wanted || timerFinished) return;
    let last = now();
    const timer = setInterval(() => {
      const t = now();
      setTimerPosition((p) => Math.min(fallbackDurationSec, p + (t - last) / 1000));
      last = t;
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [silent, wanted, timerFinished, fallbackDurationSec, now]);

  const duration =
    !silent && status.isLoaded && Number.isFinite(status.duration) && status.duration > 0
      ? status.duration
      : fallbackDurationSec;
  const finished = silent
    ? timerFinished
    : status.didJustFinish ||
      (status.isLoaded &&
        duration > 0 &&
        status.currentTime >= duration - 0.05 &&
        !status.playing &&
        wanted);

  // A requested jump: the silent timer moves at once; the audio once it has loaded.
  const appliedSeek = useRef(0);
  useEffect(() => {
    if (!seekRequest || appliedSeek.current === seekRequest.n) return;
    if (silent) {
      appliedSeek.current = seekRequest.n;
      const to = Math.min(fallbackDurationSec, seekRequest.to);
      const timer = setTimeout(() => setTimerPosition(to), 0);
      return () => clearTimeout(timer);
    }
    if (!status.isLoaded) return;
    appliedSeek.current = seekRequest.n;
    const length = Number.isFinite(status.duration) && status.duration > 0 ? status.duration : null;
    player
      .seekTo(length ? Math.min(length, seekRequest.to) : seekRequest.to)
      .catch(() => undefined);
  }, [seekRequest, silent, status.isLoaded, status.duration, fallbackDurationSec, player]);

  // The end is reported once, as an event (the caller usually moves on from it).
  useEffect(() => {
    if (!finished || finishedBefore.current) return;
    finishedBefore.current = true;
    onFinish.current?.();
  }, [finished]);

  const position = silent
    ? timerPosition
    : Number.isFinite(status.currentTime)
      ? status.currentTime
      : 0;
  const { positionRef, durationRef } = track;
  useEffect(() => {
    positionRef.current = position;
    durationRef.current = duration;
  }, [position, duration, positionRef, durationRef]);
  return {
    position,
    duration,
    playing: silent ? wanted && !timerFinished : status.playing,
    finished,
  };
}

/** m:ss for a number of seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
