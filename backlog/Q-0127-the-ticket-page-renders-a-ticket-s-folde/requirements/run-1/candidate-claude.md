# Q-0127 — The ticket page renders a ticket's folder

*Requirements, run 1, candidate (claude). Every figure below was measured against the merged tree on
2026-09-16, after Q-0017 landed. Where a figure disagrees with the ticket body, this document is the
later measurement and says so in place.*

---

## 0. What was measured, and what it changed

The ticket body asks for measurement before choosing, in six places. Five of the six choices were
decided by a measurement rather than by taste, and four of those measurements found something no
earlier account of this ticket had.

### 0.1 The payload, which decides the route's shape

Measured over all 107 ticket folders, encoding each folder's visible files (everything except
`.harness/`) as the obvious `{files:[{rel,text}]}` body, against a listing of `{files:[{rel,bytes}]}`:

| | whole folder as JSON | listing as JSON |
| --- | --- | --- |
| largest | **3,157,849 B** | **2,847 B** |
| median | **133,940 B** | **502 B** |
| p90 | 330,924 B | — |
| over 200 KB | **38 of 107** | 0 |
| over 1 MB | 5 of 107 | 0 |

Three orders of magnitude at the median and 1,100× at the worst case. The largest folder, `Q-0083`,
is **3,108,985 B across six files**, of which one is **1,460,837 B** and its sibling **1,395,274 B**.

**The mount cost of the two-route shape was measured too**, because that is the number the design
actually turns on. A page that loads the listing, `ticket.md` and `runs.log` and no artifact text
costs the median ticket **~9 KB** and the worst **~50 KB**:

- `runs.log` — present on 91 of 107, median **2,233 B**, p90 5,817 B, max **14,962 B**
- `ticket.md` — present on 107 of 107, median **6,446 B**, p90 13,554 B, max **32,206 B**

That is the whole argument for §2's shape, and it is why no cap is specified anywhere in this
document: nothing large is ever fetched unless a reader asks for that file by name, with its size in
front of them.

### 0.2 `.harness/` — and the discriminator nobody had

**69 ticket folders hold a `.harness/` directory: 267 files, 833,401 B, and git tracks zero of
them.** The body said 259 files; it grows with every run, so **no criterion here depends on the
count**.

What is new: **every single one of the 264 `.json` files under `backlog/` is inside `.harness/`.**
The visible record is entirely markdown, logs, text and YAML — 885 `.md`, 91 `.log`, 16 `.txt`,
8 `.yaml`, and **zero** `.json`. So the hidden directory is not merely untracked, it is the only
place a different *kind* of file lives, and what it holds is the engine's own scenario-verdict state
(`.harness/run-3/scenario-review-verdict-iter-2.json`).

The body is right that confinement does not help here — these files *are* inside the ticket folder,
so Q-0059's guard correctly permits them, and `readFiles`'s subtree walk (`backlog.ts:422`) returns
dotfiles like any other. The ruling wanted is about what the route **chooses** to serve.

### 0.3 The tab model — the fixed list is already wrong

Top-level entries across all 107 ticket folders:

| entry | tickets |
| --- | --- |
| `ticket.md` | 107 |
| `runs.log` | 91 |
| `review` | 71 |
| `requirements` | 70 |
| `.harness` | 69 |
| `dev` | 65 |
| `solution` | 5 |
| `qa` | 5 |
| **`adapter-probe.md`** | **1** |

`backlog/Q-0001-run-requirements-flow-on-a-real-repo/adapter-probe.md` is a seventh top-level entry,
and **a tab list built from the design brief's six names hides it silently**. That one file is the
whole argument for deriving tabs from what is on disk.

Nesting is up to **four levels** — 199 files at depth 1, 376 at 2, 189 at 3, 236 at 4 — with real
paths like `dev/development/run-4/green-report-iter-1.md`, `qa/run-3/scenario-review-iter-2.md` and
`requirements/archive/run-1-aborted/…`. The brief's *"Review — rounds as columns"* is two levels and
was written on 2026-08-22, before Q-0086 to Q-0089 scoped every artifact by `{run}` and `{iter}`.

### 0.4 The binary hazard — and why the obvious detector is refused

