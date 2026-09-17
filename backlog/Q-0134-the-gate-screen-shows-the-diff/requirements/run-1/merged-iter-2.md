# Q-0134 — The gate screen shows the diff

*Merged requirement, run 1, iteration 2. Measured against tip `2a5a909` on 2026-09-17.*

---

## 0. What iteration 2 measured, and what it changes

**The tree has not materially moved.** The tip is `2a5a909`, whose parent is the `863c900` both
candidates and iteration 1 measured against, and whose only content is the ticket-body
re-measurement itself. `docs/decisions/` ends at **097**. No `requirements/errata.md` exists. So
this is a retry on an unchanged tree, and the discipline that applies is the one this repository has
recorded five times: *a retry on an unchanged tree cannot rule its own blocker* — **unless the
blocker was a question about the tree that the document can answer by measuring the tree it already
had**, which is Q-0105's remedy and what happened here.

**Both of iteration 1's blockers dissolve on the merits.** Neither reversal is a softening; each is a
measurement iteration 1 did not make.

### 0.1 OQ-1 is ruled, not asked: no decision entry is owed

Iteration 1 blocked on an entry because the daemon would hold up to `max_diff_bytes` of in-flight
evidence, against `harness/rules.md:59-60`'s *"Files are the database … The daemon holds no hidden
state"* and beside Q-0123's ruling. **That argument rested on an arithmetic its own chosen design had
already removed.**

The 200,000-byte cap against a 214 B mean event, `DEFAULT_RETENTION` = 500 (`serve.ts:47`) and the
4 MiB subscriber ceiling that closes a socket with `1013` (`serve.ts:57`, `:185`) are all reasons the
bytes may not ride on the **gate question**. They are why this design puts them on a route instead.
**Once the bytes are off the event union, not one of those three numbers reaches them**: nothing
enters the retained buffer, nothing is replayed to a late subscriber, nothing is re-sent on
reconnect.

What remains is one bounded snapshot per **pending gate**. Measured in the code:

- `gates.ts`'s `answer()` **deletes the gate before it settles it** — *"the delete and the settle are
  one step with no await between them"*.
- `gates.ts`'s `release(handle)` **forgets a whole run's gates**, and `host.ts` already calls it at
  **two** sites (`:293`, `:342`).
- `records.delete` and `records.clear` appear **nowhere** in `packages/server`, so a gate-keyed hold
  does not touch Q-0123's source guard.

So the lifetime mechanism is existing, tested machinery, and the thing this ticket adds is
**released**, where the thing Q-0123 measured at ~0.1 MB per ended run and ruled acceptable is
**not**. Each limb of the design has its own recent precedent for owing no entry:

| limb | precedent | ruling |
| --- | --- | --- |
| a read-only route on the daemon | Q-0119 (five routes), **Q-0121 GO-1** (two routes) | *"no decision entry is owed and the document edit is"* |
| bounded in-flight daemon memory | **Q-0123** | measured and ruled; *"No decision entry is owed and none was written"* |
| an out-of-band `RunFlowOptions` callback | **Q-0131 GO-1** | ruled to owe none **because a callback is not an event** |

And the test this repository actually applies — *does any landed sentence go false?* — answers no at
every site: the glossary's **Event** term, `events.ts:206-209`'s *"one optional field and not the
beginning of a family"*, decision 097, the glossary's **Occurrence** (*"their exact `prompt.txt` and
`output.txt`"*) and **Run history** are each true verbatim after this change, because nothing is
added to the union and nothing new is persisted.

**Ruled: no entry is owed**, and the ruling is recorded in the route's own authority comment rather
than in a document — Q-0108's precedent, that a ruling changing no behaviour and contradicting no
landed entry belongs in the code's authority comment, and Q-0131's, which is the same act one day
old. **The gate may overrule this**, and GO-1 is written so that costs one erratum rather than a
round; what it may not do is leave it unstated, which is what iteration 1 did.

### 0.2 OQ-2 is ruled, not asked: one ticket, fourteen criteria

Iteration 1 asked the gate to ratify the cut. **Size is this role's judgement** — *"it is the part
nobody else will catch"* — and the instruction is to refuse past fifteen and say where the seam is,
not to ask permission inside the ceiling. Fourteen is inside it. Asking anyway is the same error
Q-0105's B-2 named: leaving a case uncovered that the document could state.

