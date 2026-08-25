# Q-0041 — implementation report

*Third implement round. This report replaces iteration 2's, so it carries forward everything from it
that is still true rather than only describing the delta. The delta is the first two sections.*

---

## The major from `review/chore-iter-2.md`

> **major: packages/shared/src/flow.ts:43** — The schema explicitly admits exceptions to AC-3's
> binding requirement that every flow accepted by `lintFlow` must parse successfully. The documented
> counterexamples — wrongly typed fields, missing `name`, and missing `steps` — are accepted by the
> current linter but rejected here. Documenting a narrower boundary does not override the merged
> requirement… Widen the schema so the implication holds, or stop and obtain a requirements
> amendment before landing; add tests that actually invoke `lintFlow` against these boundary cases
> rather than asserting the exception.

**The finding is correct, and I checked it by running `lintFlow` rather than by reading it.** All
three counterexamples behave exactly as the reviewer says. Iteration 2 had written a test named
*"the property's boundary: zod owns structure, so three shapes lint accepts do not parse"*, which is
the reviewer's objection in the test suite's own words: a criterion the requirement calls binding
was being documented away instead of met.

The reviewer offered two remedies. **I have applied both, split along a line the requirement itself
draws** — because the three counterexamples are not one kind of thing, and treating them as one is
what produced a bad answer twice.

### Widened: every divergence that is a rule about which keys are present

`name` and `steps` are now optional. This is not only a concession to AC-3 — it is required by AC-4
rule 1 independently, which says in as many words that zod *"may never add a rule lint does not
have."* **A required key is a rule.** Lint requires neither:

- `lint.js:127` throws with `` flow ${flow.name ?? flow.file} invalid `` — a nameless flow lints
  clean and prints as its filename.
- `flattenSteps(steps = [])` at `lint.js:7` defaults the key away, so a flow with no `steps` returns
  `true`.

`consumes` and `produces` stay required, and that is not an added rule either: `lint.js:124` pushes
`flow needs consumes/produces`, so `{}` is refused by both.

One shape that looks like part of the residue and is not: **`steps` present but not an array.**
`steps: null` and `steps: [null]` both throw a `TypeError` out of `flattenSteps`, so `lintFlow` does
not succeed on them and refusing them here narrows nothing. There is a test making that argument
explicit, so the next reader does not mistake it for a fourth exception.

### Stopped and reported: every divergence that is a rule about a value's type

This is the half I have **not** resolved, because I do not think the requirement authorises either
answer. See the next section.

### The test the reviewer asked for, and the one I actually shipped

The offending test is gone. In its place:

- **`no key is required here that lint does not require`** — the nameless flow, the stepless flow and
  the flow with neither all parse *and* round-trip unchanged; `{}` is refused. Passing assertions
  about what the schema accepts, not assertions about what it declines.
- **`` `steps` present but not an array is rejected — which is where lint stops accepting too ``.**

I did **not** ship a test that imports `spike/src/lint.js` at runtime, though the reviewer suggested
it and though I used exactly that to produce the transcript below. Three reasons, and the third is
the one that decides it:

1. The requirement's own Risks section states the opposite is available: *"`spike/` is outside the
   pnpm workspace… so the spike cannot exercise a zod schema and the schema cannot exercise the
   spike."*
2. `packages/shared/test/corpus.ts` already reads `spike/` — but as **text**, for the constants and
   `STAGES` byte-comparisons. Executing it is a different coupling: a runtime import escaping the
   package root into a tree whose `yaml` resolution is incidental.
3. **The cutover deletes `spike/`.** A test that imports it makes the bottom-of-the-graph package's
   suite fail on the day Q-0009 cuts over. That is a consequence outside this ticket, landing on
   someone else's, and choosing it unilaterally is the thing a chore implementer is told not to do.

