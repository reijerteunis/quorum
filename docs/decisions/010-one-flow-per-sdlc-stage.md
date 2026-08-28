# One flow per SDLC stage, chained by backlog state — 2026-08-21
**Decision:** Flows declare `consumes` and `produces` stages. A flow can only run on a ticket whose stage matches `consumes`; on success it advances the stage. The seven-stage SDLC (requirements, solutioning, qa-red, development, review, qa-final, deploy) ships as seven templates, not one flow.
**Alternatives considered:** One end-to-end mega-flow (simple to read, impossible to adjust per stage or to let different humans own stages).
**Why:** Adjustability and reuse across repos: swap a stage's models or pattern in isolation; different owners per stage; partial adoption (start with requirements only).