**Ruled: one ticket of fourteen criteria that renders the patch.** The seam is named in advance, per
Q-0122 E-1 — **AC-9, the rendering fidelity** — and the remedy on exhaustion is **a second erratum
splitting the renderer off, not a further implement round**.

Both candidates' cuts stay refused, for the reasons iteration 1 gave and which re-measurement did not
move. **candidate-codex is 22 criteria**, far past the ceiling; the precedent is unanimous and recent
(Q-0013 refused at eighteen and split in three, Q-0122 accepted twenty and paid three implement
rounds, Q-0126 refused a split at sixteen and paid $177.92 with a round-1 `blocked`).
**candidate-claude is a disciplined 14 but delivers a file-and-line summary, not the diff** — it
leaves this ticket's own headline for a third ticket, and it splits one truncation fact across two
transports, which is the drift the ticket body itself warns about. **The split dissolves once the
transport is the route**: `materialiseDiff` already returns the `--stat`, the patch and the
truncation notice as **one string** (`diff.ts:408`), so a summary is not a separate transport problem
and arrives free in the same read, with one account of truncation.

### 0.3 The implementation fact the whole ticket turns on, verified in source

**candidate-claude's finding, confirmed line by line, and it is the most valuable thing either
document produced.**

`preflightDiffs` caches into `ctx.diffInputs` **only** when `endpoints.every(e => e.class ===
'pre-existing')` (`diff.ts:546`). A range holding a step-created endpoint goes to `deferredDiffs`
instead, and `prompt.ts:160-162` then calls `materialiseDiff` inline — `context.diffInputs.get(range)
?? materialiseDiff(…)` — and **does not write it back**. `chore.yaml`'s `implement` is `worktree:
true` on `harness/{id}/implement` (`:6`), which *creates* the right endpoint of `review`'s range at
`:52`. **That range is therefore always deferred and never in `diffInputs`.**

Over every prompt in this repository's run history — 828 prompts, 208 carrying a `## Patch (`
section, counted by the range each names:

| range shape | flow | count | in `diffInputs`? |
| --- | --- | --- | --- |
| `harness/<ID>/integration...harness/<ID>/implement` | `chore` | **186** | **no — deferred** |
| `main...harness/<ID>/integration` | `review` | 20 | yes |
| `<sha>...harness/<ID>/integration` | `review --base` | 2 | yes |

**186 of 208 — 89% — are the uncached path**, and it is the route 55 of this repository's tickets
took. An implementation that reads `ctx.diffInputs` at the gate is correct on `review.yaml`, green in
any test written against it, and **blank on every chore run this product performs**. candidate-codex
does not name this anywhere; its AC-1 is satisfied by reading the cache. This is **AC-1** below, it is
the only criterion whose subject no existing guard reaches, and §6 names it as not eligible for
trimming.

The remedy is Q-0129's siting rule, stated in that ticket's own source at `steps.ts:350-357`: capture
where the value is **produced** — inside `materialiseDiff` (`diff.ts:317`), which **both** paths call.

### 0.4 `materialiseDiff` already holds everything, so nothing new is derived

Read in place, the function already computes and holds, at one site and with **no additional git
spawn**: the interpolated `range`; the `--stat` text; `limit` (`max_diff_bytes ?? 200000`,
`diff.ts:372`); `truncated`; `bytes.length` kept and `full.length` total; and **`omitted`**, the list
`filesAfter` derives for the files with no patch at all. It returns them as one string with a
`## Truncation notice` section.

So the snapshot is a **capture of values already in hand**, not a second measurement — which is what
makes AC-10's *"the browser renders the reviewer's own measurement"* structural rather than a
promise, and why candidate-claude's proposed `git diff --numstat` read is unnecessary (it would be a
third spawn per materialisation).

### 0.5 The needle correction — this ticket re-aims TWO needles, not three

The ticket body's re-measured section says the register is three and that *"This ticket re-aims
**three** needles"*. Measured at `apps/web/test/source.test.ts:1064`, the guard is titled
*"Q-0129 AC-10/AC-12 — three of the six needles retire, and three are the successor's"* and carries
`SUCCESSOR = ['dif'+'f', 'block'+'er', 'hun'+'k']` — **but its own closing comment has already
re-purposed one of them**:

> *"**The severity vocabulary is imported and never spelled here**, which is what the surviving
> `blocker` needle enforces **now that it is no longer about an absent region**"*

followed by `expect(screen()).toContain('FINDING_SEVERITIES')`, which `gate-screen.tsx:51` and `:246`
satisfy through `FINDING_SEVERITIES` and `REPORT_GROUPS`. **That job survives this ticket entirely.**
So `diff` and `hunk` retire because the screen now has those subjects, and **`blocker` stays
forbidden** — retiring it would delete a live rule Q-0129 landed yesterday. candidate-codex's AC-19
would have retired all three. candidate-claude got this right and is credited. AC-13 carries it.

### 0.6 Everything else, re-verified rather than inherited

| claim | verdict |
| --- | --- |
| 42 of 42 `harness/*/integration` contained in `main` | **holds** — so every range in this backlog is empty; R-2 |
| `repo.max_diff_bytes` default 200,000 | **holds** — `diff.ts:372` |
| `DEFAULT_RETENTION` 500, `MAX_BUFFERED_BYTES` 4 MiB, close `1013` | **holds** — `serve.ts:47`, `:57`, `:185` |
| `events.test.ts:239` refuses `reached: {…, diff}` **by name** | **holds**, verbatim |
| the retired placeholder sentence, assembled from fragments | **holds** — `source.test.ts:1050` |
| `apps/web` declares **no `dependencies` key** | **holds** — ten devDependencies, `JUSTIFICATIONS` checked in both directions (`package.test.ts:45`) |
| bundle 352,894 B JS + 10,599 B CSS | **holds** |
| `WRITE_RULES` needles four methods plus `'/gate'` and `'/stop'` | **holds** — a **GET** route adds no row |
| *"`chore`'s gate is three steps after the review"* | **CORRECTED — two.** `implement`(:6) → `review`(:47) → `integrate`(:75) → `gate`(:83). Conclusion unchanged and strengthened: a step that materialises no diff still sits between the reviewer and the gate. |
| diff sites per flow | **measured:** `chore` 1, `review` 2 (byte-identical over one range), and **four flows declare none** — so a gate with no diff is the common case (AC-11) |

---

## 1. Problem

A maintainer at a gate is asked for one irreversible word about a change they cannot see. Since
Q-0129 the screen shows what the reviewing step *decided*; nothing shows what it was *looking at*. So
they leave the browser and reconstruct a git range in a terminal, which is the workflow this product
exists to replace.

Reconstructing it when the screen opens would not be trustworthy. Refs may have moved since the step
ran, a flow may hold more than one `input.diff` site, and `chore`'s gate is two steps past the
reviewer with an `integrate` in between. The screen must show **the exact bounded bytes the reviewing
step was given** — identity, never inference.

There is a second reader-facing defect the gate is the right place to close. Across recent tickets
every review was handed a **truncated** diff; `runs.log` records 29 truncations, the most recent
naming **15 files the reviewer received no patch for at all**. Q-0124 made that loss speak — but it
speaks on the trace, and the one human who can act on *"your reviewer did not see a quarter of this"*
is looking at the gate screen when they decide.

---

## 2. User story

As a **solo maintainer at a parked gate**, I want to see the exact diff the deciding step reviewed —
including, where it was cut, what the reviewer was not shown — so that I can answer the gate without
reconstructing evidence in a terminal and without being shown a change the reviewer never saw.

---

## 3. Acceptance criteria

Fourteen, each independently testable. Numbered continuously, so a criterion keeps its name if the
gate moves the cut.

