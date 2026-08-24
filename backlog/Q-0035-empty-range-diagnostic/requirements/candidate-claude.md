# Q-0035 — The empty-range diagnostic reports evidence, not a story

*Requirement · product-manager (claude) · 2026-08-25 · milestone M2 · iteration 1 · route: chore flow*

## Problem

When a step's `input.diff` resolves to a range git can show nothing for, the run stops — which is
right, and was bought expensively: Q-0006's review paid two vendors $5.02 to review zero bytes and
would have advanced on the verdict. What the run stops *with* is the problem. `spike/src/engine.js:779`
prints, for the merged branch of that check:

> `review-claude: \`main...harness/Q-0006/integration\` is empty because harness/Q-0006/integration
> is already merged into main — there is nothing left to review. Review before merging, or point
> input.diff at the merge commit.`

Three separate things are wrong with that sentence, and none of them is that the conclusion is
false.

**It reports an event it did not observe.** The engine ran an ancestry check. "Is already merged
into" is a claim about something that happened, by a route the engine never looked for — a merge, a
cherry-pick, a hand-applied patch, a rebase, or a branch that was simply created from base and never
committed to. The 2026-08-24 erratum in `docs/DECISIONS.md` exists because this exact inference was
written into the record and later failed to reproduce. Q-0036 then settled the vocabulary for the
whole product on 2026-08-24: containment is *"an ancestry fact about two refs at the moment of
reading, not a claim about how the code arrived — and not a synonym-carrier: the board and the docs
say 'contained', never 'merged', 'landed' or 'shipped'."* The board obeys that decision. The engine,
in the one message where the distinction was paid for, does not.

**It names nothing a reader can check.** No SHAs, no exit code, no statement of which check ran.
A maintainer who disbelieves the message has to reconstruct the run's git state by hand, which is
precisely what Q-0034 spent an evening doing and what the erratum is a record of. And a branch tip
moves: `harness/Q-0006/integration` was reset after review run 10, so the same command run the next
day answered differently. A message that names no SHA cannot be re-checked after the refs move,
which is the only time anyone wants to re-check it.

**It recommends a remedy the engine forbids.** "Point `input.diff` at the merge commit" is refused
21 lines earlier, at `spike/src/engine.js:756`: both endpoints must be the configured base or one of
this ticket's own branches. The advice was true when it was written on Q-0006's branch and false by
the time that branch landed.

Underneath all three is a smaller defect with a larger blast radius. The diagnosis at
`spike/src/engine.js:775–778` is a bare `try { merge-base --is-ancestor } catch { false }`. Every
non-zero exit becomes "not merged": a missing object, a corrupt repository, git not on `PATH`, a
timeout — all of them render as the confident second sentence, *"is empty — no commits to review"*.
That is the failure the containment decision names in rule 1 and forbids in as many words:
*"conflating 'provably not' with 'could not answer' manufactures exactly the confident falsehood
this ticket removes."* It also ignores shallow clones, where an exit 1 cannot disprove ancestry at
all. Meanwhile `containment()` at `spike/src/git.js:43` — landed the same night, for the board —
gets both rules right. **One repository now reads git ancestry two different ways, and the wrong one
is the one that talks to the user.**

## What the code actually says

The ticket body asks that the code be read rather than the body. Every row below was re-derived on
2026-08-25 against `main` with read-only commands, and each changes a criterion.

