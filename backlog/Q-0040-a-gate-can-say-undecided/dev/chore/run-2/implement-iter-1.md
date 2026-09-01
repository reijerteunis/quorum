# Q-0040 — implement report, chore run 2, iteration 1

*A gate can say "undecided". Both trees, one change. Written against the merged requirement of
2026-09-01 and the decision entry GO-1 obliged, which was landed by hand before this run started.*

**Twelve of fourteen criteria are complete. Two are refused, both for the same reason, and the
reason is not that they are hard:** AC-11 and the erratum it prescribes name surfaces no step on the
chore route may write. §7 below carries the exact edits and the erratum text so the human can land
them in one action. Nothing else is deferred.

---

## 1. What changed, file by file

### The error type, and where it lives

**`spike/src/engine.js`** and **`packages/core/src/engine/types.ts`** each gain
`GateUnansweredError extends FlowError`, carrying `gate: { kind, reason, condition }`.

`condition` is one of `answers-exhausted`, `stdin-closed`, `no-answer-channel` — the three distinct
ways there was no answer to be had. It is read by the run's *report* and never by the classifier,
which is stated in the JSDoc because the distinction is the whole point of AC-3.

**It is a subclass rather than a field on `FlowError`** because a classifier keyed on message text
is the defect this repository keeps finding, and here it would be keyed on two messages that share
their first eight words.

**Both trees put it beside the run loop, not beside `FlowError`.** My first attempt put it in
`lint.ts`/`lint.js`, on the reasoning that a subclass belongs with its base. Two landed pins said
otherwise and they were right:

- `lint.source.test.ts` AC-1 pins `lint/lint.ts`'s export surface to **exactly six names**, and
- AC-12 pins `FlowError`'s class body empty, refusing `super(message` anywhere in the file.

Widening either would have been loosening a guard to admit my change. The class went to
`engine/types.ts` instead — already the file every engine module imports its error identity from —
and `spike/src/engine.js` mirrors that placement so the two trees agree. `types.ts`'s header said
*"No behaviour is declared here"*; it now says no *function* is, and names the one value and why.

### The three sites that raise it

| Tree | Site | Condition | Message |
| --- | --- | --- | --- |
| `spike/bin/harness.js:97` | scripted answers exhausted, stdin not a TTY | `answers-exhausted` | **unchanged** |
| `spike/bin/harness.js:111` | stdin closed mid-question (a `reject`) | `stdin-closed` | **unchanged** |
| `packages/core/src/engine/routing.ts:25` | no `answerGate` callback | `no-answer-channel` | **unchanged** |

The five operator-error sites — `harness.js:86`, `:116`, `:120`, `routing.ts:38`, `:41` — are
untouched and still throw plain `FlowError`. The two abort races (`routing.ts:22`, `:30`) are
untouched.

### The classification

**`spike/src/engine.js`**, step-loop catch: an `instanceof GateUnansweredError` reports and returns
`finish(ctx, ticket.meta.stage, 'undecided', …)`. It does **not** propagate, and it does not enter
the `activeOccurrences` loop — AC-7's "no occurrence is closed as failed by an undecided run" is
structural here rather than incidental, and the suite asserts the manifest to confirm the premise
that a gate allocates none.

**`packages/core/src/engine/engine.ts`**: the same, with `!signal.aborted &&` **in front of** the
`instanceof`. That ordering is AC-3's third clause and is invisible to inspection — an abort is a
decision, a missing answer is not — so it has its own test.

`finaliseActiveOccurrences` keeps its `'failed' | 'interrupted'` signature, per AC-10, because the
undecided path returns before reaching it.

### AC-4 — the predicate split, which is the actual work

`finished()` is gone from both trees. Three predicates replace it and the `if`/`else` becomes two
independent `if`s:

```
if (returnsWorktrees(status)) returnObtainedWorktrees(…)
if (restoresBranch(status) && branchHeadAtStart) { … resetBranchTo(…) }
```

| status | advancesStage | returnsWorktrees | restoresBranch |
| --- | --- | --- | --- |
| `completed` | yes | yes | no |
| `regressed` | yes | yes | no |
| `aborted` | no | no | yes |
| `failed` | no | no | yes |
| `interrupted` | no | no | yes |
| **`undecided`** | **no** | **no** | **no** |

