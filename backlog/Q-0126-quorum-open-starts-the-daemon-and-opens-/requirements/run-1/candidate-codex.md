# Q-0126 — `quorum open` starts the daemon and opens a browser

## Problem

The Studio is built and the daemon can serve it, but neither the solo maintainer nor the cold-clone adopter has a product command that starts the daemon and opens the Studio. Today the daemon runs only from its test suite.

The missing command crosses three existing boundaries:

- The CLI may not import filesystem or process-spawning modules. Opening a browser therefore cannot be implemented directly in `packages/cli`.
- `@quorum/server` emits a resolvable artifact but is not in the local distribution set. Declaring it as a required `@quorum/cli` dependency makes the locally packed installation fail before any command runs.
- The daemon currently has no product port or command-owned lifecycle. `quorum open` must define both, including what happens when another process already holds the port.

This ticket touches the CLI and the local daemon + Studio surfaces. It does not add or change a Studio screen.

## User story

As a **solo maintainer**, I want one CLI command to start Quorum’s local daemon and open the Studio for my current project, so that I do not have to start or connect the two surfaces separately.

As a **cold-clone adopter**, I want the command either to open the Studio or explain precisely why it cannot, so that a missing daemon package, a failed installation, a busy port, and a failed browser launch are not presented as the same condition.

## Acceptance criteria

1. **CLI — command registration.** `quorum help` lists `quorum open [--no-open]` and describes it as starting the local daemon and, unless suppressed, opening the Studio. `open` is present in the same derived command register used for dispatch, so help and dispatch cannot drift.

2. **CLI — accepted command shape.** `quorum open` accepts no positional arguments. `quorum open --no-open` is the only command-specific flag introduced by this ticket. A positional argument or an unsupported command-specific value is refused with a non-zero exit status and a message that shows the accepted form.

3. **Workspace-local path — end-to-end start.** After `pnpm install --frozen-lockfile` and `pnpm turbo run build`, running `pnpm exec quorum open --no-open` from a valid project starts the daemon on `127.0.0.1:7717`, serves the built Studio at `http://127.0.0.1:7717/`, and prints that exact URL once the socket is listening. The success message is not printed before the bind and bundle checks have completed.

4. **Daemon — fixed product port.** Port `7717` is the product port for `quorum open` and remains the default used by the Studio development proxy. This ticket does not add a configurable host or port flag. Tests use an isolated fixture or injected launch boundary and do not require the developer machine’s port 7717 to be free.

5. **Daemon — occupied port.** If `127.0.0.1:7717` cannot be bound, `quorum open` refuses promptly with a non-zero exit status and a message that identifies `127.0.0.1:7717` as unavailable. It does not open a browser, does not claim that the Studio started, and does not terminate or attach to the process already using the port.

6. **CLI — project and bundle failures.** If the current directory is not a Quorum project, or if the built Studio bundle is absent or invalid, the command refuses before opening a browser. The message distinguishes the failed condition and gives the CLI-level remedy. No listener or live run remains after the refusal.

7. **Browser launch — default behaviour.** After the daemon has successfully bound, `quorum open` asks the platform launch boundary to open `http://127.0.0.1:7717/` exactly once. The URL is passed as one literal argument and is never interpreted as shell input.

8. **Browser launch — supported platforms.** The launch boundary supports macOS, Linux, and Windows using an argument-based process API rather than a shell-composed command. An unsupported platform returns an explicit unsupported-platform result; it does not guess a command.

9. **Browser launch — `--no-open`.** `quorum open --no-open` starts and retains the daemon but performs no browser-launch attempt. The command still prints the Studio URL so it can be opened manually or forwarded from an SSH session. SSH detection does not silently change the default behaviour.

10. **Browser launch — failure is a warning.** If the daemon is listening but the browser cannot be launched, the command writes a warning that includes the Studio URL and states that the daemon is still running. Browser-launch failure does not shut down the daemon and is not reported as daemon-start failure.

11. **Lifecycle — foreground ownership.** `quorum open` owns the daemon as a foreground command. It remains active after starting the daemon and does not infer lifecycle from the browser process. Closing the browser has no effect on the daemon.

12. **Lifecycle — signals.** On the first `SIGINT` or `SIGTERM`, the CLI awaits the daemon’s `close()`, which shuts down the run host before the socket, and then terminates successfully. Every live run is released through the existing abandonment path. Signal handling remains in the CLI; neither `packages/core` nor `packages/server` installs a process-level signal handler.

