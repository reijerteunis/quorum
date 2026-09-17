# Q-0134 — The gate screen shows what the reviewed change was

*Product-manager candidate, run 1, 2026-09-17. Measured against tip `863c900`.*

---

## 0. What was measured, and what it changes

The ticket body ends *"Start by re-measuring, and re-measure the containment figure first"*. I did that
first, then re-checked every other claim, then measured three things no account of this ticket has had.
**Every claim in the body's own re-measured section holds.** What follows is what is new.

### 0.1 The measurement that splits the ticket: a diff is two classes of bytes, not one

The body says the first thing this ticket owes is *"a measured decision about where those bytes live"*.
Measured over **all 208 diffs this repository has ever materialised** — every `prompt.txt` under
`.quorum/runs` carrying a `## Patch (` section:

| | count | mean | median | max | over 10 KB |
| --- | --- | --- | --- | --- | --- |
| the `--stat` summary section | 208 | **1,262 B** | 1,191 B | **5,033 B** | **0** |
| the patch section | 208 | **121,978 B** | 116,987 B | **202,227 B** | 208 |

They are **~97x apart at the mean**, and the gap is structural rather than a property of this corpus: a
stat grows with the *number of files* and a patch with the *number of changed lines*.

That is the answer, and it is not a preference:

- The **summary is smaller than what already rides**. Q-0129's `reached` snapshot was measured at
  **13 KB** at its largest and landed on the gate question hours before this ticket ran. The stat's
  maximum across 208 real runs is **5,033 B — 2.6x smaller than the largest thing already on the
  question**, while 134 of 208 patches are over 100 KB. A summary on the gate question is inside
  Q-0123's arithmetic with room to spare; a patch is **~570x the 214 B mean event** that arithmetic
  rests on.
- So **there is no single "where do the bytes live" decision to make.** There are two questions about two
  classes, and only one of them is a transport problem at all.

**This is what cuts the ticket** — on the disjoint-blocker seam this repository has cut on five times
(Q-0013, Q-0091, Q-0096, Q-0016, and Q-0129 cutting *this* ticket off itself). See §6 OQ-4 and Appendix A.

### 0.2 The finding that changes the implementation: 89% of real diffs are never cached

The body recommends *"snapshot the bytes the reviewing step was given, never re-run `git diff` at the
gate"*, and notes the run already holds what `materialiseDiff` produced. It does — **for one of the two
flows that has a diff site, and not for the one that matters.**

- `ctx.diffInputs: Map<string, string>` (`packages/core/src/engine/types.ts:272`) holds the whole
  materialised section keyed by interpolated range, filled at `diff.ts:551`, never cleared.
- But `preflightDiffs` only fills it for a range **all of whose endpoints already exist**
  (`diff.ts:546`). A range holding a **step-created** endpoint is *deferred* (`diff.ts:556-559`), and
  `prompt.ts:160-162` then re-materialises it at step time and **does not write it back**.
- `chore.yaml`'s `implement` step is `worktree: true` with `branch: "harness/{id}/implement"`
  (`chore.yaml:5-8`) — it **creates** the right endpoint of `review`'s range
  `harness/{id}/integration...harness/{id}/implement` (`chore.yaml:52`). **That range is always
  deferred, so it is never in `diffInputs`.**

Counted over the corpus by the range each materialisation names:

| range shape | flow | count | in `diffInputs`? |
| --- | --- | --- | --- |
| `harness/<ID>/integration...harness/<ID>/implement` | `chore` | **186** | **no — deferred** |
| `main...harness/<ID>/integration` | `review` | 20 | yes |
| `<sha>...harness/<ID>/integration` | `review --base` | 2 | yes |

**186 of 208 — 89% — are the uncached path.** An implementation that reads `ctx.diffInputs` at the gate
would be correct on `review.yaml`, green in any test written against it, and **blank on every chore run
this product performs**, which is the route 55 of this repository's tickets took.

**The remedy is the siting rule, and it is Q-0129's exactly**: capture where the value is *produced*
(inside `materialiseDiff`, which both paths call) rather than where it is *stored*. Q-0129's own comment
states the principle at `steps.ts:350-357` — *"it is this place because it is where the decision is
VALIDATED"*.

### 0.3 The summary cannot be read out of `--stat`, and that is measured too

The obvious implementation reuses the `--stat` text `materialiseDiff` already produces
(`diff.ts:367`, rendered into the section at `diff.ts:408`). It cannot, for three reasons, all measured:

1. **`--stat` elides paths.** Reproduced live on this repository:

   ```
   --numstat: 56  0  backlog/Q-0131-the-mission-control-header-s-measured-va/runs.log
              52  0  backlog/Q-0134-the-gate-screen-shows-the-diff/ticket.md
   --stat:    .../runs.log    | 56 ++++++++
              .../ticket.md   | 52 ++++++++
   ```

   Two files in **two different tickets** collapse to two strings that name neither. Across the corpus,
   **52 of 208 stat sections — 25% — carry at least one elided path.** A summary built from `--stat`
   cannot name a quarter of the files it lists, and AC-8 is about naming files.
