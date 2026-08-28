# Q-0070 — `runCommand` loses no output, and an overflow is not reported as a timeout

*Merged requirement, iteration 2, 2026-08-28. Eleven acceptance criteria. Surfaces:
`spike/src/fanout.js` and `packages/core/src/fanout/command.ts` with their tests, plus one register
entry in `packages/core/src/turbo-inputs.test.ts`. A `docs/decisions/` entry is **named, not
written** — no step in this flow may append one. No CLI, daemon, flow, adapter or `harness/`
surface. Two gate questions are blocking and are listed first; neither changes a criterion below.*

---

## The two answers needed at this gate

Both are Ruud's, both are two lines, and neither changes an acceptance criterion. They are the same
two iteration 1 raised, restated because nothing in the inputs answers them.

**G-1 — write `docs/decisions/058-*.md` before an implementer starts.** The ticket makes the entry a
precondition: *"That entry is still required."* `harness/roles/developer-generalist.md:23` forbids
the role from creating one — *"You do not add to docs/decisions/ or its index; a decision is the
human's to record."* AC-11 supplies the material in a form that can be lifted verbatim. This is the
Q-0069 AC-11(b) shape, and two minutes here is cheaper than three revise rounds and an exhaustion
gate later.

**G-2 — choose the route.** Three options are live and each candidate argued exactly one. Chore is
refuted by the chore role's own escape clause, because this is a behaviour change. The full SDLC is
defensible but never engages *"Do not drive harness-machinery work through the harness"*
(2026-08-23), whose own prescription — *"hand-written acceptance tests, a smaller cut, or a stage
run manually"* — is the third option neither candidate proposed and is the recommendation here:
`runCommand` is the function `integrate` itself calls. See OQ-2.

---

## Problem

The `maintainer` reads `tests=ok` in `runs.log` and treats it as a suite that passed. Two other
things can be behind that line, and neither looks different from the outside.

The common one lies in the safe direction. A test runner writes progressively, so when its output
crosses Node's 1 MiB `maxBuffer` the child is killed with the `SIGKILL` both trees configure — and
`timedOut` tests that signal. `spike/src/engine.js:1046` therefore reports that the test command did
not finish within fifteen minutes about a command that finished in twenty-six seconds, records
`tests=invalid` (`:1062`), raises a `FlowError` (`:1067`), and sends the reader to `commands.install`
to fix an environment that was never broken. It fails closed: it costs a run and a diagnosis, never
a merge.

The rare one is the expensive one. A child that writes megabytes in a single call and then calls
`process.exit()` discards its own unflushed stdout; one pipe buffer — 65,536 bytes — is all that is
ever delivered. If that child exits 0, `runCommand` returns **`code: 0` with 64 KiB of a 2 MiB
output**, `integrate` writes `tests=ok`, and `expect: pass` is satisfied by a suite whose output was
thrown away. Nothing about the result is unusual: the captured length is far *below* `maxBuffer`, so
no length check catches it either. **Raising `maxBuffer` provably cannot reach this cell**, because
the bytes never leave the child.

There is a third cost no earlier record names: in the overflow cells the child's **exit status is
destroyed too**. A child that writes 2 MiB and exits 3 is reported as `code: 1`, because it was
killed before it could exit. Today's failure mode is not only lost output — it is a lost verdict.

This is `integrate`'s own reflex. `runCommand` is where every configured `commands.test` and
`commands.install` runs, which makes this the same class of defect as Q-0065 and Q-0071: a green tick
claiming more than it examined.

## User stories

- **`maintainer`** — *I want `tests=ok` to mean the suite ran and its whole output was read, so that a
  green `integrate` is a reason to merge rather than a reason to re-run the suite by hand.*
- **`maintainer`** — *I want a command that produced too much output to say so, so that I am not sent
  to fix a fifteen-minute timeout that took twenty-six seconds.*
- **`adopter`** — *I want my own `commands.test`, whatever it prints, to be reported by what it did
  rather than by how it happened to write, so that my first `integrate` is evidence.*

## What was verified for this requirement, and by whom

Two different things are recorded here and they are not interchangeable. **Do not re-derive this
subject from the Q-0048 record, the Q-0065 ticket body, either Q-0065 candidate, or Q-0065 §0.1** —
four measurements, three of them wrong in three different places.

