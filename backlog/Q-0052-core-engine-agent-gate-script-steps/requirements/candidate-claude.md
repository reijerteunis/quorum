# Q-0052 — `core/engine`: agent, gate and script steps

*Requirement, 2026-08-30. Written against `main` at `4697ac0`. Every line number below was read
from the file at that commit, not inherited from the ticket body or from a sibling's document.*

**Three of the four things the ticket body says this ticket ports are already ported**, and the
correction is the first thing an implementer needs. The body was written on 2026-08-25, before
Q-0050 and Q-0051 landed. Where this document disagrees with it, the disagreement is stated with
its evidence rather than resolved quietly.

---

## Problem

The `maintainer` runs `harness run chore Q-0052` and pays two vendors. Today that run works only
because it goes through `spike/`. In `packages/core` the engine loop, its lifecycle, its routing,
its event stream and its diff preflight are all ported and green — and **nothing can actually run a
step.** `packages/core/src/engine/routing.ts:54–56` is:

```ts
async function runAgentStep(step: Readonly<Record<string, unknown>>): Promise<StepResult> {
  return unavailableStep(step, 'Q-0052');
}
```

Every flow shipped in this repository begins with an agent step. So `core`'s engine is a loop with
no work in it: the run banner is emitted, the preflight materialises diffs correctly, the cursor
moves, gates ask and are answered, the terminal record is written — and the first step rejects.

This ticket is the one that makes `core` do something. It is also the ticket where four kinds of
debt land at once, and that is why its requirement is long:

- **Q-0050 deferred seven obligations here by name** (E-8, E-21, E-22, E-4), each with a reason,
  none of them a defect in shipped code and none of them visible to a green suite.
- **Q-0051 deferred one ruling here** (OQ-1) — whether the `--dry` deferral placeholder discharges
  *skipped is not passed*.
- **Q-0057 deferred one behaviour here** — `core` got the `{run}` variable and not the write loop
  that consumes it, because there was no write loop to put it in.
- **Q-0046 and Q-0047 each deferred one criterion here** — `schemaFor`'s strictness against
  `strictSchemaProblems`, and register row 2's cross-vendor model clause.

None of those survives a ticket that does not carry it, because `chore.yaml:13` feeds the
implementer this ticket's own `requirements/merged.md` and `requirements/errata.md` and nothing
else. An obligation left in a sibling's errata is read by nobody.

**The risk is not that the code is hard.** `runAgentStep` is 115 lines and `runScript` is 24. The
risk is that both are dense with orderings that three tickets paid for and that no test names as an
ordering — usage stamped before the schema check, `output.txt` written on every path including the
empty one, `prompt.txt` written before the vendor is invoked. A rewrite that produces the same
values in a different order is green everywhere and loses money the next time a step fails.

---

## User stories

**`maintainer` — the one paying for the run.**
> When a step fails I want to know what it cost before it failed, what the vendor actually said, and
> which file the raw answer is in. When a vendor returns something my flow did not ask for, I want
> the run to stop and the raw text saved beside my ticket — not a silently defaulted verdict. And
> when my flow declares a review artifact, I want it written where *this run* can find it, not on
> top of last run's.

**`maintainer` — running `--dry` before spending anything.**
> A dry run must tell me my role file exists, my adapter is one Quorum knows, my model resolution is
> what I expect, and my prompt is the size I expect — without invoking anything or writing anything.
> If it declined to examine something, it must say so rather than look clean.

**`contributor` — reading `packages/core` to add an adapter.**
> I want to see, in one file, exactly what an adapter is handed: the prompt, the schema, the model,
> the working directory, the write permission. And I want that file to be provably unable to invoke
> an adapter or write a byte, so I know it is safe to call from M3's server to preview a step.

**`adopter` — the cold clone.**
> Nothing here lengthens my first thirty minutes. This is internal machinery.

---

## Surfaces

| Surface | Touched | How |
| --- | --- | --- |
| **`packages/core`** | **yes** | two new files, `src/engine/prompt.ts` and `src/engine/steps.ts`; four edited — `types.ts`, `engine.ts`, `routing.ts`, `q0050.source.test.ts`; new test files |
| **`packages/shared`** | **no** | the event union already declares `step` and `done` (`events.ts:146`, `:153`); this ticket gives them their first producers and adds no member |
| **`contracts/`** | **read only** | `contracts/Q-0050/run-messages.fixture.json` gains its first reader for `gate.*`. **It is not edited** — see D-9 |
| **CLI** (`harness run`) | no | this ticket adds no flag, argument or exit code |
| **`harness/`** | no | no flow, role or `harness.yaml` change |
| **`backlog/`** | read + written by the engine | unchanged behaviour; the write loop is what AC-6 pins |
| **`spike/`** | **frozen** | charter §3. Not modified, not deleted. It is the witness |
| **daemon / web UI** | no | M3 |

---

## What this requirement settles before the implementer starts

Nine rulings. Six correct the ticket body against the tree; three are design decisions the body
explicitly delegates here. All are ruled so none is discovered in review.

### D-1. The port list in the ticket body is stale in four places, and the real cut is seven functions

The body says this ticket ports *"`runAgentStep` with `buildPrompt`, `schemaFor`, `resolveModel` and
`reviewRound`; `runGate`; `runScript`."* Measured against `packages/core/src/engine/` at `4697ac0`:

| Named in the body | Actual state | Evidence |
| --- | --- | --- |
| `reviewRound` | **already ported** | `loaders.ts:63`, called from `engine.ts:141` |
| `runGate` | **already ported, in full** | `routing.ts:11` `askGate`, the `step.gate` dispatch at `:81–103`, the exhaustion gate at `:111–140` |
| `interpolate`, `writesOf`, `loadRole` | **already ported** | `loaders.ts:52`, `:57`, `:37` |
| `runAgentStep`, `runScript`, `buildPrompt`, `schemaFor`, `resolveModel` | **not ported** | `routing.ts:54–56` and `:104` are `unavailableStep(step, 'Q-0052')` |

Two functions the body does not name are also this ticket's, and both would otherwise be lost:

- **`mergeFailure`** (`spike/src/engine.js:351–355`). Its first caller is `runAgentStep`'s base-sync
  warning (`:260`); the other four call sites are Q-0053's (`:1023`, `:1104`, `:1115`, `:1124`).
  Whoever ports the first caller ports the function. Frozen coverage: `spike/test/smoke.js:273–274`.
- **`cmdTimeout`** (`:529`), which reads `config.commands.timeout_ms` and is what makes a script
  step's timeout the project's rather than `runCommand`'s hard-coded default.

Three helpers the body might suggest are *not* this ticket's — Q-0049 already ported all three into
`run-history/manifest.ts`: `countUsage` (`:254`, which returns a delta rather than mutating a
context), `normaliseUsage` (`:175`) and `errorOf` (`:233`).

**So the cut is seven functions: `runAgentStep`, `runScript`, `buildPrompt`, `schemaFor`,
`resolveModel`, `formatCost`, `mergeFailure`, plus the `cmdTimeout` read.** Roughly 190 lines of
`spike/src/engine.js`, not the 250 the body estimates — the difference is what Q-0050 already took.

### D-2. Two new files: `prompt.ts` and `steps.ts`, and each buys a checkable rule

Q-0049's precedent is the argument: three files, so three rules are checkable rather than intended.
Folding this into `routing.ts` would put adapter invocation, worktree creation and git commits into
a file whose header says *"gate policy, step dispatch, and bounded backward-edge decisions"*, and
would give the folder one 500-line module where every other one is under 200.

