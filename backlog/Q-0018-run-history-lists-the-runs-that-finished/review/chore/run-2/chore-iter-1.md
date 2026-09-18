# Code review — Q-0018

Verdict: revise

major: packages/server/src/read.ts:121 `rollupRows` silently removes non-object roll-up entries before `wireRunHistoryRowSchema` validates the projection. A manifest with `rollup: [42]` therefore appears as a valid run with no billed vendors instead of being named in `warnings`, while the detail schema rejects the same manifest. Preserve and validate membership—or explicitly reject the run when filtering would discard an entry—so damaged history is not misreported as an empty roll-up.

major: apps/web/src/history-screen.tsx:217 Collapsing an in-flight detail request clears `opened` without invalidating that request's generation. When the request subsequently resolves, line 224 restores the row, so a row the reader collapsed reopens by itself. Increment/invalidate the detail generation on collapse and add a deferred-response regression test.

major: apps/web/src/history-screen.tsx:293 The Retry action for a failed detail calls `toggle(run.id)`, but because that row is already open, `toggle` takes its collapse branch and performs no request. Give detail retry a path that starts a new detail read, and assert that retry increases the request count and returns the row to an in-flight state.

major: apps/web/src/history-screen.tsx:254 Any response with `runs: []` renders the true-empty-store sentence even when `warnings` names run directories that could not be read. The result simultaneously says “The daemon found no runs” and lists runs it found but could not parse, conflating AC-3's partial-read state with AC-13's genuinely empty store. Render the empty-store copy only when both arrays are empty; use partial-read copy when warnings are present.
