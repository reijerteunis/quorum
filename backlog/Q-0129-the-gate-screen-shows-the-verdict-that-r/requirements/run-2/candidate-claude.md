# Q-0129 — The gate screen shows the verdict that reached it, and the diff

*Requirements, run 2, candidate `pm-claude`. Every figure below was measured against tip `3f60bc3` on
2026-09-17 and none was copied from this ticket's body, from `docs/06-development-plan.md`, or from
run 1's candidates — which is what the body's own closing paragraph instructs and what Q-0099 is the
record of.*

---

## §0 What was re-measured, and the five things that reshape the ticket

### 0.1 The census, decomposed by the body's own method

`grep -h 'gate=' backlog/*/runs.log | wc -l` returns **275**. It decomposes exactly as the body says
it does, and the decomposition is complete — nothing is left over:

| | count | shape |
| --- | --- | --- |
| engine-recorded answers | **235** | `gate=<kind> answer=<advance\|retry\|abort>`, written at `routing.ts:48` alone |
| retry grants | **39** | `gate=retry counter=… set=…`, `routing.ts:94` |
| hand-written erratum note | **1** | Q-0103's, `gate=erratum answer=E-1` |
| | **275** | |

By kind: **`gate=human` 157** (154 `advance`, 3 `abort`) and **`gate=human-locked` 78** (39 `retry`,
31 `advance`, 8 `abort`). `human-locked` is the **engine-presented** gate's kind — `routing.ts:139`
builds it with that literal — so the two kinds are the two the glossary distinguishes, and the split
is 157 author-declared to 78 engine-presented. **`retry` was chosen zero times at an author-declared
gate**, which is the zero Q-0016 shipped its third control against and it has not moved.

The body's 2026-09-17 note says 235 and 157. Both confirmed independently here.

### 0.2 The verdict artifact, measured rather than described

**306 files across 73 ticket folders**, of which **230** are run-scoped (`.harness/run-N/…`, Q-0089's
shape) and **76** flat (written before 2026-09-01). They are the whole of `.harness/` under
`backlog/` bar three `.raw.txt` dumps — 309 files in total.

Sizes: min **160 B**, median **2,249 B**, p95 **8,276 B**, max **13,061 B**, total **947,608 B**.
Findings per file: median **2**, max **23**. Verdict values across all 306: `revise` 98, `ready` 62,
`approve` 54, `proceed` 46, `needs-input` 33, `changes-requested` 10, `blocked` 3.

**The payload is small, and that is a load-bearing fact.** The largest verdict record in this
repository's whole history is 13 KB, against a ticket folder reaching 3.1 MB and a `WireTicketDetail`
listing that measured 1,214 bytes at Q-0127. Whatever channel this takes, nothing here needs a cap
and nothing here is a payload risk. That is stated so a later round does not design one.

### 0.3 The finding that reshapes the ticket: **the gate question names no step**

`gateQuestionEventSchema` (`packages/shared/src/events.ts:179`) is `.strict()` over exactly five
fields: `type`, `gateId`, `kind`, `reason`, `ticketDir`, plus an optional `retry`. **There is no
`stepId` and no other correlation field.**

So a browser holding `WireRun.gates` — which is what Q-0016's screen renders — has **nothing to join
a step's decision to the gate it is answering**. That forecloses the whole family of designs that
widen `done` or `warn` and ask the browser to correlate: the `warn` carries no `stepId` at all
(`warnEventSchema` is `.strict()` over `{type, message}`), the `done` carries one but the gate does
not, and "the most recent `done` before the gate" is inference rather than identity — the same
inference alternative (iii) was struck for.

**The corollary is the design.** The only shape that needs no correlation is one where **the gate
question carries what reached it**, because the question is the thing the human is answering.

### 0.4 And that shape needs **no change to `packages/server` at all**

`wireRunOf` (`packages/server/src/wire.ts:124`) is:

```ts
gates: view.gates,
```

— the questions pass through **whole**, deliberately, under Q-0121's rule that *"the question a
browser echoes back has to be the question `askGate` emitted"*. `RunView.gates` is
`gates.pending(record.handle)`, derived per request. So a field added to the question in
`packages/shared` reaches `GET /runs/:id` and the browser with **zero transport edits**, and
`wireRunSchema` already validates it by re-using `gateQuestionEventSchema` as its element rather than
re-declaring the six fields.

That is measured, not assumed: it is why Q-0121 wrote the element that way.

### 0.5 Coverage: **223 of 235 gates had a verdict, and all 12 that did not are `development`**

Walked per run, respecting run boundaries, over every `runs.log` in the backlog:

| gate kind | a verdict was recorded earlier in the run | none was |
| --- | --- | --- |
| `human` (author-declared) | 148 | 9 |
| `human-locked` (engine-presented) | 75 | 3 |
| **total** | **223** | **12** |

