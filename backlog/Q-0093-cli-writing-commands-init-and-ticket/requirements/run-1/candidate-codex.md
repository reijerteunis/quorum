# Q-0093 — CLI writing commands: `init` and `ticket new`

## Problem

A cold-clone adopter’s first file-writing interactions with Quorum are `quorum init` and `quorum ticket new`. Neither command is currently available from `packages/cli`, although their domain behavior already exists in `packages/core` and the spike remains the authoritative behavioral witness until cutover.

`init` must create a usable `harness/` and `backlog/` without shipping a separately maintained copy of the harness templates. A stale copy would reintroduce defects already removed from the authoritative templates, including incorrect artifact paths for repeated runs and bounded-loop iterations.

`ticket new` must delegate allocation and creation to the existing core backlog API. Allocation must follow the prefix already present in the backlog and must refuse ambiguous or damaged state rather than guessing. Creation must never overwrite an existing ticket or occupied folder.

One existing defect is deliberately preserved: when `--owner` is omitted, `Backlog.create()` defaults the owner to `process.env.USER`, or `unknown` when that variable is absent. This ticket reports that behavior but does not decide or implement a replacement owner policy.

Surfaces touched: CLI, `harness/`, and `backlog/`. No Studio surface is involved.

## User story

As a **cold-clone adopter**, I want to initialize my repository and create its first ticket from the `quorum` CLI, so that I receive the current shipped harness and can begin with `T-0001` without manually creating files or configuring a ticket prefix.

As a **maintainer**, I want ticket allocation to follow the backlog’s existing prefix and refuse unreadable or conflicting state, so that running the command cannot silently overwrite work or introduce a second accidental numbering scheme.

As a **contributor**, I want the CLI commands to use the existing core API and one authoritative template source, so that later changes to backlog rules or shipped flows do not drift between implementations.

## Acceptance criteria

1. **CLI registration and help.** `packages/cli` registers and dispatches both `quorum init [dir]` and `quorum ticket new "<title>" [--intent "..."] [--owner <name>] [--id <ID>]`. The help text lists only implemented commands and describes these argument shapes.

2. **Initialization target.** `quorum init` resolves its optional positional directory to an absolute path. With no directory argument, it uses the current working directory. On success it creates `<target>/harness/` and ensures `<target>/backlog/` exists.

3. **Authoritative templates.** The created `harness/` contains the complete current contents of `spike/templates/harness/`, including flows, roles, `harness.yaml`, `rules.md`, `product-context.md`, and `architecture.md`. The repository has no second independently maintained template corpus: tests compare the shipped assets with `spike/templates/harness/` byte for byte, or prove that the shipped assets are derived from that directory during packaging.

4. **Installed-package operation.** `init` resolves templates relative to the installed CLI package, using the package-root relationship already fixed for `dist/quorum.js`; it does not depend on the caller’s current directory or on a sibling `spike/` directory being present at runtime. The locally packed installation containing the CLI, core, and shared tarballs includes every template needed by `init`, and `quorum init` succeeds from a temporary project outside this repository.

5. **Current artifact paths.** The harness created by `init` preserves the authoritative path behavior: every rewritable run artifact is scoped by `{run}`; artifacts written by a step that can be re-entered through a bounded loop also use `{iter}`; and each of the four intentionally flat paths remains only as a pointer beside its scoped copy. This is tested from the copied harness, not from a hand-written expectation that could pass while the shipped files are stale.

6. **Existing harness refusal.** If `<target>/harness/` already exists, `init` exits with status 1, names the absolute existing path, and does not overwrite or modify that directory. This check occurs before `backlog/` is created, so this refusal leaves a previously absent backlog absent.

7. **Base branch discovery.** After copying the harness, `init` asks Git for the target repository’s current named branch. For both a committed branch and a fresh unborn branch created with `git init -b <name>`, it sets `repo.base_branch` in the copied `harness/harness.yaml` to that branch name.

8. **Formatting-preserving branch update.** Updating `repo.base_branch` changes that scalar without discarding the template’s comments or changing unrelated values and formatting. In particular, the shipped install, base-branch, and diff-size comments remain present and `repo.max_diff_bytes` remains `200000`.

9. **Best-effort branch fallback.** Initialization still succeeds and retains the template default `repo.base_branch: main` when the target is not a Git repository, Git reports a detached HEAD, Git succeeds but returns no branch name, or branch discovery/config editing fails. Expected Git diagnostics are not leaked to stdout or stderr in these fallback cases.

10. **Initialization success output.** A successful `init` exits with status 0, prints one success message identifying the absolute target, and prints a next-steps line containing adapter discovery, ticket creation, and a requirements run for `T-0001`. Pending Q-0100, this port preserves the spike’s `harness …` command spelling in that next-steps line; this ticket does not perform a partial product-wide rename.

