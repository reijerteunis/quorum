# Q-0080 — `harness ticket new` cannot allocate an id, and collides with itself

*Requirements, merged at the head-of-product gate, 2026-08-30. Merged from `candidate-claude.md`
and `candidate-codex.md`. Every measurement below was re-taken against the working tree at this
gate, per "Verify inherited measurements"; where it contradicts the ticket body or either
candidate, the source is named and corrected rather than silently overwritten.*

---

## Problem

`nextId()` strips a leading `T-` and nothing else before `parseInt`, in both trees
(`spike/src/backlog.js:50–53`; `packages/core/src/backlog/backlog.ts:143–146` — the ticket body
says `:143–147`, but `:147` is blank and `:135–142` is the JSDoc). Every id in this repository is
`Q-nnnn`, so every one yields `NaN`, `filter(Number.isFinite)` drops all of them, `nums` is empty,
and the allocator answers `T-0001` on every call.

**Measured at this gate**, reading `backlog/` with the same predicate `list()` uses:

| what | value |
| --- | --- |
| ticket folders holding a `ticket.md` | **53** |
| distinct prefixes on disk | `Q-` × 53, nothing else |
| frontmatter ids failing `/^[A-Z]+-[0-9]{4}$/` | **0** |
| folders whose name disagrees with their `id:` | **0** |
| ids surviving `parseInt(String(id).replace(/^T-/, ''), 10)` | **0** |
| `nextId()` for this repository, today | `T-0001` |
| highest `Q-` number on disk | **0080** |
| `nextId()` for this repository, after the fix | **`Q-0081`** |

The ticket body says "all 52 of them". It is 53 — the 52 was counted before Q-0080's own folder
existed. Nothing else in that paragraph changes.

The last two rows matter beyond arithmetic: **every id on disk parses, and there is exactly one
prefix**, so the refusal rule this document introduces fires nowhere in this repository. The fix
takes this backlog from `T-0001` to `Q-0081` with nothing to reconcile and no migration.

### The ticket's stated cause is not the cause

The ticket says: *"`harness init` then `harness ticket new` is the first thing a stranger does, and
today the second command silently hands out an id that collides with the one before it."*

**That is false, and the regression suite proves it by executing it.** In a freshly `init`-ed
repository the backlog is empty, so the allocator answers `T-0001`; the next invocation lists a
ticket whose id *is* `T-0001`, which the `T-` strip parses to `1`, so it answers `T-0002`. The
allocator only fails on ids it cannot read — and after the first `ticket new` there is always one it
can. `spike/test/smoke.js` runs the sequence: `:35` creates the first ticket, `:90` the second and
`:112` the third, and `:193`, `:221`, `:309` and `:341` each read a fresh id back out of the
command's own stdout with `/T-\d{4}/`.

**So the defect is not "the allocator collides on a fresh repo". It is:**

> A backlog whose ids the allocator cannot parse is read as **empty** rather than as an error.

Fifty-three tickets are on disk; the function reports none and hands out `T-0001` every time. That
is `.claude/rules/engineering.md`'s *"errors are explicit … never default silently"* broken in the
module the product calls its database — and the consequence the port's own JSDoc names is real:
`create()` computes `${id}-${slug}`, calls `fs.mkdirSync(dir, { recursive: true })`, which is silent
on an existing directory, then `write()` replaces `ticket.md` outright. Two invocations collide on
the **id** always, and destroy a ticket whenever the two titles slug the same.

It stays p1: it has already cost this project three tickets written by hand (Q-0074, Q-0079,
Q-0080), and it reaches every adopter arriving with an existing id convention. But **a red phase
written from the ticket's version would look for a collision in a fresh repository and find none.**
Reproduce it against a backlog whose ids are not `T-`, which is the only shape that fails.

### The product already defines what a ticket id is, and `nextId()` is the only dissenter

`packages/core/src/run-history/reader.ts:29` exports, and `spike/bin/harness.js:130` duplicates:

```
const TICKET_ID_PATTERN = /^[A-Z]+-[0-9]{4}$/;
```

`reader.test.ts:291–294` pins it — `Q-0011`, `QA-0049` and `ABC-1234` are ticket ids; eight
negatives are not — and `spike/bin/harness.js:569` already resolves `harness runs <token>` against
it. So the product has shipped a general, tested, prefix-agnostic definition since Q-0011. The
allocator disagrees by recognising exactly one prefix out of that grammar.

**That settles decision 1 of the ticket.** There is no convention to invent and no key to add: make
`nextId()` read an id the way the rest of the product already reads one.

### What pins the empty-backlog answer, which decision 2 asks about

