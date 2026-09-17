# Q-0129 — The gate screen shows the verdict that reached it, and the diff

*Requirements, run 2, merged. Every figure was re-measured against tip `3f60bc3` on 2026-09-17, as
this ticket's body instructs, and none was copied from the body, from `docs/06-development-plan.md`,
or from either candidate. Where a candidate's figure and mine differ the difference is noted rather
than smoothed over — Q-0099's record is that a measurement copied from a document is not a
measurement, and that a correction travels one document further by being copied.*

---

## §0 What was measured, and the four things that reshape the ticket

### 0.1 The census, decomposed — and it decomposes completely

`grep -h 'gate=' backlog/*/runs.log | wc -l` → **275**, which is not the answer. It decomposes
exactly as the body says, with nothing left over:

| | count | shape |
| --- | --- | --- |
| engine-recorded answers | **235** | `gate=<kind> answer=<advance\|retry\|abort>`, `routing.ts:48` alone |
| retry grants | **39** | `gate=retry counter=… set=…` |
| hand-written erratum note | **1** | Q-0103's, `gate=erratum answer=E-1` |
| | **275** | |

By kind: **`gate=human` 157** (154 `advance`, 3 `abort`) and **`gate=human-locked` 78** (39 `retry`,
31 `advance`, 8 `abort`). `human-locked` is the literal `handleFail` builds, so the two kinds are the
two the glossary distinguishes: **157 author-declared to 78 engine-presented**. Both candidates
report 235 and 157; independently confirmed here.

**`retry` has been chosen zero times at an author-declared gate.** That zero is what Q-0016 shipped
its third control against and it has not moved.

### 0.2 The verdict artifact, measured

