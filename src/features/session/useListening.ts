import { useAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

import { devMode } from '@/config/env';

import { addRange, advance, type Coverage } from './listening';

export interface Listening {
  /** What was listened to so far. */
  coverage(): Coverage;
  /** The playback position moved (a status tick). */
  tick(position: number): void;
  /** Counts a stretch as listened (the dev fast-forward hook only). */
  add(from: number, to: number): void;
}

/** Follows the playback position and keeps what was really listened to (see `listening.ts`). */
export function useListening(initial: Coverage = []): Listening {
  const coverage = useRef<Coverage>(initial);
  const last = useRef<number | null>(null);
  return useMemo(
    () => ({
      coverage: () => coverage.current,
      tick(position) {
        if (last.current !== null)
          coverage.current = advance(coverage.current, last.current, position);
        last.current = position;
      },
      add(from, to) {
        coverage.current = addRange(coverage.current, from, to);
        last.current = to;
      },
    }),
    [],
  );
}

/**
 * Dev builds only (e2e, QA): `globalThis.__mhpSession.fastForward(seconds)` plays the next
 * `seconds` of the session instantly, as if they had been listened to. Release builds never
 * have it, so a session there can only be finished by listening.
 */
export function useDevFastForward(
  enabled: boolean,
  position: () => number,
  duration: () => number,
  listening: Listening,
  seekTo: (seconds: number) => void,
) {
  useEffect(() => {
    if (!devMode || !enabled) return;
    const hook = {
      fastForward(seconds: number) {
        const from = position();
        const to = Math.min(duration(), from + seconds);
        listening.add(from, to);
        seekTo(to);
      },
    };
    const g = globalThis as { __mhpSession?: typeof hook };
    g.__mhpSession = hook;
    return () => {
      if (g.__mhpSession === hook) delete g.__mhpSession;
    };
  }, [enabled, position, duration, listening, seekTo]);
}

/**
 * Web: pause when an audio device goes away (headphones unplugged; the browser reports any
 * device change, so it also pauses when one is plugged in, which is harmless). Native follows the
 * system's own route-change handling.
 */
export function usePauseOnDeviceChange(active: boolean, pause: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!devices?.addEventListener) return;
    const onChange = () => pause();
    devices.addEventListener('devicechange', onChange);
    return () => devices.removeEventListener('devicechange', onChange);
  }, [active, pause]);
}

export const SOUNDSCAPES = ['none', 'river', 'rain', 'night'] as const;
export type Soundscape = (typeof SOUNDSCAPES)[number];

const SOUNDSCAPE_SOURCES: Record<Exclude<Soundscape, 'none'>, AudioSource> = {
  river: require('../../../assets/audio/soundscape-river.mp3'),
  rain: require('../../../assets/audio/soundscape-rain.mp3'),
  night: require('../../../assets/audio/soundscape-night.mp3'),
};

function applySoundscape(player: AudioPlayer, on: boolean) {
  try {
    player.loop = true;
    player.volume = 0.35;
    if (on) player.play();
    else player.pause();
  } catch {
    // The background sound is optional; the session goes on without it.
  }
}

/** A quiet looping background sound under the session, playing while the session plays. */
export function useSoundscape(choice: Soundscape, playing: boolean) {
  const player = useAudioPlayer(choice === 'none' ? null : SOUNDSCAPE_SOURCES[choice]);
  useEffect(() => {
    applySoundscape(player, playing && choice !== 'none');
  }, [player, playing, choice]);
}
