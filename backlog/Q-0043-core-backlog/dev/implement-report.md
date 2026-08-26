# Q-0043 — implementation report

*`core/backlog`: tickets, frontmatter, stages and `loadProject`. Chore route, run 1, iteration 1.
Branch `harness/Q-0043/implement`. Charter: `harness/port-charter.md` §2 (behaviour preservation),
§3 (the freeze), §4 (dependency direction), §6 (register rows 9 and 19).*

## Summary

`spike/src/backlog.js` (102 lines) is ported to `packages/core/src/backlog.ts`, and
`findProject`/`loadProject` are lifted out of `spike/bin/harness.js:46–61` into
`packages/core/src/project.ts`. `packages/shared` gains `projectConfigSchema` and its inferred
`ProjectConfig`, declared and called nowhere. `packages/core` gains one dependency, `yaml`.

Behaviour is preserved. The one shape change the lift requires — `die()` becoming a thrown
`ProjectNotFoundError` — carries the CLI's sentence byte for byte, and is authorised by AC-10. One
further change, `findProject` resolving a relative `start`, is also AC-10's and is called out in
full below. Nothing else changed, and **nothing found while reading was fixed** (§2): nine items are
reported at the end, each with file and line.

Verification: `pnpm lint`, `pnpm typecheck` and `pnpm turbo run test --force` are green across all
seven workspace packages — 123 tests in `core`, 96 in `shared`, of which **73 are new**. No file
under `spike/` is modified or deleted.

## What changed, file by file

| File | Status | Lines | What |
| --- | --- | --- | --- |
| `packages/core/src/backlog.ts` | **new** | 236 | The port: `parseFrontmatter`, `renderFrontmatter`, `Backlog` and the private `walk`. Three runtime exports, exactly. |
| `packages/core/src/project.ts` | **new** | 100 | The lift: `findProject`, `loadProject`, `ProjectNotFoundError`. Three runtime exports, exactly. |
| `packages/shared/src/project.ts` | **new** | 93 | `projectConfigSchema` + `ProjectConfig`. Every key optional, unknown keys preserved, no default and no swallowed parse failure. |
| `packages/shared/src/index.ts` | modified | +1 | `export * from './project.js';`, inserted alphabetically, in the one shape `index.test.ts:92` permits. |
| `packages/core/package.json` | modified | +1 | `"yaml": "^2.9.0"`. |
| `pnpm-lock.yaml` | modified | +3 | Mechanically required by the line above — see *One thing to look at* below. |
| `packages/core/src/backlog.test.ts` | **new** | 483 | 37 tests: AC-2 through AC-9 behaviour. |
| `packages/core/src/backlog.source.test.ts` | **new** | 136 | 14 tests: AC-1, AC-4, AC-5, AC-10 and AC-11 as properties of the source; AC-12's dependency list. |
| `packages/core/src/project.test.ts` | **new** | 137 | 12 tests: AC-10 behaviour. |
| `packages/shared/src/project.test.ts` | **new** | 112 | 10 tests: AC-11. |

**Not touched, deliberately:** `packages/core/src/index.ts` (byte-identical — OQ-3),
`packages/core/test/repo.ts`, `packages/core/test/corpus.ts`, `packages/core/src/git.ts`,
`packages/core/src/git*.test.ts`, everything under `spike/`, everything under `backlog/`,
`docs/**`, `harness/**`, `.github/**`.

### One thing to look at

**`pnpm-lock.yaml` is outside the surface the requirement's risk list enumerates.** That list names
`backlog.ts`, `project.ts`, their tests, `packages/shared/src/project.ts`,
`packages/shared/src/index.ts` and "the `package.json` dependency line". The lockfile is not on it,
and I changed it anyway because the dependency line is inert without it: chore's `integrate` runs
`pnpm install --frozen-lockfile`, and so does CI's `workspace` job, both of which fail when
`package.json` and the lockfile disagree. The diff is three lines and nothing else:

```
   packages/core:
     dependencies:
       '@quorum/shared': …
+      yaml:
+        specifier: ^2.9.0
+        version: 2.9.0
```

Generated with `pnpm install --lockfile-only`; no other importer, no resolution change, no new
package downloaded — `yaml@2.9.0` is already in the workspace as `shared`'s devDependency and
`vite`'s transitive one.

