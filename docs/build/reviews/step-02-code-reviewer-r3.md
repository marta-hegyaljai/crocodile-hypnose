# Step 2 (Accounts): code review r3 (verification)

Scope:
- Verify the fixes for r2 MINOR #1 (a grace-window fork of a session) and #2 (data crossing from one account to another): commits e14b6d3 and 1fd9947.
- A quick regression read of both commits, including the QA n1/n2 reset-screen changes.
- Designer UI commits ignored.

Ran:
- `npm --prefix server run check`: 63/63 pass.
- `npm run check`: typecheck, lint and 192/192 Jest tests pass.
- The r2 alternating-refresh probe again, as a throwaway script on an in-memory server, deleted afterwards. No servers on any port.

## r2 #1, grace-window fork: fixed
`reissueRefreshToken` now retires the displaced successor with `used_at` only, leaving `replaced_by` NULL. That token therefore never gets a grace window of its own. The original token still points at the new one, so a lost-response retry keeps working.

Probe, re-run:
- Legit rotates T1. An attacker replays T1 at +30 s and gets 200.
- The legit holder refreshes 55 s later: **401 `refresh_token_reused`**, and the session is revoked. The attacker's token gets 401 as well.
- The fork no longer happens.

Regression checks:
- Retrying the original token after a lost response works twice within the window (200, 200), and the latest pair keeps rotating.
- A token displaced by those retries is refused as reuse.

Tests: the "racing tabs" test now expects the displaced token to count as reuse. A new test covers replay followed by the legit refresh, and asserts the session ends for both (refresh and `/me`).

## r2 #2, data crossing between accounts: fixed
- **`refreshProfile`** records the user id it asked for. It drops the answer if the account on screen changed or the profile belongs to someone else.
- **The store's `user` event** is applied only for the same user id.
- **`rememberUser`** persists only when `stored.user.id === user.id`.
- **`exchange`** pins the user id at the start. If the store (at the start, or on the refusal fallback) holds another account's session, `switchedAccount()` switches to it: it bumps the generation, clears the access token and the in-flight refresh, and emits `signedIn`. It then throws `session_ended`, so the original request never receives the other account's tokens. It also refuses a refresh result whose user differs.
- `withAccessToken` passes that `session_ended` on without wiping the store (it comes from `refresh()`, not from the second-401 path). That is correct, because the store now legitimately holds B.
- Tests:
  - sessionTabs: with no storage events, the action is only ever called with A's token; the tab then works as B.
  - sessionTabs: a late profile for another account is not saved.
  - authStore: in the two-tab race, A's late profile does not land in tab 1, in storage, or in tab 2.

## Regression read
- `deleteAccount` now sets `actionInterrupted` only when the session actually ended (signed out). After an account switch the error goes to the screen instead.
- Reset screen:
  - A missing or overlong token is shown as an invalid link straight away.
  - A server field error on `token` (malformed) also counts as an invalid link.
  - Signed-in users get an explanatory note and "Go to home" (`/home`, inside their guard) instead of "Request a new link", which pointed into the signed-out-only flow.
  - The copy lives in `en.ts`.
- No issues.

## Findings

### 1. After a missed account switch, the delete confirmation stays open for the new account
- Severity: MINOR
- Where: `src/app/(app)/home.tsx` (`confirmingDelete` and `deleteError` are component state that survives a `user` change), together with the new `switchedAccount` path in `src/services/auth/sessionManager.ts`
- Problem and impact:
  - This only happens when a tab misses the storage events. Normally the switch passes through "signed out", which unmounts home.
  - In that case, tab 1 shows A's delete confirmation, and the user taps "Delete". The request correctly fails with `session_ended`, and the tab switches to B.
  - But home stays mounted with the confirmation still open, showing a "session ended" error, now over B's name.
  - A second tap on "Delete" would then delete B's account.
  - The header does show B, and missing the events is rare.
- Fix: reset `confirmingDelete` and `deleteError` when `user.id` changes, for example by keying the home screen on `user?.id` in the layout, or with an effect on `user?.id`. Backlog is fine.

VERDICT: PASS
