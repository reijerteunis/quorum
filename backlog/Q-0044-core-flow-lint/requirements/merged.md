> **Note on this document's authority.** Every verbatim message, ordering claim and preserved
> defect below was verified by running `spike/src/lint.js`, not by reading it. Where a candidate's
> transcription disagreed with the code, the code won — see Provenance.

# Q-0044 — `core/lint`: flow lint and whole-directory validation

*Merged requirement (head-of-product), 2026-08-26. Route: **chore** (`requirements → chore → human
gate`). Parent: Q-0009. Depends on Q-0041 and Q-0064 (both landed). Charter: `harness/port-charter.md`;
§6's register row for Q-0044 is normative, and the inherited invariants are rows 12, 16 and 18.
Surfaces: `packages/core` — one new module folder and its tests. Nothing under `spike/`, nothing in
`packages/shared`, no flow file, and no CLI: `packages/cli` does not exist until Q-0010.*

## Problem

`spike/src/lint.js` is 194 lines and it is the only place this product's opinions are *enforced*
rather than written down. Sixteen of its twenty diagnostics exist because a decision was taken and
somebody had to make it checkable: bounded backward edges (2026-08-21), the refined cross-vendor
rule (2026-08-21), the derived cross-flow regression target (2026-08-23), the diff range grammar
(Q-0034, Q-0035). Whole-directory report construction still sits inside `spike/bin/harness.js:374`,
which charter §7 places in `core` — leaving domain logic at the CLI boundary that M3's server would
otherwise have to shell out for.

**The exposure is not that the port loses a rule.** A lost rule is loud: a fixture stops throwing and
a test goes red. The exposure is that the port keeps all twenty rules and changes what they *say*, or
narrows what they *see*, in ways nothing in this repository can currently detect. Three specific
ways, each verified against the code today:

**The messages are the feature, and TypeScript is what will damage them.** `lintFlow` accumulates
into an array and throws once, so a reader gets every defect in one pass, and fourteen of the sixteen
messages open with the step id — the token a reader greps for in the YAML. That works only because
the function type-checks nothing: run against it,
`lintFlow({consumes:'a',produces:'b',cross_vendor:42,steps:[{id:42,adapter:42,gate:42,max_turns:'many'}]})`
returns `true`. A strict-TypeScript rewrite has one obvious move available — type the parameter as
`Flow` and call `flowSchema.parse()` at the top — and it produces a linter that passes every fixture
the implementer writes (because those fixtures are built as `Flow` objects) while replacing a lint
message with a zod issue naming `steps[3].on_fail.max_iterations`. That is the exact failure
*"Zod describes structure and types; the flow lint keeps the semantics"* (`docs/DECISIONS.md`,
2026-08-25) exists to prevent, arriving through the type checker rather than through a design choice.

**The rule the ticket calls most likely to be lost is protected by no corpus.** `diffSites` reads
every `input.diff` a flow can hold *including the one inside a `fan_out` step's `step:` template*,
which `flattenSteps` deliberately does not visit. There are exactly three `diff:` lines in all six
shipped flows — `review.yaml:12`, `review.yaml:19`, `chore.yaml:32` — and **none is inside a fan-out
template**; `development.yaml` is the only flow with a `fan_out` step and its template carries no
diff. A port that drops the extra site, or "simplifies" `diffSites` into a `flattenSteps` call,
leaves all twelve shipped flow files linting clean. The only thing that catches it is a test written
for the purpose.

**One rule silences another on purpose, and it reads as a bug.** The cross-vendor block sets
`invalidPanel` when a panel problem is found and runs the judge-own-vendor rule **only if that flag
is false** (`lint.js:100`). Verified: a flow carrying both defects reports only the panel message and
says nothing about "written by its own vendor". A reviewer tidying this into two independent loops
changes the output — and the frozen Q-0033 suite pins the behaviour by asserting that the text is
*absent* (`spike/test/q0033-surface.js:228,:233`).

Underneath all three is the structural problem the port has everywhere and has here in its sharpest
form: **the two suites that would catch a transcription slip both run against the spike.**
`q0033-surface.js` and `q0035-empty-range.js` import from `spike/src/`, they are frozen under charter
§3, and Q-0054 — which translates them — lands last. Between this ticket and that one, the only thing
asserting that `core`'s linter says what the spike's linter says is this ticket's own test file.

## User stories

- **As the maintainer**, when a flow I edited is wrong I need lint to name every problem in one pass,
  each opening with the step id I can grep for, exactly as it does today — the alternative is running
  lint, fixing one thing, running it again, six times.
- **As the maintainer**, I need the fan-out template's `input.diff` to stay checked after the port. It
  is the one static check protecting a range no run can validate early, and a run that discovers it at
  step time has already paid a fan-out's worth of adapters.
- **As the cold-clone adopter**, I need the six flows `quorum init` copies into my repository to lint
  clean on the first try. A new rule I did not write, refusing a file I did not write, in my first
  thirty minutes, is the worst possible first impression.
- **As a flow or adapter contributor**, I need the cross-vendor rule to keep being satisfied by a
  panel spanning vendors rather than by writer ≠ reviewer — with two vendors a judge necessarily
  shares one, and the strict reading would demand a third vendor for every judge.
