# Q-0035 — The empty-range diagnostic reports evidence, not a story

*Merged requirement · head-of-product · 2026-08-25 · milestone M2 · iteration 1 · route: chore flow*

*Every code claim below was re-derived against `main` on 2026-08-25 with read-only commands. Where
this document disagrees with either candidate, the repository was the tiebreaker.*

## Problem

When a step's `input.diff` resolves to a range git can show nothing for, the run stops. Stopping is
correct and was bought expensively: Q-0006's review run 10 paid two vendors $5.023 to review zero
bytes and returned a `changes-requested` verdict the engine acted on. What the run stops *with* is
this ticket's subject.

`materialiseDiff` in `spike/src/engine.js` prints, on the contained branch of its check:

> `<step>: \`<range>\` is empty because <right> is already merged into <left> — there is nothing
> left to review. Review before merging, or point input.diff at the merge commit.`

Four things are wrong with that sentence, and none of them is that its conclusion was false.

**It reports an event it did not observe.** The engine ran `git merge-base --is-ancestor`, which
establishes a current ancestry relationship. "Is already merged into" is a claim about something
that happened, by a route the engine never looked for — a merge, a cherry-pick, a hand-applied
patch, a rebase, or a branch created from base and never committed to. The 2026-08-24 erratum in
`docs/DECISIONS.md` exists because this exact inference was written into the record and later failed
to reproduce. Q-0036 then settled the vocabulary for the whole product on the same day: containment
is *"an ancestry fact about two refs at the moment of reading, not a claim about how the code
arrived — and not a synonym-carrier: the board and the docs say 'contained', never 'merged',
'landed' or 'shipped'."* The board obeys that decision. The engine, in the one message where the
distinction was paid for, does not.

**It names nothing a reader can check.** No SHAs, no exit code, no statement of which check ran. A
maintainer who disbelieves the message must reconstruct the run's git state by hand — which is what
Q-0034 spent an evening doing, and what the erratum is a record of. Branch tips move:
`harness/Q-0006/integration` moved twice within an hour of run 10 finishing. A message naming no SHA
cannot be re-checked after the refs move, which is the only time anyone wants to re-check it.

**It recommends a remedy the engine forbids.** "Point `input.diff` at the merge commit" is refused
by the range guard twenty lines earlier: both endpoints must be the configured base or a branch
under `harness/<ticket-id>/`. The advice was true when written on Q-0006's branch and false by the
time that branch landed.

**Underneath all three, a smaller defect with a larger blast radius.** The diagnosis is a bare
`try { merge-base --is-ancestor } catch { return false }`. Every non-zero exit collapses into "not
merged": a missing object, a corrupt repository, git absent from `PATH`, a timeout — all render as
the confident second sentence, *"is empty — no commits to review"*. That is precisely what the
containment decision of 2026-08-24 forbids in as many words: *"conflating 'provably not' with 'could
not answer' manufactures exactly the confident falsehood this ticket removes."* It also ignores
shallow clones, where an exit 1 cannot disprove ancestry at all. Meanwhile `containment()` in
`spike/src/git.js` — landed the same night, for the board — gets both rules right. **One repository
now reads git ancestry two different ways, and the wrong one is the one that talks to the user.**

Surfaces touched: the `harness run` and `harness lint` CLI output, the flow engine, tests in
`spike/test/`, and one append-only entry in `docs/DECISIONS.md`. No Studio surface exists in M2.

## What the code actually says

The ticket body asks that the code be read rather than the body. Each row was verified on
2026-08-25 and each one changes a criterion. Functions are named rather than line-numbered on
purpose: line numbers move, and this ticket is about evidence that survives movement.

