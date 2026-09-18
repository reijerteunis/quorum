# Q-0018 — implement, run 2, iteration 2

*A revision round. `review/chore/run-2/chore-iter-1.md` returned four majors; **all four are real and
all four are fixed**, each demonstrated red against the code as it stood before being trusted green.
Nothing else moved: the scope is still erratum **E-1**'s manifest-read half, and this half still
composes no filesystem path.*

**Verdict: `proceed`.** No finding required a `docs/decisions/` entry, a file outside
`developer-generalist`'s paths, or behaviour a landed decision preserves. E-3's *does any landed
sentence go false?* test was re-applied at each site touched below and the answer is still no — the
one document edit is a clause added to a paragraph this ticket already wrote.

---

## The four findings

### M-1 — `read.ts`: a roll-up element it could not read was dropped rather than refused

**Real, and it is the finding of the round**, because the misreport was invisible from the listing's
own answer. `historyRow` narrowed a roll-up row to its four fields through `rollupRows`, which
**filters**: an element that is not an object with a string `vendor` was silently removed, so a
manifest carrying `rollup: [42]` composed a perfectly valid row and listed as a sound run that
**billed nobody**. The row then parsed, so `warnings` said nothing either.

**And it made the two routes disagree about one file, which is what makes it more than cosmetic.**
`wireRunHistorySchema` declares `manifest.rollup` over `wireVendorRollupSchema`'s elements and the
detail route sends the manifest whole, so a browser refuses that same manifest on
`GET /history/:id` while the listing reports it as fine. That contradicted a sentence in
`historyRow`'s own JSDoc — *"a manifest this refuses is one that route was already refusing"* —
which was written as a claim about this function and is really a property of what it projects
through.

**Fixed at the projection rather than at the call site.** A new `listingRollup` narrows to the four
fields and **drops nothing**: an element that is an object has its four fields read off whatever is
there, and one that is not crosses **as it stands**, so `wireRunHistoryRowSchema` is what judges it
either way and a run it refuses is NAMED in `warnings` with the parser's own words. Handing the
element on unchanged is deliberate — reading `.vendor` off `null` throws, and substituting an empty
object would report a damaged row as a missing one.

**`rollupRows` is left exactly where it is, and that is a distinction rather than an oversight.** The
detail route derives `tokensByVendor` from it *and sends the manifest whole beside it*, so an element
it cannot read is still in front of a reader; on the listing the projection **is** the answer, and a
filter there is this route deciding a manifest it could not read describes a run with fewer vendors.
Both functions now carry that reasoning, each naming the other.

The JSDoc sentence that was false while the filter was in place is corrected in place rather than
deleted, and says what it was false about.

### M-2 — `history-screen.tsx`: a collapsed row re-opened itself

**Real.** `toggle`'s collapse branch cleared `opened` **without spending a generation**, so a detail
read already out still matched `generation.current` when it resolved and its `setOpened` re-opened
the row — under the reader's hands, with nothing on screen having asked for it.

The collapse spends a number now. The counter's own comment says why, because *discarding* a read is
the case it did not cover: it was written for the mount, Refresh and a row being opened, all of which
**start** something.

**One counter still, deliberately.** A second would not be safe: a Refresh must invalidate a detail
already out, which is what one counter gives. And bumping it on collapse cannot strand a listing
read — while one is in flight the screen renders the heading alone, so no row exists to collapse.

### M-3 — `history-screen.tsx`: Retry on a failed detail did nothing at all

**Real.** The Retry is rendered on a row that is already open, and it called `toggle(run.id)`, which
took the collapse branch: a control naming a remedy and performing none.

`openRun(id)` is now its own function — the read, and only the read — and `toggle` is *open-or-close*
over it. Retry calls `openRun` directly. The JSDoc says the trap rather than the mechanism, since the
mechanism is two lines and the trap is what a later reader would walk back into.

### M-4 — `history-screen.tsx`: a store nobody could read was reported as a store nobody had written to

**Real, and it is `runs: []` meaning two opposite things.** Every empty listing rendered
`EMPTY_HISTORY_TEXT`, which tells a reader nothing has ever run here and says what would make
something run — true of an adopter's fresh clone, and false of a store whose every run the daemon
could not read, where the region immediately below names the runs that **are** there. That is *"A
probe that could not answer is not a negative"* (2026-09-10) on a screen: it sends somebody looking
for a flow to start rather than at the reasons underneath.

The two are told apart, and `NO_READABLE_RUNS_TEXT` is the second sentence. **It says no remedy**,
because the reasons do — each is one sentence in the daemon's own words, and a remedy composed here
would be this screen guessing which of them it was. The markers are distinct
(`data-history-empty` against `data-history-none-readable`) so a clause about either can only be
satisfied by that one.

---

## File by file

