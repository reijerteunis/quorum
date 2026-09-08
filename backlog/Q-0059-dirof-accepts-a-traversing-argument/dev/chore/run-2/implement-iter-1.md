# Q-0059 — implement, run 2 iteration 1

The store reads and writes inside its own root. Twelve criteria, the six gate rulings honoured as
written, and every guard shown red before it was trusted green.

**Verdict: `proceed`.** Nothing in the requirement asked for something I am not permitted to do:
GO-1 was ratified at the gate (no decision entry owed for `backlog/confine.ts`), and the one entry
that *would* have been owed — a new top-level `core` folder — is the option OQ-1 explicitly did not
take.

---

## 1. What was built

`packages/core/src/backlog/confine.ts` is the whole of the boundary, 112 lines, importing
`node:fs` and `node:path` and nothing else. It answers AC-1's two questions:

| export | question | how |
| --- | --- | --- |
| `isOneName(token)` | *is this token one name?* | the string alone: not `''`, `'.'`, `'..'`, and `token === path.basename(token)`. No filesystem call. |
| `isFolderIn(root, candidate)` | *does this path resolve directly inside this root?* | both sides through `realpathSync`, components compared, exactly one component deeper, and a directory. |
| `pathInside(folder, rel)` | the same question, **asked of a path that does not exist yet** | lexical clause (the join has already collapsed `..`, an absolute `rel` is refused rather than neutered) plus a filesystem clause over the deepest **existing** ancestor. Returns `path.join(folder, rel)` or `null`. |

Three exports, two questions — the third is the second one asked of a write into a directory nobody
has created, which is what a write path and a glob both are. If the reviewer reads AC-1's *"two
questions and no others"* as *two exports*, that is the line to argue with; the alternative is the
lexical remainder check living in `backlog.ts`, which would put half the boundary outside the module
AC-1 says declares all of it.

**The frame is the backlog root, not `ticket.dir`** (M-9). `dir` is a field on a plain interface, so
`write`, `writeFile`, `readFiles` and `log` each verify the record's folder against the root *before*
touching anything, and only then check the caller's `rel`. Guarding `rel` against an unguarded
`ticket.dir` closes nothing, which is codex risk 6 answered rather than registered.

---

## 2. File by file

### `packages/core/src/backlog/confine.ts` — new, 112 lines

Module docblock states the two questions and why a lexical test cannot make the second one. Four
module-private helpers (`components`, `startsWith`, `realPath`, `deepestExisting`) and the three
exports above. Nothing is cached — `create()` may create the root, so a real path computed once per
`Backlog` is an answer that *was* true. One `Why:` line, naming AC-8's register rather than
transcribing it.

### `packages/core/src/backlog/backlog.ts` — +75 / −14

- **`dirOf`**: lexical refusal first, then `isFolderIn` on the exact branch **and** on the prefix
  branch — that second guard is the one a reader would forget, and AC-2's twin exists for it. Returns
  the **joined** path (OQ-2); the divergence from `resolveRunDirectory`, which returns the resolved
  one, is stated in the method's own JSDoc with the reason (`TicketRecord.dir` reaches artifact paths,
  `wrote …` events and run history, and would move on any symlinked checkout).
- **`write`, `writeFile`, `readFiles`, `log`**: each begins `folderOf(this.root, ticket)`, a
  module-private function that throws `not a ticket folder in this backlog: '<dir>'`. No new class
  member, so `Object.create(backlog)` — the `--dry` shape — is untouched and AC-5's landed pin passes
  unedited.
- **`writeFile`**: `pathInside` first, `mkdirSync` after. A refused write creates nothing on either
  side of the boundary; mutation M5 below shows what the other order costs.
- **`readFiles`**: refuses rather than returning `[]`, with the reason in the JSDoc. Every accepted
  pattern takes byte-identical paths to before — `pathInside` returns exactly the `path.join` the old
  code computed, so the trailing-slash walk branch, the basename regex and the `rel` relativisation
  are unchanged.
- Three refusal sentences exactly as AC-9 fixes them, every quoted value through the existing
  `printable()` helper.
- Module docblock gains one paragraph naming the boundary and citing Q-0043's non-goal as closed.

### `packages/core/src/backlog/backlog.test.ts` — +337

Six new describes: AC-2 (lexical refusals, refused *before* `fs` is touched, the prefix-branch twin,
the control-character case), AC-3 (escaping symlink, sibling-alias twin, aliased-root twin, the
`/x/backlog-old` sibling-name case), AC-5 (a forged record and a symlinked forged record refused by
all four, with the tree snapshotted on **both** sides, plus the twin over `read`/`list`/`create`),
AC-6 (climbing, absolute and symlinked destinations and patterns, plus the twins that carry the
weight), and AC-10.

