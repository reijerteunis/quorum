Implement report — Q-0127, chore run 2, iteration 3
===================================================

A revision round. Review iteration 2 returned two majors — one in `apps/web/src/app.tsx`, one in
`apps/web/src/daemon-client.ts` — and **both are correct as reported**. Both are fixed, each with
the case that stages it and a mutation that shows the case red for its own sake. Nothing else
moved: no route, no wire shape, no `core` function, no criterion's substance, and `app.tsx` is
byte-identical.

**Verdict: proceed.** Nothing here needed a `docs/decisions/` entry, a file outside my paths, or
behaviour a landed decision preserves.

The change is **3 files and 267 insertions**, against iteration 1's 23 files and ~2,214 and
iteration 2's 2 and 172.


Major 1 — the commit a navigation makes was the previous ticket's whole page
---------------------------------------------------------------------------

### It was measured before it was fixed, and it is worse than the finding says

The finding was reproduced with a throwaway probe before a line changed, because *"the existing
test flushes effects inside `act`"* is a claim about an instrument and the thing worth knowing is
what the instrument was hiding. A prop reaches a component before any effect reacting to it, and a
`useEffect` is a passive effect React schedules **after** the commit — so `flushSync` renders and
commits synchronously while the effect that reloads stays queued, and reading the container between
the two is reading exactly the commit the reviewer names.

What that commit held, verbatim from the probe:

```
Q-0001a ticketRefreshstage draft · owner ruud · cost n/aLoaded from the daemon, as of
2026-09-16T09:00:00.000Z.ticket.mdticket.md · 812 bytesticket.md · 17 bytesFIRST-TICKET-TEXTRun
logThis ticket has no run log: no run has written one.
```

Under the new id. **Not a residue — the whole page**: the previous ticket's id in the header, its
title, its stage, its owner, its cost, its listing, the file it had open and the run-log rail, all
committed to the DOM and painted, for as long as it takes React to flush a passive effect. The
finding says *"detail, selected file, and run log"*; it is also the header, which is the part that
makes it a page claiming to be a ticket it is not.

### The remedy taken, and why it is the second of the two offered

The finding offers remounting by key in `app.tsx` or gating rendered state synchronously. **I took
the gate**, and the reason is where the property then lives. A `key` in the caller is a
correctness-critical attribute in a module that holds none of the state it protects: the component's
own suite renders `TicketPage` directly, so no test in `ticket-page.test.ts` could prove it, and any
second caller — another screen, a test, a future route — reintroduces the defect silently. The gate
is a property of the component, so every caller gets it and the component's own suite is where it is
proven.

`loadedFor` is a piece of state stamped by `load` and compared in the render body:

```tsx
const shownDetail = loadedFor === ticketId ? detail : ticketInFlight<WireTicketDetail>(ticketId);
```

**Nothing is cleared here, which a render may not do — it stops being rendered**, which is the same
guarantee one commit earlier. And it is **one comparison** rather than five, because everything else
this page draws — the tabs, the file list, the file region, the run-log rail — is drawn inside the
branch below `shownDetail.kind !== 'loaded'`. A state that did not come from this ticket cannot
reach any of them.

What a reader sees in the gap is what a mount shows: the request being waited for, naming the id the
URL now carries. Not a blank panel, which `docs/04-architecture.md` forbids, and not a spinner.

### The test, and both directions of it

`ticket-page.test.ts` gains one case in the AC-9 block, beside the clause it strengthens. It uses
the `deferring` daemon iteration 2 added, so the replacement request is held and nothing settles in
between, and it reads `container.textContent` immediately after `flushSync` inside `act`. Four
assertions on the commit — no file text of the ticket before it, no id or frontmatter of it, the new
id present, and the path being waited for named — and then **the other direction**: the replacement
request is settled and the ticket that was navigated to must render. Without that half, a gate that
simply refused to render anything ever again would satisfy every assertion above it.


Major 2 — `daemon-client.test.ts` exercised neither new reader
-------------------------------------------------------------

Correct, and AC-8's *Test:* clause is explicit about what was owed: *"each function is driven
through a stub returning a good body, a 404 refusal, a 422 refusal, non-JSON, and a well-formed body
of the wrong shape — five distinct states, no two collapsing, each with retry where
`canRetryRequest` allows it."* That file covered `fetchTickets` and `fetchFlows` and neither of the
two this ticket adds.

