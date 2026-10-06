# Step 1 QA, round 1

Tester: QA engineer agent. Build: a fresh `expo export --platform web` of the current working tree (branch `claude/fervent-rubin-7i8lut`), served the same way as `npm run serve:web` (`serve --single` on port 4173). Browser: Playwright Chromium from `/opt/pw-browsers`. Viewports: 390x844 and 360x640 (mobile, touch), 820x1180 (tablet), plus 320x568, 844x390 (landscape) and 1280x720 (desktop) as edge cases. I used real taps and clicks, the keyboard (Tab, Shift+Tab, Enter, Space, arrow keys), reloads, browser back and forward, and emulated `prefers-reduced-motion`.

Screenshots: `docs/build/screenshots/qa/step-01/`.

## Acceptance criteria

| Criterion | Result |
|---|---|
| `npm run check` / `build:web` / `e2e` pass | Export succeeds. `npx playwright test` passed 12/12 against the served build. I left `npm run check` to the code reviewer. |
| Gallery renders every component state and all croc stages × expressions at 390 and 360, with no layout breaks or console errors | **Partly met.** No console errors or page errors on any route or viewport. All 30 croc cells, both poses and both atmospheres render. One layout break: the long-label Button spills out of the page on both sides, and the gallery scrolls sideways (scrollWidth 485 at 390 wide, 470 at 360 wide). See M1. |
| Fonts load, no fallback in screenshots | **Met.** All six faces (Baloo 2 600/700/800, Nunito Sans 400/600/700) show `loaded`, and every text node uses them. |
| Buttons have a visible press animation and focus state; tap targets ≥ 44px | **Mostly met.** The press drops the face 5px onto its edge and springs back. Dragging off cancels the press. Disabled and loading buttons ignore taps, and the loading button cannot be double-fired. Button, IconButton and pressable Card show a focus ring in both atmospheres (teal by day, amber by night). Every target is ≥ 44px. **Tab bar items show no focus state at all** (M3). |
| Reduced motion turns off idle and ripple animations | **Met.** With `reduce`, the croc, water, lagoon and fireflies all hold still (1 distinct frame out of 6–8 samples); without it they animate. The press snaps instantly. The gallery override toggle works (one edge case in m4). |
| Croc is visibly the same character across all stages and polished enough to be the face of the app | **Same character: yes.** The amber slit-pupil eye, green skin, scutes and pale belly carry through all stages, and the egg peeks out with the same eye. **Polished enough: not yet.** See M4 and M5. |
| No user-facing string outside `src/copy` | Index and not-found use `t()` only. The gallery is dev-only and exempt. No issues seen. |

## Findings

### M1. MAJOR: Button with a long label overflows the screen instead of truncating
- **Steps:** Open `/dev/gallery` at 390x844 or 360x640 and scroll to Buttons → "Long label".
- **Expected:** The label truncates with an ellipsis inside the button, as the gallery label itself says it should, and the page cannot scroll sideways.
- **Actual:** The text renders 579px wide, centred, and runs out of both sides of the button and the viewport. The gallery ScrollView becomes horizontally scrollable (scrollWidth 485 vs 390). The label has `numberOfLines={1}`, but its row/face can't shrink below its content, so the truncation never happens. Real labels will hit this: long croc names, German copy later, large-text settings.
- **Screenshots:** `gallery-390-day-05.png`, `gallery-360-day-07.png`, `gallery-390-night-05.png`

### M2. MAJOR: A hug-width Button ignores its parent's centring and always sits left
- **Steps:** Open any unknown route (e.g. `/some/missing-page`). Also look at the "Component gallery" link under "Get started" on `/`.
- **Expected:** The "Go home" button sits centred under the centred croc and "Page not found" title, since the parent has `alignItems: 'center'`.
- **Actual:** "Go home" is pinned to the left edge at 360, 390 and 820, while everything above it is centred. The index footer link has the same problem. Cause: `Button` styles `root`/`hugWidth` set `alignSelf: 'flex-start'`, which overrides the parent's `alignItems`. Every centred layout in later steps (onboarding, reward moments, empty states) will inherit this.
- **Screenshots:** `notfound-390.png`, `notfound-360.png`, `notfound-820.png`, `kbd-index-tab2.png`