11. **Project and backlog resolution.** `quorum ticket new` loads the project through the existing core project loader, including ancestor discovery, `--project` behavior supplied by the common CLI frame, and a configured `backlog.path`. It does not construct an independent `backlog/` path or reimplement project discovery.

12. **Required title and intent default.** `quorum ticket new` requires a non-empty positional title. If absent, it exits 1 with `title required`. The command passes `--intent` to core when supplied; when omitted, the title is used as the intent.

13. **Optional creation fields.** `--owner <name>` is passed unchanged to `Backlog.create()`. `--id <ID>` is passed as a string and follows the same grammar, collision, and folder-occupancy checks as an automatically allocated id. No CLI-only validation may bypass or weaken the core checks.

14. **Allocation table.** Automatic allocation produces all of the following results, using the shared `spike/test/q0080-allocation.json` table rather than a separately transcribed table:

    1. An empty backlog allocates `T-0001`.
    2. `Q-0006` and `Q-0043` allocate `Q-0044`.
    3. `PROJ-0001` allocates `PROJ-0002` without prefix configuration; equivalently, a highest existing id of `PROJ-0041` allocates `PROJ-0042`.
    4. `T-0006` and `T-0007` allocate `T-0008`.
    5. `Q-0001` and `Q-0003` allocate `Q-0004`; gaps are not filled.
    6. `Q-0002` and `Q-0010` allocate `Q-0011`; comparison is numeric rather than lexicographic.
    7. Near-miss ids such as `Q-12`, `Q-00081`, `q-0081`, `Q-0002-extra`, and `Q-ABCD` do not advance a valid `Q-0005`, which therefore allocates `Q-0006`.

15. **Unreadable allocation refusals.** Automatic allocation exits 1 and reproduces the complete core refusal, including the evidence found and the action `pass --id <ID> or reconcile the backlog`, in each shared-table case:

    1. Tickets exist but none has an id matching `<PREFIX>-nnnn`; the message includes the ticket count and a sorted sample of at most three ids, with an ellipsis when more exist.
    2. More than one valid prefix exists; the message names every prefix and its count.
    3. The highest id is `<PREFIX>-9999`; the message names both that id and the invalid five-digit successor.

16. **Exact id grammar.** An explicit id is accepted only when it matches `/^[A-Z]+-[0-9]{4}$/`. Values with lowercase prefixes, fewer or more than four digits, suffixes, surrounding whitespace, a missing hyphen, or digits before the prefix are refused by core. Control characters in a rejected value are escaped so the diagnostic remains one physical line and cannot inject terminal output.

17. **No overwrite.** Before writing, creation refuses an id already represented by another backlog entry and names the folder that owns it. It separately refuses when the exact target folder is already occupied. Either refusal exits 1 and leaves the backlog byte for byte unchanged.

18. **Concurrent folder ownership.** The ticket directory is created exclusively after the backlog root is ensured. If another process occupies the directory between validation and creation, the command fails rather than accepting the directory or overwriting a `ticket.md` within it.

19. **Created ticket contents.** On success, the command creates exactly one folder named `<ID>-<slug>/` containing one `ticket.md`. The slug behavior and frontmatter serialization remain those of `Backlog.create()`. The ticket has stage `draft`, branch `harness/<ID>/integration`, priority `p2`, the current date, empty `repos`, `iterations`, and `history`, and an intent body trimmed according to the core contract. Creation does not create the named Git branch, a worktree, an index, or hidden daemon state.

20. **Sequential fresh-backlog behavior.** After `init`, three successful `ticket new` invocations with the same title create `T-0001`, `T-0002`, and `T-0003` in three distinct folders, each retaining its own `ticket.md`.

21. **Owner defect preserved and pinned.** When `--owner` is omitted, CLI coverage sets `process.env.USER` to a known value and verifies that value is written as `owner`; a second case removes `USER` and verifies `owner: unknown`. The test controls and restores the environment so its verdict does not depend on the executing account. The implementation includes the required one-line authority reference identifying this as the preserved Q-0093 defect. No alternative default is introduced here.

22. **Success and refusal presentation.** Successful ticket creation exits 0 and reports the allocated id, the created path relative to the invocation directory, and `(stage: draft)`. Expected allocation, grammar, collision, and folder refusals exit 1 as concise diagnostics without a Node stack trace.

23. **Reading remains permissive.** The stricter allocation rules do not change backlog listing, reading, id/folder resolution, board behavior, or run-history filtering. A mixed-prefix backlog remains readable even though automatic allocation refuses it.

