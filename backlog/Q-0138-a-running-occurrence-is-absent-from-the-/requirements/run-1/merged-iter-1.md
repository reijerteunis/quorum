# Q-0138 — A running occurrence is absent from the retained listing, not described

*Requirements, run 1, merged. Written 2026-09-19 against the tree, not against either candidate. Every figure below was re-derived by executing something; where the two candidates disagreed the disagreement is adjudicated in place and the reason given.*

---

## §0 Measurements

The ticket's closing paragraph says *"What it owes first is a measurement."* This section is that measurement, re-run at the gate rather than relayed from either candidate. Three results correct something, and one of them corrects a candidate's headline.

### M-1 — The mechanism, confirmed in source

Every clause of the ticket's mechanism holds, read rather than inferred:

- `allocate` (`packages/core/src/run-history/writer.ts:541–565`) creates the occurrence directory, pushes the occurrence into `manifest.steps` with `status: 'running'` and `duration_ms: null`, adds it to `active`, and returns. **It does not call `replaceManifest()`.**
- `replaceManifest()` is defined at `writer.ts:518` and called at exactly **three** sites: the end of `terminal()` (`:595`), the end of `finalise()` (`:622`), and once at run start (`:627`, `{ fatal: true }`).
- `persist(occurrence, name, text)` writes the artifact and does not call it.

So the manifest learns of an occurrence only when some occurrence terminates or the run ends.

**Three engine allocation sites, all through that one function** — `steps.ts:283` (adapter), `steps.ts:424` (script), `composite.ts:245` (integrate) — each via `context.persistence.allocateOccurrence` at `engine.ts:279–284`. That is the strongest single argument for where a fix belongs: **one function covers all three occurrence kinds, and no call site has to remember anything.**

**The engine already intends the evidence to survive.** `steps.ts:293` persists the prompt *"Before the vendor is invoked, so that a crash still leaves on disk what was sent."* It does. Nothing can name it.

### M-2 — The live demonstration, in this run, at this gate

This is the correction, and it is sharper than either candidate's.

`.quorum/runs/Q-0138-1/` is this run. Read at the moment this document was written:

```
manifest.status: running   ended_at: null
manifest.steps: [ (pm-claude, completed), (pm-codex, completed) ]     ← 2 entries

steps/ on disk:
  001-pm-claude/      output.txt  prompt.txt
  002-pm-codex/       output.txt  prompt.txt
  003-head-of-product/            prompt.txt      ← executing now, absent from the manifest
```

**The occurrence writing this document is on disk with its prompt retained and is not in the manifest.** `GET /history/Q-0138-1` answers `occurrenceCount: 2`; `GET /history/Q-0138-1/retained` names two occurrences; the step actually running is named by neither.

It is the **serial** case — `head-of-product` follows the parallel pair — which is the 100%-blind one, and it is what both candidates described and neither caught in its own run. **Candidate-claude's M-5 is now false**: it reported `001-pm-claude` as the corpus's one `running` occurrence, and that occurrence has since terminated. The figure was true when taken and expired inside the run that took it, which is the same shape as Q-0018's *"one of 171 is `running` — the run writing the document"*, one turn later.

### M-3 — The corpus, re-counted

| | |
| --- | ---: |
| run directories with a readable manifest | **175** |
| occurrences recorded across them | **954** |
| of those with `status: 'running'` at rest | **0** |
| largest run (`Q-0015-4`) | **55 occurrences, 38,606 B** |

Per flow: `chore` **469**, `requirements` 267, `development` 114, `qa-red` 36, `solutioning` 35, `review` 33.

Candidate-claude reported 952 and candidate-codex 952; the tree holds **954**, the difference being a `started_at` filter. Both candidates independently reported **174 occurrences (18.3%)** as ones a sibling's terminal write could have made visible while still running, and **`chore` at 469 of 469 never visible** — two candidates reaching the same figure from different methods, which is corroboration rather than agreement, and the figure this design rests on. `qa-red` and `solutioning` are 100% blind as well; `development`'s coverage comes from its `fan_out`, and it is still 27% blind.

**Zero `running` occurrences at rest, while an occurrence is executing this instant** (M-2) is the whole defect in one pair of numbers.

### M-4 — The window, and what it costs

Candidate-claude measured, and this gate accepts without re-deriving because nothing in the design turns on the decimal: a median blind window of **1.9 minutes**, p90 **20.2 minutes**, max **87.5 minutes**, with **350 of 954 occurrences absent for over five minutes** and **86.8% of all occurrence-execution time** spent absent.