`harness init` (`spike/bin/harness.js:412`) prints as its own next step:

```
next: harness adapters · harness ticket new "…" · harness run requirements T-0001
```

That sentence is true today only because an empty backlog allocates `T-0001`. **Both candidates
undercounted what else depends on it.** Measured at this gate:

| site | `T-000N` literals |
| --- | --- |
| `spike/test/smoke.js` | 18 |
| `spike/test/q0033-surface.js` | 16 |
| `spike/test/q0036-board-containment.js` | 10 |
| `spike/test/q0006-engine.js` | **6** — missed by candidate-claude |
| **spike total** | **50** |

and four further sites in `packages/core`: `backlog.test.ts:342`'s slug assertion, which strips
`/^T-\d{4}-/`; `backlog.test.ts:363–364`, which asserts `harness/T-0001/integration` and the folder
`T-0001-branchless`; `fanout.test.ts:273–281`; and `adapters/mock.test.ts`. Every one of these is a
temp repository built by `init` + `ticket new`, or a direct `backlog.create()` into an empty root.

`backlog.test.ts:363–364` is decisive: it is the **Q-0038-owned branch-ref pin** that the ticket
says in as many words *"this ticket must not disturb"*. Moving the empty-backlog default to `Q-`
turns it red.

**So the empty backlog keeps answering `T-0001`** — not because `T-` is a good prefix, but because
it is the one the product already advertises and already executes, moving it is a separate and
larger change, and moving it breaks the one pin this ticket is forbidden to touch. That is evidence,
not taste, and it is what decision 2 was missing.

---

## User stories

**Maintainer.** As the **solo maintainer**, I want `harness ticket new` to allocate the id that
follows the 53 tickets already on disk, so that opening a ticket is a command rather than a
hand-written folder — and so that when it cannot, it tells me, instead of quietly handing me an id
that overwrites the ticket before it. *Surface: **CLI**, and `backlog/` as what it writes.*

**Cold-clone adopter.** As the **cold-clone adopter** running Quorum on my own repository for the
first time, I want every `ticket new` to work with no configuration step, and a repository that
already has tickets under my own naming to be recognised rather than treated as empty.
*Surface: **CLI**. This is M6's finish line and must not gain a configuration step.*

**Contributor.** As a **contributor** reading either tree, I want one spelling of the ticket-id
grammar per tree, so that a second spelling cannot drift from the one `harness runs` already
enforces. *Surface: **`packages/shared`** and **`spike/src`**.*

---

## The shape this gate rules

Four rules, which between them answer the ticket's four questions.

1. **The prefix comes from the ids on disk**, parsed with the product's own grammar. One prefix
   present → allocate within it. This repository allocates `Q-0081` with no configuration; an
   adopter's `PROJ-0042` backlog allocates `PROJ-0043` with no configuration.
2. **An empty backlog allocates `T-0001`**, unchanged, for the reasons measured above. An empty
   backlog contradicts no evidence, so this default is not a silent one.
3. **A backlog the allocator cannot read refuses**, naming what it found. It does not pick a
   winner. This is what makes the fix satisfy *"errors are explicit"* rather than relocate the
   violation — and `--id` is the escape hatch that makes refusal survivable rather than obstructive.
4. **`create()` refuses a taken id or an occupied folder.** Not "allocates the next free id":
   allocating around an occupied folder papers over an allocator producing an id already taken,
   which is the exact state this ticket exists to make impossible.

### Why not a `harness.yaml` key — candidate-codex's shape, refused on measurement

The ticket body calls it *"the only shape that survives both"*. It survives neither cheaply, and it
is not needed:

- **It fixes nothing until someone edits a file.** This repository's 53 tickets stay unreadable
  until `harness.yaml` gains a key, and so does every adopter's existing backlog. It converts a
  silent wrong answer into a silent wrong answer *unless configured*, while rule 1 fixes both with
  zero configuration.
- **`Backlog` has no config to read.** `constructor(root: string)` is the whole of it
  (`backlog.ts:92`), and `backlog.create(…)` is called with no project in **nine** spike test files
  (`q0006-engine.js`, `q0011-run-history.js`, `q0034-review-fixes.js`, `q0034-chore-preflight.js`,
  `q0034-dry-run.js`, `q0035-empty-range.js`, `q0038-endpoint-preflight.js`,
  `q0057-run-scoped-reviews.js`, `q0077-base-flag.js`) and throughout `backlog.test.ts`. Threading
  config in is a constructor change with a far larger blast radius than the defect.
