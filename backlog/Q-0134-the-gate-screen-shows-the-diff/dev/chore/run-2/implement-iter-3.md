# Q-0134 — implement, run 2, iteration 3

Revision round. `review/chore/run-2/chore-iter-2.md` carried **one** finding, a major, and it is
addressed in full — with a correction to its premise that is recorded rather than smoothed over.
Nothing else in the branch was touched, and `packages/core` is byte-identical to the tip.

---

## 1. The finding, and what measuring it found

> major: `packages/server/src/host.ts:475` When the first iterator pull throws after
> `preflightDiffs` has already reported one or more valid diffs, `begin()` calls `refuse()` without
> clearing `record.evidence`; refused records are never pruned, so up to one capped patch per
> previously materialised site remains in daemon memory indefinitely despite no pending gate owning
> it. Clear the evidence map on the refusal path and add a regression with an earlier valid diff site
> followed by a preflight failure.

**Half of it is exactly right and is now fixed.** `refused()` is an exit `consume`'s `finally` never
covers — a refused start never becomes `running`, so the loop is never entered — and a refused record
is kept like every other (Q-0123). Nothing was releasing a map on that path.

**The other half — that the path is reachable with a patch in hand — is refuted, by measurement
rather than by reading.** I built the fixture the review asked for (a valid first diff site, then a
site naming a ref that does not exist) and ran it before changing anything:

```
PROBE       { "started": true, "state": "running", "failure": null, "refusal": null }
PROBE-AFTER { "state": "ended",
              "failure": "later: input.diff names missing ref \"harness/T-0001/nowhere\" — …" }
```

The start **succeeds**. Two independent mechanisms in `core` put it there, and either alone is
enough:

1. `engine.ts:364` emits the run's `info` line **above** `preflightDiffs(context)` (`:380`), and
   `channel.ts` is a lossless FIFO whose `next()` prefers a queued event to a closing error. The
   first pull therefore takes that event.
2. A run that throws inside its own `try` emits its **terminal event before** the error that closes
   the channel — `channel.ts`'s own documented guarantee, *"This is what lets a terminal event be
   observed before the failure it reports is thrown."*

So a first pull can reject only where the run threw having emitted nothing at all, which is above
that `try`: the stage precondition (`engine.ts:222`) and `acquireRunLock` (`:246`). Those are the two
refusals `host.ts`'s own header already names — *"Both of the refusals a start can meet happen before
any event is emitted"* — and neither can have reached a `materialiseDiff`. **Refused today, on this
tree, and stated as a property of two files in another package rather than of this one.**

**I implemented the clear regardless, and the reason is the sentence above rather than deference.**
The map is emptied on the exit that owns it, so the property is local: it does not rest on `core`
going on emitting before its preflight, and a refusal that ever did arrive after a materialisation
would otherwise retain up to `repo.max_diff_bytes` for the life of the process with nothing red. One
line, beside the `gates.release(record.handle)` already on that path, which is the pair `consume`'s
`finally` already has.

---

## 2. What changed, file by file

### `packages/server/src/host.ts` (+11 −2)

`refused()` gains `record.evidence.clear()` after `gates.release(record.handle)`, with a comment
recording **why it is unconditional though empty today** — the measurement above, compressed to the
two mechanisms and the conclusion, citing Q-0123 for the record never being pruned. No decision text
is transcribed.

`RunRecord.evidence`'s JSDoc said the map *"is cleared when the run ends whether or not any gate
wanted it"*; it now names both exits, because the declaration is where a reader looks for the
lifetime and a sentence naming one of two exits is the shape this ticket keeps refusing.

Nothing else in the file moved: no signature, no state, no route, no wire shape.

### `packages/server/src/gate-diff.test.ts` (+91 −3) — 17 tests → 18

**One new behavioural test**, under AC-6: *"a preflight that stops the run after materialising an
earlier site is not a refusal"*. It is the regression the review asked for, and it asserts what is
actually there:

- `outcome.started` is `true` — asserted **first**, because a refused start never reaches `ended` and
  asserting it after the wait would report a ten-second timeout in place of a one-line answer.
- the run reaches `ended` and its `failure` names `harness/T-0001/nowhere`, so the **second** site is
  what stopped it.
- **the premise is measured, not assumed**: `max_diff_bytes: 40` makes the first site truncate, which
  is the one thing a materialisation leaves on disk, and the ticket's `runs.log` is asserted to carry
  `diff truncated range=main...harness/T-0001/integration`. Without that clause the claim *a patch
  was in hand when the run stopped* would be read off the flow file rather than observed.

Its comment says plainly what each clause can still fail on, and says that the `started` clause is a
**recorded measurement rather than a guard to lean on** — see §3, where two mutations failed to turn
it red.

**One new source clause**, in the release test beside the three already there: `refused`'s body must
contain `record.evidence.clear()` and must still carry `gates.release(record.handle)`, with the
needle shown not to match the same text with the line removed. The instrument is the source for the
reason the existing `CLEARS` clause gives — `viewOf` projects no such field and `records` is never
pruned, so no behaviour this package exposes can see a retained map.

The test's name went from *"the two releases…"* to *"the releases…"* and its opening comment from
*"Two properties…"* to the four it now carries, so the count in the prose matches the clauses.

### `docs/04-architecture.md` (+4 −3)

The evidence-lifetime sentence said any unclaimed snapshot is *"cleared as the run ends"*. It now
names both exits — *"on both of a run's exits — as it ends, and on the refusal that never became a
run"* — because the code gained an exit and a document describing one of two is the drift this
repository keeps paying for. No status line change: this ticket's line already describes this route.