### Measured at this gate, against the shipped code

- **The composition asymmetry, run rather than reasoned.** `runCommand('printf OUT; printf ERR >&2',
  cwd)` returns **`{ code: 0, out: 'OUT', timedOut: false }`** — stderr is *discarded* on the success
  path, because `execSync` returns stdout alone. `runCommand('printf OUT; printf ERR >&2; printf
  OUT2; exit 1', cwd)` returns **`{ code: 1, out: 'OUTOUT2ERR', timedOut: false, timeoutMs: 900000 }`**
  — the failure path concatenates whole stdout then whole stderr (`command.ts:71`, `fanout.js:132`).
  `command.ts:31` documents the asymmetry and **nothing tests it**, because `command.test.ts:14`'s
  `printf hello` writes no stderr. This is the fact that decides the capture shape (AC-2).
- **Both trees are byte-equivalent** at `command.ts:62–73` and `fanout.js:124–134`: no `maxBuffer`,
  `stdio: ['ignore', 'pipe', 'pipe']`, `killSignal: 'SIGKILL'`, the three `timedOut` disjuncts,
  `code: status ?? 1`.
- **`runCommand` is documented as never throwing** — `command.ts:52`, and the `errorProperty` and
  `stream` helpers exist to make it true. AC-6 needs a capture failure to be unmistakable, and the
  non-goals forbid a new result field, so those three cannot all stand. Ruled in AC-6.
- **Seven landed pins, not three and not five.** The ticket names three, claude found five, iteration
  1 found six. The seventh is `fanout.source.test.ts:34`, *"the folder is exactly the two files, and
  neither is a barrel"*, which asserts `fanout/` holds exactly `command.ts` and `fanout.ts` — a
  **design constraint**, not churn: the capture may not be factored into a `fanout/capture.ts`. The
  sixth is its `toContain("stdio: ['ignore', 'pipe', 'pipe']")`, asserted as source text, which file
  capture cannot avoid breaking. All are named by assertion in AC-8, because line-pinning is what
  made both candidates miscount.
- **The same source test bans three substrings from the file being edited** (`:60–66`): `console.`,
  `process.stdout`, `process.stderr` and escape sequences, in source *and* comments. JSDoc describing
  the capture is the natural place to write one of them by accident.
- **The import allow-list has no `node:os`** (`:114`): exactly `['node:child_process', 'node:fs',
  'node:path', 'yaml', '@quorum/shared', '../git/git.js']`. `os.tmpdir()` requires extending it — a
  deliberate, named act.
- **`expect(fields.length).toBe(15)`** (`:106`) counts JSDoc'd interface fields across both files, and
  its own comment enumerates them — *"RunCommandOptions 1 and CommandResult 4 in command.ts"* — so a
  new field moves the count *and* the prose. Reinforces OQ-4's answer of no.
- **The freeze guard, run rather than read.** `HALF=branch-scope BRANCH=harness/Q-0070/integration`
  exits **0** with *"port-freeze: Q-0070 is not one of Q-0009's fourteen children — the freeze does
  not apply."* `harness/port-charter.md:243` carries `freeze-sha: not-yet-recorded`, so that half is
  dormant (Risk 8).
- **The input guard's shape, and one thing both candidates got right for the wrong reason.**
  `turbo-inputs.test.ts` limit 4 states that **C2's derivation list deliberately omits `os.tmpdir`**,
  so no `ROOT_DERIVATIONS` entry is wanted; C4 registers the *base* instead, and
  `READ_BASES['packages/core/src/adapters/codex.ts'] = { lastPath: '…the temp directory this run
  created and removes again' }` (`:1164–1166`) is the exact template. Entries are keyed by the base's
  **name in that file** (limit 2), not by the read.
- **Three call sites, one latent.** `engine.js:600` (a `script` step — no shipped flow declares one),
  `:1036` (`commands.install`), `:1042` (`commands.test`). `packages/core`'s copy has no caller until
  Q-0050/Q-0053.
- **Both candidates are wrong about the spike test runner.** `spike/test/run.js` **auto-discovers**
  every `test/*.js` other than itself and sorts `smoke.js` first; there is no registration list. A
  new `spike/test/q0070-*.js` is picked up by existing it. Corrected in AC-7.
