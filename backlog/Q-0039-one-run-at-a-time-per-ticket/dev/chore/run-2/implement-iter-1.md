# Q-0039 — implement report (run 2, iteration 1)

*One run at a time per ticket. Thirteen criteria, all implemented. Verdict: `proceed`.*

---

## 1. What shipped

A run takes a **run lock** on its ticket before it does anything it would later have to undo, and
gives it back in a `finally` that covers every way out of `run()`. A second run against the same
ticket refuses and names the holder; it never waits and never reclaims. `--dry` takes none and is
refused by none.

The claim is one file — `.quorum/locks/<ticket-id>.json` — created by one exclusive
`fs.openSync(file, 'wx')`, carrying the eight fields AC-10 declares, and removed only while it still
carries the token this run wrote.

**892 insertions across 11 files, one of them new.** `engine.ts` accounts for 366 of the changed
lines and almost all of that is re-indentation: `git diff -w` on that file shows exactly three
substantive changes — the import, the acquisition block, and the `finally`. That command is the
cheapest way to review it.

---

## 2. File by file

### `packages/shared/src/constants.ts` — the two names the literal lives under

`LOCK_ROOT = '.quorum/locks'` beside `RUN_HISTORY_ROOT`, and `runLockPath(ticketId)` which returns
`.quorum/locks/<id>.json`. Two reasons the literal is here rather than in `core`, and only the first
is the usual one: every cross-package value lives here, **and** the run-history folder in `core` may
spell the `.quorum` namespace exactly once — in its exclusion pattern — so a second literal there
turns `run-history.source.test.ts:259` red. AC-2 says so and M-5 is why.

The lock root is a **sibling** of the runs root, not a child: `readRunsDir` lists what is under the
runs root, so a lock inside it would be an entry `quorum runs` had to learn to skip.

### `packages/core/src/run-history/writer.ts` — the claim, the refusal and the release

- **`excludeRunState(repoDir)`**, module-private, holding the folder's one
  `ensureExcluded(repoDir, '.quorum/')` call. Two callers — `acquireRunLock` and
  `initialiseRunHistory` — and one literal. This is AC-4 as M-5 rules it: a second call anywhere in
  `core` fails `:259` or `:320`, and AC-12 forbids editing either.
- **`RunLockClaim`** (repoDir, ticket, run, flow) and **`RunLock`** (`path`, `release(host)`), both
  exported because `engine.ts` holds the handle across a `try`.
