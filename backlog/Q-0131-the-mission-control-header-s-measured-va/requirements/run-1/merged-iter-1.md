# Q-0131 — The mission control header's measured values

*Merged requirement, run 1, iteration 1. Measured against tip `a7e3f50` (`chore(backlog): Q-0131 re-measured after Q-0129`).*

**Verdict: needs-input.** Two blockers, both gate rulings no step in this flow may perform: the run-number transport, which decides whether a decision entry is owed at all (§6 OQ-1), and the size (§3.6, §6 OQ-3). Everything else is settled below.

---

## 0. What was measured

The ticket body says twice, in its own words, **"do not re-derive this ticket's figures from its body either"**, and its last section says the same of Q-0129's. Every figure below was taken from the tree at the stated tip. The two candidates disagree on facts and not only on judgement, so each decisive claim was checked rather than adjudicated on plausibility.

### 0.1 The run number is already on the stream, in prose, at a site that already holds it

`packages/core/src/engine/engine.ts:340`, inside the run `try`, as **the first event of every run**:

```ts
emit({ type: 'info', message: `run #${runId}  flow=${flow.name}  ticket=${ticket.meta.id}  ${flow.consumes} → ${flow.produces}` });
```

`runId` is allocated at `:228` (`nextRunId(ticket)`), **before** the `if (!dry)` guard at `:342`. So the number exists from run start, the engine already emits it at run start, and it already stringifies it there.

That is verbatim the situation *"A gate question carries the decision that reached it"* (2026-09-17) describes: a structured value the engine already holds, crossing only inside a sentence composed for a human. The body treats the live run number as a `core` correlation problem still to be solved. Measured, it is **one interpolation away from being a typed value**, at a site that already runs on every run including a dry one.

`WireRun.runId` being `null` for a live run holds (`packages/shared/src/wire.ts:151`, `packages/server/src/host.ts:107`). What neither candidate said is *why*, and it is the fact that shapes AC-3: `host.ts:296`'s JSDoc already refuses the alternative in as many words — *"The terminal event is the only event carrying run identity, and its `runId` is a typed field."* **The host is already written to accept a typed field and to refuse the prose.**

### 0.2 Elapsed and per-vendor cost already exist on disk, live, correct and unblended

`packages/core/src/run-history/writer.ts:502–507` creates `manifest.json` **at run start** with `started_at`, `status: 'running'` and `rollup: []`. `manifest.rollup = rollup(manifest.steps)` is recomputed inside `terminal()` (`:594`) — the funnel every occurrence passes through — and again in `finalise()` (`:621`), each followed by `replaceManifest()`.

So for any non-dry run, **while it is running**, `.quorum/runs/<TICKET>-<n>/manifest.json` holds:

- **`started_at`** — `core`'s own clock at run start, and the same instant `finalise` computes `duration_ms` against. Elapsed's source.
- **`rollup: VendorRollup[]`** — `{vendor, step_count, unpriced_steps}` plus the five measures (`manifest.ts:85–92`), grouped on *"the exact `usage.vendor` string, never normalised or mapped"*, with `unpriced_steps` present so a row *"can say how much of itself it cannot see"*. Per-vendor cost's source, already in the shape *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) requires.

`GET /history/:id` already serves both (`packages/server/src/read.ts:390–429`), plus `incomplete` and `tokensByVendor` — the latter `vendorTokenTotal` applied **one row at a time**, the route's own comment recording that summing across rows *"would compose exactly the figure that entry refuses"*.

**Nothing has to be computed for the cost half.** What blocks a browser from reading it is one thing: a history id is `<TICKET>-<n>`, and a live run supplies no `n`. Decision 097 refused *"read it from run history"* for the verdict on exactly that ground — identity — and on a second ground, that `run-manifest-v1` is frozen so `findings` and `summary` could not travel there, which **does not apply here** because `rollup` and `started_at` are the manifest's own keys.

**So the three values are one mechanism, not three, and the run number is the key to the other two.**

### 0.3 A structured cost field on `done` was measured and is worse than the read

`engine.ts:256` — the run-level accumulator is `const stats: RunStats = { cost: 0, tokens: 0, unpriced: 0 }`. **There is no vendor split in it.** So "the engine already holds it" is false at run level and true only per occurrence, at `steps.ts:382`, which is `formatCost`'s single emission site.

Widening `done` hands the browser an accumulation it cannot perform correctly:

- `apps/web/src/run-connection.ts:28` — `RUN_EVENT_RETENTION = 500`, **evicting from the head** (`:168–169`).
- Measured over this repository's **165** recorded runs: median **4** occurrences, p90 **11**, max **55**, mean 5.44, 898 total. An adapter occurrence emits `spawn` + `step` + `done` and usually an `info`, so the largest run here is ≈275 events **before a single line of vendor output**.
- `stdout` is **one event per line** from both adapters (`claude.ts:118` through `exec`'s `onLine`, `codex.ts:126` per JSONL line).

A browser accumulating from events it has evicted **under-reports silently, exactly when the screen discloses that it discarded events.** Candidate-codex's own AC-13 concedes this and answers it by labelling the ticker incomplete — which is to ship a figure known to be wrong beside a sentence admitting it. The read has none of that: the roll-up is computed in `core` over every occurrence the run ever had, whatever the browser saw. It would also be a **third** site computing a per-vendor total, beside `rollup` and `vendorTokenTotal`.

### 0.4 The elapsed disagreement, ruled on what the frozen contract actually bounds

`contracts/Q-0015/mission-control.contract.md:9` — *"Refresh is the only repeat read; no timer performs one."*

That clause bounds **reads**. A display advancing from a `started_at` the browser already holds performs no read, so it does not engage the clause. Candidate-claude read it as forbidding timers outright and specified a cost-and-elapsed figure fixed until the next refresh; candidate-codex specified a live elapsed advancing at least once per second, with formatting and a clamp.

**Codex is right on elapsed and claude is right on cost**, and they are different cases because one needs a repeat read and the other does not. A frozen elapsed figure is also the weaker product on this repository's own terms: `elapsed 14:32` rendered against a run that started twenty minutes ago is a value that goes false the moment it is shown, which is what *"no placeholder shows a value nobody measured"* exists to prevent. The timer is therefore required, and what is forbidden is a **fetch** on one.

### 0.5 Candidate-codex's central measurement is false, and the way it is false is the class this repository records most

Codex states, and rests its AC-16, its OQ-3 and one risk on: *"The repository does not contain the Q-0015 verification product… Searches find the obligation repeatedly, but no recorded figures."*

Measured — `backlog/Q-0015-mission-control-streams-a-run-live-one-t/runs.log:177`:

```
events 10 · missed 0 · peak concurrent columns 3
```

and at `:180–183`, in that file's own words, *"this was a `--dry` walk"* and the bound of *"500 remains unmeasured against real traffic"*.

The conclusion codex reached — retention does not move — is correct. The route to it is a failed search read as proven absence, which is Q-0074's class, and it would have shipped a criterion (its AC-16) requiring verification to *"record that the evidence was searched for and not found"* about evidence that is in the repository. The figures are stated correctly in AC-7 below.

### 0.6 The two hard constraints, one of which candidate-codex does not carry

**(a) `contracts/` is not writable by this flow's role, and this ticket contradicts a frozen contract.** `harness/roles/developer-generalist.md:3` lists fourteen roots and **`contracts` is not among them**. `contracts/Q-0015/mission-control.contract.md:63` says mission control names *"the five absent capabilities"* including live run number, elapsed and structured cost, and `:88` names *"structured header values as successor work"* — this ticket. Retiring three of the five contradicts it. Q-0129's round 1 returned `blocked` on exactly this, and its entry records that the merged requirement *"cites that rule by name… and then names `contracts/` one criterion later"*. **No criterion below names `contracts/`.** It is **GO-2**.

**(b) The literal `cost=` is already forbidden under `apps/web/src`.** `apps/web/test/source.test.ts:67–70` scans the complete corpus for six `MESSAGE_PARSE_NEEDLES` — bare `cost=`, bare `verdict=`, and `role=` behind four delimiters — with the count frozen at six (`:77`). This forecloses every prose-parsing shape at the source level rather than by argument, beside decision 097's own measurement (4 of 1,080 findings contain the join separator; 1,071 contain `": "`) and Q-0015's ground rule 2.

### 0.7 The count register moves by exactly one row, and the four that stay are the load-bearing ones

`source.test.ts:677` — `COUNT_FIELDS = ['tokensByVendor', 'vendorTokenTotal', 'input_tokens', 'output_tokens', 'cached_input_tokens']`, plus the phrase *cost to date* at `:678`, each half with its own discriminating fixture (`:686–688`).

Under the design below the browser reads per-vendor **cost** from `rollup[].cost_usd` and `rollup[].unpriced_steps` — **neither is on the list**, the guard being about counts and saying so in its own name — and per-vendor **tokens** from `tokensByVendor`, which the daemon has already reduced one row at a time. So exactly **one** row leaves, and `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` stay forbidden: precisely the four from which a browser could compose a blended figure of its own. The guard's reasoning is satisfied rather than routed around, which is what the ticket body asks for.

### 0.8 The failure state for the new read already has its sentence

`apps/web/src/request-state.test.ts:87–88` already renders the `no-such-run` refusal against `DAEMON_ENDPOINTS.history` with the condition `no run history under "T-0001-9"`. `DAEMON_ENDPOINTS.history` is `'/history'` (`daemon-endpoints.ts:7`), and `requestJson`, an injectable `Clock` (`daemon-client.ts:79,89`) and the `ticketDetailPath`/`runDetailPath` helpers all exist. The dry-run case — which 404s, because `engine.ts:342`'s `if (!dry)` guards `initialiseRunHistory` — lands on copy that is already written and already tested.

---

## 1. Problem

Mission control's header is the hero region of the hero screen, and three of the four things `docs/05-design-prompt.md` screen 5 specifies for it are not there. In their place the screen prints three sentences saying so (`apps/web/src/mission-control-text.ts:27–29`):

> "The run's number is not on the wire until the run ends; its handle identifies it meanwhile."
> "Elapsed time is unavailable because no event has a timestamp and the run has no start time on the wire."
> "Per-vendor cost and token totals are unavailable as structured values; they occur only inside a human-readable message."

Those sentences are correct and were the right thing to ship — `docs/04-architecture.md` forbids a placeholder showing a value nobody measured, and Q-0015 obeyed it. But they describe a **transport gap, not a missing measurement**. The engine computes all three: it emits the run number as the first event of every run and in prose, and it writes the run's start time and a correct per-vendor roll-up to disk at run start, keeping the roll-up current on every occurrence. A maintainer watching a run they are paying for is told three times that the product cannot see figures it has already computed and stored.

The cost of leaving it is not cosmetic. **The run number is the identity of a live run.** Without it a reader cannot join what they are watching to `runs.log`, to `.quorum/runs/`, or to the ticket's own history: the browser shows `Run run-1`, a handle the daemon's own JSDoc calls meaningless across a restart. And per-vendor cost is the figure this product exists to keep honest — the one cost number that *does* cross the wire today, `terminal.cost`, is the blended figure *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) refuses, so the only cost value currently available to this screen is one it may not render.

---

## 2. User stories

**`maintainer` — the run number.** *As the solo maintainer watching a run I started from the ticket page, I want the header to show the run's own number while it is running, so that the screen in front of me and the `runs.log` line, run directory and ticket history I will read afterwards are about a run I can name — rather than a handle that means nothing five minutes after the daemon restarts.*

**`maintainer` — elapsed.** *As the solo maintainer deciding whether a step has hung or is merely slow, I want to see how long this run has been going and to watch it advance, so that I can tell a six-minute fan-out from a stuck adapter without going to a terminal — and I want the figure to stop when the run stops, because a clock still running after the run ended is a lie about the run.*

**`maintainer` — per-vendor cost.** *As the solo maintainer who has spent $2,800 developing this product through it, I want the header to show what this run has cost so far, split by vendor and never blended, so that I can stop a run that is running away — and I want an unpriced vendor to read as unpriced and never as free, because 41.5% of the billed occurrences here are.*

**`adopter` — the same three, as a trust signal.** *As a stranger on my first run, I want the screen to show what the product knows rather than three explanations of what it cannot see, so that my first impression of mission control is a run I can read.*

**Surfaces touched:** `packages/shared` (the event union or an options type, one wire schema), `packages/core` (one supply site), `packages/server` (one correlation), `apps/web` (the header and one read). **No flow file, no role, no adapter, no `backlog/`, no `contracts/`, no persisted format.**

---

## 3. The design the measurements select

### 3.1 The mechanism, in one paragraph

The run number crosses from `core` to the daemon as a **typed value supplied once per run at the site that already holds it** (§0.1), and the host correlates `record.runId` from it exactly as it already does from `terminal` — so **no wire shape changes**, `WireRun.runId` having been `number | null` since Q-0121. Mission control then renders the number for a live run and, holding `ticketId` and `runId`, composes `<TICKET>-<n>` and reads `GET /history/:id` for the run's `started_at` and its per-vendor roll-up. Elapsed advances locally from that start instant against an injected clock and freezes when the run ends. **One value crosses; two more become reads of something that already exists.** Nothing is computed twice and no figure is invented anywhere.

### 3.2 The recommended transport, and the alternative the gate must rule against it

**Recommended: one new discriminated member, `start`, carrying `runId` and nothing else.** `info` is run-level narration with many producers, so an optional `runId` on it would be absent on almost every instance — the *"beginning of a family"* decision 097's final paragraph warns against, and a shape in which a reader cannot tell "this `info` has no run number" from "this `info` is not the run-start one". A `start` member has exactly one producer at exactly one site, fires exactly once per run, mirrors `terminal` — the union's existing precedent for a member carrying run identity — and reaches the browser **in band**, so the number appears without the user pressing anything, which is what `contracts/Q-0015`'s *"read from the socket snapshot, never from a second metadata read"* points at. `events.ts:31–33` states the cost direction in its own words: *"Widening a discriminated union later is additive and every non-exhaustive consumer fails at `tsc`."* That sentence was written about `tool` and `text`, members refused because **no producer exists**; here the producer exists and already emits at that site, so *"The event union is derived from what the product emits"* (2026-08-25) is executed rather than contradicted.

**The alternative neither candidate measured, and it is why OQ-1 is blocking:** an out-of-band callback in `runFlow`'s options — the shape `answerGate` already uses — hands the host the number with **no event-union change at all**, and therefore **no decision entry, no narrowing of the GLOSSARY's Event clause, and no narrowing of `host.ts:296`'s JSDoc**. The browser would then read the number from the metadata request mission control already performs, rather than from the socket. It is cheaper by a whole gate obligation and slightly worse product: a browser mounting before the host has been called back renders the handle until the next refresh, where the in-band route delivers the number as the first event.

Candidate-claude specified the member and did not weigh the callback; candidate-codex named "a non-event engine interface" as one of three options and measured none of them. **The gate rules between exactly these two**, and its answer decides whether an entry is owed. AC-1 and AC-2 are written against the recommendation and are the two criteria that move if the gate rules otherwise; nothing else in this document depends on the choice.

### 3.3 Minimal payload

`terminal` carries six fields; this carries one. Everything else the brief's header names — flow, ticket id, stage — is already on `WireRun` from the start request the daemon itself composed, so a second copy on the stream would be a second authority for a value the transport already has. **The one value nobody downstream can derive is the run number.**

**It carries no timestamp**, and that is not a preference: `docs/GLOSSARY.md`'s **Event** entry says *"No event gains a timestamp or sequence number"*, which is vocabulary rather than an entry, and elapsed does not need one because the manifest already has `started_at`.

### 3.4 Why cost is a read, with each refusal and its measurement

Recorded here so the next ticket on this surface does not re-derive them, which is decision 097's own stated reason for doing it:

- **A structured per-vendor field on `done`.** Refused: the browser would accumulate over a head-evicting 500-event buffer, and `stdout` is one event per line. §0.3.
- **A per-vendor accumulator in `RunStats` projected onto `WireRun`.** Refused: `RunStats` is `core`'s and reaches the host only through events, so it collapses into the option above; and it would be a third site computing a per-vendor total.
- **Render `terminal.cost` / `terminal.tokens`.** Refused: already on the wire, already typed, already blended — *"Codex cost is reported as tokens, never priced locally"* (2026-08-22), *never one blended number*.
- **Parse `formatCost`'s sentence out of `done.message`.** Refused three times over: decision 097's measurement, Q-0015 ground rule 2, and the source guard, which forbids the literal `cost=` under `apps/web/src` at all. §0.6(b).

### 3.5 What "ticker" cannot mean here, and what does

The brief says *"per-vendor cost ticker"*. Cost is available only by a read, and the frozen contract's *"Refresh is the only repeat read"* forbids polling for one — so **per-vendor cost ships as of the last read**, on the same terms every other value on this screen is already under, with the existing **"Check again"** control. The word *ticker* does not survive measurement and is not used for what ships, on Q-0017's precedent, where *"Run next flow ▸"* and `review 1/3` were each recorded as measured divergences from the brief rather than approximated.

**Elapsed is the exception and advances**, because it needs no read (§0.4). That asymmetry is deliberate, is stated here rather than discovered in review, and is what AC-9 and AC-10 pin from opposite sides: no fetch on a timer, and a display that advances.

### 3.6 The cut, and why fifteen criteria are two tickets

Fifteen is at `developer-generalist`'s ceiling and at the measured precedent's edge: Q-0013 was refused at eighteen and split in three, Q-0091 and Q-0096 at twenty-one, Q-0126 refused a split at sixteen and paid **$177.92 with a round-1 `blocked`**, Q-0122 accepted twenty and paid three implement rounds. **A split is recommended, on disjoint blockers rather than on size:**

| | **Half A — the run number** (AC-1 … AC-7) | **Half B — elapsed and per-vendor cost** (AC-8 … AC-15) |
| --- | --- | --- |
| Decision entry | **Possibly owed** — OQ-1, and it is the whole of that question | **None owed**, under any ruling |
| Packages | `shared`, `core`, `server`, `web` | `shared`, `web` |
| Nature | A value crosses that did not | A value already served is read and rendered |
| Frozen-contract clauses moved | 1 (the run-number sentence) | 1 (the five-to-two count) |
| Depends on | Nothing | **Half A strictly** — the history id is `<TICKET>-<n>` |

Half A is independently useful the day it lands: the header shows the run's number and disclosure 1 retires. Half B cannot start before it and needs none of its rulings — which is the strongest form of seam this repository recognises, the one Q-0129 was split on.

**Criteria are numbered continuously across the halves** (Q-0106's precedent), so a criterion keeps its name if the gate moves the cut. **If the gate refuses the split**, the remedy is named in advance rather than left to a fourth implement round (Q-0122 erratum E-1's discipline): trim **AC-7** and **AC-15**, which are register and copy-contract obligations a gate can rule directly. **AC-1, AC-3, AC-11 and AC-13 are not eligible for trimming** — the first two are the mechanism, and the last two are the two places a blended figure or a fabricated zero could reach a reader.

---

## 4. Acceptance criteria

Each is independently testable and names its surface. *Test:* bounds the instrument: a reviewer may find the instrument fails the job that clause gives it and may **not** raise the job — Q-0067 erratum E-1, the fifth instance of which this cut has paid for.

### Half A — the run number

**AC-1 — the run number crosses as a typed value, carrying exactly one field.** Under the recommended ruling, `packages/shared/src/events.ts` declares `startEventSchema` as `{ type: 'start', runId: number }`, `.strict()`, added to `eventSchema`, with `StartEvent` exported beside its siblings. It carries **no** timestamp, sequence number, flow name, ticket id or stage.
*Test:* the schema accepts `{type:'start', runId:7}`; refuses an unknown key including `startedAt` and `ms`; refuses a missing or non-integer `runId`; `eventSchema` discriminates it from `terminal`. A source clause asserts the union's member count, so a second new member is a visible act. **If the gate rules the out-of-band alternative (OQ-1), this criterion instead pins the typed option field and its single supply site, and the union is asserted unchanged.**

**AC-2 — `core` supplies it once per run, at the site that already holds the value, dry runs included.** `packages/core/src/engine/engine.ts` supplies it at the existing run-start site, immediately before the existing `info`. **The `info` message is unchanged** — it is narration for a human and stays one, so every existing non-browser reader of `runs.log` and the trace is untouched. The supply is outside the `if (!dry)` guard, `nextRunId` running before it.
*Test:* over a mock-adapter run the run number reaches the consumer before any step event, and equals the number `runs.log` records for that run; a `--dry` run supplies it too; a flow traversing a backward edge supplies it exactly once; the value is `context.runId` rather than a recomputation. A clause asserts the `info` message's text is unchanged.

**AC-3 — the daemon correlates from the typed value, parses no prose, and no wire shape changes.** `packages/server/src/host.ts` sets `record.runId` from it as it already does on `terminal`. `WireRun`, `wireRunSchema` and `viewOf`'s projection gain **no field**.
*Test:* start a run against a real port, read `GET /runs/:handle` **before any terminal event**, and `runId` is a number; `GET /runs` carries the same number for the same row; the live number and the eventual terminal event's number are equal, and the test fails if they differ; a refused start still answers `runId: null`. A source clause asserts `host.ts` reads no event `message` and splits no `gateId` — the rule its own JSDoc states.

**AC-4 — mission control renders the run number for a live run.** `apps/web/src/mission-control-status.tsx` renders `Run <n>` from the moment the number is observed and `Run <handle>` only where none has been (a late joiner whose replay dropped it, or a connection carrying no events yet). The browser never derives a number from a handle, gate id, branch, path or message.
*Test:* a snapshot carrying the number renders it; one carrying none renders the handle; a snapshot carrying both a live number and a terminal event renders one number and not two; both branches are asserted, so deleting either fails.

**AC-5 — disclosure 1 retires only where the value is present.** `MISSION_CONTROL_DISCLOSURES[0]` is rewritten to what is true after this change and rendered only where no number has been observed — the conditional-retirement idiom the file already carries, whose reasoning its own comment records.
*Test:* with a number observed the sentence is absent and the number present; with none the sentence is present and the number absent; **both states are asserted**, so a disclosure deleted outright fails.

**AC-6 — no prose is parsed, and the source guard is extended rather than weakened.** The six `MESSAGE_PARSE_NEEDLES` are unchanged and `apps/web/src` still contains none of them. No file under `apps/web/src` contains the literal `run #` or any expression extracting a number from an event message.
*Test:* the existing needle scan passes unmodified with its count still asserted at six; a new clause forbids `run #` under `apps/web/src` and is shown red over a fixture that parses it.

