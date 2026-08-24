# Q-0011 review — round 2 (claude)

**Verdict: changes-requested.** 0 blockers, 12 majors, 9 nits.

Reviewed `main...harness/Q-0011/integration` at `5e5c41d`, against
`requirements/merged.md`, `solution/solution.md`, and the four frozen contracts under
`contracts/Q-0011/`. Every claim below was checked against the branch itself
(`git show harness/Q-0011/integration:<file>`), not against the patch text; line numbers are
branch line numbers.

**One limit on this review, stated up front.** I could not execute the suite — creating a scratch
worktree was denied, and this is a read-only role. Everything below is static reading plus git
metadata. Two findings (major 8, nit 4) make claims about timing and cost that only a run can
settle; I have marked them.

---

## What round 2 changed

All four round-1 blockers are closed, and closed properly. Each fix carries a scenario in a **new**
file, `spike/test/q0034-review-fixes.js`, rather than an edit to `spike/test/q0011-*.js` — which is
the right call under the ownership decision of 2026-08-23 and the "a red test is a permanent
acceptance test" decision: a developer who can edit the tests judging the work can make anything
green. The file says so in its header. That is the correct instinct and it should be kept.

| Round-1 blocker | Status | Evidence |
| --- | --- | --- |
| 1 — `_started` persisted, violating `additionalProperties: false` | **fixed** | `spike/src/engine.js:316` moves it to a module-level `WeakMap`; scenario B1 asserts no snapshot contains `_started` *and* that at least one snapshot caught a `running` occurrence, so the window is provably entered |
| 2 — `vendorTokenTotal` double-counts cache-creation tokens | **fixed** | `spike/bin/harness.js:176` sums `input_tokens + output_tokens` only; B2 uses non-null cache fields (1000/700/250) and asserts `tokens=1100`, not `1350` |
| 3 — AC-1's collision refusal not implemented | **fixed, with reservations** | `spike/src/engine.js:283-291` translates `EEXIST` into a `FlowError` naming the directory; B3 pre-creates it and asserts `instanceof FlowError` and no `EEXIST` in the message. See new majors 1 and 2 and nit 1 below |
| 4 — branch 91 commits behind `main` | **fixed** | merge `c90d736`; `git rev-list --count harness/Q-0011/integration..main` is now `0`, merge-base is `4c83ccf` (tip of `main`) |

B1 in particular is a good test. Asserting only "no `_started` in the final manifest" would have
passed against the pre-fix branch; asserting that a snapshot caught a `running` occurrence is what
makes it prove something.

**What round 2 did not change.** Of round 1's ten majors, one was fixed. I re-verified the other
nine against the branch and all nine are still present, unmodified. Six nits, all still present.
They are restated compactly below with their branch line numbers so they are not lost, and two of
them (majors 5 and 9) get fuller treatment because I have evidence round 1 did not.

---

## Majors

### New in this round

**major 1 — `spike/src/engine.js:65-72` · the AC-1 refusal writes a `start` line to `runs.log` and
never writes a terminal one, and the comment justifying the change claims the opposite.**

The comment at `:51-53` reads:

> The run's own `start` line and its runs.log entry are emitted inside the try below, not here:
> Q-0011 moved them so that a failure during `initialiseRunHistory` still receives a terminal
> record.

The code does not do that. `backlog.log(ticket, 'run=N … start …')` runs at `:68`,
`initialiseRunHistory(ctx)` at `:69`, and the `catch` at `:70-74` removes the signal handlers and
rethrows — `finish()` is never called. So an AC-1 refusal leaves `runs.log` holding a run that
started and then stopped existing, and `ticket.md`'s `history` with no entry at all.

That is the exact invariant the Q-0001 decision established and that the comment eleven lines below
still defends ("so runs.log never shows a run that started and then simply stopped existing").
Q-0011 adds a brand-new fatal path at run start, so this is not a hypothetical: it is the first
thing an operator will hit when the refusal fires. And a comment that states an invariant the code
does not hold is worse than no comment — it is the artifact a future reader will trust when
resolving the next merge in this hunk.

Fix: call `finish(ctx, ticket.meta.stage, 'failed', <reason>)` on that path before rethrowing, or
move `backlog.log(… start …)` to after `initialiseRunHistory` and correct the comment to say which
of the two was chosen. Assert it: after a refused run, `runs.log`'s last line for that `run=` must
be a terminal one.

