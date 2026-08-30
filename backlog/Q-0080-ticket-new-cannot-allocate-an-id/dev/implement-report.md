# Q-0080 — implement report

*Chore flow, implement step, iteration 1. No review report from an earlier round is present, so this
is a first pass and not a revision round.*

Both trees changed in one commit. Nine files: seven modified, two added.

---

## 1. What shipped, in one paragraph

`nextId()` no longer strips a leading `T-` and reads everything else as unparseable. It parses each
id with the product's own grammar, allocates within the one prefix the backlog's tickets already
carry, keeps `T-0001` for an empty backlog, and **throws with the evidence** in the three states it
used to answer silently. `create()` refuses a taken id or an occupied folder *before* writing
anything, creates the ticket directory **exclusively**, and still creates a missing backlog root.
`harness ticket new` gained `--id <ID>` and a `try`/`catch`, so every refusal is one red line and
exit 1 rather than a Node stack. The grammar is spelled **once per tree**, and one shared fixture
table drives both suites.

---

## 2. File by file

### `packages/shared/src/constants.ts` (+27, −2)

A new `// ---------- the ticket id ----------` section between the occurrence helpers and the branch
helpers — the placement AC-1 names, beside `integrationBranch` and `ticketBranchPrefix`, inside the
module whose own header already scopes it to *"values and pure functions over strings"*.

- `TicketIdParts` — `{ prefix, number }`.
- `parseTicketId(value: unknown): TicketIdParts | null` — `/^([A-Z]+)-([0-9]{4})$/`, the capturing
  form of `reader.ts`'s `TICKET_ID_PATTERN`. `null` is the distinguishable *"not an id"*. It takes
  `unknown` and coerces with `String(value)` deliberately: Q-0060's fail-open `ticket.md` carries no
  `id` at all, and AC-4(a) has to be able to **count** that rather than crash on it.

Exported from `index.ts` with no edit, because `index.ts` already does `export * from
'./constants.js'`. Nothing here names `@quorum/`, so `index.test.ts`'s workspace-import guard is
unaffected.

Two comment corrections in the same file, because **this change is what made them wrong**: the
`spike/src/backlog.js` line citations on `integrationBranch` (`:64` → `:129`) and `RUNS_LOG_FILE`
(`:94` → `:159`). Both re-measured, not shifted by pattern. See §7 for the citations I did **not**
touch and why.

### `packages/core/src/backlog/backlog.ts` (+96, −14)

- Imports `parseTicketId` beside `RUNS_LOG_FILE` and `integrationBranch`. **No new export** — the
  module's public surface is still exactly `Backlog`, `parseFrontmatter`, `renderFrontmatter`, which
  is what `backlog.source.test.ts:27–32` pins.
- `NewTicket` gained an optional `id?: string` with its own JSDoc. An interface field is type-only,
  so the export pin above is untouched.
