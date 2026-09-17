# Q-0134 — The gate screen shows the diff

*Merged requirement, run 1, iteration 1. Measured against tip `863c900` on 2026-09-17.*

---

## 0. What was measured, and what it decides

Every figure below was re-derived by running the measurement, not transcribed from either candidate.
Where a candidate's number differs from mine, mine is the one this document carries and the
difference is stated rather than smoothed over — *a measurement copied from a document is not a
measurement*, and both candidates are documents.

### 0.1 The decisive implementation fact: 89% of real diffs are never cached

**candidate-claude's finding, verified in full, and it is the most valuable thing either document
produced.**

`ctx.diffInputs` (`engine/types.ts:67`) holds a materialised section keyed by interpolated range.
`preflightDiffs` fills it only for a range **all of whose endpoints already exist**
(`diff.ts:551`). A range holding a **step-created** endpoint is recorded in `deferredDiffs`
(`diff.ts:558`) instead, and `prompt.ts:160-162` then re-materialises it at step time:

```
parts.push(context.diffInputs.get(range) ?? (context.dry ? … : materialiseDiff(…)));
```

**and does not write it back.** `chore.yaml`'s `implement` is `worktree: true` with
`branch: "harness/{id}/implement"` (`:9-10`) — it *creates* the right endpoint of `review`'s range
`harness/{id}/integration...harness/{id}/implement` (`:52`). That range is therefore always
deferred and never in `diffInputs`.

Counted over **every** prompt in this repository's run history — 828 prompts, 208 carrying a
`## Patch (` section — by the range each names:

| range shape | flow | count | in `diffInputs`? |
| --- | --- | --- | --- |
| `harness/<ID>/integration...harness/<ID>/implement` | `chore` | **186** | **no — deferred** |
| `main...harness/<ID>/integration` | `review` | 20 | yes |
| `<sha>...harness/<ID>/integration` | `review --base` | 2 | yes |

**186 of 208 — 89% — are the uncached path**, and it is the route 55 of this repository's tickets
took. An implementation that reads `ctx.diffInputs` at the gate is correct on `review.yaml`, green
in any test written against it, and **blank on every chore run this product performs**.

**candidate-codex does not name this anywhere.** Its AC-1 says only that Quorum "associates the
exact materialised diff evidence supplied to that step", which an implementer satisfies from the
cache. This is AC-1 below, it is the criterion no existing guard reaches, and §6 names it as not
eligible for trimming.

The remedy is the siting rule Q-0129 landed and stated in its own source: capture where the value
is **produced** — inside `materialiseDiff` (`diff.ts:317`), which **both** paths call — rather than
where it is stored.

### 0.2 The decisive design fact: the bytes may not ride on the gate question

**candidate-codex's finding, verified, and it is why this ticket is buildable as one.**

Measured over the same 208:

| | count | mean | median | max | over 100 KB |
| --- | --- | --- | --- | --- | --- |
| the `--stat` summary section | 208 | **1,169 B** | 1,095 B | **4,937 B** | 0 |
| the patch section | 208 | **121,914 B** | 117,987 B | **202,161 B** | **134** |

*(candidate-claude reported 1,262 / 5,033 and 121,978 / 202,227 — within a section-boundary byte
count of these; the ~100x ratio and the 186/20/2 census agree exactly.)*

A gate question enters the broadcast's retained buffer (`DEFAULT_RETENTION` = 500,
`serve.ts:47`) and is replayed to every late subscriber and on every reconnect, and Q-0123 ruled
four days ago that a record is never released — on an arithmetic of 214 B mean per event.
**A 202 KB event is ~950x that mean.** And it is worse than memory: `serve.ts:57` drops a
subscriber over `MAX_BUFFERED_BYTES` = 4 MiB with `ws.close(1013, …)` (`:185`), so **twenty such
events close the connection**. That is a functional break, not a cost, and it is what makes
"put it on the question" refused rather than merely expensive.

### 0.3 Why this is ONE ticket, and why both candidates' cuts are refused

**candidate-codex is 22 criteria** against this role's ceiling of fifteen. The precedent is
unanimous and recent: Q-0013 refused at eighteen and split in three, Q-0122 accepted twenty and
spent three implement rounds, Q-0126 refused a split at sixteen and spent $177.92 with a round-1
`blocked`. It is not approved as written.

**candidate-claude is 14 criteria and delivers a file-and-line summary, not the diff.** It is
disciplined, its measurements are excellent, and its cut is refused on two grounds:

1. **It leaves the ticket's headline undelivered for a third ticket.** Q-0134 is already the half
   split off Q-0129; the maintainer's problem is *I cannot see the change*, and a file count does
   not let them see it. Its own Appendix A concedes the successor is still owed a renderer, a
   retention answer and a transport.
2. **It splits one fact across two transports.** Its AC-8 renders the omitted-file list from the
   summary on the question; its successor must disclose truncation again when it renders the patch.
   The ticket body's own warning is that *"answering it twice in two places is how the two drift"*,
   and Appendix A acknowledges the hazard without removing it.

**The split dissolves once the transport is the route.** `materialiseDiff` returns **one string**
already containing the `--stat`, the patch and the truncation notice
(`diff.ts:408`). If that snapshot is fetched on demand, the summary is not a separate transport
problem at all — it arrives in the same read, from the same measurement, with one account of
truncation. **Nothing is added to the event union**, so `events.ts:206-209`'s clause that `reached`
is *"one optional field and not the beginning of a family"* is honoured by not touching it, and
`events.test.ts:239` — which already refuses `reached.diff` **by name** — stays green unamended.

That is the merge: **codex's transport, claude's capture site and rigour, one ticket, fourteen
criteria.**

### 0.4 Every mechanism this needs already exists

| what | where | precedent |
| --- | --- | --- |
| capture at the producing site | `diff.ts:317` | Q-0129's siting rule, `steps.ts:350-357` |
| out-of-band carriage to the caller | `RunFlowOptions` | **`reportRunNumber`** (`types.ts:122-129`), landed 2026-09-17, *"the same kind of channel as `answerGate`: out of band … carrying a value no event gains"* — and owing **no** entry precisely because a callback is not an event |
| holding it against a pending gate | `gates.ts:85`, `:110` | the registry is already `handle → gateId → {question, settle}`, already deletes on settle, and already refuses `not-this-run` (`:103`) |
| a browser read | `daemon-endpoints.ts`, `daemon-client.ts` | a **GET**, so no `WRITE_RULES` row is added and the write boundary Q-0130 widened is untouched |

### 0.5 The ticket body's own claims, re-verified — seven hold, one is corrected

| claim | verdict |
| --- | --- |
| 42 of 42 `harness/*/integration` contained in `main` | **holds**, re-run: 42 of 42 |
| `repo.max_diff_bytes` default 200,000 | **holds** — `diff.ts:372` |
| `DEFAULT_RETENTION` 500 | **holds** — `serve.ts:47` |
| the needle register is **three**, not two | **holds** — `SUCCESSOR = ['dif'+'f', 'block'+'er', 'hun'+'k']`, `source.test.ts:1064` |
| the retired sentence, assembled from fragments | **holds** — `source.test.ts:1050` |
| `apps/web` declares no `dependencies` key | **holds**, and is enforced; 10 devDependencies |
| bundle 352,894 B JS + 10,599 B CSS | **holds** |
| *"`chore`'s gate follows `integrate`, **three steps after** the review that read a diff"* | **CORRECTED — it is two.** `chore.yaml` is `implement`(:6) → `review`(:47) → `integrate`(:75) → `gate`(:83). The conclusion is unchanged and strengthened: a step that materialises no diff sits between the reviewer and the gate, which is exactly why the evidence must be held rather than inferred from *the last step*. |

Two additions neither candidate has. **Only two of the six shipped flows declare an `input.diff`
at all** — `chore` and `review` — so a gate carrying no diff is the common case rather than an edge
(AC-11). And `--stat` **elides paths**: 56 of 208 real stat sections — 27% — carry at least one
`.../…` path, so the stat text is a display artefact and not an inventory
(candidate-claude measured 52; mine is 56, and 2 further sections carry a rename arrow).

---

## 1. Problem

A maintainer at a gate is asked for one irreversible word about a change they cannot see. Since
Q-0129 the screen shows what the reviewing step *decided*; nothing shows what it was *looking at*.
So they leave the browser and reconstruct a git range in a terminal, which is the workflow this
product exists to replace.

Reconstructing it when the screen opens would not be trustworthy. Refs may have moved since the
step ran, a flow may hold more than one `input.diff` site, and `chore`'s gate is two steps past the
reviewer. The screen must show **the exact bounded bytes the reviewing step was given** — identity,
never inference.

