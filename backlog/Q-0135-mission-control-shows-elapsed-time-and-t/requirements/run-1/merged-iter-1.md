# Q-0135 — Mission control shows elapsed time and the per-vendor cost split

*Merged requirement, run 1, iteration 1. Every citation re-derived against tip `b94429e` on
2026-09-18, by this run, while this run was writing `.quorum/runs/Q-0135-1/manifest.json`.*

The ticket's own instruction is *"re-measure before writing anything"*. §0 is what that produced:
**five measurements that change the work**, four of them candidate-claude's and re-verified here,
one contributed by neither candidate. §4 is the criteria they produce — **ten**, against this
role's ceiling of fifteen.

---

## 0. What was re-measured

### 0.1 The appendix's central claim holds, and it holds more finely than it states

§A.1 says the roll-up is *"live and correct while the run runs"*. Confirmed.
`packages/core/src/run-history/writer.ts` assigns `manifest.rollup = rollup(manifest.steps)` at
exactly two sites — inside `terminal()` and inside `finalise()` — and `replaceManifest` writes a
same-directory temporary and renames over the target. **So the roll-up is rewritten on every
occurrence that terminates**, not only at run end.

Two consequences the appendix does not draw, both from `rollup()`'s and `VendorRollup`'s own
JSDoc, and both of which become criteria:

* **A vendor with no finished billed step has no row at all** — `step_count` is documented *"Never
  zero — a row without one is absent"*. A two-vendor run renders one row and then two. That is not
  the same claim as *unpriced*, and AC-16 names it.
* **Rows come back in first-appearance order** and **status is never consulted**: *"a failed
  occurrence that was billed is in the roll-up … failure is when the number matters most."* So the
  screen preserves the order it is given and filters nothing.

### 0.2 The dry-run hazard, which is this document's largest finding

Appendix A's AC-13 names *"a dry run"* as one of four absent states to be distinguished. **It cannot
be distinguished from what is on the wire today, and the failure is a wrong answer rather than a
missing one.** Four measurements:

1. **A dry walk is allocated a run number and the number is reported to the caller.**
   `engine.ts` calls `nextRunId(ticket)` unconditionally, and invokes `reportRunNumber` **outside**
   the `!dry` guard — its own comment saying *"a dry walk is allocated a number like any other run
   and a caller watching one is owed the same identity."*
2. **A dry walk writes no run history.** `initialiseRunHistory` is inside `if (!dry)`.
3. **`nextRunId` reserves nothing.** It is `max(history entries, the `run=N` matches in `runs.log`)
   + 1`, and under `dry` both sources are stubbed — `readOnlyBacklog` makes `write` and `log`
   no-ops. The engine's own comment says it: *"`nextRunId` reserves nothing."* **So the next real
   run of that ticket receives the identical number.** Guaranteed, not probabilistic.
4. **The daemon knows and forgets.** `host.ts:88` declares `readonly dry?: boolean` on the start
   request and `:455` passes `dry: request.dry ?? false` into `runFlow`. `RunRecord` retains no such
   field, `RunView` declares none, `wireRunOf` projects none, and `WireRun` is eight fields with no
   `dry`.

Composed: a browser watching a dry walk holds `ticketId` and a non-null `runId`, composes
`<TICKET>-<n>` and reads `GET /history/<TICKET>-<n>`. **Today that is a 404. Once a real run of that
ticket takes the same number, the id names a real directory** — and the screen renders that run's
`started_at`, elapsed and per-vendor cost as this walk's. A dry run takes no lock and is refused by
none, so the two can also overlap.

**It is reachable from the shipped UI.** `apps/web/src/ticket-page.tsx` carries a `data-dry`
checkbox, sends `startRun(request, { flow, ticket, dry }, clock)`, and `dry` is deliberately **not**
among Q-0130 AC-12's `FORBIDDEN` start fields, which are `['auto', 'base']` — verified. The wire
already speaks this word in one direction: `WIRE_START_FIELDS` is
`['flow', 'ticket', 'dry', 'auto', 'base']`.

This is *"A probe that could not answer is not a negative"* (2026-09-10) with the negative replaced
by a wrong answer, one boolean away from identity. **Both candidates reached this independently**,
which is the strongest evidence either produced. AC-8 carries it; AC-10 declines the read for a dry
walk; AC-16 names it.

### 0.3 `duration_ms` already exists, and the appendix asks for it to be recomputed

The appendix's AC-10 says the ended screen renders *"the fixed difference between `ended_at` and
`started_at`"*. `finalise` already wrote exactly that:
`manifest.duration_ms = Math.max(0, ended.getTime() - started.getTime())`, from **the same `Date`
that produced `started_at`** — its comment saying two clock readings *"would differ by a millisecond
and fail the semantic pass."*

Measured over every manifest in `.quorum/runs`: **169 manifests, 168 ended, and `duration_ms` agrees
with `ended_at − started_at` on 168 of 168.** The one that does not is this run, still running, and
it carries `null` for both — the invariant rather than an exception.

So the browser never subtracts two timestamps. **The appendix contains both halves of this argument
and does not join them**: its §A.5 refuses a host-recorded start time *because* `finalise` already
computes `duration_ms`, and its AC-10 then specifies recomputing it. AC-12 reads it.

### 0.4 The binding obstacle to an advancing display is a source guard, not the frozen contract

§A.2 rules, correctly, that `contracts/Q-0015/mission-control.contract.md` — *"Refresh is the only
repeat read; no timer performs one"* — bounds **reads**, so a display advancing from a value already
held engages it not at all. Carried.