| Claim | What the repository says |
| --- | --- |
| The message hard-codes "merged into main" | It does not, since Q-0034. `spike/src/engine.js:776` checks `right` against `left` — the range's own endpoints — so the chore flow's `integration...implement` is diagnosed correctly. The remaining defects are the event-claim, the missing evidence, the stale remedy and the exit-code conflation. |
| The diagnosis is a two-state check | It is a two-state *rendering* of a three-state fact. `catch { return false }` at `:777` maps "provably not an ancestor" and "git could not answer" onto the same sentence. |
| Nothing in the repository knows how to do this correctly | `containment(repoDir, base)` at `spike/src/git.js:43` selects contained / not-contained / indeterminate from git's exit codes alone, probes `--is-shallow-repository` once, and applies the shallow asymmetry. It is branch-name-shaped (it matches against `for-each-ref` and takes a single base), so it is not callable as-is for an arbitrary two-endpoint range — but its rules are the product's rules and must not be re-derived weaker. |
| The preflight already prevents billing | For ranges over pre-existing refs, yes — `spike/src/engine.js:86–115` materialises each distinct range before the first step, and `spike/test/q0034-chore-preflight.js` C2 covers it. For ranges whose right endpoint an earlier step of the same flow creates, the preflight `continue`s and the range materialises at step time via `buildPrompt`'s fallback (`:688–696`), after that earlier step has been billed. |
| The guard's shape rule needs a run to check it | It does not. Both endpoints must be `{base}` or `harness/{id}/…`; `{id}` is uninterpolated in the flow file, so the rule is a static property of the text. `harness lint` checks no `input.diff` at all today — `lintFlow` at `spike/src/lint.js:28` has no rule for it. |
| The erratum cannot be settled | It can. `git merge-base --is-ancestor 998f397 cdec5e9` exits **0**, and `git reflog show harness/Q-0006/integration` records `@{0}: reset: moving to 29ad00a` *after* the entries for run 10. The branch moved after the review; the erratum measured the moved tip. Both observations are true and they answer different questions — the same lesson Q-0034 recorded as *"before trusting a git command as evidence, state which question it answers."* |
| `runs.log` records the heads a review ran against | It does not. `backlog/Q-0006-…/runs.log:67–71` records run, step, vendor, verdict, cost and duration, and no SHA. The two heads the merged requirement names for run 10 were recovered from reflog, which is machine-local and expires. |

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

Surface: the CLI (`harness run`, `harness lint`) and the engine. `<base>` is `main`, from
`harness/harness.yaml:20`. All tests live in `spike/test/`.

**AC-1 — The failure names its evidence.** The empty-range error names: the range as written and as
interpolated; both endpoints by ref name *and* short SHA; and the outcome of the check that produced
its conclusion. A reader can re-run that check from the message alone. Tests assert both SHAs appear
in the message for every case in AC-3.

**AC-2 — The failure asserts only what git returned.** The message states a containment
relationship, never a historical event: it does not say a branch is "merged", "landed", "shipped" or
"already in" another ref. It uses the vocabulary `docs/GLOSSARY.md` defines under **Containment** —
contained, not contained, indeterminate. A test asserts the message matches none of the forbidden
synonyms in any of AC-3's cases.

**AC-3 — Four cases, four honest messages.** Each produces a distinct, correct diagnosis, and each is
covered by a test:

1. the right endpoint is an ancestor of the left (contained);
2. the endpoints are different commits with identical trees, neither an ancestor of the other (not
   contained, and the range is still empty);
3. the range is well-formed and simply has no commits (not contained, nothing added since the merge
   base);
4. the containment check itself could not answer — git returned neither 0 nor 1, or the repository
   is shallow and the check returned 1 (indeterminate, with the reason).

Case 4 is the one that does not exist today. `spike/src/engine.js:777` renders it as case 2 or 3.

**AC-4 — One set of ancestry rules in the repository.** The check obeys the two rules recorded in the
containment decision of 2026-08-24: state is selected from git's own exit codes and nothing else
(0 → contained, 1 → not contained, anything else → indeterminate), and the shallow asymmetry holds
(exit 0 stays contained; exit 1 in a shallow repository becomes indeterminate). The implementation
shares its rules with `containment()` in `spike/src/git.js` rather than restating them — extracting
a two-ref primitive both call is the expected shape, and a second independent implementation of the
same decision fails this criterion. A test asserts the shallow case directly, on a shallow fixture.

**AC-5 — The message and the guard agree.** The empty-range message no longer recommends pointing
`input.diff` at a merge commit. Any remedy it names is one the guard at `spike/src/engine.js:756`
accepts. A test asserts that every remedy the message suggests, applied to the failing flow, passes
the guard.

**AC-6 — The guard still composes with a future `--base`.** `expectedRange` stays derived from
`ctx.vars.base`, so a run given a different base accepts `<thatbase>...harness/{id}/integration` and
still rejects an unrelated ref. Tested by running a flow with `ctx.vars.base` set to a branch other
than `<base>`. This criterion exists to stop the guard being hardened into something a `--base` flag
cannot use.

**AC-7 — No adapter is invoked before a bad range over pre-existing refs is found.** A flow whose
first step invokes an adapter and whose later step carries an empty, malformed or unresolvable range
over refs that exist before the run fails with zero adapter invocations, in every case in AC-3.
Counted at the adapter boundary — a wrapping adapter, an event count, or the run-history occurrence
records — not inferred from an artifact's absence, which is what
`spike/test/q0034-chore-preflight.js:110` does today and which a step that is billed and then fails
would satisfy falsely.

