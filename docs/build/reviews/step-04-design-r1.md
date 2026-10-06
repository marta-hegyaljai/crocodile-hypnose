# Step 4 design pass, round 1 (home and river map)

Designer agent on `step/S04`. Scope: QA round 1's visual MINORs m1, m2, m3, m4, m9, m10 and the zone-complete moment (m5). Presentation only: no product logic, data flow, services, `src/content/journey.ts` or `useJourney.ts` changed. No new copy: the only new text on screen is the existing `map.current` key ("You are here").

Build: `expo export --platform web` with `EXPO_PUBLIC_DEV_MODE=1` on 4631, API on 4630 with its own SQLite file. Playwright Chromium at 390x844, 360x640 and 820x1180, fresh accounts onboarded with the Sleep goal through the API. Screenshots: `docs/build/screenshots/design/step-04/`. Servers stopped by PID afterwards.

## What was polished

**m1. The croc is the hero of the map** (`src/features/map/RiverMap.tsx`). The user's croc is now drawn full-pose at half the map width (170 to 200 pt on phones, 260 on the tablet; was 112x38), sitting on the water beside its stop and turned to look at it (mirrored when the stop is on its left). It keeps its own idle bob and blink, and a soft white ripple spreads on the water under it on the UI thread (`useLoop`, static with reduced motion). A small amber "You are here" tag hangs over the current node with a pointer, and springs along with the croc when it moves (jumps with reduced motion). The layout's zone header grew 92 to 108 pt so the tag never touches the zone sign on a first stop. `after-home-390x844.png`, `after-home-360x640.png`, `after-home-820x1180.png`.

**m2. More river on short screens** (`src/app/(app)/home.tsx`, `src/features/home/TodayCard.tsx`). Under 720 pt of height the top block tightens: smaller greeting (subheading), tighter gaps and a 72 pt today card (was 88). At 360x640 the map window grows from 358 to about 395 pt and the current stop plus the next one are in view with the croc and the sign. `after-home-360x640.png`.

**m3. One continuous river world** (`src/features/map/ZoneScenery.tsx`). Every zone after the first reaches 44 pt up over the zone above it and is cut with a wavy shoreline (seeded, stable), with a lighter tide line just above it, so there are no straight seams. The coming-soon mist follows the same wave instead of a rectangle, and the pads and reeds under it are dimmed with it. The river is wider (96/84/40 pt bank, water, current; was 78/66/30) and bushes have a ground shadow. Each zone has its own land colour and one signature prop: Intro a sun with rays, Sleep the moon and stars, Stress a cairn of balanced stones in lavender grey, Confidence a big low sun over warm sand, Focus three tall pines, Habits a wooden footbridge across the river's entrance. `zone-done-home-390x844.png` shows the Sleep to Stress seam and the cairn.

**m4. Tablet scale** (`src/features/map/layout.ts`, `ZoneScenery`, `RiverMap`). `MapLayout` carries a `scale` (1.15 from 560 pt wide, 1.3 from 700): nodes (83 / 120 pt), gaps, the river, bushes, rocks, pads and reeds and the croc all grow with it, and the swing widens to 195 pt. `after-home-820x1180.png`.

**m9. "Not suggested" nodes look different** (`src/features/map/StopNode.tsx`). A pale water-lily-mist pebble with a dashed rose outline, a muted rose glyph, and a small white "alert" badge on its shoulder; nothing else on the map uses rose. `caution-home-390x844.png` (Sleep · Stop 5, audio, next to Ready and Locked nodes).

**m10. The sheet says you are here** (`src/features/map/StopSheet.tsx`, `home.tsx`). The current stop's sheet opens with an amber "You are here" chip (`stop-sheet-here`) before the type, length and state chips. `after-sheet-current-390.png`, `caution-sheet-current-390.png`.

**m5. A zone-complete moment** (`RiverMap.tsx`). When a zone's count reaches its total, the existing `CelebrationBurst` (petals, sparkles, bubbles) fires from the zone's finale node for 2.4 s (`zone-burst`), and the auto-scroll to the next zone waits 1.9 s so the user sees it before the map follows the croc. With reduced motion the burst is the static spread and the map moves at once. `zone-done-home-390x844.png` (Sleep 10/10, mid-burst).

Motion stays on the UI thread (Reanimated shared values; the scenery is still one memoised SVG per zone, nodes memoised). No console or page errors in any screenshot run.

## Checks

- `npm run check`: pass (typecheck, lint with zero warnings, 35 suites / 295 tests).
- `E2E_PORT=4632 E2E_API_PORT=4633 npm run e2e -- e2e/home.spec.ts`: 6 passed (phone-390, phone-360, tablet-820). The croc-position assertion in the spec (`croc.y + 34` within 60 pt of the node centre) still holds with the new pose because the croc is centred on its node vertically.

## Remaining issues

- **MINOR (engineering, step 7 or later): the croc's ripple and body overlap the bank.** At 390 the hero croc is wider than the river, so its tail and ripple sit over the grass. It reads fine as a stylised map; a true fix is a river that bulges into a pool at the current stop (a layout change in `layout.ts` and a second river path in `ZoneScenery`).
- **MINOR (design, backlog): the "You are here" tag can touch a zone's signature prop** (the moon at Sleep · Stop 1 at 390). Cosmetic; the props could be placed on the bank opposite the first node per zone.
- **MINOR (QA m6, untouched): a coming-soon goal is still unexplained** and the misty signs are inert. Needs a copy key from MHP; out of a design-only pass.
- **MINOR (QA m11, untouched): keyboard order** through every node before the tab bar.
- **Not tested:** native (the `scaleX: -1` mirror on the croc, Reanimated springs on device), Safari and Firefox, a real screen reader (the map croc, ripple and tag are decorative; the node label and sheet chip carry "You are here").
- Note: the headless screenshot script could not drive the map's scroller programmatically (`scrollTop` and the wheel both stayed near 0, as QA also saw), so the coming-soon regions are documented through the zone-complete shot rather than a dedicated scroll shot.

VERDICT: PASS
