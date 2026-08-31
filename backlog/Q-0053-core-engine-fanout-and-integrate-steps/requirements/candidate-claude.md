# Q-0053 — `core/engine`: fan-out and integrate steps

*Requirement, 2026-08-31. Written against the working tree at `9204f93`, not against the ticket
body. Every line number below was measured today at that SHA; Q-0051's body was wrong within ten
hours, so re-derive them at the implement branch's own SHA before editing.*

---

## Problem

`packages/core/src/engine/routing.ts:102–103` holds two rejections:

```ts
if (step.type === 'integrate') return unavailableStep(step, 'Q-0053');
if (step.fan_out) return unavailableStep(step, 'Q-0053');
```

Those two lines are the last step kinds the ported engine cannot run. Three of the eight shipped
flows — `development.yaml`, `qa-red.yaml`, `chore.yaml` — declare an `integrate` step, and
`development.yaml` declares the only fan-out. Until they execute in `core`, `runFlow` can drive a
gate, a script, an agent and a panel, and cannot drive a single flow this repository actually runs
end to end. Q-0054 cannot begin: the regression suite it ports has nothing to run against.

The four behaviours in the way are the most expensive lesson M1 recorded. Register row 7 of
`harness/port-charter.md` — *"`integrate` installs dependencies in the worktree first, syncs the base
branch first, rejects a suite that could not start rather than counting it red, and ignores an
environment signature on a line that reports a result"* — is one row and four separate defects, each
of which made `expect: fail` accept something that was not a red phase. Every one of them is
invisible to a test that only checks the happy path: a port that drops the install still reports
`tests=ok` on a green run, and only lies on the ticket that mattered.

The `maintainer` reading `harness board` today sees a port eleven children deep whose engine cannot
integrate. The `contributor` reading `packages/core/src/engine/` sees nine modules and two `throw`s
where the work is.

## User stories

**As the `maintainer`,** I want `runFlow` to execute `development.yaml`'s fan-out and every flow's
`integrate` step in `packages/core`, so that a run driven by the ported engine merges the same
branches, installs before it tests, refuses the same suites, writes the same `runs.log` lines and
stops in the same places as the spike does — and so Q-0054 has something to gate.

**As the `contributor`,** I want the four invariants that make a red phase trustworthy to be
checkable in `core` without a repository or an adapter, so that changing the environment detector or
the report is a decision I take deliberately rather than one I make by accident.

**Surface:** `packages/core` only. No CLI surface, no daemon, no UI, no `harness/` flow file, no
`backlog/` write, no schema change. `spike/**` is frozen (charter §3).

---

## What is actually left, measured

The ticket body's line map, re-derived at `9204f93`, holds — with three corrections that change what
gets written.

**Six spans, 200 lines.** `syncBaseIntoTicketBranch` `:1010–1024`, `runFanOut` `:1026–1066`,
`runIntegrate` `:1068–1179`, `environmentFailure` + `ENV_FAILURES` `:1185–1208`, `testReport` +
`RESULT_LINE` `:531–548`, `safeMergeBase` `:550–553`. Plus one module-private helper the body does
not name: `flatten` (`:1210`), whose only caller is `runIntegrate`'s `run_tests` interpolation.

**Every collaborator is already in `core`, and one named in the body does not exist.** The body lists
*"`handleFail` and `failed` from `routing.ts`"*. `routing.ts` exports `askGate`, `runStep` and
`handleFail`; `failed` is a local `const` inside the spike's parallel block (`engine.js:214`) and is
not a helper. Nothing else on that list is wrong: `loadTasks`, `waves`, `taskVars`,
`taskPromptSection`, `scopeToFailing`, `ticketWorktree`, `branchExists`, `branchHead`, `mergeInto`
and `IntegrationError` are `fanout/fanout.ts`; `runCommand` is `fanout/command.ts`; `interpolate`,
`loadRole` and `writesOf` are `engine/loaders.ts`; `runAgentStep` and `mergeFailure` are
`engine/steps.ts`; the occurrence seam is `RunPersistence.allocateOccurrence` / `.persistArtifact` /
`.terminalOccurrence` on `engine/types.ts`.

### R-1 — `safeMergeBase` cannot be written in the engine folder, and its address is dictated

`packages/core/src/git/git.source.test.ts:35–44` is a landed guard:

> `merge-base` and `--is-ancestor` appear in `git.ts` and in no other source file

