# MHP Hypnose

A crocodile-themed, gamified self-hypnosis mobile app by MHP. It shares one account with the MHP Coaching app.

- [Product concept and design](docs/product-concept.html): the idea, key screens, content structure, gamification, look and feel, shared accounts, onboarding, safety, roadmap, metrics and open questions.
- [Build plan](docs/build/PLAN.md) and [build loop](docs/build/LOOP.md): stack, architecture rules, steps and the review process.

## Stack

Expo SDK 57, React Native, TypeScript (strict), Expo Router, react-native-svg for all illustration, react-native-reanimated for motion. Runs on iOS, Android and web (react-native-web).

## Run it

```sh
npm install
npm run server:install   # once: dependencies of the dev account service (server/)
npm run server           # dev account service on http://localhost:4000 (restarts on change)
npm run web              # dev server for the web app (Expo + Metro)
npm start                # Expo dev server for iOS / Android (Expo Go or a dev build)
```

Routes live in `src/app/`. In dev mode the component gallery is at `/dev/gallery`.

The app talks to the account service at `EXPO_PUBLIC_API_URL` (default `http://localhost:4000`). Android emulators reach the host at `http://10.0.2.2:4000`, phones at your machine's LAN address: put `EXPO_PUBLIC_API_URL=...` in `.env.local`.

### Accounts (dev account service)

`server/` stands in for the shared MHP account service: one user pool for two clients, `mhp-coaching` and `mhp-hypnose`. Fastify on Node 22 (`node:sqlite`, TypeScript run directly by Node), its own `package.json`, tests with `node:test`.

```sh
npm run server           # = npm --prefix server run dev; data in server/data/dev.sqlite
npm run server:test      # typecheck + server tests
# Create an account "from the MHP Coaching app" (server must be running), then sign in with it in the app:
npm run create-user -- --email ann@example.com --password "river walk 1" --name Ann
```

