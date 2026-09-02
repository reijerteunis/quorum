# Q-0098 code review — run 2, iteration 1

Verdict: **revise**

major: packages/cli/src/build.test.ts:1466 AC-18 selects `pnpm exec quorum help` as Mechanism A, but the test executes the generated shim directly. This bypasses pnpm’s command resolution and therefore does not prove the documented workspace-local command works or that package-runner installation/registry fallback is disabled. Invoke the selected `pnpm exec` mechanism under an explicitly fallback-disabled environment, while retaining the positive package-link assertions that establish the resolved binary is local.

major: packages/cli/src/build.test.ts:1647 The packer-agreement test checks only `packages/cli`, although AC-19 defines a three-package distribution set and both the test comment and implement report claim that pnpm and npm agree for all three packages. A divergence in `@quorum/core` or `@quorum/shared` would pass unnoticed. Iterate over `DISTRIBUTION` and compare both packers’ file lists for every package; separately inspect the CLI manifests if the reported `workspace:*` versus `0.0.0` divergence is intended to remain guarded.