**AC-1 — The evidence is captured where the diff is produced, which is the only site that covers a
chore run.**
The snapshot is taken inside `materialiseDiff` (`packages/core/src/engine/diff.ts:317`), which both
the preflight path (`diff.ts:546`) and the deferred step-time path (`prompt.ts:160-162`) call, and
after that function's existing range guard has admitted both endpoints. It is **not** read from
`ctx.diffInputs`, which by construction never holds a range with a step-created endpoint. It costs no
additional `git` invocation: the range, `--stat`, `limit`, kept and full byte counts and the
`omitted` list are already in hand at that site.
*Test:* driven over a constructed repository, **both** shapes — a range whose endpoints both
pre-exist, and a range whose right endpoint an earlier `worktree` step creates, which is
`chore.yaml`'s shape and **186 of this repository's 208 real materialisations**. Both yield evidence,
and the deferred one is demonstrated **red** against an implementation that reads `diffInputs`. A
source guard proves no gate-building path reads that map. A test asserts the number of `git`
invocations per materialisation is unchanged.

**AC-2 — The evidence is the reviewing step's, and survives the steps between it and the gate.**
It identifies the deciding step and the interpolated three-dot range. A step that materialises no
diff — `chore`'s `integrate`, which sits between `review` and the gate — does not replace or clear
it, and a gate exposes evidence only where its `reached` decision came from the step the evidence was
materialised for. Where a `parallel:` panel reads one range at byte-identical sites
(`review.yaml:12`, `:19`), the gate carries **one** snapshot, which is Q-0038 AC-10's
identical-bytes guarantee holding at a new site.
*Test:* a flow with an intervening `integrate`; the evidence still names the reviewing step's range.
A two-member panel over one range yields one snapshot. A run with two `input.diff` sites does not
expose the other site's evidence merely because it ran more recently.

**AC-3 — It reaches the caller out of band, and the event union is not widened.**
Delivery is a caller-supplied callback on `RunFlowOptions`, the channel `answerGate` and
`reportRunNumber` already use — *"The same kind of channel as `answerGate`: out of band, supplied by
the caller, and carrying a value no event gains"* (`engine/types.ts:122-129`). **No member of the
event union gains a field**, `gateQuestionEventSchema` and `gateReachedSchema` are untouched, and
`events.test.ts:239`'s refusal of `reached.diff` **by name** stays green unamended — which is how
`events.ts:206-209`'s *"one optional field and not the beginning of a family"* is honoured, by not
touching the union at all.
*Test:* every member of the event union parses byte-identically to before, by the anti-regression
comparison `events.test.ts` already performs; a run started with no callback supplied completes
unchanged.

**AC-4 — No patch byte enters a retained event, and this is proven at the cap.**
*Test:* a run whose diff is at the configured maximum. Neither the gate question, nor any frame on
the live stream, nor any retained event contains the patch or grows with its byte length. The
retained-event count remains 500. This is what the 4 MiB subscriber ceiling (`serve.ts:57`, `:185`)
makes load-bearing — twenty 200 KB events would close the connection with `1013` — and §6 names it as
not eligible for trimming.

**AC-5 — One read-only route, keyed by run handle and opaque gate id, and the no-entry ruling is
recorded where it fires.**
While a gate is pending the daemon answers a **GET** identified by the run handle and the gate's
`gateId`. It accepts no git range, ref, filesystem path or step id from the browser. The path is
built in `daemon-endpoints.ts` and the request issued in `daemon-client.ts`, the two modules that
already own those acts; **no `WRITE_RULES` row is added**, that register needling four methods plus
`'/gate'` and `'/stop'` and this being a GET. The route's own JSDoc carries **one line** recording
that no decision entry is owed and why — a read-only route (Q-0121 GO-1), bounded in-flight daemon
memory (Q-0123) and an out-of-band callback (Q-0131 GO-1) each having been ruled to owe none — per
`.claude/rules/engineering.md`'s one-line-naming-the-authority rule, never transcribed.
*Test:* the route answers for a pending gate of that handle; a `gateId` belonging to another run is
refused rather than served, the distinction `gates.ts` already draws as `not-this-run`; `POST`,
`PUT`, `PATCH` and `DELETE` remain unrouted on it; the registered-route set is asserted by the
derivation `package.test.ts` already performs rather than by a count; `WRITE_RULES` passes unamended.

**AC-6 — The evidence lives exactly as long as the gate that owns it.**
Released when that gate leaves the pending registry and when the host shuts down — the paths
`gates.ts`'s `answer()` (which deletes before it settles) and `release(handle)` already provide, and
which `host.ts` already calls at two sites. Reconnecting does not duplicate it; repeated reads while
the gate is pending return the same snapshot. It is never presented as run history or as persistent
state, and **`records.delete` and `records.clear` stay absent from `packages/server`**, so Q-0123's
source guard is untouched.
*Test:* answering the gate releases it; shutdown releases it; two reads return identical bytes; a
second gate's evidence does not survive the first's release; Q-0123's guard passes unamended.

