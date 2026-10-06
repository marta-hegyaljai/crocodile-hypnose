# Step 05 (Sessions): code review, round 1

Reviewer: Opus. Diff `e393611..c6873be` (docs, screenshots and media ignored).
Checks: `npm run check` passed (tsc, eslint, 45 suites / 319 tests). `npm run server:test` passed (93 tests). No servers started.

## What holds up

- Server events and mood: idempotent per (user, stream, client id) through the primary key and the stored-first lookup in one SQLite transaction. The server decides `firstTime` against the stored stream, so two offline devices cannot both keep the bonus. Times are clamped to the server clock. Batches are capped at 50 and AJV rejects unknown fields. Mood POST is refused (403 `consent_required`) unless settings, or onboarding before settings exist, record consent. Every route is scoped to the token's user. Migration v4 is additive, with `ON DELETE CASCADE`, and account deletion is tested.
- Client log: union merge by id where the confirmed (server) version wins. It is commutative and idempotent (tested). Only unconfirmed events are pushed, in batches of 50. Another tab is followed through the document store's storage subscription, and an event added offline twice reaches the server once (tested). Sign-out removes the device copies of both logs.
- Points: `totalSessionPoints` grants the first-time bonus once per stop, earliest claim first, and counts each id once. Local optimism is corrected by the server's verdict.
- Completion: coverage counts only natural forward steps (2.5 s or less), so seeks and repeats add nothing. There is no seek bar, only back 15 s. Ending early counts only at 90% or more listened, which matches the threshold rule. The completion id is the run id, and a resumed run keeps it, so re-finishing is one event. `completedRun` guards double calls.
- Player lifecycle: the track and soundscape players come from `useAudioPlayer` and are released on unmount (on web, `remove()` pauses the element). The lock-screen session is cleared on unmount. Auto-dim drops to 0.12 opacity, but controls keep receiving touches and any touch reveals them, so the user is never trapped.
- Onboarding refactor: `first-session.tsx` keeps its flow and data. Done is set on track end, moods are kept only with consent, and the night/day split is the same. It now renders the shared `AudioPlayer`. I found no regression in the code paths.

## Findings

### 1. MAJOR: the session clock jumps over time the app was suspended, so the run ends "not finished" and its place is lost
`src/features/session/VisualExercise.tsx:31-43` (`useSessionClock`). The same pattern is in the silent-audio fallback, `src/features/session/useTrackPlayer.ts:206-215`, and in the video fallback clock that `VideoLesson` builds on `useSessionClock`.

**Problem.** Each tick adds `(now - last)` of wall time. Nothing pauses the clock when the app goes to the background:
- On native, JS timers stop in the background. When the user comes back, the first tick adds the whole absence, for example 2 minutes away during a 3-minute visual exercise.
- On web, a hidden tab without audio is throttled to one tick a minute after 5 minutes.

The position then jumps, often to the end:
- `listening.advance` ignores the jump because it is over 2.5 s.
- `finished` turns true, and `SessionPlayer.finish()` (`src/app/session/[stopId].tsx:578-584`) finds coverage under 90%.
- It calls `save()` with the position at the end. That overwrites the resume point the AppState handler saved on backgrounding.
- `canResume` then refuses it (position ≥ duration − 5).

**Impact.** A user who briefly switches apps during a visual exercise comes back to "not finished", with no resume, and must restart. This breaks the step's acceptance criterion "interrupted session resumes". (Separately, an unwatched hidden web tab advances the exercise anyway.)

**Fix.** Cap each tick's increment, for example `p + Math.min(now - last, 1000) / 1000`, so a suspension pauses the clock instead of skipping it. Better still for visual and video, also stop `running` while `AppState` is not `active` (native) or `document.hidden` (web). Add a unit test: a 60 s gap between ticks does not move the clock more than about 1 s.

