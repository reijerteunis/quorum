# Q-0095 — The mock end-to-end suite runs against the CLI binary

*Merged requirement, run 1, iteration 1, 2026-09-04. Verdict: **needs-input** — on size, not on content.*

---

## Verdict, and where the seam is

Both candidates describe work that should be done, and the claude candidate describes it well
enough that an implementer could start tomorrow. **It is too big**, and that is the one thing
neither candidate is positioned to catch about itself.

Measured rather than felt:

- The deliverable is **76 assertion sites across eleven distinct scenarios** (Appendix A), plus
  `q0033-surface.js` S3.2/S3.3, plus a two-row register move, plus a mutation procedure.
- It additionally requires **an execution mechanism that does not exist in this workspace**: an
  isolated-copy build with a spawned process per invocation. Every one of the six command children
  drove its command in process through `packages/cli/test/invoke.ts`. Nothing here can (§0.5).
- `harness/flows/chore.yaml:46` bounds the revise loop at `max_iterations: 2`, so an implement step
  gets **three rounds** before the exhaustion gate. Q-0050 needed six. Q-0062 needed five, through
  two `retry` answers. Q-0091, Q-0092, Q-0094 and Q-0097 each needed four.
- claude offers **15 criteria plus three gate obligations**; codex offers **21**. The ceiling is
  fifteen and the guidance is about ten.

A ticket whose risky half (does the spawn harness work at all? how long does it take?) and whose
mechanical half (translate nine failure scenarios) share one bounded loop spends the mechanical
half's rounds while the risky half is still moving. That is the recorded failure mode of Q-0050 —
*"the module is sound and its scaffolding took six rounds to become trustworthy"* — and this
ticket is **entirely** scaffolding.

**The seam is between the mechanism plus the green chain, and the failure, gate and rollback
paths.** It is not a seam by command, which the parent correctly refused: it is a seam by
*scenario independence*. `smoke.js`'s chain is one long stateful sequence over one fixture and must
not be split; everything after it is a set of short independent scenarios, each with its own
fixture repository, none of which depends on the chain's state.

| | ticket | what it carries | why it is first |
| --- | --- | --- | --- |
| 1 | **Q-0095** (re-scoped) | the isolated-copy spawn harness, and one ticket walked `init` → `stage: green`, with the three convergent behaviours, worktree safety, and the four commands that ride the chain | it is where every unknown lives, and it is literally what M2's done-when says |
| 2 | **the successor** (`Q-0101`, the next id the allocator answers) | the exhaustion gate, `undecided` and exit 3, the `retry` grant, the failed parallel sibling with its red witness, both rollback paths, base-sync reporting, `q0033-surface.js` S3.2/S3.3, and the register completion | mechanical once the harness exists; every scenario is independent |

**Ground rule 5 is satisfied in both halves, not deferred to the second.** `spike-parity.test.ts`
already supports a row naming more than one counterpart — Q-0092 extended one to two files *"because
the assertion claims two things"* — so Q-0095 sets `binaryCarriedBy` to its own suite with prose
saying which scenarios it carries and naming the successor for the rest, exactly the
`— Q-0093` / `— Q-0094` shape the register uses today. Neither half leaves the register asserting
something false, and the three standing clauses partition without residue:

| clause | asserts today | whose |
| --- | --- | --- |
| `:1714` `REGISTER['smoke.js'].binaryCarriedBy` `.toBeUndefined()` | the last binary half is owed | **Q-0095's to invert** — it sits inside test (p), whose subject is `adapters`, and `adapters` rides the chain |
| `:1617`, `:1694` `REGISTER['q0033-surface.js'].binaryHalf` `.toMatch(/Q-0095/)` | Q-0095 owes the review-flow half | **re-aimed by Q-0095 to the successor's id, inverted by the successor** |

That second row is why finding 2 below is a blocker: after Q-0095 closes, a clause reading
`/Q-0095/` is the precise contradiction `binaryCarriedBy` was ruled into existence to prevent
(Q-0091 erratum E-2), and `backlog/` is not a surface an implement step may write.

**If the human overrules the split**, this document is still complete and usable as one ticket: §3.1
and §3.2 together are the twenty criteria, and the answer is `advance` rather than a second
requirements run. A `retry` on an unchanged tree cannot rule its own blocker — observed on Q-0090
and again on Q-0096 in the same week.

---

## 0. What was measured, and what moved

The plan's standing instruction for every child of Q-0010 is **read
`packages/core/src/spike-parity.test.ts` first and do not trust the ticket body's coverage figure**.
Five consecutive children measured one wrong at their gates. Both candidates were re-verified
against the tree at HEAD; the claude candidate's measurements survive, with two corrections.

### 0.1 The ticket body's two figures are wrong, in both recorded ways

| claim | measured 2026-09-04 | verdict |
| --- | --- | --- |
| `smoke.js` is **781 lines** | **780** (`wc -l`) | the systematic **+1 per file**, now the seventh instance in this cut |
| `smoke.js` has **151 assertions** | **158** `assert(` sites | expired; `151` was true at `dad6254`, when the file was 739 lines |
| *"151 assertions"* transfers | **76 of 158** | a **scope** error, the larger kind |

`06-development-plan.md` contradicts itself inside one document: Q-0010's bullet says
*"`smoke.js`'s **780** among them"*, Q-0095's bullet says **781**. One was re-derived from the
register (Q-0090), one was transcribed. GO-3 routes the correction to the human.

### 0.2 Four buckets, not two

The body says the file is `split` and *"only the binary half transfers"* — true, and the split is
not two-way. All 158 sites classified in Appendix A:

| bucket | sites | who carries it |
| --- | --- | --- |
| **binary half** | **76** | **nobody. These two tickets.** |
| library half — the fifteen `await import('../src/…')` blocks, verified at `:167`–`:736` | 70 | the eleven `packages/core` suites the register's `carriedBy` already names |
| repository-consistency — the template model pin (`:216`) and the `harness/architecture.md` role table (`:462`–`:483`) | 8 | see §0.4 |
| runner discovery (`:595`–`:603`) | 4 | `packages/core/src/test-discovery.test.ts` |

**Anyone sizing this from "151 assertions" is sizing roughly twice the work; anyone sizing it from
76 alone is under-sizing it,** because §0.3 adds a second file and §0.5 adds a mechanism.

