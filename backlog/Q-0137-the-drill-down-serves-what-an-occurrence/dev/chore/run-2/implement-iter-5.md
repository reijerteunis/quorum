# Q-0137 — implement report, run 2, iteration 5

*A revision round. Review round 4 returned **one blocker and no major**, and
`requirements/errata.md` **E-6** ruled it at the second exhaustion gate before any answer. The
finding is accepted in full, the remedy E-6 names is reused rather than designed, and it was
**demonstrated red against round 4's own open** before it was trusted green. Verdict: `proceed`.*

**143 insertions across 5 files.** Everything is green, forced, in this worktree:
`pnpm turbo run test lint typecheck --force --continue` → **21/21 tasks successful, 0 cached**;
`pnpm exec quorum lint` → **6/6**; `pnpm run sweep:git-identity` → *"the workspace suite executed
and green with no resolvable git identity"*. Nothing is committed and nothing is staged.

---

## 1 The blocker — a replaced parent was followed, because the flag governs the last component

> *`packages/core/src/run-history/reader.ts:684` — the file is opened through `found.directory`
> after `pathInside` validated that pathname and `retainedIn` enumerated it. If the occurrence
> directory is replaced with a symlink between enumeration and this open, the intermediate symlink
> is followed; `O_NOFOLLOW` protects only the final file component.*

**Accepted in full, and reproduced before it was believed.** With round 4's code in place, a fixture
that swaps the occurrence *directory* for a link to a sandbox holding a file of the same leaf name
answers `outcome: 'file'` carrying the outside bytes. AC-3 is this ticket's one security property and
is named not eligible for trimming; the leaf case was closed and the parent case was not.

**The remedy is not mine to invent and AC-2 already asked for it.** That criterion says the read is
*"`readTicketFileBytes`'s discipline, **which is Q-0122's TOCTOU fix reused rather than
re-derived**"*. Round 4 reused the file-level half and stopped at the parent — which
`packages/server/src/static.ts`'s module docblock names, in as many words:

> *"A replaced **parent** is why this is an identity comparison rather than an `O_NOFOLLOW` open —
> that flag governs the last component only, and Node exposes no `openat` to walk the rest."*

So the shape is shipped in this repository and was reused rather than designed, which is what E-6
asks for. Here it is nearly free: `retainedIn` already `lstat`s every entry and reads `.size` off the
result, so the identity is on the `Stats` object it already holds, and the read path already `fstat`s
its descriptor — what was missing was carrying the identity across and comparing it.

### The shape: the identity travels with the entry, and stops at the module's edge

`retainedIn`'s per-entry `lstat` runs with `{ bigint: true }` — for the **identity's** sake rather
than the size's, an inode being a 64-bit number `Number` cannot hold on every filesystem — and each
entry becomes a module-private `RetainedEntry`, `RetainedFile` plus `dev` and `ino`.
`readRetainedFile` finds the member by name, opens once, `fstat`s the **descriptor**, and refuses
unless `isFile()` and both numbers match. So a leaf replaced by a link, a parent directory replaced
by one, and a file moved away with another put in its place are one answer: a different file from the
one the enumeration approved.

**`RetainedEntry` is deliberately not `RetainedFile`, and the projection is one line.**
`listRetainedFiles` maps each entry back to `{ name, bytes }`, so no identity reaches a caller, the
wire shapes are untouched and a listing does not tell a browser about the disk. It is module-private
for the same reason, which is why the JSDoc field walk in `run-history.source.test.ts` stays at
**70** rather than moving — the lock record's case, and that comment now says so rather than leaving
a reader to find a fourth interface in `reader.ts` unaccounted for.

**No new outcome and no new code.** A mismatch is `no-such-file`, which is `static.ts`'s own answer
(404) for the same condition and which that outcome's JSDoc already covered in substance — *"It was,
and nothing regular stands at it now"*, now widened to say *the file that was enumerated is not what
opened*. E-6 states that nothing in AC-3 moves and no criterion is superseded; an eleventh outcome
would have extended a table E-5 had just closed at ten, which is a ruling rather than a repair.

### `O_NOFOLLOW` is kept, and what that is worth is measured rather than asserted

**Neutralised, every one of `retained.test.ts`'s 29 clauses stays green.** The identity comparison
refuses the replaced leaf with no flag at all, so the flag is a **narrowing** and the comparison is
the **boundary**. That means no behavioural clause discriminates it, and that is by design — the two
paths answer one outcome the union deliberately does not split — so rather than leave it looking like
defence in depth nobody can justify, the constant's docblock now says what it still buys: **the
replacement is never opened**, where the identity comparison refuses it after the fact, and a symlink
to a FIFO is the shape where opening is itself the harm, `openSync` on one blocking until a writer
appears. Its Windows blind spot is restated as a lost *refusal* rather than a lost *guarantee*, which
is what it now is.

