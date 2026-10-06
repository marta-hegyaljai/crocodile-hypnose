# Step 6: Mini-games

## Scope
Three games, each 1–3 minutes, never losable, no rushing timers, each teaching one real skill and ending by inviting the user to repeat it with eyes closed (placeholder copy). Reachable from map stops of type `game` and from the Games tab (which becomes a real screen: a jungle "games clearing" listing the games with the croc, best results, and times played).

1. **Stillness** (Daylight → dusk): hold still; the croc sinks lower in the water the stiller you are. Uses the device motion sensor (expo-sensors) on native; on web uses DeviceMotion if permitted, otherwise a "keep your finger resting on the lily pad" touch fallback that measures finger stillness. Stillness score 0–100 shown gently at the end only.
2. **Firefly** (Night River): follow a slow firefly with your eyes; a soft glow trail; three rounds getting slower; ends with a "close your eyes" moment. Optional stillness measure as in game 1.
3. **Breathing** (Daylight water): hold to breathe in, release to breathe out; ripples spread across the water; a guide ring paces ~6 breaths per minute; haptic tick on native at the turn; ends with a breath count and a calm croc.

Shared: a game shell (intro card with how-to, pause, quit without penalty, end screen with a small reward through the same idempotent event as sessions), pure scoring logic with unit tests, 60fps animation on the UI thread, reduced motion alternatives, sound hooks muted when the system or app sound is off.

## Acceptance criteria
- `npm run check`, server tests, e2e pass; e2e plays each game to completion with the touch fallback and a time fast-forward hook.
- Each game is understandable in 5 seconds from its intro card, feels delightful, and looks like the same jungle/river world with the croc as the main character.
- No way to lose or fail; quitting mid-game keeps the user's progress untouched.
- Works at 390x844, 360x640, 820x1180; tap targets ≥ 44px; reduced motion respected.
