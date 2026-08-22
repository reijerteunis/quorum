# Q-0006 — Review flow with cross-flow backward edge

## Problem

A maintainer can move a ticket to `green` after its tests pass, but no flow reads the integrated diff before the ticket advances. Passing tests alone do not establish that the implementation follows the requirements, respects the harness, or avoids maintainability and safety problems.

Quorum also lacks an executable cross-flow backward edge. When review requests changes, the ticket must return to development without creating an unbounded loop on the maintainer's subscriptions. The number of review-to-development iterations must therefore be persisted in the ticket, limited by configuration, and handed to a human gate when the limit is exhausted.

Surfaces: CLI, `harness/`, `backlog/`, and the spike's mock-adapter regression suite. The Studio is not affected in this milestone.

## User story

As a **maintainer**, I want reviewers using different adapters to read the integrated branch after it becomes green, so that I can decide whether a reviewed implementation advances and requested changes return to development without an unbounded subscription loop.

As a **cold-clone adopter**, I want the shipped review flow and its safety behavior to work through the existing CLI conventions, so that adding review does not require undocumented configuration or writes to my working tree.

As an **adapter contributor**, I want review steps to use the common adapter output and trace contracts, so that adding an adapter does not require review-specific behavior outside that adapter.

## Acceptance criteria

1. **Shipped flow files — `harness/`**  
   `harness/flows/review.yaml` and the corresponding initialized-project template exist. Both files lint successfully and declare `name: review`, `consumes: green`, and `produces: reviewed`. The two copies have equivalent behavior.

2. **Reviewer panel — `harness/` and CLI**  
   Running the review flow executes at least two reviewer steps as one parallel group. At least one reviewer uses the Claude adapter and at least one uses the Codex adapter unless the user applies the existing CLI adapter override for a test or diagnostic run. Each reviewer receives:
   - the diff for the ticket's integrated branch against its defined base branch;
   - `requirements/merged.md`;
   - `solution/solution.md`; and
   - the applicable harness rules.

3. **Read-only review — core safety**  
   Reviewer and verdict steps cannot write to the target repository or the user's working tree. Their declared outputs are written only inside the ticket folder. Review artifacts do not modify the ticket's integration branch.

4. **Round artifacts — `backlog/`**  
   For review round `N`, the flow writes one reviewer artifact per panel member and one verdict artifact under `review/round-N/`. A subsequent review round uses a new numbered directory and does not overwrite an earlier round. Round numbering remains correct after the CLI process exits and the flow is run again.

5. **Structured verdict — adapter contract and `backlog/`**  
   The verdict step consumes both reviewers' findings through the common structured-output contract and emits exactly one of `approve` or `changes-requested`. Its persisted artifact includes a summary and the deduplicated findings used to reach the verdict. Vendor-specific response fields do not appear in the flow engine, ticket format, or persisted verdict schema.

6. **Approval path — CLI and `backlog/`**  
   When the verdict is `approve`, the cross-flow backward edge is not taken. The configured end-of-flow human gate is presented unless that gate is explicitly configured as `auto`. Advancing the gate completes the run and changes the ticket stage from `green` to `reviewed` exactly once.

7. **Requested-changes path — CLI and core**  
   When the verdict is `changes-requested` and the configured iteration limit has not been exhausted, the engine follows `goto: flow:development`, stops the current review flow, and does not execute the review flow's final gate. The command reports the target flow and the ticket's regressed stage. It does not start the target flow implicitly.

8. **Stage compatibility — core**  
   The stage written by a cross-flow backward edge equals the stage from which the target flow can be run next. The engine validates this relationship instead of silently writing a stage that the target flow cannot consume. The exact stage and any required intermediate behavior depend on Open Question 1.

9. **Review fix handoff — `backlog/` and development flow**  
   A `changes-requested` verdict persists an actionable set of development tasks using the existing `tasks.yaml` task schema. The next development run consumes those review tasks without silently replacing or corrupting the solutioning tasks. The storage and selection rules depend on Open Question 2.

10. **Persisted bounded counter — `backlog/`**  
    Each followed review-to-development backward edge increments the named `iterations.review` integer in `ticket.md`. The updated value is written before the review command returns. A later process reads the persisted value and continues from it; the daemon or CLI holds no counter state that is absent from files.

