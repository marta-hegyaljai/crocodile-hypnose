import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MoodStep } from './SessionDay';

describe('mood check', () => {
  it('the mood check needs a pick to continue, can be skipped, and shows the change after', async () => {
    // The water sways on a loop; fake timers keep it from running.
    jest.useFakeTimers();
    const onContinue = jest.fn();
    const onSkip = jest.fn();
    const onChange = jest.fn();
    const { rerender } = await render(
      <MoodStep
        title="Mood check"
        value={null}
        onChange={onChange}
        onContinue={onContinue}
        onSkip={onSkip}
        testID="mood-after"
      />,
    );
    expect(screen.getByTestId('mood-after-continue')).toBeDisabled();
    fireEvent.press(screen.getByTestId('mood-after-picker-4'));
    expect(onChange).toHaveBeenCalledWith(4);
    fireEvent.press(screen.getByTestId('mood-after-skip'));
    expect(onSkip).toHaveBeenCalled();
    expect(screen.queryByTestId('mood-change')).toBeNull();
    await rerender(
      <MoodStep
        title="Mood check"
        value={4}
        before={2}
        onChange={onChange}
        onContinue={onContinue}
        onSkip={onSkip}
        testID="mood-after"
      />,
    );
    expect(screen.getByTestId('mood-change').props.accessibilityLabel).toBe(
      'Before: Mood 2 · After: Mood 4',
    );
    fireEvent.press(screen.getByTestId('mood-after-continue'));
    expect(onContinue).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
