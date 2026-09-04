# Q-0095 — chore run 2, implement iteration 2

A revision round. `review/chore/run-2/chore-iter-1.md` returned **revise** with two majors and no
nits. **Both are real, both are fixed, and both were demonstrated red before green** rather than
read — which on this ticket is not a formality, since the whole deliverable is scaffolding and the
recorded failure mode of scaffolding here is a check that cannot see its subject.

No criterion was disputed and no erratum is owed. Nothing outside the two files below moved.

---

## Major 1 — every invocation inherited the caller's environment

> `end-to-end.test.ts:178` — Every invocation inherits the caller's complete environment, including
> `MOCK_ALWAYS_PASS`, `MOCK_ALWAYS_FAIL`, `MOCK_FAIL_WRITE`, `MOCK_RUN_HISTORY_PROFILES`, and other
> mock controls. […] the verdict is not solely a property of the commit as AC-9 requires.

**Accepted in full, and it is the sharper of the two findings** — it is AC-9's own subject arriving
through the line that exists to make AC-1 work. `spawnSync` was given
`env: { ...process.env, ...env }`, so a shell that had exported one switch decided what the mock
answered, and the three convergent behaviours of AC-5 — the requirements backward edge, the
architect bounce, the flaky developer's scoped retry — are precisely the assertions a forced verdict
destroys. The suite would then have reported *a chain that never converged* as one that had.

### What shipped

**A `STEERING` register, derived rather than typed** (`end-to-end.test.ts:189`). It is every
environment variable the product's own code reads, read out of the four files that read one:
`adapters/claude.ts` and `adapters/codex.ts` through the existing `refusedBy` derivation,
`adapters/mock.ts`, and `backlog/backlog.ts` for the owner default at `:190`. Thirteen names — the
mock's nine switches, the three the two adapters refuse, and `USER`.

Derived for the reason `refusedBy` already is: **a typed list goes on excusing a name nothing reads
and misses the one added next week**, and this list's job is to be complete. It also cannot be typed
here even if that were wanted — `frame.source.test.ts`'s AC-12 admits exactly one file in this
package that spells one of the two the adapters refuse, and spelling them would either turn that
guard red or force its self-exclusion to grow into a filter.

**Two clauses, because one is blind to two of its switches.** `numericSwitch`
(`packages/core/src/adapters/mock.ts:156`) takes the variable's name as an argument, so a
`process.env.X` scan cannot see `MOCK_CACHED_INPUT_TOKENS` or `MOCK_CACHE_WRITE_INPUT_TOKENS`. Every
switch is nevertheless spelled at its call site, which is what the second clause anchors on. The
blindness is asserted rather than described: the register test requires the `process.env.X` scan of
`mock.ts` **not** to contain `MOCK_CACHED_INPUT_TOKENS`, so if the mock ever reads both directly,
the second clause loses its subject and the test says so instead of the clause sitting there unused.

**`sanitised(base, overrides)`** (`:215`) — `base`, minus every name in the register, plus what the
call declares. Two shape decisions, both stated in place:

- **A deny-list, not an allow-list.** `GIT_CONFIG_GLOBAL` and its siblings *must* reach the child:
  `pnpm sweep:git-identity` sets them to prove both suites pass with no resolvable identity, and a
  child that could not see them would be exempt from the one check AC-9's own *Test:* clause names.
  An allow-list would have quietly bought immunity from Q-0079.
- **`base` is a parameter, not `process.env` read inside.** That is what lets the removal be
  demonstrated over an environment a test composed, rather than over this machine's — which sets
  none of the thirteen and would therefore prove nothing. *"A check is not established by reading
  it"* (2026-08-29).

**The environment each invocation was handed is recorded, not trusted.** `Invocation` gains
`steering`, the subset of the register the spawned process actually carried and with what value. The
sanitiser is one line of code; AC-9 is a claim about twelve processes, and this is what lets a test
assert the claim over the environments the run really used rather than over the helper that built
them.

### Three assertions, each closing a different way this could be wrong

1. **`the register […] is derived from the product, and is the size it should be`** — identity over
   the mock's nine (which this file may spell), a derivation against `refusedBy` for the rest, and
   the blindness proof above. A tenth switch is a red test somebody reads.
2. **`no invocation inherited one: each carried only what its own call declared`** — the twelve
   labels written out, `development: { MOCK_DEV_FLAKY: '1' }`, `adapters` carrying exactly the
   variables it set itself, and every other label `{}`. Written out rather than mapped from
   `chain.ran`, so a thirteenth invocation must be classified here instead of arriving with an empty
   expectation of its own.
