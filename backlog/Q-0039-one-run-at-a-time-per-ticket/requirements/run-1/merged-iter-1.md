# Q-0039 — One run at a time per ticket

*Requirements, run 1, merged (iteration 1). Base: the claude candidate. Every measurement below was
re-run against the tree at 2026-09-09 before it entered this document; where a candidate's
measurement did not survive, the correction is stated and the candidate's sentence is named. See §10
for provenance.*

---

## 1. Problem

Nothing serialises runs. Two `quorum run` invocations against one ticket proceed in parallel and
collide on three resources the run owns exclusively without ever saying so. It has already cost
work: M1's closing entry records two runs overlapping in one night, one of which rolled back a
branch the other was holding.

The engine knows and says so in its own message. `packages/core/src/run-history/writer.ts:257`
reads *"This does not make the engine safe for concurrent runs, which is Q-0039 and still open."*
There is a guard on the **symptom** — a run directory outliving its log line — and none on the
cause. Re-verified 2026-09-09: a search for `lockfile`, `acquireLock`, `releaseLock`, `flock`,
`O_EXCL` and `'wx'` across `packages/core/src`, `packages/cli/src` and `packages/shared/src` returns
only pnpm lockfiles and test fixtures. **There is no lock of any kind.**

Today a collision needs two terminals and a person in a hurry. M3's server accepts a run over HTTP,
where it needs one impatient click.

---

## 2. What was measured

### M-1 — The three collisions differ by three orders of magnitude, and the ticket body's table hides that

| Resource | Site | How long the exposure lasts |
| --- | --- | --- |
| the run number | `nextRunId` (`run-history/writer.ts:188`), called at `engine/engine.ts:196` | **`:196` to `:293`**, the `runs.log` `start` line. Between them: `reviewRound(ticket.dir)`, `branchHead` (one git spawn), object construction. Tens of milliseconds. |
| the ticket branch | captured `engine.ts:252`, rolled back `lifecycle.ts:136–145` via `resetBranchTo` | **The whole run.** Run A's `finish` resets the branch to where **A** found it, whatever B has committed since. |
| the worktree | registered `steps.ts:206` and `composite.ts:62`, given back `lifecycle.ts:133` | **The whole run.** Since Q-0062 a finished run also *removes*, with `--force`, the directory a live run is writing in. |

A run's own `duration_ms` reaches 3,755,327 ms in this repository's history. `writer.ts:257` calling
the id case *"a sub-second race"* is accurate; the ticket body's table, which lists all three without
distinguishing them, is not. **This governs scope:** a fix aimed only at the id would close the
least important of the three.

### M-2 — `run()` has no `finally`, and the completed finish is deliberately outside the `try`

`engine.ts:186` is `async function run(...)`. The stage precondition throws at `:189`, **before**
`nextRunId` at `:196`. The `try` opens at `:291`, the `catch` at `:356`, and `:380`'s
`await finishRun(flow.produces, 'completed', null)` sits **outside both**, under a comment
(`:376–379`) explaining that moving it inside re-enters the catch and finishes the run twice.

Release is therefore not a line but an outer `try/finally` spanning acquisition to the end of the
function, over **six** exits: `regressed` (`:342`), `aborted` (`:351`), `undecided` (`:365`), the
failed/interrupted rethrow (`:373`), the completed fallthrough (`:380`), and any throw between
acquisition and `:291`. A `finally` with no `catch` does not re-enter the catch, so the outer wrap is
compatible with `:380` staying where it is — which the implementer must not "tidy".

### M-3 — `--dry` is answered by measurement, not by taste

`readOnlyBacklog` (`engine.ts:42–48`) replaces `write`, `writeFile` and `log` with no-ops;
`initialiseRunHistory` is skipped entirely (`engine.ts:294`, `if (!dry)`); and `finish` guards both
the worktree return and the branch rollback with `if (!context.dry)` (`lifecycle.ts:132`). A dry run
touches **none** of M-1's three resources.

### M-4 — Correction: the exclusion is `.git/info/exclude`, not `.gitignore` — and the idiom to copy already ships