**AC-7 — `RUN_EVENT_RETENTION` stays 500, and what would license moving it is recorded.** The constant does not move. Its JSDoc records the datum that exists and the one that does not: Q-0015's demonstration produced **10 events, 0 missed, peak 3 concurrent columns** and **was a `--dry` walk**, which invokes no adapter and so emits no `stdout` (`backlog/Q-0015-*/runs.log:177–183`, which says so itself); this repository's **165** recorded runs have a median of **4** occurrences, p90 **11** and a maximum of **55**, ≈275 non-`stdout` events before a line of vendor output; and run history **cannot** supply the missing figure, `output.txt` being the adapter's final message rather than the stdout stream.
*Test:* a source clause pins the constant's value **and** that its JSDoc names both the dry-walk datum and the absence of a real-traffic one, so a later change moving the number without evidence fails by name. **No criterion here changes the bound**; the body's instruction — *"revisit the figure only with that evidence"* — is honoured by not revisiting it.

### Half B — elapsed and per-vendor cost

**AC-8 — one shared schema for the history detail read.** `apps/web` declares no wire shape of its own (Q-0127 AC-7), so `packages/shared/src/wire.ts` gains a schema over the subset this screen reads — `started_at`, `ended_at`, `status`, `rollup[]` as `{vendor, cost_usd, unpriced_steps, step_count}`, `incomplete`, `tokensByVendor` — with the **loose** disposition rather than `.strict()`. That is the landed rule and not a concession: *"Unknown keys are refused where Quorum owns the key set, and preserved where it does not"* (2026-08-25), and `readRun`'s own JSDoc calls the parsed manifest *"a cast, never a check"*, so a browser refusing a manifest carrying a key it did not know would fail on a document this product itself wrote.
*Test:* the schema accepts a real manifest read from a fixture run directory; accepts one carrying an unknown key; **refuses a `rollup` that is not an array and one whose elements are not objects with a string `vendor`** — the guard `read.ts` needed two review rounds to get right, met here rather than rediscovered; `cost_usd` is nullable, `unpriced_steps` and `step_count` non-negative.

