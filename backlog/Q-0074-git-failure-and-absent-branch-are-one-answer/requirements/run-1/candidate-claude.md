# Q-0074 — A failed git probe is read as a proven negative

*Candidate requirement (claude), run 1. Written against the tree at today's tip, not against the
ticket body: §*"Re-measured 2026-09-10"* instructs "Re-derive it; do not trust this table either",
so every figure below was measured and the ones that moved are named.*

---

## 0. What I re-measured, and what the body does not have

**Confirmed, unchanged.** `safe()` is declared **exactly twice, byte for byte** —
`packages/core/src/fanout/fanout.ts:206–208` and `packages/core/src/git/git.ts:19–21` — and nothing
else in `packages/*/src` carries a third copy. The count is **24**: `git.ts` holds 16 call sites
(`:71, 139, 143, 157, 174, 197, 213, 275, 298, 299, 342, 345, 360, 416, 426, 441`) and `fanout.ts`
holds 8 (`:224, 239, 256, 280, 283, 284, 316, 317`). The four `fanout.test.ts` pins are unmoved at
**249, 332, 352, 406**. The rollback's two truthiness guards are at `lifecycle.ts:136` and `:139`,
both operands from `safe()`-wrapped reads. The start-of-run read is `engine.ts:271`.
`repositoryAt`'s contradicting sentence is `git.ts:66`.

Four findings the body does not carry. Each changes the requirement rather than decorating it.

### 0.1 The instrument already exists in the file that needs it — this is adoption, not design

The body says the answer's shape "is already written, twice", naming `workTreeProbe` and
`resolvesToCommit`. It is more than that. `git.ts` already ships the **whole apparatus**, all of it
module-private and all of it unused by the 16 `safe()` sites beside it:

| symbol | line | what it does |
| --- | --- | --- |
| `errorProperty` | `:27–31` | one property off whatever `execFileSync` threw, `undefined` when absent |
| `exitStatus` | `:37–40` | the child's exit status, `null` when the throw carried none |
| `GIT_FATAL` | `:48` | 128, with a measured note that git spends the same code on every fatal |
| `failureDetail` | `:115–116` | git's own first stderr line, normalised and truncated |
| `WorkTreeProbe` | `:51–57` | the three-answer type, with "never collapsed into one of them" in its JSDoc |
| `resolvesToCommit` | `:104–107` | `false` on git's documented exit 1, `null` on anything else |

So the engineering question is not *how do we tell a failure from an absence* — that is solved,
measured on git 2.55, and documented in place. It is **which of the 24 sites should be using it**,
which is exactly the census the body asks for. This materially lowers the ticket's risk and should
be said out loud at the gate, because the body's sizing paragraph reads as though a primitive has to
be designed.

`fanout.ts` has a *partial* copy — `errorProperty` at `:211–214`, narrowed to `'stderr' | 'message'`
with no `status` — which is why `mergeInto` can read git's message and `branchExists` cannot read
git's exit code. That asymmetry is a census input.

### 0.2 `containment` and `pushLag` answer the same question two different ways, in one file

`pushLag` probes ref existence through `resolvesToCommit`, twice (`:420`, `:434`), and routes a
failed probe to `git failed` while an absent ref goes to `missing ref`. Its JSDoc says why:
*"Every state is selected from an answer git gave, never inferred from a failure."*

`containment:342` asks the same question as `safe(() => git(['rev-parse', '--verify', '--quiet',
…])) != null` and reports **`missing ref`** for both. A git that failed is rendered as a base branch
that does not resolve.

Both functions are exported from the same module, both feed `quorum board`, both were written under
the containment discipline, and they disagree. This is the strongest single argument that the
ruling is owed: the correct shape is already in the file and did not propagate the eight lines up.

### 0.3 The board can claim "git was never asked" when git was asked and failed — live today

`containment:345` builds the local branch set as:

```
const branches = new Set((safe(() => git(['for-each-ref', …], repoDir)) ?? '')
  .split('\n').filter(Boolean));
```

A failed `for-each-ref` yields `''`, so `branches` is **empty**, so `stateOf` returns
`{ state: 'indeterminate', reason: 'no branch' }` for **every** ticket.