**AC-7 — The route's four outcomes are distinct.**
Evidence available; no such run; the gate is not pending; the gate's deciding step read no diff. None
of the last three returns an empty successful patch, and none reveals another run's or gate's
evidence. Existing daemon error-envelope conventions are reused.
*Test:* one case each, each asserting a distinguishable condition. **An unreadable or failed case is
never rendered as "no diff"** — *"A probe that could not answer is not a negative"* (2026-09-10), the
class Q-0074 and Q-0115 spent two tickets removing.

**AC-8 — The screen renders the diff where a reader is answering from.**
For a pending gate whose deciding step had a diff, a region after the verdict, findings and summary
and before the answer controls, headed with the deciding step and carrying the range. The existing
controls and their availability are unchanged.
*Test:* rendered from a fixture; the step id and range assert against it; the controls render
identically to before.

**AC-9 — The patch is rendered as a patch, and as text.** *(the named seam — §5 OQ-1)*
Every retained file header and hunk in source order. Added lines, removed lines, context lines, hunk
headers and file metadata are distinguishable **without relying on colour alone**. Patch text is
never markup: no `dangerouslySetInnerHTML` and no Markdown renderer, both already forbidden
(`source.test.ts:982`, `:977`). Tabs and spaces stay distinguishable, and a long line can be
inspected without widening the page or hiding its tail.
*Test:* a constructed fixture carrying additions, removals, context, a rename, a binary file, a very
long line and an unrecognised patch line. Each renders without loss; a line of patch text containing
markup renders as text rather than as markup.

