# Q-0033 — Review flow surface: CLI, lint, config, shipped assets and docs

## Problem

Q-0006 implements the review engine, but a maintainer cannot use that capability until Quorum also ships the files and CLI behavior that people and flows touch. The repository currently lacks the usable review flow and reviewer role, review configuration defaults, complete static checks for bounded cross-flow review, safe non-interactive gate input, and documentation that describes the implemented behavior.

Without these surfaces, a malformed review flow can reach execution before failing, a non-interactive run can advance a gate without an explicit answer, and a cold-clone adopter must discover or author configuration that `harness init` should supply.

This ticket is the surface half of Q-0006 and depends on its engine behavior and frozen contracts. It touches the **CLI**, **`harness/`**, and product documentation. It does not add another execution model.

## User story

**Maintainer.** As a solo maintainer, I can run the shipped review flow and provide explicit gate answers from the CLI. Invalid loop bounds, cross-flow targets, and single-vendor panels are rejected before an agent runs or a ticket file changes.

**Adopter.** As a cold-clone adopter, `harness init` creates usable review configuration for my current Git branch, the shipped review assets require no manual authoring, and the README tells me how to run review without adding another setup step.

**Contributor.** As an adapter or flow contributor, I can copy the shipped review flow and reviewer role, lint them against deterministic rules, and use documentation that agrees with the flow schema and runtime contracts.

## Acceptance criteria

1. **Dependency boundary — all surfaces.** Q-0033 is implemented only after Q-0006’s runtime task is integrated. Q-0033 consumes the seven files under `contracts/Q-0006/` unchanged and does not modify them. Tests verify their contents remain identical to the Q-0006 integration-branch versions.

2. **Shipped review flow — `harness/`.** `harness/flows/review.yaml` parses to the same value as `contracts/Q-0006/review-flow.contract.yaml` after removal of the loader-only `file` property. It declares `green` as its consumed stage, `reviewed` as its produced stage, and `cross_vendor: required`.

3. **Template flow parity — `harness/`.** `spike/templates/harness/flows/review.yaml` exists and is byte-identical to `harness/flows/review.yaml`. The existing parity check across shipped flow files remains green.

4. **Review panel — `harness/`.** The flow contains one parallel group with two `code-reviewer` steps: one using the `claude` adapter and one using the `codex` adapter. They write separate round-specific artifacts and receive the merged requirement, solution, and `{base}...harness/{id}/integration` diff.

5. **Verdict and bounded edge — `harness/`.** The flow’s verdict step reads the two named panel artifacts plus the merged requirement and solution, writes both the round-specific verdict and `review/verdict.md`, and uses `goto: flow:development`, `counter: review`, `max_iterations: 3`, and `on_exhausted: gate`. It uses only step fields supported by Q-0006.

6. **Verdict threshold — `harness/`.** The verdict instructions require deduplication, `file:line` citations, and classification as `blocker`, `major`, or `nit`. Nits alone produce `approve`; any surviving blocker or major produces `changes-requested`. The verdict judges the panel artifacts and does not receive the code diff.

7. **Shipped reviewer role — `harness/`.** `harness/roles/code-reviewer.md` satisfies `contracts/Q-0006/code-reviewer-role.contract.md`: it is read-only, does not rewrite code, uses the three required severity values, and requires a `file:line` citation for every finding. It contains neither a model nor an adapter in its frontmatter.

8. **Template role parity — `harness/`.** `spike/templates/harness/roles/code-reviewer.md` exists and is byte-identical to `harness/roles/code-reviewer.md`. The shipped-template test confirming that no Codex model is pinned remains green.

9. **Repository configuration — `harness/`.** `harness/harness.yaml` supports `repo.base_branch` as a string and `repo.max_diff_bytes` as a positive integer. When absent, runtime resolution remains `main` and `200000`, as defined by the Q-0006 runtime contract.

10. **Template configuration — `harness/`.** `spike/templates/harness/harness.yaml` contains `repo.base_branch: main` and `repo.max_diff_bytes: 200000`. Existing unrelated configuration remains unchanged.

11. **Init inside Git — CLI.** When Git identifies the current branch, `harness init` writes that branch as `repo.base_branch` and writes `200000` as `repo.max_diff_bytes`. An automated test covers a repository whose current branch is not `main`.

