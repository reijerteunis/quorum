# Q-0059 — The backlog store reads and writes only inside its own root

*Merged requirement, run 1, iteration 1. Written against the tree at `main` on 2026-09-08. Every
measurement below was re-derived from the code; nothing was taken from the ticket body, from its
2026-09-07 correction, or from either candidate without checking it.*

---

## 0. What was measured

The ticket body has been corrected once already. Both candidates re-measured it, and one of them was
right about most of what it found. This section records what survived a third reading, including two
corrections to the candidate that made the running.

| # | The account said | Measured | Consequence |
| --- | --- | --- | --- |
| M-1 | The traversal is "carried forward deliberately and **pinned by test**" | `Q-0059` appears in exactly **one** production line — `backlog.ts:118` — and that line pins the **prefix-match** defect (`readdir` order), naming this ticket only as carrying "the traversal twin". No assertion anywhere passes a traversing or symlinked argument to `dirOf`. | Cheaper than the body implies: nothing is inverted, weakened or deleted. The change adds refusals and removes no pin. |
| M-2 | The write side is `Backlog.write` (`:137–139`) | Q-0043's non-goal names **`writeFile`**. `write` takes no path at all — it writes `ticket.md` into `ticket.dir`, which is `dirOf`'s output. `writeFile(ticket, rel, text)` takes a caller-supplied `rel` and creates parents. | Both accounts are half right, and **both are the wrong frame**. See M-9. |
| M-3 | Reachable only through a CLI argument | **Confirmed for the read side, and it is one call site**: `packages/cli/src/run.ts:168` passes argv straight to `project.backlog.read` with no grammar check, while `quorum runs <token>` already routes through `parseTicketId` and `resolveRunDirectory`. | The read side is the token surface, and it is the surface M3 exposes over HTTP. |
| M-4 | (named nowhere before candidate-claude) | **`readFiles` is the read twin.** `engine/prompt.ts:143` passes an interpolated `input.backlog` glob; `readFiles` computes `path.dirname(path.join(ticket.dir, pattern))` and either `readdir`s it or hands `walk()` a joined path. A traversing glob reads files from outside the ticket folder **into the prompt an adapter is invoked with**. | In scope. Ruled at OQ-5. |
| M-5 | "the `realPath` guard … is one import away" | `realPath` is **module-private** at `reader.ts:74`. `resolveRunDirectory` is exported from its module but **withheld from the barrel** by two landed registers (`run-history.source.test.ts:228`, `packages/cli/src/package.test.ts:416`), and its own JSDoc carries a landed ruling (Q-0092 OQ-1) **against** publishing a path-returning confinement function for a caller to use before reading. Its semantics also differ: it requires the directory to exist, returns the **resolved** path, and answers `null`. | Reuse is a placement decision, not an import. Ruled at OQ-1. |
| M-6 | (unasked) | `readdirSync(dir, { withFileTypes: true })` has **lstat** semantics: `Dirent.isDirectory()` is false for a symlink to a directory. | `list()` can never hand a symlinked entry to `read()`, so **the guard cannot break `list()` or `quorum board`.** The backlog already carries the same asymmetry `reader.ts:111–113` records for run history, and it stays. |
| M-7 | (unasked) | `backlog.test.ts:287`, `:307` and `:308` assert `dirOf`'s answer is `path.join(backlog.root, …)`, and `test/repo.ts:19` builds fixtures under an **unresolved** `os.tmpdir()` (`/var/folders/…` on macOS). | Returning the realpath turns three landed assertions red and changes `TicketRecord.dir` for every consumer. Ruled at OQ-2. |
| M-8 | (unasked) | The six shipped flows and their six `packages/cli/templates/harness/flows/` copies declare **68** write paths and backlog globs between them, and **not one contains `../`**. | The guard refuses nothing this product ships. AC-10 turns that from an assurance into a test. |
| M-9 | "`Backlog.write` is confined **if confirmed in scope**" (codex AC-9), and separately "a caller can construct a `TicketRecord` directly and bypass the read-side guard" (codex risk 6) | Both are true and they answer each other. `write`, `writeFile`, `readFiles` **and `log`** all take their base from `ticket.dir`, a field on a plain interface. Guarding `rel` against `ticket.dir` while leaving `ticket.dir` unguarded closes nothing. | **The boundary is the backlog root, not the ticket folder.** This is the merge's central decision; it collapses codex OQ-1 and closes its own risk 6. |
| M-10 | "`writeFile` has **five** engine call sites" | **Six**: `engine/steps.ts:292`, `:304`, `:313`, `:364` and `engine/composite.ts:272`, `:337`. The missing one is `:364`, the `script` step's `write:` — flow-authored like the rest. | Correction to candidate-claude M-3. It does not change the design; it changes the census an implementer will re-derive. |
| M-11 | (unasked) | `fanout/` is pinned as *"exactly the two files"* (`fanout.source.test.ts:44`) and `run-history/` as *"exactly the three files"* (`run-history.source.test.ts:61`). **`backlog/` carries no such pin**, and its barrel test filters `symbol in barrel` over `backlogModule` and `projectModule` only. | A new module inside `backlog/` costs **no** register edit. This, rather than the export-list argument alone, is what makes OQ-1's recommended option free — and it is why the primitive may not go in `run-history/`. |
| M-12 | "46 behaviour tests and 14 source tests" | Confirmed: `backlog.test.ts` 46, `backlog.source.test.ts` 14. `backlog.test.ts`'s AC-8 block already snapshots the tree with `walk(backlog.root)` around a write. | The non-mutating-refusal shape AC-5 needs already exists in the file. |

