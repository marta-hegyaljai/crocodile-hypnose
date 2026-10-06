import { act, renderHook } from '@testing-library/react-native';

import { useSubmit } from './useSubmit';

describe('useSubmit', () => {
  it('runs one submit at a time and reports pending', async () => {
    let finish: () => void = () => undefined;
    const action = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = await renderHook(() => useSubmit(action));
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.run();
      void result.current.run();
      void result.current.run();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.pending).toBe(false);
    // Free again once the first one is done.
    await act(async () => {
      void result.current.run();
    });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('a failing action frees the lock', async () => {
    const action = jest.fn(async () => {
      throw new Error('boom');
    });
    const { result } = await renderHook(() => useSubmit(action));
    await act(async () => {
      await expect(result.current.run()).rejects.toThrow('boom');
    });
    expect(result.current.pending).toBe(false);
    await act(async () => {
      await expect(result.current.run()).rejects.toThrow('boom');
    });
    expect(action).toHaveBeenCalledTimes(2);
  });
});
