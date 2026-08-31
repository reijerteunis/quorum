# Q-0054 — The regression suite on Vitest, and CI gating the port

*Requirements, run 1, 2026-08-31. Measured at `3cbebf5` (`docs(backlog): re-derive Q-0054's line
map before its requirements run`). Every number below was derived at that commit; **re-derive at
the branch's own SHA** — Q-0051's figures were wrong within ten hours, and this ticket's inputs
move whenever a suite lands.*

---

## Problem

M2's definition of done says: *"The 30-check smoke test passes as a Vitest suite; CI runs it on
every push."* Three facts, measured today, mean that sentence cannot be delivered by this ticket
and that the work actually remaining is a different shape from the one the ticket body describes.

**One — the routing question is already decided, and the ticket body does not know it.** The body
offers three routes and asks the requirements flow to "pick one deliberately rather than discover
it". `harness/port-charter.md` §5, under the heading *"Q-0054's relationship to Q-0010, decided"*,
already picked the first — *Q-0054 ports the library-level suites and leaves the CLI-driven ones on
the spike until Q-0010 lands* — and rejected the other two by name, on the charter's own rules.
The ticket body cites §6's register as normative and never cites §5. This requirement records the
decision and does not re-take it.

**Two — under that decision, the done-when sentence names work this ticket may not do.**
`spike/test/smoke.js` spawns `spike/bin/harness.js` and imports no source module. Porting it to
Vitest requires a `quorum` binary; `packages/cli/src/index.ts` is **one line** and
`packages/cli/src/index.test.ts` is **seven**. Q-0010 has no ticket folder. And the count is stale
by a factor of five: `smoke.js` carries **151 `assert(…)` calls**, not 30. The same claim appears in
`docs/04-architecture.md:66` in the perfect tense — *"the mock end-to-end (the 30-check smoke test,
**ported**)"* — describing a port that has not happened. Under `.claude/rules/docs-and-decisions.md`
the document is wrong until an entry says otherwise.

**Three — the translation job the body implies has already been done, by the other thirteen
children, and nothing records it.** The body reads as though 2,059 lines of library-level spike
suites are waiting to be translated. They are not. Each child wrote **fresh** Vitest tests against
its own ported module: `packages/core/src/engine/diff.test.ts` is 1,047 lines of `describe('Q-0051
AC-N …')`, not a transcription of `q0035-empty-range.js`'s `E1`–`E17`. The workspace suite is
already **69 files and 18,957 lines** against the spike's **17 files and 4,396 lines** — 4.3× by
volume.

So the gap is not coverage. The gap is that **no artifact states the relationship between the two
suites.** Each child checked its own module; nobody has checked the union. At the cutover Q-0009
deletes `spike/test/**` — 4,433 lines — and today there is no record of which of those scenarios
were carried, which transfer at Q-0010, and which were carried by nobody. That record is what makes
this "the only ticket that can prove any of the others", and producing it is the work.

Beside it sit three things that are genuinely unproven rather than merely unrecorded:

- **The discovery guarantee is broken and nothing says so.** `spike/test/run.js` reads its
  directory and runs every `*.js` it finds; its header explains why — qa-red proves a red phase by
  writing **new** test files, and a runner blind to them reports green while `integrate --expect
  fail` loops to a gate having proved nothing. Vitest's configured include is
  `src/**/*.test.ts` (`vitest.shared.js:7`). A red test written to `packages/core/test/x.test.ts`,
  to `packages/core/x.test.ts`, or as `packages/core/src/x.test.js` is collected by **nothing** and
  the suite reports green. The body called this "worth an explicit check rather than an assumption";
  it is now measured, and the assumption was wrong.
- **CI's spike job is unpinned.** `packages/core/src/test-command.test.ts:470` reads
  `(jobs['spike']?.steps ?? [])` and asserts `.not.toContain('git config --global')`. Delete the
  `spike` job from `ci.yml` and that expression is `''`, which does not contain the string, and the
  assertion passes. The one check that mentions the job cannot fail when the job is gone — *"a check
  that skips its subject must not report success"* (2026-08-25) and *"A check is not established by
  reading it"* (2026-08-29), inside a guard written after both.
- **The two-suite arrangement is assumed rather than stated.** Between now and the cutover the
  repository genuinely has two required suites; `04-architecture.md` says the opposite.

