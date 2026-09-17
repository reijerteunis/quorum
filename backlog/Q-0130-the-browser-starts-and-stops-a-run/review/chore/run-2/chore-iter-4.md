# Review — Q-0130, chore iteration 4

Verdict: **revise**

major: apps/web/src/ticket-page.tsx:275 The confirmation is rendered and remains actionable independently of the refreshed ticket and flow states. A reader can select a runnable consuming flow, press Refresh, receive a new ticket stage or flow listing where that flow no longer consumes the stage or is `runnable: false`, and still use the surviving confirmation to start it. That contradicts AC-6’s requirement that only runnable flows consuming the ticket’s current stage are offered; rendering the flow as refused while retaining its live confirmation still offers it. Associate the pending confirmation with the selected flow’s eligibility and withdraw it when a read reports that the flow is absent, non-consuming, or non-runnable. Add a test that refreshes between asking and confirming and proves no POST can be issued after eligibility is lost.

observation: The supplied patch omitted six changed files due to truncation; I inspected `docs/05-design-prompt.md`, `packages/server/src/http.ts`, `packages/server/src/package.test.ts`, `packages/shared/src/docs.test.ts`, `packages/shared/src/wire.test.ts`, and `packages/shared/src/wire.ts` directly from `harness/Q-0130/implement`.
