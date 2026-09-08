# Q-0059 — `dirOf` accepts a traversing argument and reads outside the backlog root

*Requirement, candidate (claude), run 1. Written against the tree at `main` on 2026-09-08, not
against the ticket body: four of its statements did not survive re-measurement and two of them
change the shape of the work.*

---

## 0. What was measured, and what it corrects

The body was corrected once already, on 2026-09-07, in an *After the cutover* section. Everything
below was re-derived from the code rather than from either layer of it.

| # | The account said | Measured | Consequence |
| --- | --- | --- | --- |
| M-1 | The behaviour is "carried forward deliberately and **pinned by test**" | `Q-0059` appears in exactly **one** production line — `packages/core/src/backlog/backlog.ts:118` — and that line pins the **prefix-match** defect (`readdir` order), not the traversal. No assertion anywhere passes a traversing or symlinked argument to `dirOf`. | **Cheaper than the body implies.** Nothing has to be inverted, weakened or deleted. The fix adds a refusal and removes no pin. |
| M-2 | "The write side named in Q-0043's non-goals is `Backlog.write` (`backlog.ts:137–139`)" | Q-0043's `requirements/merged.md:319` names **`writeFile` path traversal**, and that run's codex candidate spells it out at OQ-4: *"`writeFile(ticket, rel, text)` accepts paths that can resolve outside the ticket directory"*. | **The shape of the work changes.** `write` takes no path — it writes `ticket.md` into `ticket.dir`, which is `dirOf`'s output, so fixing `dirOf` closes it. `writeFile` takes a caller-supplied `rel` and is exposed independently. |
| M-3 | Reachable only through a CLI argument | `writeFile` has **five** engine call sites, every one of them writing an **interpolated, flow-authored path**: `engine/steps.ts:292`, `:304`, `:313` and `engine/composite.ts:272`, `:337`. | The write side is reachable from a flow file today, not only from an id. |
| M-4 | (named nowhere) | **`readFiles` is the read twin and no account of this ticket mentions it.** `engine/prompt.ts:143` passes an interpolated `input.backlog` glob; `readFiles` computes `path.dirname(path.join(ticket.dir, pattern))`, and a pattern ending in `/` hands `walk()` a joined path. A traversing glob reads files from outside the ticket folder **into an agent prompt**. | Scope question, raised as OQ-5 with a recommendation to include it. |
| M-5 | "the `realPath` guard … is one import away" | `realPath` is **module-private** in `run-history/reader.ts:74`. `resolveRunDirectory` is exported but is deliberately **withheld from the barrel** (`run-history.source.test.ts:228`, `packages/cli/src/package.test.ts:416`) and is shaped for a run directory — it returns `null` and requires the directory to exist. | Reuse is a **placement decision**, not an import. See OQ-1; it collides with Q-0074's live subject. |
| M-6 | (unasked) | `fs.readdirSync(dir, { withFileTypes: true })` has lstat semantics: `Dirent.isDirectory()` is **false** for a symlink to a directory. Verified against this repository's own `node_modules/@quorum/cli → packages/cli`. | **The guard cannot break `list()` or `quorum board`.** `list()` never hands a symlinked entry to `read()`. It also means the backlog already carries the asymmetry `reader.test.ts:270` records for run history: the board declines to list a symlinked ticket folder that `dirOf` will happily read. |
| M-7 | (unasked) | `backlog.test.ts:287`, `:308` and `:309` assert `dirOf`'s return value is `path.join(backlog.root, …)`, and `test/repo.ts:19` builds fixtures under an **unresolved** `os.tmpdir()` (`/var/folders/…` on macOS). | Returning the realpath — which is what the precedent does — turns three landed assertions red and changes `ticket.dir` for every consumer. See OQ-2. |
| M-8 | (unasked) | The six shipped flows and their `packages/cli/templates/harness/flows/` copies declare **68** write paths and backlog globs between them, and **not one contains `../`**. | The guard refuses nothing this product ships. AC-12 turns that from an assurance into a test. |
| M-9 | "46 behaviour tests and 14 source tests" | Confirmed: `backlog.test.ts` 46, `backlog.source.test.ts` 14. | The 2026-09-07 correction was right, and is the one figure that was. |