Under *"An absent branch is an answer, and the board decides whether it is worth saying"*
(2026-08-28), `no branch` means precisely *"git never having been asked"*, is deliberately **not**
selected from an exit code, and is rendered wherever the stage claims the work is done — so on this
repository's backlog a single failed probe reports `main:indeterminate(no branch)` across every
ticket at `solutioned` or later, each one asserting that no git command ran.

That is this ticket's class, in the rendered vocabulary, on the product's most-read surface, named
by no ticket and pinned by no test. It is also the sharpest available demonstration of why the
ruling matters, because the collapse survives inside a function whose own decision entry forbids it.

### 0.4 The consumer map is larger than recorded, and one consumer loses work while reporting green

The body names two consequential sites. Measured, `branchHead` has **four** readers and
`branchExists` **seven**:

| site | reads | what a failed probe produces |
| --- | --- | --- |
| `engine.ts:271` | `branchHead` | no rollback anchor; the run cannot put the branch back |
| `lifecycle.ts:138` | `branchHead` | the rollback's second guard; skips silently |
| `engine.ts:141` | `branchHead` | `reportUndecided` warns *"`<branch>` does not exist"* and writes `kept-at=none` to `runs.log` — a durable false record |
| `composite.ts:253` | `branchHead` | the integration evidence line reads `at (new)` |
| `composite.ts:96, 97` | `branchExists` | base sync returns `skipped: "<branch> does not exist yet"` |
| `composite.ts:246` | `branchExists` | **a task branch is dropped from the merge list** |
| `composite.ts:266` | `branchExists` | the base is not merged before the task branches |
| `steps.ts:202, 212` | `branchExists` | the step's base sync is skipped as *"Not a failure"* |

**`composite.ts:246` is the finding.** `branches = branches.filter((branch) =>
branchExists(context.repoDir, branch))` runs immediately before the merge loop. A probe that failed
removes that branch from `branches`, the loop merges what is left, no conflict is recorded, and the
integrate step can go on to run the suite and report success. The body's contamination is *work kept
that should have been rolled back*; this is **work lost that should have landed, with a green
verdict over it** — a fan-out task's entire output silently absent from the integration branch.
Neither `composite.ts:17`'s authority line nor the ticket body distinguishes the two directions, and
the second is worse: the rollback failure leaves evidence on a branch, and this one leaves a passing
run whose diff is simply short.

`steps.ts:212` is the same class dressed as reassurance. Its `info` reads *"base `<X>` does not exist
yet — nothing to sync"* with a comment saying *"Normal on a ticket's first pass … Not a failure"*,
so a git that failed is rendered as the ordinary first-pass case and the agent works against a stale
base — the Q-0004 defect that sync exists to prevent.

`composite.ts:96–97` returns a **skip carrying a reason it does not have**, which is *"a check that
skips its subject must not report success"* (2026-08-25) with the skip's justification fabricated.

### 0.5 One more site with real consequences: the preflight's endpoint oracle

`git.ts:275`'s `shortSha` is documented as *"`null` when the ref does not resolve, **which is also
how the engine tests an endpoint's existence**"*, and `diff.ts:457` is that test:
`if (endpoint.class !== 'pre-existing' || shortSha(context.repoDir, endpoint.ref) != null) continue;`
followed by `throw missingEndpointFailure(...)`.

So a probe that failed at run start stops the run with a confident diagnosis naming a branch nobody
created. The **Preflight** exists so *"bad evidence is found before it is paid for"*; here it
produces bad evidence of its own. It fails safe — the run stops — and it fails *dishonestly*, which
is the property this ticket is about.

### 0.6 Sites that are probably correct, and why that matters

The census must be able to say *keep* as loudly as *change*. Candidates measured:

- **`configuredUser` (`:213`)** — the body's own nominated first row. A git that cannot run and a git
  with no `user.name` both honestly mean *nobody said*, and the caller renders `unknown` under *"A
  ticket's owner is supplied, never guessed"* (2026-09-08). **Keep.**
- **`removeWorktree`'s `branch -D` (`:157`)** and **`mergeInto`'s `merge --abort` (`:317`)** —
  best-effort cleanup; a failure genuinely is nothing to say. **Keep.**
- **`resetBranchTo`'s `clean -qfd` (`:256`)** — same shape. **Keep.**
- **`currentBranch` (`:197`)** and **`mergeBase` (`:174`)** — both carry JSDoc that *already states
  the collapse deliberately*, `mergeBase` in as many words: *"a ref that does not exist being one of
  the reasons, which this deliberately does not tell apart from the others"*. **Keep, and the census
  cites the sentence** rather than re-deciding it.
