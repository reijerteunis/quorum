# Q-0018 — Run history lists the runs that finished, and drills into one

*Requirement, run 1, candidate-claude. Measured against the working tree at `429dd2b` on
2026-09-18. Every figure below was re-derived; where it differs from the ticket body, the body's
figure and the method that produced each are both given, because a measurement copied from a
document is not a measurement.*

---

## §0 What was measured, and what moved

The ticket body was written against `61093d1` before the ticket existed. Eleven of its claims were
re-checked. **Seven hold, four moved, and one new finding reframes the central open question.**

### §0.1 Verified unchanged

| Claim | Verdict |
| --- | --- |
| The daemon registers **fifteen** routes | **Holds.** Enumerated over `packages/server/src/*.ts` with test files excluded: 12 `GET`, 3 `POST`. Two are history's. |
| `GET /history` declares no shape and has no consumer | **Holds, and is sharper than stated** — see §0.5. |
| `apps/web` declares the `/history` route with `screenExists: false` and the sentence naming this ticket | **Holds.** `routes.ts` row 11; the rail's **History** entry is one of five still `false`. |
| Nothing serves an occurrence's retained files | **Holds.** No occurrence of `prompt.txt` or `output.txt` anywhere in `packages/server/src`. |
| Events are not persisted, so screen 5 cannot be reused | **Holds.** `writer.ts` names no event. The two identity schemes do not meet — see §0.6, which makes the join *computable in one direction only*. |
| The listing carries **five** fields | **Holds:** `id`, `ticket`, `flow`, `status`, `incomplete`. |
| Retained files are exactly two names, 0 not well-formed UTF-8, some legitimately carrying U+FFFD | **Holds** at 1,779 files: `output.txt` 931, `prompt.txt` 848, **8 empty, 0 non-UTF-8, 14 containing U+FFFD**. |

### §0.2 `incomplete` is 1 of 171, not 0 of 170 — and it is this run

The body says *"`incomplete` is 0 of 170 today"* and writes a criterion off that luck. Measured now:
**171 run directories, 171 readable, 1 incomplete** — `Q-0018-1`, `status: running`, `ended_at:
null`. That is the requirements run producing this document.

This is not pedantry about a drifting count. **The case the body called untestable-from-this-corpus
is the case the corpus is in right now**, and it is the case a reader will meet most often, because
a person opens the history screen *while something is running*. Every rendering criterion below is
written against it rather than around it.

The same run supplies the second half: **exactly one occurrence of 932 has no `output.txt`** —
`Q-0018-1` `pm-claude`, `adapter/running`. `writer.ts` guarantees an empty `output.txt` at
terminalisation, so *no output file* is not a damaged occurrence, it is **an occurrence that has not
finished**. A screen that rendered the two alike would report a live step as broken.

### §0.3 There has never been a `script` occurrence

The body explains the 84 prompt-less occurrences as *"a script or an integrate step"*. Measured over
932 occurrences, the kinds are **`adapter` 848 and `integrate` 84, and nothing else**. `script` is a
legal `OccurrenceKind` this repository has never produced.

So the correspondence is exact and worth stating as a fact rather than a tendency: **`prompt.txt`
count (848) equals the adapter-occurrence count (848), and every one of the 84 occurrences with no
prompt is an `integrate`** — 77 `completed`, 7 `failed`. A screen may render *this step was not an
adapter call, so there was no prompt* as a sentence, and it is true of every instance on disk. It
may not claim it is true of a `script` step, which no one here has seen.

### §0.4 The brief asks for eight columns, not nine

`docs/05-design-prompt.md:59`, quoted whole:

> **8. Run history.** Table of past runs: id, ticket, flow, vendors used (badges), status, duration,
> cost, tokens; one row expanded inline showing its step timeline and per-vendor cost split.
> Clicking opens the trace (reuse screen 5 in a "completed" state).

That is **eight** columns. Four are on the wire today (`id`, `ticket`, `flow`, `status`) and four are
not (`vendors`, `duration`, `cost`, `tokens`) — which is the body's own arithmetic, under a total it
got wrong by one.

**And the brief has two drill-down layers, where the body addressed one.** The inline expansion —
*"one row expanded inline showing its step timeline and per-vendor cost split"* — is buildable
**today**, against a route that exists, with no file read at all. Only the second layer, *"opens the
trace"*, is refuted. That distinction is what moves the seam in §6.

### §0.5 `WireRunHistory` binds the consumer and not the producer

The body reports that `WireRunHistory`'s docblock claims to close *"the last route on this transport
that declared no shape"* and that two routes still declare none. Both true. The measurement
underneath is sharper and is what a criterion can be written from:

- `read.ts` annotates four response bodies — `const body: WireTicketList`, `WireTicketDetail`,
  `WireTicketFile`, `WireFlowList`. **`/project`, `/history` and `/history/:id` are annotated with
  nothing**, and return inline object literals.
- `WireRunHistory` is imported by **`packages/server/src/read.test.ts`** and by `apps/web`. It is
  imported by **no production file in `packages/server`**. The producer is held to it by nothing.
- It is a deliberate *narrowing* — it omits `id` and `steps`, which the route does send — so this is
  not drift today. It is a shape with a validating consumer and an unconstrained producer, which is
  the arrangement that becomes drift the moment either end moves.

**`steps` is the field this ticket needs and the one that docblock declined to declare**, in its own
words: *"it is the occurrence array, carried twice by the route and read by nothing that reads this
shape. A schema naming it would be asserting over a value no caller wants and would have to keep
pace with an occurrence's fifteen keys."* Both halves of that reasoning expire here — a caller wants
it, and the objection is answered by declaring loosely over the fields the screen renders, which is
the discipline `wireRunHistorySchema` already uses one level up.

**The duplication is measurable and is not small.** Over the whole corpus, one copy of the occurrence
array is **432,599 B of the 1,013,847 B** `GET /history/:id` sends — **42.7%**. On the largest single
detail response, 27,019 B of 55,311 B. Mission control reads this route on every run screen, so the
figure is a live cost rather than a latent one.

### §0.6 The live-run join is computable in one direction, and has a known trap

The body raises the live-run question (its OQ-3) without measuring whether the join exists.
It does, and it is asymmetric:

- **history row → mission control.** A history id is `<TICKET>-<n>` and a handle is opaque and
  in-memory. A handle **cannot be composed** from a history id. It can be **found**: `GET /runs`
  answers `WireRun` rows carrying `handle`, `ticketId`, `runId` and `dry`, so the live run for a
  history row is the row where `ticketId` and `runId` match and **`dry` is `false`**.
- **The `dry` clause is load-bearing and is Q-0135's finding one screen over.** `WireRun.dry`'s own
  JSDoc: a dry walk is allocated a run number, writes no run history, `nextRunId` reserves nothing,
  and the next real run receives the identical number. So a live *dry* walk's `<ticketId>-<runId>`
  collides with a real run's directory, and a match that ignored `dry` would link a history row to a
  walk that did not write it.

This is enough to **state** the answer rather than ask the gate for it (AC-9), which is Q-0105's
remedy for an open question a document can close by measuring the tree it already has.

### §0.7 The confinement threat is the manifest, not the URL

This is the finding that changes what Half B is, and the body does not have it.

- **`resolveRunDirectory` is not on `core`'s barrel.** The barrel exports `isIncomplete`,
  `occurrenceSeq`, `readRun`, `readRunsDir`, `sortRuns`, `vendorTokenTotal` — and not it. Its own
  JSDoc rules why: publishing a path-returning function *"whose only correct use is to be opened
  immediately"* leaves a caller free to resolve lexically and read anyway. *Ruled rather than
  offered; see Q-0092 merged.md OQ-1.*
- **`occurrence_dir` is validated nowhere on the read path.** `readRun` is *"a cast, never a check"*;
  `manifestShapeError` proves only that `run_id`, `ticket_id` and `status` are strings and that
  `steps` and `rollup` are arrays. No occurrence field is checked at all. The only code that inspects
  `occurrence_dir` is `contracts/run-manifest.ts`, which is `harness validate`'s semantic pass, and it
  checks for **duplicates** rather than traversal.
- **No test anywhere stages a traversing `occurrence_dir`.** Searched across
  `packages/core/src/run-history/*.test.ts` and `packages/server/src/*.test.ts`.

So in Q-0127 the untrusted value was the client's `?path=`. **Here the untrusted value arrives inside
a JSON document the reader explicitly does not validate**, and a server that composed
`directory + occurrence_dir + name` would be joining a path out of it. That is a different threat
with a different guard, and it is why Half B needs a `core` function rather than a route that reasons
about paths.

### §0.8 The retained-file name set is open by construction

`writer.ts`'s `persist(occurrence, name, text)` takes the file **name as a parameter**. Only two
names have ever been written, and nothing prevents a third. A drill-down that hard-coded
`prompt.txt` and `output.txt` would be a register free to drift from the writer; one that lists the
directory is correct whatever is there. Q-0127's `listTicketFiles` is the shape.

### §0.9 Payload sizes, with the method stated

Over 171 runs, `JSON.stringify` of the whole response envelope:

| Shape | Total | Per row |
| --- | --- | --- |
| Listing today (five fields) | 16,145 B | **94 B** |
| Widened, roll-up narrowed to `WireVendorRollup`'s four fields | 63,115 B | **369 B** |
| Widened, carrying raw manifest roll-up rows | 99,426 B | **581 B** |

