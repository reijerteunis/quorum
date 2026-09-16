# Q-0015 — architecture review of `solution/run-2/draft-iter-1.md`

*Review iteration 1, run 2, 2026-09-16. Verdict: **revise**, on one blocker of the kind this review
exists to catch before a development loop pays for it — an assertion that cannot go green, whose fix
lies in a file no task owns.*

> **Read this first if you read nothing else.** AC-6's source clause is red on the tree today and
> no development round can green it, and two other criteria of the same document actively produce
> more violations of it. Everything else here is ordinary revision work. The decomposition is sound,
> the projection contracts are good, and I would be willing to be on call for the design — once the
> loop can converge.

---

## 0. What I verified, so the next reader does not re-derive it

**The contracts are real.** The draft says they "were created in the repository worktree" and they
were: `f1e21b1` on `harness/Q-0015/contracts`, eight files and 162 insertions —
`contracts/Q-0015/mission-control.contract.md`, three new typed stubs at their final paths, and
four extended existing modules. They are committed rather than left dirty, which is what makes them
reviewable at all.

**They are invisible from where this step runs**, which is recorded as an observation rather than a
finding. `harness/flows/solutioning.yaml` gives `architect` `worktree: true` on
`harness/{id}/contracts`; `architecture-review` carries `input.repo: true` and **no worktree**, so
it reads the main checkout, where none of those paths exist. I found them by reading the branch
explicitly. A reviewer that did not would have reported "the contracts do not exist" — a failed
probe read as a proven negative, and it would have been filed against this solution rather than
against the flow.

**Thirteen measurements the draft and the requirement rest on were re-run.** The corpus rule and its
anti-vacuity clauses (`source.test.ts:473–483`); `WRITE_RULES`' six needles and their `permitted`
values; `REQUEST_STATE_KINDS` closed at five (`request-state.ts:40–42`); `WireRun`'s eight fields
and `wireRunListSchema` (`wire.ts:179–181`); the connection lifetime at `app.tsx:103–129`; the
route-register counts AC-14 moves. **All held.** The two AC-14 counts in particular re-derive
exactly: `RAIL` carries one `screenExists: true` today (backlog) and `ROUTES` carries three (board,
ticket page, gate) — so two and five are right.

**One collision I went looking for is not there, and the negative is worth recording.**
`source.test.ts:436–441` forbids reading `.message`, which would have contradicted AC-7's rendering
of the `done` message and AC-5's lane. It is scoped to `gate-screen.tsx` alone, through a `screen()`
helper that throws if that file is absent. Mission control may render messages.

---

## 1. Blocker — AC-6's source clause is red on arrival, and nobody on this route can fix it

AC-6's *Test:* clause reads:

> Plus a source clause over every file under `apps/web/src`: none contains `cost=`, `role=` or
> `verdict=` as a literal, shown to discriminate over a fixture containing `` `cost=$0.123` ``.

**The corpus is every file under `src`, and it may not be narrowed.** `source.test.ts:50–56` says so
in as many words — *"Not 'every file that ships', and not 'every TypeScript file' … a filtered corpus
is a scan answering a narrower question than the one it reports on"* — and `:473–483` pins it with
two discriminating assertions, `toContain('shell.test.ts')` under the message *"a test file under
src is outside the corpus"* and `toContain('theme.css')` under *"a non-TypeScript file under src is
outside the corpus"*. The file's own comment records that the narrowing was a defect **a previous
review corrected**. So a QA agent implementing AC-6 with `sourceFiles()` — the only corpus in that
file — gets the test files too, and is right to.

**And one of them already violates it.** `apps/web/src/backlog-board.test.ts:530`:

```
expect(container.querySelector('[role="progressbar"]'), 'the screen is a spinner').toBeNull();
```

`role="progressbar"` contains the literal `role=`. Measured: that is the **only** match for any of
the three needles anywhere under `apps/web/src`; `cost=` and `verdict=` are clean.