---

## 1. Problem

`Backlog` is the only reader and writer of the files this product calls its database, and **not one
of its five filesystem methods checks that the path it is about to touch is inside the backlog
root.**

`dirOf` decides which directory a ticket token names, and its first branch is an existence check on
a joined path (`packages/core/src/backlog/backlog.ts:120–125`):

```ts
if (fs.existsSync(path.join(this.root, idOrFolder))) return path.join(this.root, idOrFolder);
```

`path.join` resolves `..`, so `path.join('/a/backlog', '..')` is `/a`. `dirOf('..')` answers with the
backlog's parent, `read('../../somewhere')` returns a plausible `TicketRecord` built from a
`ticket.md` anywhere the process can reach, and `write()` on that record replaces that file. The
caller gets an object rather than an error.

**A lexical check alone does not close it.** `path.resolve` does no filesystem work and `statSync`
follows links, so a single-segment symlink inside the backlog root passes every string test that
could be written instead. That was Q-0011's round-1 mistake, caught by round 2, and it is why
`reader.ts:200–219` resolves both sides for real. This ticket must not make it a third time.

Two more functions take a path and check nothing, and both take it from a flow file rather than from
a ticket id:

- **`writeFile(ticket, rel, text)`** (`:246–251`) joins `rel` onto `ticket.dir` and **creates parent
  directories** before writing. Six engine call sites (M-10) supply an interpolated, flow-authored
  path. This is the function Q-0043's non-goal named.
- **`readFiles(ticket, pattern)`** (`:233–243`) joins the pattern onto `ticket.dir` and either
  `readdir`s the result or, for a pattern ending in `/`, walks that subtree. Its output goes into the
  prompt an adapter is invoked with (`engine/prompt.ts:143–145`), which the port charter called
  externally observable. Named in no account of this ticket before this run (M-4).

And underneath all three, `ticket.dir` is a field on a plain interface. Guarding `rel` against
`ticket.dir` while leaving `ticket.dir` unguarded closes nothing, which is the finding that decides
the shape of this ticket (M-9).

**How bad is it today, stated honestly.** Not very, and that is the argument for fixing it cheaply
rather than urgently. The one live path where an unchecked string reaches `dirOf` is
`quorum run <flow> <id>` (`packages/cli/src/run.ts:168`). Flow files are authored by whoever owns the
repository, so the write and read globs are not a hostile input in the v1 product.

**What changes is M3.** `packages/server` takes a ticket id over HTTP (`docs/04-architecture.md:63`),
and at that point the read side of this product's database accepts a path from a request body.
Fixing it before the daemon costs one primitive and four guards; fixing it after costs the same plus
a server surface that has already shipped without it. Two of this repository's own rules are what is
being upheld: *safety by construction, enforced in `core` and never by convention*, and *errors are
explicit — never default silently*. A traversing token today gets neither. It gets an answer.

---

## 2. User stories