**The body's 369 B/row is exactly right and its method was unstated.** It holds only under the
narrowed shape; carrying the manifest's roll-up rows as they sit on disk is 57% larger. AC-2 names
which, because the difference is a design decision rather than an implementation detail.

Related: 338 roll-up rows across the corpus, **at most 2 per run**, of which **168 report no price —
49.7%**. Exactly two vendor strings exist, `claude` and `codex`.

Run-level statuses: `completed` 141, `failed` 16, `regressed` 9, `aborted` 3, `interrupted` 1,
`running` 1. **`exhausted` and `undecided` have never occurred**, and both are members of
`RunStatus`.

Occurrence bytes: max 355,744 B, median 99,652 B, p90 236,872 B. Run bytes: max 3,514,617 B, median
459,758 B. Largest single file 353,626 B (`Q-0129-3/steps/009-review/prompt.txt`).

---

## §1 Problem

**`maintainer`.** They have run 171 flows against this repository and every one of them is on disk
with its prompts, its outputs, its per-vendor cost and its occurrence timeline. There is no way to
look at any of it in the product. `quorum runs` prints it at a terminal; the web app, which is where
mission control and the gate screen already live, has a rail entry labelled **History** that leads to
a placeholder. When a run they were not watching ends badly, the question *what did the reviewer
actually see, and what did it cost* is answerable only by opening `.quorum/runs` in an editor.

**`adopter`.** `.quorum/` is gitignored, so their fresh clone has **zero** runs. The first thing they
will ever see on this screen is its empty state, and `docs/04-architecture.md` forbids that being a
blank panel, a spinner or a skeleton.

**The product-level problem underneath is narrower and is what this ticket is really for.** Two of
the daemon's fifteen routes answer with an inline object literal nothing declares — and one of them
is the only route on this transport whose consumer validates a shape its producer is not held to.
Q-0127 built the route pair that turns a directory into a listing and one file, and ruled the
engine's own run state out of the backlog surface **by naming this ticket as where it belongs**.
That obligation is one line in a docblock today.

## §2 User stories

- **As a `maintainer`**, I want a table of every run this project has performed, with what each one
  cost per vendor and how long it took, so that I can find the run I am thinking of without reading
  a directory of 171 JSON files.
- **As a `maintainer`**, I want to expand one row and see what actually executed inside it — the
  occurrences in order, each with its step id, adapter, status and duration — so that I can tell a
  run that failed at its third review round from one that failed at `integrate`.
- **As a `maintainer`**, I want a run that is still going to be shown as still going, and to take me
  to mission control where it is actually live, rather than being told the number it will eventually
  have.
- **As an `adopter`** with no runs yet, I want the screen to tell me that nothing has run and what
  would make something run, rather than showing me an empty box.

## §3 Surfaces

`apps/web` (the `/history` screen and its rail entry), `packages/server` (`GET /history`,
`GET /history/:id`), `packages/shared` (the wire shapes and their schemas). **`packages/core` is
untouched by Half A** and is where Half B's one new function goes. Nothing under `harness/` or
`backlog/` moves. The CLI is not touched.

---

## §4 Acceptance criteria

*Fourteen, for the half recommended in §6. Each is independently testable; each `Test:` clause bounds
the instrument for that criterion and a reviewer may find the instrument fails the job the clause
gives it, and may not raise the job.*

### The wire

**AC-1 — `GET /history` answers a shape `@quorum/shared` declares, and the route is held to it.**
A `WireRunHistoryList` and its member row are declared in `packages/shared/src/wire.ts` with a zod
schema beside them, and `read.ts`'s handler assigns its response to a `const body:` of that type
before returning it — the arrangement the four annotated routes in that file already use.
*Test:* a source assertion that the `/history` handler in `packages/server/src/read.ts` carries a
`const body:` annotation naming the shared type, shown red against the current inline literal; plus
a response assertion over a real store that the schema parses what the route returns.

**AC-2 — the listing carries the four measured fields, with the roll-up narrowed.**
Each row gains `started_at`, `ended_at`, `duration_ms`, an occurrence count, and a roll-up that is
`readonly WireVendorRollup[]` — the existing four-field shape — and **not** the manifest's roll-up
rows as they sit on disk. §0.9 is the reason and belongs in the JSDoc: 369 B/row against 581 B/row,
and the narrow shape is the one `WireRunHistory` already uses for the same values.
**No cap, no page and no truncation anywhere**, which is Q-0127's answer to the same question:
63,115 B for this repository's whole history is not a payload that needs one, and a cap a reader is
not told about is worse than the bytes.
*Test:* the schema refuses a row missing any of them; a response assertion that a roll-up row on the
listing carries exactly `vendor`, `cost_usd`, `unpriced_steps`, `step_count`; and the measured size
recorded in the criterion's own comment so a later widening is a visible act.

