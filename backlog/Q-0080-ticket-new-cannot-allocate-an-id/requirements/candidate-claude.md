# Q-0080 — `harness ticket new` cannot allocate an id, and collides with itself

*Requirements, candidate-claude, 2026-08-30. Every measurement below was taken against the working
tree today; where it contradicts the ticket body, the ticket body is named and corrected, per
"Verify inherited measurements".*

---

## Problem

`nextId()` strips a leading `T-` and nothing else before `parseInt`, in both trees
(`spike/src/backlog.js:50–53`, `packages/core/src/backlog/backlog.ts:143–146` — the ticket says
`:143–147`; `:147` is blank). Every id in this repository is `Q-nnnn`, so every one yields `NaN`,
`filter(Number.isFinite)` drops all of them, `nums` is empty, and the allocator answers `T-0001`.

**Measured today**, by reading `backlog/` with the same predicate `list()` uses:

| what | value |
| --- | --- |
| ticket folders holding a `ticket.md` | **53** |
| distinct id prefixes on disk | `Q-` × 53, nothing else |
| ids surviving `parseInt(String(id).replace(/^T-/, ''), 10)` | **0** |
| `nextId()` for this repository | `T-0001` |
| highest `Q-` number on disk | **80** |
| folders whose name disagrees with their `id:` | 0 |

The ticket body says "all 52 of them". It is 53; the 52 was measured before Q-0080's own folder
existed. Nothing else in that paragraph changes.

### The ticket's stated cause is not the cause, and this is the finding that redirects the work

The ticket says: *"`harness init` then `harness ticket new` is the first thing a stranger does, and
today the second command silently hands out an id that collides with the one before it."*

**That is false, and the regression suite proves it is false by executing it.** In a freshly
`init`-ed repository the backlog is empty, so `nums` is empty and the allocator answers `T-0001`.
The next invocation lists a ticket whose id *is* `T-0001`, which the `T-` strip parses to `1`, so it
answers `T-0002`. The allocator only fails on ids it cannot read — and after the first `ticket new`
there is always one it can.

This is not inference. `spike/test/smoke.js` runs the sequence end to end:

- `:35` — `ticket new 'Subscription downgrade mid-cycle'` into a fresh `init`-ed repository;
- `:42`, `:45`, `:53`, `:67`, `:73` — five flows run against the literal id **`T-0001`**;
- `:90` — a second `ticket new`; `:91` — a flow run against the literal **`T-0002`**;
- `:112–114` — a third; the folder is found by `startsWith('T-0003')`;
- `:193`, `:221`, `:309`, `:341` — four more, each reading its id back out of the command's own
  stdout with `/T-\d{4}/`.

Seven tickets allocated in sequence with no collision, in the suite the engineering rules call the
regression suite, recorded green as recently as Q-0057's merge (spike 16/16, 2026-08-30).

**So the defect is not "the allocator collides on a fresh repo". It is:**

> A backlog whose ids the allocator cannot parse is read as **empty** rather than as an error.

Fifty-three tickets are on disk; the function reports the backlog has none and hands out `T-0001`
every time it is asked. That is the `.claude/rules/engineering.md` rule *"errors are explicit …
never default silently"* broken in the module the product calls its database — and the consequence
the port's own JSDoc names is real: `create()` computes `${id}-${slug}`, calls
`fs.mkdirSync(dir, { recursive: true })`, which is silent on an existing directory, then `write()`
replaces `ticket.md` outright. Two invocations collide on the **id** always, and destroy a ticket
whenever the two titles slug the same.

It stays p1. It has already cost this project three tickets written by hand (Q-0074, Q-0079,
Q-0080 — this one), and it reaches any adopter who arrives with an existing id convention, which is
every adopter migrating from a tracker. But a red phase written from the ticket's version would go
looking for a collision in a fresh repository and find none. **Reproduce it against a backlog whose
ids are not `T-`, which is the only shape that fails.**

### The product already defines what a ticket id is, and `nextId()` contradicts it

