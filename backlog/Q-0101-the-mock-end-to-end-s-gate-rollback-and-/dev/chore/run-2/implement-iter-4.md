# Q-0101 — implement report, chore run 2, iteration 4

**This round changed no files.** The one finding still open is `review/chore/run-2/chore-iter-3.md`'s
blocker, and `requirements/errata.md` **E-2** rules it discharged at the gate with the instruction
*"Round 4 must not re-attempt it. Cite this erratum and move on."* This report cites it and does not
re-attempt it.

What the round spent itself on instead is stated plainly, because a round that changes no files has
to justify itself: **the two criteria whose whole content is a demonstration rather than an
assertion — AC-5 and AC-11 — had until now been attested only by the round that wrote them.** I
re-measured them, and AC-1's required mutation with them. Two of the three measurements produced
findings worth recording; none produced a defect.

---

## 1. Every finding, addressed

### iter-3 blocker · iter-2 blocker · iter-1 blocker — GO-5 (`failure-paths.test.ts:1`)

**Discharged by `requirements/errata.md` E-2, 2026-09-05, at the run-2 exhaustion gate.** Not
re-attempted, per that erratum's own instruction.

E-2's reasoning is why this is the right disposition rather than a dodge: GO-5 asks for matched
sweep samples at the merge base **and** on the implement branch, and an implement step has exactly
one worktree checked out at its own branch. Round 3 tried to synthesise the second arm by removing
its own newly indexed file from the working tree while `HEAD` and the index stayed at the implement
tip — a hybrid that is neither ref — and **review round 3 was right to refuse that sample**, and
right that the remedy is a genuine checkout obtained through the gate/human environment. That is
what E-2 is.

The measurement it records: five matched pairs, interleaved, each arm a separate clone in the bare
shape — `edcc7ad` five runs all exit 0, `4438307` five runs all exit 0, 109–116 s against 108–112 s.
The direction GO-5 exists to detect is absent.

**I did not re-run the sweep, and that is deliberate rather than an omission.** E-2's implement-tip
arm was measured at `4438307`, and the working tree at the end of this round is byte-identical to
`4438307` (§3.5). A sixth run at the same commit would add nothing to a rate already sampled five
times there, and would read as the re-attempt E-2 forbids.

### iter-1 major — `failure-paths.test.ts:72`, the `sh` refusal decided by platform name

**Fixed in round 2. Verified in this round rather than taken from that round's report.**

The shipped form probes by *running* the shell: `spawnSync(shell, ['-c', 'exit 7'])`, with `7`
chosen so a binary that starts and ignores its argument cannot satisfy it. Four returns, each naming
which of the four ways the answer is no, and the refusal throws at module scope so the file fails to
collect rather than skipping.

Its discrimination is asserted, not described — `shellRefusal` takes the command as a parameter so
the clause can be shown firing over a shell composed by a test:

- `shellRefusal(SHELL)` is `null` — this machine has the subject, so a refusal here would withhold one it has;
- `shellRefusal('quorum-no-such-shell-on-any-platform')` names the absent command;
- `shellRefusal(process.execPath)` returns *"is not a shell that interprets -c"* — the case a probe
  asking merely for exit 0, or for the file's existence, would admit.

It additionally forbids the defect's return: the source may not contain `process.platform ===`, with
the needle assembled from pieces so the clause needs no self-exclusion, and a fixture showing the
clause can see the comparison it forbids. That closes the finding in the direction the reviewer
asked and one step further.

### iter-1 major — `failure-paths.test.ts:676`, AC-7(b1)(b) not pinning branch attribution

**Fixed in round 2. Verified in this round.**

`cannot sync .* with ` is gone. `NAMES_BOTH` is built from the two branch constants, each in its own
position, through a `literal()` escaper so a metacharacter in a branch name still pins itself:

```
new RegExp(`cannot sync ${literal(INTEGRATION)} with ${literal(BASE_BRANCH)}\\b`)
```

The check on the check is its own test, and it is the right one — a swap is the shape a wrong
attribution actually takes, `into` and `base` being two arguments of one template:

- the sentence the product prints → `true`;
- the two branches **the wrong way round** → `false`;
- a diagnostic naming neither (`cannot sync  with `) → `false`.

Both suites pass with these in place.

---

## 2. What I re-measured, and what it found

### 2.1 AC-1's required mutation — the one R-5 calls not optional

R-5 warns that AC-1's four clauses can pass for three different reasons: (b) and (d) are already
true in process, so a spawned run that failed early could satisfy them while (a) read 3 from a
crash. The criterion therefore requires the mutation `undecided → 1` in `packages/cli/src/exit.ts`
to fail **(a) and leave (b), (c) and (d) green**.

