# Code review — Q-0091 run 2, iteration 2

Verdict: **revise**

major: packages/cli/src/validate.ts:61 `validate` deliberately skips `loadProject()`, but binding AC-4 explicitly requires both commands to call it first and emit the project-not-found sentence outside a project. The spike evidence may justify changing the requirement, but E-1 through E-4 do not authorize this divergence; obtain the proposed gate erratum limiting AC-4 to `lint`, or implement AC-4 as written.

major: packages/cli/src/lint.ts:66 `lint` reads and forwards `flags.project`, contrary to binding AC-2's explicit statement that `lint` reads neither `rest` nor `flags`. Preserving the spike behavior is well-supported, but the implementation cannot resolve the contradiction by choosing one requirement itself; obtain the proposed gate erratum correcting AC-2, or change the handler to satisfy the current criterion.
