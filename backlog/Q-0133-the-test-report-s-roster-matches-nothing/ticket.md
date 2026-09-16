---
id: Q-0133
title: The test report's roster matches nothing this repository runs
stage: draft
owner: ruud
repos: []
branch: harness/Q-0133/integration
priority: p2
created: 2026-09-16
iterations: {}
history: []
---
testReport extracts every result line from the full output so that trimming the body is safe. It has matched nothing since the cutover, because the suites run through turbo and every line carries a package prefix the matcher does not allow.

**M3.** Opened 2026-09-17 from Q-0015's `qa-red` run, whose red report is the seventh consecutive
one to carry an empty roster and the first where anybody looked at why.

## The mechanism, and why it is not a trimming complaint

`packages/core/src/engine/suite-output.ts` trims a suite's output to `maxBytes = 24000`, head and
tail, naming the cut. **That is deliberate and its own JSDoc explains why it is safe**:

> *The roster is the point and the byte count is not. The report used to be the last 8,000
> characters, which cuts off the head — on Q-0033 seven of nineteen failing groups had no line in it
> at all, so the reviewer never saw them. Every line matching `RESULT_LINE` is therefore collected
> from the **full** output, whole and in source order, whatever the body loses.*

So the design is: trim the body, keep every result line. **The roster is what makes the trim
acceptable, and the roster is empty.**

```ts
const RESULT_LINE = /^\s*(?:\x1b\[[0-9;]*m)*\s*(?:[✓✗×√]|(?:not )?ok\s|#\s|\d+\)\s|(?:PASS|FAIL|SKIP)\b)/;
```

It permits leading whitespace and colour codes and then requires the symbol. **This repository runs
its suites through turbo**, which prefixes every line with the package that produced it, so a real
result line reads `\x1b[32m@quorum/web:test: \x1b[0m \x1b[32m✓\x1b[39m src/…` — the prefix sits
between the colour code and the tick, and nothing matches.

## Measured

Q-0015's red report: **110,804 bytes of output, 24,496 kept, `… 86,308 characters omitted …`** — and
of 231 report lines, **138 are ones a human would call results while `RESULT_LINE` matches one**,
which is the report's own markdown heading `# Test output` matching the `#\s` alternative. Zero
`FAIL` lines, zero `Tests N failed | M passed` summaries and zero `not implemented` stub errors
survive. **So the artifact a qa-red gate reads cannot answer the question that gate exists to ask.**

Across every `testReport` artifact in `backlog/` — keyed on the artifact's own `# Test output`
heading rather than on a filename, which is how this was first mis-measured — the split is exact:

| era | command | reports | roster |
| --- | --- | --- | --- |
| Q-0006, Q-0011, Q-0033, Q-0050 | the spike's bare runner | 8 | **all 8 populated** |
| Q-0120, Q-0015 | `pnpm turbo run test --force` | 7 | **all 7 empty** |

Q-0065 made `commands.test` a turbo invocation on 2026-08-27 and Q-0103 deleted the spike on
2026-09-06. Only two tickets have since run a route that writes one of these reports, so the defect
is 7 for 7 and has never been visible: **it presents as the italic sentence *"No lines in the output
looked like test results"***, which reads as an observation about the output rather than a failure of
the matcher. **Q-0120's entry recorded the consequence** — *"all three scenario reviews established
their verdict from the untrimmed artifact instead"* — **and not the cause.**

## What it owes

**A matcher keyed on what the suites actually print**, and a check that cannot go quiet again. The
obvious fix — allow an optional `<package>:<task>: ` prefix — is one line and is **not sufficient on
its own**: the failure mode is that an empty roster is indistinguishable from a run that printed no
results, which is *"A probe that could not answer is not a negative"* (2026-09-10) in a new place. So
the report should be able to say **which** of the two it met, and a fixture over real captured turbo
output belongs in the suite rather than a hand-written line.

**Do not re-derive the figures above from this body** — they were true on 2026-09-17, and this
repository's record is that a measurement copied from a document is not a measurement.

## Non-goals

Changing `maxBytes`, which is not the defect and which Q-0120's entry and this one both keep separate
from it. Q-0128, which is the **review diff** cap — a different constant, a different artifact and a
different reader. Q-0076, which is run-history retention. Changing `commands.test`.