`packages/core/src/run-history/reader.ts:29` exports, and `spike/bin/harness.js:130` duplicates:

```
const TICKET_ID_PATTERN = /^[A-Z]+-[0-9]{4}$/;
```

`packages/core/src/run-history/reader.test.ts:291–294` pins it: `Q-0011`, `QA-0049` and `ABC-1234`
are ticket ids; the negatives are not. So the product has shipped a general, tested, prefix-agnostic
definition of a ticket id since Q-0011 — one or more uppercase letters, a hyphen, exactly four
digits — and `harness runs <id>` already resolves against it. The allocator is the only place that
disagrees, and it disagrees by recognising exactly one prefix out of that grammar.

**That changes decision 1 of the ticket.** There is no convention to invent and no key to add: the
fix is to make `nextId()` read an id the way the rest of the product already reads one.

### What pins the empty-backlog answer, which decision 2 asks about

`harness init` (`spike/bin/harness.js:412`) prints, as its own next step:

```
next: harness adapters · harness ticket new "…" · harness run requirements T-0001
```

That sentence is true today only because an empty backlog allocates `T-0001`. Beyond it, roughly
**33** `T-000N` literals across three spike test files depend on the same default — `smoke.js` (17
lines), `q0033-surface.js` (16), `q0036-board-containment.js` (10) — every one of them in a temp
repository built by `init` + `ticket new`. Changing the empty-backlog answer to `Q-` turns the
`init` line into a lie and the suite red, and an implementer who then rewrote those literals would
be changing what is written to `backlog/`, which port-charter §2 calls externally observable.

**So the empty backlog keeps answering `T-0001`** — not because `T-` is a good prefix, but because
it is the one the product already advertises and already executes, and moving it is a separate,
larger and unforced change. This is evidence, not taste, and it is what decision 2 was missing.

---

## User stories

**Maintainer.** As the **solo maintainer** of this repository, I want `harness ticket new` to
allocate the id that follows the 53 tickets already on disk, so that opening a ticket is a command
rather than a hand-written folder — and so that when it cannot, it tells me, instead of quietly
handing me an id that overwrites Q-0001's successor. *Surface: **CLI**, and `backlog/` as the thing
it writes.*

**Cold-clone adopter.** As the **cold-clone adopter** running `quorum` on my own repository for the
first time, I want the second and every later `ticket new` to keep working with no configuration
step, and I want a repository that already has tickets under my own naming to be recognised rather
than treated as empty. *Surface: **CLI**. This is M6's finish line, and it must not gain a
configuration step.*

**Contributor.** As an **adapter contributor** reading `packages/core`, I want one function that
says what a ticket id is, so that a second spelling of the grammar cannot drift from the one
`harness runs` already enforces. *Surface: **`packages/shared`**, which is where the product's pure
string functions already live.*

---

## The shape this requirement specifies

Three rules, and they answer the ticket's four questions between them.

1. **The prefix comes from the ids on disk**, parsed with the product's own grammar. One prefix
   present → allocate within it. This repository allocates `Q-0081` with no configuration, and an
   adopter's `PROJ-0042` backlog allocates `PROJ-0043` with no configuration.
2. **An empty backlog allocates `T-0001`**, unchanged, for the reasons measured above. An empty
   backlog contradicts no evidence, so this default is not a silent one.
3. **A backlog the allocator cannot read refuses**, naming what it found — ids that do not match
   the grammar, or more than one prefix. It does not pick a winner. This is what makes the fix
   satisfy pillar 8 rather than relocate the violation.

And the half that makes the ticket p1 rather than cosmetic: **`create()` refuses an occupied
folder.** Not "allocates the next free id" — allocating around an occupied folder papers over an
allocator that is producing an id already taken, which is the exact state this ticket exists to
make impossible.

`--id` is the escape hatch that makes refusal safe rather than obstructive: it is how a human
allocates during a migration, and it is what the three hand-written tickets did by hand.

### Why not a `harness.yaml` key (the ticket's shape (c))

