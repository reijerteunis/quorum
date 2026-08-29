# Review — Q-0050 round 4 · codex

*Cross-vendor reviewer · read-only · 2026-08-29 · out of band, over `8355940..addefa8`*

Run by hand: the integration branch is contained in `main`, so `review.yaml`'s
`{base}...harness/{id}/integration` range is empty and the flow cannot review this ticket.
Q-0070's precedent. Codex is the cross-vendor voice — every line under review was written by
Claude. `solution/errata.md` E-1–E-19 was supplied in the prompt as binding, which the flow
cannot do because `review.yaml` names no errata input (E-9).

## Findings

- **major** — [packages/core/src/engine/q0050.source.test.ts:128](/Users/ruudvanengelenhoven/Development/quorum/packages/core/src/engine/q0050.source.test.ts:128), [backlog/Q-0050-core-engine-run-loop/qa/scenarios.md:436](/Users/ruudvanengelenhoven/Development/quorum/backlog/Q-0050-core-engine-run-loop/qa/scenarios.md:436): The AC-13d fix stops short of its subject. Checking that an authority line is shorter than 120 characters does not prove it reproduces no sentence from a decision entry or ticket body; any short copied sentence passes. The scenario still claims an actual substring scan against both documents and says there are eight sites, while the implemented register and traceability table contain seven. This leaves the acceptance criterion and round-3 remedy unverified while the coverage document reports them as covered. Implement the specified comparison against the authoritative texts in a package with declared inputs, or explicitly record and approve the criterion’s reduction; then make the scenario’s site count and method match the executable check.

Tests could not run in the read-only environment because Vitest attempted to create a file under `node_modules/.vite-temp`. `git diff --check` passed.
