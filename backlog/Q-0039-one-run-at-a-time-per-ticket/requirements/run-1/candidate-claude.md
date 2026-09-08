# Q-0039 — One run at a time per ticket

*Requirements, run 1, candidate (claude). Written against the tree at 2026-09-08, not against the
ticket body: every claim below carries the file and line it was measured at. Where a measurement
contradicts the body, the measurement is stated and the body's sentence is named.*

---

## 1. Problem

Nothing serialises runs. Two `quorum run` invocations against one ticket proceed in parallel and
collide on three resources the run owns exclusively without saying so. The `maintainer` who does
this loses work: it has happened twice in one night already (M1's closing entry), where one run's
rollback moved a branch another live run was holding.

The engine knows. `packages/core/src/run-history/writer.ts:257` says so in its own message —
*"does not make the engine safe for concurrent runs, which is Q-0039 and still open"* — so there is
a guard on the **symptom**, a run directory outliving its log line, and none on the cause. Confirmed
2026-09-08: a search for `lockfile`, `acquireLock`, `releaseLock`, `flock`, `O_EXCL` and `'wx'`
across `packages/core/src`, `packages/cli/src` and `packages/shared/src` returns only pnpm
lockfiles and test fixtures. **There is no lock of any kind.**

Today a collision needs two terminals and a person in a hurry. M3's server accepts `POST /runs`
over HTTP (`04-architecture.md`, `packages/server`), where it needs one impatient click.

---

## 2. What was measured, and where the ticket body is wrong

### M-1 — The three collisions are not the same size, and the body's table presents them as if they were

| Resource | Site | How long the exposure lasts |
| --- | --- | --- |
| the run number | `nextRunId`, `run-history/writer.ts:188`, called at `engine/engine.ts:196` | **From `:196` to `:293`** — the `runs.log` `start` line. Between them: `reviewRound(ticket.dir)` at `:203` (`loaders.ts:63`, two `existsSync` and one `readdirSync`), `branchHead` at `:252` (one git spawn), and object construction. Tens of milliseconds. |
| the ticket branch | captured `engine.ts:252`, rolled back `lifecycle.ts:136–145` through `resetBranchTo` | **The whole run.** Run A's `finish` resets the branch to where **A** found it, whatever B has since committed. |
| the worktree | registered `steps.ts:206` and `composite.ts:62`, given back `lifecycle.ts:133` | **The whole run.** Since Q-0062 a finished run also *removes* the directory a live run is writing in, with `--force`. |

A run's own `duration_ms` reaches 3,755,327 ms in this repository's history — 63 minutes. So the
id race is narrow and the other two are three to four orders of magnitude wider. `writer.ts:257`
calling the id case *"a sub-second race"* is accurate; the ticket body's table, which lists all
three without distinguishing them, is not. **This matters for scope:** a fix aimed only at the id —
allocating and appending atomically, say — would close the least important of the three and leave
both wide ones open.

### M-2 — `run()` has no `finally`, and the completed finish is deliberately outside its `try`

`engine.ts:186` is `async function run(...)`. The stage precondition throws at `:189`, **before**
`nextRunId` at `:196`. The `try` opens at `:291`, the `catch` at `:356`, and `:380`'s
`await finishRun(flow.produces, 'completed', null)` sits **outside** both, under a comment
(`:376–379`) explaining that moving it inside re-enters the catch and finishes the run twice.

So release is not a line: it is an outer `try/finally` spanning acquisition to the end of the
function, over **six** exits — the `regressed` return (`:342`), the `aborted` return (`:351`), the
`undecided` return (`:365`), the failed/interrupted rethrow (`:373`), the completed fallthrough
(`:380`), and any throw between acquisition and `:291`. The added `finally` must not pull `:380`
inside a `try` that has a `catch`.

### M-3 — `--dry` is answerable by measurement, not by taste (the body's open question 5)

`readOnlyBacklog` (`engine.ts:42–48`) replaces `write`, `writeFile` and `log` with no-ops;
`initialiseRunHistory` is skipped entirely (`engine.ts:294`, `if (!dry)`); and `finish` guards both
the worktree return and the branch rollback with `if (!context.dry)` (`lifecycle.ts:132`). A dry run
therefore touches **none** of M-1's three resources. It takes no lock, and it is not refused by one.

### M-4 — `.quorum/` is git-excluded only inside `initialiseRunHistory`, and `init` writes no `.gitignore`

`ensureExcluded(repoDir, '.quorum/')` appears exactly once in production source:
`run-history/writer.ts:397`, inside run-history initialisation. `packages/core/src/backlog/scaffold.ts`
— `quorum init` — writes no `.gitignore` and calls `ensureExcluded` for nothing.

This repository's own `.gitignore` carries `.quorum/`, so the hazard is invisible here. In an
adopter's repository it is not: a lock file created **before** `initialiseRunHistory` on the very
first run is untracked-and-unignored, and *"Membership is a git question, not a filesystem one"*
(2026-08-28) makes that exactly the set turbo hashes into every task input, and the set
`end-to-end.test.ts`'s AC-6 working-tree assertion reads (`insideProductRoot`, `:140–147`). Named
in no earlier account of this ticket.

### M-5 — `Backlog.read` does not validate, so `ticket.meta.id` is whatever the YAML held

`backlog.ts:149`'s `read` parses frontmatter (`:84`, `YAML.parse`) and returns; it never calls
`ticketSchema.parse`, which is Q-0043 AC-4's deliberate design and what let Q-0112 measure a ticket
carrying `owner: true`. A lock path built from `ticket.meta.id` is therefore built from an
unvalidated string — the Q-0059 class arriving at a new site. `isOneName` in
`backlog/confine.ts:104` is the shipped predicate for exactly this question, decided on the string
alone and touching no filesystem.

**Registered, and not this ticket's to fix:** `runIdOf` (`shared/src/constants.ts:99`, called at
`writer.ts:224`) already builds `.quorum/runs/<id>-N` from the same unvalidated value. That
exposure predates this ticket and is not widened by it.

