# Q-0070 — `runCommand` loses no output, and an overflow is not reported as a timeout

*Requirement, 2026-08-28. Surfaces: `spike/src/fanout.js` and `packages/core/src/fanout/command.ts`
with their tests, plus one register entry in `packages/core/src/turbo-inputs.test.ts`. A
`docs/decisions/` entry is **named, not written** — the implementer may not append one. No CLI,
daemon, flow, adapter or `harness/` surface. Route: **chore**, argued in OQ-2 rather than assumed.*

---

## Problem

The `maintainer` reads `tests=ok` in `runs.log` and treats it as a suite that passed. Two things can
be behind that line instead, and neither looks different from the outside.

The common one is a lie in the other direction. A test runner writes progressively, so when its
output crosses Node's 1 MiB `maxBuffer` the child is killed with the `SIGKILL` both trees configure —
and `timedOut` tests that signal. `spike/src/engine.js:1046` therefore reports *"the test command did
not finish within 15 minutes and was killed"* about a command that finished in twenty-six seconds,
turns it into `tests=invalid`, and sends the reader to `commands.install` (`:1067`) to fix an
environment that was never broken. It fails closed, so it costs a run and a diagnosis rather than a
merge.

The rare one is the expensive one. A child that writes megabytes in a single call and then calls
`process.exit()` discards its own unflushed stdout; one pipe buffer — 65,536 bytes — is all that is
ever delivered. If that child exits 0, `runCommand` returns **`code: 0` with 64 KiB of a 2 MiB
output**, `integrate` writes `tests=ok`, and `expect: pass` is satisfied by a suite whose output was
thrown away. Nothing about the result is unusual: the captured length is far *below* `maxBuffer`, so
no length check catches it either.

There is a third cost no earlier record names. In the overflow cells the child's **exit status is
destroyed too**: a child that writes 2 MiB and exits 3 is reported as `code: 1`, because it was
killed before it could exit. Today's failure mode is not only lost output — it is a lost verdict.

This is `integrate`'s own reflex. `runCommand` is where every configured `commands.test` and
`commands.install` runs, which is the same class of defect as Q-0065 and Q-0071: a green tick
claiming more than it examined.

## User stories

- **`maintainer`** — *I want `tests=ok` to mean the suite ran and its whole output was read, so that
  a green `integrate` is a reason to merge rather than a reason to re-run the suite by hand.*
- **`maintainer`** — *I want a command that produced too much output to say so, so that I am not sent
  to fix a fifteen-minute timeout that took twenty-six seconds.*
- **`adopter`** — *I want my own `commands.test`, whatever it prints, to be reported by what it did
  rather than by how it happened to write, so that my first `integrate` is evidence.*

## What was verified for this requirement

Re-derived 2026-08-28 against the **real `runCommand`** imported from `spike/src/fanout.js`, Node
**v24.15.0**, three runs per cell. The ticket instructs that this subject not be re-derived from any
earlier *record*; it has been measured afresh instead, per this repository's rule that an inherited
measurement is re-run before it enters a durable record. Scratch files were written under `/tmp` and
nothing in the repository was modified.

### The matrix reproduces exactly, and two cells nobody had run

| child writes 2 MiB | `code` | `timedOut` | captured | 3/3 |
| --- | --- | --- | --- | --- |
| monolithic, ends naturally, status 0 | 1 | **true** | 1,114,112 B | ✓ |
| monolithic, ends naturally, **status 3** | **1** | **true** | 1,114,112 B | ✓ |
| monolithic, `process.exit(0)` | **0** | false | **65,536 B** | ✓ |
| monolithic, `process.exit(3)` | 3 | false | 65,536 B | ✓ |
| progressive 2048 × 1 KiB, ends naturally | 1 | **true** | 1,049,600 B | ✓ |
| progressive, `process.exit(1)` | 1 | **true** | 1,054,720–1,063,936 B | ✓ |
| **900 KiB, ends naturally** | 0 | false | 921,600 B | ✓ |

**This is the first time a record of this subject has survived re-measurement** — every figure in the
ticket body holds. Two rows are new. Row 3 measures the false green *directly* rather than by
inference from a non-zero variant: `code: 0`, 64 KiB of 2 MiB, no marker of any kind. Row 2 shows the
status loss described above. Only the progressive byte counts vary between runs; every outcome is
stable 3/3.

The conjunction the ticket identifies is confirmed: monolithic **and** `process.exit()`. And that
cell is not a `maxBuffer` overflow — the parent never receives more than one pipe buffer, so no
ceiling is involved. **Raising `maxBuffer` cannot reach it.**

