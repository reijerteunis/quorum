# Q-0134 — implement, run 2, iteration 2

Revision round. `review/chore/run-2/chore-iter-1.md` carried **one** finding, a major, and it is
addressed in full. Nothing else in the branch was touched.

**A note on what this branch already held.** Round 1's document is the single line *"Probe
document."*, but its commit `67295ad` carries the entire implementation — 2,636 insertions across 31
files. So this round opened on a complete, reviewed change rather than on an empty tree, and what
follows is a repair of one property of it, not a re-derivation. The commit's subject is wrong and is
recorded as an observation rather than amended.

---

## 1. The finding, confirmed in source before it was fixed

> major: `packages/server/src/host.ts:434` `reportDiff` overwrites the run's sole evidence slot for
> every materialisation. Because `preflightDiffs` materialises all pre-existing ranges before any
> step executes, a later diff site replaces an earlier deciding step's evidence before that step
> reaches its gate. The `stepId` check then returns `no-diff`, falsely claiming the deciding step
> read no diff.

**It is real, and the mechanism is exactly as stated.** Read in place rather than taken from the
report:

- `diff.ts:581-598` — `preflightDiffs` loops over **every** diff site in flow order and calls
  `materialiseDiff` for each range whose endpoints all already exist. That loop runs to completion
  before the first step executes.
- `diff.ts:429` — every `materialiseDiff`, on both paths, calls `reportDiffEvidence`.
- `host.ts:434` (as it stood) — `reportDiff: (evidence) => { record.evidence = evidence; }`, one
  slot.
- `host.ts:376` (as it stood) —
  `event.reached?.stepId === record.evidence.stepId`, which **reads** as an identity test and is
  one: against whichever site reported last. At the first gate of a two-site run that is never the
  deciding site.

So a run with two pre-existing diff sites reported twice at run start, the second won the slot, and
the gate for the first site's step was answered `no-diff`. **That is a patch the host is holding,
reported as an absence** — the class *"A probe that could not answer is not a negative"*
(2026-09-10) forbids, and which Q-0074 and Q-0115 spent two tickets removing, arriving at the one
site this ticket adds.

**Why no fixture caught it.** Both multi-site shapes this repository ships are one-snapshot shapes:
`review.yaml`'s two sites read one range, which the preflight cache (`diff.ts:591`) makes a single
materialisation, and `chore.yaml` has one site. The defect needs two sites over **different**
pre-existing ranges, which only a constructed flow has — and the clause that constructed one was
written asserting `no-diff`, so the defect had a test requiring it.

---

## 2. What changed, file by file

### `packages/server/src/host.ts` — the fix

**`RunRecord.evidence`: `DiffEvidence | null` → `readonly Map<string, DiffEvidence>`**, keyed by the
id of the step that was given the diff. `readonly` on the field, so the reference cannot be
reassigned and "transferred rather than copied" is structural rather than remembered.

Four sites:

| site | before | after |
| --- | --- | --- |
| record creation | `evidence: null` | `evidence: new Map()` |
| `reportDiff` | `record.evidence = evidence` | `record.evidence.set(evidence.stepId, evidence)` |
| `observe`'s join | `reached?.stepId === record.evidence.stepId` | `record.evidence.get(reached)`, then `record.evidence.delete(reached)` on bind |
| `consume`'s `finally` | `record.evidence = null` | `record.evidence.clear()` |

**The key is the step id because the consumer's key is `reached.stepId`** — the join is an identity
on both sides rather than a lookup one end infers. A second report under one step id replaces the
first, which is exact for that join: `input.diff` is one field of one step, so two sets of bytes
under one id can only be one site read twice.

**The join is now a lookup and not a comparison**, which is the whole of the repair. `observe`'s
comment says so and names why, and the narrowing was restructured inside `if (event.type === 'gate')`
so the redundant second type check the first draft carried is gone.

