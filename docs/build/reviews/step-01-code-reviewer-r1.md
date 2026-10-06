# Step 1 code review, round 1

Reviewer: code-reviewer. Diff: `git diff 7b10aeb..HEAD` (excluding docs/ and screenshots).

What I checked by running it:
- `npm run check`: typecheck, lint and 97 Jest tests all green. A run without `--silent` shows no act() or console warnings.
- `expo export --platform web` to a scratch dir: succeeds (2.1 MB bundle).
- Playwright suite against that build served on port 4273: 12/12 pass on both phone projects.
- A Playwright probe tabbed through the whole gallery with the keyboard, checked for a focus indicator on each element, and logged console errors and warnings (none).
- A Playwright probe of a Button that switches to `loading` in its own `onPress`: the face drops by 5px on press-in and returns to rest. The button does not stay stuck down.
- Measured `buildCroc`: about 89 shapes, about 0.2 ms per build in Node.

Overall the foundation is solid:
- Strict TypeScript, typed copy keys and a working `t()`.
- Reduced motion reaches every animated piece: croc bob and blink, ripples, reeds, fireflies, press depth and the progress bar.
- Pure, tested croc geometry.
- Lint guard on JSX literals, sensible e2e coverage, and no user-facing strings outside `src/copy` (outside the dev gallery).

I found one MAJOR issue.

---

## MAJOR

### 1. TabBar removes the browser focus outline and draws no focus ring of its own, so keyboard focus on the main navigation is invisible
- **Severity:** MAJOR
- **Where:** `src/ui/TabBar.tsx:61-77` (the `noNativeOutline` style on line 69, with no `useFocusRing` or `FocusRing`)
- **Problem and impact:** Every other pressable in `src/ui` (Button, IconButton, pressable Card) removes the native outline and draws its own `FocusRing`. TabBar removes the outline but draws nothing in its place. I tabbed through `/dev/gallery` in Chromium:
  - all 4 tabs (`gallery-tabbar-*`) take focus with `outline-width: 0`;
  - none of them shows a 3px ring;
  - every Button, IconButton and Card does show its ring.

  Keyboard and switch-access users on web can't tell which tab has focus. This fails WCAG 2.4.7 (Focus Visible) and the step's acceptance criterion "visible ... focus state". The tab bar becomes the app's main navigation in step 4, so this will reach every screen. The tabs also have no press feedback at all, unlike every other control.
- **Fix:**
  - In each tab, use `useFocusRing()`, pass `onFocus`/`onBlur` to the `Pressable`, and render `<FocusRing radius={radius.pill} />` inside the pebble (or around the whole tab).
  - Add a small press response with `usePressDepth` (for example scale the pebble to 0.94) so tabs behave like the other controls.
  - Add an e2e assertion next to the existing `keyboard focus shows a visible ring on buttons` test: focus `gallery-tabbar-games` and expect the ring.

---

## MINOR (for BACKLOG.md)

### 2. The committed `.env` turns dev mode on for every build, including production exports
- **Where:** `.env:4`, `src/config/env.ts:8`
- **Problem:** `EXPO_PUBLIC_DEV_MODE=1` is committed, so `expo export` and EAS builds inline dev mode = on unless someone remembers to override it. That ships `/dev/gallery`, the "Component gallery" link on the index screen and the dashed placeholder underlines. The `__DEV__` fallback in `env.ts` is correct, but the committed file defeats it, so the default is on rather than off.
- **Fix:** Remove the line from `.env` (or set it to `0`) and set the flag only where it is needed. For example: `"build:web": "EXPO_PUBLIC_DEV_MODE=1 expo export ..."` for the QA/e2e build, and a separate `build:web:release` without it. Add this to the step 9 store-readiness checklist.

