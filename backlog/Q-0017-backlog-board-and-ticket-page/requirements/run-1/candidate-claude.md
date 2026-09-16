# Q-0017 — Backlog board and ticket page

*Requirements, run 1, candidate-claude, 2026-09-16. Every measurement below was taken against the
tree on 2026-09-16 and is cited by file and line. Where it contradicts the ticket body, the body was
re-measured rather than trusted — this session's record is that a body written from a plan line gets
corrected by its own requirements run at full price, and this one was corrected in nine places.*

---

## §0 — What the body says, and what the tree says

The ticket body was written against the tree on the day it was opened and is right about most of it.
Nine things are wrong or missing, and three of them change what the ticket is.

### 0.1 — There is no `GET /runs/:id/cost`. The daemon registers twelve routes, not thirteen

The body lists thirteen routes and names `/runs/:id/cost` among them. Measured, every route literal
in the package's production source is:

| | |
| --- | --- |
| `http.ts:167,194,206,212,227` | `POST /runs`, `GET /runs`, `GET /runs/:id`, `POST /runs/:id/gate`, `POST /runs/:id/stop` |
| `read.ts:76,82,97,120,140` | `GET /project`, `GET /tickets`, `GET /flows`, `GET /history`, `GET /history/:id` |
| `serve.ts:150` | `GET /runs/:id/events` |
| `static.ts:264` | `GET /*` |

**Twelve.** `docs/04-architecture.md` names twelve and its own suite derives the set from the source
to prove it, so the document and the code agree and the ticket body is the only thing that does not.

**Where the phantom route came from is the part worth keeping.** `runs/:id/cost` appears exactly
once in this repository, at `packages/server/src/package.test.ts:726`, inside a string called
`hostile` — a fixture invented to prove that the route-deriving guard collects a route it has never
seen:

```js
const hostile = "app.get('/runs/:id/cost', (c) => c.json({}));\napp.delete('/runs/:id', …);";
```

A grep for the path finds it, in a file about routes, next to real ones. That is *a measurement
copied from a document is not a measurement* with a **test fixture** as the document — the same
shape as Q-0099's transcribed *"exists nowhere under `spike/test/`"*, and it took one `grep` to
refute. **Nothing in this product answers cost over HTTP per run**, and the body's cost paragraph
rests on a route that was never built.

### 0.2 — A per-ticket cost already exists, `quorum board` already renders it, and it cannot be per vendor

The body says per-vendor cost "is a roll-up over run history … and nothing answers per ticket".
Measured, `packages/cli/src/board.ts`'s `row()` is:

```ts
const cost = (meta.history ?? []).reduce((total, entry) => total + (entry.cost ?? 0), 0);
… `owner=${meta.owner} cost=$${cost.toFixed(2)} iter=${iterations}${annotation}`
```

So a per-ticket cost is derived **from the ticket file itself**, on every `quorum board`
invocation, and has been since Q-0099. It needs no run history, no manifest and no new route — the
data is in the frontmatter `GET /tickets` already reads.

**What it cannot do is split by vendor, and that is a property of the file rather than of the
reader.** `packages/shared/src/ticket.ts`'s `ticketHistoryEntrySchema` declares one field:

```ts
/** Billed cost in USD, or null. Null is "the vendor reported no price" … */
cost: z.number().nullable(),
```

One nullable number per history entry, and **no vendor field anywhere in the entry**. A run is a
mixed-vendor thing — this ticket's own flow runs claude and codex in one panel — so the number is
already an aggregate across vendors with the unpriced ones missing, which is why `board.ts` prints a
legend beside it:

> `· cost = billed cost where the vendor reports one; steps on token-only vendors (codex) are not included`

A genuinely per-vendor per-ticket figure would mean reading every manifest under `.quorum/runs`,
filtering by `ticket_id` and grouping `rollup` rows — an aggregation nothing performs, over a store
`GET /history` lists and does not sum. **That is a ticket, not a field**, and §5's OQ-2 says so.

### 0.3 — The brief's "review 1/3" denominator is on no wire

`docs/05-design-prompt.md:27` asks each card for *"iteration counters (review 1/3)"*. The numerator
is `ticket.meta.iterations`, a `Record<string, number>` the body correctly calls a widening. **The
denominator is a loop bound, and it lives in the flow file** — `packages/shared/src/flow.ts:141`'s
`max_iterations`, inside a step's `on_fail`.

`GET /flows` (`read.ts:97–118`) answers `{ name, runnable, consumes, produces, problems }` per
flow. **No steps, and therefore no bound.** So `1/3` is not computable from anything the daemon
serves today, and a card rendering `/3` would be rendering a number nobody measured — which
`docs/04-architecture.md:289` forbids by name. AC-9 renders the counters and refuses the
denominator, with the reason in place.

### 0.4 — The board has ten columns, not the brief's eight, and four tickets are `abandoned` today

`docs/05-design-prompt.md:27` names the columns as *"draft · requirements · solutioned · red · green
· reviewed · qa-passed · deployed"* — eight. `packages/shared/src/stages.ts` declares **ten**:

```ts
export const STAGES = ['draft', 'requirements', 'solutioned', 'red', 'green', 'reviewed',
  'qa-passed', 'deployed', 'blocked', 'abandoned'] as const;
```

Measured over this backlog on 2026-09-16: **91 `reviewed`, 10 `draft`, 4 `abandoned`**, 105 tickets.
A board built from the brief's list would **drop four tickets on this repository's own backlog on
the day it shipped**, silently, and `blocked` is a legal stage with no member today that would drop
the next one. The brief describes a mockup written 2026-08-22; `STAGES` is the vocabulary. AC-7
takes `STAGES`.

