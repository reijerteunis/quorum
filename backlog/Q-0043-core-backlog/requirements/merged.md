# Q-0043 — `core/backlog`: tickets, frontmatter, stages and `loadProject`

*Merged requirement (head-of-product), 2026-08-26. Route: chore (`requirements → chore → human
gate`). Parent: Q-0009. Charter: `harness/port-charter.md`; §6's register row for Q-0043 is
normative, and the invariants inherited are rows 9 and 19. Surfaces: `packages/core` (two new
modules and their tests), `packages/shared` (one additive module and one line in its entry point).
No CLI change and no change under `spike/`.*

## Problem

`spike/src/backlog.js` is 102 lines and it is the only writer of the files this product calls its
database. Every stage transition, every loop counter, every history entry and every per-stage
artifact reaches disk through it, and one function — `renderFrontmatter` — decides the bytes of a
file that thirty tickets, three other children's fixtures and a human reading a diff all depend on.

The exposure is not that the port loses a feature. It is that the port keeps every feature and
changes the bytes. A tidier YAML emitter, a zod parse used one line too eagerly, a validation added
at the read boundary because it looks like rigour — each produces a `ticket.md` that still parses,
still runs, still shows the right stage on the board, and rewrites the frontmatter of every ticket
it touches from then on. The next `git diff` is forty lines of reformatting around the one line that
changed, on a file whose whole purpose is to be read in a diff. Nothing goes red: the spike keeps
the old emitter, and a test ported alongside a mis-ported module agrees with it.

Three instances are verifiable in this repository today, and each has an obvious implementation that
is wrong:

- **The emitter's options are externally observable.** `YAML.stringify`'s default `lineWidth` is 80
  and it folds a long scalar onto a continuation line. The longest `title:` line on disk is exactly
  80 characters — one from the boundary. Passing `lineWidth: 0`, the natural thing to reach for when
  a title wraps oddly, unfolds every long line in the backlog on the next write.
- **A zod parse is not a passthrough.** `ticketSchema.passthrough().parse()` returns a *new* object
  whose declared keys come first and whose unknown keys come last. `backlog/Q-0033-…/ticket.md`
  carries a hand-added `depends_on` between `created` and `iterations`; writing a parsed object back
  moves it to the end.
- **`Backlog` must survive `Object.create`.** `spike/src/engine.js:29–35` implements `--dry` as
  `Object.create(backlog)` with `write`, `writeFile` and `log` stubbed. A TypeScript rewrite that
  makes `root` a `#private` field compiles cleanly, passes every direct test, and makes every
  inherited method throw `TypeError` the first time anyone runs `--dry` — which is Q-0050's problem
  to discover, in a module it did not write.

The second half of the ticket is a different shape. `findProject` and `loadProject` live in the CLI
(`spike/bin/harness.js:46–61`) and are called by six commands, but `docs/04-architecture.md` names
`loadProject(dir)` as part of `core`'s public API and M3's server needs it exactly as much as the
CLI does. This is the clearest instance of the finding Q-0009 records: the spike's module boundary
is not the boundary to reproduce. Lifting it means one thing has to change shape without changing
what a user sees — `loadProject` currently ends in `die()`, which prints and calls `process.exit`,
and a library may not exit its host's process.

## User stories

- **As the maintainer**, when a run advances a ticket I need the diff on `ticket.md` to be the lines
  that changed and nothing else, so reviewing what a run did to my backlog stays a five-second job
  rather than a hunt through reformatting.
- **As the maintainer**, I need `--dry` to keep mutating nothing after the port, because the one
  mechanism that guarantees it is a language feature this rewrite can silently break.
- **As the cold-clone adopter**, I need Quorum to find my project by walking up to
  `harness/harness.yaml` from wherever I am, and to tell me what to do when it cannot, in the same
  sentence it uses today — so the first thing I see when I run it in the wrong directory is a next
  move.