**A finding worth having anyway: the Risks section's claim is false.** The import works — that is
how the transcript below was produced. If the gate wants the property under continuous test rather
than under review, the mechanism exists and costs one file; it needs an answer for the cutover, and
that answer is Q-0009's or Q-0054's, not mine.

---

## Stop-and-report: AC-3 and AC-4 rule 1 cannot both hold as written

**This is the one thing in this round I am asking the gate to decide.**

AC-3: *"For any flow object, `lintFlow` succeeding implies the flow schema parsing succeeding."*
AC-4 rule 1: *"Zod describes structure and **types**."*

`lintFlow` type-checks almost nothing. Where a value reaches it at all it reaches `String()` or
`.includes()`, which accept anything. So the set of objects lint accepts includes objects with
wrongly typed values, and any schema that checks types rejects some of them. **The two criteria are
in direct conflict, and no drafting of the schema satisfies both.**

Holding AC-3 literally means `z.unknown()` on every field. That is a schema which describes nothing,
and it returns thirteen consumers to re-deriving what a flow file is from `YAML.parse`'s return —
the state the ticket's own Problem statement exists to end, and the reason its user story asks for
*"a type instead of each re-deriving one."* I did not do that, and I did not quietly keep the types
while calling AC-3 satisfied either.

### The transcript

Produced by importing the real `lintFlow` from `spike/src/lint.js` and `flowSchema` from this
package, in one process, over the same objects. `VIOLATION` marks lint accepting where the schema
refuses — the property's failures, and nothing else.

| Case | `lintFlow` | `flowSchema` | |
| --- | --- | --- | --- |
| no `name` | accepts | parses | |
| no `steps` | accepts | parses | |
| neither `name` nor `steps` | accepts | parses | |
| unknown top-level key | accepts | parses | |
| `consumes` outside `STAGES` | accepts | parses | |
| `gate: null` (falsy) | accepts | parses | |
| `{}` | rejects (`FlowError`) | rejects | |
| `steps: null` | rejects (`TypeError`) | rejects | |
| `steps: [null]` | rejects (`TypeError`) | rejects | |
| `adapter: 42` | accepts | rejects | **VIOLATION** |
| `id: 42` | accepts | rejects | **VIOLATION** |
| `gate: 42` | accepts | rejects | **VIOLATION** |
| `max_turns: "many"` | accepts | rejects | **VIOLATION** |
| `cross_vendor: 42` | accepts | rejects | **VIOLATION** |
| `instructions: {}` | accepts | rejects | **VIOLATION** |
| step is a bare string | accepts | rejects | **VIOLATION** |

Before this round the first three rows were violations too. They are not any more. **Every remaining
violation is a value type, and every one of them is rule 1 doing its job.**

### The two amendments available

Either resolves it; I am not choosing between them.

1. **Scope AC-3's property to key presence.** *"`lintFlow` succeeding implies the schema parses,
   except where a value's type is wrong — the schema is the only thing that checks types, and lint
   never has."* This is what the code and the DECISIONS entry now describe, and it costs little,
   because the objects it stops accepting are ones that crash the engine a moment later.
2. **Drop "types" from AC-4 rule 1** and accept a schema that names keys without constraining them.
   Cheap to write and, I think, not worth having — but it is a coherent position and it is the gate's
   to take.

Until one is recorded, `packages/shared` ships holding the property for presence and not for types,
and says so in three places: `flow.ts`'s header, the DECISIONS entry, and here.

**On process, since this is the third round on one criterion.** Rounds 1 and 2 each spent themselves
on a claim about what `lintFlow` accepts that could have been settled in a minute by calling it. I
did that first this time. The lesson is small and cheap: when a review round and an implement round
disagree about the behaviour of a function that is sitting in the repository, running it is the
shortest path.

---

## The two majors from `review/chore-iter-1.md` — confirmed still closed

Both were fixed in iteration 2 and neither regressed. Restated because this report replaces the one
that recorded them.