**306 files across 73 ticket folders** — 230 run-scoped (`.harness/run-N/…`, Q-0089's shape) and 76
flat, written before 2026-09-01. They are the whole of `.harness/` under `backlog/` bar three
`.raw.txt` dumps (309 files total).

Sizes: min **160 B**, median **2,205 B**, p95 **8,246 B**, max **13,061 B**, total **947,608 B**.
Findings per file: max **23**. Verdict values across all 306: `revise` 98, `ready` 62, `approve` 54,
`proceed` 46, `needs-input` 33, `changes-requested` 10, `blocked` 3.

*(Candidate-claude reports median 2,249 and p95 8,276 against 2,205 and 8,246 here; the difference is
the even-*n* midpoint convention and nothing else. Its min, max and total match to the byte.)*

**The payload is small, and that is load-bearing twice over.** The largest verdict record in this
repository's entire history is 13 KB, against a ticket folder reaching 3.1 MB and the
`WireTicketDetail` listing Q-0127 measured at 1,214 bytes. **So no cap ships** — Q-0127's precedent,
which satisfied the cap-disclosure rule by having none rather than by disclosing one. It is stated
here so a later round does not design one.

### 0.3 The finding that forecloses a whole family of designs: **the gate question names no step**

`gateQuestionEventSchema` (`packages/shared/src/events.ts`) is `.strict()` over exactly five fields —
`type`, `gateId`, `kind`, `reason`, `ticketDir` — plus an optional `retry`. **There is no `stepId`
and no other correlation field.**

So a browser holding `WireRun.gates`, which is what Q-0016's screen renders, has **nothing to join a
step's decision to the gate it is answering**. `warnEventSchema` is `.strict()` over `{type,
message}` and carries no `stepId` at all; `stepDoneEventSchema` carries one but the gate does not;
and *"the most recent `done` before the gate"* is inference rather than identity — the same inference
alternative (iii) was struck for.

**The corollary is the design.** The only shape needing no correlation is one where the **gate
question carries what reached it**, because the question is the thing the human is answering. Both
candidates arrive there independently, which is the strongest evidence available that it is right.

### 0.4 And that shape needs **no change to `packages/server` at all**

`wireRunOf` (`packages/server/src/wire.ts:131–132`) is `pendingGates: view.gates.length` and
`gates: view.gates` — the questions pass through **whole**, and the JSDoc above says why: *"`gates`
crosses whole since Q-0016, and `pendingGates` is computed from it here."* `wireRunSchema` re-uses
`gateQuestionEventSchema` as its element rather than re-declaring the six fields.

So a field added to the question in `packages/shared` reaches `GET /runs/:id` and the browser with
**zero transport edits**. That is measured, not assumed: it is why Q-0016 wrote the element that way,
and it is one refactor away from being lost, which is why AC-7 exists.

### 0.5 **Both candidates are wrong about where `core` populates it, and the correction settles the shape**

Candidate-claude's AC-2 anchors the population at `steps.ts:339–365` — the fail path — on the
reasoning that *"`handleFail` builds the question carrying them from there."* Read against the code,
two facts refuse it:

1. **`handleFail(step, context)` receives no output.** Its signature is
   `(step: Readonly<Record<string, unknown>>, context: RoutingContext)`, and the verdict values live
   in `runAgentStep`'s local scope. The question it builds at `routing.ts:130–145` has no verdict
   available to it without either a signature change or a context slot.
2. **The verdict is written for a *pass* verdict too.** `steps.ts` has two `if (declared?.verdict)`
   blocks. The **first** writes the artifact and runs whatever the verdict is; the **second** emits
   the `warn` and calls `handleFail` **only when `output.verdict !== passValue`**. `chore.yaml`'s
   `review` returns `approve`, `integrate` runs, and `gate: human` follows — `handleFail` is never
   called, so a design anchored on the fail path shows **nothing at the most common gate in this
   repository**.

Measured: **154 of the 157 author-declared answers are `advance`**, and a chore run reaching that
gate got there because the review *passed*. Claude's own AC-3 covers the case with a run-scoped slot,
which means its AC-2 and AC-3 describe two different populations of one field — the second path its
own AC-5 forbids.

**So one run-scoped slot on `RunContext`, assigned at the single site where a step's verdict is
validated (pass or fail) and read where a gate question is built, is not the cheaper option — it is
the only one that serves both gate-building sites.** `RunContext` already carries `failingTasks` and
`lastIntegration` for exactly this purpose (`types.ts:271`, `:273`), and its own comment names them.
Candidate-codex's AC-3 has this shape and is adopted.

### 0.6 The ordering rule: **execution order, except inside a parallel group**

The two candidates give incompatible rules and codex's is the better one, but neither states it in a
form that survives both cases.

- **claude**: *"the last verdict the run recorded."* `runStep`'s parallel branch is
  `Promise.allSettled(members.map(runAgentStep))`, so members complete in whatever order the vendors
  answer — last-writer-wins makes the screen's content **a property of scheduling**, which is *"A
  test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30)
  generalised to a screen.
- **codex**: *"the nearest preceding completed step in flow declaration order"* plus *"a repeated
  execution replaces evidence from its earlier iteration."* Right, but the two clauses are needed
  because declaration order alone is wrong for a loop: in `chore.yaml`, `implement` (verdict) is
  declared **before** `review` (verdict), so during round 2 a purely declaration-ordered read would
  hand the gate **review's stale round-1 `revise`**.

**One mechanism covering both: execution order decides, except that the members of one `parallel`
group are ordered by declaration.** A re-executed step replaces what its earlier iteration wrote,
which falls out of execution order rather than being a second clause. Reconciliation has an obvious
home — `runStep`'s parallel branch already awaits `allSettled` before returning.

**Measured, no shipped flow discriminates the two rules**, which is worth stating so nobody hunts for
a real fixture: `verdict:` declarations per flow are `chore` **2**, `qa-red` 1, `requirements` 1,
`review` 1, `solutioning` 1, `development` **0** — and `review.yaml`'s panel members
(`review-claude`, `review-codex`) declare **none**; only its `verdict` step at `:22` does. So no
parallel group in any shipped flow holds two verdict-declaring members, the discriminating fixture is
synthetic, and this rule is future-proofing stated in advance rather than a repair.

### 0.7 Alternative (i) is refused — **and this ticket's body gives the wrong reason for it**

The body refuses prose-parsing because *"a `revise` carrying no findings emits no em-dash and no
list, and the separator a parser would key on is absent exactly when the list is."*

**That case cannot occur, and two independent sites forbid it.** `schemaFor`
(`packages/core/src/engine/prompt.ts:111`) does `required.push('verdict', 'findings')` whenever a
step declares a verdict; and `adapters.ts:656` refuses any non-pass verdict carrying an empty list —
*"`<verdict>` requires findings"* — before `steps.ts` reaches the `warn` at all. Measured on disk: of
**144 non-pass verdicts, zero** carry an empty findings array. The hazard is closed by contract, not
merely unobserved.

**The live ground is the opposite one and it is a measurement.** Over all **1,080** findings on disk:

| | count |
| --- | --- |
| containing the join separator `" \| "` **in their own text** | **4** |
| containing `": "`, the separator between step id and verdict | **1,071** |
| containing `" — "`, the separator before the list | **655** |
| containing a newline | **0** |

Three of the four separator-bearing findings are TypeScript union types written out —
`` `refused | running | ended` ``, `` `missedCount: number | null` `` — which this codebase writes
constantly. And the step id cannot be recovered either: `composite.ts` gives a fan-out child the id
`` `${step.id}:${task.id}` ``, so **a step id contains a colon by construction**
(`dev:backend-wire-schema`, `dev:frontend-dev-proxy`).

So the refusal stands on the stronger ground that **the prose can only over-split, never
under-split** — a parser would have reported more findings than were written. Candidate-claude's
§0.6; adopted, and the body's version is not re-transcribed.

### 0.8 Alternative (iii)'s identity wall reaches the `.harness/` route too

The body struck *"read it from run history"* because a parked run has `runId: null`. **The same wall
stops a route over the artifact**, which is what settles half (a)'s design rather than merely
preferring it:

- the default path is `` `${TICKET_ARTIFACT_DIR}/run-{run}/${stepId}-verdict-iter-{iter}.json` `` —
  **scoped by `{run}`**;
- `host.ts` assigns `record.runId` only in the terminal branch, so for a live parked run the daemon
  holds none;
- the number is on the wire only inside `gateId`, and `run-events.contract.md:78` forbids reading it
  — *"`gateId` is opaque and **not to be parsed**"* — as does `host.ts`'s own JSDoc, on the ground
  that two authorities for one run's identity is what `minted` exists to prevent;
- and even with a run number the path is not derivable, because **`verdict_file` is an author
  override** (`steps.ts`, `stepOutputDeclarationSchema`).

Globbing `.harness/run-*/` for the newest is inference, not identity. **A fourth route is refused
here rather than left for a round to find**: `.quorum/locks/<ticket-id>.json` carries a run number,
and reading it would give one run two authorities for its identity while a stale lock is refused
rather than reclaimed — so the screen's answer would depend on a file the run may not own.

### 0.9 `.harness/` is already served to an agent, and the asymmetry is the ruling

`harness/flows/requirements.yaml:23` declares
`".harness/run-{run}/head-of-product-verdict-iter-*.json"` in `input.backlog`. **A shipped flow
already reads the verdict artifact**, through `Backlog.readFiles`, which has no exclusion; the
exclusion lives in `listTicketFiles` alone.

So: **`readFiles` serves `.harness/` to an agent; `listTicketFiles` withholds it from a reader.**
Q-0127 erratum E-1 ruled only the reader side and says so in as many words — *"whether any other
surface may serve `.harness/`. Nothing here reaches that, and a later ticket that wants to is owed
its own entry."* A new HTTP route would be the **reader** side, so it costs an entry reversing a
four-day-old ruling on top of an identity problem it cannot solve. Refused, and the refusal is
recorded in this ticket's own entry so a later ticket does not re-derive it.

### 0.10 Run history cannot carry it, and that is a frozen contract

`Occurrence` already carries `verdict: string | null` and `GET /history/:id` already serves it. It
carries **no `findings` and no `summary`**, and cannot gain them: `contracts/Q-0011/run-manifest.schema.json`'s
`$defs.step` is `additionalProperties: false` with **15 properties, all 15 required**, under
`x-quorum-contract: run-manifest-v1` and a semantic validator. Verified by parsing the file. So the
one member of the triple that is already on a shipped route is the one the screen needs least, and
the two it needs cannot go there.

### 0.11 The severity vocabulary exists, and **150 of 1,080 findings fall outside it**

`FINDING_SEVERITIES = ['blocker', 'major', 'nit']` and `OBSERVATION_TAG = 'observation'` are exported
from `packages/shared/src/constants.ts:200`, `:217`, with `FINDING_PATTERN` pinning the shape — but
only for a step whose vocabulary contains `changes-requested`, which in the shipped flows is
`review.yaml`'s `verdict` step alone.

Measured over all 1,080: `nit` 366, `observation` 303, `major` 210, **no recognised prefix 140**,
`blocker` 51, `minor` 8, and two one-off words. **150 of 1,080 — 13.9%** — would fall outside a
four-bucket rendering, and most of the 140 come from `head-of-product`, whose instruction declares no
taxonomy.

So the screen may group by the declared register, which is a real shared vocabulary rather than one
it would be coining, **and must have an honest place for one finding in seven that matches none**.

### 0.12 The measurement neither candidate made: **a gate question is retained and replayed**

`broadcast.ts` pushes every event onto a `retained` array capped at `capacity`, and
`Broadcast.subscribe` seeds each new subscriber's queue with `[...retained]` — *"Permitted after
`Broadcast.close`"*. `DEFAULT_RETENTION` is **500** (`serve.ts:47`). So a gate question is held for
the record's whole life, which Q-0123 ruled is the daemon's life, **and is replayed to every late
subscriber and on every reconnect**.

Q-0123 measured this repository's event stream at mean **214 B** and ~**0.1 MB per ended run**. A
13 KB verdict snapshot is ~60× the mean event and adds at most 13 KB per gate — inside that
arithmetic, and stated so a round does not argue it. **The successor's diff patch is not**:
`repo.max_diff_bytes` defaults to 200,000, which is ~1,000× the mean event, retained and replayed.
That breaks the arithmetic Q-0123 ruled on four days ago, and it is a second independent argument for
the split in §7 — one neither candidate raised, and a constraint the successor must answer rather
than discover.

### 0.13 Two corrections to this ticket's own body, and one guard fact both candidates miss

1. **`docs/04-architecture.md:317` is wrong.** The placeholder rule — *"No placeholder is a blank
   panel, a spinner or a skeleton, and none shows a fabricated project, run, ticket or cost"* — is at
   **`:336`**. Q-0016's body cited `:200`, its gate corrected it to `:317`, and the document has
   grown since: **third recorded position for one sentence**. This requirement cites it by its words
   and never by its line, and AC-10 does the same.
2. **The alternative-(i) argument** is corrected by §0.7: right conclusion, wrong mechanism.
3. **`apps/web/test/source.test.ts`'s AC-13 guard forbids six words, and only three of them retire.**
   The needles are `verdict`, `findings`, `summary`, `diff`, `blocker`, `hunk`, plus a ban on reading
   `.message`. `diff` and `hunk` are the **successor's** and stay. `.message` stays. And **`blocker`
   stays too, where it becomes the enforcement of AC-9's import rule**: a screen that takes its
   labels from `FINDING_SEVERITIES` never spells the word, so the surviving needle is what fails if
   anyone re-spells the register. Neither candidate states the re-aiming at that granularity, and it
   is the difference between narrowing a guard and weakening one.

*One observation about the product rather than the ticket, recorded because no criterion follows from
it: this ticket's own run 1 was **stopped from the browser** —
`error="stopped by a reader in the Quorum web app"`, `daemon-client.ts`'s `BROWSER_STOP_REASON`. That
is Q-0130's stop control used against a real run two days after it shipped, and the first instance in
this backlog that is not that ticket's own demonstration.*

---

## §1 Problem

A run parks at a gate. Q-0016's screen tells the reader what is being asked — the kind, the reason
verbatim, the ticket folder, the answers that gate will honour — and **nothing about what the step
before it decided**. Its AC-13 makes that a checked property rather than an omission.

So the human answering the most consequential control in this product — one word, irreversible —
answers from a sentence a flow author wrote months ago (*"Chore owner approves the reviewed change
now on the ticket branch, with the suite green"*) and from nothing the run itself produced. The
evidence exists: `steps.ts` writes `{verdict, findings, summary}` to disk the moment the step
returns, and **223 of this repository's 235 recorded gate answers had one available**. It has never
reached a reader who was not in a terminal.

The cost is measurable in this backlog: every one of those 223 answers was given by somebody who
opened `runs.log` or a `.harness/` JSON in an editor to see what they were approving — which is the
workflow the gate screen exists to replace.

## §2 User stories

**`maintainer`** — *I am answering a gate in the browser. I want the verdict the step declared, its
summary and every finding it reported, so that `advance` is a decision rather than a guess — and
where the step declared none I want to be told that, not shown an empty box I read as "nothing was
wrong".*

**`maintainer`, second** — *When a run parks after a panel or a fan-out I want to know **which step**
decided, because `dev:backend-wire-schema` and `review` are different claims and the gate question
does not say which one I am looking at.*

**`adopter`** — *My first chore flow stopped. I want the browser to tell me what the reviewer said,
in its own words, without my learning where `.harness/` is or that it exists.*

**`contributor`** — not a persona here, and the reason is stated rather than left blank: nothing
touches the adapter contract, the vendor-facing schema or the JSONL mapping. A new adapter neither
gains nor owes anything.

## §3 The shape, and every alternative refused on a measurement

**The gate question carries the decision that reached it.** `gateQuestionEventSchema` gains exactly
one optional object field — whole or absent, never partly present — carrying the deciding step's id
and the three values the step returned. `packages/core` holds them in **one run-scoped slot**,
assigned at the single site where a verdict is validated and read at both sites that build a gate
question. `packages/server` changes not at all (§0.4). The browser renders it from `WireRun.gates`,
which Q-0016's screen already reads and already parses.

| candidate | refused because |
| --- | --- |
| parse the `warn` or `done` prose | 4 of 1,080 findings contain the join separator themselves, 1,071 contain `": "`, and a step id contains a colon by construction — it can only over-split (§0.7). |
| widen `done`/`warn` structurally | the gate question carries no `stepId`, so there is nothing to correlate on (§0.3). |
| populate at the `handleFail` site | `handleFail(step, context)` receives no output, and the most common gate in this repository is reached on a **pass** verdict where `handleFail` never runs (§0.5). |
| a route over the `.harness/` artifact | `{run}`-scoped path, a parked run's `runId` is `null`, the only wire copy is a `gateId` the frozen contract forbids parsing, and `verdict_file` is author-overridable — plus it reverses Q-0127 E-1's reader-side ruling (§0.8, §0.9). |
| read it from run history | struck at Q-0016's gate for identity; and `run-manifest-v1` is frozen at 15 required keys, so `findings` and `summary` could not go there anyway (§0.10). |
| read the run lock for the run number | two authorities for one run's identity; a stale lock is refused rather than reclaimed (§0.8). |

**The field is named `reached`** — `question.reached.verdict`, `question.reached.findings`. **Stated
rather than asked**, because a requirement that leaves a case uncovered is precisely one
`developer-generalist` must stop on (Q-0105's remedy). The three rejected names and their collisions,
so the gate can overrule in one line rather than re-deriving: **`verdict`** gives
`question.verdict.verdict`; **`outcome`** is a near-homograph of `RunOutcome`/`StartOutcome`/
`StopOutcome`, which are run-level; **`decided`** is a near-homograph of `undecided`, a run status in
`docs/GLOSSARY.md`. `reached` collides with no glossary term and no exported identifier.

**The diff is not built here.** §7 is the successor's body, written out in full.

## §4 Acceptance criteria

Twelve, against this role's ceiling of fifteen and the eighteen Q-0013 was refused at. Each *Test:*
clause **bounds the instrument**: a reviewer may find that the instrument fails the job the clause
gives it, and may not raise the job (Q-0067 E-1).

---

**AC-1. `gateQuestionEventSchema` gains exactly one field, and it is whole or absent.**
Optional on the event; its value an object carrying four members — the deciding step's interpolated
id, the verdict word as the step declared it, the findings array as the step returned it, and the
summary. All four present or the field absent: there is **no state in which a reader is shown a
verdict with no step, or findings with no verdict**. Both levels stay `.strict()`. No other member of
the event union changes, and no event gains a timestamp, a sequence number or a run id.
*Test:* the schema accepts a question with the field and one without; rejects an object missing any
of the four members; rejects an unknown key at either level; and the union's other members parse
byte-identically to before, asserted over `contracts/Q-0050/run-messages.fixture.json`.

**AC-2. One run-scoped slot, one assignment site, and no second path to the value anywhere.**
`RunContext` gains one optional slot beside `failingTasks` and `lastIntegration`. It is assigned at
the **single** site where a step's verdict is validated — the first `if (declared?.verdict)` block in
`runAgentStep`, which runs for a pass verdict as well as a failing one — and read at **both** sites
that compose a `GateQuestionEvent`: `runStep`'s `step.gate` branch and `handleFail`'s exhaustion
gate. Nothing re-reads the artifact, re-parses an emitted message, queries run history, or derives a
run number from a `gateId`.
*Test:* two instruments, because the claim has two halves. (a) A mock-adapter run whose step declares
a verdict emits a gate question whose field is compared **member by member** against the JSON the
same run wrote to `.harness/` — so the two sources are shown to agree rather than one of them
asserted twice. (b) A source guard over `packages/core/src`, `packages/server/src` and
`apps/web/src`: no file reads an event's `.message` for a machine value, splits a `gateId`, names
`.harness` or `TICKET_ARTIFACT_DIR` outside the one site that writes the artifact, or registers a
route whose path contains `verdict`. Needles assembled so the guard is not its own subject, each
shown to discriminate, and the guard demonstrated red four ways with four distinct messages.

**AC-3. Provenance is deterministic: execution order, except inside a parallel group.**
The slot carries the most recently completed verdict-declaring step, so a re-executed step replaces
what its earlier iteration wrote. The one exception is a `parallel` group, whose members are
reconciled **in declaration order** after the group settles, because `Promise.allSettled` completes
them in whatever order the vendors answer and a screen's content may not be a property of scheduling.
*Test:* three fixtures, and the third is synthetic by necessity. (a) A chore-shaped flow — verdict
step, a step declaring none, then `gate: human` — carries the **verdict step's** values. (b) A
two-iteration revise loop carries iteration 2's, not iteration 1's. (c) A `parallel` group of two
verdict-declaring members, **completing in the opposite order from declaration**, carries the
later-declared member's; the fixture is synthetic and the criterion says so, because no shipped flow
has two verdict-declaring members in one group (§0.6) and inventing one in `harness/flows/` is the
non-goal at §5.8.

**AC-4. Fidelity: the exact validated values, and an author override changes nothing.**
The exact `verdict` string, the `findings` array in its returned order, and the `summary` as
returned — including an empty findings array and an empty summary where those are the measured
values. The step's exact interpolated `stepId`, so a fan-out child reads `dev:backend-wire-schema`
and the screen, `runs.log` and the manifest all agree. Nothing is extracted from a `warn` or `done`
message, and a flow declaring `verdict_file` gets identical evidence.
*Test:* a run whose step declares `verdict_file` at a non-default path emits a field identical to one
that does not; and a findings array whose elements contain `" | "`, `": "` and `" — "` survives
element-for-element — the four separator-bearing findings on disk (§0.7) are the fixture's source.

**AC-5. Both gate kinds carry it.**
157 author-declared answers and 78 engine-presented ones are one mechanism reading one slot, not two
populations. An exhaustion gate carries the verdict of the step whose refusal reached it; an
author-declared gate carries the last one the run recorded.
*Test:* one fixture per kind — a `max_iterations: 0` refusal reaching `handleFail`, and a
`gate: human` reached after a passing verdict and an `integrate` — each asserting the field's four
members, and the second failing if the population is anchored on the fail path (§0.5).

**AC-6. Absence is absence.**
A gate with no preceding verdict-declaring step carries **no field** — absent, not an object with
empty members — and neither `core` nor the browser substitutes a previous run's, a previous gate's or
a previous iteration's value. Three sites reach `handleFail` and only one has a verdict.
*Test:* a script-step failure and an integrate failure each present a question whose field is
`undefined`; and the assertion names `development.yaml` as the shipped flow with **zero** `verdict:`
declarations, so the criterion fails if that stops being true.

**AC-7. The transport carries it without being edited, and a test says so.**
`wireRunOf` projects `gates` whole, so the field reaches `GET /runs/:id` with no change to
`packages/server`. That property is what makes this design cheap and is one refactor away from being
lost.
*Test:* over a real port, a run parked at a gate answers `GET /runs/:id` whose `gates[0]`
**deep-equals** the `GateQuestionEvent` the engine emitted, field for field — and the assertion fails
if `wireRunOf` is changed to copy the four members explicitly rather than pass the question through.

**AC-8. The screen renders it, whole, as text.**
The step id, the verdict word **exactly as the engine sent it** — never a noun the screen coins from
it, which is the rule Q-0016's `kind` guard already enforces one field over — the summary, and every
finding. Nothing is truncated, paged, or collapsed behind a control: the largest record in this
repository's history is 13 KB (§0.2), so there is no size to manage and no cap to disclose. Findings
and summaries are agent-controlled text and are rendered as text, never as markup.
*Test:* rendered against a question carrying all four members, the screen contains the step id, the
verdict string, the summary and **every** element of a 23-element findings array — the measured
maximum — with the rendered count equal to the array's length; and a source clause asserts the new
component carries no `dangerouslySetInnerHTML`, shown to discriminate against a string that has one.

**AC-9. Findings group only by the vocabulary `@quorum/shared` declares, and one matching none is
rendered whole and uncategorised.**
`FINDING_SEVERITIES` and `OBSERVATION_TAG` are **imported, never re-spelled** — so dropping `nit`
from the register stops this file compiling, and the AC-13 guard's surviving `blocker` needle
(§0.13) fails anyone who re-spells it. A finding matching none is **rendered in full, in its own
place, never dropped, never re-filed under a severity it does not claim and never counted into one**:
13.9% of this repository's findings are in that state. An empty findings array renders an explicit
statement that none was reported, and never an interpretation of that.
*Test:* a fixture of seven — one per severity, one `observation:`, one with no prefix, one prefixed
`minor:`, and an empty array — renders all six findings; the two unrecognised ones appear verbatim
and outside every severity group; deleting the unrecognised branch turns the assertion red with a
message naming the dropped text; and the empty-array case renders the named statement.

**AC-10. Absent and partial evidence each render a sentence a reader can act on, and AC-13's guard is
re-aimed rather than deleted.**
No empty region, no blank panel, no "—". Where the question carries no field the screen **names the
condition** — this gate follows a step that declared no verdict — and never composes a likely reason
or implies that nothing was wrong, which is `docs/04-architecture.md`'s placeholder rule, cited here
**by its words and never by a line number** (§0.13). The question, ticket path, retry-target
explanation, request states and answer controls stay usable in every case. `apps/web/test/source.test.ts`'s
AC-13 guard is **narrowed to what still holds**: `verdict`, `findings` and `summary` retire, and
`diff`, `hunk`, `blocker` and the `.message` ban **survive**.
*Test:* rendered against a question with no field, the screen contains that sentence and contains no
element whose text content is empty where a finding would be; and the guard's surviving clauses are
each demonstrated red on their own, the retired ones named in place as retired rather than removed
silently.

**AC-11. Malformed, stale and in-flight states cannot show a wrong verdict.**
A malformed evidence object puts the run read into its existing invalid-response state; the browser
renders no partial verdict from it. Navigating between handles, or retrying a read, cannot retain the
previous handle's evidence. Submitting an answer does not clear the evidence while that answer is in
flight, and the screen claims nothing about the ticket having advanced until a later read establishes
it.
*Test:* three cases — a response whose field fails the schema reaches the invalid-response state and
renders no verdict region; a render at handle B after handle A shows none of A's findings; and an
in-flight answer leaves the evidence rendered while the controls are disabled, with the
no-advance-claimed property asserted on the rendered text.

**AC-12. Every document and register describing the gate question moves with it.**
`contracts/Q-0050/run-events.contract.md` gains a **superseded-by** note beside its
`GateQuestionEvent` block, in the shape that file already uses three times — the original clause is
not edited away. `docs/04-architecture.md`'s `packages/server` and `apps/web` sections gain one
sentence each. `gate-screen.tsx`'s module header stops routing the verdict half to this ticket.
`apps/web/test/routes.test.ts`'s register clause and `packages/shared/src/docs.test.ts:1905`'s
`/Q-0129/` clause are **re-aimed at the successor, not deleted**. `docs/05-design-prompt.md` screen
6's divergence note is **not** rewritten: its figures are dated to Q-0016's gate, and a dated
measurement is not drift.
*Test:* a guard asserts the contract's superseded note names this ticket's decision entry by **title
and date** and not by file name or number; that no file under `apps/web/src` or `packages/server/src`
still routes the verdict to Q-0129; and both re-aimed register clauses are shown red against their
replacements rather than passing over an absence.

---

## §5 Non-goals

1. **The diff.** Split out — §7, and §0.12 for the argument neither candidate made.
2. **Widening the gate answer set.** `gateAnswerEnvelopeSchema` is `.strict()` over three and a
   fourth is a decision entry of its own. No reason field, no *"override with reason"* — corrected in
   three documents already by Q-0013, Q-0118 and Q-0017.
3. **Making `retry` primary, or offering it where the question carries no target.** Unchanged from
   Q-0016; §0.1 re-confirms the zero it rests on. `auto` and `human-locked` behaviour is untouched.
4. **A route serving `.harness/`**, or widening the ticket file listing. Refused with reasons (§0.8,
   §0.9), and the refusal is recorded in the decision entry so a later ticket does not re-litigate it.
5. **Adding `findings` or `summary` to the run manifest or to `Occurrence`.** Frozen contract (§0.10).
6. **A severity headline or cross-member deduplication** — `05-design-prompt.md` screen 6 sketches
   *"2 blockers, 5 majors deduplicated from 11 findings"*. A count over a vocabulary 13.9% of
   findings do not carry is a number that is wrong without saying so.
7. **Holding a socket on the gate route**, or rendering the run's event stream. Q-0016 ruled it;
   unchanged.
8. **Any change to `harness/flows/*.yaml`.** No flow gains a step, a verdict declaration or a
   `verdict_file`, so `docs/02-sdlc-pipeline-spec.md` §5's byte-identical snippets do not move — and
   AC-3(c)'s fixture is synthetic for this reason rather than by preference.
9. **A cap, a page or a collapse on the findings list.** §0.2 measured the payload; there is nothing
   to manage, and Q-0127's precedent is to satisfy the disclosure rule by having no cap.
10. **Updating `gate-screen.tsx`'s "148 of 220" or `05-design-prompt.md`'s figures.** Dated to
    Q-0016's gate; today's census is 157 of 235 (§0.1). A dated measurement is not drift, and any new
    sentence carries its own date.
11. **Q-0131's cost, elapsed time and early run number.** They inherit this ticket's transport ruling
    and are not implemented here, which is what the body's sequencing note asks for.
12. **Multi-user, remote daemon, cloud sync, plugin marketplace, node canvas, eval suites, a Gemini
    adapter, a desktop shell.** Out of v1.

## §6 Open questions

**None blocks solutioning.** Every question either candidate left open is ruled below rather than
asked, because a requirement that leaves a case uncovered is one `developer-generalist` must stop on
(Q-0105's remedy), and because a loop handed work no agent in it can perform is the pattern this
repository has recorded more than fifteen times.

**OQ-1 — a decision entry is owed, and its subject is the rule rather than the field. Ruled: yes.**
Two grounds. (a) It is a product statement: a run's event stream has carried narration and one
correlation token, and this makes it carry **a machine-readable value a human acts on** — the first.
(b) This ticket's own body says Q-0129 and Q-0131 *"both need one ruling — how a structured value the
engine already holds reaches a browser"*, and a ruling that binds a second ticket and is not written
down is what this repository keeps paying for. Proposed title: ***"A gate question carries the
decision that reached it"***. It does not reverse *"The event union is derived from what the product
emits, and `tool` and `text` are not invented"* (2026-08-25) — that entry says additions wait for a
producer, and the producer is `steps.ts`. The entry should also record the five refused routes (§3)
so Q-0131 does not re-derive them, and should state that **Q-0127 E-1's reader-side exclusion is left
standing**, which is the clause a later ticket will look for. **It is work `developer-generalist` may
not do**, so it is GO-1 and must land at this gate; it is filed in this run's findings as an
`observation:` under *"A finding is a claim about the change; anything else is an observation"*
(2026-09-11), whose own wording names *"an obligation that is somebody else's"* — the channel Q-0117
exists to provide. It is **not** a blocker to solutioning: the design is identical under either
ruling, and what depends on the answer is a file the human writes at the gate they are now at.

**OQ-2 — no glossary term is coined and none is owed. Ruled.** *Verdict* is used throughout the
product and appears in no glossary entry today, so coining one inside a ticket that is not about
vocabulary would be a second act; the **Event** entry already governs what the union carries and
gains one clause under AC-12. Recorded so it is not re-litigated at a review round. If the gate
disagrees, the term is *verdict* and the entry is the human's.

**OQ-3 — the field name is `reached`.** Three collisions measured (§3); one line to overrule.

**OQ-4 — the two exhaustive switches are left untouched, and the change says so.**
`packages/cli/src/trace.ts` and `apps/web/src/mission-control-trace.tsx` both switch exhaustively
over the union and neither breaks, because adding a field to an existing member still compiles. The
CLI already prints the verdict on its own `done` line, and mission control's one-field-per-kind rule
is Q-0015's ruling rather than this ticket's to widen. Non-blocking; stated so the silence is
deliberate.

**OQ-5 — the screen names the step by its interpolated id verbatim**, as the trace column does, so a
fan-out child reads `dev:backend-wire-schema` and the screen, `runs.log` and the manifest agree.
Non-blocking.

**OQ-6 — the verdict region starts expanded and the summary sits above the findings.** Visual, no
contract, no file format; settled during implementation. Non-blocking. Candidate-codex raised the
equivalent pair for the diff; they move to §7 with it.

## §7 The successor's body, transcribed in full — the gate screen shows the diff

*Written out here rather than referenced, because three obligations found orphaned in one week had
lived only inside a closed ticket's prose, and this ticket's own body opens by saying so.*

---

**Recommended: open at this gate, p3.** The half Q-0129 does not build, split on **disjoint
blockers** rather than on size — the seam Q-0013, Q-0091, Q-0096 and Q-0016 were each cut on, at a
gate and at cost.

**What makes the blockers disjoint.** Q-0129 needs one field in `packages/shared`, one slot and one
assignment in `packages/core`, no transport change, no new route and no dependency. This needs a
**diff renderer** — this workspace's first, `diff2html`, `diff` and `jsdiff` appearing in no
manifest, `apps/web` carrying no runtime dependency at all, and Q-0014 having measured that the
cold-store install already doubles — so a dependency needs a one-line justification and an entry if
it changes architecture, and a hand-written unified-patch view with added/removed distinction and
long-line handling is a design problem of its own.

**The transport is the cheaper half and candidate-codex found it: snapshot the bytes the reviewing
step was given, never re-run `git diff` at the gate.** `materialiseDiff` is `engine/diff.ts`'s, takes
a run's `DiffContext` and is a prompt-building function inside a run, so a route cannot call it —
but the run already holds what it produced. Re-deriving at the gate would be a second measurement
after refs may have moved, so the browser could show a diff the reviewer never saw. Reuse removes
that rather than mitigating it.

**And that is exactly why it cannot ride on the gate question unbounded.** `repo.max_diff_bytes`
defaults to **200,000**, a gate question enters the broadcast's `retained` buffer
(`DEFAULT_RETENTION` = 500) and is **replayed to every late subscriber and on every reconnect**, and
Q-0123 ruled four days ago that a record is never released — on an arithmetic of **214 B mean per
event and ~0.1 MB per ended run**. A 200 KB event is ~1,000× the mean. **The first thing this ticket
owes is a measured decision about where those bytes live**: on the question, behind a route keyed on
the `gateId` the daemon already holds, or fetched on demand. Q-0129's 13 KB snapshot is inside
Q-0123's arithmetic and this is not, so the two halves genuinely differ in kind and not only in size.

**The measurement that decides the sequencing: there is nothing to show.** All **40**
`harness/*/integration` branches in this repository are contained in `main` —
`git merge-base --is-ancestor` answers yes for 40 of 40 — so `{base}...integration` is **0 bytes**
for every one of them, and `integration...implement` is 0 bytes too, `implement` having been merged.
**Every diff range in every shipped flow is empty for every ticket in this backlog.** The half is
non-empty only for a run in flight. So its acceptance evidence must be a repository the test builds
— `git.test.ts`'s shape — and no demonstration at a gate can use a real past ticket. That is
Q-0077's subject arriving as a sequencing fact.

**The range is flow-dependent and the gate is not the step that had one.** `review.yaml` diffs
`{base}...harness/{id}/integration`; `chore.yaml` diffs
`harness/{id}/integration...harness/{id}/implement`; `chore`'s gate follows `integrate`, three steps
after the review that read a diff. Nothing on the wire says which range this run's reviewer saw. The
first decision is whether the range travels with the evidence — the shape Q-0129 will have
established, and the only one that is identity rather than inference — or is re-derived from the flow
file, which cannot tell which of a flow's several `input.diff` sites a gate follows.

**Q-0128 is the neighbour and the collision is real.** A diff served to a browser has the same
truncation question a diff handed to a reviewer has, and answering it twice in two places is how the
two drift. `materialiseDiff` truncates **head-only**, so what is lost is every patch for the
alphabetical tail, entirely. Q-0124 made that loss **speak** — a `warn` naming the files with no
patch at all — and the `diff truncated range=` token is **load-bearing**: `diff.test.ts`'s AC-9.5
counts materialisations off it. Whatever this ticket does about a cap must reuse that machinery or
say in one line why not. It must **not** decide whether a truncated review may approve; that is
Q-0128's.

**It owns two guard needles Q-0129 leaves in place.** `apps/web/test/source.test.ts`'s AC-13 keeps
`diff` and `hunk` forbidden in the gate screen, and its AC-14 keeps the retired placeholder sentence
*"The gate screen shows a step's verdict and diffs, and takes the answer."* absent. Both are this
ticket's to re-aim, and both stay valid and unweakened while it waits — which is a property of the
split rather than a coincidence.

**What it must not do.** Widen the gate answer set. Serve a patch from a range the guard at
`diff.ts` would refuse — both endpoints must be the configured base or one of the ticket's own
branches, with the static twin in `lint/lint.ts`. Show a fabricated or partial diff without saying
so, which is `docs/04-architecture.md`'s placeholder rule, **cited by its words and never by a line
number, which has now moved three times** (`:200` → `:317` → `:336`).

**Start by re-measuring, and re-measure the containment figure first**: it is the one that decides
whether this ticket can be demonstrated at all, and it moves every time a branch lands.

---

## §8 Risks

**R-1 — the decision entry is a precondition no step on the route can satisfy.** More than fifteen
recorded appearances, and on the two occasions the hazard was named in advance (Q-0062 GO-1,
Q-0122 E-1) it was named correctly and ignored once, at three implement rounds. **Mitigation:** GO-1,
plus the gate verifying by grep that the landed entry reaches the next step's actual `prompt.txt` —
the check Q-0097 lost two errata by not making and Q-0125 GO-1 made.

**R-2 — the field is added and something projects it away.** AC-7 exists for this: `wireRunOf`'s
pass-through is the whole reason the transport needs no edit, and it is one tidy-up away from being a
four-member copy. The criterion is deliberately a deep-equality over a real port rather than a read
of the source.

**R-3 — a round argues for a severity headline.** `05-design-prompt.md` screen 6 sketches one; it is
a non-goal on a measurement (13.9%), named in advance so a round does not spend itself arguing it.
§5.6 is the clause to cite.

**R-4 — the diff half is folded back in at the gate.** Q-0122's gate refused its own document's
recommended split and paid three implement rounds for twenty criteria. If this one is refused, the
remedy named in advance is **a second erratum splitting it at the next gate, not a fourth implement
round**, and AC-1 to AC-12 are the half that must survive intact. §0.12's retention arithmetic is the
measurement that refusal has to answer.

**R-5 — the review diff is truncated and the review is handed a fraction of the change.** Q-0016's
own rounds 2 and 3 were handed 91.6% and 87.3%, and the cut hid `packages/shared/src/wire.ts` —
AC-1's neighbour in path order, and this change touches `packages/shared/src/events.ts`, one file
over. **Mitigation:** Q-0124's warn and Q-0117's `observation:` channel have composed on the last
three tickets and are now a mechanism rather than a coincidence; a hand pass over any named file is
owed at the gate if they do not. **Q-0128** owns the cause.

**R-6 — a `packages/shared` change moves every package's test hash.** Expected and cheap; recorded so
a round does not read it as a defect.

**R-7 — AC-3(c)'s fixture is synthetic and could be mistaken for a shipped shape.** No flow has two
verdict-declaring parallel members (§0.6), and §5.8 forbids inventing one in `harness/flows/`. The
criterion says so in its own text, so a reader does not go looking.

## §9 Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, no vendor CLI, no credential on any path; no login behaviour changes. |
| **Worktree safety** | n/a. Nothing writes to the working tree or a worktree. The new slot is in-memory and run-scoped; no file is created and no branch rule changes. |
| **Gate behaviour** | Answer set unchanged at three, `human-locked` still cannot be automated, the `retry` control's condition untouched. Under `--dry` **no question is emitted at all** — `askGate` returns `'advance'` before `context.emit(request)` — and `runAgentStep` returns before any verdict, so the field has no dry behaviour to specify. Under `--auto` a non-`human-locked` gate auto-advances without emitting, unchanged. |
| **File format and schema** | `gateQuestionEventSchema` gains one optional field, `.strict()` preserved at both levels; `wireRunSchema` re-uses it and is not re-declared. No ticket-file, manifest or flow-file format changes. `run-manifest-v1` untouched. |
| **Lint rules** | None. No flow file changes, so `lintFlow` gains no rule. TypeScript strict and `@typescript-eslint/no-deprecated` apply to all changed source. |
| **Cold-clone impact** | None measurable. No dependency, no new command, no new install step; the first 30 minutes are unchanged. |
| **Product-agnostic** | No product name reaches any of it. |
| **Files are the database** | The value already **is** a file (`.harness/…-verdict-iter-N.json`) and stays one. This adds a second reader of the same fact in memory, not a second store; nothing is persisted that was not already. |
| **Errors are explicit** | A gate with no verdict behind it renders a named sentence (AC-10), never a default and never silence; malformed evidence reaches the existing invalid-response state (AC-11). |

## §10 What the gate owes before a line is written

- **GO-1 (hard precondition).** Rule OQ-1 and **land the entry before the next run of any kind**,
  then verify by grep that it reaches that step's actual `prompt.txt`. Cite it by title and date.
  Without it round 1 returns `blocked` — which is Q-0126's exact failure and Q-0062's three rounds.
- **GO-2.** Ratify `reached`, or overrule it in one line (§3 carries the three collisions).
- **GO-3.** Rule the split. If it is refused, write down what that costs rather than presenting
  twenty-plus criteria as fine, name the erratum that would split it as the remedy on exhaustion
  (Q-0122 E-1's shape), and answer §0.12's retention arithmetic in the same breath.
- **GO-4.** Open the successor at this gate with §7 transcribed in full, and record its id here. An
  obligation left in a closed ticket's prose is the failure this ticket's own body opens by naming.
- **GO-5.** Verify the merge **forced in both environment rows** — a worktree with neither
  `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge — with
  `pnpm turbo run test --force --continue`, `pnpm lint`, `pnpm typecheck`, `quorum lint` and the
  git-identity sweep recorded. No registry-resolved installation is claimed.
