# Quorum — Development Plan

*Status: v1 plan, 2026-08-31 — M1 closed; M2's ticket list extended 2026-08-24 with the Q-0034–Q-0037 reconciliation work, again overnight with Q-0038–Q-0040, opened from Q-0035's chore review and from the items the M1 and Q-0034 entries defer to M2, and again on 2026-08-25 with Q-0041–Q-0054, the per-module cut of Q-0009's port, and with Q-0055–Q-0057, opened from Q-0041's chore run and its erratum, and again on 2026-08-26 with Q-0058–Q-0061, the four new defects Q-0043's implement step reported and did not fix, and with Q-0062–Q-0064, opened from Ruud's review of the harness the same day — the worktrees nothing prunes, the unhandled `EPIPE` that has been failing CI since 2026-08-24, and `core/src`'s folder layout — and with Q-0065, raised as an open question by Q-0064's own requirements run, and with Q-0066, the live probe defect Q-0046's chore run preserved and pinned rather than fixed in passing, and again on 2026-08-27 with Q-0067 and Q-0068, both opened at Q-0047's requirements gate — the deferred version probe, and the product name in the BYOS refusal, and later the same day with Q-0069, the deprecated zod API and the gate gap that let it accumulate (Q-0065's body, which had been appended to Q-0066's entry in the previous edit, was returned to it in the same change), whose own line was rewritten to what shipped later that day when it was implemented, and corrected again once its AC-11(b) was closed by human commit and the surface question behind it was ruled. Q-0070 was added the same day, split from Q-0065 at its requirements gate, and Q-0071 with it once Q-0065 shipped and its implement step reported CI carrying the same hazard; Q-0071's own entry was rewritten later that day to what its implement branch did — because an entry describing CI as it stood before that branch contradicted `04-architecture.md` §Testing while the change was in flight — and rewritten once more when it shipped. Q-0072 was opened the same evening from the successor Q-0071's requirements run had drafted in full, and its entry was rewritten to what shipped on 2026-08-28, when Q-0073 was also opened — from the defect Q-0072's own merge left on `main` and every gate reported green over. Q-0070's entry was rewritten on 2026-08-28 when its requirements run landed and both of its blocking questions were settled at the gate, so the line no longer says a decision entry is owed. Q-0073's own entry was rewritten to what shipped later that day, when its chore run also produced a second decision — the nit rule — from a defect that stopped the run rather than from its subject. Q-0070's entry was rewritten again once it was implemented by hand, and Q-0075 and Q-0076 were opened from the two successor bodies its requirement had written out in full — the run-history cap, and the passing command's discarded stderr. Q-0049's entry was rewritten to what shipped the same evening — the first port child to close its revise loop on an erratum rather than at an exhaustion gate — and Q-0037's, Q-0051's and Q-0052's bodies were amended by hand in the same session with the obligations that run declined. Q-0051's entry was rewritten on 2026-08-30 to what shipped — the port's eleventh child, and the first whose requirement was run twice because Q-0038 landed on its subject between the two, the aborted document archived rather than resumed. Q-0057's entry was rewritten the same day to what shipped, taken in the gap between port children because the chore flow it fixes is what every remaining child runs. The working agreement on ticket ids was corrected on 2026-08-30 by Q-0080, which fixed an allocator that read every `Q-` id as unparseable and answered `T-0001` on every call: the prefix is the adopter's and is derived from the backlog, so stating this repository's convention as the product's was the same mistake one layer up. Q-0079's entry gained its three cross-vendor review rounds the same evening, run by hand before its stage could honestly read `reviewed` and returning `revise` every time. Q-0079 and Q-0080 were opened and closed the same day, 2026-08-30 — the first from the third instance in three days of a test whose verdict depended on the machine rather than the commit, implemented by hand rather than ticketed further; the second split from its body and run through the flows, because it changes product behaviour on the cold-clone path. Q-0052's entry was written on 2026-08-31 when it shipped as the port's twelfth child, and five tickets were folded into this list in the same edit: Q-0074 and Q-0077, which had been open and shipped respectively while appearing nowhere in it — Q-0074 not at all, Q-0077 only inside Q-0050's prose — and Q-0081, Q-0082 and Q-0083, opened from Q-0052's own run. The gap is worth naming rather than quietly closing: a ticket can exist in `backlog/` for three days without this page knowing, because nothing checks the two against each other, which is the same class as the defects Q-0072 and Q-0073 closed one layer down. **M2's smoke-test done-when was split on 2026-08-31 by Q-0054**, the port's last child: the library half is Q-0054's and is done, the mock end-to-end through the binary is Q-0010's, and the "30-check" figure — a 2026-08-21 count repeated here as a present-tense requirement while the file holds 151 assertions — is corrected in this page and in `04-architecture.md` while the append-only entry it came from is left alone. Q-0054's own entry was rewritten in the same edit to what shipped. Q-0009's port closed on 2026-08-31 with all fourteen children contained, and Q-0053's entry and the parent's were written the same evening, together with charter §9's cost checkpoint — performed at the close rather than after the first three children, which is recorded as a process failure rather than presented as compliance. M2's done-when corrected 2026-08-25 (Q-0009): the zod schemas live in `packages/shared` and `core` imports them, which is what 04-architecture.md always said. **Q-0058 shipped on 2026-08-31** as the first ticket run through the flows after the port closed, and
its entry was rewritten in the same edit. **Q-0084** was opened from the defect its implement step
found in Q-0079's sweep and correctly declined to fix, and withdrawn the same day once the sweep's
own header was found to answer the question it had been opened on; the fix landed by hand instead,
which is *"resolve rather than open a successor"* applied to a ticket that had already been opened. Q-0058 is also where the
question *what is a `harness.yaml` key called?* was settled, by a census rather than by taste, and
recorded as a decision written by hand at the requirements gate because no step on the chore route
may write one. **Q-0062's entry was rewritten on 2026-08-31** to what its implement step built —
the worktree lifecycle, the ruling that no ref is ever deleted, and the silent-skip guard the
re-aimed spike assertions exposed; it also records the one landed pin that moved as a consequence
rather than by authorisation, which is the sort of thing a plan should say out loud. That pin moved
twice more inside the same ticket's review loop, so its entry now carries the final measured totals
and **M2's done-when carries 49% rather than the 53% Q-0054 counted** — the same figure, re-derived
rather than transcribed, which is the whole reason `spike-parity.test.ts` computes it. **Q-0062
closed the same evening** and its entry was rewritten again to what shipped: five implement rounds
reached through two `retry` answers, of which the first three went on a decision entry GO-1 had said
must exist before the run and which the run was launched without — the eighth appearance of a loop
handed work no step in it can perform, and the first where the requirement named the hazard in
advance. The fourth round changed no files and found that the guard protecting the ticket's one
safety property was blind to three spellings of a ref deletion, which is why the second `retry` is
what made the ticket sound. It is also the first ticket to walk charter §3's re-record path, and the
first whose leftovers were cleared by hand at the close — 555 MB of worktrees removed with every
branch kept, the successor's job done once manually. **Q-0039 and Q-0040 were created as folders the
same evening**, at the ids this page has cited since 2026-08-24 — they had entries here and nothing
in `backlog/` for a week, which is the Q-0074 drift running the other way, and the second instance
recorded in four days. Both bodies were written against the tree rather than transcribed from these
two lines: there is no lock of any kind in either tree, and an unanswerable gate's `FlowError` is
classified as a failed run, so `finish()` rolls the ticket branch back because `'failed'` is not
`finished()`. **Something checks this page against `backlog/` from 2026-09-01**, which is what the two instances
above were evidence for: `packages/shared/src/plan-backlog.test.ts`, asymmetric on purpose — every
folder must be named here, while only the current milestone's bullets must have folders, and those
that deliberately do not (Q-0010, Q-0012) are a register carrying the reason rather than a silence.
See *"The plan and the backlog are checked against each other, and the two directions are not the
same"* (2026-09-01). The `owner:` split was closed in the same edit: five tickets carried the OS
user `ruudvanengelenhoven` against fifty-four `ruud`, because `create()` defaults owner to
`process.env.USER`, which is a product-behaviour question this repository is not the right place to
answer by hand. **Q-0037 reached `requirements` on 2026-09-01**, the first ticket run through the
flows after Q-0058, and **Q-0085** was opened from its OQ-1 at that gate; both entries below are
written to what happened rather than to what was planned, and Q-0037's records a requirements run
correcting a body that had been re-measured against the tree hours earlier — which is the same
lesson as *"a measurement copied from a document is not a measurement"* arriving one layer up,
against a measurement that was not copied.
Milestones are ordered by risk, not by screen. Each milestone ends with a demo that a stranger could follow. The cold-clone test is the finish line.*

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
- The regression suite runs on Vitest and CI runs it on every push — in two halves, because the
  suite has two. The **library half** is Q-0054's and is done: every port child wrote Vitest tests
  against its own ported module, CI's `workspace` job forces all three tasks, a new failing test
  file anywhere below a package is collected and run, and `packages/core/src/spike-parity.test.ts`
  records file by file what the workspace suite carries of `spike/test/`. The **mock end-to-end
  through the binary** — `spike/test/smoke.js`, 151 assertions, the "30-check smoke test" this line
  said until 2026-08-31, counted when it was 30 by *"`integrate` is one generic step type used by
  three stages"* (2026-08-21) — is **Q-0010's**, together with the other seven files that spawn
  `spike/bin/harness.js`: 49% of the suite by line — 53% when Q-0054 counted it, and re-derived by
  `spike-parity.test.ts` on every ticket that adds a library-only file — which cannot be aimed at a
  `packages/cli` that does not exist. Until then both CI jobs stay green and both are required.
