# Q-0064 — Organise `core/src` into folders and stabilise the containment snapshot

## Problem

The `packages/core/src` files are currently flat, while the normative decision in `docs/DECISIONS.md` dated 2026-08-26 requires `core` to be organised in folders named after the port’s children and requires `shared` to remain flat.

Moving the files without updating the test helpers would create silent gaps in source-rule coverage. `coreSourceFiles()` is not recursive, so after the move it would inspect only the root `index.ts` while the affected tests could still report success. Existing source-test lookups also depend on bare filenames and would no longer identify the moved files.

The same change must stabilise the containment test absorbed from Q-0061. Its filesystem snapshot currently includes Git’s transient lock files, allowing Git background maintenance to fail a test that is intended to detect writes by core. Excluding all of `.git/**` would hide prohibited caches, so only transient Git lock files may be ignored.

The moved implementation files also contain comments that do not comply with the current `harness/rules.md`: durable rationale is copied into source instead of being cited, while deliberate preserved defects still require concise `Why:` pointers.

This is an internal organisation and test-reliability change. It touches the CLI implementation source, core and shared tests, the repository test helpers, the `harness/` comment rules as applied to moved files, and the `backlog/` record for Q-0061. It does not change the CLI interface or shipped behavior.

Q-0064 belongs to M2 and must run before Q-0044 so the eleven remaining children of Q-0009 use the new paths from their first implementation.

## User story

As a **maintainer**, I want core source files organised according to the recorded architecture decision, with recursive and fail-closed source checks, so that later port children start in their intended locations and moving files cannot silently reduce test coverage.

As a **maintainer**, I want the containment snapshot to ignore only Git’s transient lock files, so that Git background maintenance does not cause flaky failures while the test continues to detect prohibited persistent writes, including writes under `.git/`.

As a **contributor**, I want the moved modules to retain concise contract documentation and pointers for deliberately counterintuitive behavior, so that I can distinguish required compatibility behavior from commentary that merely duplicates tickets or decisions.

## Acceptance criteria

1. The following files exist at these exact paths, and their former flat paths no longer exist:

   | Destination | Files |
   | --- | --- |
   | `packages/core/src/backlog/` | `backlog.ts`, `backlog.test.ts`, `backlog.source.test.ts`, `project.ts`, `project.test.ts` |
   | `packages/core/src/git/` | `git.ts`, `git.test.ts`, `git.source.test.ts` |
   | `packages/core/src/` | `index.ts`, `index.test.ts`, `shared-resolution.test.ts` |

2. No empty directories are introduced for `adapters`, `contracts`, `engine`, `fanout`, `lint`, or `run-history`. Those directories remain the responsibility of the children that add their first modules.

3. All imports, test references, and repository-relative path reads affected by the move resolve to the new locations without introducing a new export or changing an existing exported name or signature.

4. `packages/shared/src/project.test.ts` reads the moved project implementation from `packages/core/src/backlog/project.ts`.

5. `packages/shared/src/index.test.ts` continues to read `packages/core/src/index.ts` at its existing path, and `packages/core/src/index.ts` is byte-for-byte unchanged from the revision immediately before Q-0064.

6. `coreSourceFiles()` recursively discovers core production TypeScript source files below `packages/core/src`, rather than inspecting only the directory root. Its result includes exactly these current production-source keys after the move:

   - `backlog/backlog.ts`
   - `backlog/project.ts`
   - `git/git.ts`
   - `index.ts`

7. Every key returned by `coreSourceFiles()` is a normalized path relative to `packages/core/src`. A nested file is not represented by its bare filename or by an absolute path.

8. `coreSourceFiles()` fails with a clear error when the discovered production-source corpus is below the agreed plausibility threshold. An automated test proves the guard fails for a non-empty but implausibly small corpus; retaining only `index.ts` must not allow source-rule tests to report success.

9. The source-test lookup for `git.ts` identifies it by the `src`-relative key `git/git.ts`. It does not use a bare-filename match that could select an unrelated nested file.

10. The source-test lookup used by the backlog tests identifies moved files by their complete `src`-relative keys, including `backlog/backlog.ts` and `backlog/project.ts`. It does not compare a nested entry only with a bare filename.

11. Existing house-rule assertions still execute against every production source file returned by the recursive corpus. A regression test fails if any of the four files listed in AC-6 is omitted from the corpus.

12. The containment filesystem snapshot excludes Git transient lock files under `.git/`, including the observed `.git/objects/maintenance.lock`, from both the before and after snapshots.

13. The containment snapshot does not exclude `.git/` as a whole. A regression test demonstrates that a non-lock file created under `.git/` between the snapshots changes the snapshot and fails the no-write assertion.

14. The containment no-write assertion remains otherwise unchanged in strength: deriving containment must leave both the filtered filesystem snapshot and the output of `git for-each-ref` unchanged.

15. An automated regression test creates a transient lock file under `.git/` inside the snapshot window and proves that this lock alone does not fail the containment assertion. The test controls creation timing and does not rely on Git background maintenance occurring naturally.

16. Q-0061 is recorded as closed and absorbed by Q-0064. Its ticket body retains the observed evidence and points to Q-0064 as the implementing ticket; the evidence is not deleted or replaced with only a status change.

