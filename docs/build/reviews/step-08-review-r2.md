# Step 08 review, round 2 (fix diff b06a91d..d83f117)

Checks: `npm run check` green (55 suites, 376 tests), `npm run server:test` green (103 tests). Probe (temporary jest file, deleted): real server `checkDocumentRules`/`resolveDocument` behind the real document store.

- R1 MAJOR 1 (edit before server copy overwrites with defaults): CONFIRMED FIXED. `SettingsGate` hides the editors until `seeded`; `setMoodConsent` also refuses before `seeded`; `stampSettings` stamps only changed fields, defaults carry stamp 0, so an edit on defaults merges under the server copy.
- R1 MAJOR 2 (stale copy flips consent): CONFIRMED FIXED. Per-field merge on client and server is equivalent (same stamps rule, same tie rule, consent prefers off, same legacy handling); purge only when stored consent was not already false and the resolved stamp is > 0, so undecided (stamp 0) never purges; client scrubs only on an observed true to false change.
- R1 MAJOR 3 (onboarding moods after withdrawal): CONFIRMED FIXED. Onboarding PUT scrubs (no 400) when settings are withdrawn; `withoutMoods` now sets consent false and bumps `updatedAt` so devices take the scrubbed copy.
- QA MAJOR ({n} in croc-name error): CONFIRMED FIXED. `crocNameProblemText` fills the limit; used by Profile and onboarding.
- Old clients without `fieldsAt`: OK. Counted as written whole at `updatedAt`; server bumps the stored `updatedAt` past theirs so they take the merged copy.

## NEW MAJOR 4: push loop when the client clock is ahead of the server

`src/services/profile/documentStore.ts` `sameContent` (now compares `fieldsAt`), with `server/src/documents.ts` `checkDocumentRules` (clamps `updatedAt` and every stamp to server time).

Problem: the server clamps `updatedAt` and the per-field stamps to its own clock; the response then differs from the client's copy in `fieldsAt`. Before this fix `sameContent` ignored only `updatedAt`, so a clamp was harmless. Now `sameContent(stored, sent)` is false, `adopt` keeps the local copy (higher stamps win), sees `!sameContent(remote, local)`, sets dirty and pushes again. Each push is clamped to the new server time, so it never converges until the server clock passes the client's time.

Probe: client clock 10 min ahead, one `sound` toggle: 41 pushes in 300 ms with the probe's debounce 0 (guard stopped it), `dirty` still true. Control with the client clock behind: 1 push, clean. In the app (250 ms debounce plus round trip) this is several requests per second for as long as the skew lasts (seconds for normal drift, hours for a wrongly set clock), a battery, data and rate-limit problem for every settings edit on such a phone.

Fix: make the comparison ignore `fieldsAt` (add an `ignore`/`contentKey` option to the store, or strip `fieldsAt` in `sameContent` for settings), or have `adopt` clamp local stamps to the remote `updatedAt`. Add a test: `now` ahead of the fake server's clamp, expect at most 2 pushes and `dirty` false.

## Minor (not blocking)

- `src/services/profile/profileStore.ts` `enforceMoodConsent`: it now scrubs only on an observed true to false change (`lastConsent` starts null each load). If the app is killed between the consent write and `scrubMoods` in `setMoodConsent`, the local mood log survives the restart (the server is purged by the PUT). Narrow window; consider scrubbing on first observation too when consent is false and the stamp is > 0.

VERDICT: CHANGES REQUIRED