- **As the contributor writing the CLI or the server**, I need `loadProject(dir)` to be a function in
  `core` that returns a value or throws a named error — not one that prints and exits — so the
  server, the CLI and a test can all call it without copying discovery, YAML and path-resolution
  logic.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/backlog.js` — `STAGES` `:6–9`, `parseFrontmatter` `:11–15`, `renderFrontmatter` `:17–19`, `Backlog` `:21–96` (`list` `:26`, `dirOf` `:33`, `read` `:40`, `write` `:46`, `nextId` `:50`, `create` `:55`, `readFiles` `:74`, `writeFile` `:86`, `log` `:93`), private `walk` `:98–102` |
| The lift | `spike/bin/harness.js` — `findProject` `:46–52`, `loadProject` `:54–61`, `die` `:123`; called at `:416` (ticket), `:424` (board), `:463` (lint), `:469` (adapters), `:518` (runs), `:592` (run, spread into `runFlow` at `:602`) |
| The `--dry` wrapper that constrains the class | `spike/src/engine.js:29–35`, `readOnlyBacklog` — `Object.create(backlog)` with three writers stubbed. Q-0050's to port; this ticket must not make it impossible |
| `parseFrontmatter`'s other caller | `spike/src/engine.js:727–732`, `loadRole` — the same function reads `harness/roles/*.md`. It is not a ticket-specific function and must not become one |
| In-package consumers, all later children | `engine.js` — `parseFrontmatter` at `:337`/`:731`, `backlog.write` at `:648`/`:662`, `writeFile` at `:276`/`:284`/`:289`/`:602`/`:1015`/`:1060`, `readFiles` at `:705`, `log` at eleven sites. All Q-0050/Q-0052/Q-0053 |
| Already in `shared`, and not to be spelled twice | `STAGES`, `stageSchema` (`stages.ts`); `ticketSchema`, `ticketHistoryEntrySchema`, `Ticket` (`ticket.ts`); `integrationBranch(id)`, `RUNS_LOG_FILE`, `DEFAULT_BASE_BRANCH` (`constants.ts`) |
| Test helpers Q-0042 shipped | `packages/core/test/repo.ts` (`tempDir`, `write`, `walk`, `removeTempDirs`) and `packages/core/test/corpus.ts` (`repoRoot`, `repoFile`, `coreSourceFiles`) |
| `shared`'s own house rules, which the added module must satisfy | `packages/shared/src/index.test.ts` — `dependencies` is exactly `['zod']`, no source file may name a Node builtin or match `/\bfs\./`, `/\bprocess\./`; `index.ts` holds only lines matching `^export \* from '\./[a-z-]+\.js';$` |
| Where types must not go | Charter §4: the dependency direction is `core → shared` and never the reverse |

Six facts established by running the checks rather than assuming them. The criteria depend on all
six.

1. **Every `ticket.md` in this repository round-trips byte-identically today** — 30 of 30, through
   `parseFrontmatter` then `renderFrontmatter` with `yaml@2.9.0` and no options. Byte fidelity is a
   property that can be tested against the real corpus, not an aspiration.
2. **`YAML.stringify` folds at 80 columns when there is a break opportunity.** The longest `title:`
   line on disk is exactly 80. The option is load-bearing and must be pinned by a test.
3. **`ticketSchema.passthrough().parse()` reorders and returns a new object.** Input
   `id,title,created,depends_on,iterations` comes back as `id,title,created,iterations,depends_on`.
   Any write path that passes through zod reformats the file.
4. **`packages/shared/src/index.test.ts:52–53` pins `packages/core/src/index.ts` byte for byte** to
   `export const name = '@quorum/core';\n`. Adding a re-export there turns a landed test red, and
   chore's `integrate` runs `npm test --prefix spike && pnpm turbo run test` — so the run fails
   *after* the implementer and the reviewer have both been paid.
5. **`nextId()` returns `T-0001` in this repository.** It strips a leading `T-` and `parseInt`s the
   rest, so all 30 `Q-nnnn` ids yield `NaN` and are filtered out. `harness ticket new` here would
   create `T-0001-<slug>` and, if that folder existed, `create()` would overwrite its `ticket.md`
   without a word. A defect to **carry and report**, not to fix (charter §2).
6. **`harness/Q-0043/integration` does not exist.** No branch matches `*Q-0043*`.

## Acceptance criteria

Each is independently testable against throwaway directories the test builds, or against this
repository read-only. No criterion may be satisfied by asserting a fact about this repository that
the next landing changes — the permanent-acceptance-test decision (2026-08-23).

**AC-1 — The two modules exist, export exactly this surface, declare no second stage list, and `packages/core/src/index.ts` is not modified.**
`packages/core/src/backlog.ts` exports `parseFrontmatter`, `renderFrontmatter` and the class
`Backlog`. `packages/core/src/project.ts` exports `findProject`, `loadProject` and the error type
AC-10 names. Both are TypeScript strict with no `any` and no `@ts-ignore`, and neither imports
anything under `spike/`. Neither declares a stage list, a `Ticket` type or a ticket schema: all four
come from `@quorum/shared`. `packages/core/src/index.ts` keeps its exact current bytes;
in-package consumers (Q-0050, Q-0052, Q-0053) import `./backlog.js` and `./project.js` directly, and
the public entry point is assembled by the child that first has a cross-package consumer, or by the
cutover.
*Test:* `Object.keys` over each module's namespace equals the list above; a source-level test over
`coreSourceFiles()` asserts the literal `'qa-passed'` and the identifier `ticketSchema = ` appear in
no file under `packages/core/src/`, so a second vocabulary cannot appear without going red; and
`repoFile('packages/core/src/index.ts')` still equals `export const name = '@quorum/core';\n`,
keeping Q-0041's pin green.

**AC-2 — `parseFrontmatter` accepts exactly what it accepts today, invents nothing, wraps nothing, and stays generic.**
The delimiter match is `/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/`; a match returns
`{ meta: YAML.parse(m[1]) ?? {}, body: m[2] }`. No match returns `{ meta: {}, body: text }` — the
whole file as body, no error. An empty block yields `meta: {}`. When the delimiters are present and
their content is not valid YAML, **`YAML.parse`'s own error propagates unchanged**: it is not caught,
not wrapped and not re-messaged, because the message a command prints is externally observable and
the port preserves it. The function takes and returns text: it is also the reader of
`harness/roles/*.md` (`spike/src/engine.js:727–732`), so it gains **no** ticket-specific typing, no
`Ticket` return type and no validation.
*Test:* a file with no frontmatter; an empty block; a leading blank line or BOM (no match — body is
the whole file); a body containing a `---` line; a closing delimiter with and without a trailing
newline; an empty body; a role file with `adapter`/`paths` frontmatter through the same function;
and malformed YAML asserted to throw `YAML`'s error rather than a wrapped one.
*Carried, not fixed:* the silent no-match fallback contradicts `harness/rules.md`'s "errors are
explicit". Preserved and named in the report (AC-12).

**AC-3 — A ticket written by this writer round-trips byte-identically, and the emitter's options are pinned by test.**
`renderFrontmatter(meta, body)` returns exactly
`` `---\n${stringify(meta).trimEnd()}\n---\n${body.replace(/^\n+/, '')}` ``, where `stringify` is
`yaml`'s with **no options passed**. Leading blank lines of the body are stripped; nothing else about
the body is touched; no trailing newline is added; empty `iterations` and `history` supplied by the
caller are emitted, not omitted; arrays are not reordered and date strings are not coerced to `Date`.
*Test:* three parts. (a) The corpus — for every `backlog/*/ticket.md` in this repository, parse then
render and assert byte equality, with the test failing loudly if it finds no ticket files at all; 30
of 30 pass today, and at least one of them carries non-empty `iterations` and `history`. (b) The
option pin — a title long enough to exceed 80 columns with a space to break on emits a folded
continuation line, so `lineWidth: 0` or any other emitter option fails here rather than in a
backlog-wide diff. (c) A single-field change — set `stage` on a parsed ticket, render, and assert the
diff against the original is that one line, with the Markdown body and every other serialized value
untouched.
*Stated limit, not a promise:* comments inside a frontmatter block and hand-written flow style are
not preserved, and were not before. A file the engine has never written is out of this criterion's
scope; the contract being ported is `YAML.stringify(meta)`, not a surgical YAML editor.
(Register row 9's storage half: nothing here writes a containment field or any other derived state.)

**AC-4 — Reading never validates, never rewrites and never reorders: the object written is the object read.**
`read()` returns `{ dir, folder, meta, body }` where `meta` is the object `YAML.parse` produced —
not a zod output object, not a clone with keys in schema order. `ticketSchema` supplies the static
type and nothing else; no read path calls `parse` or `safeParse`, so a ticket that would fail the
schema still reads exactly as it does today, and a ticket that fails it does not stop a run that
runs today. Unknown keys keep their **position**, not merely their presence.
*Test:* build a ticket whose frontmatter carries an unknown key in the middle (`depends_on`, as
Q-0033's does), read it, write it unmodified, assert byte equality; then change one field and assert
the diff is that field's line alone; then read a ticket whose `stage` is not a member of `STAGES`
and assert it reads without throwing. A source-level test asserts `backlog.ts` contains no
`ticketSchema.parse(` and no `.safeParse(`.
*Typing note:* the parse boundary needs one type assertion, because `YAML.parse` is untyped. One is
acceptable and carries a comment naming why (`parseFrontmatter` validates nothing, by design); `any`
and `@ts-ignore` are not.

**AC-5 — `Backlog` stays `Object.create`-compatible, because `--dry` is implemented with it.**
`root` is a public readonly property; the class declares no `#private` field and no `private`
constructor parameter that compiles to one; its methods live on the prototype or as own properties a
derived object can shadow.
*Test:* construct a `Backlog` over a throwaway backlog, build `Object.create(backlog)` with `write`,
`writeFile` and `log` replaced by no-ops — the exact shape of `spike/src/engine.js:29–35` — and
assert that `read`, `list`, `dirOf`, `nextId` and `readFiles` all still work through the derived
object, and that a `write` through it changes no byte on disk. Plus a source-level assertion that
`backlog.ts` declares no `#` field.
*Why a criterion and not a note:* the failure mode is a run-time `TypeError` in a module Q-0050
writes, on the one path whose whole promise is that it mutates nothing.

**AC-6 — Ticket resolution and listing behave exactly as they do, including the error text.**
`new Backlog(root)` takes an absolute backlog directory. `dirOf(idOrFolder)` tries `<root>/<arg>` as
a path first, then the first `readdir` entry equal to `arg` or beginning with `arg + '-'`, and throws
with the message `ticket not found: <arg>` verbatim. `list()` is non-recursive, includes only
immediate subdirectories containing a `ticket.md`, and returns `[]` when the backlog root does not
exist. `read()` returns `dir` absolute and `folder` as the directory's basename.
*Test:* resolution by full folder name, by id, and by an id with no match (message asserted
verbatim); a backlog root that does not exist; a plain file in the root; a subdirectory without a
`ticket.md`; a ticket nested two levels down that `list()` must not find.
*Carried, not fixed:* the prefix match consults `readdir` order, so two folders sharing an id prefix
resolve non-deterministically. Preserved, not endorsed; named in the report.

**AC-7 — `create()` and `nextId()` write what they write, and both known defects are pinned by test.**
`create({ title, intent, owner?, repos? })` allocates an id, creates `<id>-<slug>/ticket.md` and
returns the ticket. The slug is `title.toLowerCase()`, non-alphanumerics collapsed to `-`, leading
and trailing `-` trimmed, truncated to 40 characters. The body is `intent.trim() + '\n'`.
Frontmatter keys in insertion order: `id`, `title`, `stage`, `owner`, `repos`, `branch`, `priority`,
`created`, `iterations`, `history` — with `stage: draft`, `owner` defaulting to
`process.env.USER ?? 'unknown'`, `repos: []`, `branch` from `shared`'s `integrationBranch(id)`,
`priority: p2`, `created` as `toISOString().slice(0, 10)`, `iterations: {}`, `history: []`.
`nextId()` strips a leading `T-`, `parseInt`s the rest, drops non-finite results, takes one more than
the maximum and zero-pads to `T-nnnn`; an empty or absent backlog yields `T-0001`.
*Test:* create into a throwaway backlog under a controlled `USER` and clock and assert the emitted
file against an expected string; slug cases (punctuation, a title over 40 characters, leading and
trailing junk); and the two defects asserted **as they are**, so a later fix has to be deliberate —
`nextId()` over a backlog holding only `Q-`-prefixed ids returns `T-0001`, and `create()` writes a
`branch` value for which **no git ref is created** and no worktree appears (register row 19; Q-0038
owns the missing ref, and a port that starts creating branches changes behaviour under cover of a
translation).

**AC-8 — The three write paths write what they wrote, and nothing else on disk changes.**
`write(ticket)` replaces `<ticket.dir>/ticket.md` with `renderFrontmatter(meta, body)` and writes
nothing else — no index, no cache, no database, no event stream, no daemon state.
`writeFile(ticket, rel, text)` creates parent directories, appends a trailing newline **only if** the
text lacks one, and returns the absolute path. `log(ticket, line)` appends
`<ISO instant> <line>\n` to `runs.log` (`RUNS_LOG_FILE` from `shared`), creating it, and never
rewrites an existing line.
*Test:* a `walk()` snapshot of the whole backlog root before and after each mutation, asserting the
only path that changed is the intended one; a nested `rel` whose directories do not exist; text with
and without a trailing newline; `writeFile`'s return value; two `log` calls asserted as two lines
matching `^\d{4}-\d{2}-\d{2}T[\d:.]+Z <line>$` with the first unchanged by the second. A separate
snapshot proves `findProject`, `loadProject`, `list`, `dirOf`, `read` and `readFiles` change nothing
at all.

**AC-9 — `readFiles` keeps its glob semantics exactly, because it decides what an adapter is invoked with.**
The directory is `path.dirname(join(ticket.dir, pattern))` and the pattern is its basename; a missing
directory returns `[]`. Only `*` is a wildcard, expanded to `.*`; `?`, `.`, `+`, `^`, `$`, `{}`,
`()`, `|`, `[]` and `\` are escaped and match literally. Basename results are sorted by name; a
pattern ending in `/` walks that subtree recursively and preserves the walk's filesystem order. Every
entry is `{ rel, text }` with `rel` relative to the ticket directory. No broader glob syntax is
introduced.
*Test:* a literal filename; `requirements/candidate-*.md` over three files including one that must
not match; a pattern containing `?` asserted to match a literal `?` and not any character; sort
order; a `dev/` recursive pattern reaching a nested file; no match; a missing directory.
*Why it is load-bearing:* this is the function behind every flow's `input.backlog`
(`spike/src/engine.js:704–705`), so its output is part of what the charter calls externally
observable — what an adapter is invoked with.

**AC-10 — `findProject` and `loadProject` move to `core` with their shape and their sentence intact, and without exiting the process.**
`findProject(start = process.cwd())` resolves `start`, then walks it and each parent looking for
`<d>/harness/harness.yaml`, returning the nearest containing directory as an absolute path or `null`
at the filesystem root. `loadProject(dir?)` resolves an explicit `dir` with `path.resolve` and
otherwise discovers from the current directory — the two branches of `spike/bin/harness.js:55` in one
signature — then returns `{ repoDir, harnessDir, config, backlog }` with `repoDir` and `harnessDir`
absolute, `harnessDir = <repoDir>/harness`, `config` from `YAML.parse(...) ?? {}`, and `backlog` a
`Backlog` rooted at `path.resolve(repoDir, config.backlog?.path ?? 'backlog')`. It creates no
directory and no file. When no project is found it **throws a named error class** whose message is
byte-identical to the sentence the CLI prints today — ``no harness/harness.yaml found — run `harness
init` in your repo`` — so Q-0010 can print it unchanged. Neither function calls `process.exit`,
`console.*` or `die`.
*Test:* discovery from a nested subdirectory, from a relative start path, and from a directory
containing a nested project where the nearest wins; `null` at a root with no project; the four
returned keys; the resolved backlog root for a relative `backlog.path`, an absolute one, and an
absent one; a config file containing only `{}`; the error asserted by class and by exact message;
and a source-level assertion that `project.ts` contains no `process.exit` and no `console.`.
*Carried, not fixed:* the message names `harness init` while the binary will be `quorum` (Q-0010),
and `harness init` hard-codes the literal `backlog` regardless of `config.backlog.path`. Both named
in the report.

**AC-11 — The project config is declared once, in `shared`, and validated nowhere.**
`packages/shared/src/project.ts` declares `projectConfigSchema` — a zod object with every key
optional and unknown keys **preserved**, covering the keys the spike actually reads: `backlog.path`,
`backlog.layout`, `adapters`, `repo.base_branch`, `repo.max_diff_bytes`, `commands.*`, `budget.*` —
and exports `ProjectConfig` as its inferred type. No `.default()` and no `.catch()`: a default here
would hand later children a value the file did not contain, and no test would fail. It is added to
`shared`'s entry point by one line matching that file's existing shape,
`export * from './project.js';`, and imports nothing but `zod`. **`loadProject` does not call it.**
Core imports the type and asserts the parsed YAML to it at the one untyped boundary; it declares no
competing configuration shape of its own.
*Test:* `projectConfigSchema.parse` over the checked-in `harness/harness.yaml` returns an object with
no key added and none removed; a partial config and a config with an unknown top-level key both parse;
`shared`'s existing entry-point and house-rule tests stay green; a type-level test reads
`config.repo?.base_branch`; a source-level test asserts `project.ts` contains no
`projectConfigSchema.parse(` or `.safeParse(`, and that `packages/core/src` declares no schema for
this file.
*Why declared but not called:* one declaration is right — Q-0010's CLI and M3's server both need this
type without importing `core`, and `shared` already ships `flowSchema` and `roleSchema` ahead of
their consumers. Calling it is not: `loadProject` today accepts any YAML and every consumer supplies
its own fallback (`?? 'main'`, `?? 200000`, `?? 'npm test'`), so rejecting a config that loads today
changes what a command prints and its exit code. Validation gets its own decision, taken by whoever
wants the behaviour, not smuggled in with a port.
*Explicitly still true after this ticket:* `budget.per_run_usd`, `budget.per_ticket_usd` and
`backlog.layout` are read by nothing. Typing them does not start enforcing them.

**AC-12 — One new dependency, justified; nothing under `spike/` changes; every defect found is reported.**
`packages/core/package.json` gains `yaml` at the workspace version (`^2.9.0`) — justified in one line
as the emitter whose exact output the ticket format is defined by, and pinned to that version because
AC-3's byte fidelity is a property of that emitter. Nothing else is added; `shared` gains no
dependency. No file under `spike/` is modified or deleted (charter §3, enforced by CI). Lint,
strict typecheck and every existing workspace test stay green. The implementation report at
`dev/implement-report.md` lists every defect and inconsistency found while reading — each with file
and line, each unfixed — and records the cross-cutting checks: BYOS not applicable and no key path
added; worktree safety and gate behaviour unchanged; no lint rule added or changed; no
product-specific knowledge; no new command or required input in the cold-clone path. If a test
exposes a spike defect outside these criteria, implementation stops and reports it rather than fixing
it.
*Test:* the dependency list asserted; the port-freeze guard's branch-scope job green; the report
present and naming at least the five items this requirement already knows about (AC-2's silent
no-match fallback, AC-6's `readdir` order, AC-7's `nextId` and unmade branch, AC-10's stale `harness
init` sentence).

## Non-goals

- **Another child's module.** Engine, fan-out, run history, lint, contracts and adapters are Q-0044
  through Q-0053. In particular `readOnlyBacklog` is Q-0050's to port; this ticket only has to leave
  it possible (AC-5).
- **Stage transitions.** Which flow may consume which stage, what a failed run does to a stage, and
  what a stage means after a backward edge are the engine's and Q-0050's. No transition table, no
  transition predicate, and no change to a ticket's stage except when a caller sets it and calls
  `write`. The stage *vocabulary* already landed in `shared`.
- **Validating a ticket or a config on read**, adding a migration for short history entries, or making
  `ticket.md` reject anything it accepts today.
- **Fixing anything found while reading** — charter §2. The route for a deliberate change is its own
  DECISIONS entry or a dated erratum, accepted before it is implemented. That covers ambiguous prefix
  lookup, `writeFile` path traversal, `readdir` ordering, `nextId` concurrency and the `T-`/`Q-`
  namespace.
- **Creating the ticket's integration branch.** `create()` writes a branch name and nothing makes the
  ref, which is half of why the chore flow cannot run on a ticket's first pass. Q-0038 carries it.
- **Computing, storing or caching containment** (register row 9); creating a branch, worktree or any
  write to the user's working tree (register row 19).
- **Re-exporting from `packages/core/src/index.ts`**, the `quorum` binary, CLI flag handling, terminal
  output, the board's rendering and process-exit behaviour — Q-0010 and the cutover.
  `spike/bin/harness.js` keeps its own copies of `findProject`/`loadProject` until then; the spike is
  not a workspace member and it is the port's only independent witness.
- **A persisted event stream, a lock on a ticket, `--base`, budget enforcement** — Q-0039, Q-0040,
  Q-0050 and the carried M1 items.
- **Replacing the frontmatter representation with a general-purpose Markdown or YAML document editor.**
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace, visual
  node canvas, eval suites, Gemini adapter, desktop shell.

## Open questions

None blocks solutioning; each has a recommendation the implementer can proceed on. The first three
were raised as blocking by one candidate or the other and are decided here.

| # | Question | Decision | Owner |
| --- | --- | --- | --- |
| OQ-1 | Does byte fidelity mean the generated ticket format only, or arbitrary hand-formatted YAML including comments, quoting and custom spacing? (Codex called this blocking.) | **Generated format only.** The contract being ported is `YAML.stringify(meta)`, and it already round-trips all 30 tickets byte-identically. Preserving comments would require retaining the source document or editing surgically — a different writer, and new behaviour. AC-3 states the limit rather than promising fidelity for files the engine never wrote. | decided |
| OQ-2 | Does `Backlog.read` validate with `ticketSchema` and throw on failure? | **No** — AC-4. Zod's parse returns a new, reordered object, which breaks AC-3 on the next write; and a ticket that reads today must still read. The schema types, it does not police. | decided |
| OQ-3 | Is `loadProject` re-exported from `packages/core/src/index.ts`, given `04-architecture.md` names it public API? | **No** — `packages/shared/src/index.test.ts:52–53` pins that file byte for byte, so the re-export turns a landed test red at `integrate`, after both agents have been billed. Every consumer this ticket has is in-package. Same answer as Q-0042's OQ-1, for a stronger reason. | decided; confirm at the gate |
| OQ-4 | Does `loadProject` require `dir`, or default to discovery from the current directory? | **Optional `dir`.** One signature reproduces both branches of `spike/bin/harness.js:55` exactly; a required parameter would force Q-0010 to re-implement the `--project`-absent case. | implementer |
| OQ-5 | Should `log()` take an injectable clock, and should `DEFAULT_BACKLOG_PATH` join `shared`'s constants? | **No to both.** The clock is an API change for a test's convenience; a regex on the ISO prefix is enough. The literal `'backlog'` appears once in this diff, and `constants.ts` exists to kill *second* spellings — Q-0010 adds it when `harness init`'s hard-coded copy arrives beside it. | implementer |

## Risks

- **The byte pin fails at `integrate`, not at review.** Touching `packages/core/src/index.ts` costs a
  full implement-plus-review round before anything says so. AC-1 makes it a test in this ticket's own
  suite, which fails in seconds.
- **A `#private` field passes this ticket and breaks Q-0050's `--dry`.** The suite here is the only
  place it can be caught, because the thing that breaks does not exist yet. AC-5.
- **The corpus test is sharp in both directions.** AC-3(a) goes red if anyone hand-edits a `ticket.md`
  into a shape this writer would not emit. That is the correct signal — the next engine write would
  reformat it — but a reviewer should expect it, and the criterion states its limit.
- **Adding a file to `shared` must obey that package's house rules.** `index.test.ts` asserts the
  dependency lists exactly, forbids Node builtins and `process.`/`fs.` anywhere under `src/`, and
  requires `index.ts` to hold only `export * from './<name>.js';` lines. `project.ts` satisfies all
  three, and `process.env.USER` stays in `core` where it already is.
- **`harness/Q-0043/integration` does not exist.** The chore flow's `review` step diffs against that
  branch and only `integrate` creates it, so the first run fails after the implementer has been
  billed — the $13.86 failure recorded on 2026-08-25. **Create it from `main` before the run**, per
  `02-sdlc-pipeline-spec.md` §5.8.
- **A gate that cannot be answered destroys a proven-green merge.** Q-0040 is open and has cost two
  tickets their merge on consecutive nights. Run this where a human can answer the final gate, and if
  the run dies there, re-perform `integrate` by hand before trusting the branch.
- **Scope drift into the engine.** Eleven of `Backlog`'s call sites are in `engine.js`, and reading
  them to check a signature is one step from porting them. The reviewer should treat any change
  outside `backlog.ts`, `project.ts`, their tests, `packages/shared/src/project.ts`,
  `packages/shared/src/index.ts` and the `package.json` dependency line as unrequested scope.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable read except `USER` in `create()`'s owner default, preserved as-is. No code path, test or example accepts a key. |
| **Worktree safety** | Register row 19 inherited. `Backlog` writes only inside the backlog root it was constructed with; `loadProject` resolves that root and creates nothing. Neither creates, moves or deletes a git ref or worktree. AC-7 pins that `create()` writes a branch *name* and makes no branch; AC-8's snapshot proves the rest. |
| **Gate behaviour** | n/a — this module presents no gate. AC-5 protects the mechanism `--dry` is built on, which is a gate-adjacent safety property. |
| **File format and its schema** | The whole ticket. `ticketSchema`, `stageSchema` and `STAGES` come from `shared` (Q-0041) and are used for typing only; AC-3 pins the bytes, AC-4 pins that nothing rewrites what it read, AC-11 adds the one missing declaration and calls it nowhere. |
| **Lint rules** | None added or changed. The flow lint is Q-0044's. |
| **Containment** | Register row 9's storage half: reading, listing or rewriting a ticket derives nothing about containment and stores nothing — no field, no cache, no `ticket.md` byte. The derivation landed with Q-0042; the board's rendering is Q-0010's. |
| **Cold-clone impact** | Neutral to positive. No new command, no new prompt, one new runtime dependency already in the workspace. AC-10 keeps the "wrong directory" sentence — often the first thing an adopter sees — byte-identical. |
| **Errors are explicit** | Three exceptions are preserved deliberately and named in the report rather than fixed: `parseFrontmatter`'s silent no-match fallback and its unwrapped YAML error (AC-2), and `dirOf`'s order-dependent prefix match (AC-6). AC-10 converts one `process.exit` into a named throw, which is the shape change the lift requires and the only one it makes. |

## Provenance

**Structure and eleven of the twelve criteria follow the claude candidate**, which was already at the
right size (12 criteria) and had done the expensive work: it ran the checks instead of asserting
them. Its five verified facts — the 30/30 corpus round-trip, the 80-column fold against a
80-character `title:` line on disk, zod's key reordering, the `index.ts` byte pin, and `nextId()`
returning `T-0001` here — are the spine of AC-3, AC-4, AC-1 and AC-7, and all five were re-verified
against this repository before merging. AC-5, the `Object.create` criterion, is claude's alone and is
the single most valuable thing in either document: it protects a mechanism in a module this ticket
does not write, and the failure would surface as a `TypeError` on the one path whose whole promise is
that it mutates nothing.

**The codex candidate contributed the discipline and several sharper tests.** Its snapshot-based
"files remain the database" check became AC-8's before/after `walk()`; its controlled clock and
environment for `create()` are in AC-7; its `harness.yaml` round-trip test is in AC-11; its
`findProject` case list (relative start, nested projects, nearest wins) is in AC-10; its explicit
"the corpus test fails if it finds no ticket files" is in AC-3, and is the right instinct — a check
that skips its subject must not report success. Its non-goals list is the more complete of the two
and most of it is carried.

**Three places where the candidates disagree and I picked rather than averaged.**

1. **Validation at the read boundary.** Codex AC-6 requires `Backlog.read` to validate with
   `ticketSchema` and throw naming the file; claude AC-4 forbids any parse on a read path. Claude is
   right, and the evidence is mechanical: `ticketSchema.passthrough().parse()` returns a *new* object
   with unknown keys moved to the end, so validating on read and writing back reformats
   `backlog/Q-0033-…/ticket.md` — the exact failure this ticket exists to prevent. It is also new
   externally observable behaviour: a ticket that loads today would stop a run. Codex's instinct is
   good and its route is wrong; if validation is wanted, it is its own decision, not a line in a
   port.
2. **Wrapping malformed-YAML errors.** Codex AC-3 requires a thrown error "that identifies the input
   as invalid frontmatter". The spike lets `YAML.parse`'s error propagate, and the message a command
   prints is externally observable. AC-2 preserves it unwrapped and reports the gap. The same
   argument kills the idea of typing `parseFrontmatter`'s return as a ticket: it is also the role-file
   reader at `spike/src/engine.js:727–732`.
3. **The public entry point.** Codex AC-1 requires the five functions to be exported from
   `packages/core`'s public entry point. `packages/shared/src/index.test.ts:52–53` pins that file to
   `export const name = '@quorum/core';\n`, and chore's `integrate` runs the whole workspace suite —
   so that criterion fails the run *after* the implementer and the reviewer are both paid, for a
   re-export no consumer needs yet. Claude's OQ-1 answer is adopted as OQ-3 and decided here rather
   than left to the gate to discover.

**One place where I took codex's shape and claude's substance.** Claude AC-11 wanted `ProjectConfig`
as a bare type in `shared`; codex AC-16/17/19 wanted a zod schema in `shared` *and* validation inside
`loadProject`. Codex is right that one declaration beats a hand-written type — `shared` already ships
`flowSchema` and `roleSchema` ahead of their consumers, and Q-0010 and M3 both need this without
importing `core`. Claude is right that validating is a behaviour change. AC-11 takes both: the schema
ships in `shared` with its inferred type, and `loadProject` does not call it.

**On size.** Codex's 24 criteria are roughly three tickets' worth of surface by count, though not by
work: several are restatements of register rows (AC-21 containment, AC-22 worktree safety) or of
policy the charter already binds (AC-7, AC-23, AC-24). Rather than cut them, I folded each into a
criterion that already carries a test — row 9 into AC-3, row 19 into AC-7 and AC-8, the report and
freeze into AC-12 — because a criterion asserting an absence with no test attached is a sentence, not
a check. The merged document is twelve criteria over a 102-line module and a 16-line lift, which is
the right shape for a chore ticket and inside the ten-to-fifteen band.

**Verdict: ready.** The two questions each candidate raised as blocking — byte-fidelity scope
(codex OQ-1) and the read-boundary validation implied by its AC-6 — are decided above on evidence
that is in the repository today, and neither needs the architect to choose. Nothing left open would
change the design.