**Which of the two unsatisfiability shapes this is: the fix lies in a file no task owns.** It is a
test file, so it belongs to `qa-red`; the draft states plainly that "every development task below
must not modify `apps/web/src/**/*.test.ts`", and no task lists it. `qa-red` *could* edit it — and
must not: that line is Q-0017's no-spinner assertion, and AC-3 and AC-8 of this very document
depend on the property it holds. Deleting it to green a scan is weakening a shipped guard to satisfy
a new one.

**The second half is worse, because it does not go away when the existing line does.** AC-3 requires
that "no state is a spinner, skeleton, blank panel, colour or disabled control alone" and AC-8
requires the same of nine states in the main region. This repository's only idiom for proving it is
the selector above. Written in that idiom — and it will be, because it is the one that exists —
every such assertion under `src` is a fresh `role=` literal. **Satisfying AC-3 and AC-8 breaks
AC-6.** That is a criterion that cannot hold as written, not a criterion that is merely inconvenient.

**The remedy is one character per needle, and I verified it discriminates both ways.** The needle is
aimed at a browser file *parsing* the `step` message `` `${adapterName}/${model} role=${role}` ``
(`steps.ts:257`) and the `done` message `cost=$0.123`. Anchor it on the parse rather than on the
substring — require the opening quote or regex delimiter:

| needle | `[role="progressbar"]` | `line.split('role=')[1]` |
| --- | --- | --- |
| `role=` (as specified) | **matches** — false positive | matches |
| `'role=` | does not match | **matches** |
| `"role=` | does not match | — |
| `/role=` | does not match | — |

`role="` is present in the ARIA selector but `'role=` and `"role=` are not, because the quote sits
on the other side of the `=`. Keep the corpus whole and move the needle; show it red over a parse
fixture and green over the selector, both directions, and assemble the needles per that file's own
one rule so the scan does not become its own subject.

**What the draft owed here and did not deliver.** The prose contract's *Trace and timeline* section
says "All event messages and stdout lines render as React text" and never mentions the forbidden
literals at all, so AC-6 is only partly contracted. A criterion that cannot hold wants an erratum at
the gate — Q-0121 E-1's shape, where the prose is what moves — and the solution's job was to find it
and say so. The next draft should name it explicitly rather than implement around it.

---

## 2. Majors

**M-1 — the sentences QA must assert against are mostly not frozen.** The contract freezes three:
the ticket-absence sentence, and both loss sentences. It only *describes* AC-3's empty-list sentence
(three clauses), AC-11's five absent-capability sentences, and AC-7's disposition labels — and
AC-11's test needs "the header region's text", an anchor that exists nowhere. So QA writes
assertions encoding wording that T05 and T06 will invent later, independently, and the red tests go
red for wording rather than for behaviour. The remedy is the house idiom and costs nothing: export
the sentences as named constants, exactly as `COST_LEGEND` (`backlog-board.tsx:58`), `GATE_GONE`
(`gate-screen.tsx:89`), `REFUSAL_UNSTATED` (`:138`) and `LOG_HEADING` (`ticket-page.tsx:57`) already
are — all exported so a test asserts against the constant instead of retyping a sentence — and give
the regions `data-*` anchors on the precedent of `data-request-state`, `data-gate-kind` and
`data-answer-state`.

**M-2 — T06 is the whole screen, in one file, and cannot be split later.** It must satisfy AC-6,
AC-8, AC-10, AC-11, AC-12 and the rendering halves of AC-4, AC-5 and AC-7. Its description is a
nine-item list, against `harness/architecture.md`'s *"a task touches one coherent file set and is
describable in a sentence"* and decision 033's *"tasks are small; the fan-out is the unit of
parallelism, not of scope"*. Because ownership here is per file — which is the property that makes
the other eight tasks clean — T06 cannot be divided without dividing the module. Declaring a second
contract module, `mission-control-text.ts`, holding the empty-state sentence, the two loss
sentences, the five disclosure sentences and the disposition labels, makes it two tasks **and**
supplies M-1's anchors. One change closes both.