12. **Init fallback — CLI.** Outside a Git repository, or on an unborn branch whose name Git cannot identify, `harness init` succeeds and retains `main` as `repo.base_branch`. It does not emit a misleading Git failure.

13. **Shared preflight — CLI.** `harness lint` and `harness run` load and validate the complete flow directory from disk using the same rules. Run preflight occurs before adapter overrides, the first adapter invocation, and any ticket-folder write. The same invalid fixture produces the same diagnostic through both commands.

14. **Cross-flow target resolution — CLI.** Lint rejects every `goto: flow:<target>` whose target file is missing or cannot be loaded. The error names the source flow, target flow, and current stage.

15. **Return-chain validation — CLI.** Starting at the target flow’s `produces` stage, lint follows matching flow consumers until it reaches the source flow’s `consumes` stage. It terminates by tracking `(flow, stage)` pairs and rejects a reached dead end, reached-stage ambiguity, or cycle. Diagnostics name the source flow, target flow, terminal stage, and implicated flows where applicable. Ambiguity on an unreached stage remains valid.

16. **Return-chain fixtures — CLI.** Automated tests accept `review → development` and `review → qa-red`. Temporary harness fixtures separately cover a missing target, dead end, reached-stage ambiguity, cycle, and self-targeting review flow; these fixtures do not alter shipped flows.

17. **Bound validation — CLI.** Every `on_fail` requires `max_iterations` to be an integer greater than zero. Lint rejects a missing value, zero, a negative number, a fractional number, and a non-number, naming the affected step and `max_iterations` field.

18. **Counter validation — CLI.** An `on_fail.counter` value must be a non-empty, unprefixed key. Lint rejects `iterations.review` and suggests `review` in the diagnostic.

19. **Cross-vendor panel validation — CLI.** In a flow declaring `cross_vendor: required`, every parallel group with two or more steps sharing one role must span at least two adapters. A single-adapter failure names all affected step IDs and the shared adapter. A later verdict step consuming artifacts from both adapters remains valid.

20. **Explicit gate flags — CLI.** `harness run` accepts repeatable `--gate-answer advance|retry|abort` flags and consumes them once, in encounter order. Tests demonstrate that two gates in one run can receive different answers.

21. **No silent or blocking gate answer — CLI.** After explicit answers are exhausted, a run may read an answer from an interactive terminal. On non-interactive stdin, or for an absent, empty, or invalid answer, it exits non-zero with an error naming the gate. It neither blocks nor selects `advance` implicitly.

22. **Exhaustion gate protection — CLI.** The Q-0006 exhaustion gate cannot be answered by `--auto`. An explicit `advance`, `retry`, or `abort` remains required, and the selected behavior follows the reconciled Q-0006 runtime contract identified in Open question 1.

23. **Board compatibility — CLI.** `harness board` displays the persisted `iterations.review` value through its existing iteration output and counts an exhaustion presentation’s zero-cost event plus its later terminal event without double-counting run cost.

24. **Documentation alignment — documentation.** `docs/02-sdlc-pipeline-spec.md` describes the shipped flow fields, derived cross-flow regression, three-dot diff range, `{round}`, unprefixed `counter: review`, configured base branch, diff-size limit, and exhaustion behavior. It contains no unsupported judge, structured-input, task-output, or `on_fail.with` examples for this flow.

25. **Decision and vocabulary records — documentation.** `docs/DECISIONS.md` receives append-only entries for derived regression and exhaustion gates not being bypassed by `--auto`. `docs/GLOSSARY.md` keeps **role** as the term covering `code-reviewer` and extends **gate** to describe exhaustion gates; no synonym for an existing domain term is introduced.

26. **Cold-clone documentation — documentation.** README includes `harness run review <id>` in the normal path and adds no manual review-flow authoring, subscription setup, or configuration step. It explains where to change `repo.base_branch` when the configured ref is wrong.

27. **Plan and source correction — documentation.** `docs/06-development-plan.md` updates the M1 completion condition to include the shipped review surface. The Q-0006 ticket body and affected state diagram agree that regression lands on the target flow’s configured `consumes` stage rather than a hard-coded stage.

