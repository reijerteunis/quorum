# Q-0038 — Deferred-range failures name their producing step in every case

## Problem

The CLI’s run-level diff preflight currently classifies a whole range as deferred when either endpoint is expected to be created by an earlier step in the same flow. It consequently does not validate the other endpoint, even when that endpoint must already exist. A missing pre-existing endpoint can therefore remain undiscovered until after the producing adapter has been invoked and billed.

When the deferred range is later materialised, its missing-ref diagnostic names the producing step only when the missing endpoint is the endpoint that caused the deferral. If the other endpoint disappeared or never existed, the message identifies the missing endpoint but omits the separate fact that the range was deferred because a named step was expected to create a named ref. The maintainer therefore cannot reconstruct why the failure happened at step time.

A neighboring diagnostic has the same source location and attribution problem. When an explicit `--base <ref>` override does not resolve, the error says that `repo.base_branch` in `harness/harness.yaml` names the missing ref, although that file did not supply the value.

The affected surface is the CLI run machinery in `spike/`. No file format, flow syntax, adapter contract, or public API changes.

## User story

As a **solo maintainer** running a flow through the **CLI**, I want every endpoint that is required to exist at run start to be checked before any adapter is invoked, even when the other endpoint will be created by an earlier step, so that I do not pay for a step when the range is already known to be unusable.

As a **solo maintainer** diagnosing a deferred range through the **CLI**, I want the failure to distinguish the endpoint that is missing from every step/ref pair that caused the range to be deferred, so that I can tell what failed to resolve and why the range was not checked at run start.

As a **solo maintainer** using `--base <ref>` through the **CLI**, I want an unresolvable override to be attributed to the command-line option rather than to `harness/harness.yaml`, so that the error sends me to the source of the value I must correct.

## Acceptance criteria

1. **The preflight classifies each endpoint independently.** For every interpolated, non-template `input.diff` range, the run-level preflight determines separately whether each endpoint:
   - must exist when the run starts; or
   - is expected to be created by a step in a strictly earlier flow group.

   A branch created by a parallel sibling is not treated as created earlier. A branch created only by a later step remains a pre-existing endpoint for this check. The existing range-shape and allowed-endpoint guard remains in force.

2. **Every pre-existing endpoint is validated during preflight.** The preflight attempts to resolve each endpoint classified as pre-existing even when the other endpoint is deferred. If any pre-existing endpoint does not resolve, the run fails during preflight, before any adapter invocation. The failure continues to identify:
   - the missing ref;
   - whether it is the left or right endpoint;
   - the complete interpolated range and, when different, the range as written;
   - whether the other endpoint resolves and its short SHA when available; and
   - that neither the diff nor the containment check was run.

3. **A mixed range is deferred only after its pre-existing endpoints pass.** When all pre-existing endpoints resolve and at least one endpoint is expected from an earlier step, the range remains deferred and is materialised immediately before its consuming adapter would be invoked. Preflight does not run `git diff`, an emptiness check, or a containment check for that range because the deferred evidence does not yet exist.

4. **A known-bad mixed range invokes zero adapters.** An end-to-end regression scenario places an adapter-bearing step before a consuming step whose range has one deferred endpoint and one missing pre-existing endpoint. The run fails with zero adapter invocations, including no invocation of the otherwise earlier producing adapter. Invocation count is measured at the adapter boundary or from run-history occurrence records, not inferred from missing output artifacts.

5. **Deferred metadata is retained per endpoint.** For every endpoint that causes a range to be deferred, the run retains the endpoint ref and the id of the earliest strictly earlier step expected to create it. If both endpoints are deferred, both step/ref pairs are retained. Repeated uses of the same range receive the same endpoint metadata and do not weaken the preflight checks in criteria 1–3.

