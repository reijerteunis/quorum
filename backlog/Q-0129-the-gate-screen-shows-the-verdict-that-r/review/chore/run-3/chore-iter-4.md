# Q-0129 code review — run 3, iteration 4

Verdict: **revise**

- major: packages/core/src/engine/routing.ts:119 The author-declared path clears `context.reached` before `askGate` determines whether a question will actually be emitted. For an `auto` gate, or any non-locked gate under `--auto`, `askGate` returns at lines 35–37 without emitting the question, yet the decision has already been spent. A subsequent human-locked gate therefore reports no evidence even though no reader saw the decision, contradicting the implementation’s stated rule that taking/presenting the decision is what consumes it. Preserve the slot when `askGate` auto-advances, or move consumption to a point where the engine knows the question was presented.

- major: packages/core/src/engine/routing.ts:91 The parallel-group reconciliation blindly re-applies every collected verdict after all members settle, including a verdict already carried and spent by that member’s exhaustion gate. If a verdict-declaring parallel member reaches an exhaustion gate and the reader advances it, lines 91–94 restore that same decision to `context.reached`; a later gate can then present evidence the reader already answered, violating AC-6. Track whether each collected decision was consumed, or reconcile only unspent decisions, and add a regression covering a parallel member’s exhaustion gate followed by another gate.

observation: The supplied patch was truncated at 200,000 bytes and omitted 14 files, including the engine routing, step, type, shared-schema, server, and transport-test changes. This review inspected those files directly from `harness/Q-0129/implement` rather than judging them from the stat.

observation: GO-5’s second-environment verification and GO-6’s manual browser demonstration remain operator obligations explicitly reported as outstanding by the implementer.