The claude candidate's M-4 reasons from `quorum init` writing no `.gitignore`. That is true and
beside the point. `ensureExcluded` (`git/git.ts:449`) appends a pattern to the repository's
`info/exclude`, which is per-clone, untracked, and works in an adopter's repository with no
`.gitignore` at all. So the hazard is not "adopters have no ignore rule"; it is narrower and real:
`ensureExcluded(repoDir, '.quorum/')` is called at exactly one production site,
`run-history/writer.ts:397`, **inside `initialiseRunHistory`** — which a lock taken before
`nextRunId` necessarily precedes. On a first-ever run the lock file would exist untracked and
unignored, which *"Membership is a git question, not a filesystem one"* (2026-08-28) makes exactly
the set turbo hashes into every task input.

**The shipped idiom to copy is `ensureWorktree` (`git/git.ts:130–138`)**, which calls
`ensureExcluded(repoDir, EXCLUDE_PATTERN)` immediately before creating the worktree root. This makes
AC-4 one line rather than a design.

### M-5 — `Backlog.read` does not validate, so `ticket.meta.id` is an unvalidated string

`backlog.ts` parses frontmatter and returns; it never calls `ticketSchema.parse`. That is Q-0043
AC-4's deliberate design and what let Q-0112 measure a shipped ticket carrying `owner: true`. A lock
path built from `ticket.meta.id` is built from an unvalidated string — the Q-0059 class arriving at
a new site. `isOneName` (`backlog/confine.ts:104`) is the shipped predicate for exactly this
question, decided on the string alone and touching no filesystem, and `backlog.ts:140` already calls
it for a ticket token.

**Registered and not this ticket's:** `runIdOf` already builds `.quorum/runs/<id>-N` from the same
unvalidated value. That exposure predates this ticket and is not widened by it.

### M-6 — Correction: the single-writer guard constrains the *literal*, not the *module*

`run-history/run-history.source.test.ts:259` asserts that `.quorum` appears as a quoted literal in
exactly one core file, and `:320` requires `QUOTED_ROOT.test(text) || text.includes('RUN_HISTORY_ROOT')`
to be true for `writer.ts` and **false for every other core file**.

The claude candidate reads this as forcing the lock into `writer.ts`. It does not.
`RUN_HISTORY_ROOT = '.quorum/runs'` already lives in `packages/shared/src/constants.ts:46`, so a
sibling `LOCK_ROOT` in shared lets a new core module hold the lock and pass **both** clauses, naming
neither the literal nor that constant.

**So placement is a choice, and it is ruled here rather than left to an implementer to litigate in a
review round: the lock lives in `packages/core/src/run-history/writer.ts`.** Not because the guard
forces it, but because Q-0049's stated rule is that `writer.ts` is the single owner of writes under
`.quorum/`, the atomic-create idiom and the `ensureExcluded` call this ticket reuses are both already
in that file, and `reader.ts` must go on not importing it. A reviewer meeting a lock inside
"run history" will find this paragraph as its authority (R-5).

### M-7 — The atomic-create idiom already ships here, and the git-ref alternative is refused

`writer.ts:252` is `fs.mkdirSync(runDir, { recursive: false })`, whose comment says the ordering is
the contract: the directory is created **non**-recursively *"so that a collision is detected rather
than joined"*. One exclusive syscall, no git.

The ticket body's second option — a git ref — is refused on three grounds: it would make `core` a
fourth ref-writing site against the discipline of *"A run removes the worktrees it made, and never
the refs"* (2026-08-31); it is invisible to a human with `ls`; and *"Files are the database"*
already answers the question. Codex's link-plus-temp-file dance is also refused: it buys atomicity
on network filesystems, which non-goal 11 puts outside this product's claim, at the cost of a
recovery path for orphaned temp files that would become its own defect.

### M-8 — Correction: no new error class, no new `fail.ts` function, no exit-code change