It iterates every entry of `coreSourceFiles()` and asserts `text.includes('merge-base') === (name
=== 'git/git.ts')`. A `safeMergeBase` written into any engine module fails it on the first run. The
ticket body correctly says `ancestry` is not a substitute — it answers a boolean — and correctly
says the function would otherwise be lost. It does not say where it may live, and there is exactly
one answer.

The same file, at `:27–32`, asserts `Object.keys(gitModule).sort()` equals **exactly eight** names.
So this ticket adds a ninth export to a module Q-0042 landed and moves that identity assertion from
eight to nine. That is deliberate and must be argued in the implement report rather than done in
passing — see OQ-1, where the argument is pre-made.

`git/git.ts` already carries both primitives this needs: `git(args, cwd)` (`:14`), which runs
`execFileSync` with an argv array and `stdio: ['ignore','pipe','pipe']`, and `safe(fn)` (`:17`),
which is `try { return fn(); } catch { return null; }`. The function is two lines over existing
parts.

### R-2 — the inherited coercion obligation is already discharged at the line it names

Q-0052 wrote into this body: *"`s.into` is this ticket's coercion site (`spike/src/engine.js:166`),
the last of Q-0050 E-21's list."* Line 166 is inside the **run-level diff preflight**, which Q-0051
ported — `packages/core/src/engine/diff.ts:472` already reads:

```ts
if (s.type === 'integrate' && s.into) remember(interpolate(String(s.into), context.vars), stepId);
```

The obligation is real and the address is stale by one ticket. The live sites are in `runIntegrate`
and `runFanOut`, and there are more of them than one — see AC-13. The one nobody has named is
`engine.js:1076`, `const pattern = interpolate(step.branches, ctx.vars)`, which the spike evaluates
**unconditionally, including when `step.branches` is an array**: `String(['a','b'])` is `'a,b'`, the
value is then discarded by the `Array.isArray` branch two lines down, and it is harmless there and a
compile error here.

### R-3 — an unrecorded preserved defect in the inter-wave merge

`runFanOut` records each task's real branch — `ctx.fanned.push({ task, branch, role })` at `:1051`,
where `branch = interpolate(tpl.branch ?? 'harness/{id}/{task.id}', …)` — and then, at `:1061`,
merges a **re-derived** name:

```js
for (const t of wave) { const m = mergeInto(tw, `harness/${ticket.meta.id}/${t.id}`); … }
```

A flow whose `step.branch` template is anything else has its earlier waves merged from a ref that may
not exist, and the failure is a `ui.warn` rather than a stop, so the next wave builds on a tree
missing its predecessor's work. It is latent because `development.yaml:11` declares exactly
`harness/{id}/{task.id}`, which is the same string by coincidence rather than by construction. It is
also merged into `ticket.meta.branch` rather than into the fan-out's declared `step.base`, which are
the same value in the one shipped flow and need not be.

Preserved, not fixed (charter §2). It gets a `Why:` marker and a test that pins the re-derivation, so
a later change is deliberate.

### R-4 — a whole interpolation namespace with zero coverage in either tree

`engine.js:1128` builds the test command:

```js
const cmd = step.run_tests === true ? ctx.config.commands?.test ?? 'npm test'
  : step.run_tests ? interpolate(step.run_tests, { ...ctx.vars, ...flatten(ctx.config.commands ?? {}, 'cmd') })
  : null;
```

`flatten` exposes `harness.yaml`'s `commands` block to a string `run_tests` as `{cmd.test}`,
`{cmd.install}`, `{cmd.lint}`. `grep -rn '{cmd\.'` over `harness/`, `spike/`, `packages/` and
`contracts/` returns **nothing**. All six shipped flow files (three in `harness/flows/`, three in
`spike/templates/harness/flows/`) use `run_tests: true`; the one string form in the suite,
`smoke.js`'s `abandon.yaml`, is `"sh -c 'exit 1'"` and carries no placeholder. A port that drops
`flatten` compiles, typechecks and passes both suites. AC-13 gives it its first test.

### R-5 — `commandTimeout` exists in `core` and this ticket cannot reach it

Q-0052 ported `cmdTimeout` as `commandTimeout` (`steps.ts:72`), module-private. Its two remaining
spike call sites (`:1133`, `:1139`) are both inside `runIntegrate`. Ruled in AC-3: **export it from
`steps.ts`.** Duplicating is refused for the reason the body gives — two copies of a default drift
silently and nothing here would fail. Relocating it to a new module is refused because it would move
a symbol `runScript` already consumes for no gain; the `composite → steps` import edge exists anyway,
since `runFanOut` calls `runAgentStep`.

---

## Acceptance criteria

### AC-1 — Two new modules, each with a property a test can state

