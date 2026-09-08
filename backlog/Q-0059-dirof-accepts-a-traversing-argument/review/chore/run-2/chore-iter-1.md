# Review — Q-0059, chore run 2 iteration 1

Verdict: **revise**

major: packages/core/src/backlog/backlog.ts:260 `readFiles` validates only the requested directory or pattern base, then reads every enumerated file without resolving that file. A symlinked file inside an accepted directory can therefore point outside the ticket folder and have arbitrary external contents loaded into an adapter prompt. The same leaf-path gap exists for `write` at line 153 and `log` at line 284 when `ticket.md` or `runs.log` is a symlink. This contradicts the requirement and the new architecture statement that every read and write remains inside a ticket folder. Validate each actual file destination/source through the confinement primitive before opening it, and add refusal tests for escaping file symlinks.