**Every one of the twelve is a `development` run**, and the reason is structural rather than
accidental: of the six shipped flows, five declare a verdict somewhere and **`development.yaml`
declares none** (`grep -c 'verdict:'` returns 2, 1, 1, 1, 1 and **0**). So the absent case is named by
the flow file and is not a gap in the mechanism.

*(Coincidence flagged so a later reader does not read it as a transcription: **148** here is
"author-declared gates that had a verdict", and **148** in `docs/04-architecture.md` and
`docs/05-design-prompt.md` is Q-0016's "author-declared gates out of 220 answers" measured on
2026-09-16. Two different measurements that happen to agree on a number. Neither was copied from the
other.)*

### 0.6 Alternative (i) is refused — **and not for the reason the body gives**

The body refuses prose-parsing because *"a `revise` carrying no findings emits no em-dash and no
list, and the separator a parser would key on is absent exactly when the list is."*

**That case cannot occur.** Two independent sites forbid it. `schemaFor`
(`packages/core/src/engine/prompt.ts:109`) pushes `verdict` **and** `findings` onto `required`
whenever a step declares a verdict; and `checkAgainstSchema` (`adapters.ts:656`) refuses any non-pass
verdict carrying an empty list — *"`<verdict>` requires findings"* — before `steps.ts` reaches the
`warn` line at all. Measured on disk: of **144 non-pass verdicts**, **zero** carry an empty findings
array. The hazard is closed by contract, not merely unobserved.

**The live ground is the opposite one, and it is a measurement:**

| over 1,080 findings on disk | count |
| --- | --- |
| containing the join separator `" \| "` **in their own text** | **4** |
| containing `": "` — the separator between step id and verdict | **1,071** |
| containing `" — "` — the separator before the list | **655** |
| containing a newline | 0 |

Three of the four separator-bearing findings are TypeScript union types written out —
`` `refused | running | ended` ``, `` `missedCount: number | null` `` — which this codebase writes
constantly. A parser keyed on ` | ` would have **split a real finding into two** and reported more
findings than were written.

And the step id cannot be recovered either: `composite.ts:144` gives a fan-out child the id
`` `${step.id}:{task.id}` ``, so a step id **contains a colon by construction**. Real ones in this
repository's run history: `dev:backend-wire-schema`, `dev:frontend-connection-state`,
`dev:frontend-dev-proxy`.

So alternative (i) is refused on the ground that **the prose can only over-split, never
under-split** — which is a stronger refusal than the body's, and it is the one to carry forward.

### 0.7 Alternative (iii)'s identity wall reaches **(b)** as well, which the body does not say

The body struck *"read it from run history"* because a parked run has `runId: null`. **The same wall
stops a route over the `.harness/` artifact**, and that is the measurement that settles half (a)'s
design rather than merely preferring one:

- the default path is `` `${TICKET_ARTIFACT_DIR}/run-{run}/${stepId}-verdict-iter-{iter}.json` ``
  (`steps.ts:339`) — **scoped by `{run}`**, the engine's run number;
- `host.ts` sets `record.runId` **only in the terminal branch** (`observe`, `:302`), so for a live
  parked run the daemon does not hold one;
- the number **is** on the wire, inside `gateId` — `engine.ts:329` composes `` `${runId}:${seq}` `` —
  and `host.ts`'s own JSDoc refuses it in as many words: *"Nothing here reads an event's `message`
  text or takes a run number out of a `gateId`: two authorities for one run's identity is what
  `minted` exists to prevent."*
- and even with a run number the path is not derivable, because **`verdict_file` is an author
  override** (`stepOutputDeclarationSchema`, `packages/shared/src/step-output.ts`). A flow may point
  it anywhere inside the ticket folder.

Globbing `.harness/run-*/` for the newest is inference, not identity — which is exactly what
alternative (iii) was struck for.

**A fourth route was measured and is refused here rather than left to a round to find.**
`.quorum/locks/<ticket-id>.json` carries the run number, so a daemon could read it. Refused: the
lock's subject is a **ticket**, not a run, and reading it would give one run two authorities for its
own identity — the thing `minted` exists to prevent — while a stale lock is refused rather than
reclaimed and would make the screen's answer depend on a file the run may not own.

### 0.8 `.harness/` is already read by a flow, and the asymmetry is deliberate

`harness/flows/requirements.yaml:23` declares
`".harness/run-{run}/head-of-product-verdict-iter-*.json"` in `input.backlog`. So **a shipped flow
already reads the verdict artifact**, through `Backlog.readFiles`, which has no exclusion at all —
the exclusion lives in `listTicketFiles` alone (`backlog.ts:334`, `rel.split(/[\\/]/)[0].startsWith('.')`).