| File | Contents | The rule it makes checkable |
| --- | --- | --- |
| `src/engine/prompt.ts` | `buildPrompt`, `schemaFor` | **It composes what an adapter is handed and can reach no adapter and write no byte.** No import of `../adapters/`, no `fs` write API, no `git`. M3's server can call it to preview a step |
| `src/engine/steps.ts` | `runAgentStep`, `runScript`, `resolveModel`, `formatCost`, `mergeFailure` | **It is the only file in the engine folder that invokes an adapter.** `adapter.run(` appears here and nowhere else |

`formatCost` goes in `steps.ts` and not in `run-history/`, per Q-0049's merged requirement NG-2 and
the rule behind it: **run history computes, and does not narrate.** `formatCost` produces a string
for a human, so it travels with the step that prints it (`spike/src/engine.js:334`).

`resolveModel` goes in `steps.ts` and not `prompt.ts`: it decides what the *adapter call* carries,
not what the prompt says, and its only caller is `runAgentStep` (`:237`).

The engine folder becomes **nine** files. `q0050.source.test.ts:82` pins the list with
`toStrictEqual` and fails closed, so it is edited in the same change (AC-1).

### D-3. `buildPrompt` takes a narrowed context, and `runAgentStep`'s `vars` overlay is not a context copy

`spike/src/engine.js:234` is `ctx = { ...ctx, vars: { ...ctx.vars, ...(extra.vars ?? {}) } }` — a
per-call context clone carrying a fan-out task's variables. `RunContext`'s own JSDoc
(`types.ts:136`) says **"A step receives this object itself, never a copy"**, because Q-0050 found
that handing a step a spread copy silently discarded whatever the step *assigned*.

The two do not actually collide, and the requirement says so rather than leaving a reviewer to
work it out: `runAgentStep` assigns nothing to its context, so a local overlay escapes nowhere.
But the shape that makes it *provable* rather than argued is better, and it is the shape Q-0051
already established for `materialiseDiff`:

- **`buildPrompt(step, role, context: PromptContext)`**, where `PromptContext` extends `DiffContext`
  (`diff.ts:88`) with the three readers `buildPrompt` adds — `backlog`, `harnessDir`, `dry` — and
  declares `vars` as `Readonly<Record<string, unknown>>`.
- **`runAgentStep(step, context, extra?)`** computes `const vars = { ...context.vars, ...extra?.vars }`
  once and constructs the narrowed `PromptContext` from `context` and `vars` for the prompt call
  only. The run context itself is passed on unchanged to everything else.

`Readonly` on `vars` is the checkable half: nothing can assign through the view.

**Port the `extra` parameter now**, even though no caller in this ticket supplies one. Q-0053's
fan-out calls `runAgentStep` with all three fields (`extra.vars`, `extra.syncBase`,
`extra.promptSuffix`), and leaving it out means Q-0053 changes this ticket's exported signature and
every test written against it. It is directly testable here by calling `runAgentStep` with an
`extra` (AC-7d).

### D-4. The occurrence seam widens to an allocator that registers, and `registerOccurrence` goes

Q-0050 E-22 is exact and was verified against the tree: `history` is a local in `run()`
(`engine.ts:145`), it is on none of `RunContext`, `RoutingContext` or `RunPersistence`, and
`RunHistory.allocate` (`writer.ts:96`) is the only producer of an `Occurrence`. So
`RunPersistence.registerOccurrence` (`types.ts:105`) **cannot be called by anyone**, and E-22 left
the design here deliberately.

**Ruled.** `RunPersistence` gains three members and loses one:

```ts
/** Allocates one occurrence, registers it as active, and returns it. `null` under `dry`. */
allocateOccurrence(step: { id: string }, kind: OccurrenceKind, fields?: OccurrenceFields): Occurrence | null;
/** Writes one artifact beside an occurrence; a broken history directory warns and never throws. */
persistArtifact(occurrence: Occurrence, name: string, text: string): void;
/** Closes one occurrence out, de-registers it, and replaces the manifest. */
terminalOccurrence(occurrence: Occurrence, status: RunStatus, fields?: Partial<Occurrence>): void;
```

and `registerOccurrence` is **removed**, not left beside the new allocator. Keeping both leaves a
capability with no caller, which is E-22's whole complaint, and its JSDoc naming Q-0050 would then
be false.

**`Occurrence | null` rather than a throw, and the reason is measurable.** `initialiseRunHistory` is
skipped entirely under `dry` (`engine.ts:217`), so `history` is `undefined` and any allocation would
be a runtime crash. Both call sites already short-circuit before allocating
(`spike/src/engine.js:266`, `:628`), so neither sees `null` today — but a nullable return makes the
dry case representable in the type rather than a lifecycle contradiction discovered at runtime,
which is the shape Q-0049's round-2 reviewer applied to `finalise`'s `Exclude<RunStatus, 'running'>`.

### D-5. A `parallel:` member's step id is supplied at the `onEvent` boundary, not through the loop's slot

Q-0050 round 6, Major 1, found independently by both vendors: `engine.ts:152` holds **one** mutable
`stepId` slot, a `parallel:` group correctly carries no `id`, and both members run concurrently
against that one slot. `withStepId` (`engine.ts:73–90`) already does its half — an id the event
already carries **wins** — and its comment says so, addressed to this ticket by name.

**Ruled: `runAgentStep` stamps the id itself, where the spike does.**
`spike/src/engine.js:279` is `onEvent: (e) => ui.trace(step.id, e)` — the id is passed per call,
never bound to a slot. In `core` that is:

```ts
onEvent: (event) => context.emit({ ...event, stepId: String(step.id) }),
```

Nothing else is needed and nothing else works: the only events with an enrichment problem are the
adapter's three (`spawn`, `stdout`, `retry`), because `step` and `done` carry `stepId` in their own
schema (`events.ts:148`, `:155`) and `info`/`warn` carry no `stepId` at all — the spike embeds the
id in the message text (`` `${step.id}: …` ``), and that text is preserved verbatim.

### D-6. Q-0051's OQ-1 is ruled: the `--dry` placeholder is **not** the report, and a report is owed

The question the ticket body requires this requirement to settle rather than inherit. It is settled
on new evidence rather than on taste.

`spike/src/engine.js:747–749` answers a range absent from `ctx.diffInputs` with, under `--dry`:

> `(dry run: \`<range>\` is produced by an earlier step of this flow and is materialised when that
> step has run)`

**That text reaches nobody.** Read `runAgentStep` in order:

| Line | What happens |
| --- | --- |
| `:264` | `const prompt = buildPrompt(step, role, ctx) + …` — the placeholder is written into this string |
| `:266` | `if (ctx.dry) { ui.step(…); ui.info(\`${step.id}: dry run — prompt ${prompt.length} chars, schema …\`); return null; }` |
| `:268` | `allocateOccurrence(…)` — **after** the return |
| `:269` | `persistArtifact(ctx, occurrence, 'prompt.txt', prompt)` — **after** the return |

So in the only mode that produces the placeholder, the prompt holding it is never persisted, never
emitted and never shown. Its entire observable effect is on `prompt.length` in an `info` line that
does not name a range. And in a real run the placeholder is not produced at all — `materialiseDiff`
runs instead.

