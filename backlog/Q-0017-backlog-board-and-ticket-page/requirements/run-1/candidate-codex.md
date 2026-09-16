# Q-0017 — Backlog board and ticket page

## Problem

The Studio routes `/backlog` and `/backlog/:ticketId` exist, but both still render placeholders. A solo maintainer cannot inspect the backlog or open a ticket without returning to the filesystem or CLI.

The board can use `GET /tickets`, but its current wire representation lacks iteration counters and per-vendor usage. The ticket page has no endpoint capable of reading the ticket folder. Rendering an empty page when a ticket or artifact cannot be read would conceal damage in the files that are the product’s database.

This ticket is one vertical change rather than a board-only split. It adds the read-only daemon contract needed by the ticket page because the confined folder-reading primitive already exists in `core`; it does not introduce ticket mutation or new persistence.

Surfaces touched: the local daemon, the Studio, and the existing files under `backlog/` and `.quorum/runs/` as read-only sources.

## User story

As a **solo maintainer**, I want to see tickets grouped by stage and open the files belonging to a ticket, so that I can understand backlog state and inspect its artifacts without leaving the Studio.

As a **cold-clone adopter**, I want missing or damaged ticket data to produce a clear error rather than an apparently valid empty ticket, so that I can trust that the Studio represents the repository’s files honestly.

## Acceptance criteria

1. **Board route.** Opening `/backlog` replaces the Q-0017 placeholder with a backlog board. It uses daemon responses as its source and does not contain fixture or fallback tickets.

2. **Stage columns.** The board renders one column for each stage, in this order: `draft`, `requirements`, `solutioned`, `red`, `green`, `reviewed`, `qa-passed`, `deployed`. Every ticket returned by `GET /tickets` appears exactly once in the column matching its stage. Empty stages remain visible with an explicit empty state.

3. **Unknown stage handling.** A ticket whose returned stage is not one of the defined stages is not placed into a valid stage column. The board shows an explicit error naming the ticket and the unrecognised stage; it does not default the ticket to `draft` or omit it silently.

4. **Card identity.** Each ticket card displays its real `id`, `title`, and `owner`. A missing or empty optional display value is shown as “Not set”; no sample value is substituted.

5. **Iteration wire data.** `WireTicket` and each item returned by `GET /tickets` gain an `iterations` object copied from the ticket frontmatter. Keys are preserved as written, values must be non-negative integers, and an absent `iterations` field is represented as an empty object. The daemon does not invent a fixed set of counters.

6. **Iteration display.** A card with iteration counters displays every counter in deterministic key order as `<counter> <value>`. A card with no counters displays no iteration badge. This ticket does not infer a maximum such as `1/3`, because the ticket record does not contain that maximum.

7. **Per-vendor usage contract.** Each item returned by `GET /tickets` gains `usageByVendor`, derived on that request from readable run manifests in `.quorum/runs/` whose `ticket_id` exactly equals the ticket id. It is not stored in `ticket.md`, cached by the daemon, or written to another file.

8. **Usage fields and aggregation.** Each `usageByVendor` entry contains the vendor name, total input tokens, total output tokens, total reported USD cost, and the number of unpriced occurrences. Aggregation reuses the run-history usage semantics: reported zero remains zero, absent measures remain unknown rather than becoming zero, and cached-token fields are not added to input-plus-output token totals.

9. **No blended cost.** Usage is displayed separately for each vendor. Reported USD values may be summed only within one vendor. An entry with unpriced occurrences states that fact and shows available token totals; it must not present those occurrences as costing `$0` or estimate a price.

10. **Damaged history does not fabricate usage.** If run-history reading returns warnings or a manifest relevant to a ticket cannot be interpreted safely, the card marks usage as incomplete and makes the warning available in the board UI. Valid usage may still be displayed, but it must not be labelled as a complete cost-to-date figure.

11. **Containment remains derived.** Existing containment and push-lag behaviour is unchanged: both are derived per request, never persisted, and an indeterminate or absent answer is not rendered as a positive or negative git conclusion.

