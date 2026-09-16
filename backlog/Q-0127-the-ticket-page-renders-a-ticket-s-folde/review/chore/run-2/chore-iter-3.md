# Review — Q-0127, chore run 2, iteration 3

Verdict: revise.

major: packages/server/src/read.test.ts:578 The test titled “a file that stops being one between the listing and the read is 404” does not stage that condition: it deletes the file before starting the request and then asserts `400 not-a-file-path`. Consequently the `readTicketFileBytes(...) === null` → `404 no-such-file` branch required by AC-5 remains untested, despite the acceptance criterion explicitly requiring this interleaving. Introduce a controllable seam or filesystem interleaving that removes/replaces the file after `listTicketFiles` includes it but before the byte read, then assert `404` and `no-such-file`; rename or retain the current test separately for the pre-request absence case.
