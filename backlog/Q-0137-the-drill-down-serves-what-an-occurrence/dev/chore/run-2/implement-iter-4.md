# Q-0137 — implement report, run 2, iteration 4

*A revision round. Review round 3 returned **one major and no blocker**, and
`requirements/errata.md` **E-5** ruled it at the exhaustion gate before the `retry` was answered.
The finding is accepted in full, the authorised row is taken, and **both directions of the
distinction were demonstrated red by mutation before either was trusted green**. Verdict:
`proceed`.*

**229 insertions across 5 files.** Everything is green, forced, in this worktree:
`pnpm turbo run test lint typecheck --force --continue` → **21/21 tasks successful, 0 cached**;
`pnpm exec quorum lint` → **6/6**; `pnpm run sweep:git-identity` → *"the workspace suite executed
and green with no resolvable git identity"*. Nothing is committed and nothing is staged.

---

## 1 The major — a refused enumeration answered as a proven absence

> *`packages/core/src/run-history/reader.ts:635` — `readRetainedFile` maps every non-confinement
> `retainedIn` failure — including `EACCES` or `EIO` while enumerating or measuring the occurrence
> directory — to `not-an-occurrence-file`. That outcome and AC-5's corresponding 400 code assert
> that the name was not in this request's own listing, but here no listing could be derived.*

**Accepted in full, and it is the class this repository has spent two tickets removing** — *"A probe
that could not answer is not a negative"* (2026-09-10), which **AC-4 of this ticket's own document
cites by name** for the route one level up. Iteration 3 registered the widening in the test's own
comment rather than closing it, on the ground that a tenth outcome extends a table AC-5 declares
closed and is a ruling rather than a repair. **E-5 made that ruling**, so this round is the one more
traversal the `retry` grants and the erratum reaches the implement step through the file that step
reads.

Three things E-5 names made it a carry rather than an invention, and all three were verified in the
tree before anything moved: `retainedIn` **already computed** `missing = code === 'ENOENT' || code
=== 'ENOTDIR'` and discarded it one line later; the **listing route already keeps** both sentences,
`listRetainedFiles` pushing the message verbatim into `warnings`; and `readRetainedFile`'s own JSDoc
states the rule it broke — *"a file this process may not open is not a file that is not there"* —
and applied it to the `open` and not to the `enumerate`.

### The shape: a reason travels, not a flag

`OccurrenceFiles` carried `{ unsafe: boolean; message: string }`, and a boolean says *confinement or
everything else* while everything else holds two conditions that are not one. It now carries a
four-member `OccurrenceProblem` — `not-a-path`, `outside-run`, `no-directory`, `unreadable` —
and `readRetainedFile` maps it through `REFUSAL_FOR`, a `Record` over that union, **so a fifth
reason fails to compile rather than falling through to an outcome nobody chose**. That is
`RETAINED_REFUSAL`'s own construction one package up, which is why it is the shape used here.

**Two reasons keep `not-an-occurrence-file`, and the reason is the finding's own reasoning rather
than an exemption.** A directory that is **absent** and one the manifest **never named** each
establish that this occurrence holds no file of any name — a true sentence about the name that was
asked for, reached by evidence. A directory the operating system **refused** establishes nothing:
no enumeration happened. E-5's clause is that the new row *"may never be answered as
`not-an-occurrence-file`, `no-such-occurrence` or `no-such-file`, each of which asserts an absence
that was not established"*, and those two do establish one.

### The spelling and the status, which E-5 explicitly does not pin

**`422 unreadable-occurrence-directory`**, E-5's recommendation, taken rather than departed from:
`unsafe-occurrence-directory`'s status and shape, because both say the store is in a state that
prevents an answer and neither blames the client. Its `remedy` is **`null`** for the same reason the
confinement row's is — telling a reader to re-ask a run for a listing that will warn about this very
occurrence is not advice. The table's docblock moves from *"three rows have none"* to four, and
enumerates the fourth.

### The tests, and one deviation stated rather than buried

