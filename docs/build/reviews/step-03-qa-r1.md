# Step 3 QA, round 1

Tester: QA engineer agent. Build: a fresh `expo export --platform web` of `3efe3e1` with `EXPO_PUBLIC_DEV_MODE=1`. This is the same as `npm run build:web`, and `check-web-build` passed. I exported to a scratch folder so the reviewer's build could not overwrite it, and served it the same way as `npm run serve:web` (`serve --single`, port 4173).

API: `server/` on port 4000 with its own SQLite file and `AUTH_RATE_LIMIT_MAX=500`, so the many sign-ups would not hit the rate limit. An orphaned engineer server (PID 23843) was holding port 4000. I stopped it by PID.

Browser: Playwright Chromium from `/opt/pw-browsers` at these sizes:
- 390x844 and 360x640 (mobile, touch)
- 820x1180 (tablet)
- 844x390 (landscape)
- 1280x800 (desktop, keyboard tests)

I used real taps and clicks, typing, Tab/Enter/Space, reloads, browser back and forward, two tabs, a second and third browser context ("devices"), a stopped API server, route delays and aborts, a rejected `HTMLMediaElement.play()`, a hidden tab, and `prefers-reduced-motion: reduce`.

Screenshots: `docs/build/screenshots/qa/step-03/`.

## Acceptance criteria

| Criterion | Result |
|---|---|
| `npm run check`, server tests and e2e pass | `npm run server:test`: 74/74 pass. I left `npm run check` and `npm run e2e` to the code reviewer, who has the other ports. |
| Every step works at 390x844, 360x640, 820x1180 with keyboard and screen reader labels; tap targets ≥ 44px; reduced motion replaces animations with simple fades | **Partly met.** An automated audit of every step at 360, 820 and landscape found no target under 44x44, no horizontal scroll and no element off-screen. The accessibility tree has good names: checkbox/radio cards, "Onboarding progress: step 1 of 7", "Crocodile egg. Tap to hatch, 3 taps to go.", "Breathing guide", Pause/Play. Reduced motion works: the egg stops wobbling (1 distinct frame vs 6), hatching is instant, sink and surface are a 320 ms fade, and the breathing ring holds still while the text cue changes. **But:** the goal-limit feedback is off-screen on phones (M1). The egg has no visible keyboard focus, and Space does nothing on the choice cards or the mood picker (M7). |
| Hatching and sink-under feel delightful and polished | **Not met yet.** The orchestrator's observations are confirmed (M8, M9). |
| Rules: progress persists per step; reload/kill resumes; completed onboarding never shows again; second device skips it | **Partly met.** Reload on every step resumes there with answers kept. A third device signing in to a finished account lands on home. **But a stale tab or device silently undoes a finished onboarding (B1).** A finished first session is lost on reload (M6). |
| Back works on every step without losing answers; skip where the brief says | **Partly met.** In-app back keeps all answers on every step (goals, experience, safety answers, consent, croc name). Reminder "Not now" / "Continue" works. **But** Back from Reminder lands on "Session complete", which has no Back button (M6). |
| Safety check | **Met.** All 8 yes/no combinations behave correctly. Any "yes" shows the calm info screen and sets `cautionMode: true` in settings, locally and on the server. "No" to all shows nothing and sets `cautionMode: false`. Changing an answer asks for acknowledgement again. **But** a double tap can acknowledge the info unseen (M3). |
| Consent | **Met for decline.** No mood picker before or after, and `moodBefore/moodAfter` stay `null` locally and on the server. With consent, both values are stored. **But** withdrawing consent later in onboarding keeps the values (M2). |
| Reminder | Web shows the fallback notice and is skippable. It stores `reminder: "unavailable"` and the time follows the morning/evening choice (08:00 / 20:30). I could not test native scheduling. |
| Done | "+50 Points" and "<name> is with you", then home. `rewardGranted: true`, and `/onboarding/*` redirects to `/home` afterwards. |
| Server down / offline | **Met.** With the API stopped from consent onwards, I finished onboarding to home. A reload with the server down resumed on the same step. After the server came back, the pending documents synced as soon as the tab got focus or visibility (`completed: true`, consented moods included). |
| Sign out mid-onboarding, then a different user | No data leaks. After A's session ended (revoked out of band), localStorage held no documents. B (a Coaching-created account) started at Goals with nothing of A's: goals, experience, egg, mood and name were all fresh. **But** there is no way to sign out during onboarding (M4). |
| Coaching user | `npm run create-user` user → first sign-in to Hypnose lands on Goals. Works. |

## What works well

