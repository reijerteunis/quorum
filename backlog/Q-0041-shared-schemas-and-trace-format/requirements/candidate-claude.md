# Q-0041 — `packages/shared`: schemas, types and the trace format

*Candidate requirement, product-manager (claude), 2026-08-25. Every shape below was read from the
repository rather than from the ticket body; where the two disagree, the disagreement is called out
by file and line. Route: **chore**, per* "The port takes the chore route, except the one child that
has new behaviour" *(`docs/DECISIONS.md`, 2026-08-25).*

---

## Problem

`packages/shared` is four files and one line of code: `export const name = '@quorum/shared';`. Every
other ticket in the port imports it — the charter's landing order (`harness/port-charter.md` §5)
opens with *"Q-0041 lands before any child that imports `packages/shared`* — which is all thirteen
others". Nothing can start until the shapes exist.

Today those shapes are implicit, and each of the four is implicit in a different way:

- **A flow is whatever `YAML.parse` returned.** `lintFlow` (`spike/src/lint.js:56`) receives an
  already-parsed object and checks sixteen things about it, none of which is that a step has an
  `id`, a `type` or an `adapter`. A malformed flow does not fail lint — it throws a raw `TypeError`
  from `flattenSteps` or a `YAMLParseError` from the loader, and on `harness run` that reaches
  `main().catch((e) => die(e.stack ?? String(e)))` as a stack trace.
- **A ticket is `parseFrontmatter`'s object** (`spike/src/backlog.js:11–15`). Ten fields are
  written; three of them (`priority`, `repos`, `created`) are never read; `iterations` is a record
  whose keys are computed at run time (`engine.js:541`); and `history` entries have **eight** fields
  (`engine.js:655–657`) where `docs/02-sdlc-pipeline-spec.md:83–84` shows four.
- **A role is the same `parseFrontmatter` object** (`engine.js:727–732`), with three optional
  fields, one of which — `paths` — no code reads at all.
- **A step's output schema is built at run time** by `schemaFor(step)` (`engine.js:679–692`) from
  `output.write`/`writes`/`verdict`, which nothing validated first.

Three problems belong to this ticket rather than to any later child, and none of them is visible
from the ticket body.

**The workspace has no precedent for one package importing another.** No package has an `exports`
map, `main` or `types`; `pnpm-lock.yaml` shows every workspace importer as literally `{}`;
`turbo.json` declares three tasks and no `build`; `tsconfig.base.json` sets no `outDir`,
`composite` or `references`, and every package typechecks with `tsc --noEmit`. Q-0041 is the first
package that has to be importable and the first to take a runtime dependency. Getting the mechanism
wrong blocks thirteen tickets, and the failure surfaces inside Q-0042 rather than here.

**The documented event union matches almost nothing the product emits.** `docs/04-architecture.md:28`
names six kinds — `spawn`, `tool`, `text`, `verdict`, `usage`, `done`. `docs/03-adapter-contract.md:32`
documents `({type:'spawn'|'stdout', ...})`. The code emits **three**: `spawn`
(`adapters/claude.js:31`, `adapters/codex.js:52`), `stdout` (`claude.js:32`, `codex.js:60`,
`mock.js:66`) and `retry` (`adapters/index.js:109`, emitted by the contract layer, not by any
vendor). Of the six documented names only `spawn` exists; `tool`, `text`, `verdict`, `usage` and
`done` are emitted by nothing. Separately, `runFlow` prints through a `ui` object with six methods
(`bin/harness.js:63–127`), one of which — `ui.gate` — does not print but *asks*. Q-0050 must express
all of that as an event stream while preserving what the CLI prints, and it can only do so if the
union defined here is wide enough to carry it. The ticket body is right that this is where it
becomes expensive to change; it is also where the two documents have to stop disagreeing.