---

## 1. Problem

`Backlog.dirOf` decides which directory a ticket token names, and its first branch is an existence
check on a joined path (`packages/core/src/backlog/backlog.ts:120–125`):

```ts
if (fs.existsSync(path.join(this.root, idOrFolder))) return path.join(this.root, idOrFolder);
```

`path.join` resolves `..` segments — `path.join('/a/backlog', '..')` is `/a`, and `'../..'` is `/`.
So `dirOf('..')` answers with the backlog's parent, `read('../../somewhere')` returns a plausible
`TicketRecord` built from a `ticket.md` anywhere the process can reach, and `write()` on that record
replaces that file. There is no confinement check on any of it, and the caller gets an object rather
than an error. A single-segment **symlink** inside the backlog root passes every string test that
could be written instead, because `path.resolve` does no filesystem work and `statSync` follows
links — the mistake Q-0011's round 1 made and round 2 caught, and which
`run-history/reader.ts:251`'s guard exists to avoid making a second time.

The same primitive is missing in two more places in the same module, and both take their path from a
flow file rather than from a ticket id:

- **`writeFile(ticket, rel, text)`** (`:246–251`) joins `rel` onto `ticket.dir` and **creates parent
  directories** before writing. Five engine call sites (M-3) supply an interpolated flow-authored
  path. This is the function Q-0043's non-goals actually named (M-2).
- **`readFiles(ticket, pattern)`** (`:233–243`) joins the pattern onto `ticket.dir` and either
  `readdir`s the resulting directory or, for a pattern ending in `/`, walks that subtree. Its output
  goes into the prompt an adapter is invoked with (`engine/prompt.ts:143–145`), which Q-0043's
  charter calls externally observable. Named in no account of this ticket (M-4).

**How bad is it today, stated honestly.** Not very, and the ticket body is right that this is the
argument for fixing it cheaply rather than urgently. The one live path where an untrusted string
reaches `dirOf` is `quorum run <flow> <id>`, which passes argv straight to `project.backlog.read`
(`packages/cli/src/run.ts:168`) with no grammar check — `quorum runs <token>` already does better,
routing through `resolveRunDirectory`'s confinement and `parseTicketId`. Flow files are authored by
whoever owns the repository, so the write and read globs are not a hostile input in the v1 product.

**What changes is M3.** `packages/server` will take a ticket id over HTTP (`POST /runs`,
`docs/04-architecture.md:63`), and at that point the read side of the database this product calls
its database accepts a path from a request body. Fixing this before the daemon costs one primitive
and three guards; fixing it after costs the same plus a server surface that has already shipped
without it. Two of the module's own quality pillars are the ones being upheld: *safety by
construction, enforced in `core` and never by convention*, and *errors are explicit — never default
silently* (`.claude/rules/engineering.md`; `docs/04-architecture.md:49`). A traversing token today
gets neither — it gets an answer.

---

## 2. User stories

- **As the `maintainer`**, when I mistype a ticket token — a path from my shell's tab completion, a
  folder from another repository — I want `quorum run` to tell me that is not a ticket in this
  backlog, rather than start a run against a `ticket.md` from somewhere else and move a stage in it.
- **As the `adopter`**, I want the promise that a flow never writes outside the places it says it
  writes to be enforced in `core`, so that trying Quorum on my own repository cannot put a file
  outside the ticket folder because a flow file had a `../` in it.
- **As the `contributor`** writing a flow template or an adapter, I want one function that decides
  whether a path is inside where it belongs, declared once, so that a fourth caller does not get a
  fourth answer — and so that reading `backlog.ts` tells me what the store guarantees.

---

## 3. Surfaces

