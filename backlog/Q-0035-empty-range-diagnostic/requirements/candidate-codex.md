# Q-0035 — The empty-range diagnostic reports evidence, not a story

*Candidate requirement · product-manager · 2026-08-24 · milestone M2 · iteration 1*

## Problem

When a step's `input.diff` resolves to an empty Git range, the CLI reports that the right ref "is already merged into" the left ref. The engine did not verify that historical event. It ran `git merge-base --is-ancestor <right> <left>`, which establishes a current ancestry relationship, and converted that result into a story about how the relationship arose.

The error omits the commit identities and the check outcome needed to reproduce its conclusion. It also recommends pointing `input.diff` at a merge commit, although the range guard permits only the configured base or branches belonging to the current ticket.

This matters because a review can otherwise proceed without its intended evidence. Q-0006 run 10 invoked two adapters against an empty diff and recorded $5.02 of reported cost. The run-level preflight now prevents that for ranges whose refs exist before the run starts. It deliberately defers a range whose endpoint is created by an earlier step in the same flow, so the same zero-invocation guarantee cannot currently be made for every range.

Surfaces touched: the `quorum` CLI error output, flow execution in `harness/`, tests in `spike/test/`, and the append-only record in `docs/DECISIONS.md`. No Studio surface exists in M2.

## User story

**`maintainer`** — I want a flow to stop before an adapter is invoked when its review evidence is already known to be empty or unresolvable. When an empty range is found, I want the CLI to show the refs, commit identities, and exact Git check result so I can reproduce the state without trusting an inferred history.

**`contributor`** — I want empty-range errors to distinguish verified Git states from failed checks, so a flow or adapter test cannot turn an inability to inspect the repository into a confident diagnosis.

## Acceptance criteria

1. **An empty-range error identifies the evidence.** On the CLI surface, when `git diff --stat <left>...<right>` succeeds with no output, the resulting error names:
   - the interpolated `<left>...<right>` range;
   - both ref names;
   - the short SHA resolved for each ref; and
   - the exact containment check performed, `git merge-base --is-ancestor <right> <left>`, with its outcome expressed as `contained`, `not contained`, or `indeterminate`.

   A test asserts all four elements. The short SHA format is the output of `git rev-parse --short <ref>`; the requirement does not prescribe a fixed abbreviation length.

2. **The error asserts only verified Git states.** The containment outcome is derived from the command's exit status: exit 0 means `contained`, exit 1 means `not contained`, and any other exit or execution failure means `indeterminate`. The error does not say that a ref was merged, rebased, reset, cherry-picked, or otherwise describe a historical event unless a separate check has established that event. An indeterminate result includes a concise Git failure reason and is never rendered as `not contained`.

3. **Distinct commits with identical trees remain distinguishable.** A test creates different `<left>` and `<right>` commits for which the configured three-dot diff is empty. The error includes both different short SHAs and the actual containment outcome; it does not infer that the refs are the same commit or that either branch was merged.

4. **A contained right ref is reported as a state, not a story.** A test makes `<right>` an ancestor of `<left>` and produces an empty range. The error says that the containment check succeeded or that `<right>` is contained in `<left>`. It does not use the phrases "already merged", "merged into", or an equivalent claim about how that state arose.

5. **Missing refs fail with the evidence that exists.** If either endpoint cannot be resolved, the CLI error names the complete range, identifies the missing ref as unresolved, and includes the short SHA of the other endpoint when that endpoint resolves. It states that the diff and containment checks were not run. It does not invent a SHA or containment result for the missing ref. Tests cover a missing left endpoint and a missing right endpoint.

6. **Invalid or unrelated ranges remain guard failures.** A range that is malformed or whose endpoint is neither the configured base nor one of the current ticket's branches fails the existing range guard before Git diff or containment checks run. Its error names the supplied range and the allowed endpoint classes. It does not present itself as an empty-range diagnosis. Tests cover a malformed range and an unrelated ref.

7. **The diagnostic offers only usable next actions.** Empty-range and missing-ref messages do not recommend pointing `input.diff` at a merge commit or any other endpoint the range guard would reject. Guidance may direct the maintainer to verify the configured range, commit the intended work, or run the review before the right ref becomes contained in the left ref.

8. **The range guard is retained.** Both endpoints must remain either the resolved configured base or branches under `harness/<ticket-id>/`. A test supplies `ctx.vars.base` with a non-default base ref and proves that a range using that ref passes the guard. This preserves composition with a future CLI base override without adding that override in this ticket.

9. **Bad pre-existing-ref evidence prevents all adapter invocation.** Before the first flow step invokes an adapter, run-level preflight materialises every distinct `input.diff` whose endpoints are expected to exist at run start. If any such range is empty, missing, malformed, unrelated, or cannot be checked, the run fails and the mock adapter invocation count is zero. A flow fixture places an adapter step before the diff-bearing step and separately tests each failure class. An error in one range prevents invocation even if other ranges are valid.

