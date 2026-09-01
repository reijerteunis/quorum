# Q-0090 — CLI package skeleton, bin entry and `npx quorum`

## Problem

The CLI surface cannot be executed from `packages/cli`. The package has no runtime entry, executable mapping, argument parser, runtime dependencies, shared output helpers, or centrally owned exit-status definitions. Every later CLI child of Q-0010 depends on this frame; if each child creates its own version, argument and process-exit behaviour will diverge from the authoritative implementation in `spike/`.

This ticket establishes the executable CLI frame without porting any domain command. It touches the **CLI** surface and workspace build/test wiring. It does not change the Studio, `harness/` file formats, backlog file formats, adapter contract, core domain behaviour, or the authoritative spike implementation.

## User story

As a **cold-clone adopter**, I want the documented clean-clone setup to make `npx quorum` start the Quorum CLI, so I can confirm that the installation works before learning any domain command.

As a **maintainer**, I want all CLI children to share one argument parser, output helper, fatal-error helper, and exit-status definition, so later commands preserve the spike’s process behaviour instead of inventing incompatible conventions.

As an **adapter contributor**, I want the CLI package to depend only on the workspace contracts it presents, so vendor-specific and spike-only dependencies do not leak into the CLI frame.

## Acceptance criteria

1. **Executable package mapping — CLI.** `packages/cli/package.json` declares an executable named `quorum` through its `bin` field. After the workspace’s supported install and build steps, the mapped file exists, is executable on POSIX systems, starts with an appropriate Node executable entry, and launches the compiled `@quorum/cli` runtime without importing TypeScript source directly.

2. **Runtime package entry — CLI.** `@quorum/cli` declares the package metadata and build output required for Node to resolve its runtime entry. A package-level test imports the built package entry successfully in the supported Node module mode.

3. **Workspace dependencies — CLI.** `@quorum/cli` declares `@quorum/core` and `@quorum/shared` as workspace dependencies. It introduces no dependency merely because `spike/package.json` contains it. Any additional runtime dependency requires a one-line justification in the solution document and, when architectural, a new append-only decision entry.

4. **Workspace build ordering — CLI/workspace.** Workspace and Turbo configuration register `@quorum/cli` so a clean build compiles its required workspace dependencies before compiling the CLI. Existing Turbo input guards pass; if their tracked package inventory requires explicit CLI registration, that registration is included in this change.

5. **CLI invocation proof — CLI.** Invoking the built `quorum` executable with `--help` succeeds without implementing or calling a domain command. It writes a deterministic, non-empty help response to standard output, writes nothing to standard error, and returns status `0`.

6. **No-argument invocation — CLI.** Invoking the built executable with no arguments has one deterministic scaffold behaviour: it displays the same top-level help response as `--help` and returns status `0`. It must not start a daemon, mutate repository files, probe an adapter, or run a flow.

7. **Unknown command handling — CLI.** Invoking the scaffold with a positional command name that is not registered writes a clear error containing that exact command name to standard error, does not write a success message to standard output, and terminates with hard error status `1`.

8. **Argument parsing contract — CLI.** The parser consumes `process.argv.slice(2)` and returns a typed result with positional arguments kept in encounter order as `rest` and named options kept in a flag object. Parser tests use representative argument vectors derived from the current `spike/bin/harness.js` parser and prove parity for every syntax that the eight existing spike commands currently consume. The tests must cover, at minimum, positional arguments before and after flags, boolean flags, value-bearing flags, repeated positional arguments, and `--` end-of-options handling if the spike currently supports it. Unsupported syntax must produce an explicit parse error rather than being silently reinterpreted.

9. **Parser independence — CLI.** Argument parsing is exported or otherwise isolated so tests can supply an argument array directly. Parser test verdicts do not depend on the invoking shell, global Git configuration, installed vendor CLIs, or an existing ignored directory.

10. **Colour helper parity — CLI.** `packages/cli` owns a colour-output helper with automated tests demonstrating the same enabled and disabled rendering behaviour as the helper currently at `spike/bin/harness.js:44`. Tests control colour capability themselves and do not depend on the test runner’s terminal. Disabling colour produces plain text with no ANSI escape sequences.

11. **Fatal-error helper parity — CLI.** `packages/cli` owns a typed `die` helper equivalent to the behaviour currently at `spike/bin/harness.js:124`. A test proves that it writes the supplied clear error to standard error and requests hard termination with status `1`. The test must not terminate the test process itself.