**major 2 — `spike/src/engine.js:283-291` · AC-1's collision refusal cannot detect the concurrency
case its own error message names.**

The refusal message says *"Another run may be in flight."* It almost never will be. `nextRunId`
(`spike/src/engine.js:638-646`) allocates by scanning `runs.log` for `\brun=(\d+)\b` and returning
`max + 1`. Run A logs `run=5 … start` at `:68` *before* creating `.quorum/runs/Q-0011-5`. Run B,
started any time after that line lands, reads `run=5`, allocates `6`, and creates
`.quorum/runs/Q-0011-6` — no collision, no refusal, two live runs on one ticket, which is the
hazard M1 explicitly carried into M2 ("The engine has no lock on a ticket").

The guard fires only in the sub-second window where both runs read `runs.log` before either writes
to it. Scenario B3 proves the refusal works by pre-creating the directory by hand — a state the
engine cannot reach on its own, which is precisely why round 1 found AC-1 untested.

This matters beyond the criterion, because the requirement's Open Question 3 — *"Are concurrent
runs on one ticket prevented or merely detected?"* — is answered in the requirement with *"AC-1
makes a collision loud, which is enough for a single-user local tool."* As implemented, that premise
is false: a collision is silent in the common case. That answer should be re-taken with this
evidence, not carried forward.

I am not asking for a lock in this ticket — that is out of scope and belongs with the M2 item. I am
asking for two things: the error message must stop claiming a detection the mechanism does not
provide, and the requirement's Open Question 3 must record that the guard covers only a
sub-second race. If a cheap real detection is wanted, it is available: allocate the id, then treat
"a run directory exists at a *higher* index than mine" as the collision signal, or write a
`running` marker the next run can see.

**major 3 — `spike/src/adapters/mock.js:33-35` · the mock violates the cache-subset clause of its
own frozen contract, so no engine-produced manifest can exercise the invariant round-1 blocker 2
was about.**

`contracts/Q-0011/mock-adapter-run-history.contract.md` closes with:

> The mock reports cached fields as subsets of `input_tokens` and never adds them again when
> forming that total.

The implementation takes `MOCK_CACHED_INPUT_TOKENS` and `MOCK_CACHE_WRITE_INPUT_TOKENS` verbatim
and sets `input_tokens: prompt.length / 4 | 0` independently. In the AC-9 scenario of
`spike/test/q0011-run-history.js`, the prompt is `'# Role: qa'` — ten characters — so the emitted
usage is `input_tokens: 2, cached_input_tokens: 7, cache_write_input_tokens: 3`. Cached input is
three and a half times total input. Nothing catches it: `run-manifest.schema.json` constrains each
measure to be a non-negative number independently, and `checkRunManifestSemantics`
(`spike/bin/harness.js:263-317`) recomputes the roll-up but never relates the cache fields to
`input_tokens`.

The consequence is the interesting part. Blocker 2 of round 1 turned entirely on cache fields being
*subsets* rather than *summands*. Because the mock cannot produce a realistic subset relationship,
the only end-to-end evidence for that rule is a hand-written JSON literal in
`spike/test/q0034-review-fixes.js:96-108` — the file itself says so: *"Q-0011's own CLI fixture
leaves them null, which is why a 35% overstatement passed its suite."* AC-14's stated purpose is
that the contract fails on a real artifact rather than a fixture; on this specific invariant it is
still a fixture.

Fix: clamp the switches into `input_tokens` in the mock — either raise `input_tokens` to at least
`cached + cache_write`, or reject a profile whose cache fields exceed it, with the same explicit
failure the other malformed switches already get at `:100-110`. Then the AC-9 scenario produces a
manifest whose cache accounting is internally possible, and B2's fixture can be replaced by engine
output.

### Carried over from round 1, verified still open

Each of these was reported in round 1, has not been touched, and I confirmed it on the branch. The
full argument is in `review/round-1/verdict.md`; here is the current line and what I can add.

**major 4 — `spike/src/engine.js:217-240` · billed usage is lost when post-adapter processing
throws.** *(round-1 major 1)* Still open. `terminalOccurrence(… 'completed', { usage })` is at
`:240`; between the successful return and that line sit the `writesOf` loop (`:220-223`), the
verdict file write (`:225-228`), and `commitAll` (`:230-236`). I checked `commitAll`
(`spike/src/fanout.js:80-92`): its `git add`, `git diff --cached` and `git commit` calls are **not**
wrapped in `safe()`, so an index lock, a pre-commit hook, or a signing failure throws. The outer
handler at `:112-116` then records the occurrence as `failed`, category `unknown`, `usage: null` —
a call the vendor billed, invisible to the roll-up.