- **`nextId()`** — the `Why:` JSDoc naming the preserved defect is replaced by documentation of the
  new contract plus a `@throws` clause. The body: empty backlog → `T-0001` (with a one-line `Why:`
  citing `harness init`'s own next-step sentence); parse every id; refuse if none parses; refuse if
  more than one prefix does; otherwise `prefix` + `max + 1` padded to four. **The overflow check
  asks the grammar rather than re-spelling "four digits"** — it builds the candidate and refuses it
  if `parseTicketId` does, which is AC-4(c) written as one fact instead of two that can drift.
- **`create()`** — validates an explicit `id` against the grammar; checks the exact folder, then the
  id, both read-only and both before any `mkdir`; then `mkdirSync(this.root, { recursive: true })`
  followed by `mkdirSync(dir)` **without** `recursive`. That is R-3's two jobs split into two calls:
  the root is still created (AC-6) and the ticket directory is created exclusively (AC-5(c)), so
  `ticket.md` is opened only once the call owns the folder. The Q-0038 `Why:` line about `branch`
  being a name is kept verbatim.
- Four module-private message helpers beside `walk`, plus `ACTION`, `FORM` and `SAMPLE`. The
  unparseable-sample is **sorted before it is cut**, so the sentence does not depend on `readdir`
  order — which is what lets the shared table assert the whole message rather than a fragment.

### `spike/src/backlog.js` (+70, −7)

The same change, function for function and message for message. `parseTicketId` is a module-level
export beside `STAGES` (AC-1's spike clause). The comments are `//` blocks, matching this file's
existing style rather than importing `core`'s JSDoc conventions into the spike.

### `spike/bin/harness.js` (+12, −6)

- Header line 3 documents `[--id Q-0081]`; the `usage:` string matches it.
- `const TICKET_ID_PATTERN = /^[A-Z]+-[0-9]{4}$/;` at `:130` is **deleted**, replaced by a two-line
  pointer comment. `:569`'s `TICKET_ID_PATTERN.test(token)` is now `parseTicketId(token)`.
  Semantically identical for a string, which `token` always is — `harness runs` behaviour is
  unchanged. This is AC-1's first option ("`harness.js` imports the one in `backlog.js`") rather than
  its second, because it leaves **nothing to drift**: one regex in the whole tree, asserted.
- The `ticket` case wraps `backlog.create` in `try`/`catch` → `die(e.message)`, and threads
  `--id`. `flags.id === undefined ? undefined : String(flags.id)` handles the bare `--id`, which the
  argument parser sets to `true`: `String(true)` is `'true'`, which the grammar refuses with the
  ordinary one-line message rather than needing a branch of its own.

### `spike/test/q0080-allocation.json` — **new**

The one copy of the allocation table. Eleven rows of `(backlog fixture) → (id or the whole refusal
message)`, plus the grammar corpus (three accepts, `reader.test.ts:293`'s eight rejects). It is a
`.json` rather than a `.js` so `spike/test/run.js`, which discovers `*.js`, does not execute it.

**Why it lives in `spike/test/`.** It belongs to neither tree. `contracts/Q-0080/` — the
`contracts/Q-0050/run-messages.fixture.json` precedent — is **outside this role's allowed paths**,
so it was not an option. `spike/test/` is, and `packages/core/turbo.json` already declares
`../../spike/test/**` (Q-0079), so the core suite's read of it is hashed with **no turbo.json edit**.
That is asserted rather than assumed — see §5.3.

### `spike/test/q0080-allocation.js` — **new**

Nine scenarios, A1–A9. Drives the shared table through the spike's `Backlog`, and covers the CLI
half end to end: `init` + three `ticket new`, the three refusal shapes through the process (exit 1,
message present, **no `\n    at `**), `--id` valid and invalid, a colliding `--id`, and `board` /
`runs` / `read` / `dirOf` over a mixed backlog.

### `packages/core/src/backlog/backlog.test.ts` (+133, −10)

Two pins rewritten (§3), one `describe` title corrected (§3), and a new
`describe('Q-0080 — one backlog, one prefix, and an allocator that refuses rather than guessing')`
with seven cases driving the **same** shared table plus the grammar-agreement, refusal, AC-6, AC-9
and AC-7 cases. `TABLE` is `JSON.parse(repoFile('spike/test/q0080-allocation.json'))`, not a
transcription.

### `docs/GLOSSARY.md`, `docs/06-development-plan.md` (AC-12)

The **Ticket** entry now states the grammar, that the prefix is the adopter's and is derived, that an
empty backlog starts at `T-0001`, that an unreadable backlog refuses, that `--id` exists, and that
**reading is not constrained by any of it**. The working agreement at `06:785` now says `Q-` is this
repository's prefix rather than the product's, and 06's status line is bumped with what changed and
why — a living document edited in place, per the docs rule.

---

## 3. The pin changes, called out — R-2

The requirement predicts a reviewer blocking these, correctly, unless they are named. **All three
are deliberate and authorised by AC-10.**

1. **`backlog.test.ts:348` — inverted and rewritten.** Was *"nextId counts only T- ids, so a Q-
   backlog restarts at T-0001 — carried, not fixed"*, asserting `T-0001` over `Q-0006`/`Q-0043` and
   then `T-0008` once a `T-0007` joined them. The **first half inverts**: `Q-0044`. The **second half
   is rewritten**, because the mixed `Q-`/`T-` backlog it built is precisely what AC-4(b) now
   refuses; it asserts the refusal instead. What that half proved — *the counter works when the
   prefix matches* — is preserved by the shared table's `T-0006`/`T-0007` → `T-0008` row (OQ-1's
   stated cost, paid where the requirement said to pay it). The test carries a comment saying all of
   this, so a future reader does not have to reconstruct it.
2. **`backlog.test.ts:245` — `T-0001` → `Q-0002`.** Inside the `--dry` read-only test over a
   single-`Q-0001` backlog. What that test exists to prove — a stubbed `Backlog` writes nothing — is
   untouched, and its `walk()` comparison is unchanged.
3. **The enclosing `describe` title changed**, from *"AC-7 — create() and nextId(), with both known
   defects pinned as they are"* to *"AC-7 — create() and nextId(), with Q-0038's branch-ref defect
   pinned as it is"*. AC-10 requires the other defect to be *"untouched, still green, and its title
   still says so"*; the **test's** title still says so, verbatim, and is green. The **describe's**
   title claimed *both* defects were still pinned, which stopped being true the moment this ticket
   landed — leaving it would have been a false claim in a heading, which is the class of thing this
   repository's decisions exist to prevent. If the reviewer reads AC-10 as forbidding this edit, it
   reverts in one line and nothing else moves.

**Q-0038's pin is untouched.** `create writes a branch NAME and makes no ref, no worktree and no
second directory` (`:360–365`, register row 19) asserts `harness/T-0001/integration` and the folder
`T-0001-branchless` — both still exact, because AC-3 keeps the empty-backlog default at `T-`.

---

## 4. Criterion by criterion

| | where it is satisfied |
| --- | --- |
| **AC-1** | `parseTicketId` in `packages/shared/src/constants.ts`, exported through `index.ts`; the spike twin in `spike/src/backlog.js` beside `STAGES`; `spike/bin/harness.js:130`'s copy **deleted** and `:569` routed through the one spelling. `reader.ts`'s `TICKET_ID_PATTERN` is **unmoved and unwidened**. Guards: A2 asserts the grammar shape appears **zero** times in `spike/bin/harness.js` and **exactly once** in `spike/src/backlog.js`; the core case asserts `parseTicketId` and `TICKET_ID_PATTERN` agree over one corpus, row by row. |
| **AC-2** | Six rows of the shared table — `Q-0044`, `PROJ-0002`, `T-0008`, the unfilled gap, the numeric maximum, and the five near-misses that advance nothing. Asserted in both suites. |
| **AC-3** | `nextId()` returns `T-0001` for an empty backlog; table row 1. `init` + three `ticket new` → `T-0001`/`T-0002`/`T-0003` in three folders (spike A7) and the same through `create()` (core). `spike/bin/harness.js`'s `init` next-step line is unchanged. The four `T-`-literal spike files are **byte-identical to `HEAD`** — see §5.2. |
| **AC-4** | Three clauses, four rows (the sample bound gets its own row). Each row asserts the **whole message**, not a substring, and each message ends with `pass --id <ID> or reconcile the backlog`. |
| **AC-5** | `create()` refuses (a) a taken id including a differing slug, (b) the exact folder by path, (c) creates the directory exclusively before opening `ticket.md`. `walk()` byte-identical across both refusals in both suites; three same-title `ticket new` invocations produce three folders and preserve all three files. |
| **AC-6** | `missingBacklog()` + `create()` — the combination the requirement measured as uncovered (`:269` reached `list()` and `dirOf()` and never `create()`). Both suites. |
| **AC-7** | `list()`, `read()`, `dirOf()`, `board` and `runs` over a mixed and partly **unreadable** backlog; `dirOf` still throws its verbatim `ticket not found: X`. No folder renamed, moved or backfilled. |
| **AC-8** | The `ticket` case's `try`/`catch` → `die(e.message)`. A8 asserts `status === 1`, the message present, **and the absence of `\n    at `** — separately, on all three refusal shapes. |
| **AC-9** | `--id` validated against the grammar in `create()` (core, not the CLI, so `packages/server` inherits it); a valid `--id` **succeeds into a mixed backlog that `nextId()` refuses**, which is the whole point of the flag; `q-1`, `Q-81`, `Q-00081` refused; a colliding `--id` falls through to AC-5. |
| **AC-10** | §3. |
| **AC-11** | Both trees in one change, one shared table, both suites forced in both environment rows — §5.4. **No exemption trailer added:** the port freeze's `children:` list is Q-0041–Q-0054 and Q-0080 is not among them, so the branch-scope guard reports out of scope, which is Q-0057's and Q-0038's precedent. |
| **AC-12** | `docs/GLOSSARY.md`'s **Ticket** entry and `docs/06-development-plan.md:785`, with 06's status line bumped. **No decision entry written** — §6. |

---

## 5. Verification, executed rather than read

### 5.1 The red phase, twice, isolating each half

The new spike suite was run against `HEAD`'s source with everything else current.

Against `HEAD`'s `nextId`/`create` (with the new grammar export grafted on so the file still loads):
**A3, A4, A6, A8, A9 fail; A1, A2, A5, A7 pass.** The two that pass are exactly the behaviours the
requirement forbids moving — AC-6's missing-root creation and AC-3's `T-0001`/`T-0002`/`T-0003`
sequence — which is the discrimination R-1 asks for: a suite that went entirely red here would have
proved nothing about whether the empty-backlog default moved.

Against `HEAD`'s CLI with the new allocator: **A2, A8, A9 fail** — the grammar spelled twice, the
stack trace, and the missing flag.

Against pure `HEAD`, the file does not load at all (`does not provide an export named
'parseTicketId'`), which is why the finer two runs were done.

### 5.2 AC-3's byte-identity, diffed rather than trusted

`git diff HEAD` over `spike/test/smoke.js`, `spike/test/q0033-surface.js`,
`spike/test/q0036-board-containment.js`, `spike/test/q0006-engine.js`,
`packages/core/src/fanout/fanout.test.ts` and `packages/core/src/adapters/mock.test.ts` is **empty**.
`backlog.test.ts:342`'s `/^T-\d{4}-/` slug regex and `:363–364`'s `harness/T-0001/integration` are
unchanged and green.

### 5.3 The turbo-inputs guard was shown to fire, not assumed to

*"A check is not established by reading it"* (2026-08-29). With `"../../spike/test/**"` removed from
`packages/core/turbo.json`, clause B names the new read by file and literal:

```
packages/core/src/backlog/backlog.test.ts: spike/test/q0080-allocation.json
```

in three separate tests, and clause A names `spike/test/q0080-allocation.js`. Restored, the guard is
63/63 green and `packages/core/turbo.json` is **unmodified in this change**.

### 5.4 Both environment rows, forced (Q-0072's closing finding)

This worktree had **neither** `.harness/worktrees` nor `.quorum/runs`. Everything was run there
first, then both directories were created inside it and everything re-run forced, then they were
removed again (both are gitignored; `git status` is clean of them).

| | neither present | both present |
| --- | --- | --- |
| `pnpm turbo run test --force` | 7/7 tasks, **0 cached** — core 43 files / 976 passed, 2 skipped | 7/7, 0 cached |
| `pnpm turbo run lint typecheck --force` | 14/14, 0 cached | 14/14, 0 cached |
| `npm test --prefix spike` | 17/17 test files | 17/17 |
| `node spike/bin/harness.js lint` | — | 6/6 flows |

Final combined run: `pnpm turbo run test lint typecheck --force` → **21/21 tasks, 0 cached**. The two
skipped core tests are the real-CLI probes, which skip without `QUORUM_REAL_CLI` as they always have.

### 5.5 The requirement's verified precondition holds

Through the spike tree, against this repository's real `backlog/`:

```
tickets on disk: 53
prefixes: [ [ 'Q', 53 ] ]
folder disagreements: []
nextId(): Q-0081
```

**Stated rather than implied:** that measurement was taken through `spike/src/backlog.js` — the tree
that actually runs every flow here. `packages/core`'s answer is bound to it by AC-11's shared table
rather than by a second live measurement, because a test asserting `Q-0081` over the real backlog
would be a fact about this repository that the next landing changes, which the
permanent-acceptance-test decision (2026-08-23) forbids.

---

## 6. A decision entry is owed, and I wrote none

`harness/roles/developer-generalist.md` is explicit that a decision is the human's to record, so per
AC-12 this criterion is satisfied by **naming** it here, exactly as Q-0070's AC-11 did:

> **One backlog, one prefix, and an allocator that cannot read its backlog refuses.**
> The prefix is derived from the ids on disk and is the adopter's, not the product's; an empty
> backlog allocates `T-0001` because that is the id `harness init` already advertises; a backlog in
> which nothing parses, or in which more than one prefix does, is **refused with the evidence**
> rather than reported as empty; and `create()` refuses a taken id or an occupied folder instead of
> allocating around either. The alternatives measured and refused were a `harness.yaml` key (fixes
> nothing until someone edits a file, and drags Q-0058's undecided validation question into a p1
> defect fix) and picking the most common prefix (a silent default, in the module whose silent
> default this ticket is about).

**No criterion in the requirement made a decision entry a precondition**, so no step of this flow was
blocked on work no agent in it may perform — the failure mode Q-0070 hit six times.

---

## 7. What I deliberately left alone

### 7.1 The non-goals, confirmed untouched

- **Q-0038's branch-ref half.** `create()` still writes `branch:` as a name and creates no ref.
- **`dirOf`'s traversing argument (Q-0059)** and **the frontmatter fail-open (Q-0060)**. Q-0060
  *interacts*, as the requirement predicted and desired: a damaged `ticket.md` has an `id` of
  `undefined`, `parseTicketId` counts it as unparseable, and AC-4(a) therefore refuses rather than
  silently ignoring it. Zero tickets on disk are in that state today.
- **No backfill, rename or migration.** Every one of the 53 folders is exactly as it was.
- **`Backlog`'s constructor signature is unchanged** — `constructor(root: string)`, still the whole
  of it (R-6). No config is threaded, `projectConfigSchema` gains no caller, `loadProject`'s
  deliberate non-validation is untouched, and `backlog.source.test.ts:115` is green.
- **`ticketSchema.id` is still `z.string()`.** This constrains what is *allocated*, never what is
  *accepted on read*.
- **`reader.ts`'s `TICKET_ID_PATTERN`** is unmoved, unwidened, and still in its pinned export list.
- **The mock adapter's hard-coded `T-`** (`mock.ts:89`, `mock.js:44`) is untouched — see §8.
- **Concurrency.** AC-5's check-then-create is still a TOCTOU; `mkdirSync(dir)` without `recursive`
  narrows it (two invocations racing on the *same* folder now have exactly one winner) but does not
  close it, because two different titles produce two different folders under one id. Q-0039 owns the
  general question. Sequential safety is not concurrency safety.

### 7.2 Thirteen line citations this change made stale, listed but not swept

Deleting one line at `spike/bin/harness.js:130` and expanding the `ticket` case shifts that file:
**old 131–416 → +1, old 422+ → +6** (verified at three anchors: `TERMINAL_STATUSES` 131→132,
`printReport` 388→389, the `runs` token test 569→575). Inserting the grammar into
`spike/src/backlog.js` shifts it: **12→47, 34→68, 50→89, 64→129, 94→159**.

I corrected the two citations that live in a file **this change already edits**
(`packages/shared/src/constants.ts`). I did **not** edit eleven files I was not sent to change, per
the role's scope rule; nothing asserts any of these numbers, and this repository re-derives line maps
per ticket. The complete corrected list, so a sweep is mechanical if the human wants one:

| file | cites | should now read |
| --- | --- | --- |
| `packages/core/src/run-history/reader.ts:15` | `harness.js:130-200`, `:547-554` | `:131-201`, `:553-560` |
| `packages/shared/src/ticket.ts:36` | `harness.js:131` | `:132` |
| `packages/core/src/lint/lint.ts:12` | `harness.js:374` | `:375` |
| `packages/core/src/lint/lint.test.ts:828` | `harness.js:376-384` | `:377-385` |
| `packages/shared/src/constants.test.ts:69` | `harness.js:431` | `:437` |
| `packages/shared/src/stages.ts:6` | `harness.js:434` | `:440` |
| `packages/core/src/contracts/contracts.ts:15` | `harness.js:488–516` | `:494–522` |
| `packages/core/src/contracts/validate-artifact.test.ts:143` | `harness.js:488–516` | `:494–522` |
| `packages/core/src/contracts/contracts.ts:146` | `harness.js:494`, `:510` | `:500`, `:516` |
| `packages/core/src/contracts/schema-cache.test.ts:45` | `harness.js:500` | `:506` |
| `packages/core/src/contracts/run-manifest.ts:12` | `harness.js:266–355` | `:267–356` |
| `packages/core/src/lint/lint.test.ts:901` | `harness.js:605` | `:611` |
| `packages/core/src/adapters/override.ts:2` | `harness.js:612` | `:618` |

`docs/06-development-plan.md`'s Q-0059 and Q-0060 entries cite `spike/src/backlog.js:34` and `:12`,
now `:68` and `:47`. Those are inside two open tickets' own bodies and are the human's to move when
those tickets run; I left them.

### 7.3 One measured comment in a neighbouring guard

`packages/core/src/git-identity.test.ts:29` reads *"Measured 2026-08-30: 43 packages files and 17
spike files"*, justifying `CORPUS_FLOOR = 45`. This change adds one spike test file, so the spike
count is now **18**. I left it: the sentence is a dated measurement rather than a live claim, the
floor it justifies still holds by a wide margin (61 against 45), and `git-identity.test.ts` is
Q-0079's guard and not this ticket's subject. Flagged so the reviewer can rule rather than discover.

---

## 8. Carried out of this run

**OQ-4 — the mock adapter assumes a `T-` prefix. Ruled by the requirement as its own ticket; here is
the body so the obligation does not expire.**

> `packages/core/src/adapters/mock.ts:89` and `spike/src/adapters/mock.js:44` both read
> ``(prompt.match(/^# Ticket (T-\d+)/m) ?? [])[1] ?? 'T-0000'``, so a mock run on any non-`T-` ticket
> derives every fan-out task id from the fallback `T-0000`. Pre-existing, and **Q-0080 does not make
> it more reachable** — every real ticket in this repository was already `Q-`, and the allocator
> never handed the mock a `Q-` id because it never handed anyone one. What it *decides* is whether an
> end-to-end criterion may run a mock flow under a non-`T-` id, which is why Q-0080's AC-11 table is a
> unit table rather than a flow run, and why `spike/test/q0080-allocation.js` builds backlogs directly
> instead of driving `harness run --adapter mock`. It lands in both trees together, like Q-0066 and
> Q-0068. It is the vehicle for the fan-out fixtures in both suites (`mock.test.ts:146–156, 271–287`),
> so the fix is not a one-line regex: the question is whether the mock should read the ticket id from
> the prompt at all, or be handed it. p3; nothing in Q-0080 depends on it.

**OQ-5 — Q-0058 remains the ticket that gives `projectConfigSchema` its first caller.** This change
deliberately declined the hook, and nothing here forecloses a `harness.yaml` key later as a
refinement over a working allocator.

**A residual the requirement states and this implementation does not close:** two simultaneous
`ticket new` invocations with *different* titles still both read the backlog before either writes,
and produce two folders under one id. Q-0039 owns it.

---

## 9. Ambiguities and where I chose

Two, both minor, both flagged rather than buried:

1. **AC-3's *"asserted by diffing them rather than by trusting a green run"*** cannot be a shipped
   test — `HEAD` moves. I read it as an instruction to the implementer and executed it (§5.2), and
   shipped the *behavioural* half of AC-3 as tests in both suites instead.
2. **AC-9 does not say where `--id` is validated.** I put the grammar check in `create()` rather than
   in the CLI, so `packages/server` and any other caller inherit it — *"safety is enforced in `core`,
   never in the UI and never by convention"*. The CLI only prints what core threw.
