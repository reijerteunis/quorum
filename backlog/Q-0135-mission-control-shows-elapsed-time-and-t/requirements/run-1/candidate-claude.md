# Q-0135 — Mission control shows elapsed time and the per-vendor cost split

*Requirements, run 1, iteration 1. Measured against tip `b94429e` on 2026-09-18, with a live
requirements run — this one — writing `.quorum/runs/Q-0135-1/manifest.json` as it was written.*

The ticket's own instruction is *"re-measure before writing anything"*. Every citation in Appendix A
was re-derived. **Four of them moved, and one of the four is a correctness hazard rather than a
stale line number.** §0 is those measurements; §4 is the criteria they produce.

---

## 0. What was measured

### 0.1 The appendix's central claim holds, and the live fixture is this run

§A.1 says the roll-up is *"live and correct while the run runs"*. Confirmed, and confirmed at a
finer granularity than it states. `packages/core/src/run-history/writer.ts` recomputes
`manifest.rollup = rollup(manifest.steps)` at exactly **two** sites — `:594` inside `terminal()` and
`:621` inside `finalise()` — and `replaceManifest` (`:518–536`) writes a same-directory temporary,
`fsync`s it and renames over the target. So the roll-up is rewritten **on every occurrence that
terminates**, not only at run end.

Demonstrated on disk rather than read out of the source. `.quorum/runs/Q-0135-1/manifest.json`, this
document's own run, mid-flight:

```json
"started_at": "2026-09-18T00:08:55.676Z", "ended_at": null, "duration_ms": null, "status": "running",
"rollup": [ { "vendor": "codex", "step_count": 1, "unpriced_steps": 1,
              "input_tokens": 641456, "output_tokens": 6508,
              "cached_input_tokens": 557952, "cache_write_input_tokens": null, "cost_usd": null } ]
```

`pm-codex` has finished and is in the roll-up; `pm-claude` is still `running` with `usage: null` and
**has no row at all**. `run_id` is the literal `"Q-0135-1"`, which is AC-10's id composition confirmed
against real data rather than inferred.

**That last fact is a consequence §A.1 does not draw, and it changes an honesty obligation.** While a
run is running the roll-up is not merely *as of the last read* — it is **structurally incomplete: a
vendor that has not yet finished a billed step is absent entirely, not zero.** A two-vendor run
renders one row and then two. See §0.6 and AC-17.

### 0.2 The dry-run hazard, which is this document's largest finding

Appendix A's AC-13 names *"a dry run"* as one of four absent cases to be *"distinguished rather than
collapsed"*. **It cannot be distinguished with what is on the wire, and the consequence is worse than
an undistinguished state.**

Four measurements, each verified:

1. **A dry walk is allocated a run number and the number is reported to the caller.**
   `engine.ts:228` calls `nextRunId(ticket)` unconditionally; `engine.ts:357–363` invokes
   `reportRunNumber` **outside** the `!dry` guard, its own comment saying *"a dry walk is allocated a
   number like any other run and a caller watching one is owed the same identity."*
2. **A dry walk writes no run history.** `initialiseRunHistory` is inside `if (!dry)`
   (`engine.ts:366–374`), so `.quorum/runs/<TICKET>-<n>/` is never created.
3. **`nextRunId` reserves nothing.** It is `max(history entries, the run=N matches in runs.log) + 1`
   (`writer.ts:199–212`), and under `dry` both sources are stubbed — `readOnlyBacklog`
   (`engine.ts:42–48`) makes `write` and `log` no-ops. **So the next run of that ticket receives the
   identical number.** This is guaranteed, not probabilistic.
4. **The daemon knows a run is dry and forgets it.** `packages/server/src/host.ts:88` declares
   `readonly dry?: boolean` on the start request and `:455` passes `dry: request.dry ?? false` into
   `runFlow`. `RunRecord` (`host.ts:244–…`) retains no such field, `wireRunOf`
   (`packages/server/src/wire.ts:147–158`) projects none, and `WireRun`
   (`packages/shared/src/wire.ts:149–165`) is eight fields with no `dry`.

Composing those: a browser watching a dry walk holds `ticketId` and a non-null `runId`, composes
`<TICKET>-<n>`, and reads `GET /history/<TICKET>-<n>`. Today that is a 404. **After any real run of
that ticket starts — including one running concurrently, since `--dry` takes no lock and is refused
by none — the same id names a real directory, and the read returns that run's `started_at`, its
elapsed time and its per-vendor cost.** The screen would render another run's figures as this walk's.

**It is reachable from the shipped UI in three clicks.** `apps/web/src/ticket-page.tsx:346–353` is a
`data-dry` checkbox, `:614` sends `{ flow, ticket, dry }`, and `dry` is deliberately **not** among
Q-0130 AC-12's `FORBIDDEN` start fields (`source.test.ts:825`, which names `auto` and `base` only).
It is also not a hypothetical in this repository's own history: **the only demonstration mission
control has ever been given was a dry walk** — Q-0015's GO, recorded in that ticket's `runs.log` and
cited by `apps/web/src/run-connection.ts:31`.

This is *"A probe that could not answer is not a negative"* (2026-09-10) with the negative replaced
by a wrong answer, and the identity is one boolean away. **AC-8 carries `dry` on the wire and AC-10
declines the read for a dry walk.** The alternative — one sentence covering both cases — is
insufficient rather than merely weaker: it makes the 404 honest and leaves the wrong-manifest read
exactly where it is. §6 OQ-1 records the refusal with this reason so it is not revived.