12. **Single exit-status definition — CLI.** One exported, read-only CLI-owned definition assigns the following meanings: `SUCCESS = 0`, `ERROR = 1`, `ABORTED = 2`, `UNDECIDED = 3`, and `SIGNAL = 130`. Production CLI code and CLI tests refer to this definition rather than repeating numeric status literals for these meanings.

13. **Hard and soft error mechanisms — CLI.** The process abstraction distinguishes hard termination with status `1` from setting `process.exitCode` to `1`. Tests prove that the soft mechanism allows subsequent output to be written before natural process completion, while the hard mechanism stops command execution. The shared numeric meaning does not collapse these into one implementation.

14. **Outcome mapping — CLI.** A single mapping function returns status `2` for `aborted`, status `3` for `undecided`, and status `0` for the currently successful outcome or outcomes. Tests cover all three branches. Future outcome additions have one mapping location to extend. No domain command is added merely to exercise this function.

15. **Signal ownership boundary — CLI.** Status `130` is present in the CLI-owned exit-status definition, but this ticket installs no signal handler and contains no signal-to-exit behaviour. Placement and signal handling remain assigned to Q-0094.

16. **Clean-clone executable test — CLI.** An automated test starts from a repository checkout that has no pre-existing `node_modules`, performs the supported frozen dependency installation and required build, then invokes the local package through the exact `npx quorum --help` form selected in Open question 1. The command meets AC-5 and does not resolve or download an unrelated public package. The test’s verdict depends only on tracked files, installed lockfile dependencies, and files the test creates.

17. **Spike remains authoritative — repository.** The change modifies no file under `spike/src/` or `spike/test/`. After installing both dependency sets as required by `harness/rules.md`, `npm test --prefix spike` passes unchanged.

18. **Workspace regression suite — repository.** After `pnpm install --frozen-lockfile`, `pnpm turbo run test --force` passes, including new tests under `packages/cli`. New and changed TypeScript is strict, contains no `any` or unjustified `@ts-ignore`, and passes the repository lint command, including the deprecated-API rule.

19. **Parity register — repository.** `packages/core/src/spike-parity.test.ts` is updated in the same change to classify the translated binary-side coverage. Its pinned source and test line totals are re-derived from the resulting files rather than incrementally adjusted, and the parity test passes.

20. **Core remains the domain layer — CLI/core.** The CLI frame imports domain contracts or helpers from `@quorum/core` where needed and does not copy a domain helper from the spike. If a required domain helper is genuinely absent from core, implementation stops and the absence is reported instead of adding it to CLI scope.

21. **No persistent side effects — CLI.** Running the executable with no arguments, `--help`, a parser error, or an unknown command creates or changes no file in the user’s working tree, `backlog/`, `harness/`, `.quorum/`, or `.harness/worktrees/`.

22. **BYOS regression — CLI.** The scaffold contains no subscription-secret input path, environment-variable handling, prompt, fixture, or documentation example. It does not change the existing adapter `check()` refusal behaviour or probe any adapter during scaffold invocations.

23. **Product and vocabulary constraints — repository.** New user-facing text is product-agnostic, uses the glossary terms, and introduces no reference to a specific SaaS product. No new persistent file format, schema, flow rule, gate behaviour, or adapter contract is introduced.

24. **Cold-clone documentation alignment — CLI/docs.** Once Open question 1 is resolved, the repository’s cold-clone instructions use the same tested install, build, and `npx quorum` invocation sequence. The scaffold adds no extra manual configuration step and does not claim that any domain command is available.

## Non-goals

- Implementing or partially implementing any of the eight spike domain commands, including `board`, `run`, `runs`, adapter operations, or daemon startup.
- Porting domain logic from `spike/` into `packages/cli`; domain logic belongs to `@quorum/core`.
- Modifying `spike/src/**` or deleting, editing, or replacing `spike/test/**`.
- Fixing known defects tracked by Q-0059, Q-0060, Q-0066, or Q-0068.
- Installing a signal handler or defining signal lifecycle behaviour; that belongs to Q-0094.
- Publishing a package to a registry unless the resolution of Open question 1 explicitly adds publication to scope.
- Adding a daemon, Studio UI, remote service, cloud sync, desktop shell, plugin marketplace, visual node canvas, eval suite, or Gemini adapter.
- Adding or changing a persistent file format, schema, adapter contract, flow lint rule, gate, worktree policy, or integration-branch policy.
- Accepting subscription secrets through arguments, environment configuration, files, prompts, tests, fixtures, or examples.
- Changing existing exit meanings or replacing soft status assignment with immediate process termination.
- Introducing command-specific flags solely to demonstrate the parser.

