# Q-0059 code review — run 2, iteration 2

Verdict: **revise**

blocker: packages/core/src/backlog/confine.ts:55 `deepestExisting` treats every `realpathSync` failure as if that path did not exist and continues to its parent. A dangling symlink inside a ticket folder whose target is a nonexistent path outside the folder therefore falls back to an accepted in-folder parent; `write`, `writeFile`, or `log` then follows the symlink and creates the outside target. This violates AC-6 and the ticket’s central write-confinement guarantee. Distinguish a genuinely absent component from an existing but unresolvable filesystem entry (for example using `lstatSync`) and refuse the latter; add regression tests for dangling escaping symlinks at `ticket.md`, `runs.log`, and a `writeFile` destination.

major: packages/core/src/backlog/backlog.ts:8 The module docblock claims that the store “reads and writes inside its own root and nowhere else,” but `read()` still follows an escaping `ticket.md` symlink, behavior the implementation report and architecture document explicitly preserve. This leaves the source-level security contract contradicting the implementation and the corrected numbered documentation. Narrow the docblock to the actual guarantee for `dirOf`, `write`, `writeFile`, `readFiles`, and `log`, including the deliberate `read`/`list` exception.