### Corrections to the ticket's own line map

The map re-derived on 2026-08-31 is accurate on the file classification and on `run.js`. Two of its
statements are not, and both would mislead an implementer:

- **CI has seven jobs, not five, and `spike` is the fifth rather than the last.** The map omits
  `git-identity-sweep-bare` and `git-identity-sweep-populated`, which Q-0079 added and which run
  **both** suites under a hostile git environment (`.github/scripts/git-identity-sweep.sh`, phases
  `spike suite` and `workspace suite`). Any criterion about "CI gating" that counts jobs must count
  seven.
- **`freeze-sha` is recorded and clean.** `harness/port-charter.md:265` reads
  `freeze-sha: 7b6bc70421094ae31eb44257807f84b8f732a20a`, and
  `git log 7b6bc70..HEAD -- spike/src` is empty, as is the same query for `spike/test`. The map's
  claim that the job is live is right; its implied hazard is currently dormant.

The map's correction about the `runGate` signal-window exception is right and is inherited without
change: **this ticket carries no authorised behaviour change of any kind.**

### The measurement, at `3cbebf5`

| | files | lines | |
| --- | --- | --- | --- |
| binary-only | 3 | 1,075 | `smoke.js` 739, `q0011-runs-cli.js` 116, `q0036-board-containment.js` 220 |
| both | 5 | 1,262 | `q0011-run-history.js` 273, `q0033-surface.js` 445, `q0034-review-fixes.js` 134, `q0077-base-flag.js` 194, `q0080-allocation.js` 216 |
| library-only | 9 | 2,059 | `q0006-engine.js` 253, `q0034-chore-preflight.js` 139, `q0034-dry-run.js` 87, `q0034-probe-schema.js` 42, `q0035-empty-range.js` 730, `q0038-endpoint-preflight.js` 332, `q0057-run-scoped-reviews.js` 262, `q0063-stdin-epipe.js` 71, `q0070-capture.js` 143 |

2,337 of 4,396 lines — **53%** — are entangled with the binary and transfer at Q-0010. The
workspace side: 69 `*.test.ts`, 18,957 lines, of which `packages/core` holds 53 files and 17,534
lines against 6,750 lines of production source.

### Surface

**None of the product's four surfaces.** This ticket touches the repository's own test
configuration (`vitest.shared.js`, `packages/*/package.json`, `packages/core/turbo.json`), its CI
workflow, one new guard under `packages/core/src/`, and two documents under `docs/`. It changes no
CLI output, no file under `backlog/` or `.quorum/`, no flow in `harness/`, and no adapter. Stated
plainly because `harness/product-context.md` requires a requirement to name its surface, and
"none" is the honest answer rather than a gap.

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

Each is independently testable. Where a criterion names a count or a line number, it is a
measurement at `3cbebf5` and the criterion is satisfied by re-deriving it at the branch, not by
matching the figure printed here.

### The parity register

**AC-1 — Every file under `spike/test/` has a verdict, and the keys come from the tree.**
A new guard under `packages/core/src/` holds a register mapping each file in `spike/test/` to one of
four verdicts:

- `cli` — the file drives `spike/bin/harness.js` and imports nothing from `../src/`; it transfers
  at Q-0010 and this ticket carries no counterpart for it;
- `ported` — its behaviour is carried by one or more named `packages/**/*.test.ts` files;
- `split` — its library half is carried by named counterparts and its binary half transfers at
  Q-0010; both halves named;
- `uncovered` — no counterpart, with a one-line reason and, where one is owed, a ticket id.

The register's **keys are derived from `readdir(spike/test/)`**, not written by hand, and the guard
fails when a file on disk has no entry or an entry names a file not on disk. `run.js` is excluded by
name and the exclusion is asserted, not assumed.
*Why keys-from-the-tree:* Q-0051 found `q0050.source.test.ts`'s third hard-coded file list **failing
open** — a seventh engine file went unscanned while the suite reported green. A hand-written key list
here would go stale the first time a suite lands and would report green over the omission.

**AC-2 — The verdict is checked against the file, not merely declared.**
The guard recomputes, from each spike test file's own text, whether it spawns `bin/harness.js` and
whether it imports from `../src/`, and fails when that computation disagrees with the register's
verdict. Specifically: a file importing nothing from `../src/` may not carry `ported` or `split`,
because it has no library-level behaviour to port; a file importing from `../src/` and never naming
the binary may not carry `cli`. The three-way classification and its line totals are asserted as
identities, so the 53% figure stops being something each reader re-derives by hand.