**Ruled: the placeholder does not discharge invariant 11.** The rule is *"Q-0035 accepted: a check
that skips its subject must not report success"* (`docs/DECISIONS.md`, 2026-08-25), stated in
`docs/GLOSSARY.md`'s **Preflight** entry as reporting a declined examination as *skipped*. A string
inside a discarded buffer is not a report.

**And a report is owed — but it is not a criterion of this run, deliberately.** Emitting an `info`
naming what the preflight deferred is an added event, which is new behaviour under charter §2 and
wants a `docs/DECISIONS.md` entry. No step in `chore.yaml` may write one: `developer-generalist`'s
role body says outright *"You do not add to docs/decisions/ or its index; a decision is the human's
to record"*. Making it a criterion would put a precondition no agent on this route can satisfy
inside a bounded loop — the pattern Q-0070's requirement named at $8.31 and Q-0079's run hit again
at $9.14, now on its seventh appearance. So it is **a successor ticket and a gate obligation**, and
its body is written out in full below so the obligation cannot expire (§ *Gate obligations*).

This ticket ports `buildPrompt`'s placeholder **byte-identically** and adds nothing.

### D-7. The `signalWindow` invitation is spent, and this requirement declines it

The ticket body offers one authorised behaviour change: removing `runGate`'s 1-second `signalWindow`
timer, on the grounds that the obstruction was `spike/test/**` being qa-red's frozen artifact and
that *"the port writes new Vitest fixtures, so the constraint does not travel with it."*

**It already travelled, and the ticket that owned the gate declined it.** Q-0050 ported the timer
to `routing.ts:25`, gave it an authority line — `// Why: preserved defect, see Q-0050 AC-4.` — and
pinned it three ways: a source guard at `q0050.source.test.ts:128–131` asserting the marker *and*
the literal `1000`, the `REGISTERED` entry `'routing.ts': ['preserved defect/AC-4', …]` at `:169`,
and the cross-file count `toHaveLength(8)` at `:182`.

**Ruled: not removed here.** Four reasons, in descending weight:

1. **It is not one of the three step kinds this ticket ports.** Per D-1, the gate is Q-0050's in
   full. Removing it means editing another child's landed code and three of its landed guards on a
   ticket whose subject is `runAgentStep` and `runScript`.
2. **No test this ticket writes needs it gone.** The invitation's own justification was that a
   fixture could not own a libuv handle; every fixture here is a Vitest test that resolves
   `answerGate` itself, and none is kept alive by the timer.
3. **A sibling reversing a landed preservation with no test needing it is the quiet fix charter §2
   exists to stop.** The authority line says a decision was taken; deleting it on a neighbouring
   ticket makes that record wrong.
4. The cost of removing it later is one line and one guard edit, and it does not grow.

If the maintainer wants it gone, the cheap route is stated so the choice is available at the gate:
one erratum in this ticket's folder naming the four sites (`routing.ts:25`, `q0050.source.test.ts:129`,
`:169`, `:182`), written *before* implementation per *"An erratum is the last repair, not the
first"* (2026-08-30). It is **not** a blocking question and no criterion depends on it.

### D-8. Two inherited obligations are already discharged, and saying so is worth more than restating them

- **Obligation 7's "two gate `info` texts" are already asserted.** `lifecycle-routing.test.ts:123–125`
  reads `fixture.gateDryRun` and `fixture.gateAutoAdvanced` and asserts all three branches (dry,
  `gate: auto`, `--auto` over a `human` gate). Q-0050's own round 6 wired them after E-4 added them.
  What is genuinely left is the **four `gate.*` keys** — `kind`, `reason`, `ticketDir`, `retry` —
  which no test reads: measured by enumerating every `fixture.<key>` reference across the three
  engine test files. They are the last four leaf keys of an oracle that calls itself *the single
  oracle for exact event and log text*, and closing them is AC-14.
- **Obligation 3's "`registerOccurrence` cannot be called"** is confirmed and is D-4 above.

### D-9. `contracts/` is not a writable surface on this route, so the new strings' oracle lives in `packages/core`

This ticket introduces roughly fifteen message strings that no oracle holds — the agent step's
`step` and `done` payloads, its five `info`/`warn` texts, its two `runs.log` formats, and the script
step's four. The obvious move is to extend `contracts/Q-0050/run-messages.fixture.json`.

**It cannot be done on this route.** `harness/roles/developer-generalist.md:3` lists the role's
paths as `package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore,
.github, packages, apps, spike, harness, docs` — `contracts` is not among them. That is the first
of the three questions *"Unwritable surfaces"* asks, and it fails. Naming it anyway is the Q-0069
AC-11(b) failure repeated: three revise rounds correctly refusing a criterion, and an exhaustion
gate.

**Ruled:** the fixture is **read** and not written. This ticket's strings are asserted against the
spike's literals in its own test files, in one exported constant per test file so a later ticket can
lift them into a contract when a route that can write `contracts/` next touches them. Registered as
a reported item.

---

## Acceptance criteria

Fifteen, each independently testable. Where a criterion pins an ordering rather than a value, the
sketch says how the ordering is made to fail, because an ordering asserted only by reading it is not
established (*"A check is not established by reading it"*, 2026-08-29).

### AC-1 — The engine folder is exactly nine documented modules, and every landed source guard is updated with the change rather than after it

**(a)** `packages/core/src/engine/prompt.ts` and `packages/core/src/engine/steps.ts` exist.
**(b)** `q0050.source.test.ts:82`'s `production` list becomes the nine names, alphabetically:
`channel.ts, diff.ts, engine.ts, lifecycle.ts, loaders.ts, prompt.ts, routing.ts, steps.ts, types.ts`.
**(c)** Every export of both new files carries its own JSDoc block anchored on the export — the
`undocumentedExports` check at `:91` derives from `production` and covers them automatically.
**(d)** The no-console / no-process / no-spike-import scan at `:103` passes over both new files.
Note for the implementer: it forbids `[` anywhere in engine source, so a literal ANSI escape
in a regex is a failure.
**(e)** `REGISTERED` at `:164–170` gains one key per new file that carries a `Why:` line, with the
classification `classifyAuthority` (`:65–72`) produces, and the cross-file
`preserved defect/` count at `:182` moves from 8 to whatever this ticket lands. An unclassifiable
`Why:` line throws rather than being skipped, so a malformed authority line fails the suite.

*Test:* the existing guards, unmodified in shape. Demonstrate (e) by adding a `Why:` line with an
unrecognised clause and observing the throw before trusting the register.

### AC-2 — `prompt.ts` composes what an adapter is handed and can reach neither an adapter nor the filesystem's write side

**(a)** `buildPrompt(step, role, context)` assembles the spike's sections, in the spike's order and
with the spike's headings (`spike/src/engine.js:726–755`): the role header and body; the ticket
block carrying id, title, stage and `Iteration: <vars.iter>`; each `input.harness` file that exists,
under `## Input: harness/<name>`; each `input.backlog` match, under
`## Input: backlog/<folder>/<rel>`; the `## Repository` note whose second sentence differs on
`step.worktree`; the diff; `# Task` when `step.instructions` is set; and the `# Output contract`
paragraph naming the interpolated write paths and the verdict vocabulary.
**(b)** A missing `input.harness` file is skipped silently — `fs.existsSync` at `:734`, preserved.
**(c)** `steps.ts` is the only file in the engine folder containing `adapter.run(`.
**(d)** `prompt.ts` imports nothing from `../adapters/` and calls no `fs` write API
(`writeFile*`, `mkdir*`, `rm*`, `open*`, `appendFile*`).

