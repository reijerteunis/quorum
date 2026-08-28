---
id: Q-0070
title: runCommand loses no output, and an overflow is not reported as a timeout
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0070/integration
priority: p2
created: 2026-08-27
iterations:
  requirements.head-of-product: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-08-28T09:56:33.784Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-28T10:00:41.488Z
    cost: 8.31
---
Split from Q-0065 at its requirements gate, 2026-08-27. Q-0065's merged requirement drafted this
body in full (§8) so the obligation could not expire; the measurements below **supersede that draft
where they differ**, and the difference is the point — see *"The discriminator, corrected"*.

**The defect.** `runCommand` (`spike/src/fanout.js:124–134`, `packages/core/src/fanout/command.ts`)
passes no `maxBuffer` and takes Node's 1 MiB default, and `integrate` runs the repository's whole
suite through it. `command.ts:59–60` already says so in a `Why:` comment naming Q-0065.

**This is the fourth time this ticket's subject has been measured, and the third time a record of it
was wrong.** Q-0048's merged requirement, the Q-0065 ticket body, both Q-0065 candidates and
Q-0065's own merged §0.1 each got a different part of it wrong. Every table below was re-derived at
Q-0065's gate against the real `runCommand`, three runs per cell, Node v24.15.0. **Do not re-derive
this from any earlier record.**

## The measurement

A child writes 2 MiB to stdout. Two variables: whether it writes monolithically or progressively,
and whether it ends naturally or calls `process.exit()`.

| 2 MiB written | ends naturally | calls `process.exit()` |
| --- | --- | --- |
| **monolithic** | `code 1`, `timedOut: true`, 1,114,112 B | **`code` = the child's own, `timedOut: false`, 65,536 B** |
| **progressive** (2048 × 1 KiB) | `code 1`, `timedOut: true`, ~1,050,000 B | `code 1`, `timedOut: true`, ~1,050,000 B |

A 900 KiB child returns `code 0` with all 921,600 bytes — the regression guard. Only the captured
byte count in the progressive cells varies between runs (1,049,600–1,054,720); every outcome is
stable 3/3.

**Three of the four cells are a genuine `maxBuffer` overflow, and they are the benign ones.** Node
kills the child with the configured `killSignal`, which both trees set to `SIGKILL`
(`fanout.js:127`, `command.ts:64`, pinned as source text at `fanout.source.test.ts:146`), and
`timedOut` tests that signal — so an overflow reports **`timedOut: true`**: a fifteen-minute timeout
that did not happen. Q-0048's implementer's *"the buffer defect wearing the timeout's clothes"*
hypothesis **holds**; they named the wrong disjunct (`killed`, which is `undefined`) and the Q-0065
ticket body dismissed it against bare `execSync` rather than against `runCommand`'s options.

## The discriminator, corrected

Q-0065's §0.1 concludes the discriminator is the child's **write shape**, having corrected the
claude candidate's claim that it is the child's **exit status**. Both are wrong, and the full
matrix is what shows it: three of the four cells overflow identically. The discriminator is the
**conjunction** — a monolithic write *and* an explicit `process.exit()`.

**And that cell is not a `maxBuffer` overflow at all.** `process.exit()` does not flush a piped
stdout, so the child discards its own unwritten bytes and only one pipe buffer is ever delivered.
The parent never sees more than 64 KiB, so no ceiling is involved and no `ENOBUFS` is raised.
`runCommand` reports faithfully what the child actually delivered. **Raising `maxBuffer` cannot fix
this cell** — which is the load-bearing consequence for the design question below, and which no
earlier record states.

**The exit-0 variant is worse than any record has it.** Q-0065's §0.1 row B has the child exiting 1,
so the result is `code: 1` — *"indistinguishable from an ordinary failing suite"*. The child that
exits **0** returns **`code: 0` with 64 KiB of a 2 MiB output**: `integrate` writes `tests=ok`, and
`expect: pass` is satisfied by a suite whose output was silently thrown away. That is a `tests=ok`
false green, not merely a misread failure.

## What this costs, in the order it costs it

A real test runner is a progressive producer, so the realistic shape is the **bogus timeout**:
`spike/src/engine.js:1046–1052` converts it to `envError`, `tests=invalid` in `runs.log` (`:1062`)
and a `FlowError` (`:1067`). It **fails closed** — it stops a run with a wrong diagnosis that sends
the reader to `commands.install`, and it never banks a false green. The truncating cell needs a
child that writes megabytes in one call and then calls `process.exit()`; a test runner does not, but
a wrapper script or a `cat`-like step could.

**Register row 7's interaction, narrowed — read this before repeating the broader claim.** Earlier
records say truncation *"can remove the very lines `environmentFailure` reads"*. Too strong, twice
over: `engine.js:1046` short-circuits on `r.timedOut`, so the overflow cells never consult
`environmentFailure` at all; and all six `ENV_FAILURES` signatures (`:1087–1094`) are **startup**
failures, which head-truncation preserves. The genuine gap is narrow — an environment failure
arriving *late* in a long run, in the truncating cell only. What does survive intact is that
truncation keeps the head while `:1071` stores `out.slice(-3000)`, so agents reading
`ctx.lastIntegration` (`:957`) get the middle of a long run rather than its failure summary.

