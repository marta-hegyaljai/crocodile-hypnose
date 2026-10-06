# Step 1: Foundation and design system

## Scope
1. Scaffold the Expo app at the repo root (TypeScript strict, Expo Router, react-native-web). Scripts: `npm run web` (dev), `npm run build:web` (static export to `dist/`), `npm run serve:web` (serve `dist/` on a fixed port), `npm run typecheck`, `npm run lint`, `npm test`, `npm run check` (all three), `npm run e2e` (Playwright against the served web build, Chromium from `/opt/pw-browsers`). Update `README.md` with how to run.
2. Design tokens in `src/theme`: colours from PLAN.md, spacing scale, radii, type scale (Baloo 2 display, Nunito Sans body via `@expo-google-fonts`), shadows/3D button depth, motion durations and easings for both atmospheres. A `useAtmosphere()` / provider for Daylight Riverbank vs Night River.
3. Copy module `src/copy/en.ts` + a typed `t()` helper. Placeholders only (see PLAN.md copy rules).
4. Core components in `src/ui`: `Button` (primary amber / secondary green / ghost, pressable 3D depth that animates down on press, disabled and loading states), `Card`, `Chip` (points, goal), `ProgressBar` (scale texture optional), `Screen` scaffold (safe areas, both atmospheres), `TabBar` look, `Text` variants, `IconButton`, simple icon set (home, croc, games, profile, play, pause, lock, check, close, back) as SVG.
5. Illustration in `src/illustration`:
   - `Croc` mascot component: 5 growth stages (egg, hatchling, juvenile, adult, grand/ancient) and expressions (calm, happy, sleepy, excited, proud, eyes-closed). Cute, friendly, appealing, consistent character; amber eye with slit pupil is its signature. Supports a "peeking above water" pose and a full-body pose. Idle animation (slow blink, gentle bob) that respects reduced motion.
   - Scene pieces: water surface with animated ripples, reeds/grass, lily pads with lotus, mangrove/jungle leaves, fireflies, river path segments.
6. A dev-only gallery route (`/dev/gallery`) showing every token, component state, croc stage x expression, and scene pieces in both atmospheres. Plus a temporary index screen that shows the croc peeking from the water with the app name and a primary button (no real flow yet).
7. Jest + RNTL set up with a few meaningful tests (button press/disabled/loading behaviour, `t()` missing-key behaviour, atmosphere switching). Playwright smoke test that loads the web build and the gallery.

## Out of scope
Accounts, onboarding, real content, server.

## Acceptance criteria
- `npm run check` passes; `npm run build:web` succeeds; `npm run e2e` passes.
- The gallery renders every component state and all croc stages/expressions on web at 390x844 and 360x640 without layout breaks or console errors.
- Fonts load on web (no fallback fonts in screenshots).
- Buttons have a visible press animation and focus state; tap targets ≥ 44px.
- Reduced motion turns off idle and ripple animations.
- The croc is visibly the same character across all stages, and looks polished enough to be the face of the app.
- No user-facing string outside `src/copy`.