*Test:* a golden-prompt test over a fixture flow exercising all eight sections, asserting the
section order by the order of the headings in the output. (c) and (d) as source scans over
`production`-derived text, each demonstrated failing against a deliberately violating string before
being trusted.

### AC-3 — `schemaFor` emits four shapes, every one of them strict by the helper Q-0046 left for this ticket

**(a)** `schemaFor(step)` produces exactly the four shapes `packages/shared/src/step-output.ts`
enumerates: `{summary}`, `{summary, document}`, `{summary, verdict, findings}`, and
`{summary, document, verdict, findings}` — `document` present iff `writesOf(step)` is non-empty,
`verdict`/`findings` present iff `step.output.verdict` is set.
**(b)** `verdict.enum` is `String(step.output.verdict).split('|')` — the first option means pass.
**(c)** When the vocabulary contains `changes-requested`, `findings.items` carries the
`FINDING_PATTERN` regex; otherwise `items` is a plain string. **It is imported from
`@quorum/shared` (`constants.ts:163`) rather than retyped** — the literal
`'^(blocker|major|nit): .+:[1-9][0-9]* .+'` must not appear in `prompt.ts`.
**(d)** **Every shape is asserted against `strictSchemaProblems` from
`packages/core/test/strict-schema.ts`**, imported rather than re-implemented, and every shape
returns `[]`. This is Q-0046's deferred half, named there by ticket id, and it closes the gap that
ticket recorded as *deferred with a named owner*.

*Test:* one table-driven test over the four step shapes × the two findings vocabularies, calling
`strictSchemaProblems(schemaFor(step), label)` on each. Demonstrate the helper has teeth by feeding
it a mutated copy with `additionalProperties` deleted and observing a non-empty result — a strictness
check that cannot fail is the defect Q-0034 paid for.

### AC-4 — Model and adapter resolution, including the cross-vendor clause Q-0047 handed back

**(a)** `resolveModel(step, role, adapterName)` (`spike/src/engine.js:702–707`): the step's own
`model` always wins; a role default is inherited **only** when `role.meta.adapter` equals the
resolved adapter name; otherwise `undefined`, so the CLI picks a model its own login supports.
This is register row 2's third clause, re-pointed to this ticket by Q-0047 erratum E-1 (2026-08-27).
Frozen coverage: `spike/test/smoke.js:622–626`.
**(b)** The adapter is resolved in the spike's order (`:236`):
`config.adapterOverride ?? step.adapter ?? role.meta.adapter ?? 'claude'`.
**(c)** **`config.adapterOverride` is narrowed, not coerced.** `projectConfigSchema` is a
`z.looseObject` (`packages/shared/src/project.ts:55`) and declares no `adapterOverride`, so the key
arrives typed `unknown`. `String(config.adapterOverride)` yields the string `"undefined"` when the
key is absent and would send every run to an adapter named `undefined`. The narrowing is
`typeof … === 'string' && … !== ''`. This is the mirror image of E-21's coercion obligation and the
trap it sets is silent.
**(d)** No vendor alias, and no model name is defaulted anywhere in `steps.ts`.

*Test:* (a) the three rows of `smoke.js:622–626` as a unit test. (b) a precedence table with all
four levels populated, then each removed in turn. (c) a run whose `harness.yaml` carries **no**
`adapterOverride`, asserting the adapter the step resolves to is the role's — red against a
`String(...)` implementation, which resolves `"undefined"` and throws *unknown adapter*.

### AC-5 — The agent step's order of operations is the one three tickets paid for, and each ordering is demonstrated

Pin the sequence at `spike/src/engine.js:264–312`, not merely the values:

**(a)** `prompt.txt` is persisted **before** `adapter.run` is invoked (`:269`), so a vendor crash
still leaves the prompt on disk.
**(b)** On a thrown adapter error (`:281–293`): usage is counted, `output.txt` is written with
`e.raw ?? ''` — **always, including empty**, which is the Q-0034 fix — the occurrence is closed
`failed` with `errorOf`'s category, the `runs.log` FAILED line is appended, and the error is
rethrown unchanged.
**(c)** On success, `occurrence.attempts` and `occurrence.usage` are stamped **immediately** after
the vendor returns (`:302–303`) and **before** the schema check (`:305`). Everything below `:303`
can throw, and until Q-0034 a failure in that stretch filed a call the vendor had already billed as
`usage: null`.
**(d)** Invalid structured output (`:306–311`): `output.txt` is persisted, the raw text is written
beside the ticket at `.harness/<stepId>-<timestamp>.raw.txt` through `backlog.writeFile`, the
occurrence is closed `failed` with category `structured_output`, and a `FlowError` is thrown whose
message names the problems and **the path the raw text was saved to**. Register row 21; the run
never defaults silently.

*Test:* (a) an adapter stub that throws before returning, asserting `prompt.txt` exists with the
built prompt. (b) a stub throwing with `raw: undefined`, asserting `output.txt` exists and is empty
— red against `if (e.raw != null)`. (c) **an adapter stub that returns valid usage with an output
that fails the schema**, asserting the manifest's occurrence carries the usage: this fails if the
stamp is moved below the check, which is the only way to make the ordering the subject. (d) assert
the thrown message contains the dump path and that the file at that path holds the raw text.

### AC-6 — The declarative write loop interpolates with `{run}` in scope, and the verdict routing is unchanged

**(a)** For each path `writesOf(step)` returns, the agent's `res.output.document ?? res.raw` is
written to `interpolate(String(rel), vars)` under the ticket folder, and an `info` naming the
written path relative to the ticket dir is emitted (`:315–318`).
**(b)** **`vars.run` is in scope at that interpolation and a run-scoped path resolves.** This is
Q-0057's behaviour half, which `core` could not receive because there was no write loop
(`routing.ts:54–56`); its AC-1 core half is a spy assertion at `engine.test.ts:424` for exactly that
reason. A step declaring `writes: ["review/chore/run-{run}/chore-iter-{iter}.md"]` — the shipped
`chore.yaml:34` — must land under `run-<N>/` where `N` is the run id `runs.log` carries as `run=N`,
**not** under `run-1/` on every run.
**(c)** `step.output.verdict` writes the verdict JSON to
`interpolate(String(step.output.verdict_file ?? '.harness/<stepId>-verdict.json'), vars)` with keys
`verdict`, `findings` (defaulting to `[]`) and `summary`, `JSON.stringify(…, null, 2)` (`:319–322`).
**(d)** Verdict routing: the pass value is `schema.properties.verdict.enum[0]`; anything else emits
the `warn` carrying the findings joined by `' | '` and returns `handleFail(step, context)`
(`:338–344`).

*Test:* (b) a fixture whose `runs.log` already ends at `run=2` — `nextRunId`'s own input, not a
second source — running a chore-shaped flow with the shipped write path, asserting the file lands at
`review/chore/run-3/chore-iter-1.md`. Red against an implementation that drops `{run}` from the
interpolation values, which is the silent regression the ticket body names: today
`backlog/Q-0080-…/review/chore/run-2/` is the **only** run-scoped review directory in the backlog,
so a port that loses it sends the next chore run's reviews back beside the 57 legacy flat files.

### AC-7 — Worktree creation, base sync and the commit, with all four messages preserved

