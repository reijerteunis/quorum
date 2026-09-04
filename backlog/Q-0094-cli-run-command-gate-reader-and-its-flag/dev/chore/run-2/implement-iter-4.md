# Q-0094 implement — run 2, iteration 4

**A revision round that changes two comments and no behaviour**, because both of review iteration 3's
majors are refused by `requirements/errata.md` **E-3**, which this round did read. The two comments
are the Q-0091 round-4 move: turn the reasoning an implement step keeps re-deriving into a citation
of the ruling, so a fifth round meets the erratum in the file rather than arguing with the prose
again.

---

## 1. Review iteration 3's findings, each addressed

### Major 1 — `docs/06-development-plan.md:770`, *"restore the measured split, E-2 says the edit must stay"*

**Refused. E-3(a) withdraws the clause the reviewer cites.**

The finding is correct that E-2 said both doc edits must stay. E-3(a) withdraws the half of E-2 that
covered `docs/06-development-plan.md`: that page's Q-0094 bullet is rewritten by the human at the plan
pass after every child of Q-0010 ships — five times so far — and its throw-site clause is corrected
there rather than by an implement step mid-run. Iteration 3's revert therefore stands, and the file is
**untouched on this branch**:

```
$ git diff main...HEAD --stat -- docs/
 docs/04-architecture.md | 4 +-
```

`docs/06-development-plan.md` does not appear. Nothing was re-added and nothing was removed this
round.

**What is *not* withdrawn** is E-2's architecture clause, and that edit stays: `docs/04-architecture.md`
said *"Since Q-0093 it dispatches five commands"* and this ticket lands the sixth, so the sentence is
false the moment the branch merges. The change there is two lines — the count sentence and the status
line — and the status line says in as many words that this one sentence is the exception rather than
an invitation, so the document carries its own scope note. Verified unchanged from iteration 3.

**The mechanism E-3(a) names is worth confirming rather than repeating.** E-3 records that `E-2 — §8`
appeared zero times in implement iteration 3's prompt, so that round could not read the ruling it was
later judged against. This round's inputs carry **E-1, E-2 and E-3**. So the window exists but is not
guaranteed, which supports E-3's remedy — rule at a gate — rather than contradicting it. Stated as an
observation of my own inputs, not as a claim about the general case.

### Major 2 — `packages/cli/src/run.ts:135`, *"the handler must destructure `cmd`, and cover it at source level"*

**Refused. E-3(b) rules it, and I re-measured both halves rather than relaying them.**

AC-1(3) reads *"reads `cmd`, `rest`, `flags` and `gateAnswers` off the `ParsedArgv` it is given and
calls no parser of its own"*. E-3(b) rules the second clause the criterion and the four names a
description of what `ParsedArgv` carries. Two measurements, both re-run today:

**(a) The binding clause is enforced, over this module.** `frame.source.test.ts:662` is
`describe('Q-0091 AC-2 — no command re-parses the command line')`, and its scan runs over
`commandModules()` — which is derived from `COMMANDS`, so `run.ts` is in it. Confirmed independently:
`run.ts` appears in the AC-11 `node:path` command-module list at
`frame.source.test.ts:545`. The criterion's normative half is therefore checked mechanically, not
merely asserted.

**(b) The literal reading contradicts every shipped sibling.** Measured just now:

| module | what the handler binds |
| --- | --- |
| `lint.ts:75` | `{ flags }` |
| `init.ts:52` | `{ rest }` |
| `validate.ts:58` | `{ rest }` |
| `ticket.ts:71` | `{ rest, flags }` |
| `runs.ts:269` | `{ rest, flags }` |

**None of the five binds `cmd`**, because `main.ts` dispatches `HANDLERS[cmd](parsed)` and `cmd` is the
key the handler was reached through. Requiring `run` to bind it would make it the only handler holding
a name it cannot use.

The reviewer's own observation — that `main.test.ts`'s dispatch assertion proves `cmd` *reaches*
handlers rather than that this one consumes it — is correct and is the point: `cmd` arriving is
`main`'s contract, pinned where it belongs. Iteration 3's `expect(seen[0]?.cmd).toBe(name)` at
`main.test.ts:141` is kept.

**No source-level "all four fields" check was added.** A guard that fails when a handler omits `cmd`
would go red over all five shipped siblings, so it would have to exempt them — a register whose
subject is a dead binding. That is the shape E-3(b) refuses.

---

## 2. Files changed

Two, both comment-only.

### `packages/cli/src/run.ts` — the destructuring carries its authority

The comment above `runOn`'s returned handler previously re-derived E-3(b)'s argument from first
principles, which is what a reviewer meeting it twice read as an unmet criterion. It now names the
ruling first and states the checkable fact:

> `Why: ruled, see requirements/errata.md E-3(b) — AC-1(3)'s binding clause is *no command re-parses
> the command line*, which frame.source.test.ts:662 enforces over this module; the four names beside
> it are what ParsedArgv carries, not a destructuring shape. cmd is the key main.ts dispatched on, so
> none of the five shipped siblings binds it either, and main.test.ts pins all four arriving.`

Five lines, same length as what it replaced, and every claim in it is one of the two measurements
above. Per `harness/rules.md`: cite, do not transcribe.

### `packages/cli/src/gate.ts` — the bracket-free diagnostic carries E-1

Review iteration 1's second major asked for the literal `<advance|retry|abort>` in AC-6's sentence;
E-1 refused it and landed while iteration 2 was in flight, so nothing in the tree ever pointed at the
ruling. The comment above the `answers-exhausted` throw now does, and its central claim was
re-measured rather than inherited:

```
$ sed -n '97p' spike/bin/harness.js
      throw new GateUnansweredError(`gate (${kind}) "${reason}" needs an answer and stdin closed
      without one — pass --gate-answer ${retry ? 'advance|retry|abort' : 'advance|abort'} …
```

No brackets, and ground rule 3 preserves it. The two fixtures the comment already named were checked
to still say what it claims and to sit where it says: `spike/test/q0040-undecided.js:264` and
`packages/core/src/engine/undecided.test.ts:243` both build this sentence **without** brackets and
both call it *"byte for byte"* — so emitting brackets would leave two landed type-not-text assertions
comparing against a string nothing prints. That is the measurement, and it is why E-1 is right rather
than merely decided.

---

## 3. What was deliberately left alone

- **`docs/06-development-plan.md`** — untouched, per E-3(a). Its throw-site clause (*"three meaning
  nobody was there"*) is still wrong against the measured split of two unanswered and three operator
  errors, which `spike-parity.test.ts:249` has stated since before this ticket was written. Reported
  here for the human's plan pass, not fixed.
- **The usage line's `harness`** — `run.ts:49` says `usage: harness run <flow> <ticket> …`, preserved
  verbatim per AC-1(1) and non-goal 3. Q-0100's **fifth** instance, after Q-0093's `init` next-steps
  line. Pinned by `run.test.ts:104` so it cannot drift before that ticket rules the class.
- **The valueless `--adapter`** — `run.ts:163` still lets a boolean through with its `Why:` line.
  Preserved defect; refusing it would be a second refusal beside `--base`'s that the spike does not
  make.
- **`regressed` → exit 0** — Q-0090 GA-4's registered preserved defect, still in
  `EXIT_CODE_FOR_STATUS`, exercised by `run.test.ts:147`.
- **`spike/src/**` and `spike/test/**`** — no file under either is modified or deleted. Ground rules 1
  and 2. This ticket reads four `spike/test/` files and writes none, which is what AC-14(5)'s
  unmoved totals rest on.
- **Q-0059, Q-0060, Q-0066, Q-0068** — none met on this surface, none closed.
- **`@quorum/core`'s barrel** — not widened. §3 measured that nothing is owed, including the type
  exports, and non-goal 13 forbids adding them out of caution.

---

## 4. What the last two rounds cost, measured

The deliverable has been stable since implement iteration 2's fix of the readline `SIGTERM` leak —
which was a real defect the port introduced, correctly found, and correctly fixed. Since that commit:

```
$ git diff HEAD~1 -- 'packages/cli/src/*.ts' | grep '^[+-]' | grep -v '^[+-][+-]' \
    | grep -vE '^[+-]\s*(//|\*|/\*)'
+    expect(seen[0]?.cmd).toBe(name);
```

**One non-comment line across implement rounds 3 and 4.** Everything else those two rounds produced
is comments and two documentation reverts, spent on three findings that three errata refuse — E-1's
angle brackets, E-2's §8 row, E-3's `cmd`. All three are the same class, which E-3 names: *a
requirement describes what must be conveyed or achieved; only a test fixture, a frozen contract's own
file, or a criterion quoting bytes pins bytes.*

This is the **twelfth** appearance of a loop handed work no step in it can perform, and the second
time in this stretch it is priced with a number — Q-0091's was two rounds and $14.28, one of which
changed no files at all. It is Q-0083's absence: an implement step that has proved a criterion wrong
has one channel, prose nobody reads until a gate. Recorded here rather than argued again.

---

## 5. Verification

Both suites installed and run in this worktree (`harness/rules.md`: a step's worktree has no
dependencies until it installs them).

| | |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached**, `@quorum/cli` 19 files / **422 tests** passed |
| `npm test --prefix spike` | **19/19 test files passed** |
| `node spike/bin/harness.js lint` | **6/6** flows clean |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |

Run once before the two edits and again after, with identical results, so the edits are shown not to
move a verdict rather than assumed not to.

**Criteria status: all fourteen implemented and covered**, unchanged from iteration 3. Spot-checked at
source this round rather than taken from an earlier report: AC-12's re-aimed AC-4(d) register names
`src/run.ts` by identity with both clauses demonstrated red (`frame.source.test.ts:719–786`); AC-14's
four register rows carry `binaryCarriedBy`, the `q0033-surface.js` clause that asserted
`toMatch(/Q-0094/)` was **moved rather than left passing with the opposite meaning**, and the five line
totals are re-derived unmoved at 220 / 2739 / 2469 / 5428 / 55%; `gate.test.ts` carries S10.5, written
for the first time here, and AC-11(5)'s Ctrl-C-at-a-gate outcome.

---

## 6. For the gate

1. **No decision entry is owed.** §6's two rulings already exist and the injectable-stream shape change
   is charter-permitted layout. Confirmed again this round; nothing found that needs one.
2. **`docs/06-development-plan.md`'s Q-0094 bullet still says three sites mean nobody was there.** The
   measured split is two and three, and `spike-parity.test.ts:249` has said so since before the ticket
   existed. E-3(a) routes the correction to the human's plan pass; it is not on this branch.
3. **E-3's window claim is narrower than stated.** E-3 says an erratum landed between a review
   returning and the next implement starting *"has no reliable window"*. This round's inputs carry all
   three errata, so the window is real but not guaranteed — which argues for E-3's remedy rather than
   against it, and is the honest reading of two data points rather than one.
4. **Nothing is ambiguous or contradictory in the requirement as it now stands.** With E-1, E-2 and
   E-3 applied, all fourteen criteria are satisfiable as written and satisfied. There is nothing this
   round stopped on.
