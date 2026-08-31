# Q-0054 — The regression suite on Vitest, and CI gating the port

*Merged requirement, run 1, 2026-08-31. Measured at `3cbebf5`. Every count below is a measurement
with a short half-life — **re-derive at the branch's own SHA**. Q-0051's figures were wrong within
ten hours, and two of this ticket's eight entangled files landed in the four days before this run.*

---

## Problem

M2's definition of done says: *"The 30-check smoke test passes as a Vitest suite; CI runs it on
every push."* Three facts decide what this ticket actually is, and two of them are already decided
in `harness/port-charter.md` — which the ticket body cites for §6 and never for §1 or §5.

**One — the routing is decided, and so is the deliverable.** §5, under *"Q-0054's relationship to
Q-0010, decided"*, picks the first of the body's three routes: *Q-0054 ports the library-level
suites and leaves the CLI-driven ones on the spike until Q-0010 lands*, rejecting the other two by
name. §1's third bullet then bounds what "ports the library-level suites" can mean: **"Every child
ports its module's unit-level tests with the module. Q-0054 keeps only the end-to-end regression
suite and the CLI-driven files whose translation cannot be split per module."** The end-to-end suite
is `smoke.js` and the CLI-driven files are exactly what §5 defers. **§1 ∧ §5 leave Q-0054's
translation set empty by construction.** Neither candidate cited §1; it is the clause that decides
this ticket's size.

**Two — the translation the body implies has already happened, in a different form, and nothing
records it.** Each child wrote **fresh** Vitest tests against its own ported module rather than
transcribing a spike file: `packages/core/src/engine/diff.test.ts` is 1,047 lines of
`describe('Q-0051 AC-N …')`, and **no `packages/core` test cites a spike suite file or any of its
scenario ids** — `q0035-empty-range.js`'s `E1`–`E17` appear nowhere in `packages/**`. The workspace
suite is already 69 files and 18,957 lines against the spike's 17 files and 4,396 lines. So the gap
is not coverage. **The gap is that no artifact states the relationship between the two suites.**
Each child checked its own module; nobody has checked the union. At the cutover Q-0009 deletes
`spike/test/**` — the port's only independent witness — and today there is no record of which of
those scenarios were carried, which transfer at Q-0010, and which were carried by nobody. Producing
that record is what makes this "the only ticket that can prove any of the others".

**Three — beside the record sit three things genuinely unproven rather than merely unrecorded.**

- **The discovery guarantee is broken and nothing says so.** `spike/test/run.js` reads its directory
  and runs every `*.js` it finds; its header explains why — qa-red proves a red phase by writing
  **new** test files, and a runner blind to them reports green while `integrate --expect fail` loops
  to a gate having proved nothing. Vitest's configured include is `src/**/*.test.ts`
  (`vitest.shared.js:7`). A red test written to `packages/core/test/x.test.ts`, to
  `packages/core/x.test.ts`, or as `packages/core/src/x.test.js` is collected by **nothing** and the
  suite reports green. The ticket body called this *"worth an explicit check rather than an
  assumption"*; it is now measured, and the assumption was wrong.
- **CI's spike job is unpinned.** `packages/core/src/test-command.test.ts` reads
  `(jobs['spike']?.steps ?? [])` and asserts `.not.toContain('git config --global')`. Delete the
  `spike` job and that expression is `''`, which does not contain the string, and the assertion
  passes. The one check that mentions the job cannot fail when the job is gone — *"a check that
  skips its subject must not report success"* (2026-08-25) and *"A check is not established by
  reading it"* (2026-08-29), inside a guard written after both landed.
- **The two-suite arrangement is assumed rather than stated.** Between now and the cutover the
  repository genuinely has two required suites; `docs/04-architecture.md:66` says the opposite, in
  the perfect tense — *"the mock end-to-end (the 30-check smoke test, **ported**)"* — describing a
  port that has not happened. `smoke.js` carries **151** `assert(…)` calls. The "30 checks" figure
  traces to *"`integrate` is one generic step type used by three stages"* (2026-08-21), which is a
  landed decision entry and stays as the historical record; what stops is two **living** documents
  repeating a 2026-08-21 count as a present-tense requirement.

### Corrections to the ticket's own line map