There is a second reader-facing defect the gate is the right place to close. Across recent tickets
every review was handed a **truncated** diff; `runs.log` records 29 truncations, the most recent
naming **15 files the reviewer received no patch for at all**. Q-0124 made that loss speak — but it
speaks on the trace, and the one human who can act on *"your reviewer did not see a quarter of
this"* is looking at the gate screen when they decide.

---

## 2. User story

As a **solo maintainer at a parked gate**, I want to see the exact diff the deciding step reviewed —
including, where it was cut, what the reviewer was not shown — so that I can answer the gate without
reconstructing evidence in a terminal and without being shown a change the reviewer never saw.

---

## 3. Acceptance criteria

Fourteen. Numbered continuously, so a criterion keeps its name if the gate moves the cut.

**AC-1 — The evidence is captured where the diff is produced, which is the only site that covers a
chore run.**
The snapshot is taken inside `materialiseDiff` (`packages/core/src/engine/diff.ts:317`), which both
the preflight path (`diff.ts:551`) and the deferred step-time path (`prompt.ts:160-162`) call, and
after that function's existing range guard has admitted both endpoints. It is **not** read from
`ctx.diffInputs`, which by construction never holds a range with a step-created endpoint.
*Test:* driven over a constructed repository, **both** shapes — a range whose endpoints both
pre-exist, and a range whose right endpoint an earlier `worktree` step creates, which is
`chore.yaml`'s shape and **186 of this repository's 208 real materialisations**. Both yield
evidence, and the deferred one is demonstrated **red** against an implementation that reads
`diffInputs`. A source guard proves no gate-building path reads that map.

**AC-2 — The evidence is the reviewing step's, and survives the steps between it and the gate.**
It identifies the deciding step and the interpolated three-dot range. A step that materialises no
diff — `chore`'s `integrate`, which sits between `review` and the gate — does not replace or clear
it, and a gate exposes evidence only where its `reached` decision came from the step the evidence
was materialised for. Where a `parallel:` panel reads one range at byte-identical sites
(`review.yaml:12`, `:19`), the gate carries **one** snapshot, which is Q-0038 AC-10's
identical-bytes guarantee holding at a new site.
*Test:* a flow with an intervening `integrate`; the evidence still names the reviewing step's range.
A two-member panel over one range yields one snapshot. A run with two `input.diff` sites does not
expose the other site's evidence merely because it ran more recently.

**AC-3 — It reaches the caller out of band, and the event union is not widened.**
Delivery is a caller-supplied callback on `RunFlowOptions`, the channel `answerGate` and
`reportRunNumber` already use — *"out of band … carrying a value no event gains"*
(`engine/types.ts:122-129`). **No member of the event union gains a field**, `gateQuestionEventSchema`
and `gateReachedSchema` are untouched, and `events.test.ts:239`'s refusal of `reached.diff` stays
green unamended.
*Test:* every member of the event union parses byte-identically to before, by the anti-regression
comparison `events.test.ts` already performs; a run with no callback supplied completes unchanged.

**AC-4 — No patch byte enters a retained event, and this is proven at the cap.**
*Test:* a run whose diff is at the configured maximum. Neither the gate question, nor any frame on
the live stream, nor any retained event contains the patch or grows with its byte length. The
retained-event count remains 500. This criterion is the one the 4 MiB subscriber ceiling
(`serve.ts:57`, `:185`) makes load-bearing, and §6 names it as not eligible for trimming.

**AC-5 — One read-only route, keyed by run handle and opaque gate id.**
While a gate is pending the daemon answers a **GET** identified by the run handle and the gate's
`gateId`. It accepts no git range, ref, filesystem path or step id from the browser. The path is
built in `daemon-endpoints.ts` and the request issued in `daemon-client.ts`, the two modules that
already own those two acts. **No `WRITE_RULES` row is added**: the boundary Q-0130 widened stays
exactly where it is.
*Test:* the route answers for a pending gate of that handle; a `gateId` belonging to another run is
refused rather than served, the distinction `gates.ts:103` already draws; `POST`, `PUT`, `PATCH` and
`DELETE` remain unrouted on it; the registered-route set is asserted by the derivation
`package.test.ts` already performs rather than by a count.

