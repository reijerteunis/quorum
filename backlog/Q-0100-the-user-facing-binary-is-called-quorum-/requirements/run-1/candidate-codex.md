# Q-0100 requirements — The user-facing binary is called `quorum`, not `harness`

## Problem

The installed CLI binary is named `quorum`, but several CLI messages instruct an adopter to execute `harness`. Following those instructions fails because they name the wrong executable.

One affected message comes from `ProjectNotFoundError` in `packages/core`. That error can also be consumed by the M3 server, where command-line recovery advice is inappropriate. Core should report the domain failure; the CLI should add recovery advice for its own surface.

This change touches the **CLI** and the public error exposed by **core**. It does not rename the `harness/` surface or the harness concept.

## User story

As a **cold-clone adopter**, I want every command shown by the CLI to use the installed `quorum` binary name, so that I can copy or follow the instruction successfully.

As a **contributor**, I want core errors to describe the domain failure without assuming a terminal surface, so that the same error can later be presented appropriately by either the CLI or the Studio server.

## Acceptance criteria

1. **Decision recorded before implementation.** Before production code changes, an append-only decision entry records that `ProjectNotFoundError` contains only the surface-neutral project-discovery failure and that each presentation surface owns its recovery advice. The entry names the CLI and the future M3 server as separate consumers, updates `docs/DECISIONS.md`, and does not rename `harness/` or the harness concept.

2. **Adapters instruction.** Running `quorum adapters` without `--probe` prints the existing presence-only notice with ``quorum adapters --probe`` as the suggested command. The notice contains no instruction to execute `harness`.

3. **Board hint.** For every board column that has a matching flow, `quorum board` renders `→ quorum run <flow> <id>`. Columns without a matching flow retain their current no-hint behaviour. Existing spacing, colour treatment, flow selection, and per-column repetition are unchanged apart from the binary name.

4. **Init next steps.** A successful `quorum init` prints the existing next-steps line with all three executable examples renamed: `quorum adapters`, `quorum ticket new "…"`, and `quorum run requirements T-0001`. The ticket id and all other init behaviour remain unchanged.

5. **Run usage.** Invoking `quorum run` without its required positional arguments prints `usage: quorum run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter mock]` and retains its existing refusal exit status.

6. **Run base-ref recovery.** Invoking `quorum run <flow> <ticket> --base` without a revision prints `--base needs a revision: quorum run <flow> <ticket> --base <ref>` and retains its existing refusal exit status.

7. **Ticket usage.** Invoking the ticket command without a supported subcommand or required creation arguments prints usage beginning `usage: quorum ticket new` and retains its existing refusal exit status.

8. **Validate usage.** Invoking `quorum validate` without both a schema file and at least one data file prints `usage: quorum validate <schema.json> <file…>` and retains its existing refusal exit status.

9. **Surface-neutral core error.** When `loadProject` cannot find `harness/harness.yaml`, it still throws `ProjectNotFoundError`, but the default error message is exactly `no harness/harness.yaml found`. The error message contains no executable command, terminal-specific recovery instruction, or renamed folder path.

10. **CLI recovery for a missing project.** Every currently dispatched CLI command that catches `ProjectNotFoundError` prints a refusal containing `no harness/harness.yaml found — run `quorum init` in your repo`. It retains its existing exit status, does not print a Node stack, and does not expose `ProjectNotFoundError` as user-facing text.

11. **Non-CLI consumers remain surface-neutral.** Constructing `new ProjectNotFoundError()` directly, or receiving it from `loadProject` without passing through the CLI, yields only the message in AC-9. Core does not import CLI code or otherwise depend on a presentation package.

12. **Mixed-use sentence remains correct.** In the missing-project output, `harness/harness.yaml` remains unchanged because it is a repository path, while the executable instruction is `quorum init`. A test asserts the complete CLI sentence so that replacing both uses with the same word cannot pass.

13. **Production inventory.** In user-facing production strings under `packages/cli/src`, every instruction to execute one of the dispatched commands uses `quorum`. No user-facing production string under `packages/core/src` instructs a person to execute `harness` or `quorum`. Tests cover the eight re-measured source locations, including all three commands within the init next-steps line.

14. **Correct harness terminology preserved.** The implementation does not rename the `harness/` directory, `harness/harness.yaml`, `harness/flows/`, `.harness/worktrees/`, `harness/<id>/integration`, or a correct use of the harness concept. Verification distinguishes command-shaped text from paths and domain prose; a repository-wide replacement of the word `harness` does not satisfy this criterion.

15. **Pinned tests move with the contract.** Every existing assertion that pins an affected user-facing string is updated in the same change. Tests that exercise `ProjectNotFoundError` through core expect the surface-neutral message; tests that exercise it through the CLI expect the CLI recovery sentence.

16. **Regression suite.** After installing dependencies with `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, and `pnpm turbo run test --force --continue` pass. The mock-adapter end-to-end coverage remains green.

17. **Cross-cutting constraints.** This change adds no subscription-authentication path, changes no adapter refusal behaviour, creates no worktree, changes no gate, persists no new data, changes no schema or flow lint rule, and adds no vendor-specific product knowledge. The workspace-local and locally packed CLI paths continue to work; no output or test claims that registry-resolved `npx quorum` is available.

## Non-goals

- Renaming the `harness/` folder, `harness/harness.yaml`, `.harness/worktrees/`, harness branches, or the harness concept.
- Changing prose that correctly uses “harness” as a domain term rather than as an executable name.
- Changing the adapter BYOS refusal string `Harness runs on subscription OAuth only`; that belongs to Q-0068.
- Renaming exported symbols such as `ProjectNotFoundError`, changing how projects are discovered, or changing the error type thrown by `loadProject`.
- Designing the M3 server’s HTTP status, response body, or Studio recovery action. This ticket only ensures core does not prescribe a CLI command to those surfaces.
- Adding a shared error-rendering framework or central command-name constant unless the existing implementation already has an appropriate presentation-layer location.
- Publishing packages or claiming that registry-resolved `npx quorum` works; that belongs to Q-0029.
- Editing or restoring the deleted `spike/` tree or `packages/core/src/spike-parity.test.ts`.
- Any change to command arguments, command dispatch, output colouring, exit statuses, board flow selection, or init scaffolding beyond the messages specified above.

## Open questions

No blocking product questions remain.

The M3 owner must later decide how the server maps `ProjectNotFoundError` to HTTP and how the Studio presents project-setup recovery. That decision does not change this ticket’s requirement that core expose a surface-neutral error.

## Risks

- Moving recovery advice out of core can cause inconsistent CLI output if one `ProjectNotFoundError` catch site is missed. AC-10 and command-level tests must cover every currently dispatched project-opening command.
- A blanket replacement can corrupt valid paths such as `harness/harness.yaml` while making shallow word-based tests pass. AC-12 requires an exact mixed-use sentence assertion.
- Source comments and historical documents legitimately contain command text from earlier behaviour. Treating every textual occurrence as production output would create unrelated scope; the production inventory must inspect emitted user-facing strings, while affected test expectations move with those strings.
- Tests currently encode both the old core message and the old CLI wording across several files. Updating only command-local tests could leave package, end-to-end, or source-boundary tests inconsistent.
- The architecture decision adds a sequencing dependency: production code must not land before the required decision entry.
