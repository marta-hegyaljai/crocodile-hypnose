# Step 6 review, round 1

Checks: `npm run check` once failed one test, `onboarding/screens.test.tsx` "hatches on the third tap" (timing assertion on the tap gap, untouched by S06). The same file passes alone (20/20), so it is a load flake, but it can redden the gate. Everything else passed (311 of 312).

## BLOCKER

### B1. The game clock callback is not a worklet, so no game can run on iOS or Android
`src/features/games/useGameClock.ts:30-40`. `onFrame` is built in a `useState` initializer and passed by identifier to `useFrameCallback(onFrame, false)`. The Reanimated/worklets Babel plugin only workletizes inline callbacks and functions carrying a `'worklet'` directive. I ran the worklets plugin over this file: only the two `useAnimatedReaction` callbacks get a `__workletHash`; `onFrame` does not. `useFrameCallback` hands the function to `scheduleOnUI` (`FrameCallbackRegistryJS`), so on native the UI runtime gets a plain JS function and throws when it calls it ("non-worklet function on the UI thread"), or it never advances `timeMs`. On web everything runs on one thread, so the e2e and jest runs cannot see it. Impact: on devices `timeMs` stays 0, the game never ends, Firefly never moves and Stillness never finishes. Because every game is built on this hook, a stop of type `game` can never be completed on a phone.
Fix: add `'worklet';` as the first statement of `onFrame`. It captures only the `timeMs` shared value and the `scale` number, which is fine. Add a small Babel-transform test or an on-device check that `timeMs` advances.

## MAJOR

### M1. Pausing during the sensor probe leaves Stillness stuck in "probing" forever
`src/features/games/stillness/StillnessGame.tsx:63-83`. The probe effect depends on `[running]`. Its cleanup sets `alive = false`. On resume the effect returns early because `motion.current` is already set, and nothing ever handles `src.available` again. Result: `source` stays `'probing'`, `onTick` returns early on every call (line 101) and the game never ends, with a blank cue. It triggers when the user pauses or backgrounds within about 1.2 s of starting on web, or while the iOS motion-permission prompt is up (AppState goes `inactive`, so the shell pauses). The only way out is to quit, so the stop is not completed.
Fix: keep one `alive` flag for the component's life (set false only in the unmount cleanup), or resolve `src.available` regardless of `running` and make the probing gate independent of pause. Add a test: start, pause, resume, then check that the source resolves and the game can finish.

## MINOR

### m1. Stillness sensor and finger state are not tied to pause or end
`StillnessGame.tsx:63-86, 150-158`.
- The DeviceMotion subscription stays on while paused and after the game ends, until unmount. It wastes battery and keeps the iOS motion indicator on.
- `moved.current` keeps accumulating while paused. The first tick after resume then consumes the whole pause's movement as one sample.
- The pad unmounts on pause. If `onPressOut` does not fire, `touching.current` stays true and the resumed game scores perfect stillness with no finger on the pad.
Fix: on `!running`, reset `moved`, `touching` and `lastPoint`. Stop the sensor when `ended` or when `onFinish` fires. Optionally pause delivery instead of tearing it down.

### m2. Native motion has no silence fallback
`motionSource.native.ts:14-26`. Web resolves `available` only after a 1.2 s check that an event actually arrived. Native returns true as soon as `isAvailableAsync` and the permission succeed. On emulators and some Android devices that report the sensor but never fire it, the game runs as "sensor" with `moved = 0` and scores 100 without any touch fallback. Fix: apply the same "heard within about 1.2 s, else fall back to touch" rule on native.

### m3. The stop route trusts `stopId` for any stop and any game
`src/app/game/[gameId].tsx:41-61`. `stopPlayable` only checks that the stop is available, in progress or done. It does not check that the stop is `type: 'game'` or that `gameIdOfStop(stop) === gameId`. A link such as `/game/breathing?stopId=<session stop>` completes that stop by playing a different game, and it works for any non-game stop. This only affects the user's own progress, but it should be closed. Fix: require `view.stop.type === 'game' && gameIdOfStop(view.stop) === game.id`.

### m4. The breathing guide ring steps at 10 Hz instead of 60 fps
`BreathingGame.tsx:55-59, 83`. `guide.value` is assigned from the JS tick (every 100 ms) and the ring's `useAnimatedStyle` follows it with no interpolation. The `timeMs` returned by `useGameClock` is ignored, although `guidePhase` is already a worklet. This breaks the "UI-thread 60 fps" criterion for the main pacing cue and shows as steps on large rings. Fix: `const { timeMs } = useGameClock(...)` and `useDerivedValue(() => { const g = guidePhase(timeMs.value); return g.inhale ? g.progress : 1 - g.progress; })`. Keep the JS tick only for the turn haptic and the cue text.

### m5. The breathing game cannot be operated with a screen reader
`BreathingGame.tsx:187-194`. Breathing needs press-and-hold (`onPressIn`/`onPressOut`). A VoiceOver or TalkBack double tap fires both at once, so no breath is ever counted. Nothing offers an alternative (toggle breathe in/out, or an `accessibilityActions` entry), and the game never explains this. Fix: add a toggle-style accessible action ("Breathe in" / "Breathe out") that drives the same `BreathCounter`, or at least announce the limitation. The game stays unlosable, but the skill is not delivered.

### m6. Pause does not trap focus or hide the game from the accessibility tree
`GameShell.tsx:224-258`. The pause dialog is an absolutely positioned overlay with no `accessibilityViewIsModal` and no `importantForAccessibility` on the layer below, so a screen reader can still reach the game surface and the controls behind it. Fix: set `accessibilityViewIsModal` on the dialog (and the end and intro cards) and hide the stage while an overlay is up.

### m7. `parseRecords` does not validate `best`'s fields
`records.ts:57-66`. `best` is accepted if it is an object with the right `gameId`. A damaged copy such as `{gameId:'stillness'}` yields `score` undefined, which renders "undefined/100" on the clearing (`resultLabel`) and breaks the best comparison. Fix: validate the numeric field per game, or drop `best` when invalid.

### m8. No test covers the lifecycle claims
There is no test for the AppState pause, for the games' clock or sensor cleanup, for onGameCompleted after a pause, or for the route's gating (locked stop, game/stop mismatch, markDone only on completion). `GameShell.test.tsx` only uses a stub game. Add an AppState background test in the shell and a route test with a locked stop and with a mismatched stop.

## Confirmed OK
- The dev time scale is read only when `devMode` is true; the flag is an inlined build constant and a release export leaves it off. The hook cannot leak into release.
- onGameCompleted: each game remounts per round with its own `finished` ref, and the shell guards on phase, so it runs once per played round. Quit and Back never call it. A game quit midway touches neither progress nor records. markDone is idempotent and keeps the first completion time.
- Records merge: a read-merge-write against storage on every `record()`, with `max` for plays and a better-of `best`, so two tabs do not lose plays in the normal case. Records are keyed per user and reset on a user change.
- Frame callback and reactions are cleaned up on unmount by their hooks. Breathing releases a held breath on pause. Scoring worklets (`clamp01`, `fireflyPoint`, `guidePhase`) are pure and capture only constants.
- Reward integration with S05 is deferred, as instructed. No copy outside `src/copy` found in the diff.

VERDICT: CHANGES REQUIRED