| Claim | What the repository says |
| --- | --- |
| The message hard-codes "merged into main" | It does not, since Q-0034. `materialiseDiff` checks `right` against `left` — the range's own endpoints — so the chore flow's `integration...implement` is diagnosed against the right pair. The remaining defects are the event-claim, the missing evidence, the stale remedy and the exit-code conflation. |
| The diagnosis is a two-state check | It is a two-state *rendering* of a three-state fact. `catch { return false }` maps "provably not an ancestor" and "git could not answer" onto the same sentence. |
| Nothing in the repository knows how to do this correctly | `containment(repoDir, base)` in `spike/src/git.js` selects contained / not-contained / indeterminate from git's exit codes alone, probes `--is-shallow-repository` once, and applies the shallow asymmetry. It is branch-name-shaped — `stateOf` matches its argument against a `for-each-ref` set, closes over a single `base` and `shallow`, and prefixes `refs/heads/` — so it is **not callable as-is** for an arbitrary two-endpoint range. Its rules are the product's rules and must not be re-derived weaker. |
| The preflight already prevents billing | For ranges over pre-existing refs, yes: `runFlow` materialises each distinct range before the first step, and `spike/test/q0034-chore-preflight.js` C2 covers it. For a range whose endpoint an *earlier step of the same flow* creates, the preflight `continue`s — the `createdSoFar` set is order-aware, and a parallel sibling counts as concurrent, not earlier — and the range materialises at step time via `buildPrompt`'s fallback, after that earlier step has been billed. |
| Shipped flows split cleanly across that boundary | They do. `review.yaml` uses `{base}...harness/{id}/integration` twice — pre-existing, preflighted. `chore.yaml` uses `harness/{id}/integration...harness/{id}/implement` — deferred, because `implement` is a worktree step of the same flow. Both classes are live and both need covering. |
| `--dry` has its own path | It does. `buildPrompt` emits a placeholder for a deferred range under `ctx.dry`, because a preview must not demand branches only a paid run produces. Any change to deferred-range handling must leave that intact. |
| The guard's shape rule needs a run to check it | It does not. Both endpoints must be `{base}` or `harness/{id}/…`; `{id}` is uninterpolated in the flow file, so the rule is a static property of the text. `lintFlow` in `spike/src/lint.js` has no rule about `input.diff` — or about step inputs at all — today. |
| The missing-ref path already has messages, and fixtures assert them | It does, and they do. Three distinct errors fire before the empty check: `repo.base_branch in harness/harness.yaml names missing ref "<base>"`, `ticket <id>: expected <integration>; review requires an integrated branch`, and `<step>: input.diff names missing ref "<ref>"`. `spike/test/q0034-chore-preflight.js` matches the second and the guard's own message by substring. This is where the two candidates genuinely conflicted; AC-5 resolves it. |
| `runs.log` records the heads a review ran against | It does not. Q-0006's run-10 lines record run, step, vendor, verdict, cost and duration, and no SHA. |

## User stories

**`maintainer`** — A run of mine stopped because a diff was empty, and the engine told me a story
about a merge. I want it to tell me the two commits it compared, what it asked git, and what git
answered, so I can decide in one read whether the tool is wrong or my branch is — and so I can
re-check it tomorrow, after the refs have moved.

**`adopter`** — My first review run failed on my own repository with a sentence recommending a fix
the tool then refuses to accept. I want the failure to name a remedy that works, or no remedy at
all. Being sent in a circle in the first thirty minutes is worse than being told less.

**`contributor`** — I want one answer in this codebase to "is A contained in B?", with the shallow
and exit-code rules in one place. If the engine and the board disagree about what a non-zero exit
means, I cannot tell which one my adapter or template should trust.

## Acceptance criteria

Surface: `harness run` and `harness lint`, and the engine behind them. `<base>` is `main`, from
`repo.base_branch` in `harness/harness.yaml`. All tests live in `spike/test/` and run under the
existing `npm test` in `spike/`. No test invokes a paid adapter.

