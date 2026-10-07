# MHP Hypnose: release checklist (phase 1)

State at main `a4c26ca` (2026-10-07), from the S09c regression (`docs/build/reviews/step-09-qa-r1.md`). The app is feature-complete for phase 1 and runs end to end on the web build against the dev account service. It is **not store-ready**: the items under "Blocked" and "What MHP must provide" are outside what the build can fix. One MAJOR finding (M1) is open at the time of writing.

Legend: VERIFIED = run for real, evidence given. BLOCKED = could not be tested or decided here, reason given. OPEN = known work.

## 1. Verified

| Area | Evidence |
| --- | --- |
| Typecheck, lint, unit tests | `npm run check`: 62 suites, 437 tests green |
| Server | `npm run server:test`: 126 tests green |
| End to end (Chromium, three viewports: 390x844, 360x640, 820x1180) | `npm run e2e` three runs in a row, 174 passed each (10m23s, 10m04s, 10m12s), no flake, while the machine was also running hands-on sessions |
| Fresh-account journey at 390, 360, 820 | sign-up, onboarding (goals, experience, safety, consent, hatch, first session, reminder), map, every stop type (video, audio, visual, long trance, game stops), all three games, points ledger agrees with server, growth moment (natural and via dev hook) shown once, habitat buy/place/remove, badges, weekly goal, profile edits, settings, consent off, safety re-take, export, sign out/in, delete account (sign-in then 401) |
| Returning account | "Coaching" account created with `npm run create-user`: shared-account note, wrong password error, keyboard-only sign-in, onboarding resume after reload, caution path, sign out/in, second browser context sees the same state and refreshes on focus, offline session settles to the server when back online, settings changed offline reach the server |
| Accessibility basics | no horizontal overflow and no target under 44 px on every visited screen at all three sizes; Tab order on sign-in; Escape, radio-group and focus-trap work from S09a (e2e `a11y.spec.ts` green) |
| Console | no console or page errors in any online run |
| Release export | `expo export` without dev flag passes `scripts/check-web-build.mjs release`; no gallery link, `/dev/gallery` goes to welcome, dev hooks undefined at runtime, no dashed placeholder marks |
| App identity (S09b) | icon, adaptive icon, favicon, splash in `app.json`/`assets/`; store screenshots 5 per platform in `assets/store/{ios,android}` (web captures, see `step-09-store-r1.md`) |
| Backlog | every row marked done or deferred with a reason (S09a) |

## 2. Open before launch

Worth doing, in this order:

1. ~~**M1 (MAJOR, QA r1):** caution mode: a stop after an unsuitable stop opens although earlier stops are locked.~~ Fixed in S09c (70b104e), re-checked in QA r2; lock hints now name the nearest finishable stop.
2. Require `EXPO_PUBLIC_API_URL` for release exports (QA r1 m2): today a release build without it silently targets `http://localhost:4000` and `check-web-build.mjs release` does not catch it.
3. Audio-failure notice overlaps the "Breathe in" cue (QA r1 m1).
4. Native config to settle when the first device build is made: there is no `eas.json`; `app.json` lists no `expo-notifications` plugin entry and no explicit background-audio setting for iOS (`shouldPlayInBackground` is set in code, `UIBackgroundModes` must be confirmed in a real build). Expo config plugins and permission strings (notifications, motion) need a device pass.
5. Backlog items that matter once real users arrive (`docs/build/BACKLOG.md`):
   - Step 2 #3: web refresh token in `localStorage`; move to an httpOnly cookie or BFF before any public web release (not needed for native-only launch).
   - Step 2 #7: before a shared deployment: `trustProxy`, a separate refresh rate limit, tune `SCRYPT_LOG_N`.
   - Step 7: client pending-points ignores the 14-day back-date window; crafted clients can reach 7/30-day badges early. Low risk with real users, relevant for any leaderboard or reward that has value.
   - Step 8: consent-off confirmation and the "deleted" note below the fold, empty reminder-time error; export is a small inner scroller; all section titles are h1.
   - Step 4: no service worker, so a cold reload offline fails on web (native is fine).
   - Step 5: audio heard while JS is suspended is not counted (confirm on iOS Safari and on device); mood-before id reuse on a resumed run.
   - Step 9: pending reward reappears after back navigation within 15 min; breathing `pressed` flag can swallow one screen-reader activation (check with VoiceOver and TalkBack).
   - Step 3 m5/m6: safety information is screen state (browser back skips it); focus does not move to the new step title.
   - Keyboard: tab bar has no arrow-key navigation; radio groups are not a roving tab stop.
6. Placeholder media durations must be re-synced with real media (`durationSec` in `src/content/pack.json`; the placeholder for Intro stop 2 plays 1:30, the map says 3 min).

