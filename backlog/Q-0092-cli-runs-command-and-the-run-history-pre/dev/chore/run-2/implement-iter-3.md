# Q-0092 — implement run 2, iteration 3

Revision round. One major finding from `review/chore/run-2/chore-iter-2.md`, addressed in full. **No
production code changed in this round** — the diff is three test files and one register row.

---

## 1. The finding, and what it was right about

> **major: `packages/cli/src/runs.test.ts:442`** — AC-9 explicitly requires translating
> `q0011-run-history.js:121–124` through a separate reader process, but this test calls `invoke` in
> the same process and its comment defers process separation to Q-0095. […] It also conflicts with
> `spike-parity.test.ts:160–161`, which claims this binary scenario is carried by this test file.

Accepted, and both halves of it. The spike scenario is two claims, not one:

```js
const detail = spawnSync(process.execPath, [path.join(spike, 'bin/harness.js'), 'runs', m.run_id, '--project', f.root], …);
assert.equal(detail.status, 0, detail.stderr);
assert.match(detail.stdout, /simulated/);
assert.match(detail.stdout, /codex/);
assert.match(detail.stdout, /input_tokens|tokens/i, 'separate reader process omitted billed failure usage');
```

The **rendering** claim — a failed occurrence's usage is printed rather than dropped — is what
`invoke` can make. The **process-separation** claim is what makes the number evidence: a reader
sharing nothing with the run printed it, so it came off disk. Round 2 carried the first, deferred the
second, and let the register go on saying the row was carried. That is the register decaying into a
list of paths that excuses nothing while still reading as coverage — the failure clause (d) of
`spike-parity.test.ts`'s own audit exists to prevent, arriving through prose instead of through a
path.

**The conflict the reviewer names is the more important half.** A deferral written into a test
comment is invisible to the audit: `binaryCarriedBy` checks existence and collection, and neither
sees a file that is collected and asserts less than it claims.

---

## 2. Where the spawn went, and why not in `runs.test.ts`

Not a preference — the repository has already ruled it, and the ruling is in the file the code went
into. `build.test.ts`'s Q-0098 banner:

> a separate file spawning the same path would intermittently meet an emit that had just been
> removed, and the flake would read as a code defect rather than as a fixture defect. Q-0098's merged
> requirement measures this (§3 M-12) and names exactly two safe shapes in AC-15(c) — assert inside an
> isolated copy, or put the real-workspace assertions here.

`removeEmit()` has **four** call sites in that file (AC-8 `:761`, AC-9 `:995`, AC-23 `:1233`, Q-0098
AC-25 `:1868`, counted at the tree), and `vitest.shared.js` sets no `fileParallelism: false`, so
Vitest runs test *files* in parallel workers. A spawn of `packages/cli/dist/quorum.js` from
`runs.test.ts` would race those deletions. So the real-workspace spawn is in `build.test.ts`, which
is safe shape (b), and `runs.test.ts` keeps its in-process rendering block.

The three alternatives were considered and rejected with reasons rather than by preference:

- **Spawn from `runs.test.ts` anyway.** The flake above, in the file whose whole job is to be the
  command's evidence.
- **A new `runs-binary.test.ts`.** Same race, one file further away from the reasoning that explains
  it — and it would introduce a third mechanism where AC-15(c) names two.
- **A separate process running the TypeScript source** (node type-stripping plus
  `--conditions=quorum-source`). It avoids `dist` and introduces a fourth execution mechanism nobody
  has ruled on, to prove a property the emit already proves. Refused as scope.

---

## 3. Changes, file by file

### `packages/cli/src/build.test.ts` (+121 / −1)

- `import { execFileSync, spawnSync } from 'node:child_process'` — `spawnSync` because the spike
  asserts `detail.status === 0` **with `detail.stderr` as the message**, and `execFileSync` throws on
  a non-zero exit rather than reporting one. The translation keeps the spike's shape.
- A banner naming what the block is, what the spike claims, why it is in this file, and what half is
  *not* here — the producing run, which is the engine's and is carried by
  `packages/core/src/run-history/writer.test.ts` and its five neighbours on the register's
  `carriedBy` for the same file.
- `BILLED_FAILURE`, the manifest such a run leaves behind: one `adapter` occurrence,
  `status: 'failed'`, `error: { category: 'adapter', message: 'simulated failure' }`, and
  `usage: { vendor: 'codex', input_tokens: 100, output_tokens: 20, … }`. Written out rather than
  produced, because producing one means running a flow — which is neither this package's job nor this
  file's subject, and the file a separate process reads is the same either way.