- `packages/cli` wraps core with the spike's commands; `npx quorum` works from a clean clone (no UI yet).
- `quorum/harness/` and `quorum/backlog/` exist; Q-0010 onward are run through the flows themselves.

**Tickets**
- Q-0008 Monorepo scaffold + CI.
- Q-0009 Port the spike to `packages/core` — the parent. Owns the port's ground rules (the spike
  stays authoritative and green until cutover; the CLI's domain logic moves into core; behaviour is
  preserved except for the event stream), the order, and the cutover itself. Ports nothing; the work
  is Q-0041–Q-0054 below, cut per module because `engine.js` alone is 1,113 lines and the sizing
  decision of 2026-08-22 puts a ticket at roughly ten criteria.
  **Closed 2026-08-31.** All fourteen children are `reviewed` and `main:contained`,
  `packages/core/src/engine/routing.ts` holds no `unavailableStep`, and every step kind dispatches
  to a real implementation. **$657.47 billed, mean $46.96 per child**, range $16.87 (Q-0042) to
  $131.03 (Q-0050); one chore run for twelve children, two for Q-0041, none for Q-0050, which
  charter §1 routes differently. Charter §9's checkpoint was performed at the close rather than
  after the first three, which is itself a finding — an early checkpoint exists to catch a bad cut
  while children remain, and by the time it ran there were none. Its two money thresholds are
  exceeded and the third, the one §9 calls decisive, was never approached.
  **What the money bought was scaffolding rather than porting**, and the five decisions the port
  produced are all about checks rather than about code: *"A check is not established by reading
  it"*, *"A reviewer approves the change it asked for"*, *"An erratum is the last repair, not the
  first"*, *"A test's verdict is a property of the commit"*, and *"A refused finding is a gate, not
  another round"*. Every one is about a guard reporting success over a subject it had not examined.
  See *"The port is closed, and what it cost was scaffolding"* (`docs/DECISIONS.md`, 2026-08-31).
  **What is not done:** the cutover — deleting `spike/`, retiring its CI job and this charter — is
  §10's follow-up, has no ticket, and runs after Q-0010, which also has no ticket.
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
  - Q-0051 `core/engine` — diff preflight and materialisation. *(`reviewed` and `main:contained`
    2026-08-30.)* The run-level preflight and the eight functions it and `buildPrompt` reach are now
    `packages/core/src/engine/diff.ts`, a new module exporting exactly three symbols over narrowed
    contexts — `preflightDiffs`, `materialiseDiff`, `trimIncompleteUtf8Suffix` — with the other five
    module-private. 1,563 insertions across six files; the engine folder is seven.
    **The ticket was requiremented twice, and the first document was thrown away on purpose.** Run 1
    returned `ready` and cost $7.27, and was aborted at its gate so Q-0038 could land on
    `spike/src/engine.js` first — the sequencing this ticket's own body had asked for in as many
    words. Q-0038 merged ten hours later and deleted the wholesale `.find()` that run 1's D-5 had
    ruled a preserved defect, so the document was archived under
    `requirements/archive/run-1-aborted/` rather than resumed. It is archived rather than deleted
    because `requirements.yaml:23` feeds `requirements/merged.md` **back** to the head-of-product
    step, so leaving it in place would have handed run 2 the ruling Q-0038 had just removed; a
    subdirectory is invisible to `readFiles`, which matches basenames inside `requirements/` only.
    That is the abort paying for itself: what would have been ported is a model that no longer
    exists.
    **The body's line map was wrong again ten hours after it was last re-derived**, which is the
    third time on this ticket. Q-0038 added 165 lines and shifted the tail by 20 to 85, and — the
    part arithmetic does not cover — **three of the eight functions did not exist**:
    `classifyEndpoints`, `notDueClause` and `missingEndpointFailure` are Q-0038's. A port working
    from the body's "the five functions" would have left the endpoint classifier behind. Two
    consequences were folded in at the same time: E-21's coercion obligation is two interpolation
    sites rather than three, because Q-0038 wrote `String(site.input.diff)` in passing, and R-1 is
    closed rather than owed — Q-0038 shipped the `--base` attribution at `engine.js:864–866`.
    **The two findings that justify the requirements run are both about checks, not about the
    port.** `RunContext` needs **three** new fields, not the two the inherited body names:
    `grep -rn baseOverride packages/` returned **nothing at all**, while the spike sets it at
    `engine.js:55` and `missingEndpointFailure` is its only reader — so a port carrying only
    `diffInputs` and `deferredDiffs` compiles, typechecks and passes every suite while silently
    restoring the wording that sends a maintainer to `harness/harness.yaml` for a value the flag
    supplied. Q-0038's fix, undone four hours after it landed, with nothing red. And
    `q0050.source.test.ts` has **three** hard-coded file lists rather than the two the body names.
    `:82` and the `REGISTERED` map fail closed; the third, feeding the AC-9d guard, mapped over a
    hand-written six-name array and **fails open** — a seventh engine file goes unscanned while the
    suite reports green. That is *"A check is not established by reading it"* (2026-08-29) found
    inside a guard written after that decision landed. It now derives from `production`, so Q-0052's
    and Q-0053's files are covered without anyone remembering.
    **One implement round, one review, no findings, no exhaustion gate** — the first engine child to
    close without a revise round. A first-round approve with an empty findings list is uncommon
    enough to be worth distrusting: 42 of 59 chore reviews to date returned `revise`. It was
    distrusted and then confirmed. The reviewer's 42.7 s is the **median** of those 59, not an
    outlier, and its prompt was 196 KB carrying the full patch — so the deferred-range machinery
    this ticket ports materialised correctly on this ticket's own run, which is the pleasing part.
    Both load-bearing criteria were then re-checked by hand rather than taken from the report, and
    both hold.
    **$29.55 billed across three runs** — $7.27, $6.97, $15.31 — and 680,019 codex tokens across
    three unpriced steps. The cheapest engine child by a wide margin: Q-0050 was $131.03 and
    Q-0049 $52.34. Verified forced in **both** environment rows per Q-0072's closing finding: in the
    integration worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on
    `main` after the merge, where both exist — workspace 7/7 tasks 0 cached and 955 passed, spike
    15/15, lint and typecheck 14/14 tasks 0 cached.
    **Q-0078 ships registered and unfixed**, with its authority line: `ctx.diffInputs` is still
    keyed by the interpolated range alone. **OQ-1 is inherited by Q-0052** rather than left in this
    ticket's errata — whether the preflight should emit an `info` naming what it skipped, since the
    `--dry` placeholder text is `buildPrompt`'s and therefore that ticket's.
  - Q-0052 `core/engine` — agent, gate and script steps. *(`reviewed` and `main:contained`
    2026-08-31.)* `runAgentStep`, `runScript` and their collaborators are now
    `packages/core/src/engine/prompt.ts` and `steps.ts`; the engine folder is nine modules. 2,298
    insertions across fifteen files, most of it tests.
    **The requirement was written against the tree rather than against the ticket body, and that is
    what made it usable.** The body dates from 2026-08-25 and three tickets had landed on its
    subject since, so R-1 found its port list stale in four places — most consequentially that the
    **gate is already ported in full**: `askGate`, the `step.gate` dispatch and the exhaustion gate
    are all in `routing.ts` from Q-0050, as are `reviewRound`, `interpolate`, `writesOf` and
    `loadRole`, and every collaborator this ticket calls was already in `core`. The real cut was
    seven functions plus one config read, so the ticket's own title over-describes what was left,
    and the codex candidate's 32 criteria were roughly a third re-specification of landed gate work.
    Its AC-4(c) is the finding only reading `projectConfigSchema` produces: `config.adapterOverride`
    arrives typed `unknown` through a `looseObject`, so a `String()` coercion resolves **every** run
    to an adapter named `undefined`.
    **The run's dominant event is that the review loop shipped a behaviour change and then approved
    it**, which is *"A reviewer approves the change it asked for"* (2026-08-29) for the second time
    in this port. Review round 1 reported, correctly, that `resolveModel` inherits a role's model
    when the role names **no** adapter — the guard suppresses on inequality and never on absence —
    contradicting AC-4(a)'s *"only when equal"*. Round 2's implementer refused on charter §2,
    preserved the code and added the authority line the engineering rules prescribe. Round 2's
    reviewer refused the refusal, answering only the weaker half — *"the cited spike tests are
    minimum frozen coverage, not authority to override the criterion"*, which is true and was not
    what had been argued — and never addressing the charter. Round 3 yielded, shipped the strict
    form, and **deleted the preserved-defect pin recording the divergence**; round 3's reviewer
    approved and named the deletion approvingly.
    **Three documents state the strict form and the code has never matched any of them** — register
    row 2's third clause, AC-4(a), and this ticket's own body, which inherited the wording from
    Q-0047 erratum E-1 on 2026-08-27. Nothing caught it because the frozen coverage cannot:
    `spike/test/smoke.js:621–627` is three assertions over **one** fixture that names an adapter in
    every row, so the disputed case had no coverage on either side of the port. It is latent — all
    21 role files across both trees carry an `adapter:` wherever they carry a `model:`.
    **Repaired after the gate rather than by editing the branch the gate approved**, on Q-0073's and
    Q-0080's precedent: `resolveModel` and its authority line restored, `steps.test.ts` now pinning
    the preserved behaviour on the row that discriminates the two readings, and
    `q0050.source.test.ts`'s identity register regaining `steps.ts`'s second entry with its
    cross-file arithmetic moved 10 → 11. Demonstrated red before green — against the strict form
    exactly two guards fail, `expected 'sonnet' to be undefined` and a `toStrictEqual` on the
    register, while 28 sibling assertions stay green. `requirements/errata.md` **E-1** rules the
    criterion's prose the thing that moves, and **Q-0081** carries the strict form for both trees,
    with its body saying not to adopt round 3's draft *because* that round was never asked which of
    the two should move.
    **The durable output is a decision about the flow rather than about the module.** The 2026-08-29
    remedy — write the erratum during the loop, as soon as the contradiction is provable — is
    correct and has no trigger: three implement rounds and three reviews completed in about an hour
    with no human step between them, and the contradiction was provable after round 1. See *"A
    refused finding is a gate, not another round"* (2026-08-31), which rules the interim obligation
    onto the human gate, rejects cutting `chore.yaml`'s `max_iterations` to 1 on the measurement
    that 42 of 59 chore reviews returned `revise` and nearly all were ordinary, and names **Q-0083**
    — an implement step that can return `blocked` — as the mechanism owed.
    **Both obligations written into this body by hand before the run were discharged, and one was
    answered better than it was asked.** R-6 ruled Q-0051's OQ-1 by measurement rather than taste:
    the `--dry` placeholder **reaches nobody**, because `runAgentStep` builds the prompt and returns
    at the dry short-circuit *above* `allocateOccurrence` and `persistArtifact`, so it is never
    persisted, emitted or shown — and under a real run `materialiseDiff` means it is never produced.
    A string in a discarded buffer is not a report, so it does not discharge the skipped-subject
    rule; the fix is routed to **Q-0082** and a gate obligation rather than a criterion, because the
    decision entry it needs is one `developer-generalist` is forbidden to write. Seventh appearance
    of a loop handed work no agent on its route can perform. The Q-0078 pin landed as specified at
    `prompt.ts:157`. **GO-2 is answered in `runs.log`**: the `signalWindow` invitation is **spent**
    and `askGate`'s timer permanently preserved — third consecutive decline, recorded so a fourth
    reader does not re-litigate it from the 2026-08-25 body.
    **$64.34 billed across two runs** — $12.35 requirements, $51.99 chore — and 78.0M tokens across
    four unpriced codex steps. Three implement rounds ($40.93, $5.55, $5.52) inside **one** chore
    run, so charter §9's third threshold is untouched, though round 1 alone passed its $40 cost
    line. The second most expensive port child, after Q-0050's $131.03. Verified in both environment
    rows per Q-0072's closing finding: `integrate` ran `commands.install` → exit 0 and both suites →
    exit 0 in its worktree, then forced on `main` after the merge and again after the hand repair —
    workspace 21/21 tasks 0 cached, spike 17/17, `harness lint` 6/6, Q-0079's identity sweep green,
    and the port-freeze guard clear.
    **This run produced the first `review/chore/run-2/` directory on a port child**, which is
    Q-0057's fix working on one of the three tickets it was written to protect.
  - Q-0053 `core/engine` — fan-out and integrate steps. *(`reviewed` and `main:contained`
    2026-08-31.)* `runFanOut`, `runIntegrate` and their helpers are
    `packages/core/src/engine/composite.ts`, with `testReport` and `environmentFailure` split into
    `suite-output.ts`; `routing.ts` dispatches both kinds and `unavailableStep` is gone from the
    file. **$41.45 across two runs** — $8.41 requirements, $33.04 chore — two implement rounds, two
    reviews, no exhaustion gate.
    **Its body was re-derived before the run and that is the cheapest thing done to it.** The
    2026-08-25 body named seven functions: `mergeFailure` was already ported by Q-0052, `cmdTimeout`
    was ported *renamed* as the module-private `commandTimeout` while `runIntegrate` needs it at two
    sites — a value that exists in `core` and cannot be reached from where it is wanted — and
    **`safeMergeBase` was named nowhere at all**, sitting between `testReport` and the fan-out block
    where a port working from "the two composite steps plus five helpers" walks straight past it.
    Both candidates carried it; neither would have.
    **Round 1's two majors were both real code defects**, which is the difference from Q-0052. One
    was a coercion inconsistency a single line wide — `writesOf`'s entry stringified for
    interpolation and then handed to `.includes` raw. The other, the base-conflict exit leaving its
    occurrence open, was **refused** on charter §2 and the refusal was verified three ways before it
    was believed: the spike does the same, AC-12 names its own scope (`engine.js:1155–1179`) and the
    exit is `:1099–1120`, and AC-8 is the criterion that governs it. `requirements/errata.md` E-2
    records the ruling; it was written during the loop per the 2026-08-31 decision and **turned out
    not to be needed**, because round 2's reviewer accepted the refusal unaided and then did the
    thing that makes a refusal safe — checked what it implied elsewhere, finding a JSDoc the refusal
    had made false. Both of its nits were false promises in comments, repaired by hand after the
    gate.
  - Q-0054 The regression suite on Vitest, and CI gating the port. **The port's last child, and the
    one whose translation set is empty by construction.** Charter §1 gave every child its module's
    unit-level tests and §5 defers the CLI-driven files to Q-0010, which between them leave nothing
    for this ticket to translate — and the thirteen children have already written 18,957 lines
    across 69 fresh Vitest files against the spike's 4,396 across 17. So the gap was never coverage:
    **no artifact stated the relationship between the two suites**, and no `packages/**` test cites
    a spike file or one of its scenario ids. `packages/core/src/spike-parity.test.ts` is that record
    — one verdict per file (`cli`, `ported`, `split`, `uncovered`), keys from `readdir` so a new
    spike suite fails until it is classified, the classification recomputed from each file's own
    text so a hand audit cannot contradict it, and every named counterpart required to exist *and*
    to be collected.
    **The audit's first act was to correct the ticket that commissioned it.** Every earlier account
    — the ticket body, its 2026-08-31 line map, and the merged requirement's own table — calls
    `smoke.js` binary-only. It is not: it spawns the binary **and** imports from `../src/` fifteen
    times, through `await import()`, which a scan for static `from '../src/'` cannot see. So the
    classification is 2 binary-only files and 6 mixed, not 3 and 5, and `smoke.js`'s verdict is
    `split`. The headline survives unchanged — 2,337 of 4,396 lines, 53%, transfer at Q-0010 — which
    is why the routing decision was still right; the class breakdown behind it was not. That is the
    difference between a register computed from the tree and one transcribed from a document.
    **Three things were unproven rather than merely unrecorded, and each is now closed.**
    `vitest.shared.js` collected `src/**/*.test.ts`, so a red test written to `packages/core/test/`,
    to a package root, or as `*.test.js` was collected by **nothing** — the discovery guarantee
    `spike/test/run.js` has by reading its directory, absent on the workspace side and unnoticed.
    The include is now Vitest's own default, read out of the configuration by the guard rather than
    assumed, and restoring the old one turns three behavioural assertions red rather than none.
    `test-command.test.ts`'s `(jobs['spike']?.steps ?? [])` passed once the job was gone; the
    workflow's seven jobs are now a register, and the old expression is shown **passing** over a
    fixture with `spike` removed rather than described as defective. And `04-architecture.md` said
    the mock end-to-end was "ported" in the perfect tense while `06-development-plan.md` repeated a
    2026-08-21 count as a present-tense requirement; both now state that two required suites exist
    until the cutover, what each proves, and the four-link chain from a new failing file to a red
    `pnpm test`. The append-only decision entry that is the origin of "30 checks" is untouched.
