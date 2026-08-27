# Quorum — Development Plan

*Status: v1 plan, 2026-08-27 — M1 closed; M2's ticket list extended 2026-08-24 with the Q-0034–Q-0037 reconciliation work, again overnight with Q-0038–Q-0040, opened from Q-0035's chore review and from the items the M1 and Q-0034 entries defer to M2, and again on 2026-08-25 with Q-0041–Q-0054, the per-module cut of Q-0009's port, and with Q-0055–Q-0057, opened from Q-0041's chore run and its erratum, and again on 2026-08-26 with Q-0058–Q-0061, the four new defects Q-0043's implement step reported and did not fix, and with Q-0062–Q-0064, opened from Ruud's review of the harness the same day — the worktrees nothing prunes, the unhandled `EPIPE` that has been failing CI since 2026-08-24, and `core/src`'s folder layout — and with Q-0065, raised as an open question by Q-0064's own requirements run, and with Q-0066, the live probe defect Q-0046's chore run preserved and pinned rather than fixed in passing, and again on 2026-08-27 with Q-0067 and Q-0068, both opened at Q-0047's requirements gate — the deferred version probe, and the product name in the BYOS refusal, and later the same day with Q-0069, the deprecated zod API and the gate gap that let it accumulate (Q-0065's body, which had been appended to Q-0066's entry in the previous edit, was returned to it in the same change), whose own line was rewritten to what shipped later that day when it was implemented, and corrected again once its AC-11(b) was closed by human commit and the surface question behind it was ruled. M2's done-when corrected 2026-08-25 (Q-0009): the zod schemas live in `packages/shared` and `core` imports them, which is what 04-architecture.md always said. Milestones are ordered by risk, not by screen. Each milestone ends with a demo that a stranger could follow. The cold-clone test is the finish line.*

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
- `packages/core` ports engine/backlog/fanout/git/adapters against the zod schemas for flow, ticket, role and step output that `packages/shared` defines (04-architecture.md is the authority: the schemas live in `shared`, `core` imports them); public API as documented.
- The 30-check smoke test passes as a Vitest suite; CI runs it on every push.
- `packages/cli` wraps core with the spike's commands; `npx quorum` works from a clean clone (no UI yet).
- `quorum/harness/` and `quorum/backlog/` exist; Q-0010 onward are run through the flows themselves.

**Tickets**
- Q-0008 Monorepo scaffold + CI.
- Q-0009 Port the spike to `packages/core` — the parent. Owns the port's ground rules (the spike
  stays authoritative and green until cutover; the CLI's domain logic moves into core; behaviour is
  preserved except for the event stream), the order, and the cutover itself. Ports nothing; the work
  is Q-0041–Q-0054 below, cut per module because `engine.js` alone is 1,113 lines and the sizing
  decision of 2026-08-22 puts a ticket at roughly ten criteria.
  - Q-0041 `packages/shared` — zod schemas, the trace/event format, constants.
  - Q-0042 `core/git` — worktrees, ancestry, containment, shallow state.
  - Q-0043 `core/backlog` — tickets, frontmatter, stages, and `loadProject` lifted from the CLI.
  - Q-0044 `core/lint` — flow lint and whole-directory validation.
  - Q-0045 `core/contracts` — ajv validation and the `run-manifest-v1` semantic pass.
  - Q-0046 `core/adapters` — the contract layer and the mock adapter.
  - Q-0047 `core/adapters` — claude and codex, with the per-adapter `capabilities` split.
  - Q-0048 `core/fanout` — tasks, waves, worktrees, branches.
  - Q-0049 `core/run-history` — manifest, occurrences, roll-ups, and the reader lifted from the CLI.
  - Q-0050 `core/engine` — the run loop, routing, stage transitions, and `runFlow` as an event stream.
  - Q-0051 `core/engine` — diff preflight and materialisation.
  - Q-0052 `core/engine` — agent, gate and script steps.
  - Q-0053 `core/engine` — fan-out and integrate steps.
  - Q-0054 The regression suite on Vitest, and CI gating the port.
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
- Q-0055 Lint requires a step id wherever the engine interpolates one. `lintFlow` requires an `id`
  on no step kind; `engine.js:211` names a worktree branch after it and `engine.js:541` keys a loop
  counter with it, so an id-less step lints clean and creates `harness/<ticket>/undefined`. Lands
  after Q-0044 so the fix is written once in the ported lint. Its body also carries a neighbour that
  still needs its own ticket — a later run's review overwrites an earlier run's, because
  `chore.yaml:34`'s `{iter}` is run-scoped.