- **As the `maintainer`**, when I mistype a ticket token — a path from shell completion, a folder
  from another repository — I want `quorum run` to tell me that is not a ticket in this backlog,
  rather than start a run against a `ticket.md` from somewhere else and move a stage in it.
- **As the `adopter`**, I want the promise that a flow writes only where it says it writes to be
  enforced in `core`, so that trying Quorum on my own repository cannot put a file outside a ticket
  folder, or read my home directory into an agent's prompt, because a flow file had a `../` in it.
- **As the `contributor`** writing a flow template, an adapter or M3's server, I want the store's
  boundary declared once and stated in one sentence, so that a sixth caller does not get a sixth
  answer and so that reading `backlog.ts` tells me what the store guarantees.

---

## 3. Surfaces

| Surface | Touched | What |
| --- | --- | --- |
| `packages/core` | **Yes** | `backlog/backlog.ts` — `dirOf`, `write`, `writeFile`, `readFiles`, `log` — and a new `backlog/confine.ts` holding the primitive (OQ-1, ruled). |
| `packages/cli` | No | No command changes. The refusal is `core`'s sentence and the six `die(error.message)` sites render it unaltered, per *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07). |
| `harness/` | No | No flow, role or `harness.yaml` change. The lint rule is out of scope (OQ-4). |
| `backlog/` | No | No ticket format, no frontmatter key, no schema in `shared`, no contract. |
| `docs/` | **Yes** | One sentence in `04-architecture.md` §6's safety list, and one glossary line if GO-4 takes that option. |
| `packages/core/src/run-history` | **No** | Deliberately untouched. See AC-7 and OQ-1. |

---

## 4. Acceptance criteria

Twelve criteria. **Every guard criterion carries its own benign twin**: a fixture that must still be
*accepted*. Q-0071's rule is that showing a guard has a subject proves it fires, not that it
discriminates, and a confinement guard that refuses everything passes every negative test ever
written.

### The rule

**AC-1 — the boundary is the backlog root, and it is one function.**
A new module `packages/core/src/backlog/confine.ts` declares the store's whole boundary and imports
nothing but `node:fs` and `node:path`. It answers two questions and no others: *is this token one
name?* (lexical, no filesystem work) and *does this path resolve to somewhere inside this root?*
(both sides resolved with `realpathSync`, compared on **path components**, so `/x/backlog-old` is
never inside `/x/backlog` — codex risk 3). Nothing is cached or memoised: `create()` may create the
root, so a realpath computed once per `Backlog` is a stale answer, and files are the database.

### `dirOf` — the read side, and the ticket's title

**AC-2 — a token that is not one path segment is refused before the filesystem is touched.**
`dirOf` refuses `''`, `'.'`, `'..'`, and any token where `token !== path.basename(token)` — which
covers `../x`, `a/b`, a trailing-slash form and an absolute path. The refusal is decided on the
string alone and **before** any `existsSync`, `readdirSync` or `realpathSync` call, so it discloses
nothing and costs nothing. Tested with at least `''`, `'.'`, `'..'`, `'../secret'`, `'a/b'`, `'/etc'`
— and, as the twin, a token that reaches the **prefix branch** and still resolves, because that
branch must be guarded too.
*Named behaviour change:* `dirOf('/Q-0001')` today answers `<root>/Q-0001` because `path.join` does
not absolutise, and is now refused. Nothing in either tree does this; it is called out so a reviewer
does not have to discover it.

**AC-3 — a name that resolves outside the root is refused, symlink included.**
For a token that survives AC-2, on **both** branches, the answer is admitted only if the **real**
path of the candidate has the **real** path of the backlog root as its parent directory. A lexical
comparison alone does not satisfy this criterion. Three fixtures, which are
`run-history/reader.test.ts:270–290`'s trio re-aimed at a backlog:
&nbsp;&nbsp;(a) a single-segment symlink inside the root pointing **out** of it is refused, while
every lexical clause passes it;
&nbsp;&nbsp;(b) **twin** — a symlink pointing at a **sibling ticket folder** is accepted and resolves
to it (OQ-6, ruled: it is inside the root, so it is not an escape);
&nbsp;&nbsp;(c) **twin** — a backlog root reached **through** a symlink still accepts its own genuine
children, which is the over-refusal a half-resolved comparison produces and which this repository's
own `os.tmpdir()` fixtures would hit on macOS (R-1).

