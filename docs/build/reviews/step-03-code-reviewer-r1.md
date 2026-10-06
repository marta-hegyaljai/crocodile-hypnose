# Step 3 (Onboarding): code review r1

Scope: `git diff 9f3a647..HEAD` (docs, screenshots and generated audio left out). I read the brief, PLAN, LOOP and BACKLOG, and none of the findings below repeats a BACKLOG item. Checks are green: `npm run check` passed 241 tests, server `npm run check` passed 74 tests.

What is solid:
- **Server.** The documents API authorises each request by the token's user, so a client cannot address another user's documents. Kinds are a fixed route list. Validation uses ajv with `additionalProperties: false`, and `removeAdditional` is turned off so unknown fields are refused rather than dropped. The `user_documents` table cascades on user deletion (`foreign_keys = ON`, and a test covers it). The v3 migration is clean.
- **Account switching.** The session manager already refuses to answer a request made for account A with B's token (`switchedAccount`). So a late push can't write one user's document into another user's account. I checked this specifically.
- **Animations.** The hatch and sink animations run entirely on the UI thread (Reanimated shared values, `useAnimatedStyle`, `crocOffsetY` passed as a SharedValue into `Lagoon`). The JS thread only sees a handful of expression `setState`s.
- **Timers and audio.** Timers are cleared on unmount, `useAudioPlayer` releases the track, and route reachability (`isReachable` / `resumeStep`) prevents skipping required steps through deep links.

---

## MAJOR 1: A finished onboarding can be overwritten by a fresh, incomplete one (and then pushed to every device)

- **Severity:** MAJOR
- **Where:**
  - `src/services/profile/documentStore.ts:109-139` (`syncWithServer`: when the fetch fails, nothing retries it; `newerOf` is pure last-write-wins)
  - `src/services/profile/profileStore.ts:126-135` (6 s timeout, then routing on the defaults)
  - `server/src/storage/sqlite.ts:330-353` (`putDocument` is pure last-write-wins)
- **Problem and impact:**
  - On a device with no local copy, `load` waits for `GET /me/onboarding` for at most 6 s. If the GET fails (5xx, a flaky mobile network, a timeout), the store marks `serverChecked`, routes on `defaultOnboarding()` and never asks the server again.
  - The user, who finished onboarding elsewhere, now lands on Goals. Their first tap stamps `updatedAt = now`. That doc is newer than the server's completed one, so the next push wins on the server.
  - The server copy loses `completed`, `crocHatched`, `crocName` and `rewardGranted`. On their next load, every other device adopts the newer, incomplete document, and the route guard moves those users from Home back into onboarding.
  - In step 7 this becomes a double reward grant.
  - The same happens on the slow path: the server answers after the 6 s cutoff, but the user has already tapped.
  - It also happens with two web tabs: a stale tab still sitting on an onboarding screen gets a tap after the other tab finished.
  - Note that every sign-in takes this "no local copy" path, because sign-out deletes the device copy.
  - I reproduced it with a throwaway Jest test (since deleted). After the GET failure, one tap and a flush, the server held `completed: false, crocName: null`.
- **Fix:**
  - Make onboarding completion monotonic in both merges. Give the document store an optional `merge(local, remote)` and use it for onboarding, so a `completed: true` document always beats an incomplete one whatever the timestamps. Do the same server-side in `putDocument` / the route: if the stored onboarding doc is completed and the incoming one is not, keep the stored one and return it. That makes the client adopt it and the guard go to Home.
  - When the first GET failed on a device without a local copy, keep retrying it (on `online`, AppState `active`, and a short backoff). Don't push a document whose server base was never seen until that GET succeeds.
  - Add tests for the failed-GET-then-tap case and the stale-tab case, on both the client store and the server.

## MAJOR 2: Mood values survive withdrawing consent (health data kept and synced without consent)

- **Severity:** MAJOR
- **Where:**
  - `src/app/onboarding/consent.tsx:24-28`
  - `src/app/onboarding/first-session.tsx:217-227`
  - `server/src/documents.ts:111-120`
