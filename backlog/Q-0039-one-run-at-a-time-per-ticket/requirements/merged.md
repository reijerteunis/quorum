# Q-0039 — One run at a time per ticket

*Requirements, run 1, merged (iteration 2). Base: the claude candidate, as merged at iteration 1.
Every measurement was re-run against the tree at 2026-09-09 before it entered this document; where
iteration 1's own text did not survive re-running, the correction is stated and the sentence is
named. See §11 for provenance.*

**Iteration 2 opened on an unchanged tree.** `docs/decisions/` still ends at 085, the ticket body
carries no ruling, and no commit since `24a1445` touches this ticket. That is the fourth recorded
instance of *"a retry on an unchanged tree cannot rule its own blocker"* (Q-0090, Q-0096, Q-0105),
and Q-0105's remedy is applied rather than the pattern repeated: **both of iteration 1's blockers are
ruled here** — one downgraded to a gate obligation, one decided — and the second pass spent itself on
re-measurement, which found two contradictions inside the iteration-1 document that no earlier
account had (M-5, M-2).

---

## 1. Problem

Nothing serialises runs. Two `quorum run` invocations against one ticket proceed in parallel and
collide on three resources the run owns exclusively without ever saying so. It has already cost work:
M1's closing entry records two runs overlapping in one night, one of which rolled back a branch the
other was holding.

The engine knows and says so in its own message. `packages/core/src/run-history/writer.ts:257` reads
*"This does not make the engine safe for concurrent runs, which is Q-0039 and still open."* There is
a guard on the **symptom** — a run directory outliving its log line — and none on the cause.
Re-verified 2026-09-09: a search for `lockfile`, `acquireLock`, `releaseLock`, `flock`, `O_EXCL` and
`'wx'` across `packages/core/src`, `packages/cli/src` and `packages/shared/src` returns only pnpm
lockfiles and test fixtures. **There is no lock of any kind.**

Today a collision needs two terminals and a person in a hurry. M3's server accepts a run over HTTP,
where it needs one impatient click.

---

## 2. What was measured

### M-1 — The three collisions differ by three orders of magnitude, and the ticket body's table hides it

| Resource | Site | How long the exposure lasts |
| --- | --- | --- |
| the run number | `nextRunId` (`run-history/writer.ts:188`), called at `engine/engine.ts:196` | **`:196` to `:293`**, the `runs.log` `start` line. Between them: `reviewRound`, `branchHead` (one git spawn), object construction. Tens of milliseconds. |
| the ticket branch | captured `engine.ts:252`, rolled back `lifecycle.ts:136–145` via `resetBranchTo` | **The whole run.** Run A's `finish` resets the branch to where **A** found it, whatever B has committed since. |
| the worktree | registered `steps.ts:206` and `composite.ts:62`, given back `lifecycle.ts:133` | **The whole run.** Since Q-0062 a finished run also *removes*, with `--force`, the directory a live run is writing in. |

A run's own `duration_ms` reaches 3,755,327 ms in this repository's history. `writer.ts:257` calling
the id case *"a sub-second race"* is accurate; the ticket body's table, which lists all three without
distinguishing them, is not. **This governs scope:** a fix aimed only at the id would close the least
important of the three.

### M-2 — Correction: `nextRunId` consumes nothing, so iteration 1's placement rationale was wrong

`nextRunId` (`writer.ts:188–200`) reduces the ticket's `history` entries and scans `runs.log` for
`run=(\d+)`, returning `max + 1`. **It is a pure read: it writes nothing and reserves nothing.**
Iteration 1's AC-1 justified acquiring before `:196` on the ground that otherwise *"a run number is
consumed"*. Nothing is consumed by reading, so that reason does not hold, and an implementer
re-deriving against it would take away the wrong invariant — *"a diagnosis that gets the cause wrong
is worse than none, because the next reader re-derives against it"*.

The real constraint is narrower and is now testable: **the run number the lock advertises must be
the number the run uses.** Whether the id is read before the claim (and the claim decides which
contender proceeds) or after it (read under the lock) is a solution-level choice, and both satisfy
the invariant, because a refused contender writes nothing and its id is never used. The conclusion of
AC-1 survives — acquire early — but for the correct reason: the branch head, the run number and the
worktree must each be facts about a run that is already the only one.

### M-3 — `run()` has no `finally`, and the completed finish is deliberately outside the `try`

`engine.ts:186` is `async function run(...)`. The stage precondition throws at **`:190`** (not `:189`
as iteration 1 said), before `nextRunId` at `:196`. The `try` opens at `:291`, the `catch` at `:356`,
and `:380`'s `await finishRun(flow.produces, 'completed', null)` sits **outside both**, under a
comment (`:376–379`) explaining that moving it inside re-enters the catch and finishes the run twice.

