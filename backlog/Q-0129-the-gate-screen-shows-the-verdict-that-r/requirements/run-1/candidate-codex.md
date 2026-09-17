# Q-0129 — The gate screen shows the verdict that reached it, and the diff

## Problem

The gate screen tells a maintainer what question a run is waiting on, but not the evidence needed to answer it. When a step with a declared verdict reaches a gate, the screen omits the verdict, findings, summary, and the diff reviewed by that step. The maintainer must inspect terminal output, hidden engine artifacts, or git manually before choosing an answer.

None of the existing channels can be treated as the missing contract:

- Verdict and finding text in `warn` and `done` events is conditionally composed prose. Parsing it would infer structure from sentences and cannot reliably associate a warning with a step.
- Verdict artifacts live under `.harness/` by default, or at a flow-author override. The ticket listing and file routes deliberately exclude hidden paths. Serving those artifacts through the backlog routes would change what that surface means and requires a decision entry.
- A run parked at a gate has no persisted run id. Selecting the newest history row for its ticket would infer identity rather than establish it.
- The diff range belongs to the flow step and is currently consumed inside the run. No daemon route carries that range or its materialised diff.

The current repository census, measured from files rather than copied from the ticket body on 2026-09-17, is:

- 306 verdict JSON files across 73 ticket folders under `.harness/`;
- 275 `gate=` lines in `backlog/*/runs.log`: 235 engine-recorded answers, 39 retry-grant lines, and one hand-written erratum line;
- 157 of the 235 engine-recorded answers are at `human` gates declared by flows. These gates do not themselves establish that a verdict exists, so absence must remain a first-class state.

Surfaces touched: local daemon, web UI gate screen, `packages/shared` event and wire contract, and `packages/core` flow execution and diff materialisation. The backlog file routes are explicitly not extended.

## User story

As a **solo maintainer**, I want a parked gate to show the structured verdict that reached it and the same diff evidence used to reach that verdict, so I can choose an existing gate answer without reconstructing the run from prose, hidden files, or branch commands.

## Acceptance criteria

1. **Decision prerequisite — documentation.** Before implementation begins, an append-only decision entry records that evidence for a pending gate crosses structurally with the gate question, and that hidden engine artifacts remain excluded from the backlog listing and file routes. The entry names and rejects: parsing event prose, exposing `.harness/` through a backlog route, and selecting a run-history row by recency. It also records that reusable diff materialisation belongs in `core`, not in the daemon or UI. The entry is indexed in `docs/DECISIONS.md` using the date on which it is added.

2. **Gate evidence contract — `packages/shared`.** The gate question event gains one optional, strictly validated evidence field. When present, it contains:
   - the id of the step whose declared verdict produced the evidence;
   - `verdict` as the exact returned string;
   - `summary` as the exact returned string;
   - `findings` as an ordered array of exact returned strings;
   - optional diff evidence as defined in AC-3.
   The field is absent, rather than `null` or an empty placeholder, when no declared verdict has reached that gate. Unknown fields are rejected under the existing event-union rule.

3. **Diff evidence contract — `packages/shared`.** When the verdict-producing step received an `input.diff`, its gate evidence includes:
   - the interpolated range actually materialised for that step;
   - the `git diff --stat` text used for that step;
   - the UTF-8 patch text actually supplied to that step;
   - full patch byte count;
   - supplied patch byte count;
   - configured byte limit;
   - whether truncation occurred;
   - the ordered paths that received no patch, with an empty list meaning every file received at least some patch.
   Diff evidence is absent when that step had no `input.diff`. A range alone is not presented as a diff.

4. **One source for diff materialisation — `packages/core`.** The existing diff implementation exposes a reusable structured result from the same operation that builds a step’s review input. Prompt rendering and gate evidence are projections of that one result; neither reruns `git diff`. Given the same repository state, range, and configuration, the patch bytes supplied to the reviewer and carried to the gate are byte-for-byte identical.

5. **Existing limit remains authoritative — `packages/core`.** Gate diff evidence uses `repo.max_diff_bytes`, including its existing 200,000-byte default, and the same UTF-8-safe truncation boundary as review input. This ticket does not introduce a second UI limit, raise the limit, page the diff, or change head-only selection. The existing `diff truncated range=` log token and warning remain intact. Any later change made by Q-0128 affects both reviewer input and gate evidence through the shared materialisation result.

