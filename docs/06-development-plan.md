# Quorum — Development Plan

*Status: v1 plan, 2026-08-28 — M1 closed; M2's ticket list extended 2026-08-24 with the Q-0034–Q-0037 reconciliation work, again overnight with Q-0038–Q-0040, opened from Q-0035's chore review and from the items the M1 and Q-0034 entries defer to M2, and again on 2026-08-25 with Q-0041–Q-0054, the per-module cut of Q-0009's port, and with Q-0055–Q-0057, opened from Q-0041's chore run and its erratum, and again on 2026-08-26 with Q-0058–Q-0061, the four new defects Q-0043's implement step reported and did not fix, and with Q-0062–Q-0064, opened from Ruud's review of the harness the same day — the worktrees nothing prunes, the unhandled `EPIPE` that has been failing CI since 2026-08-24, and `core/src`'s folder layout — and with Q-0065, raised as an open question by Q-0064's own requirements run, and with Q-0066, the live probe defect Q-0046's chore run preserved and pinned rather than fixed in passing, and again on 2026-08-27 with Q-0067 and Q-0068, both opened at Q-0047's requirements gate — the deferred version probe, and the product name in the BYOS refusal, and later the same day with Q-0069, the deprecated zod API and the gate gap that let it accumulate (Q-0065's body, which had been appended to Q-0066's entry in the previous edit, was returned to it in the same change), whose own line was rewritten to what shipped later that day when it was implemented, and corrected again once its AC-11(b) was closed by human commit and the surface question behind it was ruled. Q-0070 was added the same day, split from Q-0065 at its requirements gate, and Q-0071 with it once Q-0065 shipped and its implement step reported CI carrying the same hazard; Q-0071's own entry was rewritten later that day to what its implement branch did — because an entry describing CI as it stood before that branch contradicted `04-architecture.md` §Testing while the change was in flight — and rewritten once more when it shipped. Q-0072 was opened the same evening from the successor Q-0071's requirements run had drafted in full, and its entry was rewritten to what shipped on 2026-08-28, when Q-0073 was also opened — from the defect Q-0072's own merge left on `main` and every gate reported green over. Q-0070's entry was rewritten on 2026-08-28 when its requirements run landed and both of its blocking questions were settled at the gate, so the line no longer says a decision entry is owed. Q-0073's own entry was rewritten to what shipped later that day, when its chore run also produced a second decision — the nit rule — from a defect that stopped the run rather than from its subject. Q-0070's entry was rewritten again once it was implemented by hand, and Q-0075 and Q-0076 were opened from the two successor bodies its requirement had written out in full — the run-history cap, and the passing command's discarded stderr. Q-0049's entry was rewritten to what shipped the same evening — the first port child to close its revise loop on an erratum rather than at an exhaustion gate — and Q-0037's, Q-0051's and Q-0052's bodies were amended by hand in the same session with the obligations that run declined. M2's done-when corrected 2026-08-25 (Q-0009): the zod schemas live in `packages/shared` and `core` imports them, which is what 04-architecture.md always said. Milestones are ordered by risk, not by screen. Each milestone ends with a demo that a stranger could follow. The cold-clone test is the finish line.*

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
    *(`reviewed` and `main:contained` 2026-08-28.)* Three files, not one, so that three rules are
    checkable rather than intended: `reader.ts` never writes, `writer.ts` is the only file in
    `packages/core` that writes under `.quorum/`, and `reader.ts` does not import `./writer.js` —
    which is what lets M3's server read run history without linking the code that creates
    directories. **The highest-value criterion was AC-11**, and it came from the requirement rather
    than from the ticket: the confinement guard's `realpath` clause was the only clause with no
    coverage in either suite, because `q0034-review-fixes.js` B4's five tokens are each rejected by
    the *lexical* clauses alone — so a port that deleted `realPath` would have been green everywhere
    while re-opening the hole Q-0011's round-2 panel found in round 1's own fix. Verified before the
    gate rather than taken on trust. A single-segment symlink pointing outside the runs root is now
    tested for the first time, and the sibling-symlink case is pinned as accepted so a later change
    is deliberate.
    **One chore run, three implement rounds, no exhaustion gate** — so charter §9's third threshold
    (*more than three chore runs means the child was cut wrong*) is not tripped, though the cost is
    past its first: **$52.34** billed Claude and 714,125 codex tokens the roll-up reports as `n/a`
    across three unpriced steps. $29.58 of that is implement round 1 on the largest module in the
    port; the two revise rounds cost $11.31 together. Q-0044 and Q-0048 each reached their
    exhaustion gate twice and were cheaper only because they were smaller.
    **The run's most durable finding is about the review loop, not the module.** Round 1 returned
    three majors, two of which asked for behaviour charter §2 requires the port to preserve — a
    `FlowError` for a runs root that is a file, and a warning for an `output.txt` that is a
    directory. Both were measured rather than argued: AC-2's own numbered body binds `could not
    create` to the *run* directory while step 2 is a bare `mkdirSync(historyRoot, {recursive:
    true})` (`engine.js:342`), so a file there throws a raw `EEXIST`; and `engine.js:421` guards
    with `existsSync`, which answers true for a directory, so that case is silently skipped and no
    shipped path warns. Both *Test:* sketches had been written from the requirement's intent rather
    than from the code. `requirements/errata.md` E-1 ruled them in §2's favour and E-2 ruled the
    genuinely dropped `String(text)` a nit. Round 2's prompt was already built and obeyed the review
    instead — **and round 2's reviewer then blocked its own requests, citing E-1 by name.** That is
    the lesson: *a review loop cannot police charter §2 on its own, because a reviewer approves the
    change it asked for.* The erratum is what gave it a subject, which is Q-0071's guard lesson
    arriving on the review step itself. See *"A reviewer approves the change it asked for"*
    (2026-08-29), which also fixes when the erratum is written — during the loop, as soon as the
    contradiction is provable, rather than at the exhaustion gate.
    Round 2's reviewer also found a fourth major nobody had raised: `finalise` accepted `'running'`,
    so a caller could write that status beside a non-null `ended_at`. Now
    `Exclude<RunStatus, 'running'>` — the compiler refuses the lifecycle contradiction rather than
    Q-0045's semantic pass reporting it after the run is over, which is the ticket body's own
    *"unrepresentable in the types rather than merely observed"* arriving from a reviewer.
    Verified in **both** environment rows before and after the merge, per Q-0072's closing finding:
    the integrate worktree had neither `.harness/worktrees` nor `.quorum/runs`, so both were created
    inside it and everything re-run forced (21/21 tasks, 0 cached, 837 tests, spike 13/13), then run
    again forced in the main checkout after the merge. Preserved defects are reported and not fixed:
    the list/detail disagreement over a symlinked run directory, the blended `ctx.stats.cost` that
    `finish()` persists, the persisted-stage guard that is unreachable from the CLI and reachable
    from `core`, and Q-0037's five items as they touch this module. **Two neighbours were settled by
    hand rather than opened as tickets:** OQ-1's obligations now live in Q-0051's and Q-0052's
    bodies (`trimIncompleteUtf8Suffix`, `formatCost`), and `harness/rules.md` now states that an
    agent's worktree has no dependencies until it installs them — `commands.install` runs only in an
    `integrate` worktree (`engine.js:1034`), which cost this run's implementer a hand-built
    `spike/node_modules` and would have cost every remaining child the same.
  - Q-0050 `core/engine` — the run loop, routing, stage transitions, and `runFlow` as an event
    stream. *(`reviewed` and `main:contained` 2026-08-29.)* The port's one authorised behaviour
    change, spent here: `runFlow` returns a lazy, single-consumer `AsyncIterable<Event>` over a
    lossless FIFO, cancellation belongs to the caller's `AbortSignal` and `core` installs no signal
    handler — see *"What a run's event stream carries, and how a gate answer travels back"*
    (2026-08-28) and its 2026-08-29 erratum, which corrects two clauses of it that were false of the
    engine that shipped. **Twenty-two errata**, E-1 to E-22, the most of any child.
    **Six review rounds — 14, 8, 11, 10, 9 and 10 findings — and every round found defects in the
    previous round's fixes.** The count did not fall and the class never changed: a claim with no
    executable check behind it, or a check blind to its own subject. Rounds 4 to 6 alone produced
    **five assertions that could not fail** — a `not.toBe` satisfied by an interpolated id, an
    identity check run at `{}` twice, a fixture selector satisfied by any line, and a
    `toBeGreaterThanOrEqual` floor that could not fail unless the register above it failed first.
    The most instructive sequence is one defect at four depths: a length proxy any short sentence
    passes → the scan replacing it, blind to soft-wrapped sentences (**65 of 72 invisible**) → the
    fixture written to prove that fix, satisfied by any whole line → and, one round later, the
    widened marker regex closing the *spelling* gap while leaving the **word-order** one. Each fix
    was written by the same hand that had just been shown the same mistake. See *"A check is not
    established by reading it"* (2026-08-29).
    **The strongest single finding came from the panel spanning vendors.** Round 6's Major 1 — step-id
    enrichment held in one mutable slot the run loop owns, so a `parallel:` group stamps the literal
    `"undefined"` and concurrent members share the slot — was found **independently by both
    reviewers, from different starting points**, on flows this ticket is itself run under
    (`requirements.yaml` and `review.yaml` are both `- parallel:`). Nothing was wrong on disk, because
    `runAgentStep` is a stub; M3's parallel trace columns cannot be derived from one id.
    **Rounds 4 and 5 could not use the flow at all.** Once the branch was contained in `main`,
    `review.yaml`'s hard-coded `{base}...harness/{id}/integration` was empty, so a merged ticket was
    unreviewable — M2's carried `--base` item arriving as a blocker rather than a nicety. Both rounds
    ran by hand, cross-vendor, on Q-0070's precedent. **Q-0077 was opened and shipped to fix the
    cause**, and round 6 is its first real use: the configured range empty, `99eb28c...integration`
    2,869 insertions across 29 files, same flow and one flag.
    **What is not done, stated rather than implied.** The stage is `reviewed` and cannot advance:
    there is no `qa-final.yaml` (Q-0012, blocked by Q-0056), so the ticket is parked by a missing
    flow rather than by completion. Round 6's ten fixes are themselves unreviewed. Eleven criteria
    have no test by the coverage table's own words — eight struck by E-8, one verified by inspection,
    one asserted at unit level, one unreachable until Q-0052. Seven obligations are written into
    **Q-0052's ticket body** rather than left in this ticket's errata, because `qa-red.yaml` reads
    the errata of the ticket it runs and not a sibling's. And the stage reached `green` three times
    by hand, each recorded as an out-of-band note with no history entry, because no engine run
    advanced it — a reader taking `stage: reviewed` at face value is over-reading it.
    **$131.03 and 131.5M tokens across eight engine runs** — measured from `runs.log`, where the
    per-run and per-step totals agree — and the most expensive ticket this project has run, past
    Q-0072's $95.78. Rounds 4 and 5 are **on top of that and unmeasured**: they were direct adapter
    calls outside any run, so no manifest records them. The
    honest summary is that the module is sound and its *scaffolding* took six rounds to become
    trustworthy, which is the opposite of where the effort was expected to go.
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
- Q-0065 `integrate` can report `tests=ok` from a cached pass it never executed. *(`reviewed` and
  `main:contained` 2026-08-27.)* `harness/harness.yaml`'s `commands.test` now ends `pnpm turbo run
  test --force`, `turbo.json`'s `test` task declares `"env": ["QUORUM_REAL_CLI"]`, and the shipped
  template keeps `npm test` while gaining a comment saying a caching runner can satisfy `integrate`
  from a replay. `core` learns nothing about any runner — shapes 2 and 3 of the original body, output
  parsing and `TURBO_FORCE` injection, were refused and a test now enforces the refusal. The
  environment half was folded in at Q-0047's gate and is closed: the probe file reports 31/31 files
  and **0 skipped** under the command its own JSDoc documents, against 30 passed and 1 skipped
  without the switch. **The requirement's severity finding was wrong and the implementer disproved
  it.** §0.1 inferred from the absence of `.turbo/cache` inside a worktree that `integrate` ran cold;
  turbo 2.10 resolves a worktree's cache to the main checkout's and says so — `is_shared_worktree=
  true` — so `integrate` has been running **warm on every chore ticket here**, and a ticket touching
  only `harness/` and `docs/` replayed all seven packages. Q-0065's own `integrate` did it, in
  thirty-five seconds including two installs and both suites, because `runFlow` stores `config` at
  run start and never re-reads it — which is why AC-3 is a file assertion and why the runtime proof
  is the *next* ticket's `integrate` line. Cost measured, not estimated: 25–30 s per `integrate`
  against 9 ms replayed. The buffer half split out as **Q-0070**; CI's identical hazard reported and
  carried as **Q-0071**. See *"The test command defeats its own cache, in configuration and not in
  the engine"* (2026-08-27).
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

- Q-0070 `runCommand` loses no output, and an overflow is not reported as a timeout. Split from
  Q-0065 at its requirements gate, 2026-08-27, where the merged requirement drafted its body in
  full so the obligation could not expire. `runCommand` takes Node's 1 MiB `maxBuffer` default and
  `integrate` runs the whole suite through it. Measured at that gate against the real function,
  three runs per cell: three of the four overflow shapes are killed with the configured `SIGKILL`,
  which `timedOut` tests, so an overflow reports a fifteen-minute timeout that did not happen —
  Q-0048's implementer's *"buffer defect wearing the timeout's clothes"* hypothesis holds after all,
  by `signal` rather than the `killed` disjunct they named. The fourth shape is not an overflow at
  all: a monolithic write followed by `process.exit()` discards the child's own unflushed stdout, so
  64 KiB arrives and **`code: 0`** is returned — a `tests=ok` false green that raising the ceiling
  cannot fix, and that file capture does (2,097,152 B complete, file writes being synchronous). That
  measurement answers the ticket's blocking *raise or remove?* question with evidence rather than
  taste. **Both blocking questions were settled at the requirements gate on 2026-08-28: remove the
  ceiling, and run the ticket by hand** — see *"A command's output is captured whole, or the run
  stops"* (2026-08-28), which is the entry the ticket said was owed. Lands in `spike/src/fanout.js`
  and `packages/core/src/fanout/command.ts` together — the Q-0066/Q-0068 shape. The subject has now
  been measured four times and three earlier records were wrong in three different places, which is
  why the ticket body says not to re-derive it from any of them.

  The requirements run cost **$8.31** and its head-of-product refused twice, correctly and for the
  same reason both times: the decision entry is a precondition no step in that flow may satisfy
  (`harness/roles/developer-generalist.md:23`), so the loop exhausted at a limit of 1 and the human
  advanced it. This is the sixth appearance of *"a loop spending its budget on work no agent in it
  can perform"* and a **new variant** — the two 2026-08-23 ownership rules and the 2026-08-25
  surface rule all ask questions about *files a step may write*, and this blocker is about a
  **precondition external to the document** rather than a surface named inside it. The requirement
  handled it correctly by naming the entry instead of asserting it (AC-11), which is the Q-0069
  AC-11(b) failure avoided rather than repeated. What the run bought beyond the design: eleven
  criteria, **seven** landed pins rather than the four the ticket body sketched — including
  `fanout.source.test.ts`'s *"the folder is exactly the two files"*, which forbids factoring the
  capture into a `fanout/capture.ts` and is a design constraint rather than churn — a discriminating
  two-files-not-one test the existing `'OUTERR'` assertion cannot make, a three-way contradiction
  resolved in favour of throwing, the correction that `spike/test/run.js` auto-discovers rather than
  registering, and the AC-9 interaction nobody had flagged: file capture makes `command.ts` read
  from `os.tmpdir()`, so `turbo-inputs.test.ts`'s `READ_BASES` gains an entry — Q-0072's guard and
  the rule Q-0073 closed.

  **Implemented by hand on 2026-08-28, both trees in one change.** Two capture files in a directory
  per invocation under `os.tmpdir()`, the result built from the complete files, the directory
  removed on every exit path; a capture failure throws, which is the one deliberate break in
  `runCommand`'s documented never-throws contract. The red phase was demonstrated rather than
  claimed in both trees: 8 of 8 matrix cells fail against the unchanged function and reproduce the
  requirement's table to the byte — 1,114,112 monolithic/natural, **65,536** in the false-green
  cell, ~1,050,000 progressive — and the spike suite fails 10 of 14 against `HEAD`'s function and
  passes 14/14 against the new one, checked by restoring the old file rather than trusting a green
  run. Risk 3 was confirmed by reading the engine rather than assumed: there is no `catch` between
  the integrate step and `runFlow`'s handler at `engine.js:161`, so run history still finalises and
  `backlog.log(… tests=…)` at `:1062` is never reached — which is what makes "a broken capture can
  satisfy neither `expect: pass` nor `expect: fail`" structural rather than asserted.

  **Three things the implementation found that the requirement did not.** There are **eight** landed
  pins, not seven: the eighth — `fanout.source.test.ts`'s *"the folder performs exactly one
  filesystem write"* — is invisible to reading and only appears when it is run, and it needed more
  than a bumped count. Its verb regex matched the new `fs.rmSync` while being blind to `mkdtempSync`
  and `openSync`, which are the capture's actual writes, so accepting a longer list would have left
  a pin that could not see the write surface it exists to bound. Second, Q-0073's guard **refused
  the first read-failure test**, which aliased `fs.readFileSync` to build a passthrough spy — an
  alias is exactly what its scan cannot follow — on the first change to touch that file after it
  landed. Third and most valuable, **the hand review found a gap neither the requirement, the
  four-times-measured matrix, nor the implementation saw**: with descriptors rather than pipes, a
  deferred write error surfaces only at `close()`, a full disk being the ordinary cause, and
  unwrapped it threw a bare `ENOSPC` — which AC-6 refuses, because a capture failure must name the
  capture or it reads as something the command did. `closeCapture` wraps it and attempts the second
  descriptor even when the first fails. That is *"review the fix round, not only the feature round"*
  (Q-0034) landing on a fix written against the requirement that had thought hardest about this
  subject of any in the repository.

  **A residual limit, stated rather than implied:** a close that reports nothing is no guarantee the
  writes landed, and a child that ignores its own write error and exits zero is outside what any
  file capture can detect, because there is no expected size to compare against. **Carried:** OQ-5
  and OQ-6 are opened as **Q-0076** and **Q-0075** from the bodies the requirement wrote out in
  full. Risk 9 is now unblocked and undone — `harness/port-charter.md:243` still reads `freeze-sha:
  not-yet-recorded`, so that half of the guard is *skipped* rather than passing, and recording it
  now would fail the eleven remaining port children the next time Q-0038 or Q-0040 changes
  `spike/src` legitimately. That is a sequencing decision and deliberately not taken in passing.

- Q-0071 CI can report green from a replay, and its cache outlives its commit. *(`reviewed` and
  `main:contained` 2026-08-27.)* `.github/workflows/ci.yml` restored `.turbo` across runs with
  `restore-keys: turbo-${{ runner.os }}-` and then ran `pnpm lint`, `pnpm
  typecheck` and `pnpm test` — `turbo run <task>` with no `--force` — so a job could report every
  package green having executed nothing, from a cache usually built for a different commit. Q-0065
  closed the same defect one layer up and its fix does not reach here: `integrate` runs
  `harness.yaml`'s `commands.test`, CI runs `package.json`'s. It had already hidden something —
  Q-0043's containment flake survived behind a cached pass until a forced re-run failed 1 of 123. The
  ticket is *what is a green tick being claimed for*, not reflexively forcing everywhere: replaying
  an untouched package is what a cache is for, while a required check that never ran is not. The
  `workspace` job now runs `pnpm turbo run <task> --force` for all three tasks and the
  `actions/cache@v4` step restoring `.turbo` is deleted; `actions/setup-node`'s `cache: pnpm` stays,
  because it replays a *download* and never a *verdict*. **All three tasks and not `test` alone** —
  Q-0069's deprecation rule is enforced by CI alone, and turbo declares no `dependsOn`, so a change
  in `shared` leaves `core`'s lint hash untouched: those are the two ticks least safe to replay.
  `package.json`, `harness/harness.yaml` and `turbo.json` are untouched, so a developer's local run
  keeps its cache, which is where a cache earns its keep. The ticket's *narrow the cache key* shape
  was refuted on its own invitation to check first — turbo's key is a content hash, so narrowing
  removes no incorrect hit, and an exact-SHA key can only hit on a re-run of the same commit, which
  is the one moment a flake must not be replayed. **The larger defect is underneath and is
  deliberately not this ticket:** `turbo.json` declares no `inputs` and no `dependsOn`, so neither
  suite's out-of-package reads move a hash — `harness/harness.yaml` among them, which means Q-0065's
  guard is invisible to the cache it exists to defeat. Q-0071's requirements run drafted that
  successor in full rather than describing it, and that draft is now **Q-0072**. Reported by
  Q-0065's implement step, which correctly refused to change CI on a ticket naming no `.github/`
  surface. The chore run's own best output was round 3's diagnosis of why round 2's defect survived
  two reviews: the guard already carried a subject fixture, but `restoresTaskCache` is a disjunction
  and that fixture carries `path: .turbo`, so the one marker tripped it and the `turbo-` key clause
  was never exercised — **the demonstration that a guard has a subject proves the guard fires, not
  that each of its clauses does.** A second fixture, forced on (a) so that it isolates (b), closes
  it. Verified at the gate in `integrate`'s own worktree rather than from the tick: forced test
  0 cached twice at the same commit (AC-3), 26.9 s and 26.5 s, and `npm test --prefix spike` 12/12,
  which closed the one criterion the implementer twice reported as unverified rather than claiming.

- Q-0072 Turbo's task hashes under-declare their inputs. *(`reviewed` and `main:contained`
  2026-08-28.)* `turbo.json` declared no `inputs` and no `dependsOn`, so a task's hash moved only
  when a file inside its own package did — while both real suites assert over `docs/`, `harness/`,
  `spike/`, `contracts/`, `backlog/` and each other. Each affected package now declares its
  out-of-package reads as `inputs` in its **own** `turbo.json` beside `$TURBO_DEFAULT$`, and the
  root's three tasks depend on their own kind (`^lint`, `^typecheck`, `^test`). A package config
  declares `inputs` and nothing else, because turbo merges per key and root `turbo.json` must stay
  the one place `env` is decided. **Root-level `inputs` was the shape the pre-run probe used and is
  wrong** — they apply to every package, so the five scaffolds would have gained `../../docs/**`
  too. Verified at the gate on the merged result, not taken from the report: a `docs/GLOSSARY.md`
  edit and a `packages/shared/src` edit each move both test hashes, while `harness/port-charter.md`
  — read by nothing — moves neither, which is the row that separates a precise declaration from
  shape (1)'s blanket. An unchanged local `pnpm test` still replays in 0.2 s; that is the point,
  and why this was not solved by forcing everywhere. The two successors the requirement wrote out
  in full are still open: **A**, an automated temp-workspace fixture proving the escaping-input
  configuration through a real cache on CI's Linux checkout; **B**, whether CI and `pnpm test`
  should be one command, which reverses part of the 2026-08-27 entry. **Five implement rounds and
  four majors, each correct and each different** — quoted literals, import aliases, root-derivation
  primitives, then the read-API anchor's own failure to resolve aliases, which is the instructive
  one: clause C1 learnt binding resolution in round 2 and clause C4, written two rounds later,
  matched raw names. Errata **E-1** and **E-2** ended the loop by bounding AC-7's absolute wording
  by AC-11's dependency ban, anchoring the check on read APIs rather than root-derivation
  primitives, and naming the closed classes — because a review loop cannot decide when a guard is
  finished and must be told. **The most valuable finding came after the gate:** the merged,
  reviewed, integrate-green change failed on `main`, because clause B only sees a directory literal
  when the directory exists, and `.harness/worktrees` and `.quorum/runs` exist on a working
  checkout but in neither a fresh worktree nor a fresh CI clone — so implement, integrate and CI
  all reported green while `main` was red. Q-0071's shape inverted. The two instances are
  registered by hand in `NOT_READ`; the existence-dependence is **Q-0073**. $95.78, the most
  expensive ticket this project has run. See *"A cache hit names what the task reads, not what its
  package contains"* (2026-08-28).

- Q-0073 The input guard's verdict depends on checkout state. *(`reviewed` and `main:contained`
  2026-08-28.)* `turbo-inputs.test.ts` decided whether a quoted literal was a repository path, and
  whether a collected path was a directory, from `fs.existsSync` — so the verdict was a function of
  what the checkout happened to contain. Both now come from one injectable inventory,
  `git ls-files --cached --others --exclude-standard`. The four existence checks that **refuse to
  run over a missing subject** are untouched and still throw: existence used to *classify* was the
  defect, existence used to *refuse* is the rule, and conflating them would have deleted four
  guards doing their job. That distinction is the requirements run's, not the ticket's — the body
  counted two existence checks and there are six.
  **Two of the ticket's own claims did not survive being re-measured before the run.** The
  load-bearing check was `pathLiterals`'s collection filter at `:348`, not clause B's `statSync` at
  `:1303`: creating the same two paths as plain **files** reports the same six occurrences, losing
  only the `(a directory, …)` clause, so a fix aimed at the directory test would have moved the
  wording and left the dependence. And **no CI run ever executed the defective revision** — `main`
  was 15 commits ahead of `origin/main` — so the table's fresh-clone row is a measured proxy for
  CI's checkout shape rather than an observation of CI.
  **The census decided the shape and the erratum decided the oracle.** Existence was not only
  classifying directories: it is what tells a path from any other string containing a slash, and it
  drops **270 of 307** distinct literals to do it — lint messages, `./adapters.js` import
  specifiers, `#!/bin/sh`, argv fixtures, prose. So shape (1) is a rewrite and shape (2) moves
  exactly **3** literals. Shape (3) is a supplement, shape (4) makes the answer depend on a fixture
  and gives a test a side effect on the reader's tree. The requirement fixed the **tracked** set and
  recommended `git ls-files`; `requirements/errata.md` **E-1** superseded both before an
  implementer started, on three probes showing turbo hashes untracked-**unignored** files and
  ignores gitignored ones — so tracked-only would have dropped a path turbo genuinely hashes,
  reintroducing the failure the guard exists to prevent. Both oracles agree on all 578 literals
  today, so nothing moved except what the guard claims.
  **The run found a second defect and stopped on it.** Run 2's reviewer returned `approve` with two
  nits — obeying `chore.yaml`'s *"nits alone approve"* — and the engine refused the answer, because
  the sentence beside it says findings must be empty on approve. The run failed after paying
  $18.57 for an implement step it had just approved. The contradiction is in **both** shipped
  flows, both templates and the spec, and the half being enforced is written into two frozen Q-0006
  contracts; **E-4** supersedes them and the fix lands in `spike` and `packages/core` together. The
  two nits were recovered from the raw output so run 3 was a revise round rather than an idle one,
  and both were real. See *"A nit does not contradict an approval"* (2026-08-28).
  **Two findings that outlive the ticket.** Nothing asserted a `NOT_READ` key was still a path the
  scan would collect, so a rule change could leave the register excusing nothing while reading as
  coverage — and `node_modules/.bin/turbo` became uncollectable on day one, which is that case
  arriving immediately. And **a count is not an identity**: the no-contraction guard was two
  `toBeGreaterThanOrEqual` floors, demonstrated to pass while a collected literal was swapped out,
  and is now a register of `file: literal` identities with its own arithmetic pinned.
  Verified forced on `main` in **both** environment rows rather than from `integrate`'s tick, which
  is the discipline that opened the ticket: spike 12/12 and workspace 21/21 with 0 cached, identical
  with `.harness/worktrees` and `.quorum/runs` present and absent. Three runs — $5.997, $18.575 and
  $7.349 — **$31.92** billed and 38.3M tokens the roll-up cannot split by vendor. One nit survived
  review and was fixed by hand after the gate: the size-floor comment named a sparse checkout as a
  cause of an implausibly small listing while the audit above it has one *collecting* — measured on
  git 2.55, `ls-files --cached` reports two entries over one file on disk, so the audit was right.
  See *"Membership is a git question, not a filesystem one"* (2026-08-28).

- Q-0075 A passing command's stderr is discarded, so a green suite loses its warnings. Opened
  2026-08-28 from Q-0070's OQ-6. `runCommand` returns stdout only on the success path and stdout
  then stderr on the failure path; `CommandResult`'s own JSDoc documents the asymmetry and
  **nothing tested it** until Q-0070's AC-2 did, because `printf hello` writes no stderr. Q-0070
  preserved it deliberately — changing it inside a capture fix would have been scope creep wearing a
  bug fix's clothes — and made it visible, written down and tested instead. The question is not
  whether stderr is useful but **whether `out` is the artifact a human reads or the one a machine
  parses**, since changing it gives every *green* `integrate` run's `dev/integration.md` all of
  turbo's and vitest's stderr, which is most of their output; `testReport` already answers that
  differently for each consumer. Lands in both trees together, and would deliberately change the
  AC-2 assertions that now pin the current behaviour rather than discover them.

- Q-0076 Nothing in run history has a cap, and prompts are the largest thing in it. Opened
  2026-08-28 from Q-0070's OQ-5, whose body the merged requirement wrote out in full rather than
  promising it. Not a defect Q-0070 introduced but a bound it removed: `persistArtifact`
  (`engine.js:429`) writes the string whole and always did, and the 1 MiB `maxBuffer` was the only
  thing capping `output.txt` — incidentally, never by design. Measured at that gate, and the numbers
  redirect the ticket: the largest `output.txt` is **71,318 B**, while the largest run-history file
  of any kind is a **242,181 B review `prompt.txt`** that nothing bounds either, 3.4× larger; total
  `.quorum/runs` is 16 MB. So the question is whether run history is **archival** — everything stays
  whole and the cap belongs on the disk rather than on any one string — or **diagnostic**, in which
  case the treatment belongs on prompts first and `output.txt` second. `testReport`
  (`engine.js:505–516`) already keeps 12,000 bytes of head and tail with an omission marker and is
  the shape to copy if a cap is wanted. Do not re-derive the evidence from Q-0070's headroom
  numbers, which measure a different thing.
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
