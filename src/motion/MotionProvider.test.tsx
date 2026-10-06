import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  __resetReducedMotionStoreForTests,
  MotionProvider,
  useMotionSettings,
  useReducedMotion,
} from './MotionProvider';

describe('MotionProvider', () => {
  beforeEach(() => __resetReducedMotionStoreForTests(false));
  afterEach(() => jest.restoreAllMocks());

  it('follows the system setting by default', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result } = await renderHook(() => useReducedMotion(), {
      wrapper: ({ children }) => <MotionProvider>{children}</MotionProvider>,
    });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('does not query the platform once per consumer', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await renderHook(
      () => [
        useReducedMotion(),
        useReducedMotion(),
        useReducedMotion(),
        useReducedMotion(),
        useReducedMotion(),
        useReducedMotion(),
      ],
      { wrapper: ({ children }) => <MotionProvider>{children}</MotionProvider> },
    );
    // One shared subscription (a second call can come from the test harness, never from consumers).
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('lets an override force either direction', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { result } = await renderHook(
      () => ({ settings: useMotionSettings(), reduced: useReducedMotion() }),
      { wrapper: ({ children }) => <MotionProvider>{children}</MotionProvider> },
    );
    await waitFor(() => expect(result.current.settings.systemReducedMotion).toBe(false));
    expect(result.current.reduced).toBe(false);
    await act(async () => result.current.settings.setOverride(true));
    expect(result.current.reduced).toBe(true);
    await act(async () => result.current.settings.setOverride(null));
    expect(result.current.reduced).toBe(false);
  });

  it('works without a provider (system only)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { result } = await renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
