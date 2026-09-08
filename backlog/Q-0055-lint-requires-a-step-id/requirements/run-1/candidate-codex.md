# Q-0055 — Lint requires a step id wherever the engine interpolates one

## Problem

A flow can pass `lintFlow` with an executable step that has no `id`. The engine later uses that missing value in branch names, occurrence identity, diagnostics, and backward-edge counters. An agent step can therefore create a branch named `harness/<ticket>/undefined`, while other step kinds emit similarly misleading output or state.

This failure is discovered after a run starts, instead of when the flow is linted. For a cold-clone adopter writing a first flow, the resulting branch name does not identify the invalid field or where to correct it.

The defect remains in `packages/core/src/lint/lint.ts`. It applies to ordinary agent, script, integrate, fan-out, and parallel-member steps. A gate is different: shipped flows deliberately contain gates without an `id`, and the engine does not use a gate id for a worktree branch or backward-edge counter.

The affected surfaces are:

- `harness/`: the flow file format and shipped flow compatibility.
- CLI: the diagnostics returned through `quorum lint` and commands that lint flows before execution.
- `packages/core`: semantic flow linting and engine regression coverage.
- `packages/shared`: flow schemas must continue to require no key that semantic lint accepts as absent.

## User story

As a **cold-clone adopter**, I want `quorum lint` to identify an executable step that has no `id`, so I can correct the flow before a run creates a branch, counter, occurrence, or diagnostic containing `undefined`.

As a **contributor**, I want the rule to distinguish executable steps from gates and fan-out templates, so I can extend a flow without adding meaningless identifiers or breaking the shipped flow format.

## Acceptance criteria

1. `lintFlow` refuses a top-level ordinary agent step when its `id` key is absent.

2. `lintFlow` refuses a script step when its `id` key is absent, including a script step with an otherwise valid `run` value.

3. `lintFlow` refuses an integrate step when its `id` key is absent, including an integrate step with otherwise valid `branches`.

4. `lintFlow` refuses a fan-out step when the fan-out parent’s `id` key is absent, including one with an otherwise valid `fan_out` block and `step` template.

5. `lintFlow` refuses each member of a `parallel` group whose `id` key is absent. The enclosing parallel group remains id-less; the requirement applies to its executable members.

6. A fan-out step’s `step` template does not acquire a required `id`. When the template omits it, the engine continues deriving each expanded child id from the fan-out parent id and the task id.

7. A gate does not acquire a required `id`. A flow containing `{ gate, reason }` without `id` continues to pass this rule, including the id-less gate shipped in `harness/flows/chore.yaml`.

8. Each missing-id diagnostic identifies the step’s location without rendering the absent value as `undefined` or `null`. The exact diagnostic text is:

   - Top-level executable step: `step <N>: id is required`, where `<N>` is its one-based position in the top-level `steps` list.
   - Parallel member: `step <N>, parallel member <M>: id is required`, where `<N>` is the group’s one-based top-level position and `<M>` is the member’s one-based position in that group.

9. Missing-id diagnostics participate in `lintFlow`’s existing accumulated report. If a flow contains multiple id-less executable steps or unrelated lint defects, one `FlowError` reports all applicable problems in deterministic flow order; lint does not stop at the first missing id.

10. The existing duplicate-id rule continues to run over present ids. Adding the missing-id rule does not change its diagnostic or suppress duplicate-id findings elsewhere in the same flow.

11. `lintFlowDirectory`, `lintDirectory`, and the CLI lint surface expose the new diagnostic through their existing error and report formats. No CLI-only implementation or alternate validation path is added.

12. The flow schemas in `packages/shared/src/flow.ts` are aligned with the new semantic rule:

    - `id` is required by the ordinary agent, script, integrate, and fan-out parent schemas.
    - `parallel` members inherit the required agent-step id.
    - `id` remains optional on the fan-out `step` template.
    - A gate schema does not require `id`.

    This preserves the established boundary from *“Zod describes structure and types; the flow lint keeps the semantics”* (2026-08-25): lint owns which keys must be present, and the schema describes the accepted structure and types.

