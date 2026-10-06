#!/usr/bin/env node
/* global Buffer */
/**
 * Generates the placeholder audio in assets/audio/ (deterministic, no dependencies):
 *
 *   node scripts/make-placeholder-audio.mjs [--wav-only]
 *
 * - first-session.mp3  ~75 s calm track for the onboarding first session: a slow three-note pad
 *                      that swells at a breathing pace over a soft river of filtered noise.
 * - hatch.mp3          a short crack-and-chime for the hatching moment.
 * - tap.mp3            a soft tick for the egg taps.
 *
 * The WAVs are synthesised here and encoded as low-bitrate mono MP3 with ffmpeg (the one on PATH,
 * or Playwright's at /opt/pw-browsers/ffmpeg-*). With --wav-only, or without ffmpeg, the WAVs are
 * written instead (larger; fine for a one-off local run). MHP's real tracks replace these later.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join(process.cwd(), 'assets', 'audio');
const RATE = 22050;
const wavOnly = process.argv.includes('--wav-only');

/** Small deterministic PRNG (mulberry32) so every run produces the same bytes. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Linear fade in over `inSec` and out over `outSec`. */
function envelope(t, total, inSec, outSec) {
  const fadeIn = Math.min(1, t / inSec);
  const fadeOut = Math.min(1, (total - t) / outSec);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

function calmTrack(seconds = 75) {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  const random = rng(7);
  // A2, E3, A3 (and a faint C#4) as a soft pad; each voice breathes at its own slow pace.
  const voices = [
    { f: 110, amp: 0.16, lfo: 1 / 8, phase: 0 },
    { f: 164.81, amp: 0.11, lfo: 1 / 11, phase: 1.3 },
    { f: 220, amp: 0.08, lfo: 1 / 9, phase: 2.1 },
    { f: 277.18, amp: 0.035, lfo: 1 / 13, phase: 0.7 },
  ];
  // River: brown noise (leaky integrator over white noise) with a slow swell.
  let brown = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let pad = 0;
    for (const v of voices) {
      const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * v.lfo * t + v.phase);
      // Two slightly detuned sines per voice for a gentle chorus.
      pad +=
        v.amp *
        swell *
        (Math.sin(2 * Math.PI * v.f * t) + 0.6 * Math.sin(2 * Math.PI * v.f * 1.003 * t + 0.4));
    }
    brown = (brown + (random() * 2 - 1) * 0.02) * 0.995;
    lp += (brown - lp) * 0.08;
    const river = lp * 2.2 * (0.7 + 0.3 * Math.sin(2 * Math.PI * (1 / 17) * t));
    out[i] = (pad + river) * envelope(t, seconds, 4, 6) * 0.9;
  }
  return out;
}

function hatchSound() {
  const seconds = 0.9;
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  const random = rng(11);
  // A short crackle, then three rising chime notes (E5, G#5, B5) that ring out.
  const notes = [
    { f: 659.25, at: 0.06 },
    { f: 830.61, at: 0.17 },
    { f: 987.77, at: 0.28 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let s = 0;
    if (t < 0.06) s += (random() * 2 - 1) * 0.5 * (1 - t / 0.06);
    for (const note of notes) {
      if (t < note.at) continue;
      const dt = t - note.at;
      const decay = Math.exp(-dt * 6);
      s +=
        0.28 *
        decay *
        (Math.sin(2 * Math.PI * note.f * dt) + 0.3 * Math.sin(2 * Math.PI * note.f * 2 * dt));
    }
    out[i] = s * Math.min(1, (seconds - t) / 0.1);
  }
  return out;
}

function tapSound() {
  const seconds = 0.12;
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  const random = rng(5);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    lp += (random() * 2 - 1 - lp) * 0.35;
    const body = Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t * 60);
    out[i] = (lp * 0.5 * Math.exp(-t * 70) + body * 0.45) * 0.8;
  }
  return out;
}

function findFfmpeg() {
  const onPath = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (onPath.status === 0) return 'ffmpeg';
  const root = '/opt/pw-browsers';
  if (!existsSync(root)) return null;
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith('ffmpeg')) continue;
    for (const name of ['ffmpeg', 'ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win64.exe']) {
      const candidate = join(root, dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

mkdirSync(OUT_DIR, { recursive: true });
const ffmpeg = wavOnly ? null : findFfmpeg();
if (!ffmpeg && !wavOnly) console.warn('make-placeholder-audio: ffmpeg not found, writing WAVs');

const tracks = [
  ['first-session', calmTrack(), '32k'],
  ['hatch', hatchSound(), '48k'],
  ['tap', tapSound(), '48k'],
];
for (const [name, samples, bitrate] of tracks) {
  const wavPath = join(OUT_DIR, `${name}.wav`);
  writeFileSync(wavPath, toWav(samples));
  if (!ffmpeg) {
    console.log(`wrote ${wavPath}`);
    continue;
  }
  const mp3Path = join(OUT_DIR, `${name}.mp3`);
  const result = spawnSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-b:a', bitrate, mp3Path],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error(`make-placeholder-audio: ffmpeg failed for ${name}`);
    process.exit(1);
  }
  rmSync(wavPath);
  console.log(`wrote ${mp3Path}`);
}