`packages/core/src/engine/` gains exactly two files, and the folder becomes **eleven** modules:

- **`composite.ts`** — `runFanOut`, `runIntegrate`, `syncBaseIntoTicketBranch`, and module-private
  `flatten`. The two composite step kinds and the sync that must precede one of them.
- **`suite-output.ts`** — `testReport`, `environmentFailure`, and their two constants `RESULT_LINE`
  and `ENV_FAILURES`. **Its checkable property: it imports nothing at all** — no `node:` builtin, no
  sibling module, no `@quorum/shared`. Both functions are pure functions of a string, which is what
  lets register row 7's last two clauses be tested exhaustively without a repository, an adapter or a
  worktree, and what stops a later change reaching for the filesystem inside a detector.

`q0050.source.test.ts:82` currently asserts `toStrictEqual([… nine names …])` under the title *"the
owned folder is exactly nine documented modules"*. Both the list and the title move, in the same
edit. Every export in both new files carries its own JSDoc block, anchored on the export
(`q0050.source.test.ts:86`).

A source test in the new `q0053.source.test.ts` asserts `suite-output.ts` contains no `import`
statement, and demonstrates the scan fires over text that does — the positive control, per Q-0052's
precedent at `q0052.source.test.ts:44`.

*Rejected alternative:* one file for all six functions. It is 200 lines and would fit, but it makes
the two pure detectors reachable from a module that runs git and spawns commands, which is precisely
the coupling that let `environmentFailure` be beaten by its own test suite once already.

### AC-2 — `mergeBase` lands in `git/git.ts`, and its guard moves from eight to nine

`packages/core/src/git/git.ts` gains one export:

```ts
/** The merge base of two refs, or `null` when git could not answer — a missing ref among the reasons. */
export function mergeBase(repoDir: string, a: string, b: string): string | null
```

built over the file's existing `safe()` and `git()` helpers, so it inherits the argv array and the
captured stderr. `git.source.test.ts:27–32` moves to nine sorted names. `git.source.test.ts:46`'s
byte pin on `packages/core/src/index.ts` stays green: **this ticket adds no public re-export.**

`runIntegrate` is its only caller, at the evidence block.

Verification: the `merge-base`-in-one-file guard passes with the string present in `git/git.ts` and
absent from `composite.ts`; a unit test asserts a real merge base for two divergent branches and
`null` for a ref that does not exist.

### AC-3 — `commandTimeout` is exported, and `packages/core` holds exactly one definition of it

`steps.ts:72`'s `const commandTimeout` becomes `export const commandTimeout`, JSDoc unchanged.
`composite.ts` imports it for both `runIntegrate` call sites. A source test asserts the expression
`context.config.commands?.timeout_ms ?? 15 * 60_000` appears in exactly one non-test file under
`packages/core/src`.

### AC-4 — `runIntegrate` merges base first, then the resolved branch list, and records both

Preserved from `engine.js:1068–1120`, in order:

1. `into` = `String(step.into)` interpolated, else `ticket.meta.branch`. A `step` event is emitted
   with `integrate → <into>` **before** the dry short-circuit, so a dry run reports the step.
2. Under `dry`, return `null` — before allocating an occurrence, before touching git.
3. Allocate an `integrate` occurrence through the seam; mirror the two landed callers'
   `if (occurrence === null) return null;` (unreachable outside dry, representable in the type).
4. Resolve `dir = ticketWorktree(repoDir, into)`.
5. Resolve the branch list: an explicit array is interpolated member-wise; a pattern containing `*`
   resolves to `context.fanned`'s branches, **de-duplicated preserving first-seen order**; anything
   else is a one-element list. Then filter by `branchExists`.
6. Build `notes`, opening `# Integration — run <runId>, iteration <iter>`, a `Target:` line, then the
   evidence lines: `into`'s head short-sha or `(new)`, the configured base, and — for each member of
   the **unfiltered** explicit array only — `Evidence: \`<b>\` diverges from \`<into>\` at <sha>`
   where `mergeBase` answered.
7. Sync the configured base into `dir` when it differs from `into` and exists, appending a `- ✓/✗`
   line and emitting `info`/`warn`.
8. Merge each surviving branch, appending a `- ✓/✗` line per branch and emitting `info`/`warn`;
   collect failures into `conflicts`.

Verification: a fixture repository with a two-commit ticket branch and two task branches produces the
notes document byte-for-byte in the documented order; the glob path is exercised by seeding
`context.fanned` with a duplicate branch and asserting one merge.

### AC-5 — dependencies are installed in the integrate worktree before the test command runs

