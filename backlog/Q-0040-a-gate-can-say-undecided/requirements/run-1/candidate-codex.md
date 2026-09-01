# Q-0040 — A gate can say undecided

## Problem

A CLI flow can reach a gate for which no answer is available: scripted `--gate-answer` values may be exhausted while stdin is not interactive, or stdin may close while the question is being asked. The harness currently treats either condition as a failed run.

That classification rolls the ticket branch back to its position at the start of the run. As a result, integrated work that the run has already proven green is removed from the ticket branch even though no gate rejected it and no step failed.

A genuinely failed run must still roll back the ticket branch so that a later red-phase check is not run against an implementation already merged by an earlier attempt. The defect is therefore not rollback itself; it is applying failure behavior when a gate has no answer.

The lifecycle implementation also couples two separate decisions in one `if`/`else`: returning obtained worktrees and rolling back the ticket branch. An unanswered gate needs the combination that this shape cannot express: keep obtained worktrees and do not roll back the ticket branch.

Surfaces affected: CLI, `.quorum/` run history, the JavaScript spike, and `packages/core`. The Studio, `backlog/` file format, and `harness/` flow format are not changed.

## User story

As a **maintainer**, when a flow reaches a gate that cannot be answered, I want the run recorded as undecided without undoing the work already integrated or removing its worktrees, so that I can inspect the state and rerun the flow without mistaking the absence of a decision for failed work.

## Acceptance criteria

1. Before implementation code is committed, a new append-only entry in `docs/decisions/` defines the `undecided` run outcome and is added to `docs/DECISIONS.md`. The entry states that an unanswered gate is the absence of a decision, not an automatic gate answer, and explicitly defines the stage, branch, worktree, history, exhaustion-gate, rerun, and CLI-exit behavior required below. Its index date follows the repository's decision-date ordering rule.

2. Both the JavaScript spike and `packages/core` expose `undecided` as a run status wherever run statuses are defined, validated, serialized, or read. The two implementations use the same spelling and semantics.

3. A run finishes with status `undecided` when either of these conditions occurs while obtaining an answer for a gate:
   1. all supplied scripted gate answers have been consumed, stdin is not a TTY, and no answer is available; or
   2. stdin closes after the CLI has started asking the gate question but before it receives an answer.

4. Classification as `undecided` is limited to the two unanswered-gate conditions in AC-3. A malformed answer, rejected answer, adapter error, step error, setup error, run-history initialization error, branch collision, or other `FlowError` continues to use its existing outcome and error handling.

5. The setup catch that currently finishes a run as `failed` remains unchanged. In particular, failures before step execution, including run-history initialization failure and integration-branch collision refusal, are not classified as `undecided`.

6. When a run finishes as `undecided`, the ticket's stage remains exactly the stage recorded before that run began. No forward or backward stage transition is applied.

7. When a run finishes as `undecided`, the ticket branch is left at its current head. The harness does not call or reach branch-reset behavior for that outcome, including when the run started with a recorded branch head.

8. When a run finishes as `undecided`, every worktree obtained by that run remains present under `.harness/worktrees/`. The harness does not return or remove those worktrees as part of finishing the run.

9. The lifecycle code represents stage transition, worktree return, and ticket-branch rollback as independent decisions. It does not implement `undecided` by adding it to the existing `finished()` predicate or an equivalent single predicate that continues to couple worktree cleanup to branch rollback.

10. Existing lifecycle behavior is preserved for every pre-existing terminal status:
    1. `completed` and `regressed` retain their existing stage, branch, and worktree behavior;
    2. `failed` retains its existing stage, branch rollback, and worktree behavior; and
    3. no pre-existing status is renamed or reinterpreted.

11. `.quorum/` run history records an unanswered-gate run with status `undecided` using the existing run-history record rather than a new persistence mechanism. The record identifies the gate that lacked an answer and includes a clear reason distinguishing exhausted scripted answers from stdin closing mid-question.

12. The diagnostic printed by the CLI names the gate, states that no answer was recorded, states that the run is undecided, and does not say or imply that the gate was accepted, rejected, or automatically answered.

13. The CLI exits non-zero for an undecided run and uses exit code `2`. Existing genuine run failures retain their current exit code. A caller can therefore distinguish `undecided` from both success and failure using only the process exit code.