The ticket calls it *"the only shape that survives both"*. Measured, it does not survive either
cheaply, and it is not needed:

- **It fixes nothing until someone edits a file.** This repository's 53 tickets stay unreadable
  until `harness.yaml` gains a key, and so does every adopter's existing backlog. It converts a
  silent wrong answer into a silent wrong answer *unless configured*, while rule 1 above fixes both
  with zero configuration.
- **`Backlog` has no config to read.** `new Backlog(backlogRoot)` is the whole constructor
  (`packages/core/src/backlog/project.ts:88`, `spike/bin/harness.js:60`), and `backlog.create(…)`
  is called directly with no project in **nine** spike test files (`q0006-engine.js:42`,
  `q0011-run-history.js:42`, `q0034-review-fixes.js:48`, `q0034-chore-preflight.js:45`,
  `q0034-dry-run.js:45`, `q0035-empty-range.js:324`, `q0038-endpoint-preflight.js:47`,
  `q0057-run-scoped-reviews.js:59`, `q0077-base-flag.js:180`) and in `backlog.test.ts`. Threading
  config in is a constructor change with a far larger blast radius than the defect.
- **It lengthens the cold clone**, which pillar 7 says needs a reason, and rule 1 removes the
  reason.
- **`projectConfigSchema` does not want this as its first caller.** Q-0058 owns that hook, and
  `packages/core/src/backlog/project.ts:46–50` records *why* nothing validates today: *"rejecting a
  config that loads today would change what a command prints and its exit code (Q-0043 AC-11)"*.
  Making Q-0080 the first validator drags Q-0058's whole decision into a p1 defect fix. See OQ-4.

The key stays available as a later refinement over a working allocator, and nothing here forecloses
it.

---

## Acceptance criteria

Each is independently testable. Where a criterion names a line, that line was read today.

**AC-1 — One definition of a ticket id, in the package that owns pure string functions.**
A capturing parser lives in `packages/shared` beside `integrationBranch` and `ticketBranchPrefix`
(`packages/shared/src/constants.ts:85–99`) and is exported from `packages/shared/src/index.ts`,
whose header already scopes the package to *"constants and pure functions over strings"*. It
returns the prefix and the number for an id matching `/^[A-Z]+-[0-9]{4}$/`, and a distinguishable
"not an id" for anything else. It reads no file and takes no config.
`packages/core/src/run-history/reader.ts:29` **keeps** exporting `TICKET_ID_PATTERN` unmoved — it
is pinned in an export list at `run-history.source.test.ts:72` and `:76`, and moving it is a
different ticket. If the two spellings coexist, a test asserts they agree on the same corpus.
*Test:* the parser accepts `Q-0011`, `QA-0049`, `ABC-1234` (the three `reader.test.ts:292` already
pins) and rejects `reader.test.ts:293`'s negatives; a table drives both.
*Why here and not in `backlog.ts`:* `backlog.source.test.ts:27–32` pins `backlog.ts`'s exports to
exactly `['Backlog', 'parseFrontmatter', 'renderFrontmatter']`, so a fourth exported name there is
red on arrival. A module-private helper would satisfy that pin and duplicate the grammar in two
trees; `shared` is the placement that satisfies both.

**AC-2 — `nextId()` allocates from the prefix on disk.**
When every parseable id on disk shares one prefix, `nextId()` returns that prefix with one more than
the highest number under it, zero-padded to four digits.
*Test:* a fixture backlog of `Q-0006` and `Q-0043` returns `Q-0044`; one of `PROJ-0001` returns
`PROJ-0002`; one of `T-0006` and `T-0007` returns `T-0008` — the last preserving what the second
half of the pinned test at `backlog.test.ts:348` proves (that the counter works when the prefix
matches), with the mixed-prefix accident removed. See AC-9.
*Verified precondition:* against the real `backlog/` this yields **`Q-0081`**, because the highest
`Q-` number on disk is 80.