Register row 7, clause 1. `commands.install` runs in `dir` under `commandTimeout`, **only when a test
command was resolved and only when `conflicts` is empty**, and appends `Install: \`<cmd>\` → exit
<code>` to the notes. A non-zero install exit sets `envError` to ``install failed (`<cmd>` exited
<code>)``, captures the install output as `out`, and the test command **does not run**.

Verification: a step whose `commands.install` writes a marker file into the worktree and whose
`commands.test` asserts that marker's presence — the shape `smoke.js:84` already uses for the
end-to-end path (`.harness/worktrees/…/.installed`), at unit level here. A second cell with a
failing install asserts the test command was never spawned.

### AC-6 — a suite that could not start, and a command that never finished, are not results

Register row 7, clauses 2 and 3.

- A killed command (`result.timedOut`) yields `the test command did not finish within <n> minutes and
  was killed`, where `n` is `Math.round((result.timeoutMs ?? 0) / 60000)`.
- Otherwise `environmentFailure(out)` decides.
- Either way the reason becomes `envError = 'the suite never ran — <reason>'`, `testsOk` is `false`,
  and the notes line reads `→ INVALID` rather than `OK`/`NOT OK`.
- `expect` is applied **only** when neither holds: `expect === 'fail' ? code !== 0 : code === 0`.
- An `envError` **throws `FlowError`** after the artifacts are written and the occurrence closed
  `failed`. It never reaches `on_fail`, and therefore never spends an iteration.

The thrown sentence keeps its second half — *"The report is on disk, but it is not evidence of
anything — fix the environment (`commands.install` in `harness.yaml`) and re-run."* — because naming
the remedy is what stops the loop being re-entered by hand.

Verification: three cells — a `commands.test` of `node -e "process.exit(1)"` under `expect: fail`
counts as red; the same with a missing-module crash is `INVALID` and throws; a command sleeping past
a 50 ms `commands.timeout_ms` reports the timeout wording and throws. Each asserts `on_fail` was not
consulted, by declaring one and asserting the counter did not move.

### AC-7 — an environment signature on a line that reports a result is ignored

Register row 7, clause 4 — *"port that reasoning, not just the regex."*

`environmentFailure(out = '')` strips ANSI colour codes per line, **drops every line whose start
matches a result marker** (`✓ ✗ × √`, `ok`/`not ok`, `#`, `<n>)`), and only then tests the six
`ENV_FAILURES` patterns against what remains. `npm ERR!` is deliberately **not** a signature.

The thirteen vectors frozen at `smoke.js:504–544` port verbatim as the test table:

- five that must be detected, with their exact descriptions (`missing dependency "yaml"`,
  `missing module "./nope.js"`, `could not be resolved`, `does not parse`, `not installed`);
- three genuine failing suites that must stay red, including the `npm ERR!` line;
- four signatures quoted **inside** result lines — one of them ANSI-wrapped — that must return
  `null`;
- one crash on its own line after passing checks, which must still be caught.

The regexes are written with `\x1b` escape sequences, never a pasted ESC byte:
`q0050.source.test.ts:108` forbids a literal `[` anywhere in this folder, and the guard is
correct — an engine module that emits terminal control characters cannot host M3's daemon.

### AC-8 — the report keeps every result line whole, whatever it truncates

`testReport(cmd, out, { maxBytes = 24000 })` emits, in order: a `# Test output` heading; the command
in backticks; **a roster of every line matching `RESULT_LINE`, complete and untruncated**; then the
output, kept whole under `maxBytes` and otherwise head-12,000 + an omission marker naming the
character count + tail-12,000. Where no line looks like a result, the roster is replaced by
`_No lines in the output looked like test results._`.

The roster is the point and the byte count is not. Q-0033 measured a previous shape that kept the
last 8,000 characters, on which seven of nineteen failing groups had no line in the report at all,
so the reviewer judging the red phase never saw them.

Verification: the four assertions frozen at `smoke.js:288–302` port verbatim — a result line at the
very start and one at the very end both survive a 900-line body, the cut is in the middle and says
so, and the command is named — plus the no-results case.

### AC-9 — the ticket branch catches up with the base *before* task worktrees are cut from it

Register row 7's sync clause, and `engine.js:1010–1024`. `syncBaseIntoTicketBranch(step, context)` is
exported and returns a discriminated result so its three outcomes are assertable:

- `{ skipped: 'base is the ticket branch' }` when the configured base is absent or equals `into`;
- `{ skipped: '<into> does not exist yet' }` — normal on a ticket's first pass, because only
  `integrate` creates the integration branch;
