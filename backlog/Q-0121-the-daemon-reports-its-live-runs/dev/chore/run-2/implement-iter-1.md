# Q-0121 — implement report, run 2, iteration 1

*Written against the tree after the change. Every measurement below was run rather than relayed.
No prior review report is present in `review/chore/run-2/`, so this is a first implement round.*

---

## §1 — What changed, file by file

### `packages/shared/src/wire.ts` (+100, AC-10)

`WireRefusal` and `WireRun` are **declared here now**, each with a runtime schema, plus the
listing's envelope. This discharges the obligation the server's own `wire.ts` header named by ticket
id — *"whoever needs them from a browser (Q-0015 or Q-0121) moves them the same way rather than
copying them"* — where **the same way means with an executable parser**, per §0.7: a moved type and
no schema recreates the half-measure Q-0120 had to repair.

What landed:

| name | what it is |
| --- | --- |
| `WireRefusal` / `wireRefusalSchema` | the three-field refusal body, `.strict()` |
| `WIRE_RUN_STATES` / `WireRunState` / `wireRunStateSchema` | the closed three, as a value, a type and an enum |
| `WireRun` / `wireRunSchema` | `{handle, flow, ticketId, runId, state, pendingGates}`, `.strict()` |
| `WireRunList` / `wireRunListSchema` | the `{ runs: … }` envelope, `.strict()` |

`remedy` is **nullable and not optional**, deliberately and asserted: absent and `null` are
different answers, and only one of them says *this surface has nothing to add to the condition*.

Two constraints this file is under were respected rather than discovered. It spells **no package
specifier** anywhere — `index.test.ts` asserts that literal appears in no file under `src`, tests
included — so the new prose says *"the server package"* and *"this package"*. And nothing here
reaches a `core` type: `ticketId` is a `string | null`, which is what makes R-3's ordering
constraint moot rather than merely survived.