**AC-8 — A malformed range is caught before the run, not before the step.** `harness lint` rejects a
flow file whose `input.diff` is not two endpoints joined by `...`, each of which is `{base}` or
`harness/{id}/…`. It reports the flow, the step and the offending value, and exits non-zero. This is
the only check that also covers a range whose right endpoint an earlier step creates, since those
ranges cannot be materialised before the run. Tests cover a good flow, each shipped flow in
`harness/flows/`, and at least one malformed range per rejection reason.

**AC-9 — A deferred range fails with the same quality of evidence.** When a range whose endpoint an
earlier step created turns out empty at step time, the message meets AC-1 through AC-5 *and* names
the step that was expected to create the endpoint, so the reader learns that the implementer
committed nothing rather than that a branch is missing. The docs and the preflight's own comment say
plainly that the zero-billing guarantee of AC-7 covers pre-existing refs only, and why it cannot
cover the rest.

**AC-10 — The erratum is closed on the record.** `docs/DECISIONS.md` gains an entry that names the
2026-08-24 erratum and states plainly whether the sentence the engine printed at Q-0006's review run
10 was accurate at the time. It **transcribes** its evidence — the SHAs, the commands, their exit
codes, and the reflog lines that moved the branch — rather than instructing the reader to run
`git reflog`, which is machine-local, expires, and does not survive a clone. It states how the two
heads at run time were established, given that `runs.log` records no SHAs. It records the AC-5
decision with its alternatives, and it names, for each git command it cites, which question that
command answers.

## Non-goals

- **A `--base` flag, or reviewing a branch that is already contained in the base.** M1's carried-forward
  item, and the honest fix for the situation this diagnostic reports. AC-6 keeps the door open; this
  ticket does not walk through it.
- **Changing the guard's rule.** The set of ranges a flow may name is settled by Q-0034. AC-5 changes
  the message to agree with the guard, never the guard to agree with the message.
- **Removing the empty-range failure, or making it a warning.** Stopping is correct and was bought at
  $5.02.
- **Guaranteeing zero adapter invocations for ranges whose endpoint the run creates.** Emptiness
  cannot be proven before the branch exists. AC-8 and AC-9 are the reachable half; claiming more
  would be the same class of overstatement this ticket is about.
- **Adding SHAs, ranges or containment results to `runs.log`, `.quorum/runs/` or
  `contracts/Q-0011/run-manifest.schema.json`.** See OQ-2.
- **Reconstructing a narrative for every past empty diff** beyond what git can still prove today.
- **Diff truncation, `max_diff_bytes`, or the UTF-8 trim.** Untouched.
- **Porting any of this to `packages/core`** — Q-0009.
- **The board, `harness runs`, or any other surface that reads containment.** Q-0036 shipped;
  AC-4 shares its rules and changes none of its output.
- **The remaining M1 carry-overs:** no lock on a ticket, `finish()` not rolling back task branches,
  and a non-interactive gate having no way to say "undecided".

## Open questions

**OQ-1 — Is AC-8 in scope? Owner: `maintainer`. BLOCKER.**
A lint rule for `input.diff` is new surface in `spike/src/lint.js`, which today has no rule about
step inputs at all. It is the only check that protects a deferred range before a run starts, it costs
no git and no adapter, and it turns a class of flow-file error from a mid-run failure into a
pre-run one — which is what the "no adapter billed" clause is reaching for. It is also, strictly,
beyond AC-10–13 of the merged requirement, and the implementer needs to know before they cut the
work. Answer "in" and this is a 10-criterion ticket; answer "out" and AC-8 drops, AC-9 stands alone,
and the deferred-range gap stays open with a documented reason.

**OQ-2 — Should a run record the SHAs it diffed? Owner: `maintainer`. Recommendation: not here.**
This ticket exists partly because nobody can cheaply prove what two commits Q-0006's review actually
compared; `runs.log` records no SHAs and reflog is local and perishable. One line per materialised
range — `run=N diff range=<r> left=<sha> right=<sha>` — would make the whole class of question
answerable forever, and it is a few characters of code. It is nevertheless a change to a persisted
format, and `contracts/Q-0011/run-manifest.schema.json` is frozen, so the frozen-contract rule says
it belongs to a ticket that opens those files legitimately. Recommendation: open it as a follow-up.
Override with one word if you would rather have it now, and it becomes an eleventh criterion.

