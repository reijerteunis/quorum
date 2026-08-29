# Q-0050 review round 4 — `8355940..addefa8`

Read-only; nothing modified. The diff closes all eleven round-3 findings and adds four tests from the coverage audit. `npx vitest run src/engine` is green (6 files, 65 tests).

**Two things about the tree first.** `9dd2e44` landed *during* this review — round 4's codex major on AC-13d. It replaces the 120-character length proxy with a real substring scan and widens the register from seven `defect` markers to ten `Why: preserved <kind>` markers. That was my strongest finding against the reviewed diff and it is already closed, so I've dropped it. One new live defect it introduced is reported at the end.

**Nine findings: five major, four nits, no blockers.**

## Majors

**1. `types.ts:176` still justifies `nextGateId` by the per-step copy the fix deleted.** The JSDoc reads *"because `engine.ts` spreads a fresh context per step"*. `engine.ts:231` now passes `context` itself. `engine.test.ts:138` repeats it in the present tense. This is the half of round 3's M1 remedy that did not land — the verdict asked for *"one line in `types.ts` [saying] the context handed to a step is the run's own object"*, and the file was left saying the opposite, in the contracted seam Q-0051–Q-0053 read.

**2. `qa/scenarios.md:313` still says the terminal event carries the raw cost.** E-18 rules it rounded; `lifecycle.test.ts:80` asserts `1.235`. The audit corrected the traceability row (`:75`) and left the scenario body contradicting it — E-18's own defect reproduced one section lower, in the commit whose purpose was the row-by-row pass. AC-4d (`:191`) is the same shape but its row flags the supersession; AC-9f's has nothing pointing away.

**3. AC-4c's new test does not construct clause (i), and its discrimination cannot fail** (`lifecycle-routing.test.ts:60-76`). The criterion is "a second envelope for a `gateId` already answered". The test asks a *fresh* gate `3:2` with an envelope carrying `3:1` — mechanically identical to the stale case already at `:80`. Both errors come from the same branch (`routing.ts:39-41`) with the same template, so `not.toBe` at `:75` is satisfied by the interpolated id alone and cannot fail. `:64-65` duplicates the happy path and constrains nothing.

**4. AC-6d's recorded justification names the wrong log line** (`lifecycle-routing.test.ts:156-170`, `scenarios.md:66`). The row says the criterion's disk method is unusable because *"`askGate` writes its line after the answer arrives"* — but AC-6d names the `exhausted` history entry and *its* `runs.log` line, written by `recordEvent` (`lifecycle.ts:91-92`) synchronously before `askGate` is entered. The real obstacle is E-8's: `handleFail` has **no caller in `packages/core/src`**. Meanwhile the substitute asserts mock call-count against a `vi.fn()` that writes nothing, so it cannot distinguish *called* from *persisted*.

**5. Step-id enrichment moved from bind time to emit time, unpinned** (`engine.ts:72-86`). M1's subject was the copied context; the remedy also changed *when* the id resolves. An adapter event emitted after `runStep` settles now gets **no** `stepId`; one emitted while a later step runs gets the **later** step's id. Unreachable today, and it does follow the verdict's own first remedy — but AC-2b is struck by E-8, so the semantics changed with zero coverage in either direction.

## Nits

- **`engine.ts:131`, `lifecycle.ts:19`** — the two new authority comments are 2- and 3-line prose; `harness/rules.md:40` says *one line*, and round 4's scan only inspects the marker line.
- **`channel.ts:11-15`** — the header's *"cannot observe completion before that persistence has actually run"* is now false: `detachPending` resolves the in-flight pull `{done:true}` before `await finalise()`. The change is right; neither the header nor the contract says an outstanding pull settles as a clean end.
- **`loaders.ts:44-51`** — the dropped `String()` coercion is recorded in a JSDoc addressed entirely to Q-0051/Q-0052, which is E-11's own "a comment is not a route".
- **`engine.test.ts:202`** — the fixed assertion pins object identity (AC-10f's subject, already pinned at `:269`); with `iterations: {}` it cannot distinguish unchanged from emptied.

## Live at HEAD, outside the reviewed range

`qa/scenarios.md:90` now carries both halves of a contradiction in one cell — the new substring scan *and* the superseded "it is a proxy … needs a route this task does not have", which `9dd2e44`'s own commit message says was wrong.

Full write-up with fixes at `/Users/ruudvanengelenhoven/.claude/plans/you-are-a-senior-snug-dawn.md`.
