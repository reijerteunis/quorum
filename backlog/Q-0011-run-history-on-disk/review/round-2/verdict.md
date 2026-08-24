# Q-0011 — round 2 panel verdict

**Verdict: changes-requested.** 0 blockers · 14 majors · 9 nits, after deduplication.

Consolidated from `review/round-2/claude.md` (0 blockers, 12 majors, 9 nits) and
`review/round-2/codex.md` (4 majors). Reviewed against `harness/Q-0011/integration` at `5e5c41d`,
which is level with `main` (`git rev-list --count harness/Q-0011/integration..main` → `0`).

Line numbers are branch line numbers and are preserved from the reviews. Where the two panellists
filed the same defect, both anchors are kept.

---

## Judging the reviews

**The panel converged on two findings and diverged everywhere else.** Out of sixteen raised
findings, exactly two are duplicates. That is a low overlap for a two-vendor panel, and it is the
useful signal here: the reviewers were reading with different lenses rather than racing to the same
list. Claude read for continuity — it carried round 1 forward, re-verified all ten of its earlier
majors on the branch, and reported that nine were untouched. Codex read the round-2 diff cold and
went narrow and deep on the CLI reader.

**The two convergent findings are the most credible in the set.** `spike/bin/harness.js:515` (the
ticket-filtered list names a malformed sibling and exits 0) and the integrate occurrence's missing
`output.txt` were each found independently, from different starting points. Both are confirmed on
the branch.

**Codex found two things claude did not, and one of them contradicts claude directly.** Claude's
"what is right, and worth keeping" section singles out the path confinement at
`spike/bin/harness.js:487-491` as *"the right way to write this check"* — three independent
conditions, five escape tokens tested. Codex points out at `:493` that the check is lexical only:
`path.resolve` does not resolve symbolic links and `fs.statSync` follows them, so a single-segment
symlink inside `.quorum/runs/` satisfies all three conditions and reads a manifest from outside the
runs root. **Codex is right.** This is the panel working as intended — a second vendor catching what
the first had already blessed — and it is worth recording that the praise, not just the code, needed
the correction. The praise still stands for what it covers; it simply does not cover links.

Codex's second unique finding (`spike/bin/harness.js:141`, a manifest treated as readable purely
because it parses) is also confirmed: `readRunsDir` warns only on a `JSON.parse` or `ENOENT`
failure, so `{}` is pushed into `runs` and rendered as a valid run.

**Claude disclosed the limits of its own evidence, and that disclosure held up.** It could not
execute the suite and said so up front, marking two findings (major 8, nit 4) as unverified. I
checked major 8 statically: the timer at `spike/src/engine.js:472` exists and is cleared in a
`finally`, so the structural objection stands independent of the timing claim it could not settle.
Flagging the gap rather than asserting through it is the correct behaviour for a read-only role and
should not be read as weakness in the review.

**Nothing was promoted or demoted.** Neither panellist raised a blocker and I did not manufacture
one; every surviving major is a real defect with an identified fix, but none of them corrupts the
record in a way that cannot be corrected by the next round. Classifications are carried through as
filed, with one caveat noted at major 14.

**One pattern runs through six of the fourteen.** Majors 1, 3, 4, 5, 10 and 11 all put a wrong or
absent number, or a wrong or absent record, into the very artifact this ticket exists to produce —
usage dropped between the adapter's return and the occurrence record, usage synthesised where the
vendor reported none, `output.txt` missing, money rounded to two places, a `start` line with no
terminal partner. Q-0011's founding grievance is the $4.54 that could not be recovered from a
crashed run. Six findings in this round are the same grievance, reintroduced in new places by the
feature built to end it. That is the theme the next round should be organised around.

---

## Blockers

