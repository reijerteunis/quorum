# Q-0098 — `quorum` is a runnable binary, and what `npx quorum` may claim

*Stage: draft · Iteration 1 · 2026-09-02 · Surfaces: CLI (`packages/cli`) and documentation (`docs/`).*

**Verdict: needs-input.** Q-0097 has supplied the emitted artifact, but two requirements are not yet implementable as written:

1. The current CLI frame implements only `help`, and both an unknown command and no command deliberately exit 0. AC-17 therefore has no permitted way to observe a non-zero status through the binary before a command ticket lands.
2. A packed `@quorum/cli` still declares `@quorum/core` and `@quorum/shared` as dependencies. A clean temporary project cannot install that tarball without resolving those unpublished packages, even though the current production imports are erased during emit.

These findings require an erratum or an explicit sequencing decision before implementation. They must not be hidden with test-only binary behaviour, registry access, or a skipped assertion.

## Problem

A cold-clone adopter or maintainer can build JavaScript for `packages/cli`, but the repository does not yet prove that the manifest’s `quorum` entry is an executable program. It also does not distinguish three materially different ways of obtaining that program:

- executing the workspace-local package;
- installing locally produced package tarballs;
- asking a package runner to resolve `quorum` from a public registry.

Only the first two may be claimed before Q-0029. Without process-boundary and package-boundary tests, Vitest can continue to pass while the shipped entry point is absent, non-executable, loses exit codes, contains repository-only files, or is accidentally supplied by an unrelated public package.

Q-0097 is a precondition because this ticket executes its emitted artifact. The decision *“The emit serves the binary, and no test verdict moves behind it”* (2026-09-02) is already landed and governs the artifact location, package contents, source-versus-emit boundary, and permitted `npx quorum` claims.

## User stories

**Cold-clone adopter — CLI.** As a cold-clone adopter who has installed and built the workspace, I want the repository-local `quorum help` command to execute under Node and print its command list, so that I can tell that the documented command is backed by a real artifact.

**Maintainer — CLI.** As a maintainer, I want executable permissions, exit statuses, and binary resolution verified across an operating-system process boundary, so that an in-process test cannot conceal a broken launcher or a registry fallback.

**Contributor — CLI.** As a contributor preparing a local package, I want the tarball’s contents and runtime dependencies tested outside the workspace, so that repository symlinks, caches, tests, and build logs cannot make an incomplete distribution appear runnable.

**Cold-clone adopter — documentation.** As a cold-clone adopter, I want documentation to distinguish repository-local use, locally packed use, and public-registry installation, so that I am not instructed to obtain an unpublished product from a registry.

## Acceptance criteria

### AC-15 — `quorum help` runs from the built workspace artifact

Surface: CLI (`packages/cli`).

After a frozen-lockfile install and the workspace build, a test reads `packages/cli/package.json`, resolves the non-empty `bin.quorum` value relative to that package, and spawns that exact file with `process.execPath` and the argument `help`.

The spawned process:

- executes without Vitest or a TypeScript runtime loader;
- prints the CLI frame’s command list to stdout;
- exits with status 0; and
- is positively identified as the file named by `bin.quorum` inside `packages/cli`.

The implementation record includes the demonstrated red result from the pre-change revision: the manifest target cannot be executed because it does not exist. A missing target, missing build output, or skipped spawn is a failure, not a passing test.

### AC-16 — the manifest target is a directly executable Node program

Surface: CLI (`packages/cli`).

The file named by `bin.quorum` begins with the exact bytes `#!/usr/bin/env node` followed by a line ending. No banner, byte-order mark, or whitespace precedes the shebang.

On platforms that expose POSIX mode bits, at least one execute bit is set (`mode & 0o111` is non-zero). On other platforms, the test emits an explicit skip reason identifying the unavailable mode check; it does not report that assertion as passed.

The test also invokes the target directly where the platform supports doing so and confirms that `help` exits 0. Plain-Node execution from AC-15 remains separately required.

### AC-17 — a non-zero CLI status crosses the process boundary unchanged

Surface: CLI (`packages/cli`).

A test spawns the built binary through a real, supported CLI input that deterministically produces one status from the existing table: 1 for error, 2 for an operator abort, 3 for an undecided run, or 130 for interruption. The status observed by the parent process equals the selected table value.

The test must not add a test-only command, environment variable, package export, or production branch whose only purpose is to force an exit status. It must not use an unknown command: the preserved Q-0090 defect is that an unknown command prints help and exits 0.