**`packages/core/src/run-history/retained.test.ts`** gains
*"a directory the operating system REFUSES is its own outcome, and an absent one still is not"*,
**staged rather than hooked** as E-5 asks: `chmod 0o000` on a real occurrence directory, which is a
mode a real store can carry. Its premise is a capability of the environment rather than of the
commit, so it is **probed** and reports a skip where the probe fails — running as root, where a mode
of 0 stops nothing — on *"A test's verdict is a property of the commit, not of the checkout or the
account"* (2026-08-30). That is `backlog.test.ts`'s own mode-0 case and `git.test.ts`'s ownership
case, both in this repository. **The skip is a lost fixture rather than a hole**: the hooked
entry-level clause above it reaches the same outcome with no capability at all, which is the
distinction `git.test.ts:761` already draws for its own skip. The mode is restored in a `finally`
covering the skip, because `removeTempDirs` cannot delete a directory it may not enumerate.

**Both halves are asserted in one clause**, which is E-5's *"the two are asserted apart rather than
one being asserted alone"*: the refused directory answers the new outcome, the absent one beside it
still answers `not-an-occurrence-file`, and the listing over the same store answers with both
warnings told apart by their sentences and neither quoting a path.

The **hooked entry-level clause** from round 2 moves with it: its read now asserts
`unreadable-occurrence-directory`, and its comment says the widening it registered is what E-5
closed rather than leaving a reader to reconcile two accounts.

**`packages/server/src/retained.test.ts`** gains *"AC-5's tenth row"* — 422, the code, the condition
naming the condition, a `null` remedy, no repository path quoted, the absence row asserted apart,
and the listing still 200 over both. **It is a clause of its own rather than an entry in the
row-by-row table, and the deviation is deliberate**: its fixture needs the capability above, and a
`ctx.skip` inside that loop would take the other nine rows with it where the suite runs as root. The
table carries a comment saying so, so a reader meeting the nine knows where the tenth is and why.
A requirement describes what must be conveyed (Q-0094 E-3); if a reviewer reads E-5 as requiring the
row inside the loop, that is an erratum's subject rather than something to work around.

### Shown red before green, in both directions

**The collapse restored** (`unreadable → 'not-an-occurrence-file'`):

```
FAIL  a metadata error raised entry by entry is that occurrence's warning, not the run's failure
AssertionError: the read threw instead of answering:
  expected 'not-an-occurrence-file' to be 'unreadable-occurrence-directory'
FAIL  a directory the operating system REFUSES is its own outcome, and an absent one still is not
AssertionError: a directory nobody could enumerate was answered as a name this occurrence never held:
  expected 'not-an-occurrence-file' to be 'unreadable-occurrence-directory'
Tests  2 failed | 26 passed (28)
```

…and on the transport, under the same mutation:

```
FAIL  AC-5's tenth row: a directory this process cannot enumerate is 422 under its own code
AssertionError: a directory nobody could enumerate was not 422: expected 400 to be 422
Tests  1 failed | 23 passed (24)
```

**And the other direction, which is what proves this is a distinction rather than a rename** — the
absence widened into the new outcome (`no-directory → 'unreadable-occurrence-directory'`):

```
FAIL  an occurrence whose directory is absent holds no name at all, rather than refusing as unsafe
AssertionError: expected 'unreadable-occurrence-directory' to be 'not-an-occurrence-file'
FAIL  a directory the operating system REFUSES is its own outcome, and an absent one still is not
AssertionError: an absent directory stopped answering as an absence:
  expected 'unreadable-occurrence-directory' to be 'not-an-occurrence-file'
Tests  2 failed | 26 passed (28)
```

Each mutation names the defect in its own words with its siblings green, so the clauses discriminate
rather than being shown red by a neighbour.

---

## 2 File by file

| file | what changed |
| --- | --- |
| `packages/core/src/run-history/reader.ts` | `OccurrenceProblem` and `REFUSAL_FOR` beside `OccurrenceFiles`; `retainedIn` returns the reason it already computed; `readRetainedFile` maps through it; `RetainedFileRead` gains `unreadable-occurrence-directory` with its own JSDoc line and the union's docblock states why it is never collapsed with the two absences, citing the 2026-09-10 entry and E-5 in one line apiece. |
| `packages/core/src/run-history/retained.test.ts` | the `enumerable` probe helper; the new staged clause; the hooked entry-level clause's read expectation and its comment. 29 tests. |
| `packages/server/src/read.ts` | one `RETAINED_REFUSAL` row; the table's docblock gains the paragraph naming the class and E-5, and its remedy and outcome counts move. |
| `packages/server/src/retained.test.ts` | the `enumerable` probe helper; AC-5's tenth-row clause; one comment in the row-by-row test saying where the tenth row is and why. 24 tests. |
| `docs/04-architecture.md` | *"Eight refusals"* → **nine**, the new one enumerated with its status, and one sentence saying it is never collapsed with the two that assert an established absence. AC-14's five asserted needles are untouched and still pass. |

