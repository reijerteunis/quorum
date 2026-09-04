# Q-0095 — implement report, chore run 2, iteration 1

*Round 1. No prior review report in this ticket's folder, so this is the first implement round.*

**What shipped:** §3.1 of `requirements/merged.md` — eleven criteria — on the gate's **split** ruling.
§3.2 is Q-0101's, whose folder exists (`backlog/Q-0101-the-mock-end-to-end-s-gate-rollback-and-`,
verified) and which AC-10's *split* row is written against.

Both suites green, forced, at the end of the round:

| | |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached**, 57.3 s |
| `@quorum/cli` suite | **22 files, 501 tests** (was 21 / 472) |
| `npm test --prefix spike` | **19/19 files** |
| `node spike/bin/harness.js lint` | **6/6** |
| `pnpm sweep:git-identity` | green in **both** checkout shapes |

---

## 1. Files, and what each one does

### `packages/cli/src/end-to-end.test.ts` — new, 569 lines

The suite. A `beforeAll` builds the binary in an isolated copy of this workspace, creates a fixture
repository, and walks the chain in **twelve separate operating-system processes**: `init`, `lint`,
`ticket new`, the wrong-stage refusal, `requirements`, `solutioning`, `qa-red`, `development`,
`board`, `adapters`, and `validate` twice. Twenty-nine tests then assert over what it recorded —
each invocation's status and both streams, the `stage:` read back from `ticket.md` after each command
that could move it, and the git facts snapshotted at the moment the solutioning run finished.

Criterion by criterion:

| | where | note |
| --- | --- | --- |
| **AC-1** | 3 tests | no import of `../test/invoke.js`, and — wider than the criterion's words — the file's *only* relative import is `../test/workspace.js`, which forbids a direct handler call without a list to maintain. The header cites `mock.ts:16–20`, the `role:task` key and charter §2. A synthetic-positive clause shows both predicates discriminate. |
| **AC-2** | 1 test | the spawned path is under `os.tmpdir()`, is not `path.resolve(PACKAGE, bin.quorum)`, and all three of the artifact, the copy and the fixture are outside this package. |
| **AC-3** | 2 tests | no `spike/` and no bare `'spike'` segment anywhere in the file — two shapes, because a read can be written either way — each shown to discriminate over an assembled sample. |
| **AC-4** | 6 tests | the five stage readings as an identity; `init` and `ticket new`'s products; the wrong-stage refusal; the run-scoped requirements candidates; the solution and tasks and the merged contracts; the red phase; and the four files on the integration branch. |
| **AC-5** | 3 tests | its own test each, exactly as the criterion asks. |
| **AC-6** | 3 tests | the worktree the step said it cut, given back directory-and-registration with the branch kept; nothing outside `backlog/` and `harness/`; no `src/`; the install marker's basename. |
| **AC-7** | 4 tests | `lint`, `board`, `adapters`, `validate`. |
| **AC-8** | 2 tests | a scan for skip shapes and for `if (fs.existsSync(` guarding a block, plus the module-scope POSIX refusal. |
| **AC-9** | 4 tests | the five runs by identity and all on `--adapter mock`; `--owner` supplied explicitly; the one commit's identity fields; the fixture's own branch name. |
| **AC-10** | `spike-parity.test.ts` | below. |
| **AC-11** | measured | §4. |

### `packages/cli/test/workspace.ts` — new, 221 lines

`isolate()`, `buildIn()` and the twelve symbols they need, moved out of `build.test.ts` and imported
back by it. This is **OQ-3's recommendation taken**: R-2 rules that file's *"nothing was extracted
from it"* a description of what Q-0098 did rather than a contract, and two implementations of a
sixty-line workspace copier is the drift this repository keeps finding. It registers no hook —
`disposeIsolated()` is exported and each importer registers its own `afterAll`, so a helper cannot
own a lifecycle its importer did not write.

The JSDoc moved with the code, including the `Q-0097 E-1/E-2` citation, which is the sentence a
reader meeting E-1 first needs.

### `packages/cli/src/build.test.ts` — modified

Three changes and no behaviour: the definitions above became an import; the AC-15(c) banner's last
sentence is **corrected in place** rather than left standing false, citing R-2 and OQ-3 so the move
does not read as a violation of it; and the local `isolated` array — which also held pack
destinations, install targets and cache homes — is renamed `temporaries`, because after the copier
left it was named after something it no longer holds. 57 tests, unchanged, still green.

### `packages/cli/src/package.test.ts` — modified