- **`projectConfigSchema` does not want this as its first caller.** `backlog.source.test.ts:115`
  asserts `loadProject` does **not** call `projectConfigSchema.parse(`, and `project.ts:46–50`
  records why: *"rejecting a config that loads today would change what a command prints and its exit
  code (Q-0043 AC-11)"*. Making a p1 defect fix the vehicle for the first config validation drags
  Q-0058's whole decision into it.
- **It lengthens the cold clone**, which needs a reason, and rule 1 removes the reason.
- **Its own internal contradiction.** Candidate-codex AC-4 requires an empty backlog to allocate
  `Q-0001` while AC-15 requires `backlog.test.ts:363–364` to stay *"unchanged and green"*; that test
  asserts `harness/T-0001/integration`. The two cannot both hold.

The key stays available as a later refinement over a working allocator, and nothing here forecloses
it.

---

## Acceptance criteria

Twelve, each independently testable. Where a criterion names a line, that line was read at this
gate.

**AC-1 — One grammar per tree, and neither tree gains a third spelling.**
A capturing parser returns the prefix and the number for an id matching `/^[A-Z]+-[0-9]{4}$/`, and
a distinguishable "not an id" for anything else. It reads no file, spawns nothing and takes no
config.
- In `packages/`: it lives in `packages/shared` beside `integrationBranch` and `ticketBranchPrefix`
  (`constants.ts:85–99`), whose header already scopes the package to *"constants and pure functions
  over strings"*, and is exported from `index.ts`. It cannot live in `backlog.ts`:
  `backlog.source.test.ts:27–32` pins that module's exports to exactly
  `['Backlog', 'parseFrontmatter', 'renderFrontmatter']`, so a fourth name there is red on arrival.
- In `spike/`: `spike/` is **not** a workspace member — `pnpm-workspace.yaml` is `packages/*` and
  `apps/*`, and nothing under `spike/src` or `spike/bin` imports from `packages/`. So the spike
  needs its own, as a module-level export in `spike/src/backlog.js` beside the existing `STAGES`.
  **`spike/bin/harness.js:130`'s `TICKET_ID_PATTERN` must not become a third spelling**: either
  `harness.js` imports the one in `backlog.js`, or a spike test asserts the two are identical.
- `packages/core/src/run-history/reader.ts:29` **keeps** exporting `TICKET_ID_PATTERN` unmoved — it
  is pinned in an export list at `run-history.source.test.ts:72` and `:76`, and a second consumer is
  a reason to agree with it, not to relocate it. A test asserts the `packages/` spellings agree over
  one corpus.
*Test:* one table drives every spelling in both trees — accepts `Q-0011`, `QA-0049`, `ABC-1234`;
rejects `reader.test.ts:293`'s eight negatives (`q-0011`, `Q-11`, `Q-00111`, `Q-0011-1`, ` Q-0011`,
`Q-0011 `, `Q0011`, `0011-Q`).

**AC-2 — `nextId()` allocates within the one prefix on disk.**
When every parseable id shares one prefix, `nextId()` returns that prefix with one more than the
highest number under it, zero-padded to four digits. Matching is exact and case-sensitive, and the
maximum is taken numerically, not by string order.
*Test rows:*
| fixture backlog | expected |
| --- | --- |
| `Q-0006`, `Q-0043` | `Q-0044` |
| `PROJ-0001` | `PROJ-0002` |
| `T-0006`, `T-0007` | `T-0008` — preserves what the second half of the pin at `backlog.test.ts:348` proves |
| `Q-0001`, `Q-0003` | `Q-0004` — the gap is not filled |
| `Q-0002`, `Q-0010` | `Q-0011` — numeric, not lexicographic |
| `Q-0005` plus `Q-12`, `Q-00081`, `q-0081`, `Q-0002-extra`, `Q-ABCD` | `Q-0006` — none of the five advances the counter |
*Verified precondition:* against the real `backlog/` this yields **`Q-0081`**.

**AC-3 — An empty backlog still allocates `T-0001`, and nothing that depends on it moves.**
An empty backlog returns `T-0001`; the ticket created from it returns `T-0002` next, and so on.
`spike/bin/harness.js:412`'s `init` next-step line is unchanged and still true.
*Test:* the four spike test files that carry `T-000N` literals — `smoke.js` (18), `q0033-surface.js`
(16), `q0036-board-containment.js` (10), `q0006-engine.js` (6) — come out **byte-identical to
`HEAD`**, asserted by diffing them rather than by trusting a green run; and the `T-` expectations at
`backlog.test.ts:342`, `backlog.test.ts:363–364`, `fanout.test.ts:273–281` and
`adapters/mock.test.ts` are unchanged. `harness init` followed by three `ticket new` invocations
yields `T-0001`, `T-0002`, `T-0003`, each in its own folder.

