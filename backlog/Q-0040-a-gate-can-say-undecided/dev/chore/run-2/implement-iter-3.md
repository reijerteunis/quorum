# Q-0040 — implement, chore run 2, iteration 3

Revision round. Review round 2 (`review/chore/run-2/chore-iter-2.md`) returned **revise** with four
majors. **Three are implemented and verified; one is refused with its authority and routed to the
human gate**, with the artifact it asks for supplied in full below so the refusal costs nothing but
a signature.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | `requirements/errata.md:42` — AC-11's E-2 is missing | **Refused** — unwritable surface; draft supplied below |
| 2 | `engine.ts:134` — AC-13's line omits `gate.reason` | Fixed, red demonstrated |
| 3 | `spike/src/engine.js:792` — the same gap | Fixed, red demonstrated |
| 4 | `lifecycle.test.ts:250` — the AC-4 table is not exhaustive | Fixed, both halves demonstrated |

---

## Major 1 — refused: E-2 is the human's, and no step on this route can write it

**The finding is correct.** All five frozen contracts were edited in round 2 and each carries an
in-file note saying it is *"superseded by Q-0040's `requirements/errata.md`"*. That erratum holds
only E-1. Five supersession notes point at a paragraph that does not exist, and AC-11 requires it.

**Why this round did not write it, measured rather than asserted.**

1. `harness/roles/developer-generalist.md:23` — *"The backlog belongs to the harness — you never
   write a ticket file, and the engine discards it if you do."* `requirements/errata.md` is
   `backlog/Q-0040-a-gate-can-say-undecided/requirements/errata.md`.
2. The engine enforces it rather than merely stating it. `commitAll`
   (`spike/src/fanout.js:82–88`) runs `git status --porcelain -- backlog` before every implement
   commit, then `git checkout -- backlog` and `git clean -qfd -- backlog`, and warns
   *"discarded N edit(s) under backlog/ — the engine owns ticket state, not the agent"*
   (`spike/src/engine.js:376`). An E-2 written here is reverted before the harness commits, so the
   round would end with the finding intact and the run reporting a fix.
3. E-1 is itself the precedent: it was *"written by hand at this run's gate"* and rules that a
   correction to a landed decision entry is *"doubly the human's"*.

**This is the twelfth appearance in this backlog of a loop handed work no step in it can perform**,
and the second on this ticket — E-1 recorded the eleventh. Per *"A refused finding is a gate, not
another round"* (2026-08-31), a refusal goes to the human gate rather than to another traversal,
and per *"An erratum is the last repair, not the first"* (2026-08-30) it is raised the moment the
contradiction is provable, which is now.

**The five files are correct as they stand and need no further change.** Round 2's edits are what
AC-11 asks for; what is missing is only the erratum they cite. `lifecycle-routing.contract.md:58`
(*"its seven terminal regression values"*) was re-read this round and is about the **regression
payload's** seven fields, not the status list — round 2 was right to leave it, and it is named here
so its absence is not read as an omission.

### Draft E-2, to be appended to `requirements/errata.md` by hand at the gate

Supplied verbatim so the gate is a signature rather than a drafting session. Nothing in it was
invented here: every clause is measured against the round-2 diff.

```markdown
## E-2 — the five frozen contracts named by AC-11, and what each one's supersession is

**The finding.** `contracts/` holds five frozen files whose text describes an engine with five
terminal run statuses. The engine now has six. AC-11 requires each to be superseded by an erratum
naming the clause and the reason, on the precedent of Q-0073's E-4, rather than edited silently.
Each file carries an in-file note pointing at this paragraph; this is the paragraph.

**1. `contracts/Q-0011/run-manifest.schema.json:23` — the run-level `status` enum.** Was
`["running","completed","failed","aborted","regressed","exhausted","interrupted"]`; gains
`"undecided"`. Without it `harness validate` refuses a manifest that valid new behaviour produced.
**The occurrence enum at `:68` is deliberately untouched**: an occurrence is never undecided,
because a gate allocates none, and that boundary is what keeps the word one level up.

**2. `contracts/Q-0006/ticket-review-state.schema.json:23` — the ticket-history `status` enum.**
Was `["completed","regressed","exhausted","aborted","failed"]`; gains `"interrupted"` and
`"undecided"`. Two members, not one, per the requirement's ruling **R-B**: `interrupted` has been
written by `spike/src/engine.js:85` since Q-0050 and is missing for the same reason `undecided`
is — the schema was frozen at Q-0006 before either status existed — so a ticket whose history holds
an interrupt already failed this schema, independently of this ticket. Leaving it behind would mean
knowingly shipping a contradiction in a file this change is already opening.

**3. `contracts/Q-0050/run-flow-api.contract.ts:6` and `:18` — two closed unions.** `RunStatus` and
`NonRegressionRunOutcome['status']` each gain `'undecided'`. `finaliseActiveOccurrences`'s
`'failed' | 'interrupted'` at `:14` is **not** widened, for the reason in item 1.

**4. `contracts/Q-0050/lifecycle-routing.contract.md:15` and `:24`.** `:15`'s terminal-line list
gains `undecided`. `:24` — *"For non-dry failed, aborted, or interrupted runs, reset the ticket
branch…"* — is **the clause this ticket changes**, and it is the one a reviewer would consult to
decide whether `undecided` resets. It stayed literally true when the status was added and became
incomplete as a specification, which is a worse failure than being false: a list one reads for an
answer that is not in it. It gains the explicit sentence that `undecided` does not reset and is the
only non-advancing status that does not. `:16–19` (*"Move the stage only for completed and
regressed"*) stays true and is not edited; `:58`'s *"seven terminal regression values"* is about the
regression payload and not about statuses, and is not edited either.

**5. `contracts/Q-0050/run-events.contract.md:45` — the terminal-event union.** The non-regressed
member gains `'undecided'`. **`:80`'s *"On failure, the next pull … rejects"* needs no amendment**:
it is already conditioned on *failure*, and an undecided run did not fail, so the frozen prose
already discriminates correctly once the status is admitted. That measurement is what reduced
ruling R-A from a contract rewrite to an enum widening.

**Authority.** *"A run nobody answered is undecided, and keeps the branch it proved"* (2026-09-01),
and the requirement's §5 table and rulings R-A and R-B. `contracts/` is frozen Q-0006 / Q-0011 /
Q-0050 output; superseding by erratum rather than by silent edit is the Q-0073 E-4 shape.
```

