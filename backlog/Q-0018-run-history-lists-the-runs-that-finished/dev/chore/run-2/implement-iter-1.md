# Q-0018 — implement, run 2, iteration 1

*Scope: `requirements/merged.md` AC-1 to AC-14, as erratum **E-1** rules them — the manifest-read
half. The retained-file drill-down is **Q-0137**, which exists on disk and in the plan and is not
touched here. **This half composes no filesystem path**, which E-1 names as the seam being checkable
in code rather than only in prose, and it holds: nothing below joins a path, opens a file, or reaches
for `resolveRunDirectory`.*

**Verdict: `proceed`.** Nothing required a `docs/decisions/` entry (E-3 ratified that none is owed
and I re-applied its test at each site I touched), nothing required a file outside
`developer-generalist`'s paths, and nothing contradicted a landed decision.

---

## What changed, file by file

### `packages/shared/src/wire.ts` — the shapes (AC-1, AC-2, AC-5)

**`wireVendorRollupSchema` was extracted** from the inline element inside `wireRunHistorySchema`,
byte-for-byte, and is now used by both routes. Two routes answer one roll-up row and a second inline
copy would be free to drift from the first. Its JSDoc carries the reasoning the old inline comment
did, plus the one clause that is new: it stays **loose on both routes for one reason and not two** —
a row is `core`'s `VendorRollup`, which carries five token measures beside these four and may gain a
sixth. That the listing's projection emits exactly four is a fact about that route, held by an
assertion over its response rather than by this schema.

**`WireRunHistoryOccurrence` + `wireRunHistoryOccurrenceSchema`** are new: seven fields of an
occurrence's fifteen, loose for the rest. Its JSDoc records three things a reader needs — that the
glossary's word is *occurrence* while the field keeps the manifest's own name `steps`; that **`seq`
is the only field here that is not on disk**, which is why this is the copy a surface reads and
`manifest.steps` is not; and what a required field costs, stated rather than left to be found.

**`WireRunHistory` gained `steps`**, and its docblock lost two sentences:

- *"it closes the last route on this transport that declared no shape"* — **wrong when it was
  written**. Two answered an inline literal, and the other, `GET /project`, still does. AC-14(a). The
  correction names `/project` as somebody else's rather than silently inheriting it.
- *"`steps` is deliberately absent … read by nothing that reads this shape"* — a reason with an
  expiry date, which a caller reading it is what spent. Replaced with what changed and why it is
  declared as a loose seven rather than over fifteen keys, which is the half of that objection that
  still binds.

**`WireRunHistoryRow`, `WireRunHistoryWarning`, `WireRunHistoryList`** and their schemas are new.

- **The row is `.strict()` where the detail is loose**, and the JSDoc says which rule decides each
  level: Quorum owns every key of a row except the roll-up's.
- **Two naming conventions meet, and the difference is load-bearing.** A field carrying a manifest
  value unaltered keeps snake_case (`started_at`, `ended_at`, `duration_ms`), so one run's start
  reads the same in the listing and the detail; a field this transport derived is camelCase, which is
  `occurrenceCount` alone. `id`, `ticket`, `flow`, `status` and `incomplete` predate the rule and are
  left — renaming five shipped fields to satisfy a convention is a breaking change bought with
  nothing.
- `started_at` is `.min(1)` **because `WireRunHistoryManifest.started_at` is** — one value, two
  routes, one rule. This was `z.string()` in the first draft and a JSDoc in `read.ts` claimed
  otherwise; caught while checking my own prose against the code.
- `WireRunHistoryWarning` is named inside the family rather than `WireRunWarning`, which would be a
  near-homograph for something about `WireRun` — a live run reached by an unrelated id. Both field
  names are kept, and Q-0121 GO-3 **permits** that rather than excusing it: the shape narrows
  nothing.
- **No cap, no page, no truncation**, with the measurement in the JSDoc: 63,115 B for 171 runs,
  369 B a row against 581 B raw, and no extra server read.

### `packages/server/src/read.ts` — the route (AC-1 to AC-4)

`/history` assigns to `const body: WireRunHistoryList`, the arrangement four handlers in that file
already use. A new `historyRow(run)` composes each row.

**The one design decision the requirement does not cover, taken and stated rather than improvised.**
`readRunsDir` proves five things about a manifest; this route answers with more than five, and
`readRun` calls the parsed document *"a cast, never a check"*. So `historyRow` **parses each
candidate with `wireRunHistoryRowSchema` itself**, and a failure becomes a `warnings` row carrying
the parser's own words. Three reasons, in the function's JSDoc:

1. It makes the declaration a promise rather than an annotation, and covers a field a later ticket
   adds without anyone remembering.
2. **A run it cannot compose is named rather than dropped**, which is what `GET /tickets`'s treatment
   of a damaged ticket already does one route over.
3. **The blast radius is the difference from the detail route, not the principle.** A damaged
   manifest at `GET /history/:id` is one unparseable response; the same file here would otherwise make
   every run in the store unreadable at once, which is what `failSoftly`'s distinction exists to
   prevent.