**AC-10 — Truncation is disclosed from the reviewer's own measurement, in both shapes.**
The browser renders the truncation outcome produced by the **same** materialisation that fed the
step; it applies **no second cap**. Where the patch was cut it states the configured limit and the
retained byte count and **names every file for which no patch was retained** — the list `filesAfter`
already computes. Where the cut landed inside a file everyone can see, it says **that** rather than
printing an empty list, the distinction `diff.ts` already draws as *"every file has some patch and
the last one is cut short"*. A truncated patch is never labelled complete. The `diff truncated
range=` log token, the `warn`, the head-only cap and the UTF-8 boundary handling are preserved — that
token is **load-bearing**, `diff.test.ts`'s AC-9.5 counting materialisations off it, and a rewrite
that dropped it would turn a working counter into one matching nothing.
*Test:* three fixtures — untruncated, truncated with no wholly-absent file, truncated with several. A
test compares the two consumers and proves the prompt's disclosure and the browser's agree.

**AC-11 — Every other state is a sentence, and none is an absence.**
A gate whose deciding step read no diff says so, and says it is not a claim that nothing changed —
**four of the six shipped flows declare no `input.diff` at all**, so this is the common case rather
than an edge, in the shape `NO_REACHED` already uses (`gate-screen.tsx:113`, `:372`). A gate with no
`reached` keeps its existing sentence and no diff is attributed to a step. While the read is in
flight the screen says what it is reading; if it fails it shows the daemon's condition and offers to
retry **that read alone**. A failed, stale or superseded read never clears, enables, disables or
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
overriding it"* — and it does not use it.**
*Test:* the clause passes unamended over the changed corpus and its evasion fixture still fires.
**A narrowing of it fails this criterion whatever else passes.**

**AC-13 — Two successor needles retire; the third is no longer this ticket's and stays.**
`SUCCESSOR = ['dif'+'f', 'block'+'er', 'hun'+'k']` (`source.test.ts:1064`) is a case-insensitive
word-boundary scan over `gate-screen.tsx`. **`diff` and `hunk` retire**, because the screen now has
those subjects, and each is replaced by a clause over the shipped behaviour rather than deleted.
**`blocker` stays forbidden and is removed from the successor register**, because Q-0129 already
re-purposed it: its live job is that the severity vocabulary is imported from `@quorum/shared` and
never spelled, which `gate-screen.tsx:51` and `:246` satisfy through `FINDING_SEVERITIES` and
`REPORT_GROUPS` — a job this ticket does not touch. The register's own comment moves with it, so a
reader is not told `blocker` is a successor needle when it is a live rule. The retired placeholder
sentence (`source.test.ts:1050`) stays absent, including assembled from fragments. `routes.ts`'s gate
row stops routing this to a ticket by id. `gateAnswerSchema` and `gateAnswerEnvelopeSchema` are
untouched — the answer set stays the closed three.
*Test:* `blocker` is shown still absent from the screen **and** its severity-import clause still
fires; each retired needle is shown present in the screen; deleting the diff region turns a clause
red; each re-aimed clause is shown red on its own; the routes clause set is re-aimed and each clause
shown red on its own.

**AC-14 — The renderer is justified where this package justifies dependencies, and three documents
move.**
If an external parser or renderer is added it is a small, maintained, non-deprecated `apps/web`
**devDependency** — the package declares no `dependencies` key — carrying a reason in
`JUSTIFICATIONS` (`apps/web/test/package.test.ts:45`), which is checked in both directions. Measured
served-bundle sizes before and after are recorded against the baseline **352,894 B JavaScript and
10,599 B CSS**; no asset is fetched over the network at runtime. If none is added, the solution
document says how every case in AC-9 and AC-10 is handled. `docs/05-design-prompt.md`'s clause
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
4. **Changing `repo.max_diff_bytes`, the head-only truncation algorithm, file ordering or the warning
   grammar**, and applying any second cap in the browser.
5. **Deciding whether a truncated review may approve.** That is **Q-0128's** in as many words.
6. **Persisting a second copy of the patch** in the backlog or in run history; the manifest format
   and the two-file occurrence directory are unchanged, so the glossary's **Occurrence** term stays
   true verbatim.
7. **Diffs for ended historical runs.** This ticket is evidence attached to a pending gate.
8. **Durability across a daemon restart**, which is Q-0019's premise.
9. **Widening the gate answer set**, or adding a reason field.
10. **Side-by-side mode, syntax highlighting, comments, file navigation, download or editing.**
11. **Live updates to the gate screen**; its existing explicit refresh behaviour stands.
12. Mission control (Q-0015), the ticket page (Q-0127), run history (Q-0018), the CLI, the adapter
    contract, flow files and the ticket schema.

---

## 5. Open questions

**None blocks solutioning.** Iteration 1's two blockers are ruled in §0.1 and §0.2 rather than
carried; what remains is stated, which is Q-0105's remedy.

**OQ-1 — for solutioning, and it is the named seam.** Whether a measured external renderer satisfies
AC-9 at an acceptable bundle cost, or the required subset is safer written by hand. **Not blocking
and owing no entry**: `apps/web` already bundles React and Tailwind as devDependencies named in
`04-architecture.md`, and `JUSTIFICATIONS` is the established mechanism checked in both directions, so
this is a choice the architect may make. Either answer must satisfy the same tests, and AC-14
requires the measurement either way. **This is the seam named in advance** (§0.2): if the review loop
exhausts on rendering fidelity, the remedy is a second erratum splitting AC-9 into its own ticket,
not a further implement round.

**OQ-2 — answered here, not asked.** *Where the region sits.* After the decision and before the
controls (AC-8): `gate-screen.tsx` sites the decision above the controls *"because it is what a
reader is answering FROM"*, and the evidence is what the decision was about.

**OQ-3 — answered here.** *Which git atom produces the summary.* None. The evidence is the section
`materialiseDiff` already produced, and every value a summary needs is already in hand at that site
(§0.4) — so no `--numstat` read is added. `--stat`'s 27% path elision and its combined per-file
number are reasons not to **parse** that text rather than a reason to choose another reader.

**OQ-4 — answered here.** *Whether the snapshot is capped for the browser.* No. Capping again would
create a second truncation account, which is the drift the ticket body warns about; AC-10's
single-measurement rule is the structural defence.

---

## 6. Risks

**R-1 — The 89% case is invisible to any test written the obvious way.** §0.3. **AC-1 is the
mitigation and may not be trimmed**; it is the only criterion whose subject no existing guard reaches.
Named in advance on Q-0122's precedent.

**R-2 — There is nothing in this backlog to demonstrate against.** 42 of 42 integration branches are
contained in `main`, so `{base}...integration` and `integration...implement` are **empty for every
ticket here**. All acceptance evidence is a repository the tests build — `git.test.ts`'s shape,
setting any identity it needs so no verdict depends on the machine (*"A test's verdict is a property
of the commit"*, 2026-08-30) — and **no gate demonstration may use a past ticket**. Q-0077's subject
arriving as a sequencing fact.

**R-3 — Holding the bytes in both core and the daemon would double the memory §0.1 measured.** One
bounded snapshot per pending gate, transferred rather than copied, with release tested on every
gate-removal path (AC-6).

**R-4 — This ticket's own review will be truncated, and the files at risk are its own.** Recent
tickets were cut at 200,000 bytes and `git diff` orders by path, so `packages/shared/` and `wire.ts`
sit in the alphabetical tail — `events.ts` is exactly the file Q-0129's four reviews received no
patch for, four times running. Q-0124's `warn` will name them and Q-0117's `observation:` channel
gives the reviewer somewhere to say so; that pair has composed on three consecutive tickets. **A hand
pass over the omitted files is owed at the gate regardless** (GO-4): on Q-0017 three clean reports
over a truncated diff hid three real findings.

**R-5 — A first-round approve should be distrusted.** 74% of chore reviews return `revise`, and the
last five tickets each recorded a reviewer disclosing it could not execute the suite under
`--sandbox read-only`. Mutate rather than bank (Q-0051).

**R-6 — The no-entry ruling is a judgement, and the gate may disagree.** §0.1 states its three
precedents and its test. If the gate rules an entry owed, the remedy is **an erratum at this gate
naming it, landed before the chore run** — cheap, and the one window an erratum has. What must not
happen is the implement step discovering the question mid-loop, which is Q-0126 round 1's `blocked`
and Q-0062's three rounds.

---

## 7. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no credential, no environment read; no fixture or doc example names a key. |
| **Worktree safety** | Nothing writes to the user's tree. The snapshot is a capture of values a read `materialiseDiff` already performs. |
| **Gate behaviour** | The answer set stays `advance / retry / abort`; `gateAnswerEnvelopeSchema` stays strict and gains nothing. Showing a truncated diff neither permits nor refuses an answer. Human-gated by default is unaffected; an `auto` gate emits no question and is served nothing. |
| **File format and schema** | No event-union change, no manifest change, no ticket or flow schema change, no new run-history artifact. One new wire shape for the route's response, declared in `@quorum/shared` and parsed rather than cast. |
| **Lint rules** | None added. `validDiffRange` (`lint/lint.ts`) and its runtime twin in `diff.ts` are untouched: this serves only a range they already admitted. |
| **Cold-clone impact** | One devDependency at most, bundled rather than installed at runtime, measured against 352,894 B JS / 10,599 B CSS. Workspace-local and packed installs both still build and serve offline. |
| **Files are the database** | Nothing new is persisted. What is new is in-flight daemon state with a **gate-scoped** lifetime, released by machinery that already exists — shorter-lived than the run records Q-0123 measured and ruled, which is §0.1's ruling. |
| **Errors are explicit** | AC-7. A failed read is never rendered as "no diff". |
| **Product-agnostic** | n/a. |

---

## 8. Gate obligations

**GO-1 — Ratify or overrule §0.1's ruling that no decision entry is owed, at this gate.** If the gate
overrules, land the entry **before** the chore run and verify by grep that it appears in the implement
step's own `prompt.txt` — the check Q-0097 lost two errata by not making and which Q-0125 and Q-0129
both performed. If the gate ratifies, nothing is written and the ruling lives in the route's authority
comment (AC-5), Q-0108's and Q-0131's shape.

**GO-2 — Ratify §0.2's cut**, recording the accepted size and naming **AC-9** as the seam, Q-0122
E-1's shape, with a second erratum rather than a further implement round as the remedy on exhaustion.

**GO-3 — Write the `contracts/Q-0050/run-events.contract.md` note by hand at this gate.** That folder
is not among `developer-generalist`'s roots — it cost Q-0129 an implement round two days ago and
Q-0131 avoided it by doing exactly this.

**GO-4 — Hand pass, cross-vendor, over every file the review received no patch for**, recording what
it found including nothing. R-4.

**GO-5 — Discharge by running the product and transcribing what it rendered.** A real daemon from
`quorum open`, a run started **through the daemon** — a `quorum run` is a process the host can never
see (Q-0121) — parked at a real gate, opened in a browser, and the diff region transcribed into
`runs.log` verbatim, **including a truncated case**. **The standard is Q-0016's failure**: its GO-6
asked for exactly this and was reported discharged when the by-hand half had not been performed,
which Q-0015's gate found a day later. Because R-2 means no ticket here has a non-empty range, say in
`runs.log` how the range was built.

**GO-6 — Verify forced in both environment rows** (Q-0072): a detached worktree with neither
`.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, plus `quorum lint` and the
git-identity sweep.