Performed. `EXIT_CODE_FOR_STATUS.undecided` set to `ERROR`, `failure-paths.test.ts -t "AC-1"`:

```
× (a) the status is exactly 3, read from the spawned result rather than composed
AssertionError: … : expected 1 to be 3 // Object.is equality
Tests  1 failed | 3 passed | 30 skipped
```

Exactly the required separation: one red, three green. The isolated workspace copies the working
tree (`test/workspace.ts` reads `git ls-files --cached --others`), so the mutation genuinely reached
the built binary the scenario spawned, which is what makes it a measurement of the product rather
than of the assertion.

### 2.2 The four register sites, each red against its superseded value — and a nuance worth recording

**A finding, and the source already knew it.** AC-11 says *"each shown red against its superseded
value"*. Taken as *restore the superseded expression*, that works for two of the four sites and
**not** for the two `q0033-surface.js` clauses: restoring `.toMatch(/Q-0101/)` leaves them **green**,
because the row's new prose legitimately still contains the string `Q-0101` — as the ticket that
*carried* the half, not as one that owes it.

That is not a defect. It is the exact hazard the inversion exists to close, and both clauses already
say so in place: *"an expression requiring the row to name it as a successor would go on passing
while meaning the opposite, which is worse than going red."* So no comment is owed and nothing
moved. The demonstration that has a subject is the other direction — the superseded **prose**
against the **new** clause — and all four sites fire that way:

| superseded value restored | red |
| --- | --- |
| `q0033-surface.js` `binaryHalf` prose ending `— Q-0101` | (l), (p), and (s)'s `owing` identity → `['q0033-surface.js']` vs `[]` |
| `smoke.js` `binaryCarriedBy` as a one-element list | (i)'s nine-row cross-file identity, (p)'s `toStrictEqual`, (s)'s `not.toStrictEqual` |
| `smoke.js` `binaryHalf` prose ending `— Q-0101` | (r)'s inverted clause, and (s)'s `toContain('AC-7(b2)')` |
| the two literal `.toMatch(/Q-0101/)` expressions | **green — see above** |

The third row is the clause §0.5 of the requirement found the ticket body had not named, and it
fires on the prose edit whether or not anyone remembered it was there, which is what it was for.

### 2.3 AC-5's two red witnesses — reproduced, and two candidate breaks disqualified

AC-5 forbids counting *"a process that fails to start, an unrelated process failure, or a different
earlier assertion failing"*. Two natural-looking breaks are disqualified by exactly that rule, and
this is worth writing down because a reviewer will reach for the first one:

1. **Flatten the write path** — `requirements/candidate-codex.md`, i.e. revert Q-0088's scoping.
   The run **never starts**: the whole-directory lint preflight refuses the flow, output is the
   six-flow lint listing, `runs.log` is `<absent>`, and five assertions fail for the wrong reason.
2. **Move it while keeping it scoped** — `requirements/elsewhere/run-{run}/candidate-codex.md`.
   Also refused before any step runs, and by a rule I had not predicted:
   `head-of-product: every input it judges (…) was written by its own vendor (claude) — cross_vendor: required`.
   Taking the codex candidate off the glob makes the judge's inputs single-vendor.

So **no flow edit can serve as AC-5(a)'s witness** — the run-scoped candidate path is defended two
layers earlier than this suite, by the scoping lint and by the cross-vendor rule. The state is
therefore produced in **the mutation procedure**, which AC-5 authorises in as many words. Rename the
surviving candidate to the flat path Q-0088 moved it from, and plant the failed sibling's file at
`requirements/run-1/candidate-claude.md`:

```
× (b) the surviving sibling keeps its output, at the run-scoped path Q-0088 moved it to
  AssertionError: the surviving sibling lost its finished work at requirements/run-1/candidate-codex.md: expected false to be true
× (c) and the failed sibling wrote nothing, searched for rather than tested at one path
  AssertionError: the failed branch left a candidate somewhere under requirements/: expected true to be false
Tests  2 failed | 5 passed | 27 skipped
```

Exactly the two named assertions, with the run itself and its four sibling claims green — which is
the discrimination AC-5 demands. The plant sits **one directory down**, where the spike's flat
single-path form would have missed it: that is the Q-0088 hole reproduced and shown closed, and it
is why AC-4(c) is a recursive search rather than a path test.

---

## 3. Files

### 3.1 Changed this round

**None.**

### 3.2 The change under review, unchanged since `4438307`

```
 packages/cli/src/end-to-end.test.ts    |  31 +-
 packages/cli/src/failure-paths.test.ts | 861 +++++++++++++++++++++++++++++++++
 packages/cli/src/package.test.ts       |  10 +-
 packages/cli/src/run.test.ts           |  62 +++
 packages/cli/src/templates.test.ts     |  68 +++
 packages/core/src/spike-parity.test.ts | 124 ++++-
 6 files changed, 1131 insertions(+), 25 deletions(-)
```

