# Q-0096 — The workspace emits JavaScript, and `quorum` is a runnable binary

## Problem

The workspace has TypeScript source but no runtime delivery path. Vitest transforms TypeScript during tests, while Node cannot execute the package relationships as currently declared:

- Turborepo and the package manifests define no `build` task.
- `@quorum/core` has no package entry points and cannot be resolved at typecheck or runtime.
- `@quorum/shared` exports TypeScript source.
- `@quorum/cli` names `./bin/quorum.js`, but that file does not exist.
- Existing Turbo tasks cache verdicts only; none replays generated artifacts.
- Every package is private, so an unqualified registry invocation of `npx quorum` is not a valid acceptance path before Q-0029.

This blocks Q-0095, whose mock end-to-end suite must execute the binary. It also leaves downstream packages without a defined way to consume runtime JavaScript or type declarations.

Surfaces touched: the CLI, workspace package contracts, build and test configuration, and architecture documentation. This ticket does not change a flow, gate, adapter, ticket format, or persistent product data.

## User story

As a **maintainer**, I want one documented and cache-safe workspace build to emit the JavaScript and type information consumed by other packages, so that the same artifacts tested locally are the artifacts executed by the `quorum` binary.

As a **cold-clone adopter**, I want the locally built workspace and a locally packed distribution artifact to provide a runnable `quorum` command without contacting the public registry, so that I can verify the installation path without executing an unrelated package.

As a **contributor**, I want each consumable workspace package to expose explicit runtime and type entry points, so that TypeScript, Node, tests, and packaged installations resolve the same public contract.

## Acceptance criteria

1. **Architecture decision precedes implementation — documentation.** Before build or package-entry-point code is added, a new append-only decision entry records:
   - the selected emit mechanism;
   - the supported Node module format and module-resolution rules;
   - whether package consumers resolve emitted files or source files during development and tests;
   - the public runtime and type entry-point policy for workspace packages;
   - the CLI packaging approach, including how its workspace runtime dependencies are delivered in the packed-artifact test;
   - the exact Turbo `build` inputs, dependency edges, and replayed outputs; and
   - the stale-artifact failure the design prevents.

   The entry includes **Decision**, **Alternatives considered**, and **Why**, is indexed in `docs/DECISIONS.md` using the date on which it enters the index, and names both *“The test command defeats its own cache”* (2026-08-27) and *“A cache hit names what the task reads, not what its package contains”* (2026-08-28) where relevant. Implementation and repository documentation conform to that entry.

2. **One supported build command — workspace.** A documented root command builds every workspace package that contains runtime TypeScript or is required to produce the `quorum` executable. From a clean checkout after `pnpm install --frozen-lockfile`, one invocation succeeds without requiring a prior typecheck, test, or manual file copy.

3. **JavaScript is emitted — workspace packages.** The supported build emits Node-runnable JavaScript for every runtime TypeScript module reachable through the public entry points of `@quorum/shared`, `@quorum/core`, and `@quorum/cli`. Emitted JavaScript contains no import whose successful execution depends on Vitest, a TypeScript runtime loader, Node type stripping, or a `.js`-to-`.ts` fallback.

4. **Types are emitted and resolvable — workspace packages.** Each package intended for cross-package consumption exposes declarations that TypeScript resolves through its package manifest. In a fixture that consumes installed or linked workspace packages without `tsconfig.paths`, both a value import and a type-only import from `@quorum/shared` and `@quorum/core` typecheck successfully.

5. **Runtime package resolution works — workspace packages.** From a Node process outside the source directories, importing each supported public entry point of `@quorum/shared` and `@quorum/core` after a build succeeds through package metadata. The test does not import `src/*.ts`, address an emitted file by a repository-relative path, or rely on Vitest aliases.

6. **Package entry points agree — workspace packages.** For every consumable package, `exports`, and any retained `main` or `types` fields, refer to files produced or deliberately made available by the selected strategy. No runtime export points to a `.ts` implementation file. The supported public subpaths are explicit; this ticket does not expose every internal source module by wildcard.

7. **Build ordering follows package dependencies — workspace.** The Turbo `build` task declares upstream build dependencies so a clean root build produces prerequisites before consumers. Building `@quorum/cli` through Turbo therefore builds the `@quorum/core` and `@quorum/shared` artifacts it needs without a separate manual command.

8. **Build artifacts have exact replay boundaries — workspace.** The Turbo `build` task declares the complete generated artifact set as `outputs`, excluding source, tests, package-manager state, temporary pack files, and unrelated package contents. An automated configuration test fails if an emitted runtime or declaration artifact falls outside the declared output boundary, or if the output declaration includes a broader package directory than the generated artifact directory.

