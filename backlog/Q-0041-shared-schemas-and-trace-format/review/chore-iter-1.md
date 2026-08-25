# Q-0041 code review

Verdict: **revise**

major: packages/shared/src/flow.ts:181 `agentStepSchema` requires `id`, and the script, integrate, and fan-out schemas repeat that requirement, even though `lintFlow` accepts steps of those kinds without an `id`; parallel members inherit the same requirement through `agentStepSchema`. This violates erratum E-1’s binding rule that the schema may require no key whose absence lint accepts, and it rejects existing-format objects before lint can remain authoritative. Make `id` optional for every step kind where `lintFlow` does not require it, and add real-`lintFlow` presence tests covering an id-less plain agent, parallel member, script, integrate, and fan-out step.