**(a)** When `step.worktree` and not `dry`: the branch is
`interpolate(String(step.branch ?? \`harness/<id>/<stepId>\`), vars)`, the base is
`interpolate(String(step.base ?? ticket.meta.branch), vars)`, and `ensureWorktree`
(`packages/core/src/git/git.ts:64`) supplies the cwd. The `info` naming the worktree and branch is
emitted (`:247`).
**(b)** The base is synced when the branch **already existed** or when `extra.syncBase` is set — not
only on fan-out retries (`:251`). Q-0004's fix: a branch created on an earlier round works against
yesterday's tree otherwise.
**(c)** Three outcomes, three distinct messages, preserved verbatim: base absent →
`info` *"base <base> does not exist yet — nothing to sync"* (an `info`, not a `warn`, and not a
warning with an empty reason after the colon); merge ok → `info` *"synced to <base>"*; merge failed
→ `warn` carrying `mergeFailure(m)`, which reports conflicts when there are any and the first
non-empty line of git's error otherwise, never *"could not sync base:"* with nothing after it.
**(d)** After a successful step on a branch, `commitAll`
(`packages/core/src/fanout/fanout.ts:279`) commits with the message
`` `${stepId}: ${summary?.slice(0, 60) ?? 'agent changes'} [${ticketId}]` ``, and its
`onDiscard` callback emits the `warn` naming up to four discarded `backlog/` paths with `, …` when
there are more. The count/no-change `info` at `:329` is preserved in both branches.

*Test:* (c) three fixtures over a real temporary repository, one per branch, each asserting the
exact message. (d) a step that writes a file under `backlog/` in its worktree, asserting the warn
names it and that the commit does not contain it — the guard `harness/port-charter.md:437` describes.

### AC-8 — `runScript` runs the project's command, under the project's timeout, with three outcomes

Port `spike/src/engine.js:625–648`.

**(a)** The command is `interpolate(String(step.run), vars)` and the `step` event's message is
`` `script: <cmd>` ``.
**(b)** `dry` returns `null` after the `step` event and before any occurrence is allocated (`:628`).
**(c)** The timeout is `config.commands.timeout_ms ?? 15 * 60_000`, passed to `runCommand`
(`packages/core/src/fanout/command.ts:130`) — the project's value, not `runCommand`'s default. A
project's own command can hang exactly as a suite can.
**(d)** `output.txt` is persisted with the command's output, and `step.output.write` writes the same
output to the interpolated ticket-relative path.
**(e)** Three outcomes: exit 0 → occurrence `completed`, `done` event `"exit 0"`, return `null`;
timed out → occurrence `failed` and a `FlowError` naming the minutes and telling the reader to fix
the command or raise `commands.timeout_ms` — **never a backward edge**, because looping cannot fix a
command that never finishes; non-zero → occurrence `failed`, a `warn` `"<stepId>: exit <code>"`, and
`step.on_fail ? handleFail(step, context) : { abort: true }`.

*Test:* (c) a fixture setting `commands.timeout_ms` to a small value over a sleeping command,
asserting the timeout branch and that the message names the configured value — red against
`runCommand`'s default. (e) all three branches, with the timeout branch asserted **not** to return a
`goto` even when `on_fail` is declared.

### AC-9 — `step` and `done` gain their first producers, and a `parallel:` member's events carry its own id

**(a)** `stepStartedEventSchema` and `stepDoneEventSchema` (`events.ts:146`, `:153`) are emitted for
the first time in `packages/core`, with the spike's exact payloads:

| Event | Message |
| --- | --- |
| agent `step` | `` `<adapter>${model ? '/' + model : ''} role=${step.role ?? '-'}` `` |
| agent `done` | `` `${verdict ? 'verdict=' + verdict + ' ' : ''}${formatCost(usage)} ${ms}ms` `` |
| script `step` | `` `script: <cmd>` `` |
| script `done` | `` `exit 0` `` |

**(b)** They are emitted **inside the three step implementations**, never around `runStep`. Q-0050
round 3 confirmed by grep that all spike call sites are in `runAgentStep`, `runScript` and
`runIntegrate`; emitting around `runStep` would fire for gate steps and fan-out parents, which the
spike never does.
**(c)** **A `parallel:` group whose members each emit adapter events produces events carrying each
member's own id**, per D-5. The group itself carries no `id` and correctly stamps none.
**(d)** Every emitted event parses against `eventSchema`.

*Test:* (c) is the discriminating one and is one assertion: a group with **no** `id` whose two
members each emit a `stdout`, asserted to carry `stepId: 'a'` and `stepId: 'b'` respectively. Red
against an implementation relying on `engine.ts`'s single slot, which stamps `null` for a group and
races between concurrent members. (b) a flow of one gate step and one fan-out parent, asserting no
`step` or `done` event is emitted for either.

### AC-10 — The occurrence seam is widened, and no allocated occurrence can be orphaned

**(a)** `RunPersistence` gains `allocateOccurrence`, `persistArtifact` and `terminalOccurrence` as
specified in D-4, and `registerOccurrence` is removed.
**(b)** `allocateOccurrence` **registers as it allocates**: an occurrence it returns is in the set
`finaliseActiveOccurrences` closes, with no second call required.
**(c)** `terminalOccurrence` de-registers, so a completed occurrence is not re-closed by a later
failure.
**(d)** A run that fails **after** an occurrence is allocated and before it is closed leaves that
occurrence `failed` in the manifest with the run's cause as its `error.message` — the full message,
not the 200-character `runs.log` note.
**(e)** No file outside `run-history/writer.ts` writes under `.quorum/` (Q-0049's landed rule,
re-checked because this ticket is the first to allocate).

*Test:* (b) is demonstrated rather than asserted: an adapter stub that throws **after** the
occurrence is allocated, with `finaliseActiveOccurrences` reached through the real `engine.ts`
catch, asserting the manifest shows one `failed` occurrence. Red against an allocator that does not
register — which is exactly the state E-22 describes, so the test's red phase reproduces the defect
it closes.

### AC-11 — `--dry` resolves everything and invokes nothing

**(a)** Under `dry`, the agent step still loads the role, resolves the adapter and the model, and
builds the schema and the prompt — so a missing role file, an unknown adapter or a bad diff range
fails a dry run (`:235–239`, all above the short-circuit at `:266`). This is what makes `--dry`
worth running.
**(b)** It emits the `step` event and then the `info`
`` `<stepId>: dry run — prompt <n> chars, schema <comma-joined property names>` ``, and returns
`null`.
**(c)** It creates no worktree (`:242`), allocates no occurrence, writes no file and invokes no
adapter.
**(d)** The dry run's ticket folder is byte-identical before and after, and no `runs.log` is created
— `spike/test/q0034-dry-run.js` D1's assertions, ported.

*Test:* (a) three fixtures — an absent role file, an unknown adapter name, a diff range whose
endpoint does not resolve — each asserting the dry run fails. (c) a spy adapter asserted never
called, plus a directory snapshot.

### AC-12 — `formatCost` and `mergeFailure` port with their frozen coverage, and every new interpolation site coerces deliberately