---

## Majors 2 and 3 — the disposition names the gate's own reason, in both trees

**The finding is correct and the criterion is explicit about it.** AC-13's *Test:* clause requires
the fixture to assert *"that it names the gate's `reason`"*. Both records named only the `kind`. A
flow may hold more than one gate of one kind — `chore.yaml` has an exhaustion gate and a terminal
`human` gate — so `kind=human` identifies neither. The reason reached the operator only through the
verbatim diagnostic emitted beside the disposition, which is a different sentence with a different
job, and `runs.log` had it nowhere at all.

### `spike/src/engine.js` — `reportUndecided`

The warning is now spelled as `bin/harness.js:97` already spells a gate, so the two lines an
operator sees name the gate identically:

```
warn gate (human) "Chore owner approves the review" went unanswered — stdin closed while the
     question was open; nothing was rolled back: harness/T-0001/integration stays at c647d3f,
     2 worktrees kept
```

and the durable record:

```
run=1 undecided-gate kind=human reason="Chore owner approves the review" condition=stdin-closed
      branch=harness/T-0001/integration kept-at=c647d3f kept-worktrees=2
```

**The reason is `JSON.stringify`d in `runs.log` and not interpolated raw.** That is the file's own
convention for prose (`error=${JSON.stringify(...)}` at `:335` and `:836`) and it is load-bearing
rather than cosmetic: a gate reason is flow-authored text, `runs.log` is one line per record, and a
reason carrying a newline would otherwise split one record into two. No truncation was added — that
would be behaviour the requirement did not ask for, and the encoding alone closes the line-format
hazard.

The comment above the function gained one clause naming the reason and one naming the two spellings.

### `packages/core/src/engine/engine.ts` — the same function, same wording

Byte-identical sentence and byte-identical `runs.log` shape. Both trees in one change, per this
ticket's scope note and the Q-0066 / Q-0068 / Q-0070 shape.

### Tests, and the red demonstration

- `spike/test/q0040-undecided.js` — the existing AC-13 whole-string matches now carry the reason,
  and a **new scenario** asserts each record names it on its own, so a reword that drops it fails
  saying *which* of the two lost it rather than failing a 200-character string comparison.
- `packages/core/src/engine/undecided.test.ts` — the same, mirrored.

**Demonstrated red before green in both trees, by reverting the production line and re-running:**

- core: `× the diagnostic is verbatim…` and `× both records name the gate's own reason…` —
  `AssertionError: expected 'gate (human) went unanswered — the ru…' to contain '"Chore owner
  approves the review"'`. 2 failed, 14 passed.
- spike: the same two scenarios fail, the other twelve in the file pass —
  `disposition must name the reason: warn gate (human) went unanswered — …`.

The new assertions are aimed at this fixture's own reason, which appears nowhere else in the run's
output except in the verbatim diagnostic, so neither can be satisfied by the sentence beside it.

---

## Major 4 — the AC-4 table is the vocabulary, not a list somebody remembered to extend

**The finding is correct, and the comment it names was the worst part of it.** Lines 270–272 claimed
*"A seventh status added without answering all three questions fails the table above"*. Nothing made
that true: `TABLE` was a hand-written array of six rows, so a seventh `RunStatus` would take all
three lifecycle decisions and evade the invariant while the suite reported green — a check
asserting a property of its own literal rather than of its subject, which is this repository's
most-recorded defect class and the one AC-4 exists to prevent.

`packages/core/src/engine/lifecycle.test.ts`:

1. `TABLE` is now `Readonly<Record<RunStatus, Consequences>>`, keyed by the union itself, and the
   rows the parameterised test walks are derived from it with `Object.entries`.
2. A new first test asserts the record's key set equals the `RunStatus` union **read out of
   `engine/types.ts`**, via `declaredRunStatuses()`. It takes the text from `coreSourceFiles()`,
   which the package already collects — deliberately, so this file adds no path literal for
   `turbo-inputs.test.ts` to want registered, which is the same reasoning `q0050.source.test.ts`
   records. It throws when the file, the declaration or its members are missing, rather than
   reporting a pass over nothing.
3. The invariant and the file-level comment now say what actually fires.

**Both halves demonstrated, by temporarily adding a seventh member to `RunStatus`:**

- the suite goes red — `expect([...Object.keys(TABLE)].sort()).toStrictEqual([...declaredRunStatuses()].sort())`,
  `- "seventh"`, 1 failed / 23 passed;
- `tsc --noEmit` goes red — `lifecycle.test.ts(278,9): error TS2741: Property 'seventh' is missing …
  but required in type 'Readonly<Record<RunStatus, Consequences>>'`.

Two independent gates, so the guarantee does not depend on which command somebody happens to run.
The union was restored and both are green.

---

## File by file

| File | Change |
| --- | --- |
| `spike/src/engine.js` | `reportUndecided` names `error.gate.reason` in the warning and, JSON-encoded, in `runs.log`; comment extended. |
| `packages/core/src/engine/engine.ts` | The same, in the same words. |
| `spike/test/q0040-undecided.js` | AC-13 assertions carry the reason; one new scenario asserts each record names it on its own. 380 → 394 lines. |
| `packages/core/src/engine/undecided.test.ts` | The same, mirrored. |
| `packages/core/src/engine/lifecycle.test.ts` | `TABLE` keyed by `RunStatus`; `declaredRunStatuses()` reads the union from `types.ts`; new vocabulary test; comments corrected. |
| `packages/core/src/spike-parity.test.ts` | Line pins **re-derived**, not adjusted: `both` 2706 → 2720, total 5395 → 5409, share 54% before and after — stated rather than skipped, because "it did not move" is a measurement. |

## Deliberately left alone

- **The five contract files.** Round 2's edits are what AC-11 specifies. Only the erratum is
  outstanding, and it is major 1.
- **`contracts/Q-0050/lifecycle-routing.contract.md:58`** and **`run-events.contract.md:80`** —
  re-read this round; neither is about the status vocabulary, and the requirement says so.
- **The occurrence enums** (`run-manifest.schema.json:68`, `run-history-writer.contract.md:75`,
  `finaliseActiveOccurrences`). AC-10 forbids widening them and the review agrees.
- **The verbatim diagnostics** at `harness.js:96` and `:110`. AC-9 requires their wording unchanged;
  they are emitted beside the disposition, not merged into it.
- **The reason's length.** No truncation added — unrequested, and `JSON.stringify` already keeps
  `runs.log` one line per record.
- **`spike/src/engine.js:104`**, the setup catch. Non-goal 5.
- **`packages/core/src/backlog/backlog.ts:276`** — ESLint reports one pre-existing
  *"Unused eslint-disable directive"* warning there. Not a file this ticket touches, not an error,
  and fixing it in passing is the scope creep the role forbids. Reported, not fixed.

## Verification

Both suites installed and run in this worktree (`pnpm install --frozen-lockfile` — already
satisfied; `spike/node_modules` present from an earlier round of this run).

| Command | Result |
| --- | --- |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached** — core 57 files / 1279 passed, 2 skipped |
| `npm test --prefix spike` | **19/19 test files passed** |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** — 0 errors, 1 pre-existing warning (above) |
| `node spike/bin/harness.js lint` | **6/6 flows** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |

**Not run this round, with the reason:** `.github/scripts/port-freeze-guard.test.mjs` — the harness
permission allow-list admits `node spike/*` only, and no file outside `spike/src/engine.js` (already
moved in round 1) changed in a way the guard reads, so this round moves nothing it did not already
see. Reported as unrun rather than as green.

## Named for the human at the gate

1. **AC-11's erratum E-2 is outstanding and is yours.** The draft above is complete; appending it to
   `requirements/errata.md` discharges the criterion and closes the five in-file citations that
   currently point at a missing paragraph. **The five contract files must not be reverted to make
   the citations consistent** — the erratum is the thing that is missing, not the edits.
2. **AC-14's freeze-SHA re-record** is still owed as a follow-up commit whose parent is the merge
   (`harness/port-charter.md:279`, and Q-0037 erratum E-1: a commit cannot contain its own hash).
   `spike/src/engine.js` moved again this round.
3. **No decision entry is implied by this round.** Everything here follows from
   *"A run nobody answered is undecided, and keeps the branch it proved"* (2026-09-01), its erratum
   `077`, and the merged requirement. Stated because the role requires me to name one if my work
   implies it.
