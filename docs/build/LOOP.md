# The build loop

How MHP Hypnose is built: four agents, one orchestrator, steps pipelined. Version 2 (2026-10-07), adopted from the Answerstone loop (`answerstone/docs/12-agent-loop.md`) after steps 1–3 here showed the same overhead: long engineer rounds, minors bundled into fix rounds, and re-checks that re-tested whole steps.

## Roles and models

The model follows the step's risk, not the role. Use the cheaper, faster model wherever a stronger one wouldn't change the outcome.

| Agent | Definition | Default model | Stronger model when | Job | Edits code? |
| --- | --- | --- | --- | --- | --- |
| Orchestrator | the main session | Opus | — | Picks steps, briefs agents, watches the clock, decides, commits, keeps `PLAN.md` true | Commits; small merge and one-line fixes |
| Implementation engineer | `.claude/agents/implementation-engineer.md` | Sonnet | Opus for steps with real design judgement, data-integrity or security weight (sync, accounts, points ledger). Fable for illustration-heavy work (new mascot or scene art) | Builds the step, tests it, hands over | Yes |
| Code reviewer | `.claude/agents/code-reviewer.md` | Sonnet | Opus for round 1 of security- or data-relevant steps (auth, server, sync, ledger, health data) | Strict review of the diff; blocking issues only | No |
| QA engineer | `.claude/agents/qa-engineer.md` | Sonnet | Opus only if a step's QA needs product judgement Sonnet missed | Uses the real app like a user | No |
| Designer / UI-UX | `.claude/agents/ui-designer.md` | Fable | — | Polishes what a user sees | Presentation only |
| Re-checks (round 2+) | the same definitions | Sonnet | — | Verifies the listed fixes only | No |

## Which agents a step gets

| Step type | Examples | Agents |
| --- | --- | --- |
| **Visible UI** | onboarding, river map, player, games, habitat, settings | engineer → reviewer ∥ QA → designer |
| **Backend / data** | sync endpoints, ledger, migrations with no new screen | engineer → reviewer ∥ QA (smoke-level: run it for real) |
| **Tooling** | scripts, build config, test harness | engineer → reviewer |

## A step

A step is one item from `PLAN.md` → Steps (or a tightly coupled bundle). Its id is `S<nn>`.

```
 [1] Engineer builds (in the step's worktree) ──► orchestrator commits a WIP on the step branch
                                                   │
                       ┌───────────────────────────┴───────────────┐
                       ▼                                           ▼
                 [2] Reviewer                                [2] QA (if the step type has it)
                       └───────────────┬───────────────────────────┘
                                       ▼
                      any BLOCKER/MAJOR? ──yes──► [1'] engineer fixes only those
                                       │              ──► [2'] re-check of those fixes only (Sonnet)
                                       no
                                       ▼
                      [3] Designer (visible UI only)
                                       ▼
                      [4] Orchestrator: checks green, merges to main, marks status, pushes
```

**Pipelining.** While step N is in review/QA/design, the engineer for step N+1 starts in its own git worktree (`../crocodile-hypnose-wt/S<nn>`, branch `step/S<nn>`), as long as N+1 doesn't depend on unmerged code from N. The orchestrator merges `main` into a step branch before its review starts if `main` moved. `claude/fervent-rubin-7i8lut` is the integration branch and is kept equal to `main`.

## Time boxes

Agents are told their time box in the brief. The orchestrator checks on any agent that overruns by 50% and stops it if it is stuck.

| Agent | Time box |
| --- | --- |
| Engineer, round 1 | 30 min (45 for an Opus or Fable step) |
| Engineer, fix round | 15 min |
| Reviewer | 10 min |
| QA | 15 min |
| Designer | 20 min |
| Re-check | 5–10 min |

**Refused or blocked actions:** if a tool call, permission, network or environment limit refuses an action, the agent tries **one** alternative that stays within the rules, then stops and reports it as BLOCKED with the exact limit. It never retries variations of a refused action.

## Rules that keep the loop moving

1. **Round limit: three.** If a step isn't clean after round 3, the orchestrator decides: split off the stuck part, accept a non-critical finding as a recorded follow-up, or escalate to the owner. Never a fourth silent round.
2. **Only BLOCKER (or QA/design MAJOR, or reviewer MAJOR) findings go back to the engineer**, and a fix round contains only those. MINOR findings are recorded in the report and collected in `docs/build/BACKLOG.md` (the polish list), fixed once at the end of a phase (or by the designer in passing if trivial). The orchestrator does not bundle minors into a fix round.
3. **Re-checks are scoped to the fixes.** A re-check reads the fix diff and the finding it answers, runs the fast checks, and confirms or rejects each fix. It doesn't re-test the whole step.
4. **No goal-post moving.** A re-check can't raise a new issue on code that didn't change in the fix round, unless it's a real defect (security, data loss, wrong behaviour).
5. **Disagreements** between agents are decided by the orchestrator against `docs/`; the decision goes into the step's report.
6. **No faking.** Anything that needs a missing credential, a device, or an owner decision is reported as BLOCKED with the exact thing needed. It never gets mocked into a PASS.
7. **Scope stays put.** Work belonging to a later step is sent back unless the orchestrator logged a decision.
8. **Short briefs, short reports.** The brief names the step, the docs that matter, the base commit, the worktree, the ports and the time box. Reports are short: verdict, commands, findings. No restating of the requirements.
9. **Trust the fast checks.** Engineers run `npm run check` (+ `npm run server:test` when `server/` changed) plus the targeted e2e specs; the full e2e suite only when the harness or shared flows changed.
10. **Shared machine, own processes only.** Every agent starts servers on the ports its brief assigns (API `PORT`, web via `npx serve <dir> --listen <port> --single`, `E2E_PORT`), records their PIDs, and stops only those PIDs. `pkill -f`, `killall` or any pattern-based kill is forbidden.
11. **Copy.** No agent invents marketing copy, slogans or creative names. All text lives in `src/copy` as neutral placeholders until MHP provides the real text.
12. **Agents don't commit.** The orchestrator commits each round's work with a clear message.

## Status and evidence

- Only the orchestrator sets a step to `DONE` or `BLOCKED` in `PLAN.md` → Status, after reading the reports, and fills `Evidence` with date, commit, the round it passed in, and the report names.
- Briefs: `docs/build/steps/step-<nn>.md`. Reports: `docs/build/reviews/step-<nn>-<review|qa|design>-r<round>.md`. Screenshots: `docs/build/screenshots/` (keep them few and small).
- One merge to `main` per completed step: `S<nn>: <title>`, squashed, pushed.

## What runs where

| Thing | In this build environment |
| --- | --- |
| Node 22, npm, Playwright + Chromium (`/opt/pw-browsers`) | Available. Never run `playwright install` |
| API | `server/` dev stand-in for the MHP account service + app API (node:sqlite) |
| App | Expo web build tested in Chromium at phone sizes |
| iOS / Android devices | Not available: native-only behaviour (notifications, haptics, background audio, sensors) is BLOCKED until tested on a device |
| Real MHP Coaching auth | Unknown backend: OIDC adapter BLOCKED until the owner says what Coaching uses |
