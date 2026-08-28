# Bounded backward edges in the flow engine — 2026-08-21
**Decision:** Steps and routes may declare `on_fail: goto <step | flow:name>` with a mandatory `max_iterations`, a named counter persisted in the ticket, and `on_exhausted: gate`. Cross-flow backward edges (review → development, qa-final → development/solutioning) are allowed. Exhausted loops and exceeded budgets always land on a human gate.
**Alternatives considered:** Keep v1 strictly DAG and let humans re-run manually (safe but defeats the review↔dev loop the SDLC needs); unbounded loops (two vendors arguing on the user's subscription).
**Why:** The loops are the value of review and QA stages; bounding them is what keeps them safe and affordable.
**Amended 2026-08-25:** the budget half of this was never built. Nothing in the engine reads
`budget.per_run_usd` or `budget.per_ticket_usd`; a $13.86 step and a $22.27 run passed a cap of 10
untouched on Q-0035. Exhausted loops do land on a human gate, as decided; exceeded budgets do not,
because nothing measures them. See "Q-0035 accepted: a check that skips its subject must not report
success" (2026-08-25), which found it, and Q-0038, which carries it.