10. **Flow-created ranges fail at the earliest currently possible point.** When a range endpoint is created by an earlier step in the same flow and therefore cannot be materialised at run start, it remains deferred. Once the endpoint should exist, the range is materialised before the adapter that would consume that diff. Empty, missing, or indeterminate evidence prevents that consuming adapter from being invoked. The test separately counts the earlier producing adapter and the diff-consuming adapter; it expects the former to have run and the latter not to have run. This criterion does not claim zero total invocations for a ref that did not exist before the run.

11. **Every adapter receives one materialised copy of valid evidence.** Existing behaviour remains unchanged for a non-empty range: each distinct range is materialised once, panel members receive identical bytes, and the applicable adapters run. A regression test proves the diagnostic change does not reject or alter a valid diff.

12. **The Q-0006 record is settled with re-runnable evidence.** `docs/DECISIONS.md` gains an append-only entry that explicitly names and closes the entry titled `Erratum: M1's closing entry on Q-0006's empty diff — 2026-08-24`. The new entry records:
   - Q-0006 review run 10 and its timestamp from `backlog/Q-0006-review-flow-and-cross-flow-backward-edge/runs.log`;
   - the recorded heads, `main` at `cdec5e9` and `harness/Q-0006/integration` at `998f397`;
   - re-runnable commands for resolving those commits, checking `git merge-base --is-ancestor 998f397 cdec5e9`, and inspecting the corresponding diff;
   - the relevant branch reflog entries, including the later movement to `02f248f`, rollback to `998f397`, and subsequent movement; and
   - a plain conclusion about whether the sentence printed during run 10 was accurate at that time, distinguishing the verified ancestry fact from any historical event established by the additional record.

   The entry uses the required **Decision**, **Alternatives considered**, and **Why** structure. It also records why the range guard was retained and why the merge-commit recommendation was removed.

13. **The regression suite covers the public behavior.** Tests under `spike/test/` independently cover criteria 1–11 and run through the repository's existing `npm test` command in `spike/`. Existing mock-adapter end-to-end tests remain green. No test invokes a paid adapter.

14. **Cross-cutting constraints remain unchanged.** The implementation adds no dependency and no subscription-authentication path; writes no persistent state outside `backlog/`, `harness/`, or `.quorum/`; does not write to the user's working tree; does not change gate behavior, flow YAML syntax, ticket frontmatter, an adapter contract, or a lint rule; names no specific SaaS product; and adds no command or setup step to the cold-clone path. If implementation requires any of these changes, this requirement must return to product review.

## Non-goals

- Reconstructing branch history from ancestry alone.
- Guaranteeing zero total adapter invocations for a range whose endpoint does not exist until an earlier adapter step creates it.
- Predicting whether a future step will produce an empty tree or an empty diff.
- Removing or weakening the range guard.
- Adding the proposed CLI base override.
- Changing three-dot diff semantics or permitting two-dot ranges.
- Changing adapter behavior, adapter output schemas, billing data, budget enforcement, or subscription checks.
- Refunding or recalculating the cost recorded for Q-0006 run 10.
- Changing gates, stages, flow YAML, ticket frontmatter, or persisted run formats.
- Changing the Studio, which is not an M2 surface.
- Adding any v1-excluded capability, including multi-user operation, a remote daemon, cloud sync, a plugin marketplace, visual flow editing, eval suites, another adapter, or a desktop shell.

## Open questions

1. **Blocker — must a flow-created range provide a zero-total-invocation guarantee?** Owner: maintainer. The ticket body asks for every later bad range to fail before the first adapter is invoked, but the chore flow's `integration...implement` range cannot be inspected until the implement adapter creates the right endpoint. The candidate requirement uses the earliest-possible guarantee in AC-10: the producing adapter may run, while the adapter consuming the bad diff may not. If zero total invocations is mandatory, product must choose a different flow model or require evidence to exist before any adapter work; that materially changes flow execution and is outside a diagnostic-only change.

2. **Non-blocking — how much Git stderr is safe and useful in an indeterminate error?** Owner: engineer. The implementation may normalize the failure to a single line and must not omit the command or the `indeterminate` state. This does not change a file format or adapter contract.

## Risks

- **False certainty from collapsed exit statuses.** The current `try/catch` converts every nonzero result into the same boolean. Unless exit 1 is separated from execution failure, the new wording could retain the same defect with more detail.

- **Misleading SHA presentation.** Ref names can move after the error is printed. Showing the ref and resolved short SHA together reduces ambiguity, but tests must not assume a fixed short-SHA length.

- **Preflight overreach could break the chore flow.** Treating a flow-created ref as missing at run start would reject a valid flow. Deferral must remain order-aware, including parallel groups where a sibling is not an earlier step.

- **Preflight underreach could still incur cost.** A range incorrectly classified as flow-created could bypass run-level validation. Tests need both a genuine earlier-step-created endpoint and a missing pre-existing endpoint.

- **The historical record may overstate what reflog proves.** Reflogs are local and expirable. The DECISIONS entry must record the commands and observed entries without turning their continued future availability into an acceptance condition.

- **Error snapshots may become brittle.** Tests should assert required evidence fields and prohibited historical claims rather than one complete punctuation-sensitive sentence.