**AC-1 — The empty-range failure names its evidence.** When `git diff --stat <range>` succeeds with
no output, the resulting error names five things: the range as written in the flow file *and* as
interpolated; both endpoints by ref name; the short SHA each endpoint resolved to; the containment
check that was performed, quoted precisely enough to re-run by hand; and its outcome, stated as one
of `contained`, `not contained` or `indeterminate`. Short SHAs come from `git rev-parse --short` and
tests must not assume a fixed abbreviation length. A test asserts all five elements, and asserts
both short SHAs appear, for every case in AC-4.

**AC-2 — The failure asserts only what git returned.** The message states a containment
relationship and never a historical event. It does not say a ref was "merged", "merged into",
"already in", "landed", "shipped", "rebased", "cherry-picked" or "reset", and does not otherwise
describe how the state arose. It uses the vocabulary `docs/GLOSSARY.md` defines under
**Containment**. A test asserts the message matches none of a forbidden-synonym list, in every case
in AC-4 and AC-5.

**AC-3 — One set of ancestry rules in the repository.** The check obeys both rules recorded in the
containment decision of 2026-08-24. State is selected from git's own exit codes and from nothing
else: 0 → contained, 1 → not contained, any other exit or an execution failure → indeterminate,
carrying a concise reason. The shallow asymmetry holds: exit 0 stays contained even in a shallow
repository, because ancestry found in the history that is present is real; exit 1 in a shallow
repository becomes indeterminate, because history that is absent cannot disprove ancestry. The
implementation **shares** these rules with `containment()` rather than restating them — extracting a
two-ref primitive that both call is the expected shape, and a second independent implementation of
the same decision fails this criterion. Every scenario in `spike/test/q0036-board-containment.js`
passes unmodified. A test asserts the shallow case directly, on a shallow fixture.

**AC-4 — Four empty-range cases, four honest messages.** Each produces a distinct and correct
diagnosis, and each is covered by a test:

1. the right endpoint is an ancestor of the left — **contained**;
2. the endpoints are different commits with identical trees, neither an ancestor of the other — **not
   contained**, and the range is still empty. Both differing short SHAs appear; the message does not
   infer that the refs are the same commit;
3. the range is well-formed and simply has no commits since the merge base — **not contained**,
   nothing added;
4. the check could not answer — git returned neither 0 nor 1, or the repository is shallow and the
   check returned 1 — **indeterminate**, with the reason.

Case 4 is the one that does not exist today; the current `catch` renders it as case 2 or 3.

**AC-5 — An unresolvable endpoint fails with the evidence that exists.** When either endpoint cannot
be resolved, the error names the complete range, identifies which endpoint failed to resolve,
includes the short SHA of the other endpoint when that one resolves, and states that neither the
diff nor the containment check was run. It invents no SHA and no containment outcome for the missing
ref. **The three existing missing-ref messages keep their identifying phrases** — `names missing
ref`, `review requires an integrated branch`, `repo.base_branch in harness/harness.yaml` — because
existing fixtures match them by substring and `spike/test/**` is a qa-red artifact in the general
case; the new evidence is added around those phrases, not in place of them. Tests cover a missing
left endpoint and a missing right endpoint, and assert the preserved phrases.

**AC-6 — The message and the guard agree, and guard failures stay guard failures.** Three parts,
each independently testable. The empty-range and missing-ref messages no longer recommend pointing
`input.diff` at a merge commit or at any endpoint the guard would reject. Every remedy any of these
messages names, applied to the failing flow, passes the guard — asserted by a test that extracts the
suggested range and runs it through the guard. And a malformed or unrelated range continues to fail
at the guard, before any diff or containment work, with a message naming the supplied range and the
allowed endpoint classes, which does not read as an empty-range diagnosis.

**AC-7 — The guard still composes with a future `--base`.** The expected endpoint classes stay
derived from `ctx.vars.base`, so a run given a different base accepts
`<thatbase>...harness/{id}/integration` and still rejects an unrelated ref. Tested by running a flow
with `ctx.vars.base` set to a branch other than `<base>`. This criterion exists to stop the guard
being hardened into something a `--base` flag cannot use; it does not add that flag.