The asymmetry is the ruling: **`readFiles` serves `.harness/` to an agent; `listTicketFiles` withholds
it from a reader.** Q-0127 erratum E-1 ruled only the reader side, and says so: *"What this erratum
does not settle: whether any other surface may serve `.harness/`. Nothing here reaches that, and a
later ticket that wants to is owed its own entry."* A new HTTP route would be the **reader** side —
the side E-1 ruled against — so option (b) costs an entry that reverses a ruling four days old, on
top of an identity problem it cannot solve.

### 0.9 Run history cannot carry it, and that is a frozen contract rather than a preference

`Occurrence` already carries `verdict: string | null` and it is already served by `GET /history/:id`.
It carries **no `findings` and no `summary`**, and it cannot gain them:
`contracts/Q-0011/run-manifest.schema.json`'s `$defs.step` is `additionalProperties: false` with
**15 properties, all 15 required**, under `x-quorum-contract: run-manifest-v1` — a frozen contract
with a semantic validator behind it (`core/contracts`). So the third of the triple that already
exists on a shipped route is the third the screen needs least, and the two it needs cannot go there.

### 0.10 The severity vocabulary exists — and **150 of 1,080 findings fall outside it**

`FINDING_SEVERITIES = ['blocker', 'major', 'nit']` and `OBSERVATION_TAG = 'observation'` are exported
from `packages/shared/src/constants.ts`, and `FINDING_PATTERN` pins the shape — but only for a step
whose vocabulary contains `changes-requested` (`prompt.ts:105`), which in the shipped flows is
`review.yaml`'s `verdict` step alone.

Measured over all 1,080 findings: `nit` 366, `observation` 303, `major` 210, `blocker` 51 — and
**139 carrying no recognised prefix at all**, plus `minor` 8 and three one-off words. **150 of 1,080,
13.9%**, would fall outside a four-bucket rendering. 103 of the 139 come from `head-of-product`,
whose flow instruction declares no taxonomy.

So the screen may group by the declared vocabulary — it is a real shared register, not a convention
it would be coining — and it must have an honest place for one finding in seven that matches none.

### 0.11 The diff half, measured — and the measurement is why §7 recommends a split

- **There is no diff function in `core`.** `packages/core/src/git/git.ts` exports twelve functions
  and none of them diffs; the barrel exports three of them (`configuredUser`, `containment`,
  `pushLag`). `materialiseDiff` is `engine/diff.ts`'s, takes a `DiffContext` — `vars`, `deferredDiffs`,
  `persistence`, `config` — and is a prompt-building function inside a run. A route cannot call it.
- **Two distinct ranges exist, and the gate is not the step that had one.**
  `review.yaml` diffs `{base}...harness/{id}/integration` (twice, in a parallel block) and
  `chore.yaml` diffs `harness/{id}/integration...harness/{id}/implement`. `chore`'s gate follows
  `integrate`, three steps after the review that read a diff. Nothing on the wire says which range
  this run's reviewer actually saw.
- **Every one of those ranges is empty today.** All **40** `harness/*/integration` branches in this
  repository are contained in `main` — `git merge-base --is-ancestor` answers yes for 40 of 40 — so
  `{base}...integration` is **0 bytes** for every one of them, and `integration...implement` is 0
  bytes as well, `implement` having been merged. That is Q-0077's subject, and it means a diff
  feature ships with **no fixture and no demonstration available from this backlog**: its acceptance
  evidence must be a repository the test builds, and a reader opening a gate screen for a past run
  sees nothing.
- **It would be this workspace's first diff dependency.** `diff2html`, `diff` and `jsdiff` appear in
  no manifest, and `apps/web` carries ten devDependencies and no runtime dependency at all.

### 0.12 Two corrections to this ticket's own body

1. **`docs/04-architecture.md:317` is wrong.** Line 317 is blank; the placeholder rule — *"No
   placeholder is a blank panel, a spinner or a skeleton, and none shows a fabricated project, run,
   ticket or cost"* — is at **`:336`**. This is the third recorded position for that one sentence:
   Q-0016's body cited `:200`, its gate corrected it to `:317`, and the document has grown since. A
   line number into a living document is a measurement that rots within days; **this requirement
   cites that sentence by its words and never by its line**, and AC-10 does the same.
2. **The alternative-(i) argument** is corrected by §0.6 above: right conclusion, wrong mechanism.

*One observation, recorded because it is about the product rather than the ticket: this ticket's own
**run 1 was stopped from the browser** — `runs.log` carries
`error="stopped by a reader in the Quorum web app"`, which is `daemon-client.ts`'s
`BROWSER_STOP_REASON`. That is Q-0130's stop control used against a real run two days after it
shipped, and the first instance in this backlog that is not that ticket's own demonstration. No
criterion follows from it.*