Each predicate spells its own membership out rather than delegating to another, so a seventh status
must answer three questions and cannot inherit two of them by accident.

**The `branchHeadAtStart`-and-moved guard inside the rollback arm is untouched**, and so is the
rollback's warning text — which stays true, because it is printed only on the three statuses that
still restore.

**The comments that described the two halves as one predicate were rewritten in the same change**,
per AC-4's last sentence: `lifecycle.ts`'s module header, the three predicate JSDoc blocks, and
`engine.js`'s block comment above the conditional. That comment's clause *"a run that did not
complete leaves the ticket branch as it found it"* is now false for one status, so it names the
three that do and the one that does not.

### AC-13 — what the run says

Two warnings and one `runs.log` line, emitted **before** `finish()` so they precede the terminal
line, as Q-0062's cleanup count does:

```
! gate (human) "Chore owner approves the review" needs an answer and stdin closed without one — …
! gate (human) went unanswered — stdin closed while the question was open; nothing was rolled back:
  harness/T-0001/integration stays at 9a1c4e2, 2 worktrees kept
```
```
run=1 undecided-gate kind=human condition=stdin-closed branch=harness/T-0001/integration
      kept-at=9a1c4e2 kept-worktrees=2
```

**The first line is the diagnostic verbatim**, and printing it is not decoration. It used to reach
the operator through `die()` on the failure path this status no longer takes — `smoke.js:116`
(`/stdin closed without one/`) went red the first time I ran the suite, which is that assertion
doing exactly its job and is why AC-9 names it.

The `run=` prefix carries **this** run's id, so `nextRunId`, which reads every line of the file, is
where it was.

### AC-9 — exit 3

`process.exit(r.status === 'aborted' ? 2 : r.status === 'undecided' ? 3 : 0)`. The census in the
requirement holds: 0 and 2 at `:553`, 1 through `die` and four `process.exitCode` sites, 130 at
`engine.js:87`. 3 was free. `harness run`'s usage line in the CLI header gained
`exits 2 aborted, 3 gate unanswered` **without adding a line**, because the `default:` branch prints
`slice(1, 10)` and a new line would have pushed `harness runs` out of the help output.

### AC-10 — the vocabulary, and where it stops

Added: `engine/types.ts` `RunStatus` and `NonRegressionRunOutcome.status`;
`run-history/manifest.ts` `RunStatus`; `TERMINAL_STATUSES` in **both** `spike/src/contracts.js` and
`packages/core/src/contracts/run-manifest.ts`; the non-regressed member of
`packages/shared/src/events.ts`; the JSDoc list in `packages/shared/src/ticket.ts`.

Not added: `finaliseActiveOccurrences`'s `'failed' | 'interrupted'`, and the occurrence-level enums
in the frozen schemas (§7).

**One honest wrinkle, stated rather than smoothed.** `run-history/manifest.ts` exports *one*
`RunStatus` that both a run and an occurrence are typed with, so widening it is what AC-10 asked for
and it does let an occurrence be typed `undecided`. Splitting it into two types would have been
scope AC-10 did not authorise and would have moved `run-history.source.test.ts`'s export register.
The JSDoc now says plainly that the two levels no longer admit the same set and that **the schema,
not the type, is what refuses it one level down** — which is true today only once §7 lands.

### AC-12 — the documents

`docs/02-sdlc-pipeline-spec.md` §3.3's status list gains `undecided` **and a paragraph** saying what
it means, since a word added to a list says nothing; the status line at the top is bumped.
`docs/GLOSSARY.md` gains an **Undecided** entry before the term appears in a second file, with the
explicit *"Not a synonym for 'aborted', 'failed' or 'paused'"* the vocabulary rule wants.

The drift guard AC-12 asks for is `packages/shared/src/docs.test.ts`: it reads the words out of
§3.3's own sentence and out of `spike/src/contracts.js`'s `TERMINAL_STATUSES` declaration and
requires the two sets to be equal. **Neither side is a literal in the test**, so it fails when either
moves alone and passes only when they move together. `packages/shared` already declares both files
as turbo inputs, so no new declaration was needed.