**OQ-3 — Should the message suggest a remedy at all? Owner: `maintainer`. Recommendation: yes, one.**
The current recommendation is wrong, which is an argument for correcting it, not for deleting it —
an adopter hitting this in their first thirty minutes needs a next move. The honest remedies are
"review before merging" and "check that the work was committed to the branch the flow names". AC-5
requires whatever survives to pass the guard. Not blocking.

**OQ-4 — What if the erratum's answer is "the sentence was accurate"? Owner: `maintainer`. Not blocking.**
The evidence above points that way: the ancestry check succeeded between the heads named for run 10,
and the branch was reset afterwards. AC-10 requires the entry to state the answer either way, and the
answer does not change AC-1 through AC-9 — the message is being fixed because it overstates its
evidence and misdirects its reader, not because its conclusion was false. Worth saying out loud so
nobody treats a vindicated conclusion as a reason to close the ticket.

## Risks

- **The chore run of this ticket will not exercise the change.** `harness run` executes the engine
  from the invoking checkout, while the implementer's work lands in a worktree, so the review step's
  diff is materialised by the *old* `materialiseDiff`. The new diagnostic first runs in anger only
  after the merge. This is milder than the reflexive hazard the 2026-08-23 decision names — the run
  will not fight the change — but it means the **tests are the proof, and the run is not**. Every
  criterion above is therefore written to be checkable by a test rather than by watching the flow.
- **The integrate step is where it flips.** `integrate` merges to the ticket branch and runs the
  suite; from that moment the repository's own checks run against the new code. A defect that makes
  every empty range indeterminate would pass a green suite and only surface on the next real review.
  AC-3's four cases exist to make that specific regression impossible to ship green.
- **Existing fixtures assert the old text.** `spike/test/q0034-chore-preflight.js` matches
  `/review requires an integrated branch/` and `/must relate the configured base…/`; `smoke.js:285`
  asserts no failure is reported with an empty reason. Those are other messages and should be left
  alone — but a careless regex-wide rewrite of the failure strings will break them, and
  `spike/test/**` is a qa-red artifact in the general case. Change the empty-range message only.
- **The erratum's evidence is local-only and perishable.** The three commits are currently reachable
  from local refs and there is no remote holding them; reflog entries expire by default. If AC-10 is
  deferred and the branches are ever tidied, the question becomes permanently unanswerable. This is
  the criterion to do first, not last.
- **Extracting a shared ancestry primitive touches the board's code path.** `containment()` is two
  days old and covered by `spike/test/q0036-board-containment.js`. AC-4's extraction must leave every
  one of those scenarios passing unmodified; if the refactor gets expensive, sharing the *rules* via
  one well-commented helper called by both is enough, and duplicating the rules is not.
- **Over-diagnosing.** The temptation here is to add more explanations — detached HEAD, a stale
  worktree, an unpushed commit. Each new branch of the message is a new claim that can be wrong in
  the way this ticket exists to fix. Four cases, each tied to an exit code, is the whole surface.

## Cross-cutting checklist

- **BYOS** — n/a. No auth path is read, added or changed; no key name appears in any test or fixture.
  AC-7's invocation counting uses the mock adapter.
- **Worktree safety** — n/a to the change itself; `materialiseDiff` only reads git. No flow writes to
  the working tree, worktrees stay under `.quorum/worktrees/`, and the ticket branch is
  `harness/Q-0035/integration`.
- **Gate behaviour** — unchanged. No gate becomes `auto`, no `human-locked` gate is touched. AC-7 and
  AC-8 concern when a run fails, not who answers for it.
- **File format** — no change to `ticket.md`, `runs.log`, `.quorum/runs/` or any contract, subject to
  OQ-2. `harness.yaml` is unchanged. The flow files in `harness/flows/` are unchanged; AC-8 lints them
  as they are and must pass on all of them.
- **Lint rules** — one new rule, subject to OQ-1: `input.diff` must be two `...`-joined endpoints,
  each `{base}` or `harness/{id}/…`. It restates the engine's existing guard statically and adds no
  new constraint on what a flow may name.
- **Dependencies** — none added.
- **Product-agnostic** — no SaaS product is named. The message names refs and SHAs from the user's own
  repository and nothing else.
- **Cold-clone impact** — net positive, no added step and no new command in the first thirty minutes.
  An adopter who hits an empty range gets a message naming their two commits and a remedy that works,
  instead of one the tool refuses. AC-8 adds a check to `harness lint`, which `harness run` already
  invokes, so nothing new must be run by hand.