- **The stale-quotation fix is comment-safe.** `packages/core/src/test-command.test.ts:42–46`'s
  `codeLines` filters comment lines *because* `fanout/command.ts` quotes this repository's command in
  a doc comment, and its `RUNNERS` check (`:70`) runs over code lines only. Q-0065's `\bturbo\b` /
  `TURBO_FORCE` guard is therefore unaffected by AC-10.
- **The artifact surfaces, precisely.** `persistArtifact` (`engine.js:429`) writes the string whole
  with no cap. `testReport` (`:505–516`) keeps **12,000 bytes of head and 12,000 of tail** with a
  middle omission marker — 24,000 total, which two earlier records state as "24,000 head and tail".
  `ctx.lastIntegration` takes `out.slice(-3000)` (`:1071`) and is consumed at `:957` via
  `slice(0, 4000)`.
- **OQ-5's missing evidence, now measured.** The largest `output.txt` under `.quorum/runs/` today is
  **71,318 bytes** (`Q-0072-2/steps/011-integrate`), and the five largest cluster at 70–71 KB. The
  largest run-history file of *any* kind is a **242,181-byte review `prompt.txt`** — 3.4× larger, and
  bounded by nothing either. Total `.quorum/runs` is 16 MB. Unbounding `output.txt` is a smaller
  change than it reads, and the disk question is about run history as a whole rather than about this
  fix.
- **The chore role forbids the decision entry and ejects behaviour changes.**
  `harness/roles/developer-generalist.md:17` and `:23`. Its `paths:` do include `docs`, `spike` and
  `packages`, so every other surface here is writable.
- **The spike twin has nothing to correct.** `spike/src/fanout.js`'s `runCommand` comment does not
  quote `commands.test`; the stale quotation is `command.ts:55` alone. No spike test names
  `runCommand` today.
- **`docs/decisions/` tops out at 057**, so the next number is 058 (AC-11).

### Inherited from the claude candidate's re-measurement, not re-run here

Claude re-derived the matrix against the real `runCommand` (Node v24.15.0, three runs per cell) and
reports every figure in the ticket body surviving — **the first time a record of this subject has**.
Two rows are new: the false green measured *directly* (`monolithic, process.exit(0)` → `code: 0`,
65,536 B of 2 MiB, no marker of any kind) and the status loss (`monolithic, natural, status 3` →
reported as `code: 1`). File capture on the same children delivers **2,097,152 bytes complete in
every cell**. Headroom for `npm test --prefix spike && pnpm turbo run test --force` measured at
**69,119 bytes** — 6.6% of the ceiling, consistent with the 71,318-byte persisted artifact measured
above, which additionally carries the install output. Twenty *distinct* vitest failures cost ≈800
bytes each; vitest deduplicates identical ones.

These are not re-run here, and they do not need to be: **AC-3 is that matrix, written first and shown
failing against the unchanged function.** The measurement verifies itself as the red phase.

## Acceptance criteria

1. **The capture design is written down where the next reader meets it, with its lifecycle.** Both
   implementations direct child stdout and stderr to files in a directory unique per invocation
   under `os.tmpdir()`, and build the result from the complete files after the child ends. The
   directory is removed on **every** exit path — clean exit, non-zero exit, timeout and throw —
   following the shipped pattern at `packages/core/src/adapters/codex.ts:95,152,166` and
   `spike/src/adapters/codex.js:27,78,87` rather than inventing a second one. The JSDoc states the
   property (no ceiling) rather than a number, and replaces the `Why: preserved defect … the fix is
   Q-0065` note at `command.ts:59–60`.

2. **The composition contract is preserved exactly, and a test discriminates it.** `out` is **stdout
   only** on the success path and **stdout followed by stderr** on the failure path, unchanged from
   today. Two separate capture files, never one shared file: a shared file interleaves, which would
   add all of turbo's and vitest's stderr to every *green* `integrate` run's `output.txt` and
   `dev/integration.md`. A test that today's code passes and a shared-file implementation fails is
   required — measured at this gate, `printf OUT; printf ERR >&2` must return `{ code: 0, out:
   'OUT', timedOut: false }`, and `printf OUT; printf ERR >&2; printf OUT2; exit 1` must return
   `out: 'OUTOUT2ERR'`. `command.test.ts`'s existing `'OUTERR'` assertion does not discriminate,
   because two sequential writes land in that order either way, and is not sufficient.