- **As the contributor writing `packages/cli` (Q-0010) or M3's server**, I need whole-directory
  validation to be a function in `core` returning per-file records, so the CLI's job is choosing a
  marker and a colour and nothing else.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/lint.js` — `FlowError` `:5`, `flattenSteps` `:7`, `groupBy` `:9`, `writesOf` `:18`, `globMatch` `:23`, `validDiffRange` `:36`, `diffSites` `:49`, `lintFlow` `:56–129`, `lintFlowDirectory` `:131–185`, `validateFlowDirectory` `:187–194` |
| The lift | `spike/bin/harness.js` — `lintDirectory` `:374–386`, `printReport` `:388`, the colour helper `c` `:44`; called at `:464` (the `lint` command) and `:597` (the `run` preflight) |
| In-package consumers, all later children | `spike/src/engine.js:11` imports `FlowError`, `lintFlow`, `flattenSteps`; `:13` re-exports `FlowError`, `lintFlow`, `lintFlowDirectory`, `validateFlowDirectory`; `:738` re-exports `flattenSteps`; `loadFlow` `:15–20` assigns `flow.file` then calls `lintFlow`. Q-0050/Q-0051 |
| The runtime twin of AC-4's grammar, which is **not** this ticket's | `spike/src/engine.js:797–801` — the engine's own range guard, with its own message. Q-0051 |
| Frozen suites pinning this behaviour, which Q-0054 translates | `spike/test/q0033-surface.js` — S1.3/S6.1/S7.8/S8.2 (`:114`), S6.2–S6.10 (`:194`), S7.1–S7.7 (`:210`), S8.1–S8.4 (`:222`), and `flowDiagnostic` (`:38–45`), which parses the CLI's block format. `spike/test/q0035-empty-range.js:255–295, :555–590` — the range grammar and the fan-out template site. `spike/test/smoke.js:240–266` — loop convergence and the fan-out exemption |
| Already in `shared`, not to be spelled twice | `flowSchema`, `flowStepSchema`, `Flow`, `FlowStep`, `AgentStep`, `OnFail`, `stepInputSchema` (`flow.ts`); `stepOutputDeclarationSchema` (`step-output.ts`); `ticketBranchPrefix`, `DEFAULT_BASE_BRANCH` (`constants.ts`) |
| The boundary this ticket must not cross | `packages/shared/src/flow.ts:8–38, :97–101` — rule 1, and what E-1 does *not* authorise: no zod issue may replace a lint message |
| Test helpers already shipped | `packages/core/test/corpus.ts` — `repoRoot`, `repoFile`, `coreSourceFiles` (recursive since Q-0064, keyed by path below `src`, e.g. `lint/lint.ts`); `packages/core/test/repo.ts` — `tempDir`, `write`, `walk`, `removeTempDirs` |
| The folder rule | *"`core` is organised in folders named after the port's children"* (`docs/DECISIONS.md`, 2026-08-26). This module's folder is `lint/`. Q-0064 has landed; `src/git/` and `src/backlog/` are the pattern to follow |
| Where types must not go | Charter §4: the dependency direction is `core → shared`, never the reverse |

**Nine facts established by running the code rather than reading it.** The criteria depend on all
nine, and each was re-verified for this merge.

1. **All twelve shipped flow files lint clean today** — six under `harness/flows/`, six under
   `spike/templates/harness/flows/`, through `lintFlowDirectory`, zero problems each.
2. **No shipped flow exercises the fan-out template diff site.** Three `diff:` lines in total, all
   outside a `fan_out` step. Register row 12's second half has no corpus protecting it.
3. **Only one shipped flow uses a cross-flow edge** — `review.yaml:40`, `goto: flow:development`. The
   entire return-chain walk (`lint.js:148–183`) is exercised by one edge in the shipped set.
4. **`lintFlow` type-checks nothing.** `adapter: 42`, `id: 42`, `gate: 42`, `cross_vendor: 42` and
   `max_turns: 'many'` all return `true`.
5. **The panel message has no colon after the id list**: `parallel group r1, r2 shares role "rev" and
   adapter "claude" — cross_vendor: required needs at least two adapters`.
6. **The short-circuit is real and observable.** A flow with a single-vendor panel *and* a same-vendor
   judge reports only the panel message; the thrown text does not contain "written by its own vendor".
7. **The fan-out template is invisible to the flattened-step rules and visible to `diffSites`.** A
   template carrying a duplicate id produces no duplicate-id problem; a template carrying
   `diff: bogus` produces `f.step: input.diff must be …, got "bogus"`.
8. **`diff: null` passes and `diff: ''` fails** (`diffSites` filters on `value != null`); a flow with
   neither `name` nor `file` throws `flow undefined invalid:`; an id-less step lints clean;
   `flattenSteps(null)` and `flattenSteps([null])` throw raw `TypeError`s.
9. **`harness/Q-0044/integration` does not exist.** No local or remote branch matches `*Q-0044*`.

## Acceptance criteria

Each is independently testable against throwaway directories the test builds, or against this
repository read-only. No criterion may be satisfied by asserting a fact this repository's next landing
changes — the permanent-acceptance-test decision (2026-08-23).

### AC-1 — The module exists, exports exactly this surface, adds no validator in front of the linter, and leaves the package entry point untouched

`packages/core/src/lint/lint.ts` exports `FlowError`, `flattenSteps`, `lintFlow`, `lintFlowDirectory`,
`validateFlowDirectory` and `lintDirectory` — six names, no more. TypeScript strict, no `any`, no
`@ts-ignore`, no import from `spike/**`. It declares no flow schema, no step schema and no second
spelling of a branch prefix or a base-branch default: types come from `@quorum/shared`.

**`lintFlow` accepts `unknown` and narrows internally. It does not call `flowSchema.parse`,
`safeParse` or any zod method, and its parameter is not typed `Flow`.** The linter must keep accepting
every object it accepts today, fact 4 included, and a zod issue may never replace one of its messages
— rule 1 of *"Zod describes structure and types; the flow lint keeps the semantics"* (2026-08-25) and
`packages/shared/src/flow.ts:97–101`.

*Test:* `Object.keys` over the module namespace equals the six names. A source-level test over
`coreSourceFiles()` asserts that `lint/lint.ts` contains no `flowSchema`, no `.parse(`, no
`.safeParse(` and no `from 'zod'`, and that the literals `'harness/'` and `'main'` appear in no file
under `packages/core/src/lint/`. `repoFile('packages/core/src/index.ts')` still equals
`export const name = '@quorum/core';\n`, keeping Q-0041's byte pin green. Workspace `pnpm lint`,
`pnpm typecheck` and `pnpm test` are green.

*Typing note:* narrowing `unknown` needs local type predicates or assertions at the read boundary.
Those are acceptable and each carries a one-line comment naming why (*"`lintFlow` validates the flow
format, not its types — see AC-1"*); `any` and `@ts-ignore` are not.

### AC-2 — `lintFlow` reports the same sixteen problems, with the same message text, in the same order, and reports all of a flow's problems at once

Verbatim, with `${…}` marking interpolation. **Message 12 has no colon after the id list** (fact 5).

| # | Message | Source |
| --- | --- | --- |
| 1 | `duplicate step id "${id}"` | `:60` |
| 2 | `${step.id}: on_fail without goto` | `:63` |
| 3 | `${step.id}: goto target "${step.on_fail.goto}" not found` | `:64` |
| 4 | `${step.id}: on_fail.max_iterations must be an integer greater than zero` | `:66` |
| 5 | `${step.id}: on_fail.counter must be a non-empty unprefixed key` | `:70` |
| 6 | `${step.id}: counter "${counter}" must be unprefixed; use "${corrected}"` | `:73` |
| 7 | `${step.id}: on_exhausted must be "gate"` | `:75` |
| 8 | `${step.id}: has a verdict but no on_fail/route — verdicts must go somewhere` | `:77` |
| 9 | `${step.id}: fan_out needs a step template` | `:78` |
| 10 | `${step.id}: integrate needs branches` | `:79` |
| 11 | `${label}: input.diff must be two "..."-joined endpoints, each "{base}" or "harness/{id}/…", got ${JSON.stringify(value)}` | `:83` |
| 12 | `parallel group ${ids} shares role "${role}" and adapter "${adapter}" — cross_vendor: required needs at least two adapters` | `:96` |
| 13 | `${step.id}: every input it judges (${reviewed}) was written by its own vendor (${step.adapter}) — cross_vendor: required` | `:107` |
| 14 | `${step.id}: loops back to "${target}", which never receives ${written} — the loop cannot converge` | `:121` |
| 15 | `flow needs consumes/produces` | `:124` |
| 16 | `deploy flow must contain a human-locked gate` | `:126` |

The thrown message is `` `flow ${flow.name ?? flow.file} invalid:\n  - ${problems.join('\n  - ')}` ``
and the error is a `FlowError`. `flow.name` takes precedence over `flow.file`. **The order is the
order the source pushes**: duplicate ids first, then the per-step block in step order, then diff
sites, then cross-vendor, then loop convergence, then `consumes`/`produces`, then the deploy gate.
Duplicate occurrences and multiple failing steps remain separate bullets. A valid flow returns `true`.

*Test:* one fixture per message asserting the exact string, and a multi-problem fixture asserting the
**entire** thrown message equals a literal — header, two-space-hyphen bullets, order. Message 11
carries `…` (U+2026), not three dots, and one assertion pins that character specifically. Message 12's
absent colon is asserted as its own case, because it is where transcription has already failed once.

### AC-3 — `flattenSteps` stays deliberately shallow, and the fan-out template stays invisible to every rule that reads a flattened step

`flattenSteps(steps = [])` defaults a missing argument to `[]`, and for each top-level entry
substitutes `entry.parallel` when truthy and otherwise returns the entry, preserving order. It does
not recurse and does not visit a `fan_out` step's `step:` template — the template's `id`, `role` and
`adapter` are placeholders resolved per task, so the duplicate-id, `goto`, cross-vendor and
loop-convergence rules must not see them.

*Test:* ordinary steps, a parallel group, mixed ordering, no argument. Then the negative that matters:
a `fan_out` step whose **template** carries a duplicate id, a `goto` naming nothing, and a verdict with
no route produces **no** problem from any of those three rules (fact 7) — so the port cannot satisfy
AC-4 by making `flattenSteps` recurse.

### AC-4 — The diff range grammar is unchanged, and it is read at every site a flow can hold one, including inside the fan-out template *(register row 12)*

A range is valid when `String.split('...')` yields exactly two endpoints and each is exactly `{base}`
or matches `/^harness\/\{id\}\/.+/`. A non-string is invalid. `{id}` stays uninterpolated: the rule is
a property of the text and runs no git. No whitespace trimming, no alternative separator, no arbitrary
ref, no empty suffix, no third endpoint.

`diffSites` returns `{label: step.id, value: step.input?.diff}` for every flattened step, **plus**
`` {label: `${step.id}.step`, value: step.step.input?.diff} `` for a step carrying both `fan_out` and
`step`, and filters on `value != null`.

*Test:* a table of accepted ranges (`{base}...harness/{id}/integration`,
`harness/{id}/integration...harness/{id}/implement`, both endpoint kinds in both positions) and refused
ones (one endpoint; three endpoints; `main...harness/{id}/x`; `harness/other/x...{base}`;
`harness/{id}/`; leading or trailing whitespace; the empty string; a number; a boolean), each asserting
message 11 with its `JSON.stringify`'d value. Separately: a `fan_out` step whose `step.input.diff` is
malformed fails with the label `<step id>.step` (fact 7). `diff: null` passes and `diff: ''` fails
(fact 8). *Why the test is the whole protection:* fact 2 — no shipped flow reaches this site.

### AC-5 — Both cross-vendor rules behave as they do today, including the short-circuit between them *(register row 18)*

Under `cross_vendor: required`, and only then:

*The panel rule* iterates `flow.steps` **unflattened**, skips any entry without `parallel` or with
fewer than two members, groups the members by `role`, skips a role subgroup of fewer than two, and
reports message 12 when that subgroup's members share one `adapter`. The id list is
`members.map(step => step.id).join(', ')` in member order. A panel spanning adapters satisfies the
rule; it is not required that every member differ.

*The judge rule* runs **only when the panel rule reported nothing.** It builds a producer map over the
flattened steps in order — last writer wins — from `output.write` (single) and `output.writes` (array),
then for each step carrying `output.verdict` globs its `input.backlog` patterns against the producer
keys and reports message 13 when the matches are non-empty and every one was produced by that step's
own adapter. A step that judges nothing is exempt. A judge over candidates spanning adapters passes
even when one candidate shares the judge's adapter.

*The glob* anchors both ends, escapes ``.+?^${}()|[]\``, expands `*` to `[^/]*` (so it does not cross a
`/`), and additionally matches when the pattern ends with `/` and the value starts with it.

*Test:* S8.1–S8.4 transcribed — two-member single vendor, the shipped panel, three-member single
vendor, mixed three-member. Plus the short-circuit as its own case: a flow carrying both a
single-vendor panel **and** a same-vendor judge reports only message 12, and the thrown message does
not match `/written by its own vendor/i` (fact 6). Plus glob cases: `review/*.md` matching `review/a.md`
and not `review/sub/a.md`; `review/` matching `review/sub/a.md`; a pattern containing `.` matching
literally. Plus: a flow without `cross_vendor: required` reports neither.

### AC-6 — `on_fail` bounds, counter spelling, goto resolution and the verdict-must-route rule are unchanged

`on_fail` without `goto` gives message 2. A `goto` that does not start with `flow:` and is not among
the collected step ids gives message 3; a `flow:`-prefixed target is deferred to directory validation
(AC-8). `max_iterations` must satisfy `Number.isInteger` and exceed zero — absent, `'three'`, `1.5`,
`0` and `-1` each give message 4. `counter` absent or `null` is accepted; a non-string or a
whitespace-only string gives message 5; a string starting with `iterations.` gives message 6 naming
the corrected spelling. `on_exhausted` must be exactly `'gate'`. A step with `output.verdict` and
neither `on_fail` nor `route` gives message 8.

*Test:* S7.1–S7.7 transcribed, plus the non-verdict step case (`spike/test/q0033-surface.js:219`, which
proves counter spelling is not a verdict-specific rule), plus `counter: null` accepted, plus
`goto: flow:whatever` accepted by `lintFlow` alone.

### AC-7 — The loop-convergence rule is unchanged, including both exemptions

For each flattened step with a non-`flow:` `on_fail.goto`: if the step writes nothing, skip; if the
destination is not found, skip (message 3 already reported it); if the destination is a `fan_out` step,
skip; otherwise report message 14 when no written path glob-matches any pattern in the destination's
`input.backlog`.

*Test:* `spike/test/smoke.js:240–266` transcribed — a loop that hides its verdict from the step it
returns to fails; feeding the verdict back makes it lint; a fan-out destination is exempt because the
engine feeds it the result. Plus a step that writes nothing and loops back, asserted clean; plus a
cross-flow edge, asserted to skip this rule entirely.

### AC-8 — `lintFlowDirectory` walks and records the same way, and `validateFlowDirectory` aggregates the same way

The walk reads immediate files whose names end exactly in `.yaml`, sorted lexicographically, and for
each: `YAML.parse` the text, assign `flow.file = <the joined path>`, `lintFlow` it. Success records
`{file, flow, problems: []}` and adds the flow to the corpus. **Any** thrown error records
`{file, problems: [error.message]}` with **no `flow` key** — a lint failure's whole multi-line message
as a single array element, a YAML syntax error's message unchanged, and fact 8's `TypeError` message
unchanged. A failing file is excluded from both cross-flow indexes and does not stop the remaining
files being read. Nested directories and non-`.yaml` files are ignored. Each invocation rebuilds its
own records and indexes: nothing is cached or shared between calls.

`validateFlowDirectory` calls the same walk. If any record has problems it throws one `FlowError` whose
message is the invalid records rendered as `` `${basename(file)}:\n  - ${problems.join('\n  - ')}` ``
joined by `\n`, in filename order; otherwise it returns the flow objects in filename order.

*Test:* over throwaway directories — the record shape asserted directly (`'flow' in record` false on
every failure path, true on success); `flow.file` present on every successful flow and equal to the
joined path; one directory holding a local lint error, a YAML syntax error and a valid file proves the
valid file is still read; a directory with errors in three different files proves `validateFlowDirectory`
names all three at once.

### AC-9 — Cross-flow targets and return chains are derived from stages, verbatim *(register row 16)*

For every flattened step whose `on_fail.goto` begins `flow:`, the suffix names the target **by YAML
filename stem, never by the target's internal `name:`**. Resolution and the walk push onto the
**source** flow's record:

| Condition | Message |
| --- | --- |
| target not in the filename map | `flow ${source.name}: target flow ${targetName} is missing or unloadable` |
| a `(flow name, stage)` pair repeats | `flow ${source.name}: target flow ${targetName} has a cycle at stage ${stage}; implicated flows: ${cycle}` |
| no flow consumes `stage` | `flow ${source.name}: target flow ${targetName} dies at stage ${stage}; it never returns to ${source.consumes}` |
| more than one flow consumes `stage` | `flow ${source.name}: target flow ${targetName} is ambiguous at stage ${stage}; implicated flows: ${names}` |

The walk starts at the target's `produces`, follows the single flow consuming each stage, and stops
when the stage equals the source's `consumes`; reaching it passes, and a target whose `produces`
already equals the source's `consumes` passes with zero iterations. Each of the three failure
conditions breaks the walk, so one edge yields at most one problem. Ambiguity on a stage the walk never
reaches is not reported.

*Test:* S6.2–S6.10 transcribed against throwaway directories — direct return, multi-hop clean, missing
target, unloadable target, dead end, ambiguity, unreached ambiguity clean, cycle, self-target — each
asserting the full message. Plus one case proving resolution is by filename: a target whose `name:`
differs from its filename resolves by filename and fails by `name:`.

### AC-10 — `lintDirectory` moves into `core` presentation-free, and the bytes the CLI prints are reproducible from what it returns

`lintDirectory(flowsDir)` calls `lintFlowDirectory` rather than reimplementing validation, and returns
`{ok, records}` where `ok` is true only when no record has a problem, and each record carries its full
path, its basename, and its problems **flattened to one problem per element**: each problem string
split on `\n`, each line trimmed, empty lines dropped, the first line dropped when there is more than
one line and it ends with `invalid:`, and a leading `-+` with its following whitespace stripped from
each remaining line. Records stay in filename order, one per `.yaml` file.

**No ANSI escape, no marker glyph and no indentation appears anywhere in `core`.** Charter §7 assigns
event rendering to the CLI's residual scope, M4's flow editor shows lint errors in a browser where an
escape byte is a bug, and M3's server would otherwise ship terminal control codes over a WebSocket. The
*shape* of `lintDirectory` therefore changes, which §2 explicitly does not preserve; the *printed
bytes* do not, and this criterion is what proves it.

*Test:* over a throwaway directory holding one clean flow, one flow with three lint problems, one flow
with a YAML syntax error and one flow with a cross-flow problem, assert the flattened arrays element by
element. Then, in the same test, apply a three-line renderer —
`` ok ? `\x1b[32m✓\x1b[0m ${filename}` : `\x1b[31m✗\x1b[0m ${filename}\n${problems.map(p => `  - ${p}`).join('\n')}` ``
— and assert the result equals the byte-for-byte literal `spike/bin/harness.js:376–384` produces for the
same records, escape sequences included, and that it matches the block format
`spike/test/q0033-surface.js:38–45` parses. The renderer belongs to Q-0010; asserting that one exists
which reproduces the bytes is what makes this criterion checkable now.

### AC-11 — Every shipped flow still lints clean, through the ported code, in both directories

`validateFlowDirectory` over `harness/flows/` returns six flows and throws nothing, and the same over
`spike/templates/harness/flows/` returns six flows and throws nothing. No rule is added, tightened or
newly applied: a flow file this repository ships must not be refused by anything this ticket writes,
and no flow file is edited to make this pass.

*Test:* both directories through the **ported** `validateFlowDirectory`, asserting six records each with
zero problems, and **failing loudly if either directory yields fewer than six `.yaml` files** — so
deleting a flow cannot satisfy the criterion. A second assertion compares the two directories' outputs
for the same filenames, so a divergence between the shipped set and the template set surfaces here as
well as in the frozen suite.

### AC-12 — `FlowError` is the same class, the preserved defects are pinned by test, and anything else found stops the port

`FlowError` extends `Error` and overrides nothing — not `name`, not `message`. It is exported from the
lint module, because `spike/bin/harness.js:605` routes on `e instanceof FlowError` to print one sentence
instead of a stack and Q-0010 must reproduce that. `lintFlow` and `validateFlowDirectory` throw it;
`lintFlowDirectory` throws nothing of its own and catches everything per file.

**Nine preserved defects, each carried unfixed under charter §2 and reported rather than repaired:**

1. `lintFlowDirectory` on a missing directory throws a raw `ENOENT` `Error`, not a `FlowError`.
2. An empty `.yaml` file surfaces the `TypeError` from `flow.file = file` on `YAML.parse`'s `null` as a
   user-facing problem string.
3. `.yml` files are skipped without being reported as unread.
4. `flattenSteps(null)` and `flattenSteps([null])` throw raw `TypeError`s.
5. `lintFlow` requires an `id` on no step kind, so an id-less step lints clean and the engine later
   builds `harness/<ticket>/undefined` — **Q-0055 owns the fix and lands after this ticket.**
6. `diff: null` is exempt from the range grammar while `diff: ''` is refused.
7. A flow with neither `name` nor `file` throws `flow undefined invalid:`.
8. Cross-flow messages name the **source** by its `name:` field and the **target** by its filename stem,
   so the two halves of one sentence come from two different identifiers.
9. A non-`Error` throw inside the per-file `try` would store `undefined` as the problem. No reachable
   path produces one; the port narrows with an assertion carrying a one-line justification and **does
   not stringify**, because stringifying is a diagnostic behaviour change.

*Test:* `new FlowError('x') instanceof Error` is true, `.name` is `'Error'` (not `'FlowError'`), `.message`
is `'x'`; a failing `lintFlow` and a failing `validateFlowDirectory` each throw an instance; a
source-level assertion that the class declares no `name` assignment. Defects 1–8 asserted directly —
2's message text obtained by *running* the spike, not transcribed — so a later "cleanup" that fixes one
without a decision turns this suite red rather than passing silently.

*Why `.name` is pinned:* `spike/test/q0034-review-fixes.js:109–112` records that the routing depends on
`instanceof` rather than on `name`, and a TypeScript rewrite that helpfully sets `this.name = 'FlowError'`
changes what a stranger sees at the top of an error.

**Stop-and-report:** if transcription or the ported tests reveal a spike defect, an inconsistency, or a
behaviour this document does not cover, the implementer records the exact fixture, the actual output and
the expected authority in `dev/implement-report.md` and **stops** — it does not fix the behaviour,
normalise the error, broaden the grammar or edit a shipped flow in passing. The route for a deliberate
change is its own `docs/DECISIONS.md` entry or a dated erratum in this ticket's folder, accepted before
it is implemented. The report also names all nine defects above and states for each that it is preserved.

## Non-goals

- **Another child's module.** Engine, diff preflight and materialisation, fan-out, integrate, run
  history, contracts and adapters are Q-0045 through Q-0053. In particular the engine's own range guard
  and its message (`spike/src/engine.js:797–801`) are **Q-0051's**, not a second copy to write here; and
  `loadFlow`, which calls `lintFlow`, is Q-0050's.
- **Requiring a step id** (Q-0055), **deciding what `route` is** (Q-0056), **the chore flow's step order
  as a statically checkable property** (Q-0038), or any other new lint rule. The ticket body names the
  last of these explicitly; adding any of them would also break AC-11.
- **Fixing anything found while reading** — charter §2. That covers all nine items in AC-12 and anything
  else.
- **Editing `spike/**`** — charter §3. The frozen suites stay where they are and keep running against the
  spike; Q-0054 translates them. The spike is not a workspace member and it is the port's only
  independent witness.
- **Changing any flow file**, in `harness/flows/` or `spike/templates/harness/flows/`, or adding a seventh
  flow. Q-0012 ships `qa-final.yaml` and `deploy.yaml`.
- **Adding a rule, a message or a declaration to `packages/shared`.** The zod schemas landed with Q-0041
  and this ticket imports them for typing only. No zod issue may replace a lint message.
- **Recursing into nested flow directories, or accepting an extension other than `.yaml`.**
- **The `quorum` binary, argument handling, colour, markers, indentation, `printReport`, logging and
  process exit** — Q-0010 and the cutover.
- **Re-exporting from `packages/core/src/index.ts`.** `packages/shared/src/index.test.ts:52–53` pins that
  file byte for byte, and every consumer this ticket has is in-package.
- **A persisted event stream, a lock on a ticket, `--base`, budget enforcement, gate semantics** — Q-0039,
  Q-0040, Q-0050 and the carried M1 items. Also the Q-0009 cutover, the daemon and Studio behaviour.
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace, visual node
  canvas, eval suites, Gemini adapter, desktop shell.

## Open questions

None blocks solutioning. Both questions the codex candidate marked blocking are answered by the repository
itself, and are recorded here as decided with their evidence so no round is spent on them.

| # | Question | Resolution | Owner |
| --- | --- | --- | --- |
| OQ-1 | Does core's `lintDirectory` keep the ANSI bytes the spike emits (`c.green('✓')`, `c.red('✗')`), or return structured records for a renderer to colour? | **Structured records — AC-10.** Charter §7 puts *event rendering* in the CLI's residual scope in as many words, M4's flow editor renders lint errors in a browser, and M3's server would ship escape bytes over a WebSocket. The shape change is authorised by §2 ("module boundaries are explicitly not preserved"); the printed bytes are not changing, and AC-10 proves a three-line renderer reproduces them byte for byte. Nothing printed changes today in any case: `spike/bin/harness.js` is frozen and keeps its own copy until Q-0010. | decided |
| OQ-2 | Should the lint surface be re-exported from `packages/core/src/index.ts`, and if so does the landed Q-0041 pin change? | **No, and no.** `packages/shared/src/index.test.ts:52–53` pins `packages/core/src/index.ts` to `export const name = '@quorum/core';\n`. Every consumer this ticket has is in-package and imports from `./lint/lint.js`, exactly as `src/git/` and `src/backlog/` are consumed today. The entry point is the cutover's business. | decided |
| OQ-3 | `harness/port-charter.md` §6's register names four exports and omits `lintFlowDirectory`, while the ticket body names five. Is it exported? | **Yes.** The register lists what is ported, not what is hidden; `lintDirectory` and `validateFlowDirectory` both call it, `spike/src/engine.js:13` re-exports it today, and hiding it would be a surface reduction no decision authorises. AC-1's six names include it. | decided |
| OQ-4 | Does `FlowError` stay in the lint module, move to `shared`, or get its own `core/src/errors.ts`? | **Stays in the lint module**, as the spike has it. The spike's pattern is that an error class lives beside its first thrower (`IntegrationError` is in `fanout.js`, Q-0048's), Q-0050 imports it from `../lint/lint.js` as `engine.js:11` does today, and `shared` is declarations only. Moving it is a boundary change with thirty-plus downstream throw sites and no ticket asking for it. | implementer |
| OQ-5 | One file (`lint/lint.ts`, ~200 lines) or split — `lint.ts` for `lintFlow`, `flow-directory.ts` for the walk? | **One file.** The register names one module, 194 lines is not a legibility problem, and `validDiffRange`, `diffSites`, `globMatch` and `writesOf` are shared by both halves. The folder exists because the 2026-08-26 decision gives every core module one, not because this module has two. | implementer |
| OQ-6 | Should `lintFlowDirectory`'s per-file `try`/`catch` stay broad, given it currently swallows a `TypeError` and renders it as a lint finding? | **Yes, unchanged.** Narrowing it is a behaviour change: it would turn an empty `.yaml` file from a reported problem into an uncaught throw out of `quorum lint`. Defect 2 in AC-12, carried. | decided |

## Risks

- **The TypeScript trap is the whole ticket.** Typing `lintFlow(flow: Flow)` or calling `flowSchema.parse`
  at the top compiles, passes fixtures the implementer builds as `Flow` objects, and replaces sixteen good
  messages with zod paths. AC-1 makes it a source-level assertion so it fails in seconds rather than at
  review.
- **Register row 12 has no corpus.** Fact 2 — no shipped flow puts an `input.diff` in a fan-out template,
  so AC-4's test is the only thing between the port and a silently narrowed static check, on the site that
  is most expensive to fail at run time. **A reviewer should read that test before reading the
  implementation.**
- **Nothing outside this ticket's own suite catches a message slip until Q-0054**, because both frozen
  suites import from `spike/src/`. That is by design (§3 keeps the witness unedited), and it makes AC-2's
  verbatim assertions load-bearing rather than belt-and-braces. It has already caught one: see Provenance.
- **The short-circuit reads as a bug.** `if (!invalidPanel)` looks like something to tidy away, and the
  frozen suite pins it by asserting text is *absent*. AC-5 makes it explicit.
- **`harness/Q-0044/integration` does not exist** (fact 9). The chore flow's `review` step diffs against
  that branch and only `integrate` creates it, so the first run fails after the implementer has been billed
  — the $13.86 failure of 2026-08-25. **Create it from `main` before the run**, per charter §8 and
  `02-sdlc-pipeline-spec.md` §5.8.
- **A gate that cannot be answered destroys a proven-green merge** (Q-0040, open). Run this where a human
  can answer the final gate; if the run dies there, re-perform `integrate` by hand before trusting the
  branch.
- **`integrate` can report a cached pass** (Q-0065). `pnpm turbo run test` without `--force` replays a green
  it did not execute. Verify the merge with `--force` before trusting `tests=ok`.
- **Scope drift into three open tickets.** Q-0055, Q-0056 and Q-0038 all live in this file and all are
  somebody else's. Any new rule, or any change that makes a shipped flow fail, is unrequested scope and
  AC-11 turns it red.
- **Scope drift into the engine.** `lintFlow`'s three importers are all in `engine.js`, and reading them to
  check a signature is one step from porting them. The reviewer should treat any change outside
  `packages/core/src/lint/` and its tests as unrequested.
- **Q-0064 landed the folder layout this ticket targets.** `coreSourceFiles()` is now recursive and keyed
  by path below `src`; a source-level test that looks entries up by bare filename will not find
  `lint/lint.ts`.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable, no network. The `adapter` field this module reasons about is a name in a YAML file and nothing more. No code path, test or example accepts a key. |
| **Worktree safety** | n/a directly — this module reads files and returns values; it creates no branch, worktree or ref and writes nothing. Indirectly it guards register row 19: AC-4's grammar keeps a flow's `input.diff` pointed at the configured base or the ticket's own branches, statically, before any run. |
| **Gate behaviour** | Message 16 is enforced here: a flow producing `deployed` must contain a `human-locked` gate. The gate *mechanism* — exhaustion gates, `--auto`, answer consumption — is Q-0050's and Q-0052's; nothing here presents a gate. |
| **File format and its schema** | The flow file is the subject. `flowSchema`, `flowStepSchema` and the step types come from `shared` (Q-0041) and are used for typing only; AC-1 forbids parsing with them, per the 2026-08-25 boundary. No schema and no shared declaration is added. |
| **Lint rules** | Twenty diagnostics ported — sixteen per-flow, four cross-flow — none added, removed or tightened. AC-2 through AC-9 pin them individually; AC-11 pins the shipped corpus. Register rows 12 (AC-4), 16 (AC-9) and 18 (AC-5) are the three that were paid for and are cheap to lose. |
| **Containment** | n/a — this module runs no git and derives nothing about a branch. It validates the *text* of a range; whether the refs exist and what they resolve to is Q-0051's. |
| **Cold-clone impact** | Neutral by construction, and AC-11 keeps it so: the six flows `quorum init` copies must lint clean unchanged. No new command, prompt or dependency — `yaml` is already `@quorum/core`'s. |
| **Errors are explicit** | Partly, and the exceptions are deliberate. `FlowError` carries every problem in one message (AC-2) and `validateFlowDirectory` names every failing file (AC-8). Against that, four of AC-12's nine carried defects are silences: a missing directory throws a raw `ENOENT`, an empty file surfaces a `TypeError` string, a `.yml` file is skipped without a word, and `diff: null` slips the grammar. All four are named in the report rather than fixed, per charter §2. |
| **Product-agnostic** | No SaaS product is named or implied anywhere in the module, its tests or its fixtures. |

## Provenance

**Base: the claude candidate.** Its framing is the reason this document has the shape it does — it
identifies the three ways this port fails invisibly (a zod parse at the top of `lintFlow`, a
`flattenSteps`-based `diffSites`, and the `invalidPanel` short-circuit tidied away), and it establishes
them as facts *run* against the code rather than read off it. Taken largely intact: the problem statement,
the context table, the verbatim message table, AC-1's source-level assertions, AC-4's fan-out negative
test, AC-5's short-circuit case, AC-10's renderer proof, AC-12's `.name` pin, and the risk list.

**From the codex candidate**, where it was sharper: splitting the directory half into a walk-and-record
criterion and a resolution-and-return-chain criterion (its AC-11–AC-14, here AC-8 and AC-9), which is more
testable than one combined criterion; the explicit rule that a failed record is excluded from the
cross-flow indexes and that one bad file does not stop the walk; resolution **by filename stem, never by
`name:`**, stated as its own testable property; the minimum-file-count guard on AC-11 so deleting a flow
cannot satisfy it; the no-caching requirement in AC-8; the non-`Error` throw edge case (its OQ-3, here
defect 9); and its AC-18, which became AC-12's stop-and-report clause — the single most important
procedural criterion in the document.

**Where they disagreed, and how it was settled.**

- *Colour bytes in `core`.* Claude said structured records; codex said preserve the ANSI literally and
  marked it blocking. **Claude wins on the charter's own words** — §7 assigns "event rendering" to the CLI's
  residual scope, and §2 excludes module boundaries from preservation. Codex's underlying concern is right
  and is honoured: AC-10 now requires the rendered result to equal the spike's bytes *including the escape
  sequences*, which the claude candidate only asserted as a format.
- *The package entry point.* Codex marked it blocking; the repository already answers it. Verified:
  `packages/shared/src/index.test.ts:52–53` pins `packages/core/src/index.ts` byte for byte. Recorded as
  OQ-2, decided.
- *Criteria count.* Claude had eleven, codex nineteen. Nineteen exceeds the sizing decision of 2026-08-22
  and several of codex's were restatements or process notes rather than independently testable claims — its
  AC-17 (temp dirs, workspace green) folded into AC-1, its AC-19 (cross-cutting recorded in the report)
  became the checklist section plus AC-12's report clause. Twelve.

**One correction to the claude candidate, worth naming because it is this ticket's own subject matter.**
Its AC-2 transcribed message 12 as `parallel group ${ids}: shares role …`. The source has **no colon**
after the id list (`lint.js:96`), which running the linter confirms:
`parallel group r1, r2 shares role "rev" and adapter "claude" — cross_vendor: required needs at least two
adapters`. A requirement written to protect sixteen verbatim messages introduced a defect in one of them
while transcribing it by eye. Fixed here, and AC-2 now asks for the absent colon as its own assertion —
the messages must be re-derived by running the spike, never copied from this document.

**Both candidates agreed**, and it is recorded as settled: `flattenSteps` stays shallow while `diffSites`
reads the template; the panel rule iterates `flow.steps` unflattened; no new rule may make a shipped flow
fail; `spike/**` is not edited; and every defect found while reading is reported rather than repaired.
