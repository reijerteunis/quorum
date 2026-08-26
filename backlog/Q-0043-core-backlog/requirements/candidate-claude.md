# Q-0043 — `core/backlog`: tickets, frontmatter, stages and `loadProject`

*Candidate requirement (product-manager, claude), 2026-08-26. Route: chore (`requirements → chore →
human gate`). Parent: Q-0009. Charter: `harness/port-charter.md` — §6 row Q-0043, invariants
inherited from §2's register: rows 9 and 19. Surfaces: `packages/core` (two new modules and their
tests), `packages/shared` (one additive type module and one line in its entry point). No CLI change:
the `quorum` binary is Q-0010's and `spike/` is frozen.*

## Problem

`spike/src/backlog.js` is 102 lines and it is the only writer of the files this product calls its
database. Every stage transition, every loop counter, every history entry and every per-stage
artifact reaches disk through four functions in it, and one of them — `renderFrontmatter` — decides
the bytes of a file that thirty tickets, three other children's fixtures and a human reading a diff
all depend on.

The maintainer's exposure is not that the port loses a feature. It is that the port keeps every
feature and changes the bytes. A "tidier" YAML emitter, a zod parse used one line too eagerly, a
`Map` where an object was — each produces a `ticket.md` that still parses, still runs, still shows
the right stage on the board, and rewrites the frontmatter of every ticket it touches from then on.
The next `git diff` is forty lines of reformatting around the one line that changed, on a file whose
whole purpose is to be read in a diff. Nothing goes red: the spike keeps the old emitter, and a test
ported alongside a mis-ported module agrees with it.

Three specific instances are already verifiable in this repository, and each has an obvious
implementation that is wrong:

- **The emitter's options are externally observable.** `YAML.stringify`'s default `lineWidth` is 80,
  and it folds a long scalar onto a continuation line. The longest `title:` line on disk today is
  exactly 80 characters — one character from the boundary. Passing `lineWidth: 0`, which is the
  natural thing to reach for when a title wraps oddly, unfolds every long line in the backlog on the
  next write.
- **A zod parse is not a passthrough.** `ticketSchema.passthrough().parse()` on zod 4.4.3 returns a
  *new* object whose declared keys come first and whose unknown keys come last. Q-0033's ticket
  carries a hand-added `depends_on` between `created` and `iterations`; writing a parsed object back
  moves it to the end. Verified by running it.
- **`Backlog` must survive `Object.create`.** `spike/src/engine.js:29–35` implements `--dry` as
  `Object.create(backlog)` with `write`, `writeFile` and `log` stubbed. A TypeScript rewrite that
  makes `root` a `#private` field compiles cleanly, passes every direct test, and makes every
  inherited method throw `TypeError` the first time anyone runs `--dry` — which is Q-0050's problem
  to discover, in a module it did not write.

The second half of this ticket is a different shape. `findProject` and `loadProject` live in the
CLI (`spike/bin/harness.js:46–61`) and are called by six commands, but `docs/04-architecture.md:37`
names `loadProject(dir)` as part of `core`'s public API and M3's server needs it exactly as much as
the CLI does. This is the clearest instance of the finding Q-0009 records: the spike's module
boundary is not the boundary to reproduce. Lifting it means one behaviour has to change shape
without changing what a user sees — `loadProject` currently ends in `die()`, which prints and calls
`process.exit`, and a library may not exit its host's process.

## User stories

- **As the maintainer**, when a run advances a ticket I need the diff on `ticket.md` to be the lines
  that changed and nothing else, so that reviewing what a run did to my backlog stays a five-second
  job rather than a hunt through reformatting.
- **As the maintainer**, I need `--dry` to keep mutating nothing after the port, because the one
  mechanism that guarantees it is a language feature this rewrite can silently break.
