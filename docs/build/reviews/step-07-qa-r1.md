# S07 Gamification: QA round 1

Run for real: API on 4860 (DEV_HOOKS=1), web export on 4861, Playwright/Chromium at 390x844, 360x640, 820x1180. `npm run server:test`: 109/109 pass. Screenshots in `docs/build/screenshots/qa/step-07/`.

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| Sessions and games earn points on the server; home and Croc tab show the server value | PASS. Session 10 + 20 first-time + 15 first-session scale = 95 from 50. Game (from Games tab) +5 +15 scale. Map game stop emits both a game and a session event (by design). |
| Offline pending points | PASS. Game offline shows "50 +5" on home and Croc tab; paid once back online (70 with the 15 scale). |
| Weekly goal: target 3-7, reach it, small celebration, no penalty | PASS (after back-dating the account in the DB, since 3 real days cannot pass in a test). 2/3 then a session gave 3/3, +30, a dismissible toast with a burst, and a pink chip. Target stepper clamps at 3 and 7. No penalty copy anywhere. |
| Growth moment once, not on reload, not on a second device | PASS. Moment shows on next home visit; after Continue it does not return after reload or on a fresh sign-in in a second browser context. |
| Habitat: buy, place, take out, locked, not enough points, offline | PASS with notes (M1, m2, m3). Buy auto-places, "Take out" and "Place" work, survive reload, sync to `/me/habitat`. Locked item (turtle) shows "Unlocked by: 7 days". Milestone item (glow lotus) claims for 0. Offline buy shows "Buying needs a connection". |
| Badges collection | PASS. 10 scales on the Croc tab, earned vs grey, "First decoration" arrives after the first buy. |
| Gaming it | PASS on the server (see below). |
| Reduced motion | PASS for the growth moment (croc is shown grown at once, no wait). |
| 390 / 360 / 820 | PASS. No horizontal page scroll, no tap targets under 44px on the Croc tab, 2/3/4-column grids adapt. |

### Gaming attempts (API, fresh account)
- 50 `gameCompleted` events dated 1..50 days in the future: clamped to now, capped at 12 per day (75 points = 12 x 5 + 15 scale). Not exploitable.
- Replaying an event id, a forged `longTrance` + `firstTime`, a non-existent stop: ignored (matches the e2e).
- Events dated before the account: ignored.
- 8 parallel buys of one item: charged once. 5 parallel buys beyond the balance: all 409, balance never below zero.
- UI double-tap on Buy: charged once. Two tabs: tab A buys lotus (60) and tab B buys dragonflies (50) from 105: only one succeeds, balance 55, no overspend.
- Crafted placement (lily pads in the `air` slot, same item in three slots): server cleans it to valid slots only.
- `__proto__` item id: 400.

## Findings

### MAJOR
None.

### MINOR
- **m1. Double-tap on Continue falls through to the tab bar.** Steps: finish a session or trigger the growth moment, double-tap "Back to the river" / "Continue" (Playwright `dblclick`). Expected: lands on home. Actual: the first tap closes the overlay and the second hits the Games tab beneath, so the user ends up on `/games`. Reproduced on both overlays. Suggest ignoring presses for ~400 ms after the overlay unmounts, or keeping the overlay until the dismiss settles. Screenshot: n/a.
- **m2. Habitat scene scrolls away, so buy/place feedback is off screen.** At 390x844 the lagoon is at the top and the 12 cards are below; buying Heron or Waterfall (or taking out Reeds) changes the scene and plays the sound/burst while the scene is not visible. The user has to scroll up to see their new decoration, which weakens the "croc is the hero, decorating is rewarding" moment. Suggest a compact sticky scene on phones, or scrolling the scene into view after a buy. Screenshot: `16-locked-insufficient.png` (scene not visible while shopping).
- **m3. A disabled Buy button gives no reason.** Items the user cannot afford show a greyed "120 Points" button with no "X more points" hint; the "Not enough points" notice only appears if a stale tab races the server. It is not punishing, but a friendly "15 more points" line would be clearer. Screenshot: `16-locked-insufficient.png`.
- **m4. Games give no reward feedback.** The game end sheet shows only "3 of 3 rounds" with Done / Play again; no "+5 points" or "new scale earned" (compare the session reward, which shows points and a first-time bonus). The scale (+15) is also silent on home. Points are visible later on home/Croc. Screenshot: `05-game-end.png`.
- **m5. Weekly chip shows a check mark at 0/4.** The goal chip on home uses the check icon from the start (green), which reads as "done" before any progress; the sparkle/pink state only appears once reached. Screenshot: `07-weekly-reached.png` (pink, reached) vs the 0/4 state in the earlier home view.
- **m6. Session reward total omits the scale and weekly bonuses.** Reward sheet shows "+30" (10 + 20 first-time) while the balance rose by 45 (15 scale). Not wrong (those are separate rewards) but the scale earned is never announced anywhere on the reward screens. Related to m4. Screenshot: `02-session-reward.png`.
- **m7. Weekly-goal toast is not shown once per week, it persists until dismissed.** If the user reaches the goal and reloads without tapping the X, the toast shows again; it sits over the map above the tab bar. Acceptable, but a self-dismiss after a few seconds would match "small celebration".
- **m8. Growth moment hero is the peek pose, so the growth is subtle.** The croc grows from stage to stage but only the head shows (stage 3 vs stage 4 look nearly identical in `08-growth-start.png` / `22-growth-360-reduced.png`). The brief asks for "the croc growing"; a full-body swim or a size comparison would sell it. Designer item. Stage names are "Stage N" placeholders.
- **m9. Autoplay console error on reload.** Reloading while a growth moment is due logs `play() failed because the user didn't interact with the document first` (hatch sound before a gesture). Harmless; sound should be skipped until the first gesture on web.
- **m10. Slot overflow silently replaces.** With more than three water items, buying the fourth replaces the one in the first slot (it goes back to "Place"). No notice. Fine for MVP, noted.
- **m11. Crafted `gameCompleted` still adds calm minutes.** Up to 12 events a day add 80-100 s of calm each (up to ~16 calm min/day) with no check that the game really ran. Bounded by the daily cap; stated design limit, worth an owner note.

### BLOCKED (not tested)
- Native haptics and sound, and native layout: web only.
- Offline cold reload on web (no service worker, already in BACKLOG, step 4 m7).
- A real 3-day/7-day/30-day progression and the turtle unlock by `days7`: only the 3-day week was reached, by back-dating the account in the dev database.
- Time zone changes around week boundaries on a device.

## Verdict

No blocker or major issues; the ledger, idempotency, growth, habitat and goal all behave and resist replay and races. The minors above go to the designer / backlog.

VERDICT: PASS