Both candidates invent a surface here. Claude proposes a `RunLockedError` on the barrel plus a
`dieRunLocked` in `fail.ts`; codex specifies a `FlowError` rendered "through its existing single-line
failure path". Measured, codex is right and claude is over-built: `run.ts:215` is
`if (error instanceof FlowError || error instanceof IntegrationError) die(error.message);` — a
`FlowError` thrown from `run()` before any event is already rendered unaltered and already exits 1.

The precedent is in the same function: the stage-mismatch precondition at `engine.ts:189` is a bare
`FlowError` and needs nothing. A lock refusal is the same kind of precondition and gets the same
treatment. Q-0111's decision (*"A `core` error names the condition; the remedy belongs to the
surface"*, 2026-09-07) is honoured by the message carrying **no imperative at all** — which is
cheaper than composing one on a surface, and correct, because there is no single remedy: waiting,
inspecting the holder and deleting a lock after a crash are three different human decisions.

### M-9 — The two vocabulary lists are a curated subset, and two tickets one day apart disagreed

`docs/GLOSSARY.md` carries 35 headings; `CLAUDE.md:13` and `docs/README.md` each carry 22 of them.
`packages/shared/src/docs.test.ts` compares those two lists **with each other**, ordered, anchored on
`harness` and `push lag` and floored at more than 15 — and never against the glossary's own headings.
So the lists are not "every term".

The precedent split within twenty-four hours. **Q-0067 (2026-09-08)** added `verified version` to
both lists and had to commit it to the ticket branch rather than to `main`, because the ordered
comparison would otherwise leave `main` red until the merge. **Q-0059 (2026-09-08)** added
`Confinement` to the glossary and to **neither** list.

**Ruled here, in the body, so no implement step chooses it: the glossary only, following Q-0059.**
Q-0059 is the nearer precedent in kind — a `core` safety guarantee whose term names a property of
the engine, not a word an agent must use when writing a flow or a ticket. This deletes the
branch-sequencing obligation entirely and is why no gate obligation about term ordering appears in
§7.

---

## 3. User stories

**`maintainer` — the collision.** As the solo maintainer, when I start a second run against a ticket
that is already running — from a second terminal, or because I forgot the first — I want the second
to refuse and name what is holding it, rather than the two sharing a run number, a branch and a
worktree until one rolls the other back.

**`maintainer` — the crash.** As the solo maintainer, when a run dies in a way that leaves a lock
behind, I want the next run to tell me exactly which file is in the way and what it says, in one
sentence, rather than guessing on my behalf that the holder is dead.

**`adopter` — the untouched happy path.** As a cold-clone adopter running one ticket at a time, I
want to notice nothing: one file created and removed per run, no prompt, no flag, nothing new in
`git status`.

**`contributor` — the guarantee is stated once.** As a contributor reading `docs/04-architecture.md`,
I want the serialisation to be `core`'s and not the CLI's, so that when M3's server starts runs over
HTTP it inherits the same refusal instead of writing a weaker one — the arrangement Q-0059 chose for
confinement and principle 6 already claims for worktrees and the human-locked gate.

---

## 4. Acceptance criteria

Surface: `packages/core` for AC-1 to AC-10 and AC-12, with the path constant in `packages/shared`;
`packages/cli` for AC-11's fixture; `docs/` for AC-13. Each criterion is independently testable, and
each *Test:* clause **bounds the instrument it asks for** — a reviewer may find that the instrument
fails the job stated here, and may not raise that job (Q-0067 E-1).

**AC-1 — The lock is `core`'s, and it is taken at one point inside `run()`.**
Acquisition happens after the stage precondition (`engine.ts:189`, a pure read of the in-memory
ticket, so a run refused on its stage touches the repository not at all) and **before** `nextRunId`
(`:196`). One acquisition closes all three of M-1's collisions; acquiring later closes only some.
Because `run()` is called lazily from `runFlow`'s `start()`, a caller that builds the iterable and
never pulls takes no lock — stated rather than left to be discovered.
*Test:* a fake at the acquisition seam records call order — a stage mismatch acquires nothing; a
proceeding run acquires before `runs.log` is read. Shown red by moving acquisition below `:196`.