---

## §1 Problem

A run parks at a gate. Q-0016's screen tells the `maintainer` what is being asked — the kind, the
reason verbatim, the ticket folder, the answers the gate will honour — and tells them **nothing about
what the step before it decided**. Its AC-13 makes that a checked property rather than an omission:
`apps/web/test/source.test.ts:829` fails if the screen names `verdict`, `findings`, `summary`, `diff`,
`blocker` or `hunk`, or reads an event's `.message`.

So the human answering the most consequential control in this product — `advance`, `retry` or
`abort`, one word, irreversible — is answering from a sentence a flow author wrote months ago
(*"Chore owner approves the reviewed change now on the ticket branch, with the suite green"*) and
from nothing the run itself produced. The evidence exists: `steps.ts:340` writes `{verdict, findings,
summary}` to disk at the moment it decides to fail the step, and **223 of this repository's 235
recorded gate answers had one available**. It has never reached a reader who was not in a terminal.

The cost is measurable in this backlog. Every one of those 223 answers was given by somebody who had
to open `runs.log` or a `.harness/` JSON in an editor to see what they were approving — which is the
workflow `quorum board` and the CLI have, and which the gate screen exists to replace.

## §2 User stories

**`maintainer`** — *I am answering a gate in the browser. I want to see the verdict the step declared,
its summary and every finding it reported, so that `advance` is a decision rather than a guess — and
where the step declared none I want to be told that, not shown an empty box I read as "nothing was
wrong".*

**`maintainer`, second** — *When a run parks after a fan-out I want to know **which step** decided,
because `dev:backend-wire-schema` and `review` are different claims and the gate question does not
say which one I am looking at today.*

**`adopter`** — *I ran my first chore flow and it stopped. I want the browser to tell me what the
reviewer said, in its own words, without my learning where `.harness/` is or that it exists.*

**`contributor`** — not a persona for this ticket, and the reason is worth stating rather than
leaving blank: nothing here touches the adapter contract, the vendor-facing schema or the JSONL
mapping. A new adapter neither gains nor owes anything.

## §3 The recommended shape, and every alternative refused with its measurement

**The gate question carries what reached it.** `gateQuestionEventSchema` gains exactly one optional
object field — whole or absent, never partly present — carrying the step's id and the three values
`steps.ts` already holds in hand at the moment it decides the step failed. `packages/core` populates
it at the one site that has them. `packages/server` changes not at all (§0.4). The browser renders
it from `WireRun.gates`, which Q-0016's screen already reads and already parses.

**Why this and not the others**, each refused on a measurement rather than a preference:

| candidate | refused because |
| --- | --- |
| parse the `warn` or `done` prose | 4 of 1,080 findings contain the join separator themselves and 1,071 contain `": "`; a step id contains a colon by construction. Over-splits (§0.6). |
| widen `done`/`warn` structurally | the gate question carries no `stepId`, so there is nothing to correlate on (§0.3). |
| a route over the `.harness/` artifact | the path is `{run}`-scoped, a parked run's `runId` is `null`, the only wire copy is a `gateId` the host refuses to parse, and `verdict_file` is author-overridable. Plus it reverses Q-0127 E-1's reader-side ruling and owes an entry for doing so (§0.7, §0.8). |
| read it from run history | struck at Q-0016's gate for identity; and the manifest is frozen at 15 keys, so `findings` and `summary` could not go there anyway (§0.9). |
| read the run lock for the run number | gives one run two authorities for its own identity; a stale lock is refused rather than reclaimed (§0.7). |