- `{ skipped: '<base> does not exist' }`;
- `{ ok: true }` after a successful `mergeInto`, having emitted `info`: `<id>: <into> synced to
  <base> before fan-out`;
- otherwise **throws `FlowError`** carrying `mergeFailure(m)` and the sentence ending *"no agent in
  this loop can repair a base conflict."*

`into` is `step.step?.base` — the fan-out template's base — falling back to `ticket.meta.branch`.
`ui?.info?.()` becomes `context.emit({ type: 'info', … })`, unconditionally: the spike's optional
chaining exists for a test fixture, not for a run.

Verification: the three cells frozen at `smoke.js:693–733` port, rebuilt on `context.emit` — work
landed on the base is present on the ticket branch before any worktree is cut; a ticket with no
integration branch is skipped rather than failed; a genuine conflict throws and the message says a
human must resolve it.

### AC-10 — the fan-out expands tasks into waves and supplies `runAgentStep`'s `extra` as landed

`engine.js:1026–1066`:

- `loadTasks(ticket)`; when `step.fan_out.scope === 'failing-tasks-only'` **and**
  `context.failingTasks?.size` is truthy, narrow with `scopeToFailing` and emit `warn`:
  `<id>: scoped to failing tasks: <ids>`.
- No tasks → `FlowError('<id>: no tasks to fan out')`.
- `syncBaseIntoTicketBranch` runs **unless dry**.
- `respect: 'depends_on'` → `waves(tasks)`; anything else → one wave. `info` per wave listing
  `<task>(<role>)`.
- Per task, the step template is deep-copied with **`JSON.parse(JSON.stringify(step.step))`**, not
  `structuredClone`. The two differ on `undefined`-valued keys, and the copy is what stops one task's
  interpolated `id` leaking into the next. An authority line names why.
- `tpl.id`, `tpl.role`, `tpl.adapter`, `tpl.model` and the branch are interpolated over
  `{ ...context.vars, ...taskVars(task) }` (role and adapter over `taskVars` alone, as the spike
  does); `tpl.worktree = true` is forced; the sentinels `'{role.adapter}'` and `'{role.model}'`, and
  an absent value, fall back to the role file's frontmatter, with `'claude'` as the last adapter
  fallback.
- `context.fanned` gains `{ task, branch, role }`.
- `runAgentStep(tpl, context, extra)` is called with all three fields of the **landed**
  `AgentStepExtra` — `vars`, `syncBase: true`, and a `promptSuffix` closure returning
  `taskPromptSection(task, cwd)` plus, when `context.lastIntegration` is set, a
  `## Previous integration result` section capped at 4,000 characters. **The interface is supplied,
  not reshaped** (Q-0052 ported it ahead of its only producer for exactly this reason).
- A wave runs under `Promise.all` — not `allSettled`; a rejected task rejects the wave. The first
  member returning a non-`null` `StepResult` short-circuits the remaining waves.
- Between waves (and not after the last), each task branch is merged into the ticket worktree, with a
  failure reported as `warn` and the run continuing.

Verification: a two-wave `tasks.yaml` with a `depends_on` edge produces the wave events in order and
one `runAgentStep` call per task carrying its own `extra`; `agent-step.test.ts:263`'s existing
`extra` pin stays green unchanged.

### AC-11 — the three cross-step fields are declared on `RunContext` and drive the retry scope

`types.ts` gains three optional fields, each with JSDoc, as its own comment already authorises
(*"Q-0051 to Q-0053 may add fields here and assign them across steps"*):

- `fanned?: FannedTask[]` where `FannedTask` is `{ task: string; branch: string; role: string }`;
- `failingTasks?: Set<string> | null`;
- `lastIntegration?: string`.

They stay **optional and assigned by the step**, mirroring the spike, so `engine.ts` needs no change:
`context.fanned = context.fanned ?? []` reads identically to `ctx.fanned = ctx.fanned ?? []`.

On a failed integrate (`conflicts.length || !testsOk`), `runIntegrate` sets
`context.lastIntegration` to the notes plus the last 3,000 characters of output, and
`context.failingTasks` to **the conflicting tasks** where there were conflicts, and to **every fanned
task** where the tests failed without conflicts — because in that case the agents need the test
output. On success it sets `context.failingTasks = null`.

Verification: `engine.test.ts:533`'s landed test already proves a field assigned by one step survives
into the next. This ticket adds the domain half — a failed integrate followed by a `goto` back to the
fan-out narrows the second pass to the failing tasks, and one that failed on tests alone does not
narrow at all.