- **As the cold-clone adopter**, I need `quorum` to find my project by walking up to
  `harness/harness.yaml` and to tell me what to do when it cannot, in the same sentence it uses
  today, so the first thing I see when I run it in the wrong directory is a next move.
- **As the adapter contributor**, I need `loadProject(dir)` to be a function in `core` that returns a
  value or throws a named error — not one that prints and exits — so the server, the CLI and a test
  can all call it.

## Context the implementer should not re-derive

Cited so that reading the spike is a check rather than a discovery.

| What | Where |
| --- | --- |
| The module | `spike/src/backlog.js` — `STAGES` `:6–9`, `parseFrontmatter` `:11–15`, `renderFrontmatter` `:17–19`, `Backlog` `:21–96` (`list` `:26`, `dirOf` `:33`, `read` `:40`, `write` `:46`, `nextId` `:50`, `create` `:55`, `readFiles` `:74`, `writeFile` `:86`, `log` `:93`), private `walk` `:98–102` |
| The lift | `spike/bin/harness.js` — `findProject` `:46–52`, `loadProject` `:54–61`, `die` `:123`; called at `:416` (ticket), `:424` (board), `:463` (lint), `:469` (adapters), `:518` (runs), `:592` (run, then spread into `runFlow` at `:602`) |
| Its in-package consumers, all later children | `engine.js` — `parseFrontmatter` at `:337` and `:731`, `backlog.write` at `:648`/`:662`, `writeFile` at `:276`/`:284`/`:289`/`:602`/`:1015`/`:1060`, `readFiles` at `:705`, `log` at eleven sites. All are Q-0050/Q-0052/Q-0053 |
| The `--dry` wrapper that constrains the class | `spike/src/engine.js:29–35` — `Object.create(backlog)` with three writers stubbed. Q-0050's to port; this ticket must not make it impossible |
| Its executable statements today | `spike/test/smoke.js:37–63` and `:371–408` (CLI-level, raw-text assertions on the emitted YAML); `spike/test/q0006-engine.js:37–43`, `:60`, `:229–234` (EDGE-11 round-trips a legacy `history` entry); `q0034-dry-run.js:69`; `q0034-chore-preflight.js:80–96`; `q0011-run-history.js:41–42`, `:225` |
| Already in `shared`, and not to be spelled twice | `STAGES` and `stageSchema` (`stages.ts`), `ticketSchema` and `ticketHistoryEntrySchema` (`ticket.ts`), `integrationBranch(id)` and `RUNS_LOG_FILE` (`constants.ts`) |
| Test helpers Q-0042 shipped | `packages/core/test/repo.ts` (`tempDir`, `write`, `walk`, `removeTempDirs`) and `packages/core/test/corpus.ts` (`repoRoot`, `repoFile`, `coreSourceFiles`) |
| Where types must not go | Charter §4: the dependency direction is `core → shared` and never the reverse |

Five facts established while reading, by running the checks rather than assuming them. The criteria
depend on all five.

1. **Every `ticket.md` in this repository round-trips byte-identically today** — 30 of 30, through
   `parseFrontmatter` then `renderFrontmatter` with `yaml@2.9.0` and no options. Byte fidelity is
   therefore a property that can be *tested against the real corpus*, not an aspiration.
2. **`YAML.stringify` folds at 80 columns when there is a break opportunity.** A `title:` line of 94
   characters emits as two lines. The longest on disk is exactly 80. The option is load-bearing and
   must be pinned by a test, not by intention.
3. **`ticketSchema.passthrough().parse()` reorders.** Input `id,title,created,depends_on,iterations`
   comes back as `id,title,created,iterations,depends_on`, in a new object. Any write path that
   passes through zod reformats the file.
4. **`packages/shared/src/index.test.ts:52–53` pins `packages/core/src/index.ts` byte for byte** to
   `export const name = '@quorum/core';\n`. Adding a re-export there turns a landed test red, and
   chore's `integrate` runs `npm test --prefix spike && pnpm turbo run test` — so the run would fail
   *after* the implementer and the reviewer had both been paid. Q-0042 hit this and deferred; see
   OQ-1.
