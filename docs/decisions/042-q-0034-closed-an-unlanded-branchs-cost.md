# Q-0034 closed: an unlanded branch's cost is not its merge conflict — 2026-08-24

**Decision:** Q-0034 is complete. `harness/Q-0006/integration` and `harness/Q-0011/integration` are
contained in `main`, with reconciliation records under `backlog/Q-0034-…/dev/` naming every
retained and reverted behaviour, and a fresh clone of `main` now carries the run-history feature the
docs have described since M1 and passes both CI jobs. Q-0011 was reviewed twice while still
unlanded, as its landing record required. The ticket's other two workstreams shipped as Q-0035
(open) and Q-0036 (landed the same night); Q-0037 holds the review findings that did not block.

**Alternatives considered:** Merging both branches without review, which is what "reconcile the
branches" sounds like and would have cost about twenty minutes — rejected, and the evidence is that
the two review rounds found four blockers and fourteen majors in work already marked `green`.
Re-deriving Q-0011's 48 commits as a fresh change — rejected: M1's closing entry cites several of
those SHAs, and a rebase or re-derivation rewrites evidence the record depends on.

**Why: the expensive thing about an unlanded branch is not the merge.** Both merges were, in the
end, unremarkable — Q-0006's was conflict-free by construction, and Q-0011's seven conflicted hunks
were five plain unions and two judgement calls. What cost money was everything the branches had
quietly stopped being true about:

- Q-0006's branch already contained a `PROBE_SCHEMA` fix, character for character identical to one
  rediscovered and re-paid for hours earlier the same evening. The bug had been found, fixed and
  parked in August.
- Q-0006's `input.diff` range guard demanded exactly `{base}...{integration}`. That was the review
  flow's shape when the guard was written on 2026-08-22. `chore.yaml`, decided on 2026-08-24,
  reviews `integration...implement` — so the guard landed and **broke a flow that did not exist when
  it was written**. Its companion, the run-level diff preflight, refused for a second, independent
  reason: chore's right endpoint is a branch the run itself creates, so it cannot be materialised
  before the first step. Neither is a merge conflict. Git had nothing to report.
- Q-0008 had run the chore flow successfully three hours before the landing, against a
  `materialiseDiff` that carried no guard at all. Nothing regressed; a stale branch simply arrived.

The generalisation is worth keeping: **a branch that sits accumulates semantic conflicts with
everything merged after it, and none of them appear in `git status`.** "Branches rot" understates
it — a rotting branch goes stale, whereas this one landed and actively broke something. The only
reliable detector is running the repository's own flows against the merged result, which is what a
`--dry` run did here for $0, because the `--dry`-must-not-mutate fix and Q-0006's preflight compose:
the preview now validates every diff range while being unable to write anything.

**The best review round was the one that reviewed the previous round's fixes.** Round 1 on Q-0011
returned four blockers, all closed within the hour. Round 2 returned zero blockers and fourteen
majors — and **three of the fourteen were defects in round 1's fixes**, made an hour earlier:

1. The path-traversal fix was lexical only. `path.resolve` does no filesystem work and `statSync`
   follows links, so a single-segment symlink inside `.quorum/runs/` passed every string test and
   still read a manifest anywhere on disk.
2. The AC-1 collision refusal threw after the `start` line was written and the catch rethrew without
   calling `finish()` — re-opening, in new code, the "run that started and then stopped existing"
   gap Q-0004 closed for interrupts. The comment three lines above it asserted the opposite
   invariant.
3. Its error message claimed "another run may be in flight", which `nextRunId` contradicts: ids are
   allocated from the `start` line, written before the directory exists, so a concurrent run takes
   the next id rather than colliding.

Fixes are a high-risk change class and they arrive with the least scrutiny — written under time
pressure, against a finding rather than a requirement, by someone who has just proven they
misunderstood the area. Review the fix round, not only the feature round.

**A frozen artifact can be under-specified rather than wrong.** `runs-cli.contract.md` states both
"zero matches … exit zero" (:12) and "a malformed sibling is named … and the final exit is
non-zero" (:18–19). Both apply to `harness runs Q-9999` against a store containing a corrupt
manifest; nothing said which governs. The implementation and its qa-red scenario read it one way,
both round-2 panellists read it the other, and **neither side was contradicting the contract**. That
is a different failure from Q-0006's E-1, where a contract clause was simply wrong, and it needs the
same instrument: erratum E-4 decides it for store health and re-points the scenario so both clauses
gain coverage, where before only the ambiguous case was tested. The tell for this category is that
both sides can quote the document.

**Two checks that could not answer the question they were asked.** Six branches appeared to hold
content missing from `main`, from `git diff main...<branch>` — a three-dot diff shows what a branch
added since the fork point, and keeps showing it after `main` acquires the same content by another
route. `git cherry` then reported all 25 commits absent, which is true of the *commits* and silent
about whether the *content* arrived. Only comparing the artifacts settled it: the contracts are
byte-identical on `main`, and every other file is larger and later there. This is the same error the
requirement itself made when it read `merge-tree`'s "changed in both" as "conflicts" and reported
five conflicting files where a real merge produces four. **Before trusting a git command as
evidence, state which question it answers.**

**Ticket size, working prospectively for the first time.** Q-0034's requirement came back at
seventeen criteria across three routings and the head-of-product refused it, proposing the split
that became Q-0035 and Q-0036. Q-0036, carved at that recommended size, returned **`ready` on its
first pass with zero findings** — the first first-pass approval this project has produced. The
2026-08-22 sizing decision was written from post-mortems; this is the first evidence of it
preventing the cost rather than explaining it.

**Cost.** About **$46.59** in billed Claude cost across the evening's flow runs — Q-0034's
requirements $7.19, Q-0011's two review rounds $12.60, Q-0036's four runs $26.81 — plus roughly
$3.53 on five `adapters --probe` round-trips and something over a million Codex tokens no roll-up
can price. Landing two branches, closing four blockers and thirteen majors, and shipping one feature
through the full chore flow came to roughly **$50**.

Two numbers inside that deserve naming. Q-0036's chore run reached a green `integrate` and then
**failed**, because a background process cannot answer a human gate — and `finish()` correctly rolled
the ticket branch back, discarding a merge that had just been proven green. $16.85 of completed,
reviewed, tested work became a failed run over an unanswerable prompt. Nothing was lost: the work
survived on its own branch and the merge was re-performed by hand and re-verified. But a gate that
cannot be answered turns a finished run into a failed one, and **M3's daemon must not inherit that**
— it is the difference between "the human has not decided yet" and "the run failed", which the
engine currently cannot express.

**Carried forward:**
- **Q-0035** — the empty-range diagnostic. Deliberately ordered after this ticket so `materialiseDiff`
  was not rewritten from two directions; that ordering already paid off once, when the range guard
  needed changing here.
- **Q-0037** — one major and eight nits from Q-0011's reviews, including the `runGate` timer that
  cannot be removed without editing a frozen qa-red fixture.
- **Q-0011's stage reads `red` while its code is contained in `main`,** because a review backward
  edge regressed it and nothing moved it back. Q-0036's board column now makes the contradiction
  visible rather than silent, which was the most it could honestly do; deciding what a stage means
  after a backward edge belongs to whichever ticket next opens the review flow.
- **The engine still has no lock on a ticket** (open since M1), and a non-interactive gate still has
  no way to say "undecided" rather than "failed". Both want settling before M3's daemon makes
  concurrent and unattended runs ordinary.