3. **The result does not depend on the child's write shape, on `process.exit()`, or on whether Node
   kills it before it exits.** All three, because each has been proposed as the discriminator and
   only the conjunction is. Asserted as the full matrix rather than a spot check: a child producing
   2,097,152 bytes returns **all 2,097,152 bytes**, `timedOut: false`, and **its own exit status** —
   under monolithic *and* progressive (2048 × 1 KiB) writes, under natural completion *and* explicit
   `process.exit()`, and for a zero *and* a non-zero status. The zero/monolithic/`process.exit()`
   cell is the false green and must be named as such in the test.

4. **An overflow is never reported as a timeout, and the real timeout path is unweakened.**
   `command.test.ts:34–48`'s `sleep`-based timing assertions stay as they are, `timedOut` keeps all
   three disjuncts and their source-text pin, and a timed-out command still returns the partial
   output it produced. The report separates what holds **by construction** — after the fix `SIGKILL`
   can only mean a timeout, because no output volume kills anything — from what is asserted.

5. **The under-ceiling and shape regressions still pass untouched.** The 900 KiB child returns
   `code: 0`, `timedOut: false` and all 921,600 bytes; `printf hello` returns exactly `{ code: 0,
   out: 'hello', timedOut: false }`; `exit 3` returns exactly `{ code: 3, out: '', timedOut: false,
   timeoutMs: 900000 }`; `pwd` still runs in the directory it was given; and `cat` still finishes
   fast because stdin stays `ignore`. This is the guard that makes the change safe to land.

6. **Capture-infrastructure failure stops the run by throwing, and can never resemble a test
   result.** A directory that cannot be created, a file that cannot be written or read: `runCommand`
   **throws**, with a message naming the capture as the cause. It throws rather than reporting,
   because the two alternatives both fail — a new result field is refused by OQ-4 and would in any
   case be ignored by `engine.js:1042`'s `testsOk = r.code === 0`, and reusing `code`/`timedOut`
   makes an infrastructure failure indistinguishable from a verdict. `command.ts:52`'s *"never
   throwing"* sentence is corrected in the same change and the new contract is stated in its place;
   this is the one place the port's behaviour-preservation is deliberately broken, and the report
   says so. Because `engine.js`'s `backlog.log(… tests=…)` line is never reached on a throw, the
   property holds structurally: it may never satisfy `expect: pass` or `expect: fail`, and never
   write `tests=ok` or `tests=invalid` — *"never default silently"*, and the mirror of *"a check that
   skips its subject must not report success"* (2026-08-25). Tests cover at least setup failure and
   read failure. Cleanup failure after an otherwise complete command is surfaced rather than
   swallowed, and does not change the command's own verdict.

7. **Both trees, together, with equivalent tests, and the freeze verdict re-stated.**
   `spike/src/fanout.js` and `packages/core/src/fanout/command.ts` in the same change — the
   Q-0066/Q-0068 shape — or the port loses the independent witness the freeze exists to provide. The
   spike's tests go in `spike/test/q0070-*.js`, on the `q0063-stdin-epipe.js` pattern; **no
   registration step exists** — `spike/test/run.js` discovers every `test/*.js` by reading the
   directory, and both candidates were wrong to say otherwise. The report re-runs
   `.github/scripts/port-freeze-guard.sh` and states that it exits 0 because Q-0070 is not one of
   Q-0009's fourteen children, so no reviewer spends a round on it. It also names all three call
   sites — `engine.js:600`, `:1036`, `:1042` — and confirms no second capture path was introduced,
   which the landed *"execSync is in fanout/command.ts and in no other non-test source"* test already
   enforces (Q-0065 OQ-2, folded in as the ticket directs).

8. **All seven landed pins are updated in the same change and named in the report, not discovered in
   review.** Named by assertion, because line numbers have already been miscounted twice:
   `command.test.ts`'s two whole-object `toStrictEqual` assertions; `fanout.source.test.ts`'s
   *"command.ts exports runCommand and nothing else"*; its `expect(fields.length).toBe(15)` and the
   comment enumerating those fields; its import allow-list, which **must gain `node:os`**; its
   `toContain("stdio: ['ignore', 'pipe', 'pipe']")`, which file capture necessarily breaks; its
   **"the folder is exactly the two files"**, which forbids factoring the capture into a new
   `fanout/capture.ts` — the capture lives in `command.ts` or this pin is changed as a stated,
   argued act; and its `killSignal` and three-disjunct assertions, which should survive untouched —
   the report says so if they do. The same file's ban on the substrings `console.`, `process.stdout`
   and `process.stderr` applies to comments as well as code, so the new JSDoc must not spell either
   stream that way.

