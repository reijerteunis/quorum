# Q-0129 — The gate screen shows the verdict that reached it, and the diff

*Requirement, run 1, candidate-claude. Written 2026-09-17 against tip `df98dd7` (Q-0130 merged),
`docs/decisions/` ending at **096**, highest allocated id **Q-0133**.*

---

## §0 What was re-measured, and what moved

The ticket body forbids re-deriving any figure from it. Every number below was taken from the tree
today, with the command beside it, and **three of the body's are now stale or incomplete**.

### 0.1 The verdict artifact — the body's figure has moved, as it predicted

`find backlog -name '*verdict*.json' | wc -l` → **306**, across **73** ticket folders
(`… | sed -E 's|^backlog/([^/]+)/.*|\1|' | sort -u | wc -l`). The body said *274 across 71* on
2026-09-16. Q-0015's and Q-0130's runs are the difference. **The paragraph demonstrating itself, for
the second time**, which is the only reason it is worth writing down again.

Every one of the 306 is under a first segment of `.harness`. They split by path shape:

| shape | count | example |
| --- | --- | --- |
| scoped (`-verdict-iter-`), post-Q-0089 | **230** | `.harness/run-2/review-verdict-iter-3.json` |
| flat, pre-Q-0089 | **76** | `.harness/review-verdict.json` |

**Size, which decides whether a cap is owed** (`stat -f '%z'` over all 306):

| min | median | p99 | max | total |
| --- | --- | --- | --- | --- |
| 160 B | **2,205 B** | 10,295 B | **13,061 B** | 947,608 B |

The largest is `backlog/Q-0126-…/.harness/run-1/head-of-product-verdict-iter-2.json`. Findings per
artifact: **0** in 64 of them, median 3, **max 23**. Against Q-0127's measured 3.1 MB folder and
1.46 MB single file, this is three orders of magnitude smaller — which is what §4 AC-1 rests on and
why **no cap is specified anywhere in this document**. Q-0127 satisfied Q-0124's *a cap must be named
where a reader sees it* by having none rather than by disclosing one; the same answer is available
here and for the same measured reason.

### 0.2 The gate census, decomposed as the body's method requires

```
grep -h 'gate=' backlog/*/runs.log | wc -l                                 → 275
grep -hoE 'gate=[a-z-]+ answer=[a-z]+' backlog/*/runs.log | wc -l           → 235
grep -hc 'gate=retry counter' backlog/*/runs.log                            →  39
```

275 = **235** engine-recorded answers + **39** retry-grant lines + **1** hand-written erratum note
(`Q-0107`, `gate=erratum answer=E-1`). The decomposition the body states is exact; the totals have
moved by Q-0015's and Q-0130's runs.

The 235 split by `kind`, which is what matters here and which the body does not give:

| `kind` | what it is | advance | retry | abort | total |
| --- | --- | --- | --- | --- | --- |
| `human` | **author-declared** — a `- gate:` step in a flow file | 154 | **0** | 3 | **157** |
| `human-locked` | **engine-presented** — `handleFail`'s, `routing.ts:139` | 31 | 39 | 8 | **78** |

**`retry` has still never been chosen at an author-declared gate**, which is Q-0016's load-bearing
measurement holding at a larger n. **157 of 235 — 67% — are author-declared**, against the body's
*147 of 219*.

### 0.3 Two stale copies of this census are in files this ticket opens

`apps/web/src/gate-screen.tsx:29` and `docs/05-design-prompt.md:47` both state **148 of 220** and the
second states the bare `grep -c` as **255**. All three are now false (157, 235, 275). Both are
written present-tense — *"measured over this repository's own history"*, *"counts 220"* — rather than
dated. This is the shape *"a measurement copied from a document is not a measurement"* (Q-0099)
takes when the copy is a **source comment**, and §4 AC-11 is the cheapest instrument for it.

### 0.4 The finding that reshapes the ticket: **the gate question names no step**

`gateQuestionEventSchema` (`packages/shared/src/events.ts:179`) is `.strict()` over exactly six keys:

```
{ type: 'gate', gateId, kind, reason, ticketDir, retry? }
```

**There is no step id.** Measured at both gate sites:

- **Engine-presented** (`routing.ts:137–145`): `reason` is composed prose —
  `` `loop exhausted at ${step.id} (${counter} = ${count}, limit ${limit}); choose: …` `` — so the
  step id is **inside a sentence**, and `retry: target` is the **goto target**, which is not the
  failing step. In `chore.yaml`, `review` fails and `on_fail.goto` is `implement`: the question says
  `retry: implement` while the decision that reached the gate is `review`'s.
- **Author-declared** (`routing.ts:82–88`): `reason` is the flow file's own `reason:` string —
  *"Chore owner approves the reviewed change now on the ticket branch, with the suite green"* — which
  names no step at all.

