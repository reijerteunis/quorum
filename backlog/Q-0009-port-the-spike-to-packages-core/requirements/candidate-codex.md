# Q-0009 — Port the spike to `packages/core`

## Problem

The runnable Quorum implementation remains in `spike/`, while the strict TypeScript workspace created by Q-0008 is intentionally empty. The spike mixes reusable domain logic with CLI presentation logic, exposes a printing interface where the architecture requires an event stream, and uses a hand-rolled test runner rather than the workspace test infrastructure.

Moving this implementation as one change would exceed the repository's proven ticket-size limit and create overlapping work across shared files. The port is therefore divided across Q-0041 through Q-0054. Q-0009 ports no module itself. It defines the rules that apply to every child ticket, controls their dependency order, and performs the final cutover after the workspace implementation, CLI, and regression suite are ready.

Until that cutover, `spike/` is the authoritative runnable implementation and is also the harness used to deliver these tickets. A partial port must not weaken or modify it. Retiring it before the replacement CLI and regression suite are proven would remove the only working implementation and its regression protection.

Surfaces affected: CLI (`quorum`), `harness/`, repository CI, and the internal package interfaces used by the future Studio. The `backlog/` surface is affected only by the run-history and ticket APIs delivered by child tickets.

## User stories

- As a **maintainer**, I want the port divided into independently reviewable tickets with explicit dependency and cutover gates, so that I can move Quorum into the workspace without losing the known-good runnable implementation or its regression coverage.
- As a **cold-clone adopter**, I want the replacement `quorum` command to preserve the spike's supported behaviour and safety guarantees, so that the workspace migration does not add setup steps, request a subscription secret through another mechanism, or write to my working tree.
- As an **adapter contributor**, I want one vendor-neutral event and trace contract in `packages/shared`, with vendor-specific mapping confined to adapters, so that I can implement an adapter without depending on CLI presentation logic or another vendor's output format.

## Acceptance criteria

1. **Child scope and ownership are recorded.** Before implementation begins, Q-0041 through Q-0054 each exist as a separate ticket and collectively cover the modules and responsibilities listed in this ticket. Each child identifies the spike source and CLI-held domain logic it owns, its dependencies, its behaviour-preservation invariants, and explicit non-goals. No child assigns module-porting work back to Q-0009.

2. **The delivery route is decided before the first child run.** A repository decision made before Q-0041 through Q-0054 enter an implementation flow defines how a behaviour-preserving port uses the stage machine when the source regression tests already exist. The same route applies to all fourteen children unless a later append-only decision explicitly replaces it. If the chosen route requires an integration branch on the first pass, that branch is created before the run starts.

3. **Package ownership is decided before Q-0041.** A repository decision made before Q-0041 implementation states whether reusable Zod schemas, constants, and the canonical event and trace types live in `packages/shared`. The decision identifies the allowed dependency direction between `packages/core` and `packages/shared`; packages must not introduce a reverse or circular dependency.

4. **The spike remains authoritative before cutover.** From the first port commit until the Q-0009 cutover commit, `spike/src/**` is not edited to accommodate the workspace port, `spike/` is not deleted, and the CI job named `spike (regression suite)` remains required and green. A failure of that job blocks the affected child from landing. Changes independently required to repair the harness are handled outside Q-0009 and its children.

5. **Child tickets obey the dependency gates.** Q-0041 lands before any child that imports `packages/shared`. Q-0042 through Q-0048 may otherwise land in any order when their declared dependencies are green. Q-0049, Q-0050, Q-0051, Q-0052, Q-0053, and Q-0054 land in that order. Q-0054 cannot land until all module ports it exercises have landed. Concurrent runs for the same ticket are prohibited; verification must show at most one active run per ticket.

