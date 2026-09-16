# Q-0017 — implement report, run 2 iteration 2

`verdict=proceed`. **A revision round: both of run 2 iteration 1's majors are fixed, and each was
shown red by mutation before it was trusted green.** Nothing else moved — no criterion was
re-opened, no scope was added, and the thirteen criteria the previous round landed are untouched.

**7 files, +234 / −23.** Forced across the workspace: **21/21 turbo tasks, 0 cached, 2,853 tests**,
build 5/5, `pnpm exec quorum lint` 6/6, `pnpm sweep:git-identity` green, and the read routes driven
over this repository's own backlog by hand.

---

## 1. Major 1 — a superseded load could overwrite a newer board

> *"Each `load()` creates its own `live` flag, but only the invocation returned from `useEffect` has
> its cleanup retained. Retry and Refresh discard the returned cleanup…"*

**Accepted in full, and the diagnosis is exactly right.** `load()` returned `() => { live = false; }`
and `onClick={load}` threw it away, so a Refresh's request had no way of ever being invalidated: its
`live` stayed true for the life of the closure, and an earlier, slower answer resolving last would
call `setData` over a newer one. What that puts in front of a reader is not merely stale rows — it is
a stale **fetched-at instant** beside stale **containment** and **push lag**, the two facts this
screen derives per request and stores nowhere precisely because they go out of date.

**The fix is one counter, shared, in a ref** (`backlog-board.tsx:234`). `load()` takes the next
number, and applies its answer only while that number is still current:

```ts
const mine = (generation.current += 1);
…
if (generation.current === mine) setData({ tickets, flows });
```

Two properties fall out of one mechanism rather than two, which is why it is a ref and not a second
flag beside the first:

- **Starting a load invalidates the one before it**, whoever started it — the mount, Refresh, or a
  Retry. There is no cancelling a promise that is already out, so a superseded request is dropped
  when it answers, in flight and unread.