**This makes all three of the body's alternatives fail one step earlier than it says.** The body
refutes (i) on the `warn` message being conditional and carrying no `stepId`, and (iii) on `runId`
being `null` for a parked run. Both refutations hold and were re-verified (`host.ts:296–306`:
`record.runId = event.runId` in the terminal branch alone, under a comment refusing to take a run
number out of a `gateId`). But even granted a perfect channel, **the screen would not know which
verdict to select**, because the question it is rendering carries no identity to select by. Identity
is the primitive that is missing, and the payload is downstream of it.

The gate screen's own JSDoc already refuses the remedy that would paper over this:
*"inferring either from a run's prose would be reading a sentence composed for a human as though it
were a contract"* (`gate-screen.tsx:33–36`). Parsing `reason` for a step id is that, exactly.

### 0.5 `.harness/` is already read by a flow, and `readFiles` never excludes it

`harness/flows/requirements.yaml:23` declares, as an ordinary `input.backlog` entry:

```yaml
input: { backlog: [ticket.md, "requirements/run-{run}/candidate-*.md", requirements/merged.md,
                   ".harness/run-{run}/head-of-product-verdict-iter-*.json"] }
```

**So the engine already feeds a `.harness/` verdict artifact back into a step, in a shipped flow, on
every requirements run.** Confirmed in the source: `isHiddenPath` (`backlog.ts:334`) occurs at
exactly **one** call site, `backlog.ts:375`, inside `listTicketFiles`. `Backlog.readFiles` does not
apply it, and `listTicketFiles`'s own docblock says so — *"what makes such a path unreadable is the
caller reading only what this named"*.

**This narrows what Q-0127's erratum E-1 governs, and the narrowing is the useful part.** E-1 ruled
that `GET /tickets/:id/file` re-derives membership per request so `.harness/` is *"unreadable as well
as unnamed"* — a ruling about **one HTTP route**, not about `core`. Reading the artifact is settled
and precedented; **serving it over HTTP is the open question**, and it is open for exactly one route
shape rather than for the whole idea.

### 0.6 One third of the triple is already on a shipped route

`Occurrence` (`packages/core/src/run-history/manifest.ts:95–126`) carries **`verdict: string | null`**
and **no `findings` and no `summary`**. `GET /history/:id` (`read.ts:390–405`) answers
`manifest: read.manifest` — the manifest **whole**. So for a **completed** run the verdict *word* is
already served today, and what has never been reachable by any route is `findings` and `summary`.

That is worth stating plainly because it redirects the ticket: the verdict word is not the hard part.

### 0.7 `wireRunOf` passes the question through whole — so `packages/server` needs no change

`packages/server/src/wire.ts` declares `gates: z.array(gateQuestionEventSchema)` with a comment
saying why — *"the question a browser echoes back has to be the question `askGate` emitted, and two
declarations of one shape are free to drift"* — and `wireRunOf` is `gates: view.gates`, passed
through unmapped. `host.ts:264` is `gates: gates.pending(record.handle)`.

**A field added to `gateQuestionEventSchema` therefore reaches `GET /runs/:id` with zero lines changed
in `packages/server`, and reaches the gate screen through the one request it already makes.** This is
the single largest cost saving available to this ticket and it was bought by Q-0121's GO-3 ruling.

### 0.8 `verdict_file` is author-overridable, which forecloses a whole family of designs

`steps.ts:339`:

```ts
const verdictPath = interpolate(String(declared.verdict_file ??
  `${TICKET_ARTIFACT_DIR}/run-{run}/${stepId}-verdict-iter-{iter}.json`), vars);
```

`verdict_file` is a declared `output:` key (`packages/shared/src/step-output.ts:54`). **A route that
composed the default path to find an artifact would answer nothing for any flow that overrode it**,
and would be a second authority for a path `steps.ts` already owns. Combined with §0.1's 76 flat
pre-Q-0089 artifacts, there are already two live path shapes and a third is author-supplied.

### 0.9 `handleFail` has three call sites and only one carries a verdict

| site | what failed | verdict in hand? |
| --- | --- | --- |
| `steps.ts:365` | an agent step whose declared verdict was not the pass value | **yes** |
| `steps.ts:403` | a script step's non-zero exit | no |
| `composite.ts:411` | an integrate step | no |

`development.yaml` and `qa-red.yaml` both reach their bound through an **integrate** step, so the
no-verdict case at an engine-presented gate is ordinary rather than theoretical.

### 0.10 The diff half, measured

- **No diff dependency exists anywhere in this workspace.** `grep -rn "diff2html|\"diff\"|jsdiff|
  parse-diff" --include=package.json` over the repository returns **nothing**. It would be the first.
- **`packages/core/src/git/git.ts` exports no diff function** — 17 exports, of which the closest are
  `mergeBase`, `ancestry`, `shortSha` and `emptyRangeEvidence`. None produces a patch.
