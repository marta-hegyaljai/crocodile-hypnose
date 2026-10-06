# MHP Hypnose: build plan

Source of truth for product and design: `docs/product-concept.html`. This file turns it into an engineering plan. Process: `docs/build/LOOP.md`.

## Goal

A production-quality first version (MVP) of MHP Hypnose: a crocodile-themed, highly gamified, very easy-to-use self-hypnosis app. The crocodile is the main character on every screen. Users sign in with their MHP account (shared with the MHP Coaching app).

## Stack (decided)

- **App:** Expo (latest stable SDK), React Native, TypeScript (strict), Expo Router. Runs on iOS, Android and web (react-native-web). The web build is what QA and design test in Chromium.
- **Graphics and motion:** react-native-svg for all illustration (croc mascot, scenes, icons), react-native-reanimated for animation (UI thread). Respect reduced motion everywhere.
- **Fonts:** Baloo 2 (display) and Nunito Sans (body) via `@expo-google-fonts`.
- **State:** Zustand stores for app state, persisted with AsyncStorage (offline-first). TanStack Query for server calls.
- **Media:** `expo-audio` (background audio, lock screen), `expo-video`.
- **Haptics / sound:** `expo-haptics`, short UI sounds via `expo-audio`. All muted in Night River mode.
- **Notifications:** `expo-notifications` (local reminders). On web, degrade gracefully.
- **Tests:** Jest + React Native Testing Library for logic and components. Playwright (Chromium at `/opt/pw-browsers`, never run `playwright install`) for end-to-end smoke tests against the web build.
- **Lint/format:** ESLint (expo config) + Prettier. `npm run check` runs typecheck + lint + tests.

## Accounts and backend

We don't know yet which auth system MHP Coaching uses. So:

- The app talks to an `AuthClient` interface (`src/services/auth`). Methods: `signUp`, `signIn`, `signOut`, `refresh`, `requestPasswordReset`, `getProfile`, `deleteAccount`.
- **Dev implementation:** `server/` is a small TypeScript Node service (Fastify) that stands in for the shared MHP account service and the Hypnose app API. Email + password accounts (argon2 or scrypt hashing), short-lived JWT access tokens + rotating refresh tokens, password reset request endpoint (logs the link in dev), account deletion, input validation, rate limiting on auth endpoints. Storage behind a repository interface; SQLite (`node:sqlite`) in dev, Postgres-ready schema for production.
- The service models two clients (`mhp-coaching`, `mhp-hypnose`) on one user pool, so "sign up in one app, sign in to the other" is real and testable.
- **Production:** swap the dev adapter for an OIDC (Authorization Code + PKCE) adapter once we know the Coaching backend. Nothing in the UI changes. The provider must allow a short refresh-token reuse grace period (the dev server uses 60 s), because rotated tokens are shared across tabs and app launches and a refresh can be interrupted.
- Tokens are stored with `expo-secure-store` on native and a safe fallback on web.
- **App data** (croc, points, progress, mood check-ins, settings) lives in local stores and syncs to `server/` through a `SyncClient` (last-write-wins per record, idempotent event log for points so nothing is double-counted). The app must work offline and sync later.
- Mood check-ins are health data: stored only after explicit consent, never sent anywhere else.

## Content

- Content model in `src/content`: zones → stops. Stop types: `video`, `audio`, `visual`, `game`, `longTrance`. Each has id, zone, order, duration, media reference, unlock rule.
- A `ContentRepository` interface with a local JSON content pack for now (CMS later).
- Six zones on the map; MVP content for two (Intro, Sleep). Other four show as "coming soon" (locked, still beautiful).
- Placeholder media: generate short sample audio (e.g. soft tone/noise WAV, a few minutes) and a short sample video with a script in `scripts/`. Keep repo size small.

## Copy rules