None. Both panellists agree the four round-1 blockers are closed, and closed properly — the
`_started` `WeakMap` at `spike/src/engine.js:316`, the cache double-count at
`spike/bin/harness.js:176`, the `EEXIST` translation at `spike/src/engine.js:288`, and the branch
brought level with `main` at `c90d736`. Scenario B1's assertion that a snapshot actually caught a
`running` occurrence — rather than merely that no snapshot contains `_started` — is the detail that
makes that first fix provable, and it is a good test.

---

## Majors

### Merged — both panellists

**major 1 — `spike/bin/harness.js:515` (also filed at `:508-515`) · a ticket-filtered list names a
malformed sibling and exits 0.**
*claude major 5 + codex major 1.*

The filtered branch passes `warnings` into both `runsListJSON` (`:513`) and `printRunsListHuman`
(`:514`), then `return`s without touching `process.exitCode`. It reports the corruption and signals
success in the same breath. Confirmed against the contract: `contracts/Q-0011/runs-cli.contract.md`
carries both clauses the code's comment adjudicates between — line 12 (*"zero matches is an empty
list and exit zero"*) and lines 18–19 (*"A malformed sibling is named, valid siblings are still
rendered, and the final exit is non-zero"*). The case at issue is not zero matches, so the second
clause governs.

The deeper objection is claude's and it is the reason this leads the list: the comment at `:509-511`
resolves a frozen contract by argument. This repository has twice decided that a comment may not
outrank a contract, and has a mechanism for disagreeing with one — `solution/errata.md`, which
Q-0011 has already used three times. Either apply the unfiltered path's `warnings.length` handling,
or file an erratum. Add a filtered-list regression with a malformed sibling either way.

**major 2 — `spike/src/engine.js:773` → `:858`, and `spike/src/engine.js:203` · `output.txt` is not
guaranteed for an occurrence that allocated a directory.**
*claude major 11 + codex major 4.*

Two paths, one defect. On integrate: the occurrence is allocated at `:773` and `output.txt` is
written only at `:858`; between them sit `ticketWorktree`, the base-sync `mergeInto`, and the
`FlowError` throw at `:814`, so the most common integrate failure — a base conflict — leaves an
allocated directory with no output file at all. On the adapter-failure path, `:203` reads
`if (e.raw != null)`, making the on-disk shape depend on whether a given vendor attaches `raw` to
its error.

`run-history-writer.contract.md` says integrate occurrences *always* receive `output.txt`,
explicitly *"including … an empty file when the command produces no text"*, and AC-5 says the same
for adapter attempts. Seed the file at allocation, or write it from a `finally`. Codex additionally
asks for coverage of the base-sync conflict path specifically, not only install/test failures —
adopt that, since it is the path the existing tests miss.

### Codex only

**major 3 — `spike/bin/harness.js:493` · detail-path confinement is lexical, so a symlink reads
outside the runs root.**

`path.resolve` performs no link resolution and `fs.statSync` follows links, so a single-segment
symlink inside `.quorum/runs/` passes all three conditions at `:490-492` and its target's
`manifest.json` is read and, under `--json`, echoed to stdout. AC-13 requires the detail view to
read only files inside the selected run directory. Resolve with `realpath` and verify the result is
still beneath the real runs root, or reject symlinked run directories; cover it with a traversal
test. This narrows — it does not overturn — claude's assessment of the same block.

**major 4 — `spike/bin/harness.js:141` · a manifest is judged readable purely because it parses.**

`readRunsDir` warns only on parse failure or `ENOENT`. A structurally invalid but well-formed
document such as `{}` is pushed into `runs` and rendered as a valid run; incompatible field types
can make a formatter throw and take the valid siblings down with it. Validate the minimum structure
while loading each sibling — preferably against the run-manifest contract, which is already
executable — and turn both validation and rendering failures into per-run warnings.

### Claude only, verified on the branch

**major 5 — `spike/src/engine.js:65` · the AC-1 refusal logs a `start` line and never a terminal
one, and the comment above it claims the opposite.**