- **`Q-0092 AC-9 — the detail view reads the file, not a run's memory`**, two tests:
  1. `runBuild()`, a fixture project under `os.tmpdir()`, then
     `spawnSync(process.execPath, [binTarget(), 'runs', 'Q-0011-1', '--project', root], { cwd: PACKAGE })`.
     Asserts `status === 0` with `stderr` as the failure message, `/simulated/`, `/codex/` and
     `/input_tokens=100\b/` — the spike's four assertions, with its loose `/input_tokens|tokens/i`
     tightened to the exact field, because a `tokens=` alternative is satisfied by the very collapse
     Q-0037 ruled against. Two further assertions carry that ruling across the boundary:
     `/output_tokens=20\b/` present and `unpriced_steps` absent.
  2. **A discriminator.** Same binary, same spawn, a project whose runs root is empty: non-zero
     status and no `input_tokens=100`. Without it the test above cannot tell "the binary read the
     fixture" from "the binary answered from somewhere else and happened to print those words" —
     the shape AC-15's own `no-such-target.js` block already uses in this file.

  `--project` rather than `cwd` inside the fixture is deliberate and commented: `cwd` stays
  `packages/cli`, whose own repository carries a runs root, so an answer from the wrong store would
  name runs this fixture never wrote.

  Both use `isolated.push(…)`, the file's existing `afterAll` cleanup, rather than a new mechanism.

### `packages/cli/src/runs.test.ts` (+13 / −5, comments only)

- The module header gains a paragraph saying that one of the four translated spike scenarios is
  carried **across two files**, which half is where, and why.
- Its closing sentence no longer reads *"Nothing here spawns the binary — the binary's own end-to-end
  suite is Q-0095's"*. Q-0095 is the mock end-to-end suite; the one spawn **Q-0092** owes is now
  discharged and named.
- The test at `:442` (now `:451`) drops the Q-0095 deferral and points at its counterpart. It is
  kept, not replaced: it asserts a different fixture's values and is the block AC-9's other clauses
  sit in.

### `packages/core/src/spike-parity.test.ts` (+3 / −3)

- `q0011-run-history.js`'s `binaryHalf` prose loses *"The process-separation half of that assertion is
  the binary's own and is Q-0095's"* and gains what is true: carried across two files because the
  assertion claims two things, `runs.test.ts` the rendering and `build.test.ts` the process
  separation, **"Nothing of it is owed."**
- `binaryCarriedBy` becomes `['packages/cli/src/build.test.ts', 'packages/cli/src/runs.test.ts']`.
- The `binaryCarriedBy` claimant identity at `:1534` moves — **demonstrated red against its
  superseded value first**, per R-1 and the Q-0091/Q-0096 precedent:

  ```
  FAIL  src/spike-parity.test.ts > (i) Q-0091 — and the entries that claim one are the commands the children have shipped
  AssertionError: expected [ …(4) ] to strictly equal [ …(4) ]
  -   "q0011-run-history.js → packages/cli/src/runs.test.ts",
  +   "q0011-run-history.js → packages/cli/src/build.test.ts, packages/cli/src/runs.test.ts",
      "q0011-runs-cli.js → …"   (unchanged)
  ```

  One row moved and three did not, which is what the identity exists to show.

**Not touched, and named so the reviewer does not have to check:** the counterpart arithmetic at
`:1434–1435` (`new Set(all).size === 31`, `all.length === 53`) is computed over `carriedBy`, and this
round adds no library counterpart. The five line totals — `binary-only 220`, `both 2739`,
`library-only 2469`, `total 5428`, share `55%` — are unmoved, because no file under `spike/` was
edited. Both were asserted at their current values by the green run rather than assumed.

---

## 4. The guard was shown to have a subject

A new assertion that cannot fail is this repository's most-recorded defect, so the spawn was
mutation-tested rather than observed green. `formatOccurrenceUsage`'s `input_tokens=` was changed to
`tokens=` — the exact re-collapse Q-0037 ruled against — and the suite re-run:

```
× B2 (per-step) — the four measures at their own values, and no roll-up field anywhere   (runs.test.ts)
× a billed failure's usage is rendered from the file, not from a run's memory             (runs.test.ts)
× a separate process renders the failed occurrence's vendor, message and usage            (build.test.ts)

AssertionError: a separate reader process omitted the billed failure's usage:
  usage: codex: cost=n/a tokens=100 output_tokens=20 cached_input_tokens=n/a cache_write_input_tokens=n/a
```

