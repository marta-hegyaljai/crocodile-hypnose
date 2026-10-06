# Step 2 (Accounts): code review r2

Diff: `ea9734f..HEAD` (commits f4855b2, 21a84b5, 4927b79; docs excluded). This round fixes QA M1 and code review r1 #1, #2, #4 and #7.

Ran:
- `npm --prefix server run check`: 62/62 pass.
- `npm run check`: typecheck, lint and 186/186 Jest tests pass.
- A throwaway script against an in-memory server (deleted afterwards) to probe the reuse grace window.

No servers were started and no source files were edited.

## What I checked

**Server reuse grace window** (`auth-service.ts` refresh, `sqlite.ts` `reissueRefreshToken`).
- At most one live (unused) token exists per session at any time. A grace re-issue retires the unused successor in the same transaction (`… WHERE used_at IS NULL`), so the session family can never hold two live tokens.
- Only the immediate predecessor qualifies. Once the successor has been used, presenting the older token revokes the session (tested).
- The grace window is measured from the presented token's own `used_at`, which a re-issue does not move forward.
- Revoked sessions, expired tokens and tokens from another client are refused before the grace path runs.
- A token used before the migration has `replaced_by = NULL`, so it never qualifies and stays fatal on reuse.
- One weakness remains (finding 1).

**v1→v2 migration.**
- Migrations run in order, one transaction each, with `PRAGMA user_version` set inside the same transaction.
- The server refuses a database newer than itself and stops if a migration is missing.
- `ALTER TABLE … ADD COLUMN` is portable to Postgres.
- The upgrade of an existing v1 database is tested.
- No issues.

**Password reset confirm.**
- The token is 256-bit and stored only as SHA-256. The lookup is by hash.
- It is single use: an atomic `UPDATE … WHERE used_at IS NULL` sets the password, marks every other open reset link of the user used, and revokes all of the user's sessions in both clients, all in one transaction.
- Expiry is checked.
- Every token failure gives the same answer (`invalid_reset_token`, 400) and reveals nothing about the account.
- The weak-password check runs before the token lookup, so it leaks nothing.
- The only timing difference is valid vs. invalid token (scrypt runs only for a valid one). That is useless against a 256-bit space.
- The endpoint is rate limited.
- Deleting the account cascades its resets.
- The app ends the local session, other tabs follow via the storage event, and Welcome says the password changed.
- No issues.

**Cross-tab lock and storage events.**
- The Web Locks API serialises exchanges across tabs, and each exchange re-reads the store inside the lock, so a stale tab adopts the token another tab already rotated.
- The new token is persisted before the lock is released.
- After a refusal, a newer stored token gets one retry; the loop is bounded to 2 attempts.
- `endLocally(refused)` only clears the store if it still holds the refused token.
- The storage-event handler never writes, so there are no echo loops.
- The generation counter aborts exchanges started for a session that has since ended or switched.
- I found no deadlock: no lock holder takes the lock again.
- One race remains around switching accounts (finding 2).

**450 ms tap shield.**
- It is an absolute empty `View` overlay. It is not an accessibility element, so it can't take screen-reader focus.
- It is not focusable and doesn't intercept keyboard input (web Enter/Space still reach the focused control).
- It always clears on its timer.
- It fires only right after Get started or a sign-in status change, when the screen under the finger is being replaced anyway.
- A deliberate tap 450 ms after a full screen swap is not realistic, and a VoiceOver/TalkBack user can't move focus and double-tap that fast.
- No issues.

## Findings

### 1. Two holders of one session can keep displacing each other forever without triggering reuse detection
- Severity: MINOR (dev stand-in; the app refreshes about every 15 minutes, so detection still fires in practice). It is a one-line fix, so I recommend doing it in this round.
- Where: `server/src/storage/sqlite.ts:236-249` (`reissueRefreshToken` sets `used_at` **and** `replaced_by` on the retired successor), `server/src/auth-service.ts:205-217`
- Problem and impact:
  - **The flaw.** Retiring a successor gives that successor its own fresh grace window. Its `used_at` becomes "now" and its `replaced_by` points at the new token, so whoever holds the retired token can present it within 60 s and displace the other holder in turn.
  - **What I verified.** Legit rotates T1. An attacker replays the stolen T1 at +30 s. After that, both sides refresh every 55 s: 12 alternating refreshes all returned 200, and the session was never revoked. So the session family forks indefinitely as long as each side refreshes within 60 s of being displaced.
  - **Practical exposure.** Today the legitimate app refreshes every ~15 minutes, or on each web reload, so its next refresh usually lands after the grace window and revokes the session as intended. The exposure is a web user who reloads often while someone else holds a stolen token.
  - **Racing tabs.** The case "racing tabs both get a working pair" doesn't need this behaviour: Web Locks serialise tabs, and the lost-response retry only ever presents the original token.
- Fix: don't give retired successors a grace window. In `reissueRefreshToken`, retire the successor with `used_at = ?` and leave `replaced_by` NULL; the `withinGrace && latest.replacedBy` check then refuses it. Keep `previous.replaced_by = next.id` so a retry of the original token still works within its original 60 s. Update the "racing tabs" test so the displaced token (`a`) counts as reuse, and add a test that an attacker replay followed by the legit holder's refresh can't alternate.

### 2. A late profile response or an adopted token can cross from one account to another
- Severity: MINOR (needs a sign-out plus sign-in in another tab while a request is in flight, or a missed `storage` event). The damage would be bad (the UI and an action pointing at different accounts), so I recommend this cheap fix now or at the start of step 4.
- Where: `src/services/auth/authStore.ts:113-119` (`refreshProfile`), `src/services/auth/sessionManager.ts:243-249` (`rememberUser`), `:112-117` and `:129`/`:150-152` (`exchange` adopts a stored session for another user and carries on)
- Problem and impact: three paths can mix accounts.
  - **`refreshProfile`.** Tab 1 (account A) starts `getProfile` on a slow network. Meanwhile tab 2 signs out and then signs in as B. Tab 1 follows both events and is now signed in as B. Then A's profile arrives, and the only check is `status === 'signedIn'`, which passes. Tab 1 shows A's name over B's session.
  - **`rememberUser`.** It then adopts B's stored token and persists `{ ...B, user: A }`. Tab 2 sees a "switched" user and also displays A while holding B's tokens. If the user then deletes "their" account, B is deleted.
  - **`exchange`.** `adopt()` accepts a stored session for a different user without bumping `generation`. If the clear event is missed (a frozen tab, or the memory fallback), a refresh started for A can return B's access token to the action that asked for it.
- Fix:
  - `refreshProfile`: remember `get().user?.id` before the call, and drop the result if `user.id` differs or the state's user changed.
  - `rememberUser`: do nothing when `stored.user.id !== user.id`.
  - `exchange`: if the adopted session belongs to a different user than when the exchange started, bump `generation`, emit `signedIn` for the new user, and throw `session_ended` instead of continuing.
  - Add one sessionTabs test for the account-switch path.

## Notes (not findings)
- Already logged in the backlog (r1 #2, not re-raised): a refresh cut off by an app kill, with a relaunch more than 60 s later, still signs the user out. The grace window covers reloads and retries.
- `revokeAllSessions` in the repository is unused. `completePasswordReset` revokes inline. Harmless.
- The Playwright API server now runs through a shell redirect. Playwright kills the whole process group on POSIX, so it doesn't leave a stray server behind.

VERDICT: PASS
