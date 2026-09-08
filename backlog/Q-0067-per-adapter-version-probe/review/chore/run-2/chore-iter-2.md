# Review: Q-0067 chore run 2, iteration 2

Verdict: revise

major: packages/core/src/adapters/cli-version.test.ts:104 The AC-6 guard misses a third reader written as `entry['version' + '_state']`, as the iteration-2 report itself acknowledges. Such a reader can consume or forward the state without matching any `VOCABULARY` needle, leaving the suite green despite AC-6 requiring the guard to fail on any third reader. Use a structural scan that resolves static computed property names, or enforce the boundary through an API/module structure that cannot be bypassed this way, and add this exact mutation case.

major: packages/core/src/adapters/adapters.ts:312 The production JSDoc still restates several clauses of the governing decision—report rather than refuse, do not select flags/fields/schemas, and do not affect exit codes—before citing it. The same pattern remains at `packages/core/src/adapters/claude-capabilities.ts:25`, `packages/core/src/adapters/codex-capabilities.ts:24`, and `packages/cli/src/adapters.ts:102`. This conflicts with GO-1 and `.claude/rules/engineering.md`, which require one line naming the authority rather than transcribing the decision into source, and means iteration 2 did not fully address the prior finding. Retain only necessary local contract documentation and one `Why:` citation; leave policy exposition in the decision and glossary.
