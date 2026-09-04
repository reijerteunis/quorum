# Quorum — Development Plan

*Status: v1 plan, 2026-09-02 — M1 closed; M2's ticket list extended 2026-08-24 with the Q-0034–Q-0037 reconciliation work, again overnight with Q-0038–Q-0040, opened from Q-0035's chore review and from the items the M1 and Q-0034 entries defer to M2, and again on 2026-08-25 with Q-0041–Q-0054, the per-module cut of Q-0009's port, and with Q-0055–Q-0057, opened from Q-0041's chore run and its erratum, and again on 2026-08-26 with Q-0058–Q-0061, the four new defects Q-0043's implement step reported and did not fix, and with Q-0062–Q-0064, opened from Ruud's review of the harness the same day — the worktrees nothing prunes, the unhandled `EPIPE` that has been failing CI since 2026-08-24, and `core/src`'s folder layout — and with Q-0065, raised as an open question by Q-0064's own requirements run, and with Q-0066, the live probe defect Q-0046's chore run preserved and pinned rather than fixed in passing, and again on 2026-08-27 with Q-0067 and Q-0068, both opened at Q-0047's requirements gate — the deferred version probe, and the product name in the BYOS refusal, and later the same day with Q-0069, the deprecated zod API and the gate gap that let it accumulate (Q-0065's body, which had been appended to Q-0066's entry in the previous edit, was returned to it in the same change), whose own line was rewritten to what shipped later that day when it was implemented, and corrected again once its AC-11(b) was closed by human commit and the surface question behind it was ruled. Q-0070 was added the same day, split from Q-0065 at its requirements gate, and Q-0071 with it once Q-0065 shipped and its implement step reported CI carrying the same hazard; Q-0071's own entry was rewritten later that day to what its implement branch did — because an entry describing CI as it stood before that branch contradicted `04-architecture.md` §Testing while the change was in flight — and rewritten once more when it shipped. Q-0072 was opened the same evening from the successor Q-0071's requirements run had drafted in full, and its entry was rewritten to what shipped on 2026-08-28, when Q-0073 was also opened — from the defect Q-0072's own merge left on `main` and every gate reported green over. Q-0070's entry was rewritten on 2026-08-28 when its requirements run landed and both of its blocking questions were settled at the gate, so the line no longer says a decision entry is owed. Q-0073's own entry was rewritten to what shipped later that day, when its chore run also produced a second decision — the nit rule — from a defect that stopped the run rather than from its subject. Q-0070's entry was rewritten again once it was implemented by hand, and Q-0075 and Q-0076 were opened from the two successor bodies its requirement had written out in full — the run-history cap, and the passing command's discarded stderr. Q-0049's entry was rewritten to what shipped the same evening — the first port child to close its revise loop on an erratum rather than at an exhaustion gate — and Q-0037's, Q-0051's and Q-0052's bodies were amended by hand in the same session with the obligations that run declined. Q-0051's entry was rewritten on 2026-08-30 to what shipped — the port's eleventh child, and the first whose requirement was run twice because Q-0038 landed on its subject between the two, the aborted document archived rather than resumed. Q-0057's entry was rewritten the same day to what shipped, taken in the gap between port children because the chore flow it fixes is what every remaining child runs. The working agreement on ticket ids was corrected on 2026-08-30 by Q-0080, which fixed an allocator that read every `Q-` id as unparseable and answered `T-0001` on every call: the prefix is the adopter's and is derived from the backlog, so stating this repository's convention as the product's was the same mistake one layer up. Q-0079's entry gained its three cross-vendor review rounds the same evening, run by hand before its stage could honestly read `reviewed` and returning `revise` every time. Q-0079 and Q-0080 were opened and closed the same day, 2026-08-30 — the first from the third instance in three days of a test whose verdict depended on the machine rather than the commit, implemented by hand rather than ticketed further; the second split from its body and run through the flows, because it changes product behaviour on the cold-clone path. Q-0052's entry was written on 2026-08-31 when it shipped as the port's twelfth child, and five tickets were folded into this list in the same edit: Q-0074 and Q-0077, which had been open and shipped respectively while appearing nowhere in it — Q-0074 not at all, Q-0077 only inside Q-0050's prose — and Q-0081, Q-0082 and Q-0083, opened from Q-0052's own run. The gap is worth naming rather than quietly closing: a ticket can exist in `backlog/` for three days without this page knowing, because nothing checks the two against each other, which is the same class as the defects Q-0072 and Q-0073 closed one layer down. **M2's smoke-test done-when was split on 2026-08-31 by Q-0054**, the port's last child: the library half is Q-0054's and is done, the mock end-to-end through the binary is Q-0010's, and the "30-check" figure — a 2026-08-21 count repeated here as a present-tense requirement while the file held 151 assertions at the time — is corrected in this page and in `04-architecture.md` while the append-only entry it came from is left alone. Q-0054's own entry was rewritten in the same edit to what shipped. Q-0009's port closed on 2026-08-31 with all fourteen children contained, and Q-0053's entry and the parent's were written the same evening, together with charter §9's cost checkpoint — performed at the close rather than after the first three children, which is recorded as a process failure rather than presented as compliance. M2's done-when corrected 2026-08-25 (Q-0009): the zod schemas live in `packages/shared` and `core` imports them, which is what 04-architecture.md always said. **Q-0058 shipped on 2026-08-31** as the first ticket run through the flows after the port closed, and
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
answer by hand. **Q-0037 shipped on 2026-09-01**, the first ticket run through the
flows after Q-0058, and two tickets were opened from it and closed the same day by hand — **Q-0085**, split from its OQ-1 at the requirements gate, **Q-0086**, from its erratum E-2, and **Q-0087**, from re-measuring a claim Q-0086 itself had made and got wrong, **Q-0088**, which closed the fourteen paths Q-0087 had registered as remaining, and **Q-0089**, the engine default the flow-derived rule could not see; none of the five could have been run by any flow: the first because its whole deliverable is a decision entry, the second because it edits the flow the run would have loaded; both entries below are
written to what happened rather than to what was planned, and Q-0037's records a requirements run
correcting a body that had been re-measured against the tree hours earlier — which is the same
lesson as *"a measurement copied from a document is not a measurement"* arriving one layer up,
against a measurement that was not copied. **Q-0090's implement step corrected two things in this
page on 2026-09-01**: Q-0010's four figures for what transfers at the CLI cut — eight files, 2,515
lines, "half", `smoke.js` 773 — which were stale in all four places and are re-derived from
`spike-parity.test.ts`'s pinned identities as nine files, 2,959 lines, 55% and 780; and Q-0090's own
bullet, which promised a runnable binary the gate had already ruled to be Q-0096's. The first is a
transcription of a register drifting from it, which is what the register exists to catch; the second
is the plan describing a ticket as it was scoped before its requirements run rather than as it
shipped. **Q-0096's requirements run corrected this page's sequencing on
2026-09-02 and split the ticket in three.** The cut said Q-0091 to Q-0094 were independent of it and
*"do not need this either"*; measured, they cannot start without its export-surface half, because
`packages/core` declares no `exports`, `main` or `types` — a claim `packages/cli`'s own suite had
already pinned since Q-0090 and which this page contradicted for a day. So Q-0096 keeps that half,
**Q-0097** takes the build task and the emit, **Q-0098** takes the binary and the packaging, and the
Q-0010 cut is nine children rather than seven.  **AC-0's decision entry landed the same day** — *"The emit serves the binary, and no test
verdict moves behind it"* (2026-09-02) — so all three tickets are launchable, and the emit strategy
is ruled against the post-Q-0091 tree rather than against the frame that exists today. This is the second time the cut has moved because a
run measured something it assumed, and the first time the thing that moved was a *dependency* rather
than a scope — which is the Q-0074 drift in a third direction, and the argument for the plan/backlog
check acquiring a fourth one day. **Q-0091 shipped on 2026-09-03** and its entry was rewritten to what happened, which is not what this cut described: it was **re-scoped from four commands to two at its requirements gate**, where the head-of-product loop exhausted at limit 1 and produced four errata before a line was written — one of which, E-2, rules a register schema that binds five sibling tickets, because ground rule 5 turned out to be *unsatisfiable as written* for any child translating a binary half. **Q-0099** and **Q-0100** were opened at that gate from findings the flow could not act on. The chore run then priced Q-0083's absence: the code was correct from round 1, no review round ever disputed it, and two rounds costing $14.28 — one of which changed no files at all — went on holding refusals that were right the first time, because an implement step that has proved a criterion wrong has no channel but prose. That is the eleventh appearance of the pattern and the first where the cost is written down with numbers. **Q-0094 shipped on 2026-09-04**, the command the product exists for, with its exit-code contract proven across a real process boundary rather than in process — including **3 for `undecided`** and the preserved **0** an unknown command still exits. Its entry also records the operator getting an erratum wrong twice over: **E-2 was landed while an implement round was already starting**, so that round could not read it while the review after it could, and enforced a half that should never have been written. E-3 withdraws it and states the rule this cut had been paying for since Q-0097 — **the window for an erratum is a gate**, not the gap between a review returning and the next round beginning. **Q-0092 shipped on 2026-09-04** and is the cut's counter-example, which is why its entry is written against Q-0091's rather than on its own: four implement rounds, every one on a defect the implementer could act on, and **no erratum owed at any point** — the first ticket here to reach its chore run with none. Its requirements run is what bought that, ruling five open questions before a line was written and finding that `@quorum/core`'s barrel exported no run-history symbol at all, so ground rule 4's *"the logic is already in core"* was true of existence and false of reachability. The inherited-coverage figure was wrong for the third consecutive ticket and this time the correction changed the shape of the work: 505 was 503, of which about 54 lines actually transfer. **Q-0097 shipped on 2026-09-02** and its entry was rewritten to
what happened, which is not what this cut described: it landed **eleven** criteria rather than the
eight this page promised, because its requirements run added AC-22 to AC-24 and two of them are what
make the ticket work — `@quorum/shared`'s flat `exports`, which Q-0096 reported unfixed and which
would have killed `core`'s emitted `dist` under Node, and a fifth `dist`-awareness site in Vitest's
default `exclude` that neither this page nor decision 078 had. The third correction is to the
sequencing claim that the emit strategy was settled: it was, and what was not settled was **who owes
what an erratum may say** — the run produced three, of which two corrected the *previous* one, both
because a ruling was written from a claim rather than from a measurement. That is the same class as
the drift this paragraph keeps recording, arriving inside the instrument meant to repair it.
**Q-0098 corrected M2's done-when on 2026-09-02.** That bullet had promised *"`npx quorum` works
from a clean clone"*, which decision 078(d) had already refused — every package is
`"private": true`, so the command fetches a stranger's package or nothing — and it now names the two
paths this repository claims and tests, the workspace-local one and the locally packed one, with
registry resolution left to Q-0029 in M6. The same edit is the first time a *harness* context file
was corrected for a claim of this kind: `harness/product-context.md`'s quality pillar 7 is fed to
every product-manager step at run time, so a false installation claim there is one every future
requirement inherits.

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

