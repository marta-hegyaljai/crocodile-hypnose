# Step 07 (Gamification): code review, round 1

Diff `1a33c11..aa3229a`, without docs and screenshots. `npm run check` passes (54 suites, 362 tests) and `npm run server:test` passes (109 tests). I did not run e2e.

## What I verified and found sound
- **Shared rules module.** `src/services/gamification/shared/rules.ts` has no imports. Its nested `package.json` (`"type": "module"`) loads under Node type stripping (server tests) and under Jest/Metro. The server imports only that file and `pack.json`, with no client-only modules.
- **Ledger keys.** Keys are deterministic (`session:<id>`, `game:<id>`, `first:<stop>`, `week:<monday>`, `badge:<id>`, `item:<id>`). Rows are insert-only (`ON CONFLICT DO NOTHING`, never updated or deleted).
- **Deciding inside the transaction.** `decide` runs inside a synchronous `BEGIN IMMEDIATE` transaction. Replays and second devices pay nothing.
- **Server-side facts.** Stop type, whether the stop exists, and first-time all come from server content. Unknown stops are stored but earn nothing.
- **Concurrent purchases.** Probe: 7 parallel purchases on a balance of 155 gave one 200 (heron) and six 409s, with a final balance of 20 (5 plus the firstDecoration badge). The balance never went below zero. Locked and unknown items are refused.
- **Habitat placement.** `cleanPlacement` keeps only owned items, in a slot of the right kind, each item in one slot at most.
- **DEV_HOOKS.** The route is registered only when `devHooks` is set, which requires `!production && DEV_HOOKS === '1'`. A test covers the 404 when the flag is off.
- **Schema v5.** It adds the `user_ledger` table with `ON DELETE CASCADE` (`foreign_keys` is ON). A test covers account deletion.
- **Events rate limit.** It is set per route on `POST /me/events` and `/me/mood`, and a test covers it.
- **Growth moment.** It is shown once: `seenStage` and `celebratedWeek` only move forward, on both server and client.
- **Changed e2e numbers are consistent.**
  - 80 to 95, and 90 to 105: the new firstSession badge adds 15.
  - 0/5 to 0/4: the default target now comes from the onboarding timing.

## Findings

### 1. MAJOR: back-dated events bypass the daily cap, so a crafted client can pay itself for its whole account history
- **Where:** `src/services/gamification/shared/rules.ts:296-328` and `server/src/events.ts:140`.
- **Problem:** An event's `at` is clamped only from above (`min(at, now)`). The only lower bound is `accountCreatedAt - 24h`, and `MAX_COUNTED_PER_DAY` is counted per day of the client-chosen `at`. A script can therefore post fresh event ids dated on every past day since the account was created. The cap then scales with account age, not with real time spent.
- **Measured** (rules run with 20k events over a one-year-old account): one run of about 90 requests, within the 300/min limit, earns about 51,600 points. It also earns every weekly goal of the year and the days3/7/30 badges at once. The criterion "can't be gamed by a crafted client request" and the "tamper-proof ledger" goal are not met for any account older than a day.
- **Fix:** Bound credit by arrival time as well as event time. Pass the stored `storedAt` into `ActivityEvent` (it is fixed at insert, so derivation stays deterministic). Then either:
  - **(a)** earn nothing for events with `at < storedAt - MAX_BACKDATE_MS` (e.g. 14–30 days; still stored, so no data loss), or
  - **(b)** also cap counted activities per day of `storedAt` (e.g. 30, which still fits a legit offline week synced at once).

  Add a server test: post 12 sessions per day dated across 60 past days in one burst, and assert the payout is bounded.

### 2. MINOR: the per-event fallback in `pushLog` can loop under the events rate limit, and "unknown" counts as a permanent refusal
- **Where:** `src/services/events/eventLog.ts:107-123` and `src/services/profile/profileStore.ts:258`.
- **First problem: progress is thrown away.** When a non-refused error (e.g. 429 `rate_limited`) hits partway through the per-event fallback, `pushLog` throws. Both the merged result and the `refused` set are discarded. On the next retry every refused batch costs 1 + 50 requests again. With several such batches pending, this can use up the 300/min limit on every attempt, so the push never completes. It also starves `/me/mood` from the same IP. No event is lost, but sync stalls.
- **Second problem: too many errors count as refusals.** `isRefused` also matches `code === 'unknown'`, which covers any unmapped 4xx (404, 409, 413, or a new server error code). Those events are settled as confirmed and never resent. For example, a gameCompleted batch refused by a not-yet-upgraded server would drop those events for good.
- **Fix:**
  - Treat only a 400 `invalid_request` as a refusal.
  - When a non-refused error interrupts the fallback, persist what was learned before rethrowing: return or merge the partial result with `settleRefused` applied.
  - Alternatively, bisect the batch instead of sending one event per request.

### 3. MINOR: `GET /me/points` and `GET /me/habitat` re-derive the whole ledger on every call, without a rate limit
- **Where:** `server/src/routes/gamification.ts:44,72` and `server/src/storage/sqlite.ts` (`updateLedger`).
- **Problem:** Each GET takes a write lock (`BEGIN IMMEDIATE`), reads and JSON-parses the user's whole `events` stream (up to 20,000), and runs `deriveNewEntries`. In the bench, steady-state derivation alone took about 38 ms for 20k events and 4.4k ledger rows, with `Intl.formatToParts` per activity. Everything is synchronous on the single event loop. One user who fills the stream and then hammers these unthrottled GETs degrades the API for everyone.
- **Fix:** Put a rate limit on these routes. Better, skip derivation when nothing changed: keep a per-user watermark of the latest `stored_at` derived and of the goal document's `storedAt`, and read events only when it moved.

### 4. MINOR: a stale in-flight `refresh()` swallows the new user's first refresh after a user switch
- **Where:** `src/services/gamification/store.ts:235`.
- **Problem:** `if (refreshing) return refreshing;` is not tied to `generation`. If user A's `/me/points` request is still in flight when B signs in, `load(B)` gets A's promise. That promise discards its result (generation changed), and B's points are not fetched until some later trigger. B sees the empty summary or a cached one, and home's growth or weekly moments are not decided (`summaryKnown` stays false).
- **Fix:** Store the generation with the in-flight promise and start a new request when it differs. Alternatively, clear `refreshing` in `load` and `reset`.

### 5. MINOR: the purchase refusal reason is parsed from the message text
- **Where:** `src/services/gamification/client.ts:62`.
- **Problem:** `/unlock/i.test(err.message)` maps the 409 to `locked` or `insufficient`. A change to the server's English message silently turns "locked" into "not enough points", which is guilt-adjacent copy for a milestone item.
- **Fix:** Keep the server's error code on `AuthError` (raw code or `fields`) and map `locked` and `insufficient_points` by code.

VERDICT: CHANGES REQUIRED