- `materialiseDiff` is `packages/core/src/engine/diff.ts:317` and is prompt-building: it takes a
  `DiffStep` and a `DiffContext` needing `config`, `ticket`, `runId`, `persistence`, `emit` and
  `diffInputs`, appends to `runs.log`, emits a `warn`, and truncates at
  `context.config.repo?.max_diff_bytes ?? 200000` (`diff.ts:372`).
- **The wire carries neither the range nor the base.** `WireRun` is nine fields and none is either;
  `WireTicketList.baseBranch` exists but is on the *backlog listing's* envelope, not on a run.
- Ranges are the flow's: `review.yaml` diffs `{base}...harness/{id}/integration`, `chore.yaml`'s
  `review` diffs `harness/{id}/integration...harness/{id}/implement`.
- **Q-0128 is open, `draft`, p2, unstarted**, and owns whether a truncated diff may yield `approve`.
- The daemon registers **14** routes, which the body states exactly: 5 in `http.ts`, 7 in `read.ts`,
  the WebSocket in `serve.ts:150`, and `static.ts:264`'s `GET /*`.

### 0.11 The severity vocabulary already exists and must not be written twice

`packages/shared/src/constants.ts` holds `FINDING_SEVERITIES = ['blocker', 'major', 'nit']` (`:200`),
`OBSERVATION_TAG = 'observation'` (`:217`) and `FINDING_PATTERN` (`:229`). The design brief's
*"2 blockers, 5 majors"* grouping needs no new vocabulary — a second one written in `apps/web` would
be the drift Q-0120 was opened on.

---

## §1 Problem

A `maintainer` answers a gate with one of three words, and the screen that takes the word does not
show them what they are deciding about. Q-0016 shipped the question, the answers and the four states
a run can be in other than waiting; its own docblock records the gap in as many words — *"It renders
the question and nothing about what the step decided"* — and `04-architecture.md:332` and
`05-design-prompt.md:47` both name this ticket as the half that closes it.

What is missing is what a reviewer or a judge concluded: the verdict word, the findings it listed,
and the summary it wrote — `{verdict, findings, summary}`, which `steps.ts:340` writes to disk and
which **no route serves and no structured field on the wire carries**. Today a maintainer at a gate
either opens the ticket folder in an editor, or answers on the strength of one prose sentence the
engine composed for a terminal.

Beneath that sits the structural defect §0.4 measures: **the gate question does not name the step
whose decision reached it.** That is not a missing payload, it is a missing identity, and it is why
the three alternatives the ticket body weighs each fail before the question of *where the bytes come
from* is even reached.

And a `maintainer` cannot see what changed. The brief's screen 6 promises a side-by-side diff
summary; the wire carries neither the range nor the base, no route serves a patch, and this workspace
has never had a diff renderer.

---

## §2 User stories

**`maintainer`, at a gate — the ticket's subject.** *As a solo maintainer whose review panel has just
returned, I want the gate screen to show me the verdict word, every finding as the reviewer wrote it,
and which step and iteration produced them, so that I can answer `advance`, `retry` or `abort` from
what the step actually decided rather than from a sentence composed for a terminal or from a second
window with the ticket folder open in it.* Surface: **local daemon + web UI** (`apps/web`,
`packages/server`), with the carrier in **`packages/shared`** and **`packages/core`**.

**`maintainer`, at a gate with nothing behind it.** *As the same maintainer at a gate that follows an
integrate step, I want the screen to tell me in a sentence that this gate carries no step decision,
rather than showing me an empty card or a zero-finding list, so that I can tell "nothing decided" from
"the screen could not find it".* Surface: **web UI**. This is the majority case — §0.2's 157 of 235 —
and `04-architecture.md:336` already forbids the alternative.

**`adopter`, on the cold-clone path.** *As a stranger whose first flow has just parked at a gate, I
want the screen to be self-sufficient about what is being asked, so that my first gate answer does not
require me to know the layout of a ticket folder.* Surface: **web UI**. This is the first gate of the
30-minute path, and quality pillar 7 is why it is a user story rather than a nicety.

**`contributor`, reading the contract.** *As someone writing an adapter or a flow template, I want the
gate question's payload to be one declared shape in `packages/shared` that the wire re-uses rather than
re-declares, so that what a browser renders and what `askGate` emitted cannot drift.* Surface:
**`packages/shared`**. §0.7 is what makes this free.

---

## §3 Recommended shape, and why the alternatives were refused

**The gate question carries the decision that reached it, inline and structurally. Nothing serves
`.harness/`, and nothing composes a verdict path a second time.**

Four measurements pick it:

1. **§0.4 — identity is the missing primitive**, and the engine is the only party that has it. At
   `steps.ts:365` the failing step's id, its `AgentOutput` and `context.vars.iter` are all in hand
   one line after the `warn` is emitted, and `handleFail` is called on the next line.
2. **§0.8 — `verdict_file` is author-overridable.** A route keyed on a composed path is wrong for any
   flow that overrode it, and would be a second authority for a path `steps.ts` owns. Carrying the
   value rather than the path removes that class outright.
