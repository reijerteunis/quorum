# Review — Q-0092 implement run 2, iteration 2

Verdict: revise.

major: packages/cli/src/runs.test.ts:442 AC-9 explicitly requires translating `q0011-run-history.js:121–124` through a separate reader process, but this test calls `invoke` in the same process and its comment defers process separation to Q-0095. That weakens the inherited guard: it does not prove a fresh CLI process can recover and render a billed failure solely from the persisted manifest. It also conflicts with `spike-parity.test.ts:160–161`, which claims this binary scenario is carried by this test file. Add a test that launches the built CLI (or another genuinely separate reader process) against the persisted fixture and asserts the failed occurrence’s usage, then remove the Q-0095 deferral from the parity-register account.