5. **`nextId()` returns `T-0001` in this repository.** It strips a leading `T-` and `parseInt`s the
   rest, so every `Q-nnnn` id yields `NaN` and is filtered out. `harness ticket new` here would
   create `T-0001-<slug>` and, if that folder existed, `create()` would overwrite its `ticket.md`
   without a word. This is a defect to **carry and report**, not to fix (charter §2).

## Acceptance criteria

Each is independently testable against throwaway directories the test builds, or against this
repository's `backlog/` read-only. No criterion may be satisfied by asserting a fact about this
repository that the next landing changes — the permanent-acceptance-test decision (2026-08-23).

**AC-1 — The two modules exist, export exactly this surface, and `packages/core/src/index.ts` is not modified.**
`packages/core/src/backlog.ts` exports `parseFrontmatter`, `renderFrontmatter` and the class
`Backlog`. `packages/core/src/project.ts` exports `findProject`, `loadProject` and the error type
AC-10 names. `backlog.ts` declares **no stage list**: `STAGES` moved to `packages/shared` with
Q-0041 and the board (Q-0010) imports it from there. `packages/core/src/index.ts` keeps its exact
current bytes; in-package consumers (Q-0050, Q-0052, Q-0053) import `./backlog.js` and
`./project.js` directly, and the public re-export waits for the child that first has a cross-package
consumer.
*Test:* `Object.keys` over each module equals the list above; a source-level test asserts the literal
`'qa-passed'` appears in no file under `packages/core/src/`, so a second stage list cannot appear
without going red; and `repoFile('packages/core/src/index.ts')` still equals
`export const name = '@quorum/core';\n`, keeping Q-0041's pin green.

**AC-2 — A ticket written by this writer round-trips byte-identically, and the emitter's options are pinned by test.**
`renderFrontmatter(meta, body)` returns exactly
`` `---\n${stringify(meta).trimEnd()}\n---\n${body.replace(/^\n+/, '')}` ``, where `stringify` is
`yaml`'s with **no options passed**. Leading blank lines of the body are stripped; nothing else about
the body is touched, and no trailing newline is added.
*Test:* two halves. (a) The corpus: for every `backlog/*/ticket.md` in this repository, parse then
render and assert the result equals the file byte for byte — 30 of 30 pass today. (b) The option
pin: a title long enough to exceed 80 columns with a space to break on emits a folded continuation
line, so `lineWidth: 0` or any other emitter option fails here rather than in a backlog-wide diff.
*Stated limit, not a promise:* comments inside a frontmatter block and hand-written flow style are
not preserved, and were not before — a ticket the engine has never written is out of this
criterion's scope. (Register row 9.)

**AC-3 — `parseFrontmatter` accepts exactly what it accepts today, invents nothing, and stays generic.**
The delimiter match is `/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/`. No match returns
`{ meta: {}, body: text }` — the whole file as body, no error. An empty block yields `meta: {}`. The
function takes and returns text: it is also the reader of `harness/roles/*.md`
(`spike/src/engine.js:731`), so it gains **no** ticket-specific typing, no `Ticket` return type and
no validation.
*Test:* a file with no frontmatter, one with an empty block, one with a BOM or leading blank line
(no match — body is the whole file), one whose body contains a `---` line, and a role file with
`adapter`/`paths` frontmatter parsed through the same function.
*Carried, not fixed:* the silent no-match fallback contradicts `harness/rules.md`'s "errors are
explicit". It is preserved and named in the implementation report.

