# Q-0129 — The gate screen shows the verdict that reached it, and the diff

## Problem

A solo maintainer reaching the web gate screen can see the gate question and submit an answer, but cannot see the evidence needed to choose that answer. A declared-verdict step already produced a verdict, findings and summary, and a reviewing step may already have received a diff, but those structured values do not reach the screen.

The existing alternatives are not safe:

- The verdict and findings appear in human-readable event messages whose shape is conditional. Reading them would require parsing prose, and a `warn` event has no `stepId`.
- Verdict artifacts are stored under a ticket’s hidden `.harness/` directory, possibly at a flow-author-supplied path. Existing backlog routes deliberately exclude that directory. Serving it through those routes would change what the backlog surface means.
- A run parked at a gate has `runId: null`; its run-history id therefore cannot be composed without inference.
- No route supplies the diff or its range. The existing `materialiseDiff` operation is internal to a run and applies `repo.max_diff_bytes`.

Re-measured from the repository on 2026-09-17:

- There are 306 verdict JSON artifacts across 73 ticket folders.
- There are 235 engine-recorded gate answers: 157 at author-declared `human` gates and 78 at engine-presented `human-locked` gates.
- `retry` has been chosen zero times at an author-declared gate.
- `warnEventSchema` remains strict over `{type, message}` and has no `stepId`.
- `diff2html`, `diff` and `jsdiff` remain absent from workspace manifests and the lockfile.

This ticket chooses one transport rule for later reuse by Q-0131: a structured value that the engine already holds reaches the browser as structured run data. The engine attaches an optional evidence snapshot to the existing gate question before emitting it. The daemon and browser reuse that shape; they do not reconstruct it from prose or files.

Surfaces touched: local daemon and web UI, plus the shared event contract and core flow engine. The CLI, backlog file routes and adapter contract are unchanged.

## User story

As a **solo maintainer**, I want a gate screen to show the structured verdict and review diff that reached that gate, so I can decide whether to advance, retry or abort without leaving the screen or trusting a sentence parsed by the browser.

As a **cold-clone adopter**, I want gates that have no verdict or diff to remain clear and usable, so the screen never invents evidence that the flow did not produce.

## Acceptance criteria

1. **Shared event contract — optional gate evidence.** `GateQuestionEvent` gains one optional, strictly validated evidence object. That object may contain:
   - a verdict record with `stepId`, `verdict`, `findings` and `summary`; and
   - a diff record with its interpolated `range`, complete `stat`, displayed patch text, full byte count, displayed byte count, truncation status and omitted-file names.
   Unknown fields are refused at every newly introduced object boundary. Omitting the evidence object remains valid and preserves the current gate event shape.

2. **Decision record — structured run values cross on the gate question.** Before implementation changes the shared contract, a new append-only decision entry records that evidence the engine already holds may be snapshotted onto a gate question for browser consumption. It names and rejects these alternatives: parsing `warn` or `done` prose; reading or exposing `.harness/` verdict artifacts through backlog routes; inferring the newest run-history row; and adding a separate evidence route. `docs/DECISIONS.md` indexes the entry using the date on which it is added.

3. **Core — evidence is captured at the gate.** When core emits a gate question, it snapshots the applicable structured verdict and diff already produced during that run. Later execution cannot mutate an emitted question’s evidence. Core does not reopen a verdict artifact, parse an event message, query run history or derive a run number from `gateId`.

4. **Core — deterministic provenance.** The evidence selection is deterministic from the executed flow, not from completion timing. The verdict is from the nearest preceding completed step in flow declaration order that declared a verdict. The diff is the nearest preceding materialised `input.diff` in flow declaration order. Parallel members are ordered by their declaration order for this selection. A repeated execution replaces evidence from its earlier iteration. Tests cover parallel completion in the opposite order from declaration and a revise loop with at least two iterations.

5. **Core — verdict fidelity.** The verdict record contains the exact validated `verdict`, ordered `findings` array and `summary` returned by the selected step, including an empty findings array and an empty summary string if those are the measured values. It carries the selected step’s exact `stepId`. No field is extracted from the `warn` or `done` message, and a flow-author override of `verdict_file` does not affect the evidence.

