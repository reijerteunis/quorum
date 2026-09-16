Implement report — Q-0127, chore run 2, iteration 4
===================================================

A revision round. Review iteration 3 returned **one major**, in `packages/server/src/read.test.ts`,
and it is correct as reported. It is fixed, with the case that stages it and four mutations that
show it red for its own sake. Nothing else moved.

**Verdict: proceed.** Nothing here needed a `docs/decisions/` entry, a file outside my paths, or
behaviour a landed decision preserves.

The change is **one file and 67 insertions**, against iteration 1's 23 files and ~2,214,
iteration 2's 2 and 172, and iteration 3's 3 and 267. **`packages/server/src/read.ts` is
byte-identical to `HEAD`** — `git diff --stat` names one file — and that is the shape of the fix
rather than an omission: what the finding named is a shipped behaviour with no check that could fail
on it, not a behaviour that was wrong.


The finding
-----------

> The test titled *"a file that stops being one between the listing and the read is 404"* does not
> stage that condition: it deletes the file before starting the request and then asserts
> `400 not-a-file-path`. Consequently the `readTicketFileBytes(...) === null` → `404 no-such-file`
> branch required by AC-5 remains untested … Introduce a controllable seam or filesystem
> interleaving … rename or retain the current test separately for the pre-request absence case.

Accepted in full, including the remedy's shape. The test asserted 400 under a title promising 404,
and the two lines of prose under it said the arm could not be staged *"without interleaving the
two"* — which read as a reason and was an assumption.

### What the three previous rounds got wrong, stated precisely

Iterations 1, 2 and 3 each carried this forward as *"the `no-such-file` 404 arm has no test that can
stage it"*. **That claim is true of one thing and false of another, and the two were run together.**

It is true of **filesystem state**, and I measured why before reaching for a seam. The listing skips
any name whose `stat` is not `isFile()` (`backlog.ts:374`), and the read answers `null` for `ENOENT`,
`ENOTDIR` and a descriptor that does not `fstat` as a file. Every shape that might have sat between
them was checked: a symlink to a regular file lists as a file **and** opens as one; a symlink to a
directory, a FIFO and a socket are all skipped by the listing before the read is reached; a dangling
symlink is refused by `pathInside` and never listed. **So there is no state of the disk that a
request can find in which a path both survives the listing and reads as nothing** — which is what
makes a seam *necessary* here rather than convenient, and it is the half the earlier reports were
right about.

It is false of the listing's own **measurement**, which is the other entrance and the one nobody
looked for. `listTicketFiles` observes each file by `stat`; the moment that observation returns, the
listing's answer about that file is already fixed and the file itself is no longer load-bearing. That
is a seam in the production path's own timeline, and it is exactly the *"removes the file after
`listTicketFiles` includes it but before the byte read"* the review asked for.

*A search that did not look is not a measurement that found nothing* (2026-09-10) — three rounds
reported an absence of instruments rather than the result of looking for one.


What was written
----------------

### The retained test, renamed to what it covers

`a file removed BEFORE the request is refused at membership, and never reaches the read`

Kept as the review directed, scoped to the pre-request case and no longer claiming anything about
404: a file that has gone has left this request's own listing too, so membership stops it and the
byte read is never asked. Its two lines of false prose are gone. Its fixture path is
`review/removed-first.md` rather than `review/doomed.md`, so the two tests name what they are about
and a reader meeting one does not have to work out which window it is in.

### The new test, which stages the arm

`a file that stops being one between the listing and the read is 404, not 400`

```
const realStatSync = fs.statSync;
const staged = { listedBytes: -1 };
const stat = vi.spyOn(fs, 'statSync').mockImplementation(
  (...args: Parameters<typeof fs.statSync>) => {
    const answer = realStatSync(...args);
    if (staged.listedBytes < 0 && String(args[0]) === abs) {
      staged.listedBytes = Number(answer?.size ?? -1);
      fs.rmSync(abs);
    }
    return answer;
  });
```

