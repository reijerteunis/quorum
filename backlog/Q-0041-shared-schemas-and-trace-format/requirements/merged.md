# Q-0041 — `packages/shared`: schemas, types and the trace format

*Merged requirement, head-of-product, 2026-08-25. Route: **chore** (`requirements → chore → human
gate`), per* "The port takes the chore route, except the one child that has new behaviour"
*(`docs/DECISIONS.md`, 2026-08-25). Parent: Q-0009. Charter: `harness/port-charter.md`, whose §2
register is normative where this document and it differ.*

---

## Problem

`packages/shared` is two source files and one line of code: `export const name = '@quorum/shared';`.
Every other child of Q-0009 imports it — the charter's landing order opens with *"Q-0041 lands
before any child that imports `packages/shared`"*, which is all thirteen others. Nothing can start
until the shapes exist.

Today those shapes are implicit, and each is implicit in a different way:

- **A flow is whatever `YAML.parse` returned.** `lintFlow` (`spike/src/lint.js:56`) receives an
  already-parsed object and pushes sixteen problems about it, none of which is that a step has an
  `id`, a `type` or an `adapter`. A malformed flow does not fail lint — it throws a raw `TypeError`
  from `flattenSteps` or a `YAMLParseError` from the loader, which reaches the user as a stack trace.
- **A ticket is `parseFrontmatter`'s object** (`spike/src/backlog.js:11–15`). Ten fields are written;
  three of them (`priority`, `repos`, `created`) are never read; `iterations` keys are computed at
  run time; and a `history` entry carries **eight** fields (`engine.js:655–657`) where
  `docs/02-sdlc-pipeline-spec.md:83–84` shows four.
- **A role is the same `parseFrontmatter` object** (`engine.js:727–732`), three optional fields, one
  of which — `paths` — no code reads at all.
- **A step's output schema is built at run time** by `schemaFor(step)` (`engine.js:679–692`) from
  `output.write` / `writes` / `verdict`, none of which anything validated first.

Three problems belong to this ticket rather than to any later child, and none is visible from the
ticket body.

**The workspace has no precedent for one package importing another.** No package declares `exports`,
`main` or `types`; none has a single dependency; `turbo.json` declares `lint`, `typecheck` and
`test` and no `build`; `tsconfig.base.json` sets no `outDir`, `composite` or `references`, and every
package typechecks with `tsc --noEmit`. Q-0041 is the first package that must be importable and the
first to take a runtime dependency. Getting the mechanism wrong blocks thirteen tickets, and the
failure surfaces inside Q-0042 rather than here.

**The documented event union matches almost nothing the product emits.**
`docs/04-architecture.md:28` names six kinds — `spawn`, `tool`, `text`, `verdict`, `usage`, `done`.
`docs/03-adapter-contract.md:32` documents `({type:'spawn'|'stdout', ...})`. The code emits
**three**: `spawn` (`adapters/claude.js:31`, `adapters/codex.js:52`), `stdout` (`claude.js:32`,
`codex.js:60`, `mock.js:66`) and `retry` (`adapters/index.js:109`, emitted by the contract layer
rather than by any vendor). Of the six documented names only `spawn` exists. Separately, `runFlow`
prints through a `ui` object with six methods (`bin/harness.js:63–127`), one of which — `ui.gate` —
does not print but *asks*. Two documents disagree, and neither describes the code.

**The one judgement call the ticket delegates has a concrete tripwire.** `loadFlow`
(`engine.js:15–20`) mutates the parsed object — `flow.file = file` — *before* `lintFlow` sees it,
and `lint.js:127` throws `flow ${flow.name ?? flow.file} invalid:`. A `.strict()` flow schema would
therefore reject all six shipped flows on a key that appears in no YAML file, and the injected key
is load-bearing for a printed message. "How strict is the flow schema?" is a property to be stated
and tested, not a matter of taste.

---

## User stories

**`maintainer`.** As the solo maintainer, I want the shapes of Quorum's own files written down once,
in the package with no dependencies, so that thirteen later tickets consume a type instead of each
re-deriving one from the same YAML — and so that when two of them disagree about what a flow file
is, a schema settles it rather than a review round at $8.

**`contributor`.** As a contributor adding a vendor adapter, I want one event format that names my
vendor with a neutral label and carries no field only Claude or Codex could populate, so that
copying `codex` into `gemini` does not require editing `packages/shared`, and so that nothing above
the adapter layer branches on which vendor I am.

**`adopter`.** As a stranger cloning the repository, I want this ticket to be invisible: one
dependency added to an install I already run, no new command, no changed file format, no changed
output. If my first thirty minutes get longer because of it, it has failed.

