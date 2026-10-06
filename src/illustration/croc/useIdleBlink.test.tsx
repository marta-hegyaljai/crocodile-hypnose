import { act, renderHook } from '@testing-library/react-native';

import { useIdleBlink } from './useIdleBlink';

describe('useIdleBlink', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('stays open and schedules nothing when disabled', async () => {
    const random = () => 0.5; // wait = interval * 1.0 = 1000ms
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const blinkTimers = () => setTimeoutSpy.mock.calls.filter((call) => call[1] === 1000).length;

    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useIdleBlink({ enabled, interval: 1000, random }),
      { initialProps: { enabled: false } },
    );
    expect(result.current).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(1);
    expect(blinkTimers()).toBe(0);

    // Enabling schedules the next blink; disabling clears it again.
    await rerender({ enabled: true });
    expect(blinkTimers()).toBe(1);
    const clearsBefore = clearTimeoutSpy.mock.calls.length;
    await rerender({ enabled: false });
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(clearsBefore);
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(1);
    expect(blinkTimers()).toBe(1);
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('closes and reopens the eye on schedule when enabled', async () => {
    const random = () => 0.5; // wait = interval * 1.0
    const { result } = await renderHook(() =>
      useIdleBlink({ enabled: true, interval: 1000, random }),
    );
    expect(result.current).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(1000 + 1);
    });
    expect(result.current).toBe(0.5);
    await act(async () => {
      jest.advanceTimersByTime(40);
    });
    expect(result.current).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(90 + 40 + 5);
    });
    expect(result.current).toBe(1);
    // and it keeps going
    await act(async () => {
      jest.advanceTimersByTime(1000 + 40 + 1);
    });
    expect(result.current).toBe(0);
  });

  it('reopens the eye when disabled mid-blink', async () => {
    const random = () => 0.5;
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useIdleBlink({ enabled, interval: 1000, random }),
      { initialProps: { enabled: true } },
    );
    await act(async () => {
      jest.advanceTimersByTime(1000 + 40 + 1);
    });
    expect(result.current).toBe(0);
    await rerender({ enabled: false });
    expect(result.current).toBe(1);
  });
});
