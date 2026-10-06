import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { MotionProvider } from '@/motion/MotionProvider';
import { AtmosphereProvider } from '@/theme';

import { Reveal } from './Reveal';

async function show(reduced: boolean) {
  await render(
    <MotionProvider initialOverride={reduced}>
      <AtmosphereProvider>
        <Reveal testID="reveal">
          <Text>Hello</Text>
        </Reveal>
      </AtmosphereProvider>
    </MotionProvider>,
  );
}

describe('Reveal', () => {
  it('renders its content', async () => {
    await show(false);
    expect(screen.getByText('Hello')).toBeOnTheScreen();
    expect(screen.getByTestId('reveal')).toBeOnTheScreen();
  });

  it('is fully visible at once under reduced motion', async () => {
    await show(true);
    expect(screen.getByTestId('reveal')).toHaveStyle({ opacity: 1 });
  });
});
