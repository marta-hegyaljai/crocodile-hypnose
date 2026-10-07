# S09c release regression, QA round 1

Base: main `a4c26ca` (branch `claude/fervent-rubin-7i8lut`). Date 2026-10-07. Chromium (`/opt/pw-browsers`) at 390x844, 360x640, 820x1180, against a real API (`DEV_HOOKS=1`, SQLite in `/tmp/s09-qa/`) and a real dev-mode web export. Screenshots: `docs/build/screenshots/qa/step-09/` (15).

## Automated

| Command | Result |
| --- | --- |
| `npm run check` (typecheck, lint, jest) | green: 62 suites, 437 tests |
| `npm run server:test` | green: 126 tests, 0 fail |
| `E2E_PORT=4952 E2E_API_PORT=4953 npm run e2e`, run 1 | 174 passed, 0 failed, 10m23s |
| same, run 2 | 174 passed, 0 failed, 10m04s |
| same, run 3 | 174 passed, 0 failed, 10m12s |

No flake in three consecutive full runs (3 x 174 = 522 passes). The three runs overlapped with my own (niced) hands-on browser sessions on a 4-core box, so they also held up under load. `jest` prints "A worker process has failed to exit gracefully" at the end of `npm run check` (an open handle or timer in some test; harmless, exit 0).

A release export (`expo export` without `EXPO_PUBLIC_DEV_MODE`, own dir) passes `scripts/check-web-build.mjs release`; in a browser it has no gallery link, `/dev/gallery` redirects to the welcome screen, `__mhpSession` and `__mhpTimeScale` are undefined, and placeholder text carries no dashed marks. The dev-only code is still in the bundle as dead code (gated by the inlined flag).

## Hands-on journeys

Fresh account (sign-up, onboarding with hatch and first session, home map, one stop of each type, every game, growth through the dev calm hook, habitat buy/place/remove, badges, weekly goal, profile and settings, consent off, safety re-take with a "yes", export, sign out and in, delete account) was driven through the UI at all three sizes, with the dev hooks only for time (`__mhpSession.fastForward`, `__mhpTimeScale`, `/me/dev/calm`).

- 390, 360 and 820: every step passed. Intro stops 1 to 9 played (video, audio, game Breathing, visual, video, audio, game Stillness, visual, long trance), then Stillness, Firefly and Breathing from the Games tab, played counts and bests shown. Points added up to the server's ledger every time (415 after the nine stops, 420 with the three game plays, 395 after buying lily pads for 40 and the +15 first-decoration scale; same after sign-out and in). Growth moment appeared once at Stage 3 (naturally, after 83 calm minutes) and Stage 4 after the calm hook, and did not come back after Continue. Weekly goal changed and was kept. Delete account: sign-in then returns 401.
- Layout checks on every screen visited: no horizontal overflow and no interactive element under 44 px at any size; no console errors or page errors online.
- Returning "Coaching" user (`npm run create-user`, three users): welcome shows "Same account as MHP Coaching"; wrong password gives "Email or password is incorrect"; keyboard-only sign-in works (Tab order sensible, Enter submits); onboarding resumes after a reload mid-step with the answers kept; a "yes" safety answer shows the information screen and sets caution mode; consent declined hides the mood pickers; a hatched croc named `<b>Nilo</b> & "co"` is shown literally (no injection); sign out and in keeps points and does not repeat onboarding; a second browser context signs in and sees the same state, and after A finished a session B showed the new points once it regained focus (95 vs 50 before the focus event).
- Offline: a session finished offline shows "95 +30" with the pending note and the points settle to 125 within 9 s of going online; a settings change made offline reached the server (`/me/settings?v=2` shows `sound: false`, version 2). Cold reload while offline fails with the browser's offline error page (known, backlog Step 4 QA m7).

## Findings

### M1. MAJOR: in caution mode a stop after an unsuitable stop is playable although earlier stops are still locked
Steps: sign in as a user whose safety answers set caution mode (any "yes"), finish onboarding. On the map: Intro stops 1 "Ready", 2 to 5 "Locked", 6 "Not suggested for you", **7 "Ready"**, 8 locked, 9 "Not suggested". Open stop 7, the sheet says "Ready" and Start is enabled. Same in Sleep: stop 6 is Ready while 2 to 4 are locked (5 is "Not suggested").
Expected: the unsuitable stop is skipped, but the stops after it unlock only when the ones before it are done, so the order stays 1, 2, 3, 4, 5, 7, 8.
Actual: `src/content/journey.ts:47` counts `'caution'` as cleared (`const cleared = (s) => s === 'done' || s === 'caution'`) and line 98 unlocks a stop when `cleared(previous.status)`. A caution stop has no check on its own predecessor, so it always counts as cleared and releases the next stop. Result: one tap jumps ahead, the map shows "Ready" nodes after locked ones, "Today" and the zone count can point at the wrong stop.
Fix hint: while walking a zone, carry the predecessor's "reached" state through a caution stop (treat a caution stop as passed only if the stop before it was cleared), and add a unit test for stops 5, 6 (caution), 7 with 5 unfinished. This is separate from the open owner decision about what caution mode means.
Screenshot: `caution-skip-ahead.png` (sheet for stop 7). Labels read from the map: "Intro · Stop 7, Game, 3 min, Ready" and "Intro · Stop 5, Video, 5 min, Locked".