### 0.5 — `apps/web` makes no HTTP request at all, so this is the app's first one

`grep "fetch(" apps/web/src apps/web/test` returns **nothing**. Q-0121 recorded this as the reason
it made its own browser half a non-goal, and nothing has changed it: Q-0120 built a **WebSocket**
client, not a fetch.

So this ticket is the app's first request, first response parser, first request-failure state and
first not-yet-loaded moment — four things at once, in a package whose own architecture section says
*"No placeholder is a blank panel, a spinner or a skeleton"* (`docs/04-architecture.md:289`). **That
is the largest single piece of work here and the body does not mention it.** AC-4 to AC-6 are about
nothing else.

The ground is prepared: `apps/web/src/daemon-endpoints.ts` already holds `/tickets` and `/flows` as
same-origin prefixes, `vite.config.ts`'s proxy already forwards them and already steps aside for a
top-level navigation (Q-0120 B-1), and the daemon's `GET /*` already sits ahead of the JSON routes
(Q-0122). Nothing about the transport needs building. What needs building is the browser's half.

### 0.6 — Two flows consume `requirements`, so the brief's button is ambiguous at exactly one stage

`docs/05-design-prompt.md:27` asks for *"a 'Run next flow ▸' button enabled only when a flow consumes
that stage"*, which reads as though at most one does. Measured across `harness/flows/`:

| flow | consumes | produces |
| --- | --- | --- |
| `chore` | **requirements** | reviewed |
| `solutioning` | **requirements** | solutioned |
| `requirements` | draft | requirements |
| `qa-red` | solutioned | red |
| `development` | red | green |
| `review` | green | reviewed |

**Two consume `requirements`**, and `board.ts` resolves it with `flows.find((flow) => flow.consumes
=== stage)` over records sorted by filename — so `chore` wins on `c` < `s`, and the board prints
`→ quorum run chore <id>` for that column. The comment above `flowsIn` calls that determinism a
deliberate divergence, and it is correct for a *hint*.

It is not correct for a **button**. The chore-versus-full-pipeline choice is the most consequential
routing decision in this product — M2's closing entry measures the seven-stage route as exercised by
four tickets against 55 chore runs — and a control that took it silently would institutionalise the
default that measurement exists to question. AC-13 names the consuming flows and offers no control
that picks one.

Also measured: `deployed`, `qa-passed`, `blocked` and `abandoned` are consumed by nothing, and
`qa-final` and `deploy` do not exist at all (Q-0012). Four of ten columns have no next flow and two
of the seven promised flows have no file.

### 0.7 — The ticket page's payload is unbounded, and larger than the body assumes

The body says the primitive exists — `Backlog.readFiles` — and it does
(`packages/core/src/backlog/backlog.ts:266`). What it does not say is what that primitive returns:

```ts
const one = (file: string): TicketFile => { … return { rel, text: fs.readFileSync(file, 'utf8') }; };
if (pattern.endsWith('/')) return walk(joined).map(one);
```

**Every matched file, whole, decoded as UTF-8, with no cap of any kind.** Measured over this
backlog:

| | |
| --- | --- |
| largest ticket folder | **3.0 MB** (`Q-0083`, 3044 KB) |
| largest single file | **1.46 MB** (`Q-0083/review/hand-review-3.txt`) |
| second largest | 1.40 MB (`Q-0083/review/hand-review-2.txt`) |
| files in a modern folder | 61 (`Q-0120`) |
| whole backlog | 25 MB |

A `GET /tickets/:id` that renders "the folder as tabs" by returning the folder would build a **3 MB
JSON body in memory** and hand a browser 1.4 MB of text to lay out in one tab. That is **Q-0076's
subject** — *nothing in run history has a cap, and prompts are the largest thing in it* — arriving on
the backlog, where it has never been stated. It is the single strongest argument that the ticket page
is a different ticket with a different design question, and it is why Appendix A's shape is a
manifest plus a per-file read rather than one route that returns everything.

There are no binary files in `backlog/` today (871 `.md`, 256 `.json`, 90 `.log`, 19 `.txt`, 8
`.yaml`), so the UTF-8 decode is latent rather than live. Latent is not absent.

### 0.8 — The folder the brief describes is not the folder on disk

`docs/05-design-prompt.md:27` specifies the tabs as *"Requirements — candidate-claude /
candidate-codex / merged side by side; Solution …; QA …; Dev — integration notes; Review — rounds as
columns"*. That was written 2026-08-22. Q-0086, Q-0087, Q-0088 and Q-0089 then made every artifact
path run-scoped and iteration-scoped. `backlog/Q-0126-…/` today:

```
requirements/merged.md                      dev/chore/run-2/implement-iter-1.md   … -iter-5.md
requirements/errata.md                      dev/chore/run-2/integration.md
requirements/run-1/candidate-claude.md      review/chore/run-2/chore-iter-2.md    … -iter-5.md
requirements/run-1/candidate-codex.md       runs.log
requirements/run-1/merged-iter-1.md         ticket.md
requirements/run-1/merged-iter-2.md         .harness/run-2/implement-verdict-iter-1.json  …
```

Three things follow. **"Rounds as columns" is two levels, not one** — `run-N` then `iter-M`, and a
ticket can have several runs of the same flow. **A hidden `.harness/` directory sits inside the
ticket folder**, holding the engine's verdict files (Q-0089) — 256 JSON files across the backlog,
**untracked**, since `backlog/.gitignore` re-includes only `runs.log`. A `readFiles(ticket, '…/')`
walk includes dotfiles, so a naive "render the folder" exposes engine internals that are not in
git — under a rule that says *files are the database*, showing a file the database does not contain
is a decision, not a default. And **the tabs are not uniformly present**: across 105 tickets there
are 105 `ticket.md`, 90 `runs.log`, 70 `review`, 70 `requirements`, 64 `dev`, and **5 `solution` and
5 `qa`**. A Solution tab exists for one ticket in twenty-one. Absent and empty are different
answers, which is `readFiles`'s own rule one layer down.

