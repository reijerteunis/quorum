# Q-0097 — The workspace emits JavaScript

Stage: draft · Iteration: 1 · Parent: Q-0010 · Split from Q-0096 · Milestone: M2

Surfaces: workspace build configuration, `packages/shared`, `packages/core`, `packages/cli`, repository tests and CI assertions.

## Problem

The workspace runs TypeScript through Vitest and typechecks it without emitting JavaScript. That is sufficient for source tests, but it cannot supply the executable artifact required by the later `quorum` binary work.

A build introduces a failure class the workspace does not currently have. Existing Turbo tasks cache verdicts and declare no outputs. The new task will cache files that Node later executes. An incomplete output declaration, a stale file left in `dist/`, or an input omitted from the cache key can therefore make the executable artifact disagree with the tracked source while the build reports success.

The governing decision is *“The emit serves the binary, and no test verdict moves behind it”* (2026-09-02). It requires:

- `tsc` emission from `@quorum/shared`, `@quorum/core`, and `@quorum/cli`, each into its own `dist/`;
- a root `build` task with `dependsOn: ["^build"]` and real outputs;
- no `build` script for the four non-emitting stub packages;
- source resolution for the existing typecheck and test suites, with no `^build` dependency added to either task; and
- emitted output used by plain Node and, later, the binary and packed installation.

This ticket may start only after Q-0096 has landed, decision 078 is present in `docs/DECISIONS.md`, and the branch `harness/Q-0097/integration` exists. It must not run concurrently with Q-0096 or Q-0098.

## User story

**Maintainer.** As the maintainer, I want one dependency-ordered workspace command to emit reproducible JavaScript and declarations for every consumable package, so that later binary work executes artifacts corresponding to the current tracked source rather than stale files or an incomplete cache replay.

**Contributor.** As an adapter contributor, I want lint, typecheck, and test to continue examining TypeScript source without requiring a build first, so that introducing executable output does not change what the existing development verdicts prove.

**Adopter.** As a cold-clone adopter, I want the repository to produce its required JavaScript from a clean checkout using the documented dependency installation and one build invocation, so that no ignored files from another checkout are required.

## Acceptance criteria

### AC-7 — A dependency-ordered build task declares real outputs

Surface: workspace configuration and the manifests of `packages/shared`, `packages/core`, and `packages/cli`.

1. Root `turbo.json` declares `build` with `dependsOn: ["^build"]` and a non-empty `outputs` array covering the package-local `dist/` artifact.
2. `lint`, `typecheck`, and `test` retain `outputs: []`. Neither `typecheck` nor `test` gains a dependency on `build` or `^build`.
3. `@quorum/shared`, `@quorum/core`, and `@quorum/cli` each declare a `build` script that emits JavaScript and TypeScript declarations into that package’s `dist/`.
4. The four non-emitting stub packages do not gain no-op `build` scripts.
5. From a clean checkout with dependencies installed and all generated directories absent, one root `pnpm turbo run build` invocation builds prerequisites before consumers without a prior lint, typecheck, test, or package-specific command.
6. Every package-level `turbo.json` continues to extend the root and declares task-specific `inputs` only. It does not declare `env` or `outputs`; root `turbo.json` remains the authority for those properties and retains `QUORUM_REAL_CLI` on `test`.
7. The existing `packages/cli/src/package.test.ts` assertion about package-level outputs is reconciled rather than removed. Its name and explanation state that package configuration must not override root output or environment policy, and a fixture containing package-level `env` makes the assertion fail.

### AC-8 — Declared outputs equal the files produced by the build

Surface: workspace acceptance tests.

1. An acceptance test removes the emitting packages’ generated directories, runs the root build, and inventories every generated file.
2. The test expands the configured output patterns and compares normalized file paths with the generated-file inventory as set equality.
3. The test fails when a generated file is omitted from the declaration.
4. The test fails when the declaration includes an unrelated file or a package directory broader than the generated artifact.
5. The comparison covers all three emitting packages and does not pass merely by reading or snapshotting `turbo.json`.

### AC-9 — A cache hit restores an executable artifact

Surface: workspace acceptance tests and Turbo cache behavior.