**The field is named `reached`** — `question.reached.verdict`, `question.reached.findings`. Stated
rather than asked, because a requirement that leaves a case uncovered is one
`developer-generalist` must stop on (Q-0105's remedy). The three rejected names and their collisions,
so the gate can overrule with one line rather than re-deriving: **`verdict`** would make
`question.verdict.verdict`; **`outcome`** is a near-homograph of `RunOutcome`/`StartOutcome`/`StopOutcome`,
which are run-level; **`decided`** is a near-homograph of `undecided`, a run status in
`docs/GLOSSARY.md`. `reached` collides with none of the 40 glossary terms and with no exported
identifier.

**The diff is not built here.** See §7, which is the successor's body written out in full.

## §4 Acceptance criteria

Ten criteria, against this role's ceiling of fifteen and the eighteen Q-0013 was refused at. Each
*Test:* clause **bounds the instrument**: a reviewer may find that the instrument fails the job the
clause gives it, and may not raise the job (Q-0067 E-1).

---

**AC-1. `gateQuestionEventSchema` gains exactly one field, and it is whole or absent.**
The field is optional on the event and its value is an object carrying four members — the step's
interpolated id, the verdict word as the step declared it, the findings array as the step returned
it, and the summary. All four present or the field absent: there is no state in which a reader is
shown a verdict with no step, or findings with no verdict. The schema stays `.strict()`, and the
object's own schema is `.strict()` too. No other member of the event union changes; no event gains a
timestamp, a sequence number or a run id.
*Test:* the schema accepts a question with the field and one without; rejects an object missing any
of the four members; rejects an unknown key on either level; and the union's other eight members
parse byte-identically to before, asserted over `contracts/Q-0050/run-messages.fixture.json`.

**AC-2. `core` populates it at exactly one site, and that site is the one that already holds the
values.**
`steps.ts:339–365` writes the verdict artifact and then calls `handleFail` with the same three values
in scope. The question `handleFail` builds carries them from there. Nothing re-reads the artifact,
nothing re-parses an emitted message, and nothing composes a second path to the value.
*Test:* a mock-adapter run whose step declares a non-pass verdict emits a gate question whose field
carries that step's id, verdict, findings and summary, compared **member by member** against the JSON
the same run wrote to `.harness/` — so the two sources are shown to agree rather than the test
asserting one of them twice.

**AC-3. At an author-declared gate the field carries the last verdict the run recorded.**
`chore.yaml`'s gate follows `integrate`, three steps after the review that decided; `review.yaml`'s
follows its `verdict` step. One run-scoped slot on `RunContext`, beside `lastIntegration` and
`failingTasks`, which already exist for this purpose — assigned where a verdict is declared and read
where a gate is built.
*Test:* a chore-shaped mock flow — verdict step, then a step declaring none, then `gate: human` —
emits a question whose field carries the **verdict step's** id and values; and a second fixture in
which two verdict steps run proves the **later** one is carried.

**AC-4. A gate with no verdict behind it carries no field, and `development.yaml` is the fixture.**
Three sites reach `handleFail` — `steps.ts:365` (agent, non-pass verdict), `steps.ts:403` (script,
non-zero exit) and `composite.ts:411` (integrate failure) — and only the first has a verdict. A flow
declaring none never has one at all.
*Test:* a script-step failure and an integrate failure each present a question with the field absent —
`undefined`, not an object with empty members; and the assertion names `development.yaml` as the
shipped flow with zero `verdict:` declarations, so the criterion fails if that stops being true.

**AC-5. No second path to this value exists anywhere in the product.**
A source guard over `packages/server/src` and `apps/web/src`: no file reads an event's `.message` for
a machine value, no file splits a `gateId`, no file names `.harness` or `TICKET_ARTIFACT_DIR`, and no
route is registered under a path containing `verdict`. The needles are assembled so the guard is not
its own subject, and each needle is shown to discriminate against a string that should match.
*Test:* the guard is demonstrated red four ways — one injected `.message` read, one `gateId.split`,
one `.harness` literal, one registered `/runs/:id/verdict` route — each with a distinct message.

**AC-6. The transport carries it without being edited, and a test says so.**
`wireRunOf` projects `gates` whole, so the field reaches `GET /runs/:id` with no change to
`packages/server`. That property is what makes this design cheap and is exactly the kind of property
a later tidy-up removes by projecting the gates into a narrower row.
*Test:* over a real port, a run parked at a gate answers `GET /runs/:id` whose `gates[0]` **deep-equals**
the `GateQuestionEvent` the engine emitted, field for field — and the assertion fails if `wireRunOf`
is changed to copy the four members explicitly rather than pass the question through.

**AC-7. The screen renders it where the question carries one.**
The step id, the verdict word **exactly as the engine sent it** — never a noun the screen coins from
it, which is the rule Q-0016's `kind` guard already enforces one field over — the summary, and every
finding. Nothing is truncated, collapsed behind a control, or summarised: the largest record in this
repository's history is 13 KB (§0.2), so there is no size to manage and no cap to disclose.
*Test:* rendered against a question carrying all four members, the screen contains the step id, the
verdict string, the summary and **every** element of a findings array of length 23 — the measured
maximum — and the count of rendered findings equals the array's length.

**AC-8. Findings are grouped only by the vocabulary `@quorum/shared` already declares, and one that
matches neither is rendered whole and uncategorised.**
`FINDING_SEVERITIES` and `OBSERVATION_TAG` are imported, never re-spelled — so dropping `nit` from the
register stops this file compiling. A finding matching none of them is **rendered in full, in its own
place, never dropped, never re-filed under a severity it does not claim, and never counted into one**:
13.9% of this repository's findings are in that state (§0.10).
*Test:* a fixture of six findings — one per severity, one `observation:`, one with no prefix, one
whose prefix is `minor:` — renders all six; the two unrecognised ones appear verbatim and outside
every severity group; and deleting the unrecognised branch turns the assertion red with a message
naming the dropped text.

**AC-9. Where the question carries no field the screen says why, and AC-13's guard is re-aimed rather
than deleted.**
No empty region, no blank panel, no "—". The sentence names the condition — this gate follows a step
that declared no verdict — and never composes a likely reason or implies that nothing was wrong.
`apps/web/test/source.test.ts`'s AC-13 guard is **narrowed to what still holds** (the screen reads no
event `.message`, and coins no noun from `kind`) rather than removed, on the precedent of Q-0016
re-aiming the write guard instead of deleting it.
*Test:* rendered against a question with no field, the screen contains that sentence and contains no
element whose text content is empty where a finding would be; and the retired half of the AC-13 guard
is shown to have been replaced by naming the surviving clause and demonstrating it red.

