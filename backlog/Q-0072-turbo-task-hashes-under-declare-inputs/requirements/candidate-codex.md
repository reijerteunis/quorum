# Q-0072 — Turbo's task hashes under-declare their inputs

## Problem

Surface: repository build configuration, the CLI commands `pnpm lint`, `pnpm typecheck` and `pnpm test`, and CI. The Quorum product CLI, Studio, `harness/` file format and `backlog/` file format are not changed.

A maintainer cannot trust a local Turbo cache hit. Turbo 2.10.11 currently hashes files inside the package running a task, plus four workspace-wide files, but the workspace tests read files elsewhere in the repository. The `@quorum/core` package also compiles and lints source exported directly by `@quorum/shared`, while Turbo has no dependency edge between their tasks.

As measured on 2026-08-28, `@quorum/shared#test` hashes 24 package-relative files and `@quorum/core#test` hashes 56. Changes to asserted repository files, including `docs/GLOSSARY.md` and `harness/harness.yaml`, leave both hashes unchanged. A change to `packages/shared/src/constants.ts` changes the shared test hash but leaves the core test hash unchanged. A cached pass can therefore hide a failing corpus assertion or a new cross-package lint, typecheck or test failure.

Turbo 2.10.11 accepts package task inputs that escape the package with `../` globs in a dry run. That has not yet been proved through a real cache write and restore, or on CI's Linux checkout. This ticket must establish that evidence before trusting the configuration.

CI currently avoids this defect by forcing every workspace task. It invokes Turbo directly rather than invoking the root `package.json` scripts, however, so CI and the commands developers run can drift without detection.

After this ticket, a cache hit must mean: **no file or environment value read by this task, and no same-kind task in a package it depends on, has changed since the cached successful result.** It must no longer mean only that files inside the task's own package have not changed.

## User story

As a **solo maintainer**, I want local lint, typecheck and test cache hits to include every repository input those tasks depend on, so that a cached success is evidence about the current tree rather than a replay from an incomplete hash.

## Acceptance criteria

1. **Record the decision before implementation.** Ruud appends the decision entry named in Open question 1 to `docs/DECISIONS.md` before implementation begins. The entry is dated and contains the required **Decision**, **Alternatives considered** and **Why** sections. It states the cache-hit meaning quoted in the Problem and records both consequences of the chosen design: package test tasks receive out-of-package inputs, and same-kind dependency edges change task ordering as well as hashes.

2. **Preserve Turbo's default package inputs.** In `turbo.json`, every explicit `inputs` array introduced by this ticket starts with `"$TURBO_DEFAULT$"`. A dry run after the change still includes every package-relative input present in the 2026-08-28 baseline: 24 for `@quorum/shared#test` and 56 for `@quorum/core#test`, before counting newly declared out-of-package inputs. The implementation must not replace the default set with a hand-maintained list.

3. **Hash every out-of-package file read by the shared test suite.** `@quorum/shared#test` includes package-relative escaping inputs covering all current reads outside `packages/shared`, including:

   - `docs/02-sdlc-pipeline-spec.md`, `docs/03-adapter-contract.md`, `docs/04-architecture.md`, `docs/DECISIONS.md` and `docs/GLOSSARY.md`;
   - `harness/harness.yaml`;
   - `spike/src/**`, `spike/bin/harness.js` and `spike/templates/harness/harness.yaml`; and
   - the files under `packages/core` read by shared's corpus assertions.

   The implementation derives the final list from the test code in the implementation revision, not solely from this requirement's examples. A repository-level regression test fails if any current shared-suite read outside `packages/shared` is absent from the task's effective Turbo inputs. Unrelated directories are not added merely for future convenience.