**1. `flow.ts:207` — the ordered `z.union` did not commit to the engine's step kind.** Closed.
`flowStepSchema` is a `z.unknown().transform()` that calls `stepKind(value)` — a transcription of
`runStep`'s dispatch at `engine.js:176–198`, by *truthiness* of `parallel`, `gate` and `fan_out`,
with `type` separating only script from integrate — then validates against that one schema and
re-raises its issues unchanged. There is no fallback branch. Tests: *"the selected kind is validated,
and never falls through to the agent step"* (six malformed steps, one per kind) and *"a failure names
the field of the kind the engine selected"*, which asserts the issue path is exactly `steps.0.gate`.

**2. `flow.ts:221` — `consumes`/`produces` used the ten-member `stageSchema`.** Closed; both are
`z.string()`. `lint.js:124` checks only that they are truthy, so a flow naming a stage outside the
list runs today and the schema may not be the thing that stops it. This round's transcript re-proves
it: *`consumes` outside `STAGES`* → lint accepts, schema parses. `stageSchema` remains correct for a
ticket's own `stage`, in `ticket.ts`.

---

## Read this before the diff: two things I could not decide alone

Flagged in iterations 1 and 2; neither was raised in review, so both still stand.

**1. I wrote two `docs/DECISIONS.md` entries, and my role file says not to.** `developer-generalist`
says *"You do not append to docs/DECISIONS.md; a decision is the human's to record."* AC-4 requires
*"a dated DECISIONS entry with **Decision** / **Alternatives considered** / **Why**"* and tests that
it exists in that shape; AC-8 requires its disposition table to go into that entry or a second one
beside it. I took the merged requirement — approved at a human gate, specific, and later than the
role file — as governing. They are the last two sections of the file and nothing else in it is
touched. **If you would rather author them yourself, delete both sections and the `docs.test.ts`
block asserting them; nothing else depends on them.** This round amended the first entry rather than
appending a third; since that entry has never left this branch, no merged text was rewritten.

**2. `@types/node` is a dependency the requirement does not name, and I added it.** At the workspace
**root**, as a `devDependency`, beside `typescript` and `vitest`. AC-3, AC-5 and AC-6 all require
corpus tests that read files; the workspace had never had a test importing a platform builtin, so
`pnpm typecheck` fails on every one of them without it. The alternatives were dropping test files
from `tsconfig` (a larger change to Q-0008's scaffold) or suppressing each import (banned by
`harness/rules.md`). It is type-only and ships nothing; `packages/shared`'s own list stays `zod`
alone plus `yaml` in `devDependencies`, exactly as AC-1 specifies.

---

## The one-line dependency justification AC-1 asks the report to carry

> `zod` is the only schema library whose runtime validation and inferred TypeScript types come from
> one declaration, which is the entire reason for putting these shapes in a package rather than
> writing interfaces.

`yaml` (devDependency) is used by `packages/shared/test/corpus.ts` and by nothing that ships;
`index.test.ts` → *"zod is the only runtime dependency"* asserts it.

Version `zod@^4.4.3`, pinned by the lockfile (OQ-6), using constructs common to v3 and v4 so a later
bump is not a rewrite at the bottom of the graph. Two honest qualifications: `.passthrough()` and
`.strict()` are deprecated aliases in v4 (`z.looseObject` / `z.strictObject` are the v4 spellings),
and the `{ ...issue }` spread in the selector exists because of v4's raw-issue typing. Both are
one-line changes per site; neither changes behaviour. Dependencies and the lockfile are **untouched
this round**.

---

## File by file

### Changed this round — three files