Release is therefore not a line but an outer `try/finally` spanning acquisition to the end of the
function, over **six** exits: `regressed` (`:342`), `aborted` (`:350–351`), `undecided` (`:365–366`),
the failed/interrupted rethrow (`:373–374`), the completed fallthrough (`:380`), and any throw
between acquisition and `:291`. A `finally` with no `catch` does not re-enter the catch, so the outer
wrap is compatible with `:380` staying where it is — which the implementer must not "tidy".

### M-4 — Measured: SIGINT and SIGTERM are **not** ways a lock leaks, and this is what makes AC-9 proportionate

`run.ts:179–182` registers `onSigint`/`onSigterm` that call `cancellation.abort('received SIGINT')`
— they **abort an `AbortController`, they do not `process.exit`** — and the module header says why:
*"`core` installs none (Q-0050 AC-5) … the run ends `interrupted` through `core`'s own path so the
terminal record and the run history survive."* The handlers are removed in a `finally` at `:198–201`,
and every `process.exit` on this path (`:203`, `:208`) fires **after** `consumeRun` has resolved,
which is after `run()` has returned.

So an interrupted run reaches its `finally` like any other, and the set of ways a lock can outlive
its run is exactly: **SIGKILL, a hard crash, or power loss.** Iteration 1 asserted this; it is now
measured, and it is the premise the OQ-2 ruling rests on.

### M-5 — Correction: AC-4 and AC-12 of iteration 1 could not both be satisfied

`run-history/run-history.source.test.ts:259` collects every match of
`QUOTED_ROOT = /['"][^'"\n\s]*\.quorum/` across `moduleSources()` — the core sources under
`run-history/` — and asserts