4. **Hash every out-of-package file read by the core test suite.** `@quorum/core#test` includes package-relative escaping inputs covering all current reads outside `packages/core`, including:

   - `docs/03-adapter-contract.md` and `docs/04-architecture.md`;
   - `turbo.json` and `.github/workflows/ci.yml`;
   - `contracts/Q-0006/**` and `contracts/Q-0011/**`;
   - `backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md`;
   - `pnpm-lock.yaml`;
   - `spike/src/**`; and
   - the files under `packages/shared` read by core's corpus assertions.

   The implementation derives the final list from the test code in the implementation revision, not solely from this requirement's examples. A repository-level regression test fails if any current core-suite read outside `packages/core` is absent from the task's effective Turbo inputs. Unrelated `contracts/`, `backlog/` or `docs/` content is not included unless the suite reads it.

5. **Limit corpus invalidation to tests.** Out-of-package documentation, harness, spike, contract, backlog and CI corpus inputs are declared for `test`; they are not added to `lint` or `typecheck` and are not added to `globalDependencies`. As a result, changing an asserted documentation file invalidates the affected package test task but does not invalidate an otherwise unaffected lint or typecheck task.

6. **Add same-kind workspace dependency edges.** The Turbo definitions have these dependencies:

   - `lint` depends on `^lint`;
   - `typecheck` depends on `^typecheck`; and
   - `test` depends on `^test`.

   A dry run for the workspace shows the corresponding shared task as a dependency of the core task for each task kind. No cross-kind edge is introduced.

7. **Invalidate core when shared changes.** Starting from a clean tree and stable environment, changing a tracked source file under `packages/shared/src/` changes the effective hash of `@quorum/core#lint`, `@quorum/core#typecheck` and `@quorum/core#test`. The shared task of the same kind completes before the core task starts. Reverting the file restores the original tree.

8. **Invalidate each corpus-reading test precisely.** Automated regression coverage proves at least these independent cases using Turbo's reported task hashes:

   - changing `harness/harness.yaml` changes `@quorum/shared#test`'s hash;
   - changing `docs/GLOSSARY.md` changes `@quorum/shared#test`'s hash;
   - changing `turbo.json` changes `@quorum/core#test`'s hash;
   - changing one file from `contracts/Q-0006/**` changes `@quorum/core#test`'s hash; and
   - changing an unrelated documentation file that neither suite reads does not change either package's test hash.

   Each probe restores its subject file, and the test fails rather than skips when Turbo or a required corpus file is absent.

9. **Prove escaping inputs against a real cache.** An automated fixture using the workspace's installed Turbo version performs a non-dry run that writes a cache entry, confirms an unchanged second run is a cache hit, changes a file matched only through a `../`-escaping input, and confirms the next run executes instead of restoring the prior result. Reverting the input permits the original cache key to be used again. The proof must inspect both Turbo's result and a side effect or output produced by the fixture task, so a changed label alone cannot satisfy it.

10. **Prove the configuration on CI's checkout.** CI runs the real-cache regression from criterion 9 on its Linux checkout. It must not be conditionally skipped by operating system, branch type, cache state or missing optional software. The test uses an isolated temporary workspace and does not depend on a pre-existing repository cache.

11. **Keep CI and developer commands on one command surface.** The CI workspace job invokes the root `package.json` scripts for `lint`, `typecheck` and `test`, while passing Turbo's exact `--force` flag to each invocation. CI does not duplicate `turbo run <task>` as a separate command spelling. The root scripts remain the commands developers run locally.

12. **Keep CI's execution guarantee.** For all three workspace tasks, an automated guard parses `.github/workflows/ci.yml` and proves that CI's invocation reaches the corresponding root script with the exact `--force` flag. The guard rejects `--force-something`, a missing root script, a renamed or absent workspace job, and a workflow that invokes Turbo directly instead of the script. CI continues not to restore or save a Turbo task-result cache, and continues not to select the paid real-CLI probes.

13. **Make the cache contract discoverable.** The `docs/DECISIONS.md` entry and the explanatory comment at the CI workspace job state the distinct claims made by local cache hits and CI:

   - a local hit means the task's declared inputs and same-kind package dependencies are unchanged since a successful result; and
   - CI uses `--force`, so its green workspace check means lint, typecheck and test executed against the checked-out commit.

   The comment cites the decision entry instead of copying its full rationale.