Write cost, on the largest run here: 55 extra atomic replacements, measured at **~4.9 ms median** per 39 KB replace-with-`fsync`, so **≈0.27 s added to a 41.5-minute run — 0.011%**. That order of magnitude is corroborated by Q-0037's own entry, which measured the existing whole-manifest re-serialise at *"~3 ms against 63 minutes"* on a smaller manifest.

**Q-0037's quadratic caution does not apply**, and this is the measurement that keeps the change small. `manifest.rollup = rollup(manifest.steps)` is called at `writer.ts:594` (`terminal`) and `:621` (`finalise`) only, under *"Whole-list, and therefore quadratic in occurrence count. Why: preserved, see Q-0037."* **An allocation adds no usage**, so an allocate-time write needs no roll-up call. Roll-up invocations stay at N+2 rather than doubling to 2N+2; what doubles is serialisation and `fsync`, which is linear and measured above.

### M-5 — The symptom is a claim, not only an absence

The ticket says a running occurrence is *"absent from the listing"*. Measured against the shipped screen, absence is the third of three surfaces and the second is a false statement:

**(a) The row under-counts.** `packages/server/src/read.ts:171` projects `occurrenceCount: run.manifest.steps.length`; `apps/web/src/history-screen.tsx:613–615` renders it. A live serial run renders **"0 occurrences"** while its step executes. (In this run, "2 occurrences" while three exist.)

**(b) The expansion asserts a negative the product has not established.** `history-screen.tsx:329` renders `NO_OCCURRENCES_TEXT` whenever the ordered list is empty. That sentence (`history-text.ts:177`) is:

> *"This run recorded no occurrences: nothing it did was an adapter call, a script or an integrate step."*

Rendered for a chore run three minutes into an adapter call with a 23 KB `prompt.txt` on disk. **It is not silence; it is a negative derived from a snapshot that had not been taken** — the class Q-0074 and Q-0115 were two whole tickets spent removing, and the class Q-0137's own round-3 major was. Its JSDoc names the distinction it is on the wrong side of: *"Distinguished from a read that is still out… this is the answer having arrived and holding nothing."* The answer arrived. What it holds is older than the question.

**(c) Q-0137 AC-8 sentence 2** — `NO_OUTPUT_RUNNING_TEXT`, *"No output yet: this step has not finished, so nothing has been written for it."* — is unreachable on the serial path, which follows from (a) and (b) rather than standing alone.

**One mitigation already ships and is nearly the right sentence.** `INCOMPLETE_TEXT` (`history-text.ts:139`) — *"This run never recorded an end, so what is here is as far as it got."* — is honest and correctly scoped, and it sits on the **row** while the false sentence sits in the **expansion**, with nothing carrying the qualification across.

### M-6 — A persisted running occurrence is already modelled, and needs no new field anywhere

`contracts/Q-0011/run-manifest.schema.json`, `$defs.step`, read at the gate:

- `status` enum is `["running","completed","failed","aborted","regressed","exhausted","interrupted"]` — **`running` is in it**;
- `additionalProperties: false`, **15 required** fields;
- and `packages/core/src/contracts/run-manifest.ts:163` carries the matching semantic rule, *"steps[…]: status 'running' requires null duration_ms"*.

On the read side, **`incomplete` is already on both wire shapes** — `packages/shared/src/wire.ts:377` (the listing) and `:454` (the detail), each with its zod counterpart — populated from `isIncomplete(run.manifest)` at `read.ts:162` and `:707`. **So neither half of this ticket adds a field to any schema, any wire type or any HTTP response.** That is what makes the screen half cheap and is a fact neither candidate stated.

### M-7 — Nothing is permanently lost, which is why this is p2

Candidate-claude compared `steps/` on disk against `manifest.steps` for every run directory and found **175 of 175 agree**. The defect is **transient, not archival**: a reader who returns after the run ends sees everything. `finalise()` runs on every clean exit and `finaliseActiveOccurrences` closes open occurrences on a signal, so only `SIGKILL` or power loss breaks it and the corpus holds no instance. Offered as a correction to any reading — including a natural reading of the ticket's opening — that would imply retained files are lost.

### M-8 — Nothing exercises the producing path today

`packages/core/src/run-history/retained.test.ts` and `packages/server/src/retained.test.ts` contain no running occurrence (their `running` hits are all *"running as root"*). `apps/web/src/history-retained.test.ts:281` **has** one, in a hand-built fixture. So the chain *real writer → manifest → listing → `NO_OUTPUT_RUNNING_TEXT`* has never been run against a real `RunHistory`: Q-0137's screen half is covered and the half that would produce its input is not. AC-7 and AC-9 are written against a driven writer for that reason.