The map re-derived on 2026-08-31 is accurate on the file classification, on the totals, and on
`run.js`, all re-verified here. Two statements are not, and both would mislead an implementer:

- **CI has seven jobs, not five, and `spike` is the fifth rather than the last.** The map omits
  `git-identity-sweep-bare` and `git-identity-sweep-populated`, which Q-0079 added and which run
  **both** suites under a hostile git environment. Any criterion counting CI jobs counts seven.
- **`freeze-sha` is recorded and clean.** `harness/port-charter.md:265` reads
  `freeze-sha: 7b6bc70421094ae31eb44257807f84b8f732a20a`, and `git log 7b6bc70..HEAD -- spike/` is
  empty. The map's claim that the job is live is right; the hazard it implies is dormant.

The map's correction about the `runGate` signal-window exception is right and is inherited without
change: **this ticket carries no authorised behaviour change of any kind.**

### The measurement, at `3cbebf5`

| | files | lines | |
| --- | --- | --- | --- |
| binary-only | 3 | 1,075 | `smoke.js` 739, `q0011-runs-cli.js` 116, `q0036-board-containment.js` 220 |
| both | 5 | 1,262 | `q0011-run-history.js` 273, `q0033-surface.js` 445, `q0034-review-fixes.js` 134, `q0077-base-flag.js` 194, `q0080-allocation.js` 216 |
| library-only | 9 | 2,059 | `q0006-engine.js` 253, `q0034-chore-preflight.js` 139, `q0034-dry-run.js` 87, `q0034-probe-schema.js` 42, `q0035-empty-range.js` 730, `q0038-endpoint-preflight.js` 332, `q0057-run-scoped-reviews.js` 262, `q0063-stdin-epipe.js` 71, `q0070-capture.js` 143 |

2,337 of 4,396 lines — **53%** — are entangled with the binary and transfer at Q-0010. Eight files
name `bin/harness.js`; five of those also import from `../src/`. Workspace side: 69 `*.test.ts`,
18,957 lines, **none outside any package's `src/`**.

### Surface

**None of the product's four surfaces.** This ticket touches the repository's own test
configuration (`vitest.shared.js`, `packages/*/turbo.json`), its CI workflow, new guards under
`packages/core/src/`, and two documents under `docs/`. It changes no CLI output, no file under
`backlog/` or `.quorum/`, no flow in `harness/`, and no adapter. Stated plainly because
`harness/product-context.md` requires a requirement to name its surface, and "none" is the honest
answer rather than a gap.

---

## User stories

**As the `maintainer`**, running the fourteenth and last child of a port that has cost $599.77, I
want one artifact that says, file by file, which spike scenario the workspace suite carries — so
that at the cutover I can delete 4,433 lines of the port's only independent witness knowing exactly
what goes with it, instead of deciding on the strength of thirteen separate green ticks that each
only ever looked at their own module.

**As the `maintainer`**, when a qa-red step writes a new failing test file to prove a red phase, I
want `pnpm test` to fail — so that `integrate --expect fail` proves the phase rather than looping to
a gate over a suite that never collected the file. Today the spike's runner gives me this and the
workspace's configuration does not, and nothing tells me.

**As the `contributor`** adding a vendor adapter, I want the suite that tells me I got it right to
be the one CI runs, and I want to know which of the two suites is authoritative for which
behaviour — so that a green tick on my branch means my adapter works rather than that I did not
happen to touch the half that would have caught me.

The `adopter` is unaffected: nothing here reaches `npx quorum`, `harness init` or the README, so the
cold-clone path is unchanged in both directions.

---

## Acceptance criteria

Each is independently testable. Where a criterion names a count or a path, it is a measurement at
`3cbebf5` and is satisfied by **re-deriving it at the branch**, not by matching the figure printed
here.

### The parity register

**AC-1 — Every file under `spike/test/` has a verdict, the keys come from the tree, and the register
carries its own retirement.**
A guard under `packages/core/src/` holds a register mapping each file in `spike/test/` to one of four
verdicts:

- `cli` — the file spawns `spike/bin/harness.js` and imports nothing from `../src/`; it transfers at
  Q-0010 and this ticket carries no counterpart for it;
- `ported` — its behaviour is carried by one or more named `packages/**/*.test.ts` files;
- `split` — its library half is carried by named counterparts and its binary half transfers at
  Q-0010; both halves named;
