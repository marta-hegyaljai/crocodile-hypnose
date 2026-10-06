import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { TapShieldProvider, useTapShield } from './TapShield';

function Probe() {
  const shield = useTapShield();
  return (
    <Pressable testID="start" onPress={() => shield(300)}>
      <Text>start</Text>
    </Pressable>
  );
}

describe('TapShield', () => {
  it('covers the screen for a moment, then gets out of the way', async () => {
    jest.useFakeTimers();
    try {
      await render(
        <TapShieldProvider>
          <Probe />
        </TapShieldProvider>,
      );
      expect(screen.queryByTestId('tap-shield')).toBeNull();
      await fireEvent.press(screen.getByTestId('start'));
      expect(screen.getByTestId('tap-shield')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(301);
      });
      expect(screen.queryByTestId('tap-shield')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