- Q-0010 CLI package; `npx quorum` entry.
- ~~Q-0011 Run history on disk~~ — pulled forward into M1 and closed there.
- Q-0012 `qa-final.yaml` and `deploy.yaml` (human-locked gate) — completes the seven SDLC flows (eight shipped files, counting `chore`).
- Q-0034 Reconcile the unmerged green branches (Q-0006, Q-0011) — land both, re-derive the empty-diff cause.
- Q-0035 The empty-range diagnostic reports evidence, not a story. *(`reviewed` and
  `main:contained` 2026-08-25.)*
- Q-0036 What `green` means, and where the code is — the board's git-derived containment annotation.
- Q-0037 Run-history review remainder — one major and eight nits. *(`requirements` 2026-09-01.)*
  Ready on the first pass, twelve criteria, $8.587 and 6,279,293 tokens across three steps. **Its
  body was re-measured against both trees before the run and the merge then corrected the
  re-measurement**, which is the record worth keeping: two of the corrections reduce scope and one
  of them changes the ticket's shape. `packages/shared/src/docs.test.ts` **does** assert order —
  file order at `:100` and *"the dates never go backwards"* at `:112` — so the append-only
  contradiction the ticket has carried since 2026-08-24 is **already enforced closed**, a
  back-dated entry turning the suite red today. What is missing is a sentence, not a guard, which
  demoted it from a blocker to a ratification and routed it to **Q-0085**. And nits 2 and 3 are
  documented in `core` as well as nit 1 (`writer.ts:363`, `writer.test.ts:507`, both naming this
  ticket), so they are spike-side documentation alignment rather than code in two trees.
  **Two collisions neither candidate found are now criteria**, both re-verified by hand at the
  gate. `printRunDetailHuman` never renders the roll-up, so `q0034-review-fixes.js` B2's
  `tokens=1100` reads the **per-step** usage line nit 5 rewrites — Q-0034's double-count guard,
  which AC-8 re-aims rather than breaks. And `validate-artifact.test.ts:150,173` transcribes the
  skip notice **verbatim**, so nit 8 is not spike-only: changing the CLI alone leaves a green test
  that no longer reproduces it, which is this repository's most-recorded defect class.
  **Nit 2 is measured for the first time and is a ruling rather than an optimisation.** Over all 71
  run directories the largest manifest is 13,924 B across 18 occurrences on a run whose own
  `duration_ms` is 3,755,327 — so replaying the whole-manifest re-serialise costs ~3 ms against 63
  minutes, and the batched-persistence alternative is a behaviour change to the one write path that
  must never lose a billed step, bought for a measured nothing.
  **The escape route for the major is closed**: the `signalWindow` invitation Q-0052 was offered is
  **spent**, declined three times (Q-0050, R-7, then Q-0052's gate), and `Q-0052/runs.log:17` says
  in as many words that *"Q-0037 still carries the underlying finding"*. Six of the round-2 nits
  survive, one was closed with major 11 before Q-0011 landed, and one dissolved when the decisions
  became files.
  **Which trees was settled by events rather than chosen.** The port closed 2026-08-31 and the
  freeze SHA is recorded, so neither option the charter offered — *"land in the spike before the
  freeze, or be re-targeted at `core`"* — exists; what applies is §3's mirror-and-re-record, walked
  as a procedure in one commit. §3's stale block naming this ticket as one of five blockers was
  corrected the same day, a week after the precondition it described had been **abandoned rather
  than met**. Kept as one ticket at the gate (OQ-4), and `harness/Q-0037/integration` cut
  deliberately from the requirements tip rather than from whatever `HEAD` held (GA-2).
- Q-0085 An entry's date is the date it takes its place in the index. *(Folder created 2026-09-01,
  `draft`.)* Split from Q-0037's OQ-1 at its requirements gate, with that run's Appendix A
  transcribed into the body in full rather than referenced. `docs/DECISIONS.md` is called
  *"append-only, newest last"* in three places and is also grouped by date, and the two cannot both
  hold for an entry decided on one date and landed after entries decided later. The ruling is owed
  in one direction or the other — the landing date wins and the body carries the deciding date, or
  the prose is amended and `docs.test.ts`'s date assertion deleted, trading the only mechanical
  append-only check for a sentence. The first is recommended because it is what shipped. **The
  whole deliverable is a decision entry**, so it is the human's work directly and there is no flow
  to route it through — which is the point of splitting it out rather than carrying it as a
  criterion of a chore ticket whose implement step could then never satisfy it.