- `uncovered` — no counterpart, with a one-line reason and, where one is owed, a ticket id.

Three clauses, each independently checkable: (a) the keys are derived from `readdir(spike/test/)`,
not written by hand, and the guard fails when a file on disk has no entry or an entry names a file
not on disk; (b) `run.js` is excluded **by name and the exclusion is asserted**, not assumed;
(c) the register's header states in one line that it is deleted at the cutover by Q-0009 together
with `spike/test/**`, and that a `cli` verdict is a claim about Q-0010 rather than about this
ticket. A pointer, per `harness/rules.md` — no transcription of the charter or of a decision entry.

*Why keys-from-the-tree:* Q-0051 found `q0050.source.test.ts`'s third hard-coded file list **failing
open** — a seventh engine file went unscanned while the suite reported green. A hand-written key list
would go stale the first time a suite lands and would report green over the omission.

**AC-2 — The verdict is checked against the file, not merely declared, and an unclassifiable file
stops rather than defaults.**
The guard recomputes, from each spike test file's own text, whether it reaches
`spike/bin/harness.js` and whether it imports from `../src/`, and fails when that computation
disagrees with the register's verdict. Specifically: a file importing nothing from `../src/` may not
carry `ported` or `split`, because it has no library-level behaviour to port; a file importing from
`../src/` and never reaching the binary may not carry `cli`. The three-way classification and its
line totals are asserted as identities, so the 53% figure stops being something each reader
re-derives by hand.

**A file whose binary reference the recomputation cannot resolve — an indirect path, a computed
specifier, a helper — fails the guard rather than falling to a default class.** Measured hazard: at
`3cbebf5` the eight entangled files spell the path two ways (`'bin/harness.js'` and `'harness.js'`,
four each), so a single-literal scan already mis-classifies five of them. Classification is by
observed reference and import, never by one text pattern assumed to be exhaustive.

**AC-3 — A `ported` or `split` entry names counterparts that exist and are collected.**
For every named counterpart the guard asserts the file exists **and** that Vitest's configured
include for its package would collect it. This is the clause that fails when a counterpart is
renamed, moved out of `src/`, or renamed away from `*.test.ts` — the ways a register decays into a
list of paths that excuse nothing.
*Why the collection check and not existence alone:* Q-0073 found `node_modules/.bin/turbo` had become
uncollectable in `NOT_READ` on day one, so the register read as coverage while excusing nothing. That
file's own dead-key guard is the idiom to match.

**AC-4 — The register is identities with pinned arithmetic, not floors.**
Counts and sets are asserted with `toStrictEqual`/`toEqual` against a named set, never with
`toBeGreaterThanOrEqual`. Demonstrated firing, **each clause on its own**: (a) deleting one register
row fails; (b) changing one row's verdict to a value AC-2's recomputation contradicts fails;
(c) pointing one `ported` row at a non-existent counterpart fails; (d) pointing one at a real file
outside the include fails.
*Why each clause separately:* demonstrating that a guard has a subject proves the guard fires, not
that each of its clauses does (Q-0071); and a count is not an identity (Q-0073).

### The discovery guarantee

**AC-5 — No `*.test.ts` in the workspace is collected by nothing.**
A guard walks every workspace package (derived from `pnpm-workspace.yaml`'s globs, not a hand-written
list), finds every `*.test.ts` outside `node_modules`, and asserts each one is collected by the
include pattern its package's Vitest configuration resolves to. It performs **no write to the
reader's tree**: the negative half is a synthetic path list, not a file created on disk.
*Why no write:* Q-0073 rejected exactly that shape — it makes the answer depend on a fixture and
gives a test a side effect on the reader's tree.

**AC-6 — A red test lands where a red phase would put it, and is collected.**
`vitest.shared.js`'s include covers every location a qa-red step may write a test file to, or the
permitted location is a rule an executable check enforces. Measured hazard at `3cbebf5`, which the
change must close: `packages/core/test/x.test.ts`, `packages/core/x.test.ts` and
`packages/core/src/x.test.js` are collected by nothing today. The guard is **demonstrated red
against the pre-change configuration** before it is trusted over the post-change one.