**The symlink fixtures probe rather than assume** (R-7): `NO_SYMLINKS` attempts one link once, and a
test skips *only* when the operating system refuses to stage it, naming what could not be staged.
On this machine none skipped — the mutations below prove they executed.

**AC-10 reads the flows rather than transcribing them**: it walks both flow directories, parses each
file, collects every `write`, `writes` and `input.backlog` value at any depth (so `parallel:` groups
and fan-out `step:` templates are included), and fails loudly if a directory holds no flow or a flow
yields no value. Every one is accepted by both `writeFile` and `readFiles`.

### `packages/core/src/backlog/backlog.source.test.ts` — +41

AC-8's register: `fs.realpathSync` may appear in exactly `backlog/confine.ts` and
`run-history/reader.ts` across **both** packages' production source, each row carrying why it is
separate — the run-history guard requires the directory to exist, returns the resolved path and
answers `null`, none of which `dirOf` may do, and its own JSDoc carries Q-0092 OQ-1 against
publishing a path-returning confinement function. A third declaration fails. A second test asserts
the other direction: `backlog.ts` declares no resolver of its own and reaches the boundary through
`./confine.js`. Q-0043's own pins are untouched.

### `packages/core/turbo.json`, `packages/core/src/turbo-inputs.test.ts` — +4, +36

Q-0072's guard refused this change **nine times** on the way in, which is the machinery working:
two read bases in `confine.ts`, its `'..'` literal, four escaping literals in the new tests plus
their keys in the guard's own file, the `repoRoot → relative` route, four new read bases, and the
`packages/cli/src` walk. All registered with reasons.

**One cost the reviewer should rule on**: AC-8 claims something about `packages/cli`, so the register
reads it, so `@quorum/core#test` now declares `../../packages/cli/src/**` as an input — a CLI source
edit invalidates core's test cache. The alternative was splitting the register across two packages,
which cannot fail on a third declaration as one register. I took the declaration; over-declaring
costs a re-run, and this task's verdict genuinely depends on those files.

### `docs/04-architecture.md`, `docs/GLOSSARY.md` — AC-12 and GO-4

Principle 6's safety list gains one sentence. The glossary gains **Confinement** as its own term,
written so it can never read as a synonym for **Containment** — *"near-homographs for unrelated
questions, and neither is ever used for the other"* — and naming both confined roots. Status line
bumped.

**Not touched: the term lists in `CLAUDE.md` and `docs/README.md`.** GO-4 asks for the glossary term
only. `docs.test.ts` compares those two lists *to each other* rather than to the glossary, and
`CLAUDE.md` is the human's to write (Q-0103 E-2) — adding the term to `docs/README.md` alone would
turn that check red. The glossary already carries about a dozen terms the two lists do not.

---

## 3. Verification

`pnpm install --frozen-lockfile`, then `pnpm turbo run test lint typecheck --force --continue`:
**21/21 tasks, 0 cached, all green** — core 1364 passed / 2 skipped (both pre-existing), cli 606,
shared 158, and the four scaffold packages. `pnpm sweep:git-identity` green. `pnpm turbo run build`
then `pnpm exec quorum board` renders all 60-odd real tickets through the changed `dirOf`/`list`
path, and `pnpm exec quorum run chore ../../etc --dry` refuses through the built binary with
`✗ Error: not a ticket token: '../../etc' — a ticket is one folder directly under the backlog root`.

### AC-12 — every clause demonstrated red, with the message it failed with

| # | mutation | red | message |
| --- | --- | --- | --- |
| M1 | the lexical clause removed from `dirOf` | 3 | `expected 'ticket not found: ' to be "not a ticket token: ''…"` |
| M2 | the `realpath` clause replaced by the unresolved paths in `isFolderIn` | 2 | `expected null to be 'ticket not found: Q-0009-alias'`; `write: expected null to be 'not a ticket folder…'` |
| M3 | components replaced by a whole-string prefix (R-5) | **1** | `expected null to be 'not a ticket folder in this backlog: …'` — the sibling-named-root case alone |
| M4 | `log` reverted to `ticket.dir` | 2 | both name `log:` in the failure |
| M5 | the refusal moved after `mkdirSync` (R-3) | 2 | `+ "Q-0001-a-ticket/etc"` **and** `+ "deeper"` — a directory created *outside* the backlog root through the symlink |
| M6 | a third `fs.realpathSync` added to `list()` | 2 | register: `+ "packages/core/src/backlog/backlog.ts"` |
| M7 | `readFiles` returning `[]` instead of refusing (OQ-5) | 2 | `expected null to be 'not a path inside the ticket folder: …'` |

