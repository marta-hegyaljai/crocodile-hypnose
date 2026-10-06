# Step 2: Accounts (one MHP account for both apps)

## Scope
1. `server/`: TypeScript Node service (Fastify) standing in for the shared MHP account service plus the Hypnose app API. Own `package.json`, `npm run dev`, `npm test`. Port and DB path via env with sane defaults.
   - Users table shared by two clients: `mhp-coaching` and `mhp-hypnose` (client id sent with each auth request). Record which client a user signed up from and last sign-in per client.
   - Endpoints: `POST /auth/signup`, `POST /auth/signin`, `POST /auth/refresh`, `POST /auth/signout`, `POST /auth/password-reset/request` (always 202, logs link in dev, no user enumeration), `GET /me`, `DELETE /me` (deletes account and all Hypnose data), `GET /health`.
   - Passwords: scrypt or argon2 with per-user salt; minimum 8 chars; emails normalised (trim, lowercase) and validated; display name optional, trimmed, max length.
   - Tokens: short-lived JWT access token (≈15 min) + opaque refresh token stored hashed, rotated on each refresh, reuse detection revokes the family. Sign out revokes.
   - Rate limiting on auth endpoints; consistent JSON error shape with machine-readable codes; CORS for the web app origin.
   - Repository interface over storage; SQLite via `node:sqlite` in dev; schema written so it ports to Postgres.
   - Tests for every endpoint including error paths, token rotation and reuse, rate limit, cross-client sign-in.
   - A tiny CLI or script to create a user "from the Coaching app" (client `mhp-coaching`) so QA can test shared-account sign-in.
2. App: `AuthClient` interface + HTTP implementation, secure token storage (`expo-secure-store` native, safe web fallback), automatic refresh on 401 with a single in-flight refresh, auth state store, route guards (signed-out users only see welcome/auth screens).
3. Screens (Daylight style, croc present on each): Welcome (croc peeking from water, sign in / create account), Sign in, Create account, Forgot password (confirmation state), a minimal signed-in placeholder home showing the user's name with Sign out, and Delete account behind a confirmation step (in-page, no `confirm()`).
   - Inline validation, clear error messages for: wrong password, unknown email (same message as wrong password), email taken, weak password, network offline, server down. Loading states, no double submit, keyboard handling (submit on enter, next field), password visibility toggle, autofill hints.
   - The croc reacts: e.g. covers/closes eyes while typing a password, celebrates on successful sign-up.
4. Explain in-app (placeholder copy) that this is the same account as MHP Coaching.

## Acceptance criteria
- Server tests pass; app `npm run check`, build and e2e pass (e2e covers sign-up, sign-out, sign-in, wrong password).
- A user created via the coaching-client script can sign in to the app with the same credentials.
- Reload keeps you signed in; expired access token refreshes silently; revoked refresh token signs you out cleanly.
- Offline and server-down states are handled with a clear message and retry.
- Delete account removes the user; signing in afterwards fails with the normal error.
- All screens pass the design rules (palette, atmosphere, croc present, 44px targets, AA contrast) at 390x844 and 360x640.
