# Q-0017 — implement report, run 2 iteration 1

`verdict=proceed`. All fifteen criteria are implemented. Nothing here needed a decision entry, a file
outside this role's paths, or behaviour a landed decision preserves — and the one place a landed
guard blocked the requirement's literal reading, I worked with the guard rather than around it and
report it below as the thing a reviewer should weigh first.

**26 files, +987 / −134, eight of them new.** Forced across the workspace: **21/21 turbo tasks, 2,848
tests**, `pnpm exec quorum lint` 6/6, `pnpm sweep:git-identity` green, and `pnpm exec quorum board`
run by hand with its three legends byte-identical.

---

## 1. The three judgements that diverge from the requirement's letter

Each of these is a place where following the criterion literally was either impossible or would have
reintroduced the failure the criterion exists to prevent. None of them is a refusal; all three are
implemented and reported.

### 1.1 Five declarations moved, not three — R-4 undercounts because two of them are functions

R-4 says *"three constants move out of `packages/cli`"* and *"Three declarations and two imports"*.
§1 enumerates **five** rules the screen must inherit *"from one register"*, and warns that
*"re-derived, they drift"*: which empty columns render, when a missing branch is worth saying, that a
containment token is never called "merged", that push lag may warn and may never reassure, and that a
cost figure travels with its legend.

Two of those five are not constants. `ALWAYS_RENDERED` and `BRANCH_EXPECTED` are; the containment
token, the `indeterminate` legend and the push-lag sentence are pure functions of a closed union and
a base ref. Moving only the constants would have left the browser writing `main:not-contained(+12)`
and *"as of the last fetch"* for itself — **exactly the two-registers-free-to-drift arrangement R-4's
own sentence names as the alternative it is rejecting.**

So `packages/shared/src/board.ts` carries five: `ALWAYS_RENDERED`, `BRANCH_EXPECTED`,
`containmentToken`, `indeterminateLegend`, `pushLagSentence`. It is legal in that package by
`index.ts`'s own definition of what it holds — *"constants and pure functions over strings"* — and it
renders no colour, no escape byte and no layout. What stays in `packages/cli/src/board.ts` is that
surface's grammar: the `· <name> = ` legend prefix, the space separating a token from a row, and
`c.dim`.

**No printed byte of `quorum board` moved**, which is asserted by the command's forty-four existing
tests and was confirmed by running it (§6).

### 1.2 The cost legend could not move, and the reason is a landed guard

AC-10 says the board renders *"the legend `board.ts:220` already prints"*, and non-goal 7 counts it
as the third constant. **It cannot live in `@quorum/shared`.**

`packages/shared/src/events.test.ts`'s AC-9 — *"vendor identity is one neutral, open label"* —
refuses `/claude/i` and `/codex/i` in the **code lines** of every file under that package's `src`.
The legend names a vendor by design: disclosing that a token-only vendor contributes nothing to the
figure is the whole of what it is for. I hit this as a red test, not as a theory.

Three ways out, and why I took the third:

1. **Weaken the scan to permit a string literal.** Refused. That trades a property somebody bought
   for a convenience, and it is not this ticket's to trade.
2. **Assemble the vendor name out of fragments** so the scan cannot see it. Refused. That is the
   obfuscation `turbo-inputs.test.ts` already refuses in its own domain, and it would make the guard
   silently weaker for everything that comes after.
3. **Declare the sentence on both surfaces and pin the two byte-identical.** Taken. It is
   Q-0068 AC-6's arrangement at a second site — `docs/USAGE.md`'s quotation of the BYOS refusal held
   against the literal `claude.ts` throws — *one register kept by a guard rather than by an import,
   because an import is the thing that package may not offer*.

`packages/cli/src/board.test.ts` extracts `COST_LEGEND` from both files by regex, asserts equality,
and asserts the sentence still says the two things it exists to say (so "identical" is not
identically empty). It throws by name if either file stops declaring one. `packages/cli/turbo.json`
declares the browser file as an input, so a cache hit on that task cannot stand over a drifted copy.

**This is the weakest seam in the change and I am naming it as such.** It is a guard rather than a
compiler, and it is the one rule of the six where a reviewer should check my reasoning rather than
my code.

### 1.3 `WireTicketList` gained `baseBranch`, which AC-1 does not name