### M-6 — `writer.ts` is the only file in `core` that may name the `.quorum` root, and a landed guard says so

`run-history/run-history.source.test.ts:259` — *"`.quorum` is a string literal in exactly one place:
the exclusion pattern"* — asserts `toStrictEqual(['writer.ts: '.quorum'])` over every core module.
`:320` — *"the writer is the only file in core that names the run-history root as a value"* — walks
`coreSourceFiles()` and requires `QUOTED_ROOT.test(text) || text.includes('RUN_HISTORY_ROOT')` to be
true for `writer.ts` and **false for every other file**.

So a new `packages/core/src/engine/lock.ts` that quotes `.quorum` turns a landed guard red, and one
that calls `ensureExcluded(repoDir, '.quorum/')` does too. This is what rules the code's home rather
than taste: acquisition and release belong in `run-history/writer.ts`, beside `nextRunId`, the
`ensureExcluded` call and the atomic-create idiom this ticket reuses. Q-0049's three-file rule —
`reader.ts` never writes, `writer.ts` is `core`'s single owner of `.quorum/` writes, `reader.ts` does
not import `./writer.js` — is then preserved by construction rather than negotiated.

### M-7 — The atomic-create idiom already exists here, and the git-ref alternative is refused on three grounds

`writer.ts:252` is `fs.mkdirSync(runDir, { recursive: false })`, and its comment says the order is
the contract: *"the run directory **non**-recursively so that a collision is detected rather than
joined"*. One exclusive syscall, no git, already the house pattern.

The body's second option — a git ref — is refused. It would make `core` a fourth ref-writing site
against the discipline of *"A run removes the worktrees it made, and never the refs"* (2026-08-31);
it is invisible to a human with `ls` and to `quorum runs`; and *"Files are the database. Anything
persistent is a file in `backlog/`, `harness/` or `.quorum/`"* (`harness/rules.md`) already answers
the question. Measured aside: `readRunsDir` skips non-directories (`reader.ts:115`), so a lock file
under `.quorum/runs/` would have been invisible to `quorum runs` either way — the placement below is
chosen for legibility rather than forced by that filter.

### M-8 — The two vocabulary lists are a curated subset, and two tickets one day apart treated a new term differently

`docs/GLOSSARY.md` carries **34** headings; `CLAUDE.md:13` and `docs/README.md`'s GLOSSARY row each
carry **22**, and `docs.test.ts:637` compares those two with each other as **ordered** sequences
(Q-0108) — never against the glossary's own headings. Twelve glossary terms are named in neither
list, including `Confinement`, `Event`, `Run history`, `Undecided` and `Base override`.

So the lists are not "every term". And the precedent for a *new* term is inconsistent within
twenty-four hours: **Q-0067 (2026-09-08)** added `verified version` to both lists and recorded the
sequencing ruling that a new term is committed to the ticket branch and never to `main` ahead of the
merge, because the ordered comparison would leave `main` red until the merge landed.
**Q-0059 (2026-09-08)** added `Confinement` to the glossary and to **neither** list. Nothing checks
which is right, and this ticket needs an answer for itself (OQ-5).

