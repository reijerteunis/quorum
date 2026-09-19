# Q-0138 — A running occurrence is absent from the retained listing, not described

*Requirements, run 1, candidate-claude. Written 2026-09-19 against the tree at the time of the run, not against the ticket body. Every figure below was derived by executing something; where a figure came from the ticket it is marked and re-derived.*

---

## §0 Measurements

The ticket's own closing paragraph says *"What it owes first is a measurement."* This section is that measurement. It is first because three of its results change the shape of the work, and two of them refute cautions the ticket body raises.

### M-1 — The mechanism, confirmed in source

Every clause of the ticket's mechanism holds, verified by reading rather than inferred from the one observation:

- `allocate` (`packages/core/src/run-history/writer.ts:542–566`) creates the occurrence directory, pushes the occurrence into `manifest.steps` with `status: 'running'`, and **does not call `replaceManifest()`**.
- `replaceManifest()` is defined at `writer.ts:518` and called at exactly **three** sites: the end of `terminal()` (`:595`), the end of `finalise()` (`:622`), and once at run start (`:627`, `{ fatal: true }`).
- `persist(occurrence, name, text)` (`:598–610`) writes the artifact and **does not** call it.

So the manifest gains an occurrence on disk only when some occurrence terminates.

**There are exactly three allocation sites in the engine**, and all three go through that one `allocate`:

| site | kind |
| --- | --- |
| `packages/core/src/engine/steps.ts:283` | `adapter` |
| `packages/core/src/engine/steps.ts:424` | `script` |
| `packages/core/src/engine/composite.ts:245` | `integrate` |

That is the strongest single argument for where a fix belongs: **one function covers all three kinds**, and no call site has to remember anything.

**And the engine already intends the evidence to survive.** `steps.ts:293` reads, above the prompt write: *"Before the vendor is invoked, so that a crash still leaves on disk what was sent."* The artifact is deliberately durable; the manifest that would **name** it is not. The two halves of one intention are written at different moments, and only the second is read.

### M-2 — How often the parallel case already covers it: 18.3%

The ticket asks this by name. Measured across all 175 run directories in `.quorum/runs` (952 occurrences carrying a `started_at`), an occurrence was *ever* visible in the listing while still running if and only if some sibling's terminal write fell inside its own lifetime:

| | occurrences | |
| --- | ---: | ---: |
| ever visible while still running | 174 | **18.3%** |
| never visible until it had ended | 778 | **81.7%** |

By flow, which is where the answer stops being an average:

| flow | occurrences | never visible | share of step time absent |
| --- | ---: | ---: | ---: |
| `chore` | 469 | 469 | **100%** |
| `qa-red` | 36 | 36 | **100%** |
| `solutioning` | 35 | 35 | **100%** |
| `requirements` | 265 | 185 | 65.1% |
| `review` | 33 | 22 | 43.7% |
| `development` | 114 | 31 | 29.8% |

**`chore` is 469 of 469.** That is the route 55 of this repository's tickets took, and the route every machinery ticket takes. `qa-red` and `solutioning` are 100% as well. Two of the six shipped flows declare a `parallel:` block (`requirements.yaml:6`, `review.yaml:6`), one each; `development.yaml`'s concurrency comes from its `fan_out`, which is why it is the best-covered flow and still 27% blind.

**The parallel case covers it partially even where it applies**, which is the part the ticket's framing misses: the *first* sibling to finish is never visible while running, and the second becomes visible only for the tail of its life. That is why `requirements` is 70% blind despite having a parallel pair — the pair contributes at most one visible occurrence, and the `head-of-product` step that follows is serial.

### M-3 — The share of execution time spent absent: 86.8%

Occurrence-seconds are the reader-facing unit: they answer *if I open this screen while a step is running, is the step there?*

- Total occurrence execution time across the corpus: **485,894 s**
- Of which spent absent from the listing: **421,827 s — 86.8%**

Sampled a second way, over run wall-clock at 400 points per run: 62.4% of total run wall time has **no** occurrence running at all (a run parked at a human gate allocates nothing, which is correct). Of the time a run is actually executing a step, **88.6% of it the step in progress is absent.** The two methods agree within two points.

### M-4 — How long the blind window lasts

