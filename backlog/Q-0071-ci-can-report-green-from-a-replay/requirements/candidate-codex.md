# Q-0071 — CI can report green from a replay, and its cache outlives the commit it was built for

## Problem

The repository CI can restore Turbo output produced for an earlier commit and let `pnpm test` replay every package result. The required check can therefore report green without executing a test against the commit named by the check.

This has already concealed an intermittent failure: CI repeated a previously cached pass until a forced run exposed the failure. A green required check must describe evidence collected from the checked-out commit, not the last result stored for matching cached work.

This ticket applies a correctness-first rule to the load-bearing test check: every test task contributing to that check must execute for the checked-out commit. Turbo caching may continue to accelerate `lint`, `typecheck`, dependency installation, and other non-test work. The CI output must make this distinction visible.

Surface: repository CI under `.github/`, its test command/configuration, and repository documentation describing the required check. This does not change the Quorum CLI, Studio, `harness/`, `backlog/` file formats, or adapter contract.

## User story

As a **maintainer**, I want the required CI test check to execute the repository's tests against the commit it names, so that I can use a green check as evidence that the current commit ran successfully rather than that Turbo found a previous result to replay.

As a **contributor**, I want the check name and output to state whether tests executed, so that I can understand what a green result establishes without knowing the repository's cache configuration.

## Acceptance criteria

1. **Required test check executes tests**  
   On every CI run for a pull request or protected-branch commit, every Turbo `test` task selected by the repository's normal test command executes against the checked-out commit. No selected `test` task may be satisfied by a Turbo local-cache or remote-cache replay.

2. **A restored cache cannot satisfy the test check**  
   Given a populated `.turbo` cache produced by commit A, when CI checks out a different commit B and runs the required test check, all selected `test` tasks execute. The check must not report green solely from entries created by commit A, including when the changed files do not affect Turbo's calculated inputs.

3. **A rerun of the same commit still executes tests**  
   Given a successful CI run and its saved cache, when the required test check is rerun for the same commit, all selected `test` tasks execute again. An exact-commit cache hit must not turn the required test check into a replay-only run.

4. **The repository's normal local test command is unchanged**  
   Running `pnpm test` outside CI retains its existing Turbo caching behaviour. The forced-execution rule is scoped to the required CI test check and does not globally disable developers' local test cache.

5. **Non-test CI caching remains available**  
   The change does not force execution of `lint` or `typecheck` tasks and does not prohibit caching package-manager data or other non-test CI work. If those tasks are cached, their result must not be presented as evidence that tests executed.

6. **The green-check claim is explicit**  
   The required check's visible name or summary states, in plain language, that tests were executed for the checked-out commit. A reader must not need to inspect `package.json`, `turbo.json`, or the workflow source to distinguish an executed test check from a cache replay.

7. **CI output provides execution evidence**  
   The required test check retains output sufficient to identify the checked-out commit and verify that every selected `test` task executed rather than replayed. If Turbo reports task statuses, the log or summary must expose them. The check fails if the command cannot establish that forced execution was requested.

8. **Test failures cannot be replaced by earlier cached passes**  
   Given a test that fails at the checked-out commit and a restored cache containing a pass for that task, the required test check reports failure. The cached pass must not suppress or replace the failing execution.

9. **A regression test covers the CI contract**  
   An automated repository test detects removal or bypass of the CI forced-execution behaviour. At minimum, it fails if the required CI test command once again permits Turbo to replay `test` tasks. The regression test must run without access to external subscriptions or services.

10. **Existing quality checks remain green**  
    The mock-adapter end-to-end regression suite, `pnpm lint`, and `pnpm typecheck` continue to pass. No deprecated dependency API is introduced in files changed for this ticket.

11. **No product contract changes**  
    The change introduces no new dependency, persistent file format, schema field, CLI option, adapter behaviour, flow behaviour, or gate behaviour. If implementation reveals that any such change is necessary, work stops and the ticket returns to requirements.

12. **Cross-cutting constraints are unchanged**

    - BYOS: no subscription environment-variable handling or subscription path is added or changed.
    - Worktree safety: no flow or core worktree behaviour is changed.
    - Gate behaviour: no gate or integrate-step behaviour is changed.
    - Files are the database: no persistent state is introduced.
    - Cross-vendor rule: not applicable; no reviewing or judging step changes.
    - Product-agnostic: no product-specific SaaS knowledge is introduced.
    - Cold-clone impact: local `pnpm test` caching remains unchanged, so a cold clone gains no additional required setup or local execution time from this ticket.
    - Errors are explicit: a test failure or inability to execute the selected tests fails the required check; it must not silently fall back to replayed output.

## Non-goals

- Changing `harness/harness.yaml` or the integrate step; Q-0065 already owns forced execution on that path.
- Adding `lint` or `typecheck` to the integrate step.
- Fixing or quarantining the intermittent `git.test.ts` failure tracked through Q-0061/Q-0064.
- Disabling Turbo caching for local development.
- Disabling CI caching for `lint`, `typecheck`, dependency installation, or other non-test work.
- Adding a second required CI check that duplicates the entire existing CI run.
- Redesigning the complete CI workflow or changing branch-protection policy beyond any check-name update required by AC-6.
- Tuning Turbo's default input calculation or adding task-specific `inputs` unless needed to preserve existing non-test cache behaviour after the test check is forced.
- Introducing remote caching, a new cache service, or a new dependency.
- Changing the Quorum CLI, Studio, flows, gates, adapters, ticket schema, or other product-facing behaviour.
- Detecting every intermittent test failure. This ticket ensures execution; it does not guarantee that an intermittent failure occurs on a particular run.

## Open questions

1. **What exact visible name should the required check use?**  
   Owner: maintainer. Non-blocking. The implementation may use a concise name such as `Test — executed at commit`, provided AC-6 is met. If branch protection refers to the old name, the maintainer must update that repository setting when the workflow change lands.

2. **Should execution evidence live only in the command log or also in the CI job summary?**  
   Owner: implementer. Non-blocking. Prefer a job summary if Turbo's normal output does not make executed-versus-replayed status immediately clear.

3. **What is the smallest reliable regression-test mechanism for workflow configuration?**  
   Owner: implementer. Non-blocking. It may validate the workflow command/configuration statically or exercise Turbo with a seeded cache, but it must fail on the regression described by AC-9 and must not duplicate GitHub Actions itself.

4. **Does the repository currently use a Turbo remote cache in CI?**  
   Owner: implementer. Non-blocking. The required test command must bypass both local and remote task-result replay if remote caching is present now or becomes enabled through existing configuration.

## Risks

- Forcing all CI test tasks increases CI duration, including for documentation-only changes and reruns. This is an accepted tradeoff for the required test check; local test caching and non-test CI caching remain available.
- Renaming a required check can temporarily weaken or block branch protection if repository settings are not updated at the same time.
- A configuration-only regression test may pass while a future Turbo version changes the meaning of the selected option. Where practical, the regression should exercise behaviour with a populated cache rather than checking only for a command-line string.
- More frequent execution may expose existing intermittent failures. Those failures must remain visible; suppressing or replaying around them would recreate the defect.
- Turbo may report execution and cache status differently across versions. The implementation should rely on supported behaviour and avoid parsing unstable presentation text unless the parser is covered by a test.