**The one judgement call the ticket delegates has a concrete tripwire.** `loadFlow`
(`engine.js:15–20`) mutates the parsed object — `flow.file = file` — *before* `lintFlow` sees it,
and `lintFlow:127` reads `flow.name ?? flow.file`. A `z.object(...).strict()` flow schema therefore
rejects all six shipped flows on an injected key that is not in any YAML file. That single fact
turns "how strict is the flow schema?" from a matter of taste into a property that has to be stated
and tested.

---

## User stories

**`maintainer`.** As the solo maintainer, I want the shapes of Quorum's own files written down once,
in the package with no dependencies, so that thirteen later tickets consume a type instead of each
re-deriving one from the same YAML — and so that when two of them disagree about what a flow file
is, a schema settles it rather than a review round at $8.

**`contributor`.** As a contributor adding a vendor adapter, I want one event format that names my
vendor with a neutral label and carries no field only Claude or Codex could populate, so that
copying `codex` into `gemini` does not require editing `packages/shared` — and so that nothing above
the adapter layer branches on which vendor I am.

**`adopter`.** As a stranger cloning the repository, I want this ticket to be invisible. It adds one
dependency to an install I already run and changes no command, no file format and no output. If my
first thirty minutes get longer because of it, it has failed.

---

## Scope and surfaces

**Surfaces:** `packages/shared`, the root workspace configuration (`package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`), and `docs/`. Not `backlog/` — see the note below. Not the
CLI. Not any other package's source.

**A surface constraint that is binding, not decorative.** *"A requirement may not name a surface its
flow cannot write"* (`docs/DECISIONS.md`, 2026-08-25): `commitAll` (`spike/src/fanout.js:80–93`) runs
`git checkout -- backlog` and `git clean -qfd -- backlog` before every agent step commits, so no
criterion below names `backlog/` as a surface for the implementer. Establishing that cost Q-0009
**$23.25** across three correct-but-immovable revise rounds. The implementer's report at
`dev/implement-report.md` is written by the engine from the step's declared output and is not
affected.

**In scope:** zod schemas and inferred types for the flow file, the ticket's `ticket.md`
frontmatter, the role file and step output; the trace/event union; `STAGES`; and the constants more
than one package needs. `zod` as the package's only runtime dependency.

---

## Acceptance criteria

Eleven, each independently testable and each naming its surface.

**AC-1 — The package is importable, takes exactly one runtime dependency, and imports no workspace
package.** *(Surface: `packages/shared`, root workspace configuration.)* `@quorum/shared` declares
`zod` as its sole `dependencies` entry, with the one-line justification `harness/rules.md` requires
recorded in the implementation report: *zod is the only schema library whose runtime validation and
inferred TypeScript types come from one declaration, which is the entire reason for putting these
shapes in a package rather than writing interfaces.* `yaml` may be added as a **devDependency**,
used only by the corpus tests in AC-3, AC-5 and AC-6 and by nothing that ships. The package gains an
`exports` map — the workspace's first; no package has one, `turbo.json` declares no `build` task and
`tsconfig.base.json` emits nothing, so how one workspace package imports another has no precedent
and this ticket sets it. Nothing under `packages/shared/src/**` imports `@quorum/core`, `cli`,
`server`, `compiler`, `templates` or `apps/web` (`docs/04-architecture.md:39`; charter §4). *Test:*
`pnpm lint`, `pnpm typecheck` and `pnpm test` pass from the repository root; `package.json` shows one
runtime dependency; a grep for `@quorum/` under `packages/shared/src` returns nothing; the resolution
proof named in OQ-2 succeeds.

**AC-2 — `shared` performs no I/O and is safe to bundle for the browser.** *(Surface:
`packages/shared`.)* No file under `packages/shared/src/**`, excluding `*.test.ts`, imports a `node:`
builtin, touches the filesystem, spawns a process or reads `process`. *Rationale, and why this is a
criterion rather than a style note:* `docs/04-architecture.md:31` says the flow editor's form is
generated from the flow schema in `shared`, so `apps/web` will import this package into a browser
bundle; a `shared` that reaches for `node:fs` is discovered at M4, three milestones from here.
*Test:* grep for `node:`, `process.`, `fs.`, `child_process` under `src/**` excluding tests — no
match; the package's entry point re-exports only declarations.