I considered escalating this to a blocker and decided not to. AC-10's literal text is about the
*adapter* throwing, and that path (`:203-207`) is handled correctly. But AC-11 requires the roll-up
to reproduce from all occurrence usage "counting retried, parallel, failed and interrupted
occurrences once each", and this drops one; and it is a re-run of the ticket's founding grievance —
the $4.54 that could not be recovered. Retain `res` on the occurrence the moment the adapter
returns, before any write.

**major 5 — `spike/bin/harness.js:508-515` · a ticket-filtered list names a malformed sibling and
exits 0, and the code now argues against the round-1 verdict in a comment.** *(round-1 major 5)*
The comment at `:509-511` reads *"A syntactically valid ticket id with zero matches is always exit
0 — see contracts/Q-0011/runs-cli.contract.md — regardless of unrelated malformed siblings."*

That reads the contract selectively. `runs-cli.contract.md` contains both *"zero matches is an
empty list and exit zero"* and *"A malformed sibling is named, valid siblings are still rendered,
and the final exit is non-zero."* The case at issue is not the first clause: `harness runs Q-0011`
with matching runs *and* a corrupt sibling is not "zero matches", and it exits 0 anyway.

More to the point, the code is self-inconsistent regardless of which clause governs. It passes
`warnings` into `printRunsListHuman` at `:513` and into `runsListJSON` at `:512`, so it *does* name
the corrupt directory — and then signals success. A script piping `harness runs Q-0011` is told the
history is fine while being handed a warning it has no reason to read. Whichever way this is
resolved, name-and-exit-non-zero or say-nothing-and-exit-zero, the two halves must agree. The
contract says the former. If the developer believes the contract is wrong, that is an erratum in
`solution/errata.md` — the mechanism this ticket already used three times — not a comment resolving
a frozen contract by argument.

**major 6 — `spike/bin/harness.js:480` · detail mode parses every sibling manifest before opening
the one requested.** *(round-1 major 4)* `readRunsDir(runsRoot)` is still called unconditionally,
ahead of the token dispatch at `:482`. AC-13 requires the detail view to read "only files inside
the selected run directory". Move the call into the two list branches.

**major 7 — `spike/src/engine.js:396-398` · `errorOf` re-implements auth and transient
classification and disagrees with the exported source of truth.** *(round-1 major 6)* Unchanged.
`authError` (`spike/src/adapters/index.js:118-125`) and `transientError` (`:56-60`) are both
exported and both live at the contract layer by decision, so contributor adapters inherit them. The
hand-rolled `authErrorCategory` matches only `login expired or missing` plus three patterns, so the
`"model is not supported when using Codex with a ChatGPT account"` sentence that `authError`
special-cases — the headline finding of Q-0001 — lands as `category: "adapter"`. And
`transientErrorCategory`'s `\b5\d\d\b` classifies any error mentioning a three-digit number in
500-599 as transient. The retry wrapper and the manifest can classify one failure two ways.

**major 8 — `spike/src/engine.js:472` · the one-second timer in `runGate` keeps a fixture alive and
nothing else.** *(round-1 major 8)* Unchanged. I traced the only two consumers. On a TTY,
`ui.gate` (`spike/bin/harness.js:96-118`) holds a `readline` interface, which owns its own handle —
the timer adds nothing. Non-interactively with no `--gate-answer` left, `:94` throws before any
await. So the timer's sole effect is to keep the process alive for the fixture at
`spike/test/q0011-run-history.js:216-224`, whose `gate` is `() => new Promise(() => {})`. After
1000 ms the loop drains and the child exits **0 with `status: "running"`** — the outcome AC-3
forbids, produced by the mechanism added to prevent it. *(Timing claim unverified: I could not run
the suite. The parent polls at 10 ms and the child should be killed well inside the window, so I
expect this passes today; the objection is that the pass depends on a race the engine should not be
arranging.)* Delete the timer and give the fixture a gate promise that owns a handle.

