# Step 4 (Home and river map): code review, round 1

Reviewer: code-reviewer (Opus). Diff `74bbad2..6f2d6a6` on `step/S04`, docs and screenshots ignored.

Checks run in the worktree:
- `npm run check`: typecheck, lint and jest all pass (34 suites, 291 tests).
- `npm run server:test`: typecheck and node tests pass (84/84).
- I also ran a probe script (scratchpad, no server, no source edits) against `server/src/documents.ts` `mergeProgress` and `checkDocumentRules`. Its results are quoted below.

What holds up: the client and server merges match. Both are commutative and idempotent, done never regresses, and the first completion is kept. Key order is stable, so `sameContent` converges and there is no push loop. Progress goes through the existing document store, so no push happens before the first GET (tested). Stale tabs, a second device and offline work all merge per stop. Device copies are keyed by user and cleared on sign-out. Authz works because every route uses the bearer user (tested per user). `update()` no-ops when `change` returns the same doc, so double taps on complete or start are harmless. Journey derivation is pure, memoised on `progress`/`cautionMode`, and has thorough tests. The map memoises scenery, signs and nodes, and the croc and pulse animate with Reanimated. Copy lives in `src/copy`.

## Findings

### 1. MAJOR: the server merge bypasses the record limit, so one account's progress can grow without bound and sync breaks for good
`server/src/documents.ts:278` and `:325-345` (`resolveDocument` → `mergeProgress`), plus the limit at `:177`/`:191`.

`maxProperties: MAX_STOP_RECORDS` is checked only on the incoming body. The stored document is the union of every PUT ever made, so its size has no limit. Probe: 20 PUTs of 150 distinct valid ids each gave a stored doc with **3000 stops (197 KB)**, against the stated limit of 2000.

Impact:
- Server storage per user grows without bound. Any signed-in client (buggy or hostile) can add about 180 rows per 16 KB request.
- Once the stored doc has more than 2000 stops, the app's `isProgressDoc` rejects it. GET then reads as "absent" and the client pushes. The PUT answer fails `parse` with "malformed progress answer" (`server_error`, not a rejection). The app retries on every change and never syncs again.
- Before that point, the client always PUTs the whole merged union. Once that union passes the 16 KB `bodyLimit` (`server/src/app.ts:46`, about 185 records at ~88 bytes each), every PUT is refused and sync for that account stops.
- The two limits disagree: `MAX_STOP_RECORDS = 2000` can never reach the server inside a 16 KB body.

Fix:
- In the PUT path for `progress`, after merging, refuse a result over the limit (400 `invalid_request`, `fields.stops`) and keep what is stored.
- Set `MAX_STOP_RECORDS` from the real body budget: give `/me/progress` its own route `bodyLimit` sized for the limit (2000 × ~100 B ≈ 200 KB), or lower the limit to what 16 KB holds with headroom.
- Use the same constant on the client.
- Add a server test: several PUTs of new ids are refused once the union would pass the limit.

### 2. MAJOR: caution mode fails open while the settings document is not yet known (new device or cleared storage)
`src/features/home/useJourney.ts:39`, with `src/services/profile/types.ts:111` (`defaultSettings().safety.cautionMode = false`) and `src/services/profile/profileStore.ts:157-163`. The same gap is in `src/app/session/[stopId].tsx:27`, which uses `useJourney`.

On a device without local copies, the profile becomes `ready` once the onboarding document is server-known. Settings and progress are fetched in parallel, and each retries with a backoff of up to 30 s. If progress arrives and settings has not (slower, or the settings GET failed once), the journey is derived with `cautionMode: false` against the user's real progress.

For a caution-mode user past Intro 5, the map and today's card then offer stops that are not `cautionSafe` (`intro-6`, `intro-9` long trance, `sleep-5`, `sleep-10`) as available. The user can start them, and the start writes a progress record. From step 5 on, this plays content the safety check is meant to keep from them. This is a safety gate that fails open.

Fix: fail closed. While the settings document has not been seen (no device copy and not server-known), take caution mode from the onboarding answers, which are already loaded at this point: `cautionMode(onboarding.safety.answers)` from `src/features/onboarding/flow.ts`. Alternatively, treat caution mode as on until settings are known. Expose settings' `source`/`serverKnown` on the profile store to tell these cases apart. Do not simply OR the two values: step 8 will let a user turn caution mode off.

Add a test: with onboarding answers that set caution, default settings and advanced progress, today's session is never a stop without `cautionSafe`.

### 3. MINOR: per-stop timestamps are not clamped (the open item in the hand-over)
`server/src/documents.ts:258-266` (`checkDocumentRules` clamps only the document's `updatedAt`).

Probe: a record with `updatedAt`/`completedAt = 9e15` is accepted and stored as is. Impact today is small, because `done` beats `inProgress` whatever the times and two `inProgress` records are equivalent. Where it does matter:
- `daysActiveThisWeek` skips `completedAt > now`, so a stop finished on a device whose clock runs fast never counts.
- The min-merge keeps a slow clock's early `completedAt` forever.
- The step 7 ledger and streaks will inherit both effects.

Fix (now or in step 7):
- On the server, clamp `completedAt` to `min(completedAt, now)` and require `completedAt <= updatedAt`. This converges with the client's min-merge.
- Do not clamp per-stop `updatedAt` on the server while `mergeStop` takes the max: the client's future value would win every local merge, `sameContent` would never match, and the client would push in a loop.
- If per-stop `updatedAt` needs bounding, derive it (for example `updatedAt = completedAt` for done records) rather than clamping it.

### 4. MINOR: in caution mode the stop sheet and session route offer "Replay" for a finished stop that is not suitable, though today's session never suggests it
`src/features/map/StopSheet.tsx:54` and `src/app/session/[stopId].tsx:27`, compared with `src/content/journey.ts:195`.

Today's card leaves out finished stops without `cautionSafe` for caution users, but the map sheet and a deep link still let them replay one. This can only happen once caution mode can change after a stop is finished (step 8 settings). I am not raising the caution-mode semantics themselves. Decide this alongside the owner's caution-mode decision, so the sheet and today's session follow one rule.

VERDICT: CHANGES REQUIRED