### 0.3 The register says two files are owed, not one

- **`smoke.js`** — the only row carrying a `binaryHalf` with no `binaryCarriedBy`. Its prose reads
  *"…which is M2's '30-check smoke test' and is Q-0010's to carry"*; the standing clause is
  `:1714`.
- **`q0033-surface.js`** — its `binaryHalf` ends, verbatim: *"What remains is S3.2/S3.3's two-path
  end-to-end through the shipped review flow — Q-0095"*, with two clauses asserting it (`:1617`,
  `:1694`). Five counterparts already, from Q-0091, Q-0093, Q-0094 and Q-0099; this is the sixth
  and last.

**The ticket body mentions `q0033-surface.js` nowhere.** Twelve lines, six assertion sites, two
executions (`spike/test/q0033-surface.js:170`–`:181`, verified).

### 0.4 Seven assertions are homeless, not eight — and one has a cheap home

Both candidates would have left all eight to a successor. Measured, they part company:

- **`:216` — the template model pin has a home and belongs in this work.** It reads
  `spike/templates/harness/{flows,roles}` and asserts no shipped template matches
  `/^\s*model:\s*gpt-/m`. Since Q-0093, `packages/cli/templates/harness/` is that corpus, mirrored
  byte-identically with a bidirectional parity guard, and `packages/cli/src/templates.test.ts`
  contains **no** `model` or `gpt` assertion at all. `capabilities.source.test.ts:65` guards a
  different subject — pinned aliases in adapter capability source, not shipped assets. So this is
  one criterion in `templates.test.ts`, and the successor takes it.
- **`:462`–`:483` — the role table is genuinely homeless.** It compares
  `harness/architecture.md`'s table against `harness/roles/developer-*.md` frontmatter, prose and
  vendor spread: *this repository's own harness*, not a shipped asset.
  `turbo-inputs.test.ts:301` states the position outright — `'harness/architecture.md': 'role.test.ts
  asserts this string appears in role.ts's own doc comment; no suite opens the file'` — and
  `packages/shared/src/role.ts:30` says the same from the other end: `smoke.js` *"is the only thing
  that checks it at all"*. Q-0011 opened this check because `developer-tooling.md` existed on disk
  while being invisible to the architect, and every Q-0033 task defaulted to backend.

`:459`'s `if (fs.existsSync(arch))` is additionally the shape *"a check that skips its subject must
not report success"* (2026-08-25) forbids: in the spike the file is always there, so the guard has
never fired, and a translation carried into a fixture-relative location would skip silently and stay
green. **The cutover deletes `spike/test/**` wholesale**, so on that day seven checks stop existing
and nothing reports it. Routed to **GO-2**, not absorbed.

### 0.5 The decisive finding: the siblings' execution model cannot carry this suite

Verified verbatim at `packages/core/src/adapters/mock.ts:16`–`:22`:

> The call counter is MODULE-SCOPED and no reset is exported. In the spike every run is a fresh
> process, so the counter is per-run; under Vitest a test file shares this module for its lifetime.
> […] **Adding a reset export would be a behaviour change (charter §2)**, and Q-0054 inherits this
> constraint.

And the key is `role:task` or `role:kind` (`mock.ts:94`) — scoped to **neither** the ticket, the run
nor the project. So two scenarios in one Vitest process that both traverse the requirements flow
share the `head-of-product` counter, and the second finds it already advanced.

The spine depends on the mock's *natural* first-call-fails-then-passes behaviour at three
load-bearing places, none of which a forcing switch reproduces:

| assertion | needs |
| --- | --- |
| backward edge persisted, `head-of-product: 1` (`:59`) | the counter at 0 for that key, then exactly one loop |
| `iteration 1/2 → goto architect` exactly once (`:65`) | the same, for `solutioning.review` |
| `MOCK_DEV_FLAKY=1` → fail once → scoped retry → green (`:94`) | `n === 1` for that task key (`mock.ts:116`) |

`MOCK_ALWAYS_PASS` / `MOCK_ALWAYS_FAIL` force the verdict and therefore **destroy the loop being
asserted**, which is why `run.test.ts` stubs one of the two 28 times.

**The third escape is closed too, and should be recorded so a reviewer does not propose it.**
`mock.ts` offers *"or with a role name of its own"* — but the spine's whole claim is that the
**shipped** flows converge, so renaming the roles in the fixture would assert convergence of flows
no adopter receives.

**Therefore the translated spine spawns a real process per invocation.** Not a preference: the only
route that reproduces the semantics without the charter §2 change `mock.ts` forbids by name.

### 0.6 The AC-15(c) collision is ruled here, and no erratum is owed

Q-0098 AC-15(c) is cited in five places (`board.test.ts:25`, `gate.ts:21`, `init.test.ts:16`,
`run.test.ts:17`, `runs.test.ts:14`) as naming `build.test.ts` the one file that may spawn the emit.
`init.test.ts:16` even anticipates this ticket: *"…and the end-to-end suite is Q-0095's."*

Read at source rather than through the summaries — `build.test.ts:1289`–`:1299`:

> Every assertion below spawns or packs the REAL `packages/cli/dist`, and this file deletes that
> directory twice […] a separate file spawning the same path would intermittently meet an emit that
> had just been removed […] Q-0098's merged requirement […] names exactly **two safe shapes** in
> AC-15(c) — **assert inside an isolated copy**, or put the real-workspace assertions here.

The hazard is one-directional and specific to `packages/cli/dist` + `removeEmit()`. **A suite that
never touches `packages/cli/dist` is outside it**, and the isolated copy is AC-15(c)'s own first
named safe shape. `packages/cli/src/build-fixture.test.ts` is the standing precedent — a second file
that builds, in a throwaway workspace, because mutating this checkout would be *"a test with a side
effect on the tree it is judging"*.

**Consequence: no erratum, no decision entry, and no amendment to a landed criterion is owed.** The
claude candidate declared this its one blocker (its OQ-5) and it dissolves on reading the source:
the four citations stay **literally true**, because they say `build.test.ts` may spawn *the emit*
and the new suite spawns a copy. A one-line clarification in each is a nit, recorded as such below.
Stating this explicitly matters: the alternative reading would hand the chore loop a blocker no step
on it may clear, which this cut has now priced eleven times.

### 0.7 Two claude claims corrected

