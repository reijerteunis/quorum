# Erratum: two clauses of "What a run's event stream carries" describe a different engine — 2026-08-29

**Decision.** Two sentences of *"What a run's event stream carries, and how a gate answer travels
back"* (2026-08-28) are false of the engine that shipped. Both are corrected here rather than in
that entry, which has landed and is never edited.

1. **"Automatic and dry short-circuits run *before* a question is allocated."** They do not.
   `runStep` and `handleFail` build the whole `GateQuestionEvent`, `gateId` included, and `askGate`
   evaluates `auto`, command-level auto and `dry` afterwards — so a gate that is never asked spends
   an id. **The code is right and the sentence is wrong.** Making them agree would stop `askGate`
   taking a fully-formed `GateQuestionEvent`, a signature change to the one gate-policy primitive
   two later tickets code against, to close a gap in a token that is opaque, run-scoped and parsed
   by nothing. The identical sentence in `contracts/Q-0050/run-events.contract.md` is marked
   superseded in the same change.
2. **"a failed run emits its terminal event and the *following* pull throws the existing
   `FlowError`."** It throws whatever the run threw, unwrapped. Two landed criteria require that:
   AC-11 preserves `loadFlowByName`'s raw `ENOENT` as the one loader that produces no `FlowError`,
   and AC-12 preserves the unknown-goto `TypeError`, which a shipped test pins with
   `toBeInstanceOf(TypeError)`. Wrapping would fail that test and close two preserved defects in
   passing.

A third clause is **not** corrected and is recorded so a later reader does not mistake it for an
oversight. 062 says *"No event carries a timestamp, a sequence number or a run id"*, and a gate
event's `gateId` renders as `1:2`. That is a correlation token the contract calls opaque, not a
field a consumer reads; the contract now says outright that it is derived from the run id and a
sequence and is not to be parsed. The clause governs the event *payload*, and it holds.

**Alternatives considered.** Leaving both corrections in `backlog/Q-0050-…/solution/errata.md`,
where they were first written as E-12 and E-17 — rejected, and the reason is E-12's own sentence:
*"the sentence is corrected before a later ticket cites it against the code."* A ticket's errata
file does not do that. `04-architecture.md` and `GLOSSARY.md` cite 062 by title and date, so Q-0051
and M3 arrive at it and find two sentences describing an engine that was never built, with nothing
pointing away from them. E-9 measured that no flow on this route even reads `solution/errata.md`.
Amending 062 in place — refused by `.claude/rules/docs-and-decisions.md`, which is why entries 040
and 043 exist in this form.

**Why.** A decision entry outranks the numbered docs and is read years after the ticket that
produced it is closed. Both corrections were ruled correctly at the gate and both were written where
no future reader will look; this entry is the route, not a new judgement. E-12 and E-17 carry the
working.