---

## 3. User stories

**`maintainer` — the collision.** As the solo maintainer, when I start a second run against a ticket
that is already running — from a second terminal, or because I forgot the first — I want the second
to refuse and name what is holding it, rather than the two sharing a run number, a branch and a
worktree until one of them rolls the other back.

**`maintainer` — the crash.** As the solo maintainer, when a run dies in a way that leaves a lock
behind, I want the next run to tell me exactly which file is in the way and what it says, in one
sentence, rather than to guess on my behalf that the holder is dead.

**`adopter` — the untouched happy path.** As a cold-clone adopter running one ticket at a time, I
want to notice nothing: one file created and removed per run, no prompt, no flag, and nothing new in
`git status`.

**`contributor` — the guarantee is stated once.** As a contributor reading
`docs/04-architecture.md`, I want the serialisation to be `core`'s and not the CLI's, so that when
M3's server starts runs over HTTP it inherits the same refusal instead of writing a weaker one —
which is the arrangement Q-0059 chose for confinement and principle 6 already claims for worktrees
and the human-locked gate.

---

## 4. Acceptance criteria

Surface for AC-1 to AC-6 and AC-9 to AC-13 is **`packages/core`**; AC-7 and AC-8 are
**`packages/cli`**; AC-14 is **docs**. Each criterion is independently testable and its *Test:*
clause bounds the instrument it asks for.

**AC-1 — The lock is `core`'s, and it is taken at one point inside `run()`.**
Acquisition happens after the stage precondition (`engine.ts:189`, a pure read of the in-memory
ticket, so a run refused on its stage never touches the repository) and **before** `nextRunId`
(`:196`). One acquisition closes all three of M-1's collisions; acquiring later closes only some of
them. Because `run()` is called lazily from `runFlow`'s `start()`, a caller that builds the iterable
and never pulls takes no lock, and that is stated rather than left to be discovered.
*Test:* a fake at the acquisition seam records call order — a stage mismatch acquires nothing; a
proceeding run acquires before `runs.log` is read. Shown red by moving the acquisition below `:196`.

**AC-2 — The lock is one file, created by one exclusive syscall, written by `writer.ts`.**
`.quorum/locks/<ticket-id>.json`, created with an exclusive create (`fs.openSync(…, 'wx')` or a
non-recursive `mkdirSync`) — never a read-then-write, which is the race it exists to close. The path
constant is declared in `packages/shared/src/constants.ts` beside `RUN_HISTORY_ROOT`; the code lives
in `packages/core/src/run-history/writer.ts` for M-6's reason.
*Test:* two acquisitions in one process against one ticket — the second refuses, the file exists
between them and is gone after release. Plus a source assertion that the create flag is exclusive,
shown red by mutating it to `'w'` / `{ recursive: true }`.

**AC-3 — The ticket id is proven to be one path segment before it names a file.**
`isOneName` (`backlog/confine.ts:104`) is reused rather than re-spelled; M-5 is why the check exists
at all. A ticket whose `id` does not pass refuses, and no file is created anywhere.
*Test:* a ticket record whose `meta.id` is `../../escape` refuses, naming the id; the filesystem is
byte-identical afterwards. The pre-existing `runIdOf` exposure is registered in a comment citing this
criterion and is not touched.

**AC-4 — `.quorum/` is git-excluded before the lock file exists.**
The exclusion `writer.ts:397` performs runs before the first lock file is written, so M-4's
untracked-and-unignored window does not exist. Ordering, not merely presence.
*Test:* in a fresh repository with no `.gitignore` and no prior run, after acquisition
`git status --porcelain` reports nothing outside the product roots, and the exclusion line is
present. Shown red by acquiring before the exclusion.

**AC-5 — Release is a `finally`, and it covers all six exits of `run()`.**
M-2's six: regressed, aborted, undecided, the failed/interrupted rethrow, the completed fallthrough,
and a throw between acquisition and `:291`. `:380` stays outside any `catch`, and `:376–379`'s
comment survives verbatim.
*Test:* a table with one row per terminal status plus one for a pre-`try` throw, each asserting the
lock file is gone. Shown red by deleting the `finally`, which must fail more than one row.