Two constraints the change must respect and **assert rather than observe**:
(a) the six helper files under `packages/core/test/` — `cli-stub.ts`, `corpus.ts`, `env.ts`,
`repo.ts`, `run-fixture.ts`, `strict-schema.ts` — stay non-suites because none is named `*.test.ts`;
`cli-stub.ts`'s and `repo.ts`'s headers currently cite the *narrow include* as the reason they are
safe there, so if the include widens that stated reason becomes false and the new one is written
down;
(b) `packages/core/src/adapters/real-cli.probe.test.ts` keeps skipping without `QUORUM_REAL_CLI`
(`describe.skipIf`), so no widening turns a paid live-CLI probe into an ordinary suite member.
Asserted, because a BYOS-adjacent path is not left to inspection.

**AC-7 — `turbo run test` reaches every workspace package.**
Every package matched by `pnpm-workspace.yaml`'s globs declares `test`, `lint` and `typecheck`
scripts. A package with no `test` script is skipped by turbo in silence, which is the same failure
one layer up from AC-6. All seven satisfy this at `3cbebf5`, so the criterion is a guard against
drift rather than a fix; it is derived from the globs so a package added later is covered without
anyone remembering.

### CI gating

**AC-8 — The workflow's job set is asserted by identity, and the defect is exhibited before it is
closed.**
`test-command.test.ts`'s `(jobs['spike']?.steps ?? [])` passes when the job is absent. The
workflow's jobs become a register — at `3cbebf5`: `workspace`, `port-freeze-policy`,
`port-freeze-branch-scope`, `port-freeze-sha`, `spike`, `git-identity-sweep-bare`,
`git-identity-sweep-populated` — and a job added or removed fails until the register is updated.
Demonstrated: a fixture workflow with `spike` removed fails the new register, **and the existing
assertion is shown to pass over that same fixture**, so the defect is exhibited rather than asserted.
No path filter, branch filter, conditional step or continue-on-error is added to any of the seven,
and the `workspace` job keeps running `pnpm turbo run <task> --force` on both `push` and
`pull_request` after a frozen-lockfile install.

**AC-9 — The new guards' reads are inside the task's declared input closure.**
Every repository file the new guards read is covered by `@quorum/core#test`'s declared `inputs`, by
the workspace dependency edge, or by `NOT_READ` — enforced by `packages/core/src/turbo-inputs.test.ts`,
which fails when a read stops being covered. Already declared: `spike/test/**`, `spike/src/**`,
`.github/workflows/ci.yml`, `.github/scripts/**`, `turbo.json`, `pnpm-lock.yaml`,
`docs/04-architecture.md`. **Not declared and likely to be read:** `pnpm-workspace.yaml`,
`packages/*/turbo.json`, `packages/*/package.json`, `packages/*/vitest.config.js`.
`vitest.shared.js` is in root `turbo.json`'s `globalDependencies`, which answers the hash question
and says nothing about the guard's register. This matters even though CI forces, because a local
unforced run must not reuse a verdict across different inputs. **Verify against the guard, not
against this list** — Q-0072 spent five implement rounds on four correct and different majors here.

### The documents

**AC-10 — What each tick claims is stated, including that two suites are required, and M2 names the
ticket that can satisfy it.**
`docs/04-architecture.md` §Testing says that until the cutover the repository has two required
suites with different reach — the `workspace` job proves the port at library level, the `spike` job
proves the harness the port is being developed with, including the mock end-to-end through the
binary — and that the transfer of the CLI-driven half is Q-0010's. Line 66's parenthesis *"(the
30-check smoke test, ported)"* is corrected to what is true. The same section states the chain from
*a new failing file appears* to *`pnpm test` fails*, each link naming the check that holds it: the
include collects it (AC-5/AC-6), the package runs it (AC-7), `$TURBO_DEFAULT$` puts it in the
package's `test` hash so a cached pass cannot stand over it, and CI forces regardless.
`docs/06-development-plan.md`'s M2 bullet is split so the library-level half is Q-0054's and the
mock end-to-end through the binary is Q-0010's, with the count corrected from 30 to the figure
re-derived at the branch. Q-0054's own entry is rewritten to what shipped. Both status lines bumped
with the date and what changed. The 2026-08-21 decision entry that is the origin of "30 checks" is
**not** edited — it is append-only and remains the historical record.

### The freeze, and the evidence

