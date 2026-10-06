# S06 Mini-games: QA round 1

Run: API 4740 + dev web build 4741, Playwright/Chromium at 390x844, 360x640, 820x1180, `__mhpTimeScale` fast-forward, reduced motion, keyboard, offline, reload, page-hidden. Screenshots: `docs/build/screenshots/qa/step-06/`.
Not run: `npm run check`, server tests and the e2e suite (reviewer/engineer own those).

## Acceptance criteria
- Games tab is a real jungle clearing with croc, three cards, "Played N times", "Best: ..." (persists across reload): PASS (01, 25, 33).
- Each game from the tab and from map stop `sleep-3` (Stillness): PASS. Stop sheet "Start" goes to `/game/stillness?stopId=sleep-3`; finishing marks the stop Done.
- Never losable: PASS (no fail state anywhere; wobble/lift only lowers a score, shown only at the end).
- Quit mid-game: pause card says "Nothing is lost", leaving returns home, no record added, nothing marked done: PASS (but see m1).
- Pause (button, back button, page hidden/blur): PASS. Hiding the page while playing pauses the game; resume continues the right round.
- Reduced motion: Firefly/Breathing/Stillness play and finish: PASS.
- Keyboard: Tab reaches back/start; Space/Enter hold on the breathing water and the lily pad work: PASS.
- Tap targets: back/pause 44x44, buttons 55-63 high, cards 130 high: PASS.
- Offline: a running game keeps running; reloading offline shows the browser error (expected, known service-worker backlog item); deep link `/game/firefly` reloads to the intro; back from a deep link lands on /games; unknown game id shows a friendly "not available": PASS.
- Scoring sanity (scale 5, real finger sim): still 100, jiggle 62, lift-off 4: PASS.
- Console/page errors across all runs: none.

## Findings

### MAJOR
**M1. Stillness (touch fallback) never ends if the finger never rests on the pad.**
Steps: Games > Stillness > Start, do not touch the pad (or read the cue slowly, get distracted). Expected: the 90 s game ends gently on its own like the other two. Actual: `onTick` returns early while `touch && !rested`, before the end-of-time check, so the clock runs forever (still going after 400 s of game time; screenshot 28). Only pause/quit remain, no end screen, no way to finish. As soon as the finger touches once the game ends immediately. Dead end for a first-time user who doesn't see the pad. Suggest: check the end time before the early returns (and/or show a "rest a finger on the pad" nudge that grows after a few seconds).

### MINOR
- **m1. Quitting a map game mid-game marks the stop "Started"** (stop label: "Started. You are here") because `onStarted` fires on Start. Progress isn't lost or failed, but "untouched" is not literally true; decide if Started is wanted for games (sessions behave the same?).
- **m2. Stale instruction on the end card.** After Stillness finishes the cue "[Rest a finger on the lily pad...]" stays at the top while the end card is up (screenshot 09). Hide the cue when `ended`.
- **m3. End card hides the croc at 360x640.** Firefly end card covers the whole croc (17); Breathing end shows only the head (23). The calm end croc is the payoff; at small phones shrink the card, move the croc up, or lift the scene.
- **m4. "1 breaths"** (no singular) in the chip and on the end card; likewise any "1 of..." fine, but breaths needs a plural rule.
- **m5. Idle play counts as played.** Breathing with zero holds runs to the end and records "0 breaths" as a play, "Best: 0 breaths", and completes the map stop. Same shape as M1 for Stillness. Consider a minimum-engagement rule before the S05 reward is wired. The 0-breath end card also has no gentle line for that case.
- **m6. No feedback for too-short holds in Breathing.** Four quick taps give 0 breaths and nothing says why; add a soft "hold a bit longer" cue.
- **m7. Escape does not pause** during play (only the pause/back buttons); keyboard focus is dropped to `<body>` when the pause card opens (no focus move to "Keep going").
- **m8. Breathing count chip uses the amber points-drop chip**, which reads as currency; use a neutral chip.
- **m9. Lily pad has no pressed state** and its glow is a muddy grey-green pill (04, 27); a clear "finger is resting" feedback would help the touch fallback feel responsive.
- **m10. Duration mismatch:** stop sheet says "3 min", clearing card says "2 min" for the same game.
- **m11. Firefly "optional stillness measure"** from the brief is not present (no measure at all); fine if deferred, record it.
- **m12. Tablet (820x1180):** clearing cards stay in a 526 px column with a big empty lower half; croc in the scene is small. Cosmetic.

### BLOCKED (not testable here)
Native device-motion sensor path (expo-sensors), real DeviceMotion/iOS permission prompt on a phone, haptic tick at breath turn, sound hooks / system mute, 60 fps on a device. Web fallback used for all runs.

## Feel
Delightful where it works: the Firefly night scene with the croc closing its eyes in the eyes-closed moment is the standout; the clearing and breathing ring/ripples are calm and clearly in the river world. Breathing guide ring and the user's amber fill are similar in weight, so "follow the ring" vs "your breath" is a little muddy. Placeholder copy (bracketed) is intentional and not flagged.

VERDICT: CHANGES REQUIRED
