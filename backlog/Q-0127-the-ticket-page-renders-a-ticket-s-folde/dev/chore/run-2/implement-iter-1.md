Implement report — Q-0127, chore run 2, iteration 1
===================================================

`GET /tickets/:id` and `GET /tickets/:id/file` serve one ticket's folder, and `apps/web` renders it
as tabs with `runs.log` down the side. Fourteen criteria, all implemented; the four errata were read
first and all three ratifications (E-1 `.harness/` excluded with no decision entry, E-2 no term
coined and `manifest` refused, E-3 the whole-file fatal decode) are followed as written, and E-4's
void premise is not relied on anywhere.

**Verdict: proceed.** Nothing here needed a `docs/decisions/` entry, a file outside my paths, or
behaviour a landed decision preserves.


What was verified, and how
--------------------------

Forced in this worktree, which has neither `.harness/worktrees` nor `.quorum/runs`:

- `pnpm install --frozen-lockfile` → *Already up to date*, 197 ms.
- `pnpm turbo run test typecheck lint --force --continue` → **21 successful, 21 total, 0 cached.**
- `pnpm turbo run build --force` → 5 emitters, green.
- `pnpm exec quorum lint` → 6/6.
- `pnpm sweep:git-identity` → *the workspace suite executed and green with no resolvable git identity*.

**And by hand, over a real socket against this repository's own backlog**, through a throwaway
`createDaemon` on port 0 rather than from a report. That file was deleted after it ran; its output:

```
STATUS 200  TITLE The ticket page renders a ticket's folder
FILES  [{"rel":"requirements/errata.md","bytes":5987},{"rel":"requirements/merged.md","bytes":42445},
        {"rel":"requirements/run-1/candidate-claude.md","bytes":36702}, … ,"runs.log":542,"ticket.md":14721]
FILE   200 requirements/errata.md 5987 "# Errata — Q-0127\n\nThis file wins over `requirements/merged."
HIDDEN        400 not-a-file-path   ".harness/run-1/x.json" is not a file this ticket holds
TRAVERSAL     400 not-a-file-path   "../../etc/passwd" is not a file this ticket holds
ABSENT TICKET 404 no-such-ticket    no ticket under "Q-9999"
BAD TOKEN     400 not-a-ticket-token "a/b" is not a ticket token: a ticket is one folder …
PAYLOAD Q-0083 listing-bytes    642  files  6  folder-bytes 3108985
PAYLOAD Q-0120 listing-bytes   3108  files 49  folder-bytes 1005369
PAYLOAD Q-0017 listing-bytes   1163  files 15  folder-bytes  306362
```

**That last block is the design's whole argument, measured rather than argued.** §0.2 predicted the
largest folder would answer a listing of about 2.8 kB; the real answer for `Q-0083` is **642 bytes
against 3,108,985** — a 4,800× difference, because that folder is six enormous files rather than
many small ones. No cap exists anywhere, and that is deliberate: nothing large is fetched until a
reader names the file with its size in front of them.


File by file
------------

### `packages/core/src/backlog/backlog.ts` (+118)

Two exported functions **beside `readFiles`** (§6's ruling on where they live), plus three types.

- `listTicketFiles(root, ticket)` → `{ files: {rel, bytes}[], excluded: {count, bytes} }`. Walks the
  folder, confines every enumerated leaf through `pathInside` exactly as `readFiles` does, stats each
  name and **opens none**. Sorted by `rel`, so the answer is the folder's contents and not a
  `readdir` order. A path whose **first segment begins with a dot** is counted and never named —
  E-1's ruling, in the function's own JSDoc as one line naming the condition, never a transcription.
- `readTicketFileBytes(root, ticket, rel)` → `Buffer | null`. Confined through the existing
  `fileInside`; opens once and **`fstat`s the descriptor it will read from**, so what is measured is
  what is served — Q-0122's static-route shape, for the same reason. `null` for the two answers
  *nothing is there* actually is (`ENOENT`, `ENOTDIR`) and for a name that is not a regular file;
  every other failure propagates, because a file this process may not open is not a file that is not
  there.

Functions rather than methods because AC-2 requires both **on the barrel**, which a method is not
on; they take `(root, ticket)` because `folderOf(root, ticket)` and `fileInside(root, ticket, rel)`
are already this module's internal shape, so this is the public form of what was there.

### `packages/core/src/index.ts` (+24 −6)

`listTicketFiles`, `readTicketFileBytes`, `isOneName` as values; `TicketFile`, `TicketFileEntry`,
`TicketFolderListing` as types. The barrel's own counts re-derived rather than incremented:
**thirty-one → thirty-four**, twenty-six → twenty-nine domain helpers. All three values are
`pathInside`'s case rather than `openUrl`'s — no command reaches any of them, and the consumer is
`packages/server`.

`isOneName` is the one a **status** depends on: `dirOf` raises a plain `Error` for *not one name* and
another for *no such ticket*, so without the predicate a route would be choosing between 400 and 404
by matching an error's prose.

### `packages/cli/src/frame.source.test.ts` (+15 −4) and `packages/cli/src/package.test.ts` (+19 −5)

`DOMAIN` 26 → 29 and the barrel 31 → 34, each **shown red against the value it replaced** rather than
edited to fit, which is the demonstration every addition since Q-0091 has written. This is a
`packages/cli` register growing for a `packages/server` need, which is what Q-0122 wrote down when
`pathInside` did the same; the cost is stated in place rather than smoothed over.

### `packages/core/src/backlog/backlog.source.test.ts` (+27 −10)

The module-surface register moves from three names to five, and the barrel-contribution register from
four to six. Both are registers of identities by design, so this is the visible act they exist to
force. `parseFrontmatter` and `renderFrontmatter` are still asserted **off** the barrel.

### `packages/core/src/backlog/backlog.test.ts` (+126)

AC-2's behavioural half, six cases:

- **The listing opens nothing** — `fs.readFileSync` spied, a 1 MiB artifact in the folder, and the
  claim scoped to reads *of files in this folder* so it is about this function rather than about the
  process.
- **A file that can be stated and not read** is still named. Its premise is a capability of the
  environment rather than of the commit, so it is **probed** and the case reports a skip where the
  probe fails (running as root, where mode 0 stops nothing) — `git.test.ts`'s ownership case's shape,
  for *"A test's verdict is a property of the commit"* (2026-08-30).
- The dotted-path rule, with **two** dotted directories: under a rule keyed on the name `.harness`,
  `.scratch/notes.md` is named and the count is 1 rather than 2, so both assertions go red on exactly
  that mutation.
- Bytes rather than text, proven on a file holding a lone `0xFF`, which `readFiles` cannot answer.
- Confinement on both, each with a **benign twin** that must still be read.
- An enumerated name resolving outside the folder is **refused rather than skipped**.

### `packages/shared/src/wire.ts` (+101 −4)

`WireTicketFileEntry`, `WireExcludedFiles`, `WireTicketDetail`, `WireTicketFile`, each with a
`.strict()` schema. Named for what they carry; **`manifest` appears nowhere**, per E-2 — that word is
`docs/GLOSSARY.md`'s for a run's manifest and **Occurrence** is defined in terms of it.

AC-14(a): `not-contained.ahead` and `unpushed.ahead` gain `.nonnegative()`, matching `count` and
`pendingGates` in the same file.

### `packages/shared/src/wire.test.ts` (+125)

AC-7 (barrel, live-shaped acceptance, the three distinguishable refusals, byte counts, the nested
ticket being the listing's own shape, and that both are declared here) and AC-14(a) both directions,
with the refusal shown to name the field.

The *"declared nowhere else"* half is asserted **in each consumer over its own corpus** rather than
here: a scan from this package reaching into two others would earn this task two turbo inputs for one
assertion each of those suites can already make.

### `packages/shared/src/docs.test.ts` (+38 −6) — AC-14(c)

The case titled *"so they cannot drift apart"* never compared its two strings; the needles are real,
so it was not vacuous — what was false was its own account of the mechanism. Title and comment
corrected to the weaker property actually enforced, **needles untouched**, and a new case added that
was the missing half: each of the three is shown red against the **real** sentence with that one
phrase removed. Comparing the two sentences for equality is refused with its reason — they are prose
for two audiences, and an equality would fail on a legitimate edit to either.

### `packages/server/src/read.ts` (+267 −29)

Two routes, and one extraction: `ticketRow(ticket, spot)` is now the **single** projection both
`/tickets` and `/tickets/:id` go through, so a board card and a page header cannot report one ticket
two ways.

`ticketFor(project, token)` decides the three token-and-ticket refusals **by predicate**: `isOneName`
before `dirOf`, `dirOf` for existence, `read` for parseability, then the four non-empty string fields
and the id check. No status anywhere depends on a message `core` wrote.

The file route takes `?path=` as a **query value**, refuses the empty/pattern/trailing-slash/absolute
shapes, then refuses anything **this request's own listing** does not hold, then reads through
`core`'s confinement, then decodes whole and fatally.

**The reader's own diagnostic is deliberately not carried into the malformed refusal**, and the
reason is mechanical: `package.test.ts`'s register pins one `.message` receiver per file in this
package, and what a client needs is which file and which field rather than a YAML parser's line and
column. Stated in place.

AC-14(b): `billedCostOf` is **ratified, not changed**, with the consequence now stated explicitly in
its JSDoc rather than left for a reader to compose from the per-entry rule — which is why it reached
the gate as a defect.

### `packages/server/src/read.test.ts` (+347)

AC-1, AC-3, AC-4, AC-5, AC-6 and AC-14(b), driven through `app.request` over real projects. The ones
worth naming:

- The detail's `WireTicket` half asserted **`toStrictEqual`** against the row `/tickets` answers for
  the same ticket.
- No property anywhere in the **serialised** body carries a file's text, so a field added later
  cannot smuggle it back under a name the assertion does not know.
- A file whose **name legitimately contains `*`** is listed and is still refused — the case
  membership alone does not close.
- AC-6's false-positive half: the three real names that hold U+FFFD (`qa/scenario-review.md` and
  Q-0101's two) are each served **by name**. Their *content* is this file's rather than the
  repository's, deliberately — reading `backlog/Q-0006/…` from this suite would put a `backlog/**`
  turbo input on this task and make the verdict depend on files no criterion may pin. Stated in the
  test.
- The chunk-boundary pair at offset 4095: a valid `é` straddling it is served, a truncated lead byte
  at the same offset is refused.

One honest correction to the criteria's own wording: `.`, `..`, `%2E` and `%2E%2E` **cannot reach**
either route, URL parsing resolving single- and double-dot segments away before any router sees them.
That is asserted as what it is, beside a direct assertion that `isOneName` still refuses all of them,
so *not refused here* and *not reachable at all* are not confused for one another.

### `packages/server/src/package.test.ts` (+65 −5)

Route register 12 → **14**, AC-2's source assertion that `read.ts` opens no file (scanned over the
**code** with comments stripped — the module's JSDoc has to name `readFileSync` to say why it calls
none, and this file already removed one clause for firing on a docblock), and AC-7's *this package
declares neither shape*.

### `docs/04-architecture.md` (+28)

One paragraph in §`packages/server`, naming both routes, why they are two, the no-cap ruling, the
leading-dot exclusion, all six refusal codes and the deliberate listing/detail asymmetry about a
damaged ticket. `package.test.ts`'s derivation is what fails if a route is added without a sentence.

### `apps/web` — `daemon-endpoints.ts`, `daemon-client.ts`, `ticket-page.tsx` (new, 352), `routes.ts`, `app.tsx`

`ticketDetailPath` is named for the daemon route rather than the screen, because `routes.ts` already
exports a `ticketPath` and that one is the shell path a card links to — two different things, two
names. Both fetches go through `requestJson` and return a `RequestState`, so all five outcomes render
through the existing vocabulary with **no new exemption** in any source scan.

The page fetches the listing, `ticket.md` and `runs.log` on mount and nothing else; tabs are derived
from top-level segments with `ticket.md` first; files group by their own directory path to full depth.
`runs.log` is deliberately **not** a tab, having the rail. Text renders as escaped preformatted text
and **no dependency was added**.

`ScreenRoute` gains `screenExists`, because the ticket page is the first screen with no rail entry to
say so; `app.tsx` selects both real screens by the register's own exported constants, never a literal.

### `apps/web/test/routes.test.ts` (+40 −11) and `test/source.test.ts` (+67)

Q-0017's AC-14 case asserted the ticket row still said it was *waiting for a route* — a check that
could only fail if this work had been done. Replaced rather than kept, per *"A check outlives its
subject only if it can still fail"*, with the half still about something.

The *no literal list of tab names* scan is **scoped to the component**, and the reason is stated: four
of the six artifact folder names are also STAGE names, which the board's fixtures name legitimately,
so a whole-tree scan would be keyed on a string rather than on the behaviour — the family this
repository records most.

### `packages/core/src/turbo-inputs.test.ts` (+7)

Two `READ_BASES` rows and two `ESCAPING_LITERALS` rows (one of them the self-row, this file being its
own subject). Q-0072's guard refusing an undeclared read on the way in, working as designed — it went
red first and the registrations are what cleared it.


What I deliberately left alone
------------------------------

- **Q-0060.** `parseFrontmatter` is untouched and still falls open; the refusal is at the HTTP
  boundary and reaches nothing else. That parser also reads `harness/roles/*.md`.
- **The listing's damaged-ticket behaviour.** `GET /tickets` still renders one, named by its folder.
  The asymmetry is the point and is asserted in both directions in one test.
- **`dirOf`'s preserved non-deterministic prefix match**, `readFiles`, `quorum board`'s `$0.00`, and
  every byte `packages/cli` prints.
- **Any cap, pagination or truncation**, per non-goal 7.
- The pre-existing `no-control-regex` lint warning in `backlog.ts` — measured as `HEAD`'s, not this
  change's.


Two things the requirement does not cover
-----------------------------------------

Reported rather than decided, which is what my role asks where a requirement leaves a case uncovered.

**1. A dangling symlink inside a ticket folder makes `GET /tickets/:id` answer 500.** Measured
against a throwaway project over a real socket: `500 Internal Server Error`. The cause is correct
behaviour one layer down — `pathInside` refuses a name that stands there and does not resolve, which
is the clause that stops an `O_CREAT` following a link out of the folder, and `listTicketFiles`
refuses rather than skipping because AC-2 puts it on `readFiles`'s confinement, which throws. What is
missing is a **status**: §3's table has six codes and none is *this folder holds a name I cannot
confine*. I did not invent a seventh. Zero symlinks exist under `backlog/` today.

**2. The `no-such-file` 404 arm has no test that can stage it.** Membership is derived from the
listing this same request computed, so a file that has stopped being one has also left the listing and
is refused 400 — which is asserted, with the same path shown answering 200 first. The 404 answers only
the interleaving R-4 names, which no test can stage without interleaving the two. The predicate
underneath is covered in `packages/core`; the mapping from `null` to 404 is the uncovered line.


Notes for the reviewer
----------------------

**This change is 23 files and ~2,214 insertions, which R-2 predicted would be truncated at 200,000
bytes.** `git diff` orders by path, so the tail is `packages/shared/src/wire.ts` and `wire.test.ts` —
**the two files AC-14(a)'s finding is in**, and two of the six Q-0017's own review never saw — with
`packages/server/src/read.ts` and `read.test.ts` immediately before them. If the engine's warning
names files it gave no patch for, those four are the ones to read by hand.

R-1's trim seam was not needed: fourteen criteria landed in one round.
