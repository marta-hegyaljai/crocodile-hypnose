# Step 3: Onboarding

## Scope
A first-run flow after sign-up (and for any signed-in user who hasn't finished it). Daylight Riverbank style, the croc present and reacting on every screen, a progress indicator (e.g. a little river path or stepping stones the croc moves along).

1. **Goals:** pick 1–2 of Sleep, Stress, Confidence, Focus, Habits (placeholder labels, each with an illustrated icon). Selection limit enforced with clear feedback. Sets the recommended starting zone.
2. **Experience and timing:** new to hypnosis or experienced; morning or evening; session length preference (short / medium / long). Sets defaults for session length and reminder time.
3. **Safety check:** three yes/no questions (placeholder text, e.g. "[Safety question 1]"). Store answers locally and on the server as a flag set; answering "yes" to any shows a calm, non-alarming info screen (placeholder text) and sets a `cautionMode` flag that later steps use to limit content. Never shared with anyone. Can be changed later in settings (step 8).
4. **Consent:** explicit opt-in for storing mood check-ins (health data). The app works without it (mood checks are then skipped or kept only in memory).
5. **Hatch the croc:** the egg wobbles; tap it 3 times to crack and hatch (satisfying animation, particles, haptic on native, sound hook). Then name the croc (default "Croc", trimmed, 1–20 chars, emoji allowed, no blank). The croc is now the user's companion at Stage 1 → hatchling.
6. **First session:** a short guided "first calm" moment that switches to Night River (croc sinks under the water as the transition), plays a placeholder audio track of ~60–90 s with a simple breathing visual, then surfaces back to Daylight. Mood check before and after only if consent was given. (A minimal version; the full player comes in step 5, so build it so step 5 can replace it.)
7. **Reminder opt-in:** asked only now. Uses the chosen morning/evening time; native schedules a local notification; web shows an informative fallback. Skippable.
8. **Done:** celebration with the croc, first points granted (placeholder amount), land on the signed-in home placeholder.

## Rules
- Progress persists per step (local store + server profile `onboarding` field). Reload or app kill resumes at the same step; completed onboarding never shows again. Signing in on a second device with onboarding finished skips it.
- Back navigation works on every step without losing answers. Skip is available where the brief says skippable.
- Server: extend `server/` with `GET/PUT /me/onboarding` and `GET/PUT /me/settings` (validated, versioned so later steps can extend), plus tests.
- All user-facing text in src/copy as neutral placeholders.

## Acceptance criteria
- `npm run check`, server tests and e2e pass; e2e covers a full onboarding from sign-up to home, and a reload in the middle resumes correctly.
- Every step works at 390x844, 360x640, 820x1180 with keyboard and screen reader labels; tap targets ≥ 44px; reduced motion replaces animations with simple fades.
- The hatching moment and the sink-under transition feel delightful and polished.