**The component suite is not a substitute, and the mutation below is why.** A screen test cannot say
whether a body was *validated*: a client that assigned `JSON.parse`'s result to an interface renders
identically until the day the daemon's shape moves — and when I mutated `fetchTicket` to skip
validation, the component suite did go red, but by **crashing** inside `tabsOf` with *"files is not
iterable"* and an unhandled rejection. That is a defect discovered at the rendering layer, three
frames from the module that failed to execute a schema.

### What was added

A table over both readers, each declared with its path, the body its schema accepts, a well-formed
body of the wrong shape, and **the two refusals its own route raises** — read out of
`packages/server/src/read.ts` rather than invented: `no-such-ticket` and `malformed-ticket` for one,
`no-such-file` and `unsupported-file-encoding` for the other. That is what makes the 404 and the 422
two answers rather than one status apart.

Five answers, **three states** — two refusals and two unparseable bodies share a kind — so what is
asserted is the pair a reader acts on, `kind` plus the code or the problem that tells each from its
sibling. A `signature` reduces a state to that pair, and a separate clause asserts the five
signatures really are five.

Per reader, nine cases: the five answers, its generated path, its in-flight path naming that same
path, that an accepted body survives unchanged with the clock's instant on it, and that a field the
wire does not declare is refused rather than passed on — `.strict()` from the browser's side, which
is a version disagreement to report rather than a thing to drop silently on the way through. Plus
one clause outside the table, on the near-homograph: one path is a prefix of the other, so a reader
that built the wrong one would still be answered by a daemon and would still parse.

`canRetryRequest` is asserted on every case, which is the *"each with retry where `canRetryRequest`
allows it"* half.


Shown red before green — four mutations, four distinct signatures
-----------------------------------------------------------------

Each applied alone, over the same tests, and reverted.

| mutation | red | signature |
| --- | --- | --- |
| the gate reverted (`shownDetail = detail`) | **1** of 25 | *"one ticket's file was committed under another ticket's id"*, with the previous ticket's whole page in the message |
| `setLoadedFor` dropped from `load` | **1** of 25 | *"the ticket that was navigated to never rendered"* — `'Q-0002Asking the daemon for /tickets/Q-0002…'`, a page stuck in flight forever |
| `fetchTicket` given a schema that accepts anything | **3** of 30 | *"a well-formed body of the wrong shape did not answer unparseable"*, *"an undeclared field was accepted"*, and the collapse clause at 4 rather than 5 |
| `fetchTicket` pointed at `DAEMON_ENDPOINTS.tickets` | **1** of 30 | *"the reader asked for a path the endpoint register did not build: expected `['/tickets']` to strictly equal `['/tickets/Q-0127']`"* |

**Rows one and two are the ones worth reading.** Each turns exactly one test red, and it is the new
one — so it is red for its own sake rather than shown red by a neighbour, which is Q-0107's
distinction between a guard that has been established and one that has merely been observed failing
beside another. They are also two *different* failures of the same fix, which is what says the gate
and the stamp are both load-bearing rather than one covering for the other.

The file half of the table was proven separately by giving `fetchTicketFile` the detail schema:
three red, including *"a body its schema accepts did not answer loaded"* and the collapse clause —
so the parameterised block discriminates for both readers and not only for the one I mutated first.

**One mutation was uninformative and is recorded rather than dropped.** The first attempt at the
file-schema swap named `wireTicketFileEntrySchema`, which that module does not import, so ten tests
failed with `ReferenceError` — a mutation that proves the module was loaded and nothing else. Redone
with a schema in scope. A mutation whose red is a different failure from the one being staged has
not shown the clause anything.


File by file
------------

### `apps/web/src/ticket-page.tsx` (+24 −6)

- `loadedFor`, a `useState` stamped by `load` and compared in the render body, with a comment saying
  what an effect cannot do in time and why the state is not cleared here.
- `load` stamps it alongside the two counters it already bumps.
- `shownDetail` at the top of the render body; the early-return branch and the loaded branch both
  read it, so `detail` is reached in exactly one place.