**Transfer is safe, and I checked the assumption rather than inheriting it.** Deleting the key on
bind is only correct if two gates cannot both carry a `reached` naming one step. `routing.ts:58`
spends the decision where the engine emits — Q-0129 erratum E-7's fix — so at most one question
carries a given decision, and a later gate correctly binds nothing and is answered `no-diff`.

**The clean-up the review asked for is `consume`'s `finally`**, and it is unconditional: a site the
flow declares and no gate ever claims cannot outlive the run that read it. It sits beside
`gates.release(record.handle)`, and the source clause below pins the pair.

### `packages/server/src/gate-diff.test.ts` — the clause that asserted the defect, and three more

1. **The two-site clause is re-aimed**, which is what the review asked for by name. It was
   `'a run with two diff sites does not expose the other site's merely because it ran later'`,
   requiring `refusal === 'no-diff'`. It is now
   `'a run with two diff sites gives the gate its deciding step's own bytes, and never the other
   site's'`, and it asserts **both** halves: `stepId === 'work'`, the range, the patch containing
   `MARKER` — and the patch **not** containing the other site's marker, with the other site's file
   absent from the `--stat`. Its comment records that this clause used to require the defect.
2. **`OTHER_MARKER` is new**, for the reason `MARKER` exists: the "never the other site's" half is
   unassertable with one needle, and one needle is exactly what let a single-slot host pass a round.
3. **A clause for the opposite declaration order** — `other` declared *first*, so the deciding site
   is the later report and the clause cannot pass merely because the last writer happened to be
   right. It also asserts the unclaimed site's patch never reaches the event stream, which is AC-4's
   property holding for a snapshot no gate took.
4. **The source guard is re-aimed and widened by two clauses.** `TRANSFERS` was
   `/record\.evidence = null/` and is now `/record\.evidence\.delete\(reached\)/` — not weakened: the
   property is still *the run stops holding what the gate now holds*, and naming the key is what also
   refuses the over-correction of clearing the whole map there. Added: `LOOKUP`, pinning that the
   gate is looked up rather than compared against the most recent report, and `CLEARS`, pinning the
   release of unclaimed snapshots. Each is shown discriminating against the same text with its own
   line removed, in the shape the existing clauses already use.

### `docs/04-architecture.md` — the doc was ahead of the code

Its sentence at `:189-191` already read *"an identity rather than a guess about which diff was most
recent"*. **That was true of the design and false of the code** — the code was the guess. It is now
true of both, and I recorded the arrangement that makes it so: that the run files a snapshot under
the step that was given it, why a single slot answers `no-diff` for a step that read a diff, and the
measured bound. No status-line change was needed; the ticket's line already describes this route.

---

## 3. Red before green — three mutations, each with its own message

A check is not established by reading it, so each new and re-aimed clause was shown failing against a
host that has the defect, then restored.