28. **Regression coverage — CLI and `harness/`.** The mock-adapter end-to-end suite remains green and adds deterministic coverage for all lint failures, init branch discovery and fallback, ordered explicit gate answers, missing non-interactive answers, `--auto` exhaustion protection, board iteration display, and designated asset parity. No new dependency is added.

29. **BYOS — all surfaces.** The implementation, fixtures, and documentation add no subscription-secret input or alternate adapter-authentication path. Existing environment refusal tests remain green.

30. **Safety and persistence — all surfaces.** Q-0033 adds no flow write to the user’s working tree, no review worktree or branch creation, and no persistent state outside `harness/`, `backlog/`, or `.quorum/`. Lint failures cause no ticket or runtime-state write.

31. **Product scope — all surfaces.** Shipped assets, diagnostics, fixtures, and documentation remain product-agnostic and vendor-neutral except for the adapter names required to demonstrate the cross-vendor panel.

## Non-goals

- Implementing Q-0006 engine behavior: round calculation, diff materialisation, verdict validation, counter mutation, regression, exhaustion routing, audit history, failure containment, or rework synchronization.
- Changing any file under `contracts/Q-0006/`.
- Adding a lighter fix flow, scoped rework, review-generated tasks, or a cross-flow payload mechanism.
- Automatically starting the target flow after regression.
- Statically identifying which vendor produced individual integrated diff hunks.
- Adding budget enforcement or changing the meaning of existing budget configuration.
- Adding line-level review comments, pull-request creation, or a remote service integration.
- Building `qa-final.yaml`, `deploy.yaml`, Studio UI, a visual flow canvas, multi-user behavior, cloud sync, a remote daemon, a plugin marketplace, eval suites, another adapter, or a desktop shell.
- Running paid real-adapter evidence inside automated tests or development fan-out.
- Rewriting existing ticket history or migrating legacy entries.
- Adding a general JSON Schema validation dependency.

## Open questions

1. **Blocker — retry counter value. Owner: Q-0006 owner.** `contracts/Q-0006/review-runtime.contract.md` says an exhaustion `retry` persists `max_iterations - 1` (`2` for the shipped limit), while Q-0006’s merged solution text says it persists `max_iterations` (`3`). Which behavior has actually landed in Q-0006? Because this ticket must consume the frozen contract unchanged, Q-0006 must reconcile its solution and implementation before AC 22 and the CLI tests can have one expected result.

2. **Non-blocker — Q-0006 integration reference. Owner: maintainer.** Which commit or integration-branch state is the immutable baseline for the contract-integrity assertion in AC 1? Record that reference before QA-red is generated so different tasks do not compare against different snapshots.

## Risks

- **Shared engine file overlap.** Lint may require edits in the same engine module changed by Q-0006 runtime work. Starting before Q-0006 is integrated can produce behavior drift or merge conflicts. The dependency and serial task order mitigate this.
- **Contract and solution drift.** The retry inconsistency shows that prose and a frozen contract currently disagree. Resolving it implicitly would make CLI behavior untestable against a single authority.
- **Lint non-termination.** A cross-flow cycle can hang lint unless the implementation tracks visited `(flow, stage)` pairs. Cycle and self-target fixtures are required.
- **False ambiguity failures.** Treating every multi-consumer stage as invalid would reject unrelated valid flows. Only stages reached by the checked return chain are in scope.
- **Validation after mutation.** If run preflight occurs after adapter overrides, ticket creation, or adapter invocation, malformed flows can spend a subscription or leave partial state. Tests must assert zero calls and zero writes.
- **Branch discovery portability.** Git behavior differs for detached heads, unborn branches, and non-repositories. The required fallback must remain deterministic and must not lengthen cold-clone setup.
- **Gate answer reuse.** Applying one CLI answer to every gate can accidentally advance a later gate. Answers must be ordered and consumed exactly once.
- **Documentation drift.** The existing specification contains fields and diff examples the engine does not support. Partial documentation edits could leave contributors copying an invalid flow.
- **Template drift.** Editing only repository assets or only template assets makes cold-clone behavior differ from repository tests. Byte-parity assertions cover the designated flow and role copies.