**AC-10. Every document describing the gate question moves with it, and the decision entry is cited by
title and date.**
`contracts/Q-0050/run-events.contract.md` gains a **superseded-by** note beside its
`GateQuestionEvent` block, in the shape that file already uses three times — the original clause is
not edited away. `docs/04-architecture.md`'s `packages/server` and `apps/web` sections gain one
sentence each. The gate screen's module header stops routing the evidence half to this ticket.
`docs/05-design-prompt.md` screen 6's divergence note is **not** rewritten: its figures are dated to
Q-0016's gate and a dated measurement is not drift.
*Test:* a guard asserts the contract's superseded note names this entry by **title and date** and not
by file name or number; that no file under `apps/web/src` or `packages/server/src` still routes the
verdict to Q-0129; and `packages/shared/src/docs.test.ts`'s existing clause at `:1905`
(`[…, /Q-0129/]`) is re-aimed rather than deleted, with its replacement shown red.

---

## §5 Non-goals

1. **The diff.** Split out — §7, and §0.11 for why.
2. **Widening the gate answer set.** `gateAnswerEnvelopeSchema` is `.strict()` over three and a fourth
   is a decision entry of its own. No reason field, no "override with reason" — corrected in three
   documents already by Q-0013, Q-0118 and Q-0017.
3. **Making `retry` primary, or offering it where the question carries no target.** Unchanged from
   Q-0016, and §0.1 re-confirms the zero it rests on.
4. **A route serving `.harness/`.** Refused with reasons (§0.7, §0.8); the refusal is recorded in the
   decision entry so a later ticket does not re-litigate it from scratch.
