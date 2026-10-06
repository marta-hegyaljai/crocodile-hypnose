import { en, isPlaceholderKey, isPlaceholderText, t, type CopyKey } from './index';

describe('t()', () => {
  it('returns the copy for a key', () => {
    expect(t('app.name')).toBe('MHP Hypnose');
    expect(t('mood.labels.3')).toBe('Mood 3');
  });

  it('interpolates {params} and leaves unknown tokens visible', () => {
    expect(t('points.amount', { n: 240 })).toBe('240 Points');
    expect(t('a11y.goalProgress', { done: 3, total: 5 })).toBe('3 of 5 days this week');
    expect(t('a11y.points', {})).toBe('{n} points');
  });

  it('returns the key itself for a missing key and warns once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const missing = 'nope.missing' as CopyKey;
    expect(t(missing)).toBe('nope.missing');
    expect(t(missing)).toBe('nope.missing');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does not treat a branch as a string', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(t('mood.labels' as CopyKey)).toBe('mood.labels');
    warn.mockRestore();
  });
});

describe('placeholders', () => {
  it('knows which copy is still a placeholder', () => {
    expect(isPlaceholderKey('app.tagline')).toBe(true);
    expect(isPlaceholderKey('croc.stages.egg')).toBe(true);
    expect(isPlaceholderKey('common.continue')).toBe(false);
    expect(isPlaceholderText(en.app.tagline)).toBe(true);
    expect(isPlaceholderText('Continue')).toBe(false);
    expect(isPlaceholderText(42)).toBe(false);
  });
});
