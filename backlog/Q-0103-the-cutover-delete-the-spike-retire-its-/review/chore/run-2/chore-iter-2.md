# Q-0103 — chore review, run 2, iteration 2

Verdict: **revise**.

major: `CLAUDE.md:25` The primary repository instructions still say the runnable code is the now-deleted `spike/` tree. This directly leaves AC-24 incomplete and sends every Claude-driven contributor toward a nonexistent implementation. Apply the human-owned synchronization described in the implement report by deleting this obsolete bullet before accepting the cutover.

major: `CLAUDE.md:35` The documented command still invokes the deleted `spike/bin/harness.js`. This is a live instruction that fails immediately and omits the supported workspace and locally packed binary paths required by AC-24. Replace it with the supplied `pnpm exec quorum` and packed-install guidance before accepting the cutover.

major: `.claude/agents/flow-author.md:6` The live flow-author instructions still tell the agent to run `node spike/bin/harness.js lint`, which cannot succeed after AC-20. AC-27 requires no live instruction to depend on the deleted tree; remove that alternative so the instruction names only the working `quorum lint` path. Because this flow cannot edit the file, the human must synchronize it at the gate.

major: `.claude/settings.json:8` The active permission configuration still grants `npm install --prefix spike*` and, at line 10, `node spike/*`. Both entries authorize commands against a tree this change deletes, leaving AC-27's configuration sweep incomplete and preserving misleading dead configuration. Remove both spike-specific grants in the gate's human-owned synchronization.
