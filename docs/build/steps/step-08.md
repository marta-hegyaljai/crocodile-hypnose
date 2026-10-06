# Step 8: Profile and settings

## Scope
1. **Profile tab** (Daylight): the croc and name (rename), account email, a summary (calm minutes, sessions, current stage).
2. **Settings:** reminder on/off and time (morning/evening), sound and haptics toggles, default session length, reduced-motion override, mood consent on/off (turning it off deletes stored mood entries locally and on the server: `DELETE /me/mood`), safety answers (re-take the safety check; updates caution mode).
3. **Safety and help:** a safety info page and crisis contacts (placeholder copy and placeholder numbers, clearly marked for MHP to fill), a "not a replacement for therapy" note (placeholder).
4. **Privacy:** what is stored and why (placeholder), export my data (JSON via the server; on web a shown block to copy, since downloads are blocked in some viewers), delete account (recent-auth: re-enter the password; reset the confirmation if the user changes; backlog items from S02).
5. **Sign out.**
6. **Caution-mode decision:** implement whatever the owner decides (open question); until then keep the S04 behaviour.

## Acceptance criteria
- `npm run check`, server tests, targeted e2e pass; e2e: change reminder time, toggle consent off (mood deleted on the server), re-take safety check (caution mode changes the map), export data, delete account with password.
- All settings persist across reload and devices; every toggle takes effect immediately.
- Clear, calm, on-theme at 390x844, 360x640, 820x1180; keyboard and screen-reader friendly.