14. An undecided run is re-runnable through the existing command and start-of-run behavior. This ticket does not add continuation from the unanswered gate: a later invocation starts according to the existing rerun semantics while observing the branch and worktrees preserved by AC-7 and AC-8.

15. AC-3 applies equally to an ordinary gate and a non-auto exhaustion gate. Recording `undecided` does not synthesize an answer, traverse an outgoing edge, or weaken the requirement that a non-auto exhaustion gate receive an explicit human or scripted answer before the flow can proceed.

16. `auto` gates and `human-locked` gates retain their existing answer rules. This change does not make any gate automatic, permit a `human-locked` gate to be overridden, or change flow configuration.

17. Automated tests in both trees cover, at minimum:
    1. exhausted scripted answers with non-TTY stdin produce `undecided`;
    2. stdin closing mid-question produces `undecided`;
    3. an ordinary gate and a non-auto exhaustion gate both use that outcome;
    4. the ticket stage is unchanged;
    5. the ticket branch head is not reset;
    6. obtained worktrees are retained;
    7. run history contains the status, gate identity, and reason;
    8. the CLI exits with code `2`;
    9. a genuine step failure still rolls back the ticket branch and is not `undecided`;
    10. a setup failure remains `failed`; and
    11. `completed` and `regressed` retain their prior cleanup behavior.

18. Tests make their verdict from repository-controlled fixtures and values established by the test. They do not depend on the executing account's Git identity, pre-existing Git configuration, or a pre-existing gitignored directory.

19. The mock-adapter end-to-end regression suite remains green in both implementations after installing dependencies as required by `harness/rules.md`: `npm test --prefix spike` and `pnpm turbo run test --force` both pass.

20. Cross-cutting checks have these outcomes:
    1. **BYOS:** no subscription or adapter authentication path changes; no API-key path, fixture, or documentation example is introduced.
    2. **Worktree safety:** no flow writes to the user's working tree; preserved worktrees remain under `.harness/worktrees/`.
    3. **Gate behavior:** no answer is invented, and human-gated defaults and `human-locked` behavior are unchanged.
    4. **File format and schema:** no `harness/` flow or `backlog/` ticket schema changes; the existing run-history status schema is extended to accept `undecided` in both implementations.
    5. **Lint rules:** no lint-rule change is required; strict TypeScript and the existing deprecation rule pass for changed core files.
    6. **Cross-vendor rule:** not applicable because step authorship and judging are unchanged.
    7. **Product agnosticism:** diagnostics, tests, and documentation contain no product-specific behavior.
    8. **Cold-clone impact:** no new setup step, prompt, option, or required reading is added to the first-run path.

## Non-goals

- Resuming execution at the unanswered gate; that belongs to Q-0019.
- Adding a server, Studio control, callback, socket, or other new source from which a gate can be answered.
- Changing the `answerGate` callback delivered by Q-0050 beyond any type update strictly required to represent the new run status.
- Automatically accepting, rejecting, skipping, or timing out a gate.
- Changing which gates are `auto`, human-gated, or `human-locked`.
- Changing exhaustion-edge selection or permitting a non-auto exhaustion gate to proceed without an explicit answer.
- Changing rollback behavior for genuine failures.
- Returning or deleting preserved worktrees later through a new cleanup command.
- Changing ticket stages, flow YAML, ticket front matter, adapter contracts, trace formats, or cross-vendor rules.
- Adding Studio UI for displaying or acting on an undecided run.
- Multi-user behavior, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

None. The product decisions required for implementation are stated in the acceptance criteria and must be recorded in the decision entry required by AC-1 before implementation begins.

## Risks

- Splitting the existing lifecycle conditional can accidentally change cleanup or rollback behavior for `completed`, `regressed`, or `failed`; AC-10 and AC-17 require explicit regression coverage.
- Preserved worktrees may accumulate when maintainers repeatedly leave gates unanswered. Cleanup policy is intentionally outside this ticket and should be addressed separately if accumulation becomes material.
- A rerun may encounter preserved branch or worktree state through existing collision checks. This ticket preserves that state but does not introduce resume or reconciliation behavior, so the diagnostic must remain explicit.
- Adding a serialized status can break readers that assume a closed set of run statuses. All in-repository readers and validators in both trees must be located and updated together.
- Exit code `2` becomes part of the CLI contract. Future CLI error categorization must not reuse it for a condition that callers could confuse with an unanswered gate.
