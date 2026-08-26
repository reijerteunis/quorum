---
id: Q-0060
title: A damaged or CRLF ticket.md reads as a ticket with no fields, silently
stage: draft
owner: ruud
repos: []
branch: harness/Q-0060/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
Found by Q-0043's implement step while porting `spike/src/backlog.js`, reported and not fixed per
*"The port preserves behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Two of its nine reported items —
the silent no-match fallback and the LF requirement — are **one defect seen from two sides**, and
the report says they want one entry between them. This is that entry.

**The defect.** `parseFrontmatter` matches on a regex and falls open when it does not match
(`spike/src/backlog.js:12–13`, now also `packages/core/src/backlog.ts:82–83`):

    const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: text };

A file whose delimiters are absent or damaged returns `{ meta: {}, body: <whole file> }` — no error,
no warning. A `ticket.md` with a mangled opening delimiter therefore reads as **a ticket with no
`id` and no `stage`** rather than as a broken file, and the board renders it, a flow's `consumes`
check sees `undefined`, and a write path will then emit a frontmatter block built from nothing.

**The regex is anchored on `\n`**, so a `ticket.md` saved with CRLF never matches and takes exactly
that path. No file in this repository is CRLF today; a contributor on Windows produces one without
trying, and the symptom they see is not "your file is broken" but a ticket that has quietly lost
every field. That is the cold-clone failure mode: the first thing a new contributor does is the
thing that breaks, and nothing says so.

**It contradicts a rule we have already written down.** `harness/rules.md` and
`.claude/rules/engineering.md`: *"Errors are explicit: invalid structured output saves the raw text
next to the ticket and stops the run with a clear message. Never default silently."* This is the
same failure the product refuses everywhere else — and it sits under the module the product calls
its database.

**The constraint that makes this non-trivial, and the reason it is not a one-line fix.**
`parseFrontmatter` is **not a ticket-specific function**. It also reads `harness/roles/*.md` at
`spike/src/engine.js:727–732` (`loadRole`), and Q-0043's AC-2 requires it to stay generic. So:

- Throwing on a no-match changes role-file reading too, and a role file with no frontmatter is
  currently legal.
- The `{ meta: {}, body: text }` return may be load-bearing for some caller that wants a
  frontmatter-less document. Establishing whether any caller relies on it is the first task.
- The fix that suggests itself — validate with `ticketSchema` on read — is **explicitly refused** by
  Q-0043's AC-4 and OQ-2, on the mechanical grounds that `ticketSchema.passthrough().parse()`
  returns a reordered object and so reformats every ticket it touches. Whatever this ticket does, it
  must not be that.

**Two shapes worth costing.** (a) Distinguish *"no frontmatter at all"* — legal, keep the fallback —
from *"a delimiter that looks like an attempt and failed"*, and throw only on the second; normalise
CRLF while matching so a Windows file takes the legal path rather than the broken one. (b) Keep
`parseFrontmatter` exactly as it is and put the check in `Backlog.read`, which knows it is reading a
ticket and can require `id` and `stage`, leaving `loadRole` untouched. (b) is the smaller blast
radius and the more likely answer.

**Scope.** `spike/src` is frozen (`harness/port-charter.md` §3); this lands against
`packages/core/src/backlog.ts`, on `main` as of Q-0043, whose 51 tests across `backlog.test.ts` and
`backlog.source.test.ts` are the regression net. The byte-fidelity criterion (AC-3, all 30
`ticket.md` files round-tripping unchanged) must stay green — this ticket adds a refusal, it does
not touch the writer. Belongs to M2 in `docs/06-development-plan.md`.