### 3.3 Deliberately left alone

- **`spike/`** — ground rules 1 and 2, non-goal. Read while verifying; not written.
- **All product source.** The only source file I touched at all was `packages/cli/src/exit.ts`, as
  AC-1's mandated mutation, reverted in the same session.
- **`backlog/`** — not an agent-writable surface. `requirements/errata.md` is the operator's; E-2 is
  cited, never edited.
- **`docs/`, `docs/decisions/`** — none owed (§8 of the requirement), and a decision is the human's.
- **`06-development-plan.md`** — §8 rules it not this run's to edit, on Q-0094 E-3(a)'s precedent.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100, Q-0102** — open, untouched, no user-facing `harness`
  sentence altered.

### 3.4 Criterion coverage, as it stands

| | where | state |
| --- | --- | --- |
| AC-1 | `failure-paths.test.ts` | 3 tests; mutation re-verified §2.1 |
| AC-2 | `failure-paths.test.ts` | 4 tests; **OQ-1 answered by measurement — the counter is `1`**, with a reader that tells a refund from an absent key |
| AC-3 | `failure-paths.test.ts` | 4 tests |
| AC-4 | `failure-paths.test.ts` | 6 tests |
| AC-5 | mutation record | §2.3, re-derived this round |
| AC-6 | `failure-paths.test.ts` | 5 tests |
| AC-7(b1) | `failure-paths.test.ts` | 5 tests |
| AC-7(b2) | `end-to-end.test.ts` | 1 test, over `chain.ran.solutioning` |
| AC-8 | `run.test.ts` | 2 tests, in process; the file's *"Nothing here spawns the binary"* header stays true |
| AC-9 | `templates.test.ts` | 3 tests — recursive, names offenders, mutation on a copy, subdirectory case |
| AC-10 · AC-11 · AC-12 | `spike-parity.test.ts` | clause (s), three tests; all four moved sites red-verified §2.2 |
| AC-13 | `failure-paths.test.ts` | 1 test; honours E-1's ruling and cites it |

### 3.5 The tree is byte-identical to `4438307`

Every mutation in §2 was reverted with an inverse edit and confirmed: `git status --porcelain` and
`git diff --stat` are both empty. Nothing from the verification is committed.

---

## 4. Verification

Run at the restored tree, and once before the mutations as well — the same figures both times.

| | |
| --- | --- |
| `pnpm install --frozen-lockfile` | already up to date |
| `npm install --prefix spike --no-audit --no-fund` | up to date |
| `npm test --prefix spike` | **19/19 files passed** |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached**; `@quorum/cli` 23 files / **545 tests**, `failure-paths.test.ts` 34, `end-to-end.test.ts` 34, `run.test.ts` 42 |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `pnpm sweep:git-identity` | **not re-run — see §1**; E-2 records 5/5 green at this exact commit |

Per *"Integrate's tick is worktree-scoped"*, both suites want re-running forced on `main` after the
merge; that is the gate's row, not this worktree's.

---

## 5. For the gate

1. **GO-5 is discharged by E-2** and this round did not re-attempt it. If a fifth round is
   considered, it should not be for GO-5.
2. **GO-4 is still owed and is the human's**: allocate the cutover ticket — deleting `spike/`,
   retiring its CI job and `harness/port-charter.md` — at this ticket's close rather than
   remembering it. `spike-parity.test.ts` and `spike/test/**` go together there, which is where this
   ticket's whole output is deleted on purpose.
3. **Reported, not acted on:** AC-11's *"shown red against its superseded value"* is satisfiable in
   only one of its two readings for two of the four sites (§2.2), and the source already says why.
   No change is owed; it is recorded so the next reader does not try the other direction and
   conclude a clause is dead.
4. **Reported, not acted on:** the run-scoped candidate path is defended by the flow lint and by
   `cross_vendor: required` before this suite's assertion can be the thing that fails (§2.3). That
   is a stronger guarantee than AC-5 assumed, and it is why the witness is produced in the mutation
   procedure rather than by a flow edit.
5. **Cost, stated rather than buried.** This is the second round on this ticket to change no files.
   Round 3 changed none because it was handed a blocker no step on the route could clear; this one
   changes none because the blocker is now ruled and nothing else is outstanding. What it bought
   that round 3 did not is an independent re-derivation of the three demonstrations the ticket's
   soundness rests on — previously attested only by the round that wrote them, which is the shape
   *"A check is not established by reading it"* (2026-08-29) warns about, arriving through a report
   rather than through a guard.
