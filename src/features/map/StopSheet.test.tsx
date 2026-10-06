import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { deriveJourney } from '@/content/journey';
import { localContent } from '@/content/repository';
import { defaultProgress } from '@/services/progress/types';
import { markDone } from '@/services/progress/mergeProgress';

import { StopSheet } from './StopSheet';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const journey = deriveJourney(localContent, markDone(defaultProgress(), 'intro-1', 1), {
  cautionMode: true,
});

async function show(stopId: string) {
  const onStart = jest.fn();
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StopSheet
        view={journey.byStopId.get(stopId)!}
        zoneTitle="Intro"
        onStart={onStart}
        onClose={onClose}
      />
    </SafeAreaProvider>,
  );
  return { onStart, onClose };
}

describe('StopSheet', () => {
  it('a locked stop explains why and has no start button', async () => {
    const { onClose } = await show('intro-3');
    expect(screen.getByTestId('stop-sheet-message')).toHaveTextContent(
      'Finish Intro · Stop 2 first to unlock this stop.',
    );
    expect(screen.queryByTestId('stop-sheet-start')).toBeNull();
    await fireEvent.press(screen.getByTestId('stop-sheet-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('an available stop shows type and length and starts', async () => {
    const { onStart } = await show('intro-2');
    expect(screen.getByTestId('stop-sheet-type')).toHaveTextContent('Audio');
    expect(screen.getByTestId('stop-sheet-duration')).toHaveTextContent('3 min');
    await fireEvent.press(screen.getByTestId('stop-sheet-start'));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ status: 'available' }));
  });

  it('a finished stop can be played again; a caution stop cannot be started', async () => {
    await show('intro-1');
    expect(screen.getByTestId('stop-sheet-start')).toHaveTextContent('Play again');
    await screen.unmount();
    await show('intro-9');
    expect(screen.queryByTestId('stop-sheet-start')).toBeNull();
  });
});
