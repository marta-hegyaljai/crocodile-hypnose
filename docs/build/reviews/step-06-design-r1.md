# Step 6 design pass, round 1 (mini-games)

Designer agent on `step/S06`. Scope: QA round 1's visual MINORs (m2, m3, m4, m8, m9, m12) plus the intro/end cards and the games clearing. Presentation only: `useGameClock.ts`, `scoring.ts`, the Stillness logic, records and the reward path are untouched. No new copy except one neutral pluralised key (`games.result.breathingOne`: "1 breath").

Build: `expo export --platform web` with `EXPO_PUBLIC_DEV_MODE=1` on 4751, API on 4750 with its own SQLite file. Playwright Chromium at 390x844, 360x640 and 820x1180, fresh accounts onboarded through the API, `__mhpTimeScale` 40 (6 for the Stillness shots). Screenshots: `docs/build/screenshots/design/step-06/`. No console or page errors in any run. Servers stopped by PID.

## What was polished

**Game shell: intro and end cards** (`src/features/games/GameShell.tsx`, new `src/features/games/gameArt.ts`). The intro card opens with the game's tinted glyph badge (the same drop / sparkle / leaf the clearing cards wear, shared through `gameArt.ts`) beside the title, so the card reads as "this game" in a glance. The end card has a check badge in the game's tint, with the "finished" label stacked over the result. On short phones (< 700 pt) both cards tighten (smaller padding and gaps, heading-size title) and the end card's actions sit in one row ("Play again" ghost left, "Done" right), so the card is about 110 pt shorter and the calm croc is in view behind it (QA m3). `after-breathing-intro-390.png`, `after-breathing-end-360.png`, `after-firefly-end-360.png`, `after-stillness-end-360.png`.

**Stillness** (`stillness/StillnessGame.tsx`, presentation only). The cue is hidden once the end card is up (m2). The lily pad is alive: a warm amber glow under it breathes slowly as an invitation until a finger rests, then brightens into a steady glow inside a thin white ring while the pad presses down 5% (m9). All on the UI thread (Reanimated shared values); with reduced motion the pulse is off and the pressed state switches instantly. When the game ends, the Lagoon's existing `CelebrationBurst` (petals, sparkles, bubbles) fires from the croc. `after-stillness-idle-390.png`, `after-stillness-pressed-390.png`, `after-stillness-end-360.png`.

**Breathing** (`breathing/BreathingGame.tsx`). The count chip is a neutral chip with a leaf (was the amber points chip, m8) and uses the pluralised result label ("1 breath", m4), which also fixes the end card and the clearing's "Best". Cue and chip are hidden while the end card is up (they were stale, as in Stillness). The guide ring and your breath are now clearly two things: the guide is a thin white outline with almost no fill, your breath a solid amber disc with a lighter glowing core and a soft white rim (was a translucent amber that read olive over the water). Celebration burst at the end. `after-breathing-inhale-390.png`, `after-breathing-end-360.png`.

**Firefly** (`firefly/FireflyGame.tsx`). On short phones the water line is at 50% (was 60%) so the croc with its eyes closed sits above the end card (m3). `after-firefly-end-360.png`, `after-firefly-play-390.png`.

**Games clearing** (`GamesClearing.tsx`). The croc is bigger (72% of the width, up to 320 on phones), and on tablets (≥ 700 pt wide) the scene grows to 460 pt with a 520-wide croc, taller reeds and a bigger lily pad, and the three cards sit side by side instead of a 526-pt column over an empty lower half (m12). `after-clearing-390.png`, `after-clearing-played-390.png`, `after-clearing-820.png`.

## Checks

- `npm run check`: pass (typecheck, lint with zero warnings, 40 suites / 317 tests).
- `E2E_PORT=4752 E2E_API_PORT=4753 npm run e2e -- e2e/games.spec.ts`: 9 passed (phone-390, phone-360, tablet-820).

## Remaining issues

- **MINOR (engineering/copy, QA m5, m6): 0-breath and too-short-hold cases** have no gentle line; needs copy keys from MHP and a minimum-engagement rule. Not a design change.
- **MINOR (engineering, QA m7): Escape does not pause and focus is not moved to "Keep going"** when the pause card opens. Keyboard handling, not presentation.
- **MINOR (engineering, QA m1, m10, m11):** Started-on-quit for map games, the "3 min" vs "2 min" duration mismatch (data in `catalog.ts` vs the stop), and the absent Firefly stillness measure. Logic/content, recorded for the backlog.
- **MINOR (design, backlog): the tablet clearing still has empty ground below the card row.** It is now a scene plus one row of cards; a taller scene with a wider pond on tablets would fill it. Cosmetic.
- **MINOR (design, backlog): the celebration burst on the Stillness end** fires over the dusk overlay and is a little dim; a lighter burst tint for dusk would help. Cosmetic.
- **Not tested:** native (haptic tick, device-motion path, Reanimated on device), Safari and Firefox, a real screen reader (the pad's label and the stage label are unchanged).

VERDICT: PASS
