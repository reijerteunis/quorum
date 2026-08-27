# Review — Q-0069 chore iteration 1

major: .claude/rules/engineering.md:4 The rules copy still says type-aware linting is off and that nothing detects deprecated APIs, directly contradicting the newly enabled `@typescript-eslint/no-deprecated` rule and AC-11(b). Update this line to match the canonical `harness/rules.md`, including the covered file set and the explicit `spike/**` exclusion, before landing the change.
