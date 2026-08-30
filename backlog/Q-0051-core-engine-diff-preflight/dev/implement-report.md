# Q-0051 implement report — `core/engine`: diff preflight and materialisation

*Chore run, implement round 1, 2026-08-30. Written against `requirements/merged.md` (run 2), on
`main` at `e761d02`.*

**Result: all fourteen criteria satisfied, four gates green forced and 0-cached, `spike/` byte-
unmodified.** Six files touched — two new, four modified — which is exactly what NG-3 authorises.

---

## 1. What shipped, file by file

### `packages/core/src/engine/diff.ts` — **new**, 475 lines

The port. Exports three symbols (AC-2); the six helpers named in D-3 are module-private:

| Exported | From the spike |
| --- | --- |
| `preflightDiffs(context)` | the anonymous block at `spike/src/engine.js:96–162`, named per D-1/D-3 |
| `materialiseDiff(step, context)` | `:872` |
| `trimIncompleteUtf8Suffix(bytes)` | `:985` — the one Q-0049's range-based port would have dropped to adjacency |

Module-private: `named`, `diffSitesOf`, `classifyEndpoints`, `notDueClause`,
`missingEndpointFailure`, `emptyRangeFailure`.

Types are exported too — they are erased at runtime, so the `Object.keys` pin in AC-2 still reads
exactly three. `types.ts` needs `DeferredDiff`, and the narrowed contexts must be nameable by the
tests: `EndpointSide`, `EndpointProducer`, `DeferredDiff`, `RunContextDiffFields`, `DiffContext`,
`PreflightContext`, `DiffStep`.

**Five authority lines, in file order**, matching the `REGISTERED` row added to
`q0050.source.test.ts` and each classifiable by `classifyAuthority`:

| Line | Clause | Site |
| --- | --- | --- |
| 15 | `behaviour preserved from spike/src/engine.js` | module note on the earliest-possible limit |
| 84 | `deliberate addition, not preservation` | the narrowed `DiffContext` — the folder's first narrowing type |
| 184 | `behaviour preserved from spike/src/engine.js` | `classifyEndpoints` returning `[]` for a malformed range |
| 241 | `preserved behaviour, see Q-0038` | the `--base` attribution branch in `missingEndpointFailure` |
| 441 | `preserved defect, see Q-0078` | `diffInputs` keyed by the interpolated range alone |

D-6 handled: `diff.ts` contains neither `merge-base` nor `--is-ancestor`. The comment above
`emptyRangeFailure` makes the vocabulary point by naming *"the command git spells with a hyphen"*
and pointing at `git/git.ts`, which is the one file `git.source.test.ts` lets carry either token.
The **runtime** string `` `${right} adds nothing since its merge base with ${left}.` `` survives
byte-for-byte, as it must. R-5's `merged into` was not carried across.

### `packages/core/src/engine/types.ts` — three fields on `RunContext`

`diffInputs: Map<string, string>`, `deferredDiffs: Map<string, DeferredDiff>`,
`baseOverride: string | null`. All three **required**, not optional, so the spike's
`ctx.diffInputs?.get(…)` optional chaining does not survive the port: the type carries the
guarantee that `types.ts:134–137` already promised Q-0051 to Q-0053 in prose. `import type` only,
so there is no runtime cycle with `diff.ts`.

### `packages/core/src/engine/engine.ts` — the call site and the context literal

Ten added lines: the `./diff.js` import, the three fields in the context literal beside `vars`, and
`preflightDiffs(context)` inside the run `try` and before `const steps = flow.steps` — so a failed
preflight takes the ordinary terminal path, and so the preflight is the earlier of this function's
two reads of `flow.steps` (AC-13).

### `packages/core/src/engine/q0050.source.test.ts` — exactly the four authorised pin edits

1. `:82` — seven files, sorted, `diff.ts` second.
2. `:134` — **the hard-coded array replaced by `production`** (D-2/R-1). This was the dangerous one:
   every other check in that file derives from `production`, and this one did not, so the AC-9d
   guard would have reported green over six files while the seventh went unscanned.
