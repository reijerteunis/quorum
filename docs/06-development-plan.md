# Quorum — Development Plan

*Status: v1 plan, 2026-08-25 — M1 closed; M2's ticket list extended 2026-08-24 with the Q-0034–Q-0037 reconciliation work, and again overnight with Q-0038–Q-0040, opened from Q-0035's chore review and from the items the M1 and Q-0034 entries defer to M2. Milestones are ordered by risk, not by screen. Each milestone ends with a demo that a stranger could follow. The cold-clone test is the finish line.*

*M0 closed 2026-08-22 — see the DECISIONS entry. Both of its forward-looking findings are now
resolved: contracts are executable (`ajv` + `harness validate`), and M1's dogfood ticket is
**Q-0011 run history on disk**, pulled forward from M2, because Q-0006's serial single-role
tasks cannot demonstrate "two roles on two vendors". Q-0006 still ships in M1 as the review flow
itself — it is the wrong vehicle for the fan-out demo, not the wrong feature. M1's `development`
fan-out therefore runs on Q-0011, with the new repo-local `developer-tooling` role (claude) beside
`developer-backend` (codex); `developer-frontend` cannot serve, since its paths (`apps/*`,
`packages/ui`) do not exist until M3.*

## How to read this

- **M0–M1** retire the two unknowns (real CLIs, real repo) with the spike code.
- **M2** turns the spike into the product's core and makes Quorum develop itself.
- **M3–M5** add the daemon, the UI and the compiler — the visible product.
- **M6** is the launch: README, heyruud.com post, cold-clone test passed by someone else.

Every milestone: definition of done, the tickets to create in `backlog/`, and the questions it must answer. Estimates assume one person working evenings/weekends; halve them for full-time.

---

## M0 — Real adapters on a real repo (≈ 1 week) — ✅ closed 2026-08-22

**Goal:** the four adapter-contract questions answered with evidence, `requirements` and `solutioning` run end to end on real Claude Code + Codex CLI on one of your SaaS repos.

**Done when**
- `quorum adapters` reports both CLIs ✓ and refuses when an API key is in the environment.
- One real ticket goes `draft → requirements → solutioned` with real models; the ticket folder and `runs.log` are committed as the first fixture.
- `docs/03-adapter-contract.md` has the "verified" column filled in for each flag and JSONL field.
- Cost per stage recorded in DECISIONS.md.

**Tickets**
- Q-0001 Run requirements flow on a real repo; fix adapter flags that differ from docs.
- Q-0002 Run solutioning flow; judge whether Claude's `revise` improves Codex's second draft (write the verdict in the ticket).
- Q-0003 Decide Codex cost reporting (tokens only vs priced) — decision entry.

**Risk it retires:** structured output on subscription CLIs. If this fails, everything else is moot; the fallback is the trailing-JSON extraction already in the adapter.

---

## M1 — Red → green on a real repo (≈ 1 week) — ✅ closed 2026-08-24

**Goal:** `qa-red` and `development` with fan-out and integrate on real code, followed by the bounded review engine and its shipped human-facing surface.

**Done when**
- Contracts emitted by the architect are concrete enough that QA's tests compile and fail on assertions (red proven by a `type: integrate` step with `expect: fail`).
- Two roles on two vendors fan out into worktrees, integrate, and reach green within 3 iterations.
- Q-0006's review engine provides round numbering, diff materialisation, bounded cross-flow regression, retry/exhaustion semantics, rework sync, audit, and failure containment.
- Q-0033's review surface ships `review.yaml` and `code-reviewer`, repository defaults and init behavior, whole-directory lint/run preflight, explicit gate answers, and matching documentation; the flow runs once with a Claude + Codex panel and a derived backward edge to development's consumed stage.