---

## Scope and surfaces

**Surfaces the implementer writes:** `packages/shared`, the root workspace configuration
(`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and the one dependency line named in
AC-1), and `docs/`.

**Surfaces the implementer reads and must not write:** `spike/**` (charter §3, enforced by
`.github/scripts/port-freeze-guard.sh`'s live `branch-scope` job), and `backlog/`, `harness/` and
`contracts/` as test corpora. Reading is what the corpus tests do; writing `backlog/` is impossible
for an agent step and no criterion below asks for it — `commitAll` (`spike/src/fanout.js:80–93`)
runs `git checkout -- backlog` and `git clean -qfd -- backlog` before every agent step commits, per
*"A requirement may not name a surface its flow cannot write"* (`docs/DECISIONS.md`, 2026-08-25).
Establishing that cost Q-0009 **$23.25** across three correct-but-immovable revise rounds.

**In scope:** zod schemas and inferred types for the flow file, `ticket.md` frontmatter, the role
file and step output; the trace/event union; `STAGES`; and the constants more than one package
needs. `zod` as the package's only runtime dependency.

**A binding rule that applies to every criterion below.** Where a checked-in file contradicts the
schema this requirement describes, the implementer **stops and reports the mismatch** in
`dev/implement-report.md` as a port defect. It does not edit the file, and it does not silently
widen or narrow the schema to absorb it. This is *"The port preserves behaviour; one exception is
authorised and everything else stops the child"* (`docs/DECISIONS.md`, 2026-08-25) applied to a
package whose only witness is the corpus.

---

## Acceptance criteria

Eleven, each independently testable, each naming its surface.

**AC-1 — The package is importable, takes exactly one runtime dependency, and imports no workspace
package.** *(Surface: `packages/shared`, root workspace configuration.)* `@quorum/shared` declares
`zod` as its sole `dependencies` entry, with the one-line justification `harness/rules.md` requires
recorded in the implementation report: *zod is the only schema library whose runtime validation and
inferred TypeScript types come from one declaration, which is the entire reason for putting these
shapes in a package rather than writing interfaces.* `yaml` may be added as a **devDependency**,
used only by the corpus tests in AC-3, AC-5 and AC-6 and by nothing that ships. The package gains an
`exports` map — the workspace's first, since no package declares one, `turbo.json` has no `build`
task and `tsconfig.base.json` emits nothing, so how one workspace package imports another has no
precedent and this ticket sets it. Nothing under `packages/shared/src/**` imports `@quorum/core`,
`cli`, `server`, `compiler`, `templates` or `apps/web` (`docs/04-architecture.md:39`; charter §4).
The mechanism is proved rather than assumed: `packages/core/package.json` gains the single line
`"@quorum/shared": "workspace:*"` — dependency wiring only, no `core` source file changed — and a
typecheck resolves an import of a `shared` type from `core`. *Test:* `pnpm lint`, `pnpm typecheck`
and `pnpm test` pass from the repository root; `package.json` shows one runtime dependency; a grep
for `@quorum/` under `packages/shared/src` returns nothing; the resolution proof succeeds.

**AC-2 — `shared` is declarations only: no I/O, safe to bundle for a browser.** *(Surface:
`packages/shared`.)* No file under `packages/shared/src/**`, excluding `*.test.ts`, imports a `node:`
builtin, touches the filesystem, spawns a process or reads `process`. *Why this is a criterion and
not a style note:* `docs/04-architecture.md:31` says the flow editor's form is generated from the
flow schema in `shared`, so `apps/web` will import this package into a browser bundle; a `shared`
that reaches for `node:fs` is discovered at M4, three milestones from here. The corpus tests are
exempt because they are not shipped. *Test:* grep for `node:`, `process.`, `fs.` and
`child_process` under `src/**` excluding tests — no match; the entry point re-exports only
declarations.

**AC-3 — The flow schema describes the format as it is, and accepts every flow the linter accepts.**
*(Surface: `packages/shared`.)* A zod schema covers the top-level keys (`name`, `consumes`,
`produces`, `cross_vendor`, `steps`, and the loader-injected `file`) and the six step kinds the
engine dispatches on **in its own precedence order** (`engine.js:176–198`): a `parallel` group, a
`gate` step, `type: script`, `type: integrate`, a `fan_out` step with its `step:` template, and the
plain agent step. Discrimination follows the engine's — by **presence** of `parallel`, `gate` and
`fan_out`, with `type` distinguishing only script from integrate — not by `type` alone. Both
`branches` shapes are admitted: an array of branch templates (`chore.yaml:52`, `qa-red.yaml:31`,
`solutioning.yaml:57`) and a glob string resolved against fan-out results (`development.yaml:23`).
`output.verdict` is the pipe-delimited string the engine splits at `engine.js:684`, not a list. A
gate step carries no `id` (`chore.yaml:58`) and the schema does not require one.

The binding property, which is this ticket's answer to the judgement call the body delegates:

> **For any flow object, `lintFlow` succeeding implies the flow schema parsing succeeding.**

The converse is deliberately not required: a structurally valid flow may still be rejected by lint,
which is the boundary AC-4 records. Where the corpus forces a permissive choice, a comment names the
file or line that forced it — at minimum the `file` key `loadFlow` injects at `engine.js:17` before
lint runs and which `lint.js:127` then prints, the `id`-less gate step, and `route`, which
`lint.js:77` knows about and the engine never implements. *Test:* a Vitest test parses all six
`harness/flows/*.yaml` with `file` set as `loadFlow` sets it, and succeeds; one case per step kind;
the property is asserted against at least one object `lintFlow` accepts that a naive `.strict()`
schema would reject.

**AC-4 — The schema's authority is bounded, it invents nothing, and it discards nothing.**
*(Surface: `packages/shared`, `docs/`.)* Three properties, and a dated DECISIONS entry with
**Decision** / **Alternatives considered** / **Why** recording the first.

1. *Bounded.* Zod describes structure and types; `lintFlow` keeps every semantic rule and every
   message it produces today, and no zod issue may replace a lint message in `quorum lint`'s
   output. Consumers use `safeParse`, not `parse`, wherever a lint message is the better
   diagnostic. The entry is written so a reviewer can decide, for any proposed new rule, whether it
   belongs to zod or to lint by reading one paragraph.
2. *Invents nothing.* **No schema field carries `.default()` or `.catch()`** unless the spike
   already applies that default and the spike line is cited beside it. A zod default silently
   invents state the file did not carry, which `harness/rules.md` forbids in as many words
   (*"Never default silently"*).
3. *Discards nothing.* Zod strips unknown object keys by default. Unknown keys are either preserved
   in the parsed result or rejected explicitly — never dropped — because a stripped key becomes
   data loss the moment a parsed object is written back, and `backlog/Q-0033-…/ticket.md` already
   carries a hand-added `depends_on` that nothing reads.

*Why the lint messages are worth protecting explicitly:* `lintFlow` accumulates into a `problems`
array and throws once (`lint.js:127`), so a reader gets every defect in one pass, and **fourteen of
the sixteen messages are prefixed with the step id** — the exact token the reader greps for in the
YAML. Zod's path-based errors would say `steps[3].on_fail.max_iterations`: an index, not an id.
Seven of the sixteen checks are structural and zod could express them (`lint.js:63, 66, 70, 75, 78,
79, 124`); eight are semantic and it cannot (duplicate ids, goto resolution, counter-prefix
correction, verdict-must-route, the two cross-vendor rules, loop convergence, the deploy gate); one
— the `input.diff` range rule at `:83` — is structural in shape and semantic in reach, because it
visits a `fan_out` step's `step:` template that `flattenSteps` deliberately does not (register row
12). *Test:* the entry exists in the required shape; a grep of `packages/shared/src` finds no
`.default(` or `.catch(` without an adjacent spike citation; a round-trip test proves an accepted
object survives parsing with no key or value removed or added.

**AC-5 — The ticket schema parses every `ticket.md` in the repository, including the fields the spec
gets wrong.** *(Surface: `packages/shared`.)* Ten frontmatter fields as `backlog.js:60–68` writes
them: `id`, `title`, `stage`, `owner`, `repos`, `branch`, `priority`, `created`, `iterations`,
`history`. `iterations` is a record of string to number admitting **both** key forms on disk — the
dotted `<flow>.<step>` the engine computes (`engine.js:541`; e.g. `qa-red.scenario-review: 4`,
`chore.review: 3`) and a bare unprefixed key from a flow's explicit `on_fail.counter` (e.g.
`review: 2`) — **not** the two fixed keys `docs/02-sdlc-pipeline-spec.md:83` shows. A `history`
entry carries the **eight** fields `outcome()` writes — `stage`, `run`, `flow`, `status`,
`stage_before`, `stage_after`, `at`, `cost` (`engine.js:655–657`), `cost` nullable — and the schema
also accepts the older, shorter entries that exist on disk, which
`contracts/Q-0006/ticket-review-state.schema.json` already models as a separate `oneOf` branch;
rejecting them would be a migration, not a port. `stage` is the ten-member enum; `created` is a
date string, not a `Date`. *Test:* a Vitest test parses the frontmatter of every
`backlog/*/ticket.md` (27 today) and succeeds; **it fails loudly if the directory is absent or
empty rather than reporting a pass over nothing** — *"skipped is not passed"* (`docs/DECISIONS.md`,
2026-08-25) applied to this ticket's own tests.

**AC-6 — The role schema matches all eleven role files, including the empty one.** *(Surface:
`packages/shared`.)* Three fields — `adapter`, `model`, `paths` — **every one optional**, because
`harness/roles/code-reviewer.md` opens with two consecutive `---` lines, so `YAML.parse('')` yields
nothing and `backlog.js:14`'s `?? {}` hands the engine an empty object. The markdown body stays
outside the frontmatter schema. `paths` is typed and its doc-comment says it is **advisory**: a grep
of `spike/src` for `paths` returns nothing, and ownership reaches an agent only as prose in the role
body and in a task description (`harness/architecture.md`;
`harness/roles/principal-architect.md:17–18`). Typing it must not imply it is enforced. The schema
does not interpret role prose, check that a path exists, or judge whether a model is valid for an
adapter. *Test:* a Vitest test parses the frontmatter of all eleven `harness/roles/*.md` and
succeeds, `code-reviewer.md` included; the `paths` doc-comment carries the advisory note and its
citation.

**AC-7 — Step output is two separately named shapes that cannot be confused, and the four
validators stay distinct.** *(Surface: `packages/shared`, `docs/`.)* Zod types (a) a flow step's
declared `output` block — `write`, `writes`, `verdict`, `verdict_file` — and (b) Quorum's parsed
structured result from an agent step, which is the four shapes `engine.js:679–692` can build:
`{summary}`; `{summary, document}`; `{summary, document, verdict, findings}` with plain string
findings; and the same with `findings.items.pattern = '^(blocker|major|nit): .+:[1-9][0-9]* .+'`,
which `schemaFor` selects when and only when the verdict enum contains `changes-requested`. The two
carry **different public names**, and a test proves a declaration is not accepted as a result and a
result is not accepted as a declaration — they are adjacent, similarly named, and importing the
wrong one is a defect no type error would catch if they were structurally compatible. The result
schema does not attempt to validate a dynamically generated verdict enum; which verdict values are
legal for a given step, and the pass-verdict coupling `checkAgainstSchema` enforces at
`adapters/index.js:204–208`, remain that function's business. `packages/shared` imports no ajv,
emits no JSON Schema and validates no vendor output. *Test:* both shapes have types and names; the
confusion test passes; a grep shows no ajv import and no JSON Schema construction in `shared`; a
doc-comment on the module names the four validators and where each lives — zod for the shape of
Quorum's own files, `checkAgainstSchema` for the schema Quorum generated (Q-0046), ajv fully strict
for solutioning's contracts (Q-0045), and vendor-wrapping tolerance confined to `extractJson`
(register row 13; *"Step-output validation is Quorum's contract with its own agents"*, 2026-08-22).

**AC-8 — The event union is derived from what the product emits and prints, not from a document
line, and the two documents that disagree are made to agree.** *(Surface: `packages/shared`,
`docs/`.)* The union is a discriminated union on `type`, and its membership is decided by evidence:

| What exists today | Where | Disposition |
| --- | --- | --- |
| `{ type: 'spawn', vendor, cmd }` | `claude.js:31`, `codex.js:52` | union member, fields verbatim |
| `{ type: 'stdout', line }` | `claude.js:32`, `codex.js:60`, `mock.js:66` | union member, fields verbatim |
| `{ type: 'retry', vendor, attempt, of, delayMs, reason, message }` | `adapters/index.js:109` | union member, fields verbatim |
| `ui.step(id, m)`, `ui.done(id, m)`, `ui.info(m)`, `ui.warn(m)` | `bin/harness.js:64–67` | union members, payloads taken from every call site in `engine.js` |
| `ui.gate({kind, reason, ticketDir, retry})` — which *asks* and awaits | `bin/harness.js:74–127` | the **question** is a union member; how the answer travels back is Q-0050's |
| `tool`, `text` (`docs/04-architecture.md:28`) | emitted by nothing | **not invented here** — see below |

`tool` and `text` are not added. Producing them requires an adapter to parse vendor JSONL into
normalised events, which changes what `--verbose` prints (`bin/harness.js:69`) and enlarges
Q-0047's scope; no ticket authorises it, and *"The port preserves behaviour"* (2026-08-25) makes
that a stop-and-report rather than a design opportunity. Widening a discriminated union later is
additive and every non-exhaustive consumer fails at `tsc`, so the cost of adding them when a
producer exists is a type error at build time; the cost of inventing their payloads now, thirteen
tickets deep, is not. The disposition table and this reasoning go into the DECISIONS entry AC-4
requires, or a second entry beside it, so the gate approves the narrowing explicitly rather than
inheriting it. In the same change `docs/04-architecture.md:28` and `docs/03-adapter-contract.md:32`
are corrected so a reader cannot reach two answers, with status lines bumped — the docs-and-decisions
rule requires it and `docs/` is a surface this flow can write. *Test:* a Vitest test parses one
literal sample of each of the three adapter events, taken verbatim from the cited lines; the
implementation report carries the table above with a member or a stated reason beside every row;
grepping both documents for the event kinds yields one answer.

**AC-9 — Vendor identity is one neutral, open label; nothing else in the union is
vendor-specific.** *(Surface: `packages/shared`, `docs/`.)* No field only one vendor could populate,
and no branching on vendor anywhere outside an adapter. Where an event names its vendor it does so
through a single field typed as an **open string** with the shipped names documented — closing it to
`claude|codex|mock` would mean a contributor's `gemini` adapter cannot emit an event without editing
`shared`, and an unknown adapter name is already refused with a good message by `getAdapter`
(`adapters/index.js:29`), so nothing is lost. The requirement records the reading, because a child's
reviewer will otherwise spend a round on it: **register row 22's literal wording — *"nothing
downstream learns which vendor produced an event"* — cannot be applied literally.** `spawn` and
`retry` carry `vendor` today, so removing it is a behaviour change; *"Codex cost is reported as
tokens, never priced locally"* (2026-08-22) requires per-vendor roll-ups and forbids a blended
number; and `contracts/Q-0011/run-manifest.schema.json` **requires** `vendor` in both `$defs.usage`
and `$defs.vendor_rollup`, in a frozen contract. The operative reading is therefore: *no
vendor-specific field and no vendor branching outside an adapter; a neutral `vendor` label is
permitted and required.* *Test:* grep `packages/shared/src` — `claude` and `codex` appear only as
documented example values, never in a conditional; the reading of row 22 is written where a child's
reviewer finds it.

**AC-10 — The constants are the one spelling, byte-identical to the spike's, and the two
`.harness/` namespaces are distinguished.** *(Surface: `packages/shared`.)* Exported constants for:
the worktree root `.harness/worktrees/` and the `/` → `__` branch-directory encoding, which exists
today as three copies of one expression (`git.js:11`, `git.js:27`, `fanout.js:103`); the
run-history root `.quorum/runs/` with its `manifest.json`, `prompt.txt` and `output.txt` filenames,
its run-id shape and its `steps/NNN-<id>` occurrence-directory shape; the ticket branch shape
`harness/<id>/integration` and the sibling step and task shapes, taking the ticket id as data and
embedding no repository name; the `runs.log` filename; the default base branch `main`, hard-coded in
four places (`engine.js:45, 916, 991, 1004`); the `blocker|major|nit` finding vocabulary; and the
five usage measure keys, declared twice today (`adapters/index.js:72`, `engine.js:465`). **The two
`.harness/` namespaces are named differently**: the repo-root `.harness/worktrees/` and the
ticket-folder `.harness/` where `{step}-verdict.json` and `{step}-{ts}.raw.txt` are written
(`engine.js:276`, `:288`, read by `requirements.yaml:23`) share a prefix and are unrelated. Any
exported branch validator is a pure predicate over a string; the safety enforcement itself stays in
`core`. *Test:* every constant's value is byte-identical to the spike literal it will replace,
evidenced by a citation to that line; a reader can tell the two `.harness/` namespaces apart from
the export names alone; nothing in the constants module performs I/O (AC-2).

**AC-11 — `STAGES` moves, the absent state machine is reported rather than invented, and the
documents agree with what shipped.** *(Surface: `packages/shared`, `docs/`.)* The ten-member ordered
tuple moves from `backlog.js:6–9` unchanged and in order — `draft`, `requirements`, `solutioned`,
`red`, `green`, `reviewed`, `qa-passed`, `deployed`, `blocked`, `abandoned` — with the `Stage` type
and the stage schema both derived from that one source and no second hand-written list anywhere in
the package. **The implementation report states that the spike contains no transition table:**
`STAGES` is used only for board column ordering (`bin/harness.js:434`) and a hard-coded first-three
subset (`:436`); transitions are the flow directory's `consumes`/`produces` (`engine.js:38–40`
guards, `:622–624` advances, `lint.js:147–181` walks the return chain); and nothing validates
`meta.stage ∈ STAGES` at read or write. What moves is therefore the list. The edges drawn at
`02-sdlc-pipeline-spec.md:92–101` — the three bounded backward edges and chore's three-stage skip —
are **not** encoded here; encoding them would be new behaviour, which the 2026-08-25
behaviour-preservation entry forbids without its own decision. In the same change,
`docs/04-architecture.md`, `docs/03-adapter-contract.md` and `docs/02-sdlc-pipeline-spec.md:83–84`
are corrected wherever they disagree with what shipped, their status lines bumped; `docs/GLOSSARY.md`
gains **Event** if the union needs a term the glossary does not already carry. *Test:* the exported
tuple deep-equals `backlog.js:6–9`; a grep finds no transition table in `packages/shared`; each
document line named above is either already correct or corrected in this change.

---

## Non-goals

- **Any other child's module.** No `git`, `backlog`, `lint`, `contracts`, `adapters`, `fanout`,
  `run-history` or `engine` code. If this ticket ports a function, the cut into fourteen has failed.
- **The `harness.yaml` project-config schema.** It is a schema and it will live in `shared`, but not
  from this ticket: `loadProject` (`bin/harness.js:54`) is Q-0043's lift and Q-0043 is its only
  consumer at port time. Keeping the ticket everything blocks on at eleven criteria is worth more
  than owning one more shape. Q-0043 adds it beside these.
- **Vocabularies that are not cross-package.** The seven run statuses (`bin/harness.js:132`) and the
  manifest's error categories are consumed by the run-history reader and the engine, both of which
  land in `core`; they go to `shared` only when a second package needs them. Q-0049 and Q-0050 own
  the decision.
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
  the event union. Only the last is corrected here, and only because AC-8 and AC-11 require the
  documents to agree with what this ticket ships.
- **Wiring any consumer.** No `core` source file imports `shared` in this ticket; AC-1's resolution
  proof is one dependency line plus a typecheck, and nothing else.
- **Replacing `checkAgainstSchema`, `contracts.js`/ajv, or `extractJson`.** Register row 13. ajv is
  not removed: JSON Schema is the language solutioning emits and zod cannot read it, and no zod
  schema here consumes arbitrary JSON Schema.
- **Mirroring the frozen run manifest.** `contracts/Q-0011/run-manifest.schema.json` is frozen and
  executed by `harness validate` through its `x-quorum-contract` annotation; Q-0045 and Q-0049 own
  it. AC-9 cites it as evidence and does not reimplement it.
- **Designing the event stream's channel.** Q-0050 owns `runFlow(opts): AsyncIterable<Event>`,
  ordering, terminal semantics, error representation and how a gate answer travels back. This ticket
  defines payload shapes only.
- **Emitting, persisting, replaying, rendering or transporting events.** Nothing in this ticket
  emits an event, writes under `.quorum/runs/` or changes `runs.log`.
  `docs/04-architecture.md:70–71` says there is no persisted event stream in this version, and
  `contracts/Q-0011/run-history-writer.contract.md:3–4` freezes that.
- **New flow semantics, new stage transitions, new step kinds, budget enforcement**, or any `shared`
  export that exists only because M3 might want it.
- **Any path that accepts a subscription secret**, in code, fixture, test or example.
- **Anything on the v1 exclusion list** — multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell.

---

## Open questions

Per `harness/product-context.md`, an open question blocks when it would change a file format or the
adapter contract. **None of these does.** Each carries a stated default that governs unless the gate
overturns it. The three questions the Codex candidate raised as blocking are resolved above and
recorded here with the evidence, so a later reviewer does not reopen them.

| # | Question | Answer / default | Owner | Blocking? |
| --- | --- | --- | --- | --- |
| OQ-1 | What are the payloads of `tool`, `text`, `verdict`, `usage` and `done`? `04-architecture.md:28` names them and nothing emits them. | **Resolved (AC-8).** Derived from evidence: the three adapter events verbatim, plus the six `ui` methods' call sites. `tool` and `text` are not invented — they need an adapter to normalise vendor JSONL, which changes `--verbose` output and enlarges Q-0047. Widening the union later is additive and caught by `tsc`. | Q-0041, ratified in the DECISIONS entry | No |
| OQ-2 | Does "the stage state machine moves here" require a transition table? | **Resolved (AC-11).** No. The spike has no transition table; transitions are the flow directory's `consumes`/`produces`. Encoding one would be new behaviour, forbidden by the 2026-08-25 entry without its own decision. | Q-0041 | No |
| OQ-3 | Must ticket validation accept legacy `history` entries shorter than the current eight fields? | **Resolved (AC-5).** Yes; rejecting them is a migration, not a port. The corpus test over all 27 tickets is the specification, and `contracts/Q-0006/ticket-review-state.schema.json` already models the older shape as a `oneOf` branch. | Q-0041 | No |
| OQ-4 | Does the event union get an envelope (step id, timestamp, run id) now? | **A minimal envelope carrying the step id**, because `engine.js:247` already supplies it (`ui.trace(step.id, e)`) while adapters emit no identity at all. Ordering, timestamps, terminal events and the answer channel stay Q-0050's. | Q-0050 + Ruud | No — closest of these to blocking, since five tickets serialise behind Q-0050 |
| OQ-5 | Are unknown keys a supported extension point, or an error a later ticket should introduce? | **Preserved, not blessed.** AC-4 forbids stripping for the port; permanent extensibility is a separate decision nobody needs yet. | Ruud | No |
| OQ-6 | `zod` v3 or v4? `.strict()`, `z.record` and the issue shape differ. | **Whatever `pnpm add zod` resolves to, pinned by the lockfile**, using only constructs common to both, so a later bump is not a rewrite at the bottom of the dependency graph. | Q-0041 | No |
| OQ-7 | Register row 22 says *"nothing downstream learns which vendor produced an event"*. Two dated decisions and one frozen contract require the opposite. | **Resolved (AC-9):** no vendor-specific field and no vendor branching outside an adapter; a neutral `vendor` label is permitted and required. `spawn` and `retry` carry it today. | Q-0041, recorded for children's reviewers | No |

---

## Risks

**Nothing consumes this package until Q-0042, so every mistake is found later and by someone else.**
This is the structural risk of being first, and the corpus tests in AC-3, AC-5 and AC-6 are the only
witness available: `spike/` is outside the pnpm workspace, ESLint ignores `spike/**`, and its suite
runs on npm in a separate CI job, so the spike cannot exercise a zod schema and the schema cannot
exercise the spike. AC-1's resolution proof is the cheapest additional witness there is.

**The event union is being designed at the point of maximum leverage and minimum evidence.** Six
documented kinds, three emitted, two documents that disagree, and six `ui` methods with no home.
Designing from `04-architecture.md:28` alone would produce a union that cannot express what the CLI
prints today, and the failure would surface at Q-0050, where it is a behaviour change and where five
tickets are queued behind it. AC-8's evidence table is the mitigation and it is the criterion most
worth reviewing carefully.

**A zod `.default()` is silent state invention, thirteen tickets deep, and a stripped key is silent
state loss.** `harness/rules.md` says never default silently, and the schema layer is where a
default looks like good hygiene: a `.default('claude')` on a step's adapter or a `.default([])` on
`history` would make every later child read a value the file did not carry, and no test would fail.
The mirror hazard is zod's default key-stripping, which turns parse-then-write into data loss. AC-4
bans both.

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
enforces it. If the run dies before `integrate`, perform that step by hand before trusting the
branch — it is what caught two real defects on Q-0009.

**The charter's own row reference is inconsistent, and the implementer will read it.** This ticket's
body cites *"register rows 22 (charter §2)"* in one place and *"§6's register is normative"* in
another; the register is at charter §2 (`:124–147`, row 22 at `:147`) and §6 (`:294–324`) is the
per-child table whose Q-0041 row names invariant 22. Both point at row 22, so nothing material is at
stake — but an implementer following the wrong pointer reads the wrong table.

---

## Cross-cutting checklist

- **BYOS.** No new code path touches a subscription secret. `packages/shared` names none of
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` in any file, fixture or example — the
  refusal that does name them is register row 1 and belongs to Q-0046.
- **Worktree safety.** No flow behaviour changes and no worktree is created. AC-10 makes
  `.harness/worktrees/` and `.quorum/runs/` single-spelling constants rather than three copies of a
  `path.join`, a small reduction in the ways that invariant can be broken later. Enforcement stays
  in `core`; `shared` supplies values and pure predicates. The implementer works in a worktree on
  `harness/Q-0041/implement`, based on `harness/Q-0041/integration`, which must exist first.
- **Gate behaviour.** Unchanged. AC-8 types the gate *question* as an event payload; how the answer
  travels is OQ-4 and belongs to Q-0050.
- **File formats and their schemas.** **None change.** Every schema here describes a format that
  already exists; nothing rewrites a file, and no criterion causes a byte of `ticket.md`,
  `runs.log`, a flow file, a role file or a manifest to differ.
  `contracts/Q-0011/run-manifest.schema.json` is frozen and is read as evidence, never opened.
- **Lint rules.** `quorum lint` must keep accepting all six flow files in `harness/flows/` and keep
  rejecting exactly what `harness lint` rejects, with the same sixteen messages, in the same order.
  AC-3 and AC-4 are the mechanism; Q-0044 is where the rules themselves land.
- **Cold-clone impact.** One dependency added to an install the adopter already runs. No new
  command, no new step, no output change. Net zero.
- **Product-agnostic.** Nothing here names a SaaS product. The corpus tests read this repository's
  own `harness/`, `backlog/` and `contracts/`, which is Quorum's harness, not a product's.
- **Errors are explicit.** Three criteria are instances rather than gestures. AC-4 bans `.default()`
  and `.catch()` and forbids key stripping, which are the schema layer's two ways of failing
  silently. AC-5 requires the corpus test to fail loudly when its corpus is missing rather than
  reporting a pass over an empty directory — *"a check that skips its subject must not report
  success"* (2026-08-25) applied to this ticket's own tests, since a green tick over nothing is
  exactly how a bottom-of-the-graph package ships a schema nobody checked. The scope section's
  stop-and-report rule is the third.

---

## Provenance

**The Claude candidate supplies the spine, and nearly all of the evidence.** Every specific claim in
it was re-checked against the repository during this merge and survived: the three emitted event
kinds and their exact fields, the six-versus-two contradiction between `04-architecture.md:28` and
`03-adapter-contract.md:32`, the `flow.file` injection at `engine.js:17` and the `lint.js:127` throw
that consumes it, the eight-field history entry, `code-reviewer.md`'s empty frontmatter, the two
unrelated `.harness/` namespaces, `route` linted and never implemented, and the absence of any
`exports` map, `build` task or dependency anywhere in the workspace. Its browser-safety criterion
(AC-2), its lint-implies-parse property (AC-3), its ban on `.default()` (AC-4), its "`STAGES` is a
list, not a state machine" finding (AC-11), its constants inventory (AC-10) and its
`backlog/`-is-not-a-writable-surface note all carry into this document essentially intact. Its
`iterations` claim was extended: the disk also holds bare unprefixed keys such as `review: 2`, not
only the dotted form.

**The Codex candidate contributed four things Claude missed, and all four are kept.** Its AC-4
caught that zod strips unknown keys by default — a silent data-loss hazard on any parse-then-write
path, and the mirror image of the `.default()` risk Claude found; it is now half of AC-4. Its AC-7
demanded that a step's `output` declaration and an agent's structured result be impossible to
confuse, which is a real defect class given how adjacent the two names are; that is now AC-7's
confusion test. Its AC-13 supplied the stop-and-report rule for a corpus that contradicts a schema,
now stated once in Scope and binding on every criterion. And its AC-3 framed the structural/semantic
boundary as a two-sided proof — structural failures reach zod, semantic ones reach lint — which is
sharper than a one-directional property; AC-3 and AC-4 carry both directions.

**Where the two disagreed, I picked.** *On blocking:* Codex marked three questions blocking and
Claude marked none. I resolved all three from evidence in this repository plus dated decisions —
the union's membership (AC-8), the absent transition table (AC-11), legacy history entries (AC-5) —
so none reaches the gate. *On the union:* Codex's AC-11 requires exactly the six documented kinds
and forbids any vendor name in any event. Both halves are rejected: five of the six have no
producer, and `spawn` and `retry` carry `vendor` today, so a blanket prohibition contradicts
behaviour preservation, the 2026-08-22 per-vendor cost decision and a frozen contract that requires
`vendor` in `$defs.usage`. Register row 22's operative reading is recorded in AC-9 so a child's
reviewer does not spend a round rediscovering it. *On testability:* Codex's AC-14 bundles nine
cross-cutting checks into one criterion and is struck as not independently testable; its content is
the checklist section, which is where a checklist belongs.

**Two things were cut from both candidates to hold the size.** The `harness.yaml` config schema
(Claude's OQ-1, defaulted to "yes, here") goes to Q-0043 with `loadProject`, its only consumer at
port time. The run-status and error-category vocabularies (Claude's OQ-6) are not cross-package —
both consumers land in `core` — so they go to `shared` only when a second package needs them. Eleven
criteria on the ticket that thirteen others block on is worth more than owning two more shapes.
