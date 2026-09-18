# Q-0135 — implement report, run 2, iteration 4

*Round 4, a revision round. `review/chore/run-2/chore-iter-3.md` returned **one major** and one
observation. Erratum **E-3**, written at the exhaustion gate before the retry was answered, accepts
that major, refuses round 2's first half as raising the job, and names what this round owes instead
of more strength. Both halves are delivered below, and the major was **reproduced as two fixtures
and shown red before anything was changed**.*

**Verified forced in this worktree**: `pnpm install --frozen-lockfile` → *Already up to date*, then
`pnpm turbo run test lint typecheck --force --continue` → **21 of 21 tasks successful, 0 cached**,
and `pnpm exec quorum lint` → **6/6**.

**The diff is one file — `apps/web/test/source.test.ts`, 104 insertions — which is the bound E-3
sets**: *"Nothing outside `apps/web/test/source.test.ts` and its fixtures needs to move for this,
and no criterion of `merged.md` changes."* No `src` file, no `packages/`, no `docs/`, no flow file
and no contract is touched. **The web suite stays at 510 tests**, because every assertion below is
inside the existing AC-11 clause, which is the test the finding is about — what moved is what that
one test asserts.

---

## 1. The finding, reproduced before it was fixed

> *`apps/web/test/source.test.ts:1101` — `bindings()` discovers declaration heads from the original
> source, including declaration-like text inside strings and comments, then allows those bogus heads
> to terminate a real binding at the same depth … This directly contradicts the comment at lines
> 1093–1098 and leaves AC-11's prohibition unenforced.*

**Correct, and the cited comment was the defect as much as the code was.** That paragraph argued the
asymmetry safe because a head born inside a literal *"adds an entry and can never remove the real
one"*. It weighed the **adding** and missed the **terminating**: a phantom head also ends the extent
of every real binding before it whose depth is at or above its own.

Both fixtures were added first and both failed against the shipped walk, at the walk itself:

```
AssertionError: a declaration head inside a literal or a comment truncated the real binding
above it: expected [ [ 'a string', false ], [ 'a comment', false ] ]
                to strictly equal [ [ 'a string', true ], [ 'a comment', true ] ]
```

| Fixture | Shape |
| --- | --- |
| `a string` | the review's own — `const reload = () => 'const fake' && fetchRuns(request, clock);` |
| `a comment` | the realistic form E-3 names — a commented-out line inside a **braceless arrow**, where the comment sits at the same bracket depth as the head above it |

Each is asserted twice, once against `requestingNames` by value and once through `pollers`, on the
house style rounds 2 and 3 set: a row that only asserts the end state cannot say which half moved.

### The measurement that says this was live, not hypothetical

Taken **before** the fix was trusted, with a throwaway probe over `src` that was removed once it had
answered:

| | |
| --- | --- |
| Phantom heads in the corpus | **23, across 11 files** |
| Real bindings whose extent they truncated | **15, across 8 files** |
| Names gained by the fix | **0** |
| Names lost by the fix | **0** |

**A phantom head needs no contrivance — English prose writes them.** Any sentence putting a word
after *a function*, *a const* or *let* produces one: `function rather`, `let the`, `const was`,
`function cannot`. Among the fifteen truncated bindings are `isoClock` in `daemon-client.ts` and
**`MeasuredAbsenceRegion` in `mission-control-status.tsx` — the one file under `src` that schedules
anything**, and a component this ticket itself added.

**What it cost the walk's output today is nothing**, because none of the fifteen truncated bodies
reaches the daemon. So the defect is **live and its consequence latent**, which is the honest form
and the right standard for a prohibition: it is judged on what it would fail to see. The counts are
recorded in the clause as evidence and **deliberately not asserted** — they are corpus figures, a
reworded comment moves them, and §0.13 of the requirement forbids a criterion resting on one.

---

## 2. What shipped

### `bindings` — a head terminates only if it is also code