9. **The input guard is answered in the same change.** `packages/core/src/turbo-inputs.test.ts`'s
   `READ_BASES` gains an entry for `packages/core/src/fanout/command.ts`, keyed by the base's name in
   that file, saying why it is a directory the function created rather than a root it climbed to, on
   the `adapters/codex.ts` → `lastPath` template. No `ROOT_DERIVATIONS` entry is added: the guard's
   own limit 4 states that C2 omits `os.tmpdir` deliberately. `@quorum/core`'s suite passes and no
   other clause of the guard is relaxed to accommodate this file.

10. **`command.ts:55`'s stale quotation is corrected.** It quotes `commands.test` as
    `` `npm test --prefix spike && pnpm turbo run test` ``; Q-0065 appended `--force` on 2026-08-27.
    The correction stays inside a comment, and `test-command.test.ts`'s `codeLines` filters comment
    lines *because of this very sentence*, so its runner check is unaffected — the report states that
    rather than leaving a reviewer to check. The spike's twin comment carries no quotation; the
    report says so rather than leaving it open.

11. **The decision is named, not written.** `harness/roles/developer-generalist.md:23` forbids the
    implementer from appending to `docs/decisions/` or its index, and this entry is Ruud's — the next
    number is **058**, `057` being the last on disk. The summary supplies the title, the shape
    chosen, and each shape rejected with its reason, in a form Ruud can lift. No criterion asserts
    the entry's existence, because no step in this flow can create one.

## Non-goals

- **Raising `maxBuffer` to any finite value.** Measured to leave the false-green cell untouched.
- **Streaming or incremental capture as a feature.** Refused at Q-0065 as *"a product, not a chore"*
  and still refused. Two files and a read are the whole mechanism.
- **A single shared capture file.** Refused by AC-2: it changes what a green run reports.
- **Adding a field to `CommandResult`.** No `bytes`, no `truncated`, no `capturePath` (OQ-4).
  `{ code, out, timedOut, timeoutMs? }` is what callers read.
- **Bounding `output.txt`,** changing `testReport`'s 24,000-byte treatment, or changing
  `ctx.lastIntegration`'s `slice(-3000)`. The fix improves the last of these for free — agents
  finally read a long run's *end* rather than its middle. Disk policy is OQ-5, whose successor body
  is written out below rather than promised.
- **The late-arriving environment failure.** `engine.js:1046` short-circuits on `timedOut`, so the
  overflow cells never consult `environmentFailure`, and all six `ENV_FAILURES` signatures are
  *startup* failures that head-truncation preserves. The genuine gap — a late failure in the
  truncating cell — closes as a consequence of AC-3. **Do not repeat the broader claim** that
  truncation *"can remove the very lines `environmentFailure` reads"*; it is wrong twice over.
- **Writing `docs/decisions/`, its index, or anything under `backlog/`.** Outside the role by
  instruction, and `commitAll`'s `git add -A` reverts the second.
- **Porting the engine or giving `packages/core`'s copy a caller.** Q-0050 and Q-0053 own that.
- **Changing what CI or `integrate` force.** Q-0065 and Q-0071 stand untouched.
- **The shipped template.** `spike/templates/harness/harness.yaml` keeps `commands.test: npm test`;
  no adopter-visible configuration changes and there is no cold-clone surface here.
- **Re-deriving the matrix from any earlier record.** Four measurements exist and three were wrong.

## Open questions

- **OQ-1 — write the decision entry. (Blocking; owner: Ruud, at the gate.)** Not *which* design —
  that is settled by evidence and this requirement is written against **removing the ceiling** — but
  the entry itself, which no step in this flow may create. AC-11 supplies the material. If Ruud
  overrules and chooses *raise*: AC-1 becomes an explicit `maxBuffer` justified in the JSDoc against
  the 69,119-byte measurement, AC-3 loses its `process.exit()` cells, **AC-2, AC-6 and AC-9 are
  struck**, and **the ticket body must say in its own words that the false-green cell remains
  open** — it must not be left implied.