**AC-4 — what `dirOf` does for a legitimate token does not move at all.**
`dirOf('Q-0001-a-ticket')` and `dirOf('Q-0001')` still answer `path.join(this.root, <folder>)` —
the **joined** path, not the resolved one (OQ-2, ruled). `dirOf('Q-9999')` and `dirOf` of anything on
a backlog root that does not exist still throw `ticket not found: <token>` **byte for byte**, and a
root that cannot be resolved at all reaches that same sentence rather than a resolver error.
`backlog.test.ts:287`, `:307`, `:308`, `:310` and `:316` pass **unedited**, and so does
`backlog.test.ts:288`'s `readOnly.dirOf('Q-0001')` inside the `Object.create` block.

### Every method that takes a `TicketRecord`

**AC-5 — `write`, `writeFile`, `readFiles` and `log` verify `ticket.dir` against the root, before
they touch anything.**
A record whose `dir` is not a directory whose real path is a direct child of the real backlog root is
refused by all four, and the refusal happens **before** any `mkdirSync`, `writeFileSync`,
`appendFileSync` or `readdirSync`. Tested with a forged record pointing outside the root (codex risk
6, which its own criteria left open) and with one pointing through an escaping symlink; the tree
outside the root and inside it is snapshotted around each refused call and is byte for byte
unchanged, in the shape `backlog.test.ts:565`'s AC-8 block already uses. **Twin:** every record
`read()`, `list()` and `create()` produce is accepted, and `backlog.test.ts`'s whole AC-8 block
passes unedited.

**AC-6 — `writeFile` refuses a destination outside the ticket folder, and `readFiles` refuses a
pattern outside it.**
For `writeFile`, because the destination usually does not exist yet, the criterion is on the
**deepest existing ancestor**: it is resolved for real and must be inside the resolved ticket
folder, and the lexical remainder must not climb out of it. An absolute `rel` is refused (a named
behaviour change: `path.join` currently neuters it). A refused write creates **no** directory, inside
the root or outside it. For `readFiles` the same base check applies to both branches — the
`readdir` form and the `walk()` form.
&nbsp;&nbsp;**`readFiles` refuses rather than answering the empty list** (OQ-5, ruled): an empty
result is indistinguishable from the legitimately absent directory that flows depend on
(`backlog.test.ts:675`), so returning `[]` would silently shrink an agent's prompt — *"a check that
skips its subject must not report success"* (2026-08-25) arriving in a prompt instead of in a test.
&nbsp;&nbsp;**Twins, and they carry the weight:** `dev/rounds/x.md`,
`review/chore/run-2/chore-iter-1.md` and every other shape the shipped flows write still work,
parents and all; a symlinked subdirectory pointing at a sibling folder **inside** the ticket folder
is still written through and still read; `requirements/candidate-*.md`, `dev/` and
`solution/contracts.md` behave exactly as they do today.

**AC-7 — the preserved behaviour of both functions is unchanged.**
`writeFile` still creates parents, still appends a newline only when the text has none, and still
returns the absolute path. `readFiles` still treats `*` as the only wildcard, still escapes every
other metacharacter, still walks a subtree for a trailing `/` in the walk's own order, still sorts
everything else by basename, and still answers `[]` for a directory that is not there. All six
assertions of `backlog.test.ts`'s AC-9 block and all three of its AC-8 block pass **unedited**.

### The primitive, the sentence, and everything that must not move

**AC-8 — the primitive is declared once, and the one duplicate that remains is registered with its
reason.**
`fs.realpathSync` appears in `packages/core` and `packages/cli` **production source** in exactly two
files after this change — `backlog/confine.ts` and `run-history/reader.ts` — pinned as a register
carrying, for each, why it is there. `run-history` is **not** refactored (OQ-1, ruled): its guard
requires the directory to exist, returns the resolved path and answers `null`, none of which
`dirOf` may do, and its own JSDoc carries a landed ruling against publishing a path-returning
confinement function. A **third** declaration fails the register, which is what makes the next one a
visible act rather than the Q-0074 shape.

