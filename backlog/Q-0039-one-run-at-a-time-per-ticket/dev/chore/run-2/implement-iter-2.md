# Q-0039 — implement report (run 2, iteration 2)

*A revision round. Two majors from `review/chore/run-2/chore-iter-1.md`: one fixed, one refused with
its authority named. Verdict: `blocked`, on the second only.*

---

## 1. The short version

**Major 2 is fixed.** A lock file whose exclusive create succeeded and whose write or close then
failed was left on disk with no owner. The next run met it, read it as *damaged* rather than as
*absent*, and refused — for ever, against a ticket nobody was running. The claim now takes back the
file it made.

**Major 1 is real and I cannot close it.** The finding is correct: `readLockRecord` and
`unlinkSync` are two syscalls, so a lock replaced between them is deleted. Both remedies the finding
offers — *"a lock representation/release protocol whose atomic filesystem operation cannot remove a
replacement owner (for example, a directory/token-sentinel design)"*, or *"revise the approved
contract"* — are outside what an implement step may decide. **74 insertions across 3 files.**

---

## 2. Major 2 — a create that succeeds and then fails leaves a lock nobody owns

### What was wrong

`acquireRunLock` wrapped the create, the write and the close in one `try`, and treated every
non-`EEXIST` failure the same way:

```ts
try {
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, …); } finally { fs.closeSync(fd); }
} catch (error) {
  if (errorProperty(error, 'code') !== 'EEXIST') { throw new FlowError(`… could not create …`); }
  …
}
```

An `ENOSPC` from `writeFileSync` therefore left a **zero-byte file at the lock path** and threw. The
next claim gets `EEXIST`, `readLockRecord` fails to parse it, and the refusal reads
*"is in the way and could not be read as a lock"*. That state is not recoverable by any run: the
ticket is held by a lock no process owns, and the recovery the whole design leans on — a human
deleting a file — is now required for a failure that had nothing to do with concurrency.

The reviewer is right that this is worse than the concurrent case it neighbours, because it needs
no second run at all.

### What shipped

`packages/core/src/run-history/writer.ts`. The create is separated from the initialisation, because
the two failures mean different things:

- **The create failing** is somebody else's file or an unusable path. Nothing to take back.
- **The create succeeding and the initialisation failing** means *this invocation, and nothing
  else, owns the pathname*. That is the fact that makes the take-back safe rather than a guess: no
  other run can be at that path, because the exclusive create is what proved it.

So the write and the close each record their own failure, the **write's is the one reported** (a
close that fails after a failed write is the consequence, not the cause), the file is unlinked
best-effort, and the refusal carries the original error. The unlink's own failure is deliberately
silent: the refusal already names the condition and the path, and a second sentence about a cleanup
tells a caller nothing it can act on.

Both `catch` blocks carry a comment saying why, per the comment rules; neither transcribes anything.

### Tests

`packages/core/src/run-history/writer.test.ts`, one test with two rows, sitting beside AC-10's
damaged-lock test because it is the distinction that test rests on: **a damaged file the claim
*found* is somebody else's and is left alone; one the claim *made* and could not finish is nobody's.**

Each row spies one syscall into failure and asserts four things — the refusal names
`could not create .quorum/locks/Q-0049.json`, it names `no space left on device` rather than the
cleanup, **the file is gone**, and **the ticket is claimable again**. The last is the one that
matters: without the take-back a later claim refuses as damaged, so asserting a successful re-claim
is asserting the defect is closed rather than that a file was tidied.

### Shown red before green

Two mutations, each reverted, each with its own signature:

| mutation | what went red |
| --- | --- |
| the `fs.unlinkSync(file)` take-back removed | `the write left a lock behind that no run holds: expected true to be false` |
| the close's `catch` removed, so a close failure escapes uncaught | `the close did not refuse: expected 'no space left on device' to contain 'could not create .quorum/locks/Q-0049…'` |

The second exists because the first row throws and ends the loop, so the write mutation alone never
exercises the close row. **Each row is demonstrated to have a subject on its own**, which is
Q-0071's point that showing a guard fires is not showing that each of its clauses does.

---

## 3. Major 1 — refused, with the authority named

### The finding is correct, and I am not disputing it