---

## 9. Provenance

**candidate-claude contributed** the finding this document is built on — that `chore`'s review range
is deferred and never enters `ctx.diffInputs`, which is 186 of 208 real materialisations (AC-1, §0.3)
— the siting rule that follows from it, the `--stat` elision and combined-number measurements (OQ-3),
the `COERCES_TO_NUMBER` collision and the ruling not to use its escape hatch (AC-12), the
`events.test.ts:239` pin, the gate-obligation discipline with its precedents (GO-1, GO-3, GO-4, GO-5),
the `reportRunNumber` channel identification (AC-3), and **the correct reading of the `blocker`
needle** (AC-13), which the ticket body and candidate-codex both got wrong. Its ~100x size
measurement is why the transport question exists; its **cut** is refused (§0.2).

**candidate-codex contributed** the transport answer this document adopts — bytes off the retained
event, one read-only route keyed by run handle and opaque gate id (AC-5) — and with it the lifetime
criterion (AC-6), the four route outcomes (AC-7), the patch-rendering criterion (AC-9), the
prompt-versus-browser truncation agreement (AC-10), the stale-response and loading-state discipline
(AC-11), the transport-size regression at the cap (AC-4), the no-remeasurement property (AC-2), the
constructed-repository evidence rule (R-2) and the dependency/bundle measurement (AC-14). Its
**size** — 22 criteria — is refused, and it does not name the deferred-diff path anywhere.