## The three rules the requirement identified, and how each is pinned

Each is a header comment in `backlog.ts` and a test that fails if it is broken.

**1 — the emitter runs with no options.** `YAML.stringify(meta)`, nothing else. Tested three ways:
every `backlog/*/ticket.md` in this repository parses-then-renders byte-identically (30 of 30, and
the reader throws loudly rather than passing over an empty corpus); at least one of them carries
non-empty `iterations` *and* non-empty `history`, so the round-trip is not proving fidelity for the
trivial shape only; and a title of 60 + 1 + 30 characters is asserted to emit a folded continuation
line, which is exactly what `lineWidth: 0` would unfold.

**2 — nothing on a read path calls zod.** `read()` performs one type assertion and no parse. The
behaviour test builds a ticket carrying `depends_on` *between* `created` and `iterations` (the shape
`backlog/Q-0033-…/ticket.md` has), reads it, writes it back unmodified and asserts byte equality;
then changes `stage` and asserts the diff is that one line. A source test asserts `backlog.ts`
contains no `ticketSchema.parse(` and no `.safeParse(`, and that `ticketSchema` is imported for its
type only. Separately, `shared`'s own suite now records *why*: `projectConfigSchema.parse` is shown
reordering its input, with a comment naming it as harmless for `harness.yaml` (nothing writes it
back) and fatal for `ticket.md` (something does).

**3 — `Backlog` stays `Object.create`-compatible.** `root` is `readonly root: string` assigned in a
plain constructor; no `#` field, no parameter property. The test builds
`Object.create(backlog, { write, writeFile, log })` — the exact shape of `spike/src/engine.js:29–35`
— and asserts that `read`, `list`, `dirOf`, `nextId` and `readFiles` all still work through the
derived object and that a `write` through it changes no byte on disk. A source test asserts no `#`
field is declared and none is reached for.

## Criteria

| AC | Where it is satisfied, and how it is proved |
| --- | --- |
| **AC-1** | Two modules; `Object.keys` over each namespace equals exactly `[Backlog, parseFrontmatter, renderFrontmatter]` and `[ProjectNotFoundError, findProject, loadProject]`. Source tests assert `'qa-passed'`, `ticketSchema = `, `interface Ticket`/`type Ticket =` and any `spike` import specifier appear in **no** file under `packages/core/src`. `packages/core/src/index.ts` is asserted equal to `export const name = '@quorum/core';\n`, keeping Q-0041's pin green. |
| **AC-2** | Regex, return shapes and the silent no-match fallback are byte-identical to `spike/src/backlog.js:11–15`. Eight cases: well-formed; no delimiters; empty block; leading blank line and BOM (constructed with `String.fromCharCode`, not pasted); a `---` line in the body; closing delimiter with and without a trailing newline; an empty body; a role file through the same function; and malformed YAML asserted to throw `YAMLParseError` — the emitter's own class, unwrapped. `meta` is typed `unknown`, so the function stays generic and gains no ticket-specific typing. |
| **AC-3** | Corpus round-trip, the 80-column fold pin, the single-field diff, empty `iterations`/`history` emitted, array order kept, `created` staying a string, leading body newlines stripped and no trailing newline added. The stated limit (comments and hand-written flow style are not preserved) is in the function's own doc comment. |
| **AC-4** | Unknown key keeps its **position**; a ticket whose `stage` is outside `STAGES` still reads; `dir` absolute and `folder` a basename. One type assertion, carrying a comment naming why. |
| **AC-5** | Above. |
| **AC-6** | `dirOf` by folder, by id, and `ticket not found: Q-9999` asserted verbatim; a non-existent backlog root lists `[]` and refuses with the same sentence; `list()` skips a plain file, a directory without `ticket.md`, and a `ticket.md` two levels down. |
| **AC-7** | `create()` asserted against a full expected file under a faked clock (`vi.setSystemTime`) and a controlled `USER`, restored afterwards. Five slug cases including punctuation, leading/trailing junk, non-ASCII and a 60-character title. Both defects pinned **as they are**: `nextId()` returns `T-0001` over a `Q-`-only backlog, and `create()` writes a branch name while `walk()` proves the folder holds nothing but `ticket.md` — no ref, no worktree, no second directory (register row 19). |
| **AC-8** | `walk()` before/after snapshots around `write`, `writeFile` and `log`; nested `rel`; text with, without and with a doubled trailing newline; `writeFile`'s return value; two `log` lines matched against the ISO-prefix pattern with the first unchanged by the second. A separate snapshot proves `list`, `dirOf`, `read`, `readFiles` and `nextId` change nothing, and another in `project.test.ts` proves the same for `findProject` and `loadProject`. |
| **AC-9** | Literal filename; `candidate-*.md` over three files with the two matches **written in reverse order** so the sort is doing work; `?` asserted to match a literal `?` and not any character; `+ ^ $ { } ( ) \| [ ]` and `.` asserted literal in one filename; `dev/` reaching a nested file; no match; a directory that is not there. |
| **AC-10** | Discovery from a nested subdirectory, from a relative start, and nearest-wins with a project inside a project; `null` at a root with none; the four returned keys; the backlog root for a relative, an absolute and an absent `backlog.path`; `{}`, empty and comment-only config files; the error asserted by class *and* by exact message; source assertions that `project.ts` contains no `process.exit` and no `console.`. The working directory is supplied through `vi.spyOn(process, 'cwd')` rather than by `chdir`, so the suite does not move the interpreter under whatever runs beside it. |
| **AC-11** | `projectConfigSchema` covers `backlog.path`, `backlog.layout`, `adapters`, `repo.base_branch`, `repo.max_diff_bytes`, `commands.{install,test,timeout_ms}` and `budget.{per_run_usd,per_ticket_usd}` — the keys the spike actually reads, established by grepping every `config.` access in `spike/src` and `spike/bin`. Both shipped `harness.yaml` files (this repository's and `init`'s template) parse with no key added and none removed. Partial, empty and unknown-key configs parse; a wrong *type* is refused. `loadProject` does not call it, asserted from both packages. |
| **AC-12** | One dependency, justified in `backlog.ts`'s header and asserted in the source suite. `git diff --name-only main...HEAD -- spike/` is empty. Lint, strict typecheck and every workspace test green. This report. |