- The river progress with the egg, later the hatchling, stepping along the stones is charming and clear. "Step N of 7" sits next to it.
- The egg idles with a wobble and cracks visibly with each tap: a small crack, then a hole with an amber eye. The live-region hint counts down ("2 more taps", "One more tap"). The burst has flying shell pieces, petals and sparkles. The hatchling then looks around (excited, pleased, a blink, happy) before the name sheet slides up and the scene lifts to keep the croc in view.
- Name input: trimming, blank, more than 20 characters, emoji (20 crocodile emoji is fine), Arabic and Hebrew (right-aligned correctly) and an HTML-looking name are all handled. Enter submits.
- Audio: Start is the user gesture, so playback starts during the sink. Pause and resume work and the time freezes. Playback keeps going with the tab hidden. Browser back mid-session stops the audio. A missing file or blocked `play()` falls back to a silent timer with a clear notice.
- Offline-first behaviour is solid. Nothing errors when the server is down.

## Findings

### B1. BLOCKER: A stale tab or device overwrites a finished onboarding (whole-document last-write-wins)

The onboarding document is written whole, and the newest `updatedAt` wins. Any device still holding an older, incomplete copy wins the moment the user taps anything there. It replaces the finished document on the server and on that device, and the user is sent back into onboarding. Lost: `completed`, croc name, `crocHatched`, the first session, consent, the reminder decision and `rewardGranted`. Once the points ledger exists, the reward can then be granted twice.

**Repro A (two tabs, deterministic):**
1. Sign up and pick a goal.
2. With tab A showing Experience, open the app in tab B (same browser).
3. Finish onboarding in B and reach home.
4. In tab A, which still shows Experience, tap "Morning".
5. **Actual:** the server now has `completed:false, step:"experience", crocName:null, crocHatched:false, rewardGranted:false`. Reloading B lands on `/onboarding/experience`.
6. Screenshots: `31-two-tabs-B-home-390.png`, `32-two-tabs-B-after-reload-back-in-onboarding-390.png`.

**Repro B (two devices):** device 1 stops at Safety, device 2 signs in, resumes at Safety (good) and finishes. Then on device 1, tap "No" on question 1. The server document goes back to `step:"safety", completed:false, crocName:null`. A third device signing in then lands on Safety.

**Repro C (second device on a slow network):**
1. Finish onboarding.
2. In a new browser, delay `GET /me/onboarding` by 9 s and sign in.
3. **Actual:** the page stays blank for 6 s, then shows Goals as a fresh user (`52-…`). Tapping a goal makes that the newest document, so the finished onboarding on the server is replaced (`completed:false, step:"goals", crocName:null`).

**Expected:** Finished onboarding never shows again and is never undone by a stale copy. For example: merge rather than replace; treat `completed`, `crocHatched`, `rewardGranted` and `firstSession.completed` as one-way on client and server; have the server refuse to un-complete. A completed server document should also win over any incomplete local one.

### M1. MAJOR: The goal-limit feedback is invisible on phones

- **Steps:** At 390x844, pick Sleep and Stress, then tap Habits (visible without scrolling).
- **Actual:** Nothing visible happens. "Pick at most 2. Unpick one to change it." renders at y=786–860, under the sticky Continue footer (top 763). "2 of 2 picked" is also under the footer edge. The same happens at 360x640 and 844x390. There is no haptic, croc reaction or card nudge on a refused tap. Only 820x1180 shows the notice.
- **Expected:** Clear feedback where the user is looking, as the brief asks ("Selection limit enforced with clear feedback"). For example, scroll the notice into view, put it above the cards or in the footer, or nudge the refused card and have the croc react.
- **Screenshots:** `02-goals-limit-p390.png`, `02-goals-limit-p360.png`, `02-goals-limit-land.png` (vs `02-goals-limit-t820.png`).

### M2. MAJOR: Withdrawing mood consent keeps the mood values stored (health data)

- **Steps:**
  1. Consent: Allow.
  2. First session: Mood 1 before, finish, Mood 5 after, Continue to Reminder.
  3. Go back to Consent: Back, then browser back (see M6), then Back.
  4. Choose "Skip mood check-ins" and Continue.
- **Actual:** `moodConsent:false`, but `firstSession.moodBefore:1, moodAfter:5` stay in localStorage and on the server, in both the onboarding and settings documents.
- **Expected:** Declining clears any stored mood values, locally and on the server ("stored only after explicit consent").
- **Screenshot:** `19-first-session-after-revoke-390.png`. The values were checked with the API.

### M3. MAJOR: A double tap on Continue lands on the next screen's primary button (safety info can be acknowledged unseen)

