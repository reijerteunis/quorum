# Q-0130 — The browser starts and stops a run

## Problem

The local daemon can start and stop runs, but the browser cannot issue either mutation. Runs started by `quorum run` execute in another process and never enter the daemon's run registry. As a result, a normal browser session cannot create the runs that mission control is intended to show.

The backlog board already names every flow that consumes a ticket's current stage. Those names are informational only. Where more than one flow consumes a stage, choosing one on the maintainer's behalf would silently make a consequential routing decision.

Stopping has the same browser write boundary as starting. Both operations are irreversible, must be confirmed, must be limited to one outstanding request, and must render the daemon's answer rather than infer an outcome. A concurrent read or refresh must not clear the outstanding-mutation guard.

Surfaces touched: local daemon + web UI. The CLI, `harness/` file formats, backlog file formats, adapter contract, and core run semantics are not changed.

## User story

As a **solo maintainer**, I want to select an eligible flow for a ticket, deliberately start it through the local daemon, and deliberately stop a running run, so that mission control contains runs I initiated in the browser and I can cancel one without using a hand-written HTTP request.

As a **cold-clone adopter**, I want the browser to preserve human gates and show the daemon's actual response to each lifecycle action, so that the UI does not silently choose a flow, bypass a gate, or claim that a run started or stopped when the daemon refused it.

## Acceptance criteria

1. **Actionable flow selection on the backlog board.** For each ticket, the web UI offers a start action for each runnable flow returned by `GET /flows` whose `consumes` value equals that ticket's current stage. The human selects the flow explicitly; the UI does not select the first matching flow or present a single generic “run next flow” action.

2. **No action for an unreadable flow.** A flow whose row is marked `runnable: false` remains named as unreadable and cannot be selected to start a run.

3. **No invented action when flow data is unavailable.** While `GET /flows` is loading or has failed, and where no flow consumes a ticket's stage, the board preserves its existing explanatory state and offers no start action for that ticket.

4. **Start request contract.** After confirmation, the browser issues exactly one `POST /runs` request with JSON body `{ "flow": <selected flow name>, "ticket": <ticket id> }`. It does not send `dry`, `auto`, `base`, or an unknown field.

5. **Start confirmation.** Before `POST /runs` is issued, the UI asks for explicit confirmation and names the ticket id and selected flow. Cancelling the confirmation issues no request and leaves the board usable.

6. **Start success comes from the daemon.** Only a `201` response whose body satisfies the shared `WireRun` schema is a successful start. The UI uses the handle returned in that body and navigates to, or provides an immediate link to, that run's mission-control route. It does not invent a handle or infer success from the request having been sent.

7. **Start refusals preserve their contract.** A non-success response from `POST /runs` is rendered through the existing daemon request-state model. The browser preserves and displays the daemon refusal's `code`, `condition`, and remedy when present; it does not classify the refusal from HTTP status alone.

8. **Unexpected start responses are explicit.** A successful HTTP status other than `201`, malformed JSON, or a `201` body that fails the shared schema is shown as a protocol or response error and is not treated as a started run.

9. **Stop availability follows daemon state.** A stop action is available only for a run whose latest daemon-supplied state is `running`. It is absent or disabled for `ended` and `refused` runs. The control is available from the existing run or mission-control surface; this ticket does not add a new route.

10. **Stop confirmation.** Before a stop request is issued, the UI asks for explicit confirmation naming the run handle. Cancelling the confirmation issues no request and does not change the displayed run state.

11. **Stop request contract.** After confirmation, the browser issues exactly one `POST` to the path returned by `runStopPath(handle)`. This ticket does not collect a reason; the request omits the optional reason or sends the daemon-valid empty object. It never sends an empty-string reason.

12. **Stop success is exactly 204.** The daemon client recognises status `204` before attempting to read a response body. No other 2xx status is accepted as success. A 2xx status other than `204` is rendered as a protocol error that states the received and expected statuses.