### 0.3 `duration_ms` already exists, and the appendix asks for it to be recomputed

AC-10 of the appendix says that once the run has ended the screen renders *"the fixed difference
between `ended_at` and `started_at`"*. `finalise` already computes exactly that:
`manifest.duration_ms = Math.max(0, ended.getTime() - started.getTime())` (`writer.ts:619`), *"from
the same clock reading"*.

Measured across all **169** manifests, with **zero anomalies**:

* `status: 'running'` ⟺ `ended_at === null` ⟺ `duration_ms === null`. No ended run lacks either; no
  running run carries either.
* For every one of the **168** ended runs, `duration_ms` agrees with `ended_at − started_at` to
  within 1.5 s.

**So the browser never needs to subtract two timestamps.** Reading `duration_ms` costs nothing,
loses nothing, and keeps the terminal figure the engine's own measurement rather than a second
computation of it — which is §A.3's own objection to a browser-side cost accumulator, applied
consistently. The appendix contains both halves of this argument and does not join them: §A.5
refuses a host-recorded start time *because* *"`finalise` already computes `duration_ms`"*, and AC-10
then specifies recomputing it. **AC-12 corrects it.**

### 0.4 The timer ban is a hard collision the appendix does not mention

§A.2 rules, correctly, that `contracts/Q-0015/mission-control.contract.md:9` — *"Refresh is the only
repeat read; no timer performs one"* — bounds **reads**, so an advancing display engages it not at
all. That ruling is sound and is carried.

**It is not the binding constraint.** `apps/web/test/source.test.ts:888–899` bans the bare strings
`setInterval(`, `setTimeout(` and `requestIdleCallback(` **anywhere under `apps/web/src`, tests and
comments included**, with no exemption register. An elapsed display that advances once per second
needs one of them. The appendix never names this guard; its AC-9 gestures at the remedy — *"a source
clause asserts no fetch is reachable from a timer callback"* — without saying that the clause it
replaces is a blanket ban that its AC-10 violates on its first line.

**The guard is keyed on the mechanism where its own title names the behaviour**: the test is called
*'nothing refetches on a timer, and nothing persists a board in the browser'*, and its comment
justifies itself entirely in terms of refetching — *"an interval would make the most expensive route
on the transport this app's hot path"*. Narrowing it from *no timer* to *no fetch reachable from a
timer* restores its stated subject rather than weakening it, and it is the seventh instance in this
repository of a guard keyed on a name rather than on the behaviour it is about (Q-0051, Q-0067,
Q-0073, Q-0107, Q-0108, Q-0115, Q-0122). **AC-11.**

This is a deliberate narrowing of a shipped guard, which this repository treats as a visible act —
Q-0079's round 2 is the case to remember, where a repair for a comment bypass introduced a
repository-wide silencer. AC-11 therefore requires both halves shown red separately and forbids a
file-level or comment-level escape.

### 0.5 Four of the appendix's renderings trip one shipped assertion

`apps/web/src/mission-control-status.test.ts:97`:

```ts
expect(view.querySelector('[data-mission-control-header]')?.textContent).not.toMatch(/—|\$|0:00|n\/a/);
```

Executed against the appendix's own specified outputs:

| Rendering | Source | Trips the assertion |
| --- | --- | --- |
| `$78.675` | its AC-11's priced row | **yes** (`\$`) |
| `n/a` | its AC-11's unpriced row | **yes** |
| `00:00` | its AC-10's clamp | **yes** — `"00:00"` contains `0:00` |
| `1:00:00` | its AC-10's hour format | **yes** |
| `14:32` | its AC-10's sub-hour format | no |

Four of five. The guard exists to prove the header fabricates nothing, and weakening it is exactly
the Q-0014 AC-5 failure — a scan narrowed until every file carrying the defect sits outside it.

**It does not need weakening, because the screen is already built out of sibling regions.**
`MissionControlStatus` (`mission-control-status.tsx:176–198`) composes five: `Header`,
`ConnectionRegion`, `MetadataRegion`, `LossRegion` and the disclosures `<ul>`. The assertion is
scoped to `[data-mission-control-header]`, which is the identity line alone. **A sixth sibling
region for the measured values leaves that guard's subject untouched and is the shape every other
class of fact on this screen already takes.** The brief's word *"header"* names the top area;
`data-mission-control-header` names one region within it, and the two are not the same thing.
**AC-14.**

### 0.6 The unpriced case is the majority path, and the data would validate hard-coding it

Over all 169 manifests, 333 roll-up rows and the 835 occurrences carrying usage:

| Measure | Value |
| --- | --- |
| Manifests with more than one vendor | **165 of 169** (`cross_vendor: required`) |
| Roll-up rows with `cost_usd: null` | **165 of 333** (49.5%) |
| Manifests holding at least one unpriced row | **166 of 169** |
| Priced occurrences | 507 — **every one `claude`** |
| Unpriced occurrences | 328 — **every one `codex`** |

**Zero exceptions in either direction.** That is the strongest possible argument for AC-13's
*"never branches on a known vendor name"*: a developer reading this corpus would conclude
`codex ⇒ unpriced` and hard-code it, and **every test written against this repository's own data
would pass**. A third vendor — Gemini is on the roadmap — breaks it silently. The rule must be
enforced structurally, not by fixture.

It also reorders the work. The unpriced rendering is not a fallback; it is what nearly every real
render shows. `docs/05-design-prompt.md:45` already writes the screen that way — *"Claude $3.84 ·
Codex 226k tokens, unpriced — never one blended number"*.