M2 is the clause Q-0049 AC-11 found had **no coverage anywhere** while three lexical clauses shadowed
it; it now has two independent failures. M3 is recorded as *discriminating*: 62 of 63 tests stayed
green. A blunter mutation of `components` to `[target]` turned thirty-odd tests red, which proves the
code has a subject and says nothing about R-5, so it is not offered as the demonstration. M5 is the
one worth reading twice — the wrong order does not merely throw late, it creates a directory outside
the root through a link, which is exactly the distinction R-3 asks for.

---

## 4. Named behaviour changes

Four, three of them named by the requirement and one of them mine.

1. **`dirOf('/Q-0001')` is refused** where `path.join` used to neuter the leading slash. AC-2 names it.
2. **An absolute `rel` or pattern is refused** by `writeFile` and `readFiles`. AC-6 names it.
3. **`readFiles(ticket, '.')` and `readFiles(ticket, '')` are refused.** Both used to `readdir` the
   backlog root's *parent* and return `[]` — a read outside the root that disclosed nothing, which is
   why nobody noticed. Follows from `pathInside` requiring the target to be *strictly* below the
   folder; no shipped flow declares either.
4. **A *file* whose name looks like a ticket id is no longer returned by `dirOf`.** This one the
   requirement does not name and it is my judgement, pinned by a test rather than left to be found.
   `existsSync` admitted it and `read()` then died on `ENOTDIR` one line later; AC-5 requires
   `ticket.dir` to be a **directory** directly inside the root, so the alternative was two
   near-identical predicates — one for `dirOf` and one for records — and a store that hands out a
   value its own writers refuse. Now `ticket not found: Q-0002`. If the reviewer reads AC-3's *"the
   real path of the candidate has the real path of the root as its parent"* as exhaustive rather than
   necessary, this is the line to strike, and striking it costs a second predicate.

---

## 5. Outside the requirement, and why

**I added a development-plan bullet for Q-0113** (`docs/06-development-plan.md`, +10 lines). No
criterion asks for it. The reason it is here: `packages/shared/src/plan-backlog.test.ts` was **red on
the branch base** — *"docs/06-development-plan.md names no entry for Q-0113 — a ticket exists in
backlog/ and the plan does not know"* — so `integrate` would have failed whatever I wrote. Q-0113 is
the successor **this ticket's own GO-2** opened at the gate, the failing assertion names the remedy,
and `docs/` is inside my paths. The bullet is factual and short: what the defect is, that Q-0059's
engine guard means nothing is unguarded while it waits, the three instruments its body weighs, and
the dependency. Q-0094 E-3(a) records that this page's bullets are rewritten by hand at each plan
pass, so the wording is the human's to replace — what it must not do is stay absent.

---

## 6. Reported, not fixed

- **`ticket not found: <token>` does not escape control characters.** AC-9 and OQ-3 rule that sentence
  unchanged and AC-4 pins it byte for byte, so a single-name token carrying a newline still splits the
  message into three lines. Unchanged from before this ticket; the new sentences all escape.
- **`readFiles` still reads *through* a symlinked file inside a ticket folder.** AC-6 scopes the
  criterion to the **base** of each branch — the `readdir` directory and the walk root — and both are
  now resolved. A symlinked *file* below an accepted base is followed by `readFileSync` as it always
  was. Stated because the opposite would be assumed from "confinement".
- **`quorum run` prints a stack trace for a `core` refusal.** The new sentence renders exactly as the
  pre-existing `ticket not found` does — `✗ Error: …` followed by frames — because that command
  carries Q-0090's `e.stack` behaviour. Verified side by side through the built binary; not this
  ticket's surface.
- **A pre-existing ESLint warning** at `backlog.ts:310`, *"Unused eslint-disable directive
  (no problems were reported from 'no-control-regex')"*. Proved pre-existing by linting the base
  version of the file beside mine: both report it, at their own line numbers. `lint` exits 0.
  Engineering rules say report rather than migrate in passing.
- **Time-of-check/time-of-use** is open by non-goal 7, and `list()`'s silent skip of a symlinked entry
  (M-6) is left exactly as it was.

## 7. Deliberately untouched

The prefix-match `readdir` non-determinism (non-goal 1, its authority line still standing);
Q-0060's `parseFrontmatter`; validation on read — `backlog.source.test.ts`'s no-zod pins pass
unedited; `parseTicketId` at the CLI; `run-history/reader.ts`, which OQ-1 rules is not refactored;
`packages/cli`, which needed no change because the six `die(error.message)` sites render `core`'s
sentence unaltered; `harness/`, `backlog/` and `docs/decisions/`; and the flow-lint rule, which is
Q-0113's.