2. **`--stat`'s per-file number is insertions *plus* deletions, combined.** In the same sample it reports
   `61` for a file `--numstat` reports as `60 1`. `docs/05-design-prompt.md:47` asks for *"+/- lines"* —
   the split — which `--stat` does not carry per file at all.
3. `--stat`'s bar art is width- and presentation-dependent; `--numstat` is tab-separated, exact, and
   locale-independent. This is Q-0105's M-7 shape: pick the git atom that answers under every locale.

**So the summary is a `git diff --numstat` read.** That is **not** the "second measurement after refs may
have moved" the body rightly refuses: it happens inside `materialiseDiff`, against the same range, in the
same instant as the two reads already there — not at the gate, minutes later.

### 0.4 A decision entry is owed, and the code says so

Not an inference from the rules — two landed artifacts state it:

- `packages/shared/src/events.ts:206-209`, decision 097's own docblock: *"`reached` ... is one optional
  field and **not the beginning of a family — a second would be a new decision** rather than an extension
  of the one this cites."*
- `packages/shared/src/events.test.ts:239` already pins the exact shape this ticket would reach for:
  `expect(eventSchema.safeParse(question({ reached: { ...REACHED, diff: 'x' } })).success).toBe(false);`
  — a landed test naming `diff` by name as the thing that may not be added to `reached`.

So this ticket **may not extend `reached`**, must add a **sibling optional field** on the question, and
that is a decision only the human may write. **OQ-1, blocking** (§6).

### 0.5 The server changes not at all, and that is proven rather than hoped

`wireRunOf` carries `gates` **whole and unprojected** (`packages/server/src/wire.ts:124-135`), over the
event union's own element schema (`packages/shared/src/wire.ts:179`). Q-0129 widened the question and
`packages/server` changed by **zero lines** — recorded in that file's own comment at `:175-178`. This
half inherits that property intact: no new route, no `wire.ts` edit, no `04-architecture.md` route-list
edit, and no `WRITE_RULES` row (`apps/web/test/source.test.ts:493-500`), the screen issuing no new
request of any kind.

### 0.6 The one guard clause this half may collide with

`apps/web/test/source.test.ts:226` bans `Number(`, `parseInt(` and `parseFloat(` in **every** file under
`apps/web/src` — Q-0131's AC-6 clause, deliberately wider than its criterion, whose failure message says:
*"If this file needs a number for a reason that has nothing to do with a run event, **NARROW this clause
deliberately rather than overriding it** — see `COERCES_TO_NUMBER`, and Q-0131 requirements/errata.md
E-6(b)."*

**This ticket is the first plausible caller of that exit, and it must not use it.** If the summary
crosses as **typed numbers**, the screen reads a number and coerces nothing, the clause stays unnarrowed,
and Q-0131's constraint is honoured rather than dented hours after it landed. That is a second,
independent reason the summary is structured rather than a blob of stat text — the first being §0.3.

### 0.7 Everything else in the ticket body: re-verified

| body claim | verdict |
| --- | --- |
| 42 of 42 `harness/*/integration` contained in `main` | **holds** — 42/42; `main...integration` and `integration...implement` both **0 files** on Q-0127, Q-0129, Q-0131 |
| `repo.max_diff_bytes` default 200,000 | **holds** — `diff.ts:372` |
| `DEFAULT_RETENTION` 500 | **holds** — `serve.ts:47` |
| the needle register is three, not two | **holds** — `SUCCESSOR = ['dif'+'f', 'block'+'er', 'hun'+'k']`, `source.test.ts:1064` |
| AC-14's retired sentence, assembled | **holds** — `source.test.ts:1050` |
| placeholder rule moved a fourth time, to `:342` | **holds** — cited by its words below, never by a number |
| `apps/web` declares no `dependencies` key | **holds**, and is *enforced*: `apps/web/test/package.test.ts:114-115` |
| bundle 352,894 B JS + 10,599 B CSS | **holds** |
| `diff2html` / `diff` / `jsdiff` in no manifest | **holds** — and no highlighter, no Markdown renderer; both **actively banned** (`source.test.ts:977`, `:982`) |

Two additions the body does not have. **The socket drops a subscriber over `MAX_BUFFERED_BYTES` = 4 MiB**
(`serve.ts:57`, `:184-186`) — one 200 KB gate event is 5% of that ceiling, so twenty of them close the
connection with `1013`; a 5 KB summary is 0.1%. And **`docs/05-design-prompt.md:49` already names this
ticket by id** and says *"until it lands the screen shows no region standing in for what it does not
have"* — a **third** document to move, which the body does not list.

---

## 1. Problem

**`maintainer`, at a gate:** I am being asked for one irreversible word about a change I cannot see. The
gate screen now tells me what the reviewer *decided* (Q-0129) and nothing about what the reviewer was
*looking at* — not which files moved, not how much, and not that the reviewer was handed a fraction of it.
`quorum board` tells me a branch exists; the gate screen tells me a verdict exists; nothing tells me the
size and shape of the thing I am about to advance. So I leave the browser and run `git diff` in a
terminal, which is the workflow this product exists to replace.