Two further distinctions the appendix collapses, both from `rollup()`'s own JSDoc
(`manifest.ts:185–200`):

* **`cost_usd: 0` is legitimately different from `cost_usd: null`** — *"a measure nobody reported
  stays `null` rather than accumulating from `0` … while a genuinely reported `0` stays `0`."* So a
  guard asserting *"`$0.00` appears nowhere"* would be wrong. The rule is about `null`.
* **`vendorTokenTotal` can itself be `null`** (`reader.ts:188–191` sums `input_tokens + output_tokens`
  only, returning `null` when both are absent), so an unpriced vendor with no token measure is a
  fifth state and renders `n/a`, never `0`.

And **status is never consulted**: a failed occurrence that was billed is in the roll-up, *"failure
is when the number matters most"*. The screen must not filter.

### 0.7 What the figures are stale by, measured

Two separate staleness facts, and the appendix states only the weaker one.

* **Cost is as of the last read** — §A.2's ruling, carried.
* **Cost is also as of the last *completed* occurrence**, because the roll-up is rewritten in
  `terminal()` (§0.1). Measured over 919 occurrences with a duration: **median 4:12, p90 20:35,
  longest 1:27:28** (an `implement` step on Q-0124). **So a freshly-pressed refresh can return a
  figure that is twenty minutes behind at p90 and an hour and a half behind at the tail**, and a
  screen saying only *"as of that read"* would be making a claim it cannot support. AC-17.

### 0.8 The sub-cent hazard I went looking for is not reachable, and the divergence behind it is real

`apps/web` renders money at **two** decimals at two sites — `backlog-board.tsx:204` and
`ticket-page.tsx:665`, both `billedCostUsd.toFixed(2)` — while `packages/cli/src/runs.ts:86` renders
at **three**, carrying a landed reason: *"at two decimals a real `$0.004` step renders `$0.00` and
becomes indistinguishable from a vendor that reported zero … See Q-0034."*

**Measured, and the concern is refuted**: the cheapest priced roll-up row in this repository is
**$1.64**, the cheapest priced occurrence ever **$1.17**, and **zero** rows fall below $0.01 at any
point in any run's life. So no `$0.00` arises from rounding, and this is a latent divergence rather
than a live defect. Recorded because a reader meeting `toFixed(2)` next door will copy it.

**It is still the wrong precision for this field.** `packages/cli/src/runs.ts:97–99` renders
`rollup[].cost_usd` — the identical field this screen renders — at three decimals. `billedCostUsd` is
a different field (a ticket-level sum) and keeps its own convention. **Same field, same precision.**
§6 OQ-2. One further reason: `49.748091500000015` is on disk today
(`.quorum/runs/Q-0115-2/manifest.json`), so the value must be rounded rather than printed.

### 0.9 Payload, measured because Q-0127 set that precedent

`GET /history/:id` answers `{ id, manifest, incomplete, tokensByVendor, steps }` and carries the
`steps` array **twice** — once inside `manifest` and once again with `seq` added
(`read.ts:403–428`). Measured over all 169 runs: **median 4,950 B, maximum 59,933 B** (Q-0015-4, 55
occurrences). What this screen reads — `started_at`, `ended_at`, `duration_ms`, `status`, `rollup`,
`incomplete`, `tokensByVendor` — is **median 603 B, maximum 614 B**, a **98× difference at the
maximum**.

**No cap is specified and none is needed**: nothing is over 200 KB, the route is already shipped and
already answers this, and adding a second route or a projection is work with no measured subject.
The oversupply is recorded so a later reader does not mistake its absence for an oversight.

### 0.10 Two things the browser has and one it does not

* **It has both halves of the id.** `WireRun.ticketId` and `WireRun.runId` are already on the
  metadata read the header already performs (`mission-control-status.tsx:48–56`, `:132–172`).
* **It has the endpoint.** `DAEMON_ENDPOINTS.history` is `'/history'`
  (`daemon-endpoints.ts:1–8`) and is read by nothing under `src` today. `'/history'` is already a
  declared shell route (`routes.ts:232`), so a helper composing `${DAEMON_ENDPOINTS.history}/…`
  needs **no** new `EXCEPTION_REASONS` row in `routes.test.ts`.
* **It has no schema.** `/history` and `/history/:id` are **the only two routes on this transport
  with no declared shape anywhere** — every other read route has a `Wire*` interface and a zod
  schema. AC-9 closes the last gap in a set rather than adding a one-off.

That matters more than it sounds. `readRun`'s own JSDoc calls the parsed manifest *"a cast, never a
check"*, and the route validates only `rollup` (for `tokensByVendor`) and `steps`. **A browser-side
schema is the first validation of `started_at`, `ended_at` and `status` anywhere in the chain.**

### 0.11 One shipped sentence is already wrong, and nothing will catch it

`apps/web/src/routes.ts:209`:

> *"The header's run number, elapsed time and per-vendor cost are Q-0131's; starting or stopping a
> run is Q-0130's."*

Q-0131 shipped the run number alone and split the other two here. The sentence is a register entry
promising work under the wrong ticket id, and it is matched by **no test** — the only occurrence in
the package is the literal itself. AC-17.

Two neighbours are correct and need nothing: `docs/04-architecture.md:18` and `:392` both already
name Q-0135 for these two values.

---

## 1. Problem

Mission control shows a run's identity, its connection, its trace and its timeline. It shows neither
of the two figures a `maintainer` watching a run actually wants: **how long it has been going, and
what it is costing, per vendor.** The screen says so rather than faking them —
`mission-control-text.ts:36–37` carries both disclosures — which is right, and it is the state
`docs/06-development-plan.md` records as this ticket's.