The JSDoc's rate claim is **bounded to what I actually measured**. The requirements run measured
0 of 171 unreadable by `readRunsDir`; it did not measure how many fail *this* check, and this
worktree has no run store to measure. What is asserted instead is stronger and does not rot — and it
is asserted in a test, not only in prose: `wire.test.ts` offers six malformed values to both schemas
and requires the two answers to agree, so **a manifest this listing refuses is one
`GET /history/:id` was already refusing**.

`occurrenceCount` reads `run.manifest.steps.length` with **no guard**, and the comment says why: that
`steps` is an array is one of the five things `manifestShapeError` proves before an entry reaches
`runs` at all. A defensive branch there would have been dead code pretending to be a check.

`GET /history/:id` is unchanged. It is deliberately **not** annotated with `WireRunHistory`: the
response carries a top-level `id` the shape does not declare — legal under a loose schema, and an
excess-property error under an annotation — and AC-1 is about `/history`.

### `apps/web` — the screen (AC-6 to AC-13)

**`src/history-text.ts`** (new). The copy, and `RUN_STATUSES` — the eight `core` declares,
transcribed with the authority named, because `apps/web` may not import `@quorum/core` and the wire
deliberately keeps `status` a plain string. **Its blind spot is written into its own JSDoc**: a ninth
member added to `core`'s union is not seen here, and what it renders is `unknownStatusText`, which
*names* it. That is what makes a transcribed list safe where a transcribed count would not be.

It **declares no measure and formats no figure** — `formatCost`, `formatElapsed` and `vendorCostRows`
are imported from `mission-control-measures.ts`, and the `n/a`-never-`0` sentences from
`mission-control-text.ts`. Those rules are the product's rather than one screen's, and a second copy
would be a second place to be wrong about a sentence this repository has already paid to learn.

**One sentence is this screen's own and had to be**: `LISTING_UNPRICED_TEXT`.
`unpricedVendorText` renders a token total beside an absent price, and a **listing row carries no
token total** — the projection narrows those away. Using the detail's sentence in the table would
have answered *n/a, which is not zero* about a measure the response never asked for: a claim made out
of a gap. The token total appears when the row is opened, and the table discloses that rather than
approximating it.

**`src/history-screen.tsx`** (new).

- One read on mount; **Refresh is the only thing that repeats it**; no timer.
- **Rows in the daemon's own order** — `sortRuns` decided it and the screen declares no comparator.
- **Nothing is a link.** This is the one screen here quieter than its neighbours, and the reason is
  in the module header: a history row has nowhere to go that this app can address.
- Opening a row reads that run's `GET /history/:id`; **at most one open**; **collapsing discards the
  read** rather than holding it.
- A refresh closes an open row, because a refresh may report that run differently and a detail
  rendered under a moved row would be one run's occurrences beside another run's figures.
- One generation counter for both reads, shared deliberately: a refresh must invalidate a detail read
  already out.
- Occurrence keys are positional, because `occurrenceSeq` answers `MAX_SAFE_INTEGER` for a directory
  name it cannot read and two such would share a key.

**`src/routes.ts`**: `HISTORY_PATH` exported on `BOARD_PATH`'s precedent; the rail entry and the
route row both flipped to `screenExists: true`; the `waitingFor` sentence **kept and rewritten**, on
the board's, the ticket page's and the gate screen's reason. Its JSDoc records that this is **not**
`DAEMON_ENDPOINTS.history` — same string today, different things, under no obligation to stay alike.

**`src/daemon-client.ts`**: `fetchRunHistoryList` and `runHistoryListInFlight`. **No new path
literal** — the prefix is already declared and already forwarded — so no `test/routes.test.ts`
exception row is owed, which is `runStopPath`'s ruling read the other way.

**`src/app.tsx`**: one arm, selected by the register's own constant.

### Documents (AC-14)

- **`docs/04-architecture.md`** — status line, the `packages/server` section and the `apps/web`
  section. The server paragraph names the shapes, the narrowing with its measurement, the
  warnings channel and its reason, and `GET /project` as the remaining gap. The app paragraph records
  the refutation, the seven-of-eight columns, the vendor-badge rule and the closed status vocabulary.
- **`docs/05-design-prompt.md`** — a divergence paragraph after screen 8 and a status-block entry,
  in the shape screens 2, 5 and 6 already use. It refutes *"reuse screen 5 in a 'completed' state"*
  with both independent reasons and the 171-against-zero measurement, rather than routing it to a
  successor.

### Registers moved rather than exempted around

`apps/web/test/source.test.ts` (four shapes added to the may-not-declare register, a companion import
clause, a `tokensByVendor` register row for the new fixture, and a new describe block for AC-8, AC-9
and AC-11); `apps/web/test/routes.test.ts` (rail and route identities, and the app-selection map);
`packages/server/src/package.test.ts` (AC-1's source clause, and `MESSAGE_READS` widened to a receiver
set per file with a new clause asserting the other direction). Three existing fixtures gained
`steps: []` because the field became required.

