# Q-0040 implement — chore run 2, iteration 4

Review round 3 returned **two majors**, both the same finding in the two trees. Both are addressed.
Nothing else in the change moved except what re-deriving a pinned measurement forced, and one
documentation sentence this ticket had falsified in round 1 — that one is **not traceable to a
criterion** and is flagged for the reviewer below rather than buried.

---

## The findings

### Round 3, major 1 — `packages/core/src/engine/engine.ts:142`
### Round 3, major 2 — `spike/src/engine.js:798`

> The durable `undecided-gate` record does not state that nothing was rolled back; it only records
> `kept-at`, despite AC-13 explicitly requiring the `runs.log` line itself to state that fact.

**Accepted, in both trees.** The finding is right and the reasoning is worth restating rather than
just obeyed: `kept-at=<sha>` is a fact about *where the branch is*, not about *what was not done to
it*. A reader who does not already know that a rollback would have moved the branch cannot tell the
two records apart from the durable line alone — and the durable line is precisely the one read
**without** the stream beside it, hours later, which is the case AC-13 exists for. The terminal
warning said "nothing was rolled back" and the `runs.log` record did not.

**What landed.** One field, in both trees, in the line's own `key=value` grammar:

```
run=1 undecided-gate kind=human reason="…" condition=stdin-closed rollback=none \
      branch=harness/Q-0040/integration kept-at=4295010 kept-worktrees=2
```

Placed after `condition=` and before `branch=`, so the record reads *what happened* (kind, reason,
condition) → *what was decided about the rollback* → *what is being kept* (branch, head, worktrees).

**The spelling is the part that took thought, and it is pinned.** The obvious wording — a
`rolled-back=none` field, or a `nothing-rolled-back` token — is the wrong one, and not on taste:
`rolled-back` is the **opposite record's** token (`lifecycle.ts:145`, `spike/src/engine.js:843`), and
AC-5's guard asserts that an undecided run writes no line containing it:

```ts
expect(runsLog(fixture).filter((line) => line.includes('rolled-back'))).toStrictEqual([]);
```

Either of those spellings would have made that guard red — which is the right failure, but it means
the two records would otherwise have been one `grep` apart for anyone reading `runs.log` by hand.
`rollback=none` states the fact and does not collide. **The non-collision is now itself asserted**
(`expect(record).not.toContain('rolled-back')`) in both suites, because it is invisible in either
engine file: nothing in `engine.ts` shows you that `lifecycle.ts` owns the neighbouring token.

---

## File by file

| file | what changed |
| --- | --- |
| `packages/core/src/engine/engine.ts` | `rollback=none` in the `appendLog` record; `reportUndecided`'s JSDoc gains a paragraph on why the field exists and why it is not spelled `rolled-back`. |
| `spike/src/engine.js` | The same field and the same reasoning, as a `//` block in the spike's own idiom. Its citation of the rollback record was **re-measured after my own insertion shifted it** — `engine.js:836` → `:843` — rather than transcribed. |
| `packages/core/src/engine/undecided.test.ts` | The AC-13 whole-string assertion gains the field; **new scenario** asserting the fact on the `runs.log` line alone, plus the non-collision pin. |
| `spike/test/q0040-undecided.js` | The same two, in the spike's `scenario()` shape. 394 → 413 lines. |
| `packages/core/src/spike-parity.test.ts` | Totals re-derived: `both` 2720 → 2739, total 5409 → 5428, **share 54% → 55%**. Comment records the move and why it happened. |
| `docs/04-architecture.md` | The entangled share 50% → 55%, its history line corrected, status line bumped. **Not traced to a criterion — see "Outside the two findings" below.** |

---

## Red before green, demonstrated in both trees

Neither assertion was trusted on a green run. The field was reverted in each engine in turn and the
suite re-run:

**Spike** — with `rollback=none` removed from `spike/src/engine.js`:

```
✗ AC-13 — the diagnostic is verbatim, and the line beside it says what was kept
✓ AC-13 — both records name the gate's own reason, not only its kind
✗ AC-13 — both records state that nothing was rolled back, and neither is the rollback record
✓ AC-13 — the three conditions read differently, so a maintainer knows what to do next
```

**Core** — with the same removal in `packages/core/src/engine/engine.ts`:

```
Tests  2 failed | 2 passed | 13 skipped (17)
AssertionError: expected 'run=1 undecided-gate kind=human reaso…' to contain 'rollback=none'
```

**The two rows that stayed green are the informative ones.** The reason scenario and the
three-conditions scenario pass either way, which is what shows the new scenario is *not* redundant
with the assertions already in the file: it isolates a fact none of them carried. Restored, both
files pass 17/17 and 20/20.

---

## The measurement that moved, and was not smoothed

`spike-parity.test.ts` pins the spike suite's line buckets, and adding nineteen lines to an
entangled file moved them. **The numbers were taken from the failing pin, not from arithmetic on
the diff** — which is the whole reason that file computes them, and it is what caught a third move
nobody asked about:

- `both` 2720 → **2739** (measured; the pin failed with `expected 2739 to be 2720`)
- total 5409 → **5428**
- entangled share **54% → 55%** — 2959 of 5428