Everything needed is on disk and already served. `manifest.started_at` is written at run start and
the per-vendor roll-up is rewritten on every occurrence that terminates (§0.1), and `GET /history/:id`
answers both. What is missing is a read, a schema, and a rendering — plus **one boolean the daemon
already knows and does not carry** (§0.2), without which the screen reads another run's figures for a
dry walk.

The two figures behave differently and the difference is the design: **elapsed advances from a value
the browser already holds and cost does not**, because a display performs no read and the frozen
contract bounds reads. Getting that distinction wrong in either direction produces a screen that
either freezes a number that is false the moment it renders, or polls the most expensive route on
the transport.

## 2. User stories

**`maintainer`** — *I start a `chore` run and leave it. When I come back I want to know, without
reading a log, how long it has been running and what it has cost me on each vendor — and I want to be
told when a figure is behind rather than shown a number that looks current.*

**`maintainer`** — *I tick "dry run" to see what a flow would do. I want the screen to tell me there
is no run history for a walk that writes none — not to show me elapsed time and cost belonging to a
different run.*

**`adopter`** — *My first run is on a token-only vendor. I want to see that it reported no price,
not `$0.00`, because those are different claims and only one of them is true.*

**`contributor`** — *I add a third vendor's adapter. I want its row to appear in mission control
because it is in the roll-up, not because somebody added its name to a list in the browser.*

## 3. Surfaces

* **`apps/web`** — the mission control screen: a new measured-values region, one new reader, one new
  path helper, and the copy.
* **`packages/shared`** — `wire.ts`: the history-detail schema, and one field on `WireRun`.
* **`packages/server`** — `host.ts` retains `dry` on the record; `wire.ts` projects it.
* **`docs/`** — `04-architecture.md` and `05-design-prompt.md` (both inside the chore role's
  fourteen roots).
* **Not `contracts/`** — outside those roots. See §8 GO-3.
* **No new route.** The daemon's fifteen are unchanged, so `package.test.ts`'s route register and the
  architecture document's route list are untouched.

## 4. Acceptance criteria

*Ten, numbered continuously from AC-8 per the ticket's instruction, against this role's ceiling of
fifteen.*

---

**AC-8 — the wire carries whether a run is a dry walk.** `RunRecord` retains `dry` from the start
request; `wireRunOf` projects it; `WireRun` and `wireRunSchema` gain `readonly dry: boolean`. It is
required rather than optional and is never inferred. The field narrows nothing on `RunView`, so
Q-0121 GO-3's naming rule permits its name, and `WIRE_START_FIELDS` already carries `'dry'` — this
makes the wire symmetric in a word it already speaks in one direction.
*Test:* a run started `{ dry: true }` reports `dry: true` on `GET /runs/:id` and in `GET /runs`; one
started without the field reports `false` and never `undefined`; the schema refuses a row omitting
it; a projection dropping it turns a test red by name. **Not eligible for trimming** — AC-10's
refusal and AC-16's dry case both rest on it, and §0.2's hazard is closed by nothing else.

**AC-9 — one shared schema for the history detail read.** `packages/shared/src/wire.ts` gains a
schema over the subset this screen reads — `started_at`, `ended_at`, `duration_ms`, `status`,
`rollup[]` as `{ vendor, cost_usd, unpriced_steps, step_count }`, `incomplete`, `tokensByVendor` —
with the **loose** disposition rather than `.strict()`, per *"Unknown keys are refused where Quorum
owns the key set, and preserved where it does not"* (2026-08-25): `readRun` calls the parsed manifest
*"a cast, never a check"*, so a browser refusing a key it did not know would refuse a document this
product wrote. `apps/web` declares no wire shape of its own (Q-0127 AC-7).
*Test:* accepts a real manifest read from a fixture run directory and one carrying an unknown key;
**refuses a `rollup` that is not an array, and one whose elements are not objects with a string
`vendor`** — the guard `read.ts` needed two review rounds to get right, met here rather than
rediscovered; `cost_usd` and `tokensByVendor`'s values nullable; `unpriced_steps` and `step_count`
non-negative; `started_at` a non-empty string.

**AC-10 — the read is composed from what the browser holds, is gated, and never fires on a timer.**
The screen composes `<ticketId>-<runId>` from the loaded `WireRun` and reads `GET /history/<id>`
through the existing `requestJson` and AC-9's schema, adding one path helper beside
`ticketDetailPath` and `runDetailPath`. **One read on mount and one per explicit refresh, and no read
at all** where `ticketId` is null, where `runId` is null, or where `dry` is true.
*Test:* one read on mount and one per *Check again*; the id is composed from `ticketId` and `runId`
and never from the handle; each of the three gates is asserted separately to issue **zero** requests;
**a dry run issues no request even though its `runId` is non-null**, shown against a fixture where a
manifest exists at the composed id — which is §0.2's hazard staged rather than described.

**AC-11 — the timer guard is narrowed to the behaviour it protects, deliberately and visibly.**
`apps/web/test/source.test.ts`'s clause becomes *no fetch is reachable from a timer callback* rather
than *no timer exists*, restoring the subject its own title already names. The narrowing is recorded
in place with its reason, in the guard's own failure message as well as its comment — which is the
exit condition `COERCES_TO_NUMBER`'s message prescribes for exactly this situation. No file-level
exemption, no comment token, and no register of permitted callers: the discriminator is what the
callback does, not who wrote it.
*Test:* a fixture scheduling a fetch inside `setInterval` fails, naming the file; a fixture
scheduling a render-only tick passes; the two are shown to differ by the fetch alone; and the
pre-narrowing clause is demonstrated to fail over the shipped tick, so the narrowing is proven
necessary rather than asserted. **Not eligible for trimming** — a guard narrowed without a
discriminating fixture is Q-0079 round 2 repeated.

