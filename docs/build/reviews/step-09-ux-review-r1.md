# Step 9a-ux review, round 1

Scope: `git diff 94cd707..fe0c2ae` (items 1, 3, 4). `npm run check`: green (typecheck, lint, 60 suites / 413 tests).

## MAJOR

### 1. The hatch test is still load-sensitive (item 1 is not met)
`src/features/onboarding/screens.test.tsx:323-360`. The tap guard is now driven by a fake `Date.now`, so
the bounce/gap flake is gone. But the test still waits in real time for the hatch animation
(`waitFor(..., { timeout: HATCH_DURATION_MS + 1500 })`, i.e. a real 1.9 s timer) inside jest's default
5 s test timeout. Unloaded it takes about 3.8 s in total. With 6 parallel runs of this test plus 2 CPU burners
on 4 cores, 5 of 6 runs failed with "Exceeded timeout of 5000 ms for a test". With
`--testTimeout=30000` all 6 passed under the same load. So the remaining flake source is the 5 s timeout
against a real timer; the acceptance line "no flakes" is not guaranteed.
Fix: give the test an explicit timeout (`it('...', async () => {...}, 20_000)`), or better use
`jest.useFakeTimers()` for the hatch and advance `HATCH_DURATION_MS` (the screen's `later(...)` timers),
keeping the `Date.now` clock mock. (The test's `TAP_GAP_MS = 220` also does not match the screen's 120; harmless.)

## MINOR

### 2. A pending reward outlives leaving by "back" and then hides the stop's intro
`src/app/session/[stopId].tsx` (restore effect ~132-153, `leave` ~283). The record is cleared only by Continue
(`leave`) or by starting a run. Leaving the reward/mood-after screen by browser back or the Android back button
keeps it for 15 min; opening the same stop again (Replay, tapping the node) then shows the old mood-after/reward
screen, with Continue as the only action, instead of the intro. Not a leak or a double grant (points are
display only, the key is per user, the stop id is checked, events are not re-emitted), but it blocks a
replay for up to 15 min. Fix: clear the record when the screen unmounts from the reward/mood-after phase
after the moment has been shown once (cleanup effect), or restore only once per mount source (reload), e.g.
also drop it when the restore has been displayed and the screen is left.

### 3. The pending reward is not purged on account deletion / local sign-out
`src/features/session/pendingReward.ts`. Same as the existing resume point: keys
`mhp.hypnose.pendingReward.v1.<userId>` stay after DELETE /me and a local wipe. Content is a stop id, point
counts and an event id (no mood data, no tokens), so low impact, but "delete account" should leave nothing.
Fix: remove the key where the profile document is removed (`documentStore.ts` ~369) or by prefix at delete.

### 4. Stillness (touch): one touch makes the round count
`src/features/games/stillness/StillnessGame.tsx` `onTick`. After the finger first rests (`rested = true`) a
sample is added every 100 ms of game time, also while the finger is lifted (as full motion). One touch followed
by walking away therefore produces about 880 samples, passes `MIN_STILLNESS_SAMPLES` (20 = 2 s) and earns
the points and the stop. Only a never-touched round is rejected. Sensor mode (phone lying on a table) counts
too, which is arguably correct for a stillness game. Fix if the intent is "real play": count the resting
samples separately (`restedSamples++` only while `touching`) and use that for `samples` in touch mode.
Short real plays are not wrongly rejected: 2 breaths (of about 8 possible) and 2 s of resting are low bars.

### 5. Breathing SR toggle: the "swallow the click" flag can stick
`src/features/games/breathing/BreathingGame.tsx` ~49, 210-225. `pressed.current` is set on pressIn and cleared
only by the following `onPress`. When a press ends without a click (mouse down on the water, drag off, release
outside; a native gesture cancel), the flag stays true and the next real activation by a screen reader is
swallowed (first double-tap does nothing, the second works). It cannot leave the breath "stuck in": the
`!running` effect and the game end release, Space/Enter go press, release, then onPress (consumed) in
react-native-web, and an SR click toggles by itself. Fix: in `onPressOut`, clear the flag after a short
timeout (about 300 ms) so a click that follows still sees it. Also note, unverifiable here (native is
BLOCKED): VoiceOver on iOS may deliver pressIn/pressOut/press for an activation, in which case the toggle is
consumed as a zero-length press and no breath is counted; check on a device.

## Verified (no finding)
- pendingReward: per-user key; `get` checks user (key), stop id, phase, shape, max age (15 min) and a
  future-dated `savedAt`; restoring only sets state (no event, no points, no progress write), so no double
  grant; moodAfter is stored without any mood value; consent is re-read on restore.
- Game quit: `onStarted` / `markStarted` have no other user for games (session screen still marks started
  for audio stops). Unengaged round: no record, no event, no stop completion; play-again works.
- InactiveGuard: `visibility: hidden` keeps layout and scroll and does not remount (children identity
  unchanged); removes content from focus and the a11y tree; the tabs have no transition on web, so no
  visible pop.
- useDialog / RadioGroup: handlers are React `onKeyDown` on the dialog/group root (no document listeners,
  nothing to clean up globally); Escape only fires with focus inside; focus restore only when focus is
  stranded; native returns empty props. Radio arrow keys ignore keys from inputs inside a group.
- Weekly toast: marked celebrated once on appearance, auto-closes after 8 s, timer cleaned up.
