#!/usr/bin/env node
/**
 * Generates the placeholder video lesson in assets/video/ with ffmpeg (needs libx264 and libvpx):
 *
 *   node scripts/make-placeholder-video.mjs
 *
 * - lesson.mp4         ~20 s portrait clip (H.264, for iOS and Android): a dark river with a
 *                      slowly breathing amber glow, and a soft river sound.
 * - lesson.webm        the same clip as VP8 (browsers without H.264, e.g. Chromium builds).
 * - lesson-poster.jpg  its first calm frame, shown before playback.
 *
 * Slow, low-contrast motion only (no flashing). MHP's real lessons replace these later.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'assets', 'video');
const SECONDS = 20;
mkdirSync(OUT_DIR, { recursive: true });

// Night River (#08171A) with an amber glow whose radius breathes once every 8 s.
const glow = (base, amp) =>
  `${base}+${amp}*exp(-((X-180)*(X-180)+(Y-300)*(Y-300))/(2*pow(46+12*sin(2*PI*T/8),2)))`;
const video = `color=c=0x08171A:s=360x640:r=12:d=${SECONDS},format=rgb24,geq=r='${glow(8, 210)}':g='${glow(23, 140)}':b='${glow(26, 30)}'`;
const audio = `anoisesrc=color=brown:amplitude=0.08:d=${SECONDS},lowpass=f=600,afade=t=in:d=2,afade=t=out:st=${SECONDS - 3}:d=3`;

function run(args, name) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`make-placeholder-video: ffmpeg failed for ${name}`);
    process.exit(1);
  }
  console.log(`wrote ${name}`);
}

const inputs = ['-f', 'lavfi', '-i', video, '-f', 'lavfi', '-i', audio, '-shortest'];
run(
  [
    ...inputs,
    ...['-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-crf', '34'],
    ...['-c:a', 'aac', '-b:a', '32k', '-ac', '1', '-movflags', '+faststart'],
    join(OUT_DIR, 'lesson.mp4'),
  ],
  'assets/video/lesson.mp4',
);
run(
  [
    ...inputs,
    ...['-c:v', 'libvpx', '-b:v', '120k', '-c:a', 'libvorbis', '-b:a', '48k', '-ac', '1'],
    join(OUT_DIR, 'lesson.webm'),
  ],
  'assets/video/lesson.webm',
);
run(
  ['-f', 'lavfi', '-i', video, '-frames:v', '1', '-q:v', '6', join(OUT_DIR, 'lesson-poster.jpg')],
  'assets/video/lesson-poster.jpg',
);