| | median | p75 | p90 | p99 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| all occurrences (n=954) | **1.9 min** | 9.2 min | 20.2 min | 53.9 min | **87.5 min** |
| `chore` only (n=469) | 1.8 min | — | 32.8 min | — | 87.5 min |

**350 of 954 occurrences — 37% — were absent for over five minutes.** A maintainer watching a chore implement round sees nothing for a median of 1.8 minutes and, one time in ten, for over half an hour.

### M-5 — Demonstrated live, by the run writing this document

`.quorum/runs/Q-0138-1/` is this run. Its manifest now records:

```
flow: requirements   status: running   ended_at: null
  steps/001-pm-claude   kind=adapter  status=running     duration_ms=null   started 14:23:00.315
  steps/002-pm-codex    kind=adapter  status=completed   duration_ms=154453 started 14:23:00.317
```

Both occurrences were allocated within 2 ms of each other. **Nothing was persisted for 154 seconds**, during which both directories existed and `001-pm-claude/prompt.txt` held 23 KB — which reproduces the ticket's own observation exactly (two directories with prompts, `steps: 0`, an empty listing). When `pm-codex` terminated, that single write made both visible, including `pm-claude` still running.

**`001-pm-claude` is the only `running` occurrence in the entire corpus** — 938 `completed`, 15 `failed`, 1 `running`. So the state Q-0137 AC-8 sentence 2 was written for exists exactly once here, and it is this step. That is the second consecutive requirements run to find its own run as the corpus's one incomplete record; Q-0018's did the same.

### M-6 — The symptom is worse than the ticket states: it is a claim, not an absence

The ticket says a running occurrence is *"absent from the listing rather than carrying Q-0137 AC-8's sentence 2."* Measured against the shipped screen, absence is only the third of three surfaces, and the second is a false statement:

**(a) The listing row under-counts.** `packages/server/src/read.ts:171` projects `occurrenceCount: run.manifest.steps.length`, and `apps/web/src/history-screen.tsx:613–615` renders `{run.occurrenceCount} occurrence{s}`. A live serial run renders **"0 occurrences"** while its step is executing.

**(b) The expansion asserts something false.** `history-screen.tsx:328–329` renders `NO_OCCURRENCES_TEXT` whenever the ordered occurrence list is empty. That sentence (`history-text.ts:177`) is:

> *"This run recorded no occurrences: nothing it did was an adapter call, a script or an integrate step."*

For a chore run three minutes into its `implement` step, that is rendered while an adapter call is in progress with a 23 KB `prompt.txt` on disk. **It is not silence; it is a negative the product has not established** — the class Q-0074 and Q-0115 were two whole tickets spent removing, and the class Q-0137's own round 3 major was. Its JSDoc even names the distinction it is on the wrong side of: *"Distinguished from a read that is still out… this is the answer having arrived and holding nothing."* The answer did arrive. What it holds is a snapshot older than the question.

**(c) Q-0137 AC-8 sentence 2 is unreachable on the serial path**, which is what the ticket says, and which follows from (a) and (b) rather than standing alone.

**One mitigation already ships and is nearly the right sentence.** The row renders `INCOMPLETE_TEXT` (`history-text.ts:139`) beside the status for any run where `isIncomplete` holds: *"This run never recorded an end, so what is here is as far as it got."* That is honest and correctly scoped — and it sits on the **row**, while the false sentence sits in the **expansion**, with nothing carrying the qualification across.

### M-7 — Nothing is permanently lost, and this is a correction

Compared `steps/` on disk against `manifest.steps` for every run directory:

> **175 of 175 agree. 0 disagree.**

So the defect is **transient, not archival**. A reader who returns after the run ends sees everything. This is the measurement that argues against treating it as p1, and it is offered as a correction to any reading — including a natural reading of the ticket's own opening — that would imply retained files are lost.

It holds because `finalise()` runs on every clean exit and `finaliseActiveOccurrences` closes open occurrences on a signal (`engine.ts:290–295`, typed `'failed' | 'interrupted'`). Only `SIGKILL` or power loss breaks it, and the corpus has no instance. `Q-0138-1` is the corpus's one unfinalised manifest and even it agrees, 2 against 2.

### M-8 — A persisted running occurrence is already a modelled state

`contracts/Q-0011/run-manifest.schema.json`, `$defs.step`:

- `status` enum is `["running","completed","failed","aborted","regressed","exhausted","interrupted"]` — **`running` is in it**.
- `duration_ms` is `{"type":["integer","null"],"minimum":0}`.
- `additionalProperties: false`, with 15 required fields.

And the semantic pass has an explicit rule for it — `packages/core/src/contracts/run-manifest.ts:163`: *"steps[…]: status 'running' requires null duration_ms"*.

**So writing a running occurrence changes no file format and needs no schema work.** It is a state the contract was written for, exercised once in the corpus (M-5), and validated today.

### M-9 — What an extra write per allocation costs, measured on the largest run

`Q-0015-4` — the largest run here: **55 occurrences, 41.5 minutes, final manifest 38,605 B.**

| | writes | bytes written |
| --- | ---: | ---: |
| today (1 start + 55 terminal + 1 finalise) | 57 | 1,154,106 |
| with one write per allocation | 112 | 2,231,979 (**+93%**) |

Cost of one 39 KB atomic replace with `fsync`, 60 iterations on this machine (APFS, temp directory): **median 4.93 ms, p95 5.26 ms, max 6.08 ms.**

> **55 × ~4.9 ms ≈ 0.27 s added to a 41.5-minute run — 0.011%.**

**And the ticket's quadratic-roll-up caution does not apply.** `rollup(manifest.steps)` is called only in `terminal()` (`writer.ts:594`) and `finalise()` (`:621`), under the comment *"Whole-list, and therefore quadratic in occurrence count. Why: preserved, see Q-0037."* **An allocation adds no `usage`**, so an allocate-time write needs no roll-up call at all. The quadratic term stays at its current 57 invocations rather than doubling to 112. What doubles is serialisation and `fsync`, which is linear and measured above.

### M-10 — `--dry` allocates nothing, so it cannot be reached

`engine.ts:279–284`: `allocateOccurrence` returns `null` when there is no history. `steps.ts:291`: *"The dry case, which returned above, is the only one that allocates nothing."* A dry walk therefore writes no manifest, and an allocate-time write cannot reach it. This matters because Q-0135 found a dry walk reporting a run number it had not reserved; nothing here adds a second instance.

### M-11 — Nothing exercises the end-to-end path today

- `packages/core/src/run-history/retained.test.ts` — no running occurrence.
- `packages/server/src/retained.test.ts` — no running occurrence.
- `apps/web/src/history-retained.test.ts` — **has** one, in a hand-built fixture.

So the chain *real writer → manifest → listing → `NO_OUTPUT_RUNNING_TEXT`* has never been run against a real `RunHistory`. Q-0137's screen half is covered; the half that would produce the input is not. That gap is why AC-4 and AC-6 below are written against a driven writer rather than against a fixture.

### M-12 — For a CLI-started run this is the only surface

`packages/cli/src/run.ts:29` imports `runFlow` from `@quorum/core` and never `@quorum/server`, so a `quorum run` is a process the daemon's host can never see — Q-0121's measurement, depended on again here. Mission control is fed by the daemon's socket and shows nothing for such a run. **Run history is the only place a CLI-started run is visible at all**, and during the step in progress it says the run recorded no occurrences.

### M-13 — One constraint on where the fix may live

`packages/core/src/run-history/run-history.source.test.ts:75–86` pins `writer.ts`'s exports to exactly `acquireRunLock`, `initialiseRunHistory`, `nextRunId` and six types. A fix that adds an exported symbol to that file turns it red by design. The change belongs inside `allocate`.

---

## §1 Problem

**In the `maintainer`'s words.** I start a chore run on a ticket, either from the ticket page or from a command line, and go and do something else. I come back and open **Run history**, because for a run I started at a command line that is the only screen that knows about it. The row says **0 occurrences**. I open it and it says **"This run recorded no occurrences: nothing it did was an adapter call, a script or an integrate step."**

An adapter call has been running for eleven minutes. Its prompt was written to disk before the vendor was invoked. I cannot see it, I cannot open it, and the screen has not told me it cannot tell — it has told me nothing happened.

Measured, this is the ordinary condition rather than a corner: **81.7% of every occurrence this repository has ever run was invisible while it ran**, 100% of them on the `chore` route, for a median of 1.9 minutes and a p90 of 20.2 minutes.

