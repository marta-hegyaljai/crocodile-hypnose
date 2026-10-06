# Step 5: Sessions (Night River)

## Scope
1. **Session flow** started from today's card or a map stop: optional mood check (only with consent) → transition (croc sinks, screen darkens to Night River) → the player for the stop type → surface transition back to Daylight → second mood check → reward moment → back to the map with the next stop unlocked and the croc moved.
2. **Audio trance player** (Night River): the croc's glowing amber eye as the focus point with breathing-paced ripples; title/zone placeholders; progress, elapsed/remaining time, play/pause, back 15 s, sound (background soundscape choice: placeholder river / rain / night tracks generated small), sleep-friendly auto-dim of controls after a few seconds of no touch, tap anywhere to reveal. Background play and lock-screen controls on native (expo-audio); on web keep playing when the tab is hidden. Resume position if interrupted (app killed, call, navigation away), with a "resume or restart" choice. Completion threshold (e.g. ≥ 90% listened) counts as done; scrubbing to the end does not.
3. **Video lessons:** portrait player (expo-video) inside a Night River frame, captions toggle (placeholder VTT), the same completion rules, poster image placeholder.
4. **Visual exercises:** full-screen slow visuals (fixation image, breathing shape, imagery card sequence) with a gentle timer; no flashing, no fast motion (respect WCAG 2.3.1); reduced motion gives static alternatives.
5. **Long trance** stops use the audio player with a distinct intro frame.
6. **Mood check** screen: five water states (wave visual from calm to rough) with placeholder labels "Mood 1"–"Mood 5"; before and after; the after screen shows the change with a small water animation. Stored locally and synced (`POST /me/mood`) only with consent; skippable.
7. **Reward moment:** the loudest moment in the app, always after the session: splash, points counting up (amount from a pure function; ledger comes in step 7, so emit an idempotent "session completed" event now and keep points display wired to a store), the croc celebrating, the next stop unlocking on the map with an animation when you return.
8. **Safety:** respect `cautionMode` (hide/flag non-caution-safe stops); "pause on headphones unplugged"; a quiet note on long trances not to listen while driving (placeholder copy).
9. Replace the onboarding first-session player with this one.

## Acceptance criteria
- `npm run check`, server tests, e2e pass; e2e: complete an audio stop end to end (with a test hook to fast-forward time), mood before/after, reward, next stop unlocked; interrupted session resumes.
- No points, badges or pop-ups during playback; controls auto-hide; everything readable in Night River with AA contrast.
- Completion can't be faked by scrubbing; completing the same stop twice doesn't double-grant the first-time reward.
- Smooth on low-end devices; reduced motion respected; works at 390x844, 360x640, 820x1180 and landscape.