- **`run.test.ts` does drive the `review` flow**, at `:528` and `:117` — not *"requirements is the
  only flow it ever runs"*. The substance survives: `:528` is a **stage-mismatch refusal** (`draft`
  against `consumes: green`) that never traverses a step, so no flow other than `requirements` is
  ever *traversed* in process, and S3.2/S3.3 is genuinely uncovered. But the sentence as written is
  false and would have entered the register.
- **The turbo-inputs row is over-cautious.** `packages/cli/turbo.json` already declares
  `../../turbo.json`, `../../pnpm-workspace.yaml`, `../../packages/*/src/**`,
  `../../harness/flows/*.yaml` and `../../.gitignore` — most of what an isolated copy needs. What is
  owed is a check of whatever the new fixture reads *beyond* those, not a fresh declaration.

---

## 1. Problem

The **maintainer** cannot trust `quorum` the way they trust `harness`. Six command children have
each proven their own command in isolation, in process, with the mock forced to one answer. Nothing
has ever taken one ticket from `init` to `stage: green` through the built binary — six flows, two
convergent loops, a two-wave fan-out, a scoped retry, three worktrees created and given back, a
rollback, an exhaustion gate and an `undecided` exit — which is what `spike/test/smoke.js` does on
every spike run and what `06-development-plan.md` means by *"the mock end-to-end through the
binary"*.

Three things are stuck behind it. **M2's done-when is unmet.** **The cutover cannot happen** —
deleting `spike/`, retiring its CI job, retiring `harness/port-charter.md` — because the spike suite
is still the only place the chain is proven. And **CI carries two required suites** where one would
do, which every contributor pays for on every push.

The **contributor** has the sharper version: the spike suite is the artifact that tells them their
adapter or flow template did not break the product, and it is scheduled for deletion with no
successor.

## 2. User stories

- As the **maintainer**, I want one ticket walked from `quorum init` to `stage: green` through the
  built binary, so that a merge which breaks the chain between two commands turns `pnpm test` red
  rather than being found on the next real run.
- As the **maintainer**, I want the register to say the binary half is carried rather than owed, so
  that I can open the cutover ticket knowing what `spike/test/**` still holds that nothing else
  does.
- As the **contributor**, I want the regression suite that judges my adapter to live in the package
  I am changing and to keep working after `spike/` is deleted, so that it survives the cutover.
- As the **adopter**, I want the flows I get from `quorum init` to be the flows this suite proves,
  so that the first thing I run is the thing that was tested.

**Surface:** `packages/cli` and its test suites; `packages/core/src/spike-parity.test.ts` as the
register ground rule 5 binds. No production behaviour in `core`, `shared` or the CLI changes.
Nothing under `spike/` is written.

---

## 3. Acceptance criteria

> Every criterion is independently testable. Where one asserts an *absence* or a *rename*, it says
> what turns it red, because *"a check is not established by reading it"* (2026-08-29).

### 3.1 Q-0095 re-scoped — the spawn harness and the green chain

**AC-1 — Every binary invocation is a separate operating-system process, and the reason is pinned
where a later change meets it.**
The suite reaches the spine through neither `packages/cli/test/invoke.ts` nor a direct handler call.
Its header states the measured cause — the module-scoped counter at
`packages/core/src/adapters/mock.ts:16`–`:22` keyed `role:kind` at `:94`, and that a reset export is
a charter §2 behaviour change — and **cites** it rather than transcribing it (engineering rules).
*Test:* a source-level assertion in the suite's own file that it imports no symbol from
`../test/invoke.js`, with the header sentence required present. Shown red by adding the import.

**AC-2 — The suite spawns an artifact it built itself in an isolated copy, and never
`packages/cli/dist`.**
This is AC-15(c)'s first named safe shape and needs no amendment to it (§0.6). The suite reads and
executes only a temporary workspace it created, calls no `removeEmit`, and does not depend on
whether `packages/cli/dist` exists.
*Test:* the suite asserts the path it spawns is under `os.tmpdir()` and is not `binTarget()`; and a
full run with `packages/cli/dist` deleted passes.
*Note:* whether `isolate()` (`build.test.ts:427`), `buildIn()` (`:473`) and `runBuild()` (`:172`)
are extracted into `packages/cli/test/` or rebuilt locally in `build-fixture.test.ts`'s shape is the
implementer's call — R-2 rules the banner sentence a description, not a prohibition.

**AC-3 — The suite runs after `spike/` is deleted.**
It does not read, import, spawn or require any file under `spike/` at test runtime. Comparison with
the spike witness during implementation is expected; the committed verdict is independent of the
spike's continued presence.
*Test:* a source scan of the new file for `spike/` path literals and specifiers, plus a run with the
directory renamed. **This is the criterion the cutover actually turns on**, and neither the ticket
body nor the claude candidate states it.

**AC-4 — One ticket walks the whole chain, and each stage is read back from the file the binary
wrote.**
In one fixture repository, in order: `init` → `lint` → `ticket new` → `requirements` →
`solutioning` → `qa-red` → `development`, with `stage:` read from `ticket.md` after each as `draft`,
`requirements`, `solutioned`, `red`, `green`; a flow whose `consumes` does not match the ticket's
stage is refused; and the integration branch holds contracts, tests and both implementations at the
end (`smoke.js:24`, `:40`, `:41`, `:45`, `:48`, `:52`, `:56`–`:58`, `:64`–`:67`, `:81`, `:82`,
`:86`–`:88`, `:92`–`:98`).
*Test:* the spine. Shown red by reverting any one stage transition in a copy of the fixture flows.

**AC-5 — The three convergent behaviours that need a fresh counter, which are the proof AC-1 exists
for.**
(a) the requirements backward edge running head-of-product twice and persisting `head-of-product: 1`;
(b) solutioning printing `iteration 1/2 → goto architect` exactly once; (c) `MOCK_DEV_FLAKY=1`
producing `2 task(s) in 2 wave(s)`, then `tests exit 1, expected pass`, `scoped to failing tasks`
and `tests green`.
*Test:* each of the three, written as its own criterion rather than folded into AC-4 precisely
because this is what fails if somebody later moves the suite in process.