| File | Change |
| --- | --- |
| `packages/shared/src/flow.ts` | `name` → `z.string().optional()`, `steps` → `z.array(flowStepSchema).optional()`, each with a doc-comment citing the lint line that forced it. The header's *"three shapes lint accepts and this schema does not"* paragraph is replaced by a **PRESENCE / TYPES** statement: the property holds for the first, cannot hold for the second alongside rule 1, and the conflict is reported rather than absorbed. |
| `packages/shared/src/flow.test.ts` | The exception test is deleted. Two tests replace it: *"no key is required here that lint does not require"* (three shapes parse and round-trip; `{}` refused) and *"`steps` present but not an array is rejected"*. AC-3's block goes 15 → 16 tests; the file 19 → 20. |
| `docs/DECISIONS.md` | Rule 1 of *"Zod describes structure and types"* gains the presence clause — a required key is a rule, so the schema requires a key only where lint does. A closing paragraph states the limit of the implication and the standing rule: **the schema may add no rule about which keys are present, and it is the only thing that checks what their values are.** |

One incidental: the phrase `` never `.default([])` `` in a new doc-comment tripped AC-4's guard,
which greps `packages/shared/src` for the literal `.default(`. I reworded the prose rather than
teach the guard to skip comments — the guard is blunt on purpose and passed review twice.

### The branch as a whole — unchanged since iteration 2

| File | What it holds |
| --- | --- |
| `src/stages.ts` | `STAGES` (ten names in order, from `backlog.js:6–9`), `Stage`, `stageSchema`, all derived from the one tuple. |
| `src/constants.ts` | The cross-package values, each with the spike line it replaces: the two `.harness/` namespaces, the `/`→`__` worktree encoding, the run-history root and filenames, run-id and occurrence-directory shapes, ticket branch shapes, `main`, `runs.log`, the finding vocabulary, the five usage measures. |
| `src/flow.ts` | The flow file: top-level keys including the loader-injected `file`, the six step kinds, and the selector that picks between them by the engine's dispatch. |
| `src/ticket.ts` | `ticket.md` frontmatter (ten fields) and the history entry (eight, three optional because shorter entries exist on disk). |
| `src/role.ts` | Role frontmatter: `adapter`, `model`, `paths` — every one optional. |
| `src/step-output.ts` | The two step-output shapes under different names, and the doc-comment naming all four validators and where each lives. |
| `src/events.ts` | `adapterEventSchema` and `eventSchema`, the evidence table, and register row 22's operative reading. |
| `src/index.ts` | Seven `export *` lines and nothing else. |
| `test/corpus.ts` | Test support, deliberately **outside `src/`** so the one module that touches the filesystem sits beside AC-2's boundary rather than inside it. Every reader throws when its subject is missing or empty. |
| `packages/core/src/shared-resolution.test.ts` | AC-1's resolution proof, as a **new** file — AC-1 wants a typecheck resolving a `shared` type from `core` while the non-goals forbid changing a `core` source file, so: add a file, do not change one. `packages/core/src/index.ts` is byte-for-byte untouched, with a test saying so. |

Modified elsewhere on the branch: root `package.json` (`@types/node`), `pnpm-lock.yaml`,
`packages/shared/package.json` (`exports`, `zod`, `yaml`), `packages/core/package.json` (one
workspace line), `docs/04-architecture.md`, `docs/03-adapter-contract.md`,
`docs/02-sdlc-pipeline-spec.md`, `docs/GLOSSARY.md` (**Event**), `docs/DECISIONS.md`.

**Nothing under `spike/` or `backlog/` is touched, on this round or on the branch.**
`git diff --stat main...HEAD -- spike backlog` is empty and `git status -- spike` is clean, which is
what the freeze's `branch-scope` job checks.

---

## Stop-and-report: what I found while reading and did not fix

Per charter §2. Finding 6 is materially revised this round.

**1. A corpus fact contradicts the requirement's stated mechanism (AC-6).** The requirement says
`harness/roles/code-reviewer.md` reaches an empty object *"so `YAML.parse('')` yields nothing and
`backlog.js:14`'s `?? {}` hands the engine an empty object."* It does not take that route: with two
consecutive `---` lines and no third, the regex at `backlog.js:12` finds **no match at all** and
`:13` returns `{ meta: {}, body: text }` before any YAML is parsed. The outcome the schema must
accept is identical, which is why AC-6 is satisfied unchanged — but the whole file including its
delimiters becomes `body`. Tests pin both facts. Q-0043 owns `parseFrontmatter`.