**Iteration 2 contributed** the two rulings that make this `ready` rather than `needs-input`, both by
measurement on an unchanged tree: that the entry iteration 1 blocked on is **not owed**, because the
arithmetic behind that blocker stops applying the moment the bytes leave the event union, and because
a read-only route, bounded in-flight daemon memory and an out-of-band callback each have a precedent
from the last week that ruled no entry owed (§0.1); and that the cut is **this role's** to make
inside its own ceiling rather than the gate's to ratify (§0.2). It also corrected the needle register
from three to two (§0.5), the chore step distance from three to two (§0.6), and retired
candidate-claude's proposed `--numstat` read as an unnecessary third git spawn (§0.4).

**The merge is neither candidate's shape.** Both proposed carrying something on the gate question;
this carries nothing there, which is what lets one ticket deliver the patch and the summary from one
snapshot with one account of truncation, and what keeps `events.ts`'s *"not the beginning of a
family"* clause honoured by not touching the union at all.

**Measured against tip `2a5a909` on 2026-09-17.** Read in place this iteration: `gates.ts` whole;
`host.ts`'s release sites; `serve.ts:47`, `:57`, `:185`; `diff.ts:300-430` and `:535-570`;
`prompt.ts:150-172`; `engine/types.ts:108-140` and `:272`, `:277`; `events.ts:200-212` and
`events.test.ts:239`; `source.test.ts:220-235`, `:485-505`, `:1040-1080`; `gate-screen.tsx:51`,
`:113`, `:246`, `:372`; `apps/web/package.json` and `package.test.ts:40-60`; every flow file's
`diff:` keys; `http.ts`'s registered routes; `harness/rules.md:59-60`; `docs/decisions/` listing.
**What I did not do:** run the suite, nothing here changing code; and I read neither candidate's
measurements as evidence — each was re-derived, which is how the `blocker` correction and the
step-distance correction surfaced.
