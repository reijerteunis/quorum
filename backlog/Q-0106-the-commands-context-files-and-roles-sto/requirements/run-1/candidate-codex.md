# Q-0106 — The commands, context files and roles stop naming the spike

## Problem

Quorum now runs from the pnpm workspace, but the canonical harness configuration and runtime context still describe two dependency sets, two test suites, and a live `spike/` tree. The three active developer role files still grant write access to spike paths, and the generalist role scaffolded by `quorum init` grants adopters access to a directory their projects do not have.

These files affect more than repository documentation. `harness/harness.yaml` supplies the commands used by an integrate step. `harness/rules.md` and `harness/architecture.md` are supplied to future steps as runtime context. Role frontmatter and prose define the paths agents are told they may write. Leaving these surfaces stale causes future runs to install and test the wrong tree or to act under contradictory ownership instructions.

This ticket is Child A of the Q-0103 cutover and must run before Q-0107 and Q-0103. Its own integrate step receives the configuration loaded at the start of the run, so it will execute the old commands. The first real proof of the new commands is therefore Q-0107’s integrate step. Nothing under `spike/` may be deleted by this ticket.

Surfaces touched: the repository’s `harness/` configuration, context, and role files, plus the `packages/cli` template used by the CLI’s `quorum init` command.

## User stories

As the `maintainer`, I want the canonical harness commands and runtime context to describe the pnpm workspace alone, so future runs install and execute the suite that remains after the cutover.

As the `contributor`, I want the architecture context and developer roles to describe the repository’s current package ownership, so I can assign work without relying on a retired tree.

As the `adopter`, I want `quorum init` to scaffold a generalist role without a `spike` write path, so the generated harness describes directories that can exist in my project.

## Acceptance criteria

1. **AC-1 — Production behaviour remains unchanged.** The ticket changes no file under `packages/*/src` other than test files. In particular, it introduces no behavioural production-source change. A comparison of the ticket’s base and tip using `git diff --name-only <base>...<tip> -- 'packages/*/src/**'` lists only `*.test.ts` paths, if any. If completing this ticket appears to require another production-source change, implementation stops and reports that dependency at the gate.

2. **AC-2 — Integrate commands use only the workspace.** In `harness/harness.yaml`, `commands.install` is exactly `pnpm install --frozen-lockfile` and `commands.test` is exactly `pnpm turbo run test --force --continue`. Neither command contains an `npm` command, a `--prefix spike` argument, or another invocation of the spike suite. `commands.timeout_ms` remains `900000`; `--force` and `--continue` remain present with their existing Q-0065 and Q-0050 reasons. The shipped configuration is covered by `packages/core/src/test-command.test.ts`, and the existing Q-0065 command assertion is re-aimed to the workspace command rather than deleted.

3. **AC-3 — Harness configuration describes one suite.** The header of `harness/harness.yaml` no longer calls the configuration “(spike)”. Its command comments no longer state that the spike is the runnable code or that the repository has two dependency sets or two suites. No other sentence in that file claims that an integrate step must install or run two suites. Comments that explain `timeout_ms`, `--force`, and `--continue` remain accurate.

4. **AC-4 — Engineering rules instruct agents to run one suite.** In `harness/rules.md`, the fresh-worktree instruction names only `pnpm install --frozen-lockfile` and `pnpm turbo run test --force`. It does not instruct an agent to create `spike/node_modules`, install dependencies under `spike/`, or run the spike suite. The citation of `spike/src/engine.js:1034` is replaced by the corresponding `packages/core` location. The ESLint description no longer contains a special `spike/` scope or unlinted-tree clause. No criterion requires editing `.claude/rules/`, which is a derived vendor copy rather than a surface of this ticket.

5. **AC-5 — Architecture context no longer treats the spike as live.** In `harness/architecture.md`:

   - the `generalist`, `backend`, and `tooling` rows remove every path under `spike/`;
   - the explanation of the machine-checked role-table column points to the workspace counterpart delivered by Q-0103 AC-18 rather than `spike/test/smoke.js`;
   - the spike ownership statement, port-freeze paragraph, and statement assigning `spike/test/**` to qa-red are removed;
   - the template-sharing description identifies `packages/cli/templates/harness/` as the counterpart of `harness/flows/`; and
   - the resulting document contains no statement that presents `spike/` as a current repository tree, test suite, template source, ownership boundary, or independent witness.

   Historical decision documents are not part of this criterion.