**What makes it a defect rather than a limitation is the sentence, not the gap.** A screen that said *the manifest was last written before this step started* would be reporting a bound honestly, which is the discipline **Connection state** states — *no member of it is silence* — and which **containment**, **push lag** and **verified version** each apply to their own subject. What ships instead is a negative derived from a snapshot that had not been taken.

**And it defeats an intention already in the code.** `steps.ts:293` persists the prompt *"so that a crash still leaves on disk what was sent"*. It does. Nothing can read it.

---

## §2 User stories

**`maintainer` (primary).** As a solo maintainer with a run going, I want the run-history drill-down to name the step in progress and the prompt it has already retained, so that I can read what was sent to a vendor while it is still working rather than after it has finished — and so that when the screen tells me nothing has happened, that is a fact and not a stale snapshot.

**`maintainer` (secondary).** As a maintainer whose run died overnight, I want the manifest to already name every occurrence that got as far as being allocated, so that what is on disk and what is recorded do not depend on whether the process got to exit.

**`adopter`.** As a stranger running my first flow, I want the first screen that shows me a run in progress not to say that it recorded nothing, because that is the sentence that sends me to check whether the product is broken during the thirty minutes the cold-clone test measures.

---

## §3 Recommended design

**Two halves, in one ticket, because each is unsatisfying alone.**

### (A) `allocate` persists the manifest — the visibility half

