import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { MotionProvider } from '@/motion/MotionProvider';

import { RewardSheet } from './SessionDay';

describe('session day screens', () => {
  it('the reward shows the points (counted at once with reduced motion) and the first-time bonus', async () => {
    const onContinue = jest.fn();
    await render(
      <MotionProvider initialOverride>
        <RewardSheet points={{ base: 10, bonus: 20, total: 30 }} onContinue={onContinue} />
      </MotionProvider>,
    );
    await waitFor(
      () => expect(screen.getByTestId('session-reward-points')).toHaveTextContent('+30 Points'),
      { timeout: 3000 },
    );
    expect(screen.getByTestId('session-reward-first')).toHaveTextContent(/\+20/);
    fireEvent.press(screen.getByTestId('session-reward-continue'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('a replay shows no first-time bonus', async () => {
    await render(<RewardSheet points={{ base: 10, bonus: 0, total: 10 }} onContinue={jest.fn()} />);
    expect(screen.queryByTestId('session-reward-first')).toBeNull();
  });
});
