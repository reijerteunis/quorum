# Q-0094 code review — iteration 3

major: docs/06-development-plan.md:770 The text still incorrectly says three of the five CLI gate sites mean nobody was there. Errata E-2 explicitly rules that correcting this numbered document is part of this ticket and that the edit must stay. Restore the measured split: two unanswered sites and three operator-error sites.

major: packages/cli/src/run.ts:135 The handler still destructures only `rest`, `flags`, and `gateAnswers`, despite AC-1(3) requiring it to read `cmd` as well and Errata E-2 explicitly confirming the earlier finding as real. The generic dispatch assertion in `main.test.ts` proves that `cmd` reaches handlers, not that this handler consumes it. Consume `cmd` from the supplied `ParsedArgv` in `runOn` and add source-level coverage that fails when the run handler omits any of the four required fields.