**AC-3 — The flow schema describes the format as it is, and accepts every flow the linter accepts.**
*(Surface: `packages/shared`.)* A zod schema covers the top-level keys (`name`, `consumes`,
`produces`, `cross_vendor`, `steps`, and the loader-injected `file`) and the six step kinds the
engine dispatches on in its own precedence order (`engine.js:176–198`): a `parallel` group, a `gate`
step, `type: script`, `type: integrate`, a `fan_out` step with its `step:` template, and the plain
agent step. The discrimination follows the engine's — by **presence** of `parallel`, `gate` and
`fan_out`, with `type` distinguishing only script from integrate — not by `type` alone. Both
`branches` shapes are admitted: an array of branch templates (`chore.yaml:52`) and a glob string
resolved against fan-out results (`development.yaml:23`). `output.verdict` is the pipe-delimited
string the engine splits at `engine.js:684`, not a list. A gate step has no `id`, and the schema does
not require one.

The binding property, which is the answer to the judgement call the ticket delegates:

> **For any flow object, `lintFlow` succeeding implies the flow schema parsing succeeding.**

Where the corpus forces a permissive choice, a comment names the file or line that forced it — at
minimum the `file` key `loadFlow` injects at `engine.js:17` before lint runs, the `id`-less gate
step, and `route`, which `lint.js:77` knows about and the engine never implements. *Test:* a Vitest
test parses all six `harness/flows/*.yaml` with `file` set as `loadFlow` sets it, and succeeds; one
case per step kind; the property is asserted against at least one object `lintFlow` accepts and a
naive `.strict()` schema would reject.

**AC-4 — The schema's authority is bounded, and the bound is a DECISIONS entry.** *(Surface:
`docs/`.)* A dated entry with **Decision** / **Alternatives considered** / **Why** states four things.
(1) Zod describes structure and types; `lintFlow` keeps every semantic rule and every message it
produces today, and no zod issue may replace a lint message in `quorum lint`'s output. (2) Consumers
use `safeParse`, not `parse`, wherever a lint message is the better diagnostic. (3) **No schema field
carries `.default()` or `.catch()`** unless the spike already applies that default and the spike line
is cited beside it — a zod default silently invents state the file did not carry, which
`harness/rules.md` forbids in as many words (*"Never default silently"*). (4) The boundary is drawn
so a reviewer can decide, for any proposed new rule, whether it belongs to zod or to lint by reading
one paragraph.

*Why the messages are worth protecting explicitly:* `lintFlow` accumulates into a `problems` array
and throws once (`lint.js:127`), so a reader gets every defect in one pass, and **fourteen of the
sixteen messages are prefixed with the step id** — the exact token the reader greps for in the YAML.
Zod's path-based errors would say `steps[3].on_fail.max_iterations`: an index, not an id. Seven of
the sixteen checks are structural and zod could express them (`lint.js:63, 66, 70, 75, 78, 79, 124`);
eight are semantic and it cannot (duplicate ids, goto resolution, counter-prefix correction,
verdict-must-route, the two cross-vendor rules, loop convergence, the deploy gate); one — the
`input.diff` range rule at `:83` — is structural in shape and semantic in reach, because it visits a
`fan_out` step's `step:` template that `flattenSteps` deliberately does not (register row 12).
*Test:* the entry exists in the required shape; a grep of `packages/shared/src` finds no `.default(`
or `.catch(` without an adjacent spike citation.

