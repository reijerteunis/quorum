# Q-0044 — `core/lint`: flow lint and whole-directory validation

*Requirement candidate (product-manager, claude), 2026-08-26. Route: chore (`requirements → chore →
human gate`). Parent: Q-0009. Charter: `harness/port-charter.md`; §6's register row for Q-0044 is
normative, and the invariants inherited are rows 12, 16 and 18. Surfaces: `packages/core` (one new
module folder and its tests). No change under `spike/`, none to `packages/shared`, none to any flow
file, and no CLI — `packages/cli` does not exist until Q-0010.*

## Problem

`spike/src/lint.js` is 194 lines and it is the only place this product's opinions are enforced
rather than merely written down. Nine of the twenty problems it can report exist because a decision
was made and someone had to make it checkable: bounded backward edges (2026-08-21), the refined
cross-vendor rule (2026-08-21), the derived cross-flow regression target (2026-08-23), and the diff
range grammar (Q-0034, Q-0035). Every rule in the file is a decision with a date behind it, and the
file is the only thing standing between those decisions and a flow that quietly ignores them.

The exposure is not that the port loses a rule. A missing rule is visible: a fixture stops throwing
and a test goes red. The exposure is that the port keeps all twenty rules and changes what they
*say*, or narrows what they *see*, in ways nothing in this repository can currently detect.

**Three specific ways, each verified against the code today.**

**The messages are the feature, and TypeScript is what will damage them.** `lintFlow` accumulates
into an array and throws once, so a reader gets every defect in one pass, and fourteen of the
sixteen messages open with the step id — the token a reader greps for in the YAML. That only works
because the function type-checks nothing: it returns `true` for `adapter: 42`, `id: 42`, `gate: 42`
and `cross_vendor: 42`. A strict-TypeScript rewrite has one obvious move available — type the
parameter as `Flow` and call `flowSchema.parse()` at the top — and it produces a linter that passes
every fixture the implementer writes (because those fixtures are built as `Flow` objects) while
replacing a lint message with a zod issue naming `steps[3].on_fail.max_iterations`. That is the
exact failure *"Zod describes structure and types; the flow lint keeps the semantics"*
(`docs/DECISIONS.md`, 2026-08-25) exists to prevent, arriving through the type checker rather than
through a design choice.

**The rule the ticket calls most likely to be lost is protected by no corpus.** `diffSites` reads
every `input.diff` a flow can hold *including the one inside a `fan_out` step's `step:` template*,
which `flattenSteps` deliberately does not visit. There are exactly three `diff:` lines in all six
shipped flows — `chore.yaml:32` and `review.yaml:12,:19` — and **none of them is inside a fan-out
template**. `development.yaml` is the only flow with a `fan_out` step and its template carries no
diff. So a port that drops the extra site, or that "simplifies" `diffSites` into a `flattenSteps`
call, leaves all twelve shipped flow files linting clean. The only thing that catches it is a test
written for the purpose, and the only such test today lives in `spike/test/q0035-empty-range.js`,
which runs against the spike and will not run against `core` until Q-0054.

**One rule silences another on purpose, and it looks like a bug.** The cross-vendor block sets
`invalidPanel` when a panel problem is found, and then runs the judge-own-vendor rule **only if that
flag is false** (`lint.js:100`). A reviewer tidying this into two independent loops changes the
output of a flow that has both defects — and the frozen Q-0033 suite asserts the negative directly:
S8.1 and S8.3 require that a single-vendor panel's message does **not** contain "written by its own
vendor" (`spike/test/q0033-surface.js:228,:233`). The behaviour is pinned, in the frozen witness,
by an assertion about text that must be absent.

Underneath all three is the same structural problem the port has everywhere and has here in its
sharpest form: **the two suites that would catch a transcription slip both run against the spike.**
`q0033-surface.js` and `q0035-empty-range.js` import from `spike/src/`, they are frozen under
charter §3, and Q-0054 is the ticket that translates them — which lands last. Between this ticket
and that one, the only thing asserting that `core`'s linter says what the spike's linter says is
this ticket's own test file.

## User stories

- **As the maintainer**, when a flow I edited is wrong I need `quorum lint` to name every problem in
  one pass, each opening with the step id I can grep for, exactly as it does today — because the
  alternative is running lint, fixing one thing, running it again, and doing that six times.
