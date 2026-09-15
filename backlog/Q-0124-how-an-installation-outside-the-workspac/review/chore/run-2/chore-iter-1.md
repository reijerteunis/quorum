# Q-0124 code review

Verdict: **revise**

major: packages/cli/src/open.test.ts:403 AC-6(b) requires executing the built CLI against an installation whose `@quorum/web/dist` has been removed and proving the refusal names a directory inside that installation rather than `node_modules/apps/web`. This test only injects an arbitrary empty fixture directory through `openOn`, so it bypasses both `import.meta.resolve` and the packed-install layout; the required locator regression can therefore break while the suite remains green. Add the missing-build case to the plain-Node packed/workspace execution coverage and assert the resolved directory is inside that installation.

major: packages/cli/src/build.test.ts:2277 The packed serving test does not establish AC-10(b)'s clean shutdown requirement. `stop()` treats a 30-second timeout followed by `SIGKILL` as success and never checks the child's exit code or signal, so a daemon that hangs during its shutdown path—or exits incorrectly—still passes. Make timeout/SIGKILL a test failure and assert the expected clean shutdown result after `SIGTERM`.

major: packages/cli/src/build.test.ts:2921 AC-2(d) explicitly requires measuring what `pnpm pack` writes for `@quorum/shared: workspace:*` under `@quorum/web`'s `devDependencies`, but this code states that a packer does not rewrite it and then excludes `web` from every packed-manifest inspection because `workspaceDepsOf` ignores devDependencies. The required measurement is therefore absent and the comment is an unverified tool-behavior claim. Inspect the packed web manifest directly, assert or record whether the devDependency remains `workspace:*` or is rewritten, and keep it outside the runtime-dependent register as required.
