import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MotionProvider } from '@/motion/MotionProvider';
import { AtmosphereProvider } from '@/theme';

import { Croc } from './Croc';
import { CROC_EXPRESSIONS, CROC_STAGES } from './types';

describe('Croc', () => {
  it('renders every stage and expression in both poses', async () => {
    for (const stage of CROC_STAGES) {
      for (const expression of CROC_EXPRESSIONS) {
        for (const pose of ['full', 'peek'] as const) {
          const { unmount } = await render(
            <Croc
              stage={stage}
              expression={expression}
              pose={pose}
              width={120}
              animated={false}
              testID="croc"
            />,
          );
          expect(screen.getByTestId('croc')).toBeOnTheScreen();
          await unmount();
        }
      }
    }
  });

  it('labels itself for screen readers with name and stage', async () => {
    await render(<Croc stage="adult" width={100} name="Nessie" animated={false} testID="croc" />);
    expect(screen.getByTestId('croc')).toHaveProp('accessibilityLabel', 'Nessie, Stage 4');
    await render(<Croc stage="egg" width={100} animated={false} testID="egg" />);
    expect(screen.getByTestId('egg')).toHaveProp('accessibilityLabel', 'Crocodile egg');
  });

  it('never blinks under reduced motion', async () => {
    jest.useFakeTimers();
    try {
      await render(
        <MotionProvider initialOverride={true}>
          <AtmosphereProvider>
            <Croc stage="juvenile" expression="happy" width={200} testID="croc" />
          </AtmosphereProvider>
        </MotionProvider>,
      );
      const before = JSON.stringify(screen.toJSON());
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
        });
        expect(JSON.stringify(screen.toJSON())).toBe(before);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('blinks when motion is allowed', async () => {
    jest.useFakeTimers();
    try {
      await render(
        <MotionProvider initialOverride={false}>
          <AtmosphereProvider>
            <Croc stage="juvenile" expression="happy" width={200} testID="croc" />
          </AtmosphereProvider>
        </MotionProvider>,
      );
      const before = JSON.stringify(screen.toJSON());
      let changed = false;
      // The blink comes between 0.6x and 1.4x the idle interval (3.2s in daylight).
      for (let i = 0; i < 120 && !changed; i++) {
        await act(async () => {
          jest.advanceTimersByTime(50);
        });
        changed = JSON.stringify(screen.toJSON()) !== before;
      }
      expect(changed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