**AC-8 — No adapter is invoked before a bad pre-existing-ref range is found.** A flow whose first
step invokes an adapter and whose later step carries a bad range over refs that exist before the run
fails with **zero** adapter invocations. Every failure class is covered: each of AC-4's four empty
cases, a missing ref, a malformed range, and an unrelated ref. One bad range fails the run even when
other ranges are valid. The count is taken at the adapter boundary — the run-history occurrence
records under `.quorum/runs/` are the preferred route, since they need no new test seam; a wrapping
adapter or an exported counter is also acceptable. It is **not** inferred from an artifact's
absence, which is what `q0034-chore-preflight.js` C2 does today and which a step that is billed and
then fails would satisfy falsely.

**AC-9 — A deferred range fails at the earliest point that is possible, with the same quality of
evidence.** A range whose endpoint an earlier step of this flow creates stays deferred, and is
materialised before the adapter that would consume it. When it turns out empty, missing or
indeterminate at that point, the consuming adapter is not invoked and the message satisfies AC-1
through AC-6 *and additionally* names the step that was expected to create the endpoint — so the
reader learns that the implementer committed nothing, rather than that a branch is missing. The test
counts the producing and the consuming adapter separately and expects the former to have run and the
latter not to have. The `--dry` placeholder path is unchanged, asserted by a test. The preflight's
own comment and the docs state plainly that AC-8's zero-invocation guarantee covers pre-existing
refs only, and why it cannot cover the rest.

**AC-10 — `harness lint` rejects a malformed or out-of-class `input.diff` before the run starts.**
A new rule in `lintFlow` rejects an `input.diff` that is not exactly two endpoints joined by `...`,
each of which is `{base}` or `harness/{id}/…`. It reports the flow, the step and the offending
value, and exits non-zero. The rule is **static only** — it interpolates nothing and runs no git —
so it is the one check that also protects a deferred range, whose emptiness cannot be known early.
It restates the engine's existing guard and adds no new constraint on what a flow may name. Tests
cover a well-formed flow, every shipped flow in `harness/flows/` unchanged, and at least one
malformed range per rejection reason.

**AC-11 — Valid evidence is unchanged.** For a non-empty range, behaviour is untouched: each
distinct range is materialised once, every panel member receives identical bytes, and truncation,
`max_diff_bytes` and the UTF-8 suffix trim are unaffected. The existing mock-adapter end-to-end
suite stays green. A regression test proves the diagnostic change neither rejects nor alters a valid
diff.

**AC-12 — The erratum is closed on the record, with evidence that survives a clone.**
`docs/DECISIONS.md` gains an append-only entry, in the required **Decision** / **Alternatives
considered** / **Why** form, that names and closes *"Erratum: M1's closing entry on Q-0006's empty
diff — 2026-08-24"*. It states plainly whether the sentence the engine printed at Q-0006's review
run 10 was accurate at the time, **distinguishing the ancestry fact from the historical event** —
those are different claims and the entry must not settle one by proving the other. Because
`runs.log` records no SHAs, the entry must establish the run-time heads by a route that survives a
clone: **commit timestamps compared against the run-10 timestamps in
`backlog/Q-0006-…/runs.log`.** Reflog may corroborate and must not carry the argument — it is
machine-local, expires by default, and does not survive a clone. The entry transcribes its SHAs,
commands and exit codes rather than instructing the reader to run anything, and for each command it
cites, names which question that command answers — the lesson Q-0034 recorded as *"before trusting a
git command as evidence, state which question it answers."* It also records the AC-6 remedy decision
and why the range guard was retained.