**The sharper half, and it is a defect the gate is the right place to surface.** Across the last four
tickets every single review was handed a **truncated** diff — `runs.log` records 29 truncations, the most
recent naming **15 files the reviewer got no patch for at all**. Q-0124 made that loss *speak*: it warns
on the event stream and names the files. But the warn goes to the trace, and the person answering the
gate is looking at the gate screen. **The one human who can act on "your reviewer did not see a quarter of
this" is not shown it at the moment they decide.** That is Q-0128's subject arriving where it costs
something, and it is the strongest reason this half ships before the patch half.

**`adopter`:** I ran my first chore flow, it parked at a gate, and the screen asked me to approve a change
it described only as a verdict. I have no way to tell a two-line fix from a two-thousand-line rewrite
without leaving the UI I was told was mission control.

---

## 2. User stories

**US-1 — `maintainer`, the size of the thing.** As a maintainer at a parked gate, I want the screen to
tell me how many files the reviewed change touched and how many lines went in and out, taken from the
same range the reviewing step read, so that I can tell a scoped change from a sprawling one before I
answer.

**US-2 — `maintainer`, the honesty of the evidence.** As a maintainer, I want the screen to name the files
the reviewing step was given **no patch at all** for, so that a verdict reached over 70% of a change
cannot read to me as a verdict over all of it.

**US-3 — `maintainer`, no fabrication.** As a maintainer, I want a gate that follows a step with no diff
to say so in a sentence, so that an empty region is never something I read as "nothing changed".

**US-4 — `adopter`.** As someone running this product for the first time, I want the gate screen to be
self-sufficient for the *shape* of the change, so that my first gate does not send me to a terminal.

**US-5 — `contributor`.** As a contributor, I want the summary to be one declared shape in
`@quorum/shared` that the daemon carries whole, so that a second surface reading it — the CLI's own gate
reader, a later screen — reads the same values and cannot compose a different account of one change.

---

## 3. Non-goals

Explicit, because half of these are things a reasonable implementer would reach for.

1. **The patch itself, and any rendering of one.** No hunks, no unified-diff view, no added/removed line
   colouring. That is **Q-0136** (Appendix A), and the `hunk` needle stays forbidden to prove it.
2. **Any diff-rendering, syntax-highlighting or Markdown dependency.** `apps/web` has no `dependencies`
   key and adding one is a two-sided change (`package.test.ts:87-95`). This half adds no dependency of
   any kind.
3. **A new daemon route.** The question already crosses whole; adding a route here would be a second
   transport for a value that has one.
4. **Persisting a new run-history artifact**, or serving the diff from `.quorum/runs`. An occurrence
   directory holds exactly `prompt.txt` and `output.txt` and this ticket does not make it three.
5. **Parsing `prompt.txt`**, which is the prose-reading decision 097 refused for the verdict, for the
   same reason.
6. **Re-deriving anything at the gate by running git.** The summary is captured at materialisation time
   or it does not exist.
7. **Changing `max_diff_bytes`, the truncation algorithm, or whether a truncated review may approve.**
   The last is **Q-0128's** in as many words.
8. **Widening the gate answer set.** It stays the closed three, and `gateAnswerSchema` is untouched.
9. **Mission control (Q-0015), the ticket page (Q-0127), or run history (Q-0018).** One surface.
10. **Durability across a daemon restart.** A gate question lives in memory; that premise is **Q-0019's**.
11. **Any second field beyond the one this ticket adds.** 097's clause governs a third as it governs this
    one.

---

## 4. Acceptance criteria

Numbered continuously with Appendix A, so a criterion keeps its name if the gate moves the cut.
**Fourteen**, against this role's ceiling of fifteen — and the precedent is unanimous that going past it
is paid for rather than absorbed (Q-0013 refused at eighteen, Q-0122 accepted twenty and spent three
implement rounds, Q-0126 refused a split at sixteen and spent $177.92).

---

**AC-1 — The gate question carries a diff summary, whole or absent, declared in `@quorum/shared`.**
`gateQuestionEventSchema` gains exactly one new **optional** member beside `reached` — not a member of
`reached`, which is `.strict()` and whose extension `events.test.ts:239` already refuses by name. Its own
schema is `.strict()`, all members required, and the field is **whole or absent, never partly present** —
the rule `events.ts:174-178` states for `reached` and which this follows rather than restates.
*Test:* the schema refuses an unknown key at both levels; refuses the field with any one member deleted;
refuses `{}`; and accepts a question carrying no such field at all. Every other member of the event union
parses byte-identically to before, by the anti-regression comparison `events.test.ts` already performs.