**AC-9 — every refusal names the condition, carries no remedy, and cannot break its own line.**
Four sentences, fixed here so that no implement step invents them and no review round argues about
them:
&nbsp;&nbsp;• lexical token — `not a ticket token: '<token>' — a ticket is one folder directly under the backlog root`
&nbsp;&nbsp;• filesystem escape from a token — the **existing** `ticket not found: <token>`, unchanged (OQ-3, ruled)
&nbsp;&nbsp;• a foreign `ticket.dir` — `not a ticket folder in this backlog: '<dir>'`
&nbsp;&nbsp;• an escaping `rel` or pattern — `not a path inside the ticket folder: '<rel>'`
None tells anyone what to type — *"A `core` error names the condition; the remedy belongs to the
surface"* (2026-09-07). Every quoted value goes through the module's existing `printable()` helper
(`backlog.ts:280`), so a control character or ANSI escape in an attacker-supplied token cannot split
the message into three lines or colour the terminal — Q-0080's reviewer's nit, inherited by
construction rather than by remembering.

**AC-10 — the guard refuses nothing this product ships.**
A test asserts that every `write:`, `writes:` and `input.backlog` value in `harness/flows/*.yaml`
**and** in `packages/cli/templates/harness/flows/*.yaml` is accepted by the new rule — 68 values
today, none traversing (M-8) — with the set **read from the files** rather than transcribed, so a
flow added later is covered. `packages/cli/src/end-to-end.test.ts` and `src/failure-paths.test.ts`
stay green, which is the criterion that says a real run still writes and reads what it did.

**AC-11 — nothing else about the module moves, and its landed pins hold unedited.**
`backlog.source.test.ts`'s AC-1 export list (`Backlog`, `parseFrontmatter`, `renderFrontmatter`),
its barrel assertion, its no-zod-on-read pins and its no-private-field pins all pass **unedited** —
which the new module satisfies by construction, `backlog/` carrying no folder file-set pin (M-11).
`parseFrontmatter`, `renderFrontmatter`, `list`, `read`, `nextId` and `create` are behaviourally
untouched, the byte-fidelity corpus test over every checked-in `ticket.md` passes, `@quorum/core`'s
barrel gains nothing, and `list()`'s silent skip of a symlinked entry (M-6) is left exactly as it is.

**AC-12 — every clause is demonstrated red before it is trusted green, and the documents say what
the code now guarantees.**
For each of AC-2, AC-3, AC-5, AC-6 and AC-8 the report names the mutation that turns it red and the
message it fails with — the lexical clause removed, the `realpath` clause replaced by a lexical
`startsWith`, the guard moved to after `mkdirSync`, a third `realpathSync` added. *"A check is not
established by reading it"* (2026-08-29); the `realpath` clause in particular is the one Q-0049's
AC-11 found had **no coverage anywhere** while three lexical clauses shadowed it. `04-architecture.md`
§6's safety list gains one sentence — the backlog store resolves a ticket token to a directory inside
its own root and reads and writes only inside a ticket folder, enforced in `core` — `backlog.ts`'s
module docblock says the same in one line, and Q-0043's non-goal is cited as closed by name.

---

## 5. Non-goals

1. **The prefix-match non-determinism.** `dirOf`'s second branch consults `readdir` **order**, so two
   folders sharing an id prefix resolve unpredictably. Preserved, and its authority line at
   `backlog.ts:117–118` stays standing.
2. **A flow-lint rule for traversing `write:`, `writes:` and `input.backlog`.** Out of scope with a
   successor opened at this gate — see OQ-4 and GO-2.
3. **Q-0060.** `parseFrontmatter` falling open to `{ meta: {}, body: text }` is a different defect in
   a different function with its own ticket.
4. **Validating a ticket on read.** `read()`'s cast stays a cast; `backlog.source.test.ts`'s AC-4 pins
   that no read path runs zod, and this change must not be the thing that quietly starts.
5. **Argv, `parseTicketId` at the CLI, and any grammar check outside `core`.** The guarantee belongs
   in `core` so the CLI and M3's server inherit the same one; a CLI check would be a second, weaker
   rule in a second place, and would refuse a folder name, which `dirOf` legitimately accepts.
6. **A step id's character set.** `steps.ts:292` builds an artifact path from a step id, which the
   linter requires (Q-0055) and does not constrain. Confining `writeFile` covers the consequence.
