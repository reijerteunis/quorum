# Errata — Q-0062

Corrections and rulings against `requirements/merged.md`, dated, written before implementation.

## E-1 — `nextRunId` does not read the `start` line only — 2026-08-31

**Ruled: the criterion stands; its stated reason is wrong and is corrected here.** Found at the
requirements gate, before any implement round, by reading the function rather than the document that
describes it.

### What `merged.md` says

Four sites carry the same claim:

| Site | Wording |
| --- | --- |
| AC-1 (`:228`) | "`nextRunId` reads the `start` line only (verified today at `spike/src/engine.js:44` and the round-2 note at `:385–386`), so an added line cannot move an id" |
| Cross-cutting checklist (`:477`) | "`nextRunId` reads the `start` line only, verified today, so it cannot move a run id (AC-1)" |
| Provenance (`:493`) | credits "the `nextRunId` argument" as a contribution neither candidate saw |
| Provenance (`:547`) | lists "`nextRunId`'s read of the `start` line" among the measurements re-run today |

### What is true

`nextRunId` is **not** at `spike/src/engine.js:44`. That line is the call site,
`const runId = nextRunId(ticket)`, hoisted out of the `ctx` literal by Q-0057. The function is at
`:776`, and its ported twin is `packages/core/src/run-history/writer.ts:188`. Both read:

```
for (const m of fs.readFileSync(logPath, 'utf8').matchAll(/\brun=(\d+)\b/g)) fromLog = Math.max(fromLog, Number(m[1]));
```

That matches `run=<n>` **anywhere in the file**, on every line, not on the `start` line. Measured
against a real log: all 12 lines of `backlog/Q-0058-…/runs.log` carry `run=` — the `start` line, four
`step=` lines, the `gate=` line and the `completed` line. There is no line shape `nextRunId` skips.

### Where the claim came from, which is the point

It was transcribed from the source comment at `spike/src/engine.js:385–386`:

> *"nextRunId reads the `start` line, written before this directory is created, so a genuinely
> concurrent run takes the next id rather than colliding"*

That comment is making an **ordering** argument for a different guard — the `start` line is written
*first*, so an id is claimed before the run directory exists. It does not say, and does not need to
say, that the `start` line is the only line read. `merged.md` read it as an exclusivity claim and
recorded it as a measurement it had "re-run against the working tree today".

This is the failure mode Q-0058's implement report was corrected for one ticket ago, arriving in the
next ticket's requirement: **a measurement copied from a document is not a measurement.** The
sentences are left standing in `merged.md` rather than edited away, on that ticket's precedent,
because how the claim got there is the durable part.

### What survives, and what the implementer must therefore do

**AC-1 is unchanged and still correct.** Appending a `runs.log` line in the shape
`run=<n> removed-worktrees=<n> kept=<n>` cannot move a run id — but *because the line carries the
same `n` the run's own `start` line already carries*, so the maximum is unchanged, and **not**
because `nextRunId` declines to read it.

The difference is load-bearing rather than pedantic, and it converts a free choice into a constraint:

1. **The cleanup line MUST carry this run's own number `n`.** Under the retracted reason, any
   number — or none — would have been safe, because the line was believed unread. It is read. A line
   carrying `run=<n+1>` silently burns the next id; a line whose number is derived from anything but
   the current run is a defect this requirement would have told the implementer was impossible.
2. **AC-1's test is strengthened, not replaced.** Asserting that the next id is still `n+1` after a
   cleanup line is written stays as it is — but it passes under both the true and the false model, so
   it does not discriminate. Add the case that does: a cleanup line carrying a **different** run
   number, demonstrated to move the next id. That is the guard with a subject, per *"A check is not
   established by reading it"* (2026-08-29).
3. **Both trees.** The regex is byte-identical in `spike/src/engine.js:781` and
   `packages/core/src/run-history/writer.ts:196`, so R-1's "both trees in one change" applies to this
   clause with no divergence to preserve.

Nothing else in `merged.md` moves. No other criterion, non-goal, open-question ruling or gate
obligation depends on this claim.