**AC-3 — A `ported` or `split` entry names counterparts that exist and are collected.**
For every named counterpart the guard asserts the file exists **and** that Vitest's configured
include for its package would collect it. This is the clause that fails when a counterpart is
renamed, moved out of `src/`, or renamed away from `*.test.ts` — the ways a register decays into a
list of paths that excuse nothing.
*Why the collection check and not just existence:* Q-0073 found `node_modules/.bin/turbo` had become
uncollectable in `NOT_READ` on day one, so the register read as coverage while excusing nothing.

**AC-4 — The register is identities with pinned arithmetic, not floors.**
Counts are asserted with `toStrictEqual` / `toEqual` against a named set, never with
`toBeGreaterThanOrEqual`. Demonstrated firing, each clause on its own: (a) deleting one register row
fails; (b) changing one row's verdict to a value AC-2's recomputation contradicts fails; (c) pointing
one `ported` row at a non-existent counterpart fails.
*Why each clause separately:* demonstrating that a guard has a subject proves the guard fires, not
that each of its clauses does (Q-0071); and a count is not an identity (Q-0073).

**AC-5 — The register carries its own retirement.**
Its header states, in one line, that it is deleted at the cutover by Q-0009 together with
`spike/test/**`, and that a `cli` verdict is a claim about Q-0010 rather than about this ticket. No
transcription of the charter or of a decision entry — a pointer, per `harness/rules.md`.

### The discovery guarantee

**AC-6 — No `*.test.ts` in the workspace is collected by nothing.**
A guard walks every workspace package (derived from `pnpm-workspace.yaml`'s globs, not a hand-written
list), finds every `*.test.ts` outside `node_modules`, and asserts each one is collected by the
include pattern its package's Vitest configuration resolves to. It performs **no write to the
reader's tree**: the negative half is a synthetic path list, not a file created on disk.
*Why no write:* Q-0073 rejected exactly that shape — it makes the answer depend on a fixture and
gives a test a side effect on the reader's tree.

**AC-7 — A red test lands where a red phase would put it, and is collected.**
`vitest.shared.js`'s include covers every location a qa-red step may write a test file to, or the
permitted location is a rule an executable check enforces. Measured hazard at `3cbebf5`, which the
change must close: `packages/core/test/x.test.ts`, `packages/core/x.test.ts` and
`packages/core/src/x.test.js` are collected by nothing today. The guard is **demonstrated red
against the pre-change configuration** before it is trusted over the post-change one.
Two constraints the change must respect and assert rather than observe:
 (a) the helper files under `packages/core/test/` — `corpus.ts`, `repo.ts`, `cli-stub.ts`, `env.ts`,
 `run-fixture.ts`, `strict-schema.ts` — stay non-suites because none is named `*.test.ts`, and
 `cli-stub.ts`'s own header currently cites the narrow include as the reason it is safe there; that
 reason changes and the new one is written down;
 (b) `packages/core/src/adapters/real-cli.probe.test.ts` keeps skipping without `QUORUM_REAL_CLI`,
 so no widening turns a paid live-CLI probe into an ordinary suite member. Asserted, because a
 BYOS-adjacent path is not left to inspection.

**AC-8 — `turbo run test` reaches every workspace package.**
Every package matched by `pnpm-workspace.yaml`'s globs declares `test`, `lint` and `typecheck`
scripts. A package with no `test` script is skipped by turbo in silence, which is the same failure
one layer up from AC-7. Derived from the globs, so a package added later is covered without anyone
remembering.

**AC-9 — The chain from "a new failing file appears" to "`pnpm test` fails" is stated once, with
each link naming the check that holds it.**
In `docs/04-architecture.md` §Testing: the include collects it (AC-6/AC-7), the package runs it
(AC-8), `$TURBO_DEFAULT$` puts it in the package's `test` hash so a cached pass cannot stand over it,
and CI forces regardless. The hash link is evidenced at the gate by `pnpm turbo run test --dry=json`
before and after adding a file, with the differing hashes recorded — an evidence criterion, named as
one rather than dressed as a test.

### CI gating