6. **No diff-rendering dependency — web UI.** The gate screen renders the supplied patch as escaped preformatted text with its existing additions/deletions/context markers intact. It does not interpret patch content as HTML and adds no `diff2html`, `diff`, `jsdiff`, or equivalent dependency. The solution document includes the one-line justification: a native text rendering preserves exact evidence and avoids a dependency for presentation alone.

7. **Verdict propagation — `packages/core`.** After a step with `output.verdict` completes successfully, the engine retains that step’s validated verdict, summary, findings, and optional materialised diff as the latest gate evidence for that run. The next gate question emitted by that execution path carries that evidence. Values are taken from the validated agent output and structured diff result, never from the verdict JSON file or an event message.

8. **Failed-verdict gate — `packages/core`.** When a non-passing declared verdict spends its backward-edge bound and causes an engine-presented gate, that gate carries the failing verdict’s evidence, including an empty findings array when the agent returned no findings. A findings-less verdict must not depend on an em dash, separator, or any other prose marker.

9. **Later author gate — `packages/core`.** When a passing declared verdict is followed by non-verdict steps and then an author-declared gate, the gate carries the latest declared verdict evidence that was reached on that execution path. Non-verdict script, integrate, fan-out, or gate steps do not erase it. A later declared verdict replaces the earlier evidence as one complete value; fields from two verdicts are never combined.

10. **No stale evidence after a backward edge — `packages/core`.** Re-entering a step through a backward edge cannot show evidence from an earlier traversal as though it were current. When the re-entered path produces a new declared verdict, that complete result replaces the prior one. If execution stops before producing a new verdict, no newly asked gate may attribute the earlier verdict to the unfinished traversal.

11. **Parallel execution is unambiguous — `packages/core`.** A gate receives evidence only when the engine can identify one declared verdict as the result that routed execution to that gate. Parallel members that produce no routing verdict do not create gate evidence, and the engine does not choose among parallel results by completion order.

12. **Verdict card — web UI.** For a parked gate whose question carries evidence, the screen shows a labelled verdict card before the answer controls. It displays the step id, verdict, and summary verbatim. Findings appear in their supplied order as a list. An empty findings array renders an explicit “No findings” state and not an empty region.

13. **Diff region — web UI.** When evidence contains a diff, the verdict card includes a labelled diff region showing the range, stat, and patch. Patch text is selectable, horizontally scrollable, and preserves whitespace. Patch content containing HTML or script-like text is rendered as text and cannot create DOM elements or execute code.

14. **Truncation disclosure — web UI.** A truncated diff displays, before the patch, the supplied and full byte counts, configured limit, and either:
   - the paths that received no patch; or
   - a statement that every file received some patch and the final file was cut short.
   A non-truncated diff displays no truncation warning. The screen never describes a truncated patch as the complete change.

15. **No invented evidence — web UI.** When a gate question has no evidence field, the screen remains correct in all existing `parked`, `no-gate`, `ended`, and `refused` states. It renders no verdict label, findings placeholder, summary placeholder, diff placeholder, loading skeleton, or assertion that no verdict exists. The gate question and answer controls retain their current behaviour.

16. **Answer set and priority are unchanged — web UI and daemon.** The accepted answers remain exactly `advance`, `retry`, and `abort`. `retry` is shown only when the gate question carries a retry target. `Advance` remains the first action in schema order; this ticket does not make `retry` primary and does not add a reason field or override action.

17. **Existing run identity remains unchanged — daemon.** A parked run may still have `runId: null`. Rendering its evidence requires neither a history lookup nor deriving a run number from `gateId`. The daemon continues to identify the live run by its existing opaque handle.

18. **Hidden artifacts remain hidden — daemon and backlog.** `GET /tickets/:id` continues to omit every path whose first segment starts with `.`. `GET /tickets/:id/file` continues to refuse files omitted by that listing. No new backlog route, query option, or exception exposes `.harness/`, including a flow-author-overridden verdict file placed there.

19. **Late reader and refresh behaviour — daemon and web UI.** `GET /runs/:id` returns the complete pending gate question, including its evidence, to a browser opened after the gate was asked. Refreshing the gate screen returns the same evidence while that gate remains pending. Once the gate is answered or released, the existing run state governs the screen and stale evidence is not rendered as a pending decision.

20. **Wire compatibility tests — `packages/shared` and daemon.** Tests prove that:
   - a gate question without evidence still parses;
   - a complete verdict with and without diff parses;
   - unknown evidence keys, negative byte counts, supplied bytes greater than full bytes, and contradictory truncation metadata are rejected;
   - daemon run responses reuse the event union’s gate-question schema rather than declaring a second evidence shape.

