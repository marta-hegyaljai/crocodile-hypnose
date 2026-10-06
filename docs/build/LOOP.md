# Build loop

The app is built in steps (see `PLAN.md`). Every step goes through four agents in this order:

| # | Agent | Model | Job in the loop |
|---|-------|-------|-----------------|
| 1 | Implementation engineer (`.claude/agents/implementation-engineer.md`) | Opus (Fable for illustration-heavy steps) | Builds the step, tests it, self-checks it in the browser |
| 2 | Code reviewer (`.claude/agents/code-reviewer.md`) | Opus | Strict, pragmatic review of the diff |
| 3 | QA engineer (`.claude/agents/qa-engineer.md`) | Opus | Hands-on testing of the running app in the browser, exploratory, UX-picky |
| 4 | Designer / UI-UX engineer (`.claude/agents/ui-designer.md`) | Fable | Review plus hands-on polishing to production level |

The orchestrator (the main Claude session) writes the step brief, starts each agent, reads every report, decides, and pushes.

## Rules

1. **Order.** Implement → (code review ‖ QA, in parallel, since neither edits code) → design. Agents that edit code (engineer, designer) never run at the same time.
2. **Severity.**
   - BLOCKER: broken flow, crash, data loss, security hole, unusable UI. Must be fixed.
   - MAJOR: clear bug, missing edge case, missing acceptance criterion, poor UX that a real user would hit. Must be fixed.
   - MINOR: real but small. Goes to `BACKLOG.md`; does not block the step.
   - Nitpicks and nice-to-haves are not findings.
3. **Send back.** If any agent reports a BLOCKER or MAJOR, the step goes back to the implementation engineer with the findings file(s). After the fix, only the agent(s) that raised blocking findings re-verify their own findings (plus a quick regression check). The designer always gets the last look at a step.
4. **No ping-pong.** The orchestrator merges duplicate findings, rejects findings that contradict the plan or are out of scope, and settles disagreements between agents. A step gets at most 3 fix rounds. Anything still open after that is escalated to the user with a clear summary, not looped again.
5. **Files are the hand-off.** Briefs: `docs/build/steps/step-XX.md`. Findings: `docs/build/reviews/step-XX-<agent>-rN.md`. Screenshots: `docs/build/screenshots/`. Minor items: `docs/build/BACKLOG.md`.
6. **Done.** A step is done when the reviewer, QA and designer all report `VERDICT: PASS` (or only MINORs remain), all checks are green, and the orchestrator has pushed.
7. **Copy.** No agent invents marketing copy, slogans or creative names. All text lives in `src/copy` as neutral placeholders until MHP provides the real text.