- **GO-6.** Discharge by **running the product, and record what was done rather than that it was
  done**: park a real run at a real gate, open the gate screen in a browser, and transcribe what it
  rendered — the step id, the verdict, and at least one finding — into `runs.log`. Q-0016's GO-6
  asked for exactly this and **was reported discharged when the by-hand half had not been
  performed**; Q-0015's gate found that, and Q-0130's GO-4 was written to be unfakeable for the same
  reason. This one is written the same way.

## §11 Provenance

**Both candidates independently reached the same transport** — the engine snapshots the structured
verdict onto the existing gate question — which is the strongest evidence available that it is right,
and it is adopted.

**From candidate-claude**, which is the better document on scope discipline and on measurement:
- **The split**, and §7's successor body. Ten criteria against codex's eighteen, which is past this
  role's ceiling of fifteen and at the count Q-0013 was refused at.
- **§0.3's decisive finding** — the gate question carries no `stepId` — which forecloses every
  correlate-in-the-browser design and is the reason the field goes on the question.
- **§0.4** — `wireRunOf` passes `gates` whole, so the transport needs no edit. Verified in the source
  and in its own JSDoc.
- **§0.7's stronger refusal of prose-parsing**: the separator counts (4 of 1,080), the colon in a
  step id by construction, and the finding that the prose can only over-split.