9. **A replayed build is executable — workspace.** An automated test performs a clean build, preserves the Turbo cache, removes only the declared generated artifacts, reruns the same build to obtain a cache hit, and then executes/imports the restored CLI, core, and shared artifacts successfully. The test establishes that a cache hit restores usable artifacts rather than only reporting a prior verdict.

10. **Changed inputs cannot execute stale artifacts — workspace.** An automated test builds a fixture or repository copy, changes a tracked source or build-configuration input that affects emitted output, rebuilds through Turbo, and proves that the executed artifact reflects the change. Its verdict depends only on tracked files, lockfile-installed dependencies, and files created by the test; it does not depend on a pre-existing ignored `dist/`, user-level configuration, or account identity.

11. **Repeated builds do not depend on leftovers — workspace.** The supported build succeeds when generated directories are absent and when they contain output from an earlier build. The resulting declared artifacts are the same for the same tracked inputs, apart from metadata explicitly documented as non-deterministic. Removed or renamed source entry points do not remain executable solely because an old emitted file survived.

12. **Workspace binary is runnable — CLI.** After the supported workspace build, the package manager’s local executable resolution invokes `quorum` from `@quorum/cli`. The executable target exists, has a Node-compatible launcher contract, and runs under the minimum Node version declared by the package. On platforms that use POSIX executable modes, the installed or linked launcher is executable.

13. **The binary crosses the real package boundary — CLI.** An automated test launches `quorum` as a child process rather than importing the CLI in process. The process reaches the Q-0090 frame through emitted package entry points, writes its expected output to the correct stream, and returns the expected exit status for one already-defined Q-0090 invocation. The test does not duplicate a command implementation or add a new command for this ticket.

14. **A locally packed distribution is runnable — CLI/package.** An automated test creates the selected `pnpm pack` artifact or artifact set, installs it into a newly created temporary project that has no workspace symlinks and no access to repository `node_modules`, and invokes the installed `quorum` executable successfully. All runtime workspace dependencies required by the selected packaging decision are supplied from locally created artifacts; none is obtained from a registry.

15. **Registry resolution is prohibited by the executable tests — CLI/package.** Both the workspace-path and packed-artifact tests configure package execution so that a missing local `quorum` fails instead of falling back to a registry. The packed test also points registry access at a test-controlled failing endpoint or uses an equally explicit offline guarantee. The test asserts the executed binary’s resolved path is inside the workspace package or temporary installation under test. A public package named `quorum` can neither satisfy nor alter the verdict.

16. **Packed contents are checked — package.** An automated assertion inspects the pack manifest or tarball and proves that it contains the declared CLI entry point and every file the selected distribution contract requires. It rejects repository-only material that is not part of that contract, including tests, run artifacts, worktrees, and ignored build leftovers. TypeScript implementation source is included only if the architecture decision expressly requires it for a non-runtime purpose; Node execution must not depend on it.

17. **Tests exercise the consumer contract — workspace.** Tests whose purpose is to prove package consumption run against the same package entry points and artifact class used by Node and the packed installation. Existing unit tests may continue to run against source only if the architecture decision records that split and the executable, resolution, replay, and packed-artifact tests independently cover emitted output.

18. **Existing behavior remains green — repository.** After installing dependencies as required by `harness/rules.md`, all of the following succeed:
   - `pnpm lint`;
   - `pnpm typecheck`;
   - the supported root build;
   - `pnpm turbo run test --force`; and
   - `npm test --prefix spike`.

   No test is reported as green unless its dependencies were installed. A pre-existing or newly discovered failure is reported rather than hidden by changing an unrelated assertion.

19. **Spike remains an independent witness — repository.** No file under `spike/src/` is modified. Existing spike tests are not deleted or edited. If the selected runtime strategy would require either action, implementation stops and the conflict is reported.

20. **No domain behavior moves into the build — core/CLI.** The build, launcher, and package metadata do not copy or reimplement domain logic from the spike or `packages/core`. A behavior discrepancy found while executing emitted artifacts is reported as a known defect and is not fixed under this ticket unless it is caused by the new build or packaging path.

21. **Parity register is re-derived — core tests.** `packages/core/src/spike-parity.test.ts` is updated in the same change. Its source-line totals, test-line totals, classifications, assertion counts, and derived percentages are recalculated from the resulting repository rather than adjusted arithmetically. If this ticket translates no spike scenario, the update records that fact while still re-deriving the totals.

22. **Documentation states the bounded claim — documentation/CLI.** Repository documentation distinguishes all three cases:
   - the supported workspace-local executable path;
   - the supported locally packed-artifact path; and
   - registry-backed `npx quorum`, which remains unimplemented until Q-0029 in M6.

   No README, architecture, development-plan, test name, or success message claims that a cold machine can obtain Quorum from the public registry. Existing statements that imply this ticket publishes `quorum` are corrected in the same change, with the decision entry as authority.

