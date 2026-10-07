# Step 9: Release polish

The end of phase 1. Three parts, run as separate agents so they can go in parallel where they don't touch the same files.

## 9a. Engineering polish (engineer, Sonnet; reviewer Sonnet)
Fix the backlog items that affect real users or the build, in this order, and mark each row in `docs/build/BACKLOG.md` as done (strike-through) or "deferred: <reason>":
1. The flaky unit test `src/features/onboarding/screens.test.tsx` "hatches on the third tap" (fails under full-suite load). Make it deterministic.
2. Reliability: stale tab/device doesn't refresh progress until reload (refetch on focus/visibility); event-log 429 mid-fallback restart and "unknown 4xx = permanent"; points refresh blocking the new user after a switch; purchase refusal by error code; rate limits on GET /me/points and /me/habitat; local mood log scrub on load when consent is off.
3. UX bugs: double-tap Continue on reward/growth lands on the Games tab; weekly toast reappears after reload; reload on mood-after/reward loses the reward moment (points already saved: show it once); game quit after Start leaves the stop "Started" (decide: fine, or show "Continue"); 0-breath game completes the stop (minimum engagement).
4. Accessibility: Tab order leaking into inactive tabs; radio groups with arrow keys; Escape closes dialogs (delete confirm, pause overlay, end-session); breathing hold has a screen-reader alternative; focus trap in the game pause overlay.
5. Settings v2 so `reducedMotion` and `fieldsAt` are formal (old clients keep working).
Anything else in the backlog: leave, or fix only if trivial.

## 9b. App identity (designer, Fable)
App icon (iOS, Android adaptive, web favicon) and splash screen featuring the croc, in `app.json`/assets; store screenshots set (5 per platform at the store sizes) from the real app; a final visual consistency sweep across all screens (spacing, type scale, icon set, colours) with fixes in the design system.

## 9c. Release regression (QA, Sonnet)
Full end-to-end user journey on a fresh account and on a returning account across 390x844, 360x640, 820x1180: sign-up → onboarding → sessions of every type → games → points, growth, habitat, badges → settings → export → delete. Plus the full `npm run e2e` suite and `npm run server:test`. A release checklist in `docs/build/RELEASE.md`: what's verified, what's BLOCKED (native-only, OIDC adapter, real content and copy, crisis contacts, caution-mode decision), and what MHP must provide before store submission.

## Acceptance
- Full `npm run check`, `npm run server:test` and full `npm run e2e` green three runs in a row (no flakes).
- Backlog rows each marked done or deferred with a reason.
- Icon, splash and store screenshots in place; `RELEASE.md` written.