**It is not what stops an implementer.** `apps/web/test/source.test.ts`'s clause *'nothing refetches
on a timer, and nothing persists a board in the browser'* bans the bare strings `setInterval(`,
`setTimeout(` and `requestIdleCallback(` in **every file under `apps/web/src`**, comments included,
with no exemption register. An elapsed display that advances once per second needs one of them.

**The guard is keyed on the mechanism where its own title and comment name the behaviour**: it
justifies itself entirely in terms of refetching — *"an interval would make the most expensive route
on the transport this app's hot path"*. Narrowing it from *no timer* to *no fetch reachable from a
timer callback* restores the subject it already claims. Seventh instance in this repository of a
guard keyed on a name rather than on the behaviour (Q-0051, Q-0067, Q-0073, Q-0107, Q-0108, Q-0115,
Q-0122). AC-11, and it is a **visible act** — Q-0079's round 2 is the case to remember, where a
repair for a comment bypass shipped a repository-wide silencer.

### 0.5 Four of the appendix's renderings trip one shipped assertion

`apps/web/src/mission-control-status.test.ts`:

```ts
expect(view.querySelector('[data-mission-control-header]')?.textContent).not.toMatch(/—|\$|0:00|n\/a/);
```

| Rendering | Source | Trips it |
| --- | --- | --- |
| `$78.675` | appendix AC-11's priced row | **yes** (`\$`) |
| `n/a` | appendix AC-11's unpriced row | **yes** |
| `00:00` | appendix AC-10's clamp | **yes** — `"00:00"` contains `0:00` |
| `1:00:00` | appendix AC-10's hour format | **yes** |
| `14:32` | appendix AC-10's sub-hour format | no |

The guard exists to prove the header fabricates nothing, and weakening it is the Q-0014 AC-5 failure
— a scan narrowed until every file carrying the defect sits outside it.

**It needs no weakening, because the screen is already sibling regions.** `MissionControlStatus`
composes `Header`, `ConnectionRegion`, `MetadataRegion`, `LossRegion` and a disclosures `<ul>`; the
assertion is scoped to `[data-mission-control-header]`, which is the identity line and carries
`data-run-identity` inside it. **The design brief's word *header* names the top area;
`data-mission-control-header` names one region within it, and the two are not the same thing.** A
sixth sibling region is the shape every other class of fact on this screen already takes. AC-14.

### 0.6 The corpus would validate the wrong implementation

Over all 169 manifests and 335 roll-up rows:

| Measure | Value |
| --- | --- |
| Roll-up rows with `cost_usd: null` | **166 of 335** |
| `claude` rows priced / unpriced | **169 / 0** |
| `codex` rows priced / unpriced | **0 / 166** |
| Cheapest priced roll-up row | **$1.6442685** |

**Zero exceptions in either direction.** A developer reading this corpus would conclude
`codex ⇒ unpriced` and hard-code it, and every test written against this repository's own data would
pass. A third vendor — Gemini is on the roadmap — breaks it silently. AC-13 therefore requires a
fixture whose vendors are names this product has never seen.

Two distinctions from `rollup()`'s own JSDoc that a careless guard would get wrong:

* **`cost_usd: 0` is legitimately different from `cost_usd: null`** — *"a measure nobody reported
  stays `null` rather than accumulating from `0` … while a genuinely reported `0` stays `0`."* A
  criterion banning `$0.000` outright would be wrong; the rule is about `null`.
* **`vendorTokenTotal` can itself be `null`**, summing `input_tokens + output_tokens` only and
  returning `null` when both are absent. So an unpriced vendor with no token measure is a further
  render state and reads `n/a`, never `0`.

### 0.7 Two staleness facts, and the appendix states only the weaker one

* **Cost is as of the last read** — §A.2's ruling, carried.
* **Cost is also as of the last *completed* occurrence** (§0.1). Candidate-claude measured
  occurrence duration at a **median of 4:12, p90 20:35 and a maximum of 1:27:28**. So a
  freshly-pressed refresh can return a figure twenty minutes behind at p90, and a screen saying only
  *"as of that read"* would make a claim it cannot support. AC-17.

### 0.8 Money precision is already decided, on this exact field

`packages/cli/src/runs.ts:86` renders `rollup[].cost_usd` — **the identical field this screen
renders** — at three decimals, carrying its own authority line: *"at two decimals a real `$0.004`
step renders `$0.00` and becomes indistinguishable from a vendor that reported zero … See Q-0034."*
`apps/web` renders `billedCostUsd` at two decimals at two sites, which is a **different field** (a
ticket-level sum) and keeps its own convention.

The sub-cent hazard is **not reachable here** — the cheapest priced roll-up row across 169 runs is
$1.64 (§0.6) — so three decimals is consistency with the one existing renderer of this field rather
than a defect fix, and it is recorded that way so it is not later presented as one. `formatMoney`
and `formatTokens` are module-private to `packages/cli` and the browser cannot import them, so a
second renderer exists by construction; what binds is the precision, not the code.

### 0.9 The browser has both halves of the id, the endpoint, and no schema

* **Both halves.** `WireRun.ticketId` and `WireRun.runId` are already on the metadata read the header
  performs, and `mission-control-status.test.ts`'s Q-0131 AC-4 clause asserts the number rendered
  from it.
* **The endpoint.** `DAEMON_ENDPOINTS.history` is `'/history'` and is read by nothing under `src`
  today. `'/history'` is already a **registered shell route**, so a helper composing
  `${DAEMON_ENDPOINTS.history}/…` writes no new route literal and **owes no `EXCEPTION_REASONS` row**
  in `test/routes.test.ts` — verified against that register's fifteen rows.
* **No schema.** `/history` and `/history/:id` are the only two routes on this transport with no
  declared shape. `readRun`'s own JSDoc calls the parsed manifest *"a cast, never a check"*, and the
  route validates only `rollup` and `steps`. **AC-9 is the first validation of `started_at`,
  `ended_at`, `duration_ms` and `status` anywhere in the chain**, and it closes the last gap in a set
  rather than adding a one-off.