6. **Core — absence remains absence.** A gate with no preceding completed declared-verdict step has no verdict record. A gate with no preceding materialised diff has no diff record. Either record may be present without the other. Core and the browser do not synthesize placeholders, empty records or values from a previous run, previous gate or previous iteration.

7. **Core — one diff materialisation.** Gate evidence uses the same materialised bytes and metadata supplied to the selected reviewing step. It does not invoke `git diff` again when the gate is reached. A ref moving after the reviewing step therefore cannot make the browser show evidence different from what that step reviewed.

8. **Core — one truncation rule.** The displayed patch is bounded by the same `repo.max_diff_bytes` value and UTF-8-safe truncation operation used for the reviewing step. The complete `--stat` remains available. If the patch is truncated, the structured record reports the configured limit, full and displayed byte counts, and either the ordered omitted-file list or the distinct fact that every file has some patch and the last file is cut short. The existing `diff truncated range=` log token and reviewer warning remain unchanged. This ticket does not change whether a truncated review may approve; Q-0128 owns that policy.

9. **Daemon — existing projections carry evidence unchanged.** Pending questions returned in `WireRun.gates` include the optional evidence through the shared `GateQuestionEvent` schema. `GET /runs` and `GET /runs/:id` require no new route and declare no second verdict or diff schema. `pendingGates` remains equal to `gates.length`. A run parked at a gate still does not require a non-null `runId`.

10. **Web gate screen — verdict rendering.** When verdict evidence exists, the screen renders a labelled verdict region containing the exact step id, verdict and summary. Findings render as an ordered list preserving their complete text and order. An empty findings array renders an explicit “No findings reported” statement, without inventing a positive interpretation. Content is rendered as text, not executable HTML.

11. **Web gate screen — diff rendering.** When diff evidence exists, the screen renders the range, complete file-stat text and unified patch in a locally implemented, readable monospace view. Added and removed lines are visually distinguishable without changing their text. Long lines remain inspectable without changing the diff content. No runtime network request, external font or new rendering dependency is introduced.

12. **Web gate screen — truncation rendering.** A truncated diff displays a warning before the patch. The warning names the displayed and full byte counts and the configured limit. It lists every file for which no patch was supplied, or states that every file has some patch and the last file is incomplete. The warning must remain visible without expanding a collapsed region. An untruncated diff shows no truncation warning.

13. **Web gate screen — partial and absent evidence.** Verdict-only, diff-only and no-evidence gates each render without an empty card, skeleton, dash or fabricated value for the missing region. The existing question, ticket path, retry-target explanation, request states and answer controls remain usable in all three cases.

14. **Gate behaviour — answer set is unchanged.** The only accepted answers remain `advance`, `retry` and `abort`; `gateAnswerEnvelopeSchema` remains strict. The screen offers `retry` only when the question carries a retry target, as it does today. This ticket does not make `retry` primary and does not change `auto` or `human-locked` behaviour.

15. **Failure and stale-state behaviour.** A malformed evidence object causes the existing run read to enter its explicit invalid-response state; the browser does not render a partial verdict or diff from it. Navigating between handles or retrying a read cannot retain evidence from the previous handle. Submitting an answer does not remove the evidence while that answer is in flight, and the screen makes no claim that the ticket advanced until a subsequent daemon read establishes it.

16. **Compatibility.** Existing events and `WireRun` bodies without evidence continue to parse. The daemon and web app use the same shared schema. Tests prove that an older no-evidence gate still renders and can be answered.

17. **Documentation.** `docs/04-architecture.md` documents the optional gate evidence, its in-memory lifetime, deterministic provenance and reuse of bounded diff materialisation. `docs/05-design-prompt.md` records that verdict and diff regions appear only when measured evidence exists and that retry is not the primary action at an author-declared gate. No new glossary term is introduced.

18. **Regression coverage and verification.** Behaviour changes have tests in `packages/shared`, `packages/core`, `packages/server` and `apps/web`, including the mock-adapter end-to-end path for a run that reaches a gate with evidence and continues after a browser answer. Verification installs dependencies with `pnpm install --frozen-lockfile`, then runs `pnpm turbo run test --force --continue`, `pnpm lint` and `pnpm typecheck`. The workspace-local and locally packed `quorum open` paths are exercised for the gate screen; no registry-resolved installation is claimed.

