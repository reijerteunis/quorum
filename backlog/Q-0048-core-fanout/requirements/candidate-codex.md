# Q-0048 requirements — `core/fanout`: tasks, waves, worktrees and branches

Stage: draft · Iteration: 1 · Route: chore

Port authority: `harness/port-charter.md`, especially §2 and §6. The §6 register is normative if it differs from this document. Q-0048 ports `spike/src/fanout.js`, lifts nothing from `spike/bin/harness.js`, depends on Q-0041 and Q-0042, is depended on by Q-0053, and inherits invariant 19.

Surfaces touched: `packages/core` and its unit tests. This ticket does not change the `quorum` CLI, Studio, `harness/` file formats, or `backlog/` ticket format.

## Problem

The maintainer has already proved fan-out development in the spike, but the reusable core package does not yet contain the plumbing that reads small tasks, orders them into dependency waves, narrows retries, prepares task prompts, manages sibling branches and worktrees, commits agent changes, merges branches, and bounds project commands.

A loose rewrite is unsafe. The branch hierarchy is constrained by git ref storage, task descriptions are the established ownership channel, completed tasks must not be asked to invent more work on a retry, and a hung project command must stop after a bounded time. This port also crosses two known defects that must remain visible and unchanged until separately authorised.

## User story

As a **maintainer**, I want the proven fan-out plumbing available in `packages/core` with the spike’s observable behaviour preserved, so that Q-0053 can run many small tasks in dependency waves on isolated sibling branches without touching my working tree, redoing successful work, or waiting forever on a hung command.

## Acceptance criteria

1. **Module scope and TypeScript.** `packages/core` contains a strict TypeScript fan-out module exporting `loadTasks`, `waves`, `scopeToFailing`, `taskVars`, `taskPromptSection`, `branchExists`, `branchHead`, `resetBranchTo`, `commitAll`, `mergeInto`, `runCommand`, `ticketWorktree`, and `IntegrationError`. It uses no `any` and no unexplained `@ts-ignore`. The module is importable by the later in-package Q-0053 engine implementation. This criterion does not require changing the package-root `packages/core/src/index.ts` export surface.

2. **Direct task-file loading.** Given a ticket whose directory contains `solution/tasks.yaml`, `loadTasks` parses that file as YAML and returns its top-level `tasks` value. A missing or null `tasks` value returns an empty array. The function does not read `solution.md` when `tasks.yaml` exists, does not rewrite `tasks.yaml`, and adds no task schema validation or defaults beyond the existing empty-array fallback.

3. **Fallback task extraction and persistence.** When `solution/tasks.yaml` does not exist, `loadTasks` reads `solution/solution.md`, selects the first fenced `yaml` or `yml` block whose content contains a line beginning with `tasks:`, writes that block unchanged to `solution/tasks.yaml`, parses it, and returns its top-level `tasks` value or an empty array when that value is missing or null. This write is ticket artifact persistence in the engine-owned ticket directory; it is not a write from a flow’s code-writing worktree into the user’s working tree.

4. **Missing fallback errors.** When neither task file nor solution document exists, `loadTasks` throws `IntegrationError` with `no solution/tasks.yaml and no solution/solution.md`. When the solution document has no qualifying fenced YAML block, it throws `IntegrationError` with `solution.md has no \`\`\`yaml block with tasks:`. YAML parser and filesystem errors are not replaced with silent defaults.

5. **Dependency waves.** `waves(tasks)` returns ordered arrays in which every task appears exactly once and a task is placed in the earliest wave after all identifiers in its `depends_on` array have appeared in earlier waves. Missing or null `depends_on` is treated as empty. Tasks that are mutually independent remain together in one wave and preserve their input order; an empty task array returns an empty wave array.

6. **Unresolvable dependencies.** If no remaining task is ready because of a cycle or an unknown dependency identifier, `waves` throws `IntegrationError`. Its message is `dependency cycle or unknown depends_on among: <ids>`, where `<ids>` lists the remaining task identifiers in input order separated by `, `. It does not silently drop the dependency, reorder it into a runnable wave, or run part of the blocked remainder.

