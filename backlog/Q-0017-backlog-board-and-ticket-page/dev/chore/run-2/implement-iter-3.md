# Q-0017 — implement report, run 2 iteration 3

`verdict=proceed`. **A revision round: run 2 iteration 2's major and its nit are both fixed, and the
major was reproduced red before it was fixed and shown red by mutation afterwards.** Nothing else
moved — no criterion was re-opened, no scope was added, and the fifteen criteria the previous two
rounds landed are untouched.

**2 files, +146 / −15**, both under `apps/web/src`. Forced across the workspace: **21/21 turbo tasks,
0 cached, 2,855 tests**, build 5/5, `pnpm exec quorum lint` 6/6, `pnpm sweep:git-identity` green.

---

## 1. Major — a card that claimed to open a ticket and returned to the board

> *"An id-less ticket with a valid stage is rendered as a card, but `ticketPath('')` produces
> `/backlog/`, which the router treats as the board route rather than the ticket-page route. The card
> therefore claims to navigate to a ticket while returning to the board."*

**Accepted in full, and the mechanism is exactly as stated.** `ticketPath('')` substitutes an empty
segment into `/backlog/:ticketId`, giving `/backlog/`; `router.ts`'s `segmentsOf` filters empty
segments, so `/backlog/` and `/backlog` are one path; and the board's row sits above the ticket
page's in `ROUTES`. So the href resolved to the **board**. Reproduced before anything was changed —
the first run of the new test failed with `expected [ '/backlog/Q-0042', '/backlog/' ] to have a
length of 1 but got 2`, which is the defect printed rather than described.

The previous round's report named this as an unresolved default under §7, and the reviewer is right
that no requirement chose it. It is worse than a dead link: a dead link tells a reader something is
wrong, and this one silently re-renders the screen they were already looking at.

### The remedy taken, and the one refused

The finding offers two. I took the first — **do not render such a row as a navigable card; surface
it in the explicit region** — and refused the second, establishing a routing contract over the
folder as the route token. The folder is a directory basename, not a ticket token, and **what a
ticket page does with a token it cannot resolve is Q-0127's decision 4**, written into that ticket's
body at this gate. Deciding it here would be this ticket pre-deciding its successor's design through
a link, which is the shape Q-0090 was blocked on twice.

### What changed

**`unplaceableReason(ticket)`** (`backlog-board.tsx`) answers *why* this board cannot render a row as
a card, or `null`. Two reasons:

- *its stage reads `"…"`, which is not one this board knows* — AC-8's case, unchanged;
- *its file supplied no id, so there is no ticket page to open it at* — the finding's case.

**One region rather than two, and the reason is the overlap.** A `ticket.md` `parseFrontmatter` fell
open on supplies **neither** an id nor a stage, so two regions would report one ticket as two rows
under two headings. One row carrying both sentences joined is the honest rendering, and it is why
this returns a sentence rather than a flag.

**`UNPLACEABLE_HEADING` moved** from *"Tickets whose stage this board cannot place"* to *"Tickets this
board cannot place"*. A row kept out for its id would otherwise sit under a heading asserting its
stage is unreadable, which for the fixture's `draft` is simply false — the comment-promising-what-
the-code-does-not-do class, one level up. AC-8's test binds the exported constant rather than a
literal, and no document anywhere names the old wording (checked: `04-architecture.md`,
`05-design-prompt.md`, `docs.test.ts` hold none of it).

**Column membership and the region are now one partition rather than two filters:**

```ts
const placeable: WireTicket[] = [];
const unplaceable: { readonly ticket: WireTicket; readonly reason: string }[] = [];
for (const ticket of rows) {
  const reason = unplaceableReason(ticket);
  if (reason === null) placeable.push(ticket); else unplaceable.push({ ticket, reason });
}
```

A row is in a column **or** in the region, never in both and never in neither — which is what *named,
never dropped* actually needs, and which two independent filters are free to drift apart on. It also
makes `Card`'s invariant structural: it is only ever handed a row `unplaceableReason` cleared, so
`ticket.id` is non-empty and its href really does resolve to the ticket page. That is stated in
`Card`'s docblock rather than enforced by a branch inside it — **a branch nothing can reach is a
check nothing can show red**, which is this repository's most-recorded defect and not something to
add while fixing one.