3. **`the sanitiser discriminates`** — over a composed environment carrying all thirteen: the
   declared override survives, no other switch does, `PATH` is untouched, and the fixture
   environment is asserted to carry all thirteen so it cannot discriminate nothing.

### Demonstrated, not asserted

| | | |
| --- | --- | --- |
| fixed `invoke`, ambient `MOCK_ALWAYS_PASS=1` | **32 passed** | the fix works |
| `invoke` reverted to `{ ...process.env, ...overrides }`, same ambient | **3 failed / 29 passed** | the hazard is real |

The three failures are exactly the reviewer's claim:

- `the loop did not turn exactly once: expected [ '▸ head-of-product' ] to have a length of 2 but got 1` — AC-5(a)
- `expected [] to have a length of 1 but got +0` — AC-5(b), the architect bounce
- `expected { init: { …(2) }, …(11) } to strictly equal { init: {}, … }` — the new recording

That last one is the point: the recording fails **even where the forced verdict happens not to move
an assertion**, so a switch that steers something no criterion looks at is still caught.

---

## Major 2 — the working-tree snapshot was stale, and the test presented it as the end-to-end result

> `end-to-end.test.ts:245` — The only `git status --porcelain` snapshot is taken immediately after
> solutioning, before `qa-red` and `development`. Consequently, AC-6's final working-tree safety
> assertion cannot detect pollution introduced by either later flow […]

**Accepted.** The criterion's own word is *end to end*, and the reading was of a repository two
flows short of green. The spike takes its reading at the same point (`smoke.js:79`) and falls back
to a bare `!fs.existsSync(tmp/src)` at green (`:98`) — a translation that carried the reading across
and then labelled it the end-to-end result claimed more than the reading supports.

### What shipped

`Chain.afterSolutioning` keeps the three genuinely solutioning-specific facts — the contracts
branch, the worktree directory, the registration — and the porcelain reading moves out to
`Chain.porcelain`, which is now **two readings**: `afterSolutioning`, and `atGreen`, taken the
moment `development` returns and the stage reads `green`. Both are asserted, which additionally
catches pollution one flow introduces and a later one clears.

**Where the green reading is taken is a decision, and it is stated in place.** It is taken
immediately after `development` rather than at the end of the fixture, because the `validate` block
below writes a schema and two artifacts into the repository root — the *test's* files, not the
product's — and a reading after them would have to excuse three paths by name, which is how a
working-tree check stops having a subject. What that leaves outside the reading is `board`,
`adapters` and `validate`: **none of them runs a flow**, AC-6's claim is about what a run writes,
and the last run has finished by that line. Recorded here rather than left for a reader to derive.

**Each reading is asserted non-empty before it is filtered.** An empty reading gives the filter
nothing to remove, so both clauses would pass over a `git status` that had reported nothing at all —
and both readings are taken over a repository holding at least the scaffold and the ticket folder,
so empty is a failure rather than a clean tree. This is the shape `smoke.js:459` gets wrong and the
one AC-8 forbids, arriving through a filter instead of an existence guard.

### Demonstrated, not asserted

A file written into the fixture repository's root after `qa-red` — pollution a later flow could
introduce:

| shape | verdict |
| --- | --- |
| **two readings (shipped)** | **1 failed** — `the run wrote into the user's working tree, at green: expected [ '?? MUTATION.txt' ] to strictly equal []` |
| **one reading (pre-fix)** | **32 passed** |

The pre-fix shape reports a fully green suite over a polluted working tree. That is the finding
reproduced rather than accepted on its wording, and the message names *which* of the two readings
caught it.

The vacuity clause was shown to fire separately: with `solutioningPorcelain` forced to `''`, one
test fails with `the reading after solutioning is empty, so it discriminates nothing`.

---

## File by file

**`packages/cli/src/end-to-end.test.ts`** — +172 / −13, the whole of the change.

- Header gains one paragraph: nothing the shell sets reaches a spawned process, and why an inherited
  switch is a property of the shell rather than of the commit. The three sentences AC-1's own test
  requires present (`mock.ts:16–20`, `role:task`, `charter §2`) are untouched.
- `Invocation` gains `steering`; `EMPTY` gains `{}`.
- `Chain.afterSolutioning` loses `status`; `Chain.porcelain` is new, with its two readings and the
  reason there are two.
- `STEERING`, `sanitised` and `SET_BY_THE_FIXTURE` are new, placed beside the `refusedBy` derivation
  they extend.
- `invoke` builds its environment through `sanitised` and records what it handed over; its third
  parameter and `mustPass`'s are renamed `env` → `overrides`, because they are no longer the
  environment.
