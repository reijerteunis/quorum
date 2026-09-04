# Review

Verdict: revise

major: packages/cli/src/gate.ts:166 The readline interface is only closed after `rl.question()` resolves, while a SIGTERM causes `askGate`'s abort promise to reject without settling this pending question. The run can therefore finish and remove its process handlers while the readline interface and its input listeners remain open, violating AC-7(7) and potentially keeping the process alive. Arrange for cancellation to close and settle the interactive reader on SIGTERM as well as SIGINT, while preserving `interrupted` precedence.

major: packages/cli/src/gate.ts:215 The required AC-6 diagnostic says `pass --gate-answer <advance|retry|abort>` (or `<advance|abort>`), including the angle brackets, but the implementation emits `pass --gate-answer advance|retry|abort`. Update both variants to the exact required text and adjust the tests accordingly.