### 3. `npm run e2e` can silently test a stale or foreign build
- **Where:** `playwright.config.ts:22-27`, `package.json:13,18`
- **Problem:** `reuseExistingServer: true` on the fixed port 4173, and `e2e` does not build first. Whatever is already on 4173 gets tested: an old `dist/`, another agent's server, or nothing built at all. In the parallel review/QA loop this can produce a green run that never exercised the current code.
- **Fix:** Use `"e2e": "npm run build:web && playwright test"` (or a `pree2e` script) and `reuseExistingServer: !process.env.CI`. Optionally make the port configurable through an env var so agents don't collide.

### 4. Croc blink runs on the JS thread and rebuilds the whole drawing on every frame
- **Where:** `src/illustration/croc/useIdleBlink.ts:265`, `src/illustration/croc/Croc.tsx:117-120`
- **Problem:** Each blink is three `setState` calls. Each one re-runs `buildCroc` and re-renders about 89 SVG nodes, every 2–4.5 s for each animated croc. PLAN.md asks for animation on the UI thread. It is cheap today (about 0.2 ms per build on desktop, one animated croc per screen), but it scales badly once several animated crocs share a screen (map, habitat) on low-end Android.
- **Fix (later):** Draw the eyelid as its own shape whose `scaleY` or path is driven by a Reanimated shared value (`useAnimatedProps`), and keep the rest of the drawing memoised.

### 5. `useReducedMotion()` subscribes to AccessibilityInfo in every consumer, even inside the provider
- **Where:** `src/motion/MotionProvider.tsx:61-65`
- **Problem:** `useSystemReducedMotion()` is called unconditionally, so every Button (through `usePressDepth`), Ripple, Firefly, Reeds and Croc adds its own listener and async query, and the provider's value is used anyway. The hook also starts as `false`, so with reduced motion on, loops start for one frame before they are cancelled.
- **Fix:** Back the system value with a module-level store read through `useSyncExternalStore`: one listener, synchronous after the first resolve. On web, seed it synchronously from `matchMedia('(prefers-reduced-motion: reduce)')`.

### 6. Button and IconButton silently drop consumer `onFocus`, `onBlur`, `onPressIn` and `onPressOut`
- **Where:** `src/ui/Button.tsx:97-103`, `src/ui/IconButton.tsx:356-362`
- **Problem:** `{...rest}` is spread first, then the component's own handlers override it. A future caller that passes `onFocus` (for example scroll-into-view on focus) or `onPressIn` (for example haptics) gets no error and nothing happens.
- **Fix:** Compose the handlers: `onFocus={(e) => { focus.onFocus(); rest.onFocus?.(e); }}`, and the same for the others.

### 7. Placeholder detection is keyed on the string value
- **Where:** `src/copy/placeholder.ts`, `src/ui/Text.tsx:46`
- **Problem:** Any non-placeholder text that happens to equal a placeholder value is marked. Interpolated placeholders (`points.amount` → "240 Points") are never detected, so callers have to pass `placeholder` by hand. This only affects the dev-mode mark.
- **Fix:** Acceptable for now. If it starts to matter, check placeholder status by key (`isPlaceholderKey`) at the call site, or have `t()` return a branded value.

### 8. The JSX-literal lint rule ignores props
- **Where:** `eslint.config.js:16-19` (`ignoreProps: true`)
- **Problem:** `<Button label="Start" />` or `accessibilityLabel="Close"` outside `src/copy` passes lint. I grepped `src/` and found no violations today. Props are the main path for user-facing strings in this codebase (`label`, `accessibilityLabel`, `title`), so the guard can be bypassed in later steps.
- **Fix:** Add a `no-restricted-syntax` rule for `JSXAttribute[name.name=/^(label|title|accessibilityLabel|accessibilityHint|placeholder)$/] > Literal` outside the copy, dev and test globs.

### 9. Test and lint packages are listed as runtime dependencies
- **Where:** `package.json:26,31,32` (`eslint-config-expo`, `jest`, `jest-expo` under `dependencies`)
- **Fix:** Move them to `devDependencies`.

---

VERDICT: CHANGES REQUIRED