*All three tickets were closed by hand on 2026-09-01, ten days after this milestone closed, because
they had sat at `draft` — two of them p1 — the entire time. **The work was never missing; it was done
on another ticket.** M0's closing entry names Q-0006 by id as the one that travelled
`draft → requirements → solutioned` on real CLIs, and Q-0006's folder holds it: 89 `runs.log` lines
from 2026-08-22 and 41 real vendor steps. Q-0001's other deliverables landed outside its folder too
— the adapter corrections in `spike/src/adapters/`, the verification table in
`03-adapter-contract.md` — and Q-0003's whole deliverable is a decision entry that cites Q-0003 by
id. This is the Q-0005 / Q-0007 shape, where work done inside another ticket is recorded there; the
only difference is that these three had folders to leave behind. Each now carries a `runs.log` note
naming where its evidence is.*

***A third direction of the plan/backlog check was added with them.*** The two that existed asked
whether a ticket **exists** on both sides; neither asked whether a ticket's own state agrees with
the milestone claiming to have delivered it, which is how three tickets stayed open on the board for
ten days after their milestone closed. `plan-backlog.test.ts` now fails if a ticket bulleted under a
`✅ closed` heading is still `draft`, with a companion assertion that the closed milestones name
enough real tickets for the first one to have a subject. A board that lists a closed milestone's
work as open is not wrong about the files — it is wrong about what is open, which is the one
question a board exists to answer.

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
  through the binary** — `spike/test/smoke.js`, **158 assertion sites of which 76 transfer**, the
  "30-check smoke test" this line
  said until 2026-08-31, counted when it was 30 by *"`integrate` is one generic step type used by
  three stages"* (2026-08-21) — is **Q-0010's**, together with the other seven files that spawn
  `spike/bin/harness.js`: 50% of the suite by line — 53% when Q-0054 counted it, 49% after Q-0062,
  and re-derived by `spike-parity.test.ts` rather than transcribed, which is why it moves in both
  directions; Q-0037 moved it **up**, by reclassifying `q0011-runs-cli.js` out of binary-only once
  the spike gained a `validateArtifact` that file asserts over directly — which cannot be aimed at a
  `packages/cli` that does not exist. Until then both CI jobs stay green and both are required.
