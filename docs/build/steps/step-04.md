# Step 4: Home and the river map

## Scope
1. **Content model** in `src/content`: zones → stops, as in PLAN.md. Types `video`, `audio`, `visual`, `game`, `longTrance`. Fields: id, zoneId, order, type, titleKey (copy), duration, mediaRef, unlock rule (previous stop done; zone entry rule), optional `cautionSafe` flag (used with the onboarding `cautionMode`), optional `timeOfDay` hint (e.g. sleep content in the evening).
2. **ContentRepository** interface + local JSON content pack: six zones (Intro, Sleep, Stress, Confidence, Focus, Habits). Intro and Sleep have 8–10 stops each mixing all types, ending in a long trance. The other four are visible but "coming soon". Placeholder titles only ("Intro · Stop 1" style keys in src/copy).
3. **Progress store**: per-stop status (locked / available / in progress / done), derived unlock state, persisted locally and synced through a `SyncClient` to the server (`GET/PUT /me/progress`, idempotent, last-write-wins per stop, tests). Works offline.
4. **Today's session** logic: picks the next available stop in the user's goal zone (from onboarding), respects `cautionMode` and time of day, falls back sensibly (zone finished → next zone or a replay suggestion). Pure function with thorough unit tests.
5. **Home screen** (Daylight): header with the croc avatar, points chip and weekly-goal chip (values can be placeholders until step 7, but wire to a store), greeting placeholder, the today's-session card with one big play button, then the river map.
6. **River map**: a vertically scrolling, illustrated river that winds through the jungle (reuse and extend the scene pieces). Zones are visually distinct regions along the river. Stops are nodes: done (amber with check), current (pulsing, with the user's croc sitting at it), available, locked, long trance (special big node), coming soon (misty/greyed region). Tapping a stop opens a bottom sheet with its type, duration and a start button (the start goes to a placeholder route until step 5). The map auto-scrolls to the current stop. Smooth 60fps scrolling on low-end phones (memoise, avoid re-rendering the whole map).
7. **Tab navigation**: Home, Croc (habitat placeholder until step 7), Games (placeholder until step 6), Profile (placeholder until step 8). Uses the step 1 TabBar.

## Acceptance criteria
- `npm run check`, server tests and e2e pass; e2e: home shows today's session; tapping a locked stop explains why it's locked; completing a stop (via a test helper) unlocks the next and moves the croc.
- Map looks rich and gamified at 390x844, 360x640, 820x1180; no jank when scrolling; reduced motion respected.
- Works offline after first load; progress syncs when back online.
