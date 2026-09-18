# Q-0135 — code review, run 2, iteration 2

Verdict: revise.

major: apps/web/test/source.test.ts:974 The AC-11 guard parses timer callbacks by counting every bracket character without recognizing strings, templates, regexes, or comments. A callback containing an unmatched closing delimiter in a literal before `fetchRuns(...)` can therefore be truncated before the request and pass the guard. The final helper-call check at line 1002 also interpolates identifiers directly instead of using `asNeedle`, so a legal requesting helper containing `$` can evade detection. This leaves the required “no fetch is reachable from a timer callback” clause with concrete false negatives. Use a syntax-aware traversal or a lexical scanner that skips literals/comments, reuse properly escaped identifier matching at the callback boundary, and add discriminating fixtures for both cases.