7. **Failing-task retry scope.** `scopeToFailing(tasks, failingIds)` retains only tasks whose `id` is in `failingIds`, preserves their input order and fields, and returns new task objects whose `depends_on` arrays contain only retained identifiers. A dependency outside the retry scope is removed because its task has already succeeded and been merged. The input tasks are not mutated. An empty failing set returns an empty array.

8. **Task variables.** `taskVars(task)` returns exactly the established variable mapping: `task.id` from `task.id`, `task.role` from `task.role`, `task.title` from `task.title`, and `role` from `task.role`. It performs no interpolation, normalization, validation, or branch construction.

9. **Task prompt heading and ownership channel.** `taskPromptSection(task, worktreeDir)` starts with the existing heading `# Task <id> (<role>): <title>`. Of the task’s free-form prose fields, it forwards only `description`, and only when present. It does not add acceptance criteria, implementation notes, ownership fields, or other task fields to the prompt. File ownership therefore continues to be stated inside `description`.

10. **Contract prompt sections.** For each path in `task.contracts`, in order, `taskPromptSection` adds a `## Contract: <path>` section. If the path exists relative to `worktreeDir`, the section contains the trimmed file contents in a plain fenced code block. If it does not exist, the section contains exactly `(file not found in worktree — treat as a blocker and say so in summary)`. Missing `contracts` is treated as empty. Contract paths are not resolved relative to the user’s working tree.

11. **Dependency prompt note.** When `task.depends_on` is non-empty, `taskPromptSection` appends `Depends on: <ids> (already merged into your base branch).`, with identifiers joined by `, `. It emits no dependency note for a missing or empty array. The complete prompt section retains the spike’s newline layout, verified by an exact-string unit test.

12. **Branch existence and head lookup.** `branchExists(repo, branch)` verifies `refs/heads/<branch>` and returns `true` only when git resolves it; git failures return `false`. `branchHead(repo, branch)` resolves the branch with `git rev-parse` and returns the full resulting SHA; git failures return `null`. Neither function checks out, creates, resets, fetches, or writes a branch.

13. **Branch reset in an existing worktree.** `resetBranchTo(repo, branch, sha)` derives the directory as `<repo>/<REPO_WORKTREE_ROOT>/<worktreeDirName(branch)>`, reusing the Q-0041 shared constant and function rather than duplicating `.harness/worktrees` or the slash replacement. When that directory exists, it runs a hard reset to `sha` in the worktree and then attempts to clean untracked files and directories. The produced path remains byte-for-byte equivalent to `<repo>/.harness/worktrees/<branch with every / replaced by __>`.

14. **Branch reset without a worktree.** When the derived worktree directory does not exist, `resetBranchTo` force-moves the local branch to `sha` from the repository and does not create a worktree. It preserves the known filesystem-only decision: it adds no check for a stale git worktree registration and no repair or pruning. A directory deleted by hand may therefore continue to leave the branch wedged; this preserved defect is reported in the implementation report and cited in source with `Why: preserved defect, see Q-0048 AC-14.`

15. **Backlog discard before commit.** `commitAll(dir, message, onDiscard)` first obtains the porcelain status limited to `backlog/`. If paths are reported, it attempts to restore tracked changes and remove untracked additions under `backlog/`, then calls `onDiscard` once with the reported paths after removing porcelain status prefixes. It never commits agent-authored `backlog/` changes. The callback remains optional, and the existing best-effort handling of status, checkout, clean, and callback preparation is preserved rather than tightened in this port.

16. **Commit behaviour.** After discarding `backlog/` changes, `commitAll` stages all remaining changes. If no staged path exists, it creates no commit and returns `null`. Otherwise it commits using author name `harness`, email `harness@local`, and the supplied message as an argv value, then returns the staged paths in git’s order. Commit messages containing shell metacharacters are handled as literal text and do not execute shell syntax.

17. **Successful merge.** `mergeInto(dir, branch)` merges `branch` into the branch checked out at `dir` using `--no-ff` and `--no-edit` with the local harness author identity. On success it returns `{ ok: true, conflicts: [] }` and does not alter the user’s working tree.

18. **Failed merge.** When the merge command fails, `mergeInto` collects unresolved paths with git’s `U` diff filter, attempts `git merge --abort`, and returns an object with `ok: false`, the conflict paths, and an `error` string limited to the final 500 characters of git stderr or the error message. It does not throw the merge failure, leave a deliberate partial merge in place, resolve conflicts, or silently report success.