**Blocked pending OQ-1:** the current frame implements only `help`, so no qualifying non-zero input exists before at least one command ticket lands.

### AC-18 — workspace execution uses the local package and cannot fall back

Surface: CLI (`packages/cli`).

The supported workspace mechanism is:

```text
pnpm --filter @quorum/cli exec quorum help
```

After install and build, that command exits 0 and prints the command list. The test resolves the executable used by the command and asserts that its canonical path is the `bin.quorum` target within the repository’s `packages/cli` directory.

The test environment disables package-runner installation and registry fallback. Removing or renaming the local target makes the test fail. This ticket does not introduce a synthetic workspace consumer solely to create a command shim.

### AC-19 — the local distribution set installs and runs outside the workspace

Surface: CLI (`packages/cli`).

The CLI is packed with `pnpm pack`. The resulting package manifest declares a `files` allow-list. Inspection of the pack result proves that it contains:

- the file named by `bin.quorum`;
- all emitted JavaScript and declarations required by the CLI package contract; and
- any package-relative runtime assets required by the launcher.

The pack result contains no source tests, snapshots, coverage output, Turbo logs, `.turbo` content, run history, worktrees, or other repository-only material.

The fixture creates a project under `os.tmpdir()`, outside the repository. It has no workspace symlinks and cannot read repository `node_modules`. It installs the complete local distribution set required by the CLI, invokes the installed `quorum help`, asserts status 0 and the command list, then removes the fixture.

The fixture records the file manifests produced by both `pnpm pack` and `npm pack --dry-run`. A difference affecting the declared distribution contract fails with both manifests in the diagnostic output.

The implementation report states whether the tested CLI contains a runtime value import from another workspace package. If it does not, the report repeats decision clause (g): the test proves only the pre-command, dependency-light case.

**Blocked pending OQ-2:** the requirement must specify whether `@quorum/core` and `@quorum/shared` are installed as companion local tarballs, bundled into the CLI, or removed from the packed CLI’s runtime dependency set. A standalone install cannot silently fetch their unpublished versions.

### AC-20 — registry resolution cannot satisfy either execution verdict

Surface: CLI (`packages/cli`).

Both AC-18 and AC-19 configure package execution so that a missing local `quorum` fails immediately. The packed fixture additionally uses an explicit offline installation guarantee or a test-controlled registry endpoint that always fails.

Each path positively records and asserts the canonical path of the executed binary:

- AC-18 resolves inside the workspace’s `packages/cli` directory;
- AC-19 resolves inside the temporary project’s installation.

No assertion depends on network availability, a user-level package cache, a globally installed executable, or the current contents of a public registry. A public package named `quorum` can neither satisfy nor alter either verdict.

This criterion covers all packages needed by the local distribution set, not only the top-level CLI tarball.

### AC-21 — documentation separates the three installation claims

Surface: documentation (`docs/`).

Repository documentation states separately that:

1. workspace-local execution is supported by the exact command established in AC-18;
2. installation from the locally produced distribution set is supported by AC-19; and
3. registry-resolved `npx quorum` is unsupported until Q-0029 in M6.

`docs/04-architecture.md` no longer says or implies that a cold machine can currently obtain Quorum by running registry-resolved `npx quorum`. Its status line records the landing date and Q-0098. Relevant bullets in `docs/06-development-plan.md` use the same distinction.

A documentation test scans the files changed by this ticket, plus the governing decision entry, for the three claims. It fails if a README, architecture statement, development-plan bullet, test name, or success message presents registry resolution as working.

If this change uses a new domain term in more than one file, that term is defined in `docs/GLOSSARY.md` before the second use. If it introduces no vocabulary, the implementation report says so.

## Non-goals

- Defining or changing the export surface of `@quorum/core`; that belongs to Q-0096.
- Changing the build task, emit strategy, cache outputs, or source-versus-emit resolution; those belong to Q-0097 and the landed decision.
- Publishing any package or supporting public-registry installation; that belongs to Q-0029 in M6.
- Implementing a CLI command to manufacture a subject for AC-17; command behaviour belongs to Q-0091 through Q-0094.
- Running the complete mock-adapter end-to-end suite through the binary; that belongs to Q-0095.
- Guaranteeing that Q-0093’s future `init` command can find template assets. This ticket preserves the decided binary depth and package-content constraint but does not implement `init` or create missing templates.
- Adding source maps or making claims about emitted stack traces unless OQ-3 explicitly includes them.
- Changing any file under `spike/`, including spike tests.
- Publishing, global installation, remote execution, a desktop shell, cloud sync, or a plugin marketplace.