`GET /history/:id` answers `{ id, manifest, incomplete, tokensByVendor, steps }`, with **404** for a
token naming no run and **422** for a malformed manifest — each carrying the daemon's own condition,
which the existing five-member `RequestState` vocabulary already renders. No new state is needed.

### 0.10 Contributed by neither candidate: the snapshot cannot decide whether elapsed still advances

Both candidates gate advancement on the manifest: codex on `manifest.status === 'running'`, claude
on *"while the run is running"*. **The manifest read is a snapshot.** A run that ends after that read
leaves the browser holding `status: 'running'` and `ended_at: null` — and both candidates' elapsed
would go on advancing indefinitely, past an end that has already happened, on the screen whose whole
discipline is saying only what it has. The socket knows: the terminal event has arrived and
`WireRun.state` is `ended`.

So the authority is split and the criterion must say so: **advance while the browser has no reason to
believe the run has ended; stop the moment either the connection reports it ended or a read supplies
`ended_at`.** And where the run has ended but no read has supplied `duration_ms`, say that rather
than freezing a browser-computed figure naming an instant nobody measured — no event carries a
timestamp and none may gain one. AC-12 and AC-16.

### 0.11 One shipped sentence already attributes this ticket's work elsewhere

`apps/web/src/routes.ts:209`: *"The header's run number, elapsed time and per-vendor cost are
Q-0131's; starting or stopping a run is Q-0130's."* Q-0131 shipped the run number alone and split
the other two here. It is a register entry promising work under the wrong id, matched by no test.
AC-17. Its two neighbours — `docs/04-architecture.md`'s two sites — already name Q-0135 correctly and
need nothing.

### 0.12 Payload, measured because Q-0127 set that precedent

`GET /history/:id` carries the `steps` array twice — once inside `manifest` and again with `seq`
added. Candidate-claude measured the whole response at a **median of 4,950 B and a maximum of
59,933 B**, against **median 603 B and maximum 614 B** for the subset this screen reads: a 98×
oversupply at the maximum. **No cap is specified and none is needed** — nothing approaches 200 KB,
the route is shipped and already answers this, and a projection or second route is work with no
measured subject. Recorded so its absence does not read as an oversight.

### 0.13 One rule for every measurement above

The roll-up row count moved from **333 to 335** between candidate-claude's reading and this one, and
the null-cost count from 165 to 166 — because **this run's own occurrences landed in between**. That
is §0.1's liveness demonstrated rather than asserted, and it is why **no criterion below may depend
on a corpus count**: every figure here is evidence for a rule, and the rule is what is tested.

---

## 1. Problem

Mission control shows a run's identity, its connection, its trace and its timeline. It shows neither
of the two figures a maintainer watching a run actually wants: **how long it has been going, and what
it is costing, per vendor.** The screen says so rather than faking them — two of
`MISSION_CONTROL_DISCLOSURES`' five entries carry exactly those admissions — which is right, and it
is the state `docs/06-development-plan.md` records as this ticket's.

Everything needed is on disk and already served (§0.1, §0.9). What is missing is a read, a schema and
a rendering — plus **one boolean the daemon already knows and does not carry** (§0.2), without which
the screen reads another run's figures for a dry walk.

The two figures behave differently, and the difference is the design: **elapsed advances from a value
the browser already holds and cost does not**, because a display performs no read and the frozen
contract bounds reads. Getting it wrong in either direction produces a screen that either freezes a
number that is false the moment it renders, or polls the most expensive route on the transport.

## 2. User stories

**`maintainer`** — *I start a `chore` run and leave it. When I come back I want to know, without
reading a log, how long it has been running and what it has cost on each vendor — and I want to be
told when a figure is behind, rather than shown a number that looks current.*

**`maintainer`** — *I tick "dry run" to see what a flow would do. I want the screen to tell me a walk
that writes no run history has none — not to show me elapsed time and cost belonging to a different
run.*

**`adopter`** — *My first run is on a token-only vendor. I want to see that it reported no price, not
`$0.000`, because those are different claims and only one of them is true.*

**`contributor`** — *I add a third vendor's adapter. I want its row to appear in mission control
because it is in the roll-up, not because somebody added its name to a list in the browser.*

## 3. Surfaces

* **`apps/web`** — the mission control screen: one new sibling region, one reader, one path helper,
  the copy, and one narrowed source clause.
* **`packages/shared`** — `wire.ts`: the history-detail schema, and one field on `WireRun`.
* **`packages/server`** — `host.ts` retains `dry` on the record and declares it on `RunView`;
  `wire.ts` projects it. Nothing else.
* **`docs/`** — `04-architecture.md`'s `apps/web` section. Inside the chore role's roots.
* **Not `contracts/`** — verified outside `developer-generalist`'s `paths:`. See GO-3.
* **No new route.** The daemon's route register and the architecture document's route list are
  untouched.

## 4. Acceptance criteria

*Ten, numbered continuously from AC-8 per the ticket's instruction, against a ceiling of fifteen.*

---

**AC-8 — the wire says whether a run is a dry walk.** `RunRecord` retains the start request's
effective `dry` (`false` where omitted); `RunView` declares it; `wireRunOf` projects it; `WireRun`
and `wireRunSchema` gain `readonly dry: boolean`, **required rather than optional and never
inferred**. It narrows no `RunView` field, so Q-0121 GO-3's naming rule permits the name, and
`WIRE_START_FIELDS` already carries `'dry'` — this makes the wire symmetric in a word it already
speaks in one direction.
*Test:* a run started `{ dry: true }` reports `dry: true` on `GET /runs/:handle` **and** in
`GET /runs`; one started without the field reports `false` and never `undefined`; the schema refuses
a row omitting it; a projection dropping the field fails by name. **Not eligible for trimming** —
AC-10's third gate and AC-16's dry case rest on it, and §0.2's hazard is closed by nothing else.