6. **AC-6 — Developer roles stop granting spike paths.** The three repository role files `harness/roles/developer-generalist.md`, `harness/roles/developer-backend.md`, and `harness/roles/developer-tooling.md`, plus `packages/cli/templates/harness/roles/developer-generalist.md`, remove `spike` paths from both their `paths:` frontmatter and their allowed-path or freeze prose. No file under `harness/roles/` or `packages/cli/templates/harness/roles/` contains the token `spike`. The repository and template versions of `developer-generalist` add `README.md`, `eslint.config.js`, and `vitest.shared.js` to their `paths:` frontmatter and allowed-path prose. `CLAUDE.md` is not added because it is a derived vendor dialect maintained by the human. The role paths and the third column of the role table in `harness/architecture.md` agree.

7. **AC-7 — The tooling role owns the CLI package.** `harness/roles/developer-tooling.md` adds `packages/cli` to both its `paths:` frontmatter and its allowed-path prose. The tooling row in `harness/architecture.md` also includes `packages/cli`. After removal of the spike paths, the tooling role’s path list is `[packages/core, packages/shared, packages/cli]`, while the backend role’s path list is `[packages/core, packages/shared, harness, docs, backlog]`. The two roles remain separate and retain their existing adapter assignments.

## Non-goals

- Deleting, moving, or modifying anything under `spike/`. Q-0103 owns deletion, after Q-0107.
- Retiring or re-aiming the 25 files under `packages/**` that depend on or refer to the spike. Q-0107 owns that work.
- Proving the new `commands.install` and `commands.test` during this ticket’s own integrate step. The run uses the configuration loaded before this ticket changes it.
- Changing flow definitions, gates, adapter assignments, the cross-vendor rule, worktree containment, integration branches, or run-history formats.
- Merging the backend and tooling roles.
- Editing `.claude/rules/`, `CLAUDE.md`, or any file under `docs/decisions/`.
- Adding dependencies, changing package scripts, changing a schema or file format, or changing product behaviour.
- Supporting registry-resolved `npx quorum`.
- Fixing Q-0039 or allowing these three cutover children to run concurrently.
- Any item on the v1 exclusion list, including multi-user operation, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

- **OQ-1 — Should the backend and tooling roles remain separate after the cutover?** This is non-blocking and does not change this ticket. AC-7 keeps the roles distinct and preserves their cross-vendor assignments. Owner: the human at a later ticket gate.

There are no open questions that block implementation of Q-0106.

## Risks

- **The new commands are not exercised by this ticket.** `runFlow` retains the configuration loaded at run start, so Q-0106’s integrate step executes the old commands. Mitigation: Q-0106 is not considered proven until Q-0107 completes a real integrate step using `pnpm install --frozen-lockfile` and `pnpm turbo run test --force --continue`. Q-0103 must not launch before that result is green.

- **The cutover order can corrupt concurrent runs.** Until Q-0039 is fixed, concurrent runs on one ticket can share a worktree and compute the same run id. Mitigation: run Q-0106, Q-0107, and Q-0103 sequentially in that order.

- **Incorrect context propagates into future work.** Every later step can receive `harness/rules.md` and `harness/architecture.md`. A stale ownership or test instruction would therefore affect requirements and implementations after this ticket. Mitigation: AC-4 through AC-7 require agreement among command instructions, role files, and the architecture role table.

- **Role frontmatter and prose can drift.** The engine communicates allowed paths through role prose, while tooling can inspect frontmatter and the architecture table. Mitigation: AC-6 and AC-7 require all three representations to agree; Q-0103 AC-18 owns the durable workspace test replacing the spike check.

- **A hidden production dependency may surface.** If these configuration changes require a behavioural change under `packages/*/src`, the premise that Child A is configuration-only is false. Mitigation: AC-1 requires implementation to stop and report the dependency rather than expanding scope.

## Cross-cutting checks

- **BYOS:** Not affected. No subscription-login or refusal behaviour changes, and no credential path, fixture, or example is added.
- **Worktree safety:** Not affected. The flow continues to write only in its worktree; no containment or integration-branch behaviour changes.
- **Gate behaviour:** Not affected. No gate definition or default changes. The successful Q-0107 integrate step is an exit condition for the ordered cutover, not a new gate type.
- **Files and schemas:** Existing YAML frontmatter path values and Markdown prose change; no file format or schema changes.
- **Lint rules:** No lint configuration changes. `harness/rules.md` only stops describing the spike as an ESLint exception.
- **Cross-vendor rule:** Unchanged. The backend and tooling roles retain their existing adapters.
- **Product-agnostic:** Preserved. No SaaS-specific behaviour or example is introduced.
- **Cold-clone impact:** Positive. The scaffolded generalist role no longer names a directory absent from an adopter’s project. This ticket makes no public-registry installation claim.
