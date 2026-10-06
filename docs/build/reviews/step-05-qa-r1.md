# S05 QA, round 1 (Sessions, Night River)

Tested the real dev build (`EXPO_PUBLIC_DEV_MODE=1`, API on 4720, web on 4721) with Playwright and Chromium at 390x844, 360x640, 820x1180 and 844x390 landscape, plus reduced motion at 390x844. Fresh accounts were seeded through the API (consent on and off, caution mode on and off). Screenshots are in `docs/build/screenshots/qa/step-05/`.

## Acceptance criteria

| Criterion | Result |
| --- | --- |
| Complete an audio stop end to end (fast-forward hook): mood before and after, reward, next stop unlocks | PASS. intro-2 done, intro-3 "You are here", points 50 to 80, server event `firstTime: true`, both mood entries synced |
| Interrupted session resumes | PASS. Reload at 0:43 gives "Resume at 0:43" and "Restart"; restart begins at 0:00 |
| No points, badges or pop-ups during playback | PASS |
| Controls auto-hide, tap anywhere to reveal | PASS (dim to 0.12 after 5 s, restored on touch). See m1 |
| AA contrast in Night River | FAIL for the breathing cue text (M1) |
| Scrubbing cannot fake completion | PASS. The progress bar is a non-interactive `progressbar`; a click on the far end of it did nothing. Ending at 62 s of 90 s gives no done state and no event |
| Same stop twice does not double the first-time reward | PASS. The replay gives +10 and no bonus line; the server holds one `firstTime: true` event and one `firstTime: false` |
| Works at 390x844, 360x640, 820x1180, landscape; reduced motion | PASS. No horizontal scroll, all controls at least 44px, the reward button fits on screen at every size |

Other flows that passed: mood before and after with consent, and both skipped without consent (no mood step appears at all); "Skip" on mood; the sound choice sheet (Off, River, Rain, Night); back 15 s (0:49 to 0:35); the end-early dialog (keep going, end, and ending early does not finish the stop); video lesson with the captions toggle (caption hidden when off); visual exercise (fixation, breathing, imagery in turn); long trance intro with the driving note; caution mode (stops show "Not suggested for you", the sheet has no Start, a deep link to `/session/intro-6` shows the caution note and no Start); a double-click on Start and on mood Skip did not double-start; the app console had no errors on any online run.

## Findings

### MAJOR

**M1. The breathing cue ("Breathe in" / "Breathe out") fails AA contrast.**
Steps: start any audio or visual stop, look at the cue under the ring.
Expected: 4.5:1 or better (acceptance: AA in Night River).
Actual: text colour `rgb(157,183,177)` at 18px on the water and the ring glow measures about 4.2:1 for most of the breath and 2.6 to 2.7:1 at the start and end of each cycle, when the glow sits behind the text. Time labels and the title are fine (on the dark dock/sky). Screenshot: `05-player.png`, `v-360-3b-sound.png`.
Suggested fix: lighten the cue text (or put it on a dark pill) and keep the ring glow off it.

### MINOR

- **m1. A tap on a dimmed control acts blindly.** While the dock is at 12% opacity, tapping where the play button is pauses the track. A sleepy user trying to wake the screen stops their trance. Make the first touch after dimming only reveal. (Keyboard focus on a dimmed control should reveal too.)
- **m2. Reload on the mood-after or reward screen loses the moment.** After the last second plays, the stop is already done, points are already added (80) and the event is sent. A reload then lands on the stop intro with "Play again": no after mood and no reward splash. Points are correct, so no data is lost. The reward is meant to be the loudest moment and can be skipped by a reload; consider storing a pending reward until it is shown. (The "mood after picked but not confirmed is lost on reload" item is already in the backlog.)
- **m3. The reward is nice but not the "loudest" moment yet.** It is the sunny scene, a calm croc with a few sparkles and petals, and a count-up chip. No flourish on the number, no real celebration pose; on 820x1180 the croc is a small element with a lot of empty water. With reduced motion it is a static version of the same, which is right. Designer pass: stronger splash, bolder count-up and a clearer celebrating pose. `12-reward-2.png`, `v-820-5-reward.png`.
- **m4. The dive crossfade shows two crocs.** About 300 ms after "Continue" on the mood screen, the Daylight croc and the Night River croc are drawn together (ghost double croc), and the intro sheet is back with a spinner on Start. Brief, but it breaks the "sinks into the river" illusion. `05a-dive-mid.png`.
- **m5. The sound sheet covers the breathing cue.** Opening the sound row grows the dock upwards over the "Breathe in/out" text (visible on 360x640 and 390x844). `06-sound-sheet.png`, `v-360-3b-sound.png`.
- **m6. Placeholder track length does not match the stop.** The audio is a 90 s clip, so a "3 min" stop shows 1:30 and a "20 min" long trance shows "1:25 left". The long trance player and intro are otherwise the same as a normal audio stop (only a driving note and a sleepy croc), so the "distinct intro frame" is thin. Expected with placeholders; check again with real audio.
- **m7. Going offline mid-session throws an uncaught page error** ("Failed to load because no supported source was found") when the track source cannot load. The flow still completes and syncs when back online. Same family as the S03 backlog item on audio failures.
- **m8. Video lesson has no back 15 s** and the play button sits off-centre (the captions button is beside it). Fine for the brief (it only asks for captions); noted for the designer.
- **m9. Copy is placeholder only** (Mood question, Reward title, session intro text). Expected per LOOP rule 11.

## BLOCKED (native only, not tested)

- Background audio when the screen locks or the app is backgrounded, and lock-screen controls (expo-audio on iOS/Android).
- Pause on headphones unplugged.
- Audio actually heard (headless Chromium has no output; the dev build runs the clock and the elements, not the sound), including the three soundscape tracks' quality and loudness.
- Real video playback on the native player (the web video lesson shows the placeholder glow).
- Smoothness on low-end devices (only a fast desktop CPU here).
- "Keeps playing when the tab is hidden" was not exercised in headless mode.

## Verdict

One MAJOR (cue contrast); everything else works and the flows are solid.

VERDICT: CHANGES REQUIRED