**AC-9 — the browser forms the history id from what it holds, and no fetch happens on a timer.** The screen composes `<ticketId>-<runId>` from the loaded `WireRun` and reads `GET /history/<id>` through the existing `requestJson` and the AC-8 schema, adding one path helper beside `ticketDetailPath` and `runDetailPath` against the existing `DAEMON_ENDPOINTS.history`. **One read on mount and one per explicit refresh.** Where `ticketId` or `runId` is absent, no read is issued at all.
*Test:* the read happens once on mount and once per "Check again"; a source clause asserts **no fetch is reachable from a timer callback** and is shown red over a fixture that polls; the id is composed from `ticketId` and `runId` and never from the handle; the absent case issues no request.

**AC-10 — elapsed is rendered truthfully: it advances, it is formatted, it clamps, and it freezes.** Elapsed is the difference between the browser's clock and the run's `started_at`, taken through the existing injectable `Clock` and never a bare `Date.now()`, and it **advances at least once per second while the run is running**. Under one hour it renders `MM:SS`; at one hour or more, `H:MM:SS`; minutes and seconds zero-padded. A negative difference from a clock adjustment renders `00:00` rather than a negative duration. Once the run has ended the screen renders the fixed difference between the manifest's `ended_at` and `started_at` and **stops advancing**. The rendering names whose clock produced a live figure.
*Test:* against an injected clock, `00:00`, `14:32` and `1:00:00` each render exactly, so the verdict is a property of the commit rather than of the machine — *"A test's verdict is a property of the commit"* (2026-08-30); live advancement is observed and terminal freezing is observed, each failing if the other's behaviour is substituted; a `started_at` in the future renders `00:00`; a source clause asserts no file under `apps/web/src` reaches `Date.now()` or a bare `new Date()` on this path.

