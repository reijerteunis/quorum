# Q-0042 requirements — core/git: worktrees, ancestry and containment

## Problem

The Solo maintainer needs Quorum’s git operations available through `packages/core` before fan-out and engine behaviour can be ported. The current implementation exists only in `spike/src/git.js`, so later M2 packages cannot use it without depending on the spike.

This port is safety-sensitive. A conventional error wrapper could turn a failed git command into a false claim that one ref is not contained in another. Likewise, treating a failed shallow-repository probe as “not shallow” could manufacture the same false negative. Worktree behaviour also enforces the product rule that a flow never writes to the maintainer’s working tree.

The port must preserve the spike’s observable behaviour and unit-level tests. It must not improve defects found during the port. The normative scope and inherited invariants are in `harness/port-charter.md` §6, register rows 8 and 19.

Surfaces touched: `packages/core` and, subject to OQ-1, type declarations and exports in `packages/shared`. There is no CLI rendering change in this ticket.

## User story

As a **Solo maintainer**, I want every flow-related git write to use an isolated worktree and every ancestry answer to distinguish proof from failure, so that Quorum neither modifies my working tree nor confidently misreports where a ticket branch is contained.

## Acceptance criteria

1. **Core module and public exports.** `packages/core` contains a TypeScript git module that ports `ensureWorktree`, `removeWorktree`, `ancestry`, `shallowState`, `shortSha`, `emptyRangeEvidence`, `containment`, and `ensureExcluded` from `spike/src/git.js`. The functions required by later packages are exported from `@quorum/core`. TypeScript strict mode passes without `any` or an unexplained `@ts-ignore`.

2. **No shell interpolation.** Every git operation in the port invokes the git executable with an argument array and an explicit repository working directory. No branch, ref, task-derived value, path, or exclude pattern is interpolated into a shell command.

3. **Worktree location and existing worktree reuse.** Given repository directory `R` and branch `B`, `ensureWorktree(R, B, base)` resolves the worktree directory as `R/.harness/worktrees/<encoded-B>`, using the shared worktree root and branch-name encoding supplied by `@quorum/shared`. If that directory already exists, it returns the directory without creating a branch, adding another worktree, or changing the user’s working tree.

4. **Worktree creation for an existing branch.** When the target worktree directory does not exist and `refs/heads/B` resolves, `ensureWorktree` creates the root directory if necessary, ensures `.harness/` is locally excluded, runs `git worktree add <dir> B`, and returns `<dir>`. It does not create or reset `B`.

5. **Worktree creation for a new branch.** When the target worktree directory and `refs/heads/B` do not exist, `ensureWorktree` creates `B` with `git worktree add -b B <dir> <start>`. `<start>` is the supplied base branch only when `base` is non-empty and `refs/heads/<base>` resolves; otherwise `<start>` is `HEAD`. The operation does not check out `B` in or write files into the user’s working tree.

6. **Worktree removal.** `removeWorktree(R, B)` derives the same worktree directory as `ensureWorktree`. If the directory exists, it force-removes that registered worktree. If it does not exist, it does not issue a worktree-removal command. By default it retains `B`. With `{ deleteBranch: true }`, it attempts to force-delete `B` after the worktree removal; failure to delete the branch is ignored, preserving spike behaviour.

7. **Ancestry command and direction.** `ancestry(R, ref, inRef, options)` asks exactly whether `ref` is an ancestor of `inRef` by invoking `git merge-base --is-ancestor ref inRef`. Its returned evidence includes the command text `git merge-base --is-ancestor <ref> <inRef>` so a caller can report the check that was run.

8. **Exit-code-only ancestry selection.** `ancestry` selects its state from the git process result as follows: exit code 0 returns `contained`; exit code 1 is eligible to return `not-contained`; every other exit code, signal, spawn failure, timeout, or absent git executable returns `indeterminate` with reason `git failed`. A thrown error is never treated as proof of `not-contained` unless its actual process exit status is exactly 1.

9. **Shallow asymmetry.** For an ancestry command that exits 0, `ancestry` returns `contained` regardless of whether the repository is shallow or its shallow state is unknown. For an ancestry command that exits 1: `shallow: false` returns `not-contained`; `shallow: true` returns `indeterminate` with reason `shallow clone`; and `shallow: null` returns `indeterminate` with reason `shallow state unknown` and retains the supplied shallow-probe detail. Neither indeterminate result carries a not-contained claim.

10. **Three-valued shallow probe.** `shallowState(R)` invokes `git rev-parse --is-shallow-repository`. Output equal to `true` returns `{ shallow: true, detail: null }`; any other successful output returns `{ shallow: false, detail: null }`, preserving spike behaviour. A failed invocation returns `{ shallow: null, detail: <normalised failure detail> }`; it never defaults a failed probe to `false`.