Two new `OUTSIDE` entries for the two adapter sources the new suite reads, and four `why` strings
re-attributed from `build.test.ts` alone to the copier both suites now share. **No `DECLARED` entry
was added, and R-7 is confirmed rather than assumed:** everything the new file opens outside this
package — `pnpm-lock.yaml`, `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.nvmrc`,
`packages/*/src/**` — is already declared or already a root `globalDependency`.

### `packages/cli/src/init.test.ts` — modified, one sentence

OQ-4, taken only where a sentence had become misleading. `:16` said *"the end-to-end suite is
Q-0095's"* in the future tense; it now names the file and says the suite takes AC-15(c)'s **other**
named shape, so the claim about `packages/cli/dist` is unchanged rather than superseded. The other
four citations (`board.test.ts:25`, `gate.ts:21`, `run.test.ts:17`, `runs.test.ts:14`) are **left
alone**: each says `build.test.ts` may spawn *the emit*, which §0.6 rules literally true and which
this ticket does not touch.

### `packages/core/src/spike-parity.test.ts` — modified (AC-10)

- `smoke.js` gains `binaryCarriedBy: ['packages/cli/src/end-to-end.test.ts']`, and its `binaryHalf`
  is rewritten to say which scenarios are carried and to name **Q-0101** for the failure, gate and
  rollback half. It no longer says Q-0010 or Q-0095 owes anything.
- `q0033-surface.js`'s `binaryHalf` ends `— Q-0101` instead of `— Q-0095`.
- Clause **(i)** — the one Q-0099's comment designates as the identity that grows with each child —
  gains the ninth row.
- Clauses **(l)** at `:1617` and **(p)** at `:1694` are **re-aimed** `/Q-0095/` → `/Q-0101/`, each
  with the note the Q-0094 precedent asks for.
- The `:1714` clause is **rewritten, not removed**: `.toBeUndefined()` → `.toStrictEqual([…])`. Its
  surrounding comment is corrected too — `smoke.js`'s binary half is no longer *whole* Q-0095's.
- Two new tests, both labelled **(r) Q-0095**: the claim move, and the totals.

**The five totals are re-derived and unmoved** — `binaryOnly 220`, `both 2739`, `libraryOnly 2469`,
`total 5428`, `share 55%` — which is the expected answer, ground rules 1 and 2 keeping everything
under the spike untouched. *"It did not move" is a measurement*, so it is asserted rather than
skipped. The new clause additionally pins that `smoke.js`'s **verdict stays `split`** and that it
stays in the entangled bucket: a verdict describes the spike file's own text, which translating it
does not change — the distinction Q-0091's E-2 made when it added a field rather than a fourth
verdict.

---

## 2. What was shown red, and how

Nine mutations. Every one was run, and each is named with the signature it produced.

| # | mutation | result |
| --- | --- | --- |
| **M-1** (AC-1) | added `import { invoke } from '../test/invoke.js'` | **1 failed / 28 passed** — *"the in-process driver is imported, so the counter is shared"* |
| **M-2** (AC-2) | deleted `packages/cli/dist`, ran the file | **29/29 passed** — the second half of AC-2's test |
| **M-3** (AC-3) | renamed `spike/` away, ran the file | **29/29 passed** — the property the cutover turns on |
| **M-4** (AC-4) | `qa-red.yaml` `produces: red` → `solutioned` | file **FAIL**: *"development exited 1 … ticket T-0001 is at stage "solutioned", flow "development" consumes "red""* |
| **M-5** (AC-4) | `development.yaml` `produces: green` → `reviewed`, with `review.yaml` `consumes:` moved to match so the graph still lints | the **stage-sequence clause itself** red, with the diff `- "green" / + "reviewed"` |
| **M-6** (AC-7) | `development.yaml` `produces: reviewed` alone | `harness lint` catches it — *"flow review: target flow development dies at stage reviewed; it never returns to green"* — and `run` refuses on the same report |
| **M-7** (AC-10) | both re-aimed clauses reverted to `.toMatch(/Q-0095/)` | clauses **(l)** and **(p)** red |
| **M-8** (AC-10) | `binaryCarriedBy` removed from the `smoke.js` row | **three distinct signatures**: clause (i) `[…(8)]` vs `[…(9)]`, the rewritten `:1714` *"expected undefined to strictly equal [Array(1)]"*, and clause (r)'s `not.toStrictEqual` |
| **M-9** (AC-10) | `smoke.js`'s successor reverted to `— Q-0095` | clause (r): *"the smoke row says Q-0095 owes what Q-0095 carried"* |

