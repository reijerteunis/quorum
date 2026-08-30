# Q-0079 — Tests must not depend on machine Git configuration

## Problem

Tests have passed on developer machines and during integration while depending on state that was present only on those machines. The failures appeared after merge in a fresh checkout or Linux CI environment.

The known cases depended on three different machine properties:

1. untracked directories already existing in a working checkout;
2. filesystem existence being used to classify repository content; and
3. Git obtaining a committer identity from machine configuration or the operating-system user record.

The shared defect is not a particular API or Git subcommand. It is that a test's result varies according to undeclared machine state rather than repository-controlled input.

The guard must therefore exercise the test suites in a deliberately isolated environment before merge. A broad source scan is not sufficient: it could identify some Git commands but would not detect the two filesystem cases or future dependencies using different mechanisms.

This requirement touches repository CI and the repository test suites. It does not change the CLI, Studio, `harness/` file formats, `backlog/` file formats, adapter contract, or runtime behavior.

### Environment boundary

A test may depend on:

- tracked repository files;
- fixtures and temporary state created by that test or its setup;
- dependency versions declared by the repository lockfiles;
- executables explicitly required by the repository's documented test setup; and
- environment values explicitly set by the test or the CI test command.

A test may not require or use as an undeclared input:

- the developer or runner's global or system Git configuration;
- an identity inferred from the operating-system user;
- pre-existing untracked files or directories in the checkout;
- files in the runner's normal home directory;
- environment variables inherited from a developer login shell; or
- repository state left by an earlier test unless that state is part of an explicit shared fixture.

A test may inspect existence in order to verify or refuse unsafe state. It may not use pre-existing machine state to determine the expected classification or verdict. Tests that need both present and absent cases must construct both cases themselves.

## User story

As a **maintainer**, I want every required test suite to run before merge in a fresh Linux checkout with isolated Git and home configuration, so that a change cannot be accepted only because my machine supplies undeclared state.

As a **contributor**, I want a failed test to identify the missing repository-controlled setup, so that I can reproduce the intended condition without copying configuration from a maintainer's machine.

## Acceptance criteria

1. **Required pre-merge guard — repository CI.** CI contains a required pre-merge check that runs on Linux from a newly checked-out repository. A change cannot satisfy the repository's merge checks unless this check passes.

2. **Fresh checkout — repository CI.** Before dependencies are installed or tests run, the check verifies that `.harness/worktrees` and `.quorum/runs` do not exist. If either path already exists, the check stops with an error naming the unexpected path. The check must not delete the path and continue.

3. **Isolated home and Git configuration — repository CI.** The check runs with a newly created, initially empty home directory; ignores system Git configuration; does not read the runner's normal global Git configuration; and unsets inherited `GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `EMAIL`, and equivalent identity values used by the implementation. The isolated configuration sets Git's `user.useConfigOnly` behavior so Git cannot infer an identity from the operating-system user.

4. **Discriminating identity measurement — repository CI.** Before running the repository suites, the check performs and reports both of these probes in a temporary repository:
   1. creating a commit without an explicitly supplied name and email fails because no identity is configured; and
   2. creating a commit with command-scoped `user.name` and `user.email` succeeds.
   The check fails if either outcome differs. Empty `GIT_COMMITTER_NAME` or `GIT_COMMITTER_EMAIL` values must not be used for this probe because they override valid command-scoped configuration and would also reject corrected code.

5. **Documented local measurement — repository test documentation.** The implementation records the exact isolation command or script used by CI and the result of running it locally on macOS. The documentation states that merely pointing `GIT_CONFIG_GLOBAL` at an empty file is not a valid discriminator when Git can infer identity from the operating-system user. If the full CI isolation cannot be reproduced locally, the documentation identifies the required Linux pre-merge check as the authoritative guard and provides the closest local command without claiming equivalent coverage.

6. **Complete suites — repository CI.** In the isolated checkout, the check installs dependencies using `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`, then runs both `npm test --prefix spike` and `pnpm turbo run test --force`. A suite that was skipped, filtered, or not installed is not reported as passing.

7. **No state carried between suites — repository CI.** Each of the two required suites either receives its own fresh checkout or the check verifies before the second suite that no repository state created by the first suite can affect its result. Dependency directories and declared build outputs may be retained. Any other retained state must be named explicitly in the check and justified in test documentation.

8. **Actionable failure — repository CI.** When isolation setup, either identity probe, dependency installation, or either test suite fails, the required check fails with a message that distinguishes those phases and includes the failing command's output. It must not retry under the runner's normal home or Git configuration.

9. **Git operations in tests — repository test suites.** Any test that creates a commit, merge commit, annotated tag, stash commit, or equivalent Git object requiring an author or committer identity supplies the required identity as test-controlled input. This may be provided by command-scoped Git configuration or by setup local to that test's temporary repository. It may not be supplied through the runner's global Git configuration.

10. **Filesystem-dependent cases — repository test suites.** A test whose expected result depends on whether a file or directory exists creates the required present and absent states within its own fixture or setup. Repository inventory classification uses repository-controlled inventory, such as tracked-file data, rather than unrelated paths already present in the checkout. Existence checks whose contract is to refuse unsafe state remain permitted.