**AC-5 — The ticket schema parses every `ticket.md` in the repository, including the fields the spec
gets wrong.** *(Surface: `packages/shared`.)* Ten frontmatter fields as `backlog.js:60–68` writes
them. `iterations` is a record of string to number whose keys are the dotted
`<flow>.<step>` form the engine computes (`engine.js:541`) or a flow's explicit unprefixed
`on_fail.counter` — real keys on disk include `qa-red.scenario-review: 4` and `chore.review: 3` —
**not** the two fixed keys `docs/02-sdlc-pipeline-spec.md:83` shows. A `history` entry carries the
**eight** fields `outcome()` writes (`engine.js:655–657`), and the schema also accepts the older,
shorter entries that exist on disk, which `contracts/Q-0006/ticket-review-state.schema.json` models
as a separate `oneOf` branch. Unknown keys are accepted: `backlog/Q-0033-…/ticket.md` carries a
hand-added `depends_on` that nothing reads. `stage` is the ten-member enum; `created` is a date
string, not a `Date`. *Test:* a Vitest test parses the frontmatter of every `backlog/*/ticket.md`
(27 today) and succeeds; **it fails loudly if the directory is absent or empty rather than reporting
a pass over nothing** — *"skipped is not passed"* (`docs/DECISIONS.md`, 2026-08-25) applied to this
ticket's own tests.

**AC-6 — The role schema matches all eleven role files, including the empty one.** *(Surface:
`packages/shared`.)* Three fields — `adapter`, `model`, `paths` — **every one optional**, because
`harness/roles/code-reviewer.md` opens with two consecutive `---` lines, so `YAML.parse('')` returns
`null` and `backlog.js:14`'s `?? {}` hands the engine an empty object. `paths` is typed and its
doc-comment says it is **advisory**: a grep of `spike/src` for `paths` returns nothing, and ownership
reaches an agent only as prose in the role body and in a task description
(`harness/architecture.md`; `harness/roles/principal-architect.md:17–18`). Typing it must not imply
it is enforced. *Test:* a Vitest test parses the frontmatter of all eleven `harness/roles/*.md` and
succeeds, `code-reviewer.md` included; the `paths` doc-comment carries the advisory note and its
citation.

