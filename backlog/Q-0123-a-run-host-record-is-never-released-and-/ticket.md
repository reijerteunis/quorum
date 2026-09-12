---
id: Q-0123
title: A run host record is never released, and a listing makes it visible
stage: draft
owner: ruud
repos: []
branch: harness/Q-0123/integration
priority: p3
created: 2026-09-12
iterations: {}
history: []
---
RunHost.records grows for the life of the process: records.set is called once per mint and there is no records.delete or records.clear anywhere in packages/server, so a record survives its run ending and survives shutdown(), which filters for state === 'running' and removes nothing. Invisible while view(handle) was the only reader; Q-0121's enumeration is the first consumer that turns it into a growing answer.

Opened **2026-09-12 at Q-0121's requirements gate** (that document's GO-2), with the body written
out in full rather than referenced — three obligations found in one week (Q-0110, Q-0111, Q-0112)
had lived only inside a closed ticket's prose or a source comment, and each had to be rediscovered
before it could be worked.

## What was measured, and where

`packages/server/src/host.ts`. `records.set` is called once per `mint` (`host.ts:260`), and
`grep -rn "records\.delete\|records\.clear" packages/server/src/` returns **nothing** — verified
2026-09-12. `shutdown()` snapshots `[...records.values()].filter((record) => record.state ===
'running')` (`host.ts:424`) and releases each through the stream's abandonment path; it removes no
entry from the map. So a record outlives its run, outlives the host's shutdown, and is freed only
when the process exits.

**Q-0121 is what makes it visible.** While `view(handle)` was the only reader a caller had to
already hold a handle, so an unreleased record cost one small object and answered nobody. An
enumeration reports every one of them: a maintainer who starts forty runs and mistypes ten tickets
is served fifty rows for the life of the daemon, and the fiftieth is as prominent as the first.
Q-0121 registered this and did not fix it, taking only one mitigation — AC-3's newest-first order,
which is a mitigation of the **reading** and not of the growth.

## Why Q-0121 refused to fix it, which this ticket must not undo

Pruning was refused there **on measurement rather than on taste**, and the measurement still holds:
an ended run's retained buffer is exactly what Q-0121's AC-4 and AC-11 make reachable —
`Broadcast.subscribe()` is documented *"Permitted after `Broadcast.close`"* (`broadcast.ts:56`) and
implemented that way, so opening the socket on an ended run's handle replays up to `retain` events
with its `missed` count. **Evicting ended records would remove the thing Q-0121 added.** A cap on
the *listing* was refused for a worse reason: it would hide runs while looking complete, which is
the shape *"A probe that could not answer is not a negative"* (2026-09-10) forbids.

So the naive fixes are both closed, and what is left is a real design question rather than a line.

## What it must decide

1. **What bounds the set** — an age, a count, a state, or the arrival of a durable store. Whichever
   it is, it must not evict a record whose retained buffer a client can still reach, or it undoes
   Q-0121.
2. **Whether a bound is even the answer.** `retain` is per run and already bounded at
   `DEFAULT_RETENTION = 500` (`serve.ts:43`); what grows is the *number of records*, each small. A
   single-user local daemon's session length may be the honest bound, in which case the deliverable
   is the sentence saying so and a test pinning it, not an eviction path.
3. **What a client is told when a record is gone.** `GET /runs/:id` currently answers 200 for any
   handle the host minted and 404 only where it minted none (Q-0121 AC-5), and its condition —
   *"no run is registered under that handle"* — is true of that case. An evicted record makes that
   sentence false for a handle the host **did** mint, which is the class Q-0074 and Q-0115 exist to
   remove. A third answer, or a different sentence, is owed if anything is ever removed.

## Sequencing and priority

**After Q-0121**, which creates the reader that gives this a subject; there is nothing to bound
until something enumerates. **p3**: bounded in practice by a single-user local daemon's session
length, one small record per run, and no correctness consequence today — it is a growth nobody has
measured hurting anything, registered so that the first person it does hurt does not have to
rediscover it. **Q-0019** (resumable runs after daemon restart) is the ticket most likely to change
the premise, since a durable store would make a handle mean something across a restart and would
move where this state lives.