**AC-3 — An empty backlog still allocates `T-0001`, and nothing that depends on it moves.**
A backlog with no ticket returns `T-0001`; the ticket created from it returns `T-0002` next, and so
on. The `init` next-step line at `spike/bin/harness.js:412` is unchanged and still true, and no
`T-000N` literal in `spike/test/smoke.js`, `q0033-surface.js` or `q0036-board-containment.js` is
edited.
*Test:* `npm test --prefix spike` passes with those three files byte-identical to `HEAD` — asserted
by diffing them, not by trusting a green run. A run of `harness init` followed by three
`ticket new` invocations yields `T-0001`, `T-0002`, `T-0003`.

**AC-4 — A backlog the allocator cannot read refuses, and says what it found.**
`nextId()` throws rather than answering, in each of these three states, and the message names the
evidence:
 (a) at least one ticket exists and **no** id parses — the message says how many tickets it read and
     quotes up to a bounded sample of the ids it could not parse;
 (b) parseable ids carry **more than one** prefix — the message names every prefix and its count;
 (c) the next number would exceed `9999`, so the id it would return is not one the product's own
     grammar admits — `padStart(4, '0')` produces `T-10000` today, which
     `TICKET_ID_PATTERN` rejects, so `harness runs T-10000` would not resolve the ticket
     `ticket new` had just created.
Each message ends with the action: use `--id`, or reconcile the backlog.
*Test:* three fixture backlogs, one per clause; each asserts the throw, the exit code, and that the
message contains the counts or prefixes it claims. Clause (b) uses a `Q-` + `T-` backlog, which is
the shape `backlog.test.ts:348` builds today.
*Note:* unparseable ids are **read** fine everywhere else — this criterion constrains allocation
only. See AC-7.

**AC-5 — `create()` refuses an occupied folder, and writes nothing when it does.**
When `backlog/<id>-<slug>` already exists, `create()` throws before any write, naming the path and
the id it had allocated. No directory is created, no `ticket.md` is written, and no existing file
under the backlog root changes a byte.
*Test:* create a ticket, then call `create()` again with a title that slugs identically and an id
forced to collide; assert the throw, and assert a `walk()` of the backlog root is byte-identical
before and after — the shape `backlog.test.ts` already uses at `:233` and `:381`.
*Structural note the implementer must not miss:* `fs.mkdirSync(dir, { recursive: true })` also
creates a **missing backlog root** today, because `dir` is `<root>/<folder>`. See AC-6.

**AC-6 — Creating into a backlog root that does not exist still works.**
`create()` against a root that is absent creates the root and the ticket folder, exactly as it does
today. A naive `fs.mkdirSync(dir)` without `recursive` throws `ENOENT` here and would break `harness
ticket new` in any repository where `backlog/` was removed or never created by `init`.
*Test:* the existing `missingBacklog()` helper (`backlog.test.ts:30`, used at `:269`) with a
`create()` call; assert the ticket is on disk and readable.

**AC-7 — Reading is untouched.**
`list()`, `read()`, `dirOf()`, `harness board` and `harness runs` behave exactly as they do today
over ids of any prefix, including mixed ones. The rule this ticket introduces — one backlog, one
prefix — binds **allocation** and nothing else, so nothing in this repository's 53 tickets, in
`.quorum/runs/`, or in any ticket's `history:` is re-read, re-validated or rejected.
*Test:* `harness board` over a mixed `Q-`/`T-` fixture lists both; `harness runs <a Q- id>` still
resolves; `dirOf` still throws its verbatim `ticket not found: X`.