13. **Lifecycle — shutdown failure.** If daemon shutdown fails, the command reports the failure and terminates non-zero. A second termination signal may force normal process termination; the command must not install an unbounded sequence of signal listeners.

14. **CLI architecture — no direct I/O expansion.** No production module in `packages/cli` imports `node:child_process`, `node:fs`, `node:os`, or `node:url`. The command module remains orchestration over public package contracts and the CLI’s existing output, remedy, and signal-handling boundaries.

15. **Browser-launch contract.** The process-spawning implementation has a typed public contract that distinguishes at least: launched, unsupported platform, executable unavailable, and launch failed. It contains no `any`, does not invoke a shell for macOS or Linux, and has unit tests that prove the selected executable and argument list for each supported platform without opening a real browser.

16. **Dependency route guard.** The existing namespace-import route check is updated narrowly for the approved `@quorum/server` loading route. It must continue to reject namespace imports used to bypass named adapter or CLI-version routes. A blanket removal or weakening of clause D does not satisfy this criterion.

17. **Packed path — installation regression.** The Q-0098 packed fixture still installs the three distribution tarballs outside the workspace with the registry unavailable, and both `quorum help` and an existing non-`open` command still run. The test uses the emitted CLI with `open` wired into the real handler and command registers; a source import that TypeScript can elide is not evidence.

18. **Packed path — `open` outcome.** If the selected distribution design intentionally leaves `@quorum/server` absent from the packed installation, packed `quorum open` refuses non-zero with a message that distinguishes “this installation does not include the daemon” from “the daemon package was expected but failed to load.” It does not present an arbitrary dynamic-import failure or suggest registry-resolved `npx quorum` as a remedy.

19. **Dependency loading.** If `@quorum/server` may be absent, the production `open` handler loads it only when `open` is dispatched. Emitted `quorum help`, `init`, and every other command must not resolve or evaluate the server module. Tests inspect or execute the emitted artifact, not only the TypeScript source.

20. **Manifest and lockfile.** The selected `@quorum/server` dependency classification is represented in `packages/cli/package.json`, the committed lockfile, and the packed-install fixture. `pnpm install --frozen-lockfile` succeeds from the committed change.

21. **Existing guards.** The command registry, derived barrel, frame/command partition, frame-implements-no-command, test-discovery, package dependency, and emitted-artifact guards are updated to describe the new intentional state. They remain capable of failing when a future command, dependency, import route, or emitter is added without its corresponding register update.

22. **Regression suite.** Tests cover successful startup, `--no-open`, browser-launch success and failure, unsupported platform, unavailable browser command, missing project, missing bundle, occupied port, `SIGINT`, `SIGTERM`, shutdown failure, packed installation, emitted help, and emitted non-`open` dispatch. The mock-adapter end-to-end suite remains green.