**AC-9 — one shared schema for the history detail read.** `packages/shared/src/wire.ts` gains a
schema and inferred type over the subset this screen reads: `manifest.started_at` (non-empty
string), `manifest.ended_at` (string or `null`), `manifest.duration_ms` (non-negative number or
`null`), `manifest.status` (string, **not an enum** — refusing an unknown status would refuse a
document this product wrote), `manifest.rollup[]` as `{ vendor: string, cost_usd: number | null,
unpriced_steps: non-negative integer, step_count: non-negative integer }`, top-level `incomplete`
(boolean) and top-level `tokensByVendor` (record of exact vendor label to non-negative integer or
`null`). **Loose at the response, manifest and row levels** — *"Unknown keys are refused where Quorum
owns the key set, and preserved where it does not"* (2026-08-25), and `readRun` calls the parsed
manifest *"a cast, never a check"*. `apps/web` declares no wire shape of its own (Q-0127 AC-7).
*Test:* accepts a response built from a real run directory and one carrying an unknown key at each of
the three levels; **refuses a `rollup` that is not an array, and one whose elements are not objects
with a string `vendor`** — the guard `read.ts` needed two review rounds to get right, met here rather
than rediscovered; refuses a negative count and a non-null non-number `cost_usd`.

**AC-10 — the read is composed from what the browser holds, is gated three ways, and never fires on
a timer.** The screen composes `<ticketId>-<runId>` from the loaded `WireRun` and reads
`GET /history/<encoded id>` through the existing `requestJson` and AC-9's schema, adding one path
helper beside `ticketDetailPath` and `runDetailPath`. **One read once the required metadata first
becomes available, and one per explicit *Check again*** — which performs one metadata read and, where
the refreshed metadata supplies both components, one history read. **No read at all** where
`ticketId` is null, where `runId` is null, or where `dry` is true.
*Test:* the request counts are asserted for first load and for refresh; the id is composed from
`ticketId` and `runId` and **never from the handle**; each of the three gates is asserted separately
to issue **zero** requests; **the dry gate is proven against a fixture in which a manifest exists at
the composed id**, which is §0.2 staged rather than described — a fixture where the id resolves to
nothing passes whether or not the gate exists.

**AC-11 — the timer guard is narrowed to the behaviour it already claims, deliberately and
visibly.** `apps/web/test/source.test.ts`'s clause becomes *no fetch is reachable from a timer
callback* rather than *no timer exists*, restoring the subject its own title and comment name
(§0.4). The narrowing is recorded in place with its reason **and in the guard's own failure
message**, which is the exit condition `COERCES_TO_NUMBER`'s message already prescribes for exactly
this situation. **No file-level exemption, no comment token and no register of permitted callers**:
the discriminator is what the callback does.
*Test:* a fixture scheduling a fetch inside a timer fails, naming the file; a fixture scheduling a
render-only tick passes; the two are shown to differ by the fetch alone; and **the pre-narrowing
clause is demonstrated to fail over the shipped tick**, so the narrowing is proven necessary rather
than asserted. **Not eligible for trimming** — a guard narrowed without a discriminating fixture is
Q-0079 round 2 repeated.

**AC-12 — elapsed advances while the run may still be running, freezes on the engine's own figure,
formats, clamps and cleans up.** While the browser has no reason to believe the run has ended,
elapsed is the injected `Clock`'s reading minus `manifest.started_at`, advancing **at least once per
second**, and the rendering names the browser as the clock that produced it. **Advancement stops the
moment either the connection reports the run ended or a read supplies `ended_at`, whichever comes
first** (§0.10). Once a read supplies it, the screen renders **`manifest.duration_ms`** and does not
subtract two timestamps — `finalise` computed that from one clock reading (§0.3), and a second
computation is the third-site objection §A.3 raises for cost. Under one hour `MM:SS`; at one hour or
more `H:MM:SS`, **hours unbounded** — no day rollover and no clamp. Minutes and seconds zero-padded.
A negative difference renders `00:00`. No elapsed timer survives the terminal transition or unmount.
*Test:* against a controlled clock, `00:00`, `14:32`, `1:00:00` and a multi-day figure each render
exactly, so the verdict is a property of the commit (2026-08-30); a running value is observed to
advance and a terminal one to stay fixed, each failing if the other's behaviour is substituted; **a
terminal event arriving with no new read stops advancement**, which is the clause the snapshot alone
cannot satisfy; **an ended fixture whose `duration_ms` disagrees with `ended_at − started_at` renders
`duration_ms`**, which is the one assertion distinguishing this from the appendix's design; a
`started_at` in the future renders `00:00`; timer cleanup is asserted on both terminal transition and
unmount; a source clause asserts no file under `apps/web/src` reaches `Date.now()` or an
argument-less `new Date()` outside `isoClock`.

