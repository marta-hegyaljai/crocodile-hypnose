# Backlog (MINOR findings and later ideas)

| Step | Source | Item |
|------|--------|------|
| 1 | Code review r1 #4 | Croc blink re-renders the whole SVG on the JS thread (3 setState per blink); move the eyelid to a Reanimated `useAnimatedProps` shape before several animated crocs share a screen. |
| 1 | Code review r1 #7 | Placeholder detection is keyed on the string value; interpolated placeholders (e.g. "240 Points") need `placeholder` passed by hand. Consider key-based detection or a branded `t()` result. |
| 1 | QA r1 m1 | Tab bar: arrow keys do not move focus between tabs (ARIA tabs pattern). Space and Enter now activate. |
| 1 | QA r1 m4 | If the page loads with system reduce-motion on and the gallery override then forces full motion, ripples and fireflies may stay still until remount (loops start from the reduced state). |
| 1 | QA r1 m9 | The raised textured card's scale pattern runs through the body text; consider a texture band or lower opacity (now 0.06). Designer call. |
| 1 | QA r1 m10 | ~~Gallery: add a large single-stage croc viewer with an expression picker for design review (cells are small on phones).~~ Done in the designer pass (viewer card with stage, expression and pose pickers). |
| 1 | QA r1 m11 | Not-found screen: the hatchling now fills the width (sleepy expression), but the screen is still a placeholder until the real screen is designed. |
| 1 | Designer r1 | Gallery viewer: in the peek pose the inline water only spans the drawing, not the whole viewer card. Cosmetic, dev-only. |
| 1 | Designer r1 | Croc gradients are declared per drawing in user space; if several crocs with different stages share one SVG later, give the gradient ids a per-instance suffix (Croc.tsx already does this per component). |
| 1 | Designer r1 | The egg's peek frame is the same drawing as the full pose; a dedicated "egg half under water" look could come with the croc tab in a later step. |
| 2 | Code review #1 | Multi-tab / stale-tab refresh triggers reuse detection and signs every tab out. **Orchestrator: must be fixed before step 4 (sync arrives).** |
| 2 | Code review #2 | Lost refresh response signs user out; add a short server-side reuse grace window; note OIDC provider config. **Fix with #1.** |
| 2 | Code review #3 | Web refresh token in localStorage; move to httpOnly cookie / BFF before any public web release. |
| 2 | Code review #4 | Dev reset link leads to not-found; add confirm endpoint + screen or mark as provider-hosted. |
| 2 | Code review #5 | Require recent auth (password re-entry) before account deletion. Step 8. |
| 2 | Code review #6 | Offline sign-out: queue server revoke for next online launch (optional). |
| 2 | Code review #7 | Before shared deployment: trustProxy, separate refresh rate limit, tune SCRYPT_LOG_N. |
| 2 | Code review r3 | Delete-account confirmation stays open if a tab misses the cross-tab notice and switches user; reset it on user change (key screen on user id). Do in step 8 (account deletion moves to settings). |
| 2 | Designer r1 | Web has no screen transition between routes (the native stack animates on iOS/Android). Each sheet now arrives on its own on web; a cross-screen transition (slide between account screens, fade on sign in / out) needs router-level animation config when expo-router supports it on web. |
| 2 | Designer r1 | Landscape account forms: the floating back button stays fixed while a tall form scrolls under it (e.g. Create account with errors at 844x390). Acceptable; a top fade on the column would make it cleaner. |
| 2 | Designer r1 | `AuthScaffold` composes the river band from the sheet's first measured height per window height. If a screen ever swaps to much shorter content without remounting (give it a `key`, as Forgot password and Reset password do), the band stays at the longer form's size. |
| 3 | Code review r1 m2 | Native retries only on AppState `active` (added) and on the next change or launch; no timed backoff for failed writes. A sign-out flushes first now. |
| 3 | Code review r1 m8 | Settings fields onboarding does not own (`sound`, `haptics`) can be overwritten by an onboarding tap while the settings GET is in flight (no impact until step 8 makes them editable): wait for both documents or merge settings field by field. |
| 3 | QA r1 m2 | Croc name: a zero-width space is accepted (invisible name); ZWJ emoji count as several code points; no live counter. |
| 3 | QA r1 m3 | "Experienced" breaks mid-word at 360x640 in the two-column card; MHP's final labels decide the layout. |
| 3 | QA r1 m5 | The safety information is screen state, not a route: browser back skips to Experience, a reload returns to the questions, landscape opens it with the questions' scroll offset. |
| 3 | QA r1 m6 | Focus after a step change lands on `<body>`; move focus to the new step's title so screen-reader users hear it (and Enter cannot land on the next primary button). |
| 3 | QA r1 m7 | Egg cracks reset on reload (taps are not persisted); a typed but unsubmitted name is lost on browser back and forward. |
| 3 | QA r1 m9 | Large empty sheets below short content (First session, Session complete, Consent, Reminder, Done), much more on the tablet; the Done celebration is small. Designer. |
| 3 | QA r1 m11 | Audio failures log uncaught page errors from inside expo-audio ("no supported sources", `NotAllowedError`); the fallback works, the toggle shows "Play" for 2 to 3 s before the silent timer starts. |
| 3 | QA r1 m13 | The focus ring on the night play toggle is faint (amber on amber). |
| 3 | QA r1 m14 | Desktop 1280x800 (not a required size): the jungle leaf covers the start of the hatch title. |
| 3 | QA r2 | Egg focus ring low contrast over dark water (designer may take it in S03 polish). |
| 3 | QA r2 | Mood-after picked but not confirmed is lost on reload. |
| 4 | Review r1 #3 | Clamp per-stop `completedAt` on the server (≤ stop `updatedAt`); don't clamp `updatedAt` (push loop). |
| 4 | Review r1 #4 | Caution mode: Replay offered for finished unsuitable stops; decide with the owner's caution-mode decision (S08). |
| 4 | QA r1 m5/m6 | No zone-complete moment; coming-soon goal falls back to Intro with no explanation; tapping coming-soon zones gives no feedback. |
| 4 | QA r1 m7 | Web cold reload offline needs a service worker. |
| 4 | QA r1 m8 | Stale tab/device doesn't refresh progress until reload (refetch on focus/visibility). |
| 4 | QA r1 m11 | Keyboard: ~19 stop nodes before the tabs; sheet backdrop is a tab stop. |
| 5 | Review r1 | Audio heard while JS is suspended (mobile web, locked screen) isn't counted as listened; count forward steps that match wall time. Confirm on iOS Safari. |
| 5 | Review r1 | Another tab switching user mid-session: completion and resume point land on the new account. |
| 5 | Review r1 | A resumed run reuses its mood-before id, so a new answer is dropped. |
| 5 | Review r1 | Keyboard focus on dimmed player controls doesn't reveal them. |
| 6 | Review r1 | Stillness state not reset on pause/end; no native silence fallback to touch; route accepts any stop/game pairing; breathing guide ring at 10 Hz from JS; breathing hold has no screen-reader alternative; pause overlay doesn't trap focus; parseRecords doesn't validate best; no lifecycle/route tests. |
| 3 | Review S06 | Flaky unit test: onboarding/screens.test.tsx "hatches on the third tap" fails intermittently under full-suite load. |