- Q-0038 Deferred-range failures name their producing step in every case. *(`reviewed` and
  `main:contained` 2026-08-30.)* The preflight now classifies each **endpoint** on its own —
  step-created, unresolved template, or pre-existing — and a range holding a step-created endpoint
  is still deferred while its pre-existing endpoints are resolved at run start anyway. One
  modelling error had produced three defects in eighteen lines: the wholesale `.find()` over both
  endpoints, the diagnosis ternary that named the producing step only when the *failing* endpoint
  was the deferred one, and a not-yet-created endpoint reported as one that *"does not resolve
  either"*. Q-0077's `--base` attribution was folded in at the requirements gate, so an
  unresolvable override is blamed on the flag rather than on `harness/harness.yaml`, which never
  supplied the value. See *"A range is checked one endpoint at a time, because an endpoint is what
  can be absent"* (2026-08-30).
  **What the $13.86 actually bought, which decision 044 did not know.** `ensureWorktree`
  (`spike/src/git.js`) cuts a worktree from `HEAD` when a step's declared `base:` does not resolve,
  silently, and `chore.yaml` declares `base: "harness/{id}/integration"` — the branch that did not
  exist. The implementer was not stopped by the missing ref; it was handed a worktree from
  somewhere else and paid to work in it. Named as a non-goal with its evidence, not fixed: it is
  another module, it governs fan-out task bases too, and *throw, warn, or which callers* is
  unasked.
  **Five implement rounds, and the code was byte-identical from round 1 onward** — no review round
  found a defect in the change. Rounds 1–3 went entirely on a harness misconfiguration:
  `.claude/settings.json` granted npm per verb and granted only `test`, while `harness/harness.yaml`
  mandates `npm install --prefix spike …`, so AC-12 required a command the harness's own permission
  config refused. Round 3 proved it was the allowlist rather than a sandbox by re-attempting with
  the override set, and found the resolution the earlier rounds had missed. **The reviewer was right
  on substance and the implementer's measurements were wrong**: rounds 1–2 argued the pnpm
  substitution equivalent, checking five packages against the lockfile and finding five matches; the
  real install reported `added 4 packages, and changed 3`, moving `fast-uri` to 3.1.5 to match
  `spike/package-lock.json`. A pnpm install ignoring npm's lockfile produced a genuinely different
  tree, exactly as `harness.yaml`'s own comment warns. The fix was to the environment, not to the
  criterion: erratum E-2 amended AC-12 and **E-3 withdrew that amendment** once the permission
  landed and round 4 ran the command — AC-12 stands unamended and satisfied. See *"An erratum is
  the last repair, not the first"* (2026-08-30).
  **Round 4, once that blocker stopped absorbing the reviewer's attention, produced the first real
  review of the code** and found a pre-existing hazard nobody had considered: `ctx.diffInputs` is
  keyed by range alone, so a site materialising before a producer leaves bytes a later *deferred*
  site reads from the cache. Ruled reported-not-fixed by E-3(b) — it is unreachable in every shipped
  flow and its fix collides with AC-10's identical-bytes guarantee — and opened as **Q-0078**.
  Round 5 changed no code, cited the erratum, was approved, and re-derived E-3(b)'s claims rather
  than inheriting them, catching that the check had covered `harness/flows/` but not
  `spike/templates/harness/flows/`.
  **$37.46 billed across both runs** — $5.99 requirements, $31.48 chore — and 44.7M tokens across
  five unpriced codex reviews. Verified forced in both environment rows: `integrate` ran
  `commands.install` → exit 0 and both suites → exit 0 in its worktree, then spike 15/15 and
  workspace 7/7 with 0 cached re-run on `main` after the merge, per Q-0072's closing finding. The
  two neighbours it does not own are unchanged and still want tickets — the chore flow cannot run on
  a ticket's first pass (mitigated by charter §8's checklist, and now load-bearing rather than
  advisory, because a first-pass run refuses in the preflight instead of billing), and
  `budget.per_run_usd` still stops nothing.
- Q-0039 One run at a time per ticket. *(Folder created 2026-08-31, `draft`.)* Open since M1, where
  two runs overlapped twice in one night and one run's rollback moved a branch another live run was
  holding. Its body records the three shared resources measured today — the run id `nextRunId`
  computes from `runs.log`, the ticket branch `finish()` resets to `branchHeadAtStart`, and the one
  worktree per branch — that there is **no lock of any kind** in either tree, and that
  `engine.js:383–390`'s `EEXIST` guard disclaims in its own message that it makes the engine safe
  for concurrent runs. Q-0057's OQ-4 and Q-0062's RK-1 are both deferred to it; RK-1 is a deliberate
  widening, since a finished run now removes a directory a concurrent run may be writing in.
