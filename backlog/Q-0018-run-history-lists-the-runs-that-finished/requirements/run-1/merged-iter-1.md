# Q-0018 — Run history lists the runs that finished

*Merged requirement, run 1, iteration 1. Scoped to the half that is buildable against routes that
exist; the retained-file drill-down is Appendix A and is a successor. Every measurement below was
re-derived at this gate against the working tree before it entered this document — the candidates
disagree on several figures, and a measurement copied from a document is not a measurement.*

---

## §0 What was measured at this gate

Candidate-claude re-measured the ticket body and found four of its claims moved. **I re-derived nine
of the load-bearing claims myself rather than relaying either candidate**, because two of them
decide a criterion's shape and one of them decides the seam.

| Claim | Source | Verdict at this gate |
| --- | --- | --- |
| `GET /history` returns an inline literal of five row fields plus `warnings` | both | **Confirmed.** `read.ts` `app.get('/history')` returns `{runs: [{id, ticket, flow, status, incomplete}], warnings}` with no `const body:` annotation, where four sibling handlers in the same file have one. |
| `GET /project` also declares no shape | claude §0.5 | **Confirmed.** It and `/history` are the two unannotated handlers. |
| `WireRunHistory` omits `steps` while the route sends it | claude §0.5 | **Confirmed, and sharper — see §0.1.** |
| `RunWarning` is `{runId, message}` | claude AC-3 | **Confirmed**, `reader.ts:52`. |
| `resolveRunDirectory` is **not** on `@quorum/core`'s barrel | claude §0.7 | **Confirmed.** `index.ts:124` exports `isIncomplete`, `occurrenceSeq`, `readRun`, `readRunsDir`, `sortRuns`, `vendorTokenTotal` — and not it. |
| `WireRun` carries `handle`, `ticketId`, `runId`, `dry` | claude §0.6 | **Confirmed**, `wire.ts:149–172`. |
| `DAEMON_ENDPOINTS.history` is already declared; only `historyDetailPath` uses it | claude AC-5 | **Confirmed.** `fetchRunHistory` exists; there is no listing fetch. |
| `apps/web` declares `/history` with `screenExists: false` and the rail entry beside it | both | **Confirmed**, `routes.ts:139` and `:232`. |
| **`incomplete` is 0 of 170** | **ticket body and candidate-codex** | **REFUTED.** 171 run directories; statuses are `completed` 141, `failed` 16, `regressed` 9, `aborted` 3, `interrupted` 1, **`running` 1 with `ended_at: null`**. |

### §0.1 The detail route carries the occurrence array twice, and the two copies are not alike

Candidate-claude reports the duplication and measures it at **42.7%** of that route's payload. What
neither candidate says is **which copy a screen should read**, and they are different documents:

- `manifest.steps` — the array as `core` wrote it, travelling inside the whole manifest so that
  *"a reader still sees what is actually on disk"*.
- top-level `steps` — the same array with each element given **`seq`**, from
  `occurrenceSeq(step.occurrence_dir)`. That field **exists nowhere on disk**; the route derives it,
  and it is the only thing that orders an occurrence for a reader.

So AC-5 declares the **top-level, `seq`-enriched** copy and leaves `manifest.steps` undeclared and
unread. A requirement that said only *"declare `steps`"* would have left an implementer to pick, and
the wrong pick renders a timeline in array order with no ordering key.

**It also draws the A/B seam in code rather than in prose.** `occurrenceSeq` parses a directory
*name* and opens nothing, so **this ticket never composes a filesystem path**. Appendix A does. That
is the boundary, and it is checkable.

### §0.2 The incomplete case is live, and it is this run

One of the 171 runs is `status: running`, `ended_at: null` — the requirements run producing this
document. The case both the body and candidate-codex called untestable-from-this-corpus is the state
the corpus is in, and it is the state a reader meets most often, because a person opens a history
screen *while something is running*. AC-4 and AC-11 are written against it rather than around it.

Candidate-claude's companion finding is taken with it: `writer.ts` guarantees an empty `output.txt`
at terminalisation, so an occurrence with **no** `output.txt` is one that has **not finished**, not
one that is damaged. That is Appendix A's, and it is recorded here so it is not rediscovered.

### §0.3 The corpus cannot teach four things, and all four are criteria

- **`undecided` and `exhausted` have never occurred** and both are members of `RunStatus` (AC-10).
- **`incomplete` looks rare** and is 1 of 171 at this moment (AC-11).
- **Exactly two vendor strings exist**, `claude` and `codex`, so a name-branching implementation
  passes over this whole repository (AC-9).
- **`.quorum/` is gitignored**, so an adopter's first clone renders the empty state and nothing else
  (AC-13).

Every one of these is a criterion whose `Test:` clause is written over a union or a constructed
fixture and never over `.quorum/runs`.

### §0.4 The brief asks for eight columns, and has two drill-down layers

`docs/05-design-prompt.md` §8, quoted whole:

> **8. Run history.** Table of past runs: id, ticket, flow, vendors used (badges), status, duration,
> cost, tokens; one row expanded inline showing its step timeline and per-vendor cost split.
> Clicking opens the trace (reuse screen 5 in a "completed" state).

**Eight** columns, four on the wire today and four not — candidate-claude's correction to the body's
"nine", and the arithmetic underneath was the body's own. The **inline expansion** is buildable
against a route that has existed since Q-0119; only *"opens the trace"* is refuted (§0.5). That
distinction is what moves the seam (§6).