**AC-8 — `harness ticket new` prints one line and exits non-zero; never a stack trace.**
`spike/bin/harness.js:415–421`'s `ticket` case has no `try`/`catch`, and `main().catch((e) =>
die(e.stack ?? String(e)))` at the file's last line means an uncaught throw from `create()` or
`nextId()` reaches the adopter as a Node stack trace. Every refusal from AC-4 and AC-5 is printed
through `die(e.message)` — one red `✗` line, exit code 1, no `at Backlog.nextId` frame — matching
how the `run` case already handles `FlowError` at `:618`.
*Test:* run the CLI against each refusing fixture; assert `status === 1`, assert stderr contains the
message, and assert stderr contains no `\n    at `.
*Why it is its own criterion:* this is the whole cold-clone experience of the fix. A stack trace
tells an adopter the product crashed; a sentence tells them what to do.

**AC-9 — `--id <ID>` allocates explicitly, through the same checks.**
`harness ticket new "<title>" --id Q-0081` skips `nextId()` and uses the given id. It is validated
against AC-1's grammar and refused with a clear message if it does not match, and it goes through
AC-5's occupied-folder refusal unchanged. It never bypasses a check; it only supplies the number.
*Test:* a valid `--id` into a refusing (mixed-prefix) backlog succeeds — which is the point, and the
reason a refusal is not a dead end; a malformed `--id` (`q-1`, `Q-81`, `Q-00081`) refuses; a
colliding `--id` hits AC-5.

**AC-10 — The pins are removed with the defect, and the two rewritten assertions are named.**
The three pins the ticket lists go with the fix, and the change to each is stated rather than
absorbed:
- `packages/core/src/backlog/backlog.ts:135–142` — the `Why:` JSDoc is replaced by documentation of
  the new contract. No transcription of this document into the source (`harness/rules.md`,
  *Comments*): cite, do not copy.
- `backlog.test.ts:348` — *"nextId counts only T- ids, so a Q- backlog restarts at T-0001 —
  carried, not fixed"*. Its **first half inverts** (`Q-0006` + `Q-0043` now yields `Q-0044`) and its
  **second half is rewritten**, because the mixed `Q-`/`T-` backlog it builds is what AC-4(b) now
  refuses. What that half proves — the counter works when the prefix matches — is preserved by
  AC-2's single-prefix `T-0006`/`T-0007` → `T-0008` case. **This is a deliberate change to a landed
  pin and must be called out in the implement summary**, or a reviewer will read it as a pin
  quietly deleted.
- `backlog.test.ts:245` — `expect(readOnly.nextId()).toBe('T-0001')` sits inside the `--dry`
  read-only test over a single-`Q-0001` backlog; it becomes `Q-0002`. The assertion the test exists
  to make — that a stubbed `Backlog` writes nothing — is unaffected.
- The enclosing describe is *"AC-7 — create() and nextId(), with both known defects pinned as they
  are"*. Its **other** defect — `create()` writes a branch NAME and makes no ref, `backlog.test.ts:
  360–365`, register row 19 — is untouched, still passes, and its title still says so. Q-0038 owns
  it.

**AC-11 — Both trees land together and are proven to agree.**
`spike/src/backlog.js` and `packages/core/src/backlog/backlog.ts` change in one commit, per the
Q-0066 / Q-0068 / Q-0070 shape: a fix in one tree alone leaves the other disagreeing until the
cutover, which is the divergence the freeze exists to expose. The port freeze does not bind this
ticket — `harness/port-charter.md:242`'s `children:` list is `Q-0041 … Q-0054` and Q-0080 is not
among them, so `.github/scripts/port-freeze-guard.sh`'s branch-scope half exits 0 reporting **out of
scope** (its header: *"Exit 0 = the half ran and the branch is clear, exempt or out of scope"*).
Q-0057 and Q-0038 are the precedents; **no exemption trailer is added**, because an exemption is for
a child, and adding one here would misreport the reason.
*Test:* one table of `(backlog fixture) → (expected id or refusal)` drives a Vitest case in
`packages/core` and a `spike/test/` case, and the two suites assert the same rows. Both suites run
forced in both environment rows per Q-0072's closing finding — inside the integrate worktree, which
has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main` after the merge.

