# Q-0080 — Allocate unique ticket IDs without silent collisions

## Problem

The CLI surface `harness ticket new` cannot allocate an ID from this repository’s existing `Q-nnnn` tickets. Both backlog implementations only recognize the hard-coded `T-` prefix, so they repeatedly return `T-0001`.

A repeated ID is not always detected. When a later command produces the same folder name, `create()` silently reuses that folder and replaces its `ticket.md`. The maintainer can therefore lose an existing ticket without an error, prompt, or diagnostic.

This affects the cold-clone path: after `harness init`, an adopter must be able to create multiple tickets without editing configuration by hand and without risking replacement of an existing ticket.

Surfaces in scope:

- CLI: `harness init` and `harness ticket new`.
- Harness configuration: `harness.yaml` and `projectConfigSchema`.
- Backlog files: ticket folders under `backlog/`.
- Both implementations: `spike/src` and `packages/core/src`.

## User story

As a **cold-clone adopter**, I want `harness init` to configure the ticket ID prefix and `harness ticket new` to allocate the next available ID, so that I can create tickets during the first-run path without knowing Quorum’s internal naming conventions.

As a **solo maintainer**, I want ticket creation to stop with an explicit error whenever the proposed ID or folder conflicts with existing backlog data, so that creating a ticket can never silently replace another ticket.

## Acceptance criteria

1. **The ticket prefix is project configuration.** The harness configuration schema accepts a required top-level `ticketPrefix` field. Its value is a single uppercase ASCII letter followed by zero to nine uppercase ASCII letters, without a trailing hyphen; examples: `Q`, `APP`, and `TEAM`. Empty strings, lowercase letters, digits, whitespace, punctuation, and values longer than ten characters are rejected by `projectConfigSchema` with an error that identifies `ticketPrefix`.

2. **Initialization supplies the cold-clone value.** `harness init` writes `ticketPrefix: Q` into a newly created `harness.yaml`. A repository initialized by the command can immediately run `harness ticket new` without an additional configuration step.

3. **Missing configuration fails explicitly.** A command that needs to allocate a ticket ID fails before writing to `backlog/` when `harness.yaml` is absent, cannot be parsed, or has no valid `ticketPrefix`. The error identifies the configuration problem and tells the operator to set `ticketPrefix`. The implementation does not infer a prefix from ticket folders and does not silently default to `T`, `Q`, or any other value.

4. **IDs use the configured format.** `nextId()` returns `<ticketPrefix>-<number>`, with the number padded to at least four decimal digits. With `ticketPrefix: Q`, an empty backlog returns `Q-0001`; a backlog whose highest matching ID is `Q-0080` returns `Q-0081`; and a highest matching ID of `Q-9999` returns `Q-10000` without truncation or rollover.

5. **Only exact, valid IDs advance the counter.** For a configured prefix `Q`, only folder ticket IDs matching `^Q-[0-9]{4,}$` contribute to the maximum. IDs such as `T-0012`, `Q-12`, `Q-0002-extra`, `QA-0040`, and `Q-ABCD` do not advance the `Q` counter. Matching is case-sensitive.

6. **Mixed prefixes remain readable.** Existing ticket folders with prefixes other than the configured prefix remain legal and are not renamed, deleted, or rewritten. They remain available through existing backlog read operations. New IDs are allocated only in the namespace selected by `ticketPrefix`.

7. **Allocation does not reuse gaps.** `nextId()` increments the highest valid ID with the configured prefix. It does not fill lower gaps. Given `Q-0001` and `Q-0003`, it returns `Q-0004`.

8. **An existing ID blocks creation regardless of slug.** Before writing a new ticket, `create()` checks all existing ticket folders for the proposed ticket ID. If that ID already exists, including in a folder with a different slug, creation fails with a non-zero command result. The error names the conflicting ID and existing folder. No backlog file or folder is created or modified.

9. **An existing target folder blocks creation.** `create()` must create the proposed `<id>-<slug>` directory as a new directory and must not treat an existing directory as success. If that target already exists, creation fails with a non-zero command result, identifies the path, and leaves every file in that directory byte-for-byte unchanged. It does not allocate another ID automatically.

10. **Ticket content is written only after exclusive directory creation succeeds.** Failure to create the new ticket directory, including an already-existing path or filesystem error, occurs before `ticket.md` is opened for writing. A partially failed creation must not replace an existing `ticket.md`.

11. **Sequential creation is unique.** Starting from an empty backlog with `ticketPrefix: Q`, three successful `harness ticket new` invocations create `Q-0001`, `Q-0002`, and `Q-0003`. Repeating the same title still creates distinct folders and preserves all three ticket files.

12. **The CLI reports the result.** On success, `harness ticket new` reports the allocated ID and created folder. On a configuration or collision failure, it reports the explicit error, exits non-zero, and does not print a success result.