Its citation assertions read the documents **with line breaks collapsed**. The first version did not
and went red on both documents, because the cited title soft-wraps — the exact blindness Q-0050's
review found four rounds deep, met again on the way in.

---

## 2. A check my change made false, and what I did about it

`packages/core/src/run-history/manifest.test.ts` carried a test named
***"and RunStatus admits exactly the statuses the schema does"***. It does not check that: `every` is
a hand-written seven-word array that is merely *assignable* to `RunStatus[]`, so widening the type to
eight left the test green under a title that had stopped being true.

This is the repository's most-recorded defect class arriving as a side effect rather than as a
subject, and leaving it would have shipped a guard whose name overstates it. Since the schema edit is
refused (§7), the two genuinely are one word apart right now. The test is rewritten to say so: it
pins the schema's seven, pins that `RunStatus` carries exactly `undecided` beyond them, and states in
its own comment that this is a **registered divergence pending the erratum**.

**Consequence the human should expect:** landing §7's schema edit turns this assertion red, and it is
meant to. The pin has to move in the same change, which is what stops a temporary gap becoming a
permanent one.

---

## 3. Tests

**`spike/test/q0040-undecided.js`** — 345 lines, new. Twelve scenarios plus a five-case fixture
table.

**`packages/core/src/engine/undecided.test.ts`** — 355 lines, new. Fifteen tests across AC-2, AC-3,
AC-5, AC-6, AC-7, AC-8, AC-10 and AC-13.

**`packages/core/src/engine/lifecycle.test.ts`** — AC-4's three-way table over all six statuses with
the `!(returnsWorktrees && restoresBranch)` invariant, plus `undecided` added to the two existing
matrices. The invariant is what replaces the structural guarantee the `if`/`else` used to provide;
without it AC-4 is a rename.

**`packages/shared/src/events.q0050.test.ts`** — the terminal union accepts `undecided`, carries no
regression fields with it, and the **gate-answer** union still refuses it. That second half sits in a
different suite from `docs.test.ts` on purpose: deleting either leaves the other standing.

### AC-5's fixture moves the branch before the gate

Both end-to-end fixtures are implement → integrate → gate, **with the integration branch created
before the run**. That line is load-bearing twice and it caught me: the rollback is additionally
guarded by `branchHeadAtStart` being truthy, so a branch the run itself created is spared the reset
whatever its status — my first control case reported "no rollback" for a reason that had nothing to
do with the classification. A gate reached before any merge proves nothing, which is why
`chore.yaml`'s exhaustion gate — which precedes `integrate` — left no `rolled-back` line in any of
the twelve historical runs.

### The three TTY sites are now reachable, for the first time

`harness.js:111`, `:116` and `:120` sit behind `if (!process.stdin.isTTY)`, so a spawned process
could never reach them — a pipe is never a TTY — and the suite's only coverage was
`q0033-surface.js`'s `skipped('S10.5', 'requires an interactive TTY …')`.

They are reached now through a one-line preload: `node --import <tmp>/tty.mjs <bin> run …`, where
`tty.mjs` is `process.stdin.isTTY = true;` and nothing else. The binary still runs as the main
module, unmodified, with the `process.argv` an adopter's terminal would give it. It is a value the
test sets itself, which *"A test's verdict is a property of the commit"* (2026-08-30) explicitly
permits; nothing is read from the machine.

**The first version used a wrapper that imported the binary**, and `spike-parity.test.ts` refused it
— `import(<computed>)` is a specifier its scan cannot read, and it fails closed rather than
defaulting the file to library-only. The preload has no dynamic import at all. The guard working as
designed, and the second time in this run that a landed check redirected the implementation.

### Red before green

AC-5 asks for the fixtures to be demonstrated against the unchanged engine, in both suites. Done by
disabling the `instanceof` branch in both trees and restoring it afterwards.

| | red | green | control cases, red run |
| --- | --- | --- | --- |
| spike | 13 scenarios + 4 `smoke.js` assertions, 2 of 19 files | 19 of 19 files | all stayed green |
| core | 8 of 15 in `undecided.test.ts` | 1275 passed | all 4 stayed green |

**The control cases staying green is the part that matters**, because it is what says the tests
discriminate rather than merely fire: the operator-error gate still rolled its branch back, the
`advance` gate still removed its worktrees, the invalid envelope and stale gate id still failed, and
an abort during an open gate was still `interrupted`.

