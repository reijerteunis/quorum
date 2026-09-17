# Code review — Q-0015, round 3

## Findings

### major — The development plan still describes Q-0015 as requirements-only

[`docs/06-development-plan.md:3777`](../../../../docs/06-development-plan.md#L3777) still records only the requirements run and gate outcome. AC-14 explicitly requires this ticket’s plan entry to move, while the same diff updates `docs/04-architecture.md` to claim the hero screen exists. After merge, the two governing documents would therefore disagree about whether Q-0015 shipped and omit the implementation/review outcome from the plan.

Recommendation: update the Q-0015 plan entry as part of this change with the shipped surface and final verification facts, preserving its existing requirements provenance.

### major — The frozen contract specifies a different source guard from the implemented one

[`contracts/Q-0015/mission-control.contract.md:37`](../../../../contracts/Q-0015/mission-control.contract.md#L37) requires twelve delimiter-prefixed needles, but [`apps/web/test/source.test.ts:67`](../../../../apps/web/test/source.test.ts#L67) implements six: bare `cost=` and `verdict=`, plus four prefixed `role=` forms. The test title at line 76 still claims twelve while asserting six. Because the solution declares this contract authoritative, implementers and future reviewers cannot tell which guard is intended.

Recommendation: reconcile the contract with the six-needle ruling and rename the test accordingly, or restore the contracted twelve-needle implementation.

### nit — Architecture names a constant the browser does not use

[`docs/04-architecture.md:338`](../../../../docs/04-architecture.md#L338) says the browser retains `DEFAULT_RETENTION` events, but the implementation declares an independent `RUN_EVENT_RETENTION = 500`; the contract explicitly acknowledges that equality is maintained only by citation. The current wording implies a shared symbol and automatic agreement that do not exist, making future divergence easier to overlook.

Recommendation: name `RUN_EVENT_RETENTION` and its current value, and state that it intentionally matches the daemon’s `DEFAULT_RETENTION` by citation.