13. **Stop refusals are code-driven.** For a non-204 stop response, the client reads and validates the daemon refusal. It distinguishes at least `no-such-run`, `not-running`, and `not-a-reason` by refusal code rather than HTTP status, and renders the daemon's condition and remedy when present.

14. **The finish-versus-stop race is not guessed.** If a run ends before its stop request reaches the host, the UI renders the daemon's `not-running` refusal. It does not relabel that response as a successful stop or infer completion from the attempted mutation.

15. **Stop language is distinct from gate language.** The stop control and its pending, successful, refused, and error messages use “stop” or “cancel”. They never describe stopping as `advance`, `retry`, `abort`, a gate answer, or an approval.

16. **One lifecycle mutation at a time per mounted screen.** From confirmation acceptance until the start or stop request settles, all controls on that mounted screen that can start or stop a run are disabled. Repeated clicks, keyboard activation, or form submission cannot issue a second lifecycle mutation.

17. **Reads cannot clear the mutation guard.** A refresh, retry, polling update, live event, or other GET started or completed while a lifecycle mutation is outstanding does not re-enable its start or stop controls and does not erase the pending message. The controls become eligible again only when the mutation itself settles or the screen unmounts.

18. **Late responses cannot overwrite newer state.** If the screen unmounts or its route subject changes while a mutation is outstanding, the late response does not update the replacement screen. This does not cancel or reinterpret the daemon mutation.

19. **Endpoint construction remains centralised.** `daemon-endpoints.ts` declares a named `/stop` segment and exports `runStopPath(handle)` beside `runGatePath(handle)`. The handle is percent-encoded as one path segment. No component assembles `/runs/:id/stop` itself.

20. **Daemon mutations remain centralised.** The functions that issue start and stop requests live in `daemon-client.ts`. Components provide domain values and render request state; they do not call `fetch` directly or duplicate daemon response parsing.

21. **The browser write-boundary register is deliberately widened.** `WRITE_RULES` continues to contain exactly six needles. `POST` remains permitted only in `daemon-client.ts`; `/gate` and `/stop` are permitted only in `daemon-endpoints.ts`; `PUT`, `PATCH`, and `DELETE` remain permitted nowhere.

22. **The write-boundary checks remain non-vacuous.** With exemptions honoured, `writeOffenders(true)` is empty. With exemptions ignored, the result names the actual `POST` occurrences in `daemon-client.ts` and the actual `/gate` and `/stop` literals in `daemon-endpoints.ts`. The permitted-file set remains exactly `daemon-client.ts` and `daemon-endpoints.ts`. The existing assertion labelled “stopping a run became permitted” is replaced with an assertion naming `daemon-endpoints.ts`; it is not deleted.

23. **Behaviour is covered at both boundaries.** Automated tests cover: multiple consuming flows without implicit selection; confirmation cancellation; one request after confirmation; start success and each response-error class; stop 204 without a body read; non-204 2xx rejection; refusal-code rendering; the finish-versus-stop race; and a refresh completing while a mutation remains outstanding.

24. **Existing regressions stay green.** The mock-adapter end-to-end suite, web tests, server tests, lint, and typecheck pass after dependencies are installed using the repository's documented commands.

25. **BYOS remains unchanged.** No source, test, fixture, example, or UI added by this ticket accepts or asks for an API key. Starting a run continues to use the adapter CLI's existing subscription login and existing preflight checks.

26. **Worktree safety remains enforced by core.** The browser supplies no worktree path and gains no mechanism to weaken containment. A non-dry run started in the browser uses the same core worktree and integration-branch rules as a run started by the CLI.

27. **Human gates remain the default.** Browser-started runs send neither `auto: true` nor another gate-bypass setting. `human-locked` gate behaviour is unchanged.

28. **Files remain the database.** The browser adds no persistence API, cookie, browser cache, or hidden daemon store for selected flows, pending mutations, or results. Run history continues to be persisted only through the existing `.quorum/` contract.