**AC-4 — Reading never validates, never rewrites and never reorders: the object written is the object read.**
`read()` returns `{ dir, folder, meta, body }` where `meta` is the object `YAML.parse` produced —
not a zod output object, not a clone with keys in schema order. `ticketSchema` supplies the static
type and nothing else; no read path calls `parse` or `safeParse`, so a ticket that would fail the
schema still reads exactly as it does today. Unknown keys keep their **position**, not merely their
presence.
*Test:* build a ticket whose frontmatter carries an unknown key in the middle (`depends_on`, as
Q-0033 does), read it, write it unmodified, assert byte equality; then change one field and assert
the diff is that field's line alone. A source-level test asserts `backlog.ts` contains no
`ticketSchema.parse(` or `.safeParse(`.
*Typing note:* the parse boundary needs one type assertion because `YAML.parse` is untyped. One is
acceptable, carrying a comment naming why (`parseFrontmatter` validates nothing, by design); `any`
and `@ts-ignore` are not.

**AC-5 — `Backlog` stays `Object.create`-compatible, because `--dry` is implemented with it.**
`root` is a public readonly property; the class declares no `#private` field and no `private`
constructor parameter that compiles to one; its methods live on the prototype or as own properties
that a derived object can shadow.
*Test:* construct a `Backlog` over a throwaway backlog, build `Object.create(backlog)` with `write`,
`writeFile` and `log` replaced by no-ops — the exact shape of `spike/src/engine.js:29–35` — and
assert that `read`, `list`, `dirOf`, `nextId` and `readFiles` all still work through the derived
object, and that a `write` through it changes no byte on disk. Plus a source-level assertion that
`backlog.ts` declares no `#` field.
*Why this is a criterion and not a note:* the failure mode is a run-time `TypeError` in a module
Q-0050 writes, on the one path whose whole promise is that it mutates nothing.

**AC-6 — Ticket resolution and listing behave exactly as they do, including the error text.**
`dirOf(idOrFolder)` tries `<root>/<arg>` as a path first, then the first `readdir` entry equal to
`arg` or beginning with `arg + '-'`, and throws with the message `ticket not found: <arg>` verbatim.
`list()` is non-recursive, includes only immediate subdirectories that contain a `ticket.md`, and
returns `[]` when the backlog root does not exist. `read()` returns `folder` as the directory's
basename.
*Test:* resolution by full folder name, by id, and by an id with no match (message asserted
verbatim); a backlog root that does not exist; a subdirectory without a `ticket.md`; a nested
directory two levels down that `list()` must not find.
*Carried, not fixed:* the prefix match consults `readdir` order, so two matching folders resolve
non-deterministically. Named in the report.

**AC-7 — `create()` writes the same ten keys, in the same order, with the same defaults — and both of its known defects are pinned by test.**
Folder `<id>-<slug>` where the slug is `title.toLowerCase()`, non-alphanumerics collapsed to `-`,
leading and trailing `-` trimmed, truncated to 40 characters. Body is `intent.trim() + '\n'`.
Frontmatter keys in insertion order: `id`, `title`, `stage`, `owner`, `repos`, `branch`, `priority`,
`created`, `iterations`, `history` — with `stage: draft`, `owner` defaulting to
`process.env.USER ?? 'unknown'`, `repos: []`, `branch` from `shared`'s `integrationBranch(id)`,
`priority: p2`, `created` as `toISOString().slice(0, 10)`, `iterations: {}`, `history: []`.
*Test:* create into a throwaway backlog and assert the emitted file against an expected string with
only `created` matched as `\d{4}-\d{2}-\d{2}`; slug cases (punctuation, a title over 40 characters,
leading/trailing junk); and the two defects, asserted as they are so a later fix has to be
deliberate — `nextId()` over a backlog holding `Q-0011` returns `T-0001`, and `create()` writes a
`branch` value for which **no git ref is created** (Q-0038 owns that; a port that starts creating
branches changes behaviour under cover of a translation).

