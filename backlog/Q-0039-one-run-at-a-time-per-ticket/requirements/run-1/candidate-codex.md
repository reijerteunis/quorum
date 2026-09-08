# Q-0039 — One run at a time per ticket

## Problem

Two runs for the same ticket can currently execute at the same time. They can allocate the same run id, use the same ticket branch and share or remove the same worktree. A rollback or cleanup by one run can therefore move a branch or remove a directory while the other run is using it.

The risk exists in `packages/core`, which is shared by the CLI and the planned local daemon. Preventing duplicate starts only in the CLI would leave other callers unsafe.

The affected product surface is the **CLI** (`quorum run`). The implementation and persistent lock are owned by `packages/core`. The Studio is not changed by this ticket, but its later daemon must inherit the same protection from core.

## User story

As a **solo maintainer**, I want Quorum to refuse a second active run for the same ticket so that one run cannot reuse another run's id, move its ticket branch, or remove its worktree.

As a **cold-clone adopter**, I want the refusal to identify the active run and when it started so that I can understand why my command did not start without inspecting Quorum's source or run history.

## Acceptance criteria

1. `packages/core` enforces at most one non-dry run at a time for each ticket folder. Every caller of `runFlow`, including the CLI and the future daemon, receives the same protection without implementing its own process-local guard.

2. Runs for different ticket folders do not block one another, including when both tickets use the same flow or start at the same time. Repository-wide serialization and branch-wide serialization are not introduced.

3. A non-dry run claims its ticket lock before it calls `nextRunId`, reads `branchHeadAtStart`, appends a `start` line, creates a run-history directory, performs a preflight, obtains a worktree, invokes an adapter, executes a script, or changes ticket state.

4. The lock is an inspectable JSON file under `.quorum/locks/tickets/`. Its filename is derived deterministically and safely from the ticket id; a ticket id cannot make the path escape that directory. The file contains exactly these fields:

   ```json
   {
     "ticket": "Q-0039",
     "run": 12,
     "pid": 12345,
     "hostname": "developer-machine",
     "started_at": "2026-09-09T08:15:30.000Z",
     "owner": "opaque-per-run-value"
   }
   ```

   `ticket` is the ticket id, `run` is the run id being claimed, `pid` is the Quorum process id, `hostname` identifies the machine, `started_at` is a valid UTC ISO 8601 timestamp, and `owner` is a value unique to that claim. Unknown or missing fields make the lock invalid rather than being defaulted.

5. Claiming the lock is atomic across operating-system processes. The complete JSON content is prepared before the final lock pathname is claimed, and only one contender can claim that pathname. A check-then-write sequence that permits two successful owners does not satisfy this criterion. Temporary claim files are created in the same lock directory and are removed after either success or failure.

6. After one process has claimed a ticket lock, another non-dry run for the same ticket refuses immediately; it does not wait or retry silently. Before refusing, core reads the lock again from its final pathname and reports a `FlowError` whose condition includes the ticket id, holder run id and `started_at` value. The CLI renders that error through its existing single-line failure path and exits with status 1.

7. A refused second run performs no run work: it emits no run-start or terminal event, appends no line to `runs.log`, adds no ticket history entry, creates no `.quorum/runs/<ticket>-<run>/` directory, changes no stage or iteration counter, reads or moves no ticket branch, obtains or removes no worktree, and invokes no adapter or script.

8. Refusing a second run does not consume a run id. After run N releases its lock, the next run receives the id that the existing `nextRunId` contract derives from ticket history and `runs.log`; no gap is introduced solely by a refused contender.

9. A lock whose `hostname` equals the current hostname is stale only when an operating-system liveness check establishes that its `pid` does not exist. A permission error, unsupported check, ambiguous result, or a live reused pid is not treated as stale. This deliberately prefers an explicit refusal over risking two owners.

10. A lock from another hostname is never reclaimed automatically. A lock with missing, malformed or unsupported JSON is also never reclaimed automatically. In both cases core refuses the run with a `FlowError` that names the ticket and states whether the lock is held on another host or cannot be validated. It must not invent a run id, start time or liveness result that the file does not establish.

11. When a contender establishes that a lock is stale, it may remove that lock and attempt the same atomic claim once. If another contender wins during recovery, the loser reads the winning lock and refuses as in AC-6. Stale recovery cannot allow two successful owners.

12. Lock release is ownership-safe. A run removes the final lock only when its current `owner` value still matches the value created by that run. It must not remove a replacement lock created after manual intervention or stale-lock recovery.

13. Core attempts lock release in a `finally` path after every ordinary completion path and every handled failure path, including `completed`, `regressed`, `failed`, `aborted`, `undecided`, interrupted runs, failed preflight, adapter failure, script failure, persistence failure and an exception before a terminal event. The original run outcome or error remains authoritative if release also fails.

14. If lock release fails, core emits or throws an explicit error containing the ticket id and lock pathname; it does not report that the lock was released. A successfully completed run keeps its earned terminal status and persisted history, while the cleanup failure is surfaced as a warning so the audit record is not rewritten as a failed run.

