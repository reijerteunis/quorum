# Q-0131 — The mission control header's measured values

*Merged requirement, run 1, iteration 2. Measured against tip `a7e3f50` (`chore(backlog): Q-0131 re-measured after Q-0129`).*

**Verdict: ready.** Iteration 1 returned `needs-input` on two blockers. Both were artefacts of a design choice it made and did not have to make, and one measurement it never took removes the choice. §0.1 is that measurement; §3.2 is the ruling; §3.6 is the cut. Nothing here blocks solutioning.

---

## 0. What was measured, and what iteration 2 opened on

**The tree has not moved since iteration 1, and this document says so before anything else.** Tip is still `a7e3f50`, `docs/decisions/` still ends at `097-a-gate-question-carries-the-decision-that-reached-it.md`, the ticket body is unchanged, and `backlog/Q-0131-*/requirements/` holds `run-1/` and `merged.md` and **no `errata.md`**. So neither gate obligation was ruled between the two iterations, and *"a retry on an unchanged tree cannot rule its own blocker"* (Q-0090, Q-0096, Q-0105) applies in full: iteration 2 has no new authority.

What it has is the other half of that precedent — Q-0105, Q-0122, Q-0013, Q-0016 and Q-0125 each opened a second pass on an unmoved tree and **found something anyway**, by re-running every measurement the first pass rested a criterion on rather than re-reading its own prose. That is what was done here. Every figure below was taken from the tree at the stated tip. Iteration 1's measurements all hold. One it never took is what changes the ticket.

### 0.1 The measurement that dissolves both blockers: the header already reads its identity from the metadata request

`apps/web/src/mission-control-status.tsx`, in its own module comment at `:11–12`:

> `WireRun.runId` exists on the metadata read too, but `04-architecture.md` forbids a fabricated value, and a running run's `runId` there is `null` until the run ends

and at `:133–139`, the shipped header:

```tsx
<p className="font-mono text-xs text-muted" data-run-identity>
  {runId === null ? `Run ${handle}` : `Run ${String(runId)}`}
…
  {metadata.value.flow}
  {metadata.value.ticketId === null ? null : <> · {metadata.value.ticketId}</>}
```

**The header is already split across two sources, and has been since Q-0015 shipped.** `flow` and `ticketId` come from the `GET /runs/:handle` metadata read; the run number comes from `terminalRunId(snapshot.events)`, the socket. And the file records *why* the socket was chosen: not because metadata is the wrong home for a run's identity, but because **metadata's `runId` is `null` while the run is running** — which is precisely the premise this ticket removes.

So the "second authority" objection that made iteration 1 prefer a new event-union member is void twice over. The header already reads identity from metadata; a run number joining `flow` and `ticketId` there is **consistent with what already ships** rather than a new split, and the shipped screen was built in the expectation of exactly this value arriving at exactly that address. Adding a union member would instead *create* the split iteration 1 was trying to avoid, by keeping one identity field on the socket while the other two come from metadata.

`WireRun` already carries `ticketId: string | null` (`packages/shared/src/wire.ts:151`) beside `runId: number | null`, so the browser also already holds both halves of the `<TICKET>-<n>` history id the deferred half needs.

### 0.2 The out-of-band supply site exists, is already used, and is in the same options object

`packages/server/src/host.ts:352–364` — what `start` already builds:

```ts
stream = runFlow({
  flow, ticket: record.ticket, project, backlog: project.backlog,
  dry: request.dry ?? false,
  auto: request.auto ?? false,
  answerGate: gates.channelFor(record.handle),
  signal: controller.signal,
  …
});
```

`answerGate` is an **out-of-band callback in `RunFlowOptions`** (`packages/core/src/engine/types.ts:75,99`), passed by the host at the site that owns `record`. The run number needs the same shape and nothing more: one optional option, supplied once, at a site where `record` is already in scope and already being closed over.

`packages/core/src/engine/engine.ts:228` allocates `const runId = nextRunId(ticket);` **before** the run lock and **before** the `if (!dry)` guard at `:342`, and `:340` already stringifies it as the first event of every run:

```ts
emit({ type: 'info', message: `run #${runId}  flow=${flow.name}  ticket=${ticket.meta.id}  …` });
```

So the value exists from run start, on every run including a dry one, at a site that already holds it. Supplying it is one call beside a line that already interpolates it.

### 0.3 What that ruling costs, and what it saves — the three sentences that stay true

Under the out-of-band supply, **no event gains run identity**, so every landed sentence on the subject survives unedited:

| Sentence | Site | Under this ruling |
| --- | --- | --- |
| *"only the terminal event carries run identity"* | `docs/GLOSSARY.md:108`, **Event** | **True.** No event changes. |
| *"No event gains a timestamp or sequence number"* | same entry, `events.ts` | **True.** Untouched either way. |
| *"The terminal event is the only event carrying run identity, and its `runId` is a typed field."* | `packages/server/src/host.ts:296` | **True.** The callback is not an event. |

**So no decision entry is owed**, and that is the whole of iteration 1's first blocker. A new union member would have made all three false by one word each, owing an entry `developer-generalist` may not write — a gate precondition, and this repository has priced one of those at three wasted rounds (Q-0062) and a round-1 `blocked` (Q-0126, Q-0129).

Two JSDoc sentences **do** go false and are AC-3's, because they describe *when* the number arrives rather than what carries identity: `wire.ts:108`'s *"`runId` is `core`'s own number and is `null` until the terminal event carries it"*, and the second clause of `host.ts:296`'s block. `core` remains the sole authority that allocates and supplies the number — what changes is **when** it supplies it, never **who**.

It also removes `packages/shared` from this half of the change entirely. `WireRun.runId` has been `number | null` since Q-0121, `wireRunSchema` already validates it, and `viewOf` already projects it — so no schema moves, and R-1's named truncation victims (`events.ts`, `wire.ts`) are down to one comment.

### 0.4 The measurement that keeps cost a read rather than a second field

`engine.ts:256` — the run-level accumulator is `const stats: RunStats = { cost: 0, tokens: 0, unpriced: 0 }`, and `RunStats` (`types.ts:197–201`) is those three numbers. **There is no vendor split in it.** The per-vendor split exists only in the manifest's `rollup`, which `packages/core/src/run-history/writer.ts` creates at run start (`:502–507`: `started_at`, `status: 'running'`, `rollup: []`) and recomputes in full inside `terminal()` (`:594`) and `finalise()` (`:621`) — the funnel every occurrence passes through.

`VendorRollup` (`packages/core/src/run-history/manifest.ts:85–92`) is the five measures plus `vendor` — *"the exact `usage.vendor` string, never normalised or mapped"* — `step_count`, and `unpriced_steps`, *"so a total can say how much of itself it cannot see"*. `GET /history/:id` (`packages/server/src/read.ts:404–425`) already serves the manifest whole, `incomplete`, and `tokensByVendor` as `vendorTokenTotal` applied **one row at a time**, its own comment recording that summing across rows *"would compose exactly the figure that entry refuses"*.

A structured per-vendor field on `done` would instead hand the browser an accumulation it cannot perform correctly: `apps/web/src/run-connection.ts:28` retains 500 events and **evicts from the head**; across this repository's **165** recorded runs the occurrence count is median **4**, p90 **11**, max **55**, total **899**, so the largest run here is ≈275 non-`stdout` events before a single line of vendor output, and `stdout` is one event per line from both adapters. The accumulated figure would under-report **silently, exactly when the screen discloses that it discarded events.** This is Appendix A's, and it is recorded here so the option is not revived without answering it.

### 0.5 The two constraints that bound every criterion below

**(a) `contracts/` is not writable by this flow's role.** `harness/roles/developer-generalist.md:3` lists fourteen roots — `package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, harness, docs, README.md, eslint.config.js, vitest.shared.js` — and `contracts` is not among them. `contracts/Q-0015/mission-control.contract.md:63` says mission control names *"the five absent capabilities"* and `:88` names *"structured header values as successor work"*; both go false. **No criterion below names that file.** It is **GO-2**, by hand at the gate. Q-0129's round 1 returned `blocked` on exactly this, and its entry records that the merged requirement *"cites that rule by name… and then names `contracts/` one criterion later"* — so the rule is applied here rather than stated and then broken.

**(b) Prose parsing is already foreclosed at the source level.** `apps/web/test/source.test.ts:67–70` scans the complete corpus for six `MESSAGE_PARSE_NEEDLES` — bare `cost=`, bare `verdict=`, and `role=` behind four delimiters — with the count asserted at six (`:77`) and a discriminating fixture at `:81–84`. Beside decision 097's own measurement (4 of 1,080 findings contain the join separator; 1,071 contain `": "`) and Q-0015's ground rule 2, that is three independent refusals of any regex over an event message, and this document adds a fourth for `run #`.