- **OQ-2 — chore, the full SDLC, or by hand? (Blocking; owner: Ruud, at the gate.)** All three are
  live and each candidate argued only one. **Chore** is refuted by the chore role's own text: *"If
  the work turns out to change behaviour rather than machinery, say so: that ticket belongs in the
  full pipeline, not here"* — and this changes an observable result, changes a documented
  never-throws contract, adds a failure mode and makes an artifact unbounded, so a correct chore
  implementer stops and reports, and the round is spent before a line is written. **The full SDLC**
  answers the red-phase argument but never engages *"Do not drive harness-machinery work through the
  harness"* (2026-08-23), and Q-0033's six qa-red attempts at ≈$41 are the measured precedent for
  this kind of subject. **By hand** is that entry's own prescription — *"hand-written acceptance
  tests, a smaller cut, or a stage run manually"* — and is the recommendation: `runCommand` is the
  function `integrate` itself calls, the eleven criteria above are already a complete specification,
  and AC-3's matrix run against the unchanged function is the red phase without the flow. Decide this
  **with** OQ-1 and not before it, as the ticket instructs. No criterion above changes with the
  answer; only who executes it.
- **OQ-3 — where do the capture files live? (Non-blocking; settled: `os.tmpdir()`.)** Anywhere inside
  the worktree is refused, because `commitAll` runs `git add -A` (`fanout.ts:287`) and a capture file
  would be committed onto the step branch — and *"never write to the user's working tree"* is a hard
  constraint. `.quorum/` is run history, not scratch.
- **OQ-4 — should `CommandResult` gain a field? (Non-blocking; settled: no.)** A `bytes` or
  `truncated` field buys nothing once nothing truncates, and it costs both `toStrictEqual` pins, the
  `fields.length` count and the comment that enumerates the fields. AC-6's throw is what carries the
  infrastructure signal instead. If the chosen implementation forces a field anyway, the report says
  so — it is a visible act, not a detail.
- **OQ-5 — `output.txt` becomes unbounded, and the successor's body is written here rather than
  promised. (Non-blocking; owner: Ruud. Downgraded by measurement.)** `persistArtifact`
  (`engine.js:429`) writes the string whole with no cap, and today the 1 MiB ceiling bounds it
  incidentally. Measured at this gate: the largest `output.txt` on disk is **71,318 bytes**, the five
  largest cluster at 70–71 KB, and the largest run-history file of any kind is a **242,181-byte
  review `prompt.txt`** that nothing bounds either — 3.4× the largest output. Total `.quorum/runs` is
  16 MB. The successor is therefore: *nothing in run history has a cap, and `output.txt` is not the
  largest thing in it — prompts are, by 3.4×. `testReport` (`engine.js:505–516`) already keeps 12,000
  bytes of head and 12,000 of tail with an omission marker and is the shape to copy if a cap is
  wanted. The question is whether run history is archival — in which case everything stays whole and
  the cap belongs on the disk, not on any one string — or diagnostic, in which case the treatment
  belongs on prompts first and `output.txt` second. The evidence above is the starting point; do not
  re-derive it from this fix's headroom numbers, which measure a different thing.*
- **OQ-6 — should the success path keep discarding stderr? (Non-blocking; owner: Ruud, later.)**
  Measured at this gate: a *passing* command's stderr is thrown away, so a suite that passes with
  warnings loses them. AC-2 **preserves** this, because the port charter preserves behaviour and
  changing it here would be scope creep wearing a bug fix's clothes. It is now visible, written down
  and tested, which it was not before. Successor body if it matters: *`command.ts:31` documents the
  asymmetry and nothing tested it until AC-2 did. Changing it means every green `integrate` run's
  `dev/integration.md` gains turbo's and vitest's stderr, which is most of their output — so the
  question is not "is stderr useful" but "is `out` the artifact a human reads or the one a machine
  parses", and `testReport` already answers that differently for each.*
- **OQ-7 — does `packages/core`'s copy need a caller to be trustworthy? (Non-blocking; settled: no.)**
  It has none until Q-0050/Q-0053. Its tests are the whole witness, which is the standing every
  ported module has had. Named so it is not raised as a finding.