**AC-6 — The evidence lives exactly as long as the gate that owns it.**
Released when that gate leaves the pending registry and when the host shuts down. Reconnecting does
not duplicate it; repeated reads while the gate is pending return the same snapshot. It is never
presented as run history or as persistent state.
*Test:* answering the gate releases it; shutdown releases it; two reads return identical bytes; a
second gate's evidence does not survive the first's release.

**AC-7 — The route's four outcomes are distinct.**
Evidence available; no such run; the gate is not pending; the gate's deciding step read no diff.
None of the last three returns an empty successful patch, and none reveals another run's or gate's
evidence. Existing daemon error-envelope conventions are reused.
*Test:* one case each, each asserting a distinguishable condition. **An unreadable or failed case is
never rendered as "no diff"** — *"A probe that could not answer is not a negative"* (2026-09-10).

**AC-8 — The screen renders the diff where a reader is answering from.**
For a pending gate whose deciding step had a diff, a region after the verdict, findings and summary
and before the answer controls, headed with the deciding step and carrying the range. The existing
controls and their availability are unchanged.
*Test:* rendered from a fixture; the step id and range assert against it; the controls render
identically to before.

**AC-9 — The patch is rendered as a patch, and as text.**
Every retained file header and hunk in source order. Added lines, removed lines, context lines, hunk
headers and file metadata are distinguishable **without relying on colour alone**. Patch text is
never markup: no `dangerouslySetInnerHTML` and no Markdown renderer, both already forbidden
(`source.test.ts:982`, `:977`). Tabs and spaces stay distinguishable, and a long line can be
inspected without widening the page or hiding its tail.
*Test:* a constructed fixture carrying additions, removals, context, a rename, a binary file, a very
long line and an unrecognised patch line. Each renders without loss; a line of patch text containing
markup renders as text.

**AC-10 — Truncation is disclosed from the reviewer's own measurement, in both shapes.**
The browser renders the truncation outcome produced by the **same** materialisation that fed the
step; it applies no second cap. Where the patch was cut it states the configured limit and the
retained byte count and **names every file for which no patch was retained** — the list
`diff.ts:420-428` already computes and Q-0124's `warn` already carries. Where the cut landed inside
a file everyone can see, it says **that** rather than printing an empty list, the distinction
`diff.ts:383-386` already draws. A truncated patch is never labelled complete. The `diff truncated
range=` log token, the `warn`, the head-only cap and the UTF-8 boundary handling are preserved —
that token is load-bearing, `diff.test.ts`'s AC-9.5 counting materialisations off it.
*Test:* three fixtures — untruncated, truncated with no wholly-absent file, truncated with several.
A test compares the two consumers and proves the prompt's disclosure and the browser's agree.

**AC-11 — Every other state is a sentence, and none is an absence.**
A gate whose deciding step read no diff says so, and says it is not a claim that nothing changed —
**four of the six shipped flows declare no `input.diff` at all**, so this is the common case. A gate
with no `reached` keeps its existing sentence and no diff is attributed to a step. While the read is
in flight the screen says what it is reading; if it fails it shows the daemon's condition and offers
to retry **that read alone**. A failed, stale or superseded read never clears, enables, disables or
submits a gate answer, and a response for an earlier handle or gate cannot replace the current
screen's evidence — the generation guard the screen's existing run read already uses.
*Test:* one case each. No rendered state is a blank panel, a spinner or a skeleton, per
`docs/04-architecture.md`'s rule — *"No placeholder is a blank panel, a spinner or a skeleton, and
none shows a fabricated project, run, ticket or cost"* — **cited by its words, never by a line
number, which has now moved four times**.

**AC-12 — No file under `apps/web/src` coerces a string to a number.**
`COERCES_TO_NUMBER` (`source.test.ts:226`) stays exactly as Q-0131 landed it. Byte counts, line
counts and limits are read as typed values, never parsed out of prose. **This ticket is the first
plausible caller of that clause's own escape hatch — *"NARROW this clause deliberately rather than
overriding it"* (`:301`) — and it does not use it.**
*Test:* the clause passes unamended over the changed corpus and its evasion fixture still fires.
**A narrowing of it fails this criterion whatever else passes.**

