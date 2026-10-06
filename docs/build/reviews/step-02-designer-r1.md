# Step 2 design review and polish, round 1

Designer / UI-UX engineer agent.

**Build.** `npm run build:web` (dev mode) at the commits below, served with `serve --single` on port 4173; `server/` on port 4000 with its default database, plus one user created with `npm run create-user` (client `mhp-coaching`). Screenshots in Chromium (Playwright, `/opt/pw-browsers`) at 390x844, 360x640, 820x1180, 844x390 (landscape) and 390x450 (a phone with the keyboard open), 2x device scale, mobile + touch. Every screen and state of the step was driven through real clicks and typing: Welcome (plain, after sign-out, account-deleted notice, password-changed notice), Sign in (empty, email focus, hidden password typing, password shown, validation, wrong password, offline, server down, 500, loading), Create account (empty, validation, weak password, email taken, password focus, loading), the celebration on Home, Home, Delete confirmation (+ offline error), Forgot password (+ offline, + sent), Reset password (form, short password, invalid link, invalid link while signed in). Offline via `context.setOffline`, server down via an aborted route, 500 and slow answers via fulfilled/delayed routes, reduced motion via `reducedMotion: 'reduce'`.

Before-screenshots are QA's round-2 set in `docs/build/screenshots/qa/step-02/r2/` plus a few of my own taken at the start (`design/step-02/before-*.png`). After-screenshots are in `docs/build/screenshots/design/step-02/` (every state at 390x844, the key states at the other four viewports, and contact sheets `sheet-*.png`).

**Commits (not pushed).**
- `3f79891` Give fields a focus halo and let messages and notices reveal themselves
- `09d866e` Let the croc bob when its mood changes and celebrate with petals and sparkles
- `c9b38bd` Compose the account screens around their content and celebrate a new account
- plus this report, the backlog update and the after-screenshots

