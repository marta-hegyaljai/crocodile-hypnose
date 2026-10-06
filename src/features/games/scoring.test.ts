import { gameIdOfStop, resultValue } from './catalog';
import {
  BREATH_PERIOD_MS,
  BreathCounter,
  FIREFLY_EYES_CLOSED_MS,
  FIREFLY_ROUNDS,
  StillnessTracker,
  fireflyPhase,
  fireflyPoint,
  fireflyRoundDurationMs,
  fireflyTotalMs,
  guidePhase,
} from './scoring';

describe('StillnessTracker', () => {
  it('scores 100 when nothing ever moved', () => {
    const t = new StillnessTracker({ fullMotion: 1 });
    expect(t.score()).toBe(100);
    for (let i = 0; i < 50; i++) t.addSample(0);
    expect(t.level()).toBe(1);
    expect(t.score()).toBe(100);
  });

  it('drops towards 0 under constant full motion and never below 0', () => {
    const t = new StillnessTracker({ fullMotion: 1 });
    for (let i = 0; i < 200; i++) t.addSample(5);
    expect(t.level()).toBeLessThan(0.01);
    expect(t.score()).toBeGreaterThanOrEqual(0);
    expect(t.score()).toBeLessThan(10);
  });

  it('smooths: one jolt only dents the level and the level recovers when still again', () => {
    const t = new StillnessTracker({ fullMotion: 1, smoothing: 0.2 });
    t.addSample(1);
    expect(t.level()).toBeCloseTo(0.8);
    for (let i = 0; i < 40; i++) t.addSample(0);
    expect(t.level()).toBeGreaterThan(0.99);
    expect(t.score()).toBeGreaterThan(90);
    expect(t.score()).toBeLessThanOrEqual(100);
  });

  it('treats movement direction alike', () => {
    const a = new StillnessTracker({ fullMotion: 2 });
    const b = new StillnessTracker({ fullMotion: 2 });
    a.addSample(1);
    b.addSample(-1);
    expect(a.level()).toBe(b.level());
  });
});

describe('firefly', () => {
  it('runs three rounds, each slower than the last, then the eyes-closed moment, then done', () => {
    let at = 0;
    for (let r = 0; r < FIREFLY_ROUNDS; r++) {
      const d = fireflyRoundDurationMs(r);
      if (r > 0) expect(d).toBeGreaterThan(fireflyRoundDurationMs(r - 1));
      expect(fireflyPhase(at)).toEqual({ kind: 'round', round: r, progress: 0 });
      expect(fireflyPhase(at + d / 2)).toEqual({ kind: 'round', round: r, progress: 0.5 });
      at += d;
    }
    expect(fireflyPhase(at)).toEqual({ kind: 'eyesClosed' });
    expect(fireflyPhase(at + FIREFLY_EYES_CLOSED_MS - 1)).toEqual({ kind: 'eyesClosed' });
    expect(fireflyPhase(at + FIREFLY_EYES_CLOSED_MS)).toEqual({ kind: 'done' });
    expect(fireflyTotalMs()).toBe(at + FIREFLY_EYES_CLOSED_MS);
    // 1 to 3 minutes.
    expect(fireflyTotalMs()).toBeGreaterThanOrEqual(60_000);
    expect(fireflyTotalMs()).toBeLessThanOrEqual(180_000);
  });

  it('keeps the firefly inside a comfortable band of the stage, continuously', () => {
    let prev = fireflyPoint(0);
    expect(prev.x).toBeCloseTo(0.5);
    expect(prev.y).toBeCloseTo(0.5);
    for (let t = 16; t <= fireflyTotalMs(); t += 16) {
      const p = fireflyPoint(t);
      expect(p.x).toBeGreaterThanOrEqual(0.1);
      expect(p.x).toBeLessThanOrEqual(0.9);
      expect(p.y).toBeGreaterThanOrEqual(0.25);
      expect(p.y).toBeLessThanOrEqual(0.75);
      // No jumps: at most a few hundredths of the stage per frame.
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(0.03);
      prev = p;
    }
  });
});

describe('breathing', () => {
  it('paces about six breaths a minute: in for the first half, out for the second', () => {
    expect(60_000 / BREATH_PERIOD_MS).toBe(6);
    expect(guidePhase(0)).toEqual({ inhale: true, progress: 0 });
    expect(guidePhase(BREATH_PERIOD_MS / 4)).toEqual({ inhale: true, progress: 0.5 });
    expect(guidePhase(BREATH_PERIOD_MS / 2)).toEqual({ inhale: false, progress: 0 });
    expect(guidePhase(BREATH_PERIOD_MS * 1.75).inhale).toBe(false);
    expect(guidePhase(BREATH_PERIOD_MS * 1.75).progress).toBeCloseTo(0.5);
  });

  it('counts a hold and release as one breath, ignores taps and double events', () => {
    const c = new BreathCounter();
    expect(c.release(10)).toBe(false);
    c.press(0);
    c.press(100); // a second finger: still the same hold
    expect(c.holding()).toBe(true);
    expect(c.release(4000)).toBe(true);
    expect(c.release(4001)).toBe(false);
    expect(c.breaths()).toBe(1);
    c.press(5000);
    expect(c.release(5300)).toBe(false); // a tap
    expect(c.breaths()).toBe(1);
    expect(c.holding()).toBe(false);
  });
});

describe('catalog', () => {
  it('maps game stops to their game through the media ref', () => {
    expect(gameIdOfStop({ type: 'game', mediaRef: 'game:firefly' })).toBe('firefly');
    expect(gameIdOfStop({ type: 'game', mediaRef: 'game:unknown' })).toBeUndefined();
    expect(gameIdOfStop({ type: 'audio', mediaRef: 'game:firefly' })).toBeUndefined();
  });

  it('ranks results by their number', () => {
    expect(resultValue({ gameId: 'stillness', score: 82 })).toBe(82);
    expect(resultValue({ gameId: 'firefly', rounds: 3, total: 3 })).toBe(3);
    expect(resultValue({ gameId: 'breathing', breaths: 7 })).toBe(7);
  });
});