| Surface | Touched | What |
| --- | --- | --- |
| `packages/core` | **Yes** | `backlog/backlog.ts` — `dirOf`, `writeFile`, `readFiles` — and wherever the confinement primitive is declared (OQ-1). |
| `packages/cli` | No | No command changes. The refusal is `core`'s sentence and the six `die(error.message)` sites render it unaltered, per *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07). |
| `harness/` | No | No flow, role or `harness.yaml` change — unless OQ-4 is taken, and it is recommended it is not. |
| `backlog/` | No | No ticket format change, no frontmatter key. |
| `docs/` | **Yes** | One sentence in `04-architecture.md` §6's safety list (AC-14). |

---

## 4. Acceptance criteria

Each is independently testable. Where a criterion adds a guard, **AC-13 binds it**: the guard is
demonstrated red against the unguarded function before it is trusted green.

### `dirOf` — the read side (the ticket's title)

**AC-1 — a token that is not one path segment is refused before the filesystem is touched.**
`dirOf` refuses `..`, `.`, the empty string, and any token where `token !== path.basename(token)` —
which covers `../x`, `a/b`, a trailing-slash form and an absolute path. The refusal is decided
lexically and **before** any `existsSync`, `readdir` or `realpath` call, so it discloses nothing
about the filesystem and costs nothing. Tested with at least: `'..'`, `'.'`, `''`, `'../secret'`,
`'a/b'`, `'/etc'`, and — on the prefix branch as well as the exact branch — a token that would
otherwise have prefix-matched.

**AC-2 — a name that resolves outside the backlog root is refused, symlink included.** For a token
that survives AC-1, the answer is admitted only if the **real** path of the candidate has the
**real** path of the backlog root as its parent directory. Both sides are resolved; a lexical
comparison alone does not satisfy this criterion. Tested with the three fixtures
`run-history/reader.test.ts:251–290` already establishes for the sibling guard, re-aimed at a
backlog: a single-segment symlink pointing **out** of the root is refused while every lexical clause
passes; a symlink pointing at a **sibling ticket folder** is accepted and resolves to it, which is
the preserved behaviour an aliased backlog depends on; and a backlog root **reached through a
symlink** still accepts its own genuine children, which is the over-refusal a half-resolved
comparison produces.

**AC-3 — the refusal for a genuine miss is byte-identical to today's.** `dirOf('Q-9999')` on a
populated backlog, and `dirOf` of anything on a backlog root that does not exist, both still throw
`ticket not found: <token>`. `backlog.test.ts:310` and `:316` pass unedited. A root that cannot be
resolved at all — it is missing, or a file — reaches that same sentence rather than a resolver
error.

**AC-4 — what `dirOf` returns for an accepted token does not move.** `dirOf('Q-0001-a-ticket')` and
`dirOf('Q-0001')` still answer `path.join(this.root, <folder>)`. `backlog.test.ts:287`, `:308` and
`:309` pass unedited, and `TicketRecord.dir` is the same string it is today for every ticket in this
repository. (This is the deliberate divergence from `resolveRunDirectory`, which returns the
resolved path; see OQ-2 and R-2.)

### `writeFile` — the write side Q-0043's non-goal actually named

**AC-5 — a `rel` that leaves the ticket folder is refused, and refuses before it creates
anything.** The lexical check runs **before** `fs.mkdirSync`, so a refused write leaves the disk
byte for byte as it was — no parent directory outside the ticket folder, and none inside it either.
Tested by snapshotting the tree with `walk()` around a refused call, the shape
`backlog.test.ts:565`'s AC-8 block already uses.

**AC-6 — a nested legitimate path still works exactly as it does today.** `dev/rounds/x.md`,
`requirements/run-1/candidate-claude.md`, `review/chore/run-2/chore-iter-1.md` and every other shape
the shipped flows write are unaffected: parents are created, the trailing newline is added only when
missing, and the absolute path is returned. `backlog.test.ts:581` passes unedited.

**AC-7 — a path that is lexically inside and really outside is refused.** A `rel` reaching through
a symlinked subdirectory of the ticket folder is refused. Because `writeFile` creates what does not
exist, the criterion is on the **deepest existing ancestor** of the target: it is resolved for real
and must be inside the resolved ticket folder. Tested with a symlinked subdirectory pointing outside
the ticket folder, and with a benign symlinked subdirectory pointing at a sibling folder **inside**
it, so the guard is shown to discriminate rather than merely to fire.