**AC-11 — per-vendor cost is one row per vendor, and is never summed across them.** The header renders one entry per `rollup` row, in the roll-up's own order, grouping on the exact vendor label and never branching on a known vendor name: the label, `cost_usd` where it is a number, and where it is `null` that vendor's `tokensByVendor` total with the fact that it is **unpriced and not free**. `unpriced_steps` is disclosed where it is non-zero, so a partly-priced row says how much of itself it cannot see. **No total across vendors is rendered anywhere**, and this screen reads neither `terminal.cost` nor `terminal.tokens`.
*Test:* a two-vendor fixture — one priced, one `cost_usd: null` — renders two entries and no third; an assertion fails if any rendered figure equals the sum of two rows' `cost_usd`; a source clause forbids `apps/web/src` reading `terminal.cost` or `terminal.tokens`; an all-unpriced fixture renders **no `$0.00` anywhere**, which is the `n/a`-never-`0` rule every measure in this product is under.

**AC-12 — the count register moves by exactly one row, deliberately.** `tokensByVendor` leaves `source.test.ts`'s `COUNT_FIELDS` with the reason recorded in place: it is the one shape in which a **per-vendor, already-reduced** count reaches this app, computed by `vendorTokenTotal` over one row inside `packages/server`. `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` **stay forbidden**, being the four from which a browser could compose a figure of its own. The *cost to date* phrase ban is untouched and that phrase appears in none of the new copy.
*Test:* the list is asserted by identity at four entries, so a fifth leaving it fails; each remaining entry is shown to still fire over its own fixture; the phrase half is unchanged and still discriminating; the guard is not bypassed by a renamed browser-local copy of a forbidden field.