`PLACEABLE_STAGES` is built once at module scope rather than per row, and replaced an
`as readonly string[]` widening I had written first; the old code built the same set once for the
same reason.

### The test, and why it is written against the router

`backlog-board.test.ts` gains two tests under AC-9.

**The behavioural one** asserts that **every card href resolves to the ticket-page route**, through
`router.ts`'s own `resolve`. That is the claim a card actually makes — *this navigates to a ticket* —
rather than a proxy for it, and it is what a string comparison would have missed: `/backlog/` is a
perfectly well-formed path that resolves to the wrong screen. The expected route pattern is taken
**from the register**, by resolving a path built for a real id, rather than written out. It also
asserts the id-less row is named by its folder, is in no column, and says *why*.

**The premise one** pins the two facts the partition rests on: `ticketPath('')` is the board's own
path with a trailing slash, and that path resolves to the **board**. If a later router gave it a
ticket route of its own, this goes red — which is the moment to revisit the partition deliberately
rather than to rediscover it from a card that navigates nowhere. It carries its own discriminator:
a real id must **not** resolve to the board, or the comparison would hold because everything under
`/backlog` resolved to one row.

Neither test writes a route literal: both build from `BOARD_PATH` and `ticketPath`, so
`test/routes.test.ts`'s literal scan needs no new exception.

---

## 2. Nit — the header claimed six imports where five are imported

> *"The module header says all six board rules are imported from `@quorum/shared`, but the cost
> legend is declared locally and guarded against the CLI copy, as the same file correctly explains
> below."*

**Accepted, and it was a contradiction inside one file** — the opening claim said *"all six are
`@quorum/shared`'s … imported by this file"*, and `COST_LEGEND`'s own docblock forty lines down
explained at length why that one could not go there. The header now names six rules, says **five are
shared by import and the sixth by a guard**, names `COST_LEGEND` as the sixth, and points at its
docblock for the reasoning rather than transcribing it a second time. *One register either way; two
mechanisms, because an import is the thing `@quorum/shared` may not offer for this one sentence.*

---

## 3. The mutations — four, each red with a discriminating message

Applied one at a time and reverted; the suite is green with all four reverted, and `git status` shows
only the two intended files.

| # | Mutation | Failure |
|---|---|---|
| 1 | the id half of `unplaceableReason` removed — an id-less row is a card again | `the readable ticket and the id-less one were both rendered as cards: expected [ '/backlog/Q-0042', '/backlog/' ] to have a length of 1 but got 2` |
| 2 | the region back to the hard-coded stage sentence | `the row does not say why it could not be placed: expected 'T-0109-no-id — its stage reads "draft…' to contain 'no id'` |
| 2b | the id clause ALSO pushing the stage sentence, so both render | `a row kept out for its id was told its stage is unreadable: expected 'T-0109-no-id — its file supplied no i…' not to contain 'stage reads'` |
| 3 | `ticketPath` giving an empty id a placeholder segment | `an empty id no longer builds the board's own path: expected '/backlog/x' to be '/backlog/'` |

**2b exists because 2 stops before reaching the clause it is about.** Mutation 2 fails on *"does not
say why"* and never evaluates *"was told its stage is unreadable"*, so that second clause would have
been shown red by its neighbour rather than on its own — Q-0107's distinction, and not the same as
being established. 2b leaves the first clause passing and fails only the second.

Mutation 1's failure message is the defect as it shipped, printed: `/backlog/` in the href list.

An earlier attempt at 2b — forcing the stage clause unconditionally — is recorded rather than
quietly discarded: it moved **every** row into the region and turned 9 tests red, so it demonstrated
nothing about the clause in question. The narrower one is what is reported above.

---

## 4. Verification

Forced, in this worktree — which holds neither `.harness/worktrees` nor `.quorum/runs`, the
environment row Q-0072's closing finding names:

- `pnpm install --frozen-lockfile` → *Already up to date* (no dependency added, lockfile untouched)
- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks, 0 cached**
- **2,855 tests** (+2 skipped): shared 232, web 203, core 1,540, server 186, cli 692, compiler 1,
  templates 1 — two more than iteration 2's 2,853, which is this round's two new tests
- `pnpm turbo run build --force` → 5/5 in 4.10 s
- `pnpm exec quorum lint` → 6/6
- `pnpm sweep:git-identity` → green, *"the workspace suite executed and green with no resolvable git
  identity"*

**What this change does to this repository's own board: nothing, and that is measured rather than
assumed.** 106 `backlog/*/ticket.md` files, **all 106** carrying a non-blank `id:`, and every stage on
disk — 91 `reviewed`, 10 `draft`, 4 `abandoned`, 1 `requirements` — a `STAGES` member. So the
partition moves **zero** rows here and the region stays empty, exactly as before. The defect is
reachable only through a damaged ticket, which is why it is proven by fixture and why a run against
this backlog could not have found it.

**Not done, and stated rather than implied.** This environment refuses `node` execution from the
shell, so unlike the previous two rounds I could not drive `GET /tickets` over a real `Project` to
re-print the listing. **No file under `packages/server` changed this round**, so that measurement is
unaffected; the census above was taken from the ticket files directly instead. GO-7's post-merge
both-row verification and opening the board in a browser remain the gate's.

**On the review diff (GO-5, R-7):** this round is 146 insertions across two files, far inside
`max_diff_bytes`. Iteration 2's reviewer recorded that eight files had no patch in the supplied
diff and that it inspected them from the branch; none of those eight is touched by this round.

---

## 5. What I deliberately left alone

- **The second remedy the finding offered** — a routing contract making the folder a valid route
  token. That is Q-0127's decision 4, named in that ticket's body at this gate.
- **`packages/server`, `packages/shared`, `packages/cli` and `docs/`.** Not one byte. The daemon
  already answers `id: ''` for a damaged ticket, which iteration 2 landed and which is the right
  answer; what was wrong was what the browser did with it.
- **Q-0060.** Nothing here parses, validates, migrates or rewrites `ticket.md`. This change makes a
  damaged ticket *nameable* and stops it being given a link that lies; the defect that produces one
  is untouched and open.
- **`quorum board`'s printed output** — no file under `packages/cli` is in this diff.
- **The `$0.00`-versus-`null` divergence**, still registered in place, still not repaired.
- **`docs/06-development-plan.md`** — Q-0094 E-3(a), and GO-8 was discharged at the gate.
- **The fifteen criteria of iterations 1 and 2**, including AC-4's narrowing, AC-15's three corrected
  override sites, the five moved board declarations, the byte-identical cost legend, the generation
  counter and the `folder` field. Nothing in this round re-opens any of them.

---

## 6. Where the requirement did not cover a case, and what I chose

- **A ticket with a readable stage and no id.** No criterion covers it: AC-9 describes a card as *"one
  link to `/backlog/<encoded id>`"* and assumes there is an id; AC-8's region is written about the
  *stage*. I read AC-8's normative half — *named, never dropped, defaulted or filed* — as the rule
  that governs any row this board cannot place as a card, and put it there. The alternative readings
  are worse: rendering it as a card is the defect, and dropping it is what AC-8 exists to forbid.
- **The region's heading.** Widened, because a row kept out for its id would otherwise be told its
  stage is unreadable. AC-8's test binds the exported constant and no document names the wording, so
  nothing else moves with it — but it is a user-visible string that no criterion pins, and it is a
  choice rather than a deduction.
- **One region rather than two.** A ticket carrying both defects is one row with both reasons. Two
  regions would report one ticket twice.
- **No guard for the header claim.** The nit is a prose defect and I fixed the prose. Adding a
  docblock-scanning check to hold *"five imported, one guarded"* against the import list is
  machinery no criterion asks for, and the legend's two copies are already pinned byte-identical by
  `packages/cli/src/board.test.ts`. Recorded as an observation rather than acted on.
