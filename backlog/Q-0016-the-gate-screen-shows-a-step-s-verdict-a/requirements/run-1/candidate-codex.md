# Q-0016 — The gate screen shows a step's verdict and takes the answer

## Problem

A solo maintainer can observe a live run in the Studio, but cannot answer a gate there. The registered `/runs/:handle/gate` route is still a placeholder, and the web app has no write-capable daemon client.

The current daemon contracts are sufficient to show the pending gate's question and submit an answer. They are not sufficient to build the structured verdict card or diff promised by the original M3 brief:

- A replayed gate event carries the gate kind, reason, ticket directory and optional retry target.
- Retained `warn` and `done` events may describe a step's verdict and findings, but only as human-readable messages. Their text is not a machine-readable contract.
- No browser-facing contract carries structured findings, a verdict summary, full reasoning, a diff, or the diff range.
- The verdict artifact under the ticket's `.harness/` directory is deliberately outside the backlog read surface.

This ticket therefore delivers the answerable gate screen over existing daemon contracts. It shows retained step evidence verbatim and does not label parsed message fragments as a structured verdict. Structured verdict evidence and diffs require separate product and architecture decisions.

Surfaces touched: the Studio and its daemon client. The CLI, harness files, backlog files, engine behavior, and daemon route set are unchanged.

## User story

As a **solo maintainer**, I want to open a run that is parked at a gate, understand what the gate asks and what the retained run events said immediately before it, and submit a valid gate answer, so that I can continue or end the run without returning to the CLI.

## Acceptance criteria

1. The Studio route `/runs/:handle/gate` renders a gate screen instead of the Q-0016 placeholder. The route remains directly addressable and accepts the opaque daemon run handle from the URL.

2. On entering the route, the screen reads `GET /runs/:handle` and joins that run's existing live event connection. It does not start a run, stop a run, move a ticket stage, take a run lock, or make any other mutation while loading.

3. When the replayed stream contains a currently pending gate event, the screen shows its `kind`, `reason`, and `ticketDir` exactly as received. If the event carries `retry`, the screen also names that step as the retry target. A missing `retry` is rendered as “No retry target was supplied”; it is not replaced with an inferred step.

4. The screen shows retained `warn` and `done` events received before the pending gate under the heading “Run evidence”, in stream order and with each event's complete message unchanged. A `done` event also shows its supplied `stepId`. The screen does not parse a verdict, findings, counts, cost, duration, or any other machine value from either message format.

5. The screen does not render a structured verdict card, findings list, reasoning section, diff summary, fabricated empty value, skeleton, or spinner for evidence the daemon did not supply. If no retained `warn` or `done` event precedes the gate, it says “No step evidence is available in the retained events.”

6. If the connection reports that earlier events were missed, the screen states the reported count and says that the displayed run evidence may be incomplete. It does not treat absence from an incomplete replay as proof that the step emitted no verdict or findings.

7. A pending gate presents exactly three gate-answer controls: `Advance`, `Retry`, and `Abort run`. There is no fourth answer, free-text reason, confirmation note, override action, or locally invented answer value.

8. `Advance` submits `POST /runs/:handle/gate` with JSON containing exactly the pending event's `gateId` and `answer: "advance"`. `Abort run` submits the same envelope with `answer: "abort"`. No other request field is sent.

9. When the pending gate event carries `retry`, the enabled `Retry` control submits the same envelope with `answer: "retry"`. When the event does not carry `retry`, the `Retry` control remains visible but disabled and is accompanied by “This gate supplied no retry target.” It sends no request. This prevents the current engine behavior from treating an unsupported retry as an abort while preserving the screen's three-answer vocabulary.

10. While an answer request is in flight, all three answer controls are disabled. One screen instance can therefore have at most one answer request in flight for a gate. The selected answer is not written to local storage, session storage, a cookie, IndexedDB, a URL parameter, or a file.

11. After a successful answer response, the screen says which answer was sent and continues to show events from the same live connection. It does not claim that the next step succeeded, that the ticket advanced, or that the run ended until a received event or run lookup establishes that state.

12. Once the answered gate is no longer pending, the answer controls are removed. The route remains on screen and shows the resulting run state; it does not redirect to the unfinished mission-control screen.

13. If an answer request returns `no-such-gate`, the screen says “No gate is waiting under that id. Reload the run state before answering again.” It does not claim that the earlier answer succeeded, because the response cannot distinguish a landed answer from any other disappearance of that gate.

14. Any other non-successful answer response shows the daemon's explicit failure information and leaves the screen able to reload current run state. A failed request never produces an optimistic success message and is never silently retried.

15. A running run whose lookup reports `pendingGates: 0` and whose replay supplies no pending gate shows “This run is not waiting at a gate.” No answer controls are rendered.

16. An ended run with no pending gate shows “This run has ended.” Its retained events may still be displayed, but no answer controls are rendered.

