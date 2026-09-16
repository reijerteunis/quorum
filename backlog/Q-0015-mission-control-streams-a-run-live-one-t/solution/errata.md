# Q-0015 solution errata

## E-1 — AC-6 scans parsing forms rather than bare message fragments

AC-6's whole-corpus source clause is corrected before QA writes scenarios. The corpus remains every
file under `apps/web/src`, including tests and non-TypeScript files. The guard scans twelve parsing
needles: each of `cost=`, `role=` and `verdict=` prefixed by a single quote, double quote, backtick
or slash. Bare `role=` is not a needle because it falsely matches the shipped accessibility selector
`[role="progressbar"]` in `backlog-board.test.ts`.

The guard must prove both directions: a template-literal parsing fixture is rejected and the
accessibility-selector fixture is accepted. Fixture strings are assembled so the guard does not
flag its own source. This changes only the instrument, not AC-6's product rule: browser code must
not parse a human-readable event message for a machine value.