The third failure is the new one, and it is the whole chain proving itself: the mutation was
compiled by `runBuild()`, written into `dist/`, executed by a separate process, and caught by the
assertion. The mutation was then reverted and `git diff` confirms `runs.ts` is byte-identical to the
reviewed commit.

---

## 5. Reported and not fixed

**`build.test.ts`'s Q-0098 banner undercounts its own emit deletions.** It says the file *"deletes
that directory twice — AC-9's replay and AC-23's present-and-absent comparison both call
`removeEmit()`"*. Measured: four sites, in AC-8 (`:761`), AC-9 (`:995`), AC-23 (`:1233`) and Q-0098
AC-25 (`:1868`) — and at least three of them existed when the sentence was written, one of them
inside Q-0098's own block.

Not fixed, and the reasoning is stated rather than assumed: the banner's *argument* does not depend
on the number (any deletion at an unpredictable moment makes a cross-file spawn racy), it is a
landed comment on another ticket's surface, and editing it is tidying code I was not sent to change.
What I did instead is refuse to transcribe it — my own banner states the four sites, names them, and
says in place that it counted rather than inherited the figure. *A measurement copied from a document
is not a measurement* (Q-0058), applied to the document three hundred lines above mine.

**Everything AC-12 registers is unchanged**, and no preserved defect was repaired in passing: the
list/detail symlink disagreement, `vendorTokenTotal`'s null, `ProjectNotFoundError`'s `harness`
(Q-0100's), `manifestShapeError`'s cast, and `runDetailJSON`'s always-empty `warnings`.

**Round 1's finding stays fixed.** `runs.ts:263` is still `if (token)` rather than
`token !== undefined`, with the authority comment naming `spike/bin/harness.js:471`, and
`runs.test.ts`'s empty-positional parity test is untouched.

---

## 6. Verification

Installed first — `pnpm install --frozen-lockfile` (*"Already up to date"*, 177 ms) and
`npm install --prefix spike --no-audit --no-fund`.

| check | result |
| --- | --- |
| `pnpm turbo run test lint typecheck --force` | **21/21 tasks, 0 cached** |
| workspace tests | `@quorum/cli` **273 passed** (271 before this round, +2), `@quorum/core` 1300 passed / 2 skipped, `@quorum/shared` 150 passed, four scaffolds 1 each |
| `npm test --prefix spike` | **19/19 files passed**, untouched |
| `node spike/bin/harness.js lint` | **6/6** flows clean |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"*, both checkout shapes |

**One lint warning, pre-existing and not mine:** `packages/core/src/backlog/backlog.ts:276`, *"Unused
eslint-disable directive (no problems were reported from `no-control-regex`)"*. **0 errors.** The
file's last change is Q-0080's `8f31fb5`, `git diff` over it is empty, and nothing in this ticket
touches ESLint configuration — so it is inherited from `main` rather than introduced here.

### §10's six-status table, re-executed through the built binary this round

`pnpm turbo run build --force`, then `node packages/cli/dist/quorum.js runs … --project <fixture>`:

| invocation | expected | observed |
| --- | --- | --- |
| `runs` over a clean store | 0, listing printed | **0**, header + `claude: cost=$1.000 tokens=120 unpriced_steps=0` |
| `runs` over an empty store | 0, `· no runs found` | **0**, `· no runs found` |
| `runs` over a store with a damaged sibling | 1, listing **and** warning | **1**, listing then `! bad: malformed manifest.json (Expected property name or '}' …)` |
| `runs Q-9999`, clean store | 0 | **0** |
| `runs Q-0011-1` beside a damaged sibling | 0, detail, sibling unnamed | **0**, detail printed, `stdout.includes('bad') === false` |
| `runs ../secret --json` | non-zero, nothing disclosed | **1**, `{"error":"unknown run or ticket: ../secret"}` |

The fifth row is AC-11's observable form executed rather than read, and it is the one this round's
new test now also holds automatically.

**Not done here, stated rather than implied:** the second environment row. `integrate` runs in a
worktree with neither `.harness/worktrees` nor `.quorum/runs`, and the forced re-run on `main` after
the merge is the human's at the gate (Q-0072's closing finding). Everything above was run in this
implement worktree.
