# Q-0040 — A gate can say "undecided"

*Requirements, run 1, merged iteration 1. Merged 2026-09-01 against the tree at `a13bd80`.*

Every count, line citation and cost below was re-measured for this document. Where it disagrees
with either candidate — or with the ticket body, including the body's own 2026-09-01
re-measurement — this document is what was measured and the disagreement is named. Three of the
claude candidate's figures moved and one of its conclusions is wrong in a way that changes a
criterion; both are recorded rather than quietly corrected.

---

## Problem

A run that reaches a gate nobody can answer is recorded as a **failed run**, and a failed run's
ticket branch is rolled back. Work the run had already merged and proven green is destroyed because
nobody was at the keyboard.

The concrete shape: a `maintainer` starts a chore run in the evening. `implement` writes code, the
cross-vendor `review` approves it, `integrate` merges `harness/<id>/implement` into
`harness/<id>/integration` and reports `tests=ok`. The run reaches `chore.yaml`'s closing human
gate, finds no TTY and no `--gate-answer` left, and throws. `finish()` classifies the throw as
`'failed'`; `'failed'` is not `finished()`; `resetBranchTo` moves the integration branch back to
where the run found it. In the morning the ticket is at its original stage, the branch has no merge
on it, and `runs.log` says the run failed. The work is recoverable — each task's commits are still
on their own branches — but recovering it is manual, and the record says something untrue about why.

### What it has cost, measured today

**The rollback has fired seven times in this backlog and was wrong four of them.**

| Run | Status | Cause | Rollback correct? |
| --- | --- | --- | --- |
| Q-0008 run 3 | `failed` | gate (human) "Chore owner approves the review" — no answer | **no** |
| Q-0035 run 3 | `failed` | gate (human) "Chore owner approves the review" — no answer | **no** |
| Q-0036 run 4 | `failed` | gate (human) "Chore owner approves…" — no answer | **no** |
| Q-0006 run 13 | `failed` | gate (human) "Integrated branch is green; approve…" — no answer | **no** |
| Q-0006 run 11 | `failed` | `dependency cycle or unknown depends_on among: Q0006-runtime` | yes |
| Q-0033 run 7 | `aborted` | a human answered `abort` | yes |
| Q-0033 run 8 | `aborted` | a human answered `abort` | yes |

The three correct ones are exactly the two shapes the rollback was written for (Q-0033): a run that
genuinely failed, and a run a human deliberately aborted.

**The ticket body names Q-0036 and Q-0035. That is true and it is an undercount** — Q-0008 and
Q-0006 lost a merge each as well, and `backlog/Q-0008…/runs.log:22` records the repair in the
maintainer's own words: *"harness/Q-0008/implement re-merged into harness/Q-0008/integration,
reproducing the rolled-back `6a3f48c`; stage advanced by hand, no engine run completed"*. That line
is the cost of this defect written down at the time.

**Twelve of the twenty-one `failed` terminal records in this backlog are unanswered gates, and they
carry $149.65 of billed work.** Fifty-seven per cent of everything this project calls a failed run
is not a failure. Cost is not the argument — most of that work was kept — but the classification
is: a maintainer scanning `runs.log` or `harness runs` for real failures reads twelve false
positives, and anything that ever counts failures counts them too.

**Correction to the claude candidate, which its own two figures contradict.** Its problem section
says *"twelve of the twenty-five `failed` terminal records"* while its appendix measures `failed`
at 21. Measured now: `run=N failed` appears **21** times, of which **12** name a gate. The 12 split
**8 ordinary `human` gates and 4 `human-locked` exhaustion gates**, and all four exhaustion messages
end `needs an answer and stdin closed without one`, so every one of the twelve is the
`spike/bin/harness.js:96` path. Its `aborted` count is 12, not 11.

### The correction that changes a criterion

The claude candidate concludes that *"the exhaustion gate is the biggest single beneficiary"*.
**By wasted cost it is; by destroyed work it is not, and the difference decides what AC-5's fixture
must look like.** `chore.yaml`'s step order is `implement → review` (loop, `on_exhausted: gate`)
`→ integrate → gate: human`. The exhaustion gate fires **before** `integrate`, so no merge exists
yet and there is nothing to roll back — which is why the three `chore.review` exhaustion failures
left no `rolled-back` line. The destructive case is the **terminal human gate, after `integrate`**,
and there it is 4 of 4.

So the two halves of this ticket have different beneficiaries, and both are real:

- **Classification** (stage, history, exit code, `runs.log`) pays back on all twelve, exhaustion
  gates included — 37 `exhausted` records across this backlog make that the common case.
- **Branch preservation** pays back only where a merge has already happened, which today means the
  post-`integrate` gate. AC-5's end-to-end fixture must therefore move the branch before the gate,
  or it proves nothing.

### Why it is spelled this way, and where the shape resists the fix

`finish()` reads one predicate, `finished(status) = completed || regressed`, in two places
(`spike/src/engine.js:665`, read at `:727` and `:748`; `packages/core/src/engine/lifecycle.ts:20`,
read at `:101` and `:112`). The second read is the head of an `if`/`else`:

```js
if (finished(status)) ticket.meta.stage = stage;              // engine.js:727  stage rule
if (finished(status)) returnObtainedWorktrees(ctx);           // engine.js:748  arm one
else if (ctx.branchHeadAtStart) { … resetBranchTo(…) }        // engine.js:750  arm two
```

Returning the worktrees and rolling the branch back are mutually exclusive **by construction**.
`finished` buys worktrees-returned *and* no rollback; not-`finished` buys rollback *and* worktrees
kept. What an unanswered gate wants — **keep the worktrees and leave the branch alone** — is a
third combination the shape cannot express. **The ticket body's C-3 is correct and is the governing
fact of this ticket: the work is splitting that conditional into independent decisions, and adding
a status is the small part.** Both candidates reached this independently; codex states it as AC-9,
claude as its §5 table, and neither is wrong.

Q-0062's closing entry calls the single predicate a feature — *"one condition and three
consequences, so the inspection story and the cleanup story cannot drift apart"*, and the comment at
`engine.js:661–664` says the same. That property is real and must survive the split, which is what
AC-4's invariant is for; without it this ticket trades a structural guarantee for a convention.

**A second coupling, which neither candidate names.** The rollback is additionally guarded by
`ctx.branchHeadAtStart` being set *and* the branch having actually moved (`engine.js:750–752`;
`lifecycle.ts:112–117`). That is why eight of the twelve gate failures left no `rolled-back` line —
a `requirements` run at `stage=draft→draft` never moves the ticket branch. The fix must not disturb
that guard, and AC-2's failure half is written to catch a change that spares every failure its
rollback by accident.

---

## User stories

**`maintainer`** — I start a run in the evening knowing I will not be there when it reaches its
gate. In the morning I want to answer the gate, not reconstruct the merge the run threw away, and I
want `runs.log` to tell me the run stopped waiting for me rather than that it failed.

**`maintainer`, scripting** — I wrap `harness run` in a shell script. I need to tell "nobody
answered the gate" from "the run failed" by exit code alone, without parsing stderr.

**`adopter`** — my first `npx quorum` run reaches a gate while I am reading the README in another
window. When I come back I want the run's own output to tell me what it is waiting for and that
nothing was lost, not an error that makes me think the tool broke.

`contributor` is not a persona here: nothing below the adapter layer changes.

---

## Surfaces

| Surface | What changes |
| --- | --- |
| `spike/bin/harness.js` | Two "no answer available" throws become a typed refusal; `harness run` gains one exit code. |
| `spike/src/engine.js` | The status vocabulary, the split conditional, the catch that classifies, the catch's re-throw. |
| `packages/core/src/engine/` | `lifecycle.ts`, `routing.ts`, `types.ts`, `engine.ts` — the same changes. |
| `packages/core/src/run-history/manifest.ts`, `packages/core/src/contracts/run-manifest.ts`, `spike/src/contracts.js` | The run-status type and `TERMINAL_STATUSES`. |
| `packages/shared/src/events.ts`, `ticket.ts` | The terminal event union; the history-status JSDoc vocabulary. |
| `contracts/` | Three frozen files — AC-11 and OQ-3. |
| `docs/` | `02-sdlc-pipeline-spec.md` §3.3, `GLOSSARY.md`, one new `decisions/` entry. |
| `backlog/*/ticket.md` | A new value may appear in `history[].status`. No migration; nothing rewrites existing entries. |

**Not `harness/`.** No flow file changes, so `harness lint` is untouched and no flow needs
re-linting. Worth stating, because every recent ticket in this backlog has moved a flow file.

---

## The recommended shape

Stated so the criteria can be read against it. The decision entry (AC-1) ratifies it and may
overrule any of it.

**1. `undecided` is a run status, not a gate answer.** Gate answers stay exactly
`advance | retry | abort`. Nothing is added to what a human or a script may say, so *"Non-auto
exhaustion gates require an explicit human or scripted answer"* (2026-08-23) is untouched: no
decision is invented, no stage moves, no traversal is authorised. `undecided` describes what the
*run* concluded about itself — the gate was unanswered, the run is undecided, and `finish()` takes a
run status.

**2. Only "no answer was available" is undecided.** The spike throws at four gate sites and core at
three (plus two abort races). They are not one class of event, and the ticket body distinguishes
none of them:

| Site | Message | Classification |
| --- | --- | --- |
| `harness.js:96` | scripted answers exhausted, stdin is not a TTY | **undecided** |
| `harness.js:110` | stdin closed mid-question (a `reject`, not a `throw`) | **undecided** |
| `routing.ts:25` | `gate <kind> (<reason>) has no answer channel` | **undecided** |
| `harness.js:86` | `--gate-answer` value is not one of the allowed words | `failed` |
| `harness.js:115` | empty answer on a TTY | `failed` |
| `harness.js:119` | unparseable answer on a TTY | `failed` |
| `routing.ts:38` | answer envelope invalid | `failed` |
| `routing.ts:41` | stale `gateId` | `failed` |
| `routing.ts:22`, `:30` | abort race — `interruptedGate` | `interrupted`, unchanged |