**AC-6 — Worktree safety and the user's working tree, end to end.**
The architect ran on `harness/T-0001/contracts` in its own worktree and the step said so as it cut
it; the finished run gave that worktree back, **directory and registration together**, while keeping
the branch; `git status --porcelain` shows nothing outside `backlog/` and `harness/`; no `src/`
appears in the fixture's working tree; and `commands.install` ran **in the integration worktree**
before the tests, evidenced by the marker written outside it (`smoke.js:72`–`:79`, `:99`,
`:104`–`:106`).
*Test:* all six. The worktree-return half goes red if `finish()` stops removing what it obtained
(Q-0062).

**AC-7 — The four commands that ride the chain rather than being its subject.**
`lint` exits 0 over the shipped flow directory the fixture was scaffolded with; `board` lists the
ticket; `adapters` with all three API-key variables set refuses **both** vendors before probing
either CLI; `validate` exits 0 on a conforming artifact and 1 on a non-conforming one, so a `qa-red`
script step can fail on it (`smoke.js:40`, `:123`, `:130`, `:131`, `:647`, `:648`).
*Note:* overlap with Q-0091's, Q-0093's and Q-0099's suites is **not** duplication. Those prove the
command; this proves it inside the chain, against state five earlier commands produced. The claim is
the sequence.

**AC-8 — The suite is honest about what it could not run.**
No block is guarded by a condition that lets it skip and still report success. Where a check cannot
run on this platform — the fixture's `sh -c` commands are POSIX, the registered class of Q-0098's
`chmod +x` — it **refuses or is asserted absent**, never silently passes. `smoke.js:459`'s
`if (fs.existsSync(arch))` is the shape to refuse; `:418`'s `assert(contractsSurvives, …)` is the
shape to copy, Q-0062 having made the subject an assertion.
*Test:* the suite's own source scan.