**AC-6 — A second run refuses, names the holder, and changes nothing.**
The refusal carries the ticket, the holder's run number, its flow, its pid, its hostname and its
start time — the facts AC-11's file holds and no others. It fires before `nextRunId`, so **no run
number is consumed**, no `start` line reaches `runs.log`, no run directory is created, no worktree is
obtained, and `ticket.md` is not written.
*Test:* acquire out of band, then run; assert each named fact appears, and assert `runs.log`,
`.quorum/runs/`, `.harness/worktrees/` and `ticket.md` are byte-identical before and after.

**AC-7 — `core` states the condition; `packages/cli` owns the remedy.**
A `RunLockedError` on `@quorum/core`'s barrel carrying the condition **alone**, and one
`dieRunLocked(condition)` in `packages/cli/src/fail.ts` beside `dieNoProject` — the only place the
remedy sentence exists, taking a string rather than the error so that frame module still names no
`core` symbol. See *"A `core` error names the condition; the remedy belongs to the surface"*
(2026-09-07) and Q-0111, which is the shipped shape this copies.
*Test:* no file under `packages/core` contains the remedy sentence; `fail.ts` contains it once.
**Registered and not fixed:** `writer.ts:259` carries *"Move or delete that directory to re-use the
id."* inside `core`, which predates that decision; it is named in a comment and left alone.

**AC-8 — The exit code is 1, and the vocabulary stays closed at five.**
A refused run is not `ABORTED` (2 — a human chose to stop *this* run) and not `UNDECIDED` (3 —
nobody was there *at a gate*); it is `ERROR` (1), an unmet precondition. `ExitCode` gains no sixth
member. See *"What an exit code may claim, and the three zeros it was asked about"* (2026-09-08).
*Test:* through the built binary, a refused second run exits 1; `exit.ts`'s union is asserted by
identity, so a sixth member fails.

**AC-9 — `--dry` neither takes a lock nor is refused by one.**
M-3 is the authority: a dry run touches none of the three resources, and a maintainer must be able
to inspect a flow while a run holds the ticket.
*Test:* a dry run creates no lock file; a dry run succeeds while a lock is held, and its output is
identical to the unlocked case.

**AC-10 — A lock whose holder is gone still refuses, and is never reclaimed.**
*(Void if OQ-2 is ruled the other way.)* The only way a lock outlives its run is a process that never
reached its `finally` — `SIGKILL`, or power loss. A recorded pid cannot distinguish *that process is
gone* from *that pid belongs to something else now*, and reporting an unanswerable question as an
answerable one is what the containment, push-lag and verified-version discipline forbids — most
recently *"The board reports push lag, and never a CI conclusion"* (2026-09-06). The pid is
**reported and never branched on**, which is the verified-version shape.
*Test:* a lock naming a pid that cannot be running still refuses, with the same message shape as
AC-6; no code path deletes a lock file it did not create.

**AC-11 — The lock file's contents are declared, and a damaged one refuses rather than defaults.**
Fields: schema version, ticket id, run number, flow name, pid, hostname, `started_at`. An
unparseable or incomplete file refuses with its own message naming the file. It never reads as
*no lock*, and never as *my lock*. *"Errors are explicit… Never default silently."*
*Test:* a lock file holding `{` and one holding `{}` each refuse and each name the path; neither is
overwritten.

**AC-12 — The proof crosses a real process boundary, and is deterministic.**
The guarantee is cross-process, so an in-process pair of `runFlow` calls cannot establish it.
`packages/cli/src/end-to-end.test.ts` spawns the built binary (its own AC-1), which is where this
belongs. The **first** holder is a lock file the fixture wrote; the **second** is a real process. A
genuine two-process race would be a new instance of Q-0102's subject — a suite that is red under
load — and is refused for that reason, stated rather than left implicit.
*Test:* the fixture writes a lock, spawns `quorum run <flow> <ticket>`, and asserts exit 1 and the
holder's facts in the output. Shown red against a binary built without the guard.

**AC-13 — The Q-0049 single-writer guard passes unchanged.**
`run-history.source.test.ts:259` and `:320` are not edited, weakened or exempted. No new
`packages/core` file quotes `.quorum` or names `RUN_HISTORY_ROOT`.
*Test:* both tests pass with no diff to that file; a mutation putting the lock in a second core
module fails `:320` by name.