`backlog.log(… start …)` runs at `:68`, `initialiseRunHistory(ctx)` at `:69`, and the catch at
`:70-74` removes the signal handlers and rethrows — `finish()` is never called. So a refused run
leaves `runs.log` holding a run that started and then stopped existing, and `ticket.md`'s `history`
with no entry. The comment at `:51-53` states that the lines were moved *"so that a failure during
`initialiseRunHistory` still receives a terminal record"*, which the code does not do. Q-0011 adds
this fatal path, so it is the first thing an operator meets when the refusal fires. Call `finish()`
before rethrowing, or move the `start` line after initialisation and correct the comment to say
which was chosen; assert that the last `run=` line after a refusal is terminal.

**major 6 — `spike/src/engine.js:240` · billed usage is lost when post-adapter processing throws.**

Between the adapter's successful return and `terminalOccurrence(… 'completed', { usage })` at `:240`
sit the `writesOf` loop (`:220-223`), the verdict file write (`:225-227`) and `commitAll`
(`:228-235`), whose `git add` / `git diff --cached` / `git commit` are not wrapped in `safe()`. An
index lock, a pre-commit hook or a signing failure throws, the outer handler records the occurrence
as `failed` with `usage: null`, and a call the vendor billed vanishes from the roll-up. AC-11
requires the roll-up to reproduce from all occurrence usage. Attach `res` to the occurrence the
moment the adapter returns, before any write.

**major 7 — `spike/src/adapters/index.js:85` · the retry wrapper manufactures a usage object for an
adapter that reported none.**

`spent` initialises all-`null` at `:73`, `add` returns early on falsy usage at `:76`, and the
success return at `:85` unconditionally emits `usage: { vendor, …nulls }`. `rollup`
(`spike/src/engine.js:382`) then creates a vendor row with `step_count: 1, unpriced_steps: 1` for a
call that reported nothing, inflating the exact figure AC-12 requires the CLI to state out loud.
The error path at `:91-94` already guards with `measures.some(…)`; mirror it.

**major 8 — `spike/src/adapters/mock.js:35` · the mock violates the cache-subset clause of its own
frozen contract.**

`input_tokens` is computed as `prompt.length / 4 | 0` independently of the `cached` and `cacheWrite`
switches, so the AC-9 scenario emits `input_tokens: 2` beside `cached_input_tokens: 7` — cached
input three and a half times total input. Nothing catches it: the schema constrains each measure
independently and `checkRunManifestSemantics` never relates the cache fields to `input_tokens`.

The consequence is what makes this a major rather than a test-data nit. Round 1's blocker 2 turned
entirely on cache fields being subsets rather than summands, and because the mock cannot produce a
realistic subset relationship, the only end-to-end evidence for that rule is a hand-written literal
in `spike/test/q0034-review-fixes.js:96-108`. AC-14 exists to make the contract fail on a real
artifact rather than a fixture; on this invariant it is still a fixture. Clamp the switches into
`input_tokens`, or reject a profile whose cache fields exceed it with the same explicit failure the
other malformed switches already get.

**major 9 — `spike/src/adapters/mock.js:38` · `scope` splits on a directory this repository does not
use, so absolute paths reach persisted artifacts.**

`spike/src/git.js:11` writes worktrees to `.harness/worktrees`, while `mock.js:38` splits on
`${path.sep}.quorum${path.sep}worktrees${path.sep}`. The split never matches, so `scope` is the
whole absolute `cwd`; it flows into `key` at `:40`, into `output.summary` at `:54`, and from there
into `output.txt`, ticket artifacts and commit subjects as `/private/var/folders/…`. AC-2 prohibits
absolute paths in persisted artifacts, and this ticket's own non-goals name the `.harness/` versus
`.quorum/` drift and scope the rename out — so this code was written against a path the ticket had
already documented as not existing. The `kind` discriminator alongside it is sound; drop `scope`.

**major 10 — `spike/bin/harness.js:181` · `formatMoney` rounds real costs to `$0.00`.**