M-4, M-5 and M-6 are three different mutations of one criterion because the first two answers were
not the interesting one. **M-4 is caught by the fixture's refusal, not by the stage assertion** —
the chain is tightly coupled, so any single stage transition change is caught either by the flow
lint or by the next flow's `consumes` refusal, before the sequence is ever compared. M-5 is the
mutation that reaches the `toStrictEqual` and shows it has teeth. Recorded as three rather than one
because *"a check is not established by reading it"* cuts both ways: the criterion's own suggested
mutation does not exercise the clause it appears to.

Every template mutated was restored, and `git status --porcelain` afterwards shows nothing under
`packages/cli/templates/` or `spike/`.

---

## 3. What went into the tree and back out

Three scratch files (`q95-probe.mjs`, `q95-probe2.mjs`, `q95-mutate.mjs`) and the two directories
`.harness/worktrees` and `.quorum/runs` were created during the round and **removed before the
report**. The final `git status --porcelain` is exactly the six intended paths.

---

## 4. AC-11 — the cost, measured

| | |
| --- | --- |
| copy the workspace (`isolate()`) | **0.11 s** |
| forced build of the three emitting packages (`buildIn(root, '--force')`) | **2.05 s** |
| the twelve invocations | **2.21 s** |
| the fixture end to end | **4.4 s** |
| the file, as Vitest measures it | **4.8 s – 5.9 s** across six runs |

**What it adds to `pnpm test` is 0.2 s, not 5 s**, and that is the number that matters. Measured
directly rather than inferred: `@quorum/cli`'s suite is **29.13 s** with the file and **28.91 s**
without it, because `build.test.ts` is the long pole at 28.8 s and Vitest runs test files in
parallel workers. The whole workspace `turbo run test --force` is 56–58 s across four runs, before
and after.

**The timeouts are chosen from those numbers and the reason is in the source**, which is what AC-11
forbids doing by analogy. `SPAWN_TIMEOUT_MS = 60_000` against the slowest invocation at 0.7 s
(`development`: two waves, a scoped retry, three worktrees, two integrations) — roughly eighty
times. `FIXTURE_TIMEOUT_MS = 90_000` against 5.9 s — fifteen times, and what it has to absorb is a
cold `tsc` on a loaded runner, the only part of this that is not milliseconds. Neither is
`build.test.ts`'s `300_000`.

**No finding for the gate here.** 0.2 s does not change the cost of `pnpm test` in this repository.

---

## 5. Findings — reported, not fixed

**F-1 — the requirement's `mock.ts` citation is two lines long, and it is corrected here.**
§0.5 and AC-1 both cite `packages/core/src/adapters/mock.ts:16`–`:22`. Measured: the paragraph about
the module-scoped counter runs `:16`–`:20`; `:21` is blank and `:22` is the module's own preservation
note, a different subject. The file cites `:16–20` and the AC-1 assertion requires that string, with
the correction stated in place. Small, and worth naming because it is the class this cut has now
recorded eight times: *a measurement copied from a document is not a measurement*.

**F-2 — AC-7's `adapters` claim could not be written the way the spike writes it, and this is the
finding that changed the shape of the work.** `smoke.js:128` sets the three variables by name.
`frame.source.test.ts` AC-12 asserts that **exactly one file** in `packages/cli/**` matches any of
its BYOS spellings and that *"the self-exclusion is load-bearing, and it is the only one"* — so a
suite that typed those names would turn red the guard proving this package has no key path at all,
or would force that exclusion to grow into a filter. Neither the requirement nor the ticket body
anticipated it.

The route taken is derivation: `refusedBy(vendor)` reads the `process.env.X` occurrences out of each
adapter's own `check()` guard, and the test asserts the counts (**1** for claude, **2** for codex)
so a third read added to either is a red test somebody looks at rather than a fixture that quietly
sets a different set. It is stronger than a literal — a renamed variable moves the assertion with
it — and the full refusal line is asserted as an equality, Q-0068's *"Harness"* wording included and
preserved.

**F-3 — one of AC-7's clauses cannot fail, and the test says so rather than hiding it.**
`run.ts` lints the whole flow directory before it loads a flow, so a scaffold that failed `lint`
stops the chain at the first `run` and no test in the file is ever reached. `expect(lint.status)
.toBe(0)` therefore can only ever read 0. It is kept, because it is the criterion's own word, and it
is **labelled in place as the half that is not falsifiable**; beside it the flow list is derived from
the directory the scaffold actually wrote and every entry is required to appear with its tick, which
*is* falsifiable — a green `lint` that examined fewer files fails it.

