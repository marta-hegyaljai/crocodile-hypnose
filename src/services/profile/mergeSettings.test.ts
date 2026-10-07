import { mergeSettings, settingsStamps, stampSettings } from './mergeSettings';
import { SETTINGS_FIELDS, defaultSettings, type SettingsDoc } from './types';

const stampsAt = (at: number) =>
  ({ doc: at, ...Object.fromEntries(SETTINGS_FIELDS.map((f) => [f, at])) }) as NonNullable<
    SettingsDoc['fieldsAt']
  >;

/** The user's settings as the server holds them, last changed at 100. */
const stored = (): SettingsDoc => ({
  ...defaultSettings(100),
  crocName: 'Snap',
  goals: ['sleep'],
  reminder: { enabled: true, time: '20:00', timeOfDay: 'evening' },
  moodConsent: true,
  safety: { answers: [true, false, false], cautionMode: true },
  reducedMotion: true,
  fieldsAt: stampsAt(100),
});

describe('mergeSettings', () => {
  it('an edit made on the defaults changes only the field the user touched', () => {
    const edited = stampSettings(defaultSettings(), { ...defaultSettings(), sound: false }, 200);
    const merged = mergeSettings(edited, stored());
    expect(merged).toMatchObject({
      ...stored(),
      sound: false,
      updatedAt: 200,
      fieldsAt: { ...stampsAt(100), doc: 200, sound: 200 },
    });
    expect(mergeSettings(stored(), edited)).toEqual(merged);
  });

  it('consent is resolved on its own: a stale copy changing another field never flips it', () => {
    const off = stampSettings(stored(), { ...stored(), moodConsent: false }, 200);
    const staleOn = stampSettings(stored(), { ...stored(), haptics: false }, 300);
    const merged = mergeSettings(off, staleOn);
    expect(merged).toMatchObject({ moodConsent: false, haptics: false, updatedAt: 300 });
    expect(mergeSettings(staleOn, off)).toEqual(merged);
  });

  it('is idempotent, and ties are settled the same way on both sides (consent prefers off)', () => {
    const a = { ...stored(), moodConsent: false };
    const b = stored();
    expect(mergeSettings(a, b).moodConsent).toBe(false);
    expect(mergeSettings(b, a).moodConsent).toBe(false);
    const once = mergeSettings(a, b);
    expect(mergeSettings(once, once)).toEqual(once);
  });

  it('a document from an older app counts as written whole at its updatedAt', () => {
    const { fieldsAt: _f, reducedMotion: _r, ...legacy } = { ...stored(), updatedAt: 150 };
    expect(settingsStamps(legacy).sound).toBe(150);
    // It never had the motion choice, so it does not erase one.
    expect(settingsStamps(legacy).reducedMotion).toBe(0);
    expect(mergeSettings(legacy, stored()).reducedMotion).toBe(true);
    // An older app that changed a newer document kept stale stamps: also written whole.
    const stale = { ...stored(), updatedAt: 160, sound: false };
    expect(mergeSettings(stale, stored())).toMatchObject({ sound: false, updatedAt: 160 });
  });

  it('a change that changes nothing is no write', () => {
    const doc = stored();
    expect(stampSettings(doc, { ...doc }, 500)).toBe(doc);
  });
});