### AC-12 — every terminal outcome is written, and the artifact routing is preserved

Register row 6's integrate half.

- Each path in `writesOf(step)` is written to the ticket, choosing `testReport(cmd, out)` when the
  **path contains the substring `report`** and the notes document otherwise. Preserved as-is: it is
  what routes `dev/green-report.md` and `dev/integration.md` differently in `development.yaml:27`.
- `output.txt` is persisted beside the occurrence through the seam, always — empty included.
- `runs.log` gains exactly:
  `run=<n> step=<id> merged=<m>/<total> tests=<ok|fail|invalid|->`.
- The base-conflict path additionally writes the notes to every declared path and logs
  `run=<n> step=<id> base-conflict base=<base> files=<paths|?>` **before** it throws.
- Occurrence lifecycle: `completed` on success; `failed` with `category: 'integrate'` on an
  `envError`, on conflicts, and on tests that did not meet expectation.
- On success, `done` is emitted: `<n> branch(es) on <into>` plus, where a command ran,
  `, tests red as expected` or `, tests green`.
- With conflicts or a failed expectation: `handleFail(step, context)` when the step declares
  `on_fail`, `{ abort: true }` otherwise.

Verification: `smoke.js`'s abandoned-merge block (`:305–335`) proves the abort path end to end and
stays on the spike per charter §5; its **behaviour** is covered here at unit level — a failing
integrate with no `on_fail` returns `{ abort: true }` and the engine's rollback restores the ticket
branch head.

### AC-13 — every value that arrives from a flow file is coerced at its call site

`interpolate`'s parameter is typed `string` deliberately (`loaders.ts`: *"a number-valued call site is
a compile error in Q-0051/Q-0052 rather than the spike's runtime pass-through"*). This ticket is the
last of that list. Each site writes an explicit `String(...)`; none is silenced with a cast or a
type assertion:

| Site | Spike | Why it can be a non-string |
| --- | --- | --- |
| `step.into` | `:1070` | `into: 2` in YAML is a number |
| `step.branches` (pattern) | `:1076` | an **array**, evaluated unconditionally; `String(['a','b'])` is `'a,b'` and is then discarded |
| each explicit `step.branches` member | `:1077` | as above |
| `step.run_tests` | `:1128` | schema types it `boolean \| string` |
| each `writesOf(step)` entry | `:1155` | flow-authored |
| `tpl.id`, `tpl.role`, `tpl.adapter`, `tpl.model`, branch | `:1044–1049` | flow-authored template |
| `step.step?.base` | `:1012` | flow-authored |

The `cmd.*` namespace is preserved: a string `run_tests` interpolates over `context.vars` **plus**
`commands` flattened under the `cmd.` prefix. AC-13 gives it its first test in either tree — a step
declaring `run_tests: "{cmd.test} --silent"` against a `harness.yaml` whose `commands.test` is
`echo hi` resolves to `echo hi --silent`. Without it, deleting `flatten` is green everywhere.

### AC-14 — every preserved defect is registered, and the register's arithmetic moves with it

Each of the following carries a one-line `Why:` authority in `composite.ts`, and no line transcribes
a sentence from `docs/DECISIONS.md` or this ticket body:

1. **The inter-wave merge re-derives the task branch** as `harness/<id>/<task>` and ignores the
   branch it recorded in `context.fanned` — R-3 above. It also merges into `ticket.meta.branch`
   rather than the fan-out's declared base.
2. **A wave merge failure warns and the run continues**, so a later wave can build on a tree missing
   its predecessor's work.
3. **The five task-branch filter sites** — two `branchExists` in `syncBaseIntoTicketBranch`, one
   `branchExists` for the base and one for the branch list, one `branchHead` for the evidence line —
   cannot tell an absent branch from a failed git, and preserve the same filtering either way. This
   is the row `contracts/Q-0050/lifecycle-routing.contract.md:94` assigns to this ticket by name.
4. **The `mergeFailure` consumers** fall back to `git reported no reason` on an empty error, per that
   contract's next row.
5. **The evidence loop calls `mergeBase` on the unfiltered list**, so a branch that does not exist is
   asked about anyway.

`q0050.source.test.ts:164–189`'s `REGISTERED` map gains an entry for each new engine file, and the
cross-file `preserved defect/` count moves from **11** to whatever lands. **The prose comment above
that assertion enumerates which file contributes what and moves in the same edit** — Q-0052's R-5
names the trap precisely: a change that moves the number and not the comment leaves a comment
describing a number that is no longer there.