**AC-3 — `warnings` stays on the listing and is declared with it.**
`readRunsDir` returns the runs it could read **with** the reasons it could not read others, and the
route returns both — `failSoftly`'s distinction, and the reason a partly-damaged store is not a 500.
The declared shape carries `warnings` as `readonly { runId: string; message: string }[]`.
*Test:* a store containing one unreadable run directory answers 200 with the readable runs listed and
that run named in `warnings`, and the schema parses it.

**AC-4 — `WireRunHistory` gains the occurrence array, loosely, over the fields the screen renders.**
The detail shape declares `steps`, validated as an array of loose objects naming only what is
rendered — at minimum `step_id`, `kind`, `status`, `started_at`, `duration_ms`, `adapter`, `seq` —
and not the occurrence's fifteen keys. `z.looseObject` at the element level, for
`wireRunHistorySchema`'s own stated reason: *"Unknown keys are refused where Quorum owns the key set,
and preserved where it does not"* (2026-08-25), and this is a projection of a document `core` writes
and may widen.
The docblock's retired sentence — *"`steps` is deliberately absent"* — is replaced rather than left
standing, and the replacement says what changed: a caller wants it, and it is declared loosely
rather than exhaustively.
*Test:* the schema accepts an occurrence carrying extra keys and refuses one whose `step_id` is not a
string; a mutation removing `steps` from the schema turns a screen assertion red.

**AC-5 — the browser reads the listing through `daemon-client.ts` and nowhere else.**
A `fetchRunHistoryList(fetcher, now)` beside `fetchRuns`, going through `requestJson` with AC-1's
schema and `DAEMON_ENDPOINTS.history`, with an in-flight helper beside the existing ones. **No new
path literal**: that prefix is already declared and already forwarded by the development server, so
`test/routes.test.ts` is owed no exception row — the rule `runStopPath` records, read in the other
direction.
*Test:* the package's route-literal scan stays green with no new exemption; a screen assertion that
the request goes to the registered prefix.

### The screen

**AC-6 — the screen renders a table of the runs, and records where it diverges from the brief.**
One row per run in the order the daemon sent them — newest first, which `sortRuns` already decides —
and the screen **re-sorts nothing**, on mission control's AC-2 precedent: an order it derived would
be one it invented. Columns are the brief's eight (§0.4), and where one cannot be rendered the
divergence is recorded in place rather than approximated. **Vendor badges are the brief's colour-coded
squares and this app has no vendor-specific code (AC-7), so the badge is the vendor string as the
roll-up carries it.**
*Test:* a rendering assertion over a fixture of three runs that every row's cells come from that run's
own fields; a source assertion that the screen declares no ordering comparator.

**AC-7 — cost and tokens render per vendor, never blended, and no code branches on a vendor's name.**
`cost_usd: null` renders as the `n/a` sentence and **never `$0.00`** — *"Codex cost is reported as
tokens, never priced locally"* (2026-08-22), and 49.7% of this corpus's roll-up rows are in that
state. **No figure is summed across vendors** anywhere on this screen. A row carrying
`unpriced_steps > 0` says how many of its counted steps reported no price. A vendor with no row is
absent rather than shown at zero, which `WireVendorRollup`'s docblock already rules is a third thing
again.
*Test:* a fixture under **two vendor names this product has never seen** — Q-0135's GO-5 discipline,
because `claude` and `codex` are the only two strings in the corpus and a name-branching
implementation would pass over them; plus a source scan finding no vendor-name literal under
`apps/web/src`.

**AC-8 — status rendering is closed over `RunStatus`'s eight members, including the two never
observed.**
`exhausted` and `undecided` have never occurred in this backlog (§0.9) and are legal. The rendering is
derived from the union rather than from this corpus, and a status the vocabulary does not know is
**named** rather than dropped — `WireRunHistoryManifest`'s own rule, that refusing a status this
vocabulary does not know would refuse a document this product wrote.
*Test:* a value-level assertion over all eight members plus one string that is not a member,
asserting each renders a distinct non-empty sentence.

**AC-9 — a run still going is reported as such, never repaired, and links to mission control only
where the daemon is driving it.**
`incomplete` is rendered from what the route reports and nothing on this screen completes,
terminalises or infers an end (§0.2 — the case is live right now, not hypothetical). A row links to
mission control **only** where `GET /runs` holds a `WireRun` whose `ticketId` and `runId` match that
row **and whose `dry` is `false`** (§0.6). A handle is never composed from a history id. Where no such
row exists — which is every row on a freshly started daemon — the screen offers no link and does not
explain the absence as an error.
*Test:* three fixtures — a matching live run, a matching **dry** live run, and no live runs — asserting
a link in the first case only, with the dry case's absence carrying its own message so the clause
cannot pass by accident.