**AC-8 — The three write paths write what they wrote.**
`write(ticket)` replaces `<dir>/ticket.md` with `renderFrontmatter(meta, body)`. `writeFile(ticket,
rel, text)` creates parent directories, appends a trailing newline **only if** the text lacks one,
and returns the absolute path. `log(ticket, line)` appends `<ISO instant> <line>\n` to `runs.log`,
creating it, and never rewrites an existing line.
*Test:* a nested `rel` whose directories do not exist; text with and without a trailing newline;
`writeFile`'s return value; two `log` calls asserted as two lines matching
`^\d{4}-\d{2}-\d{2}T[\d:.]+Z <line>$` with the first line unchanged by the second.

**AC-9 — `readFiles` keeps its glob semantics exactly, because it decides what an adapter is invoked with.**
The directory is `path.dirname(join(ticket.dir, pattern))` and the pattern is its basename; a
missing directory returns `[]`. Only `*` is a wildcard, expanded to `.*`; `?`, `.`, `+`, `^`, `$`,
`{}`, `()`, `|`, `[]` and `\` are escaped and match literally. Results are sorted by name. A pattern
ending in `/` walks that subtree recursively. Every entry is `{ rel, text }` with `rel` relative to
the ticket directory.
*Test:* `requirements/candidate-*.md` over three files including one that must not match; a pattern
containing `?` asserted to match a literal `?` and not any character; sort order; a `dev/` recursive
pattern reaching a nested file; a missing directory.
*Why it is load-bearing:* this is the function behind every flow's `input.backlog`
(`spike/src/engine.js:704–705`), so its output is part of what the charter calls externally
observable — what an adapter is invoked with.

**AC-10 — `findProject` and `loadProject` move to `core` with their shape and their sentence intact, and without exiting the process.**
`findProject(start = process.cwd())` walks up looking for `<d>/harness/harness.yaml` and returns the
containing directory or `null` at the filesystem root. `loadProject(dir?)` resolves an explicit
`dir` with `path.resolve` and otherwise discovers from the current directory, then returns
`{ repoDir, harnessDir, config, backlog }` with `harnessDir = <repoDir>/harness`, `config` from
`YAML.parse(...) ?? {}`, and `backlog` a `Backlog` rooted at
`path.resolve(repoDir, config.backlog?.path ?? 'backlog')`. It invents nothing else. When no project
is found it **throws a named error** whose message is byte-identical to the sentence the CLI prints
today — ``no harness/harness.yaml found — run `harness init` in your repo`` — so Q-0010 can print it
unchanged. No `process.exit`, no writing to stdout or stderr, from either function.
*Test:* discovery from a nested subdirectory; `null` at a root with no project; the four returned
keys and the resolved backlog root, including a `backlog.path` that is absolute and one that is
relative; a config file containing only `{}`; and the error asserted by class and by exact message,
with a source-level assertion that `project.ts` contains no `process.exit` and no `console.`.
*Carried, not fixed:* the message names `harness init` and the binary will be `quorum` (Q-0010);
`harness init` also hard-codes the literal `backlog` regardless of `config.backlog.path`. Both are
named in the report.

**AC-11 — The project config is typed in `shared` and validated nowhere.**
`packages/shared/src/project.ts` declares a `ProjectConfig` **type** — every key optional, unknown
keys preserved — covering the keys the spike actually reads: `backlog.path`, `backlog.layout`,
`adapters`, `repo.base_branch`, `repo.max_diff_bytes`, `commands.*`, `budget.*`. It is exported from
`shared`'s entry point by one added `export * from './project.js';` line. It performs **no runtime
validation**: `loadProject` today accepts any YAML and every consumer supplies its own fallback
(`?? 'main'`, `?? 200000`, `?? 'npm test'`), so a schema that rejected anything would be new
behaviour. No `.default()` and no `.catch()` — a default here would hand later children a value the
file did not contain, and no test would fail.
*Test:* a type-level test that assigns a partial config and reads `repo?.base_branch`; the existing
`shared` entry-point tests stay green; a source-level assertion that `packages/core/src` declares no
schema of its own for this file, per `docs/04-architecture.md:37`.
*Explicitly still true after this ticket:* `budget.per_run_usd`, `budget.per_ticket_usd` and
`backlog.layout` are read by nothing. Typing them does not start enforcing them.

**AC-12 — One new dependency, justified; nothing under `spike/` changes; every defect found is reported.**
`packages/core/package.json` gains `yaml` at the version already in the workspace (`^2.9.0`) —
justified in one line as the emitter whose exact output the ticket format is defined by, and pinned
to the workspace version because AC-2's byte fidelity is a property of that emitter. Nothing else is
added. No file under `spike/` is modified or deleted (charter §3, enforced by CI). The
implementation report lists every defect and inconsistency found while reading, each with its
file and line, and fixes none of them.
*Test:* the dependency list asserted; the port-freeze guard's branch-scope job green; the report
present at `dev/implement-report.md` and naming at least the five items this requirement already
knows about (AC-3's silent fallback, AC-6's `readdir` order, AC-7's `nextId` and unmade branch,
AC-10's message and `harness init`).

## Non-goals

- **Another child's module.** The engine, the fan-out, run history, lint, contracts and the adapters
  are Q-0044 through Q-0053. In particular `readOnlyBacklog` is Q-0050's to port; this ticket only
  has to leave it possible (AC-5).
- **Stage transitions.** Which flow may consume which stage, what a failed run does to a stage, and
  what a stage means after a backward edge are the engine's and Q-0050's. This ticket owns the
  ticket representation and the store; the stage *vocabulary* already landed in `shared`.
- **Fixing anything found while reading** — charter §2. The route for a deliberate change is its own
  DECISIONS entry or a dated erratum, accepted before it is implemented.
- **Creating the ticket's integration branch.** `create()` writes a branch name and nothing makes the
  ref, which is half of why the chore flow cannot run on a ticket's first pass. Q-0038 carries it.
- **Validating a ticket or a config on read**, adding a migration for short history entries, or
  making `ticket.md` reject anything it accepts today.
- **The `quorum` binary, the board's rendering, and any CLI wiring** — Q-0010. `spike/bin/harness.js`
  keeps its own copies of `findProject`/`loadProject` until the cutover; the spike is not a workspace
  member and it is the port's only independent witness.
- **A persisted event stream, a lock on a ticket, `--base`, or budget enforcement.** Q-0039, Q-0040,
  Q-0050 and the carried M1 items.
- Everything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell.

## Open questions

| # | Question | Recommendation | Owner |
| --- | --- | --- | --- |
| OQ-1 | Does `loadProject` get re-exported from `packages/core/src/index.ts`, given `04-architecture.md:37` names it as public API? | **No** — same answer as Q-0042's OQ-1, and for a stronger reason here: `packages/shared/src/index.test.ts:52–53` pins that file byte for byte, so the re-export turns a landed test red at `integrate`, after both agents have been billed. Every consumer this ticket has is in-package. The public entry point is assembled once, by the child that first has a cross-package consumer or by the cutover. | ruud, at the gate |
| OQ-2 | Does `ProjectConfig` belong in `shared` or stay a local type in `core`? | **`shared`**, additively — the precedent is Q-0042's `containment.ts`, which is types only, and Q-0010's CLI and M3's server both need this type without importing `core`. It is a type, not a schema, so it does not contradict "core declares none of its own". | ruud, at the gate |
| OQ-3 | Do `backlog.ts` and `project.ts` split, or does `loadProject` live beside `Backlog`? | **Split.** `loadProject` reads `harness/harness.yaml`, which is a harness concern, and Q-0044's lint and Q-0049's reader want `harnessDir`/`repoDir` without the store. The charter says the spike's boundaries are explicitly not preserved. | implementer, if the reviewer disagrees |
| OQ-4 | Should `log()` take an injectable clock so tests are deterministic? | **No.** It is an API change for a test's convenience; a regex on the ISO prefix is enough (AC-8). | implementer |
| OQ-5 | Should `DEFAULT_BACKLOG_PATH` join `shared`'s constants? | **No.** The literal `'backlog'` appears once in this ticket's diff, and `constants.ts` exists to kill *second* spellings. Q-0010 adds it when `harness init`'s hard-coded copy arrives beside it. | implementer |

None of these is a blocker: each has a recommendation the implementer can proceed on, and OQ-1 and
OQ-2 are the two the gate should confirm out loud because they bind later children.

## Risks

- **The byte pin fails at `integrate`, not at review.** Touching `packages/core/src/index.ts` costs
  a full implement-plus-review round before anything says so. AC-1 makes it a test in this ticket's
  own suite, which fails in seconds.
- **A `#private` field passes this ticket and breaks Q-0050's `--dry`.** The suite here is the only
  place it can be caught, because the thing that breaks does not exist yet. AC-5.
