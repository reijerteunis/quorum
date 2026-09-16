# Q-0017 — Backlog board and ticket page

*Requirements, run 1, merged, iteration 2, 2026-09-16. Iteration 1 returned `needs-input` on two
blockers. The tree has not moved — `docs/decisions/` still ends at 096, the ticket body is unedited,
no erratum exists, Q-0126 is still the highest allocated id — so this pass re-measured every claim
either blocker rested on rather than re-asserting it, which is what *"a retry on an unchanged tree
cannot rule its own blocker"* (Q-0090, Q-0096, Q-0105) asks of a second pass. **Every iteration-1
measurement held and every one of its recommendations is carried unchanged. What moved is where two
of them sit, and two defects were found that iteration 1 did not have — one of them in iteration 1's
own criteria.** §10 records the reclassification in full.*

---

## §0 — What was measured, and what it changes

### 0.1 — The daemon registers twelve routes, and `GET /runs/:id/cost` does not exist

The ticket body lists thirteen and names `/runs/:id/cost` among them. Every route literal in the
package's production source:

| | |
| --- | --- |
| `http.ts:167,194,206,212,227` | `POST /runs`, `GET /runs`, `GET /runs/:id`, `POST /runs/:id/gate`, `POST /runs/:id/stop` |
| `read.ts:76,82,97,120,140` | `GET /project`, `GET /tickets`, `GET /flows`, `GET /history`, `GET /history/:id` |
| `serve.ts:150` | `GET /runs/:id/events` |
| `static.ts:264` | `GET /*` |

**Twelve.** The string `runs/:id/cost` occurs once in the package, at
`packages/server/src/package.test.ts:726`, inside a fixture named `hostile` written to prove the
route-deriving guard collects a route it has never seen. A grep finds it, in a file about routes,
beside real ones — *a measurement copied from a document is not a measurement*, with a **test
fixture** standing in for the document.

**It is also in `docs/06-development-plan.md:3790`**, a human-owned page, which is where the ticket
body took it from. GO-8, and an observation rather than work.

What does exist is `GET /history/:id`, answering `tokensByVendor` — per-vendor **tokens**, per run,
from the manifest's roll-up, and deliberately not cost, `read.ts` citing *"Codex cost is reported as
tokens, never priced locally"* (2026-08-22) in place. §0.6 is why that matters.

### 0.2 — The board's data is served; the ticket page's is not

`GET /tickets` answers `WireTicket` — `id`, `title`, `stage`, `owner`, `branch`, `containment` —
plus the repository's push lag, both git facts derived per request and stored nowhere
(`read.ts:60–72`). `GET /flows` answers `name`, `runnable`, `consumes`, `produces`, `problems`.
Between them that is everything `quorum board` prints.

**Nothing reads a ticket's folder.** `packages/server/src/read.ts` contains no folder read at all.
`core` can already do it — `Backlog.readFiles(ticket, pattern)`
(`packages/core/src/backlog/backlog.ts:266`) is on the barrel and Q-0059 confined it, refusing a
traversing pattern rather than answering `[]` — so **the primitive exists and the route does not**.
That is the shape Q-0014 met when it found `packages/server` unimportable, and that gate split the
ticket at exactly this seam. OQ-1.

### 0.3 — `apps/web` has never made an HTTP request, so four first-things arrive at once

`grep "fetch(" apps/web/src apps/web/test` returns nothing. Q-0120 built a **WebSocket** client, not
a fetch. This ticket is therefore the app's first request, first response parser, first
request-failure vocabulary and first not-yet-loaded moment, in a package whose architecture section
says *"No placeholder is a blank panel, a spinner or a skeleton, and none shows a fabricated
project, run, ticket or cost"* (`docs/04-architecture.md:289` — the ticket body and both candidates
cite `:200`, stale and harmless). **That is the largest single piece of work here and the ticket body
does not mention it.** AC-3 to AC-6.

The transport is ready: `daemon-endpoints.ts` already holds `/tickets` and `/flows` as same-origin
prefixes, the dev proxy already forwards them and already steps aside for a page navigation
(Q-0120 B-1), and the daemon's `GET /*` already sits ahead of the JSON routes (Q-0122).

### 0.4 — Three shipped artifacts say this app fetches nothing, and this change makes all three false while every assertion stays green

**Found this iteration; in neither candidate and not in iteration 1.**

`apps/web/test/source.test.ts:369` is a live criterion in the shipped suite:

```js
describe('AC-10 — loading the shell fetches nothing from a network', () => {
  const NETWORK_LITERALS = [`http:${'//'}`, `https:${'//'}`, `${'//'}fonts.`];
```

Its assertions scan every file in the package for those three **literals**, and `:450` pins in as
many words that *a same-origin path does not trip them*. So `fetch('/tickets')` passes the scan
cleanly — which is why AC-3's *Test:* clause is sound and needs no new guard.

**What does not survive is the claim.** The block's title says the shell *"fetches nothing from a
network"*; `docs/04-architecture.md:288` says *"nothing is fetched from a network"*; both are
enforced by a scan that can only see a URL literal. The moment `daemon-client.ts` calls
`fetch('/tickets')` the app fetches on every board load, the title and the sentence are false, and
**all six assertions under them go on passing.** That is a check whose name outlives its subject —
*"A check outlives its subject only if it can still fail"* (2026-09-05) at the level of the claim
rather than the assertion, and the class this repository records most often.

The enforced property is narrower and always was: *no absolute URL, no third-party host, no font
host; every request the app makes is same-origin and page-relative*. That is true today, stays true
after this change, and is what both artifacts should say. AC-4.

### 0.5 — Iteration 1's own `unpricedRuns` is structurally zero, and contradicts the legend beside it

**The second thing found this iteration, and it is a defect in iteration 1's own AC-2.**

That criterion added `unpricedRuns`, counting history entries whose `cost` is `null`, *"so a total
can say how much of itself it cannot see"*. Measured across the whole backlog:

| | |
| --- | --- |
| history entries carrying a `cost` | **254** |
| of those, `null` | **0** |
| `board.ts:183` | `(meta.history ?? []).reduce((t, e) => t + (e.cost ?? 0), 0)` — `?? 0` collapses a null anyway |