17. `backlog.ts`, `project.ts`, and `git.ts` comply with the Comments section of `harness/rules.md` after the move:

   - modules, exported symbols, interface fields, and non-obvious parameters retain or receive contract-focused JSDoc where needed;
   - prose that transcribes a decision entry or ticket body is removed;
   - comments that merely restate adjacent code are removed;
   - each deliberately counterintuitive preserved behavior retains a single concise `Why:` line naming its authority;
   - no preserved-defect `Why:` pointer is removed without the referenced defect also being removed from scope by a separate decision.

18. No implementation behavior changes as a result of the comment pass. In particular, none of the nine defects reported by Q-0043 is fixed, reinterpreted, or removed.

19. `pnpm turbo run test --force` completes successfully and reports exactly 123 tests in `core` and 96 tests in `shared`. A lower count in either package fails this ticket even if the command exits successfully.

20. `npm test --prefix spike` completes successfully with its pre-change test count, and no file under `spike/` is modified by Q-0064.

21. The change does not modify the layout or implementation files under `packages/shared/src`, except for the path reference in `packages/shared/src/project.test.ts` required by AC-4. The existing `packages/shared/src/index.test.ts` pin remains unchanged unless a path-neutral test adjustment is strictly required to demonstrate AC-5.

22. Q-0064 is completed through the `requirements → chore → human gate` route and is ordered before Q-0044 in the applicable backlog or development-plan dependency record.

23. Cross-cutting quality checks are recorded as follows:

   | Quality area | Required result |
   | --- | --- |
   | BYOS | No subscription authentication behavior or environment-variable refusal behavior changes; no API-key path is introduced in code, tests, fixtures, or documentation. |
   | Worktree safety | No flow or worktree behavior changes. Existing safety tests remain green. |
   | Gate behavior | No gate behavior changes. The chore still ends at a human gate. |
   | Files and schemas | No persistent product file format or schema changes. Only source locations, test-helper behavior, and the Q-0061 backlog record change. |
   | Lint and cross-vendor rules | No flow-lint or cross-vendor rule changes. Existing checks remain green. |
   | Cold-clone impact | No CLI command, setup step, dependency, or README instruction changes; the first-30-minutes path is unaffected. |
   | Product agnosticism | No product-specific SaaS reference is introduced. |
   | Explicit errors | The new corpus guard fails with a clear error rather than silently accepting incomplete coverage. |

## Non-goals

- Changing shipped CLI behavior.
- Adding an export or changing an exported name, signature, return type, or error contract.
- Fixing any defect other than Q-0061’s flaky test-helper behavior.
- Fixing any of the nine defects reported by Q-0043.
- Reimplementing or otherwise changing behavior preserved by `harness/port-charter.md` §2.
- Creating directories for modules that do not exist yet.
- Moving or reorganising `packages/shared/src`.
- Modifying any file under `spike/`.
- Changing any byte in `packages/core/src/index.ts`.
- Excluding all of `.git/**` from containment snapshots.
- Weakening or removing the containment no-write assertion.
- Changing the containment requirement that state is derived from Git and not stored by core.
- Changing a flow, gate, adapter contract, task file format, persistent product schema, or CLI command.
- Adding a dependency.
- Work on multi-user support, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **What exact plausibility threshold must `coreSourceFiles()` enforce?** The requirement currently establishes that a corpus containing only `index.ts` must fail and that the current valid corpus contains four production files, but the implementation needs an exact rule, such as “fewer than four files fails” or an explicit expected-key check. **Owner: Ruud. Blocker:** yes, because this determines the helper’s error contract and future maintenance behavior.

2. **What exact filename predicate defines a Git transient lock file for snapshot filtering?** The observed case is `.git/objects/maintenance.lock`; likely choices are every `.git/**/*.lock` path or a narrower documented set of Git-maintenance lock paths. **Owner: Ruud. Blocker:** yes, because an overly broad predicate could hide a prohibited cache while an overly narrow predicate would retain the flake.

## Risks

- Recursive discovery can appear successful while still omitting nested sources because of an incorrect base path, extension filter, or relative-key calculation. AC-6 through AC-11 require both exact membership and fail-closed coverage.
- Bare-filename lookup can pass today but select the wrong file after future folders introduce duplicate filenames. Full `src`-relative keys are required.
- Broad `.git/` filtering would remove the only filesystem assertion capable of detecting a cache written under `.git/`. The lock exclusion must remain narrow and must have a negative regression test.
- A test that creates the lock before the initial snapshot or after the final snapshot would not prove the intended race-window behavior. The regression test must create it between snapshots.
- Moving test files can reduce discovered test counts while leaving the suite green. Forced execution and exact package counts are release criteria.
- Turbo’s cache can replay an earlier result and conceal missing tests. Verification must use `--force`.
- The comment pass can accidentally erase the only local signal that a strange behavior is deliberately preserved. Every preserved defect must retain a concise authority pointer.
- Combining movement, helper changes, and comment reduction can make behavioral drift difficult to review. Review must treat any non-test-helper runtime change as out of scope.
- Q-0044 or another Q-0009 child landing first would create avoidable path churn and conflicting edits. Dependency ordering must be enforced before implementation begins.