*Leads, verified on 2026-08-25 and offered as a starting point rather than as the answer:* run 10
started `2026-08-23T22:58:25.691Z` and ended `23:11:00.943Z`; `cdec5e9` (`merge: Q-0033 …`) was
committed `2026-08-24T00:47:33+02:00`, eleven minutes before the run began; `998f397` was committed
`2026-08-23T00:00:33+02:00`; `git merge-base --is-ancestor 998f397 cdec5e9` exits **0** today; and
`02f248f` (`01:31+02:00`) and `29ad00a` (`01:42+02:00`) both postdate the run's end. The
implementer re-derives this chain rather than copying it.

## Non-goals

- **A `--base` flag, or reviewing a branch already contained in the base.** M1's carried-forward
  item, and the honest fix for the situation this diagnostic reports. AC-7 keeps the door open; this
  ticket does not walk through it.
- **Changing the guard's rule.** The set of ranges a flow may name is settled by Q-0034. AC-6 changes
  the message to agree with the guard, never the guard to agree with the message.
- **Removing the empty-range failure, or softening it to a warning.** Stopping is correct and was
  bought at $5.023.
- **Zero total adapter invocations for a range whose endpoint the run creates.** See OQ-1.
- **Reconstructing branch history from ancestry alone**, or narrating every past empty diff beyond
  what git can still prove today.
- **Predicting whether a future step will produce an empty tree or an empty diff.**
- **Adding SHAs, ranges or containment results to `runs.log`, `.quorum/runs/` or
  `contracts/Q-0011/run-manifest.schema.json`.** See OQ-2.
- **Diff truncation, `max_diff_bytes`, the UTF-8 trim, or three-dot diff semantics.** Untouched; two-dot
  ranges stay unsupported.
- **Adapter behaviour, output schemas, billing data, budget enforcement or subscription checks.** No
  refund or recalculation of Q-0006 run 10's recorded cost.
- **Gates, stages, flow YAML syntax, ticket frontmatter, or any persisted format.**
- **Porting any of this to `packages/core`** — Q-0009.
- **The board, `harness runs`, or any other surface that reads containment.** Q-0036 shipped; AC-3
  shares its rules and changes none of its output.
- **The remaining M1 carry-overs:** no lock on a ticket, `finish()` not rolling back task branches,
  and a non-interactive gate having no way to say "undecided".
- **Any v1-excluded capability**, including multi-user operation, a remote daemon, cloud sync, a
  plugin marketplace, visual flow editing, eval suites, another adapter or a desktop shell.

## Open questions

Both candidates raised a blocker. Both are decided here — that is what this gate is for — and each
decision is recorded with its reasoning so solutioning can proceed without re-opening it. Nothing
below blocks.

**OQ-1 — Must a flow-created range guarantee zero *total* adapter invocations? — DECIDED: no.**
*Raised by codex as its blocker.* The ticket body asks that a flow carrying a bad later range fail
before the first adapter is invoked. For ranges over pre-existing refs that is already true and AC-8
locks it in. For `chore.yaml`'s `integration...implement`, the right endpoint does not exist until
the implement adapter has run, so emptiness is unprovable before that adapter is billed. Demanding
zero total would require changing the flow model — evidence would have to pre-exist every adapter —
which is a different ticket and a much larger one than a diagnostic. **The guarantee is
earliest-possible: the producing adapter may run, the consuming adapter may not** (AC-9), and the
one class that *can* be caught statically — a malformed or out-of-class range — is caught before the
run by AC-10. The limit is documented rather than papered over, which is the same discipline this
ticket exists to enforce.

**OQ-2 — Should a run record the SHAs it diffed? — DECIDED: not here; open as a follow-up.**
*Raised by claude.* One line per materialised range would make this whole class of question
answerable forever, and it is a few characters of code. It is also a change to a persisted format,
and `contracts/Q-0011/run-manifest.schema.json` is frozen — the frozen-contract rule says it belongs
to a ticket that opens those files legitimately. AC-12's timestamp route makes the erratum
answerable without it, which removes the urgency. Worth doing soon; not worth breaking the rule for.