5. **Adding `findings` or `summary` to the run manifest**, or to `Occurrence`. Frozen contract (§0.9).
6. **Deduplicating findings across a panel's members**, or counting them by severity into a headline
   the way `05-design-prompt.md` screen 6 sketches (*"2 blockers, 5 majors deduplicated from 11
   findings"*). A count over a vocabulary 13.9% of findings do not carry is a number that is wrong
   without saying so.
7. **Holding a socket on the gate route**, or rendering the run's event stream. Q-0016 ruled it and
   the ruling is unchanged.
8. **Any change to `harness/flows/*.yaml`.** No flow gains a step, a verdict declaration or a
   `verdict_file`; `docs/02-sdlc-pipeline-spec.md` §5's byte-identical snippets therefore do not move.
9. **A cap, a page or a collapse on the findings list.** §0.2 measured the payload; there is nothing
   to manage.
10. **Q-0131's cost ticker.** It inherits this ticket's ruling and is not implemented here.

## §6 Open questions

**OQ-1 (BLOCKING) — does this owe a decision entry, and what is its subject?**
**Recommended: yes, and the subject is the rule rather than the field.** Two grounds. (a) It is a
product statement: a run's event stream has carried narration and one correlation token, and this
makes it carry a **machine-readable value a human acts on** — the first. (b) The sequencing note in
this ticket's own body says Q-0129 and Q-0131 *"both need one ruling — how a structured value the
engine already holds reaches a browser"*, and **a ruling that binds a second ticket and is not
written down is what this repository keeps paying for**. The entry should also record the four
refused routes (§3) so Q-0131 does not re-derive them, and should state that Q-0127 E-1's reader-side
exclusion is **left standing**, which is the clause a later ticket will look for.
Proposed title: *"A gate question carries the decision that reached it"*. It does not reverse 049 —
that entry says additions wait for a producer and *"adding them once a producer exists costs a type
error at build time"*, and the producer is `steps.ts:340`. **It is work `developer-generalist` may not
do, so it must land at the gate before the chore run**; Q-0062 spent three implement rounds on
exactly this and the requirement had named the hazard in advance.
The alternative — no entry, ratified in the schema's own authority comment on Q-0108's precedent — is
available and is **not recommended**: Q-0108's rule is for a reading rule that changes no behaviour,
and this adds a field to the wire.

**OQ-2 — does `docs/GLOSSARY.md` gain a term?**
Recommended: **no.** *Verdict* is used throughout the product and appears in no glossary entry today,
so coining one here would be a second act inside a ticket that is not about vocabulary; and the
**Event** entry already governs what the union carries and gains one clause under AC-10 rather than a
new headword. Recorded so it is not re-litigated at a review round. If the gate disagrees, the term is
*verdict* and the entry is the human's.

**OQ-3 — the field name.** Stated as `reached` in §3 with three collisions measured. One line to
overrule.

**OQ-4 — should the two exhaustive switches render it?**
`packages/cli/src/trace.ts:71` and `apps/web/src/mission-control-trace.tsx:31` both switch
exhaustively over the union, and `mission-control-trace` returns `event.reason` for a gate. Adding a
field to an existing member breaks **neither** — they still compile. Recommended: **leave both
untouched**, and say so in the change rather than silently. The CLI already prints the verdict on its
own `done` line, and mission control's one-field-per-kind rule is Q-0015's ruling, not this ticket's
to widen. Not blocking.

**OQ-5 — what does the screen call the step?**
Recommended: the interpolated id verbatim, as the trace column does. A fan-out child reads
`dev:backend-wire-schema`, which is the id in `runs.log` and in the manifest, so the three agree. Not
blocking.

## §7 The successor's body, transcribed in full — **Q-013x: the gate screen shows the diff**

*Written out here rather than referenced, because three obligations found orphaned in one week had
lived only inside a closed ticket's prose, and this ticket's own body opens by saying so.*

---

**Recommended: open at this gate, p3.** The half Q-0129 does not build, split on **disjoint blockers**
rather than on size — the same seam Q-0013, Q-0091, Q-0096 and Q-0016 were each cut on, at a gate and
at cost.

**What makes the blockers disjoint.** Q-0129 needs one field in `packages/shared`, one assignment in
`packages/core`, no transport change, no new route and no dependency. This needs: a **new `core`
function** (`packages/core/src/git/git.ts` exports twelve functions and none diffs; `materialiseDiff`
is `engine/diff.ts`'s and takes a run's `DiffContext`, so a route cannot call it); a **new route**;
and possibly **this workspace's first diff dependency** — `diff2html`, `diff` and `jsdiff` appear in
no manifest, `apps/web` has no runtime dependency at all, and Q-0014 measured that the cold-store
install already doubles, so a renderer needs a one-line justification and an entry if it changes
architecture.

**The measurement that decides the sequencing: there is nothing to show.** All **40**
`harness/*/integration` branches in this repository are contained in `main`, so `{base}...integration`
is **0 bytes** for every one of them; `integration...implement` is 0 bytes too. **Every diff range in
every shipped flow is empty for every ticket in this backlog.** The half is non-empty only for a run
in flight. So its acceptance evidence must be a repository the test builds — `git.test.ts`'s shape —
and no demonstration at a gate can use a real ticket. That is Q-0077's subject arriving as a
sequencing fact.

**The range is flow-dependent and the gate is not the step that had one.** `review.yaml` diffs
`{base}...harness/{id}/integration`; `chore.yaml` diffs
`harness/{id}/integration...harness/{id}/implement`; `chore`'s gate follows `integrate`, three steps
after the review that read a diff. Nothing on the wire says which range this run's reviewer saw. The
ticket's first decision is whether the range travels **on the question** — the shape Q-0129 will have
established, and the only one that is identity rather than inference — or is re-derived from the flow
file, which cannot tell which of a flow's several `input.diff` sites the gate follows.

**Q-0128 is the neighbour and the collision is real.** A diff served to a browser has the same
truncation question a diff handed to a reviewer has, and answering it twice in two places is how the
two drift. `repo.max_diff_bytes` defaults to 200,000 and `materialiseDiff` truncates **head-only**, so
what is lost is every patch for the alphabetical tail, entirely. Q-0124 made that loss **speak** — a
`warn` naming the files with no patch at all — and the `diff truncated range=` token is **load-bearing**:
`diff.test.ts`'s AC-9.5 counts materialisations off it. Whatever this ticket does about a cap must
either reuse that machinery or say in one line why it does not.

**What it must not do.** It may not widen the gate answer set. It may not serve a patch from a range
the guard at `diff.ts:330` would refuse — both endpoints must be the configured base or one of this
ticket's own branches, and the static twin of that rule is in `lint/lint.ts`. It may not show a
fabricated or partial diff without saying so, which is `docs/04-architecture.md`'s placeholder rule
(cited by its words — *"No placeholder is a blank panel, a spinner or a skeleton"* — and never by a
line number, which has now moved three times).

**Start by re-measuring**, and re-measure the containment figure first: it is the one that decides
whether this ticket can be demonstrated at all, and it moves every time a branch lands.

---

## §8 Risks

**R-1 — the decision entry is a precondition no step on the chore route can satisfy.** This is the
sixteenth-plus appearance of a loop handed work no agent in it can perform, and the first two
occasions the hazard was named in advance (Q-0062 GO-1, Q-0122 E-1) it was named correctly and
ignored once. Mitigation: OQ-1 is BLOCKING, and the gate must verify the landed entry appears in the
implement step's actual `prompt.txt` by grepping it — the check Q-0097 lost two errata by not making
and Q-0125 GO-1 made.

**R-2 — the field is added and something projects it away.** AC-6 exists for this: `wireRunOf`'s
pass-through is the whole reason the transport needs no edit, and it is one refactor away from being
a four-member copy. The criterion is deliberately a deep-equality over a real port rather than a read
of the source.

**R-3 — a review round asks for a severity headline.** `05-design-prompt.md` screen 6 sketches *"2
blockers, 5 majors deduplicated from 11 findings"*, and it is a non-goal here on a measurement
(13.9%). Named in advance so a round does not spend itself arguing it, and §5.6 is the clause to cite.

**R-4 — the diff half is folded back in at the gate.** Q-0122's gate refused its own document's
recommended split and paid three implement rounds for twenty criteria. If this one is refused too, the
remedy named in advance is a **second erratum splitting it at the next gate, not a fourth implement
round**, and AC-1 to AC-10 are the half that must survive intact.

**R-5 — the review diff is truncated.** Q-0016's own rounds 2 and 3 were handed 91.6% and 87.3%, and
the cut hid `wire.ts` — AC-1's subject, one directory over from this ticket's. This change touches
`packages/shared/src/events.ts`, `wire.ts`'s neighbour in path order. Q-0124's warn and Q-0117's
`observation:` channel have composed on the last three tickets and are the mitigation; a hand pass
over any named file is owed at the gate if they do not.

**R-6 — a widened union member is a `packages/shared` change, so every package's test hash moves.**
Expected and cheap; recorded so a round does not read it as a defect.

## §9 Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, no vendor CLI, no credential on any path. The gate screen sends one word and this adds one read. |
| **Worktree safety** | n/a. Nothing here writes to the working tree or to a worktree. `core`'s new assignment is in-memory and run-scoped; no file is created. |
| **Gate behaviour** | The answer set is unchanged at three, `human-locked` still cannot be automated, and the `retry` control's condition is untouched. Under `--dry` no gate question is emitted at all (`askGate` returns before `context.emit(request)`, `routing.ts:18`) and `runAgentStep` returns before any verdict (`steps.ts:259`), so the field has no dry behaviour to specify. |
| **File format and schema** | `gateQuestionEventSchema` gains one optional field; `.strict()` preserved on both levels. `wireRunSchema` re-uses it and is not re-declared. No ticket-file, manifest or flow-file format changes. `run-manifest-v1` untouched. |
| **Lint rules** | None. `lintFlow` gains no rule: no flow file changes. |
| **Cold-clone impact** | None measurable. No dependency, no new command, no new install step. The first 30 minutes are unchanged. |
| **Product-agnostic** | No product name reaches any of it. |
| **Files are the database** | The value already **is** a file (`.harness/…-verdict-iter-N.json`) and stays one; this adds a second reader of the same fact in memory, not a second store. Nothing is persisted that was not already. |
| **Errors are explicit** | A gate with no verdict behind it renders a named sentence (AC-9), never a default and never silence. |

## §10 What the gate owes before a line is written

- **GO-1 (blocking).** Rule OQ-1 and, if an entry is owed, **land it before the chore run** and verify
  by grep that it reaches the implement step's prompt. Cite it by title and date.
- **GO-2.** Rule OQ-3, the field name, in one line — or ratify `reached`.
- **GO-3.** Rule the split. If it is refused, write down what that costs rather than presenting
  fifteen-plus criteria as fine, and name the erratum that would split it as the remedy on exhaustion
  (Q-0122 E-1's shape).
- **GO-4.** Open the successor at this gate with §7 transcribed in full, and record its id here. An
  obligation left in a closed ticket's prose is the failure this ticket's own body opens by naming.
- **GO-5.** Verify the merge **forced in both environment rows** — a worktree with neither
  `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge — and record `quorum lint` and
  the git-identity sweep.
- **GO-6.** Discharge by **running the product**, and record what was done rather than that it was
  done: park a real run at a real gate, open the gate screen in a browser, and transcribe what it
  rendered — including the step id and at least one finding — into `runs.log`. Q-0016's GO-6 asked for
  this and was reported discharged when the by-hand half had not been performed; Q-0130's GO-4 was
  written to be unfakeable for that reason, and this one is written the same way.
