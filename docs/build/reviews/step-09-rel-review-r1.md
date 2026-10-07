# S09a-rel review, round 1

Diff: `94cd707..200fdc3` (docs/ ignored). Checks run in the worktree: `npm run check` green (60 suites, 416 tests), `npm run server:test` green (126 tests). One probe test was written, run and deleted (see finding 1).

Verified as correct:
- Settings v1 to v2 on the server. The PUT body accepts v1 or v2. `mergeSettings` always gives v2. The stored row's `version` now follows the resolved document. GET answers v1 unless `?v=2`. A PUT is answered in the version it sent. Export uses v2. A v1 row is upgraded on read through `mergeSettings(data, data)`.
- An old client cannot erase `reducedMotion` or `fieldsAt`. An absent `reducedMotion` gets stamp 0, so the stored value wins.
- No push loop between a v1 client and a v2 client. Each one gets its own version back, and `sameContent` compares like with like. The client upgrade (`upgradeSettings`) gives the same result as the server's read upgrade.
- Purchase refusals are now told apart by error code: the server sends `locked` and `insufficient_points`, and the client adds both to `KNOWN_CODES`.
- Points store: a refresh started by the previous user is never reused after a switch, and a refresh started before a purchase is dropped.
- `PartialPush`: refused events come back as `confirmed`, so `mergeLogs` keeps them settled. Batches already sent are not sent again. Event ids keep the stream idempotent.
- 429: the client waits between 1 s and 120 s, so there is no tight loop. Only `invalid_request` is permanent. Fastify's own 4xx errors, including 413, map to `invalid_request` on the server, so an event that is too large or malformed still settles.
- Read rate limit: the production default is 120 per minute per address. It applies only to `GET /me/points` and `GET /me/habitat`. The e2e harness raises it to 1000. The trustProxy caveat is already in the backlog (row 2).

## Findings

### 1. MAJOR: a refetch still in flight swallows the next user's first server read after a sign-out and sign-in
`src/services/profile/documentStore.ts:235` (`readServer`: `if (reading) return reading;`) and `:322-337` (`refetch` stores its promise in the same `reading`). `load()` and `reset()` at about `:290` and `:410` never clear `reading`.

This is the same bug class the step fixed in the gamification store with `refreshing.generation`. The new focus refetch makes it much more likely here. The sequence:
1. The tab regains focus, so `refetch()` for user A is in flight.
2. The user signs out, or signs in as B.
3. `load(B)` calls `readServer(B)`, which gets A's pending promise back.
4. That promise ends on `startedIn !== generation` without scheduling a retry.

B's `serverKnown` stays false and nothing retries the read. On a new device, or with cleared storage, `profileStore.load` waits on `onboarding.serverKnown`, so B sits on the loading screen until something calls `flush` (app active, back online, or the retry button). With a device copy, B's changes are not pushed until the next update or flush. Signing back in as the same user hits the same problem.

Reproduced with a probe test: load A, start a refetch with a deferred fetch, load B, release the fetch. Result: fetches were `['A','A']`, and B ended with `serverKnown: false`.

Fix: tag the in-flight read with its generation, as `refreshing` does in the gamification store (`{ promise, generation }`), and reuse it only when `generation` matches. Alternatively, set `reading = null` in `load` and `reset`, but then the `finally` must clear `reading` only when it still holds its own promise. Add a test: refetch in flight, then switch user, then the new user's first read happens.

### 2. MAJOR: moods withdrawn during a refetch or a partial push come back onto the device
`src/services/profile/profileStore.ts:240-250` (`enforceMoodConsent` scrubs only on the change from on to off), together with `documentStore.ts:320-330` (`refetch` adopts the server copy) and `:393-400` (`PartialPush` merges `partial` into the current document).