6. **Every deferred missing-ref failure reports both kinds of evidence.** If either endpoint fails to resolve when a deferred range is materialised, the diagnostic separately states:
   - which endpoint is missing and the ref it names; and
   - every retained producing step/ref pair that caused the range to be deferred.

   The producer statement must not imply that a producing step owed a different missing endpoint. For example, if the left pre-existing endpoint disappears after preflight and the right endpoint was deferred, the message identifies the left endpoint as missing and separately says that the range was deferred because step `"implement"` was expected to create the right ref. It does not say that `implement` was expected to create the left ref.

7. **The diagnosis fix remains observable after the timing fix.** A regression scenario begins with a resolvable pre-existing endpoint, allows preflight to pass and the producing adapter to run, then removes or moves that pre-existing ref before the deferred range is materialised. The resulting failure:
   - names the now-missing endpoint;
   - names the producing step and the different ref it was expected to create;
   - includes the resolving endpoint’s short SHA when available;
   - states that neither the diff nor containment check ran; and
   - invokes the producing adapter but not the consuming adapter.

8. **A missing endpoint owed by a step still names that exact producer.** When the endpoint that fails to resolve is itself deferred, the diagnostic names the missing ref and the step expected to create that same ref. The existing identifying phrase `input.diff names missing ref` is preserved for a generic ticket-branch endpoint, and the consuming adapter is not invoked.

9. **Deferred empty and indeterminate diagnostics retain producer evidence.** When a deferred range resolves but is empty or has an indeterminate containment result, its diagnostic continues to name every retained producing step/ref pair. Existing endpoint SHAs, containment command and outcome, diagnosis, and remedy behavior from Q-0035 remain unchanged. A deferred remedy must not advise the maintainer to review the produced ref before it became contained.

10. **An unresolvable explicit base override is attributed to `--base`.** When the effective diff base came from `--base <ref>` and that ref does not resolve, the missing-ref diagnostic:
    - names `--base` as the source;
    - includes the supplied ref;
    - identifies it as the applicable left or right endpoint; and
    - does not claim that `repo.base_branch` or `harness/harness.yaml` supplied it.

    A CLI regression test invokes a run with an unresolvable, non-empty `--base` value and observes this failure before any adapter invocation.

11. **The configured-base diagnostic is unchanged.** When no base override is in force and `repo.base_branch` does not resolve, the failure continues to contain `repo.base_branch`, `harness/harness.yaml`, and the configured ref. The existing `spike/test/q0006-engine.js` configured-base scenario remains green without weakening its assertions.

12. **The integration-branch diagnostic remains distinct.** A missing `harness/<id>/integration` endpoint continues to contain the existing identifying phrase `review requires an integrated branch` and does not mention `repo.base_branch`. When it is the pre-existing endpoint of a mixed range, it now fails during preflight with zero adapter invocations.

13. **Dry-run behavior is unchanged.** Under `--dry`, a range with an endpoint expected from an earlier step continues to use the deferred placeholder behavior: no adapter is invoked, no produced branch is required to exist, and no persistent ticket or run artifact is written solely to satisfy the deferred range. Pre-existing endpoints of a mixed range are nevertheless validated, so `--dry` does not report the range as valid when one of those endpoints is missing.

14. **Valid diff evidence is unchanged.** A non-empty range whose required endpoints resolve produces the same diff stat, patch bytes, truncation behavior, and prompt content as before this ticket. A deferred range is still materialised no later than immediately before its consuming adapter. Distinct fully pre-existing ranges continue to be materialised during preflight and reused by their consumers.

15. **The range guard and fan-out treatment are unchanged.** Malformed ranges, unrelated refs, and unresolved non-template variables continue to fail through their existing paths. A fan-out template containing unresolved per-task variables remains deferred to task expansion rather than guessed during run preflight. This ticket does not add or relax accepted `input.diff` syntax.