**AC-4 — A backlog the allocator cannot read refuses, and says what it found.**
`nextId()` throws rather than answering, in each of three states, and the message names the
evidence:
 (a) at least one ticket exists and **no** id parses — the message says how many tickets it read and
     quotes a bounded sample of the ids it could not parse;
 (b) parseable ids carry **more than one** prefix — the message names every prefix and its count;
 (c) the next number would exceed `9999` — `padStart(4, '0')` produces `T-10000`, which the
     grammar rejects, so `harness runs T-10000` (`spike/bin/harness.js:569`) would not resolve the
     ticket `ticket new` had just created.
Each message ends with the action: use `--id`, or reconcile the backlog.
*Test:* three fixture backlogs, one per clause; each asserts the throw and that the message contains
the counts or prefixes it claims. Clause (b) uses the `Q-` + `T-` shape `backlog.test.ts:348` builds
today.
*Scope note:* unparseable ids are **read** fine everywhere else. This constrains allocation only —
see AC-7.

**AC-5 — `create()` refuses a taken id or an occupied folder, and writes nothing when it does.**
Three sub-claims, all before any write:
 (a) if the proposed id already belongs to a folder — **including one with a different slug** —
     `create()` throws, naming the id and the existing folder;
 (b) if `backlog/<id>-<slug>` already exists, `create()` throws, naming the path;
 (c) the ticket directory is created **exclusively**, and `ticket.md` is opened only after that
     succeeds, so a failed creation can never replace an existing `ticket.md`.
It does not allocate around the collision.
*Test:* a `walk()` of the backlog root is byte-identical before and after each refusal — the shape
`backlog.test.ts` already uses at `:233` and `:381`. Separately, three `ticket new` invocations with
the **same title** from an empty backlog produce three distinct folders and preserve all three
files.
*Structural note the implementer must not miss:* `fs.mkdirSync(dir, { recursive: true })` is doing
two jobs. See AC-6.

**AC-6 — Creating into a backlog root that does not exist still works.**
`create()` against an absent root creates the root and the ticket folder, exactly as today. A naive
`fs.mkdirSync(dir)` without `recursive` satisfies AC-5 and throws `ENOENT` here, breaking
`harness ticket new` in any repository where `backlog/` was removed or never created.
*Test:* the existing `missingBacklog()` helper (`backlog.test.ts:30`, used at `:269` for `list()`
and `dirOf()` but never for `create()`) with a `create()` call; assert the ticket is on disk and
readable.

**AC-7 — Reading is untouched.**
`list()`, `read()`, `dirOf()`, `harness board` and `harness runs` behave exactly as today over ids
of any prefix, including mixed ones. The one-backlog-one-prefix rule binds **allocation** and
nothing else, so none of this repository's 53 tickets, nothing in `.quorum/runs/`, and no ticket's
`history:` is re-read, re-validated or rejected. No existing folder is renamed, moved or backfilled.
*Test:* `harness board` over a mixed `Q-`/`T-` fixture lists both; `harness runs <a Q- id>` still
resolves; `dirOf` still throws its verbatim `ticket not found: X`.

**AC-8 — `harness ticket new` prints one line and exits non-zero; never a stack trace.**
`spike/bin/harness.js:415–421`'s `ticket` case has no `try`/`catch`, and the file's last line is
`main().catch((e) => die(e.stack ?? String(e)))`, so an uncaught throw from `create()` or `nextId()`
reaches the adopter as a Node stack. Every refusal from AC-4 and AC-5 is printed through
`die(e.message)` — one red `✗` line, exit code 1 — matching how the `run` case already handles
`FlowError` at `:618`. On success it reports the allocated id and the created folder, as it does
today.
*Test:* run the CLI against each refusing fixture; assert `status === 1`, assert stderr contains the
message, and **assert stderr contains no `\n    at `**. Asserting only the message's presence passes
while a stack is still printed.
*Why its own criterion:* this is the whole cold-clone experience of the fix. A stack trace tells an
adopter the product crashed; a sentence tells them what to do.

**AC-9 — `--id <ID>` allocates explicitly, through the same checks.**
`harness ticket new "<title>" --id Q-0081` skips `nextId()` and uses the given id. The flag does not
exist today. It is validated against AC-1's grammar and refused with a clear message if it does not
match, and it goes through AC-5 unchanged. It never bypasses a check; it only supplies the number.
*Test:* a valid `--id` into a refusing (mixed-prefix) backlog succeeds — which is the point, and why
a refusal is not a dead end; `q-1`, `Q-81` and `Q-00081` are refused; a colliding `--id` hits AC-5.

