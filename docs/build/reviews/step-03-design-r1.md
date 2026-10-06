# Step 3 design pass, round 1

Designer agent. Scope: the two must-fixes from QA round 1 (M8 hatch climax, M9 Night River player and sink transition), plus the egg focus ring in passing. Presentation only: no onboarding logic, services or data flow changed; no shared component API changed (`Lagoon`, `Croc`, `BreathingVisual`, `OnboardingScaffold` untouched).

Build: `expo export --platform web` with `EXPO_PUBLIC_DEV_MODE=1`, served with `serve --single` on 4531, API on 4530 with its own SQLite file. Playwright Chromium at 390x844, 360x640 and 820x1180. Before-shots were taken from the same build method on the current branch head, so the comparison is like for like.

Screenshots: `docs/build/screenshots/design/step-03/`.

## 1. M8: the hatch is now the hero moment

Files: `src/app/onboarding/hatch.tsx`, `src/features/onboarding/HatchingEgg.tsx`.

- **Composition.** The nest sits just under the centre of the frame (ground at 64% of the height, was 76%), and the title and tap hint are centred in the sky between the top row and the horizon instead of pinned under the back button. Before the tap: title, horizon, egg, nest, one composed column (`hatch-egg-390x844.png`, `hatch-egg-820x1180.png`). The hero canvas is the full width (480 cap), so the egg itself reads at about 125 pt on a phone (was about 90).
- **The hatchling is big.** The croc's canvas is mostly air, so it is now drawn at 1.4x the nest width (680 cap): the croc body reads at about 240 pt at 390 wide and about 300 pt on the tablet, filling the bank between the reeds (`hatch-burst-850-390x844.png`, `hatch-burst-850-820x1180.png`). It keeps the pop spring (0.35 to 1 scale) so the size change is the climax, not a cut.
- **Light.** A warm radial glow swells behind the hatchling as the shell bursts (opacity 1 at the peak, settling to about half) and stays as a soft halo behind the croc, including on a revisit. Reduced motion: the glow is simply there.
- **Burst.** The celebration radius grew from 42% to 60% of the hero width (320 cap), so petals and sparkles fill the water and the sky above the nest rather than a small ring around the egg.
- **Name sheet.** The scene still slides up as the sheet rises, and the larger hatchling now sits above the sheet at all three sizes with its eye and smile in view (`hatch-name-390x844.png`, `hatch-name-360x640.png`, `hatch-name-820x1180.png`).
- **Egg focus ring (in passing).** The teal ring was invisible against the water; it now has a 2 pt light outline outside and 1 pt inside, so it reads over water, bank and sky.

## 2. M9: Night River player and the dive, as one scene

File: `src/app/onboarding/first-session.tsx`.

**The dive.** The sink no longer happens in the 170 pt band while the sheet greys out. The Night River scene is mounted underneath the whole day screen the moment Start is tapped, with the hatchling floating in the middle of the river, eyes closed, at hero size (72% of the width, 380 cap). The day screen fades out over 750 ms to reveal it (`sink-700-390x844.png`), then the croc dives under the water over 1.5 s with an ease-in (`sink-1200-390x844.png`), and the breathing ring, its cue, the dock and the exit fade in where it went under (700 ms). Total 2.05 s (was 1.9 s). Reduced motion: a 320 ms fade to the night scene with the croc already under, then a 320 ms fade of the controls.

**Surfacing** is the mirror: controls fade out (300 ms), the croc rises (1.3 s, ease-out), and the day screen fades back in over the last 900 ms (`surface-1500-390x844.png`). The "Session complete" or "Session ended" screen is the one that fades in, with its back button disabled until the rise ends.

**The player.**
- The breathing ring is on the water, just under the surface where the croc went under, with the croc's eyes at its centre: two eye bumps in night skin tone with the amber gradient eyes, slit pupils and highlights from the croc drawing itself. The eyes appear as the croc passes under and breathe with the ring (opacity 0.72 to 1), instead of two faint amber dashes. The moon is now alone in the sky with the fireflies; nothing overlaps it (`night-player-390x844.png`, `night-player-820x1180.png`).
- The controls sit in a dock: a Night River card at 78% opacity with a hairline in the shallows tint, holding the progress bar, the time left, the play/pause button and the dev skip. Nothing from the scene sits on the progress bar any more. (The screenshots were taken at 62%; the flower lily pad showed through the dock at 360x640 as a smudge, so the opacity went up after the shots. Type, lint and format checks pass on the final file; the e2e run below was exported just before this one-line colour change, which cannot affect behaviour.)
- Short screens (360x640): more water (water from 36% of the height) and a smaller ring (22% of the height), so ring, cue and dock stack without touching (`night-player-360x640.png`).
- Landscape: the croc, ring and eyes at 30% of the width, the dock bottom-right (320 wide).
- Implementation note for step 5: `NightPlayer` takes the `sink` and `ui` shared values and the croc name; the day screen is an `Animated.View` over it (`first-session-veil` test ID), so the full player can replace `NightPlayer` and keep the same transition.

## 3. Checks

- `npm run check`: pass (typecheck, lint with zero warnings, 2 unit suites touched: `screens.test.tsx`, which needed one extra `waitFor` because the complete screen now fades in while the croc is still surfacing and its Back is disabled until then).
- `E2E_PORT=4532 E2E_API_PORT=4533 npm run e2e -- e2e/onboarding.spec.ts`: 33 passed across phone-390, phone-360 and tablet-820 (3.8 min). (A first attempt with `npx playwright test` alone served the stale `dist-e2e` bundle from an earlier run, pointed at another API port, and failed every test at page load; the project runner re-exports `dist-e2e`, which is what the number above comes from.)
- No page errors in the screenshot runs at any of the three sizes.
- Test IDs kept: `first-session-player` now names the player only once it is interactive; during the dive and the rise the night scene carries `first-session-night`, so tests that wait for the player get it ready for input.

## 4. Remaining issues

- **MINOR (backlog, as agreed): empty sheet space on short steps.** Not touched: Consent, Session complete, Reminder and Done still have large blank sheets at 390 and about 60% blank on the tablet. Suggestion for the step 4/5 pass: let the band grow to fill the slack above a short sheet, or move the croc's reaction into it.
- **MINOR: the hatch screen's bank below the nest.** With the nest at 64% of the height, the plain bank fills the lower third before the name sheet covers it. It reads as foreground and the sheet rises over it two seconds later; a few bank details (a fallen leaf, pebbles) would make it richer. Backlog.
- **MINOR: the hatch glow is subtle on the pale daylight sky** (amber-light on mist green). It is visible behind the croc, more so on the dark bank reeds. If the engineering pass wants a stronger climax, a brief, wider white flash at the burst (120 ms) would do it without changing the palette.
- **Not tested:** native (haptics, the Reanimated `withDelay` chains on device, the status bar over the night scene during the fade), Safari and Firefox, real screen readers (the day layer during the fade is `pointerEvents="none"`, and the night scene's controls are `pointerEvents="none"` while disabled; the accessibility tree keeps both while the fade runs).

Note: two "S03: design pass (WIP)" commits on the branch were made by the session harness during this pass, not by a `git commit` of mine.

VERDICT: PASS