**AC-12 — elapsed advances while running, freezes on the engine's own figure, formats and clamps.**
While the run is running, elapsed is the browser's clock minus `manifest.started_at`, taken through
the existing injectable `Clock` and never a bare argument-less `new Date()` outside `isoClock`,
advancing **at least once per second**. Once the run has ended the screen renders
**`manifest.duration_ms`** and stops advancing — it does **not** subtract `ended_at` from
`started_at`, because `finalise` already computed that from one clock reading (§0.3) and a second
computation is the third-site objection §A.3 raises for cost. Under one hour `MM:SS`; at one hour or
more `H:MM:SS`, **hours unbounded** — no day rollover and no clamp, 75 of 168 runs being an hour or
more and the longest 24:17:35. Minutes and seconds zero-padded. A negative difference renders
`00:00`. The rendering names whose clock produced a live figure.
*Test:* against an injected clock, `00:00`, `14:32`, `1:00:00` and a multi-day figure each render
exactly, so the verdict is a property of the commit (2026-08-30); live advancement and terminal
freezing are each observed and each fails if the other's behaviour is substituted; **an ended fixture
whose `duration_ms` disagrees with `ended_at − started_at` renders `duration_ms`**, which is the one
assertion that distinguishes this from the appendix's design; a `started_at` in the future renders
`00:00`; a source clause asserts no file under `apps/web/src` reaches `Date.now()`.

**AC-13 — one row per vendor, never summed, never keyed on a vendor's name.** One entry per `rollup`
row, **in the roll-up's own order** — first-appearance order, which the browser preserves and never
sorts. Grouping is on the exact `vendor` string and **no code branches on a known vendor name**. A
row renders: the label; `cost_usd` where it is a number, **including a genuinely reported `0`**; and
where it is `null`, that vendor's `tokensByVendor` total with the fact that it is **unpriced and not
free**, or `n/a` where that total is itself null. `unpriced_steps` is disclosed where it is non-zero,
so a partly-priced row says how much of itself it cannot see. **No total across vendors is rendered
anywhere**, and this screen reads neither `terminal.cost` nor `terminal.tokens`. Status is never
consulted, so a billed failure is included.
*Test:* a two-vendor fixture — one priced, one `cost_usd: null` — renders two entries and no third;
an assertion fails if any rendered figure equals the sum of two rows' `cost_usd`; a source clause
forbids `terminal.cost` and `terminal.tokens`; **a fixture whose vendors are `alpha` and `beta`
renders both correctly**, which is what proves no name is hard-coded where every row in this
repository's own corpus would validate hard-coding one (§0.6); a `cost_usd: null` row renders no
`$0.00` **and** a `cost_usd: 0` row renders a price, the two asserted separately. **Not eligible for
trimming** — it is the one place a blended figure could reach a reader, and `terminal.cost` is a
typed number already in the browser's hands, which is what makes the wrong answer tempting.

**AC-14 — the measured values render in their own region, and the header's guard keeps its subject.**
Elapsed and the cost rows render in a new sibling region of `MissionControlStatus`, marked with its
own `data-` attribute beside `data-mission-control-header`, `data-mission-control-disclosures` and
the loss region. `mission-control-status.test.ts`'s assertion that `[data-mission-control-header]`
renders no `—`, `$`, `0:00` or `n/a` is **left exactly as it is and continues to pass** (§0.5).
*Test:* the header assertion is unchanged, still green, and shown still to have a subject by
rendering a `$` into the header in a fixture and watching it fail; the new region is found by its own
selector; a fixture placing the cost row inside the header region fails the shipped assertion, which
is what proves the separation is load-bearing rather than cosmetic.

**AC-15 — the count register moves by exactly one row, deliberately.** `tokensByVendor` leaves
`apps/web/test/source.test.ts`'s `COUNT_FIELDS` with the reason recorded in place: it is the one
shape in which a **per-vendor, already-reduced** count reaches this app, computed by
`vendorTokenTotal` over one row inside `packages/server`, and `apps/web/src` may not import
`@quorum/core` (`04-architecture.md:388`) so it cannot compute one. `vendorTokenTotal`,
`input_tokens`, `output_tokens` and `cached_input_tokens` **stay forbidden**, being the four from
which a browser could compose a figure of its own. `cost_usd` and `unpriced_steps` are on no list,
the guard being about counts and saying so in its own name. The *cost to date* phrase ban is
untouched.
*Test:* the list is asserted **by identity at four entries**, so a fifth leaving it fails; each
remaining entry is shown to still fire over its own fixture; the phrase half is unchanged and still
discriminating; a browser-local rename of a forbidden field does not bypass it.