`packages/shared/src/index.ts` is **unchanged**: the barrel is `export * from './wire.js'`, so the
new names flow through it. The browser-safety guard passes over the moved file unchanged (it is in
`sharedAllFiles()`'s corpus by construction).

### `packages/server/src/host.ts` (+25, AC-1)

`RunHost` gained `runs(): readonly RunView[]` — every minted run, **in mint order**, whatever state
each is in, projected through the same `viewOf` that `view(handle)` uses. It adds no state, no
lifecycle and no failure mode; `records` is a `Map` and `mint` is the only thing that inserts, so
mint order is insertion order.

Three choices are recorded in the JSDoc rather than left to be inferred:

- **The signature is a method returning an array** (OQ-1 left it to solutioning; AC-1 pins the
  property and not the shape). An array over an iterable because the two consumers both want to
  filter and reverse it, and a projection would have needed a second concept.
- **Mint order, not reverse.** A reader wanting recency reverses it. Reversing here would make the
  method's own name a claim about ordering it does not make.
- **Refused starts are included.** The enumeration answers *what exists*; deciding which of them a
  **listing** may carry is the transport's and is a narrower question (AC-4 against AC-5).

The unbounded-records fact is stated in place and routed to **Q-0123** by name, per §0.3 and GO-2.

### `packages/server/src/wire.ts` (+77/−70, AC-8, AC-10)

- Imports and re-exports `WireMessage`, `WireRefusal` and `WireRun` from `@quorum/shared`; declares
  none of them. What stays is the three **constructors** (`badRequest`, `wireRefusalOf`,
  `wireRunOf`) and the three status tables.
- **`wireRunOf` takes a `RunView` rather than a `StartOutcome`.** This is AC-8's *"widened rather
  than joined by a second projection"* implemented literally: a `RunView` is what all three
  run-answering routes hold, so one shape is structural rather than remembered.
- `state` is assigned straight from `view.state`, and **that assignment is the check**: a fourth
  `RunState` is not a `WireRunState` and fails to compile here rather than silently widening the
  wire back to the `string` it was declared as (§0.2).
- `ticketId` is `view.ticket === null ? null : String(view.ticket.meta.id)`. The `String()` is not
  ceremony: `read.ts:85` does the same thing for the same reason — `Backlog.read` asserts rather
  than parses (Q-0043 AC-4), so `meta.id` is a string by type and not by proof, and reporting what
  is on disk beats trusting the declaration. A start that never resolved a ticket reports `null`,
  never `""` and never the token the caller sent.

### `packages/server/src/http.ts` (+58, AC-3 to AC-7)

Two routes, and a module-private `LISTED_BY_STATE` table.

```
app.get('/runs',      …)   → { runs: WireRun[] }, listed states only, newest-minted first
app.get('/runs/:id',  …)   → one WireRun, or 404 badRequest('no-such-run', …)
```

`LISTED_BY_STATE` is `{refused: false, running: true, ended: true} as const satisfies
Record<RunState, boolean>` — **a table rather than `state !== 'refused'`**, so a state added later
has to be classified here instead of silently inheriting *listed*. `satisfies` is total over the
host's union and refuses a key the host cannot produce; the measurement that it fires is in §3.

The two routes' asymmetry is the ruling §5 took, and the comments carry the reason rather than the
rule: the **listing** answers *what can I join?* and omits a refused start (no broadcast,
socket closes 1008, handle disclosed to nobody — §0.4), while the **lookup** answers *what do you
know about this handle?* and reports it `refused`, reserving 404 for a handle the host never minted
so that the sentence *"no run is registered under that handle"* is true of the case it answers.

Neither route caches. An empty host answers `200 {"runs": []}`.

### `packages/server/src/index.ts` (+12/−7)

Docblock only: the wire shapes are all `@quorum/shared`'s now, re-exported here **as types only**,
so the runtime register `index.test.ts` pins is unchanged and no existing import breaks. The
`export type { … WireRefusal, WireRun }` line itself is untouched.

### `docs/04-architecture.md` (+55/−12, AC-13)

Three paragraphs and the status line:

1. The frame-union paragraph said `WireRefusal` and `WireRun` were *"still declared"* in
   `packages/server`. They are not; it now says where they are and what moved with them.
2. *"Three routes and one socket"* → *"Five routes and one socket"*, naming `GET /runs` and
   `GET /runs/:id`, followed by a new paragraph on what each answers, the selection rule, the
   per-request derivation, the row's shape and the unpruned records.
3. *"What the transport still owes"* described a surface that **exists**. It now separates what the
   August list asked for from what is built, names Q-0119's five read routes **as routes**, names
   Q-0121's two, and leaves only the served bundle owed — routed to Q-0122.
4. The status line gains its dated Q-0121 line.

GO-1 was taken as §5 ruled it: **no decision entry**, and the document edit is the whole of the
remedy. The routes are reads over state the host already holds, in the id space `:id` already names;
they add no dependency, no state and no new kind of surface, and contradict no landed entry.

---

## §2 — What the criteria's tests assert, and where

| criterion | where | the clause that makes it more than a shape check |
| --- | --- | --- |
| AC-1 | `host.test.ts` | three states in one host, mint order, each entry deep-equal to `view(handle)`; and the filtered enumeration is shown to lose two of three |
| AC-2 | `http.test.ts` | a run started **through the host object** appears in `GET /runs` — the one request that tells a host enumeration from a transport index |
| AC-3 | `http.test.ts` | empty case by body equality; three runs equal the reverse of `host.runs()`; repeating the request returns the same array |
| AC-4 | `http.test.ts` | refused handle asserted absent **by value**; then the same run driven to completion and re-listed, with `handle`/`flow`/`ticketId` unchanged and `runId` moving `null → 1` |
| AC-5 | `http.test.ts` | running, refused, never-minted; the 404 body's **key set** is exactly `{code, condition, remedy}` and its condition is the true sentence |
| AC-6 | `http.test.ts` | method loop over both paths; plus a **real watcher attached first**, so *"watchers unchanged"* is `1 → 1` rather than `0 → 0` |
| AC-7 | `http.test.ts`, `serve.test.ts` | both on a bare `createApp`; both over a real port on a `createDaemon` daemon, answering with the run **that daemon's own `POST /runs`** started |
| AC-8 | `http.test.ts` | `pendingGates: 1` at a gate; the 201 body, a listing row and a lookup body share one **key set**, asserted as a set |
| AC-9 | `http.test.ts` | a marker in the ticket body, the gate's own `reason` and the ticket folder name, over **serialised bytes** — with both needles first proven present on the host's view |
| AC-10 | `wire.test.ts` (shared) | three refusal classes report three **different** issue codes; the envelope refuses a bare array and a bad row |
| AC-11 | `serve.test.ts` | the start's handle is **discarded**, the listing is taken over a real socket, and the handle from it replays the retained buffer to `terminal`, closing 1000 |
| AC-12 | `apps/web/test/routes.test.ts` | both halves: the false clause is gone, the true one stays, `ticket` is still `null`, and the replacement is an answer rather than an absence |
| AC-13 | `package.test.ts` (server) | the route set is derived from `app.get(`/`app.post(` first arguments over `production()`, as an identity of **eleven** |

Two deliberate strengthenings, each with its reason in place:

- **AC-13's register is `METHOD path`, not `path`.** `GET /runs` and `POST /runs` are the same path,
  so a path-only register would have reported this ticket's listing as documented on the strength of
  a sentence about the start route written in August — the guard would have passed over the one
  route it was added for, and GO-5's red demonstration would have been impossible for it. Measured:
  §3 row 8.
- **`listRuns()` parses every listing through `wireRunListSchema`.** That is what stops AC-10's
  schemas being declarations with no subject, and it is what caught two of the mutations in §3.

`fixture.ts` gained one optional field, `body`, so AC-9's marker is a phrase somebody chose for it
rather than the fixture's default prose. Additive, and no existing caller changes.

---

## §3 — Every new guard shown red before being trusted green

Each row is a mutation applied to the tree, the suite run, and the mutation reverted.

| # | mutation | what failed, by name |
| --- | --- | --- |
| 1 | `RunState` gains `'paused'` | **typecheck**, three errors: `TS1360` — `LISTED_BY_STATE` no longer satisfies `Record<RunState, boolean>`; `TS7053` on the index; and `TS2322` — *"Type 'RunState' is not assignable to type '\"refused\" \| \"running\" \| \"ended\"'"* at `wire.ts:115`, which is the wire refusing to widen back to `string` |
| 2 | `LISTED_BY_STATE.refused = true` | AC-4: *"expected `[ 'ended', 'refused', 'running' ]` to strictly equal `[ 'ended', 'running' ]`"* |
| 3 | `.reverse()` removed from the listing | AC-3: *"expected `[ 'run-3', 'run-4', 'run-5' ]` to strictly equal `[ 'run-5', 'run-4', 'run-3' ]"* |
| 4 | `GET /runs/:id` 404s a refused handle | AC-5: *"a handle the host minted was reported absent: expected 404 to be 200"*, and AC-4's selection clause with it |
| 5 | the listing reads a route-local index populated on `POST /runs` | AC-2 **by name**: *"the listing is an index of what the route saw: expected `[]` to strictly equal `[ 'run-2' ]"*, plus AC-3, AC-4 and AC-9 |
| 6 | the whole `RunView` is handed to `c.json` | AC-9: *"/runs carried the ticket's prose"*, and five schema failures from `listRuns` |
| 7 | a second projection adds `watchers` to each row | five schema failures, `code: 'unrecognized_keys'` — the `.strict()` schema is what catches a widened row |
| 8a | `app.get('/runs/:id/cost', …)` registered, undocumented | AC-13: *"04-architecture.md's packages/server section does not name GET /runs/:id/cost"* — **GO-5 discharged** |
| 8b | `app.delete('/runs', …)` registered, undocumented | AC-13: *"…does not name DELETE /runs"* — the method-awareness argument, measured: a path-only register would have passed |
| 9 | `host.runs()` filtered to `state === 'running'` | AC-1 **by name**: *"the enumeration is not in mint order: expected `[ 'run-5' ]` to strictly equal `[ 'run-4', 'run-5', 'run-6' ]"*, plus AC-2, AC-3 and AC-4 |
| 10 | `routes.ts`'s old sentence restored | AC-12: *"the route still tells a user the daemon reports no listing"* |
| 11 | the listing takes a subscription per row | AC-6: *"a read took or dropped a subscription: expected 3 to be 1"* |

AC-13's in-test hostile fixture (the `GO-5` clause) runs the **real derivation and the real
comparison** over hostile source text rather than asserting over a string, and additionally proves
the derivation reports a computed route path as unreadable rather than skipping it.

---

## §4 — The one contradiction in the requirement, and what I did about it

**AC-6's literal reading is unsatisfiable, and it contradicts non-goal 8 of its own document.**

AC-6 says *"A POST or DELETE to either is not routed"* and its *Test:* clause says to apply
`read.test.ts:45`'s existing method loop — which asserts `GET → 200`, `POST → 404`,
`DELETE → 404` — to the two paths. Applied to `/runs`, the POST row is false and **must** be false:
`POST /runs` is the start route Q-0118 shipped, and §4.8 of this same requirement makes changing it
a non-goal in as many words (*"Changing `POST /runs`'s refusal table, statuses or classifier"*).
There is no implementation that satisfies both sentences.

I did not improvise a decision the requirement does not authorise, and I did not answer `blocked`:
nothing here needs a decision entry or a file outside my paths, and one of the two readings is
flatly impossible. **What I implemented is the satisfiable reading**, and I pinned the divergence
rather than smoothing it over:

- `DELETE` and `PUT` are not routed on **either** path.
- `POST` is not routed on `/runs/:id` — the lookup path, where AC-6's row is true.
- `POST /runs` is asserted **still to be the start route**, by a refusal carrying a `code`, which an
  unrouted method could not produce. So a later change that did delete it fails this test.

The test's comment states the contradiction and names both clauses, so the next reader meets the
reasoning rather than re-deriving it. Per Q-0067 E-1, a criterion's *Test:* clause bounds the
instrument — here the clause itself is what cannot hold, which is why this is reported rather than
worked around silently. **A reviewer should weigh whether an erratum is owed for AC-6's wording.**

---

## §5 — A `turbo.json` I wrote and then removed, on measurement

AC-13's guard reads `docs/04-architecture.md` from `packages/server`'s suite, which is an
out-of-package read. Under *"A cache hit names what the task reads, not what its package contains"*
(2026-08-28) I wrote `packages/server/turbo.json` declaring it, on `packages/shared`'s and
`packages/cli`'s pattern.

**Then I measured it, and it was unnecessary.** With no package configuration in
`packages/server` at all, appending one line to `docs/04-architecture.md` moves
`@quorum/server#test`'s hash:

```
no turbo.json, document unchanged   → Hash f03a2d8a7e5b817e   Cached (Local) = true
no turbo.json, one line appended    → Hash 247ae7d079123910   Cached (Local) = false
```

The mechanism: `@quorum/shared#test` declares `../../docs/04-architecture.md` for `docs.test.ts`'s
own assertions over **this same section**, root `test` declares `dependsOn: ["^test"]`, and
`@quorum/server` depends on `@quorum/shared` — so that task's hash is inside this one. Declaring it
here would **over-declare**, which is the reasoning `packages/cli/src/package.test.ts`'s own audit
gives for the reads it leaves out. The file was deleted; `git status` holds no trace of it.

**The residual is stated rather than left to be found**, in the guard's own JSDoc with the two
hashes: the coverage is **transitive**, so it lasts as long as `packages/shared` goes on reading that
document. It is not fragile in practice — what reads it there is `docs.test.ts`'s Q-0013/Q-0014
blocks over this very section — but a change removing those would take this read's hash with it,
silently. Q-0072 E-1 item 3's discipline: a registered gap is acceptable and the same gap unmentioned
is the defect.

This also means AC-13's guard earned **no** `turbo-inputs.test.ts` registration: that file's clauses
are scoped to `@quorum/shared#test` and `@quorum/core#test` via `SUITES`, and `packages/server` is
audited by its own suite.

---

## §6 — What I deliberately left alone

- **Every non-goal in §4.** No fetch in `apps/web` and no Runs landing screen (§4.1 — the app still
  makes no HTTP request at all); no reporting of a CLI run (§4.2 — a different process, and
  `GET /history` already reports it incomplete); no browser persistence (§4.3); no durable handles
  (§4.4); **no pruning, eviction, cap or pagination** (§4.5 — Q-0123, and the reason is written into
  `host.ts` so it is not rediscovered and undone); no extra row field (§4.6 — `watchers` is refused
  on OQ-2's reasoning, no timestamp on OQ-5's, no terminal status on OQ-4's); nothing about
  retention, `missed`, ordering, frames or backpressure (§4.7); `POST /runs`'s refusal table,
  statuses and classifier untouched (§4.8); **no `exports` map for `packages/server`** (§4.9 — the
  shapes went to `@quorum/shared` instead); no build task or static route (§4.10 — Q-0122); no
  authentication or bind change (§4.11); the gate answer vocabulary is still three (§4.12); **no new
  external dependency** (§4.13).
- **`apps/web/src/daemon-endpoints.ts` is unchanged.** `/runs` is already forwarded and the dev
  proxy already steps aside for a page navigation (Q-0120 review B-1). §5's observation is right
  that no criterion should pin it here: this ticket adds no fetch, so a criterion over that
  behaviour could only pass vacuously.
- **`read.ts` and `mountRead` are unchanged.** The two new routes read the **host**, and `mountRead`
  is given a project and no host (§0.6); mounting them there would have changed that module's
  signature and broken its stated property.
- **`packages/core/src/backlog/backlog.ts:330`'s ESLint warning** — *"Unused eslint-disable
  directive (no problems were reported from 'no-control-regex')"*. Pre-existing, in a file this
  change does not touch, and `lint` exits 0 over it. Reported, not fixed.
- **No glossary term coined**, per GO-4, which is recorded in the status line so a later reader does
  not re-litigate it. `RunState` still appears in no glossary entry; that predates this ticket and
  §5's observation stands.
- **No decision entry**, per GO-1 and §5's ruling.

---

## §7 — Verification

Run in this implement worktree, which has neither `.harness/worktrees` nor `.quorum/runs`. The
post-merge row on `main` is GO-6's and is the gate's.

```
pnpm install --frozen-lockfile              → up to date
pnpm turbo run test lint typecheck --force --continue
                                            → 21 successful, 21 total; 0 cached, 21 total
@quorum/server                              → 8 files, 146 tests passed
@quorum/shared                              → 13 files, 190 tests passed
@quorum/web                                 → 10 files passed
@quorum/core                                → 61 passed | 1 skipped   (the skip is Q-0105's
                                               documented ownership-hook probe, not new)
@quorum/cli                                 → 25 files, 628 tests passed
pnpm exec quorum lint                       → 6/6 flows clean
pnpm sweep:git-identity                     → exit 0, both checkout shapes:
                                               "the workspace suite executed and green with no
                                                resolvable git identity"
```

The sweep matters here rather than being ceremony: the new tests build real repositories and drive
real runs, so a verdict that depended on the machine's git identity was a live hazard. Every fixture
supplies its identity per invocation, which is the discipline `test/fixture.ts`'s header already
states.

`git status` holds fifteen modified files and no additions — `packages/server/turbo.json` is gone
per §5, and no probe line survives in `docs/04-architecture.md`.

---

## §8 — For the reviewer, in order of what I would check first

1. **§4's contradiction.** AC-6 as written cannot be satisfied. I implemented the reading that keeps
   `POST /runs`, pinned the divergence in the test, and think an erratum on AC-6's wording is the
   right disposal — but that is a gate's call, not mine.
2. **§5's removed `turbo.json`.** The measurement is two hashes and is reproducible in two commands.
   If you disagree that transitive coverage is enough, the fix is one file and the guard's JSDoc
   already names what it would declare.
3. **AC-13's method-awareness.** I made the register `METHOD path` rather than `path`, which is
   slightly stronger than the *Test:* clause's *"every route path literal"*. §3 row 8b is the
   measurement that says the weaker form would have passed over this ticket's own listing route. If
   you read that as an implementer raising the job the clause gives the instrument, say so — but the
   alternative is a guard with no subject for `GET /runs`.
4. **AC-10's schemas have no production consumer**, by design: the browser half is §4.1's non-goal.
   They earn their keep in the suite instead — `listRuns()` parses every listing through
   `wireRunListSchema`, which is what caught mutations 6 and 7 in §3. If you would rather they were
   unexercised until a screen reads them, that is a real choice and I took the other one.
5. **`fixture.ts`'s new `body` option.** Additive and optional, used by one test. The alternative was
   asserting AC-9's marker over the fixture's default prose, which makes the check depend on a phrase
   nobody chose for it.