## Open questions

### OQ-1 — what existing input supplies AC-17’s non-zero process status?

**Owner:** maintainer. **Blocking.**

The current CLI frame registers only `help`; unknown and absent commands deliberately print help and exit 0. Choose one:

- sequence Q-0098 after the first command ticket that supplies a deterministic non-zero path, and name that path in AC-17; or
- move AC-17 to that command ticket or Q-0095 through an erratum.

Adding test-only production behaviour is not an acceptable resolution.

### OQ-2 — what is the locally installable distribution set?

**Owner:** maintainer. **Blocking.**

`@quorum/cli` declares workspace dependencies on unpublished `@quorum/core` and `@quorum/shared`. Even when their imports are erased from current JavaScript, an external package installation resolves declared dependencies.

Choose and record one distribution contract:

- pack and install CLI, core, and shared as companion local tarballs;
- bundle runtime workspace dependencies into the CLI under a new architectural decision; or
- prove that the CLI tarball legitimately omits those runtime dependencies, including the post-Q-0091 case against which the emit decision was made.

The answer must not use public registry access or repository symlinks.

### OQ-3 — are source maps part of the package contract?

**Owner:** maintainer. **Non-blocking if answered “no” before implementation.**

If yes, AC-19’s allow-list and manifest assertions must include them and tests must state what paths emitted stack traces expose. If no, the implementation report records that this ticket makes no source-map or emitted-stack-trace guarantee.

### OQ-4 — is the packed half still in this run?

**Owner:** maintainer. **Non-blocking until the run approaches its bound.**

AC-19 and the packed half of AC-20 are off M2’s critical path. If the run must be cut, move those portions together into a successor ticket. Keep AC-15 through AC-18, the workspace half of AC-20, and the registry-claim correction in AC-21 here. Credential and registry-resolution guarantees must not be weakened to reduce scope.

## Risks

- **False process coverage.** Importing `main()` or executing the launcher inside Vitest would not prove the manifest path, shebang, mode, or shell-visible status. AC-15 through AC-17 require child processes.
- **A test-only exit path becomes product behaviour.** AC-17 currently lacks a subject. Solving that by adding hidden CLI behaviour would expand the product contract and evade the sequencing problem.
- **The packed test succeeds through the workspace.** Symlinks, repository `node_modules`, a shared package-manager store, or implicit registry access could conceal a missing distribution dependency. AC-19 and AC-20 require an external, offline fixture and positive path assertions.
- **The package allow-list omits future assets.** The binary’s depth relative to template assets is load-bearing for Q-0093. The contract must fail closed when a required runtime asset is introduced.
- **Platform-dependent executable checks become silent passes.** POSIX mode checks are unavailable on some platforms. Explicit skips preserve the distinction between “not examined” and “passed.”
- **Documentation continues to overclaim registry availability.** Existing architecture and plan text uses `npx quorum` without naming its resolution source. AC-21 requires a three-way distinction rather than a wording-only edit.
- **Known defects are fixed incidentally.** Unknown commands and regressed runs currently exit 0. This ticket reports those behaviours and does not alter them.

### Cross-cutting checklist

| Concern | Requirement |
| --- | --- |
| BYOS | No subscription-handling path changes. Tests and documentation add no API-key mechanism or secret fixture. Existing credential scans remain green. |
| Worktree safety | Runtime fixtures use `os.tmpdir()` and write neither the user’s working tree nor `.harness/worktrees/`. No flow behaviour changes. |
| Gate behaviour | Not applicable to binary packaging. Existing exit meanings, including undecided = 3 and interrupted = 130, remain unchanged. |
| Files and schemas | `package.json` fields and packed file manifests are the only persistent contract changes. No product data format or schema changes. |
| Lint and tests | TypeScript remains strict; no `any`, suppression, deprecated API, or new dependency is introduced without its required justification. Both workspace and spike suites remain required, although `spike/` is unchanged. |
| Cold-clone impact | Positive for workspace-local use: the documented binary becomes executable after install and build. Registry-backed cold-machine use remains explicitly unsupported until Q-0029. |
| Product agnosticism | No SaaS-specific behaviour or documentation is introduced. |
| Error handling | Missing artifacts, missing local packages, forbidden registry resolution, pack divergence, and unsupported mode checks produce explicit failures or explicit skips; none defaults to success. |

Before the first chore run, confirm that `harness/Q-0098/integration` exists. Do not run Q-0098 concurrently with Q-0096 or Q-0097 while Q-0039 remains unfixed.
