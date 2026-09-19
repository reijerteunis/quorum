# Review — Q-0137, chore run 2, iteration 4

Verdict: **revise**

- blocker: `packages/core/src/run-history/reader.ts:684` The file is opened through `found.directory` after `pathInside` validated that pathname and `retainedIn` enumerated it. If the occurrence directory is replaced with a symlink between enumeration and this open, the intermediate symlink is followed; `O_NOFOLLOW` protects only the final file component. An attacker can therefore place the same leaf name outside the run and have its bytes served, violating AC-3’s confinement guarantee. Hold and read through a safely opened occurrence-directory identity (or an equivalent race-safe mechanism that prevents intermediate symlink traversal), and add a staged test that replaces the occurrence directory—not merely the leaf—between membership enumeration and the read.

- observation: The supplied patch was truncated at 200,000 bytes and omitted seven files entirely. Those files were inspected directly from `harness/Q-0137/implement` rather than judged from the diff stat.