**AC-13 — The three successor needles are re-aimed, and what did not land stays forbidden.**
`SUCCESSOR = ['dif'+'f', 'block'+'er', 'hun'+'k']` (`source.test.ts:1064`) is a case-insensitive
word-boundary scan over `gate-screen.tsx`. Each needle that retires does so because the screen now
has that subject, and each is replaced by a clause over the shipped behaviour rather than deleted;
`blocker` stays forbidden if the severity vocabulary is still imported and never spelled, for the
reason that test's own comment gives. The retired placeholder sentence (`:1050`) stays absent,
including assembled from fragments. `routes.ts`'s gate row stops routing this to a ticket by id.
`gateAnswerSchema` and `gateAnswerEnvelopeSchema` are untouched — the answer set stays the closed
three.
*Test:* each surviving needle still matches its fixture; each retired one is shown present in the
screen; deleting the diff region turns a clause red; the routes clause set is re-aimed and each
clause shown red on its own.

**AC-14 — The renderer is justified where this package justifies dependencies, and three documents
move.**
If an external parser or renderer is added it is a small, maintained, non-deprecated `apps/web`
**devDependency** — the package declares no `dependencies` key — carrying a reason in
`JUSTIFICATIONS` (`apps/web/test/package.test.ts:45`), which is checked in both directions. Measured
served-bundle sizes before and after are recorded against the baseline **352,894 B JavaScript and
10,599 B CSS**; no asset is fetched over the network at runtime. If none is added, the solution
document says how every case in AC-9 and AC-10 is handled. `docs/05-design-prompt.md:49`'s clause
routing this to a ticket by name is discharged, `docs/04-architecture.md` describes the route, the
evidence source, its lifetime and the truncation disclosure, and
`contracts/Q-0050/run-events.contract.md` gains a note recording that the evidence deliberately does
**not** travel on the event union.
*Test:* the manifest and register agree in both directions; the design prompt carries no live
sentence saying the screen shows no region for this; the architecture document's route list is
asserted against the daemon's derived route set rather than against prose.

---

## 4. Non-goals

1. **Adding any field to the event union**, `reached` included — `events.ts:206-209` and
   `events.test.ts:239` both refuse it, and this design does not need it.
2. **Re-running `git diff`, or resolving either ref, when the screen is opened.** A second
   measurement after refs may have moved could show a diff the reviewer never saw.
3. **A general diff endpoint**, or any range, ref or path supplied by the browser.
4. **Changing `repo.max_diff_bytes`, the head-only truncation algorithm, file ordering or the
   warning grammar.**
5. **Deciding whether a truncated review may approve.** That is **Q-0128's** in as many words.
6. **Persisting a second copy of the patch** in the backlog or in run history; the manifest format
   and the two-file occurrence directory are unchanged.
7. **Diffs for ended historical runs.** This ticket is evidence attached to a pending gate.
8. **Durability across a daemon restart**, which is Q-0019's premise.
9. **Widening the gate answer set**, or adding a reason field.
10. **Side-by-side mode, syntax highlighting, comments, file navigation, download or editing.**
11. **Live updates to the gate screen**; its existing explicit refresh behaviour stands.
12. Mission control (Q-0015), the ticket page (Q-0127), run history (Q-0018), the CLI, the adapter
    contract, flow files and the ticket schema.

---

## 5. Open questions

**OQ-1 (BLOCKING — human, before the implement step runs). The decision entry the transport owes.**
The daemon will hold up to `max_diff_bytes` of in-flight evidence per pending gate, keyed by opaque
gate identity, and serve it from a new route — against `.claude/rules/engineering.md`'s *"Files are
the database … no hidden state in the daemon"*, and beside Q-0123's four-day-old ruling that a run
record is never released. An entry is owed, it is work **no step on the chore route may write**, and
**AC-3, AC-5 and AC-6 are unsatisfiable without it**. What it must rule: that reviewed patch bytes
are fetched on demand by opaque gate identity and excluded from every retained event; that the two
refused alternatives are embedding them in the gate question (refused on §0.2's arithmetic and the
4 MiB ceiling, which makes it a functional break) and re-deriving at read time (refused because it is
a second measurement, not on cost); and what bounds the daemon's hold. The precedent for launching
without it is unambiguous and days old — Q-0126 round 1 returned `blocked`, Q-0062 spent three
implement rounds and most of $88.49 on an entry its own requirement had said must exist first.
**Verify by grep that it appears in the implement step's own `prompt.txt`**, which is the check
Q-0097 lost two errata by not making and which Q-0125 and Q-0129 both performed.