### The residual, stated on the terms E-6 sets

The confinement approves the occurrence directory **by name** and `readdirSync` resolves that name
again, so a swap between `pathInside` and the enumeration itself would enumerate the wrong directory
and approve one of its inodes. Node exposes no `openat` to hold a descriptor across the two — which
is `static.ts`'s own stated reason — and E-6 accepts that bound explicitly. It is written into
`readRetainedFile`'s docblock beside Q-0122's two sentences: the approved inode may itself have been
linked elsewhere, and bytes appended to it after the check are the bytes returned. Both are the file
the enumeration approved, and neither is a path outside the run being served. The authority is
`docs/GLOSSARY.md`'s **Confinement** entry — *"not a permission model, not a sandbox, and **not a
claim about a race** — it says where a path is at the moment it is checked"* — and a stated bound is
this repository's answer where no syscall Node exposes can close one, which is the run lock's own
remainder at a second subject.

### The test

**`the occurrence DIRECTORY replaced by a symlink after the enumeration is refused, unread`**, in
AC-3's describe, which is where E-6 puts it. `stageOn` interleaves the swap between the enumeration's
`lstat` of the leaf and the open that follows: the real occurrence directory is **renamed** aside —
`renameSync` rather than a removal, so nothing the hook delegates to is re-entered — and a symlink to
the sandbox put in its place.

**Three premises before the verdict**, because a swap that did not happen, a link that does not
resolve, or a replacement the open would have refused anyway would each make the clause pass over an
implementation with no identity check at all: the directory really is a symlink now, the outside file
really is reachable through the exact name the read joins, and what stands at that name **is a
regular file** — so `O_NOFOLLOW` alone would not have refused it. Then the outcome, that no `SECRET`
byte reached the answer, and that the planted file is unaltered.

It is **constructed and has to be** (R-1): all 940 `occurrence_dir` values on this machine are
well-formed and nothing under a run directory is anything but a regular file, so a fixture drawn from
`.quorum/runs` would pass over an implementation with no confinement whatever.

### Shown red before green, against round 4's own open

With the identity comparison reverted to `if (!fs.fstatSync(handle).isFile())`:

```
FAIL  the occurrence DIRECTORY replaced by a symlink after the enumeration is refused, unread
AssertionError: a replaced parent directory was followed and an outside file was served:
  expected 'file' to be 'no-such-file'
Tests  1 failed | 28 passed (29)
```

`'file'` is the blocker itself — the outside file **served**, not merely unrefused — with
twenty-eight siblings green, so the clause discriminates rather than being shown red by a neighbour.

And the second measurement, which is what licenses the `O_NOFOLLOW` paragraph rather than leaving it
an assertion: with `NO_FOLLOW` forced to `0`, **29 passed**.

---

## 2 File by file

| file | what changed |
| --- | --- |
| `packages/core/src/run-history/reader.ts` | `RetainedEntry` beside `RetainedFile`, module-private, carrying `dev`/`ino`; `retainedIn` lstats with `{ bigint: true }` and returns `entries`; `listRetainedFiles` projects them back to `{ name, bytes }`; `readRetainedFile` holds the descriptor's `fstat` against the entry's identity. Docblocks: `retainedIn` gains the paragraph on where the identity is taken and why; `readRetainedFile`'s TOCTOU paragraph separates what `O_NOFOLLOW` narrows from what the comparison bounds, and states the residual with its authority; `NO_FOLLOW`'s states what it is worth, measured; `no-such-file`'s widens to the replaced-parent case. |
| `packages/core/src/run-history/retained.test.ts` | the staged parent-swap clause in AC-3's describe, with its three premises. 29 tests. |
| `packages/core/src/run-history/run-history.source.test.ts` | one clause of the field-walk comment: `RetainedEntry` is module-private, so its two fields are the lock record's case rather than an interface the walk failed to enter. The count stays **70**. |
| `packages/core/src/turbo-inputs.test.ts` | one `READ_BASES` row for the new clause's `directory` base. Q-0072's guard refused the read until it was registered — the machinery working as designed, and the fifth registration this branch has earned on the way in. |
| `docs/04-architecture.md` | the §`packages/server` confinement paragraph gains *the check and the read name one file*, why an `O_NOFOLLOW` open covers the last component alone, and the accepted residual. AC-14's five asserted needles and E-2's four retired sentences are untouched and still pass. |