11. **Regression evidence — repository CI.** Automated verification demonstrates that the isolated check rejects a temporary Git operation that relies on implicit identity and accepts the same operation when identity is explicit. Automated verification also demonstrates that the test command begins without `.harness/worktrees` and `.quorum/runs`. This evidence must not require reverting or modifying the already-corrected `diff.test.ts` merge calls.

12. **No broad source scan required — repository lint rules.** This ticket does not add a repository-wide textual scan for Git subcommand names or `fs.existsSync`. If implementation introduces a narrowly scoped structural check in addition to the CI guard, it must support command wrappers and argument arrays without treating comments or unrelated strings as violations, and it must not replace acceptance criteria 1–11.

13. **Runtime behavior unchanged — CLI and core.** Running the new check changes no production behavior, creates no persistent product state, and adds no runtime dependency. Temporary directories created by the check are confined to the CI environment or operating-system temporary directory.

14. **Existing behavior remains green — repository test suites.** The mock-adapter end-to-end regression suite remains green. The four existence checks preserved by Q-0073 because they refuse unsafe state remain unchanged and covered by their existing tests.

15. **Cold-clone impact — repository documentation.** The new guard adds no step to the adopter's `npx quorum` path and no requirement to configure Git identity globally. Any material increase in pre-merge CI duration is reported in the solution document with the previous and new elapsed times.

16. **Cross-cutting quality checklist.** The completed solution records all of the following:
   1. BYOS: no API-key path, fixture, or documentation example is added;
   2. worktree safety: the guard does not run a flow or write to a user's working tree;
   3. gate behavior: not applicable; no gate behavior changes;
   4. files and schemas: no persistent product file or schema changes;
   5. cross-vendor rule: not applicable; no flow or adapter behavior changes;
   6. product-agnostic behavior: the guard contains no SaaS-specific knowledge;
   7. lint rules: no broad source scan is treated as coverage for this defect class; and
   8. cold-clone behavior: no adopter setup step or global Git configuration is added.

## Non-goals

- Reapplying or changing commit `cf3b2e6`. The three corrected merge calls in `diff.test.ts` are not part of this implementation.
- Treating the current correctness of `diff.test.ts` as proof that the defect class is closed.
- Changing the four Q-0073 existence checks that deliberately refuse unsafe state.
- Banning filesystem access, temporary directories, the Git executable, or other declared test dependencies.
- Banning all uses of `fs.existsSync`; whether an existence check is valid depends on its contract and controlled setup.
- Building a general static analyzer for environmental dependencies.
- Making a Git-subcommand source scan the primary guard.
- Requiring contributors to remove or rewrite their personal Git configuration.
- Changing `harness ticket new` or fixing the `T-0001` allocator defect. That defect requires a separate ticket.
- Changing a flow, gate, adapter, contract, ticket schema, Studio behavior, or product runtime behavior.
- Adding a remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suite, Gemini adapter, or desktop shell.

## Open questions

1. **Which existing CI definition must become the required pre-merge check?** Owner: maintainer. This is an implementation-location decision, not a scope decision; the selected check must satisfy acceptance criteria 1–8.

2. **Can the two suites safely share one isolated checkout after dependency installation?** Owner: engineer. If retained state beyond dependencies and declared build outputs cannot be exhaustively identified, use separate fresh checkouts as required by acceptance criterion 7.

3. **What is the measured duration increase?** Owner: engineer. Record the before-and-after pre-merge CI duration. A duration increase does not waive the guard, but it may justify consolidating an existing Linux test run instead of adding a duplicate matrix entry.

4. **Does the repository's CI platform support marking this check as required in version-controlled configuration?** Owner: maintainer. If required-check policy is stored outside the repository, the solution document must name the external setting and provide evidence that it is enabled before this ticket is accepted.

5. **Is the full isolation command behavior equivalent on macOS?** Owner: engineer. Measure it as required by acceptance criterion 5; do not assume equivalence. This does not block the Linux guard because Linux is the authoritative environment for this defect.

## Risks

- A clean Linux check can become false reassurance if it silently reads runner-level Git configuration. The two identity probes make that isolation observable.
- Environment variables can override command-scoped Git configuration. Incorrectly setting empty author or committer variables would make both defective and corrected code fail; the positive probe prevents this setup error.
- Reusing a checkout between suites can reintroduce order dependence. Separate checkouts are the fallback when retained state cannot be bounded.
- A second full matrix entry may increase CI time and resource use. Consolidating the existing Linux test execution into the isolated check is preferable when it preserves required coverage.
- A textual source scan would be cheap but partial and brittle. Treating it as the main solution would leave filesystem and future environmental dependencies undetected.
- Some tests legitimately verify refusal when unsafe paths exist. An over-broad ban on existence checks could weaken safety coverage; the requirement distinguishes refusal from classification.
- CI required-check policy may live outside version control and drift. Acceptance requires evidence that the isolated check is actually merge-blocking.
