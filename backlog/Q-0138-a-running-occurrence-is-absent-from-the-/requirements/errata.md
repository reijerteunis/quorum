# Errata — Q-0138

This file wins over `requirements/merged.md` **for the clauses it names and for nothing else**.
Written at the requirements gate on 2026-09-19, before the chore run, so the implement step meets
decisions rather than questions. E-1 and E-2 are **ratifications**: neither reverses a criterion and
neither narrows scope. E-3 corrects one provenance sentence and touches no criterion.

**The implementer is NOT blocked on anything here.** `merged.md` §6 records every open question as
answered and none as blocking; E-1 and E-2 ratify the two the gate owed. Do not stop the run to ask
whether a decision entry is owed, and do not stop it to ask whether this ticket is too big.

---

## E-1 — OQ-1 is ratified: no decision entry is owed, and this is where that ruling lives

**Ratifies:** `merged.md` §6 OQ-1 in full, and discharges **GO-1**.

**The answer is no.** No `docs/decisions/` entry is written for persisting the manifest at
`allocate`. The ruling belongs in the code's own authority comment — one line naming the condition
per `.claude/rules/engineering.md`, never a transcription of this reasoning — which is Q-0108's
precedent for a ruling that changes no behaviour and contradicts no landed entry.

**Re-verified at this gate rather than relayed.** The test this repository applies is *does any
landed sentence go false?*, checked at six sites:

| site | verdict |
| --- | --- |
| `harness/rules.md` *"Files are the database"* | writing sooner **strengthens** it |
| `docs/GLOSSARY.md` **Run history** | describes contents, not cadence — unaffected |
| `docs/GLOSSARY.md` **Occurrence** — *"the unit a roll-up sums over"* | unaffected; the roll-up sums the same set (AC-3) |
| `contracts/Q-0011/run-manifest.schema.json` | **already models it** — `running` is in the `status` enum, `additionalProperties: false`, 15 required — verified at this gate |
| Q-0037's preserved quadratic roll-up | **not touched**; an allocation adds no usage, so no roll-up call is added (AC-3) |
| *"A dry run changes nothing the caller passed it"* (2026-09-11) | unaffected; unreachable under `dry` (AC-5) |

The one sentence that goes false is a **source docblock** whose own reasoning expires by its terms,
which AC-12 corrects. That is Q-0137 GO-1's shape.

**GO-1 named the wrong destination, and this entry is the correction.** It says to ratify OQ-1 *"in
the ticket body"*. The chore `implement` step's inputs are `requirements/merged.md`,
`requirements/errata.md`, the review and implement globs, `harness/rules.md` and
`harness/architecture.md` — **`ticket.md` is not among them**, verified against `harness/flows/chore.yaml`
at this gate. A ruling written only into the body would not reach the implementer. This is the same
error Q-0137's close recorded one ticket ago, where GO-1 claimed an implementer would meet a live
BLOCKING question in a file that is not an input; there the ruling stood and its stated reason did
not. Here the destination is corrected rather than the ruling.

---

## E-2 — OQ-2 is ratified: one ticket at twelve criteria, with the seam named in advance

**Ratifies:** `merged.md` §6 OQ-2 and §3's two halves, and discharges **GO-2**.

**One ticket.** Twelve is inside the head-of-product ceiling of fifteen. The precedent is unanimous
in both directions: Q-0013 refused at eighteen and split in three, Q-0122 accepted twenty and paid
three implement rounds, Q-0126 refused a split at sixteen and paid $177.92 with a round-1 `blocked`.

**The seam, named now rather than found at an exhaustion gate** (Q-0122's discipline, which Q-0126
paid for not having):

- **(A) the visibility half** — AC-1 to AC-9 and AC-12, in `packages/core` and `packages/server`.
- **(B) the honesty half** — AC-10 and AC-11, in `apps/web`.

They are separable and **(B) can run first**, its subject — a false sentence over an empty list —
existing whether or not (A) lands.

**If the revise loop exhausts, the answer is a split along that seam, not a fourth implement round.**

**AC-6 and AC-11 are NOT eligible for trimming.** AC-6 protects a defect this change makes certain
(R-1: `writer.ts`'s `occurrenceStart` docblock records that the schema violation *"hid because the
old code deleted the field just before its own write"*, and persisting at allocate removes the
hiding place). AC-11 is the only criterion that withdraws a false claim, which is the reason this
ticket is a defect rather than a limitation.

**Weight the review at `writer.ts`, not at the screen** (R-4). The subject presents as a screen
defect and the remedy is a write-path change to the one file a run must never lose.

---

## E-3 — `merged.md` M-3's explanation of the occurrence-count delta is wrong

**Corrects:** one sentence of `merged.md` §0 M-3. **No criterion depends on it** and none moves.

M-3 reports the corpus at **954** occurrences across 175 manifests, notes that both candidates
reported **952**, and attributes the difference to *"a `started_at` filter"*.

**Measured at this gate: that filter drops zero occurrences.** Across the corpus, **0** occurrences
lack `started_at` and **0** lack `duration_ms`, so no filter of that shape can account for a delta of
any size.

**The real cause is that the corpus grew inside the run that was measuring it.** The candidates read
it while this run's own `pm-claude` and `pm-codex` were still executing and the manifest recorded
`steps: 0`; `merged.md` read it after both had terminated and the manifest recorded two; it now
holds **955**, `head-of-product` having terminated too. 952 → 954 → 955, one step at a time.

**All three figures were correct when taken.** The document's own M-2 diagnoses exactly this shape
in candidate-claude — *"the figure was true when taken and expired inside the run that took it"* —
and then M-3 commits it one section later while explaining it. It is recorded because a diagnosis
that gets the cause wrong is worse than none: the next reader re-derives against it, and a
methodological difference that does not exist would read as a reason to distrust the candidates'
coverage figure.

**The coverage figure is untouched and is corroborated three ways.** 174 occurrences visible while
running, **18.3%**, and `chore` **0 of 469** — reached independently by candidate-claude,
candidate-codex and the operator by different methods before this run started. `qa-red` 0 of 36 and
`solutioning` 0 of 35 likewise. That figure is what §3's design rests on and nothing here disturbs it.

**Consequence for AC-3 and GO-3: none.** The write-cost arithmetic is per-run and per-occurrence, and
`Q-0015-4`'s 55 occurrences and 38,606 B are unchanged.
