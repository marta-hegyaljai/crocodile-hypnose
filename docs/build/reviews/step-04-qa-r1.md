# Step 4 QA, round 1 (home and river map)

Tested 2026-10-06 on `step/S04` at 6f2d6a6. Real API (`server/`, port 4620) and a dev web build (port 4621), driven with Playwright in Chromium at 390x844, 360x640 and 820x1180. Fresh accounts, onboarding through the UI (dev skip on the first session). Screenshots: `docs/build/screenshots/qa/step-04/`. Servers stopped by PID afterwards.

Static checks (`npm run check`, server tests, e2e) were not re-run; this was a hands-on pass only.

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| Home shows today's session; one tap starts it | PASS. Sleep goal gives "Sleep · Stop 1"; the play button opens `/session/sleep-1` directly. The card matches the goal zone. A Focus-goal user (coming-soon zone) gets "Intro · Stop 1" (see m6). |
| Tapping a locked stop explains why | PASS. Sheet reads "Finish Sleep · Stop 2 first to unlock this stop.", no Start button, Close works, Esc closes. A locked stop opened by URL (`/session/sleep-9`) shows "This session is not available." |
| Completing a stop unlocks the next and moves the croc | PASS. The croc swims to the next node (spring), the map auto-scrolls to follow, and the today card, the zone count and the node states update. Completed stops 1 to 10 in a row; the long trance is a big special node with a gold ring. |
| Map rich and gamified at 390x844 / 360x640 / 820x1180 | PASS with MINORs. Jungle river, lily pads, reeds, a moon in the Sleep zone, a distinct palette per zone, amber check nodes, a pulsing current node. See m1 to m4. |
| No jank when scrolling | PASS. At 4x CPU throttle, 240 scripted scroll frames: median 16.7 ms, 0 frames over 33 ms. DOM about 1,365 nodes. Headless only; a real device is BLOCKED. |
| Reduced motion respected | PASS. With `prefers-reduced-motion: reduce` the croc jumps to the next node with no spring, and the map jumps with no animation. The pulse is static according to the code (`StopNode` uses `!reduced` for the loop). I could not measure the pulse at runtime. |
| Works offline after first load; syncs when back online | PASS in-session. Offline: completing stops works, the home shows "Saved on this device. It syncs when you are back online." and the next stop unlocks. Back online it flushes within a few seconds and the notice goes. Cold reload while offline fails on web (see m7 and BLOCKED). |

## Other exploration, all fine

- Second device (new browser context, signed in) sees the finished stops and the right current stop. Two tabs in one browser share progress, and a stale tab that completes its old current stop recovers cleanly.
- Two devices both offline, each completing different stops (sleep-3 both; sleep-4 on one only), then back online: after reload both show the union (Stop 5 next). No errors, last-write-wins behaves.
- Caution mode ("yes" on safety question 1): the today card is Sleep · Stop 1 (safe). Unsafe stops (intro-6, intro-9, sleep-5, sleep-10) say "Not suggested for you" with a sheet and no Start button; they do not block later stops (sleep-6 is Ready while sleep-5 is skipped).
- Tabs: Home, Croc, Games and Profile all work; the map scroll position is kept on return. Placeholders as expected. No horizontal page scroll at 360 with a very long account name (the greeting truncates with an ellipsis).
- Double tap on the play button and on Complete (dev): one session opens, one stop completes. Browser back from the session returns home. Reload on a session route works.
- Keyboard: Tab goes play button, then every stop in order; Enter and Space open the sheet; focus moves into the sheet and is trapped; Esc closes it and returns focus to the stop; a focused stop scrolls into view. 
- Tap targets: nodes 64 px (long trance 92 px), play button 60 px, sheet Start 65 px and Close 57 px.
- Console and page errors: none in any run.

## Findings

No BLOCKER, no MAJOR.

### MINOR

