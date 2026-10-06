# Step 2 (Accounts): code review r1

Diff: `547d315..HEAD` (docs and screenshots excluded). Read: PLAN, LOOP, BACKLOG, step-02 brief, all of `server/src`, `server/test`, `src/services/auth/*`, the account screens, route guards, e2e config.

Ran: `npm --prefix server run check` (typecheck + 51 tests, all pass) and `npm run check` (typecheck, lint, 170 Jest tests, all pass). I did not run e2e because QA is using those ports.

## Summary

The server is solid for a dev stand-in:
- scrypt (N=2^17, r=8, p=1) with a per-user salt, parameters stored with the hash, NFKC normalisation and a constant-time compare.
- A dummy hash on unknown emails, so timing and answers are the same for a wrong password and an unknown email.
- 256-bit opaque refresh tokens, stored only as SHA-256 hashes.
- Rotation in an `UPDATE … WHERE used_at IS NULL` transaction, so a lost race also counts as reuse. Reuse revokes the session.
- The access token is checked against a live session on every `/me` call, so sign-out and reuse end access tokens immediately, not after 15 minutes.
- Every query is parameterised.
- `foreign_keys=ON` with `ON DELETE CASCADE` covers sessions, tokens, resets and client sign-ins.
- Rate limiting is per IP and route. CORS uses an origin allow-list with no credentials. The body limit is 16 KB. Errors share one JSON shape. The `authorization` header is redacted in logs.

The app's session layer is careful:
- One in-flight refresh at a time.
- A generation counter, so a late refresh can't bring back an ended session.
- A 401 leads to one refresh and one retry. If a brand-new token is still refused, the session ends cleanly.
- The access token lives only in memory. Native uses the Keychain/Keystore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. Corrupt or expired stored sessions are dropped.
- Startup is offline-first.
- Route guards use `Stack.Protected`.
- `useSubmit` blocks double submits and guards against state updates after unmount.

Tests cover rotation, reuse, cross-client sign-in, revocation, deletion and the rate limit.

I found no BLOCKER or MAJOR. The engineer's known limitations and the other items below are MINOR for this step: the server is a dev stand-in, production auth will be OIDC, the web build is a QA/preview target, and nothing calls the API in the background yet. Items 1 and 2 need fixing before background sync (step 7) or any web release.

## Findings

### 1. Several tabs (web) share one refresh token, but each tab keeps its own copy in memory, so reuse detection signs the user out
- Severity: MINOR (must be fixed before step 7 sync or any public web build)
- Where: `src/services/auth/sessionManager.ts:412-437` (refresh uses the in-memory `stored.refreshToken`), `src/services/auth/authStore.ts:189-199` (every page load refreshes straight away)
- Problem and impact: each tab loads the token once and then uses its in-memory copy. Two cases end the session for every tab:
  - **Stale tab.** Tab A loads (T0→T1). Tab B opens and rotates T1→T2. When tab A next needs a refresh (more than 15 minutes later, for example when it deletes the account), it presents T1. That is reuse, so the server revokes the session and both tabs are signed out with "session ended".
  - **Simultaneous start.** A browser restores two tabs at once. Both present the same token, the second loses the rotation race, and the server revokes the session. This happens every time.

  Today it only hits web users with several tabs. Native has one instance, and the placeholder home makes no background calls. Once sync polls the API, a stale tab will sign the user out within about 15 minutes.
- Fix:
  - (a) In `refresh()`, re-read the store before calling the server. If the stored token differs from the in-memory one, adopt the stored one (another tab rotated it).
  - (b) On web, wrap the read-and-refresh in `navigator.locks.request('mhp-auth-refresh', …)` so tabs take turns. Re-read the store inside the lock, and skip the network call when the token changed while waiting.
  - (c) Optionally listen for `storage` events: adopt new tokens, and end the session in this tab when another tab signs out.
  - Add a sessionManager test with two managers sharing one store.

### 2. A refresh whose response never arrives signs the user out on the next refresh
- Severity: MINOR
- Where: `server/src/auth-service.ts:303-306` and `:326-330` (strict reuse with no grace), `src/services/auth/httpAuthClient.ts:211-227` (15 s abort), `src/services/auth/sessionManager.ts:370-378` (a failed persist is swallowed)
- Problem and impact: the server can rotate the token while the client never stores the new one. This happens when:
  - the response is lost or arrives after the 15 s abort on a slow mobile network,
  - the user reloads or kills the app during the refresh that runs on every start,
  - SecureStore fails to write.

  The client keeps the old token, so its next refresh is reuse and the session is revoked. On native this shows up as a "random" sign-out on flaky networks. Strict reuse without grace is correct as a security model, but real providers add a short grace period because of this (Auth0 "reuse interval", Okta "grace period").
