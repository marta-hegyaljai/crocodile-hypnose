# Step 2 QA, round 2 (re-verification)

Tester: QA engineer agent.

**Build:** a fresh `expo export --platform web` (dev mode) of `4927b79`, which includes fixes `f4855b2`, `21a84b5` and `4927b79`. `check-web-build` OK. It was served like `npm run serve:web` on port 4173.

**API:** `server/` on port 4000 with `ACCESS_TOKEN_TTL_SECONDS=60`. It ran on the existing round-1 `dev.sqlite`, so the schema v2 migration ran in place. Users created in round 1 (Ann, Bob) still sign in.

**Browser:** Playwright Chromium at 390x844, 360x640 and 820x1180. I stopped servers by PID only.

**Screenshots:** `docs/build/screenshots/qa/step-02/r2/`.

`npm run server:test`: 62/62 pass.

## Round-1 findings

| # | Finding | Result |
|---|---|---|
| M1 | Rotation and reuse detection signed users out (two tabs, reload during a refresh) | **Fixed.** Details below. |
| m1 | Double-tapping Sign out opened Sign in | **Fixed.** Double-click on Sign out (3 times), double-click on Sign in (3 times), a touch double tap 150 ms apart and a double-click on Get started all land on the right screen. A deliberate second tap 400 ms later still works normally. |
| m2 | Reset link led to "Page not found" | **Fixed.** Details below. |
| m3 | Focus dropped to the page when the delete confirmation opened | **Fixed.** Focus moves to the "Delete account?" title. Tab order is now Keep my account, then Delete my account (the safe button comes first). Cancel returns focus to "Delete account" (`m3-delete-confirm-focus.png`, `m3-after-cancel-focus.png`). |
| m4 | Retry gave no feedback when it failed again | **Fixed.** Retry while still offline shows the button spinner (`aria-busy`) for about 550 ms before the notice returns (`m4-retry-busy.png`). |
| m5 | Sign-out while offline does not revoke on the server | Backlog, not re-tested. |
| m6 | Links stayed active while a sign-in was pending | **Fixed.** On Sign in, Create account and Forgot password, every in-app control is disabled while a request runs: Back, the password toggle, Forgot password, the switch links and Back to sign in. Force-clicking them does not navigate (`m6-signin-pending.png`). |
| m7 | Empty space on short auth screens | Designer's item, not re-raised. |

### M1 in detail (all with a 60 s access-token TTL)

Across every scenario I saw no `401` on `/auth/refresh` and no unexpected sign-out.

- **Stale tab, the original repro.** A signs in. B opens and reloads, which rotates the token twice. After 35 s, A deletes the account. A refreshes (`200`) and `DELETE /me` returns `204`, so A shows "Your account was deleted". B, without a reload, follows to Welcome with "You were signed out…" (`m1-t1-staletab-delete-A.png`, `-B.png`).
- **Stale tab past the 60 s grace window.** Same setup, but A reloads 70 s after B's rotation and stays signed in. A picks up the stored newer token. B also reloads and stays signed in.
- **Tabs follow each other.**
  - Signing out in B moves A to Welcome without a reload (`m1-t2-A-follows-signout.png`).
  - Signing in again in A moves B to Home.
- **Three tabs at once.** Three tabs opened together on a stored session with no access token:
  - All three show Home.
  - Reloading all three at once: all stay on Home.
  - Reloading all three at once again after the access token expired: all stay on Home.
- **Reload during a slow refresh.** The refresh response was held for 2.5 s while I reloaded again, 3 rounds in a row. The user stays signed in, and Home is back about 0.2 s after the second reload.
- **Tab closed during a held refresh.** A new tab opens signed in. Reloading it 65 s later (past the grace window) still works.
- **Server restart (new JWT secret) with two tabs.**
  - A reloads and stays signed in.
  - B's delete refreshes and then succeeds.
  - A follows B to Welcome.
- **Real reuse is still caught.** Checked with direct API calls: R1→R2, then R2→R3, then R1 again gives `401 refresh_token_reused`, after which R3 is refused too (`invalid_refresh_token`).

### m2 in detail (password reset end to end)

- **Full flow.**
  - Forgot password, with the email typed in uppercase. The server log has the `resetLink`.
  - Opening `/reset-password?token=…` shows "Set a new password" (`m2-reset-screen-390.png`). A short password gives "Use at least 8 characters.".
  - Saving goes to Welcome: "Your password was changed. Sign in with your new password." (`m2-welcome-password-changed.png`).
  - The old password is then refused and the new one signs in.
- **Other sessions end in both apps.**
  - The account was created and signed in with client `mhp-coaching`. After the reset, its refresh token gives `401` and its access token gives `/me 401`.
  - A second app browser session, signed in on "another device", lands on Welcome with "You were signed out…" on reload.
- **Bad links.**
  - **Used link:** "This reset link is not valid any more. Request a new one." (`m2-used-link-result.png`).
  - **Expired link** (`PASSWORD_RESET_TTL_SECONDS=3`): same message. "Request a new link" opens Forgot password (`m2-expired-link.png`).
  - **Garbage token:** the form shows, and submitting it gives the same invalid-link message (`m2-garbage-link.png`).
  - **No token:** the invalid state shows straight away.
  - **Older link after a newer one was used:** refused (`400 invalid_reset_token`).
- **Valid link opened while signed in:** saving signs the user out and shows the "password changed" notice.

## New findings

### n1. MINOR: "Request a new link" does nothing for a signed-in user
- **Steps:**
  1. Signed in, open a used, expired or missing-token reset link, e.g. `/reset-password`.
  2. Tap "Request a new link".
- **Actual:** Nothing happens. `/forgot-password` is guarded for signed-out users only, so the replace is refused and the user stays on the invalid-link screen. The only way out is the Back button.
- **Expected:** The button leads somewhere: Home, a short "you are already signed in" message, or a hidden button.
- **Screenshot:** `m2-request-new-signed-in.png`

### n2. MINOR: An over-long reset token shows a generic error instead of "link not valid"
- **Steps:** Open `/reset-password?token=` followed by 5,000 characters (for example, a link mangled by a mail client), enter a valid password and save.
- **Actual:** "Something went wrong. Try again." with a Retry button. The server answers `400 invalid_request`, with `fields.token`. Retry can never succeed.
- **Expected:** The same "This reset link is not valid any more" state as for any other bad token.

## Regression sweep

- **Main flow** at 390: sign-up with the croc reacting (eyes closed while typing the password, celebration on sign-up), reload, sign-out, wrong password, sign-in, delete, and sign-in after delete with the normal error. All pass.
- **Coaching account:** a new user created with `create-user` (Cara) signs in. Round-1 users still sign in after the migration.
- **Offline and server down:** sign in, sign up, forgot password and delete all show the right message with Retry. Retry after recovery signs in. A reload with the server down keeps the cached session. Sign-out works offline.
- **Keyboard:** tab order, Enter moving to the next field, submit on Enter, the password toggle with Space, and delete-confirmation focus. All pass.
- **Reduced motion:** 1 distinct frame out of 8, against 8 out of 8 without it.
- **Design-rule audit**, on every screen and state including both reset states, at 390, 360 and 820: no tap target under 44px, no AA contrast failures, no horizontal scroll (`reg-*`).

## Not tested

Native-only behaviour (secure store, cold start on a device, Android back, native keyboards), as in round 1. `npm run check` and `npm run e2e` are left to the code reviewer.

VERDICT: PASS