```ts
const real = (head: RegExpExecArray): boolean => code.startsWith(head[0], head.index ?? 0);
…
const sibling = heads.findIndex((other, at) => at > i && real(other) && depthAt(other) <= depthAt(head));
```

`codeOnly` preserves index and length, so a head that is code stands unchanged at its own offset in
the blanked text and one inside a literal is spaces there. One conjunct; no new mechanism.

### The docblock, which was the other half of the defect

The false paragraph is replaced by one that names round 3's finding, states the mechanism with the
review's own example, and records the choice below. A sentence claiming what the code does not do is
the class this repository records most, and it was sitting directly above the code it was wrong
about.

### E-3's second deliverable — the clause states its blind spots

Required by E-3 and already within AC-11's words (*"recorded in place with its reason **and in the
guard's own failure message**"*), since what a lexical guard cannot see is part of that reason. Both
the comment block and the failure message now say, in substance: it is **lexical and not
syntax-aware**; it reads a module's text and never its semantics; it has **no parser by ruling
rather than by omission**; and **a callback written to evade it can pass**.

**The four blind spots named were checked against the code rather than asserted**, since a
disclosure that overstates is the same failure one layer up:

| Named blind spot | Why it holds |
| --- | --- |
| a callback reached through a value rather than a binding | the head needle is `const\|let\|var\|function` — an object property, array element or parameter matches nothing |
| a name assembled at run time | the walk is textual |
| a timer called through an alias of its own | `timerCallbacks` matches `\bsetInterval\|setTimeout\|requestIdleCallback[ \t]*\(` by literal name |
| text it cannot lex | collected **whole** by `timerCallbacks`, so it fails this clause rather than passing over it |

That is Q-0079's tripwire discipline, whose header says it *"sees literals only and says so"*, and
`turbo-inputs.test.ts`'s fail-open disclosure: **an unstated weakness becomes a stated bound.**

---

## 3. The judgement call, stated plainly so the gate can rule it

E-3 names **two** remedies — *"Select declaration heads from the index-preserving `codeOnly` text,
**or** reject a raw head whose declaration token was blanked."* I took the second, and scoped the
rejection to **termination only**: a phantom still yields its own entry.

**They are not equally safe, which is why the choice is pinned rather than left implicit.** Selecting
heads from the blanked text closes this finding too, and trades it for a quieter one in the other
direction: a real declaration the scanner wrongly blanked would leave the walk **altogether**, and a
timer calling that name would pass. That is the poll-hiding direction the replaced paragraph
correctly identified — so shipping it would mean writing a *new* residual into this file, silent and
worse than the one being fixed, in the round whose whole remaining task is stating blind spots
honestly. Refusing the phantom only as a terminator loses no body either way, so a lexer mistake can
still only over-collect.

**And it is discriminated by a fixture rather than argued**, which is the standard round 3 set when
it removed a second depth reading no fixture could tell apart:

```ts
expect(bindings(PHANTOM[0]?.[2] ?? '').map((one) => one.name)).toStrictEqual(['reload', 'fake']);
```

Under the other permitted remedy the two phantom rows still pass — the finding is closed either way
— and this pin goes red by name. So a later reader switching to it has to weigh the poll-hiding
direction deliberately instead of inheriting it.

---

## 4. Mutations run, rather than a green suite read

| Mutation | What went red |
| --- | --- |
| `real(other) &&` removed from the terminator test | **both** phantom rows at the walk — *expected `[['a string', false], …]` to strictly equal `[['a string', true], …]`* — the finding's own mechanism, verbatim |
| heads selected from `codeOnly`'s text instead (E-3's other remedy) | the phantom rows pass and the placement pin fails — *a phantom head was dropped rather than refused as a terminator, which loses a real head too: expected `['reload']` to strictly equal `['reload','fake']`* |

The two fixtures were shown red **before** the fix, not only by reverting it afterwards.

---

## 5. What I deliberately left alone