- **§0.8's and §0.9's identity wall** reaching the `.harness/` route, and the `readFiles` /
  `listTicketFiles` asymmetry that shows Q-0127 E-1 ruled only the reader side.
- **§0.11's severity measurement** (13.9% outside the vocabulary) and the criterion that gives them an
  honest place — AC-9.
- **§0.13's correction** of `docs/04-architecture.md:317` → `:336`, third position for one sentence.
- The five-route refusal table, and the field name `reached` with its three measured collisions.

**From candidate-codex**, which is the better document on engineering rules:
- **AC-3's provenance rule.** Its AC-4 is right that declaration order beats completion order, and
  its R-1 names the timing hazard claude's rule walks into. Adopted and re-stated as one mechanism.
- **AC-4's fidelity clauses** — exact validated values, an empty array and an empty summary preserved,
  nothing extracted from a message, a `verdict_file` override changing nothing.
- **AC-11 entirely** — malformed evidence, stale evidence across a handle change, and an answer in
  flight. Its AC-15 is a genuinely good criterion that claude has no analogue for, and it is the one
  place a wrong verdict could still reach a reader.
- **AC-8's text-not-markup clause**, from its AC-10: findings are agent-controlled text and that is a
  real injection surface.
- **AC-6's whole-or-absent framing** and its insistence that neither layer synthesizes a placeholder.
- **§7's diff transport** — snapshot the bytes the reviewing step was given, never re-run `git diff`
  at the gate. Materially cheaper and more honest than claude's §7, which assumed a new `core`
  function and a route; the successor's body is rewritten to carry codex's shape.

