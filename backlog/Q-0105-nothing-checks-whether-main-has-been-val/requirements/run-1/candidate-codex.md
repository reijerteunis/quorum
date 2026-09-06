# Q-0105 — Report push lag on `quorum board`

## Problem

A solo maintainer can complete several tickets and see green local gates while the configured base branch remains ahead of its remote-tracking branch. In that state, CI triggered by a push has not examined the unpushed commits, but `quorum board` gives no indication that the remote is behind.

This happened when `main` reached 89 commits and four days ahead of `origin/main`. Local gates accurately reported results from the local checkout, while no CI run had examined those commits. Two defects surfaced only after the eventual push, including a deterministic failure on the locally packed installation path.

Quorum must not claim that CI ran or passed because that fact depends on a remote service, may require network access, and is not portable across CI products. It can report the narrower git fact available locally: whether the configured base branch contains commits absent from its configured upstream tracking ref.

Surface affected: the `quorum board` CLI command. Supporting changes may touch `core`, CLI tests, the glossary, architecture documentation, and the development plan. No Studio surface is included.

## User story

As a **solo maintainer**, I want `quorum board` to show when my configured base branch contains commits absent from its configured upstream tracking ref, so I can notice that remote-triggered checks cannot yet have examined those commits without Quorum pushing anything or claiming knowledge of a CI service.

## Acceptance criteria

1. `quorum board` renders one repository-level push-lag status per invocation. It is not repeated on individual ticket rows and is rendered even when the backlog is empty.

2. The status compares the local branch named by `repo.base_branch` in `harness/harness.yaml`, defaulting to `main` under the existing configuration rule, with that branch’s configured git upstream tracking ref. It does not assume that the remote is named `origin` or that the upstream branch has the same name as the local branch.

3. When the configured base branch and its upstream tracking ref resolve, and the base contains no commits absent from the upstream, the board renders:

   ```text
   <base>:push-current
   ```

   This state applies both when the refs are equal and when the local base is only behind its upstream.

4. When the configured base branch and its upstream tracking ref resolve, and the base contains one or more commits absent from the upstream, the board renders:

   ```text
   <base>:push-lag(+<count>)
   ```

   `<count>` is the number of commits reachable from the local base ref and not reachable from the upstream ref, equivalent to the `upstream..base` revision range. A diverged history reports only the local-only count, not the symmetric-difference count.

5. The status is selected from these closed outcomes:

   - `<base>:push-current`
   - `<base>:push-lag(+<count>)`
   - `<base>:push-indeterminate(no upstream)`
   - `<base>:push-indeterminate(missing ref)`
   - `<base>:push-indeterminate(shallow clone)`
   - `<base>:push-indeterminate(git failed)`

   An indeterminate result is never rendered as `push-current` or `push-lag`.

6. `no upstream` is rendered when the configured base branch resolves as a local branch but has no configured upstream tracking ref. Quorum does not fall back to `origin/<base>`, another remote, or a guessed branch name.

7. `missing ref` is rendered when the configured base branch or its configured upstream tracking ref cannot be resolved at the time the board is rendered.

8. In a shallow repository, a positive local-only count is rendered as `push-lag(+<count>)` only when git can establish that result from the available history. A result that could be understated because required history is absent is rendered as `push-indeterminate(shallow clone)`. It is never rendered as `push-current` merely because the available shallow history contains no observed local-only commit.

9. A git invocation failure not covered by criteria 6–8 renders `push-indeterminate(git failed)`. Raw git stderr, stack traces, and executable paths are not printed as part of normal board output.

10. If the project directory is not a git repository, the existing ticket board still renders and exits successfully. The repository-level status is `push-indeterminate(git failed)`; the absence of a repository is not treated as proof that the base is current.

11. When a `push-indeterminate(...)` status is rendered, the board prints one concise legend explaining that Quorum could not compare the local base with its configured upstream. The legend is printed once per invocation and is not printed for `push-current` or `push-lag`.

12. Board wording states that push lag is a local git observation and not a CI conclusion. In particular, neither the status nor its legend uses wording equivalent to “CI passed,” “CI failed,” “validated,” or “not validated.”

13. The calculation uses only local git refs available when `quorum board` starts. It performs no fetch, push, network request, CI-service query, remote API call, or authentication check.

14. Running `quorum board` does not modify ticket files, harness files, `.quorum/`, git configuration, refs, the index, or the working tree. It creates no cache or other persistent record of the result.

15. The command remains observational: every push-lag outcome, including `push-lag`, exits with the existing successful exit code when the rest of the board renders successfully. Push lag does not block a flow, change a ticket stage, create a gate, or alter containment.

16. Existing containment annotations remain unchanged and continue to describe each ticket branch relative to the configured base branch. Push lag is visually and semantically separate: containment answers where a ticket branch is relative to the base; push lag answers where the base is relative to its upstream.

17. Automated tests construct their own temporary repositories and local remotes and independently cover:

   - equal base and upstream refs;
   - a base behind its upstream;
   - one and multiple local-only commits;
   - diverged refs, proving the count is `upstream..base` rather than the symmetric difference;
   - a remote and upstream branch whose names are not `origin` and `main`;
   - no configured upstream;
   - a missing local base ref;
   - a missing upstream ref;
   - a genuinely shallow clone;
   - a forced git-command failure;
   - a non-git project directory;
   - an empty backlog;
   - exactly one indeterminate legend; and
   - byte-identical files and unchanged refs before and after the command.