---

## Where a criterion's `Test:` clause names an instrument that does not discriminate

Both are implemented in the honest form, with the measurement committed rather than reported in
prose. Neither weakens the criterion's normative half.

**AC-5's mutation.** It asks for *a mutation removing `steps` from the schema turns an AC-12
assertion red*. Measured in `wire.test.ts`: **`z.looseObject` preserves an undeclared key**, so a
schema that had never named `steps` hands a browser the same array and the timeline renders
unchanged. What the declaration actually buys is that an occurrence array a timeline could not order
is **refused** instead of rendered — asserted at the schema in `wire.test.ts` and at the screen in
`history-screen.test.ts`, where such a response renders `unparseable` instead of an opened region —
plus the compile-time existence of `WireRunHistory.steps`, which `tsc` proves and no assertion here
can.

**AC-9's scan.** It asks for *a source scan finding no vendor-name literal under `apps/web/src`*, and
that scan is **red on the day it ships**: `backlog-board.tsx:59`'s cost legend names a vendor by
design, because `@quorum/shared` may name no vendor in code and that sentence is declared on both
surfaces. Q-0058's shape exactly. The scan is scoped to this screen's two files, the narrowing is
stated where it fires, and a clause asserts the board still names a vendor — so if that stops being
true, the narrowing's own justification fails rather than going quiet.

---

## What I deliberately left alone

- **`docs/06-development-plan.md`.** Rewritten by hand at each plan pass; Q-0094 E-3(a) records what
  an implement step editing it costs. Its Q-0018 and Q-0137 bullets already describe this cut.
- **`GET /project`'s missing shape** — non-goal 4, reported in AC-14(a) and in the architecture
  document so the corrected sentence is not read as coverage.
- **The occurrence-array duplication on `GET /history/:id`** — non-goal 6. 42.7% of that route's
  payload, and removing `manifest.steps` is a behaviour change to a shipped screen. Registered with
  the figure in `WireRunHistory.steps`'s own JSDoc.
- **The live-run join.** Not built (OQ-3). The recipe and its `dry` collision trap stay in
  `merged.md` §0.6 and in `LIVE_RUN_TEXT`'s JSDoc so a successor uses them rather than re-deriving.
- **Mission control**, the run lock, the engine, the flows, `packages/core`, `packages/cli`,
  `harness/` and `backlog/`. No new dependency.
- **`packages/core`'s one pre-existing lint warning.** Not my file; not repaired in passing.

---

## Verification

`pnpm install --frozen-lockfile` then `pnpm turbo run test --force --continue` — the two
`harness.yaml` commands verbatim — **7/7 tasks, 0 cached, green**. With `typecheck` and `lint`:
**21/21 tasks, 0 cached**. `pnpm turbo run build --force` 5/5. `pnpm exec quorum lint` **6/6**.
`pnpm sweep:git-identity` green: *"the workspace suite executed and green with no resolvable git
identity"*.

**The green was distrusted, not banked** (Q-0051). Six mutations, each red with a discriminating
message, each restored and re-verified:

| Mutation | Fails | Message |
| --- | --- | --- |
| Drop `const body:` from `/history` | AC-1 source clause | *the /history handler does not assign its response to the listing shape* |
| Drop a damaged run instead of warning | AC-3 | *a run that could not be reported was dropped: expected [T-0001-3] to strictly equal [T-0001-2, T-0001-3]* |
| Send the manifest's roll-up rows raw | AC-2 | *expected [ [ …(8) ], [ …(8) ] ] to strictly equal [ …(2) ]* |
| Render `$0.00` for an unpriced vendor | AC-9 | *an unpriced vendor was rendered as free* |
| Render occurrences in array order | AC-12 **and** AC-8's no-comparator clause | *rendered in array order rather than in `seq` order* |
| Suppress the incomplete indication | AC-11 | *the row does not say it never recorded an end* |
| Suppress the warnings region | AC-3 render | *the unreadable region has no heading* |
| Keep the read on collapse | AC-12 | *collapsing left the region open* |

Every fixture is built by its own test; **nothing reads `.quorum/runs`**, which is gitignored and
would make a verdict a property of the checkout. The vendor names in every rendering fixture — `zeta`,
`omega`, `kappa`, `iota` — are ones no adapter here produces, because every `claude` row in this
repository's history is priced and every `codex` row unpriced, so a fixture using them would pass over
an implementation that branched on the name.

## What is not discharged here

GO-4's by-hand cross-vendor pass over the truncated tail, GO-5's run of the product with what it
rendered transcribed, and GO-6's second environment row are the gate's. R-5 predicts the diff cap
will hide `packages/shared/src/wire.ts` — AC-1, AC-2 and AC-5's own subject — and the four new files
sort after it, so the tail is larger than usual. This worktree holds no run store, so GO-5's table
over this repository's own runs is not reachable from here at all.