12. **Card navigation.** Selecting a ticket card navigates within the Studio to `/backlog/<encoded-ticket-id>`. Keyboard users can reach and activate the same navigation. The card does not create nested competing click targets.

13. **No launch control in this ticket.** The board does not render an enabled “Run next flow” control. The existing data permits more than one flow to consume a stage, including `requirements`, but the brief does not define how the maintainer chooses between them. A disabled control is also omitted because it would imply that launch behaviour is implemented.

14. **Ticket-detail route.** The daemon exposes `GET /tickets/:id`. The `:id` is treated as a ticket token and resolved by `core` within the configured backlog root. URL decoding, traversal syntax, absolute paths, separators, or similarly shaped input cannot read outside one ticket folder.

15. **Ticket-detail success response.** For a valid readable ticket, `GET /tickets/:id` returns:

    - the ticket metadata used by the board, including `iterations` and `usageByVendor`;
    - a lexically sorted list of readable text artifacts, each with its ticket-relative path and complete text content;
    - `runs.log` when that file exists; and
    - warnings produced while deriving run-history usage.

    The response does not contain absolute filesystem paths.

16. **Artifact boundary.** The detail endpoint reads only `ticket.md`, `runs.log`, and regular files below `requirements/`, `solution/`, `qa/`, `dev/`, and `review/`. It does not follow symbolic links, return directories, expose files elsewhere in the backlog, or read repository files outside the ticket folder.

17. **Missing optional content.** A valid ticket may have none of the optional artifact directories or no `runs.log`. The endpoint returns an empty artifact list or omits the absent log according to its declared wire schema; absence is not an error and is not filled with example content.

18. **No such ticket.** If no ticket folder matches the requested id, `GET /tickets/:id` returns HTTP 404 with the standard structured refusal body and a stable `no-such-ticket` code. The Studio displays a “Ticket not found” state containing the requested id and a link back to `/backlog`.

19. **Malformed ticket.** Before returning a success response, the endpoint verifies that `ticket.md` produced at least a non-empty string `id`, `title`, `stage`, and `owner`, and that its id equals the requested ticket. Failure returns HTTP 422 with a stable `malformed-ticket` code and a message identifying `ticket.md`. This endpoint-level check surfaces Q-0060 without changing the shared frontmatter parser or manufacturing missing fields.

20. **Unreadable ticket content.** If the ticket folder, `ticket.md`, or any in-scope artifact selected for the response cannot be read, the endpoint returns HTTP 422 with a stable `unreadable-ticket` code and identifies the ticket-relative file where one is known. It returns no partial ticket payload and does not treat the unreadable file as absent.

21. **Ticket page.** Opening `/backlog/:ticketId` replaces the placeholder with a ticket page backed by `GET /tickets/:id`. Its heading displays the returned ticket id and title. It does not trust route text as ticket metadata.

22. **Tabs.** The page provides tabs named `Requirements`, `Solution`, `QA`, `Dev`, and `Review`. Each tab contains the files below its corresponding artifact directory and lists files in lexical path order. A tab with no files displays “No artifacts yet.”

23. **Nested and repeated artifacts.** Tabs preserve each file’s full path relative to its artifact directory, so run and iteration directories remain distinguishable. Files with the same basename in different directories are separate selectable items and never overwrite one another in client state.

24. **Artifact rendering.** Selecting an artifact displays its complete text with its relative path. Markdown may be rendered as formatted content or as plain preformatted text, but repository content is treated as untrusted: embedded HTML, scripts, event handlers, and executable links cannot run in the Studio.

25. **Run log panel.** When `runs.log` exists, the ticket page renders its complete text in a panel beside the tabs at desktop widths and in normal document order at narrow widths. When it is absent, the panel says “No runs recorded.” This ticket does not parse log entries into run-history links or claim that the log is a complete run-history index.

26. **Loading and request failure.** Both screens show a visible loading state while their required request is pending. A network failure, non-2xx response, or response that fails the client’s wire validation replaces the loading state with an explicit error and a retry action. Existing cards or files from another route are not retained as if they belonged to the failed request.

27. **Refresh from files.** Retrying or revisiting either route performs a new request. The Studio does not persist a second copy of tickets, artifacts, iterations, or usage in browser storage.