**M-3 — the fan-out is single-vendor, and the draft says it is not.** Eight of nine tasks are
`frontend` (claude); the ninth is `backend` (codex) and writes two documentation files. The closing
paragraph calls this "a genuine second-vendor pass" — it is not, since no codex task reads or writes
a line of this ticket's code. It is also **structurally forced**: in `harness/architecture.md`'s role
table only `frontend` is granted `apps/*` among the fan-out roles; `backend` has
`packages/core|shared|server`, `harness`, `docs`, `backlog`, and `tooling` has
`packages/core|shared|cli`. Neither can write `apps/web`. That table's own instruction covers this
case — *"where a ticket genuinely cannot be divided that way, say so in the solution rather than
defaulting to `backend`"* — so replace the claim with the measured reason and let the cross-vendor
guarantee rest where it actually rests, on the review panel. Granting a second vendor `apps/` is a
harness change and a decision, and is not this ticket's.

**M-4 — AC-10's byte-level clause is undefined against the sentences the contract freezes.** The two
are *"The daemon omitted N earlier events from this replay."* and *"This browser discarded N earlier
live events to keep the view bounded."* They share the bigram **"N earlier"** and the word
**"events"**, so a QA agent implementing "share no distinguishing phrase" as an n-gram test can
write a clause that fails a correct implementation. Define the property in the contract. *Each
sentence contains a word the other does not* — `daemon`/`replay` against `browser`/`discarded`/
`bounded` — is checkable, unambiguous, and true of both frozen strings.

---

## 3. Coverage — every criterion has a task, and every task has a contract

Checked one at a time. No criterion is unowned; the two gaps are marked.

| AC | tasks | contract | |
| --- | --- | --- | --- |
| 1 landing reads once, never polls | T01, T05, T07 | `daemon-client.ts#fetchRuns`, `#routes-and-reads` | ✓ |
| 2 row order, fields, null ticket | T05 | `#routes-and-reads`, sentence frozen | ✓ |
| 3 five request states, honest empty | T05 | `#routes-and-reads` | ⚠ M-1 |
| 4 one column per `stepId` | T02, T06, T08 | `mission-control-model.ts`, `#trace-and-timeline` | ✓ |
| 5 run-level lane, conservation | T02, T06 | `#trace-and-timeline` | ✓ strong |
| 6 what a column renders / never derives | T02, T06 | partly — **literals clause absent** | ✗ blocker |
| 7 three dispositions | T02, T06 | `StepDisposition`, `#trace-and-timeline` | ✓ strong |
| 8 every non-streaming state, main region | T06 | `#retention-and-disclosure` | ⚠ M-1 anchor |
| 9 bounded list, exact counter, immutability | T03, T02 | `#retention-and-disclosure` | ✓, see N-1 |
| 10 two counters, two sentences | T06 | both sentences frozen | ⚠ M-4 |
| 11 five things it cannot show | T06 | capabilities listed, sentences not | ⚠ M-1 |
| 12 gate link from `pendingGates` | T04, T06 | `#routes-and-reads` | ✓ strong |
| 13 one connection, re-targeted | T07 | not named | ⚠ N-3 |
| 14 write boundary unmoved; registers move | T04, T07, T09 | `#write-boundary` | ✓ |

**No two tasks share an owned file**, verified file by file across T01–T09; all nine declare
`depends_on: []` and form one wave; `RUN_EVENT_RETENTION` is already committed on the contracts
branch, so T03 can import it while T02 is still working. That is the decomposition doing its job.

**The three strongest contracts, named so a later round does not weaken them.** AC-5's conservation
clause — *"every input event occurs exactly once in either the run-activity lane or one step
column"* — is what makes "nothing is dropped" checkable rather than asserted. `StepDisposition`'s
third member puts AC-7's *"never calls a failed step running"* in the **type**, where no round can
collapse it into a neighbour without a compile error. And AC-12's rule that the gate link comes from
`pendingGates` and *"never by observing a gate event"* is right for the late joiner the daemon's
retention exists to serve.

---

## 4. Satisfiability — the rest of the sweep came back clean

Beyond the blocker, I looked for the two shapes the role brief names and found neither:

- **No fix lands in an unowned file.** `views.tsx` is untouched: `app.tsx` selects screens by a
  ternary chain on register constants and every other route falls through to the placeholder, so two
  new branches need nothing from it. `theme.css` has T08. The docs have T09, and `docs/` is in
  `backend`'s granted paths.