### §0.5 "Reuse screen 5" is refuted, not deferred

Both candidates reach this and it holds: `writer.ts` names no event, `docs/GLOSSARY.md`'s **Event**
term says *"Not persisted in v1 (see Run history, which is)"*, and mission control's columns, lane
and timeline are all derived from accepted events off a socket. **A finished run has no event stream
to render.** The two identity schemes do not meet either: a handle is minted by a module-level
counter *"deliberately meaningless across a restart"* and a history id is `<TICKET>-<n>`.

The divergence is **recorded** in the brief and in the screen (AC-14), on Q-0017's and Q-0129's
precedent, rather than followed or silently dropped.

### §0.6 The live-run join is computable, and is ruled out of scope anyway

Candidate-claude measures the join and candidate-codex refuses it. **Both are half right**, and the
measurement is worth preserving whichever way it is ruled: a live run for a history row is the
`GET /runs` row whose `ticketId` and `runId` match **and whose `dry` is `false`**. The `dry` clause
is load-bearing and is Q-0135's finding one screen over — a dry walk is allocated a run number,
writes no history, and `nextRunId` reserves nothing, so a dry walk's `<ticketId>-<runId>` collides
with a real run's directory and a match ignoring `dry` links a row to a walk that did not write it.

**Ruled: not built here** (OQ-3). It costs a second daemon request on every load and a
correctness-critical join, for a case that is at most one row, on a screen whose job is to list what
is on disk. The recipe and its trap are recorded above so that a successor uses them rather than
re-deriving them, which is what this repository loses obligations to.

### §0.7 Payload, with the method stated

`JSON.stringify` of the whole response envelope over 171 runs:

| Shape | Total | Per row |
| --- | --- | --- |
| Listing today (five fields) | 16,145 B | **94 B** |
| Widened, roll-up narrowed to `WireVendorRollup`'s four fields | 63,115 B | **369 B** |
| Widened, carrying the manifest's raw roll-up rows | 99,426 B | **581 B** |

**The body's 369 B/row is right and its method was unstated**: it holds only under the narrowed
roll-up, and carrying the manifest's rows as they sit on disk is 57% larger. AC-2 names which, and
why. **The widening costs no extra read** — `readRunsDir` already parses every manifest — which is
the fact that makes "widen" beat "170 detail reads" without argument.

Related: 338 roll-up rows, at most 2 per run, of which **168 report no price — 49.7%**.

---

## §1 Problem

**`maintainer`.** They have run 171 flows against this repository and every one is on disk with its
prompts, outputs, per-vendor cost and occurrence timeline. None of it is visible in the product.
`quorum runs` prints it at a terminal; the web app, where mission control and the gate screen
already live, has a rail entry labelled **History** that leads to a placeholder. When a run they were
not watching ends badly, *where did it fail and what did it cost* is answerable only by opening
`.quorum/runs` in an editor.

**`adopter`.** `.quorum/` is gitignored, so their fresh clone has zero runs, and the first thing
they will ever see on this screen is its empty state — which `docs/04-architecture.md` forbids being
a blank panel, a spinner or a skeleton.

**Underneath is a narrower product problem.** Two of the daemon's fifteen routes answer with an
inline object literal nothing declares, and one of them is the only route on this transport whose
consumer validates a shape **its producer is not held to** — `wireRunHistorySchema` is imported by a
test and by `apps/web`, and by no production file in `packages/server`. That is not drift today,
because the declared shape is a deliberate narrowing. It is the arrangement that becomes drift the
moment either end moves, and this ticket moves both.

## §2 User stories

- **As a `maintainer`**, I want a table of every run this project has performed, with what each cost
  per vendor and how long it took, so that I can find the run I am thinking of without reading 171
  JSON files.
- **As a `maintainer`**, I want to expand one row and see what actually executed inside it — the
  occurrences in order, each with its step id, kind, status, adapter and duration — so that I can
  tell a run that failed at its third review round from one that failed at `integrate`.
- **As a `maintainer`**, I want a run that is still being written to be shown as still being
  written, and never quietly completed or dropped from the table.
- **As an `adopter`** with no runs yet, I want the screen to tell me nothing has run and what would
  make something run, rather than showing me an empty box or a spinner that never resolves.

## §3 Surfaces

`apps/web` (the `/history` screen, its rail entry and route row), `packages/server`
(`GET /history`'s response shape, `GET /history/:id`'s declared shape), `packages/shared` (the wire
shapes and their schemas), and three documents (AC-14). **`packages/core` is untouched** — every
symbol this ticket reads is already on its barrel. No new route. No CLI change. Nothing under
`harness/` or `backlog/` moves. Nothing writes.

---

## §4 Acceptance criteria

*Fourteen. Each is independently testable. Each `Test:` clause bounds the instrument for that
criterion: a reviewer may find the instrument fails the job the clause gives it, and may not raise
the job.*

### The wire

