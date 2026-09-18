# Q-0018 — Run history lists recorded runs

## Problem

The local daemon already exposes `GET /history`, and the web app already reserves `/history`, but the route has no shared wire contract, no browser consumer, and no screen. A maintainer therefore cannot inspect recorded runs from the web UI.

The existing listing omits the timing and per-vendor usage data required by the history table. Fetching every run’s detail would turn one page load into one listing request plus one request per run; the measured repository would require 171 requests. Widening the listing produces a measured response of 62,679 bytes for 170 runs, or about 369 bytes per row, so the listing will carry the table data directly and will have no pagination or cap in this ticket.

The planned occurrence drill-down is a separate change. It requires a new route that serves retained files from `.quorum/runs`, a confinement contract, and a product ruling that does not yet exist. Combining it with the listing would leave this ticket blocked and repeat the milestone’s demonstrated failure pattern for oversized tickets.

Surfaces touched: local daemon and web UI. No CLI, `harness/`, backlog file format, flow, gate, or adapter behavior changes.

## User story

As a **solo maintainer**, I want the History screen to list every run recorded in `.quorum/runs`, including incomplete runs and per-vendor usage, so that I can compare past activity and recognize a run that is still being written without reading manifests directly.

As a **cold-clone adopter**, I want an explicit empty History screen before I have run anything, so that a fresh project does not look broken or remain on a spinner.

## Acceptance criteria

1. **Shared listing contract.** `packages/shared` exports a named wire contract for the successful response from `GET /history`. Each row declares `id`, `ticket`, `flow`, `status`, `incomplete`, `started_at`, `ended_at`, `duration_ms`, occurrence count, and the complete per-vendor roll-up already represented by the shared run-history detail contract. Nullable or optional fields preserve the distinctions present in the manifest; the server does not manufacture a time, duration, price, or usage value when one is absent.

2. **Route uses the contract.** The daemon’s `GET /history` implementation returns the shared listing contract rather than an untyped inline response shape. Existing row fields and existing ordering remain backward compatible. The inaccurate `WireRunHistory` documentation claim that no unshaped transport route remains is corrected only as needed to state the truth after this change; `GET /project` is not otherwise changed.

3. **Projection from files.** Every listing row is a projection of the corresponding run manifest under `.quorum/runs`. Producing the response does not modify, repair, finish, delete, or otherwise tidy a manifest or retained file, including a manifest whose run is still in progress.

4. **No per-row detail reads.** The browser obtains the table with one call to `GET /history`. Rendering the initial table does not call `GET /history/:id` or issue another daemon request for each row.

5. **No listing cap.** `GET /history` continues to return all readable runs and introduces no pagination, truncation, or fixed row limit. Tests cover more rows than are visible in the table viewport so that visual containment is not mistaken for server truncation.

6. **History route is active.** Navigating directly to `/history` and selecting **History** in the rail render the History screen. The route and rail registration mark the screen as available while preserving the existing shell and connection behavior.

7. **Table contents.** For each returned row, the screen renders the run id, ticket id, flow, vendor names, status, start time, duration, per-vendor cost, per-vendor usage counts, and occurrence count. Vendor names are rendered from data and do not branch on a fixed set of vendor strings.

8. **Per-vendor accounting.** Cost and usage remain separated by vendor. The screen does not calculate or display a cross-vendor total. A missing vendor price renders `n/a`, using the existing cost-formatting rule, and is not displayed as zero. A real numeric zero remains distinguishable from a missing price.

9. **Status coverage.** The screen has a defined rendering for every member of the shared `RunStatus` type, including `completed`, `failed`, `regressed`, `aborted`, `interrupted`, `undecided`, and `exhausted`. Tests include statuses not present in the repository’s current run corpus.

10. **Incomplete runs.** A row with `incomplete: true` remains in the table and has an explicit **Incomplete** indication in addition to its recorded status. It is not relabeled as completed, omitted, or linked to mission control. A test uses an incomplete manifest created by the test itself rather than depending on the developer’s gitignored `.quorum/` contents.

11. **Empty state.** When `GET /history` succeeds with zero rows, `/history` renders a stable empty state explaining that no runs have been recorded yet. It renders neither a blank panel nor a persistent loading indicator.

12. **Request states.** While the listing request is pending, the screen uses the web app’s existing loading vocabulary. If the daemon is unavailable or returns an invalid or unsuccessful response, the screen uses the existing unavailable or error vocabulary and provides the existing retry action where that vocabulary defines one. An error response is not presented as an empty history.