23. **Verification commands.** The implementation is verified with `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, `pnpm typecheck`, and the workspace-local emitted invocation. No test opens a real browser, depends on ambient SSH variables, or uses a developer machine property as its verdict.

24. **Documentation and decisions.** The architecture and development-plan descriptions are updated to state the shipped command, its port, lifecycle, browser-launch ownership, and packed-path limitation. Any choice that changes package ownership, the local distribution set, or the meaning of a landed dependency/import guard is recorded in a new append-only decision entry before implementation contradicts the existing entries.

25. **BYOS.** This command adds no subscription configuration path and does not weaken adapter checks. No code, test, fixture, help text, or documentation introduced by this ticket accepts an API key.

26. **Worktree safety.** Starting the Studio does not itself start a flow or write to the user’s working tree. Any flow later started through the daemon remains subject to the existing worktree and integration-branch enforcement in `core`.

27. **Files are the database.** The command adds no daemon registry, lock file, preference, port file, or browser state. Persistent project and run state remains in the existing repository files and `.quorum/` locations.

28. **Gate behaviour and cross-vendor rule.** Starting or stopping the daemon does not answer a gate, change `auto`, override a human-locked gate, or alter cross-vendor validation. These properties are covered as regression checks rather than new behaviour.

29. **Product scope.** The implementation contains no SaaS-product-specific behaviour, remote-daemon mode, authentication surface, telemetry, or cloud dependency.

## Non-goals

- Building or changing the gate screen; that remains Q-0016.
- Making the CLI and Studio answer the same gate; this ticket makes the Studio reachable only.
- Adding or changing any Studio screen.
- Settling the complete local distribution set governed by Q-0124, except where a narrow interim dependency classification is required for this command.
- Changing the `@quorum/server` export surface delivered by Q-0125 beyond a separately approved contract needed by this command.
- Publishing any package or supporting registry-resolved `npx quorum`.
- Starting a detached or background daemon.
- Reusing an already-running daemon, discovering it, replacing it, or terminating the process holding port 7717.
- A configurable bind address, remote daemon, multi-user access, authentication, TLS, cloud sync, or desktop shell.
- Automatically detecting SSH, containers, headless Linux, WSL, or user browser preferences.
- Observing browser closure or tying daemon lifecycle to the browser process.
- Persisting the selected port or browser preference.
- Installing a browser or a platform opener.
- Changing flow execution, gate semantics, adapter contracts, subscription checks, worktree placement, or file formats.

## Open questions

1. **Blocker — local distribution behaviour. Owner: product manager and maintainer at the ticket gate.** Is it acceptable for Q-0126 to support Studio startup only on the workspace-local path while preserving all existing packed commands? The measured interim design is `@quorum/server` in `optionalDependencies` plus a dynamic import inside the `open` handler. Its cost is that an intentionally absent package and some damaged installations can otherwise look identical. If this limitation is not acceptable, Q-0126 remains blocked on Q-0124 selecting and testing a distribution route for both the daemon and Studio bundle.

2. **Blocker — distinguishing an intentional omission from a broken install. Owner: engineer, approved by product manager.** If the interim packed design is selected, what deterministic evidence lets `quorum open` distinguish an intentionally daemon-less three-tarball installation from a workspace or future distribution that expected `@quorum/server` to resolve? The answer may use package-owned build metadata, but it may not depend on an online registry probe, ambient workspace layout, or treating every dynamic-import error as absence.

3. **Blocker — browser-launch ownership. Owner: architecture decision author.** Which package owns the browser-launch contract? `packages/cli` is prohibited from spawning; `packages/core` already owns CLI process execution but architecture principle 1 says it has no I/O it does not own; `packages/server` owns the daemon process but browser launch is a command-surface concern. The choice must be recorded before implementation and must not expose a general-purpose arbitrary command runner merely to open one URL.

4. **Blocker — Windows launch contract. Owner: engineer, approved by architecture decision author.** What argument-based Windows mechanism satisfies the no-shell-injection requirement? Windows `start` is normally a `cmd.exe` built-in rather than an executable. The implementation must either specify a proven safe `cmd.exe` argument contract, choose a small justified library, or explicitly refuse Windows in this ticket. The acceptance criterion must be adjusted if Windows is refused; it must not be silently treated as supported.

5. **Non-blocking if criteria 3–5 are accepted — product port. Owner: product manager.** This draft selects fixed port 7717 and refusal on collision. Should the product instead request an operating-system-assigned port and pass the returned URL to the browser? That would remove second-invocation collision but would diverge from the Studio development proxy convention and make a stable manually entered URL unavailable.

6. **Non-blocking if criteria 9–10 are accepted — headless environments. Owner: product manager.** This draft requires explicit `--no-open` and makes no SSH inference. Is automatic suppression over SSH required for M3? If yes, the exact environment evidence, precedence relative to `--no-open`, and behaviour when that evidence is ambiguous must be specified and tested without using the developer machine as the oracle.

## Risks

- Making `@quorum/server` optional can turn a failed installation into an apparently intentional omission unless the command has positive evidence of which installation shape it is running.
- A static server import can break every packed CLI command even when `open` is never invoked. A source-level test can miss this if TypeScript elides an unused import.
- Weakening the namespace-import guard broadly to permit one dynamic import could reopen the adapter version-route bypass the guard was written to prevent.
- A fixed port gives a predictable URL but makes concurrent invocations collide. The explicit refusal avoids attaching to or terminating an unrelated process, but the maintainer must stop the first command manually.
- Browser launch is platform-specific. Windows shell semantics create an injection risk if a URL is composed into a command string.
- A browser-launch failure occurs after the daemon has started. Treating it as fatal would leave lifecycle ambiguous; treating it as success without a warning would make the command appear to have completed its promise.
- Foreground lifecycle means the initiating terminal remains occupied. Background daemon management is deliberately outside this ticket, but adopters may initially expect the command to return.
- Signal handling can abandon live runs. The required shutdown order preserves the existing abandonment path, but abrupt process termination can still prevent graceful cleanup.
- Locating the built Studio bundle without filesystem logic in the CLI may pressure package boundaries. Bundle discovery must stay behind the package contract selected in the architecture decision.
- Adding a new dependency edge and command changes several derived registers. Updating expected counts without preserving their ability to detect the next unregistered change would weaken existing architecture protection.
