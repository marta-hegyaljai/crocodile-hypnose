# Step 1 code review, round 2 (re-verification)

Reviewer: code-reviewer. Fix commits: ebe6062, 5b82a64. Diff read: `git diff a82c2ef..HEAD` (excluding docs/).

What I ran:
- `npm run check`: green (98 tests).
- Web exports into a scratch directory, both with and without `--clear`. The cache finding below comes from this.
- The Playwright suite against a fresh dev-mode export served on port 4373: 24/24 pass (phone-390, phone-360, tablet-820).
- A keyboard and pointer probe of the tab bar in Chromium.
- No console errors or warnings.

## Round 1 findings

### R1-1 (MAJOR) TabBar focus and press: FIXED
- Each tab is now its own `Tab` component that uses `useFocusRing`, `FocusRing` and `usePressDepth`.
- Probe results:
  - Tabbing with the real Tab key shows the 3px ring on all four tabs.
  - A pointer click leaves no ring behind.
  - The pebble scales to 0.9 on press-in and springs back.
  - Space and Enter both select a tab.
- The e2e test now covers ring, Space and Enter on tabs.

### R1-2 (MINOR) Committed `.env` turned dev mode on everywhere: fixed in the source, but the new scripts don't produce the right build. See NEW-1.
- `.env` is removed and now ignored.
- The `env.ts` default is `__DEV__`.
- `build:web` sets `EXPO_PUBLIC_DEV_MODE=1`, and `build:web:release` leaves it unset.

### R1-3 (MINOR) e2e tested a stale or foreign server: FIXED
- `npm run e2e` now runs `build:web` first.
- It serves on its own port (`E2E_PORT`, default 4273) with `reuseExistingServer: false`.
- The cache problem in NEW-1 can still make the fresh build come out in the wrong mode.

Also fixed from round 1 (not re-raised):
- #5: `useReducedMotion` now uses one shared `useSyncExternalStore` subscription, seeded synchronously from `matchMedia` on web.
- #6: handlers are composed in Button and IconButton.
- #8: a `no-restricted-syntax` guard now catches string literals in `label`, `title`, `accessibilityLabel` and `accessibilityHint` props.
- #9: dev packages moved to `devDependencies`.

## New finding

### NEW-1. The dev-mode flag is cached by Metro, so `build:web` and `build:web:release` can produce the wrong mode
- **Severity:** MAJOR
- **Where:** `package.json` scripts `build:web` and `build:web:release` (lines 11 and 19), `src/config/env.ts:7-9`
- **Problem:** `EXPO_PUBLIC_DEV_MODE` is inlined at transform time, and Metro's transform cache key does not include it. Whichever value was used for the last cached transform of `src/config/env.ts` wins, until the cache is cleared. I reproduced both directions:
  1. **Release ships dev mode.** After a `build:web`, `expo export` without the flag (= `build:web:release`) produced a bundle byte-identical to the dev build (same entry hash) with `const t=!0` for `devMode`. The "release" build therefore ships `/dev/gallery`, the gallery link on the index screen and the dashed placeholder marks. This fails open: exactly what round 1 asked to prevent. The script exists for that purpose, and `check → e2e → build:web:release` is the natural order to run them in.
  2. **e2e and QA lose the gallery.** After a release build with `--clear` (`devMode=!1`), `cross-env EXPO_PUBLIC_DEV_MODE=1 expo export` without `--clear` still produced `devMode=!1`. `npm run e2e` would then fail on `/dev/gallery` (it redirects home), and QA would see no gallery, with nothing pointing at the cause.

  Adding `--clear` gave the correct value both times.
- **Fix:**
  - Add `--clear` to both export scripts: `cross-env EXPO_PUBLIC_DEV_MODE=1 expo export --platform web --output-dir dist --clear` and `expo export --platform web --output-dir dist --clear`. A cold export took about 16 s here.
  - Optionally add a guard step to `build:web:release`, for example a tiny node script that fails if the emitted bundle contains the gallery route's `testID:"gallery-screen"`, or that checks `devMode` is false. That way a release export can never silently carry dev mode.

## Regression read of the rest of the diff
Nothing else at BLOCKER or MAJOR level. Notes:
- **Button layout:** `root` no longer sets `alignSelf: 'flex-start'`, so a button without `fullWidth` inside a default column parent (`alignItems: 'stretch'`) now stretches to full width. This is a deliberate API choice: it is documented and covered by the "hug-width follows parent alignment" e2e test. Callers who want a hug-width button need a parent with `alignItems` set.
- **Button disabled state:** it now uses the sunken surface and muted text instead of 50% opacity.
- **Contrast tokens:** the new `textAccent` and `textWater` are covered by the contrast test.
- **Removed `+html.tsx`:** replaced by a small DOM shim in `_layout.tsx`. With `"web.output": "single"`, `+html` isn't used anyway, so the shim is the working equivalent. It only runs on web and is idempotent.
- **Decorative illustration:** water, reeds, fireflies and the lagoon backdrop are now hidden from assistive tech (`decorative` props), and `a11y.water` was removed from the copy. The croc keeps its label. This is correct.
- **Reduced-motion store:** it subscribes once and never unsubscribes, which is fine for a module-lifetime store. `__resetReducedMotionStoreForTests` clears `listeners` but does not remove the old AccessibilityInfo listener; that is test-only and harmless.
- **e2e and the shared `dist/`:** `npm run e2e` rebuilds into the shared `dist/`. If QA is serving `dist/` on 4173 at the same moment, the build is swapped under them. This is a process note only; the orchestrator already runs agents on separate ports. A separate `--output-dir` for e2e would remove it entirely.

---

VERDICT: CHANGES REQUIRED