- **`acquireRunLock(claim)`**: `isOneName(ticket.meta.id)` first (AC-3, reusing
  `backlog/confine.ts`'s predicate rather than respelling it), then the exclusion, then the
  directory, then the exclusive create. On `EEXIST` it reads the holder and refuses; on an
  unreadable holder it refuses differently and names the path; on any other create failure it
  refuses naming the condition. No message carries an imperative or a backtick.
- **`release(host)`**: reads the file, compares the token, unlinks. A file already gone is silence —
  nothing left to give back is not a failure. A file carrying somebody else's token is left in place
  with one warning. An unlink that throws costs one warning and nothing else; the run's status, its
  history entry and its exit code are what it earned (R-7).
- **`readLockRecord`** checks all eight fields against `LOCK_FIELDS`, so a partial file is damaged
  rather than half-read. It never answers *no lock* and never *my lock*.
- **Two registrations the criteria name by id**, added as comments and nothing else: `runIdOf` builds
  a directory name from the same unvalidated ticket id (AC-3's "registered and not touched"), and
  the `EEXIST` message's closing imperative predates decision 082 and stays (AC-7's "registered and
  not fixed"). The `writer.ts:257` disclaimer is left as written, with a note saying what Q-0039
  closed and why the sentence is still true of a caller that allocates a run directory without a
  lock.

### `packages/core/src/engine/engine.ts` — where it is taken and where it is given back

`const lock = dry ? null : acquireRunLock({ repoDir, ticket, run: runId, flow: flow.name! });`
immediately after `nextRunId`, then `try { … } finally { lock?.release(…) }` around the rest of the
function.

Three things a reviewer should check rather than take on trust:

1. **The order.** After the stage precondition, which is a pure read, so a run refused on its stage
   touches the repository not at all. Before `branchHead`, the `runs.log` start line, run history and
   any worktree.
2. **The rationale is M-2's, not iteration 1's.** `nextRunId` reserves nothing, so the reason to
   acquire early is not that a number would be consumed; it is that the branch head, the run number
   and the worktree must each be facts about a run that is already the only one. The JSDoc says
   that.
3. **`:376–379`'s comment and the completed finish are untouched** (R-1). The `finally` carries no
   `catch`, so the success-path finish is still outside one and is not re-entered.

Release emits through the run's own `emit`, and only when something anomalous happened — so the
terminal event is still the last event on every ordinary run, which is what `engine.test.ts` already
asserts.

### Tests

- **`packages/core/src/run-history/writer.test.ts`** (+252): two new describes covering AC-2, AC-3,
  AC-4, AC-5's ownership rows, AC-7 and AC-10 through the module's own API.
- **`packages/core/src/engine/run-lock.test.ts`** (new, 16 tests): AC-1's ordering through spies at
  the four seams, AC-5's six exits driven through `routing.runStep` as `engine.test.ts` drives AC-8,
  AC-6's "changes nothing", AC-8's two dry rows.
- **`packages/cli/src/end-to-end.test.ts`** (+70): AC-11. The fixture writes a lock and spawns the
  built binary — the first holder is a file, the second is a real process. **No two-process race**,
  which AC-11 refuses by name because Q-0102 is parked on that shape.
- **`packages/shared/src/docs.test.ts`** (+65) and **`constants.test.ts`** (+28): AC-13 and the
  shared half of AC-2.

### Docs

`docs/GLOSSARY.md` gains **Run lock**, with the four "what it is not" clauses AC-13 asks for — not a
**gate**, not **Confinement**, not **Containment**, and **advisory**. `docs/04-architecture.md`
principle 6 gains the rule beside the worktree lifecycle and the backlog boundary; §Run history on
disk names the second thing `core` writes under `.quorum/`; the status line records Q-0039 and
2026-09-09.

---

## 3. Criteria

| | | |
| --- | --- | --- |
| AC-1 | acquisition point | `engine.ts`; `run-lock.test.ts` AC-1 ×3 |
| AC-2 | one file, one exclusive syscall, ticket as subject, advertised run number | `writer.test.ts` ×4, `constants.test.ts` |
| AC-3 | id proven one path segment | `writer.test.ts` AC-3, five hostile ids, tree unchanged |
| AC-4 | exclusion before the first lock file, through the one call site | `writer.test.ts` ×2 — outcome and order |
| AC-5 | release is a `finally` over six exits, ownership-checked, failure warns | `run-lock.test.ts` ×8, `writer.test.ts` ×2 |
| AC-6 | second run refuses, names the holder, changes nothing, no id gap | `run-lock.test.ts` ×3 |
| AC-7 | `FlowError`, no new class, no CLI change, no imperative | `writer.test.ts` AC-7; exit union already pinned |
| AC-8 | `--dry` takes none, is refused by none | `run-lock.test.ts` ×2 |
| AC-9 | a stale lock still refuses, never reclaimed | no pid branch exists to test — see §6 |
| AC-10 | eight declared fields; damaged refuses | `writer.test.ts` ×2, five damaged shapes |
| AC-11 | proof across a real process boundary | `end-to-end.test.ts` AC-11 |
| AC-12 | the two Q-0049 guards pass unchanged | verified byte-identical; both mutations run |
| AC-13 | glossary and architecture | `docs.test.ts` ×3 |

**AC-7's exit-code half needed no new test.** `packages/cli/src/exit.test.ts:70` already asserts the
union by identity — `{ SUCCESS: 0, ERROR: 1, ABORTED: 2, UNDECIDED: 3, SIGNAL: 130 }` — so a sixth
member fails there today. Adding a second copy would be a check that could not fail independently.

---

## 4. Shown red before green

Nine mutations, each reverted. This is the part I would want a reviewer to re-run rather than read.

| mutation | what went red |
| --- | --- |
| release removed from the `finally` | **9 of 16** in `run-lock.test.ts` — all seven exits |
| …and the same mutation, in the CLI suite | `failure-paths.test.ts` *"the second attempt gets its own run id"* |
| no lock taken at all | 5 in `run-lock.test.ts`; `end-to-end.test.ts` dies at the fixture |
| refusal message drops the pid | AC-11 alone, naming `pid 424242` |
| exclusion moved after the create | AC-4's order test alone — its outcome sibling stays green |
| release ignores the token | AC-5's *"a lock a human cleared and a successor took"* |
| `isOneName` check removed | AC-3, naming `"../../escape"` |
| acquisition moved below the start line | 4 in `run-lock.test.ts` |
| `--dry` takes a lock | both AC-8 rows |
| a second `ensureExcluded(repoDir, '.quorum/')` in the folder | `:259`, by name |
| a quoted `.quorum` in `engine/engine.ts` | `:320`, naming `engine/engine.ts` |

**The second row is worth more than the others.** M-10 predicted that the shipped failure-path
fixture would detect a lock leaked on the `failed` exit, for free. That was a claim about a test
nobody had run under the condition; it is now a measurement, and it means the `failed` row has an
independent witness outside this ticket's own suite.

**The fifth row is the one that justifies AC-4 having two tests.** Reversing the order leaves the
exclusion present by the time anything reads it, so the behavioural assertion passes; only the
ordering assertion sees the window in between, which is the window turbo hashes.

---

## 5. Registers moved, each a visible act

Five landed registers refused this change until it was classified. Every one of them is machinery
working as designed, and none of the two AC-12 guards is among them:

1. `run-history.source.test.ts` — writer's export identity, two → **three** functions and four →
   **six** types.
2. …its import allow-list — `node:crypto` and `node:os` (token and hostname), and
   `/backlog/confine.js` (`isOneName`, reused rather than respelled).
3. …its interface-field count, 56 → **62**, with the enumeration updated. Eight declared lock fields
   add six, because the record a lock file carries is module-private.
4. `turbo-inputs.test.ts` — one new `READ_BASES` entry for `writer.ts` (`file`), eight for
   `writer.test.ts`, five for `run-lock.test.ts`, two `ESCAPING_LITERALS` entries for the hostile
   ids, and one self-entry for the key I added to that register.
5. `end-to-end.test.ts` — the steering register, fifteen → **sixteen** labels, and the run-flow
   identity list.

The register also fails the other way, and did: an entry for `held.path` that turned out not to be a
read base was reported as stale and removed. That is Q-0073's *"no register entry can go dead
unnoticed"* firing on the first ticket to add one since.

---

## 6. Judgement calls, stated so they can be attacked

**AC-12's *Test:* clause says "both tests pass with no diff to that file", and I have diffed that
file.** The normative half — *`:259` and `:320` are not edited, weakened or exempted* — is met and
verifiable: both tests are byte-identical in the diff, and both mutations fire by name. The literal
reading of the *Test:* clause is unsatisfiable, because adding any export to `writer.ts` necessarily
moves the export-identity register **in the same file**, and that register exists precisely so the
addition is a visible act. Under *"a criterion's Test: clause bounds the instrument"* (Q-0067 E-1) I
read the normative half as binding. No erratum is owed unless a reviewer disagrees, in which case
this is a gate question and not another round.

**AC-7 asks for "a source assertion that the message contains no backticked shell imperative", and I
assert over the rendered message instead.** A source assertion is not writable here: the refusal
templates are themselves backtick-delimited template literals, so a scan for a backtick in the source
matches the template's own delimiters. The assertion over the produced sentence has a subject the
source form does not, and it also covers the six advice words. Stated rather than quietly
substituted.

**AC-9 has no branch to test, and that is the point.** Nothing in the code reads the recorded pid
except to print it, so there is no code path that could reclaim. The test asserts a lock naming an
impossible pid still refuses with AC-6's message shape, and the source half — *no path unlinks a file
it did not create* — is structural: the only `unlinkSync` is inside `release`, behind the token
comparison.

**One accepted cost.** `ensureExcluded` now runs twice per run — once at the claim, once at history
initialisation — where the second call reads the exclude file and appends nothing. One extra
`git rev-parse --git-path` per run. The alternative is to drop the call in `initialiseRunHistory`,
which would make run history depend on a lock having been taken first, and that function is drivable
without an engine by design and is tested that way.

---

## 7. Deliberately left alone

- **All thirteen non-goals.** No waiting, no queueing, no `--force`, no lock-inspection command, no
  reclaiming, no repository-wide lock, no rendering on `board` or `runs`, no zod schema for the lock
  file (§6 of the requirement rules that one).
- **`runIdOf`'s unvalidated id** and **`writer.ts:259`'s in-`core` imperative** — both registered in
  comments as AC-3 and AC-7 require, both untouched.
- **A pre-existing lint warning I did not cause and did not fix.**
  `packages/core/src/backlog/backlog.ts:330` reports *"Unused eslint-disable directive
  (no problems were reported from 'no-control-regex')"*. That file is not in my diff, `pnpm lint`
  exits 0, and the engineering rules say a defect in code I was not sent to change is reported rather
  than repaired in passing. Reported here.
- **The `q0050.source.test.ts` authority register.** I added no `Why:` line to any engine file, so
  its map and its count of eighteen preserved-defect markers are untouched. The lock's reasoning is
  ordinary JSDoc citing the decision by title and date.

---

## 8. Verification

- `pnpm turbo run lint typecheck test --force --continue` — **21/21 tasks, 0 cached**, 1443 core +
  621 cli + 166 shared tests, 2 skipped (pre-existing).
- `pnpm sweep:git-identity` — **green**, workspace suite executed with no resolvable git identity,
  both phases, run from this linked worktree (Q-0058's fix holding).
- `pnpm turbo run build --force` — 3/3, and `pnpm exec quorum lint` reports **6/6 flows** through the
  built binary; `quorum board` renders.
- The nine mutations in §4.

**Not done, stated rather than implied.** I could not run a by-hand probe of the refusal in a
throwaway repository: the sandbox refuses writes outside this worktree, and creating a nested git
repository inside it would have polluted `turbo-inputs.test.ts`'s own inventory. The built-binary
evidence is therefore the AC-11 fixture, which spawns a real process and whose assertion I
demonstrated red by dropping one fact from the message. **GO-3's both-row verification and GO-4's CI
check are the human's at the merge**, as that requirement says.

---

## 9. For the gate

- **GO-1 is discharged**: decision 086 landed before this run started, and the code cites it by title
  and date at three sites rather than transcribing it.
- **GO-2 is discharged**: Q-0114 exists, opened at the requirements gate, and `acquireRunLock`'s
  docblock points at it by id for the successor question.
- **Nothing in this change needs a second decision entry.** The one reading that could earn one —
  AC-12's *Test:* clause — is recorded in §6 as a reading rather than a rule, and it changes no
  behaviour.