7. **Time-of-check/time-of-use.** The window between resolving and opening is not closed here;
   descriptor-relative filesystem operations are a different change, and anyone who can win that race
   already has write access to the backlog root and can edit `ticket.md` directly.
8. **`nextId` concurrency and the run-level lock** (Q-0039); **`git` and worktree paths**, which are a
   different confinement question with a different owner; **M3's authentication and authorisation**,
   which is what inherits this rather than part of it.
9. **Anything on the v1 exclusion list**, and **no new dependency**: the fix is `node:fs` and
   `node:path`, both already imported. No index, cache, lock or daemon-held state.

---

## 6. Open questions — all ruled at this gate

Every question either candidate raised is answered here, each on a measurement rather than a
preference, so that no implement step chooses one while writing and no review round argues one back.

**OQ-1 — where the primitive is declared. Ruled: a new `packages/core/src/backlog/confine.ts`, and
`run-history` is not refactored.** `backlog/` carries no folder file-set pin where `fanout/` and
`run-history/` both do (M-11), and the barrel test filters over `backlogModule` and `projectModule`
only — so a new module there costs no register edit, while a new file in `run-history/` is refused by
that folder's own pin. Exporting from `reader.ts` instead points the dependency the wrong way and
puts a general path primitive behind a name that says "run history". A new top-level `core` folder
would contradict *"`core` is organised in folders named after the port's children"* (2026-08-26) and
is the one option that would owe a decision entry — it is not taken. **No entry is owed**: a
placement that changes no behaviour and contradicts no landed entry belongs in the module's own
authority comment, which is Q-0108's precedent.

**OQ-2 — does `dirOf` return the resolved path or the joined one? Ruled: verify with the realpath,
return the joined path.** The precedent returns the resolved path to close a check/use window
(`reader.ts:200–219`), and copying it here turns three landed assertions red and changes
`TicketRecord.dir` for every consumer — on macOS from `/var/folders/…` to `/private/var/…`, and
through a symlinked checkout in production — which reaches artifact paths, `wrote …` events and run
history. The window it leaves needs write access to the backlog root, which is already game over.
The divergence from the precedent is recorded in one authority line, because it is exactly the kind
of thing a later reader otherwise "fixes".

**OQ-3 — one refusal or two, and what each says. Ruled: a lexical refusal gets its own condition; a
filesystem escape gets the existing `ticket not found`.** Refusing on the shape of a string discloses
nothing about the filesystem, and an operator who typed a path deserves better than "not found" —
*errors are explicit*. A token that exists and resolves outside the root gets the unchanged sentence,
disclosing nothing about where the link pointed, which is what `resolveRunDirectory`'s `null`
contract already does for run history. AC-9 fixes all four sentences.

**OQ-4 — should `lintFlow` also refuse a traversing `writes:`, `write:` or `input.backlog`? Ruled:
not in this ticket, and the successor is opened at this gate.** Q-0055 settled that the linter may
carry a rule with no engine counterpart, and catching a bad flow before a paid run is worth having.
But it touches `core/lint`, both template copies and `lint.test.ts`, and — the reason it is a
separate ticket rather than a deferred clause — **the flow-authored surface has a genuine instrument
question this ticket does not**: engine guard, lint rule, or both, decided together. The engine guard
here is the one that must exist either way. GO-2 opens it; it is not left in this ticket's closing
entry, which is what two orphaned obligations did this week.

**OQ-5 — is `readFiles` in scope, and what does it do? Ruled: in scope, and it refuses.** It is in
no earlier account because nobody had measured it (M-4). Excluding it ships an asymmetry that cannot
be written into `04-architecture.md` with a straight face — the engine could not *write* outside the
ticket folder but could *read* the whole disk into the prompt an adapter is invoked with — and the
guard is the same primitive at the same base. It **refuses** rather than answering `[]`, against
candidate-claude's recommendation, because `[]` is what a legitimately absent directory already
answers, so silence would shrink a prompt without anything going red.

**OQ-6 — is a symlink to a sibling ticket folder an alias or an escape? Ruled: an alias, and it is
accepted.** It resolves to a path whose parent is the real root, so it is inside the boundary and the
rule admits it without a special case — the same answer `reader.test.ts:277` pins for run history.
Codex's argument for refusing (a backlog folder is mutable where a run directory is read-only) is
answered by measurement rather than dismissed: a write through an alias writes the real
`ticket.md` through the link, to the same bytes in the same folder, so nothing escapes and nothing is
duplicated. Refusing it would be a behaviour change the defect does not require, and this change
makes none it does not need.