### 0.6 The retention datum exists, and candidate-codex's central claim about it is false

Codex states, and rests its AC-16, its OQ-3 and one risk on: *"The repository does not contain the Q-0015 verification product… Searches find the obligation repeatedly, but no recorded figures."*

Measured — `backlog/Q-0015-mission-control-streams-a-run-live-one-t/runs.log:176–184`:

```
AC-9's verification product, and the first per-run event count this repository holds:
    events 10 · missed 0 · peak concurrent columns 3
    by type: info 6, step 3, terminal 1

**Stated rather than left to be inferred: this was a `--dry` walk.** … AC-9's bound of
500 remains unmeasured against real traffic
```

The conclusion codex reached — the bound does not move — is right. The route to it is a failed search read as proven absence, which is Q-0074's class, and it would have shipped a criterion requiring verification to record that evidence *in the repository* could not be found. AC-7 states the datum correctly instead.

### 0.7 Iteration 1's own OQ-6 was wrong, and is corrected rather than carried

It reported that `manifest.ts` and decision 097 give disagreeing key counts for the manifest. They do not. `manifest.ts:94` reads *"One entry in the manifest's record of what actually executed. **Exactly fifteen keys, always.**"* — that is an **`Occurrence`**. Decision 097 says `run-manifest-v1` is *"frozen at fifteen required keys"* — that is the **manifest**. Two subjects sharing a number. Nothing disagrees, and routing a reader to `contracts/Q-0011/` on it would have been a false errand transcribed into a durable record.

---

## 1. Problem

Mission control's header is the hero region of the hero screen, and three of the four things `docs/05-design-prompt.md` screen 5 specifies for it are not there. In their place the screen prints three sentences saying so (`apps/web/src/mission-control-text.ts:27–29`):

> "The run's number is not on the wire until the run ends; its handle identifies it meanwhile."
> "Elapsed time is unavailable because no event has a timestamp and the run has no start time on the wire."
> "Per-vendor cost and token totals are unavailable as structured values; they occur only inside a human-readable message."

Those sentences are correct and were the right thing to ship — `docs/04-architecture.md` forbids a placeholder showing a value nobody measured, and Q-0015 obeyed it. But they describe a **transport gap, not a missing measurement**. The engine computes all three: it allocates the run number before it takes the run lock and emits it in prose as the first event of every run, and it writes the run's start time and a correct per-vendor roll-up to disk at run start, keeping the roll-up current on every occurrence. A maintainer watching a run they are paying for is told three times that the product cannot see figures it has already computed and stored.

The cost of leaving the first of them is not cosmetic. **The run number is the identity of a live run.** Without it a reader cannot join what they are watching to `runs.log`, to `.quorum/runs/`, or to the ticket's own history: the browser shows `Run run-1`, a handle the daemon's own JSDoc calls meaningless across a restart. It is also the key to the other two, because a run-history id is `<TICKET>-<n>` and a live run supplies no `n` — which is why it goes first and alone.

---

## 2. User stories

**`maintainer` — the run number.** *As the solo maintainer watching a run I started from the ticket page, I want the header to show the run's own number while it is running, so that the screen in front of me and the `runs.log` line, run directory and ticket history I will read afterwards are about a run I can name — rather than a handle that means nothing five minutes after the daemon restarts.*

**`adopter` — the same value, as a trust signal.** *As a stranger on my first run, I want the header to show what the product knows rather than an explanation of what it cannot see, so that my first impression of mission control is a run I can read.*

**`maintainer` — the deferred half, recorded so it does not expire.** *As the solo maintainer deciding whether a step has hung, and who has spent $2,800 developing this product through it, I want elapsed time and a per-vendor cost split that never blends and never reads as free.* That is Appendix A.

**Surfaces touched by this ticket:** `packages/core` (one option, one supply site), `packages/server` (one closure, one JSDoc clause), `apps/web` (one header read, one disclosure, one guard clause), `packages/shared` (one JSDoc clause, no schema). **No flow file, no role, no adapter, no `backlog/`, no `contracts/`, no persisted format, no event-union change.**