**What is faked is the moment of a real removal, and nothing else.** The stat is the real one and its
answer is returned unaltered, so the listing names the file with the true size it has just read; the
removal is a real `rmSync` on a real file; and everything after it is unmocked production code — the
membership test passes against a listing that was true when it was taken, `readTicketFileBytes` opens
a name with nothing at it and gets a real `ENOENT`, and the route maps the resulting `null` onto 404.
The line the criterion is about is executed rather than reasoned about.

**The seam reaches the listing and nothing else on this path**, which was checked rather than hoped:
`pathInside` resolves through `realpathSync` and `lstatSync`, and the only other `statSync` in the
request is `isFolderIn`'s, on the ticket **directory**. The guard `staged.listedBytes < 0` makes the
removal happen once, so a second look at the same name is measured and left alone, and the wrapper
stays transparent for every other caller.

**Three clauses, and each answers a different question.** `staged.listedBytes` being the real 5 says
the staging happened where the test claims and that the listing **named** the file rather than
skipping it — without it, a seam that silently stopped matching would leave the file on disk and the
test would read as a 200/404 mismatch with no cause. The status says membership passed, because 400
is what a path that had left the listing gets, which is the test above. The code says the route chose
this arm and not another with the same status.

Four smaller things, recorded because a reader will otherwise re-derive them:

- **`vi.spyOn(fs, …)` reaches across the package boundary** because `backlog.ts` does
  `import fs from 'node:fs'` — the default import of the builtin — so the test and `core` mutate one
  object. Verified by running it, not assumed.
- **The arguments are forwarded whole** rather than re-declared. That keeps the delegation
  transparent for every overload, and it avoids naming `fs.StatSyncOptions`, which
  `@typescript-eslint/no-deprecated` refuses at error severity — the first draft named it and `pnpm
  lint` said so.
- **`staged` is an object rather than a `let`**, because a `let` assigned only inside a callback is
  narrowed to its initialiser at every later read, and `expect(x).toBe(5)` on a `null`-narrowed
  binding is a type error rather than a test.
- **The spy is restored in a `finally`.**

### Why the mapping is asserted here and not one layer down

`core` already covers both reasons the read answers `null` — `backlog.test.ts:772` an absent file and
`:773` a directory — over its own boundary. What only this seam can reach is the route's translation
of that `null` into a status, which is the line AC-5 is about and the one that was uncovered.


Shown red before green — four mutations, four distinct signatures
-----------------------------------------------------------------

Each applied alone, over the same tests, and reverted.

| mutation | red | signature |
| --- | --- | --- |
| the `null` arm collapsed into membership's refusal (`400 not-a-file-path`) — **the defect the criterion is about** | **1** of 37 | *"a file that survived the listing and not the read was not answered 404: expected 400 to be 404"* |
| the seam's `fs.rmSync` removed — **the test's own anti-vacuity check** | **1** of 37 | *"… expected 200 to be 404"* — the file is simply served |
| the seam aimed at a path the listing never measures | **1** of 37 | *"the listing never measured the file, so nothing was staged: expected -1 to be 5"* |
| the arm keeps 404 and answers under `not-a-file-path` | **1** of 37 | *"expected 'not-a-file-path' to be 'no-such-file'"* |

**Every row turns exactly one test red, and it is the new one** — so it is red for its own sake
rather than shown red by a neighbour, which is Q-0107's distinction between a guard that has been
established and one that has merely been observed failing beside another. Row 1 is the production
defect; row 2 says the test cannot pass vacuously; rows 3 and 4 say the two supporting clauses are
load-bearing rather than decorative. The four signatures are four different sentences, so a reader
who breaks one of them is told which.


File by file
------------

### `packages/server/src/read.test.ts` (+67 −9)

`vi` added to the vitest import. One test renamed and re-scoped to the pre-request case with its
false prose removed; one test added beside it, staging the interleaving. 36 tests → **37**.

Nothing else in the file moved, and no fixture, helper or shared assertion was touched.


What I deliberately left alone
------------------------------

- **All production code.** `read.ts`, `backlog.ts`, `wire.ts`, the barrel, `app.tsx`,
  `ticket-page.tsx` and every register are untouched — `git status` names one file. The finding is
  about a missing check, and a revision round that also moved the code under it would hand the next
  review a diff it cannot tell apart from the fix.
