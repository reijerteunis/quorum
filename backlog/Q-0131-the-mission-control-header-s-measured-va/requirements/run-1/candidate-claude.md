# Q-0131 — The mission control header's measured values

*Requirements, run 1, candidate-claude. Measured against tip `a7e3f50` (`chore(backlog): Q-0131
re-measured after Q-0129`), working tree clean but for this ticket's own untracked `runs.log`.*

---

## 0. What was measured, and what the body got wrong

The ticket body says twice, in its own words, **"do not re-derive this ticket's figures from its
body either"**. Every figure below was taken from the tree. Three of the body's claims survive, two
are superseded by something better, and two facts nobody had are what change the shape of the work.

### 0.1 The finding that reframes the ticket: the run number is already on the stream, in prose

`packages/core/src/engine/engine.ts:340` — inside the run `try`, before run history is initialised,
as **the first event of every run**:

```ts
emit({ type: 'info', message: `run #${runId}  flow=${flow.name}  ticket=${ticket.meta.id}  ${flow.consumes} → ${flow.produces}` });
```

`runId` is allocated at `engine.ts:228` (`nextRunId(ticket)`), unconditionally, **before** the
`dry` branch at `:246`. So the number exists from run start, the engine already emits it at run
start, and it already stringifies it at that exact site.

That is verbatim the situation *"A gate question carries the decision that reached it"*
(2026-09-17) describes and rules: a structured value the engine already holds, crossing only inside
a sentence composed for a human. The body treats the run number as a `core` correlation problem
still to be solved. It is not. It is **one interpolation away from being a field**, at a site that
already runs on every run including a dry one.

The body's citation that `runId` is `null` for a live run's whole life holds and was confirmed
against a running daemon by Q-0129's own AC-14 demonstration. What it did not say is *why* it is
`null`: `packages/server/src/host.ts`'s `observe` sets it from the terminal event because the
terminal event is the only one carrying it **as a typed field**, and that JSDoc refuses the
alternative in as many words — *"Nothing here reads an event's `message` text or takes a run number
out of a `gateId`: two authorities for one run's identity is what `minted` exists to prevent."* The
host is already written to accept a field and refuse the prose.

### 0.2 The second finding: elapsed and per-vendor cost already exist on disk, live and unblended

`packages/core/src/run-history/writer.ts:494–506` creates `manifest.json` **at run start**, carrying
`started_at: started.toISOString()`, `status: 'running'`, `rollup: []`. `manifest.ts`'s own JSDoc
for the roll-up says it is *"recomputed in full on every terminal occurrence"*, and `terminal()`
(`writer.ts:568`) is the funnel every occurrence passes through, each replacing the manifest
atomically.

So for any non-dry run, while it is running, `.quorum/runs/<TICKET>-<n>/manifest.json` holds:

- `started_at` — the run's own start, from `core`'s clock, in UTC. **Elapsed's source.**
- `rollup: VendorRollup[]` — `{ vendor, step_count, unpriced_steps, cost_usd, input_tokens,
  output_tokens, cached_input_tokens, cache_write_input_tokens }`, one row per vendor that reported
  usage, a measure nobody reported staying `null` rather than accumulating from `0`. **Per-vendor
  cost's source**, in precisely the shape *"Codex cost is reported as tokens, never priced locally"*
  (2026-08-22) requires — `cost_usd: null` for a token-only vendor, and `unpriced_steps` so a row
  *"can say how much of itself it cannot see"*.

`GET /history/:id` already serves both (`packages/server/src/read.ts:390–429`): the manifest whole,
plus `tokensByVendor`, which is `vendorTokenTotal` applied to **one row at a time** — the route's own
comment says summing across rows *"would compose exactly the figure that entry refuses"*.

**Nothing has to be computed for the cost half. It is computed, per vendor, correctly, and written
to disk while the run runs.** What blocks a browser from reading it is one thing: a run-history id
is `<TICKET>-<n>`, and a live run supplies no `n`. Decision 097 refused *"read it from run history"*
for the verdict on exactly that ground — **identity** — and on a second ground (`run-manifest-v1` is
frozen, so `findings` and `summary` could not travel there) that **does not apply here**, because
`rollup` is one of the manifest's own required keys.

**So the three values are one mechanism, not three, and the run number is the key to the other
two.** That is the structural claim this document is built on, and it is the reason this ticket is
one ticket rather than three.

### 0.3 The body's assumption about `cost` was measured and does not hold

The body says this ticket *"applies that ruling to `cost`"*, meaning a structured field the way
`reached` was. Measured, that route is worse than the read, for a reason no earlier account had.

`packages/core/src/engine/engine.ts:256` — the engine's run-level accumulator is
`const stats: RunStats = { cost: 0, tokens: 0, unpriced: 0 }`. **There is no vendor split in it.**
`steps.ts:92–93` adds into it. `lifecycle.ts:196` puts it on the terminal event as `cost` and
`tokens`, which is why `runTerminalEventSchema` (`events.ts:245–246`) already carries
`cost: z.number(), tokens: z.number()` — two machine-readable numbers that **already cross the
wire today** and that this screen may not render, because they are the blended figure decision 025
refuses. Q-0015's own `runs.log` shows the shape: `run=9 completed … cost=10.391 tokens=6284817`,
where the codex steps in that same run logged `cost=?`.

So "the engine already holds it" is **false at run level** and true only **per occurrence**, at
`steps.ts:381–386`, where `result.vendor` and `result.usage` sit two lines above
`normaliseUsage(result.usage, result.vendor ?? adapter.vendor)`. Widening `done` with that would
give the browser per-step values it must then accumulate itself — and that is where it breaks:

- `apps/web/src/run-connection.ts:28` — `RUN_EVENT_RETENTION = 500`, **evicting from the head**.
- Measured over this repository's 165 recorded runs: **median 4 occurrences, p90 10, max 55.** An
  adapter occurrence emits `spawn` + `step` + `done` + one or two `info`, so the largest run here is
  already ≈275 events **before a single `stdout` line** — and `stdout` is one event per line from
  both adapters (`claude.ts:118`, `codex.ts:126`), with codex streaming JSONL.
- A browser accumulating from events it has evicted **under-reports the total, silently, exactly at
  the moment it discloses that it discarded events.** A cost figure that is wrong when the screen
  says it lost data is worse than no figure, and it is the class this repository records most.

The read has none of that: the roll-up is computed in `core` over every occurrence the run ever had,
whatever the browser saw.

### 0.4 Two hard constraints the body does not have

**(a) `contracts/Q-0015/mission-control.contract.md` is frozen, this ticket contradicts it, and no
step on the chore route may write it.** The contract says, at `:63–67`:

> Mission control names the **five** absent capabilities and their causes: live run number, elapsed
> time, structured cost/token totals, the next flow step, and structured tool/reasoning events. It
> renders no placeholder value for them. … The run number is read from the terminal event in the
> socket snapshot, never from a second metadata read.

and at `:88` it names *"structured header values as successor work"* — this ticket. Retiring three of
the five, and replacing "read from the terminal event" with "read from the start event", both
contradict it.

`harness/roles/developer-generalist.md`'s `paths:` are
`[package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github,
packages, apps, harness, docs, README.md, eslint.config.js, vitest.shared.js]`. **`contracts` is not
among them.** Q-0129's round 1 returned `blocked` on exactly this, for exactly this reason, and its
entry records that *"the merged requirement's own §11 cites that rule by name … and then names
`contracts/` one criterion later"*. **No criterion below names `contracts/`.** The superseded-by
note is **GO-2**, written by hand at the gate.

**(b) The literal `cost=` is forbidden anywhere under `apps/web/src`.** `apps/web/test/source.test.ts`
scans the complete corpus for six `MESSAGE_PARSE_NEEDLES` — bare `cost=`, bare `verdict=`, and
`role=` behind each of four delimiters — and the contract freezes that at six. This is a second,
independent bar beside the `COUNT_FIELDS` guard the body names, and it forecloses every
prose-parsing shape at the source level rather than by argument.

### 0.5 The `COUNT_FIELDS` register moves by exactly one row, and the four that stay are the load-bearing ones

`source.test.ts:677` forbids `['tokensByVendor', 'vendorTokenTotal', 'input_tokens', 'output_tokens',
'cached_input_tokens']` and the phrase *cost to date*, each half with its own fixture.

Under the recommended design the browser reads:

- per-vendor **cost** from `rollup[].cost_usd` and `rollup[].unpriced_steps` — **neither is on the
  list**, because the guard is about counts and says so in its own name;
- per-vendor **tokens** from `tokensByVendor`, which `GET /history/:id` has already reduced **one
  row at a time**.

So exactly **one** row leaves the list, and `vendorTokenTotal`, `input_tokens`, `output_tokens` and
`cached_input_tokens` all stay forbidden — which are precisely the four from which a browser could
compose a blended figure of its own. That is the guard's reasoning satisfied rather than routed
around, which is what the body asks for.

### 0.6 Three citations re-derived, and one figure that had not moved

Given as identities, not line numbers, for the reason the body gives.

| Claim | Measured |
| --- | --- |
| `runId` is `number \| null`, `null` until terminal | Holds. `host.ts` `RunView.runId`, `wire.ts` `WireRun.runId`, both with the JSDoc saying so. |
| `formatCost` is in `packages/core/src/engine/steps.ts` and its one emission site is `done`'s `message` | Holds. Declared at `:136`, called at `:382` and nowhere else in production. |
| `source.test.ts` forbids five count fields and *cost to date* separately | Holds, with its own fixture per half. |
| "no event carries a timestamp" | Holds, and it is **stronger than the body says**: `docs/GLOSSARY.md`'s **Event** entry states *"No event gains a timestamp or sequence number"* flatly, and `events.ts:143` repeats it. This is vocabulary, not just an entry — see §6 OQ-2. |
| Q-0015 AC-9's datum | `events 10 · missed 0 · peak concurrent columns 3`, `info 6, step 3, terminal 1`. Its own `runs.log` says in as many words: **"this was a `--dry` walk … AC-9's bound of 500 remains unmeasured against real traffic."** |

---

## 1. Problem

Mission control's header is the hero region of the hero screen, and three of the four things
`docs/05-design-prompt.md` screen 5 specifies for it are not there. In their place the screen prints
three sentences saying so — `apps/web/src/mission-control-text.ts`:

```
"The run's number is not on the wire until the run ends; its handle identifies it meanwhile."
"Elapsed time is unavailable because no event has a timestamp and the run has no start time on the wire."
"Per-vendor cost and token totals are unavailable as structured values; they occur only inside a human-readable message."
```

Those sentences are correct and were the right thing to ship — `docs/04-architecture.md` forbids a
placeholder showing a value nobody measured, and Q-0015 obeyed it. But they describe a **transport
gap, not a missing measurement**. The engine computes all three. It emits the run number as the first
event of every run and in prose; it writes the run's start time and a correct per-vendor roll-up to
disk at run start and keeps the roll-up current while the run runs. A `maintainer` watching a run
they are paying for is told three times that the product cannot see figures it has already computed
and stored.

The cost of leaving it is not cosmetic. **The run number is the identity of a live run**, and without
it a reader cannot join what they are watching to `runs.log`, to `.quorum/runs/`, to the ticket's own
history, or to anything they will read afterwards — the browser shows `Run run-1`, an opaque handle
the daemon's own JSDoc calls *"meaningless across a restart"*. And per-vendor cost is the figure this
product exists to keep honest: the one number that *does* cross the wire today, `terminal.cost`, is
the blended figure *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) refuses,
so the only cost value available to this screen is one it may not render.

---

## 2. User stories

**`maintainer` — the run number.** *As the solo maintainer watching a run I started from the ticket
page, I want the header to show the run's own number while it is running, so that the screen in front
of me and the `runs.log` line, run directory and ticket history I will read afterwards are about a run
I can name — rather than a handle that means nothing five minutes after the daemon restarts.*

**`maintainer` — elapsed.** *As the solo maintainer deciding whether a step has hung or is merely
slow, I want to see how long this run has been going, so that I can tell a six-minute fan-out from a
stuck adapter without going to a terminal — and I want to be told whose clock that is, because I will
act on it.*

**`maintainer` — per-vendor cost.** *As the solo maintainer who has spent $2,800 developing this
product through it, I want the header to show what this run has cost so far, split by vendor and
never blended, so that I can abort a run that is running away — and I want an unpriced vendor to read
as unpriced and never as free, because half the occurrences here are.*

**`adopter` — the same three, as a trust signal.** *As a stranger on my first run, I want the screen
to show what the product knows rather than three explanations of what it cannot see, so that my first
impression of mission control is a run I can read.*

**Surfaces touched:** `packages/shared` (the event union, one wire schema), `packages/core` (one
emit), `packages/server` (one correlation), `apps/web` (the header and one read). **No flow file, no
role, no adapter, no `backlog/`, no `contracts/`.**

---

## 3. The design the measurements select

### 3.1 The mechanism, in one paragraph

`packages/shared`'s event union gains **one member**, `start`, carrying the run number and nothing
else, emitted by `core` at the site that already emits the run-start `info` and already holds the
value. `packages/server`'s `observe` correlates `record.runId` from that typed field exactly as it
already does from `terminal` — **no wire shape changes**, `WireRun.runId` being declared
`number | null` since Q-0121. The browser's header then renders the number for a live run, and,
holding `ticketId` and `runId`, can form `<TICKET>-<n>` and read `GET /history/:id` for the run's
`started_at` and its per-vendor roll-up — both already served, both already correct.

One value crosses. Two more become reads of something that already exists. Nothing is computed twice
and no figure is invented anywhere.

### 3.2 Why a new member rather than a field on `info`

`info` is run-level narration with many producers. An optional `runId` on it would be absent on
almost every instance — the *"beginning of a family"* decision 097 warns against in its final
paragraph, and a shape where a reader cannot tell "this `info` has no run number" from "this `info`
is not the run-start one". A discriminated `start` member has **exactly one producer at exactly one
site**, is emitted **exactly once per run**, and mirrors `terminal`, which is the union's existing
precedent for a member carrying run identity.

Adding a member is the cheap direction *by the union's own design*, and `events.ts:31–33` says so:
*"Widening a discriminated union later is additive and every non-exhaustive consumer fails at `tsc`,
so the cost of adding them once a producer exists is a type error at build time."* That sentence was
written about `tool` and `text` — members refused because **no producer exists**. Here the producer
exists, is named, and already emits at that site. *"The event union is derived from what the product
emits"* (2026-08-25) is executed rather than contradicted.

### 3.3 Minimal payload: `runId` and nothing else

`terminal` carries six fields. `start` carries one. Everything else the brief's header names —
`flow`, `ticketId`, the stage — is already on `WireRun` from the start request the daemon itself
composed, so a second copy on the stream would be a second authority for a value the transport
already has. **The one value nobody downstream can derive is the run number**, and that is the whole
payload.

**It carries no timestamp**, deliberately, and that is not a preference: `docs/GLOSSARY.md`'s
**Event** entry says *"No event gains a timestamp or sequence number"*, which is vocabulary rather
than an entry, and elapsed does not need one because the manifest already has `started_at`.

### 3.4 Why cost is a read and not a second field

Refused with its measurement, so it is not taken again:

- **A per-vendor field on `done`.** The browser would accumulate. `RUN_EVENT_RETENTION = 500` evicts
  from the head, this repository's largest run has 55 occurrences ≈275 non-`stdout` events before any
  `stdout`, and codex emits one event per JSONL line — so the accumulated total under-reports
  silently, and does so precisely when the screen discloses a discard. §0.3.
- **A per-vendor accumulator in `RunStats` projected onto `WireRun`.** `RunStats` is `core`'s and
  reaches the host only through events, so this collapses into the previous option or into a second
  event field. And it would be a **third** place a per-vendor total is computed, beside `rollup` and
  `vendorTokenTotal`.
- **Render `terminal.cost` / `terminal.tokens`.** They are already on the wire, already typed, and
  already blended. Refused by *"Codex cost is reported as tokens, never priced locally"* (2026-08-22)
  — *never one blended number*.
- **Parse `formatCost`'s sentence out of `done.message`.** Refused three times over: decision 097's
  measurement (4 of 1,080 findings contain the join separator; 1,071 contain `": "`), Q-0015 ground
  rule 2, and the source guard, which forbids the literal `cost=` under `apps/web/src` at all.

### 3.5 What "ticker" cannot mean here, stated rather than discovered later

The design brief says *"per-vendor cost ticker"*. The frozen contract says *"Refresh is the only
repeat read; no timer performs one."* A ticker in the brief's sense — a figure that climbs while you
watch — is available from neither route: the read is a read, and the event route is refused above.

**So what ships is a per-vendor cost as of the last read**, on the same terms every other value on
this screen is already under, with the **"Check again"** control `MetadataRegion` already renders
(`mission-control-status.tsx:90`). It is correct whenever it is shown, never blended, and never
stale-without-saying-so. **The word *ticker* does not survive measurement and is not used for what
ships** — Q-0017's precedent, where *"Run next flow ▸"* and `review 1/3` were each recorded as
measured divergences from the brief rather than approximated.

### 3.6 The cut, and why fifteen criteria are two tickets

Fifteen criteria against `developer-generalist`'s ceiling of fifteen, and against the measured
precedent: Q-0013 refused at eighteen and split in three; Q-0091 and Q-0096 refused at twenty-one;
Q-0126 refused a split at sixteen and paid **$177.92 with a round-1 `blocked`**; Q-0122 accepted
twenty and paid three rounds. **A split is recommended, on disjoint blockers rather than on size:**

| | Half A — the run number (AC-1 … AC-7) | Half B — elapsed and per-vendor cost (AC-8 … AC-15) |
| --- | --- | --- |
| Decision entry | **Owed** — a new union member (GO-1) | None owed |
| Packages | `shared`, `core`, `server`, `web` | `shared`, `web` |
| Nature | A value crosses that did not | A value already served is read and rendered |
| Depends on | Nothing | **Half A strictly** — the history id is `<TICKET>-<n>` |

Half A is independently useful the day it lands: the header shows the run's number and disclosure 1
retires. Half B cannot start before it, and needs none of its rulings.

**Criteria are numbered continuously across the halves** (Q-0106's precedent), so a criterion keeps
its name if the gate moves the cut. **If the gate refuses the split**, the remedy is named in advance
rather than left to a fourth round (Q-0122 erratum E-1's discipline): trim **AC-7** and **AC-15**,
which are register and copy-contract obligations that a gate can rule directly; **AC-1, AC-3, AC-11
and AC-12 are not eligible for trimming** — the first two are the mechanism, and the second two are
the two places a blended or unlicensed figure could reach a reader.

---

## 4. Acceptance criteria

Each is independently testable and names its surface. *Test:* bounds the instrument, and a reviewer
may find the instrument fails the job that clause gives it and may **not** raise the job — Q-0067
erratum E-1, the fifth instance of which this cut has now paid for.

### Half A — the run number

**AC-1 — the event union gains exactly one member, carrying one field.** `packages/shared/src/events.ts`
declares `startEventSchema` as `{ type: 'start', runId: number }`, `.strict()`, and adds it to
`eventSchema`. It carries **no** timestamp, no sequence number, no flow name, no ticket id and no
stage. `StartEvent` is exported beside its siblings.
*Test:* the schema accepts `{type:'start', runId:7}`; refuses an unknown key including `startedAt`
and `ms`; refuses a missing or non-integer `runId`; `eventSchema` discriminates it from `terminal`.
A source clause asserts the union's member count and fails on a sixteenth field or a second new
member, so a later widening is a visible act.

**AC-2 — `core` emits it once per run, at the site that already holds the value, dry runs included.**
`packages/core/src/engine/engine.ts` emits `{type:'start', runId}` at the existing run-start site,
immediately before the existing `info`. The `info` message is **unchanged** — it is narration for a
human and stays one. The emit is outside the `if (!dry)` guard, because `nextRunId` runs before it.
*Test:* over a mock-adapter run, the first event is `start` and its `runId` equals the number
`runs.log` records for that run; a `--dry` run emits it too; a flow that traverses a backward edge
emits it exactly once; the number matches `context.runId` rather than being recomputed.

**AC-3 — the daemon correlates from the typed field, parses no message, and changes no wire shape.**
`packages/server/src/host.ts`'s `observe` sets `record.runId` on `start` as it already does on
`terminal`. `WireRun`, `wireRunSchema` and `viewOf`'s projection gain **no field**: `runId` is
already `number | null`.
*Test:* start a run against a real port, read `GET /runs/:handle` **before** any terminal event, and
`runId` is a number; `GET /runs` carries the same number for the same row; a refused start still
answers `runId: null`; a source clause asserts `host.ts` contains no `.message` read and no
`gateId` split, which is the rule its own JSDoc states. `packages/shared/src/wire.ts` is unchanged
for this value, asserted by identity rather than by reading.

**AC-4 — mission control's header renders the run number for a live run.**
`apps/web/src/mission-control-status.tsx` reads the number from the `start` event in the socket
snapshot — the same discipline it already applies to `terminal`, and **not** from the metadata read.
`data-run-identity` renders `Run <n>` from the first event onward and `Run <handle>` only where no
`start` has been observed (a late joiner whose replay dropped it, or a connection that has carried
no events yet).
*Test:* a snapshot carrying a `start` renders the number; one carrying neither renders the handle; a
snapshot carrying `start` **and** `terminal` renders one number and not two; the handle case and the
number case are distinguished by an assertion that fails if either branch is deleted.

**AC-5 — disclosure 1 retires only where the value is present.** `MISSION_CONTROL_DISCLOSURES[0]` is
rewritten to say what is true after this change, and rendered only where no number has been observed
— the conditional-retirement idiom the file already carries and whose reasoning its own comment
records (*"leaving the sentence would show the number and explain that there is none"*).
*Test:* with a `start` observed, the sentence is absent and the number present; with none, the
sentence is present and the number absent; **both states are asserted**, so a disclosure deleted
outright fails.

**AC-6 — no prose is parsed, and the source guard is untouched.** The six `MESSAGE_PARSE_NEEDLES`
are unchanged and `apps/web/src` still contains none of them. No file under `apps/web/src` contains
the literal `run #`, nor any expression that extracts a number from an `info` message.
*Test:* the existing needle scan passes unmodified, with its needle count still asserted at six; a
new clause forbids `run #` under `apps/web/src` and is shown red over a fixture that parses it.

