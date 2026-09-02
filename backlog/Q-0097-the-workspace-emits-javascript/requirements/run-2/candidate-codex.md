# Q-0097 — The workspace emits JavaScript

Stage: draft · Iteration: 2 · Parent: Q-0010 · Milestone: M2

Surfaces: workspace build configuration, `packages/shared`, `packages/core`, `packages/cli`, repository tests and CI.

## Problem

The workspace currently runs TypeScript source through development tools but does not produce the JavaScript artifacts that Node and the future `quorum` binary require. This creates a new correctness risk: unlike the existing `lint`, `typecheck` and `test` tasks, a cached build restores files that another process may execute. An incomplete output declaration, stale file left in `dist/`, or source scan that reads generated copies could therefore make the executed program disagree with the tracked source while existing checks remain green.

The governing decision, *“The emit serves the binary, and no test verdict moves behind it”* (2026-09-02), is landed and indexed. It requires:

- `tsc` emit for each consumable package: `@quorum/shared`, `@quorum/core` and `@quorum/cli`;
- JavaScript and declarations in each package’s `dist/` directory;
- a root `build` task with `dependsOn: ["^build"]` and real outputs;
- no `build` scripts for the four stub packages that emit nothing;
- workspace tests and typechecking to continue resolving TypeScript source, with no `^build` dependency; and
- plain Node and packaged consumers to resolve emitted JavaScript.

Q-0096 must land before implementation starts because it owns the export surface and source-resolution condition used here. Q-0098 follows this ticket and owns the binary and packaging. The required order is Q-0096 → Q-0097 → Q-0098 → Q-0095.

The branch `harness/Q-0097/integration` must exist before the first chore run. Q-0097 must not run concurrently with Q-0096 or Q-0098 while Q-0039 remains unresolved.

## User story

As a `maintainer`, I want one workspace build command to produce complete, current and cache-restorable JavaScript artifacts, so that the future binary cannot execute output from different source than the commit being reviewed.

As a `contributor`, I want existing test and typecheck commands to continue examining TypeScript source, so that adding an emitted artifact does not silently change what an existing verdict proves.

As an `adopter`, I want a clean checkout to build without manual ordering or leftover generated files, so that preparing the future `quorum` command does not add undocumented setup to the cold-clone path.

## Acceptance criteria

### AC-7 — The workspace has one correctly ordered build task

1. Root `turbo.json` declares `build` with `dependsOn: ["^build"]` and a non-empty `outputs` array covering the package-local `dist/` artifact directory.
2. `lint`, `typecheck` and `test` continue to declare `outputs: []` and do not acquire a `^build` dependency.
3. `@quorum/shared`, `@quorum/core` and `@quorum/cli` each declare a build script that emits JavaScript and declarations into that package’s `dist/` directory.
4. Stub packages that emit nothing do not receive no-op build scripts.
5. From a clean checkout with dependencies installed and generated directories absent, one root build invocation builds prerequisites before consumers without a prior typecheck, test or package-specific command.
6. Every package-level `turbo.json` continues to declare `inputs` and no task-level `outputs` or `env`. Root `turbo.json` remains the single place that decides environment inputs, including `QUORUM_REAL_CLI`.
7. The existing `packages/cli/src/package.test.ts` assertion about package-level outputs is replaced with an assertion of the contract above, and its explanatory comment is corrected. A fixture containing package-level `env` or `outputs` makes this assertion fail.

### AC-8 — Declared outputs equal the files emitted by the build

1. An acceptance test removes all package `dist/` directories, runs the root build and inventories the package artifacts created by the package build commands.
2. The test expands the configured output patterns relative to each emitting package and compares that set with the emitted inventory in both directions.
3. The test fails when an emitted file is not covered by the declaration.
4. The test fails when the declaration covers an artifact path that the build does not produce.
5. Turbo’s own cache metadata and logs are not treated as package artifacts. No entire package directory is accepted as an output declaration.

### AC-9 — A cache replay restores an executable artifact

