# Review — Q-0131 implement run 2, iteration 1

**Verdict: revise.**

major: apps/web/test/source.test.ts:115 AC-6 requires the new guard to forbid the literal `run #` anywhere under `apps/web/src`, but `LITERAL_PERMITTED` exempts two source files and expressly allows that literal to remain. This turns the required corpus-wide prohibition into a register of exceptions and leaves those files dependent on an incomplete extraction-pattern scan. Assemble the refusal-condition fixture text so it does not contain the literal in source, remove the exemptions, and assert that the complete `apps/web/src` corpus is literal-free.
