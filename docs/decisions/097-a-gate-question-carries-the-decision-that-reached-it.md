# A gate question carries the decision that reached it — 2026-09-17

**Decision.** `gateQuestionEventSchema` gains exactly one optional field, `reached`: whole or absent,
never partly present, carrying the deciding step's id and the three values that step returned —
`verdict`, `findings`, `summary`. `packages/core` holds them in one run-scoped slot, assigned at the
single site where a verdict is validated and read at both sites that build a gate question.
`packages/server` changes not at all, and a browser renders it from `WireRun.gates`, which Q-0016
already carries and already parses.

**This is the first machine-readable value the event stream carries that a human acts on.** It has
carried narration — `info`, `warn`, `stdout` — and one correlation token, the `gateId` an answer
echoes. Everything else a reader needed has been a sentence composed for a reader. That is the line
this entry crosses, which is why it is an entry rather than a field.

**It binds two tickets, and that is the second ground.** Q-0129 renders the verdict on the gate
screen; Q-0131 renders the per-vendor cost on mission control, and its own body says the two *"both
need one ruling — how a structured value the engine already holds reaches a browser"*. A ruling that
binds a second ticket and is not written down is the drift this repository has recorded seven
directions of. **Q-0131 applies this entry to `cost`; it does not re-derive it**, and the refusals
below are recorded here so that it cannot.

**It does not reverse *"The event union is derived from what the product emits, and `tool` and `text`
are not invented"* (2026-08-25).** That entry refuses inventing a member for a producer that does not
exist. The producer here exists and is named: `steps.ts` validates the verdict and already writes
`{verdict, findings, summary}` to disk. This adds no member and invents no event; it widens one
existing member with what its own site already holds.

**Q-0127 erratum E-1's reader-side exclusion is left standing**, and this is the clause a later
ticket will look for. `.harness/` remains excluded from `GET /tickets/:id` and unreadable through
`GET /tickets/:id/file`. Nothing here serves that artifact; the value reaches the browser on the
stream, from the step that produced it, and the backlog read surface is untouched.

## Alternatives considered

Each was refused on a measurement rather than on taste, and each measurement is recorded so it is not
taken again.

- **Parse the `warn` or `done` prose.** Refused. Over this repository's own findings, **4 of 1,080
  contain the join separator themselves and 1,071 contain `": "`**, while a step id contains a colon
  by construction (`nextGateId` spells `<run>:<n>`). A parser would be wrong on real data, and a
  regex over a sentence written for a human is refused by the rendering rule Q-0015 states.
- **Widen `done` or `warn` structurally instead.** Refused: a gate question carries no `stepId`, so
  there is nothing to correlate a structurally-widened step event against.
- **Populate at the `handleFail` site.** Refused: `handleFail(step, context)` receives no output, and
  the most common gate in this repository is reached on a **pass** verdict, which never enters it.
- **A route over the `.harness/` artifact.** Refused: the path is `{run}`-scoped, a parked run's
  `runId` is `null`, and the only copy on the wire is a `gateId` the frozen contract forbids parsing.
  It would also reopen E-1 above.
- **Read it from run history.** Refused: struck at Q-0016's gate on identity, and `run-manifest-v1`
  is frozen at fifteen required keys, so `findings` and `summary` could not travel there anyway.
- **Read the run lock for the run number.** Refused: two authorities for one run's identity, and a
  stale lock is refused rather than reclaimed.

## Why

Because the alternative is a screen that parses prose, and this product's own rule is that a
rendering may not derive a value nobody measured. The gate screen exists so a human can see what a
step decided before answering it; making that decision travel as a value rather than as a sentence is
what lets the screen show it without inventing it — and what stops the next screen, and the one after,
each writing a different regex over the same message.

**It is deliberately one optional field and not a family.** Whole or absent is what keeps a partly
populated `reached` unrepresentable, and one field is what keeps this a widening of an existing
member rather than the beginning of a structured mirror of every message the engine emits. A second
field on this shape is a new decision, not an extension of this one.
