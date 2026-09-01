# Q-0040 — A gate can say "undecided"

*Requirements, run 1, candidate: claude. Written 2026-09-01 against the tree at `5ccd810`.*

Every line citation, count and cost in this document was measured today. Where it disagrees with
the ticket body — including the body's own 2026-09-01 re-measurement section — this document is
what was measured, and the disagreement is called out by name.

---

## Problem

A run that reaches a gate nobody can answer is recorded as a **failed run**, and a failed run's
branch is rolled back. So work the run had already merged and proven green is thrown away because
nobody was at the keyboard.

The `maintainer` starts a chore run in the evening. The implement step writes code, the
cross-vendor review approves it, `integrate` merges the implement branch into
`harness/<id>/integration` and reports `tests=ok`. The run then reaches the chore flow's human
gate, finds no TTY and no `--gate-answer` left, and throws. `finish()` classifies the throw as
`'failed'`, and because `'failed'` is not `finished()`, `resetBranchTo` moves the integration
branch back to where the run found it. In the morning the maintainer has a ticket at its original
stage, a branch with no merge on it, and a `runs.log` line that says the run failed. The work is
recoverable — each task's commits are still on their own branches — but recovering it is manual,
and the record says something untrue about why.

### What this has actually cost, measured

**The rollback has fired seven times in this backlog and was wrong four of them.**

| Run | Terminal status | Cause | Rollback correct? |
| --- | --- | --- | --- |
| Q-0008 run 3 | `failed` | gate (human) "Chore owner approves the review" — no answer | **no** |
| Q-0035 run 3 | `failed` | gate (human) "Chore owner approves the review" — no answer | **no** |
| Q-0036 run 4 | `failed` | gate (human) "Chore owner approves…" — no answer | **no** |
| Q-0006 run 13 | `failed` | gate (human) "Integrated branch is green; approve…" — no answer | **no** |
| Q-0006 run 11 | `failed` | `dependency cycle or unknown depends_on among: Q0006-runtime` | yes |
| Q-0033 run 7 | `aborted` | a human answered `abort` | yes |
| Q-0033 run 8 | `aborted` | a human answered `abort` | yes |

Four of seven — 57% — destroyed a merge in answer to a question nobody had asked. The three correct
ones are exactly the two shapes the rollback was written for (Q-0033): a run that genuinely failed,
and a run a human deliberately aborted.

**The ticket body says Q-0036 and Q-0035 lost merges on consecutive nights. That is true and it is
an undercount** — Q-0008 and Q-0006 lost one each as well, and Q-0008's `runs.log:22` records the
repair in the maintainer's own words: *"harness/Q-0008/implement re-merged into
harness/Q-0008/integration, reproducing the rolled-back `6a3f48c`; stage advanced by hand, no
engine run completed"*. That line is the cost of this defect written down at the time.

**Twelve of the twenty-five `failed` terminal records in this backlog are unanswered gates, and
they carry $149.65 of billed work.** Nearly half of everything this project calls a failed run is
not a failure. Cost is not the argument — the money was spent on work that was mostly kept — but
the classification is: a maintainer scanning `runs.log` or `harness runs` for real failures reads
twelve false positives, and any tool that ever counts failures counts them too.