- **Problem and impact:**
  - The user allows mood storage, completes the first session with a mood before and after (stored locally and pushed: `firstSession.moodBefore/moodAfter`), then goes Back from Reminder through First session and Hatch to Consent and declines.
  - `choose(false)` only sets `moodConsent: false`. The mood values stay in the onboarding document on the device and on the server, and are re-sent on every later write, while `settings.moodConsent` says false.
  - The server accepts mood values whatever `moodConsent` says.
  - This contradicts PLAN ("Mood check-ins are health data: stored only after explicit consent") and the brief.
- **Fix:**
  - In the consent screen, declining also clears the moods in the same update: `firstSession: { ...d.firstSession, moodBefore: null, moodAfter: null }`.
  - Server-side (defence in depth): `checkDocumentRules` refuses an onboarding document with non-null `moodBefore`/`moodAfter` unless `moodConsent === true`.
  - Add a screen test (allow, complete with moods, decline, assert moods are null in the store and in the fake server) and a server test.

## MAJOR 3: Blank screen after every sign-in while the profile loads (up to 6 s)

- **Severity:** MAJOR
- **Where:** `src/app/_layout.tsx:73-87`, together with `src/services/profile/profileStore.ts:126-135` and `reset()` deleting the device copy
- **Problem and impact:**
  - `GuardedStack` returns `null` while `signedIn && profileStatus !== 'ready'`. That was meant for cold start under the splash, but it also applies after an interactive sign-in.
  - Sign-out deletes the device copies, so every sign-in has no local copy and waits for `GET /me/onboarding` (up to `serverWaitMs` = 6 s).
  - During that wait the whole navigator unmounts: the sign-in form, with its loading button, disappears, and on native the splash is already hidden. The user sees an empty screen with no feedback for the length of a mobile round trip. With a slow or unreachable server that is up to 6 s, after which they land on onboarding (which then triggers MAJOR 1).
- **Fix:**
  - Return `null` only until the first ready render (cold start, splash still up).
  - Afterwards, render a small loading screen while the profile loads: the Daylight lagoon with the croc and an accessible loading label from `src/copy`. Alternatively, keep the auth stack mounted until the profile is ready.
  - Add a component test asserting that something is rendered between sign-in and profile ready.

## MAJOR 4: The daily reminder is never cancelled or rescheduled

- **Severity:** MAJOR
- **Where:**
  - `src/services/reminders/reminders.native.ts` (`cancel` exists but nothing calls it)
  - `src/app/onboarding/reminder.tsx:53-56`
  - `src/services/profile/profileStore.ts:174-186` (sign-out path)
- **Problem and impact (native):**
  1. After sign-out, account deletion or an ended session, the OS keeps firing the previous user's daily reminder. The next person signing in on that device, or someone who deleted their account, keeps getting it.
  2. If the user enables the reminder, goes Back from Done and taps "Not now", the document says `skipped` and settings say `enabled: false`, but the notification stays scheduled.
  3. If the user enables it at morning (08:00), then goes Back to Experience and switches to evening, `deriveSettings` stores `time: '20:30'` with `enabled: true`. The OS notification still fires at 08:00.
- **Fix:**
  - Call `reminders.cancel()` when the profile resets (sign-out, deletion, session ended).
  - Call it in `skip` when a reminder was enabled.
  - When the doc has `reminder === 'enabled'` and `timeOfDay` changes, either reschedule or reset `reminder` to null so the reminder step asks again.
  - Add tests with the fake reminders.

---

## MINOR findings (for BACKLOG)