**AC-2 — The summary is produced where the diff is materialised, not where the gate is built.**
The capture site is inside `materialiseDiff` (`packages/core/src/engine/diff.ts:317`), which **both** the
preflight path (`diff.ts:551`) and the deferred step-time path (`prompt.ts:160-162`) call. It is held in
one run-scoped slot on `RunContext`, assigned at that site and read where a gate question is built — the
shape Q-0129 landed, cited rather than re-derived.
*Test:* a source guard proves no file in `packages/core` reads `diffInputs` to build a gate question, and
that the assignment is reachable from the single `materialiseDiff` return.

**AC-3 — A chore run's gate carries a summary, which is the case `diffInputs` cannot serve.**
The load-bearing criterion, and the one a naive implementation fails while passing every other. A flow
whose diff range has a **step-created** endpoint — `harness/{id}/integration...harness/{id}/implement`,
which `chore.yaml:5-8` and `:52` make the shape of **186 of this repository's 208 materialisations** — is
deferred by `preflightDiffs` and never enters `diffInputs`. Its gate carries a summary regardless.
*Test:* driven over a built repository, both shapes: a range with two pre-existing endpoints (cached) and
a range whose right endpoint an earlier `worktree` step creates (deferred). **Both** gate questions carry
a summary, and the deferred one is shown **red** against an implementation reading `diffInputs`.

**AC-4 — The summary is the one the reviewing step was given, and it survives the steps between.**
Identity, never inference. In `chore.yaml` the gate is **three steps after** the review that read a diff —
`implement -> review -> integrate -> gate` (`chore.yaml:83-84`) — and `integrate` materialises no diff, so
the slot still holds `review`'s when the gate is built. Where two panel members read one range
(`review.yaml:12`, `:19` are byte-identical), the gate carries **one** summary and not two, which is
Q-0038 AC-10's identical-bytes guarantee holding at a new site.
*Test:* a flow with an `integrate` step between the diff-bearing step and the gate; the question's
summary names the reviewing step's range. A `parallel:` panel over one range yields one summary.

**AC-5 — The summary is spent at the emit, on object identity.**
`askGate` clears the slot one line after `context.emit(request)` and **only where the slot still holds the
very object this question took** (`routing.ts:56-58`). The new field obeys that rule rather than inventing
a second lifetime — Q-0129 erratum E-7(a), which cost that ticket four majors across three rounds, every
one of them the lifetime of a run-scoped slot.
*Test:* an auto-advanced gate emits no question and does **not** spend the summary; a gate that emits
spends it; a later gate with no intervening materialisation carries none.

**AC-6 — `packages/server` changes not at all.**
The question crosses whole through `RunView.gates` -> `wireRunOf` -> `WireRun.gates`
(`server/src/wire.ts:124-135`), over the element schema `gateQuestionEventSchema`
(`shared/src/wire.ts:179`). No route is added, no field is projected, no `04-architecture.md` route list
moves.
*Test:* a diff of `packages/server/src` over this change is empty but for comments; the daemon's
registered-route set is unchanged, asserted by the derivation `package.test.ts` already performs rather
than by a count.

**AC-7 — The gate screen renders what changed, as values, from the question.**
A region beside the decision region — which `gate-screen.tsx:620-623` sites *above* the controls
"because it is what a reader is answering FROM" — showing the range, the file count, and total insertions
and deletions **separately**, never one blended number. Per-file entries carry the **full path** and its
own insertions and deletions.
*Test:* rendered from a question fixture; the file count, the two totals and a per-file row each assert
against the fixture's values. A binary file renders as binary rather than as zero.

**AC-8 — The screen names the files the reviewing step was given no patch for.**
Where the patch was truncated, the region names them — the same list `filesAfter` computes
(`diff.ts:420-428`) and Q-0124's warn already carries — with the kept and full byte counts. Where the cut
landed inside a file everyone can see, it says **that** instead of printing an empty list, which is the
distinction `diff.ts:383-386` already draws and which this may not lose one layer up. **This makes the
truncation visible to the person answering the gate for the first time.**
*Test:* three fixtures — not truncated, truncated with zero wholly-absent files, truncated with several.
Each renders a distinguishable sentence; the third names every file and no file that has a patch.

**AC-9 — No file under `apps/web/src` coerces a string to a number, and the clause is not narrowed.**
`COERCES_TO_NUMBER` (`source.test.ts:226`) stays exactly as Q-0131 landed it. The screen reads typed
values and parses nothing out of prose, which is also Q-0015's AC-6 holding.
*Test:* the existing clause passes unamended over the changed corpus, and its own evasion fixture still
fires. **A narrowing of it fails this criterion**, whatever else passes.

**AC-10 — A gate with no diff says so in a sentence, and no region is an absence.**
Four of the six shipped flows declare no `input.diff` at all — `development`, `qa-red`, `requirements`,
`solutioning` — so this is the common case rather than an edge. The screen renders a sentence in the
shape `NO_REACHED` already uses (`gate-screen.tsx:113-114`), saying the gate follows a step that read no
diff and that this is not a claim that nothing changed. **No blank panel, no spinner, no skeleton, and
nothing fabricated**, per `docs/04-architecture.md`'s rule — *"No placeholder is a blank panel, a spinner
or a skeleton, and none shows a fabricated project, run, ticket or cost"* — cited by its words, its line
having moved four times.
*Test:* a question with no summary renders that sentence; the region is never empty; no rendered path
asserts a count the question did not carry.