**(a)** `formatCost(usage)` returns `cost=$<3dp>` when `cost_usd` is non-null and
`cost=n/a (<input+output> tokens, vendor reports no price)` otherwise. A vendor that reports no cost
is **unpriced, not free**: `$0.000` states a price Quorum does not know. Register row 3;
`spike/test/smoke.js:613–615` is the frozen coverage.
**(b)** `mergeFailure(m)` returns `conflicts: a, b` when there are conflicts, `git: <first non-empty
line>` when there is an error, and `git reported no reason` otherwise
(`spike/test/smoke.js:273–274`).
**(c)** **Every interpolation site this ticket adds writes `String(…)` deliberately**, per Q-0050
E-21: `interpolate`'s parameter is typed `string` (`loaders.ts:52`) while `spike/src/engine.js:772`
coerces, and YAML hands back a **number** for `branch: 2`. The sites are `step.branch`, `step.base`,
`step.output.verdict_file`, `step.run`, `step.output.write`, each `input.backlog` glob, and
`step.input.diff`. `writesOf` already returns `readonly string[]` and needs none.
**(d)** The implement report enumerates the sites it coerced, so a reviewer counts rather than
searches.

*Test:* (c) behaviourally, not by source scan: a step declaring the YAML number `branch: 2` creates
the worktree branch `"2"`, matching the spike. A source scan for un-coerced calls is the shape
Q-0079 found could be talked out of firing by a comment; a run that produces the branch cannot be.

### AC-13 — The four scenarios Q-0050 struck are pinned here, AC-6d gains its caller, and AC-10f is reported as still unreachable

Q-0050 E-8 struck eight scenarios and said in as many words that this requirement should carry four
of them **as criteria rather than rediscover them**. Each is now reachable because a step kind can
fail:

**(a) Step-id enrichment** (Q-0050 AC-2b) — the engine adds the step id and nothing else. Covered by
AC-9(c)/(d).
**(b) The failed-step `done` suppression** (AC-2f) — a step that throws emits **no** `done` event,
because `ui.done` is below the throw at `:334`.
**(c) Cancellation mid-step** (AC-5b) — a run aborted while an adapter call is in flight reaches the
`interrupted` terminal record; the step's occurrence is closed `interrupted`, not `failed`.
**(d) Run-history initialisation failure** (AC-9e) — a run whose history cannot be initialised still
receives a terminal `runs.log` line, and no step allocates.
**(e) Q-0050 AC-6d's disk-level ordering** becomes assertable: `handleFail` (`routing.ts:111`) had
no caller in `packages/core/src`, and now has two — the agent step's verdict branch and the script
step's non-zero branch. Assert from inside an unresolved `answerGate` that the `exhausted` history
entry and its `runs.log` line are **already on disk** when the exhaustion gate asks.
**(f) Q-0050 AC-10f stays unreachable, and this criterion is that it is reported as such rather than
claimed.** Its scenario is *"a loop that fails once during the dry run"*. Both step kinds this
ticket adds short-circuit under `dry` before a result exists (`:266`, `:628`), so no step can
produce a verdict failure in a dry run and `handleFail` still has no dry-run caller. The reason it
is unreachable **changes** — it is no longer *"`handleFail` has no caller"* — and the coverage
census says so. Reporting it as skipped is the rule; reporting it as covered is what 2026-08-25
forbids.

*Test:* (b) an adapter stub that throws, asserting the event list contains the `step` event and no
`done`. Red against an implementation that emits `done` in a `finally`. (e) demonstrated red by
moving the `recordEvent` call below the gate, as Q-0050's own AC-6d test does.

### AC-14 — The oracle's last four leaf keys gain their first reader

`contracts/Q-0050/run-messages.fixture.json` holds 22 leaf keys; 18 are read by the three engine
test files and the four unread are `gate.kind`, `gate.reason`, `gate.ticketDir` and `gate.retry`
(D-8). A test reads the fixture's `gate` object and asserts the emitted `GateQuestionEvent`'s shape
against it: the four keys of `fixture.gate` are exactly the four optional-and-required fields the
event carries beyond `type` and `gateId`, `retry` present on an exhaustion gate and absent on an
author-declared one. The fixture is **read, never written** (D-9).

*Test:* one test asserting `Object.keys(fixture.gate)` against the emitted event's own keys, over
both gate flavours. It fails if a key is added to the fixture with no reader, which is the property
the oracle's "single" claim needs.

### AC-15 — Both suites are green, the spike is untouched, and the freeze holds

**(a)** `pnpm turbo run test --force`, `pnpm lint` and `pnpm typecheck` are green from a **clean
install** — `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`
first, because a chore worktree has no `node_modules` (`harness/rules.md`).
**(b)** `npm test --prefix spike` is green and **no file under `spike/` is modified**, charter §3.
The branch-scope freeze job is active; the freeze-SHA job is active as of 2026-08-30 and is recorded
at `7b6bc70` (`harness/port-charter.md:265`).
**(c)** Verified **forced in both environment rows** per Q-0072's closing finding: once inside
`integrate`'s worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on
`main` after the merge, where both exist. `turbo-inputs.test.ts` and
`packages/core/src/git-identity.test.ts` are green in both.
**(d)** No test's verdict depends on the machine's git identity, on a git config value it did not
set, or on the existence of a gitignored directory (*"A test's verdict is a property of the commit"*,
2026-08-30). `pnpm sweep:git-identity` is green.

---

## Coverage census

Stated so the gate reads what is covered rather than inferring it.

| Behaviour | Covered by | Note |
| --- | --- | --- |
| `schemaFor` strictness, four shapes | AC-3 | closes Q-0046's named deferral |
| `resolveModel` cross-vendor clause | AC-4a | closes Q-0047 E-1's re-point |
| `adapterOverride` narrowing | AC-4c | **new**, found by reading `projectConfigSchema` |
| Agent step ordering (4 orderings) | AC-5 | each demonstrated by moving the line |
| `{run}` in the write loop | AC-6b | closes Q-0057's core half |
| Base-sync three messages | AC-7c | |
| Script step three outcomes | AC-8e | |
| `step`/`done` first producers | AC-9a | closes Q-0050 obligation 2 |
| `parallel:` member ids | AC-9c | closes Q-0050 round 6 Major 1 |
| Occurrence seam registration | AC-10b | closes Q-0050 E-22 |
| `--dry` resolves and invokes nothing | AC-11 | |
| Q-0050 AC-2b / 2f / 5b / 9e | AC-13a–d | closes Q-0050 E-8's four |
| Q-0050 AC-6d | AC-13e | reachable for the first time |
| Q-0050 AC-10f | **not covered** | AC-13f — reported as skipped, with the new reason |
| `gate.*` fixture keys | AC-14 | |
| The `signalWindow` removal | **not done** | D-7 — declined with reasons and a cheap route |
| The deferral report (Q-0051 OQ-1) | **not done** | D-6 — successor ticket + gate obligation |
| Q-0078's read-side pin | AC-1e only | see *Reported, not fixed* |

---

## Non-goals

1. **Another child's module.** Q-0053 owns `runIntegrate`, `runFanOut` and `testReport`; Q-0054 owns
   the regression suite; Q-0010 owns the binary.
2. **Editing `spike/**`** (charter §3), including its tests.
3. **Fixing a defect found while reading** (charter §2). Reported, never fixed in passing.
4. **Fixing Q-0078.** Explicitly — see below.
5. **Removing the `signalWindow` timer** (D-7).
6. **Emitting a deferral report from the preflight** (D-6) — the successor's, and it needs a decision
   entry first.
7. **Editing `contracts/`** (D-9). Read only.
8. **Adding an event union member.** `packages/shared` is unchanged.
9. **Parsing `res.output` through `stepOutputResultSchema`.** The spike validates with
   `checkAgainstSchema` against the schema it generated; adding a second zod parse would collapse two
   of the four validations register row 13 exists to keep apart.