### M3. MAJOR: Tab bar items have no visible keyboard focus
- **Steps:** Open `/dev/gallery` and press Tab until focus reaches the tab bar (24 presses lands on "Games"). Repeat in Night.
- **Expected:** A visible focus ring on the focused tab, as on Button and IconButton (WCAG 2.4.7). The step brief asks for a focus state.
- **Actual:** Focus moves to the tab (`document.activeElement` is the tab), but nothing changes visually in either atmosphere. `TabBar.tsx` removes the native outline (`noNativeOutline`) and never renders a `FocusRing`. The tab bar will be on every main screen, so keyboard users lose their place there.
- **Screenshots:** `kbd-tabbar-games-focused.png` (Games focused, no indicator), `kbd-night-tabbar-focus.png` (Profile focused, Night, no indicator), `kbd-gallery-tab25.png`

### M4. MAJOR: Visible build and clipping artefacts in the croc and the river scene on the hero screen
These show on the very first screen and spoil the polished look the brief asks for:
1. **Peek pose body ends in a hard vertical cut.** The croc's back stops in a straight vertical edge with a scute fragment on the corner. Underwater, the submerged body is a flat, hard-cornered rectangle. Seen on `/` at every size and in every Lagoon and inline-water peek cell. It is most obvious at tablet and desktop widths.
2. **Lily pads are clipped flat.** Rotated pads are cut off by their own square bounds, so the top and bottom edges are straight lines. Seen on the right-hand pad on `/` and the rotated pad in the gallery.
3. **The croc's decorations are clipped at the top of its bounds.** The excited and proud sparkles render as half-stars or "▼" shapes. The hatchling's head and eggshell are flattened at the top in the peek grid.
4. **There is a stray white line** left of the mouth corner (calm and happy), floating apart from the teeth.
5. **The "happy" and "excited" cheek blush is a flat grey-mauve oval** on green. It reads as a smudge or bruise, not a blush.
6. **Expressions are hard to tell apart at normal sizes.** Calm and proud are nearly identical. Calm, proud and eyes-closed eggs are identical apart from one sparkle. Expressions only differ in the eye and a 1–2px mouth change, so they get lost at map or tab size.
- **Expected:** Clean silhouettes with nothing clipped and no stray shapes. The body should fade or taper into the water instead of ending at a box edge, and each expression should be readable at a glance. The character is consistent and likeable, and the amber eye works well as a signature. These artefacts are what stop it reading as the face of a polished app.
- **Screenshots:** `index-croc-zoom.png`, `index-croc-happy-zoom.png`, `index-croc-excited-zoom.png`, `index-lilypad-clipped-zoom.png`, `croc-grid-peek-zoom.png`, `croc-grid-full-zoom.png`, `croc-hero-zoom.png`, `index-1280x720.png`, `index-390-rapid-taps.png`

### M5. MAJOR: Index screen composition breaks off at the bottom and fails on wide or short screens
- **Steps:** Open `/` at 390x844, at 820x1180, then at 844x390 (landscape phone) or 1280x720 (desktop browser).
- **Expected:** A finished scene that fills the screen. The croc must never collide with the title. On wide screens, the CTA stays a sensible width.
- **Actual:**
  - At 390 and 820, the river stops in a hard straight horizontal edge at 62% of the height, followed by a flat empty band (about 180px at 390 and about 350px at 820) before the button. It looks unfinished: no riverbank, no gradient, nothing grounding the scene.
  - At 844x390 and 1280x720, the croc's head and eye sit right over "MHP Hypnose" and the tagline, so the text is drawn across the eye.
  - The "Get started" button stretches the full window width (1232px on desktop).
  - The web build is a shipped platform, so desktop and landscape visitors will see this. Native is portrait-locked.
- **Screenshots:** `index-390.png`, `index-820.png`, `index-844x390.png`, `index-1280x720.png`

### M6. MAJOR: Two `Text` tones fail WCAG AA in their own atmosphere
- **Steps:** Open `/dev/gallery` and go to Type → Tones, in Daylight and then in Night.
- **Expected:** Every tone the design system offers for text meets AA (PLAN: "WCAG AA contrast").
- **Actual:**
  - `tone="accent"` in Daylight is amber `#F2A93B` on River Mist `#E7F0E6`, which is **1.71:1**.
  - `tone="water"` in Night is `#17524F` on `#08171A`, which is **2.05:1**. It is nearly invisible.
  - The theme tests only check primary, secondary and muted, so these slip through. A later step that uses "accent" for a points number or "water" for a label will ship unreadable text.
  - Possible fix: map the tones to `accentDeep` / `waterLight` per atmosphere, or remove them from the text tones.