**AC-10 — The pins are removed with the defect, and every rewrite is named.**
- `backlog.ts:135–142` — the `Why:` JSDoc is replaced by documentation of the new contract. Cite,
  do not copy: no transcription of this document into source (`harness/rules.md`, *Comments*).
- `backlog.test.ts:348` — *"nextId counts only T- ids, so a Q- backlog restarts at T-0001 — carried,
  not fixed"*. Its **first half inverts** (`Q-0006` + `Q-0043` now yields `Q-0044`) and its **second
  half is rewritten**, because the mixed `Q-`/`T-` backlog it builds is what AC-4(b) now refuses.
  What that half proves — the counter works when the prefix matches — is preserved by AC-2's
  single-prefix `T-0006`/`T-0007` → `T-0008` row. **This is a deliberate change to a landed pin and
  must be called out in the implement summary**, or a reviewer will read it as a pin quietly
  deleted.
- `backlog.test.ts:245` — `expect(readOnly.nextId()).toBe('T-0001')`, inside the `--dry` read-only
  test over a single-`Q-0001` backlog; it becomes `Q-0002`. What that test exists to prove — a
  stubbed `Backlog` writes nothing — is unaffected.
- The enclosing describe is *"AC-7 — create() and nextId(), with both known defects pinned as they
  are"*. Its **other** defect — `create()` writes a branch NAME and makes no ref,
  `backlog.test.ts:360–365`, register row 19 — is **untouched, still green, and its title still says
  so**. Q-0038 owns it. AC-3 is what keeps it green.