**AC-13 — every absent case is named, and none is blank.** Four states are distinguished rather than collapsed, each with its own sentence: **a dry run**, which allocates a run number and writes no run history at all, so the reason is that nothing was recorded rather than that nothing was spent; **a history that could not be read** (404, a refusal, or a refused parse), carried through the existing `RequestState` vocabulary with its own retry; **a vendor that reported no price**, which is unpriced and never `$0.00`; and **a run whose number is not yet known**, where no read is attempted.
*Test:* all four render distinct non-empty prose; none renders a zero, a dash, a spinner or an empty region — `docs/04-architecture.md`'s rule that no placeholder is a blank panel, a spinner or a skeleton; the dry-run case is asserted **specifically**, since it is the first case anyone exercising this will meet; the existing `RequestState` vocabulary stays closed at five members; every state is distinguishable in text alone, without colour or motion.

**AC-14 — disclosures 2 and 3 retire only where their values are present, and completeness is stated honestly.** Both are rewritten and rendered conditionally on the AC-5 pattern, and what replaces each is the **specific** absence from AC-13 rather than a general one. Where the read reports `incomplete`, the cost region says the run is still in flight and the figures are as of that read; the two existing loss disclosures remain separately visible and are not conflated with it.
*Test:* for each disclosure the present and absent states are both asserted; deleting either sentence outright fails; a state where the value is absent and the sentence is also absent fails; an `incomplete` fixture renders the in-flight sentence and a complete one does not.