- Q-0040 A gate can say "undecided". *(Folder created 2026-08-31, `draft`.)* A non-interactive run
  that reaches an unanswerable gate currently fails, and `finish()` then rolls back work the run had
  already proven green — it has cost Q-0036 and Q-0035 their merges on consecutive nights. Traced
  end to end in its body: `harness.js:95` throws, `engine.js:201–207` calls `finish(…, 'failed', …)`,
  and `'failed'` is not `finished()`, so `resetBranchTo` fires. The rollback is correct behaviour
  answering the wrong question — *"nobody was there"* is not *"the work is bad"* — and the real work
  is that `finished()` is one predicate three behaviours read, so a fourth status splits the stage
  rule, the branch rollback and Q-0062's worktree cleanup, which no longer want the same answer.
  Owes a decision entry before code, against the two gate-model entries of 2026-08-06 and
  2026-08-23.
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
- Q-0057 A chore run's reviews overwrite the previous run's, and the survivors mix. *(`reviewed`
  and `main:contained` 2026-08-30.)* `review/chore-iter-{iter}.md` is now
  `review/chore/run-{run}/chore-iter-{iter}.md` in both shipped `chore.yaml` copies, write path and
  input glob together, and `{run}` is a new interpolation variable in both engine trees. It carries
  the id already in `runs.log` as `run=N` and already naming `.quorum/runs/<id>-N/`, so a review
  directory joins by inspection to that run's cost lines and to its run history.
  **The reasoning that picked the shape is the durable part.** The engine writes an agent's document
  **verbatim** (`spike/src/engine.js:308–310`) and never adds a header, so the path is the *only*
  place run identity can be stamped — and the path is what the next prompt shows as
  `## Input: backlog/<folder>/<rel>`. That is why the fix is a path rather than a content change,
  and it is what ruled out the zero-code alternative: `review/round-{round}/` plus a marker
  `verdict.md` needs no engine change, but the numbering would then depend on a file whose only
  purpose is advancing a counter, unguarded, so a later edit dropping that write silently restores
  this exact defect — and it would make `reviewRound` count chore rounds, changing a contract
  `review.yaml` depends on. The spelling names the flow (`review/chore/run-3/`) so a run directory
  never sits beside `review.yaml`'s `round-3/`, one character apart; the basename is unchanged so
  the 57 legacy flat files and every existing `chore-iter` citation still resolve.
  **The port freeze does not bind this ticket, and that was the disagreement between the two
  candidates.** `harness/port-charter.md:242`'s machine-readable `children:` list is Q-0041 through
  Q-0054; Q-0057 is not among them, so the branch-scope job reports it out of scope rather than
  passing silently, and Q-0038 is the precedent. Waiting for the cutover was not neutral: the spike
  is what runs the flow today, so a `core`-only fix would have protected **none** of Q-0052,
  Q-0053 or Q-0054 — the exact three tickets this one exists to protect. `core` therefore gets the
  variable rather than the behaviour, because `runAgentStep` is still `unavailableStep(step,
  'Q-0052')`; Q-0052 inherits the obligation and is told which variable to use, which is why AC-1's
  core half is a spy assertion rather than a file assertion.
  **The requirements run corrected the hand prep that preceded it**, which is the useful record
  here. Two of the corrections committed at `23dfce1` were wrong: `vars.iter`'s increment **is**
  ported (`engine.ts:266`, pinned by a test whose comment names this ticket by id), and `runId` is
  at `engine.js:44` and not `:49` — a line shifted by pattern rather than measured, taken from a
  different `runId` at `:352`. The second mattered beyond arithmetic: `runId` is allocated *inside
  the same object literal* as `vars`, so exposing it costs a **hoist** in the spike, not a key.
  The implementer did hoist it — one `nextRunId` call per tree — where a second call would have
  allocated independently and broken the `runs.log` / `.quorum/runs/` join while passing every test.
  **A revision round now sees only the current run's reviews**, answered from the maintainer's own
  written precedent in Q-0073's `runs.log:17` rather than argued. `requirements/errata.md` stays the
  channel for a finding that survives a run, per *"An erratum is the last repair, not the first"*
  (2026-08-30). The accepted cost is stated: a finding left *only* in an earlier run's review is no
  longer injected automatically.
  **$20.96 billed across two runs** — $6.05 requirements, $14.91 chore — and 314,883 codex tokens
  across two unpriced steps. One implement round, no review findings. **The run could not benefit
  from its own fix**: `runFlow` loads the flow at run start, so it wrote its own review to the old
  flat path, the 57th such file, and the first `review/chore/` directory will appear on Q-0052's
  chore run. Verified forced in both environment rows per Q-0072's closing finding — workspace 7/7
  tasks 0 cached and spike 16/16 in the integration worktree and again on `main`, with `harness
  lint` 6/6 run *inside* the worktree so it linted the changed flow file rather than main's.
  **Two nits reported and not fixed:** `engine.test.ts:394` still calls Q-0057 an open ticket and
  quotes the pre-change path, and `q0034-chore-preflight.js` keeps its inline fixture on the old
  shape — the latter deliberately, a fixture independent of the shipped flow file being the more
  robust arrangement. **OQ-4 is deferred to Q-0039**: two concurrent runs on one ticket compute the
  same `nextRunId` and would write into the same directory, reproducing this defect.
