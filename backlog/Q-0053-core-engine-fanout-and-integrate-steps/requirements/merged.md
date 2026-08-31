# Q-0053 — `core/engine`: fan-out and integrate steps

*Merged requirement, 2026-08-31. Written against the working tree at `9204f93`. Every line number
and every claim below was re-measured today at that SHA; Q-0051's body was wrong within ten hours
and this is the third document on this ticket to say so, so **re-derive at the implement branch's
own SHA before editing.***

---

## Problem

`packages/core/src/engine/routing.ts:102–103` holds the port's last two rejections:

```ts
if (step.type === 'integrate') return unavailableStep(step, 'Q-0053');
if (step.fan_out) return unavailableStep(step, 'Q-0053');
```

Three of the eight shipped flows — `development.yaml`, `qa-red.yaml`, `chore.yaml` — declare an
`integrate` step, and `development.yaml` declares the only fan-out. Until those two lines execute,
`runFlow` can drive a gate, a script, an agent and a panel, and cannot drive one flow this
repository actually runs end to end. Q-0054 cannot begin: the regression suite it ports has nothing
to run against.

The port is safety-sensitive rather than merely tedious. `harness/port-charter.md:133`, register
row 7 — *"`integrate` installs dependencies in the worktree first, syncs the base branch first,
rejects a suite that could not start rather than counting it red, and ignores an environment
signature on a line that reports a result"* — is one row and four separate defects, each of which
once made `expect: fail` accept something that was not a red phase. Every one of them is invisible
to a happy-path test: a port that drops the install still reports `tests=ok` on a green run and lies
only on the ticket that mattered. This is the file behind *"Red for the right reason is an engine
property, not a role property"* (2026-08-22), where six runs found six engine defects and no
evidence the role was ever at fault.

## User stories

**As the `maintainer`,** I want `runFlow` to execute `development.yaml`'s fan-out and every flow's
`integrate` step in `packages/core`, so that a run driven by the ported engine merges the same
branches, installs before it tests, refuses the same suites, writes the same `runs.log` lines and
stops in the same places as the spike — and so Q-0054 has something to gate.

**As the `contributor`,** I want the four invariants that make a red phase trustworthy to be
checkable in `core` without a repository, a worktree or an adapter, so that changing the environment
detector or the report is a decision I take deliberately rather than one I make by accident.

**As a `cold-clone adopter`,** I want these steps to use the repository's declared `commands.install`
and `commands.test` without writing to my working tree, so the standard flow stays safe and needs no
undocumented machine setup.

**Surface:** `packages/core` only. No CLI surface, no daemon, no UI, no `harness/` flow file, no
`backlog/` write, no schema change, no new dependency. `spike/**` is frozen (charter §3).

---

## What is actually left, measured at `9204f93`

The ticket body's line map holds, with four corrections that change what gets written.

**Six spans, ~200 lines.** `syncBaseIntoTicketBranch` `:1010–1024`, `runFanOut` `:1026–1066`,
`runIntegrate` `:1068–1179`, `ENV_FAILURES` + `environmentFailure` `:1184–1208`, `RESULT_LINE` +
`testReport` `:535–548`, `safeMergeBase` `:550–553`. Plus one module-private helper the body does
not name: **`flatten` (`:1210`)**, whose only caller is `runIntegrate`'s string-`run_tests`
interpolation.

**Every other collaborator is already in `core`, and one the body names does not exist.** The ticket
body lists *"`handleFail` and `failed` from `routing.ts`"*. `routing.ts` exports `askGate`, `runStep`
and `handleFail` and nothing else; **`failed` is a local `const` inside the spike's parallel block
(`engine.js:214`) and is not a helper of these two steps.** Nothing else on that list is wrong —
`loadTasks`, `scopeToFailing`, `waves`, `taskVars`, `taskPromptSection`, `branchExists`,
`branchHead`, `mergeInto`, `ticketWorktree` and `IntegrationError` are all exported from
`fanout/fanout.ts`; `runCommand` is `fanout/command.ts`; `interpolate`, `loadRole` and `writesOf` are
`engine/loaders.ts`; `runAgentStep` and `mergeFailure` are `engine/steps.ts`; the occurrence seam is
`RunPersistence.allocateOccurrence` / `.persistArtifact` / `.terminalOccurrence` on
`engine/types.ts:110–114`.

### R-1 — `safeMergeBase` cannot be written in the engine folder, and its address is dictated

`packages/core/src/git/git.source.test.ts:35–44` is a landed Q-0042 guard:

> `merge-base` and `--is-ancestor` appear in `git.ts` and in no other source file

It iterates every entry of `coreSourceFiles()` and asserts `text.includes(needle) === (name ===
'git/git.ts')`. A `safeMergeBase` written into any engine module fails it on the first run. The
ticket body is right that `ancestry` is not a substitute — it runs `merge-base --is-ancestor` and
answers three-valued, where this needs the **sha** — and right that the function would otherwise be
lost. It does not say where it may live, and there is exactly one answer.

`git/git.ts` already carries both primitives: `git(args, cwd)` (`:14`), which is `execFileSync` with
an argv array, `stdio: ['ignore','pipe','pipe']` and a trailing `.trim()`, and `safe(fn)` (`:17`),
which is `try { return fn(); } catch { return null; }`. The function is two lines over existing
parts, and `git()`'s `.trim()` discharges the whitespace clause for free.

The same file at `:27–32` asserts `Object.keys(gitModule).sort()` equals **exactly eight** names —
verified: `ancestry`, `containment`, `emptyRangeEvidence`, `ensureExcluded`, `ensureWorktree`,
`removeWorktree`, `shallowState`, `shortSha`. This ticket makes it nine. Ruled in AC-3 and OQ-1.

### R-2 — the inherited coercion obligation is discharged at the line it names, and its live sites are elsewhere

Q-0052 wrote into this body: *"`s.into` is this ticket's coercion site (`spike/src/engine.js:166`),
the last of Q-0050 E-21's list."* Measured: `engine.js:166` is inside the **run-level diff
preflight**, which Q-0051 ported, and `packages/core/src/engine/diff.ts:472` already reads
`if (s.type === 'integrate' && s.into) remember(interpolate(String(s.into), context.vars), stepId);`.