Scanning **whole files** (the body is right that a prefix decode invents failures): exactly one
non-UTF-8 file exists under `backlog/`, `backlog/.DS_Store`, and it sits **outside every ticket
folder**. Latent, not live.

**The measurement that decides the instrument: three files already contain U+FFFD legitimately** —
`Q-0006/qa/scenario-review.md`, `Q-0101/requirements/merged.md` and
`Q-0101/requirements/run-1/merged-iter-1.md`. So the obvious test — *does the decoded text contain a
replacement character* — would report three valid, hand-written markdown files as binary on the day
it shipped. It is refused for that reason and not on taste. §2.5 specifies the one test that has no
false positives.

### 0.5 Two things about `core` that change the work

**`isOneName` is not on `@quorum/core`'s barrel.** `packages/core/src/index.ts:95` exports
`pathInside` from `confine.js` and nothing else from that module. `Backlog.dirOf` throws a plain
`Error` for both *this token is not one name* and *ticket not found*, with different messages — so a
route that did not have the predicate would have to **decide an HTTP status by matching an error
message**, which is the shape this repository refuses everywhere else. One line on the barrel
removes it.

**`TicketFile` is not on the barrel either** (`index.ts:94` exports `TicketRecord` alone), so
`readFiles`'s return type is not nameable from `packages/server`.

**And there is no listing primitive.** `readFiles` always reads: it returns
`{rel, text: fs.readFileSync(file,'utf8')}` for every match. A listing route built on `readFiles`
alone would read 3.1 MB to report 298 bytes. §2.1 says what to do instead.

### 0.6 What `readFiles` already gives the file route for free

`readFiles(ticket, 'dev/chore/run-2/implement-iter-1.md')` works: the pattern's directory part is
confined by `pathInside`, its basename becomes an anchored regex, and the result is that one file.
**So the per-file route needs no new `core` primitive and inherits Q-0059's confinement unchanged.**

Two sharp edges come with it, both closed by AC-5: `*` in a pattern is a **wildcard**, and a pattern
ending in `/` **walks a subtree**. Both are client-supplied here.

### 0.7 Confirmed without change

Twelve production routes, `GET /tickets/:id` genuinely absent — `http.ts` five, `read.ts` five,
`serve.ts` one, `static.ts` one, enumerated by excluding test files **by filename** (the body's
warning about `grep -h` is correct and was obeyed). `Backlog.readFiles` is on the barrel.
`apps/web/src/routes.ts:84` already declares `/backlog/:ticketId` and its register row already names
this ticket.

**Drift worth one line**: the backlog is now 1,269 files and 23,104,893 B across 107 tickets against
the body's 1,266 / 23,094,468 / 107, and `review` is 71 folders against 70. Two tickets and their
run logs arrived since. No criterion depends on any of these.

---

## 1. Problem

**The maintainer can see the backlog and cannot open a ticket.** Q-0017 shipped the board: ten
columns, cards carrying id, title, owner, containment and cost, each card a link to
`/backlog/:ticketId`. Clicking one reaches a placeholder that says, accurately, that the screen does
not exist and that *"it needs a route that answers for one ticket, which the daemon does not have
yet"*.

That sentence is the whole problem. The daemon registers twelve routes and none of them answers for
one ticket: `GET /tickets` lists frontmatter for all of them, and `packages/server/src/read.ts`
contains no folder read at all. `core` can already do it — `Backlog.readFiles` is on the barrel and
Q-0059 confined it — so **the primitive exists and the route does not**.

What the maintainer loses is the record itself. A ticket's folder is where this product keeps its
evidence: the two candidate requirements and the merged one, the errata that ruled a criterion, the
per-round review reports, the implement reports, the run log that says what each run cost and how it
ended. Today all of that is reachable only from a shell in the repository, which is the thing a local
web app exists to stop being the only answer.

---

## 2. What to build, and why each shape rather than its alternative

### 2.1 Two routes, because one would put 3 MB on a wire

`GET /tickets/:id` answers **frontmatter plus a file listing, and no file text at all**.
`GET /tickets/:id/file?path=<rel>` answers **one file's text**.

