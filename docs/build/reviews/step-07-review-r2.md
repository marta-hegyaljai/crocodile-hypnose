# Step 07 (Gamification): code review, round 2

Fix diff `c593bd4..b517874`. `npm run server:test` passes (111 tests). `npm run check` has one failure, `src/features/onboarding/screens.test.tsx:335` (hatch-hint tap-gap timing); it passes when run alone (20/20) and sits in presentation code outside this diff, so I treat it as load-sensitive flakiness, not a regression.

## r1 MAJOR (back-dated events bypass the daily cap): FIXED
Rules probe (`/tmp/s07-reviewer/probe.mts`, 1-year-old account):
- 20,000 fresh events dated across every day of the year, posted in one arrival day: 30 paid (180 points), no weekly goals, only firstBreathing and days3 badges. r1 measured about 51,600 points.
- Sustained script, 60 real days, 60 events/day spread over the last 14 days: 855 paid, at most 30 per real day. Cost and reward track real time.
- Determinism: shuffled input gives an identical ledger. Feeding events in arrival batches (incremental derivation) gives identical keys and points. Only the `at` stamp of week/badge rows differs, which is cosmetic and pre-existing.
- `storedAt` is server-set (`toRecords` uses `now`; `activities()` reads the record field, not a client-supplied `data.storedAt`), so a client cannot influence it.
- Legit offline: an event done 3 days ago pays on its own (test added, with replay equality). Events without `storedAt` (app predictions, fakes) skip the back-date check and sort by `at`.
- Day badges and weekly goals are computed from paid ledger activities only. The new test asserts no `days30` after a 60-day burst.

## Remaining, MINOR (not blocking)
- A crafted client can still reach `days7`/`days30` and a couple of past weekly goals about 14 days sooner than real time (the back-date window lets each arrival day touch 15 distinct event days). Bounded and small; add to backlog.
- More than 30 activities arriving on one UTC day (for example a very heavy offline stretch) lose the excess permanently, because the arrival day is fixed at insert. 30 is well above real use; add to backlog.

VERDICT: PASS
