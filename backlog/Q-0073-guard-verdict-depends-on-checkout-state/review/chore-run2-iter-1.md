# Q-0073 — chore review, run 2

*`code-reviewer` · codex · recovered from `.harness/review-1787910630040.raw.txt`, the raw output
run 2 saved when the engine refused the answer. Decoded from that file, not retyped.*

**Verdict: approve**, with the two nits below. The run failed anyway: the engine required an
approving verdict to carry no findings at all, while this flow's own instructions said "nits
alone approve". That contradiction is fixed — see `docs/decisions/059-a-nit-does-not-contradict-an-approval.md`
and Q-0006 erratum E-4 — and the findings are restored here so the round that was paid for is not lost.

## Summary

The implementation satisfies the functional requirement and binding erratum. Two non-blocking review findings remain: one inaccurate historical claim and one regression assertion weaker than AC-5 requires.

## Findings
1. nit: packages/core/src/turbo-inputs.test.ts:73 The durable guard prose says CI reported green, but the requirements explicitly correct that claim: CI never ran the relevant revision. Change this to say only implement and integrate reported green, with the fresh-clone result identified as the proxy for CI’s checkout shape.

2. nit: packages/core/src/turbo-inputs.test.ts:1593 AC-5 requires the forced suite to detect any unintended reduction from the measured 60 per-file-distinct and 34 distinct literals, but `toBeGreaterThanOrEqual` allows removals whenever unrelated additions keep the totals at or above those floors. Pin the baseline set or otherwise compare identities so removing or replacing a collected literal is detected, while deliberately accounting for later additions.