§0.1 is the argument: one route returning everything costs 3,157,849 B at worst and 133,940 B at the
median, and is over 200 KB for **38 of 107 tickets** — which means the expensive case is ordinary
rather than exceptional. The listing costs 2,847 B at worst and 502 B at the median.

**The listing must not be built by reading.** `readFiles` decodes every match (§0.5), so the route
walks the folder and stats it. Two ways to get there, and the requirement takes the first:

- **Recommended** — a new `core` function beside `readFiles`, on the same confinement, returning
  `{rel, bytes}` and reading no file. One barrel entry, and the natural home for the `.harness`
  exclusion rule so a second caller cannot get a second answer.
- **Refused** — the route reads and discards. It works and it is honest, and it costs 3.1 MB of I/O
  and a full UTF-8 decode to answer 298 bytes, on the route a page load hits.

**The frontmatter half reuses `WireTicket` unchanged**, the same shape `GET /tickets` already
answers, including its `containment` and `billedCostUsd`. Re-deriving the header's fields here would
be a second projection of one ticket, free to disagree with the card the reader just clicked — which
is the failure a board exists to prevent, one surface along. **Push lag is deliberately absent**: it
is one repository-level fact, the board is where it is rendered, and carrying it here would be a
second place it is claimed.

**The file route takes a query parameter rather than a path segment.** A relative path contains `/`
— `dev/chore/run-2/implement-iter-1.md` is four segments — so a path segment needs the client to
encode them and the route to decode them, and an over-encoded segment run through
`decodeURIComponent` is precisely where a confinement bypass hides. A query parameter is handed to
`core` verbatim and confinement stays `core`'s. The registered literal is
`GET /tickets/:id/file`, which `package.test.ts`'s route derivation reads.

### 2.2 `.harness/` is excluded, and the exclusion is said out loud

Three shapes were available and the third is taken.

- **Rendered.** It puts 833 KB of engine state, untracked by git, inside a page whose subject is the
  ticket's record. `.harness/` is not in the database — `backlog/.gitignore` re-includes `runs.log`
  and nothing else — so *"files are the database"* argues against serving it rather than for it.
- **Hidden silently.** The page's own sentence promises the ticket's folder, and showing 6 of 273
  files without saying so is the failure Q-0128 was opened on, one surface along.
- **Excluded and disclosed.** Taken.

The listing carries the count and total bytes of what it left out, and the page renders one line
naming them as the engine's own run state. **The paths are not listed**: enough to say the page is
not showing everything and how much, not enough to be a directory listing of engine internals, which
would be a second run-history surface and is Q-0018's.

**The rule is structural, not a name list**: any path whose first segment begins with `.` is
excluded. A second hidden directory is then excluded the day it appears, and counted, without anyone
remembering. §0.2's discriminator is the corroboration rather than the rule — the excluded set is
also the only place a `.json` lives.

### 2.3 Tabs are derived, because a fixed list is already wrong

§0.3: `adapter-probe.md` is a seventh top-level entry today, so the design brief's six names lose a
file on the day they are written down.

Every top-level entry the listing holds is a tab: each directory becomes one, `ticket.md` becomes
one, and any other top-level file becomes one. `runs.log` is lifted out and rendered down the side,
which is what the brief asks for. **Absent and empty stay distinguishable and need no special
case**: a ticket with no `solution/` has no Solution tab, because nothing produced one — which is
the right answer for the 102 tickets in 107 that have none.

Within a tab, files render grouped by their directory path in path order, to whatever depth the
paths have. **This diverges from `05-design-prompt.md:29` and the divergence is recorded rather than
silently absorbed**, on the pattern Q-0017 set at `:31`: *"Review — rounds as columns"* is two levels
and a real folder is four, `review/chore/run-2/chore-iter-1.md`, because a flow can run more than
once on one ticket and each traversal is scoped. Inventing columns for a shape the data does not have
would be the mockup's fake structure in a real app.

### 2.4 Three refusals, told apart by a predicate and never by a message

`GET /history/:id` already separates *no run under that token* (404) from *a manifest that would not
parse* (422). A ticket page needs those two and one more, and §0.5 is why it needs a barrel entry to
get them:

| condition | status | code |
| --- | --- | --- |
| the token is not one name (`../x`, `a/b`, `""`) | **400** | `not-a-ticket-token` |
| one name, no folder under the backlog root | **404** | `no-such-ticket` |
| a folder whose `ticket.md` did not parse | **422** | `malformed-ticket` |

`Backlog.dirOf` throws a plain `Error` for the first two with different wording. **The route must
decide with `isOneName` before calling `dirOf`**, never by matching the message — a status that
depends on a sentence is one that changes when the sentence is improved.

**The malformed rule is the body's, and the asymmetry with the listing is deliberate.** `ticket.md`
must have produced non-empty string `id`, `title`, `stage` and `owner`, and its `id` must equal the
token the folder resolved from; otherwise 422 naming `ticket.md`. `GET /tickets` does the opposite by
design — Q-0017 AC-8 requires the **listing** to render a damaged ticket, identified by its `folder`,
so it is visible at all. A row on the board and a refusal on its page is the coherent pair: the board
says *this ticket is damaged*, and the page says *which file and why*. **This surfaces Q-0060 at the
HTTP boundary and changes no parser**, which stays that ticket's.

### 2.5 Bytes that are not text are refused, by the one test with no false positives

§0.4 kills the replacement-character test: three legitimate markdown files already contain U+FFFD.

What is specified instead: the listing already carries each file's `bytes` from `stat`. The file
route compares that against the byte length of what it decoded. **Well-formed UTF-8 round-trips
byte-for-byte, so the test has no false positives** — those three files pass it, because their
U+FFFD is genuinely encoded on disk. A file whose bytes were substituted is refused under its own
code rather than served with U+FFFD standing where the data was.

**The residual is stated rather than hidden**: a substitution that happens to preserve the total byte
length is not detected. That is a narrower silence than serving corrupted text as though it were the
file, and it is a bound rather than a claim.

### 2.6 Escaped preformatted text, and no new dependency

Artifact text is repository-controlled and agent-written. React escapes text children, so rendering a
file's text as the child of a `<pre>` is safe with nothing added. **No Markdown renderer**: one needs
a sanitiser, which needs a dependency, which needs a justification and probably a decision entry —
and that is a separate choice with its own subject, taken deliberately rather than arrived at while
building a page.

**Nothing is fetched until a reader picks a file**, and every row shows its size before they pick.
That is what stands in for a cap: the reader chooses the 1.46 MB file with the number in front of
them, rather than a threshold nobody measured deciding for them. It is also why this document
specifies no cap anywhere — Q-0124's lesson is that a cap must be named where a reader sees it, and
the honest way to satisfy it here is to have none.

---

## 3. User stories

**As the `maintainer`**, I click a card on the backlog board and read the ticket's own record in the
browser — the merged requirement, the errata that ruled a criterion, each review round's report, and
the run log down the side — without going back to a shell, and without a 3 MB page load for a folder
I am going to read one file of.

**As the `maintainer`**, when a ticket's `ticket.md` is damaged, the page tells me which file did not
parse instead of rendering a page of blanks, so the board naming it as damaged and the page
explaining it are one story rather than two.

**As the `adopter`**, the ticket page shows me my folder and only my folder: no engine state I did
not write, and the page says how much it is not showing rather than implying it showed everything.

**Surfaces touched**: `packages/server` (two routes), `packages/shared` (two wire shapes with
schemas), `packages/core` (a listing function and two barrel entries), `apps/web` (one screen),
`docs/04-architecture.md`. **No flow file, no role file, no `harness/` change, no write of any kind.**

---

## 4. Acceptance criteria

Fourteen, against this role's ceiling of fifteen. AC-14 is named in §7 R-1 as the **only** eligible
trim seam.

**AC-1 — `GET /tickets/:id` answers frontmatter and a file listing, and carries no file text.**
The body holds the same `WireTicket` the listing route answers for that ticket, a `files` array of
`{rel, bytes}` for every included file, and the excluded-count disclosure of AC-4. It carries no
push-lag field.
*Test:* against a fixture ticket holding a file of known size at a known nested path, the response
contains that path with that byte count, and **no property anywhere in the body equals or contains
that file's text** — asserted over the serialised body, so a field added later cannot smuggle text
back in. The `WireTicket` half is asserted **equal** to the row `GET /tickets` answers for the same
ticket, so the two surfaces cannot disagree about one ticket.