- Q-0056 What `route` is, and the qa-final sketch that cannot lint. Blocks Q-0012: the sketch at
  `02-sdlc-pipeline-spec.md:345–376` fails the real `lintFlow` on both of its verdict steps, and
  `route` has three incompatible descriptions (a step property in lint, a step kind in the spec,
  unimplemented in the engine) with no shipped flow using it.
- Q-0057 A chore run's reviews overwrite the previous run's, and the survivors mix. `chore.yaml:34`'s
  `{iter}` is run-scoped (`engine.js:45`) while `review.yaml`'s `{round}` is ticket-scoped
  (`engine.js:753`); run 3 overwrote two of run 2's three reviews on Q-0041, and the glob at
  `chore.yaml:13` then fed the mixture back to the implementer. Swapping `{iter}` for `{round}`
  reproduces it, since `reviewRound` counts directories chore never creates. Worth settling early —
  every remaining child of Q-0009 runs this flow.
- Q-0058 `harness.yaml` documents a retry key nothing reads. The commented example at
  `harness/harness.yaml:11` and in the shipped template says `base_delay_ms`; `withRetry`
  destructures `baseDelayMs` (`spike/src/adapters/index.js:68`), so an adopter's value is discarded
  in silence — masked because the ignored value and the default are both 5000. Reaches the
  cold-clone path via `harness init`. Also where Q-0043's `projectConfigSchema`, shipped declared
  and called nowhere, gets its first caller if the fix is validation.
- Q-0059 `dirOf` accepts a traversing argument and reads outside the backlog root
  (`spike/src/backlog.js:34`, now `packages/core/src/backlog/backlog.ts`). Q-0043's non-goals carry the
  write-side twin but name `writeFile` only. Barely reachable today because every caller passes a
  CLI argument; M3's server takes a ticket id over HTTP, so it wants settling before the daemon.
- Q-0060 A damaged or CRLF `ticket.md` reads as a ticket with no fields, silently. The regex at
  `backlog.js:12` is anchored on `\n` and line 13 falls open to `{ meta: {}, body: text }` — no
  error, contradicting the "never default silently" rule, under the module the product calls its
  database. Constrained by `parseFrontmatter` also being the role-file reader
  (`engine.js:727–732`), and the obvious fix is refused by Q-0043's AC-4.
- ~~Q-0061 The containment "writes nothing" test snapshots `.git`~~ — **absorbed into Q-0064**
  2026-08-26. Same surface: Q-0064 already moves `git.test.ts` and rewrites `packages/core/test/`,
  where `walk` lives beside `coreSourceFiles`. Its body stays as the evidence.
- Q-0062 Worktrees are never removed. `removeWorktree` exists, is exported and was ported with four
  tests by Q-0042, and has **zero call sites** — four worktrees from two completed, contained
  tickets are on disk now. Decide the lifecycle together with the open M1 item *"`finish()` does not
  roll back task branches"*; they are the same question.
- Q-0063 A vendor CLI that exits before reading its prompt crashes the run with an unhandled
  `EPIPE`. `exec()` (`spike/src/adapters/claude.js:70–83`, shared by both adapters) attaches no
  `'error'` handler to `p.stdin` and then writes the whole prompt to it. Prompts are 54–133 KB
  against a 64 KB pipe buffer, so the write cannot complete in one pass. Triggered by an expired
  login, a rejected model or a crashed CLI — the failures this project has already paid to learn
  about — and it replaces the vendor's message with a `node:events` stack trace. **This is why CI
  has been red on every run since 2026-08-24.** P1.
- Q-0064 `core/src` into folders, plus the flaky containment snapshot. Runs **before Q-0044**.
  Carries Q-0061. Per the 2026-08-26 DECISIONS entry; carries the comment pass for the moved files, and
  must make `coreSourceFiles()` recursive in the same change or three landed house-rule tests
  silently narrow to one file while reporting green.
- Q-0065 `integrate` can report `tests=ok` from a cached pass it never executed.
  `harness/harness.yaml`'s `commands.test` runs `pnpm turbo run test` without `--force`, so the one
  step whose whole job is to prove a suite green can be satisfied by a replay — *"skipped is not
  passed"* (2026-08-25) one layer down. Observed on 2026-08-26: a cached run reported 7/7 while a
  `--force` re-run failed 1 of 123. The shipped template ships `test: npm test` and inherits the
  same hazard for any adopter on a caching runner. Raised as OQ-2 of Q-0064's requirement, which
  correctly refused to change a default affecting every ticket's `integrate`. **Folded in 2026-08-27
  at Q-0047's gate:** `turbo.json` declares no `env`/`passThroughEnv` on `test`, so Turbo strips
  `QUORUM_REAL_CLI` and the command `real-cli.probe.test.ts` documents can never run it — the
  opposite failure through the same knob, and reachable only from a gate, since neither implementer
  nor reviewer may spend a paid CLI round-trip.