**AC-16 — every absent case is named, and none is blank.** Five states distinguished rather than
collapsed, each with its own sentence: **a dry walk**, which allocates a run number and writes no run
history, so the reason is that nothing was recorded rather than that nothing was spent — and for
which **no read is attempted at all**; **a run whose number is not yet known**, where no read is
attempted either but for a different reason; **a history that could not be read**, carried through
the existing `RequestState` vocabulary with its own retry, distinguishing the daemon's 404 from its
422 rather than reporting both as absent; **a vendor that reported no price**; and **a vendor present
in the run but absent from the roll-up**, because it has not yet finished a billed step (§0.1) —
which is not the same claim as unpriced.
*Test:* all five render distinct non-empty prose; none renders a zero, a dash, a spinner or an empty
region, per `04-architecture.md:390`; the dry case is asserted **specifically**, being both the first
case anyone exercising this meets and the only demonstration mission control has ever had;
`RequestState` stays closed at five members; every state is distinguishable in text alone, without
colour or motion.

**AC-17 — the disclosures retire conditionally, completeness is stated honestly, and the copy
contract holds.** `MISSION_CONTROL_DISCLOSURES` entries `[1]` and `[2]` are rewritten and rendered
**conditionally on the existing filter idiom, never deleted** — the array's length is asserted at
five by Q-0131 AC-5 and a deletion breaks it. What replaces each is the **specific** absence from
AC-16 rather than a general one. Where the read reports `incomplete`, the cost region says the run is
in flight **and that the figure omits whatever the current step has not yet been billed for** —
measured at a p90 of 20:35 and a maximum of 1:27:28 behind (§0.7), so *"as of that read"* alone would
be a claim the figure cannot support. The two existing loss disclosures stay separately visible and
are not conflated with it. Every sentence added or rewritten is an export in
`mission-control-text.ts`, imported by both renderer and tests. **And `apps/web/src/routes.ts:209` is
corrected**: it attributes elapsed time and per-vendor cost to Q-0131 (§0.11).
*Test:* for each disclosure the present and absent states are both asserted; deleting either sentence
outright fails; a state where the value is absent and the sentence is also absent fails; an
`incomplete` fixture renders the in-flight sentence and a complete one does not; the register
sentence names this ticket; a source clause asserts *ticker* appears nowhere under `apps/web/src`,
per §A.2 and `docs/05-design-prompt.md:39`, which deferred the ticker to this screen by name.

---

## 5. Non-goals

1. **No new daemon route.** `GET /history/:id` is shipped and answers this. The fifteen-route
   register and the architecture document's route list are untouched.
2. **No polling of any kind.** AC-11 narrows a guard about fetching; it does not licence one.
3. **No browser-side accumulation of cost or tokens from the event stream.** §A.3's measurement
   stands: a 500-event head-evicting buffer under-reports silently, exactly when the screen is
   disclosing a discard, and the daemon replays its buffer to every subscription.
4. **No blended total, anywhere, ever** — not across vendors, not across runs, not in a tooltip.
5. **No change to the event union**, no timestamp on any event, and no `start` member. Q-0131 ruled
   that and the ruling is not reopened.
6. **No second start time recorded by the host.** §A.5's refusal is carried: it would disagree with
   the manifest's by the daemon's scheduling delay and give one run two durations.
7. **No cap, projection or second endpoint for the history payload.** §0.9 measured the oversupply at
   98× and it is under 60 KB at the maximum.
8. **No run-history screen.** Q-0018's.
9. **No change to `billedCostUsd`'s rendering** on the board or the ticket page. Different field
   (§0.8).
10. **No decision entry.** §7.

## 6. Open questions — ruled, not deferred

**OQ-1 — how the dry walk is distinguished. Ruled: carry `dry` on the wire (AC-8).** The alternative
considered and refused is one sentence covering both *"a dry walk records none"* and *"this history
could not be read"*. It is **insufficient rather than merely weaker**: it makes the 404 honest and
leaves untouched the case where the id resolves to a *different run's* manifest (§0.2), which is a
wrong answer rather than a missing one. Inferring dryness from a 404 is refused on the same ground
decision 097 refused inference where identity is available. **If the gate refuses AC-8**, then AC-8,
AC-10's dry clause and AC-16's dry case all change and the ticket must be re-cut at that gate; it is
stated so the consequence is visible rather than absorbed.

**OQ-2 — money precision. Ruled: three decimals, matching `packages/cli/src/runs.ts:86` on the
identical field.** The board's `toFixed(2)` is a different field and keeps its convention. The
sub-cent `$0.00` hazard Q-0034 names is **not reachable** for a roll-up row — minimum $1.64 across
169 runs, zero rows under $0.01 (§0.8) — so this is consistency rather than a defect, and it is
recorded with that measurement so it is not later presented as one. Rounding is required regardless:
`49.748091500000015` is on disk.

**OQ-3 — the browser's clock or the daemon's. Ruled: the browser's**, against `manifest.started_at`,
with the rendering naming it (AC-12). One clock reading, no round trip, and on a loopback daemon it
is a machine's own clock against itself. The alternative — carrying the daemon's `now` on each
response — buys accuracy this screen does not need and adds a field to a response `core` writes.
§A.5's recommendation, carried unchanged.

**OQ-4 — whether elapsed should advance at all. Ruled: yes, and cost should not.** §A.2's reading of
`contracts/Q-0015/mission-control.contract.md:9` is correct: the clause bounds **reads**, and a
display advancing from a value already held performs none. A frozen elapsed goes false the moment it
renders. The binding obstacle was never that clause but the source guard, which AC-11 narrows.

## 7. No decision entry is owed, and the reason is recorded rather than assumed

Applied by this repository's own test — *does any landed sentence go false?* — at four sites:

* **The event union is untouched.** `docs/GLOSSARY.md`'s **Event** term, `events.ts`'s header and
  `host.ts`'s `runId` JSDoc each say *an event* carries run identity only at the terminal. Nothing
  here is an event. All three stay true verbatim.
