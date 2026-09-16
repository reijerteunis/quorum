---
id: Q-0127
title: The ticket page renders a ticket's folder
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0127/integration
priority: p2
created: 2026-09-16
iterations:
  chore.review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-16T11:48:54.347Z
    cost: 12.038
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-16T13:07:59.533Z
    cost: 0
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-16T14:30:47.213Z
    cost: 96.631
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

## Three findings inherited from Q-0017, verified against the merged tree

Found by a hand pass over the six files Q-0017's review diff could not carry — the cap truncated
that diff on every one of its three rounds, and the hidden set grew 6 → 8 → 9 as the branch did.
**No review round raised any of them**, and all three reviews claimed to have inspected those files.
They land here rather than by hand at Q-0017's close because this ticket already opens `read.ts`
and `wire.ts`, and a change reviewed with its neighbours is worth more than three isolated commits.

**Severity is stated honestly, including where the first pass overstated it.** These were carried to
the gate as three defects; re-measured against the merged tree, one is a documented design decision
with no live instance, and it is written here as the question it actually is.

1. **`packages/server/src/read.ts:68` — an all-unpriced history sums to `0`, not `null`.**
   `billedCostOf` returns `null` for absent or empty history, which is right and deliberate. Its own
   JSDoc then rules the null-entry case: *"A `null` entry cost is summed as zero, exactly as the
   board does"*, disclosed by the cost legend and citing *"Codex cost is reported as tokens, never
   priced locally"* (2026-08-22). So a ticket whose history exists and is **entirely** unpriced
   renders `$0.00` — indistinguishable from one that genuinely cost nothing.
   **Measured: zero such tickets exist in this backlog today**, so it is latent rather than live, and
   reachable in principle by a ticket every run of which was codex-only. The question is not whether
   the code matches its comment — it does — but whether the legend is sufficient disclosure for the
   all-unpriced case, against `04-architecture.md:200`'s rule on fabricated values and the
   `n/a`-never-`0` discipline the same file applies to every other measure on this transport.
   **Decide it; do not assume the first pass was right that it is a defect.** If the answer is that
   the legend suffices, say so in the JSDoc and add the case to a test, because the next reader will
   ask again.

2. **`packages/shared/src/wire.ts:157,164` — two commit counts that may be negative.**
   `not-contained.ahead` and `unpushed.ahead` are `z.number().int()` with no `.nonnegative()`, while
   `count` (`:50`) and `pendingGates` (`:126`) in the same file both carry it. A commit count cannot
   be negative, and the schema is the only thing standing between a wrong `rev-list` reading and a
   rendered figure. Two characters each; the value is the consistency, since a reader comparing the
   four fields today learns the wrong rule about which counts are constrained.

3. **`packages/shared/src/docs.test.ts:1702` — a test that does not do what it is named for.**
   The case is titled *"so they cannot drift apart"* and its comment says the two strings are
   *"held against each other rather than each against a paraphrase"*. They are not: each is matched
   independently against `/same-origin/i`, `/absolute URL/i` and `/font host/i`, and the two are
   never compared. The three needles do stop them drifting on those axes, so the test is not
   vacuous — what is false is the comment's account of the mechanism, which is the class this
   repository records most often. Either compare the two, or correct the comment to claim the weaker
   property it actually enforces. **Do not delete the needles**: they are the anti-vacuity half.

### What produced them, and the successor it argues for

`repo.max_diff_bytes` defaults to 200,000 and truncates **head-only**. Since Q-0116 the engine warns
and names the omitted files, which is how the six were identified at all — that fix is what made this
pass possible. What it does not do is give the reviewer the bytes. Across Q-0017's three rounds the
reviewer was handed 77–84% of the change and reported no findings in the remainder three times.
**A ticket for the cap itself is owed and is not this one**, which must not grow a second subject.

## Re-measured against the merged tree, 2026-09-16, before the run

Every figure below was taken again after Q-0017 merged. **Do not re-derive from the sections above
where the two disagree** — that is this repository's most-recorded failure, and it is why this
section exists rather than the numbers being quietly edited in place.

**Confirmed.** Twelve production routes, and `GET /tickets/:id` is genuinely absent — `http.ts` five,
`read.ts` five, `serve.ts` one, `static.ts` one. Largest ticket folder **Q-0083 at 3,108,985 B
(3.11 MB) across just 6 files**; largest single file **1,460,837 B (1.46 MB)**, with a 1.4 MB
sibling; **61 files** in `Q-0120`. `Backlog.readFiles` is on the barrel and Q-0059 confines it.

**Corrected.** The backlog is **23,094,468 B (23.1 MB) across 1,266 files and 107 tickets**, not the
"25 MB" and 105 above — two tickets were added at Q-0017's close.

**The `hostile` fixture trap is live, and it caught this operator a second time.** The first
enumeration run for this section used `grep -rhoE … packages/server/src/*.ts | grep -v test`, which
reports `/runs/:id/cost` and `DELETE /runs/:id` as real: **`-h` suppresses filenames, so `grep -v
test` filters nothing**. Exclude test files **by filename** — the count is twelve only then. The
correction recorded above was right; the method that first found it wrong is the method to avoid.

### The `.harness/` exposure, measured rather than estimated

**69 ticket folders contain a `.harness/` directory: 267 files, 833,401 B, and git tracks zero of
them** (`.gitignore:3`). They hold engine scenario-verdict JSON —
`.harness/run-3/scenario-review-verdict-iter-2.json` and siblings — which is run state rather than
any part of the ticket's record. The body above said 259; it grows with every run, so **no criterion
may depend on the count**.

**It is reachable by the obvious pattern, which is what makes it a design question rather than a
note.** `readFiles`'s pattern syntax treats a trailing `/` as *walk that subtree*
(`backlog.ts:277`), so the natural "serve the folder" call walks `.harness/` with everything else.
Confinement does not help here: these files **are** inside the ticket folder, so Q-0059's guard
correctly permits them. The ruling wanted is about what the route *chooses* to serve, not about what
it is *allowed* to reach — and those are different questions that read the same on a first pass.

### The binary hazard is latent, not live — and the first measurement of it was wrong

**Exactly one non-UTF-8 file exists under `backlog/`: `backlog/.DS_Store`, and it is outside every
ticket folder**, so no per-ticket route reaches it today.

An earlier pass reported **three**, including two `.md` files inside ticket folders. That was an
artifact of the method: it decoded a **4096-byte prefix**, which cuts a multi-byte character
mid-sequence — the precise hazard `trimIncompleteUtf8Suffix` exists for, reproduced by the
measurement taken to find hazards. Both files decode clean in full. **Scan whole files.**

It stays worth designing for, because the failure is silent rather than loud: `readFileSync(p,
'utf8')` substitutes U+FFFD and does **not** throw, so a `.DS_Store` appearing inside a ticket folder
— which macOS creates unbidden — corrupts a response instead of refusing it. A route that serves
bytes it cannot characterise should say so, on the same principle as every other closed state here.