11. **Iteration limit — core**  
    `max_iterations` is a positive integer and means the maximum number of times the review flow may regress the ticket through this backward edge without human intervention. With `max_iterations: 3`, the first three `changes-requested` verdicts may regress the ticket and the next one presents the exhaustion gate. Invalid, missing, zero, or negative values fail flow lint with a message naming the step and invalid field.

12. **Exhaustion gate — CLI and `backlog/`**  
    When `iterations.review` has reached `max_iterations`, another `changes-requested` verdict does not regress the stage or start development. It presents a human gate even when the command uses `--auto`. The gate explains that the review loop is exhausted and shows the current count and limit. The gate outcome and run outcome are appended to the ticket's run history.

13. **Exhaustion choices — CLI**  
    The exhaustion gate offers explicit outcomes whose effects are not interchangeable:
    - `advance` accepts the current integrated diff and permits completion toward `reviewed`;
    - `retry` authorizes exactly one additional backward-edge traversal; and
    - `abort` ends the run without changing the ticket stage.

    A retry does not erase unrelated iteration counters. Whether it resets or extends `iterations.review` is resolved by Open Question 3 and then covered by a regression test.

14. **Cross-flow target lint — `harness/`**  
    Flow lint resolves every `goto: flow:<name>` against the available harness flow files. A missing target, malformed target, target with no `consumes` stage, or unsafe stage relationship fails before any reviewer runs or ticket file changes.

15. **Cross-vendor rule — `harness/`**  
    `review.yaml` declares `cross_vendor: required`. Flow lint proves that every reviewing or judging step sees at least one artifact produced by a different adapter. It must account for the integrated diff and referenced findings rather than treating untraceable inputs as compliant. A single-adapter reviewer panel, or a verdict whose only traceable inputs come from its own adapter, fails lint with the affected step and adapters named.

16. **Explicit output failure — CLI and `backlog/`**  
    If a reviewer or verdict returns invalid structured output, the raw response is saved beside the ticket, the run stops with a message naming the failed step and saved file, the ticket does not advance or regress, and `iterations.review` is not incremented.

17. **Run history — `backlog/`**  
    Completed, regressed, exhausted, aborted, and failed review runs are distinguishable in the append-only ticket run history. Each entry records the review flow, stage before and after, run identifier, and outcome. A failed or interrupted run is not represented as completed.

18. **Worktree safety regression — mock-adapter suite**  
    End-to-end tests prove that review approval, requested changes, and exhaustion leave the user's working tree unchanged except for the repository-tracked `backlog/` and `harness/` file updates already allowed by the product. No review step creates an implementation worktree or commits code.

19. **Behavior regression coverage — mock-adapter suite**  
    Deterministic tests cover at least:
    - `green → reviewed` after an approving verdict and gate advance;
    - requested changes taking the cross-flow backward edge;
    - the persisted counter surviving a new CLI process;
    - review artifacts from multiple rounds remaining present;
    - exhaustion presenting a non-automatic human gate;
    - abort at exhaustion preserving the current stage;
    - invalid cross-flow targets failing lint before execution; and
    - invalid structured output stopping without a stage or counter change.

20. **BYOS and adapter isolation — CLI**  
    The change introduces no new subscription-login mechanism and no review-specific vendor invocation outside the adapters. Existing environment refusal checks continue to run before CLI probes, and the complete mock-adapter regression suite remains green.

21. **Cold-clone impact — CLI and README**  
    An initialized project receives a valid review flow without additional manual files. Existing commands and gate interaction patterns are reused. If a new CLI command, flag, or required setup step is introduced, the README is updated in the same change and the documented cold-clone path remains under 30 minutes.

22. **Documentation consistency — docs and harness**  
    The implemented counter semantics, stage regression, task handoff, gate behavior, and `review.yaml` example agree with `docs/02-sdlc-pipeline-spec.md`, `docs/GLOSSARY.md`, and the shipped flow. Any architecture change is recorded in the append-only `docs/DECISIONS.md`. No new dependency is required unless its one-line justification is included in the solution document.

## Non-goals