**F-4 — where "exits 0" is asserted, and why it is asserted once.** `mustPass` throws for the steps
the next one depends on (`init`, `ticket new`, the four runs), naming the step and quoting its
output. A test restating those statuses would be an assertion that could not fail, which is the
Q-0050 class. So the tests claim what each step *produced*, and the steps whose failure does **not**
stop the chain — `lint`, `board`, `adapters`, `validate`, the wrong-stage refusal — go through the
recording path instead, keeping their statuses claims a test can lose. `lint` and `board` were moved
from `mustPass` to that path for exactly this reason during the round.

**F-5 — a fixture failure reports the tests as *skipped*, and that reads like the shape AC-8
forbids.** When `beforeAll` throws, Vitest prints `Test Files 1 failed` and `Tests 29 skipped`. The
file's verdict is **FAIL** and the process exits 1, so nothing reports success — but the word is
misleading enough that it is written into `mustPass`'s own JSDoc rather than left for a reader to
work out.

**F-6 — `smoke.js:23` takes the machine's default branch, and the translated form does not.**
`execSync('git init -q …')` resolves `init.defaultBranch` from ambient git configuration, so the
fixture's base branch is whatever the machine says — this checkout answers `master`. AC-9 forbids a
verdict that depends on *"a git config value it did not set"*, so the new fixture uses
`git init -q -b main` and asserts that `harness.yaml` records it. **The spike is not fixed**: ground
rules 1 and 2, and it is latent there rather than broken — the spike asserts no branch name.
Registered as a live instance of Q-0079's class inside the regression suite it protects, for
whoever writes the cutover ticket.

**F-7 — `build.test.ts`'s `isolated` array held two kinds of directory.** After the copier moved,
the name described only half of what was in it. Renamed `temporaries`, with the two registers and
their two owners stated. Eleven mechanical call sites; no behaviour.

---

## 6. Gate obligations — what I did not do, and why

- **GO-1** (the cutover ticket) and **GO-2** (the seven `harness/architecture.md` role-table
  assertions) are Q-0101's close and the human's respectively. Untouched.
- **GO-3** — the `781`/`151` figures in `docs/06-development-plan.md` and in the ticket body — is
  **deliberately not done**, and not only because §7 routes it to the human. `backlog/` is
  discarded by the engine, and the plan's bullets are rewritten by hand at each plan pass: Q-0094's
  **E-3(a)** records that an implement step editing this exact page turned a harmless revert into a
  review finding. The corrected pair, for whoever makes the pass: **780 lines, 158 `assert(` sites,
  of which 76 transfer** — re-verified at HEAD this round.
- **OQ-3** taken (extract). **OQ-4** taken only where a sentence had gone stale (§1). **OQ-5**
  taken (one file, one private fixture, tests sequential behind one `beforeAll`). **OQ-6** is
  §3.2's and therefore Q-0101's.

## 7. Non-goals honoured

Nothing under `spike/` was written — the two mutations that touched it were a rename and its
reversal, and `git status` is clean there. No known defect was closed in passing: Q-0068's
*"Harness"* wording is asserted **verbatim** as the refusal it still is, `backlog.ts:190`'s `owner`
default is worked around with an explicit `--owner` rather than fixed, and Q-0090's unknown-command
zero and Q-0100's `harness`-spelled sentences are untouched. No mock reset export, no test-only
switch, flag or production branch; no `fileParallelism: false`; no domain helper ported into
`packages/cli`; no CLI output, exit code, schema or flow semantic changed. The library half is not
re-translated.

## 8. Verification, in both environment rows

Per Q-0072's closing finding. This worktree carries **neither** `.harness/worktrees` nor
`.quorum/runs` — the bare row — where the final forced run is 21/21 tasks 0 cached, 501 cli tests,
spike 19/19, `harness lint` 6/6. The populated row was created for the sweep
(`mkdir -p .harness/worktrees .quorum/runs`), `pnpm sweep:git-identity` ran green there as well as
bare — *"both suites executed and green with no resolvable git identity"* in each — and both
directories were removed afterwards.

**`integrate` will run this in a worktree that has neither**, which is the row this round already
covers. The merge should still be re-run forced on the base branch afterwards (RK-8): this ticket
adds the workspace's second-largest spawning suite, and its replay is exactly the kind a cached tick
would hide.