The core AC-5 failure is verbatim
`expected GateUnansweredError { … } to be undefined` — the run throwing, which is what it did before.

Three guards were additionally mutated one at a time to show they have subjects:

- spec status list minus `undecided` → *"§3.3 and TERMINAL_STATUSES name the same seven words"* red;
- glossary `**Undecided**:` → `**Unanswered**:` → the glossary clause red;
- AC-4's table row set to `returns: true, restores: true` → **both** the row test
  (`worktrees: expected false to be true`) and the invariant (`undecided: expected true to be false`)
  red, separately.

---

## 4. `spike-parity.test.ts` — the largest single move this register has recorded

`q0040-undecided.js` is registered `split`: it drives the engine directly **and** spawns the binary,
because two of its five gate sites live in `bin/` and no library test can reach them.

| | before | after |
| --- | --- | --- |
| binary-only | 220 | 220 |
| both (entangled) | 2294 | **2647** |
| library-only | 2469 | 2469 |
| total | 4983 | **5336** |
| transfers at Q-0010 | 50% | **54%** |

345 lines of new file plus `smoke.js` +8, all of it entangled. Four points in one ticket, re-derived
from the tree rather than adjusted to fit, and stated rather than rounded away — an entangled file
makes Q-0010's inheritance larger, which is the direction this register exists to show honestly. The
identity lists, the two-segment spelling count (4 → 5), the distinct-counterpart count (29 → 31) and
the verdict counts all moved with it.

**My first comment on this pin predicted 51%.** It was arithmetic done in my head and it was wrong;
the guard computed 54% and the comment now says 54%. Recorded because a prediction written into a
durable comment is exactly how a stale number gets there.

---

## 5. Q-0072's input guard earned three registrations

`turbo-inputs.test.ts` refused the new core test on three counts and each was a real question:

- `'.quorum/runs'` as a quoted literal — **fixed rather than registered**, by reading
  `RUN_HISTORY_ROOT`, `MANIFEST_FILE` and `runIdOf` from `@quorum/shared`, so the file names no path
  a working checkout also holds;
- `await import('./engine.js')` — made a static import;
- `fixture.ticketDir`, `fixture.repoDir` and `worktreeOf(fixture.repoDir, branch)` — registered with
  what each base is, alongside the identical entries `worktree-lifecycle.test.ts` already carries.

---

## 6. Verification

Run in this implement worktree, everything forced, after `pnpm install --frozen-lockfile` and
`npm install --prefix spike`:

| | |
| --- | --- |
| `npm test --prefix spike` | **19 / 19 test files** |
| `pnpm turbo run test lint typecheck --force` | **21 / 21 tasks, 0 cached** — core 1275 passed / 2 skipped in 57 files, shared 142 |
| `node spike/bin/harness.js lint` | **6 / 6 flows** |
| `pnpm sweep:git-identity` | green — both suites executed with no resolvable identity |

**The two environment rows Q-0072's closing finding requires are not both done here**, and cannot be:
`integrate` runs the second, and the forced re-run on `main` after the merge is the human's. Only the
implement worktree row is mine and it is the one above.

**AC-14's freeze half.** `git diff d50cead…main -- spike/src` is **empty** today, so the guard is
clear on the base. This ticket changes `spike/src/engine.js`, so the freeze-SHA half goes red at the
merge **by design**, and step 2 — re-recording `freeze-sha` in a **follow-up commit whose parent is
the merge** — is the human's, because a commit cannot contain its own hash (Q-0037 erratum E-1).
Q-0040 is not in the charter's `children:` list, so the branch-scope half reports it out of scope on
the Q-0038 / Q-0057 precedent. I could not execute `.github/scripts/port-freeze-guard.sh` or its
`.test.mjs` in this sandbox; CI runs both.

---

## 7. GO-2 — refused, with the exact work: AC-11 and its erratum name surfaces this flow cannot write

**This is the eleventh appearance in this backlog of a loop handed work no step in it can perform,
and it is a new instance rather than a repeat.** The requirement checked the surface question for
`docs/decisions/` and made it GO-1; it did not ask the general question of `contracts/`. That is
Q-0069's AC-11(b) finding arriving through a document again — *"it checked the one unwritable surface
anyone had written down and never asked the general question."*

