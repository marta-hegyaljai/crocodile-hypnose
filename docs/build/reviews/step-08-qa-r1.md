# S08 QA round 1 (Profile and settings)

Build: web export with EXPO_PUBLIC_DEV_MODE=1, API on 4840 (fresh DB), Chromium via Playwright at 390x844, 360x640, 820x1180. Accounts were created through the real sign-up screen; onboarding/settings/progress/mood were then seeded over the API, as the e2e spec does, so "Sessions" and "Calm minutes" read 0 (no real session was played).

## Acceptance criteria
- Profile tab: croc, name, email, summary shown. PASS. Rename saves, trims, shows on Home and on a second device; empty -> "Enter a name."; 40 chars refused.
- Reminder on/off, time, Morning/Evening presets: PASS. Server reflects `enabled/time/timeOfDay`; invalid times ("7:1", "25:00") show an error and change nothing; persists across reload and a second browser context.
- Sound, haptics, default length, reduced-motion override (Follow/Reduce/Full -> `null/true/false`): PASS, instant, persisted, same on a second device.
- Mood consent off: PASS. `DELETE /me/mood` ran: server mood entries 3 -> 0, `settings.moodConsent=false`, onboarding `firstSession.moodBefore` nulled, local mood log emptied, stays off after reload, can be turned back on.
- Re-take safety check: PASS. Yes on Q1 -> info + acknowledge -> "Cautious mode is on", server `cautionMode:true`; the map marks Intro stop 6 "Not suggested for you" (pink dashed node) and it survives reload; No again restores it (e2e covers the way back).
- Help and Privacy pages: PASS (placeholder copy clearly bracketed and dashed-underlined for MHP).
- Export: PASS. JSON block shown with a Copy button ("Copied" feedback, clipboard holds all 2921 chars); no password hash or tokens in it.
- Delete account: PASS. Empty password -> field error; wrong password -> "That password is not correct. Your account was not deleted." and `/me` still 200; cancel and reopen clears the password; right password -> Welcome with "Your account was deleted."; signing in again -> "Email or password is incorrect."; old token -> 401; a second signed-in browser lands on Welcome on reload.
- Sign out: PASS (to /welcome, local keys cleared, Back stays on Welcome).
- Layout: no horizontal overflow, no control under 44px, every control has an accessible name at 360x640 and 820x1180 (checked with an audit script on Profile, Help and Privacy). No console or page errors in any run.
- BLOCKED: native reminder scheduling (the web build says "This device cannot show reminders. The setting is saved for your other devices."), native Share for export, haptics and sound output, and system reduce-motion (only the in-app override was exercised).

## Findings

### MAJOR
1. **Raw template placeholder in a user-facing error.** Profile -> Croc name, type 40 characters, Save: the error reads "Use at most {n} characters." (the `{n}` is never filled in). Screenshot: `docs/build/screenshots/qa/step-08/03-name-toolong.png`. Expected "Use at most 24 characters." (or whatever the limit is). Fix the interpolation where the name validation error is created (the same helper is probably used on the onboarding name field; check there too).

### MINOR (for BACKLOG)
2. **Consent-off is one tap, irreversible, with its confirmation off-screen.** The Mood check-ins switch sits between Haptics and the length picker; tapping it deletes server data immediately. The only warning is the small hint under the label, and the "Mood check-ins are off and your saved entries are deleted." note renders below the fold at 390x844 and 360x640 (screenshot `05-consent-off.png`: nothing visible changes except the switch). Suggest a short confirm ("Delete your mood entries?" Keep / Turn off) or at least scrolling the confirmation into view. Offline the same note says the entries "are deleted" although the delete is only queued (it did sync once back online, moods 2 -> 0).
3. **Zero-width-only croc name is accepted** (known, S03 backlog), so the header and Home show an invisible name.
4. **Emptying the reminder time field gives no error** and keeps the previous time silently (field shows empty, server keeps old value). Also an invalid time stays typed in the field until the user fixes it; fine, but the empty case should say "Enter a time like 08:30".
5. **Email is ellipsised in the header** at 390 and 360 ("qa-...@exa..."). Allow wrapping so the account is verifiable (it matters before deleting).
6. **Keyboard / screen reader:** (a) while on Profile, Tab continues past the tab bar into the mounted-but-inactive Home map (today-play, 20+ stop nodes); Home's container has an `aria-hidden` ancestor yet its buttons stay focusable (probably the tab layout from an earlier step, but it hits Settings users too). (b) Segmented radio groups (length, motion, reminder time) have no group name and no arrow-key movement (one Tab stop per radio). (c) All section titles are exposed as level-1 headings. (d) Escape does not close the delete confirmation (Enter submits and focus lands on the confirmation title, which is good).
7. **Export block** is a small fixed-height inner scroller (about 280px) showing ~15 lines of 2.9 KB, so a user has to scroll a box inside a scrolling page; Copy works, so acceptable. A "Select all" tap target or taller box would feel calmer.
8. **Summary reads 0 min / 0 sessions** on an account that has finished five stops (here because progress was seeded, not played); please confirm in the next full-flow check that Sessions/Calm minutes move after a real session.
9. The delete section shows a heading "Delete account" and then, after the tap, another "Delete account?" panel; and the delete button is the only red (danger) item, which is good, but a distance from Export is small. Cosmetic.

## Tone and theme
Calm and on-theme: croc avatar in the header, green cards, pill switches, a pink dashed "not suggested" node that is gentle rather than alarming, and honest, non-scary delete copy that mentions MHP Coaching. Placeholder copy is bracketed and marked for MHP. Wrong-password feedback is clear and says nothing was deleted.

Screenshots: `docs/build/screenshots/qa/step-08/` (03-name-toolong, 04-reminder-on, 05-consent-off, 09-retake-result, 10-home-caution, 12-export, 14-delete-wrong, 17-profile-360, 17-profile-820, 18-profile-bottom-360, 19-privacy-820).

VERDICT: CHANGES REQUIRED