The next screen's primary button sits exactly where Continue was, and nothing swallows the second tap. On touch, a double tap 90 ms apart gave:
- **Safety** (with any "yes"): the info screen opens and the second tap hits "I understand". The user goes straight to Consent without seeing the safety information, and `acknowledged:true` is stored. This defeats the point of the screen.
- **Hatch → First session:** the second tap hits Start, so the session starts (audio, sink) without the user choosing, and the mood-before check is skipped.
- **Session complete → Reminder:** the second tap hits Reminder's Continue, which skips the reminder screen. On native, where the primary button is "Turn on reminders", this would trigger the permission request.
- **Expected:** One tap moves one step. Use the existing tap shield on step changes, or ignore input for a short moment after a screen arrives.

### M4. MAJOR: There is no way to sign out during onboarding

- **Steps:** Sign in with the wrong account, or a shared device, and look for a way out on any onboarding step.
- **Actual:** No step has sign out. The only way out is to finish the whole onboarding, including safety answers, consent, hatching and the 75 s session, all stored against the wrong account, then use Sign out on home. A user who cannot or does not want to continue right now is stuck in the account.
- **Expected:** A low-key way to sign out (or switch account) on onboarding, for example on Goals or in a small menu.

### M5. MAJOR: The first session cannot be stopped or left from inside the player

- **Steps:** Start the first session.
- **Actual:** The night player has only Pause/Play. "Skip (dev)" exists only in dev builds, and Escape does nothing. Pausing leaves the user on the dark screen with the time frozen and no exit. The only ways out are to resume and wait, or to use browser / OS back. iOS and a web app added to the home screen have no back button. For someone who feels uncomfortable during a hypnosis session (possibly in caution mode), that is a trap.
- **Expected:** A calm, low-key way to end the session early, for example a close button that surfaces back to Daylight.
- **Screenshots:** `07-night-player-390.png`, `36-night-paused-390.png`.

### M6. MAJOR: The "Session complete" state is a dead end for Back and is lost on reload

a) Back from Reminder returns to the first-session screen, which is still in its "Session complete" state. That state has no Back button, so in-app back navigation stops there. I needed browser back to continue (`20-back-from-reminder-lands-on-complete-390.png`).

b) Completion is saved only when the user taps Continue on "Session complete". A user who listens to the whole 75 s session and then closes the tab or app on that screen (the natural moment to put the phone down) gets the intro again on reload, with "Start" only. They must replay the session. Mood-after is also lost. (`18-after-reload-390.png`, intro shown, `firstSession.completed:false`.)

**Expected:**
- Back is available (or Back leads to the intro with "Play again" / "Continue").
- The session counts as completed as soon as it ends. The after-mood can still be added on that screen.

### M7. MAJOR: Keyboard: the egg has no visible focus, and Space does not select choice cards or moods

- The egg sets `noNativeOutline` and draws no replacement ring. Tabbing to it (`:focus-visible`, outline `0px`, no shadow) shows nothing, yet it is the only thing to do on that screen. Screenshots: `46-egg-keyboard-focus-p390.png`, `46-egg-keyboard-focus-land.png`, `42-kbd-egg-focus-desk.png`.
- Space on a focused goal card (role `checkbox`), any experience, safety or consent card (role `radio`) or a mood option (role `radio`) does nothing. Only Enter works. Space is the standard key for checkboxes and radios, and the one screen-reader users press in forms mode. Buttons and the egg do react to Space.
- Everything else is fine with Enter. Keyboard-only from sign-up to home works, and the tab order is logical.
- **Expected:** A visible focus ring on the egg, and Space toggling cards and moods.

### M8. MAJOR (design): The hatch climax is small and low in a big empty sky (orchestrator observation confirmed)

- At 390x844 the hatchling is about 130 dp wide and very flat. It sits on the nest at the water/bank edge, about 63–75% down the screen, under roughly 45% empty pale sky, with about 20% blank bank below.
- At 820x1180 it is about 20% of the width, with more than 50% empty sky (`50-hatch-burst-t820.png`). At 360x640 it is the same (`50-hatch-burst-p360.png`).
- The egg before hatching reads well, but the moment it becomes a croc it looks smaller and is pushed to the edge of the frame. The burst particles are small and fly into the water. Before tapping, the screen is also mostly empty sky between the title and the scene (`06-hatch-egg-390.png`).
- **Expected:** The hatchling is the hero: bigger, framed in the centre of attention, and the sky used, for example by a camera move or zoom on hatch, the particle burst filling the space, or the title and chip closer to the action.
- **Screenshots:** `06-hatch-burst-100-390.png`, `hatch sequence 06-hatch-tap*/burst-*`, `50-hatch-burst-t820.png`.