6. **Behaviour changes are explicitly bounded.** Child tickets preserve the externally observable spike behaviour covered by the ported regression tests. A child may change behaviour only when its acceptance criteria identify the change and an applicable repository decision authorizes it. The known interface exception is Q-0050: `runFlow(opts)` returns `AsyncIterable<Event>` instead of accepting a printing UI object. CLI rendering of those events belongs to Q-0010, not to core.

7. **Cross-cutting product constraints survive the port.** Before cutover, workspace tests demonstrate that core enforces worktrees under `.harness/worktrees/`, keeps flow writes out of the user's working tree, preserves human-gated defaults and non-overridable human-locked gates, persists product state only in repository files, rejects the three prohibited subscription-environment configurations before probing a vendor CLI, enforces the cross-vendor rule, and stops with preserved raw output when structured output is invalid. No vendor-specific event fields or branching logic exist outside the relevant adapter.

8. **Q-0054 proves regression equivalence in the workspace.** Q-0054 ports the applicable spike regression coverage to Vitest and documents any spike test that is removed, combined, or intentionally changed. The workspace suite covers the public behaviour of all ported modules, including CLI-held domain logic moved into core. Before cutover, CI runs both the authoritative spike regression job and the workspace type-check, lint, build, and Vitest checks successfully.

9. **Cutover is gated and atomic.** Q-0009 performs no cutover until Q-0010 and Q-0054 have landed and all required CI checks are green on their integrated result. The cutover change removes `spike/`, removes CI and repository tooling references that execute or import it, makes the workspace tests the required regression gate, and leaves the `quorum` binary backed by `packages/core`. A clean-clone verification must show that the documented CLI entry point runs without files or imports from `spike/`.

10. **The final workspace has reusable boundaries.** After cutover, reusable project loading, ticket and frontmatter handling, flow linting, contract validation, adapter control, fan-out handling, run history, and engine behaviour are exported from core or shared rather than implemented in the CLI. The CLI is limited to argument handling, invocation of core, event rendering, and process exit behaviour. The resulting CLI setup does not add a new step to the documented cold-clone path.

## Non-goals

- Q-0009 does not implement any module assigned to Q-0041 through Q-0054.
- Q-0009 does not implement the `quorum` binary assigned to Q-0010.
- Child tickets do not delete `spike/`, disable its CI job, or edit `spike/src/**` to simplify a port.
- The port does not redesign behaviour that is already covered by the spike tests, except for explicitly authorized interface changes such as the Q-0050 event stream.
- The port does not add features, new flow semantics, new stage transitions, or budget enforcement.
- Fixing the missing first-pass integration branch, unenforced run budget, non-interactive undecided gate, or absent per-ticket run lock is not part of this ticket, except that unresolved hazards may block starting or landing children as stated above.
- The ticket does not add a Gemini adapter, remote daemon, multi-user support, cloud sync, plugin marketplace, visual flow canvas, eval suite, or desktop shell.
- The ticket does not build the Studio or its WebSocket transport. It only establishes the core event interface that those surfaces may later consume.
- The ticket does not add hidden persistence or migrate file-backed state into a database.
- The ticket does not add or document any API-key-based execution path.
- The ticket does not promise exact internal source parity with the spike; code may be reorganized to meet the documented package boundaries while preserving required behaviour.

## Open questions

1. **Blocker — Which delivery flow applies to behaviour-preserving ports whose regression tests already exist?** Owner: maintainer. This must be resolved in `docs/DECISIONS.md` before the first child enters implementation. The decision must define the red-phase evidence, if any, and how first-pass integration branches are handled.

2. **Blocker — Do schemas, constants, and canonical event and trace types live in `packages/shared`?** Owner: architecture maintainer. Resolve before Q-0041. This changes package ownership and dependency direction, so the answer must be recorded in `docs/DECISIONS.md` and reconciled with `docs/04-architecture.md` and `docs/06-development-plan.md`.