### `readFiles` — the read twin (see OQ-5; recommended in scope)

**AC-8 — a traversing glob yields nothing rather than reading outside the ticket folder.** Both
branches are covered: `../../*.md`, and the subtree form `../` which reaches `walk()`. The result is
the empty list, which is what `readFiles` already answers for a directory that is not there
(`backlog.test.ts:675`) — so no caller learns a new failure mode and `engine/prompt.ts` needs no
change.

**AC-9 — the glob semantics do not move.** All six assertions of `backlog.test.ts`'s AC-9 block pass
unedited: `*` is the only wildcard, `?` and the other metacharacters match literally, a trailing `/`
walks the subtree and preserves the walk's own order, everything else sorts by basename.

### The primitive, and everything that must not move

**AC-10 — the confinement primitive is declared exactly once in `packages/core`.** After this
change, `fs.realpathSync` appears in production source behind **one** exported helper, and
`run-history/reader.ts`'s guard reads it rather than declaring a second copy — or, if OQ-1 is ruled
the other way, this criterion is satisfied by the recorded ruling plus one authority line citing it,
and **not** by a silent second declaration. A test asserts the count over `coreSourceFiles()`, in
the shape `backlog.source.test.ts:41` already uses for the stage vocabulary. Rationale: Q-0074 is an
open ticket whose subject is `safe()` declared byte-for-byte twice with 23 call sites between the
two; a third duplicate of a **security** primitive added while that ticket is open is the defect
this repository has just finished measuring.

**AC-11 — nothing else about the module's behaviour changes, and its source pins hold.**
`Backlog` stays `Object.create`-compatible with `write`, `writeFile` and `log` stubbed —
`backlog.test.ts:271`'s AC-5 block passes unedited, and `backlog.source.test.ts:99` still finds no
`#` field. `parseFrontmatter`, `renderFrontmatter`, `list`, `read`, `write`, `nextId`, `create` and
`log` are behaviourally untouched, and the byte-fidelity corpus test over every checked-in
`ticket.md` passes. If the primitive lands as a new exported symbol of `backlog.ts`, the register at
`backlog.source.test.ts:29` is updated **deliberately, with its reason**, rather than loosened;
placing it in its own module leaves that register untouched, which is one argument for OQ-1's
recommended option.

**AC-12 — the guard refuses nothing this product ships.** A test asserts that every `write:`,
`writes:` and `input.backlog` value in `harness/flows/*.yaml` **and** in
`packages/cli/templates/harness/flows/*.yaml` is accepted by the new rule — 68 values today, none
traversing (M-8) — and that the set is read from the files rather than transcribed, so a flow added
later is covered. The mock end-to-end suites (`packages/cli/src/end-to-end.test.ts`,
`src/failure-paths.test.ts`) stay green, which is the criterion that says a real run still writes
what it wrote.

**AC-13 — every clause is demonstrated red before it is trusted green.** For each of AC-1, AC-2,
AC-5, AC-7 and AC-8, the report names the mutation that turns it red and the message it fails with
— the lexical clause removed, the `realpath` clause replaced by a lexical `startsWith`, the guard
moved to after `mkdirSync`. *"A check is not established by reading it"* (2026-08-29), and the
`realpath` clause in particular is the one Q-0049's AC-11 found had no coverage anywhere while three
lexical clauses shadowed it.

**AC-14 — the documents say what the code now guarantees.** `docs/04-architecture.md` §6's safety
list gains one sentence: the backlog store resolves a ticket token to a directory inside its own
root and writes and reads only inside a ticket folder, enforced in `core`. `backlog.ts`'s module
docblock says the same in one line. Q-0043's non-goal is cited as closed by name. No decision entry
is written unless OQ-1 is ruled the way that needs one (GO-1), and no entry is edited.