13. **The spike and core implementations agree.** The change lands in `spike/src/backlog.js` and `packages/core/src/backlog/backlog.ts` together. Equivalent fixtures produce the same ID, collision outcome, and error category in both implementations.

14. **Preserved-defect pins are replaced.** Tests and JSDoc that deliberately preserve the hard-coded `T-` behavior are removed or rewritten to describe the configured-prefix contract. Coverage retains the load-bearing proof that a matching existing prefix advances the counter.

15. **The unrelated AC-7 behavior is unchanged.** Tests that pin `create()` writing a branch name without creating a Git ref remain unchanged and green. This ticket neither creates nor validates branch refs.

16. **Regression coverage is independently executable.** Automated tests cover at least: an empty backlog; multiple matching IDs; gaps; IDs above 9999; mixed prefixes; malformed IDs; missing or invalid `ticketPrefix`; an existing ID under a different slug; an existing target folder containing `ticket.md`; and repeated sequential creation with the same title.

17. **Both repository test suites pass from an installed checkout.** Verification installs dependencies as required by `harness/rules.md`, then passes `npm test --prefix spike` and `pnpm turbo run test --force`. The TypeScript implementation remains strict, and the workspace lint command passes without adding deprecated APIs, `any`, or `@ts-ignore`.

18. **Files remain the database.** The prefix is persisted only in `harness.yaml`, and tickets remain persisted only under `backlog/`. Allocation introduces no daemon-only counter, cache, lock service, or other hidden durable state.

19. **Cross-cutting constraints are preserved.** The change adds no subscription-secret path; does not change flow worktrees, branches, gates, adapters, or cross-vendor enforcement; introduces no product-specific SaaS knowledge; and requires no new dependency.

## Non-goals

- Fixing `create()` writing a branch name without creating a Git ref; Q-0038 owns that behavior.
- Fixing `dirOf` path traversal; Q-0059 owns it.
- Fixing frontmatter fail-open behavior; Q-0060 owns it.
- Renaming, moving, rewriting, or backfilling any existing ticket folder or ticket ID.
- Rejecting a backlog merely because it contains historical IDs with multiple prefixes.
- Inferring the prefix from the most common or highest prefix already on disk.
- Filling gaps in an existing numeric sequence.
- Automatically retrying with a later ID after a collision.
- Providing a command that changes `ticketPrefix` after initialization.
- Guaranteeing collision-free creation by multiple operating-system processes running concurrently. Creation must still fail explicitly if a filesystem-level target-folder race is detected; cross-process ID reservation is separate scope.
- Changing ticket frontmatter fields other than the newly allocated `id` and existing derived values.
- Changing the Studio, flow execution, gate behavior, adapter contract, worktree layout, or branch-ref behavior.
- Adding a dependency, remote counter, database, cloud synchronization, or multi-user coordination.

## Open questions

1. **Migration owner: maintainer — blocker before implementation.** Which existing checked-in `harness.yaml` files and test fixtures must receive `ticketPrefix: Q` in this change so that making the schema field required does not break repository commands unrelated to ticket creation? The implementation task must enumerate these files; it must not resolve missing values with a runtime default.

2. **Q-0058 coordination owner: maintainer — blocker before merge.** Does Q-0058 already reserve a different field name or nesting for the first `projectConfigSchema` caller? If so, the two tickets must agree on one schema shape before either merges. This requirement selects the top-level name `ticketPrefix`; changing that name requires a requirement revision.

3. **Command naming owner: engineering — non-blocking.** The defect report names `harness ticket new`, while product context names the installed CLI `quorum`. Engineering must identify every current command entry point that reaches the shared backlog implementation and apply the same behavior without introducing a second allocation path.

## Risks

- Requiring `ticketPrefix` can cause existing repositories or fixtures to fail schema validation until their checked-in configuration is migrated in the same change. Explicit failure is intentional, but incomplete migration could break unrelated commands.
- Allowing historical mixed prefixes means two tickets can retain the same numeric suffix, such as `T-0001` and `Q-0001`. They are distinct IDs because the prefix is part of the ID, but UI or reporting code that incorrectly compares only numeric suffixes may expose a separate defect.
- A check-then-create implementation cannot guarantee unique IDs across concurrent processes when their titles produce different slugs. Cross-process reservation is excluded here; documenting that limitation is necessary so sequential safety is not mistaken for concurrency safety.
- Changes applied to only the spike or only the core implementation would preserve divergent behavior through the port. Both implementations and their tests must land together.
- Replacing the preserved-defect test may accidentally remove coverage of the matching-prefix counter or the unrelated branch-ref defect. Both behaviors require explicit retained tests.
- A broad configuration-schema change could lengthen the cold-clone path if `harness init` does not write the field. Acceptance criterion 2 prevents that regression.