**major 9 — `spike/src/adapters/mock.js:38` · `scope` splits on a directory this repository does
not use, so absolute paths reach persisted artifacts.** *(round-1 major 9)* Unchanged, and I can
now confirm both halves. `spike/src/git.js:11` writes worktrees to `.harness/worktrees` —
`path.join(repoDir, '.harness', 'worktrees')` — while mock.js splits on
`${path.sep}.quorum${path.sep}worktrees${path.sep}`. The split never matches, so `scope` is the
whole absolute `cwd`; `key` is built from it at `:40` and interpolated into `output.summary` at
`:56`, which reaches `output.txt` (`engine.js:217`), ticket artifacts (`engine.js:221`) and commit
subjects (`engine.js:232`) as `/private/var/folders/…`. AC-2 prohibits absolute paths in persisted
artifacts. This ticket's own non-goals name the `.harness/` versus `.quorum/` drift explicitly and
scope the rename out, so this code was written against a path the ticket already documented as not
existing. The `kind` discriminator added alongside it is sound and should stay; drop `scope`.

**major 10 — `spike/src/adapters/index.js:84-85` · the retry wrapper manufactures a usage object
for an adapter that reported none.** *(round-1 major 10)* Unchanged. `spent` initialises all-`null`
at `:73`, `add` returns early on a falsy usage at `:76`, and the success return unconditionally
emits `usage: { vendor, …nulls }`. `normaliseUsage` (`engine.js:384`) passes it through, and
`rollup` (`engine.js:377`) then creates a vendor row with `step_count: 1, unpriced_steps: 1`. The
writer contract restricts the roll-up to occurrences with non-null usage, and `claude.js:57` returns
all-`null` measures whenever the envelope carries no `usage` — so a real response inflates the
`unpriced_steps` figure AC-12 requires the CLI to state out loud. The error path at `:89-92` already
has the right shape; mirror it.

**major 11 — `spike/src/engine.js:203` and `:773`→`:858` · `output.txt` is not guaranteed.**
*(round-1 major 2)* Unchanged in both places. On the adapter-failure path, `if (e.raw != null)`
makes the on-disk shape depend on whether a given vendor attaches `raw` to its error. On the
integrate path, the occurrence is allocated at `:773` and `output.txt` written at `:858`, with the
base-sync throw and every `mergeInto` / `ticketWorktree` failure in between — so the most common
integrate failure leaves an empty directory. `run-history-writer.contract.md` says integrate
occurrences *always* receive `output.txt`, "including … an empty file when the command produces no
text", and AC-5 says the same for adapter attempts. Seed it at allocation or write it in a
`finally`.

**major 12 — `spike/bin/harness.js:181` · `formatMoney` rounds real costs to `$0.00`.** *(round-1
major 7)* Unchanged. `toFixed(2)` against `formatCost`'s `toFixed(3)` everywhere else in the
codebase. The tokens-only decision forbids displaying an unpriced step as `$0.000`; `$0.00` is the
same failure one digit earlier, and it makes a $0.004 step indistinguishable from a
vendor-reported zero — the distinction `checkRunManifestSemantics` goes to real trouble to
preserve.

---

## Nits

**nit 1 — `spike/src/engine.js:272-278` · the stage guard is unreachable through the CLI.** Round 1
asked for it to be dropped or separately justified; a comment was added and the guard kept. The
comment is now honest about the guard being separate from AC-1's, which was the important part. But
the guard compares the in-memory ticket stage against `ticket.md` on disk, and `runFlow` already
refuses at `:38` unless `ticket.meta.stage === flow.consumes`, while every CLI path loads the ticket
from that same file. It can only fire when a caller hand-mutates the ticket object — which is what
the AC-1 scenario in `spike/test/q0011-run-history.js:79` does. It is an undeclared refusal path,
present in no criterion and no contract, kept alive by one test. Now that B3 exercises the real
refusal, this can go.

**nit 2 — `spike/src/engine.js:355-366` · every terminal occurrence re-serialises the whole manifest
and `fsync`s it.** Cost is quadratic in occurrence count. Fine at fan-out scale (five tasks); the
1000-step scenario at `spike/test/q0011-run-history.js:252-259` makes the repository's own suite pay
for roughly half a million occurrence-serialisations and 1000 `fsync`s, on a suite that every
`integrate` step runs. *(Unmeasured — I could not run it. Worth timing before it becomes the thing
that makes a development loop look slow.)* The requirement's Open Question 2 asks the architect to
measure run-directory size on the first real run; measuring wall-clock here belongs with it.

