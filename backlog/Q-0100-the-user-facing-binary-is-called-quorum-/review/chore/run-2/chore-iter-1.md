# Q-0100 code review

Verdict: **revise**

major: packages/cli/src/binary-name.test.ts:100 The literal scanner treats a backslash as one skipped character but does not skip the escaped character following it. An escaped matching quote therefore terminates the literal early, allowing a valid printed string such as `'message: \'run harness init\''` to be split and potentially evade AC-4. Replace the ad-hoc quote scanning with TypeScript AST parsing, or correctly consume escape sequences and add discrimination tests covering escaped quotes and template literals.

major: packages/core/src/backlog/backlog.ts:155 This production-file edit is outside AC-13’s exhaustive confinement to `packages/cli/src`, `packages/core/src/backlog/project.ts`, their tests, and the three named documents. Although the old comment becomes stale, the implementation cannot silently widen an explicit scope boundary to repair it. Revert this edit or have the requirement amended to authorize `backlog.ts` before including it.