AC-1 describes the envelope as *"the rows plus the repository's push lag"*. AC-11 requires the screen
to render `main:contained`, and AC-12 requires a line *"naming the base, its upstream and the
count"*. **Neither is renderable without the base ref**, and the wire carried it nowhere:
`ContainmentResult` holds a state and a reason, `PushLagResult` holds the *upstream* and not the
base, and `packages/cli` reads it out of a configuration a browser does not have.

Two answers were available. Fetch `GET /project` as a third request, which needs a fifth wire shape
and a third round trip for one field. Or put it on the envelope that already carries the other
repository-level fact. I took the second: **the ref travels with the answers it was computed
against**, so a client can never render a token against a base those answers did not use.

It is one nullable-free string on an envelope, it is declared in the schema, and `read.test.ts`
asserts it over a real project.

---

## 2. What changed, file by file

### New — `packages/shared`

**`src/board.ts`** (new, 110 lines). The five moved declarations, each with the reasoning that bought
it. Two notes on how they are written:

- **The stage sets are slices of `STAGES`, not written-out lists.** `stages.test.ts` refuses a quoted
  stage name in any source file but `stages.ts`, and it scans **raw text**, so even a comment quoting
  one trips it. `ALWAYS_RENDERED` is `STAGES.slice(0, 3)` and `BRANCH_EXPECTED` is
  `new Set(STAGES.slice(2, 8))`. Both rules are genuinely positional — *before any work has moved*,
  and *`solutioned` onward through `deployed`* — and `board.test.ts` pins the members **by name**, so
  a reordered `STAGES` fails there rather than silently changing which columns a fresh project shows.
- **The foot of the file records why the sixth rule is absent**, so a later reader does not "finish
  the job" by moving it and reddening the vendor guard.

**`src/board.test.ts`** (new, 10 tests). The member identities; the three tokens; every containment
reason reaching the token; the three forbidden synonyms absent from every rendering *and* the needle
shown to discriminate; the indeterminate legend saying what it does not mean; every push-lag state
the union permits, with the two silent ones silent and the rest one line; and that no push-lag text
wears a `<base>:` token or a reassuring phrase.

### Changed — `packages/shared`

**`src/wire.ts`** (+138). `containmentResultSchema`, `pushLagResultSchema`, `WireTicket` /
`wireTicketSchema`, `WireTicketList` / `wireTicketListSchema`, `WireFlow` / `wireFlowSchema`,
`WireFlowList` / `wireFlowListSchema`.

The load-bearing half is the **negative**: `stage` is `z.string()` and not `stageSchema`, and
`iterations` is the same bare number record `ticketSchema` declares. The daemon sends
`String(ticket.meta.stage)`, which is the literal `"undefined"` for a `ticket.md` `parseFrontmatter`
fell open on, and a float or a negative counter is legal on disk. **A wire schema stricter than the
disk schema turns a ticket this product accepts into a board that does not render** — the opposite of
what AC-8 asks for. Naming an unplaceable stage is the screen's job, not the parser's.

The two state schemas are discriminated unions whose `.strict()` makes the combinations git cannot
produce unrepresentable on the wire — `{state: 'contained', ahead: 3}` is refused. The `ZodType<T>`
annotation is what checks the literals: a typo fails to compile at that line rather than at a
renderer with no token for it (demonstrated in §5, mutation 5).

**`src/wire.test.ts`** (+7 tests), **`src/index.ts`** (one line), **`src/docs.test.ts`** (+8 tests,
see §3), **`turbo.json`** (three declared inputs, see §4).

### New — `apps/web/src`