So `unpricedRuns` is **0 for every ticket in this repository**, structurally, and would render
*"0 unpriced"* on a card whose legend one line away says *"steps on token-only vendors (codex) are
not included"*. **Two contradictory claims about the same number, on the same card.** The field was
invented to make the figure honest and does the opposite. Struck in AC-2; the legend already does
that job, and `board.ts:212`'s own comment says so — *"First of the legends, because it is the only
one that explains something MISSING"*.

### 0.6 — The cost fork, measured to the point where it rules itself

Iteration 1 called this blocking. The measurements below are what let it be ruled instead (OQ-2).

| | |
| --- | --- |
| manifests read | **145**, 0 unreadable · 64 distinct `ticket_id` |
| billed occurrences carrying usage | **666** |
| of those **unpriced** | **276 — 41.4%** |
| unpriced by vendor | claude **0 of 390** · codex **276 of 276** |
| tickets with a history cost and **no manifest** | **5** — Q-0006, Q-0008, Q-0011, Q-0033, Q-0034 — **$199.80** |
| tickets with a manifest and no history cost | Q-0017 itself — history is written at run end |
| the two figures, where both exist | agree to a cent |

A real roll-up, from `Q-0126-2`:

```json
{ "vendor": "claude", "step_count": 5, "unpriced_steps": 0, "cost_usd": 159.847 }
{ "vendor": "codex",  "step_count": 4, "unpriced_steps": 4, "cost_usd": null    }
```

**So the number `ticket.md` records for that run is the claude column alone**, carried unqualified.
And `rollup`'s own JSDoc (`packages/core/src/run-history/manifest.ts:195`) states the governing rule,
already landed in `core`:

> *"No cross-vendor total is produced here or anywhere: one blended number is fiction the moment a
> vendor that reports no price is in the mix."*

That settles the shape of the answer rather than the preference: **there is no honest single
per-ticket cost figure to compute**, from either source, because for codex a *cost* does not exist —
its contribution is tokens. What the aggregate would give a card is two rows, one of which is
`cost_usd: null`. What the ticket file gives is one number that is the claude row with the codex row
silently dropped, which is exactly what `quorum board` prints today and exactly what its legend
exists to disclose. Ruled in OQ-2.

### 0.7 — A wire schema stricter than the on-disk schema makes a legal ticket unrenderable

Codex's AC-5 requires `iterations` values to be non-negative integers.
`packages/shared/src/ticket.ts:89` declares `iterations: z.record(z.string(), z.number()).optional()`
— a float or a negative is legal on disk. And `read.ts` sends `stage: String(ticket.meta.stage)`,
which for a `ticket.md` `parseFrontmatter` fell open on is the literal `"undefined"`.

**A wire schema refusing either turns a ticket the product's own schema accepts into a board that
does not render** — the opposite of what both candidates' unknown-stage criterion asks for. Neither
candidate saw it. AC-1 carries the rule.

### 0.8 — Ten columns, not eight, and a brief-shaped board loses four tickets today

`docs/05-design-prompt.md:27` names eight. `packages/shared/src/stages.ts` declares **ten**, adding
`blocked` and `abandoned`. Census: **91 `reviewed`, 10 `draft`, 4 `abandoned`, 105 total**, and
nothing at all in the other six. A board built from the brief drops four tickets on this
repository's own backlog on the day it ships, silently, and `blocked` is legal with no member today
that would drop the next one. The brief describes a mockup written 2026-08-22; `STAGES` is the
vocabulary.

### 0.9 — Two flows consume `requirements`, so the brief's button is ambiguous at exactly one stage

`chore` (requirements → reviewed) and `solutioning` (requirements → solutioned) both consume it.
`board.ts` resolves that with `flows.find((flow) => flow.consumes === stage)` over records sorted by
filename, so `chore` wins on `c` < `s`, and its JSDoc calls the determinism a deliberate divergence.
**Correct for a hint, wrong for a control**: chore-versus-full-pipeline is the most consequential
routing choice in this product — M2's closing entry measures the seven-stage route as exercised by
four tickets against 55 chore runs — and a button taking it silently would institutionalise the
default that measurement exists to question. Also: `deployed`, `qa-passed`, `blocked` and
`abandoned` are consumed by nothing, and `qa-final` and `deploy` have no file at all (Q-0012).

### 0.10 — The design brief is the third document promising the override, and the first still uncorrected