### File capture, measured on the same children

`execSync` with `stdio: ['ignore', fd, fd]` onto two files in a `mkdtemp` directory, result built by
reading the files back:

| | pipe capture (today) | file capture |
| --- | --- | --- |
| monolithic + `process.exit(0)` | `code 0`, 65,536 B | `code 0`, **2,097,152 B** |
| monolithic + `process.exit(3)` | `code 3`, 65,536 B | `code 3`, **2,097,152 B** |
| monolithic, natural | `code 1`, `timedOut`, 1,114,112 B | `code 0`, **2,097,152 B** |
| progressive, natural | `code 1`, `timedOut`, 1,049,600 B | `code 0`, **2,097,152 B** |
| progressive + `process.exit(1)` | `code 1`, `timedOut`, ~1.05 MB | `code 1`, **2,097,152 B** |
| 900 KiB | `code 0`, 921,600 B | `code 0`, 921,600 B |

All 3/3 identical. **It is the only shape that closes the false-green cell**, because a write to a
file is synchronous on POSIX and `process.exit()` cannot discard it.

Three properties the landed tests depend on survive it, measured rather than assumed:

- **The timeout path is intact.** `sleep 30` at `timeoutMs: 300` returns after **305 ms** with
  `signal: 'SIGKILL'` and `code: 'ETIMEDOUT'` — so `timedOut`'s three disjuncts and their source-text
  pin (`fanout.source.test.ts:148`) stay exactly as they are. Better: once an overflow no longer
  kills, `SIGKILL` means **only** a timeout, so *"an overflow is never reported as a timeout"* holds
  by construction rather than by a new flag.
- **Partial output on timeout is preserved** — 102,400 bytes, identical to today.
- **Ordering is preserved.** `printf OUT; printf ERR >&2; exit 1` yields `"OUTERR"`, so
  `command.test.ts:28–32` stays green.

### The headroom the ticket flags as unmeasured — now measured

`npm test --prefix spike && pnpm turbo run test --force` (`harness/harness.yaml:39`, as Q-0065
configured it), combined stdout+stderr: **69,119 bytes**, 927 lines, exit 0, 7 tasks / 0 cached /
26.1 s, `@quorum/core` alone 709 passed and 2 skipped. That is **6.6% of the 1 MiB ceiling**, and
within **1.2%** of the 69,951 figure the Q-0065 body carried — unusually, the inherited number was
right.

A *failing* run is the unbounded case and nobody had bounded it. Vitest 4.1.11 **deduplicates
identical errors** — 20 identical failures print one diff and `[1/20]`, 3,153 bytes total — while 20
*distinct* failures cost **16,490 bytes, ≈800 bytes each**. So every core test failing distinctly is
roughly 0.6 MiB on top of the base: reachable on a bad day, not on an ordinary one. The caveat that
survives measurement is that single tests here assert over whole file contents and long corpora, so
one such failure can print far more than 800 bytes.

### Repository facts, checked rather than assumed

- **The freeze does not apply**, verified by running the guard rather than by reading it:
  `HALF=branch-scope BRANCH=harness/Q-0070/integration` exits **0** with *"Q-0070 is not one of
  Q-0009's fourteen children — the freeze does not apply"*. `freeze-sha` is `not-yet-recorded`, so
  that half is skipped and this ticket's `spike/src` change cannot trip it for the remaining port
  children — **while the SHA stays unrecorded** (Risk 6).
- **Three call sites, one of them latent.** `engine.js:600` (a `script` step), `:1036`
  (`commands.install`), `:1042` (`commands.test`). No shipped flow declares `type: script`, so the
  first is latent; install and test are live. `packages/core`'s copy has no caller yet — the engine
  is Q-0050/Q-0053.
- **The ticket's lifecycle claim is wrong.** *"It brings a lifecycle nothing here has today"* — both
  trees already ship it: `packages/core/src/adapters/codex.ts:95,152,166` and
  `spike/src/adapters/codex.js:27,78,87` do `fs.mkdtempSync(path.join(os.tmpdir(), …))` with
  `fs.rmSync(…, { recursive: true, force: true })` on **both** exit paths, and
  `spike/src/adapters/index.js:153,165` does the same for the probe sandbox. There is a shipped
  pattern to copy, and its guard registration is already written.
- **Where the files may not live.** `commitAll` runs `git add -A` (`fanout.ts:287`), so a capture
  file written inside the worktree would be committed onto the step branch. `os.tmpdir()` is the
  answer, and clause C's limit 4 already accounts for it.
