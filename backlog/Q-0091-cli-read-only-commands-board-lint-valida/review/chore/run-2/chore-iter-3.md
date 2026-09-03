# Q-0091 code review — run 2, iteration 3

Verdict: **revise**

major: packages/cli/src/validate.ts:58 `validate` never calls `loadProject()`, contrary to AC-4’s explicit requirement that both commands do so and produce the project-not-found failure outside a project. The spike evidence supports preserving the implemented behavior, but proposed E-5 is not among the binding errata supplied for this review; obtain a gate erratum limiting AC-4 to `lint`, or change `validate` and its AC-10 domain registration to satisfy the current criterion.

major: packages/cli/src/lint.ts:65 `lint` reads `flags.project`, contrary to AC-2’s explicit statement that it reads neither `rest` nor `flags`. Preserving the spike’s existing `--project` behavior is well-supported, but proposed E-6 is not binding yet; obtain the gate erratum correcting AC-2, or change the handler and tests to comply with the current requirement.
