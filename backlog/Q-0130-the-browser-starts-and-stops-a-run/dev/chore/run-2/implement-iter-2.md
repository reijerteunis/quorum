# Q-0130 — implement, run 2, iteration 2

Revision round. **All three review findings were real**, each was reproduced before it was fixed, and
each fix was shown red by mutation. No criterion moved, no new criterion was invented, and nothing
outside `apps/web/src` was touched this round.

`pnpm turbo run lint typecheck test --force --continue` from the repository root: **21 tasks, 21
successful, 0 cached**. `pnpm exec quorum lint` 6/6. `@quorum/web` alone: 20 files, 406 tests.

---

## 1. The three findings, and what each one was

### M-1 — `run-lifecycle.ts:214`, a pending confirmation survives a change of subject

**Confirmed, and worse than the finding's wording.** `confirm` read `subject` — the screen's subject
*now* — as `mine`, while executing `asked.send`, a closure the screen composed for the subject that
was current when the act was *asked* about. So after a navigation the two named different things:
the request went to the ticket that was **left** and its answer was filed under the ticket arrived
**at**, including `onAccepted`, which navigates. And the question itself stayed on the screen,
answerable, under the wrong id.

**It is the ticket page's case specifically**, which is worth recording because it explains why
mission control does not have it: `app.tsx:197` keys `MissionControlScreen` by handle, so a
handle-to-handle navigation **remounts** it; `app.tsx:181` keys `TicketPage` by nothing, so one
instance survives a navigation from one ticket to another and its hook state with it.

**Fixed two ways, as the finding asks — keyed *and* cleared.**

- The act and the subject it was asked about are one capture now, a module-private `Pending<T>`, so
  the request and the name its answer is filed under cannot be two reads a re-render apart.
  `confirm` destructures both out of it; its dependency list is `[asked]` rather than
  `[asked, subject]`, which is the mechanical statement that it no longer reads a later answer to a
  question the closure had already settled.
- A confirmation is dropped **in the render that changes the subject**, not in an effect. That is
  `ticket-page.tsx`'s own `loadedFor` reasoning applied one layer in, and its comment already states
  why: *"a prop is committed BEFORE the effect that reacts to it runs, so state cleared in an effect
  is cleared one commit too late"*. One commit is enough here — the confirmation is an irreversible
  control and the commit in between is one where it is on the screen and live.

The docblock now says why a confirmation and a request in flight are treated **differently** by a
change of subject, which the old one did not distinguish: a request has been made and completes,
unwithdrawn and unattributed; a confirmation has been made about nothing yet and is an offer to a
reader who is no longer there.

### M-2 — `mission-control-screen.tsx:121`, the confirmation outlives the control

**Confirmed.** `StopControl` drew the control from `metadata.value.state === 'running'` and drew the
confirmation beside it from `mutation.confirming` alone, so a read landing between asking and
confirming took the control away and left the question. A reader could still answer it, and the stop
went to a run the daemon had already said there was nothing to stop.

**Withdrawn rather than hidden**, which is the stronger of the two remedies the finding offers, and
the difference is a real one: a confirmation merely *gated* on the run's state comes back the moment
a later read says `running` again, putting an offer on the screen that nobody made twice. The test
discriminates the two (§2, mutation B2).

The predicate is declared once — `daemonSaysRunning(metadata)` — and read by both the control and
the withdrawal, so *offered* and *still offered* cannot become two predicates that disagree about
one read. It keeps taking the metadata state rather than a boolean, which is what makes a connection
state structurally unable to reach it; AC-8's existing clause is untouched and still passes.

The withdrawal is in render, conditional and self-cancelling (`confirming` is `null` on the
re-render it schedules), which is React's own sanctioned shape for adjusting state during a render
and produced no warning in the suite.

### M-3 — `daemon-client.ts:315`, `startRun` reads the body before checking the status

**Confirmed, and the consequence is the one named.** The order was read-body → check-`ok` →
check-`201`, so a 2xx carrying **no body at all** — a `204`, which is what the other two writes on
this transport answer with — died in the `json()` catch and was reported as *the response body was
not JSON*. True about the read and wrong about the exchange: it sends a reader looking for a parser
defect where what happened is that this page and the daemon disagree about what starting a run looks
like.

**Fixed in the order the finding prescribes**, preserving the refusal path first: a non-2xx reads its
body, because that is where the daemon's own words are; then the status is checked, **before any
success body is read**, exactly as `answerGate`'s and `stopRun`'s status checks are; then the `201`
body is read and parsed. The `200`-carrying-a-valid-run clause is unaffected and still passes — that
case never needed the body either, which is why the check sits where it does.

---

## 2. The mutations, each reverted after

| # | Mutation | Result |
|---|---|---|
| A | `startRun` back to read-body-first | **1 red** — *a bodyless 2xx was reported as a body that failed to parse: expected 'the response body was not JSON' not to contain 'not JSON'* |
| B | the stop withdrawal removed | **1 red** — *the confirmation outlived the control that offered it* |
| B2 | withdrawal removed **and** the confirmation gated on `running` instead (hide, not withdraw) | **1 red** — *a withdrawn confirmation was put back by a later read* |
| C | the subject-change clearing removed | **1 red** — *one ticket's confirmation was left standing under another ticket's id* |
| C2 | C, with that first clause inverted so it passes | **1 red on the NEXT clause** — *a start about the ticket that was left was sent from the one arrived at: expected [ { flow: 'chore', …(2) } ] to strictly equal []* |
| D | the attribution read late (`mine = subject`) rather than paired | **green — see §3(a)** |

