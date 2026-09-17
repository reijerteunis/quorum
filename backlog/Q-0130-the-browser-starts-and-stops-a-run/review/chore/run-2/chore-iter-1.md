# Review: Q-0130

Verdict: **revise**

- major: `apps/web/src/run-lifecycle.ts:214` A pending confirmation survives a subject change. `confirm` uses the current `subject` as `mine`, but executes the previously captured `asked.send`; after navigating from one ticket or handle to another, confirming can mutate the old subject while recording the in-flight state and accepted outcome against the new one, including navigating on an old ticket’s successful start. Clear or key pending confirmations on subject changes, and ensure the request subject and attribution subject are captured together. Add coverage for changing subject after asking but before confirming.

- major: `apps/web/src/mission-control-screen.tsx:121` The stop confirmation remains rendered and actionable even when a metadata read changes the run from `running` to `ended` or `refused`. This violates AC-8’s requirement that a stop control be offered only while the daemon last reported `running` and permits a stale confirmation to issue a stop after the latest read says otherwise. Withdraw or disable the confirmation when `running` becomes false, and test a metadata transition between asking and confirming.

- major: `apps/web/src/daemon-client.ts:315` `startRun` reads and parses the response body before checking whether a successful response has status `201`. Consequently, a `204` or another bodyless 2xx is reported as “the response body was not JSON” instead of the required status disagreement. After preserving the non-2xx refusal path, check `response.status !== 201` before reading the success body; add a bodyless non-201 2xx test.

observation: The supplied patch was truncated and omitted `docs/05-design-prompt.md`, `packages/server/src/http.ts`, `packages/server/src/package.test.ts`, `packages/shared/src/docs.test.ts`, `packages/shared/src/wire.test.ts`, and `packages/shared/src/wire.ts`; these files were inspected directly from `harness/Q-0130/implement`.
