import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { MAX_TICK_SEC, tickSeconds } from './clock';
import { useSessionClock } from './VisualExercise';

describe('tickSeconds', () => {
  it('adds the wall time, but never more than one tick', () => {
    expect(tickSeconds(250)).toBeCloseTo(0.25);
    expect(tickSeconds(60_000)).toBe(MAX_TICK_SEC);
    expect(tickSeconds(-5000)).toBe(0);
    expect(tickSeconds(NaN)).toBe(0);
  });
});

describe('useSessionClock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not jump when the timer slept for 60 s', async () => {
    const { result } = await renderHook(() => useSessionClock(90, true, 10));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    const before = result.current.position;
    expect(before).toBeGreaterThan(10.5);
    // The timer was frozen for a minute (the clock moves, no tick fires in between).
    jest.setSystemTime(Date.now() + 60_000);
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current.position).toBeLessThanOrEqual(before + 1.01);
    expect(result.current.finished).toBe(false);
  });

  it('stands still in the background and carries on after', async () => {
    let state: string = 'active';
    const handlers: ((s: string) => void)[] = [];
    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => state });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      h: (s: string) => void,
    ) => {
      handlers.push(h);
      return { remove: () => undefined };
    }) as never);
    const { result } = await renderHook(() => useSessionClock(90, true, 10));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    const at = result.current.position;
    state = 'background';
    await act(async () => handlers.forEach((h) => h('background')));
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current.position).toBe(at);
    state = 'active';
    await act(async () => handlers.forEach((h) => h('active')));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.position).toBeGreaterThan(at);
    expect(result.current.position).toBeLessThan(at + 2);
    jest.restoreAllMocks();
  });
});
