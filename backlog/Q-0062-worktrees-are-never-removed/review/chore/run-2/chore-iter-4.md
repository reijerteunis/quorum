# Q-0062 review — iteration 4

Verdict: **revise**

- major: packages/core/src/engine/q0062.source.test.ts:30 The AC-4 source guard does not actually cover every ref-deleting command it claims to forbid: its patterns recognize only selected single-quoted spellings, so commands such as `git(["branch", "-d", branch])`, shell-form `git branch -D`, or a double-quoted push deletion pass unnoticed. Strengthen the scan to cover the supported command forms and demonstrate each alternative with positive-control mutations.

- major: spike/test/q0062-worktree-lifecycle.js:235 The spike’s required AC-4 pin duplicates the incomplete core scan and likewise misses double-quoted or shell-form branch deletion commands. Make this guard enforce the production-wide no-ref-deletion rule regardless of quote style or command construction, with red demonstrations for the additional forms.

- nit: docs/06-development-plan.md:682 The durable Q-0062 entry says the new totals are `336 / 2026 / 2338 / 4700`, but `spike-parity.test.ts` now pins `336 / 2026 / 2407 / 4769`. Update the plan to the final round’s measured values so its claim that these figures were re-derived remains accurate.