**AC-2 — The lock is one file, created by one exclusive syscall, and its subject is the ticket.**
`<LOCK_ROOT>/<ticket-id>.json`, created with an exclusive create (`fs.openSync(…, 'wx')`, or a
non-recursive `mkdirSync` on the writer's own idiom) — never a read-then-write, which is the race it
exists to close. The path constant is declared in `packages/shared/src/constants.ts` beside
`RUN_HISTORY_ROOT`; the code lives in `packages/core/src/run-history/writer.ts` for M-6's reason.
Two tickets never block one another, whatever flow each is running.
*Test:* two acquisitions in one process against one ticket — the second refuses, the file exists
between them, is gone after release; two acquisitions against **different** tickets both succeed.
Plus a source assertion that the create flag is exclusive, shown red by mutating it to `'w'` or
`{ recursive: true }`.

**AC-3 — The ticket id is proven to be one path segment before it names a file.**
`isOneName` (`backlog/confine.ts:104`) is reused rather than re-spelled; M-5 is why the check exists
at all. A ticket whose `id` does not pass refuses, and no file is created anywhere.
*Test:* a ticket record whose `meta.id` is `../../escape` refuses, naming the id; the filesystem is
byte-identical afterwards. The pre-existing `runIdOf` exposure is registered in a comment citing this
criterion and is not touched.

**AC-4 — `.quorum/` is excluded before the lock file exists.**
The lock calls `ensureExcluded(repoDir, '.quorum/')` immediately before creating its file, which is
`ensureWorktree`'s own idiom (`git/git.ts:130–138`) applied to the second thing `core` writes under
that root. Ordering, not merely presence — M-4.
*Test:* in a fresh repository whose `info/exclude` names nothing, after acquisition
`git status --porcelain` reports nothing outside the product roots and the exclude line is present.
Shown red by acquiring before the exclusion call.

**AC-5 — Release is a `finally`, it covers all six exits, and it removes only this run's lock.**
M-2's six exits: regressed, aborted, undecided, the failed/interrupted rethrow, the completed
fallthrough, and a throw between acquisition and `:291`. `:380` stays outside any `catch` and
`:376–379`'s comment survives verbatim. Release is **ownership-checked**: the run unlinks the file
only if it still carries this run's own recorded token, so a lock a human cleared and a successor
re-took is not deleted by the first run's `finally`. A release that fails **warns and does not
rewrite the run's outcome** — a completed run keeps `completed`, its history entry and its exit
code, and the failure is surfaced rather than reported as a successful release.
*Test:* a table with one row per terminal status plus one for a pre-`try` throw, each asserting the
file is gone; one row where the file was replaced under the run, asserting the replacement survives;
one row where unlink throws, asserting the terminal status and exit code are unchanged and a warning
is emitted. Shown red by deleting the `finally`, which must fail more than one row.

**AC-6 — A second run refuses, names the holder, and changes nothing.**
The refusal carries the ticket, the holder's run number, its flow, its pid, its hostname and its
start time — the facts AC-10's file holds and no others. It fires before `nextRunId`, so **no run
number is consumed**: no `start` line reaches `runs.log`, no run directory is created, no worktree is
obtained, no adapter or script is invoked, no stage or iteration counter moves, no ticket history
entry is added, and `ticket.md` is not written. After the holder releases, the next run receives the
id `nextRunId` would have given it — a refused contender introduces no gap.
*Test:* acquire out of band, then run; assert each named fact appears; assert `runs.log`,
`.quorum/runs/`, `.harness/worktrees/` and `ticket.md` are byte-identical before and after; assert
the next successful run's id is unchanged by the refusal.

**AC-7 — The refusal is a `FlowError` stating the condition, and the CLI is not touched.**
M-8: `run.ts:215` already renders a `FlowError` unaltered through `die` and exits **1**. No new error
class reaches the barrel, no function is added to `packages/cli/src/fail.ts`, and `ExitCode` gains no
sixth member — a refused run is not `ABORTED` (2, a human chose to stop *this* run) and not
`UNDECIDED` (3, nobody was there *at a gate*); it is an unmet precondition, like the stage mismatch
in the same function. The message carries **no imperative**, per *"A `core` error names the condition;
the remedy belongs to the surface"* (2026-09-07) — and here the surface offers none, because waiting,
inspecting and deleting are three different human decisions.
*Test:* through the built binary, a refused second run exits 1 and prints one line; a source
assertion that the message contains no backticked shell imperative; `exit.ts`'s union asserted by
identity so a sixth member fails. **Registered and not fixed:** `writer.ts:259` carries *"Move or
delete that directory to re-use the id."* inside `core`, predating that decision — named in a comment
and left alone.

**AC-8 — `--dry` neither takes a lock nor is refused by one.**
M-3 is the authority: a dry run touches none of the three resources, and a maintainer must be able to
inspect a flow while a run holds the ticket.
*Test:* a dry run creates no lock file; a dry run succeeds while a lock is held, and its output is
identical to the unlocked case.

**AC-9 — A lock whose holder is gone still refuses, and is never reclaimed automatically.**
*(Void and replaced if OQ-2 is ruled the other way — see §6.)* The only way a lock outlives its run is
a process that never reached its `finally`: `SIGKILL`, or power loss. A recorded pid cannot
distinguish *that process is gone* from *that pid belongs to something else now*, and reporting an
unanswerable question as an answerable one is what the containment, push-lag and verified-version
discipline forbids — most recently *"The board reports push lag, and never a CI conclusion"*
(2026-09-06). The pid is **reported and never branched on**, which is the verified-version shape.
*Test:* a lock naming a pid that cannot be running still refuses, with AC-6's message shape; a source
assertion that no code path unlinks a lock file it did not create.

**AC-10 — The lock file's fields are declared, and a damaged one refuses rather than defaults.**
Fields: schema version, ticket id, run number, flow name, pid, hostname, `started_at`, and the
ownership token AC-5 compares. An unparseable or incomplete file refuses with its own message naming
the path. It never reads as *no lock*, and never as *my lock*. *"Errors are explicit… Never default
silently."*
*Test:* a file holding `{` and one holding `{}` each refuse and each name the path; neither is
overwritten or removed.

**AC-11 — The proof crosses a real process boundary, and is deterministic.**
The guarantee is cross-process, so an in-process pair of `runFlow` calls cannot establish it.
`packages/cli/src/end-to-end.test.ts` already spawns the built binary
(`spawnSync(process.execPath, [bin, …])`), which is where this belongs. The **first** holder is a
lock file the fixture wrote; the **second** is a real process. A genuine two-process race is
**refused**, stated in the criterion rather than left to a reviewer: it would be a new instance of
Q-0102's subject, a suite that is red under load, and this repository has one parked ticket on
exactly that.
*Test:* the fixture writes a lock, spawns `quorum run <flow> <ticket>`, and asserts exit 1 and the
holder's facts in the output. Shown red against a binary built without the guard.

**AC-12 — The Q-0049 single-writer guards pass unchanged.**
`run-history.source.test.ts:259` and `:320` are not edited, weakened or exempted; `reader.ts` gains
no write verb and does not import `./writer.js`.
*Test:* both tests pass with no diff to that file; a mutation putting the lock's literal in a second
core module fails `:320` by name.

**AC-13 — The vocabulary and the numbered docs move with it.**
`docs/GLOSSARY.md` gains **Run lock**, defined by what it is and by what it is **not**: not
**Containment** (a git ancestry fact about two refs), not **Confinement** (whether a path is inside a
declared root), not a **gate** (a human checkpoint inside a run), and **advisory** — it serialises
this product's runs and nothing else (non-goal 11). Per M-9 it joins the glossary **only**, not the
two vocabulary lists. `04-architecture.md` principle 6 gains one sentence beside its worktree and
confinement sentences, and its run-history section names the second thing `core` writes under
`.quorum/`.
*Test:* the glossary heading exists and its "not" clauses are asserted by phrase, as `docs.test.ts`
already does for push lag and verified version. **Stated rather than dressed up:** no automated check
covers the two prose sentences in `04-architecture.md`; they are verified by reading.

---

## 5. Non-goals

1. **Waiting or queueing.** A second run does not block, poll, retry or queue.
2. **Reclaiming a stale lock automatically** (AC-9, subject to OQ-2).
3. **A `--force` flag to break a lock.** Deliberately absent: it is the escape hatch that becomes the
   habit, and the file is one `rm` away. Its own ticket if a real need appears.
4. **A lock-inspection or lock-clearing command.** Codex's OQ-1; its own ticket.
5. **A repository-wide or branch-wide lock.** The subject is the ticket — all three collisions are
   keyed by it, and fan-out task branches derive from the ticket branch and are already inside it.
6. **Rendering a held lock on `quorum board` or `quorum runs`.** Its own ticket.
7. **Fixing `runIdOf`'s unvalidated id** (M-5, registered by AC-3).
8. **Fixing `writer.ts:259`'s in-`core` imperative** (registered by AC-7).
9. **`harness worktrees`** — Q-0062's successor, which removes what *earlier* runs left. A lock stops
   a live collision and cleans up nothing.
10. **A lint rule for a flow declaring an escaping path** — Q-0113, opened at Q-0059's gate.
11. **Guarantees across machines, clones, or on a network filesystem.** `open(…, 'wx')` atomicity is
    a local-filesystem property; the refusal is advisory within this product and stops neither `git`,
    another tool, nor a second checkout. Said in the glossary entry.
12. **Any change to Q-0040's terminal statuses or to gate behaviour.** A lock is refused before a run
    exists, so no status, rollback rule or gate answer moves.
13. **Windows.** Registered by Q-0098 as already true of the build; unchanged here.

---

## 6. Open questions

**OQ-1 (blocker; owner: human, at the requirements gate) — is a decision entry owed before code?**
Recommendation: **yes, one entry.** This introduces a second kind of durable file under `.quorum/`
and a new circumstance in which `quorum run` refuses to run at all — product policy rather than a
repair, which is the judgement Q-0112 got wrong by deciding an entry was unnecessary. The precedent
that costs money is Q-0062, whose GO-1 said the entry must exist *before* the implement step and
whose run was launched without it, spending three rounds on a blocker no step on the route could
clear. `developer-generalist` may not write one, so this cannot be deferred into the chore run.
**Codex's AC-21 states the entry as an acceptance criterion**; that is struck, because a criterion
naming a surface its own flow cannot write is *"A requirement may not name a surface its flow cannot
write"* (2026-08-25) and would be the sixteenth appearance of a loop handed work no agent in it can
perform.

**OQ-2 (blocker; owner: human, at the requirements gate) — refuse a stale lock, or probe and reclaim?**
The candidates disagree flatly, and **the answer decides whether this is one ticket or two.**
Recommendation: **refuse** (AC-9), which is the thirteen-criterion cut written above.
Under **reclaim**, codex's design is the right one and it is a different ticket: an OS liveness probe
with a closed set of answers including *could not tell*, a hostname test that never reclaims a
foreign-host lock, an ownership token whose whole purpose is safe release across a reclaim, and a
race-to-reclaim proof — which is a two-contender race, the shape AC-11 refuses on Q-0102's grounds.
That is five to six further criteria and pushes past the fifteen ceiling.
**If the gate rules for reclaiming, the seam is: Q-0039 keeps AC-1 to AC-8 and AC-10 to AC-13 (the
lock, the refusal, the release), and a successor takes liveness detection and recovery — in that
order, because recovery has no subject until a lock exists.** The successor's body is then written at
this gate rather than left in a closing entry (Q-0059's GO-2 precedent, against the two obligations
found orphaned this week).

**OQ-3 (non-blocking) — does the refusal record a pid at all, given that recording one invites the
probe AC-9 refuses to make?** Recommendation: **record it, branch on nothing.** A pid is a fact that
helps a human decide, and *"a past measurement, and never a policy"* is the shape `verified version`
already has for this exact tension.

**OQ-4 (non-blocking) — priority.** The frontmatter says `p2`; the plan's own argument is that this
is now due rather than approaching, M2's substantive work being done and M3 next. Nothing checks a
plan bullet against a ticket's frontmatter — the drift Q-0101 recorded for Q-0102. Settle or leave,
but do not let the two go on disagreeing silently.

**OQ-5 — ruled, not open.** Whether **Run lock** joins the two vocabulary lists: **no, glossary
only**, following Q-0059 rather than Q-0067, for M-9's reason. Written into the body so no implement
step chooses it, and it removes the branch-sequencing obligation Q-0067 needed.

**OQ-6 — ruled, not open.** No zod schema in `packages/shared` for the lock file: it is read only by
the code that wrote it, and a schema buys a second description of eight fields. AC-10's narrow parse
and its refusal are the contract. Recorded so a reviewer meets a decision rather than an omission.

---

## 7. Gate obligations

- **GO-1.** OQ-1 and OQ-2 are settled at the gate, and if an entry is owed it **lands before the
  chore run starts**, not during it — *"An erratum is the last repair, not the first"* (2026-08-30)
  and Q-0094 E-3's window rule: the window for a ruling is a gate.
- **GO-2.** If OQ-2 rules for reclaiming, the successor's body is written **at this gate**, in full,
  before either ticket runs.
- **GO-3.** The merge is verified forced in **both** environment rows (Q-0072's closing finding) — in
  the integrate worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on
  `main` after the merge, where both exist. AC-4's ordering is exactly the defect that is invisible
  in one row.
- **GO-4.** CI is green on the merged commit before the ticket is called done. Q-0105's GO-3 is why
  this is written down: every local signal was green and CI was red on all three jobs.

---

## 8. Risks

**R-1 — the outer `try/finally` lands in the function Q-0050 spent six review rounds on.**
`:376–379`'s comment is load-bearing and a mechanical wrap could void it. Mitigation: AC-5 has a row
per exit and asserts the comment survives.

**R-2 — every test that runs a flow now takes a lock.** `runFlow` has few direct call sites, but
`end-to-end.test.ts` and `failure-paths.test.ts` spawn the binary many times against tickets in a
temp repository. A lock leaked by a crashing fixture turns a later, unrelated test red for the wrong
reason. Mitigation: AC-5's `finally`; AC-11's fixture writes the holding lock rather than racing.

**R-3 — Q-0102's subject.** A test spawning two concurrent binaries is precisely the shape that
ticket is parked on. AC-11 forbids it, with the reason inside the criterion rather than left to a
reviewer.

**R-4 — the exclusion ordering is invisible in this repository**, whose own `info/exclude` and
`.gitignore` already cover `.quorum/`. AC-4's fixture must build a repository that excludes nothing.

**R-5 — the `writer.ts` home will look wrong to a reviewer** who reads "run history" and sees a lock.
M-6 is the answer, and it says the guard permits a second module and that the placement was chosen
anyway. If a later ticket splits the folder, the split is a `run-state/` module and the guard moves
with it.

**R-6 — the refusal is advisory.** It serialises this product's runs and nothing else. A second
checkout, a stray `git worktree remove`, or an editor writing into the worktree is outside it. Stated
in the glossary entry so the guarantee is never read as wider than it is.

**R-7 — a release failure could rewrite a good run's audit record.** Codex's AC-14 is the mitigation
and it is folded into AC-5: the terminal status, history entry and exit code a run earned are
authoritative, and a failed unlink is a warning.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No code path here reads an environment variable, a credential or a subscription. |
| **Worktree safety** | **Central.** The lock is what stops one run's `finish` removing, with `--force`, the worktree another run is writing in — the exposure Q-0062 widened deliberately and routed here (its RK-1). No worktree is created, removed or renamed by this change. |
| **Gate behaviour** | Unchanged. The refusal fires before any step runs, so no gate is reached, no gate answer changes, and `--auto` is not consulted. |
| **File format and schema** | One new file under the lock root, fields declared by AC-10, path constant in `packages/shared/src/constants.ts`. No zod schema (OQ-6). No existing format moves. |
| **Lint rules** | None added. The flow linter is untouched; the neighbouring lint question is Q-0113's. |
| **Exit codes** | 1, from the existing closed union, through the existing `run.ts:215` path (AC-7). |
| **Cold-clone impact** | One file created and removed per run, no prompt and no flag. The happy path gains nothing a stranger sees; the refusal appears only where two runs collide. |
| **Product-agnostic** | n/a — nothing here names any product. |
| **Docs** | `docs/GLOSSARY.md` (one term, glossary only) and `docs/04-architecture.md` (principle 6, run-history section). `docs/02-sdlc-pipeline-spec.md` is untouched: it describes flows and steps, and a lock is neither. |

---

## 10. Provenance

**The claude candidate is the base.** It is right-sized, every criterion carries a bounded *Test:*
clause, and three of its measurements do the load-bearing work: the acquisition point (M-1/AC-1),
which closes all three collisions at one seam; the six exits of `run()` and the reason `:380` sits
outside the `try` (M-2/AC-5); and the demonstration that `--dry` touches none of the three resources
(M-3/AC-8), which settles the ticket body's open question 5 by measurement instead of taste. Its
non-goals, its refusal of the git-ref option, and its Q-0102 constraint on the cross-process proof
are all carried unchanged.

**Three of its measurements did not survive re-running and are corrected in place.** M-4 reasons from
`.gitignore` when the mechanism is `.git/info/exclude`, and misses that `ensureWorktree` is the
shipped idiom to copy — the criterion survives, its rationale does not. M-6 reads the Q-0049 guard as
forcing the code into `writer.ts` when the guard constrains a *literal* and `RUN_HISTORY_ROOT`
already lives in shared — so the placement is ruled here on Q-0049's stated rule rather than claimed
as a constraint. And its AC-7 invents a `RunLockedError` and a `dieRunLocked` that `run.ts:215` makes
unnecessary; that is scope removed.

**Two things came from the codex candidate and both are real gaps in claude's.** Ownership-checked
release, which closes a hole reachable even under the refuse-only design — a human clearing a lock
mid-run and starting a successor would otherwise have the first run's `finally` delete the second's
lock (its AC-12, folded into AC-5). And the rule that a failed release warns without rewriting a
completed run's audit record (its AC-14, folded into AC-5 and R-7). Its explicit
different-tickets-do-not-block criterion (AC-2) and its no-gap-in-run-ids criterion (AC-8) are folded
into AC-2 and AC-6.

**What was struck from the codex candidate, and why.** Its 22 criteria are over the ceiling before
counting AC-18, which is eleven separate tests in one criterion and AC-19 and AC-22, which are seven
more — that is not a requirement a bounded revise loop can close. Its AC-21 makes a DECISIONS entry an
acceptance criterion, which no step on the chore route may satisfy; it is routed to OQ-1 and GO-1
instead. Its AC-5 temp-file-and-link claim protocol buys network-filesystem atomicity that non-goal
11 puts outside this product's claim, and brings an orphaned-temp-file recovery path with it. Its
AC-17 requires two coordinated operating-system processes, which AC-11 refuses on Q-0102's grounds.
Its stale-recovery block (AC-9, AC-11) is not struck but **routed to OQ-2**, because it is a design
this document cannot adopt by averaging. Its answer of *"No blocking product questions remain"* is
the one judgement rejected outright: it specifies stale recovery without noticing that doing so
changes the ticket's size class, and it asserts the decision entry rather than routing it to the
only party who may write one. One vocabulary defect is noted rather than carried: it calls the
product **the Studio**, which `docs/GLOSSARY.md` records as pre-2026-08-22 usage and *"not current
vocabulary"*.

**Added by this merge, from the tree.** M-8 (no new error class, measured at `run.ts:215`), M-9 and
the OQ-5 ruling (the vocabulary lists are a 22-of-35 curated subset, and the two same-day precedents
disagree — ruled to Q-0059's, which removes an entire gate obligation), the AC-4 idiom, the AC-12
guard identity, and the conditional split seam in OQ-2.

**Size.** Thirteen criteria under the recommended ruling on OQ-2, which is inside the ten-to-fifteen
band. Under the alternative ruling it is nineteen or twenty and must be cut; the seam and the order
are stated in OQ-2 rather than left for a later gate to discover.