14. **Keep all existing checks green.** From a clean checkout with dependencies installed, `pnpm lint`, `pnpm typecheck`, `pnpm test` and the spike regression suite complete successfully. The new cache tests leave `git status --short` empty and leave no files, branches or worktrees in the repository after either success or failure.

15. **Cross-cutting product checks.** The implementation satisfies the following explicit dispositions:

   - BYOS: no new subscription, environment-variable refusal or real-adapter path; no paid CLI probe runs in CI.
   - Worktree safety: no Quorum flow or product write path changes; cache-test fixtures write only below an operating-system temporary directory.
   - Gate behaviour: no gate or flow behaviour changes.
   - Files as the database: no persistent product state or schema changes.
   - Cross-vendor rule: not applicable; no reviewing or judging step changes.
   - Product-agnostic: no product-specific example or rule is introduced.
   - Lint rules: no ESLint scope or rule changes; the new TypeScript tests use strict types, no `any`, and no unreasoned suppression.
   - Cold-clone impact: no new dependency or setup step; an unchanged local run may remain cached, while a changed declared input intentionally causes more work.

## Non-goals

- Moving existing corpus assertions out of `packages/shared` or `packages/core`.
- Adding all of `docs/**`, `contracts/**`, `backlog/**`, `harness/**` or `spike/**` to `globalDependencies`.
- Disabling Turbo caching locally or forcing local `pnpm lint`, `pnpm typecheck` or `pnpm test` by default.
- Removing CI's `--force` requirement established by Q-0071.
- Changing test behaviour, port-freeze policy, the live-CLI probe switch or `QUORUM_REAL_CLI` hashing.
- Changing package exports, package dependency direction or build artifacts.
- Adding cross-kind ordering such as making `test` depend on `typecheck` or `lint`.
- Automatically discovering filesystem reads at runtime in production tasks; the regression guard may inspect test source and Turbo's effective inputs.
- Upgrading Turbo, pnpm, Node, ESLint, TypeScript or Vitest.
- Changing a Quorum CLI command, flow, gate, adapter contract, harness schema, backlog schema, Studio surface or persistent state.
- Multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual canvas, eval suites, a Gemini adapter or a desktop shell.

## Open questions

1. **Blocker — decision entry title and approval. Owner: Ruud.** What exact title should the new dated `docs/DECISIONS.md` entry use, and does Ruud approve the selected design: precise per-package `test.inputs` plus same-kind `^lint`, `^typecheck` and `^test` dependency edges? Implementation must not begin until Ruud has written this entry; the implementer then uses its exact title in tests and citations.

2. **Non-blocking — future corpus additions. Owner: implementer.** Can the regression guard reliably identify literal and helper-mediated repository reads without becoming a second fragile parser for TypeScript? The minimum acceptable implementation is an explicit audited manifest checked against Turbo's effective inputs; automatic source analysis is optional.

## Risks

- Turbo currently accepts `../`-escaping inputs, but that behaviour may not be stable across Turbo upgrades. The real-cache fixture makes an incompatible upgrade fail visibly.
- Exact corpus declarations can drift when a test adds a new repository read. The regression guard must fail in that change rather than relying on reviewers to remember `turbo.json`.
- Same-kind dependency edges serialize shared before core and may increase local duration after shared changes. That ordering is intentional because core consumes shared source directly.
- Core and shared corpus assertions read parts of each other's trees. Input declarations can therefore cause broader invalidation than an individual test needs, although they do not create a Turbo dependency cycle by themselves.
- Forwarding `--force` through package-manager scripts is sensitive to command syntax. The CI guard and live CI execution must prove the flag reaches Turbo rather than only appearing in workflow text.
- Cache tests can become false positives if they inspect only Turbo's summary. Criterion 9 requires observable task execution in addition to the reported cache state.