`docs/05-design-prompt.md:11` (*"advances, re-runs, or overrides"*), `:35` (*secondary "Advance
anyway" (override, requires a one-line reason)*) and `:43` (*override → reason input appears*),
against `gateAnswerSchema = z.enum(['advance','retry','abort'])` with `gateAnswerEnvelopeSchema`
`.strict()` over it. Q-0013's gate found the claim in `04-architecture.md:63` and in the development
plan's M3 line; Q-0118 corrected those two and recorded *"GO-2 is fully discharged"* — said of two
documents while a third was never looked at. The brief is what **every** screen ticket is built
from, so Q-0015, Q-0016 and Q-0018 each inherit it. AC-15.

### 0.11 — The ticket page's payload is unbounded, and that is why it is a different ticket

`readFiles` returns `fs.readFileSync(file, 'utf8')` for every match, with no cap. Largest ticket
folder **3.0 MB** (`Q-0083`); largest single file **1.46 MB** with a 1.40 MB sibling; 61 files in a
modern folder (`Q-0120`); 25 MB of backlog. A route answering "the folder" builds a 3 MB JSON body
and hands a browser 1.4 MB of text for one tab. **That is Q-0076's subject arriving on the
backlog**, where it has never been stated, and it makes the route's *shape* a design question rather
than a wiring one. With it: the folder has been run- and iteration-scoped since Q-0086 to Q-0089, so
*"Review — rounds as columns"* is two levels; and a hidden `.harness/` directory sits in 68 ticket
folders holding 259 **untracked** verdict files that `readFiles`'s walk includes. All Appendix A's.

---

## §1 — Problem

`quorum open` starts the daemon and opens a browser (Q-0126), the daemon serves the built app
(Q-0122), and the app answers all twelve of its routes. **What a maintainer sees at `/backlog` is a
sentence saying the screen does not exist yet.** The one place this product answers *what is open,
and where is the code* is `quorum board` in a terminal, which is the surface M3 exists to replace.

The data has been served since Q-0119 and nothing in the browser has ever asked for it. Under that
sits a structural gap the board is the first thing to hit: `WireTicket` is a bare interface at
`packages/server/src/read.ts:50` with `containment: unknown`, so a browser has nothing to parse a
response against — and a `JSON.parse` result assigned to an interface is the silent default
`.claude/rules/engineering.md` forbids. Q-0121 settled the arrangement for exactly this, moving
`WireRefusal` and `WireRun` to `@quorum/shared` **each with a schema**. `WireTicket` is next and has
not moved.

And the board is where two surfaces begin answering one question. Every rule `quorum board` settled
at cost — which empty columns render, when a missing branch is worth saying, that a containment
token is never called "merged", that push lag may warn and may never reassure, that a cost figure
travels with the legend naming what it cannot see — is a rule the screen either inherits from one
register or re-derives beside it. **Re-derived, they drift**, and this repository has recorded that
failure often enough to name it.

## §2 — User stories

**`maintainer`** — *I open the board and see, per stage, what is there, which tickets have code
actually in `main`, and which have looped. I do not open a terminal to find out what is open, and I
do not wonder whether the browser is showing me something it measured or something it assumed.*

**`maintainer`** — *A ticket's branch is not contained in `main`. The board says so in the words
`quorum board` uses, under the same suppression rule, so I never reconcile two surfaces that
disagree about my own repository.*

**`maintainer`** — *I click a ticket and land on its page. The page is not built yet and says so,
naming the ticket that builds it — so I can tell "not yet" from "broken".*

**`adopter`** — *I ran `quorum init` and `quorum open` on my own repo. The board shows three empty
columns rather than nothing at all, so I can tell "the backlog is empty" from "this screen is
broken". Nothing on it claims my code was validated anywhere.*

**`adopter`** — *I open the browser with no daemon behind it, or stop the daemon while the board is
open. The screen tells me what it asked for and what happened, in a sentence, and offers the one
action that could help. It does not spin.*

**`contributor`** — *I add a field to a ticket or a route to the daemon. One schema in
`@quorum/shared` says what crosses the wire, both ends import it, and a field added without one is a
failing test rather than a browser silently rendering nothing.*

## §3 — Acceptance criteria

**Fifteen** — the ceiling `harness/roles/head-of-product.md` names as the rare maximum, reached and
not passed, and up one from iteration 1 because §0.4 found a criterion that was owed. They cover
**the board half only**; the ticket page is Appendix A and OQ-1 recommends it as a successor.

**That the board half alone reaches fifteen is an argument for the split rather than against it**:
refusing it puts the ticket at **twenty-two**, past the twenty-one at which Q-0091 and Q-0096 were
each cut at a gate and at cost.

**A criterion's *Test:* clause bounds the instrument.** A reviewer may find the instrument fails the
job that clause gives it, and may not raise the job — *"An adapter records the version it was
verified against"* erratum E-1 (2026-09-08), sixth instance in this cut.

### Where the shapes live

**AC-1 — the two listings this board reads are `@quorum/shared` shapes with schemas, and no wire
schema is stricter than the on-disk one.**
`packages/shared/src/wire.ts` gains `WireTicket`, `WireTicketList` (the rows plus the repository's
push lag), `WireFlow` and `WireFlowList`, each with a schema a browser can execute;
`packages/server` re-exports the names so its barrel is unchanged and no definition is written twice
— Q-0121's arrangement, which `wire.ts`'s own header already names as the way. `containment` stops
being `unknown` and is typed `ContainmentResult | null`; push lag is `PushLagResult | null`. Both
are already declared in that package.
**The second clause is the load-bearing half (§0.7).** `stage` is `z.string()` at the wire and not
`stageSchema`, and `iterations` is the same bare number record `ticketSchema` declares, because
`GET /tickets` sends `String(ticket.meta.stage)` — the literal `"undefined"` for a damaged ticket —
and a float or negative counter is legal on disk. A wire schema stricter than the disk schema makes
a ticket this product accepts unrenderable; naming a non-member stage is **AC-8's** job, not the
parser's.
*Test:* both schemas accept a live response from a real project. The ticket schema **accepts**
`stage: "undefined"` and `iterations: {review: 1.5}`, and **refuses** an unknown key and an absent
`stage`. The flow schema accepts a refused flow — `runnable: false` with non-empty `problems` —
which Q-0055 AC-16 requires be named rather than hidden. Shown red by restoring
`containment: unknown`, which makes the closed-state clause unassertable, and by narrowing `stage`
to `stageSchema`, which turns the damaged-ticket case red.

**AC-2 — `WireTicket` carries what the card renders and nothing it cannot support: `iterations` and
`billedCostUsd`, with `null` never meaning zero.**
`iterations` is copied verbatim — a widening of a field `TicketRecord.meta` already holds.
`billedCostUsd: number | null` is the sum `packages/cli/src/board.ts:183` already computes from
`meta.history[].cost`, **`null` where the ticket has no history at all**: nothing has run is not the
claim that it cost nothing, and `n/a`-never-`0` is the rule this repository applies to every other
measure.
**No `unpricedRuns` field and no per-vendor field (§0.5, §0.6).** A count of null-cost history
entries is **0 for all 254 entries in this backlog** and would assert *"nothing unpriced"* beside a
legend saying codex is excluded; the ticket file cannot see its own incompleteness and must not
claim to. What names it is AC-10's legend, which exists and already says the right thing.
That `quorum board` prints `$0.00` for both an absent history and a zero is a divergence **recorded
in place and not fixed here**: this ticket changes no byte the CLI prints.
*Test:* three fixtures — no `history` key → `null`; history whose every `cost` is `0` → `0`; two
priced entries → their sum. A scan asserts `WireTicket` declares no field naming a vendor and no
field naming an unpriced count. Shown red by defaulting the absent case to `0`, which collapses the
first two.

### The app's first request

**AC-3 — one module performs every request, it names no host and no scheme, and every body is parsed
before anything reads it.**
A new `apps/web/src/daemon-client.ts` is where every request in this app is made. Paths come from
`DAEMON_ENDPOINTS` and nowhere else; no absolute URL literal is written; every response is validated
with AC-1's schemas and a body that fails validation is a **refusal state**, never a partly rendered
board.
*Test:* the package's existing whole-corpus network-literal scan covers the new module, **asserted
by naming it in that corpus rather than assumed** — and it admits the new call by construction, a
same-origin path tripping none of its three needles, which `source.test.ts:450` already pins. A unit
test drives an injected `fetch` returning a body with `stage` removed and asserts the client answers
the refusal state rather than a ticket list. Shown red by casting the parsed JSON instead of parsing
it, and by writing an absolute URL into the new module, which the scan reports by file name.

**AC-4 — the artifacts claiming this app fetches nothing are narrowed to the property they enforce,
rather than left to go false in silence.**
**This ticket is the first `fetch` in `apps/web` (§0.3), and §0.4 measured what that breaks.**
`apps/web/test/source.test.ts:369` is titled *"AC-10 — loading the shell fetches nothing from a
network"* and `docs/04-architecture.md:288` says *"nothing is fetched from a network"*; both are
enforced by a scan for the literals `http://`, `https://` and `//fonts.` alone. After this change
the app fetches on every board load, both claims are false, and **all six assertions under them go
on passing.** Both are re-stated as the property that is enforced and was always what was meant —
*no absolute URL, no third-party host, no font host; every request is same-origin and
page-relative* — and the `theme.css` reasoning about fonts, which stays true, is left alone.
**No assertion is weakened**: the three needles, the licence subtraction and its both-directions
test are unchanged.
*Test:* the describe title and the architecture sentence both state the same-origin property and
neither states that nothing is fetched; a guard holds the two wordings against each other so they
cannot drift apart; and the scan is shown to still have a subject *after* the title moves — an
absolute URL added to `daemon-client.ts` fails by file name, a `fetch('/tickets')` does not. Shown
red against the file and the document as they stand today, whose wording fails the first clause.

**AC-5 — the request state is a closed set, no member of which is silence, none of which is a
spinner, and the board never polls.**
A discriminated union in `connection-state.ts`'s shape, with a member and a sentence for each answer
the browser can get: in flight, loaded, the daemon could not be reached, the daemon refused, the
body did not parse. **The in-flight member renders a sentence rather than a spinner or a skeleton**
(`docs/04-architecture.md:289`). The loaded member carries the instant it was fetched **and the
screen shows it**, because containment and push lag are derived per request and stored nowhere
(`read.ts:60–72`), so a board loaded ten minutes ago is showing a git fact that was true ten minutes
ago. An explicit refresh action exists; nothing is cached, persisted in browser storage, or polled
on a timer.
*Test:* a pure reducer test over every member and every transition — each renders a non-empty
sentence, and no transition reaches a state with neither text nor an action. A rendering test
asserts the fetched-at instant is in the page's text. A scan finds no interval-based refetch and no
`localStorage` or `sessionStorage`. Shown red by adding a member with an empty sentence.

**AC-6 — a daemon that is not there and a daemon that refuses are different sentences, and each
names what was asked for.**
Unreachable names the path the browser asked for and says that starting the daemon is the action. A
refusal renders the daemon's own `condition` **unaltered** — *"A `core` error names the condition;
the remedy belongs to the surface"* (2026-09-07) — with the remedy composed here. Neither collapses
into the other: the `no daemon` / `no such run` separation Q-0120 made for the socket, at the second
surface.
*Test:* an injected `fetch` that rejects, and one answering a `WireRefusal` body. The two rendered
texts differ, each contains the requested path or the condition respectively, and the retry action
is offered on both. Shown red by rendering one sentence for both.

### The board

**AC-7 — the columns are `STAGES`, and which empty ones render is one register both surfaces read.**
Ten columns in `STAGES` order. A stage holding no ticket renders only if it is one of the three a
fresh project must show — `draft`, `requirements`, `solutioned` — which is `board.ts:107`'s private
`ALWAYS_RENDERED`. That constant moves to `@quorum/shared` and `board.ts` imports it, so the CLI and
the screen cannot answer differently. The brief's eight-column list is **not** the vocabulary (§0.8)
and the divergence is recorded where the component declares the columns.
*Test:* over a fixture backlog holding one `abandoned` ticket and nothing in `red` — the `abandoned`
column renders with its ticket, `red` does not render, `draft` renders empty. A second assertion
imports the register in both packages and asserts one identity. Shown red by taking the brief's
eight, which drops a column holding four of this repository's own tickets.

**AC-8 — a ticket whose stage is not a member of `STAGES` is named, and never dropped, defaulted or
filed.**
`GET /tickets` can answer `stage: "undefined"` for a `ticket.md` `parseFrontmatter` fell open on,
and `quorum board` drops such a ticket from every column — so a damaged ticket is not rendered
wrongly, it is **rendered nowhere**, on the one surface whose job is to answer what is open. The
board renders it in a region naming the ticket (its `id`, or its folder where the id is unreadable
too) and saying its stage could not be read. **This repairs nothing**: no frontmatter is parsed,
validated, migrated or rewritten here, and Q-0060 stays open and untouched. What it stops is the
screen becoming the second surface that hides it.
*Test:* a fixture response carrying `{"id":"undefined","stage":"undefined", …}` — the rendered page
contains a sentence naming it, and no column contains it. Shown red by filtering the list to
`STAGES` members, which is the CLI's behaviour today and renders nothing at all.

**AC-9 — a card carries the id, title, owner, containment token and counters; it is one link to the
ticket route; a missing optional value says so and is never a sample.**
Counters render as the map holds them — `review 1`, `chore.review 2` — and **never as `1/3`**: the
denominator is `max_iterations` inside a flow's step (`packages/shared/src/flow.ts:141`) and
`GET /flows` carries no steps, so a denominator would be a number nobody measured, which
`docs/04-architecture.md:289` forbids by name. An empty `iterations` renders no counter region
rather than an empty one. An absent `title` or `owner` renders an explicit not-set string and never
an invented value. The whole card is **one** link to `/backlog/<encoded id>`, reachable and
activatable from the keyboard, with no nested interactive element inside it. The divergence from
`docs/05-design-prompt.md:27` is recorded where the component declares the counters.
*Test:* a card over `iterations: {review: 1}` contains `review` and `1` and matches no
`/\b\d+\s*\/\s*\d+/`. A card with `owner: ""` shows the not-set string. Keyboard activation
navigates to the percent-encoded path. A scan finds no interactive element nested inside the card's
link.

**AC-10 — the cost figure and the sentence naming what it cannot see are one thing, and neither
renders without the other.**
`billedCostUsd` renders as a dollar figure where it is a number and as `n/a` where it is `null`.
Wherever any figure renders, the board also renders the legend `board.ts:220` already prints —
*billed cost where the vendor reports one; steps on token-only vendors (codex) are not included*.
**The figure is not labelled "cost to date" and is not labelled or split per vendor.** Measured over
this repository, **276 of 666 billed occurrences — 41.4%, every one of them codex — are unpriced**
(§0.6), so the figure omits two fifths of the work and the legend is the only thing that says so. No
blended token-and-dollar number anywhere: *"Codex cost is reported as tokens, never priced locally"*
(2026-08-22), and `rollup`'s own rule that no cross-vendor total is produced here or anywhere.
*Test:* a board with at least one priced ticket renders the legend; a board where every ticket is
`null` renders neither figure nor legend. A scan asserts no token count renders beside a dollar
figure and that the phrase "cost to date" appears nowhere in `apps/web/src`. Shown red by rendering
the figure with the legend removed.

**AC-11 — the containment token is `quorum board`'s vocabulary and `quorum board`'s suppression
rule, from one register.**
`main:contained`, `main:not-contained(+12)`, `main:indeterminate(<reason>)`, and the words "merged",
"landed" and "shipped" appear nowhere (`docs/GLOSSARY.md`). A `no branch` reason renders only where
the stage claims the work is done — `board.ts:117`'s `BRANCH_EXPECTED`, which moves to
`@quorum/shared` beside `ALWAYS_RENDERED` and is read by both. The `indeterminate` legend says git
could not answer and **never** that the code is missing.
*Test:* the three states render their three tokens; a `draft` ticket with `no branch` renders no
token and a `reviewed` one does; a scan of `apps/web/src` finds none of the three forbidden
synonyms; the register is imported in both packages and asserted one identity. Shown red by
rendering `no branch` unconditionally, which puts a token on ten `draft` rows today.

**AC-12 — push lag renders as at most one legend, it may warn, it may never reassure, and it borrows
none of containment's grammar.**
`pushed` and `no remote` render **nothing**. Every other state renders one line naming the base, its
upstream and the count, carrying *as of the last fetch*. No `<base>:` token, no per-card annotation,
and no wording equivalent to "CI passed", "validated" or "up to date" — *"The board reports push
lag, and never a CI conclusion"* (2026-09-06).
*Test:* every state the union permits; the two silent cases render nothing and the rest render one
line; a scan asserts no rendered push-lag text matches containment's token shape and none matches a
register of reassuring phrases. Shown red by rendering a line for `pushed`.

**AC-13 — the board names every flow that consumes a stage, offers no control that starts one, and
issues nothing but `GET`.**
A column names **all** its consuming flows where more than one exists — `chore` and `solutioning`
both consume `requirements` (§0.9) — and a column no flow consumes says so, so *no flow consumes
this* stays separable from *the flow could not be read* (Q-0055 AC-16). A flow whose `runnable` is
`false` is named as unreadable with its problems and carries no invitation to run it. **Nothing this
screen adds writes, edits a ticket, moves a stage, answers a gate, starts a run or takes a run
lock.**
*Test:* the `requirements` column names both flows; the `deployed` column says no flow consumes it;
a refused flow is named with its problems. A scan of `apps/web/src` finds no HTTP method other than
`GET` and no reference to any `POST` route. Shown red by taking `flows.find(…)`, which names one
flow where two consume.

### The shell, and the documents

**AC-14 — the route register gains no path, and exactly one rail entry flips.**
`/backlog` renders the board. `/backlog/:ticketId` **keeps its placeholder**, with its `ticket` and
`waitingFor` fields re-aimed at whichever ticket Appendix A becomes — both rows carry
`ticket: 'Q-0017'` today (`apps/web/src/routes.ts:95,101`), and leaving the second there after this
ships would name a closed ticket as the one that builds it. `RAIL`'s `backlog` entry becomes
`screenExists: true` and no other does. No component names a route the register does not hold, which
`apps/web/test/routes.test.ts` already enforces and which covers the new files by construction.
*Test:* the existing register scan; exactly one `RAIL` entry is `true`; `/backlog/:ticketId` still
carries a `waitingFor` sentence and a `ticket` naming a ticket folder that exists.

**AC-15 — `docs/05-design-prompt.md` stops promising a control the engine refuses, and records what
this board deliberately does not build.**
The three override sites — `:11`, `:35`, `:43` — are corrected to the three answers
`gateAnswerSchema` permits, on the terms `04-architecture.md` and `06-development-plan.md` already
carry, **each of the three naming the other two** so the discharge is complete this time rather than
two-thirds complete (§0.10). `:27`'s board paragraph records the four measured divergences: ten
columns rather than eight, counters without a denominator, a billed figure that is neither
per-vendor nor cost-to-date, and named flows rather than a button.
*Test:* `packages/shared/src/docs.test.ts` — the brief carries no "override" or "Advance anyway" in
a gate context, and the three documents' answer sets agree. Shown red against the file as it stands
today, which fails on all three sites.

## §4 — Non-goals

1. **The ticket page and `GET /tickets/:id`** — Appendix A, recommended as the successor in OQ-1.
   `/backlog/:ticketId` keeps its placeholder.
2. **Fixing Q-0060.** Nothing here parses, validates, migrates or rewrites `ticket.md`. AC-8 renders
   the consequence; the defect is untouched and stays open.
3. **Starting a run from the browser.** No `POST` from this screen. The brief's "Run next flow ▸"
   button is refused with reasons (§0.9, AC-13), and starting a run needs somewhere to watch it,
   which is Q-0015's.
4. **A per-vendor or run-history-derived cost roll-up.** Ruled in OQ-2 and routed to **Q-0015**,
   whose cost ticker is where `05-design-prompt.md:33` specifies a per-vendor figure in the one form
   the tokens-only decision permits, and where a run is already the unit.
5. **Widening `GET /flows` to carry loop bounds**, which is what a `1/3` denominator needs.
6. **Mission control (Q-0015), the gate screen (Q-0016), run history drill-down (Q-0018), resumable
   runs (Q-0019), the flow and harness editors (Q-0020, Q-0021).**
7. **Any change to `quorum board`'s rendered output.** Three constants move to `@quorum/shared` and
   `board.ts` imports them; not one printed byte moves, which AC-7, AC-10 and AC-11 assert.
8. **Polling, caching or persisting anything in the browser** (AC-5).
9. **Coining a glossary term** — OQ-4.
10. **The projects home, the top bar's not-loaded regions and the disabled global control.** They
    stay exactly as Q-0014 left them; this ticket fills one route, not a shell.
11. **Weakening the network-literal scan.** AC-4 narrows a *claim*; the three needles, the licence
    subtraction and its both-directions test are unchanged, and a new exclusion is refused.
12. **Codex's AC-31 to AC-33 are struck as criteria.** "Tests cover the behaviour", "the suites,
    lint, typecheck and build pass", and the cross-cutting constraint list are the standing
    definition of done for every ticket here — `.claude/rules/engineering.md` and §7 below. A
    criterion restating them adds a row and no coverage.

## §5 — Open questions

**None blocks solutioning.** Iteration 1 carried two as blockers; §10 records why neither survives
re-measurement in that form, and both recommendations are unchanged.

**OQ-1 — one ticket or two. Recommended, and the gate's to ratify; not blocking.**
The board half is fifteen criteria. Adding the ticket page adds a server route, a confinement
surface, a payload design forced by a 3.0 MB folder (§0.11), a `.harness/` exposure ruling over 259
untracked files, a tab model over a layout the brief predates, the 404/422 separation, and the
screen — six to eight criteria on the most favourable count, which is **twenty-two**. Q-0013 was
refused at eighteen; Q-0091 and Q-0096 split at twenty-one; Q-0122 accepted twenty and paid three
implement rounds; Q-0126 accepted sixteen and paid five. The codex candidate proposed
**thirty-three** in one ticket, which is more than twice this role's ceiling.
**The halves also differ in kind**, which is the argument that does not depend on counting: the
board is a screen over two endpoints that already exist; the ticket page is a new server route
*plus* a screen, with its own confinement and payload design. Q-0014's gate split this exact work at
this exact seam, and Q-0013's split at the transport seam.
**Recommendation: two, in this order.** *(a)* **Q-0017**, the board — the fifteen criteria above,
which also build the fetch module, the request-state vocabulary and the schema arrangement. *(b)*
**Q-0127**, the ticket page — Appendix A, verbatim, run second **because** it inherits (a)'s client
and schemas; run in parallel it builds them again, which is two registers free to drift. **Not
three**: splitting the route from the screen leaves two thin tickets where one at about twelve
works, and the route has no consumer to prove it against.
**Why this is not a blocker.** This document exists in one form — fifteen criteria, a coherent and
shippable half, with the successor written out in full — and solutioning can start on it as written
whichever way the gate rules. If the gate refuses the split, Appendix A promotes to AC-16 onward by
erratum at that gate, which is Q-0122's shape and is named in GO-1. What the gate must still do is
**allocate and open Q-0127**, which no step in this flow may perform: GO-3. *Owner: the gate.*

**OQ-2 — which cost figure the card carries. Ruled here, and the gate may overturn.**
Iteration 1 called this blocking and **both candidates were wrong about why** (§0.6): claude ruled a
per-vendor figure impossible from the data, and `VendorRollup` carries `vendor`, `cost_usd`,
`step_count` and `unpriced_steps`, so it is not; codex treated the aggregation as obviously right
and did not measure what it costs or what it cannot see.
**Ruled on three authorities rather than preference.** *(i)* `rollup`'s own JSDoc — *"No
cross-vendor total is produced here or anywhere: one blended number is fiction the moment a vendor
that reports no price is in the mix"* — so **neither source yields an honest single per-ticket
figure**, the aggregate giving two rows of which codex's is `cost_usd: null`. *(ii)* The
measurement: the two figures agree to a cent wherever both exist; the aggregate is blind to five
tickets worth **$199.80** whose runs predate `.quorum/runs`; the ticket file is blind to a run in
flight; and a manifest scan adds O(145) reads per board request, over a store Q-0076 records as
uncapped, on top of containment's per-ticket git probes. *(iii)* §1's own principle: the screen
showing a different cost from `quorum board` for the same ticket is the two-surfaces-disagreeing
failure that the three moved constants exist to prevent.
**The ruling: the ticket-file figure, with `board.ts`'s legend, labelled neither per vendor nor cost
to date, and no `unpricedRuns` field** (§0.5) — AC-2 and AC-10 as written. The per-vendor roll-up is
routed to **Q-0015**, where the brief already specifies one in the admissible form: *Claude $3.84 ·
Codex 226k tokens, unpriced — never one blended number*.
**If the gate overturns, it does so one of two ways and neither is left to an implementer.** Wanting
a genuine per-vendor figure here strikes AC-2's cost field and AC-10 entirely, and the card renders
**no** cost — a successor carries it. Wanting the manifest aggregate makes `GET /tickets` read run
history and owes a measurement of what that costs before it is written. *Owner: the gate, to ratify
or overturn — GO-2.*

**OQ-3 — does anything here owe a decision entry? No, and GO-4 records it.**
Measured against every candidate. Moving wire shapes to `@quorum/shared` is Q-0121's precedent and
that file's stated purpose. Moving `ALWAYS_RENDERED` and `BRANCH_EXPECTED` so two surfaces read one
register is the arrangement `docs/04-architecture.md` already describes. The cost ruling **applies**
*"Codex cost is reported as tokens, never priced locally"* (2026-08-22) and `rollup`'s landed clause
rather than extending either. AC-4 narrows a claim to the property a landed guard already enforces,
changing no behaviour. Refusing the run button is a scope choice. Where the screen renders `n/a` for
an absent history against the CLI's `$0.00`, it is the screen obeying that entry where the CLI
diverges from it — a divergence to record in place, not to rule.

**OQ-4 — the request-state set must not become a second glossary term.**
Q-0120 coined **Connection state** for the socket. AC-5's set is about HTTP and is **not** that;
naming it would either coin a term — which reaches `CLAUDE.md`'s term list, the human's to write
(Q-0103 erratum E-2) — or introduce a synonym, which `docs-and-decisions.md` forbids.
Recommendation: described in JSDoc, named in no document, with one line in its module header saying
it is not connection state. *Owner: the gate. Not blocking.*

**OQ-5 — where the `blocked` and `abandoned` columns sit.**
AC-7 fixes the *set*; the arrangement is layout. Both are terminal in the sense that no flow
consumes them, and four tickets are `abandoned` today. Any answer satisfies AC-7, which is about
membership. *Owner: the implementer, reported in the summary.*

## §6 — Risks

**R-1 — four first-things arrive at once (§0.3).** Response parsing, a failure vocabulary, a
not-yet-loaded moment and a refresh action, in a package with no precedent for any. Mitigated by
shaping AC-5 and AC-6 on `connection-state.ts`, a pure reducer that can be asserted by value over
every transition rather than by rendering.

**R-2 — the first screen with real data, so a wrong token is worse than none.** A token saying
`contained` when it is not tells a maintainer their code landed. AC-11 takes both the vocabulary and
the suppression rule from one register rather than re-deriving them, which is the only mitigation
that does not depend on someone remembering.

**R-3 — `GET /tickets` is not cheap, and a poll would make it the app's hot path.** It walks the
backlog and probes git per ticket; `containment`'s JSDoc puts the budget at up to 2n + 10 spawns,
which at 105 tickets is the order of a third of a second. Acceptable on mount, unacceptable every
few seconds. AC-5's *never polls, explicit refresh* is this risk's mitigation as much as it is an
honesty rule, and OQ-2's ruling keeps a 145-manifest scan off the same path.

**R-4 — three constants move out of `packages/cli`, a package this ticket is otherwise not about.**
Three declarations and two imports, and AC-7 and AC-11 each assert the CLI's output is
byte-identical. The alternative — the screen declaring its own copies — is two registers free to
drift, the failure this repository has recorded most.

**R-5 — refusing the brief's most visible control reads as an omission.** "Run next flow ▸" is what
a reviewer will look for on a card. §0.9 and AC-13 record the reasons in place so the refusal is
legible as a decision rather than as work not done.

**R-6 — AC-4 edits a guard, and a guard edited during the change it guards is the shape to watch.**
It narrows a *title* and a *document sentence* and touches no assertion, needle or fixture, which is
why non-goal 11 states the boundary and why its *Test:* clause requires the scan be shown to still
have a subject afterwards. Q-0126's hand review found this operator's own guard green over a
commented-out `spawn` hours after it was written to close that class.

**R-7 — the review diff may not reach the reviewer whole.** `harness/harness.yaml:24` sets
`max_diff_bytes: 200000`, and four consecutive tickets were reviewed at 64–75% of their subject.
Since Q-0124 `materialiseDiff` emits a `warn` naming the files it gave no patch for. `git diff`
orders by path, so `apps/web/**` sorts first and `packages/shared/**` and `packages/cli/**` — the
schemas and the three moved constants — are what a head cut hides. GO-5.

**R-8 — a first-round approve on a screen is worth distrusting.** 74% of chore reviews return
`revise`, and a codex reviewer under `--sandbox read-only` cannot execute the suite. GO-6 requires
mutation.

## §7 — Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a and load-bearing by omission. No path here reads an environment variable or accepts a credential; the board renders no subscription state and the top bar's region stays not-loaded. |
| **Safety by construction** | Load-bearing. AC-13: nothing on this screen issues a request that is not a `GET`. No worktree, no branch, no run, no run lock. `read.ts:8` — *"It writes nothing, and that is a boundary rather than an omission"* — and this ticket keeps it. |
| **Human-gated by default** | Unchanged. No gate is answered, presented or auto-advanced, and the answer vocabulary stays three — AC-15 removes the last document that says otherwise. |
| **Files are the database** | Load-bearing. Nothing is persisted or cached: the board derives from one request, shows when it was fetched, and refreshes only when asked (AC-5). Containment and push lag stay derived per request. |
| **Cross-vendor rule** | n/a — no flow, role or adapter changes. |
| **Product-agnostic** | Load-bearing. Nothing here names a SaaS product; the brief's `acme-billing` and `northwind-crm` are mockup fixtures and no fixture here may borrow one. |
| **The cold-clone test** | Positive and small. No dependency, no install step, no command, no change to either claimed installation path. `apps/web` already emits and is already packed (Q-0124), so an adopter's first `quorum open` gains a working screen where it had a placeholder. |
| **Errors are explicit** | AC-5 and AC-6: a closed state set, no member silence, an unparseable body a refusal rather than a partly rendered board. AC-1 refuses a malformed row rather than defaulting it — and refuses nothing the disk schema accepts. AC-8 names a ticket the vocabulary cannot place rather than dropping it. |
| **File format / schema** | `@quorum/shared` gains four wire schemas and three constants move into it. **No on-disk format changes** — `ticket.md` is read exactly as today, through the same cast (Q-0043 AC-4). |
| **Lint rules** | None added. ESLint already covers `apps/**/*.ts` and, since Q-0014, `.tsx`; the existing `apps/web/test` scans cover every new `src/` file by construction. |

## §8 — Gate obligations

**GO-1 — ratify OQ-1's split before the run.** The criteria are written for the recommendation. If
the gate keeps one ticket, Appendix A promotes to AC-16 onward **by erratum at this gate**, and that
erratum should say what twenty-two costs rather than presenting it as fine — Q-0122's E-1 is the
shape, and its own prediction that the size is paid in review rounds came true twice.

**GO-2 — ratify or overturn OQ-2's cost ruling.** If overturned, strike AC-2's cost field and AC-10
outright rather than letting an implementer choose between two incomplete figures. A card rendering
a number nobody ruled is the fabricated value `docs/04-architecture.md:289` forbids.

**GO-3 — if the split is taken, open the successor here rather than in a closing entry**, at
**Q-0127** (the highest allocated id is Q-0126), with Appendix A as its body verbatim, and re-aim
`routes.ts`'s `/backlog/:ticketId` row at it per AC-14. Three obligations in one week — Q-0110,
Q-0111, Q-0112 — lived only inside a closed ticket's prose or a source comment, one of them for five
days; Q-0105 is the counter-example. **No step in this flow may create a ticket folder.**

**GO-4 — record that no decision entry is owed and no glossary term is coined** (OQ-3, OQ-4). If the
gate disagrees on either, the entry lands **at this gate**: no step on the chore route may write
one, and a loop handed work no agent in it can perform is the pattern this repository has recorded
sixteen times.

**GO-5 — read the review's truncation warning rather than assuming the panel saw the change** (R-7).

**GO-6 — do not bank a first-round approve.** Show at least these red by mutation, each failing with
a message that names what it is about: the brief's eight columns (AC-7 — drops a column holding four
tickets), `flows.find` in place of naming all consumers (AC-13), the cost figure with its legend
removed (AC-10), an unconditional `no branch` token (AC-11), `containment: unknown` restored (AC-1),
`stage` narrowed to `stageSchema` (AC-1's stricter-than-disk clause), and an absolute URL written
into `daemon-client.ts` (AC-4 — which must fail by file name, proving the scan still has a subject
after its title moved).

**GO-7 — verify forced in both environment rows after the merge** (Q-0072's closing finding): in a
worktree that has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main`. Then run the
product — `quorum open`, and read the board against this repository's own 105 tickets, including the
four `abandoned` ones, which are the rows the brief would have lost.

**GO-8 — correct `docs/06-development-plan.md:3790`**, which names `GET /runs/:id/cost` as a route
answering cost per run. It does not exist (§0.1), and that sentence is where this ticket's body took
the error from. The page is the human's, so it is recorded here rather than given to a step that may
not write it.

## §9 — Provenance

**The claude candidate is the base**, and its §0 measurement pass is why: every claim I could check
against the tree held — twelve routes, the `hostile` fixture behind the phantom thirteenth, ten
`STAGES` against the brief's eight, the 91/10/4 census over 105 tickets, no `fetch(` anywhere in
`apps/web`, both `chore` and `solutioning` consuming `requirements`, `flows.find` picking one, the
3.0 MB folder and 1.46 MB file, the `.harness/` directory and `backlog/.gitignore` re-including only
`runs.log`, and the three override sites in the brief. AC-1's schema arrangement, AC-3, AC-5, AC-6,
AC-7's shared register, AC-10's inseparable legend, AC-11, AC-12, AC-13 and AC-14 are substantially
its work, as is the structure of Appendix A.

**The codex candidate contributed five things the other did not have**, and each is in the merge:
card navigation with keyboard reach and no nested click target (AC-9); an explicit not-set string
rather than a sample value (AC-9); the instinct that an unpriced total must say so — which,
measured, became AC-10's 41.4% clause rather than the field it proposed; the
404/422/`malformed-ticket` separation with an endpoint-level field check, which is Appendix A's; and
the read-only boundary stated as a criterion rather than only as a non-goal (AC-13).

**Its scope was refused.** Thirty-three criteria in one vertical ticket is more than twice this
role's ceiling, and its own non-goals open by refusing the split — *"Splitting the board and ticket
page into separately deliverable tickets"* — which is the one question the ticket body asks the gate
to answer. Three of its criteria were struck as a class (AC-31 to AC-33): they restate the standing
definition of done for every ticket here.

**Four rulings are neither candidate's**, all from measurements taken at this gate.

*The wire may not be stricter than the disk* (§0.7, AC-1). Codex's AC-5 requires non-negative
integer counters; `ticketSchema` accepts any number, and `GET /tickets` sends
`String(ticket.meta.stage)`, which is `"undefined"` for a damaged ticket. Either narrowing turns a
ticket this product accepts into a board that does not render — the opposite of what both
candidates' unknown-stage criterion asks for.

*The cost fork resolves against both candidates' reasoning* (§0.6, OQ-2). Claude ruled per vendor
impossible from the data; `VendorRollup` carries it, so it is not. Codex treated the aggregation as
obviously right; measured, the two figures agree to a cent wherever both exist, the aggregate is
blind to five tickets worth $199.80, the ticket file is blind to a run in flight, and `rollup`'s own
JSDoc forbids a cross-vendor total anywhere — so **neither source yields an honest single figure**,
and what makes the one this product already prints admissible is the legend beside it.

*`unpricedRuns` is structurally zero* (§0.5). Iteration 1's own field, invented to make the figure
honest, counts null-cost history entries — of which this backlog has **0 of 254** — so it would
assert *"nothing unpriced"* beside a legend saying codex is excluded. Struck.

*Three artifacts claim the app fetches nothing, and this change makes all three false in silence*
(§0.4, AC-4). `source.test.ts:369`'s criterion title, `04-architecture.md:288`'s sentence, and a
scan that can only see URL literals. Found by reading the guard AC-3's *Test:* clause depends on
rather than citing it.

## §10 — What iteration 2 changed, and why

**The tree has not moved**, and this pass says so before anything else: `docs/decisions/` still ends
at 096, the ticket body is unedited, no `requirements/errata.md` exists, and Q-0126 is still the
highest allocated id. So the question was whether iteration 1's two blockers survive re-measurement
— *"a retry on an unchanged tree cannot rule its own blocker"* (Q-0090, Q-0096), with Q-0105 and
Q-0013 as the two cases where the second pass found something anyway.

**Every iteration-1 measurement held, and every recommendation is carried unchanged.** Neither
reversal below is on the merits; what moved is where they sit, which is Q-0105's formula exactly.

**OQ-1 reclassifies from blocking to a gate obligation.** Iteration 1 carried it **twice** — as a
BLOCKING open question and as GO-1 plus GO-3 — which is Q-0105 B-1's shape, *a complete document
read as a blocked one*. Measured against precedent, every needs-input on a split here refused a
**document** that was over the ceiling: Q-0091 at twenty-one, Q-0096 at twenty-one, Q-0013 at
eighteen, Q-0122 at twenty, Q-0126 at sixteen. This document is fifteen, covering a coherent half
that ships on its own, with the successor written out in full. The matching precedent is the other
one: **Q-0121 and Q-0059 both returned `ready`** carrying a GO that opens a successor from a
transcribed body — Q-0123 and Q-0113 respectively, both opened at their gates and neither lost. The
recommendation, the seam, the order and the Q-0127 allocation are all unchanged; they sit in OQ-1
and GO-1/GO-3 instead of stopping the document.

**OQ-2 reclassifies from blocking to ruled**, and this one *is* on new evidence. Iteration 1 left it
open because neither candidate's reason survived and it read as a genuine fork. Re-measuring found
the sentence that closes it — `rollup`'s *"No cross-vendor total is produced here or anywhere"*,
already landed in `core` — which means the fork was never between a right figure and a wrong one but
between two incomplete ones, only one of which costs nothing and only one of which agrees with the
surface already answering the question. That is a pick this role is for. The alternative is recorded
with what it would cost, and GO-2 leaves it overturnable.

**Two things were found that iteration 1 did not have.** Its own `unpricedRuns` field is structurally
zero (§0.5), and three shipped artifacts claiming the app fetches nothing go false in silence when it
starts fetching (§0.4). The first removed a field; the second added AC-4 and took the count from
fourteen to fifteen. **That increase strengthens OQ-1's recommendation rather than weakening it**:
refusing the split now yields twenty-two, past the twenty-one at which Q-0091 and Q-0096 were each
cut.

---

## Appendix A — the successor's body, written out in full

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