3. **§0.1 — the payload is tiny.** Max 13,061 B, median 2,205 B. Carrying it inline costs a gate
   question roughly two kilobytes, against the 316 K bundle the same browser already loaded.
4. **§0.7 — `packages/server` changes by nothing**, and `apps/web` makes no new request.

What this buys, stated as what it does **not** need: no new route, no `.harness/` serving ruling, no
second path-composer, no `runId` correlation, no prose parsing, and no change to
`gateAnswerEnvelopeSchema`. **Q-0127's erratum E-1 is left exactly where it stands.**

**Refused, with the measurement for each:**

- *(i) verbatim prose from the stream* — refused on the body's own grounds, re-verified
  (`steps.ts:364`: the em-dash and the list are both conditional; `warnEventSchema` is `.strict()`
  over `{type, message}` with no `stepId`), **and** on §0.4: there is nothing to attribute it to.
- *(iii) read it from run history* — struck at Q-0016's gate, re-verified at `host.ts:296–306`, and
  §0.6 adds that it would answer only one third of the triple even where reachable.
- *A route over the artifact* — refused on §0.8, not on principle. Recorded rather than dismissed:
  Q-0018 (run history drill-down) is where a surface over `.harness/` would be argued properly, and
  that argument is not made cheaper by being made here in passing.
- *Composing the range and diffing from the ticket id* — refused on the same ground as the second
  path-composer: ranges are the flow's, and a browser inventing one is a second authority.

---

## §4 Acceptance criteria

Numbered continuously across both halves, so a criterion keeps its name if the gate cuts at OQ-1's
seam. Each *Test:* clause **bounds the instrument**: a reviewer may find the instrument fails the job
the clause gives it, and may not raise the job (*Q-0067 erratum E-1*).

### Half (a) — the decision that reached the gate

**AC-1. `gateQuestionEventSchema` gains exactly one optional field, and the wire re-uses it.**
The field is `decision`, absent where no step decision reached this gate, and shaped
`{ stepId: string, iteration: number, verdict: string, findings: string[], summary: string | null }`.
The schema stays `.strict()` at both levels. **`findings` is `z.array(z.string())` and does not
re-enforce `FINDING_PATTERN`** — a wire schema stricter than what the product can emit turns a run
this product accepts into a screen that does not render, which is `WireTicket`'s own stated rule
(`wire.ts`, *"No field here is stricter than `ticketSchema`"*).
*Test:* unit tests in `packages/shared` — a question with no `decision` parses; one with a
well-formed `decision` parses; an unknown key inside `decision` is refused; a `findings` entry that
does not match `FINDING_PATTERN` **parses**. Plus an assertion that `gateQuestionEventSchema` is
named exactly once as the `gates` element in `packages/server/src/wire.ts` and that no file under
`packages/server/src` re-declares any of the question's keys — shown red by re-declaring them.

**AC-2. Nothing composes a second verdict path, and nothing reads the artifact back.**
The field is populated from the `AgentOutput` already in hand at `steps.ts`'s verdict branch. The
default path template and `verdict_file` are read at exactly one site in the workspace.
*Test:* a source guard in `packages/core` asserting that the literal `verdict_file` and the
`-verdict-iter-` template each occur at exactly one production site (`steps.ts`), and that no file
under `packages/core/src/engine/`, `packages/server/src/` or `apps/web/src/` names `TICKET_ARTIFACT_DIR`
or reads a path whose first segment is `.harness`. Shown red by adding a second composer.
*Why this criterion exists:* §0.8 — `verdict_file` is author-overridable, so a second composer is
wrong for every flow that overrode it and right for none.

**AC-3. At an engine-presented gate the field names the step that failed its verdict, with the
iteration that produced it.**
Not the `retry` target, which is the goto destination and a different step (§0.4).
*Test:* a mock-adapter run over a fixture flow whose verdict step carries `on_fail:
{ goto: <other-step>, max_iterations: 0 }`; assert the emitted gate question's `decision.stepId` is
the **failing** step, `decision.verdict` is the value the step declared, `decision.findings` is
every finding by value, and `question.retry` is the **other** step — so the test discriminates the
two rather than passing on either.

**AC-4. At an author-declared gate the field names the last step in this run that declared a
verdict, or is absent where none did.**
Absent rather than `null` or an empty object, so *"nothing declared one"* has exactly one spelling.
*Test:* three mock-adapter runs — (a) a flow whose gate directly follows a verdict step that passed
(`requirements`-shaped): the field names that step and carries its verdict; (b) a flow with an
integrate step between the verdict step and the gate (`chore`-shaped): the field still names the
verdict step, and the test asserts the intervening step is **not** named; (c) a flow with no verdict
anywhere (`development`-shaped): `'decision' in question` is `false`.