19. **Bounded command success.** `runCommand(command, cwd, options)` runs the project-authored command in `cwd` with the inherited process environment, captured stdout and stderr, and ignored stdin. Its default timeout is exactly 900,000 ms. A successful command returns `{ code: 0, out: <stdout>, timedOut: false }`.

20. **Bounded command failure and timeout.** A non-zero command returns its status, concatenated stdout followed by stderr, and `timedOut: false`. A killed command, `SIGKILL`, or `ETIMEDOUT` is reported with `timedOut: true` and includes the effective `timeoutMs`; a missing status becomes code `1`. Supplying `options.timeoutMs` overrides the 15-minute default, preserving the value Q-0053 will obtain from `commands.timeout_ms`. A timeout is never converted into an ordinary expected test failure or retried by this module.

21. **Ticket integration worktree.** `ticketWorktree(repoDir, ticketBranch)` delegates to Q-0042’s `ensureWorktree(repoDir, ticketBranch, null)`. It therefore uses `.harness/worktrees/`, starts from `HEAD` on first creation under Q-0042’s contract, and never checks the integration branch out in or writes files into the user’s working tree.

22. **Load-bearing branch layout compatibility.** Unit or integration tests demonstrate that this module supports Q-0053 composing the integration branch as `harness/<ticket-id>/integration` and sibling branches as `harness/<ticket-id>/contracts`, `harness/<ticket-id>/tests`, and `harness/<ticket-id>/<task.id>`. No helper in this port shortens the integration branch to `harness/<ticket-id>` or changes the worktree root. Branch-name composition itself remains Q-0053’s scope.

23. **Preserved validation hazard.** The port adds no branch-name or task-id validation, normalization, escaping, or option guard. In particular, `taskVars` continues to expose an agent-authored `task.id`, while branch interpolation remains outside this ticket. This preserves the latent option-injection hazard reported by Q-0042: argv prevents shell injection but a raw git argument beginning with `-` can still be parsed as an option. Current callers keep it latent by prefixing names with `harness/<ticket-id>/`. The implementation report must name this preserved hazard, and the source must cite it with `Why: preserved defect, see Q-0048 AC-23.` Its absence is not a review blocker and fixing it under Q-0048 is a charter violation.

24. **Failed-run task branches remain intact.** No function in this port deletes, rewinds, or rolls back task branches as cleanup for a failed run. `resetBranchTo` remains an explicit primitive for its caller and does not discover or reset sibling task branches. The known gap that `finish()` does not roll back task branches is neither closed nor expanded by this ticket.

25. **Ported tests.** The module ships with deterministic Vitest coverage for AC-2 through AC-24 where the behaviour belongs to this module. Git behaviours use disposable repositories and verify both repository state and returned values. Timeout coverage uses a short explicit timeout rather than waiting for the 15-minute default. Tests do not edit or import implementation from `spike/**` as the subject under test.

26. **Dependency and source freeze.** Q-0041 and Q-0042 are landed and contained before implementation begins. No file under `spike/**` is edited or deleted. No new runtime dependency is added; the existing workspace dependencies and YAML library are sufficient.

27. **Cross-cutting product checks.** Verification records all of the following:

    - **BYOS:** n/a; this module has no adapter subscription or environment-key path, and no test, fixture, documentation, or example adds one.
    - **Worktree safety:** applicable and satisfied by AC-13, AC-14, AC-17, AC-18, AC-21, and AC-22; flow work remains under `.harness/worktrees/` and the user’s working tree is unchanged.
    - **Gate behaviour:** n/a; this module implements no gate or loop control.
    - **Files and schemas:** `solution/tasks.yaml` behaviour is preserved by AC-2 through AC-4; no task schema or file-format change is introduced.
    - **Lint and cross-vendor rules:** n/a; no flow linting, adapter choice, reviewing, or judging behaviour changes.
    - **Cold-clone impact:** none; no CLI invocation, setup step, configuration requirement, or README path changes.
    - **Explicit errors:** applicable to task loading, dependency resolution, merges, and commands as specified above; no new silent default is introduced.
    - **Product-agnostic:** no product-specific branch, prompt, test data, or behaviour is added.

