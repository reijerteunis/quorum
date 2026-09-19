# Q-0138 — A running occurrence is present in the retained listing

## Problem

A maintainer can open run history while a run is active, but the occurrence currently running is ordinarily absent. `allocate()` adds the occurrence to the in-memory manifest with status `running` and creates its occurrence directory, but does not persist the manifest. The occurrence becomes visible only when another occurrence terminates or the run ends.

This makes serial and parallel flows behave differently. In a serial flow, the current occurrence remains absent until it terminates. In a parallel flow, it becomes visible only after a sibling terminates. Until then, the run-history screen cannot distinguish “this occurrence is running” from “no occurrence exists.”

A read of the repository’s 175 run manifests on 2026-09-19 found 952 occurrences. For 174 occurrences (18.3%), another occurrence terminated between their recorded start and end, which is the condition that could persist them while still running. The remaining 778 occurrences had no such sibling termination. At least one occurrence met that condition in 96 of 175 runs. This is derived from terminal manifests and measures possible coverage; it does not claim when a reader opened the screen.

The largest run, `Q-0015-4`, contains 55 occurrences and a 38,606-byte terminal manifest. Serialising successive prefixes of that final manifest totals 784,518 bytes. Persisting at allocation therefore adds 55 atomic replacements on that case and retains the existing whole-list cost. The elapsed write cost still requires a controlled measurement because filesystem and `fsync` cost cannot be inferred from byte counts.

The fix is to persist the manifest when an occurrence is allocated. A generic screen message such as “this run may contain unnamed occurrences” is rejected: neither existing history response can know that an unrecorded occurrence exists, and adding hidden daemon state would contradict files being the database. Discovering occurrence directories in the retained route is also rejected because the manifest, not directory discovery, defines occurrence membership.

Surfaces touched: `packages/core` and its tests. `packages/server`, `packages/shared`, and `apps/web` receive the corrected state through their existing contracts and require regression coverage but no production-shape change. The CLI, backlog files, and harness flow files are unchanged.

## User story

**Maintainer:** As a maintainer watching an active run in the run-history screen, I want its allocated occurrence to appear with status `running` before it finishes, so that absence does not conceal the step the flow is currently performing.

## Acceptance criteria

1. When `RunHistory.allocate()` succeeds, the occurrence is present in `.quorum/runs/<run id>/manifest.json` before `allocate()` returns. Its persisted fields equal the occurrence returned by `allocate()`, including `status: "running"`, `duration_ms: null`, and the allocated `occurrence_dir`.

2. Allocation continues to create the occurrence directory and add the occurrence to the manifest exactly once. Persisting the allocation must not allocate another sequence number, duplicate a manifest entry, create another occurrence directory, or change occurrence ordering.

3. The allocation-time manifest replacement uses the existing `replaceManifest()` path: a complete same-directory temporary file is written, flushed, closed, and renamed over `manifest.json`. No successful allocation-time path writes `manifest.json` in place.

4. An allocation-time manifest replacement failure follows the writer’s existing non-fatal replacement contract: the supplied `RunHistoryHost` receives a warning naming the manifest target and condition, and the run may continue. A later successful terminal or final replacement can persist the in-memory occurrence. The initial run-manifest write remains fatal as it is today.

5. In a serial-flow test with one allocated occurrence and no terminal occurrence, a fresh `readRun()` reads that occurrence from disk with status `running`. The test must read the file-backed state rather than assert only against `history.manifest` in memory.

6. In a parallel-flow test, allocating two occurrences persists both immediately. Terminating either occurrence must not be required to make its sibling visible, and must not duplicate or reorder either occurrence.

7. Through the daemon, after a mock adapter occurrence has been allocated and its prompt retained but before it terminates, `GET /history/:id` includes that occurrence with status `running`, and `GET /history/:id/retained` includes the same occurrence identified by the same `seq` and `step_id`. The test must not terminate a different occurrence to make this state observable.

8. On the run-history screen, the state in AC-7 renders Q-0137’s existing sentence, `No output, status running — this step has not finished`. No new placeholder, inferred occurrence, or alternative running-state copy is introduced.

9. Occurrence membership remains manifest-derived. `GET /history/:id/retained` does not scan for occurrence directories absent from `manifest.steps`, and `packages/server` does not compose or receive an occurrence filesystem path.

10. The manifest shape and its validation contract do not change. No field is added to `RunManifest`, `Occurrence`, any shared wire type, or any HTTP response. `readRun()` remains a cast rather than becoming a schema check.

11. Allocation does not recompute the roll-up. The allocation-time replacement persists the roll-up already held by the manifest; roll-up recomputation remains at terminal and finalisation boundaries because a running occurrence has no completed usage to add.

