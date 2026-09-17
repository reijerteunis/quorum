---
id: Q-0134
title: The gate screen shows the diff
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0134/integration
priority: p2
created: 2026-09-17
iterations:
  requirements.head-of-product: 1
  chore.review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-17T21:09:51.080Z
    cost: 22.752
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-17T23:13:27.223Z
    cost: 183.649
---
The half split from Q-0129: a review's diff rendered on the gate screen, needing a range the wire does not carry and this workspace's first diff dependency.

**M3**, split from Q-0129 at its requirements gate on 2026-09-17. The body below is §7 of
`backlog/Q-0129-*/requirements/merged.md`, transcribed in full rather than referenced.

*Written out here rather than referenced, because three obligations found orphaned in one week had
lived only inside a closed ticket's prose, and this ticket's own body opens by saying so.*

---

**Recommended: open at this gate, p3.** The half Q-0129 does not build, split on **disjoint
blockers** rather than on size — the seam Q-0013, Q-0091, Q-0096 and Q-0016 were each cut on, at a
gate and at cost.

**What makes the blockers disjoint.** Q-0129 needs one field in `packages/shared`, one slot and one
assignment in `packages/core`, no transport change, no new route and no dependency. This needs a
**diff renderer** — this workspace's first, `diff2html`, `diff` and `jsdiff` appearing in no
manifest, `apps/web` carrying no runtime dependency at all, and Q-0014 having measured that the
cold-store install already doubles — so a dependency needs a one-line justification and an entry if
it changes architecture, and a hand-written unified-patch view with added/removed distinction and
long-line handling is a design problem of its own.

**The transport is the cheaper half and candidate-codex found it: snapshot the bytes the reviewing
step was given, never re-run `git diff` at the gate.** `materialiseDiff` is `engine/diff.ts`'s, takes
a run's `DiffContext` and is a prompt-building function inside a run, so a route cannot call it —
but the run already holds what it produced. Re-deriving at the gate would be a second measurement
after refs may have moved, so the browser could show a diff the reviewer never saw. Reuse removes
that rather than mitigating it.

**And that is exactly why it cannot ride on the gate question unbounded.** `repo.max_diff_bytes`
defaults to **200,000**, a gate question enters the broadcast's `retained` buffer
(`DEFAULT_RETENTION` = 500) and is **replayed to every late subscriber and on every reconnect**, and
Q-0123 ruled four days ago that a record is never released — on an arithmetic of **214 B mean per
event and ~0.1 MB per ended run**. A 200 KB event is ~1,000× the mean. **The first thing this ticket
owes is a measured decision about where those bytes live**: on the question, behind a route keyed on
the `gateId` the daemon already holds, or fetched on demand. Q-0129's 13 KB snapshot is inside
Q-0123's arithmetic and this is not, so the two halves genuinely differ in kind and not only in size.

**The measurement that decides the sequencing: there is nothing to show.** All **40**
`harness/*/integration` branches in this repository are contained in `main` —
`git merge-base --is-ancestor` answers yes for 40 of 40 — so `{base}...integration` is **0 bytes**
for every one of them, and `integration...implement` is 0 bytes too, `implement` having been merged.
**Every diff range in every shipped flow is empty for every ticket in this backlog.** The half is
non-empty only for a run in flight. So its acceptance evidence must be a repository the test builds
— `git.test.ts`'s shape — and no demonstration at a gate can use a real past ticket. That is
Q-0077's subject arriving as a sequencing fact.

**The range is flow-dependent and the gate is not the step that had one.** `review.yaml` diffs
`{base}...harness/{id}/integration`; `chore.yaml` diffs
`harness/{id}/integration...harness/{id}/implement`; `chore`'s gate follows `integrate`, three steps
after the review that read a diff. Nothing on the wire says which range this run's reviewer saw. The
first decision is whether the range travels with the evidence — the shape Q-0129 will have
established, and the only one that is identity rather than inference — or is re-derived from the flow
file, which cannot tell which of a flow's several `input.diff` sites a gate follows.

**Q-0128 is the neighbour and the collision is real.** A diff served to a browser has the same
truncation question a diff handed to a reviewer has, and answering it twice in two places is how the
two drift. `materialiseDiff` truncates **head-only**, so what is lost is every patch for the
alphabetical tail, entirely. Q-0124 made that loss **speak** — a `warn` naming the files with no
patch at all — and the `diff truncated range=` token is **load-bearing**: `diff.test.ts`'s AC-9.5
counts materialisations off it. Whatever this ticket does about a cap must reuse that machinery or
say in one line why not. It must **not** decide whether a truncated review may approve; that is
Q-0128's.