**AC-5. The two `handleFail` sites that carry no verdict present a gate with no `decision`.**
A script's non-zero exit (`steps.ts:403`) and an integrate failure (`composite.ts:411`) reach an
engine-presented gate with nothing declared, and that gate says so.
*Test:* two runs, one per site; assert `'decision' in question` is `false` for each. Named separately
because they are two call sites and a fix at one is not a fix at the other.
*Why:* §0.9 — `development.yaml` and `qa-red.yaml` both reach their bound through an integrate step,
so this is the ordinary shape and not an edge.

**AC-6. The gate screen renders the decision where the question carries one.**
The step id, the iteration, the verdict word, the summary, and every finding as written.
*Test:* render `GateScreen` against a driven fetcher answering a parked run whose question carries a
`decision` with findings at three severities and one observation; assert each value is present and
reachable by a `data-` anchor rather than by prose match, and that **every** string in `findings`
appears — a count assertion as well as a membership one, so a render that drops the tail fails.

**AC-7. It renders a named sentence and never an empty region where the question carries none.**
No verdict card, no zero-length findings list, no em-dash standing in for a value.
*Test:* render with `decision` absent; assert one sentence drawn from a `Record` **total** over the
closed set of decision subjects, and assert the verdict region's `data-` anchor is **absent** rather
than present-and-empty. Totality proven by the `Record` failing to compile when a member is added to
the union and not to the record — the arrangement `GATE_SUBJECT_TEXT` already uses.
*Why:* `04-architecture.md:336` — *"No placeholder is a blank panel, a spinner or a skeleton, and none
shows a fabricated project, run, ticket or cost."*

**AC-8. Findings are grouped by `@quorum/shared`'s existing severity register and by no vocabulary
written in `apps/web`.**
`FINDING_SEVERITIES` and `OBSERVATION_TAG` are imported. An observation is rendered apart from the
findings and is **not counted** as one, per *"A finding is a claim about the change; anything else is
an observation"* (2026-09-11).
*Test:* a source assertion that no file under `apps/web/src` carries the literals `'blocker'`,
`'major'`, `'nit'` or `'observation'`; plus a render whose `decision.findings` is one blocker, two
majors and one observation, asserting the rendered counts are 1, 2 and 0-observations-among-findings.
Shown red by inlining one literal.

**AC-9. A finding the pattern does not match is rendered whole and uncategorised, never dropped and
never coerced into a severity.**
*Test:* a render with one finding string carrying no recognised prefix; assert it appears verbatim in
the output and is counted in a named uncategorised group, and that the three severity groups are
unchanged. Shown red by a renderer that filters on prefix.
*Why:* §0.1 — 76 of 306 artifacts predate Q-0089, `verdict_file` is author-supplied, and AC-1
deliberately does not re-enforce the pattern on the wire. A renderer that silently drops what it
cannot classify is a check reporting success over a subject it did not examine.

**AC-10. The documents that describe the gate question move with it, and one of them is held by a
check that can go red.**
`docs/GLOSSARY.md`'s **Event** entry enumerates what the gate question carries; `docs/04-architecture.md`'s
`apps/web` paragraph states that the screen renders *"nothing about what the step before the gate
decided"*; `docs/05-design-prompt.md` screen 6's divergence paragraph states *"No verdict card, no
blocker list"*. All three move.
*Test:* `packages/shared/src/docs.test.ts` gains a clause holding the glossary's **Event** enumeration
against `gateQuestionEventSchema`'s own key set, derived from the schema rather than transcribed —
shown red by adding a key to the schema alone. Plus an assertion that the two prose sentences above no
longer occur.
*Why:* the `apps/web` clause `docs.test.ts` already holds — *"a claim enforced by a scan that cannot
see it going false is one that goes quiet rather than red"*.

**AC-11. The two stale census figures in the files this ticket opens are dated, and the two agree.**
`apps/web/src/gate-screen.tsx`'s JSDoc and `docs/05-design-prompt.md` screen 6 both state `148 of 220`
(§0.3). Each re-derived figure is written with **the date it was measured** beside it and the command
that produces it.
*Test:* a clause in `docs.test.ts` asserting that the figure and the date appear in both sites and are
**identical between them** — the two-copies drift, which is checkable and stable, rather than the
figure itself, which moves on every run and whose verdict would then be a property of the backlog's
current contents. Shown red by changing one site alone.
*Why not pin the number:* a test re-deriving from `backlog/*/runs.log` goes red on the next gate
answered, which trains the reader to re-run until green — Q-0102's surviving p1 argument.

### Half (b) — the diff

**AC-12. The question's `decision` carries the interpolated diff range the failing step read, or
nothing where it read none.**
A string the engine has already interpolated, never one recomposed from `ticketId` and configuration.
*Test:* a mock-adapter run over a `chore`-shaped fixture whose review step declares
`diff: "harness/{id}/integration...harness/{id}/implement"`; assert `decision.range` is the
**interpolated** value. A second run over a step declaring no `diff:` asserts the key is absent.