- `packages/cli` wraps core with the spike's commands, and `quorum` is a runnable binary from a clean
  clone by the **two paths this repository claims** (no UI yet): the workspace-local one —
  `pnpm install`, `pnpm turbo run build`, `pnpm exec quorum` — and the locally packed one, three
  tarballs installed together into a project outside the repository. **Registry-resolved
  `npx quorum` is refused rather than deferred** while every package is `"private": true`; it is
  Q-0029's, in M6. Q-0098 shipped both supported paths with tests and the line said `npx quorum`
  until it did.
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
- Q-0010 CLI package; `npx quorum` entry. *(Folder created 2026-09-01, `draft`, with a measured
  body and a proposed cut awaiting a ruling.)* **M2's last substantive item; the cutover and M3 both
  queue behind it.**
  **The measurement that reframes it: this is not a port.** Every domain helper the spike CLI
  defines locally already exists in `packages/core` — `findProject`/`loadProject` (Q-0043), the six
  run-history readers (Q-0049), `lintDirectory` (Q-0044), `overrideAdapters` (Q-0047), `containment`
  (Q-0042), eleven of eleven, checked by name. The logic landed during Q-0009 and the spike CLI has
  held duplicates since. What is genuinely unbuilt is a **presentation layer** — the formatters, the
  printers, argv, exit codes, the interactive gate reader, a `bin` entry and the packaging that makes
  `npx quorum` work from a clean clone; `packages/cli/src/index.ts` is one line today. Anyone sizing
  this from Q-0009's $657 is sizing the wrong thing, and anyone calling it trivial is forgetting the
  suite: **2,959 lines across nine `spike/test/` files carry a binary half and transfer here**, 55%
  of the spike suite by line, `smoke.js`'s 780 among them. All four of those figures said eight
  files, 2,515 lines, "half" and 773 until Q-0090 re-derived them from
  `packages/core/src/spike-parity.test.ts`'s own pinned identities — one `binary-only` file plus
  eight `both`, 220 + 2,739 of 5,428 — which is the register catching a transcription of itself, and
  is why a share is re-derived rather than adjusted. `docs/04-architecture.md:73` already said 55%,
  so the two documents had drifted from each other as well as from the register.
  `backlog/Q-0010-…/ticket.md` §2 carries the same four figures and is the human's to correct: the
  backlog belongs to the harness and an agent's edits under it are discarded.
  **The cut was agreed on 2026-09-01 and is now nine children**, Q-0090 to Q-0098. Measured, the
  eight `case` blocks are **252 lines of the 569** — the same finding as above from another angle,
  since the rest is helpers and scaffolding. Q-0090 is a hard prerequisite for all the others;
  Q-0095 is last because it exercises every command. **Q-0039 becomes a blocker the moment two of
  them run concurrently**, since two runs on one ticket already share a worktree and compute the same
  run id — which is why the children that *could* run in parallel are run one at a time.
  **All six command children are done as of 2026-09-04, and only Q-0095 remains.** `packages/cli`
  dispatches `lint`, `validate`, `runs`, `init`, `ticket`, `board`, `adapters` and `run`; the cut
  became **ten** children rather than the nine this paragraph describes, because Q-0091 split at its
  requirements gate. **Measured across the six: $370.68** — Q-0090 $71.25, Q-0091 $72.15, Q-0092
  $58.66, Q-0093 $66.07, Q-0094 $75.03, Q-0099 $51.75 — against Q-0009's $657.47 for fourteen port
  children, so a command child costs roughly $62 where a port child cost $47.
  **What the money bought was not porting either, and not scaffolding this time: it was rulings.**
  Nine errata across the six, of which **four are the same class** — a criterion's prose read as a
  literal contract (Q-0091 E-3, Q-0094 E-1, E-2, E-3(b)) — and one, Q-0094's E-3(a), withdraws an
  erratum the operator wrote wrongly and landed at the wrong moment. Two rules came out of it and are
  worth more than the code: **a requirement describes what must be conveyed; only a fixture, a frozen
  contract's own file, or a criterion quoting bytes pins bytes**; and **the window for an erratum is a
  gate**, not the gap between a review returning and the next round beginning.

  **The cut has now moved twice, both times because a run measured something it assumed**, and the
  second correction is to the sequencing rather than to the scope. It said until 2026-09-02 that
  Q-0091 to Q-0094 were independent, could run in any order, and did not need Q-0096. Q-0096's own
  requirements run measured that false and it was verified by hand at the gate: `packages/core`
  declares no `exports`, no `main` and no `types`, and `packages/core/src/index.ts` is
  `export const name = '@quorum/core';`, so a command child importing `@quorum/core` fails under
  Vitest as well as under Node — `packages/cli/src/package.test.ts:141` already pins it, routed there
  by Q-0090. **Q-0096 was split in three at that gate** — the export surface stays Q-0096 and
  unblocks the four command children after **6** criteria instead of 21; **Q-0097** takes the build
  task and the emit; **Q-0098** takes the binary and the packaging. The real order is
  **Q-0096 → {Q-0091…Q-0094 unblocked} → Q-0097 → Q-0098 → Q-0095**, and the plan saying otherwise
  for a day is the same class as the Q-0074 drift: a document describing a dependency nobody had
  measured.
  **Every child's inherited-coverage figure has been wrong, in two distinct ways, and the register
  already held the right answer.** Five in a row measured at their requirements gates: Q-0091's
  *"698 lines"*, Q-0092's *"505"*, Q-0093's *"217"*, Q-0094's *"353"*, and Q-0098's *"22 files"*.

  The **arithmetic** error is a systematic **+1 per file** — six files measured, six exact matches
  against `wc -l`, which is what an editor's line display gives for a file ending in a newline. The
  one exception is `q0033-surface.js`'s *446* for 476, a transposition. This paragraph said
  *"whole-file estimates"* until Q-0094's gate, which named the arithmetic precisely; a diagnosis
  that gets the cause wrong is worse than none, because the next reader re-derives against it.

  The **scope** error is the larger one and does not point in a consistent direction. Q-0092's 503
  **overstates** — about 54 lines actually transfer. Q-0094's 353 **understates**: it names the two
  *smallest* contributors and omits the two largest, so ≈193 lines transfer where the two files it
  lists carry 44 between them.

  **The instruction is therefore to read `spike-parity.test.ts` first, not to re-derive from
  scratch.** On Q-0094 the register was right twice where the body was wrong: `:249` already stated
  the gate split — *"the two where no answer was available exit 3, the three operator errors exit
  1"* — against a body claiming three and five, and `:1594` already routed `q0033-surface.js`'s
  remaining half to Q-0094 by name. These bodies do not merely lack precision; they **contradict a
  register that was correct**. **Q-0095 and Q-0099 each still carry one.**

  The seam's weakness is stated rather than hidden: the eight binary-half files do **not** partition
  cleanly by command, which is why `smoke.js` is its own child and the cut is six rather than eight.
  **Each child body repeats Q-0010's ground rules verbatim**, because `input.backlog` resolves
  against the running ticket's own folder and nothing injects a parent's body into a child's run —
  the same constraint that put Q-0009's rules in `harness/port-charter.md`. No second charter is
  added: five rules fit in a body, and a charter would have to be retired later.
  - Q-0090 CLI package skeleton, `bin` entry and `npx quorum`. *(`reviewed` and `main:contained`
    2026-09-02.)* **$71.25** — $19.07 requirements over four head-of-product attempts, $52.16 chore
    over six implement rounds reached through three retries. Round 6 returned "No findings".
    **Its requirements run is what found that Q-0010's cut assumed something false** — the workspace
    has never emitted JavaScript — so `npx quorum` was withdrawn from this ticket, the frame ships as
    importable modules tested in process, and **Q-0096** exists. Six review rounds each found a
    different real subject: the `e.stack ?? String(e)` divergence and then the over-correction that
    printed where the spike **raises**; a test requiring the `bin` target to end in `.js`, which was
    this ticket pre-deciding Q-0096's emit strategy; the BYOS guard narrowed twice; and `main`
    discarding `rest`, `flags` and `gateAnswers`, which would have made all four command children
    re-parse argv — AC-2's stated purpose unmet at the dispatch boundary.
    **Erratum E-1 is the reusable output**: it ruled that *"Membership is a git question, not a
    filesystem one"* (2026-08-28) does **not** govern the BYOS scan, because that entry is scoped to
    `turbo-inputs.test.ts` and argues from what turbo hashes — no analogue in *"is a credential
    present"*, where a gitignored file is still on disk and still readable by any agent given
    `input.repo: true`. Two rounds had narrowed that guard; the ruling closed it in one, and the
    shipped guard carries the reasoning in place and goes red if `--exclude-standard` is restored.
    **The retries that worked are the ones where the tree changed**, which is the session's lesson
    about `retry`: iteration 2 of the requirements run recorded that it had opened on an unchanged
    tree and could not rule its own blocker, and only produced a ready document once the gate ruling
    was written into the ticket body first.
    **One environment note:** the merge is red in an existing checkout until `pnpm install` links the
    new package's workspace dependencies — `pnpm install --frozen-lockfile` reports *"Already up to
    date"* in 180 ms and the suite flips green. CI does a fresh install so never sees it; a developer
    pulling the merge does, and it looks like a code defect.
    The frame is: argv, the colour helper, `die`, and the exit-code table below — the deliverable —
    argv, the colour helper, `die`, and **exit codes as a single owned table** rather than scattered
    `process.exit` calls — 0, 1, 2, 130 on signal, and **3 for `undecided`**, which Q-0040 added the
    same day. No command is implemented; the deliverable is the frame, **as importable modules with
    tests that run in process**, plus the package manifest and its `bin` field. It said "and a
    binary that runs from a clean clone, which is also M6's cold-clone path" until its requirements
    run measured that this workspace emits no JavaScript at all; the gate ruled on 2026-09-01 that
    the binary, the emit and what `npx quorum` may mean are **Q-0096's**, so Q-0090 stays the
    prerequisite for Q-0091 to Q-0094 and is no longer the prerequisite for running anything.
  - Q-0091 CLI read-only commands: `lint` and `validate`. *(`reviewed` and `main:contained`
    2026-09-03; **re-scoped from four commands to two** at its requirements gate.)* **$72.15** —
    $13.55 requirements, $58.60 chore across four implement rounds, one `retry`, ending in `approve`
    and a green integrate. **`quorum lint` and `quorum validate` run through the built binary**, with
    the exit-code contract verified by execution rather than from the report: clean flows 0, no args
    1, non-conforming artifact 1.
    **Its requirements run exhausted at limit 1 and produced four errata before a line was written.**
    Twenty-one criteria against a ceiling of fifteen forced a split, on a seam measured in the spike
    source rather than chosen: `lint` (`:404`) and `validate` (`:460`) end in
    `process.exit(ok ? 0 : 1)` and carry an exit-code contract a `type: script` step depends on,
    while `board` (`:398`) and `adapters` (`:425`) end in `return;` — **Q-0099** takes that pair.
    **E-2 is the ruling that reaches past this ticket**: ground rule 5 was *unsatisfiable as written*,
    verified structurally — `admissible()` permits a binary-spawning file that imports no spike source
    only the verdict `cli`, and `audit()` fails a `cli` entry naming counterparts, so no edit could
    record a translated binary half and the register would go on reading *"the work is still owed"*
    after it had been done. `Entry.binaryCarriedBy?` was added rather than a fourth verdict, because a
    verdict describes the spike file's own text and translation does not change it; it binds Q-0092 to
    Q-0095 and Q-0099. **E-3 stopped an implementer reverting Q-0037**: the body quoted a phrase from
    the frozen contract that the shipped notice does not contain — `shipped.includes(phrase)` is
    false, the words rearranged and one negated — and following it literally would have restored the
    wording Q-0037 deliberately replaced.
    **The body's grouping premise was false in every direction**, which matters more than the three
    mutually inconsistent figures it also carried (components 667, sentence 698, tree 696 — wrong when
    written, not stale). `validate`'s entire binary half is in `q0011-runs-cli.js`, **Q-0092's file**,
    and `adapters` inherits nothing from either named file, its one occurrence there being a flow-lint
    scenario about review panels.
    **The chore run's shape is the finding, and it is Q-0083's absence priced.** The code was correct
    from round 1 and no review round ever disputed it: all three early reviews returned the same two
    majors, both about *authority* rather than the change — `validate` calls no `loadProject` (AC-4
    said both commands must) and `lint` forwards `flags.project` (AC-2 said it reads neither). Both
    criteria were wrong, and the implementer proved it: the spike's `validate` case holds no
    `loadProject` call site, and the spike reads `flags.project` **inside** `loadProject`, which
    `lint` calls — so AC-2's aside described the case block while its normative half, *no command
    re-parses the command line*, binds and is met. **Rounds 2 and 3 cost $14.28 and round 3 changed no
    files at all**, byte-identical to round 2's commit, because an implement step that has proved a
    criterion wrong has one channel: prose nobody reads until a gate. Eleventh appearance of the
    pattern; `requirements/errata.md` **E-7** records it with numbers rather than describing it again.
    **Two things went right and are recorded as such.** Round 2 refused on ground rule 3 rather than
    yielding, citing Q-0052's round-3 yield as the mistake not to repeat, and rounds 2 and 3 spent
    themselves on measurement rather than re-argument. And **E-5 and E-6 were deliberately held rather
    than landed mid-loop** — drafted after round 1 and kept back, because Q-0097 cost two errata by
    landing one while a round was in flight that then built past it. Round 4 was the first to read
    them, changed twelve lines of authority comment from *"an erratum is owed"* to *"see E-5/E-6"*,
    and was approved. Its review is also the first to read the change without an authority blocker in
    front of it — Q-0038's precedent — and returned one nit, fixed after the gate: `validate.ts`'s
    summary said the command exits 1 *"on the first"* non-conforming artifact while its own body three
    lines down, and the code, aggregate across all of them. Confirmed by running it over two bad
    artifacts, which reports both.
    **The approve was distrusted rather than banked** (Q-0051): the reviewer stated it could not
    execute the suite under `--sandbox read-only`, so the exit codes and the skip notice were verified
    through the built binary instead.
  - Q-0099 CLI `board` and `adapters`, the two commands that always exit 0. *(`reviewed` and
    `main:contained` 2026-09-04.)* **$51.75** — $12.81 requirements ready on the first pass, $38.94
    chore in **one implement round approved with no findings**, `iter={}`, no exhaustion gate. The
    second ticket of the cut to close that way, after Q-0093, and **the last of the six command
    children**.
    **It is the first ticket whose body the operator wrote rather than inherited** — transcribed from
    Q-0091's Appendix A at that gate — and its requirements run refuted that body in two places,
    which is the entry's reason for existing.
    **The one that mattered:** the body said the form `owner=qa cost=$0.00 iter={}` *"exists nowhere
    under `spike/test/`"*. It is `q0036-board-containment.js:126`, in a live assertion. The
    provenance is the lesson — Q-0091's run correctly found a candidate mis-citing that regex as
    something `q0033-surface.js:342` asserts, then **overreached** to *"occurs nowhere"*, and the
    operator transcribed that conclusion into this body at a gate without re-running the grep. One
    command refutes it. A correction was itself wrong, travelled one document further by being
    copied, and took a whole ticket to surface: *"a measurement copied from a document is not a
    measurement"*, with the operator as the copier. **It cost nothing only because the implementer
    read the requirement rather than the body**, landing the assertion as C3 with the exact regex and
    a stronger full-line equality beside it.
    **The run's own best finding is neither of those.** `Backlog.create` defaults `owner` to
    `process.env.USER` — the preserved defect ground rule 3 forbids closing here — and `q0036`'s
    fixture passes `--owner qa` while `q0033`'s does not. So **a translated fixture asserting
    `owner=` must supply one**, or its verdict becomes a property of the account, which *"A test's
    verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) forbids.
    The preserved defect and Q-0079's rule intersect in a way neither ticket anticipated; four sites
    now supply an owner explicitly.
    **Verified through the built binary**, the reviewer again unable to execute under
    `--sandbox read-only`: all three containment states render — 12 `main:contained`, one
    `main:not-contained(+2)`, 43 `main:indeterminate(no branch)` — and the only forbidden synonym
    anywhere in the output is inside **Q-0033's own title**, printed verbatim, which is correct
    rather than drift. The BYOS refusal fires with an API key set and still says *"Harness"*
    (Q-0068's), and the probe notice still says `harness adapters --probe` (Q-0100's); neither is
    fixed in passing. **Every `adapters` assertion is new**, that command inheriting nothing — its
    only occurrence in `q0033-surface.js` is `:249`, a flow-lint scenario about review panels rather
    than the command.
  - Q-0100 The user-facing binary is called `quorum`, not `harness`. *(Opened at Q-0091's
    requirements gate 2026-09-03, `draft`.)* Three sentences tell an adopter to run a binary that
    does not exist — the board's hint `→ harness run <flow> <id>`, `ProjectNotFoundError`'s ``run
    `harness init` in your repo`` (which `project.ts:31` already records as *"Carried, not fixed"*),
    and `validate`'s `usage: harness validate …` — and **Q-0093's `init` next-steps line will be a
    fourth**, which is the argument for ruling the class once rather than per command. Distinct from
    **Q-0068**, whose subject is the adapter refusal string in different files for a different
    reason. What is undecided is not the target word but three things: whether `spike/bin/` changes
    before the cutover deletes it, how the hint moves in step with Q-0099's AC-2 which pins it, and
    whether a user-facing *instruction* belongs in a `core` error message at all once M3's server
    surfaces the same error over HTTP. A blanket `sed` is refused: the folder is `harness/` and the
    concept is a harness, which `product-boundaries.md` requires be kept apart.
  - Q-0092 CLI `runs` and the run-history presentation layer. *(`reviewed` and `main:contained`
    2026-09-04.)* **$58.66** — $11.13 requirements ready on the first pass, $47.53 chore across four
    implement rounds and one `retry`, ending in *"No findings"*. The largest command at 72 lines,
    over six readers already in `core`.
    **It is the cut's useful contrast with Q-0091, and the contrast is the finding.** Every one of
    its four rounds moved the code against a real defect the implementer could act on, and **no
    erratum was owed at any point** — the first ticket here to enter its chore run with none, where
    Q-0091 needed four, Q-0097 three and Q-0098 two. Q-0091 spent three rounds and $14.28 on criteria
    that were simply wrong, one of them changing no files at all. The difference traces to the
    requirements run, which ruled all five of its open questions before a line was written.
    **Its first finding was that `@quorum/core`'s barrel exported no run-history symbol at all.** The
    body said *"Everything it reads is already in `core`"* and ground rule 4 calls the CLI a
    presentation layer over an API that exists; both are true of **existence** and false of
    **reachability**. So the work was not "port ten formatters" but "port ten formatters, extend the
    barrel by a subsystem, and move the two guards that derive from it" — `DOMAIN` 14 → 20 plus a
    `COMMAND_DOMAIN` row, which landed together as they must. The barrel went 18 → 24.
    **The inherited-coverage figure was wrong for the third consecutive ticket, and this time the
    correction changed the shape of the work.** The body said 505 lines across two files; measured,
    220 + 283 = 503 — but only **~54 lines and one invocation** transfer, because
    `q0011-runs-cli.js`'s `validate` half was *already carried by Q-0091* and 279 of
    `q0011-run-history.js`'s lines are library-only with six existing counterparts. Q-0091's 698 and
    Q-0098's 22 were wrong the same way: whole-file counts standing in for the half that moves.
    Q-0093, Q-0094, Q-0095 and Q-0099 each carry one, and none should be trusted unre-derived.
    **The three rounds, each fixed at the right layer.** A `token !== undefined` where the spike
    tests `if (token)`, so `quorum runs ""` would have reported *unknown run or ticket* while the
    spike lists everything — closed with a parity test asserting the two invocations produce the
    *same listing* rather than that the empty one merely does not error. AC-9's separate-reader
    process, satisfied by spawning the built binary from `build.test.ts`, which already owns
    `runBuild()` and `binTarget()` and which Q-0098 AC-15(c) rules may spawn the emit. And four of
    eight occurrence fields interpolating `undefined` where the JSDoc one line above promised *"`n/a`
    for each absent value"* — the fifth appearance this session of a comment promising what the code
    beneath it does not do — fixed at the guard rather than by weakening the comment, with the
    reasoning recorded: `Occurrence` declares four fields non-nullable while a detail read validates
    no schema, so they are *nullable in fact and not in type*.
    **`binaryCarriedBy` earned its ruling here.** Q-0091's E-2 created the field; this ticket used it
    at three sites and then extended one row to **two files**, with prose saying why — *"across two
    files because the assertion claims two things"* — and deleted a deferral that had been claiming
    Q-0095 owed a half now carried. That is the first evidence that ruling the schema once at
    Q-0091's gate rather than five separate times was worth doing.
    **Verified through the built binary rather than from the report**, the reviewer having again been
    unable to execute the suite under `--sandbox read-only`: the six new symbols resolve as functions
    in a plain `node` process, and **Q-0037's OQ-2 holds over real run history** — four measures
    printed separately, zero per-occurrence lines carrying a bare summed `tokens=` or
    `unpriced_steps`, nulls rendering `n/a` and never `0`. The roll-up count of zero is confirmation
    rather than a gap: `printRunDetailHuman` never renders it, which is why `q0034-review-fixes.js`
    B2's guard reads the per-step line.
  - Q-0093 CLI writing commands: `init` and `ticket`. *(`reviewed` and `main:contained`
    2026-09-04.)* **$66.07** — $13.70 requirements ready on the first pass, $52.38 chore in **one
    implement round approved with no findings**, the only round of the cut to close that way and the
    most expensive single round in the project. Against 42 of 59 chore reviews returning `revise`, it
    was distrusted rather than banked and verified independently instead.
    **`init` had nowhere to read its templates, and that is the finding neither governing document
    could see alone.** `packages/templates` was a two-file stub holding no assets and the real corpus
    lived only under `spike/templates/`, which the cutover deletes. Decision 078(e) had anticipated
    that half — *"Q-0093 does not build `init` against a guess"* — and fixed the depth, since
    `spike/bin/harness.js:321` resolves the assets relative to the binary's own file and Q-0098 put
    the binary at `dist/quorum.js`. **The half 078(e) could not see** is that Q-0098 later landed
    `files: ["dist"]`, so a packed tarball carried **zero** template files and `init` would have
    failed on one of the two installation paths Q-0098 itself verified. The trap existed only because
    the allow-list was written after the depth ruling, and it took a run reading both to find it.
    **What shipped**: twenty template files at `packages/cli/templates/harness/` byte-identical to the
    spike's, `initProject` in `core/backlog/scaffold.ts`, `currentBranch` ported into `core/git`
    because AC-7 measured it as defined at `spike/bin/harness.js:287` and nowhere else in either tree,
    `files` extended to `["dist", "templates"]`, and `build.test.ts`'s single `toStrictEqual([EMIT])`
    replaced by a **per-package register** — forced rather than tidy, because only `@quorum/cli` gains
    the second entry and the old literal sat inside a loop over all three.
    **The anti-drift guard is the best-shaped check an implement step produced in this stretch**, and
    it was mutation-tested rather than read. Three mutations, three distinct signatures: one byte in a
    `packages/cli` flow fails parity alone; one byte in the **spike's** copy fails parity *plus* a
    second clause, so the pin is bidirectional; and deleting a role file fails parity plus *"the
    mirror is tracked, so what a tarball ships is the commit and not the checkout"* — Q-0098's E-1
    lesson applied to templates before anyone hit it. It also asserts that the comparison cannot be
    satisfied by a tree compared with itself, which is the check on the check.
    **The packed-install path was verified end to end after the gate**, because no criterion covered
    it and F-3 had predicted it would ship broken: three tarballs packed, installed into a project
    outside the repository, and `quorum init` scaffolding all twenty files. Two things surfaced.
    **Q-0098's M-8 reproduced exactly** — a first attempt with `npm pack` died on
    `EUNSUPPORTEDPROTOCOL` for `workspace:*`, which is why that requirement's fixture uses `pnpm pack`
    and installs all three together. And the scaffold's own next-steps line reads *"next: harness
    adapters · harness ticket new … · harness run requirements T-0001"*, so a stranger who has just
    installed `quorum` is told to run a binary called `harness`. That is the **fourth instance Q-0100's
    body predicted by name**, now confirmed on the cold-clone path rather than anticipated, and
    correctly preserved verbatim here rather than fixed in passing.
    **The `owner` defect is preserved at `backlog.ts:190`** as ground rule 3 requires: nine instances
    and three hand corrections have never reached the code, and this ticket does not reach it either.
  - Q-0094 CLI `run`, the gate reader and its flags. *(`reviewed` and `main:contained`
    2026-09-04.)* The command the product exists for. **$75.03** — $10.90 requirements ready on the
    first pass, $64.13 chore across four implement rounds and one `retry`, ending in *"No findings"*.
    **The exit-code contract is proven across a real process boundary**, which is what the ticket
    exists for and what the reviewer could not do under `--sandbox read-only`. Through the built
    binary: an operator error exits **1**, a bad `--gate-answer` exits **1**, an unknown command
    still prints help and exits **0** — the preserved defect Q-0090 AC-6 requires, which a tidier
    implementation would have closed in passing — and a gate reached with no answer available, stdin
    not a terminal, ends the run **`undecided`**, moves no stage, rolls nothing back, keeps zero
    worktrees and **exits 3**. That is the whole of Q-0040's contract in one run.
    **Its plan bullet said the gate reader had "three meaning nobody was there" until this entry
    replaced it, and the register had been right all along.** Measured at the requirements gate: five
    throw sites, **two** unanswered (`answers-exhausted`, `stdin-closed`) and **three** operator
    errors; the third `GateUnansweredCondition`, `no-answer-channel`, is `core`'s and unreachable
    from a CLI that always supplies an `answerGate`. `spike-parity.test.ts:249` has stated that split
    since before the ticket was written, and the body's own arithmetic — three plus five against a
    stated total of five — could not hold either way.
    **Review round 1 found a defect the port INTRODUCED rather than inherited**, which is the
    strongest single finding of the cut. The readline interface was closed only after
    `rl.question()` resolved, while `SIGTERM` — for which readline has no event — rejected the abort
    promise without settling it, so the process could survive with input listeners attached. The
    spike never had it: `engine.js:113–114` registered `SIGTERM` and exited, and Q-0050's ruling that
    `core` installs no signal handler is what removed that ground. Ground rule 3 protected nothing,
    and round 2 fixed it.
    **Three errata, all the same class, and the third names it.** E-1: AC-6's
    `<advance|retry|abort or advance|abort>` is placeholder notation like the `<kind>` beside it —
    no implementation prints the word *or* — and the spike prints no brackets. E-2: §8's row claiming
    no numbered document changes is false, `04-architecture.md` having said *"Since Q-0093 it
    dispatches five commands"*. E-3(b): AC-1(3)'s four field names say what `ParsedArgv` carries, not
    a destructuring shape — measured, **not one of the five shipped handlers binds `cmd`**, because
    `main.ts` dispatches `HANDLERS[cmd](parsed)`, so the literal reading would ship a dead binding in
    the product's most load-bearing command. The rule stated once: *a requirement describes what must
    be conveyed; only a fixture, a frozen contract's own file, or a criterion quoting bytes pins
    bytes.* Fourth instance in this stretch, after Q-0091's E-3 and Q-0098's E-1.
    **E-3(a) withdraws half of E-2, and that is the operator's error recorded twice over.** E-2 ruled
    the development-plan edit must stay; this page's bullets are rewritten by hand at each plan pass,
    so iteration 3's revert cost nothing and the ruling turned a harmless revert into a review
    finding. Worse, **E-2 was landed while iteration 3 was already starting** — it appears zero times
    in that step's prompt — so the round could not read it and reasoned to the opposite conclusion,
    while the review that followed *could* read it and enforced the wrong half. Q-0097 lost two
    errata to exactly this. **The rule is now written down: an erratum landed between a review
    returning and the next implement starting has no reliable window; the window is a gate.** E-3 was
    landed at one, and round 4 respected both rulings — `cmd` unbound, the plan untouched, and twelve
    lines of authority comment moved from argument to *"Why: ruled, see E-1/E-3"*.
  - Q-0096 `@quorum/core` resolves and exports its public API. *(`reviewed` and `main:contained`
    2026-09-02; retitled from *"The workspace emits JavaScript, and `quorum` is a runnable binary"*
    when it was split, because that title now describes Q-0097's and Q-0098's work. Opened 2026-09-01
    from Q-0090's requirements run, which blocked on it twice and was right both times — **the cut
    became seven children because a run measured something the cut assumed**, and nine when this
    ticket's own requirements run split it.)* **$38.46** — $10.59 requirements, $27.87 chore.
    **It unblocks Q-0091 to Q-0094**, which is what the split was for: six criteria instead of
    twenty-one.
    **What shipped is decision 078(b) implemented literally**: a `quorum-source` condition resolving
    `./src/index.ts`, `./dist/index.js` by default, `customConditions` in `tsconfig.base.json` and
    `ssr.resolve.conditions` in `vitest.shared.js` — the default list spread rather than replaced —
    so `tsc` and Vitest prove source while a plain `node` process is sent to an emit Q-0097 has yet
    to build. Sixteen symbols from **two** named registers, `"."` alone with no wildcard subpath, and
    `packages/shared/src/index.test.ts`'s byte pin **retired by replacement rather than deleted**.
    **The run did not finish, and the reason is worth recording because it was not a defect.** Review
    iteration 2 died on `codex exited 1: Selected model is at capacity`. Because `failed` is not
    `finished()`, `finish()` rolled the ticket branch back — a no-op, `integrate` never having run —
    and kept the worktree, which is Q-0062's rule working on the first vendor failure to test it.
    Nothing was lost. **Review round 2 and `integrate` were then performed by hand**, cross-vendor
    (claude wrote, codex reviewed), on Q-0050's and Q-0079's precedent; the review is a direct
    adapter call outside any run, so **no manifest records it** and `runs.log` carries it instead.
    **The codex approve was distrusted rather than banked**, per Q-0051 — 42 of 59 chore reviews
    return `revise` — and the reason was concrete: codex runs `--sandbox read-only`, so its own
    attempt to execute the suite failed `EPERM` and it approved on reading alone. Confirmed by
    mutation instead: aiming the `default` condition at `./src/index.js` turns two AC-1 assertions
    red and removing the `exports` map turns three red, each with a discriminating message.
    **The run's most durable finding is round 2's, and the reviewer had not named it.** Round 1's
    major was that `package.test.ts` required `ERR_MODULE_NOT_FOUND` and so codified the opposite of
    AC-1. The implementer refused both offered remedies with reasons — an implement step cannot write
    `requirements/errata.md`, and building `dist/` here implements Q-0097's central deliverable — and
    replaced the assertion with a positive `import.meta.resolve` proof. Measuring the replacement it
    found that **the old assertion's verdict came from the checkout**: `dist/` is gitignored, so
    requiring the import to *fail* is green in a fresh clone and red in any checkout that has ever
    built — and red **everywhere including CI** the moment Q-0097 lands the build task. That is *"A
    test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30)
    arriving through an assertion rather than a guard, and it is the build-directory cell R-4 had
    named as one to watch. It also caught a defect it had introduced — `String()` on a module
    namespace throws, those having a null prototype — and **removed two of its own assertions for
    being unfalsifiable before shipping them**, which is the Q-0050 defect class refused by the round
    that would have committed it. `requirements/errata.md` **E-1** records the ruling.
    **Reported and not fixed, and Q-0097 inherits it:** `@quorum/shared`'s manifest still names
    `./src/index.ts` for both conditions, while 21 production files in `packages/core` import it by
    package name — so the `dist/index.js` Q-0097 emits will carry `import … from '@quorum/shared'`
    and die under Node until that manifest gains the same conditional map. No criterion of this half
    named it. *(The original body follows.)* This workspace has
    never emitted JavaScript and nothing in it is arranged to: no `build` task anywhere, no `paths`
    in `tsconfig.base.json`, no `exports`/`main`/`types` on `@quorum/core` — so it is unresolvable at
    **typecheck** as well as at runtime — and `@quorum/shared`'s `exports` naming `./src/index.ts`.
    It works because Vitest transpiles; nothing else runs the code. So a `bin` entry is not
    scaffolding, which is what Q-0090's body called it: a `bin` pointing at a `.ts` file does not run
    under Node, and Node's type stripping does not close it either.
    **It owes a decision entry before code, for Q-0065's reason one layer up.** A `build` task with
    real `outputs` replays an **artifact**, where all three existing tasks declare `"outputs": []`
    and replay only a verdict — and a stale `dist/` a downstream task executes is worse than a stale
    green tick. **`npx quorum` is settled here too**: every package is `"private": true` and `npx
    quorum` resolves against the public registry today, so the achievable claims are the workspace
    and packed-tarball paths, and registry `npx` stays Q-0029's in M6.
    **Split in three at its requirements gate on 2026-09-02, and re-scoped to the export surface
    alone — AC-1 to AC-6, 6 criteria.** Both `head-of-product` iterations returned `needs-input` and
    the loop exhausted at limit 1; advanced rather than retried on Q-0070's and Q-0079's precedent,
    because every blocker is work no step in that flow may perform. **$10.593 and 6,099,422 tokens**
    across three claude steps plus one unpriced codex candidate. Iteration 2 opened on an unchanged
    tree and said so — `docs/decisions/` still ended at 077, the ticket body was untouched, the git
    tip was still `729dcb3` — which is Q-0090's *"a retry on an unchanged tree cannot rule its own
    blocker"* observed a second time, on a second ticket, in the same week. The merged requirement is
    780 lines and its measurements were re-verified by hand at the gate rather than relayed; **one is
    wrong and is corrected in two ticket bodies before it can reach decision 078**: §M-3's *"the only
    cross-package import"* is true of production source only, since `exit.test.ts:20` is a value
    import of `runTerminalEventSchema` from `@quorum/shared`. **Its decisive new finding is AC-13**
    and it is Q-0097's: `test-discovery.test.ts:59` and `package.test.ts:76` both hand-write
    `['lint','typecheck','test']`, neither derived from `turbo.json`, so adding a `build` task leaves
    both at three, both doc comments false, and turbo silently skipping every package with no build
    script — verbatim the failure the first guard's own describe block exists to close, and the
    `q0050.source.test.ts` fail-open shape Q-0051 found, in a file whose `PACKAGES` half *is* derived
    from the workspace globs. A package added later is covered; a task added later is not.
  - Q-0097 The workspace emits JavaScript. *(`reviewed` and `main:contained` 2026-09-02.)*
    **$91.39** — $15.76 requirements across two runs, $75.63 chore across four implement rounds,
    reached through one `retry` and closed by `advance` at a second exhaustion gate. **The workspace
    emits for the first time**: a root `build` task with `dependsOn: ["^build"]` and
    `outputs: ["dist/**"]`, the first non-empty `outputs` here, driven by a `tsconfig.build.json` per
    emitting package. Eleven criteria, not the eight this line promised — AC-22 to AC-24 were added
    by the requirements run and two of them are why the ticket works.
    **AC-22 is the finding that made it satisfiable, and no criterion of the ticket body named it.**
    `@quorum/shared`'s `exports` was still a flat `./src/index.ts` map — Q-0096 reported it unfixed
    and this page inherited the gap — so `packages/core/dist/index.js` would have died at its first
    specifier under Node. **AC-23 is a site neither the body nor 078 had:** Vitest's default
    `exclude` is two entries and `dist/**` is not among them, so an emitted `dist/**/*.test.js` would
    have been *collected and executed*. Four `dist`-awareness sites already held and the fifth failed
    open.
    **Proven by execution rather than by report**, which is 078(b)'s own demand: a clean build emits
    96 files, and a plain `node` process knowing no `quorum-source` condition resolves
    `@quorum/core` to `dist/index.js` and imports it — 16 symbols, with `@quorum/shared` resolving
    through it. Both new guards were mutation-tested and turn 3 tests red each.
    **The requirements stage cost two runs because the first was aborted at its gate**, and the cause
    was an agent contract violation rather than a defect: head-of-product returned `ready` having
    composed the document its `summary` describes, and wrote a 44-byte placeholder into the field the
    engine persists. `advance` would have approved a document that was not there, and a declared
    human gate offers no `retry` — `runGate` honours one only where `retryTarget` is set. **Nothing
    validates that a step's document is substantive**, which is *"a check that skips its subject must
    not report success"* (2026-08-25) arriving on the artifact rather than on the check; registered
    here and owed its own ticket.
    **The durable lesson is about the erratum, and it cost two of them.** The deliverable was stable
    from implement round 1 and every finding after it was in the **test scaffolding** — Q-0050's
    shape again. Round 1's two majors were both checks that could not see their subject: an audit
    snapshotting path *names*, so an overwrite was subtracted away by the comparison meant to find
    it, and an AC-23 assertion listing `.test.ts` where an emit produces `.test.js`, which therefore
    could not fail. **E-1 was the operator's mistake**: written between round 3 starting and its
    review to give a possible `retry` a subject, it narrowed AC-8 to fit an implementation not yet
    attempted, and round 3 — which never saw it, a step's inputs being read when it starts — built
    something better. Review round 3 then blocked that change for contradicting E-1, correctly and
    entirely as an artifact of a bad ruling. **E-2 withdrew E-1**; round 4 changed no behaviour and
    added two `Why:` authority lines so a reader meeting E-1 first cannot repeat the misreading.
    **E-3 then corrected E-2**, which had transcribed an implementation's claim — that the isolated
    audit descends into `node_modules` with no blind spot — into a ruling without running it. *A
    sentence in an erratum is a measurement like any other*, and this ticket got it wrong twice in
    the same direction.
    **Two majors were advanced past and repaired by hand after the gate** (Q-0073, Q-0080), with
    E-3 recording both: `isTurboMetadata` exempted every path with a `.turbo` segment while the
    JSDoc one line above promised the opposite, now two measured shapes with a mutation shown red
    first; and a write *through* a symlink is registered rather than fixed, unreachable by any
    shipped build script. **The first attempt at that narrowing was wrong in the same way as the
    defect** — derived from the per-package `.turbo` directories alone, it reported turbo's root
    cache as strays — which is recorded rather than quietly corrected.
    Verified forced on `main` in the populated row after the merge: workspace 21/21 tasks 0 cached,
    spike 19/19, `harness lint` 6/6, git-identity sweep green in both checkout shapes.
    **It unblocks Q-0098**, which needs the artifact.
  - Q-0098 `quorum` is a runnable binary, and what `npx quorum` may claim. *(`reviewed` and
    `main:contained` 2026-09-02.)* **$50.36** — $9.43 requirements ready on the first pass, $40.93
    chore across three implement rounds — and **the cheapest of the three siblings**, against
    Q-0097's $91.39 and Q-0096's $38.46. **`quorum` runs**: `node packages/cli/dist/quorum.js help`
    prints the frame's help and exits 0, from a `bin` at `./dist/quorum.js` whose depth is ruled
    rather than chosen — one directory below the package root, so `path.join(here, '..')` reaches
    the package and Q-0093's `init` inherits the template depth 078(e) fixes. `files: ["dist"]` on
    all three emitting packages took the CLI tarball from **40 files to 17** — sixteen emitted files
    and the manifest, with zero tests, `src/` or turbo logs.
    **Nine criteria, not the seven this line promised.** The requirements run added AC-25 and AC-26,
    numbered from 25 because Q-0097 had already spent AC-22 to AC-24 in the shared space. Its two
    largest findings were its own: the local distribution set is **three tarballs**, not one —
    `core` packed 167 files and 2.0 MB, `shared` 52 and 339.8 kB, neither declaring `files` — and
    **`@quorum/cli` cannot install from its own tarball alone**, because `workspace:*` either
    rewrites to a `0.0.0` the registry does not have or stays literally invalid outside a workspace.
    The fixture therefore installs all three together.
    **The run aborted at `integrate` with the suite red, and that is the flow working.** It was the
    first execution of the change — the implement step runs no tests and the review is read-only —
    so `integrate` caught what three cross-vendor reviews could not. Diagnosed by experiment rather
    than by reading: **pnpm links a bin shim during *install*, and only where the target exists.**
    With `dist/quorum.js` absent the install links nothing and says so in a `WARN` nobody reads;
    re-running the identical command once the artifact exists creates it. Decision 078(b)
    deliberately gives `test` no `^build` edge, so from a clean checkout the order is install → test
    and `dist/` is *guaranteed* absent when install runs — which makes AC-18's shim mechanism
    **structurally incompatible with the ruling this ticket sits under**, not a slip. The
    implementer's worktree had built before installing, so its verdict was a property of that
    checkout's ordering rather than of the commit. **Finished by hand** on Q-0096's precedent:
    `linkBins()` installs after building at both call sites, shown load-bearing by deleting the shim
    and watching the fixture recreate it.
    **Two errata, and this time both were measurements.** E-1 was written at the requirements gate,
    before the chore run rather than during it: every pack count in the merged requirement is a
    **built-checkout** count — cli 40 here against 22 fresh, core 167 against 101, shared 52 against
    28 — because `packages/*` carry no package-level ignore file and npm never reads the repository
    root, so gitignored `dist/` and `.turbo/` ship. AC-19 therefore asserts over the declared `files`
    allow-list and never over a count, a size, or the absence of build output, which is the assertion
    Q-0096's E-1 retired one ticket earlier for the identical reason. **The inherited "22 files" is a
    trap rather than a stale figure**: a fresh clone packs 22 today from a *different* set of files,
    so re-measuring in a clean checkout appears to confirm the superseded number.
    **The review loop's findings were good and none of them was the defect that stopped the run** —
    an argument for `integrate` rather than against the panel. Round 1: the AC-18 fixture executed
    the shim directly, bypassing the pnpm resolution it claimed to prove, and the packer-agreement
    test checked one package of three while its comment claimed all three. Round 2 is the sharpest:
    the non-POSIX branch of the mode assertion executed an assertion that necessarily passes and
    returned, so Vitest reported **passed** and AC-16's required explanation never appeared — *"a
    check that skips its subject must not report success"* (2026-08-25) reproduced inside the
    criterion drafted to forbid it, and invisible on macOS.
    **Registered and not fixed: the build is POSIX-only.** Round 3's major was `chmod +x`; advanced
    past deliberately, because `rm -rf dist` is the same defect in the same line and went unflagged,
    all three emitting packages carry it, and **Q-0097 introduced it** — so the fix is a
    cross-platform helper across three build scripts, which is that ticket's surface and a decision
    rather than a repair. All seven CI jobs are `ubuntu-latest` and `harness.yaml`'s own commands are
    POSIX shell chains; this repository has never claimed Windows support, and the ticket for it is
    owed only if it ever does.
    **M2's done-when was corrected in the same change**, and `harness/product-context.md` with it —
    the first time a *harness context file* was fixed for a false installation claim, which matters
    because it is fed to every product-manager step at run time. Registry-resolved `npx quorum` is
    **refused** rather than deferred while every package is `"private": true`; it stays Q-0029's in
    M6.
  - Q-0095 The mock end-to-end suite runs against the CLI binary. **M2's done-when**, 780 lines and
    **158 assertion sites of which 76 transfer**, and the child that unblocks the cutover. It is
    `split` and not binary-only —
    Q-0054's audit found fifteen `await import()` calls a static scan cannot see — so only its binary
    half transfers. Two of its assertions were re-aimed on 2026-09-01 and **one had been passing for
    the wrong reason**, so the translated forms must be shown red against a deliberately broken
    binary rather than observed green.
  - Q-0101 The mock end-to-end's gate, rollback and register half. *(Split from Q-0095 2026-09-04,
    `draft`.)* Ten criteria, transcribed into the folder in full from §3.2 of Q-0095's merged
    requirement rather than referenced. **Runs after Q-0095**, which lands the spawn harness its
    scenarios ride on. It takes the exhaustion gate, `undecided` and exit 3, the retry grant, the
    failed parallel sibling with its **red witness**, both rollback paths, base-sync reporting,
    `q0033-surface.js` S3.2/S3.3, the re-homed template model pin and the register completion.
    **Its folder was created at Q-0095's gate rather than at its own start**, and the reason is a
    trap worth recording: `spike-parity.test.ts:1617` and `:1694` assert
    `REGISTER['q0033-surface.js'].binaryHalf` `.toMatch(/Q-0095/)`, so a Q-0095 that closed carrying
    only the chain half would leave two clauses naming a **closed** ticket as owing work — the
    contradiction Q-0091's E-2 created `binaryCarriedBy` to make impossible, running the other way.
    Q-0095's AC-10 re-aims them at this id, which an implement step cannot allocate.
    **The cutover is its successor and still has no ticket** — deleting `spike/`, retiring its CI job
    and retiring `harness/port-charter.md`, which is Q-0010 §5's follow-up. GO-4 says allocate it at
    this ticket's close rather than remember it.
  - Q-0102 The git-identity sweep is red under load, and CI runs it. *(Opened 2026-09-04 at
    Q-0095's merge, `draft`, p1.)* `pnpm sweep:git-identity` exits 1 on `main`, in phase
    `workspace suite`, and `ci.yml` runs it as **two required jobs** — so every push is red or lucky.
    **It is a flake, not a break**: two consecutive runs at one commit gave 28 failures across 10
    files and then 6 across 4, and the survivors — `worktree-lifecycle.test.ts` and
    `undecided.test.ts` — pass **29/29 in isolation** straight afterwards, leaving no stray worktree.
    **Not Q-0095's code**: the sweep is red at the commit before that merge too.
    **The obvious fix is refuted before the ticket starts.** Both files already build a repository
    per case under `os.tmpdir()` and compute their worktree path against that root, so "isolate
    them" is already true. What is unmeasured is *when* it started — the sweep was green by hand
    after Q-0099's merge, and everything since is `docs/` and `backlog/` — and the mechanism. The
    leading hypothesis is contention from Q-0095's new process-spawning suite, but the red predates
    it, so the hypothesis is incomplete and GO-1 requires a failure *rate* at a fixed commit rather
    than a fix demonstrated once.
    **p1 because a flaky oracle is worse than a missing one.** Q-0079 built the sweep as the oracle
    for *"A test's verdict is a property of the commit, not of the checkout or the account"*
    (2026-08-30), with the tripwire explicitly not covering the checkout-shaped instances. A verdict
    that changes without the tree changing trains the reader to re-run until green — and **it is an
    instance of its own subject**, load being a third term beside the checkout and the account that
    nobody had measured. GO-2 refuses any fix that makes it green by weakening what it runs.
  **Inherits three obligations**, and the first is now recorded in the ticket itself: (1) Q-0037's OQ-2, ruled 2026-09-01: an occurrence's usage is not a
  roll-up row and is not rendered as one — four measures separately, nulls as `n/a`, no
  `unpriced_steps` on a single step, summing left to the roll-up. (2) Q-0054's routing: the eight
  `spike/test/` files that spawn `spike/bin/harness.js`, 50% of the suite by line, transfer here
  rather than at Q-0054 — `spike-parity.test.ts` is the file-by-file record and is deleted at the
  cutover with `spike/test/**`. (3) Q-0062's successor, `harness worktrees` (list, prune stale
  registrations, remove what is contained), written out in full in that ticket's merged requirement;
  until it exists, a run cleans up only after itself and nothing removes what earlier runs left.