B2 and C2 are the ones worth reading. **B2 is what makes the new mission-control clause two clauses
rather than one**: the first half is red if nothing clears the confirmation, and the second is red if
something only hides it, so *withdrawn* is discriminated from *hidden* rather than asserted. **C2
shows the answer clause is red on its own** and not merely red because its neighbour is (Q-0107's
distinction) — and what it prints is the reviewer's finding verbatim: the ticket that was left had
its start sent from the page showing the replacement.

---

## 3. Findings in my own work this round, and cases I did not close

**(a) Mutation D is green, and I am reporting that rather than presenting the pairing as proven.**
With the render-phase clearing in place, `subject` and `asked.subject` are always equal by the time
`confirm` runs, so reading the attribution late instead of from the pending act leaves all 406 tests
passing. I kept the pairing — it is the correct source, it makes the two halves unable to disagree if
the clearing ever changes, and it is what shrank `confirm`'s dependency list — but **no test holds it
red**, and a reviewer should weigh it knowing that rather than discovering it.

**(b) My first draft of the ticket-page test could not fail, and mutation is what caught it.** It
captured the confirm control *before* navigating and clicked the captured node afterwards. That page's
loading branch (`loadedFor !== ticketId`) unmounts the whole region while the replacement ticket is
read, so the captured node is detached, a click on it reaches no handler, and the clause passed
**under the defect**. The shipped version looks the control up after the navigation instead, and C2
above is the proof it now has a subject. This is the class the architecture context warns about first
and I wrote an instance of it while fixing three others.

**(c) The start-side analogue of M-2 exists and I deliberately did not change it.** A ticket-page
Refresh puts the flow listing back in flight, so the start controls disappear for a moment while a
pending confirmation stays on screen and answerable. **It is not the same case, and that is a
judgement a reviewer should check rather than take:** nothing has said the act is pointless — the
ticket, the flow and the dry choice the confirmation names are all still true — and the daemon is the
authority, answering `not-runnable` if the stage has moved, which AC-5's register already renders.
Closing it would mean knowing *which flow* was confirmed, which means widening `RunMutation` for a
case no criterion names and no reviewer found. Reported rather than chosen for.

**(d) R-1's truncation prediction has landed and will land again, measured.** The cumulative branch
diff is **264,374 bytes** against `repo.max_diff_bytes`'s 200,000, so this round's reviewer sees
roughly **76%** of it, and `git diff`'s path ordering puts the same tail behind the cut that round 1's
reviewer named in its observation — `docs/05-design-prompt.md`, `packages/server/src/http.ts`,
`packages/server/src/package.test.ts`, `packages/shared/src/docs.test.ts`,
`packages/shared/src/wire.ts` and `wire.test.ts`, which is **AC-1's own subject**. One thing shrinks
the exposure and is checkable: **none of those six files changed in this round**, so what is behind
the cut is byte-identical to what round 1 inspected directly from the branch. The whole of round 2 is
in `apps/web/src`, in front of the cut.

**(e) The pre-existing lint warning is unchanged and still not mine.**
`packages/core/src/backlog/backlog.ts:448`, an unused eslint-disable directive, last touched by
Q-0127. `packages/core` is untouched here and lint exits 0.

---

## 4. File by file

- **`apps/web/src/run-lifecycle.ts`** — `Pending<T>` added (module-private); `useRunMutation`'s state
  holds it; `ask` records the subject with the act; `confirm` destructures both out of it; the
  render-phase clearing on a subject change; `confirming` reads `asked.act.sentence`. The
  `@param subject` docblock and the paragraph above it rewritten to say what a change of subject does
  to a confirmation as against a request in flight. No change to `RunMutation`, so neither screen's
  props moved.
- **`apps/web/src/mission-control-screen.tsx`** — `daemonSaysRunning` declared once and read by
  `StopControl` and by the screen; the withdrawal in `MissionControlScreen`'s render body; the module
  docblock's Q-0130 paragraph gains the sentence about a confirmation being withdrawn by the same
  answer that withdraws the control.
- **`apps/web/src/daemon-client.ts`** — `startRun`'s ordering: refusal body, then status, then
  success body; its docblock states the check happens before the success body is read and why.
  `answerGate` and `stopRun` are untouched.
- **`apps/web/src/daemon-client.test.ts`** — one test: a bodyless 2xx is the status disagreement, and
  the refusal path still carries the daemon's own condition through (the half the reordering must not
  lose).
- **`apps/web/src/mission-control-screen.test.ts`** — `control()` gains `setRunState` so a read can
  answer differently from the one before it; one test, in two halves, for withdrawal and against
  resurrection.
- **`apps/web/src/ticket-page.test.ts`** — one test: the confirmation is gone after a navigation, and
  what is on the screen is answered rather than only counted.

## 5. What I deliberately left alone

Every criterion of `requirements/merged.md` as round 1 implemented it, every non-goal in §5, both
documents, `packages/shared`, `packages/server`, `apps/web/test/source.test.ts`'s register and its
three anti-vacuity clauses — none of which any finding named, and all of which stay green forced.
`docs/decisions/` is untouched: GO-1 ruled no entry owed and nothing this round reopens that. **GO-4's
demonstration is still the gate's**: an implement step runs in a worktree with no daemon and no
browser, and `runs.log` is the harness's to write.