11. **Normalised diagnostic detail.** Where the spike exposes git failure detail, the port takes the first non-empty trimmed line from stderr, falling back to the error message, truncates it to at most 200 characters, and returns `null` when neither source has a non-empty line. Diagnostic detail does not alter state selection.

12. **One ancestry primitive.** `containment` calls the exported `ancestry` primitive for its ancestry decision. `emptyRangeEvidence`, which is the primitive later consumed by diff materialisation, also calls that same `ancestry` primitive. No second implementation or wrapper independently interprets `git merge-base --is-ancestor` results.

13. **Short SHA.** `shortSha(R, ref)` invokes git’s own short-ref resolution using `rev-parse --verify --quiet --short`. It returns git’s chosen abbreviation without imposing a length. It returns `null` when the ref cannot be resolved or git fails.

14. **Empty-range direction and evidence.** `emptyRangeEvidence(R, left, right)` obtains the three-valued shallow state and asks `ancestry(R, right, left, ...)`, because a three-dot range represents additions from the right endpoint. If the result is `contained` or `indeterminate`, it returns that check with `sameTree: null` and performs no tree comparison.

15. **Empty-range tree comparison.** Only after `emptyRangeEvidence` receives a proven `not-contained` result does it resolve `<left>^{tree}` and `<right>^{tree}`. It returns `sameTree: true` when both resolve to the same tree, `false` when both resolve to different trees, and `null` when either tree cannot be resolved. A failed comparison does not change the ancestry state.

16. **Containment repository probe.** `containment(R, base)` performs one combined successful probe for `--is-inside-work-tree` and `--is-shallow-repository`. It returns `null` when git cannot run, the probe fails, or the first value does not report a work tree. These cases remain unavailable containment information rather than a contained or not-contained claim.

17. **Safe local-ref inventory.** For a valid work tree, `containment` verifies the configured base as `refs/heads/<base>^{commit}` and reads local branch names once from `refs/heads` using an unambiguous full-prefix removal. A value passed later to `stateOf(branch)` reaches a git command only if it is a string exactly present in that git-produced branch inventory. A missing, non-string, tag-only, remote-only, or hostile branch value returns `null`.

18. **Containment states.** For an inventoried branch, `stateOf(branch)` returns `indeterminate` with reason `missing ref` when the configured local base does not resolve. Otherwise it calls `ancestry` with the fully qualified local branch and base refs and the repository’s probed shallow state. It returns the resulting `contained` or `indeterminate` state without reinterpreting it.

19. **Ahead count only after proof.** Only when `ancestry` returns `not-contained` does `stateOf` run `git rev-list --count refs/heads/<base>..refs/heads/<branch>`. A successful count returns `not-contained` with the numeric count. A failed or unavailable count returns `indeterminate` with reason `git failed`. No ahead count is computed or returned for `contained`, `missing ref`, `shallow clone`, or another failure.

20. **Closed state and reason types.** Public return types prevent arbitrary containment and ancestry states or reasons. States are limited to `contained`, `not-contained`, and `indeterminate`. The ancestry reason set covers `git failed`, `shallow clone`, and `shallow state unknown`; the board-facing containment reason set is limited to `missing ref`, `shallow clone`, and `git failed`. Impossible combinations—such as `not-contained` with a reason, `contained` with an ahead count, or `indeterminate` without an allowed reason—are not representable. Ownership of these declarations is subject to OQ-1.

21. **Local exclude behaviour.** `ensureExcluded(R, pattern)` resolves the repository’s exclude file through `git rev-parse --git-path info/exclude`, supporting both absolute and repository-relative results. It creates the exclude file’s parent directory if necessary and appends `pattern` followed by one newline only when an exact line is not already present. It does not alter a matching line or append duplicates.

22. **Exclude failure behaviour.** If exclude-path resolution, directory creation, reading, or appending fails, `ensureExcluded` emits one warning identifying the pattern and best-known target path, then returns without failing worktree creation solely because the exclusion could not be written. This preserves spike behaviour; changing it to fail closed requires a separate decision and ticket.

23. **Behaviour-preserving tests.** Unit-level tests covering the ported module move beside `packages/core` and run under the workspace test command. At minimum they independently cover: ancestry exit 0, exit 1, and a non-1 failure; all three shallow values combined with exit 1; exit 0 in a shallow repository; a failed shallow probe; missing and hostile refs; missing base; failed ahead count; empty-range direction and conditional tree comparison; existing and new worktree branches; base fallback to `HEAD`; worktree removal with and without branch deletion; short-SHA failure; and idempotent local exclusion. Tests must assert outcomes rather than depend on the current repository’s branch topology.