1. An acceptance test starts without generated artifacts, runs the root build, and preserves the resulting Turbo cache.
2. The test deletes every declared artifact while leaving the cache intact, then repeats the same build.
3. Turbo’s machine-readable summary must identify the relevant package build as a cache hit; output text alone is not the oracle.
4. The declared artifact must be restored to disk.
5. The restored JavaScript must be loaded or executed successfully by plain Node without a TypeScript loader or workspace-only resolution condition.

### AC-10 — A changed input cannot replay stale JavaScript

1. In a repository fixture created by the test, build once through Turbo, then change a tracked source or tracked build-configuration input whose effect is observable in emitted JavaScript.
2. Rebuild through the same root command and execute or import the resulting JavaScript.
3. The executed result must reflect the changed input and must not reflect the prior artifact.
4. The test’s verdict may depend only on tracked files, lockfile-installed dependencies and files created by the test. It must not depend on pre-existing ignored output, user-level configuration, subscription identity or account identity.

### AC-11 — Repeated builds are independent of leftover output

1. For identical tracked inputs, building with all `dist/` directories absent and building with output from an earlier build present produce the same declared artifact paths and byte contents.
2. Each package build removes or otherwise makes impossible undeclared leftovers from its own prior emit before writing current output.
3. A test builds a repository fixture, renames or removes a source entry that previously emitted a JavaScript file, updates the fixture’s tracked references as needed, and rebuilds.
4. The old emitted path must be absent after the rebuild, the replacement artifact must be present where applicable, and the old path must not remain executable or importable.

### AC-12 — Generated artifacts are invisible to source scans

1. `packages/cli/src/frame.source.test.ts` adds `dist` to its `GENERATED` identity register, alongside `node_modules` and `.turbo`; membership remains pinned by `toStrictEqual`, not by a count.
2. The register test derives a real fixture file for every registered directory. Adding another directory without a corresponding subject must fail.
3. A fixture containing an emitted copy of a test file demonstrates that the secret-pattern scan fails when `dist` is removed from the exclusion register and passes when the exclusion is active.
4. The secret-pattern scan and signal-handler scan return identical verdicts with the generated artifact present and absent.
5. A test proves that `git check-ignore -v` attributes an emitted path to the repository’s `dist/` ignore rule.
6. A test proves that `eslint.config.js` excludes the same emitted path through `**/dist/**`.
7. A test proves that the walker exercised by `packages/core/src/git-identity.test.ts` skips the emitted directory.
8. The header of `frame.source.test.ts` is corrected to state that generated output is excluded and that scan verdicts do not depend on whether the checkout has been built.

### AC-13 — Task coverage cannot narrow silently

1. The task coverage guard derives root task names from root `turbo.json` rather than maintaining the old hand-written `['lint', 'typecheck', 'test']` register.
2. The guard separately derives or validates the emitting package set: `@quorum/shared`, `@quorum/core` and `@quorum/cli` owe `build`; packages without emitted artifacts do not.
3. Every workspace package continues to owe `lint`, `typecheck` and `test`.
4. Both `packages/core/src/test-discovery.test.ts` and `packages/cli/src/package.test.ts` state and enforce this distinction without independently repeating a task list that can drift.
5. A fixture reproduces the prior fail-open behavior: with a root `build` task, the old hand-written register would allow an emitting package without a build script to pass unnoticed. The new guard must fail for that fixture.
6. A fixture also proves that a non-emitting stub package is not required to declare a no-op build script.

### AC-14 — Existing commands keep proving source, and their stated reasons remain true