`toFixed(2)`, against `formatCost`'s `toFixed(3)` everywhere else. The tokens-only decision forbids
displaying an unpriced step as `$0.000`; `$0.00` is the same failure one digit earlier, and it makes
a $0.004 step indistinguishable from a vendor-reported zero — precisely the distinction
`checkRunManifestSemantics` goes to trouble to preserve.

**major 11 — `spike/src/engine.js:398` · `errorOf` re-implements auth and transient classification
and disagrees with the exported source of truth.**

`authError` (`spike/src/adapters/index.js:118`) and `transientError` (`:55`) are exported and live at
the contract layer by decision, so contributor adapters inherit them. The local `authErrorCategory`
matches a narrower set, so the *"model is not supported when using Codex with a ChatGPT account"*
sentence — Q-0001's headline finding, which `authError` special-cases — lands as
`category: "adapter"`; and `transientErrorCategory`'s `\b5\d\d\b` classifies any message containing
a number in 500–599 as transient. The retry wrapper and the manifest can classify one failure two
ways. Delegate to the exported helpers.

**major 12 — `spike/src/engine.js:289` · the collision refusal cannot detect the concurrency case its
own message names.**

The message says *"Another run may be in flight."* `nextRunId` allocates by scanning `runs.log` for
`\brun=(\d+)\b` and returning `max + 1`, and run A logs `run=N … start` at `:68` *before* creating
its directory — so run B, starting any time after that line lands, allocates `N+1` and collides with
nothing. The guard fires only in the sub-second window where both runs read `runs.log` before either
writes. Scenario B3 proves the refusal by pre-creating the directory by hand, a state the engine
cannot reach on its own.

A lock is out of scope and belongs with the M2 carry-over item. Two things are in scope: the message
must stop claiming a detection the mechanism does not provide, and the requirement's Open Question 3
— which answers *"AC-1 makes a collision loud, which is enough for a single-user local tool"* — must
record that the guard covers only a sub-second race, since as implemented that premise is false in
the common case. If cheap real detection is wanted, treating "a run directory exists at a higher
index than mine" as the signal is available.

**major 13 — `spike/bin/harness.js:480` · detail mode parses every sibling manifest before opening
the one requested.**

`readRunsDir(runsRoot)` is called unconditionally at `:480`, ahead of the token dispatch at `:482`.
AC-13 requires the detail view to read only files inside the selected run directory. Move the call
into the two list branches. Note this interacts with major 4: fixing that one makes the unconditional
call more expensive, not less.

**major 14 — `spike/src/engine.js:472` · the one-second timer in `runGate` keeps a fixture alive and
nothing else.**

On a TTY, `ui.gate` holds a `readline` interface that owns its own handle, so the timer adds nothing;
non-interactively with no `--gate-answer` left, the CLI throws before any await. Its only effect is
to keep the process alive for the fixture at `spike/test/q0011-run-history.js:216-224`, whose gate is
`() => new Promise(() => {})` — after which the loop drains and the child exits 0 with
`status: "running"`.

**Panel caveat, carried through honestly.** Claude marked this one unverified: it could not run the
suite and expects the assertion passes today, objecting to the engine arranging a race rather than to
a present failure. I confirmed the mechanism statically — the timer exists at `:472` and is cleared
in a `finally` — so the structural objection holds, but this is the weakest of the fourteen and the
only one where a documented decision to keep it, with the rationale written down, would be a
reasonable resolution instead of a code change. Deleting the timer and giving the fixture a gate
promise that owns a handle is the cheaper answer.

---

## Nits

All nine are claude's; codex raised none. They do not affect the verdict.

1. **`spike/src/engine.js:276`** — the stage guard is unreachable through the CLI. `runFlow` already
   refuses at `:38` unless the stage matches, and every CLI path loads the ticket from the same file
   the guard reads. It can only fire when a caller hand-mutates the ticket object, which is what the
   AC-1 scenario does. Now that B3 exercises the real refusal, this undeclared path can go.