- **Five landed pins, not three.** The ticket names `command.test.ts:14,23`,
  `fanout.source.test.ts:45` and `:146`. Two more: `fanout.source.test.ts:114`, whose `allowed`
  import list is `['node:child_process', 'node:fs', 'node:path', 'yaml', '@quorum/shared',
  '../git/git.js']` and has **no `node:os`**; and `:106`, `expect(fields.length).toBe(15)`, which
  moves if `CommandResult` gains a field.
- **The input guard needs an entry.** `turbo-inputs.test.ts` clause C4 refuses any read whose base
  is not a literal, a route or a registered entry; file capture adds one, so
  `READ_BASES['packages/core/src/fanout/command.ts']` needs a line, with
  `'packages/core/src/adapters/codex.ts'`'s `lastPath` entry as the template.
- **What each surface shows.** `dev/integration.md` is already bounded — `testReport`
  (`engine.js:505–516`) keeps 24,000 bytes head and tail with an omission marker. `output.txt` is
  **not**: `persistArtifact` (`:429`) writes the string whole. `ctx.lastIntegration` takes
  `out.slice(-3000)` (`:1071`), so after the fix the agents finally read a long run's *end* — its
  failure summary — instead of its middle.
- **The spike has nothing to correct.** `spike/src/fanout.js`'s `runCommand` comment does not quote
  `commands.test`, so the stale quotation is `command.ts:55` alone (AC-8).
- **No spike-side test names `runCommand` today.** The spike suite is one file per ticket registered
  in `spike/test/run.js`; `q0063-stdin-epipe.js` is the precedent for a defect fix of this shape.

## Acceptance criteria

1. **The capture design is written down where the next reader meets it, with its lifecycle.** The
   requirement is written against **removing the ceiling** (OQ-1): stdout and stderr are directed to
   files in a directory unique per invocation under `os.tmpdir()`, and the result is built from the
   complete files. The directory is removed on **every** exit path — success, non-zero, timeout and
   throw — following `adapters/codex.ts:95,152,166` rather than inventing a second pattern. The
   JSDoc states the property (`no ceiling`) rather than a number.
2. **The result does not depend on the child's write shape, on `process.exit()`, or on whether Node
   kills it before it exits.** All three, because each has been proposed as the discriminator and
   only the conjunction is. Asserted as the table above, not as a spot check: a large-output command
   that exits 0 returns **`code: 0` with complete output**, one that exits non-zero returns **its own
   status** with complete output, and both hold under both write shapes and both ending modes.
3. **An overflow is never reported as a timeout, and the real timeout path is unweakened.**
   `command.test.ts:34–48`'s `sleep`-based timing assertions stay as they are, `timedOut` keeps all
   three disjuncts and its source-text pin, and a timed-out command still returns the partial output
   it produced. The report states which of these hold by construction — after the fix `SIGKILL` can
   only mean a timeout — and which are asserted.
4. **The under-ceiling case still returns cleanly.** The 900 KiB child returns `code: 0` with all
   921,600 bytes, and `runCommand('printf hello', …)` still returns exactly
   `{ code: 0, out: 'hello', timedOut: false }` with stdout-then-stderr ordering on the failure path.
   This is the regression guard and it is what makes the change safe to land.
5. **Capture-infrastructure failure stops the run explicitly and can never resemble a test result.**
   A directory that cannot be created, a file that cannot be read: the run stops with a message
   naming the capture as the cause. It may never satisfy `expect: fail`, never write `tests=ok`, and
   never be reported as a suite that failed — *"never default silently"*, and the mirror of Q-0035's
   rule that a check which skips its subject must not report success.
6. **Both trees, together, with equivalent tests.** `spike/src/fanout.js` and
   `packages/core/src/fanout/command.ts` in the same change — the Q-0066/Q-0068 shape — or the port
   loses the independent witness the freeze exists to provide. The spike's tests go in
   `spike/test/q0070-*.js` registered in `run.js`, on the `q0063-stdin-epipe.js` pattern. The report
   re-states the freeze verdict (verified above) so no reviewer spends a round on it.
7. **Every landed pin is updated in the same change and named in the report, not discovered in
   review.** All five: `command.test.ts:14` and `:23` (`toStrictEqual` over the whole result),
   `fanout.source.test.ts:45` (exports exactly `['runCommand']`), `:106`
   (`fields.length` is 15), `:114` (the import allow-list, which has no `node:os`), and `:146`/`:148`
   (`killSignal` and the three disjuncts, which should survive untouched — say so if they do).