* **AC-8's field.** Adding to `WireRun` is precedented — Q-0016 added `gates` and `refusal` to this
  exact shape — and Q-0121 GO-3's naming rule permits `dry`, which narrows no `RunView` field.
  `WIRE_START_FIELDS` already contains `'dry'`.
* **AC-9's schema.** A fourth reader on a module whose header already says *"Nothing here polls,
  keeps a copy, or persists"*, closing the last of the transport's read routes with no declared
  shape.
* **AC-11's narrowing.** It changes no product behaviour, contradicts no landed entry, and the
  guard's own failure message prescribes deliberate narrowing. On Q-0108's precedent the ruling
  belongs in the guard's authority comment, which is where AC-11 puts it.

## 8. Gate obligations

**GO-1 — rule AC-8 before the run starts.** It is the one criterion whose refusal re-cuts the ticket
(§6 OQ-1). Ruling it at the gate is what keeps it out of an implement round, and this repository has
priced a missing gate ruling at three wasted rounds (Q-0062) and a round-1 `blocked` (Q-0126,
Q-0129). Verify the ruling is present in the implement step's own `prompt.txt` by grep rather than
assuming it — the check Q-0097 lost two errata by not making.

**GO-2 — rule AC-11's narrowing at the gate too.** A guard narrowing is a visible act; ruling it here
means no implement round spends itself arguing about whether it is permitted.

**GO-3 — the contract note is written by hand at the gate.** `contracts/` is **not** among
`developer-generalist`'s fourteen roots (`harness/roles/developer-generalist.md:3`), so no criterion
above names it — Q-0129's round 1 returned `blocked` on exactly that surface and Q-0131 handled it
this way (its E-2). Three clauses of `contracts/Q-0015/mission-control.contract.md` are owed: `:20`
and `:63` still say **five** absent capabilities where Q-0131's appended note already ruled four and
this ticket takes it to two; and the elapsed and cost disclosures retire, leaving the next-flow-step
and tool/reasoning capabilities absent. Record it as a **removed premise**, not a reversal: those
clauses described the only sources that existed.

**GO-4 — predict and perform the hand pass over whatever the review does not see.** Q-0131's three
reviews were the first in this stretch **not** truncated. This change is larger — three packages and
a guard — so truncation is likelier. Whatever `materialiseDiff` names as omitted is reviewed by hand,
cross-vendor, and `runs.log` records the ratio and the file list either way, including when nothing
was cut.

**GO-5 — discharge by running the product and transcribing what it rendered.** Not by asserting it.
Q-0016's equivalent was reported discharged when its by-hand half had not been performed, and
Q-0015's gate found that; Q-0134's found a shipped defect three cross-vendor reviews had approved.
Required, in `runs.log`, in this order: a real daemon from `quorum open`; a run started **through the
daemon**, because a `quorum run` is a process the host can never see (Q-0121); mission control open
in a browser **while it is running**, showing an advancing elapsed figure and at least one vendor
row, with the in-flight sentence present; the same screen after the run ends, showing the frozen
figure and both vendors; and **a dry walk started from the ticket page's own checkbox, showing the
dry sentence and issuing no history request** — which is §0.2's hazard demonstrated closed rather
than argued.

## 9. Risks

**R-1 — four shipped assertions are tripwires for this change, and three are not obvious.**
(a) `mission-control-status.test.ts:97` forbids `$`, `n/a`, `0:00` and `—` in the header region —
resolved by AC-14, and the reason AC-14 exists. (b) `source.test.ts`'s `MESSAGE_PARSE_NEEDLES`
contains the bare literal `cost=`, scanned over every file under `src` **including comments**, so a
JSDoc explaining that this screen does not parse `cost=` from a message would fail the guard it is
explaining. (c) `COERCES_TO_NUMBER` bans `Number(`, `parseInt(` and `parseFloat(` blanket —
zero-padding and money formatting must work on typed numbers through `String(…)` and `toFixed(…)`,
which is how Q-0134's `diff-view.tsx` already passes it. (d) `MISSION_CONTROL_DISCLOSURES` is
asserted `toHaveLength(5)`; AC-17's conditional retirement is what keeps that green.

**R-2 — `Clock` is `() => string`, not `() => number`.** Widening it touches five screens. Converting
an ISO instant to milliseconds must avoid the three banned coercions; `new Date(iso).getTime()` is
not among them, and AC-12's source clause is therefore aimed at a bare argument-less `new Date()`
outside `isoClock` rather than at `new Date(` as a string — a needle written the looser way would
match `isoClock` itself and the conversion this ticket needs.

**R-3 — the review loop's bound is two.** `chore.yaml:70` gives `review` `max_iterations: 2`, so
three implement rounds reach the exhaustion gate. Ten criteria across three packages plus a guard
narrowing is a realistic three rounds. The seam if it exhausts is stated in advance: **AC-8, AC-10
and AC-16's dry clause are one coherent half** and the rest is the rendering — split there at that
gate, by erratum, rather than granting a fourth round.

**R-4 — this repository's own corpus would validate the wrong implementation.** Every codex row is
unpriced and every claude row priced, 328 and 507 with no exceptions (§0.6). A vendor-name branch, a
sorted roll-up, or a test that only ever sees `claude` and `codex` all pass against real data.
AC-13's `alpha`/`beta` fixture is the only thing that catches it.