- **Screenshots:** `gallery-390-day-03.png`, `gallery-390-night-03.png`

### Minor (for BACKLOG)
- **m1. Tab bar keyboard support.** Space does not activate a tab; only Enter does. Buttons accept both. Arrow keys don't move between tabs (ARIA tabs pattern). Tested in `/dev/gallery`.
- **m2. Disabled button at night looks enabled.** The 50% opacity amber on Night River turns into a solid mud-brown button rather than a clearly inactive one. Disabled IconButton has the same issue. See `gallery-390-night-04.png` and `gallery-390-night-05.png`.
- **m3. Layout jumps when switching the toggle-style buttons.** A secondary/primary button is 49px tall (face plus 5px depth) and a ghost is 44px. Swapping variants to show selection (Daylight/Night, Peek/Full body) moves the content below by 5px. Any future segmented control built this way will jump.
- **m4. Motion doesn't fully restart after starting reduced.** If the page loads with system reduce-motion on and motion is then switched to full (the gallery override), the croc starts moving but the water ripples and fireflies stay frozen until a remount. Switching full → reduced → full works.
- **m5. `+html.tsx` is ignored** because `app.json` sets `web.output: "single"`. The served `index.html` is Expo's default template. As a result:
  - there is no `theme-color` and no `viewport-fit=cover`;
  - the body is white, not River Mist, until React paints;
  - the HTML contains an invalid `httpequiv` attribute.
- **m6. Screen reader noise.**
  - `/` exposes about 13 unnamed `img` nodes (leaves, reeds, lily pads, ripples) that should be hidden from assistive tech.
  - "MHP Hypnose" and "Page not found" aren't exposed as headings.
  - The croc's label ("Croc, Stage 3") is fine.
- **m7. The `croc` icon doesn't read as a croc.** In the icon set and the tab bar it looks like a hat or a submarine. This is the mascot's own tab. See `gallery-390-day-05.png` and `gallery-390-day-06.png`.
- **m8. Fireflies are hard-edged concentric circles,** like targets, rather than soft glows. In the Night lagoon they are as big as the croc's eye and crowd the reeds. See `gallery-390-night-08.png` and `gallery-390-day-09.png`.
- **m9. The raised textured card's scale pattern runs straight through the body text** and makes it busy to read. See `gallery-390-day-06.png`.
- **m10. The gallery croc grid is too small to review expressions.** Peek cells are 53px wide, even on tablet, where the gallery is capped at 520px. An option to show one stage at large size would make design review practical.
- **m11. The not-found screen's croc is very small** (hatchling at relative size inside 220px) and the screen feels empty. It is fine as a placeholder.
- **Note (step 9 scope, not a finding):** the favicon and app icon are still the Expo defaults.

## Exploratory notes (no issue found)
- **CTA on `/`.** Tapping makes the croc excited (sparkles, open mouth), then it settles to happy. Six fast taps don't break anything or stack timers.
- **Navigation.** `/` → gallery link → browser back → forward works. The in-app back on the gallery replaces to `/`. Reloading `/dev/gallery` resets to Daylight, which is acceptable for a dev page. Unknown deep links (with a query string) show not-found, and "Go home" works.
- **Keyboard.** The tab order on the gallery follows the visual order, and Enter and Space both fire Buttons. Focus rings on Button, IconButton and Card are clear in both atmospheres.
- **Small phone.** At 320x568 the index screen still fits without overlap.
- **Console.** There are no console errors or warnings from the app on any page or viewport.

## Not tested
- Native iOS and Android: no device or simulator here. That covers haptics, safe areas on notched devices, Android back, and the splash/font gate on native.
- Real screen readers (VoiceOver, TalkBack, NVDA). I only inspected the accessibility tree in Chromium.
- Browsers other than Chromium (Safari, Firefox), and real touch hardware. Touch was emulated.
- `npm run check`, which I left to the code reviewer.

VERDICT: CHANGES REQUIRED