8. **`command.ts:55`'s stale quotation is corrected.** It quotes `commands.test` as
   `` `npm test --prefix spike && pnpm turbo run test` ``; Q-0065 appended `--force` on 2026-08-27.
   The spike's twin comment carries no quotation, so there is nothing to correct there — the report
   says that rather than leaving it open.
9. **The input guard is answered in the same change.** `READ_BASES` gains an entry for
   `packages/core/src/fanout/command.ts` naming each capture base and why it is a directory the
   function created rather than a root it climbed to. `@quorum/core`'s suite passes; no other clause
   of `turbo-inputs.test.ts` is relaxed to accommodate this file.
10. **The two commands that already run through this function inherit the fix by construction.**
    `commands.install` (`engine.js:1036`) and the latent `script` step (`:600`) get it because there
    is one code path, not two. The report names all three call sites and confirms no second capture
    path was introduced (Q-0065 OQ-2, folded in as the ticket directs).
11. **The decision is named, not written.** `harness/roles/developer-generalist.md:23` forbids the
    implementer from appending to `docs/decisions/` or its index, and this entry is Ruud's — the next
    number is **058**. The summary supplies the title, the shape chosen, and each shape rejected with
    its reason, in a form Ruud can lift.

## Non-goals

- **Streaming or incremental capture as a feature.** Refused in Q-0065 as *"a product, not a chore"*
  and still refused. Two files and a read are the whole mechanism.
- **Changing `CommandResult`'s shape** beyond what the chosen design forces. No new field is added
  speculatively (OQ-4); `{ code, out, timedOut, timeoutMs? }` is what callers read.
- **Bounding `output.txt`,** or changing `testReport`'s 24,000-byte truncation, or `ctx.lastIntegration`'s
  `slice(-3000)`. The fix improves the last of these for free; policy over run-history disk is OQ-5.
- **The late-arriving environment failure.** `environmentFailure`'s six signatures are all *startup*
  failures, which head-truncation preserves, and `engine.js:1046` short-circuits on `timedOut` so the
  overflow cells never consult it. The genuine gap — a late failure in the truncating cell — closes
  as a consequence of AC-2 and needs no criterion of its own. Do not repeat the broader claim.
- **Writing `docs/decisions/`, its index, or anything under `backlog/`.** Outside the role by
  instruction, and `commitAll` reverts the second.
- **Porting the engine,** or giving `packages/core`'s copy a caller. Q-0050 and Q-0053 own that.
- **Changing what CI or `integrate` force.** Q-0065 and Q-0071 stand untouched.
- **The shipped template.** `spike/templates/harness/harness.yaml` keeps `commands.test: npm test`;
  no adopter-visible configuration changes and there is no cold-clone surface here.
- **Re-deriving the matrix from the Q-0048 record, the Q-0065 body, either Q-0065 candidate, or
  Q-0065 §0.1.** The table above was measured against the real function and supersedes all of them.

## Open questions

- **OQ-1 — Raise the ceiling or remove it? (blocker; owner: Ruud, at the gate.)** The requirement is
  written against **removing** it. This is no longer a matter of taste: raising `maxBuffer` fixes the
  three benign cells and **provably cannot reach the false-green one**, because that cell never
  approaches the ceiling — it moves a cliff, and a cliff that has moved is harder to find. Removal is
  measured to close all six. The two objections both weakened on measurement: the lifecycle is not
  new (`adapters/codex.ts` ships it in both trees) and the timeout path survives intact. If Ruud
  rules *raise*, AC-1 becomes an explicit `maxBuffer` justified in the JSDoc against the 69,119-byte
  measurement, AC-2 loses its `process.exit()` clause, **AC-5 and AC-9 are struck**, and the ticket
  should say in its own body that the false-green cell remains open — it must not be left implied.
- **OQ-2 — chore or the full SDLC? (blocker; owner: Ruud, at the gate.)** Recommendation: **chore.**
  The ticket's argument for the full route is that a red phase exists here, which is true. Against it
  is *"Do not drive harness-machinery work through the harness"* (2026-08-23), which names the
  **test-runner machinery** specifically and prescribes *"hand-written acceptance tests, a smaller
  cut, or a stage run manually"* — and Q-0033, whose six qa-red attempts cost roughly $41 without a
  usable red, is the measured precedent for what the other choice costs on this kind of subject. The
  red phase's value is recoverable without the qa-red flow: AC-2's table is written first, run
  against the unchanged function, and shown failing — the pattern Q-0072 used as its AC-3. Decide
  this **with** OQ-1 and not before it, as the ticket instructs.