10. **The cutover**, persisting the event stream, and anything on v1's exclusion list.

---

## Reported, not fixed

Four, each with its authority so a reviewer meets a citation rather than an undocumented hazard.

**1. Q-0078 — `ctx.diffInputs` is keyed by the interpolated range alone.** This ticket writes the
**first consumer** of that cache in `packages/core`: `spike/src/engine.js:747` is
`ctx.diffInputs?.get(range) ?? (ctx.dry ? … : materialiseDiff(step, ctx))`, which prefers the cache
**unconditionally**, so a site correctly classified as deferred can be handed bytes captured before
its producer ran. Ported as it stands, with **one line naming the authority at the read site** —
`Why: preserved defect, see Q-0038 E-3(b) / Q-0078` — and nothing more; the ticket body is not
transcribed into the comment (`harness/rules.md`). Q-0051 already registered the producer side at
`diff.ts:441–445`, so the pin is symmetric.

**Ruled: the source registration is the pin, and no behavioural pin test is written.** Two reasons.
`q0050.source.test.ts:152–183` fails closed in both directions — deleting the line fails the
`REGISTERED` register, and adding one fails it too — so the marker is a real check rather than a
comment. And the *discriminating* scenario, one flow consuming a range both before and after its
producer with the second consumer asserted to receive the producer's work, is **Q-0078's to write
and to demonstrate red** (*"A check is not established by reading it"*, 2026-08-29); writing a
green-today pin for it here would assert the defect rather than the fix and would have to be deleted
by that ticket anyway. It is unreachable in every shipped flow in both trees — `chore.yaml:32`'s only
diff site follows its producer, and `review.yaml:12` and `:19` are parallel members of one group with
no producer between them.

**One correction to Q-0078's own body**, which was written before Q-0051 landed: its *Sequencing*
paragraph says it becomes a two-tree change once Q-0051 has ported the diff subsystem. Half of that
is now true — Q-0051 ported the *producer*; the *reader* that holds the defect is this ticket's.
**Q-0078 becomes a two-tree ticket when this ticket lands.**

**2. `spike/test/q0034-probe-schema.js`'s comment header names stale line numbers.** It cites
`schemaFor` at `spike/src/engine.js:679`; it is at `:711`. Likewise
`packages/shared/src/step-output.ts` cites `:679`, `:684–687`, `:691`, `:739` and `:283–289`, all
shifted by Q-0038's and Q-0057's additions. Cosmetic, in a frozen tree and in a landed package;
reported so a reader does not chase them.

**3. `harness/port-charter.md` §3's prose contradicts its own machine-readable block.** Lines
238–256 say *"The freeze SHA is not yet named"* and *"the SHA-anchored half is SKIPPED, not passed"*,
while the block at `:265` records `freeze-sha: 7b6bc70…` and the table at `:175` says the job has
been **active** since 2026-08-30. The dated note at `:208` records the recording. Not this ticket's
surface and not a blocker — the block is what the script reads — but the paragraph will mislead the
next child that reads it.

**4. `q0050.source.test.ts`'s transcription corpus is not widened to this ticket's body.** Q-0051
ruled the same for its own (D-10), and the reasoning holds here more strongly: this ticket body
quotes the spike comments the port must preserve, so the scan would fire on a faithful port and
pressure the implementer to paraphrase evidence three tickets paid for. **Ruled: no.** Registered as
a reported item for whichever ticket next touches that scan.

---

## Gate obligations

Two items that no step on this route can perform. They are named here so the loop does not spend its
budget attempting them — the pattern Q-0070's requirement identified and Q-0079's run hit again.

### GO-1 — Open the successor to Q-0051's OQ-1, with the body below

