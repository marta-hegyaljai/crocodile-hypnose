import {
  SETTINGS_FIELDS,
  type SettingsDoc,
  type SettingsDocV1,
  type SettingsField,
  type SettingsStamps,
} from './types';

/**
 * When each settings field was last changed. A document whose stamps do not belong to its
 * `updatedAt` (none at all, or an older app version changed it and kept the old stamps) counts as
 * written whole at `updatedAt`; an absent reduced-motion choice (an app from before it existed)
 * at 0. The defaults (`updatedAt` 0) are therefore older than anything the user ever chose.
 */
export function settingsStamps(doc: SettingsDoc | SettingsDocV1): Record<SettingsField, number> {
  const given = doc.fieldsAt;
  const own = given?.doc === doc.updatedAt;
  const out = {} as Record<SettingsField, number>;
  for (const f of SETTINGS_FIELDS) {
    if (own && given) out[f] = Math.min(given[f], doc.updatedAt);
    else out[f] = f === 'reducedMotion' && doc.reducedMotion === undefined ? 0 : doc.updatedAt;
  }
  return out;
}

const valueOf = (doc: SettingsDoc | SettingsDocV1, f: SettingsField): unknown => doc[f] ?? null;

/** Equal stamps, different values: deterministic, so every copy agrees; consent prefers off. */
function bWinsTie(field: SettingsField, a: unknown, b: unknown): boolean {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja === jb) return false;
  if (field === 'moodConsent') return b === false;
  return jb > ja;
}

const withStamps = (
  doc: SettingsDoc | SettingsDocV1,
  at: number,
  stamps: Record<SettingsField, number>,
): SettingsDoc => {
  const fieldsAt: SettingsStamps = { doc: at, ...stamps };
  return { ...doc, version: 2, reducedMotion: doc.reducedMotion ?? null, updatedAt: at, fieldsAt };
};

/**
 * A settings document in the current version (v2). A v1 document (device copy or server answer
 * from before v2) gets `reducedMotion` (null: follow the device) and its per-field stamps; its
 * values and its stamps do not change, so the upgrade is idempotent and merges as before.
 */
export function upgradeSettings(doc: SettingsDoc | SettingsDocV1): SettingsDoc {
  if (doc.version === 2) return doc;
  return withStamps(doc, doc.updatedAt, settingsStamps(doc));
}

/**
 * Merges two copies of the settings field by field: the more recently changed value of each
 * field wins, so a stale copy (another tab or device) that changed one field never undoes another,
 * mood consent and the safety answers in particular; and an edit made on top of the defaults,
 * before the server's copy arrived, changes only what the user touched. Commutative and
 * idempotent. Mirrors the server's `mergeSettings`.
 */
export function mergeSettings(
  a: SettingsDoc | SettingsDocV1,
  b: SettingsDoc | SettingsDocV1,
): SettingsDoc {
  const sa = settingsStamps(a);
  const sb = settingsStamps(b);
  const out = { ...a } as Record<string, unknown>;
  const stamps = {} as Record<SettingsField, number>;
  for (const f of SETTINGS_FIELDS) {
    const va = valueOf(a, f);
    const vb = valueOf(b, f);
    out[f] = sb[f] > sa[f] || (sb[f] === sa[f] && bWinsTie(f, va, vb)) ? vb : va;
    stamps[f] = Math.max(sa[f], sb[f]);
  }
  return withStamps(out as unknown as SettingsDoc, Math.max(a.updatedAt, b.updatedAt), stamps);
}

/**
 * Stamps a local change made at `at` (later than `prev.updatedAt`): the fields whose value changed
 * get `at`, the others keep their stamps. A change that changes no field returns `prev` (no write).
 */
export function stampSettings(prev: SettingsDoc, next: SettingsDoc, at: number): SettingsDoc {
  const stamps = settingsStamps(prev);
  let changed = false;
  for (const f of SETTINGS_FIELDS) {
    if (JSON.stringify(valueOf(prev, f)) !== JSON.stringify(valueOf(next, f))) {
      stamps[f] = at;
      changed = true;
    }
  }
  if (!changed) return prev;
  return withStamps(next, at, stamps);
}