**AC-7 — The step-output schema is the four shapes `schemaFor` emits, and the four validators stay
distinct.** *(Surface: `packages/shared`, `docs/`.)* Zod types both a step's declared `output` block
and the structured result an agent returns — the four shapes `engine.js:679–692` can build:
`{summary}`; `{summary, document}`; `{summary, document, verdict, findings}` with plain string
findings; and the same with `findings.items.pattern = '^(blocker|major|nit): .+:[1-9][0-9]* .+'`,
which `schemaFor` selects when and only when the verdict enum contains `changes-requested`. The
pass-verdict coupling `checkAgainstSchema` enforces at `adapters/index.js:204–208` — the first enum
value requires empty findings, any other requires non-empty — is expressed here as a type or a
`refine`, and **does not replace `checkAgainstSchema`** (register row 13; *"Step-output validation is
Quorum's contract with its own agents"*, 2026-08-22). `packages/shared` imports no ajv, emits no JSON
Schema and validates no vendor output. *Test:* the four shapes have types; a grep shows no ajv
import and no JSON Schema construction in `shared`; a doc-comment on the module names the four
validators and where each lives — zod for the shape of Quorum's own files, `checkAgainstSchema` for
the schema Quorum generated (Q-0046), ajv fully strict for solutioning's contracts (Q-0045), and
vendor-wrapping tolerance confined to `extractJson`.

**AC-8 — The event union carries everything the product emits and prints today, and the two
documents that disagree are made to agree.** *(Surface: `packages/shared`, `docs/`.)* The union
accounts for every one of the following, either by carrying it as a named member or by listing it as
deliberately excluded with the ticket that owns it instead:

| What exists today | Where |
| --- | --- |
| `{ type: 'spawn', vendor, cmd }` | `claude.js:31`, `codex.js:52` |
| `{ type: 'stdout', line }` | `claude.js:32`, `codex.js:60`, `mock.js:66` |
| `{ type: 'retry', vendor, attempt, of, delayMs, reason, message }` | `adapters/index.js:109` |
| `ui.info`, `ui.warn`, `ui.step`, `ui.done` | `bin/harness.js:64–67` |
| `ui.trace(stepId, event)` — the engine adds the step id, adapters emit none | `engine.js:247` |
| `ui.gate({kind, reason, ticketDir, retry})`, which *asks* and awaits | `bin/harness.js:74–127` |

`docs/04-architecture.md:28` (six kinds) and `docs/03-adapter-contract.md:32` (`'spawn'|'stdout'`)
contradict each other and are edited in the same change so a reader cannot reach two answers — the
docs-and-decisions rule requires it, and `docs/` is a surface this flow can write. *Test:* the
implementation report carries the table above with a union member or an owning ticket beside every
row; a Vitest test parses one literal sample of each of the three events emitted today; grepping both
documents for the event kinds yields one answer.

**AC-9 — Vendor identity is one neutral, open label; nothing else in the union is vendor-specific.**
*(Surface: `packages/shared`, `docs/`.)* Register row 22 is honoured as: no field only one vendor
could populate, and no branching on vendor anywhere outside an adapter. Where an event names its
vendor it does so through a single field typed as an **open string** with the shipped names
documented — closing it to `claude|codex|mock` would mean a contributor's `gemini` adapter cannot
emit an event without editing `shared`, and an unknown adapter name is already refused with a good
message by `getAdapter` (`adapters/index.js:29`), so nothing is lost. The requirement records the
reading, because a child's reviewer will otherwise spend a round on it: **row 22's literal wording —
*"nothing downstream learns which vendor produced an event"* — cannot be applied literally**, since
*"Codex cost is reported as tokens, never priced locally"* (2026-08-22) requires per-vendor roll-ups
and forbids a blended number, and `contracts/Q-0011/run-manifest.schema.json` `$defs.usage`
**requires** `vendor` in a frozen contract. *Test:* grep `packages/shared/src` — `claude` and `codex`
appear only as documented example values, never in a conditional; the reading of row 22 is written
where a child's reviewer finds it.

**AC-10 — The constants are the one spelling, byte-identical to the spike's, and the two `.harness/`
namespaces are distinguished.** *(Surface: `packages/shared`.)* Exported constants for: the worktree
root `.harness/worktrees/` and the `/` → `__` branch-directory encoding, which exists today as three
copies of the same expression (`git.js:12`, `git.js:27`, `fanout.js:103`); the run-history root
`.quorum/runs/` with its `manifest.json`, `prompt.txt` and `output.txt` filenames, its run-id shape
and its `steps/NNN-<id>` occurrence-directory shape; the ticket branch shape
`harness/<id>/integration` and the sibling step and task shapes; the `runs.log` filename; the default
base branch `main`, hard-coded in four places (`engine.js:45, 916, 991, 1004`); the `blocker|major|nit`
finding vocabulary; and the five usage measure keys, declared twice today (`adapters/index.js:72`,
`engine.js:465`). **The two `.harness/` namespaces are named differently**: the repo-root
`.harness/worktrees/` and the ticket-folder `.harness/` where `{step}-verdict.json` and
`{step}-{ts}.raw.txt` are written (`engine.js:276`, `:288`, read by `requirements.yaml:23`) share a
prefix and are unrelated. *Test:* every constant's value is byte-identical to the spike literal it
will replace, evidenced by a citation to that line; a reader can tell the two `.harness/` namespaces
apart from the export names alone; nothing in the constants module performs I/O (AC-2).

**AC-11 — `STAGES` moves, the absent state machine is reported rather than invented, and the
documents agree with what shipped.** *(Surface: `packages/shared`, `docs/`.)* The ten-member ordered
list moves from `backlog.js:6–9` unchanged and in order. **The implementation report states that the
spike contains no transition table**: `STAGES` is used only for board column ordering
(`bin/harness.js:434`) and a hard-coded first-three subset (`:436`); transitions are the flow
directory's `consumes`/`produces` (`engine.js:38–40` guards, `:622–624` advances, `lint.js:147–181`
walks the return chain); and nothing validates `meta.stage ∈ STAGES` at read or write. What moves is
therefore the list. The edges drawn at `02-sdlc-pipeline-spec.md:92–101` — including the three
bounded backward edges and chore's three-stage skip — are **not** encoded here; doing so would be new
behaviour, which the 2026-08-25 behaviour-preservation entry forbids without its own decision. In the
same change, `docs/04-architecture.md`, `docs/03-adapter-contract.md` and
`docs/02-sdlc-pipeline-spec.md:83–84` are corrected wherever they disagree with what shipped, their
status lines bumped; `docs/GLOSSARY.md` gains **Event** if the union needs a term the glossary does
not already carry. *Test:* the exported list deep-equals `backlog.js:6–9`; a grep finds no transition
table in `packages/shared`; each document line named above is either already correct or corrected in
this change.