1. `harness/harness.yaml` keeps its existing install and test command sequence; it does not add a build phase because tests continue to resolve source.
2. The `workspace` job in `.github/workflows/ci.yml` does not add a build phase or a separate build job for this ticket.
3. `.github/scripts/git-identity-sweep.sh` keeps its existing phases: isolation, probe, install, spike suite and workspace suite. It does not add a build phase.
4. Repository tests assert these three deliberate non-changes, including the reason: no existing test or typecheck verdict moves behind emitted output.
5. The `--force` guard in `project.test.ts` and the executes-not-replays guard in `test-command.test.ts` remain green.
6. `test-command.test.ts` continues to pin the existing seven CI jobs because this ticket adds no job.
7. The header of `packages/core/src/shared-resolution.test.ts` is corrected: workspace resolution uses TypeScript source because of the workspace-only export condition, not because the workspace lacks a build task.
8. Resolution tests continue to prove that TypeScript and Vitest use source while a plain Node process uses `dist/`.
9. The spike suite and the forced workspace suite pass after dependencies are installed: `npm test --prefix spike` and `pnpm turbo run test --force`.
10. `packages/core/src/spike-parity.test.ts` is updated in the same change if repository line totals covered by that test change; totals are re-derived rather than arithmetically adjusted.

## Non-goals

- Changing the public export surface of `@quorum/core`; Q-0096 owns it.
- Adding the `quorum` binary target, shebang, command behavior, packed-tarball proof or any claim about `npx quorum`; Q-0098 owns them.
- Moving existing tests or typechecking behind emitted output.
- Adding a bundler, TypeScript runtime loader or new dependency.
- Requiring stub packages to emit files or to declare no-op build scripts.
- Publishing any package to a public registry; Q-0029 owns publishing.
- Exercising the complete built binary; Q-0095 owns that end-to-end proof.
- Changing files under `spike/src/` or editing spike tests to accommodate the workspace build.
- Fixing unrelated defects discovered while implementing this ticket. Such defects are reported separately.
- Multi-user operation, remote execution, cloud sync, a plugin marketplace, visual flow editing, eval suites, a Gemini adapter or a desktop shell.

## Open questions

No product or architecture question remains open. *“The emit serves the binary, and no test verdict moves behind it”* (2026-09-02) resolves the emit mechanism, emitting packages, output location, task ownership and source-versus-artifact resolution.

Implementation may choose the exact TypeScript configuration split and test-fixture organization, provided every acceptance criterion above is met. These choices do not change a file format, adapter contract or product behavior and therefore are not blockers.

If implementation evidence contradicts the landed decision or a Q-0010 ground rule, the implementer must stop and surface the contradiction. It must not be resolved by silently choosing another architecture. Because Q-0083 does not yet provide a blocked verdict, a provable contradiction requires an erratum during the review loop rather than another implementation round.

## Risks

- **Stale executable output:** Incorrect output declarations or uncleared `dist/` files could make Node execute code from an earlier source state. AC-8 through AC-11 cover declaration equality, cache restoration, changed inputs and leftover removal independently.
- **False source-scan failures:** Generated test copies contain strings intentionally used by source guards. If `dist/` is not excluded consistently, a checkout can fail only because it was built. AC-12 covers all four known exclusion surfaces.
- **Fail-open task coverage:** Turbo silently skips packages without a matching script. AC-13 distinguishes tasks owed by every package from `build`, which is owed only by emitting packages.
- **Source/artifact divergence:** Existing suites deliberately prove source while Node consumes emit. This is accepted by the governing decision and remains visible until Q-0095 exercises the built binary end to end.
- **Sequencing:** Starting before Q-0096 lands can produce an emit configuration against an unstable export surface. Q-0098 and Q-0095 must not treat this ticket as complete until all artifact tests pass.
- **Shared worktree collision:** Concurrent Q-0096, Q-0097 or Q-0098 runs can share a worktree and run id while Q-0039 remains unresolved.

Cross-cutting assessment:

- BYOS: no subscription mechanism changes and no new secret-bearing path is introduced.
- Worktree safety: production behavior is unchanged; acceptance tests mutate only fixtures or test-created repositories, never the user’s working tree.
- Gate behavior: unchanged.
- Persistent file formats and schemas: unchanged.
- Adapter contract and cross-vendor rule: unchanged.
- Lint coverage: emitted `dist/` files remain outside ESLint; tracked TypeScript remains covered.
- Cold-clone impact: one root build works after the existing dependency install, with no manual package ordering or extra dependency.
- Product scope: repository build infrastructure only; no SaaS-specific behavior is introduced.