**AC-10 — The workflow's job set is asserted by identity.**
`packages/core/src/test-command.test.ts:470`'s `(jobs['spike']?.steps ?? [])` passes when the job is
absent. The workflow's jobs are now a register — at `3cbebf5`: `workspace`, `port-freeze-policy`,
`port-freeze-branch-scope`, `port-freeze-sha`, `spike`, `git-identity-sweep-bare`,
`git-identity-sweep-populated` — and a job added or removed fails until the register is updated.
Demonstrated: a fixture workflow with `spike` removed fails; the existing assertion is shown to pass
over the same fixture, so the defect is exhibited before it is closed.

**AC-11 — What each tick claims is stated, including that two suites are required.**
`docs/04-architecture.md` §Testing says that until the cutover the repository has two required
suites with different reach — the `workspace` job proves the port at library level, the `spike` job
proves the harness the port is being developed with, including the mock end-to-end through the
binary — and that the transfer of the CLI-driven half is Q-0010's. Line 66's parenthesis *"(the
30-check smoke test, ported)"* is corrected to what is true. Status line bumped with the date and
what changed.

**AC-12 — M2's done-when names the ticket that can satisfy it.**
`docs/06-development-plan.md`'s M2 bullet is split so the library-level half is Q-0054's and the
mock end-to-end through the binary is Q-0010's, with the count corrected from 30 to the figure
re-derived at the branch. Q-0054's own entry is rewritten to what shipped. Status line bumped.
*Subject to OQ-1 — this criterion is written on the recommended answer and moves with the ruling.*

### The freeze

**AC-13 — The witness is untouched.**
`git diff --name-only main...HEAD -- spike/` is empty, and `harness/port-charter.md`'s `freeze-sha`
is unchanged. Charter §3 restated as a criterion so it is checked at the gate rather than left to
the branch-scope job to discover, and so a reviewer has one line to verify rather than a policy to
re-read.

---

## Non-goals

Charter §6's blanket non-goals apply without restatement: another child's module; editing
`spike/**` (§3); fixing a defect found while reading the spike (§2); the cutover; the `quorum`
binary (Q-0010); persisting the event stream; anything on v1's exclusion list. Beyond those:

- **Porting `smoke.js`, `q0011-runs-cli.js` or `q0036-board-containment.js`,** or the binary half of
  the five mixed files. Charter §5. They get a `cli` verdict and nothing else.
- **Re-aiming any CLI-driven suite at core's public API.** Rejected by §5 by name: it changes what
  the suite tests, which is a behaviour change to the frozen witness under §2, and it destroys the
  independence that makes the witness worth having.
- **Translating the nine library-only files line for line into Vitest.** Their subjects are already
  carried by 18,957 lines the thirteen children wrote; a translation would duplicate them and would
  produce two descriptions of the same behaviour that can drift apart silently. *See OQ-2 — this is
  a scope ruling, not an assumption.*
- **Deleting the `spike` CI job, or `spike/`.** Q-0009, after Q-0010.
- **Fixing anything the parity audit finds `uncovered`.** An `uncovered` verdict is a finding with a
  reason and, where owed, a successor ticket id. Fixing it here is §2's "fixed in passing" wearing an
  audit's clothes.
- **Recording a new `freeze-sha`.** Q-0070 left that sequencing decision open deliberately; it is not
  taken in passing by the last child.
- **Any change to `spike/test/run.js`'s behaviour, or to the spike's discovery.** The spike keeps
  discovering; this ticket makes the workspace do the same thing.
- **A budget cap, a run lock, or anything Q-0039/Q-0040 own.**

---

## Open questions

**OQ-1 (blocking) — does M2's done-when sentence move, or is charter §5 reversed?**
The sentence *"The 30-check smoke test passes as a Vitest suite"* cannot be satisfied by this ticket
under §5's decision. Either it moves to Q-0010 (AC-12 as written), or §5 is reversed and Q-0054
waits for Q-0010 — which is a different, larger, later ticket. **Recommendation: move the sentence.**
§5's reasoning holds unchanged — sequencing behind unticketed work serialises the whole port behind
the one ticket that can prove any of it, and `packages/cli` is a one-line stub, so "wait for Q-0010"
has no estimable end.
*Owner: human, at the requirements gate.* Blocking on **scope**, not on authority: both answers are
implementable by `developer-generalist`, whose paths include `docs` and `harness`, and neither needs
a `docs/DECISIONS.md` entry, because §5 already decided and this is a living document catching up.
Naming that explicitly so this is not the seventh instance of a loop handed work no agent on its
route can perform.