- **m1. The croc is small for the main character.** Steps: open home at any size. Expected: the user's croc reads as the hero of the map. Actual: the map croc is 112x38 px (a low swimming profile), the same at 390 and at 820, and the header avatar is about 50 px. It is easy to miss next to the 64 px nodes. Suggest a larger or taller pose, or a sitting-on-the-node pose, plus a small speech or "you are here" tag. Designer pass. Screenshot: `01-home-390.png`.
- **m2. The map is cramped at 360x640.** The greeting plus today card plus tab bar leave a 358 px map window (562 at 390x844), so about two nodes show at once. Suggest collapsing the greeting and header when the viewport is short, or shrinking the today card. Screenshot: `08-home-360x640.png`.
- **m3. Zone scenery has hard rectangular seams and repeats.** Each zone is a rectangle with a straight edge (Intro to Sleep, and the misty coming-soon blocks show visible rectangle edges at the fog layers). The scenery pieces (round bushes, reeds, grey stones, lily pads) repeat from zone to zone, so Stress, Confidence, Focus and Habits are only greyed copies. Suggest a blended edge (gradient or wavy shoreline) and one signature prop per zone. Screenshot: `02-coming-soon-seams-390.png`.
- **m4. Tablet 820x1180 feels sparse.** The map is full width but nodes are still 64 px, the zone sign and croc stay small, and there is a lot of empty water and bank. A max-width map column, or a wider swing and larger props, would help. Screenshot: `09-home-820x1180.png`.
- **m5. No zone-complete moment.** Finishing Sleep (10/10) gives no celebration or message. The croc jumps from the Sleep finale to Intro Stop 1 at the top, and the map scrolls about 1,500 px away. Probably a later step (points, rewards); log for step 7. Screenshot: `10-zone-done-390.png`.
- **m6. A coming-soon goal is not explained.** A Focus-goal user gets "Intro · Stop 1" with no hint that the Focus zone is not ready yet. Tapping the misty coming-soon region or sign does nothing and gives no feedback (nodes are inert ghosts). Suggest a short "Focus is coming; start with the Intro" line, and a small tap response on a coming-soon sign.
- **m7. Cold reload offline fails on web** (`net::ERR_INTERNET_DISCONNECTED`, no service worker). In-session offline use works. Native should be fine; confirm on a device. Not a regression for a dev web build, but "works offline after first load" is only true for a page that stays open.
- **m8. A stale second tab or device does not refresh by itself.** After another device completes a stop, the open tab shows the old state until a reload or the next write (synthetic focus and visibility events did not trigger a pull). It recovers without conflicts, so only polish. Consider a pull on focus or visibility.
- **m9. "Not suggested for you" (caution) nodes look like Ready nodes.** In `06-caution-map-and-sheet-390.png` the skipped audio stop is a white node with a glyph, nearly the same as a Ready one (only the outline differs, and the current node has a ring). The state is only explained in the sheet and the screen-reader label. Suggest a different look, for example a dashed outline or a small soft badge.
- **m10. The current stop's sheet does not say "You are here".** The stop's accessible label does, but the sheet shows only "Ready" for the current stop. Minor wayfinding gap.
- **m11. Keyboard.** A keyboard user passes about 19 stop nodes before reaching the tab bar, and the sheet's backdrop is a tab stop. Consider skipping done and locked stops, or a skip link; and take the backdrop out of the tab order.

## BLOCKED

- Real-device touch scrolling and 60 fps on a low-end phone: only headless Chromium with 4x CPU throttle was available.
- Native offline cold start, background sync, haptics: no device.
- Reduced motion from the OS on native: tested with the browser media feature only.

## Environment notes

- A programmatic `scrollTo({top, behavior: 'instant'})` on the map scroller ended at 0 in my runs while `scrollTop = n` and the mouse wheel worked as expected. I treated it as a test artifact (a real wheel and the keyboard focus scroll were fine); mention only in case someone sees the same in e2e.
- Reusing an old saved browser state after a refresh-token rotation signed the test user out once. I recreated the state after each run. That is the known multi-tab backlog item for step 2, not new.

VERDICT: PASS