18. No automated test contacts a network service or lets its verdict depend on the invoking account, ambient git configuration, an existing remote, or an existing checkout. Every remote, ref, configuration value, and repository state used as a test oracle is created by the test itself.

19. The mock-adapter end-to-end regression suite remains green, and its `quorum board` assertion includes a deterministic push-lag status produced by the fixture rather than by the developer’s checkout.

20. CLI help for `quorum board` is updated to say that the command shows ticket containment and the base branch’s push lag. The help does not mention a specific remote host or CI product.

21. Documentation defines **push lag** in `docs/GLOSSARY.md` before the term is used in another durable product document. The definition includes the exact outcomes, the configured-upstream rule, the local-only commit range, and the statement that push lag is not evidence of a CI run or conclusion.

22. `docs/04-architecture.md` records that `quorum board` derives both containment and push lag from local git state on every invocation and persists neither. Any decision needed to extend the existing board/git contract is added as a new append-only entry in `docs/decisions/` and indexed in `docs/DECISIONS.md`; the 2026-08-24 containment decision is not edited.

23. `docs/06-development-plan.md` lists Q-0105 in M2 and states that its delivered scope is local push-lag reporting, not CI integration.

24. No new runtime dependency is introduced. If implementation nevertheless requires one, work stops until a separate architectural decision and its justification are approved.

25. The implementation and its tests pass the repository’s configured install, test, lint, and typecheck commands. A reported green result must come from the commands actually executed in the implementation worktree.

### Cross-cutting checks

26. **BYOS:** No subscription or authentication path changes. No environment variable associated with vendor authentication is read, documented, or added to a fixture.

27. **Worktree safety:** No flow behavior changes. `quorum board` remains read-only and does not create or modify a worktree.

28. **Gate behavior:** No gate is added or changed. Push lag is informational and cannot advance, refuse, or block a gate.

29. **Files and schema:** No persistent field is added to `ticket.md`, `harness/harness.yaml`, run history, or any schema. The configured upstream remains ordinary git configuration rather than duplicated Quorum configuration.

30. **Lint rules:** No flow lint rule or cross-vendor rule changes.

31. **Cold-clone impact:** The workspace-local and locally packed CLI paths continue to work. The status may be indeterminate before an adopter configures an upstream, but it does not add an installation step, require network access, or claim that registry-resolved `npx quorum` is available.

32. **Product-agnostic behavior:** No code, test, help text, or product documentation names or branches on GitHub Actions, another CI service, a remote-hosting product, or a remote named `origin` except where historical ticket evidence is explicitly quoted.

## Non-goals

- Determining whether CI has run for a commit, whether a CI run is pending, or whether it passed or failed.
- Contacting GitHub, another forge, a CI service, or a git remote.
- Fetching before calculating push lag or detecting that a local remote-tracking ref is stale.
- Reporting the age or timestamp of an unpushed commit.
- Reporting how far the local base is behind its upstream; a behind-only base is `push-current` because it has no local commits waiting to be pushed.
- Automatically pushing, prompting the maintainer to push, or adding a push command.
- Making a push or a CI result a required gate for a flow.
- Adding CI state to a ticket, stage, run history, or other persistent file.
- Changing containment semantics, ticket-row annotations, or the configured base-branch rule.
- Fixing Q-0104 or Q-0102, both of which are tracked separately.
- Changing the CI sweep or what any CI job executes.
- Adding a Studio board indicator; the Studio does not ship until M3.
- Adding headless/CI mode, cloud state, multi-user behavior, remote daemon behavior, a plugin marketplace, or any other v1 exclusion.

## Open questions

None block implementation.

The following choices are intentionally settled for this ticket:

- The reported fact is local-only commit count, not commit age and not a CI conclusion.
- The comparison target is the configured upstream of `repo.base_branch`, not a hard-coded `origin/<base>` ref.
- The surface is `quorum board`, delivered in M2.
- The status is repository-level because push lag is a property of the base branch, not of an individual ticket.

A future ticket may consider optional CI-service adapters or an explicit fetch operation, but either would introduce network-dependent behavior and requires a separate product and architecture decision.

## Risks

- A remote-tracking ref can be stale because this command does not fetch. The output could therefore report push lag that has already been pushed from another checkout, or fail to report commits present on a remote but not represented locally. The explicit local-git wording is required to prevent overclaiming.
- `push-current` could be misread as “CI is current.” The closed token vocabulary, legend, help text, and documentation must keep the claim limited to absence of locally observed unpushed commits.
- Upstream configuration is optional in git. Repositories without it will see an indeterminate status until a human configures one; Quorum must not guess and accidentally compare the wrong refs.
- Shallow history can make a zero or partial count look authoritative. The implementation must prefer `push-indeterminate(shallow clone)` whenever available history cannot establish the full comparison.
- Adding another repository-level line may make the CLI board noisier. Rendering it once, rather than once per ticket, limits that cost.
- Git ref names originate outside Quorum. They must be passed as argument values without shell interpolation so an injection-shaped ref cannot execute a command or alter the comparison.