**The measurement.** `harness/roles/developer-generalist.md:2` closes the list:
`[package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github,
packages, apps, spike, harness, docs]`. `contracts/` is in **no** role's `paths` — and
`principal-architect.md` has no `paths` frontmatter at all, which is how the architect writes them,
matching *"Solutioning emits contracts"* (2026-08-21) and every `architect:` commit in
`git log -- contracts/`. The one hand-edit precedent, Q-0077's `6140814`, is Ruud's own commit and
touches `backlog/…/ticket.md` in the same change. **The chore flow has no architect step**, so on
this route `contracts/` is unwritable. `requirements/errata.md` is worse than unwritable: `commitAll`
(`spike/src/fanout.js:82–88`) reverts and cleans `backlog/` in the worktree and reports the discard.

**Why refusing costs nothing today.** Nothing validates a manifest against the schema at run time —
`writer.ts` performs no validation — so the feature works and the gap is confined to
`harness validate` refusing an undecided run's manifest until the enum moves. No existing test goes
red either way; the only casualty is the *first half* of AC-10's test, which I have registered rather
than faked (§2).

### The five edits, verbatim

**1. `contracts/Q-0011/run-manifest.schema.json:23`** — the **run-level** enum only. Line `:68`, the
occurrence enum, must **not** move.

```diff
-    "status": { "enum": ["running", "completed", "failed", "aborted", "regressed", "exhausted", "interrupted"] },
+    "status": { "enum": ["running", "completed", "failed", "aborted", "regressed", "exhausted", "interrupted", "undecided"] },
```

**2. `contracts/Q-0006/ticket-review-state.schema.json:23`** — both words, per ruling **R-B**.
`interrupted` is missing today and `spike/src/engine.js:85` writes it, so a ticket whose history holds
an interrupt already fails this frozen schema, independently of this ticket.

```diff
-          "status": { "enum": ["completed", "regressed", "exhausted", "aborted", "failed"] },
+          "status": { "enum": ["completed", "regressed", "exhausted", "aborted", "failed", "interrupted", "undecided"] },
```

**3. `contracts/Q-0050/run-flow-api.contract.ts`** — lines 6 and 18.

```diff
-export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted';
+export type RunStatus = 'completed' | 'regressed' | 'aborted' | 'failed' | 'interrupted' | 'undecided';
-export interface NonRegressionRunOutcome { status: 'completed' | 'aborted' | 'failed' | 'interrupted'; …
+export interface NonRegressionRunOutcome { status: 'completed' | 'aborted' | 'failed' | 'interrupted' | 'undecided'; …
```

Line `:14`'s `finaliseActiveOccurrences(status: 'failed' | 'interrupted', …)` stays as it is.

**4. `contracts/Q-0050/lifecycle-routing.contract.md`** — lines 15 and 24.

```diff
-- Persist counters and one terminal line for completed, regressed, aborted, failed, and interrupted.
+- Persist counters and one terminal line for completed, regressed, aborted, failed, interrupted, and undecided.
-- For non-dry failed, aborted, or interrupted runs, reset the ticket branch when both start and
+- For non-dry failed, aborted, or interrupted runs — and not for undecided — reset the ticket branch when both start and
```

**Line `:58` needs no change, and I re-read it to be sure rather than editing it because the
requirement listed it.** It reads *"Its seven terminal regression values use the pre-mutation stage
and clamp remaining at zero"* — those seven are the **regression payload's fields**, not statuses,
and they are unchanged. Lines `:16–19`'s *"Move the stage only for completed and regressed"* stays
true and must not be edited either.

**5. `contracts/Q-0050/run-events.contract.md:45`.**

```diff
-      status: 'completed' | 'aborted' | 'failed' | 'interrupted';
+      status: 'completed' | 'aborted' | 'failed' | 'interrupted' | 'undecided';
```

Line `:80`'s *"On failure, the next pull after that value rejects"* needs **no** amendment: it is
already conditioned on failure, and `undecided` is by construction not one — which is what turned
iteration 1's second blocker into ruling R-A.