**2. AC-10 undercounts the hard-coded `main`.** The criterion names four sites
(`engine.js:45, 916, 991, 1004`). There are **five** — `engine.js:788`, in `materialiseDiff`, is the
same `base_branch ?? 'main'` fallback and is unlisted — and a **sixth** in the CLI
(`bin/harness.js:431`), which Q-0043 lifts. The constant's value is unaffected; the test asserts the
real counts so the next reader is not misled.

**3. The nine defects the requirement's own non-goals enumerate, all still present.** Confirmed while
reading, none changed: `nextId()` assumes a `T-` prefix and does not recognise the `Q-` ids in use
(`backlog.js:51`); `route` is linted and never implemented; `fan_out.from` and `fan_out.by` are never
read, since `loadTasks` hard-codes `solution/tasks.yaml`; `output.append` is documented and
unimplemented; `verdict_file` and `max_turns` are implemented and undocumented; `priority`, `repos`
and `created` are written and never read; `history[].stage` duplicates `stage_after`. Only the tenth
— the two documents disagreeing about the event union — is corrected, and only because AC-8 and
AC-11 require the documents to agree with what shipped.

**4. `output.append` becomes a build-time failure for Q-0012** rather than a silent no-op, because
the `output:` block is the one object that rejects unknown keys instead of preserving them.

**5. The charter's own row reference is still inconsistent** — the ticket body cites *"register rows
22 (charter §2)"* in one place and *"§6's register is normative"* in another. Both point at row 22,
so nothing material turns on it. Not mine to edit.

**6. `lintFlow` accepts a flow with no `steps` and no `name`, and the engine then throws a raw
TypeError.** *(Revised: iteration 2 recorded this finding and had the schema compensate for it. It no
longer does, and the finding is the whole of what remains.)* `flattenSteps(steps = [])` defaults
`steps` away inside lint and `lint.js:127` falls back to `flow.file` when printing, so
`lintFlow({name: 'x', consumes: 'green', produces: 'reviewed'})` returns `true` — and then
`engine.js:83` (`const steps = flow.steps`) and `:115` (`for (const group of flow.steps)`) read the
key directly. This is the ticket's own Problem statement — *"a malformed flow does not fail lint … it
throws a raw TypeError"* — surviving in a second place nobody had named.

**Iteration 2 closed it in the schema, and that was the wrong instrument.** A required key in zod is
a rule lint does not have, so the compensation broke AC-4 rule 1 and AC-3 together in order to catch
a defect in a module this ticket does not own. **Q-0044 should add the lint rule**, and its message
should name `steps` the way the other fourteen name a step id. Until it does, `quorum lint` keeps
accepting these flows, which is exactly the behaviour the port is required to preserve.

---

## Deliberately left alone

- **`spike/**`** — charter §3. Read extensively, and executed once in a scratch test to produce the
  transcript above; that file was deleted and nothing under `spike/` was written.
- **`backlog/**`** — `commitAll` reverts it and no criterion asks for it.
- **Every other child's module.** No `git`, `backlog`, `lint`, `contracts`, `adapters`, `fanout`,
  `run-history` or `engine` code. `test/corpus.ts`'s frontmatter transcription is test support, not a
  port, and is not exported from the package.
- **`lintFlow` itself** — finding 6. The lint gap is real, it is Q-0044's module, and a new lint rule
  is behaviour the port does not authorise.
- **The `harness.yaml` project-config schema** — Q-0043, with `loadProject`.
- **The run-status and manifest error-category vocabularies** — not cross-package yet; `status` in a
  history entry is an open string with a comment saying so. Q-0049/Q-0050 decide.