13. All shipped files under `harness/flows/` pass flow validation and lint unchanged. In particular, the change must not require adding an id to an existing gate.

14. Tests cover, individually, an id-less ordinary agent step, script step, integrate step, fan-out parent, parallel member, gate, and fan-out template. Tests also cover multiple missing ids in one accumulated report and a missing id combined with an existing lint defect.

15. An engine-level regression test establishes that a flow rejected for a missing executable-step id does not begin execution and does not create a branch whose name contains `/undefined`.

16. The Q-0055 compensation in `packages/core/src/engine/diff.ts` is removed or rewritten so it no longer claims that lint accepts an id-less executable step. No runtime fallback from a missing executable-step id to the strings `undefined` or `null` is added.

17. The change introduces no dependency. `pnpm lint`, `pnpm typecheck`, and `pnpm turbo run test --force --continue` pass after dependencies are installed with `pnpm install --frozen-lockfile`.

18. Cross-cutting checks are satisfied as follows:

    - BYOS: not applicable; no adapter authentication or subscription behavior changes.
    - Worktree safety: strengthened; invalid flows stop before an id-less step can obtain a worktree or name a branch.
    - Gate behavior: unchanged; gates remain id-less where desired, and human, auto, and human-locked behavior does not change.
    - Files and schema: the flow remains a YAML file in `harness/`; no persistent state or new file is introduced, and the shared schema is aligned as specified in AC-12.
    - Cross-vendor rule: unchanged and still evaluated alongside the new rule where applicable.
    - Cold-clone impact: improved; the adopter receives an actionable lint diagnostic before execution, with no additional setup step.
    - Product-agnostic behavior: unchanged.

## Non-goals

- Requiring an `id` on a gate or on the enclosing object of a `parallel` group.
- Requiring an explicit `id` in a fan-out `step` template when the engine can derive the expanded child id.
- Changing how fan-out child ids or task branch names are derived.
- Renaming existing valid step ids or changing the branch naming convention.
- Redesigning `flattenSteps`, changing the dispatch order used to classify step kinds, or converting lint to schema-first validation.
- Changing existing diagnostics unrelated to the new missing-id rule.
- Adding runtime defaults for an absent executable-step id.
- Repairing branches, worktrees, run history, or counters previously created with `undefined`.
- Addressing Q-0057 or the later `{run}` and `{iter}` write-path rules; those changes have shipped.
- Restoring or modifying deleted `spike/` code or the deleted port charter.
- Changing adapter behavior, gate answers, backward-edge limits, or the cross-vendor rule.
- Adding Studio behavior; this ticket changes the current CLI and file surfaces only.

## Open questions

1. **Must a present but empty string (`id: ""`) be refused by semantic lint?** Owner: product owner. Blocker before implementation. This requirement treats “missing” as an absent key and does not silently broaden the ticket to id syntax. The shared schema currently accepts an empty string, while the engine would interpolate it into names. If empty ids are to be refused, the decision must specify whether whitespace-only ids are also invalid and provide a separate diagnostic or explicitly extend AC-8.

## Risks

- Step classification is based on the engine’s existing dispatch rules. Implementing the check from TypeScript types instead of that dispatch shape could misclassify malformed steps and replace established lint diagnostics.
- `flattenSteps` removes the enclosing parallel-group position. Reusing it alone may make the required location diagnostics impossible or assign misleading positions; the implementation must retain source positions for this rule.
- Making `id` required on the shared agent schema automatically affects parallel members. Reusing that schema for the fan-out template would also require a template id and violate AC-6.
- Existing tests deliberately preserve the old defect and comments still cite deleted spike paths. Updating only the implementation would leave tests and schema documentation asserting the opposite behavior.
- Removing the engine compensation without proving lint runs before execution on every relevant command could turn a poor branch name into an unhandled failure. AC-11 and AC-15 guard that boundary.
- The rule prevents new invalid runs but does not identify or clean historical refs and run records containing `undefined`; attempting cleanup here would add destructive scope.