**AC-2 — the listing is built without reading any file.**
*Test:* two ways, both needed. A `core`-level test asserts the listing function's result for a
fixture whose files are large, with `fs.readFileSync` spied: the spy is not called for any file in
the ticket folder. And the function is shown to answer for a file the process could stat and could
not read, which a reading implementation cannot do.

**AC-3 — the three refusals are distinguished by predicate, and no status depends on an error
message.**
`isOneName` is exported from `@quorum/core`'s barrel and the route calls it before `dirOf`.
*Test:* `../etc`, `a/b`, `.`, `..` and `""` each answer **400** `not-a-ticket-token`; a well-formed
token naming no folder answers **404** `no-such-ticket`; and a source-level assertion that the route
module matches no `dirOf` error message text — shown red by making one status depend on a message.

**AC-4 — a path whose first segment begins with `.` is excluded from the listing and unreadable, and
the exclusion is disclosed.**
The rule is the leading dot, not the name `.harness`. The listing carries the count and total bytes
excluded; it carries none of their paths.
*Test:* over a fixture holding `.harness/run-1/verdict.json` and a second dotted directory, neither
path appears anywhere in the listing body, both are counted, the byte total is theirs, and
`GET …/file?path=.harness/run-1/verdict.json` is refused. **Shown red by a mutation** that excludes
the literal `.harness` alone: the second dotted directory then leaks.

**AC-5 — `GET /tickets/:id/file` serves exactly one file, and only a path the listing holds.**
Before reading, the route refuses a `path` containing `*` or ending in `/`, refuses one the listing
does not hold, and after reading asserts the result is exactly one entry whose `rel` equals the
request. Core's confinement stays underneath and is **not** replaced by the membership rule.
*Test:* the happy path returns that file's text; `*.md`, `review/`, `../ticket.md` and a path outside
the listing are each refused with a distinguishable code; and — the case the membership rule alone
does not close — a fixture file whose **name legitimately contains `*`** is listed, and requesting it
is refused rather than globbing. Confinement is shown still to fire by a test that reaches
`readFiles` with a traversing path directly.

**AC-6 — a file whose bytes are not well-formed UTF-8 is refused under its own code, never served
substituted.**
The test is the byte-length round-trip of §2.5.
*Test:* a fixture carrying an invalid byte sequence is refused with a code distinct from every
refusal in AC-3 and AC-5. **And the false-positive half, which is the one that matters**: the three
real files that contain U+FFFD — `Q-0006/qa/scenario-review.md` and Q-0101's two — are each served
successfully, asserted by name, so the instrument is shown to discriminate rather than merely to
fire. The residual is stated in the route's JSDoc in one line.

**AC-7 — both new wire shapes are declared in `@quorum/shared` with runtime schemas, and nowhere
else.**
A browser needs an executable parser and not a type; `packages/server` re-exports and does not
redeclare. This is `wire.ts`'s own header executed rather than reinterpreted.
*Test:* the schemas parse a real response and reject a body with an unknown key (`.strict()`), a
missing field and a wrong type, each with its own message; and a source assertion that
`packages/server` and `apps/web` declare neither shape themselves.

**AC-8 — the client's two requests go through `requestJson` and `DAEMON_ENDPOINTS`, and name no
path of their own.**
Both new fetch functions return a `RequestState`, so all five outcomes — including `refused`
carrying the daemon's own `condition` — are already rendered by `requestStateText`.
*Test:* `apps/web/test/source.test.ts`'s existing scans stay green with no new exemption, and each
function is driven through a stub returning each of: a good body, a 404 refusal, a 422 refusal,
non-JSON, and a well-formed body of the wrong shape — five distinct states, no two collapsing.

**AC-9 — the page fetches the listing on mount and no artifact text until a reader selects a file.**
`ticket.md` and `runs.log` are the two exceptions and are fetched on mount because the page renders
them; every other file is fetched on selection, and every row shows its byte size beforehand.
*Test:* mounting against a fixture whose folder holds a 1 MB artifact issues exactly three requests
and none is for that artifact; selecting it issues one more. **Shown red** by a version that
prefetches.