- **`emptyRangeEvidence` (`:298–299`)** — collapses to `sameTree: null`, about which the caller
  claims nothing. Already correct.
- **`ensureWorktree` (`:143`)** — a failed probe falls back to `HEAD`, cutting a worktree from
  somewhere else silently. **Real, and already registered by Q-0038** as a named non-goal with its
  evidence. Census row with a pointer; not repaired here.
- **`containment:360` / `pushLag:416, 426, 441`** — every one converts `null` into an explicit
  `git failed`. Already correct, and they are the in-file proof that the pattern is reachable.

If the census cannot articulate why `configuredUser` keeps `safe()` while `branchHead` may not, it
has not done its job — the body's test, and the right one.

---

## 1. Problem

Two identical helpers named `safe()` turn every git failure into `null`. Twenty-four call sites
consume that `null`, and at nine of them a caller reads it as a **proven fact about the repository**
— that a branch is absent, that a ref does not resolve, that a revert succeeded, that no branch was
ever named. The distinction between *git answered "no"* and *git could not answer* is discarded at
the point where it is the only thing that matters.

The product already knows this is wrong and says so in four places. *"Containment is derived from git
on each board invocation, never stored"* (2026-08-24) forbids inferring "not contained" from a
failure. *"An absent branch is an answer"* (2026-08-28) adds a fourth reason precisely so that
absence and silence stop sharing a rendering. *"The board reports push lag, and never a CI
conclusion"* (2026-09-06) states it generally: *"Every state is selected from an answer git gave,
never inferred from a failure."* *"An adapter records the version it was verified against"*
(2026-09-08) applies the same discipline to a third subject. Four subjects have a closed state set
with a member meaning *could not tell*; the primitive underneath all of them has a boolean and a
`null` that means two things.

**The consequences are not theoretical and not all latent.** A failed probe today can: report every
ticket on `quorum board` as having no branch (§0.3); drop a fan-out task's branch from an integrate
merge and let the run report success (§0.4); skip a rollback so a run that failed keeps whatever
`integrate` merged (`lifecycle.ts:136`, `:139`); tell a maintainer in `runs.log` that a branch *does
not exist* when it does (`engine.ts:141`); and stop a run with a preflight diagnosis naming the wrong
cause (§0.5).

**And the class is not confined to `catch` blocks.** The body records two instances committed by the
operator in the three days before this run — Q-0068's merge triage concluding from a grep that
returned nothing that no authority line existed, and Q-0039's erratum E-1 narrowing a guarantee at
two of its three sites. Neither is a `safe()` call. Whatever is written down here has to be a rule
about **reading absence as proof**, not a note about a `try`/`catch`.

## 2. User stories

**Maintainer.** *As a solo maintainer, when a run tells me a branch does not exist, I need that to
mean git looked and it was not there — so that I do not spend an evening looking for work that was
merged, or trust a green integrate that quietly left a task's branch out.*

**Maintainer, unattended.** *As a solo maintainer running flows I am not watching, I need a run that
could not read the repository to stop and name what it could not read — because at M3 a rollback
that skips itself is not observed, it is discovered later in a diff nobody can explain.*

**Adopter.** *As a cold-clone adopter whose first command is `quorum board`, I need the board never
to tell me forty tickets have no branch because one probe failed — a first impression that is
confidently wrong is worse than one that admits it could not answer.*

**Contributor.** *As an adapter or flow contributor reading `packages/core`, I need one stated rule
for what a caller does with "could not answer", and one register saying which sites follow it and
which deliberately do not — so that the next `safe()` call I write is a decision rather than a
default.*

## 3. Surfaces

`packages/core/src/git/`, `packages/core/src/fanout/`, `packages/core/src/engine/`
(`composite.ts`, `steps.ts`, `engine.ts`, `lifecycle.ts`, `diff.ts`); the rendered output of
`quorum board` and `quorum run`; `docs/decisions/` and `docs/GLOSSARY.md`. No `apps/web` — M3 does
not exist yet, and this is the ticket that makes M3's server safe to build.

## 4. Acceptance criteria

Fourteen, against a ceiling of fifteen. §7 explains what was carved out to get there and why.