**AC-11 — The witness is untouched and nothing is added to the runtime.**
`git diff --name-only main...HEAD -- spike/` is empty; `harness/port-charter.md`'s `freeze-sha` is
unchanged and no freeze exemption is added; `packages/core/src/engine/routing.ts`'s preserved
`setTimeout(() => {}, 1000)` and its authority line are intact, and no new or rewritten fixture
removes, shortens or bypasses it; no new runtime or test-only dependency is introduced. Charter §3
and §2 restated as one criterion so they are checked at the gate rather than left to the
branch-scope job to discover. If implementation proves a new dependency unavoidable, work stops for
a maintainer decision rather than adding one by default.

**AC-12 — The discovery guarantee and the verdict are proved by execution, at the gate, and
recorded.**
An evidence criterion, named as one rather than dressed as a test, because proving discovery
through the real package graph means writing a file into `packages/core/src/`, which AC-5 forbids a
suite from doing to the reader's tree. Performed once at the gate, in a scratch checkout, and
recorded in the implementation record with the commit tested:

1. A file matching the effective include, carrying a unique deliberate failure marker, is added; both
   `pnpm --filter @quorum/core test` **and** `pnpm turbo run test --force` exit non-zero and report
   that marker. Removed afterwards, and the tree shown clean.
2. `pnpm turbo run test --dry=json` before and after adding a file, with the differing `@quorum/core#test`
   hashes recorded — the hash link of AC-10's chain.
3. From a clean checkout, after `pnpm install --frozen-lockfile` and
   `npm install --prefix spike --no-audit --no-fund`, each of `pnpm lint`,
   `pnpm turbo run typecheck --force`, `pnpm turbo run test --force` and `npm test --prefix spike`
   exits zero, with its result stated per command. Run in **both environment rows** per Q-0072's
   closing finding — once where `.harness/worktrees` and `.quorum/runs` are absent, once where they
   exist. An uninstalled or unrun suite is reported UNRUN, never green.

---

## Non-goals

Charter §6's blanket non-goals apply without restatement: another child's module; editing `spike/**`
(§3); fixing a defect found while reading the spike (§2); the cutover; the `quorum` binary (Q-0010);
persisting the event stream; anything on v1's exclusion list. Beyond those:

- **Translating the nine library-only files into Vitest, line for line or file for file.** Charter §1:
  every child ported its module's unit-level tests with the module, and Q-0054 keeps only the
  end-to-end suite and the CLI-driven files — which §5 defers. Their subjects are carried by the
  18,957 lines the thirteen children wrote; a translation would produce two descriptions of each
  behaviour that can drift apart silently, and would be *"a child that leaves all of its tests to
  Q-0054"* arriving one ticket late.
- **Porting `smoke.js`, `q0011-runs-cli.js` or `q0036-board-containment.js`,** or the binary half of
  the five mixed files. Charter §5. They get a `cli` or `split` verdict and nothing else.
- **Re-aiming any CLI-driven suite at core's public API.** Rejected by §5 by name: it changes what
  the suite tests, which is a behaviour change to the frozen witness under §2, and it destroys the
  independence that makes the witness worth having.
- **Claiming this ticket alone completes M2's smoke-test condition.** It cannot; AC-10 says so in
  the plan rather than leaving it to be inferred from a green tick.
- **Fixing anything the audit finds `uncovered`.** An `uncovered` verdict is a finding with a reason
  and, where owed, a successor ticket id. Fixing it here is §2's "fixed in passing" wearing an
  audit's clothes, and it is unbounded — see OQ-1.
- **Deleting the `spike` CI job, `spike/`, any port-freeze check or either git-identity sweep.**
  Q-0009, after Q-0010.
- **Recording a new `freeze-sha`.** Q-0070 left that sequencing decision open deliberately; it is
  not taken in passing by the last child.
- **Any change to `spike/test/run.js` or to the spike's discovery.** The spike keeps discovering;
  this ticket makes the workspace do the same thing.
- **An automated temp-workspace fixture proving cache behaviour through a real cache on CI's Linux
  checkout.** That is Q-0072's still-open successor A, and AC-12 is deliberately gate evidence
  rather than an attempt at it.
- **Adding snapshots anywhere.** `q0035-empty-range.js` deliberately never asserts a whole sentence
  and never assumes a short SHA is a fixed width; nothing this ticket writes may undo that, and no
  counterpart it *names* is edited to.