---

## Non-goals

- **Any other child's module.** No `git`, `backlog`, `lint`, `contracts`, `adapters`, `fanout`,
  `run-history` or `engine` code. If this ticket ports a function, the cut into fourteen has failed.
- **Editing `spike/**`.** Charter §3, enforced on branch names by
  `.github/scripts/port-freeze-guard.sh`, whose `branch-scope` job is live and will fail a
  `harness/Q-0041/*` branch that touches `spike/src`.
- **Fixing any defect found while reading.** Nine are visible from the files this ticket must read,
  and every one is stop-and-report under the 2026-08-25 behaviour-preservation entry: `nextId()`
  assumes a `T-` prefix and does not recognise the `Q-` ids in use (`backlog.js:51`); `route` is
  linted (`lint.js:77`) and never implemented; `fan_out.from` and `fan_out.by` are never read —
  `loadTasks` hard-codes `solution/tasks.yaml` (`fanout.js:14`); `output.append` is documented
  (`02-sdlc:365`) and unimplemented; `verdict_file` (`engine.js:288`) and `max_turns`
  (`engine.js:246`) are implemented and undocumented; `priority`, `repos` and `created` are written
  and never read; `history[].stage` duplicates `stage_after`; and the two documents disagree about
  the event union. Only the last is fixed here, and only because AC-8 and AC-11 require the documents
  to agree with what this ticket ships.
- **Wiring any consumer.** No `core` source imports `shared` in this ticket. See OQ-2 for the single
  narrow exception proposed.
- **Replacing `checkAgainstSchema`, `contracts.js`/ajv, or `extractJson`.** Register row 13. ajv is
  not removed: JSON Schema is the language solutioning emits and zod cannot read it.
- **Mirroring the frozen run manifest.** `contracts/Q-0011/run-manifest.schema.json` is frozen and is
  executed by `harness validate` through its `x-quorum-contract` annotation; Q-0045 and Q-0049 own it.
- **Designing the event stream's channel.** Q-0050 owns `runFlow(opts): AsyncIterable<Event>` and how
  a gate answer gets back in. This ticket defines the payload shapes only.
- **Persisting events.** `docs/04-architecture.md:70–71` says there is no persisted event stream in
  this version, and `contracts/Q-0011/run-history-writer.contract.md:3–4` freezes it.
- **New flow semantics, new stage transitions, new step kinds, budget enforcement**, or any `shared`
  export that exists only because M3 might want it.
- **Any path that accepts a subscription secret**, in code, fixture, test or example.
- **Anything on the v1 exclusion list** — multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell.

---

## Open questions

Per `harness/product-context.md`, an open question blocks when it would change a file format or the
adapter contract. **None of these does**, and each carries a stated default that stands unless the
gate overturns it.

