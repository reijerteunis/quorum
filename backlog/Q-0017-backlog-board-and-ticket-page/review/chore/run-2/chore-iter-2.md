# Q-0017 code review — run 2, iteration 2

Verdict: **revise**

major: apps/web/src/backlog-board.tsx:129 An id-less ticket with a valid stage is rendered as a card, but `ticketPath('')` produces `/backlog/`, which the router treats as the board route rather than the ticket-page route. The card therefore claims to navigate to a ticket while returning to the board. The implementation report acknowledges this unresolved default, but no requirement chose it. Do not render such a row as a navigable ticket card until it has a valid ticket token; surface it in an explicit malformed/unplaceable region, or establish and test a valid routing contract before using the folder as the route token.

nit: apps/web/src/backlog-board.tsx:3 The module header says all six board rules are imported from `@quorum/shared`, but the cost legend is declared locally and guarded against the CLI copy, as the same file correctly explains below. Rewrite the opening claim to distinguish the five shared declarations from the duplicated, equality-checked legend.

observation: The supplied patch was truncated at 200,000 bytes and provided no patch for eight changed files: `packages/server/src/static.test.ts`, `packages/shared/src/board.test.ts`, `packages/shared/src/board.ts`, `packages/shared/src/docs.test.ts`, `packages/shared/src/index.ts`, `packages/shared/src/wire.test.ts`, `packages/shared/src/wire.ts`, and `packages/shared/turbo.json`; these were inspected from the implementation branch rather than judged from the stat alone.