- **Making any new check's verdict depend on this repository's branches, ticket stages, git identity,
  or gitignored runtime directories.** Q-0079's rule; its sweep and tripwire already enforce it over
  anything this ticket adds.
- **A budget cap, a run lock, or anything Q-0039/Q-0040 own.**

---

## Open questions

**None blocking.** The two questions the Claude candidate raised as blockers are settled below on
existing normative text, not by a new decision — which matters, because a genuine blocker here would
be a precondition no agent on this ticket's route may satisfy, and that pattern has now cost this
project six runs.

**Settled — does M2's done-when sentence move, or is charter §5 reversed?** §5 already decided the
route and rejected the alternatives by name; §5 is itself downstream of *"The port takes the chore
route"* (2026-08-25). `docs/06-development-plan.md` and `docs/04-architecture.md` are living
documents, and `.claude/rules/docs-and-decisions.md` requires them to be corrected in the same
change when they disagree with what is decided. **The sentence moves (AC-10).** No `docs/DECISIONS.md`
entry is owed, and `developer-generalist`'s write paths cover `docs/`.

**Settled — is the parity register the deliverable, or is a literal translation wanted?** Charter §1's
third bullet answers it: Q-0054 keeps only the end-to-end regression suite and the CLI-driven files,
and §5 defers both. **The register is the deliverable.** Verified rather than assumed: no
`packages/core` test cites a spike suite file or its scenario ids, so the union relationship is
genuinely unrecorded while the subjects are covered.

**OQ-1 (non-blocking, answerable only after the audit runs) — what happens to an `uncovered` row?**
The register is honest under either result, which is why this does not block. Recommendation:
report at the gate with a reason, and let the human rule per row — a one-assertion gap is cheaper to
close in-ticket than to ticket, and anything larger is a successor with its own body written out in
full, per *"Deferred criteria need successor bodies"*. Pre-committing to "always fix" makes the
ticket unbounded; pre-committing to "always defer" risks the cutover deleting a witness for a
behaviour nothing else checks. *Owner: human, at the chore run's gate.*

**OQ-2 (non-blocking) — widen `vitest.shared.js`'s include, or keep it narrow and enforce a location
rule?** Widening to `**/*.test.ts` is safe at `3cbebf5` — no `*.test.ts` exists outside any package's
`src/`, none of the six helpers under `packages/core/test/` is named `*.test.ts`, and Vitest excludes
`node_modules` by default — but that safety is an observation today. **Recommendation: widen, and turn
the observation into AC-6(a)'s assertion.** The alternative puts "red tests go in `src/`" somewhere a
qa-red step's prompt would have to carry it, which is a worse place than a glob. Re-measure before
changing the glob, not after: if a `*.test.ts` appears outside `src/` between now and the branch, the
widening newly executes something nobody chose to execute.

**OQ-3 (non-blocking) — where does the register live, and in whose idiom?** `packages/core/src/`, in
its own file, so Vitest collects it and CI runs it, and so it can be deleted whole at the cutover.
Stated because Q-0079 found a candidate proposing to put a guard beside
`.github/scripts/port-freeze-guard.test.mjs`, **a file nothing executed** — this project's own failure
class, one degree worse than the defects it guards against. The idiom to match is
`packages/core/src/turbo-inputs.test.ts`'s `MANIFEST`/`NOT_READ`: a typed `Record` const, `{@link}`
cross-references, and its dead-key guard, so a reviewer reads one form.

**OQ-4 (non-blocking, for Q-0010) — does Q-0010 consume this register or re-derive it?** It must
re-derive at its own SHA regardless; new spike tests may land first, as two did in the four days
before this run. The register's value to Q-0010 is the `cli` and `split` rows as a starting
inventory, not as a fixed fact. *Owner: Q-0010's requirements run.*

---

## Risks