**AC-10 — tabs are derived from the listing's top-level entries, not from a fixed list.**
Every top-level directory is a tab, `ticket.md` is a tab, and any other top-level file is a tab.
*Test:* a fixture carrying `adapter-probe.md` beside the usual directories renders a tab for it;
a fixture with no `solution/` renders no Solution tab and no empty one; and a source assertion that
the component holds **no literal list of tab names**, shown red by introducing one. A four-level path
renders its full path, so `dev/development/run-4/green-report-iter-1.md` is reachable and
distinguishable from `dev/chore/run-2/implement-iter-1.md`.

**AC-11 — `runs.log` renders down the side, and its absence says so.**
Present on 91 of 107 tickets; the 16 without one get a sentence, never an empty rail.
*Test:* a fixture with a run log renders its lines; one without renders a sentence naming what is
absent and why (no run has touched this ticket), and **no empty region** — asserted by the rendered
text rather than by a node count.

**AC-12 — artifact text renders as escaped preformatted text, and no dependency is added.**
*Test:* a fixture file whose text contains `<script>alert(1)</script>` and a raw `&` renders those
characters visibly and creates no element from them, asserted over the DOM; and `apps/web`'s manifest
gains no dependency, asserted against the merged tree.

**AC-13 — the registered route set and the architecture document move together.**
`package.test.ts`'s derived route register gains the two new literals, and
`docs/04-architecture.md`'s `packages/server` section gains a sentence for each — that section's own
rule is that *"a route added without a sentence here is a failing test rather than a document going
stale"*.
*Test:* the existing derivation asserts the new set; removing either sentence from the document turns
it red by name. `apps/web/src/routes.ts`'s ticket row has `screenExists` set the way the board's was,
and `app.tsx` selects the screen from the register rather than by a second path comparison — shown by
a test that a third screen needs no new branch.

**AC-14 — the three findings Q-0017's truncated review could not see are closed.**
Three clauses, each with its own test, in the files this ticket already opens.
- **(a)** `packages/shared/src/wire.ts:157,164` — `not-contained.ahead` and `unpushed.ahead` gain
  `.nonnegative()`, matching `count` (`:50`) and `pendingGates` (`:126`) in the same file.
  *Test:* each schema rejects `-1` with a message naming the field, and accepts `0`.
- **(b)** `packages/server/src/read.ts:68` — `billedCostOf`'s all-unpriced case is **ruled**, not
  assumed. Measured on the merged tree: **no `cost: null` entry exists anywhere in this backlog**, 69
  tickets carry priced history and 38 carry none, so the case is latent and `?? 0` has never fired.
  The recommendation is that the legend suffices and the JSDoc says so explicitly, because the
  alternative — `null` for an all-unpriced history — makes *nothing has run* and *everything was
  codex* one answer, which is worse than the case it fixes.
  *Test:* a history whose every entry cost is `null` is asserted to render the sum the ruling chose,
  in a test named for the case, so the next reader finds the answer rather than re-asking.
- **(c)** `packages/shared/src/docs.test.ts:1702` — the case named *"so they cannot drift apart"*
  matches each string independently against three needles and never compares the two. Either compare
  them or correct the comment to the weaker property actually enforced. **The three needles are not
  deleted**; they are the anti-vacuity half.
  *Test:* whichever is chosen, the mutation that the comment claims to catch is shown to turn it red,
  or the comment no longer claims to catch it.

---

## 5. Non-goals

Each is refused for a reason, not merely omitted.

1. **The backlog board.** Q-0017's, shipped. This inherits its fetch module, request-state vocabulary
   and shared wire schemas and builds none of them again.
2. **Fixing Q-0060.** The shared parser still falls open, and AC-3 refuses the damaged ticket **at the
   HTTP boundary** without touching it. Changing `parseFrontmatter` is that ticket's, and it also reads
   role files (`engine.js:727–732`), which is why it is not a passing fix.
3. **Any write.** No edit, no stage move, no run start, no gate answer. Every route here is a `GET`,
   and *"the UI edits files and never holds the truth"* is why a first write belongs to a ticket whose
   subject it is.
4. **A Markdown renderer.** §2.6 — it needs a sanitiser, a dependency and a justification, and that is
   a decision rather than a rendering detail.