**It owns two guard needles Q-0129 leaves in place.** `apps/web/test/source.test.ts`'s AC-13 keeps
`diff` and `hunk` forbidden in the gate screen, and its AC-14 keeps the retired placeholder sentence
*"The gate screen shows a step's verdict and diffs, and takes the answer."* absent. Both are this
ticket's to re-aim, and both stay valid and unweakened while it waits — which is a property of the
split rather than a coincidence.

**What it must not do.** Widen the gate answer set. Serve a patch from a range the guard at
`diff.ts` would refuse — both endpoints must be the configured base or one of the ticket's own
branches, with the static twin in `lint/lint.ts`. Show a fabricated or partial diff without saying
so, which is `docs/04-architecture.md`'s placeholder rule, **cited by its words and never by a line
number, which has now moved three times** (`:200` → `:317` → `:336`).

**Start by re-measuring, and re-measure the containment figure first**: it is the one that decides
whether this ticket can be demonstrated at all, and it moves every time a branch lands.

---

## Re-measured 2026-09-17, against tip `863c900`, as the section above instructs

Every claim above was checked against the tree before this ticket ran. **Six hold, one moved exactly
as the body predicted it would, and one is a correction.** Do not re-derive from the paragraphs
above where they differ from this section.

**The containment figure — re-measured first, as instructed — holds and has moved.** It is now
**42 of 42**, not 40 of 40: every `harness/*/integration` branch in this repository is an ancestor of
`main`, so `{base}...integration` is empty for all of them and `integration...implement` is empty
too. Sampled directly on Q-0127, Q-0129 and Q-0131: **0 files in both ranges for all three.** The
conclusion is unchanged and is the sequencing fact — **there is nothing in this backlog to show** —
so acceptance evidence must be a repository a test builds, and no gate demonstration can use a past
ticket. The two new branches are Q-0129's and Q-0131's, which landed after the body was written.

**The dependency claim holds, and sharpens in a way that changes what it costs.** `diff2html`, `diff`
and `jsdiff` appear in no manifest in this workspace. But `apps/web` declares **no `dependencies` key
at all** — ten devDependencies and nothing else, React among them, because Vite bundles it. So a diff
renderer would be a **devDependency** and would grow the **served bundle**, not add a runtime edge to
a packed install. The body's *"the cold-store install already doubles"* (Q-0014's measurement) is
therefore about the **dev** install; the cost that lands on an adopter is bundle bytes.
**Measure against the current bundle**: `apps/web/dist` is **352,894 B** of JavaScript and
**10,599 B** of CSS today. A renderer's weight is to be compared with that figure, and `@quorum/web`
is a distribution package, so the bundle is what a packed install serves.

**The two constants hold**: `repo.max_diff_bytes` defaults to **200,000** at
`packages/core/src/engine/diff.ts:372`, and `DEFAULT_RETENTION` is **500** at
`packages/server/src/serve.ts:47`. The retention arithmetic the body rests on is unchanged.

**The needle register is THREE, not two — the one correction.** The body says *"AC-13 keeps `diff`
and `hunk` forbidden"*. Measured at `apps/web/test/source.test.ts:1064`, the register is
`SUCCESSOR = ['diff', 'blocker', 'hunk']` — **`blocker` is the third and the body omits it**. All
three are assembled from fragments so the guard is not its own subject, and the file asserts they
still discriminate against a sentence containing all three. This ticket re-aims **three** needles.

**AC-14's retired sentence holds and is asserted at `source.test.ts:1050`**, assembled as
`["The gate screen shows a step's ", 'verdict and ', 'diffs, and takes the answer.'].join('')` — for
the same reason, which is why a plain grep for the sentence finds nothing and must not be read as
absence.

**The placeholder rule holds, and its line has moved a FOURTH time** — `:200` → `:317` → `:336` →
**`:342`** — which is the body's own warning vindicated within a day. Cite it by its words and never
by a number: *"No placeholder is a blank panel, a spinner or a skeleton, and none shows a fabricated
project, run, ticket or cost."* Note the capital `N`, which is why a lowercase grep answers nothing.

**What Q-0129 settled that this ticket inherits rather than re-derives.** *"A gate question carries
the decision that reached it"* (2026-09-17) established the shape the body calls *"identity rather
than inference"* — the evidence travels **on the question** — and its `reached` snapshot was measured
at **13 KB** at its largest, which is inside Q-0123's arithmetic. **This half is not**, at a 200,000
B cap against a 214 B mean event, so the entry is the precedent for the *shape* and decides nothing
about *where the bytes live*. That is still this ticket's first decision, and the entry records six
refused alternatives which are about parsing prose and do not reach it.
