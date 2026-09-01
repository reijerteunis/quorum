# Q-0040 code review

Verdict: **revise**

- major: `contracts/Q-0011/run-manifest.schema.json:23` The engine now persists `status: undecided`, but the run-level schema still rejects it. Consequently, `harness validate` rejects a manifest produced by valid new behavior, AC-10 and AC-11 remain unsatisfied, and the frozen API/event/lifecycle contracts are likewise stale. Land the five contract updates and required erratum specified by AC-11 while leaving the occurrence enum at line 68 unchanged.

- major: `docs/decisions/076-a-run-that-nobody-answered-is-undecided.md:46` The governing decision says `--auto` “cannot produce `undecided`,” but the following sentence, the requirements, and the implemented smoke test all establish that an unattended `--auto` run reaching a human-locked gate does produce `undecided`. Correct the sentence to say that `--auto` can produce it, so the decision does not contradict shipped behavior.
