import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text as RNText } from 'react-native';

import { AtmosphereProvider, useAtmosphere, useTheme } from './atmosphere';
import { contrastRatio, withAlpha, WCAG_AA_LARGE, WCAG_AA_TEXT } from './contrast';
import { palette } from './palette';
import { daylightTheme, nightTheme, themes } from './themes';
import { SURFACE_TONES, textToneColor } from './tones';

describe('contrast', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow();
  });

  it('derives rgba tints from hex colours', () => {
    expect(withAlpha('#1D6E6A', 0.18)).toBe('rgba(29, 110, 106, 0.18)');
    expect(() => withAlpha('teal', 0.5)).toThrow();
  });

  it.each(Object.values(themes))('$atmosphere text colours meet WCAG AA', (theme) => {
    const c = theme.colors;
    // Every text tone offered for ordinary surfaces, on every ordinary surface (body text: 4.5:1).
    for (const bg of [c.background, c.surface, c.surfaceRaised]) {
      for (const tone of SURFACE_TONES) {
        const ratio = contrastRatio(textToneColor(theme, tone), bg);
        expect({ tone, bg, ratio }).toEqual(expect.objectContaining({ ratio: expect.any(Number) }));
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
    }
    // Muted text also appears on sunken surfaces (chips).
    expect(contrastRatio(c.textMuted, c.surfaceSunken)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.textOnAccent, c.accent)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.textOnPrimary, c.primary)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.textInverse, c.primaryDeep)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.textInverse, c.water)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.tabBarActive, c.tabBar)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.tabBarInactive, c.tabBar)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.focusRing, c.background)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    // Errors: text on the error notice, labels on the destructive button, field borders.
    expect(contrastRatio(c.textDanger, c.dangerSoft)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.textPrimary, c.dangerSoft)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    expect(contrastRatio(c.textOnPrimary, c.danger)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    // Form field outlines are non-text UI: 3:1 against the surfaces fields sit on.
    for (const bg of [c.background, c.surface]) {
      expect(contrastRatio(c.inputBorder, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    }
    // Large display text (titles, numbers) on the accent itself.
    expect(contrastRatio(c.textPrimary, c.primarySoft)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it('keeps the concept palette intact', () => {
    expect(palette.crocGreen).toBe('#3F6B35');
    expect(palette.amber).toBe('#F2A93B');
    expect(palette.nightRiver).toBe('#08171A');
  });
});

function Probe({ label }: { label: string }) {
  const { atmosphere, theme, setAtmosphere } = useAtmosphere();
  const resolved = useTheme();
  return (
    <Pressable
      testID={`probe-${label}`}
      onPress={() => setAtmosphere(atmosphere === 'night' ? 'daylight' : 'night')}
    >
      <RNText testID={`atmo-${label}`}>{atmosphere}</RNText>
      <RNText testID={`bg-${label}`}>{resolved.colors.background}</RNText>
      <RNText testID={`same-${label}`}>{String(theme === resolved)}</RNText>
    </Pressable>
  );
}

describe('AtmosphereProvider', () => {
  it('defaults to daylight and switches to night', async () => {
    await render(
      <AtmosphereProvider>
        <Probe label="a" />
      </AtmosphereProvider>,
    );
    expect(screen.getByTestId('atmo-a')).toHaveTextContent('daylight');
    expect(screen.getByTestId('bg-a')).toHaveTextContent(daylightTheme.colors.background);
    await fireEvent.press(screen.getByTestId('probe-a'));
    expect(screen.getByTestId('atmo-a')).toHaveTextContent('night');
    expect(screen.getByTestId('bg-a')).toHaveTextContent(nightTheme.colors.background);
    expect(screen.getByTestId('same-a')).toHaveTextContent('true');
  });

  it('nested providers override a subtree without touching the parent', async () => {
    await render(
      <AtmosphereProvider>
        <Probe label="outer" />
        <AtmosphereProvider atmosphere="night">
          <Probe label="inner" />
        </AtmosphereProvider>
      </AtmosphereProvider>,
    );
    expect(screen.getByTestId('atmo-outer')).toHaveTextContent('daylight');
    expect(screen.getByTestId('atmo-inner')).toHaveTextContent('night');
  });

  it('controlled mode reports changes through onChange and keeps the given value', async () => {
    const onChange = jest.fn();
    await render(
      <AtmosphereProvider atmosphere="daylight" onChange={onChange}>
        <Probe label="c" />
      </AtmosphereProvider>,
    );
    await fireEvent.press(screen.getByTestId('probe-c'));
    expect(onChange).toHaveBeenCalledWith('night');
    expect(screen.getByTestId('atmo-c')).toHaveTextContent('daylight');
  });

  it('falls back to daylight outside a provider', async () => {
    await render(<Probe label="none" />);
    expect(screen.getByTestId('atmo-none')).toHaveTextContent('daylight');
  });
});
