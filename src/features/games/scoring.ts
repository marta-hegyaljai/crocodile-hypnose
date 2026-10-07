/**
 * Pure game logic: how stillness, the firefly's path and the breaths are measured. No UI, no
 * timers; everything takes the time as an argument so it is testable and can run on either thread.
 */

export const clamp01 = (v: number): number => {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
};

/* ---------------------------------- Stillness ---------------------------------- */

export interface StillnessOptions {
  /**
   * Movement per sample that counts as "not still at all" (1 g of acceleration change for the
   * sensor, a 24 pt finger slide for touch). Movement above it is clipped.
   */
  fullMotion: number;
  /** How quickly the level follows the latest samples (0..1 per sample). */
  smoothing?: number;
}

/**
 * Tracks how still the user is. `level()` is the current stillness 0..1 (1 = perfectly still),
 * smoothed so the croc moves gently; `score()` is the whole game's stillness 0..100, the mean of
 * the sampled levels. A game with no samples at all scores 100: nothing moved.
 */
export class StillnessTracker {
  private level_ = 1;
  private sum = 0;
  private count = 0;
  private readonly fullMotion: number;
  private readonly smoothing: number;

  constructor({ fullMotion, smoothing = 0.12 }: StillnessOptions) {
    this.fullMotion = fullMotion;
    this.smoothing = smoothing;
  }

  /** `movement` is the absolute change since the last sample, in the source's units. */
  addSample(movement: number): void {
    const still = 1 - clamp01(Math.abs(movement) / this.fullMotion);
    this.level_ += (still - this.level_) * this.smoothing;
    this.sum += this.level_;
    this.count++;
  }

  level(): number {
    return this.level_;
  }

  /** How many samples were taken (0 when the finger never rested or the sensor stayed silent). */
  samples(): number {
    return this.count;
  }

  score(): number {
    if (this.count === 0) return 100;
    return Math.round((this.sum / this.count) * 100);
  }
}

/* ----------------------------------- Firefly ----------------------------------- */

export const FIREFLY_ROUNDS = 3;
/** Seconds per loop of the path, round by round: each round is slower than the one before. */
export const FIREFLY_PERIODS_S = [9, 12, 15] as const;
/** Loops per round. */
export const FIREFLY_LOOPS = 2;
/** The "close your eyes" moment after the last round. */
export const FIREFLY_EYES_CLOSED_MS = 8000;

export const fireflyRoundDurationMs = (round: number): number =>
  FIREFLY_PERIODS_S[Math.min(round, FIREFLY_PERIODS_S.length - 1)]! * 1000 * FIREFLY_LOOPS;

export const fireflyTotalMs = (): number => {
  let total = 0;
  for (let r = 0; r < FIREFLY_ROUNDS; r++) total += fireflyRoundDurationMs(r);
  return total + FIREFLY_EYES_CLOSED_MS;
};

export type FireflyPhase =
  { kind: 'round'; round: number; progress: number } | { kind: 'eyesClosed' } | { kind: 'done' };

/** Where the game is at `t` ms since the start. */
export function fireflyPhase(t: number): FireflyPhase {
  let at = 0;
  for (let r = 0; r < FIREFLY_ROUNDS; r++) {
    const d = fireflyRoundDurationMs(r);
    if (t < at + d) return { kind: 'round', round: r, progress: (t - at) / d };
    at += d;
  }
  if (t < at + FIREFLY_EYES_CLOSED_MS) return { kind: 'eyesClosed' };
  return { kind: 'done' };
}

/**
 * The firefly's position at `t` ms as fractions of the stage (0..1): a slow figure-of-eight that
 * widens a little each round, always inside a comfortable band of the screen. Continuous across
 * round changes (each round starts where the previous ended, at the figure's centre).
 */
export function fireflyPoint(t: number): { x: number; y: number } {
  'worklet';
  let at = 0;
  let round = FIREFLY_ROUNDS - 1;
  let local = 0;
  for (let r = 0; r < FIREFLY_ROUNDS; r++) {
    const d = FIREFLY_PERIODS_S[Math.min(r, FIREFLY_PERIODS_S.length - 1)]! * 1000 * FIREFLY_LOOPS;
    if (t < at + d) {
      round = r;
      local = t - at;
      break;
    }
    at += d;
    local = d;
  }
  const period = FIREFLY_PERIODS_S[Math.min(round, FIREFLY_PERIODS_S.length - 1)]! * 1000;
  const a = ((local % period) / period) * Math.PI * 2;
  const spread = 0.26 + round * 0.04;
  return {
    x: 0.5 + Math.sin(a) * spread,
    y: 0.5 + Math.sin(2 * a) * spread * 0.55,
  };
}

/* ---------------------------------- Breathing ---------------------------------- */

/** One breath cycle of the guide ring: 5 s in, 5 s out (about 6 breaths per minute). */
export const BREATH_PERIOD_MS = 10_000;
/** A hold shorter than this is a tap, not an in-breath. */
export const MIN_HOLD_MS = 1500;

/** The guide at `t`: inhaling in the first half, exhaling in the second, with 0..1 progress. */
export function guidePhase(t: number): { inhale: boolean; progress: number } {
  'worklet';
  const p = (t % BREATH_PERIOD_MS) / BREATH_PERIOD_MS;
  return p < 0.5 ? { inhale: true, progress: p * 2 } : { inhale: false, progress: (p - 0.5) * 2 };
}

/**
 * Counts breaths: pressing is breathing in, releasing is breathing out. A breath is complete when
 * a hold of at least `MIN_HOLD_MS` is released. Double taps and bounces never count.
 */
export class BreathCounter {
  private pressedAt: number | null = null;
  private breaths_ = 0;

  press(t: number): void {
    if (this.pressedAt === null) this.pressedAt = t;
  }

  /** Returns true when this release completed a breath. */
  release(t: number): boolean {
    if (this.pressedAt === null) return false;
    const held = t - this.pressedAt;
    this.pressedAt = null;
    if (held >= MIN_HOLD_MS) {
      this.breaths_++;
      return true;
    }
    return false;
  }

  holding(): boolean {
    return this.pressedAt !== null;
  }

  breaths(): number {
    return this.breaths_;
  }
}