- ~~Q-0011 Run history on disk~~ — pulled forward into M1 and closed there.
- Q-0012 `qa-final.yaml` and `deploy.yaml` (human-locked gate) — completes the seven SDLC flows (eight shipped files, counting `chore`).
- Q-0034 Reconcile the unmerged green branches (Q-0006, Q-0011) — land both, re-derive the empty-diff cause.
- Q-0035 The empty-range diagnostic reports evidence, not a story. *(`reviewed` and
  `main:contained` 2026-08-25.)*
- Q-0036 What `green` means, and where the code is — the board's git-derived containment annotation.
- Q-0037 Run-history review remainder — one major and eight nits. *(`reviewed` and
  `main:contained` 2026-09-01.)*
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
  **What shipped, in one chore run of three implement rounds and three reviews, no exhaustion
  gate.** The timer is gone from `spike/src/engine.js` and `packages/core/src/engine/routing.ts`
  together, the fixture at `q0011-run-history.js` owns a bounded ten-second handle of its own — the
  ceiling being what stops the fix becoming worse than the defect, since `spike/test/run.js` has no
  per-scenario timeout — and the AC-4h pin is **inverted rather than deleted**, so a returning timer
  fails a check instead of passing an absent one. The `routing.ts` register went from three
  authority lines to two and the cross-file arithmetic 19 → 18.
  **Round 1 introduced a regression while fixing a nit, and round 2's reviewer caught it**, which is
  the loop earning its cost. Rewriting the skipped-check notice dropped the word *recognised*, and
  `validateArtifact` returns `unrecognised-annotation` for **any** value that is not
  `run-manifest-v1` — so the new sentence was factually false for a schema carrying
  `x-quorum-contract: unknown-v1`, a case the wording it replaced had covered. Restored, and still
  literally compliant with `runs-cli.contract.md:47–48`, which the implementer may not edit.
  **Two errata, both written during the loop rather than at a gate, and both for findings no round
  could act on.** **E-1**: AC-12 step 2 asked for the freeze SHA to be re-recorded *"in that
  commit"*, which requires a commit to contain its own hash. Measured against the only precedent —
  Q-0062's `9721d78` has parent `a6e529a` and records `a6e529a`, two commits — and **charter §3
  carried the same impossible wording**, so the criterion inherited the defect rather than
  introducing it. Both are corrected; the ninth appearance of a loop handed work no step in it can
  perform, and the second where the requirement's own text is what hands it over. **E-2**: round 2's
  report dropped AC-3/AC-4/AC-5/AC-8's evidence, and the cause is `chore.yaml` — `implement` writes
  one flat `dev/implement-report.md` that the engine rewrites every traversal, which is **exactly
  the defect Q-0057 closed for reviews and left open for reports**. Round 1's 471-line report was
  recoverable only because an unrelated commit's `git add -A` happened to catch it, which is
  recorded as luck rather than as design; all three rounds now sit under `dev/rounds/`. The
  successor — making the implement report round-scoped — is owed and not opened here.
  **AC-11 moved a classification rather than arithmetic**, and it is the first re-derivation to move
  the transfer share **up**: `q0011-runs-cli.js` was binary-only on the true statement that it
  imported nothing from `spike/src`, which stopped being true when AC-9 gave the spike a
  `validateArtifact` the file asserts over directly. 49% → **50%**, corrected here and in
  `04-architecture.md`, and the requirement predicted the move by name at the gate.
  **$53.13 across two runs** — $8.59 requirements, $44.54 chore — and 73.2M tokens across four
  unpriced codex steps. **The first run to exercise Q-0062's worktree cleanup for real**:
  `removed-worktrees=2 kept=0`, which Q-0062's own run could not do because `runFlow` loads the
  engine at run start. Verified in both environment rows per Q-0072's closing finding — `integrate`
  ran install and both suites to exit 0 in a worktree with neither `.harness/worktrees` nor
  `.quorum/runs`, then forced on `main` after the merge: spike 18/18, workspace 7/7 tasks 0 cached
  and 1378 passed, lint and typecheck 14/14 tasks 0 cached, `harness lint` 6/6, and the
  git-identity sweep green. The freeze-SHA half was **demonstrated red before green** — it named
  `spike/src/contracts.js` and `spike/src/engine.js` at the merge and is clear at the re-record —
  with the guard's own 43 checks passing.
  **OQ-3 is answered by measurement: `validateFile` stays, in both trees and unchanged.** Its
  non-CLI callers are `q0034-review-fixes.js:74` and a new convergence test at
  `q0011-runs-cli.js:210` asserting that it and `validateArtifact` agree structurally over every
  combination in which the two are comparable, and `contracts.test.ts`'s AC-4 pins its signature and
  per-call schema read in `core`. So the single-read entry point was added beside it rather than in
  place of it, and Q-0010 inherits both with a test saying what each is for.
  **OQ-2 is answered: the per-step usage shape binds `packages/cli`.** Ruled at the close on
  2026-09-01, so Q-0010 inherits a decision rather than copying an accident. What binds is the
  distinction, not the punctuation: **an occurrence's usage is not a roll-up row and is not rendered
  as one.** `formatOccurrenceUsage` prints the four measures separately — `input_tokens`,
  `output_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, each through `formatTokens`,
  so a null reads `n/a` and never `0` — and prints no `unpriced_steps`, which over a single step can
  only be 0 or 1 and says nothing the status does not. Summing stays the roll-up's business, in
  `formatVendorSummary`, where `vendorTokenTotal` adds input and output and the cache pair remains
  the breakdown it is rather than a summand. A `packages/cli` that re-collapses the two is
  reintroducing nit 5, and the cache-double-count guard that has been re-aimed twice —
  `q0034-review-fixes.js` B2 — is the test that would catch it. Carried into Q-0010's bullet below,
  because an obligation recorded only in a closed ticket's entry is one that quietly expires.
- Q-0085 An entry's date is the date it takes its place in the index. *(`reviewed` 2026-09-01,
  implemented by hand the day it was opened; the board reads `main:indeterminate(no branch)`,
  which is right — a hand-run ticket names a branch nothing created.)* Split from Q-0037's OQ-1 at
  its requirements gate, with that run's Appendix A transcribed into the body in full rather than
  referenced. `docs/DECISIONS.md` is called
  *"append-only, newest last"* in three places and is also grouped by date, and the two cannot both
  hold for an entry decided on one date and landed after entries decided later. The ruling is owed
  in one direction or the other — the landing date wins and the body carries the deciding date, or
  the prose is amended and `docs.test.ts`'s date assertion deleted, trading the only mechanical
  append-only check for a sentence. The first is recommended because it is what shipped. **The
  whole deliverable is a decision entry**, so it is the human's work directly and there is no flow
  to route it through — which is the point of splitting it out rather than carrying it as a
  criterion of a chore ticket whose implement step could then never satisfy it.
  **Ruled reading (a): the landing date.** See *"An entry's date is the date it takes its place in
  the index"* (2026-09-01). It ratifies what shipped rather than changing anything — no code moved,
  `docs.test.ts` is untouched, and the measurement it rests on was re-run before it was written: 74
  index rows, 74 files, index order identical to numeric order, dates non-decreasing. The
  alternative was rejected on what it costs rather than on taste: amending the *"newest last"* prose
  means deleting the only mechanical check that the index is append-only, to protect information an
  entry's body can carry losslessly. `harness/rules.md` and its derived `.claude/rules/` copy each
  gained one sentence citing the entry by title and date, so the rule an author meets is the rule a
  test enforces. **Q-0011's round-2 nit 4, raised 2026-08-24, closes with it** — a week and a half
  from a review nit to a written rule, most of it spent because the finding described a flat
  `DECISIONS.md` that stopped existing on 2026-08-28 and nobody re-measured it until Q-0037's
  requirements run did.
- Q-0086 The revise loop names every artifact it rewrites by run and iteration. *(`reviewed`
  2026-09-01, implemented by hand.)* Opened from Q-0037's erratum E-2 and closed the same session
  rather than queued. `chore.yaml`'s `implement` step wrote one flat `dev/implement-report.md` that
  the engine rewrites on **every traversal of the revise loop**, so a revision round's report
  replaced the previous round's and the measured evidence a criterion had been verified with stopped
  existing while the run reported green. **It is Q-0057's defect on the other side of the same
  loop**: that ticket scoped the review artifact — write path and input glob together — and left the
  report flat beside it, and its own recorded reasoning, that the engine writes an agent's document
  verbatim so the path is the only place identity can be stamped, applies to the report unchanged.
  `implement` now writes `dev/chore/run-{run}/implement-iter-{iter}.md` and `review` reads
  `dev/chore/run-{run}/implement-iter-*.md`, in both shipped copies — `lint.test.ts`'s existing
  parity assertion would have failed had only one moved. **No engine change**: both variables
  already interpolate on any step, `writeFile` creates nested directories, and `readFiles` globs the
  basename inside `path.dirname(pattern)`, so the nested path already resolved.
  **The rule is the pair of variables and not either one**, and the guard in
  `packages/shared/src/flow.test.ts` says so in clauses that were each shown red on their own before
  the change was trusted — a flat write path, `{run}` dropped from the write path, and `{run}`
  dropped from the reader glob all fail separately, which is Q-0071's point that showing a guard has
  a subject proves it fires and not that each clause does. It asserts over the **shipped file**
  rather than a fixture, and additionally refuses the flat spellings anywhere in it, because a
  second `writes:` naming one would satisfy every positive assertion. Q-0072's input guard refused
  the new read site until it was registered with the reason its path is a literal — the fourth
  ticket to earn a registration on the way in, and the machinery working as designed.
  **Not run through the flows, with a reason rather than a preference**: the change is to
  `chore.yaml` itself and `runFlow` loads the flow at run start, so a chore run fixing this flow
  could not benefit from its own fix — Q-0057's position exactly — and an implement step editing the
  file that governs its own output path is a hazard, not a demonstration.
  **Reported here and fixed the same day by Q-0087**, whose measurement corrected this paragraph:
  it said the `integrate` artifacts were the same class *at a lower frequency* because `integrate`
  runs once per run. That is true of `chore.yaml` alone. `development.yaml`'s `integrate` and
  `qa-red.yaml`'s `prove-red` sit **inside** their own loops — `max_iterations` 3 and 2 — so each
  traversal overwrote the last, which is the acute defect rather than the mild one.
- Q-0087 Every artifact a run can rewrite is named by what makes it unique. *(`reviewed`
  2026-09-01, implemented by hand.)* Opened because re-measuring Q-0086's own *"reported and not
  fixed"* paragraph disproved it. That paragraph called the `integrate` artifacts the same class
  *at a lower frequency*, on the reasoning that `integrate` runs once per run. **True of
  `chore.yaml` alone**: `development.yaml`'s `integrate` carries `max_iterations: 3` and
  `qa-red.yaml`'s `prove-red` carries `max_iterations: 2`, both **inside** their own loops, so every
  traversal overwrote the previous one's integration notes and test report — the acute defect, in
  the two flows whose entire purpose is to show what failed on attempt 1 against attempt 2.
  Convergence to green is what `development.yaml` exists to demonstrate and it was keeping only the
  last attempt.
  **The rule was generalised rather than a third instance patched**: a write path carries `{run}`,
  and one a bounded loop can re-enter within a run additionally carries `{iter}`. Loop-reachability
  is derived from each flow's own `on_fail` edges, so `chore.yaml`'s `integrate` being named by the
  run alone falls out of the rule rather than standing as an exception to it, and a flow that gains
  a step or an edge is covered without anyone remembering. `qa/red-report.md`'s **two** readers both
  became globs; the other four artifacts are read by no flow.
  **Fourteen write paths were left flat behind a register with a reason each**, so the remaining
  work was visible rather than quietly closed. **Q-0088 closed all fourteen the same day and deleted
  the register**, because the fourteen reasons turned out to be one property.
  **The guard found two defects in itself before it found any in the flows.** Its first run reported
  an `integrate` step in `solutioning.yaml` the draft register had not accounted for; registering it
  then failed differently, because the check read only `writes:` while `merge-contracts` uses the
  singular `write:` — the one shipped integrate step that does. It now mirrors the engine's
  `writesOf` exactly. A check blind to half its subject, caught by the register beside it rather
  than by a reviewer.
  **One trap was walked past deliberately and is now pinned**: both engines choose an `integrate`
  step's content by whether its write path contains the substring `report` — test output if it does,
  integration notes if it does not — tested against the pre-interpolation template. Every new path
  was checked against it before being chosen, and renaming `red-integration` to
  `red-integration-report` now turns the suite red. Five clauses were each demonstrated red on their
  own. No engine change in either tree and `spike/src` untouched, so no freeze re-record is owed.
- Q-0088 The remaining artifacts are scoped, and a flat path must be a pointer. *(`reviewed`
  2026-09-01, implemented by hand.)* Completes Q-0087.
  **The finding that decided the shape: `{run}` interpolates to the id of the run doing the
  reading.** So an artifact its own flow reads can be globbed inside `run-{run}/`, and one a
  **later** flow reads cannot be scoped at all — by the time `development.yaml` looks for
  `solution/tasks.yaml`, `{run}` has moved on, and a `run-*` glob both sorts `run-10` before `run-2`
  and returns every run's copy where a `fan_out: from:` needs exactly one file. That looked like
  four artifacts which simply could not be fixed. **The first reader map was wrong**: it walked
  top-level and `parallel` steps and missed the fan-out's `step:` template, which is where
  `review/verdict.md` and `solution/solution.md` are read. Redoing it is what turned a "cannot" list
  into a solved problem.
  **The answer was already in the repository.** `review.yaml`'s `verdict` step writes a per-round
  copy beside a flat name its consumer reads as a literal, and an agent step writes its document to
  **every** `writesOf` target (`steps.ts:303`). So the four cross-flow artifacts became **pointers**
  rather than exceptions, and the rule gained a second sentence instead of a register: a path
  carrying no scoping variable must be one whose step also writes a scoped copy in the same breath.
  The four are `requirements/merged.md`, `solution/solution.md`, `solution/tasks.yaml` and
  `review/verdict.md`, pinned by identity so a fifth is a visible act; every other write path in all
  six flows is scoped, and `FLAT_BY_DESIGN` is gone.
  **Proven end to end with the mock adapter rather than from lint.** A throwaway project initialised
  from the changed templates, the requirements flow run once per shape over the same two-iteration
  path: **3 files under the old flow against 5 under the new**, the difference being the iteration
  the old flow destroyed, plus the pointer. A later run then wrote `run-3/` beside an untouched
  `run-1/`. Also `--dry` on real tickets — `requirements` on Q-0039, and `development` on Q-0011,
  which expands two tasks in one wave and therefore resolves the `tasks.yaml` pointer through
  `fan_out: from:`. Four clauses of the new guard demonstrated red on their own.
  **Three `smoke.js` assertions were re-aimed, and one had already started passing for the wrong
  reason.** The mock end-to-end suite runs the shipped flows, so moving the candidates broke it —
  the suite working. Two positive assertions now name `requirements/run-1/` and both go red when the
  scoping is reverted. The third, *"failed parallel sibling wrote nothing"*, is a **negative** check
  that passed the moment the path moved, because nothing was at the old address: it proved the
  writer had failed only by accident. *"A check that skips its subject must not report success"*
  (2026-08-25), arriving through a rename. It searches `requirements/` recursively now, and was
  shown to fire by aiming it at a file that does exist there. `spike-parity.test.ts`'s totals were
  **re-derived rather than adjusted** — 2279 → 2287, 4968 → 4976, one entangled file — with the
  transfer share 50% before and after, stated rather than skipped.
  **Q-0087's `qa/red/run-{run}/` was corrected to `qa/run-{run}/`** in the same change: the
  flow-name level exists only where a directory has more than one writing flow — `dev/` and
  `review/` — and no real run had used the older spelling.
  **§5's snippets were fixed in the same session, by generation rather than transcription.**
  §5.1–§5.5 are now the shipped files byte for byte, read out of `harness/flows/` rather than
  retyped, and `docs.test.ts` fails if any differs by a character. The drift they carried is the
  argument for the method: they showed flat write paths tickets had moved **and** named a
  `harness: architecture.md` input the shipped requirements flow never had, so one of the two errors
  long predates this session. A transcription of code drifts *silently*, because it goes on looking
  like the thing it describes — so the fix is a check, not a correction. §5.6 and §5.7 stay
  **sketches** and are registered as such: `qa-final.yaml` and `deploy.yaml` are Q-0012's and do not
  exist, so there is nothing to check them against, and inventing a file to satisfy a test is the
  defect this repository keeps finding. The register closes both ways — a new §5 block fails until
  classified, and a sketch whose flow acquires a file fails until it moves. Q-0056 still owns §5.6's
  separate lint problem.
  **The engine's `verdict_file` was the one artifact this rule could not reach**, being invisible to
  a flow-derived guard; **Q-0089 closed it the same session.** §3.3's folder tree is rewritten to the
  real layout.
- Q-0089 The verdict file is scoped by default, because no flow author writes its path.
  *(`reviewed` 2026-09-01, implemented by hand.)* The one artifact Q-0087's and Q-0088's rule could
  not reach, and **the only one of the four tickets that changes `spike/src`**.
  **Why the flow-level rule could not see it.** `output: { verdict: approve|revise }` declares a
  vocabulary; the engine invents the filename. So there is no path in a flow file to derive a check
  from — and the artifact whose path nobody writes is precisely the one where forgetting to scope it
  is invisible, because there is no line for a reviewer to notice missing. It carried
  `{verdict, findings, summary}` at one path per step per ticket, rewritten every traversal and every
  run, so **on a loop that turned, the record of why it turned was destroyed by the round that fixed
  it**. Measured rather than argued: head-of-product's iteration 1 writes `needs-input` with one
  finding and iteration 2 writes `ready` with none, and only the second used to survive.
  **The fix is the default, not a `verdict_file:` per flow**, which would have avoided touching
  `spike/src` and was rejected on the ground that a rule holding only where somebody remembered the
  key is not a rule. `{iter}` is **unconditional** rather than loop-aware, because the engine cannot
  see whether a backward edge reaches a step — the analysis Q-0087's guard performs over a flow file
  is not available at the point of the write — a deliberate asymmetry, stated rather than left to be
  found. Pinned as three properties in both trees, each shown red alone: scoped to a run, scoped to a
  traversal, and still naming the step, since two steps of one flow declaring a verdict collide
  otherwise.
  **The pin was first written on the wrong side of the dependency direction**, and Q-0072's input
  guard is what said so — putting both trees' checks in `packages/shared` made it read a
  `packages/core` source, which `04-architecture.md` forbids; the guard refused it as an undeclared
  read, the same finding arriving through a different door. **Verified end to end**: occurrence
  `004-head-of-product` — iteration 2 — has iteration 1's verdict in its prompt, so the new glob
  feeds the retry. The `.raw.txt` sibling needed nothing, having a timestamp already; checked rather
  than assumed. **Charter §3 walked a second time**, with `freeze-sha` re-recorded in a follow-up
  commit per Q-0037's erratum E-1.
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
  parses**, since changing it gives every *green* `integrate` run's integration notes all of
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
