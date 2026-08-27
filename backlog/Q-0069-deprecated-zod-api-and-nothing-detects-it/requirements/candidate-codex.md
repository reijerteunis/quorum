# Q-0069 — Detect and remove deprecated Zod API use

## Problem

The repository uses Zod's deprecated `.passthrough()` API at 21 call sites in `packages/shared`. Both existing repository gates remain green because TypeScript does not report `@deprecated` symbols as errors and ESLint is configured without the type information required by `@typescript-eslint/no-deprecated`.

This leaves maintainers unable to rely on repository validation to prevent deprecated dependency APIs from landing. The current calls must be migrated without changing schema behavior, and lint must become responsible for detecting future `@deprecated` API use.

Surfaces touched: the shared TypeScript contracts, repository lint configuration, shared-package tests, and `docs/DECISIONS.md`. There is no CLI or Studio behavior change.

## User story

As a **maintainer**, I want repository validation to reject dependency APIs marked `@deprecated`, so that deprecated calls cannot accumulate behind green lint and typecheck results and shared contracts can be upgraded without changing their behavior.

## Acceptance criteria

1. All 21 `.passthrough()` calls in the following files are replaced with the constructor form `z.looseObject({ … })`:
   - 11 in `packages/shared/src/flow.ts`
   - 7 in `packages/shared/src/project.ts`
   - 2 in `packages/shared/src/ticket.ts`
   - 1 in `packages/shared/src/role.ts`

2. After the migration, no production source file under `packages/` contains a call to `.passthrough()`.

3. The migration does not use `.loose()` as an intermediate or final replacement.

4. Every migrated schema continues to accept unknown keys and preserve them in its parsed output. Existing tests for ported flows, projects, tickets, and roles remain green without changing their expected behavior.

5. The migration does not change which schemas refuse, strip, or preserve unknown keys. In particular, existing `.strict()` and `.strip()` calls are not changed.

6. `eslint.config.js` enables type-aware parsing for the TypeScript files covered by the repository's existing lint command using `parserOptions.projectService` or the supported equivalent for the installed TypeScript ESLint version.

7. `eslint.config.js` enables `@typescript-eslint/no-deprecated` at error severity. It does not enable the complete TypeScript ESLint `strict` preset or introduce unrelated lint rules.

8. The explanatory header in `eslint.config.js` is updated so that it no longer claims type-aware linting is wholly disabled or that `tsc --noEmit` owns checks that TypeScript does not perform. It identifies deprecated-symbol detection as a lint responsibility.

9. The normal repository lint command exits successfully after the 21 call sites are migrated.

10. A controlled lint regression proves the general guard is effective: when a TypeScript fixture or temporary test input covered by the lint configuration calls a symbol whose typings mark it `@deprecated`, lint reports an `@typescript-eslint/no-deprecated` error and exits non-zero. The regression mechanism must not leave deprecated code in the committed production tree.

11. A committed source assertion checks all files returned by the existing `sharedSourceFiles()` helper and fails if any contains `.passthrough(`. The assertion follows the existing `.default(` and `.catch(` source-check pattern.

12. The source assertion fails when `.passthrough(` is introduced into any file included by `sharedSourceFiles()`, and passes after the migration.

13. The existing `docs/DECISIONS.md` entry dated 2026-08-25 about ownership of unknown keys receives a concise clarification that the implementation uses Zod loose objects to preserve unknown keys. No new decision entry is added and the historical text is not rewritten to imply a different policy.

14. Migration and guard configuration are delivered in one integration change, with the migration applied before enabling the guard so that the change can reach a green integrate step. No intermediate committed state on the ticket branch enables the rule while the 21 deprecated calls remain.

15. The workspace typecheck, lint, shared-package test suite, and mock-adapter end-to-end regression suite all pass with no cached result required for success.

16. No files under `spike/` are changed.

17. The implementation adds no dependency and makes no changes to persistent file formats, schemas exposed to users, the adapter contract, CLI output, Studio behavior, flow gate behavior, or worktree handling.

18. Cross-cutting quality checks are recorded as follows:
   - BYOS: no subscription-login behavior or forbidden environment-variable handling changes; no API-key path, fixture, or documentation example is added.
   - Worktree safety: not applicable; no flow execution or filesystem-write behavior changes.
   - Gate behavior: not applicable; no gate defaults, human-locked behavior, or exhausted-loop behavior changes.
   - Files and schemas: no persistent format changes; runtime acceptance and preservation of unknown keys remain unchanged.
   - Lint: deprecated symbols become lint errors, while unrelated type-aware rules remain unchanged.
   - Cross-vendor rule: not applicable; no reviewing or judging step changes.
   - Product agnosticism: no product-specific behavior or examples are added.
   - Cold-clone impact: the user setup and first-run path are unchanged; any lint-time increase is measured and reported in the change summary.

## Non-goals

- Migrating or otherwise changing `.strict()` or `.strip()` calls.
- Replacing `.passthrough()` with `.loose()`.
- Enabling the complete TypeScript ESLint `strict`, `strict-type-checked`, or other type-aware preset.
- Fixing lint findings other than deprecated-symbol findings required to make this scoped change green.
- Auditing or changing `spike/`, Turbo configuration, Node API use, or runtime deprecation-warning handling.
- Changing schema semantics, serialized file formats, or the policy governing ownership of unknown keys.
- Adding a new dependency or upgrading Zod, TypeScript, ESLint, or TypeScript ESLint.
- Adding a new `docs/DECISIONS.md` decision.
- Changing CLI or Studio features, flows, gates, adapters, worktrees, or subscription handling.
- Addressing multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Does the existing lint command include generated, fixture, or configuration TypeScript files that cannot be resolved by `projectService`?** Owner: engineer. The implementation must report any excluded file class or required parser override before narrowing lint coverage. This is blocking if enabling type-aware parsing would require existing files to be removed from lint coverage.

2. **What lint-time increase does type-aware parsing introduce on a clean, uncached workspace run?** Owner: engineer. Record the before-and-after wall-clock measurements in the change summary. This is not blocking unless the normal lint command becomes impractical for local development, in which case the maintainer must choose a separate type-aware lint command before implementation proceeds.

3. **What repository-supported test mechanism should provide the controlled deprecated-symbol lint regression required by AC 10?** Owner: engineer. Acceptable implementations include a lint-rule integration test or an isolated fixture linted by the test suite; committed deprecated production code is not acceptable. This is not a product decision provided the normal lint gate is also proven to reject the fixture.

## Risks

- Type-aware parsing may increase lint time across every package and slow local feedback or the cold-clone path. Measure the clean-run impact rather than relying on cached results.
- `projectService` may expose configuration problems in files not currently part of a TypeScript project. Fixing those problems could expand scope; narrowing existing lint coverage to avoid them would leave another blind spot.
- A mechanical constructor rewrite can accidentally change object boundaries or chaining order. Existing behavior tests plus explicit unknown-key preservation coverage are required to catch this.
- The targeted source assertion detects only the `.passthrough(` spelling. It is supplemental; it cannot replace the general type-aware deprecation rule.
- Dependency typings can add new `@deprecated` markers during later upgrades, causing lint to fail in previously accepted code. That failure is intentional, but each migration must remain a separately scoped change rather than being folded into an unrelated upgrade.