23. **No new dependency is unexplained — repository.** If the selected emit or packaging mechanism adds a dependency, the solution document gives a one-line justification. An architecture-changing dependency is also covered by AC-1. New code uses no dependency API marked deprecated by that dependency’s own typings.

24. **Cross-cutting constraints are preserved — repository.** Automated inspection and review establish that this ticket:
   - adds no API-key path, example, fixture, or documentation;
   - does not invoke an adapter or change subscription checks;
   - writes no product data and does not write to a user’s working tree during a flow;
   - changes no flow, gate, cross-vendor rule, ticket format, schema, or lint semantics;
   - introduces no hidden daemon state; and
   - adds no manual setup step beyond dependency installation, the supported build, and the explicitly local execution path.

## Non-goals

- Publishing any package to a registry, reserving the unscoped `quorum` package name, or asserting registry-backed `npx quorum`; those belong to Q-0029 in M6.
- Implementing Q-0095’s mock end-to-end scenarios. This ticket provides the binary that Q-0095 will execute.
- Adding or changing the command behavior owned by Q-0091 through Q-0094.
- Porting domain behavior from `spike/`, modifying `spike/src/`, or editing spike tests.
- Fixing known product defects encountered while validating emitted artifacts unless the new build path caused them.
- Publishing every internal source file as a public package subpath.
- Introducing a runtime TypeScript loader merely for tests unless the architecture decision selects it as the product runtime strategy.
- Requiring a global package installation.
- Launching the Studio, opening a browser, or implementing the daemon.
- Changing adapter contracts, event formats, flow files, gate behavior, ticket schemas, or persistent file formats.
- Multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Blocker — Which emit mechanism and artifact layout will the workspace adopt?** Owner: maintainer at the requirements gate. Choose between TypeScript emit, a bundler, or another explicitly evaluated mechanism. Record the choice under AC-1 before implementation. The answer determines package scripts, declaration generation, source-map policy, output paths, and dependency additions.

2. **Blocker — Do development and unit tests resolve package exports to emitted artifacts or directly to source?** Owner: maintainer with QA. The choice must account for the existing shared and core suites while ensuring the executable and packaging tests cover the production artifacts. Record the selected split and its rationale under AC-1.

3. **Blocker — How are `@quorum/core` and `@quorum/shared` delivered to the temporary consumer of the packed CLI?** Owner: release maintainer. Choose one locally reproducible contract: independently packed workspace dependencies installed alongside the CLI, a bundled CLI artifact, or another design that does not contact a registry. This changes package metadata and the exact AC-14/AC-16 fixture.

4. **Blocker — What exact generated paths constitute each package’s Turbo `build` outputs?** Owner: build maintainer. The answer must be no broader than the generated artifact directories and complete enough for AC-9 replay. Record the paths and why they cannot restore stale executable files under AC-1.

5. **Should source maps be part of the supported artifact contract?** Owner: maintainer. This is non-blocking if omitted. If included, their paths, contents, and Turbo output coverage must be defined and tested; if omitted, this ticket makes no debugging-quality claim about emitted stack traces.

## Risks

- **Stale artifact replay.** An incomplete input hash or overly broad output declaration could restore executable JavaScript that does not correspond to current source. AC-8 through AC-11 make artifact replay, invalidation, and deletion behavior observable.
- **Tests and runtime resolve different code.** Keeping unit tests on source while Node consumes emitted files can leave broken entry points green. AC-5, AC-9, AC-13, AC-14, and AC-17 provide independent artifact-level coverage.
- **Registry package substitution.** A bare `npx quorum` can execute a public package when the local binary is absent. AC-15 makes registry fallback a test failure, and AC-22 limits the documented claim.
- **Packed workspace dependencies are unavailable.** `workspace:*` references are not by themselves a distribution strategy when sibling packages are unpublished. Open question 3 must be settled before the packed test can be implemented.
- **Package export changes have a large blast radius.** Moving `@quorum/shared` or adding `@quorum/core` entry points changes resolution for the existing shared, core, and CLI suites. AC-17 and AC-18 require both consumer-contract coverage and the full regression suites.
- **Cross-platform launcher behavior.** A launcher that works through a workspace symlink on one operating system may fail after packing or lose executable metadata. AC-12 through AC-16 exercise installed behavior and inspect the artifact.
- **Cold-clone time increases.** A new build adds work to first use. The build must remain one documented command, require no global tool, and avoid manual copying; measured cold-clone optimization beyond that is not part of this ticket.
- **Architecture documentation overclaims distribution.** Existing M2 language says `npx quorum` works from a clean clone, while registry distribution is deferred. AC-22 requires the workspace, packed, and registry claims to be separated.