---

## 7. Risks

**R-1 — a half-resolved comparison over-refuses on this repository's own fixtures.** `test/repo.ts:19`
builds every fixture under an unresolved `os.tmpdir()`, so comparing a realpathed child against a
lexical root refuses legitimate children on macOS. Both sides are resolved or the guard is wrong.
AC-3(c) is the fixture that catches it.

**R-2 — a guard that fires is not a guard that discriminates.** Every criterion here carries a benign
twin for that reason. A confinement guard is the easiest thing in this repository to ship green and
useless, because every negative test passes when everything is refused.

**R-3 — a refusal that fires after `mkdirSync` is a different fix from one that fires before.**
AC-5 and AC-6 assert the tree is unchanged, not that the call threw.

**R-4 — a third declaration of the primitive.** The cheap implementation is a second `realPath` beside
the first, which is Q-0074's open subject arriving in a security primitive. AC-8 forbids it and OQ-1's
ruling is what makes obeying it cheap.

**R-5 — the sibling-name prefix.** A raw `startsWith` puts `/x/backlog-old` inside `/x/backlog`.
Comparison is on path components. Codex's risk 3, kept verbatim in substance.

**R-6 — `list()` looks like collateral and is not.** Measured (M-6): `Dirent.isDirectory()` is false
for a symlinked directory, so `list()` cannot hand one to `read()` and `quorum board` cannot start
throwing. Stated because the opposite is the obvious worry and would otherwise be guessed at.

**R-7 — the symlink fixtures must be honest about the environment.** A test may skip **only** when
the operating system refuses to create the link, never when the implementation rejects the input, and
the skip must name what could not be staged. Codex's AC-12, kept as a risk with teeth: Q-0105's GO-3
is the week's proof that an unconditional test of an environment capability is a verdict about the
machine.

**R-8 — this document is the fourth account of a defect whose earlier three were each wrong
somewhere.** Nothing in §0 was taken from the ticket body, from its 2026-09-07 correction, or from a
candidate unchecked — and two candidate measurements were still corrected (M-9, M-10). The same
discipline is asked of the implement step: **re-derive the call sites and line numbers from the file,
not from here.** `backlog.ts` has moved twice already.

---

## 8. Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a. No adapter, no credential, and `core` reads no environment for anything here. |
| **Worktree safety** | Adjacent and reinforcing — the same family as *never write to the user's working tree*, enforced in `core`. No worktree, branch or ref is created, moved or deleted. |
| **Gate behaviour** | Unchanged. Four gate obligations below. |
| **File format and schema** | Nothing changes. No frontmatter key, no `harness.yaml` key, no schema in `shared`, no contract. |
| **Public API** | Unchanged. Nothing reaches `@quorum/core`'s barrel, so `packages/cli`'s `DOMAIN` register and `package.test.ts` are untouched. |
| **Cost** | One `realpathSync` pair per call, so `quorum board` over 59 tickets pays 59 of them — microseconds, and nothing is cached, because `create()` may create the root. |
| **Cold-clone impact** | None. A stranger never meets these refusals on the happy path, and the first thirty minutes gain no step. |
| **Product-agnostic** | Yes. No product name, no example beyond ticket ids. |
| **Turbo inputs** | No new repository read from production source; new tests build fixtures under `os.tmpdir()`, which `turbo-inputs.test.ts` already excuses by base. Verified against the guard rather than assumed if a new file reads a repository path. |

---

## 9. Gate obligations

**GO-1 — no decision entry is owed under the rulings above, and this is the thing to overturn or
ratify before the run starts.** If the gate moves the primitive to a new top-level `core` folder, an
entry against *"`core` is organised in folders named after the port's children"* (2026-08-26) is a
precondition **no step on the chore route may write**, and it must land first. Q-0062 is the ticket
whose requirement named this hazard in advance and whose run was launched anyway, spending three
rounds on it.

