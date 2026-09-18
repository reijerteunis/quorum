---
id: Q-0135
title: Mission control shows elapsed time and the per-vendor cost split
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0135/integration
priority: p2
created: 2026-09-17
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-18T01:24:03.267Z
    cost: 23.071
---
The other half of the mission control header: elapsed time from the run's started_at, and one cost row per vendor read from the run's live manifest. Split from Q-0131 at its requirements gate, 2026-09-17, with Appendix A transcribed in full.

**M3**, split from Q-0131 at its requirements gate on 2026-09-17. The body below is Appendix A
of `backlog/Q-0131-*/requirements/merged.md`, transcribed in full rather than referenced, because
`input.backlog` resolves against the running ticket's own folder and nothing injects a sibling's.

**It depends strictly on Q-0131** — the history id is `<TICKET>-<n>` and a live run supplies no
`n` until that ticket lands — and **it owes no decision entry under any ruling**, which is what
made the seam a disjoint blocker rather than a size cut. Criteria are numbered continuously from
AC-8 (Q-0106's precedent) so the gate could have folded them back at no cost; it did not.

*Re-measure before writing anything. Every citation below was true at Q-0131's gate and this
repository has moved a line number under four consecutive tickets.*

---

## Appendix A — the deferred half, transcribed in full

*Elapsed time and the per-vendor cost split, written as criteria rather than described, numbered continuously from AC-8 (Q-0106's precedent) so the gate can fold them back at no cost. **It owes no decision entry under any ruling**, and it depends strictly on this ticket, the history id being `<TICKET>-<n>`.*

### A.1 What it is built on

Everything it needs already exists and is already served. `writer.ts:502–507` creates `manifest.json` at run start with `started_at`, `status: 'running'` and `rollup: []`; `terminal()` at `:594` and `finalise()` at `:621` recompute `manifest.rollup = rollup(manifest.steps)` in full and replace the manifest atomically, so the roll-up is **live and correct while the run runs**. `VendorRollup` (`manifest.ts:85–92`) is the five measures plus the exact vendor string, `step_count` and `unpriced_steps`. `GET /history/:id` (`read.ts:404–425`) already answers `{id, manifest, incomplete, tokensByVendor, steps}`, `tokensByVendor` being `vendorTokenTotal` applied one row at a time. `apps/web` already has `DAEMON_ENDPOINTS.history` (`'/history'`), `requestJson`, an injectable `Clock`, and the `ticketDetailPath`/`runDetailPath` helpers. **Nothing has to be computed; it has to be read and rendered.**

### A.2 The one asymmetry to rule before writing code

`contracts/Q-0015/mission-control.contract.md:9` — *"Refresh is the only repeat read; no timer performs one."* That clause bounds **reads**. A display advancing from a `started_at` the browser already holds performs no read and does not engage it. So **elapsed advances and cost does not**: cost ships as of the last read, with the existing "Check again" control, and the brief's word *ticker* does not survive measurement and is not used for it — Q-0017's precedent, where *"Run next flow ▸"* and `review 1/3` were each recorded as measured divergences rather than approximated. The distinction is one line of code wide and AC-9 is what keeps the two apart.

### A.3 Why cost is a read and not a field on `done`

§0.4, with its measurement. A browser accumulating per-step usage over a head-evicting 500-event buffer under-reports silently, exactly when the screen discloses a discard; candidate-codex's own draft conceded this and answered it by labelling the figure incomplete, which is to ship a number known to be wrong beside a sentence admitting it. It would also be a third site computing a per-vendor total, beside `rollup` and `vendorTokenTotal`. **And the read-based design is immune to replay double-counting by construction** — the daemon replays its retained buffer to every new subscription and the union carries no sequence number by decision, which is what Q-0015's erratum E-11 ruled for the trace.

### A.4 Criteria

**AC-8 — one shared schema for the history detail read.** `apps/web` declares no wire shape of its own (Q-0127 AC-7), so `packages/shared/src/wire.ts` gains a schema over the subset this screen reads — `started_at`, `ended_at`, `status`, `rollup[]` as `{vendor, cost_usd, unpriced_steps, step_count}`, `incomplete`, `tokensByVendor` — with the **loose** disposition rather than `.strict()`. That is the landed rule and not a concession: *"Unknown keys are refused where Quorum owns the key set, and preserved where it does not"* (2026-08-25), and `readRun`'s own JSDoc calls the parsed manifest *"a cast, never a check"*, so a browser refusing a manifest carrying a key it did not know would fail on a document this product itself wrote.
*Test:* accepts a real manifest from a fixture run directory; accepts one carrying an unknown key; **refuses a `rollup` that is not an array and one whose elements are not objects with a string `vendor`** — the guard `read.ts` needed two review rounds to get right, met here rather than rediscovered; `cost_usd` nullable, `unpriced_steps` and `step_count` non-negative.

**AC-9 — the browser forms the history id from what it holds, and no fetch happens on a timer.** The screen composes `<ticketId>-<runId>` from the loaded `WireRun` and reads `GET /history/<id>` through the existing `requestJson` and the AC-8 schema, adding one path helper beside `ticketDetailPath` and `runDetailPath`. **One read on mount and one per explicit refresh.** Where `ticketId` or `runId` is absent, no read is issued at all.
*Test:* the read happens once on mount and once per "Check again"; a source clause asserts **no fetch is reachable from a timer callback** and is shown red over a fixture that polls; the id is composed from `ticketId` and `runId` and never from the handle; the absent case issues no request.

**AC-10 — elapsed advances, formats, clamps and freezes.** Elapsed is the browser's clock minus the run's `started_at`, taken through the existing injectable `Clock` and never a bare `Date.now()`, advancing **at least once per second while the run is running**. Under one hour it renders `MM:SS`; at one hour or more `H:MM:SS`; minutes and seconds zero-padded. A negative difference from a clock adjustment renders `00:00`. Once the run has ended the screen renders the fixed difference between `ended_at` and `started_at` and **stops advancing**. The rendering names whose clock produced a live figure.
*Test:* against an injected clock, `00:00`, `14:32` and `1:00:00` each render exactly, so the verdict is a property of the commit rather than of the machine — *"A test's verdict is a property of the commit"* (2026-08-30); live advancement and terminal freezing are each observed and each fails if the other's behaviour is substituted; a `started_at` in the future renders `00:00`; a source clause asserts no file under `apps/web/src` reaches `Date.now()` or a bare `new Date()` on this path.

**AC-11 — per-vendor cost is one row per vendor, and is never summed across them.** One entry per `rollup` row, in the roll-up's own order, grouping on the exact vendor label and **never branching on a known vendor name**: the label, `cost_usd` where it is a number, and where it is `null` that vendor's `tokensByVendor` total with the fact that it is **unpriced and not free**. `unpriced_steps` is disclosed where it is non-zero, so a partly-priced row says how much of itself it cannot see. **No total across vendors is rendered anywhere**, and this screen reads neither `terminal.cost` nor `terminal.tokens`.
*Test:* a two-vendor fixture — one priced, one `cost_usd: null` — renders two entries and no third; an assertion fails if any rendered figure equals the sum of two rows' `cost_usd`; a source clause forbids reading `terminal.cost` or `terminal.tokens`; an all-unpriced fixture renders **no `$0.00` anywhere**, which is the `n/a`-never-`0` rule every measure in this product is under. **Not eligible for trimming** — it is the one place a blended figure could reach a reader, and `terminal.cost` is already a typed number on the wire, which is what makes the wrong answer tempting.

**AC-12 — the count register moves by exactly one row, deliberately.** `tokensByVendor` leaves `apps/web/test/source.test.ts`'s `COUNT_FIELDS` with the reason recorded in place: it is the one shape in which a **per-vendor, already-reduced** count reaches this app, computed by `vendorTokenTotal` over one row inside `packages/server`. `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` **stay forbidden**, being the four from which a browser could compose a figure of its own; `cost_usd` and `unpriced_steps` are on no list, the guard being about counts and saying so in its own name. The *cost to date* phrase ban is untouched.
*Test:* the list is asserted by identity at four entries, so a fifth leaving it fails; each remaining entry is shown to still fire over its own fixture; the phrase half is unchanged and still discriminating; the guard is not bypassed by a renamed browser-local copy of a forbidden field.

**AC-13 — every absent case is named, and none is blank.** Four states distinguished rather than collapsed, each with its own sentence: **a dry run**, which allocates a run number and writes no run history, so the reason is that nothing was recorded rather than that nothing was spent; **a history that could not be read** (404, a refusal, or a refused parse), carried through the existing `RequestState` vocabulary with its own retry; **a vendor that reported no price**, unpriced and never `$0.00`; and **a run whose number is not yet known**, where no read is attempted.
*Test:* all four render distinct non-empty prose; none renders a zero, a dash, a spinner or an empty region; the dry-run case is asserted **specifically**, being the first case anyone exercising this will meet; `RequestState` stays closed at five members; every state is distinguishable in text alone, without colour or motion.

**AC-14 — disclosures 2 and 3 retire only where their values are present, completeness is stated honestly, and the copy contract holds.** Both are rewritten and rendered conditionally on AC-5's pattern, and what replaces each is the **specific** absence from AC-13 rather than a general one. Where the read reports `incomplete`, the cost region says the run is still in flight and the figures are as of that read; the two existing loss disclosures remain separately visible and are not conflated with it. Every sentence added or rewritten is an export in `mission-control-text.ts`, imported by both renderer and tests, and none is approximated from any event's free text.
*Test:* for each disclosure the present and absent states are both asserted; deleting either sentence outright fails; a state where the value is absent and the sentence is also absent fails; an `incomplete` fixture renders the in-flight sentence and a complete one does not; a source clause asserts no sentence-shaped literal is rendered outside an import from that module, and that *ticker* appears nowhere under `apps/web/src`.

### A.5 The deferred half's own open question

**Elapsed uses the browser's clock or the daemon's.** Recommended: the browser's, against the manifest's `started_at`, with the rendering naming it — one clock reading, no round trip, and on a loopback daemon it is a machine's own clock against itself. The alternative, carrying the daemon's `now` on each response so the browser can compute an offset, buys accuracy this screen does not need and adds a field to a response `core` writes. **Not blocking** — AC-10 is satisfiable either way and carries the disclosure obligation that makes either honest. Refused outright: a second start time recorded by the host on `WireRun`, which would disagree with the manifest's `started_at` by the daemon's scheduling delay and give one run two durations, where `finalise` already computes `duration_ms` against the manifest's.

---

## Provenance

**Candidate-claude supplied the ticket's shape, and it earned it by measuring.** Its finding that the engine already emits the run number in prose at run start, before the dry guard; that `started_at` and a live per-vendor roll-up are on disk and already served by `GET /history/:id`; and that `RunStats` has no vendor split so a browser would have to accumulate over a head-evicting buffer — these are the three facts that turn three separate problems into one mechanism. All three were re-verified at this tip and hold. Its `contracts/`-is-unwritable finding, its refusal list with measurements, its count-register analysis and its split recommendation are carried substantially as written; AC-1 to AC-7, AC-12, AC-13 and AC-14 descend from its criteria.

**Candidate-codex supplied the rendering discipline, which claude's document lacked.** Elapsed advancing at least once per second, `MM:SS` / `H:MM:SS`, zero-padded, clamped at `00:00`, frozen on the terminal read and tested against a controlled clock is its work and is better than claude's fixed-until-refresh figure; it is AC-10. Its *"never branches on a known vendor name"*, its honesty-about-completeness clause, its *"each retained prohibition has a discriminating fixture"*, its accessibility clause and three of its risks — clock adjustment, double counting on replay, source-guard erosion — are carried into AC-11 to AC-14 and §7.

**Iteration 1 is this document's own predecessor, and two of its judgements are corrected.** It recommended a new `start` member on the event union and asked the gate to rule it against an alternative it named but did not measure, which made a decision entry a gate precondition and carried fifteen criteria. §0.1 is the measurement it never took — the header already reads `flow` and `ticketId` from the metadata request, and `mission-control-status.tsx`'s own comment records that `WireRun.runId` is there too and was passed over only because it is `null` while running. That removes the entry, which removes the first blocker, which shrinks the ticket, which removes the second. **One measurement dissolved both**, which is Q-0105's *"the second pass found something anyway"* and its stating-rather-than-asking remedy in one move. Its OQ-6 is also corrected in §0.7: the key-count contradiction it reported does not exist, the two figures describing an `Occurrence` and a manifest respectively.

**Where the candidates disagreed, this document picks rather than averages.**

- **Run-number transport.** Neither candidate's recommendation survives §0.1. Claude specified the union member without weighing the out-of-band shape; codex named a "non-event engine interface" among three options and measured none. The ruling is the callback, and the member is recorded as the refused alternative with its measurement.
- **Cost transport.** Codex's structured field on `done` is refused on §0.4: the browser would accumulate over a 500-event head-evicting buffer while `stdout` is one event per line, and its own draft conceded the figure would have to be labelled incomplete.
- **Elapsed source.** Codex's host-recorded start and end instants on `WireRun` are refused: they would be a **second** start time disagreeing with the manifest's by the daemon's scheduling delay, where `finalise` already computes `duration_ms` against the manifest's.
- **Elapsed rendering.** Claude's static figure is refused: it read the frozen contract's *"no timer performs [a repeat read]"* as forbidding timers outright, which it does not, and a frozen elapsed goes false the moment it renders.
- **The retention evidence.** Codex rested three clauses on the Q-0015 figures being absent from the repository. They are at `backlog/Q-0015-*/runs.log:176–184`, and that file itself records that the walk was `--dry` and the bound stays unmeasured. Its conclusion is right and its route was a failed search read as proven absence — Q-0074's class — so AC-7 states the datum correctly.
- **Size.** Codex's twenty-one criteria are past the ceiling that split Q-0091 and Q-0096, and several restate standing repository rules rather than specifying this change; they are folded into §5 and §8, where they bind without costing a criterion.

**Contributed by neither candidate and by neither iteration, and added here from the tree:** the header's existing metadata-driven identity and the comment recording that `runId` was already expected there (§0.1); `host.start` already passing an out-of-band callback in the same options object (§0.2); the three landed sentences that stay true and the two JSDocs that do not, which is what makes AC-3 a criterion rather than an afterthought (§0.3); and the correction to iteration 1's own manifest-key finding (§0.7).

**Verdict: ready.** Both blockers are ruled by measurement rather than deferred, the criteria are seven, no criterion names an unwritable surface, no decision entry is owed, and the deferred half is written out in full so it cannot expire.