**`request-state.ts`** — the closed set of answers one request can have, and the sentence each
renders. Five members, no member silence, no member a spinner. Its header states in one line that it
is **not** connection state: `connection-state.ts` is the socket's nine-member account and this is one
HTTP request's outcome. **No glossary term is coined** (OQ-4): the set is described in JSDoc and named
in no document, because coining one reaches `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes
the human's to write.

**`daemon-client.ts`** — the one module every request in this app is made from. Paths come from
`DAEMON_ENDPOINTS` and nowhere else; no absolute URL; every body validated before anything reads it.
The four failure paths are told apart in the order they can occur — never completed, not JSON,
refused, wrong shape — and a non-2xx whose body is not a refusal is **still** reported as a refusal,
under a code naming the status, because reporting an answered request as unreachable would send a
reader to restart a process that is running.

**`backlog-board.tsx`** — the screen. Ten columns off `STAGES`, `ALWAYS_RENDERED` for the empties, a
card that is one link with nothing clickable inside it, counters as the map holds them, the
containment token under the shared suppression rule, the three legends, the unplaceable-ticket
region, the unreadable-flows region, and a Refresh. **It never polls**: `useEffect` on mount and the
Refresh button, and the source scan refuses `setInterval`, `setTimeout` and `requestIdleCallback`
anywhere under `src`.

**Three test files** beside them: `request-state.test.ts` (pure, by value over every member),
`daemon-client.test.ts` (injected fetch, no socket), `backlog-board.test.ts` (jsdom, every request
injected). All three are `.test.ts` and not `.test.tsx`, per `shell.test.ts`'s rule — a `.tsx` suite
would run while being invisible to the discovery guard and hashed by no turbo input.

### Changed — `apps/web`

**`src/routes.ts`** — `BOARD_PATH` and the ticket-route pattern as constants both tables are built
from; `ticketPath(id)` built by substitution into the registered pattern, so the path a card links to
and the path the router matches are one string with one hole filled, percent-encoded to one segment;
the `backlog` rail entry flipped to `screenExists: true`; the ticket-page row re-aimed at **Q-0127**.

**`src/app.tsx`** — draws the board where the resolved route is `BOARD_PATH` and the placeholder
everywhere else, with `fetcher` and `clock` added to `AppProps` as the injection seam.

**`test/routes.test.ts`** — the `screenExists` assertion is now *exactly one, and it is the board's*,
plus the six that did not move as an identity; three new tests for the ticket-page row, the
`BOARD_PATH` constant and `ticketPath`. One row added to `EXCEPTION_REASONS`, for the percent-encoded
href the card test asserts in both directions.

**`test/source.test.ts`** — the AC-4 title move (§3) and four new scans: no non-`GET` method and no
gate/stop route named; no interval-based refetch and no browser persistence; none of the three
containment synonyms; no `cost to date` and no token-count field.

### Changed — `packages/server`

**`src/read.ts`** — `WireTicket` and the three siblings are `@quorum/shared`'s and re-exported here,
so the barrel is unchanged and no shape is written twice (Q-0121's arrangement). `billedCostOf` is
new: the sum `board.ts` already computes, **`null` where the ticket has no history at all**, with an
empty array taking the same answer as an absent key. A `null` entry cost is summed as zero exactly as
the board does — that is what the legend discloses.

**`src/read.test.ts`** (+6 tests) — the live listing parsed against its own schema; the three cost
fixtures AC-2 names plus the empty-array case; the null-entry sum; iterations verbatim; a genuinely
damaged `ticket.md` reaching the listing as `stage: "undefined"` rather than being refused; and
`baseBranch`.

**`src/static.test.ts`** — `shellPaths()` widened, see §4.

### Changed — `packages/cli`

**`src/board.ts`** — imports the five, keeps `COST_LEGEND`, composes its own legend prefixes. The
header records what moved and what did not. One divergence is **registered in place and not fixed**:
this command prints `$0.00` where a ticket has no history and the wire sends `null`. The wire's
answer is the right one, but not a printed byte of this command moves on this ticket (non-goal 7), so
it belongs to whoever is next sent to change what `quorum board` prints.

**`src/board.test.ts`** (+4 tests) — neither surface declares its own copy of the five; both read the
same register; the cost legend byte-identical across the two; and the command still prints it under
`· cost = `, asserted over a real fixture through the real command.

**`turbo.json`** — one declared input, the browser board file.

### Changed — `docs/`

**`04-architecture.md`** — §`apps/web` describes the board rather than saying no screen exists; the
fetch clause is narrowed (§3); a status-line entry.

**`05-design-prompt.md`** — the three override sites corrected, a status note naming the other two
documents, and the board paragraph carrying the four measured divergences (§3).

**`06-development-plan.md` is deliberately untouched.** Q-0094 erratum E-3(a) ruled that this page's
bullets are rewritten by hand at each plan pass, and that an implementer's edit to it turned a
harmless revert into a review finding. Erratum E-1's GO-8 also records that the page was already
corrected at the gate.

---

## 3. AC-4 and AC-15 — two claims that would have gone false in silence

**AC-4.** `apps/web/test/source.test.ts:369` was titled *"AC-10 — loading the shell fetches nothing
from a network"* and `docs/04-architecture.md` said *"nothing is fetched from a network"*. Both are
enforced by a scan for three URL literals, and **a same-origin path trips none of them** — the file's
own `:450` pins that. So the moment `daemon-client.ts` called `fetch('/tickets')`, both claims became
false and all six assertions under them went on passing.

Both now state the property the scan has always enforced: *every request is same-origin and
page-relative — no absolute URL, no third-party host, no font host*. **No assertion, needle, fixture
or subtraction was weakened** (non-goal 11). `docs.test.ts` holds the describe title and the document
sentence against each other, in three clauses: neither says nothing is fetched (with the old wordings
as the discriminating fixtures), both state the same-origin property, and the client really does
fetch — so the narrowing is shown to have an occasion rather than being a document weakened for
nothing. R-6's warning was taken seriously: the scan is shown still to have a subject *after* the
title moved, in `source.test.ts`, by failing **by file name** on an absolute URL in `daemon-client.ts`
and not failing on `fetch('/tickets')`.

**AC-15.** The brief's three override sites are corrected to the three answers `gateAnswerSchema`
permits. The check is over the **brief proper** — everything below the `---` — because the status
block above it is where the correction is written down and has to be able to name the wording it
withdrew; the test asserts that separation in both directions. It also asserts the brief names all
three answers (taken from the schema, not transcribed), that all three documents name
`gateAnswerEnvelopeSchema`, that the status note names the other two documents so the discharge is
visibly complete this time, and that the board paragraph records the four divergences.

---

## 4. Two guards my change broke, and how

Both are guards I was not sent to change. Both broke because their *derivation* could not see a new
shape, not because their *property* stopped holding.

**`packages/server/src/static.test.ts`'s `shellPaths()`** scraped `path:` values as quoted literals
plus one special case, `HOME_PATH`, answered with `'/projects'` **written down in the test**. My two
register constants dropped it from twelve paths to ten. It now collects every
`const NAME = '<literal>'` in the file and resolves a named `path:` through it, throwing where it
cannot — which also removes a latent defect: the hard-coded `'/projects'` would have compared a
renamed home against a stale copy while still reporting twelve.

**`packages/core/src/turbo-inputs.test.ts`.** `docs/05-design-prompt.md` was a `NOT_READ` key serving
as clause A's and clause B's *uncovered* fixture. AC-15 gives it a real reader, so the row would have
been excusing a real read — and because `undeclaredPaths` skips a `NOT_READ` key for **every** task,
clause B would then have gone blind to whether `@quorum/shared#test` declared it. That is verbatim
what Q-0098 recorded when `docs/01-product-definition.md` gained its first reader, and the remedy is
the same: the row moves to `MANIFEST`, and the fixture moves to `CONTRIBUTING.md` — tracked, outside
`packages/core`, and named by no suite in either audited package (measured, not assumed). Three
declarations were added to `packages/shared/turbo.json` and three `MANIFEST` rows beside them.