### M9. MAJOR (design): Night player composition (orchestrator observation confirmed), and a weak sink transition

- The breathing ring overlaps the crescent moon at 390x844 and 360x640: the moon shows through and is cut by the translucent ring. The ring also covers the palms and reeds.
- The croc's "eyes" are two small amber pills at 22–52% opacity just below the waterline. They read as two yellow dashes, not a croc watching. "Breathe in" sits on the jungle line right above them.
- At 390 and 360, the pink-flower lily pad sits on top of the start of the progress bar.
- In landscape the eyes are squeezed between the progress bar and the play button, and "1:10 left" sits on the waterline.
- The sink-under is calm, but it happens in a strip about 170 dp tall at the top. Meanwhile the white sheet, three-quarters of the screen and mostly empty below the mood picker, just greys out. The croc's descent is easy to miss, so the signature transition reads as a dim more than a dive.
- **Screenshots:** `07-night-player-390.png`, `50-night-player-p360.png`, `50-night-player-land.png`, `07-sink-*`, and the sequence grid (`07-first-session`, `07-sink-300…1700`, `07-surface-*`).

## MINOR

- **m1. Fast taps on the egg are swallowed.** The 220 ms bounce filter drops real fast taps. Three taps at 150 ms or 200 ms intervals count as two ("One more tap"), and an ignored tap gives no wobble or sound. A 220 ms gap is normal human tapping speed. Consider about 80–120 ms, or giving feedback on every tap.
- **m2. Name edge cases.**
  - A zero-width space (`​`) is accepted, which gives an invisible name in "… is with you".
  - ZWJ emoji count as several characters: one 👨‍👩‍👧‍👦 is 7, so three of them are refused as "more than 20 characters".
  - There is no live counter, and the field silently stops at 40 UTF-16 units.
- **m3. "Experienced" breaks mid-word at 360x640** ("Experience / d") in the two-column card (`50-experience-p360.png`).
- **m4. The mood picker wraps 4 + 1 at 360x640**, leaving "Mood 5" alone on a second row (`50-first-session-p360.png`).
- **m5. Safety info is screen state, not a route.**
  - Browser back on the info screen skips to Experience.
  - A reload on it returns to the questions.
  - In landscape it opens with the questions' scroll offset, so its title is hidden under the river progress (`50-safety-info-land.png`).
- **m6. Focus after a step change lands on `<body>`.** Screen-reader users are not told about the new step. After Enter on the safety Continue, focus lands on "I understand", so a second Enter acknowledges without reading.
- **m7. Small state that is not kept:** egg cracks reset on reload (2 taps, then reload, shows "Tap the egg 3 times"). A name typed but not submitted is lost on browser back and forward (back to "Croc").
- **m8. Second device, slow server:** a blank white page for up to 6 s, then a fresh Goals screen (see B1, repro C). Show the splash or a calm loading croc, and do not show onboarding for an account the server has not answered for.
- **m9. Large empty white sheets** below short content on First session, Session complete, Consent, Reminder and Done at 390, and much more on the tablet (about 60% blank). The Done "celebration" is a small petal burst in the top band. For the designer.
- **m10. Web reminder:** the "Every day at 20:30" chip looks like a confirmed schedule, while the notice below says reminders are unavailable.
- **m11. Audio failures throw uncaught page errors** ("The element has no supported sources.", `NotAllowedError`). The fallback works, but the toggle shows "Play" (as if paused) for 2–3 s before the silent timer starts (`38-…`, `39-…`).
- **m12. Egg accessible name:** "Tap to hatch, 1 taps to go." On the hatch screen the egg comes before the heading and Back in reading order.
- **m13. Weak night focus ring:** the focus ring on the night play toggle is a faint thin line (`48-…` vs `48b-…`).
- **m14. Desktop hatch title:** at 1280x800 (not a required size), the jungle leaf covers the start of "Hatch your croc" / "Tap the egg" (`42-kbd-egg-focus-desk.png`).

## Not tested

- Native-only features: haptics, sound hooks (`feedback.sound`), local notification scheduling and the permission-denied path, Android hardware back, iOS swipe-back, background audio and the lock screen.
- Real screen readers (VoiceOver / TalkBack / NVDA). I checked the accessibility tree instead.
- `npm run check` and `npm run e2e`, left to the code reviewer (shared e2e ports).

VERDICT: CHANGES REQUIRED
