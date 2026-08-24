# Q-0008 — Monorepo scaffold and CI

## Problem

Quorum’s executable code currently lives in `spike/` as plain Node ESM with a hand-written test runner. M1 is closed, and repository rules prohibit extending the spike beyond M0/M1 needs. The typed package structure required for M2 does not yet exist, so Q-0009 has nowhere to port engine code and Q-0010 has nowhere to implement the `quorum` binary.

This ticket creates the empty development shell defined in `docs/04-architecture.md`: a pnpm and Turborepo workspace, strict TypeScript configuration, Vitest, shared ESLint configuration, and GitHub Actions CI. It carries no engine or product behavior.

Surfaces touched:

- **CLI (`quorum`):** an empty `packages/cli` boundary only; no command or executable is implemented.
- **Studio:** an empty Vite-based `apps/web` boundary only; no UI is implemented.
- **`harness/`:** no flow, rule, role, or context behavior changes.
- **`backlog/`:** no ticket format or runtime behavior changes.
- **Developer infrastructure:** root workspace configuration, package scaffolds, shared tooling, lockfile, and CI are added.

Q-0008 follows the requirements → chore → human gates flow. It does not require contracts or a red phase.

## User story

As a **solo maintainer**, I want one reproducible root command for linting, typechecking, and testing every M2 package so that subsequent engine and CLI work starts inside enforced package boundaries.

As an **adapter contributor**, I want every package to inherit the same strict TypeScript and lint rules so that contributions receive consistent local and CI feedback regardless of which package they change.

As a **cold-clone adopter**, I want the existing spike regression suite to remain operational while M2 is built so that the repository does not lose its currently working behavior during the migration.

## Acceptance criteria

1. **Reproducible workspace installation.** From the repository root, `pnpm install --frozen-lockfile` succeeds on Node 22 using the pnpm version pinned by the root `packageManager` field. The committed `pnpm-lock.yaml` requires no modification, the root `package.json` declares `engines.node` as `>=22`, `.nvmrc` selects Node 22, and `pnpm-workspace.yaml` includes `packages/*` and `apps/*`.

2. **Exact empty package boundaries.** Running `pnpm verify:scaffold` succeeds only when these seven workspace directories exist: `packages/core`, `packages/server`, `packages/cli`, `packages/compiler`, `packages/templates`, `packages/shared`, and `apps/web`. Each contains a `package.json`, a `tsconfig.json` extending the root `tsconfig.base.json`, a placeholder `src/index.ts`, and exactly one passing placeholder test. The check fails if another directory under `packages/` or `apps/` is registered as a workspace package. Package names are unique and use one consistent repository namespace.

3. **Strict shared TypeScript configuration.** Running `pnpm typecheck` from the root succeeds through Turborepo for all seven workspaces. The root `tsconfig.base.json` enables `strict`, prohibits emitted build output during typechecking, targets a Node 22-compatible runtime, and is the only source of shared compiler rules; no package weakens strictness or introduces `any` or an unexplained `@ts-ignore`.

4. **One lint configuration.** Running `pnpm lint` from the root succeeds through Turborepo for all seven workspaces using one root ESLint flat configuration. No workspace contains its own ESLint configuration or overrides the root lint rules.

5. **Vitest placeholders.** Running `pnpm test` from the root succeeds through Turborepo, invokes Vitest in every workspace, and reports one passing placeholder test from each of the seven workspaces. Tests run once and exit rather than entering watch mode.

6. **Turborepo task definition.** Running `pnpm turbo run lint typecheck test` succeeds. The committed Turbo configuration defines all three tasks, permits cache reuse for each task, and does not require a remote cache, account, or secret.

7. **Spike regression remains intact.** Running `npm --prefix spike test` succeeds with the existing 30-check smoke suite. Files under `spike/`, including its package manifest, tests, runner, dependencies, and Node engine declaration, are unchanged by this ticket, and the smoke suite is not copied into a workspace package.

8. **Web remains a placeholder.** Running `pnpm --filter ./apps/web test` succeeds for the single placeholder test. `apps/web` identifies Vite as its development/build tool, but contains no React application, route, screen, product behavior, persistence, or bundler customization beyond the minimum Vite placeholder needed to establish the package boundary.