16. **The regression suite proves the behavior change.** Tests are added or amended to cover at least:
    - a mixed range with a missing left pre-existing endpoint;
    - a mixed range with a missing right pre-existing endpoint;
    - disappearance of a pre-existing endpoint after preflight;
    - a missing deferred endpoint;
    - two deferred endpoints with their respective producer/ref pairs;
    - an unresolvable explicit `--base`;
    - an unresolvable configured base;
    - the existing deferred empty, indeterminate, and `--dry` cases; and
    - an ordinary non-empty range.

    `npm test --prefix spike` and `pnpm turbo run test --force` both pass after their required dependency installations.

17. **Cross-cutting product constraints remain satisfied.** Specifically:
    - **BYOS:** no subscription or adapter authentication behavior changes, and no API-key path is added.
    - **Worktree safety:** preflight and diagnostics do not write to the user’s working tree; existing worktree and branch placement remains unchanged.
    - **Gate behavior:** no gate default, human-locked behavior, or loop exhaustion behavior changes.
    - **Files and schemas:** no persistent file, YAML field, frontmatter field, schema, or hidden daemon state is added.
    - **Lint rules:** no new lint rule is introduced, and the existing `input.diff` rule remains unchanged.
    - **Cross-vendor rule:** adapter selection and reviewing-step cross-vendor enforcement are unchanged.
    - **Cold-clone impact:** no new setup step, command option, or required documentation path is introduced.

## Non-goals

- Creating `harness/<id>/integration` before the chore flow’s review step or changing the order of chore-flow steps.
- Adding a static flow-lint rule that proves a required branch will exist before a consuming step.
- Enforcing `budget.per_run_usd` or otherwise interrupting a run based on cost.
- Changing which steps create worktree, task, or integration branches.
- Changing the syntax or allowed endpoint classes of `input.diff`.
- Changing diff semantics, containment semantics, empty-range remedies, patch truncation, or prompt formatting except for the diagnostics explicitly required above.
- Adding a new CLI flag or changing the meaning of `--base`; the override remains a diff anchor only.
- Porting the diff subsystem to `packages/core`. Q-0051 owns that port after this behavior is contained in `main`.
- Editing flows, the adapter contract, gates, ticket frontmatter, run-history formats, documentation vocabulary, or public APIs.
- Addressing multi-user operation, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, another adapter, or a desktop shell.

## Open questions

None. The ticket body settles the scope: endpoint-by-endpoint timing, complete deferred-producer diagnostics, and correct `--base` attribution all land together in `spike/` before Q-0051 is restarted.

## Risks

- **Sequencing with Q-0051.** If Q-0051 restarts from the aborted requirement before Q-0038 is contained in `main`, it may port the known wholesale-deferral defect and require the same change in two trees. Q-0038 must land first; Q-0051 must then be re-derived from the fixed spike rather than following its superseded D-5.
- **Misattributed responsibility.** A message that says a producing step owed the missing pre-existing endpoint would be factually wrong. Producer/ref metadata and missing-endpoint evidence must remain separate fields in the diagnosis.
- **Multiple deferred endpoints.** Retaining only the first matching endpoint would recreate the current asymmetry when both endpoints have producers. Tests must make order reversal unable to hide either producer/ref pair.
- **Race between preflight and consumption.** Git refs can change after preflight. The step-time check must remain authoritative and must report current resolution evidence; preflight success cannot be treated as a permanent guarantee.
- **Incorrect base-source detection.** Comparing the effective base value with `repo.base_branch` is insufficient because an override may equal the configured value. Attribution must use whether an override was actually supplied, not whether its value differs.
- **Accidental dry-run regression.** Endpoint-by-endpoint validation could mistakenly demand that a deferred ref already exist under `--dry`. Only pre-existing endpoints are resolvable at that point; deferred endpoints must retain their placeholder behavior.
- **Behavior drift during the later port.** Q-0051’s independent spike witness must include these new scenarios so the eventual `packages/core` implementation cannot preserve the superseded `.find()` behavior while both suites appear green.