The line is *was somebody there?* An operator who supplied a wrong word was there and got it wrong;
that is an error and keeps every consequence an error has today, rollback included. Only the
absence of any channel is undecided. The ticket body's C-1 correctly moves the first site from
`:95` to `:96` and is silent on the other six; **this distinction is the thing this ticket most
needs to get right, and it is the claude candidate's contribution.**

**3. Classification is by error type.** A `GateUnansweredError extends FlowError`, exported beside
`FlowError` in both trees; the catch tests `instanceof`. Never a match on message text: `:96` and
`:110` share the first eight words of their message, and a classifier keyed on prose is the defect
class this repository keeps finding (*"A check is not established by reading it"*, 2026-08-29).

**4. An undecided run completes its stream rather than throwing.** Measured: both trees `finish()`
and then **re-throw** — `spike/src/engine.js:208` (`throw e`) and
`packages/core/src/engine/engine.ts:317` (`throw error`), the latter after classifying by
`signal.aborted ? 'interrupted' : 'failed'`. Under the change, a `GateUnansweredError` finishes the
run `undecided`, emits the `terminal` event and does **not** propagate: nothing failed, so nothing
throws. This is a change to `runFlow`'s documented contract and is **OQ-2**, because
`contracts/Q-0050/run-flow-api.contract.ts:18` types `NonRegressionRunOutcome['status']` as a closed
four-member union.

**5. The predicate splits into three named questions.**

| status | advances the stage | returns worktrees | restores the branch |
| --- | --- | --- | --- |
| `completed` | yes | yes | no |
| `regressed` | yes | yes | no |
| `aborted` | no | no | yes |
| `failed` | no | no | yes |
| `interrupted` | no | no | yes |
| **`undecided`** | **no** | **no** | **no** |

`undecided` is the only status that takes neither arm. It is also the only non-advancing status
reached at a **quiescent point** — the step before the gate has completed and persisted everything —
which is why keeping the branch is safe here and is not safe for `interrupted` (OQ-4).

**6. Exit code 3.** Measured across the whole CLI: 0 (any non-aborted return), 1 (`die`, i.e. any
`FlowError`/`IntegrationError`), 2 (`aborted`, `harness.js:553`), 130 (signal). **3 is free.**
**Codex's AC-13 asks for 2 and is refuted by measurement** — 2 is `aborted`, and a caller could not
then tell "I chose to stop this" from "nobody was there", which is the exact distinction its own
user story asks for.

---

## Acceptance criteria

Fourteen, numbered, each independently testable, each naming its surface. "Both trees" means
`spike/` and `packages/core/` in one change, per the Q-0066 / Q-0068 / Q-0070 shape and this
ticket's own scope note.

**AC-1 — The decision entry exists before any implementation code is written.** A new file in
`docs/decisions/` with its line in `docs/DECISIONS.md`, ruling: that `undecided` is a run status and
not a gate answer; the site classification of §2; the three-way table of §5; that `runFlow`
completes rather than throwing (OQ-2); that `undecided` is terminal and not suspended, and that the
word is available to Q-0019 if M3 wants it (OQ-5); that `interrupted` stays where it is (OQ-4); one
sentence on `--auto` (OQ-6); and a compatibility argument against *"Human-gated by default, auto
opt-in per gate"* (2026-08-06) and *"Non-auto exhaustion gates require an explicit human or scripted
answer"* (2026-08-23), both cited by title and date.
**This is a gate obligation.** `harness/roles/developer-generalist.md:23` — *"You do not add to
docs/decisions/ or its index; a decision is the human's"* — so no step on the chore route can
satisfy it. Verified today, not inherited.
*Test:* `packages/shared/src/docs.test.ts` stays green — index and folder agree, dates do not go
backwards.

**AC-2 — Exactly the three "no answer available" sites raise `GateUnansweredError`; the other five
are unchanged.** `spike/bin/harness.js:96` and `:110`, and `packages/core/src/engine/routing.ts:25`.
The five operator-error sites of §2 keep throwing plain `FlowError` and keep producing `failed`. The
two abort races (`routing.ts:22`, `:30`) keep producing `interrupted`.
*Test:* one case per site, eight across the two suites. The three undecided sites end `undecided`;
the five error sites end `failed` **and still roll the branch back when it moved**. The second half
is load-bearing: a criterion that checked only the status would pass over a fix that accidentally
spared every failure its rollback.

**AC-3 — Classification is by type, not by text.** The catch tests `instanceof
GateUnansweredError`. No `.includes`, `.match` or regular expression over an error message decides a
terminal status, in either tree.
*Test:* a `GateUnansweredError` whose message is the empty string still ends the run `undecided`; a
plain `FlowError` carrying the verbatim text of `harness.js:96` still ends it `failed`. The second
half is the discriminating one — it fails against a text classifier and passes against a type
classifier.