3. `:160` — `diff.ts` added to `REGISTERED`.
4. `:176` — the `preserved defect/` count 7 → 8, with the comment extended rather than replaced so
   the arithmetic stays legible.

Nothing else in that file moved. The AC-1 *demonstration* of (2) lives in `diff.test.ts`, not here,
because the file is only authorised four edits.

### `packages/core/src/turbo-inputs.test.ts` — one register entry

The guard did its job unprompted: it failed the first full run naming three unregistered read bases
in `diff.test.ts`. AC-14 authorises declaring them rather than weakening the guard, so
`READ_BASES` gains `packages/core/src/engine/diff.test.ts` with `opts.project.repoDir`, `ticketFile`
and `runsLog` — each a path under the throwaway repository the test itself built. No turbo `inputs`
change was needed: the new suite opens nothing in this repository.

### `packages/core/src/engine/diff.test.ts` — **new**, 1,042 lines, 44 tests

The ported scenarios. Built on `test/repo.ts`'s existing helpers, every fixture its own throwaway
repository, no assertion about a branch in *this* repository.

---

## 2. Coverage census — what closed, and what could not

AC-14 requires this stated rather than implied. Re-derived by running the ported tests, not by
copying the requirement's table. **The requirement's census was accurate; two rows closed further
than it predicted and are marked.**

| Suite | Scenario | Status here | Where / why not |
| --- | --- | --- | --- |
| `q0035-empty-range.js` | E1 contained | **closed** | `AC-6 › E1` |
| | E2 identical trees | **closed** | `AC-6 › E2` |
| | E3 nothing added since the merge base | **closed** | `AC-6 › E3` |
| | E4 shallow → indeterminate | **closed** | `AC-6 › E4/E13`, real `--depth 2` clone |
| | E5 three identifying phrases | **closed** | `AC-5 › E5` |
| | E6 guard failures stay guard failures | **closed** | `AC-3 › unrelated or malformed`, + remedy feedback in `AC-7` |
| | E7 guard derives from `vars.base` | **closed** | `AC-3 › the guard derives its endpoints from vars.base` |
| | E8 truncation untouched | **closed** | `AC-8 › E8`, incl. the exact `runs.log` line |
| | E9, E14 | n/a | the static twin is Q-0044's, landed at `lint/lint.ts:130–152` |
| | E10 bad range, zero invocations | **partly — further than predicted** | the run-level empty-range diagnosis **is** closed (`AC-9 › E10`, `→ contained`); the missing-ref row by `P1a`; the *zero adapter invocations* half is the structural proxy below |
| | E11 deferred + contained remedy | **closed at message level** | `AC-7 › E11` over a hand-built `deferredDiffs`; the step-time *ordering* claim needs `buildPrompt` (Q-0052) |
| | E12 `--dry` + deferred range | **partly — further than predicted** | the preflight half is closed **positively** (`AC-9 › E12`: a dry run of a deferred range completes and records the deferral); the placeholder *text* is `buildPrompt`'s (Q-0052) |
| | E13 shallow probe | **closed at message level** | the primitive-level half is `git/git.ts`'s and is Q-0042's landed coverage (NG-3) |
| | E15 deferred + indeterminate | **not closed** | needs a shallow fixture driven through a run that creates the branch — a worktree step (Q-0053). The indeterminate *message* is covered by E4 |
| | E16(a) | **closed** | `AC-9 › P2` is the same shape, in its Q-0038 re-cut form (no short-SHA assertion, nothing billed) |
| | E16(b) | **closed at message level** | `AC-5 › P4` |
| | E17 first half (template judged before the fan-out) | **closed** | `AC-9 › P7/E17` |
| | E17 second half (identical bytes to every wave member) | **not closed** | needs fan-out (Q-0053). The once-per-range *count* is closed — `AC-9.5`, counted from `runs.log` truncation notices, not from map size |
| `q0038-endpoint-preflight.js` | P1 (a/b/c/d) | **closed** | `AC-9 › P1a`, `P1b`, `P1c/P1d` |
| | P2 | **closed** | `AC-9 › P2`, with its paired negative |
| | P3 | **closed** | `AC-9 › P3` — asserts the range is in `deferredDiffs` and **not** in `diffInputs` |
| | P4, P5 | **closed at message level** | `AC-5 › P4`, `AC-5 › P5` (both endpoint orders) |
| | P6 | **closed** | `AC-9 › P6` — refuses, and the ticket file is byte-identical |
| | P7 | **closed** | `AC-9 › P7/E17` |
| `q0034-chore-preflight.js` | C2 | **closed** | `AC-9 › P1a/C2` |
| | C3 | **closed** | `AC-9 › C3` |
| | C1, C1b | **not closed** | a chore-shaped flow end to end needs Q-0052 and Q-0053 |
| `q0077-base-flag.js` | B1, B2, B3, B4, B6 | **closed** | the whole `AC-4` block |
| | B5, B7 | **not closed** | drive the CLI; stay with the spike until Q-0010 |
| `q0034-dry-run.js` D1/D2, `q0034-review-fixes.js` B1–B4 | — | n/a | not this module; Q-0050's and Q-0049's, already ported |