## The one shape change beyond the throw, stated plainly

`findProject` now does `path.resolve(start)` before walking. **The spike does not**
(`spike/bin/harness.js:47` walks the argument as given), and with a relative start it would walk
`a/b → a → . → .` and stop at `.` — so the resolved form is unreachable there, because its only
caller passes `process.cwd()`, which is already absolute.

AC-10 requires it in as many words ("resolves `start`", "returning … as an absolute path") and lists
a test for it, so this is not an unregistered behaviour change under §2. **No caller's behaviour
changes**: for every input the CLI can produce, resolved and unresolved are the same string. I am
naming it here rather than burying it because a reviewer comparing the two files line by line will
see a `path.resolve` that is not in the original, and should be able to find the authorisation
without having to ask.

## Defects and inconsistencies found while reading — all carried, none fixed

Per charter §2, each of these is reported and left alone. The first five are ones the requirement
already knew about; the last four I found while reading.

1. **`parseFrontmatter`'s silent no-match fallback** — `spike/src/backlog.js:13`,
   `packages/core/src/backlog.ts:83`. A file whose delimiters are absent or damaged returns
   `{ meta: {}, body: <whole file> }` with no error and no warning, which contradicts
   `harness/rules.md`'s *"errors are explicit"*. A `ticket.md` with a mangled opening delimiter
   reads as a ticket with no `id` and no `stage` rather than as a broken file.
2. **`dirOf`'s prefix match consults `readdir` order** — `spike/src/backlog.js:35`. Two folders
   sharing an id prefix resolve non-deterministically, and the ambiguity is invisible to the caller.
3. **`nextId()` counts only `T-` ids** — `spike/src/backlog.js:51`. It strips a leading `T-` and
   `parseInt`s the rest, so all 30 `Q-nnnn` ids here yield `NaN` and are filtered out. `nextId()`
   returns `T-0001` in this repository, and `create()` would then `mkdirSync … { recursive: true }`
   over an existing `T-0001-<slug>/` and overwrite its `ticket.md` without a word. Pinned by test
   as it is, so a later fix has to be deliberate.
4. **`create()` writes a branch name and nothing makes the ref** — `spike/src/backlog.js:64`. Half
   of why the chore flow cannot run on a ticket's first pass. Q-0038 carries it; register row 19
   says the port must not start creating branches under cover of a translation.
