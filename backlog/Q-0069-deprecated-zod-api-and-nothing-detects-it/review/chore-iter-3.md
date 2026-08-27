# Q-0069 chore review — iteration 3

major: `.claude/rules/engineering.md:4` still states that type-aware linting is off and nothing detects deprecated APIs, contradicting the enabled `@typescript-eslint/no-deprecated` rule, `harness/rules.md`, and AC-11(b). Update this line through the required authorized or human commit so it names the rule, its `packages/**/*.ts` and `apps/**/*.ts` coverage, and the explicit `spike/**` exclusion.