**Headroom, unmeasured.** The Q-0065 body's 69,951 bytes was measured against a command carrying
`--force` that `harness.yaml:39` did not contain. Re-measure against whatever Q-0065 configures. A
*failing* run prints diffs and stack traces, the suite is 562 tests and growing, and Q-0054 still
has the regression suite to port.

## The design question, now evidenced rather than open

Q-0065's two candidates answered oppositely and its merged §8 left it undecided, requiring a
`docs/DECISIONS.md` entry before an implementer starts. **That entry is still required.** What has
changed is that the question is no longer a matter of taste:

- **Raise the ceiling** (claude's answer): an explicit `maxBuffer` justified in the JSDoc as a
  multiple of the largest observed real output; streaming refused as *"a product, not a chore"*.
  Cheap, preserves `CommandResult` exactly. **Measured against the matrix, it fixes the three benign
  cells and leaves the dangerous one untouched**, because that cell never reaches the ceiling. It
  moves a cliff, and a cliff that has moved is harder to find.
- **Remove the ceiling** (codex's answer): direct stdout and stderr to temporary files and build the
  result from the complete files. Measured at Q-0065's gate: the same two children, redirected to a
  file, deliver **2,097,152 bytes complete in both cells** — because writes to a file are
  synchronous on POSIX, so `process.exit()` cannot discard them. **It is the only one of the two
  that closes the false-green cell.** It brings a lifecycle nothing here has today: unique per
  invocation, outside tracked content, removed on success, failure and timeout, with a capture-file
  I/O failure stopping the run explicitly rather than resembling a test result.

This changes what `runCommand` returns, which is externally observable through `dev/integration.md`
and the persisted `output.txt`. Settle it in a decision entry, not in a review round.

**A route question to answer with it.** The chore route exists for work with no possible red phase.
This has one: a test that runs a 2 MiB-producing child and asserts complete output fails today and
passes after. If the answer is *remove the ceiling*, it is a behaviour change with new failure modes
and a contract worth constraining, and the full SDLC is arguably right; if *raise it*, chore is
right. **Decide the design first, then the route** — the reverse is how Q-0033 spent $41 on six
qa-red attempts.

## Criteria sketch, to be cut to about ten by whoever writes it

The chosen capture design, with its value or its lifecycle written down; an overflow is never
reported as a timeout; a large-output command that exits zero returns `code: 0` with complete
output; one that exits non-zero returns its own status with complete output; **the result does not
depend on the child's write shape, on whether it calls `process.exit()`, or on whether Node kills it
before it exits** — all three, since each has been proposed as the discriminator and only the
conjunction is; a large-but-under-ceiling command still returns cleanly (the 900 KiB row is the
regression guard); the real timeout path preserved unweakened — `command.test.ts:34–48` covers it
with `sleep`-based timing assertions that must stay; capture-infrastructure failure stops the run
explicitly and can never satisfy `expect: fail` or write `tests=ok`; equivalent tests in both trees;
and the landed pins updated in the same change and named in the report rather than discovered in
review — `command.test.ts:14,23` (`toStrictEqual` on the whole result object),
`fanout.source.test.ts:45` (`command.ts` exports are exactly `['runCommand']`), `:146`
(`killSignal: 'SIGKILL'` pinned as source text).

**Also fold in:** `commands.install` runs through the same `runCommand` (`engine.js:1036`) with the
same ceiling — Q-0065 OQ-2.

## Inherited from Q-0065, because this ticket opens the file next

`packages/core/src/fanout/command.ts:55` quotes this repository's configured command in its JSDoc
as ``(`npm test --prefix spike && pnpm turbo run test`)``, to explain why `runCommand` goes through
a shell. Q-0065 appended `--force` to that command on 2026-08-27, so the quotation is one flag out
of date. Q-0065's own §7 put the file out of its scope, so its implementer reported the staleness
rather than fixing it — correctly. Nothing pins the sentence and no test fails on it, which is
exactly why it needs an owner: **carry it as a criterion**, and correct the spike's twin comment in
the same change if it carries one.

## Landing constraint

The fix lands in `spike/src/fanout.js` **and** `packages/core/src/fanout/command.ts` together — the
Q-0066/Q-0068 shape — or the port loses the independent witness the freeze exists to provide.
Q-0070 is not one of Q-0009's fourteen children, so the freeze does not apply:
`.github/scripts/port-freeze-guard.sh` exits 0 with *"is not one of Q-0009's fourteen children — the
freeze does not apply"*. The implementer should re-verify that and state it in the report so the
reviewer does not spend a round on it.

Belongs to M2 in `docs/06-development-plan.md`.