5. **The project-not-found sentence is stale, and `init` disagrees with it** —
   `spike/bin/harness.js:56` names `harness init` where the binary will be `quorum` (Q-0010); and
   `spike/bin/harness.js:397` hard-codes `fs.mkdirSync(path.join(dir, 'backlog'))` regardless of
   `config.backlog.path`, so a config naming a different backlog path yields a project whose created
   directory is not the one `loadProject` resolves. Message preserved byte for byte.
6. **`adapters.<vendor>.retry` documents a key nothing reads.** `harness/harness.yaml:11` and
   `spike/templates/harness/harness.yaml:11` both show `retry: { attempts: 5, base_delay_ms: 5000 }`
   in a commented example, while `withRetry` destructures `{ attempts, baseDelayMs, maxDelayMs }`
   (`spike/src/adapters/index.js:68`). An adopter copying the commented example gets `attempts`
   honoured and `base_delay_ms` silently ignored — the delay stays 5000 by coincidence, and any
   other value they write is discarded. Not fixed: correcting the code changes behaviour and
   correcting the template changes a shipped asset; both need their own ticket. The schema in
   `shared` declares the camelCase keys the code reads, with the mismatch named in its doc comment.
7. **`dirOf` accepts a traversing argument** — `spike/src/backlog.js:34`. The first branch is
   `fs.existsSync(path.join(this.root, idOrFolder))`, so `dirOf('..')` resolves to the backlog's
   parent and `read('../somewhere')` will read a `ticket.md` outside the backlog root entirely.
   Same class as the `writeFile` path traversal the requirement's non-goals already carry, and
   listed here because that non-goal names only `writeFile`.
8. **`parseFrontmatter` requires LF line endings.** The regex is anchored on `^---\n`, so a
   `ticket.md` saved with CRLF never matches and reads as all-body — silently, by defect 1. No file
   in this repository is CRLF; a contributor on Windows could produce one.
9. **`packages/core/src/git.test.ts:235` is flaky, and it is not mine.** The first run of the core
   suite in this worktree failed there: the test snapshots `walk(dir)` around a `containment()` call
   and asserts equality, and git's background maintenance created `.git/objects/maintenance.lock`
   inside the window. The next and every subsequent run passed. Q-0042's file, outside this ticket's
   sanctioned surface, so untouched — but it will go red for someone eventually, and the fix is to
   filter git's own lock files out of the snapshot rather than to widen the assertion.

Nothing above changes behaviour in this diff, and nothing above implies a `docs/DECISIONS.md`
entry — items 6, 7 and 9 want tickets, which is the human's call. Items 1 and 8 are the same defect
seen twice and would want one entry between them if either is ever closed.

## What I deliberately left alone

- **`packages/core/src/index.ts`.** No re-export (OQ-3). `packages/shared/src/index.test.ts:52–53`
  pins that file byte for byte and chore's `integrate` runs the whole workspace suite, so a
  re-export no consumer needs yet would fail the run *after* both agents are paid. Q-0050, Q-0052
  and Q-0053 are in this package and import `./backlog.js` and `./project.js` directly.
- **`'ticket.md'`, left as four inline literals.** The natural tidy-up is a constant, and the
  natural home for it is `shared/constants.ts` — which is outside this ticket's surface, and whose
  own rationale is that it exists to kill *second* spellings across modules. Four copies inside one
  module is the spike's shape and keeps the port comparable line by line. Same reasoning as OQ-5's
  answer for `'backlog'`, which stays a single literal in `project.ts` with a comment saying when it
  should move.
- **No injectable clock for `log()`** (OQ-5). A regex on the ISO prefix is enough, and an API change
  for a test's convenience is an API change.
- **The unused `base` binding in `readFiles`'s recursive branch.** `const base` is computed before
  the `pattern.endsWith('/')` branch that does not use it, exactly as `spike/src/backlog.js:76`
  has it. Moving it below the branch would be invisible and would still be a change to code I was
  not sent to change.
- **`packages/core/test/repo.ts` and `test/corpus.ts`.** Reused as they are; the corpus reader for
  `backlog/*/ticket.md` is local to `backlog.test.ts` rather than added to the shared helper, which
  keeps the diff inside the enumerated surface. `tempDir`'s hard-coded `q0042-` prefix is left alone
  for the same reason — it names a temporary directory and nothing reads it.
