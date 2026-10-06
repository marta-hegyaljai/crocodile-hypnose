import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { clampProgress, ProgressBar } from './ProgressBar';

describe('clampProgress', () => {
  it('clamps into 0..1 and ignores NaN', () => {
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(2)).toBe(1);
    expect(clampProgress(0.4)).toBe(0.4);
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('ProgressBar', () => {
  it('exposes the value to assistive tech', async () => {
    await render(<ProgressBar progress={0.357} testID="bar" />);
    const bar = screen.getByTestId('bar');
    expect(bar).toHaveProp('accessibilityRole', 'progressbar');
    expect(bar).toHaveProp('accessibilityValue', { min: 0, max: 100, now: 36 });
    expect(bar).toHaveProp('accessibilityLabel', '36 percent');
  });

  it('clamps out-of-range values', async () => {
    await render(<ProgressBar progress={7} testID="bar" />);
    expect(screen.getByTestId('bar')).toHaveProp('accessibilityValue', {
      min: 0,
      max: 100,
      now: 100,
    });
  });
});