---

## 3. Red before green — one mutation red, and two that were not

A check is not established by reading it, so each clause was put to a mutation. **Two of the three
attempts left the suite green, and that is reported rather than dropped**, because it is what makes
the `started` clause a measurement rather than a guard.

| mutation | result |
| --- | --- |
| **the clear removed from `refused`** | **red** — `a refused start keeps whatever the run had already reported: expected false to be true`, from the new source clause, and nothing else |
| **`engine.ts`'s `info` emit moved below `preflightDiffs`** | **green** — the terminal event still settles the first pull, so the run still starts |
| **`channel.ts` made to let a closing error beat a queued event** (`settlePending` and `next` both reordered) | **green** — the queue is non-empty at the moment `start()` returns, so the pull never waits |

Both `core` mutations were reverted by hand and `git diff` confirms `packages/core` carries no change
(three files in the diff, none of them in that package).

The second and third are the evidence for §1's claim: the refusal path is unreachable-with-evidence
by **two** mechanisms, not one, so no small change to either would make this fixture red. The new
behavioural test is therefore honest about being a record of the routing plus a measured premise, and
the clean-up itself is pinned by the source clause, which **is** discriminating.

---

## 4. Measurements taken this round

- **`preflightDiffs` materialises in flow order before any step runs** — `diff.ts:581-598`, the
  review's premise, confirmed and unchanged.
- **Every path to a materialisation reports** — `diff.ts:429`'s `reportDiffEvidence`, so the first
  site of the fixture really does reach the host's callback.
- **The first pull cannot reject after a materialisation** — §1, measured through a real run and then
  twice by mutation.
- **The two reachable refusals are the stage precondition and the run lock**, both above the `try`
  that installs the terminal emission, and both above `nextRunId`'s successor — so neither has a diff
  to leak.
- **`records.delete` and `records.clear` are still absent from `packages/server`**, so Q-0123's source
  guard has nothing new to see: this change releases a map's contents and evicts no record.

---

## 5. What I deliberately left alone

- **`packages/core` — untouched.** The capture site and the report channel are correct; the finding
  was about what the host does with what it is handed on one exit. The two mutations above were
  diagnostic and reverted.
- **`packages/shared/src/diff-evidence.ts` and every wire shape** — nothing crosses differently, so
  AC-3 is untouched and `events.test.ts:239` stays green unamended.
- **`packages/server/src/gates.ts`** — its own two release paths were already correct and are what
  the first source clause pins.
- **The `no-diff` member and every other refusal** — unchanged; a refused start has no gate to read
  through in the first place.
- **`repo.max_diff_bytes`, the head-only cut, the `diff truncated range=` token, file ordering and the
  warning grammar** — non-goal 4. The new test *reads* that token rather than changing it, which is
  also why it is safe to read: `diff.test.ts`'s AC-9.5 already depends on it.
- **No criterion was trimmed**, and AC-1 and AC-4 — which erratum E-3 names as not eligible for
  trimming — are untouched by this round.
- **Two environment observations, reported and not acted on.** The pre-existing lint warning at
  `packages/core/src/backlog/backlog.ts:448` (an unused `eslint-disable` directive) is unchanged and
  is not mine to fix. And one forced run printed
  `warning: could not add .quorum/ to /tmp/q0042-repo-…/.git/info/exclude: no space left on device`
  from `@quorum/core:test`; the task passed, the volume has 269 GiB free, it did not recur on the
  final run, and I am **not** diagnosing it from one sighting.

---

## 6. Verification

`pnpm install --frozen-lockfile` → *Already up to date*, then
`pnpm turbo run lint typecheck test --force --continue` — `commands.install` and `commands.test`
verbatim, so what ran here is what `integrate` will run.

**21/21 tasks successful, 0 cached.** Test files: `shared` 15, `core` 67 passed + 1 skipped, `server`
11, `web` 21, `cli` 26, `compiler` 1, `templates` 1. `gate-diff.test.ts` is **18 tests** where it was
17. Lint: 0 errors, the 1 pre-existing warning above. Typecheck clean across all seven packages. Run
twice end to end — once mid-round and once on the final tree — with the same result.

---

## 7. Still open — the operator's at the gate, not mine

Unchanged from round 2 and stated rather than implied; none of it is work this step may perform:

- **GO-4** — the cross-vendor hand pass over the files the review got no patch for. This round's
  change is small, but `host.ts` and `gate-diff.test.ts` have been in the truncated tail before.
- **GO-5** — the product run by hand, the diff region transcribed into `runs.log` including a
  truncated case, and how the range was built (R-2: 42 of 42 integration branches are contained in
  `main`, so no ticket here has a non-empty range). The standard is Q-0016's failure.
- **GO-6** — forced verification in both environment rows, `quorum lint`, and the git-identity sweep.
- **R-5** — a first-round approve should be distrusted. The mutation table in §3 is what a reviewer
  that cannot execute the suite has to go on, including the two mutations that did **not** discriminate.

**One thing for the reviewer to weigh rather than for me to decide.** §1 refutes this round's finding
as a live defect while implementing what it asked for. If the gate reads that as the criterion being
met by a defensive clause rather than by a repair, the honest record is above: the exit had no
clean-up, it has one now, and what kept it harmless was two facts in another package that this
package does not own.

**Verdict: `proceed`.** Nothing here required a `docs/decisions/` entry — erratum E-1 ratified that
none is owed and this round changes no part of that ruling's subject — a file outside my paths, or
behaviour a landed decision preserves. Every file I touched is inside `packages` and `docs`.