The share is the one that matters. It sat at 54.13% before this round and 54.51% after, so what
moved is a rounding boundary rather than four points of real transfer — but a share that moves
silently is exactly what this register exists to prevent, so the comment says which of the two it
was rather than presenting 55% as though nineteen lines had done something large. Q-0010's
inheritance is one point larger than it was this morning.

---

## Outside the two findings — one item, flagged rather than assumed

**`docs/04-architecture.md` said the entangled share was 50%.** That figure was falsified by
**round 1 of this ticket**, which took the share 50% → 54% by adding `q0040-undecided.js`; the doc
was not updated then and three review rounds did not raise it. It now said 50% while the guard
beside it pinned 55%.

**I fixed it, and I am naming the authority because it is not AC-12's.** AC-12 enumerates its
surfaces — `02-sdlc-pipeline-spec.md` §3.3, `GLOSSARY.md`, `ticket.ts`'s JSDoc — and this paragraph
is none of them. What I traced it to is the standing rule in `harness/rules.md` and
`.claude/rules/docs-and-decisions.md`: *"When code and docs disagree, the docs are wrong until a
DECISIONS entry says otherwise — fix them in the same change."* This is not pre-existing drift I
wandered into; it is drift **this branch created and has carried for three rounds**, and the
alternative was shipping a numbered doc that contradicts a landed guard in the same commit that
moves the guard.

The edit is factual and small: the share, the history sentence gaining Q-0037's 50% so the sequence
53 → 49 → 50 → 55 is complete, one sentence naming why Q-0040 moved it, and the status-line bump the
living-document rule requires. **If the reviewer judges it out of scope, it reverts cleanly on its
own** — no test depends on it.

---

## What I deliberately left alone

- **The terminal warning.** It already said "nothing was rolled back"; round 3's majors are about
  the durable record only, and rewording a message AC-9 pins verbatim to make a point would be the
  scope creep this role is told to refuse.
- **`kept-at` and `kept-worktrees`.** The finding asked for an addition, not a replacement. The head
  SHA is what a maintainer re-runs `git rev-parse` against, and dropping it to make room would trade
  one AC-13 clause for another.
- **`lifecycle.ts`'s rollback record.** Untouched. Its `rolled-back` line is the opposite case and
  is correct as it stands; my change only cites it.
- **Round 2's four majors.** Re-read rather than assumed: `lifecycle.test.ts`'s `TABLE` is still
  `Readonly<Record<RunStatus, Consequences>>` with the runtime vocabulary check against
  `declaredRunStatuses()` beside it, so both gates still fire. Round 3 did not re-raise them.
- **A pre-existing lint warning.** `packages/core/src/backlog/backlog.ts:276` reports *"Unused
  eslint-disable directive (no problems were reported from 'no-control-regex')"*. It is Q-0080's
  file, untouched by this branch, and it is a **warning, not an error** — 0 errors across 14 tasks.
  Reported, not fixed: it is not mine and fixing it in passing is what the no-scope-creep rule
  forbids.
- **The three earlier re-measurement notes in `spike-parity.test.ts`** saying "54% either side".
  They are the history of earlier rounds and were true when written; the register's method is to
  append a re-measurement, never to rewrite one.

---

## Verification

Run in this worktree, which already carried `node_modules` and `spike/node_modules` from the
earlier rounds, so no install was needed.

| check | result |
| --- | --- |
| `npm test --prefix spike` | **19/19 test files passed** |
| `pnpm turbo run test lint typecheck --force` | **21/21 tasks, 0 cached** — core 1280 passed / 2 skipped, 0 lint errors |
| `node spike/bin/harness.js lint` | **6/6 flows** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |
| `.github/scripts/port-freeze-guard.test.mjs` | **not run — reported rather than claimed** |

**On the freeze guard.** The harness's permission allowlist refused to execute
`node .github/scripts/port-freeze-guard.test.mjs` in this worktree. I am recording it as **unrun**
rather than green, per the rules' *"reporting a suite as unrun is honest and reporting it as green
without installing is not"*. Its status is unchanged from rounds 1–3 in any case: this branch has
modified `spike/src/engine.js` since round 1, AC-14 expects the freeze-SHA half to go red at the
merge **by design**, and step 2 — re-recording `freeze-sha` in a follow-up commit whose parent is
the merge — is the human's, because a commit cannot contain its own hash (Q-0037 erratum E-1).

**AC-14's both-environment-rows verification is still owed at the merge**, not here: this worktree
has `.harness/worktrees` and `.quorum/runs`, so it is one row only. Per Q-0072's closing finding the
other row is `integrate`'s worktree, and then forced again on `main` after the merge.

---

## Standing items, unchanged by this round

- **AC-1 / GO-1** is discharged by `docs/decisions/076-…`, and **E-1 of `requirements/errata.md`**
  rules its `--auto` clause the human's to correct — round 1's major 2, which no implement round may
  touch. Nothing in this round goes near it.
- **AC-11** is discharged by **E-2**, written by hand because `commitAll` reverts `backlog/` before
  every agent step commits. The five frozen contracts landed in round 2 and are untouched here.
- **No decision entry is implied by this round.** The change is one field in a log line and its two
  tests; it rules nothing the entry does not already rule.
