import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { AtmosphereProvider } from '@/theme';

import { Notice } from './Notice';
import { TextField } from './TextField';

describe('TextField', () => {
  it('is labelled, shows a hint, and an error replaces the hint', async () => {
    const { rerender } = await render(
      <AtmosphereProvider>
        <TextField label="Email" value="" hint="We never share it" testID="f" />
      </AtmosphereProvider>,
    );
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByTestId('f-hint')).toHaveTextContent('We never share it');
    expect(screen.getByTestId('f').props['aria-invalid']).toBe(false);

    await rerender(
      <AtmosphereProvider>
        <TextField
          label="Email"
          value=""
          hint="We never share it"
          error="Enter your email."
          testID="f"
        />
      </AtmosphereProvider>,
    );
    expect(screen.getByTestId('f-error')).toHaveTextContent('Enter your email.');
    expect(screen.queryByTestId('f-hint')).toBeNull();
    expect(screen.getByTestId('f').props['aria-invalid']).toBe(true);
  });

  it('password fields hide the text and toggle visibility', async () => {
    const onVisibilityChange = jest.fn();
    await render(
      <AtmosphereProvider>
        <TextField
          label="Password"
          value="secret"
          secure
          onVisibilityChange={onVisibilityChange}
          testID="p"
        />
      </AtmosphereProvider>,
    );
    expect(screen.getByTestId('p').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByTestId('p').props.secureTextEntry).toBe(false);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByTestId('p').props.secureTextEntry).toBe(true);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('reports focus and typing', async () => {
    const onFocus = jest.fn();
    const onChangeText = jest.fn();
    await render(
      <AtmosphereProvider>
        <TextField label="Name" value="" onFocus={onFocus} onChangeText={onChangeText} testID="n" />
      </AtmosphereProvider>,
    );
    await fireEvent(screen.getByTestId('n'), 'focus');
    await fireEvent.changeText(screen.getByTestId('n'), 'Ann');
    expect(onFocus).toHaveBeenCalled();
    expect(onChangeText).toHaveBeenCalledWith('Ann');
  });

  it('disabled fields are not editable', async () => {
    await render(
      <AtmosphereProvider>
        <TextField label="Email" value="a" disabled testID="d" />
      </AtmosphereProvider>,
    );
    expect(screen.getByTestId('d').props.editable).toBe(false);
  });
});

describe('Notice', () => {
  it('error notices are alerts and offer their action', async () => {
    const onPress = jest.fn();
    await render(
      <AtmosphereProvider>
        <Notice tone="error" message="Offline" action={{ label: 'Retry', onPress }} testID="n" />
      </AtmosphereProvider>,
    );
    // Role on the container (not grouped, so the Retry button stays separately focusable).
    expect(screen.getByTestId('n').props.accessibilityRole).toBe('alert');
    expect(screen.getByTestId('n-message')).toHaveTextContent('Offline');
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('info notices are not alerts', async () => {
    await render(
      <AtmosphereProvider>
        <Notice tone="info" message="Signed out" testID="i" />
      </AtmosphereProvider>,
    );
    expect(screen.getByTestId('i').props.accessibilityRole).toBeUndefined();
    expect(screen.getByText('Signed out')).toBeOnTheScreen();
  });
});