| mutation | what went red |
| --- | --- |
| **single slot restored** — `record.evidence.clear()` before each `set`, so only the most recent survives | the re-aimed two-site clause, `AssertionError: the deciding step's diff was lost to the other site's` |
| **bind whatever you hold** — `[...record.evidence.values()][0]` instead of `.get(reached)` | **three**: the opposite-order clause (`expected 'other' to be 'work'`), the AC-7 `no-diff` route clause (`expected 200 to be 404` — a gate whose step read nothing was served another step's bytes), and the source `LOOKUP` clause with its own message |
| **release removed** — `void record.evidence` in `consume`'s `finally` | the source `CLEARS` clause, `a run that ended keeps the snapshots no gate took` |

The second mutation is the one worth noting: it shows the AC-7 `no-diff` clause is not merely
decorative — it independently refuses a host that hands out whatever snapshot it happens to have.

---

## 4. Measurements taken this round

- **`preflightDiffs` materialises before any step runs** — confirmed at `diff.ts:581-598`, which is
  the review's premise and the reason a single slot cannot work.
- **Diff sites per shipped flow**: `chore` **1** (its second `diff:` grep hit is a comment),
  `review` **2 over one range**, and `development`, `requirements`, `qa-red`, `solutioning` **0**. No
  fan-out step template declares `input.diff`. So **every flow this product ships holds at most one
  snapshot** — the memory statement the map needed, since Q-0123's ruling is what the old JSDoc
  appealed to. It is in the field's JSDoc and in the architecture document.
- **`reached` is spent at the emit** (`routing.ts:58`), so transfer-on-bind loses nothing.
- **No live prose still asserts the single slot.** The remaining `one slot` hits are `core`'s
  step-id slot (Q-0050, Q-0129 — a different subject) and stale `dist/` artefacts, which are
  gitignored and reproduced by a build.

---

## 5. What I deliberately left alone

- **`packages/core` — untouched this round.** The capture site is correct and AC-1 is unaffected: the
  defect was entirely in how the host *filed* what core reported, not in what core reported or where
  it reported it from. Changing the producer would have been scope creep dressed as a fix.
- **`packages/shared/src/diff-evidence.ts` — untouched.** `stepId` was already a field of the shape,
  which is what made keying by it possible with no schema change. No wire shape moves, so AC-3's
  "the event union does not move" is untouched and `events.test.ts:239` stays green unamended.
- **`packages/server/src/gates.ts` — untouched.** Its gate-keyed evidence map and its two release
  paths were already correct; the defect was upstream of it, in what reached `bindEvidence`.
- **The `no-diff` member, and every other refusal.** A gate whose deciding step genuinely read no
  diff still gets `no-diff`; what changed is that the answer is now only given when it is true.
- **`repo.max_diff_bytes`, the head-only cut, the `diff truncated range=` token, file ordering and
  the warning grammar** — non-goal 4, and the token is load-bearing for `diff.test.ts`'s AC-9.5.
- **The pre-existing lint warning** in `packages/core/src/backlog/backlog.ts:448` — reported as an
  observation, not fixed.
- **No criterion was trimmed**, and in particular AC-1 and AC-4, which erratum E-3 names as not
  eligible for trimming, are untouched by this round.

---

## 6. Verification

`pnpm install --frozen-lockfile` → *Already up to date*, then
`pnpm turbo run lint typecheck test --force --continue` — the `commands.install` and `commands.test`
pair verbatim, so what ran here is what `integrate` will run.

**21/21 tasks successful, 0 cached.** Test files: `shared` 15, `core` 67 passed + 1 skipped, `server`
11, `web` 21, `cli` 26, `compiler` 1, `templates` 1. `gate-diff.test.ts` is **17 tests** where it was
15. Lint: 0 errors, 1 pre-existing warning. Typecheck clean across all seven packages.

---

## 7. Still open — the operator's at the gate, not mine

Stated rather than implied, and none of it is work this step may perform:

- **GO-4** — the cross-vendor hand pass over the files the review got no patch for. §1 of my
  findings names all 13 and measures the ratio at 71.2%; **the whole of this round's fix is among
  them**, so the pass is load-bearing for this round rather than routine.
- **GO-5** — the product run by hand, the diff region transcribed into `runs.log` including a
  truncated case, and how the range was built (R-2: 42 of 42 integration branches are contained in
  `main`, so no ticket here has a non-empty range). The standard is Q-0016's failure.
- **GO-6** — forced verification in both environment rows, `quorum lint`, and the git-identity
  sweep.
- **R-5** — a first-round approve should be distrusted. This round's remedy was mutation-tested three
  ways above precisely so a reviewer that cannot execute the suite has something better than reading
  to go on.

**Verdict: `proceed`.** Nothing here required a `docs/decisions/` entry — erratum E-1 ratified that
no entry is owed and this round changes no part of that ruling's subject — a file outside my paths,
or behaviour a landed decision preserves. Every file I touched is inside `packages` and `docs`.
