# Step 2 QA, round 1

Tester: QA engineer agent. Build: a fresh `expo export --platform web` of `ac5e40f` with `EXPO_PUBLIC_DEV_MODE=1` (the same as `npm run build:web`; `check-web-build` OK). I exported to a scratch folder instead of `dist/`, so the reviewer's build could not overwrite it. It was served the same way as `npm run serve:web` (`serve --single`, port 4173). API: `server/` on port 4000 with the default DB (`server/data/dev.sqlite`), first with the defaults and then with `ACCESS_TOKEN_TTL_SECONDS=60`. Browser: Playwright Chromium from `/opt/pw-browsers`, at 390x844 and 360x640 (mobile, touch) and 820x1180 (tablet), plus a desktop-style context (no touch) for the keyboard tests. I used real clicks and typing, Enter/Tab/Space, reloads, browser back and forward, two tabs, `context.setOffline`, a stopped API server, route-level delays and 5xx answers, and emulated `prefers-reduced-motion`.

Screenshots: `docs/build/screenshots/qa/step-02/`.

## Acceptance criteria

| Criterion | Result |
|---|---|
| Server tests pass; app check, build and e2e pass | `npm run server:test`: 51/51 pass (typecheck + tests). Web export and `check-web-build` OK. I left `npm run check` and `npm run e2e` to the code reviewer, because e2e uses the shared default ports (4273/4274). |
| A user created with the coaching-client script can sign in to the app with the same credentials | **Met.** `npm run create-user -- --email ann@example.com --password "river walk 1" --name Ann` created the user with signup client `mhp-coaching`. Signing in to the app as `"  ANN@Example.com "` worked and showed "Hi, Ann" (`16-coaching-user-home.png`). `user_clients` now has rows for both `mhp-coaching` and `mhp-hypnose`, with first and last sign-in times. Running the script again for the same email reports `409 email_taken`. Mixed-case email plus a padded name (`"  Bob  "`) is stored normalised (`bob.upper@example.com`, `Bob`). |
| Reload keeps you signed in; an expired access token refreshes silently; a revoked refresh token signs you out cleanly | **Partly met.** Reload keeps you signed in at every viewport. With a 60 s TTL, an action after 70 s idle refreshes first and then succeeds (`POST /auth/refresh 200` → `DELETE /me 204`). After a server restart (new JWT secret), a 401 triggers one refresh and one retry, which succeeds. If the refresh token is revoked out of band, a reload or the next call lands on Welcome with "You were signed out. Sign in again to continue." (`18-revoked-welcome-notice.png`). **However, normal use also revokes the session: two open tabs, or a reload while a refresh is in flight, signs the user out (M1).** |
| Offline and server-down states are handled with a clear message and retry | **Met.** Sign in, sign up and forgot password all show "You are offline…" (offline) or "The server cannot be reached right now…" (connection refused, 502 HTML from a proxy, or no answer within 15 s), each with a Retry button. A 500 shows "Something went wrong on our side…" with Retry. Retry after the server comes back signs you in. A signed-in user who reloads while the server is down stays signed in on the cached profile. Delete with the server down shows the error inline, and the button itself acts as retry. Sign-out with the server down still signs out locally at once (`22-…`, `23-…`, `25-…`, `26-…`, `27-…`). |
| Delete account removes the user; signing in afterwards fails with the normal error | **Met.** The confirmation is in-page and explains that the shared MHP account is deleted. After confirming, Welcome shows "Your account was deleted.". The user row is gone from `users`. Signing in again gives "Email or password is incorrect." (`13-…`, `14-…`, `15-…`). |
| All screens pass the design rules (palette, atmosphere, croc present, 44px targets, AA contrast) at 390x844 and 360x640 | **Met.** I ran an automated audit on every screen and state (index, welcome, sign-up, sign-up with errors, sign-in, forgot, forgot sent, home, delete confirm) at 390, 360 and 820. No interactive element is under 44x44, no text fails AA against its background, and there is no horizontal scroll. The croc is present on every screen. Daylight palette and atmosphere are used throughout (`40-*`). |

