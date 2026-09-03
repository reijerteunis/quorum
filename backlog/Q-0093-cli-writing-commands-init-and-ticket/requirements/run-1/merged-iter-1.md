# Q-0093 — CLI writing commands: `init` and `ticket`

*Requirements, run 1, merged. Verdict: **ready** — thirteen criteria, no blocking open question, and
**no decision entry owed before the chore run**. Two gate obligations are the human's, both backlog
writes no step may perform. Written against the tree at `450e352` and re-measured at the gate: §2
records what moved, including one figure the recommended candidate got wrong about itself.*

---

## 1. Problem

The `adopter` meets these two commands before any other. `quorum init` is what turns a stranger's
repository into one Quorum can run in, and `quorum ticket new` is what puts the first ticket in it.
Neither exists in `packages/cli`: the frame dispatches `help`, `lint`, `validate` and `runs`, and
the only implementations are 36 lines of `spike/bin/harness.js` that the cutover deletes.

The two are small — `init` is `spike/bin/harness.js:317–339`, 23 lines; `ticket` is `:340–352`,
13 lines, and both spans in the ticket body are correct, which is worth saying because the coverage
figure beside them is not. What makes them load-bearing is what they *write*. `init` copies a
template tree into somebody else's repository, so a stale copy hands every adopter the
artifact-overwrite defect Q-0086, Q-0087 and Q-0088 closed on 2026-09-01. `ticket new` allocates an
id, so an allocator that answers wrongly overwrites a ticket, which is what Q-0080 fixed and what
its 216-line suite exists to keep fixed.

Four properties of the workspace make this harder than the line counts suggest, and every one was
measured rather than assumed. They are §2.

**Surface:** the **CLI** — `packages/cli`, the shipped template assets it must carry, and the
`@quorum/core` surface the scaffolding lands on. No flow, no role and no `harness/` file of this
repository changes.

---

## 2. What re-measuring moved

Six things. The first four change the work rather than a number; the fifth changes the shape of the
inherited coverage; the sixth is a figure inside a candidate document rather than in the tree.

### M-1 — Ground rule 4 is false for `init`, by absence rather than by reachability

Ground rule 4 says every domain helper the spike CLI defines locally is already in `packages/core`.
For `ticket new` that is true: `Backlog` and `loadProject` are both on the barrel, and
`Backlog.create` / `Backlog.nextId` carry Q-0080's allocation behaviour in full.

For `init` it is false, and not in Q-0092's way. Q-0092 found that `@quorum/core` held the
run-history logic and did not *export* it — true of existence, false of reachability. Here nothing
exists. Verified by name at the gate:

- `currentBranch` is defined at **`spike/bin/harness.js:287`** and nowhere else in either tree. It
  is a domain helper the spike CLI defines locally, which is exactly the class ground rule 4 claims
  is already ported. `packages/core/src/git/git.ts` exports thirteen functions and none names a
  branch.
- `fs.cpSync` appears in no production file under `packages/*/src`.
- `YAML.parseDocument` / `setIn` appear in no production file under `packages/*/src`.

So the honest statement of the work is not "port two case blocks" but **"add a scaffolding function
to `core`, extend its public surface, and write two thin command modules over it"**. Ground rule 4
asks that a genuinely absent helper be said out loud; this is the report.

### M-2 — `init` cannot be written in `packages/cli` under the rules that hold today

`packages/cli/src/frame.source.test.ts:177` is a package-wide ban, asserted over **every**
production module at `:354`, with a companion test at `:358` proving the clause has a subject:

```
const IO_MODULE = /from '(node:fs[^']*|node:child_process|node:readline[^']*|node:os|node:url)'/;
```

`init` needs `node:fs` to copy a tree and `node:child_process` to ask git for a branch name. Written
in `packages/cli` it fails that guard on its first import.

The guard's own comment at `:171` names the remedy and the precedent: `node:path` left this list at
Q-0091 and moved to `FRAME_ONLY_IO`. So the shape is settled by precedent, and the substance follows
M-1: the filesystem and git work belongs in `core`, which `04-architecture.md`'s first principle
already says owns *"reads/writes the project folder and git"*, and which M3's server will want for a
projects-home "new project" the same way it wants `loadProject`.

### M-3 — The guard is fail-open against `import.meta.url`, which is the one thing `init` needs

`IO_MODULE` matches an **import**. `new URL('../templates/harness/', import.meta.url)` imports
nothing — `URL` and `import.meta` are both ambient — so a module resolving its own location passes
the scan silently. The guard's doc comment at `:174` claims the opposite: *"`node:url` stays
forbidden everywhere in production: a module resolving its own location is the mechanism Q-0090 AC-7
replaced."*

That is a comment promising what the code beneath it does not do, and it is invisible until a module
has a reason to resolve its own location. **This is the first such module, and AC-8's recommended
shape is exactly the expression the comment claims to forbid** — so the guard must be extended in
the same change that gives it a subject, or the ticket sails past its own protection. Closing it is
AC-10.

### M-4 — The templates ship in no tarball, and this is the finding that makes the ticket work

Decision *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) clause (e)
fixes the depth: the `bin` target is one directory below the package root so that
`path.join(here, '..', 'templates', 'harness')` reaches `packages/cli/templates/harness`, and it
says in as many words that *"Q-0093 does not build `init` against a guess."* The location is ruled;
`packages/cli/src/quorum.ts`'s own header repeats the reasoning and names this ticket.

What is not ruled, and what nothing in either candidate's ticket body or in 078 names — all four
verified at the gate:

- `packages/cli/package.json` declares `"files": ["dist"]`.
- `packages/cli/tsconfig.build.json` sets `"include": ["src/**/*.ts"]` with `rootDir: src`, so `tsc`
  emits `.js` and `.d.ts` and copies no asset. A `templates/` directory of markdown and YAML cannot
  reach `dist/` without a build-script change.
- `packages/cli/src/build.test.ts` asserts, for each of the three packages in the distribution set,
  `expect(declared).toStrictEqual([EMIT])` where `EMIT = 'dist'`.
- The same test's comment records that the assertion is deliberately *over the allow-list and the
  entry point, never over a count* — Q-0098 erratum E-1.

So a `packages/cli` that carries its templates outside `dist/` packs a binary whose first command
cannot find its assets, and one that adds `"templates"` to `files` turns that assertion red. The
locally packed path is **one of the two installation paths this repository claims** — 078(d),
`harness/product-context.md` pillar 7, and Q-0098's AC-19 fixture, which installs all three tarballs
into a project outside the repository. A `quorum init` that fails there breaks a claim fed to every
product-manager step at run time.

This is AC-22's position on Q-0097: a criterion no earlier document named, without which the ticket
does not work.

### M-5 — The inherited coverage is two files, not one, and 216 lines, not 217

Measured against `spike/test/`:

