# Q-0016 — code review, run 2, iteration 2

verdict: revise

major: apps/web/src/gate-screen.tsx:394 The early return for every non-loaded run state hides `AnswerRegion` immediately after `send()` records an accepted answer or `no-such-gate`, because `read()` synchronously changes `run` to `in-flight`. If that follow-up read hangs or fails, the screen never shows which answer the daemon accepted or the required neutral “gate is no longer waiting” message; it only shows the read state. This violates AC-11 and AC-12 precisely on the unreliable-response paths those criteria cover. Keep the answer outcome visible while the background read is pending or unsuccessful—for example, render `AnswerRegion` independently of the loaded-run branch or retain the last loaded run during refresh—and add deferred/failing re-read tests for both `204` and `no-such-gate`.

observation: The supplied patch contained no patch for `packages/shared/src/wire.ts` or `packages/shared/src/wire.test.ts`; both were inspected directly from `harness/Q-0016/implement` rather than judged from the stat alone.
