# Step 1 QA, round 2 (re-verification)

Tester: QA engineer agent.

**Build.** I built a fresh `EXPO_PUBLIC_DEV_MODE=1 expo export --platform web --clear` at `5b82a64` into a QA-only folder and served it with `serve --single` on port 4173. That is the same build as `npm run build:web`.

**Browser and viewports.** Playwright Chromium from `/opt/pw-browsers`, at the same viewports as round 1: 390x844, 360x640 and 820x1180, plus edge sizes 320x568, 844x390, 1024x768, 1280x720 and 1440x900.

**Scope.** I re-tested M1–M6, then the minors marked fixed (m2, m3, m5, m6, m7, m8, m11 partly), then did a regression sweep of `/`, `/dev/gallery` and the not-found route. I did not re-raise BACKLOG items.

**Screenshots.** `docs/build/screenshots/qa/step-01/r2/`.

## Round 1 MAJORs

| # | Status | Evidence |
|---|---|---|
| M1 Long Button label overflows | **Fixed.** Both long-label buttons, full-width and hug-width in a centred parent, truncate with an ellipsis inside the button. No container scrolls sideways on any route at 390, 360 or 820 (scrollWidth equals clientWidth everywhere). | `gallery-390-day-05.png` |
| M2 Hug-width Button ignores centring | **Fixed.** "Go home" is centred under the title at 360, 390 and 820. The index "Component gallery" link is centred too. | `notfound-390.png`, `notfound-360.png`, `notfound-820.png`, `index-390.png` |
| M3 Tab bar has no keyboard focus | **Fixed.** Keyboard focus draws a ring on the tab: teal by day, amber at night. A mouse click shows no ring. Enter and Space both select the tab. | `kbd-tabbar-games-focused-day.png`, `kbd-tabbar-profile-focused-selected-day.png`, `kbd-tabbar-croc-focused-night.png`, `tabbar-after-mouse-click-night.png` |
| M4 Croc and scene artefacts | **Fixed.** See "Croc and scene judgement" below. | `index-croc-calm-zoom.png`, `index-croc-happy-zoom.png`, `index-croc-excited-zoom.png`, `croc-grid-peek-zoom.png`, `croc-grid-full-zoom.png`, `index-lilypads-zoom.png` |
| M5 Index composition | **Mostly fixed.** One new problem in landscape and desktop: see **R2-M1**. | `index-390.png`, `index-360.png`, `index-820.png`, `index-844x390.png`, `index-1024x768.png`, `index-1280x720.png`, `index-1440x900.png` |
| M6 Text tones fail AA | **Fixed.** I measured the rendered colours on the gallery background. Day: accent 5.33:1, water 5.16:1. Night: accent 9.16:1, water 9.08:1. Every tone in both atmospheres is at or above 5.16:1. | `gallery-390-day-03.png`, `gallery-390-night-03.png` |

### Croc and scene judgement (M4/M5)

The croc now holds up as the face of the app.

**Artefacts gone:**
- The peek body tapers and sinks under the surface. There is no box and no vertical cut.
- The stray white line by the mouth is gone.
- The blush is a clean soft pink.
- Sparkles and the hatchling's eggshell are no longer clipped.
- Lily pads rotate without clipping.

**Expressions now read at a glance:**
- calm: a plain eye;
- happy: a raised brow, blush and smile;
- sleepy: a heavy lid and bubbles;
- excited: a wide eye, open mouth with tongue, and sparkles;
- proud: a half-lidded, smug look with a sparkle;
- eyes closed: a closed lid.

The egg row differs per expression as well (crack, open eye, half lid, closed eye).

**Character.** The amber slit eye stays a strong signature across all five stages, in both poses and both atmospheres.

**Scene.**
- On phones the river now fills the screen down to a near bank, with the CTA standing on the bank.
- At 820 the composition is complete.
- Fireflies are soft glows.
- The Night lagoon looks atmospheric.
- Tapping "Get started" gives a satisfying excited reaction (`index-390-excited.png`).

What remains is polish, not breakage. I list it under minors for the designer.

## Round 1 minors marked fixed

| # | Status |
|---|---|
| m2 Night disabled button looks enabled | **Fixed.** It is now a sunken surface with muted text, clearly inactive (`night-disabled-buttons.png`). Small note: at night the face is almost the background colour, so the button shape nearly disappears and only the lip and text remain. Designer call. |
| m3 Toggle height jump | **Fixed.** All variants share one outer height: 49px at size sm by day and 47px at night (Daylight, Night, Motion, Peek, Full body). Primary, ghost and disabled are 57px. Switching variants no longer moves the content. |
| m5 `+html.tsx` ignored | **Fixed as intended.** The file was removed, and the body computes River Mist `rgb(231,240,230)` on all routes once the app starts. Before JS runs, the default Expo `index.html` is still unstyled, but that frame is too short to notice. Not re-raised. |
| m6 Screen reader noise | **Fixed.** The index tree is now: croc image "Croc, Stage 3", heading level 1 "MHP Hypnose", tagline text, button, link. Decorative pieces are hidden. Not-found exposes heading "Page not found". |
| m7 Croc icon unclear | **Fixed.** The icon is now a croc head above a water line and reads as a croc in the icon set and the tab bar. |
| m8 Firefly targets | **Fixed.** They are soft radial glows by day and at night, in the gallery and in the Night lagoon. |
| m11 Not-found croc small | **Partly fixed.** The hatchling is bigger and the button is centred. The screen is still sparse, which is already a backlog item. Not re-raised. |