### 0.9 — The body's third decision is already live on `GET /tickets`, and it is a disappearance

The body asks what a *ticket page* renders when a folder is unreadable. The exposure is already on
the **board's** endpoint and is worse than "renders as an empty ticket".

`parseFrontmatter` (`backlog.ts:81–85`) matches `/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/` and falls open
to `{ meta: {}, body: text }`; `read()` then casts, *"an assertion rather than a parse"*, deliberately
(Q-0043 AC-4). `read.ts:84–92` maps that with `String(ticket.meta.id)`, so the wire carries:

```json
{ "id": "undefined", "title": "", "stage": "undefined", "owner": "", "branch": "", "containment": null }
```

`containment` is `null` because `stateOf` answers `null` for a non-string (`git.ts:406`, and its
JSDoc says so). And `"undefined"` is a member of no column, so on `quorum board` **the ticket does
not appear at all** — the filter matches no stage. A damaged ticket is not rendered wrongly; it is
rendered nowhere, on the one surface whose job is to answer what is open.

Fixing Q-0060 is a non-goal and stays one. **Reproducing its disappearance is not**, and AC-8 forbids
it: a stage the vocabulary does not hold is named where a reader can see it.

### 0.10 — Two citations in the body are stale, and both are harmless

`04-architecture.md:200` is cited twice for the no-fabricated-placeholder rule; it is at **`:289`**
today, and the sentence is what the body says it is. `05-design-prompt.md:27` for the board card is
correct.

### 0.11 — The override finding is confirmed, and the brief is the third document