**AC-12 — The docs move with the rule, and the decision entry is named rather than written.**
`docs/GLOSSARY.md`'s **Ticket** entry states that a ticket id is `<PREFIX>-nnnn`, that a backlog
allocates within the one prefix its tickets already use, that an empty backlog starts at `T-0001`,
and that a backlog the allocator cannot read refuses. `docs/06-development-plan.md`'s working
agreement *"Ticket ids are `Q-nnnn`"* is corrected to say that is this repository's prefix rather
than the product's.
**The implement step writes no decision entry.** `harness/roles/developer-generalist.md:22–24` is
explicit: *"You do not add to docs/decisions/ or its index; a decision is the human's to record, so
if your work implies one, name it in your summary."* The rule *"one backlog, one prefix, and an
allocator that cannot read its backlog refuses"* is a new product rule that later files will cite,
so **an entry is owed** — and this criterion is satisfied by the summary naming it, exactly as
Q-0070's AC-11 did. No criterion in this document requires a decision entry as a precondition, so
no step in the chosen flow can be blocked on work no agent in it may perform — the failure mode
Q-0070's requirements run hit six times and Q-0069's AC-11(b) hit through `.claude/rules/`.

---

## Non-goals

- **The branch-ref half of AC-7's pinned pair.** `create()` writes `branch:` as a name and creates
  no ref. Q-0038 owns it (register row 19), `backlog.test.ts:360–365` pins it, and this change
  leaves it exactly as it is.
- **`dirOf`'s traversing argument (Q-0059) and the frontmatter fail-open (Q-0060)**, the other two
  open defects in this module. Note that Q-0060 is *adjacent*: a damaged `ticket.md` reads as
  `{ meta: {}, body: text }`, so its id is `undefined`, which AC-4(a) will now count among the
  unparseable. That interaction is deliberate and desirable — a backlog with a damaged ticket refuses
  to allocate rather than silently ignoring it — but fixing `parseFrontmatter` stays Q-0060's.
- **Any backfill, rename or migration of an existing ticket folder.** Every id on disk stays as it
  is. This repository's next ticket is `Q-0081` and its previous 53 are untouched.
- **A `harness.yaml` key**, for the reasons measured above, and **any change to
  `projectConfigSchema` or to `loadProject`'s deliberate non-validation** (Q-0043 AC-11, Q-0058).
- **Moving or widening `TICKET_ID_PATTERN`** in `packages/core/src/run-history/reader.ts`. It is
  pinned in an export list at `run-history.source.test.ts:72` and `:76`, and a second consumer is a
  reason to *agree with* it, not to relocate it.
- **The mock adapter's own hard-coded prefix.** `packages/core/src/adapters/mock.ts:89` and
  `spike/src/adapters/mock.js:44` both read
  `(prompt.match(/^# Ticket (T-\d+)/m) ?? [])[1] ?? 'T-0000'`, so a mock run on any non-`T-` ticket
  already derives its fan-out task ids from the fallback `T-0000` — producing `src/T-0000.1.ts`
  against a `Q-` ticket. **This is pre-existing and this change does not make it any more
  reachable**, since every real ticket here is already `Q-`. It is reported, not fixed: it is
  another module, it is the vehicle for the fan-out fixtures in both suites
  (`mock.test.ts:287–321`), and it bounds what an end-to-end criterion could assert under a
  non-`T-` prefix — which is why no criterion above runs a mock *flow* under one. Successor
  candidate; see OQ-3.
- **Concurrency.** Two simultaneous `ticket new` invocations can both read the backlog before either
  writes, so AC-5's check-then-create is a TOCTOU. It is not made worse by this change and Q-0039
  (*one run at a time per ticket*) owns the general question. Not defended against here, and stated
  rather than implied.
- **Anything on the v1 exclusion list.** No multi-user, no remote daemon, no cloud sync.

---

## Open questions

**OQ-1 — Does a mixed-prefix backlog refuse, or pick the most common prefix? (Owner: head of
product, at the requirements gate. Blocking, because the answer rewrites a landed pin.)**
This document recommends **refuse** (AC-4(b)). Picking a winner needs a tie-break rule nobody has
written, and it is a silent default in exactly the module whose defect this ticket is. Refusal is
made survivable by `--id` (AC-9), and reading is untouched (AC-7), so a maintainer mid-migration is
inconvenienced for one flag rather than blocked. The cost, stated plainly: the second half of
`backlog.test.ts:348` is rewritten rather than kept verbatim, against the ticket body's *"both
halves are load-bearing"*. AC-10 preserves what that half proves and says so; if the gate prefers
the pin kept byte-for-byte, the rule must soften to most-common-prefix and AC-4(b) is struck.