**OQ-2 (BLOCKING — gate). Ratify the cut before an implementer reads a document scoped to it.**
This document is **one ticket at fourteen criteria that renders the patch**, and it refuses both
candidates' cuts: codex's 22 for size, claude's summary-only 14 because it leaves the headline for a
third ticket and splits one truncation fact across two transports. The argument for one ticket is
§0.3 — the summary is not a separate transport problem once the patch is behind a route, because
`materialiseDiff` already returns the stat, the patch and the notice as one string. **If the gate
prefers claude's split**, this document is not the requirement for it and should be re-scoped rather
than trimmed. **If the gate takes one ticket**, it should do what Q-0122's E-1 did: accept fourteen
deliberately and name the seam in advance — **the seam is AC-9's rendering fidelity**, and the remedy
on exhaustion is a second erratum splitting it, not a further implement round.

**OQ-3 — non-blocking, for solutioning.** Whether a measured external renderer satisfies AC-9 at an
acceptable bundle cost, or the required subset is safer written by hand. **Not blocking and owing no
entry**: `apps/web` already bundles React and Tailwind as devDependencies named in
`04-architecture.md`, and `JUSTIFICATIONS` is the established mechanism, so this is a choice the
architect may make. Either answer must satisfy the same tests, and AC-14 requires the measurement
either way.

**OQ-4 — answered here, not asked.** *Where the region sits.* After the decision and before the
controls (AC-8): `gate-screen.tsx` sites the decision above the controls *"because it is what a
reader is answering FROM"*, and the evidence is what the decision was about. Not left for a gate.

**OQ-5 — answered here.** *Which git atom.* None. The evidence is the section `materialiseDiff`
already produced; nothing derives a second view of it, and `--stat`'s 27% path elision and its
combined per-file number are reasons not to parse it rather than a reason to choose another reader.

---

## 6. Risks

**R-1 — The 89% case is invisible to any test written the obvious way.** §0.1. **AC-1 is the
mitigation and may not be trimmed**; it is the only criterion whose subject no existing guard
reaches. Named in advance on Q-0122's precedent.

**R-2 — There is nothing in this backlog to demonstrate against.** 42 of 42 integration branches are
contained in `main`, so `{base}...integration` and `integration...implement` are **empty for every
ticket here**. All acceptance evidence is a repository the tests build — `git.test.ts`'s shape,
setting any identity it needs so no verdict depends on the machine
(*"A test's verdict is a property of the commit"*, 2026-08-30) — and **no gate demonstration may use
a past ticket**. Q-0077's subject arriving as a sequencing fact.

**R-3 — Holding the bytes in both core and the daemon would double the memory the entry is about.**
One bounded snapshot per pending gate, transferred rather than copied, with release tested on every
gate-removal path (AC-6).

**R-4 — This ticket's own review will be truncated, and the files at risk are its own.** Recent
tickets were cut at 200,000 bytes and `git diff` orders by path, so `packages/shared/` and
`wire.ts` sit in the alphabetical tail — `events.ts` is exactly the file Q-0129's four reviews
received no patch for, four times running. Q-0124's `warn` will name them and Q-0117's
`observation:` channel gives the reviewer somewhere to say so; that pair has composed on three
consecutive tickets. **A hand pass over the omitted files is owed at the gate regardless** (GO-4):
on Q-0017 three clean reports over a truncated diff hid three real findings.

**R-5 — A first-round approve should be distrusted.** 74% of chore reviews return `revise`, and the
last five tickets each recorded a reviewer disclosing it could not execute the suite under
`--sandbox read-only`. Mutate rather than bank (Q-0051).

**R-6 — Truncation disclosure drifting from the reviewer's.** The single-transport design is the
structural defence — one snapshot, one measurement — and AC-10's two-consumer comparison is the
check.

---

## 7. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no credential, no environment read; no fixture or doc example names a key. |
| **Worktree safety** | Nothing writes to the user's tree. The snapshot is taken from a read `materialiseDiff` already performs. |
| **Gate behaviour** | The answer set stays `advance | retry | abort`; `gateAnswerEnvelopeSchema` stays strict and gains nothing. Showing a truncated diff neither permits nor refuses an answer. Human-gated by default is unaffected; an `auto` gate emits no question and is served nothing. |
| **File format and schema** | No event-union change, no manifest change, no ticket or flow schema change. One new wire shape for the route's response, declared in `@quorum/shared` and parsed rather than cast. |
| **Lint rules** | None added. `validDiffRange` (`lint/lint.ts`) and its runtime twin (`diff.ts:319-332`) are untouched: this serves only a range they already admitted. |
| **Cold-clone impact** | One devDependency at most, bundled rather than installed at runtime, measured against 352,894 B JS / 10,599 B CSS. Workspace-local and packed installs both still build and serve offline. |
| **Files are the database** | Nothing new is persisted. What is new is in-flight daemon state with a gate-scoped lifetime, which is precisely what OQ-1's entry must rule. |
| **Errors are explicit** | AC-7. A failed read is never rendered as "no diff". |
| **Product-agnostic** | n/a. |