---

## 3. The design the measurements select

### 3.1 The mechanism, in one paragraph

`RunFlowOptions` gains **one optional callback**, the shape `answerGate` already has. `core` calls it once per run at the site that already holds `runId`, immediately before the run-start `info` it already emits, outside the `!dry` guard. `host.start` passes a closure that sets `record.runId` — the same field the terminal event already sets, from the same authority. `WireRun` therefore carries a live run's number on `GET /runs/:handle` and `GET /runs` with **no wire shape change at all**, and the header renders it from the metadata read it already performs for `flow` and `ticketId`. One value crosses; nothing is computed twice; no figure is invented; no event changes.

### 3.2 Why out of band, and the alternative recorded with its measurement

**Ruled: the out-of-band callback**, stated rather than asked (Q-0105's remedy), on four measurements:

1. **It owes no decision entry.** No event gains run identity, so all three landed sentences stay true (§0.3). A ticket with no gate precondition is one that can start.
2. **The supply site already exists in that exact shape.** `host.start` already passes `answerGate` in the same options object, with `record` in scope (§0.2).
3. **The browser is already wired for it.** The header already renders `flow` and `ticketId` from the metadata read, and `mission-control-status.tsx`'s own comment records that `WireRun.runId` is there too and was passed over only because it is `null` while running (§0.1). This ticket removes that premise.
4. **It keeps `packages/shared`'s schemas out of the change**, so the one file the last four reviews on this surface never received a patch for is not this ticket's subject (R-1).

**Refused: a new `start` member on the event union**, recorded here with its measurement so no later ticket re-derives it. It is the shape iteration 1 recommended and it is not wrong in principle — it mirrors `terminal`, has one producer at one site, and delivers the number in band. It is refused because it makes three landed sentences false by one word each and therefore owes an entry before a line of code; because every non-exhaustive consumer of the union fails at `tsc`, which is a real cost paid across `core`, `server`, `cli` and `web` for a value only one consumer wants; and because it would *create* the identity split it was chosen to avoid, leaving the run number on the socket while `flow` and `ticketId` come from metadata.

**The residual, stated rather than hidden:** a browser that mounts in the window between `POST /runs` answering a handle and the engine's first pull sees `Run <handle>` until the next explicit refresh. That window is milliseconds and closes before any human navigates to the screen, and AC-4 renders the handle there — which is exactly what ships today, so no state gets worse. An in-band member would close it; the price is above.

### 3.3 What the callback carries

The run number and nothing else. Everything else the brief's header names — flow, ticket id, stage — is already on `WireRun` from the start request the daemon itself composed, so a second copy would be a second authority for a value the transport already holds. **The one value nobody downstream can derive is the run number**, and it is the whole payload. It carries no timestamp: `docs/GLOSSARY.md`'s **Event** entry says *"No event gains a timestamp or sequence number"*, and elapsed does not need one, the manifest already having `started_at`.

### 3.4 Failure is not the run's problem

A supply callback that throws is the host's defect, not the run's, and a run that is otherwise fine must not die of it. AC-1 requires the call to be isolated: a throw becomes one `warn` and the run proceeds with `runId` unset, which is the state that already ships. This is *"Errors are explicit"* without letting a reporting channel take a run down.

### 3.5 The cut, and why it is made here rather than asked about again

Iteration 1 carried fifteen criteria and returned `needs-input` on the size. With the union untouched, the run-number half is **seven** — the schema criteria a new member needed are gone — and the deferred half is seven more. Fourteen in one ticket is at the ceiling, and the measured precedent says the ceiling is expensive: Q-0013 refused at eighteen and split in three, Q-0091 and Q-0096 at twenty-one, Q-0122 accepted twenty and paid three implement rounds, Q-0126 refused a split at sixteen and paid **$177.92 with a round-1 `blocked`**.

**So the cut is made in this document rather than asked about a second time**, which is what a gate would otherwise have to rule on an unmoved tree. The seam is a hard dependency rather than a size line, which is the strongest kind this repository recognises and the one Q-0129/Q-0134 used:

| | **This ticket — the run number** (AC-1 … AC-7) | **Appendix A — elapsed and per-vendor cost** (AC-8 … AC-14) |
| --- | --- | --- |
| Decision entry | **None owed** (§0.3) | **None owed** |
| Packages | `core`, `server`, `web`, one `shared` comment | `shared`, `web` |
| Nature | A value crosses that did not | A value already served is read and rendered |
| Depends on | Nothing | **This ticket, strictly** — the history id is `<TICKET>-<n>` |

This half is independently useful the day it lands: the header shows the run's number and disclosure 1 retires. The deferred half cannot start before it and needs none of its rulings.

**Appendix A is transcribed in full, as criteria, numbered continuously** (Q-0106's precedent), because an obligation recorded only in a closed ticket's prose expires — the drift this plan records seven directions of. **If the gate prefers one ticket, folding Appendix A back costs nothing**: its criteria are already written at AC-8 to AC-14 and need no renumbering. If it prefers the split, it allocates the successor and the appendix is that ticket's body.

---

## 4. Acceptance criteria

Each is independently testable and names its surface. *Test:* bounds the instrument: a reviewer may find the instrument fails the job that clause gives it and may **not** raise the job — Q-0067 erratum E-1, the fifth instance of which this cut has paid for.

**AC-1 — the run number crosses out of band, once per run, from the site that already holds it.** `packages/core/src/engine/types.ts`'s `RunFlowOptions` gains one optional callback taking the run number, declared beside `answerGate` and documented as the same kind of channel. `packages/core/src/engine/engine.ts` calls it at the existing run-start site, immediately before the existing `info` and **outside the `if (!dry)` guard**, `nextRunId` running above both. **The `info` message's text is unchanged** — it is narration for a human and stays one, so every existing reader of `runs.log` and the trace is untouched. **No event gains a field and the event union is unchanged.** A callback that throws produces one `warn` and does not fail the run (§3.4).
*Test:* over a mock-adapter run the callback receives the number before any step event and it equals the number `runs.log` records for that run; a `--dry` run calls it too; a flow traversing a backward edge calls it exactly once; the value is `context.runId` rather than a recomputation; a throwing callback leaves the run's terminal status unchanged and emits a `warn`; a source clause asserts the union's member count is unchanged and the `info` literal is unchanged, each shown red over a fixture that changes it.

**AC-2 — the daemon correlates from it, parses no prose, and no wire shape changes.** `packages/server/src/host.ts` passes a closure setting `record.runId`, at the call site that already passes `answerGate`. `WireRun`, `wireRunSchema` and `viewOf`'s projection gain **no field**, `runId` having been `number | null` since Q-0121. `core` remains the sole authority that allocates the number; the daemon computes none and derives none from a handle, gate id, branch, path or message.
*Test:* against a real port, `GET /runs/:handle` answers a number for a run whose `state` is `running`, **before any terminal event**; `GET /runs` carries the same number on the same row; the live number and the eventual terminal event's number are equal, and the test fails if they differ; a refused start still answers `runId: null`; a source clause asserts `host.ts` reads no event `message` and splits no `gateId`, which is the rule its own JSDoc states.

**AC-3 — the two sentences that go false are corrected, and the one that does not is left alone.** `packages/shared/src/wire.ts`'s *"`runId` … is `null` until the terminal event carries it"* and the corresponding clause of `packages/server/src/host.ts`'s `observe` block are rewritten to what is true after this change, naming `core` as the sole authority and the callback as the earlier supply. **`docs/GLOSSARY.md`'s *"only the terminal event carries run identity"*, `events.ts`'s header and `host.ts`'s statement that the terminal event's `runId` is a typed field are untouched**, because no event changes — and a criterion that edited them would be asserting a change this ticket does not make.
*Test:* a source clause asserts neither corrected site still claims the number arrives only at the end, shown red against the current wording; a second clause asserts the three untouched sentences are byte-identical to what ships today, so a later change that narrows one is a visible act rather than a quiet one.

**AC-4 — mission control renders the number from the metadata read, beside the identity it already reads there.** `apps/web/src/mission-control-status.tsx`'s header renders `Run <n>` from the loaded `WireRun`, alongside the `flow` and `ticketId` it already renders from that request, and `Run <handle>` only where no number has been loaded — a request that has not resolved, a failed metadata read, or the window in §3.2. The browser never derives a number from a handle, gate id, branch, path or event message.
*Test:* a loaded metadata fixture carrying a number renders it; one carrying `null` renders the handle; both branches are asserted, so deleting either fails; a fixture whose metadata read failed renders the handle and the existing metadata failure account, not a blank; the rendered number is shown to come from the metadata value and not from the socket snapshot, by a fixture whose snapshot carries a terminal event with a different number.

**AC-5 — disclosure 1 retires only where the value is present.** `MISSION_CONTROL_DISCLOSURES[0]` is rewritten to what is true after this change and rendered only where no number has been loaded — the conditional-retirement idiom the file already carries, whose reasoning its own comment records: leaving the sentence would show the number and explain that there is none.
*Test:* with a number loaded the sentence is absent and the number present; with none the sentence is present and the number absent; **both states are asserted**, so a disclosure deleted outright fails; the array's length is asserted, so a sentence leaving it is a visible act.

**AC-6 — no prose is parsed, and the source guard is extended rather than weakened.** The six `MESSAGE_PARSE_NEEDLES` are unchanged, their count still asserted at six, and `apps/web/src` still contains none of them. A new clause forbids the literal `run #` and any expression extracting a number from an event message anywhere under `apps/web/src`.
*Test:* the existing needle scan passes unmodified with its count assertion intact and its own discriminating fixture untouched; the new clause is shown red over a fixture that parses `run #` out of a message, and green over the shipped corpus.

**AC-7 — `RUN_EVENT_RETENTION` stays 500, and what would license moving it is recorded.** The constant does not move. Its JSDoc records the datum that exists and the one that does not: Q-0015's demonstration produced **10 events, 0 missed, peak 3 concurrent columns** and **was a `--dry` walk**, which invokes no adapter and so emits no `stdout` — `backlog/Q-0015-*/runs.log:176–184`, which says so itself; this repository's **165** recorded runs have a median of **4** occurrences, p90 **11** and a maximum of **55**, ≈275 non-`stdout` events before a line of vendor output; and run history **cannot** supply the missing figure, `output.txt` being the adapter's final message rather than the stdout stream.
*Test:* a source clause pins the constant's value **and** that its JSDoc names both the dry-walk datum and the absence of a real-traffic one, so a later change that moves the number without evidence fails by name. **No criterion here changes the bound**; the ticket body's instruction — *"revisit the figure only with that evidence"* — is honoured by not revisiting it.

---

## 5. Non-goals

1. **Widening the event union.** §3.2. No member is added and no existing member gains a field.
2. **Any timestamp or sequence number on any event.** *"No event gains a timestamp or sequence number"* is vocabulary, not a preference.
3. **Elapsed time and per-vendor cost.** Appendix A, and deferred rather than dropped.
4. **Rendering `terminal.cost` or `terminal.tokens`.** Already on the wire, already typed, already blended — refused by *"Codex cost is reported as tokens, never priced locally"* (2026-08-22).
5. **A blended cost or token total anywhere, for any reason**, including "a total alongside the split".
6. **Parsing `done.message`, `stdout`, `info`, `warn` or any other human-readable sentence**, and changing the human-readable `formatCost` message.
7. **Changing how `core` allocates run numbers**, or deriving one from a run lock, handle, gate id, branch or path.
8. **Changing `RUN_EVENT_RETENTION` or `DEFAULT_RETENTION`.** AC-7 states why.
9. **The other four disclosures.** Two are Appendix A's; *"What comes next"* needs a flow step list `GET /flows` does not carry; structured tool and reasoning events have no producer, and *"The event union is derived from what the product emits"* (2026-08-25) governs them.
10. **Any change to `GET /history/:id`, `GET /runs` or `GET /runs/:handle`'s response shape, or a new route.**
11. **Per-column cost, token count, model, role or worktree branch.** The brief names them for the trace columns; this is the header.
12. **Q-0018's run-history screen**, Q-0019's resume, and persisting host records across restart.
13. **`.harness/` exposure.** Q-0127 erratum E-1 stands; nothing here reads a ticket folder.
14. **Changing the adapter contract, flow files, gate answers, run-history schemas or the ticket file format.**
15. **Any v1 exclusion**: multi-user, remote daemon, cloud sync, plugin marketplace, node canvas, eval suites, Gemini adapter, desktop shell.

---

## 6. Open questions

**None blocks solutioning.** Iteration 1's two blockers are ruled in §3.2 and §3.5 rather than carried, because on an unmoved tree a second pass that re-asks an unanswered question spends a round and delivers nothing — which this repository has priced three times.

**OQ-1 — is the run number added to the `/runs` listing rows too?** **Stated rather than asked** (Q-0105's remedy): **yes, and it needs no work here.** `viewOf` already projects `record.runId`, so `GET /runs` carries it for every live run the moment AC-2 lands, and AC-2 asserts it. Whether `runs-screen.tsx` *renders* it is a different screen with its own contract clause and is out of scope; widening this ticket to it is how seven criteria become ten. Recorded so the next reader does not re-derive it.

**OQ-2 — is a glossary term coined?** **No, and none is owed.** *Run number* is ordinary English for a value `runs.log` and `.quorum/runs/` already name, and coining one would be a synonym for a measure that exists — which `docs-and-decisions.md` forbids. The **Event** entry is untouched (AC-3). Recorded so it is not re-litigated at the gate.

**OQ-3 (observation, resolved) — the manifest key-count question iteration 1 raised does not exist.** §0.7. `manifest.ts:94`'s *"exactly fifteen keys"* describes an **`Occurrence`**; decision 097's *"fifteen required keys"* describes `run-manifest-v1`. Two subjects sharing a number. Nothing here edits either, and no reader is owed a look at `contracts/Q-0011/`.

**OQ-4 — the deferred half's clock question.** Appendix A §A.5. Not this ticket's, and not blocking it.

---

## 7. Risks

**R-1 — the review diff will be truncated, and this ruling shrinks the target.** The last four tickets on this surface were each reviewed at a fraction of their change: Q-0129 at 78.9% → 76.3% → 73.1% → **70.2%**, with the omitted set growing 10 → 15 and **`packages/shared/src/events.ts` — the file that ticket existed to change — among the files no review ever received a patch for.** Choosing the out-of-band supply takes `events.ts` out of this change entirely and leaves `wire.ts` with one comment, which is the largest single mitigation available. **Residual:** `git diff` orders by path, so the head cut hides the same alphabetical tail every time, and `repo.max_diff_bytes` is read at run start so no mid-run change reaches the run it would help. Q-0124's warn names the omitted files on the event stream and Q-0117's `observation:` channel is where a reviewer reports having read them from the branch — a pair that composed on Q-0016, Q-0129 and Q-0130 and is now a mechanism rather than a coincidence. **GO-4** makes the hand pass an obligation rather than a hope. **Q-0128** is the ticket; this is not it.

**R-2 — the implementer reaches for the event union anyway, because it is the obvious shape.** Iteration 1 recommended it and a reader meeting §3.2 in a truncated diff may not see the refusal. **Mitigation:** AC-1 asserts the union's member count is unchanged, so the wrong shape fails a test rather than reaching a reviewer, and the refusal is recorded in §3.2 with its measurement so the reasoning travels with the criterion.

**R-3 — a criterion naming `contracts/`.** §0.5(a). This document names it in **no** criterion, and **GO-2** is where the contract moves. A reviewer asking for a criterion that edits it is asking for the thing that returned `blocked` on Q-0129 round 1, and should be refused with this paragraph.

**R-4 — a browser that never loads the number.** A failed metadata read, or the millisecond window in §3.2. **Mitigation:** AC-4 renders the handle there, which is exactly what ships today, and AC-5 keeps the disclosure for it — so no state gets worse than it is now, which is the bar a change to a shipped screen has to clear.

**R-5 — the `--dry` case is the first one anyone tests.** Q-0129's demonstration was a dry walk; so will the next one be. A dry run **has** a run number — `nextRunId` runs above the guard — and writes no run history, so AC-1 covers it explicitly and GO-3 requires the demonstration to be a real run, where the deferred half's absence is honest rather than incidental.

**R-6 — the correction in AC-3 is made in one place and left in another.** This repository's most-recorded operator failure is fixing the instance a reviewer names rather than the class (Q-0112, five rounds; Q-0039's erratum; Q-0129's rounds 1–4). Two sentences go false and three must not move. **Mitigation:** AC-3 asserts both directions — the corrected sites no longer make the false claim, and the three untouched sentences are byte-identical — so a partial correction fails on the half nobody remembered.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a and preserved. No code path, test or example here touches a key; `check()` is untouched. |
| **Worktree safety** | n/a. Nothing writes to a working tree; `core`'s one change supplies a number. |
| **Gate behaviour** | Unchanged. `gateAnswerSchema` stays the closed three; nothing here answers, offers or affects a gate, and the header's gate link is Q-0015's and does not move. |
| **File format and schema** | **No schema changes at all.** `.quorum/runs/*/manifest.json`, `run-manifest-v1` and `contracts/Q-0011/` are untouched and unread by this half; the event union and `wireRunSchema` are unchanged; the one new declaration is an optional option on a `core` type. |
| **Write boundary** | **Unchanged.** `apps/web`'s two write-capable modules and `WRITE_RULES` are untouched — everything here is a `GET` or a render — and that is asserted rather than assumed. |
| **Lint rules** | No flow file changes, so `lintFlow` is untouched and `quorum lint` 6/6 is expected unchanged. |
| **Cold-clone impact** | None. No new dependency, no new request, no extra step on either supported installation path, and the under-30-minute claim is unchanged. |
| **Product-agnostic** | Nothing names a SaaS product; no code branches on a known vendor name. |
| **Errors explicit** | AC-1 makes a failing supply a `warn` and never a silent default; AC-4 renders the handle and the existing failure account rather than a blank, a dash or a spinner, per `docs/04-architecture.md`'s placeholder rule. |
| **Quality gates** | `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint` and `pnpm typecheck` green, including the mock-adapter end-to-end regression suite. |

---

## 9. Gate obligations

**GO-1 — no decision entry is owed, and the ruling is recorded in the code's own authority comment.** §0.3 measured that every landed sentence on run identity stays true under the out-of-band supply, so there is nothing to supersede. Q-0108's precedent puts a ruling that changes no behaviour and contradicts no landed entry in the authority comment rather than in an entry, and AC-1's option JSDoc is where it goes, naming §3.2's refused alternative so the next ticket on this surface does not re-derive it. **This is the obligation iteration 1 carried as blocking, and it is discharged by the ruling rather than by the gate.** If the gate prefers the in-band member instead, an entry **is** owed and must land before the implement step, verified by `grep` in `.quorum/runs/Q-0131-<n>/steps/001-implement/prompt.txt` with the count recorded — the check Q-0097 lost two errata by not making.

**GO-2 — `contracts/Q-0015/mission-control.contract.md` gains its superseded-by note, written by hand at the gate.** Two clauses move: `:63`'s *"five absent capabilities"* becomes four, and the run number's source changes from the terminal event in the socket snapshot to the metadata read — a clause whose stated premise this ticket removes rather than contradicts, which is worth saying in the note. A landed contract is not edited away; the note names what supersedes what, as Q-0129's did for `contracts/Q-0050/run-events.contract.md`. **No criterion may name this file.**

**GO-3 — the product is run by hand and the demonstration is transcribed, not paraphrased.** A real daemon from `quorum open`, a run started **through the daemon** — a `quorum run` is a different process the host can never see, which is Q-0121's measurement — mission control opened in a browser **while the run is running**, and the transcript recording: the run number rendered while `state` is `running`, the same number appearing afterwards in `runs.log` as `run=N` and as the `.quorum/runs/<TICKET>-N/` directory, and disclosure 1 absent. Record the request that produced the run, as Q-0129's `runs.log` does. **This obligation is written to be unfakeable because its predecessor was not**: Q-0016's GO-6 was reported discharged when its by-hand half had not been performed, and Q-0015's gate found it a day later.

**GO-4 — the omitted tail of every truncated review is read by hand, cross-vendor.** Record the truncation ratio and the omitted file set per round, as Q-0129 and Q-0130 did, so **Q-0128** accumulates evidence rather than impressions.

**GO-5 — verified forced in both environment rows**: a worktree with neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, `--force` in each, plus `quorum lint` and the git-identity sweep. Q-0072's closing finding.

**GO-6 — the successor is allocated at this gate, with Appendix A as its body**, or Appendix A is folded back by erratum if the gate prefers one ticket. Either is cheap; what is not cheap is neither, which is how an obligation recorded only in a closed ticket's prose expires — the drift this plan already records seven directions of.

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