**AC-10 — one row expands inline to its occurrence timeline and per-vendor cost split.**
The brief's *"one row expanded inline"*, read through `fetchRunHistory`, which already exists. The
timeline is AC-4's occurrence array ordered by `seq`, each entry naming its `step_id`, `kind`,
`status`, `adapter` and duration. **An occurrence that is `running` is rendered as running** rather
than as one with no duration. At most one row is expanded at a time, and collapsing discards the read
rather than holding it.
*Test:* an expansion assertion over a fixture whose occurrences are out of order in the array,
asserting `seq` order in the DOM; and one over an occurrence with `status: 'running'` and
`duration_ms: null`.

**AC-11 — every request state renders a sentence, and an empty store is one of them.**
The five `RequestState` members each render through `requestStateText` and `requestStateRemedy`
unaltered — no spinner, no skeleton, no blank panel. **A store with no runs is a sixth thing and not a
failure**: `readRunsDir` answers `{runs: [], warnings: []}` for a root that has never been written to,
and the screen says so and says what would put a run there. This is the first thing an `adopter` sees
(§1).
*Test:* a value-level assertion over all five kinds plus the loaded-and-empty case, asserting six
distinct non-empty sentences; and that the loaded-and-empty sentence is not the `unreachable` one.

**AC-12 — the rail entry and the route row flip, and no component names a path the register does not
hold.**
`RAIL`'s `history` entry and `ROUTES`' `/history` row both move to `screenExists: true`, and
`app.tsx` draws the screen for that resolved route. The `waitingFor` sentence is **kept**, on the
board's and the ticket page's precedent: `screenExists` is what says the screen is built, and a row
whose sentence had been emptied would make a later `false` silent.
*Test:* `test/routes.test.ts` stays green with no new exemption; a shell assertion that the rail entry
navigates to a screen rather than a placeholder.

### The record

**AC-13 — the two documents that this change makes wrong are corrected in the same change.**
(a) `WireRunHistory`'s docblock claims to close *"the last route on this transport that declared no
shape"*. Two declared none when it was written and **`GET /project` still will** after this change —
so the sentence is corrected to what is true, and `/project`'s gap is named as somebody else's rather
than silently inherited (§7 non-goal 4).
(b) `docs/04-architecture.md`'s §`packages/server` enumerates the read-only surface and its
§`apps/web` describes which screens exist; both move.
*Test:* `packages/shared/src/docs.test.ts` holds the architecture document's route enumeration against
the routes actually registered — the guard Q-0121 built — and a source assertion that the retired
sentence does not survive anywhere.

**AC-14 — the source guards move with the change rather than being exempted around it.**
The new shared shapes join `apps/web/test/source.test.ts`'s register of shapes this app **may not
declare**, and the companion clause asserting it imports them. `packages/server`'s route register
gains nothing, no route being added.
*Test:* declaring the new shape inside `apps/web` turns the register red by name; deleting the import
turns the companion clause red. Both shown, because a register that names a shape nobody declares
forbids nothing.

---

## §5 Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a. No credential is read, rendered or accepted. The only vendor strings that reach this screen are the roll-up's grouping keys, and AC-7 forbids branching on them. |
| **Safety by construction** | n/a for Half A — nothing writes. **Half B is where this bites**: §0.7's threat, and Appendix A's AC-B1. |
| **Gate behaviour** | n/a. No gate is presented, answered or affected. |
| **Files are the database** | Nothing new is persisted and no event gains a field. Everything rendered is already on disk in a manifest `core` wrote. |
| **File format and its schema** | `contracts/Q-0011/run-manifest.schema.json` is **frozen and untouched**. The wire shapes are a *projection* of it, loose where `core` owns the key set, which is the rule `wireRunHistorySchema` already follows. |
| **Cross-vendor rule** | n/a. |
| **Lint rules** | No flow changes; `quorum lint` is unaffected. ESLint covers `apps/**/*.tsx`. |
| **Cold-clone impact** | Neutral-to-positive. No new dependency, no new install step. An `adopter`'s first view of this screen is AC-11's empty state, which is the one thing here their clone can produce. |
| **Product-agnostic** | Holds — AC-7's no-vendor-branch clause is what keeps it. |

---

## §6 The recommended split, and the seam is one step from the body's