**AC-15 — the refusal sentence is `core`'s condition and carries no remedy.** Whatever wording OQ-3
settles, it names what was wrong with the token and does not tell anyone what to type — *"A `core`
error names the condition; the remedy belongs to the surface"* (2026-09-07). The token is quoted
back through the module's existing `printable()` helper (`backlog.ts:280`), so a control character
or an ANSI escape in an attacker-supplied token cannot split the message into three lines or colour
the terminal — the nit Q-0080's reviewer found and which this ticket's refusals inherit by
construction rather than by remembering.

---

## 5. Non-goals

1. **The prefix-match non-determinism.** `dirOf`'s second branch consults `readdir` **order**, so
   two folders sharing an id prefix resolve unpredictably. It is preserved and already pinned by the
   authority line at `backlog.ts:117–118`, which this change must leave standing (with its `Q-0059`
   citation corrected only if OQ-3's wording makes it stale).
2. **Q-0060.** `parseFrontmatter` falling open to `{ meta: {}, body: text }` on a damaged or CRLF
   file is a different defect in a different function with its own ticket, and the constraint that
   this function is also the role-file reader is unchanged here.
3. **Validating a ticket on read.** `read()`'s cast stays a cast; `backlog.source.test.ts:85`'s
   AC-4 pins that no read path runs zod, and a reordered copy committed by the next `write()` is
   exactly what that pin exists to prevent.
4. **`nextId` concurrency and the run-level lock.** Q-0039.
5. **Argv and the CLI.** `quorum run` may keep passing an unchecked string; the guarantee belongs in
   `core` so that the CLI and M3's server inherit the same one. Adding a `parseTicketId` check at
   the CLI would be a second, weaker rule in a second place — and would refuse a folder name, which
   `dirOf` legitimately accepts.
6. **A step id's character set.** `steps.ts:292` builds an artifact path from a step id, which the
   linter requires (Q-0055) but does not constrain. Confining `writeFile` covers the consequence;
   constraining the id is the linter's question and is not opened here.
7. **M3's authentication, authorisation or any network surface.** This ticket is what M3 inherits,
   not part of it.
8. **`git` and worktree paths.** `ensureWorktree`, branch names and `.harness/worktrees/` are a
   different confinement question with a different owner.
9. **Anything on the v1 exclusion list**, and no new dependency: the fix is `node:fs` and
   `node:path`, both already imported.

---

## 6. Open questions

**OQ-1 — where the confinement primitive is declared. Owner: gate. Blocking only under option (c).**
`realPath` is module-private in `run-history/reader.ts` and `resolveRunDirectory` is withheld from
the barrel by a landed register (M-5), so this is a placement decision:

| Option | Cost | Decision entry owed |
| --- | --- | --- |
| (a) **A new module inside `backlog/`** — say `backlog/confine.ts`, exporting the resolver and the child check, imported by `backlog.ts` and by `run-history/reader.ts`. | Smallest. Leaves `backlog.source.test.ts:29`'s export register untouched. `run-history` already imports `backlog` (`run-history/writer.ts:26`), and a module importing only `node:fs`/`node:path` does not compromise Q-0049's rule that `reader.ts` links none of the writer. | **No** |
| (b) **Export it from `run-history/reader.ts`** and import into `backlog/`. | Also small, and `backlog.test.ts:23` already imports `TICKET_ID_PATTERN` from that file. But it points the dependency the wrong way — the ticket store would depend on run history — and puts a general path primitive behind a name that says "run history". | No |
| (c) **A new `packages/core/src/` folder** (`fs/`, `paths/`). | Cleanest naming. But `core`'s folders are the port children by a landed ruling — *"`core` is organised in folders named after the port's children"* (2026-08-26), restated at `docs/04-architecture.md:56` — so a ninth folder contradicts it and must not do so silently. | **Yes** |

*Recommendation: (a).* It is the only option that costs neither a decision entry nor a wrong
dependency direction. **If the gate prefers (c), the entry must be written before the chore run** —
see GO-1.

**OQ-2 — does `dirOf` return the resolved path or the joined one? Owner: gate.** The precedent
returns the resolved path deliberately, so that the caller reads from the path that was checked
rather than from the lexical one, which closes a time-of-check/time-of-use window
(`reader.ts:274–287`). Doing the same here turns `backlog.test.ts:287`, `:308` and `:309` red and
changes `TicketRecord.dir` for every consumer — on macOS from `/var/folders/…` to `/private/var/…`
in tests, and through a symlinked checkout in production — which reaches artifact paths, the
`wrote …` events, and run history.
*Recommendation: verify with the realpath, return the joined path.* The window it leaves requires
write access to the backlog root, and anyone holding that can edit `ticket.md` directly; the blast
radius of changing `dir` is the whole engine. Whichever way it goes, AC-4 is written to match and
the reason is recorded in one authority line, because the divergence from the precedent is exactly
the kind of thing a later reader will otherwise "fix".

**OQ-3 — one refusal or two, and what each says. Owner: gate.** Three readings, all defensible:
(i) everything is `ticket not found: <token>`, which discloses nothing but tells an operator who
typed a path nothing either, against *"errors are explicit"*; (ii) a **lexical** refusal gets its
own condition — nothing about the filesystem is disclosed by refusing on the shape of a string —
while a token that exists and resolves outside the root gets `ticket not found`, disclosing nothing
about where the link pointed; (iii) two distinct sentences.
*Recommendation: (ii).* It is the split the precedent's own contract argues for, it keeps AC-3's
sentence untouched for the case that matters most, and it gives the operator the one thing a
"not found" cannot: that what they supplied was not a ticket **token**.

**OQ-4 — should `lintFlow` also refuse a traversing `writes:`, `write:` or `input.backlog`? Owner:
gate. Recommendation: not in this ticket.** Q-0055 settled that the linter may carry a rule with no
engine counterpart, and a lint rule would catch a bad flow before a paid run rather than in the
middle of one. But the enforcement that matters is the engine's, the shipped flows are all clean
(M-8), and the rule touches `core/lint`, both template copies and `lint.test.ts` — which is a second
ticket's worth of surface on a ticket already carrying fifteen criteria. **If it is deferred it is
opened as a ticket at this gate**, not recorded in this one's closing entry: two obligations found
this week lived only inside a closed ticket (GO-3).

**OQ-5 — is `readFiles` in scope? Owner: gate. Recommendation: yes.** It is not in the ticket body
because nobody had measured it (M-4). Leaving it out ships an asymmetry that is hard to defend — the
engine could not *write* outside the ticket folder but could *read* the whole disk into the prompt
an adapter is invoked with — and the guard is the same primitive at the same base, so including it
costs two criteria rather than a second ticket. If the gate excludes it, AC-8 and AC-9 are struck
and a successor is opened here rather than deferred to prose.

**OQ-6 — the word. Owner: gate, one line.** `docs/GLOSSARY.md` defines **containment** (a git
ancestry fact) and does not define **confinement**, which `docs/04-architecture.md:78` and
`06-development-plan.md` already use for this guard. The two must never be read as synonyms. This
ticket does not create the gap — it was crossed before it — but AC-14 puts the word in a numbered
document a third time, so either the term is added to the glossary or the sentence is written
without it. Cheap either way; named so it is a choice.

---

## 7. Risks

**R-1 — a half-resolved comparison over-refuses on this repository's own shape.** `test/repo.ts:19`
builds every fixture under an unresolved `os.tmpdir()`, so comparing a realpathed child against a
lexical root refuses legitimate children on macOS. Both sides are resolved or the guard is wrong;
this is precisely what `reader.test.ts:281`'s aliased-root case exists to catch, and AC-2 requires
its equivalent.

**R-2 — returning the resolved path is a wider change than it looks.** Three landed assertions and
every consumer of `TicketRecord.dir`. See OQ-2; whichever way it is ruled, it is ruled **at the
gate** and not by an implement step choosing while writing.

**R-3 — a refusal that fires before `mkdirSync` is a different fix from one that fires after.** A
guard placed after the parent creation still leaves directories outside the ticket folder on a
refused write. AC-5 asserts the tree is unchanged rather than that the write failed.

**R-4 — a third declaration of the primitive.** The cheap implementation is a second `realPath`
beside the first, and it is exactly Q-0074's open subject. AC-10 forbids it, and OQ-1 is what makes
obeying AC-10 cheap.

**R-5 — the guard's own check must discriminate, not merely fire.** Every symlink criterion has a
benign twin (a sibling alias, a nested symlink inside the folder) so that a guard refusing
everything cannot pass. Q-0071's lesson: showing a guard has a subject proves it fires, not that
each clause does.

**R-6 — `list()` looks like collateral and is not.** Measured (M-6): `Dirent.isDirectory()` is false
for a symlinked directory, so `list()` cannot hand one to `read()` and `quorum board` cannot start
throwing. Stated here because the opposite is the obvious worry and would otherwise be re-derived —
or worse, guessed at.

**R-7 — an implement step cannot write a decision entry.** If OQ-1 is ruled (c), the entry is a
precondition no step on the chore route may satisfy. Fifteen recorded appearances of a loop handed
work no agent in it can perform, of which Q-0062's is the one where the requirement named the hazard
in advance and the run was launched anyway. GO-1 exists so this is the sixteenth avoided rather than
recorded.

**R-8 — this ticket's own body is now the third account of a defect whose earlier accounts were
wrong in two places.** Nothing in §0 was taken from the body or from its 2026-09-07 correction. The
same discipline is asked of the implement step: **do not re-derive the line numbers or the call-site
lists from this document either** — `backlog.ts` has moved twice already (Q-0064 relocated it,
Q-0080 and Q-0112 changed `create` around it), and the register that should be read first is the
file.

---

## 8. Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a. No adapter, no credential, no environment read; `core` reads no environment for anything here (Q-0112's rule holds). |
| **Worktree safety** | Adjacent and reinforcing. This is the same family of properties as *"never write to the user's working tree"*, enforced in `core`. No worktree, branch or ref is created, moved or deleted. |
| **Gate behaviour** | n/a to the code. Four gate obligations below. |
| **File format and schema** | Nothing changes. No frontmatter key, no `harness.yaml` key, no schema in `shared`, no contract. |
| **Lint rules** | OQ-4; recommended out of scope, with the successor opened at the gate if it is deferred. |
| **Cold-clone impact** | None. A stranger never sees these refusals on the happy path, and the first thirty minutes gain no step. The one sentence they could see — a mistyped token — gets shorter to understand, not longer. |
| **Product-agnostic** | Yes. No product name, no example beyond ticket ids. |
| **Public API** | Unchanged. Nothing new reaches `@quorum/core`'s barrel, so `packages/cli`'s `DOMAIN` register and `package.test.ts` are untouched — a name is added there because a command needs it, and no command needs this one. |
| **Turbo inputs** | No new repository read from production source; new tests build their fixtures under `os.tmpdir()`, which `turbo-inputs.test.ts` already excuses by base. Verified against the guard rather than assumed if a new file reads a repository path. |

---

## 9. Gate obligations

**GO-1 — rule OQ-1 before the run, and if the answer is a new `core` folder, land the decision entry
first.** No step on the chore route may write one. If the answer is (a) or (b), no entry is owed and
the ruling goes into the ticket body in one line.

**GO-2 — rule OQ-2, OQ-3 and OQ-5 into the ticket body before the run.** They are the product's
error vocabulary and the ticket's scope; an implement step choosing them produces a change a
reviewer then argues with, which is what the last four tickets' errata were spent on.

**GO-3 — if OQ-4 is deferred, open the successor at this gate.** Not in this ticket's closing entry.
The two obligations found orphaned this week — Q-0090's GA-4 and Q-0100's JSDoc — are the argument,
and Q-0105 is the counter-example that shows it is avoidable.

**GO-4 — verify forced in both environment rows after the merge.** `integrate`'s tick is
worktree-scoped, and a worktree has neither `.harness/worktrees` nor `.quorum/runs`, which is how a
merged and reviewed change has been red on `main` before. `pnpm turbo run test --force --continue`
in the integration worktree and again on `main`, plus `pnpm sweep:git-identity`, and CI green on the
merged commit — the last because Q-0105's own GO-3 was the week's proof that a local verification is
not one.
