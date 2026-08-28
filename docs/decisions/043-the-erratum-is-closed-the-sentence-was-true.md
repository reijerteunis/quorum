# The erratum is closed: the sentence was true, and it was still the wrong sentence — 2026-08-25

**Decision:** *"Erratum: M1's closing entry on Q-0006's empty diff — 2026-08-24"* is closed. The
sentence the engine printed at Q-0006's review run 10 — that `harness/Q-0006/integration` *"is
already merged into"* `main` — **was accurate at the time, in both of its claims**, to the strength
the durable record supports and no further. The ancestry fact held, and so did the historical
event: the branch had genuinely been merged into `main` by a real merge commit, 24 hours and 50
minutes before the run began. What the erratum could not reproduce on 2026-08-24 was an artefact of
the branch having moved *after* that review, not of a wrong diagnosis. M1's closing entry is
therefore right on the substance and wrong only in its interval — it says "hours earlier" where the
record says a day and an hour. The qualification is not decoration: establishing which commits the
run compared is itself an inference from committed history, and the limit of that inference is
stated below rather than glossed.

The engine's message is replaced anyway, and the reasoning is the point of this entry: it was
accurate because the common case happened to be the true one, not because it had the evidence for
what it said. Q-0035 replaces it with the evidence — both endpoints and the short SHA each
resolved to, the containment check verbatim, and that check's outcome as one of `contained`, `not
contained` or `indeterminate` — and with the vocabulary the board settled on 2026-08-24, which says
"contained" and never "merged", "landed" or "shipped".

**The evidence, transcribed rather than prescribed.** Each command is named with the question it
answers, per the lesson Q-0034 recorded as *"before trusting a git command as evidence, state which
question it answers."* Timestamps are `%cI` committer dates in `+02:00`; `runs.log` is UTC, so run
10 spans **2026-08-24 00:58:25 → 01:11:00 +02:00**.

| # | Question | Command | Answer |
| --- | --- | --- | --- |
| 1 | When did run 10 start and end? | `backlog/Q-0006-…/runs.log` | `2026-08-23T22:58:25.691Z run=10 flow=review start stage=green` … `2026-08-23T23:11:00.943Z run=10 regressed stage=green→red cost=5.023` |
| 2 | Where did `main` point during the run? | `git log -1 --format='%p' 3790c04` → `cdec5e9` | `3790c04` (`feat(backlog): Q-0006 reviewed…`, **01:15:20+02:00**) is `main`'s next commit after the run, and it has a **single** parent — so `main` stood at `cdec5e9` when it was written, four minutes after the run ended. `cdec5e9` (`merge: Q-0033 review flow surface…`) was itself committed **00:47:33+02:00**, eleven minutes before the run began. |
| 3 | Did anything commit anywhere while the run was in flight? | `git log --all --since='2026-08-24T00:58:25+02:00' --until='2026-08-24T01:11:00+02:00'` | **No output.** No ref in the repository gained a commit during the thirteen minutes of the run. |
| 4 | Where did the ticket branch point, at the closest moment committed history witnesses? | `git log -1 --format='%p' ddf907e` → `c1c5661 998f397` | `ddf907e` (`Merge branch 'harness/Q-0006/integration' into harness/Q-0006/Q0006-mock-switch`, **01:26:18+02:00**) has `998f397` as its **second** parent, and a merge's second parent is what the *named merged ref* resolved to at merge time. So fifteen minutes after the run ended, `harness/Q-0006/integration = 998f397` — a commit dated **2026-08-23T00:00:33+02:00**, twenty-five hours before the run started. |
| 5 | Is there a second witness, of a different kind? | `git log -1 --format='%p' 5b8dde2` → `998f397 ddf907e` | `5b8dde2` (`Merge branch 'harness/Q-0006/Q0006-mock-switch' into harness/Q-0006/integration`, **01:26:43+02:00**) has `998f397` as its **first** parent — where the branch itself stood immediately before that merge moved it. Two merges, twenty-five seconds apart, agreeing by two different mechanisms. |
| 6 | Did the branch move after the run? | `git log -1 --format='%p' ebf1c6e` → `998f397 6cc9da4`; `git branch -a --contains 5b8dde2` | **Yes — it moved and came back.** `5b8dde2` advanced it at 01:26:43 (run 11's integrate); `ebf1c6e` (**01:38:48+02:00**) has first parent `998f397` *again*, so the branch was rolled back in between — `finish()` discarding a failed run's merge, corroborated by `6cc9da4` (`park run 11's task branches`, 01:38:24+02:00) and by the two `…-run11-abandoned` branches that hold the discarded commits. |
| 7 | Is there a contemporaneous record of the check itself? | `git log -1 3790c04` (message body) | Written **01:15:20+02:00**, four minutes after the run ended, on `main`: *"the flow's own range — main...harness/Q-0006/integration — resolves to nothing… Verified: git diff --stat over that range returns empty, and the branch is an ancestor of main."* A committed, timestamped transcription of the same check, by the human who was there. |
| 8 | Was that tip an ancestor of that base? | `git merge-base --is-ancestor 998f397 cdec5e9` | **exit 0** — contained. The ancestry fact was true, and being a relation between two immutable commits it is re-checkable in any clone forever. |
| 9 | By what route did it become reachable? | `git rev-list --ancestry-path 998f397..cdec5e9`, oldest entry | `5d16e06`, parents `a08fbfa 998f397`, `merge: Q-0006 review-flow runtime into main [Q-0006]`, **2026-08-23T00:07:52+02:00**. A two-parent commit whose second parent is `998f397` merged it. The historical event was true as well — and this is a separate question from row 8, answered by a separate command. |
| 10 | Why could the erratum not reproduce it? | same `git log` as #6 | `ebf1c6e` (**01:38:48+02:00**) and `29ad00a` (**01:42:05+02:00**) both postdate the run's end at 01:11:00+02:00. The branch acquired a merge of `main` and the runtime task's work *after* the review, which is exactly why `git diff --stat main...harness/Q-0006/integration` reported 45 insertions when the erratum looked. |
| 11 | And today? | `git branch --merged main --list 'harness/Q-0006/*'` | lists `harness/Q-0006/integration`, and the three-dot diff is empty again — Q-0034 landed it on 2026-08-24. |