- **Unmounting bumps the same counter** (the effect's cleanup), which is what the retained `live`
  flag used to do for the mount's load alone and for no other.

The docblock states both, and states the residual honestly: the request is not aborted, it is
ignored. Adding an `AbortController` would be a second mechanism for the same property and a change
to `FetchLike`'s signature, which the requirement does not ask for and which no criterion covers.

**The test the finding asks for is `backlog-board.test.ts`'s *"a slower earlier load never lands on
top of a newer one"***, and it resolves two loads out of the order they started. Getting two into
flight at once is the part worth reading: this screen hides its own controls while a request is
open — `tickets.kind !== 'loaded'` takes the early return — so a second click is not available. The
test therefore starts one load with Refresh and a second by re-rendering with a different `fetcher`,
which is an ordinary prop change and the path `app.tsx` actually supplies. Then the **newer** answers
first and the **older** answers last, and the board must still be showing the newer.

## 2. Major 2 — a fabricated id, and the folder that survives

> *"A malformed ticket without an id is projected as the literal `"undefined"`, discarding the ticket
> folder—the only stable identity still available… the renderer also gives them duplicate React
> keys."*

**Accepted in full.** `String(ticket.meta.id)` sat between three fields that already say `?? ''`,
and for a `ticket.md` `parseFrontmatter` fell open on it answered a four-character string that is
indistinguishable from a real id, identical across every damaged ticket, and — as the finding says —
the renderer's key.

**`WireTicket` gains `folder`**, the ticket directory's basename. It is the right identity for a
reason rather than by elimination: it comes from `readdir` on the backlog root rather than from the
file that failed to parse, `TicketRecord` has carried it since Q-0043, and it is unique under one
root by construction — which is what makes it usable as a key at all.

**`id` is now `''` where the frontmatter supplied none.** This is one step past the remedy the
finding names, and I am naming it as a judgement rather than letting it pass as bookkeeping. Three
reasons:

1. It is what the three fields on the lines beneath it already do. The inconsistency was the defect;
   matching them removes a rule rather than adding one.
2. `"undefined"` is a **fabricated value** — `docs/04-architecture.md:289` forbids a screen showing a
   fabricated ticket, and a card built from it linked to `/backlog/undefined`.
3. It gives the browser a predicate it already uses for `title` and `owner` (`=== ''`) instead of
   sniffing for a literal. A board deciding "the id is unreadable" by string-matching the word
   *undefined* would be a guard keyed on a spelling rather than on the fact.

**`stage` keeps its `String()` deliberately**, and the comment in place says so: what the file
*claimed* is what AC-8 requires a client be able to **name**, and `''` would report the file as
silent where it was not. `read.test.ts` still pins `stage: "undefined"` reaching the wire, and
`wire.test.ts` still pins the schema accepting it.

**On the screen** (`backlog-board.tsx`): one `ticketName()` helper — the id, or the folder where the
id is empty — used by the card and by the unplaceable row; and **`key={ticket.folder}` in both
places**, cards included. The card's key is the same defect reachable through a column rather than
through the unplaceable region, and fixing one and not the other is the fix-the-instance failure
this repository records most.

**AC-8's own *Test:* fixture is untouched.** That clause names a response carrying
`{"id":"undefined","stage":"undefined"}`, and that test still runs unchanged and still asserts the
ticket is named and in no column — a client renders whatever arrives, whatever the daemon now sends.
The finding's case is a **second** test beside it, with two id-less rows carrying distinct folders,
at both surfaces.

---

## 3. File by file

**`packages/shared/src/wire.ts`** (+13). `WireTicket` gains `readonly folder: string` directly after
`id`, with `folder: z.string()` in the schema. The docblock gains the paragraph that explains why
both fields exist: `id` is what the file said and `folder` is where the file is, and the second is
the one that survives exactly the case the first does not.

**`packages/shared/src/wire.test.ts`** (+1 test, +2 lines of register). `TICKET` gains a folder. The
field-identity register at the foot moves to nine names in order — it is a `toStrictEqual`, so a
field added without a thought fails there by design. The new clause pins three things the change
rests on: an empty `id` is **accepted** (or the whole listing becomes unparseable the moment one
ticket is damaged), `folder` is **required** (or the daemon could stop sending it and the board fall
back to nameless rows), and a non-string folder is refused.

**`packages/server/src/read.ts`** (+9 / −2). `id: String(ticket.meta.id ?? '')` and
`folder: ticket.folder`, with a five-line comment giving the reason for the first and the reason
`stage` is deliberately *not* treated the same way.

**`packages/server/src/read.test.ts`** (+1 test, one existing test re-aimed). The existing damaged-
ticket test now finds its row by folder rather than by the fabricated id it used to key on — its
claim is unchanged and its subject is the same row. The new test writes **two** id-less tickets and
asserts they arrive as two rows with their own folders, that no row carries an id nobody wrote, that
every folder in the listing is distinct, and that the listing still parses against its own schema
with a damaged row in it.

**`apps/web/src/backlog-board.tsx`** (+38 / −12). The generation ref, `ticketName()`, and the two
keys. Nothing else in the component moved.

**`apps/web/src/backlog-board.test.ts`** (+3 tests). The `ticket()` factory derives a folder from the
id unless a fixture names one, so rows are distinct without every call saying so. The three new
tests are the two-damaged-tickets case, its **discriminator**, and the out-of-order load.

**`apps/web/src/daemon-client.test.ts`** (+1 line). Its well-formed listing gains a folder, or the
schema it exists to exercise refuses it.

### The one thing in the tests worth a reviewer's attention

The duplicate-key half of major 2 is an **absence**: React reports a repeated key through
`console.error` and not by throwing, so a suite that does not watch for one cannot see one, and an
assertion that no complaint was captured is worth nothing until the capture is shown to fire. There
is therefore a second test — *"and that key check discriminates"* — which renders a list that repeats
a key on purpose, through the same capture and the same needle, and requires at least one complaint.
Without it the first assertion would pass over a spy that was watching nothing, which is the shape
this repository has found inside its own guards more than once.

---

## 4. The mutations — three, each red with a discriminating message

Applied one at a time and reverted; the suite is green with all three reverted.

| # | Mutation | Failure |
|---|---|---|
| 1 | `load()` back to a private `live` flag with `useEffect(() => load(), [load])` | `a superseded request overwrote the newer board: expected '…' not to contain 'Q-0002'` |
| 2 | the unplaceable row back to `{ticket.id === '' ? NOT_SET : ticket.id}` | `the first is not named by its folder: expected [] to have a length of 1 but got +0` |
| 2b | the row's key alone back to `` `${ticket.id}:${ticket.stage}` ``, naming left fixed | `two rows share a React key: expected [ Array(1) ] to strictly equal []` |
| 3 | `read.ts` back to `String(ticket.meta.id)` | `two damaged tickets did not arrive as two rows: expected [] to strictly equal [ 'T-0107-first-damaged', …(1) ]` |

2b exists because 2 fails on the naming clause and stops before reaching the key clause, so the key
assertion would otherwise have been shown red by its neighbour rather than on its own — which is
Q-0107's distinction and is not the same as being established.

---

## 5. Verification

Forced, in this worktree — which holds neither `.harness/worktrees` nor `.quorum/runs`, the
environment row Q-0072's closing finding names:

- `pnpm install --frozen-lockfile` → *Already up to date* (no dependency added, lockfile untouched)
- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks, 0 cached**
- **2,853 tests** (+2 skipped): shared 232, web 201, core 1,540, server 186, cli 692, compiler 1,
  templates 1 — five more than iteration 1's 2,848, which is this round's five new tests
- `pnpm turbo run build --force` → 5/5 in 4.05 s
- `pnpm exec quorum lint` → 6/6
- `pnpm sweep:git-identity` → green, *"the workspace suite executed and green with no resolvable git
  identity"*

**The route, over this repository's own backlog**, through `mountRead` on a real `Project`:

```
rows                106      base main
pushLag             {"state":"unpushed","ahead":5,"upstream":"origin/main"}
folders distinct    106
empty ids           0        fabricated ids ("undefined")  0
rows with no folder 0
Q-0017              {"id":"Q-0017","folder":"Q-0017-backlog-board-and-ticket-page",
                     "stage":"requirements","containment":{"state":"contained"},
                     "iterations":{"requirements.head-of-product":1},"billedCostUsd":19.75}
unplaceable         []
```

106 rows and 106 distinct folders is the property the key rests on, measured rather than asserted.

**Not done, and it is the gate's rather than mine:** GO-7's post-merge both-row verification, and
opening the board in a browser. This environment refuses outbound connections from the shell, so the
socket-level proof here remains `static.test.ts`'s.

**On the review diff (GO-5, R-7):** this round is 234 insertions across seven files, far inside
`max_diff_bytes`, so unlike the last round the panel should see all of it. The previous round's six
omitted files are unchanged by this one except where named above.

---

## 6. What I deliberately left alone

- **Q-0060.** Nothing here parses, validates, migrates or rewrites `ticket.md`. The change makes a
  damaged ticket *nameable* and *countable*; the defect that produces one is untouched and open.
- **`quorum board`'s printed output.** Not a byte. No file under `packages/cli` is in this diff, and
  that command's 692 tests are green unchanged.
- **The `$0.00`-versus-`null` divergence** in `board.ts` — still registered in place, still not
  repaired.
- **`docs/06-development-plan.md`** — Q-0094 E-3(a), and GO-8 was discharged at the gate.
- **The thirteen criteria of iteration 1** and every artifact they touched: AC-4's narrowing, AC-15's
  three corrected override sites, the five moved board declarations, the byte-identical cost legend.
  Nothing in this round re-opens any of them.

## 7. Where the requirement did not cover a case, and what I chose

- **How the board learns an id is unreadable.** AC-8 says the region names *"its `id`, or its folder
  where the id is unreadable too"* and does not say how that is decided. I made the daemon answer
  `''` rather than making the browser recognise a literal. The alternative — keeping `"undefined"` on
  the wire and sniffing for that exact word in the renderer — is a guard keyed on a spelling, and it
  would still have left a card linking to `/backlog/undefined`.
- **A card whose ticket has a readable stage and no id** links to `/backlog/` (it linked to
  `/backlog/undefined` before; neither resolves). I left the `href` on the id rather than
  substituting the folder, because a folder basename is not a ticket token and what a ticket page
  does with a token it cannot resolve is **Q-0127's** decision 4. The card now at least names such a
  ticket by its folder instead of rendering an empty span.
- **Aborting a superseded request** rather than ignoring its answer. Not done: it changes
  `FetchLike`'s signature and adds a second mechanism for a property one counter already has. The
  docblock says what is and is not claimed.