**AC-14 — The vocabulary and the numbered docs move with it, on the branch.**
`docs/GLOSSARY.md` gains **Run lock**, defined by what it is and by what it is **not**: not
**Containment** (a git ancestry fact about two refs), not **Confinement** (whether a path is inside a
declared root), not a **gate** (a human checkpoint inside a run). If OQ-5 rules that the two
vocabulary lists gain it, the edit is committed to `harness/Q-0039/integration` and **never to
`main` ahead of the merge**, because `docs.test.ts:637` compares the two lists as ordered sequences
and would leave `main` red until this ticket lands — Q-0067's GO-2, which is the first time this
repository had to sequence a term against its own vocabulary check.
`04-architecture.md` principle 6 gains the run lock beside its worktree and confinement sentences,
and its *"Run history on disk"* section names the second thing `core` writes under `.quorum/`.
*Test:* the glossary heading exists and its "not" clauses are asserted by phrase, as `docs.test.ts`
already does for push lag and verified version. **Stated rather than dressed up:** no automated check
covers the two prose paragraphs in `04-architecture.md`; they are verified by reading.

---

## 5. Non-goals

1. **Waiting or queueing.** A second run does not block, poll, retry or queue. Refusing is the honest
   default for a CLI and matches *"Errors are explicit… Never default silently."*
2. **Reclaiming a stale lock automatically** (AC-10, subject to OQ-2).
3. **A `--force` flag to break a lock.** Deliberately absent from this cut: it is the escape hatch
   that becomes the habit, and the file is one `rm` away. Its own ticket if a real need appears.
4. **A repository-wide or branch-wide lock.** The subject is the ticket — all three collisions are
   keyed by it, and fan-out task branches are derived from the ticket branch and so are already
   inside its scope.
5. **Rendering a held lock on `quorum board` or `quorum runs`.** Its own ticket.
6. **Fixing `runIdOf`'s unvalidated id** (M-5, registered by AC-3).
7. **Fixing `writer.ts:259`'s in-`core` remedy sentence** (registered by AC-7).
8. **`harness worktrees`** — Q-0062's successor, which removes what *earlier* runs left. Unchanged
   and not folded in; a lock stops a live collision and cleans up nothing.
9. **A lint rule for a flow declaring an escaping path** — that is Q-0113, opened at Q-0059's gate.
10. **Any change to Q-0040's four terminal statuses or to gate behaviour.** A lock is refused before
    a run exists, so no status, no rollback rule and no gate answer moves.
11. **Guarantees across machines or on a network filesystem.** `open(…, 'wx')` atomicity is a local
    filesystem property; the refusal is advisory within this product and does not stop `git`, another
    tool, or a second checkout from touching the same branch. Said in the glossary entry.
12. **Windows.** Registered by Q-0098 as already true of the build; unchanged here.

---

## 6. Open questions

**OQ-1 (blocker, owner: human at the requirements gate) — is a decision entry owed before code?**
Recommendation: **yes, one entry.** It introduces a second kind of durable file under `.quorum/` and
a new circumstance in which `quorum run` refuses to run at all, which is product policy rather than a
repair — the shape Q-0112 got wrong by judging an entry unnecessary. The precedent that costs money
is Q-0062, whose GO-1 said the entry must exist *before* the implement step and whose run was
launched without it, spending three rounds on a blocker no step on the route could clear.
`developer-generalist` may not write one, so this cannot be deferred into the chore run.

**OQ-2 (blocker, owner: human at the requirements gate) — refuse a stale lock, or probe and reclaim?**
Recommendation: **refuse** (AC-10). A liveness probe is a later refinement with its own subject, and
pid reuse makes it an oracle that can lie. If the gate rules for reclaiming, AC-10 is replaced and
the entry OQ-1 asks for must state the probe's closed set of answers, including the one that means
*could not tell*.

**OQ-3 — does the refusal record a pid at all, given that recording one invites the probe AC-10
refuses to make?** Recommendation: **record it, branch on nothing.** A pid is a fact that helps a
human decide, and *"a past measurement, and never a policy"* is the shape `verified version` already
has for exactly this tension.

**OQ-4 — priority.** The frontmatter says `p2`; `docs/06-development-plan.md`'s own argument is that
this is now due rather than approaching, M2's substantive work being done and M3 next. Nothing checks
a plan bullet's priority against a ticket's frontmatter — the drift Q-0101 recorded for Q-0102.
Settle or leave, but do not let the two go on disagreeing silently.

**OQ-5 — does **Run lock** join the two vocabulary lists, or only the glossary?** M-8: Q-0067 and
Q-0059 answered this differently one day apart, and nothing checks which is right. Recommendation:
**follow Q-0067** — add it to both, with the branch-sequencing discipline AC-14 states. Whether the
lists are "every term" or "the terms an agent most often gets wrong" is a question this ticket
raises and does not own.