---

## 5. GO-6 — the seven mutations, each red with a discriminating message

Applied one at a time and reverted; the full suite is green with all seven reverted.

| # | Mutation | Failure |
|---|---|---|
| 1 | The brief's eight columns in place of `STAGES` | `a stage outside the design brief's eight lost its ticket: expected [...] to include 'abandoned'` |
| 2 | `flows.find` in place of naming every consumer | `the column names only the first flow that consumes the stage: expected '…consumed by chore…' to contain 'solutioning'` |
| 3 | The cost figure with its legend removed | `a figure rendered with nothing saying what it omits` |
| 4 | An unconditional `no branch` token | `a draft ticket was annotated for a branch nobody has made yet` |
| 5 | `containment: unknown` restored | test: `a contained answer carrying an ahead count was accepted`; **and** typecheck: `TS2322 … containment: ZodUnknown … is not assignable to ZodType<WireTicket>` |
| 6 | `stage` narrowed to `stageSchema` | `a damaged ticket makes the whole listing unparseable` (two tests) |
| 7 | An absolute URL in `daemon-client.ts` | **by file name**, in three places: `src/daemon-client.ts names http://`, `the client names http://`, `daemon-client.ts carries the daemon hostname` |

Mutation 7 is the one AC-4 asks for specifically, and it is the half that proves the scan still has a
subject after its title moved.

---

## 6. Verification

