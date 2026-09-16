# Q-0127 — The ticket page renders a ticket's folder

*Requirements, run 1, merged. Every figure below was re-derived against the merged tree on
2026-09-16, after Q-0017 landed. Where this document disagrees with a candidate or with the ticket
body, it is the later measurement and says so in place rather than editing the number quietly.*

---

## 0. What was measured, and what it changed

Both candidates asked for measurement before choosing. Re-derivation moved the design in four
places, and in three of them **both candidates were wrong in the same direction** — which is why
this section exists rather than the numbers being absorbed.

### 0.1 `readFiles` cannot enumerate a ticket folder at all — the single-route shape is unbuildable

Both candidates argued against one route returning everything **on cost**. The stronger fact is that
the shipped primitive cannot do it:

- `pathInside(folder, rel)` refuses `rel === ''` outright (`confine.ts`), and refuses any `rel` whose
  joined path does not add at least one component — so `''`, `'.'` and `'./'` are all refused.
  There is no pattern that names the ticket folder itself.
- `readFiles(ticket, '*')` resolves `dir` to the folder, builds `^.*$`, and maps **every** `readdir`
  entry — directories included — through `fs.readFileSync`, which throws `EISDIR` on the first
  subdirectory. Every real ticket folder has one.
- `readFiles(ticket, '*/')` walks `folder/*`, which does not exist, and returns `[]`.

So "read the folder and discard the text" is not a worse option, it is **not an option**. Claude's
§2.1 presents it as the refused alternative; it does not exist. **A new `core` listing function is
required, not preferred**, and Claude's OQ-5 is answered by that rather than by taste.

### 0.2 The payload, which decides the route's shape anyway

Claude's measurement stands and is the argument for laziness even once §0.1 has forced the split.
Encoding each folder's visible files as `{files:[{rel,text}]}` against `{files:[{rel,bytes}]}`:

| | whole folder | listing only |
| --- | --- | --- |
| largest | **3,157,849 B** | **2,847 B** |
| median | **133,940 B** | **502 B** |
| over 200 KB | **38 of 107** | 0 |

`Q-0083` is 3,108,985 B across **six** files, one of them 1,460,837 B. A page that loads the listing,
`ticket.md` and `runs.log` costs **~9 KB** at the median and **~50 KB** at the worst
(`runs.log` median 2,233 B / max 14,962 B; `ticket.md` median 6,446 B / max 32,206 B).

**That is why this document specifies no cap anywhere.** Nothing large is fetched unless a reader
names that file with its size in front of them. Q-0124's lesson — a cap must be named where a reader
sees it — is satisfied here by having none rather than by disclosing one.

### 0.3 Absent versus empty is unreachable from a clone — Codex's `directories` array is refused

The ticket body says *"`readFiles` answers `[]` for a legitimately absent directory, so absent and
empty are already distinguishable and must stay so."* **Measured, that is false in both halves.**
`walk()` returns `[]` for an absent directory (its `existsSync` guard) **and** `[]` for an existing
empty one, so `readFiles` does not distinguish them. Codex read the body correctly and built AC-4 and
AC-16 to close the gap; Claude read it correctly and concluded no special case was needed. Both
inherited a false premise.

**What settles it is a different measurement: there are zero empty directories under `backlog/`, and
git cannot track one.** An empty artifact directory cannot survive a clone. It can exist only
transiently in a working tree, and `writeFile` does `mkdirSync` immediately followed by
`writeFileSync`, so the window is an interrupted run — at which point the tab would have nothing to
show anyway.

**Ruling: the response carries `files` and no `directories` array.** The tab set is derived from the
top-level segment of each listed file's `rel`. An existing empty directory therefore produces no tab.
This is an accepted, measured bound and is stated in AC-10's own test rather than left to be found.

### 0.4 The binary instrument — and a measurement of mine that was wrong

Scanning **whole files** with the decoder the product actually uses:

- **Exactly one file under `backlog/` is not well-formed UTF-8: `backlog/.DS_Store`**, and it sits
  outside every ticket folder. The ticket body and Claude are right; latent, not live.
- **Three files legitimately contain U+FFFD** — `Q-0006/qa/scenario-review.md`,
  `Q-0101/requirements/merged.md` and `Q-0101/requirements/run-1/merged-iter-1.md` — so the obvious
  test *"does the decoded text contain a replacement character"* would report three hand-written
  markdown files as binary on the day it shipped. Claude's §0.4 is confirmed and the test is refused.