**OQ-2 (blocking) — is the parity register the deliverable, or is a literal translation wanted?**
This requirement is written on the measurement that the library-level subjects are already covered
and that what is missing is the *record*. If the maintainer wants the nine library-only files
transcribed into Vitest regardless, the ticket is several times larger, produces two descriptions of
each behaviour, and duplicates work already paid for at $599.77. **Recommendation: the register.**
*Owner: human, at the requirements gate.* Blocking because it decides the size.

**OQ-3 (non-blocking) — fix the `jobs['spike']` guard here, or open a successor?**
It is a defect found while reading, which §2 says to report rather than fix — but §2's rule is about
defects found while reading **the spike**, and this one is in `packages/core/src/test-command.test.ts`,
in this ticket's own declared scope ("CI gating the port"), and it is precisely the property AC-10
exists to establish. **Recommendation: fix it here, under AC-10, with the defect exhibited before it
is closed.** Flagged because a reviewer could read §2 the other way and should be answering a
question rather than discovering one.

**OQ-4 (non-blocking) — widen `vitest.shared.js`'s include, or keep it narrow and enforce a location
rule?** Widening to `**/*.test.ts` is safe at `3cbebf5` — no helper under `packages/core/test/` is
named `*.test.ts`, and Vitest excludes `node_modules` by default — but that safety is currently an
observation, and `cli-stub.ts`'s header cites the narrow include as the reason it is safe where it
is. **Recommendation: widen, and turn the observation into AC-7(a)'s assertion.** The alternative —
keep the include narrow and enforce "red tests go in `src/`" — puts the rule somewhere a qa-red
step's prompt would have to carry it, which is a worse place than a glob.

**OQ-5 (non-blocking) — where does the guard live?** `packages/core/src/`, so Vitest collects it and
CI runs it. Stated as a question only because Q-0079 found a candidate proposing to put a guard
beside `.github/scripts/port-freeze-guard.test.mjs`, **a file nothing executed** — this project's own
failure class, one degree worse than the defects it guards against. `packages/core/src/` is the only
answer that survives its own criterion.

**OQ-6 (non-blocking) — does the register have a natural home beside `NOT_READ` and `MANIFEST`?**
`packages/core/src/turbo-inputs.test.ts` already holds two reviewer-facing registers of the same
shape. Keeping the parity register in its own file is recommended — it retires at the cutover and
`turbo-inputs.test.ts` does not — but the idiom should match theirs so a reviewer reads one form.

---

## Risks

**R1 — `harness/Q-0054/integration` does not exist.** `git branch --list '*Q-0054*'` is empty at
`3cbebf5`. Charter §8's first checklist item: `review` diffs
`harness/{id}/integration...harness/{id}/implement` and only `integrate`, which runs later, creates
the left endpoint. Forgetting it fails the run **after** the implementer has been paid — how Q-0035
lost $13.86. Since Q-0038 the preflight refuses before billing rather than after, so the cost is now
a failed run rather than a wasted implement step, but the run still fails. Create it before the
first chore run.

**R2 — the turbo-inputs guard will demand declarations, and knowing which in advance is worth a
paragraph.** Clause B refuses any repository-relative literal a suite names that is not covered by
the task's declared inputs, the workspace dependency edge, or `NOT_READ`. Already declared in
`packages/core/turbo.json`: `spike/test/**`, `spike/src/**`, `.github/workflows/ci.yml`,
`.github/scripts/**`, `turbo.json`, `pnpm-lock.yaml`. **Not declared and likely to be read by the new
guards:** `pnpm-workspace.yaml`, `vitest.shared.js`, `packages/*/vitest.config.js`,
`packages/*/package.json`. `vitest.shared.js` is in root `turbo.json`'s `globalDependencies`, which
answers clause A but says nothing about clause B's register. **Verify against the guard, not against
this paragraph** — this is a prediction, and Q-0072 spent five implement rounds on four correct and
different majors in exactly this area.

