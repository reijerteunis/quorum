# An absent branch is an answer, and the board decides whether it is worth saying — 2026-08-28

**Decision:** `containment()`'s `stateOf` returns `null` only when the ticket named nothing — a
value that is not a string, so there is no question to ask. A string naming no local branch now
answers `indeterminate (no branch)`, a fourth member of `CONTAINMENT_REASONS`. Whether that answer
is *rendered* is the board's decision and not the vocabulary's: `harness board` shows it only where
the stage claims the work is done and the branch is the evidence for that claim — `solutioned`,
`red`, `green`, `reviewed`, `qa-passed`, `deployed` — and never for `draft`, `requirements`,
`blocked` or `abandoned`. The legend names the fourth reason and distinguishes it from the other
three: those are git declining to answer, this one is git never having been asked.

**Refines** *"Containment is derived from git on each board invocation, never stored"*
(2026-08-24), whose sentence *"for every ticket whose `branch` frontmatter resolves to a local
ref"* excluded this case by construction. Both of that entry's standing rules are untouched: the
state is still selected from git's own exit codes and from nothing else, and the shallow asymmetry
still holds. `no branch` is not selected from an exit code because no git command runs — which is
exactly why it is a separate reason rather than folded into `git failed`.

**The measurement is the decision.** Of this repository's 46 tickets, **all 46** name a branch —
`spike/src/backlog.js:64` writes the name at creation and only an `integrate` step ever creates the
ref — and **24 name one that does not exist**. Of those 24, **22 are `draft` or `abandoned`**, where
no branch is the normal case and a token would be pure noise on a column whose value is that it is
scannable. The remaining two are **Q-0063 and Q-0070**, both at `reviewed`, both implemented by
hand, both with their code on `main` and no branch to prove it. A blanket rule would have added 24
annotations to surface 2.

**Alternatives considered:**

**(a) Leave it — the 2026-08-24 sentence said `null` and meant it.** Rejected because `null` was
doing two jobs: *"nothing was named"* and *"what was named is not here"*. A `reviewed` ticket whose
work never reached a branch rendered identically to a ticket nobody had looked at, which is the
absence-versus-silence conflation this repository has now paid for three times — most recently as
*"a check that skips its subject must not report success"* (2026-08-25).

**(b) Render `no branch` on every ticket that has one.** Simplest rule, no stage awareness, and
refused by the count above: 24 tokens for 2 signals makes the column harder to read, and Q-0036
shipped it to be read at a glance.

**(c) Reuse `missing ref` rather than adding a reason.** Rejected: `missing ref` is about the
**base** — a repository the board cannot read — and this is about a ticket whose work never reached
a branch. One is an environment problem and the other is ordinary history. Collapsing them would
make the vocabulary describe less than it did.

**(d) Stop writing `branch:` into frontmatter until an `integrate` step creates the ref.** The
cleanest fix in principle — then a named-but-absent branch would be a genuine anomaly needing no
stage rule at all. Not taken here: flows read `ticket.meta.branch` as a default target
(`step.into ?? ticket.meta.branch`), so changing when it is written is a change to what every flow
resolves, and it belongs with the *"the chore flow cannot run on a ticket's first pass"* item that
already owns that line.

**Where the stage rule lives, and why not in `shared`.** `packages/shared/src/stages.ts` says in
its own header that `STAGES` is *"a LIST, not a state machine"* and that encoding the pipeline's
edges there would be new behaviour. The set of stages that imply a branch is a rendering policy, so
it lives beside the renderer in `spike/bin/harness.js` and `containment()` stays a git question with
a git answer. That separation is the reason this fix is small: the primitive gained a fact, the
board gained a judgement, and neither learned the other's job.

**Cost accepted:** the board's judgement is a hard-coded set of six stage names, in one tree,
duplicated nowhere yet — but `packages/core` has no board, so when Q-0010's CLI grows one, that set
must move with it rather than be re-derived. A second spelling of it is the failure to watch for.

**Verified:** C10 in `spike/test/q0036-board-containment.js` asserts silence for four stages and the
token for six, and that the legend names the reason it just printed; it was demonstrated to fail
before it was trusted. C3, which pins the draft case, needed no change — its fixture is a `draft`
ticket, which is the half of this rule that did not move. The AC-5 injection property is unchanged
and its test now says why: the property is that a frontmatter-supplied name costs no git invocation
and creates no artefact, which is asserted directly; the value returned was always incidental to it.

**Found by:** bumping Q-0070 to `reviewed` by hand on 2026-08-28 and noticing the board could say
nothing about a ticket whose code was on `main`. Fixed directly at Ruud's instruction rather than
opened as a ticket.