- Building Studio screens, backlog-board rendering, gate screens, or live run visualization.
- Automatically starting the development flow after review regresses a ticket.
- Implementing final QA, deploy, merge, pull-request, or remote-daemon behavior.
- Replacing the existing development fan-out or integrate step beyond the minimum required to consume review fix tasks.
- Mapping individual findings to only the affected development tasks beyond the task handoff defined here.
- Adding semantic scoring, eval suites, severity taxonomies beyond what is needed to produce `approve` or `changes-requested`, or automated dispute resolution between reviewers.
- Adding adapters, including a Gemini adapter, or changing the common trace and event format unless a blocking contract defect is demonstrated.
- Supporting multiple users, cloud sync, a plugin marketplace, a visual node canvas, or a desktop shell.
- Allowing unbounded review retries or making the exhaustion gate automatic.
- Writing review fixes directly from a reviewer or verdict step.

## Open questions

1. **Blocker — Which stage must `goto: flow:development` produce?**  
   Owner: product manager with core maintainer.  
   The ticket says review regresses `green → solutioned`, but the current `development.yaml` consumes `red`. Regressing to `solutioned` makes development unrunnable; regressing to `red` conflicts with the ticket and current SDLC diagram. Decide whether development will consume `solutioned`, the backward edge will regress to `red`, or another explicit flow transition will restore `red`. This changes flow behavior and possibly the documented state machine.

2. **Blocker — Where are review-generated tasks stored, and how does development select them?**  
   Owner: product manager with core maintainer.  
   The proposed edge passes tasks from `review/round-{iter}/verdict.md#tasks`, while the current development fan-out reads `solution/tasks.yaml`. Define a machine-readable file path and precedence/merge rule. This changes a persisted file format and cannot be inferred by engineering.

3. **Blocker — What exactly does `retry` at the exhausted gate do to `iterations.review`?**  
   Owner: product manager.  
   Options include incrementing the limit by one, recording a separate human override, or resetting only the review counter. Resetting all counters is unsafe and must not occur. The selected behavior must remain auditable in ticket files.

4. **Blocker — How is the integrated diff's producing adapter provenance represented for cross-vendor lint?**  
   Owner: core maintainer.  
   The current lint derives producers from outputs written within one flow, but review consumes a diff produced by an earlier flow and a verdict consumes findings by step reference. Define the static metadata or cross-flow lookup needed to prove the cross-vendor rule without silently accepting unknown provenance.

5. **Blocker — What is the canonical base ref for the review diff?**  
   Owner: core maintainer.  
   The example uses `harness/T-{id}..main`, while the ticket branch field names `harness/{id}/integration` and repositories may not use `main`. Define whether the base comes from repository configuration, the integration branch's merge base, or another existing field. Hard-coding a branch name is not acceptable.

6. **Which findings require `changes-requested`?**  
   Owner: product manager.  
   The draft instruction says to keep blockers and majors but only explicitly requires changes when a blocker remains. Decide whether any retained major also produces `changes-requested` or whether the verdict schema needs a separately defined threshold.

7. **Does the ordinary end-of-review human gate permit overriding an approving or changes-requested verdict?**  
   Owner: product manager.  
   The acceptance criteria specify the automated route and the exhaustion gate but do not define whether a maintainer can reject an `approve` verdict or accept requested changes before exhaustion. If supported in M1, the allowed transitions and counter effects need explicit definitions.

8. **How is a review round number derived?**  
   Owner: core maintainer.  
   Decide whether it is `iterations.review + 1`, the next unused `review/round-N/` directory, or a separate persisted field. The rule must avoid overwriting artifacts after aborted or failed reviews.

## Risks

- The requested `solutioned` regression conflicts with the current development flow's `red` input and can leave a ticket with no runnable next flow.
- Review task handoff can overwrite the architect's original `solution/tasks.yaml` or cause development to repeat unrelated work if precedence is not explicit.
- A counter updated only at run completion can be lost after interruption, allowing more subscription-consuming iterations than configured.
- Resetting counters after a human retry can accidentally remove limits for unrelated backward edges.
- Static cross-vendor lint may report a false pass when it cannot trace a diff or findings reference to its producing adapter.
- Parallel reviewers can finish asymmetrically. A failed sibling must not discard a completed review artifact or incorrectly run the verdict with incomplete findings.
- Deriving round numbers only from the successful-loop counter can overwrite artifacts from failed or aborted review attempts.
- Review findings are untrusted structured output. Ambiguous verdict parsing or silently defaulting a missing verdict could advance a bad diff.
- Hard-coded model or base-branch names may work in the development repository but fail for a cold-clone adopter using different subscription availability or repository conventions.
- The exhaustion gate may be accidentally bypassed by the global `--auto` behavior unless core gives exhausted loops stronger semantics than ordinary human gates.
