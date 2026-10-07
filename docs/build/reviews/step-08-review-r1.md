# Step 08 review, round 1 (Profile and settings)

Diff: `1a33c11..9b5aa0e` (docs and screenshots ignored). Checks: `npm run check` green (54 suites, 367 tests), `npm run server:test` green (98 tests). I wrote two server probes in my scratchpad (none in the repo). They drive the real app through `makeApp` and back findings 2 and 3 and the rate-limit check.

Verified OK:
- `DELETE /me` checks the password after the bearer, and it is rate-limited per route. Probe with max 3 returned 401, 401, 401, 429, 429, 429.
- A wrong password does not trigger the client's refresh-and-retry or a sign-out, because `withAccessToken` only retries on `unauthorized`.
- Deleting the account cascades to documents, events and sessions (FK `ON DELETE CASCADE`, `foreign_keys = ON`).
- `/me/export` is scoped to the caller. Its top-level keys are `exportedAt`, `account`, `documents`, `sessionEvents` and `moodEntries`. `account` is `publicUser`, so no hash or token is exported, and each stream is capped at 20,000 rows.
- The delete confirmation is keyed on the user id.
- `setMoodConsent` flushes the settings before it calls the delete, and it skips the delete if consent was turned back on in the meantime.

---

## 1. MAJOR: a settings edit made before the server's settings arrive overwrites them with defaults, which can purge moods and turn caution mode off

`src/services/profile/profileStore.ts:247-254` (`load` waits only for onboarding), `src/services/profile/documentStore.ts:247-260` and `:69` (default merge is newer `updatedAt` wins), `src/features/profile/SettingsSections.tsx`, `SafetyRetake.tsx`, `src/app/(app)/profile.tsx`.

**Problem.** On a new device, or after storage is cleared, the app becomes `ready` once the server's onboarding is in. The settings GET can still be in flight, or failing and retrying with backoff. In that window `settings.doc` holds `defaultSettings()`: `moodConsent: false`, safety answers null with `cautionMode: false`, reminder off, `crocName: null`, `goals: []`. Every control on the Profile tab still calls `updateSettings`, and so does the safety re-take. Take one tap, for example sound off:
- The tap stamps that defaults document with `now`.
- When the GET finally answers, `adopt` keeps the local copy because it is newer, and pushes it.
- The server stores the whole defaults document.

**Impact.**
- **Health data lost:** `moodConsent: false` triggers the new settings-PUT purge, so the user's consented mood stream and onboarding moods are deleted on the server. Every device then drops its copy through `enforceMoodConsent`.
- **Safety gate fails open:** the stored `cautionMode` becomes false for a user who answered yes. The local copy now has `source: 'local'`, so `settingsKnown` is true and `effectiveCautionMode` reads false immediately.
- **Other settings lost:** the reminder, croc name and goals are silently reset.

This is BACKLOG S03 m8. Its deferral said "no impact until step 8 makes them editable", and S08 is that step. With this step's purge, the impact is now health data and safety.

**Fix.**
- Do not let settings be edited until `settings.serverKnown` is true, or until settings come from a device copy (`settingsKnown`). Until then, show the settings section in a loading or retry state, and also disable the re-take and the consent toggle.
- Better still, push only the fields the user changed. This is a field-wise merge against the last server copy, which also covers finding 2.
- Add a test: no device copy, settings GET gated, toggle sound, release the GET. Expect the stored consent, caution mode and reminder to be unchanged.

## 2. MAJOR: whole-document last-write-wins lets a stale tab or device flip mood consent: it re-grants consent without the user, or purges moods they consented to

`server/src/documents.ts:258` (settings: `incomingAt >= storedAt ? incoming : null`), `server/src/routes/me.ts:110-114` (purge on any stored `moodConsent === false`), and the client settings store, which has no `merge`.

**Problem.** Settings are stored whole, newest `updatedAt` wins. A tab or device whose copy is stale writes its own `moodConsent` back whenever it changes any other field. Stale copies are normal: BACKLOG S04 m8 notes there is no refetch on focus, and an offline device's pending writes are another source.