**R-5 — the terminal figure has two plausible sources and the appendix picks the wrong one.** An
implementer following the appendix's AC-10 verbatim writes a subtraction that is correct on every
fixture and is a second computation of an engine-computed value (§0.3). The criterion that catches it
is AC-12's disagreeing-fixture assertion, and it is the one assertion in this document that would
look pointless to someone who had not read §0.3.

**R-6 — a dry walk and a real run of the same ticket share a number by construction** (§0.2), so a
fixture proving AC-10's dry gate must place a manifest at the composed id. A fixture where the id
resolves to nothing passes whether or not the gate exists, which is the check-with-no-subject failure
this repository records most.

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No credential, no key, no auth path. The word *subscription* appears nowhere in this change. |
| **Worktree safety** | n/a. Nothing here writes to a repository. Read-only route, browser rendering, and one boolean on the wire. |
| **Gate behaviour** | Unchanged. No gate is added, answered or altered; `pendingGates` and the gate link are untouched. |
| **Human-gated by default** | Unchanged. AC-8 carries `dry` in the **read** direction only; the start body's field set is not widened and `auto` stays forbidden in the browser (Q-0130 AC-12). |
| **Files are the database** | Honoured and relied on: every figure originates in `manifest.json`, which `core` writes and the daemon reads. The browser persists nothing and caches nothing. |
| **File format and schema** | `manifest.json` is frozen and untouched. Two additive schema changes, both in `packages/shared/src/wire.ts`: one field on `WireRun`, one new loose schema. |
| **Lint rules** | No flow file changes; `quorum lint` unaffected. `@typescript-eslint/no-deprecated` unaffected. |
| **Cross-vendor rule** | n/a to the change; the `chore` flow it runs under already satisfies it. |
| **Product-agnostic** | Honoured, and AC-13 strengthens it: the browser learns no vendor's name. |
| **Errors are explicit** | AC-9's schema is the first validation of three manifest fields anywhere in the chain; AC-16 distinguishes 404 from 422 rather than collapsing them. |
| **Cold-clone impact** | None. No dependency, no install step, no first-30-minutes cost. |

---

## Provenance

**Appendix A supplied the shape and most of the criteria, and it earned that.** Its three central
measurements — that the roll-up is live on disk, that `GET /history/:id` already serves it, and that
`RunStats` has no vendor split so a browser would have to accumulate over a head-evicting buffer —
were re-verified at this tip and all three hold. §A.2's ruling that the frozen contract bounds
**reads** is correct and is what makes an advancing display legal. §A.3's refusal of a `done` field
and §A.5's refusal of a host-recorded start time are carried unchanged. AC-9, AC-13, AC-15, AC-16 and
AC-17 descend from its AC-8, AC-11, AC-12, AC-13 and AC-14.

**Four of its claims did not survive re-measurement, and they are corrected rather than worked
around.**

* **§0.2 — its AC-13 is unsatisfiable as written, and the reason is a wrong answer rather than a
  missing one.** The appendix says *"Nothing has to be computed; it has to be read and rendered."*
  That is true everywhere except the one place it makes a criterion: the daemon does not carry
  whether a run is dry, and `nextRunId` reserving nothing means a dry walk's composed id is the id
  the next real run creates. **AC-8 is new and is the largest change in this document.**
* **§0.3 — its AC-10 recomputes a value `finalise` already wrote.** The appendix's own §A.5 cites
  `duration_ms` as the authority for refusing a second start time and then specifies recomputing it
  four paragraphs earlier. Verified non-null exactly when a run has ended, across 169 manifests with
  zero anomalies. **AC-12 reads it.**
* **§0.4 — it never mentions the guard that blocks its own AC-10.** `source.test.ts:888–899` bans
  `setInterval(` as a bare string anywhere under `src`. §A.2 rules the *contract* clause correctly
  and the *source* clause is what an implementer meets first. **AC-11 is new.**
* **§0.5 — four of its specified renderings trip one shipped assertion.** `$`, `n/a`, `00:00` and
  `1:00:00` all match `/—|\$|0:00|n\/a/` on `[data-mission-control-header]`; only `14:32` survives.
  **AC-14 is new**, and it resolves the collision by placement rather than by narrowing a guard whose
  subject is fabrication.

**Contributed by neither and added here from the tree:** the 100% vendor↔price correlation that makes
AC-13's structural rule necessary and would validate its violation (§0.6); the second staleness fact,
that a fresh read is still a step behind by up to 1:27:28 (§0.7); the two-versus-three-decimal
divergence and the measurement that refutes it as a live defect (§0.8); the 98× payload oversupply,
measured because Q-0127 set that precedent and recorded because its absence should not read as an
oversight (§0.9); that `/history` and `/history/:id` are the only two routes on this transport with
no declared shape, so AC-9 closes a set rather than adding a one-off (§0.10); and the stale register
sentence at `routes.ts:209`, which promises this ticket's work under Q-0131's id and which no test
matches (§0.11).

**One concern was raised, measured and refuted before it entered a criterion**, and it is recorded
because the next reader will have it too: sub-cent roll-up rows rendering `$0.00` at two decimals.
The minimum priced roll-up row in 169 runs is $1.64 and the minimum priced occurrence ever is $1.17,
so it is not reachable. It survives as a consistency question (OQ-2) and not as a defect.

**Verdict: ready.** Ten criteria against a ceiling of fifteen. Both gate questions are ruled by
measurement rather than deferred, no criterion names a surface the chore flow cannot write, the
`contracts/` note is a gate obligation on Q-0131 E-2's precedent, and no decision entry is owed at
any of the four sites where one could have been.