### m1: Client clock more than 5 min ahead means sync fails permanently and silently
- **Where:** `server/src/documents.ts:194-197`, `src/services/profile/documentStore.ts:177, 206-211`
- **Problem:** The server answers 400 for `updatedAt > now + 5 min`. The client stamps `max(now, prev + 1)`, so every retry is also in the future. Nothing ever reaches the server, the second device repeats onboarding, and nothing tells the user: `isSyncProblem` is exported but used nowhere, and a 400 is retried silently on every change.
- **Fix:** Clamp on the server (`updatedAt = min(updatedAt, now)`) and return the stored doc, which the client already handles. Treat a 400 as permanent: stop retrying and log or surface it.

### m2: Native retries only on the next change or launch
- **Where:** `src/services/profile/instance.ts:13-16`, `profileStore.ts:170-186`
- **Problem:** The `followAuth` comment says it "retries pending writes when the user comes back to the app", but only web has a retry (the `online` listener). On native, a failed final write (`completed: true`) waits for the next launch. A sign-out before that deletes it, because `reset()` removes unsynced device copies.
- **Fix:** Flush on AppState `active` and with a short backoff. Try a flush before sign-out revokes the token.

### m3: Reminder enabling can throw unhandled
- **Where:** `src/app/onboarding/reminder.tsx:31-49,77`, `reminders.native.ts:212-243`
- **Problem:** `useSubmit` rethrows, and `onPress={() => void enabling.run()}` leaves the rejection unhandled if expo-notifications throws (permissions API, channel creation, scheduling). The user gets no message; the Skip button still works.
- **Fix:** Catch the error and treat it as `unavailable`. Also create the Android channel before requesting permission, which is Expo's Android 13+ guidance (not verified on a device).

### m4: A track that loads late keeps playing behind the silent fallback
- **Where:** `src/features/session/useTrackPlayer.ts:53-70, 98-107`
- **Problem:** On a stall (for example the 300 KB MP3 on slow mobile web), the hook switches to `silent` but never pauses the real player. When the audio finally loads it plays, and `pause()` no longer reaches it (it is guarded by `!silent`).
- **Fix:** `player.pause()` when switching to silent, and always pause the player in `pause()`.

### m5: iOS ringer switch on silent makes the first session inaudible
- **Problem:** Nothing calls `setAudioModeAsync({ playsInSilentMode: true })`. On iOS with the ringer switch on silent, the track "plays" with no sound and the stall detector doesn't notice.
- **Fix:** Set the audio mode for session playback. Step 5 owns the full audio setup, but the first session ships now.

### m6: Breathing cue inverted after pause and resume
- **Where:** `src/features/session/BreathingVisual.tsx:30-37`
- **Problem:** On resume, `useBreath` restarts the ring from 0 (in-breath), but `phase` keeps its last value. If the user paused during "out", the text says "out" while the ring swells, for the rest of the session.
- **Fix:** Reset `phase` to `'in'` when `paused` turns false.

### m7: First session re-renders the whole screen 4 times a second for 75 s
- **Where:** `src/app/onboarding/first-session.tsx:179`, `useTrackPlayer.ts:38-70`
- **Problem:** `useAudioPlayerStatus` updates every 250 ms, which re-renders `FirstSessionScreen`, then `NightPlayer`, then the full `Lagoon` SVG (not memoised). The stall-watch interval is also torn down and recreated every tick. The animations stay smooth (UI thread), but this is wasted JS and SVG work on low-end phones for the whole session.
- **Fix:** Move the playback status into a `NightPlayer` child that owns the hook, or `React.memo` the background. Read `currentTime` through a ref in the stall watch.

### m8: Settings fields onboarding doesn't own can be overwritten while the settings GET is in flight
- **Where:** `src/services/profile/profileStore.ts:125-135`, `useOnboardingFlow.ts:179-191`
- **Problem:** `load` waits only for `onboarding.serverChecked`. An onboarding tap made before the settings GET answers writes `deriveSettings(doc, defaults)` with a newer timestamp, which overwrites `sound` / `haptics` set on another device. There is no impact today, because those aren't editable yet.
- **Fix:** Before step 8, wait for both documents or merge settings field by field.

---

VERDICT: CHANGES REQUIRED