Probe, server only:
1. Consent false at t0.
2. The phone turns consent on and records a mood.
3. A stale tab that still holds consent false toggles sound at t2. Result: `GET /me/mood` returns `[]` and the onboarding moods are null.
4. A stale copy with consent true toggles haptics. Result: the stored `moodConsent` is true again.

**Impact.**
- The user's health-data consent is re-granted without any action from them.
- In the other direction, mood entries recorded with consent are deleted, which is irreversible.

S08 makes settings editable from any tab and attaches a server-side purge to the stored value. Before this step that value was effectively written only by onboarding.

**Fix.**
- Give consent its own timestamp and resolve it separately from the rest of the document, on the server (`resolveDocument('settings', …)`) and in a client `merge` for settings. For example, add an optional `moodConsentAt` and keep the `moodConsent` with the newer stamp, like `reducedMotion`.
- Purge only when the resolved consent went from true to false.
- The field-wise merge from finding 1 fixes this in the same way. Either fix must stop a write that never touched consent from changing it.
- Add a server test for the stale-copy case in both directions.

## 3. MAJOR: the server accepts onboarding moods while the stored settings say no consent, so purged moods can come back

`server/src/documents.ts:182-187` (rule checks only `onboarding.moodConsent`) and `:234-238` (`withoutMoods`), `server/src/routes/me.ts:124-133` (`purgeMood`).

**Problem.**
- `withoutMoods` nulls the two mood values. Its doc comment says it also clears consent, but it leaves `onboarding.moodConsent: true`. It also keeps the old `updatedAt`.
- `PUT /me/onboarding` checks mood values only against the document's own `moodConsent`. It never looks at the settings, unlike `POST /me/mood`, which uses `moodConsent(userId)`.

The probe ran after a withdrawal, with stored settings `moodConsent: false`:
- A PUT of an onboarding document with `moodBefore: 2, moodAfter: 4` and the same `updatedAt` returned 200 and stored the moods.
- A newer one was stored as well.

Two client paths do this:
- A stale device runs a safety re-take. `SafetyRetake` writes the whole local onboarding, moods included.
- A device whose local copy ties with the purged server copy re-pushes its own. `mergeOnboarding` keeps the local copy on a tie, and the purge did not bump `updatedAt`.

**Impact.** Health data is stored on the server after the user withdrew consent, and the withdrawal stays on record.

**Fix.**
- In the onboarding PUT, when the effective consent (`moodConsent(user.id)`, settings first) is false, store `withoutMoods(data)` with `moodConsent: false`. Do not answer 400, so stale clients do not end up in a retry loop.
- Make `withoutMoods` also set `moodConsent: false`, as its comment says.
- Add a server test: withdraw, then PUT onboarding with moods, and expect them scrubbed.

## 4. MINOR: older clients drop `reducedMotion`

`server/src/documents.ts:171`.

Adding the optional field without bumping the version means a client without it (for example a cached web bundle) writes a settings document without it. The user's override then silently goes back to following the device. This is acceptable before release.

**Fix.** Before the first release, either bump the version, or make the server carry over an absent optional field from the stored document.

## 5. MINOR: `ExportData` is not keyed on the user

`src/app/settings/privacy.tsx:30`.

`DeleteAccount` is keyed so it resets when the user changes, but the export block is not. After a cross-tab user switch that leaves this screen mounted (the case BACKLOG S02 r3 describes), the previous user's export JSON, which includes mood entries, stays on screen.

**Fix.** Give `<ExportData>` the same `key={userId}`.

## 6. MINOR: consent check and purge can interleave

`server/src/routes/me.ts:166-171`.

A `POST /me/mood` that read consent as true before a concurrent settings PUT stored false can append after the purge. One entry would then outlive the withdrawal until the next settings PUT purges again.

**Fix.** Re-check consent inside the append transaction (`repo.appendEvents` callback), or check it after appending and delete if it is now false.

## 7. MINOR: no test for the `DELETE /me` rate limit

The probe shows the limit works: 401, 401, 401, then 429. Add a test so the per-route `config.rateLimit` wiring cannot regress silently.

---

VERDICT: CHANGES REQUIRED