17. A `404` lookup for a handle the daemon never minted shows “Run not found.” A connection or request failure that prevents the daemon from answering shows “The local daemon could not be reached.” These states remain distinct and neither claims that a gate exists.

18. If `GET /runs/:handle` reports one or more pending gates but replay has not supplied the corresponding gate question, the screen says “A gate is waiting, but its question was not available from the retained events.” It renders no answer controls because it has no `gateId` to correlate safely.

19. The daemon client accepts an explicit HTTP method and optional JSON body, validates every response with the existing shared wire schemas, and keeps every request same-origin and page-relative. Existing read callers continue to issue GET requests without bodies.

20. The source guard that previously prohibited every mutation in `apps/web/src` is narrowed rather than deleted. It permits only the gate screen's `POST /runs/:handle/gate` request and continues to fail if the backlog board, ticket page, or any other Studio source issues POST, PUT, PATCH, or DELETE requests or names the stop route.

21. The route register remains the single source used by the router, rail, and route tests. Its `/runs/:handle/gate` entry records that the screen now exists. This ticket adds no navigation from the backlog board, ticket page, or mission control.

22. Automated Studio tests cover: a replayed pending gate; verbatim evidence without parsing; an incomplete replay; all three submitted answer values; disabled retry without a retry target; duplicate-click prevention; successful continuation; `no-such-gate`; another explicit refusal; running without a gate; ended; unknown handle; unreachable daemon; and a pending count without a replayed question.

23. Existing mock-adapter end-to-end tests remain green. No engine, gate schema, answer vocabulary, flow file, ticket file, worktree rule, adapter contract, or run-history format changes as part of this ticket.

24. Cross-cutting checks are explicit: BYOS is unaffected; worktree safety is unaffected; human-gate behavior changes only by adding a browser caller to the existing answer route; no persistent file or schema changes; the cross-vendor rule is unaffected; the feature remains product-agnostic; and the cold-clone path gains no installation step or dependency.

## Non-goals

- A structured verdict card, structured findings, deduplicated severity counts, verdict summary, or full judge reasoning.
- Parsing `warn` or `done` message prose into machine fields.
- Reading, listing, or serving verdict artifacts or any other `.harness/` path through backlog routes.
- Rendering a diff, choosing a diff range, adding a diff endpoint, or adding `diff2html`, `diff`, `jsdiff`, or another rendering dependency.
- Changing the event union, `WireRun`, gate question schema, gate answer schema, engine routing, or the meaning of `retry`.
- Adding a fourth answer, an override action, or a reason field.
- Mission control, navigation from mission control, the backlog board, or the ticket page.
- Step chat, run history, starting a run, stopping a run, moving a ticket stage, or taking a run lock from the browser.
- Browser persistence, offline answer queuing, automatic retries, authentication, a remote daemon, multi-user coordination, cloud sync, a plugin marketplace, a visual flow canvas, eval suites, another adapter, or a desktop shell.

## Open questions

1. **Owner: product manager; blocking for the follow-up evidence ticket, not Q-0016.** What new contract should carry a structured verdict, findings, summary, and full reasoning? The alternatives are widening the event union or adding a dedicated daemon read surface. Serving the verdict artifact through a backlog route is not assumed and would require a decision entry under Q-0127 E-1.

2. **Owner: product manager and principal architect; blocking for the follow-up diff ticket, not Q-0016.** Which git range belongs to a gate, where is that range derived, and should the repository adopt a diff-rendering dependency? No answer is implied by this screen.

3. **Owner: ticket owner; blocking before this ticket leaves requirements.** Should Q-0016 take the full seven-stage route or the `chore` flow? The product requirement does not alter behavior based on that delivery choice.

## Risks

- Retained event evidence is best-effort. An event-retention change could remove the messages that explain a gate while leaving the newest gate question available. AC-6 and AC-18 require the screen to expose that limitation instead of presenting an incomplete account as complete.
- Human-readable `warn` and `done` messages can change without a wire-schema change. Rendering them verbatim is resilient; tests that infer structured meaning from their spelling would create an accidental contract.
- An author-declared gate can omit `retry`, while the answer vocabulary still includes it. Sending `retry` in that state currently follows the engine's abort path. AC-9 contains that risk in the Studio without changing engine behavior.
- A successful POST response can be lost. A later `no-such-gate` response cannot prove whether the first answer landed, so the screen must use the neutral wording in AC-13.
- The gate route represents transient state. A bookmark commonly opens after the decision has already been taken; AC-15 and AC-16 make that an explicit state instead of a broken or silent screen.
- Narrowing the read-only guard incorrectly could allow unrelated Studio screens to mutate daemon state. AC-20 requires a positive allow-list for the one authorized write rather than removing the boundary.
- Direct URL entry remains the only navigation path until mission control ships. That limits discoverability but is intentional scope containment, not a hidden dependency.