1. **No parser and no new dependency**, per E-3's bound, and **no escape hatch**: no file-level
   exemption, no comment token, no register of permitted callers. The discriminator is still what
   the callback does. E-2's bound is unchanged and still honoured.
2. **`extractsFrom` (`:193–195`) and `messageAliases` (`:170`)** interpolate a bound name raw, which
   is round 2's second finding at two sites. **Reported and not fixed**, unchanged from rounds 2 and
   3: they are **Q-0015 AC-6's** clause with a different subject, no criterion or finding of Q-0135
   names them, `asNeedle` cannot be reused there (those are not call needles), and changing a shipped
   prohibition's predicate is ruled by no erratum. Latent for the measured reason — no identifier
   under `apps/web/src` carries a `$`.
3. **`messageAliases`' capped five passes** — round 2's residual, unchanged and still reported.
4. **Everything outside the AC-11 clause and `bindings`.** The four existing timer fixtures, the four
   literal-truncation rows, the two `$` rows, `REACHES_THE_DAEMON`, `TIMERS`, the `scheduling`
   identity and the persistence half are untouched, so this round's fixtures are added coverage
   rather than a replacement. The narrowing E-2 ruled is still proven **necessary**: the
   pre-narrowing clause still refuses the shipped elapsed tick.
5. **`[data-mission-control-header]`'s assertion** (AC-14) — byte-identical, still green.
6. **`RequestState` at five, `MISSION_CONTROL_DISCLOSURES` at five, `COUNT_FIELDS` at four,
   `vendorCostRows`, the roll-up's order and the no-sum rule** — untouched.
7. **GO-4 and GO-5 are the gate's**, as in rounds 1 to 3: one needs the review prompt this round
   produces, the other a browser and a running daemon.

---

## 6. Residuals, stated rather than left to be found

1. **A real declaration the scanner wrongly blanks is no longer a terminator**, so the binding above
   it over-collects. That is the safe direction and is the point of the placement; recorded on
   `bindings`.
2. **Round 3's two scanner residuals stand** and are unchanged: a regex written directly after `)` or
   `}` is read as a division, and two apostrophes in one line of JSX text are read as a string, which
   over-blanks a balanced region and so moves nothing.
3. **Rounds 1 and 2's residuals stand** and are not re-litigated: the observed-vendor set is a lower
   bound and says so; `unpriced_steps` is disclosed wherever it is non-zero, which is AC-13's literal
   wording; `unreadable-start` is a seventh state AC-16 does not enumerate, named in prose rather
   than rendered as `NaN`; AC-17's sentence clause stays scoped to the three mission-control
   renderers.
4. `pnpm turbo run lint` reports **one pre-existing warning** in `packages/core`
   (`448:3 Unused eslint-disable directive`), which this diff does not reach. Reported, not fixed —
   the fourth round running.
5. **E-3 names this the last round.** Whatever the review returns, the gate that follows is answered
   rather than retried, and anything outstanding is repaired by hand after it on Q-0073's and
   Q-0080's precedent.

---

## 7. Verification, in full

```
pnpm install --frozen-lockfile        → Already up to date
pnpm turbo run test lint typecheck --force --continue
                                      → Tasks: 21 successful, 21 total   Cached: 0 cached, 21 total
   @quorum/shared   279 passed        @quorum/web      510 passed
   @quorum/core    1598 passed (2 skipped)             @quorum/server   242 passed
   @quorum/cli      692 passed        @quorum/compiler / @quorum/templates  1 each
pnpm exec quorum lint                 → 6/6
git status --short                    → one modified file
```

No decision entry is owed: this round changes a test guard's predicate, which erratum **E-2** ruled
at the gate as a permitted change to the predicate and nothing beside it, and which **E-3** bounds to
this one file. No criterion or finding named a surface this flow cannot write: the single changed
file is under `apps/`, and `contracts/` — outside this role's roots — is untouched, its note having
been written by hand at the gate (`ccbcc2b`).