**OQ-2 — Which flow does this ticket run? (Owner: head of product, at the gate. Non-blocking.)**
Recommend the **chore flow**, on the precedent of Q-0038 and Q-0057 — both changed shipped
behaviour in `spike/src` and both ran chore. The tension is real and should be named rather than
ignored: `harness/roles/developer-generalist.md:15–17` tells the implementer *"If the work turns out
to change behaviour rather than machinery, say so: that ticket belongs in the full pipeline, not
here"*, and this ticket does change what a shipped command does. The practical argument for chore is
that the change is two functions and a table of fixtures, and a solutioning stage would emit
contracts nobody needs. **Operational precondition either way:** the chore flow's `review` step
diffs against `harness/Q-0080/integration`, which only `integrate` creates, so the branch must exist
before the first run — and Q-0038 measured what happens otherwise: `ensureWorktree` cuts a worktree
from `HEAD` silently when a step's declared `base:` does not resolve, so the implementer is not
stopped, it is paid to work in the wrong place.

**OQ-3 — Does the mock adapter's `T-` assumption want its own ticket? (Owner: engineering.
Non-blocking.)**
Recommend yes, opened from this ticket's report rather than resolved in it, and per *"Resolve, don't
open successors"* the test is whether it changes a verdict: it does — it decides whether an
end-to-end criterion may run a mock flow under a non-`T-` id, which is why AC-11's table is a unit
table rather than a flow run. If the gate would rather fold it in, it is a one-line regex in each
tree plus the `mock.test.ts:287–321` fan-out fixtures, and it should then get its own criterion here
rather than riding along.

**OQ-4 — Is Q-0058 still the ticket that gives `projectConfigSchema` its first caller? (Owner:
engineering. Non-blocking.)**
This document says yes, and deliberately declines the hook the Q-0080 ticket body offers. The two
should still be read together — but this fix needs no config, and making a p1 defect fix the vehicle
for the first config validation drags in the decision `project.ts:46–50` records as deliberately
unmade.

**OQ-5 — Above `9999`. (Owner: engineering. Non-blocking.)**
AC-4(c) refuses. The alternative is to widen the id grammar to five digits, which touches
`TICKET_ID_PATTERN` and its pinned export — a different ticket. At 53 tickets this is ~9,900 away,
so refusing costs nothing today and never returns a wrong answer; it is the lowest-value criterion
in this document and the first to strike if the gate wants the ticket smaller.

---

## Risks

**R-1 — The change looks like a one-line regex swap, and quietly moves the empty-backlog default.**
The highest-probability failure. An implementer who generalises `replace(/^T-/, '')` to
`replace(/^[A-Z]+-/, '')` and leaves the return as `` `T-${…}` `` gets this repository right by
accident and every adopter wrong; one who also changes the literal to a derived prefix without a
floor turns ~33 `T-000N` assertions across three spike files red — and then "fixes" the suite by
rewriting them, which is a change to what is written to `backlog/` and therefore charter §2
externally observable behaviour. AC-3 exists to make that impossible to do quietly: the three files
must come out byte-identical to `HEAD`.

**R-2 — A reviewer blocks the rewritten pin, correctly.** `backlog.test.ts:348`'s comment says
*"carried, not fixed"* and the ticket body says both halves are load-bearing. AC-10 authorises the
change and states what replaces it; if the implement summary does not repeat that, the review loop
will spend a round on it. Per *"An erratum is the last repair, not the first"* (2026-08-30), this is
handled by writing the criterion clearly now, not by an erratum later.