## Open questions

1. **Blocker — What exact clean-clone sequence does “`npx quorum` working” require?** Owner: product manager with release maintainer. `@quorum/cli` is a scoped package, while `npx quorum` normally resolves an executable from an installed local dependency or a registry package named `quorum`. Choose and record one testable distribution contract before implementation: (a) install the workspace, build it, then run the locally linked binary with an `npx` form that forbids registry fallback; (b) publish or reserve an unscoped `quorum` launcher package; or (c) use another explicit package mapping. This decision changes AC-16 and the cold-clone documentation and may change package metadata or release scope.

2. **Blocker if the spike is ambiguous — Which exact flag syntaxes are part of the parser compatibility contract?** Owner: CLI engineer, confirmed by product manager. Before implementation, inventory the forms actually consumed by the eight spike commands, including aliases, `--flag=value`, separate values, negated booleans, repeated flags, and `--`. Record the resulting fixture table in tests. Do not broaden syntax beyond observed behaviour without a separate product decision.

3. **What top-level help text and executable version source should the scaffold expose?** Owner: product manager. The minimum required response is deterministic and non-empty, but exact wording, whether `--version` is included, and whether the version comes from package metadata must be decided before QA freezes output assertions. This is not permission to list unimplemented commands as available.

4. **Should an unregistered command always be an error during the scaffold stage, or should all non-help input show help successfully?** Owner: product manager. This document proposes explicit status `1` under AC-7 because silent success hides misspellings; changing that choice affects observable CLI behaviour and tests.

5. **Which successful core outcomes currently map to status `0`?** Owner: CLI engineer, confirmed against the current core result type. The mapping must use core’s actual discriminated union and remain exhaustive. If core exposes more than the ticket’s named `aborted` and `undecided` outcomes, they must be listed before AC-14 is implemented rather than handled by a silent default.

## Risks

- **Package-name resolution:** `npx quorum` may download an unrelated registry package if the local executable is absent. The cold-clone test must prohibit or detect registry fallback.
- **Premature distribution scope:** Making the unscoped command work outside an installed workspace may require publication, package ownership, and release automation not currently included in this ticket.
- **Output truncation:** Treating every status `1` as immediate termination can drop buffered output on later `runs` warning paths. Separate hard and soft mechanisms and subprocess tests mitigate this.
- **Parser drift:** Selecting a convenient parser library without fixture-level spike parity can change flag semantics before any command is ported.
- **Hidden domain migration:** A scaffold can accidentally absorb helper logic that already belongs to core, creating two sources of truth.
- **Cross-platform executable behaviour:** POSIX executable bits, shebang handling, and Windows command shims differ. Testing the package-manager-created executable is necessary; direct `node <file>` testing alone is insufficient.
- **Stale parity accounting:** Adding binary coverage without re-deriving the parity register can leave Q-0010’s transfer record inaccurate even when the new tests pass.
- **Cold-clone duration:** Requiring an explicit full workspace build before help output may lengthen first use. The chosen invocation must be measured as part of the existing under-30-minute cold-clone path.

### Cross-cutting check

| Concern | Requirement for Q-0090 |
| --- | --- |
| BYOS | No new secret input or adapter probe; AC-22. |
| Worktree safety | Scaffold invocations perform no writes; AC-6 and AC-21. No flow execution is in scope. |
| Gate behaviour | Not applicable; no flow or gate is executed or changed. |
| File format and schema | Not applicable; no persistent format or schema is introduced. |
| Cross-vendor rule | Not applicable; no reviewing or judging step is created or changed. |
| Lint and deprecated APIs | Workspace lint and strict TypeScript pass; AC-18. |
| Product-agnostic behaviour | User-facing output remains generic; AC-23. |
| Explicit errors | Parser and unknown-command failures are visible and status-bearing; AC-7, AC-8, and AC-11. |
| Cold-clone impact | The selected local `npx quorum` path is automated, documented, and cannot resolve an unrelated package; AC-16, AC-24, and Open question 1. |