3. **Blocker — What is the complete public `Event` contract returned by `runFlow()`?** Owner: Q-0050. Resolve before Q-0050 implementation and record contract-changing choices in `docs/DECISIONS.md`. At minimum, the decision must define event kinds, ordering, terminal events, error representation, adapter trace mapping, and whether events are persisted in run history.

4. **Blocker — Must Q-0039 and Q-0040 land before child implementation starts, or may the maintainer use documented manual controls?** Owner: maintainer. Q-0039 affects the requirement that one run owns a ticket; Q-0040 affects whether proven-green work can safely wait at an undecided gate. The chosen temporary control must be recorded before runs are queued.

5. **Blocker if the chore route is selected — Must Q-0038 land first, or will each child's integration branch be created manually?** Owner: maintainer. The answer must identify how the first run is prevented from failing during review.

6. **What evidence establishes regression equivalence when a spike test cannot be translated one-for-one to Vitest?** Owner: Q-0054. The answer must define the required mapping record and who accepts an intentional coverage change.

7. **Is event persistence part of the Q-0050/Q-0049 contract or deferred to M3?** Owner: architecture maintainer. If persisted, the file format and schema are blockers for Q-0049 and Q-0050; if deferred, events remain an in-process public interface only.

8. **When will actual delivery cost be reviewed against the $350–550 estimate?** Owner: maintainer. Proposed checkpoint: after the first three children land. This is not an implementation blocker, but the result may change the remaining ticket route or sequencing through a new decision.

## Cross-cutting checklist

- **BYOS:** Applies. The port must preserve refusal when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `CODEX_API_KEY` is set, before a CLI probe occurs. No new secret-based path is permitted.
- **Worktree safety:** Applies. Core must enforce `.harness/worktrees/` and prevent flow writes to the user's working tree.
- **Gate behaviour:** Applies. Human-gated remains the default; `auto` remains opt-in; human-locked gates cannot be overridden; exhausted loops end at a human gate.
- **File format and schema:** Applies. Tickets, flows, contracts, tasks, run manifests, occurrences, events if persisted, and raw invalid output remain file-backed and schema-validated. Schema ownership is an open blocker.
- **Lint rules:** Applies. Whole-directory validation and the cross-vendor rule move into core and retain their covered behaviour.
- **Cold-clone impact:** Applies. The port and cutover must not add a setup step or require reading beyond the README for the existing first-run path.
- **Product agnosticism:** Applies. No ported core behaviour may depend on a specific SaaS product.
- **Explicit errors:** Applies. Invalid structured output is preserved beside the ticket and stops the run with a clear error; missing or invalid values are not silently defaulted.

## Risks

- **Event contract instability:** The event stream is an interface redesign, not a mechanical port. A weak contract would be consumed by the CLI, run history, and future Studio and become expensive to change.
- **False regression confidence:** Q-0054 is the first workspace ticket able to prove the port as a whole. Earlier module tickets can pass narrow tests while still missing interactions represented only in the spike suite.
- **Harness self-dependency:** The spike is both the source implementation and the machinery delivering the port. An accidental change to `spike/src/**` or early CI cutover could invalidate the evidence used to approve later tickets.
- **Run coordination failure:** Without a per-ticket lock, overlapping runs can overwrite or roll back work. Fifteen related tickets increase the likelihood and impact.
- **Gate rollback:** Until an undecided gate is supported, a non-interactive decision can cause proven-green work to be rolled back.
- **Unbounded cost:** `budget.per_run_usd` is not enforced. The estimated total is based on a small sample and may materially understate the cost of repeated requirements and solution loops.
- **Boundary leakage:** Copying the spike's file layout directly would leave reusable domain logic in the CLI and vendor-specific details above adapters, blocking M3 reuse.
- **Premature cutover:** Removing the spike before Q-0010 and Q-0054 are integrated would leave no proven runnable replacement.
- **Documentation drift:** Package boundaries in the architecture and development plan currently conflict. Implementing before that conflict is decided could force rework at the bottom of the dependency graph.
