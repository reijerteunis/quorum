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

**Added 2026-08-27: the same question asked of a second parser, from the opposite side.** Found by
Q-0048's requirements run, preserved by its implement step per the same charter clause, and routed
here at Q-0048's chore gate because the *decision* is shared even though the code is not.

**The second defect.** `loadTasks` (`spike/src/fanout.js:15`, and `packages/core/src/fanout/fanout.ts`
once Q-0048 lands) reads

    YAML.parse(fs.readFileSync(f, 'utf8')).tasks ?? []

and `YAML.parse('')` returns `null`, so `null.tasks` throws
`TypeError: Cannot read properties of null (reading 'tasks')`. The CLI's `catch`
(`spike/bin/harness.js:605`) renders a sentence for a `FlowError` or an `IntegrationError` and
**rethrows anything else**, so an empty `solution/tasks.yaml` gives the user a Node stack trace
instead of the name of the file that is wrong.

**Measured, and the discrimination is the useful part.** Only the *empty* file crashes:

| `solution/tasks.yaml` | `YAML.parse` | `loadTasks` |
| --- | --- | --- |
| empty | `null` | **`TypeError`** |
| `tasks:` with no value | `{"tasks": null}` | `[]` |
| unrelated keys | `{"foo": 1}` | `[]` |

So a file that is merely *wrong* is handled, and a file that is *empty* — the state a half-finished
edit, a failed write or a `touch` leaves behind — is the one that crashes.

**Why it belongs in this ticket, and what makes the pairing more than filing convenience.** It is
the same class in the opposite polarity, which is exactly why the two must be answered together.
This ticket's defect fails **open**: a damaged file reads as a valid object with no fields, and
nothing says so. The new one fails **closed but illegibly**: a damaged file stops the run, correctly,
and withholds the one thing the reader needs. The rules name both halves — *"Never default silently"*
(`.claude/rules/engineering.md`) for the first, and M1's closing entry named the second as a standing
shape, *"a failure that withholds the one thing the reader needs"*, listing `exited 1:` with nothing
after it among its instances. **A product that answers these two differently has no policy, it has
two accidents.** What Quorum does when a file it reads is empty or damaged should be one decision,
and this is the ticket that takes it.

**What differs, and why the second half is the easy one.** Different module, different parser,
different file — and, importantly, none of this ticket's central constraint. `parseFrontmatter` is
hard because it is generic: it also reads `harness/roles/*.md` (`spike/src/engine.js:727–732`), a
role file with no frontmatter is legal, and Q-0043's AC-4 refuses the schema-on-read fix outright.
`loadTasks` has no such twin — it reads exactly one kind of file for exactly one caller — so its
half is very likely one line: throw an `IntegrationError` naming the path, which the CLI already
knows how to render, and which `loadTasks` already throws twice for its other two failure routes
(`:18`, `:20`). Doing it *alongside* the frontmatter decision is what stops the two from diverging;
doing it first, alone, is what would.

**Landing constraint, which this ticket did not have before.** Once Q-0048 lands, `loadTasks` exists
in `spike/src/fanout.js` **and** `packages/core/src/fanout/fanout.ts`, so that half must land in both
trees together — the Q-0066/Q-0068 shape — or the port loses the independent witness the freeze
exists to provide. `spike/src` is frozen for Q-0009's fifteen children and this ticket is not among
them, which is the same route Q-0063 took. The frontmatter half is unaffected: Q-0043 already landed
`packages/core/src/backlog/backlog.ts`, and the spike copy is the same both-trees question.

**The title now under-describes the ticket.** It says `ticket.md`; the subject is now *what Quorum
does when a file it reads is empty or damaged*, across two parsers. Worth renaming when this reaches
requirements rather than leaving a body that outgrew its title.

**Scope.** `spike/src` is frozen (`harness/port-charter.md` §3); this lands against
`packages/core/src/backlog.ts`, on `main` as of Q-0043, whose 51 tests across `backlog.test.ts` and
`backlog.source.test.ts` are the regression net. The byte-fidelity criterion (AC-3, all 30
`ticket.md` files round-tripping unchanged) must stay green — this ticket adds a refusal, it does
not touch the writer. Belongs to M2 in `docs/06-development-plan.md`.