---

## 3 What I deliberately left alone

1. **AC-1 and AC-4 are unchanged**, which is E-5's own clause: the listing's warnings channel
   already carried both sentences and `unsafe` — now `outside-run` — is still the only reason that
   selects the confinement refusal. A test asserts the listing over the staged store.
2. **No other refusal moved**, no wire field, no schema, no route, no browser change. The browser
   renders the daemon's own `condition` for a refused file, so a new code needs no new sentence
   there; the four request states are AC-11's and are untouched.
3. **`readRun` is unchanged**, still *"a cast, never a check"*, and a traversing `occurrence_dir` is
   still reported by `GET /history/:id` exactly as it sits on disk. Nothing repairs a manifest.
4. **The `output.txt`-as-a-directory defect is not fixed** (§6 non-goal 10), and E-3's read-side
   contract note is unchanged and needs nothing: it enumerates no refusal codes.
5. **Nothing else in the branch moved.** No tidying, no register renumbered, no criterion re-opened
   — the diff is the one fix, its tests, and the document sentence this change makes false.

---

## 4 Gate obligations

- **GO-1 — discharged, unchanged from iterations 1–3.** E-1 ratifies OQ-1; I did not treat it as
  live and wrote no `docs/decisions/` entry. E-5 is read as the ruling it is: the tenth row is
  authorised, so `blocked` on AC-5 enumerating nine conditions would have been wrong.
- **GO-2** — fourteen criteria, not split, nothing trimmed.
- **GO-3 — nothing owed.** `contracts/` is untouched and outside this role's paths; the Q-0011
  read-side note E-3 landed states no refusal code and is unaffected.
- **GO-4 — owed, and measured.** The branch diff is **299,508 B** against the 200,000-byte cap, so a
  round-4 reviewer sees **66.8%**. Nineteen of 26 files get a patch — the nineteenth,
  `packages/core/src/run-history/run-history.source.test.ts`, cut mid-patch — and **seven get none
  at all**: `packages/core/src/turbo-inputs.test.ts`, `packages/server/src/package.test.ts`,
  `packages/server/src/read.ts`, `packages/server/src/retained.test.ts`,
  `packages/shared/src/docs-retained.test.ts`, `packages/shared/src/wire-retained.test.ts`,
  `packages/shared/src/wire.ts`. **Both of this round's server edits are in that tail**, so the new
  refusal row and its tests should be read off `harness/Q-0137/implement` directly, as rounds 1, 2
  and 3 each did. This round's **core** edits are inside the cut. Measured with
  `git diff harness/Q-0137/integration` over this worktree, which is what the commit will carry;
  the engine's own invocation may differ marginally in options, so the share is stated as measured
  rather than as the engine's own figure.
- **GO-5 — the human's.** It requires running the product against a real daemon and transcribing
  what it rendered.
- **GO-6 — one row done here.** This worktree has neither `.harness/worktrees` nor `.quorum/runs`
  and is green forced at 21/21 tasks, 0 cached. The `main`-after-merge row is the gate's.

---

## 5 Verification

| check | result |
| --- | --- |
| `pnpm install --frozen-lockfile` | *Already up to date*, 194 ms |
| `pnpm turbo run test lint typecheck --force --continue` | **21/21 tasks, 0 cached** |
| `pnpm exec quorum lint` | **6/6** |
| `pnpm run sweep:git-identity` | green, 7/7 tasks 0 cached, *"no resolvable git identity"* |
| mutation — the collapse restored in `REFUSAL_FOR` | core 2 red / 26 green, server 1 red / 23 green, each discriminating |
| mutation — the absence widened into the new outcome | core 2 red / 26 green, discriminating |
| the staged mode-0 fixture | discriminated on this machine: 29 core tests and 24 server tests passed, **0 skipped** |
| `git status` | five modified files, nothing staged, nothing untracked |