**Struck from candidate-codex:** its AC-2, which makes the decision entry an **acceptance criterion**
— a criterion naming a surface the flow cannot write, which is *"A requirement may not name a surface
its flow cannot write"* (2026-08-25) and Q-0069's AC-11(b) failure. It is GO-1 here. Its AC-18
(verification commands) is GO-5 for the same reason. Its AC-14, AC-16 and AC-17 are folded into
non-goals and AC-12 rather than spending criteria on properties Q-0016 already pins.

**Corrected in both, from the code:** §0.5. `handleFail(step, context)` receives no output, and the
verdict artifact is written for a **pass** verdict too — so claude's AC-2, anchored on the fail path,
would have rendered nothing at the gate 154 of this repository's 157 author-declared answers were
given at. One run-scoped slot assigned where a verdict is validated is not the cheaper shape; it is
the only one that works.

**New here, contributed by the merge rather than by either candidate:** §0.12's retention arithmetic
— a gate question is retained in the broadcast buffer and replayed to every late subscriber, so
Q-0123's 214 B mean and ~0.1 MB per ended run bound what may ride on one. It is a second, independent
argument for the split and a constraint §7 must answer. Also AC-5 (both gate kinds as one criterion,
which neither candidate has), §0.6's measurement that **no shipped flow discriminates the two
ordering rules**, and §0.13's third point — that of AC-13's six forbidden words only three retire,
with the surviving `blocker` needle becoming the enforcement of AC-9's import rule.
