# Q-0137 — implement report, run 2, iteration 3

*A revision round. Review round 2 returned **two majors and no blocker**; both were real, both are
fixed, and **each was demonstrated red by mutation before it was trusted green**. Verdict:
`proceed`.*

**183 insertions across 6 files.** Everything is green, forced, in this worktree:
`pnpm turbo run test lint typecheck --force --continue` → **21/21 tasks successful, 0 cached**;
`pnpm exec quorum lint` → **6/6**; `pnpm run sweep:git-identity` → *"the workspace suite executed
and green with no resolvable git identity"*. Nothing is committed and nothing is staged.

---

## 1 Major 1 — the listing ignored a query key where AC-6 says reject

> *`packages/server/src/read.ts:699` — `GET /history/:id/retained` ignores every query value,
> including `occurrence_dir`, while AC-6 explicitly requires both new routes to reject
> `occurrence_dir` as input under every spelling. The implementation report acknowledges and
> deliberately preserves this contradiction … If the intended contract is now to ignore such keys,
> obtain an erratum instead of changing the requirement in implementation.*

**Accepted, and the reviewer was right to refuse the argument.** Iteration 2 gave a principled
reason for the asymmetry — *that query selects and this one does not* — and it is a reason for
thinking the refusal is low value, not a reason for reading AC-6's *"both routes reject
`occurrence_dir` as an input under every spelling"* as *one route rejects and the other ignores*.
**Ignored is not rejected**: a client that sent one and was answered 200 has been told its request
was understood, which is the same sentence the file route stopped telling a round earlier.

Of the two ways out the finding offers, **an erratum is not one I can take** — the backlog is the
harness's and an implement step may not write `requirements/errata.md` — and it is not one that
should be taken here anyway: the criterion is satisfiable in four lines and the behaviour it asks
for is the better one.

**The fix is the accepted-key set the file route already declares, given to the listing as empty.**
`RETAINED_LISTING_QUERY` is `[]`, `unexpectedQuery` takes the accepted set as a parameter, and both
handlers check their own keys before anything else happens. **An empty set rather than an absent
check** is what makes the listing refuse a key, and it makes *"`occurrence_dir` is not an input
under any spelling"* one property of two routes rather than a register of four spellings somebody
maintains: `occurrenceDir`, `dir`, `path`, `Occurrence`, `occurrence`, `name` and
`anything-nobody-thought-of` are all refused by not being one of the names that route declares.

### The one judgement call, named rather than buried: the code moved

The unaccepted-key refusal now answers **`unknown-field`** on both routes, where the file route
answered `not-a-file-name`. Three reasons, and the first is this ticket's own:

- **One condition, one code.** Round 1 of this review fixed exactly this shape for `no-such-run` —
  `core` answered `not-a-run` and the listing route beside it answered `no-such-run`, so a client
  switching on the code had to know which route it had asked. Refusing a key on one route as
  `not-a-file-name` and on the other as anything else would have reintroduced it in the change that
  closes the finding.
- **`not-a-file-name` is nonsense on a route that takes no file name.** It was already a stretch on
  the file route, chosen to avoid a tenth row; on the listing it names a value the request cannot
  carry.