9. **CI enforces the root checks.** Running `pnpm verify:ci` validates that exactly one GitHub Actions workflow introduced for this scaffold runs on both `push` and `pull_request`, uses one Node 22 version, enables pnpm caching and Turborepo’s local `.turbo` cache, installs with `pnpm install --frozen-lockfile`, and then runs root lint, typecheck, and test tasks through Turborepo. The workflow does not require repository secrets and does not add release, publishing, deployment, or dependency-update automation.

## Non-goals

- Porting any engine, adapter, smoke-test, backlog, flow, compiler, server, or CLI behavior from `spike/`; that begins in Q-0009 and Q-0010.
- Implementing a `quorum` executable or changing the existing spike executable.
- Implementing the Studio or making a React, routing, styling, state-management, or production web-build decision. Vite is only a placeholder boundary in this ticket.
- Adding inter-package domain APIs, schemas, event formats, dependencies, or runtime behavior.
- Publishing packages or creating release, changeset, versioning, or deployment automation.
- Adding Docker, Renovate, Dependabot, Playwright, adapter probes, coverage thresholds, or a real-CLI CI run.
- Rewriting the README or changing architecture, development-plan, glossary, decision, harness, or ticket formats.
- Adding support for multiple Node versions or guaranteeing native Windows support beyond the existing WSL position.
- Adding any subscription-handling path or environment-variable handling.
- Creating Q-0004, Q-0005, or Q-0007, or changing Q-0008’s chore flow.

## Open questions

1. **What repository namespace should the seven package names use?** Owner: maintainer. Blocker: yes, because package names become references in later tickets. Proposed default if no namespace is already documented: private names under `@quorum/*`, with `apps/web` named consistently within that namespace.

2. **Should CI execute `npm --prefix spike test` in addition to the new workspace tests?** Owner: maintainer. Blocker: no for creating the scaffold, but it must be decided before the CI change is accepted. Acceptance criterion 7 requires the command to remain green locally; the stated CI scope currently requires only Turbo lint, typecheck, and test.

## Cross-cutting check

- **BYOS:** Not applicable to scaffold behavior. No subscription or environment-variable path is added, and CI requires no secrets.
- **Worktree safety:** Not applicable. No flow or file-writing runtime behavior is introduced.
- **Gate behavior:** Not applicable to product behavior. Delivery uses the decided chore flow with human gates.
- **Files and schemas:** Workspace configuration, package manifests, lockfile, source placeholders, tests, and CI remain repository files. No persistent product file or schema is introduced.
- **Lint rules:** Applicable. One root flat configuration covers every workspace without per-package divergence.
- **Cross-vendor rule:** Not applicable. No reviewing or judging step is added or changed.
- **Product agnosticism:** Applicable. Placeholder code and tests contain no product-specific SaaS behavior or examples.
- **Cold-clone impact:** The ticket adds a Node 22 and pnpm prerequisite for M2 development. It does not change the current product launch path or README, and preserves the spike’s working regression command.
- **Explicit errors:** Tool commands and CI must fail with non-zero status when installation, linting, typechecking, testing, scaffold validation, or CI validation fails; no check may silently skip a workspace.

## Risks

- Placeholder files may accumulate real engine or UI behavior, obscuring ownership between Q-0008, Q-0009, and Q-0010. The exact-boundary and placeholder-only checks limit this risk.
- A package may appear in the filesystem but be omitted from Turbo execution. Root tasks and the scaffold verification must account for all seven workspaces.
- Independent package configuration may drift from the root over time. This ticket prevents initial TypeScript and ESLint divergence but does not add a general configuration-governance system.
- CI cache configuration may accidentally depend on unavailable secrets or remote infrastructure. The required cache is local/action-level and must work without secrets.
- The existing spike may fail under Node 22 even though its manifest currently permits Node 20 or newer. Q-0008 must surface that incompatibility without changing spike files or porting its code.
- Broad dependency additions could turn an empty scaffold into premature architecture. Dependencies must be limited to the workspace, TypeScript, Vitest, ESLint, Turborepo, Node typing, and the minimum Vite placeholder needed by `apps/web`; each new dependency requires a one-line justification in the solution document.