## 3. Blocked

| Item | Why it is blocked |
| --- | --- |
| Native behaviour on iOS and Android: local reminders, haptics and UI sounds, background and lock-screen audio, motion sensors (Stillness, Firefly), secure token storage, share sheet for export, system reduce-motion, native splash and launcher icon, adaptive icon masks | No device or simulator in the build environment; everything was exercised on the web build only. Needs a device pass (TestFlight and an Android internal track) |
| Real MHP account backend | The app uses a dev stand-in (`server/`, email and password, JWT, rotating refresh tokens). The OIDC (Authorization Code + PKCE) adapter cannot be written until MHP says what Coaching uses. The provider must allow a short refresh-token reuse grace (the dev server uses 60 s) |
| Real content and media | Zones, stops, captions, trance scripts, audio, video and visuals are placeholders (generated tone/noise, sample clip, `[Caption N]`). The pack has 19 stops in 2 of 6 zones; the other 4 zones are "coming soon" |
| All copy | 173 `// PLACEHOLDER` markers in `src/copy/en.ts` (tagline, goals question, safety questions and information, reward and growth titles, onboarding text, privacy text, section headings such as `[Decorations]` and `[TODAY]`). German structure is ready, text is not. Store screenshots show some of these and must be recaptured after copy lands |
| Crisis contacts and safety information | `help.contacts` and the safety information are placeholders (`[Crisis line name 1]`, `[Phone number 1]`, "not a replacement for therapy"). Needs MHP's clinical and legal sign-off, per country. Do not ship before this |
| Caution-mode semantics | Owner decision still open: what a "yes" on a safety question should do (hide unsuitable stops, ask a professional first, only advise?). Also affects Replay for finished unsuitable stops (backlog Step 4 #4) and zone completion counts. Current behaviour is the S04 rule (unsuitable stops are shown, can't be started, and don't block the way once reached) |
| Dark splash | Owner decision: `userInterfaceStyle` is `light`, so there is no dark splash. To honour system dark mode add `dark: { backgroundColor: "#08171A" }` to the `expo-splash-screen` plugin with the same image |
| Store accounts and submission | Apple Developer Program and Google Play Console accounts, bundle and package ids (`com.mhp.hypnose` is a placeholder), signing credentials, EAS project: not available |
| Production backend | Postgres schema and deployment of the app API (SQLite in dev), real email for password reset (the dev server logs the link), monitoring |

## 4. What MHP must provide before store submission

- Decision and details of the Coaching auth backend (OIDC issuer, client ids and redirect URIs for `mhp-hypnose`, scopes, refresh-token policy, account deletion endpoint, password-reset flow) so the adapter can replace the dev client.
- A production API host (or approval to run the app API on MHP infrastructure), CORS origins, `JWT_SECRET` and other secrets, `trustProxy` setup, backup and retention policy.
- Final copy for every placeholder (English, then German): tagline, onboarding, safety questions, privacy text, goals, mood labels, zone and stop names, reward and growth text, game text.
- Crisis contacts per target country, the safety information text, and the therapy disclaimer, reviewed by MHP's clinical and legal people.
- The caution-mode decision (see above) and the dark-splash decision.
- Real media: audio trances, video lessons, visual exercises, long trances, captions or transcripts, the content for the four "coming soon" zones (or confirmation they ship as coming soon).
- Legal and store listing: privacy policy URL, terms, data-protection notice (mood check-ins are health data; consent flow and deletion exist), age rating and health-content declarations, support URL and contact, app name and subtitle, description, keywords, category, screenshots approved (recaptured with real copy), app icon sign-off.
- Store accounts and ownership: Apple Developer and Google Play accounts under MHP, bundle id and package name confirmed, signing keys, EAS access.
- Analytics and crash reporting choice (none is wired in), and a decision on notification wording and default reminder times.
- Test devices and testers for the native pass, and who signs off the release.

## 5. How to reproduce this regression

```
npm run check
npm run server:test
E2E_PORT=4952 E2E_API_PORT=4953 npm run e2e          # x3
DEV_HOOKS=1 PORT=4950 DB_PATH=/tmp/s09-qa/dev.sqlite CORS_ORIGINS=http://localhost:4951 npm --prefix server run dev
npx cross-env EXPO_PUBLIC_DEV_MODE=1 EXPO_PUBLIC_API_URL=http://localhost:4950 npx expo export --platform web --output-dir /tmp/s09-qa/web --clear
npx serve /tmp/s09-qa/web --listen 4951 --single
PORT=4950 npm run create-user -- --email a@example.com --password "river walk 1" --name "Coaching"
# release export check
npx expo export --platform web --output-dir /tmp/s09-qa/web-release --clear && node scripts/check-web-build.mjs /tmp/s09-qa/web-release release
```