**OQ-3 — Should the message suggest a remedy at all? — DECIDED: yes, at most one.**
*Raised by claude; codex reached the same place from the other direction.* The current
recommendation is wrong, which argues for correcting it rather than deleting it — an adopter hitting
this in their first thirty minutes needs a next move. The honest remedies are "review before the
right ref becomes contained in the left" and "check that the work was committed to the branch the
flow names". AC-6 requires whatever survives to pass the guard, which is the property that failed
last time.

**OQ-4 — What if the erratum's answer is "the sentence was accurate"? — DECIDED: it changes
nothing.** *Raised by claude.* The evidence points that way, and AC-12 requires the entry to state
the answer either way. The message is being fixed because it overstates its evidence and misdirects
its reader, not because its conclusion was false. Said out loud so nobody treats a vindicated
conclusion as a reason to close the ticket.

**OQ-5 — How much git stderr belongs in an indeterminate message? — Engineer's call.** *Raised by
codex.* Normalise to a single line; the command and the `indeterminate` state are mandatory, the raw
text is not. No file format or contract is affected.

## Risks

- **The chore run of this ticket will not exercise the change.** `harness run` executes the engine
  from the invoking checkout while the implementer's work lands in a worktree, so the review step's
  diff is materialised by the *old* `materialiseDiff`. This is milder than the reflexive hazard of
  2026-08-23 — the run will not fight the change — but it means **the tests are the proof and the
  run is not**. Every criterion above is written to be checkable by a test rather than by watching a
  flow.
- **The integrate step is where it flips.** From the moment `integrate` merges to the ticket branch,
  the repository's own checks run against the new code. A defect making every empty range
  indeterminate would pass a green suite and surface only on the next real review. AC-4's four cases
  exist to make that specific regression impossible to ship green.
- **Existing fixtures assert neighbouring messages.** `q0034-chore-preflight.js` matches
  `/review requires an integrated branch/` and `/must relate the configured base…/`; `smoke.js`
  asserts no failure is reported with an empty reason. AC-5 and AC-6 are written to preserve those
  substrings, but a careless regex-wide rewrite of the failure strings will break them. Change the
  empty-range message freely; extend the others.
- **Extracting a shared ancestry primitive touches the board's code path.** `containment()` is days
  old and covered by `q0036-board-containment.js`. AC-3's extraction must leave every one of those
  scenarios passing unmodified; if the refactor gets expensive, sharing the rules through one
  well-commented helper both call is enough, and duplicating the rules is not.
- **Preflight overreach or underreach.** Treating a flow-created ref as missing at run start would
  reject a valid chore flow; misclassifying a pre-existing ref as flow-created would let a bad range
  through to a billed step. Deferral must stay order-aware, including the rule that a parallel
  sibling is concurrent rather than earlier. Tests need both a genuine earlier-step-created endpoint
  and a genuinely missing pre-existing one.
- **Misleading SHA presentation.** Refs move after a message is printed. Showing ref and short SHA
  together is what makes the message re-checkable, but tests must not assume a fixed abbreviation
  length, and error assertions should check for required fields and prohibited claims rather than
  one punctuation-sensitive sentence.
- **The erratum's evidence is local-only today.** The commits are reachable from local refs with no
  remote holding them. AC-12's timestamp route is durable; the reflog corroboration is not. Do this
  criterion first, not last.
- **Over-diagnosing.** The temptation is to add explanations — detached HEAD, a stale worktree, an
  unpushed commit. Each new branch of the message is a new claim that can be wrong in exactly the way
  this ticket exists to fix. Four cases, each tied to an exit code, is the whole surface.

## Cross-cutting checklist

- **BYOS** — n/a. No auth path is read, added or changed; no key name appears in any test or fixture.
  AC-8's and AC-9's counting uses the mock adapter and the run-history records.