- **No assertion is true only during the red phase.** AC-14's register assertions
  (`routes.test.ts:95`, `:125`) are rewritten by `qa-red` to the post-change counts and stay true
  afterwards; they are red until T04 lands, which is what a red test should be.
- **The write boundary genuinely does not move.** I read `WRITE_RULES` and it matches AC-14's
  description exactly, including `'/stop'` at `permitted: null` and the exemptions on
  `daemon-client.ts` and `daemon-endpoints.ts`. The draft's rejection of the stop button — on the
  measurement that nothing produces a run, so the control has no user — is right, and it removes
  four risks for one criterion's worth of scope.

---

## 5. Nits

**N-1 — `RUN_EVENT_RETENTION` is in the wrong module, and its reasoning is nobody's job.** It sits
in `mission-control-model.ts`, whose own JSDoc says it *"deliberately owns no React or transport
state"* — while a retention bound is transport policy, and T03 must import it backwards from the
view-model module T02 owns. Put it in `run-connection.ts`, where the bound is enforced. AC-9 also
requires the constant be *"named in one place in this app with that reasoning recorded beside it"*,
three specific reasons; the stub carries one sentence and neither T02's nor T03's description makes
writing them anyone's work.

**N-2 — T04 falsifies a JSDoc three lines from the row it edits.** `routes.ts:146–148` reads *"The
three rows carrying `ticket: null` … the projects home, the runs landing or settings"*. After T04
assigns `/runs` to Q-0015 there are two. T04 owns the file so it is a one-line fix, but its
description does not mention it, and a comment promising what the code beneath it does not do is the
class this repository records most.

**N-3 — AC-13's properties are contracted only by implication.** One controller re-targeted rather
than replaced, disposal on leaving the run routes, superseded callbacks inert, `GATE_ROUTE` holding
no socket. T07 cites `#routes-and-reads`, which says only that `/runs/:handle` "uses the existing
socket snapshot". The behaviour is at `app.tsx:103–129` and is Q-0016 erratum E-2's ruling; freeze
it so T07 cannot refactor it away with every test still green.

**N-4 — Appendix B's comment correction is assigned to no task.** `run-connection.ts:143–150`
forecasts that "Q-0121 will hold several controllers at once", which Q-0121 did not turn out to be.
T03 owns that file; naming it there is what stops the correction expiring.

**N-5 — the contract resolves an ambiguity the requirement left, and QA should know which way.**
`TraceColumn.vendor` is *"the latest vendor observed on that step's `spawn` or `retry`"*; AC-6 says
only "after a `spawn` **or a `retry`** … supplied one". Latest is a reasonable choice and the
contract is the authority — but the red test must assert *latest*, not *first*, and nothing outside
the contract says so.

---

## 6. What the next draft needs

1. **Name the AC-6 contradiction and propose the erratum**, with the needle fix and both
   discriminating fixtures. Do not narrow the corpus; `source.test.ts` already carries that
   correction, and repeating it would be the defect that file exists to record.
2. **Add `mission-control-text.ts` to the contracts**, exporting the empty-state sentence, the five
   disclosure sentences, the two loss sentences and the disposition labels, and give it its own task
   — which splits T06 and gives QA its anchors.
3. **Define AC-10's byte-level property** in the contract: each sentence holds a word the other does
   not.
4. **Replace the second-vendor claim** with the measured reason: only `frontend` may write `apps/*`.
5. **Fold in the five nits** — move the retention constant, give T04 the JSDoc, freeze AC-13's
   lifetime properties, hand T03 the Q-0121 comment, and say that `vendor` is the latest one seen.

None of these changes the shape of the solution. The seam is right, the projections are the right
abstraction, and once the loop can converge I would let QA start.

---

*Reviewed against `harness/Q-0015/contracts` at `f1e21b1`, and against `main` at `61de8ff`. Every
figure above was taken from the tree during this review; none is transcribed from the requirement,
the draft, or a sibling ticket's entry.*