Proposed id **Q-0081** (`harness ticket new` allocates it here since Q-0080; the allocator now reads
the backlog's own prefix). The body, written out in full so the obligation cannot expire:

> **Q-0081 — The preflight reports what it deferred, or the rule is amended.**
>
> `preflightDiffs` (`packages/core/src/engine/diff.ts:419`, `spike/src/engine.js:127–169`) defers a
> range whose endpoint an earlier step of the same flow creates, records it in `deferredDiffs`, and
> **says nothing**. The only text describing a deferral today is `buildPrompt`'s dry-run placeholder
> (`spike/src/engine.js:747–749`), and Q-0052's requirement measured that it reaches nobody: the
> prompt holding it is built at `:264` and discarded at `:266`, above `allocateOccurrence` and
> `persistArtifact`, so under `--dry` it is never persisted, never emitted and never shown; under a
> real run it is never produced. Its whole observable effect is on a character count in an `info`
> line that names no range.
>
> The rule it is measured against is *"Q-0035 accepted: a check that skips its subject must not
> report success"* (2026-08-25), which `docs/GLOSSARY.md`'s **Preflight** entry states as reporting
> a declined examination as *skipped*, and which Q-0051's merged requirement calls invariant 11.
> Register row 11 assigns it to Q-0051, which correctly ruled the fix out of its own scope: an added
> event is new behaviour under charter §2.
>
> **What this ticket must decide first, and it is a decision entry rather than a line of code:**
> whether the preflight emits one `info` per deferred range at run start naming the range and its
> producing step (`deferredDiffs` already holds both — `{ ref, step, producers }`, `diff.ts:55`), or
> whether the rule is amended to say a deferral is not a *skip*, on the grounds that the range is
> examined later rather than not at all. The second reading is defensible and has never been written
> down; if it is right, the entry is the deliverable and no code changes.
>
> If an event is added: it lands in `spike/src/engine.js` and `packages/core/src/engine/diff.ts`
> **together**, the Q-0066/Q-0068/Q-0070 shape, or the port loses its independent witness. Its text
> must not claim the range failed — a deferral is an ordering fact, not an error — and the shape to
> copy is the empty-range diagnostic's discipline: quote what is true, claim nothing about how the
> code got there.
>
> Do not re-derive the placeholder's reachability from Q-0051's OQ-1 or from Q-0052's ticket body;
> re-read `spike/src/engine.js:262–270` in order. Two earlier accounts described it as *"the report"*.

### GO-2 — If the `signalWindow` is to go, say so at this gate

D-7 declines it and names the four sites. Reversing that ruling costs one erratum in this ticket's
folder, written before implementation. Not a blocker either way.

---

## Open questions

None blocks implementation. Each carries a recommendation, and the implementer follows the
recommendation unless an erratum says otherwise.

**OQ-1 — Should `steps.ts` split into `agent.ts` and `script.ts`?**
`runScript` is 24 lines and shares only `handleFail` with the agent step. **Recommendation: no** —
the checkable rule D-2 buys is *"one file invokes adapters"*, and splitting gives the second file no
rule of its own while adding a name to a `toStrictEqual` list three tickets edit. Q-0053 will add
one or two more files to this folder; nine is already the point at which a further split should earn
its keep.

**OQ-2 — Should `formatCost` move to `packages/shared`?**
`bin/harness.js` has `formatMoney`, `formatTokens` and `formatVendorSummary` doing adjacent work,
and Q-0010 lifts those. **Recommendation: not now.** Q-0049's merged requirement declined it as NG-2
on the rule that decides the boundary — run history computes, and does not narrate — and moving it to
`shared` before Q-0010 exists guesses at a shape the CLI has not asked for. Reconsider when Q-0010
lands with three siblings for it.

**OQ-3 — Does `runAgentStep`'s `extra.promptSuffix` belong to this ticket or to Q-0053?**
It is a callback taking the worktree cwd and returning a string appended to the prompt (`:264`); its
only producer is the fan-out's task section (`taskPromptSection`). **Recommendation: port the
parameter here** (D-3) and leave the producer to Q-0053. Splitting it means Q-0053 edits this
ticket's signature and its tests, which is the churn the port's landing order exists to avoid.

**OQ-4 — Should the agent step's `runs.log` line move behind the persistence seam?**
`spike/src/engine.js:331` and `:292` append through `backlog.log`; `core` has
`persistence.appendLog`. **Recommendation: use `persistence.appendLog`**, consistent with every
other log line Q-0050 ported, so one seam owns every write and `dry` disables them all in one place.

---

## Risks

**R-1 — The orderings are invisible to a green suite, and this is the ticket's dominant risk.**
Four of AC-5's clauses are orderings. A port that computes the same values in a different order
passes every value assertion. The mitigation is written into each sketch: the test must be
constructed so that moving the line fails it, and the implement report must say which line it moved
to check. This is the class Q-0050 spent six review rounds on.

**R-2 — The suite is large and the review diff will be too.** Two new modules, four edited files and
five or six test files. Q-0050's round-6 prompt was 196 KB and Q-0051's reviewer read 1,563
insertions in 42.7 s. Mitigation: `prompt.ts` and `steps.ts` are separable, and the implement report
should name which criterion each test file serves so the reviewer can navigate.

**R-3 — `chore.yaml` requires `harness/Q-0052/integration` to exist before the first run.**
`review` diffs `integration...implement` and only `integrate`, which runs later, creates the left
endpoint. Since Q-0038 the run refuses in the preflight rather than billing the implementer first,
so this now costs a failed run instead of $13.86 — but it still costs a run. Charter §8, first item.

**R-4 — `ensureWorktree` cuts a worktree from `HEAD` when a step's declared `base:` does not
resolve, silently** (`spike/src/git.js`, and its port). `chore.yaml:11` declares
`base: "harness/{id}/integration"`. Named as a non-goal by Q-0038 with its evidence; it means R-3's
symptom can be *"the implementer worked in a tree from somewhere else"* rather than a clean failure.
Not this ticket's to fix.

**R-5 — The `preserved defect/` count is a cross-file arithmetic that Q-0053 will move again.**
`q0050.source.test.ts:182` counts across all files, deliberately, so a marker moved between files
fails. This ticket changes the number; Q-0053 changes it again. Both must edit the comment above it
too, or the comment describes a number that is no longer there.

**R-6 — `{run}` derives from `runs.log` and `ticket.meta.history`** (`spike/src/engine.js:776–784`),
so two concurrent runs collide (Q-0039) and a hand-edited `runs.log` moves it. Stated rather than
assumed; neither is new — `reviewRound` reads the ticket folder with the same exposure — and neither
is this ticket's to fix.

**R-7 — Two of Q-0050's inherited claims were stale when checked, and a third was already
discharged.** Obligation 7's two `info` texts are read at `lifecycle-routing.test.ts:123–125`; the
`signalWindow` invitation was overtaken; three of the four functions the body says to port already
exist. Anything else inherited should be re-measured before it enters a durable record, not
transcribed.

---

## Cross-cutting checklist

| | Answer |
| --- | --- |
| **BYOS** | No API-key path is added. `schemaFor`, `buildPrompt` and `resolveModel` never see a credential; `check()`'s refusal is Q-0046's and is untouched. No test, fixture or example mentions a key |
| **Worktree safety** | AC-7. Code-writing steps run in worktrees under `.harness/worktrees/` on branches beside `harness/<id>/integration`; nothing writes the user's working tree. Enforced in `core` |
| **Gate behaviour** | Unchanged — the gate is Q-0050's in full (D-1). Register row 17 is inherited and re-checked, not re-implemented: an exhaustion gate is `human-locked` so `--auto` cannot bypass it, and a missing, empty, invalid or disallowed answer fails rather than inventing a decision. AC-13e exercises the path through `handleFail`'s two new callers |
| **File format and schema** | No format changes. `packages/shared` is unchanged; `stepOutputDeclarationSchema` and `stepOutputResultSchema` already describe both sides and neither is edited. `contracts/` is read only |
| **Lint rules** | No `harness lint` rule changes. `@typescript-eslint/no-deprecated` covers both new files, tests included (Q-0069) |
| **Cold-clone impact** | None. Internal machinery; no README, flag or first-run step changes |
| **Cross-vendor rule** | n/a to the code. The route satisfies it: Claude implements, Codex reviews (`chore.yaml`) |
| **Product-agnostic** | No product name appears. Note `spike/src/adapters/claude.js:12` and `codex.js:21` say *"Harness runs on subscription OAuth only"*, which `product-boundaries.md` forbids — that is **Q-0068's**, preserved by Q-0046 and Q-0047 and not fixed here |
| **Errors are explicit** | AC-5d. Invalid structured output saves the raw text beside the ticket and stops the run naming the path. Nothing is defaulted silently |

---

## Decisions cited

- *"The port preserves behaviour; one exception is authorised and everything else stops the child"*
  (2026-08-25) — every ruling that declines a fix.
- *"The port takes the chore route, except the one child that has new behaviour"* (2026-08-25) — the
  route, and why no decision entry can be written on it.
- *"Non-auto exhaustion gates require an explicit human or scripted answer"* (2026-08-23) — register
  row 17, inherited.
- *"Flows never pin a vendor model name"* (2026-08-22) — AC-4a, register row 2's third clause.
- *"Step-output validation is Quorum's contract with its own agents"* (2026-08-22) — AC-3, and NG-9's
  refusal to add a second validator.
- *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) — AC-12a.
- *"Q-0035 accepted: a check that skips its subject must not report success"* (2026-08-25) — D-6 and
  AC-13f.
- *"A check is not established by reading it"* (2026-08-29) — every *Test:* sketch that says how it
  is made to fail.
- *"A reviewer approves the change it asked for"* (2026-08-29) — why the reported-not-fixed items are
  named here rather than left for review.
- *"An erratum is the last repair, not the first"* (2026-08-30) — D-7's and GO-2's route.
- *"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) —
  AC-15d.
- *"A cache hit names what the task reads, not what its package contains"* (2026-08-28) — AC-15c's
  two environment rows.
- *"A nit does not contradict an approval"* (2026-08-28) — the verdict coupling AC-3 generates and
  `checkAgainstSchema` enforces.

---

## Provenance

Written against the tree, not against the ticket body. Every line number was read at `4697ac0`;
where the body, a sibling's errata or a landed comment disagreed with the file, the file won and the
disagreement is recorded rather than silently resolved.

**What reading the code bought that the body did not have.** Three of the four functions the body
assigns to this ticket are already ported (D-1) and two of its inherited obligations are already
discharged or spent (D-7, D-8), which removes roughly a third of the apparent scope. Two hazards
were found that nothing had named: `config.adapterOverride` arrives typed `unknown` through a
`looseObject` and a `String()` coercion there resolves every run to an adapter named `undefined`
(AC-4c); and `contracts/` is outside the chore role's write paths, so the obvious home for this
ticket's fifteen new message strings is unwritable on this route (D-9). And Q-0051's OQ-1 was ruled
on evidence rather than argument: the `--dry` placeholder lives in a prompt discarded four lines
after it is built (D-6), which is what makes *"a report is owed"* a measurement instead of an
opinion.