24. **Core is the domain layer.** The CLI calls the existing `Backlog.create()`, `Backlog.nextId()`, project-loading, branch-discovery, and frontmatter behavior exposed by `@quorum/core`. It does not copy allocator, slug, ticket serialization, project discovery, or Git-domain logic into `packages/cli`. If a required existing helper is not exported through the core public API, this change may expose it without creating a second implementation.

25. **Parity register.** `packages/core/src/spike-parity.test.ts` is updated in the same change. The `q0080-allocation.js` binary half names the new collected CLI test file or files in `binaryCarriedBy`. The `q0033-surface.js` row records the carried `init` portion while leaving its still-unported gate behavior owed. Any affected pinned line totals or inventories are re-derived from the files rather than arithmetically adjusted.

26. **Independent CLI coverage.** New Vitest coverage under `packages/cli` exercises handlers directly for deterministic presentation behavior and exercises the emitted binary where process exit status, installed-package template resolution, or separation from the test process is part of the claim. Existing `spike/test/**` files remain unchanged and continue to run.

27. **Verification.** After installing dependencies as required by `harness/rules.md`, both `npm test --prefix spike` and `pnpm turbo run test --force` pass. CLI lint, typecheck, and build tasks also pass. No test verdict depends on Git identity, the operator’s actual `USER`, or a pre-existing ignored directory.

28. **Cross-cutting constraints.** This change introduces no authentication or subscription handling, no environment-variable path for vendor secrets, no flow execution, no gate behavior, and no writes to `.harness/worktrees/`. Persistent output is limited to the requested `harness/` and `backlog/` files. The shipped harness continues to satisfy the existing flow lint and cross-vendor rules. No schema or adapter contract changes are made.

29. **Cold-clone impact.** Both supported installation paths remain valid: workspace-local execution and installation of the three locally packed emitting packages. Tests, help, and success messages do not claim that a registry-resolved `npx quorum` installation works.

## Non-goals

- Changing `Backlog.create()` or the spike implementation.
- Choosing or implementing a replacement default-owner policy.
- Renaming all remaining user-facing `harness` command instructions to `quorum`; Q-0100 owns that product-wide decision and migration.
- Changing ticket id grammar, adding prefix configuration, filling numeric gaps, or allowing mixed-prefix automatic allocation.
- Repairing malformed, mixed-prefix, exhausted, or duplicate backlogs.
- Changing ticket reading, listing, board rendering, run-history filtering, `dirOf`, frontmatter parsing, or frontmatter formatting behavior.
- Creating Git branches or worktrees when a ticket is created.
- Adding interactive prompts to either command.
- Supporting registry-resolved installation.
- Editing or deleting `spike/src/**` or `spike/test/**`.
- Fixing other preserved defects owned by Q-0059, Q-0060, Q-0066, or Q-0068.
- Adding Studio behavior, remote state, cloud sync, multi-user ownership, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **What should an omitted ticket owner mean?** Owner: Product. Should creation require `--owner`, omit the field, use a repository-level configured identity, or derive another value? This is not a blocker for Q-0093 because parity requires preserving `process.env.USER ?? "unknown"`; it is a blocker for any later change to the ticket file or owner semantics.

2. **When should user-facing instructions change from `harness` to `quorum`?** Owner: Q-0100/Product. Q-0093 preserves the spike’s next-steps spelling so this port does not create a one-line migration that disagrees with other core and CLI messages. Q-0100 must rule and apply the change consistently.

3. **What packaging mechanism should derive the shipped templates?** Owner: Engineering. A tracked link, build-time copy, or another reproducible mechanism is acceptable if AC-3 and AC-4 hold: there is one maintained source, packed assets are complete and current, and installed execution has no runtime dependency on the repository’s `spike/` directory. This choice is not an architecture change unless it introduces a new workspace dependency or moves template ownership away from the existing authoritative directory.

## Risks

- A copied template directory can pass functional CLI tests while silently drifting from the authoritative flows; byte-level or derivation checks are therefore required.
- `packages/cli` currently packages only `dist`, so adding runtime template assets without updating the package allowlist would make workspace execution pass while the packed installation fails.
- `init` performs multiple filesystem writes. An unexpected copy failure can leave a partial harness; atomic scaffolding or cleanup behavior is not inherited or specified by this ticket and should not be claimed without a separate decision and tests.
- The inherited “217 lines” is a whole-file estimate, not a measured binary-only transfer size. Planning or review should re-derive the actual transferred scenarios rather than treating that number as an acceptance target.
- Preserving `process.env.USER` continues to write machine-account names on shared and CI systems. The explicit parity test prevents the defect from becoming invisible but does not reduce its product impact.
- Parallel ticket creation can race after allocation. Exclusive folder creation prevents overwrite but does not guarantee that both invocations succeed; one may fail and require retry. Adding locking or automatic retry is outside this ticket.
- Editing the authoritative spike templates or tests during this port would invalidate the independent witness required for cutover.