---

## 8. Gate obligations

**GO-1 — Land OQ-1's entry before the chore run and verify it reached the implementer**, by grep over
`.quorum/runs/<run>/steps/001-implement/prompt.txt`, by title and date.

**GO-2 — Rule OQ-2 explicitly**, and if one ticket is taken, record the accepted size and name AC-9
as the seam, Q-0122 E-1's shape.

**GO-3 — Write the `contracts/Q-0050/run-events.contract.md` note by hand at this gate.** That folder
is not among `developer-generalist`'s roots — it cost Q-0129 an implement round yesterday and Q-0131
avoided it by doing exactly this.

**GO-4 — Hand pass, cross-vendor, over every file the review received no patch for**, recording what
it found including nothing. R-4.

**GO-5 — Discharge by running the product and transcribing what it rendered.** A real daemon from
`quorum open`, a run started **through the daemon** — a `quorum run` is a process the host can never
see (Q-0121) — parked at a real gate, opened in a browser, and the diff region transcribed into
`runs.log` verbatim, including a truncated case. **The standard is Q-0016's failure**: its GO-6 asked
for exactly this and was reported discharged when the by-hand half had not been performed, which
Q-0015's gate found a day later. Because R-2 means no ticket here has a non-empty range, say in
`runs.log` how the range was built.

**GO-6 — Verify forced in both environment rows** (Q-0072): a detached worktree with neither
`.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, plus `quorum lint` and the
git-identity sweep.

---

## 9. Provenance

**candidate-claude contributed** the finding this document is built on — that `chore`'s review range
is deferred and never enters `ctx.diffInputs`, which is 186 of 208 real materialisations (AC-1, §0.1)
— the siting rule that follows from it, the `--stat` elision and combined-number measurements (OQ-5),
the `COERCES_TO_NUMBER` collision and the ruling not to use its escape hatch (AC-12), the
`events.test.ts:239` pin, the gate-obligation discipline with its precedents (GO-1, GO-3, GO-4, GO-5),
and the `reportRunNumber` channel identification (AC-3). Its 100x size measurement is the reason the
transport question exists; its **cut** is refused (§0.3).

**candidate-codex contributed** the transport answer this document adopts — bytes off the retained
event, one read-only route keyed by run handle and opaque gate id (AC-5) — and with it the lifetime
criterion (AC-6), the four route outcomes (AC-7), the patch-rendering criterion (AC-9), the
prompt-versus-browser truncation agreement (AC-10), the stale-response and loading-state discipline
(AC-11), the transport-size regression at the cap (AC-4), the no-remeasurement property (AC-2), the
constructed-repository evidence rule (R-2) and the dependency/bundle measurement (AC-14). Its
**size** — 22 criteria — is refused, and it does not name the deferred-diff path anywhere.

**The merge is neither candidate's shape.** Both proposed carrying something on the gate question;
this carries nothing there, which is what lets one ticket deliver the patch and the summary from one
snapshot with one account of truncation, and what keeps `events.ts`'s *"not the beginning of a
family"* clause honoured by not touching the union at all.

**Measured against tip `863c900` on 2026-09-17**, before anything was written: the 828-prompt /
208-diff corpus and its size, range and elision censuses; 42-of-42 containment by
`git merge-base --is-ancestor`; constants read in place at `diff.ts:372`, `serve.ts:47` and `:57`;
`chore.yaml`'s and `review.yaml`'s step sequences read from the flow files; the guard registers read
at `source.test.ts:226`, `:1050`, `:1064`; the gate registry at `gates.ts:85`, `:103`, `:110`; the
callback channel at `engine/types.ts:122-129`; `apps/web`'s manifest and `JUSTIFICATIONS`; the bundle
from `apps/web/dist`. **What I did not do:** run the suite, nothing here changing code; and I read
neither candidate's measurements as evidence — each figure above was re-derived, which is how the
"three steps after the review" correction and the 52-versus-56 elision difference surfaced.