**What this proves, and the one thing it cannot.** Committed history records commits, not ref
movements. A reset that lands on a commit which already exists leaves nothing at all in the object
graph, so no command over committed history alone can exclude one during the thirteen minutes run
10 was in flight. That caution is not hypothetical here: row 6 shows the branch moving and being
rolled back within the following half-hour, which is exactly the shape of event that leaves a
first-parent chain looking undisturbed.

An earlier draft of this entry asserted that the branch *"did not move"* between 998f397's commit
date and `ebf1c6e`, deriving it from `ebf1c6e`'s first parent alone. **That was wrong on both
counts** — the branch did move, and first-parent-of-the-next-move is evidence of where a ref stood
immediately before that move, never of where it stood at some earlier moment. It was caught by the
Q-0035 chore review, and correcting it is the reason rows 3 to 7 exist.

What the durable record does support, stated at its actual strength: no commit was created anywhere
while the run was in flight (row 3); two merges of *different kinds* — one recording a merged ref's
position, one recording a merging branch's — independently witness `harness/Q-0006/integration` at
`998f397` fifteen minutes after the run ended (rows 4 and 5); that commit predates the run by
twenty-five hours; `main`'s next commit names `cdec5e9` as its only parent four minutes after the
run ended (row 2); and a commit written in those same four minutes transcribes the very check at
issue and agrees with it (row 7). **The heads run 10 compared were therefore `main = cdec5e9` and
`harness/Q-0006/integration = 998f397`, unless a ref was reset away and back inside a thirteen-minute
window that produced no commit, disturbed no later parent link, and contradicted a record written
four minutes afterwards.** Rows 8 and 9 are then facts about two fixed commits, immutable and
re-checkable forever.

Nothing above uses the reflog, which is machine-local, expires by default and does not survive a
clone. The instrument worth keeping is the pair in rows 4 and 5: **a merge's first parent is where
the merging branch stood; its second parent is where the merged-in ref resolved** — two independent
ways to recover a ref's past position from committed history, and the second one is the stronger,
because it names the ref directly. One caveat on durability: `ddf907e` and `5b8dde2` are reachable
only from `harness/Q-0006/Q0006-mock-switch-run11-abandoned` and
`harness/Q-0006/Q0006-runtime-run11-abandoned`. Both are pushed, so a clone carries them today —
but deleting those parked branches would delete this evidence, which is an argument for OQ-2's
follow-up rather than against the parking.