`release` reads the file, compares the token, then unlinks by pathname. Those are two syscalls.
A human clearing the lock and a successor claiming it **between** them leaves the first run
deleting the second run's lock — and then a third run can claim while the second is live, which is
the collision the ticket exists to close.

### Why I cannot close it

**The remedy is the lock's representation, and the representation is a landed decision.**
*"A run holds a lock on its ticket, and a stale one refuses rather than being reclaimed"*
(2026-09-09) states it in its own words:

> **It is one file under `.quorum/`, created by one exclusive syscall.**

and spends a paragraph of *Alternatives considered* on the representation question, refusing a git
ref on *"Files are the database"* and on the shipped `EEXIST` idiom. A directory-with-sentinel is
not one file created by one syscall. `.claude/rules/docs-and-decisions.md` is explicit that a landed
entry is never contradicted silently — reversing one is a new entry — and a decision entry is the
one artifact this role may not write. The requirement's §6 says the same thing from the other side:
**codex's AC-21 was struck for stating a decision entry as an acceptance criterion**, under *"A
requirement may not name a surface its flow cannot write"* (2026-08-25).

The finding's second remedy, *"revise the approved contract before implementation"*, is a
requirements change. That is a gate, not a round — *"A refused finding is a gate, not another
round"* (2026-08-31), and *"the window for an erratum is a gate"* (Q-0094 E-3).

Two further sites fix the same shape and both are the human's: AC-2 names the path
`<LOCK_ROOT>/<ticket-id>.json`, and `docs/GLOSSARY.md`'s **Run lock** entry — written to AC-13 and
backed by the decision — opens *"One file, `.quorum/locks/<ticket-id>.json`"*.

### What I measured before refusing, because a refusal is only safe if it is checked

**There is no atomic compare-and-delete for a file at a fixed path.** Node's `fs` exposes none, and
POSIX has no `unlink` variant conditioned on content or on a held descriptor. Every arrangement I
could construct within *one file, one exclusive syscall* narrows the window without closing it:

- **Compare inode through a held descriptor** (`fstat` the claim's fd against `stat` of the path)
  replaces a read-and-parse with one `stat`. Narrower, still `stat`→`unlink`, still racy — and it
  would mean holding a descriptor open for the length of a run to buy nothing provable.
- **`rename` the lock aside, then inspect, then unlink or restore.** The rename is atomic and the
  *ours* branch becomes genuinely race-free. The *not ours* branch is worse than today: it takes a
  successor's lock out from under it on **every** occurrence rather than on a race, and the
  `link`-back can fail with `EEXIST` once a third run has claimed the freed path.
- **The link-plus-temp-file protocol** is refused by name in the requirement's own M-7.

**And the design the finding suggests does not fully close it either.** A directory
`.quorum/locks/<id>/` claimed with a non-recursive `mkdirSync`, holding a record named
`<token>.json`, is a real improvement: the token is in the *pathname*, so an unlink can only ever
remove this run's own record and no check is needed at all. What remains is the directory's
lifecycle — a `rmdir` after a successful unlink can still remove a successor's directory in the
one-syscall window between that successor's `mkdir` and its record write. That is much narrower than
today and much narrower than the finding implies, and it is not zero. **This is reasoning about the
syscall sequence, not an experiment**, and I am stating it that way rather than presenting it as
measured.

So the honest summary for the gate is: the finding names a real residual, its own suggested design
reduces that residual rather than eliminating it, and the trade is a representation change that
three artifacts — one of them a landed decision entry — currently settle the other way.

### What I did instead

`RunLock.release`'s JSDoc claimed the guarantee flatly. **It now states the bound**, because a
contract comment that promises more than the code delivers is the failure this repository keeps
finding:

> **The ownership check and the removal are two syscalls, and the guarantee is bounded by that.** A
> replacement that is already on disk when release begins is seen and left alone, which is the case
> a human clearing a lock mid-run produces. A replacement written between the check and the removal
> is not, and no compare-and-delete that cannot be interleaved exists for a file at a fixed path —
> closing the remainder means a different representation […]

The claim moved rather than the route, which is what Q-0083's own round 1 did with the flow comment
that promised what the diff could not honour. **No behaviour changed** and no assertion moved:
AC-5's *Test:* clause asks for *"one row where the file was replaced under the run, asserting the
replacement survives"*, and that row is sequential — it passes today and would pass under any of
the designs above.

### Three readings the gate can take, stated so it does not have to derive them

1. **An erratum bounding AC-5** — the ownership check is what the criterion requires, the
   interleaved case is outside it, and the JSDoc above is the record. Nothing further changes.
2. **A new decision entry** naming 086 and moving the representation to a directory whose record is
   named by the token. That is a `shared` constant change, a `core` rewrite of claim and release,
   the glossary entry, and the AC-2/AC-10 wording. Best guess at size: a small ticket, not a round.
3. **`advance`**, taking the residual as accepted, with the JSDoc as its written record.

I am not recommending among them, because choosing is the ruling itself.

---

## 4. File by file

### `packages/core/src/run-history/writer.ts` (+38 / −6)

- `acquireRunLock`'s create is separated from its initialisation, with the take-back and the
  original-failure rule described in §2.
- `RunLock.release`'s JSDoc gains the bound described in §3. **The code is unchanged.**

### `packages/core/src/run-history/writer.test.ts` (+35)

One test, two rows, described in §2. It sits inside the existing
`Q-0039 AC-2/AC-7/AC-10` describe rather than a new one, because it is the same subject as the
damaged-lock row above it and reuses that block's `claimIn`, `lockFileOf` and `collector`.

### `packages/core/src/turbo-inputs.test.ts` (+1)

One `READ_BASES` entry for `after.path`, the handle of the re-claim that proves the ticket is still
claimable. Q-0072's guard refused the change until it was registered and named the base in its
failure — the machinery working as designed, and the only register this round moved.

---

## 5. Deliberately left alone

- **Everything from iteration 1 that no finding touched.** No criterion was re-litigated, no
  neighbouring code was tidied, and the thirteen non-goals are all still non-goals.
- **`initialiseRunHistory`'s own create.** It has the same shape — an exclusive `mkdirSync`
  followed by writes that can fail — and the same class of leftover. No finding names it, it
  predates this ticket, and widening the fix into it is the scope creep the role forbids. **Reported
  here, not repaired.**
- **`runIdOf`'s unvalidated ticket id** and **`writer.ts`'s in-`core` imperative in the run-directory
  refusal** — both still registered in comments as AC-3 and AC-7 require, both untouched.
- **The pre-existing lint warning** at `packages/core/src/backlog/backlog.ts:330`
  (*"Unused eslint-disable directive"*). Not in my diff, `pnpm lint` exits 0, reported again for the
  same reason as last round.
- **AC-12's two guards.** `run-history.source.test.ts:259` and `:320` are byte-identical in this
  diff; nothing this round added an export, a type, or a `.quorum` literal.

---

## 6. Verification

- `pnpm turbo run lint typecheck test --force --continue` — **21/21 tasks, 0 cached.**
  1444 core (2 skipped, pre-existing) + 621 cli + 166 shared, all green.
- `pnpm sweep:git-identity` — **green**, the workspace suite executed with no resolvable git
  identity, run from this linked worktree.
- `pnpm turbo run build --force` — 3/3; `pnpm exec quorum lint` reports **6/6 flows** through the
  built binary.
- The two mutations in §2, each reverted.

**Not done, stated rather than implied.** GO-3's both-row verification and GO-4's CI check remain
the human's at the merge, as the requirement says. As last round, I could not probe the refusal by
hand in a throwaway repository — the sandbox refuses writes outside this worktree — so the
built-binary evidence is AC-11's fixture.

---

## 7. Why the verdict is `blocked` rather than `proceed`

Major 2 is shipped and I would answer `proceed` for it alone. Major 1 is unchanged and unchangeable
by me: the next review round would meet the same code, raise the same finding, and cost a round that
cannot converge — the pattern this repository has now priced twice, at $14.28 on Q-0091 and $31.16
on Q-0101, both times because an implement step that had proved something had only prose as a
channel. Q-0083 exists so it does not have to be prose. The authority I am appealing to is
*"A run holds a lock on its ticket, and a stale one refuses rather than being reclaimed"*
(2026-09-09), whose *"one file under `.quorum/`, created by one exclusive syscall"* is what both of
the finding's remedies would overturn, and which only a new entry may move.

**If the gate answers `advance`, the change on this branch is complete and green as it stands.**