---

## 3 What I deliberately left alone

1. **No criterion moved and no erratum is owed.** E-6 says nothing in AC-3 moves; AC-1's warnings
   channel, AC-4's partial listing and AC-5's ten rows are exactly as round 4 left them.
2. **No new refusal code, no new outcome, no wire field, no schema, no route, no browser change.**
   The transport maps `no-such-file` to 404 as it already did, so `packages/server` and `apps/web`
   are untouched by this round.
3. **`readRun` is unchanged**, still *"a cast, never a check"*; a traversing `occurrence_dir` is
   still reported by `GET /history/:id` exactly as it sits on disk, and nothing repairs a manifest.
4. **The race is not claimed closed.** E-6 says explicitly not to return `blocked` on the ground that
   Node cannot fully close it, and that stating the bound **is** the deliverable. It is stated.
5. **`O_NOFOLLOW` is not deleted**, though nothing now discriminates it — see §1, where what it buys
   is written down rather than assumed.
6. **Nothing else in the branch moved.** No tidying, no register renumbered, no criterion re-opened —
   the diff is the one fix, its test, two earned register lines and the document sentence this change
   makes incomplete.

---

## 4 Gate obligations

- **GO-1 — discharged, unchanged from iterations 1–4.** E-1 ratifies OQ-1; I did not treat it as
  live and wrote no `docs/decisions/` entry. E-6 is read as the ruling it is: the remedy is named and
  precedented, so `blocked` on the race being unclosable in Node would have been wrong.
- **GO-2** — fourteen criteria, not split, nothing trimmed.
- **GO-3 — nothing owed.** `contracts/` is untouched and outside this role's paths; E-3's read-side
  note states no refusal code and no confinement mechanism, and is unaffected.
- **GO-4 — owed, and measured.** The branch diff is **308,365 B** against the 200,000-byte cap, so a
  round-5 reviewer sees **64.9%**. The cut falls **inside**
  `packages/core/src/run-history/retained.test.ts` — 160,753 B precede it and its own patch is
  46,178 B — and **eight files get no patch at all**, one more than round 4's seven because the
  branch grew: `packages/core/src/run-history/run-history.source.test.ts`,
  `packages/core/src/turbo-inputs.test.ts`, `packages/server/src/package.test.ts`,
  `packages/server/src/read.ts`, `packages/server/src/retained.test.ts`,
  `packages/shared/src/docs-retained.test.ts`, `packages/shared/src/wire-retained.test.ts`,
  `packages/shared/src/wire.ts`. **Four of this round's five edits are inside the visible prefix** —
  `reader.ts`, `docs/04-architecture.md`, and the new clause in `retained.test.ts`, which ends 29,044
  file bytes in against roughly 38,400 visible — and **one is not**: `turbo-inputs.test.ts`'s
  register row. Measured with `git diff harness/Q-0137/integration` over this worktree and by
  cumulative path-ordered prefixes, which is what the commit will carry; the engine's own invocation
  may differ marginally in options, so the share is stated as measured rather than as the engine's
  figure.
- **GO-5 — the human's.** It requires running the product against a real daemon and transcribing what
  it rendered.
- **GO-6 — one row done here.** This worktree has neither `.harness/worktrees` nor `.quorum/runs` and
  is green forced at 21/21 tasks, 0 cached. The `main`-after-merge row is the gate's.

---

## 5 Verification

| check | result |
| --- | --- |
| `pnpm install --frozen-lockfile` | *Already up to date*, 228 ms |
| `pnpm turbo run test lint typecheck --force --continue` | **21/21 tasks, 0 cached** |
| `pnpm exec quorum lint` | **6/6** |
| `pnpm run sweep:git-identity` | green, 7/7 tasks 0 cached, *"no resolvable git identity"* |
| mutation — the identity comparison reverted to round 4's `isFile()` open | **1 red / 28 green**, `expected 'file' to be 'no-such-file'` — the outside file served |
| probe — `NO_FOLLOW` forced to `0` | **29 green**, which is the measurement behind §1's narrowing paragraph |
| `packages/core` alone | 69 passed \| 1 skipped files, 1628 passed \| 2 skipped tests — both skips the pre-existing `real-cli.probe.test.ts` pair, and the new clause ran rather than skipping |
| `git status` | five modified files, nothing staged, nothing untracked |