28. **Responsive and accessible use.** At narrow widths, stage columns remain individually reachable through horizontal scrolling without clipping card content. Tabs use tab semantics and keyboard navigation, the active tab is programmatically exposed, loading and error messages are announced, and all text and controls meet the existing theme’s contrast and focus conventions.

29. **Read-only boundary.** All routes and controls added by this ticket are read-only. They do not edit a ticket, move its stage, answer a gate, invoke a flow, create a run, or write to the working tree, backlog, harness, or run history.

30. **Design brief correction.** In the same change, `docs/05-design-prompt.md` is corrected so the product description, gate screen, and interaction list no longer promise an override or an “Advance anyway” reason field. The brief names only behaviour supported by the existing gate contract: `advance`, `retry`, and `abort`. No gate behaviour is implemented by Q-0017.

31. **Behaviour tests.** Automated tests cover, at minimum: stage ordering; one-card-per-ticket placement; unknown stages; iteration transport and display; per-vendor priced and unpriced aggregation; incomplete history warnings; card navigation; successful detail reading; absent optional directories; nested duplicate basenames; traversal and symlink refusal; 404, malformed-ticket, and unreadable-ticket responses; safe artifact rendering; loading, failure, retry, and narrow-layout behaviour.

32. **Regression checks.** After dependencies are installed with `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, `pnpm typecheck`, and `pnpm turbo run build` pass. The mock-adapter end-to-end regression suite remains green.

33. **Cross-cutting constraints.** The implementation adds no subscription-secret path; invokes no adapter; creates no worktree; changes no gate default or `human-locked` behaviour; changes no flow, ticket, run-manifest, or adapter schema on disk; adds no product-specific SaaS knowledge; and adds no step to the cold-clone installation path.

## Non-goals

- Splitting the board and ticket page into separately deliverable tickets.
- Creating, editing, deleting, or reordering tickets or ticket artifacts.
- Dragging cards between stages or changing ticket ownership.
- Starting a flow or choosing among multiple flows that consume the same stage.
- Displaying an inferred iteration maximum such as `1/3`.
- Fixing Q-0060’s shared frontmatter parser; this ticket only refuses malformed data at its HTTP boundary.
- Mission control, live traces, or stop controls (Q-0015).
- Gate diffs or gate-answer controls (Q-0016).
- Run-history drill-down or parsed `runs.log` navigation (Q-0018).
- Resuming a run (Q-0019).
- Implementing an override or reason field for a gate.
- Editing harness files, changing flows, or adding hidden daemon or browser persistence.
- Remote-daemon support, cloud sync, multi-user behaviour, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Which flow should “Run next flow” launch when several runnable flows consume the same stage?** Owner: product manager for the first ticket that adds flow launch from the board. This is not a blocker for Q-0017 because AC-13 excludes the control.

2. **Should iteration maximums become persisted ticket data or be derived from a selected flow’s backward edges?** Owner: product manager with a core maintainer. This would change either a file format or the meaning of a card label, so Q-0017 shows only recorded counts.

3. **Should a later ticket page render Markdown with a dedicated parser and sanitiser?** Owner: Studio maintainer. Q-0017 may use escaped preformatted text, so this does not block safe artifact inspection and does not justify a new dependency here.

## Risks

- Aggregating all run manifests for every board request may become slow as run history grows. Correctness and file-backed freshness take precedence in this ticket; caching would contradict the current persistence rules and requires a separate decision.
- A damaged run manifest may make cost-to-date incomplete. The UI must retain the distinction between complete, incomplete, and unpriced usage instead of compressing all three into one number.
- Artifact content is repository-controlled and may be hostile. Rendering Markdown without strict sanitisation could create a script or unsafe-link surface; escaped text is the safe baseline.
- Ticket ids and artifact paths cross an HTTP boundary for the first time. Route-token resolution and symlink handling must remain in `core` so confinement is not dependent on UI validation.
- Returning every artifact in one response may produce a large payload for unusually large ticket folders. Pagination or per-file fetching is deferred until measured; truncating files silently is not permitted.
