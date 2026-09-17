# Q-0134 — The gate screen shows the diff

## Problem

A solo maintainer reaching a gate can see the deciding step's verdict, findings and summary, but cannot see the code change that the step reviewed. They must leave Quorum and reconstruct the relevant git range themselves before deciding whether to advance, retry or abort the run.

Reconstructing the diff when the gate screen is opened would not be trustworthy. Branch refs may have moved since the reviewing step ran, and a flow may contain more than one `input.diff` range. The screen must show the exact bounded bytes supplied to the reviewing step, not infer a range from the flow or run `git diff` again.

Those bytes must not be added to the gate question. A diff may contain up to `repo.max_diff_bytes`, which defaults to 200,000 bytes, while gate questions enter a 500-event retained replay buffer. Replaying that payload to every late subscriber and reconnect would make one event roughly 1,000 times the measured mean event size.

This ticket touches the local daemon + web UI gate screen, the shared daemon/browser contract, and core's in-flight run evidence. It does not change the CLI, adapter contract, flow files or backlog file format.

## User story

As a **solo maintainer**, I want the gate screen to show the exact diff that the deciding step reviewed, including whether it was truncated, so that I can answer the gate without reconstructing evidence or being shown a change the reviewer did not see.

## Acceptance criteria

1. **Exact reviewed evidence — core and daemon.** When a verdict-declaring step receives an `input.diff`, Quorum associates the exact materialised diff evidence supplied to that step with the decision that can later reach a gate. The associated evidence identifies the interpolated three-dot range and contains the same retained patch bytes and truncation result used in the step's prompt. No gate-screen request invokes `git diff`, resolves either ref again, or derives a range from the flow file.

2. **Correct step identity.** A gate exposes diff evidence only when the decision in its `reached` value came from the same step for which that diff was materialised. Intervening script or integrate steps do not replace it. If a run contains multiple `input.diff` sites, the gate does not expose evidence from another site merely because it ran more recently.

3. **On-demand transport decision.** The patch bytes are not added to `GateQuestionEvent`, `WireRun`, the live frame union, or any retained broadcast event. While a gate is pending, the daemon provides one read-only endpoint keyed by the run handle and the gate's opaque `gateId`; the gate screen requests the evidence from that endpoint on demand. The endpoint does not accept a git range, ref, filesystem path or step id from the browser.

4. **Bounded in-flight lifetime.** The daemon retains the diff evidence only for the pending gate that owns it. It releases the evidence when that gate is removed from the pending-gate registry or when the run host is shut down. Reconnecting to the live stream does not duplicate the evidence, and repeated reads of the endpoint while the gate remains pending return the same snapshot. This in-memory evidence is not presented as run history or persistent state.

5. **Endpoint outcomes are explicit.** The diff endpoint has independently testable responses for: (a) evidence available; (b) the named run does not exist; (c) the gate is not pending; and (d) the pending gate has no reviewed diff. Cases (b)–(d) do not return an empty successful diff and do not reveal evidence belonging to another run or gate. Existing daemon-originated error-envelope conventions are reused.

6. **Existing range safety remains authoritative.** The snapshot originates only from `materialiseDiff` after its existing runtime guard accepts both endpoints as the configured base or one of the ticket's own branches. The static twin in `lint/lint.ts` remains in force. The new route cannot be used to request or serve an arbitrary repository range.

7. **Gate-screen placement.** For a pending gate whose `reached` decision has diff evidence, the web UI renders a section headed `Diff reviewed by <step id>` after the verdict, findings and summary and before the gate-answer controls. The range is visible in the section. The existing answer controls and their availability remain unchanged.

8. **Unified-patch rendering.** The web UI renders every retained file header and hunk in source order. Added lines, removed lines, context lines, hunk headers and file metadata are visually distinguishable without relying on colour alone. Patch text is treated as text, never as HTML. Tabs and spaces remain distinguishable, and an individual long line can be inspected without widening the whole page or hiding its tail.

9. **Empty states are truthful.** When a pending gate has a `reached` decision but that deciding step received no diff, the diff section says that the step reviewed no diff supplied by the flow. When no `reached` decision exists, the existing no-decision state remains authoritative and no diff is attributed to a step. Neither state renders a blank panel, spinner, skeleton, fabricated patch or inferred explanation.

10. **Loading and failure states are truthful.** While the on-demand read is in progress, the screen identifies that it is reading the reviewed diff without displaying a fabricated placeholder. If the read fails, the screen shows the daemon's condition and offers a retry of that read. A failed or superseded read does not clear, enable, disable or submit any gate answer, and a response for an earlier run handle or gate cannot replace the current screen's evidence.

11. **Truncation reuses the existing measurement.** The browser receives and renders the truncation outcome produced by the same materialisation that supplied the reviewing step. It does not apply a second patch cap. When the patch was truncated, the screen prominently states the configured limit and retained byte count. It names every file for which no patch was retained, or states that every file has some patch and the final file is cut short. A truncated patch is never labelled complete.

12. **Load-bearing diagnostics remain intact.** This change preserves the existing `diff truncated range=` log token, the `warn` event, the head-only byte cap, UTF-8 boundary handling and the distinction between a partly retained final file and files with no retained patch. Tests demonstrate that the prompt and browser disclosure agree for both truncation shapes.