**This is more than one ticket.** Against this milestone's record — Q-0013 refused at eighteen
criteria and split in three, Q-0091 and Q-0096 split at twenty-one, Q-0122 accepted twenty and paid
three implement rounds, Q-0126 refused a split at sixteen and paid $177.92 with a round-1 `blocked` —
fourteen criteria for Half A is at the ceiling and Half B adds at least eight.

**The body proposes the seam at "listing / drill-down". Measured, that is one step off.** The brief's
inline expansion — the occurrence timeline and the per-vendor cost split — is a *drill-down* that
needs **no route, no file read, no confinement surface and no ruling**. It reads `GET /history/:id`,
which has existed since Q-0119 and which `fetchRunHistory` already calls.

The seam that is actually disjoint is **manifests against retained files**:

- **Half A — everything read from a manifest.** The shape declarations, the widened listing, the
  table, the inline occurrence timeline. It touches no file under `.quorum/` that this product does
  not already serve, adds no route, adds nothing to `packages/core`, and owes no decision entry under
  any ruling.
- **Half B — the retained files.** The first route in this product to serve a file out of `.quorum/`.
  It needs a new `core` function (§0.7), a confinement surface over an *untrusted manifest field*, the
  Q-0076 payload question answered, and OQ-1 ruled.

**Half B cannot start first**, and not merely by taste: a file is reached from an occurrence, an
occurrence from a run, and a run from the listing. Half A is what tells a reader which run ids exist.

