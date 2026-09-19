# Review — Q-0138, chore run 2, iteration 2

verdict: revise

major: packages/server/src/retained.test.ts:809 AC-10 is still not tested through the real producer-to-rendering chain. The test obtains `running` from a real daemon response, but only interpolates it into a source-text search at line 825; the web rendering test separately consumes a hand-built fixture. Consequently, the real wire response never reaches `HistoryScreen`, contrary to AC-10, and changes between the produced response and the UI fixture can still pass. Feed the detail and retained responses produced by the held real run into a behavioral rendering test and assert `NO_OUTPUT_RUNNING_TEXT` is rendered while `NO_OUTPUT_TERMINAL_TEXT` is absent; remove the source scan once that join exists.

observation: GO-3's measured threshold was crossed, so the required performance successor remains owed before this ticket closes.

observation: GO-5 and the populated-main half of GO-6 remain gate obligations and were not discharged by the implementation run.

observation: The reported CLI failures arise from the existing test-workspace copier consulting index entries for deleted files; that defect is outside this change, but the full bare-worktree verification row is not green.