2. **`spike/src/engine.js:360`** — every terminal occurrence re-serialises the whole manifest and
   `fsync`s it; cost is quadratic in occurrence count. Fine at fan-out scale; the 1000-step scenario
   makes the suite pay for roughly half a million occurrence-serialisations and 1000 `fsync`s on a
   path every `integrate` step runs. *(Unmeasured.)* Time it alongside Open Question 2.
3. **`spike/src/engine.js:356`** — a `manifest.json.tmp` survives a `SIGKILL` between write and
   rename. Harmless to `readRunsDir`, which filters to directories, but nothing names or cleans it.
4. **`docs/DECISIONS.md:207`** — the new entry is inserted mid-file rather than appended, against
   `docs-and-decisions.md`, and dated 2026-08-23 while the code landed 2026-08-24 via Q-0034.
   Chronological placement is a defensible reading; the date is not.
5. **`spike/bin/harness.js:233`** — the per-step `usage:` line reuses `formatVendorSummary` with a
   synthesised `unpriced_steps`, printing a roll-up field on a row that is not a roll-up and
   collapsing four measures into one total. The fix comment at `:168-175` says the cache fields stay
   "as a breakdown for anyone who wants the split", but only `--json` prints them. Print the fields.
6. **`spike/src/engine.js:397`** — `authErrorCategory(vendor, message)` never uses `vendor`. Drop the
   parameter, or delete the function as part of major 11.
7. **`spike/bin/harness.js:466`** — `readData(f)` re-reads and re-parses a file `validateFile` parsed
   one line earlier.
8. **`spike/bin/harness.js:463`** — the skip notice names run-manifest checks for every schema, so
   validating `contracts/Q-0006/ticket-review-state.schema.json` prints *"run-manifest semantic
   checks skipped"*. Contract-compliant, but confusing; phrase it generically.
9. **`spike/bin/harness.js:176`** — `vendorTokenTotal` returns `null` when `input_tokens` and
   `output_tokens` are both null but the cache fields are set, so the row prints `tokens=n/a` beside
   populated cache counts. Reachable only from a malformed manifest.

---

## What both panellists agree is right, and should survive the next round

Kept from claude's closing section, with codex's correction folded in.

The **occurrence side table** at `spike/src/engine.js:316` closes the class rather than the instance:
a `WeakMap` cannot leak into `JSON.stringify` at all, which deleting the field before the write could
not guarantee.

The **path confinement** at `spike/bin/harness.js:487-491` checks three independent things instead of
string-matching for `..`, and B4 tests five distinct escape tokens. It is the right shape; major 3
adds the link case it does not cover.

The **annotation-driven semantic pass** is genuinely good. `x-quorum-contract` decouples the check
from filename and `$id`, and recomputing the roll-up from occurrence usage is the only way to tell a
reported zero from a mutated null. It earned its DECISIONS entry.

---

## Suggested order of work

1. **major 1** and **major 5** — both are small, and both are places where a comment currently argues
   for behaviour the code does not have or the contract does not permit. If the contract is wrong,
   file an erratum; do not settle it in a comment.
2. **major 2**, **major 6**, **major 7** — the missing and fabricated records. These are the ticket's
   own founding grievance recurring inside the feature meant to end it.
3. **major 3**, **major 4** — the two CLI reader defects codex found. Fix them together: both live in
   the same load-and-render path.
4. **major 9**, **major 10**, **major 11** — self-contained corrections, each with the right answer
   already present in the codebase.
5. **major 8** and **major 12** — the two that change what the tests can prove. Major 8 lets B2's
   hand-written fixture be replaced by engine output; major 12 needs a message correction here and a
   re-answer of Open Question 3 in the requirement.
6. **major 13**, **major 14**, then the nits.

Round-3 fixes should continue landing their scenarios in a file development does not own, as round 2
did with `spike/test/q0034-review-fixes.js`. Both panellists endorsed that choice and it is the
correct reading of the ownership decision of 2026-08-23.