**AC-1 — The decision entry lands before any code.**
A new entry in `docs/decisions/` states what a caller does with *could not answer*, names
*"Containment is derived from git on each board invocation, never stored"* (2026-08-24), *"An absent
branch is an answer"* (2026-08-28) and *"The board reports push lag, and never a CI conclusion"*
(2026-09-06) as the entries it generalises, and cites **Q-0074** by id. It states the rule as being
about **reading absence as proof** and not about a `catch` block, and names §0.3's board collapse as
the live instance.
*Test:* `packages/shared/src/docs.test.ts` passes with the new entry indexed; the entry is present
before the first implement round's prompt is built. **No step on the chore route may write it** —
`developer-generalist` is forbidden — so it is the human's, at the gate, and the run must not be
launched without it (see Risk R-1).

**AC-2 — The census is a durable register in the tree, not a paragraph in a report.**
Every `safe()` call site is classified with a disposition and a one-line reason, in a checked-in
register that fails when the population changes. A twenty-fifth `safe()` call fails the register
until it is classified.
*Test:* a test that derives the call sites from the two modules' own text and compares them against
the register's keys, red when a site is added or removed without a classification. Follow
`backlog.source.test.ts:169`'s `REALPATH_SITES` shape — a register of identities rather than a count
(Q-0073) — which was written for this exact hazard and names Q-0074 in its own comment.

**AC-3 — One primitive, or a registered two.**
Either `safe()` is declared once, or the two declarations are registered with the reason they stay
apart — `fanout.ts:199–202` already argues that `git/git.ts` keeps its runner module-private, and
that argument survives or it does not.
*Test:* a third declaration fails; the register's reason is asserted present, so a later reader meets
the argument rather than the duplication.

**AC-4 — `repositoryAt` discriminates, and its JSDoc stops claiming what the code discards.**
`git.ts:66` states that `--resolve-git-dir` *"is precisely why it can discriminate between them and
absence"*, and `:71` throws that discrimination away. The function reports a failed probe distinctly
from a proven absence, and the sentence is corrected in the same change.
*Test:* three fixtures — a repository git refuses, a path with no gitdir, and a probe that could not
run — reaching three distinct answers; plus an assertion over the JSDoc text, which is what let this
survive a cross-vendor review.