- Q-0058 `harness.yaml` documents a retry key nothing reads. *(`reviewed` and `main:contained`
  2026-08-31.)* Both shipped files now spell the commented example
  `{ attempts: 5, baseDelayMs: 5000, maxDelayMs: 60000 }` — the third field was documented in no file
  at all — and both state the convention behind the spelling. **No code changed in either tree**: the
  only non-comment edits outside tests are two `export` keywords.
  **The ticket's open question was settled by a census counted by the right unit, and the answer
  inverts the one the ticket body reached.** The body counted the whole file, found five snake_case
  keys against one camelCase, and concluded that correcting the example would make the retry block
  mismatch its neighbours. Split by subtree there is no mismatch to make: **five and five, with no
  exception in either direction** — every camelCase key Quorum reads lives under `adapters.<vendor>`
  and every snake_case key outside it, `base_delay_ms` being the single counterexample in the
  repository and the one spelling nothing read. The split is mechanical rather than stylistic:
  `getAdapter` hands the `adapters.<vendor>` block through **unread** to the factory and to
  `withRetry`, which destructure JavaScript identifiers, while every key outside it is read by name
  by Quorum's own code. That refutes both of the body's remaining shapes by measurement — renaming
  the code's fields leaves `extraArgs` and `delayMs` camelCase in the same block, moving the seam
  *through* the adapters subtree instead of around it, and delivering one convention would mean
  renaming a live key and giving up the pass-through property a contributor's adapter depends on.
  See *"A config key is camelCase under `adapters.<vendor>` and snake_case everywhere else"*
  (2026-08-31), written by hand at the requirements gate as GO-1 because no step on the chore route
  may write one.
  **Shape 3 — validation on a load path — was deferred with its reasons rather than omitted, and the
  decisive one is that it had no subject.** A strict `retryPolicySchema` could not have seen this
  defect: the example is *commented*, and `project.test.ts` parses only live YAML. The guard that
  shipped instead **uncomments every example line before checking it against the schema**, and it had
  a subject the day it landed — both shipped files fail it before the fix. `projectConfigSchema` stays
  *"declared and validated nowhere"* (Q-0043 AC-11); both landed pins are unedited, including the one
  forbidding **any** `packages/core` file from importing zod, which is wider than the ticket body
  reported.
  **The merged requirement's most valuable act was executing a rule instead of reasoning about it.**
  The recommended candidate's restoration rule — restore a comment whose body parses as a YAML
  mapping — selects **ten** lines of `harness/harness.yaml` and six of the template, four and one of
  which *throw*, because prose is full of colons (``# `--continue` because `dependsOn: ["^test"]`
  prunes…``). Under that candidate's own clause that an unparseable restored line fails the test, its
  guard would have been **red on `main` before anyone fixed anything**. The discriminator that works
  is narrower and was measured to give exactly 3 and 3: a plain YAML identifier immediately followed
  by a colon. Its insufficiency is not asserted but demonstrated in the suite, and confirmed by hand
  at the gate — weakening the regex makes the restore throw on that exact prose line.
  **One implement round, approved on the first pass, no revise** — which, against 42 of 59 chore
  reviews returning `revise`, was distrusted before it was accepted. The review was one sentence over
  a 439-line change, so the criteria the requirement's own R-5 named as invisible-unless-run were
  verified by **mutation** at the gate rather than read: reverting the spelling turns 7 of 28 red, and
  weakening the discriminator throws. The implementer had already demonstrated the same three ways —
  including that removing the new turbo input fails four clauses of `turbo-inputs.test.ts`, and that
  dropping `cfg.retry` from `getAdapter` fails AC-7's non-default 3/7/9 check, whose delays are
  `[7, 9]` where the exponent alone would give 14.
  **It also found a defect nobody was looking for, refused it correctly, and it was fixed by hand at
  this ticket's close rather than run through the flows.** `pnpm sweep:git-identity` — Q-0079's
  oracle — **could not run in a linked worktree at all**: `git-identity-sweep.sh:69` pointed
  `GIT_CONFIG_GLOBAL` at `${repo_root}/.git/sweep-gitconfig-absent`, and in a linked worktree `.git`
  is a *file* holding `gitdir: …`, so the path could never exist and the `rm -f` guarding it failed
  with `Not a directory` in the `isolation` phase. Every `chore.yaml` implement step runs in a linked
  worktree, so the oracle was unreachable in exactly the environment the flow creates, while the
  tripwire half — literals only, and it says so — could not stand in for it. It failed loudly rather
  than passing vacuously, which is Q-0079's design working, and the implementer reported the sweep as
  **skipped** rather than green.
  **The fix is one line, and the reasoning sits in the script's header beside Q-0079's.**
  `GIT_CONFIG_GLOBAL` now names `git rev-parse --path-format=absolute --git-common-dir` — the one
  real shared `.git` directory, identical from the main checkout and from every worktree. It was
  opened as **Q-0084** at this ticket's gate, on the worry that moving the file would disturb
  Q-0079's measured table of what does and does not neutralise an identity; that ticket was withdrawn
  the same day, because the header answers the worry — *"the probe below is the oracle … a question
  of what the environment achieves and not of how it is spelled"*. Only the file's **absence** is
  load-bearing, and nothing reads or creates it, so which directory holds it is not a property any
  guarantee rests on. `rm -f` stays: it is what turns "the parent is not a directory" into a stop.
  **Demonstrated red before green in the environment that matters, which is the only check that the
  fix is real.** The previous script, run from the linked worktree, fails at `isolation` with the
  `Not a directory` message; the fixed one runs there to completion, exit 0, printing its own
  *"environment discriminates (negative and positive probes both as expected)"* — the script
  asserting that both probes still fire, rather than the maintainer asserting it — then both suites
  green. Re-run on `main` afterwards: exit 0, same two lines. The new `|| fail` on the `rev-parse` is
  defensive and unreachable in practice, since `--show-toplevel` fails first outside a repository; it
  is not claimed as tested.
  **The report's own nit was corrected in place rather than edited away.** Its "still open" item 2
  states GO-2 is open and `git branch --list 'harness/*'` returns nothing — transcribed from the
  requirement, true when that was written, false by the time the run began, and disproved by the run
  itself, since `review` diffed against a branch that had to exist for the step to return `approve`.
  A correction is appended to `dev/implement-report.md` and the sentence left standing, because how
  the claim got there is the point: a measurement copied from a document is not a measurement.
  **$18.55 across two runs** — $6.48 requirements, $12.07 chore — and 19.4M tokens across two unpriced
  codex steps. Verified in both environment rows per Q-0072's closing finding: the integrate worktree
  had neither `.harness/worktrees` nor `.quorum/runs` and ran both suites to exit 0, then forced on
  `main` after the merge — 21/21 tasks 0 cached, spike 17/17, `harness lint` 6/6, and the git-identity
  sweep green. **One nit, recorded not fixed:** the implement report's "still open" item 2 states GO-2
  is open and `git branch --list 'harness/*'` returns nothing, transcribed from the requirement rather
  than re-measured — the run itself disproves it, since `review` diffed against a branch created
  before it started.
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
- Q-0062 Worktrees are never removed. *(`reviewed` and `main:contained` 2026-08-31.)* `removeWorktree` had been
  exported and tested by Q-0042 and had **zero call sites**, so every worktree a run had ever made
  was still on disk — one closed chore ticket leaving two directories and 277 MB, 250 MB of it
  `node_modules`, measured 2026-08-31. `finish()` now reads the disjunct it already had, the other
  way round: **a run that finished gives back the worktrees it obtained, and one that did not keeps
  every one of them**, because the directory a run stopped in is the thing a maintainer is about to
  open. One predicate, three consequences — the stage rule, the branch rollback and the cleanup —
  so the inspection story and the cleanup story cannot drift apart. Lands in `spike/src/engine.js`
  and `packages/core/src/engine/` together: no file in the repository imports `@quorum/core`, so a
  `core`-only fix would have removed nothing until the cutover, which sits behind Q-0010.
  **The requirement's decisive ruling was to delete no ref, ever**, against a candidate that
  proposed deleting contained `harness/<id>/*` branches after a successful run. On a completed chore
  run `harness/<id>/implement` is contained in `harness/<id>/integration` by construction, so that
  rule would have deleted, on every single run, exactly the branch this repository reads *after* a
  run ends — Q-0050's rounds 4 and 6, Q-0077's `--base` flag and Q-0079's three hand reviews all
  read one. Removing a directory is reversible from its branch; deleting the branch is not. That
  strike is also what kept the ticket at thirteen criteria rather than twenty, and it turns register
  row 20 (`harness/port-charter.md`) from a carried gap into decided behaviour.
  **Cleanup is registration, never enumeration.** The run keeps a branch → directory map filled at
  the `ensureWorktree` and `ticketWorktree` call sites it actually reaches; nothing walks
  `.harness/worktrees/` or the ref namespace. A worktree the run **reused** is registered, because a
  run that reused it is the run that finished with it; a worktree anyone else left is removed by
  nothing. A worktree holding uncommitted content is **kept**, and the run names the paths that kept
  it — `removeWorktree` runs `git worktree remove --force`, and a delete taking a decision on
  somebody's behalf must at least say it took one. A removal or a status read that fails costs one
  `warn` and nothing else: the status, the stage transition, the manifest, the history entry, the
  terminal event and the exit code are what they would have been.
  **The four spike assertions that read a worktree the run now gives back are re-aimed at evidence
  that survives it**, and one of them is why the re-aim matters more than the removal.
  `smoke.js`'s `commitAll` block was guarded by `if (fs.existsSync(wt))`, so the moment worktrees
  started being cleaned it would have become a silent no-op — ten assertions skipped and the suite
  still green, which is *"a check that skips its subject must not report success"* (2026-08-25)
  inside the regression suite. It now asserts the branch survives, re-creates the worktree from it,
  and goes **red** when the branch is gone; demonstrated by deleting the branch, at which point
  smoke reports exactly that one failure. The smoke fixture's install marker also moved out of the
  integration worktree: written inside it, it left that worktree permanently dirty, so the suite
  would have exercised removal on every worktree except the one every code-writing flow makes.
  **Registered and not fixed:** nothing removes what earlier runs left, by design — this ticket is
  prospective and its own run could not benefit from it, because `runFlow` loads the engine at run
  start, so `finish()` here was pre-fix code and the run left all four worktrees standing. The
  successor, `harness worktrees` (list, prune stale registrations, remove what is contained), lands
  with or after Q-0010 and is written out in full in the merged requirement. Q-0039 is unchanged and
  named as a risk: two concurrent runs on one ticket already share a worktree, and a removal makes
  that collision slightly worse rather than creating one.
  **The backlog of directories was cleared by hand at the close**, which is the successor's job done
  once manually rather than the ticket quietly widening: 555 MB across four worktrees from Q-0058 and
  Q-0062, each checked clean first under the ticket's own AC-5 rule rather than forced, each removed
  with `git worktree remove` and **no** `deleteBranch`. All four branches still resolve at their
  original tips afterwards — `85467fd`, `dc22890`, `a48fa1c`, `4295010` — which is the decision's
  central property demonstrated on real directories rather than in a fixture. The refs are kept
  deliberately: a maintainer deleting one by hand is a different act from a command doing it on their
  behalf, and they are what a post-hoc review reads.

  **What the run cost, and what of it was avoidable. $88.49** — $8.45 requirements, $80.04 chore —
  and 128.6M tokens across six unpriced codex steps, the second most expensive ticket in the project
  after Q-0050's $131.03. **Five implement rounds and five reviews inside one chore run**, reached
  through two answers of `retry` at the exhaustion gate, so charter §9's third threshold is untouched.
  **Rounds 1 to 3 were spent on a blocker no agent on the route could clear**, and the requirement had
  predicted it by name: GO-1 said the decision entry must exist *before* the implement step ran, and
  the run was launched without it. That is the **eighth** appearance of a loop handed work no step in
  it can perform, and the first where the requirement named the hazard in advance and was ignored
  rather than unheard. Round 2 is the sharpest illustration of Q-0083's absence: handed a blocker it
  could not clear and given only prose as a channel, it answered by adding a **sixth** citation of the
  absent entry, making the finding larger. Round 3 refused correctly on the role's own wording, cited
  *"A refused finding is a gate, not another round"* (2026-08-31), changed no citation, and supplied
  the entry as a draft — landed by hand on Q-0069's precedent after verifying the numbering, the index
  heading and that all six citation sites spell the title verbatim.
  **The second `retry` is why the ticket is sound, and it bought the finding the first four rounds
  missed.** Round 4 changed **no files** and reported that AC-4's ref-deletion pin — the guard
  protecting this ticket's one safety property — was anchored on single quotes in every clause
  (`/'-D'/`, `/'--delete'/`, `/'push'/`), so `git(["branch", "-D", b])`, a shell-form line and a
  colon-refspec push all passed it unseen. Three earlier reviews had read that guard and approved
  around it, and **RK-7 had named this exact hazard in advance**. Round 5 replaced the quoted regexes
  with an argv tokeniser in **both** trees, which normalises quote style and argv-versus-shell-line
  away; verified at the gate by re-running the probes rather than from the report, with the benign
  `git(['worktree','remove','--force',dir])` row confirming it discriminates rather than merely
  fires. *"A check is not established by reading it"* (2026-08-29), found inside the guard this
  ticket exists to install.
  **GO-2 is the first walk of charter §3's re-record path.** `spike/src/engine.js` moved, so the
  freeze-SHA half went red on `main` by design; step 1 was already satisfied by R-1's both-trees rule
  — 107 insertions in the spike against 592 across four core engine modules — and `freeze-sha` was
  re-recorded at `a6e529a`. Demonstrated red before green: the guard named `spike/src/engine.js` and
  exited 1 at `7b6bc70`, exits 0 at the new tip, with all three halves and the guard's own 43 checks
  clear afterwards.
  Verified forced in both environment rows per Q-0072's closing finding — the integrate worktree had
  neither `.harness/worktrees` nor `.quorum/runs` and ran install and both suites to exit 0, then
  re-run on `main` after the merge: spike 18/18, workspace 7/7 tasks 0 cached and 1250 passed, lint
  and typecheck 14/14 tasks 0 cached, `harness lint` 6/6, and Q-0079's git-identity sweep green in
  both rows.
  **One guard the requirement did not enumerate moved**, and it is stated here rather than left to
  be discovered: `spike-parity.test.ts` pins the spike suite's line totals, so re-aiming assertions
  in two files and adding one moved four measured numbers — 336 / 2001 / 2059 / 4396 became
  336 / 2026 / 2463 / 4825, and the share of the suite that transfers at Q-0010 fell from 53% to
  **49%**, because a library-only file is one Q-0010 does not inherit. A measurement re-derived, not
  an assertion weakened — and re-derived three times, because the review loop kept growing the one
  new library-only file: 2338 / 4700 after the implement round, 2407 / 4769 after the round that
  covered `regressed` and `interrupted`, and these after the round that widened the AC-4 scan. The
  figures above are the ones the guard pins; the two superseded pairs appear in this ticket's
  earlier implement reports and are not what shipped.
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