- **The corpus test is sharp in both directions.** AC-2(a) goes red if anyone hand-edits a
  `ticket.md` into a shape this writer would not emit. That is the correct signal — the next engine
  write would reformat it — but a reviewer should expect it, and the criterion states its limit
  rather than promising fidelity for files the engine never wrote.
- **`harness/Q-0043/integration` does not exist.** Verified: no branch matches `*Q-0043*`. The chore
  flow's `review` step diffs against that branch and only `integrate` creates it, so the first run
  fails after the implementer has been billed — the $13.86 failure recorded on 2026-08-25. **Create
  it from `main` before the run**, per `02-sdlc-pipeline-spec.md` §5.8.
- **A gate that cannot be answered destroys a proven-green merge.** Q-0040 is open, and it has cost
  two tickets their merge on consecutive nights. Run this one where a human can answer the final
  gate, and if the run dies there, re-perform `integrate` by hand before trusting the branch.
- **Scope drift into the engine.** Eleven of `Backlog`'s call sites are in `engine.js`, and reading
  them to check a signature is one step from porting them. The reviewer should treat any change
  outside `backlog.ts`, `project.ts`, their tests, `shared/src/project.ts`, `shared/src/index.ts` and
  the two `package.json` lines as unrequested scope.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable read except `USER` in `create()`'s owner default, which is preserved as-is. No code path, test or example accepts a key. |
