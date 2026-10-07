import { mergeSettings, settingsStamps, stampSettings, upgradeSettings } from './mergeSettings';
import {
  SETTINGS_FIELDS,
  defaultSettings,
  isAnySettingsDoc,
  isSettingsDoc,
  isSettingsDocV1,
  type SettingsDoc,
  type SettingsDocV1,
} from './types';

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
    const { fieldsAt: _f, reducedMotion: _r, ...rest } = { ...stored(), updatedAt: 150 };
    const legacy: SettingsDocV1 = { ...rest, version: 1 };
    expect(settingsStamps(legacy).sound).toBe(150);
    // It never had the motion choice, so it does not erase one.
    expect(settingsStamps(legacy).reducedMotion).toBe(0);
    expect(mergeSettings(legacy, stored()).reducedMotion).toBe(true);
    // An older app that changed a newer document kept stale stamps: also written whole.
    const stale = { ...stored(), updatedAt: 160, sound: false };
    expect(mergeSettings(stale, stored())).toMatchObject({ sound: false, updatedAt: 160 });
  });

  it('upgrades a v1 document without changing what it says or how it merges', () => {
    const { fieldsAt: _f, reducedMotion: _r, ...rest } = { ...stored(), updatedAt: 150 };
    const v1: SettingsDocV1 = { ...rest, version: 1 };
    expect(isSettingsDoc(v1)).toBe(false);
    expect(isSettingsDocV1(v1)).toBe(true);
    const v2 = upgradeSettings(v1);
    expect(isSettingsDoc(v2)).toBe(true);
    expect(v2).toMatchObject({ version: 2, updatedAt: 150, sound: true, reducedMotion: null });
    expect(v2.fieldsAt).toEqual({ ...stampsAt(150), reducedMotion: 0 });
    // Idempotent, and merging the upgraded copy equals merging the original.
    expect(upgradeSettings(v2)).toBe(v2);
    expect(mergeSettings(v2, stored())).toEqual(mergeSettings(v1, stored()));
    expect(mergeSettings(v2, stored()).reducedMotion).toBe(true);
    // A v1 document that did carry the choice keeps it, stamped with the document.
    expect(upgradeSettings({ ...v1, reducedMotion: false }).fieldsAt.reducedMotion).toBe(150);
    expect(isAnySettingsDoc(v1) && isAnySettingsDoc(v2)).toBe(true);
    expect(isAnySettingsDoc({ ...v2, version: 3 })).toBe(false);
    expect(isSettingsDoc({ ...v2, reducedMotion: undefined })).toBe(false);
  });

  it('a change that changes nothing is no write', () => {
    const doc = stored();
    expect(stampSettings(doc, { ...doc }, 500)).toBe(doc);
  });
});
