# "Red for the right reason" is an engine property, not a role property — 2026-08-22
**Decision:** Q-0004's remit is retired as written. The `automation-qa` role ships unchanged; a trustworthy red phase is guaranteed by invariants in the engine, not by prompt-tuning. Four are now enforced by `integrate`: dependencies are installed in the worktree before the test command runs; a suite that could not start is rejected rather than counted as red; the ticket branch is synced to `repo.base_branch` first; and every terminal outcome — completed, regressed, failed, interrupted — is written to `runs.log` with its counters persisted.
**Alternatives considered:** Tune the QA role's prompt until its tests fail for the right reason, which is what the milestone plan assumed the work would be. Six runs on a real ticket produced no evidence the role was ever at fault, and every defect found was in the engine underneath it.
**Why:** M1's plan says "tune the automation-qa role until red is 'for the right reason'". The role never needed tuning. Six engine defects did, each of which made a false red either possible or unavoidable:

1. A worktree is a fresh checkout with no `node_modules`, so the test command died on a missing dependency — and `expect: fail` read exit 1 as proof of red. **Every ticket would have proved red this way, forever.**
2. Non-zero exit was accepted as evidence a suite ran. It is not.
3. Ticket branches never caught up with their base. Q-0006's integration branch was five commits stale, so QA worked against a tree without `ajv` or `test/run.js` and appeared to revert both.
4. Ctrl-C at a gate wrote no outcome and no counters, silently refunding the iteration budget — an undocumented route to unlimited retries.
5. `retry` cleared *every* counter on the ticket and granted `max_iterations + 1` further traversals instead of one.
6. The guard added for (2) was then defeated by its own test: a suite that asserts "a broken environment is not a red phase" prints that signature in a pass message, and the detector matched it, throwing away a genuine red phase.

The last one is the useful one to remember. A detector that reads raw output cannot distinguish a crash from a test *quoting* a crash, so it now ignores anything on a line that reports a result — a line reporting a result is proof the suite ran, and therefore cannot be proof it never started.

**Evidence the mechanism now works:** Q-0006 run 6 produced seven assertion failures named by acceptance criterion (`AC-15: lint rejects prefixed counter`, `AC-16: lint rejects max_iterations 0`, …) from two test files, against executable contracts, on a synced branch with dependencies installed. That is the red phase M1 exists to prove, and it took no change to any role.
