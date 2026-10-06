/**
 * How much of a session was really listened to (or watched), as merged [from, to] second ranges.
 * Only natural playback counts: a step forward no longer than `MAX_STEP_SEC` between two status
 * ticks. A seek (forward or back) adds nothing, and listening to a part twice counts once, so a
 * session cannot be finished by scrubbing to the end.
 */
export type Coverage = readonly (readonly [number, number])[];

/** Status ticks come every 250 ms; a slow device or a background tab may skip a few. */
export const MAX_STEP_SEC = 2.5;
/** Share of the session that must have been listened to for it to count as done. */
export const COMPLETE_RATIO = 0.9;

export function addRange(coverage: Coverage, from: number, to: number): Coverage {
  if (!(to > from)) return coverage;
  const ranges = [...coverage, [from, to] as const].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [a, b] of ranges) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 0.01) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

/** Playback moved from `previous` to `position`: counts it if it was natural playback. */
export function advance(coverage: Coverage, previous: number, position: number): Coverage {
  const step = position - previous;
  if (step <= 0 || step > MAX_STEP_SEC) return coverage;
  return addRange(coverage, previous, position);
}

export function listenedSeconds(coverage: Coverage): number {
  return coverage.reduce((sum, [a, b]) => sum + (b - a), 0);
}

/** Done once at least `COMPLETE_RATIO` of the session's length was listened to. */
export function isComplete(coverage: Coverage, duration: number): boolean {
  return duration > 0 && listenedSeconds(coverage) >= duration * COMPLETE_RATIO - 0.01;
}

export function isCoverage(value: unknown): value is Coverage {
  return (
    Array.isArray(value) &&
    value.length <= 500 &&
    value.every(
      (r) =>
        Array.isArray(r) &&
        r.length === 2 &&
        typeof r[0] === 'number' &&
        typeof r[1] === 'number' &&
        Number.isFinite(r[0]) &&
        Number.isFinite(r[1]) &&
        r[0] >= 0 &&
        r[1] > r[0],
    )
  );
}