**AC-7 — `RUN_EVENT_RETENTION` is not moved, and what would license moving it is stated.** The
constant stays **500**. Its JSDoc records the measurement now available and the measurement still
missing: Q-0015's demonstration produced **10 events, peak 3 concurrent columns** and was a `--dry`
walk, which invokes no adapter and so emits no `stdout`; this repository's 165 recorded runs have a
median of 4 occurrences, p90 10 and a maximum of 55, which is ≈275 non-`stdout` events before a
single line of vendor output; and `output.txt` **cannot** supply the missing figure, being the
adapter's final message rather than the stdout stream (`claude.ts` runs `--output-format json`;
`codex.ts` streams JSONL one event per line).
*Test:* a source clause pins the constant's value **and** that its JSDoc names both the dry-walk
datum and the absence of a real-traffic one, so a later change that moves the number without
evidence fails by name. **No criterion here changes the bound**; the ticket body's instruction —
*"revisit the figure only with that evidence"* — is honoured by not revisiting it.

### Half B — elapsed and per-vendor cost

**AC-8 — one wire schema for the history detail, declared in `packages/shared`.** `apps/web` declares
no wire shape of its own (Q-0127 AC-7), so `packages/shared/src/wire.ts` gains `WireRunHistory` over
the subset this screen reads — `started_at`, `status`, `rollup[]` as
`{vendor, cost_usd, unpriced_steps, step_count}`, and `tokensByVendor` — with the **loose**
disposition rather than `.strict()`. That is the landed rule and not a concession: `events.ts`
erratum E-3 draws the line by the direction the data travels, and a schema over a **file** preserves
unknown keys where one over a value Quorum constructs in memory rejects them. The manifest is a file,
`readRun`'s own JSDoc calls the parsed document *"a cast, never a check"*, and a browser that refused
a manifest carrying a key it did not know would fail on a document this product itself wrote.
*Test:* the schema accepts a real manifest read from `.quorum/runs/`; accepts one carrying an
unknown key; **refuses** a `rollup` that is not an array and one whose elements are not objects with
a string `vendor` — which is the guard `read.ts` needed two review rounds to get right, so it is met
here rather than rediscovered; `cost_usd` is nullable and `unpriced_steps` non-negative.

