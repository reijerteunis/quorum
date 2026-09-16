Implement report — Q-0127, chore run 2, iteration 2
===================================================

A revision round. Review iteration 1 returned two majors, both in `apps/web/src/ticket-page.tsx`,
and **both are one defect with two entrances**: a file request that outlives the thing that asked
for it. Both are fixed, each with the case that stages it and a mutation that shows the case red.
Nothing else moved — no route, no wire shape, no `core` function, no criterion's substance.

**Verdict: proceed.** Nothing here needed a `docs/decisions/` entry, a file outside my paths, or
behaviour a landed decision preserves.

The change is **2 files and 172 insertions**, against iteration 1's 23 and ~2,214.


The two findings
----------------

### Major 1 — `ticket-page.tsx:213`: file requests shared the page counter, so a superseded answer arrived on top of a newer one

Correct as reported. `open` captured `generation.current`, which moves only when a **load** starts
or the screen unmounts — so two files opened within one load both matched it and whichever answered
last is what the region showed. That is the older one whenever a large file is opened before a small
one, and the heading above it names the newer, so the text and the name came from two different
requests. The reviewer's second half is the same bug through the one request a reader did not start:
the mount asks for `ticket.md` itself, so it is always in flight while the first choice is made.

**A second counter, not a `rel` comparison.** The review offered either; `rel` alone does not
separate two requests for the same file, and it answers *which file* rather than *which request*,
which is the question being asked. `fileRequest` is bumped by `open`, and **also by `load` and by
the unmount** — every act that invalidates the page invalidates a file request with it, which is
what makes the single comparison in `open` the whole test rather than half of one. Without the
`load` bump a request from before a Refresh would answer into the region that Refresh had just
emptied, with `selected` already null.

### Major 2 — `ticket-page.tsx:301`: a tab change kept the previous tab's file

Correct as reported. `setTab` alone left `selected` and `file` standing, so the file region rendered
one tab's text beneath another tab's list, named by a path that list does not hold.

**Cleared rather than kept per tab**, which is the smaller of the two remedies offered and the one
that cannot render a file from another tab at all; per-tab memory is more state and the requirement
authorises neither, so I took the one that closes the finding. The region then says
`CHOOSE_FILE` — a sentence rather than the blank panel `docs/04-architecture.md` forbids.

**The counter is bumped with it**, and that half is not cosmetic: clearing alone empties the region
and an answer already in flight fills it again a moment later, under a tab that does not hold it.
That is the fourth test below, and it is red against clearing-without-the-bump.

**One thing the finding did not name and the fix would otherwise have introduced.** Clearing
unconditionally makes clicking the tab you are already on a way to close the file you are reading.
`showTab` returns early when the name is the tab already shown, with its own test.


File by file
------------

### `apps/web/src/ticket-page.tsx` (+41 −4)

- `fileRequest`, a second `useRef` counter, with a comment stating what the page counter cannot
  tell apart and why `load` and the unmount bump this one too.
- `open` settles against it instead of against `generation`.
- `load` bumps both; the effect cleanup bumps both.
- `showTab`, in the render body where `shown` is in scope: return early on the tab already shown,
  else bump the counter and clear `tab`, `selected` and `file`. The nav calls it instead of `setTab`.
- `openLog` is **unchanged**, with one added comment saying why it keeps the page counter — see
  *"What I measured and deliberately did not do"* below.

No new state, no new hook, no new module, and no change to what the page fetches or when.

### `apps/web/src/ticket-page.test.ts` (+135)

A `deferring()` daemon that parks each request's resolver under the path it asked for, so a test
settles them in any order it likes. The existing `daemon()` answers every request before the next can
be made, so it cannot reach the case two in-flight requests create — which is the whole of what both
findings are about. A `settle` naming a path nobody asked for **throws** rather than passing
silently: the staging is half the assertion in each case.

Five tests, in one describe naming both criteria:

1. **two files opened in a row, answered in reverse order** — b then a; a is dropped, b stays, and
   the heading still names the file whose text is shown, which is the half that makes the defect
   visible rather than merely wrong.
2. **the mount's own `ticket.md` answer does not land on a file chosen after it** — the reviewer's
   second half, staged through the one request a reader never started.
3. **changing tabs leaves no file from the tab before it** — its text gone, its path gone, no
   `aria-current` survivor, `CHOOSE_FILE` in the region, and the tab asked for showing its own files.
4. **a file request the leaving tab started lands nowhere** — the discriminator for the counter
   rather than for the clearing.