- **As the maintainer**, I need the fan-out template's `input.diff` to stay checked after the port.
  It is the one static check that protects a range no run can validate early, and a run that
  discovers it at step time has already paid a fan-out's worth of adapters.
- **As the cold-clone adopter**, I need the six flows `quorum init` copies into my repository to lint
  clean on the first try. A new rule I did not write, refusing a file I did not write, in my first
  thirty minutes, is the worst possible first impression.
- **As the contributor writing an adapter or a flow template**, I need the cross-vendor rule to keep
  being satisfied by a panel spanning vendors rather than by writer ≠ reviewer — with two vendors a
  judge necessarily shares one, and the strict reading would demand a third vendor for every judge.
- **As the contributor writing `packages/cli` (Q-0010) or M3's server**, I need whole-directory
  validation to be a function in `core` that returns per-file records, so the CLI's job is choosing
  a marker and a colour and nothing else.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/lint.js` — `FlowError` `:5`, `flattenSteps` `:7`, `groupBy` `:9`, `writesOf` `:18`, `globMatch` `:23`, `validDiffRange` `:36`, `diffSites` `:49`, `lintFlow` `:56–129`, `lintFlowDirectory` `:131–185`, `validateFlowDirectory` `:187–194` |
| The lift | `spike/bin/harness.js` — `lintDirectory` `:374–388`, `printReport` `:390`, the colour helper `c` `:44`; called at `:464` (the `lint` command) and `:597` (the `run` preflight, before `loadFlowByName` and before `--adapter` rewrites anything) |
| In-package consumers, all later children | `spike/src/engine.js:11` imports `FlowError`, `lintFlow`, `flattenSteps`; `:13` re-exports `FlowError`, `lintFlow`, `lintFlowDirectory`, `validateFlowDirectory`; `:738` re-exports `flattenSteps`; `loadFlow` at `:15–20` assigns `flow.file` then calls `lintFlow`. All Q-0050/Q-0051 |
| The runtime twin of AC-3's rule, which is **not** this ticket's | `spike/src/engine.js:797–801` — the engine's own range guard, with its own message. Q-0051 |
| Frozen suites that pin this behaviour, and that Q-0054 translates | `spike/test/q0033-surface.js` — S1.3/S6.1/S7.8/S8.2 (`:114`), S6.2–S6.10 (`:194`), S7.1–S7.7 (`:210`), S8.1–S8.4 (`:222`), and `flowDiagnostic` (`:38–45`), which parses the CLI's block format. `spike/test/q0035-empty-range.js:255–295, :555–590` — the range grammar and the fan-out template site. `spike/test/smoke.js:240–266` — loop convergence and the fan-out exemption |
| Already in `shared`, and not to be spelled twice | `flowSchema`, `flowStepSchema`, `Flow`, `FlowStep`, `AgentStep`, `OnFail`, `stepInputSchema` (`flow.ts`); `stepOutputDeclarationSchema` (`step-output.ts`); `ticketBranchPrefix`, `DEFAULT_BASE_BRANCH` (`constants.ts`) |
| The boundary this ticket must not cross | `packages/shared/src/flow.ts:8–38, :97–101` — rule 1 and what E-1 does *not* authorise: no zod issue may replace a lint message |
| Test helpers already shipped | `packages/core/test/corpus.ts` (`repoRoot`, `repoFile`, `coreSourceFiles`) and `packages/core/test/repo.ts` (`tempDir`, `write`, `walk`, `removeTempDirs`) |
| The folder rule | *"`core` is organised in folders named after the port's children"* (`docs/DECISIONS.md`, 2026-08-26). This module's folder is `lint/`, and `coreSourceFiles()` is already recursive and keyed by path below `src` |
| Where types must not go | Charter §4: the dependency direction is `core → shared` and never the reverse |

**Eight facts established by running the code rather than reading it.** The criteria depend on all
eight.

1. **All twelve shipped flow files lint clean today** — six under `harness/flows/` and six under
   `spike/templates/harness/flows/`, through `lintFlowDirectory`, zero problems each. The two
   directories are also byte-identical (`diff -rq` reports nothing).
2. **No shipped flow exercises the fan-out template diff site.** Three `diff:` lines exist in total,
   all outside a `fan_out` step. Register row 12's second half has no corpus protecting it.
3. **Only one shipped flow uses a cross-flow edge** — `review.yaml:40`, `goto: flow:development`. The
   entire return-chain walk (`lint.js:148–183`) is exercised by one edge in the shipped set.
4. **`lintFlowDirectory` on a directory that does not exist throws a bare `ENOENT` `Error`**, not a
   `FlowError`, so `quorum lint` in a project whose `harness/flows/` is missing prints a raw Node
   error rather than a sentence.
5. **An empty `.yaml` file reports `Cannot set properties of null (setting 'file')`** as its problem
   — a raw `TypeError` message from `flow.file = file` on `YAML.parse`'s `null`, rendered to the user
   as a lint finding.
6. **A `.yml` file is skipped in silence.** The filter is `.endsWith('.yaml')`; a flow named
   `review.yml` is neither linted nor reported as unread.
7. **`diff: null` passes and `diff: ''` fails.** `diffSites` filters on `value != null`, so an
   explicit null is exempt from the grammar and an empty string is refused by it.
8. **`harness/Q-0044/integration` does not exist.** No branch matches `*Q-0044*`.

## Acceptance criteria

Each is independently testable against throwaway directories the test builds, or against this
repository read-only. No criterion may be satisfied by asserting a fact this repository's next
landing changes — the permanent-acceptance-test decision (2026-08-23).

**AC-1 — The module exists at `packages/core/src/lint/lint.ts`, exports exactly this surface, adds no validator in front of the linter, and `packages/core/src/index.ts` is not modified.**
It exports `FlowError`, `flattenSteps`, `lintFlow`, `lintFlowDirectory`, `validateFlowDirectory` and
`lintDirectory` — six names, no more. TypeScript strict, no `any`, no `@ts-ignore`, and it imports
nothing under `spike/`. It declares no flow schema, no step schema and no second spelling of a
branch prefix or a base-branch default: types come from `@quorum/shared`.

**`lintFlow` accepts `unknown` and narrows internally. It does not call `flowSchema.parse`,
`safeParse`, or any zod method, and its parameter is not typed `Flow`.** The linter must keep
accepting every object it accepts today, including `adapter: 42`, and a zod issue may never replace
one of its messages — rule 1 of *"Zod describes structure and types; the flow lint keeps the
semantics"* (2026-08-25) and `packages/shared/src/flow.ts:97–101`.
*Test:* `Object.keys` over the module namespace equals the six names; a source-level test over
`coreSourceFiles()` asserts that `lint/lint.ts` contains no `flowSchema`, no `.parse(`, no
`.safeParse(` and no `from 'zod'`, and that the literals `'harness/'` and `'main'` appear in no file
under `packages/core/src/lint/`; `repoFile('packages/core/src/index.ts')` still equals
`export const name = '@quorum/core';\n`, keeping Q-0041's byte pin green.
*Typing note:* narrowing `unknown` needs local type predicates or assertions at the read boundary.
Those are acceptable and each carries a one-line comment naming why (`lintFlow` validates the flow
format, not its types — see AC-1); `any` and `@ts-ignore` are not.

**AC-2 — `lintFlow` reports the same sixteen problems, with the same message text, in the same order, and reports all of a flow's problems at once.**
The sixteen messages, verbatim, with `${…}` marking interpolation:

| # | Message | Source |
| --- | --- | --- |
| 1 | `duplicate step id "${id}"` | `:60` |
| 2 | `${step.id}: on_fail without goto` | `:63` |
| 3 | `${step.id}: goto target "${goto}" not found` | `:64` |
| 4 | `${step.id}: on_fail.max_iterations must be an integer greater than zero` | `:66` |
| 5 | `${step.id}: on_fail.counter must be a non-empty unprefixed key` | `:70` |
| 6 | `${step.id}: counter "${counter}" must be unprefixed; use "${corrected}"` | `:73` |
| 7 | `${step.id}: on_exhausted must be "gate"` | `:75` |
| 8 | `${step.id}: has a verdict but no on_fail/route — verdicts must go somewhere` | `:77` |
| 9 | `${step.id}: fan_out needs a step template` | `:78` |
| 10 | `${step.id}: integrate needs branches` | `:79` |
| 11 | `${label}: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got ${JSON.stringify(value)}` | `:83` |
| 12 | `parallel group ${ids}: shares role "${role}" and adapter "${adapter}" — cross_vendor: required needs at least two adapters` | `:96` |
| 13 | `${step.id}: every input it judges (${reviewed}) was written by its own vendor (${adapter}) — cross_vendor: required` | `:107` |
| 14 | `${step.id}: loops back to "${target}", which never receives ${written} — the loop cannot converge` | `:121` |
| 15 | `flow needs consumes/produces` | `:124` |
| 16 | `deploy flow must contain a human-locked gate` | `:126` |

The thrown message is `` `flow ${flow.name ?? flow.file} invalid:\n  - ${problems.join('\n  - ')}` ``
and the error is a `FlowError`. **The order is the order the source pushes**: duplicate ids first,
then the per-step block in step order, then diff sites, then cross-vendor, then loop convergence,
then `consumes`/`produces`, then the deploy gate. A valid flow returns `true`.
*Test:* one fixture per message asserting the exact string with `toContain` on the built message,
and a multi-problem fixture asserting the **entire** thrown message string equals a literal —
including the header, the two-space-hyphen bullets and the order. Message 11 carries `…` (U+2026),
not three dots, and one assertion pins that character specifically. A fixture with no `name` and no
`file` produces `flow undefined invalid:` and is pinned as such (fact 5's sibling — carried, not
fixed, and named under AC-11).

**AC-3 — The diff range grammar is unchanged, and it is read at every site a flow can hold one, including inside a `fan_out` step's `step:` template.** *(Register row 12.)*
A range is valid when `String.split('...')` yields exactly two endpoints and each is `{base}` or
matches `/^harness\/\{id\}\/.+/`. A non-string is invalid. `{id}` stays uninterpolated: the rule is a
property of the text and runs no git. `diffSites` returns `{label: step.id, value: step.input?.diff}`
for every flattened step, **plus** `{label: `${step.id}.step`, value: step.step.input?.diff}` for a
step carrying both `fan_out` and `step`, and filters on `value != null`.

**And `flattenSteps` still does not visit the template.** Both halves are the criterion: the
template's `id`, `role` and `adapter` are placeholders, so the duplicate-id, goto, cross-vendor and
loop-convergence rules must not see them.
*Test:* a table of accepted ranges (`{base}...harness/{id}/integration`,
`harness/{id}/integration...harness/{id}/implement`) and refused ones (one endpoint; three endpoints;
`main...harness/{id}/x`; `harness/other/x...{base}`; `harness/{id}/`; the empty string; a number; a
boolean), each asserting message 11 with its `JSON.stringify`'d value. Then, separately: a `fan_out`
step whose `step.input.diff` is malformed fails with the label `<step id>.step`; and a `fan_out` step
whose **template** carries a duplicate id, a `goto` naming nothing, and a verdict with no route
produces **no** problem from any of those three rules — so the port cannot satisfy this criterion by
making `flattenSteps` recurse. `diff: null` passes and `diff: ''` fails (fact 7).
*Why the test is the whole protection:* fact 2 — no shipped flow reaches this site.

**AC-4 — Both cross-vendor rules behave as they do today, including the short-circuit between them.** *(Register row 18.)*
Under `cross_vendor: required`:

*The panel rule* iterates `flow.steps` **unflattened**, skips any entry without `parallel` or with
fewer than two members, groups the members by `role`, skips a role subgroup of fewer than two, and
reports message 12 when that subgroup's members share one `adapter`. The id list is
`members.map(step => step.id).join(', ')` in member order.

*The judge rule* runs **only when the panel rule reported nothing.** It builds a producer map over
the flattened steps in order — last writer wins — from `output.write` (a single value) and
`output.writes` (an array), then for each step carrying `output.verdict` globs its `input.backlog`
patterns against the producer keys and reports message 13 when the matches are non-empty and every
one of them was produced by that step's own adapter. A step that judges nothing is exempt.

*The glob* anchors both ends, escapes `.+?^${}()|[]\`, expands `*` to `[^/]*` (so it does not cross a
`/`), and additionally matches when the pattern ends with `/` and the value starts with it.
*Test:* S8.1–S8.4 transcribed — two-member single vendor, the shipped panel, three-member single
vendor, mixed three-member. Plus the short-circuit, stated as its own case: a flow carrying both a
single-vendor panel **and** a same-vendor judge reports only message 12, and the thrown message does
not match `/written by its own vendor/i`. Plus glob cases: `review/*.md` matching `review/a.md` and
not `review/sub/a.md`; `review/` matching `review/sub/a.md`; a pattern containing `.` matching
literally. Plus: a flow without `cross_vendor: required` reports neither.

**AC-5 — `on_fail` bounds, counter spelling, goto resolution and the verdict-must-route rule are unchanged.**
`on_fail` without `goto` gives message 2. A `goto` that does not start with `flow:` and is not among
the collected step ids gives message 3; a `flow:`-prefixed target is not resolved here (AC-7 does
that). `max_iterations` must satisfy `Number.isInteger` and be greater than zero — absent, `'three'`,
`1.5`, `0` and `-1` each give message 4. `counter` absent or `null` is accepted; a non-string or a
whitespace-only string gives message 5; a string starting with `iterations.` gives message 6 naming
the corrected spelling. `on_exhausted` must be exactly `'gate'`. A step with `output.verdict` and
neither `on_fail` nor `route` gives message 8.
*Test:* S7.1–S7.7 transcribed, plus the non-verdict step case (`spike/test/q0033-surface.js:219`,
which proves counter spelling is not a verdict-specific rule), plus `counter: null` accepted, plus a
`goto: flow:whatever` accepted by `lintFlow` alone.

**AC-6 — The loop-convergence rule is unchanged, including both exemptions.**
For each flattened step with a non-`flow:` `on_fail.goto`: if the step writes nothing, skip; if the
destination is not found or the destination is a `fan_out` step, skip; otherwise report message 14
when no written path glob-matches any pattern in the destination's `input.backlog`.
*Test:* `spike/test/smoke.js:240–266` transcribed — a loop that hides its verdict from the step it
returns to fails; feeding the verdict back makes it lint; a fan-out destination is exempt because
the engine feeds it the result. Plus a step that writes nothing and loops back, asserted clean.

**AC-7 — `lintFlowDirectory` walks the directory the same way, returns the same record shape, and proves the same return chains; `validateFlowDirectory` aggregates them the same way.** *(Register row 16, the half this ticket owns.)*
The walk reads `.yaml` files only, sorted by filename, and for each: `YAML.parse` the text, assign
`flow.file = <full path>`, `lintFlow` it. Success records `{file, flow, problems: []}` and adds the
flow to the corpus; **any** thrown error records `{file, problems: [error.message]}` with **no
`flow` key** — a lint failure's whole multi-line message as a single array element, a YAML syntax
error's message unchanged, and fact 5's `TypeError` message unchanged.

The cross-flow walk then resolves each `flow:<target>` edge against a map keyed by **filename stem**,
not by the `name:` field, and pushes onto the **source** flow's record:

| Condition | Message |
| --- | --- |
| target not in the map | `flow ${source.name}: target flow ${targetName} is missing or unloadable` |
| a `(flow, stage)` pair repeats | `flow ${source.name}: target flow ${targetName} has a cycle at stage ${stage}; implicated flows: ${cycle}` |
| no flow consumes `stage` | `flow ${source.name}: target flow ${targetName} dies at stage ${stage}; it never returns to ${source.consumes}` |
| more than one flow consumes `stage` | `flow ${source.name}: target flow ${targetName} is ambiguous at stage ${stage}; implicated flows: ${names}` |

The walk starts at the target's `produces`, follows the single flow consuming each stage, and stops
when the stage equals the source's `consumes`. Ambiguity on a stage the walk never reaches is not
reported. `validateFlowDirectory` throws a `FlowError` whose message is the invalid records rendered
as `` `${basename(file)}:\n  - ${problems.join('\n  - ')}` `` joined by `\n`, and otherwise returns
the flows in file order.
*Test:* S6.2–S6.10 transcribed against throwaway directories — multi-hop clean, missing target,
unloadable target, dead end, ambiguity, unreached ambiguity clean, cycle, self-target. Plus the
record shape asserted directly (`'flow' in record` false on every failure path, true on success);
plus `flow.file` present on every successful flow and equal to the full path.

**AC-8 — `lintDirectory` moves into `core`, and the bytes `harness lint` prints are reproducible from what it returns.**
`lintDirectory(flowsDir)` returns `{ok, records}` where `ok` is true when no record has a problem,
and each record carries its full path, its basename, and its problems **flattened to one problem per
element**: each problem string split on `\n`, each line trimmed, empty lines dropped, the first line
dropped when there is more than one line and it ends with `invalid:`, and a leading `-` with its
following whitespace stripped from each remaining line. **No ANSI escape, no marker glyph and no
indentation appears in `core`** — see OQ-1.
*Test:* over a throwaway directory holding one clean flow, one flow with three lint problems, one
flow with a YAML syntax error and one flow with a cross-flow problem, assert the flattened arrays
element by element. Then, in the same test, apply a three-line renderer —
`` ok ? `✓ ${filename}` : `✗ ${filename}\n${problems.map(p => `  - ${p}`).join('\n')}` `` — and
assert the result matches the block format `spike/test/q0033-surface.js:38–45` parses: a line
`✗ <filename>` followed only by lines matching `/^\s+-\s/`. The renderer belongs to Q-0010; asserting
that one exists which reproduces the format is what makes this criterion checkable now.

**AC-9 — Every shipped flow still lints clean, through the ported code, in both directories.**
`validateFlowDirectory` over `harness/flows/` returns six flows and throws nothing, and the same over
`spike/templates/harness/flows/` returns six flows and throws nothing. No rule is added, tightened or
newly applied: a flow file this repository ships must not be refused by anything this ticket writes.
*Test:* both directories run through the **ported** `validateFlowDirectory`, asserting six records
each with zero problems, and failing loudly if either directory yields no `.yaml` files at all. A
second assertion compares the two directories' outputs for the same filenames, so a divergence
between the shipped set and the template set shows up here as well as in the frozen suite.
*Why it is stated as a criterion:* it is the shipped-flows half of the ticket body's second
non-goal, and it is what protects the cold-clone adopter from a rule nobody meant to add.

**AC-10 — `FlowError` is the same class, thrown from the same places, and recognisable the same way.**
It extends `Error`, overrides nothing — not `name`, not `message` — and is exported from the lint
module, because `spike/bin/harness.js:605` routes on `e instanceof FlowError` to print one sentence
instead of a stack, and Q-0010 must be able to reproduce that. `lintFlow` and `validateFlowDirectory`
throw it; `lintFlowDirectory` throws nothing of its own and catches everything per file.
*Test:* `new FlowError('x') instanceof Error` is true, `.name` is `'Error'` (not `'FlowError'`), and
`.message` is `'x'`; a failing `lintFlow` and a failing `validateFlowDirectory` each throw an
instance; a source-level assertion that the class declares no `name` assignment.
*Why `.name` is pinned:* `spike/test/q0034-review-fixes.js:109–112` records that the routing depends
on `instanceof` rather than on `name`, and a TypeScript rewrite that helpfully sets
`this.name = 'FlowError'` changes what a stranger sees at the top of an error.

**AC-11 — The preserved defects are pinned by test and named in the implementation report.**
Each is carried unfixed under charter §2 and reported, not repaired:

1. `lintFlowDirectory` on a missing directory throws a raw `ENOENT` `Error`, not a `FlowError` (fact 4).
2. An empty `.yaml` file reports `Cannot set properties of null (setting 'file')` as a user-facing
   problem (fact 5).
3. `.yml` files are skipped without being reported as unread (fact 6).
4. `flattenSteps(null)` and `flattenSteps([null])` throw a raw `TypeError`.
5. `lintFlow` requires an `id` on no step kind, so an id-less step lints clean and the engine later
   builds `harness/<ticket>/undefined` — **Q-0055 owns the fix and lands after this ticket.**
6. `diff: null` is exempt from the range grammar while `diff: ''` is refused (fact 7).
7. A flow with neither `name` nor `file` throws `flow undefined invalid:`.
8. Cross-flow messages name the **source** by its `name:` field and the **target** by its filename
   stem, so the two halves of one sentence come from two different identifiers.

*Test:* each of the eight asserted directly, so a later "cleanup" that fixes one without a decision
turns this suite red rather than passing silently.
*Report:* `dev/implement-report.md` names all eight, plus anything else found while reading, and
states for each that it is preserved rather than fixed.

## Non-goals

- **Another child's module.** Engine, diff preflight and materialisation, fan-out, integrate, run
  history, contracts and adapters are Q-0045 through Q-0053. In particular the engine's own range
  guard and its message (`spike/src/engine.js:797–801`) are **Q-0051's**, not a second copy to write
  here; and `loadFlow`, which calls `lintFlow`, is Q-0050's.
- **Requiring a step id** (Q-0055), **deciding what `route` is** (Q-0056), **the chore flow's step
  order as a statically checkable property** (Q-0038), or any other new lint rule. The ticket body
  names the last of these explicitly and the first two are open tickets; adding any of them here
  would also break AC-9 or exceed it.
- **Fixing anything found while reading** — charter §2. That covers all eight items in AC-11 and
  anything else. The route for a deliberate change is its own `docs/DECISIONS.md` entry or a dated
  erratum in this ticket's folder, accepted before it is implemented.
- **Editing `spike/**`** — charter §3. The frozen suites stay where they are and keep running against
  the spike; Q-0054 translates them.
- **Changing any flow file**, in `harness/flows/` or `spike/templates/harness/flows/`, or adding a
  seventh flow. Q-0012 ships `qa-final.yaml` and `deploy.yaml`.
- **Adding a rule or a message to `packages/shared`.** The zod schemas landed with Q-0041 and this
  ticket imports them for typing only. No zod issue may replace a lint message.
- **The `quorum` binary, argument handling, colour, markers, indentation, `printReport` and process
  exit behaviour** — Q-0010 and the cutover. `spike/bin/harness.js` keeps its own copy of
  `lintDirectory` until then; the spike is not a workspace member and it is the port's only
  independent witness.
- **Re-exporting from `packages/core/src/index.ts`.** `packages/shared/src/index.test.ts:52–53` pins
  that file byte for byte, and every consumer this ticket has is in-package.
- **A persisted event stream, a lock on a ticket, `--base`, budget enforcement, gate semantics** —
  Q-0039, Q-0040, Q-0050 and the carried M1 items.
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell.

## Open questions

None blocks solutioning; each has a recommendation the implementer can proceed on. OQ-1 is the one
worth a minute at the gate.

| # | Question | Recommendation | Owner |
| --- | --- | --- | --- |
| OQ-1 | `lintDirectory` returns colourised strings today (`c.green('✓')`, `c.red('✗')`). Does the ported one keep the ANSI, or return structured records for a renderer to colour? | **Structured records** — AC-8. Charter §7 puts rendering in the CLI's residual scope, and M4's flow editor shows lint errors inline in a browser, where an ANSI escape is a bug. The printed bytes are preserved because the renderer is three lines and AC-8 proves one exists that reproduces them. The cost is that `lintDirectory`'s *shape* changes, which is an internal boundary §2 explicitly does not preserve — but it is a shape thirteen tickets will not see and Q-0010 will. | decided; confirm at the gate |
| OQ-2 | Charter §6's register names four exports and omits `lintFlowDirectory`, while the ticket body's first paragraph names five. Is it exported? | **Yes, exported.** The register lists what is ported, not what is hidden; `lintDirectory` and `validateFlowDirectory` both call it, `spike/src/engine.js:13` re-exports it today, and hiding it would be a surface reduction no decision authorises. AC-1's six names include it. | decided |
| OQ-3 | Does `FlowError` stay in the lint module, move to `shared`, or get its own `core/src/errors.ts`? | **Stays in the lint module**, exactly as the spike has it. The spike's pattern is that an error class lives beside its first thrower (`IntegrationError` is in `fanout.js`, Q-0048's), Q-0050 imports it from `../lint/lint.js` as `engine.js:11` does today, and `shared` is declarations only. Moving it is a boundary change with thirty-plus downstream throw sites and no ticket asking for it. | implementer |
| OQ-4 | One file (`lint/lint.ts`, ~200 lines) or split — `lint.ts` for `lintFlow` and `flow-directory.ts` for the walk? | **One file.** The register names one module, 194 lines is not a legibility problem, and `validDiffRange`/`diffSites`/`globMatch`/`writesOf` are shared by both halves. The folder exists because the 2026-08-26 decision says every core module gets one, not because this module has two. | implementer |
| OQ-5 | Should the port keep `lintFlowDirectory`'s per-file `try`/`catch` broad, given it currently swallows a `TypeError` and renders it as a lint finding (fact 5)? | **Yes, unchanged.** Narrowing the catch is a behaviour change: it would turn an empty `.yaml` file from a reported problem into an uncaught throw out of `quorum lint`. It is defect 2 in AC-11 and is carried. | decided |

## Risks

- **The TypeScript trap is the whole ticket.** Typing `lintFlow(flow: Flow)` or calling
  `flowSchema.parse` at the top compiles, passes fixtures the implementer builds as `Flow` objects,
  and refuses real-world flows while replacing sixteen good messages with zod paths. AC-1 makes it a
  source-level assertion so it fails in seconds rather than at review.
- **Register row 12 has no corpus.** Fact 2 — no shipped flow puts an `input.diff` in a fan-out
  template, so AC-3's test is the only thing standing between the port and a silently narrowed
  static check, on the site that is most expensive to fail at run time. A reviewer should read that
  test before reading the implementation.
- **Nothing outside this ticket's own suite catches a message slip until Q-0054.** Both frozen suites
  import from `spike/src/`. That is by design (§3 keeps the witness unedited), and it means the
  verbatim-message assertions in AC-2 are load-bearing rather than belt-and-braces.
- **The short-circuit reads as a bug.** `if (!invalidPanel)` looks like something to tidy away, and
  the frozen suite pins it by asserting text is *absent*. AC-4 makes it explicit so a reviewer does
  not have to rediscover why it is there.
- **`harness/Q-0044/integration` does not exist** (fact 8). The chore flow's `review` step diffs
  against that branch and only `integrate` creates it, so the first run fails after the implementer
  has been billed — the $13.86 failure recorded on 2026-08-25. **Create it from `main` before the
  run**, per charter §8 and `02-sdlc-pipeline-spec.md` §5.8.
- **A gate that cannot be answered destroys a proven-green merge.** Q-0040 is open and has cost two
  tickets their merge on consecutive nights. Run this where a human can answer the final gate, and if
  the run dies there, re-perform `integrate` by hand before trusting the branch.
- **`integrate` can report a cached pass** (Q-0065). `pnpm turbo run test` without `--force` will
  replay a green it did not execute. Verify the merge with `--force` before trusting `tests=ok`.
- **Scope drift into three open tickets.** Q-0055 (step ids), Q-0056 (`route`) and Q-0038 (chore step
  order) all live in this file and all are somebody else's. Any new rule, or any change that makes a
  shipped flow fail, is unrequested scope and AC-9 turns it red.
- **Scope drift into the engine.** `lintFlow`'s three importers are all in `engine.js`, and reading
  them to check a signature is one step from porting them. The reviewer should treat any change
  outside `packages/core/src/lint/` and its tests as unrequested.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable read, no network. The `adapter` field this module reasons about is a name in a YAML file and nothing more. No code path, test or example accepts a key. |
| **Worktree safety** | n/a directly — this module reads files and returns values; it creates no branch, no worktree and no ref, and writes nothing anywhere. Indirectly it is a guard for register row 19: AC-3's grammar is what keeps a flow's `input.diff` pointed at the configured base or the ticket's own branches, statically, before any run. |
| **Gate behaviour** | Message 16 is enforced here: a flow producing `deployed` must contain a `human-locked` gate. The gate *mechanism* — exhaustion gates, `--auto`, answer consumption — is Q-0050's and Q-0052's, and nothing here presents a gate. |
| **File format and its schema** | The flow file is the subject. `flowSchema`, `flowStepSchema` and the step types come from `shared` (Q-0041) and are used for typing only; AC-1 forbids parsing with them, per the 2026-08-25 boundary. This ticket adds no schema and no shared declaration. |
| **Lint rules** | Twenty rules ported, none added, none removed, none tightened — AC-2 through AC-7 pin them individually and AC-9 pins the shipped corpus. Register rows 12 (AC-3), 16 (AC-7) and 18 (AC-4) are the three that were paid for and are cheap to lose. |
| **Containment** | n/a — this module runs no git and derives nothing about a branch. It validates the *text* of a range; whether the refs exist and what they resolve to is Q-0051's. |
| **Cold-clone impact** | Neutral by construction, and AC-9 is the criterion that keeps it so: the six flows `quorum init` copies must lint clean unchanged. No new command, no new prompt, no new dependency — `yaml` is already `@quorum/core`'s. |
| **Errors are explicit** | Partly, and the exceptions are deliberate. `FlowError` carries every problem in one message (AC-2) and `validateFlowDirectory` names every failing file (AC-7). Against that, four of AC-11's eight carried defects are silences: a missing directory throws a raw `ENOENT`, an empty file surfaces a `TypeError` string, a `.yml` file is skipped without a word, and `diff: null` slips the grammar. All four are named in the report rather than fixed, per charter §2. |