### 2. MINOR: audio listened while the JS thread was not running is not counted (mobile web, locked screen)
`src/features/session/listening.ts:39-43`, `src/features/session/AudioPlayer.tsx:262-265`

Coverage counts only steps of 2.5 s or less between status ticks. On iOS Safari with the screen locked, page JS is suspended while the `<audio>` element keeps playing. Native expo-audio, desktop hidden tabs and audible Android tabs keep ticking, so they are fine. The first tick after unlock reports a large forward jump and the whole stretch is dropped. If the track ended meanwhile, the run is "not finished" and is not resumable (same end-position problem as finding 1). Sleep-friendly listening with the screen locked is the main use of the trance player.

I could not run a device, so QA should confirm on iOS Safari before this is promoted.

**Fix.** In `useListening.tick`, also count a forward step when it matches wall-clock time since the last tick (step ≤ elapsed × 1.1 + 0.5 s) and no seek was requested in between. A seek does not advance in step with wall time, so seeks still add nothing.

### 3. MINOR: a user switch mid-session records the run under the new user
`src/app/session/[stopId].tsx:179-197`, `:547-557`

`complete()` writes to whatever user the profile store holds now. `SessionPlayer.save()` writes the old run's place under the new `userId` prop. If another tab signs out and signs in as someone else during a session, this tab follows auth, and the completion event, progress and resume point land on the second account.

**Fix.** Key the session screen on `userId` (remount on change), or capture the user at `startRun` and drop the completion if it differs.

### 4. MINOR: a resumed run's new "mood before" is silently dropped
`src/app/session/[stopId].tsx:169`

The mood id is `${runId}-b`, and a resumed run reuses `runId`. `addToLog` therefore ignores the second check-in, and the user's new answer is discarded without notice. Either derive the id from a fresh `newEventId()` and keep `stopId` and run linkage in the entry, or skip the before-mood when resuming.

### 5. MINOR: one refused event blocks the whole stream
`src/services/events/eventLog.ts:84-95`, `src/services/profile/documentStore.ts:81-83`

`pushLog` sends every pending event, and any 400 marks the store `rejected` for all of them. Each later push resends the refused event with the new ones. Today no client path makes a refusable event, because ids, stop ids and types come from content and match the server patterns. But a future shape mismatch, or the 20,000-event cap, would stop every later completion from reaching the ledger. When the S07 ledger depends on this, mark individually refused events (for example, the server answers which ids it refused) instead of failing the batch.

### 6. MINOR: keyboard focus on dimmed controls does not reveal them
`src/features/session/NightRiver.tsx:148-169`, `AudioPlayer.tsx`

`poke()` runs on touch only. A web keyboard user who tabs to a dimmed control (0.12 opacity) gets an almost invisible focused control (WCAG 2.4.7). Call `dim.poke` from the controls' `onFocus`, or from a key handler on the scene.

## Engineer's known limits

- **Mood not deleted from `/me/mood` when consent is withdrawn later.** Acceptable for S05. After onboarding there is no way to withdraw consent until settings arrive in S08. The server already refuses new entries without consent, and sign-out clears the device log. S08 must:
  - add a deletion path for the server stream (and the onboarding `firstSession` moods);
  - clear the local `moods` log, including pending entries;
  - do both when consent is switched off.
  
  Add this to the S08 brief or BACKLOG so it is not lost.
- **Points read stop types from the client.** Acceptable while points are display-only (S05). The S07 ledger must:
  - derive `stopType` from server-side content, and check that the stop exists and was playable;
  - decide `firstTime` on the server alone, ignoring the claim. Today a wrong `false` claim is kept even when no first completion is stored, so the bonus would be lost for that stop.
  - consider a rate limit on `POST /me/events`.
  
  Record this for S07.

Not re-raised (already in BACKLOG): sign-out while offline drops unsynced documents and logs; stale tabs not refetching; web storage of health data.

VERDICT: CHANGES REQUIRED