**AC-4 — `finished()` is replaced by three named predicates, and no status takes both arms.**
`advancesStage`, `returnsWorktrees` and `restoresBranch` in both trees; the `if`/`else` at
`spike/src/engine.js:748–750` and `packages/core/src/engine/lifecycle.ts:112` becomes two
independent `if`s. Membership is exactly §5's table. The `ctx.branchHeadAtStart`-and-moved guard
inside the rollback arm is preserved unchanged.
*Test:* a table-driven test over all six statuses asserting each predicate, **plus** the invariant
`!(returnsWorktrees(s) && restoresBranch(s))` for every status. The invariant is what carries
Q-0062's *"cannot drift apart"* property across the loss of the `if`/`else` that used to guarantee
it structurally; without it this criterion is a rename and the guarantee is gone.

**AC-5 — An undecided run keeps its ticket branch exactly where the run left it.** No
`resetBranchTo`, no `rolled-back` line in `runs.log`, no rollback warning.
*Test:* end to end with the mock adapter. **The fixture must move the branch before the gate** — a
chore-shaped flow whose `integrate` merges into the ticket branch, then a gate with no answer
channel — because a gate reached before any merge proves nothing (see the correction above: three
real exhaustion-gate failures left no `rolled-back` line for exactly this reason). Assert
`git rev-parse` on the integration branch is the post-merge SHA and not `branchHeadAtStart`.
**Demonstrate red before green**: the same fixture against the unchanged engine must show the
rollback, in both suites.

**AC-6 — An undecided run keeps every worktree it obtained.** No `removeWorktree` call and no
`run=N removed-worktrees=… kept=…` line, because the directory the run stopped in is the one
somebody is about to open. *"A run removes the worktrees it made, and never the refs"* (2026-08-31)
is otherwise unchanged: no ref is deleted on any path.
*Test:* a run that obtains two worktrees and ends `undecided` leaves both on disk and writes no
`removed-worktrees=` line; a `completed` run over the same fixture still removes them.

**AC-7 — An undecided run moves no stage, writes one history entry saying so, and fails no
occurrence.** `stage_before === stage_after`, `status: undecided`, cost and tokens recorded as any
other terminal entry records them. No occurrence is closed as `failed` by an undecided run: a gate
allocates none, and `finaliseActiveOccurrences` stays typed `'failed' | 'interrupted'`.
*Test:* frontmatter after the run; the terminal line reads
`run=N undecided stage=X→X cost=… tokens=…`; the manifest holds no occurrence whose status changed
because of the gate.