### M-9 — `--dry` cannot be reached

`engine.ts:279–284` returns `null` from `allocateOccurrence` when there is no history, and `steps.ts:291` records *"The dry case, which returned above, is the only one that allocates nothing."* A dry walk writes no manifest and an allocate-time write cannot reach it. AC-5 pins it, because Q-0135 found a dry walk reporting a run number it had not reserved and nothing here adds a second instance.

### M-10 — One constraint on siting

`packages/core/src/run-history/run-history.source.test.ts:75–86` pins `writer.ts`'s exports to exactly three functions and six types. A fix that adds an exported symbol turns it red by design. **The change belongs inside `allocate`.**

### M-11 — For a CLI-started run this is the only surface

`packages/cli/src/run.ts` imports `runFlow` from `@quorum/core` and never `@quorum/server`, so a `quorum run` is a process the daemon's host can never see — Q-0121's measurement, depended on again. Mission control shows nothing for such a run. **Run history is the only place it is visible at all**, and during the step in progress it says the run recorded no occurrences.

---

## §1 Problem

**In the `maintainer`'s words.** I start a chore run and go and do something else. I come back and open **Run history**, because for a run I started at a command line that is the only screen that knows about it. The row says **0 occurrences**. I open it and it says *"This run recorded no occurrences: nothing it did was an adapter call, a script or an integrate step."*

An adapter call has been running for eleven minutes. Its prompt was written to disk before the vendor was invoked. I cannot see it, I cannot open it, and the screen has not told me it cannot tell — it has told me nothing happened.

Measured, this is the ordinary condition rather than a corner: **81.7% of every occurrence this repository has run was invisible while it ran, 100% of them on the `chore` route**, for a median of 1.9 minutes and a p90 of 20.2 minutes — and it is happening in this run, to this step, right now (M-2).

**What makes it a defect rather than a limitation is the sentence, not the gap.** A screen that said *the manifest was last written before this step started, and the run has not ended* would be reporting a bound honestly, which is the discipline **Connection state** states — *no member of it is silence* — and which **containment**, **push lag** and **verified version** each apply to their own subject. What ships instead is a negative derived from a snapshot that had not been taken.

---

## §2 User stories

**`maintainer` (primary).** As a maintainer watching an active run, I want the run-history drill-down to name the step in progress and the prompt it has already retained, so that I can read what was sent to a vendor while it is still working — and so that when the screen tells me nothing has happened, that is a fact and not a stale snapshot.

**`maintainer` (secondary).** As a maintainer whose run died overnight, I want the manifest to already name every occurrence that got as far as being allocated, so that what is on disk and what is recorded do not depend on whether the process reached its exit.

**`adopter`.** As a stranger running my first flow, I want the first screen that shows me a run in progress not to say that it recorded nothing, because that is the sentence that sends me to check whether the product is broken during the thirty minutes the cold-clone test measures.

---

## §3 Recommended design

**Two halves, in one ticket, because each is unsatisfying alone.**

### (A) `allocate` persists the manifest — the visibility half