- **`packages/server/src/read.ts`** — `listingRollup` added beside `rollupRows`, each JSDoc naming
  the other and stating which shape of narrowing belongs where; `historyRow` projects through it;
  `historyRow`'s JSDoc gains the clause recording that its *"already refusing"* sentence was false
  while the filter was in place, and why.
- **`apps/web/src/history-screen.tsx`** — `openRun` split out of `toggle`; the collapse branch spends
  a generation; Retry calls `openRun`; the empty branch renders one of two sentences; the generation
  counter's comment covers discarding as well as starting.
- **`apps/web/src/history-text.ts`** — `NO_READABLE_RUNS_TEXT`, with the reasoning for saying no
  remedy in its own JSDoc.
- **`docs/04-architecture.md`** — one clause in the `apps/web` paragraph this ticket wrote: an empty
  table is two opposite answers and they are told apart. **No correction was owed elsewhere** — the
  `packages/server` paragraph already says *"a run the route cannot compose a row for is named in
  `warnings` rather than taking the listing with it"*, which was the property the filter was quietly
  exempting the roll-up from, and is now true of it too.
- **`packages/server/src/read.test.ts`**, **`apps/web/src/history-screen.test.ts`** — one test per
  finding.

## What the four fixes have in common, stated because it is the transferable part

**Two classes, two apiece.** M-1 and M-4 are *an answer that could not be composed reported as one
that could* — a roll-up shrunk in silence, and an unreadable store rendered as an unwritten one; both
fixes move the decision to where the value is produced and let the thing that judges it judge it.
M-2 and M-3 are *a read's lifetime managed at the control rather than at the read* — collapse not
spending it, Retry not starting one; both fixes separate the read from the toggle over it. Neither
class is new here, and the first is this repository's most-recorded one.

## Verification

`pnpm install --frozen-lockfile` then `pnpm turbo run test --force --continue` — the two
`harness.yaml` commands verbatim — **7/7 tasks, 0 cached, green**. With `typecheck` and `lint`:
**14/14 tasks, 0 cached**. `pnpm exec quorum lint` **6/6**. `pnpm sweep:git-identity` green:
*"the workspace suite executed and green with no resolvable git identity"*.

**Each new clause was shown red against the code as it stood, then restored and re-verified** —
a green test nobody has seen fail is a declaration, not a check:

| Mutation (the code as review round 1 found it) | Message |
| --- | --- |
| `historyRow` projects through `rollupRows` again | *a run whose roll-up could not be read was listed anyway: expected [ 'T-0001-1', 'T-0001-2' ] to strictly equal [ 'T-0001-2' ]* |
| collapse does not spend a generation | *a detail that arrived after the row was closed re-opened it: expected `<div …>` to be null* |
| Retry calls `toggle` | *Retry issued no request at all: expected [ '/history', '/history/Q-0018-1' ] to have a length of 3 but got 2* |
| the empty branch renders one sentence | *a store nobody could read was reported as one nobody had written to: expected `<p …>` to be null* |

**Three of the four tests assert more than the defect they were written for**, because the narrow
form would pass over the next implementation of the same mistake. The server clause asserts the
detail route now refuses the same manifest, which is the *disagreement* half and is the thing the
listing's own answer cannot show. The Retry clause counts requests and names the path, because a
clause over the rendering alone passes for an implementation that merely re-renders the failure. The
empty-store clause asserts both directions, so it cannot be satisfied by a screen that renders the
new sentence over every empty table.

**The collapse test stages the race rather than reasoning about it**: the detail body is a promise
the test settles, so the collapse genuinely happens while the read is outstanding, and the clause
that the read *was* still out is asserted first so the case cannot pass vacuously.

## Deliberately left alone

- **`rollupRows` and the detail route.** Its filter is correct where it is used, for the reason now
  written into both functions. Changing it is a behaviour change to a shipped screen's payload and
  no finding asked for one.
- **`GET /project`'s missing shape** (non-goal 4), **the occurrence-array duplication** (non-goal 6,
  registered with its 42.7% figure), **the live-run join** (OQ-3, recipe and `dry` trap recorded),
  **Q-0137's retained files**, and **`docs/06-development-plan.md`**, which is rewritten by hand at
  each plan pass.
- **`packages/core`'s one pre-existing lint warning.** Not my file, not repaired in passing.

## Not discharged here

GO-4's by-hand cross-vendor pass over whatever the diff cap omitted, GO-5's run of the product with
what it rendered transcribed, and GO-6's second environment row are the gate's. **This round's diff
is small — 242 insertions across six files — so R-5's prediction is unlikely to bite on it**, but the
review reads the branch rather than the round, and the branch's alphabetical tail is still
`packages/shared/src/wire.ts`, AC-1, AC-2 and AC-5's own subject. This worktree holds no run store,
so GO-5's table over this repository's own runs is not reachable from here.