**Forced, in the environment row this worktree is** — it holds neither `.harness/worktrees` nor
`.quorum/runs`, which is the row Q-0072's closing finding names as the one where a directory-existence
defect hides:

- `pnpm install --frozen-lockfile` → *Already up to date* (no dependency added, lockfile untouched)
- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks, 0 cached**
- **2,848 tests**: shared 231, web 198, core 1,540 (+2 skipped), server 185, cli 692, compiler 1, templates 1
- `pnpm turbo run build --force` → 5/5, the web bundle among them
- `pnpm exec quorum lint` → 6/6
- `pnpm sweep:git-identity` → green, *"the workspace suite executed and green with no resolvable git identity"*

**The product, run by hand.** `pnpm exec quorum board` prints all three legends unchanged, including
the four `abandoned` tickets a brief-shaped board would lose. The read routes were then driven over
**this repository's own backlog** through `mountRead` on a real `Project`:

```
rows             106
baseBranch       "main"
pushLag          {"state":"unpushed","ahead":5,"upstream":"origin/main"}
stages on disk   abandoned, draft, requirements, reviewed
priced / null    69 / 37
Q-0017           {"id":"Q-0017", …,"containment":{"state":"contained"},
                  "iterations":{"requirements.head-of-product":1},"billedCostUsd":19.75}
consumes reqs    chore, solutioning
consumes deploy  []
containment      {"state":"indeterminate","reason":"no branch"} | {"state":"contained"}
```

Every rendering path AC-9 to AC-13 is about is exercised by real data: a counter that renders
`requirements.head-of-product 1` with no denominator, a priced figure **and** 37 `n/a` cards so the
legend renders with something to qualify, a push-lag line, both containment states, a two-flow column
and a no-flow column.

**Not done, and it is the gate's rather than mine.** GO-7's post-merge both-row verification, and
opening `quorum open` in a browser to read the board. I started the daemon and it bound cleanly, but
this environment refuses outbound connections from the shell, so the socket-level proof here is
`static.test.ts`'s — *all twelve shell paths answer 200 `text/html` over a real socket*, which passed
— rather than a curl I could show you.

---

## 7. What I deliberately left alone

- **Q-0060.** Nothing here parses, validates, migrates or rewrites `ticket.md`. AC-8 renders the
  consequence — a damaged ticket is **named** rather than filed or dropped — and `read.test.ts`
  proves the damaged row reaches the wire as `stage: "undefined"`. The defect is untouched and open.
- **`docs/06-development-plan.md`** — Q-0094 E-3(a), above.
- **`quorum board`'s printed output** — not a byte, asserted by that command's own forty-four tests
  and by running it.
- **`GET /flows`'s shape** — no loop bounds added (non-goal 5), which is why there is no denominator.
- **The `$0.00`-versus-`null` divergence** in `board.ts` — registered in place, not repaired.
- **`packages/core/src/backlog/backlog.ts`'s stale `eslint-disable`** — a pre-existing warning in a
  file this change does not touch.

## 8. Where the requirement did not cover a case, and what I chose

- **AC-3's fixture wording.** AC-3 says a body with `stage` removed must answer *"the refusal state"*.
  In the vocabulary AC-5 asks for, a schema failure is `unparseable` and a daemon 4xx is `refused` —
  two different members. I read AC-3's phrase as *a failure state, never a half-rendered board*
  (which is its own normative sentence) and assert `unparseable`. If the gate reads it as the literal
  `refused` member, the two members collapse and AC-6's *"neither collapses into the other"* fails, so
  I am confident in the reading — but it is a reading.
- **An empty `history: []`** answers `null`, like an absent key. AC-2's fixtures name only the absent
  key; *nothing has run is not the claim that it cost nothing* covers both, and `read.test.ts` asserts
  them separately so the choice is visible rather than incidental.
- **AC-10's token-count scan** is keyed on the five **field names** a count could reach this app
  through (`tokensByVendor`, `vendorTokenTotal`, `input_tokens`, `output_tokens`,
  `cached_input_tokens`) rather than on the word *token*. A word scan collides with containment's own
  vocabulary — the board renders three *tokens*, and the glossary uses that word for them — so it
  would have been a guard keyed on a name rather than on the behaviour, which is the family this
  repository records most. It was written as a word scan first and went red on the board's own test
  file, which is how the collision was found.