- Fix: on the server, accept a used token again for a short window (e.g. 30 s) if its successor has not been used yet. Revoke the unused successor and rotate again; anything else stays reuse. Add a test. Record in the OIDC hand-over notes that the production provider needs a refresh-token reuse grace period configured.

### 3. The refresh token is in localStorage on web
- Severity: MINOR (accepted for this step)
- Where: `src/services/auth/secureStorage.ts:94-120`
- Problem and impact: any XSS on the web origin can read a token that is valid for 30 days and renews itself. The app has no third-party scripts and web is a QA/preview build, so the risk today is low. The file already documents this.
- Fix: before any public web release, move the web refresh token into an httpOnly, SameSite=Strict cookie on the API (or a BFF), or keep it in memory only. Backlog.

### 4. The reset link leads nowhere
- Severity: MINOR (the brief only asks for the request endpoint)
- Where: `server/src/config.ts:456` (`RESET_LINK_BASE` → `/reset-password`), `server/src/auth-service.ts:344-359`
- Problem and impact: the logged dev link opens the app's not-found screen, and no endpoint consumes the token. A tester who follows it hits a dead end. Real users are not affected: with OIDC, password reset is hosted by the provider.
- Fix: backlog. Either add `POST /auth/password-reset/confirm` plus a reset screen (also revoking all of the user's sessions on success), or decide it is provider-hosted and add "(dev: no reset page yet)" to the log line.

### 5. Account deletion does not ask for the password again
- Severity: MINOR (the brief asks only for an in-page confirmation, which is there)
- Where: `server/src/routes/me.ts:306-311`, `src/app/(app)/home.tsx:262-269`
- Problem and impact: anyone holding an unlocked, signed-in device can delete the account permanently, including the user's MHP Coaching data once it is shared.
- Fix: step 8, which owns account deletion in settings. Require recent authentication: re-enter the password on the dev server, or use `max_age`/`prompt=login` with OIDC. Backlog.

### 6. Signing out offline does not revoke the server session
- Severity: MINOR (acceptable)
- Where: `src/services/auth/sessionManager.ts:463-469`
- Problem and impact: the token is deleted locally, so nobody holds it, and the server session simply expires after 30 days. The risk is negligible.
- Fix: optional. Keep the old refresh token in a "pending revoke" key and send `/auth/signout` on the next launch that has a network.

### 7. Rate limits and scrypt cost need a look before `server/` is deployed for shared testing
- Severity: MINOR
- Where: `server/src/app.ts:80-84`, `:119-122` (keyed on `req.ip`, `trustProxy` not set), `server/src/config.ts:462-466` (10/min, refresh included), `server/src/passwords.ts:116`
- Problem and impact: two limits only matter on a shared deployment.
  - **Shared rate-limit budget.** Behind a reverse proxy or carrier NAT, every user shares one IP and so one budget. At 10 refreshes a minute per IP, silent refreshes start failing with 429. The app handles that gracefully: the user stays signed in, but the profile goes stale.
  - **scrypt memory.** Each hash uses 128 MiB. With 4 libuv threads that is a 512 MiB peak, which can run a small staging box out of memory.

  Neither matters in local dev.
- Fix: when deploying, set `trustProxy`, raise or separate the refresh limit (or key it on the session), and set `SCRYPT_LOG_N` to suit the box. A comment in `config.ts` or the README is enough for now.

## Engineer's known limitations: assessment

| Limitation | Verdict |
|---|---|
| Refresh token in localStorage on web | Acceptable now. MINOR #3. |
| Several tabs, or a reload during a refresh, trigger reuse detection | Acceptable for this step. Several tabs is deterministic on web, not rare (#1). The reload case is rare (#2). Both must be fixed before step 7 sync or a web release. The client fix for #1 is cheap. |
| No reset-confirm endpoint | Out of scope per the brief. MINOR #4. |
| No password re-entry before deletion | The brief is met. Belongs in step 8. MINOR #5. |
| Offline sign-out doesn't revoke on the server | Acceptable. MINOR #6. |

## Proposed backlog lines
- Auth: cross-tab refresh (re-read the store before refresh, Web Locks on web, `storage` events). Needed before step 7 sync or a web release. (CR s2 #1)
- Server: refresh-token reuse grace window (about 30 s), and note it for the OIDC provider configuration. (CR s2 #2)
- Web: move the refresh token out of localStorage (httpOnly cookie or BFF) before a public web build. (CR s2 #3)
- Reset confirm endpoint and screen, or mark reset as provider-hosted. (CR s2 #4)
- Recent-auth check before account deletion (step 8). (CR s2 #5)
- Optional: queue the server revoke after an offline sign-out. (CR s2 #6)
- Before deploying `server/`: `trustProxy`, refresh rate limit, scrypt cost. (CR s2 #7)

VERDICT: PASS