When consent is withdrawn, `scrubMoods` empties the mood log. Two paths can then put the moods back:
- **Refetch.** A moods `refetch()` that started before the withdrawal (focus, then the user toggles consent off) resolves with the server's moods from before the purge. `adopt` merges them into the empty log.
- **Partial push.** A moods push that was interrupted after a partial success throws `PartialPush`. Its `partial` holds every item of the sent document, both confirmed and pending, and `merge(get().doc, partial)` restores them all into the scrubbed log.

In both paths `enforceMoodConsent` runs again with `lastConsent === false` and does not scrub. Mood entries (health data) stay on the device, and are shown, after an explicit withdrawal until the next app load. The new scrub on load cleans them up then. Re-added pending entries are also re-sent on every load. The server answers `403 consent_required`, which the client maps to `unknown`, which counts as a rejection.

Fix: make the rule hold at all times, not only on the change. In `enforceMoodConsent`, scrub whenever `withdrawn()` and the mood log is ready and still holds items, or the onboarding copy still holds moods. This covers the late server copy, the partial push and the load case in one place. Add a test: start a moods refetch, withdraw consent, resolve the refetch; the log must be empty.

### 3. MINOR: after a purchase, a refresh request can be folded into a read that will be thrown away
`src/services/gamification/store.ts:240`. A `refresh()` called while a stale read is in flight (one that started before a purchase) gets that read's promise back. That read is then dropped because `version !== summaryVersion`. Example: the session events that `profile.subscribe` reacts to reach the server right after a purchase. The points they earned are not shown until the next refresh trigger.

Fix: reuse `refreshing` only when its captured `summaryVersion` also matches the current one. Otherwise start a new read.

### 4. MINOR: `Retry-After` cannot be read on web, so pushes retry every 5 s while rate limited
`server/src/app.ts:78` (CORS registration) has no `exposedHeaders`. A browser therefore hides `Retry-After` from a cross-origin `fetch`. `jsonRequest` reads `undefined`, and the new push retry in `documentStore.ts:358-366` falls back to 5 s. Against a 60 s window that is about 12 extra 429 responses per stream per minute. It is not a tight loop, and native apps are not affected.

Fix: add `exposedHeaders: ['retry-after']` to the CORS options.

VERDICT: CHANGES REQUIRED

## Orchestrator note (fix round 1)
Process breach recorded: the fix engineer used `pkill -u <uid> -f "jest src/services/profile"` to stop its own hung jest run, which LOOP.md rule 10 forbids. It matched only that process; nothing else was affected. Agents must stop jest by PID (or let the time box end) even when hung.

## Round 2

Fix diff `08ba1cf..44a6e36` (docs/ ignored). `npm run check` green (60 suites, 419 tests).

- MAJOR 1 (shared in-flight read across a user switch): CONFIRMED FIXED. `reading` is now `{ promise, generation }` and reused only when `generation` equals the store's current one, in both `readServer` and `refetch`. Each `finally` clears `reading` only when it still holds its own promise, so an old-generation read ending late cannot clear the next user's read, and a replaced read cannot leave `reading` set (the replacement clears its own). A current-generation read is never dropped: `load`/`reset` bump `generation` before any new read, and `readServer` is called with the current generation. A hung old-generation fetch no longer blocks anything. New test asserts fetches `['A','A','B']` and B `serverKnown: true`.
- MAJOR 2 (moods back after withdrawal): CONFIRMED FIXED. `enforceMoodConsent` now scrubs whenever consent is off, the choice was decided (stamp > 0), and the mood log (once ready) or the onboarding copy still holds mood data. No scrub while consent is on (early return). It cannot loop: `scrubMoods` is guarded by non-empty items and the onboarding mood fields, and each update clears the condition synchronously. The re-entrant call through the store subscription terminates after one nested pass. A new device or onboarding grant is not a withdrawal (a field that stays at the default is never stamped), so `withdrawn()` is false there. Both new tests (late refetch, partial push after withdrawal) cover the paths from round 1.

No new issues found on the touched code.

VERDICT: PASS
