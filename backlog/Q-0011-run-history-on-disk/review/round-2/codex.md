# Code review — Q-0011, round 2

## Findings

- **major** — `spike/bin/harness.js:515`: Ticket-filtered listings return without setting a non-zero exit code when `warnings` contains malformed sibling directories. This contradicts AC-12 and the CLI contract, both of which require malformed siblings to be named and the command’s final exit to be non-zero. Apply the same `warnings.length` exit-code handling used by the unfiltered list path, and add a filtered-list regression test containing a malformed sibling.

- **major** — `spike/bin/harness.js:141`: A manifest is considered readable solely because it parses as JSON. A parseable but structurally invalid document such as `{}` is rendered as a valid run rather than named as malformed; incompatible field types can also make formatting throw and prevent valid siblings from being listed. Validate the minimum manifest structure, preferably against the run-manifest contract, while loading each sibling and convert validation or rendering failures into per-run warnings.

- **major** — `spike/bin/harness.js:493`: Detail-path confinement is lexical only. `fs.statSync()` and the subsequent read follow symbolic links, so a single-segment symlink inside `.quorum/runs/` can point outside the runs root and expose an external `manifest.json`, violating AC-13’s requirement to read only inside the selected run directory. Resolve the candidate with `realpath` and verify it remains beneath the real runs root, or reject symbolic-link run directories; cover this with a symlink traversal test.

- **major** — `spike/src/engine.js:814`: An integrate occurrence can throw on an early base-branch merge failure before reaching the sole `output.txt` write at line 858. The outer run catch terminalizes the occurrence, but its directory is left without the output file required for every script/integrate occurrence. Persist the accumulated integration output (including an empty file when appropriate) and terminalize the occurrence before every early throw, or use a `finally` path that guarantees `output.txt` after allocation. Add coverage for the base-sync conflict path, not only install/test failures.