**AC-9 — the browser forms the history id from what it already holds, and nothing polls.** The
screen composes `<ticketId>-<runId>` from the loaded `WireRun` and reads
`GET /history/<id>` through `requestJson` and the AC-8 schema, adding `historyDetailPath` beside the
existing `ticketDetailPath` and `runDetailPath` helpers. **One read on mount and one per explicit
refresh**; no timer, no interval, no `setTimeout` on this path.
*Test:* the read happens once on mount and once per "Check again"; a source clause forbids
`setInterval` and `setTimeout` under `apps/web/src` on this path and is shown red over a fixture; the
id is composed from `ticketId` and `runId` and **never** from the handle; where either is absent no
read is issued at all.

**AC-10 — elapsed is rendered from the run's own start time, against an injected clock, and says
whose clock it is.** Elapsed is `browser now − manifest.started_at`, using the existing injectable
`Clock` (`daemon-client.ts`), never `Date.now()` reached for directly, and never an event timestamp.
The rendering names the clock it used, because the daemon's clock and the browser's can disagree and
a reader will act on the figure.
*Test:* with an injected clock the rendered value is exact and the assertion's verdict is a property
of the commit rather than of the machine — *"A test's verdict is a property of the commit"*
(2026-08-30); a source clause asserts no file under `apps/web/src` reaches `Date.now()` or a bare
`new Date()` on this path; a fixture whose `started_at` is in the future does not render a negative
elapsed.