### m1. MINOR: audio-failure notice collides with the breathing cue
Steps: sign in, go offline, open an audio stop (cold, no audio cached), Start. The notice "The audio could not be loaded. The session continues in silence." sits on the player card and is drawn over the "Breathe in" pill (390x844 and 360x640), so both read garbled for the whole session. Expected: the notice has its own line or the cue moves. The silent fallback itself works (timer runs, reward and points arrive after the 93 s track length).
Screenshots: `p390-offline-silent.png`, `p360-offline-silent.png`. The two uncaught page errors this causes ("The element has no supported sources", "Failed to load because no supported source was found") are the known backlog item (Step 3 QA m11), not re-raised.

### m2. MINOR: a release web export silently points at `http://localhost:4000`
`src/config/env.ts`: `apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000'`. `npm run build:web:release` does not pass `--api` to `check-web-build.mjs`, so a release export without the variable passes the check and ships a bundle that talks to localhost (I confirmed the string is in my release export). Suggest requiring `EXPO_PUBLIC_API_URL` in release mode (fail the build) and listing it in RELEASE.md.

### m3. MINOR (placeholder, no action beyond RELEASE.md): stated duration differs from the placeholder media
Stop sheet and map say "3 min" for Intro stop 2 (`durationSec` 180); the placeholder track plays 1:30. Will be moot with real media, but the durations in `pack.json` must be re-synced then.

### Notes (no action)
- Egg taps closer than 220 ms apart are ignored (by design); mashing the egg shows "One more tap" after two counted taps and needs a calmer tap or two. Fine for now.
- Double tap on a goal chip toggles it on and off again (expected for a toggle). Double tap on Continue does not skip a step.
- My API had the auth, refresh and read rate limits raised (1000) so three sign-ins per size did not hit them; the default limits were not exercised by hand (covered by `server:test`).
- Reward "+N Points" counts up; a read in the first frame shows "+0".

## Not tested (BLOCKED)
Native-only behaviour on iOS and Android devices (local reminders, haptics, background and lock-screen audio, motion sensors for Stillness, secure token storage, app icon and splash on a device, store build), the OIDC adapter for the real MHP account backend (not built; dev server only), real content and media, real copy and crisis contacts (all placeholders), the caution-mode owner decision, and store accounts. Details and the list of what MHP must supply are in `docs/build/RELEASE.md`.

VERDICT: CHANGES REQUIRED (one MAJOR, M1; everything else passed)

## Round 2 (HEAD 78c150d)

Re-check of M1 only, hands-on in Chromium 390x844 against a real API (own port 4980, SQLite in `/tmp/s09-recheck/`) and a fresh dev web export of 78c150d (port 4981). Account signed up through the UI; the "yes" safety answer and caution mode were set through the API (`PUT /me/onboarding`, `/me/settings`) and progress was seeded through `PUT /me/progress` to put the map in each state (stops were not played live, so the live completion path is covered by seeding, not by hand). Page errors: none. Screenshots: `docs/build/screenshots/qa/step-09/r2-caution-map-1to4.png`, `r2-caution-1to5.png`.

### M1: CONFIRMED FIXED
Map labels read from the DOM per state (caution user):

| Done stops | Intro stop 5 | Stop 6 | Stop 7 | Stop 8 | Today |
| --- | --- | --- | --- | --- | --- |
| none | Locked | Not suggested for you | **Locked** (was Ready) | Locked | Intro 1 |
| 1 | Locked | Not suggested | Locked | Locked | Intro 2 |
| 1 to 4 | Ready | Not suggested | **Locked** (was Ready) | Locked | Intro 5 |
| 1 to 5 | Done | Not suggested | Ready | Locked | Intro 7 |
| 1 to 5 and 7 | Done | Not suggested | Done | Ready | Intro 8 |
| 1 to 5, 7, 8 | all done | Not suggested | Done | Done | moves on to Sleep 1 |

- Caution stops (6, 9) show "Not suggested for you" at every state, with the dashed pink node and the info mark; tapping stop 6 shows the status and the reason, no Start button.
- Stop 7 with 1 to 4 done: sheet status "Locked", no Start button. Stop 5 in the same state: Ready, Start enabled.
- Passing a caution stop works: with 1 to 5 done, 7 opens without anyone having to "finish" 6; with 7 and 8 done the zone counts as finished and "Today" moves to Sleep.
- Sleep with nothing done: 1 Ready, 2 to 4 Locked, 5 "Not suggested", 6 Locked (was Ready in round 1), 7 to 9 Locked, 10 "Not suggested". Same rule as Intro.
- Regression, non-caution user: nothing done gives 1 Ready and 2 to 9 Locked (Sleep 1 Ready, rest Locked); with 1 to 5 done, 6 is Ready and 7 to 9 Locked. Unchanged from the expected linear map.

### New finding from the fix
**N1. MINOR: the lock hint for the stop after a caution stop names an unplayable stop.** Steps: caution user, stops 1 to 4 done, tap Intro stop 7. Sheet says "Locked" and "Finish Intro · Stop 6 first to unlock this stop." Stop 6 is "Not suggested for you" and can never be finished, so the hint is a dead end; the real blocker is stop 5 (Ready, and "Today"). Cause: `journey.ts` sets `lockReason = { kind: 'previous', stop: previous!.stop }` with `previous` being the caution stop. Suggested fix: name the nearest preceding stop that is not a pass-through caution stop (here stop 5), and add a unit assertion for it next to the new test. Not blocking: the map shows stop 5 as Today and Ready.

VERDICT: PASS (M1 confirmed fixed; one MINOR, N1, for the backlog)
