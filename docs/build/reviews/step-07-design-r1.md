# Step 7 design pass, round 1 (gamification)

Designer agent on `step/S07`. Scope: QA round 1's presentation minors m2, m3, m4/m6, m5, m8, m10. Presentation only: `src/services/`, `server/` and `shared/rules.ts` untouched; the stores are read, never changed. New copy is limited to four neutral placeholder keys (`gamification.habitat.morePoints`, `gamification.habitat.willSwap`, `gamification.newScale`, `gamification.a11yNewScale`).

Build: `expo export --platform web` with `EXPO_PUBLIC_DEV_MODE=1` on 4881, API on 4880 (`DEV_HOOKS=1`, own SQLite). Playwright Chromium at 390x844, 360x640, 820x1180 and 360x640 with `prefers-reduced-motion`, fresh accounts onboarded through the API, `__mhpTimeScale` 40. No page or console errors in any run. Screenshots: `docs/build/screenshots/design/step-07/`. Servers stopped by PID from `/tmp/s07-design/`.

## What was polished

**Growth moment (m8)** (`src/features/habitat/HomeCelebrations.tsx`). Rebuilt around the full-body croc instead of the peek pose: the croc stands on the near bank of the lagoon at its old size for a beat, then grows into the new stage with a pop (scale spring about its feet, cross-fade between the two stage drawings) while the big petal-and-sparkle burst fires around it and the hatch sound / success haptic play. The sheet carries a four-dot stage track (done stages amber, the new one large with a sparkle, the old one marked), a `Stage 2 ▸ Stage 3` chip pair so the change is explicit, then the existing title, message and Continue. With reduced motion the croc is shown grown at once, no scale animation, the burst static. Landscape/tablet keeps the croc on the right. `after-growth-start-390.png`, `after-growth-grown-390.png`, `after-growth-grown-820.png`, `after-growth-start-360-reduced.png`. TestIDs `growth-moment`, `growth-stage`, `growth-continue` unchanged.

**Habitat scene stays in view (m2)** (`src/features/habitat/HabitatScreen.tsx`). The name/points header and the scene are now fixed above a scrolling list; as the list scrolls the scene folds (UI thread, Reanimated scroll handler) from its full height to a band of ~40-50% that keeps the croc's head, the water line and the water-slot decorations, so buying, placing and taking out are always seen happening with the burst in view. The scene has a shallows backdrop while folding. `after-croc-top-390.png`, `after-croc-bought-390.png`, `after-croc-shop-390.png`, `after-croc-shop-360.png`, `after-croc-shop-820.png`.

**Missing-points hint (m3)**. An unaffordable item now says "{n} more points" under its greyed button, and the button's accessibility label carries the same. `after-croc-shop-390.png`.

**Slot swap made visible (m10)**. When every slot of an item's kind is taken, its Place/Buy button carries "Takes the place of {item}" (computed with the store's own `placeIn`, so it names exactly what will move out). Not screenshotted: a fourth water item needs a milestone unlock (glowing lotus / turtle).

**Game end sheet shows the reward (m4)** (`src/features/habitat/RewardExtras.tsx`, `GameShell.tsx` gains an optional `reward` slot, wired in `src/app/game/[gameId].tsx`). Under the result: a `+5 Points` chip and, once the server confirms it, a "New scale: {name} · +15 Points" pill with the scale drawing. `after-game-end-390.png`.

**Session reward announces the scale (m6)** (`RewardSheet` gains an optional `extra` slot, wired in `src/app/session/[stopId].tsx`). The same scale pill reveals after the first-time bonus. `useNewBadges` snapshots the scales held when the screen opened and shows only what the summary adds afterwards. `after-session-reward-390.png`.

**Weekly chip (m5)** (`src/features/home/HomeHeader.tsx`). A leaf while the goal is in progress (0/4 no longer shows a check), sparkle once reached. `after-home-0of4-390.png`.

## Checks

- `npm run check`: pass (typecheck, lint with zero warnings, 54 suites / 362 tests).
- `E2E_PORT=4882 E2E_API_PORT=4883 npm run e2e -- e2e/gamification.spec.ts e2e/session.spec.ts e2e/games.spec.ts`: 24 passed (phone-390, phone-360, tablet-820), 3.0 min.

## Remaining issues

- **MINOR (engineering, QA m1): double-tap on Continue / Back to the river falls through to the tab bar.** Interaction logic in the overlay dismissal, not presentation.
- **MINOR (engineering, QA m7, m9): the weekly toast persists until dismissed, and the hatch sound logs an autoplay error on a reload with a growth moment due.** A self-dismiss timer and skipping sound before the first gesture on web.
- **MINOR (design, backlog): the growth moment's bank is generous on tall screens** (empty ground under the croc at 390x844 and 820x1180). A taller croc figure scale for the moment, or near-bank reeds and stones, would fill it. Cosmetic.
- **MINOR (copy): stage names are "Stage N" placeholders**, and the growth title/message are placeholders; the stage track would read better with MHP's names.
- **Not tested:** native (haptics, Reanimated on device), Safari/Firefox, a real screen reader. The new pills carry labels (`gamification.a11yNewScale`), the folded scene keeps its image role and label.

VERDICT: PASS
