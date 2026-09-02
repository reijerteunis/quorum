# Q-0096 code review — chore run 2, iteration 1

Verdict: revise

major: packages/cli/src/package.test.ts:218 AC-1 requires `@quorum/core` to resolve in a plain Node process outside the source directories, but this test requires `ERR_MODULE_NOT_FOUND` and therefore codifies the opposite result. The implementation report correctly identifies the conflict with decision 078 and says an erratum is owed, while GO-2 requires that erratum during the loop. Add the requirements erratum explicitly narrowing AC-1 to proving that Node selects `dist/index.js`, or sequence the emitted artifact into this change and assert a successful import; do not approve a failing runtime import as satisfying “resolves at runtime.”