**AC-9 — Determinism: the verdict is a property of the commit.**
No assertion's outcome depends on a vendor subscription, the network, ambient git configuration, the
OS user, or a pre-existing gitignored directory. Every commit-creating call inside the fixture
supplies `-c user.email` and `-c user.name` explicitly, as `smoke.js` already does at six sites; any
fixture reading an `owner=` value passes `--owner` explicitly, because `Backlog.create` defaults
owner to `process.env.USER` (the preserved defect at `backlog.ts:190`, Q-0099's finding).
*Test:* `pnpm sweep:git-identity` green with the new suite collected, in both checkout shapes.

**AC-10 — The register records a partial carry, and the five totals are re-derived unmoved.**
`smoke.js` gains `binaryCarriedBy: [<the new suite>]` with prose naming **which** scenarios it
carries and naming the successor by id for the rest; `:1714`'s
`expect(REGISTER['smoke.js'].binaryCarriedBy).toBeUndefined()` is **rewritten to assert the new
state, never removed**; and `:1617`/`:1694`'s `.toMatch(/Q-0095/)` are **re-aimed at the successor's
id**, because after this ticket closes a clause naming Q-0095 is the contradiction
`binaryCarriedBy` was ruled into existence to prevent (Q-0091 E-2).
This change edits no file under `spike/test/`, so `binary-only 220`, `both 2739`, `library-only
2469`, `total 5428` and the **55%** share are expected unchanged — **re-derived, not adjusted**, and
*"it did not move" is a measurement*.
*Test:* the existing pins at `:1204`–`:1208` and `:1735`/`:1751`/`:1767`/`:1783`, re-run; each moved
clause shown red against its superseded value first; the report states the five numbers observed.

**AC-11 — The suite's cost is measured and reported, not estimated.**
The report states the wall-clock the new file adds to `pnpm test`, measured, and the timeout chosen
with the reason. `build.test.ts` uses `300_000` for build-and-spawn blocks; picking that by analogy
without measuring is what this criterion forbids.
*Test:* the number appears in the implement report. If it is long enough to change the cost of every
`pnpm test` in this repository, that is a finding for the gate rather than something to absorb.

### 3.2 The successor (`Q-0101`) — the failure, gate and rollback paths

**AC-1 — The exhaustion gate, its exit code and what it kept.**
`--auto` does not walk through a human-locked exhaustion gate; the run says which gate it could not
answer and what it kept; it exits **3** and not merely non-zero (`smoke.js:113`–`:121`).
*Test:* exit 3 asserted as `=== 3`, never as `!== 0` — the spike's own comment says why.

**AC-2 — An unanswered non-TTY gate is `undecided`.**
It is recorded `undecided` in `runs.log`, is not recorded as `failed`, rolls nothing back, does not
advance the stage and does not refund its iteration counter (`smoke.js:259`–`:267`).

**AC-3 — `retry` grants exactly one further traversal.**
Three `step=head-of-product` lines,
`gate=retry counter=requirements.head-of-product set=1`, the loop ending one past its limit, and an
unrelated counter untouched (`smoke.js:234`–`:245`).

**AC-4 — The failed parallel sibling, its cost and run-id uniqueness.**
A failed parallel branch fails the run; the surviving sibling keeps its output at
`requirements/run-1/candidate-codex.md`; **the negative assertion searches `requirements/`
recursively** for `candidate-claude.md` rather than testing one path; the failure is recorded in
`runs.log` and does not advance the stage; a failed step records what it cost and the run's cost
includes it; the next attempt gets its own run id (`smoke.js:141`–`:162`).

**AC-5 — Both re-aimed assertions are demonstrated red against a deliberately broken binary, and the
evidence names the break.**
Before the final green run: one injected break causes the expected run-scoped candidate not to be
found, and one causes a failed parallel sibling's candidate to be found recursively. The recorded
verification identifies **each test, its injected break, and the resulting failing assertion**.
**A process that fails to start, an unrelated process failure, or a different earlier assertion
failing does not count as the red witness.** The break lives in the isolated copy or the mutation
procedure and is never committed as product behaviour.
*Why this is its own criterion:* the single-path form went green the moment Q-0088 moved the file,
proving the writer had failed only by accident. A translation that re-flattens either one re-opens
that hole **and passes**.

**AC-6 — Rollback (a): the abandoned merge.**
A failing `integrate` with no `on_fail` aborts the run, leaves the ticket branch at exactly the SHA
it started from, removes the abandoned merge so the next red phase measures a clean base, leaves the
work intact on its own branch, and records `rolled-back branch=` in `runs.log`
(`smoke.js:359`–`:365`).

**AC-7 — Rollback (b): the base-sync conflict.**
It fails the run, names the two branches, says re-running the developers cannot fix it, **does not
consume the iteration budget**, and is distinguishable in `runs.log` as `base-conflict base=`
(`smoke.js:394`–`:398`). Base-sync reporting read off the solutioning run's stdout is asserted with
it (`:317`–`:319`).

**AC-8 — `q0033-surface.js` S3.2/S3.3: the shipped review flow traverses both paths.**
Over the shipped `review.yaml`, both rows: `MOCK_ALWAYS_FAIL` + `--gate-answer abort` ends at
`stage: red` with a changes-requested/development/red word in the output; `MOCK_ALWAYS_PASS` +
`--gate-answer advance` ends at `stage: reviewed`, says `approve`, and writes `review/verdict.md`.
Both exit 0 (`spike/test/q0033-surface.js:170`–`:181`).
*Note:* this scenario uses the **forcing** switches, so it does not depend on the mock counter and
**may run in process** through `invoke()`. If it lives in `run.test.ts`, that file's *"Nothing here
spawns the binary"* header stays true — and note that file already drives `run review` at `:528`,
for a stage-mismatch refusal that traverses no step.

**AC-9 — The shipped-template model pin is re-homed rather than lost.**
`packages/cli/src/templates.test.ts` asserts that no file under `packages/cli/templates/harness/{flows,roles}`
matches `/^\s*model:\s*gpt-/m`, carrying `smoke.js:216`'s claim onto the corpus Q-0093 mirrored.
That file contains no `model` or `gpt` assertion today; `capabilities.source.test.ts:65` guards a
different subject.
*Test:* shown red by adding `model: gpt-5` to a template in a fixture copy.

**AC-10 — The register is completed, and the totals re-derived unmoved.**
`smoke.js`'s row names both counterparts with prose saying which claims each carries — the Q-0092
precedent, *"across two files because the assertion claims two things"* — and its `binaryHalf` stops
naming any successor; `q0033-surface.js` gains its sixth counterpart and `:1617`/`:1694` are
**inverted** to `.not.toMatch(/— Q-0101\b/)`, matching the shape those clauses already use for
Q-0093, Q-0094 and Q-0099. The five totals are re-derived and expected unchanged.
*Test:* each moved clause shown red against its superseded value first.

---

## 4. Non-goals — binding on both halves

1. **`spike/src/**` and `spike/test/**` are not touched.** Ground rules 1 and 2. `smoke.js` keeps
   running and keeps its 158 assertions until the cutover deletes it wholesale. A child *adds*
   coverage under `packages/cli`.
2. **The cutover itself.** Deleting `spike/`, retiring the `spike` CI job and retiring
   `harness/port-charter.md` are Q-0010 §5's follow-up. These tickets unblock them. See **GO-1**.
3. **The library half is not re-translated.** Seventy of the 158 sites are carried by eleven
   `packages/core` suites the register names. A second description of each would be two descriptions
   that drift apart silently — Q-0054's own stated reason for having an empty translation set.
4. **No known defect is closed in passing.** Q-0059's traversing `dirOf`, Q-0060's silent
   frontmatter, Q-0066's probe crash, Q-0068's *"Harness runs on subscription OAuth only"* (asserted
   verbatim at `smoke.js:130`/`:131`), Q-0100's `harness`-spelled usage lines and the `owner` default
   at `backlog.ts:190` are preserved and asserted as they are. Where a test encodes counterintuitive
   behaviour its source cites the ticket rather than restating its history.
5. **No mock reset export, and no test-only switch, command, environment variable, flag or
   production branch** is added to make the suite easier. `mock.ts` names the reset a charter §2
   behaviour change; Q-0098 AC-15 refused the general shape.
6. **`fileParallelism: false` is not set workspace-wide.** The isolated copy removes the reason to
   want it, and the setting would slow every package's suite to solve one file's problem.
7. **No domain helper is ported into `packages/cli`.** Ground rule 4, verified: the mock adapter, the
   engine, fan-out, integrate, worktrees and run history are all in `core` and reachable through the
   barrel Q-0092 extended. **A genuinely missing core API is a scope blocker, not permission to copy
   spike logic** — stop and report it.
8. **No CLI output, exit code, persistent layout, schema, command name, adapter contract, flow
   semantic or gate semantic changes**, except a workspace invocation-path adaptation with no user
   effect. Weakening or deleting an observable assertion is not permitted without recording it as an
   open scope decision.
9. **A homed replacement for the seven `harness/architecture.md` role-table assertions.** Registered,
   routed to GO-2, not built here.
10. **Windows support.** The fixture rewrites `commands.install`/`commands.test` to `sh` chains, as
    the spike does. All seven CI jobs are `ubuntu-latest`; this repository has never claimed Windows.
11. **No real-vendor coverage, no network, no registry installation path, no budget caps, and no
    change to cold-clone instructions.**

---

## 5. Findings the implementer should not re-derive

- **R-1 — Read `spike-parity.test.ts`, not the ticket body, for scope.** §0.1–§0.3. The body's
  figures are wrong in both recorded ways and its scope statement is short by one file.
- **R-2 — `build.test.ts`'s *"nothing was extracted from it"* is a description, not a prohibition.**
  It records what Q-0098 did. Reading it as a contract is the class Q-0094's E-3 named: *a
  requirement describes what must be conveyed; only a fixture, a frozen contract's own file, or a
  criterion quoting bytes pins bytes.* Extraction of `isolate()`/`buildIn()`/`runBuild()` is
  permitted; so is `build-fixture.test.ts`'s shape of building its own.
- **R-3 — `packages/core` genuinely holds everything the spine needs** (ground rule 4, checked by
  name). What is missing is the **process boundary**, not an API.
- **R-4 — No `pnpm install` is needed inside the fixture.** `smoke.js:34`–`:39` rewrites
  `commands.install` to `sh -c "pwd > ../../install-cwd"` and `commands.test` to `sh tests/check.sh`.
  The marker is written **two levels up, outside the worktree** — deliberately, since Q-0062: written
  inside, it leaves the integration worktree permanently dirty, the run keeps it, and the suite never
  exercises removal on the one worktree every code-writing flow makes.
- **R-5 — The mutation mechanism is the isolated copy.** Codex's OQ-2 asked what repository-supported
  mechanism produces the red witness without committing broken behaviour; the answer is already in
  AC-2 — break the copy the suite built, not the product. No new seam is owed.
- **R-6 — `q0033-surface.js` S3.2/S3.3 does not need the spawn** (forcing switches). Sizing it with
  the spine over-sizes it.
- **R-7 — The turbo-inputs work is smaller than it looks.** `packages/cli/turbo.json` already
  declares `../../turbo.json`, `../../pnpm-workspace.yaml`, `../../packages/*/src/**`,
  `../../harness/flows/*.yaml` and `../../.gitignore`. Check what the new fixture reads *beyond*
  those; declare only that.

---

## 6. Open questions

| # | question | owner | blocking? |
| --- | --- | --- | --- |
| **OQ-1** | **Is the ticket split at the seam in §0/Verdict, or advanced as one twenty-criterion ticket?** Recommendation: split. See the two findings below. | **human, at the gate** | **yes** |
| **OQ-2** | **What id does the successor take, and is its folder created before Q-0095's chore run starts?** Q-0095 AC-10 re-aims two register clauses at that id, and `backlog/` is not an agent-writable surface. The allocator answers `Q-0101` today. | **human, at the gate** | **yes** |
| OQ-3 | Are `isolate()`/`buildIn()` extracted into `packages/cli/test/`, or rebuilt locally? Recommendation: extract — two copies of a sixty-line workspace-copier is the drift this repository keeps finding, and `build-fixture.test.ts` avoided it only because its fixture is *synthetic*. R-2 rules the banner non-binding. | implementer | no |
| OQ-4 | One new suite file or two? The spine is one long stateful sequence over a shared fixture and must not be split across files — Vitest parallelises *files*, and two files sharing one fixture repository would reproduce Q-0039's collision (same run id, same worktree) inside the test suite. Recommendation: one file per ticket, tests sequential, fixture private. | implementer | no |
| OQ-5 | Where does the successor's AC-8 live — its own suite, or `run.test.ts`? It needs no spawn (R-6). Recommendation: `run.test.ts`, which keeps its *"Nothing here spawns the binary"* header true and puts the scenario beside the other `quorum run` claims. | implementer | no |
| OQ-6 | Should the four AC-15(c) citations be clarified in place? §0.6 rules they stay **literally true**, so this is a one-line courtesy in each of `board.test.ts:25`, `gate.ts:21`, `init.test.ts:16`, `run.test.ts:17`, `runs.test.ts:14` — **not** an erratum, and nothing is overturned. | implementer | no |

---

## 7. Gate obligations — work no step on the chore route may perform

Named as obligations rather than criteria because of *"A requirement may not name a surface its flow
cannot write"* (2026-08-25). Writing them as criteria would be the twelfth appearance of a loop
handed work no agent on it can perform — the pattern Q-0091's E-7 priced at two rounds and $14.28,
one of which changed no files at all.

- **GO-1 — The cutover ticket is opened at the successor's close, with its body written out in
  full.** The ticket body asks for this in as many words. The body must carry, at minimum: what
  `spike/test/**` still holds that nothing else does (the seven role-table assertions of §0.4 and
  GO-2's disposition), the `spike` CI job, `harness/port-charter.md`, the `port-freeze-*` jobs that
  read the freeze SHA, and `spike-parity.test.ts` itself, which is deleted with its subject.
- **GO-2 — A ruling on the seven `harness/architecture.md` role-table assertions.** Three readings:
  re-home them in `packages/shared` or a new harness-consistency suite; accept their loss at the
  cutover and say so; or fold them into GO-1's body as something the cutover deletes deliberately.
  Whichever it is, it must be **written down** before the cutover, because after it there is no
  record they existed. The model pin is **not** in this set — the successor's AC-9 homes it.
- **GO-3 — The plan's and the ticket body's figures are corrected by hand:** `781` → `780`, and the
  assertion count restated as *158, of which 76 transfer*. `06-development-plan.md` contradicts
  itself between Q-0010's bullet and Q-0095's; `backlog/Q-0095-…/ticket.md` carries the same pair.
  Both surfaces are the human's — the backlog belongs to the harness and an agent's edits under it
  are discarded.

---

## 8. Cross-cutting checklist

| pillar | answer |
| --- | --- |
| **BYOS** | Asserted, not merely unbroken: Q-0095 AC-7 requires the three key variables set and both vendors refused **before** either CLI is probed. No key is introduced on any path; `smoke.js:505`'s key string is a `transientError` fixture and is library-half. Q-0068's *"Harness"* wording is preserved (non-goal 4). |
| **Safety by construction** | Q-0095 AC-6 is the whole of it end to end: worktrees under `.harness/worktrees/`, branches beside `harness/<id>/integration`, the user's working tree untouched outside `backlog/` and `harness/`, and the finished run giving back what it obtained. Every fixture is a temporary directory the suite created; nothing writes into this repository. |
| **Human-gated by default** | The successor's AC-1 to AC-3: `--auto` does not walk a human-locked exhaustion gate, an unanswered gate is `undecided` and exits 3, `retry` grants exactly one traversal. No new gate or flow format. |
| **Files are the database** | Every assertion reads the file the binary wrote — `ticket.md`, `runs.log`, the ticket branch — rather than the run's memory. That is what a spawned process makes checkable and an in-process call does not. |
| **Cross-vendor rule** | n/a to the change; the successor's AC-8 exercises the shipped `review.yaml`, whose panel spans vendors, through the mock. `lint` keeps enforcing it. |
| **Product-agnostic** | n/a. The fixture ticket is *"Subscription downgrade mid-cycle"* — generic demo data, preserved. Vendor names appear only where the adapter contract requires them. |
| **Cold-clone test** | Improved, not lengthened. No new dependency, command or flag; no change to installation instructions or supported acquisition paths, and no claim about registry-resolved `npx quorum`. The adopter's first `harness/flows` is the directory this suite proves. |
| **Errors are explicit** | The successor's AC-4, AC-6 and AC-7 are all about a run stopping with a stated reason and a recorded cost. |
| **File format / schema** | Unchanged. No flow, ticket, role or manifest schema moves; no hidden state store is introduced. |
| **Lint rules** | Unchanged. `harness lint` over the shipped directory is asserted (Q-0095 AC-7), not modified. |
| **Static quality** | TypeScript strict, `pnpm lint` clean, no `any`, no unexplained `@ts-ignore`, no newly deprecated API — `@typescript-eslint/no-deprecated` is on at error severity over `packages/**/*.ts`, tests included (Q-0069). |
| **Turbo inputs (Q-0072)** | Partially covered already — see R-7. Anything the new suite opens that is not among `packages/cli/turbo.json`'s twelve declared inputs must be added, or a cache hit on `@quorum/cli#test` will claim nothing it reads has changed. Registered here so it is not found by the guard. |
| **Q-0079 (git identity)** | Q-0095 AC-9. Every commit-creating call supplies `-c user.email` / `-c user.name` explicitly. The tripwire sees literals only, so a subcommand held in a variable is invisible to it. |
| **Verification** | `pnpm install --frozen-lockfile` then `pnpm turbo run test --force`; and `npm install --prefix spike --no-audit --no-fund` then `npm test --prefix spike`, which must pass unreduced (ground rule 2). No test added is skipped, focused or conditionally omitted in either run. |

---

## 9. Risks

| # | risk | mitigation |
| --- | --- | --- |
| **RK-1** | **The suite is slow enough that people stop running it locally.** One `tsc` build of three packages plus ~14 spawned flow runs with real git worktrees. If it is minutes, it changes the cost of every `pnpm test` here. | Q-0095 AC-11: measure first and report the number. One build per file in a `beforeAll`, not per test. If it is genuinely long, that is a finding for the gate, not something to absorb. |
| **RK-2** | **A translated assertion passes for the wrong reason.** Already happened once in this exact file. Two more shapes are in it: the `commitAll` block that became a silent no-op when Q-0062 started returning worktrees, and `:459`'s existence guard. | The successor's AC-5 requires the two re-aimed assertions demonstrated **red against a deliberately broken binary**, with the break named. Q-0095 AC-8 requires no block to be skippable-and-green. |
| **RK-3** | **The register clauses are deleted rather than inverted**, so the suite goes green over a claim nobody checks. | Q-0095 AC-10 and the successor's AC-10, with the Q-0094 precedent quoted at `spike-parity.test.ts:1612`–`:1615`: the old expression *"would have gone on passing while meaning the opposite, which is worse than going red"*. |
| **RK-4** | **A second spawning suite meets `build.test.ts` mid-`removeEmit()`** and flakes in a way that reads as a code defect. | Q-0095 AC-2: the suite never touches `packages/cli/dist`. This is the hazard AC-15(c) was written for, and the isolated copy is its own first answer. |
| **RK-5** | **The chore route's implement step cannot run the suite it is writing.** A step's worktree has no dependencies until it installs them, and `commands.install` runs only in an `integrate` worktree. A suite that builds an isolated copy needs `node_modules` present. | The implementer runs `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund` before either suite, and reports a suite it could not run as **unrun** rather than green. A reviewer cannot tell an uninstalled suite from a red one. |
| **RK-6** | **The reviewer cannot execute anything.** Codex runs `--sandbox read-only`; recorded on five consecutive children. An approve on reading alone is not evidence for a suite whose whole subject is execution. | Verify at the gate by execution or by mutation, not from the report. Against 42 of 59 chore reviews returning `revise`, a first-round approve here should be distrusted. |
| **RK-7** | **Two Vitest files share one fixture repository** and reproduce Q-0039's collision — same run id, same worktree — as an intermittent failure that looks like a product defect. | OQ-4: one file per ticket, one private fixture. Q-0039 is a real open ticket and this suite must not make it acute. |
| **RK-8** | **`integrate` reports `tests=ok` from a replay.** This ticket adds a large slow suite whose replay is the most tempting of all. | Verify **forced** in both environment rows per Q-0072's closing finding: in the integrate worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` after the merge, where both exist. |
| **RK-9** | **The seven role-table assertions are quietly lost.** Nobody is looking for them; they are in a file scheduled for deletion, and the only two documents that mention them say *"no suite opens the file"*. | GO-2 rules them; GO-1's body carries them. This is the mechanism *"deferred criteria need successor bodies"* exists for. |
| **RK-10** | **Green workspace coverage is read as authorisation to delete the spike immediately**, combining verification and cutover and removing the independent witness before the follow-up is reviewed. | Non-goal 2 and GO-1. The cutover is a separate ticket recording these two as its prerequisite. |

---

## Provenance

**The claude candidate is the base**, and by a wide margin. It contributed everything measured: the
line/assertion corrections and their commit-by-commit trace, the four-bucket classification and
Appendix A, the two-file scope finding against the register, the orphan-bucket analysis, the
`mock.ts` module-scoped-counter finding that decides the execution model (§0.5), the AC-15(c) ruling
that dissolves the apparent erratum (§0.6), the register-inversion shape and Appendix B, the
findings R-1 to R-6, and most criteria. Its structure — measure first, then specify — is what made
the size judgement possible at all.

**The codex candidate contributed four things claude lacks**, and one of them is load-bearing:

- **Spike independence as a testable criterion** (its 10) — *"can run after `spike/` is removed …
  does not read, import, spawn or require files under `spike/` at test runtime"*. This is the
  property the cutover actually turns on and claude never states it. It is Q-0095 **AC-3**.
- **The negative specification of the red witness** (its 8) — *"unrelated process failure, failure
  to start the binary, or a different earlier assertion does not count"*, and the requirement that
  the record identify each test, its break and the resulting failing assertion. Claude's AC-8 asks
  for a red demonstration; codex says what would fake one. It is the successor's **AC-5**.
- **The determinism list** (its 5) — subscription, network, git identity, unset config value,
  pre-existing gitignored directory, enumerated rather than gestured at. It is Q-0095 **AC-9**.
- **The verification commands and the "not skipped, focused or conditionally omitted" clause** (its
  14), and the explicit *"a genuinely missing core API is a scope blocker, not permission to copy
  spike logic"* (its non-goals), both folded into §4 and §8.

**Where they disagreed, codex was overruled twice.** Its criterion 12 asks that `smoke.js` *"remain
classified as `split`"* and its 13 that totals be re-derived — correct but weaker than claude's,
which names the three specific clauses and requires them **inverted rather than deleted**. And its
criterion 21 makes the cutover follow-up an acceptance criterion; it cannot be one, because
`backlog/` is not an agent-writable surface and the engine discards an agent's edits under it. It is
**GO-1**.

**Two claude claims were corrected against the tree** (§0.7): `run.test.ts` does drive `run review`,
at `:117` and `:528`; and one of the eight "orphan" assertions has a cheap home in
`templates.test.ts`, which reduces GO-2's subject from eight to seven and turns a deferral into the
successor's **AC-9**.

**Neither candidate judged its own size**, which is the gate's job and the reason for the verdict.

---

## Appendix A — the 158 assertion sites, classified

`spike/test/smoke.js` at HEAD (780 lines). **Bold** rows transfer.

| block | lines | sites | bucket | ticket |
| --- | --- | --- | --- | --- |
| **`init`, `lint`, `ticket new`, first stage, wrong-stage refusal** | 24, 40, 41, 45, 48 | **5** | **binary** | Q-0095 |
| **requirements: parallel PMs, backward edge, run-scoped candidates** | 52, 56–59 | **5** | **binary** | Q-0095 |
| **solutioning: worktree, revise loop, branch kept, tree untouched, contracts merged** | 64–67, 72, 74, 76, 79, 81, 82 | **10** | **binary** | Q-0095 |
| **qa-red: red proven on the ticket branch** | 86–88 | **3** | **binary** | Q-0095 |
| **development: two waves, scoped retry, green, install cwd** | 92–96, 98, 99, 104 | **8** | **binary** | Q-0095 |
| **exhaustion gate: `--auto` refused, exit 3, nothing rolled back** | 113–115, 118–121 | **7** | **binary** | successor |
| **`board` lists tickets** | 123 | **1** | **binary** | Q-0095 |
| **`adapters` refuses three keys before probing** | 130, 131 | **2** | **binary** | Q-0095 |
| **failed parallel sibling, cost, run-id uniqueness** | 141, 142, 148–150, 154, 157, 162 | **8** | **binary** | successor |
| auth-failure translation, claude envelope, probe | 170–172, 177, 178, 180, 201, 202, 206 | 9 | library | — |
| shipped templates pin no `gpt-` model | 216 | 1 | **re-homed** | successor AC-9 |
| **`retry` grants exactly one traversal** | 234, 241, 242, 244, 245 | **5** | **binary** | successor |
| **unanswered non-TTY gate is `undecided`** | 259, 261–263, 265, 267 | **6** | **binary** | successor |
| `lintFlow` convergence | 285, 286, 289, 300 | 4 | library | — |
| `mergeFailure` | 308–311 | 4 | library | — |
| **base-sync reporting off the solutioning run's stdout** | 317–319 | **3** | **binary** | successor |
| `testReport` truncation | 329–332, 335 | 5 | library | — |
| **abandoned merge rolled back** | 359–361, 363, 365 | **5** | **binary** | successor |
| **base conflict does not loop** | 394–398 | **5** | **binary** | successor |
| **the `commitAll` block's subject: the contracts branch outlives its run** | 418 | **1** | **binary** ¹ | Q-0095 |
| `commitAll` refuses backlog edits | 439, 440, 442–446, 448 | 8 | library | — |
| `harness/architecture.md` role table | 462, 466, 468, 471, 474, 478, 483 | 7 | **orphan** | GO-2 |
| `withRetry` / `transientError` | 501, 510, 526–528, 535, 541 | 7 | library | — |
| `environmentFailure` | 557, 566, 579, 583 | 4 | library | — |
| `spike/test/run.js` discovers a new failing file | 595, 599, 600, 603 | 4 | runner ² | — |
| contract validator | 629, 640 | 2 | library | — |
| **`validate` exits 0 and 1 from the CLI** | 647, 648 | **2** | **binary** | Q-0095 |
| `formatCost` | 655, 657, 658 | 3 | library | — |
| `resolveModel` | 665–667 | 3 | library | — |
| `materialiseDiff` empty-range diagnostic | 692, 697, 699–703, 706, 707 | 9 | library | — |
| `waves` / `scopeToFailing` | 716, 720, 723–726, 729 | 7 | library | — |
| `syncBaseIntoTicketBranch` | 751, 753, 757, 770, 771 | 5 | library | — |
| | | **158** | 76 binary · 70 library · 8 repo-consistency · 4 runner | **Q-0095 37 · successor 39** |

¹ `:418` belongs to both halves: the block below it tests `commitAll` (library, carried by
`fanout/fanout.test.ts`), but its *subject* is a branch only the binary's solutioning run created.
Its translated form largely restates Q-0095 AC-6's `:72`/`:76` claim; the implementer says which of
the two carries it rather than writing both.

² Carried by `packages/core/src/test-discovery.test.ts`, whose header states the same reasoning:
qa-red proves a red phase by writing new test files, so a runner blind to them reports green while
`integrate --expect fail` loops to a gate having proved nothing.

---

## Appendix B — the three register clauses, and which half moves each

All in `packages/core/src/spike-parity.test.ts`.

| site | current expression | means today | who moves it | after |
| --- | --- | --- | --- | --- |
| `:1714`, test (p) | `expect(REGISTER['smoke.js'].binaryCarriedBy, "smoke.js is still Q-0095's to translate").toBeUndefined()` | the last binary half is owed | **Q-0095** — it sits in the `adapters` test, and `adapters` rides the chain | names the new suite; the successor adds the second counterpart |
| `:1617`, clause (n) | `expect(REGISTER['q0033-surface.js'].binaryHalf, 'the surface row names no successor for the rest').toMatch(/Q-0095/)` | Q-0095 owes the review-flow half | **Q-0095 re-aims to `/Q-0101/`; the successor inverts to `.not.toMatch(/— Q-0101\b/)`** | the row names no successor; the prose says who carried it |
| `:1694`, clause (p) | the same assertion, second copy | ditto | ditto | ditto |

Each is **shown red against its superseded value** before the new one is trusted — the demonstration
Q-0092, Q-0093, Q-0094 and Q-0099 each wrote for their own move — and each is **rewritten rather
than removed**, because a deleted clause and a satisfied one are indistinguishable in a green run.

The five pinned totals (`:1204`–`:1208`, and the four `toStrictEqual` sites at `:1735`, `:1751`,
`:1767`, `:1783`) are **re-derived and expected unmoved** by both halves — 220 / 2739 / 2469 / 5428
and 55% — because neither edits a file under `spike/test/`.