| # | Question | Default | Owner | Blocking? |
| --- | --- | --- | --- | --- |
| OQ-1 | Does `shared` also own the `harness.yaml` project-config schema (`backlog`, `adapters`, `budget`, `repo`, `commands`)? The ticket's scope list omits it and no child claims it, yet `loadProject` returns it and Q-0043 lifts `loadProject` next. | **Yes, here.** More than one package reads it, the charter gives `shared` the shared constants, and Q-0043 needs the type the week after. | Ruud, at this flow's gate | No |
| OQ-2 | May this ticket add the single line `"@quorum/shared": "workspace:*"` to `packages/core/package.json` — dependency wiring only, no source — to prove the import mechanism resolves? | **Yes, that one line and nothing else.** No package has an `exports` map, `turbo.json` has no `build` task and nothing typechecks across a package boundary today, so otherwise the first proof lands inside Q-0042, where a failure is a Q-0041 defect found by the wrong ticket. | Ruud, at this flow's gate | No — AC-1 stands either way; only its test changes |
| OQ-3 | How strict is the flow schema on unknown keys? | **Faithful to the format and permissive where the corpus forces it**, with each permissive choice naming the file or line that forced it — starting with `flow.file`, which `loadFlow` injects at `engine.js:17` before lint runs and which a `.strict()` schema would reject on all six flows. | Q-0041 | No — AC-3's property is the operative constraint |
| OQ-4 | Does the event union get an envelope (step id, timestamp, run id) now, or is that Q-0050's? | **A minimal envelope carrying the step id**, because `engine.js:247` already supplies it (`ui.trace(step.id, e)`) and adapters emit no identity at all. Ordering, terminal events, error representation and the gate answer channel stay Q-0050's, per the charter's non-goals. | Q-0050 + Ruud | No, and the closest of these to blocking — five tickets serialise behind Q-0050 |
| OQ-5 | `zod` v3 or v4? `.strict()`, `z.record` and the issue shape differ between them. | **Whatever `pnpm add zod` resolves to, pinned by the lockfile**, using only constructs common to both, so a later bump is not a rewrite at the bottom of the dependency graph. | Q-0041 | No |
| OQ-6 | Does `shared` export the vocabularies the manifest and the ticket history already share — the seven run statuses and the eight error categories — given they are spelled out in three places today? | **Yes, with a test pinning them to `contracts/Q-0011/run-manifest.schema.json`**, which turns a second spelling into a checked one. No competing manifest validator. | Q-0041, confirmed by Q-0045/Q-0049 | No |
| OQ-7 | Register row 22 says *"nothing downstream learns which vendor produced an event"*. Two dated decisions and one frozen contract require the opposite. Which reading governs? | **No vendor-specific field and no vendor branching outside an adapter; a neutral `vendor` label is permitted and required.** Per-vendor roll-ups are mandated by the 2026-08-22 cost decision, and `$defs.usage` requires `vendor`. | Ruud, at this flow's gate | No — but a child's reviewer could reasonably raise it as a blocker, which is why it is written down here rather than discovered at $8 a round |

---

## Risks

**Nothing consumes this package until Q-0042, so every mistake is found later and by someone else.**
This is the structural risk of being first, and the corpus tests in AC-3, AC-5 and AC-6 are the only
witness available: `spike/` is outside the pnpm workspace, ESLint ignores `spike/**`, and its suite
runs on npm in a separate CI job, so the spike cannot exercise a zod schema and the schema cannot
exercise the spike. OQ-2's one-line resolution proof is the cheapest additional witness there is.

**The event union is being designed against a document line rather than against code.** Six
documented kinds, three emitted, two documents that disagree, and six `ui` methods with no home.
Designing from `04-architecture.md:28` alone would produce a union that cannot express what the CLI
prints today — and the failure would surface at Q-0050, where it is a behaviour change and where five
tickets are already queued behind it. AC-8 is the mitigation and it is the criterion most worth
reviewing carefully.