**AC-15 — `mission-control-text.ts` stays the single copy contract.** Every sentence this ticket adds or rewrites is an export there, imported by both the renderer and its tests, and none is approximated from any event's free text. The word *ticker* is used for none of it (§3.5).
*Test:* a source clause asserts no sentence-shaped string literal is rendered from `mission-control-status.tsx` outside an import from that module; a clause asserts *ticker* appears nowhere under `apps/web/src`; the disclosure array's length is asserted, so a sentence leaving it is a visible act.

---

## 5. Non-goals

1. **A polling cost ticker.** §3.5. No repeat read on a timer — the frozen contract's rule, and changing it is not this ticket's. Elapsed advancing is not a read and is AC-10's.
2. **Widening `done`, `warn`, `info` or `terminal` with cost, usage or a timestamp.** §3.4. At most one member or one option field is added, and it carries the run number alone.
3. **Any timestamp or sequence number on any event.** *"No event gains a timestamp or sequence number"* is vocabulary. Elapsed comes from the manifest.
4. **Rendering `terminal.cost` or `terminal.tokens`.** Already on the wire, already blended, refused by decision 025.
5. **A blended cost or token total anywhere, for any reason** — including "a total across vendors, shown alongside the split".
6. **Pricing unpriced usage, a rate table, user-supplied rates, cost forecasting, budget enforcement or quota display.**
7. **Per-column cost, token count, model, role or worktree branch.** The brief names them for the trace columns; this ticket is the header.
8. **The other two disclosures.** *"What comes next"* needs a flow step list `GET /flows` does not carry; structured tool and reasoning events have no producer, and *"The event union is derived from what the product emits"* (2026-08-25) governs them. **Five becomes two, not zero.**
9. **Any change to `GET /history/:id`'s response, or a new route.** It already answers everything needed; a projection would be a second authority.
10. **Changing how `core` allocates run numbers**, or deriving one from a run lock, handle, gate id, branch or path.
11. **Changing `RUN_EVENT_RETENTION` or `DEFAULT_RETENTION`.** AC-7 states why.
12. **Q-0018's run-history screen.** This reads one run's manifest for a live header.
13. **Resume, reconnect or a resume cursor** (Q-0019), and persisting host records across restart.
14. **`.harness/` exposure.** Q-0127 erratum E-1 stands; nothing here reads a ticket folder.
15. **Changing the human-readable `formatCost` message**, the adapter contract, flow files, gate answers, run-history schemas or the ticket file format.
16. **Any v1 exclusion**: multi-user, remote daemon, cloud sync, plugin marketplace, node canvas, eval suites, Gemini adapter, desktop shell.

---

## 6. Open questions

**OQ-1 (BLOCKING) — which transport carries the run number, and does it owe a decision entry?** §3.2 names exactly two measured options and they differ in what they cost. **(a) A new `start` member on the event union** — recommended: in-band, mirrors `terminal`, one producer at one site, and the number appears without the user acting. It **owes an entry**, because *"What a run's event stream carries"* (2026-08-28) and `docs/GLOSSARY.md`'s **Event** entry both say *"only the terminal event carries run identity"*, and `host.ts`'s own JSDoc repeats it — three sentences a second carrier narrows by one word. Decision 097 is explicitly not authority for it: its final paragraph rules that a further change to that shape is a new decision, and this is a new member rather than a field. **(b) An out-of-band callback in `runFlow`'s options**, the shape `answerGate` already uses — **owes no entry**, narrows no sentence, and delivers the number one refresh later in the worst case. **Owner: the human, at the gate. GO-1.** `developer-generalist` may write neither the entry nor this ruling, and a run launched without it reproduces Q-0062's three wasted rounds and Q-0126's round-1 `blocked`.

**OQ-2 — which sentences narrow, and is a glossary term coined?** Dependent on OQ-1 and not separately blocking. Under (a), three sentences narrow by one word — the GLOSSARY's **Event** entry, `events.ts`'s header and `host.ts:296`'s JSDoc — and the OQ-1 entry names all three; the clause *"No event gains a timestamp or sequence number"* is untouched, this adding neither. Under (b) none narrows. **No new glossary term is coined and none is owed**: *elapsed*, *run number* and *per-vendor cost* are ordinary English for values the manifest already names, and coining one would be a synonym for a measure that exists. **Owner: the gate, inside the OQ-1 entry.**

**OQ-3 (BLOCKING) — split or one ticket?** Fifteen criteria at the ceiling, with a disjoint-blocker seam at AC-7/AC-8 and half B strictly dependent on half A. §3.6 recommends the split and names the trim order and the two untrimmable criteria if it is refused. **Owner: the gate.**

**OQ-4 — the browser's clock or the daemon's, and is the skew worth closing?** Recommended: the browser's, against the manifest's `started_at`, with the rendering naming it — one clock reading, no round trip, and on a loopback daemon it is a machine's own clock against itself. The alternative, carrying the daemon's `now` on each response so the browser can compute an offset, buys accuracy this screen does not need and adds a field to a response `core` writes. **Owner: the gate. Not blocking** — AC-10 is satisfiable either way and carries the disclosure obligation that makes either honest.