**AC-11 — Both trees land together and are proven to agree.**
`spike/src/backlog.js` and `packages/core/src/backlog/backlog.ts` change in one commit, per the
Q-0066 / Q-0068 / Q-0070 shape: a fix in one tree alone leaves the other disagreeing until the
cutover, which is the divergence the freeze exists to expose. The port freeze does not bind this
ticket — `harness/port-charter.md:242`'s `children:` list is `Q-0041 … Q-0054` and Q-0080 is not
among them, so the branch-scope guard exits 0 reporting **out of scope**. Q-0057 and Q-0038 are the
precedents; **no exemption trailer is added**, because an exemption is for a child and would
misreport the reason.
*Test:* one table of `(backlog fixture) → (expected id or refusal)` drives a Vitest case in
`packages/core` and a case in `spike/test/`, and the two suites assert the same rows. Both suites
run forced in both environment rows per Q-0072's closing finding — inside the integrate worktree,
which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` after the merge.

**AC-12 — The docs move with the rule, and the decision entry is named rather than written.**
`docs/GLOSSARY.md`'s **Ticket** entry states that a ticket id is `<PREFIX>-nnnn` matching
`/^[A-Z]+-[0-9]{4}$/`, that a backlog allocates within the one prefix its tickets already use, that
an empty backlog starts at `T-0001`, and that a backlog the allocator cannot read refuses.
`docs/06-development-plan.md:785`'s working agreement *"Ticket ids are `Q-nnnn`"* is corrected to
say that is this repository's prefix rather than the product's.
**The implement step writes no decision entry.** `harness/roles/developer-generalist.md:22–24` is
explicit: *"You do not add to docs/decisions/ or its index; a decision is the human's to record, so
if your work implies one, name it in your summary."* The rule *"one backlog, one prefix, and an
allocator that cannot read its backlog refuses"* is a new product rule later files will cite, so
**an entry is owed** — and this criterion is satisfied by the summary naming it, exactly as
Q-0070's AC-11 did. **No criterion in this document requires a decision entry as a precondition**,
so no step in the chosen flow can be blocked on work no agent in it may perform — the failure mode
Q-0070's requirements run hit six times and Q-0069's AC-11(b) hit through `.claude/rules/`.

---

## Non-goals

- **The branch-ref half of AC-7's pinned pair.** `create()` writes `branch:` as a name and creates
  no ref. Q-0038 owns it (register row 19); `backlog.test.ts:360–365` pins it; this change leaves it
  exactly as it is, which is what AC-3 protects.
- **`dirOf`'s traversing argument (Q-0059) and the frontmatter fail-open (Q-0060)**, the other two
  open defects in this module. Q-0060 is *adjacent*: a damaged `ticket.md` reads as
  `{ meta: {}, body: text }`, so its id is `undefined` and AC-4(a) will now count it among the
  unparseable. That interaction is deliberate and desirable — a backlog with a damaged ticket
  refuses to allocate rather than silently ignoring it — but fixing `parseFrontmatter` stays
  Q-0060's. **Measured:** zero tickets on disk are in that state today, so this changes nothing here
  and now.
- **Any backfill, rename or migration of an existing ticket folder.** Every id on disk stays as it
  is. This repository's next ticket is `Q-0081` and its previous 53 are untouched.
- **Rejecting a backlog merely for containing historical mixed prefixes.** Reading stays legal
  (AC-7); only allocation refuses.
- **A `harness.yaml` key**, for the reasons measured above, and **any change to
  `projectConfigSchema`, to `loadProject`'s deliberate non-validation (`backlog.source.test.ts:115`,
  Q-0043 AC-11, Q-0058), or to `Backlog`'s constructor signature.**
- **Moving or widening `TICKET_ID_PATTERN`** in `packages/core/src/run-history/reader.ts`. It is
  pinned in an export list at `run-history.source.test.ts:72` and `:76`. Widening the grammar past
  four digits is a different ticket — see OQ-3.
- **A command that changes the prefix after the fact.** There is no prefix to change; it is derived.
- **The mock adapter's own hard-coded prefix.** `packages/core/src/adapters/mock.ts:89` and
  `spike/src/adapters/mock.js:44` both read `(prompt.match(/^# Ticket (T-\d+)/m) ?? [])[1] ??
  'T-0000'`, so a mock run on any non-`T-` ticket already derives its fan-out task ids from the
  fallback `T-0000`. **Pre-existing, and this change does not make it any more reachable**, since
  every real ticket here is already `Q-`. Reported, not fixed: it is another module, it is the
  vehicle for the fan-out fixtures in both suites (`mock.test.ts:146–156, 271–287`), and it bounds
  what an end-to-end criterion could assert under a non-`T-` prefix — which is why AC-11's table is
  a unit table rather than a flow run. Successor candidate; see OQ-4.
- **Concurrency.** Two simultaneous `ticket new` invocations can both read the backlog before either
  writes, so AC-5's check-then-create is a TOCTOU. It is not made worse by this change; AC-5(c)'s
  exclusive directory creation narrows but does not close it, because two different titles produce
  two different folders. Q-0039 (*one run at a time per ticket*) owns the general question. Stated
  rather than implied, so sequential safety is not mistaken for concurrency safety.
- **Anything on the v1 exclusion list.** No multi-user, no remote daemon, no cloud sync, no new
  dependency.

---

## Open questions

All five are ruled here. **None blocks solutioning.**

**OQ-1 — Mixed prefixes: refuse, or pick the most common? — RULED: refuse.**
Picking a winner needs a tie-break rule nobody has written, and it is a silent default in exactly
the module whose defect this ticket is. Refusal is made survivable by `--id` (AC-9) and reading is
untouched (AC-7), so a maintainer mid-migration is inconvenienced for one flag rather than blocked.
**The cost, stated plainly:** the second half of `backlog.test.ts:348` is rewritten rather than kept
verbatim, against the ticket body's *"both halves are load-bearing"*. AC-10 authorises that and
AC-2's `T-0006`/`T-0007` row preserves what it proves. **Measured mitigation:** zero mixed-prefix
backlogs exist here, so the refusal fires nowhere in this repository.

**OQ-2 — Which flow? — RULED: chore.**
On the precedent of Q-0038 and Q-0057, both of which changed shipped behaviour in `spike/src` and
both of which ran chore. The tension is named rather than ignored:
`harness/roles/developer-generalist.md:15–17` tells the implementer *"if the work turns out to
change behaviour rather than machinery, say so"*, and this does change what a shipped command does.
The practical argument is that the change is two functions and a table of fixtures, and a
solutioning stage would emit contracts nobody needs.
**Operational precondition:** the chore flow's `review` step diffs against
`harness/Q-0080/integration`, which only `integrate` creates, so **the branch must exist before the
first run**. Q-0038 measured what happens otherwise: `ensureWorktree` silently cuts a worktree from
`HEAD` when a step's declared `base:` does not resolve, so the implementer is not stopped — it is
paid to work in the wrong place.

**OQ-3 — Above `9999`. — RULED: refuse (AC-4(c)).**
The alternative is widening the id grammar to five digits, which touches `TICKET_ID_PATTERN` and its
pinned export — a different ticket. At 53 tickets this is ~9,900 away, so refusing costs nothing
today and never returns a wrong answer. It is the lowest-value criterion here and the first to
strike if the ticket must shrink.

**OQ-4 — Does the mock adapter's `T-` assumption want its own ticket? (Owner: engineering.
Non-blocking.) — RULED: yes, opened from this ticket's report rather than folded in.**
Per *"Resolve, don't open successors"* the test is whether it changes a verdict, and it does: it
decides whether an end-to-end criterion may run a mock flow under a non-`T-` id, which is why
AC-11's table is a unit table. No criterion above depends on it, so it does not block.

**OQ-5 — Is Q-0058 still the ticket that gives `projectConfigSchema` its first caller? (Owner:
engineering. Non-blocking.) — RULED: yes.**
This document deliberately declines the hook the ticket body offers. The two should still be read
together, but this fix needs no config, and making a p1 defect fix the vehicle for the first config
validation drags in the decision `project.ts:46–50` records as deliberately unmade.

---

## Risks

**R-1 — The change looks like a one-line regex swap, and quietly moves the empty-backlog default.**
The highest-probability failure. An implementer who generalises `replace(/^T-/, '')` to
`replace(/^[A-Z]+-/, '')` and leaves the return as `` `T-${…}` `` gets this repository right by
accident and every adopter wrong; one who also derives the prefix without a floor turns **50** `T-`
assertions across four spike files red — plus four sites in `packages/core` — and then "fixes" the
suite by rewriting them, which changes what is written to `backlog/` and is charter §2 externally
observable behaviour. AC-3 makes that impossible to do quietly: the four files must come out
byte-identical to `HEAD`.

**R-2 — A reviewer blocks the rewritten pin, correctly.** `backlog.test.ts:348`'s comment says
*"carried, not fixed"* and the ticket body says both halves are load-bearing. AC-10 authorises the
change and states what replaces it; if the implement summary does not repeat that, the review loop
spends a round on it. Per *"An erratum is the last repair, not the first"* (2026-08-30), this is
handled by writing the criterion clearly now, not by an erratum later.

**R-3 — `mkdirSync`'s two jobs.** `recursive: true` creates the missing backlog root *and* swallows
an existing ticket folder. AC-5 wants the second gone and AC-6 wants the first kept. Dropping
`recursive` alone satisfies AC-5 and breaks AC-6, and no existing test covers the combination —
`missingBacklog()` is used at `:269` for `list()` and `dirOf()`, never for `create()`. Both criteria
are needed or the fix is half-right with a green suite.

**R-4 — A refusal reaches the adopter as a stack trace.** `main().catch((e) => die(e.stack ??
String(e)))` is the last line of `spike/bin/harness.js` and the `ticket` case has no `try`. Every
"refuses" above produces a Node stack unless AC-8 is implemented, and AC-8 is the easiest criterion
here to satisfy on paper and miss in fact, because a thrown error *is* reported — just not as a
sentence. Assert the absence of `\n    at `, not merely the presence of the message.

**R-5 — The spike gains a third spelling of the grammar.** `packages/shared` is unreachable from
`spike/` (`pnpm-workspace.yaml` is `packages/*` + `apps/*`), and `spike/bin/harness.js:130` already
holds a copy. An implementer adding a fourth constant in `spike/src/backlog.js` and leaving
`harness.js` alone leaves two spellings in one tree that can drift. AC-1's last clause is the guard.

**R-6 — Someone reaches for the config key mid-implementation.** It is the ticket body's own
preferred shape, so an implementer may read this document's rejection as an oversight and add it
"while they are there" — changing a `Backlog` constructor that nine spike test files call directly.
It is a non-goal for that reason, and the implement summary should confirm the constructor signature
is unchanged.

**R-7 — The two trees drift.** A fix in `packages/core` alone passes `pnpm turbo run test` and
leaves `spike` — which is what actually runs every flow in this repository today — still handing out
`T-0001`. AC-11's shared fixture table is the guard; both suites must run, forced, in both
environment rows.

**R-8 — Mixed numeric suffixes are not a defect.** Under AC-7, `T-0001` and `Q-0001` can coexist as
distinct ids because the prefix is part of the id. Any consumer that compares only the numeric
suffix would be exposing a **separate** defect; nothing in this change creates or worsens it.
Contributed by candidate-codex and worth keeping visible.

**R-9 — This document's executed claim is second-hand.** The smoke-test sequence at `smoke.js:35`,
`:90`, `:112` is read from source, and its greenness is taken from the record (spike 16/16 at
Q-0057's merge, 2026-08-30) rather than from a run inside this gate. Per *"A check is not
established by reading it"* (2026-08-29), **the red phase re-runs `npm test --prefix spike` and
confirms the `T-0001` → `T-0002` → `T-0003` sequence before AC-3 is written against it.**

---

## Cross-cutting checklist

| pillar | answer |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked and no credential path is touched; `check()`'s API-key refusal is unaffected. |
| **Safety by construction** | n/a to worktrees — `create()` writes under the backlog root only, and this change writes strictly *less* than today (it refuses where it used to overwrite). No branch or worktree is created; AC-10 keeps Q-0038's missing-ref defect untouched. |
| **Human-gated by default** | n/a. No gate, no loop bound, no `auto` behaviour changes. |
| **Files are the database** | Directly the subject. The one writer of the ticket database refuses rather than overwrites, and stores no index, cache, lock or allocated-id counter — the next id stays derived from the folders on every call, exactly as today. |
| **Cross-vendor rule** | n/a to the code. Applies to this ticket's own run: the review step must be a different vendor from the implementer, which the chore flow's panel enforces. |
| **Product-agnostic** | Improved. `T-` and `Q-` both stop being the product's business: the prefix is whatever the adopter's backlog already uses. AC-12 corrects `06-development-plan.md:785`, which currently states this repository's convention as the product's. |
| **Errors are explicit** | The point of the ticket. Three states that answer silently today throw with the evidence (AC-4), two that overwrite silently refuse (AC-5), and all of them print one line rather than a stack (AC-8). |
| **Cold-clone test** | Net neutral to positive, deliberately. No new configuration step, no new file to read, the `init` next-step line stays true, and the empty-backlog path is byte-identical to today (AC-3). The only new surface is `--id`, which an adopter never needs to type. |
| **File format and its schema** | `ticket.md` is unchanged — same ten frontmatter fields, same key order, same emitter. `ticketSchema.id` stays `z.string()` (`packages/shared/src/ticket.ts:52`); this constrains what is *allocated*, never what is *accepted on read*, so none of the 53 tickets on disk is re-validated. |
| **Lint rules** | None added or changed. `spike/**` stays outside ESLint (`harness/rules.md`), so the new spike code has no lint gate; the `packages/` half carries the type-aware deprecation rule as usual. |

---

## Provenance

**Candidate-claude supplied the design and most of the evidence**, and wins the central question.
Its three decisive contributions: the discovery that `TICKET_ID_PATTERN` is an already-shipped,
already-tested, prefix-agnostic definition of a ticket id, which dissolves the ticket's decision 1;
the measured argument that the empty backlog must keep answering `T-0001`, which settles decision 2
with evidence rather than taste; and the correction that the ticket's own stated cause is false —
a fresh repository does **not** collide, and a red phase written from the ticket body would find
nothing. Its AC-1 placement reasoning (`backlog.source.test.ts:27–32` forbids a fourth export), its
AC-6 (`mkdirSync`'s two jobs), its AC-8 (no stack trace), its AC-10 (pins named individually) and
its risk register are carried close to verbatim.

**Candidate-codex supplied coverage claude lacked**, and five of its criteria are merged in:
an existing **id** blocks creation regardless of slug (its 8 → AC-5(a); claude checked only the
folder); exclusive directory creation ordered before `ticket.md` is opened (its 10 → AC-5(c));
no gap-filling (its 7 → AC-2); exact, case-sensitive matching with explicit near-miss rows (its 5 →
AC-2); and sequential uniqueness through the CLI including the repeated-title case (its 11 → AC-3
and AC-5). Its concurrency non-goal and its mixed-numeric-suffix risk (R-8) are kept in its own
framing, which was sharper than claude's.

**Candidate-codex's central shape — a required `ticketPrefix` in `harness.yaml` — is refused**, on
four measurements: `Backlog`'s constructor takes a root and nothing else and is called directly in
nine spike test files; `backlog.source.test.ts:115` pins that `loadProject` does not validate;
a required field would need every checked-in fixture migrated (its own blocking OQ-1, which the
chosen shape dissolves rather than answers); and its AC-4 contradicts its own AC-15, because an
empty backlog answering `Q-0001` turns `backlog.test.ts:363–364` — the Q-0038-owned pin the ticket
forbids disturbing — red. Its 19 criteria were also past the size band, with several
(18, 19, and half of 17) restating standing rules rather than stating testable claims.

**This gate contributed four corrections neither candidate had.** The `T-` blast radius is 50
literals across **four** spike files and four further sites in `packages/core`, not 33 across three
— `q0006-engine.js`, `backlog.test.ts:342`'s slug regex, `backlog.test.ts:363–364`,
`fanout.test.ts` and `mock.test.ts` were all missed, and the second of those is what makes AC-3
load-bearing rather than conservative. `packages/shared` cannot be the single home for the grammar,
because `spike/` is outside the pnpm workspace and imports nothing from `packages/`, so AC-1 gained
its per-tree clause and the guard against `harness.js:130` becoming a third spelling. Every id on
disk was verified to parse and to agree with its folder name, which is why the new refusal rule
fires nowhere here and needs no migration. And the ticket body's own line references were re-derived:
it is 53 ids not 52, and `backlog.ts:143–146` not `:143–147`.