**The zero-execution half is a proxy, and this report says so rather than reporting it as the real
thing.** `routing.ts:55` stubs `runAgentStep` to reject with `<id>: execution belongs to Q-0052`, so
no adapter can be invoked in this ticket and no occurrence count exists. Every preflight test instead
spies on `routing.runStep` and asserts it was **never called** — which is strictly stronger than
"no adapter was billed" (it proves no *step* ran at all) but is structural, not a count of paid
occurrences. The real assertion, counting run-history occurrences as
`q0038-endpoint-preflight.js` does, becomes available at Q-0052.

---

## 3. Three things measured rather than assumed

R-D warns that a `Test:` sketch written from intent rather than from code is Q-0049's E-1 failure.
Three claims were measured against the running spike before being acted on.

**(a) A defect I thought I had found by reading, and which does not exist.** Reading
`missingEndpointFailure`'s caller, `notDueClause` appears to have no `pre-existing` arm — so a
range whose endpoints are *both* pre-existing, one of which fails, looked like it would describe the
surviving endpoint as *"a per-task template with no value until … expands its tasks"*. That would
have been the message on `review.yaml`'s most common failure. **It is unreachable**, because the
`endpoints.every(pre-existing)` early return sends that whole class to `materialiseDiff`, which
builds its own clauses. Measured by driving the real spike over `{base}...harness/{id}/integration`
with the branch absent:

```
ticket T-0001: expected harness/T-0001/integration; review requires an integrated branch — it is
the right endpoint of `main...harness/T-0001/integration` (flow file:
`{base}...harness/{id}/integration`); the left endpoint main resolves to 3728524. Neither the diff
nor the containment check was run.
```

Recorded because a reviewer reading the same code in the same order will reach for the same finding.
The port preserves the structure exactly, so the property is preserved with it.

**(b) Which expression node names the `TypeError`** (AC-13). Measured on node 24:
`for (const g of flow.steps)` after destructuring yields `flow.steps is not iterable`;
`context.flow.steps` yields `context.flow.steps is not iterable`; a local binding yields
`steps is not iterable`. `preflightDiffs` therefore destructures `const { flow } = context` and
iterates `flow.steps` directly. The test asserts the message with `toBe`, not a regex, and asserts
the terminal event carries the same string.

**(c) The tests' discriminating power**, demonstrated by breaking the code and watching them fail:

| Injected defect | Result |
| --- | --- |
| `preflightDiffs(context)` removed from `engine.ts` | **14 of 44 red** — every AC-9 test, plus AC-11 and AC-13 |
| `base` resolved from `config.repo.base_branch` in preference to `vars.base` | **6 red** — B1, B2, B3, B6, E5 and E7 |
| `resetTaskBranch` inserted into `diff.ts`, scanned by the old hard-coded array | **green** (the finding); scanned by `production`, **red** |

The second row is worth flagging: the requirement predicted B2 alone would catch a config-resolved
base (R-B, AC-4). Six tests catch it. Note that `engine.test.ts`'s two Q-0077 tests do **not** — they
prove `vars.base` is *set*, never that `materialiseDiff` *reads* it, which is exactly why R-B called
the omission silent.

---

## 4. Corrections to the requirement, made in place

Each is a place the document's sketch did not survive contact with the code. None changes what a
criterion asks for.

1. **D-3's field list for the narrowed context omits `runId`.** AC-8 pins the truncation log line to
   the spike's exact format, `run=<n> diff truncated range=<r> limit=<n> kept=<n>`, which cannot be
   produced without it. `DiffContext` carries `runId: number`; the AC-8 test asserts the whole line.
2. **AC-10's `EndpointProducer` is a three-field projection; the spike stores the classified
   endpoint itself.** `producers` entries carry `class: 'step-created'` as well as `side`, `ref` and
   `step`. Found by `toStrictEqual` over a real run's `deferredDiffs`, not by reading. Declaring the
   projection would have declared a shape the map does not hold, so `EndpointProducer` carries
   `class` and is the union's step-created member.
3. **AC-10's `DeferredDiff.step: string` holds, but only because of a coercion worth naming.** An
   id-less step — which lint still does not refuse; Q-0055 — renders **two different ways** in the
   spike: its branch defaults to `harness/<ticket>/undefined` (from `${s.id}`) while the producer a
   diagnostic quotes reads `null` (from `createdSoFar.get(ref) ?? null`). Both are preserved, with
   the two spellings side by side and a comment saying why collapsing them changes one message or
   the other.
4. **`integrationBranch` from `shared` is used beside `ticketBranchPrefix`.** D-7 rules only on the
   prefix. `shared`'s `integrationBranch` exists and its own JSDoc names `spike/src/engine.js:789` —
   this exact literal — as what it replaces, so this is the same internal-layout choice one function
   along, not a new one. Flagged because D-7 does not say it in words.

---

## 5. Reported, not fixed

The requirement's six, plus two found while porting. None is fixed here.

| # | Item | Note |
| --- | --- | --- |
| R-1 | `q0050.source.test.ts:134` failed **open** | Fixed here, because AC-1 requires it and leaving it would ship a guard blind to the file this ticket adds. The *class* — a literal list beside a derived one in the same file — is reported and may exist elsewhere |
| R-2 | `200000` is now spelled a third time | spike `materialiseDiff`, `packages/shared/src/project.test.ts:97`, `diff.ts`. Kept a literal per D-9 |
| R-3 | Q-0051's body is outside the transcription corpus | `q0050.source.test.ts:189`; widening it would fire on a faithful port (D-10) |
| R-4 | Q-0078's cache keying | Ported as it stands and registered with a `preserved defect, see Q-0078` line. The count pin moved 7 → 8 so it cannot be disguised as newly correct |
| R-5 | `merged into` in a spike comment | Not carried into `core`; no `core` guard would have caught it |
| R-6 | Stale worktrees under `.harness/worktrees/` | Q-0062's subject |
| **R-7** | **`engine.ts`'s preserved `Why:` line now says "throws a raw TypeError *here*", and it no longer does** | The preflight throws first. AC-13 says that line *"stands unchanged"*, so it is unchanged. The new comment directly above it says the preflight is the earlier of the two reads, so a reader is not misled — but the word "here" is now stale and a reviewer should weigh whether AC-13 intended that |
| **R-8** | **An absent step id renders two different ways** | See correction 3. Preserved deliberately; it is one symptom of Q-0055 |

---

## 6. What I deliberately left alone