- **`unknown-field` is not coined.** `http.ts` answers it at two sites today for *the request
  carries a key this route does not accept*, in a body; a query is the same condition on the other
  key-value surface of a request. The message and remedy follow that site's shape — `the query
  carries "occurrence_dir", which this route does not accept` and `remove it; this route accepts
  occurrence, name` / `… accepts no query value`.

**It is not a tenth member of AC-5's nine.** Those nine answer for a malformed *value*
(`not-a-file-name`) or for what `core` found; an unaccepted *key* is refused before either is read,
and AC-5's table does not enumerate it. AC-6, which does require it, assigns no code. If a reviewer
reads AC-5's table as closed over every refusal this route can make rather than over the nine
conditions it lists, that is an erratum's subject and not something to work around — say so.

### The tests

- **`the listing refuses a key it does not accept, rather than answering 200 over it`** replaces
  iteration 2's clause that pinned the ignoring. It first asserts the plain listing answers 200 with
  occurrences, so the fixture is one that serves; then sends each of the four directory spellings
  plus `anything-nobody-thought-of` **and `occurrence` and `name`** — the file route's two, which
  this route accepts neither of, so a shared constant would have made the listing answer over a
  selection it cannot honour. Each is 400 `unknown-field`, the refusal **names the key**, does not
  quote back what the key selected, and its remedy says this route accepts none.
- **The two file-route clauses** keep their shape and move to the new code. The *beside* clause
  gains an assertion on the remedy, so the accepted set is named to a client rather than only
  checked internally.
- **The structural clause now counts two call sites** rather than matching one string:
  `unexpectedQuery(c.req.query(), RETAINED_*_QUERY)` must appear **twice**, so a fix that reached
  only the route that selects fails structurally as well as behaviourally.

**Shown red before green.** With the listing's check stubbed to `null`:

```
FAIL  the listing refuses a key it does not accept, rather than answering 200 over it
AssertionError: occurrence_dir was ignored rather than refused: expected 200 to be 400
FAIL  the handler reads no query key naming the occurrence directory, under any spelling
AssertionError: a retained route does not check the keys it was given: expected 1 to be 2
Tests  2 failed | 21 passed (23)
```

The defect in its own words, behavioural and structural, with the file route's twenty-one clauses
**green** under that mutation — so the new clauses discriminate rather than being shown red by a
neighbour.

---

## 2 Major 2 — a metadata error escaped the occurrence it belonged to

> *`packages/core/src/run-history/reader.ts:531` — `lstatSync` executes outside the surrounding
> error handling, so an entry-level metadata error such as `EACCES` or `EIO` throws out of
> `listRetainedFiles` and turns the entire listing request into a server failure.*

**Accepted in full, and the mechanism is exactly as reported.** `throwIfNoEntry: false` suppresses
`ENOENT` and **nothing else**, so every other error a per-entry `lstat` can raise — `EACCES` on a
directory that enumerates but will not stat, `EIO`, `ENOTDIR` where the parent stopped being a
directory — went straight out of `listRetainedFiles`, past `retainedIn`'s own `catch`, past the
route, into a 500 with a stack. Against a listing whose **entire** warnings channel exists so that
one refused occurrence does not cost a reader the other fifty-four, and against AC-4's *a run it can
partly read is partly answered*.

**The fix is the reviewer's: one error boundary for the enumeration and the measurement of what it
found.** The `readdir` and the loop sit in one `try`; the classification is unchanged, so an absent
or non-directory path is still `NO_DIRECTORY` and anything else is `unreadableDirectory(code)` —
**named by its error code alone, so no path is quoted back**, which the finding asked for and which
is also this route's rule for a value the client never supplied.

**It is the occurrence rather than the entry, and that is a choice with a reason.** Skipping the one
file it could not measure would leave a listing that is short and complete-looking, and a caller
cannot tell a file that is not there from one nobody could size. The whole occurrence becomes a
warning; everything else in the run still lists. The test pins both halves.

### What this widens, stated rather than left to be found

`retainedIn` is shared, so the same failure now reaches `readRetainedFile`, where a problem that is
not the confinement refusal answers **`not-an-occurrence-file`**. That is the treatment an
**unreadable directory** already had before this change — shipped, reviewed in round 1, and argued
in that function's own comment. What is new is that an entry-level metadata error joins it.

**I did not change it, and I am naming it because it is the weaker half of a landed comment.** For a
directory that enumerated nothing, *no name is one this occurrence holds* is a true sentence; for
one the operating system refused, *could not tell* is the honest answer and `not-an-occurrence-file`
says more than that. Closing it means a tenth outcome and a tenth code, which extends a table AC-5
declares closed — a ruling rather than a repair, and not one this finding asked for. The test
records it in place, so a reviewer rules it rather than discovering it.

### The test

**`a metadata error raised entry by entry is that occurrence's warning, not the run's failure`.** A
run with two occurrences; a hook makes `lstat` of one entry fail `EACCES`. It asserts the directory
**still enumerates** — which is what makes this the entry-level failure and not the directory-level
one two clauses above already cover — then that the answer is a listing, that the occurrence beside
it survives with its file named and sized, that the refused one is a warning naming `EACCES` and
**no path**, that it is not listed as having retained nothing, and that the read beside it answers
rather than throwing.

**Hooked rather than staged with a mode bit, and the reason is a landed decision.** A directory
chmodded `r--` enumerates and refuses its entries for everybody **except root, which reads it
anyway** — so the verdict would be a property of the account that ran the suite, which *"A test's
verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) forbids. The
condition is the operating system's to raise; what is under test is what this module does with it.
The hook's delegate, its opaque type and its one-shot reasoning are `stageOn`'s, for its reasons —
including that taking a read API as a **value**, type position included, is a shape
`turbo-inputs.test.ts` clause C4 reports rather than skips.

**Constructed, and it has to be (R-1):** every entry under every occurrence directory in this
repository's own store stats, so a fixture drawn from `.quorum/runs` would pass over an
implementation with no error boundary at all.

**Shown red before green.** With the `lstat` moved back outside the `try`:

```
FAIL  a metadata error raised entry by entry is that occurrence's warning, not the run's failure
Error: EACCES: refused by the hook
Tests  1 failed | 26 passed (27)
```

The error escapes `listRetainedFiles` entirely rather than failing an assertion, which is the defect
itself; twenty-six sibling clauses stay green.

---

## 3 File by file

| file | what changed |
| --- | --- |
| `packages/core/src/run-history/reader.ts` | `retainedIn`'s enumeration and measurement become one error boundary; a docblock paragraph stating the `throwIfNoEntry` mechanism, why the boundary is the occurrence and not the entry, and that the warning names a code and never a path. |
| `packages/core/src/run-history/retained.test.ts` | the `refuseOn` hook beside `stageOn`, and the entry-level clause above. 27 tests. |
| `packages/core/src/turbo-inputs.test.ts` | one `READ_BASES` row for the new clause's `inRun(root, 'steps/001-refused')`. Q-0072's guard refused the read until it was registered with its reason — the machinery working as designed, and the row says what that base is and why it is enumerated. |
| `packages/server/src/read.ts` | `RETAINED_LISTING_QUERY`; `unexpectedQuery` takes the accepted set and answers a `WireRefusal` under `unknown-field`; both handlers check their own keys first. The docblock's asymmetry paragraph is replaced by the ruling. |
| `packages/server/src/retained.test.ts` | the listing's refusal clause replaces the ignoring clause; two file-route clauses move to the new code and one gains a remedy assertion; the structural clause counts two call sites. 23 tests. |
| `docs/04-architecture.md` | *"by two different mechanisms rather than one"* becomes one mechanism and names the shared code and why it is shared; the `failSoftly` sentence gains the clause that the property holds for a directory refused **while it is being read**, entry by entry. AC-14's five asserted needles are untouched and still pass. |

---

## 4 What I deliberately left alone

1. **No new refusal code, no new wire field, no schema change, no new route.** Both fixes are
   behaviour behind the five shapes AC-9 declares and the two routes AC-4 and AC-5 describe.
2. **`readRun` is unchanged**, still *"a cast, never a check"*; a traversing `occurrence_dir` is
   still reported by `GET /history/:id` exactly as it sits on disk, and nothing repairs a manifest.
3. **The `not-an-occurrence-file` widening is reported and not closed** (§2), being a tenth outcome
   and a ruling rather than a repair.
4. **`RETAINED_REMEDY` stays on the rows that had it.** The unaccepted-key refusal carries the
   accepted set instead, which is `http.ts`'s remedy for the same condition; telling a reader to ask
   the run for its retained files is advice about a request they have not made yet.
5. **Nothing else in the branch moved.** No tidying, no register renumbered, no criterion re-opened
   — the diff is the two fixes, their tests, one earned register row, and the two document sentences
   this change makes false.

---

## 5 Gate obligations

- **GO-1 — discharged, unchanged from iteration 1.** E-1 ratifies OQ-1; I did not treat it as live
  and wrote no `docs/decisions/` entry.
- **GO-2** — fourteen criteria, not split, nothing trimmed.
- **GO-3 — nothing owed.** `contracts/` is untouched and outside this role's paths.
- **GO-4 — owed, and the measurement is worse than last round's.** The branch diff is **287,398 B**
  against the 200,000-byte cap, so a round-3 reviewer sees **69.6%** of it. Round 2 reported no
  patch at all for six files — `packages/server/src/package.test.ts`, `read.ts`,
  `retained.test.ts`, `packages/shared/src/docs-retained.test.ts`, `wire-retained.test.ts`,
  `wire.ts` — and `git diff` orders by path, so the same alphabetical tail is cut again and the
  branch has only grown. **Both of this round's source edits are in that tail**:
  `packages/server/src/read.ts` and `packages/server/src/retained.test.ts`, which are Major 1's fix
  and its tests. A reviewer judging Major 1 should read them off `harness/Q-0137/implement`
  directly rather than from the stat, as rounds 1 and 2 both did. *The per-file cut point could not
  be computed in this worktree — the tools that would have done it are outside what this step may
  run — so what is stated is the total, the share, the path ordering and round 2's own measured
  list, rather than a guess dressed as a measurement.*
- **GO-5 — the human's.** It requires running the product against a real daemon and transcribing
  what it rendered.
- **GO-6 — one row done here.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`
  and is green forced at 21/21 tasks, 0 cached. The `main`-after-merge row is the gate's.

---

## 6 Verification

| check | result |
| --- | --- |
| `pnpm turbo run test lint typecheck --force --continue` | **21/21 tasks, 0 cached** |
| `pnpm exec quorum lint` | **6/6** |
| `pnpm run sweep:git-identity` | green, 7/7 tasks 0 cached, *"no resolvable git identity"* |
| mutation — the listing's key check stubbed | 2 red, discriminating, 21 green |
| mutation — the `lstat` moved back outside the `try` | 1 red, the error escaping the function, 26 green |
| `git status` | six modified files, nothing staged, nothing untracked |