**AC-8 — `runFlow` completes rather than throwing, and the terminal event carries the status.**
The `undecided` path emits `terminal` with `status: 'undecided'` and returns a `RunOutcome`;
`spike/src/engine.js:208` and `packages/core/src/engine/engine.ts:317` no longer re-throw for this
one error type, and re-throw unchanged for every other. Core's `signal.aborted ? 'interrupted' :
'failed'` classification is untouched — an abort during an unanswered gate is still `interrupted`.
*Test:* a core-side test that consumes the whole `AsyncIterable` to completion without the iterator
throwing, whose last event is `terminal` with `status: 'undecided'`; and the spike's CLI reaching
its exit-code path rather than `die`.

**AC-9 — `harness run` exits 3, and both diagnostics reach the user verbatim.** `harness.js:96`'s
and `:110`'s messages are unchanged in wording and still printed, now on the non-error path.
*Test:* `spike/test/smoke.js:115` (`assert(r.status !== 0, …)`) and `:116`
(`/stdin closed without one/`) **stay green**, which is the check that this fix does not quietly
delete the diagnostic the 2026-08-24 hang bought. `:115`'s description string —
*"a gate with no answer available fails the run"* — is now false and is reworded in the same change;
the assertion passes either way, which is why it is named here rather than left to a reviewer. A new
assertion pins the code as exactly **3**, distinguishing it from the 1 an operator-error gate returns
and the 2 an `abort` returns.

**AC-10 — The status vocabulary is added everywhere a *run* status is enumerated, and nowhere it is
not.** Add `undecided` to: `packages/core/src/engine/types.ts:24` (`RunStatus`);
`packages/core/src/run-history/manifest.ts:31`; `TERMINAL_STATUSES` in **both**
`spike/src/contracts.js:51` and `packages/core/src/contracts/run-manifest.ts:24`; the non-regressed
member of `packages/shared/src/events.ts:222`; the run-level `status` enum at
`contracts/Q-0011/run-manifest.schema.json:23`; and the history enum at
`contracts/Q-0006/ticket-review-state.schema.json:23`. **Do not** add it to the *occurrence* enum at
`run-manifest.schema.json:68`, to the occurrence status in
`contracts/Q-0011/run-history-writer.contract.md:75`, or to
`finaliseActiveOccurrences`'s `'failed' | 'interrupted'`: an occurrence is never undecided, only a
run is.
*Test:* a manifest carrying `status: undecided` validates under `harness validate` against the
`run-manifest-v1` semantic pass, and an occurrence carrying it is **refused**. The second half is
what stops the word leaking one level down.

**AC-11 — Three frozen contracts are superseded by erratum, not edited silently.**
`contracts/Q-0011/run-manifest.schema.json`, `contracts/Q-0006/ticket-review-state.schema.json`, and
the Q-0050 pair — `run-flow-api.contract.ts:6` (`RunStatus`) and `:18`
(`NonRegressionRunOutcome`), plus `lifecycle-routing.contract.md:15` and `:58`, which enumerate the
terminal statuses and say *"its seven terminal…"*. **Neither candidate names the Q-0050 pair; it was
found by reading `contracts/` rather than by inheriting a list.** `requirements/errata.md` records
which clause of each is superseded and why, on the precedent of Q-0073's E-4, which superseded two
frozen Q-0006 contracts for the nit rule.
*Test:* `packages/core/src/contracts/contracts.test.ts` and `validate-artifact.test.ts` stay green
over the edited schemas; the erratum exists and names each file.

**AC-12 — The documentation says what the code says.** `docs/02-sdlc-pipeline-spec.md` §3.3 (the
`status` sentence at lines 127–128, currently *"one of `completed`, `regressed`, `aborted`,
`failed`, `interrupted` or `exhausted`"*) gains `undecided` and states that it moves no stage;
`docs/GLOSSARY.md` gains the word under **Gate** or **Run history** before it appears in a second
file, per the vocabulary rule; `packages/shared/src/ticket.ts:35`'s JSDoc list gains it.
*Test:* `docs.test.ts`; plus a source-text assertion that the spec's status list and the shipped
`TERMINAL_STATUSES` name the same set, so the two cannot drift again.

**AC-13 — The run says, in `runs.log` and on the terminal, that the branch and the worktrees were
kept.** One line naming the gate that went unanswered and stating that nothing was rolled back —
the record a maintainer reads before deciding whether to re-run or answer by hand, and the sentence
that replaces the rollback warning it no longer prints. This is R-1's mitigation and is not
decoration.
*Test:* AC-5's end-to-end fixture asserts the line's presence and that it names the gate's `reason`.

**AC-14 — Charter §3's re-record is walked, and both suites are verified forced in both environment
rows.** This ticket changes `spike/src/engine.js`, and `harness/port-charter.md:279` records
`freeze-sha: d50cead…`; Q-0040 is not in the charter's `children:` list (`:278`, Q-0041–Q-0054), so
the branch-scope job reports it out of scope on the Q-0038 / Q-0057 precedent while the freeze-SHA
half goes red at the merge by design. Step 1 is satisfied by landing in both trees; step 2 is
re-recording `freeze-sha` **in a follow-up commit whose parent is the merge** (`port-charter.md:207`;
Q-0037 erratum E-1 — a commit cannot contain its own hash). Verification per Q-0072's closing
finding: in the `integrate` worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and
again on `main` after the merge — `npm test --prefix spike`, `pnpm turbo run test --force`,
`harness lint`, `pnpm sweep:git-identity`.
*Test:* `.github/scripts/port-freeze-guard.test.mjs` green, and the guard demonstrated red at the
merge and clear at the re-record, as Q-0062 and Q-0089 both did.

**A note on size, since it is this gate's job.** Fourteen criteria is at the upper end and I am
approving the count rather than tolerating it. The seam a splitter would reach for — land the
predicate split first, add the status second — is rejected: a split with no fourth status is a
refactor with no observable behaviour change, which this repository has repeatedly found produces
tests that cannot fail, and both halves are gated by the same decision entry, so the split would
buy two runs and one waiting human. AC-14 is process every chore ticket carries. If the implement
step exhausts, the seam to cut at is AC-10 through AC-12 (vocabulary, contracts and docs) as a
successor, not the lifecycle work.

---

## Non-goals

1. **Making a gate answerable from anywhere but stdin.** M3's server and the `answerGate` callback
   Q-0050 already shipped in `core`.
2. **Resuming an undecided run.** Q-0019, M3. OQ-5 rules whether `undecided` is *meant* to be that
   state; this ticket builds none of it.
3. **Changing what a gate may answer.** `advance | retry | abort`, unchanged. No new answer word, no
   new flag, no timeout, no automatic accept, reject or skip.
4. **Changing `--auto`.** An `auto` gate still auto-advances; a `human-locked` gate still cannot be
   walked through. `undecided` arises only where a gate genuinely stops.
5. **Changing the setup catch.** `spike/src/engine.js:104` runs before any step exists, for an
   `initialiseRunHistory` failure or the AC-1 collision refusal, so no gate exists when it fires. It
   stays `failed`. The ticket body's C-2 raised this so a fix would not change it by symmetry and a
   reviewer would not report its absence as an omission; it is restated as a non-goal so the
   reviewer meets it in the requirement.
6. **Rolling back task branches.** Still carried by the M1 closing entry, still not this ticket.
7. **A cleanup command for the worktrees an undecided run preserves.** That is Q-0062's successor,
   `harness worktrees`, written out in full in that ticket's merged requirement and inherited by
   Q-0010. Codex's risk 2 raises the accumulation and is right that it is real and elsewhere.
8. **Colouring `undecided` in `harness runs`.** Measured: `statusLabel`
   (`spike/bin/harness.js:228–230`) paints `completed` green, `running` amber and *everything else*
   dim — `failed`, `aborted`, `regressed`, `interrupted` and `exhausted` are all dim today. So
   `undecided` rendering dim is consistent rather than a gap, and changing it would change the
   rendering of six statuses in a file Q-0010 replaces.
9. **Tidying `exhausted`.** It is in `TERMINAL_STATUSES` and the manifest enum while never being a
   *run's* terminal status — it reaches `history` through `recordEvent` / `recordOccurrenceEvent`
   only. Reported, not fixed. See R-6.
10. **Changing flow YAML, ticket frontmatter, adapter contracts, trace formats, cross-vendor rules,
    or anything in the v1 out-of-scope list.**

---

## Open questions

**OQ-1 (blocking) — the decision entry.** AC-1's entry must exist before the implement step runs,
and `harness/roles/developer-generalist.md:23` forbids any step on the chore route from writing one.
**This is the tenth appearance in this backlog of a loop handed work no agent in it can perform** —
the seventh, eighth and ninth are recorded on Q-0052, Q-0062 and Q-0037, and Q-0062's requirement
named the hazard in advance and the run was launched without the entry anyway, spending three
implement rounds on it. Naming it here is not sufficient; it must be written by hand at this gate.
*Owner: the human at the requirements gate.*

**OQ-2 (blocking) — does `runFlow` return or re-throw on `undecided`?** Measured: both trees
`finish()` and then re-throw (`engine.js:208`, `engine.ts:317`), and the spike's CLI turns that into
`die` → exit 1. Recommendation: **return**, per §4 — an undecided run did not fail, and a consumer
told to treat a thrown iterator as a failure would re-create the classification defect one layer up.
It is blocking because it changes `runFlow`'s contract rather than an implementation detail:
`contracts/Q-0050/run-flow-api.contract.ts:6` and `:18` type `RunStatus` and
`NonRegressionRunOutcome` as closed unions, and `lifecycle-routing.contract.md` enumerates the
terminal outcomes. Both are frozen, so the answer decides AC-8 and the scope of AC-11's erratum.
*Owner: the human at the requirements gate.*

**OQ-3 (blocking) — does the Q-0006 erratum also close the `interrupted` omission it already
contains?** `contracts/Q-0006/ticket-review-state.schema.json:23` is
`["completed","regressed","exhausted","aborted","failed"]`. **`interrupted` is missing, and the
engine has written it** (`finish(ctx, …, 'interrupted', …)` on SIGINT/SIGTERM, `engine.js:85`; twice
in this backlog). So a ticket whose history holds an interrupt already fails that frozen schema, and
this ticket is not the first to contradict it. Recommendation: **add both**, in one erratum, because
they are missing for the same reason — the schema was frozen at Q-0006 before either status existed
— and leaving one behind means shipping a known contradiction in a file this change is already
opening. The alternative, `undecided` alone, is defensible on scope grounds and must be chosen
deliberately rather than by omission. Blocking because it is an erratum against a frozen contract,
which is a human's ruling and not an implementer's.
*Owner: the human at the requirements gate.*

**OQ-4 (non-blocking, recommend "no") — does `interrupted` join `undecided` on the branch
question?** A maintainer pressing Ctrl-C at a gate is also "nobody decided", and today that also
rolls back. Recommendation: leave `interrupted` where it is, and write the distinction into the
entry: **`undecided` is the only non-advancing status reached at a quiescent point.** A gate is
reached after its preceding step has completed and persisted everything; a signal can arrive
anywhere, including mid-`integrate` between the merge and the suite, so the branch may hold a state
nobody chose and the rollback is the right default. A later ticket disagreeing should bring a
measured instance.

**OQ-5 (non-blocking, recommend "terminal, not suspended") — is an undecided run resumable?**
Recommendation: **no.** The run is over; what survives is the branch, the worktrees, the manifest and
the stage — which is everything the next `harness run` or a human answering by hand needs, and
exactly what Q-0008's manual recovery reconstructed. Resumption is Q-0019 in M3 and may later
*choose* `undecided` as the state it picks up. **The obligation goes in the decision entry, not only
here**: Q-0019 has no folder to carry it, and a deferred obligation recorded only in a closed
ticket's requirement expires (*"Deferred criteria need successor bodies"*).

**OQ-6 (non-blocking) — should `harness run --auto` ever produce `undecided`?** Under the recommended
shape, yes: `--auto` does not bypass a `human-locked` gate or an exhaustion gate, so an `--auto` run
can still reach one with no answer channel. That is today's behaviour of the throw and no criterion
changes it — `spike/test/smoke.js:112–117` is exactly this case and becomes the suite's first
`undecided` fixture — but it deserves one sentence in the entry, because it is the case a reader
asks about first.

---

## Risks

**R-1 — `undecided` reintroduces the Q-0033 failure the rollback exists to prevent.** The comment at
`engine.js:740–746` is explicit: an exhausted or aborted run used to leave `integrate`'s merges
behind, so the next `qa-red` measured its red phase against a tree that already held the
implementation and reported 21 green and nothing red. Keeping the branch on `undecided` restores
that condition. **Why it is nonetheless safe, and where the safety ends:** the stage does not move,
so the flow that next consumes the ticket is the *same* flow, not the later one whose red phase
would be poisoned. The residual risk is a human hand-advancing the stage without noticing the merge
is already there — a risk that exists after every `completed` run too. **AC-13 is the mitigation and
is load-bearing.** This is the strongest argument against the ticket and the decision entry must
answer it rather than assert the exemption.

**R-2 — a classifier keyed on message text.** `harness.js:96` and `:110` open with the same eight
words. A fix matching on prose works the day it lands and breaks the first time a message is
reworded — silently, and in the direction of destroying work. AC-3 is written to fail such a fix.

**R-3 — the split predicate drifts.** Q-0062 chose one predicate precisely so the inspection story
and the cleanup story could not disagree. Splitting removes that structural guarantee; AC-4's
invariant is the replacement. Without it this ticket trades a guarantee for a convention, which is
the trade this repository has repeatedly found expensive.

**R-4 — regressing the five existing statuses.** Codex's risk 1, kept because it is the one thing a
table-driven rewrite gets wrong quietly. AC-2's failure half and AC-4's table cover it; AC-6's
`completed` control case is there for the same reason.

**R-5 — exit-code consumers.** Anything treating non-zero as failure is unaffected (the gate case
was already non-zero). Only a consumer testing `== 1` changes. Measured: nothing in either suite or
in `harness/` tests `harness run` for exit 1 specifically; `smoke.js:115` asserts `!== 0`. Low, and
stated rather than assumed. Once shipped, exit 3 is part of the CLI contract and must not be reused.

**R-6 — scope drift into the status vocabulary.** Six words already exist across four enum sites and
five contract files, and `exhausted` is in `TERMINAL_STATUSES` and the manifest enum while never
being a run's terminal status. An implementer who does not know that will either add `undecided` in
too few places or "tidy" `exhausted` in passing. AC-10 enumerates the sites for exactly this reason,
and the boundary it draws — run status, not occurrence status — is what keeps the change bounded.

**R-7 — the port freeze goes red mid-flight.** Expected and by design (AC-14). The hazard is landing
in one tree only, which leaves the guard reporting divergence it cannot explain. Both trees in one
commit; re-record in the follow-up.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, `check()` or environment path is touched; no API-key path, fixture or example is introduced. |
| **Worktree safety** | Directly engaged. `undecided` keeps every worktree the run obtained (AC-6); no ref is deleted on any path, so *"A run removes the worktrees it made, and never the refs"* (2026-08-31) is unchanged. No flow gains the ability to write to the user's tree. |
| **Gate behaviour** | No answer is invented, no answer word is added, `--auto` is unchanged, `human-locked` is unchanged, exhaustion-edge selection is unchanged. The decisions of 2026-08-06 and 2026-08-23 are argued in the entry and neither is contradicted (AC-1). |
| **File format and schema** | `history[].status` may carry a new value — `packages/shared/src/ticket.ts` types it open (`z.string().optional()`), so no schema break and no migration; nothing rewrites existing entries, and the spec already says shorter legacy entries stay valid. The manifest and event enums are closed and are named in AC-10; three frozen contracts are superseded by erratum in AC-11. |
| **Lint rules** | n/a. No flow file changes; `lintFlow` and `harness lint` untouched. TS strict and the type-aware deprecation rule pass for changed `packages/**` files. |
| **Cross-vendor rule** | n/a. Step authorship and judging are unchanged. |
| **Product agnosticism** | Diagnostics, tests and docs name no product. The BYOS refusal wording is Q-0068's and is not touched here. |
| **Cold-clone impact** | Neutral to positive, and no new step in the first 30 minutes. An `adopter` whose first unattended run reaches a gate finds the work intact and a message saying what is waiting, instead of an error and an empty branch. One new exit code, documented in `harness run`'s usage line, not in the README. |

---

## Provenance

**The claude candidate is the base**, on three decisions codex has no equivalent for and which are
what this ticket turns on: the **site classification** (only "no answer was available" is undecided;
an operator who typed the wrong word was there and gets an error), the **type-based classifier**
rather than a message match, and the **split predicate with an explicit invariant** replacing the
structural guarantee the `if`/`else` used to provide. It also brought the exit-code census, the
`statusLabel` measurement that turns a possible criterion into a non-goal, and the observation that
`exhausted` is history vocabulary rather than a run status.

**Codex contributed** the preservation criterion for the five existing statuses as a first-class
requirement rather than a risk note (its AC-10, now R-4 plus AC-2's and AC-6's control cases); the
insistence that the run-history record identify *which* of the two unanswered conditions occurred
(folded into AC-13); the fuller non-goal list, of which the worktree-accumulation boundary and the
"no new answer source" clause are kept; and the exit-code-contract risk, kept as R-5's second
sentence. Its AC-9 states the coupling problem crisply and independently, which is worth recording
because two candidates reaching it separately is evidence the ticket body's C-3 is right.

**Where they conflict, ruled by measurement rather than by preference.** Codex's AC-13 asks for
**exit code 2**; 2 is already `aborted` (`spike/bin/harness.js:553`), so its own user story — a
caller distinguishing undecided from success and failure by exit code alone — would fail against a
deliberate abort. **Exit 3**, claude's answer, is what shipped into this document. Codex's *"Open
questions: none"* is rejected: three rulings below are a human's, and a document that declares none
while requiring a decision entry it may not write is asserting closure it does not have.

**What neither candidate had.** The `contracts/Q-0050` pair (`run-flow-api.contract.ts:6` and `:18`,
`lifecycle-routing.contract.md:15`, `:58`) enumerates the run statuses in frozen files and is now in
AC-11. Both trees **re-throw** after `finish()`, so "returns rather than throws" is a contract
change and not an implementation detail — now AC-8 and OQ-2. And the correction that changes AC-5's
fixture: `chore.yaml`'s exhaustion gate precedes `integrate`, so the exhaustion gate is the biggest
beneficiary of the *classification* half and no beneficiary at all of the *branch* half.

**Three of the claude candidate's own numbers moved when re-measured** — 21 `failed` records not 25
(its own appendix disagreed with its own prose), 12 `aborted` not 11 — which is *"a measurement
copied from a document is not a measurement"* arriving inside a document that says so itself.

---

## Appendix — measurements

Run 2026-09-01 at `a13bd80`. Re-measure rather than transcribe.

- **Gate sites.** `spike/bin/harness.js:86, 96, 115, 119` (`throw`) and `:110` (`reject` inside the
  readline `close` handler — a `reject`, not a `throw`, which a grep for `throw new FlowError`
  misses). `packages/core/src/engine/routing.ts:25, 38, 41`, plus the abort race at `:22`/`:30`.
- **`finished`.** Defined `spike/src/engine.js:665`; `packages/core/src/engine/lifecycle.ts:20`.
  Read at `engine.js:727, 748` and `lifecycle.ts:101, 112` — **twice each, not three times.** C-3
  confirmed. The rollback arm is additionally guarded by `branchHeadAtStart` and by the branch
  having moved (`engine.js:750–752`, `lifecycle.ts:112–117`).
- **`finish(…, 'failed')`.** `engine.js:104` (setup, not this ticket) and `:207` (step loop, this
  ticket's). C-2 confirmed. Both catches re-throw: `engine.js:208`, `engine.ts:317`.
- **Statuses.** `RunStatus` at `packages/core/src/engine/types.ts:24` is
  `completed | regressed | aborted | failed | interrupted`;
  `packages/core/src/run-history/manifest.ts:31` adds `running` and `exhausted`.
  `TERMINAL_STATUSES` (six words) duplicated at `spike/src/contracts.js:51` and
  `packages/core/src/contracts/run-manifest.ts:24`. Terminal event union:
  `packages/shared/src/events.ts:222`.
- **Frozen contracts naming a status.** `contracts/Q-0011/run-manifest.schema.json:23` (run) and
  `:68` (occurrence); `contracts/Q-0006/ticket-review-state.schema.json:23` — enum omits
  `interrupted`; `contracts/Q-0050/run-flow-api.contract.ts:6, 18`;
  `contracts/Q-0050/lifecycle-routing.contract.md:15, 18, 58`;
  `contracts/Q-0011/run-history-writer.contract.md:75` (occurrence).
- **`exhausted`** is written by `recordEvent` and `recordOccurrenceEvent` into the ticket's
  `history`, **never passed to `finish()`** — history vocabulary, not a run status.
- **Exit codes in use across the whole CLI:** 0, 1 (`die`), 2 (`aborted`, `harness.js:553`), 130.
  **3 is free.**
- **`statusLabel`** (`harness.js:228`): green for `completed`, amber for `running`, dim for
  everything else.
- **Terminal records across all `backlog/*/runs.log`** (`run=N <status>`): `completed` 73,
  `exhausted` 37, `failed` 21, `aborted` 12, `regressed` 6, `interrupted` 2.
- **`failed` records naming a gate: 12 of 21, totalling $149.65** — 8 `gate (human)` and 4
  `gate (human-locked)` exhaustion gates, all twelve ending
  `needs an answer and stdin closed without one`.
- **`rolled-back` lines: 7** (an eighth grep hit is Q-0008's recovery note). Four were unanswered
  gates, two were `aborted`, one a genuine failure. The four are all post-`integrate` human gates;
  no exhaustion-gate failure produced one, because `chore.yaml` is
  `implement → review (loop) → integrate → gate: human`.
- **`harness/port-charter.md:278–279`:** `children:` is Q-0041–Q-0054, so Q-0040 is out of the
  branch-scope half's scope; `freeze-sha: d50cead3c876173d880825f7611a5262442d3c78`.
- **`harness/roles/developer-generalist.md:23`:** *"You do not add to docs/decisions/ or its index;
  a decision is the human's"*.
- **`spike/test/smoke.js:112–117`** is already an `--auto` run reaching a `human-locked` exhaustion
  gate with no answer; `:115` asserts `r.status !== 0` under the description *"a gate with no answer
  available fails the run"*.