- Q-0074 The engine cannot tell git failed from an absent branch. Opened 2026-08-28 from Q-0050's
  OQ-4, whose successor body that merged requirement wrote out in full so the obligation could not
  expire. Created **by hand at id Q-0074** rather than through `harness ticket new`, which would
  then have allocated Q-0077: the id is already cited by name in *"What a run's event stream
  carries"* (2026-08-28), in Q-0050's `requirements/merged.md` OQ-4 and in that ticket's
  `solution/errata.md`. Absent from this plan's list until 2026-08-31, which is the gap the entry
  itself now closes.
- Q-0077 `harness run --base <ref>`, so a contained ticket can still be reviewed. *(`reviewed`;
  the board reads `main:indeterminate(no branch)`, a hand-run ticket naming a branch nothing
  created.)* Opened and shipped mid-Q-0050, where rounds 4 and 5 could not use the review flow at
  all: once the branch was contained in `main`, `review.yaml`'s hard-coded
  `{base}...harness/{id}/integration` was empty, so a merged ticket was unreviewable and both
  rounds ran by hand. M2's carried *"`harness run` cannot aim a diff at anything but
  `{base}...integration`"* item, arriving as a blocker rather than a nicety. It moves the **diff
  anchor** only and never the branch a rework step or `integrate` merges from — see `--base` in
  `docs/GLOSSARY.md`. Round 6 of Q-0050 is its first real use.
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

- Q-0078 A deferred diff site can be served an earlier site's cached materialisation. Opened
  2026-08-30 from Q-0038's round-4 review and its erratum E-3(b). `ctx.diffInputs` is keyed by the
  interpolated range alone, so a site that materialises `X...Y` before a later group creates `Y`
  leaves bytes that the correctly-deferred second site then receives from the cache, because
  `buildPrompt` prefers `ctx.diffInputs?.get(range)` unconditionally. Pre-existing — `buildPrompt`
  is byte-identical across Q-0038 and neither preflight ever removed a cached entry on deferral —
  and unreachable in every shipped flow in both trees, which is why it is p3 and why keeping it out
  of Q-0038 was right. It needs a requirement rather than a line: the obvious fix, invalidating on
  deferral, makes two sites materialise the same range at different moments, which Q-0038's AC-10
  (*"every panel member receives identical bytes"*) forbids, so the choice among keying by site,
  invalidating, and forbidding the shape in `harness lint` is the work. One tree until Q-0051 ports
  the diff subsystem; unlike Q-0038 it does not block the port.

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
- Q-0079 A test may not depend on the machine's git configuration. *(Implemented by hand
  2026-08-30, `main:contained`; the ticket stays at `requirements` because no engine run advanced
  it.)* Opened from the third instance of one class in three days, each found only **after**
  merging and each having passed implement, a cross-vendor review, `integrate`'s `tests=ok` and at
  least one hand verification: Q-0072's two directories a working checkout has and a fresh clone
  does not, Q-0073's `fs.existsSync` used to *classify*, and `git merge --no-ff` resolving a
  committer identity — which macOS derives from the OS user record and a Linux runner cannot, so
  Q-0051's merge turned CI red four hours after Q-0038 closed a different defect in the same
  subsystem.
  **The rule is one sentence and names no mechanism**, because the three instances share a shape and
  nothing else — a guard aimed at any one would have missed the other two: *a test's verdict must be
  a function of the commit under test, not of the checkout it runs in or the account it runs as*.
  It completes the ruling Q-0073 made half of: a machine property may shape a fixture or refuse a
  run, and may never be the oracle. See *"A test's verdict is a property of the commit, not of the
  checkout or the account"* (2026-08-30).
  **Two enforcers with different reach, which is the design and not a compromise.** The **oracle** is
  `.github/scripts/git-identity-sweep.sh` — both suites run with no resolvable identity, in a bare
  checkout and again in one carrying `.harness/worktrees` and `.quorum/runs`, the cell nothing
  covered and where instance 1 lived. `pnpm sweep:git-identity` is byte-identically what CI runs,
  because a definition restated in `ci.yml` would drift and a developer could then not reproduce
  what CI claims. The **tripwire** is `packages/core/src/git-identity.test.ts`, inside the ordinary
  suite and therefore visible at `integrate`; it sees **literals only** and says so in its own
  header and in `harness/rules.md`, so it cannot be read as coverage for the checkout-shaped
  instances.
  **The highest-value criterion was that the environment proves itself before it certifies
  anything**, and the drafting is the argument for it: three separate times the fix had to be
  defended against the defect it fixes. An exported `EMAIL` survives every `GIT_CONFIG_*` variable;
  `user.useConfigOnly` forbids git from *inferring* an identity but not from *reading a configured*
  one, so a contributor's checkout with a local `[user]` section is permissive while a bare one is
  strict; and one candidate proposed putting the guard beside
  `.github/scripts/port-freeze-guard.test.mjs`, **a file nothing executes** — this ticket's class,
  one degree worse than its three instances. A permissive sweep is green over everything, so the
  negative probe must fail and the positive must resolve before a suite runs. `git var
  GIT_COMMITTER_IDENT` is the probe: it answers without a repository, a temp directory or a commit
  object. The measured table of what does **not** discriminate lives in the script's header, where
  the next person editing it will look.
  **Both halves were demonstrated to have a subject rather than asserted.** Reverting the fix under
  the sweep fails **the same nine tests CI reported** — reproducing locally what two attempts that
  morning could not, one of which passed either way and one of which failed either way. The tripwire
  names the exact three sites when they are reverted, and each of its exemption clauses —
  `merge`/`rebase`/`am`/`cherry-pick`/`revert --abort`, `stash list` versus bare `stash`, a
  lightweight `tag` versus `-a`/`-s`/`-m` — has its own fixture, because showing a guard has a
  subject proves it fires and not that each clause does (Q-0071). Its one exclusion is itself, and
  the exclusion is asserted load-bearing.
  **What it cost and what it corrected.** $9.14 for the requirements run — **both** head-of-product
  attempts returned `needs-input` and the loop exhausted at limit 1, advanced rather than retried
  because all three blockers were work no step in that flow may perform. Sixth appearance of the
  pattern Q-0070 named. The implementation was by hand and free of adapter cost. `cf3b2e6` had
  fixed one file of four: `q0035-empty-range.js:74`, `:191` and `q0077-base-flag.js:52` carried the
  same defect, masked by a CI step whose stated justification was **false** — it claimed the engine
  commits with the ambient identity while `fanout.js:92` and `:112` both carry `-c`. That step is
  deleted and the job's remaining strictness is labelled incidental, a property of the runner image.
  Q-0072's guard cost four earned registrations on the way in and refused a hand-rolled repository
  root, which is the machinery working as designed. **The fourth cell — a bare checkout *with* an
  identity — is deliberately uncovered and says so in the workflow**, with its reason: a defect
  visible only there is one where *having* an identity breaks a test, a rarer shape with no measured
  instance, costing a further full run.
  **Three cross-vendor review rounds, run by hand and every one of them `revise` — and they are the
  most valuable thing the ticket produced.** The code landed unreviewed: it was written by Claude
  and checked by Claude, so `reviewed` would have been a claim nothing supported, and the stage sat
  at `requirements` understating the work. Advancing it truthfully meant reviewing it first, on
  Q-0070's precedent — no flow can, because `review.yaml` consumes `green`, `harness/Q-0079/*` does
  not exist, and the change was already contained in `main`, so the flow's only range would be
  empty.
  **Round 1, five accepted.** `violations()` read the invocation's own source **line** for
  `user.email=`, so **a comment beside the call satisfied the check** — a guard that could be talked
  out of firing by text it does not execute, which is this ticket's class inside its own enforcer.
  With it: `-F`/`--file` missing from the tag forms; `apps/` missing from the corpus while
  `apps/web` exists; the guard excluding its own file wholesale, hiding any real call later added to
  it; and three `Q-0081` labels, false provenance from when the scan was expected to be its own
  ticket. One finding was **rejected with evidence** — the Q-0080 artifacts it flagged were in the
  commit range handed to the reviewer, not in the change, which is a reviewer failed by its
  evidence rather than a defect.
  **Round 2, three accepted, and the third is why this project reviews the fix round and not only
  the feature round** (Q-0034). The repair for round 1's comment bypass was a **repository-wide
  `scan-fixture` comment that could silence any commit-creating call anywhere**: the same shape
  under a new token, written by the hand that had just been shown the mistake. It is now honoured in
  the guard's own file and nowhere else. With it: `--message`, `--trailer` and attached short forms;
  and a whitespace-only identity value that satisfied a length check.
  **Round 3, two accepted and one refuted.** git bundles short options, so `git tag -am 'x'` writes
  an object and evaded both the flag list and the attached-value list — `annotates()` now tests
  membership of `a s m F u` in a cluster, with `-n5` and `-l` pinned as non-writing. And **the test
  guarding the marker's `file === SELF` clause could not fail**: it asserted over the predicates
  rather than over the decision, so deleting the clause would not have killed it. The decision is
  its own `exempt()` function now and **the mutation is demonstrated** — removing the clause fails
  the test, restoring it passes. The refuted finding claimed a marked line holds no invocation so
  the test necessarily fails; that line is the doc comment quoting `git(root, 'merge', B)`, which
  the scanner collects, and the suite passes 11/11. The reviewer had read the diff rather than run
  it, which is the class it was hired to find.
  **Six accepted findings, of which two were checks that could not fail** — the ticket's own
  subject, arriving inside the ticket. Recorded in `review/hand-review-1.md` and
  `review/hand-review-2.md`, closed in `e7e176d`.
  **The stage is `reviewed` by hand and the history is deliberately empty**, because history is the
  engine's record of runs and no run advanced this ticket; two `runs.log` notes in Q-0070's format
  name what was approved, why no engine run could receive it, and the four commits that are the
  evidence. The board renders `main:indeterminate(no branch)`, which is right rather than a gap: the
  frontmatter names `harness/Q-0079/integration`, a branch a hand-run ticket never creates.