28. **Quality gate.** `packages/core` typecheck, lint, and test commands pass, as does the workspace regression suite used by the repository. The implementation report identifies the source-to-port mapping, test evidence, the preserved AC-14 and AC-23 defects, and any newly discovered defect without fixing it.

## Non-goals

- Implementing the fan-out or integrate step types, iteration state, branch-name interpolation, failure selection, install sequencing, or human-gate routing; these belong to Q-0053 or later engine tickets.
- Changing the `tasks.yaml` shape, adding a task schema, validating task identifiers or dependency identifiers, or inventing missing task fields.
- Forwarding task fields beyond the existing heading, `description`, contract contents, and dependency note.
- Changing the sibling branch hierarchy or placing a branch at `harness/<ticket-id>`.
- Moving worktrees outside `.harness/worktrees/` or storing run history there.
- Repairing stale git worktree registrations when a directory was deleted by hand.
- Preventing git option injection through task identifiers or branch names.
- Rolling back, deleting, recreating, or otherwise cleaning task branches after a failed run.
- Changing command execution from its existing shell-command semantics, adding retries, streaming command output, or enforcing any budget cap.
- Porting another child’s module or logic held by `spike/bin/harness.js`.
- Editing or deleting anything under `spike/**`.
- Fixing any defect discovered while reading the spike; it is reported and separately authorised under charter §2.
- The cutover, the `quorum` binary, Studio behaviour, event-stream persistence, or public CLI rendering.
- Multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Should the fan-out module be exported from `packages/core/src/index.ts` in Q-0048?** Proposed answer: no. Q-0053 is an in-package consumer, and existing source tests pin the root index while the charter requires only that domain logic live in core. **Owner:** Q-0053 implementer to confirm before implementation. **Blocking:** no, unless Q-0053 is intentionally placed outside the package boundary.

2. **Which local TypeScript task shape should the module expose while preserving the unvalidated YAML boundary?** Proposed answer: define the minimum structural interfaces beside the fan-out module, with required fields used by the port and optional `description`, `contracts`, and `depends_on`; do not add a runtime schema. **Owner:** implementer. **Blocking:** no; this affects internal typing, not the file format or adapter contract.

3. **Who owns a future fix for task-branch rollback after a failed run?** No ticket currently owns it. Q-0048 must preserve the gap. **Owner:** Ruud. **Blocking:** no for this port; required before any deliberate behaviour change.

4. **Who owns hardening branch and task identifiers against git option injection and invalid ref names?** No ticket currently owns it. Q-0048 must report and preserve the hazard. **Owner:** Ruud. **Blocking:** no for this port; required before validation can be added.

## Risks

- **Branch hierarchy regression:** changing the integration branch to `harness/<ticket-id>` collides mechanically with sibling refs and breaks existing ticket folders. Exact branch-layout tests reduce this risk.
- **Retry scope regression:** retaining dependencies on successful tasks makes a failing-only retry appear cyclic; retaining successful tasks causes agents to invent unnecessary work. Focused `scopeToFailing` tests reduce this risk.
- **Prompt contract drift:** forwarding additional free-form fields would silently change the established ownership channel. Exact prompt tests reduce this risk.
- **Working-tree damage:** deriving a different directory or running reset/merge in the repository root could modify the maintainer’s checkout. Disposable-repository tests must assert both the worktree state and an unchanged user working tree.
- **False green after timeout:** treating a killed suite as an ordinary non-zero result could satisfy an expected-red check. Explicit `timedOut` tests reduce this risk.
- **Silent defect fixing:** branch validation or stale-registration repair may look like harmless hardening but would invalidate the behaviour-preserving port. AC-14 and AC-23 make preservation and reporting independently reviewable.
- **Over-broad backlog cleanup:** `commitAll` deliberately discards agent changes only under `backlog/`; widening that scope could destroy legitimate work. Repository-state tests must pin the boundary.
- **Platform sensitivity:** git error text and command termination details differ across operating systems. Tests should assert the module’s normalized return contract and stable message suffix behaviour without depending on unrelated full git diagnostics.