- **`checkAgainstSchema`, `contracts.js`/ajv, `extractJson`** — register row 13. `shared` imports no
  ajv, emits no JSON Schema and validates no vendor output; three tests check it.
- **The frozen run manifest** — cited as evidence for AC-9, never opened.
- **The event stream's channel, ordering, terminal semantics and gate-answer path** — Q-0050. This
  ticket defines payload shapes and a step-id envelope, and emits nothing.
- **`packages/core/src/index.ts`** — byte-for-byte unchanged, with a test that says so.
- **A `build` task, `outDir`, `composite` or project references** — not needed for AC-1, and a
  decision for whoever first publishes.

---

## Verification

| Command | Result |
| --- | --- |
| `pnpm lint` | 7 tasks, all pass |
| `pnpm typecheck` | 7 tasks, all pass — including `core` resolving `@quorum/shared` |
| `pnpm test --force` | 7 tasks, all pass on a forced fresh run — **76 tests in `shared`** across 9 files (75 before this round), 2 in `core`, 1 each elsewhere |
| `git diff --stat main...HEAD -- spike backlog` | empty |
| `git status --short` | `docs/DECISIONS.md`, `packages/shared/src/flow.ts`, `packages/shared/src/flow.test.ts` — and nothing else |

**One command I could not run: `npm test --prefix spike`.** It fails here with
`ERR_MODULE_NOT_FOUND`, not an assertion failure, because `spike/node_modules` does not exist in this
worktree; installing was refused in this non-interactive session. **I am not claiming it green.**
What I can say precisely: no file under `spike/` is modified on this branch, and this round touched
only two files in `packages/shared` and one in `docs/`. The `integrate` step runs
`npm test --prefix spike && pnpm turbo run test` after installing dependencies in the worktree — that
chaining is the honest proof of both halves, and it is the step to trust here rather than this
report. Dependencies and the lockfile are untouched this round, so iteration 1's
`pnpm install --frozen-lockfile` result still describes the branch.

---

## Criterion map

| AC | Where it lives | Where it is tested |
| --- | --- | --- |
| AC-1 | `packages/shared/package.json`, `packages/core/package.json`, `packages/core/src/shared-resolution.test.ts` | `index.test.ts` (4), `shared-resolution.test.ts` |
| AC-2 | `src/index.ts`, `test/corpus.ts` placed outside `src/` | `index.test.ts` (4) |
| AC-3 | `src/flow.ts` | `flow.test.ts` (16) — **holds for presence, not for value types; see the stop-and-report above** |
| AC-4 | `src/flow.ts` header, two DECISIONS entries | `flow.test.ts` (4), `docs.test.ts` (4) |
| AC-5 | `src/ticket.ts` | `ticket.test.ts` (6) |
| AC-6 | `src/role.ts` | `role.test.ts` (5) |
| AC-7 | `src/step-output.ts` | `step-output.test.ts` (8) |
| AC-8 | `src/events.ts`, `docs/04-architecture.md`, `docs/03-adapter-contract.md`, DECISIONS | `events.test.ts` (6), `docs.test.ts` |
| AC-9 | `src/events.ts` header, DECISIONS | `events.test.ts` (5) |
| AC-10 | `src/constants.ts` | `constants.test.ts` (6) |
| AC-11 | `src/stages.ts`, `docs/02-sdlc-pipeline-spec.md`, `docs/GLOSSARY.md` | `stages.test.ts` (4), `docs.test.ts` |

**AC-3 is the one criterion I am not reporting as fully met**, and I would rather say so than have
the gate infer it from a passing suite. Open questions OQ-1, OQ-2, OQ-3, OQ-5 and OQ-6 are
implemented as their stated defaults; **OQ-4** is implemented as its default too — the step id and
nothing else, with ordering, timestamps, terminal events and the answer channel left to Q-0050 and
named as left.