Appendix A writes Half B's body out in full, so that the obligation is a ticket at the gate rather
than a paragraph in a closed requirement — which this repository has lost three obligations to
(Q-0110's, Q-0111's, Q-0112's), and which Q-0105 avoided by opening its successors at its own close.

---

## §7 Non-goals

1. **Mission control is not touched**, and the brief's *"reuse screen 5 in a 'completed' state"* is
   **refuted rather than deferred** (§0.1). It is a live surface over a socket; a finished run has no
   event stream. The divergence is recorded in the screen, on Q-0017's and Q-0129's precedent.
2. **Nothing new is persisted and no event gains a field.** Everything rendered is on disk.
3. **Q-0076's cap is not built here**, and Half A is designed so that ticket's premise does not move:
   the largest thing Half A ever sends is a 55,311 B detail response. **If a design chosen in Half B
   serves a run's text in one response, that makes Q-0076 a blocker at 3,514,617 B** — which is a gate
   finding for Half B rather than scope either half absorbs.
4. **`GET /project`'s missing shape is reported and not fixed.** A different route; naming it in a
   criterion would be widening this ticket to close a sentence in a docblock. AC-13(a) names it so the
   next reader does not take the corrected sentence as coverage.
5. **No run is repaired, tidied, completed or deleted.** A `running` manifest is reported as it
   stands — which is not hypothetical, §0.2.
6. **The occurrence-array duplication on `GET /history/:id` is measured and not removed** (§0.5). It is
   42.7% of that route's payload and mission control reads it on every load, so removing it is a
   behaviour change to a shipped screen. Registered, with the figure, rather than fixed in passing.
7. **No paging, no virtualisation, no cap.** 171 rows at 369 B. If this repository's history reached a
   size where that were false, the measurement rather than a guess is what would open the ticket.
8. **No filtering or search.** The brief asks for neither, and a filter over a table nobody has used
   yet is a control designed against no measured need.

---

## §8 Open questions

**OQ-1 (BLOCKING for Half B, and not for Half A). May a route serve a *file* under `.quorum/`?**

The body frames this as needing Q-0127's erratum E-1 extended, and cites Q-0090's E-1 as the
precedent for ruling a scope question. **There is a stronger input it does not have, and it points the
other way.** `packages/shared/src/wire.ts`'s shipped `WireExcludedFiles` docblock, on why a ticket's
listing names no dot-path:

> *"Saying nothing would be a listing that reads as the whole folder; naming the paths would make a
> backlog route a second run-history surface, **which is Q-0018's**."*

So Q-0127 did not rule that engine run state may not be served. It ruled that it may not be served
**from the backlog route**, and named this ticket as where it belongs. That is a forwarding, and the
ruling this ticket owes is narrower than the body supposes: not *may run state be served at all*, but
*does the forwarding survive the difference between `backlog/<ticket>/.harness/` and `.quorum/runs`*.
Measured, the ticket-folder dot-directories are worktree remnants and are empty here; the run
directories hold 115,557,259 B of prompts and outputs. The two are the same **kind** of subject and
very different **sizes**, which is a payload question rather than an authority one — and payload is
what Half B's design answers.

Recommended: rule at Half B's gate that the forwarding stands, with the entry — if one is owed at all
— turning on the payload rather than on the permission. Measure before choosing.

**OQ-2 (answered, not asked). Does the listing widen, or does the table drop four columns?**
It widens, at 369 B/row under the narrowed roll-up (§0.9). The alternative is 171 detail reads for one
table. AC-2 states it.

**OQ-3 (answered, not asked). What does the screen do with a run the daemon is driving?**
It links to mission control where `GET /runs` holds a matching non-`dry` row, and never composes a
handle (§0.6). AC-9 states it. *Stated rather than referred to the gate, which is Q-0105's remedy for
the pattern rather than another instance of it.*

**OQ-4 (answered, not asked). Is the empty state worth a criterion?**
Yes, and it is AC-11's. `.quorum/` is gitignored, so it is the **only** state an `adopter`'s first
clone can produce.

**OQ-5 (answered for Half A, live for Half B). What is shown for an occurrence with no prompt, and
one whose output is empty?**
For Half A: nothing, because Half A does not open a file. The timeline names the occurrence's `kind`,
and §0.3's exact correspondence — every prompt-less occurrence is an `integrate` — is what makes that
sentence true rather than a guess. For Half B it is AC-B5, and §0.2 adds the case the body did not
have: **an occurrence with no `output.txt` is a step that has not finished**, not a damaged one.

**OQ-6 (new, non-blocking). Should `GET /history`'s row shape and `WireRun` share a name?**
They are two id spaces for one concept and this milestone has already paid once for near-homographs.
Q-0121's GO-3 rule applies — a wire field narrowing a `RunView` field may not keep that field's name —
and the analogue here is that a history row and a live run row must not be named alike. Recommended:
`WireRunHistoryRow`, and not `WireHistoryRun`. Cheap, and worth settling before two screens read both.

---

## §9 Risks

**R-1 — `GET /history/:id` is read by a shipped screen.** AC-4 changes its declared shape and
mission control's header reads it on every load. The widening is additive and the schema is loose, so
a browser holding the old shape still parses — but the verification must include mission control
rendering unchanged, not just the new screen rendering.

**R-2 — the corpus cannot teach two statuses.** `exhausted` and `undecided` have never occurred here
(§0.9), so every implementation and every review of AC-8 will be reasoning about them from the type.
That is precisely why AC-8's `Test:` clause is over the union and not over a fixture drawn from
`.quorum/runs`.

**R-3 — the largest detail response is 55,311 B and the largest run's retained text is 3,514,617 B.**
Half A is comfortably inside the first figure. The risk is that Half B's design reaches for the second
without noticing it has crossed a boundary Half A was shaped to stay inside, which would make Q-0076
a blocker (§7 non-goal 3).

**R-4 — this ticket's review will be truncated.** `repo.max_diff_bytes` is 200,000 and is read at run
start. Q-0135's four rounds fell 100% → 98.1% → 90.9% → 87.9%, and Q-0129's four fell to 70.2% with
`events.ts` — the field that ticket existed to add — never seen by any reviewer. `git diff` orders by
path, so the alphabetical tail here is `packages/shared/src/wire.ts` — **AC-1, AC-2 and AC-4's own
subject**. The gate should expect it and the by-hand pass over the omitted files should be a gate
obligation rather than a hope, per Q-0124's warn and Q-0117's `observation:` channel, which have now
composed on four consecutive tickets.

**R-5 — a screen is where a measured rule goes quiet.** Four of AC-7's clauses (`n/a` never `$0.00`,
no blending, no vendor branch, absent ≠ zero) are rules this product has already paid to learn, and
all four are invisible in a rendering test that uses a fixture with two priced vendors. The fixture
must be hostile: an all-unpriced run, a vendor name nobody has seen, and a roll-up row that is not an
object.

---

## §10 Gate obligations

**GO-1.** Rule the split. If it is refused, say so in an erratum that names the seam and names the
remedy on exhaustion in advance — Q-0122's E-1 discipline, and the thing Q-0126 paid $177.92 for not
having.

**GO-2.** If the split is taken, **open Half B at this gate** from Appendix A rather than leaving it
in this document. Three obligations in this repository have expired inside a closed ticket's prose.

**GO-3.** Rule OQ-6's naming before an implementer picks one, and record it in the shape's own JSDoc
rather than in a decision entry — Q-0108's precedent, a ruling that changes no behaviour and
contradicts no landed entry belonging in the code's authority comment.

**GO-4.** The by-hand cross-vendor pass over whatever the diff cap omitted, with the omitted file
list transcribed from the `warn` rather than described (R-4).

**GO-5.** Discharge by **running the product and transcribing what it rendered** — not by reporting
that it was run. Q-0016's GO-6 was reported discharged when its by-hand half had not been performed,
and Q-0015's gate found that. The demonstration must show, from a real daemon started by
`quorum open`: the table over this repository's own 171 runs; **a run that is incomplete while it is
incomplete**, which is the state §0.2 found live and which a fixture cannot stand in for; a row with
an unpriced vendor rendering `n/a` and not `$0.00`; one row expanded to its occurrence timeline; and
the empty state, which needs a runs root that is empty and therefore a second project.