One call inside one function (`writer.ts`'s `allocate`, after `manifest.steps.push(occurrence)`): `replaceManifest()`. **Not** `rollup()` — an allocation adds no usage (M-4), and calling it would double the one cost Q-0037 measured and recorded as preserved.

Why this and not the alternatives the ticket names:

- **Not reading `steps/` from the route.** `listRetainedFiles` iterates `manifestOccurrences(read.manifest)` and nothing else, and Q-0137 AC-1 and §4.3 make the listing manifest-derived and forbid `packages/server` from composing a path. A route that enumerated the directory would invent occurrences the manifest does not record. Both candidates refuse it; so does this.
- **The write-path objection is answered by measurement, not waved past**: 0.27 s on the largest run here, 0.011% of its wall time, no roll-up call added, no schema change (M-6), unreachable from a dry walk (M-9), at **one site covering all three occurrence kinds** (M-1).

### (B) An incomplete run's expansion stops claiming — the honesty half

**(A) narrows the window and can never close it, and that is a property of the architecture rather than of the implementation.** `contracts/Q-0015/mission-control.contract.md:9` says *"Refresh is the only repeat read; no timer performs one"*, and that clause is untouched here. So the screen holds a snapshot taken at a moment, the manifest holds a snapshot written at a moment, and a reader is always looking at two bounds. After (A) the residual states are real: between `allocate` returning and the write completing; a run in its first instants; a run that died before its first step. In every one of them the shipped sentence asserts that nothing happened.

So for a run the response reports as `incomplete`, the expansion must not say *"nothing it did was an adapter call, a script or an integrate step"*. It must say what it can bound — that this is what the manifest last recorded and the run has not ended — and claim nothing about what is missing. **`incomplete` is already on the detail response** (M-6), so this needs no new field and no new route.

**The candidates' one real disagreement, adjudicated rather than averaged.** Candidate-codex rejects *"a generic screen message such as 'this run may contain unnamed occurrences'"*, on the ground that no history response can know an unrecorded occurrence exists and that inventing one would need hidden daemon state. **That objection is correct and does not reach (B).** (B) asserts nothing about unnamed occurrences; it states the bound of a snapshot from a field already on the wire. What codex refused is a claim; what (B) requires is the withdrawal of one.

**(B) is not a fallback for (A) and (A) is not a substitute for (B).** (B) alone leaves the reader unable to see the running step — honest and useless. (A) alone leaves a sentence that is false for a smaller fraction of the time, which is the *fix the instance, not the class* shape this repository has recorded most often.

---

## §4 Acceptance criteria

Twelve, numbered independently. Each names its surface.

**AC-1 — `allocate` persists, at one site, inside `allocate`.**
`RunHistory.allocate` replaces the manifest after adding the occurrence, so a manifest read from disk at any moment after an allocation returns names that occurrence with its `occurrence_dir`, `status: 'running'` and `duration_ms: null`. `run-history.source.test.ts`'s export register (M-10) passes untouched.
*Surface:* `packages/core/src/run-history/writer.ts`.
*Test:* drive a real `RunHistory`; allocate; **without terminating anything**, read `manifest.json` off disk — not `history.manifest` in memory — and assert it holds the occurrence and those three values. Assert the same for a second and third allocation with the first still open. Shown red against the unchanged function.

**AC-2 — It reuses the atomic replacement and allocates nothing twice.**
The allocate-time write goes through the existing `replaceManifest()` path — a complete same-directory temporary file, flushed, closed, renamed over `manifest.json`, with no successful path writing in place — and persisting an allocation does not consume a second sequence number, duplicate a manifest entry, create a second occurrence directory, or change occurrence ordering.
*Surface:* as AC-1.
*Test:* allocate three occurrences; assert `occurrence_dir` names `001`, `002`, `003` once each, `manifest.steps` has three entries in that order, and `steps/` holds three directories. Assert no in-place write to `manifest.json` occurs on the success path.

**AC-3 — It does not recompute the roll-up.**
The allocate-time write persists whatever roll-up the last `terminal()` or `finalise()` left; a manifest holding only running occurrences carries `rollup: []`.
*Surface:* as AC-1.
*Test:* count roll-up computations across a run of N occurrences and assert **N+2, not 2N+2** — the figure M-4 rests on, red if a later change adds one — and assert `rollup` is `[]` after three allocations with no terminal.

**AC-4 — A failed allocate-time write is non-fatal, exactly as `terminal()`'s is.**
It costs one `host.warn` naming the manifest path and the condition, and nothing else: the occurrence is returned, its directory exists, the run continues, and a later successful replacement still persists it. It never throws and never prevents a step being allocated. The run-start write stays fatal.
*Surface:* as AC-1.
*Test:* make the manifest write throw; assert `allocate` returns an occurrence, the warn was collected with the path in it, and a subsequent `terminal()` records the step.

**AC-5 — A dry walk still allocates nothing and writes nothing.**
*Surface:* `packages/core/src/engine`.
*Test:* `--dry` over a flow with adapter, script and integrate steps; assert no run directory is created and `allocateOccurrence` answered `null` at every site. Must be shown to fail if `allocate` is reached under `dry`. (Q-0135 regression.)

**AC-6 — A persisted running occurrence is schema-clean. *Not eligible for trimming.***
A manifest written while an occurrence is running holds exactly the schema's 15 required keys for that occurrence and no sixteenth, and the semantic pass returns `ok: true` for a manifest written at each of the three moments — after run start, after an allocation with a running occurrence, and after `finalise`.
*Surface:* `packages/core/src/run-history/writer.ts:141–154`, `packages/core/src/contracts/run-manifest.ts`.
*Test:* assert the key set by equality against the schema's `required` list, and run `validateArtifact` at all three moments. This pins Q-0034's preserved design at the moment this change makes it reachable on **every** run rather than on 18% of them (R-1), and must go red if any bookkeeping field is stamped on the occurrence object.

**AC-7 — The core reader names a step before that step ends, driven by the real writer.**
*Surface:* `packages/core/src/run-history/reader.ts`, driven by `writer.ts` — the gap M-8 names.
*Test:* initialise a real `RunHistory`, allocate one occurrence, `persist` a `prompt.txt` into it, and — **without terminating it** — call `listRetainedFiles`. Assert the occurrence is in `occurrences` with `prompt.txt` and its byte count, and `warnings` is empty. The manifest must be the one the writer wrote, not a fixture.

**AC-8 — The row counts it.**
`GET /history`'s `occurrenceCount`, and the row that renders it, report the occurrences the manifest holds at the moment of the read, so a run with one allocated unfinished step reports `1 occurrence`, singular.
*Surface:* `packages/server/src/read.ts:171`, `apps/web/src/history-screen.tsx:613–615`.

**AC-9 — Both routes answer it over a real socket, without a sibling terminating.**
`GET /history/:id` includes the occurrence with `status: 'running'`, and `GET /history/:id/retained` includes the same occurrence under the same `seq` and `step_id`, with its `prompt.txt` and no `output.txt`, 200 and no warning.
*Surface:* `packages/server`.
*Test:* the AC-7 arrangement behind a running daemon. The fixture must expose a deterministic barrier after allocation and before completion rather than infer the state from a sleep, and **must not terminate a second occurrence to make the first visible** — that is the state that already works.

**AC-10 — The screen renders Q-0137 AC-8 sentence 2 for an occurrence a real writer produced.**
A running occurrence whose directory holds `prompt.txt` and no `output.txt` renders `NO_OUTPUT_RUNNING_TEXT` and never `NO_OUTPUT_TERMINAL_TEXT`. No new placeholder or alternative running-state copy is introduced.
*Surface:* `apps/web`.
*Test:* `history-retained.test.ts` keeps its hand-built fixture; **this** criterion asserts that the wire shape reaching it is one the writer actually produces, so the fixture and the producer cannot drift. Satisfying it by editing the fixture alone must leave it red.

**AC-11 — An incomplete run's expansion never claims nothing happened. *Not eligible for trimming.***
Where the run the expansion belongs to carries `incomplete: true`, `NO_OCCURRENCES_TEXT` is not rendered; what is rendered states the bound — that this is what the manifest last recorded and the run has not ended — names no remedy it cannot back, and claims nothing about occurrences it cannot see.
*Surface:* `apps/web/src/history-screen.tsx:329`, `apps/web/src/history-text.ts:177`.
*Test:* an `incomplete` run with an empty `steps` array renders neither the old sentence nor an empty region; a **complete** run with an empty `steps` array still renders the old sentence unchanged. The second half is what stops this being a deletion.

**AC-12 — Every source sentence describing the old write cadence is corrected in place, and a finished run is unchanged.**
At minimum `writer.ts:141–154` (*"the whole array is re-serialised on each terminal occurrence"*, and *"It hid because the old code deleted the field just before its own write: only a sibling finishing first… persisted it"*) and `RunHistory.allocate`'s JSDoc, corrected rather than appended to. And the manifest a run leaves at `finalise` is byte-identical to what it is today for the same sequence of calls, so `isIncomplete`, the detail projection, the listing's other columns and mission control behave exactly as before for every completed run.
*Surface:* `packages/core/src/run-history/writer.ts`, `packages/server/src/read.ts`.
*Test:* a guard asserting no surviving source sentence claims the manifest is written only on a terminal occurrence, shown red against the pre-change text; plus an equality assertion on the final manifest of a completed run across the change.

---

## §5 Non-goals

Carried from the ticket, plus six the measurements and the adjudication added:

1. **Q-0137's half is not reopened.** Both routes, the confinement, the identity comparison and the screen shipped and are `main:contained`.
2. **No cap, retention or eviction.** Q-0076 owns the write side, Q-0123 the daemon's records.
3. **The manifest's shape is not changed**, and `readRun` stays *"a cast, never a check"*. No field is added to `RunManifest`, `Occurrence`, any wire type or any HTTP response.
4. **The route does not enumerate `steps/`**, and `packages/server` composes no occurrence path — Q-0137 AC-1 and §4.3.
5. **No daemon-only count or signal** for occurrences the manifest does not hold. Files are the database, and a hidden register would contradict it. *(candidate-codex's ruling, adopted.)*
6. **The roll-up's quadratic shape is not repaired**, and the whole-list serialisation is not optimised, batched, journaled or made incremental. Q-0037 recorded it as preserved; M-4 shows it need not be touched.
7. **No automatic refresh, timer or polling on the screen.** `contracts/Q-0015`'s *"Refresh is the only repeat read; no timer performs one"* is unchanged and still binds. This ticket changes **when the existing read returns an occurrence**, never when a browser issues one.
8. **Events are not persisted and no trace is served for a finished run.** Q-0018 AC-14c ruled it; nothing here reverses it.
9. **Mission control is not changed** — it reads the event stream, not the manifest — and **resume is Q-0019's**.
10. **`occurrence_dir` does not become an input** under any spelling, on either route.

---

## §6 Open questions

All answered. **None blocks solutioning.** Stated rather than asked, per Q-0105's remedy; the two the candidates marked BLOCKING are ruled here, because size and *is an entry owed* are this gate's to settle and forwarding them is what costs a round.

**OQ-1 — Is a decision entry owed? Ruled: no.** The test this repository applies is *does any landed sentence go false?*, checked at six sites and re-verified at the gate:

| site | verdict |
| --- | --- |
| `harness/rules.md` *"Files are the database"* | writing sooner **strengthens** it |
| `docs/GLOSSARY.md` **Run history** | describes contents, not cadence — unaffected |
| `docs/GLOSSARY.md` **Occurrence** — *"what actually executed… the unit a roll-up sums over"* | unaffected; the roll-up sums the same set (AC-3) |
| `contracts/Q-0011/run-manifest.schema.json` | **already models it** (M-6); no format change |
| Q-0037's preserved quadratic roll-up | **not touched** (M-4, AC-3) |
| *"A dry run changes nothing the caller passed it"* (2026-09-11) | unaffected; unreachable under `dry` (M-9, AC-5) |

The one sentence that goes false is a **source docblock** whose own reasoning expires by its terms, which AC-12 corrects. That is Q-0137 GO-1's shape and Q-0108's precedent: a ruling that changes no behaviour and contradicts no landed entry belongs in the code's own authority comment. **GO-1 ratifies it at the gate so round one does not spend itself asking.**

**OQ-2 — Is this one ticket? Ruled: yes, at twelve criteria.** Q-0013 was refused at eighteen and split in three; Q-0122 accepted twenty and paid three implement rounds; Q-0126 refused a split at sixteen and paid $177.92 with a round-1 `blocked`. Twelve is inside the ceiling. **The seam is written out in advance rather than left for a later gate** (Q-0122's discipline): **(A)** is AC-1 to AC-9 and AC-12, inside `packages/core` and `packages/server`; **(B)** is AC-10 and AC-11, inside `apps/web`. They are separable, and (B) can run first if it must, because its subject — a false sentence over an empty list — exists whether or not (A) lands. **AC-6 and AC-11 are named as not eligible for trimming**: the first protects a defect this change makes certain, the second is the only one that withdraws a false claim.

**OQ-3 — Should the allocate-time write `fsync`? Answered: reuse `replaceManifest` unchanged.** A `rename` without `fsync` would be cheaper and is for a reader on the same machine rather than for crash durability — but two durability contracts on the one file a run must never lose is a second thing to reason about, bought for a saving M-4 measures at 0.27 s. Owner: the implementer; measure before diverging.

**OQ-4 — Should (B) distinguish *not yet written* from *genuinely nothing*? Answered: no, one sentence claiming neither.** The manifest cannot tell them apart, which is itself the honest answer and is what AC-11's wording requires.

**OQ-5 — Can the `warnings` array carry (B)? Answered: no.** `WireRunHistoryRetainedWarning` requires a `seq` and a `step_id`, and an occurrence the manifest has not recorded has neither. (B) is therefore a property of the region, not an entry in that array. Recorded so an implementer does not find out at round two. *(Reached independently by both candidates.)*

**OQ-6 — Should manifest persistence later become incremental or journaled?** Outside this ticket (non-goal 6). Owner: the maintainer, and only if GO-3's measurement crosses its threshold or a later run exceeds the present 55-occurrence maximum.

---

## §7 Risks

**R-1 — This change makes a latent defect certain, which is an argument for AC-6 rather than against the change.** `writer.ts:141–154` records that a bookkeeping field stamped on a still-running occurrence reaches `manifest.json` and violates `additionalProperties: false`, and that *"It hid because the old code deleted the field just before its own write: only a sibling finishing first, or a kill in that window, persisted it."* Persisting at allocate removes the hiding place: the same mistake would fail on **every** run rather than on 18% of them. An intermittent schema violation is worse than a deterministic one — but the `occurrenceStart` side table becomes load-bearing on every run, and a contributor who does not read its docblock is shown that immediately rather than eventually.

**R-2 — Write amplification is measured on one filesystem.** 4.9 ms median is APFS on local disk. A network or fuse-mounted repository could be an order of magnitude worse, and the cost scales with occurrence count and manifest size, which grow together. Bounded and linear, and not measured off this machine. GO-3 is what makes it visible.

**R-3 — More manifests will carry a running occurrence at rest.** A crash between an allocate write and the terminal write leaves one, where the same crash leaves a manifest that never knew. The state is modelled (M-6), `isIncomplete` already reports it, and the corpus figure *"0 running across 954"* (M-3) stops being representative — so any check keyed on that figure is keyed on what this machine happens to hold, and `history-text.ts`'s corpus citations should be read with that in mind.

**R-4 — The subject is a screen defect and the remedy is a write-path change.** Q-0118's finding is that lifecycle changes attract lifecycle defects, and the one file this touches is the file whose docblock says a run must never lose it. **The review should be weighted at `writer.ts` rather than at the screen**, and AC-4 exists because a write that can throw where none could before is the way this goes wrong.

**R-5 — A test that reads only the in-memory manifest would pass before the fix.** It is the obvious way to satisfy AC-1 weakly. AC-1 requires a read from disk and AC-7 requires the real writer for exactly this reason. *(candidate-codex's risk, adopted verbatim in substance.)*

**R-6 — The review diff.** Q-0128's subject. This change should be small — one function, one screen region, one projection, plus tests — so **no truncation is predicted** against the 200,000-byte cap. Q-0018 and Q-0131 came in under; Q-0137 predicted the same and was refuted at 74.7% falling to 64.9%, so the prediction is to be **measured rather than assumed** (GO-4). If it truncates, the alphabetical tail `git diff` loses is `packages/shared` and `packages/server/src/read.ts`, which AC-8 lands in.

---

## §8 Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No credential, vendor login, environment read, API-key path, fixture or example is added or changed. |
| **Worktree safety** | n/a. The only new write is under `.quorum/runs/<run id>/`, which `excludeRunState` already places in `info/exclude`. Nothing is written to the user's working tree. |
| **Gate behaviour** | Unchanged. No gate, no answer vocabulary, no `auto` or `human-locked` behaviour is touched. |
| **File format and schema** | **Unchanged.** The state written is already in the schema's `status` enum and already has a semantic rule (M-6). AC-6 proves it. |
| **Cross-vendor rule and flow lint** | Unchanged. No flow file, role or lint rule is touched. |
| **Lint rules and dependencies** | None added. No new dependency, no deprecated API. |
| **Cold-clone impact** | Positive and small: the first screen an adopter sees for a run in progress stops saying the run recorded nothing. No command, install step or first-run interaction is added. |
| **Product-agnostic** | Yes. No product or adapter name reaches any sentence. |
| **Errors are explicit** | AC-4 keeps a failed write a named warning rather than a silent default; AC-11 removes a silent default already shipped. |
| **Files are the database** | Strengthened — the database learns of a step when the step starts rather than when a sibling finishes. |

---

## §9 Gate obligations

**GO-1 — Ratify OQ-1 in the ticket body before the run starts.** §6 states that no decision entry is owed and names the six sites. If the gate rules otherwise, the entry must be **written at the gate and verified present in the implement step's actual `prompt.txt` by grep** — the check Q-0097 lost two errata by not making and Q-0125, Q-0129 and Q-0137 each made. Either way the ruling goes in the body, so round one does not spend itself asking a question `developer-generalist` may not answer.

**GO-2 — Ratify or move the seam, in an erratum, before the chore run.** §6 OQ-2 rules one ticket at twelve. If the gate accepts, the erratum names the seam in advance and names **AC-6 and AC-11 as not eligible for trimming**, so an exhaustion is answered by a split rather than by a fourth round (Q-0122's discipline, which Q-0126 paid $177.92 for not having).

**GO-3 — Record the write cost, both arms, same machine.** A fixture allocating and terminating **55 occurrences** — the largest run retained — measured before and after on the same filesystem, Node version and method: manifest replacements, total bytes written, and elapsed p50/p95 over at least 30 iterations after five discarded warm-ups. This is **evidence in the implementation report, not a timing-dependent test**. If the allocation-to-finalisation p95 rises by more than 100 ms **or** more than 10%, the report says so and a successor is opened for the performance question **before this ticket closes**; the change does not silently expand into a manifest optimisation (non-goal 6). *(candidate-codex's AC-12/AC-13, re-sited from criteria to here because a criterion whose test is "a report contains a figure" is evidence rather than behaviour.)*

**GO-4 — Measure the review diff and record the figures whether or not it truncates**, so R-6's prediction is settled either way and **Q-0128** gains a fourth data point. If it truncates, read the omitted files off the implement branch and report that as an `observation:` — the Q-0124-warn / Q-0117-channel pair, which has now composed on five consecutive tickets.

**GO-5 — Discharge by running the product and transcribing what it rendered.** Not *"verified by the suite"*. A real daemon from `quorum open`, the **served bundle verified by content first** (a cache hit can serve a page built from code nobody is looking at — Q-0137's GO-5 reported `5 cached, 5 total`), a real run started **through the daemon** because a `quorum run` is a process the host can never see (Q-0121), and the run-history row opened **while a step is running**. `runs.log` must record: the row's occurrence count, the occurrence's step id and kind, the sentence rendered for its status, the files the listing named with their byte counts, and what is rendered in place of `NO_OCCURRENCES_TEXT`.
**Choose a row that can contradict itself** (Q-0018's lesson): a **`chore`** run, which M-3 measures at 469 of 469 blind — not a `requirements` run, whose parallel pair can mask the defect, and which is exactly how this run's own `pm-claude` was visible while `head-of-product` was not (M-2).

**GO-6 — Verify forced in both environment rows**: a worktree with neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, after `pnpm install --frozen-lockfile`, with `pnpm turbo run test --force --continue`, `pnpm lint`, `pnpm typecheck`, `quorum lint` and the git-identity sweep.

---

## §10 Provenance

**candidate-claude contributed the shape and most of the evidence.** The two-half design — persist at `allocate`, and stop the expansion claiming — is its framing, and its §0 is the better measurement: the per-flow blindness table (`chore` 469 of 469), the blind-window percentiles, the occurrence-seconds figure, the write-cost measurement with the roll-up correctly excluded, the `--dry` unreachability, the export-register constraint, and M-5's finding that the symptom is a **false sentence** rather than only a gap — which is the single most valuable thing either document holds and which candidate-codex's problem statement does not contain. Its AC-11 (here AC-6), pinning the Q-0034 side table at the moment this change makes it reachable on every run, is adopted with its risk paragraph.

**candidate-codex contributed the sharper write-path criteria and the discipline around them.** Its AC-2 and AC-3 (no second sequence number, no duplicate entry, no reordering, the atomic sequence as contract rather than outcome), its AC-4 (the non-fatal replacement contract stated explicitly, with the run-start write staying fatal), its AC-11 (no roll-up recompute, reached independently), its AC-7's insistence that the daemon test must not terminate a sibling to stage the state, and its risk that a test reading only the in-memory manifest would pass before the fix are all carried. Its OQ-5 answer — that an unrecorded occurrence cannot be expressed as a warning, both candidates reaching it independently — is recorded so nobody discovers it at round two.

**What this gate struck.** Candidate-codex's AC-12 and AC-13 are re-sited to **GO-3**: a criterion whose test is *"the implementation report records a figure"* is evidence rather than behaviour, and AC-13's *"open a successor if the threshold is crossed"* is a gate obligation plus a non-goal, not something a suite can hold. Its AC-15 (run the suite this way) is re-sited to **GO-6**, and its AC-16 (a nine-item cross-cutting checklist as one criterion) to **§8**, where the same content is a checklist rather than a criterion pretending to be independently testable. Candidate-claude's fourteen were folded to twelve: its AC-5 and AC-6 are kept separate (core reader and daemon route are genuinely different subjects, and M-8 shows the core reader is the uncovered one), while its AC-10 and AC-11 are one criterion over one subject, and its AC-12 is a clause of AC-1.

**What this gate adjudicated rather than averaged.** The candidates disagree on whether the screen should say anything: candidate-codex rejects a message asserting unnamed occurrences, candidate-claude requires withdrawing a message asserting none. §3 (B) rules that codex's objection is correct and does not reach claude's half — stating the bound of a snapshot claims nothing about what is missing — and M-6 supplies the fact that makes it cheap, which neither candidate had: **`incomplete` is already on both wire shapes**, so the honest sentence needs no new field, no new route and no daemon state. Both blocking questions were ruled here rather than forwarded.

**What this gate measured that neither candidate did.** M-2: the defect demonstrated **live and serial** in this run's own manifest, `003-head-of-product` on disk with its prompt and absent from a manifest recording two occurrences — which also corrects candidate-claude's M-5, whose `running` occurrence terminated inside the run that reported it. M-3: the corpus re-counted at 954 occurrences across 175 manifests with **zero** `running` at rest while one executes. And §3's architectural point, which changes AC-11's wording and adds non-goal 7: `contracts/Q-0015`'s *"Refresh is the only repeat read; no timer performs one"* still binds, so persisting sooner narrows the window and can never close it, and what the screen shows is bounded by when it read as well as by when the manifest was written.