21. **Engine regression tests — `packages/core`.** Tests cover at least: a passing verdict followed by an author gate; a failing verdict with findings at an exhaustion gate; a failing verdict with no findings; a gate with no preceding verdict; replacement after a backward edge; a diff below the limit; a diff truncated within a file; and a diff that omits complete file patches. Assertions compare structured values and exact patch bytes, not formatted log messages.

22. **Web regression tests — web UI.** DOM tests cover evidence present, evidence absent, empty findings, non-empty findings, diff present, diff absent, both truncation disclosures, malicious patch text, and all existing gate subjects. A source-level regression test rejects parsing `warn` or `done` messages for `verdict=`, em dashes, findings, step identity, or diff ranges.

23. **Cross-cutting quality checks.** The change:
   - adds no subscription-secret path, example, fixture, or documentation;
   - does not change worktree creation, branch layout, integration, or working-tree safety;
   - does not change gate defaults or `human-locked` behaviour;
   - persists no new daemon-only state and treats the event held by the live run as transient run state, not a new database;
   - adds no vendor-specific field or branch outside an adapter;
   - adds no first-run setup step and does not lengthen either supported cold-clone installation path;
   - keeps the mock-adapter end-to-end suite green.

24. **Verification commands.** After installing dependencies with `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck` pass. Test reporting distinguishes an unrun command from a passing command.

## Non-goals

- Adding, removing, renaming, or reordering the three gate answers.
- Adding an answer reason, override control, or a fourth answer.
- Making `retry` the primary action or offering it at a gate without a retry target.
- Showing a verdict, summary, findings, or diff where the engine did not supply structured evidence.
- Exposing `.harness/` or any other hidden ticket path through backlog routes.
- Reading a verdict artifact from its default path or a flow-author override.
- Parsing human-readable event messages, `runs.log`, or run-history rows for evidence.
- Assigning a persisted run id before the terminal event.
- Changing `repo.max_diff_bytes`, the default limit, truncation selection, or the Q-0128 policy for whether an incomplete review may approve.
- Paging, relevance-ranking, syntax-highlighting, side-by-side rendering, file collapsing, or commenting on a diff.
- Adding a diff-rendering library.
- Persisting a second copy of gate evidence outside the files and events already owned by the run.
- Changing flow files, verdict vocabularies, backward-edge bounds, or adapter contracts.
- Starting, stopping, or rerunning a run from the gate screen beyond sending the existing gate answer.
- Multi-user coordination, remote daemon access, cloud sync, a desktop shell, or a visual flow canvas.

## Open questions

1. **Blocker — maintainer:** Will the maintainer approve and land the decision described in AC-1 before implementation? The recommended answer is yes: carry evidence structurally on the gate question and keep hidden artifacts outside the backlog surface. Without that entry, implementation must stop because the change defines a new relationship between `core`, the event contract, the daemon, and the gate screen.

2. **Non-blocking — Q-0128 owner:** Should a truncated review be allowed to produce a passing verdict? Q-0129 does not answer this. It exposes the exact bounded evidence and its incompleteness; Q-0128 owns any change to review eligibility or diff selection.

## Risks

- **Large live events.** A gate question may grow by up to the configured diff limit plus stat and metadata. The default is 200,000 patch bytes, but projects may configure a larger value. Tests must prove late-reader delivery and run snapshots remain correct at and just above the default limit; changing configuration bounds is outside this ticket.
- **Stale attribution.** A run can traverse backward edges and produce several verdicts. Treating evidence as independent mutable fields could combine a new verdict with an old diff. AC-9 and AC-10 require replacement as one complete value.
- **Parallel ambiguity.** Completion order is not semantic order. Evidence must follow the verdict that routes execution, not whichever parallel member returns last.
- **False completeness.** Reusing only patch text without truncation metadata would make the screen look more authoritative than the reviewer’s actual evidence. The structured result and mandatory disclosure prevent that.
- **Contract fan-out.** Widening the event union affects `packages/shared`, `core`, daemon snapshots, WebSocket replay, and exhaustive consumers. Compile-time exhaustiveness and wire tests must identify every consumer.
- **Unsafe rendering.** A diff is repository-controlled text and may contain HTML or script-like content. Rendering it as escaped text is required; inserting generated HTML is not permitted.
- **Decision drift.** Adding an artifact route later could silently create a second authority for the same evidence. The decision entry and AC-18 make that an explicit future reversal rather than an incidental implementation choice.