**AC-13. `core` gains one function answering a patch for a range in a repository, separate from
`materialiseDiff` and reading no `max_diff_bytes`.**
`materialiseDiff` is prompt-building: it appends to `runs.log`, emits a `warn`, caches into
`diffInputs` and truncates at the agent's cap. None of that belongs to a browser read.
*Test:* a unit test over the new function against a repository it builds itself, asserting the patch
for a two-commit range by content; plus a source assertion that the new function's module names
neither `max_diff_bytes` nor `diffInputs` and appends to no log. Shown red by routing it through
`materialiseDiff`.

**AC-14. `GET /runs/:id/diff` answers it, derived per request and stored nowhere, with each failure
under its own code.**
A range that does not resolve, a handle the host never minted, and a run whose question carries no
range are three answers and not one — *"A probe that could not answer is not a negative"*
(2026-09-10).
*Test:* route tests over a real repository fixture: a resolving range answers the patch; an
unresolvable one answers a named code and never an empty patch; a handle nothing minted answers 404;
a parked gate with no range answers a named code. Plus the existing `package.test.ts` route-derivation
guard collecting the new route without amendment — registered with `app.get` and a quoted literal,
since that guard does not match `app.use` at all.

**AC-15. The browser's diff is capped by its own number, disclosed where a reader sees it, and never
by `repo.max_diff_bytes`.**
That key caps what an **agent** is handed and whether that cap is right is **Q-0128**'s open subject;
a browser is a different consumer with a human who can scroll. The two never share one number.
*Test:* a source assertion that `max_diff_bytes` is read at exactly one site in the workspace
(`diff.ts:372`) and at none under `packages/server/src` or `apps/web/src`; plus a render over a diff
past the browser's own limit asserting the omitted files are **named** — `git diff` orders by path, so
a head cut hides the same alphabetical tail every time, which is the defect Q-0124 fixed one layer up.

**AC-16. The screen renders the patch, and the dependency question is answered by measurement.**
Whether a renderer is taken as a dependency or written is decided by measuring both — the cold-store
install cost against what is rendered — and the measurement is recorded. A new dependency needs a
one-line justification, and an entry if it changes architecture.
*Test:* a render asserting file headers, hunk headers and added/removed lines are distinguishable by
`data-` anchor; plus, if a dependency is taken, a manifest assertion and the recorded cold-store
figure, on Q-0014's method (manifests-only copies of both commits into empty stores).

---

## §5 Non-goals

1. **Widening the gate answer set.** `gateAnswerSchema` is the closed three and
   `gateAnswerEnvelopeSchema` is `.strict()` over it. There is no fourth control and no reason field.
   Widening it is a decision entry of its own and not this ticket's.
2. **Making `retry` the primary action**, `05-design-prompt.md` screen 6 notwithstanding. At an
   author-declared gate `routing.ts:97` answers a `retry` with `{ abort: true }`, and §0.2 measures
   `retry` chosen **zero** times at 157 such gates. The screen offers it only where the question
   carries a target, which Q-0016 already implements and this ticket does not touch.
3. **Serving `.harness/` from any backlog route.** Q-0127's erratum E-1 stands untouched, and §3's
   shape is what makes that free rather than a concession.
4. **A run-history surface over verdict artifacts.** Reading a *past* run's decisions is **Q-0018**'s.
   §0.6 records that `GET /history/:id` already carries the verdict word per occurrence.
5. **Changing the truncation the review diff is subject to.** That is **Q-0128**, open and unstarted.
   AC-15 keeps the two numbers apart precisely so neither ticket decides the other's question.
6. **Holding a socket, or rendering the event stream.** The gate screen is deliberately not live and
   the route it is drawn at is excluded from `app.tsx`'s connection by name. Mission control is
   Q-0015's and streaming behind a screen that is not live is the same socket by another door.
7. **Starting or stopping a run from this screen.** Q-0130 shipped both, on the ticket page and on
   mission control. This ticket adds **no** non-GET method: half (a) adds none at all, and half (b)
   adds a `GET`.
8. **Repairing `TicketRecord` damage, stage vocabulary or `GET /tickets` shapes.** Q-0060 is open and
   this must not hide it.
9. Everything on the v1 exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace,
   visual node canvas, eval suites, Gemini adapter, desktop shell.

---

## §6 Open questions

**OQ-1 — BLOCKING. Does this ship as one ticket or two?**
Sixteen criteria against this role's ceiling of fifteen. **Recommend cutting at the AC-11/AC-12
seam**, on four measurements rather than on size: (a) needs no dependency and (b) needs this
workspace's **first** diff renderer (§0.10); (a) is one additive field on a shape the wire already
re-uses and (b) is a new route, a new `core` function and a second structural widening on a different
axis; (b) collides with **Q-0128**, which is open, unstarted, and owns the question AC-15 has to hold
a line against; and (b) has a **cold-clone cost** (a) does not — Q-0014 measured the last dependency
addition at ×2.04 install time and +50 MB, against quality pillar 7. The precedent runs the same way:
Q-0013 at eighteen and Q-0091 and Q-0096 at twenty-one were each refused or split at a gate and at
cost, and Q-0122 accepted twenty deliberately and spent the difference in review rounds.
**If the gate refuses the split**, an erratum should say so, name the seam, and name a second erratum
splitting it as the remedy if the loop exhausts on half (b) — Q-0122 erratum E-1's arrangement, which
worked.