Endpoints: `POST /auth/signup`, `/auth/signin`, `/auth/refresh`, `/auth/signout`, `/auth/password-reset/request` (always 202; the reset link is logged as `resetLink`, no mail is sent; it opens the app's `/reset-password` screen), `/auth/password-reset/confirm` (single-use token; sets the password and ends every session), `GET /me`, `DELETE /me` (needs `{ "password" }` again, then deletes the MHP account and all Hypnose data), `GET /me/export` (everything stored about the user, as JSON), `DELETE /me/mood` (deletes the mood stream and the moods in the onboarding document; storing settings with `moodConsent: false` does the same), `GET /health`. Every error is `{ "error": { "code", "message", "fields"? } }`.

App documents (bearer token): `GET`/`PUT /me/onboarding` and `GET`/`PUT /me/settings`. Each is one JSON document per user with a schema `version` and the client's `updatedAt` (epoch ms). `PUT` sends the whole document, which is validated against the schema for its version (`server/src/documents.ts`; add a version there to extend a document), merged last-write-wins on `updatedAt`, refused when the client clock is more than 5 minutes ahead, and answered with what is stored afterwards (possibly a newer document from another device). `GET` answers `{ "<kind>": null }` until something was stored. Documents are deleted with the account. Settings are at schema v2 (`reducedMotion` and the per-field stamps `fieldsAt` are required); the server stores v2, upgrades a v1 write or an old row, and answers `GET /me/settings` in v1 unless the app asks `?v=2` (a `PUT` is answered in the version it sent).

| Variable                                            | Default                                   |                                                     |
| --------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `PORT` / `HOST`                                     | `4000` / `localhost`                      |                                                     |
| `DB_PATH`                                           | `data/dev.sqlite` (relative to `server/`) | `:memory:` for a throwaway database                 |
| `JWT_SECRET`                                        | random per process                        | required (32+ chars) with `NODE_ENV=production`     |
| `ACCESS_TOKEN_TTL_SECONDS`                          | `900`                                     | set e.g. `20` to watch silent refresh               |
| `REFRESH_TOKEN_TTL_SECONDS`                         | `2592000` (30 days)                       | rotated on every refresh; reuse revokes the session |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS` | `10` / `60000`                            | per address and auth route                          |
| `READ_RATE_LIMIT_MAX` / `READ_RATE_LIMIT_WINDOW_MS` | `120` / `60000`                           | per address, `GET /me/points` and `/me/habitat`     |
| `CORS_ORIGINS`                                      | `localhost:4173, 4273, 8081`              | comma-separated origins                             |
| `RESET_LINK_BASE`, `SCRYPT_LOG_N`, `LOG_LEVEL`      |                                           |                                                     |

In the app, `src/services/auth` holds the `AuthClient` interface (HTTP implementation for this server; an OIDC adapter can replace it), the session manager (single-flight refresh, retry on 401) and the auth store. Tokens: the refresh token lives in the iOS Keychain / Android Keystore (`expo-secure-store`); on web it falls back to `localStorage` (memory if storage is blocked). Access tokens stay in memory. A production web client would keep the refresh token in an httpOnly cookie instead.

The refresh token is shared by every tab (web) and by consecutive launches (native), and it rotates on every refresh. So the session manager re-reads the stored token before each refresh and adopts a newer one, holds a cross-tab Web Lock while it refreshes (other tabs wait and pick up the result; tabs also follow each other's sign-in and sign-out through the `storage` event), persists the new token before using it, and only clears storage when the token the server refused is still the stored one. The server adds a reuse grace window for answers that never arrive. **The production identity provider (OIDC) must be configured with an equivalent refresh-token reuse grace period** (e.g. Auth0 "reuse interval", Okta "grace period for token rotation"), or interrupted refreshes will sign users out.

### Onboarding and app data

After sign-up (and for any signed-in user whose onboarding is not finished) the app shows the onboarding flow (`src/app/onboarding/`): goals, experience and timing, safety check, mood-data consent, hatching and naming the croc, a first short session, reminder opt-in, done. Every answer is stored at once on the device and synced to the server, so a reload or app kill resumes at the same step (`/onboarding` redirects there); a device that has nothing stored waits for the server first, so a finished onboarding never shows again. Signing out forgets the device copies (they hold health data).

`src/services/profile` holds the synced documents: `createDocumentStore` (offline-first, last-write-wins, debounced pushes, retried on the next change, load or `flush`, and on the browser's `online` event), the `ProfileClient` transport and the `ProfileStore` that follows the account. `src/features/onboarding/flow.ts` has the pure rules (step order, what each step needs, which steps are reachable, the settings derived from the answers). Haptics and UI sounds go through `src/services/feedback` (muted in Night River and by the user's settings); daily reminders through `src/services/reminders` (expo-notifications on native, an informative fallback on the web).

Placeholder audio (`assets/audio/`) is generated by `node scripts/make-placeholder-audio.mjs` (a 75 s calm track for the first session, a hatch chime, a tap tick; needs ffmpeg for the MP3 encoding). The first-session player (`src/features/session/useTrackPlayer.ts`, expo-audio) falls back to a silent timer of the same length when the audio cannot load or start, so the session always completes; dev builds show a "Skip (dev)" button in it.

## Checks

```sh
npm run check        # typecheck + lint + unit tests
npm run typecheck
npm run lint
npm test             # Jest + React Native Testing Library
npm run build:web    # web export to dist/ with dev mode on (gallery + placeholder marks), for QA
npm run build:web:release  # web export to dist/ with dev mode off
npm run serve:web    # serve dist/ on http://localhost:4173
npm run e2e          # exports fresh into dist-e2e/ and runs Playwright against it and a throwaway account service
```

`npm run e2e` (scripts/e2e.mjs) builds with `EXPO_PUBLIC_API_URL` pointing at its own API port, then Playwright starts the account service on a fresh temporary database (`E2E_API_PORT`, default 4274) and serves the web build (`E2E_PORT`, default 4273). Extra arguments go to Playwright, e.g. `npm run e2e -- --project=phone-390`.

Playwright uses the Chromium preinstalled at `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`). Never run `playwright install`.

Every web export passes `--clear` (Metro caches transforms without `EXPO_PUBLIC_*` values in the key) and is verified by `scripts/check-web-build.mjs`, which fails the build if the bundle came out in the wrong mode (and, for e2e, if it points at the wrong API). e2e never writes to the shared `dist/`.

## Project layout

```
src/app/            Expo Router routes (screens only; no business logic); (auth)/ account screens, onboarding/ the first-run flow, (app)/ signed-in screens
src/theme/          palette, tokens, both atmospheres (Daylight Riverbank / Night River), fonts
src/copy/           all user-facing text (en.ts) and the typed t() helper; placeholders marked with ph()
src/ui/             core components: Text, Button, IconButton, Card, Chip, ProgressBar, Screen, TabBar, TextField, Notice, icons
src/illustration/   the croc mascot (pure geometry + SVG renderer) and scene pieces (water, reeds, lily pads, leaves, fireflies, river path, lagoon)
src/motion/         reduced-motion provider
src/services/auth/  AuthClient interface + HTTP client, secure token storage, session manager, auth store
src/features/auth/  account-screen building blocks: scaffold, validation, error copy, croc reactions
src/features/onboarding/  onboarding flow rules, scaffold, river progress, choice cards, hatching egg, mood picker
src/features/session/     first-session player hook and breathing visual (replaced by step 5's player)
src/services/profile/     synced per-user documents (onboarding, settings): store, HTTP client, provider
src/services/feedback/    haptics and UI sounds behind one interface
src/services/reminders/   daily reminder (expo-notifications on native, web fallback)
src/services/http/        JSON request helper shared by the auth and profile clients
assets/audio/       generated placeholder audio (scripts/make-placeholder-audio.mjs)
server/             dev account service (Fastify + node:sqlite), its tests and the create-user script
src/config/         public build flags
e2e/                Playwright smoke tests
docs/build/         plan, loop, step briefs, reviews, screenshots
```

## Build flags

`EXPO_PUBLIC_DEV_MODE=1` enables the `/dev/gallery` route and the dashed marks on placeholder copy. It is on in the dev server (`__DEV__`) and in `npm run build:web`; it is off in `npm run build:web:release` and in EAS builds unless set there. Local overrides go in an untracked `.env.local`.

## Copy rules

Every user-facing string lives in `src/copy/en.ts`. Text that MHP still has to provide (tagline, names, mood labels, stage names) is wrapped in `ph()` and rendered with a dashed underline in dev mode. ESLint fails on string literals inside JSX outside the copy module, tests and the dev gallery.
