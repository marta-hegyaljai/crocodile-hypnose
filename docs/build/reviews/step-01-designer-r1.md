# Step 1 design review and polish, round 1

Designer / UI-UX engineer agent.

**Build.** `npm run build:web` at the commits listed below, served with `serve --single` on port 4173. Screenshots in Chromium (Playwright, `/opt/pw-browsers`) at 390x844, 360x640, 820x1180, 320x568, 844x390, 1024x768, 1280x720 and 1440x900, 2x device scale. Before-screenshots are QA's round 2 set in `docs/build/screenshots/qa/step-01/r2/`; after-screenshots are in `docs/build/screenshots/design/step-01/`.

**Commits (not pushed).**
- `ff4ae10` Rework the croc mascot: floating peek pose, lens belly, volume and stage details
- `69c0207` Compose the lagoon with depth and fix title contrast in landscape
- `1bb20c5` Make core components tactile and add a large croc viewer to the gallery
- plus this report, the backlog update and the after-screenshots

**Checks.** `npm run check` green (typecheck, lint, 98 unit tests). `npm run e2e` green (24 tests across phone-390, phone-360, tablet-820). No console errors or page errors on `/`, `/dev/gallery` or the not-found route at any of the viewports above.

## 1. Review

Judged against production illustrated, gamified mobile apps, the step-1 foundation was solid in structure (tokens, atmospheres, copy module, accessible components) but visually still a prototype:

- The index had a dead sky band (~250px at 390x844, ~450px at 820) and a flat two-layer scene: sky, water. No horizon, no light source, no sense of depth.
- The mascot was flat-filled with no volume, and in the peek pose only a head showed with a single triangular scute behind it (reads as an ear) and straight body edges under the chin. The full body had a rectangular belly panel, fin-like scutes and floating eyebrows.
- Components were correct but matte: a flat face on a flat edge, cards without an edge, chips without any relief, progress bars with no groove.
- QA R2-M1 (MAJOR): in landscape the left-aligned title sat on the dark leaf cluster at about 2.9:1.

## 2. What I polished

### R2-M1 (MAJOR): title on the leaves in landscape. Fixed.

In landscape the leaf cluster is smaller (`min(0.2w, 0.3h)`) and the header is inset past it (`0.9 × leafSize`, the foliage never extends beyond 0.88 of its box). In portrait the title moved 16px down so its top-left corner clears the tip of the first leaf. I measured the worst-case contrast of the glyph boxes against the rendered scene with the text hidden (sampling every 2px):

| Viewport | Title | Tagline |
|---|---|---|
| 844x390 | 12.19:1 | 6.98:1 |
| 1024x768 | 12.40:1 | 7.12:1 |
| 1280x720 | 12.29:1 | 7.05:1 |
| 1440x900 | 12.41:1 | 7.18:1 |
| 390x844 | 12.19:1 | 7.09:1 |
| 820x1180 | 12.40:1 | 7.11:1 |
| 320x568 | 12.02:1 | 6.85:1 |

Before: `qa/step-01/r2/index-title-1440x900-zoom.png`. After: `design/step-01/index-1440x900.png`, `index-844x390.png`, `index-1024x768.png`, `index-1280x720.png`.

### Index composition (QA r2-m3, r2-m4)

The scene now has five depth planes: sky with a light source, far jungle, water with the croc, lily pads, near bank. Specifically:

- **SkyGlow** (new): a warm sun haze behind the croc by day; a crescent moon with a soft amber halo at night, placed up and to the right so it never fights the croc.
- **FarJungle** (new): two layers of rounded canopy in atmospheric-perspective greens with filled palm crowns, fading into mist where they meet the water. Deterministic layout, so it is stable between renders.
- **Ambient motion**: daylight gets five pale drifting motes (seeds and pollen) in the sky; night keeps the fireflies. Both use the existing `useBreath` loops, so they go still under reduced motion like everything else.
- **Water higher, croc larger**: the croc drawing is wider now (head, back and tail tip) and the Lagoon centres it on the head (`peekFocusRatio`), so the hero is bigger and sits on the horizon with the sun behind it.
- **Landscape squeeze** (r2-m4): lily pads drop out when the water band is under 110px and the near-bank reeds when it is under 150px, so nothing is half hidden behind the bank at 844x390.

Before: `qa/step-01/r2/index-390.png`, `index-820.png`, `index-844x390.png`. After: `design/step-01/index-390x844.png`, `index-390x844-tapped.png` (excited reaction), `index-820x1180.png`, `index-844x390.png`, `index-360x640.png`, `index-320x568.png`.

### Croc mascot