**AC-1 — `GET /history` answers a shape `@quorum/shared` declares, and the route is held to it.**
`WireRunHistoryList` and its member `WireRunHistoryRow` are declared in `packages/shared/src/wire.ts`
with zod schemas beside them, and `read.ts`'s `/history` handler assigns its response to a
`const body: WireRunHistoryList` before returning it — the arrangement the four annotated handlers in
that file already use and which `/history` and `/project` alone lack. **The names are ruled here**
(OQ-6): `WireRunHistory` already names the detail, so the list and its row are named for what they
are, and a history row is never named alike to a live-run row — Q-0121's GO-3 rule at its analogue.
The ruling belongs in the shape's own JSDoc and owes no decision entry (Q-0108's precedent).
*Test:* a source assertion that the `/history` handler carries a `const body:` annotation naming the
shared type, shown red against today's inline literal; plus a response assertion over a real store
that `wireRunHistoryListSchema` parses what the route returns.

**AC-2 — the listing carries the measured fields, with the roll-up narrowed, and no cap.**
Each row gains `started_at`, `ended_at`, `duration_ms`, an occurrence count, and
`rollup: readonly WireVendorRollup[]` — the existing four-field shape — and **never** the manifest's
roll-up rows as they sit on disk. **Nullable fields keep the manifest's own distinctions and the
server manufactures none**: a run in flight carries `ended_at: null` and `duration_ms: null` rather
than a computed value, and an absent price is `null` rather than `0`. **No cap, no page, no
truncation**: 63,115 B for this repository's entire history is not a payload that needs one, and a
cap a reader is not told about is worse than the bytes (Q-0127's answer to the same question). The
widening costs no extra read — `readRunsDir` already parses every manifest — and the measured
369 B/row against 581 B/row raw is recorded in the shape's own JSDoc, so a later widening is a
visible act.
*Test:* the schema refuses a row missing any named field; a response assertion that a listing
roll-up row carries exactly `vendor`, `cost_usd`, `unpriced_steps`, `step_count`; one that a
`running` run's row carries `ended_at: null` and `duration_ms: null`; and a store holding **more
runs than the table shows at once** returns every one of them, so visual containment cannot be
mistaken for server truncation.

**AC-3 — a store the daemon could only partly read is reported partly, on the wire and on the
screen.**
`warnings` is declared on the envelope as `{runId, message}` rows — `core`'s own `RunWarning` shape —
the route keeps returning the readable runs **with** the reasons for the rest, and the screen names
each unreadable run rather than dropping it. `failSoftly`'s distinction: a store a reader could
partly read is not a 500, and answering one would hide every run it could read.
*Test:* a store containing one unreadable run directory answers 200 with the readable runs listed
and that run named in `warnings`, the schema parses it, and a rendering assertion finds that run's
name on the screen.

**AC-4 — the response is a projection, and nothing is repaired.**
Producing either history response does not modify, repair, finish, complete, delete or tidy a
manifest or a retained file, including a manifest whose run is still being written.
`docs/04-architecture.md` is explicit that a server must not tidy a `running` manifest it meets on
read, and this is not hypothetical — one of the 171 runs measured at this gate is `running` with
`ended_at: null` (§0.2).
*Test:* the bytes of every `manifest.json` under a fixture store are byte-equal before and after
requests to both history routes, with a `running` manifest among them.

**AC-5 — `WireRunHistory` declares the `seq`-enriched occurrence array, loosely.**
The detail shape declares the route's **top-level** `steps` — the copy whose elements the route gives
`seq` — as an array of loose objects naming only what the screen renders: at minimum `step_id`,
`kind`, `status`, `started_at`, `duration_ms`, `adapter` and `seq`. `manifest.steps` stays undeclared
and unread; it is the second, unenriched copy and carries no ordering key (§0.1). Loose at the
element level for `wireRunHistorySchema`'s own stated reason — *"Unknown keys are refused where
Quorum owns the key set, and preserved where it does not"* (2026-08-25) — this being a projection of
a document `core` writes and may widen. **The docblock sentence *"`steps` is deliberately absent"* is
replaced rather than left standing**, and the replacement says what changed: a caller wants it, and
it is declared loosely rather than over an occurrence's fifteen keys, which is the objection that
sentence raised and this answers.
*Test:* the schema accepts an element carrying extra keys and refuses one whose `step_id` is not a
string or whose `seq` is absent; a source assertion that the retired sentence survives nowhere; and a
mutation removing `steps` from the schema turns an AC-12 assertion red.

**AC-6 — the browser reads the listing through `daemon-client.ts`, once, and composes no handle.**
A `fetchRunHistoryList(fetcher, now)` beside `fetchRuns`, through `requestJson` with AC-1's schema
and `DAEMON_ENDPOINTS.history`, with an in-flight helper beside the existing ones. **No new path
literal**: that prefix is already declared and already forwarded by the development server, so no
exemption row is owed — `runStopPath`'s rule read in the other direction. **Rendering the table
issues exactly one daemon request**: not one per row, which would be 171 on this machine, and not a
second to `GET /runs`. **No handle is composed from a history id** anywhere on this screen (§0.6).
*Test:* a request-count assertion over a fixture of more rows than fit, asserting one call and that
no call names `historyDetailPath` or `DAEMON_ENDPOINTS.runs`; and the package's route-literal scan
stays green with no new exemption row.

### The screen

**AC-7 — the screen is reachable, and the registers move with it rather than being exempted around
it.**
`RAIL`'s `history` entry and `ROUTES`' `/history` row both move to `screenExists: true` and
`app.tsx` draws the screen for that resolved route. The `waitingFor` sentence is **kept**, on the
board's and the ticket page's precedent: `screenExists` is what says the screen is built, and a row
whose sentence had been emptied would make a later `false` silent. The two new shared shapes join
`apps/web/test/source.test.ts`'s register of shapes this app **may not declare**, with the companion
clause asserting it imports them.
*Test:* `test/routes.test.ts` stays green with no new exemption; a shell assertion that the rail
entry reaches a screen rather than a placeholder; declaring either new shape inside `apps/web` turns
the register red **by name**, and deleting the import turns the companion clause red — both shown,
because a register naming a shape nobody declares forbids nothing.

**AC-8 — the table renders each row from its own fields, in the order the daemon sent them.**
One row per run in the order received: `sortRuns` decides it and **the screen declares no
comparator**, on mission control's precedent that an order the screen derived would be one it
invented. The brief's eight columns (§0.4) are rendered where they can be, and where one cannot the
divergence is recorded in place rather than approximated. **Vendor badges are the vendor string as
the roll-up carries it** — the brief's colour-coded squares are refused here, because AC-9 forbids
this app knowing a vendor by name and a colour per vendor is exactly that knowledge.
*Test:* a rendering assertion over a fixture of three runs whose every field is mutually
distinguishable, that each cell of each row comes from that run's own fields; plus a source
assertion that the screen declares no sort comparator.

**AC-9 — cost and tokens are per vendor, never blended, and nothing branches on a vendor's name.**
`cost_usd: null` renders the `n/a` sentence and **never `$0.00`** — 168 of 338 roll-up rows here,
49.7% — while a numeric `0` stays distinguishable from a missing price. A row carrying
`unpriced_steps > 0` says how many of its counted steps reported no price. **No figure is summed
across vendors anywhere on this screen**, which *"Codex cost is reported as tokens, never priced
locally"* (2026-08-22) refuses. A vendor with no roll-up row is **absent** rather than shown at zero,
which `WireVendorRollup`'s docblock rules is a third thing again and is not *unpriced*.
*Test:* a fixture under **two vendor names this product has never seen** — Q-0135's GO-5 discipline,
`claude` and `codex` being the only two strings in the corpus — carrying one priced vendor, one
`cost_usd: null`, one `cost_usd: 0` and one `unpriced_steps > 0`; plus a source scan finding no
vendor-name literal under `apps/web/src`.

**AC-10 — status rendering is closed over `RunStatus`, including the two this backlog has never
produced.**
The rendering is derived from the union rather than from this corpus, so `undecided` and `exhausted`
render as surely as `completed` does, and a status the vocabulary does not know is **named** rather
than dropped — `WireRunHistoryManifest`'s own rule, that refusing a status this vocabulary does not
know would refuse a document this product wrote.
*Test:* a value-level assertion over all eight members plus one string that is not a member,
asserting each renders a distinct non-empty sentence, with the two unobserved members named in the
assertion rather than reached through a fixture drawn from `.quorum/runs`.

**AC-11 — a run in flight is shown as in flight, and is linked nowhere.**
A row with `incomplete: true` stays in the table and carries an explicit **incomplete** indication
beside its recorded status. It is not relabelled completed, not omitted, not reordered, and **not
linked to mission control** (OQ-3): this screen composes no handle and issues no second request to
find one. Where the screen says anything about where a live run is watched, it says it as a sentence.
*Test:* a fixture the test builds itself — never the developer's gitignored `.quorum/` — carrying one
`status: 'running'`, `ended_at: null`, `incomplete: true` row, asserting the row is present, carries
both the status and the incomplete indication, and that the rendered output holds no anchor naming a
run handle.

**AC-12 — one row expands inline to its occurrence timeline and its per-vendor split.**
The brief's *"one row expanded inline"*, read through `fetchRunHistory`, which already exists. The
timeline is AC-5's array ordered by **`seq`**, each entry naming its `step_id`, `kind`, `status`,
`adapter` and duration; an occurrence whose status is `running` is rendered as running rather than as
one with no duration. At most one row is expanded at a time, and collapsing discards the read rather
than holding it. **This ticket opens no file**: an occurrence's retained files are Appendix A's, and
where the timeline says anything about them it says the occurrence's **kind** — every one of the 84
prompt-less occurrences in this corpus is an `integrate` step, and this product has produced no
`script` occurrence ever, so *this step was not an adapter call* is a true sentence rather than a
guess.
*Test:* an expansion assertion over a fixture whose `steps` array is out of `seq` order, asserting
`seq` order in the DOM; one over an occurrence with `status: 'running'` and `duration_ms: null`; and
a request assertion that expanding issues exactly one detail read and collapsing issues none.

**AC-13 — every request state renders a sentence, and an empty store is one of them.**
The five `RequestState` members each render through `requestStateText` and `requestStateRemedy`
unaltered — no spinner, no skeleton, no blank panel, and an error is never presented as an empty
history. **A store with no runs is a sixth thing and not a failure**: `readRunsDir` answers
`{runs: [], warnings: []}` for a root never written to, and the screen says so and says what would
put a run there. `.quorum/` is gitignored, so this is the only state an adopter's first clone can
produce and the first thing they will ever see here (§1).
*Test:* a value-level assertion over all five kinds plus the loaded-and-empty case, asserting six
distinct non-empty sentences and that the empty one is not the `unreachable` one; the empty case
built from a runs root the test creates.

### The record

**AC-14 — the three documents this change makes wrong are corrected in the same change.**
(a) `WireRunHistory`'s docblock claims to close *"the last route on this transport that declared no
shape"*. Two declared none when it was written and **`GET /project` still will** after this change,
so the sentence is corrected to what is true and `/project`'s gap is named as somebody else's rather
than silently inherited (§7 non-goal 4). (b) `docs/04-architecture.md`'s `packages/server` and
`apps/web` sections. (c) `docs/05-design-prompt.md` §8's *"reuse screen 5 in a 'completed' state"*
gains the recorded divergence — events are not persisted, so a finished run has no event stream, and
the drill-down is an occurrence list rather than a trace. **A documentation correction, not a change
to event persistence.**
*Test:* `packages/shared/src/docs.test.ts` holds the architecture document's route enumeration
against the routes actually registered — the guard Q-0121 built — and a source assertion that each
retired sentence survives nowhere.

---

## §5 Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a. No credential is read, rendered or accepted on any path, tests included. The only vendor strings reaching this screen are the roll-up's grouping keys, and AC-9 forbids branching on them. |
| **Safety by construction** | Nothing writes. **This ticket composes no filesystem path** — `occurrenceSeq` parses a directory *name* and opens nothing (§0.1). Appendix A is where confinement bites, and it is why it is a separate ticket. |
| **Gate behaviour** | n/a. No gate is presented, answered or affected; the gate answer set is untouched. |
| **Files are the database** | Nothing new is persisted, no event gains a field, no manifest is written. Everything rendered is already on disk in a document `core` wrote. |
| **File format and its schema** | `contracts/Q-0011/run-manifest.schema.json` is **frozen and untouched**. The wire shapes are a *projection* of it, loose where `core` owns the key set. |
| **Cross-vendor rule** | n/a. |
| **Lint and flows** | No flow file changes; `quorum lint` is unaffected. ESLint already covers `apps/**`. |
| **Cold-clone impact** | Neutral-to-positive: no new dependency, no new install step, no new route. An adopter's first view of this screen is AC-13's empty state, the one state their clone can produce. |
| **Product-agnostic** | Holds, and AC-9's no-vendor-branch clause is what keeps it rather than what asserts it. |
| **Existing suites** | Daemon, web, lint, typecheck and the mock-adapter end-to-end suite stay green. Baseline, not a criterion. |

---

## §6 The recommended split, and why the seam is not where the body put it

**This is more than one ticket.** Against this milestone's record — Q-0013 refused at eighteen
criteria and split in three, Q-0091 and Q-0096 split at twenty-one, Q-0122 accepted twenty and paid
three implement rounds, Q-0126 refused a split at sixteen and paid $177.92 with a round-1 `blocked` —
fourteen criteria is at the working ceiling and the retained-file half adds at least eight more.

**The body and candidate-codex put the seam at "listing / drill-down". Measured, that is one step
off**, and candidate-claude is right about where it belongs. The brief's **inline expansion** — the
occurrence timeline and the per-vendor split — needs **no route, no file read, no confinement
surface and no ruling**. It reads `GET /history/:id`, which has existed since Q-0119 and which
`fetchRunHistory` already calls.

The seam that is actually disjoint is **manifests against retained files**, and this repository
splits on **disjoint blockers rather than on size** (Q-0016, Q-0129, Q-0131):

- **This ticket — everything read from a manifest.** The shape declarations, the widened listing, the
  table, the inline occurrence timeline. No route is added, nothing is added to `packages/core`, no
  path is composed, and **no decision entry is owed under any ruling** (§8).
- **Appendix A — the retained files.** The first route in this product to serve a file out of
  `.quorum/`. It needs a new `core` function, a confinement surface over an **untrusted manifest
  field**, the Q-0076 payload question answered, and OQ-1 ruled.

**Appendix A cannot start first**, and not by taste: a file is reached from an occurrence, an
occurrence from a run, and a run from the listing. And putting the timeline here leaves Appendix A a
place to plug into — it adds *each occurrence names its retained files, and one opens*, rather than
building the occurrence rendering behind a blocking ruling.

Recommended, not decided. **The gate rules it** (GO-1).

---

## §7 Non-goals

1. **Mission control is not touched or reused.** The brief's *"reuse screen 5 in a 'completed'
   state"* is **refuted rather than deferred** (§0.5) and the divergence is recorded (AC-14c).
2. **Nothing is persisted and no event gains a field.** Everything rendered is on disk already.
3. **The retained-file drill-down is Appendix A**, not this ticket: no route serves an individual
   file from `.quorum/`, and no `prompt.txt` or `output.txt` is listed, read or rendered here.
4. **`GET /project`'s missing shape is reported and not fixed.** A different route; naming it in a
   criterion would widen this ticket to close a sentence in a docblock. AC-14(a) names it so the
   corrected sentence is not read as coverage.
5. **No run is repaired, tidied, completed or deleted**, which is AC-4 and is live rather than
   hypothetical.
6. **The occurrence-array duplication on `GET /history/:id` is measured and not removed.** It is
   42.7% of that route's payload and mission control reads it on every load, so removing
   `manifest.steps` is a behaviour change to a shipped screen. Registered with the figure rather than
   fixed in passing.
7. **An incomplete row is not correlated with or linked to a live run handle** (OQ-3, §0.6). The
   measured join recipe and its `dry` trap are recorded so a successor uses them rather than
   inventing one.
8. **No cap, pagination, virtualisation, search, filter, sort control, export, deletion or retention
   policy.** Q-0076 remains the owner of any future cap, and this ticket is shaped so its premise
   does not move (§9 R-3).
9. **No CLI, flow, gate, adapter, backlog or `harness/` behaviour changes.** No new dependency.
10. **Layout hardening is not a criterion.** Candidate-codex's containment criterion is struck as not
    independently testable — *"content does not force the rail outside its containment"* has no
    falsifiable instrument in this suite, and asserting over a CSS class would be pinning an
    implementation rather than a behaviour. Recorded here so it is a deliberate omission.

---

## §8 Open questions

**All five of the body's are answered. None blocks solutioning of the scope specified above.**

**OQ-1 — may a route serve a *file* under `.quorum/`? — BLOCKING for Appendix A, and for nothing
here.**
The body frames this as needing Q-0127's erratum E-1 extended. **Candidate-claude found a stronger
input that points the other way**, and it survived checking: `packages/shared/src/wire.ts`'s shipped
`WireExcludedFiles` docblock says a ticket's listing names no dot-path because *"naming the paths
would make a backlog route a second run-history surface, **which is Q-0018's**"*. So Q-0127 did not
rule that engine run state may not be served — it ruled it may not be served **from the backlog
route**, and forwarded this subject here by name. The ruling owed is therefore narrower: *does the
forwarding survive the difference between an empty `.harness/` inside a ticket folder and
115,557,259 B under `.quorum/runs`* — a payload question wearing an authority question's clothes.
Measure before choosing; Q-0090's erratum E-1 is the precedent for ruling a scope question, and it
ruled the cited entry **did not** govern.

**OQ-2 — does the listing widen, or does the table drop four columns? — ANSWERED.**
It widens, at 369 B/row under the narrowed roll-up, costing no extra server read (§0.7). The
alternative is 171 requests for one table. AC-2 states it rather than leaving it to an implementer.

**OQ-3 — what does the screen do with a run the daemon is driving? — ANSWERED, and the answer is
"nothing, deliberately".**
Not linked, no second request, no handle composed (AC-11). The join exists and is recorded with its
`dry` collision trap in §0.6 for whoever builds it, because the cost here is a second fetch and a
correctness-critical match on every load for a case that is at most one row. *Stated rather than
referred to the gate, which is Q-0105's remedy for this pattern rather than another instance of it.*

**OQ-4 — is the empty state worth a criterion? — ANSWERED: yes, AC-13.**
It is the **only** state an adopter's first clone can produce.

**OQ-5 — what is shown for an occurrence with no prompt, or an empty output? — ANSWERED here,
live for Appendix A.**
This ticket opens no file, so the timeline names the occurrence's **kind**, and §0.3's exact
correspondence is what makes that sentence true rather than a tendency. For Appendix A it is AC-B5,
carrying the finding neither the body nor candidate-codex had: **an occurrence with no `output.txt`
is a step that has not finished**, not a damaged one.

**OQ-6 — what are the new shapes called? — RULED at this gate, non-blocking.**
`WireRunHistoryList` and `WireRunHistoryRow`. `WireRunHistory` already names the detail, and a
history row must not be named alike to a live-run row — Q-0121's GO-3 rule at its analogue. Recorded
in the shape's own JSDoc and **owing no decision entry** (Q-0108's precedent: a ruling that changes
no behaviour and contradicts no landed entry belongs in the code's authority comment).

**Is a decision entry owed at all? — No, and the test was applied rather than assumed.**
*Does any landed sentence go false?* Checked at five sites: no route is added, so
`04-architecture.md`'s enumeration is unchanged in content; nothing new is persisted, so *"Files are
the database"* is untouched; no dependency is added; no glossary term is coined or widened; and the
only sentence that goes false is a **source docblock** (`WireRunHistory`'s *"`steps` is deliberately
absent"*), whose own reasoning expires by its own terms — *"read by nothing that reads this shape"*
ceases to be true when a caller reads it. AC-5 replaces it in place. Widening a wire shape is
precedented without an entry (Q-0016 added two fields to `WireRun`; Q-0121 moved two shapes into
`@quorum/shared` with schemas).

---

## §9 Risks

**R-1 — `GET /history/:id` is read by a shipped screen.** AC-5 changes its declared shape and mission
control's header reads it on every load. The widening is **additive over a value the route already
sends** and the schema is loose, so a browser holding the old shape still parses — which makes this
smaller than it looks, and it is still the thing to verify by rendering mission control unchanged
rather than by reasoning about it.

**R-2 — accidental N+1.** Reusing `fetchRunHistory` per row works on a three-run fixture and issues
171 requests here. AC-6's request-count assertion is the guard, and it must count over a fixture
larger than the viewport or it proves nothing.

**R-3 — the Q-0076 boundary.** This ticket's largest response is the 55,311 B detail; the largest
run's retained text is 3,514,617 B. Appendix A is where that boundary can be crossed without
noticing, and crossing it makes Q-0076 a blocker rather than leaving it at p3. Stated as a gate
finding for that ticket rather than scope either absorbs.

**R-4 — the corpus cannot teach four of the criteria** (§0.3). Every one of AC-9, AC-10, AC-11 and
AC-13 will be reasoned about from a type or a constructed fixture, which is precisely why their
`Test:` clauses forbid drawing from `.quorum/runs`.

**R-5 — this ticket's review will be truncated.** `repo.max_diff_bytes` is 200,000 and is read at run
start. Q-0135's four rounds fell 100% → 98.1% → 90.9% → 87.9% and lost `wire.ts`, the ticket's own
subject; Q-0129's four fell to 70.2% and lost `events.ts`, the field that ticket existed to add.
`git diff` orders by path, and the alphabetical tail here is **`packages/shared/src/wire.ts`** —
AC-1, AC-2 and AC-5's own subject. Expect it; GO-4 is the remedy.

**R-6 — a screen is where a measured rule goes quiet.** Four of AC-9's clauses are rules this product
has already paid to learn, and all four are invisible in a rendering test using a fixture with two
priced vendors. The fixture must be hostile: an unpriced vendor, a zero-priced vendor, a name nobody
has seen, and a roll-up row that is not an object.

---

## §10 Gate obligations

**GO-1 — rule the split.** If it is refused, say so in an **erratum that names the seam and names the
remedy on exhaustion in advance** — Q-0122's E-1 discipline, and what Q-0126 paid $177.92 for not
having. Under a refusal, **OQ-1 becomes blocking** and Appendix A's criteria are promoted rather than
improvised.

**GO-2 — if the split is taken, open the successor at this gate** from Appendix A, with its id
allocated by `quorum ticket new` rather than assumed. Three obligations in this repository have
expired inside a closed ticket's prose (Q-0110's, Q-0111's, Q-0112's) and one inside a source comment
(Q-0100's).

**GO-3 — ratify §8's no-entry-owed finding** before the implement step runs, and record the ruling in
the code's own authority comment rather than in a decision entry. If the gate disagrees, the entry is
a hard precondition and the run must not launch without it — Q-0062 paid three rounds for exactly
that, with its requirement having named the hazard in advance.

**GO-4 — the by-hand cross-vendor pass over whatever the diff cap omitted**, with the omitted file
list transcribed from Q-0124's `warn` rather than described, and reported through Q-0117's
`observation:` channel. The two have now composed on four consecutive tickets; on this one the tail
is the ticket's own subject (R-5).

**GO-5 — discharge by running the product and transcribing what it rendered**, not by reporting that
it was run. Q-0016's GO-6 was reported discharged when its by-hand half had not been performed and
Q-0015's gate found that. From a real daemon started by `quorum open`, with the served bundle
verified to carry this change's own copy first: the table over this repository's own runs; **a row
that is incomplete while it is incomplete**, which is the state §0.2 found live and which a fixture
cannot stand in for; a row whose vendor reports no price rendering `n/a` and not `$0.00`; one row
expanded to its occurrence timeline in `seq` order; and the empty state, which needs a runs root that
is empty and therefore a second project.

**GO-6 — verify forced in both environment rows**, the bare worktree with neither
`.harness/worktrees` nor `.quorum/runs` and `main` after the merge, per Q-0072's closing finding.

---

## §11 Provenance

**Candidate-claude is substantially the stronger document and most of this one is its.** Its §0
re-measured the ticket body and moved four claims; **I re-derived nine of its load-bearing claims
myself at this gate and every one held** (§0). Taken from it: the `incomplete` correction and its
consequence for AC-4 and AC-11; §0.3's exact prompt-less/`integrate` correspondence; the eight-column
correction and the two-drill-down-layer reading that moves the seam; the `WireRunHistory`
consumer-binds-producer finding and the 42.7% duplication; the live-run join recipe with its `dry`
trap; the narrowed-versus-raw roll-up measurement that makes 369 B/row meaningful; the
`WireExcludedFiles` forwarding that reframes OQ-1; and — the strongest paragraph in either document —
**the finding that the drill-down's confinement threat is an unvalidated `occurrence_dir` inside a
manifest `readRun` explicitly does not check, not a client's URL**, which is what makes Appendix A
need a `core` function rather than a route that reasons about paths. Its Appendix A is the basis of
this one.

**Candidate-codex contributed the tighter instruments and one ruling.** Its no-cap test that covers
more rows than the viewport shows (AC-2), so visual containment is not mistaken for server
truncation; its *"the server does not manufacture a time, duration, price or usage value when one is
absent"* clause (AC-2); its explicit refusal of the live-run link, which I adopted over
candidate-claude's link (OQ-3, §0.6); its *"an error response is not presented as an empty history"*
(AC-13); its insistence that the incomplete fixture be built by the test rather than drawn from the
developer's gitignored `.quorum/` (AC-11); and its risk register's naming of accidental N+1 (R-2).

**Where they disagreed, I picked rather than averaged.**
- **The seam.** Candidate-claude's, against the body's and candidate-codex's: the inline expansion is
  blocked by nothing and belongs with the listing, and this repository splits on disjoint blockers
  rather than on size (§6).
- **The live-run link.** Candidate-codex's refusal, against candidate-claude's AC-9 — but
  candidate-codex's stated reason (*"the two identifiers do not provide a durable join"*) is wrong,
  and candidate-claude's measurement is what proves it. Refused on cost and blast radius, with the
  recipe preserved (§0.6).
- **The measurements.** Candidate-claude's throughout: 171 runs, 1,779 files, 338 roll-up rows, 168
  unpriced. Candidate-codex relayed the body's 170/0-incomplete, which this run's own directory
  refutes.

**Struck:** candidate-codex's layout-containment criterion, as having no falsifiable instrument (§7
non-goal 10); its *"existing suites remain green"* and *"cross-cutting constraints"* criteria, which
are a baseline and a checklist rather than independently testable claims, folded into §5.

**Added at this gate, in neither candidate:** §0.1 — the detail route's two copies of the occurrence
array are different documents and only the top-level one carries `seq`, so AC-5 names which; and the
observation that this ticket **composes no filesystem path at all**, which states the A/B seam in
code rather than in prose.

---

## Appendix A — the successor, written out in full

*Written as a body rather than a paragraph, so the obligation is a ticket at the gate. The plan's
highest named id is Q-0136; the successor's is allocated by `quorum ticket new`, never assumed.*

### Q-00NN — The drill-down serves what an occurrence retained

`apps/web`'s history screen names each occurrence of a finished run and can open none of them. The
prompt each adapter step was sent and the output it returned are on disk — **1,779 files,
115,557,259 bytes across 171 runs** — and nothing in `packages/server` reads one: `grep` for
`prompt.txt` or `output.txt` across that package returns nothing. `core`'s reader offers
`resolveRunDirectory` and `readRun` and no file read of any kind.

**The confinement threat is not where a reader will look for it.** Q-0127's file route takes an
untrusted `?path=` from a client and derives membership per request. Here the client supplies an
occurrence *identity* and **the path comes out of the manifest**, which `readRun`'s own JSDoc calls
*"a cast, never a check"*: `manifestShapeError` proves only that `run_id`, `ticket_id` and `status`
are strings and that `steps` and `rollup` are arrays, and **no occurrence field is validated anywhere
on the read path**. The only code inspecting `occurrence_dir` is `contracts/run-manifest.ts`, which
is `harness validate`'s semantic pass and checks for **duplicates** rather than traversal. **No test
in either package stages a traversing `occurrence_dir`.** A manifest carrying
`occurrence_dir: "../../../etc"` is a live path a joining server would follow.

**A new `core` function is required rather than preferred.** `resolveRunDirectory` is deliberately
**not** on `@quorum/core`'s barrel — verified: `index.ts:124` exports the other six run-history
symbols and not it — because publishing a path-returning function *"whose only correct use is to be
opened immediately"* leaves a caller free to resolve lexically and read anyway. *Ruled rather than
offered; see Q-0092 merged.md OQ-1.* So the server may not compose the path, and the pair Q-0127
built is the shape: a listing function that names and measures an occurrence's files without opening
one, and a byte reader that confines and reads exactly one.

**The file-name set is open by construction.** `writer.ts`'s `persist(occurrence, name, text)` takes
the name as a **parameter**. Two names have ever been written — `output.txt` 931, `prompt.txt` 848 —
and a drill-down hard-coding them would be a register free to drift from the writer. **List the
directory.**

**Measured 2026-09-18.** Retained bytes per occurrence: max 355,744, median 99,652, p90 236,872. Per
run: max 3,514,617, median 459,758. Largest single file 353,626 B
(`Q-0129-3/steps/009-review/prompt.txt`). Of 1,779 files, **8 are empty, 0 are not well-formed UTF-8,
and 14 contain U+FFFD legitimately** — so the naive *does the decoded text hold a replacement
character* test would report fourteen real prompts as binary on the day it shipped. **Take the UTF-8
verdict with the decoder that will serve the bytes**: Q-0127 found `iconv` and `TextDecoder`
disagreeing on a file that round-trips byte-for-byte.

**Those numbers decide the payload, and it is the ticket's first decision rather than an
implementation detail.** A listing of `{name, bytes}` with one file fetched on demand means the
largest thing a reader ever receives is 355,744 B. Serving a run's text in one response makes it
3,514,617 B and **makes Q-0076 this ticket's blocker** rather than leaving it at p3.

**Two occurrence cases are ordinary and neither is a blank.** All **84** occurrences with no
`prompt.txt` are `integrate` steps (77 completed, 7 failed) — this product has produced no `script`
occurrence ever — so *this step was not an adapter call* is a true sentence rather than a guess. And
exactly one occurrence has no `output.txt`: a step that is **still running**, `writer.ts` guaranteeing
an empty one at terminalisation. **No output means not finished, not damaged.**

**Criteria sketch.** AC-B1 a `core` listing function over one occurrence, confining against the
manifest's own `occurrence_dir` and shown red against a traversing fixture. AC-B2 a `core` byte
reader — whole file, one read, one verdict. AC-B3 `GET /history/:id/file` taking the occurrence
identity and the file name as **query values**, membership derived for that request rather than from
a listing the client fetched earlier. AC-B4 refusal codes telling a name that was never listed from a
file that stopped being one between the listing and the read. AC-B5 the two ordinary cases above,
each a sentence. AC-B6 the UTF-8 refusal under its own code, taken with the serving decoder. AC-B7
the screen, plugging into this ticket's occurrence timeline. AC-B8 the architecture document's route
enumeration.

**Open first:** OQ-1 above — whether `WireExcludedFiles`'s forwarding of this subject to Q-0018 by
name survives the difference between an empty `.harness/` inside a ticket folder and 115 MB under
`.quorum/runs`. It is a payload question wearing an authority question's clothes. Measure before
choosing.