## What works well

- Croc reactions. Eyes close while a hidden password is typed (`05-…`). The croc opens its eyes when the password is shown. It perks up on focus, stays calm on errors and gets excited with sparkles and an "Account created" chip after sign-up (`08-…`). With reduced motion, the scenes hold still (1 distinct frame out of 8, against 8 out of 8 without it) and the expressions still change.
- Errors are clear and in the right place. Field errors sit under the field with an icon and a red border. Focus moves to the first invalid field. "Email taken" offers "Sign in instead", which carries the email over. Wrong password and unknown email give the same message. Rate limiting gives "Too many attempts. Wait a minute, then try again." (`46-…`, `36-name-emoji-360-fail.png`).
- No double submit. Three clicks plus two Enters on a slow (3 s) sign-up sent exactly one `POST /auth/signup`. Fields go read-only and the button shows a spinner with `aria-busy` (`28-…`, `45-…`).
- Keyboard. The tab order is logical on every screen. Enter moves Name → Email → Password and Enter in the password field submits. The visibility toggle is reachable, has a visible focus ring (`42-…`) and toggles with Space. Autofill hints are correct (`email`, `current-password`, `new-password`, `name`).
- Route guards. Signed out, `/home` redirects to Welcome. Signed in, `/`, `/welcome`, `/sign-in`, `/sign-up` and `/forgot-password` all redirect to `/home`. Browser back after sign-in or sign-out never shows the other side.
- Odd input. Emoji, Arabic, HTML-looking and 50-character names render safely. A single 48-character word truncates to two lines with an ellipsis, with no overflow at 360 (`36-name-*`). A name made only of spaces falls back to the email's local part. A corrupt or forged stored session is handled: forged leads to "You were signed out".

## Findings

### M1. MAJOR: Normal use triggers refresh-token reuse detection and signs the user out (two tabs, or a reload during a refresh)

The web client keeps the refresh token in memory and rotates it on every page load, because the access token is not persisted. Nothing coordinates the token between tabs or page loads, so the server's reuse detection fires on legitimate use and revokes the whole family.

**Repro A (deterministic, two tabs):** with `ACCESS_TOKEN_TTL_SECONDS=60`; with the default TTL it happens within about 14.5 minutes.
1. Sign in in tab A.
2. Open the app in tab B (or reload B). B refreshes, the token rotates R1→R2, and B stores R2.
3. Leave tab A alone for more than 30 s, then do anything in A that calls the API (here: Delete account → confirm).
- **Actual:** A sends its stale R1, gets `POST /auth/refresh 401`, and lands on Welcome with "You were signed out". A also clears the shared localStorage, so reloading **tab B shows Welcome with no notice at all**. The user is signed out everywhere, and the action they asked for (here: deleting the account) is silently not done.
- Network log: `B POST /auth/refresh 200`, then `A 38.9s POST /auth/refresh 401`.
- **Screenshots:** `20-two-tabs-A-after-action.png`, `21-two-tabs-B-after-reload.png`

**Repro B (race, slow network):**
1. Sign in.
2. Reload. While that reload's `POST /auth/refresh` is still on its way back (I held the response 2.5 s), reload again. This is the same as closing the tab, killing the app or losing signal mid-refresh.
- **Actual:** The server has already rotated the token, but the new one never reached storage. The next load sends the old token, gets 401, and the user is signed out with "You were signed out".
- **Screenshot:** `47-double-reload-slow-refresh.png`

- **Expected:** Two tabs, a quick double reload or an app kill during a refresh never sign the user out. Only a real revocation does, as the brief requires ("revoked refresh token signs you out cleanly", not "any interrupted refresh"). Possible fixes, for the engineer to choose: re-read the stored refresh token before refreshing and adopt a newer one; sync tabs with the `storage` event or BroadcastChannel; or give the server a short grace window in which the just-rotated token returns the same successor instead of revoking the family. Native has the same Repro B exposure on every cold start, because every launch refreshes.