The obligation is real; its address is stale by one ticket. The live sites are in `runIntegrate` and
`runFanOut`, and there are seven of them, not one — AC-13. The one nobody has named is
`engine.js:1076`, `const pattern = interpolate(step.branches, ctx.vars)`, which the spike evaluates
**unconditionally, including when `step.branches` is an array**: `String(['a','b'])` is `'a,b'`, the
value is discarded by the `Array.isArray` branch two lines down, and it is harmless there and a
compile error here.

### R-3 — an unrecorded preserved defect in the inter-wave merge

`runFanOut` records each task's real branch — `ctx.fanned.push({ task: task.id, branch, role:
task.role })` at `:1051`, where `branch = interpolate(tpl.branch ?? 'harness/{id}/{task.id}', …)` —
and then at `:1061` merges a **re-derived** name:

```js
for (const t of wave) { const m = mergeInto(tw, `harness/${ticket.meta.id}/${t.id}`); … }
```

A flow whose `step.branch` template is anything else has its earlier waves merged from a ref that
may not exist, and the failure is a `ui.warn` rather than a stop, so the next wave builds on a tree
missing its predecessor's work. It is also merged into `ticket.meta.branch` rather than into the
fan-out's declared `step.step.base`, which are the same value in the one shipped flow and need not
be. Latent because `development.yaml:11` declares exactly `harness/{id}/{task.id}` — the same string
by coincidence rather than by construction.

Preserved, not fixed (charter §2). Registered under AC-14 with a `Why:` line and a test that pins
the re-derivation, so a later change is deliberate.

### R-4 — a whole interpolation namespace with zero coverage in either tree

`engine.js:1128` builds the test command, and `flatten` exposes `harness.yaml`'s `commands` block to
a string `run_tests` as `{cmd.test}`, `{cmd.install}`, `{cmd.lint}`. `grep -rn '{cmd\.'` over
`harness/`, `spike/`, `packages/` and `contracts/` returns **nothing**. All six shipped flow files
use `run_tests: true`; the one string form in either suite is `smoke.js`'s `abandon.yaml`,
`"sh -c 'exit 1'"`, which carries no placeholder. **A port that drops `flatten` compiles, typechecks
and passes both suites.** AC-13 gives it its first test in either tree.

### R-5 — `commandTimeout` exists in `core` and this ticket cannot reach it

Q-0052 ported `cmdTimeout` as `commandTimeout` (`steps.ts:72`), **module-private**. Its two remaining
spike call sites (`:1133`, `:1139`) are both inside `runIntegrate`. Ruled in AC-3: **export it from
`steps.ts`.** Duplicating is refused for the reason the ticket body gives — two copies of a default
drift silently and nothing here would fail. Relocating to a new module is refused because it moves a
symbol `runScript` already consumes for no gain; the `composite → steps` import edge exists anyway,
since `runFanOut` calls `runAgentStep`.

### R-6 — the roster regex and the detector's filter are three ways different, and nothing discriminates them

Neither candidate names this and it is the cheapest way to break register row 7's fourth clause.

```js
RESULT_LINE   = /^\s*(?:\x1b\[[0-9;]*m)*\s*(?:[✓✗×√]|(?:not )?ok\s|#\s|\d+\)\s|(?:PASS|FAIL|SKIP)\b)/   // :535
env filter    = /^\s*(?:[✓✗×√]|(?:not )?ok\s|#|\d+\)\s)/                                                // :1201
```

Three deliberate differences: the detector strips ANSI **before** filtering rather than matching it
inline; its `#` carries no `\s`; and it does **not** exclude `PASS`/`FAIL`/`SKIP`. The consequence is
real — a vitest `FAIL test/x.test.js` header line that also carries `Cannot find module 'y'` is
today an environment failure, and would stop being one if the detector reused `RESULT_LINE`.

**None of the thirteen frozen vectors at `smoke.js:504–544` tells the two apart.** Its one `FAIL`
vector carries no signature, so it returns `null` under either regex. A port that factors "the
result-line regex" into one shared constant — which is the obvious tidy-up, and the two functions
will now sit in the same file — is green in both suites and wrong. AC-12 requires the divergence to
be pinned by a test that fails when the two are unified.

---

## Acceptance criteria

Fifteen, which is the ceiling. See **Size** below for why this is not split.

### AC-1 — both composite kinds dispatch through `runStep`, and the test that pinned their absence changes with them

`routing.ts:102–103`'s two `unavailableStep` calls become `runIntegrate(step, context)` and
`runFanOut(step, context)`, in the spike's order: `parallel`, `gate`, `script`, `integrate`,
`fan_out`, agent. No other precedence moves.

`run-composition.test.ts:162–170`'s AC-9b test asserts `(error as Error).message` contains
`'Q-0053'`. **It fails the moment dispatch lands** and is replaced in the same edit by one asserting
the behaviour it was standing in for: a fan-out parent emits neither a `step` nor a `done` event of
its own, because it is a container and its members speak for themselves.

Verification: unit tests drive **both** kinds through `runStep`, not only through direct helper
calls, so the dispatch itself has a subject.

### AC-2 — two new modules, and the detectors' module imports nothing

`packages/core/src/engine/` gains exactly two files and becomes **eleven** modules:

- **`composite.ts`** — `runFanOut`, `runIntegrate`, `syncBaseIntoTicketBranch`, and module-private
  `flatten`.
- **`suite-output.ts`** — `testReport`, `environmentFailure`, and their two constants `RESULT_LINE`
  and `ENV_FAILURES`. **Its checkable property is that it imports nothing at all** — no `node:`
  builtin, no sibling module, no `@quorum/shared`. Both functions are pure functions of a string,
  which is what lets register row 7's last two clauses be tested exhaustively without a repository,
  an adapter or a worktree, and what stops a later change reaching for the filesystem inside a
  detector.

Every export in both files carries its own JSDoc anchored on the export
(`q0050.source.test.ts:86`'s landed check). `q0053.source.test.ts` asserts `suite-output.ts` holds no
`import` statement **and demonstrates the scan firing over text that does**, per
`q0052.source.test.ts:44`'s precedent.

*Rejected — codex's "implementer's choice, provided no dependency cycle".* Internal layout is not
behaviour and the charter does not preserve it, which is exactly why the requirement gets to choose:
one file for all six functions would make the two pure detectors reachable from a module that runs
git and spawns commands, which is the coupling that let `environmentFailure` be beaten by its own
test suite once already (Q-0004 run 6).

### AC-3 — the two symbols this ticket needs that may not live in its own modules

**(a) `mergeBase` lands in `packages/core/src/git/git.ts`** as one new export:

```ts
/** The merge base of two refs, or `null` when git could not answer — a missing ref among the reasons. */
export function mergeBase(repoDir: string, a: string, b: string): string | null
```

built over the file's existing `git()` and `safe()`, so it inherits the argv array, the captured
stderr and the `.trim()`. Its only caller is `runIntegrate`'s evidence block. The three-valued
`ancestry` is not used as a substitute; the evidence line needs a sha.
`git.source.test.ts:27–32` moves from eight sorted names to nine, in the same edit.

**(b) `steps.ts:72`'s `const commandTimeout` becomes `export const commandTimeout`**, JSDoc
unchanged, imported by `composite.ts` for both `runIntegrate` call sites.

**(c) `packages/core/src` holds exactly one definition of each.** A source test asserts the
expression `context.config.commands?.timeout_ms ?? 15 * 60_000` appears in exactly one non-test file,
and that `merge-base` still appears in exactly one.

Verification: a unit test asserts a real merge base for two divergent branches and `null` for a ref
that does not exist; `git.source.test.ts:46`'s byte pin on `packages/core/src/index.ts` stays green,
because **this ticket adds no public re-export**.

### AC-4 — the ticket branch catches up with the base *before* task worktrees are cut from it

Register row 7's sync clause; `engine.js:1010–1024`. `syncBaseIntoTicketBranch(step, context)` is
exported and returns a discriminated result so its four outcomes are each assertable:

- `{ skipped: 'base is the ticket branch' }` when the configured base is absent or equals `into`;
- `{ skipped: '<into> does not exist yet' }` — normal on a ticket's first pass, because only
  `integrate` creates the integration branch;
- `{ skipped: '<base> does not exist' }`;
- `{ ok: true }` after a successful `mergeInto`, having emitted `info`:
  `<id>: <into> synced to <base> before fan-out`;
- otherwise **throws `FlowError`** carrying `mergeFailure(m)` and ending *"no agent in this loop can
  repair a base conflict."*

`into` is `step.step?.base` — the fan-out template's base — falling back to `ticket.meta.branch`;
`base` is `config.repo?.base_branch` falling back to `'main'`. The spike's `ui?.info?.()` becomes an
unconditional `context.emit({ type: 'info', … })`: the optional chaining exists for a test fixture,
not for a run.

Verification: the three cells frozen at `smoke.js:693–733` port, rebuilt on `context.emit` — work
landed on the base is present on the ticket branch before any worktree is cut; a ticket with no
integration branch is skipped rather than failed; a genuine conflict throws and the message names
the work a human must do.

### AC-5 — the fan-out selects, plans and merges between waves

`engine.js:1026–1066`:

1. `loadTasks(ticket)`. With `fan_out.scope === 'failing-tasks-only'` **and** a truthy
   `context.failingTasks?.size`, narrow with `scopeToFailing` and emit `warn`:
   `<id>: scoped to failing tasks: <ids>`.
2. No tasks after selection → `FlowError('<id>: no tasks to fan out')`.
3. `syncBaseIntoTicketBranch` runs **unless `dry`**.
4. `fan_out.respect === 'depends_on'` → `waves(tasks)`; any other value → one wave. Emit the task
   and wave counts, then one `info` per wave listing `<task>(<role>)`.
5. Tasks within a wave run concurrently under **`Promise.all`, not `allSettled`** — a rejected task
   rejects the wave. Waves run in order.
6. **The wave's results are inspected after it settles, and only a result carrying `goto` or `abort`
   short-circuits the remaining waves** — `results.find((r) => r?.goto || r?.abort)`, returned as-is.
   *Taken from codex over Claude's "the first member returning a non-`null` `StepResult`", which is a
   wider condition than the spike's and would change routing.*
7. Between waves and **not after the last**, each task branch in the wave is merged into the ticket
   worktree; a failure emits `warn` and the run continues.

Verification: a two-wave `tasks.yaml` with a `depends_on` edge produces the wave events in order; a
child returning `{ goto }` in wave 1 leaves wave 2 unrun; a child returning a plain result does not.

### AC-6 — the child template is cloned per task, and `runAgentStep`'s `extra` is supplied exactly as landed

- The template is deep-copied per task with **`JSON.parse(JSON.stringify(step.step))`**, not
  `structuredClone`. The two differ on `undefined`-valued keys, which changes which template fields
  fall through to the role default, and the copy is what stops one task's interpolated `id` leaking
  into the next. An authority line names why.
- `tpl.id` (default `<step.id>:{task.id}`), `tpl.role` (default `developer-{role}`), `tpl.adapter`,
  `tpl.model` and the branch (default `harness/{id}/{task.id}`) are interpolated as the spike does —
  `id` and branch over `{ ...context.vars, ...taskVars(task) }`, `role`, `adapter` and `model` over
  `taskVars(task)` alone. `tpl.worktree = true` is forced. The sentinels `'{role.adapter}'` and
  `'{role.model}'`, and an absent value, fall back to the role file's frontmatter, with `'claude'` as
  the last adapter fallback.
- `context.fanned` gains `{ task: task.id, branch, role: task.role }` — **`task.role`, not the
  interpolated `tpl.role`.**
- `runAgentStep(tpl, context, extra)` is called with all three fields of the **landed**
  `AgentStepExtra` (`steps.ts:37–45`): `vars: taskVars(task)`, `syncBase: true`, and a `promptSuffix`
  closure returning `taskPromptSection(task, cwd)` plus, when `context.lastIntegration` is set, a
  `## Previous integration result` section capped at 4,000 characters. **The interface is supplied,
  not reshaped** — Q-0052 ported it ahead of its only producer for exactly this reason, and
  `agent-step.test.ts:263` pins it.

Verification: one `runAgentStep` call per task carrying its own `extra`; `agent-step.test.ts:263`
stays green unchanged; a `structuredClone` substitution is caught by a template carrying an
`undefined`-valued key.

### AC-7 — integrate resolves its target and branch list, and records the evidence

`engine.js:1068–1095`, in this order:

1. `into` = interpolated `step.into`, else `ticket.meta.branch`. A `step` event carrying
   `integrate → <into>` is emitted **before** the dry short-circuit, so a dry run reports the step.
2. Under `dry`, **return `null`** — before allocating an occurrence, before touching git, before any
   command, ticket write or log line.
3. Allocate an `integrate` occurrence through `context.persistence.allocateOccurrence`, mirroring the
   two landed callers' `if (occurrence === null) return null;` (`steps.ts:238`, `:347`) — unreachable
   outside dry, and representable in the type, which is why it is written rather than asserted away.
4. `dir = ticketWorktree(repoDir, into)`.
5. Branch list: an explicit array is interpolated member-wise in declared order; a scalar pattern
   containing `*` resolves to `context.fanned`'s branches **de-duplicated preserving first-seen
   order**; any other scalar is a one-element list. The list is then filtered by `branchExists`,
   which preserves the spike's silent drop rather than introducing an error.
6. `notes` opens `# Integration — run <runId>, iteration <iter>`, a `Target:` line, then
   `Evidence: \`<into>\` at <short-sha|(new)>, base \`<base>\`.` and — for each member of the
   **unfiltered explicit array only** — `Evidence: \`<b>\` diverges from \`<into>\` at <short-sha>`
   wherever `mergeBase` answered.

Verification: a fixture repository with a two-commit ticket branch and two task branches produces the
notes header byte-for-byte in the documented order; the glob path is exercised by seeding
`context.fanned` with a duplicate branch and asserting one merge; a dry run creates no worktree, no
occurrence, no `runs.log` line and no ticket write.

### AC-8 — the base is merged first, and a base conflict stops the run rather than looping

`engine.js:1099–1120`. When the configured base is non-empty, differs from `into` and exists, it is
merged into `dir` **before** any source branch. Notes gain `- ✓/✗ base \`<base>\`` with
`mergeFailure(m)` on failure, and `info`/`warn` is emitted to match.

On failure the step, in this order: writes `notes` to **every** path in `writesOf(step)`; appends
`run=<n> step=<id> base-conflict base=<base> files=<conflicts|?>` to `runs.log`; then **throws
`FlowError`** whose message states that this is a conflict between the ticket branch and the base,
that re-running the developers cannot fix it because their worktrees branch from `into` where nothing
is wrong, and that the maintainer must merge the base into `into` and re-run.

**No backward edge, no `handleFail`, no iteration consumed.** Q-0011 spent its whole budget and $8.63
rediscovering this conflict three times.

Verification: a fixture with a genuine base conflict asserts the artifacts and the `runs.log` line
exist **before** the throw, and that a declared `on_fail` counter did not move.

### AC-9 — install before test, and neither a killed command nor a broken environment is a result

Register row 7, clauses 1–3. `engine.js:1128–1152`.

**(a) Install.** `commands.install` runs in `dir` under `commandTimeout`, **only when a test command
was resolved and only when `conflicts` is empty**, appending `Install: \`<cmd>\` → exit <code>` to
the notes and emitting `info`/`warn`. A non-zero exit sets
``envError = 'install failed (`<cmd>` exited <code>)'``, captures the install output as `out`, and
**the test command does not run**.

**(b) The test command** runs in `dir` only when a command was resolved, `conflicts` is empty and no
`envError` is set, under the same `commandTimeout`, retaining its combined captured output.

**(c) Invalidation precedes expectation.** `result.timedOut` yields `the test command did not finish
within <n> minutes and was killed`, where `n` is `Math.round((result.timeoutMs ?? 0) / 60000)`;
otherwise `environmentFailure(out)` decides. Either becomes
`envError = 'the suite never ran — <reason>'` with `testsOk = false`. **`expect` is applied only when
neither holds**: `expect === 'fail' ? code !== 0 : code === 0`, default `'pass'`.

**(d) The notes line** reads `Tests: \`<cmd>\` → exit <code> (expected <expect>) → OK|NOT OK|INVALID`.

**(e) An `envError` throws `FlowError`** after the artifacts are written, the occurrence closed
`failed` and the log line appended (AC-12). It never reaches `on_fail` and never spends an iteration.
The thrown sentence keeps its second half — *"The report is on disk, but it is not evidence of
anything — fix the environment (`commands.install` in `harness.yaml`) and re-run"* — because naming
the remedy is what stops the loop being re-entered by hand.

Verification: a matrix — `commands.install` writing a marker the test command asserts (the shape
`smoke.js:84` uses end to end, at unit level here); a failing install proving the test command was
never spawned; `node -e "process.exit(1)"` under `expect: fail` counting as red; the same with a
missing-module crash reporting `INVALID` and throwing; a command sleeping past a 50 ms
`commands.timeout_ms` reporting the timeout wording and throwing. Each cell declares an `on_fail` and
asserts its counter did not move.

### AC-10 — an environment signature on a line that reports a result is ignored, and the two regexes stay distinct

Register row 7, clause 4 — *"port that reasoning, not just the regex."*

`environmentFailure(out = '')` strips ANSI colour codes **per line first**, then drops every line
whose start matches its own exclusion filter — `✓ ✗ × √`, `ok`/`not ok`, `#`, `<n>)` — and only then
tests the six `ENV_FAILURES` patterns against what remains, returning the first description or
`null`. The signatures stay deliberately narrow: missing package, missing module,
`ERR_MODULE_NOT_FOUND`, a `SyntaxError`, `: command not found`, `ERR_REQUIRE_ESM`. **`npm ERR!` is
not added** — npm prints it for every ordinary failure.

**The exclusion filter is not `RESULT_LINE` and must not become it.** Per R-6 the two differ three
ways — inline versus pre-stripped ANSI, `#\s` versus `#`, and `PASS|FAIL|SKIP` present only in
`RESULT_LINE`. A test pins the divergence directly: a line beginning `FAIL test/x.test.js` that also
carries `Cannot find module 'y'` **is** an environment failure, and is not one if the two constants
are unified. Without it, sharing one regex is green over all thirteen frozen vectors.

Both regexes are written with `\x1b` escape sequences and never a pasted ESC byte:
`q0050.source.test.ts:107` forbids `\[` anywhere in this folder and the guard is correct — an
engine module that emits terminal control characters cannot host M3's daemon.

Verification: the thirteen vectors frozen at `smoke.js:504–544` port verbatim — five detected with
their exact descriptions, three genuine failing suites that stay red including the `npm ERR!` one,
four signatures quoted **inside** result lines (one ANSI-wrapped) returning `null`, and one crash on
its own line after passing checks that is still caught — plus the R-6 discriminator above.

### AC-11 — the report keeps every result line whole, whatever it truncates

`testReport(cmd, out, { maxBytes = 24000 })` emits, in order: a `# Test output` heading; the command
in backticks; **a roster of every line matching `RESULT_LINE`, in source order, complete and
untruncated, taken from the full output rather than from the retained body**; then `## Output`, kept
whole at or under `maxBytes` and otherwise `slice(0, 12000)` + an omission marker naming
`body.length - maxBytes` characters + `slice(-12000)`. Where no line matches, the roster is replaced
by `_No lines in the output looked like test results._`.

The roster is the point and the byte count is not: Q-0033 measured a previous shape that kept the
last 8,000 characters, on which seven of nineteen failing groups had no line in the report at all, so
the reviewer judging the red phase never saw them.

Verification: the four assertions frozen at `smoke.js:291–302` port verbatim — a result line at the
very start and one at the very end both survive a 900-line body, the cut is in the middle and says
so, the command is named — plus the no-results case, plus one cell **codex contributed**: output well
past 24,000 characters with result lines **in the omitted middle**, proving every one of them is
still in the roster.

### AC-12 — every terminal outcome is written, and the artifact routing is preserved

Register row 6's integrate half; `engine.js:1155–1179`.

- Each path in `writesOf(step)` is interpolated and written to the ticket, receiving
  `testReport(cmd, out)` when **the path contains the substring `report`** and the notes document
  otherwise. Preserved as-is: it is what routes `dev/green-report.md` and `dev/integration.md`
  differently in `development.yaml:27`.
- `output.txt` is persisted beside the occurrence through the seam **always**, empty included.
- `runs.log` gains exactly
  `run=<n> step=<id> merged=<kept − conflicts>/<kept> tests=<ok|fail|invalid|->`, where `kept` is the
  **filtered** branch list, not the declared one, and `tests` is `-` when no command was resolved.
- Occurrence lifecycle: `completed` on success; `failed` with `error.category: 'integrate'` on an
  `envError`, on conflicts, and on an unmet expectation, each with its own sentence-form message.
- On success, `done` is emitted — `<n> branch(es) on <into>` plus, where a command ran,
  `, tests red as expected` or `, tests green` — and `context.failingTasks` is set to `null`.
- On failure (`conflicts.length || !testsOk`): `context.lastIntegration` becomes the notes plus the
  last 3,000 characters of output; `context.failingTasks` becomes **the conflicting tasks** where
  there were conflicts and **every fanned task** where tests failed without conflicts (the agents
  need the test output). *Codex's clause is taken here:* the conflict path maps branches through
  `context.fanned` and **drops what does not resolve**, so an unknown branch never becomes an
  `undefined` task id.
- Then `handleFail(step, context)` when the step declares `on_fail`, `{ abort: true }` otherwise.

Verification: a failing integrate with no `on_fail` returns `{ abort: true }` and the engine's
rollback restores the ticket branch head; the conflict and test-failure paths produce different
`failingTasks` sets from the same fixture; `smoke.js`'s abandoned-merge block (`:305–335`) stays on
the spike per charter §5 and its behaviour is covered here at unit level.

### AC-13 — every value that arrives from a flow file is coerced at its call site

`interpolate`'s parameter is typed `string` deliberately (`loaders.ts`), so a number-valued call site
is a compile error here rather than the spike's silent pass-through. This ticket is the last of
Q-0050 E-21's list. Each site writes an explicit `String(...)`; **none is silenced with a cast or a
type assertion**:

| Site | Spike | Why it can be a non-string |
| --- | --- | --- |
| `step.into` | `:1070` | `into: 2` in YAML is a number |
| `step.branches` as a pattern | `:1076` | an **array**, evaluated unconditionally; `String(['a','b'])` is `'a,b'` and is then discarded |
| each explicit `step.branches` member | `:1077` | as above |
| `step.run_tests` | `:1128` | the schema types it `boolean \| string` |
| each `writesOf(step)` entry | `:1155` | flow-authored |
| `tpl.id`, `tpl.role`, `tpl.adapter`, `tpl.model`, branch | `:1044–1049` | flow-authored template |
| `step.step?.base` | `:1012` | flow-authored |

`RunContext`'s three cross-step fields are declared in `types.ts`, each with JSDoc, as its own
comment at `:146–147` already authorises: `fanned?: FannedTask[]` where `FannedTask` is
`{ task: string; branch: string; role: string }`, `failingTasks?: Set<string> | null`, and
`lastIntegration?: string`. They stay **optional and assigned by the step**, mirroring the spike, so
`engine.ts` needs no change and `engine.test.ts:533`'s landed cross-step test keeps its subject.

The `cmd.*` namespace is preserved (R-4): a string `run_tests` interpolates over `context.vars`
**plus** `commands` flattened under the `cmd.` prefix. **AC-13 gives it its first test in either
tree** — a step declaring `run_tests: "{cmd.test} --silent"` against a `harness.yaml` whose
`commands.test` is `echo hi` resolves to `echo hi --silent`. Without it, deleting `flatten` is green
everywhere.

### AC-14 — the five landed source guards this ticket moves, and the preserved-defect register

Four guards move, each in the same edit as the change that moves it, and none of them is loosened:

1. `q0050.source.test.ts:82` — `production` is derived from the corpus and the `toStrictEqual` list
   moves from nine names to eleven; the test's title moves with it.
2. `git.source.test.ts:27–32` — eight sorted export names become nine (AC-3a).
3. `git.source.test.ts:35–44` — `merge-base` still appears in exactly one file, now with a second
   caller.
4. `run-composition.test.ts:162–170` — replaced per AC-1.

Each preserved defect carries **one concise `Why:` authority line** in the file that holds it, naming
this ticket and its criterion, and **no line transcribes a sentence from `docs/DECISIONS.md` or this
ticket body** (`q0050.source.test.ts`'s AC-13d scan). At minimum:

1. **The inter-wave merge re-derives the task branch** as `harness/<id>/<task>` and ignores the
   branch recorded in `context.fanned`, and merges into `ticket.meta.branch` rather than the
   fan-out's declared base — R-3.
2. **A wave merge failure warns and the run continues**, so a later wave can build on a tree missing
   its predecessor's work.
3. **The five branch-filter sites** — two `branchExists` in `syncBaseIntoTicketBranch`, one for the
   base and one for the branch list, one `branchHead` for the evidence line — cannot tell an absent
   branch from a failed git and filter identically either way. This is the row
   `contracts/Q-0050/lifecycle-routing.contract.md:94` assigns to this ticket by name; the fix is
   Q-0074.
4. **The `mergeFailure` consumers** fall back to `git reported no reason` on an empty error, per that
   contract's next row.
5. **The evidence loop calls `mergeBase` on the unfiltered explicit array**, so a branch that does
   not exist is asked about anyway.
6. **`mergeBase` captures git's stderr where `safeMergeBase` inherited it** — the accepted divergence
   ruled in OQ-2.

`q0050.source.test.ts:164–189`'s `REGISTERED` map gains an entry for each new engine file, and the
cross-file `preserved defect/` count moves from **11** to whatever lands. **The prose comment above
that assertion enumerates which file contributes what and moves in the same edit** — Q-0052's R-5
names the trap exactly: a change that moves the number and not the comment leaves a comment
describing a number that is no longer there.

### AC-15 — green forced, in both environment rows, and the spike byte-unchanged

Per Q-0072's closing finding, verified rather than taken from `integrate`'s tick: `pnpm turbo run
test --force`, `pnpm lint`, `pnpm typecheck`, `npm test --prefix spike`, `harness lint` run **inside**
the worktree, `pnpm sweep:git-identity`, and the port-freeze branch-scope job — first inside the
`integrate` worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main`
after the merge, where both exist. TypeScript stays strict: no `any`, no new `@ts-ignore`, no
deprecated API. `spike/**` is byte-unchanged.

---

## Size

Fifteen criteria is my ceiling and this sits on it. I am not splitting it, and the reason is
mechanical rather than aesthetic: the one natural seam — `suite-output.ts`'s two pure detectors, which
need no repository and no worktree, away from `composite.ts` — would create a child that
`harness/port-charter.md:264`'s machine-readable `children:` list does not contain. That list ends at
Q-0054, and a ticket outside it is reported out of scope by the branch-scope job (Q-0057 is the
precedent). The seam would buy a second requirements run, a second chore run and a second review
panel for roughly forty lines of pure string handling, and it would separate register row 7's four
clauses across two tickets, which is the one grouping the charter assigns as a unit. If the gate
disagrees, the split is `suite-output.ts` first and `composite.ts` second, in that order, because the
detectors have no dependency on the composite steps and the composite steps consume both.

Codex's document was returned to fifteen from eighteen criteria carrying roughly ninety sub-clauses,
of which a substantial share re-specified plumbing Q-0048 already landed (`mergeInto`, `waves`,
`branchExists`, the worktree machinery) or restated the charter as criteria (its AC-16, AC-18). Those
are non-goals and a cross-cutting table, not acceptance criteria; a reviewer asked to check ninety
clauses checks none of them.

---

## Non-goals

Charter §6's standing list applies without restatement: another child's module; editing `spike/**`
(§3); fixing a defect found while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting
the event stream; anything on v1's exclusion list. Specifically here:

- **No public re-export.** `packages/core/src/index.ts` stays byte-identical and
  `git.source.test.ts:46` pins it.
- **No flow file, template or schema change.** `packages/shared/src/flow.ts:241–246` already types
  `branches`, `into`, `run_tests` and `expect`, and `fanOutSchema` already types the fan-out.
  `run-manifest-v1` is unaffected: the `integrate` occurrence kind and its `error.category` exist and
  `engine.ts:59` already maps it.
- **No behaviour change.** The one authorised exception was spent on Q-0050's event stream. The
  single divergence this ticket accepts is OQ-2's captured stderr, ruled below and registered under
  AC-14.
- **Q-0055 is not fixed here** — `lintFlow` requires an `id` on no step kind, so an id-less fan-out
  step creates `harness/<ticket>/undefined`. Visible from this code, owned by Q-0055.
- **Q-0074 is not fixed here** — the five sites' inability to tell git failing from a branch being
  absent.
- **Q-0078 is not fixed here** — `ctx.diffInputs` stays keyed by range alone and `prompt.ts:157`'s
  pin is untouched.
- **Q-0062 is not fixed here** — nothing removes a worktree and this ticket adds no
  `removeWorktree` call. Nor is register row 20's `finish()` task-branch gap.
- **The qa-red ownership rules are not enforced here** — every file a red test requires being owned
  by exactly one task, and a red test being permanent, are both the qa-red gate's.
- **No budget-cap enforcement**, no automatic conflict resolution, no retry of work no agent in the
  loop can perform.
- **The CLI-driven end-to-end suites stay on the spike** (charter §5): `smoke.js`'s fan-out/integrate
  end-to-end block, the abandoned-merge rollback and the base-conflict run transfer at Q-0054/Q-0010.
  This ticket ports the three **library-level** blocks and covers the end-to-end behaviours at unit
  level.

---

## Open questions

All four are ruled here rather than carried. None blocks the implement step.

**OQ-1 — the ninth export in `git/git.ts`. Ruled: authorised.**
A reviewer may read AC-3(a) as *"porting another child's module"*, which the charter names a
non-goal. It is not: charter §6 assigns Q-0042 `spike/src/git.js`, and `safeMergeBase` lives in
`spike/src/engine.js` and is therefore this ticket's to port. What is not this ticket's choice is
**where** — a landed guard permits `merge-base` in exactly one file. The deliberate part is moving
Q-0042's eight-export identity assertion to nine, which is a test edit and belongs in the implement
report rather than done quietly. If a reviewer disagrees, the channel is `requirements/errata.md`
written **during** the loop, as soon as the contradiction is provable — see *"A refused finding is a
gate, not another round"* (2026-08-31).

**OQ-2 — `mergeBase` captures git's stderr where `safeMergeBase` inherited it. Ruled: accepted,
registered, reported.**
This is a genuine charter §2 divergence — §2 counts *"what a command prints"* as externally
observable, and the spike's `execFileSync` with default stdio lets a failing `merge-base` print git's
own `fatal:` line to the terminal, which `git.ts`'s piped `git()` swallows. It is accepted **here, in
the requirement, before implementation**, which is precisely the route §2 names (*"its own
`docs/DECISIONS.md` entry or a dated erratum in the child's folder, written and accepted before it is
implemented"*); ruling it now rather than at an erratum is *"An erratum is the last repair, not the
first"* (2026-08-30) applied forwards. The alternative — a second stdio mode on `git()` for one
caller — is refused because `git.ts`'s single argv-and-piped-stdio shape is a Q-0042 criterion with
its own guard, and a library that prints to a process stream is what M3's daemon cannot host. It
touches no artifact, no `runs.log` line, no branch, no worktree and no stop point, and it is
reachable only through the evidence loop's deliberately unfiltered list. Registered under AC-14(6)
and named in the implement report.

**OQ-3 — how many `preserved defect/` markers land. Owner: the implementer, resolved by the code.**
AC-14 lists six sites; the register's flat count moves from 11 by however many markers the
implementation writes. The number is deliberately not fixed in advance — a number invented before the
code is the shape `q0050.source.test.ts`'s own comment condemns. What is fixed is that the number and
the prose comment move together.

**OQ-4 — `TicketRecord` against `loadTasks(ticket: TicketFolder)`. Ruled: closed, no work.**
Measured: `fanout.ts:70–78` declares `TicketFolder` as `{ dir: string }` and its JSDoc states
*"Structural on purpose. `TicketRecord` from `backlog/` is assignable to it"*; `TicketRecord`
(`backlog.ts:30–37`) carries `dir: string`. It satisfies it structurally today. No widening and no
cast. Re-measure before writing, as with every line number here.

*Codex's OQ-1 (file boundary) is ruled by AC-2. Codex's OQ-2 (a newly discovered defect) is not an
open question but the standing charter §2 procedure — stop, report the spike behaviour, the core
behaviour and the user-visible consequence, and let the human gate decide; Risk 7 below is what makes
that expensive today.*

---

## Risks

1. **`structuredClone` substituted for the JSON round-trip** in `runFanOut`. It is the idiomatic
   TypeScript choice and it is not equivalent — it preserves `undefined`-valued keys, changing which
   template fields fall through to the role default. AC-6 names the shape; a reviewer should check
   the call, not the comment.
2. **One shared result-line regex.** With `testReport` and `environmentFailure` now in the same file,
   unifying `RESULT_LINE` with the detector's exclusion filter is the obvious tidy-up, is a behaviour
   change, and passes all thirteen frozen vectors. R-6 and AC-10.
3. **A literal ESC byte in the ANSI regexes.** Written `\x1b` they are four source characters and
   `q0050.source.test.ts:107` stays green; pasted from a terminal they are one byte and the whole
   folder fails. Cheap to hit, cheap to check.
4. **The environment detector is beaten by its own test suite.** It has happened once (Q-0004 run 6).
   A ported test file printing `Cannot find package 'yaml'` in a **pass** message on a line without a
   marker will reject a genuine red phase. AC-10's four in-result-line vectors exist for this; keep
   them.
5. **The register arithmetic is cross-file** and fails in both directions by design. Moving
   `q0050.source.test.ts:189` without moving the comment above it passes and reads as done.
6. **`harness/Q-0053/integration` does not exist** — verified today, `git branch --list` returns
   nothing — and charter §8 requires it before the first chore run, because `review` diffs against it
   and only `integrate`, which runs later, creates it. This is what cost Q-0035 $13.86. Since Q-0038
   the preflight refuses before billing rather than after, so the failure is now cheap; the branch is
   still owed.
7. **Q-0083 does not exist yet.** If a review round demands something charter §2 forbids, the
   implement step has no verdict to refuse with and its only channel is prose the human reads at the
   gate. That is the shape that cost Q-0052 three rounds. Plan for it rather than discovering it at
   round 3 — and note that OQ-2 above is pre-ruled precisely to remove the most likely trigger.
8. **No bootstrap problem, stated so nobody spends time on it.** This ticket's own chore run executes
   `chore.yaml`'s `integrate` **on the spike**, which is unfrozen-in-place and unaffected. The ported
   `integrate` is exercised by the workspace suite, not by the run that writes it.
9. **The line numbers above go stale.** Measured at `9204f93`; Q-0051's were wrong within ten hours.
   Re-derive at the implement branch's SHA.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a. No adapter is resolved here; `runFanOut` delegates every adapter decision to the landed `runAgentStep`. No environment variable is read and no key path is created. |
| **Worktree safety** | Load-bearing. These are the two step kinds that create worktrees and merge branches. Every worktree comes from `ticketWorktree`/`ensureWorktree` under `.harness/worktrees/`; nothing is written to the user's working tree; the integration branch stays `harness/<id>/integration`. The literal `.harness/worktrees` is never re-spelled — it comes from `@quorum/shared` through `fanout.ts` and `git.ts`. A test proves the user's working tree is neither a command nor a merge target. |
| **Gate behaviour** | Unchanged. No new gate kind and none declared. An ordinary integration failure routes through `handleFail`, which owns the exhaustion gate; an `envError`, a timeout and a base conflict **bypass routing entirely** and throw, which is the point of register row 7's clauses 2 and 3. |
| **File format and schema** | No change. `flow.ts` already types every field these steps read; `run-manifest-v1` already carries the `integrate` occurrence kind and its `error.category`. Ticket artifacts, `runs.log` and `.quorum/` stay the persistent record. |
| **Cross-vendor rule** | Unaffected. Fan-out introduces no vendor-specific branching and no vendor-specific event field; every adapter decision is `runAgentStep`'s. |
| **Lint rules** | No new rule. Q-0055's id requirement and Q-0044's fan-out `input.diff` rule are landed or owned elsewhere. |
| **Cold-clone impact** | None. No new command, flag, dependency or configuration key; `integrate` uses the project's existing `commands.install` and `commands.test`. The first 30 minutes are unchanged. |
| **Product-agnostic** | No product name reaches the code, the tests or the fixtures. The BYOS refusal sentence Q-0068 owns is not on this path. |

---

## Verification summary

Three frozen `smoke.js` blocks port to Vitest and are the acceptance evidence for register row 7:
`:291–302` (`testReport`), `:504–544` (`environmentFailure`, plus R-6's discriminator, which is new),
`:693–733` (`syncBaseIntoTicketBranch`, rebuilt on `context.emit`). Three end-to-end blocks stay on
the spike per charter §5 and have their behaviour covered here at unit level: the install marker
(`:84`), the abandoned-merge rollback (`:305–335`) and the base-conflict stop (`:340–365`).

Both suites forced, in the `integrate` worktree and again on `main` after the merge; `harness lint`
run **inside** the worktree; `spike/**` byte-unchanged and the port-freeze branch-scope job clear.

---

## Provenance

**Base document: `candidate-claude.md`.** It is scoped to the ~200 lines that actually remain rather
than to the ticket's title, and three of its findings are load-bearing, absent from the codex
candidate, and confirmed by measurement today:

- **`failed` is not a `routing.ts` export** — verified, `routing.ts` exports `askGate`, `runStep`,
  `handleFail`. A port working from the ticket body's collaborator list would have hunted a symbol
  that is a local `const` in the spike's parallel block.
- **The inherited `s.into` obligation is discharged** — verified, `engine.js:166` is preflight code
  and `diff.ts:472` already coerces it. Q-0052 wrote this body's obligation 3 against a stale
  address; the live sites are seven, in `runIntegrate` and `runFanOut`.
- **`run-composition.test.ts:168` asserts the literal `'Q-0053'`** — verified. Codex's document does
  not mention it, so an implementer following it lands dispatch and turns a landed test red with no
  criterion telling them what it should become.

Also taken from Claude: the two-module layout and `suite-output.ts`'s no-imports property (AC-2); the
`mergeBase` address ruling and both `git.source.test.ts` guards (AC-3, OQ-1); the `occurrence ===
null` guard mirroring `steps.ts:238`/`:347` (AC-7); the `String()` coercion table (AC-13); R-3's
unrecorded inter-wave-merge defect; R-4's `{cmd.*}` namespace with zero coverage in either tree; the
ESC-byte risk; and the charter §8 branch obligation.

**Taken from `candidate-codex.md`, over Claude, in four places** — each a real correction rather than
a stylistic preference:

- **The wave short-circuit is `goto || abort`** (AC-5.6), not "the first member returning a non-`null`
  `StepResult`". The spike is `results.find((r) => r?.goto || r?.abort)`; Claude's wider condition
  would change routing on any child returning a plain result.
- **`failingTasks` must not admit `undefined`** from a branch absent from `context.fanned`
  (AC-12) — the spike's `.filter(Boolean)`, which Claude's "the conflicting tasks" leaves implicit.
- **`mergeBase` trims and returns `null` for any git failure**, stated as its own clause (AC-3a);
  `git()`'s existing `.trim()` satisfies it.
- **The base conflict deserves its own criterion** (AC-8) rather than a clause inside the artifact
  criterion, because its ordering — artifacts, then log, then throw, and never `handleFail` — is what
  Q-0011 paid $8.63 to learn.

Also from codex: the truncation cell with result lines **in the omitted middle** (AC-11), which
discriminates a roster built from the full output from one built from the retained body, and which
Claude's ported assertions do not; and the explicit `run_tests` falsy case running neither install nor
test (AC-9).

**Added by this merge, in neither candidate:** **R-6** — `RESULT_LINE` and `environmentFailure`'s
exclusion filter differ three ways on purpose (inline versus pre-stripped ANSI, `#\s` versus `#`, and
`PASS|FAIL|SKIP` present only in the roster's regex), and **none of the thirteen frozen vectors tells
them apart**, because the one `FAIL` vector carries no environment signature. With both functions
about to share a file, unifying them is the obvious tidy-up, is a behaviour change to register row
7's fourth clause, and is green in both suites. AC-10 pins the divergence with a test that fails when
the two constants are merged. Also added: the ruling closing OQ-4 on `fanout.ts:72`'s own JSDoc; the
`runs.log` `merged=` counts being over the **filtered** list; and the size argument for not splitting.

**Struck from codex as untestable or out of scope:** its AC-16 and AC-18 in bulk — "TypeScript remains
strict", "no deprecated API", "lint and typecheck remain green", "no adapter authentication behavior
is added", "production code adds no knowledge of a specific SaaS product". These are the engineering
rules and the charter; restating them as acceptance criteria dilutes a reviewer's attention across
ninety clauses. They survive as AC-15 and as the cross-cutting table. Also struck: its re-specification
of `mergeInto`, `waves`, `branchExists` and the worktree machinery, all of which Q-0048 landed and
none of which this ticket writes.