**OQ-2 — BLOCKING. The decision entry, owed before a line of code.**
One is owed and its subject is narrow: **widening the gate question**, not widening the backlog
surface. Three things make it owed rather than arguable — `gateQuestionEventSchema`'s own docblock
states *"Payload verbatim from the one call site"*, which a new field contradicts; `docs/GLOSSARY.md`'s
**Event** entry enumerates the union and moves with it; and the governing entry is *"The event union
is derived from what the product emits, and `tool` and `text` are not invented"* (2026-08-25), which
this **satisfies** — `steps.ts:340` already writes the triple and `:364` already warns it, so the field
is derivation and not invention — but satisfying an entry by argument is what an entry is for.
It should also say what the union does **not** gain: no timestamp, no sequence number, and no run
identity on any event but the terminal one, all three of which the glossary states and none of which
this touches.
**No step on the chore route may write one** (`harness/roles/developer-generalist.md`), so it lands at
the gate. Q-0062 lost three implement rounds to launching without one after its own requirement said
it must exist first; Q-0125's E-1 is the counter-example, and the check is to grep the implement step's
actual `prompt.txt` for the entry's title rather than assume it arrived.

**OQ-3. At an author-declared gate, carry the last verdict declared in the run, or carry nothing?**
Recommend **carry it, and name it** — AC-4's shape. Measured across shipped flows, 5 of 6
author-declared gates follow a verdict-declaring step, three of them immediately (`requirements`,
`review`, `qa-red`) and two with an integrate or a `tasks` step between (`chore`, `solutioning`);
`development` has none and the field is absent there. Carrying it unnamed would be a verdict card
with no subject; carrying `stepId` and `iteration` beside it makes *"the last step to decide anything
was `review`, at iteration 2"* a true sentence the reader can weigh. The alternative — absent at every
author-declared gate — is defensible and **loses the case the ticket's own title names**, since
*the verdict that reached it* is most often exactly this.

**OQ-4. Inline on the question, or a reference the screen resolves?**
Recommend **inline**, on §0.1's sizes (max 13,061 B, median 2,205 B) and §0.8's override. A reference
needs a resolver, a resolver needs a path, and the path is author-supplied. Recorded so a reviewer
meeting the larger payload does not re-litigate it from taste.

**OQ-5. Does half (b)'s route share `repo.max_diff_bytes`?**
Recommend **no**, per AC-15. Raised as a question rather than settled silently because it is the
seam Q-0128 will meet, and *"answering it twice in two places is how the two drift"* is the ticket
body's own sentence.

**OQ-6. `kind` is the literal `'human-locked'` at every engine-presented gate.**
`routing.ts:139` sets `kind: 'human-locked'` for the exhaustion gate, and `askGate` reads that literal
to make it un-bypassable by `--auto`. `docs/GLOSSARY.md` defines **human-locked gate** as *"a gate that
cannot be flipped to `auto` (deploy)"*. The shipped screen renders `kind` verbatim
(`gate-screen.tsx:239`), so **a maintainer at an exhaustion gate is shown the word the glossary
defines as the deploy gate** — 78 of 235 answers, §0.2. Reported and **not proposed as a fix here**:
the mechanism is deliberate and correct, and repairing the vocabulary is either a glossary amendment
or an engine change, both with their own subject. Recorded as an **observation** rather than a finding,
per *"A finding is a claim about the change; anything else is an observation"* (2026-09-11), and left
live rather than buried.

---

## §7 Risks

**R-1. The decision entry is the schedule risk, not the code.** Half (a) is one field, one carry-forward
on the run context, two gate sites and a renderer. The entry gates all of it and no step on the chore
route may write it. *Mitigation:* land it at the requirements gate, before the implement step reads
anything, and verify it by grepping the step's own `prompt.txt` (Q-0125 GO-1).

**R-2. The review diff.** This change spans `packages/shared`, `packages/core`, `apps/web` and three
documents, which is the shape that has crossed `max_diff_bytes` on four of the last six tickets.
`git diff` orders by path, so the tail at risk is `packages/shared/*` — **AC-1's own subject**, which
is precisely what happened to Q-0016, where `wire.ts` and `wire.test.ts` fell behind the cut on rounds
2 and 3. Since Q-0124 the engine emits a `warn` naming the files with no patch, and since Q-0117 a
reviewer has an `observation:` channel to say it compensated. *Mitigation:* expect it, read the warn,
and if the named files include `packages/shared/src/events.ts` do the pass by hand cross-vendor rather
than accepting a verdict over a diff that did not contain the field.