**And after landing edit 1**, `packages/core/src/run-history/manifest.test.ts`'s
*"RunStatus and the schema are one word apart"* goes red on purpose and its two lines collapse back
into the equality the original title claimed.

### The erratum, for `backlog/Q-0040-a-gate-can-say-undecided/requirements/errata.md`

> **E-1 — five frozen contracts are superseded by this entry, and the implement step may not edit
> them.**
>
> AC-11 requires edits to five files under `contracts/`. `contracts/` appears in no role's `paths`
> frontmatter and is written by `principal-architect`, which has no `paths` at all — the role
> solutioning uses, and a step the chore flow does not have. `harness/architecture.md`'s fan-out
> table grants it to nobody. The implement step therefore refused the edits and supplied them in its
> report; they were landed by hand. This is *"A requirement may not name a surface its flow cannot
> write"* (2026-08-25) applied to a surface the requirement did not check, which is the same shape as
> Q-0069's AC-11(b) and is recorded here so the next requirement asks the general question.
>
> The clauses superseded, and why each stays literally true while ceasing to be complete:
>
> 1. `contracts/Q-0011/run-manifest.schema.json:23` — the run-level enum gains `undecided`. `:68`,
>    the occurrence enum, does not: a gate allocates no occurrence, so nothing one level down can be
>    undecided.
> 2. `contracts/Q-0006/ticket-review-state.schema.json:23` — gains `undecided` **and** `interrupted`
>    (ruling R-B). The second is a pre-existing contradiction: `spike/src/engine.js:85` has written
>    `interrupted` into ticket history since Q-0004, and this schema has refused it ever since.
>    Closing one and knowingly leaving the other in a file being opened anyway was rejected.
> 3. `contracts/Q-0050/run-flow-api.contract.ts:6, :18` — two closed unions widen. `:14`
>    (`finaliseActiveOccurrences`) does not, which is AC-10's boundary.
> 4. `contracts/Q-0050/lifecycle-routing.contract.md:15, :24` — the terminal-status list, and the
>    branch-reset rule this ticket changes. `:58` and `:16–19` are re-read and unchanged: the first
>    is about the regression payload's seven fields, the second stays true.
> 5. `contracts/Q-0050/run-events.contract.md:45` — the terminal-event union. `:80` needs no
>    amendment, being already conditioned on *failure*, which `undecided` is not.

---

## 8. Neighbours reported and not fixed

1. **One pre-existing lint warning**, unrelated and untouched:
   `packages/core/src/backlog/backlog.ts:276  warning  Unused eslint-disable directive
   (no problems were reported from 'no-control-regex')` — Q-0080's line, empty diff against `HEAD`.
   Left alone: no criterion names it and removing a suppression is a decision, not machinery.
2. **`q0033-surface.js`'s `skipped('S10.5', 'requires an interactive TTY …')` is now stale.** The
   preload technique in `q0040-undecided.js` reaches exactly the branch that scenario declared
   unreachable. Not touched here — re-aiming a neighbouring ticket's skip is scope this requirement
   does not authorise — but it is the cheapest coverage in the suite for whoever wants it.
3. **`packages/core/src/run-history/manifest.ts`'s `RunStatus` types a run and an occurrence with one
   union**, so `undecided` is *typeable* on an occurrence even though nothing writes it there. AC-10
   directed the widening and did not ask for a split; the JSDoc says which side actually refuses it.
   Worth a successor if M3's server starts constructing occurrences.

## 9. What a reviewer should check first

1. **§7's refusal** — is `contracts/` genuinely outside this route, or have I over-read the role? The
   measurement is `harness/roles/*.md` frontmatter and `git log -- contracts/`; both are one command.
2. **The abort-precedence ordering** in `engine.ts` — it is one `&&` and it is invisible to reading.
   The test for it is `an abort arriving while the gate is open is interrupted, not undecided`.
3. **Whether AC-4's invariant is actually load-bearing**, or whether the table alone would do. My
   claim is that the table describes six statuses and the invariant describes the *rule*, so a
   seventh added carelessly fails the invariant before anyone notices the table is short.
4. **The `manifest.test.ts` repair (§2)** — I changed a test I was not sent to change. The
   justification is that my own change made its title false; if that is judged wrong, the revert is
   one hunk and the consequence is a guard that overstates itself.
