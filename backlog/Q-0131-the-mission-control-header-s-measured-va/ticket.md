---
id: Q-0131
title: The mission control header's measured values
stage: draft
owner: ruud
repos: []
branch: harness/Q-0131/integration
priority: p2
created: 2026-09-16
iterations: {}
history: []
---
The run number, the elapsed time and the per-vendor cost ticker: three values the brief names and the wire does not carry.
**M3**, split from Q-0015 at its requirements gate on 2026-09-16. The body below is Appendix A(b)
of `backlog/Q-0015-*/requirements/merged.md`, transcribed in full rather than referenced.

*Opened at Q-0015's requirements gate, 2026-09-16. p2. Weighed together with Q-0129, not separately.*

Deferred from Q-0015's OQ-1, with its measurements so they are not re-derived from the design brief —
`docs/05-design-prompt.md:39` specifies *"run #42 … elapsed 14:32, per-vendor cost ticker"* and three
of those four are not on the wire.

- **The run number** is `null` for the life of a live run (`host.ts:304`, `wire.ts:103`) and arrives
  only on the terminal event, which carries `runId`. Correlating it earlier is a `core` question, not
  a transport one.
- **Elapsed** has no source: no event carries a timestamp, by *"What a run's event stream carries"*
  (2026-08-28), and `WireRun` carries no start time. Widening the event union contradicts that landed
  entry and owes a decision before a line of code; carrying a start time on `WireRun` does not, and is
  the cheaper shape. **Measure both before choosing.**
- **The per-vendor cost ticker** crosses only inside a `done` event's free-text message, composed by
  `formatCost` (`steps.ts:127–133`, `:353`) as `cost=$0.123` or
  `cost=n/a (<n> tokens, vendor reports no price)`. **This is Q-0129's problem on a second field** — a
  structured value that exists only inside a sentence written for a human — and the two should be
  answered once. A regex over that sentence is refused by Q-0015's ground rule 2.
  There is a **second, independent bar**: `apps/web/test/source.test.ts` forbids `tokensByVendor`,
  `vendorTokenTotal`, `input_tokens`, `output_tokens` and `cached_input_tokens` in any file under
  `src`, and forbids the phrase *cost to date*, each half with its own discriminating fixture. Any
  token count on this screen moves that guard, and the guard's reasoning — *"Codex cost is reported
  as tokens, never priced locally"* (2026-08-22) and *never one blended number* — is what the new
  rendering must satisfy, not route around.

It also revisits **Q-0015 AC-9's bound** with the datum that ticket's verification produced: the
observed event count and peak concurrent column count of a real run. Revisit the figure only with
that evidence; do not adjust it on an impression.

---

---

*Sequencing ruled 2026-09-17, recorded here so the pairing instruction above does not drift into
prose nobody acts on: **Q-0129 runs first.** Both tickets need one ruling — how a structured value the
engine already holds reaches a browser — and Q-0129 carries the harder instance (verdict, findings
and summary, plus an artifact behind Q-0127 erratum E-1). This ticket then applies that ruling to
`cost` and keeps its two independent fields, the run number and elapsed, which no other ticket
touches. **Do not re-derive this ticket's figures from its body either**; Q-0129's were all stale
within a day when checked.*