24. **Port boundaries and verification.** The change does not modify or delete any file under `spike/**`. The `@quorum/core` lint, typecheck, and test commands pass, and the existing `@quorum/shared` and mock-adapter end-to-end regression suites remain green. If a ported test exposes behaviour that appears defective, implementation stops and reports it instead of changing the behaviour or its test.

25. **No persistence or rendering.** None of these functions reads or writes ticket frontmatter, a run manifest, `runs.log`, or a containment cache. The module returns domain data and does not render `main:contained`, `main:not-contained(+12)`, or `main:indeterminate(<reason>)`; CLI rendering remains owned by Q-0010. No vocabulary exposed by this module describes a branch as merged, landed, or shipped.

26. **Cross-cutting product checks.** BYOS: not applicable; this module adds no subscription or environment-variable handling. Worktree safety: applicable and satisfied by AC-3 through AC-6. Gate behaviour: not applicable. Persistent file format/schema: none added or changed; `.git/info/exclude` is local git configuration, not Quorum state. Lint rules: no flow-lint rule changes. Cross-vendor rule: not applicable. Product-agnostic: no repository-specific SaaS knowledge is introduced. Cold-clone impact: no new setup step, prompt, dependency, or user-facing delay is introduced.

## Non-goals

- Porting a module assigned to another Q-0009 child.
- Editing or deleting any file under `spike/**`.
- Fixing a defect, inconsistency, performance issue, or ergonomics issue discovered while reading the spike.
- Porting `materialiseDiff`; Q-0051 owns it. This ticket provides the single ancestry primitive and empty-range evidence it must consume.
- Porting fan-out or engine orchestration; Q-0048 and Q-0050 own those areas.
- Moving containment derivation into CLI code or implementing its board rendering; Q-0010 owns the `quorum` binary and rendering.
- Persisting, caching, or writing containment to `ticket.md`, `.quorum/`, `runs.log`, or another file.
- Changing branch layout, worktree location, or the local-exclude best-effort policy.
- Adding retries, timeouts, cancellation, command logging, a general git abstraction, or a new process-execution dependency.
- Supporting remote refs, tags, symbolic display names, or non-git version-control systems as containment sources.
- Changing any adapter contract, flow, gate, event-stream format, or run-history format.
- The cutover from the spike.
- Multi-user operation, a remote daemon, cloud sync, a plugin marketplace, visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **OQ-1 — blocker: which ticket owns the closed containment types in `packages/shared`?** Q-0042 explicitly requires shared types to close the state and reason sets, but the normative charter assigns new shared schemas and types to Q-0041, and the current Q-0041 output contains no containment types. May Q-0042 add and export these declarations from `packages/shared`, or must Q-0041 be corrected before Q-0042 starts? **Owner:** Ruud. **Blocking because:** the answer changes the authorised file boundary and determines whether AC-20 can be implemented without violating the charter.

2. **OQ-2 — is the combined containment probe’s successful non-`true` shallow output intentionally preserved as `false`?** The spike maps each successful probe line by exact comparison with `true`, while standalone `shallowState` likewise treats any successful non-`true` output as not shallow. The port charter requires behaviour preservation, so these requirements preserve that result. Confirm whether an unexpected successful value is an accepted legacy behaviour rather than a defect to report before implementation. **Owner:** Ruud. **Blocking:** no, unless review identifies an existing test or decision requiring a different state.

## Risks

- A generic helper that converts all thrown process errors to `false` would recreate the false not-contained result removed by Q-0035.
- If the shallow probe is represented as a boolean, `null` can be silently collapsed to `false`, allowing absent history to produce a confident negative.
- Separate ancestry interpretation in containment and later diff materialisation would allow user-facing answers to drift again.
- Loose string types could admit unsupported reasons or impossible state/reason/ahead combinations even when runtime tests pass.
- Branch names originate in agent-written files. Passing an unverified name to git would increase both argument-handling and ambiguous-ref risk.
- Worktree path or branch-encoding drift between core and fan-out could create duplicate worktrees or leave cleanup targeting a different directory.
- `ensureExcluded` is intentionally best-effort. A failure can leave `.harness/` visible to git even though worktree creation succeeds; changing this policy in the port would violate behaviour preservation.
- Tests that use this repository’s current branches may pass or fail as refs move, masking a regression. Fixtures must construct the topology and shallow state they assert.
- Editing the spike while porting would remove the independent witness used to prove behaviour preservation.
