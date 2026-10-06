# S05 design pass, round 1 (Sessions, Night River)

Designer agent on `step/S05`. Scope: QA round 1's presentation notes (m1, m3, m4, m5, the breathing-cue pill after the fix round, the long-trance intro frame). Presentation and interaction only: no change to `clock.ts`, `listening.ts`, `completion.ts`, `resume.ts`, `useListening.ts`, `useTrackPlayer.ts` or any service; no new copy (the only text on screen is existing copy keys).

Build: `expo export --platform web` with `EXPO_PUBLIC_DEV_MODE=1` on 4761, API on 4760 with its own SQLite file, both stopped by PID afterwards. Playwright Chromium at 390x844, 360x640 and 390x844 with reduced motion; fresh accounts seeded through the API like `e2e/session.spec.ts` does (mood consent on; `intro-1` done for the audio flow, `intro-1` to `intro-8` done for the long trance `intro-9`), and the dev fast-forward hook for the end of the track. Screenshots: `docs/build/screenshots/design/step-05/`.

## What was polished

**m3. The reward is now the loudest moment** (`src/features/session/SessionDay.tsx`, `src/illustration/scene/WaterSplash.tsx` (new), `src/illustration/scene/Lagoon.tsx`, `src/features/layout/LagoonSheetScreen.tsx`, `src/app/session/[stopId].tsx`). The moment now has beats: the croc hops out of the water (48 pt up, back down with a small overshoot, on the UI thread via the scene's `crocOffsetY`), lands with a new `WaterSplash` (fourteen shallows/white droplets flying out and falling back, a bright ring spreading on the surface) while the celebration burst fires at 1.5x its everyday reach; only then do the points pour in: a 44 pt amber number on a bordered amber-glow chip flanked by sparkles, counting up over 1.5 s and popping (1.16x then a spring) when it settles; the first-time bonus arrives as an amber pill and the "Back to the river" button rises in with it. The haptic and the hatch sound are unchanged. With reduced motion there is no hop, the splash is the static ring, the number is shown at once and nothing pops. `after-reward-hop-390x844.png`, `after-reward-splash-390x844.png`, `after-reward-settled-390x844.png`, `after-reward-360x640.png`, `after-reward-reduced-motion-390x844.png`. The session itself is untouched: no counters or pop-ups while it plays.

**m1. A tap on a dimmed control only wakes the screen** (`src/features/session/NightRiver.tsx`, `AudioPlayer.tsx`, `VideoLesson.tsx`, `VisualExercise.tsx`). `useAutoDim` now has `guard()` and `wake(action)`: a press on a control reveals the controls, and acts only if they were already visible. A press inside 400 ms of the reveal still counts as the waking touch (on web, the mouse-down focuses the button and `onFocus` reveals before the click lands; on a phone, the same protects a sleepy double-tap). Keyboard focus on any control reveals too (`onFocus`). Applied to play/pause, back 15 s, sound, captions and the close button in all three players. Verified: at 12% opacity a click on the play button leaves the track playing (`aria-label` stays "Pause"). `after-player-dimmed-390x844.png`, `after-tap-on-dimmed-reveals-390x844.png`.

**m5. The sound choice no longer covers the breathing cue** (`AudioPlayer.tsx`). Opening the sound takes the controls' row (same height) instead of growing the dock upwards; picking a sound, or a touch on the water, puts the controls back. `after-sound-choice-390x844.png`, `after-sound-choice-360x640.png`.

**m4. No more double croc in the dive** (`[stopId].tsx`, `LagoonSheetScreen.tsx`). While the day fades into the river the day scene hides its croc (`showCroc`), so the only croc is the one floating eyes-closed in Night River and then diving. The mood sheet also stays on screen during the fade with consent on (it used to swap back to the intro sheet with a spinner mid-fade). `after-dive-mid-390x844.png`.

**Long-trance intro frame** (`[stopId].tsx`, `LagoonSheetScreen.tsx`). A long trance begins at dusk: its intro and mood check are drawn on the Night River (moon, fireflies, night sheet, sleepy croc, the driving note), while the dive, the rise and the reward keep their day-to-night-to-day arc. `LagoonSheetScreen` takes an `atmosphere` and wraps itself in the provider, so the sheet's own colours follow (the first attempt left a white sheet under night text). `after-long-trance-intro-390x844.png`.

**The breathing-cue pill** (`BreathingVisual.tsx`). The fix round's pill is right; it gets a hairline shallows border (35%) and a touch more padding so it reads as a made object on the ring glow rather than a dark box. Contrast unchanged (mist text on 86% night river). `after-player-390x844.png`.

Also: `useCountUp` takes a start delay, `Lagoon` and `LagoonSheetScreen` take `celebrationScale`, `splash`, `showCroc` and `crocOffsetY` (pass-through to what `Lagoon` already supported), and `WaterSplash` is exported from `@/illustration`.

## Checks

- `npm run check`: pass (typecheck, lint with zero warnings, 46 suites / 322 tests). One earlier jest run had a single timing failure while a web export was running on the same CPU; two clean runs since.
- `E2E_PORT=4762 E2E_API_PORT=4763 npm run e2e -- e2e/session.spec.ts`: 9 passed (phone-390, phone-360, tablet-820).
- No console or page errors in any screenshot run.

## Remaining issues

- **MINOR (engineering, QA m2): a reload on the mood-after or reward screen loses the moment.** Now that the reward is a real moment, it is worth a pending-reward flag until it has been shown. Logic in `[stopId].tsx`/`resume.ts`; out of a design pass.
- **MINOR (engineering, QA m6): placeholder track length.** Unchanged; the long-trance player shows 1:27 left for a 20 min stop until real audio lands.
- **MINOR (design, backlog): tablet reward scale.** At 820x1180 the croc stays the phone-sized peek croc with wide empty water around it (QA `v-820-5-reward.png`); the `LagoonSheetScreen` fit caps the croc at 460 pt. Scaling the lagoon scene like the map's `scale` is a layout change for a later pass.
- **MINOR (QA m8, untouched): the video lesson's control row** keeps play off-centre with the captions button beside it and no back 15 s.
- **Not tested:** native (Reanimated `withSequence` hop and the splash on device, the atmosphere switch on a native stack), Safari and Firefox, a real screen reader (the splash and the hop are decorative; the points chip keeps its `a11y.points` label).

VERDICT: PASS