**Alternatives considered:** (a) Closing the erratum by asserting the ancestry fact alone — rejected,
because the erratum's whole complaint is that an ancestry fact was used to settle a question about
an event, and answering it the same way would have repeated the error while appearing to correct it.
Rows 8 and 9 are separate questions and both had to be asked. (b) Corroborating with `git reflog` —
it does agree, and it carries nothing here for the reasons above. (c) Adding the diffed SHAs to
`runs.log` or the run manifest so this is never archaeology again — genuinely worth doing and
deliberately not done here: `contracts/Q-0011/run-manifest.schema.json` is frozen, and the
frozen-contract rule says a persisted format belongs to a ticket that opens those files
legitimately. The timestamp route above removes the urgency. (d) Treating "the sentence was
accurate" as a reason to close Q-0035 unimplemented — rejected; see below.

**Why the message changed even though it was right.** Three reasons, none of which is that its
conclusion was false.

1. **It asserted more than it had.** `git merge-base --is-ancestor` establishes a relationship
   between two commits at the moment of asking. "Is already merged into" names an event, by a route
   the engine never looked for — and a merge, a cherry-pick, a hand-applied patch, a rebase and a
   branch created from base and never committed to all produce the identical exit code. Here the
   route happened to be a merge. The next time it will not be, and the engine will say it was.
2. **It named nothing a reader could check.** No SHA, no exit code, no statement of which check ran.
   Branch tips move — this one moved four times in the thirty-one minutes after the run, one of
   them a rollback to where it had already been — and a message naming no SHA cannot be re-checked
   afterwards, which is the only time anyone wants to. Establishing rows 2 to 7 above took an
   evening and then a review round, precisely because the message recorded none of it.
3. **Underneath both, a defect with a wider blast radius.** The diagnosis was a bare
   `try { … } catch { return false }`, so a missing object, a corrupt repository, a git absent from
   `PATH` and a shallow clone all rendered as the confident *"is empty — no commits to review"*.
   That is the conflation the containment decision of 2026-08-24 forbids in as many words, and
   `containment()` — written for the board the same night — already got it right. One repository
   read git ancestry two ways and the wrong one was the one that talked to the user. There is now a
   single `ancestry()` primitive in `spike/src/git.js` that both callers reach, so the rules cannot
   drift apart again. The rule reaches one step further than the first implementation of it did:
   the shallow probe is itself a git call that can fail, and reading a failed probe as "not shallow"
   would let it hand back the confident negative by the back door. `shallowState()` is therefore
   three-valued too, and an unanswered probe plus an exit 1 reports `indeterminate (shallow state
   unknown)`. Caught by the Q-0035 chore review, which is the second time this class of conflation
   has had to be closed in the same week.

**The remedy decision, and why the guard was kept.** The old message ended *"Review before merging,
or point input.diff at the merge commit"* — advice the range guard forty lines above it refuses,
since both endpoints must be the configured base or a branch under `harness/<ticket-id>/`. That was
true when it was written on Q-0006's branch and false by the time the branch landed. The guard is
**not** relaxed to match: its rule was settled by Q-0034 and is what stops a flow aiming a review at
an unrelated ref. The message is changed to agree with the guard instead. Each failure now carries
**at most one** remedy, and every remedy is one the guard would accept — "review the right endpoint
before it becomes contained in the left", or "check that the work was committed to the branch the
flow names", or for a deferred range the step that owed the branch. Deleting the remedy entirely was
considered and rejected: an adopter who hits this in their first thirty minutes needs a next move,
and being sent in a circle is worse than being told less, but being told nothing is worse than both.

**A limit stated rather than implied.** "No adapter is billed before bad evidence is found" holds
for ranges over refs that exist when the run starts, and cannot hold for a range whose endpoint the
run itself creates — `chore.yaml` reviews `integration...implement`, and the implement branch has no
emptiness to discover until the implement adapter has run and been paid for. That class gets the
earliest guarantee available instead: the producing adapter may run, the consuming one may not, and
the one failure that *can* be caught with no run at all — a malformed or out-of-class range — is
caught by a new static rule in `harness lint`. Q-0035 (OQ-1). That rule reads every `input.diff` a
flow file can hold, including the one inside a `fan_out` step's `step:` template — which
`flattenSteps` deliberately does not visit, because the template's id, role and adapter are
placeholders the other rules must not see. A static check that skips a step template is a static
check with a hole in exactly the place a run is most expensive to fail.

**Found by:** re-deriving the erratum, as Q-0034's closing entry assigned to Q-0035; and, for the
correction to the branch-position argument and the two rule gaps above, by the chore review of
Q-0035 itself.