**The exhaustion gate is the biggest single beneficiary.** `exhausted` is written 37 times across
this backlog, second only to `completed` at 73. An exhausted loop always lands on a human-locked
gate that `--auto` may not walk through (decision *"Non-auto exhaustion gates require an explicit
human or scripted answer"*, 2026-08-23), so it is the gate most likely to be reached unattended.

### Why it is spelled this way, and where the shape resists the fix

`finish()` reads one predicate, `finished(status) = completed || regressed`, in two places
(`spike/src/engine.js:665`, `:727`, `:748`; `packages/core/src/engine/lifecycle.ts:20`, `:101`,
`:112`). The second read is the head of an `if`/`else`:

```js
if (finished(status)) ticket.meta.stage = stage;              // engine.js:727  stage rule
if (finished(status)) returnObtainedWorktrees(ctx);           // engine.js:748  arm one
else if (ctx.branchHeadAtStart) { … resetBranchTo(…) }        // engine.js:750  arm two
```

Returning the worktrees and rolling the branch back are mutually exclusive **by construction**.
`finished` buys worktrees-returned *and* no rollback; not-`finished` buys rollback *and* worktrees
kept. What an unanswered gate wants — **keep the worktrees and leave the branch alone** — is a
third combination the shape cannot express. **The ticket body's C-3 is correct, and it is the
governing fact of this ticket: the work is splitting that conditional into independent decisions,
and adding a status is the small part.**

Q-0062's closing entry calls the single predicate a feature — *"one condition and three
consequences, so the inspection story and the cleanup story cannot drift apart"*. That property is
real and must survive the split: see AC-4, which restates it as an assertion rather than losing it
with the `if`/`else` that carried it.

---

## User stories

**`maintainer`** — I start a run in the evening knowing I will not be there when it reaches its
gate. In the morning I want to answer the gate, not reconstruct the merge the run threw away, and I
want `runs.log` to tell me the run stopped waiting for me rather than that it failed.

**`maintainer`, scripting** — I wrap `harness run` in a shell script. I need to tell "nobody
answered the gate" from "the run failed" by exit code, without parsing stderr.

**`adopter`** — my first `npx quorum` run reaches a gate while I am reading the README in another
window. When I come back I want the run's own output to tell me what it is waiting for and that
nothing was lost, not an error that makes me think the tool broke.

`contributor` is not a persona for this ticket: nothing below the adapter layer changes.

---

## Surfaces

| Surface | What changes |
| --- | --- |
| **CLI** (`spike/bin/harness.js`) | The two "no answer available" throws become a typed refusal; `harness run` gains one exit code. |
| **`spike/src/engine.js`** | The terminal status vocabulary, the split conditional, the catch that classifies. |
| **`packages/core/src/engine/`** | `lifecycle.ts`, `routing.ts`, `types.ts` — the same three changes. |
| **`packages/core/src/run-history/manifest.ts`**, **`packages/core/src/contracts/run-manifest.ts`** | The run-status type and the semantic pass's `TERMINAL_STATUSES`. |
| **`packages/shared/src/events.ts`**, **`ticket.ts`** | The terminal event union; the history-status JSDoc vocabulary. |
| **`contracts/`** | Three frozen files — see AC-9 and OQ-2. |
| **`docs/`** | `02-sdlc-pipeline-spec.md` §3.3, `GLOSSARY.md`, one new `decisions/` entry. |
| **`backlog/*/ticket.md`** | A new value may appear in `history[].status`. No migration; nothing rewrites existing entries. |

**Not `harness/`.** No flow file changes, so `harness lint` is untouched and no flow needs
re-linting. This is worth stating because every recent ticket in this backlog has moved a flow file.

---

## The recommended shape

Stated here so the acceptance criteria can be read against it. The decision entry (AC-1) is what
ratifies it, and it may overrule any of this.

**1. `undecided` is a run status, not a gate answer.** The gate answers stay exactly
`advance | retry | abort`. Nothing is added to what a human or a script may say, so decision
*"Non-auto exhaustion gates require an explicit human or scripted answer"* (2026-08-23) is
untouched: no decision is invented, the stage does not move, and no traversal is authorised.
`undecided` describes what the *run* concluded about itself, which is why the word is `undecided`
and not `unanswered` — the gate was unanswered, the run is undecided, and `finish()` takes a run
status.

**2. Only "no answer was available" is undecided.** The spike throws at five gate sites and core at
four. They are not the same class of event, and the ticket body does not distinguish them:

| Site | Message | Classification |
| --- | --- | --- |
| `harness.js:96` | stdin is not a TTY and `--gate-answer`s are exhausted | **undecided** |
| `harness.js:110` | stdin closed mid-question | **undecided** |
| `routing.ts:25` | `gate <kind> (<reason>) has no answer channel` | **undecided** |
| `harness.js:86` | `--gate-answer` value is not one of the allowed words | `failed` |
| `harness.js:115` | empty answer on a TTY | `failed` |
| `harness.js:119` | unparseable answer on a TTY | `failed` |
| `routing.ts:38` | answer envelope invalid | `failed` |
| `routing.ts:41` | stale `gateId` | `failed` |

The line is *was somebody there?* An operator who supplied a wrong word was there and got it wrong;
that is an error and keeps every consequence an error has today, rollback included. Only the
absence of any channel is undecided. **The ticket body's step 1 names only the first two sites and
its C-1 corrects the first from `:95` to `:96`; C-1 is right, and the body is silent on the other
six, which is the distinction this ticket most needs to get right.**

**3. Classification is by error type.** A `GateUnansweredError extends FlowError`, exported beside
`FlowError` in both trees. The step-loop catch tests `instanceof`. It never matches on message
text — `:96` and `:110` share the first eight words of their message, and a classifier keyed on
prose is the defect class this repository keeps finding (*"A check is not established by reading
it"*, 2026-08-29).

**4. An undecided run returns rather than throws.** Today the gate throw propagates out of
`runFlow` after `finish()` has run, and the CLI's `catch` turns it into `die(…)` → exit 1. Under
the change `runFlow` returns a `RunOutcome` with `status: 'undecided'` and core emits a `terminal`
event with that status and does not throw to its consumer. Nothing failed, so nothing throws.

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
reached at a **quiescent point**: the step before the gate has completed and persisted everything,
which is precisely why keeping the branch is safe here and is not safe for `interrupted` (OQ-3).

**6. Exit code 3.** Measured: `harness run` uses 0 (any non-aborted return), 2 (`aborted`), 1 (any
`FlowError`/`IntegrationError` through `die`), and 130 (signal). 3 is free across the whole CLI.

---

## Acceptance criteria

Numbered, independently testable. Each names its surface. "Both trees" means `spike/` and
`packages/core/` in one change, per the Q-0066 / Q-0068 / Q-0070 shape and this ticket's own scope
note.

**AC-1 — The decision entry exists before any code is written.** A new file in `docs/decisions/`
with its line in `docs/DECISIONS.md`, ruling: that `undecided` is a run status and not a gate
answer; the site classification of AC-2; the three-way table of §5; that `undecided` is terminal
and not suspended (OQ-3); and its compatibility argument against *"Human-gated by default, auto
opt-in per gate"* (2026-08-06) and *"Non-auto exhaustion gates require an explicit human or
scripted answer"* (2026-08-23), both cited by title and date. **This is a gate obligation. No step
on the chore route may write a decision entry** (`harness/roles/developer-generalist.md`), so it is
named at the requirements gate and written by hand before the implement step runs.
*Test:* `packages/shared/src/docs.test.ts` stays green — index and folder agree, dates do not go
backwards.

**AC-2 — Exactly the three "no answer available" sites raise `GateUnansweredError`; the other five
are unchanged.** `spike/bin/harness.js:96` and `:110`, and
`packages/core/src/engine/routing.ts:25`. The five operator-error sites of §2 keep throwing plain
`FlowError` and keep producing `failed`.
*Test:* one case per site, eight in total across the two suites. The three undecided sites end
`undecided`; the five error sites end `failed` **and** roll the branch back when it moved — the
second half matters, because a criterion that only checks the status would pass over a fix that
accidentally spared every failure its rollback.

**AC-3 — Classification is by type, not by text.** The catch tests `instanceof
GateUnansweredError`. No `.includes`, `.match` or regular expression over an error message decides
a terminal status, in either tree.
*Test:* a `GateUnansweredError` whose message is the empty string still ends the run `undecided`;
a plain `FlowError` carrying the verbatim text of `harness.js:96` still ends it `failed`. The
second half is the discriminating one — it fails against a text classifier and passes against a
type classifier.

**AC-4 — `finished()` is replaced by three named predicates, and no status takes both arms.**
`advancesStage`, `returnsWorktrees` and `restoresBranch` in both trees; the `if`/`else` at
`spike/src/engine.js:748–750` and `packages/core/src/engine/lifecycle.ts:112` becomes two
independent `if`s. The membership is exactly §5's table.
*Test:* a table-driven test over all six statuses asserting each predicate, **plus** the invariant
`!(returnsWorktrees(s) && restoresBranch(s))` for every status. The invariant is what carries
Q-0062's *"cannot drift apart"* property across the loss of the `if`/`else` that used to guarantee
it structurally; without it this criterion is a rename and the guarantee is gone.

**AC-5 — An undecided run keeps its ticket branch exactly where the run left it.** No
`resetBranchTo`, and no `rolled-back` line in `runs.log`.
*Test:* end to end with the mock adapter. A chore-shaped fixture whose `integrate` moves the
integration branch, then a gate with no answer channel. Assert `git rev-parse` on the integration
branch is the post-merge SHA and not `branchHeadAtStart`, and that `runs.log` holds no
`rolled-back` line for that run. **Demonstrate red before green**: the same fixture against the
unchanged engine must show the rollback, in both suites.

**AC-6 — An undecided run keeps every worktree it obtained.** No `removeWorktree` call, and no
`removed-worktrees=` line in `runs.log`, because the directory the run stopped in is the one
somebody is about to open. Decision *"A run removes the worktrees it made, and never the refs"*
(2026-08-31) is unchanged in every other respect: no ref is deleted on any path.
*Test:* a run that obtains two worktrees and ends undecided leaves both on disk and writes no
`removed-worktrees=` line; a `completed` run over the same fixture still removes them.

**AC-7 — An undecided run does not move the ticket's stage, and writes one history entry saying
so.** `stage_before === stage_after`, `status: undecided`, and the run's cost and tokens recorded
as any other terminal entry records them.
*Test:* frontmatter after the run; the `runs.log` terminal line reads
`run=N undecided stage=X→X cost=… tokens=…`.

**AC-8 — `harness run` exits 3 on an undecided run, and the diagnostic text is preserved
verbatim.** Both existing messages — `harness.js:96`'s and `:110`'s — still reach the user, now on
the non-error path.
*Test:* `spike/test/smoke.js:114` (`assert(r.status !== 0, …)`) and `:116`
(`/stdin closed without one/`) **both stay green unchanged**, which is the check that this fix does
not quietly delete the diagnostic the 2026-08-24 hang bought. A new assertion pins the code as
exactly 3, distinguishing it from the 1 an operator-error gate still returns and the 2 an `abort`
returns.

**AC-9 — The status vocabulary is added everywhere a run status is enumerated, and nowhere it is
not.** Add `undecided` to: `packages/core/src/engine/types.ts:24` (`RunStatus`);
`packages/core/src/run-history/manifest.ts:31`; the `TERMINAL_STATUSES` list in **both**
`spike/src/contracts.js:51` and `packages/core/src/contracts/run-manifest.ts:24`; the non-regressed
member of `packages/shared/src/events.ts:222`; the run-level `status` enum at
`contracts/Q-0011/run-manifest.schema.json:23`; and the history-status enum at
`contracts/Q-0006/ticket-review-state.schema.json:23`. **Do not** add it to the *step*/occurrence
enum at `run-manifest.schema.json:68` or to the occurrence status in
`contracts/Q-0011/run-history-writer.contract.md` — an occurrence is never undecided, only a run
is.
*Test:* a manifest carrying `status: undecided` validates under `harness validate` against the
`run-manifest-v1` semantic pass, and an occurrence carrying it is **refused**. The second half is
what stops the word leaking one level down.

**AC-10 — The two frozen contracts this touches are superseded by an erratum, not edited
silently.** `contracts/Q-0011/run-manifest.schema.json` and
`contracts/Q-0050/run-events.contract.md` are frozen ticket contracts; so is
`contracts/Q-0006/ticket-review-state.schema.json`. `requirements/errata.md` records which clause
of each is superseded and why, on the precedent of Q-0073's E-4, which superseded two frozen
Q-0006 contracts for the nit rule.
*Test:* `packages/core/src/contracts/contracts.test.ts` and `validate-artifact.test.ts` stay green
over the edited schemas; the erratum exists and names each file.

**AC-11 — The documentation says the same thing as the code.** `docs/02-sdlc-pipeline-spec.md`
§3.3 lines 127–128 gain `undecided` and state that it moves no stage; `docs/GLOSSARY.md` gains the
word under **Gate** or **Run history** before it appears in a second file, per the vocabulary rule;
`packages/shared/src/ticket.ts:35`'s JSDoc list gains it.
*Test:* `docs.test.ts`; and a source-text assertion that the spec's status list and the shipped
`TERMINAL_STATUSES` name the same set, so the two cannot drift again.

**AC-12 — The run says, in `runs.log` and on the terminal, that the branch and the worktrees were
kept.** One line naming the gate that went unanswered and stating that nothing was rolled back —
the record a maintainer reads before deciding whether to re-run or answer by hand. This is the
mitigation for Risk 2 and is not optional decoration.
*Test:* the end-to-end fixture of AC-5 asserts the line's presence and that it names the gate's
`reason`.

**AC-13 — Charter §3's re-record path is walked.** This ticket changes `spike/src/engine.js`, and
`harness/port-charter.md:279` records `freeze-sha: d50cead…`. Q-0040 is not in the charter's
`children:` list, so the branch-scope job reports it out of scope (the Q-0038 / Q-0057 precedent),
but the freeze-SHA half goes red on `main` by design. Step 1 is satisfied by this ticket landing in
both trees; step 2 is re-recording `freeze-sha` **in a follow-up commit whose parent is the merge**,
per Q-0037's erratum E-1 — a commit cannot contain its own hash.
*Test:* `.github/scripts/port-freeze-guard.test.mjs` green, and the guard demonstrated red at the
merge and clear at the re-record, as Q-0062 and Q-0089 both did.

**AC-14 — Both suites are run forced, in both environment rows.** Per Q-0072's closing finding:
in the `integrate` worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again
on `main` after the merge, where both exist. `npm test --prefix spike`, `pnpm turbo run test
--force`, `harness lint`, and `pnpm sweep:git-identity`.

---

## Non-goals

1. **Making a gate answerable from anywhere but stdin.** M3's server and the `answerGate` callback
   Q-0050 already shipped in `core`. The ticket body says this and it stands.
2. **Resuming an undecided run.** Q-0019, M3. See OQ-3 — this ticket rules on whether `undecided`
   is *meant* to be that state, and builds none of it.
3. **Changing what a gate may answer.** `advance | retry | abort`, unchanged. No new answer word,
   no new flag.
4. **Changing `--auto`.** An `auto` gate still auto-advances; a `human-locked` gate still cannot be
   walked through. `undecided` arises only where a gate genuinely stops.
5. **Changing the setup catch.** `spike/src/engine.js:104` runs before any step exists, for an
   `initialiseRunHistory` failure or the AC-1 collision refusal. It stays `failed`. **The ticket
   body's C-2 raised this so a fix would not change it by symmetry and a reviewer would not report
   its absence as an omission — that is exactly right and it is restated here as a non-goal so the
   reviewer sees it in the requirement rather than only in the ticket.**
6. **Rolling back task branches.** Still not done, still carried by the M1 closing entry, still not
   this ticket.
7. **Colouring `undecided` in `harness runs`.** Measured: `statusLabel`
   (`spike/bin/harness.js:228–230`) paints `completed` green, `running` amber and *everything else*
   dim — `failed`, `aborted`, `regressed`, `interrupted` and `exhausted` are all dim today. So
   `undecided` rendering dim is consistent rather than a gap, and changing it would be changing the
   rendering of six statuses, which is its own change in a file Q-0010 replaces.
8. **Fixing the run-status vocabulary's other drift.** See OQ-2; reported, not fixed here unless
   the gate rules otherwise.

---

## Open questions

**OQ-1 (blocking) — the decision entry.** AC-1's entry must exist before the implement step runs,
and no step on the chore route may write one. **This is the tenth appearance in this backlog of a
loop handed work no agent in it can perform** — the seventh, eighth and ninth are recorded on
Q-0052, Q-0062 and Q-0037, and Q-0062's requirement named the hazard in advance and the run was
launched without the entry anyway, spending three implement rounds on it. Naming it here is not
sufficient; it must be written by hand at the gate. *Owner: the human at the requirements gate.*

**OQ-2 (non-blocking, recommend "fix it in the same edit") — `contracts/Q-0006/ticket-review-state.schema.json`
already omits a status the engine writes.** Its enum is
`["completed","regressed","exhausted","aborted","failed"]`. `interrupted` is missing, and the
engine has written it twice in this backlog (`finish(ctx, …, 'interrupted', …)` on SIGINT/SIGTERM,
`spike/src/engine.js:87`). So a ticket whose history holds an interrupt already fails that frozen
schema, and this ticket is not the first to contradict it. Recommendation: add both `interrupted`
and `undecided` in the same erratum, because they are missing for the same reason — the schema was
frozen at Q-0006 before either status existed — and leaving one behind means shipping a known
contradiction in a file this change is already opening. The alternative, adding only `undecided`,
is defensible on scope grounds and should be chosen deliberately rather than by omission.
*Owner: the human at the requirements gate.*

**OQ-3 (non-blocking, recommend "terminal, not suspended") — is an undecided run resumable?**
Recommendation: **no.** `undecided` is a terminal status. The run is over; what survives is the
branch, the worktrees, the manifest and the ticket's stage, which is everything the next
`harness run` or a human answering by hand needs — and is exactly what Q-0008's manual recovery
reconstructed by hand. Resumption is Q-0019 in M3, and it may later *choose* `undecided` as the
state it picks up; this ticket must not build for that, but the decision entry should say the word
is available for it, so M3 inherits a ruling rather than discovering a question. **The obligation
must go in the decision entry, not only here** — Q-0019 has no folder to carry it, and a deferred
obligation recorded only in a closed ticket's requirement expires.

**OQ-4 (non-blocking, recommend "no") — does `interrupted` join `undecided` on the branch
question?** A maintainer pressing Ctrl-C at a gate is also "nobody decided", and today that also
rolls back. Recommendation: leave `interrupted` where it is. The distinction is principled and
worth writing into the decision entry: **`undecided` is the only non-advancing status reached at a
quiescent point.** The gate is reached after its preceding step has completed and persisted
everything. A signal can arrive anywhere — including mid-`integrate`, between the merge and the
suite — so the branch may hold a state nobody chose, and the rollback is the right default there.
If a later ticket disagrees it should be that ticket's argument, made with a measured instance.
*Owner: the human at the requirements gate.*

**OQ-5 (non-blocking) — should `harness run --auto` ever produce `undecided`?** Under the
recommended shape, yes: `--auto` does not bypass a `human-locked` gate or an exhaustion gate, so an
`--auto` run can still reach one with no answer channel and end `undecided`. That is the current
behaviour of the throw and no criterion changes it, but it deserves one sentence in the decision
entry because it is the case a reader will ask about first.

---

## Risks

**R-1 — `undecided` reintroduces the Q-0033 failure it is exempted from.** The rollback exists
because an exhausted or aborted run used to leave `integrate`'s merges behind, so the next `qa-red`
measured its red phase against a tree that already held the implementation and reported 21 green
and nothing red. Keeping the branch on `undecided` restores exactly that condition.
**Why it is nonetheless safe, and where the safety ends:** the stage does not move, so the flow
that next consumes the ticket is the *same* flow, not the later one whose red phase would be
poisoned. The residual risk is a human who hand-advances the stage without noticing the merge is
already there — and that risk exists after every `completed` run too. **AC-12 is the mitigation and
is load-bearing, not decoration:** the run must say out loud that the branch was kept and name the
gate it was waiting on. This is the strongest argument against the ticket and the decision entry
should answer it explicitly rather than assert the exemption.

**R-2 — a classifier keyed on message text.** `harness.js:96` and `:110` open with the same eight
words. A fix that matches on prose would work on the day it lands and break the first time a
message is reworded, silently and in the direction of destroying work. AC-3 is written to fail such
a fix.

**R-3 — the split predicate drifts.** Q-0062 chose one predicate precisely so the inspection story
and the cleanup story could not disagree. Splitting it removes that structural guarantee. AC-4's
invariant assertion is the replacement; without it this ticket trades a guarantee for a convention,
which is the trade this repository has repeatedly found expensive.

**R-4 — exit-code consumers.** Anything treating "exit != 0" as failure is unaffected (the gate
case was already non-zero). Only a consumer testing `== 1` changes behaviour. Measured: nothing in
either suite or in `harness/` tests `harness run` for exit 1 specifically; `smoke.js:114` asserts
`!== 0`. Low, and stated rather than assumed.

**R-5 — the port freeze goes red mid-flight.** Expected and by design (AC-13). The hazard is
landing the change in one tree only, which would leave the guard reporting divergence it cannot
explain. Both trees in one commit; re-record in the follow-up.

**R-6 — scope drift into the run-status vocabulary.** Six status words already exist across four
enum sites and two frozen schemas, and `exhausted` is in `TERMINAL_STATUSES` and the manifest enum
while never being a *run's* terminal status — it reaches the ticket's `history` through
`recordEvent` / `recordOccurrenceEvent` only. An implementer who does not know that will either add
`undecided` in too few places or "tidy" `exhausted` in passing. AC-9 enumerates the sites for
exactly this reason, and the boundary it draws — run status, not occurrence status — is what keeps
the change bounded.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, `check()` or environment path is touched. |
| **Worktree safety** | Directly engaged. `undecided` keeps every worktree the run obtained (AC-6); no ref is deleted on any path, so *"A run removes the worktrees it made, and never the refs"* (2026-08-31) is unchanged. No flow gains the ability to write to the user's tree. |
| **Gate behaviour** | No answer is invented, no answer word is added, `--auto` is unchanged, `human-locked` is unchanged. Decisions of 2026-08-06 and 2026-08-23 are argued in the entry and neither is contradicted (AC-1). |
| **File format and schema** | `history[].status` may carry a new value — `packages/shared/src/ticket.ts` types it open (`z.string().optional()`), so no schema break; the manifest and event enums are closed and are named in AC-9; three frozen contracts are superseded by erratum in AC-10. No migration: nothing rewrites existing entries, and the spec already says shorter legacy entries stay valid. |
| **Lint rules** | n/a. No flow file changes; `lintFlow` and `harness lint` untouched. |
| **Cold-clone impact** | Neutral to positive, and no new step in the first 30 minutes. An `adopter` whose first unattended run reaches a gate now finds the work intact and a message saying what is waiting, instead of an error and an empty branch. One new exit code, documented in `harness run`'s usage line, not in the README. |

---

## Appendix — measurements, so nothing below is re-derived from prose

Run on 2026-09-01 at `5ccd810`. Re-measure rather than transcribe; three of this ticket's own
inherited claims moved when they were checked.

- Gate throw sites: `spike/bin/harness.js:86, 96, 110, 115, 119`;
  `packages/core/src/engine/routing.ts:25, 38, 41` plus the abort race at `:22`/`:30`.
- `finished` defined: `spike/src/engine.js:665`; `packages/core/src/engine/lifecycle.ts:20`.
  Read at `engine.js:727, 748` and `lifecycle.ts:101, 112`. **Twice, not three times** — C-3 is
  confirmed.
- `finish(…, 'failed')` call sites: `engine.js:104` (setup, not this ticket) and `:207` (step
  loop, this ticket's). C-2 confirmed.
- Existing statuses: `RunStatus` in `packages/core/src/engine/types.ts:24` is
  `completed | regressed | aborted | failed | interrupted`;
  `packages/core/src/run-history/manifest.ts:31` adds `running` and `exhausted`.
  `TERMINAL_STATUSES` (six words) is duplicated at `spike/src/contracts.js:51` and
  `packages/core/src/contracts/run-manifest.ts:24`.
- `exhausted` is written by `recordEvent` (`engine.js:607`) and `recordOccurrenceEvent`
  (`routing.ts:117`) into the ticket's `history` — **never passed to `finish()`**. It is
  history vocabulary, not a run status, despite appearing in the manifest enum.
- Exit codes in use across the whole CLI: 0, 1, 2, 130. **3 is free.**
- `statusLabel` (`harness.js:228`): green for `completed`, amber for `running`, dim for everything
  else.
- Terminal statuses across all `backlog/*/runs.log`: `completed` 73, `exhausted` 37, `failed` 21,
  `aborted` 11, `regressed` 6, `interrupted` 2.
- `failed` records whose error names a gate: **12 of 25**, totalling **$149.65**.
- `rolled-back` lines: **7** (an eighth grep hit is Q-0008's recovery note, not a rollback).
  Four were unanswered gates, two were `aborted`, one was a genuine failure.
- `contracts/Q-0006/ticket-review-state.schema.json:23` enum omits `interrupted`.
- `harness/port-charter.md:279` `freeze-sha: d50cead3c876173d880825f7611a5262442d3c78`;
  `children:` is Q-0041–Q-0054, so Q-0040 is out of the branch-scope half's scope.