- **Stage transitions, containment, branch and worktree creation, `readOnlyBacklog`, the CLI, the
  board's rendering, the event stream, a lock on a ticket, `--base`, budget enforcement.** Q-0038,
  Q-0039, Q-0040, Q-0050 through Q-0053, Q-0010.
- **Validation on read, of a ticket or of a config.** AC-4 and AC-11.

## Cross-cutting checklist (AC-12)

| Concern | This ticket |
| --- | --- |
| **BYOS** | n/a. No adapter, no login, no key path in code, test, fixture or comment. The only environment read is `process.env.USER` in `create()`'s owner default, preserved as-is; the test sets and restores it. |
| **Worktree safety** | Register row 19 held. `Backlog` writes only inside the root it was constructed with; `loadProject` resolves that root and creates nothing, asserted by a before/after snapshot. Neither creates, moves nor deletes a git ref or worktree — `create()` writes a branch *name* and `walk()` proves the folder holds only `ticket.md`. |
| **Gate behaviour** | n/a — this module presents no gate. AC-5 protects the mechanism `--dry` is built on, which is gate-adjacent. |
| **Containment** | Register row 9 held. Reading, listing or rewriting a ticket derives nothing about containment and stores nothing: no field, no cache, no `ticket.md` byte. The derivation is Q-0042's `git.ts`, untouched; the board's rendering is Q-0010's. |
| **Lint rules** | None added or changed. The flow lint is Q-0044's. The ESLint config is untouched. |
| **Product-specific knowledge** | None. No SaaS product is named anywhere in the diff. |
| **Cold-clone impact** | Neutral. No new command, no new prompt, no new required input; one new runtime dependency already resolved in the workspace. The "wrong directory" sentence — often the first thing an adopter sees — is byte-identical. |
| **Errors are explicit** | Three exceptions preserved deliberately and named above: the silent no-match fallback (1), the unwrapped YAML error (AC-2, intentional — the message is externally observable), and `dirOf`'s order-dependent prefix match (2). The one shape change, `die()` → `ProjectNotFoundError`, makes an error *more* explicit rather than less. |
| **Dependency direction** | `core → shared`, never the reverse (§4). `shared/project.ts` imports `zod` and nothing else, and names no workspace package — `shared`'s own house-rule tests still pass. |

## Verification

Run in this worktree, all green:

- `pnpm turbo run lint typecheck test --force` — 21 tasks, 0 cached, all successful.
- `packages/core`: 123 tests across 7 files (63 new). `packages/shared`: 96 tests across 10 files
  (10 new).
- `git diff --name-only main...HEAD -- spike/` → empty. Nothing under `spike/` is modified or
  deleted, which is the question the freeze guard's branch-scope half asks.
- `harness/Q-0043/integration` **exists** — the requirement's fact 6 recorded it as absent, which was
  true when the requirement was written; the pre-run checklist item was performed before this run.

**One thing I could not run: the spike regression suite.** `npm test --prefix spike` fails in this
worktree with `Cannot find package 'yaml'` in all eleven test files, because `spike/node_modules` is
absent and installing dependencies is not available to me here. Every failure is that resolution
error and nothing else — no assertion failed and no test executed. Since no file under `spike/`
changed, the suite is unaffected by this diff; chore's `integrate` runs
`npm install --prefix spike && pnpm install --frozen-lockfile` before
`npm test --prefix spike && pnpm turbo run test`, which is exactly the step this worktree lacks. I
am recording it rather than describing the spike half as green, because a check that skips its
subject must not report success.

## Notes for the gate

- **OQ-3 asked to be confirmed at the gate.** `packages/core/src/index.ts` is untouched and this
  ticket adds no public re-export. Both the core and the shared suites assert it, so the byte pin
  now fails in seconds rather than at `integrate`.
- **OQ-4 and OQ-5 are implemented as the requirement recommends**: `loadProject(dir?)` with `dir`
  optional; no injectable clock, and `'backlog'` left as a single literal in `project.ts` with a
  comment naming Q-0010 as the ticket that will make it a second spelling.
- **No `docs/DECISIONS.md` entry is implied by this work.** AC-10 authorises the one shape change
  and AC-11 the one new declaration; both are recorded in the merged requirement. Items 6, 7 and 9
  in the defect list are candidates for tickets, not for entries.