**A zod `.default()` is silent state invention, thirteen tickets deep.** `harness/rules.md` says
never default silently, and the schema layer is the one place where a default looks like good
hygiene. A `.default('claude')` on a step's adapter, or a `.default([])` on `history`, would make
every later child read a value the file did not carry, and no test would fail. AC-4 bans it and asks
for a spike citation where the spike genuinely does default.

**The schema is written from one repository's corpus.** Six flow files, twenty-seven tickets, eleven
roles — all Quorum's own. An adopter's flow file that is legal today and rejected by a later child's
`.parse` is a behaviour change discovered in the field, in the package everything imports. AC-3's
property and the `safeParse` rule bound it; they do not eliminate it.

**Chore-flow hazards, at n=1 of fourteen.** `harness/Q-0041/integration` must exist before the first
run, because `review` diffs `harness/{id}/integration...harness/{id}/implement` and only `integrate`
creates the left endpoint — the gap recorded at `docs/02-sdlc-pipeline-spec.md:398–416` and carried
by Q-0038, which cost Q-0035 **$13.86** when it was forgotten. Pass no more `--gate-answer` values
than would be authorised blind, since they are consumed in order and an engine-presented exhaustion
gate is a gate. `budget.per_run_usd: 10` describes and does not stop. Run one run at a time; nothing
enforces it. And the freeze guard's `branch-scope` job will fail this branch if anything under
`spike/src` moves.

**The port charter's own row reference is inconsistent, and it is worth resolving before the
implementer reads it.** This ticket's body cites *"register rows 22 (charter §2)"* in one place and
*"§6's register is normative"* in another; the register itself is at charter §2 (`:124–147`) and §6
(`:294–324`) is the per-child table whose Q-0041 row names invariant 22. Both point at row 22, so
nothing material is at stake — but an implementer following the wrong pointer reads the wrong table.

---

## Cross-cutting checklist

- **BYOS.** No new code path touches a subscription secret. `packages/shared` names none of
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` in any file, fixture or example — the
  refusal that does name them is register row 1 and belongs to Q-0046.
- **Worktree safety.** No flow behaviour changes. AC-10 makes `.harness/worktrees/` and
  `.quorum/runs/` single-spelling constants rather than three copies of a `path.join`, which is a
  small reduction in the ways that invariant can be broken later. The implementer works in a
  worktree on `harness/Q-0041/implement`, based on `harness/Q-0041/integration`, which must exist
  first.
- **Gate behaviour.** Unchanged. This ticket adds no gate semantics; how a gate question and answer
  travel as events is OQ-4 and belongs to Q-0050.
- **File formats and their schemas.** **None change.** Every schema here describes a format that
  already exists; nothing rewrites a file, and no criterion above causes a byte of `ticket.md`,
  `runs.log`, a flow file, a role file or a manifest to differ. `contracts/Q-0011/run-manifest.schema.json`
  is frozen and is not opened.
- **Lint rules.** `quorum lint` must keep accepting all six flow files in `harness/flows/` and keep
  rejecting exactly what `harness lint` rejects, with the same sixteen messages. AC-3 and AC-4 are
  the mechanism; Q-0044 is where the rules themselves land.
- **Cold-clone impact.** One dependency added to an install the adopter already runs. No new
  command, no new step, no output change. Net zero.
- **Product-agnostic.** Nothing here names a SaaS product. The corpus tests read this repository's
  own `harness/`, `backlog/` and `contracts/`, which is Quorum's harness, not a product's.
- **Errors are explicit.** Two criteria are instances rather than gestures. AC-4 bans `.default()`
  and `.catch()`, which are the schema layer's version of defaulting silently. AC-5 requires the
  corpus test to fail loudly when its corpus is missing, rather than reporting a pass over an empty
  directory — *"a check that skips its subject must not report success"* (2026-08-25), applied to
  this ticket's own tests, since a green tick over nothing is exactly how a bottom-of-the-graph
  package would ship a schema nobody had checked.
