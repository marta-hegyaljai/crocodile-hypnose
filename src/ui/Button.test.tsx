import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { AtmosphereProvider } from '@/theme';

import { Button } from './Button';

async function renderButton(props: Partial<React.ComponentProps<typeof Button>> = {}) {
  const onPress = jest.fn();
  await render(
    <AtmosphereProvider>
      <Button label="Continue" onPress={onPress} testID="btn" {...props} />
    </AtmosphereProvider>,
  );
  return { onPress };
}

describe('Button', () => {
  it('renders the label and calls onPress', async () => {
    const { onPress } = await renderButton();
    expect(screen.getByText('Continue')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
  });

  it('does not fire when disabled and exposes the state', async () => {
    const { onPress } = await renderButton({ disabled: true });
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn')).toBeDisabled();
  });

  it('shows a spinner, blocks presses and announces busy while loading', async () => {
    const { onPress } = await renderButton({ loading: true });
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn')).toBeBusy();
    expect(screen.getByTestId('btn')).toBeDisabled();
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    // The label stays mounted (keeps the width) but is hidden.
    expect(screen.getByText('Continue')).toBeOnTheScreen();
  });

  it('renders every variant in both atmospheres', async () => {
    for (const atmosphere of ['daylight', 'night'] as const) {
      for (const variant of ['primary', 'secondary', 'ghost'] as const) {
        const { unmount } = await render(
          <AtmosphereProvider atmosphere={atmosphere}>
            <Button
              label={`${atmosphere}-${variant}`}
              variant={variant}
              onPress={() => undefined}
            />
          </AtmosphereProvider>,
        );
        expect(screen.getByText(`${atmosphere}-${variant}`)).toBeOnTheScreen();
        await unmount();
      }
    }
  });

  it('uses a custom accessibility label when given', async () => {
    await renderButton({ accessibilityLabel: 'Start the session' });
    expect(screen.getByRole('button', { name: 'Start the session' })).toBeOnTheScreen();
  });
});