## Regression sweep (no issues)

- **Console.** No console errors, warnings or page errors on `/`, `/dev/gallery` or an unknown route, at 390, 360 or 820.
- **Fonts.** Baloo 2 and Nunito Sans load.
- **Button press.** The press drops 5px and springs back; with reduced motion it snaps. Dragging off cancels. Disabled and loading buttons ignore taps. The load demo can't be double-fired.
- **Reduced motion.**
  - With system reduce, the croc, water, lagoon and fireflies all hold still (1 distinct frame).
  - Without it, they animate (6–8 distinct frames).
  - The gallery override full → reduced stops everything.
  - The reduced-start then forced-full case is backlog m4, now covering the croc too. Not re-raised.
- **Keyboard.** The index order is CTA, then gallery link, both with visible rings. The gallery tab order follows the visual order, and Enter and Space work on buttons and tabs.
- **Navigation.** index → gallery → browser back and forward work. The gallery's in-app back works. Reload works. An unknown deep link with a query string shows not-found, and "Go home" works. Six rapid CTA taps don't break the croc state.
- **Small phone.** 320x568 fits with no overlap.
- **E2E suite.** The code reviewer runs it on port 4373; I didn't re-run it.

## New findings

### R2-M1. MAJOR: In landscape, tablet-landscape and desktop widths, the title and tagline sit on the dark jungle leaves
- **Steps:** Open `/` at 1024x768 (iPad landscape), 1280x720, 1440x900 or 844x390.
- **Expected:** The app name and tagline are fully on the light sky, with AA contrast, as in portrait.
- **Actual:**
  - The M5 fix left-aligns the title block in landscape, but the top-left leaf cluster still reaches down to the title row.
  - The "M" (and at 1440 the "MH") of "MHP Hypnose", plus the start of "[Tagline]", are drawn over the green leaves.
  - Dark text `#0E2E24` on leaf green `#3F6B35` is about 2.9:1, below even the 3:1 large-text threshold. On the darker leaf shade it is lower still.
  - A real tagline sentence would start under the leaf and be partly unreadable.
  - The croc–title collision from round 1 is fixed. This is a new overlap caused by moving the title left.
- **Suggested fix:** Inset the title past the leaf cluster in landscape, or scale or raise the leaves there. This is a small layout fix the designer can make in the polish pass; it doesn't need another engineer round.
- **Screenshots:** `index-title-1024x768-zoom.png`, `index-title-1280x720-zoom.png`, `index-title-1440x900-zoom.png`, `index-title-844x390-zoom.png`, `index-1024x768.png`, `index-1440x900.png`

### Minor (for the designer, or BACKLOG)
- **r2-m1. Cattail heads are clipped.** The brown cattail heads on the reeds, both the near-bank ones and those behind the water, are cut flat on one side by the reed bounds. It is visible at zoom and slightly flattened at 1x. See `index-lilypads-zoom.png`.
- **r2-m2. The peek croc's single scute behind the head reads like a small ear or horn** rather than part of a ridge (`index-croc-calm-zoom.png`). Underwater, the submerged body still has one straight vertical edge on the right side. It is faint, but visible at tablet size (`index-820.png`).
- **r2-m3. The index has a large empty sky band** between the tagline and the reeds on tall phones and tablets (about 250px at 390x844 and about 450px at 820). This is the composition point the designer has already picked up. See `index-390.png` and `index-820.png`.
- **r2-m4. Landscape 844x390: reeds and lily pads are squeezed.** The water band is short, so the front reeds overlap the water reeds and the left lily pad is half hidden behind the near bank. See `index-844x390.png`. Native is portrait-locked, so this is web only.
- **r2-m5. The full-body croc still has the pale rectangular belly panel** between the legs, which reads as a box. See `croc-grid-full-zoom.png`. Designer call.

## Not tested
- Native iOS and Android.
- Real screen readers. I only checked the Chromium accessibility tree.
- Safari and Firefox.
- Real touch hardware.
- The release build with dev mode off (`build:web:release`). I left it to the code reviewer.

VERDICT: CHANGES REQUIRED. The one open MAJOR (R2-M1) is a small layout fix the designer can take in the polish pass.