| **Worktree safety** | Register row 19 inherited. `Backlog` writes only inside the backlog root it was constructed with, and `loadProject` resolves that root from config — neither creates, moves or deletes a git ref, and neither touches the user's working tree. AC-7 pins that `create()` writes a branch *name* and makes no branch. |
| **Gate behaviour** | n/a — this module presents no gate. AC-5 protects the mechanism `--dry` is built on, which is a gate-adjacent safety property. |
| **File format and its schema** | The whole ticket. `ticketSchema` and `stageSchema` come from `shared` (Q-0041) and are used for typing only; AC-2 pins the bytes, AC-4 pins that nothing rewrites what it read. |
| **Lint rules** | None added or changed. The flow lint is Q-0044's. |
| **Containment** | Register row 9's storage half: reading or listing a ticket derives nothing about containment and stores nothing — no field, no cache, no `ticket.md` byte. The derivation landed with Q-0042; the board's rendering is Q-0010's. |
| **Cold-clone impact** | Neutral to positive. No new command, no new prompt, one new runtime dependency already in the workspace. AC-10 keeps the "wrong directory" sentence — often the first thing an adopter sees — byte-identical. |
| **Errors are explicit** | Two exceptions are preserved deliberately and named in the report rather than fixed: `parseFrontmatter`'s silent no-match fallback (AC-3) and `dirOf`'s order-dependent prefix match (AC-6). AC-10 converts one `process.exit` into a named throw, which is the shape change the lift requires and the only one it makes. |