- **Worktree safety** — `materialiseDiff` only reads git. No flow writes to the working tree,
  worktrees stay under `.quorum/worktrees/`, and the ticket branch is `harness/Q-0035/integration`.
- **Gate behaviour** — unchanged. No gate becomes `auto`, no `human-locked` gate is touched. AC-8 and
  AC-10 concern *when* a run fails, not who answers for it.
- **File format** — no change to `ticket.md`, `runs.log`, `.quorum/runs/`, `harness.yaml` or any
  contract, subject to OQ-2. The flow files in `harness/flows/` are unchanged; AC-10 lints them as
  they are and must pass on all of them.
- **Lint rules** — one new rule (AC-10): `input.diff` must be two `...`-joined endpoints, each
  `{base}` or `harness/{id}/…`. It restates the engine's guard statically and adds no new constraint.
- **Dependencies** — none added.
- **Product-agnostic** — no SaaS product is named. The message names refs and SHAs from the user's own
  repository and nothing else.
- **Cold-clone impact** — net positive: no added step and no new command in the first thirty minutes.
  An adopter who hits an empty range gets a message naming their two commits and a remedy that works
  instead of one the tool refuses. AC-10 adds a check to `harness lint`, which `harness run` already
  invokes, so nothing new must be run by hand.

## Provenance

Both candidates were factually sound — every code claim in each was re-derived against `main` and
held. The merge was therefore about scope and about resolving two blockers, not about correcting
errors.

**From claude:** the four-part problem statement and the "what the code actually says" table, which
is the single most useful artifact either candidate produced; the exit-code and shallow-asymmetry
rigour and the requirement to *share* rules with `containment()` rather than re-derive them (AC-3);
the four-case structure (AC-4); the insistence that adapter counting happen at the boundary rather
than by artifact absence, with the existing fixture named as the anti-pattern (AC-8); the `harness
lint` rule (AC-10); the transcribe-don't-instruct requirement on the DECISIONS entry (AC-12); and
the risk that existing fixtures assert neighbouring message text.

**From codex:** the missing-ref criterion, which claude omitted entirely and which is a real gap —
"git could not answer" and "the ref does not resolve" are different failures (AC-5); the
identical-trees case (AC-4.2); the clause keeping guard failures distinct from empty-range diagnoses
(AC-6); the valid-range regression criterion (AC-11); separate counting of producing and consuming
adapters (AC-9); the run-10 record details; and the caution against punctuation-sensitive error
snapshots.

**Decided at this gate:** codex's blocker (OQ-1) resolved as earliest-possible rather than
zero-total, with the reason on the record; claude's blocker (OQ-1 in its numbering) resolved as
in-scope but narrowed to a static, git-free lint rule; and the one genuine conflict between them —
codex wanted the missing-ref messages rewritten, claude warned that existing fixtures assert them —
resolved in AC-5 by adding the new evidence *around* the preserved identifying phrases, which keeps
both the improvement and the fixtures.

**Added here:** AC-12's requirement that run 10's heads be established by commit timestamps compared
against `runs.log`, rather than by reflog. Claude required reflog lines to be transcribed and codex
listed reflog perishability as a risk; neither offered a substitute that survives a clone. The
timestamp chain does, and it was verified to resolve. Also added: the `--dry` placeholder constraint
in AC-9, which neither candidate mentioned and which a change to deferred-range handling could
easily break.

**Struck:** codex's AC-13 and AC-14, which are a test-suite statement and a cross-cutting checklist
rather than independently testable behaviour; both are folded into the cross-cutting checklist above,
where they belong and where they cost the ticket nothing.

**Size:** twelve criteria, within the ten-to-fifteen band. The usual objection to twelve — that the
development fan-out serialises when tasks share a file — does not apply: this ticket is routed
through the chore flow, which runs one implementer, so the concentration of ACs 1–9 and 11 in
`materialiseDiff` is a virtue rather than a contention point.