**A first pass of mine reported a second invalid file inside a ticket folder and was wrong.**
`iconv -f UTF-8 -t UTF-8` rejects
`Q-0124/.harness/run-1/head-of-product-verdict-iter-2.json`; Node's `TextDecoder('utf-8', {fatal:
true})` accepts it, it round-trips byte-for-byte at 7,596 B and contains no U+FFFD. The file is
valid and the instrument was not. **Recorded rather than dropped, because it is the constraint on the
fixtures: a UTF-8 verdict must be taken with the decoder that will serve the bytes, not with a shell
tool that disagrees with it.**

**Which instrument.** Claude proposes a byte-length round-trip (stat size against the re-encoded
length of the decoded text); Codex proposes a whole-file fatal decode. Over all 1,269 files the two
agree exactly — both flag `.DS_Store` and nothing else — so the proxy has no observed miss. **Codex's
is taken anyway, on a mechanical reason rather than on a measured failure**: the proxy needs a byte
count from *the same read*, and `readFiles` returns text only, so the count would come from a second
`stat` — making the verdict a function of two moments, which is how a file that merely changed gets
reported as binary. A fatal decode of the bytes that were read answers from one moment and carries no
residual. This is what makes AC-2's second `core` function load-bearing rather than convenient.

### 0.5 Three things about `core` that change the work

- **`isOneName` is not on the barrel.** `packages/core/src/index.ts:95` exports `pathInside` from
  `confine.js` and nothing else from that module. `Backlog.dirOf` throws a plain `Error` for *this
  token is not one name* and for *ticket not found*, with different wording — so a route without the
  predicate would decide an HTTP status **by matching an error message**. Claude's §0.5 confirmed.
- **`TicketFile` is not on the barrel either** — `:94` exports the `TicketRecord` type alone.
- **There is no listing primitive**, and per §0.1 none can be composed from `readFiles`.

### 0.6 `.harness/`, measured rather than estimated

**69 ticket folders hold a `.harness/` directory; git tracks none of them** (`backlog/.gitignore`
re-includes `runs.log` and nothing else). It holds engine scenario-verdict JSON. The body's file
count grows with every run, so **no criterion here depends on it**.

Claude's corroborating discriminator holds: **every `.json` file under `backlog/` is inside
`.harness/`**. The visible record is markdown, logs, text and YAML and contains no `.json` at all.

Confinement does not help — these files *are* inside the ticket folder, so Q-0059's guard correctly
permits them. The question is what the route **chooses** to serve, which is a different question that
reads the same on a first pass.

### 0.7 Confirmed without change

Twelve production routes, `GET /tickets/:id` genuinely absent — `read.ts` five, `http.ts` five,
`serve.ts` one, `static.ts` one, enumerated by excluding test files **by filename**. The body's
warning about `grep -h` is correct and was obeyed. `DAEMON_ENDPOINTS` already carries
`tickets: '/tickets'`, so both new routes sit under an already-forwarded prefix and the dev proxy
needs no change. `routes.ts` already declares `TICKET_ROUTE = '/backlog/:ticketId'` and its register
row already names this ticket. `dirOf`'s prefix match requires the hyphen, so `Q-012` does not
resolve `Q-0127-…`.

Top-level entries across 107 folders: `ticket.md` 107, `runs.log` 91, `review` 71, `requirements`
71, `.harness` 69, `dev` 65, `solution` 5, `qa` 5, **`adapter-probe.md` 1**. Claude said
`requirements` 70; it is 71. No criterion depends on it.

---

## 1. Problem

**The maintainer can see the backlog and cannot open a ticket.** Q-0017 shipped the board and every
card links to `/backlog/:ticketId`, which reaches a placeholder saying — accurately — that it needs a
route the daemon does not have.

That is the whole problem. Twelve routes are registered and none answers for one ticket: `GET
/tickets` lists frontmatter for all of them, and `read.ts` contains no folder read. What the
maintainer loses is the record itself — the two candidate requirements and the merged one, the errata
that ruled a criterion, the per-round review reports, the implement reports, the run log that says
what each run cost and how it ended. All of it is reachable only from a shell in the repository,
which is the thing a local web app exists to stop being the only answer.

---

## 2. User stories

**As the `maintainer`**, I click a card on the backlog board and read the ticket's own record in the
browser — the merged requirement, the errata, each review round's report, and the run log down the
side — without going back to a shell, and without a 3 MB page load for a folder I am going to read
one file of.

**As the `maintainer`**, when a ticket's `ticket.md` is damaged, the page names the file that did not
parse instead of rendering a page of blanks, so the board naming it as damaged and the page
explaining it are one story rather than two.

**As the `adopter`**, the ticket page shows me my folder and only my folder: no engine state I did
not write, and it says how much it is not showing rather than implying it showed everything.

**Surfaces touched**: `packages/core` (two functions and three barrel entries), `packages/server`
(two routes), `packages/shared` (two wire shapes with schemas, one schema tightening), `apps/web`
(one screen), `docs/04-architecture.md`. **No flow file, no role file, no `harness/` change, and no
write of any kind.**

---

## 3. The rulings, each with the measurement behind it

**Two routes.** `GET /tickets/:id` answers frontmatter and a file listing with no text;
`GET /tickets/:id/file?path=<rel>` answers one file. Forced by §0.1 and argued by §0.2.

**The file route takes a query parameter, not a path segment.** A relative path contains `/` —
`dev/chore/run-2/implement-iter-1.md` is four segments — so a segment needs the client to encode and
the route to `decodeURIComponent`, which is precisely where a confinement bypass hides. A query value
is handed to `core` verbatim and confinement stays `core`'s. **Singular `/file`**, not Codex's
`/files`: it answers exactly one file, and the singular is what stops a later reader expecting a
collection.

**The listing is re-derived on every request, including inside the file route.** No cache, no index,
no stored copy — the discipline `containment` and push lag are already under. The file route lists
and then reads, so *membership in the listing* is a fact of the same request rather than of a client's
earlier one. Worst case is 61 `stat` calls.

**`.harness/` is excluded and the exclusion is said out loud.** Rendering it puts 833 KB of untracked
engine state inside a page whose subject is the ticket's record; hiding it silently is Q-0128's
failure one surface along. The listing carries the **count and total bytes** excluded and **none of
their paths** — enough to say the page is not showing everything, not enough to be a directory listing
of engine internals, which would be a second run-history surface and is Q-0018's. **The rule is
structural: any path whose first segment begins with `.`**, so a second hidden directory is excluded
and counted the day it appears.

**Tabs are derived, never a fixed list.** `adapter-probe.md` is a seventh top-level entry today, so
the design brief's six names lose a file on the day they are written down. Within a tab, files render
grouped by directory path to whatever depth the paths have — up to four levels. **This diverges from
`05-design-prompt.md`'s "Review — rounds as columns" and the divergence is recorded in place**, on the
pattern Q-0017 set: that line was written 2026-08-22, before Q-0086–Q-0089 scoped every artifact by
`{run}` and `{iter}`, and inventing columns for a shape the data does not have would be the mockup's
fake structure in a real app.

**Three refusals told apart by a predicate, never by a message.** `GET /history/:id` already separates
*no run under that token* from *a manifest that would not parse*; this needs those two and the
token refusal.

| condition | status | code |
| --- | --- | --- |
| the token is not one name (`../x`, `a/b`, `.`, `..`, `""`) | **400** | `not-a-ticket-token` |
| `path` missing, empty, absolute, traversing, wildcarded, trailing `/`, or not in the listing | **400** | `not-a-file-path` |
| one name, no folder under the backlog root | **404** | `no-such-ticket` |
| the ticket exists and the listed path no longer names a regular file | **404** | `no-such-file` |
| `ticket.md` did not yield the four fields, or its id is not the requested one | **422** | `malformed-ticket` |
| the file's bytes are not well-formed UTF-8 | **422** | `unsupported-file-encoding` |

**Codex's 415 is refused**: 415 describes the media type of a *request*, and what failed here is the
representation of a file on disk. 422 with its own code is the shipped precedent
(`malformed-manifest`). **`no-such-file` is narrow and deliberately kept**: a path that was never
listed is refused at membership, so 404 fires only where the file vanished between this request's own
listing and its own read — which is a true statement about a real window rather than a dead row.

**The malformed rule is the body's, and the asymmetry with the listing is deliberate.** Both routes
verify that `ticket.md` produced non-empty string `id`, `title`, `stage` and `owner` and that its `id`
equals the resolved token. `GET /tickets` does the opposite by design — Q-0017 AC-8 requires the
**listing** to render a damaged ticket, identified by its `folder`, so it is visible at all. A row on
the board and a refusal on its page is the coherent pair. **This surfaces Q-0060 at the HTTP boundary
and changes no parser**, which stays that ticket's.

**Escaped preformatted text, and no new dependency.** React escapes text children, so a file's text
as the child of a `<pre>` is safe with nothing added. A Markdown renderer needs a sanitiser, which
needs a dependency and a justification — a separate decision with its own subject, taken deliberately
rather than arrived at while building a page.

---

## 4. Acceptance criteria

Fourteen. **AC-14 is named in §7 R-1 as the only eligible trim seam.**

**AC-1 — `GET /tickets/:id` answers frontmatter and a file listing, and carries no file text.**
The body holds the same `WireTicket` the listing route answers for that ticket, a `files` array of
`{rel, bytes}` for every included file sorted lexicographically by `rel`, and AC-4's exclusion
disclosure. It carries **no push-lag field** — one repository-level fact belongs where it is rendered,
and a second claim of it is a second place to be wrong.
*Test:* against a fixture holding a file of known size at a known nested path, the response carries
that path with that byte count, and **no property anywhere in the serialised body equals or contains
that file's text**, so a field added later cannot smuggle text back in. The `WireTicket` half is
asserted **equal** to the row `GET /tickets` answers for the same ticket, so the two surfaces cannot
disagree about one ticket. Sorting is asserted against a fixture whose `readdir` order differs.

**AC-2 — `core` gains a listing function that reads no file, and a one-file byte read; both are on
the barrel with `isOneName` and `TicketFile`.**
The listing stats and never opens; the byte read returns the file's bytes for exactly one confined
`rel`. Both sit on the same confinement as `readFiles`, which is unchanged — every flow's
`input.backlog` depends on it.
*Test:* three ways, and all three are needed. With `fs.readFileSync` spied, the listing function's
result for a fixture of large files is complete and the spy is not called for any file in the folder.
The listing answers for a file the process can `stat` and cannot read, which a reading implementation
cannot do. And a source assertion that `packages/server` opens no file itself — no `node:fs` read on a
path it built — so both reads stay `core`'s, per *"Enforced in `core`, so the CLI and M3's server
inherit one rule instead of each writing a weaker one"*.

**AC-3 — the three token-and-ticket refusals are decided by predicate, and no status depends on an
error message.**
`isOneName` is called before `dirOf`, on both routes.
*Test:* `../etc`, `a/b`, `.`, `..` and `""` each answer **400** `not-a-ticket-token`; a well-formed
token naming no folder answers **404** `no-such-ticket`; a folder whose `ticket.md` did not yield the
four non-empty string fields, and one whose `id` is not the requested token, each answer **422**
`malformed-ticket` naming `ticket.md` and the field, on **both** routes. Plus a source assertion that
neither route module matches any `dirOf` message text — **shown red** by making one status depend on a
message.

**AC-4 — a path whose first segment begins with `.` is excluded from the listing and unreadable, and
the exclusion is disclosed.**
The rule is the leading dot, not the name `.harness`. The listing carries the count and total bytes
excluded and none of their paths; the page renders one line naming them as the engine's own run state.
*Test:* over a fixture holding `.harness/run-1/verdict.json` and a second dotted directory, neither
path appears anywhere in the serialised listing, both are counted, the byte total is theirs, and
`GET …/file?path=.harness/run-1/verdict.json` is refused. **Shown red by a mutation** that excludes
the literal `.harness` alone: the second dotted directory then leaks.

**AC-5 — `GET /tickets/:id/file` serves exactly one file, and only a path this request's own listing
holds.**
Before reading, the route refuses a `path` that is missing, empty, absolute, contains `*`, ends in
`/`, or is absent from the listing it derives for this request; after reading it asserts the result is
that one `rel`. `core`'s confinement stays underneath and is **not** replaced by the membership rule.
*Test:* the happy path returns that file's text; `*.md`, `review/`, `../ticket.md`, an absolute path,
a percent-encoded traversal and a path outside the listing are each refused **400** `not-a-file-path`;
a file removed between the listing and the read answers **404** `no-such-file`. The case the
membership rule alone does not close: a fixture file **whose name legitimately contains `*`** is
listed and requesting it is refused rather than globbed. Confinement is shown still to fire by a test
that reaches the `core` read with a traversing `rel` directly.

**AC-6 — a file whose bytes are not well-formed UTF-8 is refused under its own code, and is never
served substituted.**
The instrument is a **whole-file fatal decode of the bytes AC-2's read returned** — not a prefix,
which can end inside a multi-byte character, and not a second `stat`, which would make the verdict a
function of two moments.
*Test:* a fixture carrying an invalid byte sequence answers **422** `unsupported-file-encoding`, a
code distinct from every refusal in AC-3 and AC-5, and no U+FFFD appears in any response. **And the
false-positive half, which is the one that matters:** the three real files that contain U+FFFD —
`Q-0006/qa/scenario-review.md` and Q-0101's two — are each served successfully **by name**, so the
instrument is shown to discriminate rather than merely to fire. A fixture whose invalid bytes are
split across a chunk boundary is refused, and one whose *valid* multi-byte character is split is
served.

**AC-7 — both new wire shapes are declared in `@quorum/shared` with runtime schemas, and nowhere
else.**
A browser needs an executable parser and not a type; `packages/server` re-exports and does not
redeclare. This is `wire.ts`'s own header executed rather than reinterpreted.
*Test:* each schema parses a real response and rejects an unknown key (`.strict()`), a missing field
and a wrong type, each with its own message; and a source assertion that neither `packages/server` nor
`apps/web` declares either shape itself.

**AC-8 — the client's two requests go through `requestJson` and `DAEMON_ENDPOINTS`, and name no path
of their own.**
Both new fetch functions return a `RequestState`, so all five outcomes — including `refused` carrying
the daemon's own `condition` and `remedy` — are rendered by the existing `requestStateText` and
`requestStateRemedy`. The ticket id is encoded as one path segment and the relative path as one query
value.
*Test:* `apps/web/test/source.test.ts`'s existing scans stay green **with no new exemption**, and each
function is driven through a stub returning a good body, a 404 refusal, a 422 refusal, non-JSON, and a
well-formed body of the wrong shape — five distinct states, no two collapsing, each with retry where
`canRetryRequest` allows it.

**AC-9 — the page fetches the listing on mount and no artifact text until a reader selects a file.**
`ticket.md` and `runs.log` are the two exceptions and are fetched on mount because the page renders
them; every other file is fetched on selection, and every row shows its byte size beforehand. A failed
file request does not erase a loaded listing or relabel the ticket as missing, and navigating to a
different id renders nothing from the previous one.
*Test:* mounting against a fixture whose folder holds a 1 MB artifact issues exactly three requests and
none is for that artifact; selecting it issues one more. **Shown red** by a version that prefetches.
A second fixture asserts a failed file request leaves the listing and the tab set rendered.

**AC-10 — tabs are derived from the listing's top-level segments, not from a fixed list.**
Every top-level directory segment is a tab, `ticket.md` is a tab, and any other top-level file is a
tab. `ticket.md` is selected first: it is the only file present on all 107 tickets, and an empty
selection would be the blank panel `04-architecture.md` forbids.
*Test:* a fixture carrying `adapter-probe.md` beside the usual directories renders a tab for it; a
fixture with no `solution/` renders no Solution tab and no empty one; a four-level path renders its
full path, so `dev/development/run-4/green-report-iter-1.md` is reachable and distinguishable from
`dev/chore/run-2/implement-iter-1.md`, and two `run-N` directories stay distinct rather than being
merged into one implied round. Plus a source assertion that the component holds **no literal list of
tab names** — **shown red** by introducing one. The measured bound of §0.3 is asserted in place: a
fixture whose `solution/` exists and is empty renders no tab, with the reason in the test's own name.

**AC-11 — `runs.log` renders down the side, as text, and its absence says so.**
Present on 91 of 107 tickets; the 16 without one get a sentence naming what is absent and why, never
an empty rail and never a request failure. It is not parsed into links.
*Test:* a fixture with a run log renders its lines; one without renders the sentence, **asserted by
rendered text rather than by a node count**; and a source assertion that nothing turns a `runs.log`
line into a link.

**AC-12 — artifact text renders as escaped preformatted text, and no dependency is added.**
*Test:* a fixture file whose text contains `<script>alert(1)</script>`, a raw `&` and an
`onerror=` attribute fragment renders those characters visibly and creates no element, attribute or
handler from them, asserted over the DOM; and `apps/web`'s manifest gains no dependency, asserted
against the merged tree.

**AC-13 — the registered route set, the route register and the architecture document move together.**
`package.test.ts`'s derived route register gains both literals, and `docs/04-architecture.md` gains a
sentence for each in its `packages/server` list and an updated `apps/web` paragraph — that section's
own rule is that *"a route added without a sentence here is a failing test rather than a document
going stale"*, and its current text still says the ticket page *"needs a route that answers for one
ticket"*. `routes.ts`'s ticket row has `screenExists` set the way the board's is, and `app.tsx`
selects the screen by comparing against an **exported route constant**, on `BOARD_PATH`'s own
precedent, never against a literal.
*Test:* the existing derivation asserts the new set; removing either sentence from the document turns
it red **by name**; and a source assertion that `app.tsx` holds no quoted route path.

**AC-14 — the three findings Q-0017's truncated review could not see are closed.**
Three clauses, each with its own test, in the files this ticket already opens.
- **(a) `packages/shared/src/wire.ts:157,164`** — `not-contained.ahead` and `unpushed.ahead` gain
  `.nonnegative()`, matching `count` (`:50`) and `pendingGates` (`:126`) in the same file. A commit
  count from `rev-list --count` cannot be negative, and the inconsistency teaches a reader the wrong
  rule about which counts are constrained. *Test:* each schema rejects `-1` with a message naming the
  field and accepts `0`; the `z.ZodType<ContainmentResult>` and `z.ZodType<PushLagResult>` annotations
  still hold.
- **(b) `packages/server/src/read.ts:68`** — **the current behaviour is ratified, not changed.**
  `billedCostOf` keeps `?? 0`, so an all-unpriced history sums to `0`. Three reasons, in order of
  weight. **`WireTicket`'s own JSDoc already rules this question** — *"`billedCostUsd` is `null` where
  nothing has run, and never `0` … It carries no vendor breakdown and no count of unpriced runs: a
  ticket file records one figure and cannot see its own incompleteness, so what names that is
  `COST_LEGEND`"* — so answering `null` would contradict a documented wire contract and owe a decision
  entry for a case with **zero instances**. **The mixed case is the same shape at higher frequency**:
  a history with one priced and one unpriced entry already renders a partial sum as a total, and
  neither candidate proposes changing that, so ruling the all-unpriced case differently would leave
  one module applying two rules to one question. And **the field is `billedCostUsd`**: for a ticket
  every run of which was codex, nothing *was* billed, and `null` would collapse *nothing has run* with
  *everything was unpriced*, which are different facts. *Test:* a history whose every entry cost is
  `null` renders `0`, in a test named for the case; the JSDoc gains the all-unpriced consequence
  explicitly, because today it states the per-entry rule and leaves the reader to compose it — which
  is why this was carried to the gate as a defect.
- **(c) `packages/shared/src/docs.test.ts:1702`** — the case named *"so they cannot drift apart"*
  matches each string independently against `/same-origin/i`, `/absolute URL/i` and `/font host/i` and
  never compares the two, while its comment says they are *"held against each other rather than each
  against a paraphrase"*. The needles are real, so the test is not vacuous; the comment's account of
  the mechanism is false. **Correct the title and comment to the weaker property actually enforced**,
  which is the cheaper and more honest of the two repairs — comparing two prose sentences written by
  two documents for equality is a check that would fail on a legitimate edit. **Do not delete the
  needles**: they are the anti-vacuity half. *Test:* the corrected title and comment no longer claim a
  comparison, and the three needles are each shown red by removing the corresponding phrase from one
  side.

---

## 5. Non-goals

Each is refused for a reason, not merely omitted.

1. **The backlog board.** Q-0017's, shipped. This inherits its fetch module, request-state vocabulary
   and shared wire schemas and builds none of them again.
2. **Fixing Q-0060.** The parser still falls open; AC-3 refuses the damaged ticket **at the HTTP
   boundary** without touching it. `parseFrontmatter` also reads role files, which is why it is not a
   passing fix.
3. **Any write.** No edit, no stage move, no run start, no gate answer, no repair of a damaged file.
   Both routes are `GET`, and `read.ts`'s existing *"it writes nothing"* property is preserved.
4. **A Markdown renderer, syntax highlighting, or a sanitiser dependency.**
5. **Parsing `runs.log` into links.** Deciding what a run id links to is Q-0018's screen.
6. **Mission control, the gate screen, run-history drill-down.** Q-0015, Q-0016, Q-0018.
7. **Any cap, truncation, pagination, range request or streaming.** §0.2 is the argument: laziness
   plus a visible size is what stands in for a cap, and an unstated cap is what Q-0128 exists for.
8. **The review-diff cap itself.** Q-0128's, opened at Q-0017's close. §7 R-2 says how it bears on
   this ticket without this ticket growing it as a second subject.
9. **A per-vendor cost figure.** The roll-up that could split by vendor is per **run**
   (`GET /history/:id`'s `tokensByVendor`), not per ticket. The page carries the one figure the board
   carries, with the same legend.
10. **Caching a ticket's folder anywhere.** The app holds no copy by design and the daemon stores
    nothing; a listing carrying byte sizes goes stale exactly as a git fact does.
11. **`dirOf`'s preserved non-deterministic prefix match.** Charter §2, Q-0043, Q-0059 non-goal 1.
12. **Changing `readFiles`.** Every flow's `input.backlog` depends on it; AC-2 adds beside it.

---

## 6. Open questions

**None blocks solutioning.** Three are ratifications carried to the gate, each with a recommendation
and the reasoning behind it, so an implement step meets a decision rather than a question.

**GO-1 — does the `.harness/` ruling owe a decision entry? Owner: the human, at the gate.**
**Recommendation: no entry is owed, and the ruling belongs in the listing function's own JSDoc plus
one sentence in `04-architecture.md`.** `.harness/` is untracked, so it is not in the database, and
excluding it is *"files are the database"* applied rather than contradicted; nothing here reverses a
landed entry and no glossary term moves. **The one answer that would owe an entry is the opposite
one** — serving engine run state from a backlog route makes `.harness/` part of what the backlog
surface means, which is a product statement. It is carried as a gate obligation rather than as a
blocker because it is ruled here: what remains is ratification. **Settle it before the implement step
runs.** `developer-generalist` may not write an entry, and this repository has fifteen recorded
instances of a loop handed work no step on its route can perform — Q-0062 paid three rounds for one
after its own requirement named the hazard in advance.

**GO-2 — is a term coined, and is *manifest* available? Owner: the human, at the gate.**
**It is not, and this is a real collision.** `docs/GLOSSARY.md` uses *manifest* for a run's manifest
under **Run history**, and **Occurrence** is defined as *"one entry in a run manifest's record"*.
Codex's document uses *manifest* throughout for the ticket-folder listing, which would introduce a
homograph for an existing term — what `docs-and-decisions.md` forbids in as many words.
**Recommendation: coin nothing and edit no glossary.** Name the shapes for what they carry — a detail
response with a `files` array of `{rel, bytes}`. Ratify so an implementer does not reach for the
obvious word.

**GO-3 — is the whole-file fatal decode ratified as the binary instrument? Owner: the human, at the
gate.** **Recommendation: yes**, on §0.4's mechanical reason rather than on a measured failure of the
alternative — the two agree on all 1,269 files today, and what separates them is that the proxy needs
a byte count from a read that cannot supply one. Ratifying it is what makes AC-2's second `core`
function necessary rather than convenient; refusing it collapses AC-2 to one function and puts a
stated residual in AC-6.

**Answered here, recorded so they are not re-asked.** Which tab opens first — `ticket.md` (AC-10).
Where the listing function lives — beside `readFiles` in `backlog.ts`, so the exclusion rule and the
confinement it shares are readable in one place. Whether the response carries a `directories` array —
no (§0.3).

---

## 7. Risks

**R-1 — fourteen criteria is at the upper end, and the seam is named in advance rather than
discovered.** Q-0121 at thirteen closed in one implement round with no findings; Q-0125 at thirteen
in two. Q-0126 at sixteen took **five rounds and $177.92**; Q-0122 at twenty took three and $101.88.
**If the loop exhausts, AC-14 is the only eligible trim**, and trimming it means opening a successor
**with all three clauses transcribed in full** — they already survived one review that could not see
them, and an obligation left in a closed ticket's prose is what Q-0110, Q-0111 and Q-0112 each cost a
rediscovery. No other criterion is eligible: AC-3 to AC-6 are the confinement and refusal surface,
which §3 is the argument for not trimming, and AC-2 is what the two routes stand on.

**R-2 — this change will be reviewed against a truncated diff, and that is predictable rather than
hypothetical.** `repo.max_diff_bytes` is 200,000 and truncates head-only. Q-0017 was 2,828 insertions
and truncated on **all three** rounds at 83.8%, 79.4% and 76.9%, the no-patch set growing 6 → 8 → 9.
Two routes, two `core` functions, a screen and their tests will land in that range. **`git diff`
orders by path**, so the tail is the same every round: here that is `packages/server/src/read.ts` and
`packages/shared/src/wire.ts` — the two files AC-14's findings are in, and the two this ticket's own
body says were missed last time. Q-0116's warning names the omitted files on the event stream, so the
operator can see it during the run; **the mitigation is a hand pass over exactly those files before
the gate, cross-vendor**, on Q-0079's and Q-0124's precedent. Q-0128 owns the cap.

**R-3 — the URL collides with nothing, and that was checked rather than assumed.** Q-0120's B-1 was a
prefix collision between the shell's routes and the daemon's proxied prefixes. `DAEMON_ENDPOINTS`
holds `/runs`, `/project`, `/tickets`, `/flows`, `/history`; the shell path `/backlog/:ticketId` is a
prefix of none and is not forwarded, and both new routes sit **under an already-forwarded prefix**, so
the dev server needs no change and `bypassNavigation` already steps aside for a page load.

**R-4 — a file can change between the listing and the read.** The file response therefore carries the
size of the bytes it actually read, and the listing's size is **not** a consistency guarantee. Stated
in the route's JSDoc. It is also why AC-6's instrument decodes the bytes it read rather than comparing
against a second `stat` (§0.4), and why `no-such-file` is a reachable status rather than a dead row.

**R-5 — a very large preformatted text node renders slowly.** Accepted and bounded: the reader chooses
a 1.46 MB file with its size in front of them, and nothing else on the page is affected. The layout
must keep the rail and the file selector reachable when a tab holds 61 files or a file has long
unbroken lines — asserted as a rendering property, never by changing what a file contains.

**R-6 — a reader switching between two files re-fetches both.** Accepted, and it is the app's existing
rule rather than a new cost: it holds no cache by design, requests are loopback, and the median
artifact is small. A cache would be the UI holding a copy of a file that can change under it, which is
what the board already refuses for a git fact.

**R-7 — `.DS_Store` appears inside a ticket folder the first time somebody opens one in Finder.**
Today the only non-UTF-8 file under `backlog/` sits outside every ticket folder. AC-4's leading-dot
rule excludes it before AC-6 is ever reached. Both guards cover it, and that is deliberate rather than
redundant: one is about what the route chooses to serve and the other about what it can characterise.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter is invoked, no subscription read, no key path, no environment variable, no fixture or documentation example carrying one. |
| **Worktree safety** | n/a, and stronger than n/a: every route is a `GET`, no code path writes, and `read.ts`'s existing *"it writes nothing"* property is preserved — the module gains two readers and no writer. No flow behaviour changes. |
| **Gate behaviour** | n/a. No gate, no run, no answer. |
| **File format and schema** | Two new wire shapes in `@quorum/shared` **with runtime schemas** (AC-7), and one tightening of two existing ones (AC-14a). No file on disk changes format; `ticket.md`, `runs.log` and every artifact are read as they are. `ticketSchema` and `parseFrontmatter` are untouched — AC-3's validation happens in the route, above the parser. |
| **Lint rules** | n/a. No flow file changes, so `lintFlow` gains nothing and `quorum lint` is unaffected. |
| **Cross-vendor rule** | n/a. No adapter, role or flow changes. |
| **Cold-clone impact** | **No new dependency** (AC-12), so `pnpm install` does not grow. The daemon gains two routes and no start-up work; the bundle gains one screen. `@quorum/web` and `@quorum/server` are tarballs four and five since Q-0124, so a packed install serves this page with no packaging change. |
| **Product-agnostic** | n/a. Nothing here knows about any SaaS product; every fixture is a synthetic ticket folder. |
| **Documentation** | `docs/04-architecture.md`'s `packages/server` route list gains one sentence per route and its `apps/web` paragraph replaces *"needs a route that answers for one ticket"* (AC-13). `docs/05-design-prompt.md` gains a divergence note on the tab model, on the pattern Q-0017 set. **`docs/GLOSSARY.md` is not edited** if GO-2 is ratified as recommended. |
| **Verification** | Both environment rows, forced: the implement worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge — `pnpm install --frozen-lockfile` then `pnpm turbo run test --force --continue`, plus `pnpm lint`, `pnpm typecheck`, `quorum lint` and the git-identity sweep. |

---

## 9. Provenance

**Claude supplied the frame and four of the rulings that survived.** Its §0 measurement discipline,
the two-route shape argued from a measured payload, the derived tab set with `adapter-probe.md` as the
file a fixed list loses, the three legitimate U+FFFD files that refute the obvious binary test, the
`isOneName`/`TicketFile` barrel gaps, the *manifest* glossary collision, the no-cap ruling, R-3's
proxy check and R-6's prefix-match check are all its. Its fourteen-criteria sizing is this document's,
and its R-1 naming AC-14 as the only trim seam is kept verbatim in substance.

**Codex supplied the refusal table and the testing rigour.** The status-and-code matrix, the insistence
that a confinement refusal is never collapsed into a 404, the malformed check applying **before either
route returns ticket data**, the whole-file fatal decode, the chunk-boundary case, the
manifest-size-is-not-a-guarantee risk, the long-content layout criterion, the no-persistence clause and
the explicit both-navigations requirement are all its. Its twenty-eight criteria are cut to fourteen:
AC-25's test enumeration is distributed into the criteria it belongs to, AC-26 to AC-28 become §8,
and AC-1, AC-12, AC-14, AC-17 to AC-21 are folded rather than dropped.

**Five things are neither candidate's**, each from re-deriving against the merged tree:
(1) `readFiles` **cannot enumerate a ticket folder at all**, so the single-route shape is unbuildable
rather than merely expensive, and Claude's "refused alternative" does not exist (§0.1);
(2) the ticket body's *"absent and empty are already distinguishable"* is false in both halves, and
Codex's `directories` array is refused because **zero empty directories exist and git cannot track
one** (§0.3);
(3) the fatal decode is taken over the byte-length proxy on a **mechanical** reason — the proxy needs a
byte count from a read that cannot supply one — while recording that the two agree on all 1,269 files,
so the choice is not presented as fixing an observed miss (§0.4);
(4) AC-14(b) is ruled in Claude's direction on evidence **neither candidate cited** — `WireTicket`'s
own JSDoc already rules the `n/a`-never-`0` question and defers incompleteness to `COST_LEGEND`, so
Codex's AC-22 would contradict a documented wire contract without a decision entry, and the mixed case
is the same shape at higher frequency that neither candidate proposes changing;
(5) Codex's 415 is replaced by 422 on the shipped `malformed-manifest` precedent, and `no-such-file` is
kept narrow and given a real window rather than being a dead row.

**One of my own measurements was wrong and is recorded rather than dropped.** A first pass reported a
second non-UTF-8 file *inside* a ticket folder; `iconv` rejects it and Node's `TextDecoder` accepts it,
and the file is valid. The body's and Claude's count of one stands. It is written into §0.4 because it
is a constraint on the fixtures: a UTF-8 verdict must be taken with the decoder that will serve the
bytes.

**Two of Claude's specifics are corrected rather than carried.** Its §2.5 compares the decoded text
against **the listing's** stat size, which is two moments (§0.4, R-4). Its AC-13 requires `app.tsx` to
select screens from the register so *"a third screen needs no new branch"*; that is a refactor of
shipped code beyond this ticket, and the existing precedent — comparing against an exported route
constant, as `BOARD_PATH` already is — delivers the property the register's own rule asks for. AC-13
requires the precedent, not the refactor.
