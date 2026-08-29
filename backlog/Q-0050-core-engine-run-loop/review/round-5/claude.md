# Q-0050 round 5 — `addefa8..HEAD`

Read-only. Verified: `npx vitest run src/engine` → 6 files, 66 tests green; `git status` clean. I also re-ran the new AC-13d transcription scan by hand over **every** line of the six production modules — zero matches, which bears on M3 below.

**Eight findings: four major, four nits, no blocker.**

---

## Majors

### M1 — deleting the three-case gate test drops AC-4d and AC-4e entirely
`packages/core/src/engine/lifecycle-routing.test.ts:60`

Round 4's M3 was about AC-4c's construction. The fix removed the *neighbouring* test — `'no channel, stale correlation and invalid runtime answers fail by name'` — whole, and only one of its three assertions was M3's subject. Two branches now have no coverage anywhere in `packages/core`:

- **`routing.ts:23`** (`has no answer channel`) — this is **AC-4e** (`qa/scenarios.md:194`): *"no `answerGate` supplied at all → the run fails, naming the pending gate's kind and reason"*. Grepped: no other test calls `askGate` or drives a gate step without `answerGate`.
- **`routing.ts:36-38`** (the `gateAnswerEnvelopeSchema` refusal) — **E-19 cites that test by title** as the pin recording its ruled divergence from AC-4d. `packages/shared/src/events.q0050.test.ts:46` tests the *schema*; nothing now asserts `askGate` throws a `FlowError` naming the gate rather than falling through to `{ abort: true }` as `spike/src/engine.js:590` does. A port regressing to the spike's silent-abort would be green everywhere.

And `qa/scenarios.md:60` still reads *"`lifecycle-routing.test.ts` (**4a–4g** at the `askGate` unit level)"* and still cites E-19 for 4d — a coverage claim the same commit falsified. **Fix:** re-add the two dropped assertions (two lines) and correct the row.

### M2 — the widened marker regex still cannot see two preservation authority lines
`packages/core/src/engine/q0050.source.test.ts:123`

`/Why: preserved (\w+)…/` closes E-20's *spelling* gap and leaves the **word-order** one. Thirteen `Why:` lines exist in the folder; the register pins ten and reports complete:

- `engine.ts:8` — `Why: behaviour preserved from spike/src/engine.js:37-174 (charter §2, Q-0050).`
- `loaders.ts:3` — `Why: behaviour preserved from spike/src/engine.js (charter §2, Q-0050).`

`loaders.ts` is absent from `REGISTERED` altogether. This doesn't touch E-20's count ruling (seven `defect/` is right) — it is E-20's own failure mode surviving the fix written to close it, one turn later. **Fix:** anchor on `Why:` and classify, or match `preserved` in either order.

### M3 — the transcription scan reads only the marker line, and AC-13's "one line" half now has no check at all
`packages/core/src/engine/q0050.source.test.ts:151`

`if (!/Why: preserved/.test(line)) continue;` inspects one line per comment. Four authority comments run to two or three lines — `engine.ts:35-36`, `:170-172`, `:217-219`, `:225-226` — so six comment lines are outside the scan, one of which (`engine.ts:219`) already cites a decision by title. AC-13 requires *both* halves: *"names its authority **on one line** … **and** none transcribes"*. The deleted 120-char proxy was the only mechanical pressure on the first half; nothing replaced it, and N1's remedy was applied to the two comments N1 named and to none of the other four in the same file.

I ran the scan over all lines of all six modules: zero hits. So the widening is free today, and this is a guard gap rather than a live violation — but it is the guard Q-0051–Q-0053 inherit. **Fix:** drop the line filter (`harness/rules.md`'s "never restate DECISIONS.md" governs the whole file), and collapse the four comments or assert the one-line form.

### M4 — the load-bearing half of the remedy is newly documented and unpinned
`packages/core/src/engine/types.ts:117`

The new JSDoc leads with *"**A step receives this object itself, never a copy**… Q-0051 to Q-0053 may add fields here and assign them across steps"* — the property that motivated removing the spread (`ctx.fanned`, `ctx.failingTasks`, `ctx.lastIntegration`). The new test at `engine.test.ts:388` pins the *emit-time step id*, which was the passenger; nothing in `packages/core/src` asserts a field assigned in step one survives into step two. The contracted seam now promises in prose exactly what M5 objected to being unpinned. **Fix:** the two-step stub is one line away from covering it.

---

## Nits

- **`lifecycle-routing.test.ts:64`** — *"which made it mechanically the stale case already covered below."* The test below was deleted in the same commit.
- **`q0050.source.test.ts:131-132`** — both length assertions are strictly implied by `toStrictEqual(REGISTERED)` two lines above; neither can fail independently. Same shape as M3/N4 last round.
- **`engine.test.ts:274`** — `toBe(originalIterations)` is still at `iterations: {}`, the exact indistinguishability N4 raised at `:202` and called *"already pinned at :269"*. One of the two sites was fixed.
- **`q0050.source.test.ts:138`** (and `qa/scenarios.md:90`) — *"both already declared inputs of this task"*. `docs/DECISIONS.md` was declared for `@quorum/shared#test`, not `@quorum/core#test`; `9dd2e44` added it here in the same change. The claim that mattered — no new route through Q-0072's guard, `repoFile` already being a registered route — is correct.

---

## Checked and clear

`channel.ts:11-17`'s new exception is accurate and covered by `channel.test.ts:88`. The M3 replacement does construct clause (i) — one context, first gate genuinely resolved. The M5 test discriminates bind-time from emit-time by construction. `turbo.json`'s new `DECISIONS.md` entry is required and correct, and `backlog/*/ticket.md` was already there. The `REGISTERED` map matches the tree exactly, in order.

The full write-up is at `/Users/ruudvanengelenhoven/.claude/plans/you-are-a-senior-purrfect-widget.md`. I have not modified anything in the repository.