Same character (round head, big amber slit eye, friendly wedge snout), now with the craft of a finished mascot:

- **Peek pose** (r2-m2): a dedicated floating body. The back rises just above the surface behind the head with a ridge of four to six rounded scutes that lean with the curve, and the tail tip curls out of the water further back. The junction with the head is hidden inside the head, so no straight vertical edge shows; the submerged part is drawn and shows faintly through the water's translucent top, as a real croc does. The hump scales with body length so the hatchling stays small.
- **Volume**: shapes can reference named linear gradients, declared per drawing in user space and rendered identically by `Croc.tsx` (react-native-svg) and `drawingToSvgString`. The skin is lit along the back and shaded towards the belly; the egg shell is shaded at the base. Legs behind the body use the shaded tone.
- **Full body** (r2-m5): the belly is a lens that is thin behind the chin, fullest under the body and tapers into the tail, with three soft creases following its curve; the thighs are rounded on both sides so the belly is no longer cut into a box between the legs. Scutes are low half-ellipse domes that lean with the back and tail. The raised brow hugs the top of the eye socket instead of floating.
- **Eye**: a slightly heavier dark ring and larger highlights, so the amber slit reads at avatar size.
- **Growth progression**: egg (shaded, hatching variants per expression) → hatchling (shell cap, big eye) → juvenile (plain) → adult (tail bands, more scutes) → grand (moss, lily, tail bands and a heavy brow ridge for a wise look). All 5 stages × 6 expressions × 2 poses × 2 atmospheres checked: `design/step-01/croc-sheet-day.png`, `croc-sheet-night.png`, zooms `croc-peek-juvenile-calm-zoom.png`, `croc-full-grand-calm-zoom.png`. Before: `qa/step-01/r2/croc-grid-full-zoom.png`, `index-croc-calm-zoom.png`.

### Scene pieces

- **Reeds** (r2-m1): stalks and cattail heads stay inside the canvas whichever way they lean (12px inset, head height reserved), so no head is cut flat. Cattails are capsules with a thin spike and a lighter seam; each clump gets grass blades at the base.
- **Lily pads, water, leaves**: unchanged.

### Components (both atmospheres)

- **Button**: a soft shadow on the rounded edge (daylight only; the first attempt put it on the Pressable root and it drew as a rectangle, fixed), a light gloss along the top of the face, and at night the disabled face uses the raised surface with a hairline so its shape never disappears (QA's m2 note).
- **Card**: a faint light line along the top edge, a hairline at night on surface and raised tones, and pressable cards now sit on a 3px edge they sink onto when pressed, matching the buttons.
- **Chip**: hairline border with a thicker bottom edge and a gloss; reads as a small pebble.
- **ProgressBar**: an inset groove on the track, a gloss on the fill and a minimum visible dot above zero.
- **TabBar**: a larger active pebble (60x34) with a soft lift and gloss.
- **Gallery** (backlog m10): a viewer card with stage, expression and pose pickers shows one croc large with the idle animation; the far-jungle piece is in the scene section.
- **Not-found**: the hatchling fills the width.

After: `design/step-01/gallery-390-day-buttons.png`, `gallery-390-night-buttons.png`, `gallery-390-day-cards.png`, `gallery-390-night-cards.png`, `gallery-390-day-chips.png`, `gallery-390-day-progress.png`, `gallery-390-day-tabbar.png`, `gallery-390-night-tabbar.png`, `gallery-390-day-croc.png`, `gallery-390-night-croc.png`, `gallery-390-day-scene.png`, `gallery-390-night-scene.png`, plus the same set at 360, and `notfound-390x844.png`.

### Accessibility and motion

Unchanged behaviour: all new scene pieces spread `decorative` (hidden from assistive tech), the croc keeps its name and stage label, idle, ripples, reeds sway, motes and fireflies all stop under reduced motion (the e2e reduced-motion test passes), tap targets unchanged. Text tones unchanged.

## 3. Remaining issues

No BLOCKER or MAJOR.

- **MINOR** Gallery viewer: in the peek pose the inline water only spans the drawing, not the whole card. Dev-only, added to the backlog.
- **MINOR** The egg's peek frame is the same drawing as the full pose (nest with a tighter frame). Fine for an avatar; a "half under water" egg can come with the croc tab. Backlog.
- **MINOR** Croc gradient ids are per drawing; if several crocs of different stages ever share one `<Svg>`, the ids need a per-instance suffix (the component already suffixes with `useId`). Backlog.
- **Not tested**: native iOS and Android rendering of the gradients and shadows (react-native-svg linear gradients and RN `shadow*` props are standard, but not verified on device here); Safari and Firefox.

VERDICT: PASS