15. Process termination that prevents `finally` from running may leave a lock file. The next invocation handles it according to AC-9 through AC-11. This ticket does not claim that abrupt termination always removes the file.

16. `quorum run … --dry` does not create, inspect, wait for, reclaim or remove a ticket lock. A dry run may execute concurrently with a non-dry run for the same ticket because it invokes no adapter, writes nothing, obtains no worktree and moves no branch. Existing dry-run behavior otherwise remains unchanged.

17. Automated tests deterministically coordinate two independent operating-system processes against one repository and prove that exactly one non-dry run for the same ticket proceeds. The test asserts that there is one run id, one `start` line, one run-history directory and no branch or worktree interference. Timing-only sleeps are not the synchronization oracle.

18. Automated tests prove all of the following independently:

   1. two different tickets can run concurrently;
   2. a live same-host holder is refused with its ticket id, run id and start time;
   3. a refused contender has none of the side effects listed in AC-7;
   4. an established dead same-host holder is reclaimed;
   5. two contenders racing to reclaim one stale lock yield exactly one owner;
   6. a foreign-host lock is preserved and refused;
   7. malformed lock content is preserved and refused;
   8. a run cannot remove a lock whose `owner` no longer matches;
   9. every terminal status and representative pre-terminal failures attempt release;
   10. a dry run neither observes nor changes the lock;
   11. runs after release retain the existing run-id sequence.

19. The mock-adapter end-to-end regression suite remains green and includes a CLI-level assertion that a refused second invocation prints one clear failure sentence, exits 1 and does not print a successful or terminal run outcome.

20. The implementation adds no dependency unless the solution document records why the platform APIs in Node 22 cannot provide the required atomic claim and liveness behavior. New or changed TypeScript remains strict, uses no deprecated API, and introduces no `any` or unjustified `@ts-ignore`.

21. The solution records the lock algorithm, file schema, stale-recovery rules and ownership-safe release contract in a new append-only `docs/DECISIONS.md` entry. Numbered documentation is updated in the same change where it describes run safety or `.quorum/` persistence. No surviving documentation claims that concurrent runs remain an open defect after this ticket lands.

22. Cross-cutting checks:

   1. **BYOS:** no adapter authentication behavior changes, and no subscription-secret input is added to code, tests, fixtures or documentation.
   2. **Worktree safety:** locking is enforced in core before any worktree or branch operation; flows still never write to the user's working tree.
   3. **Gate behavior:** gate answers, `auto`, `human-locked` gates and terminal-status rules are unchanged.
   4. **Files are the database:** the lock is the only new persistent state; no daemon-only or process-only ownership registry is authoritative.
   5. **Cross-vendor rule:** flow lint behavior is unchanged.
   6. **Product-agnostic:** the lock format and messages contain no product- or vendor-specific behavior.
   7. **Cold-clone impact:** no setup step, configuration or new command is required for ordinary runs; `.quorum/locks/tickets/` is created on demand.

## Non-goals

- Allowing more than one active non-dry run for the same ticket by allocating separate worktrees or branches.
- Serializing all runs in a repository or all runs using the same flow.
- Waiting, queueing, scheduling, prioritizing or automatically restarting a refused run.
- Adding a CLI flag that bypasses, steals or force-clears a live, foreign-host or invalid lock.
- Providing a new lock-management command or Studio screen.
- Coordinating runs across separate clones whose `.quorum/` directories are not shared.
- Guaranteeing automatic stale recovery after every kind of crash, machine loss, filesystem failure or pid reuse.
- Changing run-id numbering, run-history layout, ticket history, branch rollback, worktree cleanup, gate behavior or terminal-status semantics beyond preventing overlap.
- Adding multi-user, remote-daemon or distributed-lock behavior.
- Changing dry-run writes or reads beyond explicitly excluding dry runs from locking.

## Open questions

No blocking product questions remain in this candidate.

1. **Should a later ticket add an explicit lock-inspection or lock-clear command?** Owner: product manager. Non-blocking for Q-0039 because invalid and foreign-host locks fail safely and remain inspectable on disk; introducing a destructive recovery command needs its own authorization and UX requirements.

2. **Should the M3 Studio display the holder information when the daemon receives the core error?** Owner: M3 product manager. Non-blocking because the core error already carries the condition and the Studio is outside this ticket's writable surface.

## Risks

- Some filesystems may not provide the local atomic-link or exclusive-create semantics assumed by the solution. The implementation must test the selected primitive with independent processes and document its supported behavior; it must refuse rather than fall back to a non-atomic check-then-write path.
- A dead process id may have been reused. The conservative liveness rule can leave a stale lock requiring manual inspection, but it cannot create two owners.
- A project directory shared between machines can leave a foreign-host lock that cannot be reclaimed automatically. This is an explicit safety tradeoff until distributed ownership is designed.
- Filesystem or permission failures during release can leave a valid-looking stale lock after a completed run. The warning and next-run recovery requirements make this visible without changing the completed run's audit record.
- The interval between reading current run history and atomically claiming the prepared lock must not permit the winning lock to advertise an id different from the one the run uses. Tests must cover this ordering directly.
