# Integration — run 5, completed by hand 2026-08-23

Target: `harness/Q-0011/integration`

- ✓ base `main`
- ✓ harness/Q-0011/contracts

`merge-contracts` aborted run 5 on a conflict in
`backlog/Q-0011-run-history-on-disk/ticket.md`: the architect had edited the ticket on the
contracts branch and rewritten engine-owned frontmatter, resetting `iterations` to `{}` and
deleting three history entries with their costs. Git refused the merge only because `main` had
touched the same file — the safety property held by accident, not by design.

Resolved in favour of the integration side, which is `main`'s: the engine owns `iterations`,
`history` and `stage`, and an agent's edit to them is never authoritative. The architect's
prose changes to the ticket body were discarded with it; the body had already been corrected by
hand before this run.

The human gate had been answered `advance` and only this mechanical step remained, so the stage
was advanced by hand with `cost: 0` on the history entry — run 5's $3.624 is already recorded
against its aborted line in `runs.log`, and counting it twice is the double-count AC-22 exists
to prevent.

Contracts on the branch: `mock-adapter-run-history.contract.md`,
`run-history-writer.contract.md`, `run-manifest.schema.json`, `runs-cli.contract.md`.
`run-events.schema.json` is correctly absent — removed by the 2026-08-23 scope cut.