29. **No file-format or adapter-contract change.** This ticket changes no schema in `backlog/` or `harness/`, no event union, and no adapter interface. The existing `POST /runs` and `POST /runs/:id/stop` server contracts remain authoritative.

30. **Cold-clone path is not lengthened.** Both supported installation paths continue to expose the feature through `quorum open`; no extra installation step, service, subscription setup, or public-registry claim is introduced.

31. **Architecture documentation records the wider write boundary.** The `apps/web` section of `docs/04-architecture.md` is updated from one browser write act to the three permitted route acts: starting a run, answering a gate, and stopping a run. The text continues to name the two modules that own request issuance and endpoint construction.

32. **The boundary classification is decided durably.** Before implementation is accepted, a new append-only decision entry states whether browser writes are one lifecycle/gate boundary with per-route permissions or a family of separately governed boundaries, names the alternative considered, and updates `docs/DECISIONS.md` with the current index date.

## Non-goals

- Starting a run without the human explicitly selecting a flow.
- A generic “run next flow” action.
- Starting a flow that does not consume the ticket's current stage.
- Browser controls for `--dry`, `--auto`, or `--base`.
- Collecting or editing a stop reason.
- Changing the `POST /runs` or `POST /runs/:id/stop` daemon contracts.
- Adding a stop operation to the gate-answer vocabulary.
- Stopping individual steps, agents, or adapter processes independently of their run.
- Restarting, retrying, cloning, scheduling, or queueing a run.
- Starting multiple tickets or flows in one action.
- Persisting a selected flow or remembering it as a default.
- Making CLI-started runs visible in the daemon process.
- Remote daemon access, multi-user coordination, cloud sync, desktop notifications, or a desktop shell.
- Changes to flow YAML, ticket frontmatter, the event union, adapter contracts, run locks, worktree layout, or integration-branch naming.
- API-key, token, or other non-subscription authentication paths.

## Open questions

1. **Blocker — what can the start confirmation name? Owner: product manager.** The ticket body says both start and stop confirmations name the handle, but the daemon mints a start handle only after `POST /runs` is accepted. AC-5 therefore specifies ticket id plus flow for start and reserves the handle requirement for stop. Product must confirm this correction before the requirements gate closes; satisfying the original wording would require a new reservation protocol and a daemon contract change.

2. **Blocker — how is the browser write boundary classified? Owner: architect.** Is the browser governed by one enumerated write boundary with route-specific permissions, or by separate start, gate-answer, and stop boundaries? The answer changes the durable architecture wording and the shape of the source guard, so it must be recorded in the decision required by AC-32 before implementation.

3. **Placement — where should stop appear when a running row and its run screen are both visible? Owner: product manager.** AC-9 requires the action on an existing run or mission-control surface but does not require duplicate controls. Choose one canonical placement before implementation so QA has a single expected surface. Recommended: the run screen, where the handle and current state are already the subject.

## Risks

- A start action attached to a stage rather than a specific flow could silently choose between `chore` and `solutioning`, changing the amount and kind of work performed.
- Clearing mutation state from a GET completion can re-enable controls while a POST remains unresolved, allowing duplicate starts or stops and a late response that overwrites the first outcome.
- Treating every 2xx as success can report a mutation the browser and daemon do not agree occurred.
- Classifying refusals by status can collapse distinct conditions, especially races where the run finished before stop was processed.
- Adding broad write exemptions can make the board, ticket page, or unrelated components writable without detection. The anti-vacuity assertions are part of the boundary, not test cleanup.
- A stop action that reuses gate words can teach maintainers that cancellation is a gate answer and obscure the run-level `AbortSignal` behaviour.
- Exposing `auto` as a convenient checkbox would weaken human-gated-by-default behaviour and could make a browser-started run proceed without the human intervention the maintainer expects.
- A successful start followed by failed navigation can leave a real run active while the board still appears unchanged. The returned handle must remain visible or reachable in the rendered outcome.
