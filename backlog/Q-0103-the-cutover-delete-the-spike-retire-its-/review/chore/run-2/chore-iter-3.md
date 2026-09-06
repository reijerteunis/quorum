# Q-0103 — code review, run 2, iteration 3

Verdict: **revise**.

major: `CLAUDE.md:25` The primary repository instructions still say the runnable code is the now-deleted `spike/` tree. This leaves every reader with a false startup instruction and fails AC-24. Delete the obsolete bullet during the gate-owned synchronization.

major: `CLAUDE.md:35` The Commands section still directs readers to execute `node spike/bin/harness.js`, which cannot run after AC-20. Replace it with the required workspace `pnpm exec quorum` and locally packed-install guidance, without claiming registry-resolved `npx quorum`.

major: `.claude/agents/flow-author.md:6` The live flow-author role still offers `node spike/bin/harness.js lint`; that command now targets a deleted file and violates AC-27’s prohibition on surviving live instructions. Remove the dead alternative in the gate-owned synchronization, leaving `quorum lint`.

major: `.claude/settings.json:8` The allowlist still contains `Bash(npm install --prefix spike*)` and, at line 10, `Bash(node spike/*)`. Both grants authorize commands against a deleted tree and violate AC-27’s configuration sweep. Remove both entries by matching their content so deleting the first does not shift the second line and accidentally remove an unrelated grant.