### AC-15 — dispatch, and green in both environment rows

`routing.ts:102–103`'s two `unavailableStep` calls become `runIntegrate(step, context)` and
`runFanOut(step, context)`, in the spike's order — `parallel`, `gate`, `script`, `integrate`,
`fan_out`, agent. `run-composition.test.ts:161`'s AC-9b test, which asserts a fan-out parent's error
message contains `'Q-0053'`, is replaced by one asserting the real behaviour: a fan-out parent still
emits neither a `step` nor a `done` event of its own, because it is a container and its members speak
for themselves.

Both suites pass **forced** in both environment rows per Q-0072's closing finding — inside the
`integrate` worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main`
after the merge, where both exist. `pnpm turbo run test --force`, `npm test --prefix spike`,
`harness lint`, `pnpm sweep:git-identity`, and the port-freeze branch-scope job clear. `spike/**` is
byte-unchanged.

---

## Non-goals

Charter §6's standing list applies without restatement: another child's module; editing `spike/**`
(§3); fixing a defect found while reading (§2); the cutover; the `quorum` binary (Q-0010);
persisting the event stream; anything on v1's exclusion list. Specifically here:

- **No public re-export.** `packages/core/src/index.ts` stays byte-identical; `git.source.test.ts:46`
  pins it and that pin stays green.
- **No flow file, template or schema change.** `packages/shared/src/flow.ts:241–246` already types
  `branches`, `into`, `run_tests` and `expect`; `fanOutSchema` already types the fan-out. Nothing in
  `harness/flows/` or `spike/templates/harness/flows/` is touched.
- **Q-0055 is not fixed here.** `lintFlow` requires no `id` on any step kind, and `runFanOut` names a
  worktree branch after `tpl.id`, so an id-less fan-out step creates `harness/<ticket>/undefined`.
  Visible from this code, owned by Q-0055, which lands after Q-0044's ported lint.
- **Q-0078 is not fixed here.** `ctx.diffInputs` is keyed by range alone; the registered pin at
  `prompt.ts:157` is untouched.
- **Q-0062 is not fixed here.** Nothing removes a worktree, and this ticket adds no call to
  `removeWorktree`.
- **The five sites' git-failure blindness is not fixed here** — that is Q-0074.
- **The CLI-driven end-to-end suites stay on the spike** (charter §5): `smoke.js`'s fan-out/integrate
  end-to-end block, the abandoned-merge rollback and the base-conflict run transfer at Q-0054/Q-0010.
  This ticket ports the three **library-level** blocks and covers the end-to-end behaviours at unit
  level.
- **No behaviour change.** The one authorised exception was spent on Q-0050's event stream.

## Open questions

**OQ-1 — the ninth export in `git/git.ts`. Owner: the human gate. Not blocking; the argument is made
here so round 1 need not spend on it.**
A reviewer may read AC-2 as *"porting another child's module"*, which the charter names a non-goal.
It is not. Charter §6 assigns Q-0042 `spike/src/git.js`; `safeMergeBase` is in `spike/src/engine.js`
and is therefore this ticket's to port. What is not this ticket's choice is **where** — a landed
guard permits `merge-base` in exactly one file. The deliberate part is moving Q-0042's eight-export
identity assertion to nine, which is a test edit, stated in the implement report rather than done
quietly. If the reviewer disagrees, the channel is `requirements/errata.md` written during the loop,
not a revise round — see *"A refused finding is a gate, not another round"* (2026-08-31).

**OQ-2 — `mergeBase` captures git's stderr where `safeMergeBase` inherited it. Recommendation:
accept, register, report.**
The spike's `safeMergeBase` calls `execFileSync` with default stdio, so a failing `merge-base` — the
evidence loop asks about branches it has not filtered — prints git's own `fatal:` line to the
terminal. `git/git.ts`'s `git()` uses `stdio: ['ignore','pipe','pipe']` and captures it. That is a
change to *what a command prints*, which charter §2 counts as observable. Reproducing it would mean
giving `git.ts` a second stdio mode for one caller, and `q0050.source.test.ts:108` forbids the engine
folder from writing to a process stream at all — a library that prints is what M3's daemon cannot
host. Recommended: use the existing helpers, carry a `Why:` line naming this question, and name the
divergence in the implement report. Not blocking.

**OQ-3 — how many `preserved defect/` markers land. Owner: the implementer, resolved by the code.**
AC-14 lists five sites; the register's flat count moves from 11 by however many markers the
implementation writes. The requirement deliberately does not fix the number in advance — a number
invented before the code is the shape `q0050.source.test.ts`'s own comment condemns. What is fixed is
that the number and the prose comment move together.

**OQ-4 — `TicketRecord` against `loadTasks(ticket: TicketFolder)`.** `fanout.ts:75` declares
`TicketFolder`; `RunContext.ticket` is `TicketRecord`. Expected to satisfy it structurally. If it
does not, the fix is a widening in `fanout.ts`'s parameter type, never a cast at the call site.
Measure before writing.

## Risks

1. **`structuredClone` substituted for the JSON round-trip** in `runFanOut`. It is the idiomatic
   TypeScript choice and it is not equivalent — it preserves `undefined`-valued keys, which changes
   which template fields fall through to the role default. AC-10 names the shape; a reviewer should
   check the call, not the comment.
2. **A literal ESC byte in the ANSI-stripping regexes.** Written `\x1b` they are four source
   characters and the guard at `q0050.source.test.ts:108` stays green; pasted from a terminal they
   are one byte and the whole folder fails. Cheap to hit, cheap to check.
3. **The register arithmetic is cross-file** and fails in both directions by design. Moving
   `q0050.source.test.ts:189` without moving the comment above it passes nothing and reads as done.
4. **The environment detector is beaten by its own test suite.** It has happened once (Q-0004 run 6).
   A ported test file that prints `Cannot find package 'yaml'` in a **pass** message, on a line
   without a result marker, will reject a genuine red phase. AC-7's four in-result-line vectors exist
   for this; keep them.
5. **`harness/Q-0053/integration` must exist before the first chore run** (charter §8). `review`
   diffs against it and only `integrate` — which runs later — creates it. This is what cost Q-0035
   $13.86. Since Q-0038 the preflight refuses before billing rather than after, so the failure mode
   is now cheap; the branch is still owed.
6. **No bootstrap problem, stated so nobody spends time on it.** This ticket's own chore run executes
   `chore.yaml`'s `integrate` step **on the spike**, which is unfrozen-in-place and unaffected. The
   ported `integrate` is exercised by the workspace suite, not by the run that writes it.
7. **The line numbers above go stale.** Measured at `9204f93` on 2026-08-31; Q-0051's were wrong
   within ten hours, and this is the third body on this ticket to say so. Re-derive at the implement
   branch's SHA.
8. **Q-0083's absence.** If a review round demands something charter §2 forbids, the implement step
   has no verdict to refuse with. The escalation is prose the human reads at the gate — plan for it
   rather than discovering it at round 3.

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a. No adapter is resolved here; `runFanOut` delegates every adapter decision to the landed `runAgentStep`. No environment variable is read, no key path is created. |
| **Worktree safety** | Load-bearing. These are the two step kinds that create worktrees and merge branches. Every worktree comes from `ticketWorktree`/`ensureWorktree` under `.harness/worktrees/`; nothing is written to the user's working tree; the integration branch stays `harness/<id>/integration`. The literal `.harness/worktrees` is never re-spelled — it comes from `@quorum/shared` through `fanout.ts` and `git.ts`. |
| **Gate behaviour** | Unchanged. No new gate kind, no gate declared. A failed integrate routes through `handleFail`, which owns the exhaustion gate; an `envError` and a timeout **bypass routing entirely** and throw, which is the point of clauses 2 and 3. |
| **File format and schema** | No change. `flow.ts` already types every field these steps read. `run-manifest-v1` is unaffected: the `integrate` occurrence kind and its `error.category` already exist and `engine.ts:59` already maps it. |
| **Lint rules** | No new rule. Q-0055's id requirement and Q-0044's fan-out `input.diff` rule are both already landed or already owned elsewhere. |
| **Cold-clone impact** | None. No new command, flag, dependency or configuration key; the first 30 minutes are unchanged. |
| **Product-agnostic** | No product name reaches the code. The BYOS refusal sentence Q-0068 owns is not on this path. |

---

## Verification summary

Three frozen `smoke.js` blocks port to Vitest and are the acceptance evidence for register row 7:
`:288–302` (`testReport`), `:504–544` (`environmentFailure`), `:693–733`
(`syncBaseIntoTicketBranch`, rebuilt on `context.emit`). Three end-to-end blocks stay on the spike
per charter §5 and have their behaviour covered here at unit level: the install marker (`:84`), the
abandoned-merge rollback (`:305–335`), and the base-conflict stop (`:340–365`).

Both suites forced, in the integrate worktree and again on `main` after the merge. `harness lint`
run **inside** the worktree. `spike/**` byte-unchanged and the port-freeze branch-scope job clear.
