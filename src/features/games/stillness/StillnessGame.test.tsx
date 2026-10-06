import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { GameProps } from '../GameShell';
import { STILLNESS_DURATION_MS, StillnessGame } from './StillnessGame';

// The clock is driven by hand: the test calls the game's tick with the time it wants.
let mockTick: ((timeMs: number) => void) | undefined;
jest.mock('../useGameClock', () => ({
  useGameClock: (_running: boolean, onTick?: (t: number) => void) => {
    mockTick = onTick;
    return { timeMs: { value: 0 } };
  },
}));

let mockResolveAvailable: (ok: boolean) => void = () => undefined;
const mockStop = jest.fn();
jest.mock('./motionSource', () => ({
  subscribeMotion: () => ({
    available: new Promise<boolean>((resolve) => {
      mockResolveAvailable = resolve;
    }),
    stop: mockStop,
  }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function Game(props: GameProps) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <StillnessGame {...props} />
    </SafeAreaProvider>
  );
}

const tickAt = (t: number) => act(async () => mockTick?.(t));

beforeEach(() => {
  mockTick = undefined;
  mockStop.mockClear();
});

describe('StillnessGame', () => {
  it('ends at its duration with the gentle result when the finger never rests', async () => {
    const onFinish = jest.fn();
    await render(<Game running ended={false} onFinish={onFinish} />);
    await act(async () => mockResolveAvailable(false));
    expect(await screen.findByTestId('stillness-pad')).toBeTruthy();

    await tickAt(5_000);
    expect(onFinish).not.toHaveBeenCalled();
    await tickAt(STILLNESS_DURATION_MS + 100);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ gameId: 'stillness', score: 100 });
    // And only once.
    await tickAt(STILLNESS_DURATION_MS + 400);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('ends at its duration even while the sensor probe is still pending', async () => {
    const onFinish = jest.fn();
    await render(<Game running ended={false} onFinish={onFinish} />);
    await tickAt(STILLNESS_DURATION_MS + 100);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('keeps the sensor probe alive across a pause and resume', async () => {
    const onFinish = jest.fn();
    const view = await render(<Game running ended={false} onFinish={onFinish} />);
    // Paused while the probe is still out.
    await view.rerender(<Game running={false} ended={false} onFinish={onFinish} />);
    await act(async () => mockResolveAvailable(false));
    await view.rerender(<Game running ended={false} onFinish={onFinish} />);

    // The probe's answer was not dropped: the pad is there and the game plays on to its end.
    expect(await screen.findByTestId('stillness-pad')).toBeTruthy();
    await fireEvent(screen.getByTestId('stillness-pad'), 'pressIn');
    await tickAt(1_000);
    await tickAt(STILLNESS_DURATION_MS + 100);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('uses the sensor when the probe answers yes while paused', async () => {
    const onFinish = jest.fn();
    const view = await render(<Game running ended={false} onFinish={onFinish} />);
    await view.rerender(<Game running={false} ended={false} onFinish={onFinish} />);
    await act(async () => mockResolveAvailable(true));
    await view.rerender(<Game running ended={false} onFinish={onFinish} />);
    expect(screen.queryByTestId('stillness-pad')).toBeNull();
    await tickAt(1_000);
    await tickAt(STILLNESS_DURATION_MS + 100);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