**AC-13 — one entry per vendor, never summed, never keyed on a vendor's name.** One entry per
`rollup` row, **in the response's own order**, which is `rollup()`'s first-appearance order and is
preserved rather than sorted. Grouping is on the exact `vendor` string and **no code branches on a
known vendor name**. A row renders: the label; `cost_usd` where it is a number — **to three decimals,
matching `packages/cli/src/runs.ts:86` on this identical field and for its recorded Q-0034 reason
(§0.8)** — **including a genuinely reported `0`**; and where `cost_usd` is `null`, that vendor's
`tokensByVendor` total with the fact that it is **unpriced and not free**, or `n/a` where the total
is itself `null`. `unpriced_steps` is disclosed where it is non-zero, so a partly-priced row says how
much of itself it cannot see. **No total across vendors is rendered anywhere**; the screen reads
neither `terminal.cost` nor `terminal.tokens`; and it filters nothing on status, a billed failure
being in the roll-up by design (§0.1).
*Test:* a two-vendor fixture — one priced, one `cost_usd: null` — renders two entries and no third,
in the response's order, with the labels verbatim; an assertion fails if any rendered figure equals
the sum of two rows' `cost_usd`; a source clause forbids `terminal.cost` and `terminal.tokens`;
**a fixture whose vendors are names this product has never shipped renders both correctly**, which is
what catches the hard-coding this repository's own corpus would validate (§0.6); a `cost_usd: null`
row renders no money figure at all **and** a `cost_usd: 0` row renders a price, the two asserted
separately. **Not eligible for trimming** — it is the one place a blended figure could reach a
reader, and `terminal.cost` is a typed number already in the browser's hands, which is what makes the
wrong answer tempting.

**AC-14 — the measured values render in their own region, and the header's guard keeps its
subject.** Elapsed and the cost entries render in a new sibling region of `MissionControlStatus`,
carrying its own `data-` attribute beside `data-mission-control-header`,
`data-mission-control-disclosures` and the loss region.
`mission-control-status.test.ts`'s assertion that `[data-mission-control-header]` renders no `—`,
`$`, `0:00` or `n/a` is **left exactly as it is and continues to pass** (§0.5).
*Test:* the header assertion is unchanged and still green, and is shown still to have a subject by
rendering a `$` into the header in a fixture and watching it fail; the new region is found by its own
selector; **a fixture placing a cost entry inside the header region fails the shipped assertion**,
which is what proves the separation is load-bearing rather than cosmetic.

**AC-15 — the count register moves by exactly one row, deliberately.** `tokensByVendor` leaves
`apps/web/test/source.test.ts`'s `COUNT_FIELDS` with the reason recorded in place: it is the one
shape in which a **per-vendor, already-reduced** count reaches this app, computed by
`vendorTokenTotal` over one row inside `packages/server`, which `apps/web/src` could not compute for
itself. `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` **stay
forbidden**, being the four from which a browser could compose a figure of its own. `cost_usd` and
`unpriced_steps` are on no list, the guard being about counts and saying so in its own name. The
*cost to date* phrase ban is untouched.
*Test:* the list is asserted **by identity at four entries**, so a fifth leaving it fails; each
remaining entry is shown to fire independently over its own fixture; the existing discriminator — a
local total assembled from two forbidden fields — still fires; the phrase half is unchanged and still
discriminating. **The instrument is bounded here deliberately**: this is a substring guard over
source text, so a criterion may require that it still catches a local total built from a forbidden
field and may **not** require that it catch a count renamed on the far side of the wire — *a
criterion's `Test:` clause bounds the instrument* (Q-0067 E-1, Q-0131 E-6), and this cut has paid for
that six times.

**AC-16 — every absent case is named, and none is blank.** Distinguished in text alone, each with its
own sentence: **a dry walk**, where no read is attempted and the reason is that a walk writing no run
history recorded none rather than that nothing was spent; **a run whose number is not yet known**,
where no read is attempted either, and for a different reason; **a history that could not be read**,
carried through the existing five-member `RequestState` vocabulary with its existing retry, rendering
the daemon's own condition so a 404 and a 422 are not one sentence; **a vendor that reported no
price**, unpriced and never a zero; **a vendor in the run but absent from the roll-up**, having
finished no billed step (§0.1) — which is not the same claim as unpriced; and **a run that has ended
with no duration read**, per §0.10.
*Test:* every case renders distinct non-empty prose and no two share a sentence; none renders a zero,
a dash, a spinner or an empty region, per `04-architecture.md`'s placeholder rule; **the dry case is
asserted specifically**, being both the first case anyone exercising this will meet and the only
demonstration mission control has ever been given; `RequestState` stays closed at five members; every
state is distinguishable without colour or motion.

**AC-17 — the disclosures retire conditionally, completeness is stated honestly, the copy contract
holds, and the stale register sentence is corrected.** `MISSION_CONTROL_DISCLOSURES`' elapsed and
structured-cost entries are rewritten and **rendered conditionally on the idiom the file already
uses for its first entry, never deleted** — the array's length is asserted at five by Q-0131 AC-5 and
a deletion breaks it. The elapsed disclosure stands until a valid read supplies `started_at`; the
cost disclosure until a valid read supplies the roll-up, **including an empty one**; and what
replaces each is the **specific** absence from AC-16 rather than a general one. Where the read
reports `incomplete`, the cost region says the run is still in flight **and that the figures omit
whatever the current step has not yet been billed for** — measured at a p90 of 20:35 behind and a
maximum of 1:27:28 (§0.7), so *"as of that read"* alone would be a claim the figure cannot support.
The two existing loss disclosures stay separately visible and are not conflated with it. Every
sentence added or rewritten is an export in `mission-control-text.ts`, imported by both renderer and
tests, and **no value is parsed out of any event's free text**. And `apps/web/src/routes.ts:209` is
corrected, which attributes this ticket's two values to Q-0131 (§0.11).
*Test:* both disclosures are asserted present and absent; deleting either sentence outright fails;
a state where the value is absent **and** the sentence is also absent fails; an `incomplete` fixture
renders the in-flight sentence and a complete one does not; the completeness sentence and the two
loss disclosures are asserted simultaneously visible; the register sentence names this ticket; a
source clause asserts no sentence-shaped literal is rendered outside an import from the copy module,
and that *ticker* appears nowhere under `apps/web/src`.