**R-3 — `mkdirSync`'s two jobs.** `recursive: true` is doing two things: creating the missing
backlog root, and swallowing an existing ticket folder. AC-5 wants the second gone and AC-6 wants
the first kept. Dropping `recursive` alone satisfies AC-5 and breaks AC-6, and no existing test
covers the combination — `missingBacklog()` (`backlog.test.ts:30`) is used at `:269` for `list()`
and `dirOf()`, not for `create()`. Both criteria are needed or the fix is half-right with a green
suite.

**R-4 — A refusal reaches the adopter as a stack trace.** `main().catch((e) => die(e.stack ??
String(e)))` is the last line of `spike/bin/harness.js`, and the `ticket` case has no `try`. Every
criterion above that says "refuses" produces a Node stack unless AC-8 is implemented, and AC-8 is
the easiest criterion in this document to satisfy on paper and miss in fact, because a thrown error
*is* reported — just not as a sentence. Assert the absence of `\n    at ` and not merely the
presence of the message.

**R-5 — Someone reaches for the config key mid-implementation.** It is the ticket body's own
preferred shape, so an implementer may treat this document's rejection of it as an oversight and
add it "while they are there" — changing a `Backlog` constructor that nine spike test files call
directly. It is a non-goal above for that reason, and the implement summary should confirm the
constructor signature is unchanged.

**R-6 — The two trees drift.** A fix in `packages/core` alone passes `pnpm turbo run test` and
leaves `spike` — which is what actually runs every flow in this repository today — still handing out
`T-0001`. AC-11's shared fixture table is the guard; both suites must run, forced, in both
environment rows.

**R-7 — This document's own executed claim is second-hand.** The smoke-test sequence at
`smoke.js:35/90–91/112–114` is read from source, and its greenness is taken from the record
(spike 16/16 at Q-0057's merge, 2026-08-30) rather than from a run inside this requirements step.
Per *"A check is not established by reading it"* (2026-08-29), **the red phase re-runs
`npm test --prefix spike` and confirms the `T-0001` → `T-0002` → `T-0003` sequence before AC-3 is
written against it.** Named here so it is checked rather than inherited.

---

## Cross-cutting checklist

| pillar | answer |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked and no credential path is touched. `check()`'s API-key refusal is unaffected. |
| **Safety by construction** | n/a to worktrees — `create()` writes under the backlog root only, and this change writes strictly *less* than today (it refuses where it used to overwrite). No branch or worktree is created; AC-10 keeps Q-0038's missing-ref defect untouched. |
| **Human-gated by default** | n/a. No gate, no loop bound, no `auto` behaviour changes. |
| **Files are the database** | Directly the subject. The change makes the one writer of the ticket database refuse rather than overwrite, and stores no index, cache or allocated-id counter — the next id stays derived from the folders on every call, exactly as it is today. |
| **Cross-vendor rule** | n/a to the code. Applies to the ticket's own run: the review step must be a different vendor from the implementer, which the chosen flow's panel already enforces. |
| **Product-agnostic** | Improved. `T-` and `Q-` both stop being the product's business: the prefix is whatever the adopter's backlog already uses. AC-12 corrects `06-development-plan.md`'s working agreement, which currently states this repository's convention as the product's. |
| **Errors are explicit** | The point of the ticket. Three states that answer silently today throw with the evidence (AC-4), one that overwrites silently refuses (AC-5), and all of them print one line rather than a stack (AC-8). |
| **Cold-clone test** | Net neutral to positive, and deliberately so. No new configuration step, no new file to read, the `init` next-step line stays true, and the empty-backlog path is byte-identical to today (AC-3). The only new surface is `--id`, which an adopter never needs to type. |
| **File format and its schema** | `ticket.md` is unchanged — same ten frontmatter fields, same key order, same emitter. `ticketSchema.id` stays `z.string()` (`packages/shared/src/ticket.ts:52`); this change constrains what is *allocated*, never what is *accepted on read*, so none of the 53 tickets on disk is re-validated. |
| **Lint rules** | None added or changed. `spike/**` stays outside ESLint (`harness/rules.md`), so the new spike code has no lint gate — the `packages/` half carries the type-aware deprecation rule as usual. |