**R-3. `findings` is agent-written text rendered in a browser.** It is not HTML-escaped by anything in
`core`, and React escapes by default — so the risk is a later renderer that does not. AC-9's
uncategorised group is the honest path and `dangerouslySetInnerHTML` is not on it. Worth a criterion
if the gate wants one; not written as one because the framework already gives it.

**R-4. The screen grows a region that is empty two-thirds of the time.** §0.2 measures 157 of 235
gates as author-declared, and OQ-3's recommendation is what keeps that region populated at five of the
six shipped flows' gates. If OQ-3 is ruled the other way, AC-7's sentence is what a maintainer sees at
most gates, and it must read as an answer rather than as an apology.

**R-5. Half (b)'s dependency is a cold-clone cost on the path M6 turns on.** §0.10 and Q-0014's
measured ×2.04. This is OQ-1's fourth argument and is the one a `maintainer` will not feel and an
`adopter` will.

**R-6. This ticket's own figures rot.** §0.1's count moved between the body being written and this
document; §0.3 records two source sites already stale. AC-11's instrument is a date and a
cross-site equality rather than the number, which is the only shape that does not train the reader to
re-run until green.

---

## §8 Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a to the change, and load-bearing as a constraint: no code path here reads an environment value of any kind, and the word for what an adapter runs on is **subscription**. A verdict artifact is agent output and carries no credential, but AC-6 renders agent-written text verbatim — so nothing in this ticket may add an example, fixture or test carrying an API-key-shaped string. |
| **Worktree safety** | n/a. Half (a) writes nothing. Half (b) reads git and writes nothing. No flow, no worktree, no branch. The daemon's own working tree is the operator's project and stays untouched. |
| **Gate behaviour** | The answer set is unchanged and closed at three. `gateAnswerEnvelopeSchema` is untouched. `retry` stays offered only where the question carries a target. Human-gated by default is unaffected — this changes what a human is shown, never whether they are asked. `--auto` still bypasses author-declared gates and still cannot bypass the engine-presented one. |
| **File format and schema** | `gateQuestionEventSchema` gains one optional field and stays `.strict()`; `docs/GLOSSARY.md`'s **Event** entry moves with it under AC-10, held by a check derived from the schema. `packages/server/src/wire.ts` re-uses the schema and re-declares nothing (§0.7). The disk format of the verdict artifact is **unchanged** — nothing reads it, writes it differently, or moves it. `ticketSchema` and every `Wire*` ticket shape are untouched. |
| **Lint rules** | `lintFlow` is untouched: no flow key is added, no step kind, no verdict vocabulary. `harness/flows/*.yaml` do not change. `packages/server/src/package.test.ts`'s route-derivation guard collects half (b)'s route without amendment, provided it is registered `app.get` with a quoted literal — that guard does not match `app.use` at all, which is why AC-14 says so. |
| **Cold-clone impact** | Half (a): **none** — no new command, no new install step, no new dependency, and it arguably shortens the first 30 minutes by making an `adopter`'s first gate self-sufficient. Half (b): **a real cost**, this workspace's first diff renderer, measured under AC-16 and argued under OQ-1. |
| **Cross-vendor rule** | n/a — no flow step is added or changed. |
| **Product-agnostic** | n/a — nothing here names a product. `@quorum/shared` may name no vendor in code, and nothing in AC-1's field does. |
| **Errors are explicit** | AC-5 and AC-7 are this pillar: absent is one spelling, and a screen that cannot say what a step decided says so in a sentence rather than rendering an empty region. AC-14's four separate codes are the same rule at the route. |

---

## §9 What a gate must rule before a line is written

- **GO-1.** OQ-2's decision entry lands **at this gate**, before the implement step starts, and its
  arrival is verified by grepping that step's own `prompt.txt` rather than assumed.
- **GO-2.** OQ-1's split is ruled. If refused, an erratum records the seam and names a second erratum
  as the remedy on exhaustion (Q-0122 E-1's arrangement).
- **GO-3.** OQ-3 is ruled — carry the last declared verdict at an author-declared gate, or carry
  nothing — because AC-4 is unwritable until it is, and an implement step may not choose it.
- **GO-4.** The merge is verified **forced in both environment rows** (Q-0072's closing finding), and
  the product is run by hand: a real run parked at a real gate, the decision read in the browser, and
  the answer sent. **This obligation is written as a demonstration rather than a report because
  Q-0016's own GO-6 asked for exactly this and was reported discharged when the by-hand half was not
  performed** — and attempting it would have found, a day early, that nothing on a real machine
  starts a run. Q-0130 has since given the daemon a producer, so the demonstration is now available:
  start the run from the ticket page, park it at a gate, answer it from the gate screen, and
  transcribe what was observed into `runs.log` rather than paraphrasing it.