**OQ-6 — does the lock file's shape want a zod schema in `packages/shared`?** The run manifest has
one; this file is read only by the code that wrote it. Recommendation: **no schema, a narrow parse
with AC-11's refusal**, because a schema here buys a second description of seven fields. Raised so
that a reviewer meets a decision rather than an omission.

---

## 7. Gate obligations

- **GO-1.** OQ-1 and OQ-2 are settled, and if an entry is owed it **lands before the chore run
  starts**, not during it. *"An erratum is the last repair, not the first"* (2026-08-30) and the
  window rule from Q-0094 E-3 — the window for a ruling is a gate.
- **GO-2.** OQ-5 is answered in the ticket body, so no implement step chooses it. Q-0059's GO-3 is
  the precedent: rulings go into the body in advance.
- **GO-3.** The merge is verified forced in **both** environment rows per Q-0072's closing finding —
  in the integrate worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on
  `main` after the merge, where both exist. AC-4's exclusion ordering is exactly the kind of defect
  that is invisible in one row.
- **GO-4.** CI is green on the merged commit before the ticket is called done. Q-0105's GO-3 is the
  reason this is written down: every local signal was green and CI was red on all three jobs.
- **GO-5.** If AC-14's term joins the two lists, the commit carrying it is on the branch and not on
  `main` (Q-0067 GO-2).

---

## 8. Risks

**R-1 — the outer `try/finally` lands in the function Q-0050 spent six review rounds on.**
`:376–379`'s comment about the completed finish is load-bearing and a mechanical wrap could void it.
Mitigation: AC-5's table has a row per exit, and the comment's survival is asserted.

**R-2 — every test that runs a flow now takes a lock.** `runFlow` has few call sites (`run.ts`,
`engine.test.ts`, `diff.test.ts`, `undecided.test.ts`, `gate.test.ts`), but `end-to-end.test.ts` and
`failure-paths.test.ts` spawn the binary many times against tickets in a temp repository. A lock
leaked by a crashing fixture turns a later, unrelated test red for the wrong reason.
Mitigation: AC-5's `finally`; AC-12's fixture writes the holding lock itself rather than racing.

**R-3 — Q-0102's subject.** A new test that spawns two concurrent binaries is precisely the shape
that ticket is parked on. AC-12 forbids it, and the reason is written into the criterion rather than
left to a reviewer.

**R-4 — the exclusion ordering (M-4) is invisible in this repository**, whose `.gitignore` already
carries `.quorum/`. AC-4's fixture must build a repository without one.

**R-5 — the `writer.ts` home (M-6) will look wrong to a reviewer** who reads "run history" and sees a
lock. The authority line and this section are the answer: the guard's stated rule is single ownership
of `.quorum/` writes, and a second owner is what it exists to forbid. If a later ticket splits the
folder, the split is a `run-state/` module and the guard moves with it.

**R-6 — the refusal is advisory.** It serialises *this product's* runs and nothing else. A second
checkout, a stray `git worktree remove`, or an editor writing into the worktree is outside it. Stated
in the glossary entry (non-goal 11) so the guarantee is not read as wider than it is.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No code path here reads an environment variable, a credential or a subscription. |
| **Worktree safety** | **Central.** The lock is what stops one run's `finish` removing, with `--force`, the worktree another run is writing in — the exposure Q-0062 widened deliberately and routed here (its RK-1). No worktree is created, removed or renamed by this change. |
| **Gate behaviour** | Unchanged. The refusal fires before any step runs, so no gate is reached, no gate answer changes, and `--auto` is not consulted. |
| **File format and schema** | One new file under `.quorum/locks/`, fields declared by AC-11, path constant in `packages/shared/src/constants.ts`. No schema (OQ-6). No existing format moves. |
| **Lint rules** | None added. The flow linter is untouched; the neighbouring lint question is Q-0113's. |
| **Exit codes** | 1, from the existing closed union (AC-8). |
| **Cold-clone impact** | One file created and removed per run, no prompt and no flag. The happy path gains nothing a stranger sees; the refusal sentence appears only where two runs collide. |
| **Product-agnostic** | n/a — nothing here names any product. |
| **Docs** | `docs/GLOSSARY.md` (one term), `docs/04-architecture.md` (principle 6 and the run-history section), and the two vocabulary lists subject to OQ-5. `docs/02-sdlc-pipeline-spec.md` is untouched: it describes flows and steps, and a lock is neither. |