- **OQ-3 — where do the capture files live? (non-blocking; owner: implementer.)** `os.tmpdir()`.
  Anywhere inside the worktree is refused: `commitAll` runs `git add -A`, so a capture file would be
  committed onto the step branch, and *"never write to the user's working tree"* is a hard
  constraint. `.quorum/` is for run history, not scratch.
- **OQ-4 — should `CommandResult` gain a field? (non-blocking; owner: implementer.)**
  Recommendation: **no.** A `bytes` or `truncated` field buys nothing once nothing truncates, and it
  costs `command.test.ts`'s two `toStrictEqual` pins and `fanout.source.test.ts:106`'s field count.
  If the chosen design needs one, say so in the report — it is a visible act, not a detail.
- **OQ-5 — `output.txt` is now unbounded. (non-blocking; owner: Ruud.)** `persistArtifact` writes the
  whole string with no cap, so a pathological command writes a pathological file under
  `.quorum/runs/`. Out of scope here. If it matters, the successor's body is written at this gate
  rather than promised — a deferred obligation with no body expires.
- **OQ-6 — does `packages/core`'s copy need a caller to be trustworthy? (non-blocking; owner:
  implementer.)** It has none until Q-0050/Q-0053. Its tests are the whole witness, which is the
  standing every ported module has had; named so it is not raised as a finding.

## Risks

1. **The change is the machinery the flows run on** — the 2026-08-23 rule. The exposure is bounded
   and worth stating precisely: `harness run` executes the **main checkout's** `spike/src/fanout.js`,
   so the worktree's modified copy is not what runs the flow. The change takes effect on the *next*
   run, not mid-flight, and `integrate` will exercise it for the first time on the ticket after this
   one. Say that in the report rather than leaving a reviewer to work it out.
2. **A crashed run leaks a temp directory.** Mitigated by `mkdtemp` under `os.tmpdir()`, which the OS
   reaps, and by cleanup on all four exit paths (AC-1). The same exposure `adapters/codex.ts` has
   carried since Q-0047.
3. **`output.txt` grows** from at-most-1-MiB to whatever the command produced. OQ-5.
4. **Pin churn is the likeliest review round.** Five pins, two of which no earlier record names. AC-7
   exists to spend that round now instead of later.
5. **The guard entry is easy to miss and fails in only one package's suite** — `@quorum/core`'s. It
   will be caught, because `integrate` forces since Q-0065; it will be caught *late* if AC-9 is not
   read as part of the implementation rather than as cleanup.
6. **Recording the freeze SHA after this lands, not before.** The `freeze-sha` half is dormant today,
   which is why this ticket's `spike/src` change is free. Recording a SHA in `harness/port-charter.md`
   *before* Q-0070 merges would make this change a base change after the freeze and fail the
   remaining port children. Not this ticket's work — worth one line so it is not rediscovered.
7. **The error path no longer reads `e.stdout`.** With `stdio` as file descriptors, the thrown error
   carries no streams; the result must come from the files on both paths. A half-migration that still
   reads `errorProperty(e, 'stdout')` returns empty output on every failure — the exact defect this
   ticket exists to remove, wearing the fix's clothes.

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No code path, test, fixture or example touches a subscription or an environment variable; `runCommand` passes `process.env` through unchanged and this change does not alter that. |
| **Worktree safety** | Load-bearing, and it decides OQ-3. Capture files go under `os.tmpdir()` because `commitAll`'s `git add -A` would otherwise commit them onto the step branch. Nothing is written to the user's working tree. |
| **Gate behaviour** | Unchanged. `cross_vendor: required` and every gate stand. The one adjacency is AC-5: a capture failure must stop the run rather than reach a gate as a test verdict. |
| **File format and schema** | `CommandResult` is an internal interface, not a persisted format — no zod schema in `packages/shared` moves. Two *artifacts* change: `output.txt` becomes complete (and unbounded), `dev/integration.md` stays bounded by `testReport`'s 24,000 bytes. |
| **Lint rules** | ESLint covers `packages/**` and `apps/**` only. The spike twin is unlinted, so Q-0069's deprecation rule cannot see it — read Node's own typings before reaching for an unfamiliar `fs` method there. |
| **Glossary** | No new term. "Capture" is used for the mechanism and is not offered as vocabulary; nothing here is called a "log line" or a "trace message". |
| **Cold-clone impact** | None. The template's `commands.test: npm test` is untouched, no dependency is added, and the first 30 minutes are unchanged. |