## Risks

1. **The change is the machinery the flows run on** — the 2026-08-23 rule, and the substance of OQ-2.
   The exposure is bounded and worth stating precisely: `harness run` executes the **main checkout's**
   `spike/src/fanout.js`, so a worktree's modified copy is not what runs the flow. The change takes
   effect on the *next* run, and `integrate` exercises it for the first time on the ticket after this
   one. Say that in the report rather than leaving a reviewer to work it out.
2. **The error path no longer reads `e.stdout`.** With `stdio` as file descriptors the thrown error
   carries no streams, so the result must come from the files on **both** paths. A half-migration
   that still reads `errorProperty(e, 'stdout')` returns empty output on every failure — the exact
   defect this ticket exists to remove, wearing the fix's clothes. This is the likeliest way to ship
   a green suite and a broken function.
3. **AC-6 breaks a documented contract on purpose.** `command.ts:52` says *"never throwing"*, and
   three call sites wrap `runCommand` in no `try`. A throw is intended to reach the run and stop it —
   but the report must confirm the throw is not swallowed on the way, and that run history is still
   finalised, because a capture failure that silently ends a run is a worse diagnosis than the
   timeout it replaces.
4. **Pin churn is the likeliest review round.** Seven pins, three of which no earlier record names,
   and two — the `stdio` source text and the two-file folder assertion — that the fix cannot avoid
   touching. AC-8 exists to spend that round now instead of later.
5. **A crashed run leaks a temp directory.** Mitigated by `mkdtemp` under `os.tmpdir()`, which the OS
   reaps, and by cleanup on all four exit paths. The same exposure `adapters/codex.ts` has carried
   since Q-0047.
6. **The guard entry fails in only one package's suite** — `@quorum/core`'s. It will be caught,
   because `integrate` forces since Q-0065; it will be caught *late* if AC-9 is read as cleanup
   rather than as part of the implementation.
7. **Portability is asserted on POSIX and not beyond it.** File-write synchrony under
   `process.exit()` is the POSIX property the fix rests on. The supported environment is macOS and
   CI's Linux; nothing here claims Windows, and nothing should.
8. **Cleanup racing the child.** Removal must happen only after the child no longer owns the
   descriptors *and* the result has been constructed. Cleaning up before the read is a way to turn
   this fix into an empty-output defect that only appears under load.
9. **Recording the freeze SHA after this lands, not before.** The `freeze-sha` half is dormant
   (`harness/port-charter.md:243`, `not-yet-recorded`), which is why this ticket's `spike/src` change
   is free. Recording a SHA *before* Q-0070 merges would make this a base change after the freeze and
   fail the remaining port children. Not this ticket's work — one line so it is not rediscovered.

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No code path, test, fixture or example touches a subscription or an API key. `runCommand` passes `process.env` through unchanged and this change does not alter that. |
| **Worktree safety** | Load-bearing, and it decides OQ-3. Capture files go under `os.tmpdir()` because `commitAll`'s `git add -A` would otherwise commit them onto the step branch. Nothing is written to the user's working tree, `.quorum/`, `backlog/` or `harness/`. |
| **Gate behaviour** | Unchanged. `cross_vendor: required` and every gate stand. The one adjacency is AC-6: a capture failure must stop the run rather than reach a gate as a test verdict. |
| **File format and schema** | `CommandResult` is an internal interface, not a persisted format — no zod schema in `packages/shared` moves. Two *artifacts* change: `output.txt` becomes complete (and unbounded — OQ-5, downgraded by measurement), `dev/integration.md` stays bounded by `testReport`. |
| **Lint rules** | ESLint covers `packages/**` and `apps/**` only. The spike twin is unlinted, so Q-0069's `no-deprecated` rule cannot see it — read Node's own typings before reaching for an unfamiliar `fs` method there. |
| **Glossary** | No new term. "Capture" names the mechanism and is not offered as vocabulary; nothing here is called a "log line" or a "trace message". |
| **Cold-clone impact** | None. The template's `commands.test: npm test` is untouched, no dependency is added, and the first 30 minutes are unchanged. |

## Provenance