13. **Layout containment.** The table remains usable within the established application shell with long run ids, ticket ids, flow names, vendor names, and large numeric values. Content does not force the rail or page outside its existing containment; horizontal scrolling may be confined to the table region.

14. **Behavior tests.** Automated tests cover the shared shape, server projection, absence of per-row detail requests, all status renderings, incomplete-run rendering, unknown vendor names, missing versus zero price, empty history, loading, successful data, and failed requests. Existing daemon, web, lint, type-check, and mock-adapter end-to-end suites remain green.

15. **Recorded design divergence.** The documentation that asks history to reuse mission control’s completed trace is updated in the same change to state that Q-0018 delivers the run listing and that the occurrence drill-down is a follow-on. The explanation records that events are not persisted and live run handles do not identify run-history directories across daemon restarts. This is a documentation correction, not a change to event persistence.

16. **Cross-cutting constraints.** The change adds no subscription-secret input path; does not alter adapter checks; does not run a flow or write to the user’s working tree; does not change gate behavior, the cross-vendor rule, a file format, or a manifest schema; introduces no daemon-held persistent state; remains vendor-neutral; and adds no installation step to either supported local installation path.

## Non-goals

1. The occurrence drill-down, occurrence file listing, and display of retained `prompt.txt` or `output.txt` are not part of Q-0018. They require a follow-on ticket and the ruling identified below.
2. Mission control is not changed or reused. It remains the live surface driven by accepted events from the current daemon process.
3. No event is persisted, reconstructed, or added to a manifest.
4. No new route serves an individual file from `.quorum/`.
5. `GET /history/:id` is not redesigned, and the History table does not fetch it per row.
6. No cap, pagination control, virtualization requirement, search, filtering, sorting control, deletion, repair, export, or retention policy is introduced.
7. Q-0076’s run-history size cap is not implemented.
8. `GET /project` does not receive a shared shape in this ticket.
9. An incomplete history row is not correlated with or linked to a live run handle; the two identifiers do not provide a durable join.
10. No manifest or retained-file schema changes, migrations, or backfills are made.
11. No CLI, flow, gate, adapter, backlog, or `harness/` behavior is changed.

## Open questions

1. **Blocking for the follow-on drill-down; not blocking for Q-0018 — Product owner and architecture owner:** May the daemon expose an on-demand file-reading route for retained files below `.quorum/runs`? Before that follow-on enters implementation, the decision must be recorded in `docs/DECISIONS.md` if it establishes a new architectural or security boundary.
2. **Blocking for the follow-on drill-down; not blocking for Q-0018 — Product owner:** Should a missing `prompt.txt` be described as “No prompt retained” and an empty retained file as “Retained file is empty,” or should the UI use different exact wording? These states must remain distinguishable from loading and read failure.
3. **Blocking for the follow-on drill-down; not blocking for Q-0018 — Engineering owner:** What exact shared response and error contracts will list and read retained occurrence files? The design must derive membership during the read request, enforce confinement in core, use fatal whole-file UTF-8 decoding, distinguish an unlisted path from a listed file that is no longer readable, and fetch only the selected file on demand.
4. **Ticket administration — Product owner:** What id and milestone placement will be assigned to the occurrence drill-down follow-on? Q-0018 should not return to implementation scope merely because the original plan line used “trace drill-down.”

## Risks

1. **Plan-language drift.** The milestone calls the second half a trace, but a finished run has no persisted event stream. If the follow-on copies that wording without the recorded divergence, it may specify a screen with no source data.
2. **Accidental N+1 requests.** Reusing the existing detail client per row would work on small fixtures while causing 171 requests for the measured 170-run corpus. AC-4 and its request-count test guard this boundary.
3. **Corpus-shaped rendering.** Current data contains only two vendor names and omits two valid statuses. Tests must use synthetic unknown vendors and every shared status so the UI does not encode the local corpus as a product contract.
4. **Misleading accounting.** Nearly half of measured vendor roll-ups have no price. Treating missing price as zero or summing priced and unpriced vendors would present a false total.
5. **Incomplete-file races.** A run can appear in history while its manifest is still being written. The listing must report the reader’s existing result without mutating the run or pretending it is finished.
6. **Large unbounded history.** The measured response is small enough to return all 170 runs, but the route remains unbounded. Q-0076 remains the owner of future cap or retention behavior; this ticket must not imply that no limit will ever be needed.
7. **Fresh-project ambiguity.** Repository fixtures cannot prove the adopter experience because `.quorum/` is gitignored. The empty-state test must construct its own empty project state and must not depend on this checkout’s run history.