- Every user-facing string lives in `src/copy/en.ts` (structure ready for German later).
- Use short, neutral placeholder text. Examples: app name "MHP Hypnose", tagline "[Tagline]", zones "Intro", "Sleep", "Stress", "Confidence", "Focus", "Habits", games "Stillness", "Firefly", "Breathing", currency "Points", croc default name "Croc", mood labels "Mood 1" to "Mood 5" (with the water wave visual), stages "Stage 1" to "Stage 5". Plain functional UI text (Sign in, Continue, Pause) is fine.
- Never write slogans, trance scripts or marketing text. Mark placeholders in `en.ts` with a `// PLACEHOLDER` comment.

## Design rules (summary, see the concept for detail)

- Palette tokens: Deep Jungle `#0E2E24`, Croc Green `#3F6B35`, Croc Green Dark `#24452A`, River Teal `#1D6E6A`, Shallows `#7CC4B5`, Croc Eye Amber `#F2A93B`, Water Lily `#EE8FA6`, Riverbank Mud `#8A6A43`, River Mist `#E7F0E6`, Night River `#08171A`.
- Two atmospheres: **Daylight Riverbank** (home, map, habitat, games, rewards: bright, chunky 3D buttons, springy motion, sounds) and **Night River** (every trance, video, visual: dark, slow, no counters or pop-ups).
- The croc mascot appears throughout: on the map as the user's position, reacting to taps, celebrating rewards, sinking under water as a session starts. Five growth stages and a set of expressions. Always calm or happy, never sad.
- Gamified everywhere: points, croc growth, habitat decorations, weekly goal, badges, satisfying reward moments. Never punishing (no lost streaks, no guilt).
- Very easy: one tap from home to playing today's session. Tap targets ≥ 44px. WCAG AA contrast. Screen-reader labels. Reduced-motion support.

## Status

| Step | Status | Evidence |
| --- | --- | --- |
| S01 Foundation and design system | DONE | 2026-10-05, review r2 + QA r2 + design r1 PASS (`docs/build/reviews/step-01-*`) |
| S02 Accounts | DONE | 2026-10-06, review r3 + QA r2 + design r1 PASS (`docs/build/reviews/step-02-*`) |
| S03 Onboarding | DONE | 2026-10-07, review r2 + QA r2 + design r1 PASS (`docs/build/reviews/step-03-*`) |
| S04 Home and river map | DONE | 2026-10-07, review r2 + QA r1 + design r1 PASS (`docs/build/reviews/step-04-*`) |
| S05 Sessions | IN PROGRESS | |
| S06 Mini-games | TODO | |
| S07 Gamification | TODO | |
| S08 Profile and settings | TODO | |
| S09 Release polish | TODO | |

## Steps

Each step has a brief in `docs/build/steps/step-XX.md` written by the orchestrator, with acceptance criteria.

1. **Foundation and design system.** Project scaffold, tooling, `npm run check`, web build, Playwright smoke setup. Design tokens, fonts, both atmospheres, core components (3D buttons, cards, chips, progress bars, tab bar, screen scaffolds, placeholder-aware text). The croc mascot as an SVG component with 5 growth stages and expressions, plus key scene pieces (water, ripples, reeds, lily pads). A dev-only component gallery screen.
2. **Accounts.** `server/` dev account service + `AuthClient`. Welcome, sign in, create account, forgot password, sign out, delete account. Session persistence and refresh. Shared-account behaviour across the two clients.
3. **Onboarding.** Goals, experience and timing, safety check, hatch and name the croc, first short session, reminder opt-in. Resumable if interrupted.
4. **Home and river map.** Content model and repository, the river map with zones and stops (done / current / locked / coming soon), today's session card, tab navigation, the croc on the map.
5. **Sessions.** Night River player for audio trances (background play, progress, resume), video lessons, visual exercises, mood check before and after, reward moment.
6. **Mini-games.** Stillness, Firefly (eye fixation) and Breathing, each 1–3 minutes, never losable, motion sensor where available with a touch fallback on web.
7. **Gamification.** Points ledger, croc growth, habitat with decorations to unlock and place, weekly goal, badges. Sync with the server.
8. **Profile and settings.** Reminders, sound and haptics, privacy and consent, safety info and crisis contacts, account deletion, sign out.
9. **Release polish.** Full end-to-end regression, performance, accessibility pass, app icons and splash, store-readiness checklist.