- Q-0080 `harness ticket new` cannot allocate an id, and collides with itself. *(`reviewed` and
  `main:contained` 2026-08-30.)* `nextId()` stripped a leading `T-` and nothing else before
  `parseInt`, so all 53 `Q-nnnn` ids yielded `NaN`, the filter emptied the list, and it returned
  `T-0001` on **every** call — no `T-` ticket ever persisting to raise the maximum. `create()` then
  `mkdirSync`'d with `recursive: true` and replaced `ticket.md`, so two invocations collided on the
  id always and overwrote the folder silently whenever two titles slugged the same. Not a new
  discovery: Q-0043 carried it under charter §2 and **pinned it in both trees**, which is what made
  the fix a deliberate act rather than an incidental one.
  **The prefix now comes from the ids on disk**, parsed with the product's own grammar: this
  repository allocates `Q-0081` and an adopter's `PROJ-0042` backlog allocates `PROJ-0043`, both
  with **no configuration**. An empty backlog still allocates `T-0001`. A backlog the allocator
  cannot read **refuses** and names what it found rather than picking a winner, with `--id` as the
  escape hatch, and `create()` refuses a taken id or an occupied folder rather than allocating
  around one — which would paper over the state the ticket exists to make impossible.
  **The requirements run refused the ticket body's own recommendation, on measurement.** The body
  called a `harness.yaml` key *"the only shape that survives both"*; it survives neither cheaply.
  It fixes nothing until someone edits a file, so all 53 tickets here and every adopter's backlog
  stay broken until configured — a silent wrong answer replaced by a silent wrong answer *unless
  configured*. `Backlog`'s constructor is `(root: string)` and `create()` is called with no project
  in **nine** spike test files. And `backlog.source.test.ts:115` asserts `loadProject` does *not*
  call `projectConfigSchema.parse(`, so a p1 fix would have dragged Q-0058's whole decision in as
  its vehicle. It also found the codex candidate contradicting itself — its AC-4 wanted an empty
  backlog to allocate `Q-0001` while its AC-15 wanted a test asserting `harness/T-0001/integration`
  to stay green. The key stays available as a later refinement over a working allocator.
  **The pins came out with the defect**, including the `T-0007` half, whose arithmetic is preserved
  in a new single-prefix row rather than deleted with the rest — it is the only evidence the counter
  is right when the prefix matches. The requirement stated that cost plainly against the ticket
  body's *"both halves are load-bearing"*, and anticipated that a reviewer would correctly block a
  deliberate pin change.
  **$21.70 across two runs** — $6.10 requirements, $15.60 chore — and 355,507 codex tokens across
  two unpriced steps. Ready on the first pass, one implement round, and the reviewer approved
  carrying one nit. **The nit was real and is fixed**: `--id` is attacker-controlled and AC-8 makes
  the refusal one line, but `notATicketId` interpolated it verbatim, so an id carrying a newline
  printed a three-line error whose second line read like harness output, and an ANSI escape was the
  same defect in colour. Reproduced before it was believed, fixed in both trees, and demonstrated
  red before green in both suites. Fixed **after** the gate rather than by editing the branch the
  gate was approving, on Q-0073's precedent.
  **Three of the session's own fixes proved themselves on this one run.** The review landed at
  `review/chore/run-2/chore-iter-1.md` — the first run-scoped review directory in the backlog, which
  is Q-0057 working on a real run rather than in a test. The engine accepted an `approve` carrying
  findings instead of failing the run, which is Q-0073's nit rule closing the defect that cost that
  ticket an $18.57 implement step it had just approved. And Q-0079's sweep and tripwire ran green
  over all of it. The proof that matters is not a test: `harness ticket new` now answers `Q-0081`
  in this repository, run and the probe deleted.

- Q-0081 A role naming no adapter lends its model to any vendor. Opened 2026-08-31 by Q-0052's
  errata E-1. `resolveModel`'s guard suppresses a role default on adapter **inequality** and never
  on **absence**, so a role carrying `model:` without `adapter:` passes that model to whichever
  adapter resolved — the Q-0001 failure reached by a route the clause was not written to close.
  Register row 2's third clause, Q-0052's AC-4(a) and Q-0052's ticket body all state the strict
  form and the code has never matched any of them; the frozen coverage cannot tell them apart,
  because `smoke.js:621–627` names an adapter in all three of its rows. The ticket owes a decision
  about **which of the two moves** — the code adopts the strict form, or the prose is corrected on
  the reading that a role naming no adapter is *unscoped* rather than *wrong-vendor*, which is what
  a default is for. Shape 1 was already written once, by Q-0052's round 3, and the body says not to
  adopt it for that reason: the round that wrote it was never asked the question. Latent — all 21
  role files across both trees carry an adapter wherever they carry a model. Both trees together.
- Q-0082 The preflight reports what it deferred, or the rule is amended. Opened 2026-08-31 as
  Q-0052's GO-1, the successor to Q-0051's OQ-1, with the body its merged requirement wrote out in
  full transcribed rather than referenced. `preflightDiffs` defers a range and **says nothing**;
  the only text describing a deferral is `buildPrompt`'s dry-run placeholder, which Q-0052's R-6
  measured as reaching nobody. Owes a decision entry before a line of code: emit one `info` per
  deferred range naming the range and its producing step, both of which `deferredDiffs` already
  holds, **or** amend *"a check that skips its subject must not report success"* (2026-08-25) to
  say a deferral is not a *skip*, because the range is examined later rather than not at all. The
  second reading is defensible, has never been written down, and under it no code changes. Its body
  says not to re-derive the reachability from either of the two earlier accounts that called the
  placeholder *"the report"*.
- Q-0083 An implement step can report that a finding demands what it may not do. Opened 2026-08-31,
  named as the owed mechanism by *"A refused finding is a gate, not another round"* (2026-08-31).
  `chore.yaml`'s `implement` step declares no `verdict` while `review` declares
  `approve|revise`, so the reviewer can stop the loop and the implementer cannot — and an
  implementer appealing to charter §2, to a decision entry only the human may write, or to a
  surface outside its write paths has one channel: prose the human does not read until the gate.
  A `proceed|blocked` verdict routing to a human gate makes the refusal visible to the engine. Its
  three open design questions are the verdict's shape, what the engine does with it (`retry` is
  meaningless here, since nothing has changed), and whether `blocked` is an `agent`-step property
  or a `chore`-flow one. One warning is written into the body rather than left for review: **no
  lint can tell an authority appeal from work an agent finds hard**, which argues for keeping the
  gate human rather than for validating the reason. Whether it runs before Q-0053 and Q-0054 — which
  run this exact flow — is the Q-0057 question and is left for its requirements gate.
- ~~Q-0084 The git-identity sweep cannot run in a linked worktree~~ — **withdrawn and fixed by hand
  at Q-0058's close** 2026-08-31, the same day it was opened; it never ran, and its body stays as the
  evidence. What it described: opened by Q-0058's chore
  implement step, which reported it and correctly refused to fix it — no criterion of that ticket
  names `.github/`, and changing an enforcement script's isolation mechanism is a decision rather
  than machinery. `git-identity-sweep.sh:69` set
  `GIT_CONFIG_GLOBAL="${repo_root}/.git/sweep-gitconfig-absent"`, and in a linked worktree `.git` is
  a **file** holding `gitdir: …`, so that path can never exist and the `rm -f` guarding it fails with
  `Not a directory` in the sweep's `isolation` phase. Reproduced both ways by hand before the ticket
  was opened. Every `chore.yaml` implement step runs in a linked worktree, so **Q-0079's oracle is
  unrunnable in exactly the environment the flow puts an implementer in**; its tripwire half still
  runs in the ordinary suite but sees literals only and says so, and is therefore not coverage for
  the checkout-shaped instances. It fails loudly rather than passing vacuously — Q-0079's design
  working — so the ticket is about *reach*, not a false pass, and CI has never been affected because
  it checks out a normal clone. **Why it was withdrawn rather than run:** the ticket was opened on
  the worry that moving the absent file out of the tree would disturb Q-0079's measured table, and
  the script's own header already answers it — *"the probe below is the oracle … a question of what
  the environment achieves and not of how it is spelled"*. Only the file's absence is load-bearing,
  so no row of that table is touched. `GIT_CONFIG_GLOBAL` now names
  `git rev-parse --path-format=absolute --git-common-dir`; the demonstration is in Q-0058's entry.

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

- Ticket ids are `<PREFIX>-nnnn`, and `Q-` is *this repository's* prefix rather than the product's — `harness ticket new` allocates within whatever prefix the backlog it is standing in already uses, and needs no configuration to do it (Q-0080); the backlog is `backlog/` in this repo; from M2 every ticket runs through the flows (dogfood is the test suite).
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