- The `adapters` invocation uses `SET_BY_THE_FIXTURE` instead of the bare literal, so the invocation
  and the assertion about what it was handed cannot drift into agreeing about a variable neither of
  them set.
- AC-6's working-tree test asserts both readings; AC-9 gains three tests. **29 → 32 tests.**

**`packages/cli/src/package.test.ts`** — +2. Two entries in the `OUTSIDE` audit, for the two files
the new derivation reads: `packages/core/src/adapters/mock.ts` and
`packages/core/src/backlog/backlog.ts`. `DECLARED` is unchanged and that is deliberate — everything
under `packages/core` arrives through the `^test` edge this package's workspace dependency creates,
so declaring either would over-declare, which is the reasoning the register's own doc comment
already carries.

---

## What I deliberately left alone

- **No production code.** Nothing under `packages/core`, `packages/shared` or `packages/cli/src`
  outside the two test files. In particular **no mock reset export** — non-goal 5, and `mock.ts`
  names it a charter §2 behaviour change. The sanitiser is the answer to the same problem from
  outside the module.
- **Nothing under `spike/`.** Ground rules 1 and 2. The register's five totals are therefore
  expected unmoved, and were **re-derived rather than adjusted** as ground rule 5 requires the *act*:
  220 binary-only, 2739 both, 2469 library-only, 5428 total, **55%** — observed, unchanged.
- **`spike-parity.test.ts` is untouched this round.** Iteration 1 wrote the row and the two
  `q0033-surface.js` clauses re-aimed at Q-0101; this round changes no scenario the row describes,
  so re-writing prose that is still accurate would be churn.
- **The `validate` fixture files stay at repository-relative paths**, as the spike has them. Moving
  them outside the repository would let the green reading be taken at the very end, but it changes a
  translated invocation's shape for a property no criterion states. The boundary is written into the
  code instead.
- **Q-0068's *"Harness runs on subscription OAuth only"* and the `owner` default at `backlog.ts:190`
  are preserved**, not repaired (ground rule 3, non-goal 4). The owner default is now *read* by the
  derivation, which is the opposite of closing it: stripping `USER` means an assertion about
  `owner=` can only be satisfied by an owner the fixture passed.
- **One pre-existing lint warning is not fixed**: `@quorum/core` reports an unused
  `eslint-disable` directive at `backlog/backlog.ts:276`. It is a warning, `lint` exits 0, and the
  file is outside this change — reported rather than tidied in passing.

---

## Verification

Dependencies installed first (`pnpm install --frozen-lockfile`, `npm install --prefix spike`) — both
were already present in this worktree from iteration 1, so neither suite is reported green over an
uninstalled tree.

| what | result |
| --- | --- |
| `pnpm turbo run test lint typecheck --force` | **21/21 tasks, 0 cached**, all successful |
| `@quorum/cli` suite | **22 files, 504 tests passed** |
| `npm test --prefix spike` | **19/19 test files passed**, unreduced |
| `pnpm sweep:git-identity` | green — both probes discriminate, both suites executed and green with no resolvable identity |
| register totals | 220 / 2739 / 2469 / 5428 and 55%, **re-derived unmoved** |

**The sweep is the one that mattered most this round**, and it is why the sanitiser is a deny-list:
had it been an allow-list, `GIT_CONFIG_GLOBAL` would not have reached the spawned binary and this
suite would have become the one file in the workspace that Q-0079's oracle could not judge — while
passing.

**AC-11's cost figure, re-measured rather than carried:** the file is **5.02 s and 4.98 s** over two
runs, against **5.09 s** before this round. Unchanged within noise, which is expected — the three new
tests spawn nothing and read data the fixture had already captured. `SPAWN_TIMEOUT_MS` (60 s) and
`FIXTURE_TIMEOUT_MS` (90 s) are unchanged and their measured justifications still hold, no
invocation having been added or removed.

**Environment row.** This worktree is the *bare* row — it carries neither `.harness/worktrees` nor
`.quorum/runs`, verified. The populated row is the forced re-run on `main` after the merge, which is
RK-8's second half and **still owed at the gate**; nothing here can perform it.

`git status --porcelain` in this worktree shows exactly the two modified files and no fixture
leftovers.

---

## Registered, not acted on

- **The three mutations above are not committed.** Each was applied, run, and reverted; the file's
  committed state is the green one. The evidence is the recorded failure messages, each naming the
  test, the break and the assertion that fired — the shape §3.2 AC-5 will require of Q-0101.
- **`board`, `adapters` and `validate` are outside the green porcelain reading**, for the reason
  stated above and in the code. If a later change makes any of the three write, this reading will
  not see it.
- **Nothing implies a decision entry**, and none is proposed.