**Tickets**
- Q-0004 qa-red on the M0 ticket. *(Done 2026-08-22 — the role needed no tuning; six engine defects did. See the DECISIONS entry "Red for the right reason is an engine property".)*
- Q-0005 development fan-out; record merge-conflict rate and iterations to green. *(Never created as a ticket — the work was done inside Q-0011 and Q-0033 and is recorded there.)*
- Q-0011 Run history on disk *(pulled forward from M2; green 2026-08-23 — M1's first two-vendor fan-out; its stage was later regressed to `red` by a review backward edge and never moved back, while the code is contained in `main` — see Q-0034's closing entry)*.
- Q-0006 Implement `review.yaml` + cross-flow backward edge (`goto: flow:development` regresses stage). *(Split 2026-08-22: Q-0006 is the engine half, Q-0033 the CLI/lint/assets/docs half. 30 criteria in one ticket hit the bound at every stage.)*
- Q-0033 Review flow surface — CLI, lint, config, shipped assets and docs. Depends on Q-0006.
- Q-0007 Map failing tests → tasks (replace "re-run all tasks" with targeted retry) if Q-0005 shows it matters. *(Never created — `scope: failing-tasks-only` shipped with the fan-out and is exercised by Q-0033.)*

**Risk it retires:** the contracts-before-tests mechanism and multi-vendor worktree integration.

*Closed 2026-08-24 — see the DECISIONS entry. All four criteria met: red proven on three tickets,
a five-task two-vendor fan-out green in three iterations, and the review flow run end to end with
its backward edge regressing a ticket. Q-0005 and Q-0007 were never created as tickets: the fan-out
and targeted-retry work they describe was done inside Q-0011 and Q-0033 and is recorded there.
Five items are carried into M2, of which two — no lock on a ticket, and a review backward edge with
no red phase — should be settled before M3's daemon makes concurrent runs ordinary.*

---

## M2 — `packages/core` in TypeScript, Quorum develops Quorum (≈ 2 weeks)

**Goal:** the spike becomes the product core; from here every feature is a ticket run through the flows.

**Done when**
- Monorepo scaffold per `04-architecture.md` (pnpm, Turborepo, TS strict, Vitest, ESLint).
- `packages/core` ports engine/backlog/fanout/git/adapters with zod schemas for flow, ticket, role, step output; public API as documented.
- The 30-check smoke test passes as a Vitest suite; CI runs it on every push.
- `packages/cli` wraps core with the spike's commands; `npx quorum` works from a clean clone (no UI yet).
- `quorum/harness/` and `quorum/backlog/` exist; Q-0010 onward are run through the flows themselves.

**Tickets**
- Q-0008 Monorepo scaffold + CI.
- Q-0009 Port core to TypeScript with schemas (one ticket per module is fine).
- Q-0010 CLI package; `npx quorum` entry.
- ~~Q-0011 Run history on disk~~ — pulled forward into M1 and closed there.
- Q-0012 `qa-final.yaml` and `deploy.yaml` (human-locked gate) — completes the seven SDLC flows (eight shipped files, counting `chore`).
- Q-0034 Reconcile the unmerged green branches (Q-0006, Q-0011) — land both, re-derive the empty-diff cause.
- Q-0035 The empty-range diagnostic reports evidence, not a story. *(`reviewed` and
  `main:contained` 2026-08-25.)*
- Q-0036 What `green` means, and where the code is — the board's git-derived containment annotation.
- Q-0037 Run-history review remainder — one major and eight nits.
- Q-0038 Deferred-range failures name their producing step in every case. Its body also records
  two neighbours it explicitly does not own — the chore flow cannot run on a ticket's first pass,
  and `budget.per_run_usd` stops nothing — each of which still needs its own ticket.
- Q-0039 One run at a time per ticket. Open since M1, where two runs overlapped twice in one night
  and one run's rollback moved a branch another live run was holding.
- Q-0040 A gate can say "undecided". A non-interactive run that reaches an unanswerable gate
  currently fails, and `finish()` then rolls back work the run had already proven green — it has
  cost Q-0036 and Q-0035 their merges on consecutive nights.

**Carried into M2 by the M1 and Q-0034 closing entries, not yet ticketed.** `finish()` does not roll
back task branches, so a failed run leaves work the next run syncs into. `harness run` cannot aim a
diff at anything but `{base}...integration`, which is why a merged ticket cannot be reviewed; a
`--base <ref>` flag is the small fix. A review backward edge has no red phase, so the loop's green
proves the agents ran rather than that they fixed anything. Q-0011's stage reads `red` while its
code is contained in `main`, and what a stage means after a backward edge is undecided. Q-0039 and
Q-0040 are listed above rather than left here because both entries say they should land before M3
makes concurrent and unattended runs ordinary.

---