```js
expect(quoted).toStrictEqual([`${WRITER_SOURCE}: '.quorum`]);
expect(sourceOf(WRITER_SOURCE)).toContain("ensureExcluded(repoDir, '.quorum/')");
```

and `:320` requires `QUOTED_ROOT.test(text) || text.includes('RUN_HISTORY_ROOT')` to be **false for
every core file except `writer.ts`**, over all of `coreSourceFiles()`.

Iteration 1's AC-4 said the lock *"calls `ensureExcluded(repoDir, '.quorum/')` immediately before
creating its file"*, and its AC-12 said `:259` and `:320` are *"not edited, weakened or exempted"*.
**Those two criteria contradict each other.** A second such call inside `writer.ts` produces a second
match and fails `:259`'s one-element `toStrictEqual`; the same call in any other core file fails
`:320`; and hoisting the pattern into a shared constant empties the array and fails both clauses of
`:259`. There is no implementation that satisfies iteration 1's AC-4 without turning a landed guard
red, and no round of a revise loop could have closed it — it would have arrived as a blocker.

**Resolved rather than deferred (AC-4 below): the lock reaches the exclusion through the one call
site that already exists** — one literal, two callers — rather than repeating it. This also makes
M-6's placement ruling near-forced rather than merely chosen.

### M-6 — The single-writer guard constrains the *literal*, not the *module* — and placement is ruled here

`RUN_HISTORY_ROOT = '.quorum/runs'` already lives in `packages/shared/src/constants.ts:46`. A sibling
`LOCK_ROOT` in shared therefore lets a core module hold the lock while naming neither the quoted
literal nor that identifier, passing both clauses of `:320`.

**Ruled here rather than left for an implementer to litigate in a review round: the lock's code lives
in `packages/core/src/run-history/writer.ts`.** Not because the guard forces the module, but because
Q-0049's stated rule is that `writer.ts` is `core`'s single owner of writes under `.quorum/`; because
the atomic-create idiom and the one permitted `ensureExcluded` call this ticket must reuse are both
already in that file (M-5); and because `reader.ts` must go on not importing it. A reviewer meeting a
lock inside "run history" will find this paragraph as its authority (R-5).

### M-7 — The atomic-create idiom already ships here, and the git-ref alternative is refused

`writer.ts:252` is `fs.mkdirSync(runDir, { recursive: false })`, whose comment says the ordering is
the contract: the directory is created **non**-recursively *"so that a collision is detected rather
than joined"*. One exclusive syscall, no git.

The ticket body's second option — a git ref — is refused on three grounds: it would make `core` a
fourth ref-writing site against the discipline of *"A run removes the worktrees it made, and never
the refs"* (2026-08-31); it is invisible to a human with `ls`; and *"Files are the database"* already
answers the question. Codex's link-plus-temp-file dance is also refused: it buys atomicity on network
filesystems, which non-goal 11 puts outside this product's claim, at the cost of an orphaned-temp-file
recovery path that would become its own defect.

Measured aside: `readRunsDir` skips non-directories, and `.quorum/locks/` is a sibling of
`.quorum/runs/` in any case, so nothing a lock writes is visible to `quorum runs`.

### M-8 — No new error class, no new `fail.ts` function, no exit-code change

Verified at the tree: `run.ts:215` is
`if (error instanceof FlowError || error instanceof IntegrationError) die(error.message);`, and
`fail.ts`'s `die` prints `✗ ` + the message and exits `ERROR` (1). The comment three lines above it
names the shipped precedent by id — *"including for a failure raised before any terminal event, which
is the stage precondition at `engine.ts:189–191`"*.

So a lock refusal is the same kind of precondition as the stage mismatch and gets the same treatment.
Claude's `RunLockedError` on the barrel plus a `dieRunLocked` in `fail.ts` is scope neither candidate
needed. Q-0111's decision (*"A `core` error names the condition; the remedy belongs to the surface"*,
2026-09-07) is honoured by the message carrying **no imperative** — which is also correct on the
merits, because there is no single remedy: waiting, inspecting the holder and deleting a lock after a
crash are three different human decisions. Naming the **path** is a fact, not advice.

### M-9 — `Backlog.read` does not validate, so `ticket.meta.id` is an unvalidated string

`backlog.ts` parses frontmatter and returns; it never calls `ticketSchema.parse`. That is Q-0043
AC-4's deliberate design and what let Q-0112 measure a shipped ticket carrying `owner: true`. A lock
path built from `ticket.meta.id` is built from an unvalidated string — the Q-0059 class arriving at a
new site. `isOneName` (`backlog/confine.ts:104–106`) is the shipped predicate for exactly this
question — `token !== '' && token !== '.' && token !== '..' && token === path.basename(token)` —
decided on the string alone and touching no filesystem.

**Registered and not this ticket's:** `runIdOf` already builds `.quorum/runs/<id>-N` from the same
unvalidated value. That exposure predates this ticket and is not widened by it.

### M-10 — The shipped failure-path fixtures are a free regression detector for AC-5

`failure-paths.test.ts`'s `scenario(label)` builds a **fresh temp repository per scenario**
(`:307`), and several invocations inside one scenario run against the same `TICKET` in that
repository. `scenario('parallel')` runs a failed invocation under `MOCK_FAIL_WRITE` (`:465`) and then
a `second-attempt` (`:476`) in the same repo. **A lock leaked on the `failed` exit turns that shipped
assertion red**, for free and without a new test. The fresh-repo-per-scenario shape also bounds R-2:
leakage cannot cross scenarios.

### M-11 — The two vocabulary lists are a curated subset, and two tickets one day apart disagreed

`docs/GLOSSARY.md` carries **35** headings; `CLAUDE.md:13` and `docs/README.md` each carry **22** of
them. `packages/shared/src/docs.test.ts` compares those two lists **with each other**, ordered, and
never against the glossary's own headings. So the lists are not "every term".

The precedent split within twenty-four hours. **Q-0067 (2026-09-08)** added `verified version` to
both lists and had to commit it to the ticket branch rather than to `main`, because the ordered
comparison would otherwise leave `main` red until the merge. **Q-0059 (2026-09-08)** added
`Confinement` to the glossary and to **neither** list.

**Ruled in the body so no implement step chooses it: the glossary only, following Q-0059.** It is the
nearer precedent in kind — a `core` safety guarantee whose term names a property of the engine, not a
word an agent must use when writing a flow or a ticket. This deletes the branch-sequencing obligation
entirely, which is why no gate obligation about term ordering appears in §8.

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

**AC-1 — The lock is `core`'s, and it is taken once inside `run()`, before anything the run must keep
stable.**
Acquisition happens after the stage precondition (`engine.ts:190`, a pure read of the in-memory
ticket, so a run refused on its stage touches the repository not at all) and **before** the
`branchHead` capture (`:252`), the `runs.log` start line (`:293`), run-history initialisation and any
worktree. Per M-2, the reason is **not** that `nextRunId` consumes a number — it is a pure read — but
that the branch head, the run number and the worktree must each be facts about a run that is already
the only one. Because `run()` is called lazily from `runFlow`'s `start()` (`engine.ts:396–401`), a
caller that builds the iterable and never pulls takes no lock; stated rather than left to be
discovered.
*Test:* a fake at the acquisition seam records call order — a stage mismatch acquires nothing; a
proceeding run acquires before `branchHead` and before the start line. Shown red by moving
acquisition below `:293`.

**AC-2 — The lock is one file, created by one exclusive syscall, its subject is the ticket, and it
advertises the run number the run actually uses.**
`<LOCK_ROOT>/<ticket-id>.json`, created with an exclusive create (`fs.openSync(…, 'wx')`, or a
non-recursive `mkdirSync` on the writer's own idiom) — never a read-then-write, which is the race it
exists to close. `LOCK_ROOT` is declared in `packages/shared/src/constants.ts` beside
`RUN_HISTORY_ROOT`, so the **string literal lives in shared** and no core file gains one (M-5, M-6).
Two different tickets never block one another, whatever flow each is running. Whether the id is read
before the claim or under it, the number the file advertises equals the number the run's `runs.log`
start line carries (M-2).
*Test:* two acquisitions in one process against one ticket — the second refuses, the file exists
between them, is gone after release; two acquisitions against **different** tickets both succeed; a
completed run's lock content, captured before release, names the same run number its `start` line
does. Plus a source assertion that the create flag is exclusive, shown red by mutating it to `'w'` or
`{ recursive: true }`.

**AC-3 — The ticket id is proven to be one path segment before it names a file.**
`isOneName` (`backlog/confine.ts:104`) is reused rather than re-spelled; M-9 is why the check exists
at all. A ticket whose `id` does not pass refuses, and no file is created anywhere.
*Test:* a ticket record whose `meta.id` is `../../escape` refuses, naming the id; the filesystem is
byte-identical afterwards. The pre-existing `runIdOf` exposure is registered in a comment citing this
criterion and is not touched.

**AC-4 — `.quorum/` is excluded before the lock file exists, through the one call site that already
exists.**
The exclusion must precede the first lock file, or a first-ever run leaves it untracked and
unignored, which *"Membership is a git question, not a filesystem one"* (2026-08-28) makes exactly
the set turbo hashes into every task input. **It is reached through the existing
`ensureExcluded(repoDir, '.quorum/')` site in `writer.ts:397` rather than repeated** — one literal,
two callers — because a second such call anywhere in core turns `run-history.source.test.ts:259` or
`:320` red, and AC-12 forbids editing either (M-5). `ensureWorktree` (`git/git.ts:130–138`) is the
shipped shape being copied: exclude, then create.
*Test:* in a fresh repository whose `info/exclude` names nothing, after acquisition
`git status --porcelain` reports nothing outside the product roots and the exclude line is present;
AC-12's two guards pass with no diff to their file. Shown red by acquiring before the exclusion call.
Note that `ensureExcluded` **warns rather than throws** on failure (`git.ts:457–462`), so the
assertion is on the exclude file's content and not on a raised error.

**AC-5 — Release is a `finally`, it covers all six exits, and it removes only this run's lock.**
M-3's six exits: `regressed` (`:342`), `aborted` (`:350–351`), `undecided` (`:365–366`), the
failed/interrupted rethrow (`:373–374`), the completed fallthrough (`:380`), and a throw between
acquisition and `:291`. `:380` stays outside any `catch` and `:376–379`'s comment survives verbatim.
Release is **ownership-checked**: the run unlinks the file only if it still carries this run's own
recorded token, so a lock a human cleared and a successor re-took is not deleted by the first run's
`finally`. A release that fails **warns and does not rewrite the run's outcome** — a completed run
keeps `completed`, its history entry and its exit code, and the failure is surfaced rather than
reported as a successful release.
*Test:* a table with one row per terminal status plus one for a pre-`try` throw, each asserting the
file is gone; one row where the file was replaced under the run, asserting the replacement survives;
one row where unlink throws, asserting the terminal status and exit code are unchanged and a warning
is emitted. Shown red by deleting the `finally`, which must fail more than one row. M-10 records that
`failure-paths.test.ts`'s `parallel` scenario is an independent detector of the `failed` row.

**AC-6 — A second run refuses, names the holder, and changes nothing.**
The refusal carries the ticket, the holder's run number, its flow, its pid, its hostname and its
start time — the facts AC-10's file holds and no others. It fires before the start line, so no
`runs.log` line is appended, no run directory is created, no worktree is obtained, no adapter or
script is invoked, no stage or iteration counter moves, no ticket history entry is added, and
`ticket.md` is not written. After the holder releases, the next run receives the id `nextRunId` would
have given it — a refused contender introduces no gap.
*Test:* acquire out of band, then run; assert each named fact appears; assert `runs.log`,
`.quorum/runs/`, `.harness/worktrees/` and `ticket.md` are byte-identical before and after; assert
the next successful run's id is unchanged by the refusal.

**AC-7 — The refusal is a `FlowError` stating the condition, and the CLI is not touched.**
M-8: `run.ts:215` already renders a `FlowError` unaltered through `die` and exits **1**. No new error
class reaches the barrel, no function is added to `packages/cli/src/fail.ts`, and `ExitCode` gains no
sixth member — a refused run is not `ABORTED` (2, a human chose to stop *this* run) and not
`UNDECIDED` (3, nobody was there *at a gate*); it is an unmet precondition, like the stage mismatch in
the same function. The message carries **no imperative**, per *"A `core` error names the condition;
the remedy belongs to the surface"* (2026-09-07) — and here the surface offers none, because waiting,
inspecting and deleting are three different human decisions. It names the lock's **path**, which is a
fact rather than advice.
*Test:* through the built binary, a refused second run exits 1 and prints one line; a source
assertion that the message contains no backticked shell imperative; `exit.ts`'s union asserted by
identity so a sixth member fails. **Registered and not fixed:** `writer.ts:259` carries *"Move or
delete that directory to re-use the id."* inside `core`, predating that decision — named in a comment
and left alone.

**AC-8 — `--dry` neither takes a lock nor is refused by one.**
`readOnlyBacklog` (`engine.ts:42–48`) replaces `write`, `writeFile` and `log` with no-ops;
`initialiseRunHistory` is skipped entirely (`:294`, `if (!dry)`); and `finish` guards both the
worktree return and the branch rollback with `if (!context.dry)` (`lifecycle.ts:132`). A dry run
touches none of M-1's three resources, and a maintainer must be able to inspect a flow while a run
holds the ticket. This settles the ticket body's open question 5 by measurement rather than taste.
*Test:* a dry run creates no lock file; a dry run succeeds while a lock is held, and its output is
identical to the unlocked case.

**AC-9 — A lock whose holder is gone still refuses, and is never reclaimed automatically.**
M-4 is the premise and it is measured, not assumed: SIGINT and SIGTERM reach the engine's `finally`,
so the only way a lock outlives its run is SIGKILL, a hard crash or power loss. A recorded pid cannot
distinguish *that process is gone* from *that pid belongs to something else now*, and reporting an
unanswerable question as an answerable one is what the containment, push-lag and verified-version
discipline forbids — most recently *"The board reports push lag, and never a CI conclusion"*
(2026-09-06). A pid probe is also the exact shape **Q-0074** is open on, *"A failed git probe is read
as a proven negative"*: adopting one here would create a new instance of an open ticket's defect
class. The pid is therefore **reported and never branched on**, which is the verified-version shape.
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
(`spawnSync(process.execPath, [bin, …])`, `:336`), which is where this belongs. The **first** holder
is a lock file the fixture wrote; the **second** is a real process. A genuine two-process race is
**refused**, stated in the criterion rather than left to a reviewer: it would be a new instance of
Q-0102's subject, a suite that is red under load, and this repository has one parked ticket on
exactly that.
*Test:* the fixture writes a lock, spawns `quorum run <flow> <ticket>`, and asserts exit 1 and the
holder's facts in the output. Shown red against a binary built without the guard.

**AC-12 — The Q-0049 single-writer guards pass unchanged.**
`run-history.source.test.ts:259` and `:320` are not edited, weakened or exempted; `reader.ts` gains
no write verb and does not import `./writer.js`. AC-4 is written to be satisfiable against them
(M-5), which is the criterion this one exists to hold.
*Test:* both tests pass with no diff to that file; a mutation putting a quoted `.quorum` in a second
core module fails `:320` by name, and a mutation adding a second `ensureExcluded(repoDir, '.quorum/')`
call inside `run-history/` fails `:259` by name.

**AC-13 — The vocabulary and the numbered docs move with it.**
`docs/GLOSSARY.md` gains **Run lock**, defined by what it is and by what it is **not**: not
**Containment** (a git ancestry fact about two refs), not **Confinement** (whether a path is inside a
declared root), not a **gate** (a human checkpoint inside a run), and **advisory** — it serialises
this product's runs and nothing else (non-goal 11). Per M-11 it joins the glossary **only**, not the
two vocabulary lists, so no branch-sequencing discipline is owed. `04-architecture.md` principle 6
gains one sentence beside its worktree and confinement sentences, and its run-history section names
the second thing `core` writes under `.quorum/`.
*Test:* the glossary heading exists and its "not" clauses are asserted by phrase, as
`packages/shared/src/docs.test.ts` already does for push lag (`:515–552`) and verified version
(`:691–739`), with that file's own anti-vacuity idiom (`:545`) so the assertion is shown to refuse
what a weaker one accepts. **Stated rather than dressed up:** no automated check covers the two prose
sentences in `04-architecture.md`; they are verified by reading.

---

## 5. Non-goals

1. **Waiting or queueing.** A second run does not block, poll, retry or queue.
2. **Reclaiming a stale lock automatically** (AC-9). Deferred with its body written out in
   **Appendix A**, not left in prose to expire.
3. **A `--force` flag to break a lock.** Deliberately absent: it is the escape hatch that becomes the
   habit, and the file is one `rm` away. Its own ticket if a real need appears.
4. **A lock-inspection or lock-clearing command.** Codex's OQ-1; its own ticket.
5. **A repository-wide or branch-wide lock.** The subject is the ticket — all three collisions are
   keyed by it, and fan-out task branches derive from the ticket branch and are already inside it.
6. **Rendering a held lock on `quorum board` or `quorum runs`.** Its own ticket.
7. **Fixing `runIdOf`'s unvalidated id** (M-9, registered by AC-3).
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

## 6. Rulings made here (iteration 1's two blockers)

**OQ-1 — is a decision entry owed? Downgraded from blocker to gate obligation (GO-1).**
The question does not change the design by one line: the same file, the same syscall, the same
refusal, whichever way it is answered. The role's own test for a blocker is *an open question that
would change the design*, and this is not one. It is a **gate obligation**, which is the shipped
mechanism for exactly this class — Q-0059's GO-1 ratified *"no entry owed"*, Q-0067's GO-1 landed one
**before** its run, and Q-0062's failure was not that the question was open but that the run was
launched with the obligation undischarged. Iteration 2 re-asking it on an unchanged tree could not
have answered it either, and would have been the sixteenth appearance of a loop handed work no agent
in it can perform.
**Recommendation, for the human at the gate: yes, one entry.** It introduces a second kind of durable
file under `.quorum/` and a new circumstance in which `quorum run` refuses to run at all — product
policy rather than a repair, which is the judgement Q-0112 got wrong by deciding an entry was
unnecessary. **Codex's AC-21 stating the entry as an acceptance criterion is struck**, because a
criterion naming a surface its own flow cannot write is *"A requirement may not name a surface its
flow cannot write"* (2026-08-25).

**OQ-2 — refuse a stale lock, or probe and reclaim? Ruled: refuse.**
The candidates disagreed flatly and this document does not average them; the role is to pick and say
why. **Refuse**, on four grounds, the first of which is new to this iteration:

1. **The premise is now measured (M-4).** SIGINT and SIGTERM reach the engine's `finally`, because
   `run.ts` aborts a controller instead of exiting. A lock outlives its run only on SIGKILL, a hard
   crash or power loss — rare enough that a manual `rm` against a message naming the path is
   proportionate, and too rare to justify an oracle that can lie.
2. **A pid probe is an open ticket's defect class.** Q-0074, *"A failed git probe is read as a proven
   negative"*, is open on precisely the shape *probe fails → read as absence*. Shipping one here
   would be adding an instance while the ticket to remove them is unstarted.
3. **The landed discipline forbids it.** Containment, push lag and verified version all select from a
   closed set and never report an unanswerable question as an answerable one.
4. **Direction of travel.** Refuse-now, reclaim-later is additive; reclaim-now cannot be un-shipped
   without a behaviour change. And refuse holds the cut at thirteen criteria, inside the band, where
   reclaim is nineteen or twenty and must be split.

**The reclaim design is not discarded — it is Appendix A**, written out in full so it does not expire
the way three obligations found orphaned this week did (Q-0110, Q-0111, Q-0112, each recorded in a
closed ticket's prose or a source comment rather than as a ticket).

**OQ-5 — ruled (M-11): glossary only, not the two vocabulary lists**, following Q-0059 rather than
Q-0067. This removes the branch-sequencing obligation Q-0067 needed.

**OQ-6 — ruled: no zod schema in `packages/shared` for the lock file.** It is read only by the code
that wrote it, and a schema buys a second description of eight fields. AC-10's narrow parse and its
refusal are the contract. Recorded so a reviewer meets a decision rather than an omission.

---

## 7. Open questions

**None blocks solutioning.** One remains and is non-blocking:

**OQ-4 (non-blocking) — priority.** The frontmatter says `p2`; the plan's own argument is that this
is due rather than approaching, M2's substantive work being done and M3 next. Nothing checks a plan
bullet against a ticket's frontmatter — the drift Q-0101 recorded for Q-0102. Settle or leave, but do
not let the two go on disagreeing silently.

---

## 8. Gate obligations

- **GO-1.** Rule OQ-1, and if an entry is owed it **lands before the chore run starts**, not during
  it — *"An erratum is the last repair, not the first"* (2026-08-30) and Q-0094 E-3's window rule:
  the window for a ruling is a gate. Q-0062 spent three implement rounds on this exact obligation
  left undischarged.
- **GO-2.** Decide whether Appendix A is opened as a ticket at this gate or recorded as deliberately
  not wanted. Q-0059's GO-2 is the precedent — open it at the gate rather than in a closing entry.
  Recommendation: open it, p3.
- **GO-3.** The merge is verified forced in **both** environment rows (Q-0072's closing finding) — in
  the integrate worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on
  `main` after the merge, where both exist. AC-4's ordering is exactly the defect that is invisible
  in one row.
- **GO-4.** CI is green on the merged commit before the ticket is called done. Q-0105's GO-3 is why
  this is written down: every local signal was green and CI was red on all three jobs.

---

## 9. Risks

**R-1 — the outer `try/finally` lands in the function Q-0050 spent six review rounds on.**
`:376–379`'s comment is load-bearing and a mechanical wrap could void it. Mitigation: AC-5 has a row
per exit and asserts the comment survives.

**R-2 — every test that runs a flow now takes a lock.** `runFlow` has few direct call sites, but
`end-to-end.test.ts` and `failure-paths.test.ts` spawn the binary many times. Bounded rather than
open (M-10): `failure-paths.test.ts` builds a fresh temp repository per scenario, so leakage cannot
cross scenarios, and within `parallel` the reuse is what makes AC-5's `failed` row independently
detectable. Mitigation: AC-5's `finally`; AC-11's fixture writes the holding lock rather than racing.

**R-3 — Q-0102's subject.** A test spawning two concurrent binaries is precisely the shape that
ticket is parked on. AC-11 forbids it, with the reason inside the criterion rather than left to a
reviewer.

**R-4 — the exclusion ordering is invisible in this repository**, whose own `info/exclude` and
`.gitignore` already cover `.quorum/`. AC-4's fixture must build a repository that excludes nothing.

**R-5 — the `writer.ts` home will look wrong to a reviewer** who reads "run history" and sees a lock.
M-6 is the authority, and M-5 is why it is close to forced rather than merely chosen. If a later
ticket splits the folder, the split is a `run-state/` module and the guards move with it.

**R-6 — the refusal is advisory.** It serialises this product's runs and nothing else. A second
checkout, a stray `git worktree remove`, or an editor writing into the worktree is outside it. Stated
in the glossary entry so the guarantee is never read as wider than it is.

**R-7 — a release failure could rewrite a good run's audit record.** Folded into AC-5: the terminal
status, history entry and exit code a run earned are authoritative, and a failed unlink is a warning.

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No code path here reads an environment variable, a credential or a subscription. |
| **Worktree safety** | **Central.** The lock is what stops one run's `finish` removing, with `--force`, the worktree another run is writing in — the exposure Q-0062 widened deliberately and routed here (its RK-1). No worktree is created, removed or renamed by this change. |
| **Gate behaviour** | Unchanged. The refusal fires before any step runs, so no gate is reached, no gate answer changes, and `--auto` is not consulted. |
| **File format and schema** | One new file under the lock root, fields declared by AC-10, path constant in `packages/shared/src/constants.ts`. No zod schema (§6). No existing format moves. |
| **Lint rules** | None added. The flow linter is untouched; the neighbouring lint question is Q-0113's. |
| **Exit codes** | 1, from the existing closed union, through the existing `run.ts:215` path (AC-7). |
| **Cold-clone impact** | One file created and removed per run, no prompt and no flag. The happy path gains nothing a stranger sees; the refusal appears only where two runs collide. |
| **Product-agnostic** | n/a — nothing here names any product. |
| **Docs** | `docs/GLOSSARY.md` (one term, glossary only) and `docs/04-architecture.md` (principle 6, run-history section). `docs/02-sdlc-pipeline-spec.md` is untouched: it describes flows and steps, and a lock is neither. |

---

## Appendix A — the deferred successor, written out in full

*Written here rather than left in a closing entry, because three obligations found this week —
Q-0110's, Q-0111's and Q-0112's — had lived only inside a closed ticket's prose or a source comment.
GO-2 decides whether it is opened.*

**Title.** A stale run lock is detected rather than left for a human.

**Why it exists.** Q-0039 ships a lock that refuses and is never reclaimed, on the measurement (its
M-4) that the only ways one outlives its run are SIGKILL, a hard crash and power loss. That is
correct and it is not free: after such a crash, every subsequent run of that ticket refuses until
somebody deletes a file. This ticket asks whether the product can tell the difference safely.

**What it must decide first, before code.** Whether a liveness probe may exist at all, given
*"The board reports push lag, and never a CI conclusion"* (2026-09-06) and Q-0074's open subject —
*"A failed git probe is read as a proven negative"*. A probe that cannot distinguish *the process is
gone* from *that pid belongs to something else now* is the same defect one layer over. It owes a
decision entry naming Q-0074 and stating the probe's **closed set of answers, including the one that
means could not tell** — which is the shape containment, push lag and verified version all have.

**Shape, if it is built.** The probe answers `gone`, `alive` or `indeterminate`, never a boolean;
`indeterminate` refuses exactly as today, so the safe default is unchanged and only the provable case
moves. A lock whose recorded hostname is not this machine is **never** reclaimed, whatever the pid
says. Reclaiming is one attempt at the same atomic claim, so two contenders recovering the same stale
lock still yield one owner — which is why Q-0039's ownership token (its AC-5) exists before this
ticket does, and is the half that makes recovery safe rather than the probe.

**What it must not do.** It must not introduce a two-process race into the suite; Q-0102 is parked on
exactly that shape, and Q-0039's AC-11 refuses it. The race-to-reclaim property is provable
in-process against the claim primitive.

**Size.** Five to six criteria, which is why it is not folded into Q-0039: at nineteen or twenty that
ticket is past the ceiling and every later stage pays.

**Order.** Strictly after Q-0039 — recovery has no subject until a lock exists.

---

## 11. Provenance

**The claude candidate is the base**, as at iteration 1. Its acquisition-point analysis, its six-exit
map of `run()`, its `--dry` measurement, its non-goals, its refusal of the git-ref option and its
Q-0102 constraint on the cross-process proof are all carried.

**Three of its measurements did not survive iteration 1's re-running**, and are corrected in place:
the exclusion mechanism is `.git/info/exclude` and the shipped idiom to copy is `ensureWorktree`; the
Q-0049 guard constrains a *literal* rather than a module, so placement is ruled rather than claimed
as forced; and its `RunLockedError` plus `dieRunLocked` is scope `run.ts:215` makes unnecessary.

**Two came from the codex candidate and both were real gaps.** Ownership-checked release, which
closes a hole reachable even under the refuse-only design — a human clearing a lock mid-run and
starting a successor would otherwise have the first run's `finally` delete the second's (its AC-12,
folded into AC-5). And the rule that a failed release warns without rewriting a completed run's audit
record (its AC-14, folded into AC-5 and R-7). Its different-tickets-do-not-block criterion and its
no-gap-in-run-ids criterion are folded into AC-2 and AC-6. Its stale-recovery block is not struck but
**ruled** in §6 and preserved in Appendix A. Its 22 criteria — AC-18 alone being eleven tests — are
past the ceiling; its AC-21 makes a DECISIONS entry an acceptance criterion, which no step on the
chore route may satisfy; its AC-5 temp-file-and-link protocol buys network-filesystem atomicity that
non-goal 11 puts outside this product's claim; its AC-17 requires two coordinated OS processes, which
AC-11 refuses. Its *"No blocking product questions remain"* is the one judgement rejected outright:
it specified stale recovery without noticing that doing so changes the ticket's size class. One
vocabulary defect is noted rather than carried: it calls the product **the Studio**, which
`docs/GLOSSARY.md` records as pre-2026-08-22 usage and *"not current vocabulary"*.

**Added by iteration 2, from the tree, and this is what the second pass was worth.** M-5, the
contradiction between iteration 1's own AC-4 and AC-12, which no implementation could have satisfied
and which would have surfaced as a review blocker. M-2, the correction that `nextRunId` is a pure
read, which replaces AC-1's wrong rationale with a testable invariant. M-4, the measurement that
SIGINT and SIGTERM are not ways a lock leaks, which is the premise the OQ-2 ruling rests on and was
previously asserted. M-10, that `failure-paths.test.ts` already gives AC-5's `failed` row an
independent detector. And the two rulings in §6 that take this document from `needs-input` to
`ready`.

**Size.** Thirteen criteria, inside the ten-to-fifteen band. The alternative ruling on OQ-2 would be
nineteen or twenty; it was not taken, and its design is Appendix A rather than a footnote.