No new hook, no new module, no change to what the page fetches or when, and no change to either
counter iteration 2 added.

### `apps/web/src/ticket-page.test.ts` (+52)

One case, `and the commit that navigation makes renders nothing from it either`, in the AC-9 block
beside the clause whose instrument could not reach it. Its comment says why `flushSync` is the
instrument and what the commit held before the fix, so the next reader does not have to re-derive
the mechanism to know what the test is about. 24 tests → 25.

### `apps/web/src/daemon-client.test.ts` (+197)

One describe, `AC-8 — fetchTicket and fetchTicketFile, over every answer their routes give`, driven
from a two-row `READERS` table. 9 tests → 30.

The `flushSync` import is from `react-dom`, the same already-declared package as the existing
`react-dom/client` import, so `test/package.test.ts`'s pinned dependency set is untouched in both
directions.


What I deliberately left alone
------------------------------

- **`apps/web/src/app.tsx`.** Unchanged, and that is the choice rather than an omission — see the
  remedy note above. Keying there and gating here would be two mechanisms for one property, and the
  second caller would still be the one that decides.
- **Everything iterations 1 and 2 shipped.** The two routes, the two `core` functions, the barrel,
  the wire shapes, AC-14(a)/(b)/(c), the architecture paragraph, every register, and both request
  counters. Neither finding reaches them, and a revision round that also tidied its neighbours hands
  the next review a diff it cannot tell apart from the fix.
- **A `useLayoutEffect`.** It would close the same gap by running before paint, and it is the wrong
  instrument: it would still be an effect clearing state after a commit, and it would make the fix
  depend on React's flush ordering rather than on the component rendering only what it has an answer
  for.
- **Per-tab selection memory**, `billedCostOf`, `readFiles`, `dirOf`'s preserved prefix match,
  Q-0060's parser, and any cap, pagination or truncation (non-goal 7).
- The pre-existing `no-control-regex` lint warning in `backlog.ts`, measured as `HEAD`'s.


Still not covered, carried forward unchanged
--------------------------------------------

Neither moved this round and neither is new; repeated so they do not disappear between reports.

1. **A dangling symlink inside a ticket folder makes `GET /tickets/:id` answer 500.** `pathInside`
   refuses a name that stands there and does not resolve — the clause that stops a write following a
   link out of the folder — and `listTicketFiles` refuses rather than skipping. What is missing is a
   **status**: §3's table has six codes and none is *this folder holds a name I cannot confine*. I
   did not invent a seventh. Zero symlinks exist under `backlog/` today.
2. **The `no-such-file` 404 arm has no test that can stage it.** Membership is derived from the
   listing this same request computed, so a file that has stopped being one has also left the
   listing and is refused 400 — asserted, with the same path shown answering 200 first. The 404
   answers only the interleaving R-4 names, which no test can stage without interleaving the two
   reads. The predicate underneath is covered in `packages/core`; the mapping from `null` to 404 is
   the uncovered line.


Verification
------------

Forced in this worktree, which has neither `.harness/worktrees` nor `.quorum/runs`:

- `pnpm install --frozen-lockfile` → *Already up to date*, 216 ms.
- `pnpm turbo run test typecheck lint --force --continue` → **21 successful, 21 total, 0 cached**,
  1 m 53 s.
- `pnpm turbo run build --force` → **5 successful, 0 cached**, 4.2 s; the served bundle 322.79 kB.
- `pnpm exec quorum lint` → **6/6**.
- `pnpm sweep:git-identity` → *environment discriminates (negative and positive probes both as
  expected)*, then *the workspace suite executed and green with no resolvable git identity*, 7/7
  tasks 0 cached.
- `apps/web` alone: **253 tests, 14 files** — `ticket-page.test.ts` 25, `daemon-client.test.ts` 30.


Notes for the reviewer
----------------------

**This round's diff is 267 insertions across three files**, so R-2's truncation hazard — which cut
every one of Q-0017's three reviews and which iteration 1 predicted for its own — does not reach it.
The whole change is one component, one component suite and one client suite.

The four mutation signatures above are the fastest way to check that each clause is load-bearing
rather than read as though it were. The two worth running first are rows one and two: they are the
same fix failing in two different ways, which is what says the gate and the stamp are not one
mechanism written twice.