## Non-goals

- Adding a fourth gate answer or changing the meaning of `advance`, `retry` or `abort`.
- Making `retry` available or primary at an author-declared gate that has no retry target.
- Changing `auto`, `human-locked`, backward-edge or stage-transition behaviour.
- Serving `.harness/` through `GET /tickets/:id/file`, widening the ticket file listing, or making engine artifacts part of the backlog browsing surface.
- Reading verdict evidence from the verdict JSON artifact or requiring the default verdict-artifact path.
- Reading a parked run from run history, matching the newest history row, or parsing `gateId` for a run number.
- Adding a verdict-specific or diff-specific HTTP route.
- Persisting events, gate evidence or browser state in a new file or hidden daemon store.
- Changing the diff reviewed by an adapter, raising `repo.max_diff_bytes`, paging or selecting diff hunks, or deciding whether truncated evidence may produce an approving verdict; Q-0128 owns those choices.
- Adding `diff2html`, `diff`, `jsdiff` or another diff-rendering dependency.
- Showing every intermediate verdict or every diff produced during a run. This ticket shows the deterministic evidence that reached the current gate.
- Adding cost, elapsed time or an early run number to the wire; Q-0131 applies this ticket’s structured-value transport rule to those separate fields.
- Changing an adapter, accepting subscription secrets through another path, or introducing vendor-specific fields.
- Multi-user access, a remote daemon, cloud sync, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter or a desktop shell.

## Open questions

1. **Should the diff region start expanded?** Owner: product manager. Recommendation: expanded when present, because it is the evidence the gate exists to inspect. This is non-blocking and may be settled during visual implementation without changing a contract or file format.

2. **Should the complete stat remain visible while the patch scrolls?** Owner: frontend engineer. Recommendation: keep it above the patch in normal document flow; a sticky implementation is not required. This is non-blocking.

No open question blocks solutioning. The transport, provenance, truncation and dependency choices are requirements of this ticket.

## Risks

- **Evidence selection could become timing-dependent.** Parallel steps finish nondeterministically. AC-4 defines declaration-order provenance and requires an inverted-completion test.
- **The browser could show a different diff from the reviewer.** Re-running git at the gate would create a second measurement after refs may have moved. AC-7 requires reuse of the materialised evidence.
- **A truncated diff can look complete.** The patch remains bounded and Q-0128 has not settled review policy. AC-8 and AC-12 make the loss explicit without pretending this ticket fixes it.
- **Large evidence increases live-run memory and response size.** The patch is bounded by the existing configuration and is attached only to pending gate questions. No unbounded history or browser persistence is introduced.
- **Strict schema version skew can reject a response.** The daemon and browser are distributed together in the same local five-package set; shared schemas and compatibility tests limit supported skew rather than inventing a second contract.
- **Rendered findings or patches could become an injection path.** Both contain agent- or repository-controlled text. AC-10 and AC-11 require text rendering without executable HTML.
- **A future flow may have several verdict-bearing or diff-bearing steps before one gate.** The nearest-preceding, declaration-order rule is deliberately deterministic, but it may not express a future need to compare several verdicts. Showing a collection would be a separate product change.

## Cross-cutting checks

| Concern | Requirement |
| --- | --- |
| BYOS | No adapter login path changes and no secret-bearing configuration is added. Existing subscription-only behaviour remains unchanged. |
| Worktree safety | Evidence is read from values already held by the run. No flow writes to the user’s working tree, and no branch or worktree rule changes. |
| Gate behaviour | Human-gated defaults and human-locked gates are unchanged. The accepted answer set remains closed. |
| Files and schemas | No persistent file format changes. The shared event schema is widened additively and strictly; the decision entry records that contract change. |
| Lint rules | No flow lint rule changes. Existing TypeScript strictness and deprecated-API linting apply to all changed source. |
| Cold-clone impact | No new dependency or installation step. Both supported local installation paths continue to serve the gate screen. |
| Product-agnostic | No SaaS product or vendor-specific behaviour is introduced. |
| Errors | Missing evidence remains absent; malformed evidence is refused explicitly; truncation is disclosed rather than inferred. |