13. **Acceptance evidence uses a constructed repository.** Automated tests create their own git repository, commits and ticket branches and set any identity they require. They prove a non-empty multi-file diff, added and removed lines, a long line, an unrecognised patch line, and both truncation shapes. No test verdict depends on this repository's already-contained historical ticket branches, global git identity, or a gitignored directory created by an earlier run.

14. **No diff remeasurement regression.** An automated test snapshots a reviewing step's diff, moves one or both source refs before reading the gate endpoint, and proves that the endpoint still returns the original reviewed bytes rather than the new git result.

15. **Transport-size regression.** Automated tests submit a diff at the configured maximum and prove that neither the gate question nor any retained live frame contains the patch or grows with its byte length. The existing retained-event count remains 500.

16. **Renderer dependency and bundle cost.** If an external diff renderer or parser is added, it is a small, maintained, non-deprecated `apps/web` devDependency used in the served bundle. The solution document gives the required one-line justification and records measured JavaScript and CSS bundle sizes before and after the addition, using the current baseline of 352,894 bytes of JavaScript and 10,599 bytes of CSS. If the implementation uses no dependency, the solution document explains how the parser handles every case in AC-8 and AC-13. No network asset is loaded at runtime.

17. **Architecture record.** Before implementation is accepted, a new append-only decision entry records that reviewed patch bytes are fetched on demand by opaque gate identity and excluded from retained events. It names the rejected alternatives of embedding the bytes in the gate question and re-running git at read time. The entry is cited by title and date, never by file name or decision number.

18. **Documentation remains accurate.** `docs/04-architecture.md` describes the exact-evidence source, on-demand route, lifetime and truncation disclosure. It retains the rule: *“No placeholder is a blank panel, a spinner or a skeleton, and none shows a fabricated project, run, ticket or cost.”* The documentation does not cite that rule by line number.

19. **Three successor needles are re-aimed.** `apps/web/test/source.test.ts` no longer forbids `diff`, `blocker` and `hunk` from the gate screen merely by their presence. Each of the three remains an effective guard over its intended successor behavior: the diff has a rendered subject, truncation or unavailable evidence has an explicit blocker state, and hunks are rendered rather than flattened or discarded. The test continues to prove that its controls discriminate against a deliberately invalid fixture.

20. **Retired placeholder remains retired.** The sentence *“The gate screen shows a step's verdict and diffs, and takes the answer.”* remains absent, including when assembled from fragments. Documentation and UI text describe shipped behavior precisely instead of restoring that placeholder.

21. **Gate behavior is unchanged.** `gateAnswerSchema` remains exactly `advance | retry | abort`; `gateAnswerEnvelopeSchema` remains strict and gains no reason or diff field. Showing a truncated diff does not itself permit, refuse or alter an answer. Whether a truncated review may advance remains Q-0128's scope.

22. **Cross-cutting verification.** The workspace-local and locally packed installation paths still build and serve the web app without an internet connection. The implementation adds no subscription or adapter path, performs no write to the user's working tree, changes no flow or ticket schema, introduces no vendor-specific knowledge, and keeps the mock-adapter end-to-end regression suite green.

## Non-goals

- Changing the gate answer set, labels, confirmation behavior or retry eligibility.
- Deciding whether a gate may advance after a truncated review; that belongs to Q-0128.
- Re-running or otherwise reconstructing a diff when the gate screen is opened.
- Showing an arbitrary range selected by the browser or exposing a general git-diff endpoint.
- Showing diffs for ended historical runs; this ticket covers evidence attached to a pending gate.
- Persisting a second copy of the patch in the backlog or changing the run-history manifest format.
- Changing `repo.max_diff_bytes`, the current head-only truncation algorithm, file ordering or the existing warning grammar.
- Adding side-by-side mode, syntax highlighting, comments, file navigation, patch download or editing.
- Changing flow files, the adapter contract, cross-vendor rules, worktree behavior or the CLI.
- Adding live updates to the gate screen; its existing explicit refresh behavior remains.
- Adding a remote daemon, multi-user authorization, cloud storage or a plugin mechanism.

## Open questions

1. **Non-blocking — visual tokens. Owner: design/implementation.** Which existing palette tokens should represent additions, removals, context and metadata while meeting AC-8's non-colour distinction? This may change presentation but not the contract or scope.

2. **Non-blocking — renderer selection. Owner: principal architect during solutioning.** Does a measured external renderer satisfy AC-8 with an acceptable served-bundle increase, or is the required subset safer to implement locally? The solution must record the measurement and justification required by AC-16; either choice must satisfy the same acceptance tests.

## Risks

- Holding patch bytes in both core and the daemon could accidentally double memory use. The solution should transfer or share one bounded snapshot per pending gate and test release on every gate-removal path.
- A renderer may interpret patch content as markup or mishandle unusual unified-patch lines. Text-only rendering and adversarial fixture coverage are required.
- A route keyed only by `gateId` could cross run boundaries if gate IDs are parsed or assumed globally unique. The route therefore requires both run handle and opaque gate ID and checks membership in that run's pending registry.
- A stale browser response could show evidence from a previously selected run or gate. The gate screen must apply the same generation guard used by its existing run read.
- A renderer dependency may materially increase the served bundle and the cold-clone install. The before/after measurement makes that cost visible before acceptance.
- Truncation disclosure could drift from reviewer disclosure if the UI recomputes it. The UI must render the materialisation result and tests must compare the two consumers.
- Existing backlog branches contain no demonstrable diff because they are contained in `main`. Manual validation against a past ticket would give false confidence; constructed-repository tests are the acceptance evidence.