---

## 5. Non-goals

1. **No new daemon route.** `GET /history/:id` is shipped and answers this; the route register and
   the architecture document's route list are untouched.
2. **No polling of any kind.** AC-11 narrows a guard about fetching; it does not licence one.
3. **No browser-side accumulation of cost or tokens from the event stream.** §A.3's measurement
   stands: a 500-event head-evicting buffer under-reports silently, exactly when the screen is
   disclosing a discard, and the daemon replays its buffer to every subscription with no sequence
   number to deduplicate on.
4. **No blended total, anywhere** — not across vendors, not across runs, not in a tooltip.
5. **No price estimation for a vendor that reports no price.**
6. **No change to the event union**, no timestamp on any event, and no `start` member. Q-0131 ruled
   that and the ruling is not reopened.
7. **No second start time recorded by the host.** §A.5's refusal is carried: it would disagree with
   the manifest's by the daemon's scheduling delay and give one run two durations.
8. **No cap, projection or second endpoint for the history payload** (§0.12).
9. **No change to the run-manifest format, the server's history payload, the adapter contract, the
   flow format, gate behaviour or persisted backlog state.**
10. **No change to `billedCostUsd`'s two-decimal rendering** on the board or the ticket page —
    different field (§0.8).
11. **No run-history screen** (Q-0018), and no change to the next-step or tool/reasoning
    disclosures.
12. **No decision entry** (§7).

## 6. Open questions — ruled, not deferred

**OQ-1 — how a dry walk is distinguished. Ruled: carry `dry` on the wire (AC-8).** The alternative —
one sentence covering both *"a dry walk records none"* and *"this history could not be read"* — is
**insufficient rather than merely weaker**: it makes the 404 honest and leaves untouched the case
where the id resolves to a **different run's** manifest (§0.2), which is a wrong answer. Inferring
dryness from a 404 is refused on the ground decision 097 refused inference where identity is
available. **Both candidates reached this independently.** If the gate refuses it, AC-8, AC-10's
third gate and AC-16's dry case all change and the ticket re-cuts at that gate — stated so the
consequence is visible rather than absorbed.

**OQ-2 — money precision. Ruled: three decimals**, matching the only existing renderer of this exact
field and its recorded Q-0034 reason. Four decimals, which candidate-codex specifies, would be a
third convention in this repository for one kind of value. The sub-cent `$0.00` hazard is **not
reachable** for a roll-up row (§0.6, §0.8), so this is consistency and not a defect fix; rounding is
required regardless, floating-point sums of per-occurrence costs producing long decimals. The design
brief's `$3.84` is an illustration of the row's shape, not a precision specification — the
divergence is recorded here rather than rediscovered, on Q-0017's precedent.

**OQ-3 — the browser's clock or the daemon's. Ruled: the browser's**, against
`manifest.started_at`, with the rendering naming it (AC-12). One clock reading, no round trip, and on
a loopback daemon it is a machine's own clock against itself. Carrying the daemon's `now` on each
response buys accuracy this screen does not need and adds a field to a response `core` writes.
§A.5's recommendation, carried unchanged, and both candidates agree.

**OQ-4 — whether elapsed should advance at all. Ruled: yes, and cost should not.** §A.2's reading of
the frozen contract is correct: the clause bounds **reads**, and a display advancing from a value
already held performs none. A frozen elapsed goes false the moment it renders. The binding obstacle
was never that clause but the source guard, which AC-11 narrows (§0.4).

**OQ-5 — what decides that elapsed stops. Ruled: whichever of the two authorities speaks first**
(§0.10) — the connection's terminal event or a read supplying `ended_at` — and the frozen figure is
only ever `duration_ms`. Neither candidate posed this; both would have advanced past an end that had
already happened.

**None of the five blocks solutioning.**

## 7. No decision entry is owed, and the reason is recorded rather than assumed

Applied by this repository's own test — *does any landed sentence go false?* — at four sites:

* **The event union is untouched.** `docs/GLOSSARY.md`'s **Event** term, `events.ts`'s header and
  `host.ts`'s `runId` JSDoc each say only the **terminal event** carries run identity. Nothing here
  is an event; all three stay true verbatim.
* **AC-8's field.** Adding to `WireRun` is precedented — Q-0016 added `gates` and `refusal` to this
  exact shape with no entry — Q-0121 GO-3's naming rule permits `dry` because it narrows no
  `RunView` field, and `WIRE_START_FIELDS` already contains `'dry'`. *"A dry run changes nothing the
  caller passed it"* (2026-09-11) is about what a walk writes, and a read row is not a write.
* **AC-9's schema.** A further reader on a module whose header already says nothing there polls,
  keeps a copy or persists — closing the last routes on this transport with no declared shape.
* **AC-11's narrowing.** It changes no product behaviour, contradicts no landed entry, and the
  guard's own idiom already prescribes recording a deliberate breadth where it fires. On Q-0108's
  precedent the ruling belongs in the guard's authority comment, which is where AC-11 puts it.

## 8. Gate obligations

**GO-1 — rule AC-8 before the run starts.** It is the one criterion whose refusal re-cuts the ticket
(OQ-1). This repository has priced a missing gate ruling at three wasted rounds (Q-0062) and a
round-1 `blocked` (Q-0126, Q-0129). **Verify the ruling is present in the implement step's own
`prompt.txt` by grep rather than assuming it** — the check Q-0097 lost two errata by not making.

**GO-2 — rule AC-11's narrowing at the gate too.** A guard narrowing is a visible act, and ruling it
here means no implement round spends itself arguing about whether it is permitted.