**AC-11 — The needle register retires exactly what landed and keeps what did not.**
`SUCCESSOR = ['dif'+'f', 'block'+'er', 'hun'+'k']` (`source.test.ts:1064`) is a case-insensitive
word-boundary scan over `gate-screen.tsx` alone, comments included. **`hunk` stays forbidden** — this half
renders none — and **`blocker` stays forbidden** for the reason that test's own comment gives, that the
severity vocabulary is imported from `@quorum/shared` and never spelled. Whether `diff` retires is
decided by what the screen is actually named, and the register must agree with the file rather than the
file with the register. The discrimination clause and the inverted `RETIRED` clause both survive.
*Test:* each surviving needle is shown to still match the fixture sentence; each retired one is shown
present in the screen; deleting the new region turns a clause red.

**AC-12 — The route row stops promising what this half delivers, and names whose the rest is.**
`routes.ts:222`'s `waitingFor` currently routes the whole thing to this ticket, and
`routes.test.ts:158-188` asserts the row `.toContain('Q-0134')`. After this lands the row says the screen
shows what changed and routes **the patch** to the successor by id.
*Test:* the routes clause set is re-aimed and each clause shown red on its own; AC-14's retired-sentence
scan (`source.test.ts:1050`) still finds the old sentence nowhere under `src` and still discriminates
against its own fixture.

**AC-13 — The summary carries a bound, the bound is measured, and where it applies the screen says so.**
A summary is small (max **5,033 B** over 208 real diffs) and is not *guaranteed* small — a change touching
ten thousand files is not bounded by anything here. So it carries a cap on file entries, chosen from that
measurement and stated with it; where it bites, the screen discloses what it left out **using Q-0124's
existing shape rather than a second vocabulary for the same fact**, which is the body's instruction and
the whole of what stops the two accounts drifting.
*Test:* a fixture over the cap discloses; one under it discloses nothing; the disclosure names a count
rather than implying completeness. The chosen number appears with its measurement in the source, not
alone.

**AC-14 — Three documents move, and one contract note is written at the gate.**
`docs/05-design-prompt.md:49`'s divergence paragraph names this ticket and says *"until it lands the
screen shows no region standing in for what it does not have"* — half of that is discharged and the other
half moves to the successor. `docs/04-architecture.md` gains the field where it describes what a gate
question carries. `contracts/Q-0050/run-events.contract.md` gains a note, and **is written by hand at the
gate**: `contracts/` is not among `developer-generalist`'s roots, which cost Q-0129 an implement round
and Q-0131 a gate obligation within the last day.
*Test:* the design prompt carries no live sentence saying the screen shows no region for this; the
architecture document and the schema agree, asserted against the schema rather than against prose.

---

## 5. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no credential, no environment read. No test, fixture or doc example added here names a key. |
| **Worktree safety** | n/a — nothing writes. The summary is derived from a `git diff --numstat` read inside an existing read-only function. |
| **Gate behaviour** | The answer set stays the closed three and `gateAnswerSchema` is untouched. Human-gated by default is unaffected; an `auto` gate emits no question and therefore carries no summary, which AC-5 pins. |
| **File format and schema** | One optional field on `gateQuestionEventSchema`, `.strict()` at both levels, in `@quorum/shared`. **Owes a decision entry** — OQ-1. `contracts/Q-0050/run-events.contract.md` gains a superseded-by note (AC-14). |
| **Lint rules** | None added. `validDiffRange` (`lint/lint.ts:168-182`) and its runtime twin (`diff.ts:319-332`) are untouched: this ticket serves no range those two would refuse, because it serves the range they already admitted. |
| **Cold-clone impact** | **Zero.** No dependency, no install-size change, no bundle-size change beyond one component. The 30-minute path gains a gate screen that says more and asks the same one word. |
| **Files are the database** | Nothing new is persisted. The value crosses on the stream and lives as long as the run does, which is exactly what a gate question already does. |
| **Product-agnostic** | n/a. |
| **Errors are explicit** | A `--numstat` read that fails must not silently yield an empty summary — an absent summary and a failed probe are different answers, which is *"A probe that could not answer is not a negative"* (2026-09-10) and the class Q-0074 and Q-0115 spent two tickets removing. See R-3. |

---

## 6. Open questions

Stated rather than asked wherever the document can answer them from the tree — Q-0105's remedy, since a
requirement that leaves a case uncovered is one `developer-generalist` must stop on.