- **`spike/**`** — `git status --porcelain spike/` reports zero changes. The freeze holds and the
  witness is intact.
- **`packages/core/src/index.ts`** — byte-identical to `export const name = '@quorum/core';`. No
  public re-export; Q-0052 imports `./diff.js` directly (AC-14, and `git.source.test.ts`'s precedent).
- **Q-0078.** The cache stays keyed by the interpolated range. Choosing among keying by site,
  invalidating on deferral and forbidding the shape in `harness lint` is Q-0078's requirement, and
  the obvious fix collides with the identical-bytes guarantee.
- **The range guard**, `diffSitesOf` vs `lint.ts`'s `diffSites`, and `BASE_ENDPOINT` /
  `TICKET_ENDPOINT_PREFIX` (NG-4). The two are the same *rule* at two different moments —
  pre-interpolation text against post-interpolation values — and hoisting the constants would make
  them agree on a string neither should compare.
- **The two `git diff` spawns stay inside `diff.ts`** (D-9). Invariant 8 governs *ancestry*, which
  goes through `emptyRangeEvidence` → `ancestry()`; a patch and a stat are not ancestry, and a ninth
  export would break `git.source.test.ts`'s eight-function pin.
- **`interpolate`** is unchanged and still types its parameter `string`. The three coercion sites are
  written deliberately at the call (AC-11).
- **`ensureWorktree`'s silent `HEAD` fallback** (NG-11), and every other module.
- **No `if (dry)` in the preflight.** Asserted at the type rather than by grepping for the word: the
  narrowed context carries no `dry` field at all, so the branch is unrepresentable. A
  `@ts-expect-error` over `full.dry` is the proof.

---

## 7. Verification

Run in this worktree, which had **no dependencies until they were installed** — `pnpm install
--frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund` both ran first, per
`harness/rules.md`.

| Command | Result |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21 successful, 21 total · 0 cached** |
| `@quorum/core` alone | **42 test files passed, 1 skipped · 955 passed, 2 skipped** |
| `packages/core/src/engine/diff.test.ts` | **44 passed** |
| `npm test --prefix spike` | **all 15 test files passed**, tree unmodified |
| `git status --porcelain spike/` | **empty** |

`--force` and `0 cached` matter here: an unforced `pnpm lint` in this worktree replayed six of seven
tasks from `harness__Q-0038__implement`'s cache — the shared-worktree replay Q-0065 and Q-0071 are
about — so every gate above was re-executed rather than replayed.

**Not verified here, and it is the reviewer's to weigh:** the merged result on `main` with the suite
forced in both environment rows (`.harness/worktrees` and `.quorum/runs` present and absent), per
Q-0072's closing finding and Q-0073's. That check belongs after `integrate`, in the integration
worktree and again on `main`.

---

## 8. Open questions, ruled as the requirement rules them

- **OQ-1 — should `preflightDiffs` emit an `info` event naming what it skipped?** Ported as-is, no
  event. Adding one is new behaviour under charter §2 and would need its own authority. Q-0052
  inherits the question with the `--dry` placeholder text.
- **OQ-2 — does `DeferredDiff` keep both `ref`/`step` and `producers`?** Yes, all three. The
  redundancy is Q-0038's and deliberate; collapsing it turns `emptyRangeFailure`'s single-producer
  line into a list, which is externally observable.
- **OQ-3 — does Q-0052 define the prompt-side reads?** No branch exists. This ticket exposes the
  typed fields and the two-function API and stops there.

**No decision entry is owed by this change.** Every ruling above is either an application of an
existing entry — *"A range is checked one endpoint at a time"* (2026-08-30), *"Q-0035 accepted"*
(2026-08-25), *"The port preserves behaviour"* (2026-08-25), *"A check is not established by reading
it"* (2026-08-29) — or an internal-layout choice charter §2 leaves to the implementer. R-7 is the
one item that could become an erratum if the reviewer reads AC-13 as requiring the stale word to go.