**GO-3 — the contract note is written by hand at the gate.** `contracts/` is **not** among
`developer-generalist`'s roots — verified: `[package.json, pnpm-workspace.yaml, turbo.json,
tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, harness, docs, README.md,
eslint.config.js, vitest.shared.js]` — so no criterion above names it. Q-0129's round 1 returned
`blocked` on exactly that surface and Q-0131 handled it this way. What is owed:
`contracts/Q-0015/mission-control.contract.md`'s absent-capability count, which Q-0131's appended
note took from five to four and this takes to two, and the retirement of the elapsed and cost
disclosures. **Record it as a removed premise, not a reversal** — those clauses described the only
sources that existed when they were written.

**GO-4 — predict the truncation and perform the hand pass either way.** Q-0131's three reviews were
the first in this stretch **not** truncated; this change is larger — three packages plus a guard
narrowing — so truncation is likelier. Whatever `materialiseDiff` names as omitted is reviewed by
hand, cross-vendor, and `runs.log` records the ratio and the file list **including when nothing was
cut**, which is the half a prediction cannot carry.

**GO-5 — discharge by running the product and transcribing what it rendered, not by asserting it.**
Q-0016's equivalent was reported discharged when its by-hand half had not been performed, and
Q-0015's gate found that; Q-0134's found a shipped defect three cross-vendor reviews had approved.
Required in `runs.log`, in this order: a real daemon from `quorum open`; a run started **through the
daemon**, a `quorum run` being a process the host can never see (Q-0121); mission control open in a
browser **while it is running**, showing an advancing elapsed figure, at least one vendor entry and
the in-flight sentence; the same screen after the run ends, showing the frozen figure and both
vendors; and **a dry walk started from the ticket page's own checkbox, showing the dry sentence and
issuing no history request** — §0.2's hazard demonstrated closed rather than argued.

## 9. Risks

**R-1 — four shipped assertions are tripwires for this change and three are not obvious.**
(a) `mission-control-status.test.ts` forbids `$`, `n/a`, `0:00` and `—` in the header region —
resolved by AC-14, and the reason AC-14 exists. (b) `MESSAGE_PARSE_NEEDLES` contains the assembled
literal `cost=`, scanned over every file under `src` **including comments**, so a JSDoc explaining
that this screen does not parse `cost=` out of a message would fail the guard it is explaining.
(c) `COERCES_TO_NUMBER` bans `Number(`, `parseInt(` and `parseFloat(` outright — zero-padding and
money formatting must work on typed numbers through `String(…)` and `toFixed(…)`, which is how
Q-0134's diff view already passes it. (d) `MISSION_CONTROL_DISCLOSURES` is asserted
`toHaveLength(5)`; AC-17's conditional retirement is what keeps that green.

**R-2 — `Clock` is `() => string`, not `() => number`.** Widening it touches five screens. Converting
an ISO instant to milliseconds must avoid the three banned coercions; `new Date(iso).getTime()` is
not among them, which is why AC-12's source clause is aimed at an **argument-less** `new Date()`
outside `isoClock` rather than at `new Date(` as a string — a needle written the looser way would
match `isoClock` itself and the conversion this ticket needs.

**R-3 — the review loop's bound is two.** `chore.yaml`'s `review` carries `max_iterations: 2`, so
three implement rounds reach the exhaustion gate. Ten criteria across three packages plus a guard
narrowing is a realistic three rounds. **The seam if it exhausts is stated in advance: AC-8, AC-10's
third gate and AC-16's dry case are one coherent half and the rest is the rendering** — split there
at that gate by erratum, rather than granting a fourth round.

**R-4 — this repository's own corpus would validate the wrong implementation.** Every `claude` row is
priced and every `codex` row unpriced, 169 and 166 with no exceptions (§0.6). A vendor-name branch, a
sorted roll-up, or a test that only ever sees those two labels all pass against real data. AC-13's
unfamiliar-label fixture is the only thing that catches it.

**R-5 — the terminal figure has two plausible sources and the appendix picks the wrong one.** An
implementer following the appendix's AC-10 verbatim writes a subtraction that is correct on every
fixture and is a second computation of an engine-computed value (§0.3). AC-12's disagreeing-fixture
assertion is what catches it, and it is the one assertion here that looks pointless to someone who
has not read §0.3.

**R-6 — a dry walk and a real run of the same ticket share a number by construction**, so the fixture
proving AC-10's dry gate must **place a manifest at the composed id**. A fixture where the id
resolves to nothing passes whether or not the gate exists — the check-with-no-subject failure this
repository records most.

**R-7 — a stale cost read is read as current.** The completeness sentence and the fetched-at wording
must stay adjacent to the cost region; AC-17's in-flight clause is what makes the claim honest rather
than merely hedged (§0.7).

**R-8 — the `dry` field must move across every projection and fixture together.** A required boolean
on a strict schema turns every server fixture omitting it red. That is the intended shape — a default
would let a projection drop it silently — and AC-8 asserts both boolean values.

**R-9 — timer leak or accidental coupling.** An elapsed interval may survive the terminal transition
or be wired to the history read. AC-12's cleanup assertions and AC-11's no-fetch-from-a-timer clause
protect the two boundaries separately.

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No credential, key or auth path; the word *subscription* appears nowhere in this change. |
| **Worktree safety** | n/a. Nothing here writes to a repository: a read-only route, a browser rendering, and one boolean carried in the read direction. |
| **Gate behaviour** | Unchanged. No gate is added, answered or altered; `pendingGates` and the gate link are untouched. |
| **Human-gated by default** | Unchanged. AC-8 carries `dry` in the **read** direction only; the start body's field set is not widened and `auto` stays forbidden in the browser (Q-0130 AC-12, verified `FORBIDDEN = ['auto','base']`). |
| **Files are the database** | Honoured and relied on: every figure originates in `manifest.json`, which `core` writes and the daemon reads. The browser persists nothing and caches nothing. |
| **File format and schema** | `manifest.json` is frozen and untouched. Two additive changes, both in `packages/shared/src/wire.ts`: one field on `WireRun`, one new loose schema. |
| **Lint rules** | No flow file changes; `quorum lint` unaffected. `@typescript-eslint/no-deprecated` unaffected. |
| **Cross-vendor rule** | n/a to the change; the `chore` flow it runs under already satisfies it. |
| **Product-agnostic** | Honoured, and AC-13 strengthens it: the browser learns no vendor's name. |
| **Errors are explicit** | AC-9 is the first validation of four manifest fields anywhere in the chain; AC-16 renders the daemon's own condition rather than collapsing 404 and 422. |
| **Cold-clone impact** | None. No dependency, no install step, no first-thirty-minutes cost. |

---

## Provenance

**Candidate-claude supplied the shape of this document and earned it by measuring.** Its four
corrections to the inherited Appendix A were each re-verified here and all four hold, and each
becomes a criterion the appendix did not have: the dry-run wire gap and the run-number collision
behind it (§0.2 → AC-8, AC-10, AC-16, R-6); `duration_ms` already computed by `finalise` and agreeing
with the subtraction on 168 of 168 ended runs (§0.3 → AC-12); the blanket timer ban that its own
AC-10 would violate on the first line (§0.4 → AC-11); and the four specified renderings that trip a
shipped header assertion (§0.5 → AC-14). Its corpus correlation (§0.6), its second staleness fact
(§0.7), its precision measurement (§0.8), its payload measurement (§0.12), its stale register
sentence (§0.11), its four-tripwire risk and its `Clock`-returns-a-string risk are carried
substantially as written, as are its five gate obligations.

**Candidate-codex supplied rendering discipline claude's document lacked, and one clause neither the
appendix nor claude required.** Elapsed advancing at least once per second, `MM:SS` / `H:MM:SS`,
zero-padded, clamped and tested against a controlled clock is its work; **timer cleanup on terminal
transition and unmount** is its own contribution and is carried into AC-12 and R-9. Its *"never
branches on a known vendor name"*, its *"if both price and token total are absent the row still names
the vendor"*, its honesty-about-completeness clause, its *"each retained prohibition has a
discriminating fixture"*, its schema refusals (negative counts, non-null non-number `cost_usd`), its
*"including an empty roll-up"* distinction, its accessibility clause and six of its seven risks are
carried into AC-9, AC-11, AC-13 to AC-17 and §9.

**Where the candidates disagree, this document picks rather than averages.**

- **Money precision.** Codex's four decimals are refused: three is what the only existing renderer of
  this exact field uses, under a landed Q-0034 reason, and a third convention for one kind of value
  is drift (§0.8).
- **Criterion granularity.** Codex's AC-9 bundles the path helper, the read-count discipline, the
  `dry` projection across four sites and a source guard into one criterion, which is four
  independently testable things wearing one number. Split into AC-8, AC-10 and AC-11.
- **The header collision.** Codex never measures it; an implementer following its AC-11 renders a `$`
  into a region whose shipped assertion forbids one. Claude's AC-14 is taken.
- **The terminal figure.** Codex's `ended_at - started_at` is refused for claude's `duration_ms`
  (§0.3).
- **The contract note.** Codex owes nothing to `contracts/` and names no gate obligation; that file's
  absent-capability count goes stale silently. Claude's GO-3 is taken.
- **Size.** Codex's seven criteria are inside the ceiling and reach less; claude's ten are inside it
  and reach the whole change. Ten is taken, with the seam named in advance (R-3) rather than a split
  imposed on a ticket that does not need one.

**Contributed by neither candidate and added here from the tree:** the split-authority finding that
the manifest snapshot cannot decide whether elapsed still advances, so a run ending between reads
would advance a figure whose subject has stopped (§0.10 → AC-12, AC-16, OQ-5); that `rollup()`
returns rows in **first-appearance order** and **never consults status**, which makes AC-13's
ordering clause precise and forbids filtering a billed failure out; that `VendorRollup.step_count` is
documented *"Never zero — a row without one is absent"*, which is the missing-vendor state AC-16
names; that `vendorTokenTotal` returns `null` when both measures are absent, which is the render
state beneath *unpriced*; that `FORBIDDEN` is `['auto', 'base']`, so carrying `dry` in the read
direction widens no permission; that `/history` is already a registered shell route and
`DAEMON_ENDPOINTS.history` already exists, so **no `EXCEPTION_REASONS` row is owed** — verified
against that register's rows; that `MISSION_CONTROL_DISCLOSURES[0]` is **already** rendered
conditionally through a `.filter`, so AC-17's pattern exists in the file rather than being invented;
that `formatMoney` and `formatTokens` are module-private to `packages/cli`, so a second renderer
exists by construction and only the precision can be held together; and the bounding of AC-15's
instrument, so a reviewer may find the guard fails the job its `Test:` clause gives it and may not
raise the job — the rule this cut has paid for six times.

**One caution the measurements themselves produced.** The roll-up row count moved from 333 to 335
between candidate-claude's reading and this one, because this run's own occurrences landed in
between. That is the liveness §0.1 claims, demonstrated rather than asserted — and it is why **no
criterion here depends on a corpus count**: the figures are evidence for rules, and the rules are
what is tested.

**Verdict: ready.** Ten criteria against a ceiling of fifteen. All five open questions are ruled by
measurement rather than deferred, no criterion names a surface the chore flow cannot write, the
`contracts/` note is a gate obligation on Q-0131 E-2's precedent, and no decision entry is owed at
any of the four sites where one could have been.