**R3 — a guard written to prove coverage is the easiest place to write a check that cannot fail.**
Rounds 4 to 6 of Q-0050 alone produced five assertions that could not fail, each written by the hand
that had just been shown the same mistake. AC-4 exists for this reason and its three demonstrations
are not optional: an audit whose failure mode is silence is worse than no audit, because it reads as
coverage.

**R4 — the register is a hand-audited judgement and will be wrong somewhere on the first pass.**
Mapping `q0034-chore-preflight.js` or `q0034-dry-run.js` to their counterparts is a reading of two
suites, not a computation. That is why AC-2 makes the *classification* machine-derived and only the
*counterpart naming* human — the half that can be computed is computed, and the half that cannot is
what a reviewer reads. Expect the review round to move rows; that is the round doing its job.

**R5 — cost, and where the §9 signal actually is.** The port has billed $599.77 across thirteen
children, mean $46.14; §9's per-child threshold is $40 and its fourteen-child projection was $550,
both already exceeded, while the threshold §9 calls the one to watch — more than three chore runs on
one child — has never tripped. A register-shaped ticket should come in under the mean. If it needs
more than two implement rounds, that is the signal the cut was wrong, and it should be said at the
gate rather than absorbed.

**R6 — an implementer reading only the ticket body will think the routing is open.** The body offers
three routes and cites §6; §5 decided it and the body never mentions §5. This requirement is the only
place the two are joined. If the implement prompt carries the body and not this document, the routing
gets re-litigated at cost.

**R7 — every count in this document is a measurement with a short half-life.** 151 assertions, 69
files, 18,957 lines, seven CI jobs, 53% entangled: all at `3cbebf5`. Two of the eight entangled files
arrived in the four days before this run. Re-derive at the branch.

**R8 — widening the include changes what runs, which is the point and also the hazard.** At `3cbebf5`
no `*.test.ts` exists outside any package's `src/` — verified. If that stops being true between now
and the branch, the widening newly executes something nobody chose to execute. Re-measure before
changing the glob, not after.

**R9 — this ticket makes an assertion about a job it will later ask to be deleted.** AC-10 pins the
`spike` job; the cutover removes it. That is deliberate, is why AC-5 requires the retirement line,
and should not be read at the cutover as a guard resisting its own removal.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | No code path, test, fixture or example accepts a key, and none is added. One live interaction with the pillar: AC-7(b) requires `real-cli.probe.test.ts` to keep skipping without `QUORUM_REAL_CLI` after any include change, asserted rather than observed, so no widening turns a paid live-CLI probe into an ordinary suite member. `check()`'s refusal order is untouched (register row 1, Q-0046's). |
| **Worktree safety** | n/a to the change. The chore run itself writes only in `.harness/worktrees/harness__Q-0054__implement` and merges to `harness/Q-0054/integration`; nothing here writes to the user's working tree. |
| **Gate behaviour** | n/a to the change — no gate semantics are touched, no exhaustion-gate behaviour, nothing `--auto` can reach. The route is `requirements → chore → human gate`; both blocking open questions are answered at the requirements gate, before an implementer is paid. |
| **File format and its schema** | No new file format and no schema change. The parity register is TypeScript in a test file rather than YAML or JSON **deliberately**: a malformed row is a compile error, and `tsc --noEmit` sees it before Vitest does. Nothing under `backlog/`, `.quorum/` or `harness/` changes shape. |
| **Lint rules** | No new flow-lint rule; `lintFlow` is untouched. ESLint covers `packages/**/*.ts` including tests, so the new guard is linted and `@typescript-eslint/no-deprecated` applies to it — relevant because it will call Vitest and Node APIs. `spike/**` stays outside ESLint entirely. |
| **Cold-clone impact** | None in either direction. No change to `npx quorum`, `harness init`, the README, or anything a stranger reads in their first 30 minutes. AC-11 and AC-12 change two documents a maintainer reads and an adopter does not. |
| **Product-agnostic** | No product name enters the repository. The register names spike files, `packages/**` files and CI jobs only. |
| **Cross-vendor rule** | Satisfied by the route: `chore.yaml`'s review step is cross-vendor and the panel spans vendors. Nothing in this change touches the rule or its lint. |
| **Errors are explicit** | The guards fail closed by construction — a missing register entry, a counterpart that does not exist, a verdict the recomputation contradicts, and a job absent from the workflow each fail rather than defaulting to clear. No new runtime error path is added, because no production code changes. |