### m1. MINOR: Double-tapping "Sign out" opens Sign in
- **Steps:** On Home at 390x844, double-tap "Sign out".
- **Actual:** The first tap signs out. The second tap lands on Welcome's "Sign in with MHP account", which sits in almost the same spot, so the user ends up on Sign in (`/sign-in`) instead of Welcome.
- **Expected:** Land on Welcome.
- **Screenshots:** `30-signout-dbl.png` (vs `30-signout-single.png`)

### m2. MINOR: The logged reset link leads to "Page not found"
- **Steps:** Forgot password → Send link, then open the `resetLink` from the server log (`http://localhost:4173/reset-password?token=…`).
- **Actual:** "Page not found" (`32-reset-link-target.png`). The flow ends in a dead end for anyone testing it. A reset-completion screen is not in this step's scope, so this is MINOR. Either add a placeholder route or note it in the backlog for when the real account service hosts the reset page.

### m3. MINOR: Opening the delete confirmation drops keyboard focus to the page
- **Steps:** Keyboard only: focus "Delete account" and press Enter.
- **Actual:** `document.activeElement` becomes `<body>`. The next Tab goes straight to the destructive "Delete my account" button. A screen reader does not announce the "Delete account?" heading or body. Cancelling also drops focus to `<body>`.
- **Expected:** Focus moves to the confirmation heading (or "Keep my account"), and back to "Delete account" on cancel.
- **Screenshot:** `43-kbd-delete-confirm-focus.png`

### m4. MINOR: Retry gives no feedback when it fails again
- **Steps:** Offline (or server down), tap Sign in, then tap Retry while still offline.
- **Actual:** The same notice reappears within a few ms, so nothing on screen changes and it looks like the button did nothing.
- **Expected:** Brief visible feedback, for example the Retry or Sign in button showing its loading state for a moment, or the notice re-animating.

### m5. MINOR: Signing out while the server is unreachable leaves the refresh token valid on the server
- **Steps:** Signed in, stop the server, tap Sign out.
- **Actual:** You are signed out locally (good). `POST /auth/signout` fails with connection refused and is never retried, so the refresh token stays valid server-side for its 30-day lifetime.
- **Expected:** Acceptable for the dev stand-in. Consider queueing the revoke for the next time the server is reachable.

### m6. MINOR: Links stay active while a sign-in is pending
- **Steps:** Slow network: tap Sign in, then tap "Forgot password?" or "Create account" while the spinner shows.
- **Actual:** The app navigates away. When the response arrives, the user is jumped to Home from the screen they navigated to (`45-signin-pending-long.png` shows both links still enabled).

### m7. MINOR: Large empty sheet on short-content auth screens (designer call)
On Forgot password, "Check your email" and Sign in, the white sheet ends in a large empty block: about 35% of the screen at 390x844 and about 40% at 820x1180. The croc scene above stays small. `37-forgot-390.png`, `38-forgot-sent-390.png`, `40-signin-820.png`, `40-forgot-sent-820.png`.

## Not tested / notes

- Native-only behaviour: `expo-secure-store`, the iOS/Android keyboard (return-key types, scrolling the focused field into view), native autofill and password-manager save prompts, and Android back. Only the web build runs here.
- Password-manager "save password" on web: not testable headless. Note that the inputs are not inside a `<form>`, which some managers rely on.
- Real email delivery: by design, the reset link is only logged.
- `npm run check` and `npm run e2e`: left to the code reviewer (shared e2e ports).
- Process note: early on, one of my `pkill -f src/index.ts` calls matched every process with that path. When I checked, nothing else was listening on 4400, and the server log shows that only my server shut down. After that I stopped servers by PID only.

VERDICT: CHANGES REQUIRED