- **`fs.openSync` as the seam**, which was the other obvious place to intercept. It is the call whose
  behaviour is under test, so mocking it would have proved the test's own stub rather than the
  route's arm. The listing's `stat` is upstream of everything the criterion is about.
- **A production hook, flag or injected clock** to make the window reachable. Nothing in the
  requirement authorises one, and a seam that exists only for a test is a second code path the
  product carries forever.
- **The `no-such-file` sentence, its remedy and its status.** All three were already what §3's table
  asks for; what was missing was the test.
- **Everything iterations 1–3 shipped**, per the same reasoning as above, and **per-tab selection
  memory**, `billedCostOf`, `readFiles`, `dirOf`'s preserved prefix match, Q-0060's parser, and any
  cap, pagination or truncation (non-goal 7).
- The pre-existing `no-control-regex` lint warning in `backlog.ts`, measured as `HEAD`'s.


Still not covered — now one item rather than two, and the survivor is larger than recorded
------------------------------------------------------------------------------------------

**Item 2 of the previous three reports is closed by this round.** The `no-such-file` arm is staged
and asserted; the sentence *"a race no test can stage"* is gone from the suite, which was the only
place in `packages/` or `docs/` that carried it.

**Item 1 survives, and I re-measured it this round rather than transcribing it** — a measurement
copied from a document is not a measurement, and this one had been repeated three times unchecked.
Against the merged tree, through a throwaway probe deleted in the same round:

```
{ detail: 500, detailBody: "Internal Server Error",
  file:   500, fileBody:   "Internal Server Error" }
```

**It is one step larger than the earlier reports said.** They recorded that a dangling symlink inside
a ticket folder makes `GET /tickets/:id` answer 500. It also makes `GET /tickets/:id/file` answer
500 — for `ticket.md`, a path with nothing to do with the link — because membership is derived from a
fresh listing on every request, so **one unconfinable name makes every file of that ticket
unreadable**, not just the folder view.

The cause is correct behaviour one layer down: `pathInside` refuses a name that stands there and does
not resolve, which is the clause that stops an open following a link out of the folder, and
`listTicketFiles` refuses rather than skipping because AC-2 puts it on `readFiles`'s confinement,
which throws. What is missing is a **status**: §3's table has six codes and none is *this folder
holds a name I cannot confine*. I did not invent a seventh — extending that table is the
requirement's rather than an implementer's, and my role's instruction where a requirement does not
cover a case is to report it. Zero symlinks exist under `backlog/` today, so it is latent.


Verification
------------

Forced in this worktree, which has neither `.harness/worktrees` nor `.quorum/runs`:

- `pnpm install --frozen-lockfile` → *Already up to date*, 200 ms.
- `pnpm turbo run test typecheck lint --force --continue` → **21 successful, 21 total, 0 cached**,
  1 m 50 s.
- `pnpm turbo run build --force` → **5 successful, 0 cached**, 4.0 s.
- `pnpm exec quorum lint` → **6/6**.
- `pnpm sweep:git-identity` → *the workspace suite executed and green with no resolvable git
  identity*, 7/7 tasks 0 cached.
- `@quorum/server` alone: **209 tests, 9 files** — `read.test.ts` **37**.

The scratch probe used for the symlink measurement was deleted; `git status` names one modified file
and nothing untracked.


Notes for the reviewer
----------------------

**This round's diff is 67 insertions in one test file**, so R-2's truncation hazard does not reach
it; the whole change is the two tests quoted above.

The fastest way to check it is the mutation table. **Rows 1 and 2 are the pair worth running**: row 1
says the test fails when the production arm it names is wrong, and row 2 says it fails when the
staging that reaches that arm is removed. A test that passed under row 2 would be the defect this
repository records most, written into the fix for an instance of it.

The one judgement here that is genuinely mine and worth disputing if you disagree: the seam is
`fs.statSync`, a Node builtin spied from a test in another package. I took it because it is upstream
of every line under test and because the alternative — intercepting the read itself — would have
asserted the stub. If you would rather the window were unreachable than reachable through a builtin
spy, that is a requirement question about AC-5's last row rather than a repair, and it is the same
question the surviving uncovered item asks.