## M3 — Daemon + mission control (≈ 3 weeks)

**Goal:** the hero screens exist and are driven by real runs.

**Done when**
- `packages/server`: start/stop runs, stream events over WebSocket, answer gates.
- `apps/web`: projects home, backlog board, mission control (parallel trace columns, per-vendor cost tickers, step timeline), gate screen (verdict, side-by-side diffs, advance / take the other / re-run with edited instructions, override with reason), run history.
- `quorum open` starts daemon + browser; CLI and UI can both answer the same gate.
- Resumable runs after daemon restart.

**Tickets**
- Q-0013 Server package with REST + WS; event schema in `shared`.
- Q-0014 Web app shell, theme, routing, WS client.
- Q-0015 Mission control screen.
- Q-0016 Gate screen with diffs (git diff rendered; `diff2html` or similar).
- Q-0017 Backlog board + ticket page (folder rendered as tabs).
- Q-0018 Run history + trace drill-down.
- Q-0019 Resume interrupted runs.

---

## M4 — Editors + step chat (≈ 2 weeks)

**Goal:** Quorum is an editor over the harness, not just a runner.

**Done when**
- Flow editor: form generated from the flow schema, YAML preview, lint errors inline, templates drawer.
- Harness editor: markdown editing of context files and roles, with the compiler status panel (M5 fills it).
- Step chat for interactive steps (PM clarifying questions, gate conversations); requirements stage can run interactively.
- "Open this worktree in editor/terminal" one-click.

**Tickets:** Q-0020 flow editor · Q-0021 harness editor · Q-0022 interactive step type + step chat · Q-0023 open-in-editor.

---

## M5 — Harness compiler (≈ 2 weeks)

**Goal:** the second headline feature: write rules once, every CLI obeys.

**Done when**
- `quorum compile` generates `CLAUDE.md` (with `@harness/` imports), `AGENTS.md`, `GEMINI.md` as thin linked/inlined files with generated headers.
- Drift detection surfaces in the harness editor and on the projects home.
- Native pass-through sections for `.claude/agents`, skills, commands; roles can map to Claude subagents.
- Adapter runs set the generated files so the agents actually read them (verified on a real run).

**Tickets:** Q-0024 compiler core · Q-0025 drift detection · Q-0026 pass-through sections · Q-0027 verify agents obey compiled rules (real run).

---

## M6 — Launch (≈ 2 weeks)

**Goal:** pass the cold-clone test with someone who isn't you; publish.

**Done when**
- README is the only document a stranger needs: install, login check, init, first ticket, first gate, first merged branch, in under 30 minutes — timed by two outside testers. Scope of that path is undecided: one stage fits, seven do not (see 01's measured constraint). Settle it before writing the README.
- `npm publish` as `quorum` (or `@heyruud/quorum`), GitHub repo public with roadmap (Gemini adapter as "good first issue", desktop shell, canvas, evals, CI mode).
- heyruud.com: launch post (the story: why multi-vendor + gates, what the spike found), docs entry page linking to the repo, one demo recording of mission control on a real ticket.
- Social plan for Bluesky/X/LinkedIn queued.

**Tickets:** Q-0028 README rewrite + cold-clone timing · Q-0029 publish pipeline + versioning · Q-0030 launch post · Q-0031 demo recording · Q-0032 social campaign.

---

## Working agreements

- Ticket ids are `Q-nnnn`; the backlog is `backlog/` in this repo; from M2 every ticket runs through the flows (dogfood is the test suite).
- Every milestone ends with a DECISIONS.md entry: what was learned, what changed.
- Anything product-specific discovered while dogfooding on feedmind/flextann goes into *that* repo's `harness/`, never into Quorum.
- Cost is tracked per ticket from M0; a budget line lands in `harness.yaml` before M3.
- The cold-clone test is re-run at the end of M3 and M5, not only at M6.

## Sequence at a glance

```
M0 adapters ─▶ M1 red/green ─▶ M2 core+cli ─▶ M3 daemon+UI ─▶ M4 editors ─▶ M5 compiler ─▶ M6 launch
 1 wk           1 wk            2 wk            3 wk            2 wk          2 wk           2 wk
```

Roughly three months part-time. If M0 or M1 surprises you, stop and rethink before M2 — that's what they're for.
