import { render } from '@testing-library/react-native';
import React from 'react';
import * as Reanimated from 'react-native-reanimated';

import { useGameClock } from './useGameClock';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { ...actual, useFrameCallback: jest.fn(actual.useFrameCallback) };
});

function Probe() {
  useGameClock(false);
  return null;
}

describe('useGameClock', () => {
  it('hands Reanimated a worklet as the frame callback (a plain function never runs on iOS/Android)', async () => {
    await render(<Probe />);
    const spy = Reanimated.useFrameCallback as unknown as jest.Mock;
    expect(spy).toHaveBeenCalled();
    const callback = spy.mock.calls[0][0] as { __workletHash?: number };
    expect(typeof callback).toBe('function');
    expect(typeof callback.__workletHash).toBe('number');
  });
});
