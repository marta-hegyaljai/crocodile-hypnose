# Step 9b design pass, round 1 (app identity)

Designer agent on `step/S09-id` (base 94cd707). Scope: app icon, splash, and a consistency sweep limited to `src/theme` and `src/illustration`. Nothing under `src/app`, `src/features`, `src/ui`, `src/services` or `server/` was touched. No new copy.

Screenshots: `docs/build/screenshots/design/step-09/`. Master SVGs: `assets/brand/`. Generator: `scripts/make-brand-assets.mjs` (Playwright Chromium from `/opt/pw-browsers`, no new dependency; `--preview` also renders the contact sheets below).

## What was made

**The mark.** The croc peeking out of the river, cropped close so the amber slit eye is the icon: Deep Jungle sky with two soft leaf shadows, the head in the croc's own greens (`skinTop`/`crocGreen`/`skinShade` gradient, `crocSkin` socket bump, `crocScute` ring, scutes and nostril), the eye with the in-app radial amber (`amberLight` -> `amber` -> `amberDeep`), the slit pupil in `jungleInk` and the two highlights, a calm upper lid as in the `calm` expression, then River Teal water with a Shallows wave line and ripples. One `head()`/`water()`/`sky()` set builds every variant, so the layers can never drift apart.

- `assets/icon.png` 1024 (iOS, full bleed; the OS rounds it). `icon-sizes.png`: the icon at 16, 32, 48, 64, 120, 180 on River Mist, white, black and Deep Jungle. At 16 it is a dark tile with an amber dot and a teal base; at 32 the slit reads; from 48 the croc is unmistakable. On Deep Jungle (the darkest plausible launcher wallpaper) the amber still carries it.
- `assets/android-icon-foreground.png` 1024: the mark at 0.74 so head and eye sit inside the 66% safe circle; the water bleeds to the edges. `assets/android-icon-background.png`: the Deep Jungle sky. `assets/android-icon-monochrome.png`: one alpha silhouette (head with the eye cut out and the slit left in, plus the wave). `icon-android-adaptive.png`: circle, squircle and rounded-square masks plus the themed tint.
- `assets/favicon.png` 48, the icon in a pebble mask. The release export turns it into `dist/favicon.ico`; `favicon-ico.png` shows it at 16/32/48.
- `assets/splash-icon.png` 1024: the icon in a 26% pebble mask on transparent. `app.json` now shows it 200pt wide (`imageWidth`) on River Mist `#E7F0E6`, both in `expo.splash` and the `expo-splash-screen` plugin. River Mist is the first in-app frame: the root view background, the web body colour set in `_layout.tsx`, and the sky of the daylight Lagoon on Welcome, Home and the profile-loading screen. Before, the splash was Deep Jungle and cut to a light screen. `splash-390.png`.
- The adaptive background stays Deep Jungle (the icon's own sky), so the launcher tile and the splash are the same mark on their proper grounds.

**Consistency sweep (`src/theme`, `src/illustration`).** The type scale, spacing, radii and motion tokens are coherent; nothing to change there. The scene files carried hex literals that duplicate palette entries exactly; those now reference the palette (no visual change): `Decoration.tsx` (`leaf`, `riverbankMud`, `mudDark`, `crocGreen`), `LilyPad.tsx` (`jungleMid`). The moonlit-foliage shade `#17493A` was repeated in `JungleLeaves.tsx` and `Lagoon.tsx`; it is now `palette.jungleNight`.

## Checks

- `npm run check`: pass (typecheck, lint with zero warnings, 58 suites / 395 tests).
- `npm run build:web:release`: pass, `check-web-build: dist OK (dev mode off)`; `dist/index.html` links `/favicon.ico` built from the new PNG.
- No e2e specs touched; no screen changed.
- Not tested: a real device launcher or the native splash (web only here). Android's adaptive mask and Apple's corner mask are simulated in the contact sheet.

## Remaining issues

- **MINOR (design, later pass): the tab bar `croc` icon in `src/ui/icons/Icon.tsx` predates the mark.** Out of this pass's file scope (`src/ui`). Worth redrawing as a line version of the peeking head so the tab, the avatar and the app icon rhyme.
- **MINOR (design, later pass): scene night shades are still per-file literals** (`Reeds`, `FarJungle`, `LilyPad`, `JungleLeaves` each keep their own night greens, `Decoration.tsx` its own stone/wood/heron set). They are consistent with each other by eye; naming them in the palette is a tidy-up, not a defect, and was left to keep this diff reviewable.
- **MINOR (MHP decision): `userInterfaceStyle` is `light`**, so there is no dark splash variant. If MHP wants the system dark mode honoured, add `expo-splash-screen` `dark: { backgroundColor: "#08171A" }` with the same image.
- **Note for the orchestrator:** regenerate with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/make-brand-assets.mjs --preview` after any change to `assets/brand/`'s source in the script; the SVGs in `assets/brand/` are written by the script, not edited by hand.

VERDICT: PASS