**AC-11 — per-vendor cost is one row per vendor, and is never summed across them.** The header
renders one entry per `rollup` row: the vendor label, `cost_usd` where it is a number, and where it
is `null` the vendor's `tokensByVendor` total with the fact that it is **unpriced and not free**.
`unpriced_steps` is disclosed where it is non-zero, so a row that is partly priced says how much of
itself it cannot see. **No total across vendors is rendered anywhere**, and `terminal.cost` and
`terminal.tokens` are not read by this screen.
*Test:* a two-vendor fixture — one priced, one `cost_usd: null` — renders two entries and no third;
an assertion fails if any rendered figure equals the sum of two rows' `cost_usd`; a source clause
forbids `apps/web/src` reading `terminal.cost` or `terminal.tokens`; an all-unpriced fixture renders
**no `$0.00` anywhere**, which is the `n/a`-never-`0` rule every measure in this product is under.

**AC-12 — the count register moves by exactly one row, deliberately.** `tokensByVendor` leaves
`source.test.ts`'s `COUNT_FIELDS`, with the reason recorded in place: it is the one shape in which a
**per-vendor, already-reduced** count reaches this app, computed by `vendorTokenTotal` over one row in
`packages/server`. `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens`
**stay forbidden** — they are the four from which a browser could compose a figure of its own. The
*cost to date* phrase ban is untouched, and neither that phrase nor *cost to date* appears anywhere in
the new copy.
*Test:* the list is asserted by identity at four entries, so a fifth leaving it fails; each remaining
entry is shown to still fire over its own fixture; the phrase half is unchanged and still
discriminating.

