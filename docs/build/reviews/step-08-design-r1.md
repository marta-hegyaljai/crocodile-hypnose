# Step 8 design pass, round 1 (Profile and settings)

Designer agent on `step/S08`. Scope: the Profile tab, Safety and help, Privacy and your data, judged at 390x844, 360x640 and 820x1180 in Chromium (Playwright), on a fresh account seeded over the API as the e2e spec does. Presentation only: `settingsLogic.ts`, `SettingsGate.tsx`, `src/services/` and `server/` are untouched. No new copy keys.

Build: `expo export --platform web` with `EXPO_PUBLIC_DEV_MODE=1` on 4871, API on 4870 with its own SQLite file. Screenshots: `docs/build/screenshots/design/step-08/` (`before-*` are the baseline, `after-*` the result). No console or page errors in any run. Servers stopped by PID.

## What was polished

**Heading hierarchy (design system, QA 6c).** `Text`'s `heading` prop now takes a level (`heading={2}`), rendered as `aria-level` so the web build emits `h1`/`h2`/`h3` (`src/ui/Text.tsx`). The profile is one `h1` (the croc's name), every group an `h2`, and the delete confirmation an `h3` under its section. Sub-pages: the page title is `h1`, sections `h2`. Before, every title on the three pages was an `h1`.

**Settings grouped in pebble cards** (new `src/features/profile/Section.tsx`, used by `SettingsSections.tsx`, `ProfileHeader.tsx`, `privacy.tsx`). Each group is a level-2 title over one white card; toggle rows inside share hairline dividers (`Rows`). The profile reads as a short list of calm groups instead of one long column where "Your journey" and "Sounds" had the same weight. The three radio groups (reminder presets, session length, motion) now carry the group's name (QA 6b, the name half). `after-profile-full-390.png`, `after-profile-full-360.png`, `after-profile-top-820.png`.

**The croc hosts the page** (`ProfileHeader.tsx`). Bigger avatar (96, soft raised-surface ring), the name as the only level-1 title, and the email in full under it: it wraps (word-break on web) instead of being ellipsised, so the account is verifiable before export or delete (QA 5). Rename sits in its own "Your croc" card.

**Consent off is visible where the finger is** (`SettingsSections.tsx`, `ToggleRow` gained `detailTestID`). Turning Mood check-ins off writes the consequence into the row's own detail line ("Mood check-ins are off and your saved entries are deleted.") directly under the switch, instead of a notice that rendered below the fold (QA 2, the visibility half). `after-consent-off-390.png`.

**Export block** (`ExportData.tsx`): the JSON block now takes 60% of the viewport height (at least 320) so it reads as a document rather than a 260-px peephole (QA 7). `after-export-full-390.png`.

**Links and sub-pages.** The Safety/Privacy link cards have a chevron (the back icon mirrored) so they read as "opens a page" (`profile.tsx`). The therapy note on Help is an info notice instead of a floating caption, so the placeholder reads as a considered statement (`help.tsx`). Privacy's export and delete are sections of the same system; the delete button is still the single quiet ghost item, the danger colour appears only on the final confirm. `after-help-full-390.png`, `after-privacy-full-360.png`, `after-privacy-full-820.png`, `after-delete-full-390.png`.

Reduced motion: nothing new animates; the only motion on these pages is the existing `Reveal` on notices and the card press depth, both already reduced-motion aware.

## Checks

- `npm run typecheck`: pass. `npx eslint . --max-warnings 0` on everything except `src/services/profile/documentStore.ts`: pass. `npm test`: 54 suites / 376 tests pass; the one failing suite is `src/services/profile/documentStore.test.ts`.
- `npm run check` as a whole fails on that same file (an unused `withoutStamps` warning and the failing test). `documentStore.ts` and its test are modified in the worktree by the parallel engineering re-check, not by this pass (`src/services/` is out of my scope), so I left them alone. Re-run `npm run check` once that change lands.
- `E2E_PORT=4872 E2E_API_PORT=4873 npm run e2e -- e2e/profile.spec.ts`: 21 passed (phone-390, phone-360, tablet-820).

## Remaining issues

- **MINOR (engineering, QA 2): no confirm before deleting mood entries.** The consequence is now visible at the switch, but it is still one tap and irreversible, and the offline wording says "deleted" when the delete is queued. A Keep / Turn off confirm and an "will be deleted when online" line need logic and copy, so not done here.
- **MINOR (engineering, QA 6a): Tab order runs into the inactive Home tab** (the mounted map's stops stay focusable under an `aria-hidden` ancestor). The heading audit shows the same: Home's zone cards are `h1`s on the Profile page. Tab layout, from an earlier step.
- **MINOR (engineering, QA 6b): arrow-key movement inside the radio groups** (one Tab stop per radio). Keyboard handling, not presentation; the groups now have names.
- **MINOR (engineering, QA 6d): Escape does not close the delete confirmation.**
- **MINOR (design, backlog): Help's two info cards keep their titles inside the card** while Profile and Privacy use title-over-card sections. Consistent enough to ship; worth unifying when MHP's real copy arrives and the page is re-laid.
- **Not tested:** native (haptics, reminder scheduling, Share for export), Safari and Firefox, a real screen reader.

VERDICT: PASS