**R1 — `harness/Q-0054/integration` does not exist.** `git branch --list '*Q-0054*'` is empty at
`3cbebf5`. Charter §8's first checklist item: `review` diffs
`harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs later, creates
the left endpoint. Forgetting it fails the run — how Q-0035 lost $13.86. Since Q-0038 the preflight
refuses before billing rather than after, so the cost is a failed run rather than a wasted implement
step, but the run still fails. **Create it before the first chore run.**

**R2 — a guard written to prove coverage is the easiest place to write a check that cannot fail.**
Rounds 4 to 6 of Q-0050 alone produced five assertions that could not fail, each written by the hand
that had just been shown the same mistake — and this ticket's own AC-8 subject is one. AC-4's four
demonstrations are not optional: an audit whose failure mode is silence is worse than no audit,
because it reads as coverage.

**R3 — the register is a hand-audited judgement and will be wrong somewhere on the first pass.**
Mapping `q0034-chore-preflight.js` or `q0034-dry-run.js` to counterparts is a reading of two suites,
not a computation. That is why AC-2 makes the *classification* machine-derived and only the
*counterpart naming* human — the half that can be computed is computed, and the half that cannot is
what a reviewer reads. Expect the review round to move rows; that is the round doing its job, not a
finding against the implementer.

**R4 — the turbo-inputs guard will demand declarations, and AC-9's list is a prediction.** Q-0072
spent five implement rounds on four correct and different majors in exactly this area, the
instructive one being a clause that learnt binding resolution in round 2 while a clause written two
rounds later matched raw names. Verify against the guard.

**R5 — an implementer reading only the ticket body will think the routing is open.** The body offers
three routes and cites §6; §1 and §5 decide both the route and the deliverable, and the body
mentions neither. This document is the only place the three are joined. If the implement prompt
carries the body and not this document, the routing gets re-litigated at cost.

**R6 — every count here has a short half-life.** 151 assertions, 69 files, 18,957 lines, seven CI
jobs, 53% entangled, `freeze-sha 7b6bc70`: all at `3cbebf5`. Re-derive at the branch.

**R7 — this ticket makes an assertion about a job it will later ask to be deleted.** AC-8 pins the
`spike` job; the cutover removes it. That is deliberate, is why AC-1(c) requires the retirement line,
and should not be read at the cutover as a guard resisting its own removal.

**R8 — cost, and where the §9 signal actually is.** The port has billed $599.77 across thirteen
children, mean $46.14; §9's per-child threshold is $40 and its fourteen-child projection was $550,
both already exceeded, while the threshold §9 calls the one to watch — more than three chore runs on
one child — has never tripped. A register-shaped ticket should come in under the mean. **If it needs
more than two implement rounds, that is the signal the cut was wrong, and it is said at the gate
rather than absorbed.**

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | No code path, test, fixture or example accepts a key, and none is added. One live interaction: AC-6(b) requires `real-cli.probe.test.ts` to keep skipping without `QUORUM_REAL_CLI` after any include change, asserted rather than observed, so no widening turns a paid live-CLI probe into an ordinary suite member. `check()`'s refusal order is untouched (register row 1, Q-0046's). |
| **Worktree safety** | n/a to the change. The chore run writes only in `.harness/worktrees/harness__Q-0054__implement` and merges to `harness/Q-0054/integration`. AC-5 forbids the new guards from writing to the reader's tree at all; AC-12's one deliberate write is at the gate, in a scratch checkout, removed afterwards with the tree shown clean. |
| **Gate behaviour** | n/a to the change — no gate semantics, no exhaustion-gate behaviour, nothing `--auto` can reach. AC-11 pins the preserved `runGate` timer explicitly, because a rewritten fixture is the one plausible route to removing it by accident. Route: `requirements → chore → human gate`. |
| **File format and its schema** | No new file format and no schema change. The parity register is TypeScript in a test file rather than YAML or JSON **deliberately**: a malformed row is a compile error, and `tsc --noEmit` sees it before Vitest does. Nothing under `backlog/`, `.quorum/` or `harness/` changes shape. |
| **Lint rules** | No new flow-lint rule; `lintFlow` is untouched. ESLint covers `packages/**/*.ts` including tests, so the new guards are linted and `@typescript-eslint/no-deprecated` applies — relevant because they call Vitest and Node APIs. New TypeScript is strict, no `any`, no unjustified `@ts-ignore`. `spike/**` stays outside ESLint entirely. |
| **Machine-independence** | Q-0079's rule applies to everything added: a verdict is a function of the commit, not of the checkout or the account. AC-5's no-write clause and AC-2's derive-from-text classification are the two places it could have been broken; the sweep and the tripwire enforce it over the result without this ticket restating them as criteria. |
| **Cold-clone impact** | None in either direction. No change to `npx quorum`, `harness init`, the README, or anything a stranger reads in their first 30 minutes. AC-10 changes two documents a maintainer reads and an adopter does not. |
| **Product-agnostic** | No product name enters the repository. The register names spike files, `packages/**` files and CI jobs only. |
| **Cross-vendor rule** | Satisfied by the route: `chore.yaml`'s review step is cross-vendor and the panel spans vendors. Nothing here touches the rule or its lint. |
| **Errors are explicit** | The guards fail closed by construction — a missing register entry, a counterpart that does not exist or is uncollected, a verdict the recomputation contradicts, a file the recomputation cannot classify, and a job absent from the workflow each fail rather than defaulting to clear. No new runtime error path is added, because no production code changes. |

---

## Provenance

**From the Claude candidate, adopted as the spine.** The reframing from *translate the suites* to
*record the relationship between the two suites*, and the measurement behind it (69 files / 18,957
lines of fresh child-written tests, none citing a spike file). The parity register with four
verdicts and keys derived from `readdir` (AC-1–AC-4), and its Q-0051 *failing-open file list*
justification. The measured discovery hazard — three concrete paths collected by nothing (AC-6). The
`(jobs['spike']?.steps ?? [])` defect and the exhibit-before-closing method (AC-8). The retirement
line, the surface section, the corrections to the ticket's own line map (seven CI jobs, `freeze-sha`
recorded and clean), and most of the cross-cutting checklist. Its AC-5 and AC-4 were folded into one
criterion, and its AC-9's hash evidence into AC-12.

**From the Codex candidate, adopted because it is stronger.** Proving discovery **by execution
through the two real commands** with a unique failure marker rather than only by static glob
matching (AC-12.1) — routed to gate evidence rather than an in-suite guard, because the real package
graph means writing into `packages/core/src/`, which is the tree side effect Q-0073 rejected and
which Q-0072 already carries as its open successor A. The turbo input-closure obligation, which
Claude carried only as a risk and which is a criterion here (AC-9). The reproducible clean-checkout
verification with a per-command result and *UNRUN is not green* (AC-12.3). The no-new-dependency
stop-and-ask clause and the explicit `runGate`-timer clause (AC-11). Its OQ-3 — a file that resolves
the binary path indirectly must not be classified by a simple text search — became AC-2's
stop-rather-than-default clause, and the measurement behind it is new: the eight entangled files
spell the path two ways, so a single-literal scan mis-classifies five. Its CI-claims-retained
criterion is subsumed by AC-8's job register, which is the stronger form.

**Rejected, from Codex.** Its AC-2 and AC-3 — a one-to-one Vitest counterpart for each of the nine
library-only files, plus a scenario-by-scenario parity record — are the largest thing in either
document and are work charter §1 assigns to the other thirteen children. Adopting them would
duplicate 2,059 lines against 18,957 already paid for, produce two descriptions of each behaviour
that can drift apart silently, and take this ticket well past fifteen criteria on its own.

**Rejected, from Claude.** Its OQ-1 and OQ-2 as *blocking*. Both are answered by charter §5 and §1
respectively; §1's third bullet is cited by neither candidate and is what makes the second one
determinate. Ruling them at this gate rather than passing them up is the difference between a chore
run that starts and one that spends its budget re-litigating a settled route.

**Added here, from the tree rather than from either candidate.** Charter §1's third bullet and its
intersection with §5. The verification that no `packages/core` test cites a spike suite file or its
`E1`–`E17` scenario ids, which is what turns "already covered" from an inference into a measurement.
The provenance of "30 checks" — decision *"`integrate` is one generic step type used by three
stages"* (2026-08-21) — which is why AC-10 corrects two living documents and leaves the append-only
entry alone. The two helper headers (`cli-stub.ts`, `repo.ts`) that cite the narrow include as their
safety reason, which is the small obligation a widening creates. `packages/core/turbo.json`'s
current declarations, which make AC-9's *not declared* list four entries rather than a guess. And
the confirmation that all seven workspace packages already declare `test`, `lint` and `typecheck`,
so AC-7 is drift protection rather than a fix — stated so a reviewer does not read a green criterion
as a closed defect.