5. **clicking the tab already shown is not a way to close the file being read.**


Shown red before green, four mutations, four distinct signatures
----------------------------------------------------------------

Each mutation was applied on its own, over the same tests, and reverted:

| mutation | red | message |
| --- | --- | --- |
| `open` settled against `generation` again (the reported defect) | **3** | *"a superseded answer arrived on top of the newer one"*, *"the mount's own request overwrote the file a reader asked for"*, *"a request from the tab that was left answered into the tab that replaced it"* |
| `showTab` no longer clears `selected`/`file` | **2** | *"the previous tab's file is still rendered under this tab's list"*, and the missing `CHOOSE_FILE` |
| `showTab` clears but does not bump the counter | **1** | *"a request from the tab that was left answered into the tab that replaced it"* |
| the same-tab guard removed | **1** | *"clicking the current tab discarded the file open under it"* |

**The third row is the one worth reading.** With the clearing in place and the bump removed, only
test 4 fails — so that test is red for the counter's own sake rather than being shown red by its
neighbour, which is Q-0107's distinction between a guard that has been established and one that has
merely been observed failing beside another.


What I measured and deliberately did not do
-------------------------------------------

**The run log did not get a counter of its own**, and the reason is a measurement rather than a
preference. `openLog` is reached from exactly two places: `load`, which bumps `generation` and so
supersedes whatever was out, and the rail's Retry, which `canRetryRequest` renders **only once the
request it would repeat has settled** — a promise resolves once, so the one it replaces cannot
arrive afterwards. Two log requests are therefore never in flight together, and a counter there
would be a guard nothing could turn red, which is the defect class this repository records most.
The reasoning is one line in the source beside `openLog` rather than in this report alone, because
the next reader will ask why one region has a counter and the other does not.

I also did not widen either finding into the neighbouring screen: `backlog-board.tsx` issues its two
requests together and settles them together against one counter, which is the shape its own comment
argues for, and it has no second region a slower answer could cross into.


One guard caught my own prose, and it was right
-----------------------------------------------

`apps/web/test/source.test.ts`'s containment-synonym scan went red on this change:
*"ticket-page.test.ts says landed"*. One assertion message read *"a superseded answer landed on top
of the newer one"* — about a request answering, not about a branch — but the rule is that `src/`
does not use **merged**, **landed** or **shipped** at all, and a word scan cannot read intent.
Reworded to *"arrived"*. The guard was **not** narrowed to fit the sentence: narrowing a check to
accommodate the text that tripped it is the failure this repository has paid for repeatedly, and the
rule costs one word.

It is also the reason the full suite matters and the single file does not: the ticket-page suite was
green through all four mutation runs while `test/source.test.ts` was red, because that scan lives in
another file and walks the package.


What I deliberately left alone
------------------------------

- **Everything iteration 1 shipped.** The two routes, the two `core` functions, the barrel, the wire
  shapes, AC-14(a)/(b)/(c), the architecture paragraph and every register are untouched — the two
  findings are in one component, and a revision round that also tidied its neighbours would hand the
  next review a diff it cannot tell apart from the fix.
- **Per-tab selection memory.** Not authorised by any criterion, and the finding's own remedy list
  offers clearing as the alternative; the reader re-opens a file in one click.
- **`billedCostOf`, `readFiles`, `dirOf`'s preserved prefix match, Q-0060's parser**, and any cap,
  pagination or truncation (non-goal 7).
- The pre-existing `no-control-regex` lint warning in `backlog.ts`, measured as `HEAD`'s.


Still not covered, carried forward unchanged from iteration 1
-------------------------------------------------------------

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

- `pnpm install --frozen-lockfile` → *Already up to date*.
- `pnpm turbo run test typecheck lint --force --continue` → **21 successful, 21 total, 0 cached.**
- `pnpm turbo run build --force` → **5 successful, 0 cached**, 5.5 s.
- `pnpm exec quorum lint` → **6/6**.
- `pnpm sweep:git-identity` → *the workspace suite executed and green with no resolvable git
  identity*, 7/7 tasks 0 cached.
- `apps/web` alone: **231 tests, 14 files**, of which `ticket-page.test.ts` is **24**.


Notes for the reviewer
----------------------

**This round's diff is 172 insertions across two files**, so R-2's truncation hazard — which cut
every one of Q-0017's three reviews and which iteration 1 predicted for its own — does not reach it.
The whole change is in one component and its suite, and the four mutation signatures above are the
fastest way to check that each clause is load-bearing rather than read as though it were.
