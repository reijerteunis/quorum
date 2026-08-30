# Q-0080 code review

Verdict: **approve**

nit: spike/src/backlog.js:44 Invalid explicit IDs are interpolated verbatim into the CLI error. An `--id` containing a newline or other control character therefore violates AC-8’s one-line-error contract and can inject terminal formatting. Escape or sanitize control characters before including the value in the message, mirror the change in `packages/core/src/backlog/backlog.ts:267`, and add a CLI test using an invalid ID containing a newline.