- Q-0066 `probeAdapter` reports its own crash as an unusable login. `withRetry` returns
  `usage: null` when no attempt reported a measure (Q-0034, deliberate); `probeAdapter` dereferences
  it unguarded, so an adapter whose login is **perfect** and which reports no usage answers
  `✗ login not usable: Cannot read properties of null…`. The one command that exists to de-risk a
  paid run can blame a healthy login for its own `TypeError`. Preserved and pinned in both trees by
  Q-0046 (AC-11 defect 1) rather than fixed in passing, per *"The port preserves behaviour"*; the fix
  must land in `spike` **and** `packages/core` together or the port loses its independent witness.
  Raised as OQ-6 of Q-0046's requirement.
- Q-0067 The per-adapter version probe, and what an unsupported CLI version does. The deferred half
  of `04-architecture.md:62` — a `capabilities.ts` *"with a version probe"*. Q-0047 ships the
  extraction and not the probe: moving flag names into a data module is internal layout, which the
  charter does not preserve, while a probe adds a CLI invocation, a range that goes stale and a
  policy for an unsupported version, which is behaviour and needs a decision entry first. The
  staleness is already here — `03-adapter-contract.md:122` pins its table to Claude Code 2.1.220 and
  codex-cli 0.149.0 while the machine runs 2.1.231 and 0.149.1, and nothing noticed. Runs after
  Q-0010, which gives it a surface to report on. Opened at Q-0047's requirements gate (Q-1).
- Q-0068 The BYOS refusal calls the product "Harness". `claude.js:12`, `codex.js:21`, their ported
  twins, and the two pinned fixtures at `smoke.js:464` and `adapters.test.ts:314` say *"Harness runs
  on subscription OAuth only"*, which `.claude/rules/product-boundaries.md` forbids. Reported by
  Q-0046 and again by Q-0047, both of which correctly preserved it: a fix in `core` alone leaves the
  spike disagreeing until the cutover, which is the divergence the freeze exists to expose. Lands in
  both trees together, like Q-0066. The decision is what the sentence says instead — it is on the
  cold-clone path, so worth more than a `sed`. Opened at Q-0047's requirements gate (Q-4).

- Q-0069 A deprecated zod API is in use, and nothing in the repository can detect one. *(Implemented
  2026-08-27.)* `packages/shared`'s 21 `.passthrough()` calls — an API zod 4.4.3 marks `@deprecated`
  — became `z.looseObject({ … })`, the constructor zod documents, rather than `.loose()`, which
  carries its own *"Consider `z.looseObject()`"* nudge and would buy one release of quiet. The call
  sites were the morning's work; the blind spot was the subject. `tsc --noEmit` does not error on
  `@deprecated`, and `@typescript-eslint/no-deprecated` needs type information, which
  `eslint.config.js:3` deliberately turned off saying *"`tsc --noEmit` owns types"* — true of types,
  false of deprecation, so nobody owned it and `lint` plus `typecheck` reported 14/14 green over all
  21 sites. That rule is now on at error severity, alone and type-aware, over `packages/**/*.ts` and
  `apps/**/*.ts`; `spike/**` stays outside ESLint entirely and is stated as such in
  `harness/rules.md`. It was demonstrated to fail 21 times over the unmigrated tree before it was
  trusted over the migrated one. A source-text pin ships beside it in `packages/shared`, because
  `commands.test` runs neither gate, so `integrate` cannot see a lint failure — that half is
  Q-0065's argument. See *"Type-aware linting is on for exactly one rule"* (2026-08-27). **Closed by hand, and the
  surface it exposed is now ruled.** AC-11(b) named `.claude/rules/engineering.md`, which is
  outside the chore role's write paths and which Claude Code's own file gate refused through both
  `Edit` and `Write`. Three revise rounds refused it correctly and the loop reached its exhaustion
  gate; the copy was synced by the human commit `89ceacf`, transcribing the wording the implementer
  supplied for exactly that purpose. `harness/rules.md` is canonical and its header names the other
  file as the drift. The general lesson is a decision rather than a footnote: see *"`.claude/rules/`
  is a derived copy, not a surface a requirement may name"* (2026-08-27), which adds *is it
  derived?* to the two questions routing already asked of a surface. The requirement had certified
  that no criterion named `backlog/` — it checked the one unwritable surface anyone had written
  down and never asked the general question, which is *"review the fix round, not only the feature
  round"* (Q-0034) arriving through a document.

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
