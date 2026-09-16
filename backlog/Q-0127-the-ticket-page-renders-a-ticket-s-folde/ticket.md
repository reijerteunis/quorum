---
id: Q-0127
title: The ticket page renders a ticket's folder
stage: draft
owner: ruud
repos: []
branch: harness/Q-0127/integration
priority: p2
created: 2026-09-16
iterations: {}
history: []
---
GET /tickets/:id serves one ticket's folder and apps/web renders it as tabs with runs.log down the side. Split from Q-0017 at its requirements gate: the board is a screen over endpoints that exist, this is a new route plus a screen, with its own confinement surface and a payload design forced by a measured 3.0 MB largest folder.

Opened **2026-09-16 at Q-0017's requirements gate**, which ruled OQ-1 two tickets rather than one.
The body below is that document's **Appendix A, transcribed in full** rather than referenced —
Q-0110, Q-0111 and Q-0112 each lived only inside a closed ticket's prose and each had to be
rediscovered before it could be worked.

**Why it is second rather than first.** Q-0017 builds the fetch module, the request-state vocabulary
and the shared wire schemas as part of the board; this inherits all three. Split the other way round
and they would be built twice. **And not three tickets**: separating `GET /tickets/:id` from the
screen that consumes it leaves a route with no consumer to prove it against.

**One correction it inherits.** Q-0017's body said `GET /runs/:id/cost` answers cost per run. **That
route does not exist** — the daemon registers twelve, and the string occurs once in the package
inside `package.test.ts:726`'s fixture named `hostile`, written to prove the route-deriving guard
collects a route it has never seen. An enumeration that grepped `src/*.ts` including tests read that
counter-example as production. `docs/06-development-plan.md:3790` carried the same error and is
corrected; do not re-derive from either.


*Transcribed so that, if OQ-1's recommendation is taken, the successor is opened at this gate from a
written body rather than from a plan line. If the gate keeps one ticket, this promotes to AC-16
onward by erratum.*

### Q-0127 — The ticket page renders a ticket's folder

`apps/web` declares `/backlog/:ticketId` and renders a placeholder. **The daemon has no route that
answers for one ticket**: `GET /tickets` lists frontmatter and `packages/server/src/read.ts` contains
no folder read at all. `core` can already do it — `Backlog.readFiles(ticket, pattern)`
(`packages/core/src/backlog/backlog.ts:266`) is on the barrel, and Q-0059 confined it to the ticket's
own folder, refusing a traversing pattern rather than answering `[]`. **The primitive exists and the
route does not.** Runs after Q-0017, whose fetch module, request-state vocabulary and shared wire
schemas it inherits rather than building a second time.

### What is already measured, 2026-09-16

**The payload is unbounded and large.** `readFiles` returns `fs.readFileSync(file, 'utf8')` for every
match, with no cap. Largest ticket folder **3.0 MB** (`Q-0083`); largest single file **1.46 MB**
(`Q-0083/review/hand-review-3.txt`) with a 1.40 MB sibling; 61 files in a modern folder (`Q-0120`);
25 MB of backlog. A route answering "the folder" builds a 3 MB JSON body and hands a browser 1.4 MB
of text for one tab. **That is Q-0076's subject on the backlog**, and it is why the first design
question is the route's shape rather than the screen's.

**The folder is run-scoped and iteration-scoped, and the brief predates that.**
`docs/05-design-prompt.md:27` was written 2026-08-22; Q-0086 to Q-0089 then made every artifact path
carry `{run}` and, inside a bounded loop, `{iter}`. A real folder holds
`requirements/run-1/candidate-claude.md`, `dev/chore/run-2/implement-iter-1.md`,
`review/chore/run-2/chore-iter-2.md`. *"Review — rounds as columns"* is **two levels**, and a flow
can run more than once on one ticket.

**There is a hidden `.harness/` directory in 68 ticket folders, holding 259 files, and it is
untracked.** It carries the engine's verdict files (Q-0089); `backlog/.gitignore` re-includes
`runs.log` and nothing else. `readFiles`'s subtree walk includes dotfiles. Under *files are the
database*, rendering a file the database does not contain is a decision.

**The tabs are not uniformly present.** Across 105 tickets: 105 `ticket.md`, 90 `runs.log`, 70
`review`, 70 `requirements`, 64 `dev`, **5 `solution`, 5 `qa`**. A Solution tab exists for one ticket
in twenty-one. `readFiles` answers `[]` for a legitimately absent directory, so absent and empty are
already distinguishable and must stay so.

**Nothing under `backlog/` is binary today** — 871 `.md`, 256 `.json`, 90 `.log`, 19 `.txt`, 8
`.yaml` — but `readFiles` decodes every match as UTF-8 unconditionally, so a `.png` would be lossily
rendered rather than refused. Latent, not absent.

**A damaged `ticket.md` is already served as a ticket with no fields.** `parseFrontmatter` falls open
to `{ meta: {}, body: text }` and `read()` casts. The ticket page is where that stops being a missing
row and becomes a whole page of nothing.

### What it must decide

1. **The route's shape, forced by the 3 MB measurement.** A manifest of paths and sizes plus a second
   route reading one file is the shape that does not put an unbounded body on a wire; one route
   returning everything is the shape that does. Measure before choosing, and if a cap is taken it
   must be **named where a reader sees it** — Q-0124's lesson, where four tickets were reviewed
   against a cut diff and only `runs.log` said so.
2. **Whether `.harness/` is rendered, hidden, or named-but-not-read.** Engine state, untracked, and
   inside the folder the page's own sentence promises to show.
3. **The tab model against the real layout**, including a flow that ran more than once, and absent
   versus empty for the five-in-105 tabs.
4. **What the page renders for a ticket whose `ticket.md` did not parse** — and note that the two
   surfaces must differ deliberately: Q-0017 AC-8 requires the **listing** to name a damaged ticket,
   while the **detail** route should refuse it. Codex's shape is the one to take — verify that
   `ticket.md` produced a non-empty string `id`, `title`, `stage` and `owner` and that its id equals
   the requested one, else 422 with a stable `malformed-ticket` code naming the file. **This surfaces
   Q-0060 at the HTTP boundary and does not change the shared parser**, which stays that ticket's.
5. **404 against 422 against a confinement refusal.** `GET /history/:id` already separates *no run
   under that token* from *a manifest that would not parse* (`read.ts:145–152`); a ticket page needs
   the same two plus the refusal `dirOf` raises for a token that is not one name.
6. **Untrusted content.** Artifact text is repository-controlled. Escaped preformatted text is the
   safe baseline; a Markdown renderer needs a sanitiser and a dependency justification, which is a
   separate decision.

### Non-goals for the successor

The board (Q-0017), fixing Q-0060, mission control, the gate screen, run-history drill-down, parsing
`runs.log` into links, editing anything in a ticket folder, and any write of any kind.
