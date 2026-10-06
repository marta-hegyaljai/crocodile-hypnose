import {
  addRange,
  advance,
  isComplete,
  isCoverage,
  listenedSeconds,
  type Coverage,
} from './listening';

/** Plays from `from` to `to` in 250 ms ticks. */
function play(coverage: Coverage, from: number, to: number): Coverage {
  let c = coverage;
  for (let t = from; t < to; t += 0.25) c = advance(c, t, Math.min(to, t + 0.25));
  return c;
}

describe('listening coverage', () => {
  it('counts natural playback and finishes at 90 %', () => {
    const c = play([], 0, 89);
    expect(listenedSeconds(c)).toBeCloseTo(89);
    expect(isComplete(c, 100)).toBe(false);
    expect(isComplete(play(c, 89, 90), 100)).toBe(true);
  });

  it('scrubbing to the end does not count', () => {
    let c = play([], 0, 10);
    c = advance(c, 10, 99); // a seek
    c = play(c, 99, 100);
    expect(listenedSeconds(c)).toBeCloseTo(11);
    expect(isComplete(c, 100)).toBe(false);
  });

  it('going back and listening again counts once', () => {
    let c = play([], 0, 30);
    c = advance(c, 30, 15); // back 15 s
    c = play(c, 15, 40);
    expect(c).toEqual([[0, 40]]);
    expect(listenedSeconds(c)).toBeCloseTo(40);
  });

  it('merges ranges and validates stored coverage', () => {
    expect(addRange([[10, 20]], 0, 5)).toEqual([
      [0, 5],
      [10, 20],
    ]);
    expect(
      addRange(
        [
          [0, 5],
          [10, 20],
        ],
        4,
        11,
      ),
    ).toEqual([[0, 20]]);
    expect(addRange([[0, 5]], 7, 7)).toEqual([[0, 5]]);
    expect(isCoverage([[0, 5]])).toBe(true);
    expect(isCoverage([[5, 1]])).toBe(false);
    expect(isCoverage('x')).toBe(false);
    expect(isComplete([], 0)).toBe(false);
  });
});
