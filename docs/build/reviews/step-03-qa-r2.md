# Step 3 QA, round 2 (scoped re-check: B1, M1 to M7)

Build: fresh `expo export --platform web` (dev mode) of the working tree, API on 4520 with its own SQLite, web on 4521. Chromium via Playwright at 390x844 (touch), 360x640 and 1280x800 (keyboard). Real taps, clicks, Tab/Space/Enter, reloads, three separate browser contexts as three devices. Screenshots: `docs/build/screenshots/qa/step-03/r2/`.

## Results

- **B1 CONFIRMED FIXED.** Device 1 stopped on Safety and stayed open. Device 2 signed in, resumed at Safety and finished to home. Server then held `completed:true, crocName, rewardGranted:true`. Device 1 (stale) tapped "No" on Q1: it went to home within 2.5 s and the server document was unchanged (same `updatedAt`, still completed). A reload of device 1 stayed on home. Two tabs in one browser: tab A (on Experience) followed tab B to home on its own, so "Morning" could not be tapped. Slow second device (GET `/me/onboarding` delayed 9 s): the page showed the loading screen at `/` for the full wait, never showed Goals, then went to home. Server doc untouched. (`b1-d1-after-stale-tap.png`)
- **M1 CONFIRMED FIXED.** At 390x844 with Sleep and Stress picked, tapping Habits shows "Pick at most 2. Unpick one to change it." inside the footer at y 677 to 751, directly above Continue (y 763). At 360x640 it is at y 473 to 547, above Continue (y 559). Fully visible both times. (`m1-goals-limit-390.png`)
- **M2 CONFIRMED FIXED.** Consent Allow, mood before 1, session, back through reminder and hatch to Consent, Decline. The moment Decline is tapped, `moodBefore` and `moodAfter` are `null`. After Continue, onboarding and settings documents are `moodConsent:false` with nulls, locally and on the server.
- **M3 CONFIRMED FIXED.** Touch double tap 90 ms apart on Continue at each step: Goals to Experience, Experience to Safety and Safety with a "yes" all move one step. Safety shows the info screen with "I understand" still pending (`acknowledged:false` stored). Name Continue lands on First session intro, with Start not pressed and no session started. Session-complete Continue lands on Reminder, not on Done. (`m3-after-name-dbl.png`)
- **M4 CONFIRMED FIXED.** A profile button (44x44) sits top-right on Goals, with "Signed in as <email>", "Your progress is saved to your account", Sign out and Cancel. Sign out returned to `/welcome` with no onboarding documents left in localStorage. It is also present on later steps (Hatch, First session screens showed it). (`m4-menu-open-360.png`)
- **M5 CONFIRMED FIXED.** The night player has a close button top-left (44x44). Pausing and then pressing it opens an "End the session?" dialog. "Keep going" returns to the player. Confirm returns to Daylight with the title "Session ended", the intro with Start, and `firstSession.completed:false`. Paused state is no longer a trap. (`m5-night-player.png`, `m5-end-dialog.png`, `m5-after-end.png`)
- **M6 CONFIRMED FIXED.** `firstSession.completed:true` is stored as soon as the session ends, before Continue. Reload on the "Session complete" screen shows the intro with **Continue** and **Play again**, with no forced replay, and Continue goes to Reminder. Back from Reminder lands on the intro, which has a Back button, and Back again goes on to Hatch and Consent. No dead end. (`m6-reload-after-complete.png`)
- **M7 CONFIRMED FIXED.** At 1280x800, Space toggles goal cards (on and off again), experience, safety and consent cards, and mood options. Space on the focused egg counts a tap (3 Spaces hatch it). The focused egg now draws a teal ring, in the desktop shot and at 390x844. (`m7-egg-focus-390.png`, `m7-egg-focus-desktop.png`)

## Remaining small notes (MINOR, not blocking)

- The egg focus ring is a teal arc, clearly visible on the bank half but low contrast on the dark water half, so the top of the ring nearly disappears. A lighter or double-stroke ring would be better.
- After-mood chosen on "Session complete" but not yet confirmed with Continue is lost if the user reloads (`moodAfter` stays `null`). Session completion itself is kept. Mood is only saved on Continue.
- On reload after completion, the intro shows the "before" mood question again above Continue and Play again, with the earlier before-value selected. Slightly odd, harmless.
- Copy placeholders still show as bracketed text on screen ("[Goals question: pick one or two]", "[First session intro]", "[Mood question]"). Presumably for the copy pass, noted so it is not shipped.
- Every earlier onboarding screen stays mounted in the DOM under the stack (same `data-testid` appears several times). Not a user-visible issue found here, but worth keeping in mind for screen-reader order.

## Regression note

Goals, Experience, Safety (all yes/no combos tried partially), Consent, hatch by tap and by Space, name entry, first session start, pause and dev skip, Reminder skip, Done and home all still work at 390x844. Forward and back kept answers. No page errors were seen in these runs. M8 and M9 (design) were not re-checked, as agreed. Native-only features (haptics, notifications, hardware back) and real screen readers were not tested.

VERDICT: PASS