**nit 3 — `spike/src/engine.js:355-366` · a `manifest.json.tmp` survives a `SIGKILL` between write
and rename.** Harmless to `readRunsDir`, which filters to directories, but it accumulates and
nothing names or cleans it. AC-13's incompleteness reporting says nothing about it. One line at
`initialiseRunHistory` to remove a stale temporary, or a mention in the incomplete-run message.

**nit 4 — `docs/DECISIONS.md:207` · the new entry is inserted mid-file, and dated a day early.**
`docs-and-decisions.md` says DECISIONS.md is append-only; this entry sits at heading 20 of 40,
between the 2026-08-22 and 2026-08-23 blocks. It is chronologically placed, which is a defensible
reading, but it is not an append, and the file has been strictly appended until now. It is also
dated 2026-08-23 while the code landed on 2026-08-24 via Q-0034.

**nit 5 — `spike/bin/harness.js:233` · the per-step `usage:` line reuses `formatVendorSummary` with
a synthesised `unpriced_steps`.** *(round-1 nit)* Unchanged. It prints a roll-up field on a row that
is not a roll-up, and collapses four measures into one total. The fix comment at `:168-175` says the
cache fields "stay on the row as a breakdown for anyone who wants the split" — but no human output
path prints them, only `--json`. Print the fields.

**nit 6 — `spike/src/engine.js:397` · `authErrorCategory(vendor, message)` never uses `vendor`.**
*(round-1 nit)* Unchanged. Drop the parameter, or delete the function with major 7.

**nit 7 — `spike/bin/harness.js:466-472` · `readData(f)` re-reads and re-parses a file
`validateFile` parsed one line earlier.** *(round-1 nit)* Unchanged.

**nit 8 — `spike/bin/harness.js:465` · the skip notice names run-manifest checks for every schema.**
Validating any other contract — `contracts/Q-0006/ticket-review-state.schema.json`, say — now prints
*"run-manifest semantic checks skipped"* per file. The contract does require an explicit notice, so
this is compliant; it is also confusing output for a schema that has nothing to do with run
manifests. Consider phrasing it generically ("no semantic contract annotation").

**nit 9 — `spike/bin/harness.js:176` · `vendorTokenTotal` returns `null` when `input_tokens` and
`output_tokens` are both null but the cache fields are set.** Reachable only from a malformed
manifest, but the row then prints `tokens=n/a` beside populated cache counts.

---

## What is right, and worth keeping

Three things in this diff are better than they needed to be, and a later round should not trade them
away while fixing the above.

The **occurrence side table** (`engine.js:308-316`) is the correct shape of that fix, not just a
working one. The comment explains why deleting the field before the write was insufficient — a
sibling's write or a kill in the window persists it — and a `WeakMap` cannot leak into
`JSON.stringify` at all. That is a fix that closes the class, not the instance.

The **path confinement** at `harness.js:487-491` checks three independent things —
`token === path.basename(token)`, exclusion of `''`/`'.'`/`'..'`, and that the *resolved* parent is
the resolved runs root — rather than string-matching for `..`. B4 tests five distinct escape
tokens including an absolute path. That is the right way to write this check.

And the **annotation-driven semantic pass** is a genuinely good idea: `x-quorum-contract` decouples
the check from filename and `$id`, and `checkRunManifestSemantics` recomputing the roll-up from
occurrence usage is the only way to distinguish a reported zero from a mutated null. It earned its
DECISIONS entry.

---

## Suggested order of work

1. **major 1** and **major 5** first — both are one-line-scale and both are places where a comment
   currently argues for behaviour the code does not have or the contract does not permit. Comments
   that outrank contracts are the thing this repository has decided twice not to allow.
2. **major 4**, **major 11**, **major 10** — the three that put wrong or missing numbers into the
   record this ticket exists to produce.
3. **major 7**, **major 9**, **major 12** — each is a self-contained correction with an existing
   right answer already in the codebase.
4. **major 3** and **major 2** — the two that change what the tests can prove. Major 3 lets B2's
   hand-written fixture be replaced by engine output; major 2 needs a message correction here and a
   re-answer of Open Question 3 in the requirement.
5. **major 6**, **major 8**, then the nits.