1. A test starts without emitted output, preserves a test-owned Turbo cache, and performs a successful build.
2. The test deletes every declared artifact without deleting that cache and repeats the same build.
3. Turbo’s machine-readable output or run summary proves that the repeated build was restored from cache; matching console prose alone is insufficient.
4. The repeated build restores the deleted artifact to disk.
5. The test imports or executes restored JavaScript with plain Node and asserts a behavior or exported value, proving the restored file is usable rather than merely present.
6. The test uses only tracked inputs, lockfile-installed dependencies, and directories it creates and cleans itself.

### AC-10 — A changed tracked input cannot execute stale output

Surface: workspace acceptance tests and Turbo cache behavior.

1. In a disposable copy or test-owned fixture, a test builds a package and executes an emitted value or behavior.
2. The test changes a tracked source file or build-configuration input whose effect on emitted output is observable, then rebuilds through Turbo without manually deleting the prior cache.
3. The subsequently executed artifact reflects the changed input and cannot produce the original result.
4. The test proves that the affected build was not restored from the old cache entry.
5. The verdict does not depend on pre-existing `dist/`, user-level configuration, account identity, network access, or files outside the test-owned tree.

### AC-11 — Repeated builds do not preserve removed entry points

Surface: package build scripts and workspace acceptance tests.

1. For identical tracked inputs, a build with all generated directories absent and a build with prior output present produce byte-identical sets of declared artifacts.
2. In a disposable fixture, a test builds a source entry point, renames or removes that entry point, and rebuilds without manually deleting its individual emitted file.
3. The old JavaScript and declaration paths are absent after the rebuild and cannot be imported or executed.
4. The replacement entry point, if one is created, is emitted and usable.
5. The test fails against a build implementation that lets `tsc` write over an uncleared `dist/` and leave the obsolete output behind.

### AC-12 — Emitted output is invisible to source scans

Surface: `packages/cli`, repository ignore rules, and source-scanning tests.

1. `packages/cli/src/frame.source.test.ts` adds `dist` to its `GENERATED` register. The register is pinned by exact identity, not by count.
2. The test’s header is corrected to state that emitted output is deliberately excluded and that no verdict depends on whether the checkout has run a build.
3. A fixture derived from every member of `GENERATED` places a real file under each excluded directory. Adding another register member without a corresponding fixture subject fails.
4. Before applying the `dist` exclusion, an emitted copy of a test file containing one of the scan’s forbidden subscription-environment names makes the source scan fail. With the exclusion applied, that fixture passes. This red case must be retained as an automated discriminating test or recorded as red-phase evidence in the implementation report when retaining it would require testing private implementation details.
5. The credential-pattern scan and signal-handler scan return identical verdicts with `dist/` absent and with representative emitted test files present.
6. A test proves that `git check-ignore -v` attributes an emitted path to the repository’s `dist/` ignore rule.
7. A test proves that the `**/dist/**` ESLint ignore covers emitted files.
8. `packages/core/src/git-identity.test.ts` proves its repository walk skips `dist/` by identity and with a real fixture subject.

### AC-13 — Task ownership registers cannot narrow silently

Surface: `packages/core/src/test-discovery.test.ts` and `packages/cli/src/package.test.ts`.

1. Tests derive the root task names from root `turbo.json`; they do not maintain a second hand-written copy of `['lint', 'typecheck', 'test']`.
2. The assertions distinguish tasks owed by every workspace package (`lint`, `typecheck`, and `test`) from `build`, which is owed only by the emitting packages named by decision 078.
3. The emitting-package register is derived from an authoritative, tracked property or is cross-checked in both directions against package build scripts and the packages selected by the build. It cannot silently omit an emitting package or include a non-emitting stub.
4. The comments and test names state the two different obligations and do not claim that every root Turbo task is owed by every package.
5. A discriminating fixture proves the previous failure mode: with a root `build` task present and the old hand-written three-task array, a package lacking a required build script passes unnoticed. The corrected assertion fails for the same mismatch.
6. Adding a fifth emitting package without updating the authoritative emitting set, its build script, or its coverage causes a test failure rather than a silent Turbo skip.

### AC-14 — Existing test commands remain source-based and their stated reasons remain true

Surface: `harness/harness.yaml`, `.github/workflows/ci.yml`, `.github/scripts/git-identity-sweep.sh`, and repository guard tests.

