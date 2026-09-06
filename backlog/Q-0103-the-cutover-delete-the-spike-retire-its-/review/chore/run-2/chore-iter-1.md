# Review — Q-0103 chore run 2, iteration 1

Verdict: **revise**.

- major: `CLAUDE.md:25` AC-24 explicitly requires this statement to stop identifying `spike/` as the runnable implementation, but it remains unchanged and now describes a deleted directory. Apply the gate-authorized edit supplied in the implement report before accepting the cutover.

- major: `CLAUDE.md:35` AC-24 explicitly requires the Commands section to name the supported workspace and locally packed binary paths, but it still tells agents to execute `node spike/bin/harness.js`. Replace it with the supported `quorum` invocation guidance before merging.

- major: `.claude/agents/flow-author.md:6` The live flow-author instructions still offer `node spike/bin/harness.js lint`, which will fail after AC-20. AC-27 requires no surviving live instruction to depend on a path under `spike/`; remove that alternative and retain the working `quorum lint` command.

- major: `.claude/settings.json:8` The active permission configuration still grants `npm install --prefix spike*` for a dependency tree that no longer exists. AC-27 expressly excludes surviving live configuration entries depending on `spike/`; retire this obsolete grant.

- major: `.claude/settings.json:10` The active permission configuration still grants execution of `node spike/*` after the entire directory is deleted. Remove the dead permission as part of AC-27's residual-reference cleanup.

- major: `.claude/rules/engineering.md:4` The agent-facing engineering rule still states that `spike/**` exists and remains outside ESLint's scope. Although this is a derived copy, leaving it unsynchronised makes the live vendor dialect contradict the canonical rule and the new repository layout; perform the required human sync before accepting the cutover.

- major: `docs/02-sdlc-pipeline-spec.md:562` This present-tense specification still says “Both engines” choose integrate content and cites deleted `spike/src/engine.js` at line 564. That is a live dependency prohibited by AC-27, not historical provenance. Rewrite the paragraph for the sole `packages/core` engine and remove the deleted-path citation.