**Checks.** `npm run check` green (typecheck, lint, 195 unit tests; 3 new). `npm run e2e` green: 72 tests across phone-390, phone-360 and tablet-820. No page errors or console errors on any screen at any viewport (the only console entries are the browser's own resource logs for the deliberately failed requests: 401, 409, 400, 500, connection refused). Auth logic, session handling, data flow, `src/services/auth` and `server/` untouched. All testIDs kept. No copy added or changed.

## 1. Review

Judged against production sign-in flows in illustrated, gamified apps (the category the concept aims at), step 2 was functionally complete and already careful about errors, focus and keyboards (QA's two rounds show that), but visually it was a form on a white sheet with a thin strip of river on top:

- **The sheet, not the river, owned the screen.** The auth layout fixed the scene at 30% of the height, whatever the form needed. Short screens (Forgot password, Check your email, Set a new password, the invalid-link state) ended in a white block of 35 to 40% of the screen (QA m7), while the croc stayed small. On the tablet the effect was worse: a 300px band over an 880px sheet.
- **Landscape was the portrait layout squeezed.** At 844x390 the band took half the height and the form started below the fold; the croc was barely visible.
- **With the keyboard open** (390x450) the croc sank under the sheet, so the one moment where its reaction matters most (typing a password) could happen without the croc in view.
- **Reactions and messages were jump cuts.** The croc's expression swapped instantly, errors, notices and the "Sign in instead" button popped in, and the delete confirmation replaced the sheet with no motion. On web there is no stack transition either, so every navigation was a hard cut.
- **The celebration was quiet.** An excited croc with three tiny built-in sparkles and a chip. For the one moment the brief singles out ("celebrates on successful sign-up") it did not feel like a celebration.
- **Repetition.** The shared-account card appeared on Welcome, Sign in and Create account in the same large form, pushing the switch links ("No account yet?") below the fold at 360x640.
- **Fields** were correct but flat: focus only changed the outline colour, errors only the outline and a caption.

What was already right and is kept: the field anatomy and messages, the croc closing its eyes for a hidden password and opening them when it is shown, "never sad" on errors, disabled links while a request runs, the Retry feedback, the keyboard focus handling in the delete confirmation, the daylight palette and the Baloo/Nunito pairing.

## 2. What I polished

### QA m7 (designer item): the river takes what the form leaves free. Fixed.

`AuthScaffold` now composes each screen from its content. The sheet's natural height is measured once per window height (the form as it first shows, so a message appearing later pushes the sheet and never resizes the scene), and the river band grows into the remaining space, from a third of the screen up to 60% of it. The croc is sized to the band with `fitPeekCroc` (the same fit Welcome and Home use), so a bigger band means a bigger croc, with lily pads and the far reeds appearing when there is room. Forgot password's "sent" state and Reset password's invalid-link state remount the scaffold (a `key`) so the scene is recomposed for the shorter content.

| Screen | Before | After |
|---|---|---|
| Forgot password 390x844 | `before-forgot-390x844.png` (sheet ends at 65%) | `forgot-390x844.png` |
| Check your email 820x1180 | `before-forgot-sent-820x1180.png` | `forgot-sent-820x1180.png` |
| Set a new password / invalid link 390x844 | `qa/step-02/r2/reg-reset-invalid-390.png` | `reset-390x844.png`, `reset-invalid-390x844.png` |
| Sign in 820x1180 | `qa/step-02/r2/reg-signin-820.png` | `signin-820x1180.png` |

Sign in and Create account at 390x844 keep their compact band because their forms need the height; nothing scrolls that did not scroll before.

### Landscape: two columns

At 844x390 (and any landscape viewport from 600px wide) the form is a floating card on the left column (max 480px) with the back button fixed above it, and the croc swims on the right of a full-screen lagoon, matching Welcome and Home in landscape. Before: `before-signin-844x390.png`. After: `signin-844x390.png`, `forgot-844x390.png`, `forgot-sent-844x390.png`, `reset-invalid-844x390.png`, `sheet-landscape-844x390.png`.

### Keyboard-open viewports

When the viewport is shorter than 560px the band keeps a smaller minimum (132px), the croc sits beside the back button (its head is to the right of it) and keeps less water under it, so its eye and brow stay above the sheet while a password is typed. Before: `before-signin-390x450.png` (croc hidden). After: `signin-390x450.png`, `signin-password-typing-390x450.png`, `forgot-390x450.png`.

### Transitions and arrival

- The scene fades in once the band is composed (or after 400ms if layout never reports), so the first-frame resize after the measurement is never seen.
- On web, which has no stack transition (I probed it: the old screen is gone and the new one fully drawn in the same frame), the sheet now rises and fades in on arrival on every account screen and on Home. Native stacks animate the whole screen, so there it stays a plain View. Frames: `web-entrance-frames-390x844.png`.

### The croc's reactions and the celebration

- **Reaction bob** (`Croc.tsx`): a change of expression plays a 120ms dip and a springy rise (plus a 2.5% scale), so closing its eyes, perking up on focus or getting excited reads as a reaction rather than a swapped picture. Not on first render, not for the egg, still under reduced motion.
- **CelebrationBurst** (new scene piece): 24 water-lily petals, amber four-point sparkles and bubbles burst from the croc's head, staggered, easing out, petals falling a little and bubbles rising as they fade over 2.2s. `Lagoon` takes a `celebrate` flag and `LagoonSheetScreen` passes it through; Home plays it with the excited croc for the 2.8s celebration while the "Account created" chip drops in from above. Under reduced motion the pieces appear spread out and fade without flying (`reduced-motion-sheet-390x844.png`). Before: `before-home-celebrate-390x844.png`. After: `home-celebrate-390x844.png`, `home-celebrate-late-390x844.png`, `home-celebrate-late-820x1180.png`, `home-celebrate-late-844x390.png`.

### Fields, errors and notices (design system)

- **TextField**: a 4px soft halo in the focus colour while editing and in the error colour when invalid (`withAlpha` on the theme colours, so night will follow automatically), the field brightens to the surface tone on focus, and the hint or error reveals itself (fade + 4px lift) instead of popping in. Before: `before-signin-password-typing-390x844.png`. After: `signin-password-typing-390x844.png`, `signup-email-taken-390x844.png`, `signin-validation-390x844.png`.
- **Notice**: a hairline in the edge colour, the icon in a 32px tinted well, and the same reveal. After: `signin-wrong-password-390x844.png`, `signin-offline-390x844.png`, `signin-server-down-390x844.png`, `forgot-sent-390x844.png`, `welcome-password-changed-390x844.png`.
- **Reveal** (new `src/ui` primitive): fade and lift on mount, instant under reduced motion, with `onLayout` passthrough so layouts that measure their sheet keep working. Used by the field messages, notices, "Sign in instead", the delete confirmation, the celebration chip and the web sheet entrance.
- **SharedAccountNote** gets a `compact` variant: a small badge and the one-line caption under the primary button on Sign in and Create account. Welcome keeps the full card, where the explanation is the point. The switch links now fit above the fold at 360x640 (`signin-360x640.png`).

### Accessibility and motion

Unchanged behaviour: all new scene pieces spread `decorative`; the error notice keeps its `alert` role and assertive live region inside the Reveal wrapper; the field message keeps its `nativeID` for `aria-describedby`; tap targets unchanged (44px); text tones unchanged, so QA's AA audit still holds (the halos and tints are decorative). Reduced motion: Reveal is instant, the croc does not bob, the burst does not fly, the scene does not fade; checked with `reducedMotion: 'reduce'` on Sign in, validation errors, the celebration (two frames 500ms apart are identical), the delete confirmation and Welcome's notice (`reduced-motion-sheet-390x844.png`). The e2e reduced-motion test passes.

## 3. Remaining issues

No BLOCKER or MAJOR.

- **MINOR** Web has no cross-screen transition; the per-sheet entrance covers the hard cut, but a slide between account screens and a fade on sign in / out need router-level animation on web. Backlog.
- **MINOR** Landscape forms: the fixed back button overlaps the card when a tall form (Create account with errors at 844x390) scrolls under it. Acceptable; a top fade on the column would be cleaner. Backlog.
- **MINOR** The band is composed from the first measured sheet height per window height; a screen that swaps to much shorter content without a `key` would keep the longer form's band. Documented in the component and the backlog.
- **Not tested**: native iOS and Android (`KeyboardAvoidingView` with the grown band, the native stack animation together with the scene fade, Reanimated layout of the burst on device); Safari and Firefox.

VERDICT: PASS
