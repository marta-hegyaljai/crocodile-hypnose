# Step 3 (Onboarding): code review r2

Scope: `git diff afe8316 f6c13cd`, MAJOR 1-4 of r1 only. `npm run check`: 258 tests pass. `npm run server:test`: 78 tests pass.

- MAJOR 1: CONFIRMED FIXED. Client: `mergeOnboarding` makes completion one-way and keeps hatched/named/first-session/reward/furthest step. `documentStore` never pushes until `serverKnown` (failed first GET retries with backoff, on `flush`, AppState active and web `online`). Server: `resolveDocument` runs inside the SQLite transaction (`putDocument(record, resolve)`) and keeps a completed doc against an incomplete one, whatever the timestamps. Tests cover failed-GET-then-tap, newer stale copy, two tabs, and the server rule.
- MAJOR 2: CONFIRMED FIXED. `consent.tsx` nulls `moodBefore`/`moodAfter` when declining (settings follow via `deriveSettings`); the server (`checkDocumentRules`) returns 400 for non-null moods unless `moodConsent === true`. Screen test and server test present.
- MAJOR 3: CONFIRMED FIXED. `RootGate` renders null only until the first ready moment, then a `ProfileLoadingScreen` (croc, copy-module label, retry and sign-out on error) while the profile loads; `profileStore.load` no longer routes on defaults after a timeout. Component test covers the null-then-loading sequence.
- MAJOR 4: CONFIRMED FIXED. `reminderSync` (wired in `_layout` via `reminders/instance`) schedules, reschedules on time change and cancels when disabled (skip, Back-then-skip, morning/evening switch all flow through `deriveSettings`) and when the profile goes idle (sign-out, deletion, ended session). Unit tests with a fake reminders implementation cover on/reschedule/off and sign-out.

VERDICT: PASS
