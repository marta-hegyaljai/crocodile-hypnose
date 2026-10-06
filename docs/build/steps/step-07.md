# Step 7: Gamification

Builds on S05 (idempotent session-completed events, client points from `src/services/points`) and S06 (games shell `onGameCompleted`, device-side game records).

## Scope
1. **Points ledger on the server.** Points are derived on the server from the event log (`user_events`), never trusted from the client: stop type and first-time status come from server-side content metadata (ship the content pack's stop ids/types to the server, or share the JSON). Rules in one pure module used by server and client (display): session completed, first-time bonus once per stop, game completed (wire S06's `onGameCompleted` to emit an idempotent `game_completed` event), weekly goal reached, badge earned. `GET /me/points` returns balance and recent entries; the client shows the server value and an optimistic pending amount while offline.
2. **Croc growth.** Five stages driven by total calm minutes (from events): thresholds in one config, never go down. Growth moment when a stage is reached: a full-screen celebration with the croc growing (reuse Croc stages, CelebrationBurst), shown once per stage on the next visit to home if earned offline.
3. **Habitat (Croc tab).** The croc's lagoon as a scene the user decorates: a catalogue of ~12 placeholder decorations (lily pads, lotus, reeds, mangrove, fireflies, heron, stones, waterfall…) drawn in SVG, unlocked with points or milestones, placed in fixed slots (no free drag in MVP). Owned and placed items sync (`/me/habitat`, monotonic ownership, last-write-wins placement). Spending is idempotent and can't go below zero (server check).
4. **Weekly goal.** User-set target 3–7 days per week (default from onboarding timing), week boundaries in the user's timezone, progress chip on home, a small celebration when reached, never a penalty for missing.
5. **Badges ("scales").** ~8 placeholder badges for milestones (first session, first long trance, first game of each kind, 3/7/30 days, zone completed, first decoration). Earned server-side from events, idempotent, shown in a collection on the Croc tab.
6. **No punishing mechanics:** no streak loss, no sad croc, no guilt copy.

## Acceptance criteria
- `npm run check`, server tests, targeted e2e pass; e2e: complete sessions/games → points on the server, weekly goal progress, a growth stage reached (via a dev hook for minutes), buy and place a decoration, a badge earned.
- Points, growth and badges can't be gamed by replaying the same event, by two devices, or by a crafted client request.
- Habitat and growth moments feel rewarding and on-theme at 390x844, 360x640, 820x1180; reduced motion respected.