**AC-13 — every absent case is named, and none is blank.** Four states are distinguished rather than
collapsed, each with its own sentence: **a dry run**, which allocates a run number and writes no run
history at all (`engine.ts`'s `if (!dry)` guard), so elapsed and cost are unavailable and the reason
is that nothing was recorded rather than that nothing was spent; **a history that could not be read**
(404, 422, or a refused parse), carried through as the read's own failure with its own retry; **a
vendor that reported no price**, which is unpriced and never `$0.00`; and **a run whose number is not
yet known**, where no read is attempted.
*Test:* all four render distinct non-empty prose; none renders a zero, a dash, a spinner or an empty
region — `docs/04-architecture.md`'s rule that *no placeholder is a blank panel, a spinner or a
skeleton*; the dry-run case is asserted **specifically**, since Q-0129's own demonstration was a dry
walk and it is the first case anyone exercising this will meet.

**AC-14 — disclosures 2 and 3 retire only where their values are present.** Both are rewritten and
rendered conditionally on the AC-5 pattern. What replaces each is the **specific** absence from
AC-13, not a general one.
*Test:* for each disclosure, the present and absent states are both asserted; deleting either
sentence outright fails; a state where the value is absent and the sentence is also absent fails.

**AC-15 — `mission-control-text.ts` stays the single copy contract, and no new sentence is composed
in a renderer.** Every sentence this ticket adds or rewrites is an export there, imported by both the
renderer and its tests, and none is approximated from `done.message` or any other event's free text.
The word *ticker* is used for none of it, for §3.5's reason.
*Test:* a source clause asserts no string literal ending in a full stop is rendered from
`mission-control-status.tsx` outside an import from that module; a clause asserts *ticker* appears
nowhere under `apps/web/src`; the disclosure array's length is asserted, so a sentence leaving it is
a visible act.

---

## 5. Non-goals

1. **A running ticker.** §3.5. No timer, no polling, no interval — the frozen contract's rule, and
   changing it is not this ticket's.
2. **Widening `done`, `warn`, `info` or `terminal` with cost, usage or a timestamp.** §3.4 and the
   glossary's **Event** clause. `start` is the one member this ticket adds.
3. **Any timestamp or sequence number on any event.** *"No event gains a timestamp or sequence
   number"* is vocabulary. Elapsed comes from the manifest.
4. **Rendering `terminal.cost` or `terminal.tokens`.** Already on the wire, already blended, refused
   by decision 025.
5. **A blended cost or token total anywhere, for any reason.** Including "total across vendors, shown
   alongside the split".
6. **Per-column cost, token count, model or worktree branch.** The brief's screen 5 names them for the
   trace columns; this ticket is the header. A column's vendor already comes from `spawn`/`retry`.
7. **The other two disclosures.** *"What comes next"* needs a flow step list `GET /flows` does not
   carry; structured tool and reasoning events have no producer and *"The event union is derived from
   what the product emits"* (2026-08-25) governs them. **Five becomes two, not zero.**
8. **Any change to `GET /history/:id`'s response.** It already answers everything needed. A projection
   or a new route would be a second authority.
9. **Q-0018's run-history screen.** This reads one run's manifest for a live header; a history browser
   is that ticket's.
10. **Changing `RUN_EVENT_RETENTION`.** AC-7 states why.
11. **Resume, reconnect or a resume cursor.** Q-0019's.
12. **`.harness/` exposure.** Q-0127 erratum E-1 stands, and nothing here reads a ticket folder.
13. **Any v1 exclusion**: multi-user, remote daemon, cloud sync, plugin marketplace, node canvas,
    eval suites, Gemini adapter, desktop shell.

---

## 6. Open questions

**OQ-1 (BLOCKING) — does a new event-union member owe a decision entry, and does this one land
before the run?** It does owe one, and the reasoning is that decision 097 is explicitly **not**
authority for it: its final paragraph rules that *"a second field on this shape is a new decision"*,
and this is not even a field on that shape — it is a new member. Its own refusal list contains
*"Widen `done` or `warn` structurally instead"*, refused on a correlation ground scoped to the gate
question, which does not bite here. So the entry is owed on its own terms, and by
`docs-and-decisions.md`'s rule that a doc/code conflict is settled by an entry: the union's own
header currently states the conditions under which a member is and is not added, and this adds one.
**Owner: the human, at the gate.** GO-1. `developer-generalist` may not write it, and a run launched
without it reproduces Q-0062's three wasted rounds and Q-0126's round-1 `blocked`.

**OQ-2 — is the glossary's Event clause touched?** Measured: **no.** *"No event gains a timestamp or
sequence number, and only the terminal event carries run identity."* The first half is untouched, and
the second half is about **the terminal event carrying run identity** — which stays true; what
changes is that it is no longer the *only* one. That is a clause the OQ-1 entry must name and narrow
by one word, and it is one sentence in `docs/GLOSSARY.md` rather than a new term. **No new term is
coined and none is owed** — *elapsed*, *run number* and *per-vendor cost* are all ordinary English
for values this product already has, and coining one would be a synonym for a measure the manifest
already names. **Owner: the gate, in the OQ-1 entry.**

**OQ-3 — split or one ticket?** §3.6 recommends the split on disjoint blockers and names the trim
order if it is refused. **Owner: the gate.**

**OQ-4 — does elapsed use the daemon's clock or the browser's, and is the skew worth closing?**
Recommended: the browser's, against the manifest's `started_at`, with the rendering naming it — one
clock reading, no round trip, and the skew on a loopback daemon is a machine's own clock against
itself. The alternative, carrying the daemon's `now` on each response so the browser can compute an
offset, buys accuracy this screen does not need and adds a field to a response `core` writes.
**Owner: the gate. Not blocking** — AC-10 is satisfiable either way and states the disclosure
obligation that makes either honest.

**OQ-5 — should the run number appear on the `/runs` listing rows too?** `GET /runs` will carry it
for every live run the moment AC-3 lands, and `runs-screen.tsx` renders handle, flow, state and
pending-gate count. **Stated rather than asked** (Q-0105's remedy): **yes, and it is out of scope
here** — the listing is a different screen with its own contract clause, and widening this ticket to
it is how fifteen criteria become eighteen. Recorded so the next reader does not re-derive it.

**OQ-6 — `manifest.ts` says `RunManifest` has *"exactly thirteen keys"* and decision 097 says
`run-manifest-v1` is *"frozen at fifteen required keys"*.** Counted from the interface: thirteen. The
frozen contract may require a different set, or one of the two prose figures is wrong. **Observation,
not a finding about this change** — nothing here edits the manifest or its schema, and AC-8 reads
three of its keys whatever the total. Recorded so it is not mistaken for a defect this ticket
introduced, and routed to whoever next opens `contracts/Q-0011/run-manifest.schema.json`.

---

## 7. Risks

**R-1 — the review diff will be truncated, and the files at risk are nameable in advance.** The last
four tickets on this surface were each reviewed at a fraction of their change: Q-0129 at
78.9% → 76.3% → 73.1% → **70.2%** with the omitted set growing 10 → 15 as the branch did, and
`packages/shared/src/events.ts` — the file that ticket existed to change — among the files **no**
review ever received a patch for. This ticket touches the same file. `git diff` orders by path, so
the head cut hides the same alphabetical tail every time, and `repo.max_diff_bytes` is read at run
start so no mid-run change reaches the run it would help. **Mitigation:** Q-0124's warn names the
omitted files on the event stream, and Q-0117's `observation:` channel is where a reviewer reports
having read them from the branch — a pair that composed on Q-0016, Q-0129 and Q-0130 and is now a
mechanism rather than a coincidence. **GO-5** makes the hand pass over the omitted tail an
obligation rather than a hope. **Q-0128** is the ticket; this is not it.

**R-2 — the implementer walks into the class the criterion forbids.** Q-0059 predicted its own path-escape
class in the ticket body and the implementer walked into it three times anyway; Q-0122 named its
confinement criterion as not eligible for trimming and both review blockers landed on exactly it. The
analogue here is **AC-11**: the temptation to render one total is strong precisely because
`terminal.cost` is already a typed number on the wire. That criterion is named as not eligible for
trimming, and its test asserts the sum is **not** rendered rather than that the split is.

**R-3 — half B's read makes the screen's failure surface wider.** Mission control already renders two
independent failure accounts (socket, metadata). A third read means a third. **Mitigation:** AC-13
requires four distinguished states and the existing `RequestState` vocabulary is closed at five and
stays closed; AC-9 keeps the read to one-on-mount-plus-refresh, so it cannot fail repeatedly on its
own.

**R-4 — a browser that never sees the `start` event.** A late joiner whose 500-event replay has
evicted the head, or a daemon whose retention is configured to zero, holds no `start`. **Mitigation:**
AC-4 renders the handle in that case, which is exactly what it renders today, and AC-5 keeps the
disclosure for it. No state gets worse than it is now. Half B then attempts no read, which AC-13
covers.

**R-5 — the `--dry` case is the first one anyone tests and the one with the least on disk.** Q-0129's
demonstration was a dry walk; so will the next one be. A dry run has a run number and **no run
history at all**. AC-13 names it specifically for that reason.

**R-6 — a criterion naming `contracts/`.** §0.4(a). This document names it in **no** criterion, and
GO-2 is where the contract moves. A reviewer asking for a criterion that edits it is asking for the
thing that returned `blocked` on Q-0129 and it should be refused with this paragraph.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a and preserved. No code path, test or example here touches a key; the vendor labels rendered are `rollup[].vendor` strings, never credentials. `check()` is untouched. |
| **Worktree safety** | n/a. Nothing here writes to a working tree. `core`'s one change is an `emit`. |
| **Gate behaviour** | Unchanged. `gateAnswerSchema` stays the closed three; nothing here answers, offers or affects a gate. The gate link on this header is Q-0015's and is not moved. |
| **File format and schema** | `.quorum/runs/*/manifest.json` is **read and never written** by anything here; `run-manifest-v1` is untouched; `contracts/Q-0011/` is untouched. The two schema changes are `startEventSchema` (AC-1) and `WireRunHistory` (AC-8), both in `packages/shared`, both executable in a browser. |
| **Lint rules** | No flow file changes, so `lintFlow` is untouched and `quorum lint` 6/6 is expected unchanged. |
| **Cold-clone impact** | None on install or first-run time. The screen does one more read per mount for a run that has a number. No new dependency — `diff2html` and friends are Q-0134's, not this. |
| **Write boundary** | **Unchanged.** `apps/web`'s two write-capable modules and `WRITE_RULES` are untouched: everything here is a `GET` or a render. The guard that forbids a third writer stays as it is, which is worth asserting rather than assuming. |
| **Product-agnostic** | Nothing here names a SaaS product. Vendor labels come from data, not from a literal. |
| **Errors explicit** | AC-8's schema refuses a damaged roll-up rather than throwing inside a `.map`; AC-13 requires four named absences and forbids a blank. |

---

## 9. Gate obligations

**GO-1 (blocking) — the decision entry for OQ-1 lands before the implement step, and is verified
present in that step's prompt.** Not assumed: `grep` it in
`.quorum/runs/Q-0131-<n>/steps/001-implement/prompt.txt` and record the count, which is the check
Q-0097 lost two errata by not making and which Q-0125, Q-0129 and Q-0115 each performed. The entry
should record the refusals in §3.4 with their measurements, for decision 097's own stated reason —
so the next ticket on this surface cannot re-derive them.

**GO-2 — `contracts/Q-0015/mission-control.contract.md` gains its superseded-by note, written by
hand at the gate.** Two clauses move: *"the five absent capabilities"* becomes two, and *"The run
number is read from the terminal event in the socket snapshot"* becomes the start event. A landed
contract is not edited away — the note names what supersedes what, as Q-0129's did for
`contracts/Q-0050/run-events.contract.md`. **No criterion may name this file.**

**GO-3 — `docs/04-architecture.md` and `docs/06-development-plan.md` record what shipped**, including
that the union has a `start` member and that mission control names two absent capabilities rather
than five. `docs/` **is** writable by the role, so this is a criterion's subject if the gate prefers;
it is listed here because the plan entry is written by hand at the close either way.

**GO-4 — the product is run by hand and the demonstration is transcribed, not paraphrased.** A real
daemon from `quorum open`, a run started **through the daemon** (a `quorum run` is a different
process the host can never see — Q-0121's measurement), mission control opened in a browser while it
is running, and the transcript recording: the run number rendered **while `state` is `running`**, the
elapsed figure and the per-vendor split with at least one **unpriced** vendor in it, and the dry-run
case rendering its own sentence rather than a zero. **This obligation is written to be unfakeable**
because its predecessor was not: Q-0016's GO-6 was reported discharged when its by-hand half had not
been performed, and Q-0015's gate found it a day later. Record the request that produced the run, as
Q-0129's `runs.log` does.

**GO-5 — the omitted tail of every truncated review is read by hand, cross-vendor.** R-1 names
`packages/shared/src/events.ts` and `wire.ts` as the files most likely behind the cut, and they are
this ticket's subject. Record the truncation ratio and the omitted file set per round, as Q-0129 and
Q-0130 did, so **Q-0128** accumulates evidence rather than impressions.

**GO-6 — verified forced in both environment rows**: a worktree with neither `.harness/worktrees` nor
`.quorum/runs`, and `main` after the merge, `--force` in each, plus `quorum lint` and the
git-identity sweep. Q-0072's closing finding, and this ticket **reads `.quorum/runs/`**, which is a
directory a fresh checkout does not have — so a test whose fixture is the repository's own run
history would have a verdict that is a property of the checkout, which AC-8's test must avoid by
building its own fixture.

---

## Appendix A — measurements, for the successor that is told not to re-derive them

Taken at `a7e3f50`. Each is a fact about that tree and will rot; re-measure before relying on one.

1. **The engine emits the run number as the first event of every run**, in prose, at
   `packages/core/src/engine/engine.ts:340`. `runId` is allocated before the `dry` branch, so a dry
   run has one.
2. **`RunStats` is `{cost, tokens, unpriced}`** — no vendor split anywhere in the engine's run
   context. The per-vendor split exists only in the manifest's `rollup`.
3. **`runTerminalEventSchema` already carries `cost: number` and `tokens: number`** — blended, and
   therefore unrenderable on this screen.
4. **The manifest is created at run start with `started_at` and `rollup: []`**, and the roll-up is
   recomputed in full on every terminal occurrence, each replacing the manifest atomically. Both
   values are live on disk.
5. **`VendorRollup` is `{vendor, step_count, unpriced_steps}` plus the five `USAGE_MEASURES`**, with a
   measure nobody reported staying `null` rather than accumulating from `0`.
6. **`GET /history/:id` answers `{id, manifest, incomplete, tokensByVendor, steps}`**, where
   `tokensByVendor` is `vendorTokenTotal` per row and deliberately not summed across rows.
7. **A dry run writes no run history**: `engine.ts`'s `if (!dry)` guards `initialiseRunHistory`.
8. **`formatCost` has exactly one emission site**, `steps.ts:382`, the `done` event's `message`.
   `done` has three emitters — the agent step, the script step (`exit 0`) and `integrate` — and only
   the first has usage.
9. **`stdout` is one event per line** from both adapters. `output.txt` in run history is the
   adapter's **final message**, not the stdout stream, so **run history cannot supply a real run's
   event count**.
10. **165 recorded runs: median 4 occurrences, p90 10, max 55, mean 5.44.**
11. **Q-0015's AC-9 datum was a `--dry` walk**: 10 events, 0 missed, peak 3 columns; `info 6, step 3,
    terminal 1`. It licenses no revision of the 500 bound and its own `runs.log` says so.
12. **`contracts` is not among `developer-generalist`'s fourteen write paths.**
13. **`source.test.ts` forbids six parse needles** (bare `cost=`, bare `verdict=`, `role=` behind four
    delimiters) **and five count fields** (`tokensByVendor`, `vendorTokenTotal`, `input_tokens`,
    `output_tokens`, `cached_input_tokens`) **and the phrase *cost to date***, each half with its own
    discriminating fixture. `cost_usd` is on none of these lists.
14. **`apps/web` already has an injectable `Clock`** (`() => string`, `isoClock`), threaded through
    every fetch and recorded as `fetchedAt` on a loaded `RequestState`.
15. **`DAEMON_ENDPOINTS.history` is `'/history'`** and there is no detail-path helper beside
    `ticketDetailPath` and `runDetailPath`.