**GO-2 — open the flow-lint successor at this gate**, from OQ-4, not in this ticket's closing entry.
Two obligations found orphaned this week lived only inside a closed ticket and a source comment;
Q-0105 is the counter-example that shows opening them at the close is avoidable work, and opening
this one at the gate is cheaper still.

**GO-3 — the rulings at §6 go into the ticket body before the run.** They are the product's error
vocabulary and the ticket's scope, and an implement step choosing them produces a change a reviewer
then argues with, which is what the last four tickets' errata were spent on.

**GO-4 — settle the word, in one line.** `docs/GLOSSARY.md` defines **containment** (a git ancestry
fact) and does not define **confinement**, which `04-architecture.md` and the development plan
already use for this guard, and which AC-12 puts in a numbered document again. Either the term is
added to the glossary or the sentence is written without it. The two must never read as synonyms.

**GO-5 — verify forced in both environment rows after the merge.** `integrate`'s tick is
worktree-scoped, and a worktree has neither `.harness/worktrees` nor `.quorum/runs`, which is how a
merged and reviewed change has been red on `main` before. `pnpm turbo run test --force --continue` in
the integration worktree and again on `main`, plus `pnpm sweep:git-identity`, plus **CI green on the
merged commit** — the last because Q-0105's own GO-3 was the week's proof that a local verification
is not one.

---

## 10. Provenance

**From candidate-claude, which is the stronger document and the base of this one.** Its §0
measurement table and the discipline of writing it — eight of its nine rows survived a third
reading. Specifically: M-1 (the `Q-0059` citation pins the prefix defect, not the traversal, so
nothing has to be un-pinned), M-4 (**`readFiles` is the read twin**, named in no earlier account and
the finding that changes what this ticket covers), M-5 (`realPath` is module-private and
`resolveRunDirectory` is barrel-withheld, so "one import away" was wrong in shape), M-6 (`Dirent`
lstat semantics, which is why `list()` is not collateral), M-7 (three landed assertions and the
unresolved `os.tmpdir()` fixture, which decides OQ-2), M-8 (68 flow values, none traversing). Its
reader.test.ts fixture trio is AC-3. Its red-before-green criterion is AC-12. Its `printable()` clause
is in AC-9. Its non-goal list is largely intact, and its recommendation on OQ-1 is the one ruled.

**From candidate-codex, which is weaker as a document and contributed three things the other did
not.** Its risk 6 — *"applying confinement only in `dirOf()` leaves callers able to construct a
`TicketRecord` directly and bypass the read-side guard"* — is the observation that produced **AC-5**,
and it is the merge's most consequential single line: candidate-claude confined `rel` against
`ticket.dir` and never asked who guarantees `ticket.dir`. Its AC-12 (real links, and a skip only when
the OS refuses the fixture, never when the implementation rejects the input) is R-7. Its risk 3
(`/backlog` versus `/backlog-old`) is in AC-1. Its insistence in OQ-1 that the write-side scope be
settled rather than assumed is what forced the question that AC-5 answers, even though its own
framing of that question — `write` **or** `writeFile` — is the wrong pair (M-2, M-9). Its AC-2
(absolute paths refused explicitly) is folded into AC-2 and AC-6 with the behaviour change named. Its
OQ-2 is answered rather than adopted, at OQ-6.

**From this merge.** The frame that **the boundary is the backlog root and not `ticket.dir`**, which
collapses codex's blocking OQ-1 into a criterion and closes its own risk 6 — and which brings `log()`
in, a method neither candidate mentioned. The ruling that `readFiles` **refuses** rather than
answering `[]`, against candidate-claude's recommendation, because an empty read is
indistinguishable from a legitimately absent directory. The ruling that `run-history` is **not**
refactored and the remaining duplicate is a two-file register with reasons, which keeps AC-8's
intent without touching a module whose folder is pinned at three files and whose JSDoc carries a
landed ruling against exactly the shape "share the primitive" would have taken. Two corrections of
measurement: `writeFile` has **six** production call sites, not five (M-10, `steps.ts:364`'s script
step missed), and `backlog/` carries **no folder file-set pin** where `fanout/` and `run-history/` do
(M-11), which is what actually makes the recommended placement free. And the cut from fifteen and
sixteen criteria to twelve — not by dropping subjects but by making each guard criterion carry its
own benign twin, which is a stronger test than the two it replaces.