One line in one function (`writer.ts`'s `allocate`, `:563`), after `manifest.steps.push(occurrence)`: call `replaceManifest()`. **Not** `rollup()` — an allocation adds no usage (M-9), and calling it would double the one cost Q-0037 measured and recorded as preserved.

Why this and not the alternatives the ticket names:

- **Not reading `steps/` from the route.** The ticket refuses it and is right: `listRetainedFiles` (`reader.ts:658`) iterates `manifestOccurrences(read.manifest)` and nothing else, and Q-0137 AC-1 and §4.3 make the listing manifest-derived and forbid `packages/server` from composing a path. A route that enumerated the directory would be inventing occurrences the manifest does not record.
- **The cost objection is measured and small**: 0.27 s on the largest run here, 0.011% of its wall time (M-9). The write-path caution in the ticket is right to demand the measurement and is answered by it.
- **It needs no schema change** (M-8), **cannot reach a dry walk** (M-10), and lands at **one site covering all three occurrence kinds** (M-1).

The residual window shrinks from a median of 1.9 minutes to the milliseconds between `allocate` returning and the write completing, plus the ordinary state where an occurrence exists and its prompt has not been written yet — which is `NO_RETAINED_FILES_TEXT`, already shipped and already correct: *"A run interrupted between allocating an occurrence and persisting its first artifact leaves exactly this."*

### (B) An incomplete run's expansion stops claiming — the honesty half

(A) makes the window small; it does not make it zero, and it can never make it zero, because the manifest is a snapshot and the reader is a second moment. So the sentence must stop asserting what it cannot know. For a run the listing reports as `incomplete`, the expansion must not say *"nothing it did was an adapter call, a script or an integrate step"*; it must say what it can bound — that this is what the manifest last recorded and the run has not ended.

`INCOMPLETE_TEXT` (`history-text.ts:139`) is already almost this sentence, on the row. What is missing is that it does not reach the expansion, where the false one is.

**(B) is not a fallback for (A) and (A) is not a substitute for (B).** (B) alone leaves the reader unable to see the running step at all — honest and useless. (A) alone leaves a sentence that is false for a smaller fraction of the time, which is the shape *"fix the instance, not the class"* that this repository has recorded most often.

---

## §4 Acceptance criteria

Fourteen, numbered independently. Each names its surface.

**AC-1 — `allocate` persists, at one site.**
`RunHistory.allocate` replaces the manifest after adding the occurrence, so a manifest read at any moment after an allocation returns names that occurrence with `status: 'running'` and `duration_ms: null`.
*Surface:* `packages/core/src/run-history/writer.ts`.
*Test:* drive a real `RunHistory`; allocate; without terminating anything, read `manifest.json` off disk and assert it holds the occurrence, its `occurrence_dir`, `status: 'running'` and `duration_ms: null`. Assert the same for the second and third allocation with the first still open. Shown red against the unchanged function.

**AC-2 — It does not recompute the roll-up.**
The allocate-time write leaves `manifest.rollup` exactly as the last `terminal()` or `finalise()` left it, and a manifest holding only running occurrences carries `rollup: []`.
*Surface:* as AC-1.
*Test:* spy on the roll-up function (or assert `rollup` identity across the write); allocate three occurrences and assert `rollup` is untouched and `[]`. Assert the count of roll-up computations over a run of N occurrences is N+2 and not 2N+2 — the figure M-9 rests on, red if a later change adds one.

**AC-3 — It is best-effort exactly as `terminal()`'s write is.**
An allocate-time write that fails costs one `host.warn` naming the path and nothing else: the occurrence is returned, its directory exists, and the run continues. It never throws, and it never prevents a step being allocated.
*Surface:* as AC-1.
*Test:* make `writeFileSync` throw for the manifest only; assert `allocate` returns an occurrence, the warn was collected with the manifest path in it, and a subsequent `terminal()` still records the step.

**AC-4 — A dry walk still allocates nothing and writes nothing.**
*Surface:* `packages/core/src/engine`.
*Test:* run a `--dry` walk over a flow with adapter, script and integrate steps; assert no run directory is created and `allocateOccurrence` answered `null` at every site. This is a regression criterion for Q-0135's finding and must be shown to fail if `allocate` is reached under `dry`.

**AC-5 — The retained listing names a step before that step ends, against the real writer.**
*Surface:* `packages/core/src/run-history/reader.ts` driven by `writer.ts` — the gap M-11 names.
*Test:* initialise a real `RunHistory`, allocate one occurrence, `persist` a `prompt.txt` into it, and — **without terminating it** — call `listRetainedFiles`. Assert the occurrence is in `occurrences` with `prompt.txt` and its byte count, and that `warnings` is empty. Not a fixture: the manifest must be the one the writer wrote.

**AC-6 — `GET /history/:id/retained` answers it over a real socket.**
*Surface:* `packages/server`.
*Test:* the same arrangement behind a running daemon; assert the response body names the occurrence and its `prompt.txt` and carries no `output.txt`, with 200 and no warning.

**AC-7 — The listing row counts the running occurrence.**
`GET /history`'s `occurrenceCount` and the row that renders it report the occurrences the manifest holds at the moment of the read, so a run with one allocated, unfinished step reports 1 rather than 0.
*Surface:* `packages/server/src/read.ts:171`, `apps/web/src/history-screen.tsx:613–615`.
*Test:* a manifest holding one running occurrence renders `1 occurrence`, singular.

**AC-8 — The screen renders Q-0137 AC-8 sentence 2 for an occurrence a real writer produced.**
A running occurrence whose directory holds `prompt.txt` and no `output.txt` renders `NO_OUTPUT_RUNNING_TEXT` and never `NO_OUTPUT_TERMINAL_TEXT`.
*Surface:* `apps/web`.
*Test:* the existing screen test keeps its hand-built fixture; **this** criterion asserts the wire shape that reaches it is one the writer actually produces, so the fixture and the producer cannot drift. Satisfying it by editing the fixture alone must leave it red.

**AC-9 — An incomplete run's expansion never claims nothing happened.**
Where the run the expansion belongs to is reported `incomplete`, `NO_OCCURRENCES_TEXT`'s sentence is not rendered; what is rendered states the bound — that this is what the manifest last recorded and the run has not ended — and names no remedy it cannot back.
*Surface:* `apps/web/src/history-screen.tsx:328–329`, `apps/web/src/history-text.ts:177`.
*Test:* an `incomplete` run with an empty `steps` array renders neither the old sentence nor an empty region, and a **complete** run with an empty `steps` array still renders the old sentence unchanged — the second half is what stops this being a deletion.

**AC-10 — The semantic pass accepts every manifest the new write produces.**
*Surface:* `packages/core/src/contracts/run-manifest.ts`.
*Test:* validate a manifest written at each of the three moments (after run start, after an allocation with a running occurrence, after `finalise`) and assert `ok: true` with no errors at all three. The middle one is the new state and must be shown to be the state `:163`'s rule was written for.

**AC-11 — The `occurrenceStart` side table still keeps its promise.**
No bookkeeping field reaches a persisted running occurrence: a manifest written while an occurrence is running holds exactly the 15 schema-required keys for that occurrence and no sixteenth.
*Surface:* `packages/core/src/run-history/writer.ts:141–154`.
*Test:* assert the key set of a persisted running occurrence by equality against the schema's `required` list. This is Q-0034's defect (M-8, R-1) pinned at the moment it becomes reachable on every run rather than on 18% of them, and it must go red if a field is stamped on the occurrence object.

**AC-12 — `writer.ts`'s export surface is unchanged.**
*Surface:* `packages/core/src/run-history/run-history.source.test.ts:75–86`.
*Test:* that register passes untouched. If the change requires a new exported symbol, this criterion is what forces that to be a deliberate act with the register moved and the reason recorded.

**AC-13 — Every source sentence describing the old write cadence is corrected.**
At minimum: `writer.ts:145` (*"the whole array is re-serialised on each terminal occurrence"* — now also on each allocation) and the `RunHistory.allocate` JSDoc (`:97–107`), which describes what allocation does and no longer would. Corrected in place, not appended to.
*Test:* a guard asserting no surviving source sentence claims the manifest is written only on a terminal occurrence — shown red against the pre-change text.

**AC-14 — No other consumer of `manifest.steps` changes behaviour.**
`isIncomplete`, `GET /history/:id`'s `steps` projection (`read.ts:726–728`), mission control and the run listing's other columns behave exactly as before for every **completed** run in the corpus.
*Test:* read every manifest in `.quorum/runs` through the detail projection before and after, and assert the two results are identical for the 174 runs that carry a terminal status. A behaviour change on a finished run is out of scope and this is what says so.

---

## §5 Non-goals

Carried from the ticket, plus five the measurements added:

1. **Q-0137's half is not reopened.** Both routes, the confinement, the identity comparison and the screen shipped and are `main:contained`.
2. **No cap, retention or eviction.** Q-0076 owns the write side, Q-0123 the daemon's records.
3. **The manifest's shape is not changed**, and `readRun` stays *"a cast, never a check"*.
4. **The route does not enumerate `steps/`.** The listing stays manifest-derived and `packages/server` composes no path — Q-0137 AC-1 and §4.3.
5. **The roll-up's quadratic shape is not repaired.** M-9 shows it need not be touched; Q-0037 recorded it as preserved and it stays so.
6. **Events are not persisted, and no trace is served for a finished run.** Q-0018's AC-14c ruled that, and nothing here reverses it.
7. **Mission control is not changed.** It reads the event stream, not the manifest.
8. **Resume is Q-0019's.** Nothing here is a step toward picking a run back up.
9. **`occurrence_dir` does not become an input** under any spelling, on either route.

---

## §6 Open questions

**OQ-1 (BLOCKING for the gate, not for the design) — Is a decision entry owed?**
My reading is **no**, and the sites I checked are named so the gate can rule rather than re-derive:

| candidate | verdict |
| --- | --- |
| `harness/rules.md` *"Files are the database"* | writing sooner **strengthens** it; nothing goes false |
| `docs/GLOSSARY.md` **Run history** | describes contents, not cadence; unaffected |
| `docs/GLOSSARY.md` **Occurrence** | *"One entry in a run manifest's record of what actually executed… the unit a roll-up sums over"*; unaffected — the roll-up still sums the same set |
| `writer.ts` module docblock, *"a run that started is a run that ended"* | unaffected |
| `contracts/Q-0011/run-manifest.schema.json` | **already models it** (M-8); no format change |
| Q-0037's preserved quadratic roll-up | **not touched** (M-9) |

The one thing that goes false is a **source docblock** whose own reasoning expires by its terms, which AC-13 corrects. That is Q-0137's GO-1 shape and Q-0108's precedent: a ruling that changes no behaviour and contradicts no landed entry belongs in the code's own authority comment. **Owner: the human, at the requirements gate.** It is marked blocking because `developer-generalist` may not write one, and a round spent discovering that is the cost Q-0062 paid three times.

**OQ-2 (BLOCKING) — Is fourteen criteria one ticket, and if not, where is the seam?**
Q-0013 was refused at eighteen and split in three; Q-0122 accepted twenty and paid three implement rounds; Q-0126 refused a split at sixteen and paid $177.92 with a round-1 `blocked`. Fourteen is inside the role's ceiling of fifteen, so my recommendation is **one ticket**. **The seam is written out in advance rather than left for a later gate to find**: (A) is AC-1 to AC-6 and AC-10 to AC-13, all inside `packages/core` and `packages/server`; (B) is AC-7 to AC-9 and AC-14, all inside `apps/web` plus one server projection. They are separable and (B) can run first, because (B)'s subject — a false sentence over an empty list — exists whether or not (A) lands. **Owner: the human.** If the gate splits it, AC-11 and AC-9 are named here as **not eligible for trimming**: the first is the one criterion protecting a defect this change makes certain, and the second is the only one that removes a false claim.

**OQ-3 — Should (B)'s sentence distinguish *not yet written* from *genuinely nothing*?**
A run that is incomplete and has genuinely allocated nothing (its first second, or a run that died before its first step) is a different state from one whose manifest is merely behind. The manifest cannot tell them apart — which is itself the honest answer, and argues for one sentence that claims neither. **Recommendation: one sentence, bounded, claiming neither.** Stated rather than asked, per Q-0105's remedy. **Owner: the implementer, within AC-9's wording.**

**OQ-4 — Does the `warnings` array have a role here?**
`WireRunHistoryRetainedWarning` requires a `seq` and a `step_id`, and an occurrence the manifest has not recorded has neither. So an unrecorded occurrence **cannot** be expressed as a warning, and (B) must be a property of the region rather than an entry in that array. Recorded so an implementer does not try and find out at round two. **Owner: none; answered.**

**OQ-5 — Does the fix need a `fsync` at allocate at all?**
`replaceManifest` fsyncs. An allocate-time write is for a *reader on the same machine*, not for crash durability, and `rename` alone would make it visible to a reader at a fraction of the cost. Against: two write paths with different durability is a second thing to reason about on the one file a run must never lose, for a saving M-9 measures at 0.27 s. **Recommendation: reuse `replaceManifest` unchanged.** **Owner: the implementer; measure before diverging.**

---

## §7 Risks

**R-1 — This change makes a latent defect certain.** `writer.ts:141–154` records that a bookkeeping field stamped on a still-running occurrence reaches `manifest.json` and violates `additionalProperties: false`, and that it hid *"because only a sibling finishing first… persisted it"*. Persisting at allocate removes that hiding place: the same mistake would now fail on **every** run rather than on 18% of them. That is a reason for **AC-11**, not against the change — an intermittent schema violation is worse than a deterministic one — but it must be stated, because the `occurrenceStart` side table is now load-bearing on every run and a future contributor who does not read its docblock will be shown that immediately rather than eventually.

**R-2 — Write amplification is measured on one filesystem.** 4.93 ms median is APFS on local disk. A network or fuse-mounted repository could be 10–100× that, and the cost scales with occurrence count and manifest size, both of which grow together. Bounded and linear, but not measured off this machine. **Mitigation: none proposed; recorded.**

**R-3 — More manifests will carry a running occurrence at rest.** A crash between an allocate write and the terminal write now leaves one, where today the same crash leaves a manifest that never knew. This is `Q-0138-1`'s exact state (M-5), it is modelled (M-8), and `isIncomplete` already reports it — so it is more frequent rather than new. It does mean the corpus figure *"1 running occurrence across 175 runs"*, which `history-text.ts:33` cites, stops being representative; any check keyed on that figure is a check keyed on what this machine happens to hold.

**R-4 — The subject is a screen defect and the remedy is a write-path change.** Q-0118's finding is that lifecycle changes attract lifecycle defects, and the one file this touches is the file the module docblock says a run must never lose. The review should be weighted at `writer.ts` rather than at the screen, and AC-3 exists because a write that can throw where none could before is the way this goes wrong.

**R-5 — The review diff.** Q-0128's subject. This change should be small — one function, one screen region, one projection, plus tests — so I **predict no truncation**, against a 200,000-byte cap, and that prediction should be measured rather than assumed. Q-0018 and Q-0131 both came in under; Q-0137 predicted the same and was refuted at 74.7% falling to 64.9%. If it truncates, the tail `git diff` loses alphabetically is `packages/shared` and `packages/server/src/read.ts`, which AC-7 lands in.

**R-6 — AC-14's before/after comparison is the only thing protecting 174 finished runs**, and it is the criterion easiest to satisfy weakly. It must compare real manifests read from `.quorum/runs`, not fixtures.

---

## §8 Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No credential, no vendor login, no environment read. |
| **Worktree safety** | n/a. Nothing is written to the user's working tree; the only new write is under `.quorum/`, which `excludeRunState` already puts in `info/exclude`. |
| **Gate behaviour** | Unchanged. No gate, no answer vocabulary and no `auto`/`human-locked` behaviour is touched. |
| **File format and schema** | **The manifest's format does not change.** The state written is already in the schema's `status` enum and already has a semantic rule (M-8). AC-10 proves it. |
| **Lint rules** | None added. No new dependency. No deprecated API. |
| **Cold-clone impact** | Positive and small: the first screen an adopter sees for a run in progress stops saying the run recorded nothing (M-6b). No command, install step or first-run path lengthens. |
| **Product-agnostic** | Yes. No product name reaches any sentence. |
| **Errors are explicit** | AC-3 keeps a failed write a named warning rather than a silent default, and AC-9 removes a silent default that is already there. |
| **Files are the database** | Strengthened — the database learns of a step when the step starts rather than when a sibling finishes. |

---

## §9 Gate obligations

**GO-1 — Rule OQ-1 before the run starts, and land whatever it requires at the gate.** If an entry is owed, it must be written and **verified present in the implement step's actual `prompt.txt` by grep**, not assumed — the check Q-0097 lost two errata by not making and Q-0125, Q-0129 and Q-0137 each made. If no entry is owed, say so in the ticket body so round one does not spend itself asking.

**GO-2 — Rule OQ-2 and write the split, or ratify fourteen, in an erratum.** Q-0122's discipline: if the size is accepted, the erratum names the seam **in advance** and names AC-9 and AC-11 as not eligible for trimming, so an exhaustion is answered by a split rather than by a fourth round.

**GO-3 — Discharge by running the product and transcribing what it rendered.** Not *"verified by the suite"*. A real daemon from `quorum open`, the **served bundle verified by content** first (a cache hit can serve a page built from code nobody is looking at — Q-0137's GO-5 reported `5 cached, 5 total`), a real run started **through the daemon**, and the run-history row opened **while a step is running**. `runs.log` must record: the row's occurrence count, the occurrence's step id and kind, the sentence rendered for its status, the files the listing named and their byte counts, and the sentence rendered in place of `NO_OCCURRENCES_TEXT`. This obligation is written this way because Q-0016's equivalent was reported discharged when its by-hand half had not been performed, and because GO-5 has now found, on five consecutive tickets, something every review round missed.
**Choose a row that can contradict itself**, per Q-0018's lesson: a `chore` run, which M-2 measures at 100% blind, and not a `requirements` run, whose parallel pair can mask the defect.

**GO-4 — Measure the review diff and record the figures** whether or not it truncates, so R-5's prediction is settled either way and **Q-0128** gains a fourth data point. If it truncates, read the omitted files off the implement branch and report that as an `observation:` — the Q-0124-warn/Q-0117-channel pair, which has now composed on five consecutive tickets.

**GO-5 — Verify forced in both environment rows**: a worktree with neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, with `quorum lint` and the git-identity sweep.

---

## §10 What this run recorded about itself

Two things, offered as observations rather than as findings about the change:

**The corpus's one running occurrence is this document's own step** (M-5). `Q-0138-1/001-pm-claude` has been `running` with `duration_ms: null` since 14:23:00.315, and it is visible in the listing **only because `pm-codex` finished first** — which is the parallel case, demonstrated live, on the ticket opened to say the parallel case is not enough. For the first 154 seconds it was not visible at all, which is the defect, also demonstrated live.

**The corpus grew by four runs between Q-0018's requirements gate and this one** — 171 to 175, and 952 occurrences. Any figure in this document keyed on those totals is a measurement of this machine at this moment, which is why M-2's per-flow shares and M-4's percentiles are stated beside the absolute counts rather than instead of them. The one figure that should **not** move is M-1's: three `replaceManifest` call sites and three allocation sites, which is a property of the source.