1. `harness/harness.yaml` keeps its existing install command and its spike-plus-workspace test command. No build phase is added because decision 078 keeps existing test verdicts on source.
2. The CI `workspace` job continues to run lint, typecheck, and test with `--force` and does not add a build step or a new build job. Its name and comments continue to describe exactly those three executed verdicts.
3. `.github/scripts/git-identity-sweep.sh` retains its `isolation`, `probe`, `install`, `spike suite`, and `workspace suite` phases without adding a build phase.
4. Guard tests assert these three unchanged outcomes and cite the governing reason: emitted output serves the later binary, while existing test and typecheck verdicts remain on TypeScript source.
5. `packages/core/src/shared-resolution.test.ts` is updated so its explanation no longer relies on the false statement that root `turbo.json` has no build task. The test continues to prove that workspace TypeScript and Vitest resolution use source.
6. `packages/core/src/project.test.ts` continues to require `--force` for the integration test command, and `packages/core/src/test-command.test.ts` continues to prove that the command executes rather than replays tests.
7. `test-command.test.ts` continues to pin the same seven CI jobs because this ticket adds no job. A change to that count fails by identity.
8. No file under `spike/src/` and no spike test is modified. Both `npm test --prefix spike` and `pnpm turbo run test --force` pass after installing their respective lockfile dependencies.
9. `packages/core/src/spike-parity.test.ts` is run against a freshly derived inventory. Because this ticket ports no spike logic, its asserted source-line totals remain unchanged; any observed change is a blocker rather than an adjusted expectation.

## Non-goals

- Changing the public export surface of `@quorum/core`; Q-0096 owns that work.
- Adding the `quorum` binary target, shebang, command dispatch, package shim, packed-tarball behavior, or `npx quorum` claims; Q-0098 owns that work.
- Moving existing lint, typecheck, or test verdicts behind emitted output.
- Adding `build` scripts to packages that emit no consumable artifact.
- Adding a bundler, a runtime TypeScript loader, Node type-stripping support, or any new dependency.
- Publishing any package to a public registry; Q-0029 owns publishing.
- Changing runtime behavior or fixing an unrelated known defect.
- Modifying `spike/src/` or editing spike tests to accommodate workspace behavior.
- Changing the harness flow, gate behavior, adapter contract, persisted file format, or schema.
- Adding an API-key path, remote state, cloud synchronization, multi-user behavior, a plugin marketplace, a visual node canvas, an eval suite, another adapter, or a desktop shell.

## Open questions

No product or architecture question remains for implementation. Decision 078 fixes the emit strategy, package set, artifact directory, task scope, dependency ordering, and source-versus-artifact resolution boundary.

The following are launch checks, not choices an implementer may resolve:

1. **Has Q-0096 landed before this ticket starts?** Owner: maintainer. Blocker: yes; this ticket must build on its export and resolution surface.
2. **Does `harness/Q-0097/integration` exist before the first chore run?** Owner: maintainer. Blocker: yes; review preflight requires it.
3. **Are Q-0096 and Q-0098 inactive while Q-0097 runs?** Owner: maintainer. Blocker: yes until Q-0039 supplies run locking.

If implementation evidence contradicts decision 078 or a ground rule, the implementer must stop and report the contradiction. It must not silently choose another build shape or modify the spike. The human owner must supply an erratum before the loop continues.

## Risks

- **Cache tests may accidentally prove console wording instead of restoration.** Mitigation: use Turbo’s machine-readable summary, delete declared outputs, and execute the restored artifact.
- **A broad output glob may hide undeclared or unrelated files.** Mitigation: compare expanded declarations and observed generated files as sets in both directions.
- **`tsc` can leave obsolete files in `dist/`.** Mitigation: require build-owned cleanup and retain the renamed-entry-point regression test.
- **Source scans may become checkout-dependent after a local build.** Mitigation: test each exclusion with a real generated-file fixture and compare verdicts with artifacts present and absent.
- **Turbo silently skips packages without a script.** Mitigation: derive root tasks, separately derive or cross-check the emitting package set, and test both directions.
- **Source tests and shipped JavaScript can diverge.** This is an accepted consequence of decision 078. Q-0095 must later exercise the built binary; this ticket does not claim that existing suites prove the final packaged runtime.
- **The build adds work to the cold clone.** The cost is limited to users producing the executable artifact; ordinary lint, typecheck, and test commands gain no build prerequisite.
- **Cross-cutting constraints:** BYOS is unchanged; worktree safety and gate behavior are unchanged; no persisted file format or schema changes; lint coverage excludes generated output; and no registry or cold-machine `npx quorum` claim is introduced.