**From codex:** the design decision taken rather than deferred, and the willingness to write the
requirement against it — the evidence is dispositive and a candidate that says so is worth more than
one that hedges. Its AC-3/AC-4 matrix split (zero and non-zero status as separate criteria over the
same shapes) is the clearest statement of the discriminator anyone produced and survives as AC-3.
Its AC-7's insistence that cleanup failure be surfaced rather than swallowed, and its AC-2's
"existing composition order" clause, are both kept — the second is the seed of AC-2, though codex did
not know why it mattered. Its risk list on portability, cleanup racing and memory is better than
claude's and is merged in almost whole.

**From claude:** nearly every repository fact. Five of the seven landed pins, the `node:os` gap in
the import allow-list, the `turbo-inputs` `READ_BASES` obligation with its `codex.ts` template, the
three call sites, `commitAll`'s `git add -A` forcing `os.tmpdir()`, the shipped `adapters/codex.ts`
lifecycle that **refutes the ticket's own claim** that this brings *"a lifecycle nothing here has
today"*, the spike having no twin comment to correct, the narrowed `environmentFailure` interaction,
and the headroom measurement — which the 71,318-byte artifact measured here independently
corroborates. Its AC-11 — the decision is *named, not written* — is correct and is why codex's AC-1
was struck.

**Struck from codex:** AC-1, which requires `docs/DECISIONS.md` to contain an entry before
implementation. The subject is outside every role in this flow, so as an acceptance criterion it is
unsatisfiable and unverifiable by the step that would be judged on it — the Q-0069 AC-11(b) failure
mode exactly, and what *"A requirement may not name a surface its flow cannot write"* (2026-08-25)
and *"`.claude/rules/` is a derived copy"* (2026-08-27) exist to prevent. It survives as gate
obligation G-1 and as AC-11's material. Codex's AC-9 (an integration-level test threading `tests=ok`
through `engine.js`) is also struck: `packages/core`'s engine is Q-0050/Q-0053 and does not exist
yet, so the criterion could only be met in the spike, where it would test the engine rather than the
fix. AC-6's structural argument keeps the property without the coupling. Codex's *"Open questions:
None"* is overruled — two are genuinely open and one of them is its own route recommendation.

**Struck from claude:** its OQ-2 recommendation of **chore**, which cites *"Do not drive
harness-machinery work through the harness"* (2026-08-23) as support. That entry supports neither
route; its prescription is the third option, and the chore role's own escape clause ejects a
behaviour change. The disagreement is preserved as blocking G-2 rather than resolved, because both
candidates were wrong in opposite directions and the answer is Ruud's.

**Neither candidate had:** the success-path composition asymmetry, measured here rather than
reasoned — `execSync` returns **stdout only** on success and discards stderr, while the failure path
concatenates both. Claude's own file-capture measurement used `stdio: ['ignore', fd, fd]` — **one
shared file** — which would have added all of turbo's and vitest's stderr to every green run's
`output.txt`, and its "ordering is preserved" check cannot detect that, because two sequential writes
land in the same order either way. No landed test would have caught it either, since `printf hello`
writes no stderr. Hence AC-2's discriminating case and the requirement for two files.

**Added at iteration 2, beyond iteration 1's merge:** the seventh pin, `fanout.source.test.ts`'s
*"the folder is exactly the two files"*, which makes "no new helper file" a design constraint rather
than a preference; the resolution of AC-6, where *"never throwing"* (`command.ts:52`), *"stops the
run explicitly"* and *"no new field"* cannot all hold and the throw is ruled in; the correction that
`spike/test/run.js` **discovers** tests rather than registering them, which both candidates and the
previous merge stated wrongly; the guard's deliberate omission of `os.tmpdir` from clause C2, which
narrows AC-9 to a `READ_BASES` entry alone; and OQ-5's missing evidence, measured — which downgrades
it from a live concern to a note, since the largest thing in run history is a prompt, not an output.

**Size:** eleven criteria, unchanged from iteration 1 — the new findings folded into AC-6, AC-7,
AC-8 and AC-9 rather than added beside them. Within the ten-to-fifteen band, and it does not want
splitting: the fix is one function in two trees, and the pins, the guard entry and the stale comment
are all consequences of opening that file rather than separable work. The ticket's own sketch would
have run to thirteen; AC-7 absorbs the call-site and freeze obligations, and AC-5 absorbs four
regression cases the sketch listed separately.