**OQ-5 — should the run number appear on the `/runs` listing rows too?** **Stated rather than asked** (Q-0105's remedy): **yes, and it is out of scope here.** `GET /runs` will carry it for every live run the moment AC-3 lands, and the listing screen is a different surface with its own contract clause; widening this ticket to it is how fifteen criteria become eighteen. Recorded so the next reader does not re-derive it.

**OQ-6 (observation, not a finding about this change) — two prose figures for the manifest's key count disagree.** `manifest.ts` describes an occurrence as *"exactly fifteen keys"* while decision 097 describes `run-manifest-v1` as frozen at a required-key count; one of the two prose figures, or the frozen contract, is wrong about the other's subject. **Nothing here edits the manifest or its schema**, and AC-8 reads four of its keys whatever the total. Recorded so it is not mistaken for a defect this ticket introduced, and routed to whoever next opens `contracts/Q-0011/`.

---

## 7. Risks

**R-1 — the review diff will be truncated, and the files at risk are nameable in advance.** The last four tickets on this surface were each reviewed at a fraction of their change: Q-0129 at 78.9% → 76.3% → 73.1% → **70.2%**, with the omitted set growing 10 → 15 as the branch did and **`packages/shared/src/events.ts` — the file that ticket existed to change — among the files no review ever received a patch for.** This ticket touches the same file. `git diff` orders by path, so the head cut hides the same alphabetical tail every time, and `repo.max_diff_bytes` is read at run start, so no mid-run change reaches the run it would help. **Mitigation:** Q-0124's warn names the omitted files on the event stream and Q-0117's `observation:` channel is where a reviewer reports having read them from the branch — a pair that composed on Q-0016, Q-0129 and Q-0130 and is now a mechanism rather than a coincidence. **GO-5** makes the hand pass over the omitted tail an obligation rather than a hope. **Q-0128** is the ticket; this is not it.

**R-2 — the implementer walks into the class the criterion forbids.** Q-0059 predicted its own path-escape class in the body and the implementer walked into it three times anyway; Q-0122 named its confinement criterion untrimmable and both review blockers landed on exactly it. The analogue here is **AC-11**: the temptation to render one total is strong precisely because `terminal.cost` is already a typed number on the wire. It is named untrimmable, and its test asserts the sum is **not** rendered rather than that the split is.

**R-3 — a third read widens the screen's failure surface.** Mission control already renders two independent failure accounts. **Mitigation:** the `RequestState` vocabulary is closed at five and stays closed; AC-9 keeps the read to one-on-mount-plus-refresh so it cannot fail repeatedly on its own; and §0.8 measured that the `no-such-run` refusal on `/history` already has rendered, tested copy.

**R-4 — a browser that never sees the run number.** A late joiner whose replay has evicted the head, or a daemon configured to retain nothing. **Mitigation:** AC-4 renders the handle in that case, which is exactly what it renders today, and AC-5 keeps the disclosure for it, so no state gets worse than it is now. Half B then attempts no read, which AC-13 covers.

**R-5 — the `--dry` case is the first one anyone tests and has the least on disk.** Q-0129's demonstration was a dry walk; so will the next one be. A dry run has a run number and **no run history at all**. AC-13 names it specifically, and GO-4 requires a non-dry demonstration.

**R-6 — a criterion naming `contracts/`.** §0.6(a). This document names it in **no** criterion, and **GO-2** is where the contract moves. A reviewer asking for a criterion that edits it is asking for the thing that returned `blocked` on Q-0129 round 1, and should be refused with this paragraph.

**R-7 — an elapsed timer that grows into a poller.** The distinction in §3.4 is one line of code wide: a timer that re-renders is permitted and a timer that fetches is not. AC-9's source clause is what keeps them apart, and it is written to fail over a fixture that polls rather than to be read.

**R-8 — double counting on replay.** The daemon replays its retained buffer to every new subscription, and the event union carries no timestamp or sequence number by decision, so deduplication is unavailable — which is what Q-0015's erratum E-11 ruled for the trace. The read-based cost design is immune by construction, because nothing is accumulated from events; this is recorded so the field-on-`done` shape is not revived without answering it.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a and preserved. No code path, test or example here touches a key; the vendor labels rendered are `rollup[].vendor` strings, never credentials. `check()` is untouched. |
| **Worktree safety** | n/a. Nothing here writes to a working tree; `core`'s one change supplies a value. |
| **Gate behaviour** | Unchanged. `gateAnswerSchema` stays the closed three; nothing here answers, offers or affects a gate, and the header's gate link is Q-0015's and does not move. |
| **File format and schema** | `.quorum/runs/*/manifest.json` is **read and never written** by anything here; `run-manifest-v1` and `contracts/Q-0011/` are untouched. The two schema changes are AC-1's and AC-8's, both in `packages/shared`, both executable in a browser. |
| **Write boundary** | **Unchanged.** `apps/web`'s two write-capable modules and `WRITE_RULES` are untouched — everything here is a `GET` or a render — and that is asserted rather than assumed. |
| **Lint rules** | No flow file changes, so `lintFlow` is untouched and `quorum lint` 6/6 is expected unchanged. |
| **Cold-clone impact** | None on install or first-run time; one extra read per mount for a run that has a number. **No new dependency** — `diff2html` and friends are Q-0134's. |
| **Product-agnostic** | Nothing names a SaaS product; vendor labels come from data, never from a literal, and no code branches on a known vendor name. |
| **Errors explicit** | AC-8's schema refuses a damaged roll-up rather than throwing inside a `.map`; AC-13 requires four named absences and forbids a blank, a dash, a spinner and a zero. |
| **Quality gates** | `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint` and `pnpm typecheck` green, including the mock-adapter end-to-end regression suite. |

---

## 9. Gate obligations

**GO-1 (blocking) — OQ-1 is ruled and, if an entry is owed, it lands before the implement step and is verified present in that step's prompt.** Not assumed: `grep` it in `.quorum/runs/Q-0131-<n>/steps/001-implement/prompt.txt` and record the count — the check Q-0097 lost two errata by not making and which Q-0115, Q-0125 and Q-0129 each performed. The entry should record §3.4's refusals with their measurements, for decision 097's own stated reason.

**GO-2 — `contracts/Q-0015/mission-control.contract.md` gains its superseded-by note, written by hand at the gate.** Two clauses move: *"the five absent capabilities"* becomes two, and the run-number sentence changes source. A landed contract is not edited away — the note names what supersedes what, as Q-0129's did for `contracts/Q-0050/run-events.contract.md`. **No criterion may name this file.**

**GO-3 — `docs/04-architecture.md` and `docs/06-development-plan.md` record what shipped**, including that mission control names two absent capabilities rather than five. `docs/` **is** writable by the role, so this may be a criterion's subject if the gate prefers; it is listed here because the plan entry is written by hand at the close either way.

**GO-4 — the product is run by hand and the demonstration is transcribed, not paraphrased.** A real daemon from `quorum open`, a run started **through the daemon** — a `quorum run` is a different process the host can never see, which is Q-0121's measurement — mission control opened in a browser **while the run is running**, and the transcript recording: the run number rendered while `state` is `running`, the elapsed figure observed advancing and then frozen after the terminal event, and the per-vendor split with **at least one unpriced vendor** in it, plus the dry-run case rendering its own sentence rather than a zero. Record the request that produced the run, as Q-0129's `runs.log` does. **This obligation is written to be unfakeable because its predecessor was not**: Q-0016's GO-6 was reported discharged when its by-hand half had not been performed, and Q-0015's gate found it a day later.

**GO-5 — the omitted tail of every truncated review is read by hand, cross-vendor.** R-1 names `packages/shared/src/events.ts` and `wire.ts` as most likely behind the cut, and they are this ticket's subject. Record the truncation ratio and the omitted file set per round, as Q-0129 and Q-0130 did, so **Q-0128** accumulates evidence rather than impressions.

**GO-6 — verified forced in both environment rows**: a worktree with neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, `--force` in each, plus `quorum lint` and the git-identity sweep. Q-0072's closing finding — and it bites here, because this ticket **reads `.quorum/runs/`**, a directory a fresh checkout does not have, so AC-8's fixture must be one the test builds rather than this repository's own run history, or its verdict becomes a property of the checkout.

---

## Provenance

**Candidate-claude supplied the ticket's shape, and it earned it by measuring.** Its §0.1 (the engine already emits the run number in prose at run start, before the dry guard), §0.2 (`started_at` and a live per-vendor roll-up on disk, served by `GET /history/:id`) and §0.3 (`RunStats` has no vendor split; the browser cannot accumulate over a head-evicting buffer) are the three facts that turn three separate problems into one mechanism, and all three were re-verified here and hold. Its count-register analysis, its `contracts/`-is-unwritable finding, its refusal list with measurements, and its split recommendation are carried substantially as written. AC-1 to AC-7, AC-12, AC-13 and AC-15 are its criteria, sharpened.

**Candidate-codex supplied the rendering discipline, which claude's document lacked.** Its AC-6 and AC-7 — elapsed advancing at least once per second, `MM:SS` / `H:MM:SS`, zero-padded, clamped at `00:00`, frozen on the terminal read, tested against a controlled clock — are merged into AC-10 and are better than claude's fixed-until-refresh figure. Its AC-11's *"never branches on a known vendor name"* and first-observed ordering, its AC-13's honesty-about-completeness clause (merged into AC-14), its AC-14's "each retained prohibition has a discriminating fixture", its AC-18 accessibility clause (merged into AC-13) and its risk list — clock adjustment, double counting on replay (R-8), source-guard erosion — are carried.

**Where they disagreed, this document picks rather than averages.**

- **Cost transport.** Codex's structured field on `done` is refused on §0.3's measurement: the browser would accumulate over a 500-event head-evicting buffer while `stdout` is one event per line, so the figure under-reports silently — and codex's own AC-13 concedes it, answering by labelling the ticker incomplete. A figure known to be wrong beside a sentence admitting it is worse than the read, which is computed in `core` over every occurrence. This also removes codex's second blocking open question entirely.
- **Elapsed source.** Codex's host-recorded start and end instants on `WireRun` are refused: they would be a **second** start time disagreeing with the manifest's `started_at` by the daemon's scheduling delay, and `finalise` already computes `duration_ms` against the manifest's. Two authorities for one run's duration, where one already exists on disk.
- **Elapsed rendering.** Claude's static figure is refused: it read the frozen contract's *"no timer performs [a repeat read]"* as forbidding timers outright, which it does not — a display advancing from a held `started_at` performs no read — and a frozen elapsed goes false the moment it renders.
- **The retention evidence.** Codex states the Q-0015 figures are absent from the repository and rests three clauses on it. They are at `backlog/Q-0015-*/runs.log:177`, and that file itself records that the walk was `--dry` and the bound stays unmeasured. Codex's conclusion is right and its route to it is a failed search read as proven absence — Q-0074's class — so AC-7 states the datum correctly rather than requiring verification to record that it could not be found.
- **Size.** Codex's twenty-one criteria are past the ceiling that split Q-0091 and Q-0096, and several of them (its AC-17, AC-19, AC-20, AC-21) restate standing repository rules rather than specifying this change; they are folded into §5 and §8, where they bind without costing a criterion.

**Contributed by neither, and added here from the tree:** `host.ts:296`'s JSDoc already refusing a second authority for run identity, which is why AC-3 is one line; the out-of-band callback alternative in §3.2, which is what makes OQ-1 a real choice rather than a formality, since it is the option under which **no decision entry is owed at all**; the measured occurrence distribution over 165 runs; and §0.8's finding that the new read's refusal state already has rendered, tested copy.

**Verdict: needs-input**, on OQ-1 and OQ-3. Neither is a question this flow can answer: one is a decision entry and a transport ruling, the other is a size ruling, and `developer-generalist` may write neither.
