# Q-0126 code review — run 2, iteration 2

Verdict: **revise**

- major: packages/cli/src/open.ts:160 The blanket `catch` converts every failure from evaluating `@quorum/server`—including syntax errors, missing transitive dependencies, and top-level runtime exceptions—into “`@quorum/server` did not resolve from this installation.” In those cases the package may have resolved successfully, so this makes the inference decision 094 and AC-10 explicitly prohibit and hides actionable failures behind the packed-install refusal. Only translate a confirmed failure to resolve the requested package; propagate other import/evaluation errors through the unexpected-error path, and add coverage demonstrating that a broken resolvable module is not reported as absent or unresolved.