---

## Appendix A — Half B, written out in full

*The body for the successor, so the obligation is a ticket at the gate rather than a paragraph here.*

### Q-00NN — The drill-down serves what an occurrence retained

`apps/web`'s history screen names each occurrence of a finished run and can open none of them. The
prompt each adapter step was sent and the output it returned are on disk — **1,779 files, 115,557,259
bytes across 171 runs** — and nothing in `packages/server` reads one: `grep` for `prompt.txt` or
`output.txt` across that package returns nothing.

**The confinement threat is not where a reader will look for it.** Q-0127's file route takes an
untrusted `?path=` from a client and derives membership per request. Here the client supplies an
occurrence *identity* and **the path comes out of the manifest**, which `readRun`'s own JSDoc calls
*"a cast, never a check"*: `manifestShapeError` proves only that `run_id`, `ticket_id` and `status`
are strings and that `steps` and `rollup` are arrays, and **no occurrence field is validated
anywhere on the read path**. The only code that inspects `occurrence_dir` is
`contracts/run-manifest.ts`, which is `harness validate`'s semantic pass and checks for duplicates
rather than traversal. **No test in either package stages a traversing `occurrence_dir`.** So a
manifest carrying `occurrence_dir: "../../../etc"` is a live path a joining server would follow.

**A new `core` function is required rather than preferred.** `resolveRunDirectory` is deliberately
**not** on `@quorum/core`'s barrel — its JSDoc rules that publishing a path-returning function
*"whose only correct use is to be opened immediately"* leaves a caller free to resolve lexically and
read anyway (*ruled rather than offered; see Q-0092 merged.md OQ-1*). So the server may not compose
the path, and the pair Q-0127 built is the shape: a listing function that names and measures an
occurrence's files without opening one, and a byte reader that confines and reads exactly one.

**The file-name set is open by construction.** `writer.ts`'s `persist(occurrence, name, text)` takes
the name as a parameter. Two names have ever been written — `output.txt` 931, `prompt.txt` 848 — and
a drill-down that hard-coded them would be a register free to drift from the writer. **List the
directory.**

**Measured 2026-09-18.** Retained bytes per occurrence: max 355,744, median 99,652, p90 236,872.
Per run: max 3,514,617, median 459,758. Largest single file 353,626 B
(`Q-0129-3/steps/009-review/prompt.txt`). Of 1,779 files, **8 are empty, 0 are not well-formed UTF-8,
and 14 contain U+FFFD legitimately** — so the naive *does the decoded text hold a replacement
character* test would report fourteen real prompts as binary on the day it shipped, and the UTF-8
verdict must be taken with the decoder that will serve the bytes (Q-0127 found `iconv` and
`TextDecoder` disagreeing on a file that round-trips).

**Those numbers decide the payload.** A listing of `{name, bytes}` with one file fetched on demand
means the largest thing a reader ever receives is 355,744 B. Serving a run's text in one response
makes it 3,514,617 B and **makes Q-0076 this ticket's blocker** rather than leaving it at p3. That is
this ticket's first decision and it is not an implementation detail.

**Two occurrence cases are ordinary and neither is a blank.** All **84** occurrences with no
`prompt.txt` are `integrate` steps (77 completed, 7 failed) — this repository has produced no
`script` occurrence ever — so *this step was not an adapter call* is a true sentence rather than a
guess. And exactly one occurrence has no `output.txt`: a step that is **still running**, `writer.ts`
guaranteeing an empty one at terminalisation. *No output* means *not finished*, not *damaged*.

**Criteria sketch.** AC-B1 a `core` listing function over one occurrence, confining against the
manifest's own `occurrence_dir` and shown red against a traversing fixture. AC-B2 a `core` byte
reader, whole-file, one read one verdict. AC-B3 `GET /history/:id/file` taking the occurrence
identity and the name as **query values**, membership derived for that request. AC-B4 refusal codes
telling a name that was never listed from a file that stopped being one between the listing and the
read. AC-B5 the two ordinary cases above, each a sentence. AC-B6 the UTF-8 refusal under its own
code. AC-B7 the screen. AC-B8 the architecture document's route enumeration.

**Open first:** OQ-1 above — whether `WireExcludedFiles`'s forwarding of this subject to Q-0018
survives the difference between an empty `.harness/` inside a ticket folder and 115 MB under
`.quorum/runs`. It is a payload question wearing an authority question's clothes. Measure before
choosing.
