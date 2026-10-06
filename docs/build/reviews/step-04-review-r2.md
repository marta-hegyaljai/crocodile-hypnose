# Step 4 (Home and river map): code review, round 2

Reviewer: code-reviewer. Fix diff `21e9081..7c94ecd`. `npm run check` passes (35 suites, 295 tests); `npm run server:test` passes (86/86).

- Finding 1 (record limit and body limit): FIXED. `resolveDocument` refuses a merged union over `MAX_STOP_RECORDS` with 400 `invalid_request` before storing, and the throw happens inside the `putDocument` callback so the stored doc is unchanged (tested). `/me/progress` has its own 320 KB `bodyLimit`; the full-size test (2000 long ids) passes. Client and server limits are the same value. Refused-write path: the document store sets `rejected` on a 400 and `flush` no-ops while it is set; only a new local change clears it, so it cannot loop (tested: no further PUTs after the refusal). `adopt`'s re-push also goes through `flush`, so it stays quiet too. Local progress is kept (tested, `dirty` stays true). Residual, not a blocker: a refused user keeps one refused PUT per local change until they are under the limit, which is unreachable with the content pack.
- Finding 2 (caution fails open): FIXED. `effectiveCautionMode` uses the onboarding answers until `settingsKnown` (device copy or server copy seen), then the settings decide, so a later opt-out in step 8 works. Both `useJourney` and `session/[stopId].tsx` (which uses `useJourney`) get it. `settingsKnown` is derived from `source !== 'none'` and reset on load/reset, so it cannot be stale across users. A user whose server has no settings document stays on the onboarding answers, which is the closed direction. The new test reproduces progress arriving before settings and checks map statuses, `intro-6` as `caution`, and today's session at three hours. No open gap.

Round-1 MINOR #3 and #4 unchanged and out of scope for this re-check.

VERDICT: PASS