5. **Parsing `runs.log` into links.** It renders as text. Turning its lines into navigation means
   deciding what a run id links to, which is Q-0018's screen.
6. **Mission control, the gate screen, run-history drill-down.** Q-0015, Q-0016, Q-0018.
7. **A cap on the review diff.** Q-0128's, opened at Q-0017's close. §7 R-2 says how it bears on this
   ticket without this ticket growing it as a second subject.
8. **A per-vendor cost figure on the page.** The roll-up that could split by vendor is per **run**
   (`GET /history/:id`'s `tokensByVendor`), not per ticket. The page carries the one figure the board
   carries, with the same legend. Q-0015 is where a run is the unit.
9. **Caching a ticket's folder in the browser.** The app holds no copy by design, and a listing
   carrying byte sizes goes stale exactly as a git fact does.

---

## 6. Open questions

**OQ-1 (BLOCKING) — does the `.harness/` ruling owe a decision entry? Owner: the human, at the
gate.**
It must be settled **before** the implement step runs, because `developer-generalist` may not write
one and a run launched without it spends rounds on a blocker no step on the route can clear — which
this repository has recorded fifteen times, and which Q-0062 paid for three rounds after its own
requirement named the hazard in advance.
**Recommendation: no entry is owed.** `.harness/` is untracked, so it is not in the database, and
excluding it is *"files are the database"* applied rather than contradicted; nothing here reverses a
landed entry, and no glossary term moves. The ruling belongs in the listing function's own JSDoc plus
one sentence in `04-architecture.md`. **The one shape that would owe an entry is the opposite
answer** — serving engine run state from a backlog route makes `.harness/` part of what the backlog
surface means, which is a product statement.

**OQ-2 — is a term coined, and is `manifest` available? Owner: the human, at the gate.**
**It is not, and this is a real collision.** `docs/GLOSSARY.md` uses *manifest* for a run's manifest
under **Run history**, and **Occurrence** is defined as *"one entry in a run manifest's record"*.
Calling the ticket-folder listing a manifest introduces a homograph for an existing term, which
`docs-and-decisions.md` forbids in as many words.
**Recommendation: coin nothing.** Name the shapes for what they carry — a detail response with a
`files` array of `{rel, bytes}` — so no noun is needed and the glossary does not move. Ratify at the
gate so an implementer does not reach for the obvious word.

**OQ-3 — is the byte-length round-trip ratified as the binary test, with its residual? Owner: the
human, at the gate.**
**Recommendation: yes.** §0.4's three legitimate U+FFFD files refute the obvious alternative by
measurement, and the residual — a substitution preserving total byte length — is narrower than
serving corrupted text as the file. The alternative that closes it completely is a `core` function
returning raw bytes, which is a second primitive and a wider surface than this ticket needs.

**OQ-4 — which tab opens first? Owner: this requirement, answered.**
`ticket.md`. It is the only file present on all 107 tickets, it is the ticket's own intent, and a page
that opened on an empty selection would be the blank panel `04-architecture.md:200` forbids.

**OQ-5 — does the listing function live in `backlog.ts` beside `readFiles`, or in its own module?
Owner: the implementer.**
Not blocking. Beside `readFiles` is recommended, because the exclusion rule and the confinement it
shares want to be readable in one place; a new module under `backlog/` would be a third file asking
the same question `confine.ts` already answers.

---

## 7. Risks

**R-1 — fourteen criteria is at the upper end, and the evidence about that is specific.** Q-0121 at
thirteen closed in one implement round with no findings; Q-0125 at thirteen closed in two. Q-0126 at
sixteen took **five rounds and $177.92**, and Q-0122 at twenty took three and $101.88. **The seam is
named in advance rather than discovered**: if the loop exhausts, **AC-14 is the only eligible trim**,
and trimming it means opening a successor **with all three clauses transcribed in full** — the three
findings already survived one review that could not see them, and an obligation left in a closed
ticket's prose is what Q-0110, Q-0111 and Q-0112 each cost a rediscovery. No other criterion is
eligible: AC-3 to AC-6 are the confinement and refusal surface, which §2 is the argument for not
trimming.

**R-2 — this change will be reviewed against a truncated diff, and that is predictable rather than
hypothetical.** `repo.max_diff_bytes` is 200,000 and truncates head-only. Comparable tickets: Q-0017
was 2,828 insertions and truncated on **all three** rounds at 83.8%, 79.4% and 76.9%, with the
no-patch set growing 6 → 8 → 9; Q-0126 was 7,787 insertions and every one of its five reviews saw
75%. A route plus a screen plus their tests will land in that range. **`git diff` orders by path**, so
the tail is the same every round: here that is `packages/server/src/read.ts` and
`packages/shared/src/wire.ts` — the two files AC-14's findings are in, and the two this ticket's own
body says were missed last time. Q-0116's warning now names the omitted files on the event stream, so
the operator can see it during the run; **the mitigation is a hand pass over exactly those files
before the gate**, cross-vendor, on Q-0079's and Q-0124's precedent. Q-0128 owns the cap and this
ticket must not grow it.

**R-3 — the page's own URL collides with nothing, and that was checked rather than assumed.**
Q-0120's B-1 was a prefix collision between the shell's routes and the daemon's proxied prefixes.
`DAEMON_ENDPOINTS` holds `/runs`, `/project`, `/tickets`, `/flows`, `/history`; the shell path is
`/backlog/:ticketId`, which is a prefix of none of them and which the proxy does not forward. And
`/tickets/:id` is **under an already-forwarded prefix**, so the dev server needs no change and
`bypassNavigation` already steps aside for a page load. Verified against `vite.config.ts` and
`daemon-endpoints.ts`.

**R-4 — a reader switching between two files re-fetches both.** Accepted, and it is the app's existing
rule rather than a new cost: `app.tsx` holds no cache by design. The median artifact is small and the
requests are loopback. A cache would be the UI holding a copy of a file that can change under it,
which is what the board already refuses for a git fact.

**R-5 — `.DS_Store` appears inside a ticket folder the first time somebody opens one in Finder.**
Today the only non-UTF-8 file under `backlog/` sits outside every ticket folder, so nothing reaches
it — but macOS creates them unbidden, and AC-4's leading-dot rule excludes it from the listing before
AC-6's test is ever needed. Both guards cover it, and that is deliberate rather than redundant: one is
about what the route chooses to serve and the other about what it can characterise.

**R-6 — `Backlog.dirOf` resolves a prefix**, matching `name === token || name.startsWith(token + '-')`.
Checked: `Q-012` does **not** resolve `Q-0127-…`, because the match requires the hyphen. So a short
token answers 404 rather than the wrong ticket. Stated because it looks like a hazard and is not, and
the next reader should not have to re-derive it.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked, no subscription is read, no key path exists. Nothing here reads an environment variable. |
| **Worktree safety** | n/a, and stronger than n/a: every route is a `GET` and no code path writes. AC-1 and AC-5 are both asserted over responses, and `packages/server/src/read.ts`'s existing *"it writes nothing"* property is preserved — the module gains two readers and no writer. |
| **Gate behaviour** | n/a. No gate, no run, no answer. |
| **File format and schema** | Two new wire shapes, declared in `@quorum/shared` **with runtime schemas** (AC-7). No file on disk changes format; `ticket.md`, `runs.log` and every artifact are read exactly as they are. `ticketSchema` and `parseFrontmatter` are untouched — AC-3's validation happens in the route, above the parser. |
| **Lint rules** | n/a. No flow file changes, so `lintFlow` gains nothing and `quorum lint` is unaffected. |
| **Cold-clone impact** | **No new dependency** (AC-12), so `pnpm install` does not grow. The bundle grows by one screen; `@quorum/web` is already tarball four of five since Q-0124, so a packed install serves this page with no packaging change. The daemon gains two routes and no start-up work. |
| **Product-agnostic** | n/a. Nothing here knows about any SaaS product; every fixture is a synthetic ticket folder. |
| **Documentation** | `docs/04-architecture.md`'s `packages/server` section gains one sentence per route (AC-13) and its `apps/web` paragraph gains the ticket page. `docs/05-design-prompt.md` gains a divergence note on the tab model, on the pattern Q-0017 set at `:31`. **`docs/GLOSSARY.md` is not edited** if OQ-2 is ratified as recommended. |
