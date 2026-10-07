# Step 9b store screenshots, round 1

Designer agent on `claude/fervent-rubin-7i8lut` (main a4c26ca). Capture and composition only: nothing under `src/` or `server/` changed. The frames come from the real web export with dev mode off (`EXPO_PUBLIC_DEV_MODE=0`: no placeholder underlines, no dev buttons), state seeded through the API the way `e2e/gamification.spec.ts` and `e2e/session.spec.ts` do.

## Files

- `assets/store/ios/01..05-*.png`: five framed shots at **1320x2868** (iPhone 6.9"), from frames shot at 440x956 @3x.
- `assets/store/android/01..05-*.png`: five framed shots at **1080x2400**, from frames shot at 360x800 @3x.
- `assets/store/<platform>/raw/`: the full-bleed frames exactly as captured (same pixel sizes), plus `05a-growth-moment.png`, an alternative for the fifth slot.
- `docs/build/screenshots/design/step-09/store-contact-sheet.png`: both sets side by side.
- `scripts/make-store-screenshots.mjs`: the generator (capture, framing, contact sheet).

Each framed shot is the frame in a thin Jungle Ink bezel on a branded gradient (River Mist to Shallows; Night River to Deep Jungle for the trance shot) with two soft leaf shapes, and a dashed `[Caption N]` placeholder set in Baloo 2 over a "placeholder: no copy yet" line in Nunito Sans. No marketing copy was written; the captions are for MHP to fill. The raw frames are kept so the set can be re-framed (or submitted unframed) without recapturing.

## What each shot shows

1. **River map, croc as hero** (`01-river-map`). Home after onboarding with Intro stop 1 done: the Daylight Riverbank map, Zé sitting on the water by the current stop under the "You are here" tag, the Today card for Intro stop 2 (audio), points and weekly-goal pills, the tab bar.
2. **Hatching** (`02-hatching`). The onboarding hatch step just after the third tap: the hatchling on the nest with the shell cap still on its head, the celebration burst (sparkles, petals, bubbles) and the "Hatched" chip, before the name sheet rises.
3. **Night River trance player** (`03-night-river`). Intro stop 2 playing: crescent moon, fireflies, the croc's eyes just above the water inside the breathing ring, "Breathe out" cue, progress bar and the pause / back 15 / sounds controls.
4. **Mini-game** (`04-mini-game`). Breathing, mid-hold: the croc on the Lagoon, "Hold: breathe in", the water target drawn in under the finger, the breaths counter.
5. **Habitat after growth** (`05-habitat`). The Croc tab after 30 calm minutes (dev hook) and the first decoration: the habitat scene with lily pads placed, Stage 3 with the calm-minutes bar, the weekly goal stepper, the decorations grid. `raw/05a-growth-moment.png` is the growth moment itself (Stage 2 to Stage 3) if MHP prefers that beat for the fifth slot.

Two copy placeholders from the app itself are visible, both tracked by the copy backlog, not by this pass: the `[Hatched]` chip in shot 2 and `[Decorations]` / `[TODAY]` headings in shots 5 and 1. Recapture once the copy lands; the script does not need to change.

## How to regenerate

```sh
# 1. API with dev hooks, on its own port and database
DEV_HOOKS=1 PORT=4960 DB_PATH=/tmp/s09-store/dev.sqlite CORS_ORIGINS=http://localhost:4961 \
  npm --prefix server run dev
# 2. Web export with dev mode OFF, served statically
npx cross-env EXPO_PUBLIC_DEV_MODE=0 EXPO_PUBLIC_API_URL=http://localhost:4960 \
  npx expo export --platform web --output-dir /tmp/s09-store/web --clear
npx serve /tmp/s09-store/web --listen 4961 --single
# 3. Capture both sets, frame them, write the contact sheet
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/make-store-screenshots.mjs
```

Options: `--only ios|android`, `--compose-only` (re-frame the existing `raw/` frames, e.g. after a background or caption change), `--web` / `--api` for other ports. Each run signs up two throwaway accounts per platform (`store-*@example.com`); the API's rate limits are generous enough for one run. Today's stop depends on the hour only when the account has a goal, so the seed uses no goal (Intro stop 2 is then always the audio stop and the croc sits near the top of the map).

## Notes

- The capture is `isMobile` Chromium, so the frames are the web build at phone size, not a device. Native status bars and the home indicator are absent; the stores accept frames without them, and the framing hides the edge anyway.
- The hatch frame is timed (900 ms after the third tap) to catch the burst before the name sheet; if the timing drifts on a slower machine, lower or raise that wait in `captureRaw`.
- Both sets use identical seeds and moments, so the Android set is the same story at a slightly wider aspect.

VERDICT: PASS