| claim in the ticket body | measured |
| --- | --- |
| `q0080-allocation.js`, 217 lines | **216** |
| nine scenarios | **ten** — A1, A2, A3, A4, A5, A6, A6b, A7, A8, A9 |
| all of it inherited | **three** scenarios spawn the binary |

- **Library-only, already carried:** A1, A3, A4, A5, A6, A6b run against `Backlog` directly.
  `packages/core/src/backlog/backlog.test.ts` reads `spike/test/q0080-allocation.json` — *"the
  allocation table, read rather than transcribed"* — and asserts the same rows;
  `spike-parity.test.ts:285` already records the counterpart.
- **Binary half, this ticket's:** A7 (`:158`), A8 (`:171`), A9 (`:197`) plus the `project()`, `cli`
  and `folders` helpers (`:61–71`) — **about 67 lines of the 216**, roughly 31%.
- **Neither:** A2 (`:87–98`) asserts over the *spike binary's own source text* — that
  `spike/bin/harness.js` does not spell the ticket-id grammar a second time. Its workspace analogue
  is a property of `packages/cli`, not a translation of that assertion.

**A second file is inherited and neither ticket body names it.** `spike-parity.test.ts:180` routes
it here in its own prose: `q0033-surface.js`'s binary half is *"`quorum lint` … carried by
packages/cli since Q-0091. What remains is `harness init` and the shipped review assets on disk —
**Q-0093** — and the gate answers a terminal supplies — Q-0094."* That is scenario S5.1–S5.7/E5
(`:200–219`) plus `initFixture` (`:47–54`), about 28 lines, and it is the whole of `init`'s
behavioural coverage: named-branch discovery, comment preservation, unborn HEAD, detached HEAD, no
repository, and a broken `GIT_DIR`.

So the inherited set is **about 95 lines across two files**, landing in two different registers.
Q-0091's 698, Q-0092's 505 and Q-0098's 22 were each wrong the same way; this is the fourth
consecutive ticket, and the pattern is reliable enough to state as a rule: **a whole-file line count
is never the figure that transfers.**

### M-6 — The recommended candidate's own worksheet is wrong about two registers

Counted at the gate rather than relayed: `packages/cli/src/package.test.ts`'s `OUTSIDE` holds
**18** entries and its `DECLARED` holds **10**. The candidate's Appendix B says 19 and 6.

This is recorded rather than silently corrected because of where it sits. Four consecutive tickets
have now had an inherited measurement corrected by the run that received it; this is the first time
the wrong figure is **inside the requirement itself**, in the very worksheet whose stated purpose is
*"so the implementer re-derives rather than guesses"*. A worksheet that is wrong is worse than no
worksheet, because it reads as having been measured. Appendix B below carries the corrected values
and marks which were re-counted at this gate and which were not.

---

## 3. Recommended cut: keep it as one ticket

Thirteen criteria, inside the fifteen ceiling that forced Q-0091's split at its own gate.

The obvious seam — `ticket new` here, `init` in a successor — is refused on measurement rather than
on taste. **All three inherited binary scenarios build their fixture by running `init`**:
`q0080-allocation.js:61–68`'s `project()` spawns the binary with `['init']` and asserts status 0
before a single `ticket new` runs, and A7's own title is *"init then three ticket new gives T-0001,
T-0002, T-0003"* — the composition is what Q-0080's AC-3 claims, not incidental setup. A
`ticket`-only child would hand-build a project fixture, which is the same filesystem work without
the assertion that `init` produced it.

The second candidate seam — deferring the packaging half (AC-5) to a successor — is also refused.
It exists only because `init` needs assets in a tarball, Q-0098 is closed, and deferring it ships a
`quorum init` that fails on one of the two installation paths this repository claims. A command that
works on one of two claimed paths is not a smaller ticket; it is a false claim in
`harness/product-context.md`.

**Why this is not a 29-criterion ticket.** The codex candidate specifies the allocation table row by
row (its AC-14 seven rows, AC-15 three refusals, AC-16 grammar, AC-17 no-overwrite, AC-18 exclusive
folder creation, AC-19 ticket contents). Every one of those is `Backlog.create` / `Backlog.nextId`
behaviour that landed with Q-0080 and that `packages/core/src/backlog/backlog.test.ts` already
asserts from `q0080-allocation.json`, the one table both trees read. Re-specifying them here would
produce a second description of behaviour that can drift from the first — which is the defect this
repository keeps finding — and would price a presentation layer as though it were the domain.
AC-2 below claims the **binary half**: that the CLI reaches that behaviour and renders its refusals
as one line and an exit code. That is what is unbuilt.

---

## 4. User stories

- As an **adopter**, I clone my own repository, run `quorum init`, and get a `harness/` whose flows
  are the current shipped ones — scoped write paths and all — with `repo.base_branch` already set to
  the branch I am on, and a next command I can copy. I do this from either of the two installation
  paths this repository claims, and it behaves identically in both.
- As an **adopter**, I run `quorum ticket new "…"` and get the id that follows the backlog I am
  standing in, whatever prefix it uses, with no configuration step. When the backlog is one the
  allocator cannot read, I get one line telling me what it found and what to do, not a stack trace.
- As a **maintainer**, I run `quorum ticket new` fifty times across four repositories with different
  prefixes and never think about it, because the allocation table is the one both suites assert
  over.
- As a **contributor**, I can see where the frame ends and a command begins, and where the CLI ends
  and `@quorum/core` begins, because both boundaries are derived by a guard rather than described in
  a comment.

---

## 5. Acceptance criteria

Numbered, independently testable. Each names its surface. "The binary" means the emitted
`packages/cli/dist/quorum.js`; "the frame" means `main.ts`, `argv.ts`, `commands.ts`, `colour.ts`,
`exit.ts`, `fail.ts`.

### AC-1 — `init` and `ticket` are registered commands, and the help says so

`COMMANDS` in `packages/cli/src/commands.ts` gains `init` and `ticket`, `HELP` gains one line each,
and `HANDLERS` in `main.ts` gains both entries — 4 → 6 in all three.

Ordering follows the spike header's own relative order (`spike/bin/harness.js:3–4`), which puts
`init` and `ticket` before `lint`, so both insert **above** the existing lines rather than being
appended — the rule `commands.ts`'s own comment states and which `runs` was appended under.

Each help line carries the *information* of its spike counterpart — what the command takes and what
it does — rewritten rather than transcribed, and says `quorum`, per `commands.ts`'s established
treatment of new text. `commands.test.ts` derives the names out of `HELP` and already refuses one
that is not in `COMMANDS`; that derivation must go from four names to six **without being edited to
fit**.

### AC-2 — `quorum ticket new` allocates through `core`, and the table's binary half runs through the binary

A new command module `packages/cli/src/ticket.ts`, registered under `ticket`, reproducing
`spike/bin/harness.js:340–352`:

(a) `rest[0] !== 'new'` dies with the usage line verbatim, including the binary name it carries
today (AC-13(c) governs the name).
(b) An absent title dies with `title required`.
(c) `Backlog.create` is called with `{ title, intent: flags.intent ?? title, owner: flags.owner,
id: flags.id === undefined ? undefined : String(flags.id) }` — the four argument expressions
preserved, not paraphrased.
(d) `create`'s throw is caught and reported through `die`, so a refusal is a sentence and an exit
code rather than the Node stack `dieOnUnexpected` would print.
(e) Success prints `✓ <id> created at <path relative to cwd> (stage: draft)`.
(f) The project is resolved through `loadProject` — ancestor discovery, the frame's `--project`, and
a configured `backlog.path` included. The command constructs no `backlog/` path of its own and
reimplements no discovery.

Translated from `q0080-allocation.js` A7, A8 and A9, through `main` via `test/invoke.ts` — the
dispatch boundary being part of what is claimed (Q-0091 AC-2). Every assertion of those three
scenarios survives: three sequential allocations giving `T-0001`/`T-0002`/`T-0003`, each in its own
folder despite identical titles, each keeping its own `ticket.md`; the mixed-prefix refusal naming
`the backlog uses more than one prefix — Q- (1), T- (1)` and ending in `pass --id <ID> or reconcile
the backlog`; `ticket id already taken: Q-0006 already belongs to Q-0006-first`; `not a ticket id:
'q-1'`; exit 1 and **no `\n    at ` in stderr** on all three; and `--id` as the escape hatch that
still works afterwards.

A9's `board` and `runs` invocations are **not** translated here. `spike-parity.test.ts:291` already
rules them incidental — *"the behaviour each asserts is translated by Q-0092 and Q-0099 from the
files that own it"* — so what survives of A9 is its library half: reading a mixed backlog is
untouched by an allocation refusal.

### AC-3 — Four preserved defects of the `ticket` case are pinned, not repaired

Each demonstrated by execution and pinned with a `Why:` line naming its authority, so a later fix is
a deliberate act (ground rule 3):

(a) `--owner` **with no following value** parses to the boolean `true` (`argv.ts:53`), and `create`'s
destructuring default fires only on `undefined` (`backlog.ts:189`), so the frontmatter reads
`owner: true`. *Derived from those two lines and **not executed** while writing this document; the
implementer demonstrates it before pinning it, and reports it as absent if the reading is wrong.*
(b) `--intent` with no value reaches `intent.trim()` on a boolean, and the `catch` turns the
resulting `TypeError` into `die('intent.trim is not a function')` — a JavaScript message on a
user-facing path.
(c) `--id` with no value is coerced by `String(true)` to `'true'` and refused as
`not a ticket id: 'true'`. Deliberate in the spike; pinned so the coercion is not tidied away.
(d) `owner` defaults to `process.env.USER ?? 'unknown'`. **The test controls the environment and
restores it**: one case sets `USER` to a known value and asserts that value is written, a second
deletes `USER` and asserts `owner: unknown`. Reading the ambient account would make the verdict a
property of the machine — *"A test's verdict is a property of the commit, not of the checkout or the
account"* (2026-08-30) — which is the defect this repository has now paid for four times.
AC-13(a) owns the report and the successor.

### AC-4 — The shipped template assets exist at `packages/cli/templates/harness/`, and cannot go stale

The **twenty** files of `spike/templates/harness/` — `harness.yaml`, three context files
(`architecture.md`, `product-context.md`, `rules.md`), six flows, ten roles — exist at
`packages/cli/templates/harness/`, at the depth 078(e) fixes.

A guard in `packages/cli` asserts the two trees are **byte-identical, file for file, in both
directions**: same relative path set, same bytes. Both halves are load-bearing — a copy that gains a
file and a copy that loses one are different failures — and the assertion is over an identity, never
a count (*"a count is not an identity"*, Q-0073). Shown red before it is trusted, by editing one
byte of one flow in one tree.

**Why byte identity is sufficient and no second scoping assertion is owed.** The property the ticket
body cares about — every rewritable artifact named by `{run}`, plus `{iter}` where a bounded loop can
re-enter, four flat paths surviving only as pointers — is guarded by a three-link chain, and the new
copy joins the front of it:

1. `packages/cli/templates/harness/flows` ≡ `spike/templates/harness/flows`, by this criterion;
2. `spike/templates/harness/flows` ≡ `harness/flows`, by `packages/core/src/lint/lint.test.ts:871`'s
   `SHIPPED` pair, whose second test asserts `validateFlowDirectory` returns the same records for
   both — write paths included — and by `q0033-surface.js` S1.1/S1.2/S1.4's byte freeze;
3. `harness/flows` carries the scoping rule, by `packages/shared/src/flow.test.ts`'s Q-0086/Q-0087
   guard.

The chain is stated in the guard's own comment so a reviewer can walk it. A fourth assertion
re-describing the scoping over the copied tree would be a second description of a property already
checked, which is the drift this repository keeps finding. **The chain is checked, not assumed**: if
link 2 does not hold for a file the implementer needs, that is a finding, not a licence to add the
assertion.

`spike/test/q0033-surface.js` S1.1/S1.2/S1.4 and S2.1–S2.5 are not edited (ground rule 2); the new
guard is a third edge on the workspace side.

### AC-5 — The template set ships in the tarball, and `quorum init` runs from a packed install

(a) `packages/cli/package.json`'s `files` names the template directory as well as the emit.
(b) `build.test.ts`'s allow-list assertion becomes **per package** — `@quorum/shared` and
`@quorum/core` declare `['dist']`, `@quorum/cli` declares `['dist', 'templates']` — derived from a
register rather than from one shared literal, and each of the three `REJECTED` rules still returns
empty for all three packages.
(c) The packed tarball carries every one of the twenty template files, asserted **by identity
against the tracked set**. Never by a count, a byte size, or the absence of build output: Q-0098's
E-1 and Q-0096's E-1 both retired count assertions here for the same reason — `packages/*` carry no
package-level ignore file, so a pack count depends on whether the checkout has built.
(d) Q-0098's AC-19(b) fixture — the three tarballs installed together into a temporary project
outside the repository — runs `quorum init` in a directory it creates and gets exit 0 and a
`harness/harness.yaml`. This is the proof that (a) to (c) are about a real failure rather than about
a manifest key.

### AC-6 — `quorum init` scaffolds, refuses and prints exactly as the spike does

`packages/cli/src/init.ts`, registered under `init`, reproducing `spike/bin/harness.js:317–339`:

(a) The target is `path.resolve(rest[0] ?? '.')`, so `quorum init` with no argument scaffolds the
working directory and `quorum init some/dir` scaffolds that one.
(b) `<dir>/harness` already existing dies with `` `${dst} already exists` `` — the absolute path —
and **the check precedes the `backlog/` creation**, so a refusal leaves a previously absent backlog
absent. Only `harness/` is tested: an existing `<dir>/backlog` is *not* a refusal and the
`mkdirSync(…, { recursive: true })` over it is a no-op. Both the ordering and the asymmetry are
preserved and pinned; they are what a tidier implementation would close.
(c) The template tree lands at `<dir>/harness` and `<dir>/backlog` is created.
(d) Success prints one line naming the directory and a second beginning `  next: `, listing the
three next commands. Its exact text is unpinned by any spike assertion — `grep -rn "next:"
spike/test/` returns nothing — so it is written rather than matched, subject to AC-13(c).
(e) Nothing is written outside `<dir>`, asserted over the filesystem rather than read out of the
code.

### AC-7 — Base-branch discovery, and the comment-preserving edit

Translated from `q0033-surface.js` S5.1–S5.7/E5, all six rows:

| repository state | `repo.base_branch` after `init` | stderr |
| --- | --- | --- |
| `git init -b master` with a commit | `master` | — |
| `git init -b master`, **no commit** (unborn HEAD) | `master` | — |
| not a git repository | `main` (the template's own) | empty |
| detached HEAD — git succeeds and names nothing | `main` | — |
| `GIT_DIR` pointing at a non-repository | `main` | no `fatal:` and no `not a git repository` |
| default `main` | `main` | — |

The detached-HEAD row is the one that must exercise **successful git with empty stdout**, which the
spike fixture asserts explicitly before relying on it; a fixture that fails git instead has not
tested that row.

And the property the fixture exists to prove: **the file is edited, not re-emitted.** After `init`
the written `harness.yaml` still carries its comments — the install comment, the base-branch comment
and the diff-size comment — which is what `YAML.parseDocument` + `setIn` + `toString` preserves and
what a parse/stringify round trip destroys. `repo.max_diff_bytes` is still `200000`, asserted beside
them so a wholesale rewrite cannot pass by keeping one key.

`init` never fails because git failed, and git's stderr never reaches the terminal: an adopter's
first command may not print a raw `fatal:`.

### AC-8 — The template directory is resolved relative to the binary, identically from source and from the emit

(a) The resolution is relative to the resolving module's own location, so it answers
`packages/cli/templates/harness` when the suite resolves `src/` through the `quorum-source`
condition **and** when a plain `node` process resolves `dist/`. Both asserted — the second by
executing the built binary rather than by reasoning about it.
(b) The **emitted** module that performs the resolution is one directory below the package root. The
assertion is over the emitted path, not over the source layout: `rootDir: src` makes `dist/` flat
today, and a later `src/commands/init.ts` would silently break the depth. This closes the fail-open
shape Q-0051 found in `q0050.source.test.ts` and Q-0097 found again in `test-discovery.test.ts`.
(c) No absolute path, no `process.cwd()` and no environment variable participates in the resolution.
(d) The shape is `new URL('../templates/harness/', import.meta.url)` handed to `core`, which keeps
`node:url` out of `packages/cli` entirely. **Measured at this gate rather than assumed:
`fs.cpSync` accepts a `file:` URL as its source** — exercised against
`spike/templates/harness/` on Node v24.15.0, six entries copied, `src` being typed `string | URL`
since the function was added. **Re-confirm under the workspace's pinned Node in the run**; if it does
not hold there, take the `node:url` exemption instead and AC-10(c) names that import rather than
`import.meta.url`. The register shape is the same either way and only the named mechanism changes.

### AC-9 — The scaffolding is `core`'s, and the registers move together

(a) `@quorum/core` gains the scaffolding: a function that copies a template tree to `<dir>/harness`,
creates `<dir>/backlog`, refuses when `<dir>/harness` exists, and sets `repo.base_branch` from the
current branch while preserving the file's comments. It **throws rather than exiting** — *a library
may not do that to its host*, which is the reason `project.ts` gives for `ProjectNotFoundError` —
and carries the spike's sentence byte for byte, so the CLI prints it unchanged.
(b) The branch probe (`spike/bin/harness.js:287`, `git branch --show-current` with stderr ignored)
is `core`'s and stays module-private unless a command names it: a symbol reaches the barrel because
a command needs it, which is the rule Q-0092 applied when it withheld `manifestShapeError`.
(c) `packages/core/src/index.ts` gains the new value symbol and the new error class.
(d) `frame.source.test.ts`'s `DOMAIN` gains the value symbol, and `COMMAND_DOMAIN` gains one row per
new command module — `init.ts` naming only what `init` uses, `ticket.ts` naming `Backlog` and
`loadProject`. The audit already fails an entry permitting a symbol its module does not name, and
fails a command module with no entry, so both halves land together or neither does.
(e) The arithmetic is re-derived and each pin shown red against the value it replaces:
`package.test.ts:345`'s `toHaveLength(20)` becomes 21, its `ERRORS` list (`:340`) goes from four to
five, and the barrel assertion (`:352`) from 24 keys to 26.
(f) `frame.source.test.ts:197`'s partition assertion lists the command modules explicitly; it goes
from `['lint.ts', 'runs.ts', 'validate.ts']` to five, and the companion `.not.toStrictEqual` naming
the previous set (`:199`) is **added rather than replaced**, as Q-0092 did.

### AC-10 — The IO clause is split rather than deleted, and its fail-open is closed

(a) `IO_MODULE` stays a package-wide ban on `node:fs`, `node:child_process`, `node:readline`,
`node:os` and `node:url` for every production module — **including the two new command modules**.
The scaffolding is in `core`, so nothing here needs an exemption for those five.
(b) The scan is extended to see `import.meta.url`, which it does not see today (M-3): a module
resolving its own location is what the guard's own comment claims to forbid, and the pattern matches
an import statement only.
(c) That extension is then **split rather than blanket-enforced**, on Q-0091's `node:path`
precedent: exactly one module — the one that finds the templates — is permitted to resolve its own
location, named in a register with its reason, and the frame is permitted none.
(d) Both halves have a subject: a frame module resolving its own location fails, and a second
command module doing so fails. Shown red by mutation, not asserted.
(e) The clause discriminates over a real expression and is not satisfied by a mention of
`import.meta.url` in prose or in a comment — the failure Q-0079's round 1 found, where a guard could
be talked out of firing by text it does not execute. Asserted in both directions beside
`FRAME_ONLY_IO`'s existing pair at `:378–380`.

### AC-11 — The two spike-parity rows are re-classified, and the totals re-derived

Ground rule 5, and `binaryCarriedBy` — the field Q-0091 erratum E-2 created for exactly this, ruled
once because it binds Q-0092 to Q-0095 and Q-0099 — is what records it:

(a) `q0080-allocation.js` gains `binaryCarriedBy` naming this ticket's `ticket` suite, and its
`binaryHalf` prose stops saying the work is owed. The comment at `:287–290` explaining why the field
was **deliberately** absent is replaced by what happened, not deleted.
(b) `q0033-surface.js`'s `binaryCarriedBy` gains this ticket's `init` suite beside Q-0091's
`lint.test.ts`, and its `binaryHalf` prose loses *"What remains is `harness init` … — Q-0093"* while
keeping the Q-0094 clause. Q-0092 extended a row to two files with prose saying why; this is the
same act.
(c) The file's pinned line totals and the transfer share are **re-derived, not adjusted**, and the
share is stated whether or not it moves. Current pins, read at this gate: `binary-only` **220**,
`both` **2739**, `library-only` **2469**, total **5428**, share **55%**. This ticket edits no file
under `spike/test/`, so *"it did not move"* is the expected answer — and the register's own comment
says in as many words that *"it did not move" is a measurement, and assuming it did not is how a
stale pin survives*. Measure it.

### AC-12 — The out-of-package reads are declared, in both registers

AC-4's parity guard reads `spike/templates/harness/**`, which nothing in this package's task hash
covers today.

(a) `packages/cli/turbo.json`'s `test` inputs gain the template tree, beside `$TURBO_DEFAULT$`,
which already covers `packages/cli/templates/**` as the package's own tracked files. **11 → 12.**
(b) `packages/cli/src/package.test.ts`'s `OUTSIDE` (**18** entries) and `DECLARED` (**10**) gain the
same path with its call site and its reason — the register `turbo-inputs.test.ts` explicitly defers
to (*"its declaration is checked by its own suite rather than by this file"*). Both counts were
re-derived at this gate; see M-6.
(c) Demonstrated: editing one byte of a shipped template moves this package's `test` hash, and a
file read by nothing does not. That is the row that separates a precise declaration from a blanket
one, and it is what Q-0072 verified by hand at its own gate.

### AC-13 — The `owner` default is reported, the documentation is corrected, and the README is untouched

(a) **`owner`.** `Backlog.create` defaults `owner` to `process.env.USER ?? 'unknown'`
(`packages/core/src/backlog/backlog.ts:189`). Re-measured at this gate: `$USER` is
`ruudvanengelenhoven`, and all **76** tickets in `backlog/` read `owner: ruud` — the state a third
hand normalisation leaves behind, not evidence that anything was fixed. It is preserved, pinned in
`packages/cli` with a `Why:` line naming Q-0093, and reported in the implement report. **The fix is
not attempted here**: whether the product should default an owner at all is product behaviour, which
the development plan already calls *"a question this repository is not the right place to answer by
hand"*. Appendix A is the successor body and GO-1 is how it gets a folder.
(b) **`docs/04-architecture.md`.** Two of its sentences disagree. Line 31's package map says
`templates/   shipped harness/ (flows, roles, context files) + project scaffolds`, describing
`packages/templates`; line 66 says `init` reads them from `<package>/templates/`, which 078(e) ruled
and which resolves to `packages/cli/templates/`. `packages/templates` is a three-file scaffold with
no `build` script and is not in the distribution set. The map line is corrected to say where the
assets are and that `packages/templates` holds none; the status line is bumped with the date and
what changed, per the docs rules. `docs/02-sdlc-pipeline-spec.md:607`'s `harness init --template
sdlc` and `harness template diff` describe flags that do not exist — **registered and not fixed**
(§7, OQ-3), because inventing a flag to make a document true is the defect this repository keeps
finding.
(c) **The binary name.** `init`'s next-steps line names three commands as `harness` —
`harness adapters · harness ticket new "…" · harness run requirements T-0001` — and Q-0100's body
predicts it: *"Q-0093's `init` next-steps line will be a fourth"*. It is preserved as the spike
prints it, with a `Why:` line routing to Q-0100, which exists to rule the class once rather than
once per command. GO-2 registers the fourth instance in that ticket's body. A one-line rename here
would be this ticket pre-deciding Q-0100 while three other sentences still disagree.
(d) **`README.md` is not edited.** `q0033-surface.js` S13.8 asserts it is byte-unchanged from commit
`5d16e06`, and it mentions neither command today.

---

## 6. Non-goals

1. **No `spike/` change of any kind.** Not `spike/src/` (ground rule 1), not `spike/bin/harness.js`,
   not `spike/test/**` (ground rule 2), and not `spike/templates/**` — the spike CLI's live asset
   directory, whose bytes AC-4's guard now depends on.
2. **The `owner` default is not fixed**, nor any of the other three preserved defects in AC-3.
3. **`--template`, `template diff`, and any flag `init` does not have today.**
4. **`quorum board`, `quorum adapters`** (Q-0099), **`quorum run` and the gate reader** (Q-0094).
   A9's `board` and `runs` lines are theirs, per the register.
5. **The binary-name class is not ruled here** (Q-0100), and **`node:readline` is not admitted**
   (Q-0094).
6. **`packages/templates` is not filled, retired or renamed.** Its future is OQ-2; it is left
   byte-unchanged with a sentence in `04-architecture.md` saying it holds no assets.
7. **No decision entry is written.** §7 records the check that none is owed.
8. **Registry-resolved `npx quorum` is not claimed** in any test name, success message or comment
   (078(d), pillar 7).
9. **Q-0059's traversing `dirOf` and Q-0060's silent frontmatter are not closed**, though both are
   reachable from `Backlog` here (ground rule 3).
10. **No allocator, slug, ticket-serialisation, project-discovery or git-domain logic is copied into
    `packages/cli`.** Where a needed helper is not exported, it is exposed through the barrel rather
    than reimplemented.
11. **No locking, retry or atomic-rollback behaviour is added.** Parallel `ticket new` can still
    race after allocation, and a failed `cpSync` can still leave a partial `harness/`; neither is
    inherited behaviour and neither may be claimed. Q-0039 owns the first.
12. **No new dependency.** `yaml` is already a `@quorum/core` dependency and is what preserves the
    comments.
13. **Windows is not supported.** Q-0098 registered the build as POSIX-only; this ticket adds
    nothing to that surface and inherits the registered limit rather than a new one.

---

## 7. Open questions

**None is blocking.** Each names an owner, and the two that are work no step in the chore flow may
perform are gate obligations rather than criteria.

- **GO-1 (human, at the gate).** Transcribe Appendix A into `backlog/Q-0101-…/ticket.md`. The next
  free id is **Q-0101** — the highest on disk is Q-0100, checked at this gate. `backlog/` is outside
  every role's write paths and the engine discards an agent's edit under it, so an implement step
  cannot do this, and a deferred obligation recorded only in a closed ticket's report expires.
- **GO-2 (human, at the gate).** Add the fourth instance — `init`'s next-steps line — to Q-0100's
  body, beside the three it already names. Same reason.
- **GO-3 (human, at the gate).** Q-0093's own `ticket.md` says *"217 lines"* and *"nine
  scenarios"*; both are wrong (M-5), and the backlog is the human's to edit. The merged requirement
  is what the run reads, so this is tidiness rather than a blocker — but an uncorrected body is what
  produced this figure in the first place.
- **OQ-1 — answered at this gate, recorded rather than carried.** *Does `fs.cpSync` accept a `file:`
  URL as its source?* **Yes**, measured on Node v24.15.0 (AC-8(d)). So `packages/cli` needs no
  `node:url` and AC-8(d)'s recommended shape stands. The implementer re-confirms under the
  workspace's pinned Node and reports either way; it changes one register entry and no criterion.
- **OQ-2 (human, not blocking).** `packages/templates` is a three-file scaffold that
  `04-architecture.md:31` describes as the templates' home while 078(e) puts them in
  `packages/cli`. AC-13(b) corrects the document to what is true. Whether the package is later
  filled — which would make it a fourth member of the distribution set and change the three-tarball
  fixture Q-0098 pinned — or retired, is a package-map question worth its own ticket if it is ever
  worth doing. Registered so a later reader does not read AC-13(b) as having settled it.
- **OQ-3 (registered, not this ticket's).** `spike/test/q0080-allocation.json` is the one table both
  trees read, and it lives under `spike/test/`, which the cutover deletes wholesale — taking
  `packages/core/src/backlog/backlog.test.ts`'s subject with it. This ticket makes that file's
  binary half redundant and could be assumed to have handled it; it does not. The cutover owns it,
  and `spike-parity.test.ts:326` already records why the file is `.json`.
- **OQ-4 (severable, implementer's call with a report).** `packages/cli/src/index.ts` exports
  `lint.js` and `validate.js` and **not** `runs.js`, and nothing pins the barrel, so Q-0092's module
  is absent from this package's own public surface by omission rather than by decision. Adding the
  three lines and deriving the barrel from the command-module set changes no verdict and closes a
  register that can rot. Severable from every other criterion: if the implementer judges it scope
  creep, it is reported instead, and either answer is acceptable. *"Resolve rather than open a
  successor"* argues for doing it.

### Is a decision entry owed? No, and here is the check

Six candidates tested against *"is this a ruling, or a criterion?"* — including the one the codex
candidate left open, which is closed here by measurement rather than deferred:

| candidate | answer |
| --- | --- |
| Where the shipped templates live | **Already ruled** — 078(e), which fixes the depth and names Q-0093 as the inheritor. |
| **Tracked copy vs. build-time copy** (codex OQ-3) | **Already ruled, by the same clause.** A build-time copy would have to land under `dist/` to be covered by `files: ["dist"]` and by `build.test.ts`'s "wrote outside its emit" assertion — but 078(e) fixes the resolution at `path.join(here, '..', 'templates', 'harness')` from `dist/quorum.js`, which is `<package>/templates/`, **not** `dist/templates/`. `quorum.ts`'s own header spells out the consequence: a target inside the emit is deleted by `rm -rf dist` on every build. So the tracked copy is not a preference; it is the only shape the ruled depth admits. Criterion. |
| `files` gaining a second entry | Criterion. 078(e) says `files` *is declared*; it pins no contents, and the `[EMIT]` literal was correct only while `dist` was all there was. Nothing in 078 says a package ships only what it emits. |
| Splitting the IO clause | Criterion, on Q-0091's `node:path` precedent, which needed none. |
| Adding symbols to `core`'s barrel | Criterion. Q-0092 added six by criterion. |
| The `owner` default | The successor's, not this ticket's — and **that** ticket does owe one. |

This matters because it is the thing that has gone wrong most often. Q-0062's requirement named an
absent entry as a hazard *in advance* and the run was launched without it, costing three implement
rounds; Q-0096's AC-0 and Q-0082 are the same shape. Stating "none is owed" **with the check
attached** is what stops a fourth reader re-litigating it at round 2 — and closing the codex
candidate's OQ-3 by measurement rather than leaving it open is what stops an implementer spending a
round choosing a mechanism the depth already forbids.

---

## 8. Risks

- **R-1 — `init` writes into a directory the user chose, and it is the only command in this package
  that does.** A path bug damages a stranger's repository rather than producing a wrong line of
  output. AC-6(e) is the mitigation and it must be an assertion over the filesystem, not a reading
  of the code.
- **R-2 — The parity guard of AC-4 could be written so that it cannot fail.** Two shapes to avoid:
  comparing a directory to itself through a mis-joined path, and comparing name sets while claiming
  bytes. Shown red by editing one byte before it is trusted. Rounds 4 to 6 of Q-0050 produced five
  assertions that could not fail; this is the same class.
- **R-3 — The packed-install proof is the expensive one and the easiest to fake.** Asserting that
  `files` contains `"templates"` proves a manifest key. AC-5(d) requires the fixture to *run*
  `quorum init` from the installed tarballs, which is the only assertion that would have caught M-4.
- **R-4 — Q-0098's shim ordering.** pnpm links a bin shim during *install*, and only where the
  target exists; 078(b) deliberately gives `test` no `^build` edge, so from a clean checkout the
  order is install → test with `dist/` absent. Q-0098 finished by hand for exactly this. AC-5(d)
  extends that fixture and inherits the hazard: build before linking, and say so.
- **R-5 — The verdict of AC-4, AC-5 and AC-8 must be a property of the commit.** A guard that reads
  `packages/cli/dist/templates`, or that requires an import to *fail*, is green in one checkout
  shape and red in another — what Q-0096's E-1 retired an assertion for. None may consult a
  gitignored directory that a build creates, except where the criterion's whole subject is the emit
  and it builds first.
- **R-6 — The `next:` line is unpinned by any spike assertion, so it is the easiest place to
  accidentally rule Q-0100's question.** Preserve it, cite Q-0100, do not improve it.
- **R-7 — `binaryCarriedBy` is validated in two ways that fail separately** — the named counterpart
  must *exist* and must be *collected by an include*. A new suite file placed where nothing collects
  it satisfies the first and fails the second, which is the point of the second
  (`spike-parity.test.ts:1499` and `:1507` pin both).
- **R-8 — A first-pass ticket cannot run the chore flow.** `harness/Q-0093/integration` must exist
  before the first `review` step, because `review` diffs against it and only `integrate`, which runs
  later, creates it (02-sdlc-pipeline-spec.md §5.8, Q-0038). Cut it deliberately from the
  requirements tip rather than from whatever `HEAD` holds, on Q-0037's GA-2 precedent.
- **R-9 — One claim in this document was read and not executed**: AC-3(a)'s `owner: true`, derived
  from `argv.ts:53` and `backlog.ts:189`. It is labelled so rather than presented as a measurement.
  *A sentence in a requirement is a measurement like any other* — Q-0097 got that wrong twice in one
  run, and M-6 above is this document's own instance of the same class.
- **R-10 — AC-4's chain has three links and this document verified two of them.** Links 1 and 3 are
  this ticket's to establish and to read; link 2 — `lint.test.ts:871`'s `SHIPPED` pair — was read at
  this gate and holds today. If it stops holding, AC-4's sufficiency argument fails silently, which
  is why the chain is written into the guard's comment rather than only into this document.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | No key on any path. `frame.source.test.ts`'s credential scan walks this package in **any** extension, so `packages/cli/templates/**` joins it — verified clean at this gate: no `API_KEY`, `apiKey`, `ANTHROPIC_`, `OPENAI_`, `CODEX_`, `bearer`, `credential`, `secret` or `auth-token` anywhere under `spike/templates/`. The scaffold an adopter receives is scanned for the first time as a consequence, which is a gain rather than a cost. |
| **Worktree safety** | n/a to the commands, which write only where the user pointed them, and `init` refuses rather than overwriting. Nothing here writes to `.harness/worktrees/`. |
| **Gate behaviour** | n/a — neither command runs a flow or reaches a gate. The gate reader is Q-0094's. |
| **File format and schema** | `ticket.md`'s frontmatter key order is `Backlog.create`'s and is unchanged. `harness.yaml` is **edited in place**, comments intact — AC-7. `projectConfigSchema` stays declared-and-validated-nowhere (Q-0043 AC-11); `init` writes a template, it does not validate one. No schema or adapter-contract change. |
| **Lint rules** | No flow file changes, so `harness lint` is unaffected. `packages/cli/templates/harness/flows` becomes a fourth directory of shipped flows on disk; AC-4's byte identity with a set already proven to lint clean is what covers it, so no new lint criterion is owed and `lintDirectory` is not pointed at a fourth directory. |
| **Cold-clone impact** | This is the cold-clone path, and it gets **shorter**: `quorum init` and `quorum ticket new` become the first two commands an adopter can run from either supported installation path, where today the frame prints help and returns. 078(d)'s two claims are preserved and the refused third is claimed nowhere. |
| **Product boundaries** | New text says `quorum` for the product and `harness` for the folder and the concept. Ported text keeps its wording with a `Why:` line, and the class is Q-0100's. |

---

## 10. Ground-rule compliance

1. **Spike untouched** — no file under `spike/` changes. `spike/templates/` is *read* by the new
   parity guard and not written. No freeze re-record is owed.
2. **Spike tests untouched** — coverage is *added* under `packages/cli`; `q0080-allocation.js` and
   `q0033-surface.js` keep working until the cutover.
3. **Behaviour preserved** — four defects pinned in AC-3, the ordering and asymmetry in AC-6(b), the
   binary name in AC-13(c). None of Q-0059, Q-0060, Q-0066 or Q-0068 is closed.
4. **`core` first** — checked by name. `Backlog`, `Backlog.create`, `Backlog.nextId`, `loadProject`
   and `parseTicketId` all exist and are reachable, so `ticket new` needs nothing new. The
   scaffolding and the branch probe are **genuinely absent**, reported in M-1, and land in `core`
   rather than in the CLI for the reason M-2 gives.
5. **`spike-parity.test.ts` updated in the same change** — AC-11, two rows, totals re-derived.

---

## 11. Provenance

**The claude candidate is the frame.** Its thirteen criteria, its §2 measurement discipline, its
one-ticket cut and its decision-entry check are carried through largely intact. Its four structural
findings — M-1 (`core` has no scaffolding helper), M-2 (the `IO_MODULE` ban makes `init` unwritable
in `packages/cli`), M-3 (that guard is fail-open against `import.meta.url` while its comment claims
otherwise), M-4 (the templates ship in no tarball, and `build.test.ts`'s `toStrictEqual([EMIT])` goes
red) — were each re-verified against the tree at this gate and each holds. M-4 is the finding without
which the ticket does not work, and neither ticket body nor decision 078 names it.

**The codex candidate is refused on size — 29 criteria against a fifteen ceiling — and four of its
criteria are better than their counterparts and are merged in.**

- Its AC-21 becomes **AC-3(d)**: the `owner` test controls and restores `process.env.USER` rather
  than reading the ambient account. The claude candidate pinned the defect without saying how to
  test it independently of the machine, which would have reproduced the class *"A test's verdict is
  a property of the commit, not of the checkout or the account"* (2026-08-30) inside a criterion
  written to pin a defect.
- Its AC-6 becomes **AC-6(b)**'s ordering clause: the `harness/` refusal precedes the `backlog/`
  creation, so a refusal leaves an absent backlog absent. Verified in the spike source; the claude
  candidate had the asymmetry and not the ordering.
- Its AC-9 sharpens **AC-7**'s fallback table by naming *"Git succeeds but returns no branch name"*
  as its own row — which is the detached-HEAD case the spike fixture asserts explicitly before
  relying on it, and a fixture that fails git instead has not tested it.
- Its AC-11 becomes **AC-2(f)**: the project is resolved through `loadProject`, ancestor discovery
  and `--project` included, with no independently constructed backlog path.
- Its AC-3's *"or prove the shipped assets are derived during packaging"*, its risk about the
  `files` allow-list, and its risks on partial-scaffold and post-allocation races are folded into
  **AC-4**, **AC-5** and **non-goal 11** respectively.

**What was struck from the codex candidate, and why.** Its AC-14 (seven allocation rows), AC-15
(three refusals), AC-16 (grammar), AC-17 (no overwrite), AC-18 (exclusive folder creation), AC-19
(ticket contents), AC-20 (sequential allocation) and AC-23 (reading stays permissive) re-specify
`Backlog.create` and `Backlog.nextId` behaviour that landed with Q-0080 and that
`packages/core/src/backlog/backlog.test.ts` already asserts from `q0080-allocation.json`, the one
table both trees read. Restating them here would produce a second description of the same behaviour,
free to drift from the first — the defect this repository keeps finding — and would price a
presentation layer as though it were the domain. AC-2 claims the binary half instead. Its AC-27
(verification) and AC-28 (cross-cutting constraints) are a run checklist and a boundary statement,
not independently testable criteria; they are §9 and §10 here.

**Its open question 3 is closed rather than carried.** *"What packaging mechanism should derive the
shipped templates?"* is already answered by 078(e): the ruled depth resolves to `<package>/templates/`
and not to `dist/templates/`, and a build-time copy into the emit is deleted by the package's own
`rm -rf dist`. Leaving it open would have spent an implement round choosing a mechanism the ruling
forbids.

**What neither candidate had, and this merge adds.** OQ-1 is answered by execution rather than
deferred — `fs.cpSync` accepts a `file:` URL (AC-8(d)). AC-4 gains the explicit three-link chain that
makes codex's AC-5 unnecessary rather than merely dropped, with the middle link
(`lint.test.ts:871`'s `SHIPPED` pair) read at this gate. And **M-6** records that the claude
candidate's own arithmetic worksheet misreports two registers — `OUTSIDE` is 18 and `DECLARED` is
10, not 19 and 6 — which is the fifth consecutive figure-transcription failure in this cut and the
first inside a requirement rather than inherited from a ticket body. The corrected values are in
AC-12 and Appendix B, marked by whether they were re-counted here.

---

## Appendix A — successor body, to be transcribed into `backlog/Q-0101-…/ticket.md`

*Written out in full rather than referenced, because an obligation recorded only in a closed
ticket's report expires. GO-1.*

---

**Q-0101 — What a ticket's `owner` defaults to, and whether it should default at all**

`Backlog.create` defaults `owner` to `process.env.USER ?? 'unknown'`
(`packages/core/src/backlog/backlog.ts:189`, and the same expression in `spike/src/backlog.js`), so
every ticket allocated by `quorum ticket new` without `--owner` is stamped with the operating-system
account of whoever ran the command.

**It has been corrected by hand three times and reproduced every time**, because nothing about the
correction reaches the code. Five tickets carried `ruudvanengelenhoven` against fifty-four `ruud` and
were normalised on 2026-08-31; it reproduced on the very next invocation, and then on all six of
Q-0010's children at once. Measured again on 2026-09-04: `$USER` is `ruudvanengelenhoven` and all 76
tickets in `backlog/` read `owner: ruud`, which is the state a fourth hand normalisation leaves
behind rather than evidence that anything was fixed.

**The question is not what the default should be but whether there should be one.**
`process.env.USER` is the one value guaranteed *not* to identify the person a ticket belongs to on a
shared machine, in CI, in a container, or in any of the worktree-based steps this repository's own
flows create. Three shapes, and the ticket owes a decision entry before code:

1. **No default.** `owner` is absent from the frontmatter unless `--owner` supplies it. Cheapest, and
   it makes `owner` mean something when it is there. Costs: `ticketSchema` in `packages/shared` must
   permit its absence, and every reader of `meta.owner` must tolerate it — `harness board` among
   them.
2. **Default to a configured value.** `harness.yaml` gains an `owner` key under a snake_case section,
   per *"A config key is camelCase under `adapters.<vendor>` and snake_case everywhere else"*
   (2026-08-31). Costs: it fixes nothing until somebody edits a file, which is the exact objection
   Q-0080's requirements run raised against the same shape for the id prefix, and which it refused on
   measurement.
3. **Default to git's configured `user.name`.** Closest to who the person actually is. Costs: it
   makes an allocation depend on git's identity resolution, which *"A test's verdict is a property of
   the commit, not of the checkout or the account"* (2026-08-30) makes a hazard rather than a
   convenience, and it must not become a test's oracle.

**A fourth defect is adjacent and belongs here**: `--owner` with no following value parses to the
boolean `true` (`packages/cli/src/argv.ts:53`), and `create`'s destructuring default fires only on
`undefined`, so the frontmatter reads `owner: true`. Q-0093 pins it as a preserved defect; whichever
shape wins must say what that spelling does.

**Lands in `spike/src/backlog.js` and `packages/core/src/backlog/backlog.ts` together**, the
Q-0066/Q-0068/Q-0070 shape — a `core`-only fix leaves the tree that actually runs every flow in this
repository still stamping the OS user, and the port loses its independent witness. Whether the 76
existing tickets are re-normalised is part of the decision and not a step to take in passing.

Belongs to M2. Opened at Q-0093's requirements gate, 2026-09-04.

---

## Appendix B — arithmetic worksheet

Everything a criterion moves, with its current value, so the implementer re-derives rather than
guesses and a reviewer can check by eye. **The right-hand column of M-6 applies: the two rows marked
† were the candidate's and were wrong; every row below was counted at this gate.**

| register | file | today | after |
| --- | --- | --- | --- |
| `COMMANDS` | `packages/cli/src/commands.ts` | 4 | 6 |
| `HELP` lines | `packages/cli/src/commands.ts` | 4 | 6 |
| `HANDLERS` keys | `packages/cli/src/main.ts:56` | 4 | 6 |
| command modules | derived in `frame.source.test.ts:67` | `lint.ts`, `runs.ts`, `validate.ts` | + `init.ts`, `ticket.ts` |
| `DOMAIN` | `frame.source.test.ts:214` | 20 | 21 |
| `ERRORS` | `package.test.ts:340` | 4 | 5 |
| `domain()` length | `package.test.ts:345` | 20 | 21 |
| `@quorum/core` barrel keys | `packages/core/src/index.ts` | 24 | 26 |
| `COMMAND_DOMAIN` rows | `frame.source.test.ts:234` | 3 | 5 |
| `files` (`@quorum/cli`) | `packages/cli/package.json` | `["dist"]` | `["dist", "templates"]` |
| `files` assertion | `build.test.ts` | one `[EMIT]` literal for three packages | per-package register |
| `packages/cli/turbo.json` `test` inputs | | 11 | 12 |
| † `OUTSIDE` | `package.test.ts:137` | **18** (candidate said 19) | 19 |
| † `DECLARED` | `package.test.ts:174` | **10** (candidate said 6) | 11 |
| `spike-parity` rows touched | `spike-parity.test.ts:173`, `:283` | `binaryHalf` prose owes Q-0093 | `binaryCarriedBy` names the suites |
| template files | `spike/templates/harness/**` | 20 | 20, mirrored |

**`spike-parity.test.ts` pinned totals** (read at this gate; this ticket edits no `spike/test/` file,
so the expected answer is that none moves — measure it anyway):

| bucket | pinned |
| --- | --- |
| `binary-only` | 220 |
| `both` | 2739 |
| `library-only` | 2469 |
| total | 5428 |
| transfer share | 55% |

**Inherited coverage, re-derived** (do not re-derive from either ticket body, whose figures are M-5):

- `q0080-allocation.js` — **216** lines, **ten** scenarios. Binary half: A7 (`:158`), A8 (`:171`),
  A9 (`:197`) and the `project()` / `cli` / `folders` helpers (`:61–71`), about **67** lines. Library
  half: A1, A3, A4, A5, A6, A6b, already carried by
  `packages/core/src/backlog/backlog.test.ts`. A2 (`:87–98`) is a source-shape assertion about the
  spike binary and translates to a property of `packages/cli` rather than to a test.
- `q0033-surface.js` — **476** lines. This ticket's half: S5.1–S5.7/E5 (`:200–219`) and
  `initFixture` (`:47–54`), about **28** lines. S1.1/S1.2/S1.4 and S2.1–S2.5 are the shipped-asset
  assertions AC-4 mirrors on the workspace side rather than translates.

**Template inventory** (20 files, verified at this gate): `harness.yaml`; `architecture.md`,
`product-context.md`, `rules.md`; `flows/` × 6 — `chore`, `development`, `qa-red`, `requirements`,
`review`, `solutioning`; `roles/` × 10 — `architecture-reviewer`, `automation-qa`, `code-reviewer`,
`developer-backend`, `developer-data`, `developer-frontend`, `developer-generalist`,
`head-of-product`, `principal-architect`, `product-manager`.