**AC-5 — `workTreeProbe`'s two inherited cases stop reading as absence.**
A malformed gitfile at `repoDir/.git` and an unreadable `.git` both reach `'failed'`, never
`'outside'` (Q-0109's subject, Q-0105 erratum E-1).
*Test:* one fixture each; `pushLag` renders `git failed` rather than silence, and silence is asserted
to remain the success output.

**AC-6 — The board never reports a failed probe as `no branch` or as `missing ref`.**
`containment:342` and `:345` select their state from an answer git gave. A failed `for-each-ref`
reaches `git failed`; a failed base probe reaches `git failed` and not `missing ref`.
*Test:* a fixture in which the branch listing fails, asserting that a `reviewed` ticket does **not**
render `no branch` — demonstrated red against today's code, where it renders `no branch` for every
ticket. `resolvesToCommit` is the instrument at `:342`; it is eight lines away and already used twice
by `pushLag`.

**AC-7 — The diff preflight does not report a failed probe as a missing endpoint.**
`diff.ts:457` distinguishes *this endpoint does not resolve* from *the probe could not answer*, and
`missingEndpointFailure` is raised only for the first. The second stops the run naming what could not
be read.
*Test:* a run whose endpoint probe fails, asserting the run stops with a message naming the probe
failure and not the ref.

**AC-8 — `branchExists`' callers each decide explicitly.**
The helper reports three answers. Each of the seven consumer sites (`composite.ts:96, 97, 246, 266`;
`steps.ts:202, 212`; and `git.ts:139`'s local equivalent) either acts on the failure or records why
it deliberately does not. `composite.ts:17`'s authority line is removed with the defect, not left
pointing at a closed ticket.
*Test:* per-site assertions; the register in AC-2 carries the dispositions.

**AC-9 — An integrate step never silently drops a branch it could not probe.**
`composite.ts:246` does not remove a branch from the merge list on a failed probe. Whichever posture
OQ-2 rules — stop, or merge and warn — the run does not reach a success verdict having silently
merged fewer branches than it was given.
*Test:* a fan-out with two task branches where the probe for one fails; assert the run does not
report success with that branch's work absent. **Demonstrated red first**, because on today's code it
passes green with the work missing.

**AC-10 — `branchHead`'s four readers each decide explicitly.**
`engine.ts:271`, `engine.ts:141`, `lifecycle.ts:138` and `composite.ts:253`. `reportUndecided` no
longer says *"does not exist"* about a branch it could not read, and no longer writes `kept-at=none`
for that case — a durable record that a reader meets without the stream beside it.
*Test:* per-site; the `runs.log` line is asserted over its text, which is how AC-5's guard in that
file already works.

**AC-11 — The rollback does not skip itself on a probe that failed, at either guard.**
`lifecycle.ts:136` (`context.branchHeadAtStart`) and `:139` (`current`) are both fed by `safe()`
reads. A run that did not complete either restores the ticket branch or **says it could not** — it
never passes over the rollback in silence.
*Test:* two fixtures, one failing each read, asserting a warning and a `runs.log` line in both. This
is the criterion a widened return type alone does not satisfy: closing `:136` and leaving `:139`
testing a `string | null` for truthiness is the shape to demonstrate red.

**AC-12 — `commitAll` does not report a revert it did not perform.**
`fanout.ts:283–284`'s two halves are tolerant of failure and `onDiscard` fires on the dirty list
rather than on the outcome, so an agent's edit to `backlog/` can be committed while the callback says
it was discarded. The caller learns that the revert failed.
*Test:* pin `:332` rewritten (see AC-13) to assert the new behaviour.

**AC-13 — Every pin this ticket touches is rewritten, not deleted, and each replacement fails against
the old code.**
`fanout.test.ts:249` and `:332` are the two pins in this ticket's class. Each becomes an assertion of
the *fixed* behaviour, and each is demonstrated red against the pre-change function. A pin removed
without a replacement fails this criterion.
*Test:* the mutation is performed and recorded, per *"A check is not established by reading it"*
(2026-08-29). `:352` and `:406` are **out of scope** and their pins are left standing — see §5.

**AC-14 — The fault injection is a property of the commit, not of the machine.**
Every fixture that makes git fail does so by a mechanism the commit controls — a repository the test
built into a state git refuses, an environment variable the test sets itself, or an injected runner —
and never by relying on a capability the runner may or may not have.
*Test:* the mechanism is named in the test file's header with its reason. Where a capability is
genuinely required, the test **probes for it and reports a skip naming what could not be staged**,
which is the shape Q-0105's `git.test.ts` ownership fixture was repaired into after
`GIT_TEST_ASSUME_DIFFERENT_OWNER` turned out to be honoured on darwin and ignored on `ubuntu-latest`.
*"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30)
binds, and this ticket's whole subject makes it unusually easy to violate: **the natural way to
simulate a broken git is to break the machine's git.**

## 5. Non-goals

1. **`fanout.test.ts:352` — `commitAll`'s first reported path losing its first character.** A string
   bug in `.slice(3)` over a trimmed `status --porcelain`. It shares a file and a Q-0048 criterion
   with this ticket's subject and shares nothing else: no failed probe, no absence read as proof,
   nothing the decision entry governs. **Successor body in §8.**
2. **`fanout.test.ts:406` — `mergeInto` reporting an empty error on a content conflict.** Adjacent —
   a failure with nothing to say — but the cause is `??` not falling back on `''` because git writes
   `CONFLICT (content):` to stdout. It is a message-plumbing fix, not a state-collapse fix.
   **Successor body in §8.**
3. **The two `--dry` mutations** (`lifecycle.ts:119` and `:122`, with the aliasing at
   `engine.ts:216–217`). Preserved under Q-0050 AC-10, a different class entirely — `--dry` purity,
   not probe honesty. **Successor body in §8.**
4. **`ensureWorktree`'s silent `HEAD` fallback** (`git.ts:143`). Real, already registered by Q-0038
   with its evidence and its reasons for deferral. A census row pointing there; not repaired here.
5. **Q-0078** — the diff cache keyed by range alone. Named in `diff.ts:441–445`, its own ticket, and
   its fix collides with an identical-bytes guarantee.
6. **The unclosable third case from Q-0105 erratum E-1** — a project root *below* a repository git
   refuses. Closed as unclosable; the body says do not reopen it without new evidence, and there is
   none.
7. **Turning all 24 sites into tri-states.** The census decides per site and is expected to keep
   most of them.
8. **Any M3 server behaviour.** This makes the primitive honest so that a surface can be built on
   it; it builds no surface.
9. **Any change to `quorum board`'s rendering policy.** AC-6 changes which *state* the primitive
   produces. Whether and how a `git failed` token renders is decision 061's stage rule, already
   settled, and is not reopened.

## 6. Open questions

**OQ-1 (blocking) — Is the seam the class or the module?**
The body pre-writes the seam as the module: *"the entry and `core/git`'s two cases in one,
`core/fanout`'s four pins in the other."* I recommend **the class instead**, on three measurements.
(a) The module seam **splits the ruling's own subject in half** — `branchExists`/`branchHead` in
`fanout/` and `repositoryAt`/`containment` in `git/` are the same defect in one duplicated function,
and separating them re-creates exactly the arrangement in which "nobody's attention was on either
copy" (`backlog.source.test.ts:169`). (b) The consumers do not respect the module boundary: the
`fanout/` helpers are read almost entirely from `engine/`, so the `fanout/` half would carry
`composite.ts`, `steps.ts`, `engine.ts` and `lifecycle.ts` anyway. (c) The `safe()`-class scope
lands at 14 criteria (§4) **only because** the two riders and the `--dry` pair come out; keeping them
and splitting by module gives two tickets that each still mix classes. If a split is still wanted
after that, the cheaper second cut is **census-and-ruling** (AC-1 to AC-3) ahead of **repairs**
(AC-4 to AC-14) — but I do not recommend it: a census with no repair behind it is a document, and
this repository has measured what happens to obligations that live only in documents.

**OQ-2 (blocking) — What does a caller DO with "could not answer"?**
The decision entry must answer this, and the three available postures are not interchangeable:
*refuse* (stop the run and name what could not be read), *report* (carry on and emit a distinct
state, which is what the board does), or *retain* (keep today's collapse with a stated reason).
I recommend the entry rule that **the posture is chosen per consumer from a closed set, and the
default for a caller that is about to destroy or omit work is `refuse`** — which puts AC-9's dropped
branch and AC-11's rollback on the safe side and leaves the board on the reporting side, matching
what `pushLag` and `containment` already do. What must not ship is a widened return type with no
stated posture, because that is a `string | null` every caller goes on testing for truthiness
(`lifecycle.ts:139` being the worked example).

**OQ-3 (blocking) — Does *"Membership is a git question, not a filesystem one"* (2026-08-28) govern
AC-4 and AC-5?**
The obvious instrument for a malformed or unreadable `.git` is a filesystem existence check, which
looks like a collision. Measured, that entry is scoped to `turbo-inputs.test.ts` and argues from
**what turbo hashes** — it has no analogue in *"did git fail or is this not a repository"*, and its
own text preserves the four existence checks that *refuse to run over a missing subject*, calling the
distinction the rule: *"existence used to classify was the defect; existence used to refuse is the
rule."* AC-4's use is a refusal, not a classification. Q-0090's E-1 is the precedent for ruling that
a landed entry does not govern a case it was not scoped to, and it ruled the same way. **Recommend:
ruled not to govern, in the AC-1 entry, with that reasoning stated so the next reader does not
re-derive it.** It is listed as blocking because it is a scope ruling over a landed entry, which is
the human's.

**OQ-4 — Does `safe()` survive?**
If the census keeps most sites, `safe()` stays and gains a JSDoc saying what it may and may not be
used for. If it does not, deleting it is cleaner than leaving a primitive whose every remaining use
needs a footnote. Recommend deciding **from the census**, not before it — this is the one question
that genuinely cannot be answered until AC-2 is done, which is itself an argument for the census
being a task of the run rather than a number inherited from the body.

**OQ-5 — Does the vocabulary gain a term?**
Four subjects now share one discipline — Containment, Push lag, Verified version, and the work-tree
probe — and `docs/GLOSSARY.md` describes it four times in four entries. A single term would let the
entry and the census cite it once. Against: a new term must go in the glossary before its second use,
and the discipline may be better stated in the decision entry than named. **Recommend: no new term.**
The rule is a sentence in the entry, and each glossary entry keeps its own wording; a term that
abstracts over four correct entries buys compression and risks a synonym.

**OQ-6 — Does the entry carry the habit-of-reasoning sentence?**
The body argues yes, from two operator instances in three days that were not `safe()` calls.
Recommend **yes, in one sentence**, and no more: a decision entry rules on code and may note the
generalisation, but a rule about how a person greps is not enforceable by any check this repository
can write, and pretending otherwise is the failure mode that produced `NOT_READ` registers nobody
maintains.

## 7. Sizing

Fourteen criteria, against `head-of-product`'s ~10 typical and 15 ceiling. It fits **only** because
§5 carves out four items the ticket body currently carries. If the gate declines the carve-out, this
is a ~18-criterion ticket and must split — and the split it would then need is the class seam
(OQ-1), which is what §5 does directly and more cheaply.

The body's own sizing paragraph anticipated the ceiling and pre-wrote a module seam. §0.1 is the
reason to revisit it: with the instrument already in `git.ts`, ten of the fourteen criteria are
"adopt the existing shape at this site and pin it", which is not the ticket the body sized.

## 8. Successor bodies, written out in full

Per this repository's own rule — *a deferred obligation dies unless it is written into a successor's
body; an implement report is not a durable record and is not read again after the gate* — the three
carved-out items are written here in full so they can be opened at the gate rather than remembered.

**Successor A — `commitAll` reports a path with its first character eaten.**
`fanout.ts:280–281`. `git()` trims the whole of `status --porcelain`, so a leading `" M "` becomes
`"M "` on line one alone, and the `.slice(3)` that strips the status columns eats a character of the
path. Only the first line, and only when the file is modified-but-unstaged: `["acklog/T-0001/ticket.md",
"backlog/T-0001/sneaked.md"]`, measured. Pinned at `fanout.test.ts:352` with a `Why: preserved defect,
see Q-0048 AC-12` line the fix removes with it. The path is reported to a human through `onDiscard`
and reaches an integration note, so the defect is a wrong filename in evidence a maintainer reads.
The fix is to strip the columns before trimming, or to parse `--porcelain -z`. p3, one file, no
decision entry owed. **Not folded into Q-0074**: it is a string bug in a function this ticket also
touches, and bundling it means the ruling's reviewer arbitrates a `slice`.

**Successor B — a content conflict reports an empty error.**
`fanout.ts:318`. `String(errorProperty(e, 'stderr') ?? errorProperty(e, 'message')).slice(-500)`, and
`??` does not fall back on an empty string: git writes `CONFLICT (content): …` to **stdout**, so
`stderr` is `''` and the message is dropped. `mergeFailure` then prints *"git reported no reason"* in
the one case where the reason is the only information there is. Pinned at `fanout.test.ts:406`; the
pin's own comment records that `conflicts` carries what a caller acts on, *"which is why this has
never been felt"*. The fix needs a decision the size of a sentence — whether `runCommand`-style
capture applies here, or whether `''` simply falls through to `message` — and touches `MergeResult`'s
documented asymmetry (`fanout.ts:294–302`). p3. Adjacent to Q-0074 and not the same: this is a
message lost, not a state inferred.

**Successor C — `--dry` mutates the in-memory ticket.**
`lifecycle.ts:119` (`ticket.meta.iterations = context.counters`) and `:122` (`if (advancesStage(status))
ticket.meta.stage = stage`) both sit **above** the `if (!context.dry)` block, and `engine.ts:216–217`
aliases the frontmatter object rather than copying it (`const counters = ticket.meta.iterations ?? {}`,
with its own `Why: preserved defect, see Q-0050 AC-10` line). So a dry run advances the stage and
mutates the counters of the ticket object it was handed. Latent today because the CLI loads a ticket,
runs once and exits; **it stops being latent at M3**, where a server holds a ticket across requests
and a dry run is exactly the thing a UI offers before a real one. p2 at M3, p3 before it. Owes no
decision entry — Q-0050 AC-10 already calls it a defect — but does owe a test that a dry run leaves
the caller's object byte-identical, which is the criterion `--dry` never had. **Not folded into
Q-0074**: nothing in it turns on a probe, and its fixtures are engine-level rather than git-level.

## 9. Risks

**R-1 — The decision entry does not exist when the run starts.** AC-1 cannot be satisfied by any step
on the chore route. This repository has launched a run into that state at least eight times, most
expensively on Q-0062, where three implement rounds went on a blocker its own requirement had named
in advance. **Mitigation:** the gate does not answer `advance` until the entry is indexed. Q-0083 now
gives an implement step a `blocked` verdict, so the cost is one round rather than three — but the
cheap fix is still not to create the condition.

**R-2 — The reviewer approves the change it asked for.** Two of these criteria remove behaviour a
`Why: preserved defect` line protects, and a reviewer reading those lines without the entry beside it
will correctly block the removal. That is *"A reviewer approves the change it asked for"* (2026-08-29)
and it cost Q-0049 and Q-0052 a round each. **Mitigation:** the entry is quoted in the implement
report, and the authority lines are removed *in the same change* as the behaviour, never left
pointing at a ticket that closed.

**R-3 — Fault injection makes verdicts machine-dependent.** AC-14 exists for this. The hazard is
acute here: the natural way to test "git failed" is to break git, and Q-0105's GO-3 went red on CI
inside the sweep built to forbid exactly that, on a hook darwin honours and `ubuntu-latest` ignores.
**Mitigation:** AC-14, plus verifying in both environment rows and on CI before the ticket closes —
a local green has certified a broken path twice in this repository (Q-0104, Q-0105).

**R-4 — The census rots between the requirement and the implementation.** It already did: the body's
23 became 24 when Q-0112 added `configuredUser` the day after the triage counted. **Mitigation:**
AC-2 makes the register executable, so it rots loudly. Nothing in this document's §0 should be
transcribed into the implementation without re-running it — *a measurement copied from a document is
not a measurement*, which this repository has now recorded against itself at least four times.

**R-5 — A widened return type is mistaken for the fix.** The body's first line says the decision is
*"not whether to widen a return type"*, and `lifecycle.ts:139` is the proof: a `string | null`
returned into `if (current && …)` is a tri-state a caller immediately re-collapses. **Mitigation:**
AC-9, AC-10 and AC-11 are written over *caller behaviour*, and each is demonstrated red against
today's code rather than observed green against tomorrow's.

**R-6 — Scope creep through the census.** Twenty-four sites, each with a defensible argument for
change, in a ticket at its ceiling. **Mitigation:** §0.6 pre-classifies eight of them as *keep* with
reasons, so the census starts from a position rather than from a blank page, and §5 names what is
already routed elsewhere.

## 10. Cross-cutting checklist

- **BYOS** — n/a. No adapter, no credential, no environment read on any path this touches.
- **Worktree safety** — engaged and improved. AC-9 and AC-11 are both about a run's effect on
  branches and worktrees; nothing here writes to the user's working tree, and AC-11 makes the
  existing rollback guarantee honest rather than widening it.
- **Gate behaviour** — unchanged. No flow file moves, no gate is added, no `max_iterations` changes.
  AC-1's entry is a gate obligation, not a gate change.
- **File format and schema** — no `ticket.md`, `harness.yaml` or flow-file format changes. If AC-6
  adds a state to a rendered union, `packages/shared`'s `ContainmentReason` is where it lives and its
  existing zod schema is the check.
- **Lint rules** — none added. `quorum lint` is untouched; Q-0113 owns the flow-path lint and is
  unrelated.
- **Cold-clone impact** — positive and small. §0.3's board collapse is on the adopter's first
  command; nothing here lengthens the first 30 minutes.
- **Product-agnostic** — yes. Nothing here names a SaaS product.
- **Errors are explicit** — this is that rule's ticket. *"Never default silently"* is what 24
  `safe()` calls have been doing.

## 11. Provenance

Everything in §0 was measured against the tree during this run: the `safe()` populations by grep, the
call-site line numbers by reading both modules end to end, the consumer map by tracing `branchHead`,
`branchExists` and `shortSha` to their callers, and the board collapse by reading `containment`'s
branch-set construction against decision 061's definition of `no branch`. §0.1, §0.2, §0.3, §0.4 and
§0.5 are not in the ticket body. The body's own re-measurement of 2026-09-10 — 24 sites, `safe()`
declared twice, pins at 249/332/352/406, two rollback guards, `engine.ts:271` — is confirmed in every
particular and is the only inherited figure this document relies on, having been re-derived rather
than copied.
