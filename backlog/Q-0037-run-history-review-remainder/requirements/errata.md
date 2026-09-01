# Q-0037 — errata to `requirements/merged.md`

Written during the chore run rather than at its exhaustion gate, per *"An erratum is the last
repair, not the first"* (2026-08-30) and *"A refused finding is a gate, not another round"*
(2026-08-31): the contradiction below was provable the moment review round 1 raised it, and a
revise round handed it would spend a budget on work no step on this route can perform.

---

## E-1 — AC-12 step 2 asks for a commit that contains its own SHA. It is amended, not attempted.

**What AC-12 says.** *"(1) every item with a counterpart lands in both trees in the same commit;
(2) `harness/port-charter.md`'s `freeze-sha:` is re-recorded at that tip, in that commit."*
`harness/port-charter.md` §3 carries the same wording — *"Re-record `freeze-sha` in the same
commit, at the tip that carries the mirrored change"* — so the criterion inherited the defect
rather than introducing it.

**Why it cannot be done.** The recorded SHA must name a commit that exists, is an ancestor of the
base, and after which the base holds no `spike/src` change. After this ticket merges, the merge
commit is the first commit satisfying all three. Writing it *into* that same commit would require
knowing the commit's own hash before it is created. There is no ordering of the work that closes
this: a pre-merge tip fails the third condition the moment the merge lands.

**The precedent already resolved it the achievable way, silently.** Q-0062 is the only ticket to
have walked this path. `a6e529a` is its merge commit, carrying the `spike/src` change; `9721d78`
is a **separate follow-up commit whose parent is `a6e529a`**, and what it records is `a6e529a`.
Two commits, not one — measured today with `git show 9721d78 --format=%P`, which prints
`a6e529a31e84893140cc4b01cc0b2f2013880ca2`. Q-0062's own plan entry describes this as *"the first
walk of charter §3's re-record path"* without noting that the path as written could not be walked.

**The ruling.** AC-12 step 2 is amended to: *the `freeze-sha:` is re-recorded in a follow-up commit
whose parent is the merge, and the value recorded is the merge commit's SHA.* Step 1 is unchanged
and still binds — both trees in one commit. The guard is then run against the new tip, which is
AC-12's `Test:` clause and is unaffected.

**Who performs it, and why no implement round can.** The merge is `integrate`'s, and the follow-up
commit is the human's at the close — the implementer's worktree branches from
`harness/Q-0037/integration` and the merge commit does not exist while it runs. **Review round 1's
first major is therefore correct in substance and unactionable as a revise instruction**, and its
own remedy says so in as many words: *"Re-record the SHA through the integration mechanism at the
post-merge tip and run the freeze-SHA guard against that tip before closing the ticket."* An
implement round that responds to it can only write a SHA that is wrong, or write prose about why it
did not. **It is discharged at the human gate and is recorded here so that a round which declines
it is declining correctly.** Ninth appearance in this repository of a loop handed work no step in
it can perform, and the second where the requirement's own text is what hands it over.

**Not amended:** the charter's §3 wording, which carries the same impossibility one layer up. It is
corrected at this ticket's close rather than mid-run, because `implement` runs with `repo: true`
and an authority document changing underneath a live loop is its own hazard. Recorded here so the
correction is not mistaken for scope creep when it lands.

**Review round 1's second major is not covered by this erratum and stands as an ordinary finding.**
`spike/bin/harness.js`'s new notice says *"no x-quorum-contract annotation"* while
`validateArtifact` returns `reason: 'unrecognised-annotation'` for **any** value other than
`run-manifest-v1`, a present-but-unknown one included — so the sentence is false for a schema
carrying `x-quorum-contract: unknown-v1`. The wording it replaced said *"no **recognised**
x-quorum-contract annotation"* and was true of both cases; dropping one word introduced the defect.
That is a real regression, it is the implementer's to fix, and it needs no ruling from here.

---

## E-2 — the implement report is not round-scoped, so a revise round destroys the previous round's evidence

**What review round 2 found, correctly.** Round 2's `dev/implement-report.md` omits the measured
evidence AC-3, AC-4, AC-5 and AC-8 require — the timer-removal red-before-green output, the `core`
inverse failing against an unmodified `routing.ts`, the shipped-path evidence table, and the
usage-line red-before-green demonstration. Round 2 changed only what round 1's review asked it to,
and said so; what it could not do is keep round 1's evidence, because it does not own the file.

**The cause is the flow, not the implementer.** `chore.yaml`'s `implement` step declares
`output: { writes: [dev/implement-report.md] }` — one flat path, rewritten by the engine on every
traversal. Reviews were exactly this until Q-0057 made them `review/chore/run-{run}/chore-iter-{iter}.md`;
**the implement report was left flat in the same change**, so the defect Q-0057 closed on one side of
the loop is still open on the other. A criterion whose evidence is produced in round 1 and whose fix
is reviewed in round 3 therefore has no artifact a reviewer can read, and the reviewer is right that
a general reference to *"round 1's work"* preserves nothing.

**Recovered rather than re-run.** Round 1's report survives at `dc673dd` — 471 lines, committed by
the E-1 commit's `git add -A` rather than by design, which is luck and is named as luck. Both rounds
are now durable and precisely citable, written by hand because no step on this route may write under
`backlog/`:

- `dev/rounds/run-2-implement-round-1.md` — 471 lines, the AC-3/AC-4/AC-5/AC-8 evidence
- `dev/rounds/run-2-implement-round-2.md` — 366 lines, round 2 as reviewed

**The ruling.** Round 2's major is **satisfied by its own second remedy** — *"or provide a durable,
precise reference to an artifact containing them"* — and no further implement round is owed for it.
A round that responds by re-running and re-pasting round 1's measurements is spending a budget to
reproduce evidence that already exists at a known path; a round that cites the two paths above has
discharged it. Neither is a code change, and **no acceptance criterion's substance is in question**:
the finding is about where the evidence lives, not whether it was produced.

**Not fixed here.** Making `implement` round-scoped is a change to `chore.yaml` in both shipped
copies plus both templates, and to the engine's write path if the report is to carry `{iter}` — which
is Q-0057's shape and Q-0057's argument, and is not this ticket's subject. It is recorded so the next
chore ticket with a multi-round loop does not rediscover it at the same cost. The successor is worth
opening at this ticket's close rather than now.