12. Before the implementation is accepted, its implementation report records a reproducible baseline-versus-change measurement using the same machine, filesystem, Node version, fixture, and measurement method for both arms. The fixture allocates and terminates 55 occurrences, matching the largest run currently retained. The report states, for each arm: number of manifest replacements, total bytes submitted to manifest writes, and elapsed p50 and p95 across at least 30 runs after at least five discarded warm-up runs. This measurement is evidence, not a timing-dependent automated test.

13. If the measurement in AC-12 shows either an allocation-to-finalisation p95 increase greater than 100 ms or greater than 10% compared with baseline, the change does not silently expand into a manifest optimisation. The implementation report records the result and a successor ticket is opened for the performance issue before Q-0138 closes. Q-0138 still fixes the visibility defect unless the measurement shows the 55-occurrence run cannot complete reliably.

14. Existing terminal and finalisation behaviour remains covered: terminal replacement persists the terminal status and recomputed roll-up; finalisation persists the run outcome; repeated `terminal()` remains idempotent; and a failed non-fatal replacement still emits a warning.

15. The mock-adapter end-to-end regression suite covers the observable state in AC-7. The required verification is run only after `pnpm install --frozen-lockfile`, using `pnpm turbo run test --force --continue`; `pnpm lint` and `pnpm typecheck` also pass.

16. Cross-cutting checks are recorded in the implementation report:

    - **BYOS:** no adapter login or subscription behaviour changes; no API-key path, fixture, or example is added.
    - **Worktree safety:** allocation writes only under `.quorum/runs/<run id>/`; no flow writes to the user’s working tree.
    - **Gate behaviour:** gates, answers, defaults, and human-locked behaviour are unchanged.
    - **Files are the database:** the running occurrence is made observable by persisting it to the existing manifest, not by daemon-only state.
    - **File format and schema:** unchanged, as required by AC-10.
    - **Cross-vendor rule and flow lint:** unchanged.
    - **Product-agnostic behaviour:** no adapter or SaaS-product name is introduced into the implementation.
    - **Cold-clone impact:** no installation step, command, dependency, or first-run interaction is added.

## Non-goals

- Reopening Q-0137’s retained-file routes, confinement rules, identity comparison, wire shapes, or screen interaction design.
- Discovering occurrences by scanning `steps/` or reconciling occurrence directories against the manifest.
- Adding a daemon-only count or signal for occurrences not yet present in the manifest.
- Changing the manifest shape, validating manifests during `readRun()`, or repairing hand-edited manifests.
- Optimising the existing whole-list serialisation, roll-up computation, atomic replacement sequence, or quadratic write cost.
- Adding caps, retention, eviction, compaction, or cleanup policy; Q-0076 and Q-0123 retain those subjects.
- Changing prompt or output persistence, including the existing terminal guarantee for `output.txt`.
- Changing run-history identity, sequence-number rules, run status, occurrence status, or duration semantics.
- Changing the CLI, harness flows, gates, adapter contract, subscription checks, backlog schema, or working-tree behaviour.
- Adding a dependency or a new decision entry unless implementation uncovers an architectural choice not specified here.

## Open questions

No blocking product question remains. The manifest is the existing durable membership register, and the measured parallel case covers only a minority of occurrences; persistence at allocation is therefore the required behaviour.

- **Should manifest persistence later become incremental or journaled?** Owner: maintainer. This is outside Q-0138. Open a successor only if AC-12 crosses its reporting threshold or later retained runs exceed the present 55-occurrence maximum.
- **Should a future live-run surface refresh retained files automatically?** Owner: product manager. Q-0138 changes when the existing read returns an occurrence, not when a browser chooses to issue that read.

## Risks

- Each occurrence adds one atomic manifest replacement, including `fsync`, increasing synchronous filesystem work on the run path. AC-12 makes the cost visible; AC-13 prevents an unmeasured optimisation from entering this ticket.
- The writer keeps an in-memory manifest authoritative when a non-fatal replacement fails. A reader can therefore remain temporarily behind the live run until a later replacement succeeds. This is existing failure semantics, retained explicitly rather than presented as guaranteed visibility under disk failure.
- A test that inspects only the in-memory manifest would pass before this fix and provide no regression protection. AC-5 requires a fresh file-backed read, and AC-7 requires the daemon boundary.
- Timing-based daemon tests can become flaky if they wait a fixed duration. The acceptance fixture must expose a deterministic barrier after allocation and before terminal completion, rather than infer the state from a sleep.
- Persisting before prompt retention can briefly expose a running adapter occurrence whose retained listing contains no prompt. That state is accurate: allocation precedes artifact persistence. Q-0137’s existing kind-based missing-prompt sentence remains the applicable presentation until a refresh observes the file.
