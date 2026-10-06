import type { AudioSource } from 'expo-audio';
import { Platform } from 'react-native';

import type { Stop } from '@/content/types';

/**
 * The media for a stop. Every stop points at placeholder media for now (`mediaRef` is resolved
 * here once MHP's real tracks and lessons arrive through the content pack or a CMS).
 */
export type SessionMedia =
  | { kind: 'audio'; source: AudioSource; fallbackSec: number }
  | { kind: 'video'; source: number; poster: number; captions: string; fallbackSec: number }
  | { kind: 'visual'; durationSec: number }
  | { kind: 'game' };

const SESSION_TRACK = require('../../../assets/audio/session.mp3');
/** Length of the placeholder session track (and of its silent fallback). */
export const SESSION_TRACK_SECONDS = 90;

// H.264 for the apps; VP8 for browsers that lack H.264 (Chromium builds).
const LESSON_VIDEO =
  Platform.OS === 'web'
    ? require('../../../assets/video/lesson.webm')
    : require('../../../assets/video/lesson.mp4');
const LESSON_POSTER = require('../../../assets/video/lesson-poster.jpg');
export const LESSON_SECONDS = 20;

/** Placeholder captions for the placeholder lesson (WebVTT). */
export const LESSON_CAPTIONS = `WEBVTT

00:00:00.500 --> 00:00:05.000
[Caption 1]

00:00:05.500 --> 00:00:10.000
[Caption 2]

00:00:10.500 --> 00:00:15.000
[Caption 3]

00:00:15.500 --> 00:00:19.500
[Caption 4]
`;

export function mediaFor(stop: Stop): SessionMedia {
  switch (stop.type) {
    case 'audio':
    case 'longTrance':
      return { kind: 'audio', source: SESSION_TRACK, fallbackSec: SESSION_TRACK_SECONDS };
    case 'video':
      return {
        kind: 'video',
        source: LESSON_VIDEO,
        poster: LESSON_POSTER,
        captions: LESSON_CAPTIONS,
        fallbackSec: LESSON_SECONDS,
      };
    case 'visual':
      return { kind: 'visual', durationSec: stop.durationSec };
    case 'game':
      return { kind: 'game' };
  }
}