Verified: `docs/05-design-prompt.md:11` (*"advances, re-runs, or overrides"*), `:35`
(*"secondary 'Advance anyway' (override, requires a one-line reason)"*) and `:43` (*"override →
reason input appears"*), against `gateAnswerSchema = z.enum(['advance','retry','abort'])`.
`04-architecture.md` and `06-development-plan.md` both carry the correction and both name the other;
neither names this one. The body is right that every screen ticket inherits it. AC-15 closes it here
rather than leaving it for the fourth ticket, because it is three sentences in a document
`developer-generalist` may write.

---

## §1 — Problem

`quorum open` starts the daemon and opens a browser (Q-0126), the daemon serves the built app
(Q-0122), and the app answers all twelve of its routes. **What a `maintainer` sees at `/backlog` is
a sentence saying the screen does not exist yet.** The one place this product answers *what is open,
and where is the code* is `quorum board` in a terminal, which is the surface M3 exists to replace.

The data is served and has been since Q-0119. `GET /tickets` answers every ticket with its stage,
owner, branch and containment, and the repository's push lag beside them; `GET /flows` answers which
flows are runnable and what each consumes. Between them they are everything `quorum board` prints.
**Nothing in the browser has ever asked for either**, because `apps/web` has never made an HTTP
request at all.

Under that sits a structural gap the board is the first thing to hit. `WireTicket` is declared as a
bare interface in `packages/server/src/read.ts:50` with `containment: unknown`, so a browser has
nothing to parse a response against — and a `JSON.parse` result assigned to an interface is the
silent default `.claude/rules/engineering.md` forbids. Q-0121 settled the shape for exactly this:
`WireRefusal` and `WireRun` moved to `@quorum/shared` **each with a schema**, because *"a browser
must be able to execute the schema"* (`packages/shared/src/wire.ts:1–25`). `WireTicket` is the next
one and has not moved.

And the board is where two surfaces begin answering the same question. Every rule `quorum board`
settled at cost — which empty columns render, when a missing branch is worth saying, that a
containment token is never called "merged", that push lag may warn and may never reassure, that a
cost figure travels with the legend naming what it cannot see — is a rule the screen either inherits
from one register or re-derives beside it. **Re-derived, they drift**, and this repository has
recorded that failure often enough to name it.

## §2 — User stories

**`maintainer`** — *I have eleven tickets in flight across two vendors. I open the board and see, per
stage, which tickets are there, which ones have code that is actually in `main`, and which ones have
looped. I do not have to open a terminal to find out what is open, and I do not have to wonder
whether the browser is showing me something it measured or something it assumed.*

**`maintainer`** — *A ticket's branch is not contained in `main`. The board says so in the same words
`quorum board` uses, with the same suppression rule, so I never have to reconcile two surfaces that
disagree about my own repository.*

**`adopter`** — *I ran `quorum init` and `quorum open` on my own repo. The board shows three empty
columns rather than nothing at all, so I can tell "there is nothing in the backlog yet" from "this
screen is broken". Nothing on it claims my code was validated anywhere.*

**`adopter`** — *I start the browser with no daemon behind it, or I stop the daemon while the board
is open. The screen tells me what it asked for and what happened, in a sentence, and offers me the
one action that could help. It does not spin.*

**`contributor`** — *I add a route to the daemon or a field to a ticket. One schema in
`@quorum/shared` says what crosses the wire, both ends import it, and a field I add without a schema
is a failing test rather than a browser that silently renders nothing.*

## §3 — Acceptance criteria

**Fifteen**, which is the ceiling `harness/roles/head-of-product.md:13` names and not past it —
against the eighteen Q-0013 was refused at, the twenty-one that split Q-0091 and Q-0096, and the
twenty Q-0122 accepted and paid for in review rounds. They cover **the board half only**; the ticket
page is Appendix A and OQ-1 is the blocking question about it.

Each is independently testable. **A criterion's *Test:* clause bounds the instrument** — a reviewer
may find the instrument fails the job that clause gives it, and may not raise the job (Q-0067 E-1).

### Where the shapes live

**AC-1 — `WireTicket` and the ticket listing move to `@quorum/shared`, each with a schema, and
`containment` stops being `unknown`.**
`packages/shared/src/wire.ts` gains `WireTicket`, `wireTicketSchema`, `WireTicketList` (the listing
plus the repository's push lag) and `wireTicketListSchema`. `containment` is typed
`ContainmentResult | null` and `pushLag` `PushLagResult | null`, both already declared in that
package (`containment.ts:94`, `push-lag.ts:86`). `packages/server` re-exports the names so its barrel
is unchanged and the definition is not written twice — Q-0121's arrangement, and `wire.ts`'s header
already names this as the way.
*Test:* `packages/shared/src/wire.test.ts` — the schema accepts a real `GET /tickets` body and
refuses one whose `containment.state` is outside `CONTAINMENT_STATES`, whose `stage` is missing, and
which carries an unknown key. `packages/server/src/read.test.ts` — the live response parses under
`wireTicketListSchema`. Shown red by restoring `containment: unknown`, which makes the closed-state
clause unassertable.

**AC-2 — `WireFlow` and the flow listing move the same way.**
`GET /flows`'s row — `name`, `runnable`, `consumes`, `produces`, `problems` — becomes `WireFlow` in
`@quorum/shared` with a schema, and the listing `WireFlowList`. The board joins tickets to flows, so
it parses both, and one unparsed response is one silent default.
*Test:* as AC-1, over `GET /flows`, including a refused flow — `runnable: false` with a non-empty
`problems` — which the schema must accept, because Q-0055 AC-16 requires a refused flow to be named
rather than hidden.

**AC-3 — `WireTicket` carries the iteration counters and the ticket's own billed cost, and `null`
never means zero.**
Two fields are added. `iterations: Record<string, number>` is a widening of a field
`TicketRecord.meta` already holds. `billedCostUsd: number | null` is the sum
`packages/cli/src/board.ts`'s `row()` already computes from `meta.history[].cost`, with **`null`
where the ticket has no history at all** — nothing has run, which is not the same claim as "it cost
nothing", and rendering `$0.00` for both is the `n/a`-never-`0` rule this repository applies to every
other measure. That `quorum board` prints `$0.00` in both cases is a divergence **recorded in place
and not fixed here**: this ticket does not change the CLI's output.
*Test:* `read.test.ts` over three fixtures — a ticket with no `history` key (`null`), one with
history whose every `cost` is `null` (`0`, because entries exist and none was priced), and one with
two priced entries (their sum). Shown red by defaulting the absent case to `0`, which collapses the
first two.

### The app's first request

**AC-4 — one module owns fetching, it names no host and no scheme, and every response is parsed
before it is read.**
A new `apps/web/src/daemon-client.ts` performs every request in this app. Paths come from
`DAEMON_ENDPOINTS` and from nowhere else; no absolute URL literal is written; every body is validated
with the AC-1/AC-2 schemas and a body that fails validation is a **refusal state**, never a partly
rendered board.
*Test:* `apps/web/test/source.test.ts`'s existing whole-package network scan already forbids a
scheme literal and covers the new file by construction — asserted rather than assumed, by naming the
file in the corpus census. A unit test drives an injected `fetch` returning a body with `stage`
removed and asserts the client answers the refusal state rather than a ticket list. Shown red by
casting the parsed JSON instead of parsing it.

**AC-5 — the board's request state is a closed set, no member of which is silence, and none of which
is a spinner.**
A discriminated union in the `ConnectionState` shape (`apps/web/src/connection-state.ts:15`), with a
member for each answer the browser can get and a sentence for each: the request is in flight, it
succeeded (carrying **when**), the daemon could not be reached, the daemon refused, and the body did
not parse. **The in-flight member renders a sentence rather than a spinner or a skeleton** —
`docs/04-architecture.md:289`. The loaded member carries the instant it was fetched and the screen
shows it, because containment and push lag are derived per request and never stored
(`read.ts:60–72`), so a board loaded ten minutes ago is showing a git fact that was true ten minutes
ago. **An explicit refresh action exists and the board never polls.**
*Test:* a pure reducer test asserting every member renders a non-empty sentence, and that no
transition reaches a state with neither text nor an action — the `connection-state.test.ts` shape.
A rendering test asserts the fetched-at instant is in the page's text. Shown red by adding a member
with an empty sentence.

**AC-6 — a daemon that is not there, and a daemon that refuses, are different sentences, and each
names what was asked for.**
`no daemon` says which path the browser asked for and that starting the daemon is the action;
a refusal renders the daemon's own `condition` unaltered, per *"A `core` error names the condition;
the remedy belongs to the surface"* (2026-09-07), with the remedy this surface's. Neither is
collapsed into the other — the `no-daemon` / `no-such-run` separation Q-0120 made for the socket, at
the second surface.
*Test:* an injected `fetch` that rejects, and one that answers a `WireRefusal` body; the two
rendered texts differ, each contains the requested path or the condition respectively, and the
retry action is offered on both.

### The board

**AC-7 — the columns are `STAGES`, and which empty ones render is one register both surfaces read.**
Ten columns in `STAGES` order. A stage holding no ticket renders only if it is one of the three a
fresh project must show — `draft`, `requirements`, `solutioned`, today `board.ts`'s private
`ALWAYS_RENDERED`. That constant moves to `@quorum/shared` and `board.ts` imports it, so the CLI and
the screen cannot answer differently. The brief's eight-column list is **not** the vocabulary
(§0.4), and diverging from it is recorded in place.
*Test:* over a fixture backlog holding one `abandoned` ticket and nothing in `red`: the `abandoned`
column renders with its ticket, `red` does not render, `draft` renders empty. A second assertion
imports the register in both packages and asserts one identity. Shown red by taking the brief's
eight, which drops the `abandoned` column and its ticket.

**AC-8 — a ticket whose stage is not a member of `STAGES` is named, and never dropped or filed.**
`GET /tickets` can answer `stage: "undefined"` for a `ticket.md` `parseFrontmatter` fell open on
(§0.9), and `quorum board` drops such a ticket from every column. The screen renders it in a region
that names the ticket's folder and says its stage could not be read. **This does not repair
Q-0060** — nothing here parses, validates or rewrites frontmatter — it stops the screen from being
the second surface that hides it.
*Test:* a fixture response carrying `{"id":"undefined","stage":"undefined", …}`; the rendered page
contains a sentence naming it, and no column contains it. Shown red by filtering the list to
`STAGES` members, which is the current CLI behaviour and renders nothing at all.

**AC-9 — a card carries the id, the title, the owner, the containment token and the iteration
counters, and no denominator.**
The counters render as the map `iterations` holds — `review 1`, `chore.review 2` — and **never as
`1/3`**: the bound is `max_iterations` in a flow's step (`flow.ts:141`) and `GET /flows` carries no
steps (§0.3), so a denominator would be invented. The divergence from
`docs/05-design-prompt.md:27` is recorded where the component declares the field.
*Test:* a card over a ticket with `iterations: {review: 1}` contains `review` and `1` and does not
match `/\b1\s*\/\s*\d/`. A ticket with `iterations: {}` renders no counter region rather than an
empty one.

**AC-10 — the cost figure and the sentence naming what it cannot see are one thing, and neither
renders without the other.**
The card renders `billedCostUsd` as a dollar figure where it is a number and as `n/a` where it is
`null`. Wherever any figure is rendered, the board also renders the legend `board.ts` already
prints — billed cost where the vendor reports one, token-only vendors not included. **No per-vendor
split and no blended token-and-dollar number**: *"Codex cost is reported as tokens, never priced
locally"* (2026-08-22), and the data cannot answer per vendor at all (§0.2).
*Test:* a board with at least one priced ticket renders the legend; a board where every ticket is
`null` renders neither figure nor legend. A scan of the component asserts no token count is rendered
beside a dollar figure. Shown red by rendering the figure with the legend removed.

**AC-11 — the containment token is `quorum board`'s vocabulary and `quorum board`'s suppression
rule, from one register.**
`main:contained`, `main:not-contained(+12)`, `main:indeterminate(<reason>)` — and the words
"merged", "landed" and "shipped" appear nowhere (`docs/GLOSSARY.md`). A `no branch` reason is
rendered only where the stage claims the work is done — `board.ts`'s `BRANCH_EXPECTED`, which moves
to `@quorum/shared` with `ALWAYS_RENDERED` and is read by both. The `indeterminate` legend says git
could not answer and **not** that the code is missing.
*Test:* the three states render their three tokens; a `draft` ticket with `no branch` renders no
token and a `reviewed` one does; a scan of `apps/web/src` finds none of the three forbidden
synonyms. Shown red by rendering `no branch` unconditionally, which puts a token on 10 `draft` rows.

**AC-12 — push lag renders as at most one legend, it may warn, it may never reassure, and it borrows
none of containment's grammar.**
`pushed` and `no remote` render **nothing**. Every other state renders one line naming the base, its
upstream and the count, carrying *as of the last fetch*. No `<base>:` token, no per-card
annotation, and no wording equivalent to "CI passed" or "up to date" — *"The board reports push lag,
and never a CI conclusion"* (2026-09-06).
*Test:* each of the `PushLagState` × `PushLagReason` combinations the union permits; the two silent
cases render nothing, the rest render one line; a scan asserts the rendered text for every state
contains no `:` token in containment's shape and matches none of a register of reassuring phrases.

**AC-13 — the board names the flows that consume a stage and offers no control that starts one.**
A column shows which flows consume its stage, **all of them where more than one does** — `chore` and
`solutioning` both consume `requirements` (§0.6) — and a column no flow consumes says so rather than
rendering nothing, so "no flow consumes this" and "the flow could not be read" stay separable
(Q-0055 AC-16). A flow `runnable: false` is named as unreadable and carries no invitation to run it.
**Nothing on this screen issues a request that is not a `GET`.**
*Test:* the `requirements` column names both flows; the `deployed` column says no flow consumes it;
a refused flow is named with its problems. A scan of `apps/web/src` finds no `method:` other than a
`GET` and no reference to `POST /runs`. Shown red by taking `flows.find(…)`, which names one flow
where two consume.

### The shell, and the documents

**AC-14 — the route register gains no path, and exactly one rail entry's `screenExists` flips.**
`/backlog` renders the board; `/backlog/:ticketId` **keeps its placeholder** and its `waitingFor`
sentence is re-aimed at the successor Appendix A names. `RAIL`'s `backlog` entry becomes
`screenExists: true` and no other does. No component names a route the register does not hold —
`apps/web/test/routes.test.ts` already enforces this and covers the new files by construction.
*Test:* the existing register scan, plus an assertion that exactly one `RAIL` entry is `true`, and
that `/backlog/:ticketId`'s row still names a ticket and a `waitingFor` sentence.

**AC-15 — `docs/05-design-prompt.md` stops promising a control the engine refuses, and stops
describing a board this product does not build.**
Three override sites — `:11`, `:35`, `:43` — are corrected to the three answers
`gateAnswerSchema` permits, on the same terms `04-architecture.md` and `06-development-plan.md`
already carry, each naming the other two so the discharge is complete this time. `:27`'s board
paragraph records the four measured divergences: ten columns rather than eight, counters without a
denominator, a billed cost that is not per vendor, and a named flow rather than a button.
*Test:* `packages/shared/src/docs.test.ts` — the brief contains no "override" or "Advance anyway"
in a gate context, and the three documents' answer sets agree. Shown red against the file as it
stands today, which fails on all three sites.

## §4 — Non-goals

1. **The ticket page and `GET /tickets/:id`** — Appendix A, subject to OQ-1. `/backlog/:ticketId`
   keeps its placeholder.
2. **Fixing Q-0060.** Nothing here parses, validates, migrates or rewrites `ticket.md`. AC-8 renders
   the consequence; the defect is untouched and stays open.
3. **Starting a run from the browser.** No `POST` from this screen. The brief's "Run next flow ▸"
   button is refused with three reasons (§0.6, AC-13), and starting a run needs somewhere to watch
   it, which is Q-0015's.
4. **A per-vendor or per-ticket run-history cost roll-up.** OQ-2. It needs an aggregation over
   `.quorum/runs` that nothing performs, and the ticket file cannot answer it.
5. **Widening `GET /flows` to carry loop bounds**, which is what a `1/3` denominator needs.
6. **Mission control (Q-0015), the gate screen (Q-0016), run history drill-down (Q-0018), resumable
   runs (Q-0019), the harness and flow editors (Q-0020, Q-0021).**
7. **Any change to `quorum board`'s rendered output.** Three constants move to `@quorum/shared` and
   `board.ts` imports them; not one byte it prints moves, which AC-7 and AC-11 assert.
8. **Polling, caching or persisting anything in the browser.** `app.tsx`'s header forbids a held
   copy of a fact derived per request, and AC-5 keeps it.
9. **Coining a glossary term.** §5's OQ-4.
10. **The projects home, the top bar's three `NOT_LOADED` regions and the disabled `Run flow`
    button.** They stay exactly as Q-0014 left them; this ticket fills one route, not a shell.

## §5 — Open questions

**OQ-1 (BLOCKING) — one ticket or two, and where the seam is.**
The body asks it and §0 answers most of it. The board half is fifteen criteria **at** the ceiling.
Adding the ticket page adds a server route, a confinement surface, a payload design forced by a 3 MB
folder, a `.harness/` exposure ruling, a tab model over a folder layout that no longer matches the
brief, and the screen itself — six to eight criteria on the most favourable count, which puts the
ticket at twenty-one to twenty-three. Q-0091 and Q-0096 were split at twenty-one; Q-0013 was refused
at eighteen; Q-0122 accepted twenty and paid three implement rounds; Q-0126 accepted sixteen and paid
five.
**The two halves are also different in kind**, which is the argument that does not depend on
counting: the board is a screen over two endpoints that already exist, and the ticket page is a new
server route *plus* a screen, with its own confinement and payload design. Q-0014's gate split this
exact work at this exact seam — shell from connection — and Q-0013's gate split at the transport
seam.
**Recommendation: two.** This ticket keeps the board and the shared-schema work; the successor takes
`GET /tickets/:id` and the ticket page, with Appendix A as its body. *Owner: the gate.*

**OQ-2 — ratify the card's cost, or route a successor.**
AC-3 and AC-10 take the figure `quorum board` already prints, with its legend. The alternative — a
per-vendor figure aggregated from run manifests by `ticket_id` — is a new server aggregation over a
store with no cap (Q-0076) and is not costed here. The recommendation is the ticket-file figure,
because it is measured rather than computed, it is the number the CLI already shows, and the legend
is what makes it honest. **If the gate wants per-vendor, it is a successor and this ticket renders no
cost at all** rather than rendering the wrong one. *Owner: the gate. Not blocking — both readings
are written as criteria or as a strike.*

**OQ-3 — does anything here owe a decision entry?**
Measured against every candidate. Moving wire shapes to `@quorum/shared` is Q-0121's precedent and
that file's own stated purpose — no entry. The cost figure complies with *"Codex cost is reported as
tokens, never priced locally"* (2026-08-22) rather than extending it — no entry. Moving three
constants so two surfaces read one register is the arrangement `docs/04-architecture.md` already
describes — no entry. Refusing the run button is a scope choice — no entry. **The answer is no**, and
GO-3 records it so a later reader does not re-litigate it. *Owner: the gate, to ratify.*

**OQ-4 — the request-state set must not become a second glossary term.**
Q-0120 coined **Connection state** for the socket. AC-5's set is about HTTP and is **not** that, and
naming it would either coin a term — which reaches `CLAUDE.md`'s term list, the human's to write
(Q-0103 erratum E-2) — or introduce a synonym, which `docs-and-decisions.md` forbids. The
recommendation is that it is described in JSDoc, named in no document, and that its module header
says in one line that it is not connection state. *Owner: the gate.*

**OQ-5 — does the board render the `blocked` and `abandoned` columns beside the eight, or below
them?**
AC-7 fixes the *set*; the arrangement is a layout question. Both are terminal in the sense that no
flow consumes them, and four tickets are `abandoned` today. Not blocking — any answer satisfies
AC-7, which is about membership. *Owner: the implementer, reported in the summary.*

## §6 — Risks

**R-1 — this is the app's first HTTP request, and four first-things arrive at once.** Response
parsing, a failure vocabulary, a not-yet-loaded moment and a refresh action, in a package with no
precedent for any of them. The mitigation is that AC-5 and AC-6 are shaped on `connection-state.ts`,
which solved the same problem for the socket and is a pure reducer that can be asserted by value over
every transition rather than by rendering.

**R-2 — the board is the first screen with real data, so a wrong token is worse than none.** A
containment token that says `contained` when it is not tells a maintainer their code landed. AC-11
takes the vocabulary and the suppression rule from one register rather than re-deriving them, which
is the only mitigation that does not depend on someone remembering.

**R-3 — `GET /tickets` is expensive, and a poll would make it the app's hot path.**
`containment`'s own JSDoc puts the board's git budget at **at most 2n + 10 spawns**; at 105 tickets
that is up to 220 process spawns per request. Measured on 2026-09-16, `quorum board` over this
backlog takes **0.30–0.39 s wall** across three runs, which is the order one `GET /tickets` costs.
Acceptable once on mount; unacceptable every few seconds. AC-5's *never polls, explicit refresh* is
this risk's mitigation as much as it is an honesty rule, and the measurement belongs in the
implementer's summary rather than in a criterion, since nothing here changes the cost.

**R-4 — moving three constants out of `packages/cli` touches a package this ticket is otherwise not
about.** It is three `const` declarations and one import, and AC-7 and AC-11 each assert the CLI's
output is byte-identical. The alternative — the screen declaring its own copies — is two registers
free to drift, which is the failure this repository has recorded most.

**R-5 — refusing the brief's most visible control will read as an omission.** "Run next flow ▸" is
the thing a reviewer will look for on a board card. §0.6 and AC-13 record the three reasons in place
so the refusal is legible as a decision rather than as work not done.

**R-6 — the review diff may not reach the reviewer whole.** `harness/harness.yaml:24` sets
`max_diff_bytes: 200000` and four consecutive tickets — Q-0122, Q-0125, Q-0126, Q-0124 — were
reviewed against a cut diff. Since Q-0124's close `materialiseDiff` emits a `warn` naming the files
it gave no patch for, so the gate can see it; GO-5 says to read that warn rather than assume the
panel saw everything, and `git diff`'s path ordering means `apps/web/**` sorts first and
`packages/shared/**` last.

**R-7 — a first-round approve on a screen is worth distrusting.** 74% of chore reviews return
`revise`, and a codex reviewer running `--sandbox read-only` cannot execute the suite. GO-6 requires
mutation rather than a banked approve.

## §7 — Cross-cutting checklist

| Pillar | Answer |
| --- | --- |
| **BYOS** | n/a and load-bearing by omission. No code path here reads an environment variable or accepts a credential; the board renders no subscription state, and the top bar's `Subscriptions` region stays `NOT_LOADED` (non-goal 10). |
| **Safety by construction** | Load-bearing. AC-13: nothing on this screen issues a request that is not a `GET`. No worktree is created, no branch is touched, no run is started, no run lock is taken. The daemon's read surface *"writes nothing, and that is a boundary rather than an omission"* (`read.ts:8`) and this ticket keeps it. |
| **Human-gated by default** | Unchanged. No gate is answered, presented or auto-advanced, and the answer vocabulary stays three — AC-15 removes the last document that says otherwise. |
| **Files are the database** | Load-bearing. Nothing is persisted or cached: the board derives from one request, renders when it was fetched, and refreshes only when asked (AC-5). Containment and push lag stay derived per request (`read.ts:60–72`), which a browser-held copy would break. |
| **Cross-vendor rule** | n/a — no flow, role or adapter changes. |
| **Product-agnostic** | Load-bearing. Nothing here names a SaaS product. The brief's `acme-billing` and `northwind-crm` are mockup fixtures and no fixture in this ticket may borrow one. |
| **The cold-clone test** | Positive and small. No new dependency, no new install step, no new command, no change to either claimed installation path. `apps/web` already emits and is already packed (Q-0124), so an adopter's first `quorum open` gains a working screen where it had a placeholder. |
| **Errors are explicit** | AC-5 and AC-6: a closed state set, no member of which is silence, with an unparseable body a refusal rather than a partly rendered board. AC-1's schemas refuse a malformed row rather than defaulting it. AC-8 names a ticket the vocabulary cannot place rather than dropping it. |
| **File format / schema** | `@quorum/shared` gains four schemas and three constants move into it. **No on-disk format changes** — `ticket.md` is read exactly as it is read today, through the same cast (Q-0043 AC-4). |
| **Lint rules** | None added. `eslint.config.js` covers `apps/**/*.ts` and, since Q-0014, `.tsx`. The four `apps/web/test` scans cover every new file under `src/` by construction. |

## §8 — Gate obligations

**GO-1 — rule OQ-1 before the run.** The criteria list is written for one of the two answers. If the
gate takes one ticket, Appendix A promotes to AC-16 onward **by erratum at this gate**, and the
erratum should say what that costs rather than presenting twenty-three as fine — Q-0122's E-1 is the
shape, and its own prediction (that the size is paid in review rounds) came true twice. Do not
launch with it open.

**GO-2 — if the split is taken, open the successor here rather than in a closing entry**, with
Appendix A as its body, verbatim. Three obligations in one week (Q-0110, Q-0111, Q-0112) lived only
inside a closed ticket's prose or a source comment, one of them for five days; Q-0105 is the
counter-example.

**GO-3 — record that no decision entry is owed and no glossary term is coined** (OQ-3, OQ-4), so a
later reader does not re-derive either. If the gate disagrees on either, the entry lands **at this
gate**: no step on the chore route may write one, and a loop handed work no agent in it can perform
is the pattern this repository has recorded sixteen times.

**GO-4 — ratify OQ-2's cost reading**, and if the gate wants per-vendor, strike AC-3's cost field and
AC-10 rather than letting an implementer choose. A card rendering a figure nobody ruled is the
fabricated value `docs/04-architecture.md:289` forbids.

**GO-5 — read the review's truncation warning rather than assuming the panel saw the change.**
`max_diff_bytes` is 200,000 and four consecutive tickets were reviewed at 64–75% of their subject.
`apps/web/**` sorts first under `git diff`'s path ordering, so the shared schemas and the CLI's three
moved constants are what a head cut hides.

**GO-6 — do not bank a first-round approve.** Show at least these red by mutation: the brief's
eight columns (AC-7 — drops the `abandoned` column and its ticket), `flows.find` in place of naming
all consumers (AC-13), the cost figure with its legend removed (AC-10), an unconditional `no branch`
token (AC-11), and `containment: unknown` restored (AC-1). Each must fail with a message that names
what it is about.

**GO-7 — verify forced in both environment rows after the merge** (Q-0072's closing finding): in a
worktree that has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main`. Then run the
product: `quorum open`, and read the board in a browser against this repository's own 105 tickets —
including the four `abandoned` ones, which are the rows the brief would have lost.

---

## Appendix A — the successor's body, written out in full

*Transcribed here so that, if OQ-1 splits the ticket, the successor is opened at this gate from a
written body rather than from a plan line. If OQ-1 keeps one ticket, this promotes to AC-16 onward
by erratum.*

### The ticket page renders a ticket's folder, and the folder is bigger than it looks

`apps/web` declares `/backlog/:ticketId` and renders a placeholder. **The daemon has no route that
answers for one ticket**: `GET /tickets` lists frontmatter and nothing reads a ticket's folder —
`packages/server/src/read.ts` contains no folder read at all. `core` can already do it:
`Backlog.readFiles(ticket, pattern)` (`packages/core/src/backlog/backlog.ts:266`) is on the barrel
and Q-0059 confined it to the ticket's own folder, refusing a traversing pattern rather than
answering `[]`. **The primitive exists and the route does not.**

### What is already measured, 2026-09-16

**The payload is unbounded and large.** `readFiles` returns `fs.readFileSync(file, 'utf8')` for every
match, with no cap. The largest ticket folder is **3.0 MB** (`Q-0083`); the largest single file is
**1.46 MB** (`Q-0083/review/hand-review-3.txt`), with a 1.40 MB sibling; a modern folder holds 61
files (`Q-0120`); the backlog is 25 MB. A route that answers "the folder" builds a 3 MB JSON body in
memory and hands a browser 1.4 MB of text for one tab. **That is Q-0076's subject on the backlog**,
and it is why this ticket's first design question is the route's shape rather than the screen's.

**The folder is run-scoped and iteration-scoped, and the brief describes the layout before that.**
`docs/05-design-prompt.md:27` was written 2026-08-22; Q-0086 to Q-0089 then made every artifact path
carry `{run}` and, inside a bounded loop, `{iter}`. A real folder holds
`requirements/run-1/candidate-claude.md`, `dev/chore/run-2/implement-iter-1.md`,
`review/chore/run-2/chore-iter-2.md`. The brief's *"Review — rounds as columns"* is **two levels**,
and a flow can run more than once on one ticket.

**There is a hidden `.harness/` directory inside ticket folders.** It holds the engine's verdict
files (Q-0089) — 256 JSON files across the backlog — and it is **untracked**: `backlog/.gitignore`
re-includes `runs.log` and nothing else. `readFiles`'s subtree walk includes dotfiles. Under *files
are the database*, rendering a file the database does not contain is a decision.

**The tabs are not uniformly present.** Across 105 tickets: 105 `ticket.md`, 90 `runs.log`, 70
`review`, 70 `requirements`, 64 `dev`, **5 `solution`, 5 `qa`**. A Solution tab exists for one ticket
in twenty-one. `readFiles` answers `[]` for a legitimately absent directory, so absent and empty are
already distinguishable and must stay so.

**Nothing in `backlog/` is binary today** — 871 `.md`, 256 `.json`, 90 `.log`, 19 `.txt`, 8 `.yaml` —
but `readFiles` decodes every match as UTF-8 unconditionally, so a `.png` would be lossily rendered
rather than refused. Latent, not absent.

**A damaged `ticket.md` is already served as a ticket with no fields.** `parseFrontmatter` falls open
to `{ meta: {}, body: text }` and `read()` casts; `GET /tickets` already answers `id: "undefined"`.
The ticket page is the surface where that stops being a missing row and becomes a whole page of
nothing. Q-0060 stays a non-goal and this must not paper over it.

### What it must decide

1. **The route's shape, forced by the 3 MB measurement.** A manifest of paths and sizes plus a
   second route that reads one file is the shape that does not put an unbounded body on a wire; one
   route returning everything is the shape that does. Measure before choosing, and if a cap is taken,
   the truncation must be **named where a reader sees it** — Q-0124's lesson, where four tickets were
   reviewed against a cut diff and only `runs.log` said so.
2. **Whether `.harness/` is rendered, hidden or named-but-not-read.** It is engine state, untracked,
   and inside the folder the page's own sentence promises to show.
3. **The tab model against the real layout**, including a flow that ran more than once, and absent
   versus empty for the five-in-105 tabs.
4. **What a page renders for a ticket whose `ticket.md` did not parse** — which is the body's
   decision 3, and is now known to be a whole page rather than a field.
5. **404 against 422.** `GET /history/:id` already separates *no run under that token* from *a
   manifest that would not parse* (`read.ts:145–152`), and a ticket page needs the same two answers
   plus the confinement refusal `dirOf` raises for a token that is not one name.

### Non-goals for the successor

The board (this ticket), fixing Q-0060, mission control, the gate screen, run history drill-down,
editing anything in a ticket folder, and any write of any kind.