**OQ-1 (BLOCKING — human, before the implement step runs).** *The decision entry.*
`events.ts:206-209` says a second field on the gate question *"would be a new decision rather than an
extension of the one this cites"*, and `events.test.ts:239` refuses the alternative by name. So an entry
is owed, it is one no step on the chore route may write, and **AC-1 is unsatisfiable without it**. The
precedent for what that costs is days old and unambiguous: Q-0126's round 1 returned `blocked` on a
gate obligation carried forward as *unchanged*, and Q-0062 spent **three implement rounds and most of
$88.49** on an entry its own requirement had said must exist before the run. **Do not launch the chore run
until it has landed**, and verify by grep that it appears in the implement step's `prompt.txt` — the check
Q-0097 lost two errata by not making and which Q-0125 and Q-0129 both performed.
What it must rule: that the gate question carries the *shape* of the change beside the *decision* about
it; that the summary is bounded where `reached` needed no bound, and why (§0.1's two classes); and that
the patch is explicitly **not** admitted by the same reasoning, so the entry closes the family rather than
opening it.

**OQ-2 — answered here, not asked.** *Structured values, not stat text.* The summary carries per-file
entries of `{path, insertions, deletions}` plus totals and the omitted-file list, derived from
`git diff --numstat`. Three measurements decide it and §0.3 and §0.6 hold them: `--stat` elides paths in
**52 of 208** real cases, its per-file number is insertions and deletions **combined** where the brief
asks for the split, and a screen that received stat *text* would have to coerce numbers out of it, which
`COERCES_TO_NUMBER` forbids across `apps/web/src`.

**OQ-3 — answered here.** *The cap is on file entries, not on bytes.* A byte cap on a structured value is
the wrong unit and would need its own truncation vocabulary; a file-entry cap is one number, discloses in
Q-0124's existing shape, and is chosen against the measured maximum. AC-13 requires the number be stated
with its measurement rather than alone.

**OQ-4 (for the gate) — the cut, and the title.** This document recommends **this ticket takes the
summary and the patch becomes Q-0136** (Appendix A), on §0.1's 97x measurement and on disjoint blockers:
this half needs one schema field and one decision entry; that half needs a retention decision for 122 KB,
this workspace's first diff dependency, and an answer to Q-0128 it must not give alone. Together they are
**~24 criteria**. If the gate refuses the split, it should do what Q-0122's E-1 did — accept the size
deliberately, name the seam in advance, and name a second erratum rather than a further implement round
as the remedy on exhaustion. **On the split this ticket is retitled**, since it would render no patch;
the title is the human's and this document does not choose one.

**OQ-5 — for the gate, and cheap.** Whether the region is drawn above or below `ReachedRegion`. Both are
above the controls. Recommended: **below** the decision, because the decision is what a reader is
answering and the summary is what the decision was about. Not a criterion.

---

## 7. Risks

**R-1 — The 89% case is invisible to any test written the obvious way.** §0.2. A test driven through
`review.yaml`'s cached range passes over an implementation that is blank on every chore run. **AC-3 is the
mitigation and it must not be trimmed**: it is the only criterion whose subject no existing guard reaches.
Named here in advance, on Q-0122's precedent of naming the criterion that may not be cut.

**R-2 — There is nothing in this backlog to demonstrate against.** 42 of 42 integration branches are
contained in `main`, so `{base}...integration` and `integration...implement` are both **empty for every
ticket here** — sampled at 0 files on Q-0127, Q-0129 and Q-0131. Acceptance evidence is a repository the
test builds, `git.test.ts`'s shape, and **no gate demonstration may use a past ticket**. This is Q-0077's
subject arriving as a sequencing fact and it binds the successor identically.

**R-3 — A failed `--numstat` read becoming a blank summary would add an instance of the class two tickets
were spent removing.** An absent summary (the gate read no diff) and a failed probe (git could not be
asked) are different answers, and collapsing them is exactly *"A probe that could not answer is not a
negative"* (2026-09-10). `materialiseDiff` already throws on every condition it cannot answer
(`diff.ts:310-316`); the summary follows that rather than degrading quietly.

**R-4 — The review of this change will itself be truncated, and the files at risk are the ones this
ticket is about.** The last four tickets were all cut at 200,000 bytes, and `git diff` orders by path, so
`packages/shared/src/events.ts` and `wire.ts` sit in the alphabetical tail — **`events.ts` is exactly the
file Q-0129's four reviews received no patch for, four times running**, and it is this ticket's central
file too. Q-0124's warn will name it and Q-0117's `observation:` channel gives the reviewer somewhere to
say so; that pair has composed on three consecutive tickets. **A hand pass over the omitted files is owed
at the gate regardless** — GO-4 — because on Q-0017 three clean reports over a truncated diff hid three
real findings.

**R-5 — A first-round approve on a small, schema-shaped change should be distrusted.** 74% of chore
reviews return `revise`; a fast approve over a change whose central file the reviewer may not have
received is worth mutating rather than banking (Q-0051, and the four tickets since where the reviewer
disclosed it could not execute the suite at all under `--sandbox read-only`).

**R-6 — Scope creep toward the patch.** The patch is one field away and the temptation is one line.
§0.1's arithmetic is the defence and the `hunk` needle is the guard: it stays forbidden, so a hunk
rendered here fails a landed test rather than passing review.

---

## 8. Gate obligations

**GO-1 — Land OQ-1's decision entry before the chore run, and verify it reached the implementer.**
By grep over `.quorum/runs/<run>/steps/001-implement/prompt.txt`, by title and date. Not by assumption:
Q-0097 lost two errata to a ruling landed in a window no step could read.

**GO-2 — Write the `contracts/Q-0050/run-events.contract.md` note by hand at this gate.** That folder is
not among `developer-generalist`'s roots. Q-0129 spent an implement round discovering this **one day
ago** and Q-0131 avoided it by doing exactly this. AC-14 states the criterion; this obligation states who
performs it.

**GO-3 — Discharge by running the product and transcribing what it rendered.** A real daemon from
`quorum open`, a real run started **through the daemon** — a `quorum run` is a different process the host
can never see, which is Q-0121's measurement — parked at a real gate, opened in a browser, and the
summary region transcribed into `runs.log` verbatim. **The standard is Q-0016's failure**: its GO-6 asked
for exactly this and was reported discharged when the by-hand half had not been performed, which Q-0015's
gate found a day later. Because R-2 means no ticket here has a non-empty range, the demonstration needs a
range built for it; say in `runs.log` how it was built.

**GO-4 — Perform a hand pass over every file the review received no patch for**, cross-vendor, and record
what it found including nothing. R-4 names why, and Q-0017 is the counter-example where skipping it cost
three real findings.

**GO-5 — Verify forced in both environment rows**, per Q-0072's closing finding: a detached worktree with
neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge. Plus `quorum lint` and the
git-identity sweep.

**GO-6 — If the split is taken, open the successor at this gate with its body transcribed in full**, not
referenced. Appendix A is written for that. Three obligations found orphaned in one week had lived only
inside a closed ticket's prose, and this ticket's own body opens by saying so.

---

## 9. Appendix A — the successor, written out in full

*To be transcribed verbatim into the successor's `ticket.md` at this gate if OQ-4's split is taken.
Recommended id **Q-0136** (Q-0135 is the highest folder in `backlog/`), p3.*

---

### The gate screen shows the patch

The half Q-0134 does not build: the patch itself, rendered.

**What makes the blockers disjoint, measured rather than asserted.** Q-0134 carries **1,262 B mean /
5,033 B max** on a transport that already carries a 13 KB sibling, needs one schema field and one decision
entry, adds no route and no dependency, and changes `packages/server` by zero lines. This half carries
**121,978 B mean / 202,227 B max** — measured over all 208 diffs this repository has materialised — which
is **~570x the 214 B mean event** Q-0123's retention arithmetic rests on, and needs a renderer this
workspace has never had.

**It may not ride on the gate question, and the arithmetic is not close.** A gate question enters the
broadcast's `retained` buffer (`DEFAULT_RETENTION` = 500, `serve.ts:47`), is **replayed to every late
subscriber and on every reconnect** (`broadcast.ts:156`), is held simultaneously by the pending-gate
registry (`gates.ts:84-87`), and Q-0123 ruled a record is **never released**. Worse than memory: the
socket drops a subscriber over `MAX_BUFFERED_BYTES` = 4 MiB with `ws.close(1013, ...)`
(`serve.ts:57`, `:184-186`), so **twenty 200 KB gate events close the connection**. That is a functional
break, not a cost.

**The three remaining shapes, and what each owes.**

1. **A route keyed on `gateId`**, served from bytes the daemon holds. The daemon does **not** hold them:
   `materialiseDiff` runs inside `runFlow` and the bytes never cross. They would reach it through an
   out-of-band callback on `RunFlowOptions` beside `answerGate` — the channel Q-0131 established for the
   run number on 2026-09-17 and documented at `types.ts:122-129`, which owes **no** decision entry
   precisely because a callback is not an event. **This is the recommended shape.** It owes a retention
   answer: what holds 122 KB per gate, for how long, and what Q-0123's never-released ruling means for it.
2. **A new run-history artifact.** The bytes are already on disk inside `prompt.txt`, but embedded in the
   whole prompt, and extracting them is prose-parsing — which decision 097 refused for the verdict, on a
   measurement about separators. A third file beside `prompt.txt` and `output.txt` would be **identity
   rather than inference** and durable across a restart, and it costs a measured **~25.4 MB** duplicated
   into an already-111 MB store (208 x 121,978 B) for bytes that are there twice. It touches
   `writer.ts` — the one file in `packages/core` that writes under `.quorum/` — so it engages Q-0049's
   three-file discipline and likely owes an entry.
3. **Re-deriving at the gate.** Refused, and not on cost: it is a second measurement after refs may have
   moved, so the browser could show a diff the reviewer never saw. Q-0134's summary removes that by
   capturing at materialisation time, and this half must not reintroduce it.

**The renderer.** `diff2html`, `diff` and `jsdiff` appear in no manifest. `apps/web` declares **no
`dependencies` key at all** — enforced at `apps/web/test/package.test.ts:114-115` — so a renderer is a
**devDependency** bundled into the served artifact, not a runtime edge on a packed install. **Measure
against the current bundle: 352,894 B of JavaScript and 10,599 B of CSS.** `@quorum/web` is a distribution
package, so the bundle is what a packed install serves and what the cold-clone test pays for.
`apps/web/test/package.test.ts:87-95` checks a `JUSTIFICATIONS` register in **both** directions with
reasons over 20 characters. A hand-written renderer is the alternative and is a real design problem:
added/removed distinction, long lines, binary files, and paths that are renames.

**There is a reusable primitive already, and it is not factored.** `apps/web/src/ticket-page.tsx:242`
carries `max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded border border-border
bg-surface p-3 font-mono text-xs text-text` with a byte-count caption above it, and **the same class
string is duplicated at `:728`**. Whether that becomes a component is this ticket's to decide.

**Q-0128 is the neighbour and the collision is real.** `materialiseDiff` truncates **head-only**, so what
is lost is every patch for the alphabetical tail, entirely. Q-0124 made that loss speak and the
`diff truncated range=` token is **load-bearing** — `diff.test.ts`'s AC-9.5 counts materialisations off
it (`diff.test.ts:1141-1161`), and rewriting the line without it silently turns a working counter into
one matching nothing, which is the defect class committed while fixing it. Whatever this ticket does about
a cap must **reuse that machinery or say in one line why not**. It must **not** decide whether a truncated
review may approve; that is Q-0128's. Q-0134 already renders the omitted-file list, so this half must not
grow a second account of the same fact.

**Two guard needles are this ticket's, and both stay valid while it waits.**
`apps/web/test/source.test.ts:1064` keeps `hunk` forbidden in `gate-screen.tsx` — a case-insensitive
word-boundary scan over that one file, comments included — and keeps `blocker` forbidden for the separate
reason that test's own comment gives: the severity vocabulary is imported from `@quorum/shared` and never
spelled. `apps/web/test/routes.test.ts:158-188` requires the gate row to name this ticket by id.

**What it must not do.** Widen the gate answer set. Serve a patch from a range the guard at
`diff.ts:319-332` would refuse — both endpoints must be the configured base or one of the ticket's own
branches, with the static twin at `lint/lint.ts:168-182`. Coerce a string to a number under
`apps/web/src`, `COERCES_TO_NUMBER` (`source.test.ts:226`) being unnarrowed and Q-0131's E-6(b) naming the
exit condition. Import a Markdown renderer or sanitiser, or use `dangerouslySetInnerHTML` — both banned
(`source.test.ts:977`, `:982`). Or show a partial patch without saying so, which is
`docs/04-architecture.md`'s rule: *"No placeholder is a blank panel, a spinner or a skeleton, and none
shows a fabricated project, run, ticket or cost"* — cited by its words, its line having moved four times
(`:200` -> `:317` -> `:336` -> `:342`).

**Start by re-measuring the containment figure**, which was 40 of 40 when Q-0129's gate wrote it, **42 of
42** on 2026-09-17, and moves every time a branch lands. It decides whether this ticket can be
demonstrated at all: with every range empty, acceptance evidence must be a repository the test builds and
no gate demonstration can use a past ticket.

---

## 10. Provenance

**Measured against tip `863c900` on 2026-09-17**, before anything was written. Every figure in §0 was
produced by running the measurement, not transcribed.

- Containment: `git merge-base --is-ancestor` over all 42 `harness/*/integration` branches; ranges sampled
  on Q-0127, Q-0129, Q-0131.
- The 208-diff corpus: every `prompt.txt` under `.quorum/runs` carrying a `## Patch (` header, sectioned
  at `## Diff to review` and `## Patch (`, sized in bytes. 827 prompts total, 208 with a diff.
- The range census (186 / 20 / 2) and the path-elision count (52 of 208) from the same corpus.
- The `--numstat` vs `--stat` comparison run live against `HEAD~3...HEAD`.
- Truncation evidence: 29 `diff truncated` lines across `backlog/*/runs.log`.
- Constants read in place: `diff.ts:372`, `serve.ts:47`, `serve.ts:57`.
- Bundle measured from `apps/web/dist`.

**What I did not do, stated rather than implied.** I did not read the sibling PM candidate's document —
the panel's independence is what the merge is worth. I did not run the suite: nothing here changes code.
The six flows and their diff sites were read from `harness/flows/` directly; the claim that
`apps/web` has no diff renderer rests on a grep plus the manifest, which agree, rather than on either
alone.

**One correction to this ticket's own body, offered rather than assumed.** It says the first thing owed is
*"a measured decision about where those bytes live"*. Measured, the bytes already live in two places —
`ctx.diffInputs` in memory for the life of a run **for 20 of 208 real cases**, and `prompt.txt` on disk
for all of them — and neither is reachable from the daemon. The open question is not where they live but
**how they cross**, and the answer differs by two orders of magnitude between the summary and the patch,
which is why it is two tickets.
